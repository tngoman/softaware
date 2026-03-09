# Roles & Permissions Module - API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Route Summary

### Roles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/roles` | JWT | List all roles with permission counts |
| GET | `/roles/:id` | JWT | Get role with full permissions array |
| POST | `/roles` | JWT | Create role |
| PUT | `/roles/:id` | JWT | Update role |
| DELETE | `/roles/:id` | JWT | Delete role (cascading) |
| POST | `/roles/:id/assign` | JWT | Assign role to user |
| POST | `/roles/:id/remove` | JWT | Remove role from user |

### Permissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/permissions` | JWT | List all permissions |
| GET | `/permissions/user` | JWT | Get current user's resolved permissions |
| GET | `/permissions/:id` | JWT | Get single permission |
| POST | `/permissions` | JWT | Create permission |
| PUT | `/permissions/:id` | JWT | Update permission |
| DELETE | `/permissions/:id` | JWT | Delete permission (cascading) |
| POST | `/permissions/:id/assign` | JWT | Assign permission to role |
| POST | `/permissions/:id/remove` | JWT | Remove permission from role |

---

## 2. Roles Endpoints

### 2.1 GET /roles — List All Roles

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Manager",
      "slug": "manager",
      "description": "Can manage team resources",
      "permission_count": 12,
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-06-20T14:00:00.000Z"
    }
  ]
}
```

**Note:** `permission_count` is a virtual field calculated via subquery `COUNT(*) FROM role_permissions`.

---

### 2.2 GET /roles/:id — Get Role with Permissions

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Manager",
    "slug": "manager",
    "description": "Can manage team resources",
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-06-20T14:00:00.000Z",
    "permissions": [
      {
        "id": 1,
        "name": "Create Users",
        "slug": "users.create",
        "description": "Allows creating new users",
        "permission_group": "Users",
        "created_at": "2025-01-01T00:00:00.000Z",
        "updated_at": "2025-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 2.3 POST /roles — Create Role

**Request:**

```bash
curl -X POST http://localhost:3000/roles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Editor",
    "slug": "editor",
    "description": "Can edit content"
  }'
```

**Required Fields:** `name`  
**Optional Fields:** `slug` (auto-generated from name if omitted), `description`

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Editor",
    "slug": "editor",
    "description": "Can edit content",
    "created_at": "2026-03-02T12:00:00.000Z"
  }
}
```

**Error (400):** `{ "error": "Role slug already exists" }`

---

### 2.4 PUT /roles/:id — Update Role

**Request:**

```bash
curl -X PUT http://localhost:3000/roles/2 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Senior Editor", "description": "Can edit and publish content" }'
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Senior Editor",
    "slug": "editor",
    "description": "Can edit and publish content"
  }
}
```

---

### 2.5 DELETE /roles/:id — Delete Role

**Response (200):**

```json
{ "success": true, "message": "Role deleted" }
```

**Cascade Order:**
1. Delete `role_permissions WHERE role_id = ?`
2. Delete `user_roles WHERE role_id = ?`
3. Delete `roles WHERE id = ?`

---

### 2.6 POST /roles/:id/assign — Assign Role to User

**Request:**

```bash
curl -X POST http://localhost:3000/roles/1/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "abc-123" }'
```

**Response (200):**

```json
{ "success": true, "message": "Role assigned" }
```

**Business Logic:**
- Idempotent — if user already has the role, no error, no duplicate
- Checks that role exists first (404 if not)

---

### 2.7 POST /roles/:id/remove — Remove Role from User

**Request:**

```bash
curl -X POST http://localhost:3000/roles/1/remove \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "user_id": "abc-123" }'
```

**Response (200):**

```json
{ "success": true, "message": "Role removed" }
```

---

## 3. Permissions Endpoints

### 3.1 GET /permissions — List All Permissions

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Create Users",
      "slug": "users.create",
      "description": "Allows creating new user accounts",
      "permission_group": "Users",
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Ordering:** `ORDER BY permission_group, name`

---

### 3.2 GET /permissions/user — Get Current User's Permissions

This is the key permission resolution endpoint called after login.

**Response for Admin (200):**

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "All Access", "slug": "*" }
  ]
}
```

**Response for Non-Admin (200):**

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Create Users", "slug": "users.create", "permission_group": "Users" },
    { "id": 2, "name": "Edit Users", "slug": "users.edit", "permission_group": "Users" },
    { "id": 5, "name": "View Contacts", "slug": "contacts.view", "permission_group": "Contacts" }
  ]
}
```

**Resolution Logic:**
1. Check `user_roles` → `roles.slug` for userId
2. If slug IN (`'admin'`, `'super_admin'`) → return wildcard `[{ slug: '*' }]`
3. Else → `user_roles → role_permissions → permissions` (DISTINCT)

---

### 3.3 POST /permissions — Create Permission

**Request:**

```bash
curl -X POST http://localhost:3000/permissions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "View Reports",
    "slug": "reports.view",
    "description": "Allows viewing financial reports",
    "permission_group": "Reports"
  }'
```

**Required:** `name`, `slug`  
**Optional:** `description`, `permission_group`

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": 15,
    "name": "View Reports",
    "slug": "reports.view",
    "permission_group": "Reports"
  }
}
```

---

### 3.4 DELETE /permissions/:id — Delete Permission

**Response (200):**

```json
{ "success": true, "message": "Permission deleted" }
```

**Cascade:** Deletes from `role_permissions` first, then `permissions`.

---

### 3.5 POST /permissions/:id/assign — Assign Permission to Role

**Request:**

```bash
curl -X POST http://localhost:3000/permissions/1/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "role_id": 2 }'
```

**Response (200):**

```json
{ "success": true, "message": "Permission assigned to role" }
```

**Business Logic:** Idempotent — skips if permission-role pair already exists.

---

### 3.6 POST /permissions/:id/remove — Remove Permission from Role

**Request:**

```bash
curl -X POST http://localhost:3000/permissions/1/remove \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "role_id": 2 }'
```

**Response (200):**

```json
{ "success": true, "message": "Permission removed from role" }
```

---

## 4. Frontend API Client Reference

From `SystemModels.ts`:

```typescript
// Role operations
SystemRoleModel.getAll()                          → GET /roles
SystemRoleModel.getById(id)                       → GET /roles/:id
SystemRoleModel.create(data)                      → POST /roles
SystemRoleModel.update(id, data)                  → PUT /roles/:id
SystemRoleModel.delete(id)                        → DELETE /roles/:id
SystemRoleModel.assignToUser(roleId, userId)      → POST /roles/:id/assign
SystemRoleModel.removeFromUser(roleId, userId)    → POST /roles/:id/remove

// Permission operations
SystemPermissionModel.getAll()                    → GET /permissions
SystemPermissionModel.getById(id)                 → GET /permissions/:id
SystemPermissionModel.create(data)                → POST /permissions
SystemPermissionModel.update(id, data)            → PUT /permissions/:id
SystemPermissionModel.delete(id)                  → DELETE /permissions/:id
SystemPermissionModel.assignToRole(permId, roleId)→ POST /permissions/:id/assign
SystemPermissionModel.removeFromRole(permId, rId) → POST /permissions/:id/remove
SystemPermissionModel.getUserPermissions()        → GET /permissions/user
```
