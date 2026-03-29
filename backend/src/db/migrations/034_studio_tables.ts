import { db } from '../mysql.js';

export async function up() {
  console.log('\n🔄 Migration 034: Studio tables (site-scoped collections, API keys, snapshots, sticky notes)\n');

  // ── 1. Add site_id column to client_custom_data ──────────────────────────
  const cols = await db.query<{ Field: string }>(
    `SHOW COLUMNS FROM client_custom_data`
  );
  const hasField = (name: string) => cols.some(c => c.Field === name);

  if (!hasField('site_id')) {
    await db.execute(
      `ALTER TABLE client_custom_data
         ADD COLUMN site_id VARCHAR(50) DEFAULT NULL AFTER client_id,
         ADD INDEX idx_site_collection (site_id, collection_name)`
    );
    console.log('  ✅ Added site_id column to client_custom_data');
  }

  if (!hasField('allow_public_write')) {
    await db.execute(
      `ALTER TABLE client_custom_data
         ADD COLUMN allow_public_write TINYINT DEFAULT 0 AFTER byte_size`
    );
    console.log('  ✅ Added allow_public_write column to client_custom_data');
  }

  // ── 2. Site API keys ─────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_api_keys (
      id            VARCHAR(50) PRIMARY KEY,
      site_id       VARCHAR(50) NOT NULL,
      client_id     VARCHAR(50) NOT NULL,
      api_key       VARCHAR(128) NOT NULL UNIQUE,
      label         VARCHAR(100) DEFAULT 'Default',
      permissions   JSON DEFAULT ('["read"]'),
      rate_limit    INT DEFAULT 60,
      active        TINYINT DEFAULT 1,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_site_api_keys_site (site_id),
      INDEX idx_site_api_keys_key (api_key)
    )
  `);
  console.log('  ✅ Created site_api_keys table');

  // ── 3. Studio snapshots ──────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS studio_snapshots (
      id            VARCHAR(50) PRIMARY KEY,
      site_id       VARCHAR(50) NOT NULL,
      staff_id      VARCHAR(50) NOT NULL,
      label         VARCHAR(200),
      page_data     JSON NOT NULL,
      styles_data   JSON NOT NULL,
      thumbnail     MEDIUMTEXT,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_studio_snapshots_site (site_id)
    )
  `);
  console.log('  ✅ Created studio_snapshots table');

  // ── 4. Studio sticky notes ───────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS studio_sticky_notes (
      id            VARCHAR(50) PRIMARY KEY,
      site_id       VARCHAR(50) NOT NULL,
      page_id       VARCHAR(50),
      staff_id      VARCHAR(50) NOT NULL,
      content       TEXT NOT NULL,
      color         VARCHAR(20) DEFAULT 'yellow',
      pos_x         INT DEFAULT 100,
      pos_y         INT DEFAULT 100,
      width         INT DEFAULT 220,
      height        INT DEFAULT 160,
      minimized     TINYINT DEFAULT 0,
      resolved      TINYINT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sticky_notes_site (site_id),
      INDEX idx_sticky_notes_page (site_id, page_id)
    )
  `);
  console.log('  ✅ Created studio_sticky_notes table');

  // ── 5. Sticky note replies ───────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS studio_note_replies (
      id            VARCHAR(50) PRIMARY KEY,
      note_id       VARCHAR(50) NOT NULL,
      staff_id      VARCHAR(50) NOT NULL,
      content       TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_note_replies_note (note_id)
    )
  `);
  console.log('  ✅ Created studio_note_replies table');

  // ── 6. Collection metadata (allow_public_write per collection) ───────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS collection_metadata (
      id              VARCHAR(50) PRIMARY KEY,
      client_id       VARCHAR(50) NOT NULL,
      site_id         VARCHAR(50),
      collection_name VARCHAR(50) NOT NULL,
      allow_public_write TINYINT DEFAULT 0,
      schema_template JSON,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_col_meta_unique (client_id, site_id, collection_name)
    )
  `);
  console.log('  ✅ Created collection_metadata table');

  console.log('\n✅ Migration 034 complete\n');
}

export async function down() {
  console.log('\n🔄 Rolling back Migration 034\n');

  await db.execute('DROP TABLE IF EXISTS studio_note_replies');
  await db.execute('DROP TABLE IF EXISTS studio_sticky_notes');
  await db.execute('DROP TABLE IF EXISTS studio_snapshots');
  await db.execute('DROP TABLE IF EXISTS site_api_keys');
  await db.execute('DROP TABLE IF EXISTS collection_metadata');

  try {
    await db.execute('ALTER TABLE client_custom_data DROP INDEX idx_site_collection');
  } catch { /* index may not exist */ }
  try {
    await db.execute('ALTER TABLE client_custom_data DROP COLUMN site_id');
  } catch { /* column may not exist */ }
  try {
    await db.execute('ALTER TABLE client_custom_data DROP COLUMN allow_public_write');
  } catch { /* column may not exist */ }

  console.log('✅ Migration 034 rolled back\n');
}
