# Admin Audit Log — Patterns & Anti-Patterns

## Architectural Patterns

### 1. SQLite for High-Volume Logging (Separate from MySQL)
**Pattern**: Audit logs are stored in a dedicated SQLite database (`audit_log.db`) instead of the main MySQL database. SQLite is accessed via the synchronous `better-sqlite3` driver.

```typescript
import Database from 'better-sqlite3';
const DB_PATH = '/var/opt/backend/data/audit_log.db';
const _db = new Database(DB_PATH);
_db.pragma('journal_mode = WAL');
```

**Benefit**: Isolates high-volume write-heavy log data from transactional MySQL. SQLite's WAL mode allows concurrent reads during writes. File-based storage is easy to back up, trim, or nuke. No MySQL connection pool pressure.
**Trade-off**: Two database engines to maintain. SQLite has no built-in replication. File must be on local disk (no network storage).

---

### 2. Response Interception via `res.end()` Override
**Pattern**: The `auditLogger` middleware wraps `res.end()` and `res.json()` to capture the response status code and calculate duration after the route handler finishes, without modifying the handler code.

```typescript
export function auditLogger(req, res, next) {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    // Log asynchronously after response is sent
    getUserInfo(req.userId).then(userInfo => {
      auditLog.log({ user_id: req.userId, duration_ms: duration, response_status: status, ... });
    });

    return originalEnd.apply(this, args);
  };

  next();
}
```

**Benefit**: Zero changes required in route handlers. Captures actual response status and timing. Logging happens async after response is sent — no added latency for the client.
**Trade-off**: Monkey-patching `res.end()` is fragile. If another middleware also wraps `res.end()`, order matters. TypeScript requires `as any` cast.

---

### 3. Lazy Singleton Database Initialization
**Pattern**: The SQLite database connection is created on first access via `getDb()`, not at import time. Table and indexes are created inline.

```typescript
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec('CREATE TABLE IF NOT EXISTS admin_audit_log (...)');
  _db.exec('CREATE INDEX IF NOT EXISTS idx_audit_user ...');
  // ...
  return _db;
}
```

**Benefit**: No migration scripts needed. Auto-creates DB directory, file, table, and indexes on first use. Server startup isn't blocked if DB dir doesn't exist yet.
**Trade-off**: First request incurs DB setup latency. `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` run on every cold start (cheap for SQLite).

---

### 4. Fire-and-Forget Logging
**Pattern**: The `auditLog.log()` method wraps its entire body in try/catch and never throws. The `auditLogger` middleware calls it inside an async `.then()` chain that also catches errors silently.

```typescript
log(entry: AuditLogInsert): void {
  try {
    const db = getDb();
    stmt.run(...);
  } catch (err) {
    console.error('[auditLog] Failed to write log entry:', err);
  }
}

// In middleware:
getUserInfo(userId).then(userInfo => {
  auditLog.log({ ... });
}).catch(err => {
  console.error('[auditLogger] Logging failed:', err);
});
```

**Benefit**: Audit logging can never crash the server or affect the response. If SQLite is locked, full, or corrupted, the application continues normally.
**Trade-off**: Silent data loss — if logging fails, there's no retry or alert (only console.error).

---

### 5. Automatic Resource Type Derivation
**Pattern**: Instead of requiring each route to specify its category, the `deriveResourceType()` function extracts it from the URL path using a table of regex patterns.

```typescript
function deriveResourceType(resourcePath: string): string {
  const clean = resourcePath.replace(/^\/api/, '').replace(/^\/admin\//, '');
  const mappings: [RegExp, string][] = [
    [/^clients/, 'clients'],
    [/^credits/, 'credits'],
    // ...
  ];
  for (const [pattern, type] of mappings) {
    if (pattern.test(clean)) return type;
  }
  return 'other';
}
```

**Benefit**: Zero configuration per route — categories are derived automatically. New routes that follow existing patterns are categorized immediately.
**Trade-off**: New URL patterns that don't match any regex fall into 'other'. The mapping table must be manually maintained when new admin domains are added.

---

### 6. Sensitive Field Stripping (Two Layers)
**Pattern**: Request bodies are sanitized at two levels before storage:

1. **`stripSensitive()`** in `auditLog.ts` — Recursively walks objects and replaces known sensitive field names (password, token, api_key, etc.) with `[REDACTED]`
2. **`sanitizeBody()`** in `auditLogger.ts` — Truncates string fields longer than 2000 chars to prevent bloated log entries

```typescript
// Layer 1: Known sensitive keys
const SENSITIVE_KEYS = new Set(['password', 'token', 'api_key', ...]);
function stripSensitive(obj) {
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) cleaned[key] = '[REDACTED]';
  }
}

// Layer 2: Size limits
function sanitizeBody(body) {
  for (const key of Object.keys(clone)) {
    if (typeof clone[key] === 'string' && clone[key].length > 2000) {
      clone[key] = clone[key].substring(0, 200) + '...[truncated]';
    }
  }
}
```

**Benefit**: Defense in depth — even if one layer misses something, the other catches it. Prevents password leaks in audit log. Prevents multi-MB body fields from bloating SQLite.
**Trade-off**: Both layers run on every non-GET request. Field name matching is limited to known keys — new sensitive fields must be added manually.

---

### 7. Skip Patterns (Self-Logging Prevention)
**Pattern**: The `auditLogger` middleware checks each request against a `SKIP_PATTERNS` array before logging. Any request matching a pattern is passed through without logging.

```typescript
const SKIP_PATTERNS = [
  /^GET \/api\/admin\/audit-log/,  // Don't log viewing the audit log itself
];

const signature = `${method} ${resource}`;
for (const pattern of SKIP_PATTERNS) {
  if (pattern.test(signature)) return next();
}
```

Additionally, the `adminAuditLogRouter` is mounted **without** `auditLogger` middleware in `app.ts`:
```typescript
apiRouter.use('/admin/audit-log', adminAuditLogRouter);  // No auditLogger!
```

**Benefit**: Double protection against recursive/noisy logging. Viewing the log doesn't generate log entries.
**Trade-off**: Management actions (trim, purge, bulk delete) on the audit log are also not logged. If you need to audit "who purged the audit log," this is a gap.

---

### 8. User Info Caching (MySQL → Memory)
**Pattern**: The `auditLogger` needs user email and name (stored in MySQL) but can't add latency. It maintains a simple `Map` cache with 5-minute TTL.

```typescript
const userInfoCache = new Map<string, { email: string; name: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getUserInfo(userId: string) {
  const cached = userInfoCache.get(userId);
  if (cached && cached.expires > Date.now()) return { email: cached.email, name: cached.name };
  
  const user = await db.queryOne('SELECT email, name FROM users WHERE id = ?', [userId]);
  userInfoCache.set(userId, { ...info, expires: Date.now() + CACHE_TTL });
  return info;
}
```

**Benefit**: Avoids a MySQL query on every admin request. Most admin sessions are the same user, so cache hit rate is high.
**Trade-off**: Unbounded cache growth (never evicted, only expires on re-query). If a user's email/name changes, the log may show stale values for up to 5 minutes.

---

## Anti-Patterns & Concerns

### ❌ Unbounded User Info Cache
The `userInfoCache` Map grows indefinitely — entries are never deleted, only overwritten on re-query after TTL. In a long-running process with many users, this is a memory leak.

**Fix**: Add a periodic cleanup or use an LRU cache.

### ❌ GET Requests Still Logged for `/admin/*`
The `auditLogger` middleware logs ALL HTTP methods including GET. This means every admin dashboard view, every client list load, and every config check generates a log entry — likely 80%+ of total entries.

**Consideration**: Could filter GETs out or make logging GETs configurable to reduce noise and DB size.

### ❌ `VACUUM` on Purge Blocks Reads
The `purgeAll()` method runs `VACUUM` immediately after deleting all rows. SQLite VACUUM rewrites the entire database file and holds an exclusive lock, blocking all other queries during execution.

**Fix**: Consider running VACUUM on a schedule or making it optional.
