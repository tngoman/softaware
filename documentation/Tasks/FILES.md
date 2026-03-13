# Tasks Module — File Inventory

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total source files** | 21 (+ 3 related assistant/test files) |
| **Total LOC** | ~9,800 (including assistant integration + tests) |
| **Backend route files** | 2 (1,640 LOC) |
| **Backend service files** | 1 (687 LOC) |
| **Backend migration files** | 2 (296 LOC) |
| **AI assistant files** | 2 shared (~700 LOC task-related) |
| **Test files** | 1 (~400 LOC, 80 tests) |
| **Frontend page files** | 1 (2,652 LOC) |
| **Frontend hook files** | 2 (280 LOC) |
| **Frontend model files** | 1 (206 LOC) |
| **Frontend component files** | 11 (~2,050 LOC) |
| **Frontend utility files** | 2 (208 LOC) |

### Directory Tree

```
Backend:
  src/routes/softawareTasks.ts              (778 LOC)  ⭐ proxy router — CRUD, comments, attachments, workflow, billing
  src/routes/localTasks.ts                  (862 LOC)  ⭐ local tasks — CRUD, sources, sync, enhancements, invoicing, sync toggle
  src/services/taskSyncService.ts           (687 LOC)  ⭐ sync engine — adapters, hashing, upsert, push-back
  src/services/firebaseService.ts           (241 LOC)  notifications (shared, not tasks-specific)
  src/db/migrations/021_local_tasks.ts      (200 LOC)  migration: task_sources + local_tasks + task_sync_log
  src/db/migrations/022_task_enhancements.ts (96 LOC)  migration: priority, bookmarks, tags, kanban, views

Frontend:
  src/pages/general/TasksPage.tsx          (2,652 LOC)  ⭐ main page + 5 embedded dialogs
  src/hooks/useTasks.ts                       (99 LOC)  hook: reads /local-tasks, normalizes fields
  src/hooks/useLocalTasks.ts                 (181 LOC)  hook: sources, sync, full filtering
  src/models/LocalTasksModel.ts              (206 LOC)  API client for /local-tasks endpoints
  src/components/Tasks/TaskCard.tsx           (588 LOC)  ⭐ dual-variant card (list + kanban) with font size system
  src/components/Tasks/KanbanBoard.tsx        (346 LOC)  ⭐ @dnd-kit drag-and-drop board with same-column reorder
  src/components/Tasks/TaskToolbar.tsx        (276 LOC)  filters, search, font size picker, sync status toggle, invoice review
  src/components/Tasks/TagInput.tsx           (148 LOC)  freeform tags with autocomplete
  src/components/Tasks/ColorLabelPicker.tsx    (56 LOC)  color dot picker (8 colors)
  src/components/Tasks/TaskStatsBar.tsx        (45 LOC)  mini stat chips (new/active/completed/pending)
  src/components/Tasks/PriorityBadge.tsx       (34 LOC)  emoji priority badge
  src/components/Tasks/index.ts                 (8 LOC)  barrel exports
  src/components/ExcalidrawDrawer.tsx         (219 LOC)  lazy-loaded drawing editor
  src/components/RichTextEditor.tsx           (112 LOC)  react-quill WYSIWYG wrapper
  src/components/TaskAttachmentsInline.tsx    (125 LOC)  inline attachment thumbnails (uses download_url, gallery support)
  src/components/TaskImageLightbox.tsx        (181 LOC)  ⭐ full-screen gallery lightbox with navigation, zoom, thumbnails
  src/utils/workflowPermissions.ts           (176 LOC)  role-based permission checks
  src/utils/softwareAuth.ts                   (32 LOC)  ⚠️ DEPRECATED (v2.2.0) — legacy per-software token management

Related files (not part of this module, but used by it):
  src/hooks/useSoftware.ts                    (~40 LOC)  fetches software list
  src/hooks/useModules.ts                     (~45 LOC)  fetches modules per software
  src/services/api.ts                         (~75 LOC)  Axios client with JWT interceptor
  src/types/index.ts                          (400 LOC)  Software + Task interfaces
  src/pages/admin/Dashboard.tsx               (755 LOC)  task stats + navigation integration

AI Assistant Integration (v2.2.0 — shared files, task-related portions):
  src/services/mobileActionExecutor.ts      (~2,845 LOC total, ~700 task-related)  ⭐ 22 task tool executors
  src/services/mobileTools.ts               (~1,500 LOC total, ~400 task-related)  22 task tool definitions
  src/pages/general/Profile.tsx              (—)  AI tool counts (59 total, 15 task management)

Test Suite (v2.2.0):
  tests/task-tools.test.ts                    (~400 LOC)  80 vitest unit tests for task tools
  vitest.config.ts                             (~15 LOC)  test framework configuration
```

---

## 2. Backend Files

### 2.1 `src/routes/softawareTasks.ts` — Proxy Router

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/softawareTasks.ts` |
| **LOC** | 778 |
| **Purpose** | Proxy all task CRUD, comments, attachments, associations, workflow, and billing requests to external software APIs using source-level API keys |
| **Dependencies** | express, middleware/auth (no-op), db/mysql, services/firebaseService |
| **Exports** | `softawareTasksRouter` |
| **Mount Point** | `/api/softaware/tasks` (via `apiRouter.use()` in app.ts) |

#### Helper Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `proxyToExternal(baseUrl, path, method, apiKey, body?)` | `string, string, string, string, any?` | `Promise<{ status, data }>` | Core proxy — builds URL, sets `X-API-Key` header, forwards body, returns parsed response |
| `resolveTaskSource(req)` | `Request` | `Promise<{ baseUrl, apiKey, sourceId }>` | Looks up `task_sources` table by `software_id` or `apiUrl` to resolve API credentials |
| `sendTaskAssignmentNotification(...)` | task data, user info | `Promise<void>` | Sends in-app + push notification when task assigned to a user |
| `sendPhaseChangeNotification(...)` | task data, phase info | `Promise<void>` | Sends notification when workflow phase changes |

#### Endpoints (~30 routes)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List tasks (paginated, proxied) |
| POST | `/` | Create task |
| PUT | `/` | Update task + fire assignment/phase notifications |
| DELETE | `/:id` | Delete task |
| POST | `/reorder` | Reorder tasks |
| GET | `/:id/associations` | Get task associations |
| POST | `/:id/associations` | Create association |
| DELETE | `/:id/associations/:assocId` | Delete association |
| GET | `/:id/attachments` | List attachments |
| POST | `/:id/attachments` | Upload attachment (base64 → multipart) |
| DELETE | `/:id/attachments/:attId` | Delete attachment |
| GET | `/:id/attachments/:attId/stream` | Stream attachment binary content |
| GET | `/:id/comments` | List comments |
| POST | `/:id/comments/with-attachment` | Create comment + upload drawing (2-step) |
| POST | `/:id/comments` | Create comment (text) |
| DELETE | `/:id/comments/:commentId` | Delete comment |
| POST | `/:id/comments/:commentId/convert` | Convert comment to task |
| POST | `/:id/start` | Start task |
| POST | `/:id/complete` | Complete task |
| POST | `/:id/approve` | Approve task |
| GET | `/pending-approval` | Get tasks pending approval |
| GET | `/stats` | Get task statistics |
| POST | `/sync` | Trigger sync |
| POST | `/:id/invoice` | Invoice task |
| POST | `/bill` | Bill tasks |
| PUT | `/:id/time` | Update time tracking |
| GET | `/statement` | Get billing statement |
| GET | `/orders/latest` | Get latest orders |
| GET | `/orders/budgets` | Get order budgets |
| GET | `/orders/:orderNumber/budget` | Get specific order budget |
| GET | `/:id/parent` | Get parent task |
| POST | `/authenticate` | No-op stub (legacy compatibility) |
| GET | `/:id` | Get single task (wildcard catch-all, registered LAST) |

---

### 2.2 `src/routes/localTasks.ts` — Local Tasks Router

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/localTasks.ts` |
| **LOC** | 862 |
| **Purpose** | Manage locally-stored tasks synced from external sources. CRUD, source management, sync operations, local enhancements, invoice staging. |
| **Dependencies** | express, middleware/auth (no-op), db/mysql, services/taskSyncService |
| **Exports** | `localTasksRouter` |
| **Mount Point** | `/api/local-tasks` (via `apiRouter.use()` in app.ts) |

#### Endpoints (~25 routes)

**Source Management:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sources` | List all task sources (enriched with task counts) |
| POST | `/sources` | Register a new external source |
| PUT | `/sources/:id` | Update a source |
| DELETE | `/sources/:id` | Delete source + all its tasks (CASCADE) |
| POST | `/sources/:id/test` | Test connectivity to a source |

**Sync Operations:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sync` | Sync all enabled sources |
| POST | `/sync/:sourceId` | Sync a specific source |
| GET | `/sync/status` | Get sync status for all sources |
| GET | `/sync/log` | Get sync history log |
| GET | `/sync/enabled` | Check if any sources have sync enabled |
| POST | `/sync/enable` | Enable sync for all sources |
| POST | `/sync/disable` | Disable sync for all sources |

**Task CRUD (Local):**

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/bulk` | Batch update tasks (kanban reorder, bulk status) |
| GET | `/tags` | Get all unique tags across tasks |
| GET | `/` | List local tasks (paginated, filterable) |
| GET | `/:id` | Get single local task |
| PUT | `/:id` | Update local task (marks dirty for sync push) |
| DELETE | `/:id` | Soft-delete task |

**Local Enhancements:**

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/:id/bookmark` | Toggle bookmark |
| PATCH | `/:id/priority` | Set priority (urgent/high/normal/low) |
| PATCH | `/:id/color-label` | Set color label |
| PATCH | `/:id/tags` | Set tags (full replacement) |
| PATCH | `/:id/view` | Record a view (increment counter) |

**Invoice Staging:**

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/invoice/stage` | Stage tasks for invoicing (`task_billed = 2`) |
| GET | `/invoice/staged` | Get all staged tasks |
| POST | `/invoice/clear` | Clear all staged invoices (reset to unbilled) |
| POST | `/invoice/unstage` | Unstage single task |
| POST | `/invoice/process` | Process staged invoices (sync to external, mark billed) |

---

### 2.3 `src/services/taskSyncService.ts` — Sync Engine

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/taskSyncService.ts` |
| **LOC** | 687 |
| **Purpose** | Pull tasks from registered external sources and upsert into `local_tasks`. Push locally-dirty tasks back. Change detection via SHA-256 hashing. |
| **Dependencies** | crypto, db/mysql |
| **Exports** | `TaskSource` (interface), `NormalisedTask` (interface), `SyncResult` (interface), `syncSource()`, `syncAllSources()`, `autoSync()` |

#### Adapter Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `fetchFromTasksApi(source)` | `TaskSource` | `NormalisedTask[]` | Paginated fetch from PHP portal Tasks API with X-API-Key auth |
| `normaliseTasksApiTask(t)` | raw task object | `NormalisedTask` | Map PHP API field names → normalised schema |
| `fetchFromSoftwareProxy(source)` | `TaskSource` | `NormalisedTask[]` | Fetch from software product API with Bearer auth |
| `normaliseSoftwareProxyTask(t)` | raw task object | `NormalisedTask` | Map software API field names → normalised schema |

#### Sync Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `computeSyncHash(task)` | `NormalisedTask` | `string` | SHA-256 of serialised task for change detection |
| `upsertTasks(sourceId, tasks)` | `number, NormalisedTask[]` | `{ created, updated, unchanged, deleted }` | Insert/update/soft-delete with dirty-flag awareness |
| `pushDirtyTasks(source)` | `TaskSource` | `number` | Push locally-modified tasks back to source via bulk sync endpoint |
| `syncSource(source)` | `TaskSource` | `SyncResult` | Full sync cycle: push dirty → fetch → upsert → log |
| `syncAllSources()` | — | `SyncResult[]` | Sync all enabled sources sequentially |
| `autoSync()` | — | `void` | Auto-sync sources that are past their interval |
| `normaliseStatus(s)` | `string` | `string` | Normalise status strings (e.g., "progress" → "in-progress") |
| `parseDatetime(d)` | `string \| null` | `string \| null` | Safe datetime parsing |

#### Adapter Registry

```typescript
const ADAPTERS: Record<string, (source: TaskSource) => Promise<NormalisedTask[]>> = {
  'tasks-api': fetchFromTasksApi,
  'software-proxy': fetchFromSoftwareProxy,
};
```

---

### 2.4 `src/db/migrations/021_local_tasks.ts` — Schema Migration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/021_local_tasks.ts` |
| **LOC** | 200 |
| **Purpose** | Create `task_sources`, `local_tasks`, and `task_sync_log` tables |

### 2.5 `src/db/migrations/022_task_enhancements.ts` — Enhancement Migration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/022_task_enhancements.ts` |
| **LOC** | 96 |
| **Purpose** | Add local-only columns: priority, is_bookmarked, color_label, local_tags, kanban_order, view_count, last_viewed_at |

---

## 3. Frontend Files

### 3.1 `src/pages/general/TasksPage.tsx` — Main Tasks Page

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/TasksPage.tsx` |
| **LOC** | 2,652 |
| **Purpose** | Full task management page with 5 embedded dialogs, dual view modes, filtering, invoice staging, drawing integration, font size system, image gallery lightbox |
| **Dependencies** | react, @heroicons/react, react-hot-toast, sweetalert2, api, useSoftware, useTasks, useModules, useAppStore, softwareAuth, ExcalidrawDrawer, RichTextEditor, workflowPermissions, TaskCard, KanbanBoard, TaskToolbar, TaskStatsBar, TaskAttachmentsInline, TaskImageLightbox, LocalTasksModel |
| **Exports** | `default` (TasksPage component) |
| **Route** | `/tasks` |

#### Embedded Components (defined in same file)

| Component | LOC (approx) | Description |
|-----------|-------------|-------------|
| `TaskDialog` | ~230 | Create/Edit modal — 3 tabs (General / Timing / Attachments). RichTextEditor for description, DatePickers, attachment upload/paste/delete. Auto-sets `approval_required` if estimated > 8h. |
| `TaskDetailsDialog` | ~500 | View modal — metadata grid, description, notes, full attachment management (upload/paste/stream/delete), comment history with convert-to-task and delete actions, Excalidraw drawing overlay, image lightbox. |
| `WorkflowDialog` | ~250 | Assign task — role-based user filtering by phase, module assignment, send-back-to-intake, permission checks. |
| `TaskAssociationDialog` | ~150 | Link tasks — 5 association types, searchable task picker, notes, view/delete existing. |
| `TasksPage` (main) | ~600 | Software selector, dual views (list/kanban), toolbar, filtering, billing mode, invoice staging/review panel. |

#### Key State Variables

| State | Type | Purpose |
|-------|------|---------|
| `selectedSoftware` | Software \| null | Currently selected software |
| `viewMode` | 'list' \| 'kanban' | View mode (persisted in localStorage) |
| `search` | string | Free-text search filter |
| `statusFilter` | string | Status filter |
| `typeFilter` | string | Type filter |
| `phaseFilter` | string | Phase filter (auto-set by role) |
| `moduleFilter` | string | Module filter |
| `priorityFilter` | string | Priority filter |
| `bookmarkFilter` | boolean | Show only bookmarked |
| `showBilled` | boolean | Show billed tasks toggle |
| `taskDialogOpen` | boolean | Create/edit dialog |
| `detailsOpen` | boolean | Details dialog |
| `workflowOpen` | boolean | Workflow assignment dialog |
| `associationOpen` | boolean | Task association dialog |
| `invoiceReviewOpen` | boolean | Invoice staging review panel |
| `stagedTasks` | Set | Tasks staged for invoicing |
| `billingMode` | boolean | Invoice staging mode active |
| `taskFontSize` | `'sm' \| 'md' \| 'lg'` | Font size setting (persisted in localStorage) |
| `lastComments` | Record<number, { text, author, date }> | Last comment metadata per task (for card display) |
| `unbilledTasks` | Task[] (memo) | Tasks excluding billed (task_billed=1) and staged (task_billed=2) |

#### Utility Functions

| Function | Description |
|----------|-------------|
| `timeToDecimal(t)` | Converts "HH:MM:SS" or decimal string to decimal hours |
| `relativeDate(d)` | Converts ISO date to "Just now", "5m ago", "3d ago", etc. |
| `handleAuthenticate(useOtp)` | Legacy auth flow (mostly unused now) |
| `handleStatusChange(task, newStatus)` | Quick status toggle |
| `handleDelete(task)` | SweetAlert2 confirmation → DELETE |
| `handleReorder(task, direction)` | Swap adjacent task positions |
| `handleKanbanReorder(reordered)` | Optimistic kanban same-column reorder via `PATCH /local-tasks/bulk` |
| `handleSyncStatusToggle()` | Toggle global sync on/off with SweetAlert2 reason dialog and case creation |
| `handleAssign(task)` | Open WorkflowDialog |
| `handleLink(task)` | Open TaskAssociationDialog |

---

### 3.2 `src/hooks/useTasks.ts` — Task Fetching Hook

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/hooks/useTasks.ts` |
| **LOC** | 99 |
| **Purpose** | Fetch tasks from the LOCAL database (synced from external sources). Normalizes `local_tasks` fields to the `Task` interface. |
| **Dependencies** | react, api, types/Task |
| **Exports** | `useTasks` (named) |

#### Hook Return

| Property | Type | Description |
|----------|------|-------------|
| `tasks` | Task[] | Current task list (normalised) |
| `loading` | boolean | Loading state |
| `error` | string \| null | Error message |
| `loadTasks` | (silent?) => Promise<void> | Fetch function |
| `setTasks` | Dispatch | Direct setter |

#### Field Normalisation

```
external_id       → id
estimated_hours   → estimatedHours (string)
external_created_at → created_at, time
start_date        → start
end_date          → due_date, end
color             → backgroundColor
status "progress" → "in-progress"
+ priority, is_bookmarked, color_label, local_tags, kanban_order, view_count, last_viewed_at
+ _local_id, _source_id, _source_name, _local_dirty, _last_synced_at
```

---

### 3.3 `src/hooks/useLocalTasks.ts` — Local Tasks Management Hook

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/hooks/useLocalTasks.ts` |
| **LOC** | 181 |
| **Purpose** | Source management, sync triggering, full task listing with pagination |
| **Dependencies** | react, LocalTasksModel |
| **Exports** | `useLocalTasks` (named), `LocalTask` (interface), `TaskSourceInfo` (interface), `SyncLogEntry` (interface) |

#### Hook Return

| Property | Type | Description |
|----------|------|-------------|
| `tasks` | LocalTask[] | Raw local task records |
| `pagination` | Pagination \| null | Current pagination state |
| `sources` | TaskSourceInfo[] | Registered task sources |
| `syncLog` | SyncLogEntry[] | Sync history entries |
| `loading` | boolean | Tasks loading |
| `syncing` | boolean | Sync in progress |
| `error` | string \| null | Error message |
| `loadTasks` | (params?) => Promise<void> | Fetch tasks |
| `loadSources` | () => Promise<void> | Fetch sources |
| `loadSyncLog` | (params?) => Promise<void> | Fetch sync log |
| `syncAll` | () => Promise<any> | Trigger full sync |
| `syncSourceById` | (id) => Promise<any> | Sync one source |
| `setTasks` | Dispatch | Direct setter |

---

### 3.4 `src/models/LocalTasksModel.ts` — API Client

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/models/LocalTasksModel.ts` |
| **LOC** | 206 |
| **Purpose** | Complete API client for all `/api/local-tasks` endpoints |
| **Dependencies** | api (Axios client) |
| **Exports** | `LocalTasksModel` (named object) |

#### Methods

| Method | Backend Endpoint | Purpose |
|--------|-----------------|---------|
| `getAll(params)` | GET /local-tasks | List tasks |
| `getById(id)` | GET /local-tasks/:id | Single task |
| `update(id, data)` | PUT /local-tasks/:id | Update task (marks dirty) |
| `delete(id)` | DELETE /local-tasks/:id | Soft-delete |
| `toggleBookmark(id)` | PATCH /local-tasks/:id/bookmark | Toggle bookmark |
| `setPriority(id, p)` | PATCH /local-tasks/:id/priority | Set priority |
| `setColorLabel(id, c)` | PATCH /local-tasks/:id/color-label | Set color label |
| `setTags(id, tags)` | PATCH /local-tasks/:id/tags | Set tags |
| `bulkUpdate(updates)` | PATCH /local-tasks/bulk | Batch update |
| `getAllTags()` | GET /local-tasks/tags | All unique tags |
| `recordView(id)` | PATCH /local-tasks/:id/view | Record view |
| `stageForInvoice(ids)` | POST /local-tasks/invoice/stage | Stage for invoicing |
| `getStagedInvoices()` | GET /local-tasks/invoice/staged | Get staged |
| `clearStagedInvoices()` | POST /local-tasks/invoice/clear | Clear staged |
| `unstageInvoice(id)` | POST /local-tasks/invoice/unstage | Unstage single |
| `processInvoices()` | POST /local-tasks/invoice/process | Process & sync |
| `getSources()` | GET /local-tasks/sources | List sources |
| `createSource(data)` | POST /local-tasks/sources | Create source |
| `updateSource(id, data)` | PUT /local-tasks/sources/:id | Update source |
| `deleteSource(id)` | DELETE /local-tasks/sources/:id | Delete source |
| `testSource(id)` | POST /local-tasks/sources/:id/test | Test connectivity |
| `syncAll()` | POST /local-tasks/sync | Sync all |
| `syncSource(id)` | POST /local-tasks/sync/:id | Sync one |
| `getSyncStatus()` | GET /local-tasks/sync/status | Sync status |
| `getSyncLog(params)` | GET /local-tasks/sync/log | Sync log |

---

### 3.5 `src/components/Tasks/` — Task Components

#### `TaskCard.tsx` (588 LOC)

Dual-variant card component used in both list and kanban views. Accepts `fontSize` prop (`'sm' | 'md' | 'lg'`) and applies 6 inline style maps (`FS_TITLE`, `FS_META`, `FS_BADGE`, `FS_DESC`, `FS_ACTION`, `FS_PAD`) instead of hardcoded Tailwind sizes. Shows:
- Priority badge (emoji), status dot, type icon
- Title, creator, relative time, hours
- Workflow phase, module name
- Inline attachment thumbnails (via `TaskAttachmentsInline` with `onGalleryOpen` support)
- Tags (compact mode), color label dot
- Last comment preview in styled indigo container with author name + relative date (200 char, line-clamp-2)
- Action buttons: View, Edit, Priority dropdown, Assign, Link, Start/Complete, Delete
- Includes inline `PriorityDropdown` sub-component

#### `KanbanBoard.tsx` (346 LOC)

Four-column board (New, In Progress, Completed, Pending) using `@dnd-kit/core` + `@dnd-kit/sortable`. Cards wrapped in `SortableItem` for drag-and-drop. Dragging between columns changes status; dragging within column reorders via `kanban_order` using `arrayMove`. Accepts `fontSize` prop threaded to `TaskCard` via `KanbanColumn` → `SortableCard`. Fires `onReorder` callback for same-column drops. Threads `onGalleryOpen` callback through `CardActionProps` → `SortableCard` → `KanbanColumn` → `TaskCard` for gallery lightbox support.

#### `TaskToolbar.tsx` (276 LOC)

Toolbar with: New Task button, grouped icon buttons (Sync status toggle — SignalIcon/SignalSlashIcon, Sync — ArrowPathIcon, Refresh), Search input, Status filter, Priority filter, Bookmark filter, Font size picker (S/M/L), Billing mode toggle, Invoice Review button (with staged count badge), Advanced Filters toggle. Exports `ViewMode` and `TaskFontSize` types.

#### `TagInput.tsx` (148 LOC)

Freeform tag input with autocomplete suggestions from existing tags. Compact mode shows tags + "+" button. Supports Enter/comma to add, Backspace to remove last. Exports `tagColor()` utility for consistent tag colouring.

#### `ColorLabelPicker.tsx` (56 LOC)

Dropdown color dot picker with 8 colours (red, orange, yellow, green, blue, purple, pink, none). Exports `COLORS` constant.

#### `TaskStatsBar.tsx` (45 LOC)

Mini stat chips showing: New count (blue, InboxIcon), Active/in-progress count (amber, RocketLaunchIcon), Completed count (emerald, CheckCircleIcon), Pending count (gray, ClockIcon — conditional, only shown when > 0). Receives `unbilledTasks` array — billed/staged tasks are excluded from all counts.

#### `PriorityBadge.tsx` (34 LOC)

Coloured badge with emoji icon (🔴 Urgent, 🟠 High, 🔵 Normal, ⚪ Low). Exports `PRIORITY_CONFIG` constant.

#### `index.ts` (8 LOC)

Barrel exports for all task components plus `ViewMode` type.

---

### 3.6 `src/components/ExcalidrawDrawer.tsx` — Drawing Editor

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/ExcalidrawDrawer.tsx` |
| **LOC** | 219 |
| **Purpose** | Full-screen Excalidraw overlay for creating drawings saved as task comments |
| **Dependencies** | react, @heroicons/react, @excalidraw/excalidraw (lazy-loaded) |
| **Exports** | `default` (ExcalidrawDrawer component) |

**Props:** `open`, `onClose`, `onSave`, `initialData?`, `taskTitle?`

**Save Payload:**
```typescript
{ imageBase64: string; sceneJson: string; fileName: string; }
```

**Behaviour:** Returns null when closed. Lazy-loads Excalidraw on first open (guarded by `loadedRef`). Uses `readyToRender` state with 2-frame RAF + 50ms delay for canvas sizing. Exports as PNG (0.95 quality). CSS hides Library button. Click propagation stopped on overlay.

---

### 3.7 `src/components/RichTextEditor.tsx` — WYSIWYG Editor

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/RichTextEditor.tsx` |
| **LOC** | 112 |
| **Purpose** | react-quill wrapper with custom toolbar and image paste support |
| **Exports** | `default` (RichTextEditor component) |

**Toolbar:** Bold, Italic, Underline, Strike, Lists, Blockquote, Code Block, Link, Image. Snow theme. 250px height.

---

### 3.8 `src/components/TaskAttachmentsInline.tsx` — Inline Thumbnails

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/TaskAttachmentsInline.tsx` |
| **LOC** | 125 |
| **Purpose** | Show max 4 attachment thumbnails on TaskCard. In-memory cache for performance. Uses `download_url` from external API for correct public static file paths. Supports `onGalleryOpen` callback for gallery lightbox navigation. |
| **Exports** | `default` (TaskAttachmentsInline), `clearAttachmentCache` (function) |

**Fetches from:** `GET /api/softaware/tasks/:id/attachments`. Filters out comment-level attachments.

**URL Resolution (`buildFileUrl`):** Prefers `att.download_url` (public static path, no auth), falls back to constructed `{origin}/uploads/{folder}/{file_path}`.

**Gallery Support (v2.3.0):** Accepts optional `onGalleryOpen(images, index)` callback. When provided, image clicks pass the full `imageList` (all image attachments with URL + filename) and clicked index upstream, enabling gallery lightbox navigation across all task images. Falls back to `onImageClick(url)` for single-image viewing if `onGalleryOpen` is not provided.

**Attachment interface:** `attachment_id`, `file_name`, `file_path`, `file_size?`, `mime_type?`, `comment_id?`, `is_from_ticket?`, `download_url?`

---

### 3.9 `src/components/TaskImageLightbox.tsx` — Gallery Lightbox (v2.3.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/TaskImageLightbox.tsx` |
| **LOC** | 181 |
| **Purpose** | Full-screen navigable image gallery for viewing all task images with prev/next navigation, thumbnail strip, zoom/pan, keyboard shortcuts, and download |
| **Dependencies** | react, @heroicons/react (XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ArrowDownTrayIcon) |
| **Exports** | `default` (TaskImageLightbox component), `LightboxImage` (interface) |

**Props:**
- `images: LightboxImage[]` — array of `{ url: string; name?: string }` objects
- `initialIndex: number` — which image to show first
- `onClose: () => void` — callback when lightbox is dismissed

**Features:**
| Feature | Implementation |
|---------|---------------|
| Navigation | Prev/Next buttons with `ChevronLeftIcon`/`ChevronRightIcon`, conditional on `hasPrev`/`hasNext` |
| Thumbnails | Bottom strip of 14×14 thumbnail buttons, highlighted current with white border + ring |
| Zoom | Mouse wheel (±0.25), +/- keyboard (±0.5), double-click toggle (1× ↔ 2×), max 5× |
| Pan | Mouse down + move when `zoom > 1`, cursor changes grab ↔ grabbing |
| Keyboard | `Escape` → close, `ArrowLeft/Right` → navigate, `+/-` → zoom |
| Download | Creates temporary `<a>` with download attribute, triggers click |
| Counter | "N / M" display with `tabular-nums` for fixed-width digits |
| Reset | Switching images resets zoom to 1× and position to origin |

**z-index:** 100 (`z-[100]`) — above all dialogs and panels.

**State:**
| State | Type | Purpose |
|-------|------|---------|
| `index` | number | Current image index |
| `zoom` | number | Current zoom level (1–5) |
| `position` | { x, y } | Pan offset when zoomed |
| `dragging` | boolean | Whether user is actively panning |
| `dragStart` | { x, y } | Mouse position at drag start |

---

### 3.10 `src/utils/workflowPermissions.ts` — Permissions

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/utils/workflowPermissions.ts` |
| **LOC** | 176 |
| **Purpose** | Role-based workflow permission checks + View-As Role override |
| **Exports** | `getViewAsRole`, `setViewAsRole`, `getEffectiveRole`, `userHasRole`, `canUserAssignTask`, `getRequiredRoleForPhase`, `getRoleLabel`, `getPermissionErrorMessage` |

**PHASE\_ROLE\_MAP:**
| Phase | Required Role |
|-------|--------------|
| intake | client_manager |
| quality_review | qa_specialist |
| triage | qa_specialist |
| development | developer |
| verification | qa_specialist |
| resolution | qa_specialist |

---

### 3.11 `src/utils/softwareAuth.ts` — Legacy Token Management

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/utils/softwareAuth.ts` |
| **LOC** | 32 |
| **Purpose** | ⚠️ **DEPRECATED (v2.2.0)** — Per-software external API tokens in localStorage. Superseded by source-level API keys in `task_sources`. |
| **Exports** | `getSoftwareToken`, `setSoftwareToken`, `removeSoftwareToken`, `hasSoftwareToken`, `softwareAuthHeaders` |

**Note:** Officially deprecated in v2.2.0. These functions still exist and are imported by TasksPage.tsx for backward compatibility, but are no longer the active auth mechanism. Source-level API keys resolved server-side via `resolveTaskSource()` / `resolveTaskSourceForTools()` have replaced this pattern entirely.

---

## 4. Related Files

### 4.1 `src/types/index.ts` — Type Definitions (400 LOC)

#### Task Interface (lines ~348-401)

Includes all core fields plus local enhancement fields added in v2.0:
- `priority`, `is_bookmarked`, `color_label`, `local_tags`, `kanban_order`, `view_count`, `last_viewed_at`
- Source tracking: `_local_id`, `_source_id`, `_source_name`, `_local_dirty`, `_last_synced_at`

#### Software Interface (lines ~327-345)

Unchanged from v1.x. Used by software selector dropdown.

### 4.2 `src/pages/admin/Dashboard.tsx` (755 LOC)

Imports `useTasks` hook. Computes derived stats from task data: unbilled tasks, active tasks, role tasks, phase counts, module counts, total unbilled hours. Provides task click → navigate to Tasks page with auto-open via `localStorage.openTaskId`. Includes phase-popover for workflow drilling.

### 4.3 `src/services/mobileActionExecutor.ts` — AI Assistant Task Executors (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/mobileActionExecutor.ts` |
| **Total LOC** | ~2,845 (shared file — serves multiple modules) |
| **Task-related LOC** | ~700 |
| **Purpose** | 22 task tool executor functions for the Staff AI Assistant |
| **Dependencies** | db/mysql, same external APIs as softawareTasks.ts |
| **Key exports** | 22 `exec_task_*` functions, `resolveTaskSourceForTools()`, `taskProxyV2()`, `resolveLocalTask()` |

#### Task Tool Executors (22 functions)

| Function | Type | Description |
|----------|------|-------------|
| `exec_task_list` | Read | List/filter tasks from `local_tasks` |
| `exec_task_get` | Read | Get single task by ID |
| `exec_task_create` | Write | Create task via proxy |
| `exec_task_update` | Write | Update task via proxy |
| `exec_task_delete` | Write | Delete task via proxy |
| `exec_task_start` | Write | Start task workflow |
| `exec_task_complete` | Write | Complete task |
| `exec_task_approve` | Write | Approve task |
| `exec_task_reorder` | Write | Reorder tasks |
| `exec_task_comment_add` | Write | Add comment |
| `exec_task_comment_delete` | Write | Delete comment |
| `exec_task_comments` | Read | List comments |
| `exec_task_attachment_upload` | Write | Upload attachment |
| `exec_task_attachment_delete` | Write | Delete attachment |
| `exec_task_attachments` | Read | List attachments |
| `exec_task_association_add` | Write | Link tasks |
| `exec_task_association_remove` | Write | Unlink tasks |
| `exec_task_associations` | Read | List associations |
| `exec_task_time_update` | Write | Update time tracking |
| `exec_task_invoice` | Write | Invoice tasks |
| `exec_task_bill` | Write | Bill tasks |
| `exec_task_stats` | Read | Get task statistics |

#### Helper Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `resolveTaskSourceForTools(softwareId)` | `number` | `{ baseUrl, apiKey, sourceId }` | Looks up `task_sources` by `software_id` — mirrors `resolveTaskSource()` from HTTP routes |
| `taskProxyV2(baseUrl, path, method, apiKey, body?)` | `string, string, string, string, any?` | `Promise<{ status, data }>` | Proxy gateway for AI assistant — mirrors `proxyToExternal()` |
| `resolveLocalTask(taskId, softwareId)` | `string, number` | `Promise<LocalTask>` | Resolves task from `local_tasks` table for read-path tools |

### 4.4 `src/services/mobileTools.ts` — AI Assistant Tool Definitions (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/mobileTools.ts` |
| **Total LOC** | ~1,500 (shared file) |
| **Task-related LOC** | ~400 |
| **Purpose** | 22 task tool definitions in `staffTaskTools` array — name, description, parameters, required fields |
| **Key export** | `staffTaskTools: ToolDefinition[]` |

Each tool definition specifies:
- `name` — matches the `exec_task_*` function name
- `description` — natural language description for AI model
- `parameters` — JSON Schema for required/optional inputs
- `category` — `"task_management"` for all 22 tools

### 4.5 `tests/task-tools.test.ts` — Task Tool Unit Tests (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/tests/task-tools.test.ts` |
| **LOC** | ~400 |
| **Purpose** | 80 vitest unit tests covering all 22 task tool executors |
| **Framework** | vitest |
| **Run command** | `npm test` or `npx vitest` |
| **Execution time** | ~1.2 seconds |

#### Test Categories

| Category | Tests | Coverage |
|----------|-------|----------|
| Write-path tools | 48 | All 16 proxy executor functions |
| Read-path tools | 18 | All 6 local read executor functions |
| Role guards | 8 | Permission enforcement |
| Edge cases | 6 | Missing params, invalid IDs, empty results |

### 4.6 `vitest.config.ts` — Test Configuration (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/vitest.config.ts` |
| **LOC** | ~15 |
| **Purpose** | Vitest framework configuration for the backend test suite |

### 4.7 Other Related Files

| File | LOC | Purpose |
|------|-----|-------|
| `src/hooks/useSoftware.ts` | ~40 | Fetches software list |
| `src/hooks/useModules.ts` | ~45 | Fetches modules per software |
| `src/services/api.ts` | ~75 | Axios client with JWT interceptor |
| `src/types/index.ts` | 400 | Software + Task interfaces |
| `src/pages/admin/Dashboard.tsx` | 755 | Task stats + navigation integration |
| `src/pages/general/Profile.tsx` | — | AI tool counts (59 total, 15 task management) |
