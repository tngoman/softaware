/**
 * Migration 016 — WebAuthn credentials + User sessions
 *
 * Adds:
 *   1. webauthn_credentials table — stores passkey / biometric credential data
 *   2. user_sessions table — tracks active JWT sessions with device info
 */
import { db } from '../mysql.js';
async function tableExists(tableName) {
    const rows = await db.query(`SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`, [tableName]);
    return rows[0]?.cnt > 0;
}
export async function up() {
    console.log('Running migration 016 — WebAuthn + Sessions...');
    // ──────────────────────────────────────────────────────
    // 1. WebAuthn credentials table
    // ──────────────────────────────────────────────────────
    if (!(await tableExists('webauthn_credentials'))) {
        await db.execute(`
      CREATE TABLE webauthn_credentials (
        id              VARCHAR(255)  NOT NULL PRIMARY KEY,
        user_id         VARCHAR(36)   NOT NULL,
        public_key      TEXT          NOT NULL,
        counter         BIGINT UNSIGNED NOT NULL DEFAULT 0,
        device_type     VARCHAR(50)   NULL,
        backed_up       TINYINT(1)    NOT NULL DEFAULT 0,
        transports      JSON          NULL,
        friendly_name   VARCHAR(100)  NULL,
        created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at    DATETIME      NULL,
        INDEX idx_wac_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ webauthn_credentials');
    }
    else {
        console.log('  ⏭️  webauthn_credentials already exists');
    }
    // ──────────────────────────────────────────────────────
    // 2. User sessions table
    // ──────────────────────────────────────────────────────
    if (!(await tableExists('user_sessions'))) {
        await db.execute(`
      CREATE TABLE user_sessions (
        id              VARCHAR(36)   NOT NULL PRIMARY KEY,
        user_id         VARCHAR(36)   NOT NULL,
        token_hash      VARCHAR(64)   NOT NULL,
        device_info     VARCHAR(500)  NULL,
        ip_address      VARCHAR(45)   NULL,
        user_agent      VARCHAR(500)  NULL,
        last_active_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at      DATETIME      NOT NULL,
        revoked_at      DATETIME      NULL,
        INDEX idx_us_user (user_id),
        INDEX idx_us_token (token_hash),
        INDEX idx_us_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        console.log('  ✅ user_sessions');
    }
    else {
        console.log('  ⏭️  user_sessions already exists');
    }
    console.log('Migration 016 complete ✅');
}
