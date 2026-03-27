# Mobile App — Heartbeat Wiring Guide

**Version:** 4.0.0  
**Date:** 2026-03-18  
**Audience:** Mobile app developers (React Native / Flutter / native iOS / Android)  
**Endpoint:** `https://updates.softaware.net.za/api/updates/heartbeat`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Differences from Web Portal](#2-differences-from-web-portal)
3. [Essential Fields](#3-essential-fields)
4. [Environment Fields (Conditional)](#4-environment-fields-conditional)
5. [Performance Fields (Conditional)](#5-performance-fields-conditional)
6. [Usage Fields (Conditional — Anonymous Only)](#6-usage-fields-conditional--anonymous-only)
7. [Privacy Signals](#7-privacy-signals)
8. [Heartbeat Queue (Offline Retry)](#8-heartbeat-queue-offline-retry)
9. [Telemetry Settings](#9-telemetry-settings)
10. [Server Response Handling](#10-server-response-handling)
11. [Client Identifier Derivation](#11-client-identifier-derivation)
12. [Sending the Request](#12-sending-the-request)
13. [Example Payloads](#13-example-payloads)
14. [Testing Checklist](#14-testing-checklist)

---

## 1. Overview

The mobile app must send a periodic **heartbeat** to the updates server to:

1. **Check for available updates** — the server returns `update_available` with download details if a newer version exists.
2. **Report telemetry** — environment, performance (error reports), and anonymous usage metrics, subject to the user's privacy settings.
3. **Replay queued heartbeats** — when the app was offline and couldn't reach the server, queued payloads are piggybacked on the next successful send.

### Heartbeat Interval

- **When app is in foreground:** every **30 minutes**
- **On app launch / resume from background:** always send immediately
- **When update is installed:** send a one-off installation notification (see §3 — `update_installed: true`)
- **When offline:** queue the heartbeat for later replay (see §8)

---

## 2. Differences from Web Portal

The mobile app sends heartbeats using the **same v4 protocol** as the web portal, but with platform-specific field values:

| Aspect | Web Portal | Mobile App |
|--------|-----------|------------|
| `metadata.portal_type` | `"Silulumanzi Portal"` | `"Silulumanzi Mobile"` |
| `os_info` | `"Linux 5.15.0-..."` | `"iOS 17.4.1"` / `"Android 14 (API 34)"` |
| `machine_name` | Windows/Linux hostname | Device model, e.g. `"iPhone 15 Pro"` |
| `hostname` | `"ZASIL-ASWEBAPP01 [production]"` | Device name + env, e.g. `"John's iPhone [production]"` |
| `metadata.php_version` | PHP version | **Omit** — not applicable |
| `metadata.server_software` | Apache/nginx version | **Omit** — not applicable |
| `metadata.http_host` | `portal.silulumanzi.co.za` | **Omit** — not applicable |
| `metadata.environment` | `"production"` / `"quality"` / `"local"` | `"production"` / `"staging"` / `"debug"` |
| `metadata.error_summary` | PHP/JS error counts | Mobile crash/exception counts |
| `recent_errors` | PHP errors + JS exceptions | Mobile exceptions, ANR events, network errors |
| `client_identifier` | SHA-256 of hostname+arch+CPU+http_host | SHA-256 of device ID + bundle ID (see §11) |

> **CRITICAL:** `user_name`, `user_id`, and `active_page` are **REMOVED** in v4.0.0. These fields MUST NOT be sent. The server will ignore them if present but sending them is a policy violation.

---

## 3. Essential Fields

These fields are **always sent**, regardless of telemetry settings.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `software_key` | string | `"20261001SILU-MOBILE"` | Mobile-specific software key issued by Softaware |
| `client_identifier` | string(64) | `"a1b2c3d4..."` | SHA-256 derived from stable device identifiers (see §11) |
| `app_version` | string | `"2.4.1"` | Semantic version from app's `package.json` / `Info.plist` / `build.gradle` |
| `update_installed` | boolean | `false` | Set `true` only when notifying of a completed install |
| `metadata.check_time` | string (ISO 8601) | `"2026-03-18T14:30:00+02:00"` | Use the device's local time with timezone offset — **never UTC `Z` suffix** |
| `metadata.portal_type` | string | `"Silulumanzi Mobile"` | Fixed value for all mobile heartbeats |
| `metadata.retention_hint` | string | `"30d"` | User's chosen retention: `"24h"`, `"7d"`, `"30d"`, `"90d"`. Default: `"30d"` |

### Installation Notification

When `update_installed` is `true`, also include:

| Field | Type | Example |
|-------|------|---------|
| `last_update_id` | string | `"upd_2026_03"` — the update ID returned by the previous heartbeat's `latest_update.id` |
| `metadata.installation_time` | string (ISO 8601) | Time the update was applied |
| `metadata.previous_version` | string | App version before this update |

---

## 4. Environment Fields (Conditional)

**Include when:** `telemetry_cat_environment = '1'`  
**Omit entirely when:** `telemetry_cat_environment = '0'`

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `hostname` | string | `"John's iPhone [production]"` | `{device.name} [{environment}]` |
| `machine_name` | string | `"iPhone 15 Pro"` | Device model string |
| `os_info` | string | `"iOS 17.4.1"` / `"Android 14 (API 34)"` | Platform + version |
| `metadata.environment` | string | `"production"` | `"production"`, `"staging"`, or `"debug"` |

**Do NOT include:**
- `metadata.php_version` — not applicable to mobile
- `metadata.server_software` — not applicable to mobile
- `metadata.http_host` — not applicable to mobile

---

## 5. Performance Fields (Conditional)

**Include when:** `telemetry_cat_performance = '1'`  
**Omit entirely when:** `telemetry_cat_performance = '0'`

| Field | Type | Example |
|-------|------|---------|
| `metadata.error_summary` | object | `{ "total": 2, "critical": 0, "error": 1, "warning": 1, "last_error_at": "2026-03-18T14:15:00+02:00" }` |
| `recent_errors` | array | Up to **10** most recent errors/crashes, newest first |

### Mobile Error Object Shape

Each entry in `recent_errors`:

| Field | Type | Notes |
|-------|------|-------|
| `error_type` | string | `"crash"`, `"exception"`, `"js_error"`, `"anr"`, `"network_error"`, `"reported_error"` |
| `error_level` | string | `"error"`, `"warning"`, `"notice"` |
| `message` | string | Error message |
| `timestamp` | string (ISO 8601) | When the error occurred |
| `file` | string \| null | Source file (if available from stack trace) |
| `line` | integer \| null | Line number (if available) |
| `stack_trace` | string \| null | Full stack trace |
| `url` | string \| null | API endpoint being called at time of error (omit if none) |
| `request_method` | string \| null | HTTP method (`"GET"`, `"POST"`, etc.) |
| `request_uri` | string \| null | Request URI — strip query params if `telemetry_strip_params = '1'` |

> **Null fields SHOULD be omitted** from the JSON rather than explicitly sent as `null` — this reduces payload size.

---

## 6. Usage Fields (Conditional — Anonymous Only)

**Include when:** `telemetry_cat_usage = '1'`  
**Omit entirely when:** `telemetry_cat_usage = '0'` (default)

> **CRITICAL PRIVACY RULE:** The usage object MUST contain **zero user identity information**. No user IDs, names, employee numbers, or entity IDs. Only aggregate, anonymous metrics.

| Field | Type | Example |
|-------|------|---------|
| `metadata.usage` | object | See below |
| `metadata.usage.session_duration` | integer | `1800` — seconds since app was foregrounded |
| `metadata.usage.active_module` | string | `"jobs_module"` — generic module slug |
| `metadata.usage.feature_usage` | object | `{ "tap_save_job": 3, "view_schedule": 7 }` |

### Module Slug Rules

`active_module` must be a **generic slug** — never include entity IDs, usernames, or route parameters:

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| `"jobs_module"` | `"jobs/12345"` |
| `"schedule_module"` | `"schedule/employee/987"` |
| `"quotations_module"` | `"api/quotes?user_id=5"` |
| `"dashboard"` | `"home/john.doe"` |

### Feature Usage Rules

`feature_usage` keys are aggregate tap/action counters only:

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| `{ "tap_create_job": 2 }` | `{ "tap_create_job_for_user_5": 2 }` |
| `{ "view_schedule_tab": 5 }` | `{ "viewed_employee_987_schedule": 5 }` |

---

## 7. Privacy Signals

### IP Masking (`metadata.ip_masked`)

When the user has IP masking enabled (`telemetry_ip_masking = '1'`), include this field:

```json
"metadata": {
  "ip_masked": true,
  ...
}
```

The server will then zero the last octet of the IPv4 address (or last 64 bits of IPv6) before storing.

**Do NOT include `metadata.ip_masked` at all when masking is disabled** — omission means "store as-is".

### Field Absence = Consent Withdrawn

If a telemetry category is disabled, **omit the entire category's fields**. Do not send `null` values or empty strings for fields the user hasn't consented to share.

---

## 8. Heartbeat Queue (Offline Retry)

When a heartbeat fails to send (network unavailable, timeout, DNS failure), the app should queue it for later replay.

### Queue Rules

- **Enabled when:** `telemetry_queue_enabled = '1'` (user setting, default `'1'`)
- **Max queue size:** 50 entries — discard oldest when full
- **Queue storage:** persistent local storage (survives app restarts)
- **Clear queue file** immediately before attaching to a new heartbeat request — do not wait for server confirmation
- **Never queue queued replays** — the replay array itself is not re-queued if the request fails again

### Attaching the Queue

On the next successful heartbeat opportunity, attach the queue as `queued_heartbeats`:

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "...",
  "app_version": "2.4.1",
  "update_installed": false,
  "metadata": { ... },
  "queued_heartbeats": [
    {
      "payload": { /* original heartbeat JSON */ },
      "reason": "Network unavailable",
      "queued_at": "2026-03-18T14:00:00+02:00"
    }
  ]
}
```

Each queue entry:

| Field | Type | Description |
|-------|------|-------------|
| `payload` | object | The complete original heartbeat JSON that failed to send |
| `reason` | string | Why it failed: `"Network unavailable"`, `"Timeout after 30s"`, etc. |
| `queued_at` | string (ISO 8601) | When the original heartbeat was generated |

The server returns `queued_processed` in the response — log this for debugging.

---

## 9. Telemetry Settings

The app stores telemetry preferences, configurable in **Settings → Privacy & Telemetry**.

### Settings Keys (persistent local storage)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `telemetry_cat_environment` | `'0'` \| `'1'` | `'1'` | Device info (OS, model, device name) |
| `telemetry_cat_performance` | `'0'` \| `'1'` | `'1'` | Error reports and crash data |
| `telemetry_cat_usage` | `'0'` \| `'1'` | `'0'` | Anonymous usage analytics (session time, feature taps) |
| `telemetry_ip_masking` | `'0'` \| `'1'` | `'1'` | Request server-side IP masking |
| `telemetry_strip_params` | `'0'` \| `'1'` | `'1'` | Strip query params from URLs before sending |
| `telemetry_retention` | `'24h'` \| `'7d'` \| `'30d'` \| `'90d'` | `'30d'` | Requested data retention period |
| `telemetry_queue_enabled` | `'0'` \| `'1'` | `'1'` | Queue failed heartbeats for retry |

### Preset Mappings

| Preset | Environment | Performance | Usage | IP Mask |
|--------|-------------|-------------|-------|---------|
| **Strict** | ❌ | ❌ | ❌ | ✅ |
| **Balanced** (default) | ✅ | ✅ | ❌ | ✅ |
| **Full** | ✅ | ✅ | ✅ | ❌ |

### Essential Category

`telemetry_cat_essential` is always `'1'` and cannot be disabled. The essential fields (§3) are **always sent**.

---

## 10. Server Response Handling

### Success (200 OK)

```json
{
  "success": true,
  "update_available": true,
  "latest_update": {
    "id": "upd_2026_03",
    "version": "2.5.0",
    "description": "<ul><li>New scheduling features</li></ul>",
    "created_at": "2026-03-18T08:00:00+02:00",
    "download_url": "https://updates.softaware.net.za/api/updates/download?update_id=upd_2026_03&software_key=20261001SILU-MOBILE"
  },
  "force_logout": false,
  "server_message": null,
  "is_blocked": false,
  "errors_received": 2,
  "queued_processed": 1
}
```

### Response Field Handling

| Field | Action |
|-------|--------|
| `update_available: true` | Prompt user to update — show `latest_update.version` and `description` |
| `update_available: false` | Silently continue — no notification needed |
| `force_logout: true` | Immediately end the session and return user to login screen |
| `server_message` (non-null string) | Display as a dismissible in-app alert |
| `is_blocked: true` | Lock the app — show blocking screen with reason if provided |
| `errors_received` | Log for debugging purposes |
| `queued_processed` | Log for debugging — confirm queued items were received |

### Error Responses

| HTTP Status | Meaning | Action |
|------------|---------|--------|
| `200` | Success | Normal handling above |
| `403` | Client blocked | Lock the app immediately |
| `404` | Unknown software key | Log error — check `software_key` configuration |
| `429` | Rate limited | Back off exponentially; do not queue |
| `5xx` | Server error | Queue the heartbeat for retry |
| Network timeout | No connection | Queue the heartbeat for retry |

---

## 11. Client Identifier Derivation

The `client_identifier` must be a **stable, anonymous** 64-character hex string that uniquely identifies this installation without containing PII.

### Recommended Derivation

```
client_identifier = SHA-256( device_id + "|" + bundle_id + "|" + platform )
```

| Input | Source |
|-------|--------|
| `device_id` | iOS: `UIDevice.identifierForVendor` (resets on reinstall — acceptable) / Android: `Settings.Secure.ANDROID_ID` |
| `bundle_id` | iOS: `CFBundleIdentifier` / Android: `applicationId` from `build.gradle` |
| `platform` | `"ios"` or `"android"` |

### Example (JavaScript / React Native)

```javascript
import { sha256 } from 'react-native-sha256';
import DeviceInfo from 'react-native-device-info';

async function getClientIdentifier(): Promise<string> {
  const deviceId  = await DeviceInfo.getUniqueId();   // vendor ID
  const bundleId  = DeviceInfo.getBundleId();
  const platform  = Platform.OS;                       // 'ios' | 'android'
  return sha256(`${deviceId}|${bundleId}|${platform}`);
}
```

### Stability Requirements

- Must be the **same value** on every heartbeat for a given device+install
- Should survive app updates (within the same install)
- May change on fresh reinstall — this creates a new client record on the server, which is acceptable
- Must **NOT** include email addresses, user IDs, phone numbers, or any PII

---

## 12. Sending the Request

### Headers

```
Content-Type: application/json
Accept: application/json
X-Software-Key: 20261001SILU-MOBILE
User-Agent: SilulumanziMobile/2.4.1 (iOS 17.4.1; iPhone 15 Pro)
```

### Timeout

- **Connect timeout:** 10 seconds
- **Read timeout:** 30 seconds
- On timeout: queue the heartbeat (if `telemetry_queue_enabled = '1'`)

### `check_time` Format

Use ISO 8601 with the **local timezone offset** — never append `Z` (UTC):

```javascript
// ✅ Correct
const checkTime = new Date().toLocaleString('en-ZA', { 
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  hour12: false 
}); // produces "2026-03-18T14:30:00+02:00"

// ✅ Also correct — format manually
function toLocalIso(): string {
  const d   = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh  = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm  = String(Math.abs(off) % 60).padStart(2, '0');
  return d.toISOString().replace('Z', `${sign}${hh}:${mm}`);
}

// ❌ WRONG — server uses different logic for 'Z'-suffixed datetimes
const checkTime = new Date().toISOString();  // "2026-03-18T12:30:00.000Z"
```

### Example Implementation (React Native / TypeScript)

```typescript
import axios from 'axios';

const HEARTBEAT_URL = 'https://updates.softaware.net.za/api/updates/heartbeat';
const SOFTWARE_KEY  = '20261001SILU-MOBILE';

async function sendHeartbeat(settings: TelemetrySettings): Promise<HeartbeatResponse> {
  const payload: Record<string, any> = {
    software_key:       SOFTWARE_KEY,
    client_identifier:  await getClientIdentifier(),
    app_version:        DeviceInfo.getVersion(),
    update_installed:   false,
    metadata: {
      check_time:       toLocalIso(),
      portal_type:      'Silulumanzi Mobile',
      retention_hint:   settings.telemetry_retention ?? '30d',
    },
  };

  // IP masking signal
  if (settings.telemetry_ip_masking === '1') {
    payload.metadata.ip_masked = true;
  }

  // Environment category
  if (settings.telemetry_cat_environment === '1') {
    payload.hostname     = `${DeviceInfo.getDeviceNameSync()} [${getEnvironment()}]`;
    payload.machine_name = DeviceInfo.getModel();
    payload.os_info      = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${DeviceInfo.getSystemVersion()}`;
    payload.metadata.environment = getEnvironment();
  }

  // Performance category
  if (settings.telemetry_cat_performance === '1') {
    const errors = await collectRecentErrors();  // your error buffer
    payload.metadata.error_summary = buildErrorSummary(errors);
    if (errors.length > 0) payload.recent_errors = errors.slice(0, 10);
  }

  // Usage category (anonymous only)
  if (settings.telemetry_cat_usage === '1') {
    payload.metadata.usage = {
      session_duration: getSessionDuration(),     // seconds since foreground
      active_module:    getActiveModuleSlug(),    // generic slug, no IDs
      feature_usage:    getFeatureCounters(),     // aggregate counters
    };
  }

  // Queued heartbeat replay
  if (settings.telemetry_queue_enabled === '1') {
    const queue = await loadHeartbeatQueue();
    if (queue.length > 0) {
      payload.queued_heartbeats = queue;
      await clearHeartbeatQueue();  // clear BEFORE sending
    }
  }

  const response = await axios.post<HeartbeatResponse>(HEARTBEAT_URL, payload, {
    headers: {
      'Content-Type':  'application/json',
      'X-Software-Key': SOFTWARE_KEY,
      'User-Agent':    buildUserAgent(),
    },
    timeout: 30000,
  });

  return response.data;
}
```

---

## 13. Example Payloads

### 13.1 Strict Preset — Minimum Data

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "app_version": "2.4.1",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Mobile",
    "retention_hint": "24h",
    "ip_masked": true
  }
}
```

### 13.2 Balanced Preset — Environment + Performance

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "app_version": "2.4.1",
  "update_installed": false,
  "hostname": "John's iPhone [production]",
  "machine_name": "iPhone 15 Pro",
  "os_info": "iOS 17.4.1",
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Mobile",
    "retention_hint": "30d",
    "ip_masked": true,
    "environment": "production",
    "error_summary": {
      "total": 1,
      "critical": 0,
      "error": 1,
      "warning": 0,
      "last_error_at": "2026-03-18T13:00:00+02:00"
    }
  },
  "recent_errors": [
    {
      "error_type": "network_error",
      "error_level": "error",
      "message": "Request timed out after 30s",
      "timestamp": "2026-03-18T13:00:00+02:00",
      "url": "https://portal.silulumanzi.co.za/api/jobs",
      "request_method": "GET"
    }
  ]
}
```

### 13.3 Full Preset — All Categories + Anonymous Usage

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "app_version": "2.4.1",
  "update_installed": false,
  "hostname": "John's iPhone [production]",
  "machine_name": "iPhone 15 Pro",
  "os_info": "iOS 17.4.1",
  "metadata": {
    "check_time": "2026-03-18T14:30:00+02:00",
    "portal_type": "Silulumanzi Mobile",
    "retention_hint": "30d",
    "environment": "production",
    "error_summary": {
      "total": 0
    },
    "usage": {
      "session_duration": 1200,
      "active_module": "jobs_module",
      "feature_usage": {
        "tap_view_job": 8,
        "tap_update_status": 3,
        "tap_schedule_tab": 2
      }
    }
  }
}
```

### 13.4 With Queued Replay

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "a1b2c3d4e5f6...",
  "app_version": "2.4.1",
  "update_installed": false,
  "metadata": {
    "check_time": "2026-03-18T16:00:00+02:00",
    "portal_type": "Silulumanzi Mobile",
    "retention_hint": "30d",
    "ip_masked": true
  },
  "queued_heartbeats": [
    {
      "payload": {
        "software_key": "20261001SILU-MOBILE",
        "client_identifier": "a1b2c3d4e5f6...",
        "app_version": "2.4.1",
        "update_installed": false,
        "metadata": {
          "check_time": "2026-03-18T14:00:00+02:00",
          "portal_type": "Silulumanzi Mobile",
          "retention_hint": "30d",
          "ip_masked": true
        }
      },
      "reason": "Network unavailable",
      "queued_at": "2026-03-18T14:00:00+02:00"
    }
  ]
}
```

### 13.5 Installation Notification

```json
{
  "software_key": "20261001SILU-MOBILE",
  "client_identifier": "a1b2c3d4e5f6...",
  "app_version": "2.5.0",
  "update_installed": true,
  "last_update_id": "upd_2026_03",
  "hostname": "John's iPhone [production]",
  "machine_name": "iPhone 15 Pro",
  "os_info": "iOS 17.4.1",
  "metadata": {
    "check_time": "2026-03-18T10:00:00+02:00",
    "portal_type": "Silulumanzi Mobile",
    "retention_hint": "30d",
    "ip_masked": true,
    "environment": "production",
    "installation_time": "2026-03-18T09:58:45+02:00",
    "previous_version": "2.4.1"
  }
}
```

---

## 14. Testing Checklist

### Before Integration

- [ ] `software_key` is confirmed with the Softaware server team for mobile app
- [ ] `client_identifier` is stable across app restarts (test by closing + reopening app)
- [ ] `client_identifier` changes on fresh reinstall
- [ ] `check_time` is in `+HH:MM` offset format, NOT `Z` suffix
- [ ] `metadata.portal_type` is exactly `"Silulumanzi Mobile"` (not "Portal")

### Telemetry Categories

- [ ] Strict preset → only essential fields sent (no `hostname`, no `recent_errors`, no `metadata.usage`)
- [ ] Balanced preset → environment + performance fields present, `metadata.usage` absent
- [ ] Full preset → all fields present, including `metadata.usage` with anonymous-only data
- [ ] When `telemetry_cat_usage = '0'` → `metadata.usage` is completely absent from payload
- [ ] `metadata.usage.active_module` is a generic slug, **not** a URL or entity ID

### Privacy

- [ ] `metadata.ip_masked: true` present when `telemetry_ip_masking = '1'`
- [ ] `metadata.ip_masked` absent when `telemetry_ip_masking = '0'`
- [ ] No `user_name`, `user_id`, or `active_page` fields in ANY payload (these are removed in v4)

### Queue Replay

- [ ] Disable network → heartbeat is queued locally
- [ ] Re-enable network → next heartbeat includes `queued_heartbeats` array
- [ ] Server response includes `queued_processed: 1` (or more)
- [ ] Queue is cleared before sending — not re-queued on second failure

### Response Handling

- [ ] `update_available: true` → update prompt is shown to user
- [ ] `force_logout: true` → session is ended, user returned to login
- [ ] `is_blocked: true` → app is locked with appropriate message
- [ ] `server_message` (non-null) → dismissible alert shown
- [ ] `403` response → app locked
- [ ] `5xx` response → heartbeat queued for retry

### Installation Notification

- [ ] `update_installed: true` sent after successful update download + install
- [ ] `last_update_id` matches the `id` from the previous heartbeat's `latest_update.id`
- [ ] `metadata.previous_version` is the version before the update, not the new version

---

## Appendix: Related Files

| File | Location | Purpose |
|------|----------|---------|
| `UPDATES_REWRITE.md` | `/var/opt/documentation/Wiring/` | Authoritative v4 protocol specification |
| `CLIENT_INTEGRATION_SPEC.md` | `/var/opt/documentation/Wiring/` | Integration spec for web portal (PHP) clients |
| `updHeartbeat.ts` | `/var/opt/backend/src/routes/` | Server-side heartbeat handler |
| `updatesTypes.ts` | `/var/opt/backend/src/db/` | Server-side TypeScript types |
