/**
 * Updates – Client Admin Router
 *
 * GET    /updates/clients              — Admin: list all clients
 * GET    /updates/clients?id=N         — Admin: single client
 * GET    /updates/clients?software_id= — Admin: filter by software
 * PUT    /updates/clients              — Admin: actions (block/unblock/force_logout/send_message)
 * DELETE /updates/clients?id=N         — Admin: delete client
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/mysql.js';
import { computeClientStatus } from '../db/updatesTypes.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const updClientsRouter = Router();
updClientsRouter.use(requireAuth, requireAdmin);

// ─── GET ─ list / single / filter ──────────────────────────────────
updClientsRouter.get('/', async (req, res, next) => {
  try {
    const id = req.query.id ? Number(req.query.id) : null;
    const softwareId = req.query.software_id ? Number(req.query.software_id) : null;

    let where = '';
    const params: any[] = [];

    if (id) {
      where = 'WHERE c.id = ?';
      params.push(id);
    } else if (softwareId) {
      where = 'WHERE c.software_id = ?';
      params.push(softwareId);
    }

    const clients = await db.query<any>(
      `SELECT c.*,
              s.name AS software_name,
              lu.version AS last_update_version,
              TIMESTAMPDIFF(SECOND, c.last_heartbeat, NOW()) AS seconds_since_heartbeat,
              COALESCE(ce.active_errors, 0) AS error_count
       FROM update_clients c
       LEFT JOIN update_software s ON c.software_id = s.id
       LEFT JOIN update_releases lu ON c.last_update_id = lu.id
       LEFT JOIN (
         SELECT client_id, COUNT(*) AS active_errors
         FROM client_errors
         WHERE is_cleared = 0
         GROUP BY client_id
       ) ce ON ce.client_id = c.id
       ${where}
       ORDER BY c.last_heartbeat DESC`,
      params
    );

    // Decode metadata + compute status
    const enriched = clients.map((c: any) => {
      let metadata = c.metadata;
      if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata); } catch { /* keep as-is */ }
      }
      return {
        ...c,
        metadata,
        status: computeClientStatus(c.seconds_since_heartbeat ?? 999999),
      };
    });

    if (id && enriched.length === 0) throw notFound('Client not found');

    res.json({ success: true, clients: enriched });
  } catch (err) {
    next(err);
  }
});

// ─── PUT ─ client actions ──────────────────────────────────────────
updClientsRouter.put('/', async (req, res, next) => {
  try {
    const body = z.object({
      id: z.number(),
      action: z.enum(['block', 'unblock', 'force_logout', 'send_message']),
      reason: z.string().optional(),
      message: z.string().optional(),
    }).parse(req.body);

    const client = await db.queryOne<any>('SELECT id FROM update_clients WHERE id = ?', [body.id]);
    if (!client) throw notFound('Client not found');

    switch (body.action) {
      case 'block':
        await db.execute(
          'UPDATE update_clients SET is_blocked = 1, blocked_at = NOW(), blocked_reason = ? WHERE id = ?',
          [body.reason || null, body.id]
        );
        return res.json({ success: true, action: 'blocked' });

      case 'unblock':
        await db.execute(
          'UPDATE update_clients SET is_blocked = 0, blocked_at = NULL, blocked_reason = NULL WHERE id = ?',
          [body.id]
        );
        return res.json({ success: true, action: 'unblocked' });

      case 'force_logout':
        await db.execute('UPDATE update_clients SET force_logout = 1 WHERE id = ?', [body.id]);
        return res.json({ success: true, message: 'Force logout queued' });

      case 'send_message':
        if (!body.message) throw badRequest('Message required for send_message action');
        const msgId = crypto.randomUUID();
        await db.execute(
          'UPDATE update_clients SET server_message = ?, server_message_id = ? WHERE id = ?',
          [body.message, msgId, body.id]
        );
        return res.json({ success: true, message: 'Message queued' });
    }
  } catch (err) {
    next(err);
  }
});

// ─── DELETE ────────────────────────────────────────────────────────
updClientsRouter.delete('/', async (req, res, next) => {
  try {
    const id = z.coerce.number().parse(req.query.id);
    const affected = await db.execute('DELETE FROM update_clients WHERE id = ?', [id]);
    if (!affected) throw notFound('Client not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
// ─── GET /:id/errors ─ list active (non-cleared) errors for a client ─────
updClientsRouter.get('/:id/errors', async (req, res, next) => {
  try {
    const clientId = z.coerce.number().parse(req.params.id);
    const showAll = req.query.all === '1'; // include cleared if ?all=1

    const whereCleared = showAll ? '' : 'AND is_cleared = 0';
    const errors = await db.query<any>(
      `SELECT id, error_type, error_level, error_message, error_file, error_line,
              error_trace, occurrences, first_seen_at, last_seen_at, is_cleared, error_hash
       FROM client_errors
       WHERE client_id = ? ${whereCleared}
       ORDER BY last_seen_at DESC`,
      [clientId]
    );

    res.json({ success: true, errors });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id/errors ─ clear (or delete) client errors ───────────────
updClientsRouter.delete('/:id/errors', async (req, res, next) => {
  try {
    const clientId = z.coerce.number().parse(req.params.id);
    const errorId = req.query.error_id ? z.coerce.number().parse(req.query.error_id) : null;

    if (errorId) {
      // Clear a single error
      await db.execute(
        'UPDATE client_errors SET is_cleared = 1 WHERE id = ? AND client_id = ?',
        [errorId, clientId]
      );
    } else {
      // Clear all errors for this client
      await db.execute(
        'UPDATE client_errors SET is_cleared = 1 WHERE client_id = ? AND is_cleared = 0',
        [clientId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /health-summary ─ Aggregated health KPIs for monitoring dashboard ──
updClientsRouter.get('/health-summary', async (_req, res, next) => {
  try {
    // Single query: count clients by heartbeat freshness buckets
    const buckets = await db.query<{ bucket: string; cnt: number }>(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(SECOND, c.last_heartbeat, NOW()) < 300    THEN 'online'
          WHEN TIMESTAMPDIFF(SECOND, c.last_heartbeat, NOW()) < 86400  THEN 'recent'
          WHEN TIMESTAMPDIFF(SECOND, c.last_heartbeat, NOW()) < 604800 THEN 'inactive'
          ELSE 'offline'
        END AS bucket,
        COUNT(*) AS cnt
      FROM update_clients c
      WHERE c.is_blocked = 0
      GROUP BY bucket
    `);

    const statusCounts: Record<string, number> = { online: 0, recent: 0, inactive: 0, offline: 0 };
    let totalClients = 0;
    for (const b of buckets) {
      statusCounts[b.bucket] = b.cnt;
      totalClients += b.cnt;
    }

    // Count active (uncleared) errors
    const errorRow = await db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM client_errors WHERE is_cleared = 0'
    );

    // Count clients with outdated versions (not on the latest release per software)
    const outdatedRow = await db.queryOne<{ count: number }>(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM update_clients c
      JOIN (
        SELECT software_id, MAX(id) as latest_release_id
        FROM update_releases
        GROUP BY software_id
      ) lr ON lr.software_id = c.software_id
      WHERE c.last_update_id IS NULL OR c.last_update_id != lr.latest_release_id
    `);

    // Most recent heartbeat time
    const latestHb = await db.queryOne<{ latest: string | null }>(
      'SELECT MAX(last_heartbeat) as latest FROM update_clients WHERE is_blocked = 0'
    );

    res.json({
      success: true,
      data: {
        total_clients: totalClients,
        status_counts: statusCounts,
        active_errors: errorRow?.count || 0,
        outdated_clients: outdatedRow?.count || 0,
        latest_heartbeat: latestHb?.latest || null,
      },
    });
  } catch (err) {
    next(err);
  }
});