# Tasks Module — Architecture Patterns

**Version:** 2.3.0  
**Last Updated:** 2026-03-10

---

## 1. Dual-Path Architecture

The defining pattern of v2.0. Reads and writes follow separate paths.

### Read Path (Local Database)

```
Frontend (useTasks hook)
  → GET /api/local-tasks?status=new&page=1
    → localTasks.ts
      → SELECT FROM local_tasks JOIN task_sources
        → MySQL response
```

- **All reads** go to the local `local_tasks` table.
- Paginated, filterable, fast — no external API latency.
- The `useTasks` hook normalises `local_tasks` rows into the `Task` interface expected by the UI.

### Write Path (External Proxy)

```
Frontend (TaskDialog submit)
  → POST /api/softaware/tasks { task, software_id }
    → softawareTasks.ts
      → resolveTaskSource(req) → task_sources → { baseUrl, apiKey }
        → proxyToExternal(baseUrl, '/api/tasks-api', 'POST', apiKey, task)
          → External PHP Tasks API
```

- **All writes** go through the proxy router to the external API.
- The external API remains the source of truth for mutations.
- After a write, the local cache becomes stale until the next sync.

### Why Dual-Path?

1. **Performance**: Local reads avoid ~150-300ms external API round trips per request.
2. **Enrichment**: Local-only fields (priority, bookmarks, tags, kanban order) live alongside synced data.
3. **Offline resilience**: If external APIs are unreachable, read operations still work.
4. **Aggregation**: Multiple external sources can be queried from one local table.

---

## 2. Source-Level API-Key Authentication

### v1.x Pattern (Removed)

```
User → POST /authenticate { email, password, software_id }
     → External API returns JWT
     → Stored in localStorage as software_token_{id}
     → Sent as X-Software-Token header on every request
```

Each user had to authenticate separately against each external software product.

### v2.0 Pattern

```
Admin registers source via POST /api/local-tasks/sources
  → task_sources table stores api_key

Request arrives → resolveTaskSource(req) reads:
  1. software_id → lookup task_sources WHERE software_id = ?
  2. apiUrl → lookup task_sources WHERE base_url = ?
  3. apiUrl origin → lookup task_sources WHERE base_url LIKE origin%

Result: { baseUrl, apiKey, sourceId }
  → Used in X-API-Key header for all external requests
```

**Key characteristics:**
- **One API key per source**, shared across all users.
- Keys stored in the database, never exposed to the frontend (masked as `••••••••` in GET /sources).
- The `requireAuth` middleware is a **no-op pass-through** — `(_req, _res, next) => next()`.
- The `/authenticate` endpoint is a **stub** returning `{ success: true, token: null }` for backward compatibility.
- Resolution cascade: `software_id` → exact `base_url` match → origin prefix match.

### Auth Methods Supported

| Method | Header | Usage |
|--------|--------|-------|
| `api-key` | Configurable (`auth_header`, default `X-API-Key`) | PHP Tasks API sources |
| `bearer` | `Authorization: Bearer {key}` | Software proxy sources |
| `software-token` | Legacy compat | Not actively used |
| `none` | — | Manual/local sources |

---

## 3. Sync Engine

### Architecture

The sync service (`taskSyncService.ts`, 687 LOC) is a pull-then-push engine:

```
syncSource(sourceId)
  ├── Step 1: pushDirtyTasks(source)         ← push local edits first
  │     └── POST {baseUrl}/api/tasks-api/sync { tasks: [...] }
  │     └── Clear local_dirty = 0 on success
  ├── Step 2: adapter(source) → NormalisedTask[]   ← fetch remote
  │     └── fetchFromTasksApi() or fetchFromSoftwareProxy()
  │     └── Paginated fetch (page 1..N)
  │     └── normalise*Task() → NormalisedTask
  ├── Step 3: upsertTasks(sourceId, tasks)   ← merge into local DB
  │     └── For each task:
  │         ├── Compute SHA-256 hash
  │         ├── Compare with stored sync_hash
  │         ├── If unchanged → skip (unchanged++)
  │         ├── If dirty → update sync metadata only (don't overwrite local edits)
  │         ├── If changed → full UPDATE
  │         └── If new → INSERT
  │     └── Soft-delete tasks missing from remote (unless dirty)
  └── Step 4: Log to task_sync_log
```

### Adapter Pattern

Each source type has a dedicated fetch-and-normalise adapter:

```typescript
const ADAPTERS: Record<string, FetchAdapter> = {
  'tasks-api': fetchFromTasksApi,     // PHP portal Tasks API
  'software-proxy': fetchFromSoftwareProxy,  // Software product APIs
};
```

Adding a new source type (e.g., `github`, `jira`) requires:
1. Write a `fetchFrom{Source}()` function that returns `NormalisedTask[]`
2. Register it in the `ADAPTERS` map

### SHA-256 Change Detection

```typescript
function computeSyncHash(task: NormalisedTask): string {
  const payload = JSON.stringify(task, Object.keys(task).sort());
  return crypto.createHash('sha256').update(payload).digest('hex');
}
```

- Keys are sorted for **deterministic JSON**.
- Stored in `local_tasks.sync_hash` (VARCHAR(64)).
- Compared on next sync — if hash matches, the row is skipped entirely.
- Eliminates unnecessary UPDATE queries for unchanged tasks.

### Dirty-Flag Awareness

The `local_dirty` column (TINYINT) prevents sync from overwriting local edits:

| Scenario | `local_dirty` | Sync Behaviour |
|----------|---------------|----------------|
| Remote changed, no local edits | 0 | Full update from remote |
| Remote unchanged, no local edits | 0 | Skip (hash match) |
| Remote changed, local edits exist | 1 | Update sync metadata only (hash + timestamp) |
| Remote unchanged, local edits exist | 1 | Skip |
| Push phase | 1 → 0 | Push local changes to remote, then clear flag |

### Auto-Sync

```typescript
export async function syncDueSources(): Promise<SyncResult[]> {
  // Finds sources where TIMESTAMPDIFF(MINUTE, last_synced_at, NOW()) >= sync_interval_min
  // Meant to be called from a cron/interval timer
}
```

Each source has a configurable `sync_interval_min` (default: 15 minutes, 0 = manual only).

---

## 4. Status Normalisation

External APIs use inconsistent status values. Both the sync service and frontend normalise them:

```typescript
function normaliseStatus(status: string): string {
  const s = (status || '').toLowerCase().trim();
  if (s === 'progress') return 'in-progress';
  if (['new', 'in-progress', 'completed', 'pending'].includes(s)) return s;
  return 'new';
}
```

**Canonical statuses:** `new`, `in-progress`, `completed`, `pending`

The `useTasks` hook also maps `"progress"` → `"in-progress"` on the frontend side, creating a double-normalisation safety net.

---

## 5. Proxy Pattern

The `proxyToExternal()` function is the single gateway for all external API calls:

```typescript
async function proxyToExternal(
  baseUrl: string,
  path: string,
  method: string,
  apiKey: string,
  body?: any
): Promise<{ status: number; data: any }>
```

**Characteristics:**
- Uses Node 18+ native `fetch` (no axios/node-fetch).
- Always sends `Content-Type: application/json` + `Accept: application/json` + `X-API-Key`.
- For file uploads, the proxy builds native `FormData`/`Blob` objects directly (no multer/busboy).
- Binary streaming (attachment download) bypasses `proxyToExternal()` and uses raw `fetch` → `Buffer.from(resp.arrayBuffer())` → `res.send(buffer)`.

### Attachment URL Resolution Pattern (v2.2.1)

The external API returns each attachment with a `download_url` field pointing to the **public static file path**:
```
https://portal.silulumanzi.com/uploads/development/{file_path}
```

This path is served directly by Apache with **no authentication** — making it safe for `<img src>`, `<a href>`, and direct browser access.

Both `buildFileUrl()` (TaskAttachmentsInline) and `buildAttachmentUrl()` (TasksPage) resolve URLs in this order:

1. **`att.download_url`** — preferred (public static path from API, no auth)
2. **`att.file_path` starting with `http`** — already a full URL
3. **Constructed `{origin}/uploads/{folder}/{file_path}`** — legacy fallback

> **Important:** The `/api/tasks-api/attachments/{filename}` download endpoint requires `X-API-Key` auth and is for programmatic/CLI use only. Browser `<img>` tags must use the static `/uploads/` path (which is what `download_url` provides).

### Two-Step Comment+Attachment Pattern

The `POST /:id/comments/with-attachment` endpoint demonstrates a transactional two-step proxy:

1. Create comment → extract `comment_id` from response
2. Upload base64 image as attachment linked to the new comment
3. Return combined result

This handles the external API's lack of a single endpoint for "comment with embedded image".

---

## 6. Local Enhancement Layer

Seven columns added in migration `022_task_enhancements.ts` that exist **only locally** and are never synced upstream:

| Enhancement | Column | Endpoint | UI Component |
|-------------|--------|----------|--------------|
| Priority | `priority` | `PATCH /:id/priority` | PriorityBadge, TaskToolbar filter |
| Bookmarks | `is_bookmarked` | `PATCH /:id/bookmark` | Star icon on TaskCard |
| Colour Labels | `color_label` | `PATCH /:id/color-label` | ColorLabelPicker |
| Tags | `local_tags` (JSON) | `PATCH /:id/tags` | TagInput |
| Kanban Order | `kanban_order` | `PATCH /bulk` | KanbanBoard (drag-and-drop) |
| View Tracking | `view_count` + `last_viewed_at` | `PATCH /:id/view` | Auto-tracked on open |

These enhancements let users organise and triage tasks locally without affecting the upstream system.

---

## 7. Kanban Board

### Drag-and-Drop Stack

```
@dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
  → KanbanBoard (346 LOC)
    → Columns per status (new, in-progress, completed, pending)
    → TaskCard (588 LOC) as draggable items
```

### Reorder Persistence

When a card is dropped:
1. Frontend computes new `kanban_order` values for affected cards.
2. `PATCH /api/local-tasks/bulk` sends `{ updates: [{ id, kanban_order, status }] }`.
3. If the card was dropped in a different column, `status` changes too.
4. If the card was dropped in the **same column**, `arrayMove` from `@dnd-kit/sortable` reorders the array, and the `onReorder` callback fires with new order values.
5. These are **local-only** changes (not synced upstream).

### Optimistic Reorder Pattern

Same-column reorder uses an optimistic update:

```
User drops card within column
  → KanbanBoard.handleDragEnd() detects same containerId
    → arrayMove(items, oldIndex, newIndex)
    → Compute new kanban_order values
    → Fire onReorder([{ id, kanban_order }, ...])
  → TasksPage.handleReorder()
    1. setTasks() — immediately update UI (optimistic)
    2. LocalTasksModel.bulkUpdate() — persist to local DB
    3. On error: loadTasks() — revert from DB state
```

### View Toggle

`tasksViewMode` in `localStorage` persists the user's choice between `"list"` and `"kanban"` views.

---

## 8. Invoice Staging Workflow

Three-stage lifecycle managed entirely locally until final processing:

```
┌─────────┐     POST /invoice/stage     ┌──────────┐    POST /invoice/process    ┌──────────┐
│ Unbilled │ ──────────────────────────→ │  Staged  │ ─────────────────────────→ │ Invoiced │
│  (0)     │ ←────────────────────────── │   (2)    │                             │   (1)    │
└─────────┘  POST /invoice/unstage/:id  └──────────┘                             └──────────┘
             POST /invoice/clear
```

| State | `task_billed` | Description |
|-------|---------------|-------------|
| Unbilled | 0 | Default. Task has not been billed. |
| Staged | 2 | Locally marked for invoicing. Appears in staging panel. |
| Invoiced | 1 | Synced to external portal and confirmed billed. |

**Process flow:**
1. User selects unbilled tasks → `POST /invoice/stage` sets `task_billed = 2`
2. User reviews staged tasks in the invoice panel → `GET /invoice/staged`
3. User can unstage individual tasks → `POST /invoice/unstage/:id`
4. User can clear all staging → `POST /invoice/clear`
5. User submits → `POST /invoice/process { apiUrl }`:
   - Resolves task source from `apiUrl`
   - Calls external `POST /api/tasks-api/invoice-tasks` with external IDs
   - On success, updates `task_billed = 1` locally

---

## 9. Notification Pattern

The proxy router sends **fire-and-forget** notifications on successful task updates:

```typescript
if (result.status >= 200 && result.status < 300) {
  if (task?.assigned_to) {
    sendTaskAssignmentNotification(task, req.userId).catch(err => {
      console.error('[Task Assignment] Notification failed:', err);
    });
  }
  if (task?.workflow_phase && task?.assigned_to) {
    sendTaskPhaseChangeNotification(task, req.userId).catch(err => {
      console.error('[Task Phase Change] Notification failed:', err);
    });
  }
}
```

**Rules:**
- Notifications are **async** — they don't block the HTTP response.
- Self-assignment and self-phase-change are **suppressed** (no self-notification).
- Uses `createNotificationWithPush()` from Firebase service (in-app + push).
- Only triggers on `PUT /` (task update), not on create or delete.

---

## 10. Route Registration Order

Both routers use careful ordering to prevent wildcard `/:id` routes from shadowing named routes.

### Proxy Router (`softawareTasks.ts`)

Specific routes registered **before** wildcards:
1. `POST /authenticate` — before `/:id` variants
2. `POST /reorder` — before `/:id`
3. `GET /pending-approval` — before `/:id`
4. `GET /stats` — before `/:id`
5. `POST /sync`, `/invoice-tasks`, `/bill` — before `/:id`
6. `PUT /time`, `GET /statement` — before `/:id`
7. `GET /orders/latest`, `/orders/budgets`, `/orders/:orderNumber/budget` — before `/:id`
8. `POST /:id/comments/with-attachment` — before `/:id/comments`
9. `DELETE /comments/:commentId` — before `/:id`
10. `POST /comments/:commentId/convert-to-task` — before `/:id`
11. `GET /attachments/:filename` — before `/:id`
12. **`GET /:id`** — **LAST** (wildcard catch-all)

### Local Router (`localTasks.ts`)

1. `/sources/*` routes — all before `/:id`
2. `/sync/*` routes — before `/:id`
3. `PATCH /bulk` — before `/:id`
4. `GET /tags` — before `/:id`
5. `/invoice/*` routes — before `/:id`
6. `GET /` — list endpoint
7. **`GET /:id`** — after list
8. `PUT /:id`, `DELETE /:id` — after get
9. `PATCH /:id/*` enhancement routes — last

---

## 11. Frontend Data Flow

### Hook Architecture

```
TasksPage.tsx
  ├── useTasks(softwareId)         ← main task list (reads from /api/local-tasks)
  │     └── fetchTasks() → GET /api/local-tasks?software_id=X&page=1
  │     └── normalise() → Task interface with local enhancement fields
  ├── useLocalTasks()              ← source management, sync, enhancements
  │     └── LocalTasksModel.ts    ← API client for /api/local-tasks/*
  └── useSoftware()                ← software product list (for selector)
```

### Data Normalisation in `useTasks`

The hook maps `local_tasks` database columns to the `Task` interface:

```typescript
const normalise = (t: any): Task => ({
  id: t.external_id || t.id,
  title: t.title || '',
  status: t.status === 'progress' ? 'in-progress' : t.status,
  // ... maps all fields
  _local_id: t.id,
  _source_id: t.source_id,
  _source_name: t.source_name,
  _local_dirty: t.local_dirty,
  _last_synced_at: t.last_synced_at,
});
```

Key points:
- `id` is set to `external_id` (not local DB `id`) so the proxy router can use it.
- `_local_id` preserves the local DB primary key for enhancement endpoints.
- Status is normalised again as a safety net.

---

## 12. Migration Pattern

Migrations use a sequential numbering scheme (`021_`, `022_`):

```
021_local_tasks.ts → Creates 3 tables: task_sources, local_tasks, task_sync_log
022_task_enhancements.ts → ALTERs local_tasks: adds 7 enhancement columns + indexes
```

Each migration exports an `up()` function that executes raw SQL via `db.execute()`. The migration runner tracks applied migrations to prevent re-runs.

---

## 13. Font Size System

### Architecture

`TaskCard` defines 6 inline-style maps keyed by `TaskFontSize` (`'sm' | 'md' | 'lg'`):

```typescript
type TaskFontSize = 'sm' | 'md' | 'lg';

const FS_TITLE: Record<TaskFontSize, React.CSSProperties> = {
  sm: { fontSize: 13, lineHeight: '18px' },
  md: { fontSize: 16, lineHeight: '22px' },
  lg: { fontSize: 20, lineHeight: '28px' },
};

// Similarly: FS_META, FS_BADGE, FS_DESC, FS_ACTION, FS_PAD
```

### Prop Threading

```
TasksPage (taskFontSize state, persisted in localStorage.tasksFontSize)
  → TaskToolbar (onFontSizeChange callback, S/M/L toggle buttons)
  → KanbanBoard (fontSize prop)
    → KanbanColumn (fontSize prop)
      → SortableCard (fontSize prop)
        → TaskCard (fontSize prop → FS_*[fs] inline styles)
  → TaskCard (list variant, directly receives fontSize prop)
```

### Why Inline Styles?

Tailwind utility classes like `text-sm` can't be dynamically composed at runtime. The FS_* maps provide predictable, type-safe scaling without runtime class name generation or safelist bloat.

---

## 14. Image Gallery Lightbox (v2.3.0)

### Problem

Clicking a task image opened a simple full-screen overlay showing only the clicked image. To view other images from the same task, users had to close the overlay and click each image individually. There was no way to browse images in sequence.

### Solution: TaskImageLightbox Component

New standalone `TaskImageLightbox` component (181 LOC) provides a navigable gallery with prev/next navigation, thumbnail strip, zoom/pan, and keyboard shortcuts.

### Image Collection Strategy

Images are collected differently depending on context:

**TaskDetailPanel (single-task view):**
```
allImages = useMemo(() => {
  const imgs: LightboxImage[] = [];
  // 1. Task-level attachments (from loaded attachments state)
  attachments.filter(isImage).forEach(att => imgs.push({ url, name }));
  // 2. Comment-level attachments (from loaded comments state)
  comments.forEach(c => c.attachments?.filter(isImage)
    .forEach(att => imgs.push({ url, name })));
  return imgs;
}, [attachments, comments]);
```

All image-bearing elements (description inline `<img>`, attachment grid thumbnails, comment inline images, comment attachment thumbnails) call `openGallery(clickedUrl)` which finds the index in `allImages` and opens the lightbox at that position. Fallback: if URL not found in `allImages`, opens a single-image gallery.

**TaskCard (list/kanban view):**
```
TaskAttachmentsInline
  → Computes imageList from fetched attachments (filtered by image ext / MIME)
  → handleImageClick checks for onGalleryOpen callback
  → If present: onGalleryOpen(imageList, clickedIndex)  ← gallery mode
  → If absent: onImageClick(url)                        ← single-image fallback
```

### Prop Threading Pattern

The `onGalleryOpen` callback must traverse the full component hierarchy:

```
TasksPage (state: cardGalleryImages, cardGalleryIndex)
  │
  ├── Kanban view:
  │   KanbanBoard (KanbanBoardProps.onGalleryOpen)
  │     → KanbanColumn (CardActionProps.onGalleryOpen)
  │       → SortableCard (CardActionProps.onGalleryOpen)
  │         → TaskCard (TaskCardProps.onGalleryOpen)
  │           → TaskAttachmentsInline (onGalleryOpen prop)
  │
  └── List view:
      TaskCard (TaskCardProps.onGalleryOpen)
        → TaskAttachmentsInline (onGalleryOpen prop)
```

At each level, `onGalleryOpen` is added to the interface, destructured, and passed down. The callback signature is:
```typescript
onGalleryOpen?: (images: { url: string; name?: string }[], index: number) => void
```

### Zoom/Pan Implementation

- Zoom state: `zoom` (1–5), controlled via mouse wheel (±0.25), keyboard (±0.5), double-click toggle (1× ↔ 2×)
- Pan state: `position { x, y }` offset, only active when `zoom > 1`
- Pan input: `mousedown` → `mousemove` → `mouseup` events with `dragStart` reference point
- CSS: `transform: translate(${x}px, ${y}px) scale(${zoom})` on the `<img>` element
- On image change: zoom resets to 1×, position resets to origin

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Escape | Close lightbox |
| ArrowLeft | Previous image |
| ArrowRight | Next image |
| + / = | Zoom in (+0.5, max 5×) |
| - | Zoom out (-0.5, min 1×, auto-reset position at 1×) |

Registered via `useEffect` → `document.addEventListener('keydown')`, cleaned up on unmount.

---

## 15. Sync Status Toggle

### Flow

```
User clicks SignalIcon in toolbar
  ├── If currently ENABLED → Disable flow:
  │     → SweetAlert2 dialog with:
  │       • Reason dropdown (Performance, Testing, Maintenance, Data Issues, Other)
  │       • Detail textarea
  │     → POST /api/local-tasks/sync/disable { reason, reason_detail, software_name, user_id, user_name }
  │       → Backend: UPDATE task_sources SET sync_enabled = 0
  │       → Backend: INSERT INTO cases (creates support case with CASE-{uuid} number)
  │     → Toast: "Sync disabled. Case CASE-XXXXX opened."
  │     → Icon changes to SignalSlashIcon (red)
  └── If currently DISABLED → Enable flow:
        → POST /api/local-tasks/sync/enable
          → Backend: UPDATE task_sources SET sync_enabled = 1
        → Toast: "Sync re-enabled"
        → Icon changes to SignalIcon (green)
```

### Why Case Creation?

Disabling sync is a significant operational decision. The case ensures there's an audit trail and a reminder to re-enable. The case includes the reason, user context, and which software product was affected.

---

## 16. Stats Bar — unbilledTasks Pattern

### Problem

The stats bar was receiving `tasks` (all tasks including billed), but billed tasks are hidden from the default view. This created confusing count denominators (e.g., "96 / 175 tasks" when only 96 are visible).

### Solution

```typescript
const unbilledTasks = useMemo(
  () => tasks.filter(t => t.task_billed !== 1 && t.task_billed !== 2),
  [tasks]
);
```

`unbilledTasks` is passed to:
1. **TaskStatsBar** — counts New/Active/Completed/Pending from this filtered set
2. **Count denominator** — "X / {unbilledTasks.length} tasks" matches what the user sees

The `end_date` field was previously used for "Overdue" calculation but it represents a **scheduling time block**, not a deadline. This metric was removed entirely.

---

## 17. Legacy Patterns — ⚠️ Deprecated (v2.2.0)

The following legacy patterns were informally unused since v2.0 and have been **officially deprecated** as of v2.2.0.

### `softwareAuth.ts` (32 LOC) — ⚠️ DEPRECATED

The old `softwareAuth` middleware for verifying `X-Software-Token` headers. Superseded by source-level API keys in `task_sources`. Functions still exist for backward compatibility but are marked deprecated.

### `localStorage` tokens — ⚠️ DEPRECATED

The `software_token_{id}` localStorage pattern is no longer set or read by the Tasks module. Any existing tokens from v1.x are ignored — all auth now flows through `task_sources.api_key`.

### `/authenticate` endpoint — ⚠️ DEPRECATED

Retained as a no-op stub that always returns `{ success: true, token: null }`. Safe to call but serves no purpose.

### `staff_software_tokens` table — ⚠️ DEPRECATED

The database table created by migration `012_staff_sandbox_prompts.ts` is no longer used by any active feature. The table, its CRUD endpoints in `myAssistant.ts` and `staffAssistant.ts`, and all related code have been marked deprecated.

---

## 18. AI Assistant Tool Dispatch Pattern (v2.2.0)

The Staff AI Assistant can manage tasks via 22 tool handlers. This pattern mirrors the HTTP dual-path architecture but operates through tool dispatch rather than HTTP routes.

### Architecture

```
User speaks / types to AI Assistant
  → Assistant identifies intent (e.g., "create a bug-fix task")
  → Selects tool: exec_task_create
  → mobileActionExecutor.ts dispatches to exec_task_create(params, context)
    → resolveTaskSourceForTools(softwareId)
      → SELECT api_key, base_url FROM task_sources WHERE software_id = ?
      → Returns { baseUrl, apiKey, sourceId }
    → taskProxyV2(baseUrl, '/api/tasks-api', 'POST', apiKey, taskBody)
      → External PHP Tasks API
    → Returns { success: true, data: {...} }
  → Assistant formats response for user
```

### Dual-Path in Tool Context

| Path | Tools | Mechanism |
|------|-------|-----------|
| Write | 16 tools (create, update, delete, start, complete, approve, reorder, comments, attachments, associations, time, invoice, bill) | `taskProxyV2()` → external API with `X-API-Key` |
| Read | 6 tools (list, get, comments, attachments, stats, associations) | Direct MySQL query on `local_tasks` or proxied GET |

### Key Differences from HTTP Routes

| Aspect | HTTP Routes | AI Assistant Tools |
|--------|-------------|--------------------|
| Entry point | Express router middleware | `mobileActionExecutor.ts` function dispatch |
| Source resolution | `resolveTaskSource(req)` (reads `software_id` from query/body) | `resolveTaskSourceForTools(softwareId)` (direct parameter) |
| Proxy function | `proxyToExternal()` | `taskProxyV2()` (identical logic, separate instance) |
| Auth | `requireAuth` middleware (no-op) | Role checked in tool dispatch layer |
| Notifications | `sendTaskAssignmentNotification()` on PUT | Not triggered (assistant context) |

### Why Separate Functions?

`resolveTaskSourceForTools()` and `taskProxyV2()` are separate from `resolveTaskSource()` and `proxyToExternal()` because:
1. The HTTP versions depend on Express `Request` objects; the tool versions take plain parameters
2. The tool versions live in `mobileActionExecutor.ts` (shared module), not in route files
3. Keeping them separate avoids circular imports between route and service layers

---

## 19. Testing Pattern (v2.2.0)

### Framework

**vitest** is used for unit testing, configured via `vitest.config.ts`.

### Test Structure

```
tests/task-tools.test.ts
  ├── describe('Write-path tools') ─ 48 tests
  │     ├── Each exec_task_* write function tested for:
  │     │   • Successful execution with valid params
  │     │   • Correct proxy URL construction
  │     │   • Correct HTTP method used
  │     │   • Error handling for missing source
  │     └── Coverage: all 16 write tools
  ├── describe('Read-path tools') ─ 18 tests
  │     ├── Each exec_task_* read function tested for:
  │     │   • Correct data retrieval
  │     │   • Pagination handling
  │     │   • Empty result sets
  │     └── Coverage: all 6 read tools
  ├── describe('Role guards') ─ 8 tests
  │     └── Permission enforcement for admin-only and staff-only tools
  └── describe('Edge cases') ─ 6 tests
        └── Missing params, invalid IDs, empty results
```

### Running Tests

```bash
npm test          # runs vitest
npx vitest        # direct invocation
npx vitest --ui   # browser-based test UI
```

All 80 tests pass in ~1.2 seconds.
