# Admin Audit Log — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| AL-001 | 🟠 High | `auditLogger.ts` | Unbounded `userInfoCache` Map — entries never evicted, only overwritten on TTL expiry; memory leak in long-running process | Use LRU cache (e.g., `lru-cache` package) with max size, or add periodic cleanup sweep |
| AL-002 | 🟠 High | `auditLog.ts` | `purgeAll()` runs `VACUUM` synchronously after DELETE — holds exclusive lock on entire SQLite file, blocking all concurrent reads | Make VACUUM optional or schedule it separately; consider `PRAGMA incremental_vacuum` |
| AL-003 | 🟡 Medium | `auditLogger.ts` | All HTTP methods logged (including GET) — generates massive noise from dashboard views, list loads, config checks | Add configurable `SKIP_METHODS` list (default: skip GET) or make method filtering a setting |
| AL-004 | 🟡 Medium | `auditLog.ts` | `deriveResourceType()` mapping table must be manually updated for new admin routes — unmapped routes fall into 'other' | Consider deriving from Express route metadata or router mount path instead of URL pattern matching |
| AL-005 | 🟡 Medium | `adminAuditLog.ts` | Audit log management actions (trim, purge, bulk delete) are NOT themselves logged — no way to audit who purged the log | Log management actions via a separate mechanism or add special entries that survive the purge |
| AL-006 | 🟡 Medium | `auditLog.ts` | `query()` uses string interpolation for WHERE clause construction — while parameterized, the `LIKE` search doesn't escape `%` and `_` in user input | Escape special SQL characters in search term before wrapping with `%` |
| AL-007 | 🟢 Low | `auditLogger.ts` | `res.end()` and `res.json()` monkey-patching requires `as any` TypeScript cast — fragile if Express types change | Consider using `res.on('finish')` event instead of overriding methods |
| AL-008 | 🟢 Low | `auditLog.ts` | `SENSITIVE_KEYS` is a static hardcoded Set — new sensitive field names require code change and redeploy | Make the sensitive keys list configurable via environment variable or settings |
| AL-009 | 🟢 Low | `AuditLog.tsx` | Frontend search triggers API call on every keystroke (via `onChange` + `setPage(1)`) — no debounce | Add 300ms debounce on search input or search-on-Enter pattern |
| AL-010 | 🟢 Low | `adminAuditLog.ts` | `GET /filters` returns hard-coded `actions` array instead of deriving from actual data | Use `SELECT DISTINCT action FROM admin_audit_log` for dynamic action list |
| AL-011 | 🟢 Low | `AuditLog.tsx` | Page subtitle says "SQLite-backed" — implementation detail exposed to users | Remove or replace with user-meaningful description |

---

## Potential Improvements

### Debounced Search (AL-009)
```typescript
// Add useRef + useEffect debounce pattern
const searchTimeout = useRef<NodeJS.Timeout>();

const handleSearchChange = (value: string) => {
  setSearchTerm(value);
  clearTimeout(searchTimeout.current);
  searchTimeout.current = setTimeout(() => setPage(1), 300);
};
```

### `res.on('finish')` Instead of Monkey-Patching (AL-007)
```typescript
export function auditLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    getUserInfo(req.userId).then(userInfo => {
      auditLog.log({
        response_status: res.statusCode,
        duration_ms: duration,
        // ...
      });
    });
  });

  next();
}
```
**Note**: `res.on('finish')` fires after the response is fully sent, giving the same timing data without overriding methods.

### LRU Cache for User Info (AL-001)
```typescript
import { LRUCache } from 'lru-cache';

const userInfoCache = new LRUCache<string, { email: string; name: string }>({
  max: 100,
  ttl: 5 * 60 * 1000,
});
```

### Configurable Method Filtering (AL-003)
```typescript
const LOG_METHODS = new Set(
  (process.env.AUDIT_LOG_METHODS || 'POST,PUT,PATCH,DELETE').split(',')
);

// In auditLogger:
if (!LOG_METHODS.has(method)) return next();
```

### SQLite LIKE Escape (AL-006)
```typescript
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

// In query():
if (params.search) {
  conditions.push("(resource LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ...)");
  const term = `%${escapeLike(params.search)}%`;
  values.push(term, term, term, term);
}
```

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| SQLite over MySQL for audit log | High-volume append-heavy workload; isolate from transactional DB; easy file-based backup/purge | Initial |
| `better-sqlite3` (sync) over `sql.js` (async) | Synchronous API is simpler for fire-and-forget inserts; better performance for single-process Node.js | Initial |
| Skip logging audit-log views | Prevents noise and potential recursion; trade-off: management actions also not audited | Initial |
| User info from MySQL (not duplicated) | Single source of truth for user data; cached to minimize cross-DB queries | Initial |
| Sensitive field stripping (not column-level encryption) | Audit logs need to be human-readable; stripping is sufficient since the data never contained plaintext secrets from the route handlers | Initial |
