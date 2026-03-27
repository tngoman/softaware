# Error Reporting — Updates Server Endpoint Specification

**Version:** 1.0.0  
**Date:** 2026-03-07  
**Purpose:** Defines the endpoints that the remote updates server (updates.softaware.co.za) must implement to receive error reports from Silulumanzi Portal clients.

---

## Overview

The Silulumanzi Portal sends errors **outgoing** to the updates server via two mechanisms:

1. **Piggybacked on heartbeats** — Every `POST /api/heartbeat` call now includes `recent_errors` and `metadata.error_summary` fields alongside the existing heartbeat data.
2. **Dedicated error-report endpoint** — Critical errors (and batches of buffered errors) are sent immediately via `POST /api/error-report`.

Both mechanisms use the **same client identification** (`software_key`, `client_identifier`, `hostname`) so the server can correlate errors with known clients.

---

## 1. Enhanced Heartbeat Payload

### Endpoint: `POST /api/heartbeat` (existing, enhanced)

The heartbeat payload now includes two additional top-level fields:

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a1b2c3...sha256...",
  "hostname": "portal-server-01",
  "machine_name": "portal-server-01",
  "os_info": "Linux 5.15.0-91-generic",
  "app_version": "2.1.14",
  "update_installed": false,
  "user_name": "John Doe",
  "user_id": 42,
  "active_page": "Dashboard viewed",
  "metadata": {
    "php_version": "8.2.14",
    "server_software": "Apache/2.4.58",
    "check_time": "2026-03-07T10:30:00+02:00",
    "portal_type": "Silulumanzi Portal",
    "error_summary": {
      "total": 3,
      "errors": 1,
      "warnings": 1,
      "notices": 1
    }
  },
  "recent_errors": [
    {
      "type": "php_error",
      "level": "error",
      "label": "E_ERROR",
      "message": "Call to undefined method ...",
      "file": "/var/www/portal/app/Controllers/ApiSomething.php",
      "line": 42,
      "timestamp": "2026-03-07T10:28:15+02:00"
    },
    {
      "type": "exception",
      "level": "warning",
      "label": "E_WARNING",
      "message": "Undefined array key 'missing_key'",
      "file": "/var/www/portal/app/Models/Something.php",
      "line": 88,
      "timestamp": "2026-03-07T10:29:01+02:00"
    }
  ]
}
```

### Server-side handling:

- If `recent_errors` is present and non-empty, store them in the error log table associated with the client.
- If `metadata.error_summary` is present, store/update the client's error summary for dashboard display.
- The existing heartbeat response format does **not** change — still return update availability info.
- `recent_errors` may be an empty array `[]` if no errors occurred since the last heartbeat.

---

## 2. Dedicated Error Report Endpoint

### Endpoint: `POST /api/error-report` (NEW)

Receives error reports from portal clients. Errors may come from:
- **Backend PHP errors** (caught by ErrorHandlerService)
- **Frontend JS errors** (relayed through the portal's `/api/updates/report-error` endpoint)

### Request Headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |
| `X-Software-Key` | `20251001SILU` |
| `User-Agent` | `Silulumanzi Portal Error Reporter/1.0` |

### Request Body

```json
{
  "software_key": "20251001SILU",
  "client_identifier": "a1b2c3...sha256...",
  "hostname": "portal-server-01",
  "machine_name": "portal-server-01",
  "os_info": "Linux 5.15.0-91-generic",
  "app_version": "2.1.14",
  
  "source": "backend",
  "errors": [
    {
      "type": "exception",
      "level": "error",
      "label": "PDOException",
      "message": "SQLSTATE[HY000] [2002] Connection refused",
      "file": "/var/www/portal/app/Core/Model.php",
      "line": 24,
      "trace": "#0 /var/www/portal/app/Core/Model.php:24 PDO->__construct()\n#1 ...",
      "request": {
        "method": "GET",
        "uri": "/portal/api/requisitions",
        "route": "api/requisitions",
        "ip": "10.0.6.50",
        "user_agent": "Mozilla/5.0 ..."
      },
      "timestamp": "2026-03-07T10:30:00+02:00"
    }
  ],
  
  "metadata": {
    "php_version": "8.2.14",
    "server_software": "Apache/2.4.58",
    "reported_at": "2026-03-07T10:30:01+02:00",
    "portal_type": "Silulumanzi Portal",
    "error_count": 1,
    "user_agent": "Mozilla/5.0 ...",
    "extra": null
  }
}
```

### Field Reference

#### Top-level client identification (same as heartbeat)

| Field | Type | Description |
|---|---|---|
| `software_key` | string | Client software key (`20251001SILU` for web portal) |
| `client_identifier` | string | SHA-256 hash of system attributes (hostname, OS, arch, CPU) |
| `hostname` | string | Machine hostname |
| `machine_name` | string | Machine name (same as hostname for portal) |
| `os_info` | string | OS name and kernel version |
| `app_version` | string | Current portal version |

#### Error batch

| Field | Type | Description |
|---|---|---|
| `source` | string | `'backend'` or `'frontend'` |
| `errors` | array | Array of error objects (may contain 1 or many) |

#### Each error object

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✅ | `'php_error'`, `'exception'`, `'fatal_error'`, `'reported_exception'`, `'reported_error'`, `'js_error'` |
| `level` | string | ✅ | `'error'`, `'warning'`, `'notice'` |
| `label` | string | ✅ | Human-readable label (e.g. `'E_ERROR'`, `'PDOException'`, `'TypeError'`) |
| `message` | string | ✅ | Error message (truncated to 500 chars for transport) |
| `file` | string | ❌ | Source file path |
| `line` | int | ❌ | Line number |
| `column` | int | ❌ | Column number (JS errors only) |
| `trace` | string | ❌ | Stack trace string |
| `url` | string | ❌ | Page URL (frontend JS errors only) |
| `request` | object | ❌ | HTTP request context (backend errors only) |
| `request.method` | string | ❌ | HTTP method |
| `request.uri` | string | ❌ | Request URI |
| `request.route` | string | ❌ | Matched route |
| `request.ip` | string | ❌ | Client IP address |
| `request.user_agent` | string | ❌ | Client user agent |
| `timestamp` | string | ✅ | ISO 8601 timestamp of when error occurred |

#### Metadata

| Field | Type | Description |
|---|---|---|
| `php_version` | string | PHP version on the portal server |
| `server_software` | string | Web server identification |
| `reported_at` | string | ISO 8601 timestamp of when the report was sent |
| `portal_type` | string | Always `'Silulumanzi Portal'` |
| `error_count` | int | Number of errors in this batch |
| `user_agent` | string | Browser user agent (for frontend errors) |
| `extra` | mixed | Optional additional data from the caller |

### Response

#### Success (200 OK)

```json
{
  "success": true,
  "received": 1,
  "message": "Error report received"
}
```

#### Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Missing required field: errors"
}
```

#### Invalid Software Key (404 Not Found)

```json
{
  "success": false,
  "error": "Unknown software key"
}
```

#### Client Blocked (403 Forbidden)

```json
{
  "success": false,
  "blocked": true,
  "reason": "License expired"
}
```

#### Server Error (500)

```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 3. Suggested Database Schema (Updates Server)

```sql
CREATE TABLE error_reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    -- Client identification (links to existing clients table)
    software_key VARCHAR(50) NOT NULL,
    client_identifier VARCHAR(64) NOT NULL,
    hostname VARCHAR(255) NULL,
    
    -- Error data
    source ENUM('backend', 'frontend') NOT NULL DEFAULT 'backend',
    error_type VARCHAR(50) NOT NULL,           -- php_error, exception, fatal_error, js_error, etc.
    error_level ENUM('error', 'warning', 'notice') NOT NULL DEFAULT 'error',
    error_label VARCHAR(255) NOT NULL,         -- E_ERROR, PDOException, TypeError, etc.
    error_message TEXT NOT NULL,
    error_file VARCHAR(500) NULL,
    error_line INT UNSIGNED NULL,
    error_column INT UNSIGNED NULL,
    error_trace TEXT NULL,
    error_url VARCHAR(2000) NULL,              -- page URL for frontend errors
    
    -- Request context (backend errors)
    request_method VARCHAR(10) NULL,
    request_uri VARCHAR(2000) NULL,
    request_route VARCHAR(500) NULL,
    request_ip VARCHAR(45) NULL,
    request_user_agent VARCHAR(500) NULL,
    
    -- Client metadata
    app_version VARCHAR(50) NULL,
    php_version VARCHAR(50) NULL,
    server_software VARCHAR(255) NULL,
    os_info VARCHAR(255) NULL,
    
    -- Timestamps
    error_occurred_at DATETIME NOT NULL,       -- when the error happened on the client
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional data
    extra JSON NULL,
    
    -- Indexes
    INDEX idx_client (software_key, client_identifier),
    INDEX idx_level (error_level),
    INDEX idx_type (error_type),
    INDEX idx_occurred (error_occurred_at),
    INDEX idx_received (received_at),
    INDEX idx_hostname (hostname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Optional: aggregate summary table for dashboard display
CREATE TABLE client_error_summaries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    software_key VARCHAR(50) NOT NULL,
    client_identifier VARCHAR(64) NOT NULL,
    hostname VARCHAR(255) NULL,
    app_version VARCHAR(50) NULL,
    
    -- Counts
    total_errors BIGINT UNSIGNED DEFAULT 0,
    total_warnings BIGINT UNSIGNED DEFAULT 0,
    total_notices BIGINT UNSIGNED DEFAULT 0,
    
    -- Last error info
    last_error_message TEXT NULL,
    last_error_at DATETIME NULL,
    
    -- Timestamps
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_client_unique (software_key, client_identifier),
    INDEX idx_last_error (last_error_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Suggested Server-Side Controller (PHP/Laravel Example)

```php
<?php
// app/Http/Controllers/Api/ErrorReportController.php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ErrorReportController extends Controller
{
    /**
     * POST /api/error-report
     * Receives error reports from Silulumanzi Portal clients.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'software_key'      => 'required|string|max:50',
            'client_identifier' => 'required|string|max:64',
            'hostname'          => 'nullable|string|max:255',
            'machine_name'      => 'nullable|string|max:255',
            'os_info'           => 'nullable|string|max:255',
            'app_version'       => 'nullable|string|max:50',
            'source'            => 'required|in:backend,frontend',
            'errors'            => 'required|array|min:1',
            'errors.*.type'     => 'required|string',
            'errors.*.level'    => 'required|in:error,warning,notice',
            'errors.*.label'    => 'required|string',
            'errors.*.message'  => 'required|string',
            'metadata'          => 'nullable|array',
        ]);

        // Verify software key
        $software = DB::table('software')
            ->where('software_key', $data['software_key'])
            ->first();

        if (!$software) {
            return response()->json([
                'success' => false,
                'error'   => 'Unknown software key',
            ], 404);
        }

        // Check if client is blocked
        $client = DB::table('clients')
            ->where('software_key', $data['software_key'])
            ->where('client_identifier', $data['client_identifier'])
            ->first();

        if ($client && $client->blocked) {
            return response()->json([
                'success' => false,
                'blocked' => true,
                'reason'  => $client->block_reason,
            ], 403);
        }

        // Store each error
        $received = 0;
        foreach ($data['errors'] as $error) {
            DB::table('error_reports')->insert([
                'software_key'       => $data['software_key'],
                'client_identifier'  => $data['client_identifier'],
                'hostname'           => $data['hostname'],
                'source'             => $data['source'],
                'error_type'         => $error['type'],
                'error_level'        => $error['level'],
                'error_label'        => $error['label'],
                'error_message'      => mb_substr($error['message'], 0, 65000),
                'error_file'         => $error['file'] ?? null,
                'error_line'         => $error['line'] ?? null,
                'error_column'       => $error['column'] ?? null,
                'error_trace'        => $error['trace'] ?? null,
                'error_url'          => $error['url'] ?? null,
                'request_method'     => $error['request']['method'] ?? null,
                'request_uri'        => $error['request']['uri'] ?? null,
                'request_route'      => $error['request']['route'] ?? null,
                'request_ip'         => $error['request']['ip'] ?? null,
                'request_user_agent' => $error['request']['user_agent'] ?? null,
                'app_version'        => $data['app_version'],
                'php_version'        => $data['metadata']['php_version'] ?? null,
                'server_software'    => $data['metadata']['server_software'] ?? null,
                'os_info'            => $data['os_info'],
                'error_occurred_at'  => $error['timestamp'] ?? now(),
                'received_at'        => now(),
                'extra'              => isset($data['metadata']['extra'])
                                         ? json_encode($data['metadata']['extra'])
                                         : null,
            ]);
            $received++;
        }

        // Update client error summary
        DB::table('client_error_summaries')->updateOrInsert(
            [
                'software_key'      => $data['software_key'],
                'client_identifier' => $data['client_identifier'],
            ],
            [
                'hostname'           => $data['hostname'],
                'app_version'        => $data['app_version'],
                'total_errors'       => DB::raw('total_errors + ' . collect($data['errors'])->where('level', 'error')->count()),
                'total_warnings'     => DB::raw('total_warnings + ' . collect($data['errors'])->where('level', 'warning')->count()),
                'total_notices'      => DB::raw('total_notices + ' . collect($data['errors'])->where('level', 'notice')->count()),
                'last_error_message' => $data['errors'][0]['message'] ?? null,
                'last_error_at'      => now(),
                'last_updated_at'    => now(),
            ]
        );

        Log::info("Received {$received} error(s) from {$data['hostname']} ({$data['client_identifier']})");

        return response()->json([
            'success'  => true,
            'received' => $received,
            'message'  => 'Error report received',
        ]);
    }

    /**
     * Handle recent_errors piggybacked on heartbeat.
     * Call this from your existing HeartbeatController after processing the heartbeat.
     */
    public static function processHeartbeatErrors(array $heartbeatData): void
    {
        $recentErrors = $heartbeatData['recent_errors'] ?? [];
        if (empty($recentErrors)) {
            return;
        }

        // Store each piggybacked error
        foreach ($recentErrors as $error) {
            DB::table('error_reports')->insert([
                'software_key'       => $heartbeatData['software_key'],
                'client_identifier'  => $heartbeatData['client_identifier'],
                'hostname'           => $heartbeatData['hostname'],
                'source'             => 'backend',
                'error_type'         => $error['type'] ?? 'unknown',
                'error_level'        => $error['level'] ?? 'error',
                'error_label'        => $error['label'] ?? 'UNKNOWN',
                'error_message'      => $error['message'] ?? '',
                'error_file'         => $error['file'] ?? null,
                'error_line'         => $error['line'] ?? null,
                'app_version'        => $heartbeatData['app_version'] ?? null,
                'os_info'            => $heartbeatData['os_info'] ?? null,
                'error_occurred_at'  => $error['timestamp'] ?? now(),
                'received_at'        => now(),
            ]);
        }

        // Update summary from heartbeat metadata
        $summary = $heartbeatData['metadata']['error_summary'] ?? null;
        if ($summary) {
            DB::table('client_error_summaries')->updateOrInsert(
                [
                    'software_key'      => $heartbeatData['software_key'],
                    'client_identifier' => $heartbeatData['client_identifier'],
                ],
                [
                    'hostname'       => $heartbeatData['hostname'],
                    'app_version'    => $heartbeatData['app_version'],
                    'last_updated_at' => now(),
                ]
            );
        }
    }
}
```

### Route registration (updates server):

```php
// routes/api.php
Route::post('/error-report', [ErrorReportController::class, 'store']);
```

### In existing HeartbeatController, add after processing heartbeat:

```php
// Inside your existing heartbeat handler:
ErrorReportController::processHeartbeatErrors($request->all());
```

---

## 5. Portal Client Endpoints (local API)

These are the local endpoints on the Silulumanzi Portal that manage error handling:

| Method | Path | Purpose | Direction |
|---|---|---|---|
| POST | `/api/updates/report-error` | React frontend reports JS errors → portal logs + relays outgoing | Incoming from browser, outgoing to updates server |
| POST | `/api/updates/flush-errors` | Drains buffered errors → sends batch outgoing | Outgoing to updates server |
| GET | `/api/updates/error-settings` | Read error handling configuration | Local |
| POST | `/api/updates/error-settings` | Update error handling configuration | Local |
| GET | `/api/updates/check` | Heartbeat with piggybacked errors | Outgoing to updates server |

---

## 6. Flow Diagrams

### Backend Error Flow (automatic)

```
PHP Error/Exception/Fatal
      │
      ▼
ErrorHandlerService (index.php registered)
      │
      ├──→ 1. Log to storage/api_errors.log (if error_log_enabled = '1')
      │
      ├──→ 2. Buffer in memory (always, for heartbeat piggybacking)
      │
      ├──→ 3. If error_remote_reporting = '1' AND level = 'error':
      │       Send immediately OUTGOING → POST {updates_url}/api/error-report
      │
      └──→ 4. Return JSON error response to client
```

### Frontend Error Flow (via reportError relay)

```
React JS Error / unhandled rejection
      │
      ▼
POST /api/updates/report-error  (browser → portal)
      │
      ├──→ 1. Log locally (always)
      │
      └──→ 2. If error_remote_reporting = '1':
              Relay OUTGOING via ErrorHandlerService::sendErrorsToRemote()
                    → POST {updates_url}/api/error-report
```

### Heartbeat Piggybacking Flow

```
React: GET /api/updates/check
      │
      ▼
ApiUpdates::check()
      │
      ├──→ ErrorHandlerService::getBufferedErrors()  (drain buffer)
      ├──→ ErrorHandlerService::getErrorSummary()
      │
      ▼
POST {updates_url}/api/heartbeat  (OUTGOING)
      Body includes: recent_errors[] + metadata.error_summary{}
```
