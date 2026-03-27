# Plan: Move Subscription State from `users` to `contacts`

**Status:** Draft  
**Date:** 2026-03-23  
**Scope:** Schema + service + middleware + route changes only — no data migration needed (demo data only)

---

## Problem

Five columns currently live on the `users` table that belong on `contacts`:

| Column | Why it's wrong on `users` |
|---|---|
| `storage_used_bytes` | Storage is a company resource — all users under a contact share it |
| `storage_limit_bytes` | Tier cap is set per package (contact-level) — wrong to duplicate per user |
| `plan_type` | A denormalized cache of the contact's tier. Ambiguous when a user belongs to multiple contacts. The real source of truth is `contact_packages` |
| `has_used_trial` | Trial eligibility belongs to a company, not an individual — otherwise a person who leaves a company can "bring" their spent trial to a new one |
| `trial_expires_at` | Same as above — a trial is a company-level promotion |

A contact can have **multiple users** (owner + team members). With these columns on `users`:
- Each team member gets their own separate storage quota instead of sharing a company pool
- Admins changing a package have to `UPDATE users … WHERE contact_id = ?` (spray-update every linked user)
- A user linked to two companies (`user_contact_link`) has one `plan_type`, `trial_expires_at`, etc. — whichever company synced last wins, silently corrupting the other company's state

`contact_packages` already holds the canonical subscription. `plan_type` / `has_used_trial` / `trial_expires_at` are redundant caches that are now actively harmful.

---

## Target State

All five columns move to `contacts`. The `users` table becomes a pure **identity/auth** table.

| Column | Old location | New location |
|---|---|---|
| `storage_used_bytes` | `users` | `contacts` |
| `storage_limit_bytes` | `users` | `contacts` |
| `plan_type` | `users` | `contacts` |
| `has_used_trial` | `users` | `contacts` |
| `trial_expires_at` | `users` | `contacts` |

`client_custom_data.client_id` continues to store `users.id` (auth identity) but all quota reads/writes resolve through `users.contact_id → contacts`.

---

## Files to Change

### 1. Database — Migration 033

**File:** `src/db/migrations/033_subscription_state_to_contacts.ts`  
**Script:** `src/scripts/run_migration_033.ts`

```sql
-- UP
ALTER TABLE contacts
  ADD COLUMN storage_used_bytes  BIGINT       NOT NULL DEFAULT 0,
  ADD COLUMN storage_limit_bytes BIGINT       NOT NULL DEFAULT 5242880,
  ADD COLUMN plan_type           VARCHAR(50)  NOT NULL DEFAULT 'free',
  ADD COLUMN has_used_trial      BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN trial_expires_at    DATETIME     NULL DEFAULT NULL;

ALTER TABLE users
  DROP COLUMN storage_used_bytes,
  DROP COLUMN storage_limit_bytes,
  DROP COLUMN plan_type,
  DROP COLUMN has_used_trial,
  DROP COLUMN trial_expires_at;
```

```sql
-- DOWN (reverse — add back to users, drop from contacts)
```

---

### 2. `src/services/packageResolver.ts` — `syncUsersForContactPackage`

The function currently runs one UPDATE against `users WHERE contact_id = ?`. It becomes one UPDATE against `contacts WHERE id = ?`.

**Current:**
```sql
UPDATE users SET plan_type = ?, storage_limit_bytes = ? WHERE contact_id = ?
```

**New:**
```sql
UPDATE contacts SET plan_type = ?, storage_limit_bytes = ? WHERE id = ?
```

---

### 3. `src/middleware/storageLimit.ts`

Query changes from `users` to joining through to `contacts`.

**Current:**
```sql
SELECT storage_used_bytes, storage_limit_bytes FROM users WHERE id = ?
```

**New:**
```sql
SELECT c.storage_used_bytes, c.storage_limit_bytes
FROM users u
JOIN contacts c ON c.id = u.contact_id
WHERE u.id = ?
```

---

### 4. `src/routes/siteData.ts`

Extract a shared helper `getContactIdForUser(userId): Promise<number>` then use it in five places:

| Location | Old table | New table |
|---|---|---|
| `GET /_usage` read | `users` | `contacts` via helper |
| `POST /:collection` ledger charge | `UPDATE users` | `UPDATE contacts` via helper |
| `PUT /:collection/:id` ledger check | `users` | `contacts` via helper |
| `PUT /:collection/:id` ledger adjust | `UPDATE users` | `UPDATE contacts` via helper |
| `DELETE` ledger refund | `UPDATE users` | `UPDATE contacts` via helper |

---

### 5. `src/routes/billing.ts` — `POST /start-trial` and `GET /status`

**Current:** Reads `plan_type`, `has_used_trial`, `trial_expires_at` from `users`.  
**New:** Join to `contacts` via `users.contact_id` for all three columns.

**Current write:**
```sql
UPDATE users SET plan_type = 'starter', has_used_trial = TRUE, trial_expires_at = ? WHERE id = ?
```

**New write:**
```sql
UPDATE contacts SET plan_type = 'starter', has_used_trial = TRUE, trial_expires_at = ? WHERE id = (SELECT contact_id FROM users WHERE id = ?)
```

---

### 6. `src/routes/auth.ts` — trial activation on registration

Same pattern — the `UPDATE users SET plan_type = 'starter', has_used_trial = TRUE, trial_expires_at = ?` on signup moves to a contact UPDATE.

> **Note:** At signup a contact row must exist (or be created) before the trial columns can be written. Review the registration flow to confirm contact creation happens first.

---

### 7. `src/routes/dashboard.ts`

Falls back to `users.plan_type`, `has_used_trial`, `trial_expires_at` when the contact package lookup fails. Change to read from `contacts` via join.

---

### 8. `src/routes/yoco.ts` — payment fulfilment

`UPDATE users SET plan_type = ? WHERE id = ?` on checkout completion needs to update `contacts` instead:
```sql
UPDATE contacts SET plan_type = ?
WHERE id = (SELECT contact_id FROM users WHERE id = ?)
```

Also needs to create/update the matching `contact_packages` row — currently the Yoco flow only writes `plan_type` and does not upsert into `contact_packages` *(separate issue, flagged for follow-up).*

---

### 9. `src/services/trialEnforcer.ts`

Phase 2 (user-level sweep) reads `users.trial_expires_at` and writes `users.plan_type`. After the move:
- Phase 1 (contact_packages sweep) is the canonical path — keep as-is
- Phase 2 should be rewritten to sweep `contacts.trial_expires_at` instead, or removed entirely once Phase 1 is the sole source

---

### 10. `src/db/mysql.ts` — UserRow type

Remove `has_used_trial`, `trial_expires_at`, `plan_type` from the `UserRow` interface.  
Add them to a `ContactRow` interface (or the existing contacts type).

---

### 11. Migration source cleanup

Update migration `029` and `031` source files so future fresh installs apply the columns to `contacts` from the start rather than `users`.

---

### 12. Documentation updates

| File | Change |
|---|---|
| `ProPackage/FILES.md` | `syncUsersForContactPackage` — reflects contacts UPDATE |
| `ProPackage/PATTERNS.md` | UPDATE query comment |
| `ProPackage/ROUTES.md` | Sync function description |

---

## Execution Order

1. Write migration `033` (schema — drops from users, adds to contacts)
2. Update `packageResolver.ts` (`syncUsersForContactPackage`)
3. Update `storageLimit.ts`
4. Update `siteData.ts` (extract `getContactIdForUser` helper first)
5. Update `billing.ts`
6. Update `auth.ts` (registration trial activation)
7. Update `dashboard.ts` (fallback reads)
8. Update `yoco.ts` (payment fulfilment writes)
9. Update `trialEnforcer.ts` Phase 2
10. Update `db/mysql.ts` UserRow type
11. Update migration `029` + `031` sources
12. Write `run_migration_033.ts` script
13. Run the migration
14. Restart backend

---

## What Does NOT Change

- `client_custom_data.client_id` — still stores `users.id` (auth identity)
- `users.contact_id` — the FK linking a user to their primary contact
- `user_contact_link` — multi-company membership table, untouched
- `contact_packages` — the canonical subscription table, already correct
- All `requireActivePackageForUser` / `getActivePackageForUser` flows — unchanged
- The CMS and billing API surface (endpoints, request/response shapes) — unchanged

---

## Risk

**Low.** No production data exists. The only live data is demo/test accounts.  
The schema change is straightforward `ALTER TABLE` statements. All code changes are SQL substitutions in eight files with a clear pattern. The `getContactIdForUser` helper is a one-liner subquery reused everywhere.
