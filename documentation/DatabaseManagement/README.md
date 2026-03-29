# Database Management Module

## Purpose
Provides a rich, browser-based database administration tool supporting **MySQL** and **Microsoft SQL Server** connections, exclusively routed through **SSH tunnels** for security. Allows users to manage shared connections, browse schemas, execute arbitrary SQL, inspect table structures, perform inline CRUD operations, import SQL files, monitor server processes, and export results — all from a single-page React interface.

## Access Control
- **Backend**: All routes protected by `requireAuth` + `requireDeveloper` middleware chain. Only users with `developer`, `admin`, or `super_admin` roles can access any endpoint.
- **Frontend Route**: Wrapped in `<DeveloperRoute>` guard — redirects non-developer users to dashboard.
- **Sidebar**: Database menu item is hidden from non-developer users via `roleSlug: 'developer'` check on the NavItem.
- **Per-connection access**: Admin users can grant individual `developer`-role users access to each connection via `db_connection_access`. Non-admin developers only see connections they've been granted. Only admins can create, edit, or delete connections.

## Module Scope
- **Connection Management** — Create, edit, delete named connections with SSH tunnel configuration (key file or password auth). Connections stored in `db_connections`; admin-only create/edit/delete. Per-connection user access list stored in `db_connection_access`.
- **Schema Browser** — List databases, browse tables/views, expand columns with type and PK indicators, switch databases on the fly.
- **SQL Editor** — Dark-themed SQL textarea with Ctrl+Enter execution, query history (100 entries), saved named queries, quick SELECT/COUNT helpers.
- **Table Browser (Adminer-like)** — Paginated data viewer with server-side sorting and filtering, inline row editing, row insertion, row deletion, multi-select operations, and column-level filter operators (LIKE, =, !=, >, <, IS NULL, IS NOT NULL, REGEXP).
- **Table Info** — Size statistics (rows, data KB, total KB, engine), column definitions, indexes, CREATE TABLE DDL (MySQL). Includes truncate and drop table actions.
- **Server Monitoring** — Live process list (SHOW PROCESSLIST / sys.dm_exec_requests), server status and version info.
- **Data Export (results)** — CSV file download, JSON file download, clipboard copy (tab-delimited) from query results. Backend CSV export endpoint also available.
- **Database Export** — Adminer-like full database dump (structure only / data only / structure + data, per-table selection, DROP TABLE and CREATE DATABASE options). Export written to server filesystem (`/var/opt/backend/db-exports/`). Export tab UI shows server-side file list with per-file download and delete.
- **SQL Import** — Import SQL files via file upload (drag-and-drop), paste, or textarea. Splits by semicolons and executes sequentially with error reporting.

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend | `src/routes/databaseManager.ts` | ~1100+ | 25+ endpoints under `/api/database/*` — SSH tunnel proxy, access control, export to disk |
| Backend | `src/middleware/requireDeveloper.ts` | 54 | Middleware requiring developer/admin/super_admin role |
| Frontend | `pages/general/DatabaseManager.tsx` | ~2100+ | Full database admin UI — connections, editor, browser, CRUD, import, export, monitoring |
| Frontend | `components/DeveloperRoute.tsx` | 37 | Route guard for developer role access |

## Database Schema

### `db_connections` table
Stores shared connection configurations. Only admin users can create/edit/delete rows.

```sql
CREATE TABLE db_connections (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 3306,
  user VARCHAR(255),
  password VARCHAR(255),
  `database` VARCHAR(255),
  type ENUM('mysql','mssql') DEFAULT 'mysql',
  ssh_host VARCHAR(255),
  ssh_port INT DEFAULT 22,
  ssh_user VARCHAR(255),
  ssh_password VARCHAR(255),
  ssh_key_file VARCHAR(255),
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `db_connection_access` table
Grants individual developer-role users access to specific connections. Admin users always see all connections regardless of this table.

```sql
CREATE TABLE db_connection_access (
  id VARCHAR(36) PRIMARY KEY,
  connection_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  granted_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_conn_user (connection_id, user_id)
);
```

## Dependencies
- **Backend**: Express Router, `mysql2/promise` (MySQL connections), `ssh2` (SSH Client for tunnel creation), `mssql` (dynamic import for SQL Server), `net` (local TCP server for tunnel), `fs`/`path` (SSH key file access + filesystem export), `crypto` (UUID generation for connections)
- **Middleware**: `requireAuth` (JWT verification from `middleware/auth.ts`), `requireDeveloper` (role check against `user_roles` + `roles` tables)
- **Frontend**: React 18, TypeScript, Tailwind CSS, Heroicons (40+ icons), `react-hot-toast`, `sweetalert2`, Axios (`api` service), `useAppStore` (Zustand), `API_BASE_URL` (for direct download links)
- **SSH Keys**: Private key files stored in `/var/opt/backend/keys/` (chmod 600), listed via `GET /database/keys`
- **Export Directory**: SQL dump files stored in `/var/opt/backend/db-exports/` (created automatically via `mkdirSync` on module load)

## Architecture Notes
1. **SSH-tunnel-only design** — Every database connection is proxied through an SSH tunnel created via `ssh2`. The backend opens a local TCP port (`net.Server`), forwards traffic through `sshClient.forwardOut()` to the database host. Direct connections without a tunnel are technically possible but the UI requires tunnel configuration.
2. **Stateless per-request connections** — No connection pooling. Each API request creates a fresh SSH tunnel → DB connection → executes query → tears down both. The `withMySQL()` and `withMSSQL()` helpers enforce this RAII cleanup pattern.
3. **Dual-engine abstraction** — Every endpoint accepts a `type` field ('mysql' | 'mssql') and branches internally. MySQL uses `mysql2/promise`, MSSQL uses dynamically imported `mssql` package with `ConnectionPool`.
4. **Dynamic MSSQL import** — The `mssql` package is loaded via `await import('mssql')` at runtime, not at module load. If the package is missing, endpoints return a clear "mssql package not installed" error instead of crashing.
5. **Server-side connection persistence** — Connection configurations are stored in the `db_connections` MySQL table, shared across all authorized users. Query history and saved queries remain in browser `localStorage` under versioned keys (`db_query_history`, `db_saved_queries`).
6. **Authentication + role-based access** — All database routes are protected by `requireAuth` (JWT verification) chained with `requireDeveloper` (checks for developer/admin/super_admin role slugs in `user_roles` table). The frontend uses `<DeveloperRoute>` component and sidebar `roleSlug` checks to hide/block access for non-developers.
7. **Credentials in every request** — Since connections are stateless, the frontend sends full connection details (host, port, user, password, SSH config) in every POST body. No server-side session or token for active connections.
8. **Server-side sort and filter** — The `/table-data` endpoint supports `sortColumn`, `sortDirection`, and `filters[]` parameters for server-side ORDER BY and WHERE clause generation, improving performance over client-side filtering.
9. **Inline CRUD operations** — The Table Browser supports inline row editing, new row insertion, and row deletion via dedicated `/row-insert`, `/row-update`, and `/row-delete` endpoints that use parameterized queries.
10. **Per-connection access control** — The `isAdminUser()` helper checks `users.is_admin` on every connection mutation. `GET /connections` JOINs `db_connection_access` and returns only accessible connections for non-admins. `POST /connections` and `DELETE /connections/:id` are admin-only. `GET /developer-users` returns users eligible for access grants.
11. **Filesystem export** — `POST /export-database` responds immediately with `{filename}` and writes the SQL dump to `EXPORTS_DIR` via `fs.WriteStream` line-by-line, eliminating request timeout for large databases. Separate list/download/delete endpoints expose the exported files.
