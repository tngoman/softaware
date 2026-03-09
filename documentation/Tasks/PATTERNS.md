# Tasks Module — Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-03

---

## 1. Overview

This document catalogs the architecture patterns found in the Tasks module, covering the proxy architecture, dual-token authentication, per-software token management, lazy-loaded drawing integration, and the two-step comment-with-attachment flow.

---

## 2. Architectural Patterns

### 2.1 Transparent Proxy Pattern

**Context:** Tasks, comments, and attachments live on external software product APIs — not in the local database. The backend must forward all requests while adding internal JWT authentication and translating the software token header.

**Implementation:**

```typescript
// softawareTasks.ts — core proxy function

async function proxyToExternal(
  apiUrl: string,
  path: string,
  method: string,
  softwareToken: string | null,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `${apiUrl.replace(/\/+$/, '')}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (softwareToken) {
    headers['Authorization'] = `Bearer ${softwareToken}`;
  }

  const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  // Auto-detect response format
  const contentType = resp.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await resp.json() : await resp.text();

  return { status: resp.status, data };
}
```

Each route handler follows the same pattern:

```typescript
softawareTasksRouter.get('/', requireAuth, async (req, res) => {
  try {
    const apiUrl = getApiUrl(req);       // 1. Extract target URL
    const token = getSoftwareToken(req); // 2. Extract software token
    // ... extract additional params
    const result = await proxyToExternal(apiUrl, '/api/tasks', 'GET', token);
    res.status(result.status).json(result.data);  // 3. Forward response
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
```

**Benefits:**
- ✅ Zero local storage — no data synchronization issues
- ✅ Single proxy function handles all HTTP methods
- ✅ Response format auto-detection (JSON vs text)
- ✅ Internal JWT validated before any external call
- ✅ External API errors are transparently forwarded with original status codes
- ✅ No Zod schemas needed — validation delegated to external API

**Drawbacks:**
- ❌ Every task operation requires two HTTP hops (frontend → backend → external)
- ❌ No offline capability — external API must be reachable
- ❌ No server-side caching — repeated list calls hit external API every time
- ❌ No input validation — malformed requests reach external API before being rejected
- ❌ Error messages may leak external API internals to frontend

---

### 2.2 Dual-Token Authentication Pattern

**Context:** Two separate authentication systems must be satisfied on every request: (1) the internal platform JWT to access the backend, and (2) the per-software external token to access the external API. These tokens have different lifecycles, storage mechanisms, and validation paths.

**Implementation (Frontend):**

```typescript
// api.ts — Axios interceptor adds internal JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// softwareAuth.ts — per-request external token
export function softwareAuthHeaders(softwareId: number | null): Record<string, string> {
  const token = getSoftwareToken(softwareId);
  return token ? { 'X-Software-Token': token } : {};
}

// TasksPage.tsx — combining both
await api.get('/softaware/tasks', {
  params: { apiUrl },
  headers: softwareAuthHeaders(selectedSoftware?.id),
  // Result: Authorization: Bearer {jwt} + X-Software-Token: {sw_token}
});
```

**Implementation (Backend):**

```typescript
// auth.ts middleware — validates internal JWT
export function requireAuth(req, _res, next) {
  const auth = req.header('authorization');
  const token = auth.slice('bearer '.length);
  const decoded = jwt.verify(token, env.JWT_SECRET);
  (req as AuthRequest).auth = { userId: decoded.userId };
  return next();
}

// softawareTasks.ts — extracts external token
function getSoftwareToken(req: Request): string | null {
  return (req.headers['x-software-token'] as string) || null;
}

// proxyToExternal — forwards to external API
if (softwareToken) {
  headers['Authorization'] = `Bearer ${softwareToken}`;
}
```

**Token Lifecycle:**

```
Internal JWT:                         External Software Token:
  Created: /auth/login                  Created: /api/softaware/tasks/authenticate
  Stored:  localStorage.jwt_token       Stored:  localStorage.software_token_{id}
  Sent as: Authorization header         Sent as: X-Software-Token header
  Expires: Per JWT config               Expires: Per external API config
  Cleared: On 401 response              Cleared: Never (until manual removal)
```

**Benefits:**
- ✅ Internal auth protects all proxy endpoints — external APIs never exposed without JWT
- ✅ External tokens isolated per software — no cross-contamination
- ✅ Clean separation of concerns — Axios interceptor handles JWT, explicit headers handle SW token
- ✅ Backend never stores external tokens — stateless proxy

**Drawbacks:**
- ❌ External tokens never expire in localStorage — no refresh mechanism
- ❌ 401 from external API not distinguished from 401 on internal JWT
- ❌ No mechanism to detect and handle external token expiration
- ❌ `X-Software-Token` is a custom header — not a standard auth mechanism

---

### 2.3 Per-Software Token Isolation Pattern

**Context:** Previously, one global `software_token` was shared across all software products. Switching software meant the wrong token was used. The solution isolates tokens by software ID in localStorage.

**Implementation:**

```typescript
// softwareAuth.ts — localStorage-based token store

// Key pattern: software_token_{softwareId}
export function getSoftwareToken(softwareId: number | null): string {
  if (!softwareId) return '';
  return localStorage.getItem(`software_token_${softwareId}`) || '';
}

export function setSoftwareToken(softwareId: number, token: string): void {
  localStorage.setItem(`software_token_${softwareId}`, token);
}

export function hasSoftwareToken(softwareId: number | null): boolean {
  if (!softwareId) return false;
  return !!localStorage.getItem(`software_token_${softwareId}`);
}

export function softwareAuthHeaders(softwareId: number | null): Record<string, string> {
  const token = getSoftwareToken(softwareId);
  return token ? { 'X-Software-Token': token } : {};
}
```

**Frontend integration — auth state as computed value:**

```typescript
// TasksPage.tsx
const [authVersion, setAuthVersion] = useState(0);

const isAuthenticated = useMemo(() =>
  selectedSoftware ? hasSoftwareToken(selectedSoftware.id) : false,
  [selectedSoftware, authVersion]  // authVersion forces re-compute
);

// After successful auth:
setSoftwareToken(selectedSoftware.id, data.token);
setAuthVersion(v => v + 1);  // triggers useMemo recalculation
```

**Benefits:**
- ✅ Each software product has independent auth state
- ✅ Switching software selector uses the correct token instantly
- ✅ No cross-contamination between software environments
- ✅ `authVersion` counter triggers React re-render when token changes
- ✅ Software dropdown shows ✓ checkmark for authenticated products

**Drawbacks:**
- ❌ Tokens accumulate in localStorage — no cleanup on software deletion
- ❌ No token refresh/expiration detection
- ❌ `authVersion` is a workaround for localStorage not being reactive

---

### 2.4 Lazy-Loaded Drawing Editor Pattern

**Context:** The Excalidraw package is large (~2MB). Loading it on every TasksPage render would significantly impact initial page load. Instead, it's loaded only when the user opens the drawing editor.

**Implementation:**

```typescript
// ExcalidrawDrawer.tsx — lazy load on first open

const [Excalidraw, setExcalidraw] = useState<any>(null);
const [exportUtils, setExportUtils] = useState<any>(null);
const loadedRef = useRef(false);

React.useEffect(() => {
  if (!open || loadedRef.current) return;  // Only load once, only when opened
  loadedRef.current = true;

  Promise.all([
    import('@excalidraw/excalidraw'),       // Dynamic import
    import('@excalidraw/excalidraw'),       // Same module (for export utils)
  ]).then(([mod, utilsMod]) => {
    setExcalidraw(() => mod.Excalidraw);            // Store component
    setExportUtils(() => ({ exportToBlob: utilsMod.exportToBlob }));  // Store utility
  });
}, [open]);

// Render: either loading placeholder or full canvas
return (
  <div className="fixed inset-0 z-[60] flex flex-col bg-white">
    {Excalidraw ? (
      <Excalidraw ref={(api) => { excalidrawApiRef.current = api; }} />
    ) : (
      <div>Loading drawing editor…</div>
    )}
  </div>
);
```

**Export pipeline:**

```typescript
// ExcalidrawDrawer.tsx — handleSave()

// 1. Get scene data from Excalidraw API
const elements = api.getSceneElements();
const appState = api.getAppState();
const files = api.getFiles();

// 2. Export canvas to PNG blob
const blob = await exportUtils.exportToBlob({
  elements,
  appState: { ...appState, exportWithDarkMode: false, exportBackground: true },
  files,
  mimeType: 'image/png',
  quality: 0.95,
});

// 3. Convert blob → base64 data URL
const imageBase64 = await new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

// 4. Serialize scene for future re-opening
const sceneJson = JSON.stringify({ elements, appState: { viewBackgroundColor, gridSize }, files });

// 5. Generate timestamped filename
const fileName = `drawing-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;

// 6. Deliver to parent
await onSave({ imageBase64, sceneJson, fileName });
```

**Benefits:**
- ✅ Zero bundle impact on initial TasksPage load — Excalidraw loaded only on demand
- ✅ `loadedRef` ensures the heavy import happens only once per session
- ✅ Full-screen overlay (z-60) doesn't interfere with task detail dialog (z-50)
- ✅ Scene JSON preserved — enables future "re-open drawing" feature
- ✅ PNG + base64 format compatible with both HTML display and file upload

**Drawbacks:**
- ❌ First draw action has ~2-3s loading delay while package downloads
- ❌ No loading progress indicator (just "Loading drawing editor…" text)
- ❌ `any` types used throughout — no TypeScript safety for Excalidraw API
- ❌ `loadedRef` means component never reloads if initial import fails

---

### 2.5 Two-Step Comment-with-Attachment Pattern

**Context:** The external API requires file attachments to be linked to an existing comment via `comment_id`. This means: (1) create the comment first, (2) extract the `comment_id` from the response, (3) upload the file with that `comment_id`. The backend handles both steps in a single endpoint to keep the frontend simple.

**Implementation (Backend):**

```typescript
// softawareTasks.ts — POST /:id/comments/with-attachment

// Step 1 — Create the comment
const commentBody = {
  content: content || '',
  is_internal: is_internal ?? 1,    // Default: internal
  time_spent: 0,
  parent_comment_id: null,
};
const commentResult = await proxyToExternal(
  apiUrl, `/api/tasks/${id}/comments`, 'POST', token, commentBody
);

// Step 2 — Extract comment_id (handle multiple response shapes)
const commentData = commentResult.data;
const commentId = commentData?.comment_id
  || commentData?.data?.comment_id
  || commentData?.data?.id
  || commentData?.id;

if (!commentId) {
  // Graceful fallback: comment created but attachment can't be linked
  return res.status(commentResult.status).json({
    ...commentData,
    attachment_skipped: true,
    message: 'Comment created but attachment could not be linked (no comment_id returned)',
  });
}

// Step 3 — Convert base64 → binary
const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
const fileBuffer = Buffer.from(base64Data, 'base64');

// Step 4 — Upload as multipart/form-data
const formData = new FormData();
const blob = new Blob([fileBuffer], { type: 'image/png' });
formData.append('file', blob, safeName);
formData.append('comment_id', String(commentId));

const uploadResp = await fetch(uploadUrl, {
  method: 'POST',
  headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  body: formData,
});
```

**Implementation (Frontend):**

```typescript
// TaskDetailsDialog — handleDrawingSave()

const htmlContent = `<p><strong>📐 Drawing:</strong> ${payload.fileName}</p>`
  + `<img src="${payload.imageBase64}" alt="${payload.fileName}" style="max-width:100%;border-radius:8px;" />`;

await api.post(`/softaware/tasks/${task.id}/comments/with-attachment`, {
  apiUrl,
  content: htmlContent,         // HTML with embedded image
  is_internal: 1,               // Internal comment
  imageBase64: payload.imageBase64,  // Raw base64 for file upload
  fileName: payload.fileName,   // Timestamped filename
}, { headers: softwareAuthHeaders(softwareId) });
```

**Benefits:**
- ✅ Frontend makes a single API call — backend handles the two-step dance
- ✅ Graceful fallback if `comment_id` not extractable — comment still created
- ✅ Uses native Node.js `FormData` (Node 18+) — no external dependencies
- ✅ Multiple response shape handlers (`commentData.comment_id || .data.comment_id || ...`)
- ✅ HTML content includes embedded image as a fallback (renders even without attachment)

**Drawbacks:**
- ❌ If Step 2 (upload) fails, the comment is already created — no rollback
- ❌ Base64 image sent in JSON body — large payloads (~1-5MB) for detailed drawings
- ❌ No size limit on `imageBase64` — could cause 413 if Express body parser limit is low
- ❌ `Content-Type` for FormData upload is NOT explicitly set — relies on `fetch()` to auto-set boundary

---

### 2.6 Inline Authentication UX Pattern

**Context:** Previously, users had to navigate to Software Management → open edit modal → authenticate. This was buried deep in the UI. The new pattern puts authentication directly on the TasksPage where it's needed.

**Implementation:**

```typescript
// TasksPage.tsx — conditional rendering

{!isAuthenticated ? (
  // Auth Required panel — replaces task list area
  <div className="bg-white rounded-lg shadow-sm border p-8">
    <div className="max-w-md mx-auto text-center space-y-4">
      <ShieldExclamationIcon className="h-12 w-12 text-amber-400 mx-auto" />
      <h3>Authentication Required</h3>
      <p>Authenticate with <strong>{selectedSoftware.name}</strong> to access tasks.</p>

      {authMessage && <div className={authStatus === 'error' ? 'bg-red-50' : 'bg-blue-50'}>
        {authMessage}
      </div>}

      {authStatus === 'otp' ? (
        // OTP input panel
        <div>
          <input value={authOtp} maxLength={6} className="tracking-widest" />
          <p>Enter the code sent to your phone</p>
          <button onClick={() => handleAuthenticate(true)}>Verify OTP</button>
        </div>
      ) : (
        // Initial auth button
        <button onClick={() => handleAuthenticate(false)}>
          <ShieldCheckIcon /> Authenticate
        </button>
      )}
    </div>
  </div>
) : (
  // Normal task list
  <TaskList ... />
)}
```

**State machine:**

```
                  ┌──────┐
        ┌────────│ idle │◄──────── success (token received)
        │        └──┬───┘
        │           │ click "Authenticate"
        │           ▼
        │     POST /authenticate
        │        │
        │        ├── token → setSoftwareToken() → idle + loadTasks
        │        ├── requires_otp → otp state
        │        └── error → error state
        │
        │        ┌──────┐
        ├────────│ otp  │
        │        └──┬───┘
        │           │ click "Verify OTP"
        │           ▼
        │     POST /authenticate (with otp + otpToken)
        │        │
        │        ├── token → setSoftwareToken() → idle + loadTasks
        │        └── error → error state
        │
        │        ┌───────┐
        └────────│ error │ → shows red error panel
                 └───────┘   user can retry
```

**Benefits:**
- ✅ Auth happens where it's needed — on the tasks page, not in a separate settings area
- ✅ OTP flow is seamless — no page navigation between password and OTP steps
- ✅ Visual feedback with color-coded messages (red for error, blue for info)
- ✅ Auth state persists in localStorage — no re-auth needed on page reload
- ✅ `authVersion` counter ensures React re-renders when auth state changes

**Drawbacks:**
- ❌ Credentials are stored in the `update_software` table — no user input for username/password
- ❌ If external credentials are wrong, user must fix them in Software Management
- ❌ No "Logout" / "Switch account" mechanism for external APIs
- ❌ OTP timeout not handled — if user is too slow, they must restart

---

### 2.7 Response Unwrapping Pattern

**Context:** Different external APIs return data in different shapes. The frontend must handle multiple response structures without breaking.

**Implementation:**

```typescript
// useTasks.ts — task list unwrapping
const body = res.data;
const taskData = body?.data?.data || body?.data || body || [];
const items = Array.isArray(taskData) ? taskData : [];

// TaskDetailsDialog — comment list unwrapping
const list = res.data?.data || res.data?.comments || [];
setComments(Array.isArray(list) ? list : []);

// Two-step comment — comment_id extraction
const commentId = commentData?.comment_id
  || commentData?.data?.comment_id
  || commentData?.data?.id
  || commentData?.id;
```

**Supported Shapes:**

| Response Shape | Unwrap Path |
|---------------|-------------|
| `{ data: { data: Task[] } }` | `body.data.data` |
| `{ data: Task[] }` | `body.data` |
| `Task[]` | `body` (direct array) |
| `{ data: Comment[] }` | `res.data.data` |
| `{ comments: Comment[] }` | `res.data.comments` |
| `{ comment_id: N }` | `data.comment_id` |
| `{ data: { comment_id: N } }` | `data.data.comment_id` |
| `{ data: { id: N } }` | `data.data.id` |
| `{ id: N }` | `data.id` |

**Benefits:**
- ✅ Resilient to external API response format changes
- ✅ Handles nested pagination wrappers
- ✅ Falls back to empty array — never crashes on unexpected shapes
- ✅ `Array.isArray()` guard prevents non-array data from breaking `.map()`

**Drawbacks:**
- ❌ Fragile chain of `||` operators — could mask real API errors
- ❌ No TypeScript safety — all responses typed as `any`
- ❌ Difficult to debug when an API changes response format

---

### 2.8 Filtered Software Dropdown Pattern

**Context:** Not all software products should appear in the Tasks dropdown. Only those with complete external integration configuration (API URL + credentials) are valid task sources.

**Implementation:**

```typescript
// TasksPage.tsx — filtered software list (useMemo)

const taskSoftware = useMemo(() =>
  softwareList.filter(sw =>
    sw.has_external_integration &&        // Flag enabled
    sw.external_username &&               // Username configured
    sw.external_password &&               // Password configured
    (sw.external_live_url || sw.external_test_url)  // At least one URL
  ),
  [softwareList]
);

// Dropdown rendering with auth indicator
{taskSoftware.map(sw => (
  <option key={sw.id} value={sw.id.toString()}>
    {sw.name}{hasSoftwareToken(sw.id) ? ' ✓' : ''}
  </option>
))}

// Empty state handling
{taskSoftware.length === 0 && (
  <p>No software with external integration configured.
     Set up integration in Software Management.</p>
)}
```

**Benefits:**
- ✅ Prevents users from selecting non-functional software
- ✅ ✓ checkmark shows auth status at a glance
- ✅ Helpful empty state directs users to the right place
- ✅ `useMemo` avoids recalculating on every render

**Drawbacks:**
- ❌ Filter runs on frontend — API returns all software regardless
- ❌ Password is falsy-checked (`!!sw.external_password`) — could be `"false"` string

---

## 3. Anti-Patterns & Technical Debt

### 3.1 🟡 No Comment Interface Type

**Location:** TasksPage.tsx, useTasks.ts

**Impact:** Comments typed as `any[]` throughout — no compile-time safety for comment field access (`c.user_name`, `c.comment_id`, `c.attachments`, etc.).

**Recommended Fix:** Define a `Comment` interface in `types/index.ts`:
```typescript
export interface Comment {
  comment_id: number;
  content: string;
  user_name?: string;
  is_internal: number;
  time_spent?: string;
  created_at?: string;
  attachments?: Attachment[];
}
```

---

### 3.2 🟡 Large Single-File Component

**Location:** TasksPage.tsx (1,008 LOC)

**Impact:** Three components (`TasksPage`, `TaskDialog`, `TaskDetailsDialog`) defined in one file. Difficult to navigate, test, and maintain.

**Recommended Fix:** Extract each embedded component into its own file:
- `components/tasks/TaskDialog.tsx`
- `components/tasks/TaskDetailsDialog.tsx`
- `pages/TasksPage.tsx` (main only)

---

### 3.3 🟡 No External Token Expiration Handling

**Location:** softwareAuth.ts, TasksPage.tsx

**Impact:** If an external API token expires, task requests will fail with 401 but the user won't be prompted to re-authenticate. The expired token stays in localStorage.

**Recommended Fix:** Intercept 401 responses on task requests and clear the software token, forcing re-authentication:
```typescript
if (err.response?.status === 401) {
  removeSoftwareToken(softwareId);
  setAuthVersion(v => v + 1);
}
```

---

### 3.4 🟡 Base64 Image in JSON Body

**Location:** TaskDetailsDialog → `handleDrawingSave()`, softawareTasks.ts `with-attachment` route

**Impact:** Drawing images are sent as base64 strings inside JSON. A moderately detailed drawing can be 2-5MB base64, risking 413 "Payload Too Large" errors if Express body parser limit is low.

**Recommended Fix:** Use multipart/form-data from the frontend instead of JSON with embedded base64. Or increase Express JSON body limit for this endpoint.

---

### 3.5 🟢 No Server-Side Input Validation

**Location:** softawareTasks.ts — all proxy endpoints

**Impact:** No Zod schemas on any proxy route. Malformed requests pass through to the external API, which may return cryptic errors.

**Recommended Fix:** Add lightweight Zod validation for required fields (`apiUrl`, `task.task_name`, etc.) before proxying.

---

### 3.6 🟢 Credentials Stored in Software Record

**Location:** `update_software` table (external_username, external_password columns)

**Impact:** External API credentials stored alongside other software metadata. Password is sent to frontend via `GET /softaware/software`.

**Recommended Fix:** Store external credentials separately with encryption. Exclude password from GET responses — backend should read it directly from DB when authenticating.

---

## 4. Z-Index Layering

```
z-40   ── Main layout / navigation
z-50   ── TaskDialog, TaskDetailsDialog (modal overlays)
z-60   ── ExcalidrawDrawer (full-screen drawing editor)
z-70   ── Image lightbox (expanded image viewer)
```

All overlays use `fixed inset-0` positioning with click-to-close on the backdrop.
