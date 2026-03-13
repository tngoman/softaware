# SoftAware Updates — Client Integration Specification

> **Version:** 3.0.0  
> **Last Updated:** 2026-03-07  
> **Status:** Active  
> **Base URL:** `https://updates.softaware.net.za`  
> **API Prefix:** `/api/updates`  
> **Reference Implementation:** SoftAware Desktop App (`/var/opt/desktop`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Client Identity](#3-client-identity)
4. [Heartbeat Protocol](#4-heartbeat-protocol)
5. [Lightweight Update Check](#5-lightweight-update-check)
6. [Error Reporting](#6-error-reporting)
7. [Update Download](#7-update-download)
8. [Software & Release Discovery](#8-software--release-discovery)
9. [Admin Endpoints](#9-admin-endpoints)
10. [Remote Commands](#10-remote-commands)
11. [Common Response Patterns](#11-common-response-patterns)
12. [Rate Limiting & Best Practices](#12-rate-limiting--best-practices)
13. [Migration Guide — Old PHP to New Express](#13-migration-guide)
14. [Complete Endpoint Reference](#14-complete-endpoint-reference)
15. [Appendix — Data Types](#15-appendix--data-types)

---

## 1. Overview

The SoftAware Updates API is a centralized backend for managing software distribution, client heartbeats, update delivery, error collection, and remote administration.

### 1.1 Architecture

```
┌──────────────────┐         HTTPS          ┌──────────────────────┐
│  Desktop Client   │ ──────────────────────▶│  Apache Reverse Proxy │
│  (Electron/Next)  │                        │  updates.softaware.   │
└──────────────────┘                        │  net.za :443          │
                                            └──────────┬───────────┘
┌──────────────────┐         HTTPS                     │
│  Web Frontend     │ ──────────────────────▶           │
│  (React SPA)      │                                   ▼
└──────────────────┘                        ┌──────────────────────┐
                                            │  Express Backend      │
┌──────────────────┐         HTTPS          │  localhost:8787       │
│  PHP Legacy App   │ ──────────────────────▶│  Node.js / TypeScript │
│  (Backend relay)  │                        └──────────┬───────────┘
└──────────────────┘                                   │
                                                       ▼
                                            ┌──────────────────────┐
                                            │  MySQL 8.x           │
                                            │  softaware database   │
                                            └──────────────────────┘
```

### 1.2 URL Structure

| Environment | Base URL |
|---|---|
| **Production** | `https://updates.softaware.net.za` |
| **API Prefix** | `/api/updates` |
| **Full Example** | `https://updates.softaware.net.za/api/updates/heartbeat` |
| **Legacy (deprecated)** | `https://updates.softaware.co.za` |

### 1.3 Content Type

All JSON endpoints expect and return `application/json` unless otherwise specified.

---

## 2. Authentication

The API uses three authentication methods depending on the endpoint type:

### 2.1 Software Key (Client Endpoints)

Used by all client-facing endpoints (heartbeat, update check, download, error reports).

**What is a software key?**  
A unique identifier assigned to each software product (e.g., `20251001SILU`, `20251125SOFTCODE`). Every deployed client knows its own software key — it identifies *which product* is calling, not which user.

**Two ways to provide it:**

| Method | Example |
|---|---|
| **Request body** | `{ "software_key": "20251001SILU", ... }` |
| **HTTP header** | `X-Software-Key: 20251001SILU` |

> **Priority:** If both are provided, the body value takes precedence.

**Endpoints requiring software key:**
- `POST /api/updates/heartbeat`
- `GET /api/updates/heartbeat/check`
- `POST /api/updates/error-report`
- `GET /api/updates/download`

### 2.2 JWT Bearer Token (Admin Endpoints)

Used by the web frontend and admin tools. Obtained via the main SoftAware authentication system.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Endpoints requiring JWT:**
- `GET /api/updates/dashboard`
- All `POST/PUT/DELETE` operations on `/software`, `/updates`, `/clients`, `/modules`
- `GET /api/updates/modules/developers`

### 2.3 API Key (Upload Only)

A static key used exclusively for file uploads as an alternative to JWT.

```
X-API-Key: softaware_test_update_key_2026
```

> **Note:** The upload endpoint accepts *either* `X-API-Key` or `Authorization: Bearer <JWT>`. JWT is preferred for production use.

### 2.4 Public Endpoints (No Auth)

These endpoints require no authentication:
- `GET /api/updates/info`
- `GET /api/updates/api_status`
- `GET /api/updates/software`
- `GET /api/updates/updates`
- `GET /api/updates/installed`
- `GET /api/updates/schema`
- `POST /api/updates/password_reset`
- `POST /api/updates/verify_otp`
- `POST /api/updates/reset_password`

---

## 3. Client Identity

### 3.1 Client Identifier

Each client instance is uniquely identified by a **client_identifier** — a SHA-256 hash derived from the machine's characteristics.

**Generation algorithm:**

```typescript
import { createHash } from 'crypto';

function generateClientIdentifier(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch     = os.arch();
  const cpuModel = os.cpus()[0]?.model || 'unknown';

  const raw = `${hostname}|${platform}|${arch}|${cpuModel}`;
  return createHash('sha256').update(raw).digest('hex');
}
```

**Example output:** `a3f8c2d1e5b7...` (64-char hex string)

> **Fallback:** If the client does not send a `client_identifier`, the server generates one from: `hostname|machine_name|os_info|ip_address`.

### 3.2 When to Generate

- Generate **once** at application startup
- **Cache** the value for the lifetime of the process
- Send with **every** heartbeat and error report

---

## 4. Heartbeat Protocol

The heartbeat is the primary communication channel between clients and the server. It serves four purposes:

1. **Registration** — First heartbeat creates the client record
2. **Status reporting** — CPU, memory, active page, AI sessions
3. **Update checking** — Server responds with available updates
4. **Command delivery** — Server delivers force_logout, messages, block status

### 4.1 Endpoint

```
POST /api/updates/heartbeat
```

### 4.2 Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `software_key` | string | **Yes**¹ | Your product's software key |
| `client_identifier` | string | No² | SHA-256 machine fingerprint |
| `hostname` | string | No | Machine hostname |
| `machine_name` | string | No | Friendly machine name |
| `os_info` | string | No | OS version string (e.g., `"win32 x64"`) |
| `app_version` | string | No | Current app version (e.g., `"1.2.3"`) |
| `ip_address` | string | No | Client's IP (auto-detected if omitted) |
| `user_agent` | string | No | Client user-agent string |
| `user_name` | string | No | Currently logged-in user's display name |
| `user_id` | string | No | Currently logged-in user's UUID |
| `active_page` | string | No | Current page/view the user is on |
| `cpu_usage` | number | No | CPU usage percentage (0-100) |
| `memory_usage` | number | No | Memory usage percentage (0-100) |
| `ai_sessions_active` | number | No | Count of active AI/chat sessions |
| `ai_model` | string | No | AI model currently in use |
| `last_update_id` | number | No | ID of the last installed update |
| `metadata` | object | No | Arbitrary JSON metadata |
| `recent_errors` | array | No | Piggybacked error reports (see §6.3) |

> ¹ Can alternatively be sent via `X-Software-Key` header  
> ² Auto-generated server-side if omitted; **strongly recommended** to send

### 4.3 Successful Response (200)

```json
{
  "success": true,
  "client_id": 42,
  "action": "updated",
  "software": "Silulumanzi Portal",
  "update_available": true,
  "latest_update": {
    "id": 64,
    "version": "2.1.0",
    "description": "Performance improvements and bug fixes",
    "has_migrations": 1,
    "released_at": "2026-03-01T00:00:00.000Z"
  },
  "message": "Update available",
  "is_blocked": false,
  "blocked_reason": null,
  "force_logout": false,
  "server_message": null,
  "errors_received": 0
}
```

### 4.4 Blocked Client Response (403)

```json
{
  "success": false,
  "error": "Client is blocked",
  "blocked": true,
  "reason": "Suspicious activity detected"
}
```

### 4.5 Heartbeat Timing

| Context | Recommended Interval |
|---|---|
| **Normal operation** | Every 60 seconds |
| **Idle / background** | Every 300 seconds |
| **After error burst** | Immediately (to piggyback errors) |
| **First launch** | Immediately on app startup |

### 4.6 Client Behavior on Response

| Field | Action |
|---|---|
| `update_available: true` | Show update notification to user; use `latest_update.id` for download |
| `force_logout: true` | Immediately log out the current user and return to login screen |
| `server_message` (non-null) | Display the message in a toast/dialog/notification |
| `is_blocked: true` | Display block reason and prevent further operation |
| `errors_received > 0` | Confirmation that piggybacked errors were stored; clear local error queue |

### 4.7 First Heartbeat — Client Creation

On the first heartbeat from an unknown `client_identifier`:
- The server creates a new record in `update_clients`
- Returns `"action": "created"`
- If `last_update_id` is provided, records the installation

On subsequent heartbeats:
- The server updates the existing record
- Returns `"action": "updated"`

---

## 5. Lightweight Update Check

For clients that only need to check if an update is available without sending full heartbeat data.

### 5.1 Endpoint

```
GET /api/updates/heartbeat/check
```

### 5.2 Request

| Parameter | Location | Required | Description |
|---|---|---|---|
| `software_key` | Query param **or** `X-Software-Key` header | **Yes** | Your product's software key |
| `version` or `v` | Query param | No | Current version to compare against |

**Example:**
```
GET /api/updates/heartbeat/check?software_key=20251001SILU&version=1.0.0
```

Or with header:
```
GET /api/updates/heartbeat/check?version=1.0.0
X-Software-Key: 20251001SILU
```

### 5.3 Response (200)

```json
{
  "success": true,
  "software": "Silulumanzi Portal",
  "software_id": 1,
  "current_version": "2.1.0",
  "update_available": true,
  "latest_update": {
    "id": 64,
    "version": "2.1.0",
    "description": "Performance improvements and bug fixes",
    "has_migrations": 1,
    "released_at": "2026-03-01T00:00:00.000Z",
    "has_file": true
  },
  "message": "Update available"
}
```

### 5.4 When to Use

| Scenario | Use Heartbeat | Use Check |
|---|---|---|
| Regular interval reporting | ✅ | |
| Quick startup version check | | ✅ |
| Background update polling | | ✅ |
| Need to report user/CPU/memory | ✅ | |
| Need command delivery | ✅ | |

---

## 6. Error Reporting

Clients can report errors in two ways:

1. **Piggybacked on heartbeat** — Include errors in the regular heartbeat payload
2. **Dedicated endpoint** — Send errors immediately, outside the heartbeat cycle

### 6.1 Dedicated Error Report Endpoint

```
POST /api/updates/error-report
```

### 6.2 Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `software_key` | string | **Yes**¹ | Your product's software key |
| `client_identifier` | string | **Yes** | SHA-256 machine fingerprint |
| `hostname` | string | No | Machine hostname |
| `app_version` | string | No | App version |
| `os_info` | string | No | OS information |
| `source` | string | No | Error source: `"backend"` (default), `"frontend"`, `"desktop"`, `"mobile"` |
| `errors` | array | **Yes** | Array of error objects (see below) |
| `metadata` | object | No | Additional context (see below) |

> ¹ Can alternatively be sent via `X-Software-Key` header

#### Error Object Schema

Each item in the `errors` array:

| Field | Type | Required | Description |
|---|---|---|---|
| `error_type` | string | **Yes** | One of: `"php_error"`, `"exception"`, `"fatal_error"`, `"reported_exception"`, `"reported_error"`, `"js_error"` |
| `error_level` | string | **Yes** | One of: `"error"`, `"warning"`, `"notice"` |
| `message` | string | **Yes** | Error message (max 65,000 chars) |
| `timestamp` | string | **Yes** | ISO 8601 timestamp of when the error occurred |
| `label` | string | No | Short label for grouping/display (defaults to `error_type` if omitted) |
| `file` | string | No | Source file where the error occurred |
| `line` | number | No | Line number |
| `column` | number | No | Column number |
| `stack_trace` | string | No | Full stack trace |
| `url` | string | No | URL/route where the error occurred |
| `user_agent` | string | No | Browser/client user-agent |
| `request_method` | string | No | HTTP method (GET, POST, etc.) |
| `request_uri` | string | No | Request URI path |

> **Field name aliases:** The backend also accepts short names `type` (for `error_type`), `level` (for `error_level`), and `trace` (for `stack_trace`). The documented names above are preferred. Request context can also be sent as a nested `request` object with `method`, `uri`, `route`, `ip`, and `user_agent` sub-fields.

#### Metadata Object (Optional)

| Field | Type | Description |
|---|---|---|
| `browser` | string | Browser name and version |
| `screen_resolution` | string | Screen dimensions |
| `page_url` | string | Current page URL |
| `user_id` | string | Logged-in user ID |
| `memory_usage` | number | Memory usage percentage |
| `uptime` | string | Application uptime |
| `extra` | any | Any additional data |

### 6.3 Piggybacking Errors on Heartbeat

Include a `recent_errors` array in your heartbeat body. Each item uses the **same schema** as the dedicated error report's `errors` array:

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a3f8c2d1...",
  "hostname": "WORKSTATION-01",
  "app_version": "1.2.3",
  "recent_errors": [
    {
      "error_type": "js_error",
      "error_level": "error",
      "message": "Cannot read property 'id' of undefined",
      "timestamp": "2026-03-07T10:30:00Z",
      "file": "src/components/Dashboard.tsx",
      "line": 42,
      "stack_trace": "TypeError: Cannot read property 'id'..."
    }
  ]
}
```

The heartbeat response includes `"errors_received": N` to confirm how many were stored.

### 6.4 Dedicated Response (200)

```json
{
  "success": true,
  "received": 3,
  "message": "Error report received"
}
```

### 6.5 Error Reporting Strategy

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT APP                         │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ Error Queue  │◄───│ Global Error Handler      │    │
│  │ (in-memory)  │    │ window.onerror            │    │
│  └──────┬───────┘    │ unhandledrejection        │    │
│         │            │ try/catch wrappers         │    │
│         │            └──────────────────────────┘    │
│         │                                            │
│         ├── On next heartbeat ──▶ piggyback as       │
│         │                        recent_errors[]     │
│         │                                            │
│         ├── If queue > 10 ──────▶ POST /error-report │
│         │   (immediate flush)                        │
│         │                                            │
│         └── If fatal error ─────▶ POST /error-report │
│             (immediate send)                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Recommended behavior:**

1. Capture all errors in an in-memory queue
2. On each heartbeat, include up to 10 errors as `recent_errors[]` and clear the queue
3. If the queue exceeds 10 pending errors, flush immediately via `POST /error-report`
4. On fatal/unrecoverable errors, send immediately via `POST /error-report`

---

## 7. Update Download

### 7.1 Endpoint

```
GET /api/updates/download?update_id={id}
```

### 7.2 Request

| Parameter | Location | Required | Description |
|---|---|---|---|
| `update_id` | Query param | **Yes** | The update release ID (from heartbeat response `latest_update.id`) |
| `software_key` | Query param **or** `X-Software-Key` header | **Yes** | Your product's software key |

**Example:**
```
GET /api/updates/download?update_id=64&software_key=20251001SILU
```

### 7.3 Response

**Success:** Binary file stream with headers:
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="update-64-v2.1.0.zip"
```

**Errors:**

| Status | Condition |
|---|---|
| 400 | Missing `software_key` or `update_id` |
| 404 | Unknown software key or update not found |
| 404 | Update exists but has no file attached |

### 7.4 Download Flow

```
1. Receive heartbeat response with update_available: true
2. Show update notification to user
3. User accepts → GET /download?update_id={id}&software_key={key}
4. Save file to temporary location
5. Verify file integrity (optional: compare checksum)
6. Apply update (extract, run migrations if has_migrations=1)
7. Send next heartbeat with last_update_id={id} to confirm installation
```

---

## 8. Software & Release Discovery

### 8.1 List All Software Products

```
GET /api/updates/software
```

**No authentication required.**

**Response:**
```json
{
  "success": true,
  "software": [
    {
      "id": 1,
      "name": "Silulumanzi Portal",
      "description": "Water management portal",
      "software_key": "20251001SILU",
      "created_at": "2025-10-01T00:00:00.000Z",
      "latest_version": "2.1.0",
      "latest_update_date": "2026-03-01T00:00:00.000Z",
      "total_updates": 12
    }
  ]
}
```

**Single product:** `GET /api/updates/software?id=1`

### 8.2 List All Update Releases

```
GET /api/updates/updates
```

**No authentication required.**

**Response:**
```json
{
  "success": true,
  "updates": [
    {
      "id": 64,
      "software_id": 1,
      "version": "2.1.0",
      "description": "Performance improvements",
      "file_path": "uploads/updates/...",
      "file_size": 5242880,
      "file_name": "update-v2.1.0.zip",
      "has_migrations": 1,
      "migration_notes": "ALTER TABLE ...",
      "schema_file": "schema-v2.1.0.sql",
      "released_at": "2026-03-01T00:00:00.000Z",
      "software_name": "Silulumanzi Portal",
      "uploaded_by_name": "Admin User"
    }
  ]
}
```

**Single release:** `GET /api/updates/updates?id=64`

### 8.3 Schema File Content

```
GET /api/updates/schema?id=64
```

Returns the raw SQL schema file content for migration purposes.

### 8.4 Installed Updates

```
GET /api/updates/installed
```

Returns a list of installed updates with status tracking.

---

## 9. Admin Endpoints

> All admin endpoints require `Authorization: Bearer <JWT>` with admin role.

### 9.1 Dashboard

```
GET /api/updates/dashboard
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "software_count": 7,
    "update_count": 15,
    "user_count": 5,
    "active_clients_24h": 12
  },
  "latest_clients": [
    {
      "id": 42,
      "software_name": "Silulumanzi Portal",
      "hostname": "WORKSTATION-01",
      "app_version": "2.1.0",
      "last_heartbeat": "2026-03-07T11:45:00.000Z"
    }
  ],
  "recent_updates": [
    {
      "id": 64,
      "software_name": "Silulumanzi Portal",
      "version": "2.1.0",
      "created_at": "2026-03-01T00:00:00.000Z"
    }
  ]
}
```

### 9.2 Client Management

**List clients:**
```
GET /api/updates/clients
GET /api/updates/clients?id=42
GET /api/updates/clients?software_id=1
```

**Client actions:**
```
PUT /api/updates/clients
```

| Action | Body |
|---|---|
| Block client | `{ "id": 42, "action": "block", "blocked_reason": "Suspicious activity" }` |
| Unblock client | `{ "id": 42, "action": "unblock" }` |
| Force logout | `{ "id": 42, "action": "force_logout" }` |
| Send message | `{ "id": 42, "action": "send_message", "server_message": "Maintenance at 2AM" }` |

**Delete client:**
```
DELETE /api/updates/clients?id=42
```

### 9.3 Software CRUD

| Method | Path | Body |
|---|---|---|
| POST | `/api/updates/software` | `{ "name": "...", "software_key": "...", "description": "..." }` |
| PUT | `/api/updates/software` | `{ "id": 1, "name": "Updated Name" }` |
| DELETE | `/api/updates/software?id=1` | — |

### 9.4 Release CRUD

| Method | Path | Body |
|---|---|---|
| POST | `/api/updates/updates` | `{ "software_id": 1, "version": "2.2.0", "description": "..." }` |
| PUT | `/api/updates/updates` | `{ "id": 65, "description": "Updated" }` |
| DELETE | `/api/updates/updates?id=65` | — |

### 9.5 File Upload

```
POST /api/updates/upload
Content-Type: multipart/form-data
```

**Auth:** `X-API-Key: softaware_test_update_key_2026` **or** `Authorization: Bearer <JWT>`

| Form Field | Type | Required | Description |
|---|---|---|---|
| `updatePackage` | file | **Yes** | Update file (max 500 MB) |
| `software_id` | number | **Yes** | Target software product |
| `version` | string | **Yes** | Release version string |
| `description` | string | No | Release notes |
| `has_migrations` | boolean | No | Whether this update includes DB migrations |
| `schema_file` | string | No | SQL schema content |
| `migration_notes` | string | No | Migration instructions |
| `update_id` | number | No | If provided, replaces the file for an existing release |

**Response:**
```json
{
  "success": true,
  "message": "Update uploaded successfully",
  "update_id": 65,
  "file_path": "uploads/updates/...",
  "checksum": "sha256:a3f8c2d1e5b7..."
}
```

### 9.6 Module Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/updates/modules` | List all modules |
| GET | `/api/updates/modules?software_id=1` | Filter by software |
| POST | `/api/updates/modules` | Create module: `{ "software_id": 1, "name": "Auth", "description": "..." }` |
| PUT | `/api/updates/modules?id=1` | Update module |
| DELETE | `/api/updates/modules?id=1` | Delete module |
| GET | `/api/updates/modules/:id/developers` | List developers |
| POST | `/api/updates/modules/:id/developers` | Assign: `{ "user_id": "uuid" }` |
| DELETE | `/api/updates/modules/:id/developers?user_id=uuid` | Remove developer |

---

## 10. Remote Commands

Remote commands are delivered via the heartbeat response. They are **one-shot** — once delivered, the server clears the flag.

### 10.1 Force Logout

**How it works:**
1. Admin sets `force_logout` via `PUT /clients` with `{ "id": 42, "action": "force_logout" }`
2. On next heartbeat, client receives `"force_logout": true`
3. Server clears the flag after delivery
4. Client must immediately log out the current user

**Client implementation:**
```typescript
if (heartbeatResponse.force_logout) {
  authStore.logout();
  router.push('/login');
  toast.warning('You have been logged out by an administrator');
}
```

### 10.2 Server Message

**How it works:**
1. Admin sends message via `PUT /clients` with `{ "id": 42, "action": "send_message", "server_message": "System maintenance tonight" }`
2. On next heartbeat, client receives `"server_message": "System maintenance tonight"`
3. Server clears the message after delivery
4. Client must display the message to the user

**Client implementation:**
```typescript
if (heartbeatResponse.server_message) {
  toast.info(heartbeatResponse.server_message, { duration: 10000 });
}
```

### 10.3 Client Blocking

**How it works:**
1. Admin blocks client via `PUT /clients` with `{ "id": 42, "action": "block", "blocked_reason": "Unauthorized access" }`
2. On next heartbeat, client receives **HTTP 403** with `"blocked": true`
3. Client must display the reason and prevent further operation

**Client implementation:**
```typescript
if (response.status === 403 && data.blocked) {
  showBlockedScreen(data.reason);
  stopHeartbeat();
}
```

---

## 11. Common Response Patterns

### 11.1 Success Response

All successful responses include `"success": true`:
```json
{ "success": true, "data": "..." }
```

### 11.2 Error Responses

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Missing or invalid parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Client is blocked or insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found (unknown software key, update ID, etc.) |
| 409 | `CONFLICT` | Duplicate resource (e.g., duplicate module name) |
| 500 | `INTERNAL_ERROR` | Server error — should be reported via error endpoint |

**Standard error shape:**
```json
{
  "error": "NOT_FOUND",
  "message": "Unknown software key"
}
```

### 11.3 HTTP Headers Reference

| Header | Direction | Usage |
|---|---|---|
| `Content-Type: application/json` | Request | All JSON endpoints |
| `Content-Type: multipart/form-data` | Request | File upload only |
| `X-Software-Key` | Request | Client software key |
| `X-API-Key` | Request | Upload API key |
| `Authorization: Bearer <token>` | Request | Admin JWT |
| `Content-Disposition` | Response | File download filename |
| `X-Forwarded-For` | Request | Client IP (set by proxy) |

---

## 12. Rate Limiting & Best Practices

### 12.1 Heartbeat Intervals

- **Do** send heartbeats at regular intervals (60s normal, 300s idle)
- **Don't** send heartbeats more frequently than every 30 seconds
- **Do** reduce frequency when the app is minimized or in the background
- **Do** send an immediate heartbeat on app startup and on user login/logout

### 12.2 Error Reporting

- **Do** buffer errors and piggyback them on heartbeats when possible
- **Don't** send a dedicated error report for every single error — batch them
- **Do** send immediately for fatal/critical errors
- **Do** cap `recent_errors` to 10-20 items per heartbeat
- **Do** truncate long error messages client-side (server caps at 65,000 chars)

### 12.3 Update Downloads

- **Do** only download when the user accepts the update
- **Don't** auto-download large updates on metered connections
- **Do** confirm installation by sending `last_update_id` in the next heartbeat

### 12.4 Resilience

- **Do** handle network failures gracefully — queue errors and heartbeats for retry
- **Don't** crash or block the UI if the updates server is unreachable
- **Do** implement exponential backoff for failed requests (1s, 2s, 4s, 8s, max 60s)
- **Do** continue normal operation even if the heartbeat fails

---

## 13. Migration Guide

### Old PHP Backend → New Express Backend

| Aspect | Old (PHP) | New (Express) |
|---|---|---|
| **URL** | `https://updates.softaware.co.za` | `https://updates.softaware.net.za` |
| **Prefix** | `/api/` | `/api/updates/` |
| **Heartbeat** | `POST /api/heartbeat` | `POST /api/updates/heartbeat` |
| **Download** | `GET /api/download?id=X` | `GET /api/updates/download?update_id=X&software_key=Y` |
| **Auth** | Custom API key | Software key (body/header) |
| **Error reporting** | Not supported | `POST /api/updates/error-report` + heartbeat piggyback |
| **Update check** | Full heartbeat only | `GET /api/updates/heartbeat/check` (lightweight) |
| **Remote commands** | Not supported | Via heartbeat response |

### Migration Steps

1. Update base URL to `https://updates.softaware.net.za`
2. Update API prefix from `/api/` to `/api/updates/`
3. Replace any API key auth with `software_key` in body or `X-Software-Key` header
4. Add `client_identifier` generation (SHA-256)
5. Handle new heartbeat response fields (`force_logout`, `server_message`, `is_blocked`)
6. Implement error reporting (piggybacked and/or dedicated)
7. Update download requests to include `software_key`
8. Test all endpoints against the new base URL

---

## 14. Complete Endpoint Reference

### Client Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/updates/heartbeat` | Software Key | Full heartbeat with status + update check |
| `GET` | `/api/updates/heartbeat/check` | Software Key | Lightweight update availability check |
| `POST` | `/api/updates/error-report` | Software Key | Submit error reports |
| `GET` | `/api/updates/download` | Software Key | Download update file |

### Public Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/updates/info` | None | API version and endpoint catalog |
| `GET` | `/api/updates/api_status` | None | System health and database stats |
| `GET` | `/api/updates/software` | None | List all software products |
| `GET` | `/api/updates/updates` | None | List all update releases |
| `GET` | `/api/updates/installed` | None | List installed updates |
| `GET` | `/api/updates/schema?id=N` | None | Get schema file for a release |
| `POST` | `/api/updates/password_reset` | None | Request OTP for password reset |
| `POST` | `/api/updates/verify_otp` | None | Verify OTP code |
| `POST` | `/api/updates/reset_password` | None | Execute password reset |

### Admin Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/updates/dashboard` | JWT | Dashboard summary stats |
| `POST` | `/api/updates/software` | JWT (admin) | Create software product |
| `PUT` | `/api/updates/software` | JWT (admin) | Update software product |
| `DELETE` | `/api/updates/software?id=N` | JWT (admin) | Delete software product |
| `POST` | `/api/updates/updates` | JWT (admin) | Create update release record |
| `PUT` | `/api/updates/updates` | JWT (admin) | Update release record |
| `DELETE` | `/api/updates/updates?id=N` | JWT (admin) | Delete release + file |
| `POST` | `/api/updates/upload` | JWT or API Key | Upload update file |
| `GET` | `/api/updates/clients` | JWT (admin) | List clients |
| `PUT` | `/api/updates/clients` | JWT (admin) | Client actions (block, message, etc.) |
| `DELETE` | `/api/updates/clients?id=N` | JWT (admin) | Delete client record |
| `GET` | `/api/updates/modules` | JWT | List modules |
| `POST` | `/api/updates/modules` | JWT (admin) | Create module |
| `PUT` | `/api/updates/modules?id=N` | JWT (admin) | Update module |
| `DELETE` | `/api/updates/modules?id=N` | JWT (admin) | Delete module |
| `GET` | `/api/updates/modules/:id/developers` | JWT | List module developers |
| `POST` | `/api/updates/modules/:id/developers` | JWT (admin) | Assign developer |
| `DELETE` | `/api/updates/modules/:id/developers?user_id=X` | JWT (admin) | Remove developer |

---

## 15. Appendix — Data Types

### 15.1 Client Status

Client status is computed server-side based on time since last heartbeat:

| Status | Condition | Description |
|---|---|---|
| `online` | < 5 minutes | Client is actively communicating |
| `recent` | < 24 hours | Client was active recently |
| `inactive` | < 7 days | Client hasn't checked in for days |
| `offline` | ≥ 7 days | Client is presumed offline |

### 15.2 User Roles

| Role | Permissions |
|---|---|
| `admin` | Full access to all endpoints |
| `client_manager` | Client management (block, message, etc.) |
| `qa_specialist` | View clients, modules, releases |
| `developer` | View modules, assigned developer lists |
| `deployer` | Upload files, manage releases |
| `viewer` | Read-only access |

### 15.3 Error Types

| Type | Description |
|---|---|
| `php_error` | PHP runtime error |
| `exception` | Unhandled exception |
| `fatal_error` | Fatal/crash error |
| `reported_exception` | Manually caught and reported exception |
| `reported_error` | Manually reported error |
| `js_error` | JavaScript/frontend error |

### 15.4 Error Levels

| Level | Description |
|---|---|
| `error` | Critical — requires attention |
| `warning` | Non-critical — may indicate a problem |
| `notice` | Informational — logged for monitoring |

### 15.5 Software Key Format

Software keys follow the pattern: `YYYYMMDD` + short product code.

| Key | Product |
|---|---|
| `20251001SILU` | Silulumanzi Portal |
| `20251125SOFTCODE` | Soft Aware Desktop |
| `20251116SILUDESK` | Silulumanzi Desktop |
| `20251204KONERECRUIT` | Kone Solutions Recruitment |

---

## Quick Start — Minimal Client Implementation

```typescript
// 1. Configuration
const BASE_URL = 'https://updates.softaware.net.za/api/updates';
const SOFTWARE_KEY = '20251001SILU';  // Your product's key

// 2. Generate client identifier (once at startup)
const clientId = generateClientIdentifier(); // SHA-256 hash

// 3. Heartbeat loop
setInterval(async () => {
  try {
    const res = await fetch(`${BASE_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        software_key: SOFTWARE_KEY,
        client_identifier: clientId,
        hostname: os.hostname(),
        app_version: '1.0.0',
        os_info: `${os.platform()} ${os.arch()}`,
        user_name: currentUser?.name,
        user_id: currentUser?.id,
        active_page: router.currentRoute,
        recent_errors: errorQueue.splice(0, 10)  // Drain up to 10 errors
      })
    });

    if (res.status === 403) {
      const data = await res.json();
      if (data.blocked) handleBlocked(data.reason);
      return;
    }

    const data = await res.json();

    // Handle remote commands
    if (data.force_logout) handleForceLogout();
    if (data.server_message) showNotification(data.server_message);
    if (data.update_available) showUpdatePrompt(data.latest_update);

  } catch (err) {
    // Don't crash — queue error for next heartbeat
    errorQueue.push({
      error_type: 'exception',
      error_level: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
}, 60000); // Every 60 seconds
```

---

*This specification is maintained by the SoftAware development team. For questions or changes, contact the backend team or submit a pull request to the documentation repository.*
