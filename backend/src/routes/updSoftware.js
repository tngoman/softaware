/**
 * Updates – Software CRUD Router
 *
 * GET  /updates/software          — Public: list all software (with latest version info)
 * GET  /updates/software?id=N     — Public: single software
 * POST /updates/software          — Admin: create software
 * PUT  /updates/software          — Admin: update software
 * DELETE /updates/software?id=N   — Admin: delete software (cascades)
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const updSoftwareRouter = Router();
// ─── GET ─ list / single ───────────────────────────────────────────
updSoftwareRouter.get('/', async (req, res, next) => {
    try {
        const id = req.query.id ? Number(req.query.id) : null;
        if (id) {
            const sw = await db.queryOne(`SELECT s.*,
                u.name AS created_by_name,
                latest.version AS latest_version,
                latest.created_at AS latest_update_date,
                (SELECT COUNT(*) FROM update_releases WHERE software_id = s.id) AS total_updates
         FROM update_software s
         LEFT JOIN users u ON s.created_by = u.id
         LEFT JOIN (
           SELECT software_id, version, created_at
           FROM update_releases
           WHERE id IN (SELECT MAX(id) FROM update_releases GROUP BY software_id)
         ) latest ON latest.software_id = s.id
         WHERE s.id = ?`, [id]);
            if (!sw)
                throw notFound('Software not found');
            return res.json({ success: true, software: sw });
        }
        const software = await db.query(`SELECT s.*,
              u.name AS created_by_name,
              latest.version AS latest_version,
              latest.created_at AS latest_update_date,
              (SELECT COUNT(*) FROM update_releases WHERE software_id = s.id) AS total_updates
       FROM update_software s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN (
         SELECT software_id, version, created_at
         FROM update_releases
         WHERE id IN (SELECT MAX(id) FROM update_releases GROUP BY software_id)
       ) latest ON latest.software_id = s.id
       ORDER BY s.name`);
        res.json({ success: true, software });
    }
    catch (err) {
        next(err);
    }
});
// ─── POST ─ create ─────────────────────────────────────────────────
updSoftwareRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const body = z.object({
            name: z.string().min(1),
            software_key: z.string().min(1),
            description: z.string().optional(),
            has_external_integration: z.union([z.boolean(), z.number()]).optional(),
            external_username: z.string().optional(),
            external_password: z.string().optional(),
            external_live_url: z.string().optional(),
            external_test_url: z.string().optional(),
            external_mode: z.enum(['test', 'live']).optional(),
            external_integration_notes: z.string().optional(),
        }).parse(req.body);
        // Check for duplicate key
        const existing = await db.queryOne('SELECT id FROM update_software WHERE software_key = ?', [body.software_key]);
        if (existing)
            throw badRequest('Software key already exists');
        const result = await db.insert(`INSERT INTO update_software (name, description, software_key, created_by,
        has_external_integration, external_username, external_password,
        external_live_url, external_test_url, external_mode, external_integration_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            body.name,
            body.description || null,
            body.software_key,
            userId,
            body.has_external_integration ? 1 : 0,
            body.external_username || null,
            body.external_password || null,
            body.external_live_url || null,
            body.external_test_url || null,
            body.external_mode || 'test',
            body.external_integration_notes || null,
        ]);
        res.json({ success: true, message: 'Software created successfully', id: Number(result) });
    }
    catch (err) {
        next(err);
    }
});
// ─── PUT ─ update ──────────────────────────────────────────────────
updSoftwareRouter.put('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        // Accept id from query string or body for flexibility
        const rawBody = { ...req.body };
        if (req.query.id && !rawBody.id) {
            rawBody.id = Number(req.query.id);
        }
        const body = z.object({
            id: z.number(),
            name: z.string().optional(),
            description: z.string().optional(),
            software_key: z.string().optional(),
            has_external_integration: z.union([z.boolean(), z.number()]).optional(),
            external_username: z.string().optional(),
            external_password: z.string().optional(),
            external_live_url: z.string().optional(),
            external_test_url: z.string().optional(),
            external_mode: z.enum(['test', 'live']).optional(),
            external_integration_notes: z.string().optional(),
        }).parse(req.body);
        const existing = await db.queryOne('SELECT id FROM update_software WHERE id = ?', [body.id]);
        if (!existing)
            throw notFound('Software not found');
        // Check unique key conflict
        if (body.software_key) {
            const conflict = await db.queryOne('SELECT id FROM update_software WHERE software_key = ? AND id != ?', [body.software_key, body.id]);
            if (conflict)
                throw badRequest('Software key already in use');
        }
        const fields = [];
        const params = [];
        const add = (col, val) => {
            if (val !== undefined) {
                fields.push(`${col} = ?`);
                params.push(val);
            }
        };
        add('name', body.name);
        add('description', body.description);
        add('software_key', body.software_key);
        add('has_external_integration', body.has_external_integration !== undefined ? (body.has_external_integration ? 1 : 0) : undefined);
        add('external_username', body.external_username);
        add('external_password', body.external_password);
        add('external_live_url', body.external_live_url);
        add('external_test_url', body.external_test_url);
        add('external_mode', body.external_mode);
        add('external_integration_notes', body.external_integration_notes);
        if (fields.length === 0)
            throw badRequest('No fields to update');
        params.push(body.id);
        await db.execute(`UPDATE update_software SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: 'Software updated successfully' });
    }
    catch (err) {
        next(err);
    }
});
// ─── DELETE ────────────────────────────────────────────────────────
updSoftwareRouter.delete('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = z.coerce.number().parse(req.query.id);
        const existing = await db.queryOne('SELECT id FROM update_software WHERE id = ?', [id]);
        if (!existing)
            throw notFound('Software not found');
        await db.execute('DELETE FROM update_software WHERE id = ?', [id]);
        res.json({ success: true, message: 'Software deleted successfully' });
    }
    catch (err) {
        next(err);
    }
});
