# Packages — File Inventory

## Backend Files

### `/var/opt/backend/src/services/packages.ts` (563 LOC)
**Purpose**: Core package system service — all business logic for packages, subscriptions, credits, transactions, and user-contact linking.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–15 | `db` from mysql.js |
| Type interfaces | 17–95 | `Package`, `ContactPackage`, `PackageTransaction`, `UserContactLink` |
| Package CRUD | 97–180 | `getAllPackages()`, `getPublicPackages()`, `getPackagesByType()`, `getPackageById()`, `getPackageBySlug()`, `createPackage()`, `updatePackage()`, `deletePackage()` (guards active subs) |
| Contact Packages | 182–280 | `getContactPackages()`, `getAllContactPackages()`, `getContactPackageById()`, `assignPackageToContact()` (INSERT ON DUPLICATE KEY UPDATE), `updateContactPackageStatus()` |
| Credit Operations | 282–400 | `getBalance()` (sum across active subs), `deductCredits()` (highest-balance first), `addCredits()`, `adjustCredits()` (clamped to 0) |
| Transaction Logging | 402–470 | `logTransaction()` (private), `getTransactions()` (paginated, with joins to contacts + packages + users) |
| User ↔ Contact | 472–520 | `linkUserToContact()` (ON DUPLICATE KEY UPDATE), `getUserContact()`, `getContactUsers()`, `getContactIdFromUserId()` |
| Public Pricing | 522–530 | `getPublicPricing()` — splits public packages into consumer/enterprise |
| Usage Stats | 532–555 | `getUsageStats()` — per-type and daily breakdown for a contact |
| Helpers | 557–563 | `parsePackageRow()` (boolean casting), `formatPrice()` (cents → "R199.00") |

---

### `/var/opt/backend/src/routes/adminPackages.ts` (305 LOC)
**Purpose**: Admin-only CRUD for the entire package system.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–14 | Express, Zod, `requireAuth`, `requireAdmin`, `packageService` |
| Middleware | 16 | `adminPackagesRouter.use(requireAuth, requireAdmin)` |
| Zod Schemas | 18–65 | `createPackageSchema`, `updatePackageSchema`, `assignPackageSchema`, `updateStatusSchema`, `adjustCreditsSchema`, `linkUserSchema` |
| Package CRUD | 67–135 | GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id` |
| Subscriptions | 137–210 | GET `/subscriptions/all`, GET `/subscriptions/:contactId`, POST `/subscriptions/assign`, PATCH `/subscriptions/:id/status` |
| Credits | 212–240 | POST `/credits/adjust` |
| Transactions | 242–275 | GET `/transactions/all`, GET `/transactions/:contactId` |
| Usage & Links | 277–305 | GET `/usage/:contactId`, POST `/link-user`, GET `/contact-users/:contactId` |

---

### `/var/opt/backend/src/routes/packages.ts` (83 LOC)
**Purpose**: Public-facing package pricing endpoints (no auth).

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–11 | Express, `packageService` |
| GET `/pricing` | 13–30 | Public pricing for landing page (consumer + enterprise split) |
| GET `/list` | 32–40 | All active public packages |
| GET `/:slug` | 42–55 | Single package by slug |
| `formatPublicPackage()` | 57–83 | Parses features JSON, shapes public output |

---

### `/var/opt/backend/src/middleware/packages.ts` (210 LOC)
**Purpose**: Credit enforcement middleware for AI endpoints — replaces legacy team-scoped `middleware/credits.ts`.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 15–17 | Express types, `packageService`, `REQUEST_PRICING` from config/credits |
| Express extension | 19–28 | Extends `Request` with `contactId`, `contactPackageId`, `creditBalance` |
| `requirePackage()` | 30–68 | Resolves contact from `user_contact_link`, finds active subscription |
| `requireCredits()` | 70–100 | Checks balance, sets X-Credit headers, blocks with 402 if empty |
| `deductCreditsAfterResponse()` | 102–150 | Hooks `res.end`/`res.json`, deducts credits after 2xx response |
| `packageCreditMiddleware()` | 152–162 | Combined: requirePackage → requireCredits → deductCreditsAfterResponse |
| `detectRequestType()` | 164–178 | Maps URL paths to `REQUEST_PRICING` keys (TEXT_CHAT, TEXT_SIMPLE, etc.) |
| `calculateCost()` | 180–210 | Computes credit cost from base + per-token + multiplier |

---

### `/var/opt/backend/src/db/migrations/023_packages_system.ts` (409 LOC)
**Purpose**: Complete schema creation and seed data for the package system.

| Section | Lines | Description |
|---------|-------|-------------|
| `up()` function | 22–395 | Creates 4 tables, ensures Soft Aware at ID 1, seeds 5 canonical packages (per `config/tiers.ts`), assigns Staff package |
| Table 1: `packages` | 28–55 | Package definitions with type, pricing, limits, features JSON, display flags |
| Table 2: `contact_packages` | 57–85 | Subscriptions with integrated credit balance, UNIQUE(contact_id, package_id) |
| Table 3: `package_transactions` | 87–108 | Credit movement log with type enum, metadata JSON |
| Table 4: `user_contact_link` | 110–123 | User↔Contact mapping with role, UNIQUE(user_id, contact_id) |
| Soft Aware seed | 130–148 | Ensures contact ID 1 = Soft Aware (contact_type=3), overwrites if needed |
| Package seeds | 150–345 | 7 packages: Free, Starter(R199), Professional(R499), BYOE(R5,000), Managed(R15,000), Architecture & Build(contact), Staff(internal) |
| Staff assignment | 370–390 | Assigns Staff package to Soft Aware with 100,000 credits |
| `down()` function | 397–409 | Drops all 4 tables (does not remove Soft Aware contact) |

---

### `/var/opt/backend/src/config/credits.ts` (172 LOC)
**Purpose**: Request pricing definitions used by the package middleware to calculate credit costs.

| Section | Lines | Description |
|---------|-------|-------------|
| `REQUEST_TYPES` | 1–9 | Array of valid request type strings |
| `RequestPricing` interface | 22–26 | `baseCost`, `perTokenCost?`, `perMultiplier?` |
| `REQUEST_PRICING` | 31–68 | TEXT_CHAT (10 base), TEXT_SIMPLE (5), AI_BROKER (1), CODE_AGENT_EXECUTE (20), FILE_OPERATION (1), MCP_TOOL (5) |
| `calculateCreditCost()` | 70–95 | Utility function for cost calculation |
| `CREDIT_PACKAGES` | 96–140 | Legacy package definitions (retained for backward compat) |
| Thresholds & Bonuses | 142–170 | LOW_BALANCE_THRESHOLDS, SIGNUP_BONUS, REFERRAL_BONUS, `creditsToZAR()`, `zarToCredits()` |

---

### `/var/opt/backend/src/scripts/run-migration-023.ts` (23 LOC)
**Purpose**: Migration runner script.

**Usage**: `cd /var/opt/backend && npx tsx src/scripts/run-migration-023.ts`

---

## Frontend Files

### `/var/opt/frontend/src/pages/admin/AIPackages.tsx` (662 LOC)
**Purpose**: Admin package management page with 3 tabs — replaces legacy `AICredits.tsx`.

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–15 | React, Heroicons, SweetAlert2, `AdminPackagesModel`, types |
| State declarations | 30–80 | Tab state, packages/subscriptions/transactions arrays, form states for package create/edit, subscription assign, credit adjust |
| `loadData()` | 82–100 | Parallel fetch of packages, subscriptions, transactions |
| `openNewPackage()` | 102–115 | Reset form for new package creation |
| `openEditPackage()` | 116–135 | Populate form from existing package (parse features JSON → newline-delimited string) |
| `handleSavePackage()` | 136–160 | Create/update with features string→array conversion, null coercion for optional limits |
| `handleDeletePackage()` | 162–185 | SweetAlert confirmation, calls `AdminPackagesModel.deletePackage()` |
| `handleAssignPackage()` | 187–210 | Assign package to contact with billing cycle and status |
| `handleAdjustCredits()` | 212–235 | Adjust credits on a subscription with reason |
| **Packages tab** | 240–380 | Card grid: type badge (CONSUMER/ENTERPRISE/STAFF/ADDON with colors), pricing display, features list, limits, status indicators (active/public/featured), edit/delete buttons |
| **Subscriptions tab** | 382–450 | Table: contact name, package name, status badge, billing cycle, credits balance/used, period end, Assign + Adjust buttons |
| **Transactions tab** | 450–520 | Table: date, contact, package, type badge (color-coded), amount (+/-), balance after, description |
| Package form modal | 520–620 | Full form: slug, name, description, type select, pricing (monthly/annually in cents), credits, 5 limit fields, features textarea, display order, CTA text, checkboxes (active/public/featured) |
| Assign form modal | 620–645 | Contact ID, package select, billing cycle, status |
| Adjust form modal | 645–662 | Subscription select, amount, reason |

**Type badges**: CONSUMER (blue), ENTERPRISE (purple), STAFF (amber), ADDON (green)
**Transaction types**: PURCHASE (green), USAGE (red), BONUS (blue), REFUND (orange), ADJUSTMENT (gray), MONTHLY_ALLOCATION (indigo), EXPIRY (pink)

---

### `/var/opt/frontend/src/models/AdminAIModels.ts` (additions ~175 LOC)
**Purpose**: API client class and TypeScript types for the package system.

| Addition | Lines | Description |
|----------|-------|-------------|
| `PackageDefinition` interface | ~114–136 | Full package type with all fields |
| `ContactPackageSubscription` interface | ~138–162 | Subscription + balance + joined names |
| `PackageTransaction` interface | ~164–185 | Transaction type with joined names |
| `AdminPackagesModel` class | ~280–449 | Static methods: `getAllPackages()`, `getPackage()`, `createPackage()`, `updatePackage()`, `deletePackage()`, `getAllSubscriptions()`, `getContactSubscriptions()`, `assignPackage()`, `updateSubscriptionStatus()`, `adjustCredits()`, `getTransactions()`, `getContactTransactions()`, `getUsageStats()`, `linkUserToContact()`, `getContactUsers()` |

---

### `/var/opt/frontend/src/pages/public/LandingPage.tsx` (modified)
**Purpose**: Landing page pricing section now fetches from database API.

| Change | Description |
|--------|-------------|
| Added imports | `useState`, `useEffect`, `getApiBaseUrl` from `../../config/app` |
| Fallback arrays | Hardcoded `consumerPlans`/`enterprisePlans` renamed to `fallbackConsumerPlans`/`fallbackEnterprisePlans` |
| `apiPackageToPlan()` | Converter function: maps API package shape → legacy plan shape |
| Tier mappings | `consumerTierMap` / `enterpriseTierMap` — slug → tier string mapping |
| `useEffect` fetch | On mount, fetches `${baseUrl}/packages/pricing`, maps to plan shape, sets state |
| Fallback behavior | If API fails, hardcoded fallback plans remain — no user-visible error |

---

### `/var/opt/frontend/src/models/index.ts` (modified)
**Purpose**: Added exports for package types.

| Export | Type |
|--------|------|
| `AdminPackagesModel` | Class |
| `PackageDefinition` | Interface |
| `ContactPackageSubscription` | Interface |
| `PackageTransaction` | Interface |
