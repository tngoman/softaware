import { Router } from 'express';
import { z } from 'zod';

import { db, generateId, toMySQLDate, type client_agents, type device_activations } from '../db/mysql.js';
import { getAuth, requireAuth } from '../middleware/auth.js';

export const syncRouter = Router();

const ClientAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(50).default('1.0.0'),
  region: z.string().min(1).max(10).default('ZA'),
  compliance: z.unknown().default([]),
  blueprint: z.unknown().default({}),
});

const UpsertSchema = z.object({
  deviceId: z.string().min(1),
  agent: ClientAgentSchema,
});

syncRouter.get('/agents', async (req, res, next) => {
  try {
    const deviceId = z.string().min(1).parse(req.query.deviceId);

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

syncRouter.post('/agents', async (req, res, next) => {
  try {
    const input = UpsertSchema.parse(req.body);
    const now = toMySQLDate(new Date());

    // Check if exists
    const existing = await db.queryOne<client_agents>(
      'SELECT id FROM client_agents WHERE deviceId = ? AND agentId = ?',
      [input.deviceId, input.agent.agentId]
    );

    if (existing) {
      // Update
      await db.execute(
        `UPDATE client_agents SET name = ?, version = ?, region = ?, compliance = ?, blueprint = ?, updatedAt = ? 
         WHERE deviceId = ? AND agentId = ?`,
        [
          input.agent.name,
          input.agent.version,
          input.agent.region,
          JSON.stringify(input.agent.compliance),
          JSON.stringify(input.agent.blueprint),
          now,
          input.deviceId,
          input.agent.agentId
        ]
      );
    } else {
      // Insert
      const id = generateId();
      await db.execute(
        `INSERT INTO client_agents (id, deviceId, agentId, name, version, region, compliance, blueprint, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.deviceId,
          input.agent.agentId,
          input.agent.name,
          input.agent.version,
          input.agent.region,
          JSON.stringify(input.agent.compliance),
          JSON.stringify(input.agent.blueprint),
          now,
          now
        ]
      );
    }

    const upserted = await db.queryOne<client_agents>(
      'SELECT deviceId, agentId, name, version, region, createdAt, updatedAt FROM client_agents WHERE deviceId = ? AND agentId = ?',
      [input.deviceId, input.agent.agentId]
    );

    res.json({ agent: upserted });
  } catch (err) {
    next(err);
  }
});

syncRouter.delete('/agents/:agentId', async (req, res, next) => {
  try {
    const deviceId = z.string().min(1).parse(req.query.deviceId);
    const agentId = z.string().min(1).parse(req.params.agentId);

    await db.execute('DELETE FROM client_agents WHERE deviceId = ? AND agentId = ?', [deviceId, agentId]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Authenticated endpoint: retrieve user's synced agents across all their devices
syncRouter.get('/my-agents', requireAuth, async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    // Find all devices owned by this user
    const devices = await db.query<device_activations>(
      'SELECT deviceId FROM device_activations WHERE userId = ?',
      [userId]
    );

    const deviceIds = devices.map((d) => d.deviceId);

    if (deviceIds.length === 0) {
      return res.json({ userId, agents: [] });
    }

    const placeholders = deviceIds.map(() => '?').join(',');
    const agents = await db.query<client_agents>(
      `SELECT deviceId, agentId, name, version, region, compliance, blueprint, createdAt, updatedAt 
       FROM client_agents WHERE deviceId IN (${placeholders}) ORDER BY updatedAt DESC`,
      deviceIds
    );

    res.json({ userId, agents });
  } catch (err) {
    next(err);
  }
});
