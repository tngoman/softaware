/**
 * Migration 021 — Local Tasks Storage + Source Tracking
 *
 * Creates two tables:
 *   - `task_sources`  — registered external APIs that supply tasks
 *   - `local_tasks`   — locally cached tasks with source provenance
 *
 * Tasks can come from multiple external sources (e.g. the PHP portal tasks-api,
 * different software product APIs, third-party project management tools).
 * The sync service pulls tasks from each source, upserts into local_tasks,
 * and tracks sync state per source.
 */

import { db } from '../mysql.js';

export async function up(): Promise<void> {
  console.log('[Migration 021] Creating task_sources table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_sources (
      id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name                VARCHAR(200)    NOT NULL,
      source_type         VARCHAR(50)     NOT NULL DEFAULT 'tasks-api'
                          COMMENT 'Source type: tasks-api | software-proxy | github | jira | manual',
      base_url            VARCHAR(500)    NOT NULL
                          COMMENT 'Base URL for the external API',
      api_key             VARCHAR(500)    NULL
                          COMMENT 'API key or token for authentication (encrypted or raw)',
      auth_method         VARCHAR(50)     NOT NULL DEFAULT 'api-key'
                          COMMENT 'Auth method: api-key | bearer | software-token | none',
      auth_header         VARCHAR(100)    NOT NULL DEFAULT 'X-API-Key'
                          COMMENT 'Header name to send credentials in',
      software_id         INT UNSIGNED    NULL
                          COMMENT 'For software-proxy sources, the software product ID',
      sync_enabled        TINYINT(1)      NOT NULL DEFAULT 1,
      sync_interval_min   INT UNSIGNED    NOT NULL DEFAULT 15
                          COMMENT 'How often to auto-sync (minutes). 0 = manual only',
      last_synced_at      DATETIME        NULL,
      last_sync_status    VARCHAR(50)     NULL
                          COMMENT 'success | error | partial',
      last_sync_message   TEXT            NULL,
      last_sync_count     INT UNSIGNED    NULL DEFAULT 0
                          COMMENT 'Number of tasks fetched in last sync',
      extra_config        JSON            NULL
                          COMMENT 'Source-specific config (scopes, filters, field mapping, etc.)',
      created_by          VARCHAR(36)     NULL,
      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_source_name (name),
      KEY idx_source_type (source_type),
      KEY idx_sync_enabled (sync_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration 021] Creating local_tasks table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS local_tasks (
      id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

      -- Source provenance
      source_id           BIGINT UNSIGNED NOT NULL
                          COMMENT 'FK → task_sources.id',
      external_id         VARCHAR(100)    NOT NULL
                          COMMENT 'ID on the external system (task_id from remote)',

      -- Core task fields (normalised from any source)
      title               VARCHAR(500)    NOT NULL,
      description         TEXT            NULL,
      notes               TEXT            NULL,
      status              VARCHAR(50)     NOT NULL DEFAULT 'new'
                          COMMENT 'new | in-progress | completed | pending | progress',
      type                VARCHAR(50)     NOT NULL DEFAULT 'general'
                          COMMENT 'development | feature | bug-fix | support | general | maintenance',
      color               VARCHAR(20)     NULL DEFAULT '#3788d8',

      -- Time tracking
      start_date          DATETIME        NULL,
      end_date            DATETIME        NULL,
      actual_start        DATETIME        NULL,
      actual_end          DATETIME        NULL,
      hours               VARCHAR(20)     NULL DEFAULT '00:00',
      estimated_hours     DECIMAL(10,2)   NULL DEFAULT 0,

      -- Assignment
      assigned_to         INT UNSIGNED    NULL,
      assigned_to_name    VARCHAR(200)    NULL,
      created_by_name     VARCHAR(200)    NULL,
      user_id             INT UNSIGNED    NULL DEFAULT 0,

      -- Workflow
      workflow_phase      VARCHAR(100)    NULL,
      approval_required   TINYINT(1)      NOT NULL DEFAULT 0,
      approved_by         VARCHAR(200)    NULL,
      approved_at         DATETIME        NULL,

      -- Associations
      parent_task_id      INT UNSIGNED    NULL,
      association_type    VARCHAR(50)     NULL,
      association_notes   TEXT            NULL,
      task_order          INT             NULL DEFAULT 0,
      order_number        VARCHAR(100)    NULL,

      -- Software / module
      software_id         INT UNSIGNED    NULL,
      module_id           INT UNSIGNED    NULL,
      module_name         VARCHAR(200)    NULL,

      -- Billing
      task_billed         TINYINT(1)      NOT NULL DEFAULT 0,
      task_bill_date      VARCHAR(50)     NULL,

      -- Flags
      task_direction      INT             NULL DEFAULT 0,
      task_dev            INT             NULL DEFAULT 0,
      task_deleted        TINYINT(1)      NOT NULL DEFAULT 0,

      -- Sync metadata
      external_created_at DATETIME        NULL
                          COMMENT 'created_at on the remote system',
      external_updated_at DATETIME        NULL
                          COMMENT 'updated_at / time on the remote system',
      last_synced_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                          COMMENT 'When this row was last refreshed from the source',
      sync_hash           VARCHAR(64)     NULL
                          COMMENT 'SHA-256 of serialised remote task — skip update if unchanged',
      local_dirty         TINYINT(1)      NOT NULL DEFAULT 0
                          COMMENT '1 = modified locally, needs push back to source',

      -- Timestamps
      created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      -- Constraints
      FOREIGN KEY (source_id) REFERENCES task_sources(id) ON DELETE CASCADE,
      UNIQUE KEY uq_source_external (source_id, external_id),
      KEY idx_status (status),
      KEY idx_type (type),
      KEY idx_source (source_id),
      KEY idx_sync_hash (sync_hash),
      KEY idx_local_dirty (local_dirty),
      KEY idx_deleted (task_deleted)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration 021] Creating sync_log table...');

  await db.execute(`
    CREATE TABLE IF NOT EXISTS task_sync_log (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      source_id       BIGINT UNSIGNED NOT NULL,
      started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at     DATETIME        NULL,
      status          VARCHAR(50)     NOT NULL DEFAULT 'running'
                      COMMENT 'running | success | error | partial',
      tasks_fetched   INT UNSIGNED    NOT NULL DEFAULT 0,
      tasks_created   INT UNSIGNED    NOT NULL DEFAULT 0,
      tasks_updated   INT UNSIGNED    NOT NULL DEFAULT 0,
      tasks_unchanged INT UNSIGNED    NOT NULL DEFAULT 0,
      tasks_deleted   INT UNSIGNED    NOT NULL DEFAULT 0,
      error_message   TEXT            NULL,
      duration_ms     INT UNSIGNED    NULL,

      FOREIGN KEY (source_id) REFERENCES task_sources(id) ON DELETE CASCADE,
      KEY idx_source_started (source_id, started_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Migration 021] ✅ Local tasks storage ready');
}

export async function down(): Promise<void> {
  console.log('[Migration 021] Dropping local tasks tables...');
  await db.execute('DROP TABLE IF EXISTS task_sync_log');
  await db.execute('DROP TABLE IF EXISTS local_tasks');
  await db.execute('DROP TABLE IF EXISTS task_sources');
  console.log('[Migration 021] ✅ Dropped');
}
