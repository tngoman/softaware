# Cases — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| CAS-001 | 🟠 High | `cases.ts`, `adminCases.ts` | `mapCaseRow()` and `safeJson()` duplicated across both route files | Extract to `src/utils/caseHelpers.ts` |
| CAS-002 | 🟠 High | `adminCases.ts` | Cascading delete (comments → activity → case) not wrapped in transaction | Use `db.transaction()` |
| CAS-003 | 🟠 High | `cases.ts` | `GET /cases` has no server-side pagination; returns all user's cases | Add `LIMIT ? OFFSET ?` with total count |
| CAS-004 | 🟡 Medium | `adminCases.ts` | Bulk operations loop sequentially — N cases × 2 queries | Use `WHERE id IN (?)` for batch operations |
| CAS-005 | 🟡 Medium | `CasesList.tsx`, `CaseDetailView.tsx` | `STATUS_CONFIG`, `SEVERITY_CONFIG`, `CATEGORY_ICONS` duplicated | Extract to `src/constants/caseConfig.ts` |
| CAS-006 | 🟡 Medium | `CasesList.tsx` | Unused `search` state variable (DataTable has `searchable={false}`) | Remove dead code |
| CAS-007 | 🟡 Medium | `cases.ts` | No permission middleware — only checks auth + manual admin role query | Add `permissionMiddleware('cases.*')` |
| CAS-008 | 🟡 Medium | `cases.ts` | Access check queries `user_roles` on every `GET/PATCH /:id` request | Cache admin status in JWT or middleware |
| CAS-009 | 🟢 Low | `cases.ts` | Case number generated from `Date.now().slice(-8)` — possible collision | Use auto-increment or UUID-based case numbers |
| CAS-010 | 🟢 Low | `adminCases.ts` | Analytics runs 5+ sequential SQL queries | Use `Promise.all()` or single compound query |
| CAS-011 | 🟢 Low | `cases.ts` | `GET /cases/:id` runs 4 sequential queries (case, access, comments, activity) | Parallelize with `Promise.all()` after access check |
| CAS-012 | 🟢 Low | `CaseModel.ts` | `rate()` sends `{ rating, feedback }` but backend expects `{ rating, rating_comment }` | Align field name or rename in Zod schema |
| CAS-013 | 🟡 Medium | `types/cases.ts` | `CaseStatus` type missing `'wont_fix'` — backend supports it but frontend type doesn't | Add `'wont_fix'` to `CaseStatus` union type |

---

## Migration Notes

### Add Pagination to User Case List (CAS-003)
```sql
-- No DB migration needed — just add LIMIT/OFFSET to the query
-- Also add a COUNT query for total:
SELECT COUNT(*) as total FROM cases WHERE reported_by = ?;
```

### Wrap Delete in Transaction (CAS-002)
```typescript
// Replace sequential DELETEs with:
await db.transaction(async (conn) => {
  await conn.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
  await conn.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
  await conn.execute('DELETE FROM cases WHERE id = ?', [caseId]);
});
```

### Batch Bulk Operations (CAS-004)
```sql
-- Instead of looping, use IN clause:
UPDATE cases SET assigned_to = ?, updated_at = ? WHERE id IN (?, ?, ?);

-- Batch insert activities:
INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at)
VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), ...;
```

---

## Suggested Improvements

### Short-term (Sprint-level)

1. **Extract shared helpers** (CAS-001)
   ```typescript
   // src/utils/caseHelpers.ts
   export function safeJson(val: any, fallback: any = null) { ... }
   export function mapCaseRow(row: any, aiOverride?: any) { ... }
   
   // In cases.ts and adminCases.ts:
   import { safeJson, mapCaseRow } from '../utils/caseHelpers.js';
   ```

2. **Add server-side pagination to user list** (CAS-003)
   ```typescript
   const page = parseInt(req.query.page as string) || 0;
   const limit = parseInt(req.query.limit as string) || 10;
   
   const countResult = await db.queryOne<any>(
     'SELECT COUNT(*) as total FROM cases WHERE reported_by = ?', [userId]
   );
   
   query += ' LIMIT ? OFFSET ?';
   params.push(limit, page * limit);
   
   res.json({
     success: true,
     cases: cases.map(c => mapCaseRow(c)),
     pagination: { page, limit, total: countResult.total }
   });
   ```

3. **Remove unused search state** (CAS-006)
   ```typescript
   // Remove from CasesList.tsx:
   // const [search, setSearch] = useState('');
   // Remove 'search' from useEffect dependency array
   ```

4. **Fix rating field name mismatch** (CAS-012)
   ```typescript
   // In CaseModel.rate():
   static async rate(id: string, rating: number, feedback?: string): Promise<void> {
     await api.post(`/cases/${id}/rate`, { rating, rating_comment: feedback });
   }
   ```

### Medium-term

1. **Extract frontend config constants** (CAS-005) — Move `STATUS_CONFIG`, `SEVERITY_CONFIG`, and `CATEGORY_ICONS` to `src/constants/caseConfig.ts` and import in both CasesList and CaseDetailView.

2. **Transactional deletes** (CAS-002) — Wrap all delete operations in `db.transaction()` to prevent orphaned records.

3. **Batch bulk operations** (CAS-004) — Replace sequential loops with `WHERE IN` clauses for bulk assign, status update, and delete.

4. **Cache admin role** (CAS-008) — Include `is_admin` flag in JWT claims so role doesn't need a DB query on every request.

### Long-term

1. **Soft delete for cases** — Instead of hard DELETE, add an `active` column (matching Invoices pattern) to preserve audit trail.

2. **Case assignment workflow** — Add auto-assignment rules based on category/severity (e.g., security cases → security team).

3. **SLA tracking** — Add SLA deadlines based on severity (critical: 4h, high: 24h, medium: 72h, low: 1 week) with breach notifications.

4. **Case templates** — Pre-defined templates for common issue types with auto-populated fields.

5. **File attachments** — Upload screenshots/logs to cases (currently only URL-based attachments on comments).

6. **Case search** — Full-text search across title, description, error_message with relevance ranking.

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| March 2026 | System | Initial case management system — user CRUD, admin analytics, bulk operations |
| March 2026 | System | Added `category` and `source` columns to cases table |
| March 2026 | System | Fixed `mapCaseRow()` field mapping (rating→user_rating, url→page_url) |
| March 2026 | System | Rewrote analytics endpoint to return flat structure (was nested) |
| March 2026 | System | Added bulk delete and single delete endpoints |
| March 2026 | System | Fixed COALESCE name fallback (was showing "Unknown User" for NULL names) |
| March 2026 | System | Fixed registration to store user name |
| March 2026 | System | Removed duplicate search input from CasesList |
| June 2025 | Copilot | **Health Monitor: Complete Rewrite** — Expanded from 4 simple checks to 10 comprehensive checks (MySQL connection, API error rate, backend process, memory usage, disk space, authentication, ingestion worker, Ollama service, ingestion queue, enterprise endpoints). Added in-memory failure tracking (survives DB outages), deferred case queue, auto-resolve when health restores. ~614 LOC |
| June 2025 | Copilot | **New Middleware: `apiErrorTracker.ts`** — Hooks `res.end()` to intercept HTTP responses; feeds 5xx errors to `healthMonitor.trackApiError()` for API error rate monitoring |
| June 2025 | Copilot | **`app.ts` Integration** — Imported and mounted `apiErrorTracker` middleware before routes |
| June 2025 | Copilot | **Comment Attachment Fix** — `AddCommentSchema.is_internal` changed from `z.boolean()` to `z.preprocess()` to coerce multipart form-data string values (`"true"`/`"false"`) into booleans. Fixed 400 Bad Request on comment submission with attachments |
| June 2025 | Copilot | **Attachment Display Fix** — `CaseDetailView.tsx`: Fixed attachment URLs using `getAssetUrl(att)` instead of broken relative paths; fixed double-escaped image regex (`\\\\.` → `\.`); added `<img>` thumbnail previews for image attachments |
| June 2025 | Copilot | **Frontend Types Rewrite** — `types/cases.ts`: Replaced old `HealthStatus` (`overall: healthy/degraded/unhealthy, checks: pass/fail`) with new `HealthCheck` interface (check_type, check_name, status, details object, consecutive_failures, case_id) and `HealthStatus` (overall_status, total_checks, healthy/warning/error/unknown counts, checks array) |
| June 2025 | Copilot | **CaseModel Fixes** — `getHealthStatus()` now extracts `res.data.health` (was returning full API wrapper); `runHealthChecks()` now returns `void` (fire-and-forget, caller re-fetches status) |
| June 2025 | Copilot | **Admin Health Dashboard Rewrite** — `AdminCaseManagement.tsx`: New `CHECK_TYPE_CONFIG` with typed icons per check, `HEALTH_BADGE` styling, detail formatting helpers, auto-refresh every 30s, spinner on re-run, rich check cards with detail grids, linked case navigation |
| June 2025 | Copilot | **DB Schema Update** — `system_health_checks.check_type` ENUM expanded with: `api_errors`, `process`, `memory`, `disk`, `worker`, `authentication`, `email`, `sms`, `payment`. Stale "Redis Cache" record deleted |
| June 2025 | Copilot | **Memory Threshold Fix** — Health monitor memory check now only triggers error when heap > 500MB AND 95%+, or system RAM > 95%. Warning when heap > 300MB or system > 80%. Prevents false alarms from normal V8 small-heap behavior |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| Authentication | Hard | JWT auth required for all routes |
| Users | Hard | Reporter/assignee lookup via JOINs on `users` table |
| Roles | Hard | Admin access check via `user_roles` + `roles` tables |
| Notifications | Hard | Case lifecycle events trigger notifications |
| AI (caseAnalyzer) | Soft | Component analysis on case creation (graceful failure) |
| Health Monitor | Soft | Comprehensive health status/checks (10 monitors, auto-case creation) via admin endpoints |

## Modules That Depend on Cases

| Module | Usage |
|--------|-------|
| Dashboard | May display recent cases or case counts as KPIs |
| Notifications | Receives case lifecycle notification payloads |
