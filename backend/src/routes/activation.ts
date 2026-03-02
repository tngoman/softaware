import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma.js';

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

function prismaTier(tier: 'Personal' | 'Team' | 'Enterprise') {
  switch (tier) {
    case 'Team':
      return 'TEAM' as const;
    case 'Enterprise':
      return 'ENTERPRISE' as const;
    default:
      return 'PERSONAL' as const;
  }
}

async function resolveActivation(input: z.infer<typeof CheckSchema>) {
  // Offline mode => treat as Personal inactive.
  if (input.offlineMode) {
    await prisma.deviceActivation.upsert({
      where: { deviceId: input.deviceId },
      create: {
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        isActive: false,
        tier: 'PERSONAL',
        lastSeenAt: new Date(),
      },
      update: {
        appVersion: input.appVersion,
        isActive: false,
        tier: 'PERSONAL',
        lastSeenAt: new Date(),
        activationKeyId: null,
      },
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
    const key = await prisma.activationKey.findUnique({ 
      where: { code: activationKey },
      include: { createdByUser: true }
    });
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
    const key = await prisma.activationKey.findUnique({ where: { id: activationKeyId } });
    if (key) {
      cloudSyncAllowed = key.cloudSyncAllowed;
      vaultAllowed = key.vaultAllowed;
      maxAgents = key.maxAgents ?? maxAgents;
      maxUsers = key.maxUsers ?? maxUsers;
    }
  }

  await prisma.deviceActivation.upsert({
    where: { deviceId: input.deviceId },
    create: {
      deviceId: input.deviceId,
      appVersion: input.appVersion,
      isActive,
      tier: prismaTier(resolvedTier),
      activationKeyId,
      userId,
      lastSeenAt: new Date(),
    },
    update: {
      appVersion: input.appVersion,
      isActive,
      tier: prismaTier(resolvedTier),
      activationKeyId,
      userId,
      lastSeenAt: new Date(),
    },
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
