# Tasks Module — Overview

**Version:** 1.5.0  
**Last Updated:** 2026-03-04

---

## 1. Module Overview

### Purpose

The Tasks module manages development tasks by proxying all CRUD operations to external software product APIs. Unlike most modules in the platform, tasks do **not** live in the local database — they are stored on each software product's own API, and the backend acts as a transparent proxy with dual-token authentication (internal JWT + per-software external token). The frontend provides a comprehensive task management UI with:

- **Dashboard Integration** — Direct task access from Dashboard bugfix list and workflow phase popovers
- **Workflow Management** — Full assignment controls with phase-based role filtering and permissions
- **Task Associations** — Link tasks as blockers, duplicates, children, related, or follow-ups
- **Rich Text Editing** — WYSIWYG editor (react-quill) for task descriptions
- **Date/Time Controls** — DatePicker components for start date, due date, and completion date
- **Attachment Management** — Upload, paste, view, and delete attachments with thumbnail previews
- **Excalidraw Integration** — Inline drawing tool saved as comments with file attachments
- **Push Notifications** — Task assignments trigger both web and mobile notifications via Firebase
- **View-As Role** — Staff users can experience the app as any role to test permissions
- **Inline Authentication** — Per-software OTP-supported auth directly on the TasksPage
- **Comment History Display** — Last comment shown in task list workflow phase row
- **Internal Comments** — Mark comments as internal (not visible to clients) with checkbox
- **Intuitive Comment Layout** — Comment history shown first, input section at bottom (natural reading flow)
- **Drawing Tool** — Excalidraw integration with fixed canvas sizing and library hidden
- **Task Creation Feedback** — Auto-opens newly created task in view modal
- **Billed Task Filtering** — Hides billed/invoiced tasks from all lists and dashboard counts by default with toggle

### Business Value

- Centralized task management across multiple external software products from a single dashboard
- Per-software authentication with OTP support — authenticate once per software, tokens persist in localStorage
- Dual-token architecture: internal JWT for platform access, per-software external tokens for API access
- Complete task lifecycle: create, edit, delete, assign, link, attach, comment, draw
- **Workflow enforcement** — Role-based permissions control who can assign tasks from each phase
- **Real-time notifications** — Assigned users receive instant push/web notifications when tasks are assigned to them
- **User preference control** — Users can disable web or push notifications independently
- Software dropdown filtered to only show products with valid external integration configuration
- List and grid view modes with persistent preference

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 2 (softawareTasks.ts, profile.ts + notifications) |
| Frontend source files | 7 (TasksPage.tsx, Dashboard.tsx, useTasks.ts, ExcalidrawDrawer.tsx, RichTextEditor.tsx, workflowPermissions.ts, TaskAttachmentsInline.tsx) |
| Frontend utility files | 2 (softwareAuth.ts, workflowPermissions.ts) |
| Backend LOC | ~600 (285 + ~200 notifications + ~115 profile) |
| Frontend LOC | ~3,800 (2,241 TasksPage + 955 Dashboard + 111 RichText + 219 Excalidraw + 174 workflowPermissions + others) |
| Total LOC | ~3,750 |
| API endpoints | 15 (9 tasks + 3 notifications + 3 profile) |
| MySQL tables | 3 (notifications, fcm_tokens, users.notification_prefs) |
| External dependencies | @excalidraw/excalidraw (0.18.0), react-quill (2.0.0), react-datepicker (8.8.0), date-fns (2.30.0), @headlessui/react |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ TasksPage.tsx (2,110 LOC) — Main page + 5 embedded dialogs            │  │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │  │
│  │  │ TasksPage    │  │ TaskDialog       │  │ TaskDetailsDialog       │  │  │
│  │  │ • SW selector│  │ • 3 tabs layout  │  │ • View + Comments       │  │  │
│  │  │ • Auth flow  │  │ • RichTextEditor │  │ • Excalidraw drawing    │  │  │
│  │  │ • Filters    │  │ • DatePickers    │  │ • Image lightbox        │  │  │
│  │  │ • Task cards │  │ • Attachments    │  │ • Attachment management │  │  │
│  │  │ • Assign btn │  │ • Hours tracking │  │ • Delete attachment     │  │  │
│  │  └──────────────┘  └──────────────────┘  └─────────────────────────┘  │  │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────────┐   │  │
│  │  │ WorkflowDialog           │  │ TaskAssociationDialog            │   │  │
│  │  │ • Role-based user filter │  │ • 5 association types            │   │  │
│  │  │ • Phase transition logic │  │ • Searchable task picker         │   │  │
│  │  │ • Module assignment      │  │ • Association notes              │   │  │
│  │  │ • Permission checking    │  │ • View existing associations     │   │  │
│  │  └──────────────────────────┘  └──────────────────────────────────┘   │  │
│  └──────────────┬─────────────────────────────────────────┬──────────────┘  │
│                 │                                          │                  │
│  ┌──────────────▼──────────┐   ┌──────────────────────────▼──────────────┐  │
│  │ useTasks.ts (hook)      │   │ RichTextEditor.tsx + ExcalidrawDrawer   │  │
│  │ • Paginated fetch       │   │ • Lazy-loaded @excalidraw/excalidraw    │  │
│  │ • Status normalization  │   │ • Quill WYSIWYG with toolbar            │  │
│  │ • Per-SW auth headers   │   │ • PNG export + scene JSON               │  │
│  └──────────────┬──────────┘   └──────────────────────────────────────────┘  │
│                 │                                                             │
│  ┌──────────────▼──────────────────────────────────────────────────────────┐ │
│  │ workflowPermissions.ts — Permission utilities + View-As Role            │ │
│  │ • canUserAssignTask() — Phase-based permission checks                   │ │
│  │ • getEffectiveRole() — Staff view-as role override                      │ │
│  │ • Phase-to-role mapping (PHASE_ROLE_MAP)                                │ │
│  └──────────────┬──────────────────────────────────────────────────────────┘ │
│                 │                                                             │
│  ┌──────────────▼──────────┐   ┌──────────────────────────────────────────┐  │
│  │ softwareAuth.ts (util)  │   │ api.ts — Axios client                   │  │
│  │ • get/set/remove token  │   │ • Base URL from env                     │  │
│  │ • per-SW localStorage   │   │ • JWT interceptor (Authorization)       │  │
│  │ • softwareAuthHeaders() │   │ • 401 redirect to /login                │  │
│  └─────────────────────────┘   └──────────────────────┬──────────────────┘  │
└────────────────────────────────────────────────────────┼──────────────────────┘
                                                         │
                          Two auth headers on every request:
                          • Authorization: Bearer {jwt_token}      ← internal
                          • X-Software-Token: {software_token_N}   ← external
                                                         │
                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Express)                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  /api/softaware/tasks/*  →  softawareTasks.ts (softawareTasksRouter)  │  │
│  │                                                                        │  │
│  │  GET  /                              — Proxy: list tasks              │  │
│  │  POST /                              — Proxy: create task             │  │
│  │  PUT  /                              — Proxy: update task             │  │
│  │        ↳ On success: sendTaskAssignmentNotification() if assigned    │  │
│  │  DELETE /:id                         — Proxy: delete task             │  │
│  │  POST /reorder                       — Proxy: reorder tasks           │  │
│  │  GET  /:id/comments                  — Proxy: list comments           │  │
│  │  POST /:id/comments/with-attachment  — Two-step: comment + upload     │  │
│  │  POST /:id/comments                  — Proxy: post comment            │  │
│  │  GET  /:id/associations              — Proxy: get associations        │  │
│  │  POST /:id/associations              — Proxy: create association      │  │
│  │  DELETE /:id/associations/:assoc_id  — Proxy: delete association      │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
│                                │                                              │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐  │
│  │  /api/notifications  →  notifications.ts + firebaseService.ts         │  │
│  │  GET  /                    — List user notifications                   │  │
│  │  GET  /unread/count        — Badge count                               │  │
│  │  PUT  /:id/read            — Mark read                                 │  │
│  │  PUT  /read-all            — Mark all read                             │  │
│  │  POST /                    — Create notification + send push           │  │
│  │  POST /test-push           — Test FCM                                  │  │
│  │                                                                         │  │
│  │  /api/fcm-tokens           — FCM device token management               │  │
│  │  POST /                    — Register device                           │  │
│  │  GET  /                    — List user devices                         │  │
│  │  DELETE /:token            — Unregister device                         │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
│                                │                                              │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐  │
│  │  /api/profile  →  profile.ts                                          │  │
│  │  GET  /                    — Get user profile + notification prefs     │  │
│  │  PUT  /                    — Update profile + notification prefs       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  proxyToExternal(apiUrl, path, method, softwareToken, body?)          │  │
│  │  • Builds full URL from apiUrl + path                                  │  │
│  │  • Sets Authorization: Bearer {softwareToken} on outgoing request     │  │
│  │  • Forwards body as JSON                                               │  │
│  │  • Returns { status, data } from external API                         │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
│                                │                                              │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐  │
│  │  Firebase Admin SDK — firebaseService.ts                               │  │
│  │  • createNotificationWithPush() — Insert DB + send FCM                 │  │
│  │  • sendPushToUser() — Multi-device push with stale token cleanup      │  │
│  │  • Respects user notification preferences (web/push toggles)          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  EXTERNAL SOFTWARE APIs       │
                  │                                │
                  │  Each software product has:    │
                  │  • /api/auth_login             │
                  │  • /api/tasks (CRUD)           │
                  │  • /api/tasks/:id/comments     │
                  │  • /api/tasks/:id/associated   │
                  │  • /api/tasks/:id/associate    │
                  │  • /api/tasks/reorder          │
                  │  • /api/attachments/dev/:id    │
                  └──────────────────────────────┘
```
│  │  • Returns { status, data } from external API                         │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  EXTERNAL SOFTWARE APIs       │
                  │                                │
                  │  Each software product has:    │
                  │  • /api/auth_login             │
                  │  • /api/tasks (CRUD)           │
                  │  • /api/tasks/:id/comments     │
                  │  • /api/tasks/reorder          │
                  │  • /api/attachments/dev/:id    │
                  └──────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Software Authentication

```
User selects software from dropdown → Check hasSoftwareToken(id)
  → If token exists: load tasks immediately
  → If no token: show "Authentication Required" panel

User clicks "Authenticate":
  → POST /api/softaware/tasks/authenticate
    { apiUrl, username: sw.external_username, password: sw.external_password }
  → Backend proxies to external /api/auth_login

  Response scenarios:
    A. { success: true, token: "..." }
       → setSoftwareToken(softwareId, token) → localStorage
       → authVersion++ → re-render → loadTasks()

    B. { requires_otp: true, otp_token: "..." }
       → Show OTP input panel → user enters 6-digit code
       → POST /api/softaware/tasks/authenticate (with otp + otpToken)
       → On success: same as (A)

    C. Error
       → Show error message in red panel
```

### 3.2 Task CRUD

```
Load tasks (on auth or refresh):
  → useTasks hook: GET /api/softaware/tasks?apiUrl={url}&page=1&limit=1000
    ├── Headers: Authorization (JWT) + X-Software-Token (per-software)
    ├── Backend: requireAuth → proxyToExternal(apiUrl, /api/tasks?page=N&limit=N)
    └── Response: unwrap body.data.data || body.data || body → Task[]
  → Normalize: status "progress" → "in-progress"
  → Paginate: auto-fetch pages until has_next=false (safety limit: 50 pages)

Create/Edit task:
  → TaskDialog form → POST or PUT /api/softaware/tasks
    { apiUrl, task: { task_name, task_description, task_status, ... } }
  → Backend proxies to external /api/tasks
  → On success: toast + loadTasks()

Delete task:
  → SweetAlert2 confirmation → DELETE /api/softaware/tasks/:id?apiUrl={url}
  → Backend proxies to external /api/tasks/:id
  → On success: toast + loadTasks()

Status change (Start / Complete):
  → PUT /api/softaware/tasks { apiUrl, task: { id, status, user_name } }

Reorder:
  → POST /api/softaware/tasks/reorder
    { apiUrl, orders: { [taskId]: newPosition } }
```

### 3.3 Comments & Drawing

```
View comments:
  → TaskDetailsDialog opens → GET /api/softaware/tasks/:id/comments?apiUrl={url}
  → Display in scrollable list with user_name, timestamp, is_internal badge

Post text comment:
  → POST /api/softaware/tasks/:id/comments { apiUrl, content }
  → Re-fetch comments

Post drawing (Excalidraw):
  → User clicks "Draw" → ExcalidrawDrawer opens (z-60 overlay)
  → User draws → clicks "Save as Comment"
  → exportToBlob() → base64 data URL + scene JSON
  → POST /api/softaware/tasks/:id/comments/with-attachment
    { apiUrl, content: "<html with embedded img>", is_internal: 1, imageBase64, fileName }

  Backend two-step:
    1. POST comment to external /api/tasks/:id/comments → get comment_id
    2. Convert base64 → Buffer → FormData(file + comment_id)
       POST to external /api/attachments/development/:id
    3. Return { success, comment, comment_id, attachment }

  → Toast success → refetchComments() → drawing appears in comment list
  → Click image → lightbox overlay (z-70)
```

---

## 4. Key Features

### 4.1 Dashboard Task Integration

**Direct Task Access:** The Dashboard provides quick access to tasks without requiring navigation to the full Tasks page first.

**Bugfix List:**
- Active bugs displayed in "Active Bugs" card
- Click any bug to navigate directly to Tasks page with task details opened
- Shows task title, relative time, and status
- Clickable cards with hover effect

**Workflow Pipeline Phase Popovers:**
- Click any workflow phase (Intake, QA Review, Development, etc.) to see tasks in that phase
- Modal popover shows all active tasks for the selected phase
- Task cards display: type icon, title, module, hours, status, assignee, and time
- Click any task in popover to navigate to Tasks page with details opened
- Phases with 0 tasks are dimmed (50% opacity) and not clickable

**Navigation Flow:**
1. User clicks task in Dashboard (bugfix or phase popover)
2. Task ID stored in `localStorage.openTaskId`
3. Navigate to `/tasks`
4. TasksPage detects stored ID and auto-opens TaskDetailsDialog
5. localStorage cleared after opening

**Benefits:**
- No intermediate confirmation dialogs
- Seamless navigation from Dashboard to full task view
- Maintains software context across navigation
- One-click access to task details, comments, attachments

### 4.2 Complete Workflow Management System

**Role-Based Permissions:** The `workflowPermissions.ts` utility enforces who can assign tasks from each workflow phase. Permission checks respect the user's effective role (with view-as override for staff).

**Phase-Role Mapping:**
| Workflow Phase | Required Role | Can Assign To |
|----------------|---------------|---------------|
| Intake | Client Manager | QA Specialists |
| Quality Review / Triage | QA Specialist | Client Managers (send back) or Modules (forward to dev) |
| Development | Developer | Other Developers or QA Specialists |
| Verification / Resolution | QA Specialist | Developers or QA Specialists |

**WorkflowDialog Features:**
- Role-based user filtering (admins excluded from assignment lists)
- Current user (assigner) excluded from available assignees
- Module assignment for QA→Development transition
- "Send back to intake" checkbox for QA/triage phase
- Automatic phase transition based on assigned user's role
- Permission error alerts when user lacks authorization
- Internal comment field for workflow notes

### 4.3 Task Association System

**5 Association Types:**
1. **Blocker** — This task blocks another task
2. **Duplicate** — This task duplicates another task
3. **Child** — This task is a child of a parent task
4. **Related** — General relationship
5. **Follow-up** — This task follows up on another task

**TaskAssociationDialog Features:**
- Searchable task picker (by title or ID)
- Selected task preview with title and ID badge
- Optional association notes
- View existing associations with type badges
- Delete existing associations
- Proxy routes to external API: GET/POST/DELETE `/:id/associations`

### 4.4 Last Comment Display in Task List

**Purpose:** Provide quick context about task progress without opening the full task details.

**Implementation:**
- Fetches last comment for each task when tasks are loaded
- Displays in gray workflow phase row below task card
- Shows up to 60 characters with "..." truncation
- HTML tags stripped from comment content
- Chat bubble icon indicates comment presence
- Only fetches for first 50 tasks (performance optimization)

**Visual Design:**
- Border-top separator from phase info
- Italic gray text for subtle appearance
- Single-line with line-clamp for overflow
- Loads asynchronously without blocking task display

### 4.5 Rich Task Editing (TaskDialog 3-Tab Layout)

**Tab 1: General**
- Title, description (WYSIWYG), status, type
- Priority, severity, estimated hours
- Attachment upload (drag-drop or click)
- Attachment paste from clipboard (images)
- Attachment list with thumbnails and delete buttons

**Tab 2: Timing**
- Start Date (DatePicker)
- Due Date (DatePicker)
- Completion Date (DatePicker)
- Date-fns for formatting

**Tab 3: Attachments**
- Full attachment management
- Thumbnail previews for images
- File icons for documents
- Delete button per attachment
- Upload new files
- Paste from clipboard

**RichTextEditor (react-quill):**
- Toolbar: Bold, Italic, Underline, Strike, Lists, Links, Clean
- Image paste support (base64 embed)
- 250px height with scroll
- Blue border on focus

### 4.6 Internal Comment System

**Purpose:** Allow staff to add comments that are not visible to clients.

**Comment Input Section:**
- **Prominent Design:** Blue background box (bg-blue-50) with 2px border for high visibility
- **Clear Header:** "Add Comment" title with ChatBubbleLeftIcon
- **Enhanced Input:** Larger text field with blue border and focus states
- **Internal Checkbox:** Shield icon + "Internal comment (not visible to clients)" label
- **Bigger Buttons:** "Post Comment" button with clear labeling
- **Attachment Support:** Drawing button (PaperClipIcon) for Excalidraw integration

**Internal Comment Features:**
- Checkbox below comment input field
- When checked, sends `is_internal: 1` flag to API
- Internal comments display amber "Internal" badge in comment history
- Checkbox state resets after posting comment
- Keyboard shortcut: Enter to post (Shift+Enter for line break)

**Comment History Section:**
- Separated from input with "Comment History" header
- Shows total comment count in header
- Scrollable list (max-height: 400px)
- Each comment shows: username, timestamp, hours spent, internal badge
- HTML content rendering with image support
- Linked attachments displayed inline
- Click images to open lightbox

### 4.7 Push Notification System

**Backend (firebaseService.ts):**
- `createNotificationWithPush()` — Creates in-app notification + sends FCM push
- `sendPushToUser()` — Multi-device push with automatic stale token cleanup
- User preference checking before sending (master toggle, web, push)
- Task assignment notification: "X assigned you: Task Title (phase)"

**User Notification Preferences (users table):**
- `notifications_enabled` — Master toggle for all notifications
- `web_notifications_enabled` — Control in-app notifications
- `push_notifications_enabled` — Control FCM push notifications

**Profile UI (Profile.tsx):**
- Blue "Notification Preferences" card
- 3 checkboxes: Master, Web, Push
- Icons: BellIcon, ComputerDesktopIcon, DevicePhoneMobileIcon
- Saves with profile update via PUT /profile

**FCM Device Token Management:**
- POST /fcm-tokens — Register device (mobile or web)
- GET /fcm-tokens — List user's registered devices
- DELETE /fcm-tokens/:token — Unregister device
- GET /fcm-tokens/status — Check if FCM is enabled on server

### 4.8 View-As Role (Staff Override)

**Purpose:** Staff and admin users can experience the app as any role to test permissions and workflows.

**Implementation:**
- `getViewAsRole()` / `setViewAsRole()` in workflowPermissions.ts
- localStorage key: `softaware_view_as_role`
- `getEffectiveRole(user)` returns view-as role for staff, actual role otherwise
- Profile.tsx: Amber "Staff: View As Role" card with dropdown
- Options: Client Manager, QA Specialist, Developer
- Active badge in profile header when view-as is active
- Permission system uses effective role, but admins bypass view-as when checking `user.is_admin === true`

### 4.9 Per-Software Token Management

Each software product has its own external API token, stored in localStorage under `software_token_{softwareId}`. The `softwareAuth.ts` utility provides:
- `getSoftwareToken(id)` / `setSoftwareToken(id, token)` / `removeSoftwareToken(id)`
- `hasSoftwareToken(id)` — boolean check
- `softwareAuthHeaders(id)` — returns `{ 'X-Software-Token': token }` for Axios headers

This replaced the previous global `software_token` approach where one token was shared across all software.

### 4.10 Inline Authentication with OTP

Authentication happens directly on the TasksPage — users don't need to navigate to Software Management. The flow supports:
- Initial credential check using the software's stored `external_username` / `external_password`
- OTP verification panel that appears automatically when the external API requires it
- Visual feedback with `authMessage`, `authStatus` state (`idle` | `otp` | `error`)
- Authenticated software shown with ✓ checkmark in the dropdown

### 4.11 Filtered Software Dropdown

The software selector only shows products that have external integration properly configured:
```typescript
softwareList.filter(sw =>
  sw.has_external_integration &&
  sw.external_username &&
  sw.external_password &&
  (sw.external_live_url || sw.external_test_url)
)
```
If no software has integration configured, the empty state says "No software with external integration configured."

### 4.12 Excalidraw Drawing Integration

The `ExcalidrawDrawer` component provides a full-screen drawing canvas that:
- **Lazy-loads** the `@excalidraw/excalidraw` package only when opened (code-splitting)
- Exports drawings as **PNG** (via `exportToBlob`) and **scene JSON** (for future re-opening)
- Saves drawings as **internal comments** with file attachments on the external API
- Accessible from two entry points: "Draw" button in the task detail header, and paperclip icon next to the comment input

### 4.13 Comment System with Attachment Support

Comments are rendered with:
- HTML content support (`dangerouslySetInnerHTML`) with Tailwind image styling (`[&_img]` classes)
- Internal comment badge (`is_internal === 1` → amber "Internal" tag)
- Time spent display
- Linked attachment rendering: images shown as thumbnails with click-to-expand, files as download links
- Image lightbox overlay at z-70 for full-screen viewing

### 4.14 Task Filtering & View Modes

| Filter | Options | Default |
|--------|---------|---------|
| Status | All, New, In Progress, Completed | `new` |
| Type | All, Development, Bug Fix, Feature, Maintenance, Support | `all` |
| Workflow Phase | All, Intake, QA Review, Development | Role-based |
| Module | Dynamic from `useModules()` hook | `all` |
| Search | Free text (title, description, creator) | Empty |
| View Mode | List, Grid | Persisted in localStorage |

### 4.15 Workflow Phase System

Tasks track their position in a workflow pipeline:

| Phase Key | Display Label |
|-----------|---------------|
| `intake` | Intake |
| `quality_review` | QA Review |
| `triage` | Triage |
| `development` | Development |
| `verification` | Verification |
| `resolution` | Resolution |

Phase-based default filtering maps user roles:
- `client_manager` → defaults to `intake`
- `qa_specialist` → defaults to `quality_review`
- `developer` → defaults to `development`

---

## 5. Dual-Token Authentication

| Token | Storage | Header | Purpose |
|-------|---------|--------|---------|
| JWT (internal) | `localStorage.jwt_token` | `Authorization: Bearer {jwt}` | Authenticate with the Soft Aware backend |
| Software token (external) | `localStorage.software_token_{id}` | `X-Software-Token: {token}` | Authenticate with the external software API |

**Request flow:**
1. Axios interceptor adds `Authorization: Bearer {jwt}` on every request
2. `softwareAuthHeaders(softwareId)` adds `X-Software-Token: {token}` for task/comment requests
3. Backend `requireAuth` middleware validates the JWT
4. Backend `getSoftwareToken(req)` reads `X-Software-Token` header
5. Backend `proxyToExternal()` forwards the software token as `Authorization: Bearer {token}` to the external API

---

## 6. Security

| Feature | Detail |
|---------|--------|
| Internal auth | `requireAuth` middleware on all task endpoints — validates JWT Bearer token |
| External auth | Per-software token sent via `X-Software-Token` header, forwarded to external API |
| Credential storage | External username/password stored in `update_software` MySQL table (set via Software Management) |
| OTP support | Two-step authentication flow when external API requires OTP verification |
| Token isolation | Each software gets its own localStorage key — switching software uses correct token |
| Input validation | No server-side Zod schemas — validation delegated to external API |
| XSS risk | Comments rendered via `dangerouslySetInnerHTML` — relies on external API sanitization |
| CORS | Standard Axios requests — no special CORS headers needed (same-origin backend) |

---

## 7. Configuration

| Setting | Source | Value |
|---------|--------|-------|
| API Base URL | `REACT_APP_API_URL` env var (frontend) | e.g., `https://api.softaware.net.za` |
| JWT Secret | `JWT_SECRET` env var (backend) | Used by `requireAuth` middleware |
| View mode persistence | `localStorage.tasksViewMode` | `list` or `grid` |
| Selected software persistence | `localStorage.selectedTasksSoftware` | JSON-serialized `Software` object |
| Software token pattern | `localStorage.software_token_{id}` | External API Bearer token |

| Hardcoded Constant | File | Value |
|--------------------|------|-------|
| Pagination limit | useTasks.ts | 1000 per page |
| Max pagination pages | useTasks.ts | 50 (safety limit) |
| Approval threshold | TaskDialog | 8 hours estimated |
| ExcalidrawDrawer z-index | ExcalidrawDrawer.tsx | 60 |
| Image lightbox z-index | TaskDetailsDialog | 70 |
| Task detail dialog z-index | TaskDetailsDialog | 50 |
| PNG export quality | ExcalidrawDrawer.tsx | 0.95 |
