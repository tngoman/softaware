# Cases — Field & Data Dictionary

## Database Schema: `cases` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `VARCHAR(36)` (PK) | No | — | `id` | UUID primary key |
| `case_number` | `VARCHAR(50)` (UNI) | No | — | `case_number` | Human-readable ID (e.g., "CASE-43391133") |
| `title` | `VARCHAR(255)` | No | — | `title` | Case summary title |
| `description` | `TEXT` | Yes | `NULL` | `description` | Detailed description |
| `severity` | `ENUM('low','medium','high','critical')` | Yes | `medium` | `severity` | Issue severity level |
| `status` | `ENUM('open','in_progress','resolved','closed','wont_fix')` | Yes | `open` | `status` | Current lifecycle status ⚠️ Frontend `CaseStatus` type missing `'wont_fix'` |
| `type` | `ENUM('user_reported','auto_detected','monitoring')` | Yes | `user_reported` | — | How the case was created (internal) |
| `category` | `ENUM('bug','performance','ui_issue','data_issue','security','feature_request','other')` | Yes | `other` | `category` | Issue category |
| `source` | `ENUM('user_report','auto_detected','health_monitor','ai_analysis')` | Yes | `user_report` | `source` | Derived from `type` by `mapCaseRow()` if NULL |
| `reported_by` | `VARCHAR(36)` (FK) | Yes | `NULL` | `reported_by` | User ID of reporter → `users.id` |
| `assigned_to` | `VARCHAR(36)` (FK) | Yes | `NULL` | `assigned_to` | User ID of assignee → `users.id` |
| `url` | `TEXT` | Yes | `NULL` | `page_url` | ⚠️ DB column is `url`, frontend expects `page_url` — mapped by `mapCaseRow()` |
| `page_path` | `VARCHAR(500)` | Yes | `NULL` | `page_path` | Route path where issue occurred |
| `component_name` | `VARCHAR(255)` | Yes | `NULL` | `component_name` | React component name (if identified) |
| `error_message` | `TEXT` | Yes | `NULL` | `error_message` | Error message text |
| `error_stack` | `TEXT` | Yes | `NULL` | `error_stack` | Error stack trace |
| `user_agent` | `TEXT` | Yes | `NULL` | — | Browser user-agent string |
| `browser_info` | `JSON` | Yes | `NULL` | `browser_info` | Parsed browser info object |
| `ai_analysis` | `JSON` | Yes | `NULL` | `ai_analysis` | AI component analysis result |
| `resolution` | `TEXT` | Yes | `NULL` | `resolution` | Resolution description |
| `resolved_at` | `DATETIME` | Yes | `NULL` | `resolved_at` | When the case was resolved |
| `resolved_by` | `VARCHAR(36)` (FK) | Yes | `NULL` | — | User ID of resolver → `users.id` |
| `rating` | `INT` | Yes | `NULL` | `user_rating` | ⚠️ DB column is `rating`, frontend expects `user_rating` — mapped by `mapCaseRow()` |
| `rating_comment` | `TEXT` | Yes | `NULL` | `user_feedback` | ⚠️ DB column is `rating_comment`, frontend expects `user_feedback` — mapped by `mapCaseRow()` |
| `metadata` | `JSON` | Yes | `NULL` | `metadata` | Arbitrary metadata object |
| `tags` | `JSON` | Yes | `NULL` | `tags` | Array of tag strings |
| `created_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` | `created_at` | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` (on update) | `updated_at` | Last modification timestamp |

### SQL Column Aliasing (via JOINs)
```sql
-- Reporter name (falls back to email if name is NULL)
COALESCE(u.name, u.email) AS reported_by_name
u.email AS reported_by_email

-- Assignee name
COALESCE(a.name, a.email) AS assigned_to_name

-- Resolver name (detail view only)
COALESCE(r.name, r.email) AS resolved_by_name
```

### Field Mapping (`mapCaseRow()`)
```typescript
// DB field → Frontend field
rating         → user_rating
rating_comment → user_feedback
url            → page_url
type           → source (derived: user_reported→user_report, auto_detected→auto_detected, monitoring→health_monitor)
category       → category (default: 'other')

// JSON columns (parsed via safeJson())
ai_analysis    → object | null
metadata       → object (default: {})
tags           → string[] (default: [])
browser_info   → object (default: {})
```

---

## Database Schema: `case_comments` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `VARCHAR(36)` (PK) | No | — | `id` | UUID primary key |
| `case_id` | `VARCHAR(36)` (FK) | No | — | `case_id` | Links to `cases.id` |
| `user_id` | `VARCHAR(36)` (FK) | Yes | `NULL` | `user_id` | Commenting user → `users.id` |
| `comment` | `TEXT` | No | — | `comment` | Comment body text |
| `is_internal` | `TINYINT(1)` | Yes | `0` | `is_internal` | Internal (staff-only) flag |
| `attachments` | `JSON` | Yes | `NULL` | `attachments` | Array of attachment URLs |
| `created_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` | `created_at` | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` (on update) | `updated_at` | Last modification timestamp |

**JOIN alias**: `COALESCE(u.name, u.email) AS user_name`

---

## Database Schema: `case_activity` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `VARCHAR(36)` (PK) | No | — | `id` | UUID primary key |
| `case_id` | `VARCHAR(36)` (FK) | No | — | `case_id` | Links to `cases.id` |
| `user_id` | `VARCHAR(36)` (FK) | Yes | `NULL` | `user_id` | Acting user → `users.id` |
| `action` | `VARCHAR(50)` | No | — | `action` | Action type (created, status_changed, severity_changed, assigned, commented, rated) |
| `old_value` | `TEXT` | Yes | `NULL` | `old_value` | Previous value (for changes) |
| `new_value` | `TEXT` | Yes | `NULL` | `new_value` | New value (for changes) |
| `metadata` | `JSON` | Yes | `NULL` | `metadata` | Additional context |
| `created_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` | `created_at` | Activity timestamp |

**JOIN alias**: `COALESCE(u.name, u.email) AS user_name`

---

## Database Schema: `system_health_checks` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK, AUTO_INCREMENT) | No | — | Primary key |
| `check_type` | `ENUM(...)` | No | — | Check identifier (see values below) |
| `check_name` | `VARCHAR(255)` | No | — | Human-readable check name |
| `status` | `ENUM('healthy','warning','error','unknown')` | Yes | `'unknown'` | Current check status |
| `details` | `JSON` | Yes | `NULL` | Check-specific details (varies per type) |
| `consecutive_failures` | `INT` | Yes | `0` | Count of consecutive non-healthy results |
| `case_id` | `VARCHAR(36)` (FK) | Yes | `NULL` | Auto-created case ID → `cases.id` |
| `last_checked` | `DATETIME` | Yes | `NULL` | Last check execution time |
| `created_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` | Record creation time |
| `updated_at` | `DATETIME` | Yes | `CURRENT_TIMESTAMP` (on update) | Last modification time |

### `check_type` ENUM Values
| Value | Check Name | Description |
|-------|-----------|-------------|
| `database` | MySQL Connection | Database connectivity via `SELECT 1` |
| `api_errors` | API Error Rate | 5xx HTTP responses in last 5 minutes |
| `process` | Backend Process | Backend Node.js process health |
| `memory` | Memory Usage | V8 heap + system RAM usage |
| `disk` | Disk Space | Root filesystem usage |
| `authentication` | Authentication Service | Auth endpoint health |
| `worker` | Ingestion Worker | Ingestion worker process status |
| `service` | Ollama Service | Ollama AI service connectivity |
| `ingestion` | Ingestion Queue | Pending ingestion queue depth |
| `enterprise` | Enterprise Endpoints | Enterprise service availability |
| `email` | *(reserved)* | Email service — not yet implemented |
| `sms` | *(reserved)* | SMS service — not yet implemented |
| `payment` | *(reserved)* | Payment service — not yet implemented |

---

## Zod Validation Schemas

### `CreateCaseSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | Yes | min(5), max(255) |
| `description` | `string` | No | — |
| `category` | `enum` | No | Default: `'other'` |
| `severity` | `enum` | No | Default: `'medium'` |
| `source` | `enum` | No | Default: `'user_report'` |
| `url` | `string` | No | Must be valid URL |
| `page_url` | `string` | No | — |
| `page_path` | `string` | No | max(500) |
| `component_name` | `string` | No | max(255) |
| `error_message` | `string` | No | — |
| `error_stack` | `string` | No | — |
| `user_agent` | `string` | No | — |
| `browser_info` | `Record<string, any>` | No | — |
| `metadata` | `Record<string, any>` | No | — |
| `tags` | `string[]` | No | — |

### `UpdateCaseSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | No | min(5), max(255) |
| `description` | `string` | No | — |
| `severity` | `enum` | No | low/medium/high/critical |
| `status` | `enum` | No | open/in_progress/resolved/closed/wont_fix |
| `assigned_to` | `string` | No | UUID |
| `resolution` | `string` | No | — |
| `tags` | `string[]` | No | — |

### `AddCommentSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `comment` | `string` | Yes | min(1) |
| `is_internal` | `z.preprocess → boolean` | No | Default: `false`. Uses `z.preprocess()` to coerce multipart form-data string values (`"true"`, `"1"` → `true`; everything else → `false`). Required because `multer` sends all fields as strings. |
| `attachments` | `string[]` | No | Each must be valid URL |

### `RateCaseSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `rating` | `number` | Yes | int, min(1), max(5) |
| `rating_comment` | `string` | No | — |

---

## API Response Schemas

### Case Object (from `mapCaseRow()`)
```json
{
  "id": "uuid-string",
  "case_number": "CASE-43391133",
  "title": "Login button not responding",
  "description": "The login button on the homepage...",
  "category": "bug",
  "severity": "high",
  "status": "open",
  "source": "user_report",
  "page_url": "https://example.com/login",
  "page_path": "/login",
  "component_name": "LoginForm",
  "error_message": "TypeError: Cannot read property...",
  "user_rating": null,
  "user_feedback": null,
  "reporter_name": "Admin",
  "reporter_email": "admin@softaware.co.za",
  "assignee_name": null,
  "ai_analysis": { "component": "LoginForm", "confidence": 0.85 },
  "metadata": {},
  "tags": ["login", "critical"],
  "browser_info": { "name": "Chrome", "version": "120" },
  "created_at": "2026-03-04T10:00:00.000Z",
  "updated_at": "2026-03-04T10:00:00.000Z"
}
```

### Analytics Object (from `GET /admin/cases/analytics`)
```json
{
  "success": true,
  "totalCases": 4,
  "openCases": 0,
  "resolvedCases": 4,
  "avgResolutionTime": "2h",
  "bySeverity": [{ "severity": "medium", "count": 3 }, { "severity": "high", "count": 1 }],
  "byCategory": [{ "category": "bug", "count": 2 }, { "category": "other", "count": 2 }],
  "byStatus": [{ "status": "resolved", "count": 4 }],
  "recentTrend": [{ "date": "2026-03-01", "count": 2 }, { "date": "2026-03-02", "count": 1 }]
}
```

---

## Frontend TypeScript Types

### `Case` (from `types/cases.ts`)
```typescript
interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  category: CaseCategory;
  severity: CaseSeverity;
  status: CaseStatus;
  source: CaseSource;
  component_name?: string;
  component_path?: string;
  page_url?: string;
  page_path?: string;
  error_message?: string;
  error_stack?: string;
  browser_info?: string;
  tags?: string[];
  resolution?: string;
  user_rating?: number;
  user_feedback?: string;
  reported_by: number;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  reporter_name?: string;
  reporter_email?: string;
  assignee_name?: string;
  assignee_email?: string;
}
```

### `CaseAnalytics` (from `types/cases.ts`)
```typescript
interface CaseAnalytics {
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  avgResolutionTime: string;
  bySeverity: { severity: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentTrend: { date: string; count: number }[];
}
```

### `HealthCheck` (from `types/cases.ts`) — **NEW**
```typescript
interface HealthCheck {
  check_type: string;      // e.g. 'database', 'memory', 'api_errors'
  check_name: string;      // Human-readable label e.g. 'MySQL Connection'
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  details: Record<string, any>;  // Check-specific details (varies per check type)
  consecutive_failures: number;
  case_id: string | null;  // Linked case ID if auto-created
  last_checked: string;    // ISO 8601 timestamp
}
```

### `HealthStatus` (from `types/cases.ts`) — **REWRITTEN**
```typescript
interface HealthStatus {
  overall_status: 'healthy' | 'warning' | 'error' | 'unknown';
  total_checks: number;    // Always 10
  healthy: number;         // Count of healthy checks
  warning: number;         // Count of warning checks
  error: number;           // Count of error checks
  unknown: number;         // Count of unknown/never-run checks
  checks: HealthCheck[];   // Array of individual check results
}
```

> **Migration note**: The old `HealthStatus` had `overall: 'healthy' | 'degraded' | 'unhealthy'` with `checks: { name, status: 'pass' | 'fail', responseTime, error, lastChecked }[]` and `uptime: number`. The new shape is completely different — `overall_status` replaces `overall`, status values changed from pass/fail to healthy/warning/error/unknown, and individual checks now include `details`, `consecutive_failures`, and `case_id`.

---

## Frontend Component State

### `CasesList.tsx`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `cases` | `Case[]` | `[]` | Current page of cases |
| `loading` | `boolean` | `false` | Loading indicator |
| `pagination` | `{ page, limit, total }` | `{ 0, 10, 0 }` | Server-side pagination |
| `search` | `string` | `''` | Search query (unused — DataTable search disabled) |
| `statusFilter` | `string` | `''` | Status dropdown filter |
| `severityFilter` | `string` | `''` | Severity dropdown filter |

### `CaseDetailView.tsx`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `caseData` | `Case \| null` | `null` | Current case |
| `comments` | `CaseComment[]` | `[]` | Case comments |
| `activity` | `CaseActivity[]` | `[]` | Activity log |
| `loading` | `boolean` | `true` | Initial load indicator |
| `newComment` | `string` | `''` | Comment form text |
| `submittingComment` | `boolean` | `false` | Comment submit state |
| `rating` | `number` | `0` | Star rating selection |
| `hoverRating` | `number` | `0` | Star hover preview |
| `feedback` | `string` | `''` | Rating feedback text |
| `submittingRating` | `boolean` | `false` | Rating submit state |
| `activeTab` | `'comments' \| 'activity'` | `'comments'` | Active tab |

### `CasesDashboard.tsx`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `analytics` | `CaseAnalytics \| null` | `null` | Dashboard analytics data |
| `cases` | `Case[]` | `[]` | Recent cases |
| `loading` | `boolean` | `true` | Loading indicator |

### `AdminCaseManagement.tsx`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `healthStatus` | `HealthStatus \| null` | `null` | Comprehensive health status with 10 checks |
| `healthLoading` | `boolean` | `true` | Health data loading indicator |
| `runningChecks` | `boolean` | `false` | Spinner state for Run Health Checks button |
| `activeTab` | `string` | `'overview'` | Active management tab (overview/health/cases) |

**Auto-refresh**: When `activeTab === 'health'`, a `setInterval` re-fetches health status every 30 seconds.  
**CHECK_TYPE_CONFIG**: Constant mapping `check_type` → `{ icon, label, color, bgColor }` for all 10 check types.
