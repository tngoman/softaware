# Updates & Error Reporting Module — Overview

**Version:** 1.0.0  
**Last Updated:** 2026-06-10

---

## 1. Module Overview

### Purpose

The Updates & Error Reporting module provides a centralised **software distribution, client monitoring, and error tracking** system. It serves three core functions:

1. **Software Update Distribution** — Register software products, publish versioned release packages with file uploads, and let client applications check for and download updates via API.
2. **Client Heartbeat Monitoring** — Track client installations in real-time via periodic heartbeat pings. Detect online/offline status, deliver server commands (force logout, messages), and manage client lifecycle (block/unblock/delete).
3. **Error Reporting & Aggregation** — Ingest error reports from desktop, mobile, frontend, and backend sources. Aggregate per-client error summaries for quick triage. Browse, filter, and analyse errors from the admin dashboard.

**Key capabilities:**

- **Dual Auth Model** — Public/client endpoints authenticate via `software_key` (header or body); admin endpoints use JWT Bearer tokens. No per-client user accounts required.
- **Heartbeat Protocol** — Clients send periodic heartbeats with system metadata (hostname, IP, OS, app version). The server computes status thresholds: online (<5 min), recent (<24 h), inactive (<7 d), offline (>7 d).
- **Piggy-backed Error Reporting** — Heartbeats can include `recent_errors` alongside normal telemetry, reducing round trips for clients that report errors frequently.
- **Server-to-Client Commands** — Admins can enqueue commands (`force_logout`, `send_message`, `block`) that are delivered to clients in the next heartbeat response.
- **Update Availability Check** — Both the full heartbeat and a lightweight `GET /check` endpoint return whether a newer version is available for the client's software product.
- **File Upload & Download** — Multipart file upload for release packages (API key or JWT auth), streamed file download for clients (software_key auth).
- **Module Tracking** — CRUD for software modules with developer assignment (many-to-many).
- **Password Reset Flow** — OTP-based password reset (request → verify → reset) with email delivery via SMTP.
- **Admin Dashboard** — Summary stats (software count, update count, active clients, recent activity).
- **System Health** — Public `/api_status` endpoint for monitoring DB connectivity and table counts.
- **Cross-linked Frontend Pages** — Client Monitor and Error Reports pages interlink via URL params for seamless drill-down.

### Business Value

- Centralised update distribution for all Softaware products from a single API
- Real-time visibility into which clients are online, what versions they run, and their error rates
- Zero-config client monitoring — clients only need a `software_key` to participate
- Server-side command delivery without requiring push notification infrastructure
- Error aggregation reduces noise — per-client summaries highlight the noisiest installations
- Admin actions (block, force logout, message) provide remote control over deployed clients
- Self-service password reset reduces support overhead

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 8 (updHeartbeat, updClients, updErrorReport, updSoftware, updUpdates, updModules, updFiles, updMisc) |
| Frontend page files | 2 (ClientMonitor.tsx, ErrorReports.tsx) |
| Frontend type files | 1 (types/updates.ts) |
| Backend type files | 1 (updatesTypes.ts) |
| Backend LOC | ~1,846 |
| Frontend LOC | ~1,139 |
| Total LOC | ~3,100 (including types) |
| API endpoints | ~35 |
| MySQL tables | 9 (update_software, update_releases, update_clients, update_modules, update_user_modules, update_installed, update_password_resets, error_reports, client_error_summaries) |
| Client status thresholds | 4 (online <5m, recent <24h, inactive <7d, offline >7d) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       ADMIN FRONTEND                             │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐     │
│  │   Client Monitor    │◄──►│      Error Reports          │     │
│  │  (ClientMonitor.tsx)│    │    (ErrorReports.tsx)        │     │
│  │  • Status cards     │    │  • Error log (paginated)    │     │
│  │  • Client table     │    │  • Client summaries (KPIs)  │     │
│  │  • Detail drawer    │    │  • Error detail modal       │     │
│  │  • Admin actions    │    │  • Level/source filters     │     │
│  │  • Auto-refresh 15s │    │  • Auto-refresh 30s         │     │
│  └────────┬────────────┘    └─────────────┬───────────────┘     │
│           │   Cross-links via URL params   │                     │
│           └────────────────────────────────┘                     │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ JWT Bearer Token
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EXPRESS API SERVER (:8787)                   │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ updSoftware  │  │  updUpdates  │  │      updFiles           │ │
│  │ CRUD products│  │ CRUD releases│  │  Upload (multipart)     │ │
│  │ (admin+pub)  │  │  (admin)     │  │  Download (stream)      │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│         │                 │                      │               │
│  ┌──────┴─────────────────┴──────────────────────┴─────────────┐ │
│  │                    MySQL Database                            │ │
│  │  update_software │ update_releases │ update_installed        │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                            │                                     │
│  ┌─────────────────────────┴───────────────────────────────────┐ │
│  │                 CLIENT-FACING ENDPOINTS                      │ │
│  │                                                              │ │
│  │  ┌──────────────┐    ┌────────────────┐   ┌──────────────┐  │ │
│  │  │ updHeartbeat  │    │ updErrorReport │   │  updClients   │  │ │
│  │  │ POST /        │    │ POST /         │   │  GET/PUT/DEL  │  │ │
│  │  │ GET  /check   │    │ GET  /         │   │  (admin)      │  │ │
│  │  │ (software_key)│    │ GET  /summaries│   │              │  │ │
│  │  └──────┬────────┘    └───────┬────────┘   └──────┬───────┘  │ │
│  │         │                     │                   │          │ │
│  │  ┌──────┴─────────────────────┴───────────────────┴───────┐  │ │
│  │  │  update_clients │ error_reports │ client_error_summaries│  │ │
│  │  └────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │      updModules          │  │        updMisc               │ │
│  │  Module CRUD + developer │  │  /info, /dashboard,          │ │
│  │  assignment (admin)      │  │  /api_status, /installed,    │ │
│  └──────────────────────────┘  │  /schema, password reset     │ │
│                                └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ software_key (header or body)
┌──────────────────────────────────┴───────────────────────────────┐
│                      CLIENT APPLICATIONS                         │
│                                                                  │
│  Desktop (.NET)  │  Mobile (React Native)  │  Web Frontend       │
│  • Heartbeat every 60s (foreground only)                         │
│  • POST /updates/heartbeat with system metadata                  │
│  • POST /updates/error-report on caught errors                   │
│  • GET  /updates/download to fetch update packages               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Request Flow

### 3.1 Client Heartbeat Flow

```
Client App
  → POST /updates/heartbeat
    {
      software_key, hostname, machine_name, ip_address,
      os_info, app_version, current_user, recent_errors[]
    }
  → updHeartbeat.ts:
    1. Validate software_key → lookup update_software
    2. Find or create update_clients record (by software_id + hostname + machine_name)
    3. Check if client is blocked → 403 if blocked
    4. Update last_heartbeat, ip_address, app_version, etc.
    5. Store recent_errors → INSERT into error_reports + UPSERT client_error_summaries
    6. Check for newer version → compare app_version vs latest update_releases
    7. Check for pending commands → force_logout / server_message
    8. Return { success, client_id, update_available?, force_logout?, server_message? }
```

### 3.2 Error Reporting Flow

```
Client App
  → POST /updates/error-report
    {
      software_key, client_identifier, source, hostname,
      errors: [{ type, level, message, file, line, stack_trace, url, method }]
    }
  → updErrorReport.ts:
    1. Validate software_key → lookup update_software
    2. Normalize each error (dual field name support: type/error_type, level/error_level)
    3. INSERT INTO error_reports (one per error)
    4. UPSERT client_error_summaries (increment counters: total_errors, error_count, warning_count, notice_count)
    5. Return { success, stored_count }
```

### 3.3 Admin Client Monitor Flow

```
Admin Browser
  → GET /updates/clients (JWT auth)
    → updClients.ts: SELECT with JOINs → compute status from seconds_since_heartbeat
    → Returns client list with software_name, latest_version, status

  → ClientMonitor.tsx:
    1. Fetch clients every 15s (auto-refresh)
    2. Render summary cards (total, online, recent, inactive, offline, blocked)
    3. Render searchable/filterable table
    4. Click row → open ClientDetailDrawer
    5. Drawer actions: block, unblock, force_logout, send_message, delete, view_errors
    6. "View Error Reports" → navigate to /error-reports?hostname={hostname}
```

### 3.4 Admin Error Reports Flow

```
Admin Browser
  → GET /updates/error-report (JWT auth, with filters)
    → updErrorReport.ts: SELECT with pagination + filters
    → Returns error list

  → GET /updates/error-report/summaries (JWT auth)
    → Returns per-client aggregated error stats

  → ErrorReports.tsx:
    1. Two tabs: Error Log | Client Summaries
    2. Error Log: paginated table (50/page), level/source/hostname filters
    3. Click row → ErrorDetailModal (metadata grid, file location, request info, message, stack trace)
    4. Hostname click → navigate to /client-monitor?search={hostname}
    5. Client Summaries: KPI cards (total errors/warnings/notices/affected clients) + summary table
    6. Auto-refresh every 30s
```

---

## 4. Route Mounting

All routes are mounted in `app.ts` on the `apiRouter`, which is served at both `/` and `/api` prefixes:

```typescript
// Updates Module Routes
apiRouter.use('/updates/software',     updSoftwareRouter);
apiRouter.use('/updates/updates',      updUpdatesRouter);
apiRouter.use('/updates',              updFilesRouter);       // /upload, /download
apiRouter.use('/updates/heartbeat',    updHeartbeatRouter);
apiRouter.use('/updates/error-report', updErrorReportRouter);
apiRouter.use('/updates/clients',      updClientsRouter);
apiRouter.use('/updates/modules',      updModulesRouter);
apiRouter.use('/updates',              updMiscRouter);        // /info, /dashboard, /api_status, etc.

// Aliases
apiRouter.use('/softaware/software',   updSoftwareRouter);
apiRouter.use('/softaware/modules',    updModulesRouter);
```

### Frontend Routes

| Path | Component | Guard | Sidebar |
|------|-----------|-------|---------|
| `/client-monitor` | `ClientMonitor` | `AdminRoute` | "Client Monitor" — `SignalIcon`, adminOnly |
| `/error-reports` | `ErrorReports` | `AdminRoute` | "Error Reports" — `BugAntIcon`, adminOnly |
