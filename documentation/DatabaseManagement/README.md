# Database Management Module

## Purpose
Provides a rich, browser-based database administration tool supporting **MySQL** and **Microsoft SQL Server** connections, exclusively routed through **SSH tunnels** for security. Allows users to manage connections, browse schemas, execute arbitrary SQL, inspect table structures, monitor server processes, and export results — all from a single-page React interface.

## Module Scope
- **Connection Management** — Create, edit, delete named connections with SSH tunnel configuration (key file or password auth). Connections persist in browser localStorage.
- **Schema Browser** — List databases, browse tables/views, expand columns with type and PK indicators, switch databases on the fly.
- **SQL Editor** — Dark-themed SQL textarea with Ctrl+Enter execution, query history (100 entries), saved named queries, quick SELECT/COUNT helpers.
- **Table Browser** — Paginated data viewer with column-value filtering, row count, page navigation.
- **Table Info** — Size statistics (rows, data KB, total KB, engine), column definitions, indexes, CREATE TABLE DDL (MySQL).
- **Server Monitoring** — Live process list (SHOW PROCESSLIST / sys.dm_exec_requests), server status and version info.
- **Data Export** — CSV file download, JSON file download, clipboard copy (tab-delimited) from query results. Backend CSV export endpoint also available.

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend | `src/routes/databaseManager.ts` | 525 | 13 endpoints under `/api/database/*` — SSH tunnel proxy for all DB operations |
| Frontend | `pages/general/DatabaseManager.tsx` | 1305 | Full database admin UI — connections, editor, browser, info, monitoring |

## Dependencies
- **Backend**: Express Router, `mysql2/promise` (MySQL connections), `ssh2` (SSH Client for tunnel creation), `mssql` (dynamic import for SQL Server), `net` (local TCP server for tunnel), `fs`/`path` (SSH key file access)
- **Frontend**: React 18, TypeScript, Tailwind CSS, Heroicons (30+ icons), `react-hot-toast`, `sweetalert2`, Axios (`api` service)
- **SSH Keys**: Private key files stored in `/var/opt/backend/keys/` (chmod 600), listed via `GET /database/keys`

## Architecture Notes
1. **SSH-tunnel-only design** — Every database connection is proxied through an SSH tunnel created via `ssh2`. The backend opens a local TCP port (`net.Server`), forwards traffic through `sshClient.forwardOut()` to the database host. Direct connections without a tunnel are technically possible but the UI requires tunnel configuration.
2. **Stateless per-request connections** — No connection pooling. Each API request creates a fresh SSH tunnel → DB connection → executes query → tears down both. The `withMySQL()` and `withMSSQL()` helpers enforce this RAII cleanup pattern.
3. **Dual-engine abstraction** — Every endpoint accepts a `type` field ('mysql' | 'mssql') and branches internally. MySQL uses `mysql2/promise`, MSSQL uses dynamically imported `mssql` package with `ConnectionPool`.
4. **Dynamic MSSQL import** — The `mssql` package is loaded via `await import('mssql')` at runtime, not at module load. If the package is missing, endpoints return a clear "mssql package not installed" error instead of crashing.
5. **Client-side persistence** — Connections (with credentials), query history, and saved queries are stored in browser `localStorage` under versioned keys (`db_connections_v2`, `db_query_history`, `db_saved_queries`).
6. **No authentication middleware** — The database router does not use `requireAuth` or any permission check. Endpoints are open to anyone who can reach the API server.
7. **Credentials in every request** — Since connections are stateless, the frontend sends full connection details (host, port, user, password, SSH config) in every POST body. No server-side session or token for active connections.
