/**
 * Yoco Checkout Service
 *
 * Creates Yoco Checkout sessions for all purchase paths:
 *   SUBSCRIBE | UPGRADE | TOPUP | WIDGET_UPGRADE | SITE_UPGRADE | ENTERPRISE
 *
 * Stores every checkout in `yoco_checkouts` for idempotency and polling.
 */

import { db } from '../db/mysql.js';
import { getYocoActiveConfig, type YocoConfig } from './credentialVault.js';
import { env } from '../config/env.js';

// ─── Types ───────────────────────────────────────────────────────────────

export type YocoAction =
  | 'SUBSCRIBE'
  | 'UPGRADE'
  | 'TOPUP'
  | 'WIDGET_UPGRADE'
  | 'SITE_UPGRADE'
  | 'ENTERPRISE';

export interface CreateCheckoutInput {
  contactId: number;
  userId: string;
  packageId: number | null;
  action: YocoAction;
  billingCycle: 'MONTHLY' | 'ANNUALLY' | 'NONE';
  amount: number;            // ZAR cents (integer)
  displayName: string;       // line-item label
  successUrl?: string;
  cancelUrl?: string;
  failureUrl?: string;
  /** Action-specific metadata */
  widgetClientId?: string;
  siteId?: number;
  targetTier?: string;
}

export interface CheckoutResult {
  checkoutId: string;
  redirectUrl: string;
  status: string;
  dbId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

const YOCO_API_BASE = 'https://payments.yoco.com/api';

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Create a Yoco Checkout session and persist it in `yoco_checkouts`.
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
  const config = await getYocoActiveConfig();
  if (!config) {
    throw new Error('Yoco payment gateway is not configured. Add credentials via Admin → Credentials.');
  }

  const frontendOrigin = env.CORS_ORIGIN !== '*' ? env.CORS_ORIGIN : 'https://mcp.softaware.net.za';

  const metadata: Record<string, string> = {
    softaware_contact_id: String(input.contactId),
    softaware_user_id: input.userId,
    softaware_action: input.action,
    softaware_billing_cycle: input.billingCycle,
    softaware_mode: config.mode,
  };

  if (input.widgetClientId) metadata.softaware_widget_client_id = input.widgetClientId;
  if (input.siteId)         metadata.softaware_site_id = String(input.siteId);
  if (input.targetTier)     metadata.softaware_target_tier = input.targetTier;

  const successUrl = input.successUrl || `${frontendOrigin}/billing?yoco_checkout_id={checkoutId}`;
  const cancelUrl  = input.cancelUrl  || `${frontendOrigin}/billing?cancelled=true`;
  const failureUrl = input.failureUrl || `${frontendOrigin}/billing?failed=true`;

  const payload = {
    amount: input.amount,
    currency: 'ZAR',
    successUrl,
    cancelUrl,
    failureUrl,
    metadata,
    lineItems: [
      {
        displayName: input.displayName,
        quantity: 1,
        pricingDetails: {
          price: input.amount,
          taxAmount: 0,
        },
      },
    ],
  };

  // ── Call Yoco API ────────────────────────────────────────────────
  const response = await fetch(`${YOCO_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[YocoCheckout] API error:', response.status, errBody);
    throw new Error(`Yoco API returned ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    redirectUrl: string;
    status: string;
    amount: number;
    currency: string;
  };

  // ── Persist to yoco_checkouts ────────────────────────────────────
  // Set first poll 60 seconds from now
  const nextPoll = new Date(Date.now() + 60_000);

  const dbId = await db.insertOne('yoco_checkouts', {
    checkout_id: data.id,
    contact_id: input.contactId,
    user_id: input.userId,
    action: input.action,
    amount: input.amount,
    currency: 'ZAR',
    mode: config.mode,
    status: 'pending',
    metadata: JSON.stringify(metadata),
    redirect_url: data.redirectUrl,
    success_url: successUrl,
    cancel_url: cancelUrl,
    failure_url: failureUrl,
    poll_count: 0,
    next_poll_at: nextPoll.toISOString().slice(0, 19).replace('T', ' '),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  console.log(`[YocoCheckout] Created checkout ${data.id} (mode=${config.mode}, amount=${input.amount}c, action=${input.action})`);

  return {
    checkoutId: data.id,
    redirectUrl: data.redirectUrl,
    status: data.status,
    dbId,
  };
}

/**
 * Fetch the current status of a checkout from the Yoco API.
 */
export async function pollCheckoutStatus(checkoutId: string, mode: 'live' | 'test'): Promise<{
  status: string;
  paymentId?: string;
  metadata?: Record<string, string>;
}> {
  const config = await getYocoActiveConfig();
  if (!config) throw new Error('Yoco not configured');

  // Use the key that matches the mode the checkout was created in
  let secretKey = config.secretKey;
  // If current mode doesn't match checkout mode, try the other key
  if (config.mode !== mode) {
    const { getYocoSecretKeyForMode } = await import('./credentialVault.js');
    const altKey = await getYocoSecretKeyForMode(mode);
    if (altKey) secretKey = altKey;
  }

  const response = await fetch(`${YOCO_API_BASE}/checkouts/${checkoutId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!response.ok) {
    throw new Error(`Yoco status poll failed: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return {
    status: data.status,
    paymentId: data.paymentId || data.id,
    metadata: data.metadata,
  };
}

/**
 * Get a checkout record from the database.
 */
export async function getCheckoutByYocoId(checkoutId: string) {
  return db.queryOne<any>(
    'SELECT * FROM yoco_checkouts WHERE checkout_id = ?',
    [checkoutId],
  );
}

/**
 * Get a checkout record by DB id.
 */
export async function getCheckoutById(id: number) {
  return db.queryOne<any>(
    'SELECT * FROM yoco_checkouts WHERE id = ?',
    [id],
  );
}
