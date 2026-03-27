/**
 * /users — System user management routes
 * Frontend expects: CRUD with { success, data } envelope
 */
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const systemUsersRouter = Router();

/** Map a DB user row into the frontend shape */
function mapUser(u: any, roles?: any[]): any {
  const nameParts = (u.name || '').split(' ');
  return {
    id: u.id,
    username: u.email,
    email: u.email,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    name: u.name || null,
    phone: u.phone || null,
    avatar: u.avatarUrl || null,
    contact_id: u.contact_id || null,
    is_admin: !!u.is_admin,
    is_staff: !!u.is_staff,
    is_active: !!u.isActive,
    ai_developer_tools_granted: !!u.ai_developer_tools_granted,
    roles: roles || [],
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

/**
 * GET /users — List all users (any authenticated user — needed for task assignment etc.)
 */
systemUsersRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const users = await db.query<any>(
      'SELECT id, email, name, phone, avatarUrl, contact_id, is_admin, is_staff, ai_developer_tools_granted, isActive, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    );

    // Fetch all user-role mappings in a single query (eliminates N+1)
    const allRoles = await db.query<any>(
      `SELECT ur.user_id, r.id, r.name, r.slug
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id`
    );
    const rolesByUser = new Map<string, any[]>();
    for (const r of allRoles) {
      const key = r.user_id;
      if (!rolesByUser.has(key)) rolesByUser.set(key, []);
      rolesByUser.get(key)!.push({ id: r.id, name: r.name, slug: r.slug });
    }

    const result = users.map((u: any) => mapUser(u, rolesByUser.get(u.id) || []));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/:id — Get single user (admin only)
 */
systemUsersRouter.get('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const u = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, contact_id, is_admin, is_staff, ai_developer_tools_granted, isActive, createdAt, updatedAt FROM users WHERE id = ?',
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
 * POST /users — Create a new user (admin only)
 */
systemUsersRouter.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const { email, password, name, phone, is_admin, is_staff, contact_id } = req.body;
    if (!email || !password) throw badRequest('email and password are required');
    if (!contact_id) throw badRequest('A contact must be selected when creating a user');

    const existing = await db.queryOne<any>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) throw badRequest('Email already registered');

    // Verify contact exists
    const contactExists = await db.queryOne<any>('SELECT id FROM contacts WHERE id = ? AND active = 1', [contact_id]);
    if (!contactExists) throw badRequest('Selected contact does not exist');

    const passwordHash = await bcrypt.hash(password, 12);
    const { generateId, toMySQLDate } = await import('../db/mysql.js');
    const userId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      'INSERT INTO users (id, email, name, phone, passwordHash, contact_id, is_admin, is_staff, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, email, name || null, phone || null, passwordHash, contact_id, is_admin ? 1 : 0, is_staff ? 1 : 0, now, now]
    );

    // Assign role via user_roles (if roles table still has entries)
    const roleSlug = is_admin ? 'admin' : is_staff ? 'developer' : 'viewer';
    const role = await db.queryOne<any>('SELECT id FROM roles WHERE slug = ?', [roleSlug]);
    if (role) {
      await db.execute(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, role.id]
      );
    }

    const u = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, contact_id, is_admin, is_staff, ai_developer_tools_granted, isActive, createdAt, updatedAt FROM users WHERE id = ?',
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
 * PUT /users/:id — Update user (admin only)
 */
systemUsersRouter.put('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { email, password, name, phone, is_admin, is_staff, is_active, contact_id, ai_developer_tools_granted } = req.body;

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
    if (contact_id !== undefined) { updates.push('contact_id = ?'); params.push(contact_id || null); }
    if (is_admin !== undefined) { updates.push('is_admin = ?'); params.push(is_admin ? 1 : 0); }
    if (is_staff !== undefined) { updates.push('is_staff = ?'); params.push(is_staff ? 1 : 0); }
    if (ai_developer_tools_granted !== undefined) { updates.push('ai_developer_tools_granted = ?'); params.push(ai_developer_tools_granted ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      updates.push('passwordHash = ?'); params.push(hash);
    }
    updates.push('updatedAt = ?'); params.push(now);
    params.push(id);

    if (updates.length > 1) {
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Also sync role in user_roles if type changed (for legacy compatibility)
    if (is_admin !== undefined || is_staff !== undefined) {
      const roleSlug = is_admin ? 'admin' : is_staff ? 'developer' : 'viewer';
      const role = await db.queryOne<any>('SELECT id FROM roles WHERE slug = ?', [roleSlug]);
      if (role) {
        await db.execute('DELETE FROM user_roles WHERE user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci', [id]);
        await db.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, role.id]);
      }
    }

    const updated = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, contact_id, is_admin, is_staff, ai_developer_tools_granted, isActive, createdAt, updatedAt FROM users WHERE id = ?',
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
 * DELETE /users/:id — Delete user (admin only)
 */
systemUsersRouter.delete('/:id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { userId } = getAuth(req);

    if (id === userId) throw badRequest('Cannot delete yourself');

    const u = await db.queryOne<any>('SELECT id FROM users WHERE id = ?', [id]);
    if (!u) throw notFound('User not found');

    // Remove all foreign-key references, then roles, then user
    const fkDeletes = [
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
      `DELETE FROM calendar_event_attendees WHERE user_id = ?`,
      `DELETE FROM calendar_events WHERE user_id = ?`,
      `DELETE FROM scheduled_call_participants WHERE user_id = ?`,
      `DELETE FROM scheduled_calls WHERE created_by = ?`,
    ];
    for (const sql of fkDeletes) {
      try { await db.execute(sql, [id]); } catch { /* table may not exist — skip */ }
    }
    // Nullify nullable ownership columns
    const fkNullify = [
      `UPDATE \`groups\` SET created_by = NULL WHERE created_by = ?`,
      `UPDATE case_activity SET user_id = NULL WHERE user_id = ?`,
      `UPDATE case_comments SET user_id = NULL WHERE user_id = ?`,
      `UPDATE cases SET reported_by = NULL WHERE reported_by = ?`,
      `UPDATE cases SET assigned_to = NULL WHERE assigned_to = ?`,
      `UPDATE cases SET resolved_by = NULL WHERE resolved_by = ?`,
    ];
    for (const sql of fkNullify) {
      try { await db.execute(sql, [id]); } catch { /* skip */ }
    }
    // Reassign teams to the requesting admin (column is NOT NULL)
    try { await db.execute(`UPDATE teams SET createdByUserId = ? WHERE createdByUserId = ?`, [userId, id]); } catch { /* skip */ }

    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});
