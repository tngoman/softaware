/**
 * Yoco Refund Service
 *
 * Handles refund requests via the Yoco API:
 *   POST https://payments.yoco.com/api/checkouts/{id}/refund
 *
 * Supports partial and full refunds with idempotency.
 */

import crypto from 'crypto';
import { db } from '../db/mysql.js';
import { getYocoActiveConfig, getYocoSecretKeyForMode } from './credentialVault.js';

const YOCO_API_BASE = 'https://payments.yoco.com/api';

export interface RefundInput {
  checkoutId: string;
  amount?: number;        // partial refund in ZAR cents; omit for full
  reason?: string;
  adminUserId: string;    // admin performing the refund
}

export interface RefundResult {
  refundId: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
}

/**
 * Create a Yoco refund for a given checkout.
 */
export async function createRefund(input: RefundInput): Promise<RefundResult> {
  // 1. Look up the checkout
  const checkout = await db.queryOne<any>(
    'SELECT * FROM yoco_checkouts WHERE checkout_id = ?',
    [input.checkoutId],
  );
  if (!checkout) throw new Error(`Checkout ${input.checkoutId} not found`);
  if (checkout.status !== 'completed') {
    throw new Error(`Cannot refund checkout with status "${checkout.status}" — must be completed`);
  }

  // 2. Determine the secret key for the mode the checkout was created in
  const mode = checkout.mode as 'live' | 'test';
  let secretKey: string;

  // Always resolve the key for the mode the checkout was originally created in
  const modeKey = await getYocoSecretKeyForMode(mode);
  if (modeKey) {
    secretKey = modeKey;
  } else {
    const config = await getYocoActiveConfig();
    secretKey = config?.secretKey || '';
  }

  if (!secretKey) throw new Error('No Yoco secret key available for refund');

  // 3. Refund amount (default to full checkout amount)
  const refundAmount = input.amount ?? checkout.amount;

  // 4. Idempotency key: SHA-256(paymentId + amount + existingRefundedAmount)
  const existingRefunds = await db.query<any>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM yoco_refunds
     WHERE checkout_id = ? AND status = 'succeeded'`,
    [input.checkoutId],
  );
  const alreadyRefunded = existingRefunds[0]?.total || 0;

  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${checkout.payment_id}:${refundAmount}:${alreadyRefunded}`)
    .digest('hex');

  // 5. Persist pending refund
  const refundDbId = await db.insertOne('yoco_refunds', {
    checkout_id: input.checkoutId,
    contact_id: checkout.contact_id,
    amount: refundAmount,
    status: 'pending',
    reason: input.reason || null,
    mode,
    idempotency_key: idempotencyKey,
    created_at: new Date().toISOString(),
  });

  // 6. Call Yoco API
  try {
    const response = await fetch(`${YOCO_API_BASE}/checkouts/${input.checkoutId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ amount: refundAmount }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[YocoRefund] API error:', response.status, errBody);
      await db.execute(
        'UPDATE yoco_refunds SET status = ? WHERE id = ?',
        ['failed', refundDbId],
      );
      return { refundId: null, status: 'failed', amount: refundAmount };
    }

    const data = (await response.json()) as any;
    const refundId = data.refundId || data.id || null;

    await db.execute(
      'UPDATE yoco_refunds SET refund_id = ?, status = ?, completed_at = NOW() WHERE id = ?',
      [refundId, 'succeeded', refundDbId],
    );

    console.log(`[YocoRefund] Refund ${refundId} created for checkout ${input.checkoutId} (${refundAmount}c)`);

    return { refundId, status: 'succeeded', amount: refundAmount };
  } catch (err: any) {
    console.error('[YocoRefund] Network error:', err.message);
    await db.execute(
      'UPDATE yoco_refunds SET status = ? WHERE id = ?',
      ['failed', refundDbId],
    );
    return { refundId: null, status: 'failed', amount: refundAmount };
  }
}
