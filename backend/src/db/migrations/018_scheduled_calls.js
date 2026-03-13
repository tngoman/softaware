/**
 * Migration 018 — Scheduled Calls
 *
 * Adds the `scheduled_calls` table for scheduling voice/video calls
 * with screen sharing support within staff-chat conversations.
 *
 * Table: scheduled_calls
 *   - Linked to conversations and created by a user
 *   - Supports voice/video with optional screen_share flag
 *   - Recurring schedule support (daily/weekly/monthly)
 *   - Status lifecycle: scheduled → active → completed / cancelled
 *   - Invited participants tracked via scheduled_call_participants
 */
import { db } from '../mysql.js';
export async function up() {
    console.log('[Migration 018] Creating scheduled_calls tables...');
    // ── scheduled_calls ─────────────────────────────────────────────
    await db.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_calls (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      conversation_id BIGINT UNSIGNED NOT NULL,
      created_by      VARCHAR(36)     NOT NULL,
      title           VARCHAR(255)    NOT NULL,
      description     TEXT            NULL,
      call_type       ENUM('voice','video') NOT NULL DEFAULT 'video',
      screen_share    TINYINT(1)      NOT NULL DEFAULT 0,
      scheduled_at    DATETIME        NOT NULL,
      duration_minutes INT UNSIGNED   NOT NULL DEFAULT 30,
      recurrence      ENUM('none','daily','weekly','biweekly','monthly') NOT NULL DEFAULT 'none',
      recurrence_end  DATETIME        NULL,
      status          ENUM('scheduled','active','completed','cancelled') NOT NULL DEFAULT 'scheduled',
      call_session_id BIGINT UNSIGNED NULL,
      reminder_sent   TINYINT(1)      NOT NULL DEFAULT 0,
      created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_conversation  (conversation_id),
      INDEX idx_created_by    (created_by),
      INDEX idx_scheduled_at  (scheduled_at),
      INDEX idx_status        (status),
      INDEX idx_reminder      (status, reminder_sent, scheduled_at),

      CONSTRAINT fk_scheduled_calls_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      CONSTRAINT fk_scheduled_calls_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_scheduled_calls_session
        FOREIGN KEY (call_session_id) REFERENCES call_sessions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    // ── scheduled_call_participants ─────────────────────────────────
    await db.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_call_participants (
      id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      scheduled_call_id BIGINT UNSIGNED NOT NULL,
      user_id           VARCHAR(36)     NOT NULL,
      rsvp              ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
      created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY uq_call_user (scheduled_call_id, user_id),
      INDEX idx_user (user_id),

      CONSTRAINT fk_scp_call
        FOREIGN KEY (scheduled_call_id) REFERENCES scheduled_calls(id) ON DELETE CASCADE,
      CONSTRAINT fk_scp_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 018] ✅ scheduled_calls tables created');
}
export async function down() {
    await db.execute('DROP TABLE IF EXISTS scheduled_call_participants');
    await db.execute('DROP TABLE IF EXISTS scheduled_calls');
    console.log('[Migration 018] ✅ scheduled_calls tables dropped');
}
