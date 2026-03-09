# Users Module - Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

This document catalogs the architecture patterns and anti-patterns found in the Users module.

---

## 2. Architectural Patterns

### 2.1 Mapper Function Pattern

**Context:** Backend stores `name` as a single field; frontend expects `first_name` + `last_name`. Backend uses camelCase; frontend expects snake_case.

**Implementation:**

```typescript
function mapUser(u: any, membership?: any, roles?: any[]): any {
  const nameParts = (u.name || '').split(' ');
  return {
    id: u.id,
    username: u.email,           // email used as username
    email: u.email,
    first_name: nameParts[0],    // split name
    last_name: nameParts.slice(1).join(' '),
    is_admin: membership?.role === 'ADMIN',  // derived from team role
    is_staff: membership?.role === 'STAFF',
    is_active: true,             // hardcoded
    roles: roles || [],
  };
}
```

**Benefits:**
- ✅ Single transformation point — all callers get consistent shape
- ✅ Handles null/undefined gracefully
- ✅ Reused across GET list, GET single, POST, and PUT responses

**Drawbacks:**
- ❌ `any` types throughout — no type safety
- ❌ `is_active` hardcoded to `true` — no real disable functionality
- ❌ Name splitting is lossy: "Jean Van Der Berg" → first: "Jean", last: "Van Der Berg" (works for Western names but fragile)

---

### 2.2 Dynamic SET Clause Pattern

**Context:** PUT endpoints accept partial updates — only provided fields should be updated.

**Implementation:**

```typescript
const updates: string[] = [];
const params: any[] = [];

if (email) { updates.push('email = ?'); params.push(email); }
if (name !== undefined) { updates.push('name = ?'); params.push(name); }
if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
if (password) {
  const hash = await bcrypt.hash(password, 12);
  updates.push('passwordHash = ?'); params.push(hash);
}
updates.push('updatedAt = ?'); params.push(now);
params.push(id);

await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
```

**Benefits:**
- ✅ Only updates provided fields — no overwriting nulls
- ✅ Parameterized — SQL injection safe
- ✅ Always updates `updatedAt`

**Drawbacks:**
- ❌ No Zod validation on admin route (profile route has it)
- ❌ If no fields provided (except updatedAt), still executes UPDATE
- ❌ Truthy check for `email` means empty string won't clear it (but `name` uses `!== undefined`)

---

### 2.3 Separate Admin/Self-Service Routes

**Context:** Users need to be managed by admins AND edit themselves. These have different authorization requirements.

**Implementation:**

```
/users/*    → systemUsersRouter  (requireAuth only — admin CRUD)
/profile/*  → profileRouter      (requireAuth, self-only by design)
```

**Benefits:**
- ✅ Clean separation of concerns
- ✅ Profile endpoints always operate on `getAuth(req).userId` — can't edit others
- ✅ Different validation approaches (manual vs Zod) per use case

**Drawbacks:**
- ❌ `/users` lacks admin permission check — any authenticated user can CRUD all users
- ❌ Duplicate update logic (both routes update user fields)
- ❌ Different response envelopes (`{ success, data }` vs direct object)

---

### 2.4 Enriched Profile Response

**Context:** Mobile app profile screen needs user + team + subscription + credits in one API call.

**Implementation:**

```typescript
// Single endpoint returns aggregated data from 4 tables
GET /profile → {
  user:         { ...from users },
  team:         { ...from team_members + teams },
  subscription: { ...from subscriptions + subscription_plans },
  credits:      { ...from credit_balances },
}
```

**Benefits:**
- ✅ Single API call for entire profile screen
- ✅ Null-safe — each section is null if no data exists
- ✅ Reduces mobile app complexity

**Drawbacks:**
- ❌ 4 sequential DB queries (could be parallelized)
- ❌ Tight coupling — changes to subscription schema affect profile endpoint
- ❌ No caching — full requery on every load

---

### 2.5 Frontend Permission Gating

**Context:** CRUD buttons should only appear for users with appropriate permissions.

**Implementation:**

```tsx
<Can permission="users.create">
  <button onClick={() => setShowForm(true)}>Add New User</button>
</Can>
<Can permission="users.edit">
  <button onClick={() => handleEdit(row.original)}>Edit</button>
</Can>
<Can permission="users.delete">
  <button onClick={() => handleDelete(row.original)}>Delete</button>
</Can>
```

**Benefits:**
- ✅ Clean declarative API — wrap any element
- ✅ Consistent permission checking across the app
- ✅ UI-level enforcement (buttons hidden)

**Drawbacks:**
- ❌ No corresponding backend permission check on `/users` routes
- ❌ Security through obscurity — removing `<Can>` exposes buttons
- ❌ Backend still allows the operation even without the permission

---

## 3. Anti-Patterns Found

### 3.1 N+1 Query Problem on User List

**Description:** Listing users executes `2N + 1` queries: 1 to get users, then 2 per user (membership + roles).

**Current Code:**

```typescript
const users = await db.query('SELECT ... FROM users');  // 1 query

for (const u of users) {
  const membership = await db.queryOne('SELECT role FROM team_members WHERE userId = ?', [u.id]);  // N queries
  const roles = await db.query('SELECT ... FROM roles JOIN user_roles ...', [u.id]);               // N queries
  result.push(mapUser(u, membership, roles));
}
```

**Impact:** 🔴 CRITICAL — With 100 users, this executes 201 queries. O(N) database round trips.

**Recommended Fix:**

```typescript
const users = await db.query(`
  SELECT u.*, tm.role AS teamRole, r.id AS roleId, r.name AS roleName, r.slug AS roleSlug
  FROM users u
  LEFT JOIN team_members tm ON tm.userId = u.id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  ORDER BY u.createdAt DESC
`);
// Group in JavaScript → 1 query total
```

**Effort:** 🟡 MEDIUM

---

### 3.2 No Admin Permission Check on /users Routes

**Description:** The `/users` CRUD routes only require JWT authentication — no role or permission verification.

**Impact:** 🔴 CRITICAL — Any authenticated user (including regular users) can create, edit, and delete other users.

**Current Code:**

```typescript
systemUsersRouter.get('/', requireAuth, async (req, res, next) => { ... });
systemUsersRouter.post('/', requireAuth, async (req, res, next) => { ... });
// No requireAdmin or permission check
```

**Recommended Fix:**

```typescript
import { requireAdmin } from '../middleware/requireAdmin.js';

systemUsersRouter.use(requireAuth, requireAdmin);
// Or per-route: systemUsersRouter.post('/', requireAuth, requireAdmin, handler);
```

**Effort:** 🟢 LOW (1 line per route)

---

### 3.3 Hardcoded `is_active: true`

**Description:** `mapUser()` always returns `is_active: true`. There is no `is_active` column in the users table and no mechanism to disable accounts.

**Impact:** 🟡 WARNING — Cannot disable user accounts without deleting them. No concept of account suspension.

**Recommended Fix:**

```sql
ALTER TABLE users ADD is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

Then check `is_active` during login and in `mapUser()`.

**Effort:** 🟡 MEDIUM

---

### 3.4 Delete Cascade Without Transaction

**Description:** User deletion executes 3 separate DELETE statements without a transaction wrapper.

**Current Code:**

```typescript
await db.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
await db.execute('DELETE FROM team_members WHERE userId = ?', [id]);
await db.execute('DELETE FROM users WHERE id = ?', [id]);
```

**Impact:** 🟡 WARNING — If the third DELETE fails, orphaned user_roles/team_members records are already deleted. Partial state.

**Recommended Fix:**

```typescript
await db.transaction(async (conn) => {
  await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
  await conn.execute('DELETE FROM team_members WHERE userId = ?', [id]);
  await conn.execute('DELETE FROM users WHERE id = ?', [id]);
});
```

**Effort:** 🟢 LOW

---

### 3.5 Profile Endpoint Response Inconsistency

**Description:** Admin endpoints use `{ success, data }` envelope. Profile endpoints use unwrapped responses. Password change returns `{ message }` only.

**Impact:** 🟡 WARNING — Frontend must handle multiple response shapes. Increases coupling and error risk.

**Recommended Fix:** Standardize all responses to `{ success: true, data: ..., message?: ... }`.

**Effort:** 🟡 MEDIUM (requires frontend changes)

---

### 3.6 Default Team Assignment on Create

**Description:** New users are assigned to the first team found (`SELECT id FROM teams LIMIT 1`). If no team exists, user has no team.

**Impact:** 🟡 WARNING — The `teams` table is a legacy artifact retained only for credit balance scoping (see Authentication v1.1.0). This assignment is only relevant for credit operations.

**Recommended Fix:** Accept `teamId` as a parameter, or auto-create a credit-scoping record during registration (as the registration flow already does).

**Effort:** 🟢 LOW
