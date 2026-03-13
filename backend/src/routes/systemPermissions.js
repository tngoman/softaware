/**
 * /permissions — Permission management routes
 * Frontend expects: CRUD + assign/remove + /permissions/user with { success, data } envelope
 */
import { Router } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const permissionsRouter = Router();
/**
 * GET /permissions — List all permissions
 */
permissionsRouter.get('/', requireAuth, async (_req, res, next) => {
    try {
        const permissions = await db.query('SELECT * FROM permissions ORDER BY permission_group, name');
        res.json({ success: true, data: permissions });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /permissions/user — Get current user's permissions (resolved through roles)
 */
permissionsRouter.get('/user', requireAuth, async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        // Check if user is admin or staff
        const userRow = await db.queryOne('SELECT is_admin, is_staff FROM users WHERE id = ?', [userId]);
        if (userRow && (userRow.is_admin || userRow.is_staff)) {
            // Admin/staff gets wildcard
            res.json({ success: true, data: [{ id: 1, name: 'All Access', slug: '*' }] });
            return;
        }
        // Get permissions through user_roles → role_permissions
        const permissions = await db.query(`SELECT DISTINCT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?
       ORDER BY p.permission_group, p.name`, [userId]);
        res.json({ success: true, data: permissions });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /permissions/:id — Get single permission
 */
permissionsRouter.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const perm = await db.queryOne('SELECT * FROM permissions WHERE id = ?', [id]);
        if (!perm)
            throw notFound('Permission not found');
        res.json({ success: true, data: perm });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /permissions — Create permission
 */
permissionsRouter.post('/', requireAuth, async (req, res, next) => {
    try {
        const { name, slug, description, permission_group } = req.body;
        if (!name || !slug)
            throw badRequest('name and slug are required');
        const existing = await db.queryOne('SELECT id FROM permissions WHERE slug = ?', [slug]);
        if (existing)
            throw badRequest('Permission slug already exists');
        const id = await db.insertOne('permissions', {
            name,
            slug,
            description: description || null,
            permission_group: permission_group || null,
        });
        const perm = await db.queryOne('SELECT * FROM permissions WHERE id = ?', [id]);
        res.status(201).json({ success: true, data: perm });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /permissions/:id — Update permission
 */
permissionsRouter.put('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, slug, description, permission_group } = req.body;
        const perm = await db.queryOne('SELECT * FROM permissions WHERE id = ?', [id]);
        if (!perm)
            throw notFound('Permission not found');
        const updates = {};
        if (name)
            updates.name = name;
        if (slug)
            updates.slug = slug;
        if (description !== undefined)
            updates.description = description;
        if (permission_group !== undefined)
            updates.permission_group = permission_group;
        if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
            await db.execute(`UPDATE permissions SET ${setClauses} WHERE id = ?`, [...Object.values(updates), id]);
        }
        const updated = await db.queryOne('SELECT * FROM permissions WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /permissions/:id — Delete permission
 */
permissionsRouter.delete('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const perm = await db.queryOne('SELECT * FROM permissions WHERE id = ?', [id]);
        if (!perm)
            throw notFound('Permission not found');
        await db.execute('DELETE FROM role_permissions WHERE permission_id = ?', [id]);
        await db.execute('DELETE FROM permissions WHERE id = ?', [id]);
        res.json({ success: true, message: 'Permission deleted' });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /permissions/:id/assign — Assign permission to role
 */
permissionsRouter.post('/:id/assign', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role_id } = req.body;
        if (!role_id)
            throw badRequest('role_id is required');
        const perm = await db.queryOne('SELECT id FROM permissions WHERE id = ?', [id]);
        if (!perm)
            throw notFound('Permission not found');
        const existing = await db.queryOne('SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?', [role_id, id]);
        if (!existing) {
            await db.insertOne('role_permissions', { role_id, permission_id: id });
        }
        res.json({ success: true, message: 'Permission assigned to role' });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /permissions/:id/remove — Remove permission from role
 */
permissionsRouter.post('/:id/remove', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role_id } = req.body;
        if (!role_id)
            throw badRequest('role_id is required');
        await db.execute('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?', [role_id, id]);
        res.json({ success: true, message: 'Permission removed from role' });
    }
    catch (err) {
        next(err);
    }
});
