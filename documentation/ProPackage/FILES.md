# Pro Package & Enterprise Ecosystem — File Inventory

**Version:** 1.1.0  
**Last Updated:** 2026-03-28

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total source files** | 23 (+ 3 integration files modified) |
| **Total LOC** | ~8,200 |
| **Backend middleware files** | 2 (458 LOC) |
| **Backend service files** | 4 (1,288 LOC) |
| **Backend route files** | 7 (2,317 LOC) |
| **Backend config files** | 1 (139 LOC) |
| **Backend migration files** | 3 (684 LOC) |
| **Frontend page files** | 3 (2,553 LOC) |
| **Frontend model files** | 2 (698 LOC) |
| **Frontend barrel export** | 1 (97 LOC) |

### Directory Tree

```
Backend:
  src/config/tiers.ts                               (139 LOC)  ⭐ tier limit definitions + getLimitsForTier() + hasVision
  src/middleware/packageAccess.ts                     (54 LOC)  general package access gate
  src/middleware/packageEnforcement.ts               (404 LOC)  ⭐ 7 enforcement guards + vision gate + inline quota
  src/services/packageResolver.ts                   (219 LOC)  ⭐ core resolver: user → contact → package → limits
  src/services/trialEnforcer.ts                     (158 LOC)  hourly cron: expire trials + freeze assets
  src/services/clientApiGateway.ts                  (497 LOC)  ⭐ SQLite CRUD + usage stats + client secret validation
  src/services/enterpriseEndpoints.ts               (414 LOC)  ⭐ SQLite CRUD for enterprise webhook endpoints
  src/routes/adminPackages.ts                       (339 LOC)  admin CRUD + contact assignment
  src/routes/adminEnterpriseEndpoints.ts            (237 LOC)  admin CRUD + IP restrictions + analytics
  src/routes/adminClientApiConfigs.ts               (932 LOC)  admin CRUD + import/export + tool picker + logs
  src/routes/clientApiGateway.ts                    (258 LOC)  ⭐ client-facing: tool proxy + usage stats + health
  src/routes/billing.ts                             (128 LOC)  user-level trial activation + status
  src/routes/assistantIngest.ts                     (281 LOC)  ⚡ modified: enforceKnowledgePageLimit on POST
  src/routes/widgetIngest.ts                        (244 LOC)  ⚡ modified: client.max_pages tier-aware limit
  src/db/migrations/023_packages_system.ts          (408 LOC)  ⭐ foundational: packages + contact_packages + transactions + user_contact_link
  src/db/migrations/031_trial_columns.ts             (78 LOC)  user-level trial columns on users table
  src/db/migrations/032_package_limits_catalog.ts   (198 LOC)  13 new limit columns on packages table

Frontend:
  src/pages/admin/AdminPackages.tsx                  (958 LOC)  ⭐ package catalog + contact assignment UI
  src/pages/admin/EnterpriseEndpoints.tsx            (641 LOC)  ⭐ endpoint management UI
  src/pages/admin/ClientApiConfigs.tsx             (1,595 LOC)  ⭐ gateway config + tool builder + import/export + tool picker
  src/models/AdminAIModels.ts                       (572 LOC)  ⭐ API clients: AdminClientApiModel + AdminEnterpriseModel
  src/models/AdminPackagesModel.ts                  (126 LOC)  API client: packages + contacts + assignment
  src/models/index.ts                                (97 LOC)  barrel exports

Related files (modified by this module, not owned by it):
  src/components/Layout/Layout.tsx                 (~574 LOC)  "AI & Enterprise" nav section (lines 95–105)
  src/App.tsx                                      (~300 LOC)  routes: /admin/packages, /admin/enterprise, /admin/client-api
  src/routes/assistants.ts                        (1,552 LOC)  ⚡ vision gate before image processing in chat
  src/services/mobileAIProcessor.ts                (483 LOC)  ⚡ vision gate before image processing
  src/routes/enterpriseWebhook.ts                  (914 LOC)  ⚡ package-based vision gate replacing hardcoded check
```

---

## 2. Backend Files

### 2.1 `src/config/tiers.ts` — Tier Limit Definitions

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/config/tiers.ts` |
| **LOC** | 139 |
| **Purpose** | Hardcoded tier definitions used as fallback when database package rows are missing columns. Defines the 5-tier pricing matrix, overage config, and vision gate per tier. |
| **Dependencies** | None |
| **Exports** | `TierName`, `TierLimits`, `TIER_LIMITS`, `getLimitsForTier()`, `OVERAGE_CONFIG` |

#### Exports

| Export | Kind | Description |
|--------|------|-------------|
| `TierName` | Type | `'free' \| 'starter' \| 'pro' \| 'advanced' \| 'enterprise'` |
| `TierLimits` | Interface | 18-field interface: name, priceZAR, gatewayPlanId, maxSites, maxWidgets, maxCollectionsPerSite, maxStorageBytes, maxActionsPerMonth, allowAutoRecharge, maxKnowledgePages, allowedSiteType, canRemoveWatermark, allowedSystemActions, hasCustomKnowledgeCategories, hasOmniChannelEndpoints, **hasVision**, ingestionPriority |
| `TIER_LIMITS` | Const | `Record<TierName, TierLimits>` — all 5 tiers' hardcoded limits |
| `getLimitsForTier()` | Function | `(tierName: string) → TierLimits` — safe lookup with free-tier fallback |
| `OVERAGE_CONFIG` | Const | `{ priceZAR: 99, actionPackSize: 1000 }` — auto-recharge overage pricing |

---

### 2.2 `src/middleware/packageAccess.ts` — General Package Gate

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/packageAccess.ts` |
| **LOC** | 54 |
| **Purpose** | Lightweight middleware that requires the requesting user (or resource owner) to have any active package. No limit counting — just "has package or 403." Applied to all authenticated `/api/*` routes. |
| **Dependencies** | middleware/auth, services/packageResolver, db/mysql |
| **Exports** | `requireActivePackageAccess`, `requireOwnerPackageAccess` |

#### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `requireActivePackageAccess` | `async (req, res, next) → void` | Checks the authenticated user has an active package via `requireActivePackageForUser()` |
| `requireOwnerPackageAccess` | `async (req, res, next) → void` | Resolves the owner of an assistant/widget and checks they have an active package |

---

### 2.3 `src/middleware/packageEnforcement.ts` — Enforcement Guards

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/packageEnforcement.ts` |
| **LOC** | 404 |
| **Purpose** | Reusable Express guards that resolve a contact's package tier and enforce specific limits before allowing resource creation. Works with the contact-scoped package system (contacts → contact\_packages → packages). Includes vision gate for file/image processing. |
| **Dependencies** | middleware/auth, db/mysql, services/packageResolver, services/enterpriseEndpoints, services/clientApiGateway |
| **Exports** | `resolveContactPackage`, `enforceEndpointLimit`, `enforceGatewayLimit`, `enforceKnowledgePageLimit`, `createSystemActionGuard`, `checkContactEndpointQuota`, `checkVisionAccess`, `enforceVisionAccess` |

#### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `resolveContactPackage` | `async (contactId: number) → ContactPackageInfo \| null` | Core resolver: MySQL join contacts → contact\_packages → packages. Applies `resolveTrialLimits()` — returns Free limits for TRIAL status. |
| `enforceEndpointLimit` | Express middleware | Blocks POST if contact exceeds `max_enterprise_endpoints`. Requires `contact_id` in body. Enterprise/Staff bypass. |
| `enforceGatewayLimit` | Express middleware | Blocks POST if contact exceeds gateway limit (uses `max_enterprise_endpoints` as cap). |
| `enforceKnowledgePageLimit` | Express middleware | Blocks ingestion if assistant owner's `pages_indexed ≥ maxKnowledgePages`. Resolves assistant → owner → contact → package. |
| `createSystemActionGuard` | `(actionName: string) → Express middleware` | Factory: returns middleware checking `allowedSystemActions` for the user's package. |
| `checkContactEndpointQuota` | `async (contactId: number) → { allowed, current, limit, packageName, packageSlug }` | Inline utility for programmatic quota checks (not middleware). |
| `checkVisionAccess` | `async (contactId: number) → { allowed, packageName, packageSlug, reason? }` | Checks if contact's package has `hasVision: true`. Returns denial reason if not. Used inline in assistants, mobile AI, enterprise webhook. |
| `enforceVisionAccess` | Express middleware | Route-level vision gate. Resolves user → contact → package, checks `hasVision`. Returns 403 with `VISION_NOT_AVAILABLE` error code if denied. |

#### Internal Types

| Type | Fields |
|------|--------|
| `ContactPackageInfo` | `contact_id`, `contact_name`, `package_slug`, `package_name`, `package_type`, `package_status`, `limits` (TierLimits), `rawPackage` (PackageCatalogRow) |

---

### 2.4 `src/services/packageResolver.ts` — Package Resolution Engine

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/packageResolver.ts` |
| **LOC** | 217 |
| **Purpose** | Core resolution engine. Maps user → contact → contact\_package → package row, converts raw DB row into typed `TierLimits`. Handles trial downgrade logic. |
| **Dependencies** | db/mysql, config/tiers |
| **Exports** | `PackageCatalogRow`, `ResolvedUserPackage`, `mapPackageToTierName`, `resolveTrialLimits`, `packageRowToTierLimits`, `getActivePackageForUser`, `requireActivePackageForUser`, `syncUsersForContactPackage`, `formatPublicPackage` |

#### Exports

| Export | Kind | Description |
|--------|------|-------------|
| `PackageCatalogRow` | Interface | 34-field interface matching the `packages` MySQL table |
| `ResolvedUserPackage` | Interface | `{ contactId, contactPackageId, packageId, packageSlug, packageName, packageStatus, limits, rawPackage }` |
| `mapPackageToTierName` | Function | `(slug, packageType?) → TierName` — maps slug to tier fallback |
| `resolveTrialLimits` | Function | `(packageStatus, packageType, fullLimits) → TierLimits` — **returns Free limits if TRIAL + CONSUMER** |
| `packageRowToTierLimits` | Function | `(pkg: PackageCatalogRow) → TierLimits` — converts raw DB row to typed limits with COALESCE fallback |
| `getActivePackageForUser` | Async | `(userId) → ResolvedUserPackage \| null` — main resolver: user → contact → active package |
| `requireActivePackageForUser` | Async | Same, but throws 403 if no package found |
| `syncUsersForContactPackage` | Async | `(contactId, pkg) → void` — updates `users.plan_type` + `storage_limit_bytes` |
| `formatPublicPackage` | Function | `(pkg) → public-safe object` — formats for API/frontend consumption |

---

### 2.5 `src/services/trialEnforcer.ts` — Trial Expiry Cron

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/trialEnforcer.ts` |
| **LOC** | 158 |
| **Purpose** | Background cron service (hourly sweep) that expires trial rows in both `contact_packages` and `users` tables, then freezes over-limit sites/widgets back to free-tier caps. |
| **Dependencies** | db/mysql, config/tiers |
| **Exports** | `startTrialEnforcer`, `stopTrialEnforcer`, `sweepExpiredTrials`, `freezeOverLimitAssets` |
| **Boot** | Called via `startTrialEnforcer()` in `app.ts` at server start |

#### Exports

| Export | Signature | Description |
|--------|-----------|-------------|
| `startTrialEnforcer` | `() → void` | Starts the hourly interval. Runs immediately on boot, then every 60 minutes. |
| `stopTrialEnforcer` | `() → void` | Clears the interval. |
| `sweepExpiredTrials` | `async () → void` | Phase 1: expires `contact_packages` TRIAL rows. Phase 2: downgrades `users` trials to free. |
| `freezeOverLimitAssets` | `async (userId: string) → void` | Locks sites to `locked_tier_limit`, suspends widgets beyond free-tier caps. |

#### Internal Functions

| Function | Description |
|----------|-------------|
| `sweepExpiredContactTrials` | Finds `contact_packages WHERE status='TRIAL' AND current_period_end < NOW()`, sets status to `'EXPIRED'` |

---

### 2.6 `src/services/clientApiGateway.ts` — Client API Gateway Service

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/clientApiGateway.ts` |
| **LOC** | 497 |
| **Purpose** | Manages the `client_api_configs` table in the enterprise SQLite database. Each config defines a proxy gateway to a client's real API (target URL, auth type, rate limits, timeouts). Also provides client-facing usage statistics and secret validation. |
| **Dependencies** | better-sqlite3 |
| **Exports** | `ClientApiConfig`, `ClientApiConfigInput`, `UsageSummary`, `generateRollingToken`, `getAllConfigs`, `getConfigById`, `getConfigByClientId`, `createConfig`, `updateConfig`, `deleteConfig`, `recordRequest`, `getRequestLogs`, `buildAuthHeaders`, `validateClientSecret`, `getUsageStats` |

#### SQLite Tables Created

- `client_api_configs` — 17 columns: gateway proxy configuration (incl. client_name, total_requests, last_request_at)
- `client_api_logs` — 8 columns: request logging

#### Key Exports

| Export | Kind | Description |
|--------|------|-------------|
| `ClientApiConfig` | Interface | 17 fields: id, client\_id, client\_name, endpoint\_id, contact\_id, target\_base\_url, auth\_type, auth\_secret, auth\_header, allowed\_actions (JSON), rate\_limit\_rpm, timeout\_ms, status, created\_at, updated\_at, total\_requests, last\_request\_at |
| `ClientApiConfigInput` | Interface | Creation subset: client\_id, client\_name, endpoint\_id?, contact\_id?, target\_base\_url, auth\_type, auth\_secret?, auth\_header?, allowed\_actions?, rate\_limit\_rpm?, timeout\_ms? |
| `UsageSummary` | Interface | Aggregated usage stats: client\_id, client\_name, status, total\_requests, last\_request\_at, period, period\_total/success/errors, avg\_response\_ms, daily\_breakdown[], action\_breakdown[], recent\_requests[] |
| `generateRollingToken` | Function | `(secret: string) → string` — `SHA256(secret + YYYY-MM-DD)` for daily-rotating auth |
| `buildAuthHeaders` | Function | `(config) → Record<string, string>` — builds rolling\_token/bearer/basic/api\_key headers |
| `validateClientSecret` | Function | `(config, token) → boolean` — validates raw secret, today's rolling token, or yesterday's token (grace period) |
| `getUsageStats` | Function | `(config, days?, recentLimit?) → UsageSummary` — aggregates from client\_api\_logs with daily/action breakdowns |
| `getAllConfigs` | Function | Returns all configs from SQLite |
| `createConfig` | Function | `(input) → ClientApiConfig` — inserts new config row |

---

### 2.7 `src/services/enterpriseEndpoints.ts` — Enterprise Endpoint Service

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/enterpriseEndpoints.ts` |
| **LOC** | 414 |
| **Purpose** | Manages the `enterprise_endpoints` table in SQLite. Each endpoint is a dynamic webhook URL (`/api/v1/enterprise/:client_id`) with full LLM config, inbound auth, outbound target API settings, and IP restrictions. |
| **Dependencies** | better-sqlite3, crypto |
| **Exports** | `EnterpriseEndpoint`, `EndpointInput`, `createEndpoint`, `updateEndpoint`, `getEndpointByClientId`, `getAllEndpoints`, `deleteEndpoint`, `toggleEndpointStatus`, `rotateEndpointToken`, `updateIpRestrictions`, `getEndpointRequests`, `logEndpointRequest`, `initializeDatabase` |

#### SQLite Tables Created

- `enterprise_endpoints` — 25+ columns: full endpoint configuration
- `endpoint_requests` — 8 columns: request logging

---

### 2.8 Route Files

#### `src/routes/adminPackages.ts` — Package Admin

| Property | Value |
|----------|-------|
| **LOC** | 339 |
| **Mount Point** | `/admin/packages` |
| **Endpoints** | 5 |
| **Purpose** | Admin CRUD for package definitions + contact-to-package assignment |

#### `src/routes/adminEnterpriseEndpoints.ts` — Enterprise Endpoint Admin

| Property | Value |
|----------|-------|
| **LOC** | 237 |
| **Mount Point** | `/admin/enterprise-endpoints` |
| **Endpoints** | 9 |
| **Purpose** | Admin CRUD + IP restrictions + analytics for enterprise endpoints |
| **Guards** | `enforceEndpointLimit` on POST / |

#### `src/routes/adminClientApiConfigs.ts` — Client API Gateway Admin

| Property | Value |
|----------|-------|
| **LOC** | 932 |
| **Mount Point** | `/admin/client-api-configs` |
| **Endpoints** | 12 |
| **Purpose** | Admin CRUD + import/export flow + tool picker + integration spec generation + request logs for client API gateway configs |
| **Guards** | `enforceGatewayLimit` on POST / and POST /import |

#### `src/routes/clientApiGateway.ts` — Client-Facing Gateway Routes

| Property | Value |
|----------|-------|
| **LOC** | 258 |
| **Mount Point** | `/api/v1/client-api` |
| **Endpoints** | 3 |
| **Purpose** | Client-facing tool proxy (POST /:clientId/:action), usage stats (GET /:clientId/usage authenticated via shared secret), and health check (GET /:clientId/health) |

#### `src/routes/billing.ts` — Trial Activation

| Property | Value |
|----------|-------|
| **LOC** | 128 |
| **Mount Point** | `/api/billing` |
| **Endpoints** | 2 |
| **Purpose** | User-facing trial activation (14-day Starter) and trial status check |

---

### 2.9 Migration Files

#### `src/db/migrations/023_packages_system.ts`

| Property | Value |
|----------|-------|
| **LOC** | 408 |
| **Tables Created** | `packages`, `contact_packages`, `package_transactions`, `user_contact_link` |
| **Seeds** | 7 packages (Free, Starter, Professional, BYOE, Managed, Custom, Staff) + Soft Aware staff assignment |

#### `src/db/migrations/031_trial_columns.ts`

| Property | Value |
|----------|-------|
| **LOC** | 78 |
| **Columns Added** | `users.plan_type` (VARCHAR 20), `users.has_used_trial` (BOOLEAN), `users.trial_expires_at` (DATETIME) |
| **Indexes** | `idx_users_trial_expiry` |

#### `src/db/migrations/032_package_limits_catalog.ts`

| Property | Value |
|----------|-------|
| **LOC** | 198 |
| **Purpose** | Extends `packages` table with 13 editable limit columns, making tier limits DB-driven instead of hardcoded |
| **Columns Added** | `max_sites`, `max_collections_per_site`, `max_storage_bytes`, `max_actions_per_month`, `allow_auto_recharge`, `max_knowledge_pages`, `allowed_site_type`, `can_remove_watermark`, `allowed_system_actions`, `has_custom_knowledge_categories`, `has_omni_channel_endpoints`, `ingestion_priority`, `max_enterprise_endpoints` |

---

## 3. Frontend Files

### 3.1 `src/pages/admin/AdminPackages.tsx`

| Property | Value |
|----------|-------|
| **LOC** | 958 |
| **Purpose** | Admin UI for managing the package catalog and contact-to-package assignments. Shows all packages with assignment counts, contact list with current package, and assign/reassign workflow. |
| **Route** | `/admin/packages` |
| **Dependencies** | AdminPackagesModel, SweetAlert2, @heroicons/react |

---

### 3.2 `src/pages/admin/EnterpriseEndpoints.tsx`

| Property | Value |
|----------|-------|
| **LOC** | 641 |
| **Purpose** | Admin UI for managing enterprise webhook endpoints. Create/edit forms, status toggles, IP restriction management, request logs viewer, analytics dashboard. |
| **Route** | `/admin/enterprise` |
| **Dependencies** | AdminEnterpriseModel (from AdminAIModels), SweetAlert2, @heroicons/react |

---

### 3.3 `src/pages/admin/ClientApiConfigs.tsx`

| Property | Value |
|----------|-------|
| **LOC** | 1,595 |
| **Purpose** | Full-featured admin UI for client API gateway management. Config CRUD, visual tool builder (OpenAI function-calling format), parameter editor, kill switch toggle, tool sync to linked enterprise endpoint, import/export flow with tool-picker modal, request logs, PackageBadge display with contact association. All tools have full capability (no read/action distinction). |
| **Route** | `/admin/client-api` |
| **Dependencies** | AdminClientApiModel, AdminPackagesModel, AdminEnterpriseModel (from AdminAIModels), SweetAlert2, @heroicons/react |

#### Inline Components

| Component | Purpose |
|-----------|---------|
| `PackageBadge` | Gradient-styled badge per tier slug (pro=violet, enterprise=amber, advanced=blue, starter=green, staff=rose, free=gray) |
| `StatusBadge` | Color-coded status dot (active=green, paused=yellow, disabled=red) |

---

### 3.4 `src/models/AdminAIModels.ts`

| Property | Value |
|----------|-------|
| **LOC** | 572 |
| **Purpose** | Frontend API client classes for enterprise endpoints and client API gateway configs |

#### Package-Related Exports

| Export | Kind | Description |
|--------|------|-------------|
| `EnterpriseEndpoint` | Interface | 28 fields — full endpoint config including `contact_id` |
| `EndpointInput` | Interface | Creation subset |
| `ClientApiConfig` | Interface | 17 fields — gateway config including `contact_id`, `client_name`, `total_requests`, `last_request_at` |
| `ClientApiConfigInput` | Interface | 11 fields — creation subset |
| `ClientApiLog` | Interface | 8 fields — request log entry |
| `AdminEnterpriseModel` | Class | 8 methods: getAll, getById, create, update, toggleStatus, updateIpRestrictions, delete, getLogs |
| `AdminClientApiModel` | Class | 11 methods: getAll, getByClientId, create, update, toggleStatus, delete, getLogs, syncTools, importConfig, getEndpointTools, exportTemplate |

---

### 3.5 `src/models/AdminPackagesModel.ts`

| Property | Value |
|----------|-------|
| **LOC** | 126 |
| **Purpose** | Frontend API client for the packages admin system |

#### Exports

| Export | Kind | Description |
|--------|------|-------------|
| `PackageLimits` | Interface | 14-field limits mirroring `TierLimits` |
| `Package` | Interface | Full package with limits + raw DB fields + assignmentCount |
| `PackageContactAssignment` | Interface | Contact + linked package info + user emails |
| `PackageInput` | Interface | Full creation/update payload |
| `AdminPackagesModel` | Class | 5 methods: getPackages, getContacts, createPackage, updatePackage, assignContact |

---

### 3.6 `src/models/index.ts`

| Property | Value |
|----------|-------|
| **LOC** | 97 |
| **Purpose** | Barrel re-exports for all model classes and types |
| **Package Exports** | `AdminPackagesModel`, `AdminClientApiModel`, `AdminEnterpriseModel`, `Package`, `PackageLimits`, `PackageContactAssignment`, `PackageInput`, `ClientApiConfig`, `ClientApiConfigInput`, `ClientApiLog`, `EnterpriseEndpoint`, `EndpointInput` |
