# Roles & Permissions Module - File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total files | 9 |
| Backend files | 2 |
| Frontend files | 7 |
| Total LOC | ~1,612 |

---

## 2. Backend Files

### 2.1 `backend/src/routes/systemRoles.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/routes/systemRoles.ts` |
| **LOC** | 155 |
| **Purpose** | Role CRUD + user-role assignment/removal |
| **Exports** | `rolesRouter` (Express Router) |
| **Dependencies** | `express`, `db/mysql`, `middleware/auth`, `utils/httpErrors` |

**Handlers:**

| Handler | Type | Description |
|---------|------|-------------|
| `GET /` | Route | List all roles with permission counts (subquery) |
| `GET /:id` | Route | Get single role with full permissions array |
| `POST /` | Route | Create role (auto-generates slug from name if not provided) |
| `PUT /:id` | Route | Update role name, slug, description |
| `DELETE /:id` | Route | Delete role + cascading role_permissions + user_roles |
| `POST /:id/assign` | Route | Assign role to user (idempotent — skips if exists) |
| `POST /:id/remove` | Route | Remove role from user |

---

### 2.2 `backend/src/routes/systemPermissions.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/routes/systemPermissions.ts` |
| **LOC** | 168 |
| **Purpose** | Permission CRUD + role-permission assignment + user permission resolution |
| **Exports** | `permissionsRouter` (Express Router) |
| **Dependencies** | `express`, `db/mysql`, `middleware/auth`, `utils/httpErrors` |

**Handlers:**

| Handler | Type | Description |
|---------|------|-------------|
| `GET /` | Route | List all permissions ordered by group, name |
| `GET /user` | Route | Get current user's resolved permissions (admin = wildcard `*`) |
| `GET /:id` | Route | Get single permission |
| `POST /` | Route | Create permission (requires name + slug) |
| `PUT /:id` | Route | Update permission fields |
| `DELETE /:id` | Route | Delete permission + cascading role_permissions |
| `POST /:id/assign` | Route | Assign permission to role (idempotent) |
| `POST /:id/remove` | Route | Remove permission from role |

---

## 3. Frontend Files

### 3.1 `frontend/src/pages/system/Roles.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/system/Roles.tsx` |
| **LOC** | 370 |
| **Purpose** | Role management page with DataTable, CRUD form, and permissions modal |

**Key Functions:**

| Function | Description |
|----------|-------------|
| `loadData()` | Parallel fetch of roles + permissions via Promise.all |
| `handleSubmit()` | Create or update role |
| `handleDelete(role)` | SweetAlert confirm → delete |
| `handleManagePermissions(role)` | Fetch role with permissions → open modal |
| `handleTogglePermission(id)` | Toggle add/remove permission on selected role |
| `groupedPermissions` | useMemo — groups permissions by `permission_group` |

---

### 3.2 `frontend/src/pages/system/Permissions.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/system/Permissions.tsx` |
| **LOC** | 170 |
| **Purpose** | Read-only permission viewer with search and group filtering |

**Key Features:**
- Color-coded group badges (Users=blue, Roles=purple, Contacts=pink, etc.)
- Client-side search by name, slug, description
- Group filter dropdown with counts

---

### 3.3 `frontend/src/components/Can.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/components/Can.tsx` |
| **LOC** | 63 |
| **Purpose** | Declarative permission-based rendering component |

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `permission` | string | Single permission slug to check |
| `anyPermission` | string[] | OR logic — user needs at least one |
| `allPermissions` | string[] | AND logic — user needs all |
| `requireAdmin` | boolean | Admin-only gating |
| `fallback` | ReactNode | Rendered when permission denied (default: null) |

---

### 3.4 `frontend/src/components/PermissionRoute.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/components/PermissionRoute.tsx` |
| **LOC** | 66 |
| **Purpose** | Route-level permission protection — redirects unauthorized users |

**Behavior:**
- Not authenticated → redirect to `/login`
- Not active → redirect to `/login`
- Missing permission → redirect to `/`
- Has permission → render children

---

### 3.5 `frontend/src/components/PermissionSync.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/components/PermissionSync.tsx` |
| **LOC** | 270 |
| **Purpose** | Code-to-DB permission sync tool with preview |

**Features:**
- Preview changes before syncing (create, update, unchanged, unregistered)
- Sync without deleting unregistered permissions
- Sync and delete unregistered permissions
- Stats display after sync (created/updated/unchanged/deleted)

---

### 3.6 `frontend/src/hooks/usePermissions.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/hooks/usePermissions.ts` |
| **LOC** | 89 |
| **Purpose** | React hook for permission checking |

**Returned API:**

| Function | Description |
|----------|-------------|
| `hasPermission(slug)` | Check single permission (admin bypasses) |
| `hasAnyPermission(slugs)` | OR logic check |
| `hasAllPermissions(slugs)` | AND logic check |
| `isAdmin()` | Returns true for both admin AND staff |
| `isStrictAdmin()` | Returns true for admin only |
| `isStaff()` | Returns true for staff only |
| `getPermissions()` | Returns array of permission slugs |
| `permissions` | Raw permissions array |

---

### 3.7 `frontend/src/models/SystemModels.ts` (shared)

Already documented in Users/FILES.md. Exports `RoleModel` (re-exported as `SystemRoleModel`) and `PermissionModel` (re-exported as `SystemPermissionModel`).

---

## 4. File Relationship Map

```
systemRoles.ts ─────── /roles/*       ──── Roles.tsx
systemPermissions.ts── /permissions/* ──── Permissions.tsx, PermissionSync.tsx
                                            ↕ SystemModels.ts
                                            
usePermissions.ts ←── Can.tsx, PermissionRoute.tsx (used across all pages)
```

---

## 5. Test Files

No dedicated test files found for the Roles module.
