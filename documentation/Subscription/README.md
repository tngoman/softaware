# Subscription Module

> **v3.0.0 — Hybrid Package Catalog (April 2026)**
>
> The `packages` and `contact_packages` tables have been **restored** with full editable tier-limit
> columns (migration `032_package_limits_catalog.ts`). Pricing is now a **hybrid** system:
> [`config/tiers.ts`](../../backend/src/config/tiers.ts) provides static fallback defaults,
> while the `packages` table holds admin-editable overrides resolved at runtime via
> [`services/packageResolver.ts`](../../backend/src/services/packageResolver.ts).
>
> The legacy credit system (credits, balances, per-request deductions) remains permanently removed.

## Overview

The Subscription module manages billing, plan management, and usage enforcement for the SoftAware platform:

1. **Hybrid Tier Pricing** — 5 canonical tiers (Free / Starter / Pro / Advanced / Enterprise) + 1 internal tier (Staff). Static defaults in `config/tiers.ts`, admin-editable overrides in the `packages` DB table, resolved at runtime by `packageResolver.ts`.
2. **Package Catalog** — Admin CRUD for packages via `routes/adminPackages.ts`. Public listing via `routes/publicPackages.ts`. Each package row carries its own tier-limit columns that override the static fallback.
3. **Contact–Package Linking** — Packages are assigned to contacts (companies) via the `contact_packages` table. Users inherit their contact's active package through `packageResolver.getActivePackageForUser()`.
4. **Package Access Middleware** — `middleware/packageAccess.ts` enforces that the requesting user (or resource owner) has an active contact→package link before accessing gated resources.
5. **Trial Engine** — One-time 14-day Starter trial per user via `routes/billing.ts`, with abuse prevention (`has_used_trial` flag is permanent).
6. **Trial Enforcer** — Background hourly sweep (`services/trialEnforcer.ts`) that auto-downgrades expired trials to Free and freezes over-limit assets.
7. **Graceful Freeze** — When downgraded, oldest sites/widgets survive; excess are locked (`locked_tier_limit`) or suspended. No data is deleted.
8. **Widget Tiers** — Widget client subscription management via `routes/subscriptionTiers.ts`, reading limits from `config/tiers.ts`.
9. **Auto-Recharge Overage** — Tiers with `allowAutoRecharge: true` can exceed `maxActionsPerMonth` by purchasing additional action packs at R99 per 1,000 actions (`OVERAGE_CONFIG`).
10. **Dynamic Public Pricing** — `LandingPage.tsx` fetches live pricing from `GET /api/public/packages` with a hardcoded fallback array matching `Pricing.md`.

## Module Scope

| Sub-Domain | Description |
|------------|-------------|
| **Tier Definitions** | `config/tiers.ts` — static fallback defaults for all 5 tiers + `OVERAGE_CONFIG` |
| **Package Catalog** | `packages` table — admin-editable tier-limit overrides, public/private flags, display order |
| **Package Resolution** | `services/packageResolver.ts` — resolves user → contact → contact_packages → packages → `TierLimits` |
| **Package Access** | `middleware/packageAccess.ts` — enforces active package link for gated routes |
| **Admin Package CRUD** | `routes/adminPackages.ts` — list, create, update, assign-contact, list contacts |
| **Public Packages** | `routes/publicPackages.ts` — public-facing active package listing for pricing pages |
| **Overage Config** | `config/tiers.ts` → `OVERAGE_CONFIG` — R99 per 1,000 extra actions for auto-recharge tiers |
| **Trial System** | `routes/billing.ts` — start-trial + trial-status endpoints |
| **Trial Enforcement** | `services/trialEnforcer.ts` — hourly cron sweep, graceful asset freezing |
| **Trial Frontend** | Landing page CTAs, register with trial flag, portal banners, queue skip upsell |
| **Widget Tiers** | `routes/subscriptionTiers.ts` — widget upgrade, config, usage, leads |
| **Team Subscriptions** | `routes/subscription.ts` — legacy team plan management (desktop app) |
| **Payment Gateways** | **Yoco** (active) via `routes/yoco.ts`. **Stripe removed** (410 Gone stub). |

## Architecture

### Backend Structure
```
src/config/tiers.ts                → Static fallback tier definitions (5 tiers, OVERAGE_CONFIG)
src/services/packageResolver.ts    → Hybrid resolver: DB packages → static fallback. Core interfaces.
src/middleware/packageAccess.ts     → Middleware: requireActivePackageAccess, requireOwnerPackageAccess
src/routes/adminPackages.ts        → Admin CRUD: list, create, update packages + assign contacts
src/routes/publicPackages.ts       → Public: GET /api/public/packages (active + public only)
src/routes/billing.ts              → POST /billing/start-trial, GET /billing/trial-status
src/services/trialEnforcer.ts      → Hourly cron: sweep expired trials, freeze over-limit assets
src/routes/subscriptionTiers.ts    → Widget tier management (reads from config/tiers.ts)
src/routes/subscription.ts         → Legacy team subscription plans, trials, billing
src/services/subscription.ts       → Legacy plan management, trial creation, cancellation
src/routes/stripe.ts               → 410 Gone stub (Stripe removed)
src/routes/yoco.ts                 → Yoco checkout, refund, admin endpoints
src/services/yocoCheckout.ts       → Yoco Checkout API: create session, DB persistence
src/services/yocoWebhookVerifier.ts→ Svix 3-header signature verification
src/services/yocoRefund.ts         → Yoco Refund API with idempotency
src/services/credentialVault.ts    → AES-256-GCM encrypted vault, Yoco key resolution
src/db/migrations/032_package_limits_catalog.ts → Adds 13 tier-limit columns to packages, seeds 6 packages
src/db/migrations/031_trial_columns.ts          → Adds has_used_trial + trial_expires_at to users
src/db/migrations/030_purge_legacy_pricing.ts   → Drops legacy credit tables (credit_packages, package_transactions, subscription_tier_limits)
```

### Frontend Structure
```
pages/admin/AdminPackages.tsx       → Tabbed admin UI: Packages catalog, Client Assignments, Create Package
pages/public/LandingPage.tsx        → Hero CTA + dynamic pricing from /api/public/packages with fallback
pages/public/RegisterPage.tsx       → Reads ?trial=true param, shows trial messaging, passes flag to register()
pages/portal/Dashboard.tsx          → Trial activation banner (free→trial) + countdown banner (days remaining)
pages/portal/SiteBuilderEditor.tsx  → Queue skip upsell: "Start Free Trial & Skip Queue" in Swal dialog
pages/general/Pricing.tsx           → Public pricing page (reads static tier data)
models/AdminPackagesModel.ts        → AdminPackage, PackageContactAssignment, PackagePayload interfaces + API methods
models/AuthModel.ts                 → register() accepts trial?: boolean, typed response with trialActivated
models/AdminAIModels.ts             → AdminConfigModel, AdminAIOverviewModel
```

### Deleted Files (v2.0.0 — still removed)
```
❌ src/routes/credits.ts           → Removed (credit purchase/balance endpoints)
❌ src/routes/adminCredits.ts      → Removed (admin credit CRUD)
❌ src/services/credits.ts         → Removed (balance ops, deduction)
❌ src/services/payment.ts         → Removed (PayFast/legacy Yoco)
❌ src/config/credits.ts           → Removed (request pricing config)
❌ src/middleware/credits.ts       → Removed (credit deduction middleware)
❌ pages/admin/AICredits.tsx       → Removed (admin credits panel)
```

### Restored Files (v3.0.0 — rebuilt from scratch)
```
✅ src/routes/adminPackages.ts      → NEW: Admin package CRUD + contact assignment (replaces old routes/packages.ts)
✅ src/routes/publicPackages.ts     → NEW: Public package listing endpoint
✅ src/services/packageResolver.ts  → NEW: Hybrid tier resolution service (replaces old services/packages.ts)
✅ src/middleware/packageAccess.ts   → NEW: Package enforcement middleware (replaces old middleware/packages.ts)
✅ pages/admin/AdminPackages.tsx     → NEW: Admin package management UI (replaces old AIPackages.tsx)
✅ models/AdminPackagesModel.ts      → NEW: Frontend API model for package management
```

## Dependencies

| Dependency | Usage |
|-----------|-------|
| `config/tiers.ts` | Static fallback tier limits and pricing (used when package row has NULL overrides) |
| `services/packageResolver.ts` | Runtime tier resolution: user → contact → package → `TierLimits` |
| `middleware/packageAccess.ts` | Route-level package enforcement |
| Zod | Request validation (admin package schema, assignment schema) |
| mysql2/promise | Database operations |
| `services/credentialVault.ts` | Yoco API key resolution (AES-256-GCM vault) |

## Key Concepts

- **No Credits**: The credit system is completely gone. No credits, no balances, no per-request deductions. Usage is governed by `maxActionsPerMonth` per tier.
- **Hybrid Pricing**: `config/tiers.ts` provides static fallbacks. The `packages` table holds admin-editable overrides. `packageResolver.packageRowToTierLimits()` merges them: DB value wins if non-NULL, otherwise the static fallback for the package's slug is used.
- **Package → Contact → User**: Packages are assigned to contacts via `contact_packages`. Users are linked to contacts via `users.contact_id` or `user_contact_link`. `getActivePackageForUser()` resolves the chain.
- **6 Canonical Packages**: free, starter, pro, advanced, enterprise (public), and staff (internal). Seeded by migration 032.
- **Actions (not Messages)**: The billing metric is "Actions" — whether a web chatbot response or a backend AI webhook execution, each counts as one Action.
- **System Actions (not Actions)**: The `allowedSystemActions` array on each tier gates technical AI function calls (`email_capture`, `payment_gateway_hook`, etc.). Named separately to avoid confusion with the billing "Actions" metric.
- **Auto-Recharge**: Tiers with `allowAutoRecharge: true` (Starter+) can exceed their monthly action cap. The system charges R99 per 1,000 extra actions via `OVERAGE_CONFIG`. Free tier has `allowAutoRecharge: false` — hard cap, no overage.
- **Currency**: Prices stored in ZAR cents in the database (`price_monthly`). Display prices in ZAR: Free (R0), Starter (R349), Pro (R699), Advanced (R1,499), Enterprise (Custom). Overage: R99/1,000 actions.
- **Trial Abuse Prevention**: `has_used_trial` is a permanent boolean flag on the `users` table. Once set to `TRUE`, it can never be reset — even by admins.
- **Oldest Survives**: When a user is downgraded below their asset count, the oldest-created sites and widgets remain active. Newer ones are frozen.
- **`plan_type` + Package Resolution**: The `users.plan_type` column is kept in sync by `syncUsersForContactPackage()` whenever a package is assigned. The package catalog is the authoritative source; `plan_type` is a denormalized cache for quick lookups.
- **Yoco Live/Test Mode**: Controlled by `sys_settings.yoco_mode`. Same API, different vault keys.
