import { db } from '../mysql.js';
/**
 * Migration 015 — Chat system enhancements
 *
 * Adds:
 * 1. `cleared_at` column to conversation_members — for "delete conversation for me" feature.
 *    Messages created before cleared_at are hidden for that user.
 * 2. `icon_url` column to conversations — for group icon/avatar support.
 *    (only if not already present from initial schema)
 * 3. `dnd_start` / `dnd_end` columns to user_presence — Do Not Disturb schedule.
 * 4. `notification_sound` column to conversation_members — custom sound per conversation.
 */
export async function up() {
    console.log('[Migration 015] Chat enhancements — starting');
    // Helper: check if column exists
    const columnExists = async (table, column) => {
        const rows = await db.query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
        return rows.length > 0;
    };
    // 1. Add cleared_at to conversation_members
    if (!(await columnExists('conversation_members', 'cleared_at'))) {
        await db.execute(`
      ALTER TABLE conversation_members
        ADD COLUMN cleared_at DATETIME NULL COMMENT 'Messages before this time are hidden for user'
        AFTER last_read_message_id
    `);
        console.log('  ✅ conversation_members.cleared_at added');
    }
    else {
        console.log('  ⏭️  conversation_members.cleared_at already exists');
    }
    // 2. Ensure icon_url column on conversations
    if (!(await columnExists('conversations', 'icon_url'))) {
        await db.execute(`
      ALTER TABLE conversations
        ADD COLUMN icon_url VARCHAR(512) NULL COMMENT 'Group avatar URL'
        AFTER description
    `);
        console.log('  ✅ conversations.icon_url added');
    }
    else {
        console.log('  ⏭️  conversations.icon_url already exists');
    }
    // 3. Add DND schedule to user_presence (user-level)
    if (!(await columnExists('user_presence', 'dnd_start'))) {
        await db.execute(`
      ALTER TABLE user_presence
        ADD COLUMN dnd_start TIME NULL COMMENT 'Do Not Disturb start time (HH:MM:SS)'
    `);
        console.log('  ✅ user_presence.dnd_start added');
    }
    else {
        console.log('  ⏭️  user_presence.dnd_start already exists');
    }
    if (!(await columnExists('user_presence', 'dnd_end'))) {
        await db.execute(`
      ALTER TABLE user_presence
        ADD COLUMN dnd_end TIME NULL COMMENT 'Do Not Disturb end time (HH:MM:SS)'
    `);
        console.log('  ✅ user_presence.dnd_end added');
    }
    else {
        console.log('  ⏭️  user_presence.dnd_end already exists');
    }
    if (!(await columnExists('user_presence', 'dnd_enabled'))) {
        await db.execute(`
      ALTER TABLE user_presence
        ADD COLUMN dnd_enabled BOOLEAN NOT NULL DEFAULT 0 COMMENT 'Whether DND schedule is active'
    `);
        console.log('  ✅ user_presence.dnd_enabled added');
    }
    else {
        console.log('  ⏭️  user_presence.dnd_enabled already exists');
    }
    // 4. Add notification_sound to conversation_members (per-conversation)
    if (!(await columnExists('conversation_members', 'notification_sound'))) {
        await db.execute(`
      ALTER TABLE conversation_members
        ADD COLUMN notification_sound VARCHAR(100) NULL DEFAULT NULL
        COMMENT 'Custom notification sound name (null = default)'
    `);
        console.log('  ✅ conversation_members.notification_sound added');
    }
    else {
        console.log('  ⏭️  conversation_members.notification_sound already exists');
    }
    console.log('[Migration 015] Chat enhancements — done');
}
