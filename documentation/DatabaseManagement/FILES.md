# Database Management — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/databaseManager.ts` (525 LOC)
**Purpose**: Express router providing 13 endpoints for all database operations — connection testing, schema browsing, query execution, server monitoring, and CSV export. All operations optionally routed through SSH tunnels.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & constants | 1–11 | Express Router, `mysql2/promise`, `ssh2` Client, `net`, `fs`, `path`, `fileURLToPath`. Defines `KEYS_DIR = /var/opt/backend/keys/` |
| `TunnelConfig` interface | 22–30 | SSH tunnel parameters: `sshHost`, `sshPort`, `sshUser`, `sshPassword?`, `sshKeyFile?` |
| `ConnectionBody` interface | 32–45 | Full request body type: `host`, `port`, `user`, `password`, `database?`, `type` ('mysql'\|'mssql'), `tunnel?`, `table?`, `sql?`, `page?`, `pageSize?` |
| `TunnelHandle` interface | 47–50 | Internal: `localPort` (number), `server` (net.Server), `sshClient` (SSHClient) |
| `createTunnel()` | 52–100 | Creates SSH tunnel: resolves private key from KEYS_DIR, configures ssh2 with key or password auth, opens `net.Server` on random port, forwards via `sshClient.forwardOut()`. 15-second timeout. Returns `TunnelHandle`. |
| `closeTunnel()` | 102–104 | Closes both `net.Server` and `sshClient` from a `TunnelHandle` |
| `withMySQL()` | 107–135 | RAII helper: opens tunnel (if configured) → creates `mysql2` connection to `127.0.0.1:localPort` → executes callback → auto-closes connection and tunnel in `finally` block |
| `withMSSQL()` | 137–170 | RAII helper: dynamically imports `mssql` → opens tunnel → creates `ConnectionPool` → executes callback → closes pool and tunnel. Catches `MODULE_NOT_FOUND` and returns helpful error. |
| `GET /keys` | 174–190 | Lists private SSH key files from `KEYS_DIR`. Filters out `.pub` files and dotfiles. Returns array of `{ name, hasPublicKey, size }`. |
| `POST /connect` | 192–205 | Tests connection: MySQL uses `connection.ping()`, MSSQL uses `SELECT 1 AS ok`. Returns `{ success: true }` or error. |
| `POST /databases` | 207–220 | Lists databases: MySQL `SHOW DATABASES`, MSSQL `SELECT name FROM sys.databases WHERE state_desc='ONLINE'`. |
| `POST /tables` | 222–250 | Lists tables in a database: queries `INFORMATION_SCHEMA.TABLES` for `TABLE_NAME`, `TABLE_TYPE`, `TABLE_ROWS`, `ENGINE` (MySQL) or `TABLE_NAME`, `TABLE_TYPE` (MSSQL). |
| `POST /describe` | 252–290 | Describes table columns: MySQL uses `DESCRIBE tableName`, MSSQL queries `INFORMATION_SCHEMA.COLUMNS` joined with primary key detection via `TABLE_CONSTRAINTS` + `CONSTRAINT_COLUMN_USAGE`. |
| `POST /indexes` | 292–320 | Lists table indexes: MySQL uses `SHOW INDEX FROM tableName`, MSSQL queries `sys.indexes` joined with `sys.index_columns` and `sys.columns`, aggregates column names with `STRING_AGG`. |
| `POST /table-data` | 322–365 | Paginated data retrieval: `SELECT * FROM table LIMIT/OFFSET` (MySQL) or `OFFSET/FETCH` (MSSQL). Includes total row `COUNT(*)`. `pageSize` capped at 1000. Returns `{ rows, columns, total, page, pageSize }`. |
| `POST /table-size` | 367–400 | Table size statistics: MySQL queries `information_schema.TABLES` for `TABLE_ROWS`, `DATA_LENGTH`, `INDEX_LENGTH`, `ENGINE`, `CREATE_TIME`, `TABLE_COLLATION`. MSSQL queries `sys.partitions` + `sys.allocation_units`. Returns `{ size: { row_count, data_kb, index_kb, total_kb, engine, ... } }`. |
| `POST /table-create-sql` | 402–418 | DDL retrieval: MySQL uses `SHOW CREATE TABLE`. MSSQL returns placeholder string "(MSSQL CREATE TABLE scripting not yet supported)". Returns `{ sql }`. |
| `POST /processes` | 420–445 | Active processes: MySQL uses `SHOW FULL PROCESSLIST`. MSSQL queries `sys.dm_exec_requests` joined with `sys.dm_exec_sessions` WHERE `session_id > 50`. Returns `{ processes: [...] }`. |
| `POST /status` | 447–475 | Server status: MySQL returns `VERSION()` + `SHOW GLOBAL STATUS` (Uptime, Threads_connected, Questions, Slow_queries, etc.). MSSQL returns `@@SERVERNAME`, `@@VERSION`, `@@SPID`, `user_connections`. Returns `{ status: { key: value, ... } }`. |
| `POST /query` | 477–510 | Arbitrary SQL execution: executes user SQL. For SELECT-like results, returns `{ columns, rows }`. For DML, returns `{ affectedRows, insertId, message }`. Measures `executionTime` in ms. |
| `POST /export-csv` | 512–525 | Server-side CSV export: executes SQL, generates CSV with proper comma/quote/newline escaping, returns as `text/csv` file download with `Content-Disposition: attachment`. |

**Key patterns**:
- `withMySQL()` / `withMSSQL()` ensure tunnel and connection cleanup via `try/finally`
- Every endpoint follows: validate type → call `withMySQL` or `withMSSQL` → return JSON → catch → 500
- MSSQL queries use bracket-escaped identifiers (`[${table}]`) — **not parameterized** (SQL injection risk)
- MySQL queries use backtick-escaped identifiers and `connection.execute()` for some queries

---

## Frontend Files

### `/var/opt/frontend/src/pages/general/DatabaseManager.tsx` (1305 LOC)
**Purpose**: Full database administration interface with connection management, SQL editor, schema browser, table inspector, and server monitoring.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–36 | React (useState, useEffect, useRef, useCallback), 30+ Heroicons, `toast` (react-hot-toast), `Swal` (sweetalert2), `api` (axios instance) |
| `TunnelConfig` interface | 44–55 | Mirrors backend: `sshHost`, `sshPort`, `sshUser`, `sshPassword?`, `sshKeyFile?` |
| `Connection` interface | 57–67 | `id`, `name`, `host`, `port`, `user`, `password`, `database?`, `type` ('mysql'\|'mssql'), `tunnel` (TunnelConfig) |
| `QueryResult` interface | 69–78 | `columns`, `rows`, `affectedRows?`, `executionTime?`, `error?`, `message?` |
| `TableInfo` interface | 80–85 | `name`, `type`, `rows?`, `engine?` |
| `SSHKeyInfo` interface | 87–91 | `name`, `hasPublicKey`, `size` |
| `MainTab` type | 93 | `'query' \| 'browse' \| 'structure' \| 'info' \| 'processes' \| 'status'` |
| `connPayload()` helper | 95 | Builds API request body from a `Connection` object — maps `tunnel` config fields to flat body |
| **ConnectionDialog** component | 100–315 | Modal dialog for creating/editing connections. SSH Tunnel section (amber border, required): SSH Host, SSH Port (default 22), SSH User, Key File dropdown (from `GET /keys`), SSH Password (shown only when no key selected). Database section: Host, Port, Username, Password, Database. Test Connection button calls `POST /database/connect`. Validation requires name + SSH host + (key file or SSH password). |
| **TableBrowser** component | 320–445 | Paginated data browser. Props: `conn`, `tableName`, `onRunQuery`. Fetches `POST /table-data` with page/pageSize. Toolbar: table name, row count, column filter dropdown + value input, refresh. Data table with row numbers, sticky headers, NULL styling. Pagination: first/prev/next/last with page counter. |
| **DatabaseManager** — state declarations | 450–510 | Connections (from localStorage `db_connections_v2`), `sshKeys`, `activeConnection`, `connected`, `connecting`, `sql`, `result`, `executing`, `databases`, `tables`, `loadingTables`, `expandedTable`, `tableColumns`, `dialogOpen`, `editingConn`, `mainTab`, `browsingTable`, `queryHistory` (from localStorage, max 100), `savedQueries` (from localStorage), `showHistory`, `showSaved`, `sidebarCollapsed`, `tableInfo`, `tableIndexes`, `createSQL`, `processes`, `serverStatus`, `infoTable` |
| SSH keys effect | 512–520 | Loads key list from `GET /database/keys` on component mount |
| `saveConnection()` | 522–535 | Adds or updates connection in state + localStorage. Generates UUID for new connections. |
| `deleteConnection()` | 537–550 | SweetAlert2 confirmation dialog → removes from state + localStorage |
| `handleConnect()` | 552–575 | Sets `activeConnection`, calls `POST /connect` to test, then `fetchTables()` + `fetchDatabases()` in parallel |
| `handleDisconnect()` | 577–582 | Resets `connected`, `activeConnection`, `tables`, `databases`, `expandedTable` |
| `fetchTables()` | 584–595 | Calls `POST /database/tables`, updates `tables` state |
| `fetchDatabases()` | 597–600 | Calls `POST /database/databases`, updates `databases` state |
| `fetchTableColumns()` | 600–608 | Calls `POST /database/describe`, caches in `tableColumns[tableName]` |
| `switchDatabase()` | 608–615 | Updates `activeConnection.database`, calls `fetchTables()` |
| `handleExecute()` | 615–580 | Executes SQL via `POST /database/query`. Measures time, auto-adds to history (dedup, max 100). On DDL (ALTER/CREATE/DROP), auto-refreshes tables. |
| `handleKeyDown()` | 580–598 | Keyboard handler: Ctrl+Enter → execute, Tab → insert 2 spaces |
| Export helpers | 606–640 | `exportCSV()` — client-side CSV generation with escaping, blob download. `exportJSON()` — JSON.stringify rows, blob download. `copyToClipboard()` — tab-delimited text to clipboard. |
| `loadTableInfo()` | 645–665 | Parallel fetch: `POST /table-size` + `POST /indexes` + `POST /table-create-sql`. Sets info tab active. |
| `loadProcesses()` | 668–675 | Calls `POST /database/processes`, switches to processes tab |
| `loadStatus()` | 677–684 | Calls `POST /database/status`, switches to status tab |
| `saveQuery()` | 688–700 | SweetAlert2 input prompt for name → appends to `savedQueries` in state + localStorage |
| `quickSelect()` | 703–708 | Generates `SELECT TOP 100 *` (MSSQL) or `SELECT * LIMIT 100` (MySQL), sets SQL editor |
| `quickCount()` | 710–715 | Generates `SELECT COUNT(*)` with engine-appropriate syntax |
| **JSX — Sidebar** | 718–895 | Collapsible sidebar (w-64 / w-12). Contains: connection list with connect/edit/delete actions, status indicators (emerald for connected), database selector dropdown, tables tree with expand/collapse for columns, action buttons per table (SELECT, Browse, Info). |
| **JSX — SQL Editor toolbar** | 897–960 | Execute button (emerald, with spinner), Ctrl+Enter hint, Save/Saved/History toggle buttons, Processes/Status buttons (when connected), connection status indicator (amber/blue/emerald). |
| **JSX — Saved queries panel** | 962–985 | Dropdown panel (amber-50 bg): list of saved queries with click-to-load and delete button |
| **JSX — History panel** | 987–1002 | Dropdown panel (gray-100 bg): last 20 queries, font-mono, click-to-load |
| **JSX — SQL textarea** | 1004–1015 | Dark themed (`bg-[#1e1e2e]`, `text-[#cdd6f4]`), resizable, 6 rows default, min-h-100px, monospace, placeholder with hint |
| **JSX — Tab bar** | 1018–1060 | 5 tabs: Results (DocumentTextIcon), Browse (ListBulletIcon), Info (InformationCircleIcon), Processes (CommandLineIcon), Server (Cog6ToothIcon). Export buttons shown on Results tab (clipboard, CSV, JSON). |
| **JSX — Results tab** | 1063–1135 | Empty state → executing spinner → error display (red panel with pre) → results table with stats bar (row count, affected, execution time, column count), sticky-header data table with NULL styling and boolean badges |
| **JSX — Browse tab** | 1138–1150 | Renders `<TableBrowser>` when table selected, otherwise empty state prompt |
| **JSX — Info tab** | 1153–1245 | Table name header, 4 stat cards (Rows, Data Size, Total Size, Engine), columns table (Column, Type, Null, Key, Default), indexes table (Name, Columns, Unique), CREATE SQL in dark pre block |
| **JSX — Processes tab** | 1248–1275 | Dynamic table rendering from `processes` array. Column headers derived from first row's keys. Refresh button. |
| **JSX — Server Status tab** | 1278–1298 | Key-value cards for each status entry. Underscore-to-space label formatting. Refresh button. |
| ConnectionDialog render | 1300–1305 | Renders `<ConnectionDialog>` with open/close/save/sshKeys props |

**Key patterns**:
- Three sub-components: `ConnectionDialog` (modal), `TableBrowser` (paginated viewer), `DatabaseManager` (main)
- All API calls go through the shared `api` axios instance (base URL configured elsewhere)
- `connPayload()` centralizes connection→request-body mapping to avoid duplication
- Sidebar uses `group-hover:opacity-100` pattern for action button reveal
- All tables use `sticky top-0` headers for scroll behavior

---

## Supporting Files

### `/var/opt/backend/keys/softaware_id_ed25519` (399 bytes)
**Purpose**: Ed25519 SSH private key used for tunnel connections. Permissions: `chmod 600`.

### `/var/opt/backend/keys/softaware_id_ed25519.pub` (91 bytes)
**Purpose**: Corresponding public key. Comment: "SoftAware".

### Route Registration
**File**: `/var/opt/backend/src/app.ts`  
**Line**: `apiRouter.use('/database', databaseManagerRouter)`  
**Note**: No auth middleware applied at the router mount level.
