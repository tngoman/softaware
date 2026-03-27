import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { createCheckout, getCheckoutByYocoId, pollCheckoutStatus } from '../services/yocoCheckout.js';
import { verifyYocoWebhook } from '../services/yocoWebhookVerifier.js';
import { getYocoActiveConfig } from '../services/credentialVault.js';
import { TIER_LIMITS, TierName } from '../config/tiers.js';

export const yocoRouter = Router();

/** Prices in ZAR cents — must match Pricing.md / config/tiers.ts */
const PLAN_PRICES: Record<string, number> = {
  starter:   34900,   // R349
  pro:       69900,   // R699
  advanced: 149900,   // R1,499
  // enterprise is custom — no self-serve checkout
};

/**
 * POST /api/v1/yoco/checkout
 * Create a Yoco Checkout session for a plan upgrade / subscription
 */
yocoRouter.post('/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { plan_type, success_url, cancel_url } = req.body;

    if (!plan_type || !PLAN_PRICES[plan_type]) {
      return res.status(400).json({ success: false, error: `Invalid plan_type. Valid: ${Object.keys(PLAN_PRICES).join(', ')}` });
    }

    const user = await db.queryOne<{ id: string; email: string; contact_id?: number }>(
      'SELECT id, email, contact_id FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    const tierLimits = TIER_LIMITS[plan_type as TierName];
    const displayName = `SoftAware ${tierLimits?.name || plan_type} Plan — Monthly`;

    const result = await createCheckout({
      contactId: user.contact_id || 0,
      userId,
      packageId: null,
      action: 'SUBSCRIBE',
      billingCycle: 'MONTHLY',
      amount: PLAN_PRICES[plan_type],
      displayName,
      successUrl: success_url,
      cancelUrl: cancel_url,
      targetTier: plan_type,
    });

    res.json({
      success: true,
      redirectUrl: result.redirectUrl,
      checkoutId: result.checkoutId,
    });
  } catch (err: any) {
    console.error('[Yoco Checkout] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/yoco/checkout/:checkoutId/status
 * Poll checkout status (for frontend redirect-back flow)
 */
yocoRouter.get('/checkout/:checkoutId/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { checkoutId } = req.params;
    const record = await getCheckoutByYocoId(checkoutId);
    if (!record) return res.status(404).json({ success: false, error: 'Checkout not found' });

    // If still pending, poll Yoco for fresh status
    if (record.status === 'pending') {
      const fresh = await pollCheckoutStatus(checkoutId, record.mode);
      if (fresh.status === 'completed' || fresh.status === 'successful') {
        // Fulfil: upgrade user plan
        const targetTier = record.metadata ? JSON.parse(record.metadata).softaware_target_tier : null;
        if (targetTier) {
          await db.execute('UPDATE users SET plan_type = ? WHERE id = ?', [targetTier, record.user_id]);
        }
        await db.execute(
          "UPDATE yoco_checkouts SET status = 'completed', payment_id = ?, updated_at = NOW() WHERE id = ?",
          [fresh.paymentId || null, record.id]
        );
        return res.json({ success: true, status: 'completed', plan_type: targetTier });
      }
    }

    res.json({ success: true, status: record.status });
  } catch (err: any) {
    console.error('[Yoco Status] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/webhooks/yoco
 * Yoco Svix webhook handler — fulfils payments asynchronously
 */
yocoRouter.post('/webhooks/yoco', async (req, res) => {
  try {
    const config = await getYocoActiveConfig();
    if (!config || !config.webhookSecret) {
      console.error('[Yoco Webhook] No webhook secret configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const rawBody = typeof req.body === 'string' ? req.body : (Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body));
    const verification = verifyYocoWebhook(rawBody, {
      'webhook-id': req.headers['webhook-id'] as string,
      'webhook-timestamp': req.headers['webhook-timestamp'] as string,
      'webhook-signature': req.headers['webhook-signature'] as string,
    }, config.webhookSecret);

    if (!verification.valid) {
      console.warn('[Yoco Webhook] Signature verification failed:', verification.error);
      return res.status(401).json({ error: verification.error });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const checkoutId = payload?.payload?.metadata?.checkoutId || payload?.data?.id || payload?.id;

    if (checkoutId) {
      const record = await getCheckoutByYocoId(checkoutId);
      if (record && record.status !== 'completed') {
        const targetTier = record.metadata ? JSON.parse(record.metadata).softaware_target_tier : null;
        if (targetTier) {
          await db.execute('UPDATE users SET plan_type = ? WHERE id = ?', [targetTier, record.user_id]);
        }
        await db.execute(
          "UPDATE yoco_checkouts SET status = 'completed', updated_at = NOW() WHERE id = ?",
          [record.id]
        );
        console.log(`[Yoco Webhook] Fulfilled checkout ${checkoutId} → plan ${targetTier}`);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Yoco Webhook] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

