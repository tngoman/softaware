/**
 * Email Routes — SMTP management & email sending
 *
 * POST /email/test          — Send a test email (admin)
 * POST /email/send          — Send an email (authenticated)
 * GET  /email/config        — Get current SMTP config (admin, password masked)
 * PUT  /email/config        — Update SMTP config in credentials table (admin)
 * GET  /email/logs          — Get email send log (admin)
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest } from '../utils/httpErrors.js';
import { sendTestEmail, sendEmail, invalidateTransporter } from '../services/emailService.js';

export const emailRouter = Router();

emailRouter.use(requireAuth);

// ─── POST /email/test — Send test email (admin) ───────────────────
const TestEmailSchema = z.object({
  to: z.string().email(),
});

emailRouter.post('/test', requireAdmin, async (req, res, next) => {
  try {
    const input = TestEmailSchema.parse(req.body);
    const result = await sendTestEmail(input.to);

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent to ${input.to}`,
        data: { messageId: result.messageId },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to send test email',
      });
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /email/send — Send an email (authenticated) ─────────────
const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  replyTo: z.string().email().optional(),
});

emailRouter.post('/send', async (req: AuthRequest, res, next) => {
  try {
    const input = SendEmailSchema.parse(req.body);
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        data: { messageId: result.messageId },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to send email',
      });
    }
  } catch (err) {
    next(err);
  }
});

// ─── GET /email/config — Get SMTP config (admin, password masked) ──
emailRouter.get('/config', requireAdmin, async (_req, res, next) => {
  try {
    const row = await db.queryOne<any>(
      `SELECT credential_value, additional_data, last_used_at, updated_at
         FROM credentials
        WHERE service_name = ? AND is_active = 1
        LIMIT 1`,
      ['SMTP'],
    );

    if (!row) {
      return res.json({
        success: true,
        data: null,
        message: 'No SMTP configuration found. Please configure SMTP settings.',
      });
    }

    const extra = typeof row.additional_data === 'string'
      ? JSON.parse(row.additional_data)
      : row.additional_data;

    res.json({
      success: true,
      data: {
        host: extra?.host || '',
        port: extra?.port || 587,
        username: extra?.username || '',
        password_set: !!row.credential_value,
        from_name: extra?.from_name || '',
        from_email: extra?.from_email || '',
        encryption: extra?.encryption || 'tls',
        last_used_at: row.last_used_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /email/config — Update SMTP config (admin) ────────────────
const UpdateConfigSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  username: z.string().min(1, 'SMTP username is required'),
  password: z.string().optional(), // Only required on first setup; omit to keep existing
  from_name: z.string().min(1, 'From name is required'),
  from_email: z.string().email('Valid from email is required'),
  encryption: z.enum(['tls', 'ssl', 'none']).default('tls'),
});

emailRouter.put('/config', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = UpdateConfigSchema.parse(req.body);

    // Check if row exists
    const existing = await db.queryOne<any>(
      `SELECT id, credential_value FROM credentials WHERE service_name = ? LIMIT 1`,
      ['SMTP'],
    );

    const additionalData = JSON.stringify({
      host: input.host,
      port: input.port,
      username: input.username,
      from_name: input.from_name,
      from_email: input.from_email,
      encryption: input.encryption,
    });

    if (existing) {
      // Update — only change password if provided
      if (input.password) {
        await db.execute(
          `UPDATE credentials 
           SET credential_value = ?, additional_data = ?, updated_by = ?, is_active = 1
           WHERE service_name = ?`,
          [input.password, additionalData, userId, 'SMTP'],
        );
      } else {
        await db.execute(
          `UPDATE credentials 
           SET additional_data = ?, updated_by = ?, is_active = 1
           WHERE service_name = ?`,
          [additionalData, userId, 'SMTP'],
        );
      }
    } else {
      // Insert new
      if (!input.password) {
        throw badRequest('SMTP password is required for initial setup');
      }

      await db.execute(
        `INSERT INTO credentials (service_name, credential_type, identifier, credential_value, additional_data, environment, is_active, created_by, notes)
         VALUES (?, 'password', ?, ?, ?, 'production', 1, ?, 'SMTP email service credentials')`,
        ['SMTP', input.username, input.password, additionalData, userId],
      );
    }

    // Invalidate cached transporter so next send uses new config
    invalidateTransporter();

    res.json({
      success: true,
      message: 'SMTP configuration updated successfully',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /email/logs — Recent email logs (admin) ───────────────────
emailRouter.get('/logs', requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const rows = await db.query<any>(
      `SELECT id, to_address, subject, status, message_id, error, created_at
         FROM email_log
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const countRow = await db.queryOne<any>('SELECT COUNT(*) as total FROM email_log');

    res.json({
      success: true,
      data: rows,
      pagination: { limit, offset, total: countRow?.total || 0 },
    });
  } catch (err) {
    next(err);
  }
});
