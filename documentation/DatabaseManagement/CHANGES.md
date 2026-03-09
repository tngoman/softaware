# Database Management — Known Issues & Change Log

## Known Issues

### 🔴 Critical — Security

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DBM-001 | **No authentication on any endpoint** — All 13 `/api/database/*` routes have no `requireAuth` middleware. Any unauthenticated HTTP request can execute SQL against connected databases, list SSH keys, and export data. | `databaseManager.ts` | 174–525 | Full database access to anyone who can reach the API |
| DBM-002 | **SQL injection in MSSQL queries** — Table and database names are interpolated into SQL strings via template literals (`[${table}]`). A table name containing `]` could break out of the bracket escaping and inject arbitrary SQL. MySQL backtick escaping has the same vulnerability with backtick characters. | `databaseManager.ts` | 222–365 | Potential arbitrary SQL execution via crafted table names |
| DBM-003 | **Credentials in plaintext localStorage** — Database passwords, SSH passwords, and SSH key filenames are stored as plain JSON in `localStorage` under `db_connections_v2`. Any XSS vulnerability on the domain exposes all saved credentials. | `DatabaseManager.tsx` | 450–460 | Credential theft via XSS |
| DBM-004 | **Credentials sent in every request body** — Full database and SSH credentials are included in the POST body of every API call. Without enforced HTTPS, these travel in cleartext. Even with HTTPS, they appear in server access logs if body logging is enabled. | `DatabaseManager.tsx` | 95 | Credential exposure in transit or logs |
| DBM-005 | **Unrestricted arbitrary SQL execution** — `POST /query` executes any SQL statement without restriction — including `DROP DATABASE`, `CREATE USER`, `GRANT ALL`, file operations (`LOAD DATA INFILE`), etc. No query whitelisting or dangerous-statement blocking exists. | `databaseManager.ts` | 477–510 | Complete database compromise via arbitrary DDL/DCL |

### 🟡 Moderate

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DBM-006 | **No connection pooling** — Every API request creates a new SSH tunnel + database connection and tears both down after the single query. Rapid sequential operations (connect → tables → describe) each pay full SSH handshake cost (~200-500ms). | `databaseManager.ts` | 107–170 | Poor performance, ~300-600ms per operation |
| DBM-007 | **MSSQL CREATE TABLE not implemented** — `POST /table-create-sql` returns a hardcoded placeholder `"(MSSQL CREATE TABLE scripting not yet supported)"` for SQL Server connections. The Info tab is incomplete for MSSQL. | `databaseManager.ts` | 402–418 | Incomplete MSSQL feature parity |
| DBM-008 | **No request body validation** — POST endpoints don't validate request bodies with any schema. Missing `host`, `type`, or `port` fields produce cryptic driver-level errors (e.g., `connect ECONNREFUSED 0.0.0.0:undefined`) instead of clean 400 responses. | `databaseManager.ts` | All POST routes | Poor error UX, potential crashes |
| DBM-009 | **No rate limiting** — Combined with no authentication (DBM-001), the endpoints are vulnerable to abuse: brute-force password testing against databases, DoS via expensive queries, or SSH tunnel resource exhaustion. | `databaseManager.ts` | All routes | Resource exhaustion, credential brute-force |
| DBM-010 | **Non-deterministic MSSQL pagination** — `POST /table-data` uses `ORDER BY (SELECT NULL)` for MSSQL pagination. SQL Server does not guarantee row order without an explicit ORDER BY, so rows may shift or duplicate across pages. | `databaseManager.ts` | 340–355 | Inconsistent pagination results |
| DBM-011 | **Client-side filtering only** — `TableBrowser` fetches the full page, then filters in JavaScript by column value. For large tables, this means fetching 100 rows to show potentially 3 matches. Server-side WHERE would be more efficient. | `DatabaseManager.tsx` | 320–445 | Inefficient for large datasets |
| DBM-012 | **SSH key directory not configurable** — `KEYS_DIR` is hardcoded to `/var/opt/backend/keys/`. Cannot be changed via environment variable or configuration file. | `databaseManager.ts` | 10–11 | Inflexible deployment |

### 🟢 Minor

| ID | Issue | File | Line(s) | Impact |
|----|-------|------|---------|--------|
| DBM-013 | **No TypeScript response types** — Backend endpoints return untyped objects. No shared interfaces between frontend and backend for API response shapes. | `databaseManager.ts` | All routes | No compile-time safety |
| DBM-014 | **No SQL syntax highlighting** — The SQL editor is a plain `<textarea>` with dark background colors but no syntax highlighting, auto-complete, or bracket matching. | `DatabaseManager.tsx` | 1004–1015 | Poor editing experience |
| DBM-015 | **Static export filenames** — CSV exports use `export.csv` (server) or `query_result.csv` (client). Should include database name, table name, and/or timestamp. | `databaseManager.ts`, `DatabaseManager.tsx` | 512–525, 606–620 | Confusing when exporting multiple times |
| DBM-016 | **No EXPLAIN / query plan support** — No UI or endpoint for viewing query execution plans. Users cannot optimize queries from the tool. | — | — | Missing optimization feature |
| DBM-017 | **MySQL SHOW INDEX is denormalized** — MySQL returns one row per column in a composite index. MSSQL returns one row per index with aggregated columns. Frontend handles both but doesn't normalize to a consistent shape. | `databaseManager.ts` | 292–320 | Inconsistent index display between engines |
| DBM-018 | **No keyboard shortcut documentation** — Ctrl+Enter (execute) and Tab (insert spaces) are not documented in the UI beyond placeholder text. | `DatabaseManager.tsx` | — | Discoverability issue |
| DBM-019 | **Query history includes duplicates by position** — History deduplication checks only the most recent entry. If a query appears at position 5, executing it again creates a new entry at position 1 (duplicate exists at 5). | `DatabaseManager.tsx` | 615–580 | Minor clutter in history |

---

## Migration Notes

### Adding Authentication (DBM-001 Fix)
```typescript
// Before (current — NO AUTH):
// In app.ts:
apiRouter.use('/database', databaseManagerRouter);

// After:
import { requireAuth } from '../middleware/requireAuth.js';
apiRouter.use('/database', requireAuth, databaseManagerRouter);

// Optionally add role check for admin-only access:
import { requireAdmin } from '../middleware/requireAdmin.js';
apiRouter.use('/database', requireAuth, requireAdmin, databaseManagerRouter);
```

### Parameterizing Table Names (DBM-002 Fix)
For MySQL, use the `mysql2` escapeId function:
```typescript
// Before:
const [rows] = await conn.execute(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [pageSize, offset]);

// After:
const escapedTable = conn.escapeId(table);
const [rows] = await conn.execute(`SELECT * FROM ${escapedTable} LIMIT ? OFFSET ?`, [pageSize, offset]);
```

For MSSQL, use bracket escaping with `]` doubling:
```typescript
// Before:
const result = await pool.request().query(`SELECT * FROM [${table}]`);

// After:
const safeTable = table.replace(/\]/g, ']]');
const result = await pool.request().query(`SELECT * FROM [${safeTable}]`);
```

### Adding Connection Pooling (DBM-006 Fix)
```typescript
// Create a connection cache with TTL
const tunnelCache = new Map<string, { tunnel: TunnelHandle, connection: any, lastUsed: number }>();

function cacheKey(body: ConnectionBody): string {
  return `${body.tunnel?.sshHost}:${body.tunnel?.sshUser}:${body.host}:${body.port}:${body.user}`;
}

// Reuse or create
async function getConnection(body: ConnectionBody) {
  const key = cacheKey(body);
  const cached = tunnelCache.get(key);
  if (cached && Date.now() - cached.lastUsed < 60_000) {
    cached.lastUsed = Date.now();
    return cached.connection;
  }
  // Create new...
}

// Cleanup timer
setInterval(() => {
  for (const [key, entry] of tunnelCache) {
    if (Date.now() - entry.lastUsed > 60_000) {
      closeTunnel(entry.tunnel);
      tunnelCache.delete(key);
    }
  }
}, 30_000);
```

### Adding Request Validation (DBM-008 Fix)
```typescript
import { z } from 'zod';

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().min(1),
  password: z.string(),
  type: z.enum(['mysql', 'mssql']),
  database: z.string().optional(),
  tunnel: z.object({
    sshHost: z.string().min(1),
    sshPort: z.number().int().positive().default(22),
    sshUser: z.string().min(1),
    sshPassword: z.string().optional(),
    sshKeyFile: z.string().optional(),
  }).optional(),
});

// In each route:
router.post('/connect', (req, res) => {
  const parsed = connectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  // ... proceed with parsed.data
});
```

### Encrypting localStorage Credentials (DBM-003 Fix)
```typescript
// Use the existing credentialVault pattern from the codebase:
import { encrypt, decrypt } from '../utils/credentialVault';

// Save:
const encrypted = encrypt(JSON.stringify(connections), sessionKey);
localStorage.setItem('db_connections_v2', encrypted);

// Load:
const raw = localStorage.getItem('db_connections_v2');
const connections = JSON.parse(decrypt(raw, sessionKey));
```

---

## Future Enhancements

### Priority 1 — Security
- [ ] Add `requireAuth` middleware to database router mount (DBM-001)
- [ ] Parameterize all table/database name interpolation (DBM-002)
- [ ] Encrypt credentials in localStorage using credential vault (DBM-003)
- [ ] Implement server-side connection sessions to avoid sending credentials per-request (DBM-004)
- [ ] Add query whitelist/blacklist or read-only mode option (DBM-005)
- [ ] Add rate limiting per IP / per user (DBM-009)

### Priority 2 — Performance
- [ ] Implement SSH tunnel + connection pooling with TTL (DBM-006)
- [ ] Add server-side WHERE filtering for table browser (DBM-011)
- [ ] Add deterministic ORDER BY for MSSQL pagination (DBM-010)

### Priority 3 — Feature Parity
- [ ] Implement MSSQL CREATE TABLE DDL generation (DBM-007)
- [ ] Normalize MySQL/MSSQL index response shapes (DBM-017)
- [ ] Add EXPLAIN / query plan visualization (DBM-016)
- [ ] Add MSSQL status variables parity with MySQL GLOBAL STATUS

### Priority 4 — UX Improvements
- [ ] Integrate SQL syntax highlighting (CodeMirror or Monaco) (DBM-014)
- [ ] Add dynamic export filenames with timestamp (DBM-015)
- [ ] Add keyboard shortcut help overlay (DBM-018)
- [ ] Add query tabs for multiple simultaneous queries
- [ ] Add table data inline editing (UPDATE on cell change)
- [ ] Add schema diff / comparison between databases
- [ ] Add visual query builder for non-SQL users

### Priority 5 — Code Quality
- [ ] Add Zod/Joi request validation to all endpoints (DBM-008)
- [ ] Add TypeScript response interfaces shared between frontend/backend (DBM-013)
- [ ] Make KEYS_DIR configurable via environment variable (DBM-012)
- [ ] Deduplicate query history properly (DBM-019)
- [ ] Extract ConnectionDialog and TableBrowser to separate files
