# Updates Server — Telemetry & Privacy Specification

**Version:** 4.0.0  
**Date:** 2026-03-18  
**Status:** Implementation Required  
**Audience:** Server-side developers at `updates.softaware.net.za`

---

## Table of Contents

1. [Summary of Changes](#1-summary-of-changes)
2. [Client Telemetry Model](#2-client-telemetry-model)
3. [Heartbeat Payload — New Shape](#3-heartbeat-payload--new-shape)
4. [Field Reference](#4-field-reference)
5. [Privacy Directives](#5-privacy-directives)
6. [Heartbeat Queue (Retry Payloads)](#6-heartbeat-queue-retry-payloads)
7. [Server Endpoint Contract](#7-server-endpoint-contract)
8. [Data Retention Implementation](#8-data-retention-implementation)
9. [IP Masking Implementation](#9-ip-masking-implementation)
10. [Migration Guide (v3 → v4)](#10-migration-guide-v3--v4)
11. [Example Payloads](#11-example-payloads)
12. [Testing Checklist](#12-testing-checklist)

---

## 1. Summary of Changes

Starting with portal version **4.0.0**, all heartbeat payloads from Silulumanzi client portals are filtered by a **client-side telemetry settings system**. Portal administrators can now control exactly what data is sent during update checks.

### What this means for the server

| Aspect | Before (v3.x) | After (v4.0) |
|--------|---------------|--------------|
| Payload shape | Fixed — all fields always present | Variable — fields appear or are absent based on client's category toggles |
| `hostname`, `machine_name`, `os_info` | Always present | Present only when **Environment** category is enabled |
| `user_name`, `user_id`, `active_page` | Always present | **REMOVED** — replaced with anonymous usage tracking (session_duration, active_module, feature_usage) |
| `error_summary`, `recent_errors` | Always present (v3.0+) | Present only when **Performance** category is enabled |
| Anonymous usage metrics | Not present | `metadata.usage` object with session_duration, active_module, feature_usage — **NO user identity** (v4.0+) |
| `metadata.ip_masked` | Never sent | Sent as `true` when client requests IP masking |
| `metadata.retention_hint` | Never sent | Always sent — tells server how long to keep this data |
| `active_page` values | Raw URLs with query strings | May be stripped (`/quotes`), slugified (`quotes_module`), or raw depending on privacy settings |
| Failed heartbeats | Lost | Queued locally and replayed via `queued_heartbeats` array |
| `metadata.portal_type` | Not always present | Always present (essential field) |

### Key Principle

> **The server MUST treat all non-essential fields as optional.** A strict-mode client sends only `software_key`, `client_identifier`, `app_version`, `update_installed`, and `metadata` (with `check_time`, `portal_type`, `retention_hint`). Every other field may be absent.

---

## 2. Client Telemetry Model

Clients store telemetry preferences in their local `tb_settings` key-value table. These settings are configured by portal administrators via **Settings → Telemetry & Privacy** in the React UI.

### Settings Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `telemetry_preset` | `'strict'` \| `'balanced'` \| `'full'` \| `'custom'` | `'balanced'` | Quick preset (informational — server does not need to act on this) |
| `telemetry_cat_essential` | `'1'` | `'1'` | Always `'1'` — cannot be disabled by the user |
| `telemetry_cat_environment` | `'0'` \| `'1'` | `'1'` | Toggle: server/OS/PHP information |
| `telemetry_cat_performance` | `'0'` \| `'1'` | `'1'` | Toggle: error reports + crash data |
| `telemetry_cat_usage` | `'0'` \| `'1'` | `'0'` | Toggle: **anonymous usage tracking** (session duration, active module, feature clicks) — NO user identity |
| `telemetry_ip_masking` | `'0'` \| `'1'` | `'1'` | Request that server masks the source IP |
| `telemetry_strip_params` | `'0'` \| `'1'` | `'1'` | Client-side: strips query params from URLs before sending |
| `telemetry_path_mode` | `'off'` \| `'params'` \| `'slugs'` | `'params'` | How `active_page` paths are anonymized client-side |
| `telemetry_retention` | `'24h'` \| `'7d'` \| `'30d'` \| `'90d'` | `'30d'` | Requested data retention period |
| `telemetry_queue_enabled` | `'0'` \| `'1'` | `'1'` | Whether failed heartbeats are queued for retry |

### Preset Mappings

| Preset | Environment | Performance | Usage | IP Mask | Strip Params | Path Mode |
|--------|-------------|-------------|-------|---------|--------------|-----------|
| **Strict** | ❌ off | ❌ off | ❌ off | ✅ on | ✅ on | `slugs` |
| **Balanced** | ✅ on | ✅ on | ❌ off | ✅ on | ✅ on | `params` |
| **Full** | ✅ on | ✅ on | ✅ on | ❌ off | ❌ off | `off` |

---

## 3. Heartbeat Payload — New Shape

### POST `/api/updates/heartbeat`

The payload is now built dynamically by `ApiUpdates::buildTelemetryPayload()`. Fields are grouped into **categories** that can be toggled independently.

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
│  │  metadata.retention_hint  "24h"|"7d"|"30d"|"90d"  ← NEW    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── ENVIRONMENT (when telemetry_cat_environment = '1') ───────┐  │
│  │  hostname              "ZASIL-ASWEBAPP01 [production]"      │  │
│  │  machine_name          "ZASIL-ASWEBAPP01"                   │  │
│  │  os_info               "Linux 5.15.0-91-generic"            │  │
│  │  metadata.php_version       "8.3.4"                         │  │
│  │  metadata.server_software   "Apache/2.4.58"                 │  │
│  │  metadata.environment       "production"|"quality"|"local"  │  │
│  │  metadata.http_host         "portal.silulumanzi.co.za"      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── PERFORMANCE (when telemetry_cat_performance = '1') ───────┐  │
│  │  metadata.error_summary  { total, critical, ... }           │  │
│  │  recent_errors           [ { error_type, message, ... } ]   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── USAGE (when telemetry_cat_usage = '1') ───────────────────┐  │
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
│  │  last_update_id        "upd_2024_05"                        │  │
│  │  metadata.installation_time    ISO 8601                     │  │
│  │  metadata.previous_version     "47.116.3"                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Field Reference

### Essential Fields (always present)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `software_key` | string | `"20251001SILU"` | License key — unchanged |
| `client_identifier` | string(64) | `"a1b2c3d4..."` | SHA-256 hash of `hostname\|platform\|arch\|cpu\|http_host` |
| `app_version` | string | `"47.117.8"` | Semantic version from `version.json` |
| `update_installed` | boolean | `false` | `true` only on installation notifications |
| `metadata.check_time` | string (ISO 8601) | `"2026-03-18T14:30:00+02:00"` | When the heartbeat was generated |
| `metadata.portal_type` | string | `"Silulumanzi Portal"` | Always this value |
| `metadata.retention_hint` | string | `"30d"` | **NEW** — requested data retention period. Values: `"24h"`, `"7d"`, `"30d"`, `"90d"` |

### Environment Fields (conditional)

**Present when:** `telemetry_cat_environment = '1'`  
**Absent when:** `telemetry_cat_environment = '0'` (Strict preset)

| Field | Type | Example |
|-------|------|---------|
| `hostname` | string | `"ZASIL-ASWEBAPP01 [production]"` |
| `machine_name` | string | `"ZASIL-ASWEBAPP01"` |
| `os_info` | string | `"Linux 5.15.0-91-generic"` |
| `metadata.php_version` | string | `"8.3.4"` |
| `metadata.server_software` | string | `"Apache/2.4.58 (Ubuntu)"` |
| `metadata.environment` | string | `"production"` \| `"quality"` \| `"local"` \| `"unknown"` |
| `metadata.http_host` | string | `"portal.silulumanzi.co.za"` |

### Performance Fields (conditional)

**Present when:** `telemetry_cat_performance = '1'`  
**Absent when:** `telemetry_cat_performance = '0'` (Strict preset)

| Field | Type | Example |
|-------|------|---------|
| `metadata.error_summary` | object \| null | `{ "total": 5, "critical": 1, "error": 3, "warning": 1, "last_error_at": "2026-03-18T14:00:00+02:00" }` |
| `recent_errors` | array | Array of up to 10 error objects (capped client-side). See [Error Object Shape](#error-object-shape) below. |

### Usage Fields (conditional)

**Present when:** `telemetry_cat_usage = '1'`  
**Absent when:** `telemetry_cat_usage = '0'` (Strict and Balanced presets)

> **IMPORTANT:** v4.0.0 replaces user identity tracking with **anonymous usage analytics**. NO user_name, user_id, or entity IDs are sent.

| Field | Type | Example |
|-------|------|---------||
| `metadata.usage` | object | `{ "session_duration": 3600, "active_module": "quotes_module", "feature_usage": { "click_save": 5 } }` |
| `metadata.usage.session_duration` | integer | `3600` — seconds since session start |
| `metadata.usage.active_module` | string | `"quotes_module"` — generic module slug (no entity IDs) |
| `metadata.usage.feature_usage` | object | `{ "click_save_quote": 5, "view_budget": 3 }` — aggregate counters |

### Privacy Signal Fields

| Field | Type | When Present | Server Action |
|-------|------|-------------|---------------|
| `metadata.ip_masked` | `true` | When `telemetry_ip_masking = '1'` | Server MUST mask the source IP before storing. See §9. |

### Queue Replay Fields

| Field | Type | When Present |
|-------|------|-------------|
| `queued_heartbeats` | array | When the client has previously failed heartbeats to replay |

Each item in `queued_heartbeats`:

| Field | Type | Description |
|-------|------|-------------|
| `payload` | object | The original heartbeat payload that failed to send |
| `reason` | string | Failure reason, e.g. `"cURL error: Connection timed out"` |
| `queued_at` | string (ISO 8601) | When the heartbeat was queued locally |

### Error Object Shape

Each entry in `recent_errors`:

| Field | Type | Notes |
|-------|------|-------|
| `error_type` | string | `"php_error"`, `"exception"`, `"js_error"`, `"reported_error"` |
| `error_level` | string | `"error"`, `"warning"`, `"notice"` |
| `message` | string | Error message text |
| `timestamp` | string (ISO 8601) | When the error occurred |
| `file` | string \| null | Source file path |
| `line` | integer \| null | Line number |
| `stack_trace` | string \| null | Full stack trace |
| `url` | string \| null | Request URL when error occurred |
| `request_method` | string \| null | HTTP method |
| `request_uri` | string \| null | Request URI |

> **Note:** Null fields are stripped before transmission (since v3.1.0). The server should not expect all fields to be present.

---

## 5. Privacy Directives

The client communicates three privacy directives that the server **MUST** respect:

### 5.1 IP Masking (`metadata.ip_masked`)

When `metadata.ip_masked` is `true`, the server MUST NOT store the raw source IP address. See §9 for implementation details.

### 5.2 Data Retention (`metadata.retention_hint`)

The server SHOULD schedule automatic deletion of this heartbeat's data after the requested retention period. See §8 for implementation details.

### 5.3 Field Absence = Consent Withdrawn

If a field (e.g., `hostname`, `user_name`) is absent from the payload, the client has **not consented** to sharing that data. The server MUST NOT attempt to infer or reconstruct missing fields from other sources (e.g., reverse DNS for hostname when only IP is available).

---

## 6. Heartbeat Queue (Retry Payloads)

### Background

When the client portal cannot reach the updates server (network outage, DNS failure, timeout), it now queues failed heartbeats to a local JSON file (`storage/heartbeat_queue.json`) and replays them on the next successful connection.

### Queue Behaviour

- Maximum queue size: **50 entries** (oldest are discarded when full)
- Queue is only active when `telemetry_queue_enabled = '1'`
- On each successful heartbeat, queued entries are attached as `queued_heartbeats`
- The queue file is cleared immediately after attachment (before the request is sent)

### Server Handling Requirements

When `queued_heartbeats` is present in a heartbeat payload:

1. **Process each queued heartbeat independently.** Each `queued_heartbeats[].payload` is a complete heartbeat that should be ingested as if it arrived at `queued_at` time (not the current time).

2. **Use `queued_at` as the effective timestamp**, not the server's receive time. This preserves the correct timeline of client activity.

3. **Apply the same privacy rules** (IP masking, retention) from the queued payload's own `metadata`, not the parent heartbeat's metadata.

4. **Do not fail the parent heartbeat** if a queued entry has issues. Log and skip invalid entries.

5. **Return `queued_processed` count** in the response so the client can confirm delivery (see §7).

### Example

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a1b2c3...",
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
        "client_identifier": "a1b2c3...",
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

## 7. Server Endpoint Contract

### POST `/api/updates/heartbeat`

#### Request Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `Accept` | `application/json` | Yes |
| `X-Software-Key` | `"20251001SILU"` | Yes |
| `User-Agent` | `"Silulumanzi Portal Update Client/2.0"` | No (check() sends it) |

#### Request Body

See §3 and §4. The payload is a JSON object with variable fields based on client telemetry settings.

#### Required Server Validations

1. **`software_key`** — must be valid and not blocked. Return `404` if unknown, `403` if blocked.
2. **`client_identifier`** — must be a non-empty string. Use for upsert into clients table.
3. **`app_version`** — must be a non-empty string. Used for version comparison.
4. **All other fields** — treat as optional. Never return an error for missing non-essential fields.

#### Response — Success (200 OK)

```json
{
  "success": true,
  "update_available": true,
  "latest_update": {
    "id": "upd_2026_03",
    "version": "48.0.0",
    "description": "<ul><li>Telemetry & Privacy settings</li></ul>",
    "created_at": "2026-03-18T08:00:00+02:00",
    "download_url": "https://updates.softaware.net.za/api/updates/download?update_id=upd_2026_03&software_key=20251001SILU"
  },
  "force_logout": false,
  "server_message": null,
  "is_blocked": false,
  "errors_received": 5,
  "queued_processed": 1
}
```

**New field in response:**

| Field | Type | Description |
|-------|------|-------------|
| `queued_processed` | integer | Number of queued heartbeats that were successfully ingested. Return `0` if `queued_heartbeats` was not present in the request. |

#### Response — No Update (200 OK)

```json
{
  "success": true,
  "update_available": false,
  "message": "Portal is up to date",
  "force_logout": false,
  "server_message": null,
  "is_blocked": false,
  "errors_received": 0,
  "queued_processed": 0
}
```

#### Response — Blocked Client (403 Forbidden)

```json
{
  "blocked": true,
  "reason": "License expired"
}
```

#### Response — Invalid Key (404 Not Found)

```json
{
  "error": "Unknown software key"
}
```

---

## 8. Data Retention Implementation

### Client Directive

Every heartbeat includes `metadata.retention_hint` with one of: `"24h"`, `"7d"`, `"30d"`, `"90d"`.

### Recommended Server Implementation

```
┌──────────────────────────────────────────────────────────────────┐
│                    RETENTION IMPLEMENTATION                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Option A: Per-record TTL (Recommended)                          │
│  ─────────────────────────────────────                           │
│  1. Store `retention_hint` alongside each heartbeat record       │
│  2. Add `expires_at` computed column:                            │
│        expires_at = received_at + retention_duration             │
│  3. Run a daily cron job:                                        │
│        DELETE FROM heartbeats WHERE expires_at < NOW()           │
│                                                                  │
│  Option B: Client-level TTL                                      │
│  ─────────────────────────────                                   │
│  1. Store the most recent `retention_hint` per client_identifier │
│  2. Purge all heartbeat records for that client older than the   │
│     retention period                                             │
│                                                                  │
│  Duration Mapping:                                               │
│    "24h"  →  1 day                                               │
│    "7d"   →  7 days                                              │
│    "30d"  →  30 days                                             │
│    "90d"  →  90 days                                             │
│                                                                  │
│  If retention_hint is missing → default to 90 days               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Database Schema Suggestion

```sql
-- Add to the existing heartbeats/clients table
ALTER TABLE heartbeats ADD COLUMN retention_hint VARCHAR(4) DEFAULT '90d';
ALTER TABLE heartbeats ADD COLUMN expires_at DATETIME GENERATED ALWAYS AS (
    CASE retention_hint
        WHEN '24h' THEN DATE_ADD(received_at, INTERVAL 1 DAY)
        WHEN '7d'  THEN DATE_ADD(received_at, INTERVAL 7 DAY)
        WHEN '30d' THEN DATE_ADD(received_at, INTERVAL 30 DAY)
        WHEN '90d' THEN DATE_ADD(received_at, INTERVAL 90 DAY)
        ELSE DATE_ADD(received_at, INTERVAL 90 DAY)
    END
) STORED;

CREATE INDEX idx_heartbeats_expires ON heartbeats(expires_at);

-- Daily cleanup cron
-- 0 3 * * * mysql -e "DELETE FROM heartbeats WHERE expires_at < NOW()"
```

---

## 9. IP Masking Implementation

### When to Apply

When the incoming heartbeat contains `metadata.ip_masked = true`, the server MUST mask the client's source IP address **before writing to any persistent storage**.

### Recommended Masking Algorithm

```
Original:   192.168.1.45     →  Masked:  192.168.1.0
Original:   10.0.6.12        →  Masked:  10.0.6.0
Original:   2001:db8::1      →  Masked:  2001:db8::0 (zero last 64 bits for IPv6)
```

**Implementation (pseudocode):**

```python
def mask_ip(ip_address: str) -> str:
    if ':' in ip_address:
        # IPv6 — zero the last 64 bits (host portion)
        parts = ip_address.split(':')
        return ':'.join(parts[:4]) + '::0'
    else:
        # IPv4 — zero the last octet
        octets = ip_address.split('.')
        octets[3] = '0'
        return '.'.join(octets)
```

### Storage Rules

| `metadata.ip_masked` | Server Action |
|-----------------------|---------------|
| `true` | Store `masked_ip` only. Do NOT log raw IP anywhere (access logs excluded). |
| absent or `false` | Store raw IP as-is (current behaviour). |

### Access Log Consideration

Web server access logs (nginx/Apache) will still contain the raw IP. If full compliance is needed, configure the web server to mask IPs at the log level as well. This is outside the scope of the application but noted for completeness.

---

## 10. Migration Guide (v3 → v4)

### Server Changes Required

#### 10.1 Make all non-essential fields nullable

The heartbeat ingestion endpoint must not reject payloads missing any of these fields:

```
hostname, machine_name, os_info, user_name, user_id, active_page,
metadata.php_version, metadata.server_software, metadata.environment,
metadata.http_host, metadata.error_summary, recent_errors
```

**Action:** If these columns exist in the database with `NOT NULL` constraints, alter them to allow NULL or provide defaults.

```sql
-- Example alterations
ALTER TABLE client_heartbeats MODIFY hostname VARCHAR(255) NULL;
ALTER TABLE client_heartbeats MODIFY machine_name VARCHAR(255) NULL;
ALTER TABLE client_heartbeats MODIFY os_info VARCHAR(255) NULL;
ALTER TABLE client_heartbeats MODIFY user_name VARCHAR(255) NULL;
ALTER TABLE client_heartbeats MODIFY user_id INT NULL;
ALTER TABLE client_heartbeats MODIFY active_page TEXT NULL;
```

#### 10.2 Add new columns

```sql
ALTER TABLE client_heartbeats ADD COLUMN retention_hint VARCHAR(4) DEFAULT '90d';
ALTER TABLE client_heartbeats ADD COLUMN ip_masked TINYINT(1) DEFAULT 0;
ALTER TABLE client_heartbeats ADD COLUMN masked_ip VARCHAR(45) NULL;
```

#### 10.3 Add queued heartbeat processing

The `/api/updates/heartbeat` handler must now check for and process `queued_heartbeats` in the request body. Each entry should be ingested as a separate heartbeat record with the `queued_at` timestamp.

#### 10.4 Add `queued_processed` to response

The heartbeat response JSON must include a new `queued_processed` integer field.

#### 10.5 Backward Compatibility

**v3 clients** (those not yet upgraded) will continue to send the full static payload. The server should handle both:

- **v3 payload:** All fields present, no `metadata.retention_hint`, no `metadata.ip_masked`, no `queued_heartbeats`. Treat as `retention_hint = '90d'`, `ip_masked = false`.
- **v4 payload:** Variable fields, includes `metadata.retention_hint` and possibly `metadata.ip_masked` and `queued_heartbeats`.

**Detection heuristic:** If `metadata.retention_hint` exists in the payload, treat it as a v4 heartbeat. Otherwise, v3 legacy.

---

## 11. Example Payloads

### 11.1 Strict Preset (Minimal Data)

The client sends only essential fields. No environment, performance, or usage data.

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "app_version": "47.117.8",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "30d",
    "ip_masked": true
  }
}
```

**Server expectations:**
- `hostname` → absent, store as NULL
- `user_name` → absent, store as NULL
- `recent_errors` → absent, store as empty
- `metadata.ip_masked` → `true`, mask the source IP
- `metadata.retention_hint` → `"30d"`, set TTL to 30 days

### 11.2 Balanced Preset (Recommended Default)

Environment and performance data included. **No usage tracking** (Usage category disabled by default).

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
  "app_version": "47.117.8",
  "update_installed": false,
  "hostname": "ZASIL-ASWEBAPP01 [production]",
  "machine_name": "ZASIL-ASWEBAPP01",
  "os_info": "Linux 5.15.0-91-generic",
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "30d",
    "ip_masked": true,
    "php_version": "8.3.4",
    "server_software": "Apache/2.4.58 (Ubuntu)",
    "environment": "production",
    "http_host": "portal.silulumanzi.co.za",
    "error_summary": {
      "total": 3,
      "critical": 0,
      "error": 2,
      "warning": 1,
      "last_error_at": "2026-03-18T14:15:00+02:00"
    }
  },
  "recent_errors": [
    {
      "error_type": "php_error",
      "error_level": "error",
      "message": "Undefined array key \"name\" in /app/Controllers/ApiCustomers.php",
      "timestamp": "2026-03-18T14:15:00+02:00",
      "file": "/app/Controllers/ApiCustomers.php",
      "line": 142,
      "request_method": "POST",
      "request_uri": "/api/customers/save"
    },
    {
      "error_type": "exception",
      "error_level": "error",
      "message": "SQLSTATE[23000]: Integrity constraint violation",
      "timestamp": "2026-03-18T14:10:00+02:00",
      "file": "/app/Models/Budget.php",
      "line": 87,
      "stack_trace": "#0 /app/Controllers/ApiBudgets.php(234): Budget->save()\n#1 /app/Core/Bootstrap.php(89): ApiBudgets->create()"
    }
  ]
}
```

**Server expectations:**
- `metadata.usage` → absent (Usage category disabled in Balanced preset)
- All environment and performance fields present — store normally
- `metadata.ip_masked` → `true`, mask source IP

### 11.3 Full Preset (Maximum Telemetry)

All categories enabled including **anonymous usage tracking**. No IP masking.

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
  "app_version": "47.117.8",
  "update_installed": false,
  "hostname": "ZASIL-ASWEBAPP01 [production]",
  "machine_name": "ZASIL-ASWEBAPP01",
  "os_info": "Linux 5.15.0-91-generic",
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "30d",
    "php_version": "8.3.4",
    "server_software": "Apache/2.4.58 (Ubuntu)",
    "environment": "production",
    "http_host": "portal.silulumanzi.co.za",
    "error_summary": {
      "total": 3,
      "critical": 0,
      "error": 2,
      "warning": 1
    },
    "usage": {
      "session_duration": 3600,
      "active_module": "quotations_module",
      "feature_usage": {
        "click_save_quote": 5,
        "view_budget_details": 3,
        "export_pdf": 1
      }
    }
  },
  "recent_errors": [
    {
      "error_type": "php_error",
      "error_level": "error",
      "message": "Undefined array key \"name\"",
      "timestamp": "2026-03-18T14:15:00+02:00"
    }
  ]
}
```

**Server expectations:**
- All fields present — store as-is
- `metadata.ip_masked` → absent, store raw source IP
- `metadata.usage` → **anonymous metrics only** — NO user identity
- `metadata.usage.active_module` → generic module slug (e.g., "quotations_module"), not full URLs
- `metadata.usage.feature_usage` → aggregate counters, no individual timestamps

### 11.4 Heartbeat with Queued Replays

A successful heartbeat carrying 2 previously failed heartbeats.

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
  "app_version": "47.117.8",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T16:00:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "retention_hint": "7d"
  },
  "queued_heartbeats": [
    {
      "payload": {
        "software_key": "20251001SILU",
        "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
        "app_version": "47.117.8",
        "update_installed": false,
        "metadata": {
          "check_time": "2026-03-18T14:00:00+02:00",
          "portal_type": "Silulumanzi Portal",
          "retention_hint": "7d",
          "ip_masked": true
        }
      },
      "reason": "cURL error: Connection timed out after 30001 milliseconds",
      "queued_at": "2026-03-18T14:00:02+02:00"
    },
    {
      "payload": {
        "software_key": "20251001SILU",
        "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
        "app_version": "47.117.8",
        "update_installed": false,
        "hostname": "Mac.lan [local]",
        "machine_name": "Mac.lan",
        "os_info": "Darwin 23.1.0",
        "metadata": {
          "check_time": "2026-03-18T15:00:00+02:00",
          "portal_type": "Silulumanzi Portal",
          "retention_hint": "7d",
          "php_version": "8.3.30",
          "server_software": "ServBay/1.0",
          "environment": "local",
          "http_host": "silulumanzi.local"
        }
      },
      "reason": "cURL error: Could not resolve host: updates.softaware.net.za",
      "queued_at": "2026-03-18T15:00:01+02:00"
    }
  ]
}
```

**Server expectations:**
- Process parent heartbeat at `16:00:00`
- Process queued[0] as heartbeat at `14:00:02` with IP masking
- Process queued[1] as heartbeat at `15:00:01` without IP masking (no `ip_masked` flag)
- Return `"queued_processed": 2`

### 11.5 Installation Notification

Sent after a successful update install.

> **IMPORTANT:** Installation notifications in v4.0.0 respect telemetry settings. User identity fields (user_name, user_id, active_page) have been removed and replaced with conditional anonymous usage tracking.

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "e3b0c44298fc1c149afbf4c8996fb924...",
  "hostname": "ZASIL-ASWEBAPP01 [production]",
  "machine_name": "ZASIL-ASWEBAPP01",
  "os_info": "Linux 5.15.0-91-generic",
  "app_version": "48.0.0",
  "update_installed": true,
  "last_update_id": "upd_2026_03",
  "metadata": {
    "installation_time": "2026-03-18T15:00:00+02:00",
    "previous_version": "47.117.8",
    "retention_hint": "30d",
    "php_version": "8.3.4",
    "environment": "production",
    "http_host": "portal.silulumanzi.co.za",
    "error_summary": { "total": 0 }
  },
  "recent_errors": []
}
```

**Server expectations:**
- Installation notifications follow the same telemetry rules as regular heartbeats
- NO user identity fields — user_name, user_id, active_page removed in v4.0.0
- Environment fields present if `telemetry_cat_environment='1'`
- If `telemetry_cat_usage='1'`, `metadata.usage` would be present (anonymous only)

---

## 12. Testing Checklist

### Server-Side Acceptance Tests

#### Payload Parsing

- [ ] **Accept strict payload** — heartbeat with only essential fields (no hostname, no user_name, no recent_errors) → should return 200 with `update_available` check, not 400/500
- [ ] **Accept balanced payload** — environment + performance fields present, no usage fields → 200 OK
- [ ] **Accept full payload** — all fields present → 200 OK
- [ ] **Accept v3 legacy payload** — all fields present, no `retention_hint` or `ip_masked` → 200 OK, default retention to 90d

#### Privacy Compliance

- [ ] **IP masking respected** — when `metadata.ip_masked = true`, the stored IP has the last octet zeroed
- [ ] **IP masking absent** — when `metadata.ip_masked` is not in the payload, raw IP is stored
- [ ] **Retention hint stored** — `metadata.retention_hint` value is persisted per heartbeat
- [ ] **Retention enforced** — records with expired `retention_hint` are deleted by scheduled job
- [ ] **Missing fields stored as NULL** — absent optional fields are stored as NULL, not empty string or "unknown"

#### Queue Replay

- [ ] **Queued heartbeats processed** — `queued_heartbeats` array is iterated, each `payload` ingested as a separate record
- [ ] **Queued timestamps used** — ingested records use `queued_at` as the effective timestamp
- [ ] **Invalid queued entries skipped** — a malformed entry in the queue array does not fail the parent heartbeat
- [ ] **Response includes `queued_processed`** — integer count of successfully processed queue entries
- [ ] **Zero when no queue** — `queued_processed: 0` when `queued_heartbeats` was not present

#### Anonymous Usage Tracking Verification

- [ ] **Usage object structure** — `metadata.usage` contains `session_duration`, `active_module`, `feature_usage`
- [ ] **NO user identity** — `metadata.usage` does NOT contain user_name, user_id, or entity IDs
- [ ] **Module slugs** — `active_module` values are generic (e.g., "quotes_module"), not full paths
- [ ] **Aggregate counters** — `feature_usage` contains only aggregate counts, no timestamps or sequences
- [ ] **Usage category toggle** — `metadata.usage` only present when `telemetry_cat_usage='1'`

#### Backward Compatibility

- [ ] **v3 clients still work** — heartbeats without `metadata.retention_hint` are accepted with default 90-day retention
- [ ] **v3 clients don't break on new response field** — `queued_processed` in response doesn't cause issues (clients ignore unknown fields)
- [ ] **Mixed fleet** — server can handle a mix of v3 and v4 heartbeats from different clients simultaneously

#### Error Reporting (unchanged)

- [ ] **POST `/api/updates/error-report`** — still accepts batch error payloads unchanged
- [ ] **Error piggybacking** — `recent_errors` in heartbeat still processed when present
- [ ] **No errors when `recent_errors` absent** — strict-mode clients won't send errors; server doesn't complain

---

## Appendix A: Client Software Key

| Key | Product | Notes |
|-----|---------|-------|
| `20251001SILU` | Silulumanzi MMS Portal (Web) | Only key currently in use |

Future keys for desktop app, mobile app, etc. will follow the same telemetry payload contract.

## Appendix C: Related Files (Client Side)

| File | Purpose |
|------|---------|
| `portal/app/Controllers/ApiUpdates.php` | Heartbeat sender, telemetry payload builder, queue manager |
| `portal/app/Services/ErrorHandlerService.php` | Error buffering for heartbeat piggybacking |
| `react/src/views/pages/Settings.jsx` | TelemetryTab UI component |
| `react/src/models/settingsModel.js` | `getTelemetrySettings()`, `updateTelemetrySettings()` |
| `database/migrations/2026_03_18_add_telemetry_settings.sql` | Seed migration for tb_settings |
