/**
 * Migration 004: Add profile fields to User table
 *
 * Adds name, phone, and avatarUrl columns to support
 * mobile app profile management for staff and clients.
 */
import { pool } from '../mysql.js';
export async function up() {
    const conn = await pool.getConnection();
    try {
        // Check if columns already exist before adding
        const [columns] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User' AND COLUMN_NAME IN ('name', 'phone', 'avatarUrl')`);
        const existing = new Set(columns.map((c) => c.COLUMN_NAME));
        if (!existing.has('name')) {
            await conn.execute(`ALTER TABLE users ADD COLUMN name VARCHAR(255) NULL AFTER email`);
        }
        if (!existing.has('phone')) {
            await conn.execute(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL AFTER name`);
        }
        if (!existing.has('avatarUrl')) {
            await conn.execute(`ALTER TABLE users ADD COLUMN avatarUrl VARCHAR(512) NULL AFTER phone`);
        }
        console.log('[Migration 004] User profile fields added successfully');
    }
    finally {
        conn.release();
    }
}
export async function down() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`ALTER TABLE users DROP COLUMN IF EXISTS avatarUrl`);
        await conn.execute(`ALTER TABLE users DROP COLUMN IF EXISTS phone`);
        await conn.execute(`ALTER TABLE users DROP COLUMN IF EXISTS name`);
        console.log('[Migration 004] User profile fields removed');
    }
    finally {
        conn.release();
    }
}
