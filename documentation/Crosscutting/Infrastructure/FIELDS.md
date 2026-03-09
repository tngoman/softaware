# Crosscutting / Infrastructure Module - Database Schema

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

The Infrastructure module does not own tables directly, but its middleware and database layer interact with tables owned by other modules. This document lists the tables **read by** infrastructure middleware for authentication, authorization, and enforcement.

| Metric | Value |
|--------|-------|
| **Tables directly read** | 7 |
| **Tables written to** | 1 (api_keys.lastUsedAt) |
| **Connection** | mysql2/promise pool, 10 connections, keepalive |

---

## 2. Tables Read by Middleware

### 2.1 `users` / `sys_users` — Account Status

**Read by:** `middleware/statusCheck.ts` (checkAccountStatus, checkAssistantStatus, checkWidgetStatus)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User login email |
| name | VARCHAR(255) | | Display name |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt hash |
| account_status | ENUM('active','suspended','demo_expired') | DEFAULT 'active' | Global account status |
| createdAt | DATETIME | NOT NULL | Registration timestamp |
| updatedAt | DATETIME | NOT NULL | Last modification |

**Indexes:** PRIMARY (id), UNIQUE (email)

**Business Rules:**
- If account_status ≠ 'active', ALL sub-resources are blocked
- Status check middleware joins users table for assistant/widget checks

---

### 2.2 `team_members` — Legacy Team Membership (Credit Scoping Only)

> ⚠️ **Legacy**: The `team_members` and `teams` tables are retained **only** for credit balance scoping. The `requireTeam` middleware exists on disk but is **not imported by any route file** (dead code since v1.1.0). Admin detection now uses `user_roles` + `roles` exclusively.

**Read by:** ~~`middleware/team.ts`~~ (unused), `credits.ts` routes (for credit balance lookup)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| teamId | VARCHAR(36) | FK → teams.id, NOT NULL | Team reference (credit scoping) |
| userId | VARCHAR(36) | FK → users.id, NOT NULL | User reference |
| role | ENUM('ADMIN','STAFF','ARCHITECT','OPERATOR','AUDITOR') | NOT NULL | Legacy role (no longer used for auth) |
| createdAt | DATETIME | NOT NULL | Membership start |

**Indexes:** PRIMARY (id), INDEX (teamId, userId)

**Current Admin Detection (requireAdmin middleware):**

```sql
SELECT r.slug FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = ? AND r.slug IN ('admin', 'super_admin')
LIMIT 1
```

---

### 2.3 `api_keys` — API Key Validation

**Read/Written by:** `middleware/apiKey.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| name | VARCHAR(255) | NOT NULL | Human-readable key name |
| key | VARCHAR(255) | UNIQUE, NOT NULL | The API key value |
| userId | VARCHAR(36) | FK → users.id, NOT NULL | Key owner |
| isActive | BOOLEAN | DEFAULT true | Active/revoked flag |
| lastUsedAt | DATETIME | | Last usage timestamp (updated by middleware) |
| createdAt | DATETIME | NOT NULL | Creation timestamp |
| expiresAt | DATETIME | | Optional expiry date |

**Indexes:** PRIMARY (id), UNIQUE (key)

**Business Rules:**
- Key must be active AND not expired
- `lastUsedAt` is updated on every successful validation
- Joined with users table to get user email

**Example Query:**

```sql
SELECT ak.*, u.email as userEmail 
FROM api_keys ak 
JOIN users u ON ak.userId = u.id 
WHERE ak.`key` = ?
```

---

### 2.4 `assistants` — Assistant Status

**Read by:** `middleware/statusCheck.ts` (checkAssistantStatus)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| userId | VARCHAR(36) | FK → users.id | Owner |
| status | ENUM('active','suspended','demo_expired') | DEFAULT 'active' | Assistant status |

**Example Query:**

```sql
SELECT a.status AS assistant_status, u.account_status
FROM assistants a
LEFT JOIN users u ON u.id = a.userId
WHERE a.id = ?
```

---

### 2.5 `widget_clients` — Widget Status & Usage

**Read by:** `middleware/statusCheck.ts` (checkWidgetStatus), `middleware/usageTracking.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| user_id | VARCHAR(36) | FK → users.id | Owner |
| status | ENUM('active','suspended','demo_expired') | DEFAULT 'active' | Widget status |
| billing_cycle_start | DATE | | Current cycle start |
| billing_cycle_end | DATE | | Current cycle end |
| messages_this_cycle | INT | DEFAULT 0 | Messages sent this billing cycle |

**Example Query (status check):**

```sql
SELECT wc.status AS widget_status, u.account_status
FROM widget_clients wc
LEFT JOIN users u ON u.id = wc.user_id
WHERE wc.id = ?
```

---

### 2.6 `subscription_tier_limits` — Tier Limits

**Read by:** `middleware/usageTracking.ts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| tier | VARCHAR(50) | PK | Tier name (Free, Starter, Advanced, Enterprise) |
| max_pages | INT | | Max knowledge pages per tier |
| max_messages_per_month | INT | | Monthly message cap |

**Example Query:**

```sql
SELECT max_pages, max_messages_per_month 
FROM subscription_tier_limits 
WHERE tier = ?
```

---

### 2.7 `credit_balances` — Credit Balance Check

**Read by:** `middleware/credits.ts` (requireCredits, via services/credits.ts)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID |
| teamId | VARCHAR(36) | FK → teams.id, UNIQUE | Team reference |
| balance | DECIMAL(10,2) | DEFAULT 0 | Current credit balance |
| totalPurchased | DECIMAL(10,2) | DEFAULT 0 | Lifetime purchased |
| totalUsed | DECIMAL(10,2) | DEFAULT 0 | Lifetime consumed |
| lowBalanceThreshold | DECIMAL(10,2) | DEFAULT 1000 | Alert threshold |
| lowBalanceAlertSent | BOOLEAN | DEFAULT false | Alert sent flag |

**Business Rules:**
- Balance ≤ 0 → 402 response, request blocked
- Balance < 1000 → `X-Credit-Low-Balance: true` header

---

## 3. Table Relationships

```
users ──────────┬──── team_members ────── teams      ⚠️ LEGACY (credit scoping only)
                │
                ├──── user_roles ────── roles ────── role_permissions ────── permissions
                │
                ├──── api_keys
                │
                ├──── assistants
                │
                └──── widget_clients ──── subscription_tier_limits

teams ──────────────── credit_balances ──── credit_transactions
```

---

## 4. Known Issues

| # | Severity | Table | Issue | Impact |
|---|----------|-------|-------|--------|
| 1 | ✅ | team_members | `requireTeam` middleware is dead code — not imported by any route file (can be safely deleted) | None — no route uses it |
| 2 | 🟡 | api_keys | No compound unique on (userId, name) — same user can have duplicate key names | Confusing in admin UI, but functionally fine |
| 3 | ✅ | users | `account_status` check uses fail-open policy | Correct behavior — doesn't block on transient DB errors |
