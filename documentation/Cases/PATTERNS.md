# Cases — Patterns & Anti-Patterns

## Architectural Patterns

### 1. `mapCaseRow()` Field Mapping Layer
**Pattern**: Centralized function that transforms raw DB rows into frontend-expected shapes. Handles field renaming, default values, and JSON parsing.

```typescript
function mapCaseRow(row: any, aiOverride?: any) {
  return {
    ...row,
    category: row.category || 'other',
    source: row.source || deriveFromType(row.type),
    user_rating: row.rating ?? null,        // rating → user_rating
    user_feedback: row.rating_comment ?? null, // rating_comment → user_feedback
    page_url: row.url ?? null,              // url → page_url
    ai_analysis: aiOverride !== undefined ? aiOverride : safeJson(row.ai_analysis, null),
    metadata: safeJson(row.metadata, {}),
    tags: safeJson(row.tags, []),
    browser_info: safeJson(row.browser_info, {}),
  };
}
```

**Benefit**: Single source of truth for DB→API field mapping. Frontend never sees raw DB column names.  
**Trade-off**: Function is duplicated in both `cases.ts` and `adminCases.ts` — should be extracted to shared utility.

---

### 2. `safeJson()` JSON Column Parser
**Pattern**: Safely handles MySQL JSON columns that may be already-parsed objects, JSON strings, or NULL.

```typescript
function safeJson(val: any, fallback: any = null) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
```

**Benefit**: Prevents `JSON.parse(undefined)` crashes; handles MySQL driver inconsistencies where JSON columns may arrive as strings or objects depending on the driver version.  
**Trade-off**: Also duplicated across both route files.

---

### 3. COALESCE Name Fallback
**Pattern**: All user name JOINs use `COALESCE(u.name, u.email)` to fall back to email when name is NULL.

```sql
SELECT c.*, COALESCE(u.name, u.email) AS reported_by_name,
       COALESCE(a.name, a.email) AS assigned_to_name
FROM cases c
LEFT JOIN users u ON c.reported_by = u.id
LEFT JOIN users a ON c.assigned_to = a.id
```

**Benefit**: Never shows "Unknown User" — always resolves to at least an email address.  
**Frontend safeguard**: `CaseDetailView.tsx` checks `reporter_email !== reporter_name` before showing email subtitle to avoid duplication when COALESCE falls back to email.

---

### 4. Composite Detail Response
**Pattern**: `GET /cases/:id` returns case header, all comments, and activity log in a single response.

```typescript
const caseData = await db.queryOne(...);
const comments = await db.query(...);
const activity = await db.query(...);
res.json({ success: true, case: mapCaseRow(caseData), comments, activity });
```

**Benefit**: Single API call to render full case detail page.  
**Trade-off**: 4 sequential DB queries (case, access check, comments, activity) — could use `Promise.all()` after the access check.

---

### 5. Role-Based Access Control
**Pattern**: Case detail and update routes check access via reporter match OR admin role check.

```typescript
const isAdmin = await db.queryOne(
  `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
   WHERE ur.user_id = ? AND r.slug IN ('admin', 'super_admin')`, [userId]
);
if (caseData.reported_by !== userId && !isAdmin) {
  return res.status(403).json({ success: false, error: 'Access denied' });
}
```

**Benefit**: Reporters can view/edit their own cases; admins can access all.  
**Trade-off**: Separate DB query for role check on every request — could cache user role in JWT claims.

---

### 6. Activity Audit Trail
**Pattern**: Every state change generates an activity log entry with old and new values.

```typescript
activities.push({ action: 'status_changed', old: existing.status, new: data.status });
// ...
for (const activity of activities) {
  await db.execute(
    'INSERT INTO case_activity (id, case_id, user_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), caseId, userId, activity.action, String(activity.old || ''), String(activity.new), now]
  );
}
```

**Benefit**: Full audit trail for compliance and debugging.  
**Actions logged**: `created`, `status_changed`, `severity_changed`, `assigned`, `commented`, `rated`

---

### 7. Cascading Hard Delete
**Pattern**: Case deletion manually deletes child records before deleting the case.

```typescript
await db.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
await db.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
await db.execute('DELETE FROM cases WHERE id = ?', [caseId]);
```

**Rationale**: No FK CASCADE constraints in the schema — application handles orphan cleanup.  
**Trade-off**: Not wrapped in a transaction — if the final DELETE fails, orphaned comments/activity are already deleted.

---

### 8. Internal vs Public Comments
**Pattern**: Comments have an `is_internal` flag. Non-admin users only see public comments.

```typescript
let commentsQuery = 'SELECT cc.* FROM case_comments cc WHERE cc.case_id = ?';
if (!isAdmin) {
  commentsQuery += ' AND cc.is_internal = FALSE';
}
```

**Benefit**: Staff can have private discussions on cases without exposing them to reporters.

---

### 9. Notification Lifecycle Events
**Pattern**: Case lifecycle events trigger targeted notifications via `notificationService`.

| Event | Recipients | Notification Type |
|-------|-----------|-------------------|
| Case created | All admins | `case_created` |
| Status changed | Reporter (if changed by someone else) | `case_updated` |
| Case assigned | Assignee | `case_assigned` |
| Comment added | Reporter (if not internal, not self-comment) | `case_comment` |

---

### 10. Frontend Config Objects
**Pattern**: Status, severity, and category visual configs are defined as typed Record objects.

```typescript
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  // ...
};
```

**Benefit**: Centralized visual configuration; easy to add new statuses.  
**Trade-off**: Duplicated across CasesList.tsx and CaseDetailView.tsx — should be extracted to shared constants.

---

### 11. In-Memory Failure Tracking (Health Monitor)
**Pattern**: Health monitor maintains failure state in-memory rather than relying solely on the database.

```typescript
// In-memory state that survives DB outages
const apiErrors: { timestamp: number; route: string; method: string; status: number }[] = [];
const failureCounts = new Map<string, number>();
const deferredCaseQueue: { checkType: string; title: string; description: string }[] = [];
```

**Rationale**: The original health monitor had a catch-22 — it tried to use the database to log database failures. By tracking failures in-memory, the monitor can detect DB outages and queue case creation for when the DB recovers.  
**Trade-off**: In-memory state is lost on process restart, but health checks will re-populate state quickly.

---

### 12. Deferred Case Queue
**Pattern**: When the health monitor needs to create a case but the DB is unavailable, it queues the case creation for later.

```typescript
if (!dbAvailable) {
  deferredCaseQueue.push({ checkType, title, description });
  return;
}
// Process queue when DB comes back
for (const item of deferredCaseQueue) {
  await createCase(item);
}
deferredCaseQueue.length = 0;
```

**Benefit**: No case creation is lost due to transient DB outages.  
**Related**: Pattern 11 (in-memory tracking).

---

### 13. API Error Tracking Middleware
**Pattern**: An Express middleware hooks `res.end()` to intercept HTTP response status codes and feed 5xx errors to the health monitor.

```typescript
// apiErrorTracker.ts
const originalEnd = res.end;
res.end = function(...args) {
  if (res.statusCode >= 500) {
    trackApiError(req.path, req.method, res.statusCode);
  }
  return originalEnd.apply(this, args);
};
```

**Benefit**: Automatic 5xx error tracking without modifying individual route handlers. The health monitor aggregates these in a rolling 5-minute window.  
**Trade-off**: Monkey-patching `res.end()` is unconventional — must be careful not to break streaming responses.

---

### 14. Auto-Resolve Cases on Health Recovery
**Pattern**: When a health check returns to `healthy` after being in `error`/`warning`, the monitor automatically resolves any linked case.

```typescript
if (status === 'healthy' && existingCheck.case_id) {
  await db.execute(
    'UPDATE cases SET status = ?, resolution = ?, resolved_at = NOW() WHERE id = ?',
    ['resolved', `Auto-resolved: ${checkName} is now healthy`, existingCheck.case_id]
  );
  await db.execute('UPDATE system_health_checks SET case_id = NULL WHERE check_type = ?', [checkType]);
}
```

**Benefit**: Reduces noise — transient issues auto-close without manual intervention.  
**Trade-off**: May close cases too aggressively if the issue is intermittent.

---

### 15. Multipart Boolean Coercion (Zod)
**Pattern**: Use `z.preprocess()` to coerce string values from multipart form-data into booleans.

```typescript
is_internal: z.preprocess(
  (val) => val === 'true' || val === '1' || val === true,
  z.boolean().default(false)
)
```

**Rationale**: `multer` sends all form fields as strings, so `"true"` and `"false"` fail Zod's `z.boolean()` validation. This caused 400 errors on comment submissions with file attachments.  
**Scope**: Applied to `AddCommentSchema.is_internal` in `cases.ts`.

---

## Anti-Patterns & Issues

### A1. Duplicated `mapCaseRow()` and `safeJson()`
**Problem**: Both `cases.ts` and `adminCases.ts` define their own copies of `mapCaseRow()` and `safeJson()`. The admin version lacks the `aiOverride` parameter.  
**Impact**: Changes to field mapping must be made in two places; easy to drift out of sync.  
**Fix**: Extract to `src/utils/caseHelpers.ts` and import in both routers.

---

### A2. No Transaction on Cascading Delete
**Problem**: Bulk and single delete operations run 3 sequential DELETE queries without a transaction.  
**Impact**: If the final DELETE fails, comments and activity are already deleted — data loss.  
**Fix**:
```typescript
await db.transaction(async (conn) => {
  await conn.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
  await conn.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
  await conn.execute('DELETE FROM cases WHERE id = ?', [caseId]);
});
```

---

### A3. Sequential Loop in Bulk Operations
**Problem**: Bulk assign, bulk status update, and bulk delete all loop through IDs sequentially with individual queries.  
**Impact**: N cases × 2 queries per case = 2N DB round trips. Slow for large batches.  
**Fix**: Use `WHERE id IN (?)` with a single UPDATE/DELETE, or batch inserts for activity logs.

---

### A4. Duplicated Config Objects Across Frontend Pages
**Problem**: `STATUS_CONFIG`, `SEVERITY_CONFIG`, and `CATEGORY_ICONS` are defined identically in both `CasesList.tsx` and `CaseDetailView.tsx`.  
**Impact**: Changes need to be synchronized across files.  
**Fix**: Extract to `src/constants/caseConfig.ts`.

---

### A5. No Server-Side Pagination on User Case List
**Problem**: `GET /cases` returns all cases without LIMIT/OFFSET despite the frontend expecting a `pagination` object.  
**Impact**: Performance degrades as cases grow; frontend pagination state is not actually used.  
**Fix**: Add `LIMIT ? OFFSET ?` based on `page` and `limit` query params with total count.

---

### A6. Unused Search State in CasesList
**Problem**: `CasesList.tsx` declares a `search` state variable but the DataTable has `searchable={false}` and the search input was removed from the filter bar.  
**Impact**: Dead code — `search` is included in the `useEffect` dependency array but never changes.  
**Fix**: Remove unused `search` state and its `useEffect` dependency.

---

## Design Patterns Summary

| Pattern | Location | Quality |
|---------|----------|---------|
| `mapCaseRow()` field mapping | `cases.ts`, `adminCases.ts` | ⚠️ Duplicated |
| `safeJson()` JSON parsing | `cases.ts`, `adminCases.ts` | ⚠️ Duplicated |
| COALESCE name fallback | All SQL JOINs | ✅ Good |
| Composite detail response | `GET /cases/:id` | ✅ Good |
| Role-based access control | `GET/PATCH /cases/:id` | ✅ Good |
| Activity audit trail | All write operations | ✅ Good |
| Cascading hard delete | Delete endpoints | ⚠️ No transaction |
| Internal/public comments | `GET /cases/:id` | ✅ Good |
| Notification lifecycle | Create/update/assign/comment | ✅ Good |
| Frontend config objects | List/Detail views | ⚠️ Duplicated |
| In-memory failure tracking | `healthMonitor.ts` | ✅ Good |
| Deferred case queue | `healthMonitor.ts` | ✅ Good |
| API error tracking middleware | `apiErrorTracker.ts` | ✅ Good |
| Auto-resolve on recovery | `healthMonitor.ts` | ✅ Good |
| Multipart boolean coercion | `AddCommentSchema` | ✅ Good |
| Sequential bulk loops | Bulk operations | ❌ Anti-pattern |
| Server-side pagination | User list endpoint | ❌ Missing |
| Zod validation | All write routes | ✅ Good |
