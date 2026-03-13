# Tasks v2.0 — Mobile App Migration Guide

> **Version:** 2.2.1 · Last updated: March 10, 2026  
> **Audience:** Mobile app developer (React Native / Flutter / Native)  
> **API Base URL:** `https://mcp.softaware.net.za/api`  
> **Replaces:** MOBILE_APP_SPECIFICATION.md §10 (Tasks API)

---

## TL;DR — What Changed

| Before (v1.x) | After (v2.0) |
|----------------|--------------|
| Two-token auth (JWT + `X-Software-Token`) | Single-token auth (JWT only) |
| `POST /softaware/tasks/authenticate` with username/password/OTP | **Removed** — no-op stub, returns `{ success: true, token: null }` |
| `GET /softaware/tasks?apiUrl=…` for reading | `GET /local-tasks?software_id=…` for reading |
| External API latency on every read | Local database reads (instant) |
| No local enhancements | Priority, bookmarks, tags, colour labels, kanban order |
| No sync concept | Background sync engine keeps local cache up to date |
| Writes via `X-Software-Token` | Writes via `/softaware/tasks` with `software_id` (API key resolved server-side) |
| Attachment URLs constructed manually | Attachment API returns `download_url` — public static path, no auth needed for `<Image>` |

**Bottom line:** Reading tasks is faster and richer. Writing tasks works the same way but is simpler (no software token management). You get new features for free (priority, bookmarks, tags). Attachments now return ready-to-use `download_url` values for direct image rendering.

---

## Table of Contents

1. [Remove Software Token Auth](#1-remove-software-token-auth)
2. [Switch Read Path to Local Tasks](#2-switch-read-path-to-local-tasks)
3. [Update Write Path (Proxy)](#3-update-write-path-proxy)
4. [New: Local Enhancement Endpoints](#4-new-local-enhancement-endpoints)
5. [New: Sync Management](#5-new-sync-management)
6. [New: Invoice Staging](#6-new-invoice-staging)
7. [New: Workflow Actions](#7-new-workflow-actions)
8. [New: Comment & Attachment Additions](#8-new-comment--attachment-additions)
9. [New: Orders & Billing](#9-new-orders--billing)
10. [Updated Data Models](#10-updated-data-models)
11. [Screen-by-Screen Migration Checklist](#11-screen-by-screen-migration-checklist)
12. [Error Handling Changes](#12-error-handling-changes)
13. [Offline Strategy](#13-offline-strategy)

---

## 1. Remove Software Token Auth

### What to Remove

1. **Delete the software authentication flow entirely:**
   - Remove `POST /softaware/tasks/authenticate` calls
   - Remove OTP verification screen/logic
   - Remove storage of `software_token_<id>` (SecureStore / SharedPreferences / Keychain)
   - Remove `X-Software-Token` header injection from your API interceptor

2. **Remove the "Authenticate" button/screen** that appeared when selecting a software product.

### What Replaces It

**Nothing on the mobile side.** API keys are now stored server-side in the `task_sources` table. The backend resolves them automatically from `software_id`.

### Before (v1.x)

```
Headers: {
  "Authorization": "Bearer <jwt>",
  "X-Software-Token": "<software_token>"
}
```

### After (v2.0)

```
Headers: {
  "Authorization": "Bearer <jwt>"
}
```

That's it. Just the JWT. Every task endpoint.

### Backward Compatibility

If you send `X-Software-Token`, it will be silently ignored — no errors. You can remove it at your own pace, but it does nothing.

---

## 2. Switch Read Path to Local Tasks

This is the **most important change.** All task reading now goes to a different endpoint.

### Before (v1.x)

```
GET /softaware/tasks?apiUrl=https://portal.example.com&page=1&limit=1000
Headers: Authorization + X-Software-Token
```

### After (v2.0)

```
GET /local-tasks?software_id=5&page=1&limit=50
Headers: Authorization only
```

### Key Differences

| Aspect | Old | New |
|--------|-----|-----|
| Endpoint | `/softaware/tasks` | `/local-tasks` |
| Filter by | `apiUrl` query param | `software_id` query param |
| Page size | Default 1000 | Default 50, max 200 |
| Response shape | External API pass-through | Standardised `{ status, message, data }` |
| Extra fields | None | Priority, bookmarks, tags, colour labels, source info |

### New Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Page size (max 200) |
| `status` | string | `all` | `new` \| `in-progress` \| `completed` \| `pending` \| `all` |
| `type` | string | `all` | `development` \| `bug-fix` \| `feature` \| `maintenance` \| `support` \| `all` |
| `software_id` | number | — | Filter by software product |
| `source_id` | number | — | Filter by task source |
| `search` | string | — | Search title, description, external_id |
| `date_from` | string | — | ISO date (e.g. `2026-03-01`) |
| `date_to` | string | — | ISO date |
| `exclude_billed` | `"1"` | — | Exclude billed tasks |
| `workflow_phase` | string | `all` | Filter by workflow phase |
| `priority` | string | `all` | `urgent` \| `high` \| `normal` \| `low` |
| `bookmarked` | `"1"` | — | Only bookmarked tasks |
| `color_label` | string | — | Filter by colour label |
| `tag` | string | — | Filter by tag |

### New Response Shape

```json
{
  "status": 1,
  "message": "Success",
  "data": {
    "tasks": [
      {
        "id": 42,
        "source_id": 1,
        "external_id": "157",
        "title": "Fix login bug",
        "description": "<p>Users cannot log in...</p>",
        "notes": null,
        "status": "in-progress",
        "type": "bug-fix",
        "color": "#3788d8",
        "start_date": "2026-03-01 00:00:00",
        "end_date": "2026-03-05 00:00:00",
        "actual_start": "2026-03-01 09:00:00",
        "actual_end": null,
        "hours": "3.50",
        "estimated_hours": 4.00,
        "assigned_to": 5,
        "assigned_to_name": "John Developer",
        "created_by_name": "Admin User",
        "user_id": 1,
        "workflow_phase": "development",
        "approval_required": 0,
        "approved_by": null,
        "approved_at": null,
        "parent_task_id": null,
        "association_type": null,
        "task_order": 1,
        "order_number": null,
        "software_id": 5,
        "module_id": 2,
        "module_name": "Authentication",
        "task_billed": 0,
        "task_bill_date": null,
        "task_deleted": 0,
        "local_dirty": 0,
        "last_synced_at": "2026-03-10 08:15:00",
        "sync_hash": "a1b2c3d4...",
        "priority": "high",
        "is_bookmarked": 1,
        "color_label": "red",
        "local_tags": "[\"frontend\", \"urgent-fix\"]",
        "kanban_order": 2,
        "view_count": 7,
        "last_viewed_at": "2026-03-10 08:00:00",
        "source_name": "Softaware Tasks",
        "source_type": "tasks-api",
        "created_at": "2026-03-01 08:00:00",
        "updated_at": "2026-03-10 08:15:00"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 50,
      "total": 142,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### Field Mapping (Old → New)

Use this table to update your model/parser:

| Old field (from proxy) | New field (from local-tasks) | Notes |
|------------------------|------------------------------|-------|
| `id` | `external_id` | Use `external_id` as the task ID for write operations |
| — | `id` | New: local database primary key (use for enhancement endpoints) |
| `title` / `task_name` | `title` | Already normalised |
| `description` / `task_description` | `description` | Already normalised |
| `status` (`"progress"`) | `status` (`"in-progress"`) | Already normalised server-side |
| `type` / `task_type` | `type` | Already normalised |
| `hours` / `task_hours` | `hours` | String |
| `estimatedHours` | `estimated_hours` | Now a number, not string |
| `start` / `task_start` | `start_date` | Renamed |
| `due_date` / `end` | `end_date` | Renamed |
| `created_at` | `external_created_at` | Original timestamp from external system |
| — | `created_at` | Local record creation time |
| `creator` / `created_by_name` | `created_by_name` | Already normalised |
| `backgroundColor` | `color` | Renamed |
| — | `priority` | **New** — `urgent` / `high` / `normal` / `low` |
| — | `is_bookmarked` | **New** — `0` or `1` |
| — | `color_label` | **New** — colour name string or null |
| — | `local_tags` | **New** — JSON array string, parse it |
| — | `source_name` | **New** — which external source this came from |
| — | `local_dirty` | **New** — `1` if modified locally, pending push |

### Pagination Change

**Old:** Check `has_next` in `data.data` (nested), fetch all in one go (limit 1000).

**New:** Proper pagination with `data.pagination` object. Recommended approach:
- Use `limit=50` for initial load
- Implement infinite scroll / load-more using `has_next`
- Or fetch all pages in a loop for offline caching (max `limit=200` per page)

### Code Example — React Native

```typescript
// OLD
const fetchTasks = async (softwareToken: string, apiUrl: string) => {
  const res = await api.get('/softaware/tasks', {
    headers: { 'X-Software-Token': softwareToken },
    params: { apiUrl, page: 1, limit: 1000 },
  });
  return res.data.data.data; // deeply nested
};

// NEW
const fetchTasks = async (softwareId: number, page = 1) => {
  const res = await api.get('/local-tasks', {
    params: { software_id: softwareId, page, limit: 50 },
  });
  return {
    tasks: res.data.data.tasks,
    pagination: res.data.data.pagination,
  };
};
```

### Code Example — Flutter / Dart

```dart
// OLD
Future<List<Task>> fetchTasks(String softwareToken, String apiUrl) async {
  final res = await dio.get('/softaware/tasks',
    options: Options(headers: {'X-Software-Token': softwareToken}),
    queryParameters: {'apiUrl': apiUrl, 'page': 1, 'limit': 1000},
  );
  return (res.data['data']['data'] as List).map(Task.fromJson).toList();
}

// NEW
Future<TaskPage> fetchTasks(int softwareId, {int page = 1}) async {
  final res = await dio.get('/local-tasks',
    queryParameters: {'software_id': softwareId, 'page': page, 'limit': 50},
  );
  final data = res.data['data'];
  return TaskPage(
    tasks: (data['tasks'] as List).map(Task.fromJson).toList(),
    pagination: Pagination.fromJson(data['pagination']),
  );
}
```

---

## 3. Update Write Path (Proxy)

Write operations (create, update, delete) still go through the proxy router, but auth is simpler.

### Key Change

Replace `apiUrl` + `X-Software-Token` with `software_id` in the request body or query.

### Create Task

```
POST /softaware/tasks
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{
  "software_id": 5,
  "task": {
    "task_name": "Implement password reset",
    "task_description": "<p>Add forgot password functionality</p>",
    "task_notes": "Use email verification",
    "task_status": "new",
    "task_type": "feature",
    "task_hours": "0",
    "task_estimated_hours": "6.00",
    "task_color": "#3b82f6",
    "software_id": 5,
    "module_id": 2,
    "assigned_to": 5,
    "task_created_by_name": "Admin User",
    "user_name": "admin",
    "task_approval_required": 0
  }
}
```

The `task` object shape is **unchanged** — same fields as v1.x.

### Update Task

```
PUT /softaware/tasks
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{
  "software_id": 5,
  "task": {
    "task_id": 157,
    "task_name": "Fix login bug (updated)",
    "task_status": "progress",
    "workflow_phase": "testing",
    "assigned_to": 5,
    "software_id": 5
  }
}
```

> **Important:** Use `external_id` from the local-tasks response as `task_id` here. Do NOT use the local `id`.

**Side Effects (new in v2.0):** The backend now fires push notifications:
- If `assigned_to` is set/changed → notification sent to assigned user
- If `workflow_phase` changes → notification sent to assigned user
- Self-assignments and self-phase-changes are suppressed

### Delete Task

```
DELETE /softaware/tasks/157?software_id=5
Headers: Authorization: Bearer <jwt>
```

Replace `apiUrl` query param with `software_id`.

### Reorder Tasks

```
POST /softaware/tasks/reorder
Headers: Authorization: Bearer <jwt>

{ "software_id": 5, "orders": { "157": 1, "158": 2, "159": 3 } }
```

---

## 4. New: Local Enhancement Endpoints

These are **entirely new** features that let users personalise their task view. All changes are local-only — they don't affect the external system.

> **Important:** These endpoints use the **local `id`** (the `id` field from the `/local-tasks` response), NOT `external_id`.

### Toggle Bookmark

```
PATCH /local-tasks/42/bookmark
Headers: Authorization: Bearer <jwt>
```

No body needed. Toggles between bookmarked (1) and unbookmarked (0).

**Response:**
```json
{ "status": 1, "message": "Bookmarked", "data": { "is_bookmarked": 1 } }
```

**UI Suggestion:** Star/heart icon on each task card. Filled when bookmarked.

### Set Priority

```
PATCH /local-tasks/42/priority
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "priority": "high" }
```

**Valid values:** `urgent`, `high`, `normal`, `low`

**Response:**
```json
{ "status": 1, "message": "Priority updated", "data": { "priority": "high" } }
```

**UI Suggestion:** Colour-coded badge — 🔴 urgent, 🟠 high, 🔵 normal, ⚪ low

### Set Colour Label

```
PATCH /local-tasks/42/color-label
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "color_label": "red" }
```

Send `null` to clear.

**UI Suggestion:** Thin coloured stripe on the left edge of the task card.

### Set Tags

```
PATCH /local-tasks/42/tags
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "tags": ["frontend", "urgent-fix", "sprint-3"] }
```

This is a **full replacement** — send the complete tag array. Empty array `[]` clears all tags.

**UI Suggestion:** Pill/chip badges below the task title.

### Get All Tags (for autocomplete)

```
GET /local-tasks/tags
Headers: Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "status": 1,
  "data": { "tags": ["backend", "design", "frontend", "sprint-3", "urgent-fix"] }
}
```

### Record View

```
PATCH /local-tasks/42/view
Headers: Authorization: Bearer <jwt>
```

No body. Call this when the user opens a task detail screen. Increments `view_count` and updates `last_viewed_at`.

### Bulk Update (Kanban Reorder)

```
PATCH /local-tasks/bulk
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{
  "updates": [
    { "id": 42, "kanban_order": 0, "status": "new" },
    { "id": 43, "kanban_order": 1, "status": "new" },
    { "id": 44, "kanban_order": 0, "status": "in-progress" }
  ]
}
```

**Allowed fields in bulk:** `priority`, `is_bookmarked`, `color_label`, `kanban_order`, `status`

---

## 5. New: Sync Management

The mobile app can trigger and monitor the sync engine.

### Sync All Sources

```
POST /local-tasks/sync
Headers: Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "status": 1,
  "message": "All 2 sources synced successfully",
  "data": {
    "results": [
      {
        "source_id": 1,
        "source_name": "Softaware Tasks",
        "status": "success",
        "tasks_fetched": 150,
        "tasks_created": 3,
        "tasks_updated": 5,
        "tasks_unchanged": 142,
        "tasks_deleted": 0,
        "duration_ms": 1847
      }
    ]
  }
}
```

**UI Suggestion:** Pull-to-refresh on the task list should call this endpoint, then re-fetch tasks.

### Sync Single Source

```
POST /local-tasks/sync/1
Headers: Authorization: Bearer <jwt>
```

### Check Sync Status

```
GET /local-tasks/sync/status
Headers: Authorization: Bearer <jwt>
```

Returns last sync time, status, and task count per source.

### View Sync Log

```
GET /local-tasks/sync/log?limit=20
Headers: Authorization: Bearer <jwt>
```

**UI Suggestion:** A "Sync History" screen in settings showing recent sync runs.

### List Sources

```
GET /local-tasks/sources
Headers: Authorization: Bearer <jwt>
```

Returns all configured task sources with masked API keys. Useful for a "Connected Sources" settings screen.

---

## 6. New: Invoice Staging

Three-stage local workflow for billing tasks.

### Stage Tasks for Invoicing

```
POST /local-tasks/invoice/stage
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{
  "task_ids": ["157", "158", "159"],
  "bill_date": "2026-03-10"
}
```

> **Note:** `task_ids` are `external_id` values (strings), NOT local `id` values.

Only stages tasks with `task_billed = 0`.

### View Staged Tasks

```
GET /local-tasks/invoice/staged
Headers: Authorization: Bearer <jwt>
```

### Unstage a Task

```
POST /local-tasks/invoice/unstage/42
Headers: Authorization: Bearer <jwt>
```

Uses the local `id`.

### Clear All Staging

```
POST /local-tasks/invoice/clear
Headers: Authorization: Bearer <jwt>
```

### Process Invoices (Submit to Portal)

```
POST /local-tasks/invoice/process
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "apiUrl": "https://portal.example.com" }
```

This sends all staged tasks to the external portal and marks them as invoiced (`task_billed = 1`).

**UI Flow:**
1. User selects unbilled tasks → "Stage for Invoice"
2. User reviews staged tasks in an invoice preview
3. User taps "Submit Invoice" → calls `/invoice/process`
4. Refresh task list (billed tasks now hidden if `exclude_billed=1` filter active)

---

## 7. New: Workflow Actions

New one-tap workflow endpoints for task lifecycle management.

### Start Task

```
POST /softaware/tasks/157/start?software_id=5
Headers: Authorization: Bearer <jwt>
```

Sets the task to "in-progress" with `actual_start` timestamp on the external system.

### Complete Task

```
POST /softaware/tasks/157/complete?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Approve Task

```
POST /softaware/tasks/157/approve?software_id=5
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "approved_by": "Manager Name" }
```

### Get Pending Approvals

```
GET /softaware/tasks/pending-approval?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Get Task Stats

```
GET /softaware/tasks/stats?software_id=5
Headers: Authorization: Bearer <jwt>
```

---

## 8. New: Comment & Attachment Additions

### Delete a Comment

```
DELETE /softaware/tasks/comments/15?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Convert Comment to Task

```
POST /softaware/tasks/comments/15/convert-to-task?software_id=5
Headers: Authorization: Bearer <jwt>
```

Creates a new task from the comment content on the external system.

### List Attachments

```
GET /softaware/tasks/157/attachments?software_id=5
Headers: Authorization: Bearer <jwt>
```

**Response:** Array of attachment objects, each including a `download_url` field:

```json
{
  "status": 1,
  "data": [
    {
      "attachment_id": 141,
      "task_id": 132,
      "comment_id": null,
      "file_name": "CAPEX FEATURES.docx",
      "file_path": "task_132_1769417621_69772b9525928.docx",
      "file_size": 29309,
      "file_type": "docx",
      "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "is_from_ticket": 0,
      "download_url": "https://portal.silulumanzi.com/uploads/development/task_132_1769417621_69772b9525928.docx"
    }
  ]
}
```

> **⚠️ Important (v2.2.1):** Always use the `download_url` field for displaying images and file links. This points to a **public static path** (`/uploads/development/...`) served by Apache — **no authentication required**. It works directly in `<Image>`, `<img src>`, `Image.network()`, and browser tabs without any headers.

### Attachment URL Resolution (v2.2.1)

When rendering attachment thumbnails or file links:

1. **Use `download_url`** (preferred) — public static path, no auth needed
2. **Fallback:** `file_path` if it starts with `http` — already a full URL
3. **Last resort:** Construct `{origin}/uploads/development/{file_path}`

> **Do NOT** use the `/api/tasks-api/attachments/{filename}` endpoint for `<Image>` tags — that endpoint requires `X-API-Key` authentication and is intended for programmatic/CLI downloads only.

### Stream Attachment (Programmatic Download)

```
GET /softaware/tasks/attachments/screenshot.png?software_id=5
Headers: Authorization: Bearer <jwt>
```

**Returns:** Binary file content with correct `Content-Type` header (not JSON).

Add `?download=1` to force download disposition.

**UI Suggestion:** For inline image previews, prefer `download_url` from the list response (no auth headers needed). For programmatic downloads or when `download_url` is unavailable, use this streaming endpoint with auth headers.

### Upload Multiple Attachments

```
POST /softaware/tasks/157/attachments?software_id=5
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{
  "files": [
    {
      "base64": "data:image/png;base64,iVBORw0KGg...",
      "fileName": "screenshot.png",
      "mimeType": "image/png"
    }
  ],
  "comment_id": 15
}
```

### Get Parent Task

```
GET /softaware/tasks/157/parent?software_id=5
Headers: Authorization: Bearer <jwt>
```

---

## 9. New: Orders & Billing

### Latest Orders

```
GET /softaware/tasks/orders/latest?software_id=5
Headers: Authorization: Bearer <jwt>
```

### All Budgets

```
GET /softaware/tasks/orders/budgets?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Budget for Specific Order

```
GET /softaware/tasks/orders/ORD-2026-001/budget?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Get Statement

```
GET /softaware/tasks/statement?software_id=5
Headers: Authorization: Bearer <jwt>
```

### Bill Tasks (External)

```
POST /softaware/tasks/bill?software_id=5
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "task_ids": [157, 158], "bill_date": "2026-03-10" }
```

### Update Time

```
PUT /softaware/tasks/time?software_id=5
Headers: Authorization: Bearer <jwt>
Content-Type: application/json

{ "task_id": 157, "hours": "4.50" }
```

---

## 10. Updated Data Models

### Task Model (TypeScript)

```typescript
interface Task {
  // Local fields
  id: number;                        // Local DB primary key (use for enhancement endpoints)
  source_id: number;
  external_id: string;               // Remote system ID (use for proxy/write endpoints)
  source_name: string;               // e.g. "Softaware Tasks"
  source_type: string;               // e.g. "tasks-api"

  // Core fields (synced from external)
  title: string;
  description: string | null;        // HTML
  notes: string | null;
  status: 'new' | 'in-progress' | 'completed' | 'pending';
  type: 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support' | 'general';
  color: string;                     // hex colour
  start_date: string | null;         // datetime
  end_date: string | null;           // datetime
  actual_start: string | null;
  actual_end: string | null;
  hours: string;                     // decimal string
  estimated_hours: number;           // decimal number (was string in v1.x)
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by_name: string | null;
  user_id: number;
  workflow_phase: string | null;
  approval_required: number;         // 0 or 1
  approved_by: string | null;
  approved_at: string | null;
  parent_task_id: number | null;
  association_type: string | null;
  task_order: number;
  order_number: string | null;
  software_id: number | null;
  module_id: number | null;
  module_name: string | null;
  task_billed: number;               // 0=unbilled, 1=invoiced, 2=staged
  task_bill_date: string | null;
  task_deleted: number;              // 0 or 1

  // Local enhancements (new in v2.0, never synced upstream)
  priority: 'urgent' | 'high' | 'normal' | 'low';
  is_bookmarked: number;            // 0 or 1
  color_label: string | null;       // colour name
  local_tags: string;               // JSON array string — parse with JSON.parse()
  kanban_order: number;
  view_count: number;
  last_viewed_at: string | null;

  // Sync metadata
  local_dirty: number;              // 1 = modified locally, pending push
  last_synced_at: string;
  sync_hash: string;
  external_created_at: string | null;
  external_updated_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### Task Model (Dart)

```dart
class Task {
  // Local
  final int id;
  final int sourceId;
  final String externalId;
  final String sourceName;
  final String sourceType;

  // Core
  final String title;
  final String? description;
  final String? notes;
  final String status;    // 'new', 'in-progress', 'completed', 'pending'
  final String type;      // 'development', 'bug-fix', 'feature', etc.
  final String color;
  final String? startDate;
  final String? endDate;
  final String? actualStart;
  final String? actualEnd;
  final String hours;
  final double estimatedHours;
  final int? assignedTo;
  final String? assignedToName;
  final String? createdByName;
  final int userId;
  final String? workflowPhase;
  final int approvalRequired;
  final String? approvedBy;
  final String? approvedAt;
  final int? parentTaskId;
  final String? associationType;
  final int taskOrder;
  final String? orderNumber;
  final int? softwareId;
  final int? moduleId;
  final String? moduleName;
  final int taskBilled;      // 0=unbilled, 1=invoiced, 2=staged
  final String? taskBillDate;
  final int taskDeleted;

  // Local enhancements (v2.0)
  final String priority;    // 'urgent', 'high', 'normal', 'low'
  final int isBookmarked;
  final String? colorLabel;
  final List<String> localTags;
  final int kanbanOrder;
  final int viewCount;
  final String? lastViewedAt;

  // Sync metadata
  final int localDirty;
  final String lastSyncedAt;

  factory Task.fromJson(Map<String, dynamic> json) => Task(
    id: json['id'],
    sourceId: json['source_id'],
    externalId: json['external_id']?.toString() ?? '',
    sourceName: json['source_name'] ?? '',
    sourceType: json['source_type'] ?? '',
    title: json['title'] ?? '',
    description: json['description'],
    notes: json['notes'],
    status: json['status'] ?? 'new',
    type: json['type'] ?? 'general',
    color: json['color'] ?? '#3788d8',
    startDate: json['start_date'],
    endDate: json['end_date'],
    actualStart: json['actual_start'],
    actualEnd: json['actual_end'],
    hours: json['hours'] ?? '0',
    estimatedHours: (json['estimated_hours'] ?? 0).toDouble(),
    assignedTo: json['assigned_to'],
    assignedToName: json['assigned_to_name'],
    createdByName: json['created_by_name'],
    userId: json['user_id'] ?? 0,
    workflowPhase: json['workflow_phase'],
    approvalRequired: json['approval_required'] ?? 0,
    approvedBy: json['approved_by'],
    approvedAt: json['approved_at'],
    parentTaskId: json['parent_task_id'],
    associationType: json['association_type'],
    taskOrder: json['task_order'] ?? 0,
    orderNumber: json['order_number'],
    softwareId: json['software_id'],
    moduleId: json['module_id'],
    moduleName: json['module_name'],
    taskBilled: json['task_billed'] ?? 0,
    taskBillDate: json['task_bill_date'],
    taskDeleted: json['task_deleted'] ?? 0,
    priority: json['priority'] ?? 'normal',
    isBookmarked: json['is_bookmarked'] ?? 0,
    colorLabel: json['color_label'],
    localTags: json['local_tags'] != null
        ? (json['local_tags'] is String
            ? List<String>.from(jsonDecode(json['local_tags']))
            : List<String>.from(json['local_tags']))
        : [],
    kanbanOrder: json['kanban_order'] ?? 0,
    viewCount: json['view_count'] ?? 0,
    lastViewedAt: json['last_viewed_at'],
    localDirty: json['local_dirty'] ?? 0,
    lastSyncedAt: json['last_synced_at'] ?? '',
  );
}
```

### Pagination Model

```typescript
interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
```

---

## 11. Screen-by-Screen Migration Checklist

### Software Selection Screen

| Item | Action |
|------|--------|
| Software list endpoint | ✅ No change — `GET /softaware/software` still works |
| "Authenticate" button | ❌ **Remove** — no longer needed |
| OTP verification screen | ❌ **Remove entirely** |
| Software token storage | ❌ **Remove** — delete SecureStore/Keychain entries |

### Task List Screen

| Item | Action |
|------|--------|
| Fetch endpoint | 🔄 Change `GET /softaware/tasks` → `GET /local-tasks` |
| Auth header | 🔄 Remove `X-Software-Token`, keep `Authorization` only |
| Query params | 🔄 Replace `apiUrl` with `software_id` |
| Response parsing | 🔄 Update field mapping (see §2) |
| Pagination | 🔄 Use `data.pagination` instead of `data.data` + `has_next` |
| Pull-to-refresh | 🔄 Call `POST /local-tasks/sync` first, then re-fetch |
| Status filter | ✅ Keep — now a query param on `/local-tasks` |
| Type filter | ✅ Keep — now a query param on `/local-tasks` |
| **New:** Priority filter | ➕ Add `priority` dropdown/selector |
| **New:** Bookmark filter | ➕ Add toggle for `bookmarked=1` |
| **New:** Tag filter | ➕ Add tag chip selector |
| **New:** Search | ➕ Add `search` query param support |
| **New:** Priority badge | ➕ Show colour-coded priority on each card |
| **New:** Bookmark star | ➕ Show filled/empty star, tap to toggle |
| **New:** Colour label stripe | ➕ Show thin coloured edge on card |
| **New:** Tag chips | ➕ Show tag pills below title |
| **New:** Sync indicator | ➕ Show `local_dirty` flag (unsaved changes badge) |

### Task Detail Screen

| Item | Action |
|------|--------|
| Load single task | 🔄 Optional: `GET /local-tasks/{local_id}` or use list data |
| Record view | ➕ Call `PATCH /local-tasks/{local_id}/view` on open |
| Edit task | 🔄 Replace `apiUrl` with `software_id` in PUT body |
| Delete task | 🔄 Replace `apiUrl` with `software_id` in query |
| Comments — fetch | 🔄 Replace `X-Software-Token` + `apiUrl` with `software_id` |
| Comments — add | 🔄 Same change |
| Comments — delete | ➕ New: `DELETE /softaware/tasks/comments/{id}?software_id=X` |
| Comments — convert to task | ➕ New: `POST /softaware/tasks/comments/{id}/convert-to-task?software_id=X` |
| Attachments — fetch | 🔄 Same auth change — response now includes `download_url` per attachment |
| Attachments — view | 🔄 **Prefer `download_url`** from list response (public, no auth). Fallback: `GET /softaware/tasks/attachments/{filename}?software_id=X` (binary stream, needs auth) |
| Attachments — upload | 🔄 Same auth change |
| Attachments — delete | 🔄 Same auth change |
| Associations — all | 🔄 Same auth change |
| **New:** Priority selector | ➕ Dropdown → `PATCH /local-tasks/{local_id}/priority` |
| **New:** Bookmark toggle | ➕ Button → `PATCH /local-tasks/{local_id}/bookmark` |
| **New:** Tag editor | ➕ Tag input → `PATCH /local-tasks/{local_id}/tags` |
| **New:** Colour label picker | ➕ Colour dots → `PATCH /local-tasks/{local_id}/color-label` |
| **New:** Start/Complete/Approve | ➕ Workflow action buttons (see §7) |
| **New:** Parent task link | ➕ `GET /softaware/tasks/{id}/parent?software_id=X` |

### Settings Screen (New)

| Item | Action |
|------|--------|
| Connected Sources | ➕ `GET /local-tasks/sources` |
| Sync Now button | ➕ `POST /local-tasks/sync` |
| Sync History | ➕ `GET /local-tasks/sync/log` |
| Last Sync Time | ➕ Show from `GET /local-tasks/sync/status` |

---

## 12. Error Handling Changes

### Local Router Errors (`/local-tasks/*`)

```json
{
  "status": 0,
  "message": "Error description"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (missing/invalid fields) |
| 404 | Task or source not found |
| 409 | Duplicate (e.g. source name already exists) |
| 500 | Server error |

### Proxy Router Errors (`/softaware/tasks/*`)

```json
{
  "success": false,
  "error": "Error description"
}
```

**New error — source resolution failure:**
```json
{
  "success": false,
  "error": "No task source configured for this software/apiUrl"
}
```

This means no entry in `task_sources` matches the `software_id` sent. The admin needs to register a source.

### Handling Both Formats

Since your app now calls two different routers, normalise errors in your API interceptor:

```typescript
function extractErrorMessage(response: any): string {
  return response.data?.message     // local router
    || response.data?.error         // proxy router
    || response.statusText
    || 'Unknown error';
}
```

---

## 13. Offline Strategy

The dual-path architecture makes offline support much easier:

### Reads

Since all task reads come from the local database (which the server maintains), your mobile app can:
1. Cache the `/local-tasks` response in local storage / SQLite
2. Show cached data when offline
3. Re-sync when connectivity returns (`POST /local-tasks/sync` → re-fetch)

### Writes

When offline, queue write operations locally and replay them when online:
1. Store pending creates/updates/deletes in a local queue
2. On reconnect, replay to `/softaware/tasks` endpoints
3. Then trigger a sync to refresh local cache

### Sync-on-Launch Pattern

```
App Launch
  → Check connectivity
  → If online: POST /local-tasks/sync (background)
  → Fetch GET /local-tasks (foreground)
  → If offline: Show cached data
```

---

## Quick Reference — Endpoint Mapping

### Old → New (Reading)

| Old Endpoint | New Endpoint |
|-------------|--------------|
| `GET /softaware/tasks?apiUrl=X` | `GET /local-tasks?software_id=X` |

### Old → New (Writing) — same endpoint, simpler auth

| Endpoint | Change |
|----------|--------|
| `POST /softaware/tasks` | Remove `X-Software-Token` + `apiUrl`, add `software_id` |
| `PUT /softaware/tasks` | Same |
| `DELETE /softaware/tasks/:id` | Replace `apiUrl` query with `software_id` |
| `POST /softaware/tasks/reorder` | Same |
| `GET /softaware/tasks/:id/comments` | Replace `apiUrl` query with `software_id` |
| `POST /softaware/tasks/:id/comments` | Replace `apiUrl` with `software_id` in body |
| `POST /softaware/tasks/:id/comments/with-attachment` | Same |
| `GET /softaware/tasks/:id/attachments` | Replace `apiUrl` with `software_id`. Response now includes `download_url` per attachment — use it for `<Image>` rendering (no auth needed) |
| `POST /softaware/tasks/:id/attachments` | Same |
| `DELETE /softaware/tasks/:id/attachments/:aid` | Replace `apiUrl` with `software_id` |
| `GET /softaware/tasks/:id/associations` | Replace `apiUrl` with `software_id` |
| `POST /softaware/tasks/:id/associations` | Same |
| `DELETE /softaware/tasks/:id/associations` | Same |

### Brand New Endpoints

| Endpoint | Purpose |
|----------|---------|
| `PATCH /local-tasks/:id/bookmark` | Toggle bookmark |
| `PATCH /local-tasks/:id/priority` | Set priority |
| `PATCH /local-tasks/:id/color-label` | Set colour label |
| `PATCH /local-tasks/:id/tags` | Set tags |
| `PATCH /local-tasks/:id/view` | Record view |
| `PATCH /local-tasks/bulk` | Batch update |
| `GET /local-tasks/tags` | List all tags |
| `POST /local-tasks/sync` | Sync all sources |
| `POST /local-tasks/sync/:sourceId` | Sync one source |
| `GET /local-tasks/sync/status` | Sync status |
| `GET /local-tasks/sync/log` | Sync history |
| `GET /local-tasks/sources` | List sources |
| `POST /local-tasks/invoice/stage` | Stage for invoicing |
| `GET /local-tasks/invoice/staged` | List staged |
| `POST /local-tasks/invoice/unstage/:id` | Unstage one |
| `POST /local-tasks/invoice/clear` | Clear all staged |
| `POST /local-tasks/invoice/process` | Submit invoices |
| `POST /softaware/tasks/:id/start` | Start task |
| `POST /softaware/tasks/:id/complete` | Complete task |
| `POST /softaware/tasks/:id/approve` | Approve task |
| `GET /softaware/tasks/pending-approval` | Pending approvals |
| `GET /softaware/tasks/stats` | Task statistics |
| `DELETE /softaware/tasks/comments/:id` | Delete comment |
| `POST /softaware/tasks/comments/:id/convert-to-task` | Comment → task |
| `GET /softaware/tasks/attachments/:filename` | Stream file |
| `GET /softaware/tasks/:id/parent` | Get parent task |
| `GET /softaware/tasks/orders/latest` | Latest orders |
| `GET /softaware/tasks/orders/budgets` | All budgets |
| `GET /softaware/tasks/orders/:num/budget` | Budget for order |
| `GET /softaware/tasks/statement` | Billing statement |
| `PUT /softaware/tasks/time` | Update time |
| `POST /softaware/tasks/bill` | Bill tasks |
