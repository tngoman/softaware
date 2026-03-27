import { db } from '../mysql.js';

/**
 * Migration 033: Create db_connection_access table for per-user database connection access control.
 *
 * Only users explicitly granted access (by an admin) can see and use a connection.
 * Admin-flagged users bypass this and see all connections.
 */
export async function up(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS db_connection_access (
      id VARCHAR(36) PRIMARY KEY,
      connection_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      granted_by VARCHAR(36) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_conn_user (connection_id, user_id),
      INDEX idx_connection_id (connection_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function down(): Promise<void> {
  await db.query('DROP TABLE IF EXISTS db_connection_access');
}
