import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';

import { db, generateId, toMySQLDate, type User, type Team, type team_members, type activation_keys } from '../db/mysql.js';
import { signAccessToken, requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
import { env } from '../config/env.js';

export const authRouter = Router();

// ─── Helper: Build frontend-compatible User shape ──────────────────
export async function buildFrontendUser(userId: string) {
  const user = await db.queryOne<User>(
    'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return null;

  // Get team membership to determine admin status
  const membership = await db.queryOne<team_members & { teamName: string }>(
    `SELECT tm.*, t.name AS teamName FROM team_members tm
     JOIN teams t ON tm.teamId = t.id
     WHERE tm.userId = ? LIMIT 1`,
    [userId]
  );

  const isAdmin = membership?.role === 'ADMIN';
  const isStaff = membership?.role === 'STAFF';
  const nameParts = ((user as any).name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Resolve role from user_roles table (fall back to team membership for admins)
  let userRole: { id: number; name: string; slug: string } | null = null;
  const roleRow = await db.queryOne<{ role_id: number; role_name: string; role_slug: string }>(
    `SELECT r.id AS role_id, r.name AS role_name, r.slug AS role_slug
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
     LIMIT 1`,
    [userId]
  );
  if (roleRow) {
    userRole = { id: roleRow.role_id, name: roleRow.role_name, slug: roleRow.role_slug };
  } else if (isAdmin) {
    userRole = { id: 1, name: 'Admin', slug: 'admin' };
  } else {
    userRole = { id: 2, name: 'Viewer', slug: 'viewer' };
  }

  // Resolve permissions from role_permissions
  let permissions: Array<{ id: number; name: string; slug: string }> = [];
  if (isAdmin || isStaff || userRole.slug === 'admin' || userRole.slug === 'super_admin') {
    permissions = [{ id: 14, name: 'All Access', slug: '*' }];
  } else if (roleRow) {
    permissions = await db.query<{ id: number; name: string; slug: string }>(
      `SELECT p.id, p.name, p.slug
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [roleRow.role_id]
    );
  }

  return {
    id: user.id,
    username: user.email,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    name: (user as any).name || null,
    phone: (user as any).phone || null,
    avatar: (user as any).avatarUrl || null,
    is_admin: isAdmin,
    is_staff: isStaff,
    is_active: true,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    role: userRole,
    permissions,
    team: membership
      ? { id: membership.teamId, name: membership.teamName, role: membership.role }
      : null,
  };
}

// ─── GET /auth/me — Returns current user in frontend shape ────────
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const frontendUser = await buildFrontendUser(userId);
    if (!frontendUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User retrieved',
      data: { user: frontendUser },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout — Client-side token invalidation ───────────
authRouter.post('/logout', requireAuth, (_req, res) => {
  // JWT is stateless — client clears token. This endpoint confirms intent.
  res.json({ success: true, message: 'Logged out' });
});

function generateActivationKey(email: string): string {
  const hash = crypto.createHash('sha256').update(email + Date.now()).digest('hex').substring(0, 16).toUpperCase();
  return `USER-${hash}`;
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  teamName: z.string().min(1).optional(),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const input = RegisterSchema.parse(req.body);

    const existing = await db.queryOne<User>('SELECT id FROM users WHERE email = ?', [input.email]);
    if (existing) throw badRequest('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await db.transaction(async (conn) => {
      const userId = generateId();
      const teamId = generateId();
      const memberId = generateId();
      const keyId = generateId();
      const now = toMySQLDate(new Date());
      const keyCode = generateActivationKey(input.email);

      await conn.execute(
        'INSERT INTO users (id, email, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [userId, input.email, passwordHash, now, now]
      );

      await conn.execute(
        'INSERT INTO teams (id, name, createdByUserId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [teamId, input.teamName ?? 'My Team', userId, now, now]
      );

      await conn.execute(
        'INSERT INTO team_members (id, teamId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [memberId, teamId, userId, 'ADMIN', now]
      );

      await conn.execute(
        `INSERT INTO activation_keys (id, code, tier, isActive, cloudSyncAllowed, vaultAllowed, maxAgents, maxUsers, createdAt, createdByUserId) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [keyId, keyCode, 'PERSONAL', true, true, true, null, 1, now, userId]
      );

      return { 
        user: { id: userId, email: input.email }, 
        team: { id: teamId, name: input.teamName ?? 'My Team' },
        activationKey: { code: keyCode }
      };
    });

    const token = signAccessToken({ userId: result.user.id });
    res.status(201).json({
      accessToken: token,
      user: { id: result.user.id, email: result.user.email },
      team: { id: result.team.id, name: result.team.name },
      activationKey: result.activationKey.code,
    });
  } catch (err) {
    next(err);
  }
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);
    const user = await db.queryOne<User>('SELECT * FROM users WHERE email = ?', [input.email]);
    if (!user) throw badRequest('Invalid email or password');

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw badRequest('Invalid email or password');

    // ── 2FA check ─────────────────────────────────────────────────
    const twoFactorRow = await db.queryOne<{ is_enabled: number }>(
      `SELECT is_enabled FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [user.id],
    );

    if (twoFactorRow) {
      // User has 2FA enabled — issue a short-lived temporary token
      // The client must call /auth/2fa/verify with this token + TOTP code
      const tempToken = jwt.sign(
        { userId: user.id, purpose: '2fa', rememberMe: input.rememberMe },
        env.JWT_SECRET,
        { expiresIn: '5m' },
      );

      return res.json({
        success: true,
        requires_2fa: true,
        message: 'Two-factor authentication required. Submit your code to /auth/2fa/verify.',
        temp_token: tempToken,
      });
    }
    // ── End 2FA check ─────────────────────────────────────────────

    // Mobile clients may request longer-lived tokens (30 days)
    const tokenExpiry = input.rememberMe ? '30d' : undefined;
    const token = signAccessToken({ userId: user.id }, tokenExpiry);

    // Build frontend-compatible user shape
    const frontendUser = await buildFrontendUser(user.id);

    // Return in both the legacy shape AND the frontend { success, data } shape
    res.json({ 
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: frontendUser,
      },
      // Legacy fields (mobile app compat)
      accessToken: token, 
      token: token,
      expiresIn: input.rememberMe ? '30d' : env.JWT_EXPIRES_IN,
      user: frontendUser,
    });
  } catch (err) {
    next(err);
  }
});

// Simple refresh: client sends current token, we re-issue if valid.
const RefreshSchema = z.object({
  accessToken: z.string().min(1),
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const input = RefreshSchema.parse(req.body);
    const decoded: any = jwt.verify(input.accessToken, env.JWT_SECRET);
    if (!decoded?.userId) throw badRequest('Invalid token');

    const token = signAccessToken({ userId: String(decoded.userId) });
    res.json({ accessToken: token });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/permissions — Returns permissions for current user ─
authRouter.get('/permissions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const frontendUser = await buildFrontendUser(userId);
    if (!frontendUser) {
      return res.status(404).json({ success: false, data: [] });
    }
    res.json({ success: true, data: frontendUser.permissions });
  } catch (err) {
    next(err);
  }
});
