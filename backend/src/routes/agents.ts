import { Router } from 'express';
import { z } from 'zod';

import { db, generateId, toMySQLDate, type Agent, type team_members } from '../db/mysql.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { forbidden, notFound } from '../utils/httpErrors.js';

export const agentsRouter = Router();
agentsRouter.use(requireAuth);

async function requireAgentAccess(userId: string, agentId: string) {
  const agent = await db.queryOne<Agent>('SELECT * FROM agents_config WHERE id = ?', [agentId]);
  if (!agent) throw notFound('Agent not found');

  const member = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
    [agent.teamId, userId]
  );
  if (!member) throw forbidden('Not a member of this team');

  return { agent, member };
}

agentsRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    const memberships = await db.query<team_members>('SELECT * FROM team_members WHERE userId = ?', [userId]);
    const teamIds = memberships.map((m) => m.teamId);

    if (teamIds.length === 0) {
      return res.json({ agents: [] });
    }

    const placeholders = teamIds.map(() => '?').join(',');
    const agents = await db.query<Agent>(
      `SELECT id, teamId, name, version, region, compliance, publishedAt, createdAt, updatedAt 
       FROM agents_config WHERE teamId IN (${placeholders}) ORDER BY updatedAt DESC`,
      teamIds
    );

    res.json({ agents });
  } catch (err) {
    next(err);
  }
});

const CreateAgentSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1).default('1.0.0'),
  region: z.string().default('ZA'),
  compliance: z.array(z.string()).default([]),
  blueprint: z.any(),
});

agentsRouter.post('/', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = CreateAgentSchema.parse(req.body);

    const member = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE teamId = ? AND userId = ?',
      [input.teamId, userId]
    );
    if (!member) throw forbidden('Not a member of this team');

    const agentId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO agents_config (id, teamId, name, version, region, compliance, blueprint, createdByUserId, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        input.teamId,
        input.name,
        input.version,
        input.region,
        JSON.stringify(input.compliance),
        JSON.stringify(input.blueprint ?? null),
        userId,
        now,
        now
      ]
    );

    const agent = await db.queryOne<Agent>('SELECT * FROM agents_config WHERE id = ?', [agentId]);
    res.status(201).json({ agent });
  } catch (err) {
    next(err);
  }
});

agentsRouter.get('/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { agent } = await requireAgentAccess(userId, req.params.id);
    res.json({ agent });
  } catch (err) {
    next(err);
  }
});

const UpdateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  compliance: z.array(z.string()).optional(),
  blueprint: z.any().optional(),
});

agentsRouter.put('/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = UpdateAgentSchema.parse(req.body);

    const { agent, member } = await requireAgentAccess(userId, req.params.id);
    if (member.role === 'AUDITOR') throw forbidden('Insufficient role');

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
    if (input.version !== undefined) { updates.push('version = ?'); values.push(input.version); }
    if (input.region !== undefined) { updates.push('region = ?'); values.push(input.region); }
    if (input.compliance !== undefined) { updates.push('compliance = ?'); values.push(JSON.stringify(input.compliance)); }
    if (input.blueprint !== undefined) { updates.push('blueprint = ?'); values.push(JSON.stringify(input.blueprint)); }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(toMySQLDate(new Date()));
      values.push(agent.id);

      await db.execute(`UPDATE agents_config SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = await db.queryOne<Agent>('SELECT * FROM agents_config WHERE id = ?', [agent.id]);
    res.json({ agent: updated });
  } catch (err) {
    next(err);
  }
});

agentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { agent, member } = await requireAgentAccess(userId, req.params.id);
    if (member.role !== 'ADMIN' && member.role !== 'ARCHITECT') throw forbidden('Insufficient role');

    await db.execute('DELETE FROM agents_config WHERE id = ?', [agent.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

agentsRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { agent, member } = await requireAgentAccess(userId, req.params.id);
    if (member.role !== 'ADMIN' && member.role !== 'ARCHITECT') throw forbidden('Insufficient role');

    const now = toMySQLDate(new Date());
    await db.execute('UPDATE agents_config SET publishedAt = ?, updatedAt = ? WHERE id = ?', [now, now, agent.id]);

    const published = await db.queryOne<Agent>('SELECT * FROM agents_config WHERE id = ?', [agent.id]);
    res.json({ agent: published });
  } catch (err) {
    next(err);
  }
});
