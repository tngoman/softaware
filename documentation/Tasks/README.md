# Tasks Module — Overview

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## 1. Module Overview

### Purpose

The Tasks module provides centralised task management across multiple external software product APIs and PHP portal instances. It operates on a **dual-path architecture**:

1. **Local Database (read path)** — Tasks are synced from external sources into a `local_tasks` MySQL table via a background sync service. The frontend reads from this local cache, enabling fast filtering, sorting, local enhancements, and offline-tolerant UX.
2. **Proxy Router (write path)** — All CRUD mutations (create, update, delete, comment, attach, assign) are proxied in real-time to the external APIs. The sync service later pulls changes back into the local cache.

**Key capabilities:**

- **Multi-Source Sync Engine** — Register external sources (PHP tasks-api, software product APIs) with API-key auth; pull tasks on configurable intervals with change-detection hashing
- **Local Enhancement Layer** — Bookmarks, priority (urgent/high/normal/low), color labels, freeform tags, kanban ordering, and view tracking — all stored locally, never pushed upstream
- **Dual View Modes** — List view and Kanban board with drag-and-drop (`@dnd-kit`) for status transitions and same-column reordering
- **Font Size Picker** — S/M/L toggle with localStorage persistence, applied to both list and kanban card variants via inline style maps
- **Sync Status Toggle** — Enable/disable global sync with mandatory case creation on disable (reason + detail)
- **Invoice Staging Workflow** — Stage unbilled tasks → review → process (sync billed status to external portal)
- **Dashboard Integration** — Direct task access from Dashboard bugfix list and workflow phase popovers
- **Workflow Management** — Full assignment controls with phase-based role filtering and permissions
- **Task Associations** — Link tasks as blockers, duplicates, children, related, or follow-ups
- **Rich Text Editing** — WYSIWYG editor (react-quill) for task descriptions
- **Date/Time Controls** — DatePicker components for start date, due date, and completion date
- **Attachment Management** — Upload, paste, view, stream, and delete attachments with thumbnail previews (inline on cards via `TaskAttachmentsInline`). Uses `download_url` from external API for correct static file paths
- **Image Gallery Lightbox** — Full-screen navigable gallery for all task images with prev/next arrows, thumbnail strip, zoom/pan, keyboard shortcuts, and download
- **Last Comment Preview** — Styled comment preview on task cards with author name, relative date, and visual distinction from descriptions
- **Excalidraw Integration** — Inline drawing tool saved as comments with file attachments
- **Push Notifications** — Task assignments and phase changes trigger web + mobile notifications via Firebase
- **AI Assistant Integration** — 22 task tool handlers allow staff to manage the full task lifecycle via voice/text AI assistant, using the same dual-path architecture
- **View-As Role** — Staff users can experience the app as any role to test permissions
- **Comment System** — Internal/public comments with convert-to-task and delete actions
- **No Per-User Auth** — Source-level API keys from `task_sources` table eliminate per-user external authentication
- **Test Suite** — 80 vitest unit tests covering all AI assistant task tool executors

### Business Value

- Centralised task management across multiple external software products from a single dashboard
- Source-level API-key authentication — no per-user passwords, no OTP flows, no token management per software
- Full task lifecycle: create, edit, delete, assign, link, attach, comment, draw, invoice
- Local caching with sync provides fast reads and resilience to external API latency
- Local enhancements (bookmarks, priority, tags, colors, kanban) add value without touching external systems
- Invoice staging workflow integrates with accounting (stage → review → process → mark billed)
- **Workflow enforcement** — Role-based permissions control who can assign tasks from each phase
- **Real-time notifications** — Assigned users and phase changes trigger instant push/web notifications

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 2 (softawareTasks.ts, localTasks.ts) |
| Backend service files | 1 (taskSyncService.ts) |
| Backend migration files | 2 (021\_local\_tasks.ts, 022\_task\_enhancements.ts) |
| AI assistant integration files | 2 (mobileActionExecutor.ts — 22 task executors, mobileTools.ts — 22 tool defs) |
| Test files | 1 (task-tools.test.ts — 80 tests) |
| Frontend page files | 1 (TasksPage.tsx — 2,652 LOC with 5 embedded dialogs) |
| Frontend hook files | 2 (useTasks.ts, useLocalTasks.ts) |
| Frontend model files | 1 (LocalTasksModel.ts — 206 LOC) |
| Frontend component files | 11 (ExcalidrawDrawer, RichTextEditor, TaskAttachmentsInline, TaskImageLightbox, TaskCard, KanbanBoard, TaskToolbar, TaskStatsBar, PriorityBadge, ColorLabelPicker, TagInput) |
| Frontend utility files | 2 (softwareAuth.ts ⚠️ deprecated, workflowPermissions.ts) |
| Backend LOC | ~2,327 (778 + 862 + 687) + ~700 task-related in shared assistant files |
| Frontend LOC | ~6,400 |
| Total LOC | ~9,800 (including assistant integration + tests) |
| API endpoints (proxy) | ~30 (softawareTasks.ts) |
| API endpoints (local) | ~25 (localTasks.ts) |
| AI assistant task tools | 22 (via mobileActionExecutor.ts) |
| Unit tests | 80 (vitest — all pass in ~1.2s) |
| MySQL tables | 3 (local\_tasks, task\_sources, task\_sync\_log) + 3 notification columns on `users` |
| External dependencies | @excalidraw/excalidraw 0.18.0, react-quill 2.0.0, react-datepicker 8.8.0, date-fns 2.30.0, @dnd-kit/core, @dnd-kit/sortable, @headlessui/react, vitest (dev) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                       │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ TasksPage.tsx (2,652 LOC) — Main page + 5 embedded dialogs                  │ │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────────┐  │ │
│  │  │ TasksPage    │  │ TaskDialog       │  │ TaskDetailsDialog             │  │ │
│  │  │ • SW selector│  │ • 3 tabs layout  │  │ • View + Comments             │  │ │
│  │  │ • Dual views │  │ • RichTextEditor │  │ • Excalidraw drawing          │  │ │
│  │  │ • Toolbar    │  │ • DatePickers    │  │ • Attachments (upload/stream) │  │ │
│  │  │ • Kanban     │  │ • Attachments    │  │ • Convert comment to task     │  │ │
│  │  │ • Invoicing  │  │ • Hours tracking │  │ • Delete comment/attachment   │  │ │
│  │  └──────────────┘  └──────────────────┘  └───────────────────────────────┘  │ │
│  │  ┌──────────────────────────┐  ┌──────────────────────────────────────┐     │ │
│  │  │ WorkflowDialog           │  │ TaskAssociationDialog                │     │ │
│  │  │ • Role-based user filter │  │ • 5 association types                │     │ │
│  │  │ • Phase transition logic │  │ • Searchable task picker             │     │ │
│  │  │ • Module assignment      │  │ • Association notes                  │     │ │
│  │  │ • Permission checking    │  │ • View existing associations         │     │ │
│  │  └──────────────────────────┘  └──────────────────────────────────────┘     │ │
│  └──────────────┬──────────────────────────────────────────────────────────────┘ │
│                 │                                                                │
│  ┌──────────────┼──────────────────────────────────────────────────────────────┐ │
│  │ Extracted Components (src/components/Tasks/)                                │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │ │
│  │  │ TaskCard     │ │ KanbanBoard  │ │ TaskToolbar  │ │ TaskStatsBar      │  │ │
│  │  │ 588 LOC      │ │ 346 LOC      │ │ 276 LOC      │ │ 45 LOC            │  │ │
│  │  │ • List+Kanban│ │ • @dnd-kit   │ │ • Filters    │ │ • New/Active/     │  │ │
│  │  │ • Priority   │ │ • 4 columns  │ │ • Font size  │ │   Completed/Pend  │  │ │
│  │  │ • Font sizes │ │ • Reorder    │ │ • Sync toggle│ │                   │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │ │
│  │  │ PriorityBadge│ │ ColorLabel   │ │ TagInput     │                        │ │
│  │  │ 34 LOC       │ │ Picker 56 LOC│ │ 148 LOC      │                        │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                        │ │
│  └──────────────┬──────────────────────────────────────────────────────────────┘ │
│                 │                                                                │
│  ┌──────────────▼──────────┐   ┌──────────────────────────────────────────────┐  │
│  │ useTasks.ts (99 LOC)    │   │ useLocalTasks.ts (181 LOC)                   │  │
│  │ • Reads /local-tasks    │   │ • Source management                          │  │
│  │ • Normalizes fields     │   │ • Sync triggering                            │  │
│  │ • Adds local extras     │   │ • Full filter/pagination support             │  │
│  └──────────────┬──────────┘   └──────────────────────────────────────────────┘  │
│                 │                                                                │
│  ┌──────────────▼──────────┐   ┌──────────────────────────────────────────────┐  │
│  │ LocalTasksModel.ts      │   │ workflowPermissions.ts (176 LOC)            │  │
│  │ (206 LOC — API client)  │   │ • canUserAssignTask()                        │  │
│  │ • CRUD + enhancements   │   │ • getEffectiveRole() (view-as override)     │  │
│  │ • Source management     │   │ • PHASE_ROLE_MAP                             │  │
│  │ • Sync operations       │   └──────────────────────────────────────────────┘  │
│  │ • Invoice staging       │                                                     │
│  └──────────────┬──────────┘   ┌──────────────────────────────────────────────┐  │
│                 │              │ Other shared components                       │  │
│                 │              │ • RichTextEditor.tsx, ExcalidrawDrawer.tsx    │  │
│                 │              │ • TaskAttachmentsInline.tsx                   │  │
│                 │              │ • TaskImageLightbox.tsx (gallery lightbox)    │  │
│                 │              │ • softwareAuth.ts (legacy, mostly unused)    │  │
│                 │              └──────────────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────────────────────────────┘
                  │
                  │  Two API paths:
                  │  READ:   GET /api/local-tasks      ← local DB (synced cache)
                  │  WRITE:  POST/PUT/DELETE /api/softaware/tasks  ← proxied
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express)                                      │
│                                                                                  │
│  ┌─── /api/softaware/tasks/* → softawareTasks.ts (778 LOC) ──────────────────┐  │
│  │                                                                            │  │
│  │  proxyToExternal(baseUrl, path, method, apiKey, body?)                    │  │
│  │  resolveTaskSource(req) — looks up task_sources by software_id / apiUrl   │  │
│  │                                                                            │  │
│  │  CRUD:     GET / · POST / · PUT / · DELETE /:id                           │  │
│  │  Workflow: POST /:id/start · /:id/complete · /:id/approve                 │  │
│  │  Comments: GET/POST/DELETE /:id/comments · /with-attachment · /convert     │  │
│  │  Attach:   GET/POST/DELETE /:id/attachments · /stream                     │  │
│  │  Assoc:    GET/POST/DELETE /:id/associations                              │  │
│  │  Billing:  POST /:id/invoice · /bill · /statement                         │  │
│  │  Misc:     POST /reorder · /sync · /authenticate (no-op)                 │  │
│  │                                                                            │  │
│  │  On PUT: sendTaskAssignmentNotification() / sendPhaseChangeNotification() │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── /api/local-tasks/* → localTasks.ts (862 LOC) ──────────────────────────┐  │
│  │                                                                            │  │
│  │  Sources:  GET/POST/PUT/DELETE /sources · POST /sources/:id/test          │  │
│  │  Sync:     POST /sync · /sync/:sourceId · GET /sync/status · /sync/log   │  │
│  │            POST /sync/enable · /sync/disable · GET /sync/enabled          │  │
│  │  Tasks:    GET / · GET /:id · PUT /:id · DELETE /:id                      │  │
│  │  Enhance:  PATCH /:id/bookmark · /priority · /color-label · /tags · /view │  │
│  │  Bulk:     PATCH /bulk (kanban reorder, bulk status)                       │  │
│  │  Tags:     GET /tags (unique tags across all tasks)                        │  │
│  │  Invoice:  POST /invoice/stage · GET /invoice/staged · POST /clear/unstage│  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── taskSyncService.ts (687 LOC) ─────────────────────────────────────────┐   │
│  │  Adapters: fetchFromTasksApi() · fetchFromSoftwareProxy()                │   │
│  │  Sync:     syncSource() · syncAllSources() · autoSync()                  │   │
│  │  Push:     pushDirtyTasks() — pushes local edits back to source          │   │
│  │  Hashing:  computeSyncHash() — SHA-256 for change detection              │   │
│  │  Upsert:   upsertTasks() — insert/update/soft-delete with dirty-aware   │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─── firebaseService.ts (241 LOC) ─────────────────────────────────────────┐   │
│  │  createNotificationWithPush() — DB insert + FCM push (respects prefs)    │   │
│  │  sendPushToUser() — multi-device with stale token cleanup                │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                               │
               ┌───────────────┼────────────────┐
               │               │                │
               ▼               ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  MySQL DB    │  │  PHP Portal  │  │  Software    │
    │              │  │  Tasks API   │  │  Product APIs│
    │ local_tasks  │  │ (X-API-Key)  │  │ (X-API-Key)  │
    │ task_sources │  │              │  │              │
    │ task_sync_log│  │              │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## 3. Data Flow

### 3.1 Task Sync (Background)

```
Registered task_sources (task_sources table)
  → taskSyncService: syncSource(source)
    1. pushDirtyTasks() — push locally-modified tasks back to the source
    2. Adapter: fetchFromTasksApi() or fetchFromSoftwareProxy()
       ├── Paginated fetch with source-level API key
       └── Normalise each task → NormalisedTask shape
    3. upsertTasks() — for each task:
       ├── Compute SHA-256 sync_hash
       ├── If exists + unchanged hash → skip
       ├── If exists + changed hash + NOT local_dirty → update
       ├── If exists + local_dirty → skip (preserve local edits)
       └── If new → insert
    4. Mark deleted (tasks in DB but not in fetch)
    5. Log result to task_sync_log
    6. Update task_sources.last_synced_at
```

### 3.2 Reading Tasks (Frontend)

```
TasksPage loads → useTasks hook
  → GET /api/local-tasks?software_id={id}&page=1&limit=200
    ├── Backend: queries local_tasks table (paginated, filterable)
    └── Returns normalised tasks with source provenance
  → Hook normalizes local_tasks fields → Task interface
    ├── Maps: external_id → id, estimated_hours → estimatedHours
    ├── Normalizes status: "progress" → "in-progress"
    └── Adds: priority, is_bookmarked, color_label, local_tags, kanban_order
  → Tasks displayed in List or Kanban view
```

### 3.3 Writing Tasks (Frontend → Proxy → External)

```
Create/Edit task:
  → TaskDialog form → POST or PUT /api/softaware/tasks
    { apiUrl, software_id, task: { task_name, ... } }
  → Backend: resolveTaskSource(req)
    ├── Looks up task_sources by software_id or apiUrl
    └── Gets base_url + api_key for the source
  → proxyToExternal(baseUrl, /api/tasks, method, apiKey, body)
  → On success: toast + loadTasks() (re-reads from local DB)

Delete task:
  → SweetAlert2 confirmation → DELETE /api/softaware/tasks/:id
  → Backend proxies to external API

Status transitions:
  → POST /api/softaware/tasks/:id/start or /:id/complete
  → Backend proxies to external API

Workflow assignment (PUT):
  → On success: sendTaskAssignmentNotification() if assigned_to changed
  → On success: sendPhaseChangeNotification() if workflow_phase changed
```

### 3.4 Comments & Drawing

```
View comments:
  → GET /api/softaware/tasks/:id/comments
  → Display with: username, timestamp, internal badge, convert-to-task, delete

Post text comment:
  → POST /api/softaware/tasks/:id/comments
  → Re-fetch comments

Post drawing (Excalidraw):
  → ExcalidrawDrawer → exportToBlob() → base64 + scene JSON
  → POST /api/softaware/tasks/:id/comments/with-attachment
    Backend 2-step: create comment → upload base64 as FormData attachment

Delete comment:
  → DELETE /api/softaware/tasks/:id/comments/:commentId

Convert comment to task:
  → POST /api/softaware/tasks/:id/comments/:commentId/convert
```

### 3.5 Attachments

```
List attachments:
  → GET /api/softaware/tasks/:id/attachments
  → External API returns each attachment with download_url pointing to static path
  → download_url: https://portal.silulumanzi.com/uploads/development/{file_path}
  → No auth required — works directly in <img src>, <a href>, browser tabs
  → Inline on TaskCard via TaskAttachmentsInline (max 4 thumbnails)

URL resolution (buildFileUrl / buildAttachmentUrl):
  1. Use download_url from API response (preferred — public static path, no auth)
  2. Fallback: construct {origin}/uploads/{folder}/{file_path} if download_url missing
  3. Fallback: use file_path directly if it starts with http

Upload attachment:
  → POST /api/softaware/tasks/:id/attachments { imageBase64, fileName }
  → Backend converts base64 → FormData → uploads to external API

Stream attachment:
  → GET /api/softaware/tasks/:id/attachments/:attId/stream
  → Backend pipes binary content from external API to frontend

Delete attachment:
  → DELETE /api/softaware/tasks/:id/attachments/:attId
```

### 3.6 Invoice Staging

```
Stage tasks:
  → POST /api/local-tasks/invoice/stage { task_ids: [...] }
  → Sets task_billed = 2 (staged) in local_tasks

Review staged:
  → GET /api/local-tasks/invoice/staged
  → Shows all tasks with task_billed = 2

Process invoices:
  → POST /api/local-tasks/invoice/process
  → Syncs billed status to external portal via proxy
  → Marks tasks as task_billed = 1 in local DB

Unstage single:
  → POST /api/local-tasks/invoice/unstage { task_id }

Clear all staged:
  → POST /api/local-tasks/invoice/clear
```

---

## 4. Key Features

### 4.1 Multi-Source Sync Engine

**Source Types:**
| Source Type | Auth Method | Adapter | Description |
|-------------|-------------|---------|-------------|
| `tasks-api` | X-API-Key | `fetchFromTasksApi()` | PHP portal Tasks API (per TASKS_API.md spec) |
| `software-proxy` | X-API-Key | `fetchFromSoftwareProxy()` | External software product APIs |

**Sync Features:**
- Configurable interval per source (minutes, 0 = manual only)
- SHA-256 change detection — skip updates when hash unchanged
- Dirty-flag awareness — local edits preserved, not overwritten by sync
- Push-back — locally-dirty tasks pushed to source before pull
- Soft-delete detection — tasks removed from source marked `task_deleted = 1`
- Sync logging to `task_sync_log` table with full statistics
- Enable/disable sync globally or per-source

### 4.2 Source-Level API-Key Authentication

**Previous (v1.x):** Per-user, per-software external tokens stored in localStorage. Required OTP flows, token management, and inline auth panels.

**Current (v2.0):** API keys stored in `task_sources.api_key` column, resolved server-side via `resolveTaskSource()`. No per-user auth required. The `/authenticate` endpoint is a no-op stub for backward compatibility.

**Resolution priority:**
1. Look up by `software_id` in `task_sources`
2. Look up by `apiUrl` (exact match on `base_url`)
3. Look up by `apiUrl` (origin match)

### 4.3 Local Enhancement Layer

These columns exist only in `local_tasks` and are never synced upstream:

| Enhancement | Column | Type | Description |
|-------------|--------|------|-------------|
| Priority | `priority` | VARCHAR(20) | urgent / high / normal / low — with emoji badges |
| Bookmark | `is_bookmarked` | TINYINT(1) | Quick-access favorites filter |
| Color Label | `color_label` | VARCHAR(20) | Visual grouping (8 colors) |
| Tags | `local_tags` | JSON | Freeform tag array with autocomplete |
| Kanban Order | `kanban_order` | INT | Per-column sort order for drag-and-drop |
| View Count | `view_count` | INT | Times the task detail was opened |
| Last Viewed | `last_viewed_at` | DATETIME | When user last viewed this task |

### 4.4 Kanban Board

- 4 columns: New, In Progress, Completed, Pending
- Powered by `@dnd-kit/core` + `@dnd-kit/sortable`
- Drag task between columns → status change via `PATCH /local-tasks/bulk`
- Drag within column → reorder via kanban_order update (optimistic UI with rollback on failure)
- Cards show: priority badge, status dot, phase, module, tags, inline attachment thumbnails, last comment
- Font size (`sm`/`md`/`lg`) threaded through KanbanBoard → KanbanColumn → SortableCard → TaskCard

### 4.5 Invoice Staging Workflow

Three-stage billing process:
1. **Unbilled** (`task_billed = 0`) — Default state, visible in normal task views
2. **Staged** (`task_billed = 2`) — Selected for invoicing, visible in Invoice Review panel
3. **Billed** (`task_billed = 1`) — Processed, hidden from active views by default

**TaskToolbar** shows "Invoice Review" button with staged count badge. The review panel allows unstaging individual tasks or processing all staged tasks (syncing billed status to external portal).

### 4.6 Dashboard Task Integration

- Active bugs displayed in "Active Bugs" card — click to navigate to Tasks page with details opened
- Workflow Pipeline phase popovers — click phase to see tasks, click task to navigate
- Navigation via `localStorage.openTaskId` for seamless task opening
- All stats exclude billed tasks from counts
- Stats bar shows: **New** (blue), **Active** (amber), **Completed** (emerald), **Pending** (gray, conditional)
- Count denominator uses `unbilledTasks` (excludes billed + staged tasks)

### 4.7 Workflow Management System

**Phase-Role Mapping:**
| Workflow Phase | Required Role | Can Assign To |
|----------------|---------------|---------------|
| Intake | Client Manager | QA Specialists |
| Quality Review / Triage | QA Specialist | Client Managers or Developers |
| Development | Developer | Developers or QA Specialists |
| Verification / Resolution | QA Specialist | Developers or QA Specialists |

**WorkflowDialog Features:**
- Role-based user filtering (admins excluded from assignment lists)
- Module assignment for QA→Development transition
- "Send back to intake" option
- Permission checks via `canUserAssignTask()` from workflowPermissions.ts

### 4.8 Task Associations

5 types: Blocker, Duplicate, Child/Subtask, Related, Blocked-by. Searchable picker, association notes, view/delete existing associations.

### 4.9 Rich Task Editing (3-Tab TaskDialog)

- **Tab 1: General** — Title, description (WYSIWYG), status, type, priority, hours, attachments
- **Tab 2: Timing** — Start Date, Due Date, Completion Date (DatePickers)
- **Tab 3: Attachments** — Upload, paste, thumbnails, delete

### 4.10 Comment System

- Internal/public flag with amber "Internal" badge
- Convert comment to task action
- Delete comment action
- Image gallery lightbox for inline images (navigable across all task images)
- Attachment rendering with thumbnails
- Comment history first, input at bottom (natural reading order)
- **Last Comment Preview on Cards** (v2.3.0):
  - Styled container with indigo left border + background (`border-l-2 border-indigo-300 bg-indigo-50/50`)
  - "LAST COMMENT" uppercase label for visual distinction from descriptions
  - Author name (bold indigo) + relative date (right-aligned) in header
  - 200-char limit with `line-clamp-2` and `text-gray-600` for readability
  - Data model: `Record<number, { text: string; author: string; date: string | null }>`

### 4.11 Excalidraw Drawing Integration

- Lazy-loaded `@excalidraw/excalidraw` (code-splitting)
- Full-screen overlay at z-60
- PNG export + scene JSON serialisation
- Saved as internal comments with file attachments via 2-step backend flow
- Canvas sizing fix with 2-frame RAF + 50ms delay

### 4.12 Push Notification System

- `sendTaskAssignmentNotification()` — fires on task PUT when `assigned_to` changes
- `sendPhaseChangeNotification()` — fires on task PUT when `workflow_phase` changes
- `createNotificationWithPush()` in firebaseService.ts respects user preferences
- User preferences: master toggle, web, push (3 columns on `users` table)

### 4.13 Task Filtering & View Modes

| Filter | Options | Default |
|--------|---------|---------|
| Status | All, New, In Progress, Completed, Pending | `new` |
| Priority | All, Urgent, High, Normal, Low | `all` |
| Bookmark | All, Bookmarked | `all` |
| Workflow Phase | All, Intake, QA Review, Development, etc. | Role-based |
| Module | Dynamic from task data | `all` |
| Search | Free text (title, description, creator) | Empty |
| View Mode | List, Kanban | Persisted in localStorage |
| Billing Mode | Show/hide billed tasks | Off (billed hidden) |

### 4.14 Inline Attachment Previews (TaskAttachmentsInline)

- Shows max 4 thumbnail images on each TaskCard
- In-memory URL cache for performance
- Fetches from `/api/softaware/tasks/:id/attachments`
- Used in both list and kanban card variants
- Supports `onGalleryOpen` callback (v2.3.0) — passes all image URLs + clicked index to parent for gallery lightbox navigation
- Image list computed from task-level attachments filtered by image extensions / MIME type

### 4.15 View-As Role (Staff Override)

Staff/admin users can experience the app as any role (Client Manager, QA Specialist, Developer) to test permissions and workflows. Stored in `localStorage.softaware_view_as_role`.

### 4.16 AI Assistant Task Management (v2.2.0)

Staff can manage the full task lifecycle via the AI voice/text assistant. **22 task tool handlers** in `mobileActionExecutor.ts` mirror the HTTP API surface:

**Write-path tools** (16): create, update, delete, start, complete, approve, reorder, add/delete comments, upload/delete attachments, add/remove associations, update time, invoice, bill — all proxied to external APIs via `taskProxyV2()` with source-level `X-API-Key` auth.

**Read-path tools** (6): list tasks, get single task, list comments, list attachments, get stats, list associations — reads from `local_tasks` via `resolveLocalTask()` or proxied GET requests.

**Architecture:** The assistant dispatches tools through the same dual-path pattern used by the HTTP routes:
- `resolveTaskSourceForTools(softwareId)` mirrors `resolveTaskSource(req)` from `softawareTasks.ts`
- `taskProxyV2()` mirrors `proxyToExternal()` for all write operations
- `resolveLocalTask()` reads from the local MySQL cache for read operations

**Test coverage:** 80 vitest unit tests validate all 22 executors, role guards, and edge cases.

### 4.17 Test Suite (v2.2.0)

80 unit tests in `tests/task-tools.test.ts` using **vitest**:
- 48 tests for write-path tool executors (proxy operations)
- 18 tests for read-path tool executors (local DB reads)
- 8 role guard tests (permission enforcement)
- 6 edge case tests (missing params, invalid IDs, empty results)

Run: `npm test` or `npx vitest` — all pass in ~1.2 seconds.

### 4.18 Image Gallery Lightbox (v2.3.0)

New `TaskImageLightbox` component (181 LOC) replaces the simple single-image overlay with a full-featured navigable gallery.

**Features:**
- Prev/Next navigation arrows (ChevronLeft/ChevronRight icons)
- Thumbnail strip at bottom for quick jumping between images
- Zoom: mouse wheel, +/- buttons, double-click toggle (up to 5×)
- Pan: click-and-drag when zoomed in
- Keyboard shortcuts: Escape (close), ←/→ (navigate), +/- (zoom)
- Download button, filename display, image counter ("N / M")
- z-index: 100 (above all dialogs)

**Image Collection Strategy:**

| Context | Image Sources | Mechanism |
|---------|---------------|-----------|
| TaskDetailPanel | Task attachments + comment attachments | `allImages` useMemo collects from both, `openGallery(url)` finds index |
| TaskCard (list/kanban) | Task-level attachments from `TaskAttachmentsInline` | `onGalleryOpen` callback passes `imageList` + index upstream |

**Prop Threading (`onGalleryOpen`):**
```
TasksPage → KanbanBoard (KanbanBoardProps)
  → KanbanColumn (CardActionProps)
    → SortableCard (CardActionProps)
      → TaskCard (TaskCardProps)
        → TaskAttachmentsInline (onGalleryOpen prop)

TasksPage → TaskCard (list variant, direct)
  → TaskAttachmentsInline (onGalleryOpen prop)
```

---

## 5. Authentication Architecture

### Source-Level API-Key Auth (Current — v2.0+)

| Component | Mechanism |
|-----------|-----------|
| Frontend → Backend | No auth required (no-op `requireAuth` middleware) |
| Backend → External API | `X-API-Key: {api_key}` header from `task_sources` table |
| Source resolution (HTTP) | `resolveTaskSource(req)` looks up by `software_id` or `apiUrl` |
| Source resolution (AI Assistant) | `resolveTaskSourceForTools(softwareId)` looks up by `software_id` |
| AI Assistant → External API | `taskProxyV2()` forwards `X-API-Key` header (same pattern as HTTP proxy) |

**Note:** Both `softawareTasks.ts` and `localTasks.ts` define `requireAuth` as a **no-op pass-through** middleware. Authentication is effectively disabled — the system operates as a local-only tool.

### Legacy Per-Software Token Auth (v1.x — ⚠️ DEPRECATED v2.2.0)

The `softwareAuth.ts` utility, `X-Software-Token` header pattern, and `staff_software_tokens` table have been **officially deprecated** as of v2.2.0. The `/authenticate` endpoint in softawareTasks.ts is a no-op stub. See CHANGES.md v2.2.0 for the full deprecation inventory.

---

## 6. Security

| Feature | Detail |
|---------|--------|
| Internal auth | **No-op** — both task routers skip JWT validation |
| External auth | Source-level API keys from `task_sources` table |
| API key storage | `task_sources.api_key` column (plain text) |
| Input validation | No server-side Zod schemas — validation delegated to external API |
| XSS risk | Comments rendered via `dangerouslySetInnerHTML` — relies on external API sanitisation |
| Sync integrity | SHA-256 hashing for change detection; dirty-flag preserves local edits |

---

## 7. Configuration

| Setting | Source | Value |
|---------|--------|-------|
| API Base URL | `REACT_APP_API_URL` env var (frontend) | e.g., `https://api.softaware.net.za` |
| View mode persistence | `localStorage.tasksViewMode` | `list` or `kanban` |
| Font size | `localStorage.tasksFontSize` | `sm`, `md`, or `lg` (default: `sm`) |
| Selected software | `localStorage.selectedTasksSoftware` | JSON-serialised `Software` object |
| View-as role | `localStorage.softaware_view_as_role` | Role slug or empty |
| Open task ID | `localStorage.openTaskId` | Task ID for auto-open navigation |

| Hardcoded Constant | File | Value |
|--------------------|------|-------|
| Pagination limit (hook) | useTasks.ts | 200 per page, max 50 pages |
| Pagination limit (sync) | taskSyncService.ts | 200 per page, max 100 pages |
| Approval threshold | TaskDialog | 8 hours estimated |
| ExcalidrawDrawer z-index | ExcalidrawDrawer.tsx | 60 |
| Image lightbox z-index | TaskImageLightbox | 100 |
| Dialog z-index | TaskDetailsDialog | 50 |
| PNG export quality | ExcalidrawDrawer.tsx | 0.95 |
| Sync interval default | task_sources table | 15 minutes |
| Inline attachment max | TaskAttachmentsInline | 4 thumbnails |
