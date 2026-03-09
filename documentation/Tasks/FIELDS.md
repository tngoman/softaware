# Tasks Module — Data Schema

**Version:** 1.0.0  
**Last Updated:** 2026-03-03

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Local MySQL tables** | 0 (proxy-only module) |
| **Local sqlite-vec tables** | 0 |
| **External API entities** | 3 (tasks, comments, attachments) |
| **localStorage keys** | 3 patterns |
| **TypeScript interfaces** | 2 (Software, Task) |

**Important:** The Tasks module stores **no data locally**. All task and comment data lives on external software product APIs. The backend acts as a transparent proxy. The only local persistence is:
1. Per-software authentication tokens in **localStorage**
2. UI preferences (view mode, selected software) in **localStorage**

---

## 2. External API Entities

These are the data shapes returned by external software APIs, as consumed by the proxy and frontend.

### 2.1 Task Entity (External)

**Source:** `GET {apiUrl}/api/tasks` → response items

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | number | — | Unique task identifier on external API |
| title | string | — | Task name (mapped from `task_name`) |
| description | string | ✅ | HTML description |
| status | string | — | `new`, `progress`, `completed`, `pending` |
| type | string | — | `development`, `bug-fix`, `feature`, `maintenance`, `support` |
| hours | string | — | Actual hours worked (decimal string e.g. `"2.50"`) |
| estimatedHours | string | ✅ | Estimated hours (decimal string) |
| created_at | string | ✅ | ISO 8601 timestamp |
| start | string | ✅ | Start date |
| due_date | string | ✅ | Due date |
| actual_start | string | ✅ | Actual start timestamp |
| actual_end | string | ✅ | Actual end timestamp |
| creator | string | ✅ | Creator username |
| created_by_name | string | ✅ | Creator display name |
| workflow_phase | string | ✅ | `intake`, `quality_review`, `triage`, `development`, `verification`, `resolution` |
| assigned_to | number | ✅ | Assigned user ID |
| assigned_to_name | string | ✅ | Assigned user display name |
| module_id | number | ✅ | Module ID |
| module_name | string | ✅ | Module display name |
| software_id | number | ✅ | Parent software ID |
| task_bill_date | string | ✅ | Date billed (empty or date string) |
| task_billed | number | ✅ | `0` or `1` |
| approval_required | number | ✅ | `0` or `1` |
| approved_by | string | ✅ | Approver name |
| approved_at | string | ✅ | Approval timestamp |
| task_order | number | ✅ | Display order |
| parent_task_id | number | ✅ | Parent task (for subtasks) |
| association_type | string | ✅ | Task association type |
| date | string | ✅ | Generic date field |

**Status Normalization:**

The external API uses `"progress"` while the frontend uses `"in-progress"`. The `useTasks` hook normalizes this:

```typescript
const normalized = allTasks.map((t) => ({
  ...t,
  status: t.status === 'progress' ? 'in-progress' as const : t.status,
}));
```

**Task Submission Mapping (frontend → external):**

| Frontend Form Field | External API Field |
|--------------------|--------------------|
| `task_name` | `task_name` |
| `task_description` | `task_description` |
| `task_notes` | `task_notes` |
| `task_status` | `task_status` (uses `"progress"` not `"in-progress"`) |
| `task_type` | `task_type` |
| `task_hours` | `task_hours` |
| `task_estimated_hours` | `task_estimated_hours` |
| `task_color` | `task_color` |
| `software_id` | `software_id` |
| `module_id` | `module_id` (parseInt) |
| `assigned_to` | `assigned_to` (parseInt) |
| `task_created_by_name` | `task_created_by_name` |
| `user_name` | `user_name` |
| `task_approval_required` | `task_approval_required` (1 if est > 8h) |
| (edit only) `task_id` | `task_id` |
| (edit only) `workflow_phase` | `workflow_phase` |

---

### 2.2 Comment Entity (External)

**Source:** `GET {apiUrl}/api/tasks/{id}/comments` → response items

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| comment_id | number | — | Unique comment identifier |
| content | string | — | Comment HTML content |
| user_name | string | ✅ | Author username |
| username | string | ✅ | Alternative author field |
| created_by | string | ✅ | Alternative author field |
| is_internal | number | — | `0` = public, `1` = internal (team-only) |
| time_spent | string | ✅ | Hours spent (decimal string) |
| created_at | string | ✅ | ISO 8601 timestamp |
| parent_comment_id | number | ✅ | Parent comment (for threading) |
| attachments | array | ✅ | Linked file attachments |

**Comment Author Resolution:**

The frontend tries multiple fields for the author display name:
```typescript
c.user_name || c.username || c.created_by || 'Unknown'
```

**Comment Body Shapes (sent to external API):**

Shape A — Explicit fields (from inline comment input):
```json
{
  "content": "This looks good",
  "is_internal": 0,
  "time_spent": 0,
  "parent_comment_id": null
}
```

Shape B — Drawing comment (from Excalidraw):
```json
{
  "content": "<p><strong>📐 Drawing:</strong> drawing-2026-03-03T10-00-00.png</p><img src=\"data:...\" />",
  "is_internal": 1,
  "time_spent": 0,
  "parent_comment_id": null
}
```

---

### 2.3 Attachment Entity (External)

**Source:** Nested in comment `attachments[]` array, or returned from upload endpoint

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| attachment_id | number | — | Unique attachment identifier |
| file_name | string | — | Original file name |
| file_path | string | — | Full URL to the file (on external server) |

**Upload endpoint:** `POST {apiUrl}/api/attachments/development/{taskId}`

Multipart form data:
- `file` — binary PNG blob
- `comment_id` — string, links attachment to a comment

**Attachment rendering in frontend:**

```typescript
// Image attachments: rendered as clickable thumbnails
const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att.file_name || '');
// → <img> with onClick → lightbox

// Other attachments: rendered as download links
// → <a href={att.file_path}> with PaperClipIcon
```

---

### 2.4 Authentication Response (External)

**Source:** `POST {apiUrl}/api/auth_login`

**Success — Token issued:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success — OTP required:**
```json
{
  "requires_otp": true,
  "otp_token": "temporary-session-abc",
  "user_id": 5
}
```

**Error:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

## 3. localStorage Schema

### 3.1 Per-Software Token

| Key Pattern | Value | Set By | Read By |
|-------------|-------|--------|---------|
| `software_token_{softwareId}` | JWT string from external API | `setSoftwareToken()` in auth flow | `softwareAuthHeaders()` in all task/comment requests |

**Example:**
```
Key:   software_token_2
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTcwOTAwMDAwMH0.abc123
```

**Lifecycle:**
- **Created:** When user successfully authenticates with external software API
- **Updated:** On re-authentication (overwritten)
- **Deleted:** Only via `removeSoftwareToken(id)` (currently no UI for this)
- **Persistence:** Survives page reload and browser restart (localStorage)
- **Isolation:** Each software product has its own key — switching software uses the correct token

### 3.2 View Mode

| Key | Value | Default |
|-----|-------|---------|
| `tasksViewMode` | `"list"` or `"grid"` | `"list"` |

### 3.3 Selected Software

| Key | Value | Default |
|-----|-------|---------|
| `selectedTasksSoftware` | JSON string of `Software` object | None |

**Example:**
```json
{
  "id": 2,
  "name": "MyApp",
  "external_mode": "live",
  "external_live_url": "https://api.myapp.com",
  "external_username": "admin@myapp.com",
  "external_password": "***",
  "has_external_integration": true
}
```

**Note:** The full `Software` object is stored, including `external_password`. This is the same data already available from the `GET /softaware/software` endpoint.

---

## 4. Related Local Database Table

### 4.1 `update_software` — Software Configuration (MySQL)

**Module:** Software Management (not Tasks), but directly consumed by Tasks module.

The Tasks module reads from this table indirectly via `GET /softaware/software` to populate the software selector dropdown.

| Column | Type | Relevance to Tasks |
|--------|------|-------------------|
| id | INT | Software ID — used in `software_token_{id}` key |
| name | VARCHAR | Display name in software selector |
| has_external_integration | TINYINT | Filter: only show in Tasks if `= 1` |
| external_username | VARCHAR | Sent to `/authenticate` endpoint |
| external_password | VARCHAR | Sent to `/authenticate` endpoint |
| external_live_url | VARCHAR | apiUrl when mode is `live` |
| external_test_url | VARCHAR | apiUrl when mode is `test`/`development` |
| external_mode | VARCHAR | Determines which URL to use (`live` vs `test`) |

**Filtering logic (TasksPage.tsx):**

```typescript
const taskSoftware = softwareList.filter(sw =>
  sw.has_external_integration &&
  sw.external_username &&
  sw.external_password &&
  (sw.external_live_url || sw.external_test_url)
);
```

Only software with ALL four conditions met appears in the dropdown.

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    localStorage                          │
│                                                          │
│  jwt_token ─────────┐    software_token_2 ──────┐       │
│  tasksViewMode       │    software_token_5        │       │
│  selectedTasksSoftware│                           │       │
└─────────────┬────────┘───────────────────────────┘───────┘
              │                                    │
              ▼                                    ▼
    Authorization: Bearer {jwt}      X-Software-Token: {token}
              │                                    │
              ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│            Backend (Express + requireAuth)                │
│                                                          │
│  1. Validate JWT → extract userId                        │
│  2. Read X-Software-Token → pass to proxyToExternal      │
│  3. Read apiUrl from query/body                          │
│  4. Forward to external API as:                          │
│     Authorization: Bearer {software_token}               │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│            External Software API                         │
│                                                          │
│  Stores all data:                                        │
│  • tasks (CRUD + reorder)                                │
│  • comments (CRUD + threading)                           │
│  • attachments (file storage)                            │
│  • users (auth + assignment)                             │
│  • modules (categorization)                              │
└─────────────────────────────────────────────────────────┘
```
