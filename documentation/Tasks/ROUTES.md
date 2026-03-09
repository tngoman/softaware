# Tasks Module — API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-03

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 9 |
| **Base URL** | `https://api.softaware.net.za` |
| **Router mount** | `/api/softaware/tasks` |
| **Default auth** | `requireAuth` (JWT) on all endpoints |
| **External auth** | `X-Software-Token` header forwarded as `Authorization: Bearer` to external API |

**Important:** All task endpoints are **proxies**. The backend does not store tasks in its own database — it forwards requests to external software product APIs. The `apiUrl` parameter tells the backend which external API to proxy to.

---

## 2. Endpoint Directory

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | /api/softaware/tasks | JWT + SW Token | List tasks from external API |
| 2 | POST | /api/softaware/tasks | JWT + SW Token | Create task on external API |
| 3 | PUT | /api/softaware/tasks | JWT + SW Token | Update task on external API |
| 4 | DELETE | /api/softaware/tasks/:id | JWT + SW Token | Delete task on external API |
| 5 | POST | /api/softaware/tasks/reorder | JWT + SW Token | Reorder tasks on external API |
| 6 | GET | /api/softaware/tasks/:id/comments | JWT + SW Token | List comments from external API |
| 7 | POST | /api/softaware/tasks/:id/comments/with-attachment | JWT + SW Token | Create comment + upload drawing attachment |
| 8 | POST | /api/softaware/tasks/:id/comments | JWT + SW Token | Post comment to external API |
| 9 | POST | /api/softaware/tasks/authenticate | JWT | Authenticate against external software API |

---

## 3. Common Parameters

### 3.1 Authentication Headers

Every request requires **two** authentication mechanisms:

| Header | Source | Purpose |
|--------|--------|---------|
| `Authorization: Bearer {jwt}` | `localStorage.jwt_token` (added by Axios interceptor) | Internal platform authentication |
| `X-Software-Token: {token}` | `localStorage.software_token_{softwareId}` (added by `softwareAuthHeaders()`) | External software API authentication |

### 3.2 apiUrl Parameter

All proxy endpoints require `apiUrl` — the base URL of the external software API to proxy to.

| Delivery | Used By |
|----------|---------|
| Query param `?apiUrl={url}` | GET and DELETE requests |
| Body field `{ apiUrl: "..." }` | POST and PUT requests |

The `apiUrl` is derived from the selected software's configuration:
- If `external_mode === 'live'` → `external_live_url`
- Otherwise → `external_test_url`

### 3.3 Error Response Format

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

| Status | Error | When |
|--------|-------|------|
| 400 | `apiUrl is required` | Missing `apiUrl` parameter |
| 401 | `Missing Authorization header` | No JWT Bearer token |
| 401 | `Invalid token` | JWT expired or malformed |
| 400 | Various | External API returned an error (proxied through) |

---

## 4. Endpoints — Task CRUD

### 4.1 GET /api/softaware/tasks

**Purpose:** List tasks from the external software API with pagination.

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| apiUrl | string | — (required) | External API base URL |
| page | number | 1 | Page number |
| limit | number | 1000 | Items per page |

**curl Example:**

```bash
curl "https://api.softaware.net.za/api/softaware/tasks?apiUrl=https://external.example.com&page=1&limit=1000" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}"
```

**Proxied To:** `GET {apiUrl}/api/tasks?page={page}&limit={limit}`

**Success Response (200):** Passthrough from external API. Typical shape:

```json
{
  "data": {
    "data": [
      {
        "id": 42,
        "title": "Implement login flow",
        "description": "<p>HTML description</p>",
        "status": "progress",
        "type": "development",
        "hours": "2.50",
        "workflow_phase": "development",
        "created_by_name": "John Doe",
        "assigned_to_name": "Jane Smith",
        "module_name": "Authentication",
        "approval_required": 0,
        "created_at": "2026-03-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "has_next": false,
      "current_page": 1,
      "total": 15
    }
  }
}
```

**Frontend Notes:**
- The `useTasks` hook unwraps `body.data.data || body.data || body` to handle varying response shapes
- Status `"progress"` is normalized to `"in-progress"` on the frontend
- Pagination is auto-followed until `has_next === false` (safety limit: 50 pages)

---

### 4.2 POST /api/softaware/tasks

**Purpose:** Create a new task on the external software API.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| task | object | ✅ | Task data object (see below) |

**Task Object Fields:**

| Field | Type | Description |
|-------|------|-------------|
| task_name | string | Task title (required) |
| task_description | string | HTML description |
| task_notes | string | Additional notes |
| task_status | string | `new`, `progress`, or `completed` |
| task_type | string | `development`, `bug-fix`, `feature`, `maintenance`, `support` |
| task_hours | string | Actual hours (decimal string, e.g., `"2.50"`) |
| task_estimated_hours | string | Estimated hours (decimal string) |
| task_color | string | Hex color (default `#667eea`) |
| software_id | string | ID of the software product |
| module_id | number | Module ID (optional) |
| assigned_to | number | Assigned user ID (optional) |
| task_created_by_name | string | Creator's display name |
| user_name | string | Current user's name |
| task_approval_required | number | `1` if estimated hours > 8, else `0` |

**curl Example:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "task": {
      "task_name": "Fix login bug",
      "task_description": "Users cannot log in with SSO",
      "task_status": "new",
      "task_type": "bug-fix",
      "task_hours": "0.00",
      "task_estimated_hours": "4.00",
      "task_color": "#667eea",
      "task_created_by_name": "John Doe",
      "user_name": "John Doe",
      "task_approval_required": 0
    }
  }'
```

**Proxied To:** `POST {apiUrl}/api/tasks` with the `task` object as body.

**Success Response (200):** Passthrough from external API.

---

### 4.3 PUT /api/softaware/tasks

**Purpose:** Update an existing task on the external software API.

**Request Body:** Same structure as POST, with additional fields:

| Field | Type | Description |
|-------|------|-------------|
| task.task_id | number | ID of the task to update (required for edit) |
| task.workflow_phase | string | Current workflow phase (preserved from original) |

**curl Example:**

```bash
curl -X PUT "https://api.softaware.net.za/api/softaware/tasks" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "task": {
      "task_id": 42,
      "task_name": "Fix login bug (updated)",
      "task_status": "progress",
      "task_type": "bug-fix",
      "task_hours": "2.50",
      "task_estimated_hours": "4.00",
      "user_name": "John Doe"
    }
  }'
```

**Proxied To:** `PUT {apiUrl}/api/tasks` with the `task` object as body.

**Success Response (200):** Passthrough from external API.

---

### 4.4 DELETE /api/softaware/tasks/:id

**Purpose:** Delete a task from the external software API.

**Path Params:** `:id` — the external task ID

**Query Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |

**curl Example:**

```bash
curl -X DELETE "https://api.softaware.net.za/api/softaware/tasks/42?apiUrl=https://external.example.com" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}"
```

**Proxied To:** `DELETE {apiUrl}/api/tasks/{id}`

**Success Response (200):** Passthrough from external API.

---

### 4.5 POST /api/softaware/tasks/reorder

**Purpose:** Update the display order of tasks on the external API.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| orders | object | ✅ | Map of `{ taskId: newPosition }` |

**curl Example:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks/reorder" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "orders": { "42": 1, "43": 2 }
  }'
```

**Proxied To:** `POST {apiUrl}/api/tasks/reorder` with `{ orders }` body.

**Success Response (200):** Passthrough from external API.

---

## 5. Endpoints — Comments

### 5.1 GET /api/softaware/tasks/:id/comments

**Purpose:** List all comments for a task from the external API.

**Path Params:** `:id` — the external task ID

**Query Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |

**curl Example:**

```bash
curl "https://api.softaware.net.za/api/softaware/tasks/42/comments?apiUrl=https://external.example.com" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}"
```

**Proxied To:** `GET {apiUrl}/api/tasks/{id}/comments`

**Success Response (200):** Passthrough from external API. Typical shape:

```json
{
  "data": [
    {
      "comment_id": 101,
      "content": "<p>Comment text with possible HTML</p>",
      "user_name": "John Doe",
      "is_internal": 0,
      "time_spent": "1.50",
      "created_at": "2026-03-02T14:30:00.000Z",
      "attachments": [
        {
          "attachment_id": 5,
          "file_name": "drawing-2026-03-02T14-30-00.png",
          "file_path": "https://external.example.com/storage/attachments/5.png"
        }
      ]
    }
  ]
}
```

**Frontend Notes:**
- Comments are unwrapped via `res.data?.data || res.data?.comments || []`
- Internal comments show an amber "Internal" badge
- Images in comment HTML content are clickable (open in lightbox)

---

### 5.2 POST /api/softaware/tasks/:id/comments/with-attachment

**Purpose:** Create an internal comment with an image attachment. Used by the Excalidraw drawing feature. This is a **two-step operation** — the backend creates the comment, extracts the `comment_id`, then uploads the image as an attachment linked to that comment.

**Path Params:** `:id` — the external task ID

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| content | string | ❌ | HTML content for the comment (default: empty) |
| is_internal | number | ❌ | `1` for internal, `0` for public (default: `1`) |
| imageBase64 | string | ✅ | Base64 data URL of the image (`data:image/png;base64,...`) |
| fileName | string | ❌ | File name for the attachment (default: `drawing.png`) |

**curl Example:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks/42/comments/with-attachment" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "content": "<p><strong>📐 Drawing:</strong> sketch.png</p><img src=\"data:image/png;base64,...\" />",
    "is_internal": 1,
    "imageBase64": "data:image/png;base64,iVBORw0KGgo...",
    "fileName": "drawing-2026-03-03T10-00-00.png"
  }'
```

**Backend Steps:**

1. **Create comment** via `POST {apiUrl}/api/tasks/{id}/comments`:
   ```json
   { "content": "...", "is_internal": 1, "time_spent": 0, "parent_comment_id": null }
   ```

2. **Extract comment_id** from response (tries multiple paths):
   - `data.comment_id`
   - `data.data.comment_id`
   - `data.data.id`
   - `data.id`

3. **Convert base64 to binary:**
   - Strip `data:image/png;base64,` prefix
   - `Buffer.from(base64Data, 'base64')`

4. **Upload as multipart/form-data** via `POST {apiUrl}/api/attachments/development/{id}`:
   - `file` — PNG blob
   - `comment_id` — string ID from step 2

**Success Response (200):**

```json
{
  "success": true,
  "comment": { "comment_id": 101, "content": "..." },
  "comment_id": 101,
  "attachment": { "attachment_id": 5, "file_name": "drawing-2026-03-03T10-00-00.png" }
}
```

**Fallback Response (when comment_id not extractable):**

```json
{
  "comment_id": null,
  "attachment_skipped": true,
  "message": "Comment created but attachment could not be linked (no comment_id returned)"
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `imageBase64 is required` | Missing image data |
| 400 | `apiUrl is required` | Missing API URL |
| 400 | Various | External API error (proxied) |

---

### 5.3 POST /api/softaware/tasks/:id/comments

**Purpose:** Post a text comment to a task on the external API. Supports two request body shapes.

**Path Params:** `:id` — the external task ID

**Request Body (Shape A — explicit fields):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| content | string | ✅ | Comment text/HTML |
| is_internal | number | ❌ | `1` for internal, `0` for public (default: `0`) |
| time_spent | number | ❌ | Hours spent (default: `0`) |
| parent_comment_id | number | ❌ | Parent comment for threading (default: `null`) |

**Request Body (Shape B — wrapped comment):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| comment | object | ✅ | Pre-built comment object passed through as-is |

**curl Example:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks/42/comments" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Software-Token: {software_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "content": "Looks good, merging now.",
    "is_internal": 0
  }'
```

**Proxied To:** `POST {apiUrl}/api/tasks/{id}/comments` with the comment body.

**Success Response (200):** Passthrough from external API.

---

## 6. Endpoints — Authentication

### 6.1 POST /api/softaware/tasks/authenticate

**Purpose:** Authenticate against an external software product's API. Supports password-based login with optional OTP verification.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| apiUrl | string | ✅ | External API base URL |
| username | string | ✅ | External API username (email) |
| password | string | ✅ | External API password |
| otp | string | ❌ | 6-digit OTP code (for second step) |
| otpToken | string | ❌ | OTP session token (returned from first step) |

**curl Example — Initial Login:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks/authenticate" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "username": "admin@example.com",
    "password": "secretpassword"
  }'
```

**Proxied To:** `POST {apiUrl}/api/auth_login` with:
```json
{ "email": "{username}", "password": "{password}", "remember_me": false }
```

**Success Response — Token Issued (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response — OTP Required (200):**

```json
{
  "requires_otp": true,
  "otp_token": "temp-session-token-abc",
  "user_id": 5
}
```

**curl Example — OTP Verification:**

```bash
curl -X POST "https://api.softaware.net.za/api/softaware/tasks/authenticate" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://external.example.com",
    "username": "admin@example.com",
    "password": "secretpassword",
    "otp": "123456",
    "otpToken": "temp-session-token-abc"
  }'
```

**Frontend Auth Flow:**

```
1. handleAuthenticate(false) → POST without OTP
   ├── Token received → setSoftwareToken(id, token) → authVersion++ → loadTasks
   ├── OTP required → setAuthStatus('otp') → show OTP input panel
   └── Error → setAuthStatus('error') → show error message

2. handleAuthenticate(true) → POST with OTP + otpToken
   ├── Token received → same as above
   └── Error → same as above
```

---

## 7. Route Registration Order

**Important:** Express evaluates routes in registration order. The `/:id/comments/with-attachment` route is registered **before** the generic `/:id/comments` route to prevent the parameterized `:id` from consuming `with-attachment` as a comment ID.

```
Registration order in softawareTasks.ts:
1. GET  /                              (line ~79)
2. POST /                              (line ~95)
3. PUT  /                              (line ~108)
4. DELETE /:id                         (line ~121)
5. POST /reorder                       (line ~134)
6. GET  /:id/comments                  (line ~147)
7. POST /:id/comments/with-attachment  (line ~160)  ← BEFORE generic comments POST
8. POST /:id/comments                  (line ~243)  ← AFTER with-attachment
9. POST /authenticate                  (line ~263)
```
