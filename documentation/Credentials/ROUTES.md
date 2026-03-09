# Credentials Module — API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

The Credentials module exposes **10 API endpoints** in a single route file:

| Route File | Base Path | Endpoints | Description |
|------------|-----------|-----------|-------------|
| systemCredentials.ts | /api/credentials | 10 | CRUD, deactivate, rotate, test, expiry monitoring |

**Base URL:** `https://api.softaware.net.za`

**Authentication:**
- 🔑 `requireAuth` (JWT) on all endpoints — any authenticated user
- ⚠️ No `requireAdmin` enforcement at the API level (frontend gates with `<AdminRoute>`)

---

## 2. Endpoint Directory

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | /api/credentials | JWT | List all credentials (masked by default) |
| 2 | GET | /api/credentials/expired | JWT | List expired credentials |
| 3 | GET | /api/credentials/expiring | JWT | List credentials expiring within 30 days |
| 4 | GET | /api/credentials/:id | JWT | Get single credential (masked unless `?decrypt=true`) |
| 5 | POST | /api/credentials | JWT | Create new credential |
| 6 | PUT | /api/credentials/:id | JWT | Update credential |
| 7 | DELETE | /api/credentials/:id | JWT | Hard delete credential |
| 8 | POST | /api/credentials/:id/deactivate | JWT | Soft delete (set `is_active=0`) |
| 9 | POST | /api/credentials/:id/rotate | JWT | Rotate credential value |
| 10 | POST | /api/credentials/:id/test | JWT | Test credential validity |

### Missing Endpoints (called by frontend but not implemented)

| Method | Path | Frontend Caller | Status |
|--------|------|-----------------|--------|
| GET | /api/credentials/service/:serviceName | `CredentialModel.getByService()` | ❌ Not implemented |
| GET | /api/credentials/search?q=... | `CredentialModel.search()` | ❌ Not implemented |

---

## 3. Endpoint Details

### 3.1 GET /api/credentials

**Purpose:** List all credentials. Values are masked by default.

**Authentication:** JWT (requireAuth)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| decrypt | string | `'false'` | Set to `'true'` to return unmasked values |
| type | string | — | Filter by `credential_type` (e.g. `api_key`, `password`) |
| environment | string | — | Filter by `environment` (e.g. `production`, `all`) |

**Request:**
```bash
curl -X GET https://api.softaware.net.za/api/credentials \
  -H "Authorization: Bearer <jwt>"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service_name": "SMS",
      "credential_type": "api_key",
      "identifier": "ApiKey",
      "credential_value": "••••••••",
      "additional_data": "(encrypted)",
      "environment": "all",
      "expires_at": null,
      "is_active": 1,
      "notes": null,
      "created_by": null,
      "updated_by": null,
      "last_used_at": "2026-03-04T12:00:00.000Z",
      "created_at": "2026-03-01T00:00:00.000Z",
      "updated_at": "2026-03-04T12:00:00.000Z"
    }
  ]
}
```

**With `?decrypt=true`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "service_name": "SMS",
      "credential_value": "0d517784-f5c8-452f-8b87-dec6914ce23c",
      "additional_data": { "secret": "your-api-secret-here" }
    }
  ]
}
```

**Database Query:**
```sql
SELECT * FROM credentials WHERE 1=1
  [AND credential_type = ?]
  [AND environment = ?]
ORDER BY service_name
```

---

### 3.2 GET /api/credentials/expired

**Purpose:** List all active credentials that have passed their `expires_at` date.

**Authentication:** JWT (requireAuth)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/api/credentials/expired \
  -H "Authorization: Bearer <jwt>"
```

**Response (200):**
```json
{
  "success": true,
  "data": []
}
```

**Database Query:**
```sql
SELECT * FROM credentials
WHERE expires_at IS NOT NULL
  AND expires_at < NOW()
  AND is_active = 1
ORDER BY expires_at
```

---

### 3.3 GET /api/credentials/expiring

**Purpose:** List active credentials expiring within the next 30 days.

**Authentication:** JWT (requireAuth)

**Database Query:**
```sql
SELECT * FROM credentials
WHERE expires_at IS NOT NULL
  AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
  AND is_active = 1
ORDER BY expires_at
```

---

### 3.4 GET /api/credentials/:id

**Purpose:** Get a single credential by ID. Values masked unless `?decrypt=true`.

**Authentication:** JWT (requireAuth)

**Side Effect:** Updates `last_used_at = NOW()` on every call.

**Request:**
```bash
curl -X GET https://api.softaware.net.za/api/credentials/1?decrypt=true \
  -H "Authorization: Bearer <jwt>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "service_name": "SMS",
    "credential_type": "api_key",
    "identifier": "ApiKey",
    "credential_value": "0d517784-f5c8-452f-8b87-dec6914ce23c",
    "additional_data": null,
    "environment": "all",
    "is_active": 1
  }
}
```

**Error (404):**
```json
{ "error": "Credential not found" }
```

---

### 3.5 POST /api/credentials

**Purpose:** Create a new credential.

**Authentication:** JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| service_name | string | YES | Logical service name (e.g. `SMS`, `Stripe`) |
| credential_type | string | NO | Default: `api_key`. One of the ENUM values |
| identifier | string | NO | Optional label |
| credential_value | string | YES | The secret value |
| additional_data | object | NO | Arbitrary JSON metadata |
| environment | string | NO | Default: `production` |
| expires_at | string | NO | ISO 8601 datetime |
| notes | string | NO | Free-form notes |

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/credentials \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "Stripe",
    "credential_type": "api_key",
    "identifier": "SecretKey",
    "credential_value": "sk_live_...",
    "additional_data": { "publishable_key": "pk_live_..." },
    "environment": "production"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "service_name": "Stripe",
    "credential_type": "api_key",
    "identifier": "SecretKey",
    "credential_value": "sk_live_...",
    "environment": "production",
    "is_active": 1,
    "created_by": "user-uuid-here"
  }
}
```

**⚠️ Note:** The value is stored **as-is** (plaintext). The route does NOT call `encryptPassword()`. See PATTERNS.md.

---

### 3.6 PUT /api/credentials/:id

**Purpose:** Update an existing credential. Only provided fields are updated.

**Authentication:** JWT (requireAuth)

**Request Body:** Same fields as POST (all optional). Additionally:

| Field | Type | Description |
|-------|------|-------------|
| is_active | number | 0 or 1 to toggle active state |

**Side Effect:** Sets `updated_by` to the current user.

---

### 3.7 DELETE /api/credentials/:id

**Purpose:** Permanently delete a credential row.

**Authentication:** JWT (requireAuth)

**Response (200):**
```json
{ "success": true, "message": "Credential deleted" }
```

---

### 3.8 POST /api/credentials/:id/deactivate

**Purpose:** Soft-delete a credential by setting `is_active = 0`.

**Authentication:** JWT (requireAuth)

**Response (200):**
```json
{ "success": true, "message": "Credential deactivated" }
```

---

### 3.9 POST /api/credentials/:id/rotate

**Purpose:** Replace the credential value with a new one.

**Authentication:** JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| new_value | string | NO | The new credential value. If omitted, returns a prompt |

**With `new_value`:**
```json
{ "success": true, "message": "Credential rotated" }
```

**Without `new_value`:**
```json
{
  "success": true,
  "message": "Provide new_value to complete rotation",
  "data": { "id": 1, "service_name": "SMS" }
}
```

**⚠️ Note:** The rotate endpoint stores the `new_value` in `credential_value` as-is, but the request body field is `new_value` while the frontend sends `new_credential_value` — a mismatch. See PATTERNS.md.

---

### 3.10 POST /api/credentials/:id/test

**Purpose:** Basic validity check (does not call the external service).

**Authentication:** JWT (requireAuth)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "is_active": true,
    "is_expired": false,
    "has_value": true
  }
}
```

**Checks performed:**
1. `is_active === 1`
2. `credential_value` is not empty
3. `expires_at` (if set) has not passed
