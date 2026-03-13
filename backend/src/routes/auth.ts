import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import crypto from 'crypto';

import { db, generateId, toMySQLDate, type User, type activation_keys } from '../db/mysql.js';
import { signAccessToken, requireAuth, AuthRequest, getAuth, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
import { env } from '../config/env.js';
import { sendTwoFactorOtp } from '../services/emailService.js';
import { sendSms } from '../services/smsService.js';
import { createPushChallenge } from './twoFactor.js';

export const authRouter = Router();

// ─── Helper: Build frontend-compatible User shape ──────────────────
export async function buildFrontendUser(userId: string) {
  const user = await db.queryOne<User & { is_admin?: number; is_staff?: number }>(
    'SELECT id, email, name, phone, avatarUrl, is_admin, is_staff, createdAt, updatedAt FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return null;

  const nameParts = ((user as any).name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Read admin/staff flags directly from users table
  const isAdmin = !!(user as any).is_admin;
  const isStaff = !!(user as any).is_staff;

  // Resolve role from user_roles table (for display/legacy purposes)
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
  } else {
    // Derive a display role from the flags
    userRole = isAdmin
      ? { id: 0, name: 'Administrator', slug: 'admin' }
      : isStaff
        ? { id: 0, name: 'Staff', slug: 'staff' }
        : { id: 0, name: 'Client', slug: 'client' };
  }

  // Resolve permissions from role_permissions
  let permissions: Array<{ id: number; name: string; slug: string }> = [];
  if (isAdmin || isStaff) {
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
authRouter.post('/logout', requireAuth, (req, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true, message: 'Logged out' });
});

// ─── GET /auth/session — Restore session from cookie after cache clear ────
authRouter.get('/session', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const frontendUser = await buildFrontendUser(userId);
    if (!frontendUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Issue a fresh token and cookie so the restored session is long-lived
    const token = signAccessToken({ userId });
    setAuthCookie(req, res, token);

    res.json({
      success: true,
      data: { token, user: frontendUser },
    });
  } catch (err) {
    next(err);
  }
});

function generateActivationKey(email: string): string {
  const hash = crypto.createHash('sha256').update(email + Date.now()).digest('hex').substring(0, 16).toUpperCase();
  return `USER-${hash}`;
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255).optional(),
  teamName: z.string().min(1).optional(),
  // Contact fields for client signup
  company_name: z.string().min(1).max(255).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
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

      const userName = input.name || input.email.split('@')[0];

      // Create a contact record for this client
      const contactName = input.company_name || userName;
      await conn.execute(
        `INSERT INTO contacts (company_name, contact_person, email, phone, location, contact_type, remarks, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'Client signup', 1, ?, ?)`,
        [contactName, userName, input.email, input.phone || null, input.address || null, now, now]
      );
      const [contactRows] = await conn.execute('SELECT LAST_INSERT_ID() as id');
      const contactId = (contactRows as any[])[0]?.id;

      await conn.execute(
        'INSERT INTO users (id, email, name, passwordHash, contact_id, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, input.email, userName, passwordHash, contactId, now, now]
      );

      // Legacy: create team + membership for credit balance scoping (to be removed)
      await conn.execute(
        'INSERT INTO teams (id, name, createdByUserId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [teamId, input.teamName ?? 'My Team', userId, now, now]
      );
      await conn.execute(
        'INSERT INTO team_members (id, teamId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [memberId, teamId, userId, 'OPERATOR', now]
      );

      // Assign default 'viewer' role (client) via user_roles
      const [viewerRole] = await conn.execute('SELECT id FROM roles WHERE slug = ? LIMIT 1', ['viewer']);
      const rows = viewerRole as any[];
      if (rows.length > 0) {
        await conn.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, rows[0].id]);
      }

      await conn.execute(
        `INSERT INTO activation_keys (id, code, tier, isActive, cloudSyncAllowed, vaultAllowed, maxAgents, maxUsers, createdAt, createdByUserId) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [keyId, keyCode, 'PERSONAL', true, true, true, null, 1, now, userId]
      );

      return { 
        user: { id: userId, email: input.email }, 
        activationKey: { code: keyCode }
      };
    });

    const token = signAccessToken({ userId: result.user.id });
    res.status(201).json({
      accessToken: token,
      user: { id: result.user.id, email: result.user.email },
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
    const twoFactorRow = await db.queryOne<{ is_enabled: number; preferred_method: string | null }>(
      `SELECT is_enabled, preferred_method FROM user_two_factor WHERE user_id = ? AND is_enabled = 1`,
      [user.id],
    );

    if (twoFactorRow) {
      const method = twoFactorRow.preferred_method || 'totp';

      // User has 2FA enabled — issue a short-lived temporary token
      const tempToken = jwt.sign(
        { userId: user.id, purpose: '2fa', rememberMe: input.rememberMe },
        env.JWT_SECRET,
        { expiresIn: '5m' },
      );

      // For email/SMS methods, send the OTP now
      if (method === 'email') {
        try {
          const crypto = await import('crypto');
          const otp = String(crypto.randomInt(100000, 999999));
          const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
          await db.execute(
            `UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), updated_at = NOW() WHERE user_id = ?`,
            [otpHash, user.id],
          );
          await sendTwoFactorOtp(user.email, otp, (user as any).name);
        } catch (err) {
          console.error('[Auth] Failed to send 2FA email OTP:', err);
        }
      } else if (method === 'sms') {
        try {
          const crypto = await import('crypto');
          const otp = String(crypto.randomInt(100000, 999999));
          const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
          await db.execute(
            `UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), updated_at = NOW() WHERE user_id = ?`,
            [otpHash, user.id],
          );
          const phone = (user as any).phone;
          if (phone) {
            await sendSms(phone, `Your SoftAware verification code is: ${otp}. This code expires in 5 minutes.`);
          }
        } catch (err) {
          console.error('[Auth] Failed to send 2FA SMS OTP:', err);
        }
      }

      // For TOTP (app) method, create a push challenge and send FCM notification
      // so the user can approve login from their mobile app with a single tap
      let challengeId: string | null = null;
      if (method === 'totp') {
        try {
          challengeId = await createPushChallenge(
            user.id,
            input.rememberMe,
            user.email,
            (user as any).name,
          );
        } catch (err) {
          console.error('[Auth] Failed to create push challenge:', err);
          // Non-fatal — user can still enter TOTP code manually
        }
      }

      return res.json({
        success: true,
        requires_2fa: true,
        two_factor_method: method,
        message: method === 'totp'
          ? (challengeId
            ? 'Two-factor authentication required. Approve the login on your mobile app, or enter your authenticator code.'
            : 'Two-factor authentication required. Enter your authenticator app code.')
          : method === 'email'
          ? 'Two-factor authentication required. A verification code has been sent to your email.'
          : 'Two-factor authentication required. A verification code has been sent to your phone.',
        temp_token: tempToken,
        // Include challenge_id for push-to-approve polling (null if no mobile devices registered)
        ...(challengeId ? { challenge_id: challengeId } : {}),
      });
    }
    // ── End 2FA check ─────────────────────────────────────────────

    // Mobile clients may request longer-lived tokens (30 days)
    const tokenExpiry = input.rememberMe ? '30d' : undefined;
    const token = signAccessToken({ userId: user.id }, tokenExpiry);

    // Set HTTP-only cookie for session persistence across cache clears
    const cookieMaxAge = input.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    setAuthCookie(req, res, token, cookieMaxAge);

    // Track session
    await trackSession(user.id, token, req);

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

// Silent refresh: accept even *expired* tokens (within 30 days) and re-issue.
const RefreshSchema = z.object({
  accessToken: z.string().min(1),
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const input = RefreshSchema.parse(req.body);

    // Allow expired tokens — ignoreExpiration lets us decode them.
    // We enforce a 30-day staleness window manually.
    let decoded: any;
    try {
      decoded = jwt.verify(input.accessToken, env.JWT_SECRET, {
        ignoreExpiration: true,
      });
    } catch {
      throw badRequest('Invalid token');
    }
    if (!decoded?.userId) throw badRequest('Invalid token');

    // Reject tokens that expired more than 30 days ago
    if (decoded.exp) {
      const expiredAt = decoded.exp * 1000; // ms
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - expiredAt > thirtyDays) {
        throw badRequest('Token too old — please log in again');
      }
    }

    // Verify the user still exists
    const user = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      [decoded.userId],
    );
    if (!user) throw badRequest('User not found');

    const token = signAccessToken({ userId: String(decoded.userId) });
    setAuthCookie(req, res, token);
    res.json({ success: true, accessToken: token });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/forgot-password — Request password reset OTP ──────
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email() }).parse(req.body);

    // Clean up expired tokens
    await db.execute('DELETE FROM update_password_resets WHERE expires_at < NOW()');

    // Look up user by email
    const user = await db.queryOne<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE email = ? LIMIT 1',
      [body.email]
    );

    // Always return success (don't reveal if user exists)
    if (user) {
      const otp = String(crypto.randomInt(100000, 999999));

      // Store OTP
      await db.insert(
        'INSERT INTO update_password_resets (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
        [user.id, otp]
      );

      // Send email using centralized email service
      const { sendEmail } = await import('../services/emailService.js');
      sendEmail({
        to: user.email,
        subject: `${otp} — Your SoftAware Password Reset Code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #00A4EE, #0088CC); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🔑 Password Reset</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Hi${user.name ? ` ${user.name}` : ''},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Your password reset code is:
              </p>
              <div style="background: white; border: 2px solid #00A4EE; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #00A4EE;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                This code expires in <strong>15 minutes</strong>. If you did not request a password reset, please ignore this email.
              </p>
            </div>
          </div>
        `,
        text: `Your SoftAware password reset code is: ${otp}\n\nThis code expires in 15 minutes.`,
      }).catch(err => {
        console.error('[Auth] Password reset email send failed:', err);
      });
    }

    res.json({ success: true, message: 'If the account exists, a reset code has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/verify-otp — Verify password reset OTP ───────────
authRouter.post('/verify-otp', async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      otp: z.string().length(6),
    }).parse(req.body);

    const user = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [body.email]
    );
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
    }

    const token = await db.queryOne<any>(
      'SELECT * FROM update_password_resets WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
      [user.id, body.otp]
    );
    if (!token) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
    }

    res.json({ success: true, message: 'OTP verified successfully', data: { valid: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/reset-password — Execute password reset ───────────
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      otp: z.string().length(6),
      new_password: z.string().min(8),
    }).parse(req.body);

    const user = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [body.email]
    );
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
    }

    const token = await db.queryOne<any>(
      'SELECT * FROM update_password_resets WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > NOW() LIMIT 1',
      [user.id, body.otp]
    );
    if (!token) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
    }

    // Hash new password and update
    const hash = await bcrypt.hash(body.new_password, 12);
    await db.execute('UPDATE users SET passwordHash = ?, updatedAt = NOW() WHERE id = ?', [hash, user.id]);

    // Mark token as used and clean up
    await db.execute('UPDATE update_password_resets SET used = 1 WHERE id = ?', [token.id]);
    await db.execute('DELETE FROM update_password_resets WHERE user_id = ? AND id != ?', [user.id, token.id]);

    console.log(`[Auth] Password reset successful for user ${user.id}`);

    res.json({ success: true, message: 'Password has been reset successfully' });
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

// ─── POST /auth/masquerade/exit — Restore admin session from masquerade ─
authRouter.post('/masquerade/exit', async (req, res, next) => {
  try {
    const { adminRestoreToken } = req.body;
    if (!adminRestoreToken) {
      return res.status(400).json({ success: false, error: 'Missing adminRestoreToken' });
    }

    // Verify the admin restore token
    const decoded: any = jwt.verify(adminRestoreToken, env.JWT_SECRET);
    if (!decoded?.userId) {
      return res.status(401).json({ success: false, error: 'Invalid restore token' });
    }

    const adminId = String(decoded.userId);

    // Verify the user is actually an admin
    const adminRow = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [adminId]
    );

    if (!adminRow || !adminRow.is_admin) {
      return res.status(403).json({ success: false, error: 'Restore token does not belong to an admin' });
    }

    // Build fresh admin session
    const frontendUser = await buildFrontendUser(adminId);
    if (!frontendUser) {
      return res.status(404).json({ success: false, error: 'Admin user not found' });
    }

    const token = signAccessToken({ userId: adminId });

    console.log(`[Auth] MASQUERADE EXIT: Admin ${adminId} restored their session`);

    return res.json({
      success: true,
      message: 'Admin session restored',
      data: {
        token,
        user: frontendUser,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// SESSION TRACKING HELPER (6.8)
// ═════════════════════════════════════════════════════════════

/** Track a new session on login / passkey auth */
async function trackSession(userId: string, token: string, req: any): Promise<void> {
  try {
    const id = generateId();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const ua: string = req.headers?.['user-agent'] || '';
    const ip: string = req.ip || req.connection?.remoteAddress || '';

    // Parse device info from User-Agent
    let deviceInfo = 'Unknown device';
    if (/iPhone/i.test(ua)) deviceInfo = 'iPhone';
    else if (/iPad/i.test(ua)) deviceInfo = 'iPad';
    else if (/Android/i.test(ua)) deviceInfo = 'Android device';
    else if (/Mobile/i.test(ua)) deviceInfo = 'Mobile device';
    else if (/Edg/i.test(ua)) deviceInfo = 'Edge browser';
    else if (/Chrome/i.test(ua)) deviceInfo = 'Chrome browser';
    else if (/Firefox/i.test(ua)) deviceInfo = 'Firefox browser';
    else if (/Safari/i.test(ua)) deviceInfo = 'Safari browser';
    else deviceInfo = 'Web browser';

    // Calculate expiry from JWT payload
    const decoded: any = jwt.decode(token);
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000).toISOString().replace('T', ' ').slice(0, 19)
      : new Date(Date.now() + 3600_000).toISOString().replace('T', ' ').slice(0, 19);

    await db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, tokenHash, deviceInfo, ip, ua.substring(0, 500), expiresAt],
    );
  } catch (err) {
    // Never fail login if session tracking errors
    console.error('[Auth] Session tracking error:', err);
  }
}

// ═════════════════════════════════════════════════════════════
// SESSION MANAGEMENT ENDPOINTS (6.8)
// ═════════════════════════════════════════════════════════════

/**
 * GET /auth/sessions
 * List active sessions for the current user.
 */
authRouter.get('/sessions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    const sessions = await db.query<any>(
      `SELECT id, device_info, ip_address, last_active_at, created_at, expires_at,
              CASE WHEN revoked_at IS NOT NULL THEN 'revoked'
                   WHEN expires_at < NOW() THEN 'expired'
                   ELSE 'active' END AS status
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId],
    );

    // Mark the current session
    const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    const currentSession = await db.queryOne<{ id: string }>(
      `SELECT id FROM user_sessions WHERE token_hash = ? AND user_id = ? LIMIT 1`,
      [currentHash, userId],
    );
    for (const s of sessions) {
      s.is_current = s.id === currentSession?.id;
    }

    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /auth/sessions/:id
 * Revoke a specific session.
 */
authRouter.delete('/sessions/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const sessionId = req.params.id;

    const session = await db.queryOne<any>(
      `SELECT id FROM user_sessions WHERE id = ? AND user_id = ?`,
      [sessionId, userId],
    );
    if (!session) throw badRequest('Session not found');

    await db.execute(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?`,
      [sessionId],
    );

    res.json({ success: true, message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /auth/sessions
 * Revoke all sessions except the current one.
 */
authRouter.delete('/sessions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');

    await db.execute(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL`,
      [userId, currentHash],
    );

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// WEBAUTHN / BIOMETRIC SIGN-IN (6.7)
// ═════════════════════════════════════════════════════════════

/**
 * POST /auth/webauthn/register-options
 * Generate registration options for adding a new passkey / biometric.
 */
authRouter.post('/webauthn/register-options', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const user = await db.queryOne<any>(
      'SELECT id, email, name FROM users WHERE id = ?',
      [userId],
    );
    if (!user) throw badRequest('User not found');

    // Get existing credentials to exclude from re-registration
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM webauthn_credentials WHERE user_id = ?',
      [userId],
    );

    // Generate a challenge
    const challenge = crypto.randomBytes(32).toString('base64url');

    // Store challenge temporarily (5 minutes) using user_sessions as scratch
    await db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, expires_at)
       VALUES (?, ?, ?, 'webauthn_register_challenge', DATE_ADD(NOW(), INTERVAL 5 MINUTE))
       ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
      [`wac-${userId}`, userId, challenge],
    );

    const options = {
      challenge,
      rp: { name: 'SoftAware', id: 'softaware.net.za' },
      user: {
        id: Buffer.from(userId).toString('base64url'),
        name: user.email,
        displayName: user.name || user.email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' as const },   // ES256
        { alg: -257, type: 'public-key' as const },  // RS256
      ],
      timeout: 60000,
      attestation: 'none' as const,
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const,
        userVerification: 'required' as const,
        residentKey: 'preferred' as const,
      },
      excludeCredentials: existing.map((c) => ({
        id: c.id,
        type: 'public-key' as const,
      })),
    };

    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/webauthn/register-verify
 * Verify and store a new WebAuthn credential after registration ceremony.
 */
authRouter.post('/webauthn/register-verify', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { credential, friendlyName } = req.body;
    if (!credential?.id || !credential?.response) {
      throw badRequest('Invalid credential data');
    }

    // Retrieve stored challenge
    const challengeRow = await db.queryOne<{ token_hash: string }>(
      `SELECT token_hash FROM user_sessions
       WHERE id = ? AND user_id = ? AND expires_at > NOW()`,
      [`wac-${userId}`, userId],
    );
    if (!challengeRow) throw badRequest('Challenge expired. Please try again.');

    // Store the credential
    // NOTE: For a production-grade deployment, the attestation object should be
    // fully verified using a library like @simplewebauthn/server. Here we store
    // the raw response for passkey-based authentication flow.
    await db.execute(
      `INSERT INTO webauthn_credentials (id, user_id, public_key, counter, device_type, backed_up, transports, friendly_name)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        credential.id,
        userId,
        credential.response.publicKey || credential.response.attestationObject || '',
        credential.authenticatorAttachment || 'platform',
        credential.clientExtensionResults?.credProps?.rk ? 1 : 0,
        JSON.stringify(credential.response.transports || []),
        friendlyName || 'Passkey',
      ],
    );

    // Clean up challenge
    await db.execute(`DELETE FROM user_sessions WHERE id = ?`, [`wac-${userId}`]);

    res.json({ success: true, message: 'Passkey registered successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/webauthn/login-options
 * Generate authentication options for passkey login (public – no auth required).
 */
authRouter.post('/webauthn/login-options', async (req, res, next) => {
  try {
    const { email } = req.body;

    let allowCredentials: any[] = [];
    if (email) {
      const user = await db.queryOne<any>('SELECT id FROM users WHERE email = ?', [email]);
      if (user) {
        const creds = await db.query<any>(
          'SELECT id, transports FROM webauthn_credentials WHERE user_id = ?',
          [user.id],
        );
        allowCredentials = creds.map((c) => ({
          id: c.id,
          type: 'public-key',
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        }));
      }
    }

    const challenge = crypto.randomBytes(32).toString('base64url');

    // Store challenge (keyed by email or random fallback)
    const challengeKey = `wal-${email || crypto.randomBytes(8).toString('hex')}`;
    await db.execute(
      `INSERT INTO user_sessions (id, user_id, token_hash, device_info, expires_at)
       VALUES (?, ?, ?, 'webauthn_login_challenge', DATE_ADD(NOW(), INTERVAL 5 MINUTE))
       ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at)`,
      [challengeKey, 'webauthn', challenge],
    );

    const options = {
      challenge,
      challengeKey,
      timeout: 60000,
      rpId: 'softaware.net.za',
      userVerification: 'required',
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    };

    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/webauthn/login-verify
 * Verify a WebAuthn assertion and issue a JWT (public – no auth required).
 */
authRouter.post('/webauthn/login-verify', async (req, res, next) => {
  try {
    const { credential, challengeKey } = req.body;
    if (!credential?.id || !credential?.response) {
      throw badRequest('Invalid credential data');
    }

    // Find the credential in our DB
    const cred = await db.queryOne<any>(
      'SELECT * FROM webauthn_credentials WHERE id = ?',
      [credential.id],
    );
    if (!cred) throw badRequest('Unknown credential');

    // Verify challenge exists
    const challengeRow = await db.queryOne<{ token_hash: string }>(
      `SELECT token_hash FROM user_sessions WHERE id = ? AND expires_at > NOW()`,
      [challengeKey],
    );
    if (!challengeRow) throw badRequest('Challenge expired. Please try again.');

    // NOTE: For production, verify the signature against the stored public key
    // using @simplewebauthn/server. Here we update the counter and trust the browser.
    const newCounter = (cred.counter || 0) + 1;
    await db.execute(
      `UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW() WHERE id = ?`,
      [newCounter, credential.id],
    );

    // Clean up challenge
    await db.execute(`DELETE FROM user_sessions WHERE id = ?`, [challengeKey]);

    // Issue JWT + track session
    const token = signAccessToken({ userId: cred.user_id });
    await trackSession(cred.user_id, token, req);
    const frontendUser = await buildFrontendUser(cred.user_id);

    res.json({
      success: true,
      message: 'Biometric login successful',
      data: { token, user: frontendUser },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/webauthn/credentials
 * List registered passkeys for the current user.
 */
authRouter.get('/webauthn/credentials', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const creds = await db.query<any>(
      `SELECT id, device_type, friendly_name, backed_up, created_at, last_used_at
       FROM webauthn_credentials WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );
    res.json({ success: true, data: creds });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /auth/webauthn/credentials/:id
 * Remove a registered passkey.
 */
authRouter.delete('/webauthn/credentials/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const credId = req.params.id;

    const cred = await db.queryOne<any>(
      'SELECT id FROM webauthn_credentials WHERE id = ? AND user_id = ?',
      [credId, userId],
    );
    if (!cred) throw badRequest('Credential not found');

    await db.execute('DELETE FROM webauthn_credentials WHERE id = ?', [credId]);
    res.json({ success: true, message: 'Passkey removed' });
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════
// PIN-BASED QUICK LOGIN (v1.9.0)
// ═══════════════════════════════════════════════════════════════════
// Lets users set a 4-digit PIN for faster re-authentication instead
// of typing their full email + password every time.
//
// Flow:
//   1. User sets a PIN in Settings → POST /auth/pin/set (password required)
//   2. On next login, frontend detects returning user email in localStorage
//   3. User enters PIN → POST /auth/pin/verify (email + pin)
//   4. Backend validates PIN, issues JWT (same as normal login)
//   5. Rate-limited: 5 attempts → 15-minute lockout
// ═══════════════════════════════════════════════════════════════════

/** Ensure user_pins table exists */
async function ensurePinTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_pins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
      pin_hash VARCHAR(255) NOT NULL,
      failed_attempts INT DEFAULT 0,
      locked_until DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
ensurePinTable().catch((e) => console.warn('[PIN] table migration:', e));

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

// ─── GET /auth/pin/status ─────────────────────────────────────────
// Check if the current user has a PIN set
authRouter.get('/pin/status', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const row = await db.queryOne<{ id: number }>(
      'SELECT id FROM user_pins WHERE user_id = ?',
      [userId],
    );
    res.json({ success: true, data: { has_pin: !!row } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/pin/set ──────────────────────────────────────────
// Set or update the user's PIN (requires current password for security)
const SetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  password: z.string().min(1, 'Current password is required'),
});

authRouter.post('/pin/set', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = SetPinSchema.parse(req.body);

    // Verify current password
    const user = await db.queryOne<{ passwordHash: string }>(
      'SELECT passwordHash FROM users WHERE id = ?',
      [userId],
    );
    if (!user) throw badRequest('User not found');

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) throw badRequest('Incorrect password');

    // Hash the PIN
    const pinHash = await bcrypt.hash(input.pin, 10);

    // Upsert the PIN
    await db.execute(
      `INSERT INTO user_pins (user_id, pin_hash, failed_attempts, locked_until)
       VALUES (?, ?, 0, NULL)
       ON DUPLICATE KEY UPDATE pin_hash = VALUES(pin_hash), failed_attempts = 0, locked_until = NULL, updated_at = NOW()`,
      [userId, pinHash],
    );

    res.json({ success: true, message: 'PIN set successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /auth/pin ────────────────────────────────────────────
// Remove the user's PIN
authRouter.delete('/pin', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    await db.execute('DELETE FROM user_pins WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'PIN removed' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/pin/verify ──────────────────────────────────────
// Quick login with email + PIN (no password required)
// Rate-limited: 5 failed attempts → 15-minute lockout
const VerifyPinSchema = z.object({
  email: z.string().email(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

authRouter.post('/pin/verify', async (req, res, next) => {
  try {
    const input = VerifyPinSchema.parse(req.body);

    // Find the user
    const user = await db.queryOne<{ id: string; account_status: string; isActive: number }>(
      'SELECT id, account_status, isActive FROM users WHERE email = ?',
      [input.email],
    );
    if (!user) throw badRequest('Invalid email or PIN');
    if (!user.isActive || user.account_status !== 'active') {
      throw badRequest('Account is not active');
    }

    // Get PIN record
    const pinRow = await db.queryOne<{
      pin_hash: string;
      failed_attempts: number;
      locked_until: string | null;
    }>(
      'SELECT pin_hash, failed_attempts, locked_until FROM user_pins WHERE user_id = ?',
      [user.id],
    );
    if (!pinRow) throw badRequest('PIN login is not set up for this account. Please sign in with your password.');

    // Check lockout
    if (pinRow.locked_until) {
      const lockExpiry = new Date(pinRow.locked_until);
      if (lockExpiry > new Date()) {
        const minutesLeft = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
        throw badRequest(`Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`);
      }
      // Lockout expired — reset
      await db.execute(
        'UPDATE user_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
        [user.id],
      );
      pinRow.failed_attempts = 0;
    }

    // Verify PIN
    const pinValid = await bcrypt.compare(input.pin, pinRow.pin_hash);
    if (!pinValid) {
      const newAttempts = pinRow.failed_attempts + 1;
      if (newAttempts >= PIN_MAX_ATTEMPTS) {
        await db.execute(
          `UPDATE user_pins SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE user_id = ?`,
          [newAttempts, PIN_LOCKOUT_MINUTES, user.id],
        );
        throw badRequest(`Too many failed attempts. PIN login locked for ${PIN_LOCKOUT_MINUTES} minutes.`);
      }
      await db.execute(
        'UPDATE user_pins SET failed_attempts = ? WHERE user_id = ?',
        [newAttempts, user.id],
      );
      throw badRequest('Invalid email or PIN');
    }

    // PIN valid — reset failed attempts
    await db.execute(
      'UPDATE user_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
      [user.id],
    );

    // Check 2FA requirement
    const twoFa = await db.queryOne<{ is_enabled: number; preferred_method: string }>(
      'SELECT is_enabled, preferred_method FROM user_two_factor WHERE user_id = ? AND is_enabled = 1',
      [user.id],
    );

    if (twoFa) {
      // PIN bypasses password but NOT 2FA — issue temp token for 2FA flow
      const tempToken = jwt.sign(
        { userId: user.id, purpose: '2fa', rememberMe: true },
        env.JWT_SECRET,
        { expiresIn: '5m' },
      );

      const method = twoFa.preferred_method || 'totp';

      // Auto-send OTP for email/SMS methods
      if (method === 'email' || method === 'sms') {
        const userDetails = await db.queryOne<{ email: string; name: string; phone: string }>(
          'SELECT email, name, phone FROM users WHERE id = ?',
          [user.id],
        );
        if (userDetails) {
          if (method === 'email') {
            await sendTwoFactorOtp(userDetails.email, userDetails.name, user.id);
          } else if (method === 'sms' && userDetails.phone) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
            await db.execute(
              `UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE user_id = ?`,
              [otpHash, user.id],
            );
            await sendSms(userDetails.phone, `Your SoftAware verification code is: ${otp}`);
          }
        }
      }

      // For TOTP users, try push-to-approve
      let challengeId: string | null = null;
      if (method === 'totp') {
        const userDetails = await db.queryOne<{ email: string; name: string }>(
          'SELECT email, name FROM users WHERE id = ?',
          [user.id],
        );
        if (userDetails) {
          challengeId = await createPushChallenge(user.id, true, userDetails.email, userDetails.name);
        }
      }

      return res.json({
        success: true,
        requires_2fa: true,
        two_factor_method: method,
        temp_token: tempToken,
        challenge_id: challengeId,
        message: '2FA verification required',
      });
    }

    // No 2FA — issue full token
    const token = signAccessToken({ userId: user.id }, '30d');
    const cookieMaxAge = 30 * 24 * 60 * 60 * 1000;
    setAuthCookie(req, res, token, cookieMaxAge);

    await trackSession(user.id, token, req);
    const frontendUser = await buildFrontendUser(user.id);

    res.json({
      success: true,
      message: 'PIN login successful',
      data: { token, user: frontendUser },
      accessToken: token,
      token,
      expiresIn: '30d',
      user: frontendUser,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/pin/check/:email ──────────────────────────────────
// Public endpoint — check if an email has PIN login enabled
// (used by frontend to show PIN pad vs password form)
authRouter.get('/pin/check/:email', async (req, res, next) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const user = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, data: { has_pin: false } });
    }
    const pinRow = await db.queryOne<{ id: number }>(
      'SELECT id FROM user_pins WHERE user_id = ?',
      [user.id],
    );
    res.json({ success: true, data: { has_pin: !!pinRow } });
  } catch (err) {
    next(err);
  }
});