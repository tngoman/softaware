/**
 * Migration 026 — AI Telemetry Consent & Analytics
 *
 * 1. Adds telemetry consent columns to the MySQL `users` table:
 *    - telemetry_consent_accepted  TINYINT(1)  — has the user accepted the terms?
 *    - telemetry_opted_out         TINYINT(1)  — paid-tier opt-out from data logging
 *    - telemetry_consent_date      DATETIME    — when they accepted
 *
 * 2. Creates `ai_analytics_logs` table in the SQLite vectors.db
 *    for PII-sanitized chat telemetry.
 */

import { db } from '../mysql.js';

export async function up(): Promise<void> {
  console.log('[Migration 026] Adding telemetry consent columns to users...');

  // Check if columns already exist before adding
  const cols = await db.query<{ Field: string }>(
    `SHOW COLUMNS FROM users WHERE Field IN ('telemetry_consent_accepted', 'telemetry_opted_out', 'telemetry_consent_date')`
  );
  const existing = new Set(cols.map(c => c.Field));

  if (!existing.has('telemetry_consent_accepted')) {
    await db.execute(`
      ALTER TABLE users
        ADD COLUMN telemetry_consent_accepted TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Whether the user accepted the AI telemetry terms'
    `);
  }

  if (!existing.has('telemetry_opted_out')) {
    await db.execute(`
      ALTER TABLE users
        ADD COLUMN telemetry_opted_out TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Paid-tier users can opt out of anonymized data logging'
    `);
  }

  if (!existing.has('telemetry_consent_date')) {
    await db.execute(`
      ALTER TABLE users
        ADD COLUMN telemetry_consent_date DATETIME NULL DEFAULT NULL
        COMMENT 'When the user accepted telemetry terms'
    `);
  }

  console.log('[Migration 026] ✅ Users table updated with telemetry columns.');

  // SQLite table is created in the analyticsLogger service on first use
  // (keeps SQLite init in one place — vectorStore.ts pattern)
  console.log('[Migration 026] ✅ Done. SQLite ai_analytics_logs table will auto-create on first use.');
}

export async function down(): Promise<void> {
  await db.execute('ALTER TABLE users DROP COLUMN IF EXISTS telemetry_consent_accepted');
  await db.execute('ALTER TABLE users DROP COLUMN IF EXISTS telemetry_opted_out');
  await db.execute('ALTER TABLE users DROP COLUMN IF EXISTS telemetry_consent_date');
  console.log('[Migration 026] Dropped telemetry columns from users.');
}
