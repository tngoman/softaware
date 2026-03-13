import { db } from '../mysql.js';
/**
 * Migration 013: Unified Assistant Model — Primary Flag
 *
 * Both staff and clients now create assistants via the mobile app.
 * Clients can create multiple assistants; one is marked as the "primary"
 * (main) assistant used by default.
 *
 * Adds:
 *   - is_primary flag on assistants (1 = the default mobile assistant for that user)
 *   - Index for fast primary-assistant lookup per user
 *
 * Note: Existing staff assistants (is_staff_agent = 1) are auto-promoted
 * to is_primary = 1 since staff currently have max 1 assistant.
 */
export async function up() {
    console.log('[Migration 013] Adding is_primary column to assistants...');
    // Add the primary flag
    const [cols] = await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assistants' AND COLUMN_NAME = 'is_primary'`);
    if (!cols || (Array.isArray(cols) && cols.length === 0)) {
        await db.execute(`
      ALTER TABLE assistants
        ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0
          COMMENT '1 = the default mobile assistant for this user'
    `);
    }
    // Auto-promote existing staff assistants to primary
    await db.execute(`
    UPDATE assistants SET is_primary = 1 WHERE is_staff_agent = 1
  `);
    // For any client user who has exactly 1 assistant, auto-promote it
    await db.execute(`
    UPDATE assistants a
    INNER JOIN (
      SELECT userId FROM assistants
      WHERE is_staff_agent = 0 AND status = 'active'
      GROUP BY userId
      HAVING COUNT(*) = 1
    ) singles ON singles.userId = a.userId
    SET a.is_primary = 1
    WHERE a.is_staff_agent = 0 AND a.status = 'active'
  `);
    // Index for fast primary lookup
    try {
        await db.execute('ALTER TABLE assistants ADD INDEX idx_user_primary (userId, is_primary)');
    }
    catch {
        // Index may already exist
    }
    console.log('[Migration 013] ✅ is_primary column added and backfilled');
}
export async function down() {
    console.log('[Migration 013] Rolling back is_primary column...');
    try {
        await db.execute('ALTER TABLE assistants DROP INDEX idx_user_primary');
    }
    catch {
        // Index may not exist
    }
    await db.execute('ALTER TABLE assistants DROP COLUMN IF EXISTS is_primary');
    console.log('[Migration 013] ✅ is_primary column removed');
}
