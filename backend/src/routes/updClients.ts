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
              TIMESTAMPDIFF(SECOND, c.last_heartbeat, NOW()) AS seconds_since_heartbeat
       FROM update_clients c
       LEFT JOIN update_software s ON c.software_id = s.id
       LEFT JOIN update_releases lu ON c.last_update_id = lu.id
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
