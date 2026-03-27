# Pro Package & Enterprise Ecosystem — Data Schema

**Version:** 1.1.0  
**Last Updated:** 2026-03-28

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 4 (packages, contact\_packages, package\_transactions, user\_contact\_link) |
| **SQLite tables** | 4 (enterprise\_endpoints, client\_api\_configs, endpoint\_requests, client\_api\_logs) |
| **Migration files** | 3 (023, 031, 032) |
| **TypeScript interfaces** | 12+ (PackageCatalogRow, ResolvedUserPackage, TierLimits, ClientApiConfig, EnterpriseEndpoint, UsageSummary, etc.) |
| **Trial-related columns** | 6 (3 on users, 3 on contact\_packages) |

**Important:** The package system uses a **cross-database architecture**. Package definitions and assignments live in MySQL. Enterprise endpoints and API gateway configs live in SQLite. They are linked via `contact_id` — a MySQL contacts FK stored in the SQLite rows.

---

## 2. MySQL Tables

### 2.1 `packages` — Package Catalog

**Migration:** `023_packages_system.ts` + `032_package_limits_catalog.ts`

#### Identity & Pricing

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | — | AUTO\_INCREMENT | Primary key |
| slug | VARCHAR(50) | — | — | Machine-readable identifier (UNIQUE). Values: `free`, `starter`, `pro`, `advanced`, `enterprise`, `staff` |
| name | VARCHAR(100) | — | — | Display name |
| description | VARCHAR(500) | ✅ | NULL | Marketing description |
| package\_type | ENUM | — | — | `CONSUMER` \| `ENTERPRISE` \| `STAFF` \| `ADDON` |
| price\_monthly | INT | — | 0 | Monthly price in cents (ZAR) |
| price\_annually | INT | ✅ | NULL | Annual price in cents (ZAR) |
| currency\_code | VARCHAR(3) | — | `'ZAR'` | ISO currency code |
| credits\_included | INT | — | 0 | Monthly AI credits included |
| gateway\_plan\_id | VARCHAR(100) | ✅ | NULL | External payment gateway plan ID (Yoco/PayFast) |

#### Resource Limits (added by migration 032)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| max\_users | INT | ✅ | NULL | Max team members. Free=1, Pro=5, Enterprise=999 |
| max\_agents | INT | ✅ | NULL | Max AI assistants |
| max\_widgets | INT | ✅ | NULL | Max chat widgets. Free=1, Pro=10 |
| max\_landing\_pages | INT | ✅ | NULL | Max landing pages (legacy, aliased to max\_sites) |
| max\_sites | INT | ✅ | NULL | Max generated sites. Free=1, Pro=10 |
| max\_collections\_per\_site | INT | ✅ | NULL | Max data collections per site. Free=1, Pro=15 |
| max\_storage\_bytes | BIGINT | ✅ | NULL | Storage quota. Free=5MB, Pro=200MB |
| max\_actions\_per\_month | INT | ✅ | NULL | Monthly AI action cap. Free=500, Pro=5000 |
| max\_knowledge\_pages | INT | ✅ | NULL | Knowledge base page limit. Free=50, Pro=500 |
| max\_enterprise\_endpoints | INT | ✅ | NULL | Enterprise endpoint quota. Free=0, Pro=2, Enterprise=999 |
| allow\_auto\_recharge | TINYINT(1) | — | 0 | Whether overage auto-recharge is permitted |
| allowed\_site\_type | VARCHAR(32) | — | `'single_page'` | Max allowed site type: `single_page` \| `classic_cms` \| `ecommerce` \| `web_application` \| `headless` |
| can\_remove\_watermark | TINYINT(1) | — | 0 | Whether "Powered by Soft Aware" can be hidden |
| allowed\_system\_actions | JSON | ✅ | NULL | Array of permitted system actions, e.g. `["email_capture", "payment_gateway_hook"]` |
| has\_custom\_knowledge\_categories | TINYINT(1) | — | 0 | Whether custom knowledge categories are available |
| has\_omni\_channel\_endpoints | TINYINT(1) | — | 0 | Whether omni-channel endpoint features are enabled |
| has\_vision | TINYINT(1) | — | 0 | Whether vision/file processing is available. `false` for Free/Starter/Pro, `true` for Advanced/Enterprise |
| ingestion\_priority | INT | — | 1 | Knowledge ingestion queue priority (1=lowest, 5=highest) |

#### Presentation

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| features | JSON | ✅ | NULL | Array of marketing feature strings for the pricing page |
| is\_active | TINYINT(1) | — | 1 | Whether package is available for assignment |
| is\_public | TINYINT(1) | — | 1 | Whether package appears on the public pricing page |
| display\_order | INT | — | 0 | Sort order on pricing page |
| featured | TINYINT(1) | — | 0 | Whether package has a "featured" highlight |
| cta\_text | VARCHAR(50) | — | `'Get Started'` | Call-to-action button text |
| created\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | Record creation |
| updated\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | Last modification |

**Indexes:** UNIQUE on `slug`, INDEX on `package_type`, INDEX on `currency_code`, INDEX on `is_active`

---

### 2.2 `contact_packages` — Package Assignments

**Migration:** `023_packages_system.ts`

Links a contact (company) to a package. One active assignment per contact at a time.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | — | AUTO\_INCREMENT | Primary key |
| contact\_id | INT | — | — | FK → contacts.id |
| package\_id | INT | — | — | FK → packages.id |
| status | ENUM | — | `'ACTIVE'` | `TRIAL` \| `ACTIVE` \| `PAST_DUE` \| `CANCELLED` \| `EXPIRED` \| `SUSPENDED` |
| billing\_cycle | ENUM | — | `'MONTHLY'` | `MONTHLY` \| `ANNUALLY` \| `NONE` |
| credits\_balance | INT | — | 0 | Current AI credit balance |
| credits\_used | INT | — | 0 | Total AI credits consumed this period |
| trial\_ends\_at | DATETIME | ✅ | NULL | When the trial expires (used by trialEnforcer) |
| current\_period\_start | DATETIME | ✅ | NULL | Start of current billing period |
| current\_period\_end | DATETIME | ✅ | NULL | End of current billing period (also used for trial expiry) |
| cancelled\_at | DATETIME | ✅ | NULL | When the package was cancelled |
| payment\_provider | ENUM | ✅ | `'MANUAL'` | `PAYFAST` \| `YOCO` \| `MANUAL` \| `STRIPE` |
| currency\_code | VARCHAR(3) | — | `'ZAR'` | Currency for this assignment |
| external\_customer\_id | VARCHAR(255) | ✅ | NULL | Payment gateway customer reference |
| external\_subscription\_id | VARCHAR(255) | ✅ | NULL | Payment gateway subscription reference |
| low\_balance\_threshold | INT | — | 5000 | Credit threshold that triggers a low-balance alert |
| low\_balance\_alert\_sent | TINYINT(1) | — | 0 | Whether the low-balance alert has been sent |
| created\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | Record creation |
| updated\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | Last modification |

**Indexes:** INDEX on `contact_id`, INDEX on `package_id`, INDEX on `status`

**Status Lifecycle:**
```
TRIAL → ACTIVE (payment received)
TRIAL → EXPIRED (trialEnforcer sweep: current_period_end < NOW())
ACTIVE → PAST_DUE (payment failed)
ACTIVE → CANCELLED (user cancelled)
ACTIVE → SUSPENDED (admin action)
```

---

### 2.3 `package_transactions` — Credit History

**Migration:** `023_packages_system.ts`

Records every credit debit/credit event for audit and billing.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | — | AUTO\_INCREMENT | Primary key |
| contact\_package\_id | INT | — | — | FK → contact\_packages.id |
| user\_id | VARCHAR(36) | ✅ | NULL | User who triggered the transaction |
| request\_id | VARCHAR(36) | ✅ | NULL | Associated API request ID |
| type | VARCHAR(30) | — | — | `PURCHASE` \| `USAGE` \| `BONUS` \| `REFUND` \| `ADMIN_ADJUSTMENT` \| `AUTO_RECHARGE` |
| amount | INT | — | — | Positive = credit, negative = debit |
| request\_type | VARCHAR(100) | ✅ | NULL | Type of API request that consumed credits |
| request\_metadata | JSON | ✅ | NULL | Additional context (model, tokens, etc.) |
| balance\_after | INT | — | — | Running balance after this transaction |
| created\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | Transaction time |

---

### 2.4 `user_contact_link` — User-Contact Role Mapping

**Migration:** `023_packages_system.ts`

Maps users to contacts with roles. A contact's package limits are inherited by all linked users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | — | AUTO\_INCREMENT | Primary key |
| user\_id | VARCHAR(36) | — | — | FK → users.id |
| contact\_id | INT | — | — | FK → contacts.id |
| role | VARCHAR(20) | — | `'MEMBER'` | `OWNER` \| `ADMIN` \| `MEMBER` \| `STAFF` |
| created\_at | TIMESTAMP | — | CURRENT\_TIMESTAMP | When the link was created |

**Resolution priority:** When a user has multiple contact links, the system picks by role order: OWNER > ADMIN > MEMBER > STAFF.

---

### 2.5 `users` — Trial Columns (added by migration 031)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| plan\_type | VARCHAR(20) | ✅ | `'free'` | Current tier: `free`, `starter`, `pro`, `advanced`, `enterprise` |
| has\_used\_trial | TINYINT(1) | ✅ | 0 | Whether user has ever used a trial. **Permanent once TRUE** — prevents re-trials. |
| trial\_expires\_at | DATETIME | ✅ | NULL | When the user-level trial expires. Cleared by trialEnforcer on expiry. |

**Index:** `idx_users_trial_expiry` on `(trial_expires_at)`

---

## 3. SQLite Tables

**Database file:** `/var/opt/backend/data/enterprise_endpoints.db`

### 3.1 `enterprise_endpoints` — Webhook Endpoints

Created in `src/services/enterpriseEndpoints.ts`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | — | AUTOINCREMENT | Primary key |
| client\_id | TEXT | — | — | Unique client identifier (e.g. `silulumanzi`). UNIQUE. |
| contact\_id | INTEGER | ✅ | NULL | FK → MySQL contacts.id (cross-DB link) |
| status | TEXT | — | `'active'` | `active` \| `paused` \| `disabled` |
| inbound\_provider | TEXT | — | `'openai'` | LLM provider for inbound processing |
| auth\_type | TEXT | — | `'rolling_token'` | Auth method: `rolling_token` \| `bearer` \| `api_key` \| `none` |
| auth\_secret | TEXT | ✅ | NULL | Shared secret for rolling token generation |
| llm\_provider | TEXT | — | `'openai'` | LLM provider for AI responses |
| llm\_model | TEXT | — | `'gpt-4o-mini'` | Model identifier |
| llm\_system\_prompt | TEXT | ✅ | NULL | System prompt for the AI |
| llm\_tools\_config | TEXT | ✅ | NULL | JSON array of OpenAI function-calling tool definitions |
| llm\_temperature | REAL | — | 0.7 | LLM temperature |
| llm\_max\_tokens | INTEGER | — | 1024 | Max response tokens |
| target\_api\_url | TEXT | ✅ | NULL | Outbound target API base URL |
| target\_api\_auth\_type | TEXT | — | `'rolling_token'` | Outbound auth type |
| target\_api\_auth\_secret | TEXT | ✅ | NULL | Outbound auth secret |
| target\_api\_auth\_header | TEXT | — | `'Authorization'` | Outbound auth header name |
| allowed\_ips | TEXT | ✅ | NULL | Comma-separated IP whitelist |
| rate\_limit\_rpm | INTEGER | — | 60 | Requests per minute |
| timeout\_ms | INTEGER | — | 30000 | Request timeout |
| description | TEXT | ✅ | NULL | Human-readable description |
| created\_at | TEXT | — | datetime('now') | Creation time |
| updated\_at | TEXT | — | datetime('now') | Last modification |

---

### 3.2 `endpoint_requests` — Endpoint Request Logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | — | AUTOINCREMENT | Primary key |
| endpoint\_id | INTEGER | — | — | FK → enterprise\_endpoints.id |
| timestamp | TEXT | — | datetime('now') | When the request occurred |
| inbound\_payload | TEXT | ✅ | NULL | Incoming request body (JSON) |
| ai\_response | TEXT | ✅ | NULL | LLM response body (JSON) |
| duration\_ms | INTEGER | ✅ | NULL | Request processing time |
| status | TEXT | — | `'success'` | `success` \| `error` |
| error\_message | TEXT | ✅ | NULL | Error details if failed |

---

### 3.3 `client_api_configs` — API Gateway Configs

Created in `src/services/clientApiGateway.ts`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INTEGER | — | AUTOINCREMENT | Primary key |
| client\_id | TEXT | — | — | Client identifier (UNIQUE) |
| client\_name | TEXT | — | — | Display name for the client |
| endpoint\_id | INTEGER | ✅ | NULL | FK → enterprise\_endpoints.id (linked endpoint) |
| contact\_id | INTEGER | ✅ | NULL | FK → MySQL contacts.id (cross-DB link) |
| target\_base\_url | TEXT | — | — | Client's API base URL |
| auth\_type | TEXT | — | `'rolling_token'` | `rolling_token` \| `bearer` \| `basic` \| `api_key` \| `none` |
| auth\_secret | TEXT | ✅ | NULL | Auth credential/secret |
| auth\_header | TEXT | — | `'X-AI-Auth-Token'` | Header name for auth |
| allowed\_actions | TEXT | ✅ | NULL | JSON array of allowed API actions (security whitelist) |
| rate\_limit\_rpm | INTEGER | — | 60 | Requests per minute cap |
| timeout\_ms | INTEGER | — | 30000 | Request timeout in ms |
| status | TEXT | — | `'active'` | `active` \| `paused` \| `disabled` |
| created\_at | TEXT | — | datetime('now') | Creation time |
| updated\_at | TEXT | — | datetime('now') | Last modification |
| total\_requests | INTEGER | — | 0 | Cumulative request counter |
| last\_request\_at | TEXT | ✅ | NULL | Timestamp of the most recent request |

---

### 3.4 `client_api_logs` — Gateway Request Logs

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | TEXT | — | — | Primary key (generated UUID) |
| config\_id | TEXT | — | — | FK → client\_api\_configs.id |
| client\_id | TEXT | — | — | Client identifier |
| action | TEXT | — | — | API action invoked |
| status\_code | INTEGER | ✅ | NULL | HTTP status code |
| duration\_ms | INTEGER | ✅ | NULL | Request processing time |
| error\_message | TEXT | ✅ | NULL | Error details if failed |
| created\_at | TEXT | — | datetime('now') | Log time |

---

## 4. Cross-Database Relationships

```
MySQL                                    SQLite
─────                                    ──────
contacts (id=68)
  │
  ├── contact_packages ──→ packages
  │     status=ACTIVE         slug=enterprise
  │     package_id=10
  │
  ├─────────────────────→ enterprise_endpoints
  │   contact_id=68          client_id='silulumanzi'
  │                          contact_id=68
  │
  └─────────────────────→ client_api_configs
      contact_id=68          client_id='silulumanzi'
                             contact_id=68
                             endpoint_id=1 (FK within SQLite)
```

**Resolution path for enforcement:**
1. Request arrives with `contact_id` (from body or resolved via user → contact)
2. MySQL query: `contacts → contact_packages → packages WHERE contact_id = ? AND status IN ('ACTIVE','TRIAL')`
3. SQLite count: `SELECT COUNT(*) FROM enterprise_endpoints WHERE contact_id = ?`
4. Compare: `count >= package.max_enterprise_endpoints` → 403 or next()

---

## 5. Key Data Values

### Current Package Limits (as of 2026-03-22)

| slug | max\_users | max\_sites | max\_widgets | max\_actions | max\_pages | max\_endpoints | max\_storage | site\_type | hasVision |
|------|-----------|-----------|-------------|-------------|-----------|---------------|-------------|-----------|----------|
| free | 1 | 1 | 1 | 500 | 50 | 0 | 5 MB | single\_page | false |
| starter | 3 | 5 | 3 | 2,000 | 200 | 0 | 50 MB | single\_page | false |
| pro | 5 | 10 | 10 | 5,000 | 500 | 2 | 200 MB | ecommerce | false |
| advanced | 10 | 25 | 25 | 20,000 | 2,000 | 5 | 1 GB | web\_app | true |
| enterprise | 999 | 999 | 999 | 999,999 | 99,999 | 999 | 5 GB | headless | true |
| staff | 999 | 999 | 999 | 999,999 | 99,999 | 999 | 5 GB | headless | true |
