/**
 * System Settings Routes (sys_settings table)
 *
 * Full CRUD for the sys_settings table used by the SystemSettings admin page.
 * Each setting has: id, key, value, type, description, is_public, created_at, updated_at
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
export const settingsRouter = Router();
// ─── Validation ────────────────────────────────────────────────────────
const CreateSettingSchema = z.object({
    key: z.string().min(1).max(100),
    value: z.string(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'json']).default('string'),
    description: z.string().max(255).optional(),
    is_public: z.boolean().default(false),
});
const UpdateSettingSchema = z.object({
    key: z.string().min(1).max(100).optional(),
    value: z.string().optional(),
    type: z.enum(['string', 'integer', 'float', 'boolean', 'json']).optional(),
    description: z.string().max(255).optional(),
    is_public: z.boolean().optional(),
});
// ─── Helper ────────────────────────────────────────────────────────────
function formatRow(row) {
    return {
        ...row,
        is_public: !!row.is_public,
    };
}
// ═══════════════════════════════════════════════════════════════════════
// GET /settings/public - Public settings as key-value pairs (no auth)
// Must be registered BEFORE the /:id param route
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.get('/public', async (_req, res, next) => {
    try {
        const rows = await db.query('SELECT `key`, `value`, `type` FROM sys_settings WHERE is_public = 1 ORDER BY `key`');
        const kv = {};
        for (const r of rows) {
            kv[r.key] = castValue(r.value, r.type);
        }
        res.json({ success: true, data: kv });
    }
    catch (err) {
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// GET /settings/key/:key - Get setting by key
// Must be registered BEFORE the /:id param route
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.get('/key/:key', requireAuth, async (req, res, next) => {
    try {
        const row = await db.queryOne('SELECT * FROM sys_settings WHERE `key` = ?', [req.params.key]);
        if (!row) {
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }
        res.json({ success: true, data: formatRow(row) });
    }
    catch (err) {
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// GET /settings - List all settings
// ?public_only=1 → only public settings
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const publicOnly = req.query.public_only === '1';
        let query = 'SELECT * FROM sys_settings';
        const params = [];
        if (publicOnly) {
            query += ' WHERE is_public = 1';
        }
        query += ' ORDER BY `key` ASC';
        const rows = await db.query(query, params);
        res.json({ success: true, data: rows.map(formatRow) });
    }
    catch (err) {
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// GET /settings/:id - Get setting by ID
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const row = await db.queryOne('SELECT * FROM sys_settings WHERE id = ?', [req.params.id]);
        if (!row) {
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }
        res.json({ success: true, data: formatRow(row) });
    }
    catch (err) {
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// POST /settings - Create a new setting (admin only)
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const data = CreateSettingSchema.parse(req.body);
        // Check for duplicate key
        const existing = await db.queryOne('SELECT id FROM sys_settings WHERE `key` = ?', [data.key]);
        if (existing) {
            return res.status(409).json({ success: false, error: `Setting with key "${data.key}" already exists` });
        }
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await db.execute('INSERT INTO sys_settings (`key`, `value`, `type`, `description`, `is_public`, `created_at`) VALUES (?, ?, ?, ?, ?, ?)', [data.key, data.value, data.type, data.description || null, data.is_public ? 1 : 0, now]);
        const created = await db.queryOne('SELECT * FROM sys_settings WHERE `key` = ?', [data.key]);
        res.status(201).json({ success: true, data: formatRow(created) });
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// PUT /settings/:id - Update a setting (admin only)
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const data = UpdateSettingSchema.parse(req.body);
        const id = req.params.id;
        const existing = await db.queryOne('SELECT * FROM sys_settings WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }
        // If key is being changed, check for duplicates
        if (data.key && data.key !== existing.key) {
            const dup = await db.queryOne('SELECT id FROM sys_settings WHERE `key` = ? AND id != ?', [data.key, id]);
            if (dup) {
                return res.status(409).json({ success: false, error: `Setting with key "${data.key}" already exists` });
            }
        }
        const fields = [];
        const values = [];
        if (data.key !== undefined) {
            fields.push('`key` = ?');
            values.push(data.key);
        }
        if (data.value !== undefined) {
            fields.push('`value` = ?');
            values.push(data.value);
        }
        if (data.type !== undefined) {
            fields.push('`type` = ?');
            values.push(data.type);
        }
        if (data.description !== undefined) {
            fields.push('`description` = ?');
            values.push(data.description);
        }
        if (data.is_public !== undefined) {
            fields.push('`is_public` = ?');
            values.push(data.is_public ? 1 : 0);
        }
        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }
        values.push(id);
        await db.execute(`UPDATE sys_settings SET ${fields.join(', ')} WHERE id = ?`, values);
        const updated = await db.queryOne('SELECT * FROM sys_settings WHERE id = ?', [id]);
        res.json({ success: true, data: formatRow(updated) });
    }
    catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
        }
        next(err);
    }
});
// ═══════════════════════════════════════════════════════════════════════
// DELETE /settings/:id - Delete a setting (admin only)
// ═══════════════════════════════════════════════════════════════════════
settingsRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = req.params.id;
        const existing = await db.queryOne('SELECT * FROM sys_settings WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }
        await db.execute('DELETE FROM sys_settings WHERE id = ?', [id]);
        res.json({ success: true, message: `Setting "${existing.key}" deleted` });
    }
    catch (err) {
        next(err);
    }
});
// ─── Helpers ───────────────────────────────────────────────────────────
function castValue(value, type) {
    switch (type) {
        case 'integer': return parseInt(value, 10);
        case 'float': return parseFloat(value);
        case 'boolean': return value === '1' || value === 'true';
        case 'json':
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        default: return value;
    }
}
