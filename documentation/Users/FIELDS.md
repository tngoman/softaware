# Users Module - Database Fields

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

The Users module primarily operates on the `users` table and reads from several related tables for team membership, roles, subscriptions, credits, API keys, and billing.

| Table | Module Role | Operations |
|-------|------------|------------|
| `users` | Primary | CRUD |
| `team_members` | Related | Read / Create / Update / Delete |
| `teams` | Related | Read |
| `user_roles` | Related | Read / Delete |
| `roles` | Related | Read |
| `subscriptions` | Related | Read (profile endpoint) |
| `subscription_plans` | Related | Read (profile endpoint) |
| `credit_balances` | Related | Read (profile endpoint) |
| `api_keys` | Related | Read (profile endpoint) |
| `billing_invoices` | Related | Read (profile endpoint) |

---

## 2. Primary Table: `users`

```sql
CREATE TABLE users (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,   -- UUID v4
  email        VARCHAR(255) NOT NULL UNIQUE,
  name         VARCHAR(255) NULL,                   -- Full name (single field)
  phone        VARCHAR(50)  NULL,
  avatarUrl    VARCHAR(512) NULL,                   -- URL to avatar image
  passwordHash VARCHAR(255) NOT NULL,               -- bcrypt hash (cost 12)
  createdAt    DATETIME     NOT NULL,
  updatedAt    DATETIME     NOT NULL
);
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK, NOT NULL | Lookup key, FK target |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Login credential, displayed as username |
| `name` | VARCHAR(255) | NULL | Split into first_name/last_name by mapUser() |
| `phone` | VARCHAR(50) | NULL | Displayed in profile, editable |
| `avatarUrl` | VARCHAR(512) | NULL | Displayed in profile header |
| `passwordHash` | VARCHAR(255) | NOT NULL | bcrypt hash — set on create, optional on update |
| `createdAt` | DATETIME | NOT NULL | Display, sorting |
| `updatedAt` | DATETIME | NOT NULL | Updated on every edit |

**Frontend ↔ Backend Field Mapping:**

| Frontend Field | Backend DB Column | Transformation |
|---------------|-------------------|----------------|
| `username` | `email` | Direct alias |
| `email` | `email` | Direct |
| `first_name` | `name` | `name.split(' ')[0]` |
| `last_name` | `name` | `name.split(' ').slice(1).join(' ')` |
| `phone` | `phone` | Direct |
| `avatar` | `avatarUrl` | Direct alias |
| `is_admin` | `user_roles → roles.slug` | `slug IN ('admin','super_admin')` |
| `is_staff` | `user_roles → roles.slug` | `slug IN ('developer','client_manager','qa_specialist','deployer')` |
| `is_active` | — | Always `true` (hardcoded) |
| `roles[]` | `user_roles → roles` | JOIN query |
| `created_at` | `createdAt` | camelCase → snake_case |
| `updated_at` | `updatedAt` | camelCase → snake_case |

---

## 3. Related Table: `user_roles` (Primary Role Assignment)

```sql
-- Role assignment (v1.1.0+)
SELECT r.id, r.name, r.slug FROM roles r
  JOIN user_roles ur ON ur.role_id = r.id
  WHERE ur.user_id = ?
```

| Column | Type | Module Usage |
|--------|------|-------------|
| `user_id` | VARCHAR(36) | FK → users.id |
| `role_id` | INT | FK → roles.id |

**Role Slugs → Frontend Flags:**

| Slug | Frontend Mapping | Dashboard Access |
|------|-----------------|-----------------|
| `admin`, `super_admin` | `is_admin = true` | Admin dashboard |
| `developer`, `client_manager`, `qa_specialist`, `deployer` | `is_staff = true` | Staff dashboard |
| `viewer`, `client` | Both false | Client portal |

## 3b. Legacy Table: `team_members` (Credit Scoping Only)

> ⚠️ **Legacy**: `team_members` and `teams` tables are retained **only** for credit balance scoping. Role detection uses `user_roles` + `roles` exclusively (see Authentication v1.1.0).

```sql
CREATE TABLE team_members (
  id        VARCHAR(36)  NOT NULL PRIMARY KEY,
  teamId    VARCHAR(36)  NOT NULL,               -- FK → teams.id
  userId    VARCHAR(36)  NOT NULL,               -- FK → users.id
  role      VARCHAR(20)  NOT NULL,               -- Legacy: 'ADMIN' | 'STAFF' | 'OPERATOR'
  createdAt DATETIME     NOT NULL
);
```

---

## 4. Legacy Table: `teams` (Credit Scoping Only)

> ⚠️ **Legacy**: Retained only for `credit_balances.teamId` FK. Not used for multi-tenancy or role detection.

```sql
CREATE TABLE teams (
  id        VARCHAR(36)  NOT NULL PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  createdAt DATETIME     NOT NULL,
  updatedAt DATETIME     NOT NULL
);
```

---

## 5. Related Table: `subscriptions`

Read only by `GET /profile` to show subscription status.

```sql
-- Relevant columns only
SELECT s.id, s.status, s.trialEndsAt, s.currentPeriodEnd,
       sp.tier, sp.name AS planName
FROM subscriptions s
JOIN subscription_plans sp ON s.planId = sp.id
WHERE s.teamId = ? AND s.status IN ('TRIAL', 'ACTIVE')
```

---

## 6. Related Table: `credit_balances`

Read only by `GET /profile` to show credit balance.

```sql
SELECT balance, totalPurchased, totalUsed
FROM credit_balances WHERE teamId = ?
```

---

## 7. Related Table: `api_keys`

Read only by `GET /profile/api-keys` for masked key listing.

```sql
SELECT id, name, `key`, isActive, lastUsedAt, createdAt, expiresAt
FROM api_keys WHERE userId = ?
```

**Note:** The `key` column is masked in the response: `****${key.slice(-8)}`.

---

## 8. Related Table: `billing_invoices`

Read only by `GET /profile/invoices` for team billing history.

```sql
SELECT id, invoiceNumber, description, subtotal, vatAmount, total,
       periodStart, periodEnd, dueDate, paidAt, pdfUrl, createdAt
FROM billing_invoices WHERE subscriptionId = ?
ORDER BY createdAt DESC LIMIT 50
```

**Derived Fields:**
- `subtotalDisplay` = `R${(subtotal / 100).toFixed(2)}` — amounts stored in cents
- `vatDisplay` = `R${(vatAmount / 100).toFixed(2)}`
- `totalDisplay` = `R${(total / 100).toFixed(2)}`
- `status` = `paidAt ? 'PAID' : (now > dueDate ? 'OVERDUE' : 'PENDING')` — derived at response time

---

## 9. Index Recommendations

| Table | Suggested Index | Reason |
|-------|----------------|--------|
| `users` | `idx_users_email` (likely exists via UNIQUE) | Login lookup |
| `team_members` | `idx_tm_userId` | Profile lookups, user list |
| `team_members` | `idx_tm_teamId` | Team member listing |
| `user_roles` | `idx_ur_user_id` | Role lookup per user |
| `api_keys` | `idx_ak_userId` | API key listing per user |
| `billing_invoices` | `idx_bi_subscriptionId` | Invoice listing |
