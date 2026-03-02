/**
 * /roles — Role management routes
 * Frontend expects: CRUD + assign/remove with { success, data } envelope
 */
import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const rolesRouter = Router();

/**
 * GET /roles — List all roles with permission counts
 */
rolesRouter.get('/', requireAuth, async (_req: AuthRequest, res: Response, next) => {
  try {
    const roles = await db.query<any>(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
       FROM roles r ORDER BY r.name`
    );
    res.json({ success: true, data: roles });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /roles/:id — Get single role with its permissions
 */
rolesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const role = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) throw notFound('Role not found');

    const permissions = await db.query<any>(
      `SELECT p.* FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?
       ORDER BY p.permission_group, p.name`,
      [id]
    );

    res.json({ success: true, data: { ...role, permissions } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roles — Create role
 */
rolesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, slug, description } = req.body;
    if (!name) throw badRequest('name is required');

    const roleSlug = slug || name.toLowerCase().replace(/\s+/g, '-');
    const existing = await db.queryOne<any>('SELECT id FROM roles WHERE slug = ?', [roleSlug]);
    if (existing) throw badRequest('Role slug already exists');

    const id = await db.insertOne('roles', {
      name,
      slug: roleSlug,
      description: description || null,
    });

    const role = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /roles/:id — Update role
 */
rolesRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { name, slug, description } = req.body;

    const role = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) throw notFound('Role not found');

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (slug) updates.slug = slug;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await db.execute(`UPDATE roles SET ${setClauses} WHERE id = ?`, [...Object.values(updates), id]);
    }

    const updated = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /roles/:id — Delete role
 */
rolesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const role = await db.queryOne<any>('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) throw notFound('Role not found');

    await db.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    await db.execute('DELETE FROM user_roles WHERE role_id = ?', [id]);
    await db.execute('DELETE FROM roles WHERE id = ?', [id]);

    res.json({ success: true, message: 'Role deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roles/:id/assign — Assign role to user
 */
rolesRouter.post('/:id/assign', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) throw badRequest('user_id is required');

    const role = await db.queryOne<any>('SELECT id FROM roles WHERE id = ?', [id]);
    if (!role) throw notFound('Role not found');

    const existing = await db.queryOne<any>(
      'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
      [user_id, id]
    );
    if (!existing) {
      await db.insertOne('user_roles', { user_id, role_id: id });
    }

    res.json({ success: true, message: 'Role assigned' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /roles/:id/remove — Remove role from user
 */
rolesRouter.post('/:id/remove', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) throw badRequest('user_id is required');

    await db.execute('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [user_id, id]);

    res.json({ success: true, message: 'Role removed' });
  } catch (err) {
    next(err);
  }
});
