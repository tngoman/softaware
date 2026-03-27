import { db } from '../mysql.js';

type PackageSeed = {
  slug: string;
  gateway_plan_id: string | null;
  max_sites: number;
  max_collections_per_site: number;
  max_storage_bytes: number;
  max_actions_per_month: number;
  allow_auto_recharge: number;
  max_knowledge_pages: number;
  allowed_site_type: 'single_page' | 'classic_cms' | 'ecommerce' | 'web_application' | 'headless';
  can_remove_watermark: number;
  allowed_system_actions: string[];
  has_custom_knowledge_categories: number;
  has_omni_channel_endpoints: number;
  ingestion_priority: number;
};

const SEEDS: PackageSeed[] = [
  {
    slug: 'free',
    gateway_plan_id: null,
    max_sites: 1,
    max_collections_per_site: 1,
    max_storage_bytes: 5 * 1024 * 1024,        // 5 MB
    max_actions_per_month: 500,
    allow_auto_recharge: 0,
    max_knowledge_pages: 50,
    allowed_site_type: 'single_page',
    can_remove_watermark: 0,
    allowed_system_actions: ['email_capture'],
    has_custom_knowledge_categories: 0,
    has_omni_channel_endpoints: 0,
    ingestion_priority: 1,
  },
  {
    slug: 'starter',
    gateway_plan_id: 'PLN_starter_abc123',
    max_sites: 3,
    max_collections_per_site: 6,
    max_storage_bytes: 50 * 1024 * 1024,       // 50 MB
    max_actions_per_month: 2000,
    allow_auto_recharge: 1,
    max_knowledge_pages: 200,
    allowed_site_type: 'classic_cms',
    can_remove_watermark: 1,
    allowed_system_actions: ['email_capture'],
    has_custom_knowledge_categories: 0,
    has_omni_channel_endpoints: 0,
    ingestion_priority: 2,
  },
  {
    slug: 'pro',
    gateway_plan_id: 'PLN_pro_def456',
    max_sites: 10,
    max_collections_per_site: 15,
    max_storage_bytes: 200 * 1024 * 1024,      // 200 MB
    max_actions_per_month: 5000,
    allow_auto_recharge: 1,
    max_knowledge_pages: 500,
    allowed_site_type: 'ecommerce',
    can_remove_watermark: 1,
    allowed_system_actions: ['email_capture', 'payment_gateway_hook'],
    has_custom_knowledge_categories: 1,
    has_omni_channel_endpoints: 0,
    ingestion_priority: 3,
  },
  {
    slug: 'advanced',
    gateway_plan_id: 'PLN_advanced_xyz789',
    max_sites: 25,
    max_collections_per_site: 40,
    max_storage_bytes: 1024 * 1024 * 1024,     // 1 GB
    max_actions_per_month: 20000,
    allow_auto_recharge: 1,
    max_knowledge_pages: 2000,
    allowed_site_type: 'web_application',
    can_remove_watermark: 1,
    allowed_system_actions: ['email_capture', 'payment_gateway_hook', 'api_webhook'],
    has_custom_knowledge_categories: 1,
    has_omni_channel_endpoints: 0,
    ingestion_priority: 4,
  },
  {
    slug: 'enterprise',
    gateway_plan_id: 'custom',
    max_sites: 999,
    max_collections_per_site: 999,
    max_storage_bytes: 5 * 1024 * 1024 * 1024, // 5 GB+
    max_actions_per_month: 999999,
    allow_auto_recharge: 1,
    max_knowledge_pages: 99999,
    allowed_site_type: 'headless',
    can_remove_watermark: 1,
    allowed_system_actions: ['email_capture', 'payment_gateway_hook', 'api_webhook', 'custom_middleware'],
    has_custom_knowledge_categories: 1,
    has_omni_channel_endpoints: 1,
    ingestion_priority: 5,
  },
  {
    slug: 'staff',
    gateway_plan_id: null,
    max_sites: 999,
    max_collections_per_site: 999,
    max_storage_bytes: 5 * 1024 * 1024 * 1024, // 5 GB+
    max_actions_per_month: 999999,
    allow_auto_recharge: 1,
    max_knowledge_pages: 99999,
    allowed_site_type: 'headless',
    can_remove_watermark: 1,
    allowed_system_actions: ['email_capture', 'payment_gateway_hook', 'api_webhook', 'custom_middleware'],
    has_custom_knowledge_categories: 1,
    has_omni_channel_endpoints: 1,
    ingestion_priority: 5,
  },
];

async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return (row?.cnt ?? 0) > 0;
}

export async function up(): Promise<void> {
  console.log('[Migration 032] Extending packages catalog with editable tier-limit columns...');

  const alters: Array<[string, string]> = [
    ['gateway_plan_id', 'ALTER TABLE packages ADD COLUMN gateway_plan_id VARCHAR(100) NULL AFTER cta_text'],
    ['max_sites', 'ALTER TABLE packages ADD COLUMN max_sites INT NULL AFTER max_landing_pages'],
    ['max_collections_per_site', 'ALTER TABLE packages ADD COLUMN max_collections_per_site INT NULL AFTER max_sites'],
    ['max_storage_bytes', 'ALTER TABLE packages ADD COLUMN max_storage_bytes BIGINT NULL AFTER max_collections_per_site'],
    ['max_actions_per_month', 'ALTER TABLE packages ADD COLUMN max_actions_per_month INT NULL AFTER max_storage_bytes'],
    ['allow_auto_recharge', 'ALTER TABLE packages ADD COLUMN allow_auto_recharge TINYINT(1) NOT NULL DEFAULT 0 AFTER max_actions_per_month'],
    ['max_knowledge_pages', 'ALTER TABLE packages ADD COLUMN max_knowledge_pages INT NULL AFTER allow_auto_recharge'],
    ['allowed_site_type', "ALTER TABLE packages ADD COLUMN allowed_site_type VARCHAR(32) NOT NULL DEFAULT 'single_page' AFTER max_knowledge_pages"],
    ['can_remove_watermark', 'ALTER TABLE packages ADD COLUMN can_remove_watermark TINYINT(1) NOT NULL DEFAULT 0 AFTER allowed_site_type'],
    ['allowed_system_actions', 'ALTER TABLE packages ADD COLUMN allowed_system_actions JSON NULL AFTER can_remove_watermark'],
    ['has_custom_knowledge_categories', 'ALTER TABLE packages ADD COLUMN has_custom_knowledge_categories TINYINT(1) NOT NULL DEFAULT 0 AFTER allowed_system_actions'],
    ['has_omni_channel_endpoints', 'ALTER TABLE packages ADD COLUMN has_omni_channel_endpoints TINYINT(1) NOT NULL DEFAULT 0 AFTER has_custom_knowledge_categories'],
    ['ingestion_priority', 'ALTER TABLE packages ADD COLUMN ingestion_priority INT NOT NULL DEFAULT 1 AFTER has_omni_channel_endpoints'],
  ];

  for (const [column, sql] of alters) {
    if (!(await hasColumn('packages', column))) {
      await db.execute(sql);
      console.log(`[Migration 032] Added packages.${column}`);
    }
  }

  for (const seed of SEEDS) {
    await db.execute(
      `UPDATE packages
          SET gateway_plan_id = COALESCE(gateway_plan_id, ?),
              max_sites = COALESCE(max_sites, max_landing_pages, ?),
              max_collections_per_site = COALESCE(max_collections_per_site, ?),
              max_storage_bytes = COALESCE(max_storage_bytes, ?),
              max_actions_per_month = COALESCE(max_actions_per_month, ?),
              allow_auto_recharge = COALESCE(allow_auto_recharge, ?),
              max_knowledge_pages = COALESCE(max_knowledge_pages, ?),
              allowed_site_type = COALESCE(allowed_site_type, ?),
              can_remove_watermark = COALESCE(can_remove_watermark, ?),
              allowed_system_actions = COALESCE(allowed_system_actions, ?),
              has_custom_knowledge_categories = COALESCE(has_custom_knowledge_categories, ?),
              has_omni_channel_endpoints = COALESCE(has_omni_channel_endpoints, ?),
              ingestion_priority = COALESCE(ingestion_priority, ?)
        WHERE slug = ?`,
      [
        seed.gateway_plan_id,
        seed.max_sites,
        seed.max_collections_per_site,
        seed.max_storage_bytes,
        seed.max_actions_per_month,
        seed.allow_auto_recharge,
        seed.max_knowledge_pages,
        seed.allowed_site_type,
        seed.can_remove_watermark,
        JSON.stringify(seed.allowed_system_actions),
        seed.has_custom_knowledge_categories,
        seed.has_omni_channel_endpoints,
        seed.ingestion_priority,
        seed.slug,
      ],
    );
  }

  console.log('[Migration 032] ✅ Packages catalog extension complete');
}

export async function down(): Promise<void> {
  console.log('[Migration 032] Down migration not supported (columns intentionally retained).');
}
