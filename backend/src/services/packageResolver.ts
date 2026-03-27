import { db } from '../db/mysql.js';
import { getLimitsForTier, type TierLimits, type TierName } from '../config/tiers.js';

export interface PackageCatalogRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  package_type: 'CONSUMER' | 'ENTERPRISE' | 'STAFF' | 'ADDON';
  price_monthly: number;
  price_annually: number | null;
  max_users: number | null;
  max_agents: number | null;
  max_widgets: number | null;
  max_landing_pages: number | null;
  max_enterprise_endpoints: number | null;
  features: string | null;
  is_active: number;
  is_public: number;
  display_order: number;
  featured: number;
  cta_text: string;
  gateway_plan_id?: string | null;
  max_sites?: number | null;
  max_collections_per_site?: number | null;
  max_storage_bytes?: number | null;
  max_actions_per_month?: number | null;
  allow_auto_recharge?: number | null;
  max_knowledge_pages?: number | null;
  allowed_site_type?: TierLimits['allowedSiteType'] | null;
  can_remove_watermark?: number | null;
  allowed_system_actions?: string | null;
  has_custom_knowledge_categories?: number | null;
  has_omni_channel_endpoints?: number | null;
  has_vision?: number | null;
  ingestion_priority?: number | null;
}

export interface ResolvedUserPackage {
  contactId: number;
  contactPackageId: number;
  packageId: number;
  packageSlug: string;
  packageName: string;
  packageStatus: string;
  limits: TierLimits;
  rawPackage: PackageCatalogRow;
}

const PACKAGE_TO_TIER_FALLBACK: Record<string, TierName> = {
  free: 'free',
  starter: 'starter',
  pro: 'pro',
  advanced: 'advanced',
  enterprise: 'enterprise',
  staff: 'enterprise',
};

function parseActions(raw: string | null | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function getFallbackTier(slug: string, packageType: string): TierName {
  if (PACKAGE_TO_TIER_FALLBACK[slug]) return PACKAGE_TO_TIER_FALLBACK[slug];
  if (packageType === 'STAFF') return 'enterprise';
  if (packageType === 'ENTERPRISE') return 'enterprise';
  return 'free';
}

export function mapPackageToTierName(slug: string, packageType = 'CONSUMER'): TierName {
  return getFallbackTier(slug, packageType);
}

/**
 * When a contact_package is in TRIAL status, the user gets **Free tier limits**
 * rather than the full package limits. This makes the trial a sandboxed preview
 * (read-only context, capped resources) that upgrades to full limits on payment.
 *
 * Enterprise/Staff packages are exempt — their trials are always full-featured.
 */
export function resolveTrialLimits(packageStatus: string, packageType: string, fullLimits: TierLimits): TierLimits {
  if (packageStatus !== 'TRIAL') return fullLimits;
  if (packageType === 'ENTERPRISE' || packageType === 'STAFF') return fullLimits;
  return getLimitsForTier('free');
}

/**
 * Determine the AI model tier ('free' or 'paid') for a user.
 *
 * Pro, Advanced, and Enterprise packages — including TRIAL status — get the
 * paid model chain (GLM → OpenRouter → Ollama).  Free and Starter packages
 * (and users with no package) get the free chain (Ollama only).
 *
 * This is intentionally separate from resolveTrialLimits: trial users get
 * the *better models* so they can experience the quality, but their usage
 * is still capped at free-tier limits.
 */
const PAID_MODEL_SLUGS = new Set(['pro', 'advanced', 'enterprise', 'staff']);

export async function resolveModelTier(userId: string | number): Promise<'free' | 'paid'> {
  try {
    const pkg = await getActivePackageForUser(userId);
    if (!pkg) return 'free';
    if (PAID_MODEL_SLUGS.has(pkg.packageSlug)) return 'paid';
    if (pkg.rawPackage.package_type === 'ENTERPRISE' || pkg.rawPackage.package_type === 'STAFF') return 'paid';
    return 'free';
  } catch {
    return 'free';
  }
}

export function packageRowToTierLimits(pkg: PackageCatalogRow): TierLimits {
  const fallbackTier = getFallbackTier(pkg.slug, pkg.package_type);
  const fallback = getLimitsForTier(fallbackTier);

  return {
    name: pkg.name || fallback.name,
    priceZAR: typeof pkg.price_monthly === 'number' ? pkg.price_monthly / 100 : fallback.priceZAR,
    gatewayPlanId: pkg.gateway_plan_id ?? fallback.gatewayPlanId,
    maxSites: pkg.max_sites ?? pkg.max_landing_pages ?? fallback.maxSites,
    maxWidgets: pkg.max_widgets ?? pkg.max_agents ?? fallback.maxWidgets,
    maxCollectionsPerSite: pkg.max_collections_per_site ?? fallback.maxCollectionsPerSite,
    maxStorageBytes: pkg.max_storage_bytes ?? fallback.maxStorageBytes,
    maxActionsPerMonth: pkg.max_actions_per_month ?? fallback.maxActionsPerMonth,
    allowAutoRecharge: Boolean(pkg.allow_auto_recharge ?? (fallback.allowAutoRecharge ? 1 : 0)),
    maxKnowledgePages: pkg.max_knowledge_pages ?? fallback.maxKnowledgePages,
    allowedSiteType: (pkg.allowed_site_type as TierLimits['allowedSiteType']) ?? fallback.allowedSiteType,
    canRemoveWatermark: Boolean(pkg.can_remove_watermark ?? (fallback.canRemoveWatermark ? 1 : 0)),
    allowedSystemActions: parseActions(pkg.allowed_system_actions, fallback.allowedSystemActions),
    hasCustomKnowledgeCategories: Boolean(pkg.has_custom_knowledge_categories ?? (fallback.hasCustomKnowledgeCategories ? 1 : 0)),
    hasOmniChannelEndpoints: Boolean(pkg.has_omni_channel_endpoints ?? (fallback.hasOmniChannelEndpoints ? 1 : 0)),
    hasVision: Boolean(pkg.has_vision ?? (fallback.hasVision ? 1 : 0)),
    ingestionPriority: pkg.ingestion_priority ?? fallback.ingestionPriority,
  };
}

export async function getActivePackageForUser(userId: string | number): Promise<ResolvedUserPackage | null> {
  const row = await db.queryOne<any>(
    `SELECT
       COALESCE(u.contact_id, (
         SELECT ucl.contact_id
         FROM user_contact_link ucl
         WHERE ucl.user_id = u.id
         ORDER BY FIELD(ucl.role, 'OWNER', 'ADMIN', 'MEMBER', 'STAFF'), ucl.id ASC
         LIMIT 1
       )) AS resolved_contact_id,
       cp.id AS contact_package_id,
       cp.status AS package_status,
       p.*
     FROM users u
     LEFT JOIN contact_packages cp
       ON cp.contact_id = COALESCE(u.contact_id, (
         SELECT ucl.contact_id
         FROM user_contact_link ucl
         WHERE ucl.user_id = u.id
         ORDER BY FIELD(ucl.role, 'OWNER', 'ADMIN', 'MEMBER', 'STAFF'), ucl.id ASC
         LIMIT 1
       ))
      AND cp.status IN ('ACTIVE', 'TRIAL')
     LEFT JOIN packages p
       ON p.id = cp.package_id
      AND p.is_active = 1
     WHERE u.id = ?
     ORDER BY CASE cp.status WHEN 'ACTIVE' THEN 0 WHEN 'TRIAL' THEN 1 ELSE 2 END, cp.updated_at DESC, cp.id DESC
     LIMIT 1`,
    [userId],
  );

  if (!row?.resolved_contact_id || !row?.contact_package_id || !row?.id) {
    return null;
  }

  const rawPackage = row as PackageCatalogRow;
  const fullLimits = packageRowToTierLimits(rawPackage);
  return {
    contactId: Number(row.resolved_contact_id),
    contactPackageId: Number(row.contact_package_id),
    packageId: Number(row.id),
    packageSlug: row.slug,
    packageName: row.name,
    packageStatus: row.package_status,
    limits: resolveTrialLimits(row.package_status, rawPackage.package_type, fullLimits),
    rawPackage,
  };
}

export async function requireActivePackageForUser(userId: string | number): Promise<ResolvedUserPackage> {
  const pkg = await getActivePackageForUser(userId);
  if (!pkg) {
    const error = new Error('Your user is not linked to a contact/company with an active package. Please assign a package on /admin/packages.');
    (error as any).status = 403;
    (error as any).code = 'PACKAGE_LINK_REQUIRED';
    throw error;
  }
  return pkg;
}

export async function syncUsersForContactPackage(contactId: number, pkg: PackageCatalogRow): Promise<void> {
  const tierName = mapPackageToTierName(pkg.slug, pkg.package_type);
  const limits = packageRowToTierLimits(pkg);

  await db.execute(
    `UPDATE users
        SET plan_type = ?,
            storage_limit_bytes = ?
      WHERE contact_id = ?`,
    [tierName, limits.maxStorageBytes, contactId],
  );
}

export function formatPublicPackage(pkg: PackageCatalogRow) {
  const limits = packageRowToTierLimits(pkg);
  let parsedFeatures: string[] = [];
  if (pkg.features) {
    try {
      const arr = JSON.parse(pkg.features);
      if (Array.isArray(arr)) parsedFeatures = arr.filter((item) => typeof item === 'string');
    } catch {
      parsedFeatures = [];
    }
  }

  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    description: pkg.description,
    packageType: pkg.package_type,
    priceMonthly: pkg.price_monthly,
    priceAnnually: pkg.price_annually,
    featured: Boolean(pkg.featured),
    ctaText: pkg.cta_text,
    isPublic: Boolean(pkg.is_public),
    displayOrder: pkg.display_order,
    limits,
    features: parsedFeatures,
  };
}
