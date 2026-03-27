# Pro Package & Enterprise Ecosystem — Overview

**Version:** 1.1.0  
**Last Updated:** 2026-03-28

---

## 1. Module Overview

### Purpose

The Pro Package module implements the **full package tier system, enforcement middleware, enterprise endpoint management, client API gateway, and trial engine** for the Soft Aware platform. It governs what every contact/client can do — from how many sites they can build to whether they can create enterprise API endpoints.

The system operates on a **cross-database architecture**:

1. **MySQL (softaware DB)** — Package catalog, contact-to-package assignments, tier limits, trial state, user-contact links, credit/transaction history
2. **SQLite (enterprise_endpoints.db)** — Enterprise webhook endpoints, client API gateway configs, request logs — linked back to MySQL contacts via `contact_id`

**Key capabilities:**

- **5-Tier Package System** — Free → Starter → Pro → Advanced → Enterprise (+ Staff internal). Each tier defines limits for sites, widgets, actions, knowledge pages, storage, endpoints, and feature gates
- **Contact-Scoped Packages** — Packages are assigned to contacts (companies), not individual users. All users linked to a contact inherit that contact's package limits
- **Package Enforcement Middleware** — Reusable Express guards that block resource creation when tier limits are exceeded (enterprise endpoints, API gateways, knowledge pages)
- **Trial Degradation Engine** — Pro trials run on **Free tier limits**. The client sees "Pro" branding but is capped at Free resources until payment activates full Pro
- **Trial Enforcer Cron** — Hourly background sweep that expires trial rows in both `contact_packages` and `users` tables, then freezes over-limit assets
- **Enterprise Endpoints** — Dynamic webhook URLs (`/api/v1/enterprise/:client_id`) with full LLM config, IP restrictions, daily-rotating auth, and kill switch
- **Client API Gateway** — Proxy gateway configs defining how the platform forwards requests to a client's real API (auth, rate limits, timeouts, tool definitions). All tools have full capability regardless of tier — the only trial limitation is Free tier resource caps
- **Visual Tool Builder** — Admin UI for graphically building OpenAI function-calling tool definitions, with one-click sync to linked enterprise endpoints
- **Kill Switch** — Both local (client-side) and remote (portal) mechanisms to instantly sever API connections
- **Vision Gate** — `hasVision` per-tier boolean. Files/images are rejected BEFORE processing unless the contact's package is Advanced or Enterprise. Enforced in assistants, mobile AI, and enterprise webhook routes
- **Client Usage Stats API** — Client-facing `GET /api/v1/client-api/:clientId/usage` endpoint authenticated via shared secret, returning daily/action breakdowns and recent requests
- **Integration Spec Export** — Generic and per-gateway v2.0.0 JSON integration specifications that tell external developers exactly how to build their API
- **Tool-Picker Import Flow** — Admin import of gateway configs from integration specs with a multi-step tool selection UI
- **Package Badge UI** — Gradient-styled package tier badges throughout the admin portal (Pro = violet, Enterprise = amber, etc.)
- **Auto-Recharge System** — Tier-gated overage billing when action limits are exceeded

### Business Value

- **Tier differentiation** — Pro is genuinely different from Free (5 users, 10 sites, 2 endpoints vs 1/1/0)
- **Risk-free enterprise onboarding** — Clients experience Pro with Free limits, upgrade unlocks full power
- **Zero-knowledge security** — Client API Gateway forwards requests without storing client data
- **Universal enforcement** — Every resource creation route checks the contact's package before allowing it
- **Self-service + admin paths** — Users can start trials themselves; staff can assign any package to any contact
- **Cross-DB consistency** — SQLite resources (endpoints, gateways) are linked to MySQL contacts via `contact_id`

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend middleware files | 2 (458 LOC) |
| Backend service files | 4 (1,288 LOC) |
| Backend route files | 7 (2,317 LOC) |
| Backend config files | 1 (139 LOC) |
| Backend migration files | 3 (685 LOC) |
| Frontend page files | 3 (2,553 LOC) |
| Frontend model files | 2 (698 LOC) |
| Frontend barrel export | 1 (97 LOC) |
| **Total files** | **23** |
| **Total LOC** | **~8,200** |
| MySQL tables | 4 (packages, contact\_packages, package\_transactions, user\_contact\_link) |
| SQLite tables | 4 (enterprise\_endpoints, client\_api\_configs, endpoint\_requests, client\_api\_logs) |
| Admin API endpoints | 31 (packages: 5, endpoints: 9, gateways: 12, billing: 2, client usage: 3) |
| Package tiers | 6 (free, starter, pro, advanced, enterprise, staff) |
| Enforcement guards | 7 (endpoint, gateway, knowledge page, system action, inline quota, vision access, vision middleware) |
| Trial systems | 2 (user-level 14-day Starter, contact-level Pro with Free limits) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Tailwind)                            │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ Admin Pages (src/pages/admin/)                                             │  │
│  │  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │  │
│  │  │ AdminPackages    │  │ EnterpriseEndpoints│  │ ClientApiConfigs       │  │  │
│  │  │ 958 LOC          │  │ 641 LOC            │  │ 1,595 LOC              │  │  │
│  │  │ • Package CRUD   │  │ • Endpoint CRUD    │  │ • Gateway CRUD         │  │  │
│  │  │ • Contact assign │  │ • IP restrictions  │  │ • Visual Tool Builder  │  │  │
│  │  │ • Tier limits    │  │ • LLM config       │  │ • Kill Switch toggle   │  │  │
│  │  │ • Badge display  │  │ • Status toggle    │  │ • Tool Sync to EP      │  │  │
│  │  │                  │  │ • Request logs     │  │ • Import / Export flow │  │  │
│  │  │                  │  │ • Analytics        │  │ • Tool-Picker import   │  │  │
│  │  └──────────────────┘  └───────────────────┘  └────────────────────────┘  │  │
│  └───────────────────────────────┬────────────────────────────────────────────┘  │
│                                  │                                               │
│  ┌───────────────────────────────▼────────────────────────────────────────────┐  │
│  │ Models (src/models/)                                                       │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────────┐   │  │
│  │  │ AdminPackagesModel   │  │ AdminAIModels (AdminClientApiModel,      │   │  │
│  │  │ 126 LOC              │  │ AdminEnterpriseModel) — 572 LOC          │   │  │
│  │  │ • getPackages()      │  │ • CRUD for endpoints + gateways          │   │  │
│  │  │ • getContacts()      │  │ • syncTools(), getLogs(), exportTemplate()│   │  │
│  │  │ • assignContact()    │  │ • importConfig(), getEndpointTools()     │   │  │
│  │  └──────────────────────┘  └──────────────────────────────────────────┘   │  │
│  └───────────────────────────────┬────────────────────────────────────────────┘  │
│                                  │                                               │
│                        REST API calls via Axios                                  │
└──────────────────────────────────┼───────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express + TypeScript)                          │
│                                                                                  │
│  ┌─── Middleware Layer ──────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  packageAccess.ts (54 LOC)          packageEnforcement.ts (404 LOC)       │   │
│  │  • requireActivePackageAccess()     • enforceEndpointLimit()              │   │
│  │  • requireOwnerPackageAccess()      • enforceGatewayLimit()               │   │
│  │                                     • enforceKnowledgePageLimit()          │   │
│  │  Applied to ALL /api/* routes       • createSystemActionGuard()           │   │
│  │  (general access gate)              • checkVisionAccess()                 │   │
│  │                                     • enforceVisionAccess()               │   │
│  │                                     Applied to specific POST routes       │   │
│  │                                     (resource creation + vision gates)    │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─── Route Layer ───────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  adminPackages.ts         adminEnterpriseEndpoints.ts                     │   │
│  │  339 LOC · 5 endpoints    237 LOC · 9 endpoints                           │   │
│  │  /admin/packages/*        /admin/enterprise-endpoints/*                   │   │
│  │                                                                           │   │
│  │  adminClientApiConfigs.ts billing.ts                                      │   │
│  │  932 LOC · 12 endpoints   128 LOC · 2 endpoints                           │   │
│  │  /admin/client-api/*      /api/billing/*                                  │   │
│  │                                                                           │   │
│  │  clientApiGateway.ts (route) — 258 LOC · 3 client-facing endpoints        │   │
│  │  /api/v1/client-api/* (tool proxy, usage stats, health check)             │   │
│  │                                                                           │   │
│  │  assistantIngest.ts (enforceKnowledgePageLimit + enforceVisionAccess)     │   │
│  │  widgetIngest.ts (client.max_pages tier-aware limit)                      │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─── Service Layer ─────────────────────────────────────────────────────────┐   │
│  │                                                                           │   │
│  │  packageResolver.ts (219 LOC)     clientApiGateway.ts (497 LOC)           │   │
│  │  • getActivePackageForUser()      • createConfig() / updateConfig()       │   │
│  │  • packageRowToTierLimits()       • generateDailyToken()                  │   │
│  │  • resolveTrialLimits()           • buildAuthHeaders()                    │   │
│  │                                   • validateClientSecret()                │   │
│  │                                   • getUsageStats()                       │   │
│  │                                                                           │   │
│  │  enterpriseEndpoints.ts (414 LOC) trialEnforcer.ts (158 LOC)              │   │
│  │  • createEndpoint() / update()    • startTrialEnforcer()                  │   │
│  │  • getByClientId() / getAll()     • sweepExpiredContactTrials()           │   │
│  │  • rotateToken() / updateIp()     • sweepExpiredTrials() (user-level)     │   │
│  │                                   • freezeOverLimitAssets()               │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─── Config ────────────┐  ┌─── Migrations ────────────────────────────────┐   │
│  │ tiers.ts (139 LOC)    │  │ 023_packages_system.ts (408 LOC)              │   │
│  │ • TIER_LIMITS          │  │ 031_trial_columns.ts (78 LOC)                │   │
│  │ • getLimitsForTier()   │  │ 032_package_limits_catalog.ts (198 LOC)      │   │
│  │ • OVERAGE_CONFIG       │  └───────────────────────────────────────────────┘   │
│  │ • hasVision per tier   │                                                      │
│  └────────────────────────┘                                                      │
└──────────────────┬───────────────────────────────┬───────────────────────────────┘
                   │                               │
                   ▼                               ▼
     ┌──────────────────────┐        ┌──────────────────────────────┐
     │  MySQL (softaware)   │        │  SQLite (enterprise_endpoints│
     │                      │        │          .db)                │
     │  packages            │◄─ contact_id ─► enterprise_endpoints  │
     │  contact_packages    │◄─ contact_id ─► client_api_configs    │
     │  package_transactions│        │  endpoint_requests           │
     │  user_contact_link   │        │  client_api_logs             │
     │  users (trial cols)  │        └──────────────────────────────┘
     │  contacts            │
     └──────────────────────┘
```

---

## 3. Tier Progression

| Tier | Price | Users | Sites | Widgets | Actions/mo | Pages | Endpoints | Storage | Site Type | Watermark | Vision |
|------|-------|-------|-------|---------|------------|-------|-----------|---------|-----------|-----------|--------|
| **Free** | R0 | 1 | 1 | 1 | 500 | 50 | 0 | 5 MB | single\_page | ❌ | ❌ |
| **Starter** | R349 | 3 | 5 | 3 | 2,000 | 200 | 0 | 50 MB | single\_page | ✅ | ❌ |
| **Pro** | R699 | 5 | 10 | 10 | 5,000 | 500 | 2 | 200 MB | ecommerce | ✅ | ❌ |
| **Advanced** | R1,499 | 10 | 25 | 25 | 20,000 | 2,000 | 5 | 1 GB | web\_app | ✅ | ✅ |
| **Enterprise** | Custom | 999 | 999 | 999 | 999,999 | 99,999 | 999 | 5 GB+ | headless | ✅ | ✅ |
| **Staff** | Internal | 999 | 999 | 999 | 999,999 | 99,999 | 999 | 5 GB+ | headless | ✅ | ✅ |

### System Actions by Tier

| Action | Free | Starter | Pro | Advanced | Enterprise |
|--------|------|---------|-----|----------|------------|
| `email_capture` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `payment_gateway_hook` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `api_webhook` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `custom_middleware` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Trial System

Two parallel trial mechanisms serve different audiences:

| Layer | Table | Trigger | Limits During Trial | Duration |
|-------|-------|---------|-------------------|----------|
| **User-level** | `users` | Self-service `/api/billing/start-trial` | Full Starter limits | 14 days |
| **Contact-level (Pro)** | `contact_packages` | Admin assigns with `status: 'TRIAL'` | **Free tier limits** | Set by `current_period_end` |

The Pro trial uses **contact-level assignment**. The function `resolveTrialLimits()` in `packageResolver.ts` intercepts all limit resolution and returns `getLimitsForTier('free')` when `status = 'TRIAL'` for CONSUMER packages. Enterprise/Staff trials are exempt (full limits).

### Trial Lifecycle

```
ONBOARD → Staff assigns Pro to contact with status='TRIAL'
  ↓
DURING → Client sees "Pro" branding, gets Free tier limits
  ↓
UPGRADE → Payment activates → status='ACTIVE' → full Pro limits instantly
  ↓ (or)
EXPIRE → trialEnforcer sweep → status='EXPIRED' → access revoked (403)
```

---

## 5. Enforcement Chain

Every request flows through the same resolution chain:

```
User Request
  → requireActivePackageAccess (packageAccess.ts)
    → getActivePackageForUser(userId)
      → user → contact_id → contact_packages (ACTIVE|TRIAL)
      → packageRowToTierLimits(rawPackage)
      → resolveTrialLimits(status, type, limits)  ← degrades TRIAL → Free
  → enforceEndpointLimit / enforceGatewayLimit / enforceKnowledgePageLimit
    → resolveContactPackage(contactId)
      → same join, same trial degradation
      → checks count vs limit → 403 or next()
  → enforceVisionAccess (image/file routes)
    → checkVisionAccess(contactId)
      → pkg.limits.hasVision → false = 403, true = next()
```

### What Is Enforced Today

| Limit | Guard | Location |
|-------|-------|----------|
| Enterprise endpoint count | `enforceEndpointLimit` | POST /admin/enterprise-endpoints |
| Client API gateway count | `enforceGatewayLimit` | POST /admin/client-api |
| Knowledge pages per assistant | `enforceKnowledgePageLimit` | POST /assistants/:id/ingest/url, /file |
| Widget knowledge pages | `client.max_pages` check | POST /api/v1/ingest/url, /file |
| Actions per month | `checkUsageLimits` | POST /api/v1/chat |
| Sites | `checkSiteLimit` guard | Site creation routes |
| Widgets | `checkWidgetLimit` guard | Widget creation routes |
| Collections per site | `checkCollectionLimit` guard | Collection creation routes |
| Vision / file processing | `checkVisionAccess` / `enforceVisionAccess` | Chat image upload, mobile AI, enterprise webhook |

### Not Yet Enforced

| Limit | Status |
|-------|--------|
| `maxStorageBytes` | No upload size tracking |
| `canRemoveWatermark` | Client-side only |
| `ingestionPriority` | Config exists, not used in queue logic |

---

## 6. Cross-Database Linking

SQLite resources are linked to MySQL contacts via `contact_id`:

```
MySQL: contacts (id=68, "SA Water Works")
  ↓ contact_id=68
MySQL: contact_packages (package_id=10, status='ACTIVE')
  ↓ contact_id=68
SQLite: enterprise_endpoints (client_id='silulumanzi', contact_id=68)
  ↓ contact_id=68
SQLite: client_api_configs (client_id='silulumanzi', contact_id=68)
```

When enforcement middleware runs, it:
1. Reads `contact_id` from the SQLite resource or request body
2. Queries MySQL to resolve the contact's active package
3. Counts existing SQLite resources for that contact
4. Compares count vs package limit
