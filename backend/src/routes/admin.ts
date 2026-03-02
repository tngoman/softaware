import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';

import { db, generateId, toMySQLDate, type device_activations, type client_agents, type activation_keys, type Team } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

// ================= Dashboard Stats =================
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const totalClients = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM device_activations'
    );
    const activeClients = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM device_activations WHERE isActive = 1'
    );
    const totalAgents = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM client_agents'
    );
    const totalTeams = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM teams'
    );

    res.json({
      totalClients: totalClients?.cnt ?? 0,
      activeClients: activeClients?.cnt ?? 0,
      totalAgents: totalAgents?.cnt ?? 0,
      totalTeams: totalTeams?.cnt ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// ================= Clients =================
adminRouter.get('/clients', async (_req, res, next) => {
  try {
    const clients = await db.query<device_activations>(
      'SELECT deviceId, appVersion, isActive, tier, lastSeenAt, createdAt FROM device_activations ORDER BY lastSeenAt DESC'
    );

    // Include agent counts
    const counts = await db.query<{ deviceId: string; cnt: number }>(
      'SELECT deviceId, COUNT(*) as cnt FROM client_agents GROUP BY deviceId'
    );

    const countByDevice = new Map<string, number>(counts.map((c) => [c.deviceId, c.cnt]));

    res.json({
      clients: clients.map((c) => ({
        ...c,
        agentCount: countByDevice.get(c.deviceId) ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/clients/:deviceId/agents', async (req, res, next) => {
  try {
    const deviceId = z.string().min(1).parse(req.params.deviceId);

    const agents = await db.query<client_agents>(
      `SELECT deviceId, agentId, name, version, region, compliance, blueprint, createdAt, updatedAt 
       FROM client_agents WHERE deviceId = ? ORDER BY updatedAt DESC`,
      [deviceId]
    );

    res.json({ deviceId, agents });
  } catch (err) {
    next(err);
  }
});

// ================= Activation Keys =================

const CreateKeySchema = z.object({
  tier: z.enum(['PERSONAL', 'TEAM', 'ENTERPRISE']),
  cloudSyncAllowed: z.boolean().optional().default(false),
  vaultAllowed: z.boolean().optional().default(false),
  maxAgents: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
});

adminRouter.get('/activation-keys', async (_req, res, next) => {
  try {
    const keys = await db.query<activation_keys>(
      `SELECT id, code, tier, isActive, cloudSyncAllowed, vaultAllowed, maxAgents, maxUsers, createdAt 
       FROM activation_keys ORDER BY createdAt DESC`
    );

    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/activation-keys', async (req, res, next) => {
  try {
    const data = CreateKeySchema.parse(req.body);
    const code = `SA-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const keyId = generateId();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO activation_keys (id, code, tier, isActive, cloudSyncAllowed, vaultAllowed, maxAgents, maxUsers, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [keyId, code, data.tier, true, data.cloudSyncAllowed, data.vaultAllowed, data.maxAgents ?? null, data.maxUsers ?? null, now]
    );

    const key = await db.queryOne<activation_keys>('SELECT * FROM activation_keys WHERE id = ?', [keyId]);
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/activation-keys/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);

    await db.execute('UPDATE activation_keys SET isActive = ? WHERE id = ?', [false, id]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ================= Teams =================

adminRouter.get('/teams', async (_req, res, next) => {
  try {
    const teams = await db.query<Team & { memberCount: number; agentCount: number }>(
      `SELECT t.id, t.name, t.createdAt,
         (SELECT COUNT(*) FROM team_members WHERE teamId = t.id) as memberCount,
         (SELECT COUNT(*) FROM agents_config WHERE teamId = t.id) as agentCount
       FROM teams t ORDER BY t.createdAt DESC`
    );

    res.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t.memberCount,
        agentCount: t.agentCount,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ================= Lead Capture =================

const ConvertLeadSchema = z.object({
  note: z.string().max(500).optional(),
});

adminRouter.get('/leads', async (_req, res, next) => {
  try {
    const leads = await db.query<any>(
      `SELECT id, sessionId, sourcePage, companyName, contactName, email, phone,
              useCase, requirements, budgetRange, timeline, status, score,
              messageCount, lastMessage, createdAt, updatedAt
       FROM lead_captures
       ORDER BY updatedAt DESC
       LIMIT 500`
    );

    res.json({ leads });
  } catch (err: any) {
    if (String(err?.message || '').toLowerCase().includes('doesn\'t exist')) {
      return res.json({ leads: [] });
    }
    next(err);
  }
});

adminRouter.post('/leads/:id/convert', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const payload = ConvertLeadSchema.parse(req.body || {});
    const now = toMySQLDate(new Date());

    const existing = await db.queryOne<{ id: string; requirements: string | null }>(
      'SELECT id, requirements FROM lead_captures WHERE id = ? LIMIT 1',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'LEAD_NOT_FOUND' });
    }

    const conversionNote = payload.note ? `\n[CONVERSION_NOTE] ${payload.note}` : '';
    const mergedRequirements = `${existing.requirements || ''}${conversionNote}`.trim();

    await db.execute(
      'UPDATE lead_captures SET status = ?, requirements = ?, updatedAt = ? WHERE id = ?',
      ['CONVERTED', mergedRequirements || null, now, id]
    );

    const lead = await db.queryOne<any>('SELECT * FROM lead_captures WHERE id = ? LIMIT 1', [id]);
    return res.json({ lead });
  } catch (err) {
    next(err);
  }
});
