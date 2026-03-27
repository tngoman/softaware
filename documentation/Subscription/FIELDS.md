# Subscription Fields & Data Reference

> **v3.0.0 — Hybrid Package Catalog**
> Legacy credit tables (`credit_packages`, `credit_balances`, `credit_transactions`,
> `package_transactions`, `subscription_tier_limits`) remain permanently dropped.
> The `packages` and `contact_packages` tables have been **restored** with a rebuilt
> architecture (see sections 8–10 below).
>
> **Terminology:** "Actions" = unified billing metric. "System Actions" = technical AI function calls.

---

## 1. User Tier Fields — `users` table

These three columns are the entire user-scoped pricing system:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `plan_type` | `ENUM('free','starter','pro','advanced','enterprise')` | `'free'` | Current tier — determines ALL access limits via `config/tiers.ts` |
| `has_used_trial` | `BOOLEAN` | `FALSE` | **Permanent flag.** Once TRUE, cannot be reset. Prevents trial re-use. |
| `trial_expires_at` | `DATETIME NULL` | `NULL` | When the current trial ends. NULL = no active trial. Cleared on downgrade. |

**Added by:** Migration `031_trial_columns.ts`

### Access Resolution Flow

```
users.plan_type → getLimitsForTier(plan_type) → TierLimits object → enforce limits
```

There is **no join** to any pricing/limits table. The single `plan_type` string resolves to a static `TierLimits` object from `config/tiers.ts`.

---

## 2. TierLimits Interface — `config/tiers.ts`

The canonical type for all tier limits:

```typescript
export type TierName = 'free' | 'starter' | 'pro' | 'advanced' | 'enterprise';

export interface TierLimits {
  name: string;                  // Display name ("Free", "Starter", etc.)
  priceZAR: number | 'Custom';  // Monthly price in ZAR (not cents)
  gatewayPlanId: string | null;  // Yoco plan identifier
  maxSites: number;              // Max generated sites
  maxWidgets: number;            // Max widget clients
  maxCollectionsPerSite: number; // Max collections per site
  maxStorageBytes: number;       // Max storage in bytes
  maxActionsPerMonth: number;    // Monthly action cap (chatbot + webhook = 1 Action each)
  allowAutoRecharge: boolean;    // Can auto-charge R99/1000 extra actions on overage
  maxKnowledgePages: number;     // Knowledge base page limit
  allowedSiteType: string;       // Highest allowed site type
  canRemoveWatermark: boolean;   // Can remove "Powered by SoftAware"
  allowedSystemActions: string[];// Feature gates: email_capture, payment_gateway_hook, api_webhook, custom_middleware
  hasCustomKnowledgeCategories: boolean;
  hasOmniChannelEndpoints: boolean;
  ingestionPriority: number;     // 1–5 (higher = faster ingestion queue)
}
```

### OVERAGE_CONFIG — `config/tiers.ts`

```typescript
export const OVERAGE_CONFIG = {
  priceZAR: 99,        // R99 per action pack
  actionPackSize: 1000, // 1,000 additional actions per charge
} as const;
```

### Static Tier Values

| Field | Free | Starter | Pro | Advanced | Enterprise |
|-------|------|---------|-----|----------|------------|
| `priceZAR` | 0 | 349 | 699 | 1,499 | Custom |
| `maxSites` | 1 | 3 | 10 | 25 | 999 |
| `maxWidgets` | 1 | 3 | 10 | 25 | 999 |
| `maxCollectionsPerSite` | 1 | 6 | 15 | 40 | 999 |
| `maxStorageBytes` | 5 MB | 50 MB | 200 MB | 1 GB | 5 GB+ |
| `maxActionsPerMonth` | 500 | 2,000 | 5,000 | 20,000 | 999,999 |
| `allowAutoRecharge` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `maxKnowledgePages` | 50 | 200 | 500 | 2,000 | 99,999 |
| `allowedSiteType` | single_page | classic_cms | ecommerce | web_application | headless |
| `canRemoveWatermark` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `hasOmniChannelEndpoints` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `ingestionPriority` | 1 | 2 | 3 | 4 | 5 |

### allowedSystemActions by Tier

| System Action | Free | Starter | Pro | Advanced | Enterprise |
|---------------|------|---------|-----|----------|------------|
| `email_capture` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `payment_gateway_hook` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `api_webhook` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `custom_middleware` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 2b. Dashboard Trial Metrics — Frontend Interface

Returned by `GET /dashboard/metrics` and consumed by `Dashboard.tsx`:

```typescript
interface DashboardMetrics {
  // ...existing stats...
  trial?: {
    hasUsedTrial: boolean;   // Permanent flag — TRUE once trial used
    isOnTrial: boolean;      // Currently in an active trial
    expiresAt: string | null;// ISO 8601 trial end date
    daysRemaining: number;   // Days left (0 if not on trial)
    canStartTrial: boolean;  // TRUE only if free tier AND never trialled
  };
}
```

**`canStartTrial` computation:** `!has_used_trial && plan_type === 'free'` — this drives the trial activation banner visibility.

## 2c. AuthModel Register — Frontend Type

```typescript
// AuthModel.register() parameter
{ name: string; email: string; password: string; company_name?: string; phone?: string; address?: string; trial?: boolean }

// AuthModel.register() response
{ success: boolean; message: string; trialActivated?: boolean; data: { token: string; user: User } }
```

---

## 3. Widget Client Fields — `widget_clients` table

Key subscription-related columns on widget clients:

| Column | Type | Description |
|--------|------|-------------|
| `subscription_tier` | `VARCHAR` | Current tier of this widget (maps to TierName) |
| `monthly_price` | `DECIMAL` | Price paid — set from `TierLimits.priceZAR` on upgrade |
| `messages_this_cycle` | `INT` | Counter reset on upgrade; checked against `maxActionsPerMonth` |
| `branding_enabled` | `BOOLEAN` | TRUE for free tier (watermark shown), FALSE for paid |
| `status` | `VARCHAR` | `'active'` / `'suspended'` (frozen by trial enforcer) |
| `tone_preset` | `VARCHAR` | AI tone setting |
| `lead_capture_enabled` | `BOOLEAN` | Requires `email_capture` in tier's `allowedSystemActions` |
| `preferred_model` | `VARCHAR` | AI model preference |

---

## 4. Yoco Checkout Fields — `yoco_checkouts` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary key |
| `yoco_checkout_id` | `VARCHAR` | Yoco's external checkout ID |
| `user_id` | `VARCHAR` | User who initiated checkout |
| `contact_id` | `INT` | Associated contact |
| `action` | `VARCHAR` | Always `'SUBSCRIBE'` now (no more `PURCHASE_CREDITS`) |
| `amount` | `INT` | Amount in ZAR cents |
| `display_name` | `VARCHAR` | e.g. "SoftAware Pro Plan — Monthly" |
| `status` | `VARCHAR` | `'pending'` / `'completed'` / `'failed'` |
| `mode` | `VARCHAR` | `'live'` or `'test'` (from `sys_settings.yoco_mode`) |
| `payment_id` | `VARCHAR NULL` | Yoco payment ID (set on completion) |
| `metadata` | `JSON` | Contains `{ "softaware_target_tier": "pro" }` |
| `created_at` | `DATETIME` | Creation timestamp |
| `updated_at` | `DATETIME` | Last update timestamp |

---

## 5. Yoco Refunds — `yoco_refunds` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary key |
| `checkout_id` | `INT` | FK to `yoco_checkouts.id` |
| `yoco_refund_id` | `VARCHAR` | Yoco's refund ID |
| `amount` | `INT` | Refund amount in ZAR cents |
| `reason` | `VARCHAR` | Reason for refund |
| `status` | `VARCHAR` | `'pending'` / `'completed'` / `'failed'` |
| `idempotency_key` | `VARCHAR UNIQUE` | Prevents duplicate refunds |

---

## 6. Generated Sites Freeze Fields — `generated_sites` table

| Column | Type | Description |
|--------|------|-------------|
| `status` | `VARCHAR` | Set to `'locked_tier_limit'` when user exceeds free tier's `maxSites` after downgrade |
| `created_at` | `DATETIME` | Used by freeze algorithm (oldest sites survive) |

---

## 7. Team Subscription Fields (Legacy) — `subscriptions` & `subscription_plans` tables

These tables are retained for desktop app team billing but are **separate** from the user-scoped `plan_type` system.

| Table | Key Columns |
|-------|------------|
| `subscription_plans` | `id`, `tier` (PERSONAL/TEAM/ENTERPRISE), `name`, `priceMonthly`, `priceAnnually`, `maxTeamMembers`, `features` |
| `subscriptions` | `id`, `teamId`, `planId`, `status`, `billingCycle`, `trialEndsAt`, `currentPeriodEnd`, `cancelledAt` |
| `invoices` | `id`, `subscriptionId`, `invoiceNumber`, `subtotal`, `vatAmount`, `total`, `dueDate`, `paidAt`, `pdfUrl` |

---

## Dropped Tables (v2.0.0 — permanently removed)

| Table | Former Purpose | Migration |
|-------|---------------|-----------|
| `credit_packages` | Purchasable credit bundles | `030_purge_legacy_pricing.ts` |
| `package_transactions` | Credit purchase history | `030_purge_legacy_pricing.ts` |
| `subscription_tier_limits` | Dynamic tier limits (DB-driven) — replaced by `packages` columns | `030_purge_legacy_pricing.ts` |
| `credit_balances` | Per-contact credit balance | Already removed prior |
| `credit_transactions` | Per-request credit deductions | Already removed prior |

---

## 8. Package Catalog — `packages` table (v3.0.0)

The `packages` table stores admin-editable package definitions with full tier-limit columns. Each column overrides the corresponding `config/tiers.ts` fallback when non-NULL.

### Original Columns (pre-existing)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary key |
| `slug` | `VARCHAR(50)` | Unique identifier (e.g. `free`, `starter`, `pro`, `advanced`, `enterprise`, `staff`) |
| `name` | `VARCHAR(100)` | Display name |
| `description` | `VARCHAR(500) NULL` | Package description |
| `package_type` | `ENUM('CONSUMER','ENTERPRISE','STAFF','ADDON')` | Package category |
| `price_monthly` | `INT` | Monthly price in ZAR **cents** (e.g. 34900 = R349) |
| `price_annually` | `INT NULL` | Annual price in ZAR cents |
| `max_users` | `INT NULL` | Legacy: max users per package |
| `max_agents` | `INT NULL` | Legacy: max AI agents (mapped to `maxWidgets` by resolver) |
| `max_widgets` | `INT NULL` | Max standalone AI widgets |
| `max_landing_pages` | `INT NULL` | Legacy: max landing pages (mapped to `maxSites` by resolver) |
| `max_enterprise_endpoints` | `INT NULL` | Max enterprise API endpoints |
| `features` | `JSON` | Feature list as JSON string array |
| `is_active` | `TINYINT(1)` | Whether package is active (soft-delete flag) |
| `is_public` | `TINYINT(1)` | Whether package appears on public pricing pages |
| `display_order` | `INT` | Sort order for UI display |
| `featured` | `TINYINT(1)` | Whether to highlight this package in pricing UI |
| `cta_text` | `VARCHAR(50)` | Call-to-action button text |
| `created_at` | `DATETIME` | Creation timestamp |
| `updated_at` | `DATETIME` | Last update timestamp |

### Tier-Limit Columns (added by Migration 032)

| Column | Type | Description |
|--------|------|-------------|
| `gateway_plan_id` | `VARCHAR(100) NULL` | Payment gateway plan identifier |
| `max_sites` | `INT NULL` | Maximum sites (overrides `config/tiers.ts.maxSites` if non-NULL) |
| `max_collections_per_site` | `INT NULL` | Maximum collections per site |
| `max_storage_bytes` | `BIGINT NULL` | Storage limit in bytes |
| `max_actions_per_month` | `INT NULL` | Monthly action cap |
| `allow_auto_recharge` | `TINYINT(1) DEFAULT 0` | Whether overage billing is allowed |
| `max_knowledge_pages` | `INT NULL` | Knowledge base page limit |
| `allowed_site_type` | `VARCHAR(32) DEFAULT 'single_page'` | Highest site type: `single_page` / `classic_cms` / `ecommerce` / `web_application` / `headless` |
| `can_remove_watermark` | `TINYINT(1) DEFAULT 0` | Watermark removal permission |
| `allowed_system_actions` | `JSON NULL` | Array of allowed system action strings (e.g. `["email_capture","payment_gateway_hook"]`) |
| `has_custom_knowledge_categories` | `TINYINT(1) DEFAULT 0` | Custom knowledge categories flag |
| `has_omni_channel_endpoints` | `TINYINT(1) DEFAULT 0` | Omni-channel endpoints flag |
| `ingestion_priority` | `INT DEFAULT 1` | Ingestion queue priority (1–10, higher = faster) |

---

## 9. Contact–Package Assignments — `contact_packages` table (v3.0.0)

Links contacts (companies) to packages. Each contact has at most one active package assignment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT AUTO_INCREMENT` | Primary key |
| `contact_id` | `INT` | FK to `contacts.id` |
| `package_id` | `INT` | FK to `packages.id` |
| `status` | `VARCHAR` | `'ACTIVE'` / `'TRIAL'` / `'CANCELLED'` |
| `billing_cycle` | `VARCHAR` | `'MONTHLY'` / `'ANNUALLY'` / `'NONE'` |
| `credits_balance` | `INT` | Legacy column (always 0) |
| `credits_used` | `INT` | Legacy column (always 0) |
| `current_period_start` | `DATETIME` | Billing period start date |
| `current_period_end` | `DATETIME` | Billing period end date |
| `cancelled_at` | `DATETIME NULL` | When the assignment was cancelled |
| `created_at` | `DATETIME` | Creation timestamp |
| `updated_at` | `DATETIME` | Last update timestamp |

---

## 10. Package Resolution Interfaces (v3.0.0)

### `PackageCatalogRow` (from `services/packageResolver.ts`)

TypeScript interface representing a raw `packages` table row. All tier-limit columns are optional (nullable) — when NULL, the static fallback from `config/tiers.ts` is used.

### `ResolvedUserPackage` (from `services/packageResolver.ts`)

| Property | Type | Description |
|----------|------|-------------|
| `contactId` | `number` | Resolved contact ID |
| `contactPackageId` | `number` | `contact_packages.id` |
| `packageId` | `number` | `packages.id` |
| `packageSlug` | `string` | Package slug (e.g. `pro`) |
| `packageName` | `string` | Package display name |
| `packageStatus` | `string` | `'ACTIVE'` or `'TRIAL'` |
| `limits` | `TierLimits` | Fully resolved tier limits (DB overrides merged with static fallbacks) |
| `rawPackage` | `PackageCatalogRow` | Raw database row |
