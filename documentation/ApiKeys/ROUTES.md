# API Keys Module — API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 4 |
| **Router mount** | `/api/api-keys` |
| **Auth** | All routes require JWT (`requireAuth`) |
| **Scope** | User can only manage their own keys |

---

## 2. Endpoint Directory

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/api/api-keys` | List user's API keys (masked) |
| 2 | POST | `/api/api-keys` | Generate a new API key |
| 3 | DELETE | `/api/api-keys/:id` | Delete an API key |
| 4 | PATCH | `/api/api-keys/:id/toggle` | Toggle key active / inactive |

---

## 3. Endpoints

### 3.1 GET `/api/api-keys`

**Purpose:** List all API keys for the authenticated user. Key values are masked except last 8 characters.

**Auth:** JWT required

**Response (200):**
```json
{
  "apiKeys": [
    {
      "id": "clx9abc123...",
      "name": "Desktop App",
      "key": "****a1b2c3d4",
      "isActive": true,
      "lastUsedAt": "2026-03-04T10:30:00.000Z",
      "createdAt": "2026-02-01T08:00:00.000Z",
      "expiresAt": null
    },
    {
      "id": "clx9def456...",
      "name": "CI Pipeline",
      "key": "****e5f6g7h8",
      "isActive": false,
      "lastUsedAt": "2026-01-15T12:00:00.000Z",
      "createdAt": "2026-01-01T09:00:00.000Z",
      "expiresAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

**Notes:**
- Keys are always masked to `****<last8>` in list responses
- Sorted by `createdAt DESC` (newest first)
- Returns all keys regardless of `isActive` status

---

### 3.2 POST `/api/api-keys`

**Purpose:** Generate a new API key. **This is the only time the full key is returned.**

**Auth:** JWT required

**Request Body:**
```json
{
  "name": "Desktop App",
  "expiresInDays": 90
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | 1–100 chars |
| `expiresInDays` | number | ❌ | Positive integer; omit for no expiry |

**Response (200):**
```json
{
  "id": "clx9abc123...",
  "name": "Desktop App",
  "key": "7f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a",
  "isActive": true,
  "createdAt": "2026-03-04T11:00:00.000Z",
  "expiresAt": "2026-06-02T11:00:00.000Z",
  "warning": "Save this key! It will not be shown again."
}
```

**Error (400):**
```json
{ "error": "Validation error", "details": [...] }
```

**Notes:**
- Key is 64-character hex string (`crypto.randomBytes(32)`)
- Full key is **only** returned in this response — never again
- Frontend should prompt user to copy immediately

---

### 3.3 DELETE `/api/api-keys/:id`

**Purpose:** Permanently delete an API key. Any external client using this key will immediately lose access.

**Auth:** JWT required

**Path Params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | API key ID |

**Response (200):**
```json
{ "success": true, "message": "API key deleted" }
```

**Error (404):**
```json
{ "error": "API key not found" }
```

**Notes:**
- Only the owner can delete their own keys (`userId` checked)
- Deletion is permanent — no soft-delete or undo
- Consider using toggle instead if temporary revocation is needed

---

### 3.4 PATCH `/api/api-keys/:id/toggle`

**Purpose:** Toggle the `isActive` flag. Deactivated keys are rejected by `requireApiKey` middleware without deleting them.

**Auth:** JWT required

**Path Params:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | string | API key ID |

**Response (200):**
```json
{
  "id": "clx9abc123...",
  "isActive": false,
  "message": "API key deactivated"
}
```

or

```json
{
  "id": "clx9abc123...",
  "isActive": true,
  "message": "API key activated"
}
```

**Error (404):**
```json
{ "error": "API key not found" }
```

---

## 4. Authentication Middleware — `requireApiKey`

This middleware is defined in `middleware/apiKey.ts` and is **not** an endpoint, but it is the **consumer** of the `api_keys` table.

### How it works

1. Reads key from `x-api-key` header or `?api_key` query param
2. Queries `SELECT * FROM api_keys WHERE \`key\` = ?`
3. Rejects if: not found, `isActive = false`, or `expiresAt < NOW()`
4. Stamps `lastUsedAt = NOW()` on the row
5. Attaches `req.apiKey` (full row) and `req.apiKey.userId` to request

### Usage in routes

```typescript
import { requireApiKey } from '../middleware/apiKey.js';

router.use(requireApiKey);          // All routes in this router
router.get('/data', requireApiKey); // Single route
```

### Error responses from middleware

| Condition | Status | Body |
|-----------|--------|------|
| No key provided | 401 | `{ "error": "API key required" }` |
| Key not found | 401 | `{ "error": "Invalid API key" }` |
| Key inactive | 403 | `{ "error": "API key is inactive" }` |
| Key expired | 403 | `{ "error": "API key has expired" }` |

---

## 5. Error Responses (All Endpoints)

| Status | Cause |
|--------|-------|
| 400 | Zod validation failure (bad name, bad expiresInDays) |
| 401 | Missing or invalid JWT |
| 404 | Key ID not found or doesn't belong to user |
| 500 | Internal server error |
