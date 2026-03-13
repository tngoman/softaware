# Tasks Module — Changelog

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## v2.3.0 — Image Gallery Lightbox & Last Comment Enhancements

**Release Type:** Minor — New features for image viewing and comment display. No breaking changes.

### Summary

Adds a full-featured image gallery lightbox for navigating all task images with prev/next arrows, thumbnails, zoom, and keyboard shortcuts. Enhances the last comment display on task cards with improved visibility, a styled visual container, and comment metadata (author name + relative date).

---

### 🖼️ New Feature: Image Gallery Lightbox

**Problem:** Clicking a task image opened a simple full-screen overlay showing a single image. To view other images from the same task, users had to close the overlay and click each image individually.

**Solution:** New `TaskImageLightbox` component (181 LOC) provides a navigable gallery of all images attached to the same task.

**Features:**
- **Prev/Next navigation** arrows to browse all task images in sequence
- **Thumbnail strip** at the bottom for quick jumping between images
- **Zoom** via mouse wheel, +/- buttons, or double-click (up to 5×)
- **Pan** by clicking and dragging when zoomed in
- **Keyboard shortcuts:** Escape (close), ← / → (navigate), +/- (zoom)
- **Download button** for the current image
- **Image counter** ("2 / 5") and filename display

**Image Collection Strategy:**

In the **TaskDetailPanel**, a `useMemo` (`allImages`) collects images from two sources:
1. Task-level attachments (from `GET /api/softaware/tasks/:id/attachments`)
2. Comment-level attachments (from inline comment data)

All image-bearing elements (description inline `<img>`, attachment grid, comment inline images, comment attachments) call `openGallery(url)` which finds the clicked image's index in `allImages` and opens the lightbox at that position.

In the **main TasksPage** (list and kanban views), `TaskAttachmentsInline` provides image list via the new `onGalleryOpen` callback, which passes all image URLs + the clicked index upstream.

**Prop Threading (onGalleryOpen):**
```
TasksPage → KanbanBoard → KanbanColumn → SortableCard → TaskCard → TaskAttachmentsInline
TasksPage → TaskCard (list variant) → TaskAttachmentsInline
```

---

### 💬 Enhanced Feature: Last Comment Display

Three incremental improvements to the last comment preview on task cards:

#### 1. Text Visibility
- Increased character limit from 60 to 200 characters
- Changed from `line-clamp-1` to `line-clamp-2` for more visible text
- Improved color contrast: `text-gray-600` (was `text-gray-400/500`)
- Uses `FS_DESC` font size map instead of `FS_META` for better readability
- Removed italic styling

#### 2. Visual Distinction
- Comments now render in a styled container with `border-l-2 border-indigo-300 bg-indigo-50/50`
- Uppercase "LAST COMMENT" label header distinguishes comments from descriptions
- Clear visual boundary between task description and last comment

#### 3. Comment Metadata (Author + Date)

**Data model change:** `lastComments` state changed from `Record<number, string>` to `Record<number, { text: string; author: string; date: string | null }>`.

- The `fetchLastComments` function now extracts author name (`user_name` / `username` / `created_by` field fallback) and `created_at` from the most recent comment
- Author name rendered in bold indigo text
- Relative date (e.g., "5m ago", "3d ago") right-aligned in the comment header
- Both metadata fields displayed in the comment container header alongside the "LAST COMMENT" label

---

### 🆕 New Files

| File | LOC | Purpose |
|------|-----|---------|
| `src/components/TaskImageLightbox.tsx` | 181 | Standalone gallery lightbox with navigation, zoom, pan, thumbnails, keyboard shortcuts, download |

**Exports:** `default` (TaskImageLightbox component), `LightboxImage` interface (`{ url: string; name?: string }`)

---

### 🔄 Modified Files

| File | Old LOC | New LOC | Changes |
|------|---------|---------|---------|
| `TasksPage.tsx` | 2,605 | 2,652 | TaskDetailPanel: `galleryImages`/`galleryIndex` state replacing `expandedImage`, `allImages` useMemo, `openGallery` callback, `TaskImageLightbox` rendering. Main page: `cardGalleryImages`/`cardGalleryIndex` state, `onGalleryOpen` handlers for kanban + list views. `lastComments` state type changed to object with `text`/`author`/`date`, `fetchLastComments` extracts metadata |
| `TaskAttachmentsInline.tsx` | 109 | 125 | Added `onGalleryOpen` prop, `imageList` computation from attachments, `handleImageClick` preferring gallery over single image click |
| `TaskCard.tsx` | 568 | 588 | Added `onGalleryOpen` prop to interface + destructuring, passed to both `TaskAttachmentsInline` instances (kanban + list variants). Last comment rendering: styled container, metadata display, increased text visibility |
| `KanbanBoard.tsx` | 340 | 346 | `onGalleryOpen` prop threaded through `CardActionProps` → `SortableCard` → `KanbanColumn` → `KanbanBoardProps` → column rendering |

---

### 📊 By the Numbers

| Metric | v2.2.1 | v2.3.0 | Delta |
|--------|--------|--------|-------|
| Frontend component files | 10 | 11 | +1 (TaskImageLightbox) |
| Frontend component LOC | ~1,830 | ~2,050 | +220 |
| TasksPage LOC | 2,605 | 2,652 | +47 |
| TaskAttachmentsInline LOC | 109 | 125 | +16 |
| TaskCard LOC | 568 | 588 | +20 |
| KanbanBoard LOC | 340 | 346 | +6 |
| Total Frontend LOC | ~6,100 | ~6,400 | +300 |

---

## v2.2.1 — Attachment URL Fix

**Release Type:** Patch — Bug fix for attachment image/file display. No breaking changes.

### Summary

Fixes attachment thumbnails and file links not rendering on task cards, task detail panels, and comments. The `buildFileUrl()` and `buildAttachmentUrl()` functions were constructing incorrect URLs instead of using the `download_url` returned by the external API.

---

### 🐛 Bug Fix: Attachment URLs

**Problem:** All attachment images and file links failed to display across the entire Tasks UI (card thumbnails, detail panel grid, edit dialog, comment attachments).

**Root Cause:** The external API returns each attachment with a `download_url` field pointing to the public static file path (`/uploads/development/{file}`). Both `buildFileUrl()` (in `TaskAttachmentsInline.tsx`) and `buildAttachmentUrl()` (in `TasksPage.tsx`) were **ignoring** this field and instead constructing URLs like `{origin}/uploads/{folder}/{file_path}`. While this happened to work for direct file access, the functions never checked `download_url` first — and the API's canonical URL is the authoritative path.

**Fix:** Both URL-building functions now prefer `att.download_url` when present, with graceful fallback to the constructed path for backward compatibility.

**URL Resolution Order (v2.2.1):**
1. `att.download_url` — preferred (public static path from external API, no auth required)
2. `att.file_path` starting with `http` — already a full URL
3. Constructed `{origin}/uploads/{folder}/{file_path}` — legacy fallback

**Affected locations (all 4 use `buildAttachmentUrl` or `buildFileUrl`):**
- Task card inline thumbnails (`TaskAttachmentsInline`)
- Task detail panel attachment grid
- Task edit dialog attachment grid
- Comment attachment images and file links

---

### 🔄 Modified Files

| File | Changes |
|------|---------|
| `TaskAttachmentsInline.tsx` | Added `download_url?: string` to `Attachment` interface; `buildFileUrl()` now checks `att.download_url` first |
| `TasksPage.tsx` | `buildAttachmentUrl()` now checks `att.download_url` first |

---

### 📝 Key Detail: download_url

The external API (`GET /api/tasks-api/{id}/attachments`) returns:
```json
{
  "download_url": "https://portal.silulumanzi.com/uploads/development/task_132_...png"
}
```

This points to the **public static file path** served by Apache — no API key or session required. Safe for `<img src>`, `<a href>`, and direct browser access.

> **Note:** The `/api/tasks-api/attachments/{filename}` download endpoint requires `X-API-Key` authentication and is intended for programmatic/CLI access, not browser `<img>` tags.

---

## v2.2.0 — AI Assistant Integration, Deprecation & Testing

**Release Type:** Minor — New integration surface, official deprecation of legacy auth, and comprehensive test suite. No breaking changes.

### Summary

Adds full task management via the Staff AI Assistant (22 tool handlers), officially deprecates `staff_software_tokens`, and introduces an 80-test vitest suite covering all assistant task tool executors.

---

### 🤖 AI Assistant Task Tools (22 tools)

Staff can now manage the entire task lifecycle via voice/text through the AI assistant. The assistant dispatches task operations through **22 dedicated tool handlers** in `mobileActionExecutor.ts`, using the same dual-path architecture as the HTTP routes.

#### Write Path Tools (proxied to external APIs via `taskProxyV2`)

| Tool | Method | External Endpoint | Description |
|------|--------|-------------------|-------------|
| `exec_task_create` | POST | `/api/tasks-api` | Create a new task |
| `exec_task_update` | PUT | `/api/tasks-api/{id}` | Update task fields |
| `exec_task_delete` | DELETE | `/api/tasks-api/{id}` | Delete a task |
| `exec_task_start` | POST | `/api/tasks-api/{id}/start` | Start task workflow |
| `exec_task_complete` | POST | `/api/tasks-api/{id}/complete` | Complete task |
| `exec_task_approve` | POST | `/api/tasks-api/{id}/approve` | Approve task |
| `exec_task_reorder` | POST | `/api/tasks-api/reorder` | Reorder tasks |
| `exec_task_comment_add` | POST | `/api/tasks-api/{id}/comments` | Add comment |
| `exec_task_comment_delete` | DELETE | `/api/tasks-api/comments/{id}` | Delete comment |
| `exec_task_attachment_upload` | POST | `/api/tasks-api/{id}/attachments` | Upload attachment |
| `exec_task_attachment_delete` | DELETE | `/api/tasks-api/attachments/{path}` | Delete attachment |
| `exec_task_association_add` | POST | `/api/tasks-api/{id}/associate` | Link tasks |
| `exec_task_association_remove` | DELETE | `/api/tasks-api/{id}/associate` | Unlink tasks |
| `exec_task_time_update` | PUT | `/api/tasks-api/time` | Update time tracking |
| `exec_task_invoice` | POST | `/api/tasks-api/invoice-tasks` | Invoice tasks |
| `exec_task_bill` | POST | `/api/tasks-api/bill` | Bill tasks |

#### Read Path Tools (local MySQL via `resolveLocalTask`)

| Tool | Source | Description |
|------|--------|-------------|
| `exec_task_list` | `local_tasks` table | List/filter tasks with pagination |
| `exec_task_get` | `local_tasks` table | Get single task by ID |
| `exec_task_comments` | External API (GET) | List task comments |
| `exec_task_attachments` | External API (GET) | List task attachments |
| `exec_task_stats` | External API (GET) | Task statistics |
| `exec_task_associations` | External API (GET) | List task associations |

#### Key Helper Functions

| Function | Purpose |
|----------|---------|
| `resolveTaskSourceForTools(softwareId)` | Looks up `task_sources` by `software_id` — returns `{ baseUrl, apiKey, sourceId }` |
| `taskProxyV2(baseUrl, path, method, apiKey, body?)` | Proxy gateway for AI assistant tool calls (same pattern as `proxyToExternal` in HTTP routes) |
| `resolveLocalTask(taskId, softwareId)` | Resolve task from `local_tasks` table for read-path tools |

#### Auth Flow

The AI assistant uses the **same source-level API-key authentication** as the HTTP routes — `resolveTaskSourceForTools()` mirrors `resolveTaskSource()`, reading `task_sources.api_key` and forwarding it as `X-API-Key` to external APIs. No per-user tokens involved.

---

### ⚠️ staff_software_tokens — Official Deprecation

The `staff_software_tokens` table and all associated endpoints/utilities have been officially deprecated:

| Item | File | Status |
|------|------|--------|
| `staff_software_tokens` table creation | `012_staff_sandbox_prompts.ts` | ⚠️ DEPRECATED (v2.2.0) |
| `POST /authenticate` endpoint | `myAssistant.ts` | ⚠️ DEPRECATED — returns stub |
| `POST /authenticate` endpoint | `staffAssistant.ts` | ⚠️ DEPRECATED — returns stub |
| `softwareAuth.ts` utility | Frontend | ⚠️ DEPRECATED (v2.2.0) |

**Reason:** Source-level API keys in `task_sources` have fully replaced per-user external tokens since v2.0. The old table, endpoints, and utilities are no longer needed by any active feature.

---

### 🧪 Test Suite (80 tests)

New comprehensive test suite using **vitest** covering all 22 AI assistant task tool executors:

| Category | Tests | Coverage |
|----------|-------|----------|
| Write-path tools (16 executors) | 48 | All proxy tools: create, update, delete, start, complete, approve, reorder, comment, attachment, association, time, invoice, bill |
| Read-path tools (6 executors) | 18 | List, get, comments, attachments, stats, associations |
| Role guard tests | 8 | Permission enforcement for admin-only and staff-only tools |
| Edge cases | 6 | Missing params, invalid IDs, empty results |
| **Total** | **80** | **All pass in ~1.2s** |

**Files:**
- `tests/task-tools.test.ts` — 80 tests
- `vitest.config.ts` — Test framework configuration

**Run:** `npm test` or `npx vitest`

---

### 🆕 New Files

| File | LOC | Purpose |
|------|-----|---------|
| `src/services/mobileActionExecutor.ts` | ~2,845 | 22 task tool executors + helpers (shared file with other modules) |
| `src/services/mobileTools.ts` | ~1,500 | 22 task tool definitions in `staffTaskTools` array (shared file) |
| `tests/task-tools.test.ts` | ~400 | 80 vitest unit tests for task tool executors |
| `vitest.config.ts` | ~15 | Vitest configuration |

> **Note:** `mobileActionExecutor.ts` and `mobileTools.ts` are shared files serving multiple modules (Assistants, Tasks). Only the task-related portions (~700 LOC) are part of the Tasks module surface.

---

### 📊 By the Numbers

| Metric | v2.1 | v2.2 | Delta |
|--------|------|------|-------|
| Task tool handlers | 0 | 22 | +22 |
| Unit tests | 0 | 80 | +80 |
| Backend LOC (task-related in shared files) | — | ~700 | +700 |
| Test LOC | 0 | ~400 | +400 |
| Deprecated items | 3 (informal) | 7 (official) | +4 |

---

## v2.1.0 — UX Refinements & Stats Overhaul

**Release Type:** Minor — New features, bug fixes, and UI improvements. No breaking changes.

### Summary

UX polish release adding a font size picker, same-column kanban reorder, stats bar overhaul, sync status toggle with case creation, and toolbar icon grouping.

---

### 🆕 New Features

#### Font Size Picker (S / M / L)

- **TaskToolbar** gains a 3-button toggle (S / M / L) that sets `TaskFontSize` (`'sm' | 'md' | 'lg'`).
- Choice persisted in `localStorage.tasksFontSize`.
- `TaskCard` defines 6 inline-style maps (`FS_TITLE`, `FS_META`, `FS_BADGE`, `FS_DESC`, `FS_ACTION`, `FS_PAD`) that replace all hardcoded Tailwind text sizes.
- `fontSize` prop threaded through: `TasksPage → KanbanBoard → KanbanColumn → SortableCard → TaskCard`.
- Works consistently in **both list and kanban** variants.

#### Same-Column Kanban Reorder

- Dragging a card **within the same column** now reorders via `arrayMove` from `@dnd-kit/sortable`.
- `KanbanBoard.handleDragEnd` has a new else-branch for same-column drops.
- New `onReorder` callback prop on `KanbanBoard` fires with `{ id, kanban_order }[]`.
- `TasksPage.handleReorder` applies **optimistic UI update** → persists via `PATCH /local-tasks/bulk`.
- On failure, reverts by calling `loadTasks()`.

#### Sync Status Toggle

- New **SignalIcon / SignalSlashIcon** indicator in toolbar shows whether sync is enabled.
- Click toggles sync on/off globally.
- **Disable flow:** SweetAlert2 dialog with reason selection (Performance, Testing, Maintenance, Data Issues, Other + detail field). Creates a **support case** via `POST /sync/disable`.
- **Enable flow:** `POST /sync/enable` re-enables all sources silently.
- 3 new backend endpoints: `GET /sync/enabled`, `POST /sync/disable`, `POST /sync/enable`.

#### Toolbar Icon Grouping

- Sync status indicator, Sync button (ArrowPathIcon), and Refresh button grouped into a unified `button-group` with shared border rounding.

---

### 🐛 Bug Fixes

#### Stats Bar Overhaul

- **Removed "Overdue" metric** — `end_date` is a scheduling time block, not a deadline. All 182 tasks had an `end_date`, making 66 non-completed ones appear falsely "overdue".
- **Added Completed** (emerald, CheckCircleIcon) and **Pending** (gray, ClockIcon, conditional — only shows when count > 0).
- Stats bar now receives `unbilledTasks` instead of `tasks`, so billed tasks are excluded from counts.
- Count denominator (e.g., "96 / 96 tasks") now uses `unbilledTasks.length` instead of `tasks.length`.

#### Font Size Kanban Bug

- `fontSize` prop was only applied to the **list** variant of `TaskCard`. The kanban variant had hardcoded Tailwind sizes (`text-[10px]`, `text-[11px]`, `text-sm`).
- Fix: replaced all hardcoded sizes in the kanban variant with `style={FS_*[fs]}` inline styles.

---

### 🔄 Modified Files

| File | Old LOC | New LOC | Changes |
|------|---------|---------|---------|
| `TaskCard.tsx` | 532 | 568 | Font size style maps (FS\_*), fontSize prop, inline styles for both variants |
| `KanbanBoard.tsx` | 312 | 340 | onReorder callback, arrayMove import, same-column reorder logic, fontSize threading |
| `TaskToolbar.tsx` | 247 | 276 | Font size picker (S/M/L), sync status toggle, icon button grouping, TaskFontSize export |
| `TaskStatsBar.tsx` | 47 | 45 | Replaced Overdue with Completed + Pending, new icon imports |
| `TasksPage.tsx` | 2,535 | 2,605 | unbilledTasks memo, taskFontSize state, handleReorder, handleSyncStatusToggle, fontSize prop passing |
| `localTasks.ts` | 860 | 862 | sync/enabled + sync/enable + sync/disable endpoints (added earlier in v2.0 cycle) |

---

### 📊 By the Numbers

| Metric | v2.0 | v2.1 | Delta |
|--------|------|------|-------|
| Frontend LOC (Tasks components) | ~1,730 | ~1,830 | +100 |
| TasksPage LOC | 2,535 | 2,605 | +70 |
| Backend LOC (localTasks) | 860 | 862 | +2 |
| New localStorage keys | — | `tasksFontSize` | +1 |
| New backend endpoints | — | 3 (sync toggle) | +3 |

---

## v2.0.0 — Dual-Path Architecture

**Release Type:** Major — Breaking changes to auth model, data flow, and API surface.

### Summary

Complete architectural overhaul from a pure proxy model (v1.x) to a dual-path architecture with local database caching, a sync engine, source-level API-key authentication, and a rich local enhancement layer.

---

### ⚡ Architecture Changes

| Aspect | v1.x | v2.0 |
|--------|------|------|
| **Read path** | Proxy → external API | Local MySQL database |
| **Write path** | Proxy → external API | Proxy → external API (unchanged) |
| **Auth model** | Per-user, per-software OTP tokens | Source-level API keys |
| **Token storage** | `localStorage: software_token_{id}` | `task_sources.api_key` (DB) |
| **Auth header** | `X-Software-Token` | `X-API-Key` (configurable) |
| **Data source** | External API (live) | Local cache (synced) |
| **Enrichments** | None | Priority, bookmarks, tags, colour labels, kanban order, view tracking |
| **Frontend hook** | `useTasks` → `GET /api/softaware/tasks` | `useTasks` → `GET /api/local-tasks` |

---

### 🆕 New Files

#### Backend

| File | LOC | Purpose |
|------|-----|---------|
| `src/routes/localTasks.ts` | 860 | Local tasks router — CRUD, sources, sync, enhancements, invoicing |
| `src/services/taskSyncService.ts` | 687 | Sync engine — adapters, hashing, upsert, push-back |
| `src/db/migrations/021_local_tasks.ts` | 200 | Migration: `task_sources`, `local_tasks`, `task_sync_log` tables |
| `src/db/migrations/022_task_enhancements.ts` | 96 | Migration: priority, bookmarks, tags, kanban, views columns |

#### Frontend

| File | LOC | Purpose |
|------|-----|---------|
| `src/hooks/useLocalTasks.ts` | 181 | Hook for source management, sync, and local enhancements |
| `src/models/LocalTasksModel.ts` | 206 | API client for all `/api/local-tasks` endpoints |
| `src/components/Tasks/TaskCard.tsx` | 532 | Rich task card with priority badge, bookmark, tags, colour label |
| `src/components/Tasks/KanbanBoard.tsx` | 312 | Kanban board with @dnd-kit drag-and-drop |
| `src/components/Tasks/TaskToolbar.tsx` | 247 | Filter toolbar (status, type, priority, bookmarked, tags) |
| `src/components/Tasks/TagInput.tsx` | 148 | Freeform tag input with autocomplete |
| `src/components/Tasks/ColorLabelPicker.tsx` | 56 | Colour label selector dropdown |
| `src/components/Tasks/TaskStatsBar.tsx` | 47 | Status distribution bar chart |
| `src/components/Tasks/PriorityBadge.tsx` | 34 | Priority indicator (urgent/high/normal/low) |
| `src/components/Tasks/index.ts` | 8 | Barrel exports |
| `src/components/TaskAttachmentsInline.tsx` | 105 | Inline attachment thumbnails on cards |

#### Database

| Table | Columns | Purpose |
|-------|---------|---------|
| `task_sources` | 18 | External source registry with API keys |
| `local_tasks` | 42+ | Cached tasks with enhancement columns |
| `task_sync_log` | 12 | Sync run history |

---

### 🔄 Modified Files

#### `softawareTasks.ts` (778 LOC)

**Breaking changes:**
- Replaced `softwareAuth` middleware with no-op `requireAuth`
- Replaced `X-Software-Token` auth with `resolveTaskSource()` → `X-API-Key`
- Removed per-user OTP authentication flow

**New endpoints added:**
- `POST /:id/start` — Start task workflow
- `POST /:id/complete` — Complete task workflow
- `POST /:id/approve` — Approve task
- `GET /pending-approval` — List pending approvals
- `GET /stats` — Task statistics
- `POST /sync` — External sync
- `POST /invoice-tasks` — Invoice tasks
- `POST /bill` — Bill tasks
- `PUT /time` — Update time
- `GET /statement` — Get statement
- `GET /orders/latest` — Latest orders
- `GET /orders/budgets` — All budgets
- `GET /orders/:orderNumber/budget` — Budget for order
- `GET /:id/parent` — Get parent task
- `DELETE /comments/:commentId` — Delete comment
- `POST /comments/:commentId/convert-to-task` — Convert comment to task
- `GET /attachments/:filename` — Stream attachment binary
- `POST /:id/comments/with-attachment` — Comment with Excalidraw drawing

**Notifications added:**
- `sendTaskAssignmentNotification()` — fires on task update with `assigned_to` change
- `sendTaskPhaseChangeNotification()` — fires on `workflow_phase` change

#### `useTasks.ts` (99 LOC)

**Breaking change:** Now fetches from `GET /api/local-tasks` instead of `GET /api/softaware/tasks`.

- Added normalisation of `local_tasks` columns → `Task` interface
- Added `_local_id`, `_source_id`, `_source_name`, `_local_dirty`, `_last_synced_at` metadata fields
- Retained `useCallback` memoisation and `isLoading`/`error` state

#### `TasksPage.tsx` (2,535 LOC, was ~2,241)

**New features:**
- Kanban board view (toggle between list and kanban)
- Invoice staging panel (stage/unstage/process)
- Priority, bookmark, and tag management in task dialogs
- Colour label picker
- Comment deletion and comment-to-task conversion
- Attachment streaming (inline image viewing)
- Billing mode with staged task counts
- View tracking (auto-increment on task open)

#### `types/index.ts`

Added to `Task` interface:
- `priority`, `is_bookmarked`, `color_label`, `local_tags`, `kanban_order`, `view_count`, `last_viewed_at`
- `_local_id`, `_source_id`, `_source_name`, `_local_dirty`, `_last_synced_at`

---

### 🗑️ Deprecated / Legacy

| Item | Status | Notes |
|------|--------|-------|
| `softwareAuth.ts` middleware | **Unused** by Tasks | Still exists (32 LOC), may be used by other modules |
| `software_token_{id}` localStorage | **Ignored** | No longer set or read by Tasks module |
| `POST /authenticate` endpoint | **Stub** | Always returns `{ success: true, token: null }` |
| Per-user external auth flow | **Removed** | Replaced by source-level API keys |

---

### 📦 New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | — | Drag-and-drop primitives for kanban |
| `@dnd-kit/sortable` | — | Sortable preset for kanban columns |
| `@dnd-kit/utilities` | — | CSS utilities for drag-and-drop |
| `@excalidraw/excalidraw` | 0.18.0 | Whiteboard drawing in comments |
| `react-quill` | 2.0.0 | Rich text editor for descriptions/comments |
| `react-datepicker` | 8.8.0 | Date selection |
| `date-fns` | 2.30.0 | Date formatting and manipulation |
| `@headlessui/react` | — | Accessible UI components (dropdowns, dialogs) |
| `sweetalert2` | — | Confirmation dialogs |
| `react-hot-toast` | — | Toast notifications |

> **Note:** Node.js 18+ native `fetch`, `FormData`, and `Blob` are used directly — no `axios`, `node-fetch`, or `form-data` packages needed.

---

### 🛣️ Migration Guide

#### For Administrators

1. **Run migrations** — Execute `021_local_tasks` and `022_task_enhancements` to create the three new tables.
2. **Register sources** — `POST /api/local-tasks/sources` for each external API, providing `name`, `base_url`, and `api_key`.
3. **Initial sync** — `POST /api/local-tasks/sync` to populate the `local_tasks` cache.
4. **Verify** — `GET /api/local-tasks?page=1&limit=10` should return cached tasks.

#### For Frontend Developers

- The `useTasks` hook API is **unchanged** — it still returns `{ tasks, isLoading, error, fetchTasks }`.
- Task `id` values now come from `external_id` (the remote system's ID), not the local DB `id`.
- Use `_local_id` for local enhancement endpoints (bookmark, priority, tags, etc.).
- The software selector still works — pass `software_id` to filter by source.
- `localStorage.software_token_{id}` is no longer needed — remove any code that sets it.

#### For API Consumers

- All proxy endpoints still work at `/api/softaware/tasks/*`.
- Include `software_id` in query params or request body to resolve the correct source.
- The `/authenticate` endpoint is a no-op — safe to call but unnecessary.
- New local endpoints at `/api/local-tasks/*` provide cached reads and local enhancements.

---

### 📊 By the Numbers

| Metric | v1.x | v2.0 | Delta |
|--------|------|------|-------|
| Backend files | 1 | 4 | +3 |
| Frontend files | ~4 | ~15 | +11 |
| Backend LOC | ~400 | ~2,325 | +1,925 |
| Frontend LOC | ~2,500 | ~4,600 | +2,100 |
| API endpoints | ~15 | ~61 | +46 |
| Database tables | 0 | 3 | +3 |
| Database columns | 0 | ~72 | +72 |
| Migrations | 0 | 2 | +2 |
