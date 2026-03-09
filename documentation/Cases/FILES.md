# Cases — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/cases.ts` (528 LOC)
**Purpose**: User-facing case CRUD, comments, and ratings  
**Mount**: `/cases` via `casesRouter`

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–16 | Express, Zod, db, auth, caseAnalyzer, notificationService |
| `safeJson()` helper | 18–23 | Safely parse MySQL JSON columns (handles objects and strings) |
| `mapCaseRow()` helper | 25–56 | Maps raw DB row to frontend shape (category, source, ratings, JSON fields) |
| `CreateCaseSchema` | 58–77 | Zod: title, description, category, severity, source, url, page_path, error fields, browser_info, metadata, tags |
| `UpdateCaseSchema` | 79–87 | Zod: title, description, severity, status, assigned_to, resolution, tags |
| `AddCommentSchema` | 89–93 | Zod: comment, is_internal, attachments |
| `RateCaseSchema` | 95–98 | Zod: rating (1–5), rating_comment |
| `POST /` | 100–183 | Create case with AI analysis, activity log, admin notifications |
| `GET /` | 185–222 | List user's own cases with optional status filter |
| `GET /:id` | 224–290 | Get case detail with comments, activity; access check |
| `PATCH /:id` | 292–394 | Update case with activity logging, status notifications, assignee notifications |
| `POST /:id/comments` | 396–476 | Add comment with activity log, reporter/assignee notifications |
| `POST /:id/rate` | 478–528 | Rate resolved case (reporter only) |

---

### `/var/opt/backend/src/routes/adminCases.ts` (432 LOC)
**Purpose**: Admin case management — list, analytics, bulk ops, health, delete  
**Mount**: `/admin/cases` via `adminCasesRouter`

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–14 | Express, Zod, db, auth, requireAdmin, healthMonitor, notificationService |
| `safeJson()` helper | 16–21 | Duplicate of cases.ts safeJson |
| `mapCaseRow()` helper | 23–51 | Duplicate of cases.ts mapCaseRow (without AI override param) |
| Middleware | 52 | `requireAuth` + `requireAdmin` applied to all routes |
| `GET /` | 54–109 | List all cases with filters (status, severity, type, assigned_to, search) + stats |
| `GET /analytics` | 111–169 | Analytics dashboard — totalCases, openCases, resolvedCases, avgResolutionTime, breakdowns |
| `POST /bulk-assign` | 171–210 | Bulk assign cases to a user with notifications |
| `POST /bulk-update-status` | 212–258 | Bulk update case status with resolved_at/resolved_by and notifications |
| `GET /health` | 260–270 | System health status via healthMonitor |
| `POST /health/run-checks` | 272–282 | Trigger manual health checks (fire-and-forget) |
| `GET /team-performance` | 284–316 | Team metrics — assigned count, resolved count, avg resolution hours, avg rating |
| `POST /bulk-delete` | 318–349 | Bulk delete cases with cascading comment/activity cleanup |
| `DELETE /:id` | 351–432 | Single case delete with cascading cleanup and notifications |

---

### `/var/opt/backend/src/services/caseAnalyzer.ts`
**Purpose**: AI-powered component analysis from page context (URL, path, component name, description)  
**Used by**: `POST /cases` for automatic component identification

---

### `/var/opt/backend/src/services/healthMonitor.ts` (~614 LOC)
**Purpose**: Comprehensive system health monitoring with 10 automated checks, in-memory failure tracking, auto-case creation, and auto-resolve  
**Used by**: `GET /admin/cases/health`, `POST /admin/cases/health/run-checks`, `apiErrorTracker.ts`  
**Key exports**: `startHealthMonitoring()`, `getHealthStatus()`, `runHealthChecks()`, `trackApiError()`

| Section | Description |
|---------|-------------|
| In-memory state | `apiErrors[]`, `failureCounts Map`, `deferredCaseQueue[]` — survive DB outages |
| `trackApiError(route, method, status)` | Called by `apiErrorTracker` middleware for 5xx responses |
| `checkDatabase()` | MySQL connection test via `SELECT 1` |
| `checkApiErrors()` | Counts 5xx errors in last 5 minutes from in-memory buffer |
| `checkProcess()` | Validates backend process is running via PID file |
| `checkMemory()` | Heap + system RAM usage; error only when heap > 500MB AND 95%+, or system RAM > 95% |
| `checkDisk()` | Disk usage via `df -h /`; error at > 95%, warning at > 85% |
| `checkAuthentication()` | Internal API call to `/api/auth/health` |
| `checkWorker()` | Validates ingestion worker process is alive |
| `checkOllama()` | Ollama service health check via HTTP |
| `checkIngestionQueue()` | Counts pending ingestion items in DB |
| `checkEnterprise()` | Validates enterprise-related endpoints |
| `updateCheckInDB()` | Persists check results; auto-creates cases after 3 consecutive errors or 5 warnings |
| `autoResolveCase()` | Closes linked case when check returns to healthy |
| `processDeferredQueue()` | Flushes deferred case queue when DB is available |

---

### `/var/opt/backend/src/middleware/apiErrorTracker.ts` (~30 LOC)
**Purpose**: Express middleware that intercepts HTTP responses and feeds 5xx errors to the health monitor  
**Used by**: `app.ts` (mounted before all routes)

**How it works**:
1. Hooks `res.end()` via monkey-patch
2. After response completes, checks `res.statusCode >= 500`
3. Calls `trackApiError(req.path, req.method, res.statusCode)` for 5xx responses
4. Health monitor aggregates these in an in-memory buffer for the `api_errors` check

---

## Frontend Files

### `/var/opt/frontend/src/models/CaseModel.ts` (126 LOC)
**Purpose**: Static API wrapper for all case endpoints (18 methods)

| Method | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `create(data)` | POST | `/cases` | |
| `getMyCases(params?)` | GET | `/cases` | |
| `getById(id)` | GET | `/cases/:id` | |
| `update(id, data)` | PATCH | `/cases/:id` | |
| `addComment(id, comment, isInternal?)` | POST | `/cases/:id/comments` | Sends as FormData for file attachments |
| `rate(id, rating, feedback?)` | POST | `/cases/:id/rate` | |
| `adminGetAll(params?)` | GET | `/admin/cases` | |
| `getAnalytics()` | GET | `/admin/cases/analytics` | |
| `bulkAssign(caseIds, assignedTo)` | POST | `/admin/cases/bulk-assign` | |
| `bulkUpdateStatus(caseIds, status, resolution?)` | POST | `/admin/cases/bulk-update-status` | |
| `getHealthStatus()` | GET | `/admin/cases/health` | **Returns `res.data.health`** (extracts nested health object) |
| `runHealthChecks()` | POST | `/admin/cases/health/run-checks` | **Returns `void`** (fire-and-forget; caller re-fetches status) |
| `getTeamPerformance()` | GET | `/admin/cases/team-performance` | |
| `adminDelete(id)` | DELETE | `/admin/cases/:id` | |
| `bulkDelete(caseIds)` | POST | `/admin/cases/bulk-delete` | |

---

### `/var/opt/frontend/src/types/cases.ts` (~140 LOC)
**Purpose**: TypeScript interfaces and type unions for the case system

| Export | Type | Description |
|--------|------|-------------|
| `CaseSeverity` | Union | `'low' \| 'medium' \| 'high' \| 'critical'` |
| `CaseStatus` | Union | `'open' \| 'in_progress' \| 'waiting' \| 'resolved' \| 'closed'` ⚠️ **Missing `'wont_fix'`** |
| `CaseSource` | Union | `'user_report' \| 'auto_detected' \| 'health_monitor' \| 'ai_analysis'` |
| `CaseCategory` | Union | `'bug' \| 'performance' \| 'ui_issue' \| 'data_issue' \| 'security' \| 'feature_request' \| 'other'` |
| `Case` | Interface | Full case object (30+ fields) |
| `CaseComment` | Interface | Comment with user_name, is_internal flag |
| `CaseActivity` | Interface | Activity log entry with action, old/new values |
| `CaseCreateInput` | Interface | Case creation payload |
| `CaseUpdateInput` | Interface | Case update payload |
| `CaseAnalytics` | Interface | Dashboard analytics shape |
| `HealthCheck` | Interface | **NEW** — Individual health check result (check_type, check_name, status, details, consecutive_failures, case_id, last_checked) |
| `HealthStatus` | Interface | **REWRITTEN** — Comprehensive health status (overall_status, total_checks, healthy/warning/error/unknown counts, checks: HealthCheck[]) |

---

### `/var/opt/frontend/src/pages/general/CasesList.tsx` (301 LOC)
**Purpose**: Case list view with DataTable, filters, and delete actions

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–20 | React, router, icons, CaseModel, DataTable, Can, useAppStore, Swal |
| `STATUS_CONFIG` | 22–28 | Status label/color mapping |
| `SEVERITY_CONFIG` | 30–36 | Severity label/color/dot mapping |
| `CATEGORY_ICONS` | 38–46 | Category icon components |
| State declarations | 48–55 | cases, loading, pagination, search, filters |
| `handleDeleteCase()` | 57–72 | Single case delete with SweetAlert confirmation |
| `handleDeleteAll()` | 74–90 | Bulk delete all visible cases |
| Column definitions | 92–175 | 7 columns: case_number, title, severity, status, reporter, created, actions |
| `loadCases()` | 177–205 | Fetch cases via `CaseModel.getMyCases()` |
| Header JSX | 207–235 | Gradient header with "Delete All" (admin) + "Report New Issue" buttons |
| Filters JSX | 237–265 | Status/severity dropdowns |
| DataTable JSX | 267–280 | DataTable with `searchable={false}`, server-side pagination |

---

### `/var/opt/frontend/src/pages/general/CaseDetailView.tsx` (463 LOC)
**Purpose**: Full case detail view with comments, activity log, and rating

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–21 | React, router, icons, BackButton, CaseModel, types, store, Swal |
| Config objects | 22–48 | STATUS_CONFIG, SEVERITY_CONFIG, CATEGORY_ICONS |
| `timeAgo()` helper | 50–58 | Relative time formatting |
| State declarations | 60–75 | caseData, comments, activity, newComment, rating, feedback, activeTab |
| `loadCase()` | 77–95 | Fetch case detail via `CaseModel.getById()` |
| `handleAddComment()` | 97–118 | Post comment with SweetAlert feedback |
| `handleRate()` | 120–140 | Submit rating with SweetAlert feedback |
| Header JSX | 145–210 | Gradient header with BackButton, case number, title, severity/status badges, delete button (admin) |
| Case Info Banner | 212–235 | Reporter name/email, category, created date |
| Description section | 237–265 | Description, error message, page context, resolution |
| Tabs (Comments/Activity) | 267–365 | Tabbed UI with comment list, add comment form, activity timeline |
| Rating section | 367–430 | Star rating widget for resolved cases |
| Existing rating display | 432–460 | Read-only star display for already-rated cases |

---

### `/var/opt/frontend/src/pages/cases/CasesDashboard.tsx` (516 LOC)
**Purpose**: Admin analytics dashboard with KPIs, charts, and recent cases

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–20 | React, icons, CaseModel, types |
| State declarations | 22–30 | analytics, cases, loading |
| `loadAnalytics()` | 32–55 | Fetch analytics via `CaseModel.getAnalytics()` |
| `loadRecentCases()` | 57–70 | Fetch recent cases via `CaseModel.adminGetAll()` |
| KPI cards | 72–150 | Total Cases, Open Cases, Resolved Cases, Avg Resolution Time |
| Severity chart | 152–220 | Bar chart by severity |
| Category chart | 222–290 | Bar chart by category |
| Status chart | 292–360 | Bar chart by status |
| Trend chart | 362–430 | 14-day line chart |
| Recent cases table | 432–516 | Table of most recent cases |

---

### `/var/opt/frontend/src/pages/admin/AdminCaseManagement.tsx` (~1015 LOC)
**Purpose**: Admin case management page with case list, health dashboard, and case operations

| Section | Description |
|---------|-------------|
| `CHECK_TYPE_CONFIG` | Typed icon/label/color config for all 10 health check types (database, api_errors, process, memory, disk, authentication, worker, service, ingestion, enterprise) |
| `HEALTH_BADGE` | Status badge styles for healthy/warning/error/unknown |
| `formatDetailKey()` | Converts snake_case keys to human-readable labels |
| `formatDetailValue()` | Formats values (booleans, numbers with units, strings) |
| Health Tab | Rich check cards with icon, status badge, detail grids, consecutive failure count, linked case navigation |
| Auto-refresh | Health status refreshes every 30 seconds when health tab is active |
| Run Health Checks | Button with spinner; fires `CaseModel.runHealthChecks()` then re-fetches status |
| Overview Health Widget | Summary card showing overall status with healthy/warning/error counts |

---

## File Relationship Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                                                                 │
│  CasesList.tsx ──→ CaseModel.getMyCases() ──→ GET /cases        │
│       │                                                         │
│       └──→ navigate(/cases/:id)                                 │
│              │                                                  │
│  CaseDetailView.tsx ──→ CaseModel.getById() ──→ GET /cases/:id  │
│       │                     .addComment() ──→ POST /cases/:id/…  │
│       │                     .rate() ──→ POST /cases/:id/rate     │
│       │                     .adminDelete() ──→ DELETE /admin/…   │
│       │                                                         │
│  CasesDashboard.tsx ──→ CaseModel.getAnalytics() ──→ GET /admin/│
│       │                     .adminGetAll() ──→ GET /admin/cases  │
│       │                                                         │
│  AdminCaseManagement.tsx ──→ CaseModel.getHealthStatus()        │
│       │                          ──→ GET /admin/cases/health    │
│       │                     .runHealthChecks()                   │
│       │                          ──→ POST /admin/cases/health/  │
│       │                               run-checks               │
│                                                                 │
│  types/cases.ts ◄─── shared TypeScript interfaces               │
│    (HealthCheck, HealthStatus, Case, CaseComment, etc.)         │
└─────────────┬───────────────────────────────────────────────────┘
              │ HTTP (axios via api service)
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                        │
│                                                                 │
│  apiErrorTracker.ts ──→ hooks res.end() for 5xx tracking         │
│       │                                                         │
│       └──→ healthMonitor.trackApiError()                         │
│                                                                 │
│  cases.ts ──→ casesRouter ──→ /cases/*                          │
│       │           │──→ caseAnalyzer (AI analysis)               │
│       │           │──→ notificationService (admin/reporter)     │
│       │           └──→ mapCaseRow() + safeJson()                │
│       │                                                         │
│  adminCases.ts ──→ adminCasesRouter ──→ /admin/cases/*          │
│       │               │──→ healthMonitor (10 health checks)      │
│       │               └──→ mapCaseRow() + safeJson()            │
│       │                                                         │
│  healthMonitor.ts ──→ 10 checks (DB, API errors, process,      │
│       │                  memory, disk, auth, worker, Ollama,    │
│       │                  ingestion, enterprise)                 │
│       │──→ auto-creates cases on consecutive failures           │
│       └──→ auto-resolves cases when health restores              │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐  ┌────────────────┐  ┌────────────────┐          │
│  │  cases   │  │ case_comments  │  │ case_activity   │          │
│  │  (main)  │──│ (threads)      │──│ (audit log)     │          │
│  └──────────┘  └────────────────┘  └────────────────┘          │
│       │                                                         │
│       ├──→ users (JOINs for reporter_name, assignee_name)       │
│       └──→ system_health_checks (health state per check type)   │
└─────────────────────────────────────────────────────────────────┘
```

## Total Lines of Code

| File | LOC |
|------|-----|
| `backend/src/routes/cases.ts` | 504 |
| `backend/src/routes/adminCases.ts` | 369 |
| `backend/src/services/healthMonitor.ts` | ~614 |
| `backend/src/middleware/apiErrorTracker.ts` | ~30 |
| `frontend/src/pages/general/CasesList.tsx` | 301 |
| `frontend/src/pages/general/CaseDetailView.tsx` | 463 |
| `frontend/src/pages/cases/CasesDashboard.tsx` | 516 |
| `frontend/src/pages/admin/AdminCaseManagement.tsx` | ~1015 |
| `frontend/src/models/CaseModel.ts` | 127 |
| `frontend/src/types/cases.ts` | ~140 |
| **Total** | **~4,079** |
