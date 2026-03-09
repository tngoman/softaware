# Users Module - File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total files | 7 |
| Backend files | 2 |
| Frontend files | 5 |
| Total LOC | ~1,657 |

---

## 2. Backend Files

### 2.1 `backend/src/routes/systemUsers.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/routes/systemUsers.ts` |
| **LOC** | 181 |
| **Purpose** | Admin CRUD endpoints for user management |
| **Exports** | `systemUsersRouter` (Express Router) |
| **Dependencies** | `express`, `bcryptjs`, `db/mysql`, `middleware/auth`, `utils/httpErrors` |

**Key Functions / Handlers:**

| Function | Line | Type | Description |
|----------|------|------|-------------|
| `mapUser(u, membership?, roles?)` | ~14 | Helper | Transforms DB row → frontend user shape (splits name, maps roles) |
| `GET /` | ~38 | Route | List all users with memberships and roles (N+1 queries) |
| `GET /:id` | ~64 | Route | Get single user by ID with membership and roles |
| `POST /` | ~88 | Route | Create user with password hash, team membership, activation key |
| `PUT /:id` | ~127 | Route | Update user fields, optionally update team role |
| `DELETE /:id` | ~163 | Route | Delete user (with self-deletion protection) — cascades: user_roles, team_members, users |

**Code Excerpt — mapUser:**

```typescript
function mapUser(u: any, membership?: any, roles?: any[]): any {
  const nameParts = (u.name || '').split(' ');
  return {
    id: u.id, username: u.email, email: u.email,
    first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '',
    name: u.name || null, phone: u.phone || null, avatar: u.avatarUrl || null,
    is_admin: membership?.role === 'ADMIN',
    is_staff: membership?.role === 'STAFF',
    is_active: true, roles: roles || [],
    created_at: u.createdAt, updated_at: u.updatedAt,
  };
}
```

---

### 2.2 `backend/src/routes/profile.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/routes/profile.ts` |
| **LOC** | 248 |
| **Purpose** | User self-service endpoints (profile, password, team, API keys, invoices) |
| **Exports** | `profileRouter` (Express Router) |
| **Dependencies** | `express`, `zod`, `bcryptjs`, `db/mysql`, `middleware/auth`, `utils/httpErrors` |

**Key Functions / Handlers:**

| Function | Line | Type | Description |
|----------|------|------|-------------|
| `GET /` | ~22 | Route | Get own profile with team, subscription, and credit balance |
| `PUT /` | ~108 | Route | Update own name, phone, avatarUrl (Zod validated) |
| `POST /change-password` | ~156 | Route | Change password (requires current password verification) |
| `GET /team` | ~189 | Route | Get team details with all members |
| `GET /api-keys` | ~222 | Route | List own API keys (masked) |
| `GET /invoices` | ~239 | Route | List team billing invoices (last 50) |

**Code Excerpt — UpdateProfileSchema:**

```typescript
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(512).optional(),
});
```

---

## 3. Frontend Files

### 3.1 `frontend/src/pages/system/Users.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/system/Users.tsx` |
| **LOC** | 353 |
| **Purpose** | Admin user management page with DataTable and CRUD form |
| **Exports** | `Users` (default React component) |
| **Dependencies** | `react`, `@heroicons/react`, `@tanstack/react-table`, `SystemModels`, `UI components`, `Can`, `sweetalert2` |

**Key Functions:**

| Function | Type | Description |
|----------|------|-------------|
| `loadUsers()` | Effect | Fetches all users via `SystemUserModel.getAll()` |
| `loadRoles()` | Effect | Fetches roles for the role dropdown |
| `handleSubmit()` | Handler | Create or update user; assigns role separately |
| `handleEdit(user)` | Handler | Populates form with user data for editing |
| `handleDelete(user)` | Handler | SweetAlert confirmation → delete |
| `columns` | Memo | 6 DataTable column definitions (User, Email, Role, Status, Type, Actions) |

**UI Features:**
- Gradient header with search bar
- DataTable with sortable columns
- Role badge display
- Active/Inactive status badges
- Admin/Staff/User type badges
- Permission-gated Create/Edit/Delete buttons via `<Can>` component

---

### 3.2 `frontend/src/pages/Profile.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/Profile.tsx` |
| **LOC** | 198 |
| **Purpose** | User self-service profile editing page |
| **Exports** | `Profile` (default React component) |
| **Dependencies** | `react`, `react-hook-form`, `@heroicons/react`, `store` (Zustand), `AuthModel`, `sweetalert2` |

**Key Functions:**

| Function | Type | Description |
|----------|------|-------------|
| `onSubmit(data)` | Handler | Calls `AuthModel.updateProfile()`, updates Zustand store |
| `getUserInitials()` | Helper | Generates avatar initials from name or username |

**UI Features:**
- Gradient header with avatar (image or initials)
- Role badge
- Form fields: username, email, first name, last name, phone
- Save button with loading spinner
- Success confirmation via SweetAlert

---

### 3.3 `frontend/src/pages/AccountSettings.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/AccountSettings.tsx` |
| **LOC** | 219 |
| **Purpose** | Password change page with strength indicator |
| **Exports** | `AccountSettings` (default React component) |
| **Dependencies** | `react`, `react-hook-form`, `@heroicons/react`, `AuthModel`, `sweetalert2` |

**Key Functions:**

| Function | Type | Description |
|----------|------|-------------|
| `onSubmit(data)` | Handler | Validates match, calls `AuthModel.changePassword()` |
| `getPasswordStrength(password)` | Helper | Returns strength label, color, and width based on scoring |

**UI Features:**
- Gradient header with shield icon
- Current password field
- New password with real-time strength meter (Weak/Medium/Strong)
- Password requirements checklist (8 chars, upper+lower, number, special)
- Confirm password with match validation
- Security notice about session termination

---

### 3.4 `frontend/src/models/SystemModels.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/models/SystemModels.ts` |
| **LOC** | 271 |
| **Purpose** | API client classes for Users, Roles, Permissions, Settings |
| **Exports** | `UserModel`, `RoleModel`, `PermissionModel`, `SystemSettingModel` + interfaces |

**UserModel Methods (re-exported as SystemUserModel):**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getAll(filters?)` | GET | `/users` | List with optional filters |
| `getById(id)` | GET | `/users/:id` | Single user |
| `create(user)` | POST | `/users` | Create user |
| `update(id, user)` | PUT | `/users/:id` | Update user |
| `delete(id)` | DELETE | `/users/:id` | Delete user |

---

### 3.5 `frontend/src/models/AuthModel.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/models/AuthModel.ts` |
| **LOC** | 138 |
| **Purpose** | Auth API client — profile and password methods used by Users module |

**Profile-Related Methods:**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `updateProfile(data)` | PUT | `/auth/profile` | Update own username, email, name, phone |
| `changePassword(data)` | PUT | `/auth/change-password` | Change password (requires current) |

---

## 4. File Relationship Map

```
systemUsers.ts ─────── /users/*    ──── Users.tsx
                                          ↕ SystemModels.ts (UserModel → SystemUserModel)
profile.ts ─────────── /profile/*  ──── Profile.tsx + AccountSettings.tsx
                                          ↕ AuthModel.ts (updateProfile, changePassword)
```

---

## 5. Test Files

No dedicated test files found for the Users module.
