# Bugs Module - API Routes

**Version:** 1.3.0  
**Last Updated:** 2026-03-11

---

## 1. Route Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/bugs` | Optional JWT | List bugs (paginated, filterable) |
| GET | `/bugs/stats` | Optional JWT | Bug statistics |
| GET | `/bugs/:id` | Optional JWT | Get single bug with comments & attachments |
| POST | `/bugs` | Optional JWT | Create a new bug |
| PUT | `/bugs/:id` | Optional JWT | Update a bug |
| DELETE | `/bugs/:id` | Optional JWT | Delete a bug |
| POST | `/bugs/:id/comments` | Optional JWT | Add a comment |
| DELETE | `/bugs/:id/comments/:commentId` | Optional JWT | Delete a comment |
| POST | `/bugs/:id/attachments` | Optional JWT | Upload attachment(s) |
| DELETE | `/bugs/:id/attachments/:attId` | Optional JWT | Delete an attachment |
| GET | `/bugs/:id/attachments/:attId/download` | None | Download an attachment |
| PUT | `/bugs/:id/workflow` | Optional JWT | Advance workflow phase |
| PUT | `/bugs/:id/assign` | Optional JWT | Assign bug to a user |
| PUT | `/bugs/:id/link-task` | Optional JWT | Link/unlink a task |
| POST | `/bugs/:id/convert-to-task` | Optional JWT | Convert bug to a task |
| POST | `/bugs/from-task/:taskId` | Optional JWT | Convert a task to a bug |

**Auth note:** All routes use optional JWT. If a valid Bearer token is provided, `req.userId` is set. If not, requests still proceed (allows external reporters).

---

## 2. Bug CRUD Endpoints

### 2.1 GET /bugs — List Bugs

**Handler:** `bugs.ts` → `GET /`

**Request:**

```bash
curl -X GET "http://localhost:3000/bugs?status=open&severity=critical&limit=20&page=1" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 200) |
| `status` | string | — | Filter by status |
| `severity` | string | — | Filter by severity |
| `workflow_phase` | string | — | Filter by phase |
| `software_id` | number | — | Filter by software |
| `assigned_to` | number | — | Filter by assignee |
| `search` | string | — | Search in title, description, reporter_name |

**Response (200):**

```json
{
  "status": 1,
  "message": "Success",
  "data": {
    "bugs": [
      {
        "id": 1,
        "title": "Login page crashes on mobile",
        "description": "<p>The login page...</p>",
        "current_behaviour": "Page crashes with white screen",
        "expected_behaviour": "Should display login form",
        "reporter_name": "John Doe",
        "software_id": 5,
        "software_name": "Client Portal",
        "status": "open",
        "severity": "critical",
        "workflow_phase": "intake",
        "assigned_to": null,
        "assigned_to_name": null,
        "created_by": "abc-123",
        "created_by_name": "John Doe",
        "linked_task_id": null,
        "converted_from_task": 0,
        "converted_to_task": null,
        "resolution_notes": null,
        "resolved_at": null,
        "resolved_by": null,
        "created_at": "2026-03-11T10:00:00.000Z",
        "updated_at": "2026-03-11T10:00:00.000Z",
        "comment_count": 3,
        "attachment_count": 1,
        "last_comment": "Investigating the root cause..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 42,
      "pages": 1,
      "has_next": false
    }
  }
}
```

**Business Logic:**
- Builds dynamic WHERE clause from query parameters
- Comment/attachment counts via correlated subqueries
- Sorted by severity (critical first) then created_at DESC
- Uses SQL `FIELD()` for custom severity ordering

---

### 2.2 GET /bugs/stats — Bug Statistics

**Handler:** `bugs.ts` → `GET /stats`

**Request:**

```bash
curl -X GET http://localhost:3000/bugs/stats \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "status": 1,
  "data": {
    "total": 42,
    "by_status": {
      "open": 15,
      "in-progress": 10,
      "pending-qa": 5,
      "resolved": 8,
      "closed": 4
    },
    "by_severity": {
      "critical": 3,
      "high": 12,
      "medium": 20,
      "low": 7
    },
    "by_phase": {
      "intake": 15,
      "qa": 12,
      "development": 15
    },
    "by_software": {
      "Client Portal": 20,
      "Admin Dashboard": 15,
      "API Gateway": 7
    }
  }
}
```

---

### 2.3 GET /bugs/:id — Get Single Bug

**Handler:** `bugs.ts` → `GET /:id`

**Request:**

```bash
curl -X GET http://localhost:3000/bugs/1 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{
  "status": 1,
  "data": {
    "bug": {
      "id": 1,
      "title": "Login page crashes on mobile",
      "status": "open",
      "severity": "critical",
      "workflow_phase": "intake",
      "comments": [
        {
          "id": 1,
          "bug_id": 1,
          "author_name": "John Doe",
          "author_id": "abc-123",
          "content": "Bug reported and entered Intake phase.",
          "is_internal": 0,
          "comment_type": "status_change",
          "created_at": "2026-03-11T10:00:00.000Z"
        }
      ],
      "attachments": [
        {
          "id": 1,
          "bug_id": 1,
          "filename": "bug-1710234567-123456789.png",
          "original_name": "screenshot.png",
          "mime_type": "image/png",
          "file_size": 245760,
          "file_path": "uploads/bugs/bug-1710234567-123456789.png",
          "uploaded_by": "John Doe",
          "created_at": "2026-03-11T10:05:00.000Z"
        }
      ],
      "linked_task": null
    }
  }
}
```

**Business Logic:**
- Fetches bug + comments (ASC) + attachments (ASC) in 3 queries
- If `linked_task_id` is set, fetches basic task info (4th query)

**Error Response (404):**

```json
{ "status": 0, "message": "Bug not found" }
```

---

### 2.4 POST /bugs — Create Bug

**Handler:** `bugs.ts` → `POST /`

**Request:**

```bash
curl -X POST http://localhost:3000/bugs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Login page crashes on mobile",
    "description": "<p>The login page shows a white screen on iOS Safari</p>",
    "current_behaviour": "Page crashes with white screen",
    "expected_behaviour": "Should display login form",
    "reporter_name": "John Doe",
    "software_id": 5,
    "software_name": "Client Portal",
    "severity": "critical",
    "assigned_to": 12,
    "assigned_to_name": "Jane Smith"
  }'
```

**Required Fields:** `title`, `reporter_name`  
**Optional Fields:** `description`, `current_behaviour`, `expected_behaviour`, `software_id`, `software_name`, `severity`, `assigned_to`, `assigned_to_name`, `linked_task_id`, `created_by_name`

**Response (201):**

```json
{
  "status": 1,
  "message": "Bug created",
  "data": {
    "bug": {
      "id": 42,
      "title": "Login page crashes on mobile",
      "status": "open",
      "workflow_phase": "intake",
      "severity": "critical"
    }
  }
}
```

**Business Logic:**
1. Insert bug with `status='open'`, `workflow_phase='intake'`
2. Auto-add workflow comment: "Bug reported and entered Intake phase."
3. **Notify all admins** (in-app + push + email)
4. If `assigned_to` set, **notify assignee** (in-app + push)
5. Return created bug

**Error Response (400):**

```json
{ "status": 0, "message": "title and reporter_name are required" }
```

---

### 2.5 PUT /bugs/:id — Update Bug

**Handler:** `bugs.ts` → `PUT /:id`

**Request:**

```bash
curl -X PUT http://localhost:3000/bugs/42 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution_notes": "Fixed in v2.3.1",
    "resolved_at": "2026-03-11T15:00:00.000Z",
    "resolved_by": "Jane Smith"
  }'
```

**Allowed Fields:** `title`, `description`, `current_behaviour`, `expected_behaviour`, `reporter_name`, `software_id`, `software_name`, `status`, `severity`, `assigned_to`, `assigned_to_name`, `resolution_notes`, `resolved_at`, `resolved_by`, `linked_task_id`

**Response (200):**

```json
{
  "status": 1,
  "message": "Bug updated",
  "data": { "bug": { "id": 42, "status": "resolved" } }
}
```

**Business Logic:**
1. Dynamic SET clause — only updates provided fields
2. If **status changed**:
   - Notify `created_by` (bug_resolved if resolved/closed, else bug_updated)
   - Notify `assigned_to` if different from creator (bug_updated)
   - Email reporter if `reporter_name` is email-shaped
3. If **assigned_to changed**:
   - Notify new assignee (bug_assigned)

---

### 2.6 DELETE /bugs/:id — Delete Bug

**Handler:** `bugs.ts` → `DELETE /:id`

**Request:**

```bash
curl -X DELETE http://localhost:3000/bugs/42 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{ "status": 1, "message": "Bug \"Login page crashes on mobile\" deleted" }
```

**Business Logic:**
1. Fetch attachment file paths
2. Delete each file from disk
3. `DELETE FROM bugs WHERE id = ?` (CASCADE removes comments + attachments rows)

---

## 3. Comment Endpoints

### 3.1 POST /bugs/:id/comments — Add Comment

**Handler:** `bugs.ts` → `POST /:id/comments`

**Request:**

```bash
curl -X POST http://localhost:3000/bugs/42/comments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I can reproduce this on Chrome too.",
    "author_name": "John Doe",
    "is_internal": false,
    "comment_type": "comment"
  }'
```

**Required Fields:** `content`, `author_name`  
**Optional Fields:** `is_internal` (boolean), `comment_type` (string)

**Response (201):**

```json
{
  "status": 1,
  "message": "Comment added",
  "data": {
    "comment": {
      "id": 15,
      "bug_id": 42,
      "author_name": "John Doe",
      "content": "I can reproduce this on Chrome too.",
      "is_internal": 0,
      "comment_type": "comment",
      "created_at": "2026-03-11T12:00:00.000Z"
    }
  }
}
```

**Notification Logic (user comments only — not system/internal):**
1. Notify `bug.created_by` if not the commenter (bug_comment)
2. Notify `bug.assigned_to` if different from creator and not the commenter (bug_comment)
3. Email `bug.reporter_name` if email-shaped

---

### 3.2 DELETE /bugs/:id/comments/:commentId — Delete Comment

**Request:**

```bash
curl -X DELETE http://localhost:3000/bugs/42/comments/15 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{ "status": 1, "message": "Comment deleted" }
```

---

## 4. Attachment Endpoints

### 4.1 POST /bugs/:id/attachments — Upload

**Handler:** `bugs.ts` → `POST /:id/attachments`

**Request:**

```bash
curl -X POST http://localhost:3000/bugs/42/attachments \
  -H "Authorization: Bearer <token>" \
  -F "files=@screenshot.png" \
  -F "files=@log.txt" \
  -F "uploaded_by=John Doe"
```

**Limits:** Max 10 files, max 20MB each (multer)

**Response (201):**

```json
{
  "status": 1,
  "message": "2 attachment(s) uploaded",
  "data": {
    "attachments": [
      {
        "id": 5,
        "bug_id": 42,
        "filename": "bug-1710234567-123456789.png",
        "original_name": "screenshot.png",
        "mime_type": "image/png",
        "file_size": 245760,
        "file_path": "uploads/bugs/bug-1710234567-123456789.png"
      }
    ]
  }
}
```

---

### 4.2 DELETE /bugs/:id/attachments/:attId — Delete Attachment

**Request:**

```bash
curl -X DELETE http://localhost:3000/bugs/42/attachments/5 \
  -H "Authorization: Bearer <token>"
```

**Response (200):**

```json
{ "status": 1, "message": "Attachment deleted" }
```

**Business Logic:** Deletes file from disk, then removes DB row.

---

### 4.3 GET /bugs/:id/attachments/:attId/download — Download

**Request:**

```bash
curl -X GET http://localhost:3000/bugs/42/attachments/5/download \
  --output screenshot.png
```

**Note:** This is the **only** public endpoint — no auth required. Returns the file via `res.download()` with `Content-Disposition: attachment`.

---

## 5. Workflow Endpoints

### 5.1 PUT /bugs/:id/workflow — Advance Phase

**Handler:** `bugs.ts` → `PUT /:id/workflow`

**Request:**

```bash
curl -X PUT http://localhost:3000/bugs/42/workflow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_phase": "qa",
    "user_name": "Jane Smith"
  }'
```

**Required:** `workflow_phase` (one of: `intake`, `qa`, `development`)  
**Optional:** `user_name` (for comment attribution)

**Response (200):**

```json
{
  "status": 1,
  "message": "Workflow updated",
  "data": {
    "bug": { "id": 42, "workflow_phase": "qa", "status": "in-progress" }
  }
}
```

**Business Logic:**
1. Validate phase is in `WORKFLOW_PHASES`
2. Update `workflow_phase` only (status is **not** changed)
3. Log workflow comment: "Workflow phase changed: intake → qa"
4. Notify `created_by` + `assigned_to` (bug_workflow)
5. Email reporter if email-shaped (branded HTML template)

---

### 5.2 PUT /bugs/:id/assign — Assign User

**Handler:** `bugs.ts` → `PUT /:id/assign`

**Request:**

```bash
curl -X PUT http://localhost:3000/bugs/42/assign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assigned_to": 12,
    "assigned_to_name": "Jane Smith",
    "user_name": "Admin User"
  }'
```

**Response (200):**

```json
{
  "status": 1,
  "message": "Assignment updated",
  "data": { "bug": { "id": 42, "assigned_to": 12, "assigned_to_name": "Jane Smith" } }
}
```

**Business Logic:**
1. Set `assigned_to` + `assigned_to_name` (null to unassign)
2. Log assignment comment
3. If new assignee differs from previous, notify new assignee (bug_assigned)

---

## 6. Task Association Endpoints

### 6.1 PUT /bugs/:id/link-task — Link/Unlink Task

**Request:**

```bash
curl -X PUT http://localhost:3000/bugs/42/link-task \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "linked_task_id": 100 }'
```

**Response (200):**

```json
{
  "status": 1,
  "message": "Task linked",
  "data": { "bug": { "id": 42, "linked_task_id": 100 } }
}
```

To unlink: `{ "linked_task_id": null }`

---

### 6.2 POST /bugs/:id/convert-to-task — Bug → Task

**Request:**

```bash
curl -X POST http://localhost:3000/bugs/42/convert-to-task \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "user_name": "Admin User" }'
```

**Response (201):**

```json
{
  "status": 1,
  "message": "Bug converted to task",
  "data": {
    "task": { "id": 200, "title": "[Bug #42] Login page crashes on mobile" },
    "bug_id": "42"
  }
}
```

**Business Logic:**
1. Check not already converted (409 if `converted_to_task` set)
2. Find a `task_sources` row (prefer matching `software_id`, else first available)
3. Create `local_tasks` row with prefixed title, combined description
4. Set `bugs.converted_to_task` and `bugs.linked_task_id`
5. Add conversion comment

**Error (409):**

```json
{ "status": 0, "message": "Bug already converted to a task", "data": { "task_id": 200 } }
```

---

### 6.3 POST /bugs/from-task/:taskId — Task → Bug

**Request:**

```bash
curl -X POST http://localhost:3000/bugs/from-task/100 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reporter_name": "John Doe",
    "severity": "high",
    "current_behaviour": "Feature X is broken",
    "expected_behaviour": "Feature X should work"
  }'
```

**Required:** `reporter_name`  
**Optional:** `current_behaviour`, `expected_behaviour`, `severity`, `software_name`, `created_by_name`

**Response (201):**

```json
{
  "status": 1,
  "message": "Task converted to bug",
  "data": {
    "bug": { "id": 43, "converted_from_task": 1, "linked_task_id": 100 },
    "task_id": "100"
  }
}
```

---

## 7. Response Envelope

All endpoints use a consistent envelope:

```json
{
  "status": 1,         // 1 = success, 0 = error
  "message": "...",    // Human-readable message
  "data": { ... }      // Payload (omitted on some error responses)
}
```

This differs from the Users module which uses `{ success: true, data }`.

---

## 8. Error Responses

| Code | Condition | Body |
|------|-----------|------|
| 400 | Missing required fields | `{ "status": 0, "message": "title and reporter_name are required" }` |
| 400 | No fields to update | `{ "status": 0, "message": "No fields to update" }` |
| 400 | Invalid workflow phase | `{ "status": 0, "message": "Invalid phase. Valid phases: intake, qa, development" }` |
| 400 | No task source available | `{ "status": 0, "message": "No task source available..." }` |
| 404 | Bug not found | `{ "status": 0, "message": "Bug not found" }` |
| 404 | Comment not found | `{ "status": 0, "message": "Comment not found" }` |
| 404 | Attachment not found | `{ "status": 0, "message": "Attachment not found" }` |
| 404 | Task not found | `{ "status": 0, "message": "Task not found" }` |
| 409 | Already converted | `{ "status": 0, "message": "Bug already converted to a task" }` |
| 500 | Internal error | `{ "status": 0, "message": "<error.message>" }` |
