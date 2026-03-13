/**
 * App Settings Router — Key/Value settings store
 *
 * GET    /app-settings/branding — Public: logo, site name, title only
 * GET    /app-settings          — Authenticated: get all settings (optionally filter by category prefix)
 * GET    /app-settings/:key     — Authenticated: get single setting
 * PUT    /app-settings          — Admin: bulk update settings
 * PUT    /app-settings/:key     — Admin: update single setting
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const appSettingsRouter = Router();
// ─── GET /app-settings/branding — PUBLIC (no auth) ────────────────
// Returns only branding-safe fields: logo, icon, site name, title, description.
// Used by public pages (landing, login, register) to display the company logo.
// ────────────────────────────────────────────────────────────────────
const BRANDING_KEYS = [
    'site_name', 'site_title', 'site_description',
    'site_logo', 'site_icon',
];
appSettingsRouter.get('/branding', async (_req, res, next) => {
    try {
        const placeholders = BRANDING_KEYS.map(() => '?').join(',');
        const rows = await db.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (${placeholders})`, BRANDING_KEYS);
        const branding = {};
        for (const row of rows) {
            branding[row.setting_key] = row.setting_value ?? '';
        }
        res.json(branding);
    }
    catch (err) {
        next(err);
    }
});
// All remaining routes require authentication
appSettingsRouter.use(requireAuth);
// ─── GET /app-settings ────────────────────────────────────────────
// Returns all settings as a flat key-value object.
// Optional query: ?category=smtp_ to filter by prefix.
// ────────────────────────────────────────────────────────────────────
appSettingsRouter.get('/', async (req, res, next) => {
    try {
        const category = req.query.category;
        let rows;
        if (category) {
            rows = await db.query('SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE ?', [`${category}%`]);
        }
        else {
            rows = await db.query('SELECT setting_key, setting_value FROM app_settings');
        }
        // Return as flat key→value object
        const settings = {};
        for (const row of rows) {
            settings[row.setting_key] = row.setting_value ?? '';
        }
        res.json(settings);
    }
    catch (err) {
        next(err);
    }
});
// ─── GET /app-settings/:key ───────────────────────────────────────
appSettingsRouter.get('/:key', async (req, res, next) => {
    try {
        const row = await db.queryOne('SELECT setting_key, setting_value, data_type, description FROM app_settings WHERE setting_key = ?', [req.params.key]);
        if (!row)
            throw notFound(`Setting "${req.params.key}" not found`);
        res.json({ key: row.setting_key, value: row.setting_value, type: row.data_type, description: row.description });
    }
    catch (err) {
        next(err);
    }
});
// ─── PUT /app-settings — Bulk update (admin) ──────────────────────
appSettingsRouter.put('/', requireAdmin, async (req, res, next) => {
    try {
        const settings = req.body;
        if (!settings || typeof settings !== 'object')
            throw badRequest('Expected object body');
        for (const [key, value] of Object.entries(settings)) {
            await db.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [key, String(value)]);
        }
        res.json({ success: true, message: 'Settings updated' });
    }
    catch (err) {
        next(err);
    }
});
// ─── PUT /app-settings/:key — Single update (admin) ───────────────
appSettingsRouter.put('/:key', requireAdmin, async (req, res, next) => {
    try {
        const { value, type } = z.object({
            value: z.string(),
            type: z.string().optional(),
        }).parse(req.body);
        await db.execute(`INSERT INTO app_settings (setting_key, setting_value, data_type) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), data_type = COALESCE(VALUES(data_type), data_type)`, [req.params.key, value, type ?? null]);
        res.json({ success: true, message: `Setting "${req.params.key}" updated` });
    }
    catch (err) {
        next(err);
    }
});
