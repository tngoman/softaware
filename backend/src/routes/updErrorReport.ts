/**
 * Updates – Error Report Router
 *
 * POST /updates/error-report — Public (requires software_key):
 *   Receives error reports from client applications.
 *   Errors can come from backend (PHP, Node) or frontend (JS) sources.
 *   Validates software_key, checks client block status, stores errors,
 *   and updates per-client error summaries.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound, forbidden } from '../utils/httpErrors.js';

export const updErrorReportRouter = Router();

/* ═══════════════════════════════════════════════════════════════
   GET /updates/error-report — Admin: browse error reports
   GET /updates/error-report/summaries — Admin: per-client summaries
   ═══════════════════════════════════════════════════════════════ */

// ─── GET /summaries — per-client error summaries ──────────────
updErrorReportRouter.get('/summaries', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await db.query<any>(
      `SELECT s.*, sw.name AS software_name
       FROM client_error_summaries s
       LEFT JOIN update_software sw ON s.software_key = sw.software_key
       ORDER BY s.last_error_at DESC`
    );
    res.json({ success: true, summaries: rows });
  } catch (err) { next(err); }
});

// ─── GET / — list error reports with optional filters ─────────
updErrorReportRouter.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];

    if (req.query.software_key) {
      conditions.push('e.software_key = ?');
      params.push(String(req.query.software_key));
    }
    if (req.query.client_identifier) {
      conditions.push('e.client_identifier = ?');
      params.push(String(req.query.client_identifier));
    }
    if (req.query.level) {
      conditions.push('e.error_level = ?');
      params.push(String(req.query.level));
    }
    if (req.query.source) {
      conditions.push('e.source = ?');
      params.push(String(req.query.source));
    }
    if (req.query.hostname) {
      conditions.push('e.hostname LIKE ?');
      params.push(`%${String(req.query.hostname)}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const offset = Number(req.query.offset) || 0;

    const [rows, countRow] = await Promise.all([
      db.query<any>(
        `SELECT e.*, sw.name AS software_name
         FROM error_reports e
         LEFT JOIN update_software sw ON e.software_key = sw.software_key
         ${where}
         ORDER BY e.received_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      db.queryOne<any>(
        `SELECT COUNT(*) AS total FROM error_reports e ${where}`,
        params
      ),
    ]);

    res.json({
      success: true,
      errors: rows,
      total: countRow?.total || 0,
      limit,
      offset,
    });
  } catch (err) { next(err); }
});

const errorSchema = z.object({
  type: z.string().min(1),
  level: z.enum(['error', 'warning', 'notice']),
  label: z.string().min(1),
  message: z.string().min(1),
  file: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  trace: z.string().optional(),
  url: z.string().optional(),
  request: z.object({
    method: z.string().optional(),
    uri: z.string().optional(),
    route: z.string().optional(),
    ip: z.string().optional(),
    user_agent: z.string().optional(),
  }).optional(),
  timestamp: z.string().optional(),
});

const bodySchema = z.object({
  software_key: z.string().min(1),
  client_identifier: z.string().min(1),
  hostname: z.string().optional(),
  machine_name: z.string().optional(),
  os_info: z.string().optional(),
  app_version: z.string().optional(),
  source: z.enum(['backend', 'frontend']).default('backend'),
  errors: z.array(errorSchema).min(1),
  metadata: z.object({
    php_version: z.string().optional(),
    server_software: z.string().optional(),
    reported_at: z.string().optional(),
    portal_type: z.string().optional(),
    error_count: z.number().optional(),
    user_agent: z.string().optional(),
    extra: z.any().optional(),
  }).optional(),
});

updErrorReportRouter.post('/', async (req, res, next) => {
  try {
    // Also accept software_key from header
    if (!req.body.software_key && req.header('X-Software-Key')) {
      req.body.software_key = req.header('X-Software-Key');
    }

    const body = bodySchema.parse(req.body);

    // Verify software key
    const sw = await db.queryOne<any>(
      'SELECT id, name FROM update_software WHERE software_key = ?',
      [body.software_key]
    );
    if (!sw) throw notFound('Unknown software key');

    // Check if client is blocked
    const client = await db.queryOne<any>(
      'SELECT id, is_blocked, blocked_reason FROM update_clients WHERE software_id = ? AND client_identifier = ?',
      [sw.id, body.client_identifier]
    );
    if (client?.is_blocked) {
      return res.status(403).json({
        success: false,
        blocked: true,
        reason: client.blocked_reason || 'Client is blocked',
      });
    }

    // Store each error
    let received = 0;
    for (const error of body.errors) {
      await db.insert(
        `INSERT INTO error_reports (
          software_key, client_identifier, hostname, source,
          error_type, error_level, error_label, error_message,
          error_file, error_line, error_column, error_trace, error_url,
          request_method, request_uri, request_route, request_ip, request_user_agent,
          app_version, php_version, server_software, os_info,
          error_occurred_at, received_at, extra
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          body.software_key,
          body.client_identifier,
          body.hostname || null,
          body.source,
          error.type,
          error.level,
          error.label,
          error.message.substring(0, 65000),
          error.file || null,
          error.line || null,
          error.column || null,
          error.trace || null,
          error.url || null,
          error.request?.method || null,
          error.request?.uri || null,
          error.request?.route || null,
          error.request?.ip || null,
          error.request?.user_agent || null,
          body.app_version || null,
          body.metadata?.php_version || null,
          body.metadata?.server_software || null,
          body.os_info || null,
          error.timestamp || new Date().toISOString(),
          body.metadata?.extra ? JSON.stringify(body.metadata.extra) : null,
        ]
      );
      received++;
    }

    // Update client error summary
    const errorCount = body.errors.filter(e => e.level === 'error').length;
    const warningCount = body.errors.filter(e => e.level === 'warning').length;
    const noticeCount = body.errors.filter(e => e.level === 'notice').length;

    await db.execute(
      `INSERT INTO client_error_summaries
        (software_key, client_identifier, hostname, app_version,
         total_errors, total_warnings, total_notices,
         last_error_message, last_error_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         hostname = VALUES(hostname),
         app_version = VALUES(app_version),
         total_errors = total_errors + VALUES(total_errors),
         total_warnings = total_warnings + VALUES(total_warnings),
         total_notices = total_notices + VALUES(total_notices),
         last_error_message = VALUES(last_error_message),
         last_error_at = NOW()`,
      [
        body.software_key,
        body.client_identifier,
        body.hostname || null,
        body.app_version || null,
        errorCount,
        warningCount,
        noticeCount,
        body.errors[0]?.message || null,
      ]
    );

    res.json({
      success: true,
      received,
      message: 'Error report received',
    });
  } catch (err) {
    next(err);
  }
});
