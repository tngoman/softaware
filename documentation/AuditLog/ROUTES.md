# Admin Audit Log — Route & API Reference

## Route Registration

**Backend mount point**: `/admin/audit-log` — All routes require JWT via `requireAuth` + `requireAdmin`

```
src/routes/adminAuditLog.ts → adminAuditLogRouter mounted at /admin/audit-log
```

**Note**: This router is mounted **without** the `auditLogger` middleware (unlike other `/admin/*` sub-routers) to prevent recursive logging when admins browse the audit log.

---

## Route Summary

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | `/admin/audit-log` | JWT + Admin | Paginated, filterable log list |
| 2 | GET | `/admin/audit-log/stats` | JWT + Admin | Dashboard statistics |
| 3 | GET | `/admin/audit-log/filters` | JWT + Admin | Available filter values |
| 4 | POST | `/admin/audit-log/trim` | JWT + Admin | Trim entries older than N days |
| 5 | DELETE | `/admin/audit-log/bulk` | JWT + Admin | Delete specific entries by ID |
| 6 | DELETE | `/admin/audit-log/purge` | JWT + Admin | Purge ALL entries (danger zone) |

---

## Detailed Route Documentation

### 1. GET `/admin/audit-log`
**Purpose**: Get paginated audit log entries with optional filters
**Auth**: JWT + Admin required

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-based) |
| `limit` | `number` | `50` | Items per page (max 500) |
| `user_id` | `string` | — | Filter by user ID |
| `action` | `string` | — | Filter by HTTP method (GET/POST/PUT/PATCH/DELETE) |
| `resource_type` | `string` | — | Filter by derived category (clients, credits, settings, etc.) |
| `search` | `string` | — | Free-text search across resource, description, user_email, user_name |
| `from_date` | `string` | — | Filter entries from this date (ISO format) |
| `to_date` | `string` | — | Filter entries up to this date (ISO format) |
| `status_min` | `number` | — | Minimum response status (e.g., 400 for errors only) |
| `status_max` | `number` | — | Maximum response status |

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "admin-softaware-001",
      "user_email": "admin@softaware.net.za",
      "user_name": "Admin User",
      "action": "PUT",
      "resource": "/api/admin/clients/5/status",
      "resource_type": "clients",
      "description": "Updated /admin/clients/5/status",
      "request_body": "{\"status\":\"active\"}",
      "response_status": 200,
      "ip_address": "102.xxx.xxx.xxx",
      "user_agent": "Mozilla/5.0 ...",
      "duration_ms": 45,
      "created_at": "2026-03-16 10:30:00"
    }
  ],
  "total": 1234,
  "page": 1,
  "limit": 50,
  "totalPages": 25
}
```

**SQLite query construction**:
```sql
SELECT * FROM admin_audit_log
  WHERE user_id = ? AND action = ? AND resource_type = ?
    AND (resource LIKE ? OR description LIKE ? OR user_email LIKE ? OR user_name LIKE ?)
    AND created_at >= ? AND created_at <= ?
    AND response_status >= ? AND response_status <= ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
```

---

### 2. GET `/admin/audit-log/stats`
**Purpose**: Get dashboard statistics for the audit log
**Auth**: JWT + Admin required

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "total_entries": 12345,
    "oldest_entry": "2025-12-01 08:00:00",
    "newest_entry": "2026-03-16 10:30:00",
    "entries_today": 42,
    "entries_this_week": 312,
    "entries_this_month": 1456,
    "top_users": [
      { "user_email": "admin@softaware.net.za", "count": 5678 },
      { "user_email": "user@example.com", "count": 1234 }
    ],
    "top_resources": [
      { "resource_type": "clients", "count": 3456 },
      { "resource_type": "settings", "count": 789 }
    ],
    "error_count": 23,
    "db_size_mb": 4.56
  }
}
```

**SQLite queries used**:
- `SELECT COUNT(*) FROM admin_audit_log` — total
- `SELECT MIN/MAX(created_at)` — date range
- `WHERE created_at >= date('now')` — today
- `WHERE created_at >= date('now', '-7 days')` — this week
- `WHERE created_at >= date('now', '-30 days')` — this month
- `WHERE response_status >= 400` — errors
- `GROUP BY user_email ORDER BY count DESC LIMIT 10` — top users
- `GROUP BY resource_type ORDER BY count DESC LIMIT 10` — top resources
- `fs.statSync(DB_PATH).size` — DB file size

---

### 3. GET `/admin/audit-log/filters`
**Purpose**: Get available filter dropdown values for the UI
**Auth**: JWT + Admin required

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "resource_types": ["clients", "credits", "settings", "users", "packages", "other"],
    "users": [
      { "user_id": "admin-softaware-001", "user_email": "admin@softaware.net.za", "user_name": "Admin User" }
    ],
    "actions": ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
}
```

**Note**: `resource_types` and `users` come from `SELECT DISTINCT` queries. `actions` are hard-coded.

---

### 4. POST `/admin/audit-log/trim`
**Purpose**: Delete audit log entries older than a specified number of days
**Auth**: JWT + Admin required
**Body**: Validated with `trimSchema`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `days` | `number` | Yes | int, 1–3650 | Number of days to keep |

**Response** `200`:
```json
{
  "success": true,
  "message": "Deleted 1234 log entries older than 90 days",
  "deleted": 1234
}
```

**SQLite query**:
```sql
DELETE FROM admin_audit_log WHERE created_at < datetime('now', '-90 days')
```

---

### 5. DELETE `/admin/audit-log/bulk`
**Purpose**: Delete specific audit log entries by their IDs
**Auth**: JWT + Admin required
**Body**: Validated with `bulkDeleteSchema`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `ids` | `number[]` | Yes | 1–1000 positive ints | Entry IDs to delete |

**Response** `200`:
```json
{
  "success": true,
  "message": "Deleted 5 log entries",
  "deleted": 5
}
```

**SQLite query**:
```sql
DELETE FROM admin_audit_log WHERE id IN (1, 2, 3, 4, 5)
```

---

### 6. DELETE `/admin/audit-log/purge`
**Purpose**: Permanently delete ALL audit log entries
**Auth**: JWT + Admin required
**Query**: `?confirm=yes` (required)

**Without confirmation** `400`:
```json
{
  "success": false,
  "error": "Must pass ?confirm=yes to purge all audit log entries"
}
```

**With confirmation** `200`:
```json
{
  "success": true,
  "message": "Purged all 12345 log entries",
  "deleted": 12345
}
```

**SQLite operations**:
```sql
DELETE FROM admin_audit_log;
VACUUM;
```

⚠️ **Note**: `VACUUM` is called after purge to reclaim disk space (SQLite doesn't auto-shrink).

---

## Middleware Route (Write Path)

The `auditLogger` middleware is NOT a user-facing route, but it's the write path that populates the audit log.

### Applied to:

| Mount | Route Prefix |
|-------|-------------|
| `apiRouter.use('/admin', auditLogger, adminRouter)` | `/admin/*` (main admin routes) |
| `apiRouter.use('/admin/config', auditLogger, adminConfigRouter)` | `/admin/config/*` |
| `apiRouter.use('/admin/dashboard', auditLogger, adminDashboardRouter)` | `/admin/dashboard/*` |
| `apiRouter.use('/admin/packages', auditLogger, adminPackagesRouter)` | `/admin/packages/*` |
| `apiRouter.use('/admin/ai-overview', auditLogger, adminAIOverviewRouter)` | `/admin/ai-overview/*` |
| `apiRouter.use('/admin/clients', auditLogger, adminClientManagerRouter)` | `/admin/clients/*` |
| `apiRouter.use('/admin/enterprise-endpoints', auditLogger, ...)` | `/admin/enterprise-endpoints/*` |
| `apiRouter.use('/admin/client-api-configs', auditLogger, ...)` | `/admin/client-api-configs/*` |
| `apiRouter.use('/admin/cases', auditLogger, adminCasesRouter)` | `/admin/cases/*` |
| `apiRouter.use('/admin/sites', auditLogger, adminSitesRouter)` | `/admin/sites/*` |

### Skipped (SKIP_PATTERNS):

| Pattern | Reason |
|---------|--------|
| `GET /api/admin/audit-log*` | Prevents recursive logging when viewing the log |

### NOT applied to:

| Mount | Reason |
|-------|--------|
| `apiRouter.use('/admin/audit-log', adminAuditLogRouter)` | Mounted without auditLogger to avoid self-logging |
