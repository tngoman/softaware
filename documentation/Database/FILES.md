# Database Module — File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 15 (1 helper + 1 deprecated stub + 2 type defs + 11 migrations) |
| **Total LOC** | ~2,100 (source, excluding migrations) |
| **Primary helper** | `src/db/mysql.ts` (373 LOC) |
| **Vector store** | `src/services/vectorStore.ts` (219 LOC) — documented in [Assistants/FILES.md](../Assistants/FILES.md) |

### Directory Tree

```
src/db/
  mysql.ts                          (373 LOC) ⭐ Primary — pool, helpers, types
  prisma.ts                          (23 LOC) ⚠️ Deprecated stub (Proxy throws)
  businessTypes.ts                  (178 LOC)  TypeScript interfaces for invoicing/contacts
  updatesTypes.ts                   (119 LOC)  TypeScript interfaces for update_* tables
  migrations/
    001_free_tier_widget.ts                    Widget system tables
    002_site_builder.ts                        Site builder tables
    003_subscription_tiers.ts                  Subscription/billing additions
    004_user_profile_fields.ts                 User avatar/phone/name
    005_standardize_table_names.ts             PascalCase → snake_case rename
    006_create_business_tables.ts              Invoicing/contacts/accounting tables
    007_load_php_data.ts                       Placeholder — PHP load instructions
    008_load_php_data.ts                       Actual PHP data loader (seed)
    009_seed_roles_permissions.ts              RBAC roles + permissions seed
    010_user_notification_preferences.ts       Notification preference columns
    create_cases_system.sql                    Cases + health checks (raw SQL)

External (vector store):
  src/services/vectorStore.ts       (219 LOC)  sqlite-vec wrapper
  /var/opt/backend/data/vectors.db             sqlite-vec database file
```

---

## 2. Core Files

### 2.1 `src/db/mysql.ts` — Primary Database Helper ⭐

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/mysql.ts` |
| **LOC** | 373 |
| **Purpose** | MySQL connection pool, query helpers, UUID generation, date conversion, TypeScript entity interfaces |
| **Dependencies** | `mysql2/promise`, `crypto`, `config/env` |
| **Exports** | `pool`, `db`, `generateId()`, `toMySQLDate()`, `fromMySQLDate()`, all entity interfaces |

#### Connection Pool Configuration

| Setting | Value |
|---------|-------|
| `host` | Parsed from `DATABASE_URL` |
| `port` | Parsed from `DATABASE_URL` (default 3306) |
| `user` | Parsed from `DATABASE_URL` |
| `password` | Parsed from `DATABASE_URL` |
| `database` | Parsed from `DATABASE_URL` |
| `connectionLimit` | 10 |
| `waitForConnections` | `true` |
| `queueLimit` | 0 (unlimited) |
| `enableKeepAlive` | `true` |
| `keepAliveInitialDelay` | 0 |

#### `db` Helper Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `query<T>` | `(sql, params?) → Promise<T[]>` | Array of rows | Execute SELECT, return all rows |
| `queryOne<T>` | `(sql, params?) → Promise<T \| null>` | Single row or null | Execute SELECT, return first row |
| `insert` | `(sql, params?) → Promise<string>` | insertId as string | Execute INSERT, return auto-increment ID |
| `insertOne` | `(table, data) → Promise<string>` | insertId as string | Build INSERT from table name + object |
| `execute` | `(sql, params?) → Promise<number>` | affectedRows count | Execute UPDATE/DELETE |
| `transaction<T>` | `(callback) → Promise<T>` | Callback result | Run queries in a transaction (auto-rollback) |
| `ping` | `() → Promise<boolean>` | `true`/`false` | Health check (`SELECT 1`) |
| `close` | `() → Promise<void>` | — | Close all pool connections |

#### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `generateId()` | `() → string` | `crypto.randomUUID()` |
| `toMySQLDate(date)` | `(Date) → string` | `"2026-03-05 12:00:00"` format |
| `fromMySQLDate(date)` | `(string\|Date) → Date` | Parse MySQL datetime to JS Date |
| `parseConnectionString(url)` | `(string) → config` | Extract user/pass/host/port/db from `mysql://...` URL |

#### TypeScript Entity Interfaces (defined in mysql.ts)

| Interface | Table | Key Fields |
|-----------|-------|------------|
| `User` | `users` | id, email, name, phone, avatarUrl, passwordHash |
| `Team` | `teams` | id, name, createdByUserId |
| `team_members` | `team_members` | teamId, userId, role (ADMIN/STAFF/ARCHITECT/OPERATOR/AUDITOR) |
| `team_invites` | `team_invites` | teamId, email, role, acceptedAt |
| `Agent` | `agents_config` | teamId, name, version, region, compliance, blueprint |
| `vault_credentials` | `vault_credentials` | teamId, name, kind, description, revokedAt |
| `activation_keys` | `activation_keys` | code, tier, isActive, cloudSyncAllowed, vaultAllowed |
| `device_activations` | `device_activations` | deviceId, appVersion, isActive, tier |
| `client_agents` | `client_agents` | deviceId, agentId, name, version, region |
| `api_keys` | `api_keys` | name, key, userId, isActive, lastUsedAt, expiresAt |
| `credit_balances` | `credit_balances` | teamId, balance, totalPurchased, totalUsed |
| `credit_transactions` | `credit_transactions` | creditBalanceId, type, amount, requestType |
| `credit_packages` | `credit_packages` | name, credits, price, bonusCredits, featured |
| `ai_model_config` | `ai_model_config` | teamId, defaultTextProvider/Model, visionProvider/Model |
| `subscription_plans` | `subscription_plans` | tier, name, priceMonthly, maxUsers, maxDevices |
| `Subscription` | `subscriptions` | teamId, planId, status, billingCycle, paymentProvider |
| `Invoice` (billing) | `billing_invoices` | subscriptionId, invoiceNumber, subtotal, vatAmount, total |
| `Payment` (billing) | (billing payments) | invoiceId, amount, status, provider, cardLast4 |

---

### 2.2 `src/db/prisma.ts` — Deprecated Stub ⚠️

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/prisma.ts` |
| **LOC** | 23 |
| **Purpose** | Backward-compatibility stub — exports a Proxy that throws on any Prisma method call |
| **Status** | DEPRECATED — logs warning, then throws `Error: Prisma has been removed` |

The platform originally used Prisma ORM. Migration 005 dropped the `_prisma_migrations` table. This stub ensures any remaining Prisma imports fail loudly with a helpful message directing developers to `mysql.ts`.

---

### 2.3 `src/db/businessTypes.ts` — Business Entity Interfaces

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/businessTypes.ts` |
| **LOC** | 178 |
| **Purpose** | TypeScript interfaces for the invoicing, contacts, and accounting tables |
| **Exports** | `Contact`, `ContactGroup`, `Category`, `Pricing`, `Quotation`, `QuoteItem`, `Invoice`, `InvoiceItem`, `Payment`, `TaxRate`, `Account`, `Transaction`, `Ledger`, `ExpenseCategory`, `AppSettings` |

> **Note:** These interfaces use `snake_case` field names matching the MySQL columns directly (e.g., `company_name`, `contact_person`), unlike the PlatformCore types in `mysql.ts` which use `camelCase`.

---

### 2.4 `src/db/updatesTypes.ts` — Software Updates Interfaces

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/updatesTypes.ts` |
| **LOC** | 119 |
| **Purpose** | TypeScript interfaces for the `update_*` table family (software distribution system) |
| **Exports** | `UpdSoftware`, `UpdUpdate`, `UpdClient`, `UpdModule`, `UpdUserModule`, `UpdInstalledUpdate`, `UpdPasswordResetToken`, `ClientStatus`, `computeClientStatus()`, `UpdUserRole` |

#### `computeClientStatus()` — Heartbeat-Based Status

| Seconds Since Heartbeat | Status |
|--------------------------|--------|
| < 300 (5 min) | `online` |
| < 86,400 (24 hr) | `recent` |
| < 604,800 (7 days) | `inactive` |
| ≥ 604,800 | `offline` |

---

## 3. Migration Files

### Migration Inventory

| # | File | Signature | Creates | Alters | Drops |
|---|------|-----------|---------|--------|-------|
| 001 | `001_free_tier_widget.ts` | `runMigration()` (standalone) | 5 tables | — | 4 legacy tables |
| 002 | `002_site_builder.ts` | `up()` / `down()` | 2 tables | — | — |
| 003 | `003_subscription_tiers.ts` | `up()` / `down()` | 3 tables + seed data | 13 cols on `widget_clients` | — |
| 004 | `004_user_profile_fields.ts` | `up()` / `down()` | — | 3 cols on `users` | — |
| 005 | `005_standardize_table_names.ts` | `up(conn)` / `down(conn)` | — | Renames ~26 tables | Drops 5 dead tables + `_prisma_migrations` |
| 006 | `006_create_business_tables.ts` | `up(conn)` / `down(conn)` | 15 tables | — | — |
| 007 | `007_load_php_data.ts` | `up(conn)` / `down(conn)` | — (placeholder) | — | — |
| 008 | `008_load_php_data.ts` | `up()` / `down()` | — | Seed data into business tables | — |
| 009 | `009_seed_roles_permissions.ts` | `up(pool)` | Seed data | — | — |
| 010 | `010_user_notification_preferences.ts` | `up()` / `down()` | — | 3 cols on `users` | — |
| SQL | `create_cases_system.sql` | Raw SQL | 4 tables + seed data | — | — |

### ⚠️ Migration System Notes

| Concern | Status |
|---------|--------|
| **No migration runner** | Migrations must be run manually (`tsx` or `mysql` CLI) |
| **No tracking table** | No record of which migrations have been applied |
| **Inconsistent signatures** | Some take no args, some take `conn`, some take `pool` |
| **No ordering enforcement** | Nothing ensures sequential execution |
| **Idempotent guards** | Most migrations check `INFORMATION_SCHEMA` or catch `ER_DUP_FIELDNAME` |

---

## 4. External: sqlite-vec (Vector Store)

The sqlite-vec database is **not** in `src/db/` — it lives in `src/services/vectorStore.ts` and is documented fully in [Assistants/FILES.md § 2.3](../Assistants/FILES.md). Included here for completeness:

| Property | Value |
|----------|-------|
| **File** | `/var/opt/backend/src/services/vectorStore.ts` (219 LOC) |
| **DB path** | `/var/opt/backend/data/vectors.db` |
| **Engine** | `better-sqlite3` + `sqlite-vec` extension |
| **Tables** | `knowledge_chunks` (metadata), `knowledge_vectors` (vec0 virtual) |
| **Dimensions** | 768 (float32, nomic-embed-text) |
| **Pragmas** | `journal_mode = WAL`, `busy_timeout = 5000` |
