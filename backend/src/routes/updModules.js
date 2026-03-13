/**
 * Updates – Modules CRUD & Developer Assignments Router
 *
 * GET    /updates/modules                          — Authenticated: list all
 * GET    /updates/modules?id=N                     — Authenticated: single
 * GET    /updates/modules?software_id=N            — Authenticated: filter by software
 * POST   /updates/modules                          — Admin: create module
 * PUT    /updates/modules?id=N                     — Admin: update module
 * DELETE /updates/modules?id=N                     — Admin: delete module
 *
 * GET    /updates/modules/:moduleId/developers     — Authenticated: list devs
 * POST   /updates/modules/:moduleId/developers     — Admin: assign dev
 * DELETE /updates/modules/:moduleId/developers?user_id= — Admin: remove dev
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const updModulesRouter = Router();
// ═══ Module CRUD ═══════════════════════════════════════════════════
// ─── GET ─ list / single / filter ──────────────────────────────────
updModulesRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const id = req.query.id ? Number(req.query.id) : null;
        const softwareId = req.query.software_id ? Number(req.query.software_id) : null;
        let where = '';
        const params = [];
        if (id) {
            where = 'WHERE m.id = ?';
            params.push(id);
        }
        else if (softwareId) {
            where = 'WHERE m.software_id = ?';
            params.push(softwareId);
        }
        const modules = await db.query(`SELECT m.*, s.name AS software_name,
              (SELECT COUNT(*) FROM update_user_modules um WHERE um.module_id = m.id) AS developer_count
       FROM update_modules m
       LEFT JOIN update_software s ON m.software_id = s.id
       ${where}
       ORDER BY m.name`, params);
        if (id && modules.length === 0)
            throw notFound('Module not found');
        res.json({ success: true, modules });
    }
    catch (err) {
        next(err);
    }
});
// ─── POST ─ create ─────────────────────────────────────────────────
updModulesRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const body = z.object({
            software_id: z.number(),
            name: z.string().min(1),
            description: z.string().optional(),
        }).parse(req.body);
        // Check for duplicate name per software
        const dup = await db.queryOne('SELECT id FROM update_modules WHERE software_id = ? AND name = ?', [body.software_id, body.name]);
        if (dup) {
            return res.status(409).json({ success: false, error: 'Module name already exists for this software' });
        }
        const result = await db.insert('INSERT INTO update_modules (software_id, name, description) VALUES (?, ?, ?)', [body.software_id, body.name, body.description || null]);
        const mod = await db.queryOne('SELECT * FROM update_modules WHERE id = ?', [Number(result)]);
        res.json({ success: true, message: 'Module created successfully', module: mod });
    }
    catch (err) {
        next(err);
    }
});
// ─── PUT ─ update ──────────────────────────────────────────────────
updModulesRouter.put('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = z.coerce.number().parse(req.query.id);
        const body = z.object({
            name: z.string().optional(),
            description: z.string().optional(),
        }).parse(req.body);
        const existing = await db.queryOne('SELECT * FROM update_modules WHERE id = ?', [id]);
        if (!existing)
            throw notFound('Module not found');
        // Check duplicate name if renaming
        if (body.name && body.name !== existing.name) {
            const dup = await db.queryOne('SELECT id FROM update_modules WHERE software_id = ? AND name = ? AND id != ?', [existing.software_id, body.name, id]);
            if (dup) {
                return res.status(409).json({ success: false, error: 'Module name already exists for this software' });
            }
        }
        const fields = [];
        const params = [];
        if (body.name !== undefined) {
            fields.push('name = ?');
            params.push(body.name);
        }
        if (body.description !== undefined) {
            fields.push('description = ?');
            params.push(body.description);
        }
        if (fields.length === 0)
            throw badRequest('No fields to update');
        params.push(id);
        await db.execute(`UPDATE update_modules SET ${fields.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: 'Module updated successfully' });
    }
    catch (err) {
        next(err);
    }
});
// ─── DELETE ────────────────────────────────────────────────────────
updModulesRouter.delete('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = z.coerce.number().parse(req.query.id);
        const affected = await db.execute('DELETE FROM update_modules WHERE id = ?', [id]);
        if (!affected)
            throw notFound('Module not found');
        res.json({ success: true, message: 'Module deleted successfully' });
    }
    catch (err) {
        next(err);
    }
});
// ═══ Module Developers ═════════════════════════════════════════════
// ─── GET ─ list developers for module ──────────────────────────────
updModulesRouter.get('/:moduleId/developers', requireAuth, async (req, res, next) => {
    try {
        const moduleId = z.coerce.number().parse(req.params.moduleId);
        const mod = await db.queryOne('SELECT id FROM update_modules WHERE id = ?', [moduleId]);
        if (!mod)
            throw notFound('Module not found');
        const developers = await db.query(`SELECT um.id AS assignment_id, um.user_id, um.module_id,
              um.created_at AS assigned_at,
              u.name AS username, u.email
       FROM update_user_modules um
       JOIN users u ON um.user_id = u.id
       WHERE um.module_id = ?
       ORDER BY um.created_at`, [moduleId]);
        res.json({ success: true, developers });
    }
    catch (err) {
        next(err);
    }
});
// ─── POST ─ assign developer ───────────────────────────────────────
updModulesRouter.post('/:moduleId/developers', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const moduleId = z.coerce.number().parse(req.params.moduleId);
        const body = z.object({ user_id: z.string().min(1) }).parse(req.body);
        const mod = await db.queryOne('SELECT id FROM update_modules WHERE id = ?', [moduleId]);
        if (!mod)
            throw notFound('Module not found');
        const user = await db.queryOne('SELECT id FROM users WHERE id = ?', [body.user_id]);
        if (!user)
            throw notFound('User not found');
        // Check for duplicate assignment
        const dup = await db.queryOne('SELECT id FROM update_user_modules WHERE user_id = ? AND module_id = ?', [body.user_id, moduleId]);
        if (dup) {
            return res.status(409).json({ success: false, error: 'Developer already assigned to this module' });
        }
        const result = await db.insert('INSERT INTO update_user_modules (user_id, module_id) VALUES (?, ?)', [body.user_id, moduleId]);
        const assignment = await db.queryOne(`SELECT um.id AS assignment_id, um.user_id, um.module_id,
              um.created_at AS assigned_at, u.name AS username, u.email
       FROM update_user_modules um
       JOIN users u ON um.user_id = u.id
       WHERE um.id = ?`, [Number(result)]);
        res.status(201).json({ success: true, assignment });
    }
    catch (err) {
        next(err);
    }
});
// ─── DELETE ─ remove developer ─────────────────────────────────────
updModulesRouter.delete('/:moduleId/developers', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const moduleId = z.coerce.number().parse(req.params.moduleId);
        const userId = z.string().min(1).parse(req.query.user_id);
        const affected = await db.execute('DELETE FROM update_user_modules WHERE user_id = ? AND module_id = ?', [userId, moduleId]);
        if (!affected)
            throw notFound('Assignment not found');
        res.json({ success: true, message: 'Developer removed from module' });
    }
    catch (err) {
        next(err);
    }
});
