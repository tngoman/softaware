# Heartbeat Monitoring — Case-Integrated Rebuild Plan

**Version:** 1.0.0  
**Date:** 2026-03-07  
**Status:** Planned  
**Dependencies:** Cases module, Updates module, Error Reporting Server Spec

---

## 1. Executive Summary

The original heartbeat system (PHP, `updates.softaware.co.za/api/heartbeat.php`) has been migrated to the Node.js backend (`src/routes/updHeartbeat.ts`). A **Client Management** screen exists in the desktop app (`/clients`) showing online/offline status, but there is **no dedicated Heartbeat Monitoring dashboard** — meaning there is no visibility into:

- Client health trends over time
- Error rates per client
- Stale/unresponsive clients (soft failures)
- Automated alerting when clients go dark

This plan rebuilds heartbeat monitoring as a **first-class integration with the Cases module**, so that client health issues automatically create and resolve tracked cases, rather than relying on a standalone monitoring screen.

---

## 2. What Exists Today

| Component | Location | Status |
|-----------|----------|--------|
| **Heartbeat endpoint** (PHP) | `opt/updates.softaware.co.za/public_html/api/heartbeat.php` | ✅ Legacy — replaced |
| **Heartbeat endpoint** (Node) | `backend/src/routes/updHeartbeat.ts` | ✅ Live — POST `/updates/heartbeat` |
| **Client admin CRUD** | `backend/src/routes/updClients.ts` | ✅ Live — GET/PUT/DELETE `/updates/clients` |
| **Client Management UI** (desktop) | `desktop/src/app/clients/page.tsx` | ✅ Live — online/offline/blocked |
| **System Health Monitor** | `backend/src/services/healthMonitor.ts` | ✅ Live — 10 checks, auto-creates cases |
| **API Error Tracker** | `backend/src/middleware/apiErrorTracker.ts` | ✅ Live — feeds 5xx to healthMonitor |
| **Cases system** | `backend/src/routes/cases.ts`, `adminCases.ts` | ✅ Live — full lifecycle + analytics |
| **Error Reporting spec** | `documentation/Updates/ERROR_REPORTING_SERVER_SPEC.md` | 📋 Spec ready — not yet implemented |
| **Heartbeat monitoring screen** | — | ❌ **Missing** |
| **Client error ingestion** | — | ❌ **Missing** (spec exists for `recent_errors` + `/api/error-report`) |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATIONS                                  │
│  Desktop (Electron)  │  Portal (PHP/Web)  │  Future Mobile              │
│  Sends heartbeat every 5 min with:                                       │
│    - software_key, client_identifier, app_version, active_page          │
│    - recent_errors[] (NEW — from ERROR_REPORTING_SERVER_SPEC)           │
│    - metadata.error_summary{} (NEW)                                     │
└───────────────┬──────────────────────┬───────────────────────────────────┘
                │                      │
      POST /updates/heartbeat    POST /updates/error-report (NEW)
                │                      │
                ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express :8787)                               │
│                                                                          │
│  ┌─────────────────────────┐    ┌────────────────────────────────┐      │
│  │  updHeartbeat.ts        │    │  updErrorReport.ts (NEW)       │      │
│  │  (enhanced)             │    │  POST /updates/error-report    │      │
│  │  - Process heartbeat    │    │  - Validate & store errors     │      │
│  │  - Extract recent_errors│    │  - Update client error summary │      │
│  │  - Feed → Monitor       │    │  - Feed → Monitor              │      │
│  └──────────┬──────────────┘    └──────────┬─────────────────────┘      │
│             │                               │                            │
│             ▼                               ▼                            │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  clientHeartbeatMonitor.ts (NEW SERVICE)                     │       │
│  │                                                               │       │
│  │  Runs every 60 seconds:                                       │       │
│  │  1. Scan update_clients for stale heartbeats (> threshold)    │       │
│  │  2. Check per-client error rates from error_reports           │       │
│  │  3. Detect version drift (client behind latest release)       │       │
│  │  4. Detect IP changes / suspicious patterns                   │       │
│  │                                                               │       │
│  │  When threshold breached:                                     │       │
│  │    → Auto-create Case (source: 'health_monitor')             │       │
│  │    → Notify admins via notificationService                    │       │
│  │  When recovered:                                              │       │
│  │    → Auto-resolve Case                                        │       │
│  │    → Log activity in case_activity                            │       │
│  └──────────────────────────────┬───────────────────────────────┘       │
│                                 │                                        │
│             ┌───────────────────┴───────────────────┐                    │
│             ▼                                       ▼                    │
│  ┌─────────────────────┐              ┌─────────────────────────┐       │
│  │  cases / case_activity │           │  client_error_summaries  │       │
│  │  case_comments         │           │  error_reports           │       │
│  │  (existing tables)     │           │  (NEW tables)            │       │
│  └─────────────────────┘              └─────────────────────────┘       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  Admin API Routes (NEW + enhanced)                           │       │
│  │  GET /admin/cases/client-health   → Client health dashboard  │       │
│  │  GET /updates/clients/:id/errors  → Error history for client │       │
│  │  GET /updates/clients/health-summary → Aggregate health KPIs │       │
│  └──────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  HeartbeatMonitor.tsx (NEW PAGE)                               │     │
│  │                                                                │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │     │
│  │  │ KPI Cards │  │ Client   │  │ Error    │  │ Version  │     │     │
│  │  │ Online/   │  │ Health   │  │ Rate     │  │ Drift    │     │     │
│  │  │ Offline/  │  │ Timeline │  │ Chart    │  │ Chart    │     │     │
│  │  │ Error/    │  │          │  │          │  │          │     │     │
│  │  │ Stale     │  │          │  │          │  │          │     │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │     │
│  │                                                                │     │
│  │  ┌──────────────────────────────────────────────────────┐     │     │
│  │  │  Client Health Table (sortable, filterable)          │     │     │
│  │  │  Status • Hostname • User • Version • Error Rate     │     │     │
│  │  │  Last Heartbeat • Health Score • Actions → Case Link │     │     │
│  │  └──────────────────────────────────────────────────────┘     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  Cases pages (existing) now also show heartbeat-generated cases          │
│  filtered by source = 'health_monitor' + category = 'performance'       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Phases

### Phase 1 — Backend Error Ingestion (from ERROR_REPORTING_SERVER_SPEC)

**Goal:** Implement the two error-receiving endpoints so clients can report errors.

#### 4.1.1 Database Migrations

Create the `error_reports` and `client_error_summaries` tables as specified in `ERROR_REPORTING_SERVER_SPEC.md` §3:

```sql
-- Migration: 20260307_create_error_reports.sql

CREATE TABLE IF NOT EXISTS error_reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    software_key VARCHAR(50) NOT NULL,
    client_identifier VARCHAR(64) NOT NULL,
    hostname VARCHAR(255) NULL,
    source ENUM('backend', 'frontend') NOT NULL DEFAULT 'backend',
    error_type VARCHAR(50) NOT NULL,
    error_level ENUM('error', 'warning', 'notice') NOT NULL DEFAULT 'error',
    error_label VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    error_file VARCHAR(500) NULL,
    error_line INT UNSIGNED NULL,
    error_column INT UNSIGNED NULL,
    error_trace TEXT NULL,
    error_url VARCHAR(2000) NULL,
    request_method VARCHAR(10) NULL,
    request_uri VARCHAR(2000) NULL,
    request_route VARCHAR(500) NULL,
    request_ip VARCHAR(45) NULL,
    request_user_agent VARCHAR(500) NULL,
    app_version VARCHAR(50) NULL,
    php_version VARCHAR(50) NULL,
    server_software VARCHAR(255) NULL,
    os_info VARCHAR(255) NULL,
    error_occurred_at DATETIME NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra JSON NULL,
    INDEX idx_client (software_key, client_identifier),
    INDEX idx_level (error_level),
    INDEX idx_type (error_type),
    INDEX idx_occurred (error_occurred_at),
    INDEX idx_received (received_at),
    INDEX idx_hostname (hostname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_error_summaries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    software_key VARCHAR(50) NOT NULL,
    client_identifier VARCHAR(64) NOT NULL,
    hostname VARCHAR(255) NULL,
    app_version VARCHAR(50) NULL,
    total_errors BIGINT UNSIGNED DEFAULT 0,
    total_warnings BIGINT UNSIGNED DEFAULT 0,
    total_notices BIGINT UNSIGNED DEFAULT 0,
    last_error_message TEXT NULL,
    last_error_at DATETIME NULL,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_client_unique (software_key, client_identifier),
    INDEX idx_last_error (last_error_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 4.1.2 New Route: `src/routes/updErrorReport.ts`

- `POST /updates/error-report` — public endpoint (requires `software_key`)
- Validate against `ERROR_REPORTING_SERVER_SPEC.md` §2 schema using Zod
- Verify `software_key` against `update_software` table
- Check client block status
- Insert each error into `error_reports`
- Upsert `client_error_summaries`
- Return `{ success: true, received: N }`

#### 4.1.3 Enhance `updHeartbeat.ts`

Add handling for the two new fields from `ERROR_REPORTING_SERVER_SPEC.md` §1:

- Parse `recent_errors[]` from heartbeat body
- Parse `metadata.error_summary{}` from heartbeat body
- If `recent_errors` is non-empty → insert into `error_reports` table
- If `metadata.error_summary` present → update `client_error_summaries`
- **No change** to heartbeat response format

#### 4.1.4 Mount Route

In `app.ts`, add:
```typescript
import { updErrorReportRouter } from './routes/updErrorReport.js';
app.use('/updates/error-report', updErrorReportRouter);
```

**Files to create/modify:**
| File | Action |
|------|--------|
| `src/db/migrations/20260307_create_error_reports.sql` | Create |
| `src/routes/updErrorReport.ts` | Create |
| `src/routes/updHeartbeat.ts` | Modify — add `recent_errors` + `error_summary` handling |
| `src/app.ts` | Modify — mount new route |

---

### Phase 2 — Client Heartbeat Monitor Service

**Goal:** Build a background monitoring service that detects client health problems and auto-creates cases.

#### 4.2.1 New Service: `src/services/clientHeartbeatMonitor.ts`

Modeled after the existing `healthMonitor.ts` pattern (interval-based checks with consecutive failure tracking and auto-case creation).

**Health checks to implement:**

| # | Check | Threshold | Severity | Category |
|---|-------|-----------|----------|----------|
| 1 | **Client gone dark** | No heartbeat in 15 min (was online) | `high` | `performance` |
| 2 | **Client gone stale** | No heartbeat in 24 hrs | `medium` | `performance` |
| 3 | **High error rate** | ≥ 10 errors in last hour per client | `high` | `bug` |
| 4 | **Critical error burst** | ≥ 3 `level='error'` in 5 min | `critical` | `bug` |
| 5 | **Version drift** | Client version ≠ latest release for > 7 days | `low` | `other` |
| 6 | **IP anomaly** | IP changed > 3 times in 1 hour | `medium` | `security` |

**Case auto-creation contract:**

```typescript
{
  title:          `[Heartbeat] ${checkName} — ${client.hostname}`,
  description:    `Automated detection: ${detailMessage}`,
  category:       checkCategory,          // bug, performance, security, other
  severity:       checkSeverity,          // low, medium, high, critical
  source:         'health_monitor',
  type:           'monitoring',
  url:            null,
  page_path:      '/updates/clients',     // link admin to the client management page
  component_name: 'ClientHeartbeatMonitor',
  error_message:  shortSummary,
  metadata: {
    monitor_type:      'client_heartbeat',
    check_name:        checkName,
    client_id:         client.id,
    client_identifier: client.client_identifier,
    software_key:      client.software_key,
    hostname:          client.hostname,
    app_version:       client.app_version,
    last_heartbeat:    client.last_heartbeat,
    auto_generated:    true
  }
}
```

**Auto-resolve logic:**
- When a previously failed check passes → update the linked case to `status: 'resolved'`
- Add `case_activity` entry: `action: 'status_changed', old_value: 'open', new_value: 'resolved'` with metadata `{ auto_resolved: true, reason: 'Client reconnected' }`

**State tracking table** (follows `system_health_checks` pattern):

```sql
-- Migration: 20260307_create_client_health_checks.sql

CREATE TABLE IF NOT EXISTS client_health_checks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    check_name VARCHAR(100) NOT NULL,
    status ENUM('healthy', 'warning', 'error', 'critical') DEFAULT 'healthy',
    consecutive_failures INT UNSIGNED DEFAULT 0,
    last_check_at DATETIME NULL,
    last_failure_at DATETIME NULL,
    last_success_at DATETIME NULL,
    case_id VARCHAR(36) NULL,                -- FK → cases.id (linked auto-created case)
    details JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_client_check (client_id, check_name),
    INDEX idx_status (status),
    INDEX idx_case (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Service lifecycle:**
- Started in `index.ts` alongside the existing `healthMonitor`
- Runs every 60 seconds
- Uses `consecutive_failures` threshold before creating a case (3 consecutive for error, 1 for critical)
- Exported: `startClientHeartbeatMonitor()`, `stopClientHeartbeatMonitor()`, `getClientHealthStatus()`

#### 4.2.2 Files to create/modify

| File | Action |
|------|--------|
| `src/db/migrations/20260307_create_client_health_checks.sql` | Create |
| `src/services/clientHeartbeatMonitor.ts` | Create |
| `src/index.ts` | Modify — start monitor alongside healthMonitor |

---

### Phase 3 — Admin API Endpoints

**Goal:** Expose client health data for the frontend dashboard.

#### 4.3.1 New/Enhanced Routes

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/admin/cases/client-health` | Aggregate client health KPIs + check statuses | Admin |
| `GET` | `/updates/clients/:id/errors` | Paginated error history for a specific client | Admin |
| `GET` | `/updates/clients/health-summary` | Per-client health scores for the table view | Admin |
| `GET` | `/updates/clients/:id/error-trend` | Hourly error count for last 24h (chart data) | Admin |

#### 4.3.2 Client Health KPI Response

```json
{
  "success": true,
  "kpis": {
    "total_clients": 12,
    "online_clients": 8,
    "offline_clients": 3,
    "blocked_clients": 1,
    "clients_with_errors": 4,
    "total_errors_24h": 23,
    "total_warnings_24h": 45,
    "critical_errors_24h": 2,
    "stale_clients": 1,
    "version_drift_clients": 3,
    "avg_heartbeat_interval_secs": 295,
    "open_heartbeat_cases": 2
  },
  "checks": [
    {
      "client_id": 5,
      "hostname": "portal-server-01",
      "check_name": "high_error_rate",
      "status": "error",
      "consecutive_failures": 4,
      "case_id": "abc-123",
      "case_number": "CASE-43391150",
      "last_check_at": "2026-03-07T10:30:00Z"
    }
  ]
}
```

#### 4.3.3 Error History Response

```json
{
  "success": true,
  "client": { "id": 5, "hostname": "portal-server-01", "app_version": "2.1.14" },
  "errors": [
    {
      "id": 142,
      "source": "backend",
      "error_type": "exception",
      "error_level": "error",
      "error_label": "PDOException",
      "error_message": "SQLSTATE[HY000] Connection refused",
      "error_file": "/var/www/portal/app/Core/Model.php",
      "error_line": 24,
      "error_occurred_at": "2026-03-07T10:30:00Z",
      "received_at": "2026-03-07T10:30:01Z"
    }
  ],
  "pagination": { "page": 1, "per_page": 50, "total": 142 }
}
```

#### 4.3.4 Files to create/modify

| File | Action |
|------|--------|
| `src/routes/updClients.ts` | Modify — add `/:id/errors`, `/:id/error-trend`, `/health-summary` |
| `src/routes/adminCases.ts` | Modify — add `/client-health` endpoint |

---

### Phase 4 — Frontend: Heartbeat Monitor Dashboard

**Goal:** Build the missing monitoring screen as a new page in the React frontend.

#### 4.4.1 New Page: `src/pages/HeartbeatMonitor.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Heartbeat Monitor                                     [Refresh ↻] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 🟢 8     │  │ 🔴 3     │  │ ⚠️ 4     │  │ 🐛 23    │          │
│  │ Online   │  │ Offline  │  │ Stale    │  │ Errors   │          │
│  │ Clients  │  │ Clients  │  │ Clients  │  │ (24h)    │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Active Health Alerts (from client_health_checks)           │   │
│  │  ┌─────┐ portal-server-01: High error rate (4 consecutive) │   │
│  │  │ CASE│ → CASE-43391150 [View Case]                       │   │
│  │  └─────┘                                                    │   │
│  │  ┌─────┐ dev-machine-03: Client gone dark (17 min)         │   │
│  │  │ CASE│ → CASE-43391155 [View Case]                       │   │
│  │  └─────┘                                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Client Health Table                                        │   │
│  │  ──────────────────────────────────────────────────────────│   │
│  │  Status │ Client      │ User   │ Version │ Errors │ Score │   │
│  │  🟢     │ portal-01   │ Admin  │ 2.1.14  │ 3      │ 92%  │   │
│  │  🟢     │ portal-02   │ Jane   │ 2.1.14  │ 0      │ 100% │   │
│  │  🟡     │ dev-03      │ —      │ 2.1.12  │ 15     │ 45%  │   │
│  │  🔴     │ staging     │ Bot    │ 2.1.10  │ 42     │ 12%  │   │
│  │                                                              │   │
│  │  Click row → expand error trend chart + error log            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Health Score calculation** (0–100%):
- Start at 100
- −30 if offline (no heartbeat in 15 min)
- −20 per critical error in last 24h
- −10 per error-level error in last 24h
- −5 per warning in last 24h
- −15 if version drift > 7 days
- Floor at 0

#### 4.4.2 Route Registration

In `App.tsx`:
```tsx
<Route path="/heartbeat-monitor" element={<AdminRoute><HeartbeatMonitor /></AdminRoute>} />
```

#### 4.4.3 Navigation

Add to sidebar Layout.tsx under the "Updates" section:
```tsx
{ name: 'Heartbeat Monitor', href: '/heartbeat-monitor', icon: Activity }
```

#### 4.4.4 Files to create/modify

| File | Action |
|------|--------|
| `src/pages/HeartbeatMonitor.tsx` | Create — main dashboard page |
| `src/App.tsx` | Modify — add route |
| `src/components/Layout/Layout.tsx` | Modify — add sidebar link |

---

### Phase 5 — Case Integration Enhancements

**Goal:** Make heartbeat-generated cases distinct and actionable in the existing Cases UI.

#### 4.5.1 Case List Filtering

Add a new filter chip on `CasesList.tsx` and `AdminCaseManagement.tsx`:
- **Source: Heartbeat Monitor** — filters `source = 'health_monitor'` AND `metadata.monitor_type = 'client_heartbeat'`

#### 4.5.2 Case Detail Enhancement

On `CaseDetailView.tsx`, when `metadata.monitor_type === 'client_heartbeat'`:
- Show a **Client Info Card** with:
  - Client hostname, IP, app version, last heartbeat
  - Link to the client in `/updates/clients` (or the heartbeat monitor)
  - Recent error summary from `client_error_summaries`

#### 4.5.3 Auto-Resolution Banner

When a heartbeat case is auto-resolved, show a green banner:
> ✅ This case was automatically resolved by the Heartbeat Monitor — the client reconnected at {timestamp}.

#### 4.5.4 Files to modify

| File | Action |
|------|--------|
| `src/pages/general/CasesList.tsx` | Modify — add heartbeat source filter |
| `src/pages/admin/AdminCaseManagement.tsx` | Modify — add heartbeat source filter |
| `src/pages/general/CaseDetailView.tsx` | Modify — add client info card for heartbeat cases |

---

## 5. Complete File Inventory

### New Files (7)

| # | File | Type | Est. LOC |
|---|------|------|----------|
| 1 | `backend/src/db/migrations/20260307_create_error_reports.sql` | SQL | 60 |
| 2 | `backend/src/db/migrations/20260307_create_client_health_checks.sql` | SQL | 30 |
| 3 | `backend/src/routes/updErrorReport.ts` | Route | ~150 |
| 4 | `backend/src/services/clientHeartbeatMonitor.ts` | Service | ~400 |
| 5 | `frontend/src/pages/HeartbeatMonitor.tsx` | Page | ~500 |
| 6 | `documentation/Updates/HEARTBEAT_MONITORING_PLAN.md` | Docs | This file |
| 7 | `backend/src/db/updatesTypes.ts` | Types | ~20 (additions) |

### Modified Files (8)

| # | File | Change |
|---|------|--------|
| 1 | `backend/src/routes/updHeartbeat.ts` | Add `recent_errors` + `error_summary` parsing |
| 2 | `backend/src/routes/updClients.ts` | Add error history, error trend, health summary endpoints |
| 3 | `backend/src/routes/adminCases.ts` | Add `/client-health` endpoint |
| 4 | `backend/src/app.ts` | Mount `updErrorReportRouter` |
| 5 | `backend/src/index.ts` | Start `clientHeartbeatMonitor` |
| 6 | `frontend/src/App.tsx` | Add `/heartbeat-monitor` route |
| 7 | `frontend/src/components/Layout/Layout.tsx` | Add sidebar nav item |
| 8 | `frontend/src/pages/general/CaseDetailView.tsx` | Add client info card for heartbeat cases |

---

## 6. Implementation Order & Dependencies

```
Phase 1 ──────────────────────────────────────────
  │  1a. Run DB migrations (error_reports, client_error_summaries)
  │  1b. Create updErrorReport.ts route
  │  1c. Enhance updHeartbeat.ts with recent_errors
  │  1d. Mount route in app.ts
  │
Phase 2 ──────────────────────────────────────────
  │  2a. Run DB migration (client_health_checks)
  │  2b. Create clientHeartbeatMonitor.ts service
  │  2c. Start monitor in index.ts
  │  ↑ Depends on Phase 1 (reads error_reports table)
  │
Phase 3 ──────────────────────────────────────────
  │  3a. Add error history + trend endpoints to updClients.ts
  │  3b. Add /client-health endpoint to adminCases.ts
  │  3c. Add /health-summary endpoint to updClients.ts
  │  ↑ Depends on Phase 2 (reads client_health_checks)
  │
Phase 4 ──────────────────────────────────────────
  │  4a. Create HeartbeatMonitor.tsx page
  │  4b. Add route to App.tsx
  │  4c. Add sidebar link to Layout.tsx
  │  ↑ Depends on Phase 3 (consumes API endpoints)
  │
Phase 5 ──────────────────────────────────────────
  │  5a. Add heartbeat filter to CasesList + AdminCaseManagement
  │  5b. Add client info card to CaseDetailView
  │  ↑ Depends on Phase 2 (cases with monitor_type metadata)
```

---

## 7. Key Differences from Old Heartbeat System

| Aspect | Old (PHP `heartbeat.php`) | New (Case-Integrated) |
|--------|--------------------------|----------------------|
| **Monitoring** | None — just data collection | Active monitoring with 6 health checks |
| **Alerting** | None | Auto-creates Cases with severity levels |
| **Recovery** | Manual | Auto-resolves cases when client recovers |
| **Error tracking** | None | Full error ingestion from clients |
| **Visibility** | Client list only | Dashboard with KPIs, health scores, trends |
| **Integration** | Standalone | Wired into Cases module with full audit trail |
| **History** | Only latest heartbeat | Error history, health check history, case activity |
| **Technology** | PHP/PDO | TypeScript/Express/Zod |

---

## 8. Testing Plan

| Test | Type | Description |
|------|------|-------------|
| Heartbeat with `recent_errors` | Integration | POST heartbeat with errors → verify `error_reports` rows created |
| Dedicated error-report endpoint | Integration | POST `/updates/error-report` → verify storage + summary update |
| Blocked client rejection | Integration | Blocked client sends error report → 403 |
| Monitor detects stale client | Unit | Mock client with old `last_heartbeat` → case created |
| Monitor auto-resolves | Unit | Client reconnects → linked case resolved |
| High error rate detection | Unit | Insert 10+ errors in 1h → case created |
| Version drift detection | Unit | Client version ≠ latest → case after 7 days |
| Health KPI endpoint | Integration | GET `/admin/cases/client-health` → correct counts |
| Frontend health score | Unit | Calculate score from mock data → expected value |
| End-to-end flow | E2E | Client sends heartbeat with errors → monitor detects → case appears in UI |

---

## 9. Open Questions

1. **Heartbeat interval tuning** — Currently 5 min in the desktop app. Should Portal clients use the same interval or shorter (e.g., 2 min)?
2. **Error retention** — How long to keep `error_reports` rows? Suggest 90 days with auto-cleanup.
3. **Case de-duplication** — If a client goes dark, reconnects, then goes dark again, should it create a new case or reopen the old one?
4. **Notification throttling** — Avoid flooding admins with cases during a mass outage. Suggest grouping into a single "Multiple clients offline" case if > 3 clients go dark within 5 min.
5. **Dashboard auto-refresh** — Use the same 30s polling as the desktop clients page, or switch to SSE/WebSocket for real-time?

---

*This plan can be implemented incrementally. Phase 1 delivers immediate value by enabling error collection. Phase 2 adds automated monitoring. Phases 3–5 provide the UI. Each phase is independently deployable.*
