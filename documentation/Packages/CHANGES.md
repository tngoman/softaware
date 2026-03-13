# Packages — Change Log & Known Issues

## Version History

### v1.0.0 — Package System Launch (2025-06-XX)

**Migration**: `023_packages_system.ts`
**Scope**: Full package system replacing legacy team-scoped credit model

#### Database Changes
- **Created** `packages` table — 7 seeded package definitions (Free, Starter, Professional, BYOE, Managed, Architecture & Build, Staff)
- **Created** `contact_packages` table — contact-to-package subscriptions with credit balances
- **Created** `package_transactions` table — full credit transaction history
- **Created** `user_contact_link` table — maps users to contacts (companies)
- **Modified** `contacts` table — added `contact_type` column (0=standard, 1=individual, 2=partner, 3=internal)
- **Seeded** Contact ID 1 (Soft Aware) as `contact_type = 3` with Staff package (100,000 credits)

#### Backend Changes
- **New** `services/packages.ts` — PackageService class (CRUD, subscriptions, transactions, user links, credit deduction, usage stats)
- **New** `routes/adminPackages.ts` — 15 admin endpoints with Zod validation
- **New** `routes/packages.ts` — 3 public endpoints (pricing, contact packages, check balance)
- **New** `middleware/packages.ts` — requirePackage, requireCredits, deductCreditsAfterResponse
- **Modified** `config/credits.ts` — replaced CREDIT_COSTS with REQUEST_PRICING (TEXT_CHAT, TEXT_SIMPLE, AI_BROKER, CODE_AGENT_EXECUTE, FILE_OPERATION, MCP_TOOL)
- **Modified** `app.ts` — mounted adminPackagesRouter at `/admin/packages`, packagesRouter at `/packages`
- **Modified** `caseAnalyzer.ts` — updated admin path from `/admin/ai-credits` to `/admin/packages`

#### Frontend Changes
- **New** `pages/admin/AIPackages.tsx` — 4-tab admin interface (Packages, Subscriptions, Transactions, User Links)
- **Modified** `models/AdminAIModels.ts` — added PackageDefinition, ContactPackageSubscription, PackageTransaction, UserContactLink interfaces
- **Modified** `pages/public/LandingPage.tsx` — dynamic pricing section fetching from `/packages/pricing`
- **Modified** `App.tsx` — added `/admin/packages` route
- **Modified** `Layout.tsx` — replaced "AI Credits" sidebar link with "AI Packages"

#### Legacy Impact
- Legacy `ai_credits` and `subscriptions` tables are **not dropped** — retained for data reference
- Legacy routes at `/admin/credits` are **not removed** — will be deprecated in v1.1
- New system operates independently alongside legacy tables

---

## Known Issues & Limitations

### Payment Integration (Not Yet Implemented)
- **PayFast/Yoco webhooks**: Payment webhooks are defined in the schema but no actual integration exists yet. All subscriptions are created with `payment_provider = 'MANUAL'`.
- **No idempotency key**: When payment webhook integration is added, it must include idempotency keys to prevent duplicate credit allocations.
- **No automated billing**: Monthly subscription renewals and credit top-ups require manual admin action.

### Notification System (Not Yet Implemented)
- **Low-balance alerts**: The `low_balance_threshold` and `low_balance_alert_sent` columns exist but no automated notification system is in place.
- **Upcoming expiry notifications**: No email/notification when trial or subscription is about to expire.
- **Over-limit warnings**: No alerts when contact approaches max_users, max_agents, etc.

### Credit Management
- **No automated monthly allocation**: Monthly credit top-ups must be done manually or via a scheduled job (not yet created).
- **No credit expiry**: The `EXPIRY` transaction type is defined but no automated expiry process runs at period end.
- **No refund flow**: Credits can only be refunded via admin manual `ADJUSTMENT`; no formal refund workflow.
- **No credit transfer**: Credits cannot be transferred between contacts.

### Multi-Package Support
- **Deduction order**: The multi-package deduction iterates ACTIVE then TRIAL, oldest first. There is no user-configurable priority.
- **Add-on packages**: The `ADDON` package type is defined in the schema but no add-on packages are seeded.

### Frontend
- **No real-time balance display**: The user dashboard does not yet show remaining credit balance.
- **No usage analytics**: No charts/graphs for credit consumption trends.
- **No self-service package upgrade**: Users cannot change their own package; admin must reassign.

---

## Migration Notes

### Running Migration 023
```bash
# The migration is idempotent due to ON DUPLICATE KEY UPDATE
# Safe to re-run without data loss
cd /var/opt/backend
npx ts-node src/db/runMigrations.ts
```

### Verifying Migration
```sql
-- Check tables exist
SHOW TABLES LIKE 'packages';
SHOW TABLES LIKE 'contact_packages';
SHOW TABLES LIKE 'package_transactions';
SHOW TABLES LIKE 'user_contact_link';

-- Check seed data
SELECT id, slug, name, package_type, price_monthly, credits_included FROM packages;

-- Check Soft Aware assignment
SELECT cp.*, p.name as package_name, c.company as contact_name
FROM contact_packages cp
JOIN packages p ON cp.package_id = p.id
JOIN contacts c ON cp.contact_id = c.id
WHERE cp.contact_id = 1;
```

### Rollback (if needed)
```sql
-- WARNING: Drops all package data permanently
DROP TABLE IF EXISTS package_transactions;
DROP TABLE IF EXISTS user_contact_link;
DROP TABLE IF EXISTS contact_packages;
DROP TABLE IF EXISTS packages;
ALTER TABLE contacts DROP COLUMN IF EXISTS contact_type;
```

---

## Planned Improvements

| Priority | Feature | Estimated Effort |
|----------|---------|------------------|
| High | PayFast webhook integration | 2–3 days |
| High | Automated monthly credit allocation (cron job) | 1 day |
| High | User dashboard credit balance display | 1 day |
| Medium | Low-balance email notifications | 1–2 days |
| Medium | Self-service package upgrade flow | 2–3 days |
| Medium | Usage analytics dashboard | 2–3 days |
| Low | Credit expiry automation | 1 day |
| Low | Add-on package support | 1–2 days |
| Low | Credit transfer between contacts | 1 day |

---

## Cross-Module Impact

| Module | Impact | Documentation |
|--------|--------|---------------|
| **Contacts** | Added `contact_type` column, `user_contact_link` table, package associations | See Contacts/CHANGES.md |
| **Subscription** | Legacy system superseded by Packages | See Subscription/CHANGES.md |
| **Enterprise** | `max_enterprise_endpoints` enforced per-package | See Enterprise/CHANGES.md |
| **Pricing** | Dynamic pricing from database replaces hardcoded values | See Pricing/CHANGES.md |
| **Admin** | Sidebar changed from "AI Credits" to "AI Packages", route from `/admin/ai-credits` to `/admin/packages` | See Admin/README.md |
