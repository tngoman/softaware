# SoftAware Updates — Client Integration Specification

> **Version:** 4.0.0  
> **Last Updated:** 2026-03-18  
> **Status:** Active  
> **Base URL:** `https://updates.softaware.net.za`  
> **API Prefix:** `/api/updates`  
> **Reference Implementations:**  
> - Silulumanzi Portal (PHP) — `portal/app/Controllers/ApiUpdates.php`  
> - SoftAware Desktop App — `/var/opt/desktop`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Client Identity](#3-client-identity)
4. [Telemetry & Privacy Model](#4-telemetry--privacy-model)
5. [Heartbeat Protocol](#5-heartbeat-protocol)
6. [Heartbeat Queue (Offline Retry)](#6-heartbeat-queue-offline-retry)
7. [Lightweight Update Check](#7-lightweight-update-check)
8. [Error Reporting](#8-error-reporting)
9. [Update Download](#9-update-download)
10. [Software & Release Discovery](#10-software--release-discovery)
11. [Admin Endpoints](#11-admin-endpoints)
12. [Remote Commands](#12-remote-commands)
13. [IP Masking](#13-ip-masking)
14. [Data Retention](#14-data-retention)
15. [Common Response Patterns](#15-common-response-patterns)
16. [Rate Limiting & Best Practices](#16-rate-limiting--best-practices)
17. [Migration Guide — v3 to v4](#17-migration-guide--v3-to-v4)
18. [Complete Endpoint Reference](#18-complete-endpoint-reference)
19. [Appendix — Data Types](#19-appendix--data-types)

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
│  PHP Portal       │ ──────────────────────▶│  Node.js / TypeScript │
│  (Silulumanzi)    │                        └──────────┬───────────┘
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

### 1.4 What's New in v4

| Aspect | v3 (Previous) | v4 (Current) |
|--------|--------------|--------------|
| Payload shape | Fixed — all fields always present | Variable — fields grouped into telemetry categories |
| `hostname`, `machine_name`, `os_info` | Always present | Present only when **Environment** category is enabled |
| `user_name`, `user_id`, `active_page` | Always present | **REMOVED** — replaced with anonymous usage tracking (`metadata.usage`) |
| `recent_errors` | Always present | Present only when **Performance** category is enabled |
| `metadata.ip_masked` | Not sent | Sent as `true` when client requests IP masking |
| `metadata.retention_hint` | Not sent | Always sent — tells server how long to keep data |
| Failed heartbeats | Lost on network failure | Queued locally and replayed via `queued_heartbeats` array |
| `queued_processed` in response | Not present | Returns count of replayed heartbeats processed |
| Invalid software key | 400 | 404 |
| Blocked client | 403 `{ success: false, ... }` | 403 `{ blocked: true, reason: ... }` |

> **Key Principle:** The server treats all non-essential fields as optional. A strict-mode client sends only `software_key`, `client_identifier`, `app_version`, `update_installed`, and `metadata` (with `check_time`, `portal_type`, `retention_hint`). Every other field may be absent.

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

**Generation algorithm (desktop / Node.js):**

```typescript
import { createHash } from 'crypto';
import os from 'os';

function generateClientIdentifier(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch     = os.arch();
  const cpuModel = os.cpus()[0]?.model || 'unknown';

  const raw = `${hostname}|${platform}|${arch}|${cpuModel}`;
  return createHash('sha256').update(raw).digest('hex');
}
```

**Generation algorithm (PHP / web portals):**

```php
$raw = implode('|', [
    gethostname(),
    PHP_OS_FAMILY,
    php_uname('m'),
    php_uname('n'),
    $_SERVER['HTTP_HOST'] ?? 'unknown',
]);
$clientIdentifier = hash('sha256', $raw);
```

**Example output:** `a3f8c2d1e5b7...` (64-char hex string)

> **Fallback:** If the client does not send a `client_identifier`, the server generates one from: `hostname|machine_name|os_info|ip_address`.

### 3.2 When to Generate

- Generate **once** at application startup
- **Cache** the value for the lifetime of the process
- Send with **every** heartbeat and error report

---

## 4. Telemetry & Privacy Model

Starting with v4, clients can control what data is shared via a **telemetry settings system**. Portal administrators configure preferences through **Settings → Telemetry & Privacy**.

### 4.1 Telemetry Categories

Data fields are grouped into four categories:

| Category | Fields Included | Can Be Disabled |
|----------|----------------|-----------------|
| **Essential** | `software_key`, `client_identifier`, `app_version`, `update_installed`, `metadata.check_time`, `metadata.portal_type`, `metadata.retention_hint` | ❌ No — always sent |
| **Environment** | `hostname`, `machine_name`, `os_info`, `metadata.php_version`, `metadata.server_software`, `metadata.environment`, `metadata.http_host` | ✅ Yes |
| **Performance** | `metadata.error_summary`, `recent_errors[]` | ✅ Yes |
| **Usage** | `metadata.usage` (`session_duration`, `active_module`, `feature_usage`) — **anonymous only, NO user identity** | ✅ Yes |

### 4.2 Presets

| Preset | Environment | Performance | Usage | IP Mask | Strip Params | Path Mode |
|--------|-------------|-------------|-------|---------|--------------|-----------|
| **Strict** | ❌ off | ❌ off | ❌ off | ✅ on | ✅ on | `slugs` |
| **Balanced** (default) | ✅ on | ✅ on | ❌ off | ✅ on | ✅ on | `params` |
| **Full** | ✅ on | ✅ on | ✅ on | ❌ off | ❌ off | `off` |

### 4.3 Privacy Signals

| Signal | Field | Description | Server Action |
|--------|-------|-------------|---------------|
| IP Masking | `metadata.ip_masked = true` | Client requests IP anonymization | Mask last octet before storage (see §13) |
| Data Retention | `metadata.retention_hint` | Requested TTL for this data | Schedule auto-deletion (see §14) |
| Field Absence | (field not present) | Consent not given for this data | Store NULL — do NOT infer from other sources |

### 4.4 Client Implementation

Clients build payloads dynamically based on telemetry settings. The server must never reject a heartbeat for missing optional fields.

```
Strict Client  → { software_key, client_identifier, app_version, metadata }
Balanced Client → + hostname, machine_name, os_info, recent_errors
Full Client     → + metadata.usage (anonymous: session_duration, active_module, feature_usage)
```

---

## 5. Heartbeat Protocol

The heartbeat is the primary communication channel between clients and the server. It serves five purposes:

1. **Registration** — First heartbeat creates the client record
2. **Status reporting** — Machine info, anonymous usage metrics (per telemetry settings)
3. **Update checking** — Server responds with available updates
4. **Command delivery** — Server delivers force_logout, messages, block status
5. **Error piggybacking** — Client attaches recent errors (per performance category)

### 5.1 Endpoint

```
POST /api/updates/heartbeat
```

### 5.2 Request Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `Accept` | `application/json` | Yes |
| `X-Software-Key` | `"20251001SILU"` | Yes (or in body) |
| `User-Agent` | Client identifier string | No |

### 5.3 Request Body — Payload Structure

```
┌────────────────────────────────────────────────────────────────────┐
│                    HEARTBEAT PAYLOAD STRUCTURE                     │
│                         Version 4.0.0                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌── ESSENTIAL (always present) ───────────────────────────────┐  │
│  │  software_key          "20251001SILU"                       │  │
│  │  client_identifier     SHA-256 hash                         │  │
│  │  app_version           "47.117.8"                           │  │
│  │  update_installed      false | true                         │  │
│  │  metadata.check_time   ISO 8601 timestamp                   │  │
│  │  metadata.portal_type  "Silulumanzi Portal"                 │  │
│  │  metadata.retention_hint  "24h"|"7d"|"30d"|"90d"            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── ENVIRONMENT (when enabled) ───────────────────────────────┐  │
│  │  hostname              "ZASIL-ASWEBAPP01 [production]"      │  │
│  │  machine_name          "ZASIL-ASWEBAPP01"                   │  │
│  │  os_info               "Linux 5.15.0-91-generic"            │  │
│  │  metadata.php_version       "8.3.4"                         │  │
│  │  metadata.server_software   "Apache/2.4.58"                 │  │
│  │  metadata.environment       "production"|"quality"|"local"  │  │
│  │  metadata.http_host         "portal.silulumanzi.co.za"      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── PERFORMANCE (when enabled) ───────────────────────────────┐  │
│  │  metadata.error_summary  { total, critical, ... }           │  │
│  │  recent_errors           [ { error_type, message, ... } ]   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── USAGE (when enabled) ─────────────────────────────────────┐  │
│  │  metadata.usage        { session_duration, active_module,   │  │
│  │                          feature_usage } — ANONYMOUS ONLY   │  │
│  │  NO user_name, user_id, or entity IDs                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── PRIVACY SIGNALS ─────────────────────────────────────────┐   │
│  │  metadata.ip_masked    true  (only when IP masking on)      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── QUEUE REPLAY (when queued heartbeats exist) ──────────────┐  │
│  │  queued_heartbeats     [ { payload, reason, queued_at } ]   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── INSTALLATION (only on install notification) ──────────────┐  │
│  │  last_update_id        15                                   │  │
│  │  metadata.installation_time    ISO 8601                     │  │
│  │  metadata.previous_version     "47.116.3"                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.4 Field Reference

#### Essential Fields (always present)

| Field | Type | Required | Description |
|---|---|---|---|
| `software_key` | string | **Yes**¹ | Your product's software key |
| `client_identifier` | string(64) | **Recommended** | SHA-256 machine fingerprint (server generates fallback if omitted) |
| `app_version` | string | **Yes** | Semantic version from `version.json` (e.g., `"47.117.8"`) |
| `update_installed` | boolean | No | `true` only on installation notification heartbeats |
| `metadata.check_time` | string (ISO 8601) | **Yes** | When the heartbeat was generated |
| `metadata.portal_type` | string | **Yes** | Product name (e.g., `"Silulumanzi Portal"`) |
| `metadata.retention_hint` | string | **Yes** | Requested data retention: `"24h"`, `"7d"`, `"30d"`, `"90d"` |

> ¹ Can alternatively be sent via `X-Software-Key` header

#### Environment Fields (conditional)

Present only when the **Environment** telemetry category is enabled.

| Field | Type | Description |
|---|---|---|
| `hostname` | string | Machine hostname (e.g., `"ZASIL-ASWEBAPP01 [production]"`) |
| `machine_name` | string | Machine display name |
| `os_info` | string | OS version string (e.g., `"Linux 5.15.0-91-generic"`) |
| `metadata.php_version` | string | PHP version (web portals) |
| `metadata.server_software` | string | Server software (e.g., `"Apache/2.4.58"`) |
| `metadata.environment` | string | `"production"` \| `"quality"` \| `"local"` \| `"unknown"` |
| `metadata.http_host` | string | HTTP host (e.g., `"portal.silulumanzi.co.za"`) |

#### Performance Fields (conditional)

Present only when the **Performance** telemetry category is enabled.

| Field | Type | Description |
|---|---|---|
| `metadata.error_summary` | object \| null | Aggregated error counts: `{ total, critical, error, warning, last_error_at }` |
| `recent_errors` | array | Up to 10 recent error objects (see §8.3 for schema) |

#### Usage Fields (conditional)

Present only when the **Usage** telemetry category is enabled.

> **IMPORTANT:** v4.0.0 replaces user identity tracking with **anonymous usage analytics**. NO `user_name`, `user_id`, or entity IDs are sent.

| Field | Type | Description |
|---|---|---|
| `metadata.usage` | object | Anonymous usage metrics object |
| `metadata.usage.session_duration` | integer | Seconds since session start (e.g., `3600`) |
| `metadata.usage.active_module` | string | Generic module slug — no entity IDs (e.g., `"quotes_module"`) |
| `metadata.usage.feature_usage` | object | Aggregate click/action counters (e.g., `{ "click_save_quote": 5, "view_budget": 3 }`) |

#### Additional Fields (optional, any telemetry level)

| Field | Type | Description |
|---|---|---|
| `ai_sessions_active` | number | Count of active AI/chat sessions |
| `ai_model` | string | AI model currently in use |
| `last_update_id` | number \| string | ID of the last installed update (on installation notification) |
| `metadata.installation_time` | string (ISO 8601) | When the update was installed |
| `metadata.previous_version` | string | Version before the update |

#### Privacy Signal Fields

| Field | Type | When Present | Server Action |
|---|---|---|---|
| `metadata.ip_masked` | `true` | When client has IP masking enabled | Server masks source IP before storage (see §13) |

#### Queue Replay Fields

| Field | Type | When Present |
|---|---|---|
| `queued_heartbeats` | array | When the client has previously failed heartbeats to replay (see §6) |

### 5.5 Successful Response (200)

```json
{
  "success": true,
  "client_id": 42,
  "action": "updated",
  "software": "Silulumanzi Portal",
  "update_available": true,
  "latest_update": {
    "id": 64,
    "version": "48.0.0",
    "description": "<ul><li>Telemetry & Privacy settings</li></ul>",
    "created_at": "2026-03-18T08:00:00+02:00",
    "download_url": "https://updates.softaware.net.za/api/updates/download?update_id=64&software_key=20251001SILU"
  },
  "message": "Update available",
  "is_blocked": false,
  "force_logout": false,
  "server_message": null,
  "errors_received": 5,
  "queued_processed": 1
}
```

### 5.6 No Update Response (200)

```json
{
  "success": true,
  "client_id": 42,
  "action": "updated",
  "software": "Silulumanzi Portal",
  "update_available": false,
  "latest_update": null,
  "message": "Portal is up to date",
  "is_blocked": false,
  "force_logout": false,
  "server_message": null,
  "errors_received": 0,
  "queued_processed": 0
}
```

### 5.7 Blocked Client Response (403)

```json
{
  "blocked": true,
  "reason": "License expired"
}
```

### 5.8 Module Slug Anonymization

In v4, the `metadata.usage.active_module` field uses module slugs rather than raw URLs. The server stores the value as-is — it does NOT further process it. Module slugs are always anonymized (no entity IDs, no query parameters).

| Example Input (client-side) | Module Slug Output | Description |
|-----------------------------|-------------------|-------------|
| `/dashboard/quotes/123?tab=items` | `quotes_module` | Generic module identifier |
| `/dashboard/budgets/view?id=5` | `budgets_module` | No entity IDs or params |
| `/settings` | `settings_module` | Simple module name |

### 5.9 Heartbeat Timing

| Context | Recommended Interval |
|---|---|
| **Normal operation** | Every 60 seconds |
| **Idle / background** | Every 300 seconds |
| **After error burst** | Immediately (to piggyback errors) |
| **First launch** | Immediately on app startup |

### 5.10 Client Behavior on Response

| Field | Action |
|---|---|
| `update_available: true` | Show update notification; use `latest_update.download_url` for download |
| `force_logout: true` | Immediately log out current user and return to login screen |
| `server_message` (non-null) | Display the message in a toast/dialog/notification |
| `is_blocked: true` or HTTP 403 | Display block reason and stop heartbeating |
| `errors_received > 0` | Confirmation that piggybacked errors were stored; clear local error queue |
| `queued_processed > 0` | Confirmation that queued heartbeats were replayed; clear local queue |

### 5.11 First Heartbeat — Client Creation

On the first heartbeat from an unknown `client_identifier`:
- The server creates a new record in `update_clients`
- Returns `"action": "created"`

On subsequent heartbeats:
- The server updates the existing record
- Returns `"action": "updated"`

---

## 6. Heartbeat Queue (Offline Retry)

When the client cannot reach the updates server (network outage, DNS failure, timeout), it queues failed heartbeats locally and replays them on the next successful connection.

### 6.1 Client-Side Queue Rules

- Maximum queue size: **50 entries** (oldest discarded when full)
- Queue is only active when `telemetry_queue_enabled = '1'`
- Queued entries are stored as JSON: `storage/heartbeat_queue.json`
- On each successful heartbeat, queued entries are attached as `queued_heartbeats`
- Queue file is cleared immediately after attachment (before the request is sent)

### 6.2 Queue Entry Format

Each item in `queued_heartbeats`:

| Field | Type | Description |
|---|---|---|
| `payload` | object | The original heartbeat payload that failed to send |
| `reason` | string | Failure reason (e.g., `"cURL error: Connection timed out"`) |
| `queued_at` | string (ISO 8601) | When the heartbeat was queued locally |

### 6.3 Server Handling

1. **Process each queued heartbeat independently** — each `payload` is ingested as a separate heartbeat
2. **Use `queued_at` as the effective timestamp** — preserves correct timeline of client activity
3. **Apply privacy rules from the queued payload's own `metadata`** — not the parent heartbeat's
4. **Do not fail the parent heartbeat** if a queued entry is malformed — log and skip
5. **Return `queued_processed` count** in the response

### 6.4 Example Payload with Queue

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a1b2c3d4...",
  "app_version": "47.117.8",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T15:00:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "30d"
  },
  "queued_heartbeats": [
    {
      "payload": {
        "software_key": "20251001SILU",
        "client_identifier": "a1b2c3d4...",
        "app_version": "47.117.8",
        "update_installed": false,
        "metadata": {
          "check_time": "2026-03-18T14:00:00+02:00",
          "portal_type": "Silulumanzi Portal",
          "retention_hint": "30d",
          "ip_masked": true
        }
      },
      "reason": "cURL error: Connection timed out after 30001 milliseconds",
      "queued_at": "2026-03-18T14:00:02+02:00"
    }
  ]
}
```

---

## 7. Lightweight Update Check

For clients that only need to check if an update is available without sending telemetry or registering a heartbeat.

### 7.1 Endpoint

```
GET /api/updates/heartbeat/check
```

### 7.2 Request

| Parameter | Location | Required | Description |
|---|---|---|---|
| `software_key` | Query param **or** `X-Software-Key` header | **Yes** | Your product's software key |
| `version` or `v` or `app_version` | Query param | No | Current version to compare against |

**Examples:**
```
GET /api/updates/heartbeat/check?software_key=20251001SILU&version=47.117.8
```

```
GET /api/updates/heartbeat/check?v=47.117.8
X-Software-Key: 20251001SILU
```

### 7.3 Response (200)

```json
{
  "success": true,
  "software": "Silulumanzi Portal",
  "software_id": 1,
  "current_version": "47.117.8",
  "update_available": true,
  "latest_update": {
    "id": 64,
    "version": "48.0.0",
    "description": "Telemetry & Privacy settings",
    "has_migrations": 1,
    "released_at": "2026-03-18T00:00:00.000Z",
    "has_file": true
  },
  "message": "Update available"
}
```

### 7.4 Error Response — Unknown Key (404)

```json
{
  "error": "Unknown software key"
}
```

### 7.5 When to Use

| Scenario | Use Heartbeat | Use Check |
|---|---|---|
| Regular interval reporting | ✅ | |
| Quick startup version check | | ✅ |
| Background update polling | | ✅ |
| Need to send telemetry | ✅ | |
| Need command delivery | ✅ | |

---

## 8. Error Reporting

Clients can report errors in two ways:

1. **Piggybacked on heartbeat** — Include errors in the `recent_errors` array (requires Performance category enabled)
2. **Dedicated endpoint** — Send errors immediately, outside the heartbeat cycle

### 8.1 Dedicated Error Report Endpoint

```
POST /api/updates/error-report
```

### 8.2 Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `software_key` | string | **Yes**¹ | Your product's software key |
| `client_identifier` | string | **Yes** | SHA-256 machine fingerprint |
| `hostname` | string | No | Machine hostname |
| `machine_name` | string | No | Machine display name |
| `os_info` | string | No | OS information |
| `app_version` | string | No | App version |
| `source` | string | No | Error source: `"backend"` (default), `"frontend"`, `"desktop"`, `"mobile"` |
| `errors` | array | **Yes** | Array of error objects (see below) |
| `metadata` | object | No | Additional context (see below) |

> ¹ Can alternatively be sent via `X-Software-Key` header

### 8.3 Error Object Schema

Each item in the `errors` or `recent_errors` array:

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

> **Field name aliases:** The backend also accepts short names `type` (for `error_type`), `level` (for `error_level`), and `trace` (for `stack_trace`). The long names above are preferred.
>
> Request context can also be sent as a nested `request` object with `method`, `uri`, `route`, `ip`, and `user_agent` sub-fields.
>
> Null fields may be stripped before transmission. The server does not require all fields to be present.

### 8.4 Metadata Object (Optional)

| Field | Type | Description |
|---|---|---|
| `php_version` | string | PHP version |
| `server_software` | string | Server software string |
| `reported_at` | string | ISO 8601 timestamp |
| `portal_type` | string | Product type |
| `error_count` | number | Total errors in batch |
| `browser` | string | Browser name and version |
| `screen_resolution` | string | Screen dimensions |
| `page_url` | string | Current page URL |
| `memory_usage` | number | Memory usage percentage |
| `uptime` | string | Application uptime |
| `extra` | any | Any additional data |

### 8.5 Piggybacking Errors on Heartbeat

Include a `recent_errors` array in your heartbeat body. Each item uses the **same schema** as the dedicated error report's `errors` array:

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a3f8c2d1...",
  "app_version": "47.117.8",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "30d"
  },
  "recent_errors": [
    {
      "error_type": "php_error",
      "error_level": "error",
      "message": "Undefined array key \"name\" in /app/Controllers/ApiCustomers.php",
      "timestamp": "2026-03-18T14:15:00+02:00",
      "file": "/app/Controllers/ApiCustomers.php",
      "line": 142
    }
  ]
}
```

The heartbeat response includes `"errors_received": N` to confirm how many were stored.

### 8.6 Dedicated Response (200)

```json
{
  "success": true,
  "received": 3,
  "message": "Error report received"
}
```

### 8.7 Error Reporting Strategy

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT APP                         │
│                                                      │
│  ┌─────────────┐    ┌──────────────────────────┐    │
│  │ Error Queue  │◄───│ Global Error Handler      │    │
│  │ (in-memory)  │    │ set_error_handler (PHP)   │    │
│  └──────┬───────┘    │ window.onerror (JS)       │    │
│         │            │ try/catch wrappers         │    │
│         │            └──────────────────────────┘    │
│         │                                            │
│         ├── On next heartbeat ──▶ piggyback as       │
│         │   (up to 10 errors)    recent_errors[]     │
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

## 9. Update Download

### 9.1 Endpoint

```
GET /api/updates/download?update_id={id}
```

### 9.2 Request

| Parameter | Location | Required | Description |
|---|---|---|---|
| `update_id` | Query param | **Yes** | The update release ID (from heartbeat response `latest_update.id`) |
| `software_key` | Query param **or** `X-Software-Key` header | **Yes** | Your product's software key |

**Example:**
```
GET /api/updates/download?update_id=64&software_key=20251001SILU
```

### 9.3 Response

**Success:** Binary file stream with headers:
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="update-64-v48.0.0.zip"
```

**Errors:**

| Status | Condition |
|---|---|
| 400 | Missing `software_key` or `update_id` |
| 404 | Unknown software key or update not found |
| 404 | Update exists but has no file attached |

### 9.4 Download Flow

```
1. Receive heartbeat response with update_available: true
2. Show update notification to user
3. User accepts → GET latest_update.download_url (or construct manually)
4. Save file to temporary location
5. Verify file integrity (optional: compare checksum)
6. Apply update (extract, run migrations if has_migrations=1)
7. Send next heartbeat with last_update_id={id} + update_installed=true
```

---

## 10. Software & Release Discovery

### 10.1 List All Software Products

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
      "latest_version": "48.0.0",
      "latest_update_date": "2026-03-18T00:00:00.000Z",
      "total_updates": 12
    }
  ]
}
```

**Single product:** `GET /api/updates/software?id=1`

### 10.2 List All Update Releases

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
      "version": "48.0.0",
      "description": "Telemetry & Privacy settings",
      "file_path": "uploads/updates/...",
      "file_size": 5242880,
      "file_name": "update-v48.0.0.zip",
      "has_migrations": 1,
      "migration_notes": "ALTER TABLE ...",
      "schema_file": "schema-v48.0.0.sql",
      "released_at": "2026-03-18T00:00:00.000Z",
      "software_name": "Silulumanzi Portal",
      "uploaded_by_name": "Admin User"
    }
  ]
}
```

**Single release:** `GET /api/updates/updates?id=64`

### 10.3 Schema File Content

```
GET /api/updates/schema?id=64
```

Returns the raw SQL schema file content for migration purposes.

### 10.4 Installed Updates

```
GET /api/updates/installed
```

Returns a list of installed updates with status tracking.

---

## 11. Admin Endpoints

> All admin endpoints require `Authorization: Bearer <JWT>` with admin role.

### 11.1 Dashboard

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
  "latest_clients": [ ... ],
  "recent_updates": [ ... ]
}
```

### 11.2 Client Management

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
| Block client | `{ "id": 42, "action": "block", "reason": "Suspicious activity" }` |
| Unblock client | `{ "id": 42, "action": "unblock" }` |
| Force logout | `{ "id": 42, "action": "force_logout" }` |
| Send message | `{ "id": 42, "action": "send_message", "message": "Maintenance at 2AM" }` |

**Delete client:**
```
DELETE /api/updates/clients?id=42
```

### 11.3 Software CRUD

| Method | Path | Body |
|---|---|---|
| POST | `/api/updates/software` | `{ "name": "...", "software_key": "...", "description": "..." }` |
| PUT | `/api/updates/software` | `{ "id": 1, "name": "Updated Name" }` |
| DELETE | `/api/updates/software?id=1` | — |

### 11.4 Release CRUD

| Method | Path | Body |
|---|---|---|
| POST | `/api/updates/updates` | `{ "software_id": 1, "version": "2.2.0", "description": "..." }` |
| PUT | `/api/updates/updates` | `{ "id": 65, "description": "Updated" }` |
| DELETE | `/api/updates/updates?id=65` | — |

### 11.5 File Upload

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

### 11.6 Module Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/updates/modules` | List all modules |
| GET | `/api/updates/modules?software_id=1` | Filter by software |
| POST | `/api/updates/modules` | Create module |
| PUT | `/api/updates/modules?id=1` | Update module |
| DELETE | `/api/updates/modules?id=1` | Delete module |
| GET | `/api/updates/modules/:id/developers` | List developers |
| POST | `/api/updates/modules/:id/developers` | Assign developer |
| DELETE | `/api/updates/modules/:id/developers?user_id=uuid` | Remove developer |

---

## 12. Remote Commands

Remote commands are delivered via the heartbeat response. They are **one-shot** — once delivered, the server clears the flag.

### 12.1 Force Logout

**Server side:** Admin sets `force_logout` via `PUT /clients` with `{ "id": 42, "action": "force_logout" }`

**Client receives in heartbeat response:** `"force_logout": true`

**Client implementation:**
```typescript
if (heartbeatResponse.force_logout) {
  authStore.logout();
  router.push('/login');
  toast.warning('You have been logged out by an administrator');
}
```

### 12.2 Server Message

**Server side:** Admin sends message via `PUT /clients` with `{ "id": 42, "action": "send_message", "message": "System maintenance tonight" }`

**Client receives:** `"server_message": "System maintenance tonight"`

**Client implementation:**
```typescript
if (heartbeatResponse.server_message) {
  toast.info(heartbeatResponse.server_message, { duration: 10000 });
}
```

### 12.3 Client Blocking

**Server side:** Admin blocks client via `PUT /clients` with `{ "id": 42, "action": "block", "reason": "Unauthorized" }`

**Client receives:** HTTP 403 with `{ "blocked": true, "reason": "Unauthorized" }`

**Client implementation:**
```typescript
if (response.status === 403) {
  const data = await response.json();
  if (data.blocked) {
    showBlockedScreen(data.reason);
    stopHeartbeat();
  }
}
```

---

## 13. IP Masking

When a client sends `metadata.ip_masked = true`, the server masks the source IP address **before writing to any persistent storage**.

### 13.1 Masking Algorithm

| Original | Masked |
|---|---|
| `192.168.1.45` | `192.168.1.0` |
| `10.0.6.12` | `10.0.6.0` |
| `2001:db8::1` | `2001:db8::0` |

**IPv4:** Zero the last octet  
**IPv6:** Zero the last 64 bits (host portion)

### 13.2 Storage Rules

| `metadata.ip_masked` | Server Action |
|---|---|
| `true` | Store `masked_ip` only. Set `ip_address = NULL`. |
| absent or `false` | Store raw IP in `ip_address` as-is (default behavior). |

### 13.3 Client Behavior

- Clients set `metadata.ip_masked = true` when `telemetry_ip_masking = '1'` in local settings
- The flag is only included when masking IS requested (absent = no masking)
- Each heartbeat (including queued replays) carries its own privacy directives

---

## 14. Data Retention

Each heartbeat includes `metadata.retention_hint` indicating how long the client wants this data kept.

### 14.1 Retention Values

| Value | Duration | Default? |
|---|---|---|
| `"24h"` | 1 day | |
| `"7d"` | 7 days | |
| `"30d"` | 30 days | |
| `"90d"` | 90 days | ✅ Default (and v3 fallback) |

### 14.2 Server Behavior

- The server stores `retention_hint` alongside each client record and error report
- An `expires_at` timestamp is computed: `received_at + retention_duration`
- A daily cleanup job purges expired records
- If `retention_hint` is missing (v3 client), the server defaults to `90d`

### 14.3 Client Behavior

- Clients set `metadata.retention_hint` based on the `telemetry_retention` setting
- The hint is advisory — the server makes best effort to comply
- Shorter retention = less data stored = stronger privacy

---

## 15. Common Response Patterns

### 15.1 Success Response

All successful responses include `"success": true`:
```json
{ "success": true, "data": "..." }
```

### 15.2 Error Responses

| HTTP Status | Meaning |
|---|---|
| 400 | Missing or invalid parameters |
| 401 | Missing or invalid authentication |
| 403 | Client is blocked or insufficient permissions |
| 404 | Resource not found (unknown software key, update ID, etc.) |
| 409 | Duplicate resource (e.g., duplicate module name) |
| 500 | Server error |

**Standard error shape:**
```json
{
  "error": "Unknown software key"
}
```

### 15.3 HTTP Headers Reference

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

## 16. Rate Limiting & Best Practices

### 16.1 Heartbeat Intervals

- **Do** send heartbeats at regular intervals (60s normal, 300s idle)
- **Don't** send heartbeats more frequently than every 30 seconds
- **Do** reduce frequency when the app is minimized or in the background
- **Do** send an immediate heartbeat on app startup and on user login/logout

### 16.2 Error Reporting

- **Do** buffer errors and piggyback them on heartbeats when possible
- **Don't** send a dedicated error report for every single error — batch them
- **Do** send immediately for fatal/critical errors
- **Do** cap `recent_errors` to 10 items per heartbeat
- **Do** truncate long error messages client-side (server caps at 65,000 chars)

### 16.3 Update Downloads

- **Do** only download when the user accepts the update
- **Don't** auto-download large updates on metered connections
- **Do** confirm installation by sending `last_update_id` + `update_installed: true` in the next heartbeat

### 16.4 Resilience

- **Do** handle network failures gracefully — queue heartbeats for retry (see §6)
- **Don't** crash or block the UI if the updates server is unreachable
- **Do** implement exponential backoff for failed requests (1s, 2s, 4s, 8s, max 60s)
- **Do** continue normal operation even if the heartbeat fails

### 16.5 Telemetry & Privacy

- **Do** respect user-configured telemetry settings
- **Don't** send fields that the user has disabled
- **Do** include `metadata.retention_hint` in every heartbeat
- **Do** send `metadata.ip_masked = true` when IP masking is enabled

---

## 17. Migration Guide — v3 to v4

### 17.1 Payload Changes

| Field | v3 | v4 |
|---|---|---|
| `hostname` | Always sent | Conditional (Environment category) |
| `machine_name` | Always sent | Conditional (Environment category) |
| `os_info` | Always sent | Conditional (Environment category) |
| `user_name` | Always sent | **REMOVED** — no user identity in v4 |
| `user_id` | Always sent | **REMOVED** — no user identity in v4 |
| `active_page` | Always sent | **REMOVED** — replaced by `metadata.usage.active_module` (anonymous slug) |
| `metadata.usage` | Not sent | **NEW** — anonymous usage tracking: `session_duration`, `active_module`, `feature_usage` |
| `recent_errors` | Always sent | Conditional (Performance category) |
| `metadata.retention_hint` | Not sent | **Required** — `"24h"`, `"7d"`, `"30d"`, `"90d"` |
| `metadata.ip_masked` | Not sent | Sent as `true` when IP masking enabled |
| `queued_heartbeats` | Not sent | Sent when replaying offline heartbeats |
| `update_id` | Used for install tracking | Renamed to `last_update_id` (both accepted) |

### 17.2 Response Changes

| Field | v3 | v4 |
|---|---|---|
| `queued_processed` | Not present | Always present (integer, 0 if no queue) |
| `latest_update` | Object with basic fields | Object now includes `download_url` |
| `blocked_reason` | In response body | Now `reason` field in 403 response |

### 17.3 Backward Compatibility

- v3 clients (no `metadata.retention_hint`) are treated as `retention_hint = '90d'`, `ip_masked = false`
- v3 clients will ignore the new `queued_processed` field in responses (unknown fields are safe)
- Server accepts both `update_id` (v3) and `last_update_id` (v4) for installation tracking

### 17.4 Server Detection Heuristic

If `metadata.retention_hint` exists → v4 heartbeat. Otherwise → v3 legacy.

---

## 18. Complete Endpoint Reference

### Client Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/updates/heartbeat` | Software Key | Full heartbeat with telemetry + update check |
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
| `GET` | `/api/updates/clients/:id/errors` | JWT (admin) | List client errors |
| `DELETE` | `/api/updates/clients/:id/errors` | JWT (admin) | Clear client errors |
| `GET` | `/api/updates/clients/health-summary` | JWT (admin) | Aggregated health KPIs |
| `GET` | `/api/updates/error-report` | JWT (admin) | Browse error reports |
| `GET` | `/api/updates/error-report/summaries` | JWT (admin) | Per-client error summaries |
| `GET` | `/api/updates/modules` | JWT | List modules |
| `POST` | `/api/updates/modules` | JWT (admin) | Create module |
| `PUT` | `/api/updates/modules?id=N` | JWT (admin) | Update module |
| `DELETE` | `/api/updates/modules?id=N` | JWT (admin) | Delete module |
| `GET` | `/api/updates/modules/:id/developers` | JWT | List module developers |
| `POST` | `/api/updates/modules/:id/developers` | JWT (admin) | Assign developer |
| `DELETE` | `/api/updates/modules/:id/developers?user_id=X` | JWT (admin) | Remove developer |

---

## 19. Appendix — Data Types

### 19.1 Client Status

Client status is computed server-side based on time since last heartbeat:

| Status | Condition | Description |
|---|---|---|
| `online` | < 5 minutes | Client is actively communicating |
| `recent` | < 24 hours | Client was active recently |
| `inactive` | < 7 days | Client hasn't checked in for days |
| `offline` | ≥ 7 days | Client is presumed offline |

### 19.2 User Roles

| Role | Permissions |
|---|---|
| `admin` | Full access to all endpoints |
| `client_manager` | Client management (block, message, etc.) |
| `qa_specialist` | View clients, modules, releases |
| `developer` | View modules, assigned developer lists |
| `deployer` | Upload files, manage releases |
| `viewer` | Read-only access |

### 19.3 Error Types

| Type | Description |
|---|---|
| `php_error` | PHP runtime error |
| `exception` | Unhandled exception |
| `fatal_error` | Fatal/crash error |
| `reported_exception` | Manually caught and reported exception |
| `reported_error` | Manually reported error |
| `js_error` | JavaScript/frontend error |

### 19.4 Error Levels

| Level | Description |
|---|---|
| `error` | Critical — requires attention |
| `warning` | Non-critical — may indicate a problem |
| `notice` | Informational — logged for monitoring |

### 19.5 Software Key Format

Software keys follow the pattern: `YYYYMMDD` + short product code.

| Key | Product |
|---|---|
| `20251001SILU` | Silulumanzi Portal |
| `20251125SOFTCODE` | Soft Aware Desktop |
| `20251116SILUDESK` | Silulumanzi Desktop |
| `20251204KONERECRUIT` | Kone Solutions Recruitment |

### 19.6 Retention Hint Values

| Value | Duration | Notes |
|---|---|---|
| `"24h"` | 1 day | Strictest retention — data purged after 24 hours |
| `"7d"` | 7 days | Short-term retention |
| `"30d"` | 30 days | Default for most presets |
| `"90d"` | 90 days | Default for v3 clients and maximum retention |

---

## Quick Start — Minimal v4 Client Implementation

### PHP (Silulumanzi Portal)

```php
// Heartbeat with telemetry settings
$payload = [
    'software_key'     => '20251001SILU',
    'client_identifier' => hash('sha256', gethostname() . '|' . PHP_OS_FAMILY . '|' . $_SERVER['HTTP_HOST']),
    'app_version'      => $this->getVersion(),
    'update_installed' => false,
    'metadata'         => [
        'check_time'     => date('c'),
        'portal_type'    => 'Silulumanzi Portal',
        'retention_hint' => $settings['telemetry_retention'] ?? '30d',
    ],
];

// Add environment fields if enabled
if ($settings['telemetry_cat_environment'] === '1') {
    $payload['hostname']     = gethostname() . ' [' . $environment . ']';
    $payload['machine_name'] = gethostname();
    $payload['os_info']      = php_uname('s') . ' ' . php_uname('r');
    $payload['metadata']['php_version']      = PHP_VERSION;
    $payload['metadata']['server_software']  = $_SERVER['SERVER_SOFTWARE'] ?? '';
    $payload['metadata']['environment']      = $environment;
    $payload['metadata']['http_host']        = $_SERVER['HTTP_HOST'] ?? '';
}

// Add performance fields if enabled
if ($settings['telemetry_cat_performance'] === '1') {
    $payload['recent_errors']            = $this->getRecentErrors(10);
    $payload['metadata']['error_summary'] = $this->getErrorSummary();
}

// Add anonymous usage fields if enabled (NO user identity)
if ($settings['telemetry_cat_usage'] === '1') {
    $payload['metadata']['usage'] = [
        'session_duration' => time() - $this->sessionStartedAt,
        'active_module'    => $this->getModuleSlug($currentPath),
        'feature_usage'    => $this->getFeatureCounters(),
    ];
}

// Add IP masking signal
if ($settings['telemetry_ip_masking'] === '1') {
    $payload['metadata']['ip_masked'] = true;
}

// Attach queued heartbeats if any exist
if ($queuedHeartbeats = $this->drainQueue()) {
    $payload['queued_heartbeats'] = $queuedHeartbeats;
}

$response = $this->httpPost('/api/updates/heartbeat', $payload);
```

### TypeScript (Desktop / Node.js)

```typescript
const BASE_URL = 'https://updates.softaware.net.za/api/updates';
const SOFTWARE_KEY = '20251001SILU';
const clientId = generateClientIdentifier();

setInterval(async () => {
  try {
    const payload: any = {
      software_key: SOFTWARE_KEY,
      client_identifier: clientId,
      app_version: APP_VERSION,
      update_installed: false,
      metadata: {
        check_time: new Date().toISOString(),
        portal_type: 'Silulumanzi Portal',
        retention_hint: settings.telemetry_retention || '30d',
      },
    };

    // Conditionally add telemetry categories
    if (settings.telemetry_cat_environment) {
      payload.hostname = os.hostname();
      payload.os_info = `${os.platform()} ${os.arch()}`;
    }
    if (settings.telemetry_cat_performance) {
      payload.recent_errors = errorQueue.splice(0, 10);
    }
    if (settings.telemetry_cat_usage) {
      payload.metadata.usage = {
        session_duration: Math.floor((Date.now() - sessionStartedAt) / 1000),
        active_module: getModuleSlug(router.currentRoute),
        feature_usage: featureCounters,
      };
    }
    if (settings.telemetry_ip_masking) {
      payload.metadata.ip_masked = true;
    }

    const res = await fetch(`${BASE_URL}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Software-Key': SOFTWARE_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 403) {
      const data = await res.json();
      if (data.blocked) handleBlocked(data.reason);
      return;
    }

    const data = await res.json();
    if (data.force_logout) handleForceLogout();
    if (data.server_message) showNotification(data.server_message);
    if (data.update_available) showUpdatePrompt(data.latest_update);
    if (data.queued_processed > 0) clearHeartbeatQueue();

  } catch (err) {
    queueHeartbeat(payload, err.message);
  }
}, 60000);
```

---

*This specification is maintained by the SoftAware development team. For questions or changes, contact the backend team or submit a pull request to the documentation repository.*
