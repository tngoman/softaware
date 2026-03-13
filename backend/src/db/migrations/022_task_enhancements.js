/**
 * Migration 022 — Local Task Enhancements
 *
 * Adds local-only columns to the `local_tasks` table for enhanced
 * task management features. These columns are never synced to/from
 * external sources — they exist purely for the local UI experience.
 *
 *   - priority        — urgent / high / normal / low
 *   - is_bookmarked   — quick-access favorites
 *   - color_label     — user-chosen color tag for visual grouping
 *   - local_tags      — JSON array of freeform tag strings
 *   - kanban_order    — per-column sort order for Kanban board
 *   - view_count      — how many times the user opened this task
 *   - last_viewed_at  — when user last viewed this task
 */
import { db } from '../mysql.js';
export async function up() {
    console.log('[Migration 022] Adding local enhancement columns to local_tasks...');
    // Add columns one by one (MySQL doesn't support IF NOT EXISTS on ADD COLUMN)
    const columns = [
        `ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal'
       COMMENT 'Local priority: urgent | high | normal | low'`,
        `ADD COLUMN is_bookmarked TINYINT(1) NOT NULL DEFAULT 0
       COMMENT 'User bookmark/favorite flag'`,
        `ADD COLUMN color_label VARCHAR(20) NULL DEFAULT NULL
       COMMENT 'User-chosen color tag (e.g. red, orange, green, blue, purple)'`,
        `ADD COLUMN local_tags JSON NULL DEFAULT NULL
       COMMENT 'Array of freeform tag strings, e.g. ["frontend","urgent-fix"]'`,
        `ADD COLUMN kanban_order INT NOT NULL DEFAULT 0
       COMMENT 'Sort order within a Kanban column'`,
        `ADD COLUMN view_count INT UNSIGNED NOT NULL DEFAULT 0
       COMMENT 'How many times the user opened this task detail'`,
        `ADD COLUMN last_viewed_at DATETIME NULL DEFAULT NULL
       COMMENT 'When the user last viewed this task'`,
    ];
    for (const col of columns) {
        try {
            await db.execute(`ALTER TABLE local_tasks ${col}`);
        }
        catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log(`  Column already exists, skipping: ${col.slice(11, col.indexOf(' ', 12))}`);
            }
            else {
                throw err;
            }
        }
    }
    // Add indexes
    const indexes = [
        { name: 'idx_priority', sql: 'CREATE INDEX idx_priority ON local_tasks (priority)' },
        { name: 'idx_bookmarked', sql: 'CREATE INDEX idx_bookmarked ON local_tasks (is_bookmarked)' },
        { name: 'idx_kanban_order', sql: 'CREATE INDEX idx_kanban_order ON local_tasks (status, kanban_order)' },
        { name: 'idx_last_viewed', sql: 'CREATE INDEX idx_last_viewed ON local_tasks (last_viewed_at DESC)' },
    ];
    for (const idx of indexes) {
        try {
            await db.execute(idx.sql);
        }
        catch (err) {
            if (err.code === 'ER_DUP_KEYNAME') {
                console.log(`  Index ${idx.name} already exists, skipping`);
            }
            else {
                throw err;
            }
        }
    }
    console.log('[Migration 022] ✅ Local task enhancements ready');
}
export async function down() {
    console.log('[Migration 022] Removing local enhancement columns...');
    const columns = ['priority', 'is_bookmarked', 'color_label', 'local_tags',
        'kanban_order', 'view_count', 'last_viewed_at'];
    for (const col of columns) {
        try {
            await db.execute(`ALTER TABLE local_tasks DROP COLUMN ${col}`);
        }
        catch { /* ignore if doesn't exist */ }
    }
    const indexes = ['idx_priority', 'idx_bookmarked', 'idx_kanban_order', 'idx_last_viewed'];
    for (const idx of indexes) {
        try {
            await db.execute(`DROP INDEX ${idx} ON local_tasks`);
        }
        catch { /* ignore */ }
    }
    console.log('[Migration 022] ✅ Columns dropped');
}
