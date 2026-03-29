# Database Management — Architecture Patterns

## Design Patterns

### 1. SSH-Tunnel-Only Architecture
All database connections are proxied through SSH tunnels using the `ssh2` library. The backend creates a local TCP server (`net.Server`) that forwards traffic through `sshClient.forwardOut()` to the target database host.

```
Browser                 Backend                     SSH Server              DB Server
  │                       │                            │                      │
  ├─ POST /connect ──────►│                            │                      │
  │   { tunnel: {...} }   ├─ requireAuth ──► JWT OK    │                      │
  │                       ├─ requireDeveloper ──► role OK                     │
  │                       ├─ ssh2 connect ────────────►│                      │
  │                       ├─ net.Server on 127.0.0.1:N │                      │
  │                       ├─ forwardOut(N → dbHost:dbPort) ──────────────────►│
  │                       ├─ mysql2.connect(127.0.0.1:N) ─── (tunneled) ────►│
  │                       ├─ connection.ping() ─────────────────────────────►│
  │                       ├─ close connection                                 │
  │                       ├─ close tunnel                                     │
  │◄─ { success: true } ──┤                            │                      │
```

**Rationale**: Database servers should never be directly exposed to the internet. SSH tunnels provide encrypted transport + key-based authentication.

### 2. RAII Connection Helpers (`withMySQL` / `withMSSQL`)
Both helpers follow the Resource Acquisition Is Initialization pattern — they create a tunnel + connection, execute a callback, and guarantee cleanup in a `finally` block:

```typescript
async function withMySQL<T>(body: ConnectionBody, fn: (conn: mysql.Connection) => Promise<T>): Promise<T> {
  let tunnel: TunnelHandle | undefined;
  let host = body.host || '127.0.0.1';
  let port = body.port || 3306;

  if (body.tunnel?.sshHost) {
    tunnel = await createTunnel(body.tunnel, host, port);
    host = '127.0.0.1';
    port = tunnel.localPort;
  }
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({ host, port, user: body.user, password: body.password, database: body.database });
    return await fn(conn);
  } finally {
    if (conn) await conn.end().catch(() => {});
    if (tunnel) closeTunnel(tunnel);
  }
}
```

**Pattern**: Ensures no leaked SSH connections or database handles even on error paths. Each endpoint is a simple one-liner: `withMySQL(body, conn => conn.execute(...))`.

### 3. Dual-Engine Abstraction
Every endpoint branches on `body.type` to handle MySQL and MSSQL with engine-specific SQL:

```typescript
if (body.type === 'mssql') {
  return withMSSQL(body, async (pool) => {
    const result = await pool.request().query('SELECT name FROM sys.databases WHERE state_desc=\'ONLINE\'');
    res.json({ success: true, databases: result.recordset.map(r => r.name) });
  });
}
// Default: MySQL
return withMySQL(body, async (conn) => {
  const [rows] = await conn.execute('SHOW DATABASES');
  res.json({ success: true, databases: rows.map(r => r.Database) });
});
```

**Trade-off**: Simple branching per endpoint, but duplicates error handling and response shaping. Each endpoint has ~2x the code for dual support.

### 4. Dynamic MSSQL Import
The `mssql` package is loaded at runtime via `await import('mssql')` rather than a top-level `import`:

```typescript
async function withMSSQL(body, fn) {
  let pool: any;
  try {
    const mssql = await import('mssql');
    pool = await new mssql.default.ConnectionPool({ ... }).connect();
    return await fn(pool);
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND' || err.code === 'ERR_MODULE_NOT_FOUND')
      throw new Error('MSSQL driver not installed. Run: npm install mssql');
    throw err;
  } finally {
    if (pool) await pool.close().catch(() => {});
    if (tunnel) closeTunnel(tunnel);
  }
}
```

**Rationale**: The `mssql` package is optional — MySQL-only deployments don't need it installed. Avoids startup crashes when the package is absent.

### 5. Stateless Per-Request Connections
No connection pooling exists. Each API request creates a fresh tunnel + connection, executes one operation, then tears both down:

```
Request → requireAuth → requireDeveloper → createTunnel() → createConnection() → execute() → closeConnection() → closeTunnel() → Response
```

**Trade-off**: Maximum isolation and simplicity — no state to manage, no stale connections. However, every request pays the SSH handshake + TCP connect overhead (~100-500ms per request depending on network).

### 6. Server-Side Connection Persistence (MySQL `db_connections` table)
Connection configurations are stored in the application's MySQL database in the `db_connections` table. Non-admin developers only see connections they've been explicitly granted in `db_connection_access`. Admin users see all connections.

```typescript
// Save (upsert) — admin only
await db.query(
  `INSERT INTO db_connections (id, name, host, ..., created_by)
   VALUES (?, ?, ?, ..., ?)
   ON DUPLICATE KEY UPDATE name = VALUES(name), host = VALUES(host), ...`,
  [connId, name, host, ..., userId]
);

// Sync access grants
await db.query('DELETE FROM db_connection_access WHERE connection_id = ?', [connId]);
for (const uid of accessUserIds) {
  await db.query(
    'INSERT INTO db_connection_access (id, connection_id, user_id, granted_by) VALUES (?, ?, ?, ?)',
    [crypto.randomUUID(), connId, uid, userId]
  );
}

// Load — admin sees all; non-admin filtered by access
const isAdmin = await isAdminUser(req);
const rows = isAdmin
  ? await db.query('SELECT * FROM db_connections ORDER BY name ASC')
  : await db.query(
      `SELECT dc.* FROM db_connections dc
       JOIN db_connection_access dca ON dca.connection_id = dc.id
       WHERE dca.user_id = ? ORDER BY dc.name ASC`,
      [userId]
    );
```

**Rationale**: Connections are shared resources. Server-side storage avoids XSS credential exposure. Per-connection access restricts sensitive connections to selected developers. Query history and saved queries remain in localStorage (user-specific, non-sensitive).

### 7. `connPayload()` Request Builder
A single helper function transforms a `Connection` object into the flat request body format expected by all backend endpoints:

```typescript
const connPayload = (c: Connection, extra?: Record<string, any>) => ({
  host: c.host, port: c.port, user: c.user, password: c.password,
  database: c.database, type: c.type, tunnel: c.tunnel, ...extra,
});
```

**Pattern**: Centralizes connection→body mapping. Every API call uses `connPayload(activeConnection, { table, ... })` to avoid field duplication. The `extra` parameter allows passing additional fields like `table`, `sql`, `sortColumn`, etc.

### 8. Auto-Refresh on DDL
The SQL executor detects DDL statements and automatically refreshes the table list:

```typescript
const handleExecute = async () => {
  const result = await api.post('/database/query', { ...connPayload(conn), sql });
  // If DDL detected, refresh sidebar
  if (/^\s*(ALTER|CREATE|DROP|RENAME)/i.test(sql.trim())) {
    fetchTables();
  }
};
```

---

### 9. Admin-Gated UI with `isAdminUser()`
The backend helper `isAdminUser()` queries `users.is_admin` per-request to enforce admin-only operations. The frontend reads `user.is_admin` from Zustand store to conditionally show/hide controls.

```typescript
// Backend helper
async function isAdminUser(req: Request): Promise<boolean> {
  const userId = (req as AuthRequest).userId;
  const row = await db.queryOne<{ is_admin: number }>('SELECT is_admin FROM users WHERE id = ?', [userId]);
  return !!row?.is_admin;
}

// Protect mutation endpoints
router.post('/connections', async (req, res) => {
  if (!await isAdminUser(req)) return res.status(403).json({ success: false, error: 'Admin access required' });
  // ... proceed with upsert
});

// Frontend — hide controls for non-admins
{isAdmin && (
  <button onClick={() => openDialog()}>New Connection</button>
)}
```

**Pattern**: Guard is at the action level, not the route level, so non-admins can still LIST and USE connections (read-only).

---

### 10. Filesystem Export (Fire-and-Forget + Poll)
The database export endpoint responds immediately with the filename then writes to disk in the background. The frontend polls the file list a few times after triggering to pick up the new file.

```typescript
// Backend — respond immediately, write in background
router.post('/export-database', async (req, res) => {
  const filename = `${safeDbName}_${exportType}_${timestamp}.sql`;
  res.json({ success: true, filename, message: 'Export started' });  // immediate

  const stream = fs.createWriteStream(path.join(EXPORTS_DIR, filename));
  try {
    await withMySQL(body, async (conn) => {
      // write header, table DDL, INSERT batches line by line
      await write(`-- Export: ${dbName}`);
      for (const table of tables) {
        const [rows, fields] = await conn.query(`SELECT * FROM \`${table}\``);
        // ... batch write INSERTs
      }
    });
  } catch (err) {
    stream.write(`-- EXPORT FAILED: ${err.message}\n`);
  } finally {
    stream.end();
  }
});

// Frontend — fire and poll
const handleExportDatabase = async () => {
  await api.post('/database/export-database', { ...connPayload(conn), exportType, ... });
  notify.success('Export started');
  setTimeout(() => fetchExportFiles(), 3000);
  setTimeout(() => fetchExportFiles(), 8000);
  setTimeout(() => fetchExportFiles(), 20000);
};
```

**Rationale**: Large database exports previously timed out because the entire dump was accumulated in memory and sent in one HTTP response. Writing to disk line-by-line removes the memory cap and the request timeout constraints. The file-list UI lets users download whenever the export completes.

### 9. Quick Query Generators
Engine-aware SQL templates for common operations:

```typescript
const quickSelect = (table: string) => {
  const q = activeConnection?.type === 'mssql'
    ? `SELECT TOP 100 * FROM [${table}]`       // MSSQL syntax
    : `SELECT * FROM \`${table}\` LIMIT 100`;   // MySQL syntax
  setSql(q);
};
```

### 10. Authentication + Role-Based Access (Multi-Layer)
Access control is enforced at four layers:

```
Layer 1: Sidebar NavItem — roleSlug: 'developer' hides menu from non-developers
Layer 2: DeveloperRoute — frontend route guard, redirects to dashboard
Layer 3: requireAuth — JWT verification middleware, extracts userId
Layer 4: requireDeveloper — queries user_roles + roles for developer/admin/super_admin slug
```

**Implementation**:
```typescript
// Backend: middleware chain
router.use(requireAuth, requireDeveloper);

// requireDeveloper checks:
const role = await db.queryOne(
  `SELECT r.slug FROM user_roles ur JOIN roles r ON r.id = ur.role_id
   WHERE ur.user_id = ? AND r.slug IN ('developer', 'admin', 'super_admin') LIMIT 1`,
  [userId]
);
if (!role) return res.status(403).json({ error: 'Developer access required' });

// Frontend: route guard
const hasDeveloperAccess = () => {
  if (user.is_admin) return true;
  if (user.role?.slug === 'developer') return true;    // singular (backend returns this)
  if (user.roles?.some(r => r.slug === 'developer')) return true;  // plural (fallback)
  return false;
};

// Frontend: sidebar visibility
if (item.roleSlug) {
  const hasRole = user?.is_admin || user?.role?.slug === item.roleSlug || user?.roles?.includes(slug);
  if (!hasRole) return null; // hide item
}
```

**Critical Note**: Backend's `mapUser()` returns `role` (singular object with `.slug`) NOT `roles` (plural array). The frontend checks both shapes for robustness.

### 11. Server-Side Sort & Filter
The `/table-data` endpoint generates SQL ORDER BY and WHERE clauses from request parameters:

```typescript
// Sorting
const orderBy = sortCol ? ` ORDER BY \`${sortCol.replace(/`/g, '')}\` ${sortDir}` : '';

// Filtering (MySQL — parameterized)
const clauses = filters.map(f => {
  const col = `\`${f.column.replace(/`/g, '')}\``;
  if (f.operator === 'IS NULL') return `${col} IS NULL`;
  if (f.operator === 'IS NOT NULL') return `${col} IS NOT NULL`;
  if (f.operator === 'LIKE') { whereParams.push(`%${f.value}%`); return `${col} LIKE ?`; }
  if (f.operator === 'REGEXP') { whereParams.push(f.value); return `${col} REGEXP ?`; }
  whereParams.push(f.value);
  return `${col} ${f.operator} ?`;
});
where = ' WHERE ' + clauses.join(' AND ');
```

**Rationale**: Replaces the previous client-side-only filtering. Server-side WHERE means the database returns only matching rows, dramatically improving performance for large tables. The `total` count also respects filters.

### 12. Inline CRUD with Parameterized Queries
Row operations use parameterized queries for security:

```typescript
// Insert — dynamic columns from row object
const cols = Object.keys(row);
const colList = cols.map(c => `\`${c.replace(/`/g, '')}\``).join(', ');
const placeholders = cols.map(() => '?').join(', ');
const values = cols.map(c => row[c] === '' ? null : row[c]);
await conn.execute(`INSERT INTO \`${table}\` (${colList}) VALUES (${placeholders})`, values);

// Update — SET from row, WHERE from where object
const setClause = setCols.map(c => `\`${c}\`=?`).join(', ');
const whereClause = whereCols.map(c => whereObj[c] === null ? `\`${c}\` IS NULL` : `\`${c}\`=?`).join(' AND ');
await conn.execute(`UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause} LIMIT 1`, params);

// Delete — WHERE from where object, LIMIT 1 safety
await conn.execute(`DELETE FROM \`${table}\` WHERE ${whereClause} LIMIT 1`, params);
```

**Safety**: `LIMIT 1` on UPDATE/DELETE (MySQL) and `DELETE TOP(1)` (MSSQL) prevent accidental mass operations. Empty strings are converted to `null`. Null values in WHERE generate `IS NULL` clauses.

### 13. SQL Import with Sequential Execution
The `/import-sql` endpoint handles multi-statement SQL files:

```typescript
const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
let executed = 0;
let errors: string[] = [];

for (const stmt of statements) {
  try { await conn.query(stmt); executed++; }
  catch (e: any) { errors.push(`${e.message} — ${stmt.substring(0, 80)}…`); }
}

res.json({ success: true, executed, errors: errors.slice(0, 20), totalStatements: statements.length });
```

**Pattern**: Splits by `;\n` (semicolon + newline) to avoid breaking strings containing semicolons. Continues execution on error to maximize successful statements. Error messages include first 80 characters of the failing statement for debugging. Maximum 20 errors returned to prevent response bloat.

---

## Anti-Patterns & Technical Debt

### 🔴 Critical

1. **SQL injection in MSSQL schema queries** — MSSQL table/database names are interpolated via string templates (`[${table}]`, `[${body.database}]`) in schema browsing endpoints. While `]` characters are doubled, this is not as secure as parameterized queries. The CRUD endpoints (`row-insert`, `row-update`, `row-delete`) properly use `pool.request().input()` for values but still interpolate table names.

2. **Credentials stored in plaintext MySQL** — The `db_connections` table stores database passwords and SSH passwords as plaintext VARCHAR columns. Any user with direct MySQL access can read all saved credentials. Should be encrypted at rest using an application-level encryption key.

3. **Credentials sent in every request body** — Full database credentials are included in the POST body of every API request. Without enforced HTTPS, these travel in cleartext. Even with HTTPS, they appear in server access logs if body logging is enabled.

4. **Arbitrary SQL execution without restrictions** — `POST /query` executes any SQL statement without restriction. Now requires developer authentication, but any authorized developer can execute `DROP DATABASE`, `CREATE USER`, `GRANT ALL`, etc.

### 🟡 Moderate

5. **No connection pooling** — Each request creates and destroys a full SSH tunnel + database connection. Improved by server-side sort/filter reducing request count, but sequential operations still pay full SSH handshake cost each time.

6. **MSSQL CREATE TABLE not supported** — `POST /table-create-sql` returns a placeholder for MSSQL.

7. **No request validation** — POST bodies lack schema validation. Missing fields produce driver-level errors.

8. **Non-deterministic MSSQL pagination** — `ORDER BY (SELECT NULL)` when no sort column specified.

9. **MySQL `SHOW INDEX` denormalized** — Returns one row per column in composite index. MSSQL returns aggregated rows.

### 🟢 Minor / Resolved

10. ~~**No authentication middleware**~~ — ✅ RESOLVED. All routes now protected by `requireAuth` + `requireDeveloper`.

11. ~~**Credentials in plaintext localStorage**~~ — ✅ RESOLVED. Connections stored in MySQL `db_connections` table.

12. ~~**Client-side filtering only**~~ — ✅ RESOLVED. Server-side `sortColumn`, `sortDirection`, and `filters[]` supported.

13. **No TypeScript response types** — Backend returns untyped objects.

14. **No SQL syntax highlighting** — Plain `<textarea>` with dark theme.

15. **Static export filenames** — Always `export.csv`.

16. **No EXPLAIN support** — No query plan visualization.

17. **No keyboard shortcut documentation** — Only discoverable via placeholder text.

---

## Performance Characteristics

| Operation | SSH Overhead | DB Query | Est. Total | Notes |
|-----------|-------------|----------|------------|-------|
| Connect (test) | ~200-500ms | ~10ms | ~300-600ms | Full SSH handshake + ping |
| List connections | 0ms | ~5ms | ~10ms | Local MySQL query, no SSH tunnel |
| List databases | ~200-500ms | ~5ms | ~300-600ms | New tunnel per request |
| List tables | ~200-500ms | ~10ms | ~300-600ms | New tunnel per request |
| Describe table | ~200-500ms | ~5ms | ~300-600ms | New tunnel per request |
| Browse data (sorted + filtered) | ~200-500ms | ~20ms | ~300-600ms | COUNT + SELECT with WHERE/ORDER BY |
| Insert/Update/Delete row | ~200-500ms | ~10ms | ~300-600ms | Single parameterized query |
| Import SQL (100 stmts) | ~200-500ms | ~500ms | ~600-1000ms | Single tunnel, sequential execution |
| Load table info | ~600-1500ms | ~30ms | ~700-1600ms | 3 parallel requests, each with own tunnel |
| Execute query | ~200-500ms | Variable | ~300ms+ | Depends on query complexity |
| Export CSV (server) | ~200-500ms | Variable | ~300ms+ | Entire result buffered in memory |

**Key bottleneck**: SSH tunnel creation dominates every operation. Connection pooling would reduce repeat operations to ~10-50ms.

**Improvement from server-side filtering**: Previously, browsing a filtered view required fetching all 100 rows then filtering client-side. Now the server generates WHERE clauses, so the database only returns matching rows and the `total` count reflects the filter.

**Recommendation**: Implement a server-side connection cache with 60-second TTL keyed by `(host:port:user:sshHost:sshKeyFile)`. Reuse existing tunnels + connections for sequential operations.
