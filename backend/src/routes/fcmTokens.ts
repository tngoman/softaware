import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
import {
  registerFcmToken,
  unregisterFcmToken,
  listFcmTokens,
  isFirebaseEnabled,
} from '../services/firebaseService.js';

export const fcmTokensRouter = Router();

// ─── POST /fcm-tokens — Register a device FCM token ───────────────
const RegisterTokenSchema = z.object({
  token: z.string().min(1),
  device_name: z.string().optional(),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

fcmTokensRouter.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const input = RegisterTokenSchema.parse(req.body);

    await registerFcmToken(userId, input.token, input.device_name, input.platform);

    res.json({
      success: true,
      message: 'Device registered for push notifications.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /fcm-tokens — List registered devices ────────────────────
fcmTokensRouter.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const devices = await listFcmTokens(userId);

    res.json({
      success: true,
      data: devices,
      fcm_enabled: isFirebaseEnabled(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /fcm-tokens/:token — Unregister a device ──────────────
fcmTokensRouter.delete('/:token', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = getAuth(req);
    const token = decodeURIComponent(req.params.token);

    if (!token) throw badRequest('Token is required');

    await unregisterFcmToken(userId, token);

    res.json({
      success: true,
      message: 'Device unregistered from push notifications.',
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /fcm-tokens/status — Check if FCM is configured ──────────
fcmTokensRouter.get('/status', requireAuth, async (_req: AuthRequest, res) => {
  res.json({
    success: true,
    data: {
      fcm_enabled: isFirebaseEnabled(),
    },
  });
});
