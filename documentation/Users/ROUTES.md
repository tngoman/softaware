# Users Module - API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Route Summary

### System Users (Admin CRUD)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| GET | `/users` | JWT | — | List all users |
| GET | `/users/:id` | JWT | — | Get single user |
| POST | `/users` | JWT | — | Create user |
| PUT | `/users/:id` | JWT | — | Update user |
| DELETE | `/users/:id` | JWT | — | Delete user |

### Profile (Self-Service)

| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|-----------|-------------|
| GET | `/profile` | JWT | — | Get own profile + team + subscription + credits |
| PUT | `/profile` | JWT | — | Update own profile |
| POST | `/profile/change-password` | JWT | — | Change own password |
| GET | `/profile/team` | JWT | — | Get team details + members |
| GET | `/profile/api-keys` | JWT | — | List own API keys (masked) |
| GET | `/profile/invoices` | JWT | — | List team invoices |

---

## 2. System Users Endpoints

### 2.1 GET /users — List All Users

**Handler:** `systemUsers.ts` → `GET /`

**Request:**

```bash
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "abc-123",
      "username": "john@example.com",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "name": "John Doe",
      "phone": "+27821234567",
      "avatar": "https://example.com/avatar.jpg",
      "is_admin": true,
      "is_staff": false,
      "is_active": true,
      "roles": [
        { "id": "role-1", "name": "Administrator", "slug": "administrator" }
      ],
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-06-20T14:00:00.000Z"
    }
  ]
}
```

**Business Logic:**
- Returns ALL users (no pagination or filtering)
- For each user, 2 additional DB queries run (N+1 problem)
- `is_active` is hardcoded to `true` — no concept of disabled users
- `username` is always equal to `email`

---

### 2.2 GET /users/:id — Get Single User

**Handler:** `systemUsers.ts` → `GET /:id`

**Request:**

```bash
curl -X GET http://localhost:3000/users/abc-123 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "abc-123",
    "username": "john@example.com",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "name": "John Doe",
    "phone": "+27821234567",
    "avatar": null,
    "is_admin": true,
    "is_staff": false,
    "is_active": true,
    "roles": [],
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-06-20T14:00:00.000Z"
  }
}
```

**Error Response (404):**

```json
{ "error": "User not found" }
```

---

### 2.3 POST /users — Create User

**Handler:** `systemUsers.ts` → `POST /`

**Request:**

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "SecurePass123!",
    "name": "Jane Smith",
    "phone": "+27829876543",
    "is_admin": false,
    "is_staff": true
  }'
```

**Required Fields:** `email`, `password`  
**Optional Fields:** `name`, `phone`, `is_admin`, `is_staff`

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "username": "jane@example.com",
    "email": "jane@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "is_admin": false,
    "is_staff": true,
    "is_active": true,
    "roles": [],
    "created_at": "2026-03-02T12:00:00.000Z",
    "updated_at": "2026-03-02T12:00:00.000Z"
  }
}
```

**Business Logic:**
1. Check for existing email → 400 if duplicate
2. Hash password with bcrypt (cost 12)
3. Insert user record
4. Find first team → assign user as ADMIN/STAFF/OPERATOR
5. Return mapped user

**Error Response (400):**

```json
{ "error": "Email already registered" }
```

---

### 2.4 PUT /users/:id — Update User

**Handler:** `systemUsers.ts` → `PUT /:id`

**Request:**

```bash
curl -X PUT http://localhost:3000/users/abc-123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "email": "john.new@example.com",
    "is_admin": true
  }'
```

**Optional Fields:** `email`, `password`, `name`, `phone`, `is_admin`, `is_staff`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "abc-123",
    "username": "john.new@example.com",
    "email": "john.new@example.com",
    "first_name": "John",
    "last_name": "Updated",
    "is_admin": true,
    "is_staff": false,
    "is_active": true,
    "roles": [],
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2026-03-02T12:05:00.000Z"
  }
}
```

**Business Logic:**
1. Verify user exists → 404 if not
2. Build dynamic SET clause from provided fields
3. If password provided, hash with bcrypt
4. Update `updatedAt` timestamp
5. If `is_admin` or `is_staff` changed, update role via `user_roles` table (delete + insert)
6. Return updated mapped user

---

### 2.5 DELETE /users/:id — Delete User

**Handler:** `systemUsers.ts` → `DELETE /:id`

**Request:**

```bash
curl -X DELETE http://localhost:3000/users/abc-123 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{ "success": true, "message": "User deleted" }
```

**Business Logic:**
1. Cannot delete yourself → 400
2. Verify user exists → 404 if not
3. Delete in order: `user_roles` → `team_members` → `users`
4. No soft delete — permanent removal

**Error Responses:**

| Code | Body | Condition |
|------|------|-----------|
| 400 | `{ "error": "Cannot delete yourself" }` | `id === userId` |
| 404 | `{ "error": "User not found" }` | No user with that ID |

---

## 3. Profile Endpoints

### 3.1 GET /profile — Get Own Profile

**Handler:** `profile.ts` → `GET /`

**Request:**

```bash
curl -X GET http://localhost:3000/profile \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "user": {
    "id": "abc-123",
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+27821234567",
    "avatarUrl": null,
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "team": {
    "id": "team-1",
    "name": "My Company",
    "role": "ADMIN"
  },
  "subscription": {
    "id": "sub-1",
    "status": "ACTIVE",
    "tier": "professional",
    "planName": "Professional Plan",
    "trialEndsAt": null,
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z"
  },
  "credits": {
    "balance": 5000,
    "totalPurchased": 10000,
    "totalUsed": 5000
  }
}
```

**Note:** Response shape differs from admin endpoints — no `{ success, data }` wrapper.

---

### 3.2 PUT /profile — Update Own Profile

**Handler:** `profile.ts` → `PUT /`  
**Validation:** Zod schema

**Request:**

```bash
curl -X PUT http://localhost:3000/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe Updated",
    "phone": "+27821111111"
  }'
```

**Accepted Fields (all optional, at least one required):**

| Field | Type | Constraints |
|-------|------|------------|
| `name` | string | 1-255 chars |
| `phone` | string | 1-50 chars |
| `avatarUrl` | string | Valid URL, max 512 chars |

**Response (200):**

```json
{
  "message": "Profile updated",
  "user": {
    "id": "abc-123",
    "email": "john@example.com",
    "name": "John Doe Updated",
    "phone": "+27821111111",
    "avatarUrl": null,
    "updatedAt": "2026-03-02T12:10:00.000Z"
  }
}
```

---

### 3.3 POST /profile/change-password — Change Password

**Handler:** `profile.ts` → `POST /change-password`  
**Validation:** Zod schema

**Request:**

```bash
curl -X POST http://localhost:3000/profile/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123!",
    "newPassword": "NewSecurePass456!"
  }'
```

**Response (200):**

```json
{ "message": "Password changed successfully" }
```

**Error Response (400):**

```json
{ "error": "Current password is incorrect" }
```

**Business Logic:**
1. Fetch full user record (including passwordHash)
2. bcrypt.compare current password
3. Hash new password (cost 12)
4. Update passwordHash and updatedAt

---

### 3.4 GET /profile/team — Get Team Details

**Handler:** `profile.ts` → `GET /team`

**Response (200):**

```json
{
  "team": {
    "id": "team-1",
    "name": "My Company",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "members": [
    {
      "userId": "abc-123",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "ADMIN",
      "joinedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "userId": "def-456",
      "email": "jane@example.com",
      "name": "Jane Smith",
      "role": "STAFF",
      "joinedAt": "2025-02-15T00:00:00.000Z"
    }
  ],
  "myRole": "ADMIN"
}
```

---

### 3.5 GET /profile/api-keys — List API Keys

**Handler:** `profile.ts` → `GET /api-keys`

**Response (200):**

```json
{
  "apiKeys": [
    {
      "id": "key-1",
      "name": "Production Key",
      "keyPreview": "****abcd1234",
      "isActive": true,
      "lastUsedAt": "2026-03-01T08:00:00.000Z",
      "createdAt": "2025-06-01T00:00:00.000Z",
      "expiresAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

---

### 3.6 GET /profile/invoices — List Team Invoices

**Handler:** `profile.ts` → `GET /invoices`

**Response (200):**

```json
{
  "invoices": [
    {
      "id": "inv-1",
      "invoiceNumber": "INV-2026-001",
      "description": "Professional Plan - March 2026",
      "subtotal": 99900,
      "subtotalDisplay": "R999.00",
      "vatAmount": 14985,
      "vatDisplay": "R149.85",
      "total": 114885,
      "totalDisplay": "R1148.85",
      "periodStart": "2026-03-01",
      "periodEnd": "2026-03-31",
      "dueDate": "2026-03-15",
      "paidAt": "2026-03-10T09:00:00.000Z",
      "status": "PAID",
      "pdfUrl": "https://storage.example.com/invoices/inv-1.pdf"
    }
  ]
}
```

**Note:** Amounts are in cents (ZAR). Display values are formatted as `R{amount/100}`.

---

## 4. Response Envelope Inconsistency

| Route Group | Envelope | Example |
|-------------|----------|---------|
| `/users/*` (admin) | `{ success: true, data: ... }` | Standard |
| `/profile` (self) | Direct object (no wrapper) | `{ user, team, subscription, credits }` |
| `/profile/change-password` | `{ message }` | Minimal |
| `/profile/team` | `{ team, members, myRole }` | No wrapper |

⚠️ This inconsistency means frontend code must handle different response shapes depending on which endpoint is called.
