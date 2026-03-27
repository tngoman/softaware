/**
 * Credential Vault — Centralised encrypted credential reader
 *
 * All API keys, passwords, and secrets are stored in the `credentials` table
 * and encrypted with AES-256-GCM (via cryptoUtils).  Services call this
 * module instead of reading raw `process.env` values.
 *
 * Convention per service row:
 *   service_name      = 'OPENROUTER' | 'GLM' | 'SMTP' | 'FIREBASE' | …
 *   credential_value  = encrypted primary secret (API key / password)
 *   additional_data   = JSON with supplementary fields (each value encrypted)
 *
 * A 5-minute in-memory cache avoids hitting the DB on every request.
 * Call `invalidateCache()` after credential rotation.
 */

import { db } from '../db/mysql.js';
import { decryptPassword } from '../utils/cryptoUtils.js';
import { env } from '../config/env.js';

// ──────────────────────────── cache ──────────────────────────────────
interface CachedCredential {
  value: string;
  data: Record<string, string> | null;
  fetchedAt: number;
}

const cache = new Map<string, CachedCredential | null>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ──────────────────────────── helpers ────────────────────────────────

/** Try to decrypt; if it fails treat the value as plaintext (migration period). */
function tryDecrypt(cipher: string): string {
  if (!cipher) return '';
  // Encrypted values always have the format  iv:authTag:ciphertext  (hex:hex:hex)
  if (/^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(cipher)) {
    try {
      return decryptPassword(cipher) ?? cipher;
    } catch {
      return cipher;
    }
  }
  return cipher; // plaintext
}

function parseAdditionalData(raw: unknown): Record<string, string> | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'string' ? tryDecrypt(v) : String(v);
    }
    return out;
  } catch {
    return null;
  }
}

// ──────────────────────────── public API ─────────────────────────────

export interface VaultEntry {
  /** The primary (decrypted) secret — e.g. API key, password */
  value: string;
  /** Supplementary fields from additional_data (each decrypted) */
  data: Record<string, string> | null;
}

/**
 * Retrieve a credential by `service_name`.
 * Returns `null` if the service is not stored in the vault.
 */
export async function getCredential(serviceName: string): Promise<VaultEntry | null> {
  // ── cache hit ──
  const cached = cache.get(serviceName);
  if (cached !== undefined && cached !== null && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { value: cached.value, data: cached.data };
  }
  if (cached === null && cache.has(serviceName)) {
    // We cached a "not found" — honour it briefly (1 min)
    return null;
  }

  // ── DB lookup ──
  try {
    const row = await db.queryOne<any>(
      `SELECT credential_value, additional_data
         FROM credentials
        WHERE service_name = ? AND is_active = 1
        ORDER BY id DESC LIMIT 1`,
      [serviceName],
    );

    if (!row || !row.credential_value) {
      // Cache the miss for 1 minute so we don't hammer the DB
      cache.set(serviceName, null);
      setTimeout(() => cache.delete(serviceName), 60_000);
      return null;
    }

    const value = tryDecrypt(row.credential_value);
    const data = parseAdditionalData(row.additional_data);

    const entry: CachedCredential = { value, data, fetchedAt: Date.now() };
    cache.set(serviceName, entry);
    return { value, data };
  } catch (err) {
    console.error(`[Vault] Failed to fetch credential for "${serviceName}":`, err);
    return null;
  }
}

/**
 * Convenience — get just the primary secret, with an env-var fallback.
 *
 * During migration the DB may not yet contain the credential, so the
 * caller provides the current env value as a safety net.
 */
export async function getSecret(serviceName: string, envFallback?: string): Promise<string> {
  const cred = await getCredential(serviceName);
  return cred?.value || envFallback || '';
}

/**
 * Get SMTP configuration.  Returns a ready-to-use object for nodemailer.
 */
export async function getSmtpConfig(): Promise<{
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}> {
  const cred = await getCredential('SMTP');
  if (cred) {
    return {
      host: cred.data?.host || env.SMTP_HOST || 'localhost',
      port: parseInt(cred.data?.port || String(env.SMTP_PORT) || '587', 10),
      secure: cred.data?.secure === 'true',
      user: cred.data?.user || env.SMTP_USER || '',
      pass: cred.value || env.SMTP_PASS || '',
      from: cred.data?.from || env.SMTP_FROM || 'noreply@softaware.net.za',
    };
  }
  // Fallback to env
  return {
    host: env.SMTP_HOST || 'localhost',
    port: typeof env.SMTP_PORT === 'number' ? env.SMTP_PORT : parseInt(String(env.SMTP_PORT) || '587', 10),
    secure: env.SMTP_SECURE === true,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.SMTP_FROM || 'noreply@softaware.net.za',
  };
}

/**
 * Get Firebase credentials.
 */
export async function getFirebaseConfig(): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null> {
  const cred = await getCredential('FIREBASE');
  if (cred) {
    return {
      projectId: cred.data?.project_id || env.FIREBASE_PROJECT_ID || '',
      clientEmail: cred.data?.client_email || env.FIREBASE_CLIENT_EMAIL || '',
      privateKey: (cred.value || env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    };
  }
  // Fallback to env
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  return null;
}

/**
 * Get PayFast credentials.
 */
export async function getPayFastConfig(): Promise<{
  merchantId: string;
  merchantKey: string;
  passphrase: string;
} | null> {
  const cred = await getCredential('PAYFAST');
  if (cred) {
    return {
      merchantId: cred.data?.merchant_id || '',
      merchantKey: cred.value || '',
      passphrase: cred.data?.passphrase || '',
    };
  }
  // Fallback to env
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  if (merchantId && merchantKey) {
    return {
      merchantId,
      merchantKey,
      passphrase: process.env.PAYFAST_PASSPHRASE || '',
    };
  }
  return null;
}

/**
 * Get Yoco credentials (legacy — single key, no mode awareness).
 * @deprecated Use getYocoActiveConfig() for mode-aware credential lookup.
 */
export async function getYocoConfig(): Promise<{
  secretKey: string;
  webhookSecret: string;
} | null> {
  const cred = await getCredential('YOCO');
  if (cred) {
    return {
      secretKey: cred.value || '',
      webhookSecret: cred.data?.webhook_secret || '',
    };
  }
  // Fallback to env
  const secretKey = process.env.YOCO_SECRET_KEY;
  if (secretKey) {
    return {
      secretKey,
      webhookSecret: process.env.YOCO_WEBHOOK_SECRET || '',
    };
  }
  return null;
}

// ─── Yoco Mode-Aware Config ──────────────────────────────────────────

export interface YocoConfig {
  mode: 'live' | 'test';
  secretKey: string;
  webhookSecret: string;
}

/**
 * Get the active Yoco configuration based on the `yoco_mode` sys_setting.
 *
 * Resolution order:
 *   1. Mode-specific credential from vault ('Yoco Live' or 'Yoco Test')
 *      — specifically the secret/private key row (identifier: PrivateKey / SecretLive)
 *   2. Legacy single credential  (YOCO)
 *   3. Environment variables     (YOCO_SECRET_KEY / YOCO_WEBHOOK_SECRET)
 *
 * Returns `null` if no Yoco credentials are configured at all.
 */
export async function getYocoActiveConfig(): Promise<YocoConfig | null> {
  // 1. Read mode from sys_settings (default: test for safety)
  const modeRow = await db.queryOne<any>(
    "SELECT `value` FROM sys_settings WHERE `key` = 'yoco_mode'",
  );
  const mode: 'live' | 'test' = modeRow?.value === 'live' ? 'live' : 'test';

  // 2. Fetch secret key from vault using actual service names
  const secretKey = await getYocoSecretKeyForMode(mode);
  if (secretKey) {
    // Also try to find webhook secret from additional_data (if stored)
    const serviceName = mode === 'live' ? 'Yoco Live' : 'Yoco Test';
    const webhookRow = await db.queryOne<any>(
      `SELECT additional_data FROM credentials
       WHERE service_name = ? AND is_active = 1 AND additional_data IS NOT NULL
       ORDER BY id DESC LIMIT 1`,
      [serviceName],
    );
    const webhookSecret = webhookRow?.additional_data
      ? (parseAdditionalData(webhookRow.additional_data) as any)?.webhook_secret || ''
      : '';

    return { mode, secretKey, webhookSecret };
  }

  // 3. Fallback to legacy single 'YOCO' credential
  const legacy = await getCredential('YOCO');
  if (legacy?.value) {
    return {
      mode,
      secretKey: legacy.value,
      webhookSecret: legacy.data?.webhook_secret || '',
    };
  }

  // 4. Env var fallback
  const envKey = process.env.YOCO_SECRET_KEY;
  if (envKey) {
    return {
      mode,
      secretKey: envKey,
      webhookSecret: process.env.YOCO_WEBHOOK_SECRET || '',
    };
  }

  return null;
}

/**
 * Fetch the Yoco secret (private) key for a given mode from the vault.
 *
 * Vault layout:
 *   service_name='Yoco Test', identifier='PrivateKey'  → test secret key
 *   service_name='Yoco Live', identifier='SecretLive'   → live secret key
 */
export async function getYocoSecretKeyForMode(mode: 'live' | 'test'): Promise<string | null> {
  const serviceName = mode === 'live' ? 'Yoco Live' : 'Yoco Test';
  const identifiers = mode === 'live' ? ['SecretLive', 'PrivateKey'] : ['PrivateKey', 'SecretLive'];

  for (const identifier of identifiers) {
    const row = await db.queryOne<any>(
      `SELECT credential_value FROM credentials
       WHERE service_name = ? AND identifier = ? AND is_active = 1
       LIMIT 1`,
      [serviceName, identifier],
    );
    if (row?.credential_value) {
      return tryDecrypt(row.credential_value);
    }
  }

  // Fallback: any credential for this service (ORDER BY id DESC picks the secret key
  // since it was inserted after the public key)
  const fallback = await getCredential(serviceName);
  return fallback?.value || null;
}

/**
 * Get GitHub Personal Access Token for authenticated git operations.
 * Falls back to GITHUB_TOKEN env var during migration.
 */
export async function getGitHubToken(): Promise<string> {
  return getSecret('Github', process.env.GITHUB_TOKEN);
}

/**
 * Invalidate cache — call after credential rotation/update.
 */
export function invalidateCache(serviceName?: string): void {
  if (serviceName) {
    cache.delete(serviceName);
  } else {
    cache.clear();
  }
}
