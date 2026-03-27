# Admin Audit Log — Field & Data Dictionary

## Database: SQLite (`/var/opt/backend/data/audit_log.db`)

### Table: `admin_audit_log`

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INTEGER` (PK, AI) | No | Auto | `id` | Auto-increment primary key |
| `user_id` | `TEXT` | No | — | `user_id` | User ID string (e.g., 'admin-softaware-001') |
| `user_email` | `TEXT` | No | `''` | `user_email` | User email (resolved from MySQL `users` table) |
| `user_name` | `TEXT` | No | `''` | `user_name` | User display name (resolved from MySQL `users` table) |
| `action` | `TEXT` | No | — | `action` | HTTP method: GET, POST, PUT, PATCH, DELETE |
| `resource` | `TEXT` | No | — | `resource` | Full route path (e.g., `/api/admin/clients/5/status`) |
| `resource_type` | `TEXT` | No | `''` | `resource_type` | Auto-derived category (clients, credits, settings, etc.) |
| `description` | `TEXT` | No | `''` | `description` | Auto-generated human-readable description |
| `request_body` | `TEXT` | No | `'{}'` | `request_body` | JSON stringified request body (sensitive fields redacted) |
| `response_status` | `INTEGER` | No | `0` | `response_status` | HTTP response status code (200, 404, 500, etc.) |
| `ip_address` | `TEXT` | No | `''` | `ip_address` | Client IP (from `req.ip` / `x-forwarded-for` / socket) |
| `user_agent` | `TEXT` | No | `''` | `user_agent` | Browser user agent string |
| `duration_ms` | `INTEGER` | No | `0` | `duration_ms` | Request duration in milliseconds |
| `created_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` | `created_at` | Timestamp when entry was created (UTC) |

### Indexes

| Name | Type | Columns | Purpose |
|------|------|---------|---------|
| `PRIMARY` | Primary Key | `id` | Row identity (autoincrement) |
| `idx_audit_user` | Index | `(user_id, created_at)` | Fast lookup by user + time range |
| `idx_audit_created` | Index | `(created_at)` | Fast time-based queries (trim, date filters) |
| `idx_audit_resource` | Index | `(resource_type, created_at)` | Fast category + time filtering |
| `idx_audit_action` | Index | `(action, created_at)` | Fast method + time filtering |

### SQLite Configuration

| Pragma | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | `WAL` | Write-ahead logging for concurrent reads/writes |
| `busy_timeout` | `5000` | Wait up to 5s for locks instead of failing immediately |

---

## Resource Type Derivation

The `resource_type` field is auto-derived from the URL path by `deriveResourceType()`:

### Admin routes (`/api/admin/*`)

| URL Pattern | Derived Type |
|-------------|-------------|
| `/api/admin/clients*` | `clients` |
| `/api/admin/credits*` | `credits` |
| `/api/admin/config*` | `config` |
| `/api/admin/dashboard*` | `dashboard` |
| `/api/admin/packages*` | `packages` |
| `/api/admin/enterprise-endpoints*` | `enterprise-endpoints` |
| `/api/admin/cases*` | `cases` |
| `/api/admin/audit-log*` | `audit-log` |
| `/api/admin/stats*` | `stats` |
| `/api/admin/activation-keys*` | `activation-keys` |
| `/api/admin/teams*` | `teams` |
| `/api/admin/leads*` | `leads` |

### System routes (`/api/*`)

| URL Pattern | Derived Type |
|-------------|-------------|
| `/api/settings*` | `settings` |
| `/api/users*` | `users` |
| `/api/roles*` | `roles` |
| `/api/permissions*` | `permissions` |
| `/api/credentials*` | `credentials` |
| `/api/email*` | `email` |
| `/api/sms*` | `sms` |
| (anything else) | `other` |

---

## Sensitive Field Redaction

The following field names are automatically replaced with `[REDACTED]` in `request_body` before storage:

```
password, secret, token, api_key, apiKey, credential,
credit_card, creditCard, ssn, pin, otp, backup_codes,
private_key, privateKey, access_token, accessToken,
refresh_token, refreshToken, authorization, smtp_pass
```

Matching is **case-insensitive** and applied **recursively** to nested objects and arrays.

---

## Body Sanitization (Middleware)

In the `auditLogger` middleware, request bodies are additionally sanitized:
- String fields longer than **2000 characters** are truncated to 200 chars + `...[truncated]`
- Non-object bodies are replaced with `'{}'`
- Errors during sanitization silently return `'{}'`

---

## User Info Cache

The `auditLogger` middleware maintains an in-memory cache for user info lookups:

| Setting | Value | Description |
|---------|-------|-------------|
| Key | `user_id` (string) | Map key |
| Value | `{ email, name, expires }` | Cached user info |
| TTL | 5 minutes (300,000 ms) | Cache entry lifetime |
| Source | `SELECT email, name FROM users WHERE id = ?` | MySQL query |

---

## Backend TypeScript Interfaces

### `AuditLogEntry` (full entry from DB)
```typescript
interface AuditLogEntry {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;          // HTTP method
  resource: string;        // Route path
  resource_type: string;   // Derived category
  description: string;     // Human-readable
  request_body: string;    // JSON (sanitized)
  response_status: number; // HTTP status
  ip_address: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}
```

### `AuditLogInsert` (input for logging)
```typescript
interface AuditLogInsert {
  user_id: string;
  user_email?: string;
  user_name?: string;
  action: string;
  resource: string;
  resource_type?: string;    // Auto-derived if omitted
  description?: string;      // Auto-generated if omitted
  request_body?: string;     // Sensitive fields auto-stripped
  response_status?: number;
  ip_address?: string;
  user_agent?: string;
  duration_ms?: number;
}
```

### `AuditLogQueryParams` (filter input)
```typescript
interface AuditLogQueryParams {
  page?: number;       // Default: 1
  limit?: number;      // Default: 50, max: 500
  user_id?: string;
  action?: string;     // Uppercased automatically
  resource_type?: string;
  search?: string;     // LIKE search across resource, description, email, name
  from_date?: string;
  to_date?: string;
  status_min?: number;
  status_max?: number;
}
```

### `AuditLogStats` (statistics response)
```typescript
interface AuditLogStats {
  total_entries: number;
  oldest_entry: string | null;
  newest_entry: string | null;
  entries_today: number;
  entries_this_week: number;
  entries_this_month: number;
  top_users: Array<{ user_email: string; count: number }>;
  top_resources: Array<{ resource_type: string; count: number }>;
  error_count: number;
  db_size_mb: number;
}
```

---

## Frontend TypeScript Interfaces

### `AuditLogEntry` (mirror of backend)
```typescript
// src/models/AdminAuditLogModel.ts
interface AuditLogEntry {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource: string;
  resource_type: string;
  description: string;
  request_body: string;
  response_status: number;
  ip_address: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}
```

### `AuditLogFilters` (filter dropdown values)
```typescript
interface AuditLogFilters {
  resource_types: string[];
  users: Array<{ user_id: string; user_email: string; user_name: string }>;
  actions: string[];
}
```

### `AuditLogQueryParams` (frontend filter input)
```typescript
interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  status_min?: number;
  status_max?: number;
}
```
