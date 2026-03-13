import { db } from '../mysql.js';
/**
 * Migration 011: Create mobile AI assistant conversation tables
 *
 * Stores conversation sessions and their messages for the mobile
 * assistant feature. Each conversation is owned by a single user
 * and tracks the role (client/staff) at the time of creation.
 */
export async function up() {
    console.log('[Migration 011] Creating mobile AI conversation tables...');
    // Conversations table
    await db.execute(`
    CREATE TABLE IF NOT EXISTS mobile_conversations (
      id          VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id     VARCHAR(36) NOT NULL,
      role        VARCHAR(20) NOT NULL DEFAULT 'client' COMMENT 'Role at conversation time: client | staff',
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_mc_user_id (user_id),
      INDEX idx_mc_updated (updated_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    // Messages table
    await db.execute(`
    CREATE TABLE IF NOT EXISTS mobile_messages (
      id               VARCHAR(36) NOT NULL PRIMARY KEY,
      conversation_id  VARCHAR(36) NOT NULL,
      role             VARCHAR(20) NOT NULL COMMENT 'user | assistant | system | tool',
      content          TEXT NOT NULL,
      tool_name        VARCHAR(100) NULL COMMENT 'Populated when role=tool',
      created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_mm_conversation (conversation_id, created_at),
      CONSTRAINT fk_mm_conversation
        FOREIGN KEY (conversation_id) REFERENCES mobile_conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 011] ✅ Mobile conversation tables created');
}
export async function down() {
    console.log('[Migration 011] Rolling back mobile conversation tables...');
    await db.execute('DROP TABLE IF EXISTS mobile_messages');
    await db.execute('DROP TABLE IF EXISTS mobile_conversations');
    console.log('[Migration 011] ✅ Mobile conversation tables removed');
}
