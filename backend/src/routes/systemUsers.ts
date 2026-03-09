/**
 * /users — System user management routes
 * Frontend expects: CRUD with { success, data } envelope
 */
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const systemUsersRouter = Router();

/** Map a DB user row into the frontend shape */
function mapUser(u: any, roles?: any[]): any {
  const nameParts = (u.name || '').split(' ');
  const roleSlugs = (roles || []).map((r: any) => r.slug);
  return {
    id: u.id,
    username: u.email,
    email: u.email,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    name: u.name || null,
    phone: u.phone || null,
    avatar: u.avatarUrl || null,
    is_admin: roleSlugs.includes('admin') || roleSlugs.includes('super_admin'),
    is_staff: roleSlugs.some((s: string) => ['developer', 'client_manager', 'qa_specialist', 'deployer'].includes(s)),
    is_active: !!u.isActive,
    roles: roles || [],
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

/**
 * GET /users — List all users
 */
systemUsersRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const users = await db.query<any>(
      'SELECT id, email, name, phone, avatarUrl, isActive, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    );

    const result = [];
    for (const u of users) {
      const roles = await db.query<any>(
        `SELECT r.id, r.name, r.slug FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
        [u.id]
      );
      result.push(mapUser(u, roles));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/:id — Get single user
 */
systemUsersRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const u = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, isActive, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );
    if (!u) throw notFound('User not found');

    const roles = await db.query<any>(
      `SELECT r.id, r.name, r.slug FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      [u.id]
    );

    res.json({ success: true, data: mapUser(u, roles) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /users — Create a new user
 */
systemUsersRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { email, password, name, phone, is_admin, is_staff } = req.body;
    if (!email || !password) throw badRequest('email and password are required');

    const existing = await db.queryOne<any>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) throw badRequest('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const { generateId, toMySQLDate } = await import('../db/mysql.js');
    const userId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      'INSERT INTO users (id, email, name, phone, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, email, name || null, phone || null, passwordHash, now, now]
    );

    // Assign role via user_roles
    const roleSlug = is_admin ? 'admin' : is_staff ? 'developer' : 'viewer';
    const role = await db.queryOne<any>('SELECT id FROM roles WHERE slug = ?', [roleSlug]);
    if (role) {
      await db.execute(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, role.id]
      );
    }

    const u = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, isActive, createdAt, updatedAt FROM users WHERE id = ?',
      [userId]
    );

    const roles = await db.query<any>(
      `SELECT r.id, r.name, r.slug FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      [userId]
    );
    res.status(201).json({ success: true, data: mapUser(u, roles) });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /users/:id — Update user
 */
systemUsersRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { email, password, name, phone, is_admin, is_staff, is_active } = req.body;

    const u = await db.queryOne<any>('SELECT id FROM users WHERE id = ?', [id]);
    if (!u) throw notFound('User not found');

    const { toMySQLDate } = await import('../db/mysql.js');
    const now = toMySQLDate(new Date());

    const updates: string[] = [];
    const params: any[] = [];

    if (email) { updates.push('email = ?'); params.push(email); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (is_active !== undefined) { updates.push('isActive = ?'); params.push(is_active ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      updates.push('passwordHash = ?'); params.push(hash);
    }
    updates.push('updatedAt = ?'); params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (is_admin !== undefined || is_staff !== undefined) {
      const roleSlug = is_admin ? 'admin' : is_staff ? 'developer' : 'viewer';
      const role = await db.queryOne<any>('SELECT id FROM roles WHERE slug = ?', [roleSlug]);
      if (role) {
        // Upsert: delete old role, insert new
        await db.execute('DELETE FROM user_roles WHERE user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci', [id]);
        await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, role.id]);
      }
    }

    const updated = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, isActive, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );
    const roles = await db.query<any>(
      `SELECT r.id, r.name, r.slug FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      [id]
    );

    res.json({ success: true, data: mapUser(updated, roles) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /users/:id — Delete user
 */
systemUsersRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { userId } = getAuth(req);

    if (id === userId) throw badRequest('Cannot delete yourself');

    const u = await db.queryOne<any>('SELECT id FROM users WHERE id = ?', [id]);
    if (!u) throw notFound('User not found');

    // Remove all foreign-key references, then roles, then user
    const fkCleanup = [
      `DELETE FROM user_roles WHERE user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`,
      `DELETE FROM team_members WHERE userId = ?`,
      `DELETE FROM fcm_tokens WHERE user_id = ?`,
      `DELETE FROM api_keys WHERE userId = ?`,
      `DELETE FROM device_activations WHERE userId = ?`,
      `DELETE FROM activation_keys WHERE createdByUserId = ?`,
      `DELETE FROM agents_config WHERE createdByUserId = ?`,
      `DELETE FROM vault_credentials WHERE createdByUserId = ?`,
      `DELETE FROM user_two_factor WHERE user_id = ?`,
      `DELETE FROM group_members WHERE user_id = ?`,
      `DELETE FROM group_messages WHERE user_id = ?`,
      `DELETE FROM widget_clients WHERE user_id = ?`,
      `DELETE FROM generated_sites WHERE user_id = ?`,
      `DELETE FROM notifications WHERE user_id = ?`,
    ];
    for (const sql of fkCleanup) {
      try { await db.execute(sql, [id]); } catch { /* table may not exist — skip */ }
    }
    // Nullify ownership columns instead of deleting the rows
    try { await db.execute(`UPDATE teams SET createdByUserId = NULL WHERE createdByUserId = ?`, [id]); } catch { /* skip */ }
    try { await db.execute(`UPDATE \`groups\` SET created_by = NULL WHERE created_by = ?`, [id]); } catch { /* skip */ }

    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});
