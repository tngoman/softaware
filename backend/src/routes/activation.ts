import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';

import { db } from '../db/mysql.js';

export const activationRouter = Router();

const CheckSchema = z.object({
  deviceId: z.string().min(1),
  activationKey: z.string().min(1).optional().nullable(),
  appVersion: z.string().min(1),
  offlineMode: z.boolean().default(false),
});

function entitlementsForTier(tier: 'Personal' | 'Team' | 'Enterprise') {
  switch (tier) {
    case 'Team':
      return {
        cloudSyncAllowed: true,
        vaultAllowed: true,
        maxAgents: null,
        maxUsers: 5,
      };
    case 'Enterprise':
      return {
        cloudSyncAllowed: true,
        vaultAllowed: true,
        maxAgents: null,
        maxUsers: null,
      };
    default:
      return {
        cloudSyncAllowed: false,
        vaultAllowed: false,
        maxAgents: 3,
        maxUsers: 1,
      };
  }
}

function toDbTier(tier: 'Personal' | 'Team' | 'Enterprise') {
  switch (tier) {
    case 'Team':
      return 'TEAM' as const;
    case 'Enterprise':
      return 'ENTERPRISE' as const;
    default:
      return 'PERSONAL' as const;
  }
}

/** MySQL-compatible upsert for device_activations */
async function upsertDeviceActivation(data: {
  deviceId: string;
  appVersion: string;
  isActive: boolean;
  tier: 'PERSONAL' | 'TEAM' | 'ENTERPRISE';
  activationKeyId?: string | null;
  userId?: string | null;
}) {
  const existing = await db.queryOne(
    'SELECT id FROM device_activations WHERE deviceId = ?',
    [data.deviceId]
  );
  const now = new Date();

  if (existing) {
    await db.execute(
      `UPDATE device_activations
          SET appVersion = ?, isActive = ?, tier = ?,
              activationKeyId = ?, userId = ?, lastSeenAt = ?
        WHERE id = ?`,
      [data.appVersion, data.isActive ? 1 : 0, data.tier,
       data.activationKeyId ?? null, data.userId ?? null, now,
       existing.id]
    );
  } else {
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO device_activations
          (id, deviceId, appVersion, isActive, tier, activationKeyId, userId, lastSeenAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.deviceId, data.appVersion, data.isActive ? 1 : 0, data.tier,
       data.activationKeyId ?? null, data.userId ?? null, now, now]
    );
  }
}

async function resolveActivation(input: z.infer<typeof CheckSchema>) {
  // Offline mode => treat as Personal inactive.
  if (input.offlineMode) {
    await upsertDeviceActivation({
      deviceId: input.deviceId,
      appVersion: input.appVersion,
      isActive: false,
      tier: 'PERSONAL',
      activationKeyId: null,
    });

    const ent = entitlementsForTier('Personal');
    return {
      isActive: false,
      tier: 'Personal' as const,
      cloudSyncAllowed: ent.cloudSyncAllowed,
      vaultAllowed: ent.vaultAllowed,
      maxAgents: ent.maxAgents,
      maxUsers: ent.maxUsers,
      backendUrlUsed: '',
      message: 'Offline mode',
    };
  }

  let resolvedTier: 'Personal' | 'Team' | 'Enterprise' = 'Personal';
  let isActive = false;
  let activationKeyId: string | null = null;
  let message: string | null = null;

  let userId: string | null = null;
  const activationKey = input.activationKey?.trim();
  if (activationKey) {
    const key: any = await db.queryOne(
      'SELECT * FROM activation_keys WHERE code = ? LIMIT 1',
      [activationKey]
    );
    if (key && key.isActive) {
      isActive = true;
      activationKeyId = key.id;
      resolvedTier = key.tier === 'TEAM' ? 'Team' : key.tier === 'ENTERPRISE' ? 'Enterprise' : 'Personal';
      message = 'Activation verified';

      // Link device to user who created this key (personal keys)
      if (key.createdByUserId) {
        userId = key.createdByUserId;
      }
    } else {
      message = 'Activation key not found or inactive';
    }
  } else {
    message = 'No activation key';
  }

  const defaultEnt = entitlementsForTier(resolvedTier);

  // If activated via key, allow key-specific overrides.
  let cloudSyncAllowed = defaultEnt.cloudSyncAllowed;
  let vaultAllowed = defaultEnt.vaultAllowed;
  let maxAgents = defaultEnt.maxAgents;
  let maxUsers = defaultEnt.maxUsers;

  if (activationKeyId) {
    const key: any = await db.queryOne(
      'SELECT * FROM activation_keys WHERE id = ? LIMIT 1',
      [activationKeyId]
    );
    if (key) {
      cloudSyncAllowed = key.cloudSyncAllowed;
      vaultAllowed = key.vaultAllowed;
      maxAgents = key.maxAgents ?? maxAgents;
      maxUsers = key.maxUsers ?? maxUsers;
    }
  }

  await upsertDeviceActivation({
    deviceId: input.deviceId,
    appVersion: input.appVersion,
    isActive,
    tier: toDbTier(resolvedTier),
    activationKeyId,
    userId,
  });

  return {
    isActive,
    tier: resolvedTier,
    cloudSyncAllowed,
    vaultAllowed,
    maxAgents,
    maxUsers,
    backendUrlUsed: '',
    message,
  };
}

activationRouter.post('/check', async (req, res, next) => {
  try {
    const input = CheckSchema.parse(req.body);

    const response = await resolveActivation(input);
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// Alias for future periodic pings.
activationRouter.post('/heartbeat', async (req, res, next) => {
  try {
    const input = CheckSchema.parse(req.body);
    const response = await resolveActivation(input);
    res.json(response);
  } catch (err) {
    next(err);
  }
});
