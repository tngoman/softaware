# Updates API — Complete Specification

**Base URL:** `https://updates.softaware.co.za`  
**API Version:** 1.1.0  
**Last Documented:** February 28, 2026  
**Technology:** PHP 8.x, MySQL (PDO), Apache with mod_rewrite  
**Timezone:** Africa/Johannesburg (UTC+02:00)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [CORS & Headers](#cors--headers)
5. [URL Routing](#url-routing)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
   - [Info](#1-info)
   - [Login](#2-login)
   - [Auth Check](#3-auth-check)
   - [Dashboard](#4-dashboard)
   - [Software](#5-software)
   - [Updates](#6-updates)
   - [Upload](#7-upload)
   - [Download](#8-download)
   - [Heartbeat](#9-heartbeat)
   - [Error Reports](#10-error-reports)
   - [Clients](#11-clients)
   - [Users](#12-users)
   - [Modules](#13-modules)
   - [Module Developers](#14-module-developers)
   - [Installed Updates](#15-installed-updates)
   - [Schema](#16-schema)
   - [Password Reset](#17-password-reset)
   - [Verify OTP](#18-verify-otp)
   - [Reset Password](#19-reset-password)
   - [API Status](#20-api-status)
8. [User Roles](#user-roles)
9. [Remote Control (Client Commands)](#remote-control-client-commands)
10. [Error Handling](#error-handling)
11. [File Storage](#file-storage)
12. [Migrations](#migrations)
13. [Security Notes](#security-notes)

---

## Overview

The Updates API is a RESTful PHP API that powers the **Softaware update management system**. It provides:

- **Software registry** — Track multiple software products with unique keys
- **Update distribution** — Upload, manage, and distribute versioned update packages
- **Client heartbeat tracking** — Monitor connected client installations in real-time
- **Remote control** — Force logout, send messages to connected clients
- **User management** — Role-based user administration
- **Module management** — Track software modules and developer assignments
- **Password reset flow** — OTP-based email password recovery
- **Dashboard analytics** — Summary stats for the admin panel

---

## Architecture

```
public_html/
├── .htaccess              # Apache rewrite rules, CORS, security
├── config/
│   └── Database.php       # PDO MySQL connection class
├── api/
│   ├── auth.php           # Authentication helper (shared)
│   ├── auth_check.php     # Auth verification endpoint
│   ├── auth/
│   │   └── check.php      # Alternative auth check path
│   ├── login.php          # Login endpoint
│   ├── info.php           # API info/root endpoint
│   ├── dashboard.php      # Dashboard stats
│   ├── software.php       # Software CRUD
│   ├── updates.php        # Updates CRUD
│   ├── upload.php         # File upload
│   ├── download.php       # File download
│   ├── heartbeat.php      # Client heartbeat
│   ├── clients.php        # Client management (admin)
│   ├── users.php          # User CRUD (admin)
│   ├── modules.php        # Module CRUD
│   ├── module-developers.php  # Module-developer assignments
│   ├── installed.php      # Installed updates tracker
│   ├── schema.php         # Schema file retrieval
│   ├── password_reset.php # Request password reset OTP
│   ├── verify_otp.php     # Verify OTP code
│   ├── reset_password.php # Execute password reset
│   ├── api_status.php     # System status check
│   └── migrations/        # Database migration scripts
└── uploads/
    └── updates/           # Uploaded update package files
```

### Database Connection

The `Database` class (`config/Database.php`) manages MySQL connections via PDO:

- **Host:** `localhost`
- **Database:** `updates`
- **Error mode:** `PDO::ERRMODE_EXCEPTION`
- **Timezone set:** `+02:00` (SAST) on every connection

---

## Authentication

### Mechanism

The API uses **Base64-encoded Bearer tokens**. A token is created by encoding `username:password` in Base64.

```
Token = Base64Encode("username:password")
Authorization: Bearer <token>
```

### Token Creation

```
POST /api/login → returns { token: "base64string" }
```

The token is **not** a JWT — it is a simple Base64-encoded credential pair verified against the `users` table on every request.

### Header Formats (accepted)

The API accepts authentication via two header formats:

| Header | Format | Notes |
|--------|--------|-------|
| `Authorization` | `Bearer <base64(user:pass)>` | Primary method |
| `X-Auth-Token` | `<base64(user:pass)>` | Fallback (auto-wrapped with `Bearer `) |

### Auth Logic (`auth.php`)

1. Reads `Authorization` header (case-insensitive scan)
2. Falls back to `X-Auth-Token` header if `Authorization` is missing
3. Strips `Bearer ` prefix, Base64-decodes the token
4. Splits on `:` to extract username and password
5. Looks up user by `username`, then tries `email` if input looks like an email
6. Verifies password using `password_verify()` (bcrypt)
7. User with `id = 1` is always flagged as `is_admin = true`
8. Returns `{ authenticated: bool, user: { id, username, password, is_admin } }`

### Access Levels

| Level | Description |
|-------|-------------|
| **Public** | No auth required |
| **Authenticated** | Valid Bearer token required |
| **Admin** | Authenticated + `is_admin = true` (user ID 1 or `is_admin` flag) |

---

## CORS & Headers

Configured in `.htaccess` and reinforced per-endpoint:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-API-Key
```

All `OPTIONS` preflight requests return `200 OK` immediately.

All JSON endpoints return `Content-Type: application/json`.

---

## URL Routing

Apache `.htaccess` rewrite rules map clean URLs to PHP files:

| URL Pattern | Target File |
|-------------|-------------|
| `/api/login` | `api/login.php` |
| `/api/modules` | `api/modules.php` |
| `/api/modules/{id}/developers` | `api/module-developers.php?module_id={id}` |
| `/api/updates` | `api/updates.php` |
| `/api/users` | `api/users.php` |
| `/api/software` | `api/software.php` |
| `/api/clients` | `api/clients.php` |
| `/api/installed` | `api/installed.php` |
| `/api/schema` | `api/schema.php` |
| `/api/info` | `api/info.php` |
| `/api/heartbeat` | `api/heartbeat.php` |
| `/api/download` | `api/download.php` |
| `/api/upload` | `api/upload.php` |
| `/api/dashboard` | `api/dashboard.php` |
| `/upload.php` | `api/upload.php` (backward compat) |
| `/` (root) | `api/info.php` (DirectoryIndex) |

Security rules block access to `.sql`, `.log`, and `.env` files. Directory listing is disabled.

---

## Database Schema

### Table: `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | User ID 1 = always admin |
| `username` | VARCHAR, UNIQUE | Login identifier |
| `password` | VARCHAR | bcrypt hash (`password_hash()`) |
| `email` | VARCHAR (optional) | For password reset |
| `role` | VARCHAR(50), DEFAULT 'viewer' | Optional column (see Roles) |
| `is_admin` | TINYINT | Admin flag |
| `created_at` | TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | Last modification |

### Table: `software`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `name` | VARCHAR | Display name |
| `description` | TEXT | |
| `software_key` | VARCHAR, UNIQUE | Client identification key |
| `created_by` | INT, FK → users.id | |
| `created_at` | TIMESTAMP | |
| `has_external_integration` | TINYINT, DEFAULT 0 | |
| `external_username` | VARCHAR | Integration credentials |
| `external_password` | VARCHAR | Integration credentials |
| `external_live_url` | VARCHAR | Production URL |
| `external_test_url` | VARCHAR | Test URL |
| `external_mode` | ENUM('test','live'), DEFAULT 'test' | |
| `external_integration_notes` | TEXT | |

### Table: `updates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `software_id` | INT, FK → software.id | |
| `version` | VARCHAR | Semantic version string |
| `description` | TEXT | Release notes |
| `file_path` | VARCHAR | Relative path to uploaded file |
| `uploaded_by` | INT, FK → users.id | |
| `has_migrations` | TINYINT | Requires DB migrations |
| `migration_notes` | TEXT | Migration instructions |
| `schema_file` | VARCHAR | Path to schema SQL file |
| `released_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

### Table: `clients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `software_id` | INT, FK → software.id | |
| `client_identifier` | VARCHAR | SHA-256 hash of machine info |
| `ip_address` | VARCHAR | |
| `hostname` | VARCHAR | |
| `machine_name` | VARCHAR | |
| `os_info` | VARCHAR | |
| `app_version` | VARCHAR | Currently installed version |
| `user_agent` | VARCHAR | |
| `last_heartbeat` | TIMESTAMP | Last check-in time |
| `last_update_id` | INT, FK → updates.id | |
| `last_update_installed_at` | TIMESTAMP | |
| `metadata` | JSON | Arbitrary JSON blob |
| `is_blocked` | TINYINT, DEFAULT 0 | |
| `blocked_at` | TIMESTAMP | |
| `blocked_reason` | TEXT | |
| `user_name` | VARCHAR(255) | Logged-in user in client app |
| `user_id` | INT | User ID in client app |
| `active_page` | VARCHAR(255) | Current page in client app |
| `ai_sessions_active` | INT, DEFAULT 0 | Active AI sessions count |
| `ai_model` | VARCHAR(100) | Current AI model in use |
| `force_logout` | TINYINT(1), DEFAULT 0 | One-shot remote command |
| `server_message` | TEXT | One-shot message to client |
| `server_message_id` | VARCHAR(64) | Unique message identifier |

### Table: `modules`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `software_id` | INT, FK → software.id | CASCADE delete |
| `name` | VARCHAR(255) | UNIQUE per software_id |
| `description` | TEXT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

### Table: `user_modules`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `user_id` | INT, FK → users.id | CASCADE delete |
| `module_id` | INT, FK → modules.id | CASCADE delete |
| `created_at` | TIMESTAMP | |
| **Unique constraint:** `(user_id, module_id)` | | |

### Table: `tb_installed_updates`

| Column | Type | Notes |
|--------|------|-------|
| `update_id` | INT, FK → updates.id | |
| `status` | VARCHAR | e.g., `'installed'` |
| `installed_at` | TIMESTAMP | |

### Table: `password_reset_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT, PK, AUTO_INCREMENT | |
| `user_id` | INT, FK → users.id | CASCADE delete |
| `token` | VARCHAR(6) | 6-digit OTP code |
| `expires_at` | DATETIME | 15-minute expiry |
| `used` | TINYINT, DEFAULT 0 | |
| `created_at` | TIMESTAMP | |

---

## API Endpoints

---

### 1. Info

**`GET /api/info`** — Public

Returns API metadata and endpoint directory.

**Response:**
```json
{
  "name": "Softaware API",
  "version": "1.0.0",
  "description": "RESTful API for Softaware update management system",
  "endpoints": {
    "authentication": { "POST /api/login": "Login with username and password" },
    "updates": {
      "GET /api/updates": "Get all updates (optional: ?limit=N or ?id=N)",
      "POST /api/updates": "Create new update (requires auth)",
      "PUT /api/updates": "Update existing update (requires auth)",
      "DELETE /api/updates?id=N": "Delete update (requires auth)"
    },
    "users": { "..." },
    "files": { "..." },
    "legacy": { "..." }
  },
  "authentication": "Bearer token (base64 encoded username:password)",
  "status": "API is running"
}
```

---

### 2. Login

**`POST /api/login`** — Public

Authenticates a user and returns a Bearer token.

**Request Body:**
```json
{
  "username": "admin",
  "password": "mypassword"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "token": "YWRtaW46bXlwYXNzd29yZA==",
  "user": {
    "id": 1,
    "username": "admin",
    "is_admin": true,
    "role": "admin"
  }
}
```

**Error Response (401):**
```json
{ "success": false, "error": "Invalid credentials" }
```

**Notes:**
- Dynamically checks if `role` and `is_admin` columns exist
- User ID 1 is always treated as admin regardless of `is_admin` flag
- Role defaults to `"viewer"` if column doesn't exist

---

### 3. Auth Check

**`GET /api/auth_check`** — Authenticated  
**`GET /api/auth/check`** — Authenticated (alternative path)

Verifies the current Bearer token is valid.

**Request Header:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "admin",
    "is_admin": true
  }
}
```

**Error Response (401):**
```json
{ "success": false, "authenticated": false, "error": "Authentication failed" }
```

---

### 4. Dashboard

**`GET /api/dashboard`** — Authenticated

Returns summary statistics for the admin dashboard.

**Success Response (200):**
```json
{
  "success": true,
  "summary": {
    "software_count": 5,
    "update_count": 23,
    "user_count": 8,
    "active_clients_24h": 12
  },
  "latest_clients": [
    {
      "id": 1,
      "software_id": 2,
      "software_name": "Silulumanzi Portal",
      "hostname": "WORKSTATION-01",
      "machine_name": "WIN-PC01",
      "app_version": "2.1.0",
      "last_heartbeat": "2026-02-28 14:30:00"
    }
  ],
  "recent_updates": [
    {
      "id": 10,
      "software_id": 2,
      "software_name": "Silulumanzi Portal",
      "version": "2.1.0",
      "created_at": "2026-02-27 09:00:00"
    }
  ]
}
```

**Notes:**
- `latest_clients`: Last 10 clients by heartbeat time
- `recent_updates`: Last 10 updates by creation date
- `active_clients_24h`: Clients with heartbeat in last 24 hours

---

### 5. Software

**`GET /api/software`** — Public  
**`GET /api/software?id={id}`** — Public  
**`POST /api/software`** — Admin  
**`PUT /api/software`** — Admin  
**`DELETE /api/software?id={id}`** — Admin

Manages software product registrations.

#### GET — List All / Single

**Response:**
```json
{
  "success": true,
  "software": [
    {
      "id": 1,
      "name": "SoftAwareCode",
      "description": "Desktop IDE",
      "software_key": "softaware-code-key",
      "created_by": 1,
      "created_by_name": "admin",
      "created_at": "2026-01-01 00:00:00",
      "has_external_integration": 0,
      "external_username": null,
      "external_password": null,
      "external_live_url": null,
      "external_test_url": null,
      "external_mode": "test",
      "external_integration_notes": null,
      "latest_version": "2.1.0",
      "latest_update_date": "2026-02-27 09:00:00",
      "total_updates": 15
    }
  ]
}
```

#### POST — Create Software

**Request Body:**
```json
{
  "name": "My Software",
  "software_key": "my-unique-key",
  "description": "Optional description",
  "has_external_integration": true,
  "external_username": "api_user",
  "external_password": "api_pass",
  "external_live_url": "https://live.example.com",
  "external_test_url": "https://test.example.com",
  "external_mode": "test",
  "external_integration_notes": "Notes about integration"
}
```

**Response (200):**
```json
{ "success": true, "message": "Software created successfully", "id": 5 }
```

**Errors:**
- `400`: Missing name or software_key, or duplicate software_key

#### PUT — Update Software

**Request Body:**
```json
{
  "id": 5,
  "name": "Updated Name",
  "description": "Updated desc",
  "software_key": "new-unique-key",
  "has_external_integration": 1,
  "external_mode": "live"
}
```

All fields except `id` are optional. Only supplied fields are updated.

**Response (200):**
```json
{ "success": true, "message": "Software updated successfully" }
```

#### DELETE — Remove Software

**`DELETE /api/software?id=5`**

Cascades to delete related updates.

**Response (200):**
```json
{ "success": true, "message": "Software deleted successfully" }
```

---

### 6. Updates

**`GET /api/updates`** — Public  
**`GET /api/updates?id={id}`** — Public  
**`GET /api/updates?limit={n}`** — Public  
**`POST /api/updates`** — Admin  
**`PUT /api/updates`** — Admin  
**`DELETE /api/updates?id={id}`** — Admin

Manages software update records (metadata, not file uploads).

#### GET — List / Single

**Response:**
```json
{
  "success": true,
  "updates": [
    {
      "id": 10,
      "software_id": 2,
      "software_name": "Silulumanzi Portal",
      "version": "2.1.0",
      "description": "Bug fixes and improvements",
      "file_path": "uploads/updates/2.1.0_1709123456_update.zip",
      "uploaded_by": 1,
      "uploaded_by_name": "admin",
      "has_migrations": 1,
      "migration_notes": "Run ALTER TABLE...",
      "created_at": "2026-02-27 09:00:00"
    }
  ]
}
```

#### POST — Create Update Record

**Request Body:**
```json
{
  "version": "2.2.0",
  "description": "New features",
  "file_path": "uploads/updates/2.2.0_file.zip",
  "has_migrations": true,
  "migration_notes": "Schema changes required"
}
```

**Response (200):**
```json
{ "success": true, "message": "Update created successfully", "id": 11 }
```

#### PUT — Modify Update

**Request Body:**
```json
{
  "id": 11,
  "software_id": 2,
  "version": "2.2.1",
  "description": "Updated description",
  "has_migrations": false,
  "migration_notes": "",
  "file_path": "new/path.zip"
}
```

All fields except `id` are optional.

**Response (200):**
```json
{ "success": true, "message": "Update modified successfully" }
```

#### DELETE — Remove Update

**`DELETE /api/updates?id=11`**

Also deletes the associated file from disk if it exists.

**Response (200):**
```json
{ "success": true, "message": "Update deleted successfully" }
```

---

### 7. Upload

**`POST /api/upload`** — API Key Required

Uploads an update package file with metadata. Uses `multipart/form-data`.

**Authentication:** Requires `X-API-Key` header (not Bearer token).

**API Key:** `softaware_test_update_key_2026`

**Request (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updatePackage` | File | Yes | The update archive file |
| `software_id` | String | Yes | Target software ID |
| `version` | String | Yes | Version string |
| `description` | String | Yes | Release notes |
| `has_migrations` | String | No | `"1"` or `"0"` |
| `migration_notes` | String | No | Migration instructions |
| `checksum` | String | No | File checksum |
| `update_id` | Int | No | Existing update ID (for replacing) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Update uploaded successfully",
  "update_id": 11,
  "file_path": "uploads/updates/2.2.0_1709123456_update.zip",
  "checksum": "abc123..."
}
```

**Behavior:**
- If `update_id` is provided: replaces the existing update's file and metadata, deletes old file
- If `update_id` is absent: creates a new update record
- Files stored at: `uploads/updates/<version>_<timestamp>_<sanitized_filename>`
- Filename sanitized: only `A-Za-z0-9._-` allowed, others replaced with `_`
- Optional Bearer auth provides user attribution; falls back to user ID 1

**Backward Compatibility:** The path `/upload.php` at the root is rewritten to `api/upload.php`.

---

### 8. Download

**`GET /api/download?update_id={id}`** — Public (requires software key)

Downloads an update file.

**Required Headers:**
```
X-Software-Key: <software_key>
```

**Query Parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `update_id` | Yes | The update record ID |

**Success:** Returns the file as `application/octet-stream` with `Content-Disposition: attachment`.

**Error Responses:**
- `400`: Missing update_id or software key
- `404`: Invalid software key, update not found, or file missing on disk

---

### 9. Heartbeat

**`POST /api/heartbeat`** — Public (requires software key)

Client applications call this endpoint periodically to:
1. Register or update their presence
2. Check for available updates
3. Receive remote control commands (force logout, messages)

**Request Body:**
```json
{
  "software_key": "my-software-key",
  "client_identifier": "optional-unique-id",
  "hostname": "WORKSTATION-01",
  "machine_name": "WIN-PC01",
  "os_info": "Windows 11 Pro",
  "app_version": "2.1.0",
  "user_name": "John Doe",
  "user_id": 42,
  "active_page": "/dashboard",
  "ai_sessions_active": 2,
  "ai_model": "gpt-4",
  "update_installed": false,
  "update_id": null,
  "metadata": {
    "custom_key": "custom_value"
  },
  "recent_errors": [
    {
      "type": "RuntimeException",
      "level": "error",
      "label": "Database Connection Failed",
      "message": "SQLSTATE[HY000] [2002] Connection refused",
      "file": "/app/Models/User.php",
      "line": 45,
      "trace": "#0 /app/Controllers/Api.php(12)...",
      "url": "https://portal.example.com/api/users",
      "timestamp": "2026-03-13T10:30:00+02:00"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `software_key` | Yes | Also accepted via `X-Software-Key` header |
| `client_identifier` | No | Auto-generated SHA-256 hash if omitted |
| `hostname` | No | Machine hostname |
| `machine_name` | No | Machine friendly name |
| `os_info` | No | Operating system details |
| `app_version` | No | Currently installed version |
| `user_name` | No | Logged-in user display name |
| `user_id` | No | Logged-in user ID |
| `active_page` | No | Current page/route in client app |
| `ai_sessions_active` | No | Count of active AI sessions |
| `ai_model` | No | AI model currently in use |
| `update_installed` | No | If true, records update installation |
| `update_id` | No | Which update was just installed |
| `metadata` | No | Arbitrary JSON metadata |
| `recent_errors` | No | Array of error objects to piggyback on heartbeat (see [Error Reports](#10-error-reports)) |

**Client Identifier Generation** (when not provided):
- SHA-256 hash of: `hostname|machine_name|mac_address|os_info`
- Falls back to client IP if no components available

**IP Detection Priority:**
1. `HTTP_CF_CONNECTING_IP` (Cloudflare)
2. `HTTP_X_REAL_IP`
3. `HTTP_X_FORWARDED_FOR` (first IP)
4. `REMOTE_ADDR`

**Success Response (200):**
```json
{
  "success": true,
  "client_id": 15,
  "action": "updated",
  "software": "SoftAwareCode",
  "update_available": true,
  "latest_update": {
    "id": 10,
    "version": "2.2.0",
    "description": "New features",
    "has_migrations": 1,
    "released_at": "2026-02-27 09:00:00"
  },
  "message": "Update available",
  "is_blocked": false,
  "blocked_reason": null,
  "force_logout": false,
  "server_message": null,
  "errors_received": 0
}
```

**Blocked Client Response (403):**
```json
{
  "success": false,
  "error": "Client is blocked",
  "blocked": true,
  "reason": "Unauthorized use"
}
```

**Key Behaviors:**
- `action`: `"created"` on first heartbeat, `"updated"` on subsequent
- `force_logout` and `server_message` are **one-shot** — cleared after delivery
- Blocked clients receive `403` and cannot heartbeat
- `metadata.last_check_time` is auto-appended

---

### 10. Error Reports

**`POST /api/error-report`** — Public (requires software key)  
**`GET /api/error-report`** — Admin  
**`GET /api/error-report/summaries`** — Admin

Clients report errors to the server either via this dedicated endpoint or by piggybacking on heartbeats using the `recent_errors` field.

#### POST — Submit Error Reports

**Request Body:**
```json
{
  "software_key": "20251001SILU",
  "client_identifier": "abc123def456...",
  "hostname": "WORKSTATION-01",
  "os_info": "Linux 6.5.0",
  "app_version": "2.1.0",
  "source": "backend",
  "errors": [
    {
      "type": "RuntimeException",
      "level": "error",
      "label": "Database Connection Failed",
      "message": "SQLSTATE[HY000] [2002] Connection refused",
      "file": "/app/Models/User.php",
      "line": 45,
      "column": 12,
      "trace": "#0 /app/Controllers/Api.php(12): User->find()\n#1 ...",
      "url": "https://portal.example.com/api/users",
      "request": {
        "method": "GET",
        "uri": "/api/users",
        "route": "users.index",
        "ip": "196.xxx.xxx.xxx",
        "user_agent": "Mozilla/5.0..."
      },
      "timestamp": "2026-03-13T10:30:00+02:00"
    }
  ],
  "metadata": {
    "php_version": "8.2.28",
    "server_software": "Apache/2.4.63",
    "portal_type": "Silulumanzi Portal",
    "reported_at": "2026-03-13T10:30:05+02:00"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `software_key` | Yes | Also accepted via `X-Software-Key` header |
| `client_identifier` | Yes | The same identifier used in heartbeats |
| `hostname` | No | Machine hostname |
| `os_info` | No | Operating system details |
| `app_version` | No | Currently installed version |
| `source` | No | `"backend"` (default) or `"frontend"` |
| `errors` | Yes | Array of error objects (min 1) |
| `metadata` | No | Extra context (PHP version, server software, etc.) |

**Error Object Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Error class/type (e.g. `"RuntimeException"`, `"TypeError"`) |
| `level` | Yes | `"error"`, `"warning"`, or `"notice"` |
| `label` | Yes | Short human-readable label |
| `message` | Yes | Full error message |
| `file` | No | Source file where error occurred |
| `line` | No | Line number |
| `column` | No | Column number |
| `trace` | No | Stack trace string |
| `url` | No | URL where error occurred |
| `request` | No | Request context object |
| `request.method` | No | HTTP method (GET, POST, etc.) |
| `request.uri` | No | Request URI |
| `request.route` | No | Named route |
| `request.ip` | No | Client IP |
| `request.user_agent` | No | Browser/client user agent |
| `timestamp` | No | When the error occurred (ISO 8601). Defaults to server time if omitted |

**Success Response (200):**
```json
{
  "success": true,
  "received": 3,
  "message": "Error report received"
}
```

**Blocked Client Response (403):**
```json
{
  "success": false,
  "blocked": true,
  "reason": "Client is blocked"
}
```

**Key Behaviors:**
- Errors are stored individually in `error_reports` table
- Per-client summary counts are auto-maintained in `client_error_summaries`
- Blocked clients cannot submit error reports
- The `errors` array is validated — each error must have `type`, `level`, `label`, and `message`
- Messages are truncated to 65,000 characters

#### Heartbeat Piggybacking

As an alternative to the dedicated endpoint, clients can include a `recent_errors` array in their heartbeat payload. The format is the same as the `errors` array above:

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "abc123...",
  "hostname": "WORKSTATION-01",
  "app_version": "2.1.0",
  "recent_errors": [
    {
      "type": "Warning",
      "level": "warning",
      "label": "Deprecated API Usage",
      "message": "Method X is deprecated, use Y instead",
      "file": "/app/Services/Legacy.php",
      "line": 88,
      "timestamp": "2026-03-13T10:25:00+02:00"
    }
  ]
}
```

The heartbeat response includes `errors_received` count confirming how many were stored.

#### GET — Browse Error Reports (Admin)

**Query Parameters:**

| Parameter | Description |
|-----------|-------------|
| `software_key` | Filter by software key |
| `client_identifier` | Filter by client |
| `level` | Filter by level: `error`, `warning`, `notice` |
| `source` | Filter by source: `backend`, `frontend` |
| `hostname` | Filter by hostname (partial match) |
| `limit` | Max results (default 200, max 1000) |
| `offset` | Pagination offset |

**Response:**
```json
{
  "success": true,
  "errors": [
    {
      "id": 5,
      "software_key": "20251001SILU",
      "software_name": "Silulumanzi Portal",
      "client_identifier": "abc123...",
      "hostname": "WORKSTATION-01",
      "source": "backend",
      "error_type": "RuntimeException",
      "error_level": "error",
      "error_label": "Database Connection Failed",
      "error_message": "SQLSTATE[HY000] [2002] Connection refused",
      "error_file": "/app/Models/User.php",
      "error_line": 45,
      "error_trace": "#0 ...",
      "error_url": "https://portal.example.com/api/users",
      "app_version": "2.1.0",
      "error_occurred_at": "2026-03-13 08:30:00",
      "received_at": "2026-03-13 08:30:05"
    }
  ],
  "total": 42,
  "limit": 200,
  "offset": 0
}
```

#### GET /summaries — Per-Client Error Summaries (Admin)

**Response:**
```json
{
  "success": true,
  "summaries": [
    {
      "id": 1,
      "software_key": "20251001SILU",
      "software_name": "Silulumanzi Portal",
      "client_identifier": "abc123...",
      "hostname": "WORKSTATION-01",
      "total_errors": 12,
      "total_warnings": 5,
      "total_notices": 3,
      "last_error_message": "Connection refused",
      "last_error_at": "2026-03-13 08:30:00"
    }
  ]
}
```

---

### 11. Clients

**`GET /api/clients`** — Admin  
**`GET /api/clients?id={id}`** — Admin  
**`GET /api/clients?software_id={id}`** — Admin  
**`PUT /api/clients`** — Admin  
**`DELETE /api/clients?id={id}`** — Admin

Admin-only endpoint for viewing and managing connected clients.

#### GET — List All / Single / Filtered

**Response:**
```json
{
  "success": true,
  "clients": [
    {
      "id": 15,
      "software_id": 2,
      "client_identifier": "abc123...",
      "ip_address": "196.xxx.xxx.xxx",
      "hostname": "WORKSTATION-01",
      "machine_name": "WIN-PC01",
      "os_info": "Windows 11",
      "app_version": "2.1.0",
      "user_name": "John Doe",
      "user_id": 42,
      "active_page": "/dashboard",
      "ai_sessions_active": 2,
      "ai_model": "gpt-4",
      "force_logout": 0,
      "server_message": null,
      "software_name": "Silulumanzi Portal",
      "last_update_version": "2.1.0",
      "seconds_since_heartbeat": 45,
      "status": "online",
      "metadata": { "custom_key": "value" }
    }
  ]
}
```

**Computed `status` values:**

| Status | Condition |
|--------|-----------|
| `online` | Last heartbeat < 5 minutes ago |
| `recent` | Last heartbeat < 24 hours ago |
| `inactive` | Last heartbeat < 7 days ago |
| `offline` | Last heartbeat ≥ 7 days ago |

JSON `metadata` is automatically decoded in responses.

#### PUT — Client Actions

**Request Body:**
```json
{
  "id": 15,
  "action": "block",
  "reason": "Unauthorized access"
}
```

| Action | Required Fields | Description |
|--------|----------------|-------------|
| `block` | `id`, `reason` (opt) | Block client from heartbeating |
| `unblock` | `id` | Remove block |
| `force_logout` | `id` | Queue a force-logout command |
| `send_message` | `id`, `message` | Queue a message for next heartbeat |

**Responses:**
```json
{ "success": true, "action": "blocked" }
{ "success": true, "message": "Force logout queued" }
{ "success": true, "message": "Message queued" }
```

#### DELETE — Remove Client

**`DELETE /api/clients?id=15`**

```json
{ "success": true }
```

---

### 11. Users

**`GET /api/users`** — Admin  
**`GET /api/users?id={id}`** — Admin  
**`POST /api/users`** — Admin  
**`PUT /api/users`** — Admin  
**`DELETE /api/users?id={id}`** — Admin

Full CRUD for user management. Admin-only.

#### GET — List / Single

Dynamically builds SELECT query based on available columns (`email`, `role`, `is_admin`, `created_at`, `updated_at`).

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@softaware.co.za",
      "role": "admin",
      "is_admin": 1,
      "created_at": "2026-01-01 00:00:00",
      "updated_at": "2026-02-28 10:00:00"
    }
  ]
}
```

#### POST — Create User

**Request Body:**
```json
{
  "username": "newuser",
  "password": "securepass",
  "email": "user@example.com",
  "role": "developer",
  "is_admin": 0
}
```

- `password` is hashed with `password_hash(PASSWORD_DEFAULT)` (bcrypt)
- `role` defaults to `"viewer"`
- `is_admin` defaults to `0`
- Dynamically handles schema variations (with/without `role`, `created_at`, `updated_at`)

**Response (200):**
```json
{ "success": true, "message": "User created successfully", "id": 8 }
```

**Error (409):** `{ "success": false, "error": "Username already exists" }`

#### PUT — Update User

**Request Body:**
```json
{
  "id": 8,
  "username": "updated_name",
  "password": "newpassword",
  "email": "new@email.com",
  "role": "qa_specialist",
  "is_admin": 0
}
```

All fields except `id` are optional. Password is re-hashed if provided.

**Response (200):**
```json
{ "success": true, "message": "User updated successfully" }
```

#### DELETE — Remove User

**`DELETE /api/users?id=8`**

**Response (200):**
```json
{ "success": true, "message": "User deleted successfully" }
```

---

### 12. Modules

**`GET /api/modules`** — Authenticated  
**`GET /api/modules?id={id}`** — Authenticated  
**`GET /api/modules?software_id={id}`** — Authenticated  
**`POST /api/modules`** — Admin  
**`PUT /api/modules?id={id}`** — Admin  
**`DELETE /api/modules?id={id}`** — Admin

Manages software modules (functional components within a software product).

#### GET — List / Single

**Response:**
```json
{
  "success": true,
  "modules": [
    {
      "id": 1,
      "software_id": 2,
      "name": "Authentication System",
      "description": "Login, logout, session management, JWT tokens",
      "software_name": "Silulumanzi Portal",
      "developer_count": 2,
      "created_at": "2026-02-13 10:00:00",
      "updated_at": "2026-02-13 10:00:00"
    }
  ]
}
```

- `developer_count`: Number of distinct developers assigned to this module
- Can filter by `?software_id=N`

#### POST — Create Module

**Request Body:**
```json
{
  "software_id": 2,
  "name": "New Module",
  "description": "Module description"
}
```

**Response (200):**
```json
{ "success": true, "message": "Module created successfully", "module": { "..." } }
```

**Error (409):** Duplicate module name per software.

#### PUT — Update Module

**`PUT /api/modules?id=5`**

**Request Body:**
```json
{
  "name": "Renamed Module",
  "description": "Updated description"
}
```

#### DELETE — Remove Module

**`DELETE /api/modules?id=5`**

---

### 13. Module Developers

**`GET /api/modules/{module_id}/developers`** — Authenticated  
**`POST /api/modules/{module_id}/developers`** — Admin  
**`DELETE /api/modules/{module_id}/developers?user_id={id}`** — Admin

Manages developer assignments to modules.

#### GET — List Developers for Module

**Response:**
```json
{
  "success": true,
  "developers": [
    {
      "assignment_id": 1,
      "user_id": 5,
      "module_id": 1,
      "assigned_at": "2026-02-13 10:00:00",
      "username": "sakhile",
      "email": "sakhile@example.com",
      "role": "developer",
      "is_admin": false,
      "module_name": "Authentication System"
    }
  ]
}
```

#### POST — Assign Developer

**Request Body:**
```json
{ "user_id": 5 }
```

**Validation:**
- Module must exist
- User must exist
- User must have `developer` or `admin` role (if role column exists)
- No duplicate assignments

**Response (201):**
```json
{ "success": true, "assignment": { "..." } }
```

#### DELETE — Remove Developer

**`DELETE /api/modules/1/developers?user_id=5`**

```json
{ "success": true, "message": "Developer removed from module" }
```

---

### 14. Installed Updates

**`GET /api/installed`** — Public

Returns updates that have been marked as installed (from `tb_installed_updates` join table).

**Response:**
```json
{
  "success": true,
  "installed": [
    {
      "update_id": 10,
      "status": "installed",
      "installed_at": "2026-02-20 12:00:00",
      "version": "2.1.0",
      "description": "Bug fixes",
      "file_path": "uploads/updates/2.1.0_file.zip"
    }
  ]
}
```

---

### 15. Schema

**`GET /api/schema?id={update_id}`** — Public

Retrieves the SQL schema file content for a specific update.

**Response:**
```json
{
  "success": true,
  "schema": "CREATE TABLE IF NOT EXISTS ..."
}
```

Reads from `uploads/<schema_file>` path stored in the update record.

---

### 16. Password Reset

**`POST /api/password_reset`** — Public

Initiates a password reset by generating a 6-digit OTP and emailing it.

**Request Body:**
```json
{ "identifier": "admin" }
```
*or*
```json
{ "identifier": "admin@example.com" }
```

**Response (200):**
```json
{
  "success": true,
  "message": "If the account exists, a reset code has been sent.",
  "dev_otp": "123456"
}
```

**Notes:**
- `dev_otp` only returned when `APP_ENV=development`
- OTP is 6 digits, expires in 15 minutes
- Auto-creates `password_reset_tokens` table if it doesn't exist
- Cleans up expired tokens on each request
- Response intentionally does not reveal if user exists (security)
- Email sent via PHP `mail()` function

---

### 17. Verify OTP

**`POST /api/verify_otp`** — Public

Validates an OTP code without resetting the password. Used for the two-step flow.

**Request Body:**
```json
{
  "identifier": "admin",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user_id": 1,
  "username": "admin"
}
```

**Error (400):**
```json
{ "success": false, "error": "Invalid or expired reset code" }
```

---

### 18. Reset Password

**`POST /api/reset_password`** — Public

Completes the password reset using a valid OTP and new password.

**Request Body:**
```json
{
  "identifier": "admin",
  "otp": "123456",
  "new_password": "mynewpassword"
}
```

**Validation:**
- All three fields required
- Password minimum 6 characters
- OTP must be valid, unexpired, and unused
- Expiry checked in UTC

**Success Response (200):**
```json
{ "success": true, "message": "Password has been reset successfully" }
```

**Behavior:**
- Marks OTP token as used
- Hashes new password with `password_hash(PASSWORD_DEFAULT)`
- Updates `updated_at` if column exists
- Cleans up all tokens for this user

---

### 19. API Status

**`GET /api/api_status`** — Public

Returns comprehensive system status including database health and schema details.

**Response:**
```json
{
  "timestamp": "2026-02-28 14:00:00",
  "api_version": "1.1.0",
  "status": "operational",
  "database": {
    "connected": true,
    "total_users": 8,
    "users_table": {
      "has_email": true,
      "has_role": true,
      "has_is_admin": true,
      "has_created_at": true,
      "has_updated_at": true
    },
    "tables": {
      "clients": 15,
      "software": 5,
      "updates": 23,
      "modules": 45,
      "user_modules": 20
    },
    "role_distribution": {
      "admin": 1,
      "developer": 3,
      "viewer": 2,
      "qa_specialist": 1,
      "deployer": 1
    }
  },
  "features": {
    "role_support": "enabled"
  }
}
```

Also supports CLI output with formatted text when run via `php api_status.php`.

---

## User Roles

Roles are an **optional enhancement**. The API dynamically detects if the `role` column exists and adapts.

| Role | Description |
|------|-------------|
| `admin` | Full system access |
| `client_manager` | Manages client accounts and tasks |
| `qa_specialist` | Quality assurance and testing |
| `developer` | Code implementation |
| `deployer` | Deployment management |
| `viewer` | Read-only access (default) |

**Admin determination:** User ID 1 is always admin. Additionally, `is_admin = 1` flag is checked.

---

## Remote Control (Client Commands)

The heartbeat system supports **one-shot remote commands** from admin → client:

### Force Logout
1. Admin sends: `PUT /api/clients` with `{ "id": 15, "action": "force_logout" }`
2. Sets `force_logout = 1` on the client record
3. Next heartbeat response includes `"force_logout": true`
4. After delivery, flag is reset to `0`

### Server Message
1. Admin sends: `PUT /api/clients` with `{ "id": 15, "action": "send_message", "message": "Please update" }`
2. Stores message and generates unique `server_message_id`
3. Next heartbeat response includes `"server_message": "Please update"`
4. After delivery, message and ID are cleared to `NULL`

### Client Blocking
1. Admin sends: `PUT /api/clients` with `{ "id": 15, "action": "block", "reason": "..." }`
2. Sets `is_blocked = 1`, records timestamp and reason
3. Blocked clients receive `403` on all heartbeat attempts
4. Unblock via `{ "id": 15, "action": "unblock" }`

---

## Error Handling

All endpoints return consistent JSON error responses:

```json
{ "success": false, "error": "Error message here" }
```

### Standard HTTP Status Codes

| Code | Usage |
|------|-------|
| `200` | Success |
| `201` | Created (module developer assignments) |
| `400` | Bad request / missing fields |
| `401` | Authentication required or failed |
| `403` | Admin access required or client blocked |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Conflict (duplicate username, module name, assignment) |
| `500` | Server error |

---

## File Storage

Update files are stored in the filesystem:

```
public_html/uploads/updates/<version>_<timestamp>_<sanitized_name>
```

- **Upload directory:** `public_html/uploads/updates/`
- **Database stores:** Relative path `uploads/updates/filename.zip`
- **Download resolves:** `__DIR__ . '/../' . file_path`
- **Naming pattern:** `<version>_<unix_timestamp>_<safe_filename>`
- **Sanitization:** Only `A-Za-z0-9._-` characters kept; others become `_`
- **Old files deleted** when replacing an existing update via `update_id`

---

## Migrations

Located in `api/migrations/`:

### 1. `add_user_roles.sql`
Adds optional `role` column to `users` table with index and migrates admins.

### 2. `add_modules_tables.sql`
Creates `modules` and `user_modules` tables with foreign keys and unique constraints.

### 3. `add_heartbeat_extended_fields.sql`
Adds extended client tracking fields: `user_name`, `user_id`, `active_page`, `ai_sessions_active`, `ai_model`, `force_logout`, `server_message`, `server_message_id`.

### Running Migrations

```bash
# User roles (PHP script with validation)
cd /var/opt/updates.softaware.co.za/public_html/api/migrations
php migrate_user_roles.php

# SQL migrations (run directly)
mysql -u softaware_user -p updates < add_modules_tables.sql
mysql -u softaware_user -p updates < add_heartbeat_extended_fields.sql
```

---

## Security Notes

1. **Tokens are not JWTs** — They are Base64-encoded `user:pass` pairs. Every request re-verifies credentials against the database. This means password changes take effect immediately.

2. **Upload API Key** — The upload endpoint uses a separate API key (`X-API-Key` header) rather than Bearer auth. The key is hardcoded: `softaware_test_update_key_2026`.

3. **Password storage** — All passwords are hashed with `password_hash(PASSWORD_DEFAULT)` (bcrypt).

4. **SQL injection protection** — All queries use PDO prepared statements with parameterized inputs.

5. **File access restrictions** — `.htaccess` blocks access to `.sql`, `.log`, and `.env` files.

6. **Directory listing disabled** — `Options -Indexes` in `.htaccess`.

7. **Password reset security** — Responses never reveal whether a user/email exists. OTPs expire in 15 minutes.

8. **CORS** — Currently set to `*` (all origins). Should be restricted in production.

9. **Backward compatibility** — The API dynamically detects available database columns and adapts queries. Missing optional columns (role, email, created_at, updated_at) do not break the API.
