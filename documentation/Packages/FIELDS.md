# Packages — Field & Data Dictionary

## Database Schema: `packages` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Primary key |
| `slug` | `VARCHAR(50)` | No | — | URL-friendly unique identifier (e.g., `free`, `starter`, `byoe`) |
| `name` | `VARCHAR(100)` | No | — | Display name |
| `description` | `VARCHAR(500)` | Yes | `NULL` | Short description for landing page / admin |
| `package_type` | `ENUM('CONSUMER','ENTERPRISE','STAFF','ADDON')` | No | — | Package category |
| `price_monthly` | `INT` | No | `0` | Monthly price in ZAR cents (19900 = R199.00) |
| `price_annually` | `INT` | Yes | `NULL` | Annual price in ZAR cents (NULL = not offered) |
| `credits_included` | `INT` | No | `0` | Monthly credit allocation |
| `max_users` | `INT` | Yes | `NULL` | User limit (NULL = unlimited) |
| `max_agents` | `INT` | Yes | `NULL` | AI assistant limit |
| `max_widgets` | `INT` | Yes | `NULL` | Widget limit |
| `max_landing_pages` | `INT` | Yes | `NULL` | Landing page limit |
| `max_enterprise_endpoints` | `INT` | Yes | `NULL` | Enterprise endpoint limit |
| `features` | `JSON` | Yes | `NULL` | Array of feature strings for display |
| `is_active` | `TINYINT(1)` | No | `1` | Whether the package is active |
| `is_public` | `TINYINT(1)` | No | `1` | Whether visible on landing page pricing |
| `display_order` | `INT` | No | `0` | Sort order for display |
| `featured` | `TINYINT(1)` | No | `0` | Highlighted as "most popular" |
| `cta_text` | `VARCHAR(50)` | No | `'Get Started'` | Call-to-action button text |
| `created_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP ON UPDATE` | Last modification |

**Indexes**: `idx_packages_type(package_type)`, `idx_packages_active_order(is_active, display_order)`
**Unique**: `slug`

### Seed Data (5 canonical tiers per `config/tiers.ts` + Staff)

| ID | Slug | Name | Type | Monthly | Credits | Featured |
|----|------|------|------|---------|---------|----------|
| 1 | `free` | Free | CONSUMER | R0 | 500 | No |
| 2 | `starter` | Starter | CONSUMER | R349 | 5,000 | Yes |
| 3 | `pro` | Pro | CONSUMER | R699 | 25,000 | No |
| 4 | `advanced` | Advanced | CONSUMER | R1,499 | 50,000 | No |
| 5 | `enterprise` | Enterprise | ENTERPRISE | Custom | Contact | No |
| 6 | `staff` | Staff | STAFF | R0 | 100,000 | No |

---

## Database Schema: `contact_packages` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Primary key |
| `contact_id` | `INT` (FK→contacts) | No | — | Which contact owns this subscription |
| `package_id` | `INT` (FK→packages) | No | — | Which package they subscribe to |
| `status` | `ENUM('TRIAL','ACTIVE','PAST_DUE','CANCELLED','EXPIRED','SUSPENDED')` | No | `'ACTIVE'` | Subscription status |
| `billing_cycle` | `ENUM('MONTHLY','ANNUALLY','NONE')` | No | `'MONTHLY'` | Billing frequency |
| `credits_balance` | `INT` | No | `0` | Current available credits |
| `credits_used` | `INT` | No | `0` | Cumulative credits consumed |
| `trial_ends_at` | `DATETIME` | Yes | `NULL` | Trial expiration date |
| `current_period_start` | `DATETIME` | Yes | `NULL` | Current billing period start |
| `current_period_end` | `DATETIME` | Yes | `NULL` | Current billing period end |
| `cancelled_at` | `DATETIME` | Yes | `NULL` | Cancellation timestamp (set when status → CANCELLED) |
| `payment_provider` | `ENUM('PAYFAST','YOCO','MANUAL')` | Yes | `'MANUAL'` | Payment gateway used |
| `external_customer_id` | `VARCHAR(255)` | Yes | `NULL` | Gateway customer reference |
| `external_subscription_id` | `VARCHAR(255)` | Yes | `NULL` | Gateway subscription reference |
| `low_balance_threshold` | `INT` | No | `5000` | Credits threshold for low-balance alert |
| `low_balance_alert_sent` | `TINYINT(1)` | No | `0` | Whether alert has been sent (reset on credit add) |
| `created_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP ON UPDATE` | Last modification |

**Foreign Keys**: `contact_id → contacts(id) ON DELETE CASCADE`, `package_id → packages(id) ON DELETE RESTRICT`
**Unique**: `(contact_id, package_id)` — one subscription per contact per package
**Indexes**: `idx_cp_contact(contact_id)`, `idx_cp_status(status)`

---

## Database Schema: `package_transactions` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Primary key |
| `contact_package_id` | `INT` (FK→contact_packages) | No | — | Which subscription this transaction belongs to |
| `contact_id` | `INT` (FK→contacts) | No | — | Contact who owns the subscription |
| `user_id` | `VARCHAR(36)` | Yes | `NULL` | User who triggered the transaction (NULL for system ops) |
| `type` | `ENUM('PURCHASE','USAGE','BONUS','REFUND','ADJUSTMENT','MONTHLY_ALLOCATION','EXPIRY')` | No | — | Transaction type |
| `amount` | `INT` | No | — | Credit amount (positive = add, negative = deduct) |
| `request_type` | `VARCHAR(50)` | Yes | `NULL` | AI request type (TEXT_CHAT, CODE_AGENT_EXECUTE, etc.) |
| `request_metadata` | `JSON` | Yes | `NULL` | Additional context (path, method, token counts, etc.) |
| `description` | `VARCHAR(500)` | Yes | `NULL` | Human-readable description |
| `balance_after` | `INT` | No | — | Credit balance after this transaction |
| `created_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP` | Transaction timestamp |

**Foreign Keys**: `contact_package_id → contact_packages(id) ON DELETE CASCADE`, `contact_id → contacts(id) ON DELETE CASCADE`
**Indexes**: `idx_pt_contact(contact_id)`, `idx_pt_contact_package(contact_package_id)`, `idx_pt_type(type)`, `idx_pt_created(created_at)`

### Transaction Types

| Type | Amount Sign | Trigger | Description |
|------|-------------|---------|-------------|
| `PURCHASE` | Positive | Payment webhook | Credits purchased via PayFast/Yoco |
| `USAGE` | Negative | AI request | Credits consumed by API calls |
| `BONUS` | Positive | Admin action | Promotional or goodwill credits |
| `REFUND` | Positive | Admin action | Refunded credits from disputed transactions |
| `ADJUSTMENT` | +/- | Admin action | Manual balance correction with reason |
| `MONTHLY_ALLOCATION` | Positive | System/migration | Monthly credit top-up from package |
| `EXPIRY` | Negative | System (planned) | Expired unused credits at period end |

---

## Database Schema: `user_contact_link` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Primary key |
| `user_id` | `VARCHAR(36)` | No | — | User UUID |
| `contact_id` | `INT` (FK→contacts) | No | — | Contact (company) ID |
| `role` | `ENUM('OWNER','ADMIN','MEMBER','STAFF')` | No | `'MEMBER'` | User's role within the company |
| `created_at` | `TIMESTAMP` | No | `CURRENT_TIMESTAMP` | Link creation timestamp |

**Unique**: `(user_id, contact_id)` — one link per user per contact
**Indexes**: `idx_ucl_user(user_id)`, `idx_ucl_contact(contact_id)`

### User-Contact Roles

| Role | Description |
|------|-------------|
| `OWNER` | Company owner — full billing and admin access |
| `ADMIN` | Company admin — can manage assistants, users, settings |
| `MEMBER` | Standard user — can use AI services within package limits |
| `STAFF` | Soft Aware internal staff — linked to Soft Aware (contact ID 1) |

---

## Zod Validation Schemas (adminPackages.ts)

### `createPackageSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `slug` | `string` | Yes | `min(1).max(50)` |
| `name` | `string` | Yes | `min(1).max(100)` |
| `description` | `string` | No | `max(500)` |
| `package_type` | `enum` | Yes | `CONSUMER \| ENTERPRISE \| STAFF \| ADDON` |
| `price_monthly` | `number` | Yes | `min(0)` — ZAR cents |
| `price_annually` | `number` | No | `min(0)` — ZAR cents |
| `credits_included` | `number` | Yes | `min(0)` |
| `max_users` | `number` | No | `min(0)` |
| `max_agents` | `number` | No | `min(0)` |
| `max_widgets` | `number` | No | `min(0)` |
| `max_landing_pages` | `number` | No | `min(0)` |
| `max_enterprise_endpoints` | `number` | No | `min(0)` |
| `features` | `array<string>` | No | — |
| `is_active` | `boolean` | No | Default `true` |
| `is_public` | `boolean` | No | Default `true` |
| `display_order` | `number` | No | `min(0)` |
| `featured` | `boolean` | No | Default `false` |
| `cta_text` | `string` | No | `max(50)` |

### `assignPackageSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `contact_id` | `number` | Yes | `min(1)` |
| `package_id` | `number` | Yes | `min(1)` |
| `billing_cycle` | `enum` | No | `MONTHLY \| ANNUALLY \| NONE` |
| `status` | `enum` | No | `TRIAL \| ACTIVE` |

### `adjustCreditsSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `contact_package_id` | `number` | Yes | `min(1)` |
| `amount` | `number` | Yes | Non-zero integer |
| `reason` | `string` | Yes | `min(1).max(500)` |

### `linkUserSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `user_id` | `string` | Yes | UUID format |
| `contact_id` | `number` | Yes | `min(1)` |
| `role` | `enum` | No | `OWNER \| ADMIN \| MEMBER \| STAFF` (default: MEMBER) |

---

## Frontend TypeScript Types

### `PackageDefinition`
```typescript
interface PackageDefinition {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  package_type: 'CONSUMER' | 'ENTERPRISE' | 'STAFF' | 'ADDON';
  price_monthly: number;
  price_annually: number | null;
  credits_included: number;
  max_users: number | null;
  max_agents: number | null;
  max_widgets: number | null;
  max_landing_pages: number | null;
  max_enterprise_endpoints: number | null;
  features: string | string[] | null;
  is_active: boolean;
  is_public: boolean;
  display_order: number;
  featured: boolean;
  cta_text: string;
  created_at: string;
  updated_at: string;
}
```

### `ContactPackageSubscription`
```typescript
interface ContactPackageSubscription {
  id: number;
  contact_id: number;
  package_id: number;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
  billing_cycle: 'MONTHLY' | 'ANNUALLY' | 'NONE';
  credits_balance: number;
  credits_used: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  payment_provider: 'PAYFAST' | 'YOCO' | 'MANUAL';
  low_balance_threshold: number;
  low_balance_alert_sent: boolean;
  created_at: string;
  updated_at: string;
  contact_name?: string;
  package_name?: string;
  package_slug?: string;
}
```

### `PackageTransaction`
```typescript
interface PackageTransaction {
  id: number;
  contact_package_id: number;
  contact_id: number;
  user_id: string | null;
  type: 'PURCHASE' | 'USAGE' | 'BONUS' | 'REFUND' | 'ADJUSTMENT' | 'MONTHLY_ALLOCATION' | 'EXPIRY';
  amount: number;
  request_type: string | null;
  request_metadata: any;
  description: string | null;
  balance_after: number;
  created_at: string;
  contact_name?: string;
  package_name?: string;
  user_email?: string;
}
```

---

## Request Pricing (config/credits.ts)

| Request Type | Base Cost | Per Token | Multiplier | Effective Cost |
|-------------|-----------|-----------|------------|----------------|
| `TEXT_CHAT` | 10 credits | 0.01/token | — | ~10–50 credits per chat |
| `TEXT_SIMPLE` | 5 credits | 0.005/token | — | ~5–20 credits per request |
| `AI_BROKER` | 1 credit | — | — | 1 credit flat |
| `CODE_AGENT_EXECUTE` | 20 credits | 0.02/token | — | ~20–100 credits per execution |
| `FILE_OPERATION` | 1 credit | — | — | 1 credit flat |
| `MCP_TOOL` | 5 credits | — | 1.0× | 5 credits per tool call |

**Currency**: 1 credit ≈ R0.01 (100 credits = R1.00)

---

## Middleware-Injected Request Properties

| Property | Set By | Type | Description |
|----------|--------|------|-------------|
| `req.contactId` | `requirePackage` | `number` | Contact ID from user_contact_link |
| `req.contactPackageId` | `requirePackage` | `number` | Active subscription ID |
| `req.creditBalance` | `requirePackage` / `requireCredits` | `number` | Current credit balance |

## Middleware-Set Response Headers

| Header | Set By | Description |
|--------|--------|-------------|
| `X-Credit-Balance` | `requireCredits` | Current balance before deduction |
| `X-Credit-Low-Balance` | `requireCredits` | `1` if balance < 5000, else `0` |
| `X-Credit-Deducted` | `deductCreditsAfterResponse` | Credits deducted for this request |
| `X-Credit-Balance-After` | `deductCreditsAfterResponse` | Balance after deduction |
