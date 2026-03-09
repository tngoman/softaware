/**
 * Migration 020 — Calendar Events
 *
 * Adds the `calendar_events` table — a unified calendar/schedule that aggregates:
 *   - Scheduled calls (from staff chat)
 *   - Email invitations (iCal/VEVENT parsed from webmail)
 *   - Manually created meetings & reminders
 *
 * Each event has a source_type indicating where it came from, plus optional
 * foreign keys back to the originating record (scheduled_call_id, email_uid, etc.)
 */

import { db } from '../mysql.js';

export async function up(): Promise<void> {
  console.log('[Migration 020] Creating calendar_events table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id          VARCHAR(36)     NOT NULL,
      title            VARCHAR(500)    NOT NULL,
      description      TEXT            NULL,
      location         VARCHAR(500)    NULL,
      event_type       ENUM('meeting','call','reminder','task','email_invite','other') NOT NULL DEFAULT 'meeting',
      source_type      ENUM('manual','scheduled_call','email_invite') NOT NULL DEFAULT 'manual',
      start_at         DATETIME        NOT NULL,
      end_at           DATETIME        NOT NULL,
      all_day          TINYINT(1)      NOT NULL DEFAULT 0,
      recurrence       ENUM('none','daily','weekly','biweekly','monthly') NOT NULL DEFAULT 'none',
      recurrence_end   DATETIME        NULL,
      status           ENUM('confirmed','tentative','cancelled','declined') NOT NULL DEFAULT 'confirmed',

      -- Links back to source records
      scheduled_call_id BIGINT UNSIGNED NULL,
      email_account_id  INT UNSIGNED    NULL,
      email_folder      VARCHAR(255)    NULL,
      email_uid         INT UNSIGNED    NULL,
      email_message_id  VARCHAR(500)    NULL,
      ical_uid          VARCHAR(500)    NULL,

      -- Organizer info (for email invites)
      organizer_name    VARCHAR(255)    NULL,
      organizer_email   VARCHAR(255)    NULL,

      -- Metadata
      color             VARCHAR(20)     NULL DEFAULT NULL,
      reminder_minutes  INT UNSIGNED    NULL DEFAULT 15,
      reminder_sent     TINYINT(1)      NOT NULL DEFAULT 0,
      created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_user        (user_id),
      INDEX idx_start_at    (start_at),
      INDEX idx_end_at      (end_at),
      INDEX idx_source      (source_type),
      INDEX idx_status      (status),
      INDEX idx_ical_uid    (ical_uid),
      INDEX idx_scheduled   (scheduled_call_id),
      INDEX idx_email       (email_account_id, email_uid),
      INDEX idx_reminder    (status, reminder_sent, start_at),

      CONSTRAINT fk_calendar_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration 020] ✅ calendar_events table created');
}

export async function down(): Promise<void> {
  await db.execute('DROP TABLE IF EXISTS calendar_events');
  console.log('[Migration 020] ✅ calendar_events table dropped');
}
