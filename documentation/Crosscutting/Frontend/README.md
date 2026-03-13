# Crosscutting / Frontend Module

**Version:** 1.0.0  
**Last Updated:** 2026-03-12  
**Status:** ✅ Active — Shared frontend infrastructure

---

## Overview

The Crosscutting/Frontend module encompasses all shared infrastructure that powers the React SPA: the root application shell, layout system, reusable UI components, global state management, custom hooks, data-access models, service clients, and utility functions. Every page in the application depends on these shared layers.

**Total LOC:** ~8,400 across hooks, store, services, utils, models, and UI components (excluding pages).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx (Router + Route Definitions)                           │
│  ├── ProtectedRoute / AdminRoute / DeveloperRoute / PermRoute  │
│  ├── Layout.tsx (admin/staff sidebar + header + content)        │
│  └── PortalLayout.tsx (client portal variant)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ wraps
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Pages (90+ page components)                                    │
│  └── consume: hooks, store, models, UI/*, services              │
└───────────────────────────────┬─────────────────────────────────┘
                                │ imports
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌──────────┐   ┌──────────────┐   ┌──────────────┐
        │  Hooks    │   │  Models      │   │  Services    │
        │ (9 files) │   │ (20 files)   │   │ (8 files)    │
        └──────────┘   └──────────────┘   └──────────────┘
              │                 │                 │
              ▼                 ▼                 ▼
        ┌──────────┐   ┌──────────────┐   ┌──────────────┐
        │  Store   │   │  api.ts      │   │  Socket.IO   │
        │ (Zustand)│   │  (Axios)     │   │  (real-time) │
        └──────────┘   └──────────────┘   └──────────────┘
```

---

## Source Files

### Root (`src/`)

| File | LOC | Purpose |
|------|-----|---------|
| App.tsx | 213 | Root component — all route definitions, layout wrapping, auth guards |
| index.tsx | ~10 | React DOM entry point |
| index.css | ~20 | Tailwind CSS imports (`@tailwind base/components/utilities`) |
| setupProxy.js | ~10 | CRA dev proxy configuration |

### Layout (`components/Layout/`)

| File | LOC | Purpose |
|------|-----|---------|
| Layout.tsx | 545 | Main app shell — collapsible sidebar with sectioned navigation, top header (notifications, user menu, theme toggle), responsive mobile drawer. Sidebar sections: Main, Business, Finance, Reports, AI & Tools, Software, System |
| PortalLayout.tsx | ~120 | Client portal layout variant — simplified sidebar for non-admin users (assistants, sites, settings) |

### UI Components (`components/UI/`)

14 reusable components providing a consistent design language:

| File | LOC | Purpose |
|------|-----|---------|
| Button.tsx | 68 | Primary/secondary/danger button with loading state |
| Card.tsx | 27 | Container card with optional title |
| Input.tsx | 87 | Form input with label, error state, and help text |
| Select.tsx | 66 | Dropdown select with label and error state |
| Textarea.tsx | 64 | Multi-line text input with label and error state |
| DataTable.tsx | 420 | TanStack React Table wrapper — sorting, pagination, search, row click, empty state |
| BackButton.tsx | 44 | Navigate-back button with icon |
| CustomDatePicker.tsx | 74 | Date picker wrapper around react-datepicker |
| ThemeToggle.tsx | 47 | Dark/light theme toggle button |
| EmailModal.tsx | 292 | Send email dialog (recipient, subject, body, attachments) |
| PaymentModal.tsx | 281 | Record payment dialog (amount, method, reference) |
| PricingModal.tsx | 187 | Pricing tier selection modal |
| ItemPickerModal.tsx | 186 | Generic searchable item picker for line items |

### Standalone Components (`components/`)

| File | LOC | Purpose |
|------|-----|---------|
| ProtectedRoute.tsx | ~20 | Redirects unauthenticated users to `/login` |
| AdminRoute.tsx | ~25 | Requires `is_admin` or `is_staff` |
| DeveloperRoute.tsx | ~25 | Requires developer role |
| PermissionRoute.tsx | ~30 | Requires specific permission slug |
| PermissionSync.tsx | ~40 | Syncs role/permission data on login |
| Can.tsx | ~15 | Conditional render: `<Can permission="x">...</Can>` |
| TwoFactorSetup.tsx | ~120 | TOTP 2FA QR code setup and verification |
| MobileAuthQR.tsx | ~80 | Mobile app authentication QR code |
| RichTextEditor.tsx | ~100 | React Quill rich text editor wrapper |
| ExcalidrawDrawer.tsx | ~150 | Excalidraw whiteboard integration |
| KnowledgeHealthScore.tsx | ~80 | Assistant knowledge base health visualization |
| KnowledgeHealthBadge.tsx | ~40 | Compact health badge |
| TaskAttachmentsInline.tsx | ~80 | Inline file attachment viewer for tasks |
| TaskImageLightbox.tsx | ~60 | Full-screen image viewer for task attachments |

### Store (`store/`)

| File | LOC | Purpose |
|------|-----|---------|
| index.ts | 122 | Zustand global state — auth (user, jwt, permissions), contacts, quotations, invoices, pricing, categories, UI (sidebar, loading). Initializes from `localStorage` on load, disconnects Socket.IO on logout |

**State slices:**
- **Authentication**: `user`, `isAuthenticated`, `hasPermission()`, `logout()`
- **Contacts**: `contacts`, `customers`, `suppliers`
- **Quotations**: `quotations`, `currentQuotation`
- **Invoices**: `invoices`, `currentInvoice`
- **Pricing**: `pricingItems`
- **Categories**: `categories`
- **UI**: `sidebarOpen`, `loading`

### Hooks (`hooks/`)

| File | LOC | Purpose |
|------|-----|---------|
| useAuth.ts | 47 | Initializes auth state, handles silent token refresh |
| usePermissions.ts | 88 | RBAC permission checks: `can('contacts.view')`, `canAny([...])`, `isAdmin` |
| useModules.ts | 41 | Feature module toggle checks (enabled/disabled modules) |
| useAppSettings.ts | 91 | Loads and caches app settings (branding, SMTP config) |
| useLocalTasks.ts | 180 | Local task CRUD with optimistic updates and sync |
| useSoftware.ts | 37 | Software management state (selected software, loading) |
| useTasks.ts | 98 | Task management state and actions |
| useTheme.ts | 91 | Dark/light theme — persists to localStorage, applies `dark` class to `<html>` |
| useUpdateChecker.ts | 69 | Polls for platform updates, shows update banner |

### Models (`models/`)

20 model files providing TypeScript types and API methods per domain:

| File | LOC | Domain |
|------|-----|--------|
| AuthModel.ts | 398 | Login, register, 2FA, token refresh, mobile auth |
| SystemModels.ts | 627 | Users, roles, permissions, system settings CRUD |
| StaffChatModel.ts | 554 | Staff chat conversations, messages, calls, presence |
| AdminAIModels.ts | 506 | AI model config, credit management, enterprise endpoints |
| OtherModels.ts | 326 | Misc: updates, groups, software, dashboard stats |
| WebmailModel.ts | 267 | Webmail mailboxes, folders, messages, compose |
| PlanningModel.ts | 256 | Calendar events, sprint planning |
| LocalTasksModel.ts | 240 | Local task CRUD, sync, task sources |
| CredentialModel.ts | 161 | Credential vault CRUD |
| TeamChatModel.ts | 151 | Team chat messages and channels |
| BugsModel.ts | 147 | Bug tracking CRUD |
| CaseModel.ts | 132 | Case management CRUD |
| AdminAuditLogModel.ts | 126 | Audit log queries |
| NotificationModel.ts | 89 | Notification CRUD and preferences |
| QuotationModel.ts | 88 | Quotation API methods |
| InvoiceModel.ts | 88 | Invoice API methods |
| AppSettingsModel.ts | 80 | App settings get/update |
| ContactModel.ts | 81 | Contact API methods |
| TransactionModel.ts | 62 | Transaction API methods |
| index.ts | 83 | Barrel re-export of all models |

### Services (`services/`)

| File | LOC | Purpose |
|------|-----|---------|
| api.ts | 188 | Axios instance — base URL, JWT interceptor, silent 401 token refresh, retry queue |
| staffChatSocket.ts | 107 | Socket.IO client for staff 1:1 chat |
| teamChatSocket.ts | 105 | Socket.IO client for team/group chat |
| groupsSocket.ts | 107 | Socket.IO client for external groups chat |
| webrtcService.ts | 545 | WebRTC peer connection management — ICE, SDP, audio/video stream handling |
| chatCache.ts | 215 | Local message caching (IndexedDB/localStorage) for offline-first chat |
| chatOfflineQueue.ts | 153 | Offline message queue — stores outbound messages, replays on reconnect |
| pushNotifications.ts | 157 | Firebase FCM client — token registration, foreground notification handling |

### Utils (`utils/`)

| File | LOC | Purpose |
|------|-----|---------|
| formatters.ts | 93 | Number, date, currency formatters (ZAR locale) |
| notify.ts | 77 | Toast notification wrapper (`notify.success()`, `notify.error()`) |
| workflowPermissions.ts | 176 | Workflow-level permission checks (invoice approve, case assign, etc.) |
| totp.ts | 64 | TOTP 2FA client-side helpers |
| ringtone.ts | 63 | Audio playback management for incoming calls |
| softwareAuth.ts | 38 | Software token authentication utilities |

### Types (`types/`)

| File | LOC | Purpose |
|------|-----|---------|
| index.ts | ~200 | Global type definitions (Contact, Invoice, Quotation, Transaction, User, etc.) |
| cases.ts | ~50 | Case management types |
| updates.ts | ~40 | Software updates types |

---

## Key Patterns

### Routing

- **App.tsx** defines all routes using React Router v6 `<Routes>` / `<Route>`.
- Three layout wrappers: `<Layout>` (admin/staff), `<PortalLayout>` (client portal), none (public pages).
- Four route guards: `ProtectedRoute` (auth), `AdminRoute` (admin/staff), `DeveloperRoute` (developer role), `PermissionRoute` (specific permission slug).
- Smart home route: unauthenticated → `LandingPage`, admin/staff → `AdminDashboard`, regular → `PortalDashboard`.

### State Management

- **Zustand** single store for cross-page state (auth, contacts, invoices, etc.).
- JWT stored in `localStorage`, user object cached in `localStorage` for hydration.
- Socket.IO connections auto-disconnect on logout via `store.logout()`.
- Domain-specific state lives in hooks (`useLocalTasks`, `useTasks`) rather than the global store.

### Data Access (Model Pattern)

- Each domain has a Model class in `models/` that encapsulates API calls.
- Models export both TypeScript types (interfaces) and static API methods.
- Components import from models, not from `api.ts` directly.
- Example: `ContactModel.getAll()`, `AuthModel.login(email, password)`.

### API Client

- Single Axios instance with JWT `Authorization` header interceptor.
- **Silent token refresh**: On 401, the interceptor attempts a cookie-based `/auth/refresh` call, then retries the original request. Concurrent 401s are queued and replayed after refresh.
- `withCredentials: true` for HTTP-only refresh token cookies.

### Real-time (Socket.IO)

- Three Socket.IO client instances: `staffChatSocket`, `teamChatSocket`, `groupsSocket`.
- Each manages its own connection lifecycle (connect on mount, disconnect on cleanup).
- WebRTC signaling piggybacked on the staff chat socket for voice/video calls.
- `chatCache` and `chatOfflineQueue` provide offline-first messaging.

### Theming

- `useTheme` hook reads from `localStorage('theme')`, applies `dark` class to `<html>`.
- Tailwind `darkMode: 'class'` — all components use `dark:` variants.
- `ThemeToggle` component in the header switches and persists the preference.
