# Bugs Module - Architecture Patterns

**Version:** 1.3.0  
**Last Updated:** 2026-03-11

---

## 1. Overview

This document catalogs the architecture patterns and anti-patterns found in the Bugs module.

---

## 2. Architectural Patterns

### 2.1 Optional Authentication Pattern

**Context:** The bugs system needs to accept reports from external users without accounts, while still capturing user identity for authenticated staff.

**Implementation:**

```typescript
const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
        (req as AuthRequest).userId = String((decoded as any).userId);
      }
    }
  } catch { /* invalid/expired token — proceed without userId */ }
  next();
};
```

**Benefits:**
- ✅ External reporters can submit bugs without registration
- ✅ Authenticated users still get `userId` captured for audit trail
- ✅ Notifications can target `created_by` when available

**Drawbacks:**
- ❌ No role-based access control — any user (or none) can CRUD all bugs
- ❌ Delete operations are not restricted to admins
- ❌ Cannot distinguish between "no token" and "expired token" from a business logic perspective

---

### 2.2 Fire-and-Forget Notification Pattern

**Context:** Notification delivery (in-app, push, email) should never block or fail the primary API response.

**Implementation:**

```typescript
function bugNotify(options: Parameters<typeof createNotification>[0]): void {
  createNotification(options).catch(err => console.error('[Bugs] Notification error:', err));
}

function bugEmail(options: Parameters<typeof sendEmail>[0]): void {
  sendEmail(options).catch(err => console.error('[Bugs] Email error:', err));
}
```

**Benefits:**
- ✅ API response is never delayed by FCM/SMTP latency
- ✅ Push/email failures don't cause 500 errors
- ✅ Simple pattern — no queue infrastructure needed

**Drawbacks:**
- ❌ No retry mechanism — failed notifications are silently lost
- ❌ Errors only visible in server logs (not monitored)
- ❌ No delivery guarantee — fire-and-forget by design

---

### 2.3 Dynamic SET Clause Pattern

**Context:** PUT endpoints accept partial updates — only provided fields should be updated.

**Implementation:**

```typescript
const allowed = [
  'title', 'description', 'current_behaviour', 'expected_behaviour',
  'reporter_name', 'software_id', 'software_name', 'status', 'severity',
  'assigned_to', 'assigned_to_name', 'resolution_notes',
  'resolved_at', 'resolved_by', 'linked_task_id',
];

const fields: string[] = [];
const values: any[] = [];

for (const key of allowed) {
  if (req.body[key] !== undefined) {
    fields.push(`${key} = ?`);
    values.push(req.body[key]);
  }
}

values.push(id);
await db.execute(`UPDATE bugs SET ${fields.join(', ')} WHERE id = ?`, values);
```

**Benefits:**
- ✅ Only updates provided fields — no overwriting nulls
- ✅ Parameterized — SQL injection safe
- ✅ Allowlist prevents arbitrary column updates

**Drawbacks:**
- ❌ No validation on field values (e.g., invalid status string still accepted by DB)
- ❌ No Zod schema — relies on MySQL constraints only
- ❌ Can set `status` and `workflow_phase` independently, allowing inconsistent states

---

### 2.4 Denormalised Names Pattern

**Context:** Bug rows store `assigned_to_name`, `created_by_name`, `reporter_name`, and `software_name` alongside their IDs.

**Implementation:**

```typescript
await db.insert(`
  INSERT INTO bugs (
    title, reporter_name, software_id, software_name,
    assigned_to, assigned_to_name, created_by, created_by_name, ...
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)
`, [title, reporter_name, software_id, software_name,
    assigned_to, assigned_to_name, req.userId, created_by_name]);
```

**Benefits:**
- ✅ Zero JOINs needed for list display — fast queries
- ✅ Names preserved even if user/software is deleted
- ✅ Simplifies frontend — no need to resolve IDs

**Drawbacks:**
- ❌ Names become stale if user changes their name
- ❌ `reporter_name` is free text (not a FK), so no user lookup possible
- ❌ Inconsistency risk — `software_name` could differ from `update_software.name`

---

### 2.5 Optimistic UI Update Pattern

**Context:** Inline status changes from the table row should feel instant.

**Implementation:**

```typescript
const handleStatusChange = async (bug: Bug, newStatus: string) => {
  if (bug.status === newStatus) return;
  // Optimistic update — change UI immediately
  setBugs(prev => prev.map(b => b.id === bug.id ? { ...b, status: newStatus as any } : b));
  try {
    await BugsModel.update(bug.id, { status: newStatus });
  } catch (err: any) {
    notify.error(err.message || 'Failed to update status');
    loadBugs(true);  // Revert — reload from server
  }
};
```

**Benefits:**
- ✅ Immediate visual feedback — no loading spinner
- ✅ Reverts on failure via full re-fetch
- ✅ Clean pattern — matches React conventions

**Drawbacks:**
- ❌ Brief inconsistency window between UI and server state
- ❌ Full re-fetch on error rather than targeted revert
- ❌ `as any` cast bypasses TypeScript type checking on the status value

---

### 2.6 Auth-Aware Blob URL Pattern (Frontend)

**Context:** Bug attachments are served via auth-gated endpoints. Standard `<img src>` tags can't attach Bearer tokens.

**Implementation:**

```typescript
const AttachmentImage: React.FC<{ att: BugAttachment; bugId: number }> = ({ att, bugId }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('authToken');
      const resp = await fetch(`${baseUrl}/api/bugs/${bugId}/attachments/${att.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await resp.blob();
      setBlobUrl(URL.createObjectURL(blob));
    };
    load();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [att.id]);

  return blobUrl ? <img src={blobUrl} /> : <Spinner />;
};
```

**Benefits:**
- ✅ Works with auth-gated download endpoints
- ✅ Blob URLs are revoked on unmount (memory-safe)
- ✅ Same pattern for images (inline display) and files (download/view)

**Drawbacks:**
- ❌ Extra network request per attachment (fetch → blob → URL)
- ❌ No caching — re-fetches on every mount
- ❌ Attachment download endpoint is actually public (auth not required), so this pattern is over-engineering

---

### 2.7 Correlated Subquery Pattern (List Query)

**Context:** The bug list needs comment count, attachment count, and last comment for each row.

**Implementation:**

```sql
SELECT b.*,
  (SELECT COUNT(*) FROM bug_comments WHERE bug_id = b.id) as comment_count,
  (SELECT COUNT(*) FROM bug_attachments WHERE bug_id = b.id) as attachment_count,
  (SELECT content FROM bug_comments WHERE bug_id = b.id ORDER BY created_at DESC LIMIT 1) as last_comment
FROM bugs b
ORDER BY FIELD(b.severity, 'critical', 'high', 'medium', 'low'), b.created_at DESC
LIMIT ? OFFSET ?
```

**Benefits:**
- ✅ Single query — avoids N+1 problem
- ✅ Correlated subqueries leverage indexes on `bug_id`
- ✅ Custom severity ordering via `FIELD()`

**Drawbacks:**
- ❌ 3 subqueries per row — performance degrades with large result sets
- ❌ `last_comment` fetches full content (could be large TEXT) for every row
- ❌ Could be replaced with LEFT JOIN + GROUP BY for better performance

---

### 2.8 Conditional Email Notification Pattern

**Context:** The `reporter_name` field is free text — not always an email address. Emails should only be sent when the reporter name happens to be an email.

**Implementation:**

```typescript
function isEmailAddress(str?: string | null): boolean {
  return !!str && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

// Usage:
if (isEmailAddress(bug.reporter_name)) {
  bugEmail({
    to: bug.reporter_name,
    subject: `[Bug #${id}] Status Changed: ${bug.title}`,
    html: `<p>Your bug report has been updated...</p>`,
  });
}
```

**Benefits:**
- ✅ Graceful degradation — emails sent only when possible
- ✅ No schema change needed — reuses existing `reporter_name` field
- ✅ Simple validation — no false positives on regular names

**Drawbacks:**
- ❌ Reporter email is not a dedicated field — conflates name with contact info
- ❌ Reporters with name-only entries never get email updates
- ❌ Should add a separate `reporter_email` field for proper email notifications

---

### 2.9 Role-Based Default Phase Filter (Frontend)

**Context:** Each user role maps to a workflow phase (developer → development, qa_specialist → quality_review, client_manager → intake). The Bugs and Tasks pages should pre-filter to show the user's relevant phase on first load.

**Problem:** The Zustand store's `user` object may not be hydrated when the `useState` initializer runs, because React component mount timing varies and store subscriptions resolve asynchronously.

**Implementation (two-layer approach):**

```typescript
// Layer 1: useState initializer — reads localStorage directly (always available)
const [phaseFilter, setPhaseFilter] = useState<string>(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (stored?.role?.slug || stored?.role_name || stored?.roles?.[0]?.slug || '').toLowerCase();
    switch (role) {
      case 'client_manager': return 'intake';
      case 'qa_specialist':  return 'quality_review';
      case 'developer':      return 'development';
      default:               return 'all';
    }
  } catch { return 'all'; }
});

// Layer 2: useEffect fallback — catches cases where localStorage was empty at mount
const phaseInitialized = useRef(false);
useEffect(() => {
  if (phaseInitialized.current || !user) return;
  const role = (user?.role?.slug || user?.role_name || (user as any)?.roles?.[0]?.slug || '').toLowerCase();
  const defaultPhase =
    role === 'client_manager' ? 'intake' :
    role === 'qa_specialist'  ? 'quality_review' :
    role === 'developer'      ? 'development' : null;
  if (defaultPhase) setPhaseFilter(defaultPhase);
  phaseInitialized.current = true;
}, [user]);
```

**Benefits:**
- ✅ Works regardless of store hydration timing
- ✅ `localStorage` read is synchronous — no flash of "all" before the correct filter
- ✅ Checks three role shapes: `role.slug`, `role_name`, `roles[0].slug`
- ✅ `useRef` flag prevents the effect from overwriting if user later manually changes the filter

**Applied in:** `Bugs.tsx`, `TasksPage.tsx` (identical pattern)

---

### 2.10 Branded Email Template Pattern (Backend)

**Context:** Bug notification emails were sent as raw `<p>` tags with no visual design, looking unprofessional in email clients.

**Implementation:** A single `bugEmailHtml()` helper function generates fully branded HTML emails. All 4 bug email sends call this function instead of inlining HTML.

```typescript
function bugEmailHtml(opts: {
  heading: string;          // Header text (e.g. "New Bug Report")
  preheader?: string;       // Hidden preheader for email clients
  severity?: string;        // Badge color: critical/high/medium/low
  bugId?: string | number;  // Shown as "#42" in header
  bugTitle?: string;        // Shown below heading
  blocks?: BugEmailBlock[]; // Detail rows: { label, value }[]
  bodyHtml?: string;        // Free-form HTML before details table
  footerText?: string;      // Override footer text
  ctaLabel?: string;        // Button text (e.g. "View Bug")
  ctaUrl?: string;          // Button URL
}): string { ... }
```

**Email structure:**
1. **Hidden preheader** — previewed in email clients
2. **Red gradient header** — 🐛 emoji + heading + bug ID + title + severity badge
3. **White body card** — intro paragraph + optional detail table + optional CTA button
4. **Gray footer** — configurable text + "Soft Aware © 2026"

**Emails using this template:**

| Email | Trigger | Recipient |
|-------|---------|-----------|
| New Bug Report | Bug created | Admin users |
| Bug Status Updated | Status changed | Reporter (if email) |
| New Comment | Comment added | Reporter (if email) |
| Workflow Phase Updated | Phase changed | Reporter (if email) |

**Benefits:**
- ✅ Consistent branding across all bug emails
- ✅ Single function to maintain — all emails stay in sync
- ✅ Severity color badge (critical=red, high=orange, medium=yellow, low=green)
- ✅ Detail table auto-filters empty values
- ✅ Follows email-safe inline CSS (no external stylesheets)

---

### 2.11 Async Loading State per Row (Frontend)

**Context:** When opening a bug detail, the API call to `BugsModel.getById()` causes a noticeable delay with no visual feedback.

**Implementation:** A `loadingBugId` state tracks which bug is being fetched. The `BugTableRow` component receives an `isLoading` prop to show feedback.

```typescript
// Parent (BugsPage)
const [loadingBugId, setLoadingBugId] = useState<number | null>(null);

const handleViewBug = async (bug: Bug) => {
  setLoadingBugId(bug.id);
  try {
    const res = await BugsModel.getById(bug.id);
    setDetailBug(res?.data?.bug || null);
  } catch { notify.error('Failed to load bug details'); }
  finally { setLoadingBugId(null); }
};

// Row
<BugTableRow isLoading={loadingBugId === bug.id} ... />
```

**Visual indicators:**
- Spinning `ArrowPathIcon` appears next to the bug title
- View button icon swaps from `EyeIcon` to spinning `ArrowPathIcon`
- Title button and View/Edit buttons are `disabled` during fetch

**Benefits:**
- ✅ Immediate visual feedback — no "dead click" feeling
- ✅ Prevents double-clicks (buttons disabled while loading)
- ✅ Per-row granularity — other rows remain interactive

---

## 3. Anti-Patterns Found

### 3.1 No Input Validation

**Description:** No Zod schemas or structured validation on any endpoint. Only `if (!title || !reporter_name)` checks exist.

**Impact:** 🟡 WARNING — Invalid data (wrong types, oversized strings, malformed HTML) passes through to the database. MySQL constraints are the only safety net.

**Recommended Fix:** Add Zod schemas for POST and PUT bodies, matching the profile.ts validation pattern.

**Effort:** 🟢 LOW

---

### 3.2 Status/Phase Desynchronisation

**Description:** Status and workflow_phase can be updated independently via `PUT /:id`. A bug could have `status='resolved'` but `workflow_phase='intake'`.

**Impact:** 🟡 WARNING — Inconsistent data displayed in the UI. Phase transitions auto-set status, but direct status changes don't update phase.

**Recommended Fix:** Either enforce status ↔ phase consistency in the update handler, or treat them as fully independent (document this decision).

**Effort:** 🟡 MEDIUM

---

### 3.3 No Permission Check on Destructive Operations

**Description:** Any user (authenticated or not) can delete bugs, comments, and attachments. No admin/owner verification.

**Impact:** 🔴 CRITICAL — Any external caller can delete production bug data.

**Recommended Fix:** Require authentication for DELETE operations. Add owner or admin check.

**Effort:** 🟡 MEDIUM

---

### 3.4 Public Attachment Download

**Description:** `GET /bugs/:id/attachments/:attId/download` has no authentication — anyone with the URL can download.

**Impact:** 🟡 WARNING — Sensitive attachments (screenshots, logs) are publicly accessible if the URL is guessed.

**Recommended Fix:** Add `requireAuth` to the download endpoint, or at minimum validate the bug/attachment IDs exist.

**Effort:** 🟢 LOW

---

### 3.5 Mixed `any` Types

**Description:** All database rows are typed as `any`. No runtime or compile-time type safety on query results.

**Impact:** 🟢 INFO (tech debt) — Typos in column names (`bug.assinged_to`) won't be caught by TypeScript.

**Recommended Fix:** Define row interfaces matching the DB schema and use them in `db.queryOne<BugRow>(...)`.

**Effort:** 🟡 MEDIUM
