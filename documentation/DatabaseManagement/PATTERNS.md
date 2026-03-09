# Database Management — Architecture Patterns

## Design Patterns

### 1. SSH-Tunnel-Only Architecture
All database connections are proxied through SSH tunnels using the `ssh2` library. The backend creates a local TCP server (`net.Server`) that forwards traffic through `sshClient.forwardOut()` to the target database host.

```
Browser                 Backend                     SSH Server              DB Server
  │                       │                            │                      │
  ├─ POST /connect ──────►│                            │                      │
  │   { tunnel: {...} }   ├─ ssh2 connect ────────────►│                      │
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
async function withMySQL(body: ConnectionBody, fn: (conn) => Promise<T>): Promise<T> {
  let tunnel: TunnelHandle | null = null;
  let connection: mysql2.Connection | null = null;
  try {
    if (body.tunnel) tunnel = await createTunnel(body.tunnel);
    connection = await mysql2.createConnection({
      host: '127.0.0.1',
      port: tunnel?.localPort || body.port,
      user: body.user, password: body.password, database: body.database
    });
    return await fn(connection);
  } finally {
    if (connection) await connection.end().catch(() => {});
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
    res.json({ databases: result.recordset.map(r => r.name) });
  });
}
// Default: MySQL
return withMySQL(body, async (conn) => {
  const [rows] = await conn.execute('SHOW DATABASES');
  res.json({ databases: rows.map(r => r.Database) });
});
```

**Trade-off**: Simple branching per endpoint, but duplicates error handling and response shaping. Each endpoint has ~2x the code for dual support.

### 4. Dynamic MSSQL Import
The `mssql` package is loaded at runtime via `await import('mssql')` rather than a top-level `import`:

```typescript
async function withMSSQL(body, fn) {
  let mssqlLib;
  try {
    mssqlLib = await import('mssql');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error('mssql package is not installed. Run: npm install mssql');
    }
    throw err;
  }
  // ... use mssqlLib.default
}
```

**Rationale**: The `mssql` package is optional — MySQL-only deployments don't need it installed. Avoids startup crashes when the package is absent.

### 5. Stateless Per-Request Connections
No connection pooling exists. Each API request creates a fresh tunnel + connection, executes one operation, then tears both down:

```
Request → createTunnel() → createConnection() → execute() → closeConnection() → closeTunnel() → Response
```

**Trade-off**: Maximum isolation and simplicity — no state to manage, no stale connections. However, every request pays the SSH handshake + TCP connect overhead (~100-500ms per request depending on network).

### 6. Client-Side Connection Persistence
Connection configurations (including credentials) are stored in browser `localStorage` under versioned keys:

```typescript
// Save
localStorage.setItem('db_connections_v2', JSON.stringify(connections));

// Load
const saved = JSON.parse(localStorage.getItem('db_connections_v2') || '[]');
```

**Rationale**: No server-side user session or database for connection configs. Simple and stateless. The `_v2` suffix allows migration from older formats.

### 7. `connPayload()` Request Builder
A single helper function transforms a `Connection` object into the flat request body format expected by all backend endpoints:

```typescript
const connPayload = (c: Connection) => ({
  host: c.host, port: c.port, user: c.user, password: c.password,
  database: c.database, type: c.type,
  tunnel: c.tunnel?.sshHost ? {
    sshHost: c.tunnel.sshHost, sshPort: c.tunnel.sshPort || 22,
    sshUser: c.tunnel.sshUser, sshPassword: c.tunnel.sshPassword,
    sshKeyFile: c.tunnel.sshKeyFile,
  } : undefined,
});
```

**Pattern**: Centralizes connection→body mapping. Every API call uses `connPayload(activeConnection)` to avoid field duplication.

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

### 10. Collapsible Sidebar with Action Reveal
The sidebar uses Tailwind's `group-hover` pattern to show table action buttons only on hover:

```tsx
<div className="group flex items-center">
  <span className="flex-1">{table.name}</span>
  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
    <button title="SELECT *"><EyeIcon /></button>
    <button title="Browse"><ListBulletIcon /></button>
    <button title="Info"><InformationCircleIcon /></button>
  </div>
</div>
```

---

## Anti-Patterns & Technical Debt

### 🔴 Critical

1. **No authentication middleware** — The `/api/database/*` router has no `requireAuth` or permission check. Any unauthenticated request to the API server can connect to databases, execute arbitrary SQL, and export data. This is a **critical security vulnerability**.

2. **SQL injection in MSSQL queries** — MSSQL table/database names are interpolated via string templates (`[${table}]`, `[${body.database}]`) without parameterization. While bracket-escaping prevents basic injection, it does not handle names containing `]` characters. MySQL uses backtick escaping which has the same issue.

3. **Credentials stored in plaintext localStorage** — Database passwords and SSH passwords are stored in the browser's `localStorage` as plain JSON. Any XSS vulnerability on the domain would expose all saved credentials.

4. **Credentials sent in every request body** — Full database credentials (user, password) and SSH credentials are sent in the POST body of every API request. If HTTPS is not enforced, these are transmitted in cleartext.

5. **Arbitrary SQL execution without restrictions** — `POST /query` executes any SQL the user sends — including `DROP DATABASE`, `GRANT`, `CREATE USER`, etc. There is no query whitelisting, read-only mode, or dangerous-query confirmation on the backend.

### 🟡 Moderate

6. **No connection pooling** — Each request creates and destroys a full SSH tunnel + database connection. For rapid operations (e.g., table browse + describe + indexes), this means 3 separate SSH handshakes. A connection cache with TTL would significantly improve performance.

7. **MSSQL CREATE TABLE not supported** — `POST /table-create-sql` returns a hardcoded placeholder for MSSQL instead of generating DDL. This is a feature gap that makes the Info tab incomplete for SQL Server.

8. **No request validation** — POST bodies are not validated with any schema (e.g., Joi, Zod). Missing `host`, `port`, or `type` fields result in cryptic `mysql2` or `mssql` errors instead of clean 400 responses.

9. **Client-side filtering only** — The `TableBrowser` component fetches all rows for the current page, then filters client-side by column value. For large tables, server-side WHERE clauses would be more efficient.

10. **No rate limiting** — With no auth and arbitrary SQL execution, the endpoint is vulnerable to abuse — repeated connections, denial-of-service via expensive queries, or brute-force credential testing against databases.

11. **MSSQL `ORDER BY (SELECT NULL)`** — The `table-data` endpoint uses `ORDER BY (SELECT NULL)` for MSSQL pagination, which means row order is non-deterministic. Rows may shift between pages.

12. **MySQL `SHOW INDEX` returns denormalized rows** — MySQL returns one row per index-column combination, while MSSQL returns aggregated rows. The frontend must handle both shapes, but doesn't normalize them.

### 🟢 Minor

13. **No TypeScript interfaces for route responses** — Backend endpoints return `any`-typed objects. Adding response type definitions would improve maintainability.

14. **Hardcoded SHOW GLOBAL STATUS variables** — The status endpoint requests a fixed list of MySQL status variables. Adding configurable variable selection would be useful.

15. **No query formatting/syntax highlighting** — The SQL textarea is a plain `<textarea>` with dark background colors but no syntax highlighting, auto-complete, or formatting.

16. **No EXPLAIN support** — There's no way to run `EXPLAIN` or view query execution plans from the UI.

17. **Export filename is static** — CSV exports always use `export.csv` / `query_result.csv`. Should include database/table name and timestamp.

18. **No keyboard shortcuts documentation** — Ctrl+Enter and Tab behavior aren't discoverable beyond the placeholder text.

---

## Performance Characteristics

| Operation | SSH Overhead | DB Query | Est. Total | Notes |
|-----------|-------------|----------|------------|-------|
| Connect (test) | ~200-500ms | ~10ms | ~300-600ms | Full SSH handshake + ping |
| List databases | ~200-500ms | ~5ms | ~300-600ms | New tunnel per request |
| List tables | ~200-500ms | ~10ms | ~300-600ms | New tunnel per request |
| Describe table | ~200-500ms | ~5ms | ~300-600ms | New tunnel per request |
| Browse data (100 rows) | ~200-500ms | ~20ms | ~300-600ms | COUNT + SELECT |
| Load table info | ~600-1500ms | ~30ms | ~700-1600ms | 3 parallel requests, each with own tunnel |
| Execute query | ~200-500ms | Variable | ~300ms+ | Depends on query complexity |
| Export CSV (server) | ~200-500ms | Variable | ~300ms+ | Entire result buffered in memory |

**Key bottleneck**: SSH tunnel creation dominates every operation. Connection pooling would reduce repeat operations to ~10-50ms.

**Recommendation**: Implement a server-side connection cache with 60-second TTL keyed by `(host:port:user:sshHost:sshKeyFile)`. Reuse existing tunnels + connections for sequential operations.
