# Tasks Module — Data Schema

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Local MySQL tables** | 3 (task\_sources, local\_tasks, task\_sync\_log) |
| **Migration files** | 2 (021\_local\_tasks.ts, 022\_task\_enhancements.ts) |
| **External API entities** | 3 (tasks, comments, attachments) |
| **localStorage keys** | 6 patterns |
| **TypeScript interfaces** | 6+ (Software, Task, LocalTask, TaskSourceInfo, SyncLogEntry, NormalisedTask) |

**Important:** In v2.0, tasks are **synced into a local MySQL cache** (`local_tasks` table) for fast reads. Writes still go to the external APIs via the proxy router. The local database is the **source of truth for the read path**, while external APIs remain the source of truth for the write path.

---

## 2. Local MySQL Tables

### 2.1 `task_sources` — External Source Registry

**Migration:** `021_local_tasks.ts`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGINT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| name | VARCHAR(200) | — | — | Human-readable source name (UNIQUE) |
| source_type | VARCHAR(50) | — | `'tasks-api'` | `tasks-api` \| `software-proxy` \| `github` \| `jira` \| `manual` |
| base_url | VARCHAR(500) | — | — | Base URL for the external API |
| api_key | VARCHAR(500) | ✅ | NULL | API key or token for authentication |
| auth_method | VARCHAR(50) | — | `'api-key'` | `api-key` \| `bearer` \| `software-token` (⚠️ deprecated) \| `none` |
| auth_header | VARCHAR(100) | — | `'X-API-Key'` | Header name to send credentials in |
| software_id | INT UNSIGNED | ✅ | NULL | FK to software product (for software-proxy sources) |
| sync_enabled | TINYINT(1) | — | 1 | Whether auto-sync is active |
| sync_interval_min | INT UNSIGNED | — | 15 | Auto-sync interval in minutes (0 = manual only) |
| last_synced_at | DATETIME | ✅ | NULL | When this source was last synced |
| last_sync_status | VARCHAR(50) | ✅ | NULL | `success` \| `error` \| `partial` |
| last_sync_message | TEXT | ✅ | NULL | Status message from last sync |
| last_sync_count | INT UNSIGNED | ✅ | 0 | Tasks fetched in last sync |
| extra_config | JSON | ✅ | NULL | Source-specific config (scopes, filters, field mapping) |
| created_by | VARCHAR(36) | ✅ | NULL | Creator user ID |
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Record creation time |
| updated_at | DATETIME | — | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Indexes:** `uq_source_name` (UNIQUE on name), `idx_source_type`, `idx_sync_enabled`

---

### 2.2 `local_tasks` — Cached Task Data

**Migration:** `021_local_tasks.ts` + `022_task_enhancements.ts`

#### Core Fields (from sync)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGINT UNSIGNED | — | AUTO_INCREMENT | Local primary key |
| source_id | BIGINT UNSIGNED | — | — | FK → task\_sources.id (CASCADE on delete) |
| external_id | VARCHAR(100) | — | — | ID on the external system |
| title | VARCHAR(500) | — | — | Task title |
| description | TEXT | ✅ | NULL | HTML description |
| notes | TEXT | ✅ | NULL | Additional notes |
| status | VARCHAR(50) | — | `'new'` | `new` \| `in-progress` \| `completed` \| `pending` \| `progress` |
| type | VARCHAR(50) | — | `'general'` | `development` \| `feature` \| `bug-fix` \| `support` \| `general` \| `maintenance` |
| color | VARCHAR(20) | ✅ | `'#3788d8'` | Task colour |

#### Time Tracking

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| start_date | DATETIME | ✅ | NULL | Start date |
| end_date | DATETIME | ✅ | NULL | Due date / end date |
| actual_start | DATETIME | ✅ | NULL | Actual start timestamp |
| actual_end | DATETIME | ✅ | NULL | Actual end timestamp |
| hours | VARCHAR(20) | ✅ | `'00:00'` | Hours worked (HH:MM or decimal) |
| estimated_hours | DECIMAL(10,2) | ✅ | 0 | Estimated hours |

#### Assignment

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| assigned_to | INT UNSIGNED | ✅ | NULL | Assigned user ID |
| assigned_to_name | VARCHAR(200) | ✅ | NULL | Assigned user display name |
| created_by_name | VARCHAR(200) | ✅ | NULL | Creator display name |
| user_id | INT UNSIGNED | ✅ | 0 | Creator user ID |

#### Workflow

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| workflow_phase | VARCHAR(100) | ✅ | NULL | Current workflow phase |
| approval_required | TINYINT(1) | — | 0 | Whether approval is needed |
| approved_by | VARCHAR(200) | ✅ | NULL | Approver name |
| approved_at | DATETIME | ✅ | NULL | Approval timestamp |

#### Associations

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| parent_task_id | INT UNSIGNED | ✅ | NULL | Parent task ID |
| association_type | VARCHAR(50) | ✅ | NULL | Association type |
| association_notes | TEXT | ✅ | NULL | Association notes |
| task_order | INT | ✅ | 0 | Display order |
| order_number | VARCHAR(100) | ✅ | NULL | Order number reference |

#### Software / Module

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| software_id | INT UNSIGNED | ✅ | NULL | Parent software product ID |
| module_id | INT UNSIGNED | ✅ | NULL | Module ID |
| module_name | VARCHAR(200) | ✅ | NULL | Module display name |

#### Billing

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| task_billed | TINYINT(1) | — | 0 | `0` = unbilled, `1` = billed, `2` = staged for invoicing |
| task_bill_date | VARCHAR(50) | ✅ | NULL | Date billed |

#### Flags

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| task_direction | INT | ✅ | 0 | Task direction flag |
| task_dev | INT | ✅ | 0 | Development flag |
| task_deleted | TINYINT(1) | — | 0 | Soft-delete flag |

#### Sync Metadata

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| external_created_at | DATETIME | ✅ | NULL | created\_at on the remote system |
| external_updated_at | DATETIME | ✅ | NULL | updated\_at on the remote system |
| last_synced_at | DATETIME | — | CURRENT_TIMESTAMP | When this row was last refreshed from source |
| sync_hash | VARCHAR(64) | ✅ | NULL | SHA-256 of serialised remote task (skip update if unchanged) |
| local_dirty | TINYINT(1) | — | 0 | 1 = modified locally, needs push back to source |

#### Local Enhancements (never synced upstream)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| priority | VARCHAR(20) | — | `'normal'` | `urgent` \| `high` \| `normal` \| `low` |
| is_bookmarked | TINYINT(1) | — | 0 | User bookmark/favourite flag |
| color_label | VARCHAR(20) | ✅ | NULL | User-chosen colour tag (red, orange, green, blue, purple, etc.) |
| local_tags | JSON | ✅ | NULL | Array of freeform tag strings, e.g. `["frontend","urgent-fix"]` |
| kanban_order | INT | — | 0 | Sort order within a Kanban column |
| view_count | INT UNSIGNED | — | 0 | Times user opened this task |
| last_viewed_at | DATETIME | ✅ | NULL | When user last viewed this task |

#### Timestamps

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| created_at | DATETIME | — | CURRENT_TIMESTAMP | Record creation time |
| updated_at | DATETIME | — | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Constraints:**
- `FOREIGN KEY (source_id) REFERENCES task_sources(id) ON DELETE CASCADE`
- `UNIQUE KEY uq_source_external (source_id, external_id)`

**Indexes:** `idx_status`, `idx_type`, `idx_source`, `idx_sync_hash`, `idx_local_dirty`, `idx_deleted`, `idx_priority`, `idx_bookmarked`, `idx_kanban_order` (status + kanban_order), `idx_last_viewed`

---

### 2.3 `task_sync_log` — Sync History

**Migration:** `021_local_tasks.ts`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGINT UNSIGNED | — | AUTO_INCREMENT | Primary key |
| source_id | BIGINT UNSIGNED | — | — | FK → task\_sources.id (CASCADE) |
| started_at | DATETIME | — | CURRENT_TIMESTAMP | Sync start time |
| finished_at | DATETIME | ✅ | NULL | Sync end time |
| status | VARCHAR(50) | — | `'running'` | `running` \| `success` \| `error` \| `partial` |
| tasks_fetched | INT UNSIGNED | — | 0 | Total tasks fetched from source |
| tasks_created | INT UNSIGNED | — | 0 | New tasks inserted |
| tasks_updated | INT UNSIGNED | — | 0 | Existing tasks updated |
| tasks_unchanged | INT UNSIGNED | — | 0 | Tasks with matching hash (skipped) |
| tasks_deleted | INT UNSIGNED | — | 0 | Tasks soft-deleted (no longer in source) |
| error_message | TEXT | ✅ | NULL | Error details if sync failed |
| duration_ms | INT UNSIGNED | ✅ | NULL | Sync duration in milliseconds |

**Index:** `idx_source_started` (source_id, started_at DESC)

---

## 3. External API Entities

These are the data shapes returned by external APIs, consumed by the proxy router and frontend.

### 3.1 Task Entity (External)

**Source:** `GET {baseUrl}/api/tasks` → response items

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | number | — | Unique task identifier |
| title / task_name | string | — | Task name |
| description / task_description | string | ✅ | HTML description |
| status / task_status | string | — | `new`, `progress`, `completed`, `pending` |
| type / task_type | string | — | `development`, `bug-fix`, `feature`, `maintenance`, `support` |
| hours / task_hours | string | — | Actual hours (decimal or HH:MM) |
| estimated_hours / task_estimated_hours | string | ✅ | Estimated hours |
| created_at | string | ✅ | ISO 8601 timestamp |
| start | string | ✅ | Start date |
| due_date | string | ✅ | Due date |
| workflow_phase | string | ✅ | Workflow phase key |
| assigned_to | number | ✅ | Assigned user ID |
| assigned_to_name | string | ✅ | Assigned user display name |
| module_id | number | ✅ | Module ID |
| module_name | string | ✅ | Module display name |
| software_id | number | ✅ | Parent software ID |
| task_billed | number | ✅ | `0` or `1` |
| task_bill_date | string | ✅ | Date billed |
| approval_required | number | ✅ | `0` or `1` |
| task_order | number | ✅ | Display order |
| parent_task_id | number | ✅ | Parent task (for subtasks) |
| order_number | string | ✅ | Order number reference |

**Status Normalisation:** The sync service normalises `"progress"` → `"in-progress"` via `normaliseStatus()`. The `useTasks` hook also normalises on the frontend.

---

### 3.2 Comment Entity (External)

**Source:** `GET {baseUrl}/api/tasks/{id}/comments`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| comment_id | number | — | Unique comment identifier |
| content | string | — | Comment HTML content |
| user_name / username / created_by | string | ✅ | Author (multiple field fallbacks) |
| is_internal | number | — | `0` = public, `1` = internal |
| time_spent | string | ✅ | Hours spent (decimal string) |
| created_at | string | ✅ | ISO 8601 timestamp |
| parent_comment_id | number | ✅ | Parent comment (threading) |
| attachments | array | ✅ | Linked file attachments |

---

### 3.3 Attachment Entity (External)

**Source:** Nested in comment `attachments[]` or from `GET {baseUrl}/api/tasks-api/{id}/attachments`

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| attachment_id | number | — | Unique attachment identifier |
| task_id | number | — | Parent task ID |
| comment_id | number | ✅ | Linked comment ID (null for task-level attachments) |
| file_name | string | — | Original filename as uploaded by the user |
| file_path | string | — | Server-side filename (e.g. `task_132_1769417621_69772b9525928.docx`) |
| file_size | number | ✅ | File size in bytes |
| file_type | string | ✅ | File extension (e.g. `docx`, `png`) |
| mime_type | string | ✅ | MIME type (e.g. `image/png`, `application/pdf`) |
| download_url | string | — | **Public static URL** to the file (`/uploads/development/{file_path}`). No auth required — safe for `<img src>`, `<a href>`, and direct browser access |
| is_from_ticket | number | — | `1` if originally uploaded via helpdesk ticket converted to task |
| is_public | number | — | `1` if publicly accessible |
| uploaded_by | number | ✅ | Uploader user ID |
| uploaded_by_name | string | ✅ | Uploader display name |
| uploaded_at | string | ✅ | Upload timestamp |

---

## 4. TypeScript Interfaces

### 4.1 Task Interface (Frontend — types/index.ts)

```typescript
export interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: 'new' | 'in-progress' | 'completed' | 'progress' | 'pending';
  type: 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support';
  hours: string;
  estimatedHours?: string;
  estimated_hours?: number;
  created_at?: string;
  start?: string;
  end?: string;
  due_date?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  creator?: string;
  created_by_name?: string;
  workflow_phase?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  module_id?: number | null;
  module_name?: string | null;
  software_id?: number | null;
  task_bill_date?: string | null;
  task_billed?: number;
  approval_required?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  task_order?: number | null;
  parent_task_id?: number | null;
  association_type?: string | null;
  date?: string;
  time?: string;
  backgroundColor?: string;
  order_number?: string | null;

  // Local enhancement fields (v2.0)
  priority?: string;
  is_bookmarked?: number;
  color_label?: string | null;
  local_tags?: string[];
  kanban_order?: number;
  view_count?: number;
  last_viewed_at?: string | null;

  // Source tracking (v2.0)
  _local_id?: number;
  _source_id?: number;
  _source_name?: string;
  _local_dirty?: number;
  _last_synced_at?: string;
}
```

### 4.2 NormalisedTask Interface (Backend — taskSyncService.ts)

The sync service's intermediate format. All adapters normalise external tasks into this shape before upserting into `local_tasks`.

```typescript
export interface NormalisedTask {
  external_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: string;
  type: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  hours: string | null;
  estimated_hours: number;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by_name: string | null;
  user_id: number;
  workflow_phase: string | null;
  approval_required: number;
  approved_by: string | null;
  approved_at: string | null;
  parent_task_id: number | null;
  association_type: string | null;
  association_notes: string | null;
  task_order: number;
  order_number: string | null;
  software_id: number | null;
  module_id: number | null;
  module_name: string | null;
  task_billed: number;
  task_bill_date: string | null;
  task_direction: number;
  task_dev: number;
  task_deleted: number;
  external_created_at: string | null;
  external_updated_at: string | null;
}
```

### 4.3 TaskSource Interface (Backend — taskSyncService.ts)

```typescript
export interface TaskSource {
  id: number;
  name: string;
  source_type: string;
  base_url: string;
  api_key: string | null;
  auth_method: string;
  auth_header: string;
  software_id: number | null;
  sync_enabled: number;
  sync_interval_min: number;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_sync_count: number;
  extra_config: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

### 4.4 LocalTask Interface (Frontend — useLocalTasks.ts)

```typescript
export interface LocalTask {
  id: number;
  source_id: number;
  external_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: string;
  type: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  hours: string | null;
  estimated_hours: number;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by_name: string | null;
  workflow_phase: string | null;
  approval_required: number;
  approved_by: string | null;
  approved_at: string | null;
  software_id: number | null;
  module_id: number | null;
  module_name: string | null;
  task_billed: number;
  task_bill_date: string | null;
  task_deleted: number;
  local_dirty: number;
  last_synced_at: string;
  source_name: string;
  source_type: string;
  created_at: string;
  updated_at: string;
}
```

---

## 5. localStorage Schema

| Key Pattern | Value | Set By | Read By |
|-------------|-------|--------|---------|
| `tasksViewMode` | `"list"` or `"kanban"` | TasksPage view toggle | TasksPage (init) |
| `tasksFontSize` | `"sm"`, `"md"`, or `"lg"` | TaskToolbar font size picker | TasksPage (init), default: `"sm"` |
| `selectedTasksSoftware` | JSON `Software` object | TasksPage software selector | TasksPage (init) |
| `softaware_view_as_role` | Role slug string | Profile.tsx view-as dropdown | workflowPermissions.ts |
| `openTaskId` | Task ID string | Dashboard.tsx task click | TasksPage (auto-open on load) |
| `software_token_{id}` | JWT string | ⚠️ **DEPRECATED (v2.2.0)** — Legacy auth flow | softwareAuth.ts (legacy, no longer active) |

---

## 6. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    localStorage                               │
│                                                               │
│  tasksViewMode      ─── list / kanban                        │
│  tasksFontSize      ─── sm / md / lg                         │
│  selectedTasksSoftware ─ JSON Software object                │
│  softaware_view_as_role ─ role slug                          │
│  openTaskId         ─── task ID for auto-open                │
│  software_token_{id} ─ legacy external tokens                │
└─────────────────────────────────────────────────────────────-┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│            Frontend (React)                                   │
│                                                               │
│  READ PATH:                                                   │
│    useTasks hook → GET /api/local-tasks                      │
│    (paginated, filterable, normalised)                        │
│                                                               │
│  WRITE PATH:                                                  │
│    TaskDialog → POST/PUT /api/softaware/tasks                │
│    Comments   → POST/GET/DELETE /api/softaware/tasks/:id/... │
│    Attachments→ POST/GET/DELETE /api/softaware/tasks/:id/... │
│    Enhancements→ PATCH /api/local-tasks/:id/...              │
│    Invoicing  → POST /api/local-tasks/invoice/...            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│            Backend (Express)                                  │
│                                                               │
│  /api/local-tasks    → localTasks.ts                         │
│    Queries local_tasks table directly                         │
│    Manages sources, sync, enhancements, invoicing            │
│                                                               │
│  /api/softaware/tasks → softawareTasks.ts                    │
│    resolveTaskSource() → task_sources table → apiKey          │
│    proxyToExternal() → external API with X-API-Key header    │
│                                                               │
│  AI Assistant → mobileActionExecutor.ts (v2.2.0)             │
│    resolveTaskSourceForTools() → task_sources → apiKey        │
│    taskProxyV2() → external API with X-API-Key header        │
│    22 task tool handlers (same dual-path architecture)        │
│                                                               │
│  taskSyncService.ts                                           │
│    Pull: fetch from external → upsert into local_tasks       │
│    Push: push dirty tasks → external API                     │
│    Hash: SHA-256 change detection                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
               ┌───────────┼──────────┐
               ▼           ▼          ▼
       ┌────────────┐ ┌─────────┐ ┌─────────┐
       │  MySQL DB   │ │PHP Tasks│ │Software │
       │             │ │API      │ │Product  │
       │ local_tasks │ │(X-API-  │ │APIs     │
       │ task_sources│ │  Key)   │ │(X-API-  │
       │ task_sync_  │ │         │ │  Key)   │
       │   log       │ │         │ │         │
       └─────────────┘ └─────────┘ └─────────┘
```
