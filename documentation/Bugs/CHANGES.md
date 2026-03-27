# Bugs Module - Changelog & Known Issues

**Version:** 1.3.0  
**Last Updated:** 2026-03-11

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-27 | 1.5.0 | Bug notifications now only sent to admins with the developer role (not all admins) |
| 2026-03-15 | 1.4.0 | Added AI-Assisted Bug Resolution via staff Personal Assistant |
| 2026-03-11 | 1.3.0 | Branded email templates, bug loading indicator, workflow phase no longer resets status |
| 2026-03-11 | 1.2.0 | Role-based default phase filter, `getBaseUrl()` regex fix, bug→task sync protection |
| 2026-03-11 | 1.1.0 | Added `pending-qa` status, full notification wiring (in-app + push + email), optional JWT auth, documentation |
| 2026-03-10 | 1.0.3 | Replies badge column (blue `bg-blue-600` count badge) |
| 2026-03-10 | 1.0.2 | Attachment viewer: auth-aware blob URLs, image lightbox, file View/Download |
| 2026-03-10 | 1.0.1 | Redesigned list: `<table>` with `BugTableRow`, native color-coded `<select>` for status |
| 2026-03-09 | 1.0.0 | Initial bugs system: migration 024, backend routes, frontend page, BugsModel |

---

## 2. Known Issues

### 2.1 🔴 CRITICAL — No Permission Check on Destructive Operations

- **Status:** OPEN
- **Module File:** `backend/src/routes/bugs.ts` — DELETE routes
- **Description:** Any caller (authenticated or not) can delete bugs, comments, and attachments. No admin or owner verification exists.
- **Impact:** Malicious or accidental deletion of production bug data.
- **Recommended Fix:** Add real `requireAuth` (mandatory, not optional) to DELETE operations. Add owner or admin check: `if (req.userId !== bug.created_by && !isAdmin) return 403`.
- **Effort:** MEDIUM

### 2.2 🔴 CRITICAL — Public Attachment Download Endpoint

- **Status:** OPEN
- **Module File:** `backend/src/routes/bugs.ts` — `GET /:id/attachments/:attId/download`
- **Description:** The download endpoint has no authentication at all. Anyone who knows (or guesses) the bug ID and attachment ID can download files.
- **Impact:** Sensitive screenshots, logs, or documents exposed to unauthenticated access.
- **Recommended Fix:** Add `requireAuth` middleware. The frontend already sends Bearer tokens via blob URL fetch.
- **Effort:** LOW (1 line)

### 2.3 🟡 WARNING — Status/Phase Desynchronisation Possible

- **Status:** OPEN
- **Module File:** `backend/src/routes/bugs.ts` — `PUT /:id`
- **Description:** Status and workflow_phase can be set independently. A `PUT` with `{ "status": "resolved" }` doesn't update `workflow_phase`, potentially leaving a bug in `intake` phase with `resolved` status.
- **Impact:** UI shows inconsistent state. Phase-based filters may show resolved bugs.
- **Recommended Fix:** Either auto-update phase on status change (reverse of what workflow does) or add validation to prevent inconsistent combinations.
- **Effort:** MEDIUM

### 2.4 🟡 WARNING — No Input Validation

- **Status:** OPEN
- **Module File:** `backend/src/routes/bugs.ts` — POST and PUT handlers
- **Description:** Only basic null checks exist (`if (!title || !reporter_name)`). No Zod schemas, no max length enforcement, no type validation.
- **Impact:** Invalid data stored in DB. Only MySQL constraints prevent bad data.
- **Recommended Fix:** Add Zod schemas for create/update payloads matching the pattern used in `profile.ts`.
- **Effort:** LOW

### 2.5 🟡 WARNING — `reporter_name` Is Not a Separate Email Field

- **Status:** OPEN (design limitation)
- **Module File:** `backend/src/routes/bugs.ts`, migration 024
- **Description:** The `reporter_name` field is used for both the reporter's display name and (if email-shaped) their email address. Email notifications only fire when `isEmailAddress(reporter_name)` returns true.
- **Impact:** Reporters entered by name ("John Doe") never receive email notifications about their bug.
- **Recommended Fix:** Add a `reporter_email` column to the `bugs` table. Populate from a separate form field. Always send email when set.
- **Effort:** MEDIUM (schema change + frontend form update)

### 2.6 🟡 WARNING — Correlated Subqueries in List Query

- **Status:** OPEN (performance)
- **Module File:** `backend/src/routes/bugs.ts` — `GET /`
- **Description:** The list query includes 3 correlated subqueries per bug (comment_count, attachment_count, last_comment). With indexes, this works for moderate data, but degrades at scale.
- **Impact:** Slow list load with hundreds of bugs.
- **Recommended Fix:** Replace with LEFT JOIN + GROUP BY, or materialise counts in the `bugs` table.
- **Effort:** MEDIUM

### 2.7 🟢 INFO — Attachment Download Over-Engineering on Frontend

- **Status:** OPEN (tech debt)
- **Module File:** `frontend/src/pages/general/Bugs.tsx` — `AttachmentImage`, `AttachmentFile`
- **Description:** The frontend fetches attachments with Bearer token via blob URLs, but the download endpoint is actually public (no auth required).
- **Impact:** Unnecessary complexity. Extra network latency per attachment.
- **Recommended Fix:** Either add auth to the download endpoint (recommended) or simplify frontend to use direct URLs.
- **Effort:** LOW

### 2.8 🟢 INFO — Mixed `any` Types Throughout

- **Status:** OPEN (tech debt)
- **Module File:** `backend/src/routes/bugs.ts` — all handlers
- **Description:** All DB query results are typed as `any`. No compile-time safety on column access.
- **Impact:** Typos and incorrect column references not caught by TypeScript.
- **Recommended Fix:** Define `BugRow`, `BugCommentRow`, `BugAttachmentRow` interfaces.
- **Effort:** MEDIUM

### 2.9 🟢 INFO — No Soft Delete

- **Status:** OPEN (feature gap)
- **Module File:** `backend/src/routes/bugs.ts` — `DELETE /:id`
- **Description:** Bug deletion is permanent (hard delete with CASCADE). No recycle bin or undo.
- **Impact:** Accidental deletion cannot be recovered.
- **Recommended Fix:** Add `deleted_at DATETIME NULL` column, filter in queries, add restore endpoint.
- **Effort:** MEDIUM

---

## 3. Migration Notes

### From v1.0.x to v1.1.0

No schema migration required. Changes are:

1. **`pending-qa` status** — The `status` column is `VARCHAR(50)`, so `'pending-qa'` works without DDL changes. Frontend type union and colour maps were updated.

2. **Notification wiring** — Added imports for `notificationService` and `emailService` to `bugs.ts`. Extended `notificationService.ts` type union with `bug_*` types.

3. **Service worker** — Added `bug_` prefix routing in `firebase-messaging-sw.js` (3 locations: `buildDeepLink`, tag grouping, `notificationclick`).

4. **Optional auth** — Replaced no-op `requireAuth` with JWT decode. `req.userId` is now populated when token is present.

### From v1.1.0 to v1.2.0

No schema migration required. Changes are:

1. **Role-based default phase filter** — Both `Bugs.tsx` and `TasksPage.tsx` now read `localStorage('user')` directly in the `useState` initializer to set the phase filter based on the user's role (`developer` → `development`, `qa_specialist` → `quality_review`, `client_manager` → `intake`). A `useEffect` fallback covers cases where the user store isn't hydrated yet.

2. **`getBaseUrl()` regex fix** — `config/app.ts` `getBaseUrl()` changed from `.replace('/api', '')` to `.replace(/\/api$/, '')`. The plain string replace was matching the `/api` inside `://api.softaware.net.za` instead of the trailing `/api` path, producing a broken URL (`https:/.softaware.net.za/api`).

3. **Bug→task sync protection** — `taskSyncService.ts` now skips local-only tasks (non-numeric `external_id` like `bug-7-xxx`) during push and soft-delete phases. Previously, the sync pushed with `NaN` task_id, cleared `local_dirty`, then soft-deleted the task on next pull because the remote didn't know about it.

### From v1.2.0 to v1.3.0

No schema migration required. Changes are:

1. **Branded email templates** — Added `bugEmailHtml()` helper function in `bugs.ts` that generates fully branded HTML emails with a red gradient header, bug ID/title/severity badge, detail table, CTA button, and branded footer. All 4 email sends (new bug, status change, comment, workflow phase) now use this template instead of raw `<p>` tags.

2. **Bug loading indicator** — Added `loadingBugId` state in `Bugs.tsx`. When a bug is opened (view or edit), the row shows a spinning icon next to the title and on the View action button. The title and View/Edit buttons are disabled during fetch to prevent double-clicks.

3. **Workflow phase no longer resets status** — Removed the auto-status logic from `PUT /:id/workflow` that was overwriting `status` to `open` (intake) or `in-progress` (qa/development) on every phase change. The endpoint now only updates `workflow_phase`.

---

### DDL for Future `reporter_email` Column

```sql
ALTER TABLE bugs ADD reporter_email VARCHAR(255) NULL
  COMMENT 'Dedicated email address for bug reporter'
  AFTER reporter_name;
```

---

## 4. Future Enhancements

| Enhancement | Priority | Effort | Description |
|------------|----------|--------|-------------|
| `reporter_email` field | 🔴 HIGH | MEDIUM | Separate email column for reliable email notifications |
| Auth on DELETE routes | 🔴 HIGH | LOW | Require authentication and admin check for destructive operations |
| Auth on attachment download | 🔴 HIGH | LOW | Add `requireAuth` to prevent public access |
| Zod validation schemas | 🟡 MEDIUM | LOW | Structured input validation on create/update |
| Status ↔ phase consistency | 🟡 MEDIUM | MEDIUM | Enforce or validate consistent status/phase pairs |
| Typed DB rows | 🟡 MEDIUM | MEDIUM | Replace `any` with proper interfaces |
| Soft delete | 🟡 MEDIUM | MEDIUM | `deleted_at` column instead of hard delete |
| Bug activity log | 🟡 MEDIUM | MEDIUM | Track all changes (who changed what, when) |
| ~~Email templates~~ | ✅ DONE | — | Branded HTML email templates via `bugEmailHtml()` (v1.3.0) |
| Performance: list query | 🟢 LOW | MEDIUM | Replace correlated subqueries with JOIN or materialised counts |
| Bulk status update | 🟢 LOW | LOW | Select multiple bugs → change status/assignee |
| Export bugs (CSV/PDF) | 🟢 LOW | MEDIUM | Downloadable report of filtered bug list |
| Duplicate detection | 🟢 LOW | MEDIUM | Warn when title is similar to existing bug |
| SLA tracking | 🟢 LOW | MEDIUM | Track time-to-resolve by severity |
| Webhooks on events | 🟢 LOW | LOW | Trigger external webhooks on bug lifecycle events |
