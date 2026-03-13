# Bugs Module - File Inventory

**Version:** 1.3.0  
**Last Updated:** 2026-03-11

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total files | 5 (+ notification service, email service, service worker) |
| Backend files | 2 |
| Frontend files | 3 |
| Total LOC | ~3,060 |

---

## 2. Backend Files

### 2.1 `backend/src/routes/bugs.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/routes/bugs.ts` |
| **LOC** | 1,046 |
| **Purpose** | Full bug tracking API: CRUD, workflow, comments, attachments, task association, notifications, branded email templates |
| **Exports** | `bugsRouter` (Express Router), `default` (same) |
| **Dependencies** | `express`, `multer`, `jsonwebtoken`, `path`, `fs`, `db/mysql`, `middleware/auth`, `config/env`, `services/notificationService`, `services/emailService` |

**Route Handlers:**

| Handler | Line | Method + Path | Description |
|---------|------|---------------|-------------|
| List bugs | ~124 | `GET /` | Paginated, filterable list with comment/attachment counts |
| Statistics | ~201 | `GET /stats` | Counts by status, severity, phase, software |
| Get single bug | ~237 | `GET /:id` | Detail with comments, attachments, linked_task |
| Create bug | ~275 | `POST /` | Insert + workflow comment + notify admins + email |
| Update bug | ~370 | `PUT /:id` | Dynamic SET + notify on status/assignee change |
| Delete bug | ~452 | `DELETE /:id` | Disk cleanup + CASCADE delete |
| Add comment | ~479 | `POST /:id/comments` | Insert + notify creator/assignee + email reporter |
| Delete comment | ~540 | `DELETE /:id/comments/:commentId` | Simple delete |
| Upload attachments | ~556 | `POST /:id/attachments` | Multer multi-upload (10 files, 20MB each) |
| Delete attachment | ~589 | `DELETE /:id/attachments/:attId` | Disk + DB delete |
| Download attachment | ~609 | `GET /:id/attachments/:attId/download` | `res.download()` |
| Workflow phase | ~632 | `PUT /:id/workflow` | Phase transition + notify + email (status unchanged) |
| Assign user | ~716 | `PUT /:id/assign` | Set assignee + notify |
| Link task | ~761 | `PUT /:id/link-task` | Link/unlink task |
| Convert to task | ~786 | `POST /:id/convert-to-task` | Bug → local_tasks row |
| Convert from task | ~858 | `POST /from-task/:taskId` | Task → bugs row |

**Internal Helpers:**

| Function | Line | Description |
|----------|------|-------------|
| `requireAuth` | ~45 | Optional JWT decode — sets `req.userId` if token present |
| `getAdminUsers()` | ~93 | Queries admin/super_admin users for notifications |
| `isEmailAddress()` | ~105 | Validates email format for conditional email notifications |
| `bugNotify()` | ~110 | Fire-and-forget in-app + push notification wrapper |
| `bugEmail()` | ~115 | Fire-and-forget email wrapper |
| `bugEmailHtml()` | ~130 | Branded HTML email template generator (heading, severity badge, detail table, CTA, footer) |
| `SEVERITY_EMAIL_COLORS` | ~118 | Severity → hex colors map for email badges |

**Constants:**

| Constant | Value | Description |
|----------|-------|-------------|
| `WORKFLOW_PHASES` | `['intake', 'qa', 'development']` | Valid workflow phases |
| `VALID_STATUSES` | `['open', 'in-progress', 'pending-qa', 'resolved', 'closed', 'reopened']` | Valid status values |
| `VALID_SEVERITIES` | `['critical', 'high', 'medium', 'low']` | Valid severity levels |

---

### 2.2 `backend/src/db/migrations/024_bugs_system.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/db/migrations/024_bugs_system.ts` |
| **LOC** | 141 |
| **Purpose** | Migration: creates `bugs`, `bug_comments`, `bug_attachments` tables |
| **Exports** | `up()`, `down()` |
| **Dependencies** | `db/mysql` |

**Functions:**

| Function | Description |
|----------|-------------|
| `up()` | Creates all 3 tables with indexes and foreign keys |
| `down()` | Drops tables in reverse order (attachments → comments → bugs) |

---

## 3. Frontend Files

### 3.1 `frontend/src/pages/general/Bugs.tsx`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/pages/general/Bugs.tsx` |
| **LOC** | 1,477 |
| **Purpose** | Main bugs page with embedded components: list, stats, forms, dialogs, attachment viewer |
| **Exports** | `BugsPage` (default React component) |
| **Dependencies** | `react`, `@heroicons/react/24/outline`, `sweetalert2`, `api`, `useAppStore`, `useSoftware`, `BugsModel`, `types`, `getBaseUrl`, `notify` |

**Embedded Components:**

| Component | Line | Description |
|-----------|------|-------------|
| `BugStatsBar` | ~92 | Counts: Open, Active, Pending QA, Resolved, Critical |
| `StatusSelect` | ~136 | Native `<select>`, color-coded by status value (6 statuses) |
| `BugTableRow` | ~157 | `<tr>` with severity badge, title, replies, phase, status select, actions |
| `AttachmentImage` | ~846 | Auth-aware image viewer (JWT → blob URL → `<img>`) with lightbox |
| `AttachmentFile` | ~939 | Auth-aware file handler (View in tab, Download via blob URL) |
| `BugsPage` (main) | ~294 | Page container: filters, table, create/edit/detail/workflow/link dialogs |

**Key State & Handlers:**

| Name | Type | Description |
|------|------|-------------|
| `bugs` | State | Array of Bug objects |
| `loadBugs()` | Callback | Fetches bugs via `BugsModel.getAll()` |
| `handleStatusChange()` | Handler | Optimistic inline status update |
| `handleDelete()` | Handler | SweetAlert confirm → `BugsModel.delete()` |
| `handleConvertToTask()` | Handler | SweetAlert confirm → `BugsModel.convertToTask()` |
| `filteredBugs` | Memo | Client-side filtering by status, severity, phase, search text |
| `statusFilter` | State | Filter dropdown value |
| `severityFilter` | State | Filter dropdown value |
| `phaseFilter` | State | Filter dropdown value (default set by user role via localStorage) |
| `phaseInitialized` | Ref | Prevents `useEffect` fallback from overwriting user-changed phase |
| `loadingBugId` | State | ID of bug currently being fetched (null when idle) — drives spinner on row |
| `softwareFilter` | State | Software dropdown (persisted to localStorage) |

**UI Constant Maps:**

| Map | Purpose |
|-----|---------|
| `SEVERITY_BADGE` | Badge classes per severity (bg + text + border) |
| `STATUS_COLORS` | Badge classes per status (6 statuses) |
| `STATUS_SELECT_CLS` | Select element classes per status |
| `PHASE_META` | Label, icon, and color per workflow phase |

---

### 3.2 `frontend/src/models/BugsModel.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/models/BugsModel.ts` |
| **LOC** | 148 |
| **Purpose** | API client for all `/bugs` endpoints |
| **Exports** | `BugsModel` (object with async methods) |
| **Dependencies** | `services/api` (Axios instance) |

**Methods:**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getAll(params?)` | GET | `/bugs` | List with pagination and filters |
| `getStats()` | GET | `/bugs/stats` | Bug statistics |
| `getById(id)` | GET | `/bugs/:id` | Single bug with comments + attachments |
| `create(data)` | POST | `/bugs` | Create bug |
| `update(id, data)` | PUT | `/bugs/:id` | Update bug |
| `delete(id)` | DELETE | `/bugs/:id` | Delete bug |
| `addComment(bugId, data)` | POST | `/bugs/:id/comments` | Add comment |
| `deleteComment(bugId, commentId)` | DELETE | `/bugs/:id/comments/:cid` | Delete comment |
| `uploadAttachments(bugId, files, uploadedBy?)` | POST | `/bugs/:id/attachments` | Multi-file upload (FormData) |
| `deleteAttachment(bugId, attId)` | DELETE | `/bugs/:id/attachments/:aid` | Delete attachment |
| `getAttachmentUrl(bugId, attId)` | — | — | Returns download URL string |
| `updateWorkflow(bugId, phase, userName?)` | PUT | `/bugs/:id/workflow` | Phase transition |
| `assign(bugId, data)` | PUT | `/bugs/:id/assign` | Assign/unassign |
| `linkTask(bugId, taskId)` | PUT | `/bugs/:id/link-task` | Link/unlink task |
| `convertToTask(bugId, userName?)` | POST | `/bugs/:id/convert-to-task` | Bug → Task |
| `convertFromTask(taskId, data)` | POST | `/bugs/from-task/:taskId` | Task → Bug |

---

### 3.3 `frontend/src/types/index.ts` (Bug-related interfaces)

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/frontend/src/types/index.ts` |
| **LOC** | ~60 lines of Bug-related types (within a 461-line file) |
| **Purpose** | TypeScript interfaces for Bug, BugComment, BugAttachment |
| **Exports** | `Bug`, `BugComment`, `BugAttachment` |

**Interfaces:**

| Interface | Fields | Description |
|-----------|--------|-------------|
| `Bug` | 26 fields + 3 computed + 3 populated | Main bug type with all DB + computed fields |
| `BugComment` | 8 fields | Comment with type discriminator |
| `BugAttachment` | 10 fields | Attachment metadata |

---

## 4. Supporting Files (Shared with Other Modules)

### 4.1 `backend/src/services/notificationService.ts`

| Property | Value |
|----------|-------|
| **Path** | `/var/opt/backend/src/services/notificationService.ts` |
| **LOC** | 69 |
| **Bug-specific additions** | `bug_created`, `bug_assigned`, `bug_updated`, `bug_comment`, `bug_resolved`, `bug_workflow` types |

### 4.2 `backend/src/services/emailService.ts`

| Property | Value |
|----------|-------|
| **Purpose** | SMTP email sending |
| **Used in bugs for** | Admin email on bug creation, reporter email on status/workflow/comment changes |

### 4.3 `frontend/public/firebase-messaging-sw.js`

| Property | Value |
|----------|-------|
| **Bug-specific additions** | `bug_` prefix routing in `buildDeepLink()`, tag grouping, and `notificationclick` handler — all route to `/bugs` |

---

## 5. File Relationship Map

```
024_bugs_system.ts ──── Migration (bugs + bug_comments + bug_attachments)
                              │
bugs.ts ────────────── /bugs/* API ──── Bugs.tsx
                              │              ↕ BugsModel.ts (API client)
                              │              ↕ types/index.ts (Bug, BugComment, BugAttachment)
                              │
                              ├── notificationService.ts (bug_* types → in-app + push)
                              ├── emailService.ts (SMTP on create/status/comments)
                              └── firebaseService.ts (FCM push delivery)
                                       │
                              firebase-messaging-sw.js (bug_* → /bugs deep link)
```

---

## 6. Test Files

No dedicated test files found for the Bugs module.
