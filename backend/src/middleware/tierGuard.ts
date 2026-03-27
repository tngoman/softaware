/**
 * tierGuard.ts — Reusable tier-limit enforcement helpers.
 *
 * Every creation endpoint should call the relevant guard BEFORE inserting.
 * On violation the guard throws an HttpError(403) with a user-friendly
 * upgrade message so the frontend can display it.
 */

import { db } from '../db/mysql.js';
import { TierLimits } from '../config/tiers.js';
import { requireActivePackageForUser } from '../services/packageResolver.js';

// ── Lightweight HTTP error ───────────────────────────────────────────────
class TierLimitError extends Error {
  status = 403;
  code = 'TIER_LIMIT_EXCEEDED';
  resource: string;
  current: number;
  limit: number;
  tier: string;

  constructor(resource: string, current: number, limit: number, tier: string) {
    super(
      `Your ${tier} plan allows a maximum of ${limit} ${resource}. ` +
      `You currently have ${current}. Please upgrade your plan to add more.`
    );
    this.resource = resource;
    this.current = current;
    this.limit = limit;
    this.tier = tier;
  }
}

export { TierLimitError };

// ── Resolve a user's active contact-linked package → TierLimits ──────────
export async function getUserTierLimits(userId: string | number): Promise<{ tierName: string; limits: TierLimits }> {
  const pkg = await requireActivePackageForUser(userId);
  return { tierName: pkg.packageSlug, limits: pkg.limits };
}

// ── Guard: Sites (maxSites) ──────────────────────────────────────────────
export async function guardMaxSites(userId: string | number): Promise<void> {
  const { tierName, limits } = await getUserTierLimits(userId);
  const row = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM generated_sites WHERE user_id = ?',
    [userId]
  );
  const current = row?.cnt ?? 0;
  if (current >= limits.maxSites) {
    throw new TierLimitError('sites', current, limits.maxSites, tierName);
  }
}

// ── Guard: Assistants / Widgets (maxWidgets) ─────────────────────────────
export async function guardMaxAssistants(userId: string | number): Promise<void> {
  const { tierName, limits } = await getUserTierLimits(userId);
  const row = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
    [userId]
  );
  const current = row?.cnt ?? 0;
  if (current >= limits.maxWidgets) {
    throw new TierLimitError('assistants', current, limits.maxWidgets, tierName);
  }
}

// ── Guard: Knowledge pages (maxKnowledgePages) ───────────────────────────
export async function guardMaxKnowledgePages(userId: string | number, assistantId: string): Promise<void> {
  const { tierName, limits } = await getUserTierLimits(userId);

  // Count completed ingestion jobs across ALL of this user's assistants
  const userAssistants = await db.query<{ id: string }>(
    'SELECT id FROM assistants WHERE userId = ?',
    [userId]
  );
  if (userAssistants.length === 0) return; // No assistants → no pages

  const ids = userAssistants.map(a => a.id);
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ingestion_jobs
     WHERE assistant_id IN (${ids.map(() => '?').join(',')})
       AND status IN ('completed', 'pending', 'processing')`,
    ids
  );
  const current = row?.cnt ?? 0;
  if (current >= limits.maxKnowledgePages) {
    throw new TierLimitError('knowledge pages', current, limits.maxKnowledgePages, tierName);
  }
}

// ── Guard: Collections per site (maxCollectionsPerSite) ──────────────────
export async function guardMaxCollections(clientId: string | number): Promise<void> {
  const { tierName, limits } = await getUserTierLimits(clientId);
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(DISTINCT collection_name) as cnt
     FROM client_custom_data WHERE client_id = ?`,
    [clientId]
  );
  const current = row?.cnt ?? 0;
  if (current >= limits.maxCollectionsPerSite) {
    throw new TierLimitError('collections', current, limits.maxCollectionsPerSite, tierName);
  }
}

// ── Guard: Check if adding a NEW collection (not an existing one) ────────
export async function guardNewCollection(clientId: string | number, collectionName: string): Promise<void> {
  // If the collection already exists for this client, no new collection is being created
  const existing = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM client_custom_data
     WHERE client_id = ? AND collection_name = ?`,
    [clientId, collectionName]
  );
  if ((existing?.cnt ?? 0) > 0) return; // Adding to existing collection — OK

  // It's a new collection — check against the limit
  await guardMaxCollections(clientId);
}

// ── Get all current usage counts for a user (for the frontend) ───────────
export async function getUserUsageCounts(userId: string | number) {
  const { tierName, limits } = await getUserTierLimits(userId);

  // Sites
  const sitesRow = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM generated_sites WHERE user_id = ?',
    [userId]
  );

  // Assistants
  const assistantsRow = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM assistants WHERE userId = ?',
    [userId]
  );

  // Knowledge pages (across all assistants)
  const userAssistants = await db.query<{ id: string }>(
    'SELECT id FROM assistants WHERE userId = ?',
    [userId]
  );
  let pagesCount = 0;
  if (userAssistants.length > 0) {
    const ids = userAssistants.map(a => a.id);
    const pagesRow = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ingestion_jobs
       WHERE assistant_id IN (${ids.map(() => '?').join(',')})
         AND status IN ('completed', 'pending', 'processing')`,
      ids
    );
    pagesCount = pagesRow?.cnt ?? 0;
  }

  // Collections (distinct collection names across all CMS data)
  const collectionsRow = await db.queryOne<{ cnt: number }>(
    'SELECT COUNT(DISTINCT collection_name) as cnt FROM client_custom_data WHERE client_id = ?',
    [userId]
  );

  return {
    tier: tierName,
    sites: { used: sitesRow?.cnt ?? 0, limit: limits.maxSites },
    assistants: { used: assistantsRow?.cnt ?? 0, limit: limits.maxWidgets },
    knowledgePages: { used: pagesCount, limit: limits.maxKnowledgePages },
    collections: { used: collectionsRow?.cnt ?? 0, limit: limits.maxCollectionsPerSite },
    storage: { limitBytes: limits.maxStorageBytes },
    actionsPerMonth: { limit: limits.maxActionsPerMonth },
    allowedSiteType: limits.allowedSiteType,
  };
}
