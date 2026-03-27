# Subscription File Inventory

> **v3.0.0 — Hybrid Package Catalog**
> Accurate as of April 2026.

---

## Active Files (27 files)

### Config

| File | Purpose |
|------|---------|
| `src/config/tiers.ts` | **Static fallback** — 5 tier definitions, all limits, prices, `OVERAGE_CONFIG`. Used as default when package row has NULL overrides. |

### Routes

| File | Purpose |
|------|---------|
| `src/routes/adminPackages.ts` | **NEW v3.0.0** — Admin package CRUD: list, create, update + contact assignment |
| `src/routes/publicPackages.ts` | **NEW v3.0.0** — Public `GET /api/public/packages` for pricing pages |
| `src/routes/billing.ts` | Trial activation (`POST /start-trial`) and status (`GET /trial-status`) |
| `src/routes/auth.ts` | Registration — accepts `trial: true` body param, auto-activates 14-day Starter trial |
| `src/routes/dashboard.ts` | Portal metrics — returns `trial` object with `hasUsedTrial`, `isOnTrial`, `daysRemaining`, `canStartTrial` |
| `src/routes/subscriptionTiers.ts` | Widget tier management — all reads from `config/tiers.ts` (no DB lookups for limits) |
| `src/routes/subscription.ts` | Legacy team subscription plans, trials, billing cycles (desktop app) |
| `src/routes/yoco.ts` | Yoco checkout creation, status polling, webhook handler |
| `src/routes/stripe.ts` | **Stub** — returns 410 Gone for all requests |

### Services

| File | Purpose |
|------|---------|
| `src/services/packageResolver.ts` | **NEW v3.0.0** — Hybrid tier resolution: user → contact → contact_packages → packages → `TierLimits`. Core interfaces (`PackageCatalogRow`, `ResolvedUserPackage`). |
| `src/services/trialEnforcer.ts` | Background hourly cron: sweeps expired trials, freezes over-limit assets |
| `src/services/subscription.ts` | Legacy team plan management, trial creation, cancellation, invoicing |
| `src/services/yocoCheckout.ts` | Yoco Checkout API: session creation, DB persistence, status polling |
| `src/services/yocoWebhookVerifier.ts` | Svix 3-header webhook signature verification |
| `src/services/yocoRefund.ts` | Yoco Refund API with idempotency key support |
| `src/services/credentialVault.ts` | AES-256-GCM encrypted vault for Yoco API keys, live/test mode resolution |
| `src/services/yocoWebhookHandler.ts` | **Deprecated stub** — logs warning, no-op |
| `src/services/yocoStatusPoller.ts` | **Empty stub** — polling moved inline to `yoco.ts` |

### Middleware

| File | Purpose |
|------|---------|
| `src/middleware/packageAccess.ts` | **NEW v3.0.0** — `requireActivePackageAccess` + `requireOwnerPackageAccess` enforce contact→package link |

### Frontend

| File | Purpose |
|------|---------|
| `pages/admin/AdminPackages.tsx` | **NEW v3.0.0** — Tabbed admin UI: Packages catalog, Client Assignments, Create Package |
| `pages/public/LandingPage.tsx` | Hero CTA → `/register?trial=true`, dynamic pricing from `/api/public/packages` with hardcoded fallback |
| `pages/public/RegisterPage.tsx` | Reads `?trial=true` query param, shows trial messaging, passes flag to `AuthModel.register()` |
| `pages/portal/Dashboard.tsx` | Trial activation banner (free→trial) + countdown banner (days remaining + upgrade CTA) |
| `pages/portal/SiteBuilderEditor.tsx` | Queue skip upsell: "Start Free Trial & Skip Queue" in generation Swal dialog |
| `models/AdminPackagesModel.ts` | **NEW v3.0.0** — `AdminPackage`, `PackageContactAssignment`, `PackagePayload` interfaces + API methods |
| `models/AuthModel.ts` | `register()` accepts `trial?: boolean`, response typed with `trialActivated` |

### Migrations

| File | Purpose |
|------|---------|
| `src/db/migrations/032_package_limits_catalog.ts` | **NEW v3.0.0** — Adds 13 tier-limit columns to `packages`, seeds 6 canonical packages |
| `src/db/migrations/031_trial_columns.ts` | Adds `has_used_trial`, `trial_expires_at`, and ensures `plan_type` exists on `users` table |
| `src/db/migrations/030_purge_legacy_pricing.ts` | Drops `credit_packages`, `package_transactions`, `subscription_tier_limits` |

---

## Deleted Files (v2.0.0 — still removed)

### Routes (Deleted)

| File | Reason |
|------|--------|
| `src/routes/credits.ts` | Credit purchase, balance, and transaction endpoints |
| `src/routes/adminCredits.ts` | Admin credit CRUD and bulk adjustment |

### Services (Deleted)

| File | Reason |
|------|--------|
| `src/services/credits.ts` | Credit balance operations, per-request deduction, balance checks |
| `src/services/payment.ts` | PayFast IPN handler, legacy Yoco payment creation |

### Config (Deleted)

| File | Reason |
|------|--------|
| `src/config/credits.ts` | AI request pricing config (cost per model per request) |

### Middleware (Deleted)

| File | Reason |
|------|--------|
| `src/middleware/credits.ts` | Pre-request credit balance check middleware |

### Frontend (Deleted)

| File | Reason |
|------|--------|
| `pages/admin/AICredits.tsx` | Admin credits management panel |

### Restored in v3.0.0 (no longer deleted)

| File | Former Status | Current Status |
|------|--------------|----------------|
| `src/routes/packages.ts` → `src/routes/adminPackages.ts` | Deleted in v2.0.0 | Rebuilt from scratch as `adminPackages.ts` |
| `src/services/packages.ts` → `src/services/packageResolver.ts` | Deleted in v2.0.0 | Rebuilt from scratch as `packageResolver.ts` |
| `src/middleware/packages.ts` → `src/middleware/packageAccess.ts` | Deleted in v2.0.0 | Rebuilt from scratch as `packageAccess.ts` |
| `pages/admin/AIPackages.tsx` → `pages/admin/AdminPackages.tsx` | Deleted in v2.0.0 | Rebuilt from scratch as `AdminPackages.tsx` |

---

## File Dependency Graph

```
config/tiers.ts  ←─── services/packageResolver.ts (fallback when DB columns are NULL)
     ↑                routes/billing.ts
     ↑                routes/subscriptionTiers.ts
     ↑                routes/yoco.ts
     ↑                services/trialEnforcer.ts
     │
     └── Imported via: import { getLimitsForTier, TierName } from '../config/tiers.js'

services/packageResolver.ts ←─── middleware/packageAccess.ts
                                  routes/adminPackages.ts
                                  routes/publicPackages.ts

routes/adminPackages.ts     ── Admin CRUD for packages + contact assignment
routes/publicPackages.ts    ── Public package listing for pricing pages
middleware/packageAccess.ts ── Enforces contact→package link on gated routes

routes/auth.ts              ── Registration with trial=true auto-activates trial
routes/dashboard.ts         ── Returns trial object in /dashboard/metrics

# Frontend Package Flow:
AdminPackages.tsx → GET /admin/packages, POST /admin/packages, PUT /admin/packages/:id
AdminPackages.tsx → GET /admin/packages/contacts, POST /admin/packages/:id/assign-contact
LandingPage.tsx   → GET /api/public/packages → dynamic pricing with hardcoded fallback

# Frontend Trial Flow:
LandingPage.tsx → /register?trial=true → RegisterPage.tsx → AuthModel.register({trial:true})
Dashboard.tsx   → GET /dashboard/metrics → trial banner / countdown
Dashboard.tsx   → POST /billing/start-trial → trial activation banner
SiteBuilderEditor.tsx → POST /billing/start-trial → queue skip upsell

services/credentialVault.ts  ←── routes/yoco.ts
                                  services/yocoCheckout.ts
                                  services/yocoWebhookVerifier.ts
                                  services/yocoRefund.ts
```

---

## Stubs to Clean Up Later

| File | Notes |
|------|-------|
| `routes/stripe.ts` | Remove once all Stripe import references in `app.ts` are cleaned |
| `services/yocoWebhookHandler.ts` | Deprecated — webhook handling is now inline in `routes/yoco.ts` |
| `services/yocoStatusPoller.ts` | Empty export — polling moved inline to `routes/yoco.ts` |
