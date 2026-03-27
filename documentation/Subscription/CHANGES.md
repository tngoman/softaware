# Subscription Changelog

---

## v3.0.0 — Hybrid Package Catalog (April 2026)

The `packages` and `contact_packages` tables have been **restored** with a rebuilt architecture. Pricing is now a hybrid system: `config/tiers.ts` provides static fallbacks while admin-editable `packages` rows carry their own tier-limit overrides, resolved at runtime by a new `packageResolver` service.

### New Features

| Feature | File | Description |
|---------|------|-------------|
| Package Catalog DB | `migrations/032_package_limits_catalog.ts` | Adds 13 tier-limit columns to `packages` table, seeds 6 canonical packages |
| Package Resolver | `services/packageResolver.ts` | Hybrid resolver: DB package → static fallback. Core interfaces (`PackageCatalogRow`, `ResolvedUserPackage`) |
| Package Access Middleware | `middleware/packageAccess.ts` | `requireActivePackageAccess` + `requireOwnerPackageAccess` enforce contact→package link |
| Admin Package CRUD | `routes/adminPackages.ts` | Full CRUD: list, create, update packages + assign/reassign contacts |
| Public Packages API | `routes/publicPackages.ts` | `GET /api/public/packages` — active + public packages for pricing pages |
| Admin Packages UI | `pages/admin/AdminPackages.tsx` | Tabbed admin page: Packages catalog, Client Assignments, Create Package |
| Admin Packages Model | `models/AdminPackagesModel.ts` | Frontend API model with typed interfaces and methods |
| Dynamic Landing Pricing | `pages/public/LandingPage.tsx` | Fetches live pricing from `/api/public/packages` with hardcoded fallback |
| User–Package Sync | `services/packageResolver.ts` | `syncUsersForContactPackage()` keeps `users.plan_type` in sync when packages are assigned |

### New Files

| File | Type | Purpose |
|------|------|---------|
| `services/packageResolver.ts` | Service | Hybrid tier resolution: user → contact → contact_packages → packages → `TierLimits` |
| `middleware/packageAccess.ts` | Middleware | Route-level package enforcement (active package link required) |
| `routes/adminPackages.ts` | Route | Admin package CRUD + contact assignment |
| `routes/publicPackages.ts` | Route | Public package listing endpoint |
| `pages/admin/AdminPackages.tsx` | Frontend | Tabbed admin UI with search/filter, accordion cards, toggle switches |
| `models/AdminPackagesModel.ts` | Frontend | Typed interfaces (`AdminPackage`, `PackageContactAssignment`, `PackagePayload`) + API |

### New Database Columns — `packages` table (Migration 032)

| Column | Type | Description |
|--------|------|-------------|
| `gateway_plan_id` | `VARCHAR(100) NULL` | Yoco/payment gateway plan identifier |
| `max_sites` | `INT NULL` | Maximum sites (overrides `config/tiers.ts` if non-NULL) |
| `max_collections_per_site` | `INT NULL` | Maximum collections per site |
| `max_storage_bytes` | `BIGINT NULL` | Storage limit in bytes |
| `max_actions_per_month` | `INT NULL` | Monthly action cap |
| `allow_auto_recharge` | `TINYINT(1) DEFAULT 0` | Whether overage billing is allowed |
| `max_knowledge_pages` | `INT NULL` | Knowledge base page limit |
| `allowed_site_type` | `VARCHAR(32) DEFAULT 'single_page'` | Highest site type allowed |
| `can_remove_watermark` | `TINYINT(1) DEFAULT 0` | Watermark removal permission |
| `allowed_system_actions` | `JSON NULL` | Array of allowed system action strings |
| `has_custom_knowledge_categories` | `TINYINT(1) DEFAULT 0` | Custom knowledge categories flag |
| `has_omni_channel_endpoints` | `TINYINT(1) DEFAULT 0` | Omni-channel endpoints flag |
| `ingestion_priority` | `INT DEFAULT 1` | Ingestion queue priority (1–10) |

### Restored Database Tables

| Table | Purpose | Migration |
|-------|---------|-----------|
| `contact_packages` | Per-contact package assignment with billing cycle, status, period dates | Pre-existing (was dropped in 030, restored by manual DB operations) |

### Seeded Packages (6 canonical)

| Slug | Type | Price (ZAR) | Public |
|------|------|-------------|--------|
| `free` | CONSUMER | R0 | ✅ |
| `starter` | CONSUMER | R349 | ✅ |
| `pro` | CONSUMER | R699 | ✅ |
| `advanced` | CONSUMER | R1,499 | ✅ |
| `enterprise` | ENTERPRISE | Custom | ✅ |
| `staff` | STAFF | R0 (internal) | ❌ |

### Architecture Changes

| Before (v2.0.0) | After (v3.0.0) |
|-----------------|----------------|
| Tier limits only in `config/tiers.ts` (static) | Tier limits in `packages` table (editable) with `config/tiers.ts` as fallback |
| No `packages` or `contact_packages` tables | Both tables restored with full schema |
| `users.plan_type` is sole access authority | `plan_type` is a denormalized cache; package catalog is authoritative |
| No package enforcement middleware | `requireActivePackageAccess` + `requireOwnerPackageAccess` |
| No admin package management UI | Tabbed admin page with CRUD, contact assignment, search/filter |
| Static pricing on landing page | Dynamic pricing from `/api/public/packages` with static fallback |
| No public package API | `GET /api/public/packages` endpoint |

---

## v2.0.2 — Trial Frontend Implementation (March 2026)

### Summary

Full end-to-end trial engine wired across landing page, registration, portal dashboard, and site builder. Four distinct entry points all converge on `POST /billing/start-trial` or the registration `trial` flag.

### Backend Changes

| File | Changes |
|------|---------|
| `routes/auth.ts` | `RegisterSchema` now accepts `trial: z.boolean().optional()`. On `trial: true`, auto-activates 14-day Starter trial during registration (no second API call). Response includes `trialActivated: boolean`. |
| `routes/dashboard.ts` | Queries `plan_type`, `has_used_trial`, `trial_expires_at`. Returns `trial` object: `hasUsedTrial`, `isOnTrial`, `expiresAt`, `daysRemaining`, `canStartTrial`. |
| `routes/billing.ts` | Created — `POST /start-trial`, `GET /trial-status` |
| `services/trialEnforcer.ts` | Created — hourly cron sweep, oldest-survives freeze |
| `app.ts` | Mounts billing router at `/billing`, starts trial enforcer at boot |
| `db/mysql.ts` | `User` interface: added `plan_type`, `has_used_trial`, `trial_expires_at`, `contact_id` |
| `db/migrations/031_trial_columns.ts` | Adds 3 columns + index. **Run & applied.** |

### Frontend Changes

| File | Changes |
|------|---------|
| `LandingPage.tsx` | Hero CTA → "Start 14-Day Free Trial" links to `/register?trial=true`. Starter card badge → "14-Day Free Trial". Starter CTA → "Start 14-Day Free Trial". |
| `RegisterPage.tsx` | Reads `?trial=true` via `useSearchParams`. Shows trial heading, badge ("14 days free • Downgrades to Free automatically"), submit button "Start Free Trial". Passes `trial: true` to `AuthModel.register()`. |
| `Dashboard.tsx` | Added trial activation banner (blue gradient, `RocketLaunchIcon`, "Start 14-Day Free Trial" button calling `POST /billing/start-trial`). Added trial countdown banner (amber gradient, `ClockIcon`, days remaining, "Upgrade Now — R349/mo" link). |
| `SiteBuilderEditor.tsx` | Queue Swal for free-tier users now includes upsell: "⚡ Want to skip the queue?" with "Start Free Trial & Skip Queue" confirm button. Calls `POST /billing/start-trial` directly from editor. |
| `AuthModel.ts` | `register()` signature: added `trial?: boolean`. Response type: added `trialActivated?: boolean`. Removed `as any` cast. |

### Trial Entry Points

| Entry Point | Component | Trigger | Backend Call |
|-------------|-----------|---------|-------------|
| Landing page CTA | `LandingPage.tsx` | Click hero/card button | Navigates to `/register?trial=true` |
| Registration form | `RegisterPage.tsx` | Submit with `?trial=true` | `POST /auth/register` with `trial: true` |
| Portal dashboard | `Dashboard.tsx` | Click "Start 14-Day Free Trial" | `POST /billing/start-trial` |
| Site builder queue | `SiteBuilderEditor.tsx` | Click "Start Free Trial & Skip Queue" | `POST /billing/start-trial` |

### Database Changes

Migration `031_trial_columns.ts` executed — added `plan_type VARCHAR(20)`, `has_used_trial BOOLEAN`, `trial_expires_at DATETIME NULL`, and `idx_users_trial_expiry` index to `users` table.

---

## v2.0.1 — Terminology Alignment (March 2026)

### Summary

Renamed billing metric fields and added auto-recharge overage support:

- `maxAiMessagesPerMonth` → `maxActionsPerMonth` — unified billing metric for chatbot + webhook
- `allowedActions` → `allowedSystemActions` — prevents confusion between billing "Actions" and technical AI function calls
- Added `allowAutoRecharge` boolean per tier — controls whether overage billing is allowed
- Added `OVERAGE_CONFIG` global constant — R99 per 1,000 extra actions

### Field Renames

| Before | After | Reason |
|--------|-------|--------|
| `maxAiMessagesPerMonth` | `maxActionsPerMonth` | Unified metric: chatbot response OR webhook execution = 1 Action |
| `allowedActions` | `allowedSystemActions` | Disambiguate from billing "Actions" — these are technical AI function calls |

### New Fields

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `allowAutoRecharge` | `boolean` | `TierLimits` interface | Whether the tier can auto-charge for overage (false = hard cap) |
| `OVERAGE_CONFIG` | `{ priceZAR, actionPackSize }` | `config/tiers.ts` export | R99 per 1,000 extra actions |

### Files Modified

| File | Changes |
|------|---------|
| `config/tiers.ts` | All renames + new fields + OVERAGE_CONFIG export |
| `routes/billing.ts` | `maxAiMessagesPerMonth` → `maxActionsPerMonth` in trial response |
| `routes/subscriptionTiers.ts` | Both field renames in enrichment + tiers endpoint + config validation |
| `routes/dashboard.ts` | `maxAiMessagesPerMonth` → `maxActionsPerMonth` in usage calc |
| `middleware/usageTracking.ts` | All 5 references to `maxAiMessagesPerMonth` → `maxActionsPerMonth` |

### NOT Modified (by design)

| File | Reason |
|------|--------|
| `routes/clientApiGateway.ts` | Local `allowedActions` variable parses `config.allowed_actions` DB column — per-client API config, not tier system actions |
| `migrations/027_seed_client_api_configs.ts` | Same — client API config actions, not tier system actions |

---

## v2.0.0 — Static Tier Pricing (March 2026)

### Summary

Complete removal of the legacy dynamic credit/package system. All pricing is now static,
defined in a single file (`config/tiers.ts`). No database-driven pricing, no per-request
credit deductions, no credit balances.

### Breaking Changes

- **All credit-related endpoints removed** — `GET /credits/balance`, `POST /credits/purchase`, etc.
- **All package endpoints removed** — `GET /packages`, `POST /packages`, etc.
- **Stripe gateway removed** — all Stripe endpoints return 410 Gone
- **PayFast gateway removed** — no IPNs, no PayFast integration
- **`subscription_tier_limits` table dropped** — tier limits are now static in code
- **`contact_packages` table dropped** — per-contact subscriptions replaced by `users.plan_type`
- **`package_transactions` table dropped** — transaction history removed
- **`credit_packages` table dropped** — credit bundles removed

### New Features

| Feature | File | Description |
|---------|------|-------------|
| Static tier config | `config/tiers.ts` | 5 canonical tiers with all limits hard-coded |
| Trial engine | `routes/billing.ts` | One-time 14-day Starter trial with abuse prevention |
| Trial enforcer | `services/trialEnforcer.ts` | Hourly background sweep + graceful freeze |
| Graceful freeze | `services/trialEnforcer.ts` | Oldest-survives asset locking on downgrade |
| Static tier API | `routes/subscriptionTiers.ts` | Rewritten to read from config, not DB |
| Yoco-only payments | `routes/yoco.ts` | Checkout, polling, webhook — all plan-based |

### Deleted Files

| File | Type | Former Purpose |
|------|------|---------------|
| `routes/credits.ts` | Route | Credit balance, purchase, transaction list |
| `routes/adminCredits.ts` | Route | Admin credit adjustment CRUD |
| `routes/packages.ts` | Route | Package CRUD endpoints |
| `services/credits.ts` | Service | Balance operations, per-request deduction |
| `services/packages.ts` | Service | Contact-package lifecycle management |
| `services/payment.ts` | Service | PayFast IPN, legacy payment creation |
| `config/credits.ts` | Config | AI request pricing (cost per model) |
| `middleware/credits.ts` | Middleware | Pre-request credit balance check |
| `middleware/packages.ts` | Middleware | Package enforcement |
| `pages/admin/AICredits.tsx` | Frontend | Admin credits management panel |
| `pages/admin/AIPackages.tsx` | Frontend | Admin packages management panel |

### Dropped Database Tables (later restored in v3.0.0)

> **Note:** The `contact_packages` table was restored in v3.0.0. The `packages` table was never
> actually dropped (only its legacy rows were replaced). `credit_packages`, `package_transactions`,
> and `subscription_tier_limits` remain permanently removed.

| Table | Migration | Former Purpose |
|-------|-----------|---------------|
| `credit_packages` | `030_purge_legacy_pricing.ts` | Purchasable credit bundles (permanently removed) |
| `contact_packages` | `030_purge_legacy_pricing.ts` | Per-contact subscriptions — **restored in v3.0.0** |
| `package_transactions` | `030_purge_legacy_pricing.ts` | Credit purchase transaction history (permanently removed) |
| `subscription_tier_limits` | `030_purge_legacy_pricing.ts` | Dynamic tier limit definitions (permanently removed — replaced by `packages` columns) |

### New Database Columns

| Table | Column | Type | Migration |
|-------|--------|------|-----------|
| `users` | `plan_type` | `ENUM('free','starter','pro','advanced','enterprise')` | Pre-existing (default changed to 'free') |
| `users` | `has_used_trial` | `BOOLEAN DEFAULT FALSE` | `031_trial_columns.ts` |
| `users` | `trial_expires_at` | `DATETIME NULL` | `031_trial_columns.ts` |

### Architecture Changes

| Before (v1.x) | After (v2.0.0) |
|---------------|----------------|
| Tier limits in `subscription_tier_limits` table | Tier limits in `config/tiers.ts` (static) |
| Per-request credit deduction via middleware | Monthly action cap per tier (no middleware) |
| Credits purchased as bundles via packages | Flat monthly subscription per tier |
| PayFast + Stripe + Yoco gateways | Yoco only (Stripe returns 410) |
| `contact_packages` table for subscriptions | `users.plan_type` column (single string) |
| Dynamic pricing in database | Static pricing in code |
| No trial system | 14-day one-time Starter trial with abuse prevention |
| Hard delete on downgrade | Graceful freeze (oldest survives) |

---

## v1.x — Legacy Credit System (Historical)

> This version is no longer supported. All code has been removed.

- Credit-based pricing with per-request deductions
- Dynamic package bundles stored in database
- Multiple payment gateways (PayFast, Stripe, Yoco)
- Middleware-enforced credit checks before AI requests
- Admin-managed credit packages and adjustments
