/**
 * Updates – Dashboard, Info, Status, Installed, Schema & Password Reset Router
 *
 * GET  /updates/info              — Public: API info
 * GET  /updates/dashboard         — Authenticated: summary stats
 * GET  /updates/api_status        — Public: system status
 * GET  /updates/installed         — Public: installed updates list
 * GET  /updates/schema?id=N       — Public: schema file for an update
 * POST /updates/password_reset    — Public: request OTP
 * POST /updates/verify_otp        — Public: verify OTP
 * POST /updates/reset_password    — Public: execute password reset
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const updMiscRouter = Router();

// ─── GET /info ─────────────────────────────────────────────────────
updMiscRouter.get('/info', (_req, res) => {
  res.json({
    name: 'Softaware Updates API',
    version: '2.0.0',
    description: 'Update management system — absorbed into the main backend API',
    endpoints: {
      authentication: { 'POST /auth/login': 'Login with email and password (JWT)' },
      software: {
        'GET /updates/software': 'List all software products',
        'POST /updates/software': 'Create software (admin)',
        'PUT /updates/software': 'Update software (admin)',
        'DELETE /updates/software?id=N': 'Delete software (admin)',
      },
      updates: {
        'GET /updates/updates': 'List all updates',
        'POST /updates/updates': 'Create update record (admin)',
        'PUT /updates/updates': 'Modify update (admin)',
        'DELETE /updates/updates?id=N': 'Delete update (admin)',
      },
      files: {
        'POST /updates/upload': 'Upload update package (API key)',
        'GET /updates/download?update_id=N': 'Download update file',
      },
      heartbeat: { 'POST /updates/heartbeat': 'Client heartbeat (software key)' },
      clients: { 'GET /updates/clients': 'List clients (admin)' },
      modules: {
        'GET /updates/modules': 'List modules',
        'GET /updates/modules/:id/developers': 'Module developers',
      },
    },
    authentication: 'Bearer token (JWT)',
    status: 'API is running',
  });
});

// ─── GET /dashboard ────────────────────────────────────────────────
updMiscRouter.get('/dashboard', requireAuth, async (_req, res, next) => {
  try {
    const [softwareCount] = await db.query<any>('SELECT COUNT(*) AS cnt FROM update_software');
    const [updateCount] = await db.query<any>('SELECT COUNT(*) AS cnt FROM update_releases');
    const [userCount] = await db.query<any>('SELECT COUNT(*) AS cnt FROM users');
    const [activeClients] = await db.query<any>(
      'SELECT COUNT(*) AS cnt FROM update_clients WHERE last_heartbeat > DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );

    const latestClients = await db.query<any>(
      `SELECT c.id, c.software_id, s.name AS software_name,
              c.hostname, c.machine_name, c.app_version, c.last_heartbeat
       FROM update_clients c
       LEFT JOIN update_software s ON c.software_id = s.id
       ORDER BY c.last_heartbeat DESC LIMIT 10`
    );

    const recentUpdates = await db.query<any>(
      `SELECT u.id, u.software_id, s.name AS software_name,
              u.version, u.created_at
       FROM update_releases u
       LEFT JOIN update_software s ON u.software_id = s.id
       ORDER BY u.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      summary: {
        software_count: softwareCount.cnt,
        update_count: updateCount.cnt,
        user_count: userCount.cnt,
        active_clients_24h: activeClients.cnt,
      },
      latest_clients: latestClients,
      recent_updates: recentUpdates,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api_status ───────────────────────────────────────────────
updMiscRouter.get('/api_status', async (_req, res, next) => {
  try {
    const dbOk = await db.ping();

    const [users] = await db.query<any>('SELECT COUNT(*) AS cnt FROM users');
    const counts: Record<string, number> = {};
    for (const tbl of ['update_clients', 'update_software', 'update_releases', 'update_modules', 'update_user_modules']) {
      const [row] = await db.query<any>(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
      counts[tbl.replace('update_', '')] = row.cnt;
    }

    res.json({
      timestamp: new Date().toISOString(),
      api_version: '2.0.0',
      status: dbOk ? 'operational' : 'degraded',
      database: {
        connected: dbOk,
        total_users: users.cnt,
        tables: counts,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /installed ────────────────────────────────────────────────
updMiscRouter.get('/installed', async (_req, res, next) => {
  try {
    const installed = await db.query<any>(
      `SELECT iu.update_id, iu.status, iu.installed_at,
              u.version, u.description, u.file_path
       FROM update_installed iu
       JOIN update_releases u ON iu.update_id = u.id
       ORDER BY iu.installed_at DESC`
    );
    res.json({ success: true, installed });
  } catch (err) {
    next(err);
  }
});

// ─── GET /schema ───────────────────────────────────────────────────
updMiscRouter.get('/schema', async (req, res, next) => {
  try {
    const id = z.coerce.number().parse(req.query.id);
    const update = await db.queryOne<any>('SELECT schema_file FROM update_releases WHERE id = ?', [id]);
    if (!update) throw notFound('Update not found');
    if (!update.schema_file) throw notFound('No schema file for this update');

    const filePath = path.resolve(process.cwd(), 'uploads', update.schema_file);
    if (!fs.existsSync(filePath)) throw notFound('Schema file not found on disk');

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, schema: content });
  } catch (err) {
    next(err);
  }
});

// ─── POST /password_reset ──────────────────────────────────────────
updMiscRouter.post('/password_reset', async (req, res, next) => {
  try {
    const body = z.object({ identifier: z.string().min(1) }).parse(req.body);

    // Clean up expired tokens
    await db.execute(
      'DELETE FROM update_password_resets WHERE expires_at < NOW()'
    );

    // Look up user by email or name
    const user = await db.queryOne<any>(
      'SELECT id, email, name FROM users WHERE email = ? OR name = ? LIMIT 1',
      [body.identifier, body.identifier]
    );

    // Always return success (don't reveal if user exists)
    const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit

    if (user) {
      // Store token
      await db.insert(
        'INSERT INTO update_password_resets (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
        [user.id, otp]
      );

      // Send email (fire-and-forget, don't block response)
      if (user.email && env.SMTP_HOST) {
        import('nodemailer').then(nodemailer => {
          const transporter = nodemailer.default.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
          });
          transporter.sendMail({
            from: env.SMTP_FROM,
            to: user.email,
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${otp}\n\nThis code expires in 15 minutes.`,
          }).catch(emailErr => {
            console.error('[password_reset] Email send failed:', emailErr);
          });
        }).catch(err => console.error('[password_reset] nodemailer import failed:', err));
      }
    }

    const response: any = {
      success: true,
      message: 'If the account exists, a reset code has been sent.',
    };

    // In dev, include OTP for testing
    if (env.NODE_ENV === 'development' && user) {
      response.dev_otp = otp;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// ─── POST /verify_otp ─────────────────────────────────────────────
updMiscRouter.post('/verify_otp', async (req, res, next) => {
  try {
    const body = z.object({
      identifier: z.string().min(1),
      otp: z.string().length(6),
    }).parse(req.body);

    const user = await db.queryOne<any>(
      'SELECT id, email, name FROM users WHERE email = ? OR name = ? LIMIT 1',
      [body.identifier, body.identifier]
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

    res.json({
      success: true,
      message: 'OTP verified successfully',
      user_id: user.id,
      username: user.name || user.email,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /reset_password ─────────────────────────────────────────
updMiscRouter.post('/reset_password', async (req, res, next) => {
  try {
    const body = z.object({
      identifier: z.string().min(1),
      otp: z.string().length(6),
      new_password: z.string().min(6),
    }).parse(req.body);

    const user = await db.queryOne<any>(
      'SELECT id FROM users WHERE email = ? OR name = ? LIMIT 1',
      [body.identifier, body.identifier]
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
    const hash = await bcrypt.hash(body.new_password, 10);
    await db.execute('UPDATE users SET passwordHash = ?, updatedAt = NOW() WHERE id = ?', [hash, user.id]);

    // Mark token as used and clean up all tokens for this user
    await db.execute('UPDATE update_password_resets SET used = 1 WHERE id = ?', [token.id]);
    await db.execute('DELETE FROM update_password_resets WHERE user_id = ? AND id != ?', [user.id, token.id]);

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    next(err);
  }
});
