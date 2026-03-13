# Tasks Module — API Routes

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Router | Mount Point | File | Endpoints | Purpose |
|--------|-------------|------|-----------|---------|
| Proxy | `/api/softaware/tasks` | `softawareTasks.ts` | 33 | Write path — proxy to external APIs |
| Local | `/api/local-tasks` | `localTasks.ts` | 30 | Read path — local DB CRUD, sync, enhancements, sync toggle |
| AI Assistant | Tool dispatch | `mobileActionExecutor.ts` | 22 | AI voice/text — full task lifecycle via tool handlers |

**Base URL:** `https://mcp.softaware.net.za`

**Authentication:** Both routers use Firebase JWT in the `Authorization: Bearer <token>` header. The `requireAuth` middleware is technically a no-op (pass-through) on both routers — source-level API keys handle external auth.

**Response Format:**
- **Local router:** `{ status: 1|0, message: string, data?: ... }`
- **Proxy router:** Passes through the external API's response shape, or `{ success: false, error: string }` on error.

---

## 2. Proxy Router — `/api/softaware/tasks`

All endpoints resolve the external API source via `resolveTaskSource(req)`, which looks up `task_sources` by `software_id` (from query/body) or `apiUrl` (from query). Returns `{ baseUrl, apiKey }` used by `proxyToExternal()`.

### 2.1 Task CRUD

#### `GET /` — List tasks

Proxy to external `GET {baseUrl}/api/tasks-api?page=&limit=`.

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 1000 | Page size |
| `software_id` | number | — | Used to resolve the source |
| `apiUrl` | string | — | Alternative source resolution |

**Response:** External API response (passed through).

---

#### `POST /` — Create task

Proxy to external `POST {baseUrl}/api/tasks-api`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `task` | object | ✅ | Task object to create |

---

#### `PUT /` — Update task

Proxy to external `PUT {baseUrl}/api/tasks-api/{taskId}`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `task` | object | ✅ | Task object (must include `task_id` or `id`) |

**Side Effects:** Fires async notifications for assignment changes and workflow phase changes.

---

#### `DELETE /:id` — Delete task

Proxy to external `DELETE {baseUrl}/api/tasks-api/{id}`.

---

#### `GET /:id` — Get single task

Proxy to external `GET {baseUrl}/api/tasks-api/{id}`.

> **⚠️ Route Order:** This route is registered **last** in the file as a wildcard catch-all.

---

### 2.2 Reorder

#### `POST /reorder` — Reorder tasks

Proxy to external `POST {baseUrl}/api/tasks-api/reorder`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `orders` | array | ✅ | Array of `{ id, order }` pairs |

---

### 2.3 Associations

#### `GET /:id/associations` — List associations

Proxy to external `GET {baseUrl}/api/tasks-api/{id}/associated`.

---

#### `POST /:id/associations` — Create association

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/associate`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `parent_task_id` | number | ✅ | Parent task ID |
| `association_type` | string | ✅ | Association type |
| `notes` | string | — | Association notes |

---

#### `DELETE /:id/associations` — Remove association

Proxy to external `DELETE {baseUrl}/api/tasks-api/{id}/associate`.

---

#### `GET /:id/parent` — Get parent task

Proxy to external `GET {baseUrl}/api/tasks-api/{id}/parent`.

---

### 2.4 Attachments

#### `GET /:id/attachments` — List attachments

Proxy to external `GET {baseUrl}/api/tasks-api/{id}/attachments`.

**Response includes `download_url`** for each attachment — a public static path (`/uploads/development/{file}`) that requires no authentication. Frontend `buildFileUrl()` / `buildAttachmentUrl()` prefer this field for `<img src>` and `<a href>` rendering.

---

#### `POST /:id/attachments` — Upload attachments

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/attachments`.

Converts base64-encoded files to `multipart/form-data` using native Node 18+ `FormData` and `Blob`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `files` | array | ✅ | `[{ base64, fileName, mimeType }]` |
| `comment_id` | number | — | Link attachment to a comment |

**Response:** `{ success: true, attachments: [...results] }`

---

#### `DELETE /:id/attachments/:attachmentId` — Delete attachment

Two-step: fetches attachment list to find `file_path` by ID, then calls external `DELETE {baseUrl}/api/tasks-api/attachments/{filePath}`.

---

#### `GET /attachments/:filename` — Stream attachment file

**Binary streaming endpoint.** Fetches the file from the external API and pipes it directly to the response with correct `Content-Type` and `Content-Disposition` headers.

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `download` | `"1"` | — | Force download disposition |

**Response:** Binary file content (not JSON).

---

### 2.5 Comments

#### `GET /:id/comments` — List comments

Proxy to external `GET {baseUrl}/api/tasks-api/{id}/comments`.

---

#### `POST /:id/comments` — Create comment

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/comments`.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `comment` | object | — | Legacy shape (full comment object) |
| `content` | string | — | Comment HTML content |
| `is_internal` | number | — | `0` = public, `1` = internal (default: 0) |
| `time_spent` | number | — | Hours spent (default: 0) |
| `parent_comment_id` | number | — | Parent for threading |

Supports both `{ comment: {...} }` and flat `{ content, is_internal, ... }` shapes.

---

#### `POST /:id/comments/with-attachment` — Create comment with drawing

Two-step operation: creates comment, then uploads base64 image as attachment linked to the new comment.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `content` | string | — | Comment HTML content |
| `is_internal` | number | — | Default: 1 |
| `imageBase64` | string | ✅ | Base64-encoded image (data URL) |
| `fileName` | string | — | Default: `"drawing.png"` |

**Response:** `{ success: true, comment, comment_id, attachment }`

> **⚠️ Route Order:** Registered **before** `/:id/comments` to avoid being shadowed.

---

#### `DELETE /comments/:commentId` — Delete comment

Proxy to external `DELETE {baseUrl}/api/tasks-api/comments/{commentId}`.

---

#### `POST /comments/:commentId/convert-to-task` — Convert comment to task

Proxy to external `POST {baseUrl}/api/tasks-api/comments/{commentId}/convert-to-task`.

---

### 2.6 Workflow

#### `POST /:id/start` — Start task

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/start`.

---

#### `POST /:id/complete` — Complete task

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/complete`.

---

#### `POST /:id/approve` — Approve task

Proxy to external `POST {baseUrl}/api/tasks-api/{id}/approve`.

| Body | Type | Required | Description |
|------|------|----------|-------------|
| *(any)* | object | — | Passed through to external API |

---

#### `GET /pending-approval` — List pending approvals

Proxy to external `GET {baseUrl}/api/tasks-api/pending-approval`.

> **⚠️ Route Order:** Registered **before** `/:id` wildcard.

---

### 2.7 Statistics & Billing

#### `GET /stats` — Task statistics

Proxy to external `GET {baseUrl}/api/tasks-api/stats`.

---

#### `POST /sync` — Sync tasks (external API)

Proxy to external `POST {baseUrl}/api/tasks-api/sync`.

---

#### `POST /invoice-tasks` — Invoice tasks

Proxy to external `POST {baseUrl}/api/tasks-api/invoice-tasks`.

---

#### `POST /bill` — Bill tasks

Proxy to external `POST {baseUrl}/api/tasks-api/bill`.

---

#### `PUT /time` — Update time

Proxy to external `PUT {baseUrl}/api/tasks-api/time`.

---

#### `GET /statement` — Get statement

Proxy to external `GET {baseUrl}/api/tasks-api/statement`.

---

### 2.8 Orders

#### `GET /orders/latest` — Latest orders

Proxy to external `GET {baseUrl}/api/tasks-api/orders/latest`.

---

#### `GET /orders/budgets` — All budgets

Proxy to external `GET {baseUrl}/api/tasks-api/orders/budgets`.

---

#### `GET /orders/:orderNumber/budget` — Budget for order

Proxy to external `GET {baseUrl}/api/tasks-api/orders/{orderNumber}/budget`.

---

### 2.9 Legacy

#### `POST /authenticate` — Authentication stub

No-op endpoint for backward compatibility. Always returns success.

**Response:**
```json
{
  "success": true,
  "message": "No external authentication required. Source API key is used automatically.",
  "token": null,
  "user": null
}
```

---

## 3. Local Router — `/api/local-tasks`

All endpoints query the local MySQL database directly. No external API calls (except sync and invoice processing).

### 3.1 Source Management

#### `GET /sources` — List all sources

Returns all registered task sources with task counts. API keys are masked (`••••••••`).

**Response:**
```json
{
  "status": 1,
  "message": "Success",
  "data": {
    "sources": [
      {
        "id": 1,
        "name": "Softaware Tasks",
        "source_type": "tasks-api",
        "base_url": "https://tasks.example.com",
        "api_key": "••••••••",
        "task_count": 150,
        "active_task_count": 142,
        "dirty_task_count": 3,
        ...
      }
    ]
  }
}
```

---

#### `POST /sources` — Register source

| Body Field | Type | Required | Default | Description |
|------------|------|----------|---------|-------------|
| `name` | string | ✅ | — | Unique source name |
| `base_url` | string | ✅ | — | External API base URL |
| `source_type` | string | — | `tasks-api` | `tasks-api` \| `software-proxy` \| `github` \| `jira` \| `manual` |
| `api_key` | string | — | null | API key for auth |
| `auth_method` | string | — | `api-key` | `api-key` \| `bearer` \| `software-token` \| `none` |
| `auth_header` | string | — | `X-API-Key` | Header name |
| `software_id` | number | — | null | FK to software |
| `sync_enabled` | boolean | — | true | Enable auto-sync |
| `sync_interval_min` | number | — | 15 | Sync interval (minutes) |
| `extra_config` | object | — | null | Source-specific config |

**Response:** `201 Created` with source object. `409 Conflict` if name exists.

---

#### `PUT /sources/:id` — Update source

Same fields as POST (all optional). Only provided fields are updated.

---

#### `DELETE /sources/:id` — Delete source

Deletes source and **cascades** to all its tasks and sync log entries.

---

#### `POST /sources/:id/test` — Test source connectivity

Attempts to fetch one task from the source to verify connectivity. Returns HTTP status, latency, and response preview.

**Response:**
```json
{
  "status": 1,
  "message": "Connection successful",
  "data": {
    "http_status": 200,
    "latency_ms": 142,
    "response_preview": "{ \"status\": 1, ... }"
  }
}
```

---

### 3.2 Sync Operations

#### `GET /sync/enabled` — Check sync status

Returns global sync state and per-source sync flags.

**Response:**
```json
{
  "status": 1,
  "data": {
    "enabled": true,
    "all_enabled": true,
    "sources": [{ "id": 1, "name": "...", "sync_enabled": 1 }]
  }
}
```

---

#### `POST /sync` — Sync all enabled sources

Calls `syncAllSources()` from `taskSyncService.ts`. Returns per-source results.

---

#### `POST /sync/:sourceId` — Sync specific source

Calls `syncSource(sourceId)`. Returns detailed sync results (created, updated, unchanged, errors).

---

#### `POST /sync/disable` — Disable all sync + open case

Disables sync on all sources and creates a support case documenting why.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `reason` | string | ✅ | Why sync is being disabled |
| `reason_detail` | string | — | Additional details |
| `software_name` | string | — | Software context |
| `user_id` | string | — | User who disabled |
| `user_name` | string | — | User display name |

**Response:**
```json
{
  "status": 1,
  "message": "Sync disabled. Case CASE-12345678 opened.",
  "data": { "sources_disabled": 2, "case_number": "CASE-12345678", "case_id": "abc..." }
}
```

---

#### `POST /sync/enable` — Re-enable all sync

Re-enables sync on all sources.

---

#### `GET /sync/status` — Sync status per source

Returns sync metadata (last_synced_at, status, message, count) for each source.

---

#### `GET /sync/log` — Sync history

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `limit` | number | 50 | Max entries (capped at 200) |
| `source_id` | number | — | Filter by source |

---

### 3.3 Tasks CRUD

#### `GET /` — List tasks (paginated, filterable)

Main read endpoint for the frontend. Joins `local_tasks` with `task_sources`.

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Page size (max 200) |
| `status` | string | `all` | Filter: `new`, `in-progress`, `completed`, `pending` |
| `type` | string | `all` | Filter: `development`, `bug-fix`, `feature`, etc. |
| `source_id` | number | — | Filter by source |
| `software_id` | number | — | Filter by software product |
| `search` | string | — | Search title, description, external_id |
| `date_from` | string | — | Start date filter (ISO date) |
| `date_to` | string | — | End date filter (ISO date) |
| `exclude_billed` | `"1"` | — | Exclude billed tasks |
| `workflow_phase` | string | `all` | Filter by workflow phase |
| `priority` | string | `all` | Filter: `urgent`, `high`, `normal`, `low` |
| `bookmarked` | `"1"` | — | Only bookmarked tasks |
| `color_label` | string | — | Filter by colour label |
| `tag` | string | — | Filter by tag (JSON_CONTAINS) |

**Response:**
```json
{
  "status": 1,
  "message": "Success",
  "data": {
    "tasks": [...],
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

**Sort Order:** `task_order ASC, external_id DESC`

---

#### `GET /:id` — Get single task

Returns task with joined source name and type.

---

#### `PUT /:id` — Update task

Updates any combination of allowed fields. **Automatically sets `local_dirty = 1`** so the next sync pushes changes back to the external source.

| Body Field | Type | Description |
|------------|------|-------------|
| `title` | string | Task title |
| `description` | string | HTML description |
| `notes` | string | Additional notes |
| `status` | string | Task status |
| `type` | string | Task type |
| `color` | string | Colour hex |
| `start_date` | string | Start date |
| `end_date` | string | Due date |
| `actual_start` | string | Actual start |
| `actual_end` | string | Actual end |
| `hours` | string | Hours worked |
| `estimated_hours` | number | Estimated hours |
| `assigned_to` | number | Assigned user ID |
| `assigned_to_name` | string | Assigned user name |
| `workflow_phase` | string | Workflow phase |
| `approval_required` | number | 0 or 1 |
| `parent_task_id` | number | Parent task |
| `task_order` | number | Display order |
| `order_number` | string | Order reference |
| `software_id` | number | Software ID |
| `module_id` | number | Module ID |
| `module_name` | string | Module name |
| `task_billed` | number | Billing status |
| `task_bill_date` | string | Bill date |
| `priority` | string | Local priority |
| `is_bookmarked` | number | Bookmark flag |
| `color_label` | string | Colour label |
| `local_tags` | string[] | Tag array |
| `kanban_order` | number | Kanban sort |
| `view_count` | number | View count |
| `last_viewed_at` | string | Last viewed |

---

#### `DELETE /:id` — Soft-delete task

Sets `task_deleted = 1` and `local_dirty = 1`. Does **not** hard-delete.

---

### 3.4 Bulk Operations

#### `PATCH /bulk` — Batch update

For kanban reorder, bulk priority changes, etc.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `updates` | array | ✅ | `[{ id, ...fields }]` |

**Allowed fields:** `priority`, `is_bookmarked`, `color_label`, `kanban_order`, `status`

---

### 3.5 Tags

#### `GET /tags` — List all unique tags

Extracts distinct tags from `local_tags` JSON column across all tasks using `JSON_TABLE`.

**Response:**
```json
{
  "status": 1,
  "message": "Success",
  "data": { "tags": ["frontend", "urgent-fix", "backend", "design"] }
}
```

> **⚠️ Route Order:** Registered **before** `/:id` routes.

---

### 3.6 Local Enhancement Endpoints

These endpoints update **local-only** fields that are never synced upstream.

#### `PATCH /:id/bookmark` — Toggle bookmark

Toggles `is_bookmarked` between 0 and 1.

**Response:** `{ status: 1, message: "Bookmarked"|"Unbookmarked", data: { is_bookmarked: 0|1 } }`

---

#### `PATCH /:id/priority` — Set priority

| Body Field | Type | Required | Values |
|------------|------|----------|--------|
| `priority` | string | ✅ | `urgent`, `high`, `normal`, `low` |

---

#### `PATCH /:id/color-label` — Set colour label

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `color_label` | string\|null | ✅ | Colour name or `null` to clear |

---

#### `PATCH /:id/tags` — Set tags

Full replacement — existing tags are overwritten.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `tags` | string[] | ✅ | Array of tag strings (empty array clears) |

---

#### `PATCH /:id/view` — Record view

Increments `view_count` and sets `last_viewed_at = NOW()`. No request body.

---

### 3.7 Invoice Staging

Three-stage workflow: **unbilled** (`task_billed = 0`) → **staged** (`task_billed = 2`) → **invoiced** (`task_billed = 1`).

#### `POST /invoice/stage` — Stage tasks

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `task_ids` | string[] | ✅ | Array of `external_id` values |
| `bill_date` | string | — | ISO date (default: today) |

Only stages tasks with `task_billed = 0`.

---

#### `GET /invoice/staged` — List staged tasks

Returns all tasks with `task_billed = 2`.

**Response:**
```json
{
  "status": 1,
  "data": { "tasks": [...], "count": 5 }
}
```

---

#### `POST /invoice/clear` — Clear all staging

Resets all staged tasks back to unbilled (`task_billed = 0`).

---

#### `POST /invoice/unstage/:id` — Unstage single task

Resets a specific task from staged (`2`) to unbilled (`0`).

---

#### `POST /invoice/process` — Process staged invoices

Syncs all staged tasks to the external portal, then marks them as fully invoiced.

| Body Field | Type | Required | Description |
|------------|------|----------|-------------|
| `apiUrl` | string | ✅ | External API URL (used to resolve source + API key) |

**Workflow:**
1. Get all staged tasks (`task_billed = 2`)
2. Resolve task source from `apiUrl`
3. Call external `POST {baseUrl}/api/tasks-api/invoice-tasks` with external IDs
4. Update local tasks to `task_billed = 1`

**Response:**
```json
{
  "status": 1,
  "message": "5 task(s) invoiced and synced to portal",
  "data": { "processed": 5, "bill_date": "2026-03-10" }
}
```

---

## 4. Error Handling

### Proxy Router Errors

```json
{
  "success": false,
  "error": "Could not resolve task source..."
}
```

HTTP status: `400` for resolution failures, otherwise passes through external API status.

### Local Router Errors

```json
{
  "status": 0,
  "message": "Error description"
}
```

HTTP status: `400` for validation, `404` for not found, `409` for duplicates, `500` for server errors.

---

## 5. curl Examples

### List local tasks with filters

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://mcp.softaware.net.za/api/local-tasks?status=new&priority=high&page=1&limit=20"
```

### Create task via proxy

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task": {"task_name": "Fix login bug", "task_type": "bug-fix"}, "software_id": 5}' \
  "https://mcp.softaware.net.za/api/softaware/tasks"
```

### Toggle bookmark

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  "https://mcp.softaware.net.za/api/local-tasks/42/bookmark"
```

### Sync all sources

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://mcp.softaware.net.za/api/local-tasks/sync"
```

### Stage tasks for invoicing

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_ids": ["101", "102", "103"], "bill_date": "2026-03-10"}' \
  "https://mcp.softaware.net.za/api/local-tasks/invoice/stage"
```

### Stream attachment

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -o screenshot.png \
  "https://mcp.softaware.net.za/api/softaware/tasks/attachments/screenshot.png?software_id=5"
```

---

## 6. AI Assistant Tool Dispatch (v2.2.0)

The Staff AI Assistant provides an alternative interface to the same task APIs. Instead of HTTP routes, the assistant dispatches operations via tool handler functions in `mobileActionExecutor.ts`.

### Entry Point

The assistant framework calls `exec_task_*` functions directly with structured parameters. There are no HTTP endpoints — these are internal function dispatches.

### Write-Path Tools (16)

| Tool Function | Proxied Method | External Endpoint | HTTP Route Equivalent |
|---------------|----------------|-------------------|-----------------------|
| `exec_task_create` | POST | `/api/tasks-api` | `POST /api/softaware/tasks` |
| `exec_task_update` | PUT | `/api/tasks-api/{id}` | `PUT /api/softaware/tasks` |
| `exec_task_delete` | DELETE | `/api/tasks-api/{id}` | `DELETE /api/softaware/tasks/:id` |
| `exec_task_start` | POST | `/api/tasks-api/{id}/start` | `POST /api/softaware/tasks/:id/start` |
| `exec_task_complete` | POST | `/api/tasks-api/{id}/complete` | `POST /api/softaware/tasks/:id/complete` |
| `exec_task_approve` | POST | `/api/tasks-api/{id}/approve` | `POST /api/softaware/tasks/:id/approve` |
| `exec_task_reorder` | POST | `/api/tasks-api/reorder` | `POST /api/softaware/tasks/reorder` |
| `exec_task_comment_add` | POST | `/api/tasks-api/{id}/comments` | `POST /api/softaware/tasks/:id/comments` |
| `exec_task_comment_delete` | DELETE | `/api/tasks-api/comments/{id}` | `DELETE /api/softaware/tasks/comments/:id` |
| `exec_task_attachment_upload` | POST | `/api/tasks-api/{id}/attachments` | `POST /api/softaware/tasks/:id/attachments` |
| `exec_task_attachment_delete` | DELETE | `/api/tasks-api/attachments/{path}` | `DELETE /api/softaware/tasks/:id/attachments/:attId` |
| `exec_task_association_add` | POST | `/api/tasks-api/{id}/associate` | `POST /api/softaware/tasks/:id/associations` |
| `exec_task_association_remove` | DELETE | `/api/tasks-api/{id}/associate` | `DELETE /api/softaware/tasks/:id/associations` |
| `exec_task_time_update` | PUT | `/api/tasks-api/time` | `PUT /api/softaware/tasks/time` |
| `exec_task_invoice` | POST | `/api/tasks-api/invoice-tasks` | `POST /api/softaware/tasks/invoice-tasks` |
| `exec_task_bill` | POST | `/api/tasks-api/bill` | `POST /api/softaware/tasks/bill` |

### Read-Path Tools (6)

| Tool Function | Source | HTTP Route Equivalent |
|---------------|--------|-----------------------|
| `exec_task_list` | `local_tasks` (MySQL) | `GET /api/local-tasks` |
| `exec_task_get` | `local_tasks` (MySQL) | `GET /api/local-tasks/:id` |
| `exec_task_comments` | External API (GET) | `GET /api/softaware/tasks/:id/comments` |
| `exec_task_attachments` | External API (GET) | `GET /api/softaware/tasks/:id/attachments` |
| `exec_task_stats` | External API (GET) | `GET /api/softaware/tasks/stats` |
| `exec_task_associations` | External API (GET) | `GET /api/softaware/tasks/:id/associations` |

### Source Resolution

```
exec_task_*(params, context)
  → resolveTaskSourceForTools(params.software_id)
    → SELECT base_url, api_key FROM task_sources WHERE software_id = ?
    → Returns { baseUrl, apiKey, sourceId }
  → taskProxyV2(baseUrl, path, method, apiKey, body)
    → Native fetch with X-API-Key header
    → Returns { status, data }
```

`resolveTaskSourceForTools()` is the AI assistant equivalent of `resolveTaskSource(req)` from the HTTP proxy router, but takes a direct `softwareId` parameter instead of extracting it from an Express request object.

### Auth & Permissions

The AI assistant checks role permissions at the tool dispatch layer (before reaching the executor functions). The source-level API key pattern is identical to the HTTP routes — no per-user tokens involved.
