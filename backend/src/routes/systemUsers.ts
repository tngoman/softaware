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
function mapUser(u: any, membership?: any, roles?: any[]): any {
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
    is_admin: membership?.role === 'ADMIN',
    is_staff: membership?.role === 'STAFF',
    is_active: true,
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
      'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users ORDER BY createdAt DESC'
    );

    const result = [];
    for (const u of users) {
      const membership = await db.queryOne<any>(
        'SELECT role FROM team_members WHERE userId = ? LIMIT 1',
        [u.id]
      );
      const roles = await db.query<any>(
        `SELECT r.id, r.name, r.slug FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
        [u.id]
      );
      result.push(mapUser(u, membership, roles));
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
      'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );
    if (!u) throw notFound('User not found');

    const membership = await db.queryOne<any>(
      'SELECT role FROM team_members WHERE userId = ? LIMIT 1',
      [u.id]
    );
    const roles = await db.query<any>(
      `SELECT r.id, r.name, r.slug FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [u.id]
    );

    res.json({ success: true, data: mapUser(u, membership, roles) });
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

    // Assign to default team
    const team = await db.queryOne<any>('SELECT id FROM teams LIMIT 1');
    if (team) {
      const memberId = generateId();
      const teamRole = is_admin ? 'ADMIN' : is_staff ? 'STAFF' : 'OPERATOR';
      await db.execute(
        'INSERT INTO team_members (id, teamId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
        [memberId, team.id, userId, teamRole, now]
      );
    }

    const u = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?',
      [userId]
    );

    const assignedRole = is_admin ? 'ADMIN' : is_staff ? 'STAFF' : 'OPERATOR';
    res.status(201).json({ success: true, data: mapUser(u, { role: assignedRole }) });
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
    const { email, password, name, phone, is_admin, is_staff } = req.body;

    const u = await db.queryOne<any>('SELECT id FROM users WHERE id = ?', [id]);
    if (!u) throw notFound('User not found');

    const { toMySQLDate } = await import('../db/mysql.js');
    const now = toMySQLDate(new Date());

    const updates: string[] = [];
    const params: any[] = [];

    if (email) { updates.push('email = ?'); params.push(email); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
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
      const teamRole = is_admin ? 'ADMIN' : is_staff ? 'STAFF' : 'OPERATOR';
      await db.execute(
        'UPDATE team_members SET role = ? WHERE userId = ?',
        [teamRole, id]
      );
    }

    const updated = await db.queryOne<any>(
      'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );
    const membership = await db.queryOne<any>('SELECT role FROM team_members WHERE userId = ? LIMIT 1', [id]);

    res.json({ success: true, data: mapUser(updated, membership) });
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

    // Remove memberships and roles first
    await db.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
    await db.execute('DELETE FROM team_members WHERE userId = ?', [id]);
    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});
