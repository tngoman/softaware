# Admin Module — Database Schema & Fields

**Version:** 1.2.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 17 core tables + 10+ referenced by dashboard |
| **JSON storage** | 1 file (enterprise_endpoints.json) |
| **Foreign key constraints** | 4 relationships |
| **Indexes** | 18+ total |
| **ENUM fields** | 5 status/type enums |

---

## 2. MySQL Tables

### 2.1 `users` — User Accounts

**Purpose:** Core user accounts with authentication and account status for kill switch system.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | - | User UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | - | Login email |
| name | VARCHAR(255) | NULLABLE | NULL | Display name |
| password_hash | VARCHAR(255) | NULLABLE | NULL | bcrypt hash |
| account_status | ENUM | NOT NULL | 'active' | Master kill switch status |
| createdAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Account creation |
| updatedAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last modification |
| role_id | VARCHAR(36) | NULLABLE, FK | NULL | Role foreign key |
| email_verified | BOOLEAN | NOT NULL | FALSE | Email verification status |
| last_login | DATETIME | NULLABLE | NULL | Last successful login |

**account_status Values:**
- `active` — Full access to all services
- `suspended` — Account blocked, all services disabled
- `demo_expired` — Demo period ended, prompt upgrade

**Indexes:**
```sql
PRIMARY KEY (id)
UNIQUE KEY idx_email (email)
INDEX idx_status (account_status)
INDEX idx_role_id (role_id)
INDEX idx_created (createdAt)
```

**Relationships:**
- `assistants.userId → users.id` — User's assistants
- `widget_clients.user_id → users.id` — User's widgets
- `teams.ownerId → users.id` — Owned teams
- `user_roles.user_id → users.id` — Role assignments

**Business Rules:**
- Email must be unique across platform
- `account_status='suspended'` blocks ALL child resources (cascading kill switch)
- Password hash uses bcrypt with 10 rounds
- `updatedAt` auto-updates on any column change

**Kill Switch Enforcement:**
Checked in `statusCheck` middleware on every authenticated request:
```typescript
if (user.account_status !== 'active') {
  return res.status(403).json({ error: 'Account suspended' });
}
```

---

### 2.2 `assistants` — AI Assistants

**Purpose:** AI assistant configurations with knowledge base, status, and tier management.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(255) | PK, NOT NULL | - | Format: `assistant-{timestamp}` |
| userId | VARCHAR(36) | NULLABLE, INDEXED | NULL | Owner user ID |
| name | VARCHAR(255) | NOT NULL | - | Display name |
| description | TEXT | NULLABLE | NULL | Business description |
| business_type | VARCHAR(255) | NULLABLE | NULL | Persona key (saas, restaurant, etc.) |
| personality | VARCHAR(50) | NULLABLE | NULL | professional, friendly, expert, casual |
| primary_goal | TEXT | NULLABLE | NULL | Primary objective |
| website | VARCHAR(512) | NULLABLE | NULL | Business website |
| data | JSON | NULLABLE | NULL | Full config as JSON |
| status | ENUM | NOT NULL | 'active' | Kill switch status |
| tier | ENUM | NOT NULL | 'free' | Subscription tier |
| pages_indexed | INT | NOT NULL | 0 | Knowledge base page count |
| knowledge_categories | JSON | NULLABLE | NULL | Dynamic checklist |
| lead_capture_email | VARCHAR(255) | NULLABLE | NULL | Email for leads |
| webhook_url | VARCHAR(512) | NULLABLE | NULL | Integration webhook |
| enabled_tools | JSON | NULLABLE | NULL | Array of tool names |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Creation time |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last update |

**status Values:**
- `active` — Fully operational
- `suspended` — Blocked by admin
- `demo_expired` — Demo ended

**tier Values:**
- `free` — Limited features
- `paid` — Full features

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_userId (userId)
INDEX idx_status (status)
INDEX idx_tier (tier)
INDEX idx_created (created_at)
```

**knowledge_categories JSON Structure:**
```json
{
  "checklist": [
    {
      "key": "pricing_plans",
      "label": "Pricing Plans",
      "satisfied": true,
      "type": "url",
      "custom": false
    },
    {
      "key": "api_docs",
      "label": "API Documentation",
      "satisfied": false,
      "type": "url",
      "custom": false
    }
  ]
}
```

**Business Rules:**
- ID generated as `"assistant-" + Date.now()` (not UUID)
- `pages_indexed` synced from `COUNT(*) FROM ingestion_jobs WHERE status='completed'`
- `data` JSON mirrors columns in camelCase (legacy compatibility)
- Parent account suspension blocks assistant regardless of its status
- Free tier limited to 3 assistants per user (enforced in frontend)

---

### 2.3 `widget_clients` — Chat Widgets

**Purpose:** Embeddable chat widget instances with subscription and usage tracking.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Widget ID |
| user_id | VARCHAR(36) | NULLABLE, INDEXED | NULL | Owner user ID |
| website_url | VARCHAR(512) | NOT NULL | - | Website domain |
| status | ENUM | NOT NULL | 'active' | Kill switch status |
| subscription_tier | ENUM | NOT NULL | 'free' | Pricing tier |
| message_count | INT | NOT NULL | 0 | Messages used this month |
| max_messages | INT | NOT NULL | 100 | Monthly message limit |
| pages_ingested | INT | NOT NULL | 0 | Knowledge pages indexed |
| max_pages | INT | NOT NULL | 10 | Page ingestion limit |
| monthly_price | DECIMAL(10,2) | NOT NULL | 0.00 | Current subscription price |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Creation time |
| last_active | DATETIME | NULLABLE | NULL | Last message timestamp |

**status Values:**
- `active` — Widget operational
- `suspended` — Blocked by admin
- `demo_expired` — Demo ended
- `upgraded` — Transitioned to paid (semantic marker)

**subscription_tier Values:**
- `free` — 100 messages/month, 10 pages
- `starter` — 1000 messages/month, 50 pages
- `pro` — 5000 messages/month, 200 pages
- `enterprise` — Unlimited (custom pricing)

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_user_id (user_id)
INDEX idx_status (status)
INDEX idx_tier (subscription_tier)
INDEX idx_last_active (last_active)
```

**Business Rules:**
- `message_count` increments on each widget chat request
- Reset `message_count=0` on 1st of each month (cron job)
- Requests blocked when `message_count >= max_messages`
- Parent account suspension blocks widget regardless of its status
- `last_active` updated on every successful message

---

### 2.4 `credit_packages` — Credit Packages

**Purpose:** Purchasable credit packages with pricing and bonus configuration.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | - | Package UUID |
| name | VARCHAR(50) | NOT NULL | - | Package name |
| description | VARCHAR(200) | NULLABLE | NULL | Marketing description |
| credits | INT | NOT NULL | - | Base credits |
| bonusCredits | INT | NOT NULL | 0 | Bonus credits added |
| price | INT | NOT NULL | - | Price in cents (e.g., 9900 = R99.00) |
| featured | BOOLEAN | NOT NULL | FALSE | Show prominently in UI |
| isActive | BOOLEAN | NOT NULL | TRUE | Soft delete flag |
| displayOrder | INT | NOT NULL | 0 | Sort order in UI |
| createdAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Creation time |
| updatedAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last update |

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_active (isActive)
INDEX idx_featured (featured)
INDEX idx_display_order (displayOrder)
```

**Computed Fields (not in DB):**
- `totalCredits` = credits + bonusCredits
- `formattedPrice` = `R${(price / 100).toFixed(2)}`
- `discountPercent` = volume discount calculation

**Business Rules:**
- All prices in cents (divide by 100 for display)
- `isActive=false` hides from public listings (soft delete)
- `featured=true` packages shown first in checkout
- `bonusCredits` included in purchase but not charged

**Example Packages:**
```json
[
  {"name": "Starter", "credits": 1000, "bonusCredits": 100, "price": 9900},
  {"name": "Pro", "credits": 5000, "bonusCredits": 1000, "price": 39900},
  {"name": "Enterprise", "credits": 50000, "bonusCredits": 10000, "price": 299900}
]
```

---

### 2.5 `credit_balances` — Team Credit Balances

**Purpose:** Current credit balance for each team with tracking totals and alert thresholds.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | - | Balance record UUID |
| teamId | VARCHAR(36) | UNIQUE, NOT NULL, FK | - | Team UUID |
| balance | INT | NOT NULL | 0 | Current credit balance |
| totalPurchased | INT | NOT NULL | 0 | Lifetime credits purchased |
| totalUsed | INT | NOT NULL | 0 | Lifetime credits consumed |
| lowBalanceThreshold | INT | NOT NULL | 100 | Alert threshold |
| lowBalanceAlertSent | BOOLEAN | NOT NULL | FALSE | Whether low-balance alert was sent |
| createdAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Record creation |
| updatedAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last balance change |

**Indexes:**
```sql
PRIMARY KEY (id)
UNIQUE KEY idx_teamId (teamId)
INDEX idx_balance (balance)
```

**Relationships:**
- `teamId → teams.id` — Foreign key with CASCADE

**Business Rules:**
- One balance record per team (enforced by UNIQUE constraint)
- Balance decremented on API requests (via `credit_transactions`)
- Balance incremented on package purchases
- Admin adjustments create `ADJUSTMENT` type transactions
- Negative balances blocked (requests fail when balance insufficient)

**Balance Check Before API Request:**
```sql
SELECT balance FROM credit_balances WHERE teamId = ?
-- If balance < request_cost, return 402 Payment Required
```

---

### 2.6 `credit_transactions` — Transaction Audit Trail

**Purpose:** Complete history of all credit movements for auditing and reporting.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | - | Transaction UUID |
| creditBalanceId | VARCHAR(36) | NOT NULL, INDEXED, FK | - | Credit balance record ID |
| amount | INT | NOT NULL | - | Credits added (positive) or used (negative) |
| balanceAfter | INT | NOT NULL | - | Balance after this transaction |
| type | ENUM | NOT NULL | - | Transaction category |
| requestType | VARCHAR(50) | NULLABLE | NULL | AI request type (TEXT_CHAT, CODE_AGENT_EXECUTE, etc.) |
| description | TEXT | NULLABLE | NULL | Human-readable description |
| paymentProvider | VARCHAR(50) | NULLABLE | NULL | Payment gateway used (PAYFAST, YOCO, etc.) |
| externalPaymentId | VARCHAR(255) | NULLABLE | NULL | External payment reference |
| metadata | JSON | NULLABLE | NULL | Additional context |
| createdAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Transaction timestamp |

**Note:** The `teamId` field is resolved by JOINing through `credit_balances` (`creditBalanceId → credit_balances.id → credit_balances.teamId`).

**type Values:**
- `PURCHASE` — Credits purchased via payment gateway
- `USAGE` — Credits consumed by API request
- `ADJUSTMENT` — Manual admin adjustment
- `BONUS` — Promotional credits, signup bonuses

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_creditBalanceId (creditBalanceId)
INDEX idx_type (type)
INDEX idx_createdAt (createdAt)
INDEX idx_balance_created (creditBalanceId, createdAt)
```

**Relationships:**
- `creditBalanceId → credit_balances.id` — Foreign key with CASCADE
- Team resolved via: `credit_transactions.creditBalanceId → credit_balances.id → credit_balances.teamId → teams.id`

**metadata JSON Examples:**

*Purchase:*
```json
{
  "package_id": "pkg-uuid-123",
  "payment_id": "pay-stripe-xyz",
  "payment_method": "credit_card"
}
```

*Usage:*
```json
{
  "request_id": "req-uuid-456",
  "request_type": "TEXT_CHAT",
  "tokens_used": 850,
  "model": "qwen2.5-coder:32b"
}
```

*Adjustment:*
```json
{
  "admin_id": "admin-uuid-789",
  "reason": "Refund for service outage"
}
```

**Business Rules:**
- Immutable records (no UPDATE or DELETE)
- All balance changes must create transaction
- Negative amounts for credit usage
- Positive amounts for purchases/adjustments
- `description` displayed in UI transaction history

---

### 2.7 `teams` — Teams (Credit Owners)

**Purpose:** Organization grouping for credit management and billing.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | - | Team UUID |
| name | VARCHAR(100) | NOT NULL | - | Team display name |
| ownerId | VARCHAR(36) | NULLABLE, INDEXED, FK | NULL | Team owner user ID |
| createdAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Team creation |
| updatedAt | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last update |

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_ownerId (ownerId)
INDEX idx_name (name)
```

**Relationships:**
- `ownerId → users.id` — Team owner (can manage billing)
- `credit_balances.teamId → teams.id` — Team's credit balance
- `credit_transactions.teamId → teams.id` — Team's transactions

**Business Rules:**
- One owner per team (but owner can have multiple teams)
- Team required for credit system (users operate under teams)
- Default team created automatically on user signup: `{name: user.name + "'s Team"}`
- Owner can invite team members (shared credit pool)

---

## 3. JSON File Storage

### 3.1 enterprise_endpoints.json

**Location:** `/var/opt/backend/data/enterprise_endpoints.json`

**Purpose:** Persistent storage for dynamic enterprise webhook endpoints. Loaded into memory Map on server start for fast access.

**Structure:**
```json
{
  "ep-1709000000000": {
    "id": "ep-1709000000000",
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "status": "active",
    "inbound_provider": "whatsapp",
    "inbound_auth_type": "bearer",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5-coder:32b",
    "llm_system_prompt": "You are a helpful assistant for Acme Corp...",
    "llm_tools_config": "[{\"name\":\"search\",\"description\":\"Search knowledge base\"}]",
    "llm_temperature": 0.3,
    "llm_max_tokens": 1024,
    "llm_knowledge_base": null,
    "target_api_url": "https://acme.com/api/webhook",
    "target_api_auth_type": "bearer",
    "target_api_auth_value": "secret_token_here",
    "target_api_headers": "{\"X-Custom-Header\":\"value\"}",
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-03-04T12:00:00.000Z",
    "last_request_at": "2026-03-04T11:45:00.000Z",
    "total_requests": 1250
  },
  "ep-1709100000000": {
    "id": "ep-1709100000000",
    "client_id": "beta-client",
    "client_name": "Beta Corporation",
    "status": "paused",
    "inbound_provider": "slack",
    "llm_provider": "openrouter",
    "llm_model": "anthropic/claude-3-sonnet",
    "llm_system_prompt": "You are Beta Corp's internal assistant...",
    "llm_temperature": 0.5,
    "llm_max_tokens": 2048,
    "created_at": "2026-02-20T14:00:00.000Z",
    "updated_at": "2026-03-01T09:00:00.000Z",
    "total_requests": 456
  }
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Auto-generated: `ep-{timestamp}` |
| client_id | string | Yes | Client identifier (1-100 chars) |
| client_name | string | Yes | Display name (1-255 chars) |
| status | enum | Yes | active, paused, disabled |
| inbound_provider | enum | Yes | whatsapp, slack, custom_rest, sms, email, web |
| inbound_auth_type | enum | No | bearer, apikey, none (planned) |
| llm_provider | enum | Yes | ollama, openrouter, openai |
| llm_model | string | Yes | Model identifier |
| llm_system_prompt | string | Yes | System prompt defining behavior |
| llm_tools_config | string | No | JSON array of tool definitions |
| llm_temperature | number | No | 0-2, default: 0.3 |
| llm_max_tokens | number | No | 1-16384, default: 1024 |
| llm_knowledge_base | string | No | Assistant ID for RAG (planned) |
| target_api_url | string | No | Downstream API URL |
| target_api_auth_type | enum | No | bearer, basic, custom, none |
| target_api_auth_value | string | No | Token or credentials |
| target_api_headers | string | No | JSON object of headers |
| created_at | datetime | Yes | ISO 8601 timestamp |
| updated_at | datetime | Yes | ISO 8601 timestamp |
| last_request_at | datetime | No | Last webhook call |
| total_requests | number | Yes | Request counter |

**Access Pattern:**
```typescript
// Load on startup
const endpoints = new Map<string, EnterpriseEndpoint>();
const fileData = JSON.parse(fs.readFileSync('enterprise_endpoints.json', 'utf8'));
Object.values(fileData).forEach(ep => endpoints.set(ep.id, ep));

// Fast reads
const endpoint = endpoints.get(endpointId);

// Writes persist to both memory + file
endpoints.set(id, updatedEndpoint);
fs.writeFileSync('enterprise_endpoints.json', JSON.stringify(Object.fromEntries(endpoints), null, 2));
```

**Why JSON instead of MySQL?**
1. Fast in-memory access (no DB query per webhook request)
2. Simple atomic writes for CRUD operations
3. Easy backup/restore (single file)
4. Schema flexibility during early development
5. Plan to migrate to MySQL later with Redis cache layer

---

## 4. Relationships Diagram

```
users (id)
  ├─→ assistants (userId)
  ├─→ widget_clients (user_id)
  ├─→ teams (ownerId)
  └─→ user_roles (user_id) → roles (id)

teams (id)
  ├─→ credit_balances (teamId) [1:1]
  ├─→ team_members (teamId) [1:many]
  └─→ agents_config (teamId) [1:many]

credit_balances (id)
  └─→ credit_transactions (creditBalanceId) [1:many]
       └─→ teamId resolved via credit_balances.teamId

credit_packages (id)
  └─→ credit_transactions.metadata.package_id [reference only]

device_activations (deviceId)
  └─→ client_agents (deviceId) [1:many]

cases (id)
  ├─→ case_comments (case_id) [1:many]
  └─→ case_activity (case_id) [1:many]

enterprise_endpoints [JSON file]
  No FK relationships
```

---

## 5. Indexes & Performance

### Query Patterns

**Client Manager — Overview Load:**
```sql
-- All clients with asset counts (N+1 avoided with subqueries)
SELECT u.id, u.email, u.name, u.account_status,
       (SELECT COUNT(*) FROM assistants WHERE userId = u.id) AS assistant_count,
       (SELECT COUNT(*) FROM widget_clients WHERE user_id = u.id) AS widget_count
FROM users u
WHERE u.id NOT IN (SELECT user_id FROM user_roles WHERE role_id IN (...admin roles...))
ORDER BY u.createdAt DESC;

-- Covered by: idx_created, idx_email
```

**Credit Balance Check (Hot Path):**
```sql
SELECT balance FROM credit_balances WHERE teamId = ? LIMIT 1;
-- Covered by: UNIQUE idx_teamId (extremely fast)
```

**Transaction History:**
```sql
SELECT ct.*, cb.teamId, t.name as teamName
FROM credit_transactions ct
JOIN credit_balances cb ON ct.creditBalanceId = cb.id
JOIN teams t ON cb.teamId = t.id
ORDER BY ct.createdAt DESC 
LIMIT 50 OFFSET 0;
-- Covered by: idx_balance_created (composite index for sorting)
```

**Assistant Status Check:**
```sql
SELECT status FROM assistants WHERE id = ? LIMIT 1;
-- Covered by: PRIMARY KEY (instant lookup)
```

### Missing Indexes (Potential Optimizations)

1. `widget_clients.subscription_tier` — Frequent tier-based queries
2. `credit_transactions.type, createdAt` — Composite for analytics
3. `assistants.tier, status` — Composite for admin filters

---

## 6. Data Integrity Rules

### Constraints

1. **Unique Constraints:**
   - `users.email` — One account per email
   - `credit_balances.teamId` — One balance per team

2. **Foreign Key Constraints:**
   - `assistants.userId → users.id` ON DELETE SET NULL
   - `widget_clients.user_id → users.id` ON DELETE SET NULL
   - `credit_balances.teamId → teams.id` ON DELETE CASCADE
   - `credit_transactions.creditBalanceId → credit_balances.id` ON DELETE CASCADE

3. **NOT NULL Constraints:**
   - All status fields (enforceable kill switches)
   - All price/balance fields (no NULL math)
   - All timestamp fields (audit trail)

### Soft Deletes

- `credit_packages.isActive` — Soft delete flag
- Assistants/widgets: No soft delete, rely on status enum
- Users: No delete (compliance/audit), use `account_status='suspended'`

---

## 7. Migration Scripts

### Initial Setup

```sql
-- Run on fresh database
SOURCE /var/opt/backend/migrations/001_create_users.sql;
SOURCE /var/opt/backend/migrations/002_create_assistants.sql;
SOURCE /var/opt/backend/migrations/003_create_widgets.sql;
SOURCE /var/opt/backend/migrations/004_create_credits.sql;
```

### Add Kill Switch Columns

```sql
-- Add account_status to users (if missing)
ALTER TABLE users 
  ADD COLUMN account_status ENUM('active', 'suspended', 'demo_expired') 
  DEFAULT 'active' NOT NULL;

-- Add status to assistants (if missing)
ALTER TABLE assistants 
  ADD COLUMN status ENUM('active', 'suspended', 'demo_expired') 
  DEFAULT 'active' NOT NULL;

-- Add status to widget_clients (if missing)
ALTER TABLE widget_clients 
  ADD COLUMN status ENUM('active', 'suspended', 'demo_expired', 'upgraded') 
  DEFAULT 'active' NOT NULL;
```

---

## 8. New System Tables

### 8.1 `sys_settings` — System Configuration

**Purpose:** Key-value store for platform-wide configuration. Supports typed values and a public subset exposed without authentication.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Setting ID |
| setting_key | VARCHAR(100) | UNIQUE, NOT NULL | - | Unique key name |
| setting_value | TEXT | NULLABLE | NULL | Value (stored as string) |
| setting_type | ENUM | NOT NULL | 'string' | `string`, `integer`, `float`, `boolean`, `json` |
| is_public | TINYINT(1) | NOT NULL | 0 | 1 = exposed via GET /settings/public |
| description | TEXT | NULLABLE | NULL | Admin notes |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Created |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last updated |

**Notes:** `setting_type` controls how `GET /settings/public` casts the value (e.g., `integer` → number, `boolean` → true/false, `json` → parsed object).

---

### 8.2 `roles` — System Roles

**Purpose:** Named roles used to group permissions and categorise users (admin, staff, custom roles).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Role ID |
| name | VARCHAR(100) | NOT NULL | - | Display name |
| slug | VARCHAR(100) | UNIQUE, NOT NULL | - | Machine-readable key |
| description | TEXT | NULLABLE | NULL | Role description |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Created |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Updated |

**Built-in slugs:** `admin`, `super_admin`, `staff` (these control `is_admin` and `is_staff` flags at the application layer)

---

### 8.3 `permissions` — System Permissions

**Purpose:** Fine-grained capabilities assigned to roles.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Permission ID |
| name | VARCHAR(150) | NOT NULL | - | Display name |
| slug | VARCHAR(150) | UNIQUE, NOT NULL | - | Dot-notation key e.g. `cases.manage` |
| description | TEXT | NULLABLE | NULL | Purpose of the permission |
| permission_group | VARCHAR(100) | NULLABLE | NULL | UI grouping label |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Created |

---

### 8.4 `role_permissions` — Role–Permission Junction

**Purpose:** Many-to-many link between roles and permissions.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Row ID |
| role_id | INT | FK → roles.id | - | Role reference |
| permission_id | INT | FK → permissions.id | - | Permission reference |

**Indexes:**
```sql
UNIQUE KEY uq_role_perm (role_id, permission_id)
INDEX idx_role_id (role_id)
INDEX idx_permission_id (permission_id)
```

---

### 8.5 `user_roles` — User–Role Junction

**Purpose:** Assigns one or more roles to users.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Row ID |
| user_id | VARCHAR(36) | FK → users.id | - | User UUID |
| role_id | INT | FK → roles.id | - | Role ID |

**Indexes:**
```sql
UNIQUE KEY uq_user_role (user_id, role_id)
```

---

### 8.6 `user_two_factor` — Two-Factor Authentication State

**Purpose:** Stores per-user 2FA configuration, secrets, OTP state, and backup codes.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Row ID |
| user_id | VARCHAR(36) | UNIQUE, FK → users.id | - | User UUID |
| is_enabled | TINYINT(1) | NOT NULL | 0 | Whether 2FA is active |
| preferred_method | ENUM | NULLABLE | NULL | `totp`, `email`, `sms` |
| totp_secret | VARCHAR(255) | NULLABLE | NULL | Base32 TOTP secret (encrypted) |
| backup_codes | JSON | NULLABLE | NULL | Array of SHA-256 hashed backup codes |
| otp_code | VARCHAR(10) | NULLABLE | NULL | Transient email/SMS OTP |
| otp_expires_at | DATETIME | NULLABLE | NULL | OTP expiry (5 minutes) |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Record created |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Last updated |

**Notes:** `otp_code` and `otp_expires_at` are ephemeral — cleared immediately after successful verification.

---

### 8.7 `credentials` — Encrypted Credential Vault

**Purpose:** Stores all external API keys, SMTP passwords, SMS tokens, and payment gateway credentials with AES-256-GCM encryption.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Credential ID |
| service_name | VARCHAR(100) | NOT NULL | - | Service key (e.g. `SMTP`, `SMS`, `OPENROUTER`) |
| name | VARCHAR(200) | NOT NULL | - | Human-readable label |
| credential_type | ENUM | NOT NULL | 'api_key' | `api_key`, `password`, `oauth`, `certificate`, `token`, `other` |
| credential_value | TEXT | NULLABLE | NULL | AES-256-GCM encrypted value (`iv:authTag:ciphertext`) |
| additional_data | JSON | NULLABLE | NULL | Extra config (e.g. SMTP host, port, from_email) |
| environment | VARCHAR(50) | NULLABLE | 'production' | `production`, `staging`, `development` |
| description | TEXT | NULLABLE | NULL | Admin notes |
| is_active | TINYINT(1) | NOT NULL | 1 | Soft deactivation flag |
| version | INT | NOT NULL | 1 | Incremented on rotate |
| expires_at | DATETIME | NULLABLE | NULL | Optional expiry date |
| last_used_at | DATETIME | NULLABLE | NULL | Updated on GET /:id |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Created |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Updated |

**Encryption format:** `base64(iv):base64(authTag):base64(ciphertext)` (Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)`)

**Indexes:**
```sql
INDEX idx_service (service_name)
INDEX idx_type (credential_type)
INDEX idx_active (is_active)
INDEX idx_expires (expires_at)
```

---

### 8.8 `email_log` — Email Send Audit Trail

**Purpose:** Records every outbound email for debugging and auditing.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Log entry ID |
| to_address | VARCHAR(500) | NOT NULL | - | Recipient email address(es) |
| subject | VARCHAR(500) | NOT NULL | - | Email subject line |
| status | ENUM | NOT NULL | 'sent' | `sent`, `failed` |
| message_id | VARCHAR(255) | NULLABLE | NULL | SMTP message-id header |
| error | TEXT | NULLABLE | NULL | Error detail on failure |
| sent_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Timestamp |

---

### 8.9 `sms_log` — SMS Send Audit Trail

**Purpose:** Records every outbound SMS for debugging and billing reconciliation.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Log entry ID |
| to_number | VARCHAR(30) | NOT NULL | - | Normalised E.164 number |
| message | TEXT | NOT NULL | - | Message body |
| status | VARCHAR(50) | NOT NULL | - | `sent`, `failed`, `queued` |
| message_id | VARCHAR(255) | NULLABLE | NULL | SMSPortal message ID |
| cost | DECIMAL(10,4) | NULLABLE | NULL | Cost per message |
| error | TEXT | NULLABLE | NULL | Error detail on failure |
| sent_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Timestamp |

---

### 8.10 `staff_software_tokens` — Staff Update Portal Tokens

**Purpose:** Stores per-staff API tokens used by the mobile AI task proxy to call the external software update portal (`updates.softaware.co.za`).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INT | PK, AUTO_INCREMENT | - | Token ID |
| user_id | VARCHAR(36) | FK → users.id | - | Staff user UUID |
| software_key | VARCHAR(100) | NOT NULL | - | Portal software key |
| api_token | TEXT | NOT NULL | - | Auth token for external API |
| api_url | VARCHAR(500) | NULLABLE | NULL | Custom API base URL |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Created |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Updated |

**Indexes:**
```sql
INDEX idx_user_id (user_id)
UNIQUE KEY uq_user_software (user_id, software_key)
```

---

## 9. Backup & Recovery

### Daily Backup

```bash
#!/bin/bash
# Backup MySQL + JSON files
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u softaware -p softaware > /var/backups/mysql_$DATE.sql
cp /var/opt/backend/data/enterprise_endpoints.json /var/backups/endpoints_$DATE.json
```

### Point-in-Time Recovery

```bash
# Restore from specific backup
mysql -u softaware -p softaware < /var/backups/mysql_20260304_120000.sql
cp /var/backups/endpoints_20260304_120000.json /var/opt/backend/data/enterprise_endpoints.json
pm2 restart backend  # Reload endpoints from file
```

---

## 10. Data Cleanup Jobs

### Monthly Cron Jobs

```cron
# Reset widget message counts (1st of month)
0 0 1 * * cd /var/opt/backend && node scripts/reset-widget-counts.js

# Archive old transactions (keep 12 months)
0 2 1 * * cd /var/opt/backend && node scripts/archive-transactions.js

# Clean up demo_expired accounts (>30 days inactive)
0 3 1 * * cd /var/opt/backend && node scripts/cleanup-expired-demos.js
```

---

## 11. SQLite Tables (Audit Log)

### 11.1 `admin_audit_log` — Admin Action Audit Trail

**Storage:** `/var/opt/backend/data/audit_log.db` (SQLite, WAL mode)  
**Purpose:** Tracks every admin-panel action without loading the MySQL database.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | - | Auto-incrementing ID |
| user_id | TEXT | NOT NULL | - | Admin user ID |
| user_email | TEXT | | '' | Cached user email |
| user_name | TEXT | | '' | Cached display name |
| action | TEXT | NOT NULL | - | HTTP method (GET/POST/PUT/PATCH/DELETE) |
| resource | TEXT | NOT NULL | - | Full route path |
| resource_type | TEXT | | '' | Derived category (clients, credits, settings...) |
| description | TEXT | | '' | Human-readable description |
| request_body | TEXT | | '{}' | JSON request body (sensitive fields redacted) |
| response_status | INTEGER | | 0 | HTTP status code |
| ip_address | TEXT | | '' | Client IP address |
| user_agent | TEXT | | '' | Client user agent |
| duration_ms | INTEGER | | 0 | Response time in ms |
| created_at | DATETIME | | CURRENT_TIMESTAMP | When the action occurred |

**Indexes:**
```sql
CREATE INDEX idx_audit_user ON admin_audit_log (user_id, created_at);
CREATE INDEX idx_audit_created ON admin_audit_log (created_at);
CREATE INDEX idx_audit_resource ON admin_audit_log (resource_type, created_at);
CREATE INDEX idx_audit_action ON admin_audit_log (action, created_at);
```

**Trimming:** Entries can be trimmed by age (days) or purged entirely from the UI.

---

## 12. Related Documentation

- [README.md](./README.md) — Module overview
- [ROUTES.md](./ROUTES.md) — API endpoints
- [PATTERNS.md](./PATTERNS.md) — Code patterns
