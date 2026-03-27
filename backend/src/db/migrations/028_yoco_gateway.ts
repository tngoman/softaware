/**
 * Migration 028 — Yoco Payment Gateway
 *
 * Creates:
 *   - yoco_checkouts        – tracks every Yoco checkout session
 *   - yoco_refunds          – tracks refund requests
 *   - sys_settings row      – yoco_mode (live | test)
 *
 * Alters:
 *   - contact_packages.payment_provider  → adds 'STRIPE' to ENUM
 */

import { pool } from '../mysql.js';

export async function up(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. yoco_checkouts ────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS yoco_checkouts (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        checkout_id       VARCHAR(255) NOT NULL UNIQUE     COMMENT 'Yoco checkout ID from API response',
        contact_id        INT NOT NULL,
        user_id           VARCHAR(36) NOT NULL,
        package_id        INT NULL,
        action            VARCHAR(50) NOT NULL             COMMENT 'SUBSCRIBE|UPGRADE|TOPUP|WIDGET_UPGRADE|SITE_UPGRADE|ENTERPRISE',
        amount            INT NOT NULL                     COMMENT 'ZAR cents',
        currency          VARCHAR(3) NOT NULL DEFAULT 'ZAR',
        mode              ENUM('live','test') NOT NULL,
        status            ENUM('pending','completed','failed','expired','cancelled','abandoned') NOT NULL DEFAULT 'pending',
        payment_id        VARCHAR(255) NULL                COMMENT 'Yoco payment ID from webhook',
        metadata          JSON NULL                        COMMENT 'Full metadata sent to Yoco',
        redirect_url      TEXT NULL,
        success_url       TEXT NULL,
        cancel_url        TEXT NULL,
        failure_url       TEXT NULL,
        invoice_id        INT NULL                         COMMENT 'Generated invoice ID after payment',
        poll_count        INT NOT NULL DEFAULT 0,
        next_poll_at      DATETIME NULL,
        completed_at      DATETIME NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_yc_status (status),
        INDEX idx_yc_contact (contact_id),
        INDEX idx_yc_poll (status, next_poll_at),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ── 2. yoco_refunds ─────────────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS yoco_refunds (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        checkout_id       VARCHAR(255) NOT NULL,
        refund_id         VARCHAR(255) NULL UNIQUE         COMMENT 'Yoco refund ID',
        contact_id        INT NOT NULL,
        amount            INT NOT NULL                     COMMENT 'Refund amount in ZAR cents',
        status            ENUM('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
        reason            VARCHAR(500) NULL,
        mode              ENUM('live','test') NOT NULL,
        idempotency_key   VARCHAR(255) NULL,
        created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME NULL,

        INDEX idx_yr_checkout (checkout_id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ── 3. Extend contact_packages.payment_provider ENUM ────────────
    // MySQL allows adding a new ENUM value without data loss.
    try {
      await conn.query(`
        ALTER TABLE contact_packages
          MODIFY COLUMN payment_provider ENUM('PAYFAST','YOCO','MANUAL','STRIPE') DEFAULT 'MANUAL'
      `);
    } catch (e: any) {
      // If column already has the right ENUM, this is fine
      console.log('[Migration 028] payment_provider ENUM alter skipped (already correct?):', e.message);
    }

    // ── 4. Seed sys_settings for yoco_mode ──────────────────────────
    await conn.query(`
      INSERT INTO sys_settings (\`key\`, \`value\`, \`type\`, \`description\`, \`is_public\`, created_at)
      VALUES ('yoco_mode', 'test', 'string', 'Yoco payment gateway mode: live or test', 0, NOW())
      ON DUPLICATE KEY UPDATE \`value\` = \`value\`
    `);

    await conn.commit();
    console.log('[Migration 028] Yoco gateway tables created successfully');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function down(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DROP TABLE IF EXISTS yoco_refunds');
    await conn.query('DROP TABLE IF EXISTS yoco_checkouts');
    await conn.query("DELETE FROM sys_settings WHERE `key` = 'yoco_mode'");
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
