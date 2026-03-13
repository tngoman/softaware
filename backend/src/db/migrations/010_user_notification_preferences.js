import { db } from '../mysql.js';
/**
 * Migration 010: Add notification preferences to users table
 * Allows users to control web and push notification settings
 */
export async function up() {
    console.log('[Migration 010] Adding notification preferences to users table...');
    // Add notification preference columns
    await db.execute(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE COMMENT 'Master toggle for all notifications',
    ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable push notifications',
    ADD COLUMN IF NOT EXISTS web_notifications_enabled BOOLEAN DEFAULT TRUE COMMENT 'Enable/disable web in-app notifications'
  `);
    console.log('[Migration 010] ✅ Notification preferences added');
}
export async function down() {
    console.log('[Migration 010] Rolling back notification preferences...');
    await db.execute(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS notifications_enabled,
    DROP COLUMN IF EXISTS push_notifications_enabled,
    DROP COLUMN IF EXISTS web_notifications_enabled
  `);
    console.log('[Migration 010] ✅ Notification preferences removed');
}
