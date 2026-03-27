# Packages Module

## Purpose
Unified package and billing system that replaces the legacy team-scoped credit/subscription model. Everything — consumer plans, enterprise tiers, staff usage, and add-ons — is managed as **packages** tied to **contacts** (companies/clients). The module provides product definitions, contact-level subscriptions with integrated credit balances, per-request credit tracking, a public pricing API for the landing page, and full admin CRUD.

## Module Scope
- **Package Definitions**: Product catalog with 4 types — CONSUMER, ENTERPRISE, STAFF, ADDON. Canonical pricing tiers defined in `config/tiers.ts`: Free (R0), Starter (R349), Pro (R699), Advanced (R1,499), Enterprise (Custom)
- **Contact Subscriptions**: Each contact subscribes to one or more packages via `contact_packages` (combines subscription status + credit balance in a single record)
- **Credit Operations**: Deduction, allocation, adjustment, and transaction logging — all scoped to contacts, not teams
- **User ↔ Contact Linking**: `user_contact_link` maps users to their company/contact with roles (OWNER, ADMIN, MEMBER, STAFF)
- **Public Pricing API**: Unauthenticated endpoint serving landing page pricing from the database
- **Admin Panel**: Full CRUD for packages, subscription management, credit adjustments, transaction auditing, and user-contact linking
- **Middleware**: `packageCreditMiddleware` enforces package ownership, credit checks, and post-response deduction on AI endpoints
- **Seed Data**: 5 canonical tiers (Free, Starter, Pro, Advanced, Enterprise) defined in `config/tiers.ts` + Soft Aware as contact ID 1 with Staff package

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend Service | `src/services/packages.ts` | 563 | Core package/credit operations: CRUD, subscriptions, balance, deduction, transactions, user-contact linking, public pricing |
| Backend Route | `src/routes/adminPackages.ts` | 305 | Admin CRUD for packages, subscriptions, credits, transactions, user-contact links |
| Backend Route | `src/routes/packages.ts` | 83 | Public pricing endpoint + package listing |
| Backend Middleware | `src/middleware/packages.ts` | 210 | Contact resolution, credit checks, post-response deduction |
| Backend Migration | `src/db/migrations/023_packages_system.ts` | 409 | Schema creation + seed data |
| Backend Config | `src/config/credits.ts` | 172 | Request pricing definitions (TEXT_CHAT, CODE_AGENT_EXECUTE, etc.) |
| Frontend Page | `pages/admin/AIPackages.tsx` | 662 | 3-tab admin page: Packages, Subscriptions, Transactions |
| Frontend Model | `models/AdminAIModels.ts` (additions) | ~175 | `AdminPackagesModel` class + types |
| Frontend Landing | `pages/public/LandingPage.tsx` (modified) | — | Dynamic pricing from `/packages/pricing` with hardcoded fallback |

**Total**: 9+ files, ~2,500+ LOC

## Dependencies
- **Backend**: Express Router, Zod validation, `requireAuth` + `requireAdmin` middleware, `db` (MySQL via mysql2/promise), `config/credits.ts` (REQUEST_PRICING)
- **Frontend**: React 18, React Router DOM 6, Axios, SweetAlert2, Heroicons, Tailwind CSS, `AdminPackagesModel`
- **Legacy Compatibility**: Old `services/credits.ts`, `middleware/credits.ts`, `routes/adminCredits.ts`, and `routes/credits.ts` still exist for backward compatibility during migration

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `packages` | Package product definitions (all types) | `id` (INT PK), `slug` (UNIQUE), `name`, `package_type` (ENUM), `price_monthly`, `price_annually` (ZAR cents), `credits_included`, limits (`max_users`, `max_agents`, `max_widgets`, `max_landing_pages`, `max_enterprise_endpoints`), `features` (JSON), `is_active`, `is_public`, `display_order`, `featured`, `cta_text` |
| `contact_packages` | Contact's active subscription + credit balance | `id` (INT PK), `contact_id` (FK→contacts), `package_id` (FK→packages), `status` (ENUM), `billing_cycle`, `credits_balance`, `credits_used`, period dates, `payment_provider`, `low_balance_threshold`, UNIQUE(contact_id, package_id) |
| `package_transactions` | All credit movements (usage, purchase, allocation, etc.) | `id` (INT PK), `contact_package_id` (FK), `contact_id` (FK), `user_id`, `type` (ENUM), `amount`, `request_type`, `request_metadata` (JSON), `description`, `balance_after` |
| `user_contact_link` | Maps users to their contact/company | `id` (INT PK), `user_id` (VARCHAR 36), `contact_id` (FK→contacts), `role` (ENUM: OWNER/ADMIN/MEMBER/STAFF), UNIQUE(user_id, contact_id) |
| `contacts` | Existing contacts table — now includes `contact_type=3` for internal/provider (Soft Aware) | `id`, `company_name`, `contact_type` (1=customer, 2=supplier, 3=internal) |

## Architecture Notes

1. **Contact-Scoped, Not Team-Scoped**: The legacy system used `teams.id` to scope credit balances. The new system uses `contacts.id`. Users are linked to contacts via `user_contact_link`.
2. **Combined Subscription + Balance**: Unlike the legacy system which had separate `subscriptions` and `credit_balances` tables, `contact_packages` merges subscription status (TRIAL/ACTIVE/PAST_DUE/etc.) with credit tracking (`credits_balance`, `credits_used`) in one record.
3. **Multi-Package Support**: A contact can subscribe to multiple packages (e.g., a consumer plan + an add-on). Credits are deducted from the active package with the highest balance.
4. **Public Pricing from DB**: The landing page fetches pricing from `GET /packages/pricing` (no auth). Falls back to hardcoded plan arrays if the API is unreachable.
5. **Middleware Chain**: `packageCreditMiddleware` = `requirePackage` → `requireCredits` → `deductCreditsAfterResponse`. Placed after `requireAuth` on AI endpoints.
6. **Request Pricing**: Credit costs per request type are defined in `config/credits.ts` (e.g., TEXT_CHAT = 10 base + 0.01/token). The middleware maps URL paths to request types and calculates costs.
7. **Staff Package**: The internal Staff package is assigned to Soft Aware (contact ID 1, `contact_type=3`). All staff users are linked to this contact via `user_contact_link` with `role=STAFF`.
8. **Seed-on-Migrate**: Migration 023 creates tables, seeds packages, ensures Soft Aware exists at contact ID 1, and assigns the Staff package with 100,000 credits. Canonical consumer tiers (Free/Starter/Pro/Advanced/Enterprise) are defined in `config/tiers.ts`.
9. **Admin Protection**: `adminPackagesRouter` uses `requireAuth` + `requireAdmin` middleware on all routes.
10. **Payment Providers**: `contact_packages.payment_provider` supports PAYFAST, YOCO, and MANUAL. **Yoco is the active payment gateway** (checkout, webhooks, refunds via `routes/yoco.ts` + Svix webhook verification). Stripe has been removed (returns 410 Gone). PayFast is retained for legacy compatibility only.
11. **Canonical Tier Config**: `config/tiers.ts` is the single source of truth for tier names, ZAR prices, gateway plan IDs, and all per-tier limits (sites, widgets, storage, AI messages, knowledge pages, site types). All pricing displayed on the frontend and enforced in middleware reads from this file.

## Relationship to Legacy Modules

| Legacy Component | New Replacement | Status |
|-----------------|-----------------|--------|
| `credit_packages` table | `packages` table | Replaced — legacy table retained |
| `credit_balances` table (team-scoped) | `contact_packages` table (contact-scoped) | Replaced — legacy table retained |
| `credit_transactions` table | `package_transactions` table | Replaced — legacy table retained |
| `subscription_plans` table | `packages` table (unified) | Replaced |
| `subscriptions` table (team-scoped) | `contact_packages` table | Replaced |
| `team_members` concept | `user_contact_link` table | Replaced |
| `services/credits.ts` | `services/packages.ts` | New — legacy kept for backward compat |
| `middleware/credits.ts` (team-scoped) | `middleware/packages.ts` (contact-scoped) | New — legacy kept for backward compat |
| `routes/adminCredits.ts` | `routes/adminPackages.ts` | New — legacy kept for backward compat |
| `routes/credits.ts` | `routes/packages.ts` (public) | New — legacy kept for backward compat |
| `AICredits.tsx` | `AIPackages.tsx` | New page, sidebar updated |

## Cross-Module Impact

| Module | Impact |
|--------|--------|
| **Contacts** | `contacts` table extended with `contact_type=3` (internal). New `user_contact_link` table links users to contacts. Contact ID 1 reserved for Soft Aware. |
| **Subscription** | Legacy subscription/credit system superseded but not deleted. New endpoints coexist alongside old ones during migration. |
| **Enterprise** | Enterprise endpoint limits (`max_enterprise_endpoints`) now enforced per-package. |
| **Landing Page (Pricing)** | Pricing section now dynamically fetches from `/packages/pricing` API. |
| **Admin Panel** | Sidebar "AI Credits" renamed to "AI Packages" (`/admin/packages`). New admin page `AIPackages.tsx`. |
| **Authentication** | Middleware resolves `contactId` from authenticated user via `user_contact_link`. |
| **AI Gateway** | AI endpoints can use `packageCreditMiddleware` for credit enforcement. |\n| **AI Telemetry** | Enterprise webhook credit deductions (10 credits/request) are logged alongside PII-sanitized analytics in `ai_analytics_logs` (SQLite). Telemetry consent columns on `users` table are independent of the package system. |
