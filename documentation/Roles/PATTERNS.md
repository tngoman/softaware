# Roles & Permissions Module - Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Architectural Patterns

### 1.1 Classic RBAC Junction Table Pattern

**Context:** Users need permissions, but assigning permissions directly to users doesn't scale. Roles provide a grouping layer.

**Implementation:**

```
users ──(user_roles)──► roles ──(role_permissions)──► permissions
```

**Benefits:**
- ✅ Standard pattern — well understood, documented, and battle-tested
- ✅ Role reuse — create "Manager" once, assign to many users
- ✅ Atomic permission changes — update a role and all users with that role get the change

**Drawbacks:**
- ❌ No direct user-permission override (e.g., "give John 'invoices.delete' without changing his role")
- ❌ No permission inheritance (e.g., "Manager inherits Editor permissions")
- ❌ Single role per user (de facto, though the schema supports multiple)

---

### 1.2 Admin Wildcard Pattern

**Context:** Admin users should have all permissions without maintaining a constantly-updated role.

**Implementation:**

```typescript
// In GET /permissions/user
if (membership?.role === 'ADMIN') {
  return res.json({ success: true, data: [{ id: 1, name: 'All Access', slug: '*' }] });
}

// In usePermissions.ts
const hasPermission = (slug: string): boolean => {
  if (isAdmin()) return true;  // Bypass for admins
  return user?.permissions?.some(p => p.slug === slug) || false;
};
```

**Benefits:**
- ✅ Simple — no need to assign every permission to admin role
- ✅ Future-proof — new permissions automatically apply to admins
- ✅ Single `*` wildcard is elegant and widely understood

**Drawbacks:**
- ❌ `isAdmin()` returns true for BOTH admin AND staff — staff get full access 🔴
- ❌ No way to restrict specific permissions from admins
- ❌ Backend `GET /permissions/user` returns fake data `{ id: 1, name: 'All Access' }` — not a real permission

---

### 1.3 Idempotent Assignment Pattern

**Context:** Assigning a role/permission that's already assigned shouldn't fail.

**Implementation:**

```typescript
// Assign role to user
const existing = await db.queryOne('SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?', [...]);
if (!existing) {
  await db.insertOne('user_roles', { user_id, role_id: id });
}
res.json({ success: true, message: 'Role assigned' });
```

**Benefits:**
- ✅ Safe to retry — no errors on duplicate assignment
- ✅ Frontend can call without checking state first
- ✅ Simplifies role toggling in the permissions modal

---

### 1.4 Cascading Delete Pattern

**Context:** Deleting a role or permission must clean up all junction table references.

**Implementation:**

```typescript
// Delete role
await db.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
await db.execute('DELETE FROM user_roles WHERE role_id = ?', [id]);
await db.execute('DELETE FROM roles WHERE id = ?', [id]);
```

**Benefits:**
- ✅ No orphan records in junction tables
- ✅ No FK constraint violations

**Drawbacks:**
- ❌ Not wrapped in a transaction — partial deletion possible on failure
- ❌ No soft delete — role is permanently removed
- ❌ Users silently lose permissions with no notification

---

### 1.5 Frontend Permission Gating Trio

**Context:** Three complementary approaches for frontend permission enforcement.

```
Can.tsx            → Component-level: Show/hide UI elements
PermissionRoute    → Route-level: Redirect unauthorized users  
usePermissions()   → Hook-level: Conditional logic in handlers
```

**Benefits:**
- ✅ Flexible — developers choose the right tool for the situation
- ✅ Composable — Can be nested and combined
- ✅ Consistent — all three use the same `usePermissions` hook underneath

---

### 1.6 Permission Grouping Pattern

**Context:** Permissions need visual organization for the admin UI.

**Implementation:**

```typescript
// Backend: permission_group column
{ slug: 'users.create', permission_group: 'Users' }
{ slug: 'users.edit',   permission_group: 'Users' }
{ slug: 'contacts.view', permission_group: 'Contacts' }

// Frontend: groupBy in useMemo
const groupedPermissions = permissions.reduce((acc, p) => {
  const group = p.permission_group || 'Other';
  if (!acc[group]) acc[group] = [];
  acc[group].push(p);
  return acc;
}, {});
```

**Benefits:**
- ✅ Organized permissions modal — grouped sections with headers
- ✅ Color-coded group badges on Permissions page
- ✅ Filter dropdown per group

---

## 2. Anti-Patterns Found

### 2.1 No Backend Permission Enforcement

**Description:** All role/permission CRUD routes only require JWT authentication. No admin or permission middleware.

**Impact:** 🔴 CRITICAL — Any authenticated user can create roles, assign permissions, and escalate their own privileges.

**Recommended Fix:**

```typescript
import { requireAdmin } from '../middleware/requireAdmin.js';
rolesRouter.use(requireAuth, requireAdmin);
permissionsRouter.use(requireAuth, requireAdmin);
```

**Effort:** 🟢 LOW

---

### 2.2 Staff Treated as Admin in Frontend

**Description:** `usePermissions.isAdmin()` returns true for both `is_admin` AND `is_staff`.

```typescript
const isAdmin = (): boolean => {
  return !!user?.is_admin || !!user?.is_staff;
};
```

**Impact:** 🟡 WARNING — Staff users bypass all permission checks in the frontend. Every `<Can>` guard is effectively disabled for staff.

**Recommended Fix:** Either:
- Remove `|| !!user?.is_staff` from `isAdmin()`
- Or create separate `isAdminOrStaff()` and keep `isAdmin()` strict

**Effort:** 🟢 LOW

---

### 2.3 Delete Without Transaction

**Description:** Role and permission deletion use multiple DELETEs without transaction.

**Impact:** 🟡 WARNING — If the final DELETE fails, junction records are already deleted but the parent record remains.

**Recommended Fix:** Wrap in `db.transaction()`.

**Effort:** 🟢 LOW

---

### 2.4 No Protection for System Roles

**Description:** Built-in roles like "Administrator" can be deleted, breaking the system.

**Impact:** 🟡 WARNING — If the admin role is deleted, the RBAC system collapses.

**Recommended Fix:** Add `is_system BOOLEAN DEFAULT FALSE` to roles table. Prevent deletion of system roles:

```typescript
if (role.is_system) throw badRequest('Cannot delete system role');
```

**Effort:** 🟢 LOW

---

### 2.5 Mixed ID Types

**Description:** `user_roles.user_id` is VARCHAR(36) (UUID from users table), but `user_roles.role_id` is INT (auto-increment from roles table).

**Impact:** 🟢 INFO — Works correctly but unconventional. Makes JOIN queries slightly more complex and can confuse developers.

**Recommended Fix:** Accept as-is (migration effort not justified), but document clearly.

**Effort:** N/A (documentation only)
