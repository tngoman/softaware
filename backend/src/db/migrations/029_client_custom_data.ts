/**
 * Migration 029: Client Custom Data (Generic Headless CMS + Storage Ledger)
 *
 * Creates the universal CMS storage table and implements a storage ledger
 * directly on the `users` table. Every CMS record stores its own byte_size
 * for precise ledger accounting on INSERT/UPDATE/DELETE.
 *
 * Storage model:
 *   users.storage_used_bytes   → running tally of total CMS bytes
 *   users.storage_limit_bytes  → tier cap (set on upgrade/downgrade)
 *   client_custom_data.byte_size → per-row byte count for ledger math
 *
 * Also extends subscription_tier_limits with CMS quota columns so the
 * existing tier system governs how much CMS storage each client may use.
 */

import { db } from '../mysql.js';

export async function up() {
  console.log('\n🔄 Migration 029: Client Custom Data (Generic CMS + Storage Ledger)\n');

  // ── 1. Universal CMS storage table (with per-row byte_size) ──────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS client_custom_data (
      id              VARCHAR(50)  PRIMARY KEY,
      client_id       VARCHAR(50)  NOT NULL,
      collection_name VARCHAR(50)  NOT NULL,
      document_data   JSON         NOT NULL,
      byte_size       BIGINT       NOT NULL DEFAULT 0,
      created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_client_collection (client_id, collection_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ Created client_custom_data table (with byte_size ledger column)');

  // ── 2. Storage ledger columns on users table ─────────────────────────────
  //   storage_used_bytes  — running total, adjusted in a MySQL transaction
  //   storage_limit_bytes — defaults to 5 MB (5,242,880 bytes)
  const userCols = await db.query<{ Field: string }>(`SHOW COLUMNS FROM users`);
  const existingUserCols = new Set(userCols.map(c => c.Field));

  if (!existingUserCols.has('storage_used_bytes')) {
    await db.execute(`
      ALTER TABLE users
        ADD COLUMN storage_used_bytes  BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN storage_limit_bytes BIGINT NOT NULL DEFAULT 5242880
    `);
    console.log('✅ Added storage ledger columns to users (default 5 MB limit)');
  }

  // ── 3. Extend subscription_tier_limits with CMS quotas ───────────────────
  const tierCols = await db.query<{ Field: string }>(
    `SHOW COLUMNS FROM subscription_tier_limits`
  );
  const existingTierCols = new Set(tierCols.map(c => c.Field));

  if (!existingTierCols.has('cms_max_records')) {
    await db.execute(`
      ALTER TABLE subscription_tier_limits
        ADD COLUMN cms_max_records      INT     NOT NULL DEFAULT 0     AFTER document_uploads,
        ADD COLUMN cms_max_collections  INT     NOT NULL DEFAULT 0     AFTER cms_max_records,
        ADD COLUMN cms_storage_limit_mb INT     NOT NULL DEFAULT 0     AFTER cms_max_collections,
        ADD COLUMN cms_api_rpm          INT     NOT NULL DEFAULT 0     AFTER cms_storage_limit_mb
    `);
    console.log('✅ Added CMS quota columns to subscription_tier_limits');
  }

  // ── 4. Seed CMS tier values ──────────────────────────────────────────────
  //   free       → 5 MB, 100 records, 3 collections (generous text-only free tier)
  //   starter    → 25 MB, 500 records, 5 collections
  //   advanced   → 100 MB, 5,000 records, 20 collections
  //   enterprise → 500 MB, 50,000 records, unlimited collections
  await db.execute(`
    UPDATE subscription_tier_limits SET
      cms_max_records      = 100,
      cms_max_collections  = 3,
      cms_storage_limit_mb = 5,
      cms_api_rpm          = 60
    WHERE tier = 'free'
  `);
  await db.execute(`
    UPDATE subscription_tier_limits SET
      cms_max_records      = 500,
      cms_max_collections  = 5,
      cms_storage_limit_mb = 25,
      cms_api_rpm          = 120
    WHERE tier = 'starter'
  `);
  await db.execute(`
    UPDATE subscription_tier_limits SET
      cms_max_records      = 5000,
      cms_max_collections  = 20,
      cms_storage_limit_mb = 100,
      cms_api_rpm          = 300
    WHERE tier = 'advanced'
  `);
  await db.execute(`
    UPDATE subscription_tier_limits SET
      cms_max_records      = 50000,
      cms_max_collections  = 999,
      cms_storage_limit_mb = 500,
      cms_api_rpm          = 1000
    WHERE tier = 'enterprise'
  `);
  console.log('✅ Seeded CMS tier limits');

  console.log('\n✅ Migration 029 complete\n');
}

export async function down() {
  await db.execute(`DROP TABLE IF EXISTS client_custom_data`);

  // Remove storage ledger columns from users
  try {
    await db.execute(`
      ALTER TABLE users
        DROP COLUMN storage_used_bytes,
        DROP COLUMN storage_limit_bytes
    `);
  } catch { /* columns may not exist */ }

  // Remove CMS columns from subscription_tier_limits
  try {
    await db.execute(`
      ALTER TABLE subscription_tier_limits
        DROP COLUMN cms_max_records,
        DROP COLUMN cms_max_collections,
        DROP COLUMN cms_storage_limit_mb,
        DROP COLUMN cms_api_rpm
    `);
  } catch { /* columns may not exist */ }

  console.log('✅ Migration 029 rolled back');
}
