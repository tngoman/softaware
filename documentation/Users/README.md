# Users Module

**Version:** 1.0.0  
**Last Updated:** 2026-03-02  
**Status:** ✅ Active — Core system module

---

## 1. Purpose

The Users module provides system-level user management (admin CRUD) and user self-service (profile, password change, team view). It serves two distinct audiences:

- **Admins/Staff** use the System Users page to create, edit, and delete user accounts
- **All authenticated users** use the Profile and Account Settings pages to manage their own information

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │  system/Users.tsx │  │ Profile.tsx  │  │ AccountSettings   │ │
│  │  (Admin CRUD)     │  │ (Self-edit)  │  │ (Change Password) │ │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬──────────┘ │
│           │                    │                    │            │
│  ┌────────┴───────────────────┴────────────────────┴──────────┐ │
│  │           SystemModels.ts  /  AuthModel.ts                 │ │
│  │  UserModel.getAll/create/update/delete                     │ │
│  │  AuthModel.updateProfile / changePassword                  │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │ Axios (Bearer JWT)
┌─────────────────────────────┼───────────────────────────────────┐
│                    Backend (Express)                             │
│                              │                                  │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │                    requireAuth middleware                  │   │
│  └───────────┬──────────────────────────┬───────────────────┘   │
│              │                          │                        │
│  ┌───────────┴──────────┐  ┌───────────┴──────────────────┐    │
│  │  systemUsers.ts      │  │  profile.ts                   │    │
│  │  /users CRUD         │  │  /profile self-service        │    │
│  │  (Admin operations)  │  │  (User's own account)         │    │
│  └───────────┬──────────┘  └───────────┬──────────────────┘    │
│              │                          │                        │
│  ┌───────────┴──────────────────────────┴───────────────────┐   │
│  │              MySQL (users, team_members, ...)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Concepts

### 3.1 Admin User Management vs Self-Service

| Aspect | Admin (systemUsers.ts) | Self-Service (profile.ts) |
|--------|----------------------|--------------------------|
| Route prefix | `/users` | `/profile` |
| Who uses it | Admin/Staff via System Users page | Any authenticated user |
| Can edit others | ✅ Yes | ❌ Only self |
| Can delete | ✅ Yes (not self) | ❌ No |
| Can set roles | ✅ Yes (via frontend) | ❌ No |
| Password change | ✅ Set directly (no current password) | ✅ Requires current password |
| Zod validation | ❌ Manual checks | ✅ Zod schemas |

### 3.2 User Type Hierarchy

```
ADMIN     → Full system access, admin dashboard, all modules
STAFF     → Staff dashboard, assigned modules
OPERATOR  → Default role, limited access (based on permissions)
```

User type is derived from `user_roles` → `roles.slug` (not a field on the users table). The `is_admin` and `is_staff` flags in the frontend are derived from role slugs: `admin`/`super_admin` → `is_admin`, `developer`/`client_manager`/`qa_specialist`/`deployer` → `is_staff`.

### 3.3 Name Handling

The backend stores a single `name` field. The frontend works with `first_name` and `last_name`. The `mapUser()` function splits/joins:

```typescript
const nameParts = (u.name || '').split(' ');
return {
  first_name: nameParts[0] || '',
  last_name: nameParts.slice(1).join(' ') || '',
};
```

---

## 4. User Guide

### 4.1 System Users Page (Admin)

1. Navigate to **System → Users** in the admin sidebar
2. **View:** DataTable with columns: User, Email, Role, Status, Type, Actions
3. **Search:** Type in the search bar to filter users (client-side)
4. **Create:** Click "Add New User" → fill form → Submit
5. **Edit:** Click pencil icon → modify fields → Submit
6. **Delete:** Click trash icon → confirm via SweetAlert → user removed

### 4.2 Profile Page (Self-Service)

1. Navigate to **Profile** in the user menu
2. View your avatar, name, email, and role badge
3. Edit username, email, first/last name, phone
4. Click "Save Changes"

### 4.3 Account Settings (Password Change)

1. Navigate to **Account Settings**
2. Enter current password for verification
3. Enter new password (8+ chars, password strength meter shown)
4. Confirm new password
5. Click "Change Password"

### 4.4 Mobile Profile API

The `/profile` endpoints also serve the mobile app with enriched data:
- `GET /profile` — returns user + team + subscription + credits
- `PUT /profile` — update name, phone, avatarUrl
- `POST /profile/change-password` — change password
- `GET /profile/team` — team details with all members
- `GET /profile/api-keys` — masked API key listing
- `GET /profile/invoices` — team billing history

---

## 5. Features

| Feature | Status | Description |
|---------|--------|-------------|
| User CRUD | ✅ Active | Admin create/read/update/delete users |
| Role assignment | ✅ Active | Assign/change roles via edit form |
| Profile self-edit | ✅ Active | Users edit own name, email, phone |
| Password change | ✅ Active | Change with current password verification |
| Password strength | ✅ Active | Frontend strength meter with requirements |
| Team info | ✅ Active | View team details and members |
| API key listing | ✅ Active | View own masked API keys |
| Invoice history | ✅ Active | View team billing invoices |
| Avatar support | 🟡 Partial | Display only; no upload endpoint |
| User search | 🟡 Client-side | No server-side search/pagination |
| Activity log | ❌ Missing | No user activity audit trail |
| Bulk operations | ❌ Missing | No bulk enable/disable/delete |

---

## 6. Security Considerations

- **Authentication:** All endpoints require JWT via `requireAuth` middleware
- **Authorization:** No permission checks on systemUsers routes — any authenticated user can CRUD others 🔴
- **Self-deletion protection:** Cannot delete yourself (`if (id === userId) throw badRequest`)
- **Password hashing:** bcrypt with cost factor 12
- **Profile validation:** Zod schemas on profile.ts endpoints; manual checks on systemUsers.ts
- **SQL injection:** Parameterized queries throughout
- **API key masking:** Only last 8 characters shown (`****${k.key.slice(-8)}`)

---

## 7. Configuration

No module-specific configuration. Uses global settings from `env.ts`:

| Variable | Used For |
|----------|----------|
| `JWT_SECRET` | Token verification via requireAuth |
| `DATABASE_URL` | MySQL connection |

---

## 8. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "User not found" on profile | Token userId doesn't match any DB row | Check JWT, verify user exists |
| Name shows wrong split | Name has >2 parts (e.g., "Van Der Berg") | Last name is everything after first space — working as intended |
| Role not saving on create | Role assigned separately via SystemRoleModel | Check that frontend calls `assignToUser` after create |
| "Cannot delete yourself" | Self-deletion protection | Log in as different admin to delete |
| Profile update returns old data | Frontend not refreshing state | `setUser()` should be called with updated data |
| Collation errors on user_roles | DB character set mismatch | See Crosscutting/Infrastructure CHANGES.md §2.6 |

---

## 9. Related Modules

- [Authentication](../Authentication/README.md) — Login, registration, JWT issuance
- [Roles](../Roles/README.md) — Role and permission management
- [Teams](../Teams/README.md) — Team membership and structure
- [Settings](../Settings/README.md) — System settings management
