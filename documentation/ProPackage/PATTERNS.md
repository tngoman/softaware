# Pro Package & Enterprise Ecosystem — Architecture Patterns

**Version:** 1.1.0  
**Last Updated:** 2026-03-28

---

## 1. Contact-Scoped Package Model

The defining architectural decision: **packages are assigned to contacts (companies), not individual users.**

### Resolution Chain

```
User (users table)
  → contact_id (direct column on users)
  → FALLBACK: user_contact_link (role-ordered: OWNER > ADMIN > MEMBER > STAFF)
    → contact_id
      → contact_packages (status IN 'ACTIVE','TRIAL')
        → packages (is_active = 1)
          → packageRowToTierLimits() → TierLimits
            → resolveTrialLimits() → FREE limits if TRIAL
```

### Why Contact-Scoped?

1. **Team inheritance** — All users linked to a contact automatically get the same package limits. No per-user package management.
2. **Company billing** — Invoices and subscriptions are tied to the company (contact), not individuals.
3. **Cross-system linking** — SQLite resources (endpoints, gateways) link to `contact_id`, bridging both databases.
4. **Admin simplicity** — Staff assigns one package to one contact. All users under that contact are immediately affected.

### SQL Pattern

```sql
-- The core resolution query (used by both packageResolver and packageEnforcement)
SELECT c.id AS contact_id, c.company_name, cp.status, p.*
FROM contacts c
JOIN contact_packages cp ON cp.contact_id = c.id AND cp.status IN ('ACTIVE', 'TRIAL')
JOIN packages p ON p.id = cp.package_id AND p.is_active = 1
WHERE c.id = ?
ORDER BY CASE cp.status WHEN 'ACTIVE' THEN 0 WHEN 'TRIAL' THEN 1 ELSE 2 END,
         cp.updated_at DESC
LIMIT 1
```

If a contact has both an ACTIVE and a TRIAL assignment, **ACTIVE wins** (sort order).

---

## 2. Trial Degradation Pattern

The most critical enforcement pattern: **TRIAL status → Free tier limits.**

### The Problem

Without degradation, a contact assigned Pro with `status='TRIAL'` would get full Pro limits (10 sites, 10 widgets, 5000 actions, etc.) — making the trial indistinguishable from a paid subscription.

### The Solution: `resolveTrialLimits()`

```typescript
// packageResolver.ts
export function resolveTrialLimits(
  packageStatus: string,
  packageType: string,
  fullLimits: TierLimits
): TierLimits {
  if (packageStatus !== 'TRIAL') return fullLimits;
  if (packageType === 'ENTERPRISE' || packageType === 'STAFF') return fullLimits;
  return getLimitsForTier('free');
}
```

**Rules:**
- `status = 'ACTIVE'` → full package limits (no change)
- `status = 'TRIAL'` + `CONSUMER` package → **Free tier limits**
- `status = 'TRIAL'` + `ENTERPRISE` or `STAFF` → full limits (exempt — enterprise demos need the full feature set)

### Where It's Applied

The function is called in **two places**, covering all resolution paths:

1. **`packageResolver.ts → getActivePackageForUser()`** — Used by `requireActivePackageAccess` middleware and all routes that read `req.resolvedPackage`
2. **`packageEnforcement.ts → resolveContactPackage()`** — Used by all enforcement guards (`enforceEndpointLimit`, `enforceGatewayLimit`, `enforceKnowledgePageLimit`)

### Effect on Pro Trial

| Resource | Pro (Full) | Pro Trial (Actual Limits) |
|----------|------------|--------------------------|
| Sites | 10 | **1** |
| Widgets | 10 | **1** |
| Actions/month | 5,000 | **500** |
| Knowledge pages | 500 | **50** |
| Enterprise endpoints | 2 | **0** |
| Storage | 200 MB | **5 MB** |
| Site type | ecommerce | **single\_page** |
| Watermark removal | ✅ | **❌** |
| System actions | email\_capture + payment\_gateway\_hook | **email\_capture only** |

---

## 3. Cross-Database Enforcement Pattern

Enterprise endpoints and API gateways live in **SQLite**, but their limits are defined in **MySQL** packages. The enforcement middleware bridges this gap.

### Architecture

```
Request: POST /admin/enterprise-endpoints { contact_id: 68, ... }
  ↓
enforceEndpointLimit (middleware)
  ├── MySQL: resolveContactPackage(68)
  │   → contacts → contact_packages → packages
  │   → maxEnterpointEndpoints = 2 (Pro)
  │
  ├── SQLite: getAllEndpoints()
  │   → filter by contact_id = 68
  │   → count = 1
  │
  └── Compare: 1 < 2 → ALLOWED → next()
```

### The `contact_id` Bridge

Every SQLite resource stores `contact_id INTEGER` — a reference to the MySQL contacts table:

```
SQLite enterprise_endpoints:  contact_id = 68
SQLite client_api_configs:    contact_id = 68
                                    │
                                    ▼
MySQL contacts:               id = 68, company_name = "SA Water Works"
MySQL contact_packages:       contact_id = 68, package_id = 10 (Enterprise)
```

### Guard Pattern

All enforcement guards follow the same structure:

```typescript
export async function enforceXxxLimit(req, res, next) {
  // 1. Extract contact_id from request
  const contactId = req.body?.contact_id;
  if (!contactId) return deny(res, 'CONTACT_REQUIRED', '...');

  // 2. Resolve contact's package (MySQL)
  const pkg = await resolveContactPackage(contactId);
  if (!pkg) return deny(res, 'NO_ACTIVE_PACKAGE', '...');

  // 3. Enterprise/Staff bypass
  if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
    (req as any).resolvedPackage = pkg;
    return next();
  }

  // 4. Check the specific limit
  const max = pkg.rawPackage.max_xxx ?? 0;
  if (max <= 0) return deny(res, 'TIER_LIMIT_REACHED', '...');

  // 5. Count existing resources (SQLite)
  const all = getAllXxx();
  const count = all.filter(x => x.contact_id === contactId).length;
  if (count >= max) return deny(res, 'TIER_LIMIT_REACHED', '...');

  // 6. Attach package for downstream handlers
  (req as any).resolvedPackage = pkg;
  next();
}
```

---

## 4. Dual Trial System Pattern

Two independent trial mechanisms coexist, serving different audiences:

### User-Level Trial (Self-Service)

```
User clicks "Start Free Trial" on landing page
  → POST /api/billing/start-trial
    → Check: has_used_trial = FALSE, plan_type = 'free'
    → UPDATE users SET plan_type = 'starter', has_used_trial = TRUE, trial_expires_at = NOW() + 14 days
    → Return: full Starter limits for 14 days

Expiry:
  → trialEnforcer sweeps every hour
  → Finds users WHERE trial_expires_at < NOW()
  → UPDATE users SET plan_type = 'free', trial_expires_at = NULL
  → freezeOverLimitAssets(): lock sites → 'locked_tier_limit', suspend widgets
  → has_used_trial stays TRUE forever (prevents re-activation)
```

### Contact-Level Trial (Admin-Assigned)

```
Staff assigns Pro package to contact:
  → POST /admin/packages/8/assign-contact
    { contactId: 68, status: "TRIAL", billingCycle: "MONTHLY" }
    → INSERT contact_packages (status='TRIAL', current_period_end = NOW() + 30 days)

During trial:
  → resolveContactPackage(68) returns Pro package with TRIAL status
  → resolveTrialLimits('TRIAL', 'CONSUMER', proLimits) → FREE LIMITS
  → Client sees "Pro" badge but gets Free tier caps

Upgrade (payment):
  → UPDATE contact_packages SET status = 'ACTIVE'
  → resolveTrialLimits('ACTIVE', ...) → returns full Pro limits instantly

Expiry (no payment):
  → sweepExpiredContactTrials() finds rows WHERE status='TRIAL' AND current_period_end < NOW()
  → UPDATE contact_packages SET status = 'EXPIRED'
  → Contact loses all access (requireActivePackageAccess → 403)
```

### Re-Trial Prevention

| Level | Prevention | Bypass |
|-------|-----------|--------|
| User-level | `has_used_trial = TRUE` permanent | None — cannot restart |
| Contact-level | Admin-controlled | Staff can re-assign TRIAL at any time |

---

## 5. Zero-Knowledge API Gateway Pattern

The Client API Gateway implements a **zero-knowledge** proxy model: the platform never stores client data.

### Architecture

```
End User → Soft Aware Widget
  → Soft Aware AI (generates tool call)
    → Client API Gateway (clientApiGateway.ts)
      → buildAuthHeaders(config)  ← rolling_token / bearer / basic / api_key
        → SHA256(auth_secret + YYYY-MM-DD)  ← daily rotation
      → Forward to config.target_base_url + action
        → Client's Real API (on client's server)
          → Returns JSON
        → AI processes response
      → Return to end user
```

### Daily Token Rotation

```typescript
function generateDailyToken(secret: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256').update(secret + date).digest('hex');
}
```

The token changes every midnight UTC. The client's server validates by computing the same hash with the shared secret.

### Kill Switch

Two independent mechanisms to sever the connection:

| Kill Switch | Location | Effect |
|------------|----------|--------|
| **Remote** | Soft Aware Portal → `PATCH /admin/client-api/:id/status` → `disabled` | Gateway stops initiating requests to the client |
| **Local** | Client's server → `.env` flag or local SQLite flag | Client's server drops all requests from Soft Aware IP |

### Security Whitelist for Tool Actions

The `allowed_actions` field on `client_api_configs` serves as a **security whitelist** — it prevents calling arbitrary endpoints on the target API. All registered tools have **full capability** regardless of package tier. The only trial limitation is Free tier resource caps.

```json
{
  "allowed_actions": ["getCustomerInfo", "getAccountBalance", "submitPayment"]
}
```

When the AI calls a tool:
1. Gateway looks up `allowed_actions` for the client config
2. If the action is **not** in the list → `400 UNKNOWN_TOOL` error
3. If the action **is** in the list → forward to target API (full capability)
4. If `allowed_actions` is null/empty → allow all actions (open mode)

> **Note:** The previous read/action classification system was removed. External developers define tools freely — the platform no longer gates tool availability by tier.

---

## 6. Package Limit Resolution Pattern (DB + Config Fallback)

Tier limits are stored in two places: the **MySQL `packages` table** (dynamic, editable by admin) and the **`tiers.ts` config** (static, hardcoded fallback).

### Resolution Order

```typescript
// packageResolver.ts → packageRowToTierLimits()
function packageRowToTierLimits(pkg: PackageCatalogRow): TierLimits {
  const fallbackTier = getFallbackTier(pkg.slug, pkg.package_type);
  const fallback = getLimitsForTier(fallbackTier);

  return {
    maxSites:             pkg.max_sites            ?? fallback.maxSites,
    maxWidgets:           pkg.max_widgets           ?? fallback.maxWidgets,
    maxKnowledgePages:    pkg.max_knowledge_pages   ?? fallback.maxKnowledgePages,
    maxActionsPerMonth:   pkg.max_actions_per_month ?? fallback.maxActionsPerMonth,
    hasVision:            pkg.has_vision === 1 ?? fallback.hasVision,
    // ... etc for all 18 fields
  };
}
```

**The DB value always wins** when non-null. The hardcoded config only applies when the DB column is NULL (which happens for old packages created before migration 032 added the limit columns).

### Slug-to-Tier Mapping

```typescript
const PACKAGE_TO_TIER_FALLBACK = {
  free: 'free',
  starter: 'starter',
  pro: 'pro',
  advanced: 'advanced',
  enterprise: 'enterprise',
  staff: 'enterprise',  // Staff inherits enterprise limits
};
```

---

## 7. Enforcement Middleware Wiring Pattern

Guards are wired as Express middleware on specific route handlers:

### Current Wiring

```typescript
// adminEnterpriseEndpoints.ts
import { enforceEndpointLimit } from '../middleware/packageEnforcement.js';
router.post('/', enforceEndpointLimit, async (req, res) => { ... });

// adminClientApiConfigs.ts
import { enforceGatewayLimit } from '../middleware/packageEnforcement.js';
router.post('/', enforceGatewayLimit, async (req, res) => { ... });

// assistantIngest.ts
import { enforceKnowledgePageLimit } from '../middleware/packageEnforcement.js';
router.post('/url', enforceKnowledgePageLimit, async (req, res) => { ... });
router.post('/file', enforceKnowledgePageLimit, upload.single('file'), async (req, res) => { ... });

// widgetIngest.ts (inline, not middleware)
if (client.pages_ingested >= (client.max_pages || 50)) {
  return res.status(429).json({ error: 'Page limit reached', limit: client.max_pages || 50 });
}
```

### Guard Deny Response Shape

All enforcement guards return a consistent error shape:

```json
{
  "success": false,
  "error": "TIER_LIMIT_REACHED",
  "message": "This contact has reached the enterprise endpoint limit for the Pro package (2/2). Upgrade to create more.",
  "current": 2,
  "limit": 2,
  "package": "pro"
}
```

Error codes: `CONTACT_REQUIRED`, `NO_ACTIVE_PACKAGE`, `TIER_LIMIT_REACHED`, `KNOWLEDGE_LIMIT_REACHED`, `ACTION_NOT_ALLOWED`

---

## 8. Package Assignment Pattern

When a staff member assigns a package to a contact, the system performs a transactional swap:

```typescript
// adminPackages.ts → POST /:id/assign-contact
await db.transaction(async (conn) => {
  // 1. Cancel all other active/trial packages for this contact
  await conn.execute(
    `UPDATE contact_packages
        SET status = 'CANCELLED', cancelled_at = NOW()
      WHERE contact_id = ? AND package_id <> ? AND status IN ('ACTIVE', 'TRIAL')`,
    [contactId, packageId]
  );

  // 2. Upsert the new assignment
  if (existing) {
    await conn.execute('UPDATE contact_packages SET status = ?, ...');
  } else {
    await conn.execute('INSERT INTO contact_packages (...)');
  }
});

// 3. Sync all users linked to this contact
await syncUsersForContactPackage(contactId, pkg);
// → UPDATE users SET plan_type = ?, storage_limit_bytes = ? WHERE contact_id = ?
```

This ensures:
- Only one active package per contact at a time
- Old packages are cleanly cancelled
- All linked users' `plan_type` is updated immediately
- The change takes effect on the next request (no cache to invalidate)

---

## 9. PackageBadge UI Pattern

The frontend uses gradient-styled badges to visually distinguish package tiers:

```typescript
// ClientApiConfigs.tsx
const PackageBadge = ({ slug, name }: { slug: string; name: string }) => {
  const gradients: Record<string, string> = {
    pro:        'from-violet-500 to-purple-600',
    enterprise: 'from-amber-500 to-orange-600',
    advanced:   'from-blue-500 to-indigo-600',
    starter:    'from-green-500 to-emerald-600',
    staff:      'from-rose-500 to-pink-600',
    free:       'from-gray-400 to-gray-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold text-white
      bg-gradient-to-r ${gradients[slug] || gradients.free}`}>
      {name}
    </span>
  );
};
```

Contact resolution in the table follows a fallback chain:
1. Direct `config.contact_id` → look up in contacts list
2. Fallback: `config.endpoint_id` → find endpoint → use `endpoint.contact_id`
3. Both null → show "—" with no badge

---

## 10. Vision Gate Pattern

Vision/file processing is a **hard gate** based on `hasVision` in the contact's package tier. Files and images are rejected **before** any AI processing occurs.

### Tier Matrix

| Tier | hasVision | Effect |
|------|-----------|--------|
| Free | `false` | All file/image uploads rejected with 403 |
| Starter | `false` | All file/image uploads rejected with 403 |
| Pro | `false` | All file/image uploads rejected with 403 |
| Advanced | `true` | Full vision/file processing enabled |
| Enterprise | `true` | Full vision/file processing enabled |
| Staff | `true` | Full vision/file processing enabled |

### Inline Check (used in assistants, mobile AI, enterprise webhook)

```typescript
import { checkVisionAccess } from '../middleware/packageEnforcement.js';

// Inside a handler that processes files/images:
const visionResult = await checkVisionAccess(contactId);
if (!visionResult.allowed) {
  return res.status(403).json({
    success: false,
    error: 'VISION_NOT_AVAILABLE',
    message: visionResult.reason,
    current_package: visionResult.packageSlug,
    required: 'advanced or enterprise',
  });
}
// Proceed with image/file processing...
```

### Middleware (for route-level enforcement)

```typescript
import { enforceVisionAccess } from '../middleware/packageEnforcement.js';

router.post('/chat', enforceVisionAccess, async (req, res) => {
  // Only reached if user's contact has hasVision: true
});
```

### Wiring

| Entry Point | Method | Location |
|-------------|--------|----------|
| `assistants.ts` | Inline `checkVisionAccess()` | Before image processing in chat handler |
| `mobileAIProcessor.ts` | Inline `checkVisionAccess()` | Before image processing |
| `enterpriseWebhook.ts` | Inline `checkVisionAccess()` | Replaced hardcoded Kone vision check |

---

## 11. Client Usage Stats Pattern

Clients can access their own gateway usage statistics via a **shared-secret-authenticated** endpoint.

### Authentication Flow

```
Client sends: GET /api/v1/client-api/:clientId/usage
  Header: X-Client-Secret: <shared_secret_or_rolling_token>
  ↓
validateClientSecret(config, token)
  1. Try exact match: config.auth_secret === token
  2. Try today's rolling token: SHA256(secret + YYYY-MM-DD) === token
  3. Try yesterday's rolling token (grace period for timezone edge cases)
  → true if any match, false otherwise
  ↓
getUsageStats(config, days, recentLimit)
  → Aggregates from client_api_logs
  → Returns: period totals, daily breakdown, per-action breakdown, recent requests
```

### Response Shape

```json
{
  "success": true,
  "client_id": "silulumanzi",
  "client_name": "SA Water Works",
  "status": "active",
  "total_requests": 1547,
  "last_request_at": "2026-03-28T14:30:00.000Z",
  "period": { "from": "2026-02-26", "to": "2026-03-28" },
  "period_total": 342,
  "period_success": 328,
  "period_errors": 14,
  "avg_response_ms": 245,
  "daily_breakdown": [ { "date": "2026-03-28", "requests": 15, "success": 14, "errors": 1, "avg_ms": 230 } ],
  "action_breakdown": [ { "action": "getCustomerInfo", "requests": 200, "success": 195, "errors": 5, "avg_ms": 180, "last_called": "2026-03-28T14:30:00Z" } ],
  "recent_requests": [ { "action": "getCustomerInfo", "status_code": 200, "duration_ms": 150, "error_message": null, "created_at": "2026-03-28T14:30:00Z" } ]
}
```

### Security Properties

- **No admin auth required** — clients prove identity via shared secret
- **Read-only** — no mutations possible via this endpoint
- **Scoped** — clients can only see their own gateway's stats
- **Time-bounded** — max 90 days lookback, max 100 recent requests
