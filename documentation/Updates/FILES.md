# Updates & Error Reporting Module — File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-06-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total source files** | 13 |
| **Total LOC** | ~3,100 |
| **Backend route files** | 8 (~1,846 LOC) |
| **Backend type files** | 1 (119 LOC) |
| **Frontend page files** | 2 (1,139 LOC) |
| **Frontend type files** | 1 (~100 LOC) |

### Directory Tree

```
Backend:
  src/routes/updHeartbeat.ts                (319 LOC)  ⭐ client heartbeat + lightweight update check
  src/routes/updErrorReport.ts              (284 LOC)  ⭐ error ingestion (public) + error browsing (admin)
  src/routes/updClients.ts                  (~130 LOC)  admin client management (list, actions, delete)
  src/routes/updSoftware.ts                 (~200 LOC)  software product CRUD
  src/routes/updUpdates.ts                  (161 LOC)  release package CRUD
  src/routes/updFiles.ts                    (197 LOC)  ⭐ multipart upload + streamed download
  src/routes/updModules.ts                  (228 LOC)  module CRUD + developer assignment
  src/routes/updMisc.ts                     (327 LOC)  info, dashboard, status, installed, schema, password reset
  src/db/updatesTypes.ts                    (119 LOC)  TypeScript interfaces + computeClientStatus()

Frontend:
  src/pages/general/ClientMonitor.tsx       (558 LOC)  ⭐ live heartbeat monitoring dashboard
  src/pages/general/ErrorReports.tsx        (581 LOC)  ⭐ error log + client summaries
  src/types/updates.ts                      (~100 LOC)  frontend TypeScript types

Related files (not part of this module, but used by it):
  src/services/api.ts                       (~75 LOC)  Axios client with JWT interceptor
  src/components/Layout/Layout.tsx          (—)  sidebar entries for Client Monitor + Error Reports
  src/App.tsx                               (—)  route definitions for /client-monitor + /error-reports
```

---

## 2. Backend Files

### 2.1 `src/routes/updHeartbeat.ts` — Heartbeat Router

| Property | Value |
|----------|-------|
| **LOC** | 319 |
| **Mount** | `/updates/heartbeat` |
| **Endpoints** | 2 (POST `/`, GET `/check`) |
| **Auth** | `software_key` (public — no middleware) |
| **Dependencies** | `zod`, `db`, `updatesTypes` |

**Responsibilities:**
- Full heartbeat: receive client telemetry, create/update client record, check for updates, deliver commands
- Lightweight update check: version comparison without registration
- Piggy-backed error storage: accepts `recent_errors[]` and stores via `storeRecentErrors()` helper
- Command delivery: `force_logout` and `server_message` cleared after delivery
- Blocked client rejection: returns 403 if client `is_blocked`

**Key internal functions:**
- `storeRecentErrors(softwareId, clientId, clientIdentifier, hostname, errors)` — loops over errors, INSERTs into `error_reports`, then UPSERTS `client_error_summaries`

---

### 2.2 `src/routes/updErrorReport.ts` — Error Report Router

| Property | Value |
|----------|-------|
| **LOC** | 284 |
| **Mount** | `/updates/error-report` |
| **Endpoints** | 3 (POST `/`, GET `/`, GET `/summaries`) |
| **Auth** | `software_key` (POST), JWT (GET endpoints) |
| **Dependencies** | `zod`, `db`, `requireAuth`, `requireAdmin` |

**Responsibilities:**
- Error ingestion: validate and normalize error payloads, store to `error_reports`, upsert `client_error_summaries`
- Error browsing (admin): paginated list with filters (software_key, client_identifier, level, source, hostname LIKE)
- Client summaries (admin): aggregated per-client error statistics

**Key internal functions:**
- `normalizeError(err)` — accepts dual field names (`type`/`error_type`, `level`/`error_level`, `message`/`error_message`), returns normalized object
- `errorSchema` — Zod schema with `.transform()` for field normalization

---

### 2.3 `src/routes/updClients.ts` — Clients Router

| Property | Value |
|----------|-------|
| **LOC** | ~130 |
| **Mount** | `/updates/clients` |
| **Endpoints** | 3 (GET `/`, PUT `/`, DELETE `/`) |
| **Auth** | JWT (`requireAuth`, `requireAdmin`) — all endpoints |
| **Dependencies** | `zod`, `db`, `updatesTypes.computeClientStatus` |

**Responsibilities:**
- List clients with JOINs to `update_software` and `update_releases`
- Compute `seconds_since_heartbeat` and derive `status` via `computeClientStatus()`
- Client actions: block (with reason), unblock, force_logout, send_message
- Delete client records

---

### 2.4 `src/routes/updSoftware.ts` — Software Router

| Property | Value |
|----------|-------|
| **LOC** | ~200 |
| **Mount** | `/updates/software` (also `/softaware/software`) |
| **Endpoints** | 4 (GET, POST, PUT, DELETE) |
| **Auth** | GET public; POST/PUT/DELETE admin |
| **Dependencies** | `zod`, `db`, `requireAuth`, `requireAdmin` |

**Responsibilities:**
- CRUD for software products
- GET includes computed `latest_version` (MAX from releases) and `total_updates` (COUNT)
- Supports external integration fields: `username`, `password`, `live_url`, `test_url`, `mode`

---

### 2.5 `src/routes/updUpdates.ts` — Updates Router

| Property | Value |
|----------|-------|
| **LOC** | 161 |
| **Mount** | `/updates/updates` |
| **Endpoints** | 4 (GET, POST, PUT, DELETE) |
| **Auth** | GET public; POST/PUT/DELETE admin |
| **Dependencies** | `zod`, `db`, `fs`, `path`, `requireAuth`, `requireAdmin` |

**Responsibilities:**
- CRUD for release packages
- GET includes `software_name` and `uploaded_by_name` via JOINs
- DELETE also removes associated file from disk

---

### 2.6 `src/routes/updFiles.ts` — Files Router

| Property | Value |
|----------|-------|
| **LOC** | 197 |
| **Mount** | `/updates` (handles `/upload` and `/download`) |
| **Endpoints** | 2 (POST `/upload`, GET `/download`) |
| **Auth** | API key or JWT (upload); software_key (download) |
| **Dependencies** | `zod`, `multer`, `crypto`, `fs`, `path`, `db` |

**Responsibilities:**
- Multipart file upload (multer, 500 MB limit)
- Dual auth for upload: `X-API-Key` header or JWT Bearer
- File renamed to `{version}_{timestamp}_{original}` after validation
- SHA-256 checksum computation
- Replace-mode: if `update_id` provided, deletes old file and updates existing release
- Streamed file download with `Content-Disposition: attachment`
- Download validated against `software_key`

**Upload directory:** `{cwd}/uploads/updates/`

---

### 2.7 `src/routes/updModules.ts` — Modules Router

| Property | Value |
|----------|-------|
| **LOC** | 228 |
| **Mount** | `/updates/modules` (also `/softaware/modules`) |
| **Endpoints** | 7 (GET/POST/PUT/DELETE modules + GET/POST/DELETE developers) |
| **Auth** | GET requires `requireAuth`; mutations require `requireAdmin` |
| **Dependencies** | `zod`, `db`, `requireAuth`, `requireAdmin` |

**Responsibilities:**
- Module CRUD with duplicate name validation per software
- Developer assignment management (many-to-many via `update_user_modules`)
- Developer list includes `name` and `email` from `users` table

---

### 2.8 `src/routes/updMisc.ts` — Misc Router

| Property | Value |
|----------|-------|
| **LOC** | 327 |
| **Mount** | `/updates` (handles `/info`, `/dashboard`, `/api_status`, `/installed`, `/schema`, password reset routes) |
| **Endpoints** | 10 |
| **Auth** | Mixed (see ROUTES.md §9) |
| **Dependencies** | `zod`, `crypto`, `fs`, `path`, `bcryptjs`, `nodemailer` (dynamic import), `db` |

**Responsibilities:**
- API info endpoint with full endpoint catalog
- Admin dashboard summary (software count, update count, user count, active clients 24h, latest activity)
- System health check (DB ping, table counts)
- Installed updates list
- Schema file retrieval
- Password reset flow (request → verify OTP → reset) with SMTP email delivery
- OTP: 6-digit, 15-minute expiry, bcrypt-hashed password storage

---

### 2.9 `src/db/updatesTypes.ts` — Backend TypeScript Types

| Property | Value |
|----------|-------|
| **LOC** | 119 |
| **Exports** | 8 interfaces + 1 type + 1 function |

**Exported interfaces:** `UpdSoftware`, `UpdUpdate`, `UpdClient`, `UpdModule`, `UpdUserModule`, `UpdInstalledUpdate`, `UpdPasswordResetToken`  
**Exported type:** `ClientStatus = 'online' | 'recent' | 'inactive' | 'offline'`  
**Exported function:** `computeClientStatus(seconds: number): ClientStatus`

---

## 3. Frontend Files

### 3.1 `src/pages/general/ClientMonitor.tsx` — Client Monitor Page

| Property | Value |
|----------|-------|
| **LOC** | 558 |
| **Route** | `/client-monitor` |
| **Guard** | `AdminRoute` |
| **Sidebar** | "Client Monitor" — `SignalIcon`, adminOnly |

**Embedded components:**
- `SummaryCard` — clickable status filter card (total, online, recent, inactive, offline, blocked)
- `ClientDetailDrawer` — slide-in panel with client info grid and admin action buttons

**Key features:**
- Auto-refresh every 15 seconds (toggleable)
- Search by hostname, IP, current user, or app version
- Filter by software product (dropdown)
- Filter by status (via summary card clicks)
- 6 admin actions: block (with reason prompt), unblock, force_logout, send_message (with text prompt), delete (SweetAlert confirmation), view_errors
- "View Error Reports" navigates to `/error-reports?hostname={hostname}`
- Status computed client-side via `STATUS_CONFIG` mapping

**Status styling:**

| Status | Color | Icon |
|--------|-------|------|
| online | green | ● |
| recent | yellow | ● |
| inactive | orange | ● |
| offline | red | ● |

---

### 3.2 `src/pages/general/ErrorReports.tsx` — Error Reports Page

| Property | Value |
|----------|-------|
| **LOC** | 581 |
| **Route** | `/error-reports` |
| **Guard** | `AdminRoute` |
| **Sidebar** | "Error Reports" — `BugAntIcon`, adminOnly |

**Embedded components:**
- `ErrorDetailModal` — full error detail display with metadata grid, file location, request info, message (red bg), stack trace (dark bg)
- `LoadingSpinner` — loading state indicator
- `EmptyState` — empty state with icon
- `KpiCard` — summary statistic card
- `CountBadge` — inline count badge

**Key features:**
- Two tabs: **Error Log** and **Client Summaries**
- Error Log: paginated table (50 per page), filters for level, source, hostname
- Client Summaries: KPI cards (total errors, warnings, notices, affected clients) + aggregated summary table
- Auto-refresh every 30 seconds (toggleable)
- Click error row → `ErrorDetailModal`
- Click hostname → navigate to `/client-monitor?search={hostname}`

**Error level styling:**

| Level | Color | Label |
|-------|-------|-------|
| error | red | Error |
| warning | yellow | Warning |
| notice | blue | Notice |

---

### 3.3 `src/types/updates.ts` — Frontend TypeScript Types

| Property | Value |
|----------|-------|
| **LOC** | ~100 |
| **Exports** | 6 types/interfaces |

**Exported types:**
- `ClientStatus` — `'online' | 'recent' | 'inactive' | 'offline'`
- `UpdateClient` — 36 fields including computed `status`, `seconds_since_heartbeat`, `software_name`
- `ErrorReport` — error record with all metadata fields
- `ClientErrorSummary` — aggregated per-client error counts
- `UpdatesDashboard` — dashboard summary shape
- `ClientAction` — `'block' | 'unblock' | 'force_logout' | 'send_message' | 'delete' | 'view_errors'`
- `ClientActionPayload` — `{ id, action, reason?, message? }`
