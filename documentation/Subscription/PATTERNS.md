# Subscription Patterns & Architecture

> **v3.0.0 — Hybrid Package Catalog**
> The legacy middleware-based credit deduction pattern remains permanently removed.
> Package resolution has been rebuilt as a hybrid system: DB-first with static fallback.
>
> **Terminology:** "Actions" = unified billing metric (chatbot response OR webhook execution).
> "System Actions" = technical AI function calls (`email_capture`, `payment_gateway_hook`, etc.).

---

## Pattern 1: Hybrid Tier Resolution (DB-First + Static Fallback)

**The single most important pattern in the subscription system.**

Tier limits are resolved through a **hybrid** pipeline. The `packages` table holds admin-editable overrides. When a column is NULL, the static fallback from `config/tiers.ts` is used.

### 1a. Package-Based Resolution (Primary Path)

For any authenticated user, the system resolves their active package through a chain:

```
User → users.contact_id (or user_contact_link) → contact_packages (ACTIVE/TRIAL) → packages row → TierLimits
```

```typescript
import { getActivePackageForUser } from '../services/packageResolver.js';

const resolved = await getActivePackageForUser(userId);
// resolved.limits — fully merged TierLimits (DB overrides + static fallbacks)
// resolved.packageSlug — e.g. 'pro'
// resolved.packageStatus — 'ACTIVE' or 'TRIAL'
// resolved.contactId — resolved contact ID
```

The SQL query in `getActivePackageForUser()`:
1. Resolves user → contact via `users.contact_id` or `user_contact_link` (prioritized by role: OWNER > ADMIN > MEMBER > STAFF)
2. JOINs to `contact_packages` (status IN 'ACTIVE', 'TRIAL')
3. JOINs to `packages` (is_active = 1)
4. Returns the highest-priority active package

### 1b. Package Row → TierLimits Merge (Fallback Logic)

```typescript
import { packageRowToTierLimits } from '../services/packageResolver.js';

const limits = packageRowToTierLimits(packageRow);
// For each field: DB value wins if non-NULL, otherwise static fallback for slug
```

Merge order for each field:
1. Check the DB column (e.g. `packages.max_sites`)
2. If NULL, fall back to legacy column mapping (e.g. `max_landing_pages` → `maxSites`)
3. If still NULL, use `getLimitsForTier(slug)` from `config/tiers.ts`

### 1c. Static-Only Resolution (Fallback Path)

When no package chain exists (e.g. widget tier checks), the static path is still available:

```typescript
import { getLimitsForTier, TierName } from '../config/tiers.js';

const limits = getLimitsForTier(user.plan_type);
// Returns static limits for the tier, defaults to 'free' for invalid input
```

**Anti-pattern (REMOVED in v2.0.0 — still removed):**
```typescript
// ❌ NEVER DO THIS — the subscription_tier_limits table no longer exists
const limits = await db.queryOne(
  'SELECT * FROM subscription_tier_limits WHERE tier = ?', [tierName]
);
```

---

## Pattern 2: Package Access Enforcement

Two middleware functions enforce that users have an active contact→package link:

### requireActivePackageAccess (User-Scoped)

Checks that the **authenticated user** has an active package via `requireActivePackageForUser()`. If no active package chain exists, returns 403 with `PACKAGE_LINK_REQUIRED` error.

```typescript
import { requireActivePackageAccess } from '../middleware/packageAccess.js';

// Apply to routes that require an active package:
router.post('/some-gated-action', requireAuth, requireActivePackageAccess, handler);
```

### requireOwnerPackageAccess (Resource-Scoped)

Checks that the **owner** of a resource (assistant or widget client) has an active package. Resolves owner via `assistants.userId` or `widget_clients.user_id`.

```typescript
import { requireOwnerPackageAccess } from '../middleware/packageAccess.js';

// Apply to routes where the resource owner (not necessarily requester) needs a package:
router.post('/chat/:assistantId', requireOwnerPackageAccess, handler);
```

---

## Pattern 3: Admin Package Management

### CRUD Lifecycle

```
Admin → POST /admin/packages (create)
Admin → PUT /admin/packages/:id (update) → syncUsersForContactPackage() for all linked contacts
Admin → POST /admin/packages/:id/assign-contact → cancel old assignments → create/reactivate → syncUsers
```

### Contact Assignment Flow

```
1. Admin selects package + contact
2. Backend cancels any existing active package for that contact (status → 'CANCELLED')
3. Creates or reactivates contact_packages row (status → 'ACTIVE', billing period set)
4. syncUsersForContactPackage() updates all users with that contact_id:
   → users.plan_type = mapPackageToTierName(slug)
   → users.storage_limit_bytes = limits.maxStorageBytes
```

### Package → Tier Name Mapping

```typescript
import { mapPackageToTierName } from '../services/packageResolver.js';

mapPackageToTierName('pro', 'CONSUMER');    // → 'pro'
mapPackageToTierName('staff', 'STAFF');     // → 'enterprise'
mapPackageToTierName('unknown', 'CONSUMER'); // → 'free' (safe fallback)
```

---

## Pattern 4: Public Pricing API

The landing page fetches live pricing from the database with a hardcoded fallback:

### Backend

```typescript
// routes/publicPackages.ts
GET /api/public/packages
  → SELECT * FROM packages WHERE is_active = 1 AND is_public = 1
  → formatPublicPackage() transforms each row (camelCase, resolved limits, parsed features)
```

### Frontend

```typescript
// LandingPage.tsx
useEffect(() => {
  fetch('/api/public/packages')
    .then(data => setPricingPlans(data.packages))
    .catch(() => setPricingPlans(hardcodedFallback)); // Matches Pricing.md exactly
}, []);
```

**Key design decision:** The hardcoded fallback in `LandingPage.tsx` matches `Pricing.md` exactly. If the API is down, users still see correct pricing.

---

## Pattern 5: Trial Engine (Start → Enforce → Freeze)

The trial system has three phases:

### Phase 1: Activation (`routes/billing.ts`)
```
User calls POST /api/v1/billing/start-trial
  → Check has_used_trial (permanent flag)
  → Check not already on paid plan
  → SET plan_type = 'starter', has_used_trial = TRUE, trial_expires_at = NOW() + 14 days
  → Return tier limits to frontend
```

### Phase 2: Background Sweep (`services/trialEnforcer.ts`)
```
Every 60 minutes (setInterval):
  → SELECT users WHERE trial_expires_at < NOW()
  → For each expired user:
    → SET plan_type = 'free', trial_expires_at = NULL
    → Call freezeOverLimitAssets(userId)
    → has_used_trial stays TRUE (permanent)
```

### Phase 3: Graceful Freeze (`services/trialEnforcer.ts`)
```
freezeOverLimitAssets(userId):
  → Get free tier limits from config/tiers.ts
  → SELECT sites ORDER BY created_at ASC
  → Keep oldest N (where N = freeLimits.maxSites), freeze rest → 'locked_tier_limit'
  → SELECT widgets ORDER BY created_at ASC
  → Keep oldest N (where N = freeLimits.maxWidgets), freeze rest → 'suspended'
```

**Key design decisions:**
- `has_used_trial` is **permanent** — no admin reset, no second chances
- Oldest assets survive (deterministic, user-predictable)
- No data is deleted during freeze — only status changes
- Sweep runs at boot + hourly (catches downtime gaps)

---

## Pattern 5b: Trial Frontend UX (4 Entry Points)

The trial system has four frontend touchpoints, all converging on the same backend:

### Entry 1: Landing Page Hero CTA
```
LandingPage.tsx → "Start 14-Day Free Trial" button
  → Links to /register?trial=true
  → Starter pricing card badge: "14-Day Free Trial"
  → Starter card CTA: "Start 14-Day Free Trial" → /register?trial=true
  → Other cards: "Get Started" → /register (no trial flag)
```

### Entry 2: Registration Page
```
RegisterPage.tsx reads useSearchParams()
  → If ?trial=true:
    → Heading: "Start Your 14-Day Free Trial"
    → Badge: "14 days free • Downgrades to Free automatically"
    → Submit button: "Start Free Trial" (instead of "Create Account")
    → Calls AuthModel.register({ ...data, trial: true })
  → Backend auto-activates trial during user creation (no second API call)
```

### Entry 3: Portal Dashboard (Free → Trial)
```
Dashboard.tsx fetches GET /dashboard/metrics
  → If metrics.trial.canStartTrial (free tier, never trialled):
    → Shows blue gradient banner: "Unlock More with a Free Trial"
    → CTA button: "Start 14-Day Free Trial" → POST /billing/start-trial
    → On success: SweetAlert confirmation, reload metrics
  → If metrics.trial.isOnTrial:
    → Shows amber gradient banner: "Starter Trial — N days remaining"
    → CTA link: "Upgrade Now — R349/mo" → /portal/billing
```

### Entry 4: Site Builder Queue Skip
```
SiteBuilderEditor.tsx → handleGenerate(tier: 'free' | 'paid')
  → If tier === 'paid': standard priority build Swal
  → If tier !== 'paid': queued generation Swal with upsell:
    → "⚡ Want to skip the queue?"
    → "Start a free 14-day Starter trial for priority builds"
    → Confirm: POST /billing/start-trial → success Swal → navigate
    → Cancel: stays in queue → navigate to /portal/sites
```

---

## Pattern 6: Payment Fulfilment (Yoco)

Two parallel fulfilment paths ensure no payment is missed:

### Path A: Webhook (Push)
```
Yoco server → POST /api/v1/webhooks/yoco
  → Verify Svix 3-header signature
  → Extract checkoutId from payload
  → Lookup yoco_checkouts record
  → Read softaware_target_tier from metadata JSON
  → UPDATE users SET plan_type = target_tier
  → UPDATE yoco_checkouts SET status = 'completed'
```

### Path B: Status Polling (Pull)
```
Frontend redirect-back → GET /api/v1/yoco/checkout/:id/status
  → Lookup yoco_checkouts record
  → If still pending, poll Yoco API for fresh status
  → If completed/successful:
    → Same fulfilment as webhook path
  → Return status to frontend
```

**Idempotency:** Both paths check `record.status !== 'completed'` before fulfilling, so double-fulfilment is impossible.

---

## Pattern 7: Widget Tier Enrichment

When listing widget clients, each row is enriched with its static tier limits:

```typescript
const rows = await db.query('SELECT * FROM widget_clients WHERE user_id = ?', [userId]);

const enriched = rows.map((wc) => {
  const limits = getLimitsForTier(wc.subscription_tier);
  return {
    ...wc,
    max_pages: limits.maxKnowledgePages,
    max_actions_per_month: limits.maxActionsPerMonth,
    lead_capture: limits.allowedSystemActions.includes('email_capture'),
    tone_control: true,
    daily_recrawl: wc.subscription_tier !== 'free',
    document_uploads: wc.subscription_tier !== 'free',
  };
});
```

---

## Pattern 8: Feature Gating via allowedSystemActions

Tier-specific features are gated via the `allowedSystemActions` string array:

```typescript
const limits = getLimitsForTier(client.subscription_tier);

if (leadCaptureEnabled && !limits.allowedSystemActions.includes('email_capture')) {
  return res.status(403).json({
    error: 'Lead capture requires a higher tier',
    upgrade: 'Upgrade to enable lead capture',
  });
}
```

**Available System Actions by tier:**

| System Action | Free | Starter | Pro | Advanced | Enterprise |
|---------------|------|---------|-----|----------|------------|
| `email_capture` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `payment_gateway_hook` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `api_webhook` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `custom_middleware` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Pattern 9: Auto-Recharge Overage

Tiers with `allowAutoRecharge: true` (Starter and above) can exceed their `maxActionsPerMonth` cap. When a client goes over the limit, the system can charge `OVERAGE_CONFIG.priceZAR` (R99) for each additional `OVERAGE_CONFIG.actionPackSize` (1,000) actions via the Yoco gateway.

**Free tier has `allowAutoRecharge: false`** — it hits a hard cap at 500 actions.

---

## Pattern 10: Credential Vault (Yoco Keys)

API keys are stored encrypted (AES-256-GCM) in the `credential_vault` table. The active mode (`live` vs `test`) is controlled by `sys_settings.yoco_mode`:

```typescript
import { getYocoActiveConfig } from '../services/credentialVault.js';

const config = await getYocoActiveConfig();
// config.secretKey — decrypted Yoco secret key for the active mode
// config.publicKey — decrypted Yoco public key
// config.webhookSecret — decrypted Svix webhook secret
```

**Never hard-code Yoco API keys.** Always resolve through the vault.

---

## Removed Patterns (v2.0.0 — still removed)

| Pattern | Description | Replacement |
|---------|-------------|-------------|
| Credit deduction middleware | `middleware/credits.ts` checked balance before each AI request | Gone — usage governed by `maxActionsPerMonth` per tier |
| Dynamic package pricing | `config/credits.ts` mapped model→cost per request | Gone — flat monthly action cap per tier |
| PayFast IPN | `services/payment.ts` handled PayFast instant payment notifications | Gone — Yoco is sole gateway |
| Credit purchase flow | User buys credit bundle → balance increases → deducted per request | Gone — no credits, no balances, no deductions |

## Restored Patterns (v3.0.0)

| Pattern | v2.0.0 Status | v3.0.0 Status |
|---------|--------------|---------------|
| Package enforcement middleware | Removed | Rebuilt as `middleware/packageAccess.ts` (contact→package link enforcement, not credit-based) |
| Package CRUD routes | Removed | Rebuilt as `routes/adminPackages.ts` (admin CRUD + contact assignment) |
| Contact-package management | Removed | Rebuilt as `services/packageResolver.ts` (hybrid resolver with static fallback) |
