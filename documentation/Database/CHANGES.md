# Database Module — Change Log

**Module:** Database  
**Source:** `src/db/`, `src/services/vectorStore.ts`, `src/services/embeddingService.ts`

---

## Migration History

| # | Migration | Date | Type | Summary |
|---|-----------|------|------|---------|
| — | Initial schema | pre-2024 | — | Prisma ORM with `_prisma_migrations` tracking |
| 001 | `001_free_tier_widget.ts` | 2024 | Feature | Created widget system: `widget_clients`, `document_metadata`, `document_embeddings`, `chat_messages`, `crawl_queue`. Dropped legacy tables (`MorningBriefing`, `FleetAsset`, `ForexAlert`, `RiskIncident`). |
| 002 | `002_site_builder.ts` | 2024 | Feature | Created `generated_sites`, `site_deployments` for AI website builder. |
| 003 | `003_subscription_tiers.ts` | 2024 | Feature | Added 13 subscription columns to `widget_clients` (tier, billing, tone, lead capture, external API). Created `widget_usage_logs`, `widget_leads_captured`, `subscription_tier_limits`. Seeded 4 tiers. |
| 004 | `004_user_profile_fields.ts` | 2024 | Alter | Added `name`, `phone`, `avatarUrl` columns to `users`. |
| 005 | `005_standardize_table_names.ts` | 2024 | Refactor | Renamed ~26 tables from PascalCase to snake_case (e.g., `User` → `users`, `Team` → `teams`). Dropped `_prisma_migrations` and 4 dead tables. |
| 006 | `006_create_business_tables.ts` | 2025 | Feature | Created 15 invoicing/contacts/accounting tables: `contacts`, `contact_groups`, `categories`, `pricing`, `quotations`, `quote_items`, `invoices`, `invoice_items`, `payments`, `tax_rates`, `accounts`, `transactions`, `ledger`, `expense_categories`, `app_settings`. |
| 007 | `007_load_php_data.ts` | 2025 | Placeholder | Instructions for PHP data migration (column mapping documentation). |
| 008 | `008_load_php_data.ts` | 2025 | Seed | Loaded PHP legacy data into Node tables: expense categories (19), contacts (5 sample), categories (3), tax rates (2). Quotation/invoice/payment data placeholders. |
| 009 | `009_seed_roles_permissions.ts` | 2025 | Seed | Seeded RBAC system: 7 roles, 42 permissions across 15+ groups, role↔permission wiring. Assigned existing admin users to `admin` role. |
| 010 | `010_user_notification_preferences.ts` | 2025 | Alter | Added `notifications_enabled`, `push_notifications_enabled`, `web_notifications_enabled` to `users`. |
| SQL | `create_cases_system.sql` | 2025 | Feature | Created `cases`, `case_comments`, `case_activity`, `system_health_checks`. Seeded 4 default health checks. |

---

## Platform-Level Database Changes

### v2.0.0 — Prisma → mysql2/promise Migration

**Date:** 2024  
**Type:** Breaking — Architecture Change

| Change | Detail |
|--------|--------|
| Removed Prisma ORM | Deleted `@prisma/client`, `prisma/schema.prisma` |
| Created `mysql.ts` | Thin wrapper: pool, `db.query()`, `db.execute()`, `db.transaction()`, etc. |
| Created `prisma.ts` stub | Proxy that throws on any Prisma call (backward compat) |
| Dropped `_prisma_migrations` | Migration 005 |
| Added type files | `businessTypes.ts` (15 interfaces), `updatesTypes.ts` (8 interfaces) |

**Why:** Prisma's query abstraction was too limiting for complex JOINs, `FOR UPDATE SKIP LOCKED`, and bulk operations. The raw SQL approach gives full control and eliminated build-time schema generation.

---

### v2.1.0 — sqlite-vec Vector Store

**Date:** 2025  
**Type:** Feature — New Storage Engine

| Change | Detail |
|--------|--------|
| Added `better-sqlite3` | SQLite client for Node.js |
| Added `sqlite-vec` | Vector extension providing `vec0` virtual tables |
| Created `vectorStore.ts` | Singleton DB, `knowledge_chunks` + `knowledge_vectors` tables |
| DB path | `/var/opt/backend/data/vectors.db` |
| Vector dim | 768 (nomic-embed-text float32) |
| Pragmas | WAL journal mode, 5s busy timeout |

**Why:** MySQL's JSON-stored embeddings required full-table scan for similarity search (the `embeddingService.ts` brute-force approach). sqlite-vec provides native KNN indexing via the `vec0` MATCH operator, reducing search from O(n) to O(log n).

**Impact on ingestion:** The ingestion worker now dual-writes: MySQL `assistant_knowledge` (relational) + sqlite-vec (vector search). The RAG chat endpoint exclusively uses sqlite-vec for retrieval.

---

### v2.2.0 — Assistants Ingestion Pipeline Tables

**Date:** 2025  
**Type:** Feature

| Change | Detail |
|--------|--------|
| Created `assistants` table | Assistant identity, persona, checklist, tier, status |
| Created `ingestion_jobs` table | URL/file ingestion queue with priority tiers |
| Created `assistant_knowledge` table | MySQL-side knowledge chunks (dual-write with sqlite-vec) |
| Added `original_content` column | `ingestion_jobs` — stores raw text for editing (v1.3.0) |

---

### v2.3.0 — RBAC System

**Date:** 2025 (Migration 009)  
**Type:** Feature

| Change | Detail |
|--------|--------|
| Created `roles` table | 7 roles seeded |
| Created `permissions` table | 42 permissions across 15+ groups |
| Created `role_permissions` | Junction table |
| Created `user_roles` | User↔role assignment |
| Auto-assigned admin users | Existing `is_admin` users → `admin` role |

---

### v2.4.0 — Cases & Health Monitoring

**Date:** 2025 (create_cases_system.sql)  
**Type:** Feature

| Change | Detail |
|--------|--------|
| Created `cases` table | Issue tracking with severity, AI analysis, resolution |
| Created `case_comments` | Discussion threads (CASCADE on case delete) |
| Created `case_activity` | Audit trail (CASCADE on case delete) |
| Created `system_health_checks` | Auto-monitoring with configurable failure thresholds |
| Seeded 4 health checks | MySQL, Ollama, Redis, Ingestion Queue |

---

## Known Issues

### 🔴 HIGH — No Migration Tracking

No `schema_migrations` table exists. Migrations are applied manually with no record of which have run.

**Risk:** Re-running a migration may fail or create duplicate data.  
**Effort:** LOW — Create tracking table + simple runner script.

### 🔴 HIGH — Mixed Collation (`utf8mb4_unicode_ci` vs `utf8mb4_0900_ai_ci`)

Tables created at different times use different collations. JOINs may require explicit COLLATE clauses.

**Risk:** Silent comparison failures or runtime errors on JOINs.  
**Effort:** MEDIUM — One-time `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` for all tables.

### 🟡 MEDIUM — Legacy `tb_*` Tables

15 PHP-era tables remain. 2 use MyISAM engine (no transactions, no FK).

**Risk:** Schema noise, wasted space, confusion.  
**Effort:** LOW — Verify data loaded into Node tables, then `DROP TABLE tb_*`.

### 🟡 MEDIUM — No FK Constraints on Assistant Tables

`ingestion_jobs.assistant_id` and `assistant_knowledge.assistant_id` have no FK constraint.

**Risk:** Orphaned rows if delete logic fails.  
**Effort:** LOW — `ALTER TABLE ... ADD CONSTRAINT ... ON DELETE CASCADE`.

### 🟡 MEDIUM — Dual-Storage Drift Risk

MySQL `assistant_knowledge` and sqlite-vec `knowledge_chunks` may drift since writes are independent and sqlite-vec failures are non-fatal.

**Risk:** Recategorization (MySQL) and RAG search (sqlite-vec) may see different data.  
**Effort:** MEDIUM — Add reconciliation check or drop MySQL dual-write.

### 🟢 LOW — Deprecated `prisma.ts` Still in Codebase

Proxy stub that throws on use. Should be removed once all imports are cleaned up.

**Effort:** LOW — Delete file, search for any remaining imports.

---

## Future Enhancements

| Enhancement | Priority | Effort | Description |
|-------------|----------|--------|-------------|
| Migration runner + tracking table | 🔴 HIGH | LOW | `schema_migrations` table + `runMigrations.ts` |
| Collation standardisation | 🔴 HIGH | MEDIUM | Convert all tables to `utf8mb4_unicode_ci` |
| Drop `tb_*` legacy tables | 🟡 MEDIUM | LOW | After data verification |
| Drop MySQL dual-write | 🟡 MEDIUM | MEDIUM | Move recategorization to read from sqlite-vec |
| Add FK constraints on assistant tables | 🟡 MEDIUM | LOW | CASCADE deletes |
| Connection pool monitoring | 🟢 LOW | LOW | Log active/idle connection counts |
| Read replica support | 🟢 LOW | HIGH | Separate pool for read-heavy queries |
| Automated backups | 🟢 LOW | MEDIUM | mysql dump + sqlite-vec file copy on schedule |
