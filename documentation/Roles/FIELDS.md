# Roles & Permissions Module - Database Fields

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

| Table | Module Role | Operations |
|-------|------------|------------|
| `roles` | Primary | CRUD |
| `permissions` | Primary | CRUD |
| `role_permissions` | Junction | Create / Delete |
| `user_roles` | Junction | Create / Delete |
| `user_roles` | Core | Read/Write (role assignment) |

---

## 2. Table: `roles`

```sql
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | FK target for user_roles, role_permissions |
| `name` | VARCHAR(255) | NOT NULL | Display name (e.g., "Manager", "Editor") |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | Machine identifier (e.g., "manager", "editor") |
| `description` | TEXT | NULL | Optional role description |
| `created_at` | DATETIME | DEFAULT NOW | Display, sorting |
| `updated_at` | DATETIME | AUTO UPDATE | Timestamp tracking |

**Virtual Column (via subquery):**

| Field | Source | Description |
|-------|--------|-------------|
| `permission_count` | `COUNT(*) FROM role_permissions WHERE role_id = r.id` | Number of permissions assigned — returned by GET /roles |

---

## 3. Table: `permissions`

```sql
CREATE TABLE permissions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  slug             VARCHAR(255) NOT NULL UNIQUE,
  description      TEXT NULL,
  permission_group VARCHAR(100) NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | FK target for role_permissions |
| `name` | VARCHAR(255) | NOT NULL | Display name (e.g., "Create Users") |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | Machine identifier (e.g., "users.create") |
| `description` | TEXT | NULL | Optional description |
| `permission_group` | VARCHAR(100) | NULL | Grouping label (e.g., "Users", "Roles", "Contacts") |
| `created_at` | DATETIME | DEFAULT NOW | Display |
| `updated_at` | DATETIME | AUTO UPDATE | Timestamp tracking |

**Known Permission Groups:**

| Group | Example Permissions |
|-------|-------------------|
| Users | users.create, users.edit, users.delete |
| Roles | roles.create, roles.edit, roles.delete |
| Permissions | permissions.manage |
| Contacts | contacts.view, contacts.create, contacts.edit, contacts.delete |
| Invoices | invoices.create, invoices.edit, invoices.delete |
| Quotations | quotations.create, quotations.edit, quotations.delete |
| Settings | settings.view, settings.edit |
| Credentials | credentials.view, credentials.edit |
| Categories | categories.create, categories.edit |
| Pricing | pricing.view, pricing.edit |
| Transactions | transactions.view |
| Reports | reports.view |

---

## 4. Junction Table: `role_permissions`

```sql
CREATE TABLE role_permissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  UNIQUE KEY uq_role_perm (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Row identifier |
| `role_id` | INT | FK → roles.id, NOT NULL | Links to role |
| `permission_id` | INT | FK → permissions.id, NOT NULL | Links to permission |

**Operations:**
- Created via `POST /permissions/:id/assign` with `{ role_id }`
- Deleted via `POST /permissions/:id/remove` with `{ role_id }`
- Also: all rows deleted when parent role or permission is deleted

---

## 5. Junction Table: `user_roles`

```sql
CREATE TABLE user_roles (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role_id INT NOT NULL,
  UNIQUE KEY uq_user_role (user_id, role_id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

| Column | Type | Constraints | Module Usage |
|--------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Row identifier |
| `user_id` | VARCHAR(36) | NOT NULL | Links to users.id (UUID) |
| `role_id` | INT | FK → roles.id, NOT NULL | Links to role |

**Operations:**
- Created via `POST /roles/:id/assign` with `{ user_id }`
- Deleted via `POST /roles/:id/remove` with `{ user_id }`
- Also: all rows for role deleted when role is deleted; all rows for user deleted when user is deleted

**Note:** `user_id` is VARCHAR(36) (UUID) but `role_id` is INT (auto-increment). This type mismatch is because the users table uses UUIDs while roles uses auto-increment IDs.

---

## 6. Permission Resolution Query

The `/permissions/user` endpoint resolves the current user's permissions:

**For Admins (user_roles → roles.slug IN ('admin','super_admin')):**

```sql
-- Returns wildcard: [{ id: 1, name: 'All Access', slug: '*' }]
SELECT r.slug FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = ? AND r.slug IN ('admin', 'super_admin')
LIMIT 1
-- If row found → return static wildcard
```

**For Non-Admins:**

```sql
SELECT DISTINCT p.*
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN user_roles ur ON ur.role_id = rp.role_id
WHERE ur.user_id = ?
ORDER BY p.permission_group, p.name
```

**Resolution chain:** `user_roles.user_id` → `user_roles.role_id` → `role_permissions.role_id` → `role_permissions.permission_id` → `permissions`

---

## 7. Entity Relationship Diagram

```
┌──────────┐       ┌──────────────┐       ┌──────────────┐
│  users   │       │  user_roles  │       │    roles     │
│──────────│       │──────────────│       │──────────────│
│ id (PK)  │◄──────│ user_id (FK) │       │ id (PK)     │
│ email    │       │ role_id (FK) │──────►│ name        │
│ name     │       └──────────────┘       │ slug        │
└──────────┘                              │ description │
                                          └──────┬───────┘
                                                 │
                   ┌──────────────────┐          │
                   │ role_permissions  │          │
                   │──────────────────│          │
                   │ role_id (FK)     │◄─────────┘
                   │ permission_id(FK)│──────►┌──────────────────┐
                   └──────────────────┘       │   permissions    │
                                              │──────────────────│
                                              │ id (PK)          │
                                              │ name             │
                                              │ slug             │
                                              │ permission_group │
                                              └──────────────────┘
```

---

## 8. Index Recommendations

| Table | Suggested Index | Reason |
|-------|----------------|--------|
| `role_permissions` | `idx_rp_role_id` | Permission lookup by role |
| `role_permissions` | `idx_rp_permission_id` | Role lookup by permission |
| `user_roles` | `idx_ur_user_id` | Role lookup by user |
| `user_roles` | `idx_ur_role_id` | User lookup by role |
| `permissions` | `idx_perm_group` | Group filtering/ordering |
