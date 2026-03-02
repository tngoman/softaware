import { Router } from 'express';
import { z } from 'zod';

import { db, generateId, toMySQLDate, type vault_credentials, type team_members } from '../db/mysql.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { forbidden, notFound } from '../utils/httpErrors.js';

export const vaultRouter = Router();
vaultRouter.use(requireAuth);

vaultRouter.get('/credentials', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const memberships = await db.query<team_members>('SELECT * FROM team_members WHERE userId = ?', [userId]);
    const teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length === 0) {
      return res.json({ credentials: [] });
    }

    const placeholders = teamIds.map(() => '?').join(',');
    const creds = await db.query<vault_credentials>(
      `SELECT id, teamId, name, kind, description, createdAt 
       FROM vault_credentials WHERE teamId IN (${placeholders}) AND revokedAt IS NULL 
       ORDER BY createdAt DESC`,
      teamIds
    );

    res.json({ credentials: creds });
  } catch (err) {
    next(err);
  }
});

const CreateCredentialSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  description: z.string().optional(),
});

vaultRouter.post('/credentials', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = CreateCredentialSchema.parse(req.body);

    const member = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [input.teamId, userId]
    );
    if (!member) throw forbidden('Not a member of this team');
    if (member.role !== 'ADMIN') throw forbidden('Only ADMIN can manage vault metadata');

    const credId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO vault_credentials (id, teamId, name, kind, description, createdByUserId, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [credId, input.teamId, input.name, input.kind, input.description ?? null, userId, now]
    );

    const cred = await db.queryOne<vault_credentials>('SELECT * FROM vault_credentials WHERE id = ?', [credId]);
    res.status(201).json({ credential: cred });
  } catch (err) {
    next(err);
  }
});

vaultRouter.delete('/credentials/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const id = req.params.id;

    const cred = await db.queryOne<vault_credentials>('SELECT * FROM vault_credentials WHERE id = ?', [id]);
    if (!cred) throw notFound('Credential not found');

    const member = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [cred.teamId, userId]
    );
    if (!member) throw forbidden('Not a member of this team');
    if (member.role !== 'ADMIN') throw forbidden('Only ADMIN can revoke');

    const now = toMySQLDate(new Date());
    await db.execute('UPDATE vault_credentials SET revokedAt = ? WHERE id = ?', [now, id]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const GrantSchema = z.object({
  credentialId: z.string().min(1),
});

vaultRouter.post('/grant', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = GrantSchema.parse(req.body);

    const cred = await db.queryOne<vault_credentials>('SELECT * FROM vault_credentials WHERE id = ?', [input.credentialId]);
    if (!cred) throw notFound('Credential not found');

    const member = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [cred.teamId, userId]
    );
    if (!member) throw forbidden('Not a member of this team');

    res.json({ token: `vault_grant_${cred.id}` });
  } catch (err) {
    next(err);
  }
});
