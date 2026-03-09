/**
 * Migration 019 — Assistant Capabilities: Form Submissions
 *
 * Creates the `form_submissions` table to store contact form submissions
 * from generated websites. Previously submissions were only emailed to
 * site owners and never persisted — this table closes that gap so the
 * AI assistant can list, discuss, and act on leads.
 *
 * Also adds `tool_preferences` JSON column to the `assistants` table
 * for future per-assistant tool configuration.
 */

import { db } from '../mysql.js';

export async function up(): Promise<void> {
  console.log('[Migration 019] Creating form_submissions table...');

  // ── form_submissions ────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id              VARCHAR(36)     NOT NULL PRIMARY KEY,
      site_id         VARCHAR(36)     NOT NULL,
      sender_name     VARCHAR(255)    NOT NULL,
      sender_email    VARCHAR(255)    NOT NULL,
      sender_phone    VARCHAR(50)     NULL,
      message         TEXT            NOT NULL,
      source_page     VARCHAR(500)    NULL,
      ip_address      VARCHAR(45)     NULL,
      honeypot_triggered TINYINT(1)   NOT NULL DEFAULT 0,
      status          ENUM('new','contacted','converted','spam') NOT NULL DEFAULT 'new',
      notes           TEXT            NULL,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_fs_site_id    (site_id),
      INDEX idx_fs_status     (status),
      INDEX idx_fs_created_at (created_at),
      INDEX idx_fs_email      (sender_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Add tool_preferences to assistants ──────────────────────────
  try {
    await db.execute(`
      ALTER TABLE assistants
        ADD COLUMN tool_preferences JSON NULL AFTER personality_flare
    `);
    console.log('[Migration 019] Added tool_preferences column to assistants');
  } catch (err: any) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('[Migration 019] tool_preferences column already exists, skipping');
    } else {
      throw err;
    }
  }

  console.log('[Migration 019] ✅ form_submissions table created');
}

export async function down(): Promise<void> {
  console.log('[Migration 019] Rolling back...');
  await db.execute('DROP TABLE IF EXISTS form_submissions');

  try {
    await db.execute('ALTER TABLE assistants DROP COLUMN tool_preferences');
  } catch {
    // Column may not exist
  }

  console.log('[Migration 019] ✅ Rollback complete');
}
