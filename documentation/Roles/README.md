# Roles & Permissions Module

**Version:** 1.0.0  
**Last Updated:** 2026-03-02  
**Status:** ✅ Active — Core system module

---

## 1. Purpose

The Roles & Permissions module implements a Role-Based Access Control (RBAC) system. Admins define roles, assign permissions to roles, and assign roles to users. The frontend uses the `<Can>` component and `usePermissions` hook to conditionally render UI based on the user's resolved permissions.

---

## 2. Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                              │
│                                                                       │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────────┐  │
│  │  Roles.tsx    │  │ Permissions   │  │ PermissionSync.tsx        │  │
│  │  (CRUD +     │  │ .tsx          │  │ (Code-to-DB sync)         │  │
│  │  assign)     │  │ (Read-only)   │  │                           │  │
│  └──────┬───────┘  └───────┬───────┘  └────────────┬──────────────┘  │
│         │                  │                        │                 │
│  ┌──────┴──────────────────┴────────────────────────┴──────────────┐  │
│  │  SystemModels.ts (RoleModel, PermissionModel)                   │  │
│  └─────────────────────────────┬───────────────────────────────────┘  │
│                                │                                      │
│  ┌─────────────────────────────┼───────────────────────────────────┐  │
│  │  Can.tsx │ PermissionRoute │ usePermissions.ts                  │  │
│  │  (UI gating — used across all pages)                            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────────────┘
                                 │ Axios (Bearer JWT)
┌────────────────────────────────┼──────────────────────────────────────┐
│                      Backend (Express)                                │
│                                │                                      │
│  ┌─────────────────────────────┴───────────────────────────────────┐  │
│  │                      requireAuth middleware                      │  │
│  └───────────┬─────────────────────────────────────┬───────────────┘  │
│              │                                     │                  │
│  ┌───────────┴──────────────┐  ┌───────────────────┴──────────────┐  │
│  │  systemRoles.ts          │  │  systemPermissions.ts             │  │
│  │  /roles CRUD + assign    │  │  /permissions CRUD + assign       │  │
│  └───────────┬──────────────┘  └───────────────────┬──────────────┘  │
│              │                                     │                  │
│  ┌───────────┴─────────────────────────────────────┴──────────────┐  │
│  │  MySQL: roles, permissions, role_permissions, user_roles        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Concepts

### 3.1 RBAC Model

```
User ──(user_roles)──► Role ──(role_permissions)──► Permission
  │                                                       │
  │  "john@example.com"    "Manager"              "users.create"
  │                        "Editor"               "users.edit"
  └── Admin shortcut: user_roles → roles.slug IN ('admin','super_admin') ──► ALL permissions (wildcard *)
```

### 3.2 Permission Resolution Flow

```
1. Login → GET /auth/permissions → stored in Zustand `user.permissions[]`
2. Admin check: user_roles → roles.slug IN ('admin','super_admin') → return [{ slug: '*' }]
3. Non-admin: user_roles → role_permissions → permissions (DISTINCT)
4. Frontend: usePermissions().hasPermission('users.create') → boolean
5. UI: <Can permission="users.create"> → renders or hides children
6. Route: <PermissionRoute permission="users.create"> → renders or redirects
```

### 3.3 Permission Naming Convention

Permissions follow a `{resource}.{action}` pattern:

| Slug | Description |
|------|-------------|
| `users.create` | Create users |
| `users.edit` | Edit users |
| `users.delete` | Delete users |
| `roles.create` | Create roles |
| `roles.edit` | Edit roles |
| `roles.delete` | Delete roles |
| `permissions.manage` | Manage permissions on roles |
| `contacts.view` | View contacts |
| `invoices.create` | Create invoices |

Permissions are grouped by `permission_group` (e.g., "Users", "Roles", "Contacts").

---

## 4. User Guide

### 4.1 Role Management (System → Roles)

1. **View roles:** DataTable shows name, slug, description, permission count, actions
2. **Create role:** Click "Add New Role" → fill name, slug, description → Submit
3. **Edit role:** Click pencil icon → modify fields → Submit
4. **Delete role:** Click trash icon → confirm → role + role_permissions + user_roles deleted
5. **Manage permissions:** Click "Permissions" button → modal with grouped permissions → toggle Add/Remove

### 4.2 Permission Management (System → Permissions)

1. **View permissions:** Read-only DataTable with group badges, search, and group filter
2. **Filter by group:** Select dropdown to show only permissions in a specific group
3. **Search:** Type to filter by name, slug, or description

### 4.3 Permission Sync

The PermissionSync component allows syncing permissions defined in code to the database:

1. Click "Preview Changes" → shows what will be created, updated, or deleted
2. Click "Sync Now" → creates/updates permissions
3. "Sync & Delete" → also removes unregistered permissions from DB

### 4.4 Using Permissions in Custom Pages

```tsx
// Method 1: Component-level gating
import Can from '../../components/Can';
<Can permission="invoices.create"><CreateButton /></Can>

// Method 2: Hook for conditional logic
const { hasPermission, isAdmin } = usePermissions();
if (hasPermission('invoices.create')) { ... }

// Method 3: Route-level protection
<PermissionRoute permission="invoices.view"><InvoicesPage /></PermissionRoute>
```

---

## 5. Features

| Feature | Status | Description |
|---------|--------|-------------|
| Role CRUD | ✅ Active | Create, read, update, delete roles |
| Permission CRUD | ✅ Active | Create, read, update, delete permissions |
| Role-Permission assignment | ✅ Active | Toggle permissions on/off per role via modal |
| Role-User assignment | ✅ Active | Assign/remove roles to users |
| Permission resolution | ✅ Active | user_roles → role_permissions → permissions chain |
| Admin wildcard | ✅ Active | Team admins get `*` (all permissions) |
| Frontend gating (Can) | ✅ Active | Component-level permission checking |
| Route protection | ✅ Active | PermissionRoute redirects unauthorized users |
| Permission grouping | ✅ Active | Permissions organized by `permission_group` |
| Permission sync | ✅ Active | Code-to-DB sync with preview |
| Group filtering | ✅ Active | Filter permissions by group on Permissions page |
| Role-based dashboard | 🟡 Partial | ADMIN → admin dashboard, but no role-specific dashboards |
| Audit trail | ❌ Missing | No logging of permission changes |
| Permission caching | ❌ Missing | Permissions fetched on every login/refresh |

---

## 6. Security Considerations

- **Frontend-only enforcement:** `<Can>` and `usePermissions` hide UI elements but don't prevent API calls
- **Backend gap:** No `requirePermission` middleware exists — all CRUD routes only check JWT, not permissions 🔴
- **Admin escalation:** Staff (is_staff) are treated as admin in `usePermissions.isAdmin()` — both return true 🟡
- **Slug uniqueness:** Enforced on creation for both roles and permissions
- **No immutable roles:** System roles (e.g., "Administrator") can be deleted, breaking the system
- **Permission sync:** Can delete permissions from DB if "Sync & Delete" is used — breaks existing role assignments

---

## 7. Configuration

No module-specific configuration. Uses standard JWT and database settings.

---

## 8. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| User can't see button despite having permission | Permission slug mismatch | Check exact slug in `<Can permission="...">` matches DB |
| Admin staff can see everything | `isAdmin()` returns true for both admin AND staff | Intentional design — use `isStrictAdmin()` if needed |
| Permission count shows 0 | Permissions not assigned to role | Use "Manage Permissions" modal to assign |
| "Role slug already exists" on create | Duplicate slug | Use a different slug |
| Permissions not updating after sync | Stale permissions in Zustand store | Refresh page or call `GET /auth/permissions` |
| PermissionRoute redirects to "/" | User lacks required permission | Assign appropriate role with needed permissions |

---

## 9. Related Modules

- [Authentication](../Authentication/README.md) — Permission loading during login
- [Users](../Users/README.md) — Role assignment on user create/edit
- [Settings](../Settings/README.md) — System configuration
