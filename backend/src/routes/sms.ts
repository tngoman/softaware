/**
 * SMS Routes — Expose smsService via HTTP
 *
 * POST /sms/send          — Send a single SMS
 * POST /sms/send-bulk     — Send bulk SMS (max 500)
 * GET  /sms/balance        — Get remaining SMS credits
 *
 * All endpoints require JWT auth + admin role.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { sendSms, sendBulkSms, getBalance, normalisePhone } from '../services/smsService.js';

export const smsRouter = Router();

// ── All SMS routes require authentication + admin ────────────────────
smsRouter.use(requireAuth);
smsRouter.use(requireAdmin);

// ── Validation schemas ───────────────────────────────────────────────
const SendSmsSchema = z.object({
  to: z.string().min(9, 'Phone number is required'),
  message: z.string().min(1, 'Message body is required').max(918, 'Message too long (max 6 SMS segments)'),
  testMode: z.boolean().optional(),
  campaignName: z.string().optional(),
  scheduledDelivery: z.string().optional(),
});

const SendBulkSchema = z.object({
  messages: z.array(
    z.object({
      destination: z.string().min(9),
      content: z.string().min(1).max(918),
    })
  ).min(1).max(500),
  testMode: z.boolean().optional(),
  campaignName: z.string().optional(),
  scheduledDelivery: z.string().optional(),
  duplicateCheck: z.boolean().optional(),
});

// ── POST /sms/send — Send single SMS ────────────────────────────────
smsRouter.post('/send', async (req: AuthRequest, res: Response, next) => {
  try {
    const { to, message, testMode, campaignName, scheduledDelivery } = SendSmsSchema.parse(req.body);

    const result = await sendSms(to, message, {
      testMode,
      campaignName,
      scheduledDelivery,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /sms/send-bulk — Send bulk SMS ─────────────────────────────
smsRouter.post('/send-bulk', async (req: AuthRequest, res: Response, next) => {
  try {
    const { messages, testMode, campaignName, scheduledDelivery, duplicateCheck } = SendBulkSchema.parse(req.body);

    const result = await sendBulkSms(messages as { destination: string; content: string }[], {
      testMode,
      campaignName,
      scheduledDelivery,
      duplicateCheck,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /sms/balance — Check SMS credit balance ─────────────────────
smsRouter.get('/balance', async (_req: AuthRequest, res: Response, next) => {
  try {
    const balance = await getBalance();
    res.json({
      success: true,
      data: balance,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /sms/normalise/:phone — Normalise a phone number ────────────
smsRouter.get('/normalise/:phone', async (req: AuthRequest, res: Response) => {
  const normalised = normalisePhone(req.params.phone);
  res.json({ success: true, data: { original: req.params.phone, normalised } });
});
