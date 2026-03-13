/**
 * Migration 024 — Bugs Tracking System
 *
 * Creates three tables:
 *   - `bugs`             — Bug reports with workflow, software association, and task linking
 *   - `bug_comments`     — Comments on bugs (internal/public, with workflow notes)
 *   - `bug_attachments`  — File attachments on bug reports
 *
 * Workflow phases:
 *   Intake → QA → Development (then back to QA to close)
 *
 * Bugs can optionally be associated with a local_tasks row and can be
 * converted to/from tasks.
 */
import { db } from '../mysql.js';
export async function up() {
    console.log('[Migration 024] Creating bugs table...');
    await db.execute(`
    CREATE TABLE IF NOT EXISTS bugs (
      id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

      -- Core fields
      title               VARCHAR(500)    NOT NULL,
      description         TEXT            NULL
                          COMMENT 'Rich-text description of the bug',
      current_behaviour   TEXT            NULL
                          COMMENT 'What currently happens (observed behaviour)',
      expected_behaviour  TEXT            NULL
                          COMMENT 'What should happen (expected behaviour)',
      reporter_name       VARCHAR(200)    NOT NULL
                          COMMENT 'Name of the person reporting the bug',

      -- Software association
      software_id         INT UNSIGNED    NULL
                          COMMENT 'FK to update_software.id — the software product this bug relates to',
      software_name       VARCHAR(200)    NULL
                          COMMENT 'Denormalised software name for display',

      -- Status & workflow
      status              VARCHAR(50)     NOT NULL DEFAULT 'open'
                          COMMENT 'open | in-progress | pending-qa | resolved | closed | reopened',
      severity            VARCHAR(30)     NOT NULL DEFAULT 'medium'
                          COMMENT 'critical | high | medium | low',
      workflow_phase      VARCHAR(100)    NOT NULL DEFAULT 'intake'
                          COMMENT 'intake | qa | development',

      -- Assignment
      assigned_to         INT UNSIGNED    NULL,
      assigned_to_name    VARCHAR(200)    NULL,
      created_by          VARCHAR(36)     NULL
                          COMMENT 'User ID of creator (from JWT)',
      created_by_name     VARCHAR(200)    NULL,

      -- Task association (optional link to a task)
      linked_task_id      BIGINT UNSIGNED NULL
                          COMMENT 'FK to local_tasks.id — optional task association',
      converted_from_task TINYINT(1)      NOT NULL DEFAULT 0
                          COMMENT '1 if this bug was converted from a task',
      converted_to_task   BIGINT UNSIGNED NULL
                          COMMENT 'local_tasks.id if this bug was converted to a task',

      -- Resolution
      resolution_notes    TEXT            NULL,
      resolved_at         DATETIME        NULL,
      resolved_by         VARCHAR(200)    NULL,

      -- Timestamps
      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      -- Indexes
      KEY idx_bugs_status (status),
      KEY idx_bugs_severity (severity),
      KEY idx_bugs_workflow (workflow_phase),
      KEY idx_bugs_software (software_id),
      KEY idx_bugs_assigned (assigned_to),
      KEY idx_bugs_linked_task (linked_task_id),
      KEY idx_bugs_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 024] Creating bug_comments table...');
    await db.execute(`
    CREATE TABLE IF NOT EXISTS bug_comments (
      id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      bug_id              BIGINT UNSIGNED NOT NULL,
      author_name         VARCHAR(200)    NOT NULL,
      author_id           VARCHAR(36)     NULL,
      content             TEXT            NOT NULL
                          COMMENT 'Comment text (supports HTML/rich text)',
      is_internal         TINYINT(1)      NOT NULL DEFAULT 0
                          COMMENT '1 = internal team note, 0 = visible to reporter',
      comment_type        VARCHAR(50)     NOT NULL DEFAULT 'comment'
                          COMMENT 'comment | workflow_change | status_change | resolution',

      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
      KEY idx_bugcomments_bug (bug_id),
      KEY idx_bugcomments_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 024] Creating bug_attachments table...');
    await db.execute(`
    CREATE TABLE IF NOT EXISTS bug_attachments (
      id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      bug_id              BIGINT UNSIGNED NOT NULL,
      filename            VARCHAR(500)    NOT NULL,
      original_name       VARCHAR(500)    NOT NULL,
      mime_type           VARCHAR(100)    NULL,
      file_size           INT UNSIGNED    NULL
                          COMMENT 'Size in bytes',
      file_path           VARCHAR(1000)   NOT NULL
                          COMMENT 'Relative path in uploads directory',
      uploaded_by         VARCHAR(200)    NULL,
      uploaded_by_id      VARCHAR(36)     NULL,

      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (bug_id) REFERENCES bugs(id) ON DELETE CASCADE,
      KEY idx_bugattachments_bug (bug_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 024] ✅ Bugs tracking system ready');
}
export async function down() {
    console.log('[Migration 024] Dropping bugs tables...');
    await db.execute('DROP TABLE IF EXISTS bug_attachments');
    await db.execute('DROP TABLE IF EXISTS bug_comments');
    await db.execute('DROP TABLE IF EXISTS bugs');
    console.log('[Migration 024] ✅ Dropped');
}
