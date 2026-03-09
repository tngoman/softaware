# Tasks Module — File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-03

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 5 source files |
| **Total LOC** | ~1,565 |
| **Backend route files** | 1 (285 LOC) |
| **Frontend page files** | 1 (1,008 LOC) |
| **Frontend hook files** | 1 (72 LOC) |
| **Frontend component files** | 1 (168 LOC) |
| **Frontend utility files** | 1 (32 LOC) |

### Directory Tree

```
Backend:
  src/routes/softawareTasks.ts              (285 LOC)  ⭐ proxy router + auth + attachment upload

Frontend:
  src/pages/TasksPage.tsx                  (1,008 LOC)  ⭐ main page + 3 embedded components
  src/hooks/useTasks.ts                       (72 LOC)
  src/components/ExcalidrawDrawer.tsx         (168 LOC)  ⭐ NEW — Excalidraw integration
  src/utils/softwareAuth.ts                   (32 LOC)  ⭐ NEW — per-software token management

Related files (not part of this module, but used by it):
  src/hooks/useSoftware.ts                    (40 LOC)  — fetches software list
  src/hooks/useModules.ts                     (45 LOC)  — fetches modules per software
  src/services/api.ts                         (75 LOC)  — Axios client with JWT interceptor
  src/types/index.ts                           (~30 LOC relevant: Software + Task interfaces)
```

---

## 2. Backend Files

### 2.1 `src/routes/softawareTasks.ts` — Proxy Router

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/softawareTasks.ts` |
| **LOC** | 285 |
| **Purpose** | Proxy all task, comment, and auth requests to external software APIs. Includes two-step comment-with-attachment upload for Excalidraw drawings. |
| **Dependencies** | express, middleware/auth (requireAuth) |
| **Exports** | `softawareTasksRouter` |
| **Mount Point** | `/api/softaware/tasks` (via `apiRouter.use()` in index.ts) |

#### Helper Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `proxyToExternal(apiUrl, path, method, softwareToken, body?)` | `string, string, string, string\|null, any?` | `Promise<{ status, data }>` | Core proxy function — builds URL, sets headers, forwards body, returns parsed response |
| `getSoftwareToken(req)` | `Request` | `string \| null` | Extracts `X-Software-Token` header from incoming request |
| `getApiUrl(req)` | `Request` | `string` | Extracts `apiUrl` from query or body; throws if missing |

#### proxyToExternal Implementation

```typescript
async function proxyToExternal(
  apiUrl: string,
  path: string,
  method: string,
  softwareToken: string | null,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `${apiUrl.replace(/\/+$/, '')}${path}`;
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (softwareToken) headers['Authorization'] = `Bearer ${softwareToken}`;
  // ... fetch with method, headers, JSON body
  // ... parse response (JSON if content-type matches, else text)
  return { status, data };
}
```

#### Endpoints

| Method | Path | Auth | Line | Description |
|--------|------|------|------|-------------|
| GET | `/` | requireAuth | L79 | List tasks (paginated) |
| POST | `/` | requireAuth | L95 | Create task |
| PUT | `/` | requireAuth | L108 | Update task |
| DELETE | `/:id` | requireAuth | L121 | Delete task |
| POST | `/reorder` | requireAuth | L134 | Reorder tasks |
| GET | `/:id/comments` | requireAuth | L147 | List comments |
| POST | `/:id/comments/with-attachment` | requireAuth | L160 | Two-step: create comment + upload image |
| POST | `/:id/comments` | requireAuth | L243 | Post comment (text) |
| POST | `/authenticate` | requireAuth | L263 | Auth against external API |

#### Route Order Note

`/:id/comments/with-attachment` is registered **before** `/:id/comments` (POST) to prevent Express from matching the parameterized route first. This is documented with an inline comment: `// NOTE: Must be registered BEFORE /:id/comments to avoid being shadowed`.

#### Attachment Upload Detail

The `with-attachment` endpoint uses **native Node.js FormData** (Node 18+):

```typescript
const formData = new FormData();
const blob = new Blob([fileBuffer], { type: 'image/png' });
formData.append('file', blob, safeName);
formData.append('comment_id', String(commentId));

const uploadUrl = `${apiUrl}/api/attachments/development/${id}`;
await fetch(uploadUrl, { method: 'POST', headers, body: formData });
```

---

## 3. Frontend Files

### 3.1 `src/pages/TasksPage.tsx` — Main Tasks Page

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/TasksPage.tsx` |
| **LOC** | 1,008 |
| **Purpose** | Full task management page with embedded dialogs, inline authentication, filtering, drawing integration |
| **Dependencies** | react, @heroicons/react, react-hot-toast, sweetalert2, api, useSoftware, useTasks, useModules, useAppStore, softwareAuth, ExcalidrawDrawer |
| **Exports** | `default` (TasksPage component) |
| **Route** | `/tasks` (wrapped in `<ProtectedRoute><Layout>`) |

#### Embedded Components (defined in same file)

| Component | Props | LOC | Description |
|-----------|-------|-----|-------------|
| `TaskDialog` | open, onClose, task, apiUrl, softwareId, onSaved | ~100 | Modal form for create/edit. Fields: name, description, notes, status, type, hours, created by. Auto-sets `approval_required` if estimated > 8h. |
| `TaskDetailsDialog` | open, onClose, task, apiUrl, softwareId, onEdit | ~200 | View-only dialog with metadata grid, description, approval badge, comments list, comment input, Excalidraw "Draw" button, image lightbox. |
| `TasksPage` | — | ~500 | Main page with software selector, filters, task cards, auth flow. |

#### Utility Functions (top of file)

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `timeToDecimal(t)` | `string \| number` | `number` | Converts `"HH:MM:SS"` or decimal string to decimal hours |
| `relativeDate(d)` | `string \| null` | `string` | Converts ISO date to "Just now", "5m ago", "3d ago", etc. |

#### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `STATUS_COLORS` | `Record<string, string>` | Maps task status to Tailwind CSS classes (bg + text + border) |
| `STATUS_DOT` | `Record<string, string>` | Maps task status to dot color class |
| `PHASE_LABELS` | `Record<string, string>` | Maps `workflow_phase` keys to display labels |

#### TaskDialog — State & Logic

| State | Type | Purpose |
|-------|------|---------|
| `loading` | boolean | Submit button loading state |
| `form` | object | Form fields: task_name, task_description, task_notes, task_status, task_type, task_hours, task_estimated_hours, task_color, software_id, module_id, assigned_to, task_created_by_name |

- On open: pre-populates from `task` prop (edit) or empty defaults (create)
- On submit: builds `taskData` object, calls `api.post` or `api.put` with `softwareAuthHeaders(softwareId)`
- Auto-sets `task_approval_required: 1` when `estimated_hours > 8`

#### TaskDetailsDialog — State & Logic

| State | Type | Purpose |
|-------|------|---------|
| `comments` | any[] | Fetched comment list |
| `loadingComments` | boolean | Comments loading state |
| `newComment` | string | Comment input value |
| `submitting` | boolean | Comment post loading state |
| `drawingOpen` | boolean | ExcalidrawDrawer visibility |
| `expandedImage` | string \| null | Lightbox image URL (null = hidden) |

Key functions:
- `handlePostComment()` — posts text comment, re-fetches comment list
- `refetchComments()` — helper to re-load comments (used after drawing save)
- `handleDrawingSave(payload)` — receives Excalidraw export, posts to `/comments/with-attachment`

#### TasksPage — State & Logic

| State | Type | Purpose |
|-------|------|---------|
| `selectedSoftware` | Software \| null | Currently selected software |
| `viewMode` | 'list' \| 'grid' | View mode (persisted in localStorage) |
| `search` | string | Free-text search filter |
| `statusFilter` | string | Status filter (default: 'new') |
| `typeFilter` | string | Type filter (default: 'all') |
| `phaseFilter` | string | Phase filter (default: role-based) |
| `moduleFilter` | string | Module filter (default: 'all') |
| `taskDialogOpen` | boolean | Create/edit dialog visibility |
| `detailsOpen` | boolean | Details dialog visibility |
| `editingTask` | Task \| null | Task being edited |
| `viewingTask` | Task \| null | Task being viewed |
| `authLoading` | boolean | Authentication in progress |
| `authStatus` | 'idle' \| 'otp' \| 'error' | Authentication flow state |
| `authMessage` | string | Auth feedback message |
| `authOtp` | string | OTP input value |
| `authOtpToken` | string \| null | OTP session token |
| `authOtpUserId` | number \| null | User ID for OTP flow |
| `authVersion` | number | Incremented to trigger re-render on auth |
| `isAuthenticated` | boolean (memo) | `hasSoftwareToken(selectedSoftware.id)` |

Key functions:
- `handleAuthenticate(useOtp)` — full auth flow with OTP support
- `handleSoftwareChange(e)` — select software, persist to localStorage
- `handleStatusChange(task, newStatus)` — quick status toggle (Start/Complete)
- `handleDelete(task)` — SweetAlert2 confirmation → API delete
- `handleReorder(task, direction)` — swap adjacent task positions

Computed values:
- `taskSoftware` — filtered list of software with external integration configured
- `filteredTasks` — tasks matching all active filters + search
- `totalHours` — sum of unbilled hours across filtered tasks
- `apiUrl` — derived from selected software's mode (live vs test URL)

#### Render Structure

```
<TasksPage>
  ├── Header Card
  │   ├── Title + Subtitle
  │   ├── Software Selector (filtered to integration-enabled)
  │   ├── View Toggle (list/grid)
  │   ├── "New Task" button
  │   ├── "Refresh" button
  │   ├── Filter Row (search, status, type, phase, module)
  │   └── Stats Bar (count + unbilled hours)
  │
  ├── Content (conditional rendering):
  │   ├── Loading spinner (tasks loading + no data)
  │   ├── Empty: "Select a software product" (no selection)
  │   ├── Auth Required panel (selected but not authenticated)
  │   │   ├── Shield icon + message
  │   │   ├── Error/info message
  │   │   ├── OTP input (if authStatus === 'otp')
  │   │   └── "Authenticate" / "Verify OTP" button
  │   ├── Empty: "No tasks found" + "Create First Task" button
  │   └── Task Cards (list or grid layout)
  │       └── Each card:
  │           ├── Title + date + creator + hours
  │           ├── Approval badge (if required)
  │           ├── Status badge
  │           ├── Workflow phase bar (if present)
  │           └── Action buttons: ↑ ↓ | View Edit Start/Complete Delete
  │
  ├── <TaskDialog />
  └── <TaskDetailsDialog />
      ├── Header: title, status, type, phase, "Draw" button, "Edit" button
      ├── Metadata grid: created, creator, hours, assigned, module
      ├── Description (HTML)
      ├── Approval banner
      ├── Comments section
      │   ├── Comment list (scrollable, max-h-400px)
      │   │   └── Each: user, date, time_spent, internal badge, HTML content, attachments
      │   └── Input row: text input + paperclip (draw) + Post button
      ├── <ExcalidrawDrawer /> (portal, z-60)
      └── Image lightbox (z-70)
```

---

### 3.2 `src/hooks/useTasks.ts` — Task Fetching Hook

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/hooks/useTasks.ts` |
| **LOC** | 72 |
| **Purpose** | Hook for loading tasks from external API via backend proxy with auto-pagination |
| **Dependencies** | react (useState, useCallback, useRef), api, types/Task, utils/softwareAuth |
| **Exports** | `useTasks` (named) |

#### Interface

```typescript
interface UseTasksOptions {
  apiUrl?: string | null;
  softwareId?: number | null;
  autoLoad?: boolean;    // currently unused but reserved
}
```

#### Hook Return

| Property | Type | Description |
|----------|------|-------------|
| `tasks` | Task[] | Current task list |
| `loading` | boolean | Loading state |
| `error` | string \| null | Error message |
| `loadTasks` | (silent?: boolean) => Promise<void> | Fetch function (silent=true skips loading state) |
| `setTasks` | React.Dispatch | Direct setter (for optimistic updates) |

#### loadTasks Behavior

1. Calls `GET /softaware/tasks?apiUrl={url}&page={N}&limit=1000` with per-software auth headers
2. Unwraps response: `body.data.data || body.data || body`
3. Auto-paginates: follows `pagination.has_next` until false (max 50 pages)
4. Normalizes statuses: `"progress"` → `"in-progress"`
5. Stores result in `prevTasksRef` (for future comparison) and `tasks` state

#### Dependencies

The `loadTasks` callback depends on `[apiUrl, softwareId]` — it recreates when either changes.

---

### 3.3 `src/components/ExcalidrawDrawer.tsx` — Drawing Editor

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/ExcalidrawDrawer.tsx` |
| **LOC** | 168 |
| **Purpose** | Full-screen Excalidraw overlay for creating drawings that are saved as task comments with attachments |
| **Dependencies** | react, @heroicons/react, @excalidraw/excalidraw (lazy-loaded) |
| **Exports** | `default` (ExcalidrawDrawer component) |

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | boolean | ✅ | Controls visibility |
| `onClose` | () => void | ✅ | Close handler |
| `onSave` | (payload) => Promise<void> \| void | ✅ | Called with drawing artifacts |
| `initialData` | any | ❌ | Excalidraw scene data (for re-opening) |
| `taskTitle` | string | ❌ | Displayed in header toolbar |

#### Save Payload

```typescript
{
  imageBase64: string;   // data:image/png;base64,...
  sceneJson: string;     // JSON.stringify({ elements, appState, files })
  fileName: string;      // "drawing-{ISO-timestamp}.png"
}
```

#### Behavior

| Phase | Action |
|-------|--------|
| **Closed** | Returns `null` — nothing rendered |
| **First open** | Lazy-loads `@excalidraw/excalidraw` via dynamic `import()` |
| **Loading** | Shows "Loading drawing editor…" centered text |
| **Ready** | Full-screen `<Excalidraw>` canvas with custom toolbar |
| **Save** | `exportToBlob()` → FileReader → base64 + scene JSON → `onSave(payload)` |

#### Lazy Loading Strategy

```typescript
React.useEffect(() => {
  if (!open || loadedRef.current) return;
  loadedRef.current = true;
  Promise.all([
    import('@excalidraw/excalidraw'),
    import('@excalidraw/excalidraw'),
  ]).then(([mod, utilsMod]) => {
    setExcalidraw(() => mod.Excalidraw);
    setExportUtils(() => ({ exportToBlob: utilsMod.exportToBlob }));
  });
}, [open]);
```

The package is loaded only once (guarded by `loadedRef`). The `Excalidraw` component and `exportToBlob` utility are stored in state.

#### UI Options

```typescript
UIOptions={{
  canvasActions: {
    saveToActiveFile: false,   // hide native save
    loadScene: false,          // hide native load
    export: false,             // hide native export (we use our own)
  },
}}
```

#### Export Configuration

```typescript
exportToBlob({
  elements,
  appState: { ...appState, exportWithDarkMode: false, exportBackground: true },
  files,
  mimeType: 'image/png',
  quality: 0.95,
});
```

---

### 3.4 `src/utils/softwareAuth.ts` — Per-Software Token Manager

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/utils/softwareAuth.ts` |
| **LOC** | 32 |
| **Purpose** | Manages per-software external API tokens in localStorage |
| **Dependencies** | None |
| **Exports** | `getSoftwareToken`, `setSoftwareToken`, `removeSoftwareToken`, `hasSoftwareToken`, `softwareAuthHeaders` |

#### localStorage Key Pattern

```
software_token_{softwareId}
```

Example: `software_token_2` → `"eyJhbGciOiJIUzI1NiIs..."`

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `getSoftwareToken(id)` | `number \| undefined \| null` | `string` | Returns token or empty string |
| `setSoftwareToken(id, token)` | `number, string` | `void` | Stores token in localStorage |
| `removeSoftwareToken(id)` | `number` | `void` | Removes token from localStorage |
| `hasSoftwareToken(id)` | `number \| undefined \| null` | `boolean` | Returns true if token exists and is non-empty |
| `softwareAuthHeaders(id)` | `number \| undefined \| null` | `Record<string, string>` | Returns `{ 'X-Software-Token': token }` or `{}` |

#### Usage Pattern

```typescript
// In useTasks.ts — loading tasks
const res = await api.get('/softaware/tasks', {
  params: { apiUrl, page, limit: 1000 },
  headers: softwareAuthHeaders(softwareId),  // { 'X-Software-Token': '...' }
});

// In TasksPage.tsx — checking auth state
const isAuthenticated = hasSoftwareToken(selectedSoftware.id);

// In TasksPage.tsx — after successful auth
setSoftwareToken(selectedSoftware.id, data.token);
setAuthVersion(v => v + 1);  // trigger re-render
```

---

## 4. Related Files (Shared)

### 4.1 `src/types/index.ts` — Type Definitions

#### Software Interface (used by software selector)

```typescript
export interface Software {
  id: number;
  name: string;
  software_key: string;
  description?: string;
  has_external_integration?: boolean | number;
  external_username?: string;
  external_password?: string;
  external_live_url?: string;
  external_test_url?: string;
  external_mode?: 'live' | 'development' | 'test';
  order_number?: number;
  created_by?: string;
  created_by_name?: string;
  latest_version?: string;
  latest_update_date?: string;
  total_updates?: number;
}
```

#### Task Interface

```typescript
export interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: 'new' | 'in-progress' | 'completed' | 'progress' | 'pending';
  type: 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support';
  hours: string;
  estimatedHours?: string;
  created_at?: string;
  start?: string;
  due_date?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  creator?: string;
  created_by_name?: string;
  workflow_phase?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  module_id?: number | null;
  module_name?: string | null;
  software_id?: number | null;
  task_bill_date?: string | null;
  task_billed?: number;
  approval_required?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  task_order?: number | null;
  parent_task_id?: number | null;
  association_type?: string | null;
  date?: string;
}
```

**Note:** There is no `Comment` interface — comments are typed as `any[]` throughout the codebase.

### 4.2 `src/hooks/useSoftware.ts` — Software List Hook

- Calls `GET /softaware/software` via the shared Axios instance
- Returns `{ software: Software[], isLoading: boolean }`
- Used by TasksPage to populate the software dropdown

### 4.3 `src/hooks/useModules.ts` — Modules Hook

- Calls `GET /softaware/modules?software_id={id}` when softwareId changes
- Returns `{ modules: Module[] }`
- Used by TasksPage for the module filter dropdown

### 4.4 `src/services/api.ts` — Axios Client

- Base URL from `REACT_APP_API_URL` environment variable
- Request interceptor: attaches `Authorization: Bearer {jwt_token}` from localStorage
- Response interceptor: on 401 (non-login), clears tokens and redirects to `/login`
