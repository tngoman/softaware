# Database Module — Schema Reference

**Version:** 1.0.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total MySQL tables** | 78 |
| **Active tables** | 63 |
| **Legacy tables** | 15 (`tb_*` prefix) |
| **sqlite-vec tables** | 2 |
| **Engine** | InnoDB (primary), MyISAM (2 legacy), vec0 (sqlite-vec) |
| **Charset** | `utf8mb4` |
| **Collations** | `utf8mb4_unicode_ci` (newer), `utf8mb4_0900_ai_ci` (older), `utf8mb3_general_ci` (legacy) |

> Individual table schemas for specific modules are documented in their respective `FIELDS.md` files. This document provides the **complete cross-module schema inventory** and documents the tables not covered elsewhere.

---

## 2. Complete Table Inventory

### 2.1 Core Identity Domain

#### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login identifier |
| name | VARCHAR(255) | NULLABLE | Display name |
| phone | VARCHAR(50) | NULLABLE | Phone number |
| avatarUrl | VARCHAR(512) | NULLABLE | Profile image URL |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt hash |
| notifications_enabled | BOOLEAN | DEFAULT TRUE | Global notification toggle |
| push_notifications_enabled | BOOLEAN | DEFAULT TRUE | FCM push toggle |
| web_notifications_enabled | BOOLEAN | DEFAULT TRUE | In-app notification toggle |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

#### `teams`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| name | VARCHAR(255) | NOT NULL | Team display name |
| createdByUserId | VARCHAR(36) | FK → users.id | Owner |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

#### `team_members`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| teamId | VARCHAR(36) | FK → teams.id | |
| userId | VARCHAR(36) | FK → users.id | |
| role | ENUM | 'ADMIN','STAFF','ARCHITECT','OPERATOR','AUDITOR' | Member role |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

#### `team_invites`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| teamId | VARCHAR(36) | FK → teams.id | |
| email | VARCHAR(255) | NOT NULL | Invitee email |
| role | ENUM | 'ADMIN','STAFF','ARCHITECT','OPERATOR','AUDITOR' | Assigned role |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| acceptedAt | TIMESTAMP | NULLABLE | |

#### `roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| name | VARCHAR(50) | UNIQUE, NOT NULL | e.g., `super_admin`, `admin`, `developer` |
| description | VARCHAR(255) | NULLABLE | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

**Seeded Values:** `super_admin`, `admin`, `developer`, `client_manager`, `qa_specialist`, `deployer`, `viewer`

#### `permissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| name | VARCHAR(100) | UNIQUE, NOT NULL | e.g., `view_dashboard`, `manage_invoices` |
| description | VARCHAR(255) | NULLABLE | |
| group_name | VARCHAR(50) | NOT NULL | Groups: Dashboard, Quotations, Invoices, Contacts, etc. |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

**Seeded Groups:** Dashboard, Quotations, Invoices, Contacts, Categories, Reports, Settings, System, Credentials, Software, Clients, AI, Websites, Pricing, Transactions, Leads, plus wildcard `*`

#### `role_permissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| roleId | INT | FK → roles.id | |
| permissionId | INT | FK → permissions.id | |
| UNIQUE | (roleId, permissionId) | | Prevents duplicates |

#### `user_roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| userId | VARCHAR(36) | FK → users.id | |
| roleId | INT | FK → roles.id | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

#### `user_two_factor`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| userId | VARCHAR(36) | FK → users.id | |
| secret | VARCHAR(255) | NOT NULL | TOTP secret |
| enabled | BOOLEAN | DEFAULT FALSE | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

### 2.2 AI & Assistants Domain

> Full schemas for `assistants`, `ingestion_jobs`, `assistant_knowledge`, plus sqlite-vec tables are documented in [Assistants/FIELDS.md](../Assistants/FIELDS.md).

#### `ai_model_config`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| teamId | VARCHAR(36) | FK → teams.id | |
| defaultTextProvider | VARCHAR(50) | NOT NULL | e.g., `softaware`, `openai` |
| defaultTextModel | VARCHAR(100) | NOT NULL | e.g., `deepseek-r1:1.5b` |
| visionProvider | VARCHAR(50) | NOT NULL | Provider for image analysis |
| visionModel | VARCHAR(100) | NOT NULL | |
| codeProvider | VARCHAR(50) | NOT NULL | Provider for code tasks |
| codeModel | VARCHAR(100) | NOT NULL | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| updatedAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP ON UPDATE | |

---

### 2.3 Widget Domain

> Schemas for `widget_clients`, `document_metadata`, `document_embeddings`, `chat_messages`, `crawl_queue`, `widget_leads_captured`, `widget_usage_logs` — see [the Widget/Assistants tables above in Section 3.4 of README](README.md).

---

### 2.4 Billing & Subscription Domain

> Schemas for `subscription_plans`, `subscriptions`, `billing_invoices`, `credit_balances`, `credit_transactions`, `credit_packages` are documented with their TypeScript interfaces in [FILES.md § 2.1](FILES.md).

#### `subscription_tier_limits` (reference/seed table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| tier_name | ENUM | 'free','starter','advanced','enterprise' | |
| max_messages | INT | NOT NULL | Monthly message cap |
| max_pages | INT | NOT NULL | Max ingested pages |
| branding_enabled | BOOLEAN | | Show/hide "Powered by" |
| lead_capture | BOOLEAN | | Lead capture feature |
| external_api | BOOLEAN | | BYOK (bring your own key) |
| monthly_price | DECIMAL(10,2) | | ZAR |

**Seeded Rows:**

| Tier | Messages | Pages | Price (ZAR) |
|------|----------|-------|-------------|
| free | 500 | 50 | 0 |
| starter | 2,000 | 200 | 499 |
| advanced | 10,000 | 1,000 | 999 |
| enterprise | 100,000 | 10,000 | 4,999 |

#### `activation_keys`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| code | VARCHAR(64) | UNIQUE, NOT NULL | License key |
| tier | ENUM | 'PERSONAL','TEAM','ENTERPRISE' | |
| isActive | BOOLEAN | DEFAULT TRUE | |
| cloudSyncAllowed | BOOLEAN | | |
| vaultAllowed | BOOLEAN | | |
| maxAgents | INT | NULLABLE | |
| maxUsers | INT | NULLABLE | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| createdByUserId | VARCHAR(36) | NULLABLE | FK → users.id |

#### `device_activations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| deviceId | VARCHAR(255) | NOT NULL | Machine identifier |
| appVersion | VARCHAR(50) | NULLABLE | Client version |
| isActive | BOOLEAN | DEFAULT TRUE | |
| tier | ENUM | 'PERSONAL','TEAM','ENTERPRISE' | |
| lastSeenAt | TIMESTAMP | | |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| userId | VARCHAR(36) | NULLABLE | FK → users.id |
| activationKeyId | VARCHAR(36) | NULLABLE | FK → activation_keys.id |

---

### 2.5 Software Updates Domain

> Full schemas with CREATE TABLE statements are available via `SHOW CREATE TABLE update_*`. TypeScript interfaces in [FILES.md § 2.4](FILES.md) document all columns.

Key relationship chain:

```
update_software (1) → (N) update_releases
update_software (1) → (N) update_modules
update_software (1) → (N) update_clients
update_clients  (1) → (N) update_installed
users           (1) → (N) update_user_modules → (N←1) update_modules
users           (1) → (N) update_password_resets
```

---

### 2.6 Cases Domain

```sql
-- cases (core issue tracking)
CREATE TABLE cases (
  id VARCHAR(36) PK,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity ENUM('low','medium','high','critical') DEFAULT 'medium',
  status ENUM('open','investigating','resolved','closed') DEFAULT 'open',
  type ENUM('manual','automated') DEFAULT 'manual',
  category VARCHAR(100),
  source VARCHAR(100),
  assigned_to VARCHAR(36) FK → users.id,
  created_by VARCHAR(36) FK → users.id,
  ai_analysis JSON,          -- AI-generated analysis data
  resolution TEXT,
  resolution_date DATETIME,
  customer_rating INT,
  customer_feedback TEXT,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE
);

-- case_comments (discussion per case)
CREATE TABLE case_comments (
  id VARCHAR(36) PK,
  case_id VARCHAR(36) FK → cases.id ON DELETE CASCADE,
  user_id VARCHAR(36) FK → users.id,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT NOW()
);

-- case_activity (audit trail)
CREATE TABLE case_activity (
  id VARCHAR(36) PK,
  case_id VARCHAR(36) FK → cases.id ON DELETE CASCADE,
  user_id VARCHAR(36) FK → users.id,
  action VARCHAR(100) NOT NULL,
  details JSON,
  created_at DATETIME DEFAULT NOW()
);

-- system_health_checks (auto-monitoring)
CREATE TABLE system_health_checks (
  id VARCHAR(36) PK,
  name VARCHAR(100) NOT NULL,
  type ENUM('database','service','queue','custom') NOT NULL,
  status ENUM('healthy','degraded','down','unknown') DEFAULT 'unknown',
  last_checked DATETIME,
  consecutive_failures INT DEFAULT 0,
  max_failures INT DEFAULT 3,
  auto_create_case BOOLEAN DEFAULT TRUE,
  case_id VARCHAR(36) FK → cases.id,
  config JSON,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE
);
```

**Seeded health checks:** MySQL Connection, Ollama Service, Redis Cache, Ingestion Queue

---

### 2.7 Notification Domain

#### `notifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| userId | VARCHAR(36) | FK → users.id | Recipient |
| title | VARCHAR(255) | NOT NULL | Notification title |
| body | TEXT | NOT NULL | Notification body |
| type | VARCHAR(50) | NOT NULL | Category (e.g., `case_update`, `payment`) |
| read | BOOLEAN | DEFAULT FALSE | Read status |
| metadata | JSON | NULLABLE | Additional data |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

#### `fcm_tokens`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| userId | VARCHAR(36) | FK → users.id | |
| token | TEXT | NOT NULL | Firebase Cloud Messaging token |
| deviceType | VARCHAR(50) | NULLABLE | `web`, `android`, `ios` |
| createdAt | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

## 3. sqlite-vec Schema

> Detailed in [Assistants/FIELDS.md § 3](../Assistants/FIELDS.md). Summary:

### `knowledge_chunks` (regular SQLite table)

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID (matches MySQL `assistant_knowledge.id`) |
| assistant_id | TEXT, INDEXED | Parent assistant |
| job_id | TEXT, INDEXED | Parent ingestion job |
| content | TEXT | Chunk text |
| source | TEXT | URL or filename |
| source_type | TEXT | `url` or `file` |
| chunk_index | INTEGER | Position within source |
| char_count | INTEGER | Length |
| created_at | TEXT | ISO datetime |

### `knowledge_vectors` (vec0 virtual table)

| Column | Type | Description |
|--------|------|-------------|
| chunk_id | TEXT PK | Matches `knowledge_chunks.id` |
| embedding | float[768] | 768-dim float32 nomic-embed-text vector |

---

## 4. Collation Map

The database has mixed collations due to incremental migration from PHP to Node:

| Collation | Table Count | Origin |
|-----------|-------------|--------|
| `utf8mb4_unicode_ci` | ~30 | Newer tables (migrations 001–005, manual creates) |
| `utf8mb4_0900_ai_ci` | ~30 | Older tables (migration 006, cases SQL, seeding) |
| `utf8mb3_general_ci` | 2 | Legacy PHP (`tb_quote_items`, `tb_invoice_items`) |

> **Impact:** JOINs between tables with different collations require explicit `COLLATE` clauses. Migration 009 uses `COLLATE utf8mb4_unicode_ci` in its JOIN for this reason.

---

## 5. Foreign Key Map (Key Relationships)

```
users ──────────┬──→ team_members.userId
                ├──→ team_invites (via email match)
                ├──→ user_roles.userId
                ├──→ user_two_factor.userId
                ├──→ api_keys.userId
                ├──→ notifications.userId
                ├──→ fcm_tokens.userId
                ├──→ cases.assigned_to / created_by
                ├──→ widget_clients.user_id
                ├──→ update_user_modules.user_id
                └──→ update_password_resets.user_id

teams ──────────┬──→ team_members.teamId
                ├──→ team_invites.teamId
                ├──→ vault_credentials.teamId
                ├──→ credit_balances.teamId
                ├──→ ai_model_config.teamId
                ├──→ subscriptions.teamId
                └──→ agents_config.teamId (Agent)

widget_clients ─┬──→ document_metadata.client_id
                ├──→ crawl_queue.client_id
                ├──→ widget_leads_captured.client_id
                ├──→ widget_usage_logs.client_id
                └──→ chat_messages.client_id (implied)

document_metadata ──→ document_embeddings.document_id

cases ──────────┬──→ case_comments.case_id (CASCADE)
                ├──→ case_activity.case_id (CASCADE)
                └──→ system_health_checks.case_id

assistants ─────┬──→ ingestion_jobs.assistant_id (no FK constraint)
                └──→ assistant_knowledge.assistant_id (no FK constraint)

update_software ┬──→ update_releases.software_id
                ├──→ update_modules.software_id
                └──→ update_clients.software_id
```

> **Note:** Several "relationships" are enforced by application code, not database FKs. Notably: `assistants ↔ ingestion_jobs`, `assistants ↔ assistant_knowledge`, and `credit_transactions ↔ credit_balances`.
