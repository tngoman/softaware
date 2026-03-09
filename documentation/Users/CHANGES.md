# Users Module - Changelog & Known Issues

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-02 | 1.0.0 | Initial documentation of existing user management system |

---

## 2. Known Issues

### 2.1 🔴 CRITICAL — No Admin Permission Check on /users Routes

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — all routes
- **Description:** All 5 CRUD endpoints only require JWT authentication. Any authenticated user (including regular operators) can create, edit, and delete other users.
- **Impact:** Privilege escalation — a regular user can promote themselves to admin by calling `PUT /users/:id { is_admin: true }`.
- **Recommended Fix:** Add `requireAdmin` middleware to all routes on the systemUsersRouter.
- **Effort:** LOW (1 line)

### 2.2 🔴 CRITICAL — N+1 Query Problem on User List

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — `GET /`
- **Description:** Listing users executes `2N + 1` database queries (1 base + 2 per user for membership and roles).
- **Impact:** With 100 users, 201 queries execute. Performance degrades linearly. Under load, this can exhaust the 10-connection pool.
- **Recommended Fix:** Replace with a single JOIN query and group results in JavaScript.
- **Effort:** MEDIUM

### 2.3 🟡 WARNING — No Pagination on User List

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — `GET /`
- **Description:** All users are returned in a single response. No `LIMIT/OFFSET`, no cursor pagination.
- **Impact:** Response grows linearly with user count. Combined with N+1, large user bases will timeout.
- **Recommended Fix:** Add `?page=1&limit=20&search=` query parameters with SQL LIMIT/OFFSET.
- **Effort:** LOW

### 2.4 🟡 WARNING — Hardcoded `is_active: true`

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — `mapUser()`
- **Description:** No `is_active` column exists in the users table. The field is always returned as `true`.
- **Impact:** Cannot suspend/disable user accounts. Only option is full deletion.
- **Recommended Fix:** Add `is_active BOOLEAN DEFAULT TRUE` to users table. Check during login.
- **Effort:** MEDIUM

### 2.5 🟡 WARNING — Delete Without Transaction

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — `DELETE /:id`
- **Description:** Three DELETE statements execute without a transaction. If mid-way failure occurs, data is left in partial state.
- **Recommended Fix:** Wrap in `db.transaction()`.
- **Effort:** LOW

### 2.6 🟡 WARNING — No Email Uniqueness Check on Update

- **Status:** OPEN
- **Module File:** `backend/src/routes/systemUsers.ts` — `PUT /:id`
- **Description:** When updating email, no check for existing email. The UNIQUE constraint will throw a raw MySQL error instead of a friendly message.
- **Recommended Fix:** Check for existing email before UPDATE, return `badRequest('Email already in use')`.
- **Effort:** LOW

### 2.7 🟡 WARNING — Profile vs Admin Response Envelope Mismatch

- **Status:** OPEN (tech debt)
- **Module Files:** `systemUsers.ts` vs `profile.ts`
- **Description:** Admin routes use `{ success, data }` wrapper. Profile routes return unwrapped objects. Password change returns only `{ message }`.
- **Impact:** Frontend must handle different response shapes per endpoint.
- **Recommended Fix:** Standardize all responses to `{ success, data, message? }`.
- **Effort:** MEDIUM

### 2.8 🟢 INFO — No Input Validation on Admin Routes

- **Status:** OPEN (tech debt)
- **Module File:** `backend/src/routes/systemUsers.ts` — POST/PUT
- **Description:** Profile routes use Zod schemas. Admin routes use manual `if (!email || !password)` checks. No max length, format, or type validation.
- **Recommended Fix:** Add Zod schemas matching profile.ts patterns.
- **Effort:** LOW

### 2.9 🟢 INFO — Frontend Search is Client-Side Only

- **Status:** OPEN (tech debt)
- **Module File:** `frontend/src/pages/system/Users.tsx` — `loadUsers()`
- **Description:** Search parameter is passed to API but backend ignores it. Actual filtering happens client-side via DataTable.
- **Recommended Fix:** Add `WHERE name LIKE ? OR email LIKE ?` to the backend query.
- **Effort:** LOW

---

## 3. Migration Notes

### From Current to Secure User Management

Follow this order:

1. **Add Admin Check** (non-breaking)
   - Import `requireAdmin` middleware
   - Add to systemUsersRouter: `systemUsersRouter.use(requireAuth, requireAdmin)`
   - Test: Verify non-admin users get 403

2. **Fix N+1 Query** (non-breaking)
   - Replace loop with single JOIN query
   - Group results in JavaScript by user ID
   - Test: Verify user list returns same data with fewer queries

3. **Add Pagination** (API change)
   - Accept `?page=1&limit=20&search=` parameters
   - Return `{ success, data, pagination: { page, limit, total } }`
   - Update frontend to use server-side pagination
   - Test: Verify pagination works with search

4. **Add is_active Column** (schema change)
   - `ALTER TABLE users ADD is_active BOOLEAN NOT NULL DEFAULT TRUE;`
   - Update `mapUser()` to read actual column
   - Add login check: reject if `is_active = false`
   - Add toggle endpoint or include in PUT
   - Test: Verify disabled users cannot login

5. **Wrap Delete in Transaction** (non-breaking)
   - Replace 3 sequential DELETEs with `db.transaction()`
   - Test: Verify delete still works, check rollback on failure

6. **Add Zod Validation** (non-breaking)
   - Create schemas for POST and PUT bodies
   - Match profile.ts validation patterns
   - Test: Verify invalid input returns 400 with details

---

## 4. Future Enhancements

| Enhancement | Priority | Effort | Description |
|------------|----------|--------|-------------|
| Avatar upload | 🟡 MEDIUM | MEDIUM | Multipart file upload → S3/storage → avatarUrl |
| User activity log | 🟡 MEDIUM | MEDIUM | Track logins, profile changes, admin actions |
| Bulk operations | 🟢 LOW | LOW | Select multiple users → enable/disable/delete |
| User import/export | 🟢 LOW | MEDIUM | CSV import for bulk user creation |
| Last login tracking | 🟡 MEDIUM | LOW | Add `lastLoginAt` column, update on login |
| Two-factor enforcement | 🟡 MEDIUM | LOW | Admin setting to require 2FA for all users |
| User invitation flow | 🟡 MEDIUM | MEDIUM | Send email invite → user sets password |
| Password expiry | 🟢 LOW | LOW | Force password change after N days |
