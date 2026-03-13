import { db } from '../mysql.js';

/**
 * Migration 012: Staff Sandbox Assistants & Prompt Concatenation
 *
 * Adds:
 *   - core_instructions / personality_flare columns on assistants (two-part prompt)
 *   - is_staff_agent flag on assistants
 *   - customisation columns (custom_greeting, voice_style, preferred_model)
 *   - assistant_id on mobile_conversations (assistant selection)
 *   - staff_software_tokens table (external software API tokens per staff user)
 */
export async function up() {
  console.log('[Migration 012] Adding staff sandbox & prompt concatenation columns...');

  // Two-part prompt + staff marker + customisation
  await db.execute(`
    ALTER TABLE assistants
      ADD COLUMN IF NOT EXISTS core_instructions TEXT NULL COMMENT 'System-level rules hidden from GUI — managed by code/superadmin',
      ADD COLUMN IF NOT EXISTS personality_flare TEXT NULL COMMENT 'User-editable personality & tone — shown in GUI',
      ADD COLUMN IF NOT EXISTS is_staff_agent TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = internal staff sandbox assistant',
      ADD COLUMN IF NOT EXISTS custom_greeting TEXT NULL COMMENT 'Custom greeting message for the assistant',
      ADD COLUMN IF NOT EXISTS voice_style VARCHAR(50) NULL COMMENT 'Preferred TTS voice style hint for mobile',
      ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(100) NULL COMMENT 'Override Ollama model for this assistant'
  `);

  // Assistant selection in conversations
  await db.execute(`
    ALTER TABLE mobile_conversations
      ADD COLUMN IF NOT EXISTS assistant_id VARCHAR(255) NULL COMMENT 'The assistant being used in this conversation'
        AFTER user_id
  `);

  // External software tokens for task proxy
  // ⚠️  DEPRECATED (v2.1.0): This table is no longer used by AI task tools.
  //    Task proxy now uses source-level API keys from `task_sources` table.
  //    Table retained for backward compat; will be removed in a future migration.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff_software_tokens (
      id            VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id       VARCHAR(36) NOT NULL,
      software_id   INT NOT NULL,
      software_name VARCHAR(255) NULL,
      api_url       VARCHAR(1000) NOT NULL,
      token         TEXT NOT NULL COMMENT 'Encrypted external software API token',
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_sst_user_software (user_id, software_id),
      INDEX idx_sst_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Staff agent lookup index
  try {
    await db.execute('ALTER TABLE assistants ADD INDEX idx_staff_agent (userId, is_staff_agent)');
  } catch {
    // Index may already exist
  }

  console.log('[Migration 012] ✅ Staff sandbox tables and columns created');
}

export async function down() {
  console.log('[Migration 012] Rolling back staff sandbox...');

  await db.execute('DROP TABLE IF EXISTS staff_software_tokens');
  await db.execute('ALTER TABLE mobile_conversations DROP COLUMN IF EXISTS assistant_id');
  await db.execute(`
    ALTER TABLE assistants
      DROP COLUMN IF EXISTS core_instructions,
      DROP COLUMN IF EXISTS personality_flare,
      DROP COLUMN IF EXISTS is_staff_agent,
      DROP COLUMN IF EXISTS custom_greeting,
      DROP COLUMN IF EXISTS voice_style,
      DROP COLUMN IF EXISTS preferred_model
  `);

  console.log('[Migration 012] ✅ Staff sandbox columns removed');
}
