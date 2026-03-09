#!/usr/bin/env node
/**
 * seed-credentials.ts
 *
 * One-time migration script: reads secrets from .env and inserts them into the
 * `credentials` table with AES-256-GCM encryption.
 *
 * Run:  npx tsx scripts/seed-credentials.ts
 *
 * Idempotent — skips any service_name that already exists in the table.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

// ── Encryption (same algo as src/utils/cryptoUtils.ts) ──────────────
const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY
  ? Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex')
  : null;

if (!MASTER_KEY) {
  console.error('❌  ENCRYPTION_MASTER_KEY is not set. Cannot encrypt credentials.');
  process.exit(1);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY!, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;
}

// ── DB connection (same parsing as src/db/mysql.ts) ─────────────────
function parseUrl(url: string) {
  const m = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!m) throw new Error('Invalid DATABASE_URL');
  return { user: m[1], password: m[2], host: m[3], port: +m[4], database: m[5] };
}

// ── Credential definitions ──────────────────────────────────────────
interface SeedRow {
  service_name: string;
  credential_type: string;
  /** The primary secret (will be encrypted) */
  credential_value: string;
  /** Extra fields — each value will be encrypted */
  additional_data?: Record<string, string>;
  environment: string;
  notes: string;
}

function envVal(key: string): string {
  return process.env[key] || '';
}

function buildSeeds(): SeedRow[] {
  const seeds: SeedRow[] = [];

  // ── SMTP ──────────────────────────────────────────────────────────
  if (envVal('SMTP_PASS')) {
    seeds.push({
      service_name: 'SMTP',
      credential_type: 'password',
      credential_value: envVal('SMTP_PASS'),
      additional_data: {
        host: envVal('SMTP_HOST'),
        port: envVal('SMTP_PORT') || '587',
        user: envVal('SMTP_USER'),
        from: envVal('SMTP_FROM'),
        secure: envVal('SMTP_SECURE') || 'false',
      },
      environment: 'production',
      notes: 'SMTP mail relay credentials (mail.login.net.za)',
    });
  }

  // ── OpenRouter ────────────────────────────────────────────────────
  if (envVal('OPENROUTER_API_KEY')) {
    seeds.push({
      service_name: 'OPENROUTER',
      credential_type: 'api_key',
      credential_value: envVal('OPENROUTER_API_KEY'),
      environment: 'production',
      notes: 'OpenRouter API — vision + ingestion routing',
    });
  }

  // ── GLM (ZhipuAI) ────────────────────────────────────────────────
  if (envVal('GLM')) {
    seeds.push({
      service_name: 'GLM',
      credential_type: 'api_key',
      credential_value: envVal('GLM'),
      environment: 'production',
      notes: 'GLM (ZhipuAI) API key via z.ai',
    });
  }

  // ── Gemini ────────────────────────────────────────────────────────
  if (envVal('Gemini')) {
    seeds.push({
      service_name: 'GEMINI',
      credential_type: 'api_key',
      credential_value: envVal('Gemini'),
      environment: 'production',
      notes: 'Google Gemini API key',
    });
  }

  // ── OpenAI ────────────────────────────────────────────────────────
  if (envVal('OPENAI')) {
    seeds.push({
      service_name: 'OPENAI',
      credential_type: 'api_key',
      credential_value: envVal('OPENAI'),
      environment: 'production',
      notes: 'OpenAI API key (GPT-4o-mini)',
    });
  }

  // ── AWS Bedrock ───────────────────────────────────────────────────
  if (envVal('AWS_SECRET_ACCESS_KEY')) {
    seeds.push({
      service_name: 'AWS',
      credential_type: 'api_key',
      credential_value: envVal('AWS_SECRET_ACCESS_KEY'),
      additional_data: {
        access_key_id: envVal('AWS_ACCESS_KEY_ID'),
        region: envVal('AWS_REGION') || 'eu-west-1',
        bedrock_model: envVal('AWS_BEDROCK_MODEL') || 'eu.amazon.nova-lite-v1:0',
        encoded_key: envVal('AWS'),
      },
      environment: 'production',
      notes: 'AWS Bedrock credentials',
    });
  }

  // ── Anthropic / z.ai proxy ────────────────────────────────────────
  if (envVal('ANTHROPIC_AUTH_TOKEN')) {
    seeds.push({
      service_name: 'ANTHROPIC',
      credential_type: 'token',
      credential_value: envVal('ANTHROPIC_AUTH_TOKEN'),
      additional_data: {
        base_url: envVal('ANTHROPIC_BASE_URL') || 'https://api.z.ai/api/anthropic',
      },
      environment: 'production',
      notes: 'Anthropic-compatible endpoint via z.ai GLM proxy',
    });
  }

  // ── Firebase FCM ──────────────────────────────────────────────────
  if (envVal('FIREBASE_PRIVATE_KEY')) {
    seeds.push({
      service_name: 'FIREBASE',
      credential_type: 'certificate',
      credential_value: envVal('FIREBASE_PRIVATE_KEY'),
      additional_data: {
        project_id: envVal('FIREBASE_PROJECT_ID'),
        client_email: envVal('FIREBASE_CLIENT_EMAIL'),
      },
      environment: 'production',
      notes: 'Firebase Admin SDK — FCM push notifications',
    });
  }

  // ── PayFast ───────────────────────────────────────────────────────
  if (envVal('PAYFAST_MERCHANT_KEY')) {
    seeds.push({
      service_name: 'PAYFAST',
      credential_type: 'api_key',
      credential_value: envVal('PAYFAST_MERCHANT_KEY'),
      additional_data: {
        merchant_id: envVal('PAYFAST_MERCHANT_ID'),
        passphrase: envVal('PAYFAST_PASSPHRASE'),
      },
      environment: 'production',
      notes: 'PayFast payment gateway merchant credentials',
    });
  }

  // ── Yoco ──────────────────────────────────────────────────────────
  if (envVal('YOCO_SECRET_KEY')) {
    seeds.push({
      service_name: 'YOCO',
      credential_type: 'api_key',
      credential_value: envVal('YOCO_SECRET_KEY'),
      additional_data: {
        webhook_secret: envVal('YOCO_WEBHOOK_SECRET'),
      },
      environment: 'production',
      notes: 'Yoco checkout API — South African card payments',
    });
  }

  // ── Traccar ───────────────────────────────────────────────────────
  if (envVal('TRACCAR_PASSWORD')) {
    seeds.push({
      service_name: 'TRACCAR',
      credential_type: 'password',
      credential_value: envVal('TRACCAR_PASSWORD'),
      additional_data: {
        host: envVal('TRACCAR_HOST'),
        email: envVal('TRACCAR_EMAIL'),
      },
      environment: 'production',
      notes: 'Traccar fleet tracking login',
    });
  }

  // ── Forex API ─────────────────────────────────────────────────────
  if (envVal('FOREX')) {
    seeds.push({
      service_name: 'FOREX',
      credential_type: 'api_key',
      credential_value: envVal('FOREX'),
      environment: 'production',
      notes: 'ExchangeRate-API key for forex data',
    });
  }

  // ── NewsAPI ───────────────────────────────────────────────────────
  if (envVal('NEWSAPI')) {
    seeds.push({
      service_name: 'NEWSAPI',
      credential_type: 'api_key',
      credential_value: envVal('NEWSAPI'),
      environment: 'production',
      notes: 'NewsAPI key for market sentiment',
    });
  }

  // ── GNews ─────────────────────────────────────────────────────────
  if (envVal('GNEWS')) {
    seeds.push({
      service_name: 'GNEWS',
      credential_type: 'api_key',
      credential_value: envVal('GNEWS'),
      environment: 'production',
      notes: 'GNews API key (alternative news source)',
    });
  }

  return seeds;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌  DATABASE_URL not set');
    process.exit(1);
  }

  const cfg = parseUrl(dbUrl);
  const conn = await mysql.createConnection(cfg);

  console.log('🔐  Credential Vault — Seed Script');
  console.log('─'.repeat(50));

  const seeds = buildSeeds();
  let inserted = 0;
  let skipped = 0;

  for (const seed of seeds) {
    // Check if already exists
    const [existing] = await conn.query(
      'SELECT id FROM credentials WHERE service_name = ? LIMIT 1',
      [seed.service_name],
    ) as any[];

    if (existing && existing.length > 0) {
      console.log(`⏭  ${seed.service_name} — already exists (id ${existing[0].id}), skipping`);
      skipped++;
      continue;
    }

    // Encrypt the credential_value
    const encryptedValue = encrypt(seed.credential_value);

    // Encrypt each field in additional_data
    let encryptedAdditional: string | null = null;
    if (seed.additional_data) {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(seed.additional_data)) {
        obj[k] = v ? encrypt(v) : '';
      }
      encryptedAdditional = JSON.stringify(obj);
    }

    await conn.execute(
      `INSERT INTO credentials
         (service_name, credential_type, credential_value, additional_data, environment, is_active, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, 1)`,
      [
        seed.service_name,
        seed.credential_type,
        encryptedValue,
        encryptedAdditional,
        seed.environment,
        seed.notes,
      ],
    );

    console.log(`✅  ${seed.service_name} — inserted (${seed.credential_type})`);
    inserted++;
  }

  console.log('─'.repeat(50));
  console.log(`Done.  Inserted: ${inserted}  |  Skipped: ${skipped}  |  Total: ${seeds.length}`);

  await conn.end();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
