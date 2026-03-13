# Tasks Sync API

External REST API for managing IT Support / Development tasks from outside the portal (VS Code extension, desktop apps, CI pipelines, etc.).

Authenticates via **API key** — no user login or session required.

---

## Base URL

| Environment | URL |
|---|---|
| Local (ServBay) | `http://silulumanzi.local/portal/api/tasks-api` |
| Production | `https://portal.silulumanzi.com/portal/api/tasks-api` |

---

## Authentication

Every request must include an `X-API-Key` header containing a **raw** key string. The server hashes it with SHA-256 and looks it up in the `tb_api_keys` table.

```
X-API-Key: silulumanzi-tasks-dev-key
```

A default development key is seeded during migration. For production, generate a strong random string and insert a row:

```sql
INSERT INTO tb_api_keys (key_name, api_key, scopes, created_by, is_active)
VALUES (
    'VS Code Extension - Production',
    SHA2('your-secret-production-key-here', 256),
    '["tasks","tasks:write"]',
    1,
    1
);
```

### Scopes

Keys can be limited to specific scopes:

| Scope | Allows |
|---|---|
| `tasks` | Read operations (list, show, comments) |
| `tasks:write` | Write operations (create, update, delete, sync, start, complete, add comment) |

If the `scopes` column is `NULL`, all scopes are granted.

### Error responses

| Code | Meaning |
|---|---|
| `401` | Missing or invalid/expired API key |
| `403` | Key doesn't have the required scope |

---

## Response format

All responses follow a consistent envelope:

```json
{
    "status": 1,
    "message": "Success",
    "data": { ... }
}
```

On error:

```json
{
    "status": 0,
    "message": "Error description"
}
```

---

## Endpoints

### List tasks (paginated)

```
GET /api/tasks-api
```

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 50 | Items per page (max 200) |
| `status` | string | — | Filter: `new`, `in-progress`, `completed`, `progress` |
| `type` | string | — | Filter: `development`, `feature`, `bug-fix`, `support`, `general` |
| `search` | string | — | Search in task name/description (numeric values also match task ID) |
| `date_from` | string | — | Filter from date (`YYYY-MM-DD`) |
| `date_to` | string | — | Filter to date (`YYYY-MM-DD`) |
| `exclude_invoiced` | string | — | Set to `1` to hide billed tasks |

**Example:**

```bash
curl -s "http://silulumanzi.local/portal/api/tasks-api?page=1&limit=10&status=new" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"
```

**Response:**

```json
{
    "status": 1,
    "message": "Success",
    "data": {
        "tasks": [ ... ],
        "pagination": {
            "current_page": 1,
            "per_page": 10,
            "total": 113,
            "total_pages": 12,
            "has_next": true,
            "has_prev": false
        }
    }
}
```

---

### Get single task

```
GET /api/tasks-api/{id}
```

**Example:**

```bash
curl -s "http://silulumanzi.local/portal/api/tasks-api/132" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"
```

---

### Create a task

```
POST /api/tasks-api
```

**Required fields:** `task_name`, `task_status`, `task_type`

**Request body (JSON):**

```json
{
    "task_name": "Fix login redirect issue",
    "task_description": "Users are redirected to 404 after SSO login",
    "task_status": "new",
    "task_type": "bug-fix",
    "task_color": "#f56565",
    "task_dev": 0,
    "task_estimated_hours": 2,
    "order_number": "ORD-2026-001",
    "software_id": 2,
    "user_name": "VS Code Extension"
}
```

The API also accepts short field names (same as the response shape):

```json
{
    "title": "Fix login redirect issue",
    "description": "Users are redirected to 404 after SSO login",
    "status": "new",
    "type": "bug-fix",
    "color": "#f56565",
    "estimated_hours": 2
}
```

> **Note:** If `task_start` / `task_end` are not provided, the server auto-generates them (start = 2 hours from now, end = 2 hours after start).

**Response (201):**

```json
{
    "status": 1,
    "message": "Task created",
    "data": {
        "id": 276,
        "title": "Fix login redirect issue",
        "status": "new",
        ...
    }
}
```

---

### Update a task

```
PUT /api/tasks-api/{id}
```

Only send the fields you want to change — all other fields keep their current value (PATCH-like behaviour).

```bash
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/276" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"task_status": "in-progress"}'
```

---

### Delete a task (soft-delete)

```
DELETE /api/tasks-api/{id}
```

Sets `task_deleted = 1`. The task no longer appears in list queries.

---

### Start a task

```
POST /api/tasks-api/{id}/start
```

Sets status to `in-progress` and records `actual_start` timestamp.

---

### Complete a task

```
POST /api/tasks-api/{id}/complete
```

Sets status to `completed`, records `actual_end` timestamp, and calculates `hours`.

---

### Approve a task

```
POST /api/tasks-api/{id}/approve
```

**Optional body:**

```json
{ "approved_by": "Manager Name" }
```

If omitted, the API key name is used as `approved_by`.

---

### List tasks pending approval

```
GET /api/tasks-api/pending-approval
```

Returns tasks that have `task_approval_required = 1` and have not yet been approved.

---

### Bulk sync (upsert)

```
POST /api/tasks-api/sync
```

Create and/or update multiple tasks in a single request. Each task in the array is processed independently:

- If `task_id` (or `id`) is present and exists in the DB → **update**
- Otherwise → **insert** (requires `task_name`, `task_status`, `task_type`)

**Request body:**

```json
{
    "tasks": [
        {
            "task_name": "New task from sync",
            "task_status": "new",
            "task_type": "development",
            "task_color": "#007bff",
            "task_dev": 0
        },
        {
            "task_id": 132,
            "task_status": "completed",
            "task_hours": "50:00"
        }
    ]
}
```

**Response:**

```json
{
    "status": 1,
    "message": "Sync complete: 1 created, 1 updated, 0 failed",
    "data": {
        "created": 1,
        "updated": 1,
        "failed": 0,
        "errors": []
    }
}
```

---

## Attachments (files)

Attachment files are stored on the **production** server (`portal.silulumanzi.com`) in the `/uploads/development/` directory. This directory is served directly by Apache — **no authentication required** — so `download_url` values can be used directly in `<img src>`, `<a href>`, or any browser context.

When running locally, the API transparently redirects download requests to the production static path so that clients always get the file regardless of which environment they target.

### How file serving works

| Scenario | `download_url` points to | Download endpoint behaviour |
|---|---|---|
| File exists on local disk | `http://{host}/uploads/development/{file}` | Served directly with correct `Content-Type` |
| File does **not** exist locally | `https://portal.silulumanzi.com/uploads/development/{file}` | **302 redirect** to production static path |

> **Tip for clients:** Always use the `download_url` field from the list response. It points directly to the static file path (no API key or session needed), so it works in `<img>` tags, browser tabs, and programmatic downloads alike.

---

### List attachments for a task

```
GET /api/tasks-api/{id}/attachments
```

```bash
curl -s "http://silulumanzi.local/portal/api/tasks-api/132/attachments" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"
```

**Response:**

```json
{
    "status": 1,
    "message": "Success",
    "data": [
        {
            "attachment_id": 141,
            "task_id": 132,
            "comment_id": null,
            "uploaded_by": 1,
            "uploaded_by_name": "External Support",
            "file_name": "CAPEX FEATURES.docx",
            "file_path": "task_132_1769417621_69772b9525928.docx",
            "file_size": 29309,
            "file_type": "docx",
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "is_public": 1,
            "uploaded_at": "2026-01-26 10:53:41",
            "is_from_ticket": 0,
            "download_url": "https://portal.silulumanzi.com/uploads/development/task_132_1769417621_69772b9525928.docx"
        }
    ]
}
```

**Key fields:**

| Field | Description |
|---|---|
| `file_name` | Original filename as uploaded by the user |
| `file_path` | Secure server-side filename — used in download/delete URLs |
| `download_url` | **Ready-to-use URL** pointing to the static file path (`/uploads/development/`). No API key or session required — safe for `<img src>`, `<a href>`, and direct browser access. Points to local server if the file exists on disk, otherwise to production. |
| `is_from_ticket` | `1` if the attachment was originally uploaded via a helpdesk ticket that was converted to a task |

---

### Upload an attachment

```
POST /api/tasks-api/{id}/attachments
```

Send as **multipart/form-data** with a `file` field.

**Allowed extensions:** `pdf`, `doc`, `docx`, `xls`, `xlsx`, `txt`, `jpg`, `jpeg`, `png`, `gif`, `zip`, `rar`

**Max size:** 50 MB

```bash
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/132/attachments" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -F "file=@/path/to/document.pdf"
```

**Response (201):**

```json
{
    "status": 1,
    "message": "File uploaded successfully",
    "data": {
        "attachment_id": 148,
        "file_name": "document.pdf",
        "file_path": "task_132_1773088921_69af3099dfc1d.pdf",
        "file_size": 152468,
        "mime_type": "application/pdf"
    }
}
```

> The uploaded file is saved to `uploads/development/` on whichever server received the request.

---

### Download an attachment

```
GET /api/tasks-api/attachments/{filename}
```

The `{filename}` is the `file_path` value from the list or upload response (e.g. `task_132_1769417621_69772b9525928.docx`).

- If the file exists locally → returns the raw file with `Content-Type` / `Content-Disposition` headers.
- If the file does not exist locally → responds with **302 redirect** to the production static path (`https://portal.silulumanzi.com/uploads/development/{filename}`).

Add `?download=1` to force download instead of inline display.

```bash
# Basic download — follows redirect automatically
curl -sL -o document.docx \
  "http://silulumanzi.local/portal/api/tasks-api/attachments/task_132_1769417621_69772b9525928.docx" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

# Or use the download_url from the list response directly (no auth needed)
curl -sL -o screenshot.png \
  "https://portal.silulumanzi.com/uploads/development/task_132_1768561387_696a1aeb54146.png"
```

> **Note:** When using `curl` locally, add the `-L` flag to follow the 302 redirect to production.

---

### Delete an attachment

```
DELETE /api/tasks-api/attachments/{filename}
```

Removes the database record and deletes the file from local disk (if it exists there).

```bash
curl -s -X DELETE \
  "http://silulumanzi.local/portal/api/tasks-api/attachments/task_132_1769417621_69772b9525928.docx" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"
```

> **Important:** This only deletes the file on the server that receives the request. If a file was uploaded on production, deleting it from the local dev API removes the database record but the file still exists on the production disk (and vice versa).

---

## Comments

### List comments for a task

```
GET /api/tasks-api/{id}/comments
```

---

### Add a comment to a task

```
POST /api/tasks-api/{id}/comments
```

**Required fields:** `content`

**Request body:**

```json
{
    "content": "Deployed fix to staging, awaiting QA sign-off.",
    "user_name": "CI Pipeline",
    "comment_type": "comment",
    "source": "api"
}
```

**Optional fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `user_id` | int | 0 | Portal user ID (if known) |
| `user_name` | string | `"API"` | Display name |
| `user_email` | string | `""` | Email address |
| `comment_type` | string | `"comment"` | `comment`, `note`, `status_change` |
| `is_internal` | int | 0 | `1` = internal-only note |
| `is_system` | int | 0 | `1` = system-generated |
| `source` | string | `"api"` | Where comment came from |
| `source_reference` | string | null | External reference (e.g. commit SHA) |
| `parent_comment_id` | int | null | For threaded replies |
| `time_spent` | int | 0 | Minutes spent (for time tracking) |

---

### Delete a comment

```
DELETE /api/tasks-api/comments/{id}
```

Soft-deletes the comment.

---

### Convert a comment to a task

```
POST /api/tasks-api/comments/{id}/convert-to-task
```

Creates a new task from an existing comment's content.

**Optional body overrides:**

```json
{
    "task_name": "Custom title",
    "task_status": "new",
    "task_type": "bug-fix",
    "task_dev": 0
}
```

If omitted, the task title and description are derived from the comment content.

**Response (201):**

```json
{
    "status": 1,
    "message": "Task created from comment",
    "data": {
        "task_id": 277,
        "comment_id": 42,
        "original_task_id": 132
    }
}
```

---

## Task ordering & associations

### Reorder tasks

```
POST /api/tasks-api/reorder
```

**Body:**

```json
{
    "orders": {
        "132": 0,
        "150": 1,
        "165": 2
    }
}
```

---

### Associate a task

```
POST /api/tasks-api/{id}/associate
```

**Body:**

```json
{
    "parent_task_id": 132,
    "association_type": "duplicate",
    "notes": "Same root cause as #132"
}
```

Valid types: `duplicate`, `subtask`, `related`, `blocks`, `blocked_by`

---

### Remove association

```
DELETE /api/tasks-api/{id}/associate
```

---

### Get associated (child) tasks

```
GET /api/tasks-api/{id}/associated
```

Optional filter: `?type=duplicate`

---

### Get parent task

```
GET /api/tasks-api/{id}/parent
```

---

## Task hours

Every task has several time-related fields. Understanding how they interact is key to working with hours correctly.

### Fields overview

| DB column | Response alias | Format | Description |
|---|---|---|---|
| `task_hours` | `hours` | `HH:MM` string | **Recorded hours** — the billable/logged time on the task. This is the primary hours field. |
| `task_estimated_hours` | `estimated_hours` | Decimal float | **Estimate** set when creating the task (e.g. `2.5` = 2 h 30 min). |
| `task_actual_start_time` | `actual_start` | `YYYY-MM-DD HH:MM:SS` | Timestamp recorded when the task is **started** (`POST /{id}/start`). |
| `task_actual_end_time` | `actual_end` | `YYYY-MM-DD HH:MM:SS` | Timestamp recorded when the task is **completed** (`POST /{id}/complete`). |
| `task_start` | `start` | `YYYY-MM-DD HH:MM:SS` | Calendar/scheduled start (used for ordering and display, not for hour calculations). |
| `task_end` | `end` | `YYYY-MM-DD HH:MM:SS` | Calendar/scheduled end. |

### How hours get set

There are **four** ways `task_hours` can be written:

1. **Manual set** — Send `hours` (or `task_hours`) in a `PUT /{id}`, `POST` (create), or `PUT /{id}/hours` request. The value you send is stored as-is.
2. **Auto-calculated on create/update** — If you provide both `actual_start` and `actual_end` in a create or update call, the server calculates `HH:MM` from the difference and overwrites `task_hours`.
3. **Auto-calculated on complete** — When you call `POST /{id}/complete`, the server computes elapsed time from `actual_start` → now and writes it to `task_hours`.
4. **Incremental add** — `POST /{id}/hours/add` adds (or subtracts) a delta to the current `task_hours` value without replacing it.

> **Important:** `task_hours` is a **string** in `HH:MM` format (e.g. `"08:30"`, `"120:00"`). It supports values > 24 hours. The hours endpoints also accept decimal input (e.g. `2.5`) and convert it automatically.

---

### Get hours for a task

```
GET /api/tasks-api/{id}/hours
```

Returns a detailed breakdown of all time fields plus a live elapsed calculation.

**Response:**

```json
{
    "status": 1,
    "message": "Success",
    "data": {
        "task_id": 132,
        "hours": "08:30",
        "hours_decimal": 8.5,
        "estimated_hours": 10,
        "actual_start": "2026-03-10 09:00:00",
        "actual_end": "2026-03-10 17:30:00",
        "elapsed": "08:30",
        "elapsed_decimal": 8.5,
        "status": "completed"
    }
}
```

| Field | Description |
|---|---|
| `hours` | Current recorded hours (`HH:MM`) |
| `hours_decimal` | Same value as a decimal (e.g. `8.5`) |
| `estimated_hours` | The original estimate |
| `elapsed` | Wall-clock time from `actual_start` to `actual_end` (or to **now** if still in-progress). `null` if never started. |
| `elapsed_decimal` | Elapsed as a decimal |

**Example:**

```bash
curl -s "http://silulumanzi.local/portal/api/tasks-api/132/hours" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"
```

---

### Set hours on a task (overwrite)

```
PUT /api/tasks-api/{id}/hours
```

Directly set `task_hours` and/or `task_estimated_hours`. Overwrites the current value.

**Body — accepts any combination:**

```json
{ "hours": "12:30" }
```

```json
{ "hours": 12.5 }
```

```json
{ "estimated_hours": 8 }
```

```json
{ "hours": "04:00", "estimated_hours": 6 }
```

| Field | Type | Description |
|---|---|---|
| `hours` | `HH:MM` string **or** decimal | Sets `task_hours`. Decimal values are converted (`2.5` → `"02:30"`). |
| `estimated_hours` | Decimal float | Sets `task_estimated_hours`. |

At least one field is required.

**Response:**

```json
{
    "status": 1,
    "message": "Hours updated",
    "data": {
        "id": 132,
        "hours": "12:30",
        "estimated_hours": 8,
        ...
    }
}
```

**Examples:**

```bash
# Set to exactly 4 hours 15 minutes
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/132/hours" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": "04:15"}'

# Set using decimal (2.5 hours = 02:30)
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/132/hours" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": 2.5}'

# Set both hours and estimate
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/132/hours" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": "08:00", "estimated_hours": 10}'

# Reset hours to zero
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/132/hours" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": 0}'
```

---

### Add hours to a task (increment)

```
POST /api/tasks-api/{id}/hours/add
```

Adds a time delta to the existing `task_hours`. Use negative values to subtract.

**Body:**

```json
{ "hours": "02:30" }
```

```json
{ "hours": 2.5 }
```

```json
{ "hours": -1.5 }
```

The result is floored at `00:00` — hours can never go negative.

**Response:**

```json
{
    "status": 1,
    "message": "Hours added",
    "data": {
        "previous_hours": "08:00",
        "added": "02:30",
        "new_hours": "10:30",
        "task": { ... }
    }
}
```

**Examples:**

```bash
# Add 2 hours 30 minutes
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/132/hours/add" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": "02:30"}'

# Add 1.5 hours using decimal
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/132/hours/add" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": 1.5}'

# Subtract 45 minutes
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/132/hours/add" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"hours": -0.75}'
```

---

### Update time (legacy)

```
PUT /api/tasks-api/time
```

Re-calculates `task_hours` from `start` and `end` datetimes. This is the original calendar-drag endpoint — prefer the endpoints above for direct hour manipulation.

**Body:**

```json
{
    "id": 132,
    "start": "2026-03-10 09:00:00",
    "end": "2026-03-10 17:00:00"
}
```

The server computes the difference and writes it to `task_hours` (in `HH.MM` format for this legacy endpoint).

---

## Billing & statistics

### Bill tasks

```
POST /api/tasks-api/bill
```

Mark task(s) as billed. Send the same fields expected by `task_bill()`.

---

### Invoice tasks

```
POST /api/tasks-api/invoice-tasks
```

**Body:**

```json
{
    "task_ids": [132, 150, 165],
    "bill_date": "2026-03-09"
}
```

---

### Statement

```
GET /api/tasks-api/statement
```

Returns all development tasks as JSON (suitable for client-side PDF generation).

---

### Statistics

```
GET /api/tasks-api/stats
```

**Response:**

```json
{
    "status": 1,
    "message": "Success",
    "data": {
        "total_tasks": 113,
        "new_tasks": 21,
        "in_progress": 1,
        "completed": 90,
        "total_hours": 301,
        "this_week_tasks": 0,
        "overdue_tasks": 23
    }
}
```

---

## Order budgets

### Get latest order number

```
GET /api/tasks-api/orders/latest
```

---

### Get order budget

```
GET /api/tasks-api/orders/{order_number}/budget
```

---

### Get all order budgets

```
GET /api/tasks-api/orders/budgets
```

---

## Task field reference

### Full field list

Fields accepted on create/update (use either the `task_*` name or the short alias):

| Internal field | Short alias | Type | Required | Default | Description |
|---|---|---|---|---|---|
| `task_name` | `title` | string | **Yes** | — | Task title |
| `task_description` | `description` | string | No | `""` | Detailed description |
| `task_notes` | `notes` | string | No | `null` | Internal notes |
| `task_status` | `status` | string | **Yes** | — | `new`, `in-progress`, `completed`, `progress` |
| `task_type` | `type` | string | **Yes** | — | `development`, `feature`, `bug-fix`, `support`, `general` |
| `task_color` | `color` | string | No | `#3788d8` | Hex colour for calendar |
| `task_start` | `start` | datetime | No | auto | Start datetime (`YYYY-MM-DD HH:MM:SS`) |
| `task_end` | `end` | datetime | No | auto | End datetime |
| `task_hours` | `hours` | string | No | `00:00` | Hours worked (`HH:MM` format) |
| `task_estimated_hours` | `estimated_hours` | float | No | `0` | Estimated hours |
| `task_dev` | — | int | No | `0` | `0` = IT Support, `1` = Development |
| `task_order` | `order` | int | No | auto | Sort order |
| `order_number` | — | string | No | `null` | Budget order number |
| `parent_task_id` | — | int | No | `null` | ID of parent task (for associations) |
| `association_type` | — | string | No | `null` | e.g. `duplicate`, `related` |
| `association_notes` | — | string | No | `null` | Notes about the association |
| `actual_start` | — | datetime | No | `null` | Actual start time |
| `actual_end` | — | datetime | No | `null` | Actual end time |
| `software_id` | — | int | No | `1` | Software/system identifier |
| `task_created_by_name` | `created_by_name` | string | No | `"API"` | Who created the task |
| `task_approval_required` | `approval_required` | int | No | `0` | `1` = needs approval |
| `task_direction` | — | int | No | `null` | `1` = IT Support Tasks |
| `workflow_phase` | — | string | No | `null` | Workflow phase (e.g. `intake`, `development`, `verification`, `completed`) |
| `module_id` | — | int | No | `null` | Module identifier for workflow assignment |
| `user_id` | — | int | No | `0` | Assigned portal user ID |
| `user_name` | — | string | No | `"API"` | Display name for audit trail |

---

## Managing API keys

### Create a new key

```sql
INSERT INTO tb_api_keys (key_name, api_key, scopes, created_by, is_active)
VALUES (
    'Desktop App - Production',
    SHA2('generate-a-strong-random-string', 256),
    '["tasks","tasks:write"]',
    1,
    1
);
```

### Create a read-only key

```sql
INSERT INTO tb_api_keys (key_name, api_key, scopes, created_by, is_active)
VALUES (
    'Dashboard Widget (read-only)',
    SHA2('dashboard-readonly-key', 256),
    '["tasks"]',
    1,
    1
);
```

### Set an expiry

```sql
INSERT INTO tb_api_keys (key_name, api_key, scopes, created_by, is_active, expires_at)
VALUES (
    'Temp CI Key',
    SHA2('temp-ci-key-2026', 256),
    '["tasks","tasks:write"]',
    1,
    1,
    '2026-12-31 23:59:59'
);
```

### Revoke a key

```sql
UPDATE tb_api_keys SET is_active = 0 WHERE key_name = 'Desktop App - Production';
```

### See when keys were last used

```sql
SELECT key_name, last_used_at, is_active FROM tb_api_keys ORDER BY last_used_at DESC;
```

---

## Architecture notes

| File | Purpose |
|---|---|
| `portal/app/Core/ApiKeyController.php` | Base controller — validates `X-API-Key`, provides `sendSuccess`/`sendError` helpers |
| `portal/app/Controllers/ApiTasks.php` | Task CRUD + sync + attachment/comment endpoints |
| `portal/app/Core/ApiRouter.php` | Routes registered under `tasks-api` resource |
| `portal/app/Controllers/ApiDevelopment.php` | Existing session-based task management (attachment list/download also updated with `download_url` and production redirect) |
| `portal/app/Models/Dev.php` | Shared model used by both controllers (includes `workflow_phase` and `module_id` in INSERT/UPDATE) |
| `database/migrations/2026_03_09_create_api_keys_table.sql` | Migration for `tb_api_keys` |
| `uploads/development/` | Static file storage — served directly by Apache (no auth). Production files live on `portal.silulumanzi.com`, local dev redirects there |

The new API deliberately **does not** extend `ApiController` and never touches PHP sessions. This means:

- It won't interfere with portal user sessions
- It can be called from any HTTP client without cookies
- The existing `ApiDevelopment` controller is completely unmodified

---

## Quick start

```bash
# 1. Run the migration (if not already done)
mysql --socket=/tmp/mysql.sock -uroot -proot silulumanzi \
  < database/migrations/2026_03_09_create_api_keys_table.sql

# 2. List all tasks
curl -s "http://silulumanzi.local/portal/api/tasks-api" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" | python3 -m json.tool

# 3. Create a task
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"task_name":"Hello from API","task_status":"new","task_type":"development","task_color":"#007bff","task_dev":0}'

# 4. Update it (only send changed fields)
curl -s -X PUT "http://silulumanzi.local/portal/api/tasks-api/TASK_ID" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"task_status":"in-progress"}'

# 5. Start → complete lifecycle
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/TASK_ID/start" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/TASK_ID/complete" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

# 6. Upload a file
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/TASK_ID/attachments" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -F "file=@/path/to/document.pdf"

# 7. List attachments
curl -s "http://silulumanzi.local/portal/api/tasks-api/TASK_ID/attachments" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

# 8. Download a file (use file_path from the list response)
curl -s -o output.pdf \
  "http://silulumanzi.local/portal/api/tasks-api/attachments/FILENAME" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

# 9. Get stats
curl -s "http://silulumanzi.local/portal/api/tasks-api/stats" \
  -H "X-API-Key: silulumanzi-tasks-dev-key"

# 10. Bulk sync
curl -s -X POST "http://silulumanzi.local/portal/api/tasks-api/sync" \
  -H "X-API-Key: silulumanzi-tasks-dev-key" \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"task_name":"Bulk task 1","task_status":"new","task_type":"feature","task_color":"#48bb78","task_dev":0},{"task_id":132,"task_status":"completed"}]}'
```
