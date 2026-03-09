# Cases Module

## Overview
The Cases module provides a comprehensive issue tracking and case management system for user-reported bugs, auto-detected problems, and health monitor alerts. It includes AI-powered component analysis, resolution tracking with user ratings, activity logging, internal/public comments, and an admin analytics dashboard. Cases flow through a lifecycle from creation to resolution with full audit trails.

**Current Data**: 4 cases with activity logs and comment threads (as of March 2026)  
**Last Updated**: June 2025 — Health monitor rewrite, attachment fixes, dashboard overhaul

## Key Responsibilities
- Case creation with AI-powered component identification via `caseAnalyzer`
- Case lifecycle management (open → in_progress → resolved → closed)
- Comment system with internal (staff-only) and public threads
- Activity logging for all state changes (status, severity, assignment)
- User satisfaction ratings on resolved cases (1–5 stars)
- Admin analytics dashboard with KPIs, severity/category/status breakdowns, and trend charts
- Bulk operations: assign, status update, delete
- Comprehensive system health monitoring (10 automated checks with auto-case creation)
- API error rate tracking via middleware
- Team performance metrics (resolution times, ratings per staff member)
- Real-time notifications to admins on creation, to reporters on updates, to assignees on assignment

## Architecture

### Backend
- **Router (User)**: `src/routes/cases.ts` (528 LOC) — 6 route handlers mounted at `/cases`
- **Router (Admin)**: `src/routes/adminCases.ts` (432 LOC) — 13 route handlers mounted at `/admin/cases`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; no dedicated service layer
- **Validation**: Zod schemas for case creation, updates, comments, and ratings
- **AI**: `caseAnalyzer.ts` service for component identification from page context
- **Health**: `healthMonitor.ts` service — comprehensive 10-check health monitoring with auto-case creation (~614 LOC)
- **API Error Tracking**: `apiErrorTracker.ts` middleware — intercepts 5xx responses and feeds them to health monitor
- **Notifications**: `notificationService.ts` for case lifecycle events

### Frontend
- **List Page**: `src/pages/general/CasesList.tsx` (301 LOC) — DataTable with filters and bulk delete
- **Detail Page**: `src/pages/general/CaseDetailView.tsx` (463 LOC) — full case detail with comments, activity, rating
- **Admin Management**: `src/pages/admin/AdminCaseManagement.tsx` (~1015 LOC) — admin case list, health dashboard with rich check cards, auto-refresh
- **Dashboard**: `src/pages/cases/CasesDashboard.tsx` (516 LOC) — admin analytics with KPIs and charts
- **Model**: `src/models/CaseModel.ts` (126 LOC) — static API wrapper (18 methods)
- **Types**: `src/types/cases.ts` (~140 LOC) — TypeScript interfaces and enums incl. `HealthCheck`, `HealthStatus`
- **State**: Zustand store (user context) + local component state

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Request validation |
| `caseAnalyzer` | AI-powered component identification |
| `healthMonitor` | Comprehensive system health monitoring (10 checks, auto-case creation) |
| `apiErrorTracker` | Middleware that feeds 5xx errors to healthMonitor |
| `notificationService` | Case lifecycle notifications |
| `requireAdmin` middleware | Admin route protection |
| `TanStack React Table` | Case list DataTable |
| `SweetAlert2` | Delete confirmations, user feedback |
| `Heroicons` | Status/severity/category icons |
| `react-router-dom` | Case detail routing |

## Database Tables

| Table | Purpose |
|-------|---------|
| `cases` | Case header records (title, severity, status, reporter, assignee, resolution) |
| `case_comments` | Comment threads per case (public + internal) |
| `case_activity` | Audit log of all state changes per case |
| `users` | Reporter/assignee lookup via JOIN |
| `user_roles` / `roles` | Admin access verification |
| `system_health_checks` | Health check state — status, consecutive failures, last check time, linked case_id |

## Status Values

| Value | Label | Badge Color |
|-------|-------|-------------|
| `open` | Open | Blue |
| `in_progress` | In Progress | Yellow |
| `waiting` | Waiting | Purple |
| `resolved` | Resolved | Green |
| `closed` | Closed | Gray |
| `wont_fix` | Won't Fix | Gray |

## Severity Values

| Value | Label | Badge Color | Dot Color |
|-------|-------|-------------|-----------|
| `low` | Low | Green | `bg-green-500` |
| `medium` | Medium | Yellow | `bg-yellow-500` |
| `high` | High | Orange | `bg-orange-500` |
| `critical` | Critical | Red | `bg-red-500` |

## Category Values

| Value | Label | Icon |
|-------|-------|------|
| `bug` | Bug | `BugAntIcon` (red) |
| `performance` | Performance | `ExclamationTriangleIcon` (orange) |
| `ui_issue` | UI Issue | `ExclamationTriangleIcon` (yellow) |
| `data_issue` | Data Issue | `ShieldExclamationIcon` (purple) |
| `security` | Security | `ShieldExclamationIcon` (dark red) |
| `feature_request` | Feature Request | `LightBulbIcon` (blue) |
| `other` | Other | `FlagIcon` (gray) |

## Key Data Flows

### Case Creation (User)
```
Frontend (floating Report Issue button)
  → POST /cases (Zod validated)
  → Generate case_number (CASE-XXXXXXXX)
  → If page context provided → AI analyzeComponentFromContext()
  → INSERT into cases (with ai_analysis JSON)
  → INSERT into case_activity (action: 'created')
  → Notify all admins via notificationService
  → Return created case with mapCaseRow()
```

### Case Detail View
```
Frontend navigates to /cases/:id
  → GET /cases/:id
  → Fetch case with reporter/assignee/resolver JOINs
  → Check access (reporter or admin)
  → Fetch case_comments (exclude internal if not admin)
  → Fetch case_activity (last 50)
  → Return { case, comments, activity }
```

### Admin Analytics Dashboard
```
Frontend CasesDashboard loads
  → GET /admin/cases/analytics
  → 5 parallel SQL queries:
    1. COUNT totals (total, open, resolved)
    2. AVG resolution time (hours → formatted)
    3. GROUP BY severity
    4. GROUP BY category
    5. GROUP BY date (14-day trend)
  → Return flat { totalCases, openCases, resolvedCases, avgResolutionTime, bySeverity, byCategory, byStatus, recentTrend }
```

### Case Status Update
```
Frontend admin updates status
  → PATCH /cases/:id (Zod validated)
  → Check access (reporter or admin)
  → UPDATE cases SET status, resolved_at, resolved_by
  → INSERT case_activity (action: 'status_changed')
  → Notify reporter via notificationService
  → Return updated case
```

### Case Deletion (Admin)
```
Frontend admin clicks Delete
  → SweetAlert2 confirmation
  → DELETE /admin/cases/:id (or POST /admin/cases/bulk-delete)
  → DELETE case_comments WHERE case_id
  → DELETE case_activity WHERE case_id
  → DELETE cases WHERE id
  → Return success
```
