# Admin Audit Log — File Inventory

## Backend Files

### `/var/opt/backend/src/middleware/auditLogger.ts` (121 LOC)
**Purpose**: Express middleware that intercepts admin-route responses to log every action to SQLite
**Used by**: Mounted via `app.ts` on all `/admin/*` sub-routers (except `/admin/audit-log`)

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–16 | Express types, AuthRequest, auditLog, db (MySQL) |
| `userInfoCache` | 18–19 | `Map<string, { email, name, expires }>` — 5-min TTL user info cache |
| `getUserInfo()` | 21–37 | Async MySQL lookup for user email + name, with cache layer |
| `SKIP_PATTERNS` | 39–42 | RegExp array of routes to skip logging (audit-log views) |
| `sanitizeBody()` | 44–57 | Strips large string fields (>2000 chars) from request body before logging |
| `auditLogger()` | 59–121 | Main middleware: wraps `res.end()` + `res.json()` to capture status + duration, then calls `auditLog.log()` async |

---

### `/var/opt/backend/src/db/auditLog.ts` (421 LOC)
**Purpose**: SQLite database layer — table creation, CRUD, query, stats, trim/purge, sensitive-field stripping, resource-type derivation
**Used by**: `auditLogger.ts` middleware (write) + `adminAuditLog.ts` route handlers (read/manage)

| Section | Lines | Description |
|---------|-------|-------------|
| Module docstring | 1–15 | Usage examples, DB path documentation |
| Imports | 17–19 | `better-sqlite3`, `path`, `fs` |
| `AuditLogEntry` interface | 23–37 | Full entry type with all 14 fields |
| `AuditLogInsert` interface | 39–52 | Insert input (most fields optional) |
| `AuditLogQueryParams` interface | 54–65 | Query filter parameters |
| `AuditLogQueryResult` interface | 67–73 | Paginated result with total/page metadata |
| `AuditLogStats` interface | 75–87 | Statistics shape (counts, top users/resources, DB size) |
| `DB_DIR` / `DB_PATH` constants | 91–92 | `/var/opt/backend/data/audit_log.db` |
| `getDb()` | 96–126 | Lazy singleton — creates DB dir, opens SQLite with WAL + busy_timeout, creates table + 4 indexes |
| `SENSITIVE_KEYS` | 130–143 | Set of field names to redact (password, token, api_key, etc.) |
| `stripSensitive()` | 145–157 | Recursively walks object and replaces sensitive values with `[REDACTED]` |
| `deriveResourceType()` | 161–195 | Maps URL paths to categories via regex (clients, credits, settings, etc.) |
| `buildDescription()` | 199–209 | Generates "Viewed /admin/clients" style description from method + path |
| `auditLog.log()` | 215–250 | Fire-and-forget INSERT with resource-type derivation + sensitive stripping |
| `auditLog.query()` | 255–314 | Paginated SELECT with dynamic WHERE clauses from filters |
| `auditLog.stats()` | 319–368 | Multiple COUNT/MIN/MAX/GROUP BY queries + fs.statSync for DB size |
| `auditLog.trim()` | 373–378 | DELETE WHERE created_at < datetime('now', '-N days') |
| `auditLog.deleteByIds()` | 383–389 | DELETE WHERE id IN (...) |
| `auditLog.purgeAll()` | 394–399 | DELETE FROM + VACUUM |
| `auditLog.resourceTypes()` | 404–409 | SELECT DISTINCT resource_type |
| `auditLog.users()` | 414–419 | SELECT DISTINCT user_id, user_email, user_name |

---

### `/var/opt/backend/src/routes/adminAuditLog.ts` (151 LOC)
**Purpose**: Express route handlers for viewing and managing the audit log
**Mount**: `/admin/audit-log` via `adminAuditLogRouter` (no auditLogger middleware — avoids self-logging)

| Section | Lines | Description |
|---------|-------|-------------|
| Module docstring | 1–13 | Lists all 6 endpoints |
| Imports | 15–20 | Express Router, Zod, auth/admin middleware, auditLog |
| Auth middleware | 23 | `requireAuth + requireAdmin` applied to all routes |
| `GET /` | 27–50 | Paginated log list with 10 filter params from query string |
| `GET /stats` | 55–62 | Dashboard statistics |
| `GET /filters` | 66–80 | Available filter values (resource types + users from DB, actions hard-coded) |
| `trimSchema` | 84–86 | Zod: `{ days: z.number().int().min(1).max(3650) }` |
| `POST /trim` | 91–103 | Trim entries older than N days |
| `bulkDeleteSchema` | 107–109 | Zod: `{ ids: z.array(z.number().int().positive()).min(1).max(1000) }` |
| `DELETE /bulk` | 112–124 | Delete specific entries by ID |
| `DELETE /purge` | 129–149 | Purge ALL entries (requires `?confirm=yes`) |

---

### `/var/opt/backend/src/app.ts` (relevant lines)
**Purpose**: Mount point for auditLogger middleware and adminAuditLogRouter

| Line | Code | Description |
|------|------|-------------|
| 93 | `import { adminAuditLogRouter }` | Import router |
| 104 | `import { auditLogger }` | Import middleware |
| 175 | `apiRouter.use('/admin', auditLogger, adminRouter)` | Attach auditLogger to main admin router |
| 176 | `apiRouter.use('/admin/audit-log', adminAuditLogRouter)` | Mount audit-log viewer (NO auditLogger) |
| 177–189 | `apiRouter.use('/admin/config', auditLogger, ...)` etc. | Attach auditLogger to other admin sub-routers |

**Key design**: The `adminAuditLogRouter` is mounted **without** `auditLogger` middleware to prevent recursive logging when admins view the audit log.

---

## Frontend Files

### `/var/opt/frontend/src/models/AdminAuditLogModel.ts` (126 LOC)
**Purpose**: Static API wrapper for all audit log endpoints (1 class, 6 methods)

| Class | Method | HTTP | Endpoint | Notes |
|-------|--------|------|----------|-------|
| `AdminAuditLogModel` | `getAll(params)` | GET | `/admin/audit-log` | Paginated + filtered |
| | `getStats()` | GET | `/admin/audit-log/stats` | Dashboard statistics |
| | `getFilters()` | GET | `/admin/audit-log/filters` | Filter dropdown values |
| | `trim(days)` | POST | `/admin/audit-log/trim` | Delete old entries |
| | `bulkDelete(ids)` | DELETE | `/admin/audit-log/bulk` | Delete by ID array |
| | `purge()` | DELETE | `/admin/audit-log/purge?confirm=yes` | Delete ALL |

**Exported types**: `AuditLogEntry`, `AuditLogStats`, `AuditLogFilters`, `AuditLogQueryParams`, `AuditLogQueryResult`

---

### `/var/opt/frontend/src/pages/admin/AuditLog.tsx` (782 LOC)
**Purpose**: Full audit log admin page — two-tab layout with log entries and statistics

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–24 | React, Heroicons (20 icons), models, UI components, SweetAlert2 |
| `relativeDate()` | 30–38 | Formats timestamp as "Just now", "5m ago", "3d ago", or date |
| `formatDate()` | 40–42 | Formats UTC timestamp to locale string |
| `METHOD_COLORS` | 44–50 | Tailwind color map for GET/POST/PUT/PATCH/DELETE badges |
| `statusColor()` | 52–58 | Returns Tailwind text color based on HTTP status range |
| `StatCard` component | 62–77 | Reusable stat card with icon, label, value, optional subtitle |
| `DetailModal` component | 81–168 | Modal showing full entry detail (user, timestamp, method, status, resource, category, duration, IP, description, request body, user agent) |
| `AuditLog` component | 172–782 | Main page component |
| — State declarations | 173–190 | entries, loading, stats, filters, total, page, selectedEntry, selectedIds, showFilters, activeTab, filter values |
| — `loadEntries()` | 194–214 | Calls `AdminAuditLogModel.getAll()` with all filter params |
| — `loadStats()` | 216–222 | Calls `AdminAuditLogModel.getStats()` |
| — `loadFilters()` | 224–230 | Calls `AdminAuditLogModel.getFilters()` |
| — `handleTrim()` | 238–262 | SweetAlert input → `AdminAuditLogModel.trim(days)` |
| — `handleBulkDelete()` | 264–284 | SweetAlert confirm → `AdminAuditLogModel.bulkDelete(ids)` |
| — `handlePurge()` | 286–312 | SweetAlert "type PURGE" → `AdminAuditLogModel.purge()` |
| — `clearFilters()` | 314–322 | Resets all filter state |
| — `toggleSelect/All` | 324–333 | Checkbox selection management |
| — Stats tab | 430–520 | 6 stat cards, top users/resources tables, log range, maintenance buttons |
| — Log tab | 522–755 | Search bar, filter panel (method/category/user/errors/dates), results table, pagination |
| — Detail modal | 758 | `<DetailModal>` |

---

### `/var/opt/frontend/src/App.tsx` (relevant line)

| Line | Code | Description |
|------|------|-------------|
| 57 | `import AuditLog from './pages/admin/AuditLog'` | Import component |
| 195 | `<Route path="/admin/audit-log" element={<AdminRoute><Layout><AuditLog /></Layout></AdminRoute>} />` | Admin-only route with Layout wrapper |

---

### `/var/opt/frontend/src/components/Layout/Layout.tsx` (relevant line)

| Line | Code | Description |
|------|------|-------------|
| 163 | `{ name: 'Audit Log', href: '/admin/audit-log', icon: ClipboardDocumentListIcon, adminOnly: true }` | Sidebar navigation entry (admin section) |
