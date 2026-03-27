# Updates & Error Reporting Module — API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-06-10

---

## 1. Overview

| Router | Mount Point | File | Endpoints | Purpose |
|--------|-------------|------|-----------|---------|
| Heartbeat | `/updates/heartbeat` | `updHeartbeat.ts` | 2 | Client heartbeat + lightweight update check |
| Error Report | `/updates/error-report` | `updErrorReport.ts` | 3 | Error ingestion (public) + browsing (admin) |
| Clients | `/updates/clients` | `updClients.ts` | 3 | Admin client management |
| Software | `/updates/software` | `updSoftware.ts` | 4 | Software product CRUD |
| Updates | `/updates/updates` | `updUpdates.ts` | 4 | Release package CRUD |
| Files | `/updates` | `updFiles.ts` | 2 | Upload + download |
| Modules | `/updates/modules` | `updModules.ts` | 7 | Module CRUD + developer assignment |
| Misc | `/updates` | `updMisc.ts` | 10 | Info, dashboard, status, installed, schema, password reset |

**Base URL:** `https://updates.softaware.net.za`

**Authentication:**
- **Public / Client endpoints** — `software_key` via `X-Software-Key` header or body field. No JWT required.
- **Admin endpoints** — JWT Bearer token in `Authorization: Bearer <token>` header via `requireAuth` + `requireAdmin` middleware.
- **Upload endpoint** — API key via `X-API-Key` header OR JWT Bearer token.

**Response Format:** `{ success: boolean, ... }` for most endpoints. Error responses: `{ success: false, error: string }`.

---

## 2. Heartbeat Router — `/updates/heartbeat`

**File:** `updHeartbeat.ts` (319 LOC)  
**Auth:** `software_key` (public)

### 2.1 `POST /` — Client Heartbeat

Full heartbeat — registers/updates client presence, checks for updates, delivers commands.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `software_key` | string | ✅ | Software product key (also accepted via `X-Software-Key` header) |
| `hostname` | string | ✅ | Client machine hostname |
| `machine_name` | string | ❌ | Machine display name (defaults to hostname) |
| `ip_address` | string | ❌ | Client IP (falls back to `req.ip`) |
| `os_info` | string | ❌ | OS description (e.g. "Windows 11 Pro 23H2") |
| `app_version` | string | ❌ | Running application version (e.g. "2.1.0") |
| `current_user` | string | ❌ | Currently logged-in user |
| `recent_errors` | array | ❌ | Piggy-backed errors (same shape as error report) |

**Heartbeat Zod Schema:**
```typescript
z.object({
  software_key: z.string().min(1),
  hostname: z.string().min(1),
  machine_name: z.string().optional(),
  ip_address: z.string().optional(),
  os_info: z.string().optional(),
  app_version: z.string().optional(),
  current_user: z.string().optional(),
  recent_errors: z.array(z.object({
    error_type: z.string().optional(),
    error_level: z.string().optional(),
    error_message: z.string().optional(),
    file: z.string().optional(),
    line: z.number().optional(),
    stack_trace: z.string().optional(),
    url: z.string().optional(),
    method: z.string().optional(),
  })).optional(),
})
```

**Server Logic:**
1. Validate `software_key` → lookup `update_software`
2. Find or INSERT `update_clients` (keyed on `software_id + hostname + machine_name`)
3. If client is **blocked** → return `403 { success: false, blocked: true, reason }`
4. UPDATE client fields (`last_heartbeat = NOW()`, IP, OS, version, user)
5. If `recent_errors` present → call `storeRecentErrors()` helper
6. Check for newer version in `update_releases` (compare `app_version` vs latest `version`)
7. Check for pending `force_logout` or `server_message` → clear after delivery
8. Return response

**Success Response:**
```json
{
  "success": true,
  "client_id": 42,
  "update_available": true,
  "latest_version": "2.2.0",
  "update_id": 15,
  "force_logout": false,
  "server_message": "Scheduled maintenance at 22:00"
}
```

**Blocked Response (403):**
```json
{
  "success": false,
  "blocked": true,
  "reason": "Suspicious activity detected"
}
```

**Side Effects:**
- Creates new client record on first heartbeat
- Stores piggy-backed errors into `error_reports` table
- Upserts `client_error_summaries` (increments `total_errors`, `error_count`, `warning_count`, `notice_count`)
- Clears `force_logout` and `server_message` flags after delivery

---

### 2.2 `GET /check` — Lightweight Update Check

Checks for update availability without full heartbeat registration. Does NOT update `last_heartbeat` or store errors.

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `software_key` | string | ✅ | Via `X-Software-Key` header or query param |
| `current_version` | string | ✅ | Currently installed version |

**Response:**
```json
{
  "success": true,
  "update_available": true,
  "latest_version": "2.2.0",
  "update_id": 15
}
```

---

## 3. Error Report Router — `/updates/error-report`

**File:** `updErrorReport.ts` (284 LOC)  
**Auth:** `software_key` (POST — public), JWT (GET — admin)

### 3.1 `POST /` — Submit Error Report

Public endpoint for clients to report errors.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `software_key` | string | ✅ | Software product key |
| `client_identifier` | string | ❌ | Unique client identifier (hostname or machine ID) |
| `source` | enum | ❌ | `'backend'` \| `'frontend'` \| `'desktop'` \| `'mobile'` |
| `hostname` | string | ❌ | Client hostname |
| `errors` | array | ✅ | Array of error objects |

**Error Object Fields (dual field name support):**

| Field | Alt Field | Type | Description |
|-------|-----------|------|-------------|
| `type` | `error_type` | string | Error type/category |
| `level` | `error_level` | string | `'error'` \| `'warning'` \| `'notice'` |
| `message` | `error_message` | string | Error message text |
| `file` | — | string | Source file path |
| `line` | — | number | Line number |
| `stack_trace` | — | string | Full stack trace |
| `url` | — | string | Request URL (for web errors) |
| `method` | — | string | HTTP method (for web errors) |

> **Note:** The `normalizeError()` function accepts both field name conventions (e.g. `type` or `error_type`) for backward compatibility with different client implementations.

**Response:**
```json
{
  "success": true,
  "stored": 3
}
```

**Side Effects:**
- Inserts one row per error into `error_reports`
- Upserts `client_error_summaries` — increments `total_errors` and level-specific counters (`error_count`, `warning_count`, `notice_count`), updates `last_error_at`

---

### 3.2 `GET /` — List Error Reports (Admin)

**Auth:** JWT (`requireAuth`, `requireAdmin`)

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `software_key` | string | — | Filter by software key |
| `client_identifier` | string | — | Filter by client identifier (exact) |
| `level` | string | — | Filter by error level |
| `source` | string | — | Filter by source |
| `hostname` | string | — | Filter by hostname (LIKE `%hostname%`) |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page |

**Response:**
```json
{
  "success": true,
  "errors": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 237,
    "pages": 5
  }
}
```

---

### 3.3 `GET /summaries` — Client Error Summaries (Admin)

**Auth:** JWT (`requireAuth`, `requireAdmin`)

Returns aggregated error counts per client.

| Query Param | Type | Description |
|-------------|------|-------------|
| `software_key` | string | Filter by software key |

**Response:**
```json
{
  "success": true,
  "summaries": [
    {
      "client_identifier": "DESKTOP-ABC123",
      "hostname": "reception-pc",
      "software_name": "MyApp",
      "total_errors": 42,
      "error_count": 30,
      "warning_count": 10,
      "notice_count": 2,
      "first_error_at": "2026-05-01T08:00:00Z",
      "last_error_at": "2026-06-10T14:30:00Z"
    }
  ]
}
```

---

## 4. Clients Router — `/updates/clients`

**File:** `updClients.ts` (~130 LOC)  
**Auth:** JWT (`requireAuth`, `requireAdmin`) — all endpoints

### 4.1 `GET /` — List Clients

Returns all client records with computed status and associated software info.

| Query Param | Type | Description |
|-------------|------|-------------|
| `software_id` | number | Filter by software product |
| `id` | number | Get single client by ID |

**Response Fields (per client):**

| Field | Description |
|-------|-------------|
| `id`, `software_id`, `hostname`, `machine_name` | Core identity |
| `ip_address`, `os_info`, `app_version`, `current_user` | System metadata |
| `last_heartbeat` | Last heartbeat timestamp |
| `seconds_since_heartbeat` | Computed: `TIMESTAMPDIFF(SECOND, last_heartbeat, NOW())` |
| `status` | Computed via `computeClientStatus()` |
| `is_blocked`, `block_reason` | Block state |
| `force_logout`, `server_message` | Pending commands |
| `software_name` | Joined from `update_software` |
| `latest_version` | Joined: latest release version for this software |

---

### 4.2 `PUT /` — Client Actions

Perform admin actions on a client.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | number | ✅ | Client ID |
| `action` | enum | ✅ | Action to perform |
| `reason` | string | ❌ | Required for `block` action |
| `message` | string | ❌ | Required for `send_message` action |

**Actions:**

| Action | Effect |
|--------|--------|
| `block` | Sets `is_blocked = 1`, stores `block_reason`. Client receives 403 on next heartbeat. |
| `unblock` | Sets `is_blocked = 0`, clears `block_reason`. |
| `force_logout` | Sets `force_logout = 1`. Delivered and cleared on next heartbeat. |
| `send_message` | Sets `server_message = <text>`. Delivered and cleared on next heartbeat. |

---

### 4.3 `DELETE /` — Delete Client

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `id` | number | ✅ | Client ID to delete |

Permanently removes the client record from `update_clients`.

---

## 5. Software Router — `/updates/software`

**File:** `updSoftware.ts` (~200 LOC)  
**Auth:** GET is public; POST/PUT/DELETE require JWT (`requireAuth`, `requireAdmin`)  
**Alias:** Also mounted at `/softaware/software`

### 5.1 `GET /` — List Software Products

Returns all software products with computed fields.

| Query Param | Type | Description |
|-------------|------|-------------|
| `id` | number | Get single product by ID |

**Response Fields (per product):**

| Field | Description |
|-------|-------------|
| `id`, `name`, `description`, `software_key` | Core fields |
| `username`, `password`, `live_url`, `test_url`, `mode` | External integration fields |
| `latest_version` | Joined: MAX version from `update_releases` |
| `total_updates` | Joined: COUNT of `update_releases` |
| `created_at`, `updated_at` | Timestamps |

---

### 5.2 `POST /` — Create Software Product

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `name` | string | ✅ | Product name |
| `description` | string | ❌ | Product description |
| `software_key` | string | ✅ | Unique API key for client auth |
| `username` | string | ❌ | External system username |
| `password` | string | ❌ | External system password |
| `live_url` | string | ❌ | Production URL |
| `test_url` | string | ❌ | Staging/test URL |
| `mode` | string | ❌ | `'live'` \| `'test'` |

---

### 5.3 `PUT /` — Update Software Product

Same fields as POST, plus:

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `id` | number | ✅ | Product ID to update |

---

### 5.4 `DELETE /` — Delete Software Product

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `id` | number | ✅ | Product ID to delete |

---

## 6. Updates Router — `/updates/updates`

**File:** `updUpdates.ts` (161 LOC)  
**Auth:** GET is public; POST/PUT/DELETE require JWT (`requireAuth`, `requireAdmin`)

### 6.1 `GET /` — List Release Packages

| Query Param | Type | Description |
|-------------|------|-------------|
| `software_id` | number | Filter by software product |
| `id` | number | Get single release by ID |

**Response Fields (per release):**

| Field | Description |
|-------|-------------|
| `id`, `software_id`, `version`, `description` | Core fields |
| `file_path` | Relative path to uploaded file |
| `has_migrations`, `migration_notes` | Migration metadata |
| `uploaded_by`, `released_at`, `created_at` | Audit fields |
| `software_name` | Joined from `update_software` |
| `uploaded_by_name` | Joined from `users` |

---

### 6.2 `POST /` — Create Release Record

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `software_id` | number | ✅ | Software product ID |
| `version` | string | ✅ | Version string |
| `description` | string | ❌ | Release notes |
| `has_migrations` | boolean | ❌ | Whether the release has DB migrations |
| `migration_notes` | string | ❌ | Migration instructions |

---

### 6.3 `PUT /` — Update Release Record

Same fields as POST, plus `id` (required).

---

### 6.4 `DELETE /` — Delete Release

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `id` | number | ✅ | Release ID to delete |

**Side Effect:** Also deletes the associated file from disk if `file_path` exists.

---

## 7. Files Router — `/updates`

**File:** `updFiles.ts` (197 LOC)  
**Auth:** API key or JWT (upload), software_key (download)

### 7.1 `POST /upload` — Upload Update Package

**Content-Type:** `multipart/form-data`  
**Auth:** `X-API-Key` header (value: `softaware_test_update_key_2026`) OR JWT Bearer token  
**Max File Size:** 500 MB

| Form Field | Type | Required | Description |
|------------|------|----------|-------------|
| `updatePackage` | file | ✅ | The update file (field name for multer) |
| `software_id` | number | ✅ | Software product ID |
| `version` | string | ✅ | Version string |
| `description` | string | ❌ | Release description |
| `has_migrations` | number | ❌ | Migration flag (0/1) |
| `migration_notes` | string | ❌ | Migration notes |
| `checksum` | string | ❌ | Client-provided checksum |
| `update_id` | number | ❌ | If set, replaces existing release file |

**File handling:**
1. Uploaded to `uploads/updates/` with temp name
2. Renamed to `{version}_{timestamp}_{original_name}`
3. SHA-256 checksum computed server-side
4. If `update_id` provided → replaces existing release (deletes old file)
5. If not → creates new `update_releases` record

**Response:**
```json
{
  "success": true,
  "message": "Update uploaded successfully",
  "update_id": 15,
  "file_path": "uploads/updates/2.2.0_1718000000_MyApp.zip",
  "checksum": "a1b2c3d4..."
}
```

---

### 7.2 `GET /download` — Download Update File

**Auth:** `software_key` via `X-Software-Key` header or `?software_key=` query param

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `update_id` | number | ✅ | Release ID to download |
| `software_key` | string | ✅ | If not in header |

**Response:** Binary file stream with `Content-Disposition: attachment` and `Content-Type: application/octet-stream`.

---

## 8. Modules Router — `/updates/modules`

**File:** `updModules.ts` (228 LOC)  
**Auth:** GET requires JWT (`requireAuth`); POST/PUT/DELETE require JWT (`requireAuth`, `requireAdmin`)  
**Alias:** Also mounted at `/softaware/modules`

### 8.1 `GET /` — List Modules

| Query Param | Type | Description |
|-------------|------|-------------|
| `software_id` | number | Filter by software product |
| `id` | number | Get single module by ID |

**Response Fields (per module):**

| Field | Description |
|-------|-------------|
| `id`, `software_id`, `name`, `description` | Core fields |
| `status` | `'active'` \| `'inactive'` \| `'deprecated'` |
| `software_name` | Joined from `update_software` |
| `developer_count` | Joined: COUNT of assigned developers |

---

### 8.2 `POST /` — Create Module

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `software_id` | number | ✅ | Software product ID |
| `name` | string | ✅ | Module name (unique per software) |
| `description` | string | ❌ | Module description |
| `status` | string | ❌ | Default: `'active'` |

**Validation:** Checks for duplicate name within the same `software_id`.

---

### 8.3 `PUT /` — Update Module

Same fields as POST, plus `id` (required). Duplicate name check excludes the current module.

---

### 8.4 `DELETE /` — Delete Module

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `id` | number | ✅ | Module ID to delete |

---

### 8.5 `GET /:moduleId/developers` — List Module Developers

Returns developers assigned to a module.

**Response Fields (per developer):**

| Field | Description |
|-------|-------------|
| `id` | Assignment ID (from `update_user_modules`) |
| `user_id` | Developer user ID |
| `name`, `email` | Joined from `users` |
| `assigned_at` | Assignment timestamp |

---

### 8.6 `POST /:moduleId/developers` — Assign Developer

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `user_id` | string | ✅ | User ID to assign |

**Validation:** Checks for duplicate assignment (same module + user).

---

### 8.7 `DELETE /:moduleId/developers/:assignmentId` — Remove Developer

Deletes the developer assignment record.

---

## 9. Misc Router — `/updates`

**File:** `updMisc.ts` (327 LOC)  
**Auth:** Mixed (see per-endpoint)

### 9.1 `GET /info` — API Information (Public)

Returns a comprehensive API reference with all available endpoints, auth requirements, and descriptions.

**Response:** JSON object with `name`, `version`, `base_url`, `description`, `endpoints` (grouped by category), `client_auth`, `admin_auth`, `status`.

---

### 9.2 `GET /dashboard` — Admin Dashboard (Authenticated)

**Auth:** JWT (`requireAuth`)

Returns summary statistics for the admin dashboard.

**Response:**
```json
{
  "success": true,
  "summary": {
    "software_count": 5,
    "update_count": 23,
    "user_count": 12,
    "active_clients_24h": 87
  },
  "latest_clients": [ /* 10 most recent heartbeats */ ],
  "recent_updates": [ /* 10 most recent releases */ ]
}
```

---

### 9.3 `GET /api_status` — System Health (Public)

Returns database connectivity and table row counts.

**Response:**
```json
{
  "timestamp": "2026-06-10T14:30:00.000Z",
  "api_version": "2.0.0",
  "status": "operational",
  "database": {
    "connected": true,
    "total_users": 12,
    "tables": {
      "clients": 150,
      "software": 5,
      "releases": 23,
      "modules": 18,
      "user_modules": 45
    }
  }
}
```

---

### 9.4 `GET /installed` — List Installed Updates (Public)

Returns all tracked installations from `update_installed`.

**Response:**
```json
{
  "success": true,
  "installed": [
    {
      "update_id": 15,
      "status": "installed",
      "installed_at": "2026-06-01T10:00:00Z",
      "version": "2.2.0",
      "description": "Bug fixes and performance improvements",
      "file_path": "uploads/updates/2.2.0_1718000000_MyApp.zip"
    }
  ]
}
```

---

### 9.5 `GET /schema` — Get Update Schema File (Public)

Returns the schema (SQL migration) file content for a specific release.

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `id` | number | ✅ | Release ID |

**Response:**
```json
{
  "success": true,
  "schema": "ALTER TABLE users ADD COLUMN ..."
}
```

---

### 9.6 `POST /password_reset` — Request Password Reset (Public)

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `identifier` | string | ✅ | Email or username |

**Logic:**
1. Cleans up expired tokens
2. Looks up user by email or name
3. Generates 6-digit OTP
4. Stores in `update_password_resets` (expires in 15 minutes)
5. Sends email via SMTP (fire-and-forget)
6. Always returns success (doesn't reveal if user exists)

> **Dev mode:** Returns `dev_otp` in response when `NODE_ENV === 'development'`.

---

### 9.7 `POST /verify_otp` — Verify OTP (Public)

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `identifier` | string | ✅ | Email or username |
| `otp` | string | ✅ | 6-digit OTP code |

**Response (success):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user_id": "abc-123",
  "username": "john@example.com"
}
```

---

### 9.8 `POST /reset_password` — Execute Password Reset (Public)

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `identifier` | string | ✅ | Email or username |
| `otp` | string | ✅ | 6-digit OTP code |
| `new_password` | string | ✅ | New password (min 6 chars) |

**Logic:**
1. Verifies user + OTP (same as verify_otp)
2. Hashes new password with bcrypt (10 rounds)
3. Updates `users.passwordHash`
4. Marks token as used
5. Deletes all other tokens for this user

---

## 10. Authentication Summary

| Endpoint Pattern | Auth Method | Middleware |
|-----------------|-------------|------------|
| `POST /heartbeat` | `software_key` (body or header) | None (public) |
| `GET /heartbeat/check` | `software_key` (header or query) | None (public) |
| `POST /error-report` | `software_key` (body) | None (public) |
| `GET /error-report`, `GET /error-report/summaries` | JWT Bearer | `requireAuth`, `requireAdmin` |
| `GET/PUT/DELETE /clients` | JWT Bearer | `requireAuth`, `requireAdmin` |
| `GET /software` | None | None (public) |
| `POST/PUT/DELETE /software` | JWT Bearer | `requireAuth`, `requireAdmin` |
| `GET /updates` | None | None (public) |
| `POST/PUT/DELETE /updates` | JWT Bearer | `requireAuth`, `requireAdmin` |
| `POST /upload` | API key (`X-API-Key`) or JWT Bearer | Custom check |
| `GET /download` | `software_key` (header or query) | Custom check |
| `GET /modules` | JWT Bearer | `requireAuth` |
| `POST/PUT/DELETE /modules` | JWT Bearer | `requireAuth`, `requireAdmin` |
| `GET/POST/DELETE /:moduleId/developers` | JWT Bearer | `requireAuth` / `requireAdmin` |
| `GET /info`, `GET /api_status` | None | None (public) |
| `GET /dashboard` | JWT Bearer | `requireAuth` |
| `GET /installed`, `GET /schema` | None | None (public) |
| `POST /password_reset`, `/verify_otp`, `/reset_password` | None | None (public) |
