# Bugs Module

**Version:** 1.3.0  
**Last Updated:** 2026-03-11  
**Status:** ✅ Active — Bug tracking with workflow, notifications, and task integration

---

## 1. Purpose

The Bugs module provides a dedicated bug tracking system with a complete workflow pipeline, dual-channel notifications, and bidirectional task association. It is a **local-first** system — all data lives in MySQL (no external sync).

- **Staff/Admins** use the Bugs page to triage, assign, and track bugs through Intake → QA → Development
- **External reporters** can submit bugs via the API without authentication (optional auth via JWT)
- **Notifications** are sent via in-app + push (FCM) + email for all lifecycle events

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                            │
│                                                                  │
│  Bugs.tsx (~1,477 LOC) — Single-file page + embedded components  │
│  ┌───────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ BugStatsBar   │ │ BugTableRow  │ │ BugDetailDialog          │ │
│  │ • Open count  │ │ • Severity   │ │ • Tabbed: Comments /     │ │
│  │ • Active      │ │ • Table row  │ │   Attachments / Task     │ │
│  │ • Pending QA  │ │ • Phase btn  │ │ • AttachmentImage (blob) │ │
│  │ • Resolved    │ │ • Status ↓   │ │ • AttachmentFile (blob)  │ │
│  │ • Critical    │ │ • Actions    │ │ • Lightbox viewer        │ │
│  └───────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌──────────────┐ ┌─────────────────┐ ┌────────────────────────┐ │
│  │ StatusSelect │ │ WorkflowDialog  │ │ LinkTaskDialog          │ │
│  │ • Color-coded│ │ • Phase pipeline│ │ • Task search            │ │
│  │ • 6 statuses │ │ • Visual status │ │ • Link/unlink            │ │
│  └──────────────┘ └─────────────────┘ └────────────────────────┘ │
│                                                                  │
│  BugsModel.ts — API client (CRUD + workflow + comments + attach) │
│  types/index.ts — Bug, BugComment, BugAttachment interfaces      │
└──────────────────────────────────────────────────────────────────┘
               │ Axios (Bearer JWT)
┌──────────────┼───────────────────────────────────────────────────┐
│              ▼        BACKEND (Express)                           │
│                                                                  │
│  routes/bugs.ts (~1,046 LOC) — optionalAuth + email templates    │
│  ┌─ CRUD ──────────────────────────────────────────────────────┐ │
│  │ GET  /bugs              — List (paginated, filtered)        │ │
│  │ GET  /bugs/stats        — Statistics                        │ │
│  │ GET  /bugs/:id          — Detail + comments + attachments   │ │
│  │ POST /bugs              — Create  → notify admins + email   │ │
│  │ PUT  /bugs/:id          — Update  → notify creator/assignee │ │
│  │ DELETE /bugs/:id        — Delete  (cascade + disk cleanup)  │ │
│  ├─ COMMENTS ──────────────────────────────────────────────────┤ │
│  │ POST /bugs/:id/comments            — Add → notify parties   │ │
│  │ DELETE /bugs/:id/comments/:cid     — Delete                 │ │
│  ├─ ATTACHMENTS ───────────────────────────────────────────────┤ │
│  │ POST /bugs/:id/attachments         — Upload (multer, 20MB)  │ │
│  │ DELETE /bugs/:id/attachments/:aid  — Delete (file + row)    │ │
│  │ GET  /bugs/:id/attachments/:aid/download — Download         │ │
│  ├─ WORKFLOW ──────────────────────────────────────────────────┤ │
│  │ PUT  /bugs/:id/workflow            — Phase → notify + email │ │
│  │ PUT  /bugs/:id/assign             — Assign → notify         │ │
│  ├─ TASK ASSOCIATION ──────────────────────────────────────────┤ │
│  │ PUT  /bugs/:id/link-task           — Link/unlink task       │ │
│  │ POST /bugs/:id/convert-to-task     — Bug → Task             │ │
│  │ POST /bugs/from-task/:taskId       — Task → Bug             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  services/notificationService.ts — bug_* types → in-app + push  │
│  services/emailService.ts        — SMTP email on key events      │
│  services/firebaseService.ts     — FCM push delivery             │
└──────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       DATABASE (MySQL)                            │
│                                                                  │
│  bugs              — Main bug reports (20+ columns)               │
│  bug_comments      — User + system comments (CASCADE delete)      │
│  bug_attachments   — File attachments (CASCADE delete)            │
│  notifications     — In-app notifications (via notificationService)│
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Concepts

### 3.1 Status Lifecycle

```
  open → in-progress → pending-qa → resolved → closed
    ↑                                              │
    └──────────── reopened ←───────────────────────┘
```

| Status | Meaning | Colour |
|--------|---------|--------|
| `open` | New, untriaged | Blue |
| `in-progress` | Actively being worked on | Amber |
| `pending-qa` | Awaiting QA/QS verification | Indigo |
| `resolved` | Fix confirmed | Emerald |
| `closed` | Done, archived | Gray |
| `reopened` | Previously closed, issue recurred | Purple |

### 3.2 Workflow Phases

| Phase | Label |
|-------|-------|
| `intake` | Intake |
| `qa` | QA |
| `development` | Development |

Phase transitions update `workflow_phase` only (status is **not** changed) and log an automatic system comment.

### 3.3 Notification Channels

| Channel | Mechanism | Events Covered |
|---------|-----------|----------------|
| **In-app** | `notifications` DB table + real-time polling | All 6 trigger points |
| **Push** | FCM via `createNotificationWithPush()` | All 6 trigger points |
| **Email** | SMTP via `sendEmail()` | Create (admins), status change, workflow change, comments |

**Notification trigger points:**

| Event | Recipients (in-app + push) | Email Recipients |
|-------|---------------------------|-----------------|
| Bug created | All admins | All admin emails |
| Bug assigned | New assignee | — |
| Status changed | `created_by` + `assigned_to` | Reporter (if email-shaped name) |
| Workflow changed | `created_by` + `assigned_to` | Reporter (if email-shaped name) |
| Comment added | `created_by` + `assigned_to` | Reporter (if email-shaped name) |
| Assignee changed | New assignee | — |

### 3.4 Task Association

| Operation | Direction | Description |
|-----------|-----------|-------------|
| Link | Bug ↔ Task | Optional bidirectional reference (`linked_task_id`) |
| Convert Bug → Task | Bug → Task | Creates `local_tasks` row, sets `converted_to_task` |
| Convert Task → Bug | Task → Bug | Creates `bugs` row, sets `converted_from_task = 1` |

### 3.5 Authentication Model

The bugs route uses **optional authentication** — JWT is decoded if present but not required. This allows external bug reporters to submit without an account while still capturing `userId` for authenticated staff.

```typescript
const requireAuth = (req, _res, next) => {
  try {
    const token = req.header('authorization')?.slice(7);
    if (token) { req.userId = jwt.verify(token, env.JWT_SECRET).userId; }
  } catch { /* proceed without userId */ }
  next();
};
```

---

## 4. User Guide

### 4.1 Bug List Page

1. Navigate to **Bugs** in the sidebar
2. **Phase filter** is auto-set based on your role (Developer → Development, QA → Quality Review, Client Manager → Intake, Admin → All)
3. **Stats bar** shows Open, Active, Pending QA, Resolved, Critical counts
4. **Filters:** Status, Severity, Phase, Software dropdown, text search
4. **Table columns:** Severity, Title+Reporter, Replies, Phase, Status, Date, Actions
5. **Inline status change:** Click the colour-coded status dropdown on any row

### 4.2 Creating a Bug

1. Click **Report Bug** button
2. Fill required fields: Title, Reporter Name
3. Optional: Description, Current Behaviour, Expected Behaviour
4. Select Software from dropdown (remembered via localStorage)
5. Set Severity (default: Medium)
6. Optionally assign to a user
7. Click **Create** — bug starts in `open` / `intake`

### 4.3 Bug Detail Dialog

1. Click the **eye** icon or **Replies badge** on any row
2. **Comments tab:** View timeline of user + system comments, add new comments
3. **Attachments tab:** Upload files (max 20MB each, up to 10 at once), view images with lightbox, download files
4. **Task tab:** Link to existing task, convert bug → task

### 4.4 Workflow Management

1. Click the **Phase** button on a row → opens Workflow dialog
2. Select new phase: Intake → QA → Development
3. System logs a workflow comment (status is **not** changed — update status separately via the status dropdown)

### 4.5 Attachment Viewer

- **Images** (`image/*` MIME): Displayed as thumbnail grid with lightbox overlay
- **Files** (non-image): Listed with name, size, View/Download buttons
- All attachment fetches use JWT Bearer token → blob URL (auth-aware)

---

## 5. Features

| Feature | Status | Description |
|---------|--------|-------------|
| Bug CRUD | ✅ Active | Create, read, update, delete bugs |
| 6-status lifecycle | ✅ Active | open → in-progress → pending-qa → resolved → closed → reopened |
| 3-phase workflow | ✅ Active | Intake → QA → Development with auto-status |
| Comments system | ✅ Active | User + system comments, internal notes |
| File attachments | ✅ Active | Multi-upload, image lightbox, auth-aware blob URLs |
| Software association | ✅ Active | Dropdown with localStorage persistence |
| Task linking | ✅ Active | Bidirectional link, convert bug↔task |
| Pagination | ✅ Active | Server-side with configurable limit |
| Statistics endpoint | ✅ Active | Counts by status, severity, phase, software |
| In-app notifications | ✅ Active | All 6 lifecycle events |
| Push notifications | ✅ Active | FCM via service worker, deep links to /bugs |
| Email notifications | ✅ Active | Admin emails on create, reporter emails on updates |
| Inline status change | ✅ Active | Optimistic UI update from table row |
| Severity badges | ✅ Active | Color-coded: Critical (red), High (orange), Medium (yellow), Low (green) |
| Replies badge | ✅ Active | Blue badge showing comment count, clickable to open detail |
| Role-based default filter | ✅ Active | Phase filter auto-set by user role on page load (developer→development, qa→quality_review) |
| Branded email templates | ✅ Active | HTML emails with gradient header, severity badge, detail table, CTA button, branded footer |
| Bug loading indicator | ✅ Active | Spinning icon on row title and View button while bug detail is being fetched |

---

## 6. Security Considerations

- **Authentication:** Optional JWT — unauthenticated users can submit bugs, authenticated users get `userId` captured
- **Authorization:** No role-based permission check — any user (or none) can access all endpoints 🟡
- **SQL injection:** Parameterized queries throughout
- **File upload:** multer with 20MB limit, stored in `uploads/bugs/` with unique filenames
- **Attachment download:** Public endpoint (no auth required on download)
- **Notification safety:** All notification calls are fire-and-forget with try/catch — failures never block responses

---

## 7. Configuration

No module-specific configuration. Uses global settings from `env.ts`:

| Variable | Used For |
|----------|----------|
| `JWT_SECRET` | Token verification in optionalAuth |
| Database connection | MySQL queries |
| SMTP settings | Email notifications via emailService |
| FCM credentials | Push notifications via firebaseService |

---

## 8. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Attachments show broken images | `getBaseUrl()` was stripping `://api` instead of trailing `/api` | Fixed in v1.2.0 — now uses `replace(/\/api$/, '')` regex with `$` anchor |
| Phase filter shows "All" despite role | `user` store not hydrated when `useState` runs | Fixed in v1.2.0 — reads `localStorage` directly + `useEffect` fallback |
| Bug→task disappears after sync | Sync soft-deleted tasks with non-numeric `external_id` | Fixed in v1.2.0 — sync skips local-only tasks (`external_id REGEXP '^[0-9]+$'`) |
| Status not updating | Optimistic update failed silently | Check network tab for API error, verify bug still exists |
| Notifications not received | FCM token expired or user not subscribed | Check `notifications` table for row, verify FCM registration |
| "Bug not found" on detail | Bug deleted by another user | Refresh list |
| Phase change not updating status | Phase transitions no longer change status (by design since v1.3.0) | Change status separately via the status dropdown |
| Email not sent | Reporter name is not an email address | Only fires when `isEmailAddress()` returns true |
| Convert to task fails | No `task_sources` row in DB | Register at least one task source |

---

## 9. Related Modules

- [Tasks](../Tasks/README.md) — Task management system (bidirectional conversion)
- [Notifications](../Notifications/README.md) — In-app + push notification infrastructure
- [Software](../Software/README.md) — Software products (bug association)
- [Cases](../Cases/README.md) — Similar pattern: CRUD + workflow + notifications
