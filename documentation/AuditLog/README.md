# Admin Audit Log Module

## Overview
The Admin Audit Log module provides a complete audit trail of all administrative actions performed in the application. Every admin API request (except read-only audit-log views) is automatically captured by Express middleware and stored in a dedicated **SQLite** database — deliberately separate from the main MySQL database to avoid loading it with high-volume log data. Admins can browse, search, filter, and manage the log from a dedicated admin page.

**Current Data**: SQLite database at `/var/opt/backend/data/audit_log.db`
**Last Updated**: March 2026

## Key Responsibilities
- **Automatic capture**: Express middleware intercepts all admin-route responses and logs who did what, when, from where, and how long it took
- **Paginated log viewer**: Sortable table with search, multi-filter (method, category, user, date range, errors-only), and detail modal
- **Statistics dashboard**: Total entries, today/week/month counts, error count, DB file size, top users, top resource categories, date range
- **Log maintenance**: Trim by age (delete entries older than N days), bulk delete selected entries, purge all (with PURGE confirmation)
- **Sensitive-field stripping**: Passwords, tokens, API keys, and other secrets are automatically redacted before storage
- **Resource-type derivation**: Route paths are auto-classified into categories (clients, credits, settings, etc.) for filtering
- **Human-readable descriptions**: Auto-generated from HTTP method + resource path (e.g., "Updated /admin/clients/5/status")
- **User enrichment**: User email and name are resolved from MySQL `users` table and cached (5-min TTL)

## Architecture

### How It Works (End-to-End)

```
1. Admin makes API request (e.g., PUT /api/admin/clients/5/status)
2. Express routing: apiRouter → auditLogger middleware → adminRouter → handler
3. auditLogger wraps res.end() to capture response status + duration after handler finishes
4. On res.end(), auditLogger:
   a. Resolves user info (email, name) from MySQL users table (cached 5 min)
   b. Strips sensitive fields from request body
   c. Derives resource_type from URL path
   d. Calls auditLog.log() fire-and-forget into SQLite
5. Admin views log at /admin/audit-log → frontend calls GET /admin/audit-log
6. Backend reads from SQLite with pagination + filters → returns JSON
```

### Backend
- **Middleware**: `src/middleware/auditLogger.ts` (121 LOC) — Express middleware that intercepts `res.end()` to log after response, with user info caching and skip patterns
- **Database Layer**: `src/db/auditLog.ts` (421 LOC) — SQLite via `better-sqlite3`, table creation, CRUD, query with filters, stats, trim/purge, sensitive-field stripping, resource-type derivation
- **Router**: `src/routes/adminAuditLog.ts` (151 LOC) — 6 route handlers mounted at `/admin/audit-log`, all admin-only
- **Mount**: `src/app.ts` — `auditLogger` middleware applied to all `/admin/*` sub-routers; `adminAuditLogRouter` mounted at `/admin/audit-log` (without auditLogger — to avoid logging audit-log views)

### Frontend
- **Page**: `src/pages/admin/AuditLog.tsx` (782 LOC) — Two-tab layout (Log Entries + Statistics), filter panel, table with pagination, detail modal, maintenance actions
- **Model**: `src/models/AdminAuditLogModel.ts` (126 LOC) — Static API wrapper (1 class, 6 methods)
- **Route**: `src/App.tsx` — `<Route path="/admin/audit-log" element={<AdminRoute><Layout><AuditLog /></Layout></AdminRoute>} />`
- **Sidebar**: `src/components/Layout/Layout.tsx` — "Audit Log" link in admin section with `ClipboardDocumentListIcon`, `adminOnly: true`
- **State**: Local component state (useState/useCallback) — no Zustand store needed
- **Styling**: Tailwind CSS with indigo accent

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `better-sqlite3` | SQLite database driver (synchronous API, WAL mode) |
| `zod` | Request validation (trim days, bulk delete IDs) |
| `mysql2/promise` | User info lookup for audit entries (email/name from `users` table) |
| `requireAuth` middleware | JWT authentication |
| `requireAdmin` middleware | Admin-only route protection |
| `SweetAlert2` | User confirmations (trim, bulk delete, purge) and feedback toasts |
| `Heroicons` | Icons for methods, stats, actions |
| `axios` (via `api`) | Frontend HTTP client |

## Database

| Database | Engine | File Path | Purpose |
|----------|--------|-----------|---------|
| `audit_log.db` | **SQLite** (WAL mode) | `/var/opt/backend/data/audit_log.db` | All audit log entries |
| Main MySQL | MySQL | — | `users` table for email/name resolution |

**Why SQLite?** Audit logs are high-volume, append-heavy, and read-independently from transactional data. SQLite avoids loading the main MySQL database and provides self-contained file-based storage that's easy to back up, trim, or purge.

## Key Data Flows

### Automatic Logging (Write Path)
```
Admin request hits Express
  → apiRouter.use('/admin/clients', auditLogger, adminClientManagerRouter)
  → auditLogger wraps res.end() with timing + capture hooks
  → Handler executes → res.json({ ... }) → res.end()
  → auditLogger.res.end() fires:
      1. Duration = Date.now() - startTime
      2. getUserInfo(userId) → MySQL lookup (cached 5 min)
      3. sanitizeBody(req.body) → truncate large fields
      4. auditLog.log({ user_id, user_email, user_name, action, resource, ... })
         → deriveResourceType(resource) → e.g., "clients"
         → buildDescription(method, resource) → e.g., "Updated /admin/clients/5/status"
         → stripSensitive(body) → redact passwords/tokens
         → INSERT INTO admin_audit_log (synchronous SQLite)
```

### Viewing the Log (Read Path)
```
Frontend loads /admin/audit-log
  → useEffect → AdminAuditLogModel.getAll({ page, limit, filters })
  → GET /api/admin/audit-log?page=1&limit=50&search=...
  → requireAuth + requireAdmin middleware
  → auditLog.query(params) → SQLite SELECT with WHERE clauses + pagination
  → Response: { success, data: AuditLogEntry[], total, page, limit, totalPages }
```

### Statistics
```
Stats tab → AdminAuditLogModel.getStats()
  → GET /api/admin/audit-log/stats
  → auditLog.stats() → Multiple SQLite COUNT/MIN/MAX/GROUP BY queries
  → Also reads fs.statSync(DB_PATH) for file size
  → Response: { total_entries, entries_today, ..., top_users, top_resources, db_size_mb }
```

### Filter Population
```
Page load → AdminAuditLogModel.getFilters()
  → GET /api/admin/audit-log/filters
  → auditLog.resourceTypes() → SELECT DISTINCT resource_type
  → auditLog.users() → SELECT DISTINCT user_id, user_email, user_name
  → Hard-coded actions: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
```

### Trim by Age
```
Stats tab → "Trim by Age" button → SweetAlert input (days)
  → AdminAuditLogModel.trim(90)
  → POST /api/admin/audit-log/trim { days: 90 }
  → trimSchema.parse(body) → Zod validates 1–3650
  → auditLog.trim(90) → DELETE WHERE created_at < datetime('now', '-90 days')
  → Response: { deleted: 1234, message: "Deleted 1234 log entries older than 90 days" }
```

### Bulk Delete
```
Log tab → Select checkboxes → "Delete (N)" button → SweetAlert confirm
  → AdminAuditLogModel.bulkDelete([1, 2, 3])
  → DELETE /api/admin/audit-log/bulk { ids: [1, 2, 3] }
  → bulkDeleteSchema.parse(body) → Zod validates array of 1–1000 positive ints
  → auditLog.deleteByIds([1, 2, 3]) → DELETE WHERE id IN (1, 2, 3)
```

### Purge All
```
Stats tab → "Purge All" button → SweetAlert input (type "PURGE")
  → AdminAuditLogModel.purge()
  → DELETE /api/admin/audit-log/purge?confirm=yes
  → Validates ?confirm=yes query param
  → auditLog.purgeAll() → DELETE FROM admin_audit_log + VACUUM
```

### Skip Pattern
```
GET /api/admin/audit-log/* requests → auditLogger checks SKIP_PATTERNS
  → /^GET \/api\/admin\/audit-log/ matches → next() without logging
  → Prevents infinite recursion / noise from viewing the log itself
```
