# SoftAwareCode — Web Application Developer Specification

> **Purpose:** This document is the single source of truth for a developer rebuilding SoftAwareCode as a web application. It covers every page, every UI component, every interaction, all data models, all API integrations, and the role-based access system. Follow this specification exactly.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Design System & Global Styles](#3-design-system--global-styles)
4. [Authentication & Auth Context](#4-authentication--auth-context)
5. [App Shell Layout](#5-app-shell-layout)
   - 5.1 NavRail (Left Sidebar)
   - 5.2 Header (Top Bar)
   - 5.3 ChatListPanel
   - 5.4 RightPanel
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Page: Login](#7-page-login)
8. [Page: Dashboard](#8-page-dashboard)
9. [Page: Tasks](#9-page-tasks)
10. [Page: Software Management](#10-page-software-management)
11. [Page: Updates Management](#11-page-updates-management)
12. [Page: Clients](#12-page-clients)
13. [Page: Users](#13-page-users)
14. [Page: Groups (Chat)](#14-page-groups-chat)
15. [Page: AI Sessions (Chat)](#15-page-ai-sessions-chat)
16. [Page: Extensions](#16-page-extensions)
17. [Page: Publishing](#17-page-publishing)
18. [Page: Database Manager](#18-page-database-manager)
19. [Page: Settings](#19-page-settings)
20. [Shared Dialogs & Components](#20-shared-dialogs--components)
21. [Data Types Reference](#21-data-types-reference)
22. [API Endpoint Reference](#22-api-endpoint-reference)
23. [Notification & Polling System](#23-notification--polling-system)
24. [UI Component Library Reference](#24-ui-component-library-reference)

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Component Library | shadcn/ui (Radix UI primitives) |
| Icons | Hugeicons (`@hugeicons/react`, `@hugeicons/core-free-icons`) + Lucide React |
| Fonts | Geist Sans (variable: `--font-geist-sans`), Geist Mono (variable: `--font-geist-mono`) |
| Theme | next-themes (light/dark, stored in localStorage) |
| Real-time | Socket.io client (`socket.io-client`) |
| Rich Text | Tiptap or similar rich text editor |
| Date helpers | `date-fns` |
| HTTP | Native `fetch`, custom `authFetch` wrapper |
| State | React `useState`, `useContext`, custom hooks |
| Routing | Next.js App Router |
| Auth | Cookie/localStorage JWT token, `AuthContext` |

> **No Electron-specific code** should exist in the web version. Remove all `window.electronAPI` references. Replace Electron IPC calls (`database:connect`, `database:query`, etc.) with REST API calls to the backend.

---

## 2. Project Structure

```
src/
  app/
    layout.tsx              ← Root layout with providers
    page.tsx                ← Redirects to /softaware/dashboard
    globals.css
    login/
      page.tsx
    softaware/
      dashboard/page.tsx
      tasks/page.tsx
      software/page.tsx
      updates/page.tsx
      settings/page.tsx
    clients/page.tsx
    users/page.tsx
    groups/page.tsx
    chat/
      page.tsx              ← New session
      [id]/page.tsx         ← Session detail
    extensions/page.tsx
    publishing/page.tsx
    database/
      page.tsx
      components/
        ConnectionDialog.tsx
        ConnectionSidebar.tsx
        QueryEditor.tsx
        TableExplorer.tsx
    api/                    ← Next.js API routes (proxy to PHP backend)
  components/
    layout/
      AppShell.tsx
      NavRail.tsx
      Header.tsx
      ChatListPanel.tsx
      RightPanel.tsx
      LayoutWrapper.tsx
      ThemeProvider.tsx
      UserProfileDialog.tsx
      TaskNotificationPoller.tsx
      HeartbeatProvider.tsx
      ConnectionStatus.tsx
      UpdateDialog.tsx
      ImportSessionDialog.tsx
    chat/
      ChatView.tsx
      MessageList.tsx
      MessageItem.tsx
      MessageInput.tsx
      CodeBlock.tsx
      StreamingMessage.tsx
      ToolCallBlock.tsx
      FileCard.tsx
      ImageThumbnail.tsx
      ImageLightbox.tsx
      FileAttachmentDisplay.tsx
      FolderPicker.tsx
    softaware/
      software/
        SoftwareCard.tsx
        SoftwareDialog.tsx
        ModulesTab.tsx
        AuthenticateDialog.tsx
      tasks/
        TaskCard.tsx
        TaskDialog.tsx
        TaskDetailsDialog.tsx
        WorkflowDialog.tsx
        TaskHoursModal.tsx
        TaskAttachmentsInline.tsx
        TaskAIChat.tsx
      updates/
        UpdateDialog.tsx
    project/
      FileTree.tsx
      FilePreview.tsx
      TaskCard.tsx
      TaskList.tsx
    settings/
      ProviderManager.tsx
      ProviderForm.tsx
    ai-elements/
      artifact.tsx / chain-of-thought.tsx / code-block.tsx
      confirmation.tsx / conversation.tsx / file-tree.tsx
      message.tsx / model-selector.tsx / prompt-input.tsx
      reasoning.tsx / shimmer.tsx / sources.tsx
      suggestion.tsx / task.tsx / terminal.tsx
      tool-actions-group.tsx / tool.tsx
    ui/
      ← All shadcn/ui components (see Section 24)
  contexts/
    AuthContext.tsx
  hooks/
    useClients.ts
    useModules.ts
    usePanel.ts
    useSoftware.ts
    useTasks.ts
    useUpdate.ts
    useUpdates.ts
    useUsers.ts
    use-toast.ts
  lib/
    api-client.ts           ← authFetch helper
    groups-socket.ts        ← Socket.io factory
    permissions.ts          ← Role/phase permission helpers
    utils.ts                ← cn() and other utilities
  types/
    index.ts
    task.ts
    client.ts
    user.ts
    database.ts
    legacy.ts               ← UserRole type
    update.ts
```

---

## 3. Design System & Global Styles

### 3.1 Color Tokens (CSS Variables)

The app uses a CSS variable-based token system supporting both light and dark modes. Core tokens:

```css
--background         /* Main page background */
--foreground         /* Main text */
--card               /* Card surface */
--card-foreground
--border             /* Borders (use border/50 for subtle borders) */
--muted              /* Muted backgrounds */
--muted-foreground   /* Muted text */
--primary            /* Primary action color */
--primary-foreground
--destructive        /* Danger/delete color */
--destructive-foreground
--sidebar            /* NavRail background */
--sidebar-foreground
--sidebar-accent     /* Active nav item background */
--sidebar-accent-foreground
```

### 3.2 Typography

- **Body font:** Geist Sans (`font-sans`)
- **Monospace font:** Geist Mono (`font-mono`)
- Apply `antialiased` to `<body>`

### 3.3 Spacing & Layout

- **NavRail collapsed width:** `w-14` (56px)
- **NavRail expanded width:** `w-48` (192px)
- **ChatListPanel width:** `w-60` (240px), hidden on `< lg` breakpoint
- **RightPanel width:** `w-72` (288px), hidden on `< lg` breakpoint
- **Header height:** `h-11` (44px)
- Page content fills remaining space with `flex-1 overflow-hidden`

### 3.4 Theming

- Wrap the entire app in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
- Theme persisted to localStorage
- Toggle button shows `Sun02Icon` in dark mode, `Moon02Icon` in light mode

---

## 4. Authentication & Auth Context

### 4.1 AuthContext

Provide `AuthContext` wrapping the whole app. It exposes:

```typescript
interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isChecking: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;         // see Section 6
  is_admin: boolean;
}
```

**Behavior:**
- On mount, call `checkAuth()` which hits `GET /api/auth/me` to validate the stored token.
- Token stored in `localStorage` under key `auth_token` (web version — no Electron IPC).
- `user_data` stored in `localStorage` under key `user_data`.
- `isChecking` is `true` until the initial `checkAuth()` resolves.
- If not authenticated on a protected route, redirect to `/login`.
- On logout, clear both `auth_token` and `user_data` from localStorage, redirect to `/login`.

### 4.2 `authFetch` Helper

A wrapper around `fetch` that automatically injects the `Authorization: Bearer <token>` header on all requests:

```typescript
// src/lib/api-client.ts
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
```

### 4.3 Route Protection

Use Next.js `middleware.ts` to protect all routes except `/login`. Redirect unauthenticated requests to `/login`.

---

## 5. App Shell Layout

The `AppShell` component wraps every authenticated page. It provides a full-viewport flex layout:

```
┌────────────────────────────────────────────────────────────────┐
│  NavRail │ ChatListPanel (chat routes only) │  Main Content    │ RightPanel (chat detail only)
│  (56px   │     (240px, lg+)                 │  (flex-1)        │  (288px, lg+)
│   or     │                                  │  ┌──────────┐   │
│  192px   │                                  │  │ Header   │   │
│  expanded│                                  │  │  (44px)  │   │
│          │                                  │  ├──────────┤   │
│          │                                  │  │  <page>  │   │
│          │                                  │  └──────────┘   │
└──────────┴──────────────────────────────────┴─────────────────┴┘
```

**Breakpoint behavior:**
- ChatListPanel and RightPanel are only shown on `lg` (1024px+) screens.
- ChatListPanel auto-opens on lg+ screens when on a `/chat` route.
- RightPanel auto-opens when on `/chat/[id]` routes.

### 5.1 NavRail (Left Sidebar)

**Component:** `src/components/layout/NavRail.tsx`

**Appearance:**
- Background: `bg-sidebar`
- Collapsed (default): `w-14`, items centered
- Expanded: `w-48`, items left-aligned with text labels visible
- Expansion toggled by a menu button at the top; state persisted to `localStorage` under key `navExpanded`
- Smooth CSS transition on width: `transition-all`
- Bottom padding: `pb-3`, top padding: `pt-4`

**Top section:**
1. **Logo:** When expanded, show `<Image src="/logo.png" width={150} height={40} />`. When collapsed, show `<Image src="/icon.png" width={32} height={32} className="w-8 h-8" />`.
2. **Menu Toggle Button:** `variant="ghost"`, `size="icon"`. Uses `Menu01Icon` from Hugeicons. When expanded, also shows the text "Menu" with `ml-2`. Below this is a subtle horizontal divider `h-px w-6 bg-border/50`.

**Navigation Items (Main Section):**

Each item renders as a `<Button asChild variant="ghost" size="icon">` wrapping a `<Link>`. Active state: `bg-sidebar-accent text-sidebar-accent-foreground`. Active detection: exact match OR `pathname.startsWith(href + "?")`.

When expanded, each button is `w-full justify-start` and shows `<span className="ml-2">{label}</span>` after the icon.

Each button is wrapped in a `<Tooltip>` with `side="right"` showing the label (tooltip is always shown regardless of expanded state).

| Order | Label | Route | Icon (Hugeicons) |
|-------|-------|-------|-----------------|
| 1 | Dashboard | `/softaware/dashboard` | `BarChartIcon` |
| 2 | Tasks | `/softaware/tasks` | `ClipboardIcon` |
| 3 | Software | `/softaware/software` | `Folder01Icon` |
| 4 | Updates | `/softaware/updates` | `RefreshIcon` |
| 5 | Clients | `/clients` | `ComputerIcon` |
| 6 | Users | `/users` | `UserGroupIcon` |
| 7 | Groups | `/groups` | `MessageMultipleIcon` |
| 8 | Settings | `/softaware/settings` | `Settings02Icon` |

**DEVELOPMENT Section (below main nav):**

When expanded, render a small section label: `<div className="px-2 py-1 text-xs font-semibold text-muted-foreground">DEVELOPMENT</div>`.

| Label | Behavior | Icon |
|-------|----------|------|
| New Session | `<Link href="/chat">` | `PlusSignIcon` |
| AI Sessions | Toggles ChatListPanel open/closed. If not on a chat route, also navigates to `/chat`. Active when `pathname.startsWith("/chat")`. | `Message02Icon` |
| Extensions | `<Link href="/extensions">` | `GridIcon` |
| Publishing | `<Link href="/publishing">` | `Upload03Icon` |
| Database | `<Link href="/database">` | `Database01Icon` |

**Bottom Section (after `mt-auto`):**

1. **Skip-Permissions Indicator** (conditional): When the setting `dangerously_skip_permissions === "true"` is active (polled from `GET /api/settings/app` every 5 seconds), show an animated orange pulsing dot:
   ```jsx
   <span className="relative flex h-3 w-3">
     <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
     <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
   </span>
   ```
   Wrapped in a Tooltip: "Auto-approve is ON".

2. **Theme Toggle Button:** `h-8 w-8`, `variant="ghost"`, `size="icon"`. Shows `Sun02Icon` in dark mode, `Moon02Icon` in light mode. Tooltip: "Light mode" / "Dark mode".

3. **Logout Button:** `h-8 w-8`, `variant="ghost"`, `size="icon"`. Uses `Logout01Icon`. On click, call `logout()` then redirect to `/login`. Tooltip: "Logout".

---

### 5.2 Header (Top Bar)

**Component:** `src/components/layout/Header.tsx`

**Appearance:** `h-11`, `border-b border-border/50`, `bg-background`, `px-4`. Items aligned to the right (`ml-auto`).

**Contents (right side, left to right):**

1. **User Dropdown Menu** (shown only when `isAuthenticated && user`):
   - Trigger: `<Button variant="ghost" size="sm" className="h-7 gap-2 px-3">` with `User02Icon` and `<span className="hidden sm:inline">{user.username}</span>`
   - Dropdown content (`align="end"`, `w-56`):
     - **Label section:** `{user.full_name || user.username}` (bold), `{user.email}` (muted xs), `Role: {user.role}` (muted xs, separate label)
     - **Separator**
     - **"Edit Profile"** item with `UserEdit01Icon` — opens `UserProfileDialog`
     - **"Sign out"** item with `Logout01Icon` — calls `logout()`, redirects to `/login`

2. **Theme Toggle:** Same as NavRail bottom (h-7 w-7 version).

---

### 5.3 ChatListPanel

**Component:** `src/components/layout/ChatListPanel.tsx`

**Visibility:** Only rendered on `/chat` and `/chat/[id]` routes. Controlled by `chatListOpen` state in `AppShell`. Only visible on `lg+` screens (`hidden lg:flex`). Width: `w-60`.

**Structure (top to bottom):**
1. **Header row** (`h-12`, extra top padding for macOS-style traffic lights): "Chat" label (13px, font-semibold).
2. **Search input** (`px-3 py-2`): `h-8`, `pl-7`, placeholder "Search chats...", `Search01Icon` absolutely positioned left.
3. **"Import CLI Session" button**: `variant="ghost"`, `size="sm"`, `w-full justify-start`, `gap-2 h-7 text-xs`, with `FileImportIcon`. Opens `ImportSessionDialog` on click.
4. **Session list** (scrollable, `flex-1 min-h-0`):
   - Sessions grouped by date: "Today", "Yesterday", "Last 7 Days", "Older"
   - Each group has a tiny section label (11px, muted, all-caps, tracking-wider)
   - Sessions sorted newest first within each group
   - **Each session item:**
     - Link to `/chat/{session.id}`
     - Active state: `bg-sidebar-accent`
     - On hover, show a delete button (red `Delete02Icon`, `h-3.5 w-3.5`) on the right
     - Session title (truncated, 13px)
     - Time relative (`Xm ago`, `Xh ago`, `Xd ago`, exact date if > 7 days)
     - **Mode badge** (xs, pill): Code = `bg-blue-500/10 text-blue-500`, Plan = `bg-sky-500/10 text-sky-500`, Ask = `bg-green-500/10 text-green-500`
     - **Streaming indicator**: If this session is currently streaming (matches `streamingSessionId`), show an animated pulsing dot (blue)
     - **Pending approval indicator**: If this session has pending approval (matches `pendingApprovalSessionId`), show an orange pulsing dot with tooltip "Waiting for permission approval"
   - Empty state: "No conversations yet" or "No matching chats" (11px, muted/60)

**Data:** Fetched from `GET /api/chat/sessions`. Refreshed on:
- Mount
- Navigation changes (`usePathname`)
- `session-created` and `session-updated` custom events dispatched on `window`

**Deleting a session:** `DELETE /api/chat/sessions/{id}`. After deletion, if on that session's route, navigate to `/chat`.

---

### 5.4 RightPanel

**Component:** `src/components/layout/RightPanel.tsx`

**Visibility:** Only on `/chat/[id]` routes. Only on `lg+` screens. Width: `w-72`.

**When collapsed:** Shows only a small icon button to reopen (`StructureFolderIcon`), `variant="ghost"`, `size="icon-sm"`.

**When expanded:**
- **Header** (`h-10`, `px-4`): "CHAT INFO" label (11px, uppercase, muted). Close button (`PanelRightCloseIcon`).
- **Body** (scrollable, `p-4 space-y-4`):
  1. **Session Name Section:**
     - Label: "NAME" (11px, uppercase, muted)
     - Display mode: Shows session title (or "Session {first-8-chars}" if no title). On hover, a pencil edit icon (`PencilEdit01Icon`) appears (opacity-0 → opacity-100).
     - Edit mode: Inline `<Input>` with save button (`Tick01Icon`). Pressing Enter saves, Escape cancels. On save, `PATCH /api/chat/sessions/{id}` with `{ title }`.
  2. **Divider** (`h-px bg-border/50`)
  3. **Files Section:**
     - Label: "FILES" (11px, uppercase, muted)
     - Shows `FileTree` component for the working directory
     - Clicking a file switches to `FilePreview` component with a "← Back" button

---

### 5.5 LayoutWrapper

`LayoutWrapper` reads the current route and decides whether to render the `AppShell` (authenticated shell) or just `{children}` (for the `/login` route).

---

## 6. User Roles & Permissions

### 6.1 Role Definitions

| Role | Label | Description | Workflow Focus |
|------|-------|-------------|----------------|
| `super_admin` | Super Admin | Full access | All |
| `admin` | Admin | Full access | All |
| `developer` | Developer | Code development | Development phase |
| `client_manager` | Client Manager | Client intake | Intake phase |
| `qa_specialist` | QA Specialist | Quality review | Quality Review phase |
| `deployer` | Deployer | Deployment pipeline | All |
| `viewer` | Viewer | Read-only | All |

### 6.2 Task Workflow Phases

Tasks move through these phases in order:
```
intake → quality_review → development → verification → resolution
```

Phase-to-role mapping:
- `intake` → managed by `client_manager`
- `quality_review` → managed by `qa_specialist`
- `development` → managed by `developer`

### 6.3 Assignment Permission Rules

A user **can** assign a task if:
- Their role is `admin` or `super_admin`, OR
- The task's current `workflow_phase` maps to their role (e.g., a `client_manager` can assign a task in `intake`)

A user **cannot** assign backward (skip phases) unless they are admin.

**`canUserAssignTask(currentUser, task)`** — returns boolean.
**`getPermissionErrorMessage(currentUser, task)`** — returns human-readable string.
**`isBackwardAssignment(currentPhase, targetPhase)`** — returns boolean.

### 6.4 Dashboard Role Meta

Each role has a display color, icon, greeting text, and focus phase for the dashboard:

| Role | Color Class | Icon | Greeting | Focus Phase |
|------|-------------|------|----------|-------------|
| admin/super_admin | `bg-violet-500` | `ShieldCheck` | "Full system overview" | all |
| developer | `bg-blue-500` | `Code2` | "Your development queue" | development |
| client_manager | `bg-emerald-500` | `Users` | "Client intake pipeline" | intake |
| qa_specialist | `bg-amber-500` | `Bug` | "Quality review queue" | quality_review |
| deployer | `bg-cyan-500` | `Zap` | "Deployment pipeline" | all |
| viewer | `bg-gray-400` | `ListTodo` | "Task overview" | all |

---

## 7. Page: Login

**Route:** `/login`  
**File:** `src/app/login/page.tsx`  
**Access:** Public (no auth required)

### 7.1 Layout

Full-screen centered layout: `flex min-h-screen items-center justify-center bg-background p-4`.

### 7.2 Card

`w-full max-w-md` Card with:

**CardHeader (text-center):**
- `<Image src="/logo.png" alt="SoftAware" width={200} height={60} className="mx-auto" />` with `mb-4`
- `<CardTitle>Sign In</CardTitle>`
- `<CardDescription>Enter your credentials to access SoftAware</CardDescription>`

**CardContent:**

Form with `space-y-4`:
1. **Username field:**
   - `<Label htmlFor="username">Username</Label>`
   - `<Input id="username" type="text" placeholder="Enter your username" autoComplete="username" required />`

2. **Password field:**
   - `<Label htmlFor="password">Password</Label>`
   - `<Input id="password" type="password" placeholder="Enter your password" autoComplete="current-password" required />`

3. **Error message** (conditional): `<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>`

4. **Submit button:** `type="submit"`, `className="w-full"`. Text: "Signing in..." when loading, "Sign In" otherwise.

### 7.3 Behavior

- On mount: if `isChecking`, show full-screen "Checking authentication..." message. Once `isAuthenticated`, redirect to `/softaware/dashboard`.
- On submit: call `login(username, password)`. On success, redirect to `/softaware/dashboard`. On failure, set error message.
- All inputs disabled while `isLoading`.

---

## 8. Page: Dashboard

**Route:** `/softaware/dashboard`  
**File:** `src/app/softaware/dashboard/page.tsx`

---

### 8.0 Data Wiring Overview

The dashboard is a **read-only analytics view**. It fetches data from two independent systems:

| Data | Source | Hook / Call | Auth Header |
|------|--------|-------------|-------------|
| Software list | SoftAware backend (`SOFTAWARE_API_URL`) | `useSoftware()` → `GET /api/softaware/software` | `X-Auth-Token: {auth_token}` |
| Tasks | External software API (per-software URL) | `useTasks({ apiUrl })` → `GET /api/softaware/tasks?apiUrl=...` | `X-Software-Token: {software_token}` |
| Modules | SoftAware backend | `useModules(softwareId)` → `GET /api/softaware/modules?software_id={id}` | `X-Auth-Token: {auth_token}` |

> **Two separate token systems exist:**
> - `auth_token` — the SoftAware app token stored in `localStorage.auth_token`. Used by `authFetch()` and sent as `X-Auth-Token`.
> - `software_token` — a per-software external API token stored in `localStorage.software_token`. Sent as `X-Software-Token` when calling `/api/softaware/tasks`.

---

### 8.1 State

Declare the following state in `DashboardPage`:

```typescript
const { user } = useAuth();                               // current logged-in user
const { software: softwareList, isLoading: softwareLoading } = useSoftware();
const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
const [authDialogOpen, setAuthDialogOpen] = useState(false);
const [viewingBug, setViewingBug] = useState<Task | null>(null);
const [viewingRoleTask, setViewingRoleTask] = useState<Task | null>(null);

// Derived from selectedSoftware — use live or test URL based on external_mode field
const apiUrl = selectedSoftware?.external_mode === 'live'
  ? selectedSoftware?.external_live_url
  : selectedSoftware?.external_test_url;

const { tasks, loading, error, loadTasks } = useTasks({ apiUrl, autoLoad: false });
const { modules } = useModules(selectedSoftware?.id);
```

---

### 8.2 Software Selector Wiring

**On mount** — restore previously selected software from localStorage:

```typescript
useEffect(() => {
  const saved = localStorage.getItem('selectedTasksSoftware');
  if (saved) {
    try { setSelectedSoftware(JSON.parse(saved)); } catch { /* ignore */ }
  } else if (!softwareLoading && softwareList.length > 0) {
    // Auto-select first software if nothing was saved
    const first = softwareList[0];
    setSelectedSoftware(first);
    localStorage.setItem('selectedTasksSoftware', JSON.stringify(first));
  }
}, [softwareLoading, softwareList]);
```

**On software change** (user picks from `<Select>`):

```typescript
const handleSoftwareChange = (id: string) => {
  const sw = softwareList.find(s => String(s.id) === id);
  if (sw) {
    setSelectedSoftware(sw);
    localStorage.setItem('selectedTasksSoftware', JSON.stringify(sw));
  }
};
```

The `<Select>` component:
- `value={selectedSoftware?.id?.toString() || ''}`
- `onValueChange={handleSoftwareChange}`
- `disabled={softwareLoading}`
- Each `<SelectItem>` has `value={sw.id.toString()}` and text `{sw.name}`

---

### 8.3 Task Loading Wiring

Trigger task load whenever `apiUrl` changes (i.e. whenever a new software is selected):

```typescript
useEffect(() => {
  if (apiUrl) loadTasks();
}, [apiUrl, loadTasks]);
```

**`useTasks` hook** (`src/hooks/useTasks.ts`) handles all pagination internally:
- Calls `GET /api/softaware/tasks?apiUrl={encodedApiUrl}&page={n}&limit=1000` in a loop until `pagination.has_next === false`
- Sends `X-Software-Token` header (read from `localStorage.software_token` by the Next.js route handler — the frontend does not need to set this header manually; the API route reads it from a cookie or the client passes it via `authFetch`)
- Returns `{ tasks: Task[], loading: boolean, error: string | null, loadTasks: (silent?: boolean) => Promise<void> }`

> **Important:** The Next.js API route at `src/app/api/softaware/tasks/route.ts` reads the software token from the request header `X-Software-Token`. The `authFetch` utility must attach this from `localStorage.software_token` when calling task endpoints. Implement `authFetch` to attach both tokens:

```typescript
// src/lib/api-client.ts
export async function authFetch(url: string, options: RequestInit = {}) {
  const authToken = localStorage.getItem('auth_token') || '';
  const softwareToken = localStorage.getItem('software_token') || '';
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Auth-Token': authToken,
      'X-Software-Token': softwareToken,
    },
  });
}
```

---

### 8.4 Authentication Error Handling

```typescript
useEffect(() => {
  if (error && (
    error.toLowerCase().includes('not authenticated') ||
    error.toLowerCase().includes('401')
  )) {
    setAuthDialogOpen(true);
  }
}, [error]);

const handleAuthSuccess = () => {
  setAuthDialogOpen(false);
  // Wait briefly for token to be written to localStorage, then reload
  setTimeout(() => loadTasks(), 500);
};
```

**Body states (mutually exclusive, rendered in order of priority):**

| Condition | Render |
|-----------|--------|
| `!selectedSoftware` | "Select a software" empty state (Package icon) |
| `error` contains `401` or `not authenticated` | Auth-required card with "Authenticate Now" button → opens `AuthenticateDialog` |
| `loading === true` | Centered spinner + "Loading tasks…" |
| Otherwise | Full dashboard widgets |

---

### 8.5 `AuthenticateDialog` Wiring

**Component:** `src/components/softaware/software/AuthenticateDialog.tsx`

Rendered at the bottom of the page (always in DOM when `selectedSoftware` is set):

```tsx
{selectedSoftware && (
  <AuthenticateDialog
    open={authDialogOpen}
    onClose={() => setAuthDialogOpen(false)}
    software={selectedSoftware}
    onSuccess={handleAuthSuccess}
  />
)}
```

**What the dialog does internally:**
1. POSTs to `POST /api/softaware/software/authenticate` with `{ apiUrl, username, password, otp?, otpToken? }`
2. The Next.js route POSTs to `{apiUrl}/api/auth_login` with `{ email, password, remember_me: false }`
3. On success, stores the returned `token` to `localStorage.software_token` (web) or Electron session store
4. Calls `onSuccess()` — the dashboard then calls `loadTasks()` which will now find the token

**OTP flow:** If backend returns `status === 'otp_required'`, the dialog shows an OTP input field. User submits the 6-digit OTP, dialog POSTs again with `{ apiUrl, username, password, otp, otpToken }` to the same endpoint which then calls `{apiUrl}/api/verify_otp`.

---

### 8.6 Derived Stats (`useMemo`)

All stats are computed in a single `useMemo` that re-runs when `tasks`, `user`, `roleMeta`, or `modules` change:

```typescript
const stats = useMemo(() => {
  // 1. Active tasks — exclude completed
  const activeTasks = tasks.filter(t => t.status !== 'completed');

  // 2. Role-to-phase mapping
  const PHASE_TO_ROLE: Record<string, string[]> = {
    intake:         ['client_manager', 'admin', 'super_admin'],
    quality_review: ['qa_specialist', 'admin', 'super_admin'],
    development:    ['developer', 'admin', 'super_admin'],
  };
  const userRole = user?.role?.toLowerCase() || 'viewer';

  // 3. roleTasks — active tasks in phases owned by current user's role
  const roleTasks = activeTasks.filter(t => {
    const phase = t.workflow_phase?.toLowerCase() || 'intake';
    const rolesForPhase = PHASE_TO_ROLE[phase];
    if (!rolesForPhase) return userRole === 'admin' || userRole === 'super_admin' || userRole === 'deployer';
    return rolesForPhase.includes(userRole);
  });
  // Sort newest first using created_at || start || date
  const roleTasksSorted = [...roleTasks].sort((a, b) =>
    new Date(b.created_at || b.start || b.date || 0).getTime() -
    new Date(a.created_at || a.start || a.date || 0).getTime()
  );

  // 4. phaseTasks — tasks in the role's focus phase
  //    roleMeta.focusPhase is one of: 'all' | 'intake' | 'quality_review' | 'development'
  const phaseTasks = roleMeta.focusPhase === 'all'
    ? activeTasks
    : activeTasks.filter(t => {
        const phase = t.workflow_phase?.toLowerCase();
        return phase === roleMeta.focusPhase || (!phase && roleMeta.focusPhase === 'intake');
      });

  // 5. byStatus counts (include ALL tasks, not just active)
  const byStatus: Record<string, number> = { new: 0, 'in-progress': 0, completed: 0, pending: 0 };
  tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

  // 6. byPhase counts (active tasks only)
  const byPhase: Record<string, number> = {};
  activeTasks.forEach(t => {
    const p = t.workflow_phase?.toLowerCase() || 'intake';
    byPhase[p] = (byPhase[p] || 0) + 1;
  });

  // 7. byModule counts (active tasks only)
  const byModule: Record<string, { id: number; count: number }> = {};
  activeTasks.forEach(t => {
    if (t.module_id) {
      const mod = modules.find(m => m.id === Number(t.module_id));
      const name = mod?.name || t.module_name || `Module #${t.module_id}`;
      if (!byModule[name]) byModule[name] = { id: Number(t.module_id), count: 0 };
      byModule[name].count++;
    }
  });

  // 8. totalHours — sum of hours for tasks NOT yet billed
  //    A task is considered billed if task_bill_date is non-null, non-'0', and length > 5
  const totalHours = tasks.reduce((sum, t) => {
    const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
    return billed ? sum : sum + timeToDecimal(t.hours || 0);
  }, 0);

  // 9. completedUnbilled — completed tasks not yet billed
  const completedUnbilled = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    const billed = (t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5)
                || Number(t.task_billed) === 1;
    return !billed;
  }).length;

  // 10. bugTasks — active bug-fix tasks, sorted newest first
  const bugTasks = activeTasks
    .filter(t => t.type === 'bug-fix')
    .sort((a, b) =>
      new Date(b.created_at || b.start || b.date || 0).getTime() -
      new Date(a.created_at || a.start || a.date || 0).getTime()
    );
  // Oldest bug = last item in the above array
  const oldestBug = bugTasks.length > 0 ? bugTasks[bugTasks.length - 1] : null;
  const oldestBugAge = oldestBug
    ? Math.floor((Date.now() - new Date(oldestBug.created_at || oldestBug.start || oldestBug.date || 0).getTime()) / 86400000)
    : 0;

  // 11. recent — 8 most recently created/modified tasks (any status)
  const recent = [...tasks]
    .sort((a, b) =>
      new Date(b.created_at || b.start || b.date || 0).getTime() -
      new Date(a.created_at || a.start || a.date || 0).getTime()
    )
    .slice(0, 8);

  return {
    total: tasks.length,
    activeCount: activeTasks.length,
    roleTasks: roleTasksSorted,
    roleCount: roleTasks.length,
    roleNew: roleTasks.filter(t => t.status === 'new').length,
    roleInProgress: roleTasks.filter(t => t.status === 'in-progress' || t.status === 'progress').length,
    completedUnbilled,
    phaseTasks,
    phaseCount: phaseTasks.length,
    byStatus,
    byPhase,
    byModule,
    bugTasks,
    oldestBug,
    oldestBugAge,
    totalHours,
    recent,
  };
}, [tasks, user, roleMeta, modules]);
```

**`timeToDecimal` helper** (convert `"HH:MM:SS"` or decimal string to float hours):

```typescript
function timeToDecimal(t: string | number): number {
  if (!t) return 0;
  const s = String(t).trim();
  if (!s.includes(':')) return parseFloat(s) || 0;
  const p = s.split(':');
  return (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60 + (p[2] ? (parseInt(p[2]) || 0) / 3600 : 0);
}
```

---

### 8.7 Role Metadata

Declare this constant **outside** the component (module-level):

```typescript
const ROLE_META: Record<string, {
  label: string;
  color: string;        // Tailwind bg class for the role icon circle
  icon: LucideIcon;
  greeting: string;
  focusPhase: 'all' | 'intake' | 'quality_review' | 'development';
}> = {
  admin:          { label: 'Admin',          color: 'bg-violet-500',  icon: ShieldCheck, greeting: 'Full system overview',    focusPhase: 'all' },
  super_admin:    { label: 'Super Admin',    color: 'bg-violet-500',  icon: ShieldCheck, greeting: 'Full system overview',    focusPhase: 'all' },
  developer:      { label: 'Developer',      color: 'bg-blue-500',    icon: Code2,       greeting: 'Your development queue',  focusPhase: 'development' },
  client_manager: { label: 'Client Manager', color: 'bg-emerald-500', icon: Users,       greeting: 'Client intake pipeline',  focusPhase: 'intake' },
  qa_specialist:  { label: 'QA Specialist',  color: 'bg-amber-500',   icon: Bug,         greeting: 'Quality review queue',    focusPhase: 'quality_review' },
  deployer:       { label: 'Deployer',       color: 'bg-cyan-500',    icon: Zap,         greeting: 'Deployment pipeline',     focusPhase: 'all' },
  viewer:         { label: 'Viewer',         color: 'bg-gray-400',    icon: ListTodo,    greeting: 'Task overview',           focusPhase: 'all' },
};

// Derive at the top of the component:
const role = (user?.role?.toLowerCase() || 'viewer');
const roleMeta = ROLE_META[role] || ROLE_META.viewer;
const RoleIcon = roleMeta.icon;
```

---

### 8.8 Header Bar

Fixed top section `border-b bg-card p-6`:

```
┌─────────────────────────────────────────────────────────────────┐
│  [RoleIcon circle]  Welcome, {firstName}                        │
│                     [Role Badge] · {greeting}      [Selector]  [Refresh] │
└─────────────────────────────────────────────────────────────────┘
```

- **Role icon circle:** `h-12 w-12 rounded-xl {roleMeta.color} text-white shadow-lg flex items-center justify-center`
- **Welcome text:** `text-2xl font-semibold` — `user?.full_name ? "Welcome, {firstName}" : "Dashboard"`
- **Role badge:** `<Badge variant="outline" className="text-xs">{roleMeta.label}</Badge>`
- **Greeting:** `text-sm text-muted-foreground` after `·`
- **Software selector:** `<Package className="h-4 w-4 text-muted-foreground" />` + `<Select>` wired per §8.2
- **Refresh button:** `variant="outline" size="sm"` — calls `loadTasks()` directly — disabled when `loading || !selectedSoftware`

---

### 8.9 KPI Cards Row

`grid grid-cols-2 gap-4 lg:grid-cols-4` — each card `<Card className="relative overflow-hidden p-5">`:

**Card 1 — Oldest Bug** (clickable → opens `TaskDetailsDialog` with `viewingBug`):
```
className={`cursor-pointer transition-colors hover:bg-accent ${!stats.oldestBug ? 'opacity-60' : ''}`}
onClick={() => stats.oldestBug && setViewingBug(stats.oldestBug)}
```
- Value: `stats.oldestBugAge` + `d` suffix (in muted color) — or `0` in `text-emerald-500` if no bugs
- Sub-label: truncated title of oldest bug — or "No active bugs 🎉"
- Icon badge: `bg-red-500/10` circle with `Bug className="h-5 w-5 text-red-500"`
- Background orb: `absolute -bottom-3 -right-3 h-20 w-20 rounded-full bg-red-500/5`

**Card 2 — Phase Queue:**
- Label: `roleMeta.focusPhase === 'all' ? 'All Tasks' : '{phase} queue'` (replace `_` with space)
- Value: `stats.phaseCount`
- Sub: `"of {stats.activeCount} active"`
- Icon badge: `bg-amber-500/10` + `ArrowRight text-amber-500`
- Orb: `bg-amber-500/5`

**Card 3 — Unbilled Hours:**
- Label: `"Unbilled Hours"`
- Value: `stats.totalHours.toFixed(1)` + `h` suffix (muted)
- Sub: `"across {stats.activeCount} active tasks"`
- Icon badge: `bg-emerald-500/10` + `Timer text-emerald-500`
- Orb: `bg-emerald-500/5`

**Card 4 — Completed Unbilled:**
- Label: `"Completed Unbilled"`
- Value: `stats.completedUnbilled`
- Sub: `"of {stats.byStatus['completed'] || 0} completed"`
- Icon badge: `bg-violet-500/10` + `CheckCircle2 text-violet-500`
- Orb: `bg-violet-500/5`

---

### 8.10 Middle Row — 3-column grid

`grid gap-4 lg:grid-cols-3`

#### Card A — By Status

`<Card className="p-5">`, title with `BarChart3` icon:

For each status in `stats.byStatus` (filter `count > 0`, exclude `'progress'`), sorted by count desc:
```tsx
const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
// Progress bar: <div className="h-2 overflow-hidden rounded-full bg-muted">
//                 <div className={`h-full rounded-full ${STATUS_COLORS[status]}`} style={{ width: `${pct}%` }} />
//               </div>
```

`STATUS_COLORS`:
```typescript
const STATUS_COLORS: Record<string, string> = {
  new:          'bg-blue-500',
  'in-progress':'bg-amber-500',
  progress:     'bg-amber-500',
  completed:    'bg-emerald-500',
  pending:      'bg-gray-400',
};
```

#### Card B — Active Bugs

`<Card className="p-5">`, title with `Bug className="h-4 w-4 text-red-500"` + `<Badge variant="destructive">` count if > 0:

`max-h-[240px] overflow-y-auto` list. Each bug row is a `<button>`:
```tsx
className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-accent hover:border-red-200"
onClick={() => setViewingBug(task)}
```
- Status icon badge: `h-6 w-6 rounded-md {STATUS_COLORS[task.status]} text-white flex items-center justify-center` + `<Bug className="h-3 w-3" />`
- Title: `truncate text-sm font-medium`
- Module (if `task.module_id`): resolved via `modules.find(m => m.id === Number(task.module_id))?.name` — with `Boxes className="h-3 w-3"` icon
- Relative date
- Status badge: `variant="outline" className="shrink-0 text-[10px] capitalize"`

Empty state: `CheckCircle2` icon + "No active bugs".

#### Card C — Workflow Pipeline

`<Card className="p-5">`, title with `ArrowRight` icon:

Render phases in this fixed order: `['intake', 'quality_review', 'development']` plus any extra keys in `stats.byPhase`:

```tsx
const isMyPhase = roleMeta.focusPhase === phase;
className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
  isMyPhase ? 'border-primary/40 bg-primary/5' : 'bg-background'
}`}
```
- If `isMyPhase`: pulsing dot `h-2 w-2 rounded-full bg-primary animate-pulse`
- Phase label: `capitalize` replacing `_` with space
- Count badge: `variant={isMyPhase ? 'default' : 'secondary'}`

---

### 8.11 Bottom Row — 2-column grid

`grid gap-4 lg:grid-cols-2`

#### Card Left — Role Tasks

Title: `"{roleMeta.label} Tasks"` + count badge + "View All →" ghost button (`router.push('/softaware/tasks')`):

`max-h-[320px] overflow-y-auto`. Each task row is a `<button>`:
```tsx
className="flex w-full items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent"
onClick={() => setViewingRoleTask(task)}
```
- Type icon badge (7×7 rounded-md, `STATUS_COLORS[task.status]` bg): `Code2 | Bug | Sparkles | Wrench | Headphones` per `TYPE_ICONS[task.type]`
- Title: `truncate text-sm font-medium`
- Module name (if set): `Boxes h-3` icon
- Hours (if set): `Clock h-3` icon + `timeToDecimal(task.hours).toFixed(1)h`
- Phase badge: `variant="outline" text-[10px] capitalize` showing `task.workflow_phase?.replace('_', ' ') || 'intake'`

```typescript
const TYPE_ICONS: Record<string, LucideIcon> = {
  development: Code2,
  'bug-fix':   Bug,
  feature:     Sparkles,
  maintenance: Wrench,
  support:     Headphones,
};
```

#### Card Right — Stacked: Modules + Recent Activity

**Modules card** (only rendered if `Object.keys(stats.byModule).length > 0`):
- Title with `Boxes` icon
- `flex flex-wrap gap-2` of `<Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs">` per module
- Inside badge: `{resolvedName}` + `<span className="rounded-full bg-background px-1.5 text-[10px] font-bold">{count}</span>`
- Sorted by count descending

**Recent Activity card:**
- Title with `CalendarDays` icon
- `max-h-[260px] overflow-y-auto` list
- Each row: `flex items-center gap-3 rounded-lg border bg-background px-3 py-2`
  - Status dot: `h-2 w-2 shrink-0 rounded-full {STATUS_COLORS[task.status]}`
  - Title: `truncate text-sm`
  - Creator: `task.creator || task.created_by_name || task.assigned_to_name || 'System'` + ` · ` + relative date — `text-xs text-muted-foreground`
  - Status badge: `variant="outline" shrink-0 text-[10px] capitalize`

---

### 8.12 `relativeDate` Helper

```typescript
function relativeDate(d?: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}
```

---

### 8.13 Task Detail Dialogs

Two `<TaskDetailsDialog>` instances live at the bottom of the page:

```tsx
{/* Clicked bug from Active Bugs card */}
<TaskDetailsDialog
  open={!!viewingBug}
  onOpenChange={(open) => { if (!open) setViewingBug(null); }}
  task={viewingBug}
  apiUrl={apiUrl}
  onRefresh={() => loadTasks()}
/>

{/* Clicked task from Role Tasks card */}
<TaskDetailsDialog
  open={!!viewingRoleTask}
  onOpenChange={(open) => { if (!open) setViewingRoleTask(null); }}
  task={viewingRoleTask}
  apiUrl={apiUrl}
  onRefresh={() => loadTasks()}
/>
```

These dialogs use the same `apiUrl` (external software URL) and `onRefresh` callback to reload after edits.

---

### 8.14 Full Wiring Sequence (on page load)

```
1. AuthContext provides user (role, id, full_name)
2. useSoftware() → GET /api/softaware/software → returns software[]
3. useEffect restores selectedSoftware from localStorage OR auto-selects first
4. useModules(selectedSoftware.id) → GET /api/softaware/modules?software_id={id}
5. apiUrl derived from selectedSoftware.external_mode + external_live_url/external_test_url
6. useEffect on apiUrl → loadTasks() → paginated GET /api/softaware/tasks?apiUrl=...
   a. If 401 → setAuthDialogOpen(true)
   b. On success → setTasks(normalizedTasks) → useMemo recalculates stats
7. UI renders KPI cards, charts, task lists from stats
8. User clicks any task item → setViewingBug / setViewingRoleTask → TaskDetailsDialog opens
9. User picks different software → handleSoftwareChange → new apiUrl → loadTasks() again
10. Refresh button → loadTasks() directly
```

---

## 9. Page: Tasks

**Route:** `/softaware/tasks`  
**File:** `src/app/softaware/tasks/page.tsx`

### 9.1 Header Bar

`border-b bg-card p-6`:

**Row 1:** Title "Tasks" + subtitle "Manage your development tasks" | Right: Software Selector (same as Dashboard) + Refresh button

**Row 2 (filter bar):**
- Search input: `<Input>` with `Search` icon, placeholder "Search tasks...", `w-full max-w-xs`
- **Status filter:** `<Select>` — options: All, New, In Progress, Completed
  - Default: "new"
- **Type filter:** `<Select>` — options: All, Development, Bug-Fix, Feature, Maintenance, Support
- **Phase filter:** `<Select>` — options: All, Intake, QA Review, Development, Verification, Resolution
  - Default phase based on user role: `client_manager` → intake, `qa_specialist` → quality_review, `developer` → development, others → all
- **Module filter:** Combobox (`<Popover>` + `<Command>`) — shows all unique modules for the selected software. Label "Module: All" / "Module: {name}".
- **View mode toggle:** Two icon buttons for List and Grid views. State saved to `localStorage` key `tasksViewMode`.

**Row 3 (summary bar):**
- `Clock` icon + total hours (excl. invoiced) e.g. "23.50h"
- `<Badge>` with task count e.g. "42 tasks"
- `<Button onClick={handleCreateTask}>` — `Plus` icon + "New Task"

### 9.2 Task List (scrollable)

**List mode:** Vertical stack of `TaskCard` components.

**Grid mode:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` grid of `TaskCard` components.

**Empty state:** Centered `ListTodo` icon + "No tasks found" + "Try adjusting your filters" text.

**Loading state:** Spinner centered in the content area. However, **silent refresh** (background refresh without replacing list with spinner) when polling.

### 9.3 TaskCard Component

**Component:** `src/components/softaware/tasks/TaskCard.tsx`

Renders as a `<Card className="transition-all hover:shadow-md flex flex-col h-full !py-3 !gap-1">`.

**CardHeader (pb-0):**
- **Left:** Task title (`font-bold line-clamp-2 leading-tight text-base`) + meta line below:
  - Formatted date + creator name + hours (if > 0)
  - Hours shown as `Clock` icon + `{parseFloat(hours).toFixed(2)}h` in primary color
- **Right badges:**
  - **Approval badge** (if `approval_required === 1`):
    - Approved: `bg-green-500/10 text-green-500 border-green-500/20` + `ShieldCheck` icon + "Approved"
    - Pending: `bg-orange-500/10 text-orange-500 border-orange-500/20` + `ShieldAlert` icon + "Pending"
    - Tooltip shows approver/date or "Awaiting approval" message
  - **Status badge** `variant="outline"` with status color + icon:
    - completed: `bg-green-500/10 text-green-500` + `CheckCircle`
    - in-progress/progress: `bg-yellow-500/10 text-yellow-500` + `Clock`
    - new/other: `bg-gray-500/10 text-gray-500` + `AlertCircle`

**CardContent (pt-0 pb-2 space-y-2):**
1. **Description** (if present): `line-clamp-2 text-sm text-foreground/75`, rendered as HTML (`dangerouslySetInnerHTML`)
2. **Inline Attachments** (`TaskAttachmentsInline`) — shows thumbnail previews of attachments
3. **Workflow Section** (if `task.workflow_phase` set): Rounded border with gradient `from-muted/50 to-muted/30`, padding `p-2.5`:
   - "WORKFLOW" label (10px, uppercase, tracking-wide, muted)
   - Phase badge + Workflow action button (see below)
   - If assigned: `User` icon + assigned-to name, or module badge
4. **Latest Comment** (if present, fetched separately): `MessageSquare` icon + truncated comment + user name (muted xs)
5. **Reorder buttons** (if not first/last): `ChevronUp`/`ChevronDown` ghost icon buttons

**Workflow Action Button Logic:**
- Task `completed` or phase `resolution`: Show green "Completed" badge (no button)
- User cannot assign: Show phase badge only (purple `bg-purple-500/10`)
- User can assign: Show blue "Assign" button with `ArrowRight` icon — opens `WorkflowDialog`

**Start/Complete Quick Actions:**
- If status is `new` and user is a developer: Show "Start" button (`Play` icon) — sets status to `in-progress`
- If status is `in-progress` and user is a developer: Show "Complete" button (`CheckCircle` icon) — sets status to `completed`
- These set `actual_start` / `actual_end` timestamps on the task

**Bottom action row:**
- `Eye` icon button — opens `TaskDetailsDialog`
- `Edit` icon button — opens `TaskDialog` (edit mode)
- `Trash2` icon button — opens delete `AlertDialog`
- List mode: also shows up/down reorder arrows (`ChevronUp`/`ChevronDown`)

### 9.4 TaskDialog (Create/Edit)

**Component:** `src/components/softaware/tasks/TaskDialog.tsx`

Modal dialog `max-w-2xl`:

**Title:** "Create Task" or "Edit Task"

**Fields:**
- **Title** (required): `<Input>` full width
- **Type** (required): `<Select>` — Development / Bug-Fix / Feature / Maintenance / Support
- **Status** (required): `<Select>` — New / In Progress / Completed
- **Description**: `<RichTextEditor>` (Tiptap-based rich text editor with bold, italic, lists, links)
- **Estimated Hours**: `<Input type="number" step="0.5">` in hours
- **Actual Hours**: `<Input type="number" step="0.01">` in hours (HH:MM:SS format stored, decimal displayed)
- **Due Date**: `<DateTimePicker>` component
- **Notes**: `<Textarea>` (optional)

**Footer:** Cancel + Save/Create button

### 9.5 WorkflowDialog (Assign Task)

**Component:** `src/components/softaware/tasks/WorkflowDialog.tsx`

Modal dialog `max-w-lg`:

**Title:** "Assign Task: {task.title}"

**Permission check:** If user does not have permission (`!canUserAssignTask`), show an `Alert` with `AlertCircle` icon and the permission error message. Disable the submit button.

**Phase indicator:** Shows current phase → arrow → resulting phase (e.g. "Intake → QA Review"). Backward assignments shown in orange/amber.

**Fields (vary by phase):**

*From `intake` phase:*
- Assign to (QA Specialist): `<Select>` filtered to `qa_specialist` + admins
- Comment: `<Textarea>` (optional)

*From `quality_review`/`triage` phase:*
- Toggle: "Send back to intake" / "Forward to development" (Switch or radio)
- If forwarding: Module `<Select>` (required) — lists all modules for this software. Shows developer count badge.
- If sending back: automatic assignment to available client_manager
- Comment: `<Textarea>` (optional)

*From `development` phase:*
- Assign to: `<Select>` filtered to `developer` + `qa_specialist` + admins
- Shows module developers badge if module selected
- Comment: `<Textarea>` (optional)

**Backward assignment warning:** When `isBackward` is true, show amber `Alert` "This is a backward assignment. The task will be moved to an earlier phase."

**Submit:** Calls `PUT /api/softaware/tasks` with `{ apiUrl, task: { id, assigned_to, workflow_phase, module_id, ... } }` + optionally posts a comment.

### 9.6 TaskDetailsDialog

**Component:** `src/components/softaware/tasks/TaskDetailsDialog.tsx`

Full modal (`max-w-4xl`, `max-h-[90vh]`, scrollable) with tab navigation.

**Tabs:** Details | Comments | Attachments | Associations | AI Chat (desktop only → keep for web too)

**Tab: Details**
- Full task meta: Title, Status badge, Type badge, Phase badge, Dates (Created, Start, Due, Actual Start/End), Hours (actual vs estimated), Approval status
- Assigned To: name + role, Module: name with developer list
- Description (HTML rendered)
- Notes (plain text)
- "Edit Task" button → opens TaskDialog in edit mode
- "Assign/Move" button → opens WorkflowDialog (if permitted)

**Tab: Comments**
- List of comments (chronological). Each comment:
  - Avatar initials circle (primary color bg)
  - Username (bold) + relative time
  - Content (HTML rendered if not plain text)
  - Time spent badge (if `time_spent > 0`): e.g. "30m"
  - Internal badge (if `is_internal === 1`): muted gray "Internal"
  - Reply button → sets `replyingTo` state, highlights which comment being replied to
  - If has attachments: file thumbnails shown below
  - Delete button (own comments or admin only)

- **Reply indicator:** When replying, show a banner "Replying to {user}" with X to cancel.
- **Comment input area:**
  - `<RichTextEditor>` or `<Textarea>` for comment text
  - Time spent: number input in minutes `<Input type="number" min="0" step="1">` with "minutes" label
  - Internal toggle: `<Switch>` labeled "Internal note"
  - File attach: `<FileDropzone>` — drag and drop or click to select multiple files
  - List of selected files with remove buttons
  - Submit button: "Post Comment" (or "Post Comment + {n} file(s)")

**Tab: Attachments**
- Grid of uploaded files (images as thumbnails, other files as file cards)
- Each file: filename, size, upload date, uploader
- Delete button (admin/owner)
- Upload section: `<FileDropzone>` + "Upload Files" button

**Tab: Associations** (task links)
- List of associated tasks with type labels: Duplicate / Subtask / Related / Blocks / Blocked By
- "Link Task" button → opens `TaskAssociationDialog`
- Each row: relationship type + task title + status badge + "View" link

**Tab: AI Chat**
- Embedded AI assistant pre-prompted with task context (title, description, module, software)
- Same streaming chat interface as the main chat page
- `<TaskAIChat>` component

**Image Lightbox:** Clicking any image thumbnail opens a full-screen lightbox with prev/next navigation.

### 9.7 Filtering Logic

```typescript
filteredTasks = tasks.filter(task => {
  if (statusFilter !== 'all' && task.status !== statusFilter) return false;
  if (typeFilter !== 'all' && task.type !== typeFilter) return false;
  if (phaseFilter !== 'all') {
    const taskPhase = task.workflow_phase?.toLowerCase() || 'intake';
    if (taskPhase !== phaseFilter) return false;
  }
  if (moduleFilter !== 'all' && String(task.module_id) !== moduleFilter) return false;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    return task.title?.toLowerCase().includes(query) ||
           task.description?.toLowerCase().includes(query) ||
           task.creator?.toLowerCase().includes(query);
  }
  return true;
});
```

### 9.8 Task Reordering

Tasks can be reordered in list view. Each card shows up/down arrow buttons (hidden if first/last). Clicking swaps positions by calling `POST /api/softaware/tasks/reorder` with `{ apiUrl, orders: { taskId: newOrder } }`.

### 9.9 Polling

Tasks are polled every 30 seconds. When changes are detected:
- New task: Toast "New Task: {title}" + browser Notification
- Status change: Toast "Task Status Updated: {title} → {status}" + browser Notification

Request browser notification permission (`Notification.requestPermission()`) on first task load.

---

## 10. Page: Software Management

**Route:** `/softaware/software`  
**File:** `src/app/softaware/software/page.tsx`

### 10.1 Header Bar

`border-b bg-card p-6`:
- Title "Software Management" + subtitle "Manage your software products"
- Refresh button (`RefreshCw`, `variant="outline"`, `size="icon"`)
- "New Software" button (`Plus` icon)
- Search input: `max-w-md`, `Search` icon left-positioned

### 10.2 Tabs

`<Tabs defaultValue="overview">` with `<TabsList>`:
- **Overview** tab
- **Modules** tab

#### 10.2.1 Overview Tab

Grid `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` of `SoftwareCard` components.

**SoftwareCard:**
- Hover: slight lift + shadow (`hover:-translate-y-1 hover:shadow-md`, `transition-all`)
- **CardHeader:**
  - Software name (semibold) + software key (mono, xs, muted)
  - If has external integration: "External Integration" badge. If authenticated: "Authenticated" badge (green, with `CheckCircle` icon)
  - **Action buttons** (top right):
    - Shield/authenticate button (if has external integration): opens `AuthenticateDialog`
    - Edit button (`Edit` icon): opens `SoftwareDialog`
    - Delete button (`Trash2` icon): opens `AlertDialog` confirm → `DELETE /api/softaware/software/{id}`
- **CardContent** (if description): Rich text rendered description (`line-clamp-3`)

Empty state: centered `Package` icon + "No software found" + "Add your first software product to get started".

#### 10.2.2 Modules Tab

Two states:
1. **Select software**: Shows a grid of software cards (same list). Clicking one enters modules view.
2. **Module list** (after selection): "← Back" ghost button + `ModulesTab` component.

**ModulesTab component:**
- Lists all modules for the selected software
- Each module: name + description + developer count badge + edit/delete buttons
- "Add Module" button → opens module create form (inline or dialog)
- Module fields: Name (required), Description, Developer assignments (multiselect of users with `developer` role)

### 10.3 SoftwareDialog (Create/Edit)

Modal `max-w-2xl`:

**Tabs:** General | Integration

**General tab:**
- Software Name (required): `<Input>` + validation
- Software Key (required): `<Input>`, alphanumeric/hyphens/underscores only. Disabled when editing.
  - Helper text: "Unique identifier (letters, numbers, hyphens, underscores only)"
- Description: `<Textarea rows={4}>`
- Order Number: `<Input type="number">`

**Integration tab:**
- Checkbox "Enable external API integration" (with explanation: "Connect this software to external task management systems")
- **If enabled, additional fields appear:**
  - Username (required): `<Input>`
  - Password (required): `<Input type="password">`
  - Live URL (required): `<Input>` with URL validation
  - Test URL (required): `<Input>` with URL validation
  - Active Mode: `<Select>` — Live / Development

### 10.4 AuthenticateDialog

Modal for authenticating against the external API:
- Username: `<Input>` (pre-filled from software config)
- Password: `<Input type="password">`
- Submit → `POST /api/softaware/software/{id}/authenticate` → stores token in localStorage `software_token`
- On success: shows green success state + closes after 1.5s

---

## 11. Page: Updates Management

**Route:** `/softaware/updates`  
**File:** `src/app/softaware/updates/page.tsx`

### 11.1 Header Bar

`border-b bg-card p-6`:
- Title "Updates Management" + subtitle "Manage software updates and releases"
- Refresh (`RotateCcw`) + "New Update" (`Plus`) buttons
- Search input `max-w-md`

### 11.2 Updates Grid

`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` of update cards.

**Each update card** (`border rounded-lg bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all`):
- **Header row:**
  - Software name (`text-lg font-semibold`)
  - Version + relative date (e.g. "v2.1.0 • 3 days ago") in muted text
  - Action buttons: Download (`Download`), Edit (`Edit2`), Delete (`Trash2`) — ghost icons
- **Body:** Description rendered as HTML (`dangerouslySetInnerHTML`), `line-clamp-3 text-sm text-muted-foreground`

Empty state: `Package` icon + "No updates found" + "Create your first update to get started".

Delete action: Opens `AlertDialog` confirm — "Are you sure you want to delete {software_name} version {version}?" → `DELETE /api/softaware/updates?id={id}`.

### 11.3 UpdateDialog (Create/Edit)

Modal dialog:
- Software: `<Select>` dropdown of all software products
- Version: `<Input>` placeholder "1.0.0"
- Description: `<RichTextEditor>` (rich text with formatting)
- Save button → `POST` or `PUT /api/softaware/updates`

---

## 12. Page: Clients

**Route:** `/clients`  
**File:** `src/app/clients/page.tsx`

### 12.1 Header Bar

`border-b bg-card p-6`:
- Title "Client Management"
- Subtitle: "{online} online · {offline} offline · {blocked} blocked" + "Auto-refreshes every 30s" (xs, muted/60)
- Refresh button

**Filter row:**
- Search input: placeholder "Search by hostname, user, IP, software..."
- Status filter tabs (`<Tabs>`): All ({total}), Online ({online}), Offline ({offline}), Blocked ({blocked})

### 12.2 Clients Table

Responsive table (`rounded-md border overflow-x-auto`) with `table-fixed w-full`:

**Columns:**
1. **Status** (w-10): 
   - Blocked: `Ban` icon (destructive color)
   - Online: filled green circle `Circle` (`fill-green-500 text-green-500`)
   - Offline: filled muted circle
   - Wrapped in Tooltip showing status text (or block reason)
2. **Client** (18%):
   - Hostname / machine_name (bold, truncated)
   - OS info or IP address (xs, muted, truncated)
3. **User / Activity** (33%):
   - Username with `User` icon (if present)
   - Active page in monospace font (xs, muted). If offline: "(last)" suffix (opacity-50)
   - AI active badge: `bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1` with `Sparkles` icon — "AI Active" (shown if `ai_sessions_active > 0` AND online)
4. **Software** (14%): `software_name` (truncated)
5. **Last Seen** (12%): Relative time (e.g. "2m ago", "Just now")
6. **Actions** (160px): Icon buttons (see below)

**Online detection:** A client is online if `last_heartbeat` is within the last 5 minutes.

**Blocked rows:** `opacity-50 bg-destructive/5`

**Action buttons per row:**
- **Block** (unblocked clients): `Ban` icon → opens Block dialog
- **Unblock** (blocked clients): Unblock icon → immediate `PUT /api/clients { id, action: 'unblock' }`
- **Force Logout**: `LogOut` icon → confirm dialog → `PUT /api/clients { id, action: 'force_logout' }`
- **Send Message**: `Send` icon → opens Send Message dialog
- **Delete**: `Trash2` icon → confirm dialog → `DELETE /api/clients?id={id}`

**Sorting:** Online first, then by most recent heartbeat.

### 12.3 Block Dialog

Modal:
- Title: "Block Client"
- Description: "Enter a reason for blocking {hostname}"
- Reason `<Textarea>` (required to enable Submit)
- Cancel + Block buttons
- On submit: `PUT /api/clients { id, action: 'block', reason }`

### 12.4 Send Message Dialog

Modal:
- Title: "Send Message to {hostname}"
- Message `<Textarea>` (required)
- Info text: "Message will be displayed on the client's next heartbeat"
- Cancel + Send buttons
- On submit: `PUT /api/clients { id, action: 'send_message', message }`

### 12.5 Auto-Refresh

The clients list auto-refreshes every 30 seconds using `useClients` hook (polling via `setInterval`).

---

## 13. Page: Users

**Route:** `/users`  
**File:** `src/app/users/page.tsx`

### 13.1 Header Bar

`border-b bg-card p-6`:
- Title "User Management" + subtitle "Manage system users and permissions"
- Refresh + "New User" buttons
- Search input: placeholder "Search users..." (full width)

### 13.2 Users Table

`rounded-md border` table:

**Columns:**
1. **User**: Avatar circle (40x40, `bg-primary text-primary-foreground`, shows first 2 chars uppercase) + username (bold) + email (muted sm)
2. **Workflow Role**: `Badge variant="outline" className="capitalize"` showing role (underscores replaced with spaces)
3. **Admin**: `Badge variant="default"` with `Shield` icon + "Admin" if `is_admin`; dash otherwise
4. **Created**: Formatted date or dash
5. **Actions** (w-[120px]): Edit (`Edit` icon ghost btn) + Delete (`Trash2` ghost btn)

Empty state: `UserIcon` + "No users found".
Loading state: Spinning `RefreshCw`.

### 13.3 User Dialog (Create/Edit)

Modal `sm:max-w-[500px]`:
- **Title:** "Create User" / "Edit User"
- **Fields:**
  - Username (required): `<Input>` + inline error
  - Email: `<Input type="email">` + inline error (format validation)
  - Password: `<Input type="password">`. Required on create. When editing, placeholder "Leave blank to keep current". Min 6 chars if provided.
  - **Workflow Role** (required): `<Select>` — Admin, Client Manager, QA Specialist, Developer, Deployer, Viewer. Helper text: "Determines workflow permissions for task management".
  - **Administrator privileges**: `<Checkbox>` + label "Administrator privileges (system access)"
- **Footer:** Cancel + Create/Update button

**Special behavior when editing own profile:**
- If password changed: re-login automatically after save
- If password not changed but token invalidated by backend: re-login prompt

### 13.4 Delete User

Confirm dialog (native or `AlertDialog`): "Delete user {username}?" → `DELETE /api/users?id={id}`

---

## 14. Page: Groups (Chat)

**Route:** `/groups`  
**File:** `src/app/groups/page.tsx`

Real-time group messaging interface connecting to a backend via Socket.io.

### 14.1 Layout

Full-height flex row:
```
┌──────────────────────────────┬─────────────────────────────────────┐
│  Group List Panel (320px)    │   Message Area (flex-1)             │
│                              │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
```

### 14.2 Group List Panel

`w-80 border-r bg-card flex flex-col`:

**Header:** "Groups" heading + `Users` icon (xs count badge of connected users, if applicable).

**Search:** `<Input>` with `Search` icon, placeholder "Search groups...", `h-8`.

**Group list** (scrollable):
Each group item (`cursor-pointer rounded-lg border-b px-3 py-3`):
- Active: `bg-sidebar-accent`
- Group name (bold, truncated)
- Last message preview (xs, muted, `line-clamp-1`)
- Relative timestamp (xs, muted, right-aligned)

Empty state: `MessageCircle` icon + "No groups available".

### 14.3 Message Area

**When no group selected:** Centered `MessageCircle` icon + "Select a group to start chatting".

**When group selected:**

**Message Area Header** (`h-14 border-b flex items-center px-4 gap-3`):
- Group name (bold)
- Members count badge

**In-message search bar** (shown when search active):
- `<Input>` for search query
- Up/down navigation buttons (`ChevronUp`/`ChevronDown`)
- Result count "X of Y"
- Close button

**Message list** (scrollable, padded):

Each message block:
- **Avatar**: Initials circle (`h-8 w-8 rounded-full`, colored by name hash or `bg-primary`)
- **Header row:** Username (bold sm) + formatted timestamp (xs muted)
- **Content:**
  - Plain text (with `<br>` for newlines) — sanitized (no `<script>`, no event handlers)
  - **Search highlight**: matched term highlighted (`bg-yellow-200` / `bg-amber-400` for current match)
  - Images: `<img>` with click-to-expand lightbox
  - Videos: `<video controls>` with `max-h-[300px]`
  - Audio: `<audio controls>`
  - Files: File card with icon, filename, size + download link
  - Captions (for media): shown below the media
- **Reply indicator** (if `reply_to_message_id`): Indented quoted block showing original message
- **Hover actions:** Reply button (`Reply` icon)

**Message Input Area** (`border-t p-3`):

- Reply indicator bar (if replying): "Replying to {username}: {truncated}" + X button to cancel
- Attached files preview: thumbnails/file cards with remove buttons
- `<textarea>` (resizable, `resize-none`, max-height `200px`), placeholder "Type a message...", auto-grows with content
- **Keyboard shortcuts:** Enter to send, Shift+Enter for newline, paste image/file support
- Action buttons row:
  - Attach file: `Paperclip` icon → hidden `<input type="file" multiple>`
  - Send: `Send` icon button (primary color, disabled if empty)

### 14.4 Socket.io Connection

Connect to WebSocket server URL from settings (`chat_websocket_url_live` or `chat_websocket_url_dev` based on `environment_mode`).

**Events to emit:**
- `join_group` — on group selection
- `leave_group` — on group switch
- `send_message` — `{ group_id, text, reply_to_message_id, file_data, file_name, file_type, file_size }`

**Events to listen:**
- `group_list` — initial groups list
- `message_history` — messages for selected group
- `new_message` — real-time message
- `user_joined` / `user_left` — presence updates

File attachments sent as base64 data URLs.

---

## 15. Page: AI Sessions (Chat)

### 15.1 New Session Page (`/chat`)

**Route:** `/chat`  
**File:** `src/app/chat/page.tsx`

Full-height flex column for composing a new AI session.

**Layout:** Centered vertically + horizontally within main content area.

**Working Directory Input:**
- `FolderPicker` component: Input with a folder icon. In web mode, user types the path manually (no native folder picker dialog). When a directory is set, the RightPanel opens and shows the file tree.
- Placeholder: "Enter working directory path (optional)"

**Message Input:**
- `<MessageInput>` component (see Section 15.4)
- Model selector (Claude model picker): "sonnet" default
- Mode toggle: Code / Plan / Ask

**Behavior on first message:**
1. Create session via `POST /api/chat/sessions { title, mode, working_directory }`
2. Stream the first message via `POST /api/chat` (SSE streaming)
3. Parse SSE events (text, tool_use, tool_result, tool_output, status, result, permission_request, error, done)
4. Navigate to `/chat/{sessionId}` after session created
5. Dispatch `session-created` event on `window`

### 15.2 Session Detail Page (`/chat/[id]`)

**Route:** `/chat/[id]`  
**File:** `src/app/chat/[id]/page.tsx`

Same layout as new session but loads existing messages and allows continuing the conversation.

On mount:
- Load session details: `GET /api/chat/sessions/{id}`
- Load messages: `GET /api/chat/sessions/{id}/messages`
- Set `sessionId`, `sessionTitle`, `workingDirectory` in PanelContext

### 15.3 ChatView Component

`src/components/chat/ChatView.tsx`

Full-height flex column:
1. **MessageList** (flex-1, scrollable) — scrolls to bottom on new messages
2. **Streaming indicator** (if streaming): animated typing indicator + status text (e.g. "Running bash... (12s)")
3. **Permission approval card** (if `pendingPermission`):
   - Card with tool name + description
   - 3 buttons: "Allow Once", "Allow for Session", "Deny"
   - Buttons disabled while resolving (show resolved state briefly)
4. **MessageInput** (bottom)

### 15.4 MessageInput Component

`src/components/chat/MessageInput.tsx`

Bottom input area:
- Auto-growing `<textarea>` (min-height 56px, max-height 200px, `resize-none`)
- Placeholder: "Message Claude Code..."
- Keyboard: Enter to send, Shift+Enter for newline
- **Attach files button**: `Paperclip` icon — opens file picker
- **Folder picker**: folder icon button
- **Model selector**: `<Select>` or pill buttons (sonnet / haiku / opus)
- **Mode tabs**: Code | Plan | Ask (pill toggle buttons)
- **Send button**: `<Button>` with `ArrowUp` icon (or submit icon). Disabled when empty or streaming.
- **Stop button**: Shown when streaming — red `Square` icon "Stop"

File attachments shown as removable chips above the textarea.

### 15.5 MessageList & MessageItem Components

**MessageItem** renders a single message:

**User messages:**
- Right-aligned bubble (or full-width in code view)
- `bg-primary/10` background
- Plain text or Markdown rendered

**Assistant messages:**
- Left-aligned, no bubble background
- Markdown rendered with syntax-highlighted code blocks
- **ToolCallBlock**: When a tool_use occurs, show a collapsible block:
  - Header: `<tool_name>` badge + elapsed time + chevron toggle
  - Expanded: JSON input prettified + stdout/stderr output in monospace scrollable area
  - Color-coded: running=blue, success=green, error=red

**Token usage** (if present): Tiny `<Badge>` at bottom showing "Input: X • Output: Y tokens"

**StreamingMessage**: While streaming, renders partial `accumulated` text with a blinking cursor `|`.

### 15.6 SSE Event Processing

```typescript
switch (event.type) {
  case 'text':       // Append to accumulated text buffer
  case 'tool_use':   // Add tool to toolUses list (deduplicated by id)
  case 'tool_result': // Add to toolResults list
  case 'tool_output': // Update streaming tool output (last 5000 chars)
                     // If _progress field: update statusText
  case 'status':     // Update statusText (auto-clear after 2s if sessionId present)
  case 'result':     // Extract token usage
  case 'permission_request': // Set pendingPermission state
  case 'error':      // Append error text to accumulated
  case 'done':       // break
}
```

### 15.7 CodeBlock Component

`src/components/chat/CodeBlock.tsx`

- Syntax highlighted code block using `highlight.js` or `shiki`
- Language badge (top right)
- Copy button (copies to clipboard, shows "Copied!" for 2s)
- Line numbers optional

---

## 16. Page: Extensions

**Route:** `/extensions`  
**File:** `src/app/extensions/page.tsx`

### 16.1 Layout

`border-b px-6 pt-4 pb-0` header:
- "Extensions" h1 (`text-xl font-semibold mb-3`)
- `<Tabs>` with `<TabsList>`: Skills | MCP Servers

Content area: `flex-1 overflow-hidden p-6 flex flex-col min-h-0`

### 16.2 Skills Tab

**Component:** `SkillsManager`

A "skill" is a stored prompt template / instruction set for the AI. 

**List view:**
- Each skill: name + description (truncated) + "Use" button + Edit/Delete actions
- "Add Skill" button (top right)

**Skill Dialog (Create/Edit):**
- Name: `<Input>` (required)
- Description: `<Input>` (optional)
- Instructions: `<Textarea rows={10}>` — the actual skill content/prompt

Skills stored via `POST/PUT/DELETE /api/skills`.

### 16.3 MCP Servers Tab

**Component:** `McpManager`

MCP (Model Context Protocol) servers extend Claude's capabilities.

**Server list:**
- Each server: name + type (stdio/sse) + status indicator (running/stopped/error) + enable/disable toggle + edit/delete
- "Add Server" button

**Server Dialog (Create/Edit):**
- Name: `<Input>`
- Type: `<Select>` — stdio / SSE
- Command (stdio): `<Input>` (e.g. `npx`, `node`, path to binary)
- Args (stdio): tag-input for array of arguments
- URL (SSE): `<Input>` (HTTP endpoint)
- Environment variables: key-value pairs input (add/remove rows)
- Headers (SSE): key-value pairs
- "Test Connection" button

MCP servers managed via `POST/PUT/DELETE /api/mcp/servers`.

---

## 17. Page: Publishing

**Route:** `/publishing`  
**File:** `src/app/publishing/page.tsx`

### 17.1 Layout

`border-b bg-card p-4` header:
- "Publishing" h1 + subtitle

`<Tabs>` with content:
- **Changes** — Git status
- **History** — Git log
- **Files** — Local file browser
- **Remote** — Remote (SFTP) file browser

### 17.2 Git Configuration

Top section (always visible):
- **Local path input**: `<Input>` + "Load" button. Persisted to `localStorage` key `git_local_path`.
- On load: calls `POST /api/publishing/repo-status { localPath }` → gets current branch, all branches, changed files, recent commits.
- Status message area (success/error)

### 17.3 Changes Tab

**Branch switcher row:**
- Current branch shown as `Badge` with `GitBranch` icon
- Branch list: dropdown or list of all branches, each clickable to switch

**Changed files list:**
Each changed file:
- Checkbox (for staging)
- File status badge: Modified (M, amber), Added (A, green), Deleted (D, red), Renamed (R, blue), Untracked (??, gray)
- File path (monospace, truncated)
- "Stage" / "Unstage" toggle button

**Commit area:**
- `<Textarea>` commit message (required)
- **Auto-increment version toggle**: `<Checkbox>` + label "Auto-increment version"
- **Software selector** (for deploy): `<Select>`
- **Version input**: `<Input>` e.g. "1.0.0"
- Buttons row: "Stage All" | "Unstage All" | "Commit" | "Commit & Push"
- Commit calls `POST /api/publishing/commit { localPath, message, files[] }`
- Push calls `POST /api/publishing/push { localPath }`

### 17.4 History Tab

Git log list of recent commits:
- Each commit: short hash (`GitCommit` icon) + message + author + relative date
- Commits loaded via `POST /api/publishing/repo-status`

### 17.5 Files Tab (Local Browser)

**Path breadcrumb** + parent folder ".." link (if has parent).

**File/folder list** (sortable):
Columns: icon | name (editable on dblclick) | type | size | actions

- Folders: `FolderOpen` icon (amber), shown first
- Files: `File` icon (muted)
- Selected files: checkbox state
- **Context actions per item:**
  - Rename: pencil icon → inline input → confirm
  - Delete: trash icon → `DELETE /api/files/browse { path }`
  - Download (files only)
- **Bulk actions**: "Select All" checkbox + transfer to remote button (`ArrowRight`)

Navigation: clicking a folder navigates into it; `..` navigates up.
Load: `GET /api/files/browse?dir={path}` → returns `{ current, parent, items: [{name, path, type, size, isDir}] }`
Rename: `PATCH /api/files/browse { oldPath, newPath }`

### 17.6 Remote Tab (SFTP)

**FTP/SFTP Configuration Panel:**
- Host: `<Input>`
- Port: `<Input type="number">` (default 22)
- Username: `<Input>`
- Auth Type: radio/toggle — Password | SSH Key
  - If Password: `<Input type="password">`
  - If SSH Key: `<Input>` for key path + `<Button>` "Upload Key File" (hidden file input)
- Remote Path: `<Input>` (default `/var/dev/`)
- Timeout: `<Input>` (ms, default 30000)
- **"Test Connection"** button → `POST /api/publishing/remote-files { ...config }` with test flag → shows ✓ or ✗
- **"Load Files"** button
- Config persisted to `localStorage` key `ftp_config`

**Remote file list** (same UI as local):
- Load: `POST /api/publishing/remote-files { ...config, remotePath }`
- Rename: `PATCH /api/publishing/remote-files { ...config, oldPath, newPath }`
- Delete: `DELETE /api/publishing/remote-files { ...config, path }`

### 17.7 File Transfer Queue

When files are selected on both sides:
- **Transfer queue panel**: list of pending transfers with progress
- Progress bar + "X of Y files" text
- Current file being transferred
- "Upload Selected →" and "← Download Selected" buttons
- Upload calls `POST /api/publishing/transfer` with file data + SFTP config

### 17.8 Connection Status Indicator

Persistent status chip (bottom right or top of config panel):
- idle: hidden
- testing: `Loader2` spinning + "Testing..."
- success: `CheckCircle` green + message
- error: `AlertCircle` red + error message
Auto-clears after 4 seconds.

---

## 18. Page: Database Manager

**Route:** `/database`  
**File:** `src/app/database/page.tsx`

### 18.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Top bar: "Database Manager" h1 + engine badge + "+Connection"│
├───────────────┬─────────────────────────────────────────────┤
│ Connection    │  Main pane (flex-1)                          │
│ Sidebar       │  View toggle: Query | Explorer              │
│ (220px)       │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### 18.2 Connection Sidebar

`w-55 border-r flex flex-col overflow-hidden bg-background`:

**List of saved connections:**
Each connection item (`cursor-pointer rounded-md px-3 py-2`):
- Active: `bg-primary/10 border border-primary/20`
- Engine icon (MySQL/SQL Server)
- Connection name (bold, truncated)
- Host (xs, muted, truncated)
- Status dot: connected (green) / disconnected (gray)
- Hover: Edit (`Pencil`) + Delete (`Trash2`) icon buttons

**Connect on click:** calls `POST /api/database/connect { ...connection }` → loads table list on success.

### 18.3 ConnectionDialog (Add/Edit)

Modal `max-w-md`:

**Fields:**
- Connection Name: `<Input>` (required)
- Engine: `<Select>` — MySQL | SQL Server (MSSQL)
- Host: `<Input>` (required)
- Port: `<Input type="number">` (auto-filled: 3306 for MySQL, 1433 for MSSQL)
- Database: `<Input>` (required)
- Username: `<Input>` (required)
- Password: `<Input type="password">`
- **SSL toggle** (MySQL): `<Switch>`
- **SSH Tunnel section** (collapsible):
  - Enable Tunnel: `<Checkbox>`
  - SSH Host, SSH Port, SSH Username, SSH Password / Key path
- **"Test Connection"** button: calls `POST /api/database/test-connection` → shows success/error inline
- Save button

Connections persisted to `localStorage` key `database_connections`.

### 18.4 Query Editor

`src/app/database/components/QueryEditor.tsx`

**SQL editor area:**
- `<textarea>` or CodeMirror-style editor with SQL syntax highlighting
- Monospace font, min-height 200px
- **Run button**: `POST /api/database/query { connectionId, sql }` → returns `{ columns, rows, rowCount, executionTime }`
- Keyboard shortcut: `Ctrl/Cmd + Enter` to run

**Results area:**
- Scrollable table: `<Table>` with column headers + data rows
- Row count badge: "X rows returned"
- Execution time: "in Xms"
- Error display: red alert box with error message

**View toggle tabs** (top of main pane): Query | Explorer

### 18.5 Table Explorer

`src/app/database/components/TableExplorer.tsx`

**Table list** (left side within main pane or replace sidebar):
- Grouped by schema (if MSSQL)
- Each table: table icon + name
- Click → loads columns + allows browsing

**Structure view** (right side):
When a table is selected:
- **Columns tab**: Table with columns (name, type, nullable, default, PK, FK indicators)
- **Browse tab**: Paginated data grid with `POST /api/database/browse { connectionId, table, page, limit }` → shows rows with column headers, page size selector (25/50/100), prev/next pagination

---

## 19. Page: Settings

**Route:** `/softaware/settings`  
**File:** `src/app/softaware/settings/page.tsx`

### 19.1 Header Bar

`border-b bg-card px-6 py-4`:
- Title "Settings" + subtitle
- "Unsaved changes" badge (secondary, with `AlertCircle` icon) — shown when form has unsaved changes

### 19.2 Settings Form

`max-w-3xl space-y-4` within scrollable area:

#### Card 1: Environment (`Server` icon)
**Description:** "Controls which API and WebSocket URLs are used throughout the app."

- **Mode toggle** (radio buttons): Live | Development
  - Active option styled with primary color
- **Live API URL**: `<Input>` — shown always
- **Dev API URL**: `<Input>` — shown always
- **Live WebSocket URL**: `<Input>`
- **Dev WebSocket URL**: `<Input>`

#### Card 2: API Settings (`Settings` icon)
- **Request Timeout**: `<Input type="number">` in seconds (default 30)

#### Card 3: Support / Tasks API
- **Mode toggle**: Live | Development (separate from environment)
- **Support API URL (Live)**: `<Input>`
- **Support API URL (Dev)**: `<Input>`

#### Card 4: Notifications (`Bell` icon)
- **System Notifications**: `<Checkbox>` labeled "Enable system notifications"
  - Helper: "Show OS-level notifications for new tasks and status changes"

#### Card 5: Developer Mode (`Settings` icon, shown for admin/dev roles only)
- **Developer Mode**: `<Checkbox>` labeled "Enable developer mode"
  - Helper: "Shows additional debugging information and developer tools"

#### Card 6: Task Approval (`Clock` icon)
- **Approval Hours Threshold**: `<Input type="number" step="0.5">` (default 8)
  - Helper: "Tasks with estimated hours exceeding this limit require approval before being assigned"

#### Card 7: API Providers (`Headset` icon)
- Link to provider settings: "Manage AI providers" button → navigates to `/settings` (separate page)
- Or inline `ProviderManager` component showing list of configured AI providers (OpenAI, Anthropic, etc.) with add/edit/delete

### 19.3 Footer Actions

Sticky footer or floating bar:
- **Save** button (`Save` icon, primary variant) — calls `POST /api/settings/app { settings }` + persists to `localStorage`
- **Reset** button (`RotateCcw`) — reverts unsaved changes to last saved state
- **Reset to Defaults** button — resets all values to DEFAULT_SETTINGS

### 19.4 AI Provider Settings (linked page or inline)

**ProviderManager component** (`src/components/settings/ProviderManager.tsx`):

List of configured providers:
- Provider name + model + API key (masked)
- Active indicator
- Edit / Delete buttons
- "Add Provider" button → opens `ProviderForm`

**ProviderForm (`src/components/settings/ProviderForm.tsx`):**
- Provider type: `<Select>` — Anthropic, OpenAI, AWS Bedrock, Custom
- Model: `<Input>` or `<Select>` (pre-filled options per provider)
- API Key: `<Input type="password">`
- Base URL (for custom): `<Input>`
- Set as Default: `<Checkbox>`

---

## 20. Shared Dialogs & Components

### 20.1 UserProfileDialog

Modal `sm:max-w-[500px]`, opened from the Header dropdown.

Fields:
- Username: `<Input>` (required)
- Email: `<Input type="email">`
- Full Name: `<Input>`
- Password: `<Input type="password">` (optional for change)
- Confirm Password: `<Input type="password">` (if password filled)
- Workflow Role: `<Select>` (same role options as Users page)

On save: calls `PUT /api/users { id, username, email, full_name, role, password? }`. If password changed, re-login. Updates `user_data` in localStorage and refreshes AuthContext.

### 20.2 TaskHoursModal

Small modal for recording time on a task:
- Hours input: numeric (decimal)
- Start/End time pickers (optional)
- Notes `<Textarea>`
- Calls `POST /api/softaware/tasks/{id}/hours { apiUrl, hours, start, end, notes }`

### 20.3 TaskAssociationDialog

Modal for linking two tasks:
- Search input: searches `allTasks` (fetched from current software's tasks)
- List of task results with title + status badge
- Relationship type: `<Select>` — Duplicate / Subtask / Related / Blocks / Blocked By
- Notes `<Textarea>` (optional)
- Link button → `POST /api/softaware/tasks/{id}/associations { apiUrl, targetTaskId, type, notes }`

### 20.4 TaskNotificationPoller

**Component:** `src/components/layout/TaskNotificationPoller.tsx`

Background component that polls `GET /api/softaware/task-notifications` every 60 seconds and shows toast notifications for any task updates since the last poll. No visible UI element.

### 20.5 HeartbeatProvider

**Component:** `src/components/layout/HeartbeatProvider.tsx`

Background component that sends a heartbeat every 30 seconds to keep the session alive: `POST /api/heartbeat`. No visible UI element.

### 20.6 ConnectionStatus

**Component:** `src/components/layout/ConnectionStatus.tsx`

Small status indicator (optional overlay, bottom-right corner) showing:
- Green dot: connected to backend
- Red dot + tooltip: connection error

### 20.7 UpdateDialog (App Updates)

**Component:** `src/components/layout/UpdateDialog.tsx`

Modal that can be shown when a new app version is available (via `GET /api/app/version` check). Shows version number + changelog + "Update Now" button.

### 20.8 ImportSessionDialog

**Component:** `src/components/layout/ImportSessionDialog.tsx`

Modal for importing Claude Code CLI sessions:
- `<Textarea>` for pasting session JSON
- Or file upload for `.json` session export
- Calls `POST /api/chat/sessions/import`

### 20.9 ModulesTab Component

`src/components/softaware/software/ModulesTab.tsx`

Used inside the Software page Modules tab. Lists modules for a selected software product.

**Module list:**
- Each module card: name + description + developer avatars + task count
- "Add Module" button → inline slide-down form or modal

**Add/Edit Module form:**
- Module Name: `<Input>` (required)
- Description: `<Textarea>`
- Developers: Multi-select of users with `developer` role (shows username + role badge)
- Save → `POST /api/softaware/modules { softwareId, name, description, developers: [userId] }`

### 20.10 AlertDialog Pattern

All destructive confirmations use `AlertDialog` (not browser `confirm()`):
```
AlertDialog
  AlertDialogContent
    AlertDialogHeader
      AlertDialogTitle → "Delete {entity}"
      AlertDialogDescription → "Are you sure? This cannot be undone."
    AlertDialogFooter
      AlertDialogCancel → "Cancel"
      AlertDialogAction → "Delete" (destructive variant)
```

---

## 21. Data Types Reference

### 21.1 Task

```typescript
interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: 'new' | 'in-progress' | 'completed' | 'progress' | 'pending';
  type: 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support';
  hours: string;              // Actual hours (HH:MM:SS or decimal string)
  estimatedHours: string;
  created_at?: string;
  start?: string;
  due_date?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  creator?: string;
  created_by_name?: string;
  workflow_phase?: string | null;  // 'intake'|'quality_review'|'development'|'verification'|'resolution'
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
}
```

### 21.2 Software

```typescript
interface Software {
  id: number;
  name: string;
  software_key: string;
  description?: string;
  has_external_integration?: boolean;
  external_username?: string;
  external_password?: string;
  external_live_url?: string;
  external_test_url?: string;
  external_mode?: 'live' | 'development';
  order_number?: number;
}
```

### 21.3 Update

```typescript
interface Update {
  id: number;
  software_id: number;
  software_name?: string;
  version: string;
  description: string;  // HTML rich text
  created_at: string;
}
```

### 21.4 User

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: UserRole;
  is_admin: boolean;
  created_at?: string;
}

type UserRole = 'super_admin' | 'admin' | 'developer' | 'client_manager' | 'qa_specialist' | 'deployer' | 'viewer';
```

### 21.5 Client

```typescript
interface Client {
  id: number;
  hostname?: string;
  machine_name?: string;
  ip_address?: string;
  os_info?: string;
  user_name?: string;
  software_name?: string;
  last_heartbeat?: string;
  active_page?: string;
  is_blocked: boolean;
  blocked_reason?: string;
  ai_sessions_active?: number;
}
```

### 21.6 ChatSession

```typescript
interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model: string;
  working_directory: string;
  project_name: string;
  status: 'active' | 'archived';
  mode?: 'code' | 'plan' | 'ask';
  needs_approval?: boolean;
}
```

### 21.7 DatabaseConnection

```typescript
interface DatabaseConnection {
  id: string;
  name: string;
  engine: 'mysql' | 'mssql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  useTunnel?: boolean;
  tunnel?: { host: string; port: number; username: string; password?: string; keyPath?: string };
}
```

---

## 22. API Endpoint Reference

All API routes are Next.js API routes that proxy to the PHP backend. The backend base URL comes from the `settings` (localStorage) — `api_server_url` or `api_server_url_dev` based on `environment_mode`.

### 22.1 Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user }` |
| GET | `/api/auth/me` | — | `{ user }` |
| POST | `/api/auth/logout` | — | `{ success }` |

### 22.2 Users

| Method | Path | Body/Query | Response |
|--------|------|-----------|----------|
| GET | `/api/users` | — | `{ users: User[] }` |
| POST | `/api/users` | `User` data | `{ user }` |
| PUT | `/api/users` | `{ id, ...User }` | `{ user }` |
| DELETE | `/api/users?id={id}` | — | `{ success }` |

### 22.3 Software

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/softaware/software` | — | `{ software: Software[] }` |
| POST | `/api/softaware/software` | `Software` data | `{ software }` |
| PUT | `/api/softaware/software/{id}` | partial `Software` | `{ software }` |
| DELETE | `/api/softaware/software/{id}` | — | `{ success }` |
| POST | `/api/softaware/software/{id}/authenticate` | `{ username, password }` | `{ token }` |

### 22.4 Modules

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/softaware/modules?softwareId={id}` | `{ modules }` |
| POST | `/api/softaware/modules` | `{ module }` |
| PUT | `/api/softaware/modules/{id}` | `{ module }` |
| DELETE | `/api/softaware/modules/{id}` | `{ success }` |
| GET | `/api/softaware/modules/{id}/developers` | `{ developers }` |

### 22.5 Tasks

| Method | Path | Body/Query | Response |
|--------|------|-----------|----------|
| GET | `/api/softaware/tasks?apiUrl={url}` | — | `{ data: { data: Task[] } }` |
| POST | `/api/softaware/tasks` | `{ apiUrl, task }` | `{ data }` |
| PUT | `/api/softaware/tasks` | `{ apiUrl, task }` | `{ data }` |
| DELETE | `/api/softaware/tasks/{id}?apiUrl={url}` | — | `{ status, message }` |
| POST | `/api/softaware/tasks/reorder` | `{ apiUrl, orders }` | `{ success }` |
| GET | `/api/softaware/tasks/{id}/comments?apiUrl={url}` | — | `{ data: Comment[] }` |
| POST | `/api/softaware/tasks/{id}/comments` | `{ apiUrl, comment }` | `{ data }` |
| GET | `/api/softaware/tasks/{id}/attachments?apiUrl={url}` | — | `{ data: Attachment[] }` |
| POST | `/api/softaware/tasks/{id}/attachments` | `FormData { apiUrl, files }` | `{ data }` |
| DELETE | `/api/softaware/tasks/{id}/attachments?apiUrl={url}&filename={f}` | — | `{ success }` |
| GET | `/api/softaware/tasks/{id}/associations?apiUrl={url}` | — | `{ tasks }` |
| POST | `/api/softaware/tasks/{id}/associations` | `{ apiUrl, targetTaskId, type, notes }` | `{ success }` |

### 22.6 Updates

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/softaware/updates` | `{ updates: Update[] }` |
| POST | `/api/softaware/updates` | `{ update }` |
| PUT | `/api/softaware/updates/{id}` | `{ update }` |
| DELETE | `/api/softaware/updates?id={id}` | `{ success }` |

### 22.7 Clients

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/clients` | — | `{ clients: Client[] }` |
| PUT | `/api/clients` | `{ id, action, ...data }` | `{ success }` |
| DELETE | `/api/clients?id={id}` | — | `{ success }` |

Actions: `block`, `unblock`, `force_logout`, `send_message`

### 22.8 Chat / AI Sessions

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/chat/sessions` | — | `{ sessions: ChatSession[] }` |
| POST | `/api/chat/sessions` | `{ title, mode, working_directory }` | `{ session }` |
| GET | `/api/chat/sessions/{id}` | — | `{ session }` |
| PATCH | `/api/chat/sessions/{id}` | `{ title }` | `{ session }` |
| DELETE | `/api/chat/sessions/{id}` | — | `{ success }` |
| GET | `/api/chat/sessions/{id}/messages` | — | `{ messages: Message[] }` |
| POST | `/api/chat` | `{ session_id, content, mode, model }` | SSE stream |
| POST | `/api/chat/permission` | `{ permissionRequestId, decision }` | `{ success }` |
| POST | `/api/chat/sessions/import` | `{ data }` | `{ session }` |

### 22.9 Settings

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/settings/app` | `{ settings }` |
| POST | `/api/settings/app` | `{ success }` |

### 22.10 Publishing

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/publishing/repo-status` | `{ localPath }` | `{ currentBranch, branches, changedFiles, commits }` |
| POST | `/api/publishing/commit` | `{ localPath, message, files }` | `{ success }` |
| POST | `/api/publishing/push` | `{ localPath }` | `{ success }` |
| GET | `/api/files/browse?dir={path}` | — | `{ current, parent, items }` |
| PATCH | `/api/files/browse` | `{ oldPath, newPath }` | `{ success }` |
| DELETE | `/api/files/browse` | `{ path }` | `{ success }` |
| POST | `/api/publishing/remote-files` | `{ ...sshConfig, remotePath }` | `{ files }` |
| PATCH | `/api/publishing/remote-files` | `{ ...sshConfig, oldPath, newPath }` | `{ success }` |
| DELETE | `/api/publishing/remote-files` | `{ ...sshConfig, path }` | `{ success }` |
| POST | `/api/publishing/transfer` | `{ ...sshConfig, files[] }` | `{ success }` |

### 22.11 Database

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/database/connect` | `DatabaseConnection` | `{ success, connectionId }` |
| POST | `/api/database/disconnect` | `{ connectionId }` | `{ success }` |
| POST | `/api/database/test-connection` | `DatabaseConnection` | `{ success, message }` |
| POST | `/api/database/query` | `{ connectionId, sql }` | `{ columns, rows, rowCount, executionTime }` |
| POST | `/api/database/tables` | `{ connectionId }` | `{ tables: TableInfo[] }` |
| POST | `/api/database/structure` | `{ connectionId, table, schema? }` | `{ columns: ColumnInfo[] }` |
| POST | `/api/database/browse` | `{ connectionId, table, page, limit, schema? }` | `{ rows, total, page }` |

---

## 23. Notification & Polling System

### 23.1 Task Polling

In `useTasks` hook:
- Initial load: `GET /api/softaware/tasks?apiUrl={url}`
- Background poll every 30 seconds (configurable)
- On each poll, compare new tasks with previous state
- If a new task ID found: call `onTaskChanges([{ type: 'new', task }])`
- If a task's status changed: call `onTaskChanges([{ type: 'status_changed', task }])`

### 23.2 Browser Notifications

Request permission on first task load. Send a `new Notification(title, { body, tag })` for each change.

```typescript
if (Notification.permission === 'default') {
  Notification.requestPermission();
}
if (Notification.permission === 'granted') {
  new Notification('New Task', { body: task.title, tag: `task-new-${task.id}` });
}
```

### 23.3 Client Auto-Refresh

`useClients` hook polls `GET /api/clients` every 30 seconds.

### 23.4 Settings Polling

`AppShell` polls `GET /api/settings/app` every 5 seconds to keep the skip-permissions indicator in sync.

### 23.5 Heartbeat

`HeartbeatProvider` sends `POST /api/heartbeat` every 30 seconds to signal the user is active.

---

## 24. UI Component Library Reference

All components are from **shadcn/ui** (`components.json` configured). Import from `@/components/ui/...`.

| Component | File | Notes |
|-----------|------|-------|
| Alert / AlertDescription | `alert.tsx` | Use for warnings, errors |
| AlertDialog | `alert-dialog.tsx` | All confirmations |
| Badge | `badge.tsx` | Status chips, counts |
| Button | `button.tsx` | Variants: default, outline, ghost, destructive, secondary |
| ButtonGroup | `button-group.tsx` | Grouped toggle buttons |
| Calendar | `calendar.tsx` | Date picker calendar |
| Card / CardHeader / CardContent | `card.tsx` | Page sections |
| Checkbox | `checkbox.tsx` | Boolean toggles |
| Collapsible | `collapsible.tsx` | Expandable sections |
| Command | `command.tsx` | Combobox search |
| DateTimePicker | `date-time-picker.tsx` | Date + time selection |
| Dialog / DialogContent | `dialog.tsx` | Modals |
| DropdownMenu | `dropdown-menu.tsx` | Context menus |
| FileDropzone | `file-dropzone.tsx` | Drag-and-drop file upload |
| HoverCard | `hover-card.tsx` | Hover tooltips with rich content |
| Input | `input.tsx` | Text inputs |
| InputGroup | `input-group.tsx` | Input with prefix/suffix |
| Label | `label.tsx` | Form labels |
| Popover | `popover.tsx` | Floating popovers |
| RichTextEditor | `rich-text-editor.tsx` | Tiptap-based WYSIWYG |
| ScrollArea | `scroll-area.tsx` | Custom scrollbar |
| Select | `select.tsx` | Dropdown select |
| Separator | `separator.tsx` | Horizontal/vertical divider |
| Sheet | `sheet.tsx` | Slide-out panels |
| Spinner | `spinner.tsx` | Loading indicator |
| Switch | `switch.tsx` | Toggle switch |
| Table | `table.tsx` | Data tables |
| Tabs | `tabs.tsx` | Tab navigation |
| Textarea | `textarea.tsx` | Multiline text |
| Toast / Toaster | `toast.tsx`, `toaster.tsx` | Toast notifications |
| Tooltip | `tooltip.tsx` | `TooltipProvider` + `Tooltip` + `TooltipTrigger` + `TooltipContent` |

### 24.1 Button Size Classes

| Size | Class |
|------|-------|
| default | `h-9 px-4 py-2` |
| sm | `h-8 px-3` |
| lg | `h-10 px-8` |
| icon | `h-9 w-9` |
| icon-sm | `h-7 w-7` |
| icon-xs | `h-6 w-6` |

### 24.2 Toast Usage

```typescript
const { toast } = useToast();

// Success
toast({ title: 'Success', description: 'Action completed' });

// Error
toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });

// Warning
toast({ title: 'Warning', description: 'Check this', variant: 'destructive' });
```

### 24.3 Hugeicons Usage

```typescript
import { HugeiconsIcon } from "@hugeicons/react";
import { ClipboardIcon } from "@hugeicons/core-free-icons";

<HugeiconsIcon icon={ClipboardIcon} className="h-4 w-4" />
```

---

## 25. Additional Implementation Notes

### 25.1 Removing Electron Dependencies

The web version must completely replace these Electron-specific patterns:

| Desktop Pattern | Web Replacement |
|----------------|-----------------|
| `window.electronAPI.storage.getSession()` | `localStorage.getItem('auth_token')` |
| `window.electronAPI.storage.saveSession()` | `localStorage.setItem(...)` |
| `window.electronAPI.database.*` | `POST /api/database/...` REST calls |
| `window.electronAPI.showNotification()` | `new Notification(title, { body })` |
| `window.electronAPI.file.showOpenDialog()` | `<input type="file">` HTML element |
| Native title bar padding (44px on Windows) | Not needed |

### 25.2 Middleware for Route Protection

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
              || request.headers.get('Authorization')?.replace('Bearer ', '');
  
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  
  if (!token && !isAuthPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
```

### 25.3 PanelContext

Provides shared state for the chat panel system across components:

```typescript
interface PanelContextValue {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  panelContent: 'files';
  setPanelContent: (content: PanelContent) => void;
  workingDirectory: string;
  setWorkingDirectory: (dir: string) => void;
  sessionId: string;
  setSessionId: (id: string) => void;
  sessionTitle: string;
  setSessionTitle: (title: string) => void;
  streamingSessionId: string;
  setStreamingSessionId: (id: string) => void;
  pendingApprovalSessionId: string;
  setPendingApprovalSessionId: (id: string) => void;
}
```

### 25.4 LocalStorage Keys Reference

| Key | Purpose |
|-----|---------|
| `auth_token` | JWT authentication token |
| `user_data` | Serialized user object |
| `settings` | App settings JSON |
| `navExpanded` | NavRail expansion state |
| `tasksViewMode` | `'list'` or `'grid'` |
| `selectedTasksSoftware` | Last selected software object |
| `ftp_config` | SFTP configuration |
| `git_local_path` | Last git repo path |
| `ssh_key_content` | SSH private key content |
| `database_connections` | Array of DB connections |
| `software_token` | External software API token |

### 25.5 `cn()` Utility

Use the `cn` helper for conditional classNames:
```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 25.6 Time Format Helpers

```typescript
// Convert "HH:MM:SS" or decimal string to decimal hours
function timeToDecimal(t: string | number): number {
  const s = String(t).trim();
  if (!s.includes(':')) return parseFloat(s) || 0;
  const p = s.split(':');
  return parseInt(p[0]) + parseInt(p[1]) / 60 + (p[2] ? parseInt(p[2]) / 3600 : 0);
}

// Relative time string
function relativeDate(d?: string): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}
```

### 25.7 Rich Text Rendering

For `description` fields stored as HTML, always render with `dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}` with proper XSS sanitization (strip `<script>`, event handlers). Apply `prose prose-sm max-w-none` Tailwind typography classes.

### 25.8 Image Lightbox

When clicking an image in comments, attachments, or messages:
- Open a full-screen overlay (`fixed inset-0 bg-black/90 z-50`)
- Show the image centered with `max-w-[90vw] max-h-[90vh] object-contain`
- If multiple images in the current context, show prev/next arrow buttons
- Click outside or press Escape to close

---

*Document version: 1.0 — March 2026*  
*Source: Reverse-engineered from `/desktop/SoftAwareCode` Next.js + Electron application*
