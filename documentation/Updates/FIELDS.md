# Updates & Error Reporting Module — Data Schema

**Version:** 1.0.0  
**Last Updated:** 2026-06-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 9 |
| **Backend TypeScript interfaces** | 7 + 1 type + 1 function |
| **Frontend TypeScript interfaces** | 6 types/interfaces |
| **Database** | `softaware` (MySQL 8.x) |

---

## 2. MySQL Tables

### 2.1 `update_software` — Software Product Registry

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| name | VARCHAR | — | — | Product name |
| description | TEXT | ✅ | NULL | Product description |
| software_key | VARCHAR | — | — | Unique API key for client authentication (UNIQUE) |
| created_by | VARCHAR(36) | ✅ | NULL | FK → users.id (UUID) |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Record creation |
| updated_at | DATETIME | — | CURRENT_TIMESTAMP ON UPDATE | Last modification |
| has_external_integration | TINYINT(1) | — | 0 | Whether external integration is configured |
| external_username | VARCHAR | ✅ | NULL | External system username |
| external_password | VARCHAR | ✅ | NULL | External system password |
| external_live_url | VARCHAR | ✅ | NULL | Production URL |
| external_test_url | VARCHAR | ✅ | NULL | Staging/test URL |
| external_mode | VARCHAR | ✅ | NULL | `'live'` \| `'test'` |
| external_integration_notes | TEXT | ✅ | NULL | Integration notes |

**Backend interface:** `UpdSoftware`

---

### 2.2 `update_releases` — Release Packages

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| software_id | INT UNSIGNED | — | — | FK → update_software.id |
| version | VARCHAR | — | — | Semantic version string (e.g. "2.1.0") |
| description | TEXT | ✅ | NULL | Release notes |
| file_path | VARCHAR | ✅ | NULL | Relative path to uploaded file (e.g. `uploads/updates/2.1.0_1718000000_file.zip`) |
| file_size | BIGINT | ✅ | NULL | File size in bytes |
| file_name | VARCHAR | ✅ | NULL | Original filename |
| uploaded_by | VARCHAR(36) | ✅ | NULL | FK → users.id (UUID) |
| has_migrations | TINYINT(1) | — | 0 | Whether the release includes DB migrations |
| migration_notes | TEXT | ✅ | NULL | Migration instructions |
| schema_file | VARCHAR | ✅ | NULL | Path to schema/migration SQL file |
| released_at | DATETIME | ✅ | NULL | Release date |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Record creation |

**Backend interface:** `UpdUpdate`

---

### 2.3 `update_clients` — Client Heartbeat Records

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| software_id | INT UNSIGNED | — | — | FK → update_software.id |
| client_identifier | VARCHAR | — | — | Unique client identifier (generated from hostname + machine_name) |
| ip_address | VARCHAR | ✅ | NULL | Client IP address |
| hostname | VARCHAR | ✅ | NULL | Client machine hostname |
| machine_name | VARCHAR | ✅ | NULL | Machine display name |
| os_info | VARCHAR | ✅ | NULL | OS description |
| app_version | VARCHAR | ✅ | NULL | Running application version |
| last_update_id | INT UNSIGNED | ✅ | NULL | Last installed update ID |
| last_update_installed_at | DATETIME | ✅ | NULL | When the last update was installed |
| last_heartbeat | DATETIME | — | CURRENT_TIMESTAMP | Last heartbeat timestamp (critical for status computation) |
| first_seen | DATETIME | — | CURRENT_TIMESTAMP | When this client first registered |
| user_agent | VARCHAR | ✅ | NULL | HTTP User-Agent header |
| metadata | JSON | ✅ | NULL | Arbitrary client metadata |
| is_blocked | TINYINT(1) | — | 0 | Whether the client is blocked from heartbeating |
| blocked_at | DATETIME | ✅ | NULL | When the client was blocked |
| blocked_reason | VARCHAR | ✅ | NULL | Admin-provided block reason |
| user_name | VARCHAR | ✅ | NULL | Currently logged-in user name |
| user_id | INT | ✅ | NULL | Currently logged-in user ID |
| active_page | VARCHAR | ✅ | NULL | Current active page/screen |
| ai_sessions_active | INT | — | 0 | Number of active AI sessions |
| ai_model | VARCHAR | ✅ | NULL | AI model in use |
| force_logout | TINYINT(1) | — | 0 | Pending force logout command (cleared after delivery) |
| server_message | TEXT | ✅ | NULL | Pending server message (cleared after delivery) |
| server_message_id | VARCHAR | ✅ | NULL | Server message tracking ID |

**Backend interface:** `UpdClient`

**Computed fields (not stored, computed in queries):**
- `seconds_since_heartbeat` — `TIMESTAMPDIFF(SECOND, last_heartbeat, NOW())`
- `status` — derived via `computeClientStatus(seconds_since_heartbeat)`

**Client lifecycle:**
```
First Heartbeat → INSERT (first_seen = NOW(), last_heartbeat = NOW())
Subsequent Heartbeats → UPDATE (last_heartbeat = NOW(), ip_address, os_info, app_version, etc.)
Block Action → UPDATE (is_blocked = 1, blocked_at = NOW(), blocked_reason = ?)
Unblock Action → UPDATE (is_blocked = 0, blocked_at = NULL, blocked_reason = NULL)
Force Logout → UPDATE (force_logout = 1) → delivered in heartbeat response → UPDATE (force_logout = 0)
Send Message → UPDATE (server_message = ?) → delivered in heartbeat response → UPDATE (server_message = NULL)
Delete → DELETE FROM update_clients WHERE id = ?
```

---

### 2.4 `update_modules` — Software Module Tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| software_id | INT UNSIGNED | — | — | FK → update_software.id |
| name | VARCHAR | — | — | Module name (UNIQUE per software_id) |
| description | TEXT | ✅ | NULL | Module description |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Record creation |
| updated_at | DATETIME | — | CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Backend interface:** `UpdModule`

---

### 2.5 `update_user_modules` — Developer-to-Module Assignments

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| user_id | VARCHAR(36) | — | — | FK → users.id (UUID) |
| module_id | INT UNSIGNED | — | — | FK → update_modules.id |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Assignment timestamp |

**Backend interface:** `UpdUserModule`

**Constraints:** UNIQUE on (user_id, module_id) — enforced in application code.

---

### 2.6 `update_installed` — Installation Tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| update_id | INT UNSIGNED | — | — | FK → update_releases.id |
| status | VARCHAR | — | — | Installation status (e.g. `'installed'`, `'pending'`, `'failed'`) |
| installed_at | DATETIME | — | CURRENT_TIMESTAMP | Installation timestamp |

**Backend interface:** `UpdInstalledUpdate`

---

### 2.7 `update_password_resets` — OTP Password Reset Tokens

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| user_id | VARCHAR(36) | — | — | FK → users.id (UUID) |
| token | VARCHAR | — | — | 6-digit OTP code |
| expires_at | DATETIME | — | — | Expiry time (15 minutes from creation) |
| used | TINYINT(1) | — | 0 | Whether the token has been consumed |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Token creation time |

**Backend interface:** `UpdPasswordResetToken`

**Token lifecycle:**
```
POST /password_reset → INSERT (expires_at = NOW() + 15 min, used = 0)
POST /verify_otp → SELECT WHERE used = 0 AND expires_at > NOW()
POST /reset_password → UPDATE (used = 1), DELETE other tokens for same user
Expired tokens → cleaned up on next /password_reset call
```

---

### 2.8 `error_reports` — Individual Error Records

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGINT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| software_key | VARCHAR | — | — | Software product key (denormalized from update_software) |
| client_identifier | VARCHAR | ✅ | NULL | Client identifier string |
| error_type | VARCHAR | ✅ | NULL | Error type/category |
| error_level | VARCHAR | — | `'error'` | `'error'` \| `'warning'` \| `'notice'` |
| message | TEXT | ✅ | NULL | Error message |
| file | VARCHAR | ✅ | NULL | Source file path |
| line | INT | ✅ | NULL | Source line number |
| stack_trace | TEXT | ✅ | NULL | Full stack trace |
| url | VARCHAR | ✅ | NULL | Request URL (web errors) |
| user_agent | VARCHAR | ✅ | NULL | Client User-Agent |
| request_method | VARCHAR | ✅ | NULL | HTTP method |
| request_uri | VARCHAR | ✅ | NULL | Request URI |
| hostname | VARCHAR | ✅ | NULL | Client hostname |
| app_version | VARCHAR | ✅ | NULL | Application version |
| os_info | VARCHAR | ✅ | NULL | OS description |
| source | VARCHAR | ✅ | NULL | `'backend'` \| `'frontend'` \| `'desktop'` \| `'mobile'` |
| ip_address | VARCHAR | ✅ | NULL | Client IP address |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Error timestamp |

**Frontend interface:** `ErrorReport`

---

### 2.9 `client_error_summaries` — Aggregated Error Statistics

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGINT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| software_key | VARCHAR | — | — | Software product key |
| client_identifier | VARCHAR | — | — | Client identifier |
| hostname | VARCHAR | ✅ | NULL | Client hostname |
| total_errors | INT | — | 0 | Total error-level reports |
| total_warnings | INT | — | 0 | Total warning-level reports |
| total_notices | INT | — | 0 | Total notice-level reports |
| last_error_at | DATETIME | ✅ | NULL | Timestamp of most recent error |
| first_error_at | DATETIME | ✅ | NULL | Timestamp of first error |
| updated_at | DATETIME | — | CURRENT_TIMESTAMP ON UPDATE | Last aggregation update |

**Frontend interface:** `ClientErrorSummary`

**Upsert pattern:** Updated on every error report ingestion (both `POST /error-report` and heartbeat `recent_errors`):
```sql
INSERT INTO client_error_summaries (software_key, client_identifier, hostname, total_errors, ...)
VALUES (?, ?, ?, ?, ...)
ON DUPLICATE KEY UPDATE
  total_errors = total_errors + ?,
  error_count = error_count + ?,
  warning_count = warning_count + ?,
  notice_count = notice_count + ?,
  last_error_at = NOW()
```

---

## 3. Backend TypeScript Interfaces

### 3.1 `UpdSoftware` — Software Product

```typescript
export interface UpdSoftware {
  id: number;
  name: string;
  description?: string;
  software_key: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  has_external_integration: number;
  external_username?: string;
  external_password?: string;
  external_live_url?: string;
  external_test_url?: string;
  external_mode?: string;
  external_integration_notes?: string;
}
```

### 3.2 `UpdUpdate` — Release Package

```typescript
export interface UpdUpdate {
  id: number;
  software_id: number;
  version: string;
  description?: string;
  file_path?: string;
  file_size?: number;
  file_name?: string;
  uploaded_by?: string;
  has_migrations: number;
  migration_notes?: string;
  schema_file?: string;
  released_at?: Date;
  created_at: Date;
}
```

### 3.3 `UpdClient` — Client Record

```typescript
export interface UpdClient {
  id: number;
  software_id: number;
  client_identifier: string;
  ip_address?: string;
  hostname?: string;
  machine_name?: string;
  os_info?: string;
  app_version?: string;
  last_update_id?: number;
  last_update_installed_at?: Date;
  last_heartbeat: Date;
  first_seen: Date;
  user_agent?: string;
  metadata?: any;
  is_blocked: number;
  blocked_at?: Date;
  blocked_reason?: string;
  user_name?: string;
  user_id?: number;
  active_page?: string;
  ai_sessions_active: number;
  ai_model?: string;
  force_logout: number;
  server_message?: string;
  server_message_id?: string;
}
```

### 3.4 `UpdModule` — Module

```typescript
export interface UpdModule {
  id: number;
  software_id: number;
  name: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}
```

### 3.5 `UpdUserModule` — Developer Assignment

```typescript
export interface UpdUserModule {
  id: number;
  user_id: string;
  module_id: number;
  created_at: Date;
}
```

### 3.6 `UpdInstalledUpdate` — Installation Record

```typescript
export interface UpdInstalledUpdate {
  id: number;
  update_id: number;
  status: string;
  installed_at: Date;
}
```

### 3.7 `UpdPasswordResetToken` — OTP Token

```typescript
export interface UpdPasswordResetToken {
  id: number;
  user_id: string;
  token: string;
  expires_at: Date;
  used: number;
  created_at: Date;
}
```

### 3.8 `computeClientStatus()` — Status Computation

```typescript
export type ClientStatus = 'online' | 'recent' | 'inactive' | 'offline';

export function computeClientStatus(secondsSinceHeartbeat: number): ClientStatus {
  if (secondsSinceHeartbeat < 300)     return 'online';   // < 5 min
  if (secondsSinceHeartbeat < 86400)   return 'recent';   // < 24 hr
  if (secondsSinceHeartbeat < 604800)  return 'inactive'; // < 7 days
  return 'offline';
}
```

---

## 4. Frontend TypeScript Types

### 4.1 `ClientStatus`

```typescript
export type ClientStatus = 'online' | 'recent' | 'inactive' | 'offline';
```

### 4.2 `UpdateClient`

```typescript
export interface UpdateClient {
  // Core identity
  id: number;
  software_id: number;
  client_identifier: string;
  hostname: string | null;
  machine_name: string | null;
  ip_address: string | null;

  // System metadata
  os_info: string | null;
  app_version: string | null;
  user_agent: string | null;
  user_name: string | null;
  user_id: string | null;
  active_page: string | null;
  ai_sessions_active: number | null;
  ai_model: string | null;
  cpu_usage: number | null;
  memory_usage: number | null;

  // Update tracking
  last_update_id: number | null;
  last_update_installed_at: string | null;
  metadata: Record<string, any> | null;

  // Heartbeat
  last_heartbeat: string | null;
  first_seen: string | null;

  // Block state
  is_blocked: number;
  blocked_at: string | null;
  blocked_reason: string | null;

  // Pending commands
  force_logout: number;
  server_message: string | null;
  server_message_id: string | null;

  // Computed (from backend JOIN)
  software_name: string | null;
  last_update_version: string | null;
  seconds_since_heartbeat: number | null;
  status: ClientStatus;
}
```

### 4.3 `ErrorReport`

```typescript
export interface ErrorReport {
  id: number;
  software_key: string;
  client_identifier: string;
  error_type: string;
  error_level: 'error' | 'warning' | 'notice';
  message: string;
  file: string | null;
  line: number | null;
  stack_trace: string | null;
  url: string | null;
  user_agent: string | null;
  request_method: string | null;
  request_uri: string | null;
  hostname: string | null;
  app_version: string | null;
  os_info: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string;
  software_name?: string;   // Joined
}
```

### 4.4 `ClientErrorSummary`

```typescript
export interface ClientErrorSummary {
  id: number;
  software_key: string;
  client_identifier: string;
  hostname: string | null;
  total_errors: number;
  total_warnings: number;
  total_notices: number;
  last_error_at: string | null;
  first_error_at: string | null;
  updated_at: string;
}
```

### 4.5 `ClientAction` & `ClientActionPayload`

```typescript
export type ClientAction = 'block' | 'unblock' | 'force_logout' | 'send_message';

export interface ClientActionPayload {
  id: number;
  action: ClientAction;
  blocked_reason?: string;
  server_message?: string;
}
```

### 4.6 `UpdatesDashboard`

```typescript
export interface UpdatesDashboard {
  summary: {
    software_count: number;
    update_count: number;
    user_count: number;
    active_clients_24h: number;
  };
  latest_clients: {
    id: number;
    software_id: number;
    software_name: string;
    hostname: string;
    machine_name: string;
    app_version: string;
    last_heartbeat: string;
  }[];
  recent_updates: {
    id: number;
    software_id: number;
    software_name: string;
    version: string;
    created_at: string;
  }[];
}
```

---

## 5. Entity Relationships

```
update_software (1) ──── (N) update_releases
       │                         │
       │                         └──── (N) update_installed
       │
       ├──── (N) update_clients
       │              │
       │              └──── error_reports (via software_key + client_identifier)
       │              └──── client_error_summaries (via software_key + client_identifier)
       │
       └──── (N) update_modules
                      │
                      └──── (N) update_user_modules ──── (1) users

update_password_resets ──── (1) users
```

**Key relationships:**
- A **software product** has many **releases**, **clients**, and **modules**
- A **client** belongs to one software product and has many **error reports**
- A **module** belongs to one software product and has many **developer assignments**
- **Error summaries** aggregate errors per (software_key + client_identifier) pair
- **Password resets** are linked to users, not to software products
