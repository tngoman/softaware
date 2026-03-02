# Frontend Implementation Plan — Unified Web Application

Date: March 1, 2026
Owner: Frontend + API team
Revision: 2.0 — Includes SoftAwareCode desktop app migration

---

## 1) Objective

Build one consolidated product frontend in `/var/opt/frontend` with four clear sections:

1. **Billing section** — existing accounting, invoicing, contacts (already live)
2. **SoftAwareCode section** — migrate the desktop Electron app to web (`/softaware/*`)
3. **Client portal section** — self-service portal for SaaS customers (`/portal/*`)
4. **Admin section** — unified admin surface for all platform ops (`/admin/*`)

The SoftAwareCode desktop Electron app is being **discontinued**. Its full feature set must be recreated as web pages in `/var/opt/frontend`. The specification for this migration is `/var/opt/backend/documents/SOFTAWARECODE_WEB_APP_SPEC.md`.

**Before any feature pages are built**, the existing frontend must be properly integrated with the Node.js backend at `/var/opt/backend`. The frontend was originally designed for a PHP backend — several auth contracts and response shapes do not match the Node.js backend. These gaps must be closed first.

---

## 2) Source Apps Being Migrated

### 2.1 SoftAwareCode Desktop App (Primary New Scope)

Location: `/desktop/SoftAwareCode` (Electron + Next.js) — being discontinued.

Pages to migrate to web:
- Dashboard (role-based stats, task queue, bug tracker, pipeline)
- Tasks (CRUD, workflow phases, comments, attachments, AI tab, reordering)
- Software Management (software CRUD, modules, external API auth)
- Updates Management (release notes CRUD, download)
- Clients (real-time heartbeat monitoring, block/unblock/message)
- Users (user management with workflow roles)
- Groups (Socket.io real-time group chat)
- AI Sessions (Claude Code streaming SSE chat, file tree, tool calls)
- Extensions (Skills manager, MCP servers manager)
- Publishing (Git operations, local/remote SFTP file manager)
- Database Manager (MySQL/MSSQL connections, query editor, table browser)
- Settings (environment, API URLs, AI providers, approval threshold)

Spec tech stack (original): Next.js 15 App Router, shadcn/ui, Hugeicons, Socket.io, Tailwind v4
Target tech stack (actual): React 18 + CRA, `/var/opt/frontend` design system (Heroicons, TanStack Table), Tailwind v3, Zustand

### 2.2 UI SaaS Platform (Secondary Scope — Prior Plan)

Location: `/var/opt/ui` (React + Vite)
Admin features to migrate: Dashboard, Workspaces, Activation Keys, Subscriptions, Credits, Packages, Pricing, Configuration
Portal features to migrate: Assistants, Site Builder, Credits self-service, AI Model Settings, Portal Dashboard

### 2.3 Frontend Target App

Location: `/var/opt/frontend` (React 18 + CRA + TypeScript)
Already live: Billing, invoicing, quotations, contacts, accounting, reports, profile
Auth: Zustand store, `jwt_token` localStorage key, Axios in `src/services/api.ts`
Model pattern: Static model classes in `src/models/` — all API calls go through models
Design system: `src/components/UI/` — Button, Input, Select, DataTable, Card, etc.

### 2.4 Backend API Reality vs Spec

The SoftAwareCode spec was written assuming Next.js API routes proxying to a PHP backend. The actual backend is Node.js at `/var/opt/backend`. API paths differ significantly.

Complete API Mount Map (actual backend at `/var/opt/backend/src/app.ts`):

| Spec Path                      | Actual Backend Path         | Auth          | Status     |
|-------------------------------|-----------------------------|---------------|------------|
| /api/softaware/software       | /api/updates/software       | JWT (admin w) | Exists     |
| /api/softaware/updates        | /api/updates/updates        | JWT (admin w) | Exists     |
| /api/softaware/modules        | /api/updates/modules        | JWT (admin w) | Exists     |
| /api/clients                  | /api/updates/clients        | JWT + admin   | Exists     |
| /api/softaware/tasks*         | MISSING                     | —             | Build      |
| /api/heartbeat                | /api/updates/heartbeat      | software key  | Wrong auth |
| /api/chat/sessions*           | MISSING                     | —             | Build      |
| /api/chat (SSE)               | MISSING                     | —             | Build      |
| /api/groups (Socket.io)       | MISSING                     | —             | Build      |
| /api/skills*                  | MISSING                     | —             | Build      |
| /api/mcp*                     | /api/mcp                    | JWT           | Exists     |
| /api/publishing/repo-status   | /api/code/git (partial)     | X-API-Key     | Wrong auth |
| /api/files/browse*            | /api/files                  | None/key      | Check auth |
| /api/publishing/remote-files  | MISSING                     | —             | Build      |
| /api/database/*               | MISSING                     | —             | Build      |
| /api/settings/app             | MISSING (/updates/dashboard partial) | — | Build |
| /api/auth/login               | /api/auth/login             | —             | Format gap |
| /api/auth/me                  | MISSING (only /api/profile) | —             | Build      |
| /api/auth/logout              | MISSING                     | —             | Build      |
| /api/users CRUD               | MISSING                     | —             | Build      |

---

## 3) CRITICAL: Auth and Response Format Gaps

The existing frontend is NOT working with the Node.js backend due to these mismatches.

### 3.1 Login Response Format Mismatch

Frontend expects:
  { "success": true, "message": "...", "data": { "token": "...", "user": {...} } }

Backend actually returns:
  { "accessToken": "...", "token": "...", "user": { "id": "uuid", "email": "...", "name": "...", "role": "admin"|"client" } }

Fix: Update AuthModel.login() to map the backend's actual response shape.

### 3.2 Missing /auth/me Endpoint

Frontend calls: GET /auth/me expecting { success, message, data: { user: User } }
Backend has: GET /profile (different path, different response shape)

Fix: Add GET /auth/me in backend that returns data in the frontend's expected shape.

### 3.3 User Schema Mismatch

Frontend User type expects:
  { id: number, username: string, email, first_name, last_name,
    is_admin: boolean, is_active: boolean,
    role: { id, name, slug }, permissions: [{id, name, slug}] }

Backend User returns:
  { id: string (UUID), email, name, role: "admin"|"client" }

Missing: username, first_name, last_name, is_admin, is_active, permissions, proper role object.

Fix: The /auth/me endpoint must derive these fields:
  - username = email prefix (or email itself)
  - first_name / last_name = split from name
  - is_admin = team_members.role === 'ADMIN'
  - is_active = true (no inactive field exists yet)
  - role = { id: 1, name: 'Admin'|'User', slug: 'admin'|'user' }
  - permissions = [] or derived from team role

### 3.4 Token Key

Spec uses: auth_token, user_data
Backend returns: accessToken / token
Frontend uses: jwt_token

Decision: jwt_token is canonical. All SoftAwareCode pages will use the same auth context.

---

## 4) Target Information Architecture

### 4.1 Route Namespaces

Billing (existing, unchanged):
  / /dashboard /quotations/** /invoices/** /contacts/** /transactions/**
  /reports/** /pricing /categories /settings

SoftAwareCode (new):
  /softaware/dashboard  /softaware/tasks  /softaware/software
  /softaware/updates    /softaware/settings
  /clients  /users  /groups
  /chat     /chat/:id
  /extensions  /publishing  /database

Admin (from /var/opt/ui):
  /admin /admin/dashboard /admin/workspaces /admin/workspaces/:deviceId
  /admin/activation-keys /admin/subscriptions /admin/credits /admin/packages
  /admin/pricing /admin/config
  /admin/system/users /admin/system/roles /admin/system/permissions
  /admin/system/settings /admin/system/updates /admin/credentials

Portal (from /var/opt/ui):
  /portal /portal/assistants /portal/assistants/new
  /portal/assistants/:id/edit /portal/credits /portal/site-builder
  /portal/site-builder/new /portal/site-builder/:siteId
  /portal/settings /portal/ai-models

### 4.2 Layout Strategy

- MainLayout — existing billing layout (unchanged)
- SoftawareLayout — NavRail + Header, wraps all /softaware/*, /clients, /users, /groups, /chat, /extensions, /publishing, /database
- AdminLayout — admin-only shell with admin sidebar
- PortalLayout — client portal shell

---

## 5) Feature Mapping Matrix

### 5.1 SoftAwareCode Pages (From Desktop App — Spec)

| Page              | Route                   | Backend Path                    | P   | Backend Status |
|-------------------|-------------------------|---------------------------------|-----|----------------|
| Dashboard         | /softaware/dashboard    | /api/updates/dashboard          | P0  | Exists         |
| Tasks             | /softaware/tasks        | /api/softaware/tasks (new)      | P0  | Build proxy    |
| Software Mgmt     | /softaware/software     | /api/updates/software           | P0  | Exists         |
| Updates Mgmt      | /softaware/updates      | /api/updates/updates            | P0  | Exists         |
| Settings          | /softaware/settings     | /api/settings/app (new)         | P0  | Build          |
| Clients           | /clients                | /api/updates/clients            | P0  | Exists         |
| Users             | /users                  | /api/users (new)                | P0  | Build          |
| Groups            | /groups                 | Socket.io (new)                 | P1  | Build          |
| AI Sessions       | /chat  /chat/:id        | /api/chat/sessions (new)        | P1  | Build          |
| Extensions        | /extensions             | /api/mcp + /api/skills (new)    | P1  | Partial        |
| Publishing        | /publishing             | /api/code/git (partial)         | P2  | Partial        |
| Database Manager  | /database               | /api/database/* (new)           | P2  | Build          |

### 5.2 Admin Features (From /var/opt/ui — Prior Plan Unchanged)

| Page              | Route                      | Backend Path               | P   |
|-------------------|----------------------------|----------------------------|-----|
| Admin Dashboard   | /admin/dashboard           | /admin/stats               | P0  |
| Workspaces        | /admin/workspaces          | /admin/clients             | P0  |
| Activation Keys   | /admin/activation-keys     | /admin/activation-keys     | P0  |
| Subscriptions     | /admin/subscriptions       | /admin/subscription-plans  | P0  |
| Team Credits      | /admin/credits             | /admin/credits/balances    | P0  |
| Credit Packages   | /admin/packages            | /admin/credits/packages    | P0  |
| Pricing           | /admin/pricing             | /admin/credits/pricing     | P0  |
| Configuration     | /admin/config              | /admin/config/*            | P0  |
| System Users      | /admin/system/users        | /system/users              | P0  |
| System Roles      | /admin/system/roles        | /system/roles              | P0  |
| System Perms      | /admin/system/permissions  | /system/permissions        | P0  |
| System Settings   | /admin/system/settings     | /system/settings           | P0  |

### 5.3 Portal Features (From /var/opt/ui — Prior Plan Unchanged)

| Page              | Route                          | Priority |
|-------------------|--------------------------------|----------|
| Portal Dashboard  | /portal                        | P1       |
| Assistants        | /portal/assistants             | P1       |
| Create Assistant  | /portal/assistants/new         | P1       |
| Credits           | /portal/credits                | P1       |
| Site Builder      | /portal/site-builder           | P1       |
| AI Models         | /portal/ai-models              | P1       |
| Portal Settings   | /portal/settings               | P1       |

---

## 6) Backend Gaps — Ordered by Priority

### 6.1 P0 Critical (Blocks Frontend-Backend Integration)

1. GET /auth/me — returns User in frontend shape (derive is_admin, username, permissions)
2. POST /auth/login response shape fix — wrap in { success, message, data: { token, user } }
   OR update frontend AuthModel.login() to map the actual { accessToken, token, user } shape
3. POST /auth/logout — token invalidation (can be client-side only no-op initially)

### 6.2 P0 Required (Blocks SoftAwareCode Core Pages)

4. GET/POST/PUT/DELETE /users — SoftAwareCode user management with username, role, is_admin
5. GET/POST/PUT/DELETE /softaware/tasks (proxy) — forward to external PHP API at software.external_live_url
   Also: /softaware/tasks/:id/comments, /attachments, /associations, /reorder
6. POST /softaware/software/:id/authenticate — forward to external API
7. GET/POST /settings/app — environment mode, API URLs, notification prefs, AI providers
8. POST /heartbeat — browser session heartbeat (not client software heartbeat)

### 6.3 P1 Required (Blocks SoftAwareCode AI and Chat)

9.  GET/POST/DELETE/PATCH /chat/sessions
10. GET /chat/sessions/:id/messages
11. POST /chat — SSE Claude Code streaming
12. POST /chat/permission — resolve tool approval
13. GET/POST/PUT/DELETE /skills
14. Socket.io group chat server (group_list, message_history, new_message events)

### 6.4 P2 (Enhancements)

15. Generalize /code/git to accept dynamic localPath + switch to JWT auth
16. POST /publishing/remote-files, POST /publishing/transfer (SFTP)
17. POST /database/connect, /query, /tables, /browse, /structure
18. GET/POST/PUT/DELETE /admin/subscription-plans
19. Portal credits JWT auth reconciliation (/credits/balance, /credits/transactions)

---

## 7) Design System Mapping (shadcn/ui → Frontend)

The spec uses shadcn/ui. Map to existing frontend components:

| Spec Component    | Frontend Equivalent             | Action   |
|-------------------|---------------------------------|----------|
| Button            | components/UI/Button            | Use as-is |
| Input             | components/UI/Input             | Use as-is |
| Select            | components/UI/Select            | Use as-is |
| Textarea          | components/UI/Textarea          | Use as-is |
| Card              | components/UI/Card              | Use as-is |
| Table             | components/UI/DataTable         | Use as-is |
| Badge             | Build StatusBadge               | New       |
| Dialog            | Build Modal or use SweetAlert2  | New       |
| AlertDialog       | SweetAlert2 confirm             | Existing  |
| Tabs              | Build SectionTabs               | New       |
| Toast             | SweetAlert2 toast               | Existing  |
| Switch            | Build ToggleSwitch              | New       |
| RichTextEditor    | Build (Tiptap)                  | New       |
| FileDropzone      | Build                           | New       |

Icons: Spec uses Hugeicons. Replace with @heroicons/react equivalents (see Section 9.1).

New shared components to add to src/components/UI/:
- StatusBadge, StatCard, SectionTabs, EmptyState, ConfirmDialog
- RichTextEditor, ImageLightbox, FileDropzone

---

## 8) Data Layer

### 8.1 Token Keys — Canonical Mapping

| Context           | Key        | Decision              |
|-------------------|------------|-----------------------|
| All sections      | jwt_token  | Canonical — keep this |
| Spec (auth_token) | —          | Not used              |

### 8.2 New Model Classes to Build

SoftAwareCode models:
- SoftwareCatalogModel  — /updates/software CRUD
- UpdateReleasesModel   — /updates/updates CRUD
- SoftwareModulesModel  — /updates/modules CRUD
- ClientsModel          — /updates/clients list + actions
- TasksProxyModel       — /softaware/tasks* proxy calls
- AppSettingsModel      — /settings/app GET/POST
- ChatSessionModel      — /chat/sessions*
- SkillsModel           — /skills CRUD
- McpServerModel        — /mcp CRUD

Admin models (from prior plan):
- AdminWorkspaceModel, ActivationKeyModel, AdminCreditModel
- CreditPackageAdminModel, CreditPricingModel, AdminConfigModel

Portal models (from prior plan):
- PortalAssistantModel, PortalSiteBuilderModel, PortalCreditsModel

---

## 9) SoftAwareCode App Shell

### 9.1 NavRail Icon Map (Hugeicons → Heroicons)

| Label        | Heroicons Icon                   |
|--------------|----------------------------------|
| Dashboard    | ChartBarIcon                     |
| Tasks        | ClipboardDocumentListIcon        |
| Software     | FolderIcon                       |
| Updates      | ArrowPathIcon                    |
| Clients      | ComputerDesktopIcon              |
| Users        | UsersIcon                        |
| Groups       | ChatBubbleLeftRightIcon          |
| Settings     | Cog6ToothIcon                    |
| New Session  | PlusIcon                         |
| AI Sessions  | ChatBubbleLeftIcon               |
| Extensions   | Squares2X2Icon                   |
| Publishing   | CloudArrowUpIcon                 |
| Database     | CircleStackIcon                  |
| Menu toggle  | Bars3Icon                        |
| Logout       | ArrowRightOnRectangleIcon        |
| Dark mode    | MoonIcon / SunIcon               |

### 9.2 NavRail Behavior

- Collapsed (default): w-14 (56px), icons only, state in localStorage 'navExpanded'
- Expanded: w-48 (192px), icon + label text visible
- Active: bg-sidebar-accent (Tailwind var or gray-800/blue-900)
- Active detection: useLocation() from react-router-dom
- Two groups: Main nav items + DEVELOPMENT section
- Bottom: theme toggle + logout

### 9.3 ChatListPanel (chat routes only)

- Only visible on /chat and /chat/:id routes (lg+ screens)
- Width: w-60
- Sessions from GET /chat/sessions, grouped: Today / Yesterday / Last 7 Days / Older
- Delete session: DELETE /chat/sessions/:id
- Import: POST /chat/sessions/import

### 9.4 RightPanel (session detail only)

- Only on /chat/:id, lg+ screens
- Width: w-72
- FileTree component for working directory
- Session title editing via PATCH /chat/sessions/:id

---

## 10) Execution Phases

### Phase 0 — Backend Integration (NOW — 3-5 days)

Goal: Get the existing frontend authenticating and talking to the Node.js backend.

Backend:
- [ ] Add GET /auth/me returning User in frontend shape
- [ ] Fix POST /auth/login response (wrap in success/message/data) OR document the shape for frontend fix
- [ ] Add POST /auth/logout
- [ ] Confirm all existing billing API routes respond correctly (contacts, quotations, invoices, etc.)

Frontend:
- [ ] Update AuthModel.login() to handle { accessToken, token, user }
- [ ] Update AuthModel.me() to call /auth/me with correct response mapping
- [ ] Smoke test: login → persist → refresh → logout
- [ ] Fix any other 401/403 on existing protected billing routes

Deliverable: Existing billing section is fully functional end-to-end with Node.js backend.

### Phase 1 — SoftawareLayout + Route Scaffold (3-4 days)

- [ ] Create SoftawareLayout component (NavRail + Header)
- [ ] Add all /softaware/*, /clients, /users, /groups, /chat*, /extensions, /publishing, /database routes to App.tsx
- [ ] Placeholder page components per route
- [ ] NavRail with collapse/expand, active state, localStorage persistence
- [ ] Header with user dropdown and theme toggle

Deliverable: Full SoftAwareCode navigation shell is browsable.

### Phase 2 — SoftAwareCode Core Pages (1-1.5 weeks)

- [ ] Dashboard page — stats from /updates/dashboard, role-based stat cards
- [ ] Software Management — CRUD + modules tab + external auth dialog
- [ ] Updates Management — CRUD with rich text editor, download
- [ ] Clients page — real-time table, block/unblock/message, 30s auto-refresh
- [ ] App Settings page — environment mode, API URLs, AI providers

Deliverable: Core SoftAwareCode admin pages functional.

### Phase 3 — Tasks System (1.5-2 weeks)

Requires: backend task proxy endpoints built.

- [ ] Build /softaware/tasks/* backend proxy routes
- [ ] Tasks page (list + grid, all filters, search)
- [ ] TaskCard component (full spec implementation)
- [ ] TaskDialog (create/edit, rich text)
- [ ] TaskDetailsDialog (5 tabs: Details, Comments, Attachments, Associations, AI Chat)
- [ ] WorkflowDialog (phase assignment + permission checks)
- [ ] 30s task polling + browser notifications

Deliverable: Full task management operational.

### Phase 4 — Users + Groups shell (0.5-1 week)

- [ ] Build /users CRUD backend endpoints
- [ ] Users page (create/edit/delete, workflow roles)
- [ ] Groups page (basic layout; Socket.io deferred to Phase 9)
- [ ] UserProfileDialog

### Phase 5 — Admin Section from /var/opt/ui (1-1.5 weeks)

- [ ] AdminLayout component
- [ ] Add /admin/* namespace to App.tsx
- [ ] AdminDashboard, Workspaces, Activation Keys
- [ ] Credits, Packages, Pricing, Config
- [ ] Move system pages under /admin/system/*

### Phase 6 — AI Sessions + Extensions (1-1.5 weeks)

Requires: Claude streaming endpoint in backend.

- [ ] Build /chat/sessions backend + SSE streaming endpoint
- [ ] ChatListPanel, RightPanel with FileTree
- [ ] Chat new session + session detail pages
- [ ] MessageList, ToolCallBlock, StreamingMessage, CodeBlock components
- [ ] Extensions page — Skills + MCP Servers tabs

### Phase 7 — Publishing + Database (0.5-1 week)

- [ ] Generalize /code/git (dynamic path, JWT auth)
- [ ] Publishing page (Git Changes, History, Local Files, Remote SFTP)
- [ ] SFTP backend endpoints
- [ ] Database Manager page (Connection sidebar, Query Editor, Table Explorer)

### Phase 8 — Portal Parity (1-1.5 weeks)

- [ ] PortalLayout
- [ ] Portal Dashboard, Assistants, Create/Edit Assistant
- [ ] Credits self-service (resolve X-API-Key → JWT)
- [ ] Site Builder Dashboard/Editor
- [ ] AI Model Settings

### Phase 9 — Socket.io Groups + Hardening (0.5-1 week)

- [ ] Add Socket.io to backend + group chat events
- [ ] Complete Groups page (real-time messaging)
- [ ] QA: permission guards, route tests, API contract tests
- [ ] Backward compatibility redirects (/system/users → /admin/system/users, etc.)
- [ ] UAT + release

---

## 11) Work Backlog

### 11.1 Phase 0: Auth Integration (Start Now)

Backend:
- [ ] GET /auth/me — map profile data to frontend User shape
- [ ] POST /auth/logout
- [ ] Document login response shape

Frontend:
- [ ] Fix AuthModel.login() to map { accessToken, token, user }
- [ ] Fix AuthModel.me() to handle /auth/me response
- [ ] Smoke test full auth flow

### 11.2 SoftawareLayout Files to Create

- src/components/Layout/SoftawareLayout.tsx
- src/components/Layout/NavRail.tsx
- src/components/Layout/SoftawareHeader.tsx
- src/components/Layout/ChatListPanel.tsx
- src/components/Layout/RightPanel.tsx
- src/components/Layout/HeartbeatProvider.tsx
- src/components/Layout/ConnectionStatus.tsx
- src/components/Layout/TaskNotificationPoller.tsx

### 11.3 SoftAwareCode Pages to Create

- src/pages/softaware/Dashboard.tsx
- src/pages/softaware/Tasks.tsx + src/components/tasks/* (TaskCard, TaskDialog, TaskDetailsDialog, WorkflowDialog, TaskHoursModal, TaskAttachmentsInline, TaskAIChat)
- src/pages/softaware/Software.tsx + src/components/software/* (SoftwareCard, SoftwareDialog, ModulesTab, AuthenticateDialog)
- src/pages/softaware/Updates.tsx + UpdateDialog.tsx
- src/pages/softaware/Settings.tsx + ProviderManager.tsx, ProviderForm.tsx
- src/pages/Clients.tsx
- src/pages/Users.tsx (SoftAwareCode user management)
- src/pages/Groups.tsx
- src/pages/chat/index.tsx (new session)
- src/pages/chat/SessionDetail.tsx
- src/pages/Extensions.tsx
- src/pages/Publishing.tsx
- src/pages/Database.tsx + src/components/database/* (ConnectionDialog, ConnectionSidebar, QueryEditor, TableExplorer)

### 11.4 Shared Components to Add to src/components/UI/

- StatusBadge.tsx
- StatCard.tsx
- SectionTabs.tsx
- EmptyState.tsx
- RichTextEditor.tsx (Tiptap-based)
- ConfirmDialog.tsx
- ImageLightbox.tsx
- FileDropzone.tsx

Chat-specific components:
- src/components/chat/MessageList.tsx
- src/components/chat/MessageItem.tsx
- src/components/chat/ToolCallBlock.tsx
- src/components/chat/StreamingMessage.tsx
- src/components/chat/CodeBlock.tsx
- src/components/chat/MessageInput.tsx

Project components:
- src/components/project/FileTree.tsx
- src/components/project/FilePreview.tsx

### 11.5 Backend Endpoints to Build

Phase 0 (now):
- GET /auth/me
- POST /auth/logout
- Login response format fix

Phase 1 SoftAwareCode:
- GET/POST/PUT/DELETE /users
- GET/POST/PUT/DELETE /softaware/tasks (proxy + subresources)
- POST /softaware/software/:id/authenticate
- GET/POST /settings/app
- POST /heartbeat

Phase 2 AI + Chat:
- GET/POST/DELETE/PATCH /chat/sessions
- GET /chat/sessions/:id/messages
- POST /chat (SSE stream)
- POST /chat/permission
- GET/POST/PUT/DELETE /skills
- Socket.io server for groups

Phase 3 Publishing + DB:
- Generalize /code/git (dynamic path, JWT)
- POST /publishing/remote-files, POST /publishing/transfer
- POST /database/connect, /query, /tables, /browse, /structure

Phase 4 Admin + Portal:
- GET/POST/PUT/DELETE /admin/subscription-plans
- Portal credits JWT auth reconciliation

### 11.6 Model Classes to Build

- SoftwareCatalogModel, UpdateReleasesModel, SoftwareModulesModel
- ClientsModel, TasksProxyModel, AppSettingsModel
- ChatSessionModel, SkillsModel, McpServerModel
- AdminWorkspaceModel, ActivationKeyModel, AdminCreditModel
- CreditPackageAdminModel, CreditPricingModel, AdminConfigModel
- PortalAssistantModel, PortalSiteBuilderModel, PortalCreditsModel

---

## 12) Acceptance Criteria

Phase 0:
- Login with email/password stores JWT in jwt_token
- Page refresh rehydrates user via /auth/me without redirect
- 401 responses redirect to /login
- Existing billing pages load data correctly with Node.js backend

SoftAwareCode Section:
- All 12 pages accessible via /softaware/* and sibling routes
- NavRail collapse/expand works with localStorage persistence
- Tasks sync from external APIs via backend proxy
- Client status auto-refreshes every 30s
- Task notifications show as browser notifications

Admin Section:
- All admin capabilities from /var/opt/ui are in /admin/* only

Portal Section:
- All portal capabilities from /var/opt/ui are in /portal/* only

Technical:
- All API calls go through model classes
- All Electron-specific code removed (window.electronAPI → REST)
- jwt_token canonical key used throughout

---

## 13) Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Tasks proxy to external PHP APIs, auth token expiry | AuthenticateDialog re-auth flow |
| Claude Code SSE complexity | Implement in stages; use assistants chat as reference |
| Socket.io adds real-time infra | Use 30s polling first, upgrade to Socket.io later |
| Auth mismatch breaks existing billing pages | Phase 0 dedicated to this fix |
| External task API downtime | Graceful error + show AuthenticateDialog on 401 |
| Database manager SQL injection risk | Parameterized queries; user configures own DB connections |

---

## 14) Recommended Sprint Order

Sprint 0 (Now): Auth integration — backend /auth/me, login fix, frontend AuthModel. Billing working.
Sprint 1: SoftawareLayout scaffold + Dashboard + Software + Updates
Sprint 2: Clients page + task proxy backend + Tasks page core
Sprint 3: Task details (comments, attachments, workflow). Users page + backend.
Sprint 4: Admin layout + admin P0 pages from /var/opt/ui
Sprint 5: AI Sessions backend + chat pages + Extensions
Sprint 6: Portal parity + Groups (Socket.io or polled)
Sprint 7: Publishing + Database Manager
Sprint 8: QA hardening, redirects, release

---

## 15) Immediate Next Actions (Start Now)

1. Backend: Add GET /api/auth/me returning:
   { "success": true, "data": { "user": { "id": 1, "username": "user@email.com",
     "email": "user@email.com", "first_name": "John", "last_name": "Doe",
     "is_admin": true, "is_active": true,
     "role": { "id": 1, "name": "Admin", "slug": "admin" },
     "permissions": [{ "id": 1, "name": "All", "slug": "*" }] } } }

2. Frontend: Update AuthModel.login() to handle { accessToken, token, user } shape.

3. Frontend: Update AuthModel.me() response mapping.

4. Test: Login → refresh → logout end-to-end with Node.js backend.

5. Then: Begin Sprint 1 — SoftawareLayout scaffold.

---

## 16) Planning Documents Reference

- FRONTEND_UI_RECREATION_IMPLEMENTATION_PLAN.md — this document (v2.0)
- UI_TO_FRONTEND_FEATURE_MATRIX.md — file-level migration matrix for /var/opt/ui features
- SOFTAWARECODE_WEB_APP_SPEC.md — full SoftAwareCode specification
- FRONTEND_ADMIN_MIGRATION_PLAN.md — prior supplemental planning document

Status: Ready for Phase 0 execution.
