# Roles & Permissions Module - Changelog & Known Issues

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-02 | 1.0.0 | Initial documentation of RBAC system |

---

## 2. Known Issues

### 2.1 🔴 CRITICAL — No Backend Permission Enforcement

- **Status:** OPEN
- **Files:** `systemRoles.ts`, `systemPermissions.ts` — all routes
- **Description:** All CRUD endpoints only require JWT. Any authenticated user can create roles, assign permissions, and escalate their own access.
- **Impact:** Complete RBAC bypass via API. User can call `POST /roles { name: "God" }` → `POST /permissions/:id/assign { role_id }` → `POST /roles/:id/assign { user_id: self }`.
- **Recommended Fix:** Add `requireAdmin` middleware to both routers.
- **Effort:** LOW

### 2.2 🟡 WARNING — Staff Treated as Admin in Frontend

- **Status:** OPEN
- **File:** `frontend/src/hooks/usePermissions.ts` — `isAdmin()`
- **Description:** `isAdmin()` returns true for both `is_admin` and `is_staff`. All `<Can>` and `<PermissionRoute>` guards are bypassed for staff users.
- **Impact:** Staff users see all admin UI elements regardless of their actual role/permissions.
- **Recommended Fix:** Change `isAdmin()` to check `is_admin` only. Use `isAdminOrStaff()` where both should be allowed.
- **Effort:** LOW

### 2.3 🟡 WARNING — No System Role Protection

- **Status:** OPEN
- **File:** `systemRoles.ts` — `DELETE /:id`
- **Description:** Built-in roles (e.g., "Administrator") can be deleted via API.
- **Impact:** Deleting the admin role removes all admin-user associations. Users lose their administrative access.
- **Recommended Fix:** Add `is_system` column to roles. Prevent deletion of system roles.
- **Effort:** LOW

### 2.4 🟡 WARNING — Cascading Deletes Without Transaction

- **Status:** OPEN
- **Files:** `systemRoles.ts` DELETE, `systemPermissions.ts` DELETE
- **Description:** Multiple DELETE statements execute without a transaction wrapper.
- **Impact:** Partial state possible if a DELETE fails mid-sequence.
- **Recommended Fix:** Wrap in `db.transaction()`.
- **Effort:** LOW

### 2.5 🟡 WARNING — Permission Sync Can Break Assignments

- **Status:** OPEN
- **File:** `frontend/src/components/PermissionSync.tsx`
- **Description:** "Sync & Delete" operation removes permissions not found in code. If the code definition changes, existing role-permission assignments are silently broken.
- **Impact:** Roles may lose permissions unexpectedly after a sync.
- **Recommended Fix:** Show warning about affected roles before deleting. Log all deletions.
- **Effort:** MEDIUM

### 2.6 🟢 INFO — No Audit Trail for Permission Changes

- **Status:** OPEN (tech debt)
- **Description:** No logging when permissions are assigned/removed from roles or roles are assigned/removed from users.
- **Impact:** Cannot investigate "who changed what" after a security incident.
- **Recommended Fix:** Create `permission_audit_log` table with actor, action, target, timestamp.
- **Effort:** MEDIUM

### 2.7 🟢 INFO — Single Role Per User (De Facto)

- **Status:** OPEN (tech debt)
- **Description:** While the schema supports multiple roles per user, the frontend only shows/manages the first role (`user.roles?.[0]`).
- **Impact:** If a user has multiple roles, only the first is visible. Additional roles still grant permissions but aren't manageable in the UI.
- **Recommended Fix:** Update Users.tsx to display and manage multiple roles.
- **Effort:** MEDIUM

### 2.8 🟢 INFO — PermissionSync Uses Separate Auth Token

- **Status:** OPEN (tech debt)
- **File:** `PermissionSync.tsx`
- **Description:** The PermissionSync component reads `auth_user` from localStorage and extracts `.token`, while the rest of the app uses the Axios interceptor with `jwt_token`. Different auth mechanisms.
- **Impact:** Sync may fail if localStorage key naming changes.
- **Recommended Fix:** Use the shared Axios instance (`api`) instead of raw `axios.get()`.
- **Effort:** LOW

---

## 3. Migration Notes

### From Current to Secure RBAC

1. **Add Admin Middleware** (non-breaking)
   - Add `requireAdmin` to both routers
   - Test: Non-admin users get 403 on all role/permission CRUD

2. **Fix isAdmin() for Staff** (behavioral change)
   - Change `usePermissions.isAdmin()` to check `is_admin` only
   - Audit all `<Can>` usages — some may need `isAdminOrStaff()` instead
   - Test: Staff users only see what their role permits

3. **Add System Role Protection** (schema change)
   - `ALTER TABLE roles ADD is_system BOOLEAN NOT NULL DEFAULT FALSE;`
   - `UPDATE roles SET is_system = TRUE WHERE slug = 'administrator';`
   - Add check in DELETE handler
   - Test: Verify system role cannot be deleted

4. **Transaction-Wrap Deletes** (non-breaking)
   - Wrap cascading deletes in `db.transaction()`
   - Test: Verify delete still works, check partial failure handling

---

## 4. Future Enhancements

| Enhancement | Priority | Effort | Description |
|------------|----------|--------|-------------|
| Backend permission middleware | 🔴 HIGH | LOW | `requirePermission('users.create')` middleware |
| Permission inheritance | 🟡 MEDIUM | HIGH | Role hierarchy (Manager inherits Editor) |
| Direct user permissions | 🟡 MEDIUM | MEDIUM | Override role permissions per user |
| Permission audit log | 🟡 MEDIUM | MEDIUM | Track all RBAC changes |
| Multi-role UI | 🟢 LOW | MEDIUM | Manage multiple roles per user in frontend |
| Role cloning | 🟢 LOW | LOW | Duplicate role with all permissions |
| Temporary permissions | 🟢 LOW | HIGH | Time-limited permission grants |
| Permission dependencies | 🟢 LOW | HIGH | Auto-grant "view" when "edit" is assigned |
