/**
 * SMS Service — SMSPortal REST API Integration
 *
 * Gateway:  https://rest.smsportal.com
 * Docs:     https://docs.smsportal.com/reference/bulkmessages_postv3
 *
 * Credentials are pulled from the `credentials` table:
 *   service_name = 'SMS KEY'     →  Client ID
 *   service_name = 'SMS SECRET'  →  API Secret (may be AES-256-GCM encrypted)
 *
 * Authentication uses Basic auth (base64 of clientId:secret) to obtain a
 * 24 h bearer token (cached for 23 h).
 */
import axios, { AxiosError } from 'axios';
import { db } from '../db/mysql.js';
import { decryptPassword } from '../utils/cryptoUtils.js';
// ───────────────────────────── constants ──────────────────────────────
const BASE_URL = 'https://rest.smsportal.com';
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // cache token for 23 h (expires at 24 h)
const MAX_BULK_SIZE = 500;
// ───────────────────────── in-memory token cache ─────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;
// ───────────────────────── credential helpers ────────────────────────
/**
 * Reads SMS Portal Client ID + Secret from the `credentials` table.
 *
 * Supports three layouts:
 *  1. Two separate rows: `SMS KEY` (clientId) + `SMS SECRET` (secret)
 *  2. Single row `SMS` with `credential_value` = "clientId:secret"
 *  3. Single row `SMS` with `credential_value` = clientId, `additional_data.secret` = secret
 *
 * If a value looks AES-256-GCM encrypted (iv:tag:cipher — three hex
 * segments each ≥ 32 chars) it will be decrypted first.
 */
async function getCredentials() {
    // ── Layout 1: two separate rows (SMS KEY + SMS SECRET) ──
    const keyRow = await db.queryOne(`SELECT credential_value FROM credentials
      WHERE service_name = 'SMS KEY' AND is_active = 1 LIMIT 1`);
    const secretRow = await db.queryOne(`SELECT credential_value FROM credentials
      WHERE service_name = 'SMS SECRET' AND is_active = 1 LIMIT 1`);
    if (keyRow?.credential_value && secretRow?.credential_value) {
        const clientId = decrypt(keyRow.credential_value);
        const secret = decrypt(secretRow.credential_value);
        return { clientId, secret };
    }
    // ── Fallback: single row with service_name = 'SMS' ──
    const row = await db.queryOne(`SELECT credential_value, additional_data
       FROM credentials
      WHERE service_name = 'SMS' AND is_active = 1
      LIMIT 1`);
    if (!row?.credential_value) {
        throw new Error('[SMS] No active SMS credentials found. Expected rows with service_name ' +
            "'SMS KEY' + 'SMS SECRET', or a single 'SMS' row.");
    }
    let raw = decrypt(row.credential_value);
    // "clientId:secret" stored as a single value
    if (raw.includes(':')) {
        const [clientId, ...rest] = raw.split(':');
        return { clientId, secret: rest.join(':') };
    }
    // clientId in credential_value, secret in additional_data JSON
    const extra = typeof row.additional_data === 'string'
        ? JSON.parse(row.additional_data)
        : row.additional_data;
    const secret = extra?.secret ? decrypt(extra.secret) : '';
    if (!secret) {
        throw new Error('[SMS] API secret not found. Store it as a separate credentials row ' +
            "with service_name = 'SMS SECRET', or in the SMS row's additional_data.");
    }
    return { clientId: raw, secret };
}
/** Decrypt a value if it looks AES-256-GCM encrypted, otherwise return as-is. */
function decrypt(val) {
    const parts = val.split(':');
    if (parts.length === 3 && parts.every((p) => /^[0-9a-f]{16,}$/i.test(p))) {
        const result = decryptPassword(val);
        if (!result)
            throw new Error(`[SMS] Failed to decrypt value starting with ${val.slice(0, 12)}…`);
        return result;
    }
    return val;
}
// ───────────────────────── authentication ────────────────────────────
/**
 * Returns a cached auth token or fetches a fresh one from SMSPortal.
 * Tokens are valid for 24 h; we re-fetch after 23 h.
 */
async function getAuthToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }
    const { clientId, secret } = await getCredentials();
    const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
    try {
        const res = await axios.get(`${BASE_URL}/Authentication`, {
            headers: {
                Authorization: `Basic ${basic}`,
                Accept: 'application/json',
            },
            timeout: 15_000,
        });
        const token = res.data?.token ?? res.data;
        if (!token || typeof token !== 'string') {
            throw new Error('[SMS] Authentication response did not contain a token');
        }
        cachedToken = token;
        tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
        console.log('[SMS] Auth token refreshed — expires in 23 h');
        // Update last_used_at on the credentials row
        await db.execute('UPDATE credentials SET last_used_at = NOW() WHERE service_name = ? AND is_active = 1', ['SMS']).catch(() => { });
        return token;
    }
    catch (err) {
        cachedToken = null;
        tokenExpiresAt = 0;
        const msg = err instanceof AxiosError
            ? `${err.response?.status} — ${JSON.stringify(err.response?.data)}`
            : String(err);
        throw new Error(`[SMS] Authentication failed: ${msg}`);
    }
}
/**
 * Force-invalidate the cached token (e.g. on 401 retry).
 */
export function invalidateToken() {
    cachedToken = null;
    tokenExpiresAt = 0;
}
// ───────────────────────── phone normalisation ───────────────────────
/**
 * Normalise a South African phone number to E.164 (no +).
 * Accepts: 0821234567 | +27821234567 | 27821234567
 * Returns: "27821234567"
 */
export function normalisePhone(phone) {
    let cleaned = phone.replace(/[\s\-()]/g, '');
    // Strip leading +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.slice(1);
    }
    // Convert local 0-prefix to 27
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = `27${cleaned.slice(1)}`;
    }
    return cleaned;
}
// ──────────────────────────── send SMS ───────────────────────────────
/**
 * Send one or more SMS messages via SMSPortal Bulk Messages API.
 *
 * @param messages  Array of { destination, content } — max 500 per call.
 * @param options   Optional send options (testMode, campaignName, etc.).
 * @returns         The parsed API response.
 */
export async function sendBulkSms(messages, options = {}) {
    if (!messages.length)
        throw new Error('[SMS] messages array is empty');
    if (messages.length > MAX_BULK_SIZE) {
        throw new Error(`[SMS] Max ${MAX_BULK_SIZE} messages per request (got ${messages.length})`);
    }
    // Normalise destination numbers
    const normalisedMessages = messages.map((m) => ({
        content: m.content,
        destination: normalisePhone(m.destination),
    }));
    // Build request body
    const body = {
        messages: normalisedMessages,
    };
    // Attach sendOptions only when at least one option is set
    const sendOptions = {};
    if (options.testMode)
        sendOptions.testMode = true;
    if (options.campaignName)
        sendOptions.campaignName = options.campaignName;
    if (options.scheduledDelivery)
        sendOptions.scheduledDelivery = options.scheduledDelivery;
    if (options.duplicateCheck)
        sendOptions.duplicateCheck = true;
    if (Object.keys(sendOptions).length)
        body.sendOptions = sendOptions;
    const token = await getAuthToken();
    try {
        const res = await axios.post(`${BASE_URL}/v3/BulkMessages`, body, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            timeout: 30_000,
        });
        const result = res.data;
        console.log(`[SMS] Sent ${normalisedMessages.length} message(s) — ` +
            `cost: ${result.costInCredits ?? '?'} credits, eventId: ${result.eventId ?? 'n/a'}`);
        // Log to database (fire-and-forget)
        logSmsSend(normalisedMessages, result, options).catch(() => { });
        return result;
    }
    catch (err) {
        // Retry once on 401 (expired/invalidated token)
        if (err instanceof AxiosError && err.response?.status === 401) {
            console.warn('[SMS] Token expired mid-flight — refreshing and retrying');
            invalidateToken();
            const freshToken = await getAuthToken();
            const retryRes = await axios.post(`${BASE_URL}/v3/BulkMessages`, body, {
                headers: {
                    Authorization: `Bearer ${freshToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                timeout: 30_000,
            });
            const retryResult = retryRes.data;
            logSmsSend(normalisedMessages, retryResult, options).catch(() => { });
            return retryResult;
        }
        const msg = err instanceof AxiosError
            ? `${err.response?.status} — ${JSON.stringify(err.response?.data)}`
            : String(err);
        console.error(`[SMS] Send failed: ${msg}`);
        throw new Error(`[SMS] Send failed: ${msg}`);
    }
}
/**
 * Convenience wrapper: send a single SMS.
 */
export async function sendSms(destination, content, options = {}) {
    return sendBulkSms([{ destination, content }], options);
}
// ─────────────────────────── balance ─────────────────────────────────
/**
 * Retrieve the current SMS credit balance from SMSPortal.
 */
export async function getBalance() {
    const token = await getAuthToken();
    try {
        const res = await axios.get(`${BASE_URL}/Balance`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            timeout: 15_000,
        });
        return res.data;
    }
    catch (err) {
        const msg = err instanceof AxiosError
            ? `${err.response?.status} — ${JSON.stringify(err.response?.data)}`
            : String(err);
        throw new Error(`[SMS] Balance check failed: ${msg}`);
    }
}
// ──────────────────────────── logging ────────────────────────────────
/**
 * Persist a send event to the `sms_log` table (created lazily).
 */
async function logSmsSend(messages, result, options) {
    try {
        // Ensure the log table exists
        await db.execute(`
      CREATE TABLE IF NOT EXISTS sms_log (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        event_id    VARCHAR(100)  NULL,
        destination VARCHAR(30)   NOT NULL,
        content     TEXT          NOT NULL,
        status      VARCHAR(50)   NULL,
        error_code  VARCHAR(100)  NULL,
        credits     DECIMAL(10,4) NULL,
        test_mode   TINYINT       NOT NULL DEFAULT 0,
        campaign    VARCHAR(200)  NULL,
        raw_response JSON         NULL,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sms_event (event_id),
        INDEX idx_sms_dest  (destination),
        INDEX idx_sms_date  (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
        // Insert one row per message
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const msgResult = result.messages?.[i];
            await db.execute(`INSERT INTO sms_log
           (event_id, destination, content, status, error_code, credits, test_mode, campaign, raw_response)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                result.eventId ?? null,
                msg.destination,
                msg.content,
                msgResult?.status ?? null,
                msgResult?.errorCode ?? null,
                result.costInCredits ?? null,
                options.testMode ? 1 : 0,
                options.campaignName ?? null,
                JSON.stringify(msgResult ?? null),
            ]);
        }
    }
    catch (err) {
        console.error('[SMS] Failed to log SMS send:', err);
    }
}
// ─────────────────────────── exports ─────────────────────────────────
export const smsService = {
    sendSms,
    sendBulkSms,
    getBalance,
    normalisePhone,
    invalidateToken,
};
