# Pro Package & Enterprise Ecosystem — Changelog

All notable changes to the Pro Package system are documented here.

---

## [1.1.0] — 2026-03-28

### 🔭 Vision Gate, Tool Simplification & Client Usage Stats

This release adds vision/file processing as a hard-gated package feature, removes
the read/action tool classification system, adds client-facing usage statistics,
and introduces a full import/export flow for gateway integration specs.

---

### Added

#### Vision Gate (`packageEnforcement.ts` +70 LOC → 404 total)

- **`hasVision: boolean`** field added to `TierLimits` interface in `tiers.ts` (now 18 fields)
  - `false` for Free, Starter, Pro
  - `true` for Advanced, Enterprise (and Staff)
- **`has_vision`** column mapped in `packageResolver.ts` → `packageRowToTierLimits()`
- **`checkVisionAccess(contactId)`** — inline utility returning `{ allowed, packageName, packageSlug, reason? }`. Files/images rejected **before** any processing occurs
- **`enforceVisionAccess`** — Express middleware wrapper for route-level vision enforcement

#### Vision Gate Wiring

- **`assistants.ts`** — Vision gate added before image processing in chat handler
- **`mobileAIProcessor.ts`** — Vision gate added before image processing
- **`enterpriseWebhook.ts`** — Replaced hardcoded Kone vision gate with package-based `checkVisionAccess()`

#### Client Usage Stats API (`clientApiGateway.ts` +172 LOC → 497 total)

- **`UsageSummary`** interface — period totals, daily breakdown, per-action breakdown, recent requests
- **`validateClientSecret(config, token)`** — validates raw secret, today's rolling token, or yesterday's token (grace period)
- **`getUsageStats(config, days, recentLimit)`** — aggregates from `client_api_logs` with configurable lookback

#### Client Usage Stats Route (`routes/clientApiGateway.ts` — 258 LOC)

- **`GET /api/v1/client-api/:clientId/usage`** — client-facing endpoint authenticated via `X-Client-Secret` header
  - Accepts `days` (1–90, default 30) and `recent` (0–100, default 25) query params
  - Returns: summary stats, daily breakdown, per-action breakdown, recent requests
- **`GET /api/v1/client-api/:clientId/health`** — quick health check (no auth required)

#### Integration Spec Export (`adminClientApiConfigs.ts` +660 LOC → 932 total)

- **`GET /admin/client-api-configs/export-template`** — generic v2.0.0 integration spec JSON
  - Describes request format, auth methods, tool definition format, response expectations, usage stats endpoint
  - Self-documenting: tells the client's developer exactly how to build their API
- **`GET /admin/client-api-configs/:id/export`** — per-gateway integration spec with pre-filled values (base URL, auth type, tools, usage stats URL)

#### Tool-Picker Import Flow

- **`POST /admin/client-api-configs/import`** — imports gateway config from integration spec JSON
  - Multi-step UI flow: upload spec → select tools → review → create
  - `enforceGatewayLimit` middleware applied
  - Sets `allowed_actions` = all selected tools (no tier-based tool gating)
- **`GET /admin/client-api-configs/endpoint-tools/:endpointId`** — returns tool catalog from a linked enterprise endpoint's `llm_tools_config`

#### Frontend Import/Export UI (`ClientApiConfigs.tsx` +259 LOC → 1,595 total)

- Tool-picker import modal with step-by-step workflow
- Export button per gateway config
- Generic export-template download button

#### Frontend Model Methods (`AdminAIModels.ts` +44 LOC → 572 total)

- **`importConfig(payload)`** — POST to /import endpoint
- **`getEndpointTools(endpointId)`** — GET tool catalog from endpoint
- **`exportTemplate()`** — GET generic integration spec

### Changed

#### Tool Capability Simplification (BREAKING)

- **REMOVED** `capability` field from frontend `ToolDef` interface
- **REMOVED** read/action classification UI (dropdown, badges, counts) from `ClientApiConfigs.tsx`
- **REMOVED** tier-based `allowed_actions` gating — external developers define tools freely
- All tools now have **full capability** regardless of package tier
- The only trial limitation is Free tier **resource caps** (sites, widgets, actions/month, etc.)
- `allowed_actions` on client_api_configs now serves as a **security whitelist** — prevents calling arbitrary endpoints on the target API. Unregistered tools return `UNKNOWN_TOOL` error

#### Schema Updates

- `client_api_configs` table — `client_name TEXT NOT NULL` added, `total_requests INTEGER DEFAULT 0` added, `last_request_at TEXT` added
- `ClientApiConfig` interface updated with `client_name`, `total_requests`, `last_request_at` fields

#### Export Templates

- Both generic and per-gateway exports include `usage_stats` section documenting the client-facing stats endpoint
- Version bumped to `2.0.0` format

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| hasVision as hard gate (not soft) | Files rejected BEFORE processing — no wasted compute on ineligible packages |
| Vision on Advanced+ only | Maintains clear upgrade incentive between Pro and Advanced |
| Remove read/action tool gating | External devs define tools freely; simplifies import; trial limits handled by resource caps |
| allowed_actions as security whitelist | Prevents arbitrary endpoint calls on target API; UNKNOWN_TOOL error for unregistered tools |
| Client-facing usage stats via shared secret | Clients can integrate stats without needing admin portal access |
| Rolling token + yesterday grace period | Handles timezone edge cases around midnight UTC without requiring clock sync |

---

## [1.0.0] — 2026-03-22

### 🏗️ Foundation — Complete Pro Package Ecosystem

This release establishes the full package enforcement, trial degradation, and
cross-database linking infrastructure for the Soft Aware platform.

---

### Added

#### Database & Schema

- **`contact_id INTEGER`** column added to SQLite tables:
  - `enterprise_endpoints` — links endpoints to MySQL contacts
  - `client_api_configs` — links gateway configs to MySQL contacts
- **Migration 027** — adds `contact_id` to enterprise endpoints table via ALTER TABLE
- **Migration 023** — base packages system (packages, contact_packages, package limit columns)
- **Migration 031** — trial columns (has_used_trial, trial_expires_at on users)
- **Migration 032** — full package limits catalog (17 limit columns on packages table)

#### Enforcement Middleware (`packageEnforcement.ts` — 335 LOC)

- **`resolveContactPackage(contactId)`** — resolves a contact's active package from MySQL, applies trial degradation, returns `ContactPackageInfo` with full limits
- **`enforceEndpointLimit`** — Express middleware gating `POST /admin/enterprise-endpoints` on `max_enterprise_endpoints`
- **`enforceGatewayLimit`** — Express middleware gating `POST /admin/client-api-configs` on `max_enterprise_endpoints` (shared pool)
- **`enforceKnowledgePageLimit`** — Express middleware gating assistant ingest on `max_knowledge_pages`
- **`createSystemActionGuard(actionName)`** — factory for action-specific guards against `allowed_system_actions`
- **`checkContactEndpointQuota(contactId)`** — utility returning `{ allowed, current, limit }` for endpoint quota checks

#### Trial Degradation (`packageResolver.ts`)

- **`resolveTrialLimits(status, type, limits)`** — when `status='TRIAL'` and package type is `CONSUMER`, returns Free tier limits instead of full package limits
- Applied in both `getActivePackageForUser()` (user-level) and `resolveContactPackage()` (contact-level enforcement)
- Enterprise and Staff packages are **exempt** from trial degradation

#### Contact-Level Trial Sweep (`trialEnforcer.ts`)

- **`sweepExpiredContactTrials()`** — new phase in hourly cron: finds `contact_packages WHERE status='TRIAL' AND current_period_end < NOW()` and sets `status='EXPIRED'`
- Runs before user-level trial sweep in the main enforcer loop

#### Package Limit Updates (MySQL — live)

- **Pro package**: `max_enterprise_endpoints` 0 → 2, `max_users` 1 → 5
- **Advanced package**: `max_enterprise_endpoints` 0 → 5, `max_users` 1 → 10

### Changed

#### Backend Service Layer

- **`clientApiGateway.ts`** — `ClientApiConfig` interface and CREATE TABLE now include `contact_id`; INSERT statement includes `contact_id` binding
- **`enterpriseEndpoints.ts`** — CREATE TABLE schema now includes `contact_id INTEGER`
- **`widgetIngest.ts`** — replaced hardcoded `pages_ingested >= 50` with dynamic `client.max_pages || 50` (tier-aware)

#### Route Wiring

- **`adminEnterpriseEndpoints.ts`** — `POST /` now passes through `enforceEndpointLimit` middleware
- **`adminClientApiConfigs.ts`** — `POST /` now passes through `enforceGatewayLimit` middleware; Zod schemas include `contact_id`
- **`assistantIngest.ts`** — `POST /url` and `POST /file` now pass through `enforceKnowledgePageLimit` middleware

#### Frontend

- **`AdminAIModels.ts`** — `ClientApiConfig` and `CreateClientApiConfigPayload` interfaces include `contact_id` field
- **`ClientApiConfigs.tsx`** — new `PackageBadge` component with gradient styling per tier; "Account / Package" table column; contact dropdown in create/edit form; fallback resolution chain (`config.contact_id` → `endpoint.contact_id`)

### Live Data

- **Silulumanzi** (contact_id = 68) — assigned to Enterprise package, `client_api_configs.contact_id` set to 68 via `ALTER TABLE` + `UPDATE`

---

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Packages assigned to contacts, not users | Team inheritance — all users under a contact get the same limits |
| Trial → Free limits (not full package) | Prevents trial abuse; incentivises payment for actual features |
| Enterprise/Staff bypass all enforcement | Enterprise clients pay for custom terms; Staff need unrestricted access |
| Cross-DB via `contact_id` column | SQLite resources link to MySQL contacts without complex joins |
| Shared endpoint pool (endpoints + gateways) | `max_enterprise_endpoints` covers both; simplifies limit management |
| Daily token rotation for API gateway | Zero-knowledge auth that automatically invalidates; no revocation needed |

---

### Files Created

| File | LOC | Purpose |
|------|-----|---------|
| `src/middleware/packageEnforcement.ts` | 335 | Reusable enforcement middleware |
| `documentation/ProPackage/README.md` | ~300 | System overview |
| `documentation/ProPackage/FILES.md` | ~350 | File inventory |
| `documentation/ProPackage/FIELDS.md` | ~300 | Database schema reference |
| `documentation/ProPackage/PATTERNS.md` | ~300 | Architecture patterns |
| `documentation/ProPackage/ROUTES.md` | ~400 | API route reference |
| `documentation/ProPackage/CHANGES.md` | this | Changelog |

### Files Modified

| File | Change Summary |
|------|---------------|
| `src/services/packageResolver.ts` | Added `resolveTrialLimits()`, applied in `getActivePackageForUser()` |
| `src/services/trialEnforcer.ts` | Added `sweepExpiredContactTrials()` phase |
| `src/services/clientApiGateway.ts` | Added `contact_id` to schema, interface, INSERT |
| `src/services/enterpriseEndpoints.ts` | Added `contact_id` to CREATE TABLE |
| `src/routes/adminEnterpriseEndpoints.ts` | Wired `enforceEndpointLimit` on POST / |
| `src/routes/adminClientApiConfigs.ts` | Wired `enforceGatewayLimit` on POST /; added contact_id to Zod |
| `src/routes/assistantIngest.ts` | Wired `enforceKnowledgePageLimit` on POST /url and /file |
| `src/routes/widgetIngest.ts` | Dynamic `client.max_pages` instead of hardcoded 50 |
| `frontend/src/services/AdminAIModels.ts` | Added `contact_id` to interfaces |
| `frontend/src/pages/AdminAI/ClientApiConfigs.tsx` | PackageBadge, contact dropdown, account column |
| `documentation/Enterprise/ProPackage_Ecosystem.md` | Added Section 5 (Pro Trial System) |

---

### Tier Limits at Release

| Tier | Sites | Widgets | Actions/mo | Pages | Endpoints | Storage | Site Type |
|------|-------|---------|------------|-------|-----------|---------|-----------|
| Free | 1 | 1 | 500 | 50 | 0 | 5 MB | single_page |
| Starter | 3 | 3 | 2,000 | 200 | 0 | 50 MB | classic_cms |
| **Pro** | **10** | **10** | **5,000** | **500** | **2** | **200 MB** | **ecommerce** |
| Advanced | 25 | 25 | 15,000 | 2,000 | 5 | 1 GB | web_application |
| Enterprise | 999 | 999 | 999,999 | 99,999 | 999 | 50 GB | headless |

> **Pro Trial** uses Free tier limits (1 site, 1 widget, 500 actions, 50 pages, 0 endpoints, 5 MB).
