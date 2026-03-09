import { db } from '../mysql.js';

/**
 * Migration 017 — Drop Legacy Team Chat Tables
 *
 * The old `team_chats`, `team_chat_members`, and `team_chat_messages`
 * tables were preserved during Migration 014 (chat system) for a 30-day
 * grace period. That grace period is long expired. This migration drops
 * the legacy tables to clean up the schema.
 *
 * The data was migrated into `conversations`, `conversation_members`,
 * and `messages` respectively during Migration 014.
 */

async function tableExists(name: string): Promise<boolean> {
  const rows = await db.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name],
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

export async function up() {
  console.log('[Migration 017] Dropping legacy team chat tables...');

  // Drop in reverse dependency order (messages → members → chats)
  const tables = ['team_chat_messages', 'team_chat_members', 'team_chats'];

  for (const table of tables) {
    if (await tableExists(table)) {
      await db.execute(`DROP TABLE \`${table}\``);
      console.log(`  🗑️  Dropped ${table}`);
    } else {
      console.log(`  ⏭  ${table} already gone — skipping`);
    }
  }

  console.log('[Migration 017] ✅ Legacy team chat tables removed');
}

export async function down() {
  // Cannot restore dropped tables — data was migrated in 014.
  // If rollback is needed, re-run migration 014 and re-import from backups.
  console.log('[Migration 017] ⚠️  Cannot restore dropped tables. Re-run migration 014 and import from backup if needed.');
}
