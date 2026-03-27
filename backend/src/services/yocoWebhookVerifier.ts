/**
 * Yoco Webhook Signature Verifier — Svix 3-header pattern
 *
 * Yoco uses the Svix standard for webhook signatures:
 *   webhook-id        → unique message ID for deduplication
 *   webhook-timestamp → unix seconds, reject if >5 min old
 *   webhook-signature → "v1,<base64(HMAC-SHA256(content, decoded_secret))>"
 *
 * Secret format: "whsec_<base64-encoded-key>" — strip prefix, base64-decode.
 */

import crypto from 'crypto';

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a Yoco / Svix webhook signature.
 *
 * @param rawBody   The raw request body (Buffer or string)
 * @param headers   The three Svix headers
 * @param secret    The webhook secret in "whsec_..." format
 */
export function verifyYocoWebhook(
  rawBody: Buffer | string,
  headers: {
    'webhook-id'?: string;
    'webhook-timestamp'?: string;
    'webhook-signature'?: string;
  },
  secret: string,
): WebhookVerificationResult {
  const webhookId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatures = headers['webhook-signature'];

  if (!webhookId || !timestamp || !signatures) {
    return { valid: false, error: 'Missing required webhook headers (webhook-id, webhook-timestamp, webhook-signature)' };
  }

  // ── Timestamp replay protection ──────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, error: 'Invalid webhook-timestamp header' };
  }
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, error: `Webhook timestamp outside ±${TIMESTAMP_TOLERANCE_SECONDS}s tolerance` };
  }

  // ── Decode secret: strip "whsec_" prefix, base64-decode ──────────
  const secretPayload = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const secretBytes = Buffer.from(secretPayload, 'base64');

  // ── Build signing content ────────────────────────────────────────
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const signingContent = `${webhookId}.${timestamp}.${body}`;

  // ── Compute expected signature ───────────────────────────────────
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signingContent)
    .digest('base64');

  // ── Compare against all provided signatures ──────────────────────
  // Svix may send multiple space-separated signatures: "v1,sig1 v1,sig2"
  const providedSigs = signatures.split(' ');
  for (const sig of providedSigs) {
    const parts = sig.split(',');
    if (parts.length !== 2) continue;
    const [version, sigValue] = parts;
    if (version !== 'v1') continue;

    try {
      if (
        crypto.timingSafeEqual(
          Buffer.from(expected, 'utf8'),
          Buffer.from(sigValue, 'utf8'),
        )
      ) {
        return { valid: true };
      }
    } catch {
      // Length mismatch → not equal, continue
    }
  }

  return { valid: false, error: 'No matching v1 signature found' };
}
