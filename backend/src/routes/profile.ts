/**
 * Profile Router — Mobile App User Self-Service
 * 
 * Endpoints for users (staff & clients) to manage their own account
 * from the mobile app. All routes require JWT authentication.
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { db, toMySQLDate, type User, type team_members, type Team } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

// ─── GET /profile ──────────────────────────────────────────────────
// Returns the authenticated user's full profile, team info and role.
// ────────────────────────────────────────────────────────────────────
profileRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    const user = await db.queryOne<User>(
      `SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt,
              notifications_enabled, push_notifications_enabled, web_notifications_enabled
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!user) throw notFound('User not found');

    // Get team membership info
    const membership = await db.queryOne<team_members & { teamName: string }>(
      `SELECT tm.*, t.name AS teamName 
       FROM team_members tm 
       JOIN teams t ON tm.teamId = t.id 
       WHERE tm.userId = ? LIMIT 1`,
      [userId]
    );

    // Get subscription summary
    let subscription = null;
    if (membership) {
      subscription = await db.queryOne<any>(
        `SELECT s.id, s.status, s.trialEndsAt, s.currentPeriodEnd,
                sp.tier, sp.name AS planName
         FROM subscriptions s
         JOIN subscription_plans sp ON s.planId = sp.id
         WHERE s.teamId = ? AND s.status IN ('TRIAL', 'ACTIVE')
         ORDER BY s.createdAt DESC LIMIT 1`,
        [membership.teamId]
      );
    }

    // Credits system removed — pricing is now static via config/tiers.ts

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: (user as any).name || null,
        phone: (user as any).phone || null,
        avatarUrl: (user as any).avatarUrl || null,
        notifications_enabled: (user as any).notifications_enabled ?? true,
        push_notifications_enabled: (user as any).push_notifications_enabled ?? true,
        web_notifications_enabled: (user as any).web_notifications_enabled ?? true,
        createdAt: user.createdAt,
      },
      team: membership
        ? {
            id: membership.teamId,
            name: membership.teamName,
            role: membership.role,
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            tier: subscription.tier,
            planName: subscription.planName,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      credits: null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /profile ──────────────────────────────────────────────────
// Update the authenticated user's name, phone, avatar URL, or notification preferences.
// ────────────────────────────────────────────────────────────────────
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  avatarUrl: z.string().url().max(512).optional(),
  notifications_enabled: z.boolean().optional(),
  push_notifications_enabled: z.boolean().optional(),
  web_notifications_enabled: z.boolean().optional(),
});

profileRouter.put('/', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = UpdateProfileSchema.parse(req.body);

    if (Object.keys(input).length === 0) {
      throw badRequest('No fields to update');
    }

    const sets: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.email !== undefined) {
      // Check for duplicate email
      const dup = await db.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [input.email, userId],
      );
      if (dup) throw badRequest('Email address is already in use.');
      sets.push('email = ?');
      params.push(input.email);
    }
    if (input.phone !== undefined) {
      sets.push('phone = ?');
      params.push(input.phone);
    }
    if (input.avatarUrl !== undefined) {
      sets.push('avatarUrl = ?');
      params.push(input.avatarUrl);
    }
    if (input.notifications_enabled !== undefined) {
      sets.push('notifications_enabled = ?');
      params.push(input.notifications_enabled);
    }
    if (input.push_notifications_enabled !== undefined) {
      sets.push('push_notifications_enabled = ?');
      params.push(input.push_notifications_enabled);
    }
    if (input.web_notifications_enabled !== undefined) {
      sets.push('web_notifications_enabled = ?');
      params.push(input.web_notifications_enabled);
    }

    sets.push('updatedAt = ?');
    params.push(toMySQLDate(new Date()));
    params.push(userId);

    await db.execute(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await db.queryOne<User>(
      `SELECT id, email, name, phone, avatarUrl, 
              notifications_enabled, push_notifications_enabled, web_notifications_enabled, 
              updatedAt 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile updated',
      user: {
        id: updated!.id,
        email: updated!.email,
        name: (updated as any).name,
        phone: (updated as any).phone,
        avatarUrl: (updated as any).avatarUrl,
        notifications_enabled: (updated as any).notifications_enabled,
        push_notifications_enabled: (updated as any).push_notifications_enabled,
        web_notifications_enabled: (updated as any).web_notifications_enabled,
        updatedAt: updated!.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /profile/change-password ────────────────────────────────
// Change password — requires current password for verification.
// ────────────────────────────────────────────────────────────────────
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

profileRouter.post('/change-password', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = ChangePasswordSchema.parse(req.body);

    const user = await db.queryOne<User>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) throw notFound('User not found');

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) throw badRequest('Current password is incorrect');

    const newHash = await bcrypt.hash(input.newPassword, 12);
    const now = toMySQLDate(new Date());

    await db.execute(
      'UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?',
      [newHash, now, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /profile/team ─────────────────────────────────────────────
// Get full team details including all members (for team admins).
// ────────────────────────────────────────────────────────────────────
profileRouter.get('/team', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    const membership = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
      [userId]
    );
    if (!membership) throw notFound('No team found');

    const team = await db.queryOne<Team>(
      'SELECT * FROM teams WHERE id = ?',
      [membership.teamId]
    );

    const members = await db.query<team_members & { userEmail: string; userName: string }>(
      `SELECT tm.*, u.email AS userEmail, u.name AS userName
       FROM team_members tm
       JOIN users u ON tm.userId = u.id
       WHERE tm.teamId = ?
       ORDER BY tm.createdAt`,
      [membership.teamId]
    );

    res.json({
      team: {
        id: team!.id,
        name: team!.name,
        createdAt: team!.createdAt,
      },
      members: members.map((m) => ({
        userId: m.userId,
        email: m.userEmail,
        name: m.userName || null,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      myRole: membership.role,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /profile/api-keys ──────────────────────────────────────────
// List the authenticated user's API keys (masked).
// ────────────────────────────────────────────────────────────────────
profileRouter.get('/api-keys', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    const keys = await db.query<any>(
      `SELECT id, name, \`key\`, isActive, lastUsedAt, createdAt, expiresAt
       FROM api_keys WHERE userId = ? ORDER BY createdAt DESC`,
      [userId]
    );

    res.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPreview: `****${k.key.slice(-8)}`,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
        expiresAt: k.expiresAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /profile/invoices ──────────────────────────────────────────
// List the team's recent invoices (for billing screen in mobile app).
// ────────────────────────────────────────────────────────────────────
profileRouter.get('/invoices', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);

    const membership = await db.queryOne<team_members>(
      'SELECT teamId FROM team_members WHERE userId = ? LIMIT 1',
      [userId]
    );
    if (!membership) throw notFound('No team found');

    const subscription = await db.queryOne<any>(
      `SELECT id FROM subscriptions WHERE teamId = ? ORDER BY createdAt DESC LIMIT 1`,
      [membership.teamId]
    );

    if (!subscription) {
      return res.json({ invoices: [] });
    }

    const invoices = await db.query<any>(
      `SELECT id, invoiceNumber, description, subtotal, vatAmount, total,
              periodStart, periodEnd, dueDate, paidAt, pdfUrl, createdAt
       FROM billing_invoices WHERE subscriptionId = ?
       ORDER BY createdAt DESC LIMIT 50`,
      [subscription.id]
    );

    res.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description,
        subtotal: inv.subtotal,
        subtotalDisplay: `R${(inv.subtotal / 100).toFixed(2)}`,
        vatAmount: inv.vatAmount,
        vatDisplay: `R${(inv.vatAmount / 100).toFixed(2)}`,
        total: inv.total,
        totalDisplay: `R${(inv.total / 100).toFixed(2)}`,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        status: inv.paidAt ? 'PAID' : new Date() > new Date(inv.dueDate) ? 'OVERDUE' : 'PENDING',
        pdfUrl: inv.pdfUrl,
      })),
    });
  } catch (err) {
    next(err);
  }
});
