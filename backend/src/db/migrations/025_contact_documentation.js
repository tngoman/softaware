/**
 * Migration 025 — Contact Documentation
 *
 * Creates the `contact_documentation` table for storing editable
 * markdown documentation per contact (enterprise client).
 *
 * Documents can be viewed and edited from the admin panel's
 * contact detail page under the "Documentation" tab.
 */
import { db } from '../mysql.js';
export async function up() {
    console.log('[Migration 025] Creating contact_documentation table...');
    await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_documentation (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      contact_id      INT UNSIGNED    NOT NULL
                      COMMENT 'FK to contacts.id',
      title           VARCHAR(255)    NOT NULL DEFAULT 'API Documentation'
                      COMMENT 'Document title',
      slug            VARCHAR(100)    NOT NULL DEFAULT 'api'
                      COMMENT 'URL-friendly slug for multi-doc support',
      content         LONGTEXT        NOT NULL
                      COMMENT 'Markdown content of the document',
      last_edited_by  VARCHAR(200)    NULL
                      COMMENT 'Name or email of last editor',
      created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_contact_slug (contact_id, slug),
      KEY idx_contact_id (contact_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('[Migration 025] contact_documentation table created.');
}
export async function down() {
    await db.execute('DROP TABLE IF EXISTS contact_documentation');
    console.log('[Migration 025] Dropped contact_documentation table.');
}
