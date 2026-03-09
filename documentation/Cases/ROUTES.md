# Cases — Route & API Reference

## Route Registration

**Backend mount points**:
- `/cases` — User-facing routes (all require JWT via `requireAuth`)
- `/admin/cases` — Admin routes (require JWT + admin role via `requireAdmin`)

```
src/routes/cases.ts      → casesRouter      mounted at /cases
src/routes/adminCases.ts → adminCasesRouter  mounted at /admin/cases
```

---

## Route Summary

### User Routes (`/cases`)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | POST | `/cases` | Create new case with AI analysis |
| 2 | GET | `/cases` | List current user's cases |
| 3 | GET | `/cases/:id` | Get case detail with comments & activity |
| 4 | PATCH | `/cases/:id` | Update case (reporter or admin) |
| 5 | POST | `/cases/:id/comments` | Add comment to case |
| 6 | POST | `/cases/:id/rate` | Rate case resolution (reporter only) |

### Admin Routes (`/admin/cases`)

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 7 | GET | `/admin/cases` | List all cases with filters + stats |
| 8 | GET | `/admin/cases/analytics` | Analytics dashboard data |
| 9 | POST | `/admin/cases/bulk-assign` | Bulk assign cases to user |
| 10 | POST | `/admin/cases/bulk-update-status` | Bulk update case status |
| 11 | GET | `/admin/cases/health` | System health status |
| 12 | POST | `/admin/cases/health/run-checks` | Trigger manual health checks |
| 13 | GET | `/admin/cases/team-performance` | Team performance metrics |
| 14 | POST | `/admin/cases/bulk-delete` | Bulk delete cases |
| 15 | DELETE | `/admin/cases/:id` | Delete single case |

**Note**: Admin route count corrected to 13 handlers (was listed as 10 previously)

---

## Detailed Route Documentation

### 1. POST `/cases`
**Purpose**: Create a new case with optional AI component analysis  
**Auth**: JWT required  
**Body**: Validated with `CreateCaseSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Case title (5–255 chars) |
| `description` | `string` | No | Detailed description |
| `category` | `enum` | No | Default: `'other'` |
| `severity` | `enum` | No | Default: `'medium'` |
| `source` | `enum` | No | Default: `'user_report'` |
| `url` | `string` | No | URL where issue occurred |
| `page_path` | `string` | No | Route path |
| `component_name` | `string` | No | React component name |
| `error_message` | `string` | No | Error text |
| `error_stack` | `string` | No | Stack trace |
| `user_agent` | `string` | No | Browser user agent |
| `browser_info` | `object` | No | Parsed browser info |
| `metadata` | `object` | No | Arbitrary metadata |
| `tags` | `string[]` | No | Tag array |

**Flow**:
1. Zod validate request body
2. Generate UUID `caseId` and `case_number` (CASE-XXXXXXXX from timestamp)
3. If page context provided → call `analyzeComponentFromContext()` (catches errors gracefully)
4. INSERT into `cases` with all fields + serialized JSON columns
5. INSERT into `case_activity` (action: `'created'`)
6. Query all admin users and send `case_created` notification to each
7. Fetch created case and return with `mapCaseRow()`

**Response** `201`:
```json
{
  "success": true,
  "case": { /* mapped Case object */ }
}
```

---

### 2. GET `/cases`
**Purpose**: List current user's own cases  
**Auth**: JWT required  
**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | — | Filter by status |

**SQL**:
```sql
SELECT c.*, COALESCE(u.name, u.email) AS reported_by_name,
       COALESCE(a.name, a.email) AS assigned_to_name
FROM cases c
LEFT JOIN users u ON c.reported_by = u.id
LEFT JOIN users a ON c.assigned_to = a.id
WHERE c.reported_by = ?
[AND c.status = ?]
ORDER BY c.created_at DESC
```

**Response** `200`:
```json
{
  "success": true,
  "cases": [{ /* mapped Case objects */ }]
}
```

⚠️ **Note**: No pagination implemented server-side despite frontend expecting `pagination` object.

---

### 3. GET `/cases/:id`
**Purpose**: Get full case detail with comments and activity log  
**Auth**: JWT required (reporter or admin)

**Flow**:
1. Fetch case with reporter/assignee/resolver JOINs
2. Check access: `reported_by === userId` or user has admin role
3. Fetch comments (exclude `is_internal = TRUE` if not admin)
4. Fetch activity log (last 50 entries, descending)
5. Parse JSON columns via `safeJson()`

**SQL (case)**:
```sql
SELECT c.*, COALESCE(u.name, u.email) AS reported_by_name, u.email AS reported_by_email,
       COALESCE(a.name, a.email) AS assigned_to_name, COALESCE(r.name, r.email) AS resolved_by_name
FROM cases c
LEFT JOIN users u ON c.reported_by = u.id
LEFT JOIN users a ON c.assigned_to = a.id
LEFT JOIN users r ON c.resolved_by = r.id
WHERE c.id = ?
```

**Response** `200`:
```json
{
  "success": true,
  "case": { /* mapped Case object */ },
  "comments": [{ "id": "...", "comment": "...", "user_name": "Admin", "is_internal": false }],
  "activity": [{ "id": "...", "action": "status_changed", "old_value": "open", "new_value": "resolved" }]
}
```

---

### 4. PATCH `/cases/:id`
**Purpose**: Update case fields (reporter or admin)  
**Auth**: JWT required  
**Body**: Validated with `UpdateCaseSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Updated title |
| `description` | `string` | No | Updated description |
| `severity` | `enum` | No | Updated severity |
| `status` | `enum('open', 'in_progress', 'resolved', 'closed', 'wont_fix')` | No | Updated status (triggers resolved_at/resolved_by if resolved/closed) |
| `assigned_to` | `string` | No | UUID of assignee |
| `resolution` | `string` | No | Resolution description |
| `tags` | `string[]` | No | Updated tags |

**Flow**:
1. Zod validate; fetch existing case
2. Check access (reporter or admin)
3. Build dynamic UPDATE query from provided fields
4. If `status` → log `status_changed` activity; if resolved/closed → set `resolved_at`, `resolved_by`
5. If `assigned_to` → log `assigned` activity; notify assignee
6. If `severity` → log `severity_changed` activity
7. Notify reporter if status changed by someone else

**Response** `200`:
```json
{
  "success": true,
  "case": { /* mapped updated Case */ }
}
```

---

### 5. POST `/cases/:id/comments`
**Purpose**: Add a comment to a case  
**Auth**: JWT required  
**Body**: Validated with `AddCommentSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comment` | `string` | Yes | Comment text |
| `is_internal` | `boolean` | No | Internal-only flag (default: false) |
| `attachments` | `string[]` | No | Attachment URLs |

**Flow**:
1. Verify case exists
2. INSERT into `case_comments`
3. Log `commented` activity (first 100 chars of comment)
4. If not internal and commenter ≠ reporter → notify reporter

**Response** `201`:
```json
{
  "success": true,
  "comment": { "id": "...", "comment": "...", "user_name": "Admin", "is_internal": false, "attachments": [] }
}
```

---

### 6. POST `/cases/:id/rate`
**Purpose**: Rate a resolved case (reporter only)  
**Auth**: JWT required (reporter only)  
**Body**: Validated with `RateCaseSchema`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rating` | `number` | Yes | 1–5 stars |
| `rating_comment` | `string` | No | Feedback text |

**Flow**:
1. Verify case exists
2. Check `reported_by === userId` → 403 if not reporter
3. UPDATE `cases` SET `rating`, `rating_comment`
4. Log `rated` activity

**Response** `200`:
```json
{ "success": true, "message": "Rating submitted successfully" }
```

---

### 7. GET `/admin/cases`
**Purpose**: List all cases with filters and summary stats  
**Auth**: JWT + Admin required  
**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | — | Filter by status |
| `severity` | `string` | — | Filter by severity |
| `type` | `string` | — | Filter by type |
| `assigned_to` | `string` | — | Filter by assignee UUID |
| `search` | `string` | — | Search title, description, case_number |

**Response** `200`:
```json
{
  "success": true,
  "cases": [{ /* mapped Case objects with comment_count */ }],
  "stats": {
    "total": 4, "open": 0, "in_progress": 0, "resolved": 4,
    "critical": 0, "auto_detected": 0, "avg_rating": 4.5
  }
}
```

---

### 8. GET `/admin/cases/analytics`
**Purpose**: Analytics dashboard data — KPIs, breakdowns, trends  
**Auth**: JWT + Admin required

**SQL** (5 separate queries):
```sql
-- Core counts
SELECT COUNT(*) as totalCases,
       SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCases,
       SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolvedCases
FROM cases;

-- Avg resolution time
SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
FROM cases WHERE resolved_at IS NOT NULL;

-- By severity / category / status
SELECT severity, COUNT(*) as count FROM cases GROUP BY severity;
SELECT COALESCE(category, 'other') as category, COUNT(*) as count FROM cases GROUP BY category;
SELECT status, COUNT(*) as count FROM cases GROUP BY status;

-- 14-day trend
SELECT DATE(created_at) as date, COUNT(*) as count
FROM cases WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
GROUP BY DATE(created_at) ORDER BY date ASC;
```

**Response** `200`:
```json
{
  "success": true,
  "totalCases": 4, "openCases": 0, "resolvedCases": 4,
  "avgResolutionTime": "2h",
  "bySeverity": [{ "severity": "medium", "count": 3 }],
  "byCategory": [{ "category": "bug", "count": 2 }],
  "byStatus": [{ "status": "resolved", "count": 4 }],
  "recentTrend": [{ "date": "2026-03-01", "count": 2 }]
}
```

---

### 9. POST `/admin/cases/bulk-assign`
**Purpose**: Assign multiple cases to a single user  
**Auth**: JWT + Admin required  
**Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `case_ids` | `string[]` | Yes | Array of case UUIDs |
| `assigned_to` | `string` | Yes | Assignee UUID |

**Flow**: Loop through case_ids → UPDATE assigned_to → log `assigned` activity each

---

### 10. POST `/admin/cases/bulk-update-status`
**Purpose**: Update status of multiple cases  
**Auth**: JWT + Admin required  
**Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `case_ids` | `string[]` | Yes | Array of case UUIDs |
| `status` | `enum('open', 'in_progress', 'resolved', 'closed', 'wont_fix')` | Yes | New status value |
| `resolution` | `string` | No | Optional resolution description |

**Flow**: Loop through case_ids → UPDATE status (+ resolved_at/resolved_by if resolving) → log activity → notify reporters

---

### 11. GET `/admin/cases/health`
**Purpose**: Get comprehensive system health status with 10 automated checks  
**Auth**: JWT + Admin required

**Response** `200`:
```json
{
  "success": true,
  "health": {
    "overall_status": "healthy",
    "total_checks": 10,
    "healthy": 9,
    "warning": 1,
    "error": 0,
    "unknown": 0,
    "checks": [
      {
        "check_type": "database",
        "check_name": "MySQL Connection",
        "status": "healthy",
        "details": { "connection": true, "response_time_ms": 2 },
        "consecutive_failures": 0,
        "case_id": null,
        "last_checked": "2025-06-03T10:30:00.000Z"
      },
      {
        "check_type": "memory",
        "check_name": "Memory Usage",
        "status": "warning",
        "details": {
          "heap_used_mb": 312,
          "heap_total_mb": 450,
          "heap_percent": 69,
          "system_total_gb": 35,
          "system_used_percent": 42
        },
        "consecutive_failures": 0,
        "case_id": null,
        "last_checked": "2025-06-03T10:30:00.000Z"
      }
    ]
  }
}
```

**Health Check Types** (10 total):
| Check Type | Check Name | What It Monitors |
|------------|-----------|-------------------|
| `database` | MySQL Connection | `SELECT 1` connectivity test |
| `api_errors` | API Error Rate | 5xx error count in last 5 minutes (from in-memory buffer) |
| `process` | Backend Process | Backend PID file and process existence |
| `memory` | Memory Usage | V8 heap (error: >500MB AND >95%) + system RAM (error: >95%) |
| `disk` | Disk Space | `df -h /` usage (error: >95%, warning: >85%) |
| `authentication` | Authentication Service | Internal API call to `/api/auth/health` |
| `worker` | Ingestion Worker | Ingestion worker process alive check |
| `service` | Ollama Service | Ollama HTTP health check |
| `ingestion` | Ingestion Queue | Pending ingestion items count in DB |
| `enterprise` | Enterprise Endpoints | Enterprise endpoint validation |

**Status values**: `healthy`, `warning`, `error`, `unknown`  
**Overall logic**: `error` if any check is `error`; `warning` if any is `warning`; else `healthy`  
**Auto-case creation**: After 3 consecutive `error` checks or 5 consecutive `warning` checks

---

### 12. POST `/admin/cases/health/run-checks`
**Purpose**: Trigger manual health checks (fire-and-forget — runs all 10 checks asynchronously)  
**Auth**: JWT + Admin required

**Behavior**:
1. Calls `runHealthChecks()` which executes all 10 checks in parallel
2. Each check result is persisted to `system_health_checks` table
3. Auto-creates/resolves cases based on consecutive failure thresholds
4. Frontend should re-fetch `GET /admin/cases/health` after a short delay to see updated results

**Response** `200`:
```json
{ "success": true, "message": "Health checks triggered" }
```

---

### 13. GET `/admin/cases/team-performance`
**Purpose**: Team performance metrics — cases assigned, resolved, avg times  
**Auth**: JWT + Admin required

**SQL**:
```sql
SELECT u.id, COALESCE(u.name, u.email) AS name, u.email,
       COUNT(c.id) as total_assigned,
       SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) as resolved,
       SUM(CASE WHEN c.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
       AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.resolved_at)) as avg_resolution_hours,
       AVG(c.rating) as avg_rating
FROM users u LEFT JOIN cases c ON c.assigned_to = u.id
WHERE u.id IN (SELECT DISTINCT user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.slug IN ('admin','super_admin','developer','qa_specialist'))
GROUP BY u.id, u.name, u.email ORDER BY total_assigned DESC
```

---

### 14. POST `/admin/cases/bulk-delete`
**Purpose**: Bulk delete cases with cascading cleanup  
**Auth**: JWT + Admin required  
**Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `case_ids` | `string[]` | Yes | Array of case IDs |

**Flow**: Loop → DELETE case_comments → DELETE case_activity → DELETE cases

---

### 15. DELETE `/admin/cases/:id`
**Purpose**: Delete a single case with cascading cleanup  
**Auth**: JWT + Admin required

**Flow**:
1. Verify case exists → 404 if not
2. DELETE case_comments WHERE case_id
3. DELETE case_activity WHERE case_id
4. DELETE cases WHERE id

---

## Frontend Route Mapping

| URL Path | Component | Description |
|----------|-----------|-------------|
| `/cases` | `CasesList.tsx` | List user's cases with filters |
| `/cases/:id` | `CaseDetailView.tsx` | Case detail with comments, activity, rating |
| `/admin/cases` | `AdminCaseManagement.tsx` | Admin case list with health dashboard |
| `/admin/cases/analytics` | `CasesDashboard.tsx` | Admin analytics dashboard |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|-----------------|-------------|------|---------------|
| Load case list | `CaseModel.getMyCases()` | GET | `/cases` |
| View case detail | `CaseModel.getById(id)` | GET | `/cases/:id` |
| Report new case | `CaseModel.create(data)` | POST | `/cases` |
| Update case | `CaseModel.update(id, data)` | PATCH | `/cases/:id` |
| Add comment | `CaseModel.addComment(id, comment)` | POST | `/cases/:id/comments` |
| Rate case | `CaseModel.rate(id, rating, feedback)` | POST | `/cases/:id/rate` |
| Admin list all | `CaseModel.adminGetAll(params)` | GET | `/admin/cases` |
| Load analytics | `CaseModel.getAnalytics()` | GET | `/admin/cases/analytics` |
| Bulk assign | `CaseModel.bulkAssign(ids, userId)` | POST | `/admin/cases/bulk-assign` |
| Bulk update status | `CaseModel.bulkUpdateStatus(ids, status)` | POST | `/admin/cases/bulk-update-status` |
| Get health status | `CaseModel.getHealthStatus()` | GET | `/admin/cases/health` |
| Run health checks | `CaseModel.runHealthChecks()` | POST | `/admin/cases/health/run-checks` |
| Team performance | `CaseModel.getTeamPerformance()` | GET | `/admin/cases/team-performance` |
| Delete case | `CaseModel.adminDelete(id)` | DELETE | `/admin/cases/:id` |
| Bulk delete | `CaseModel.bulkDelete(ids)` | POST | `/admin/cases/bulk-delete` |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| Create case | `cases.create` | Frontend: `<Can>` wrapper; Backend: `requireAuth` |
| View own cases | — | Backend: `WHERE reported_by = userId` |
| View any case | — | Backend: reporter check OR admin role check |
| Update case | — | Backend: reporter or admin check |
| Add comment | — | Backend: `requireAuth` (any authenticated user on accessible case) |
| Rate case | — | Backend: reporter-only check |
| Admin list/analytics | — | Backend: `requireAdmin` middleware |
| Bulk operations | — | Backend: `requireAdmin` middleware |
| Delete case | — | Frontend: `user?.is_admin` check; Backend: `requireAdmin` middleware |

> ⚠️ Frontend uses `<Can permission="cases.create">` for the report button, but backend does NOT enforce granular permissions — it only checks auth and admin role.
