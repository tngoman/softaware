# Database Management — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/databaseManager.ts` (~835 LOC)
**Purpose**: Express router providing 20 endpoints for all database operations — connection CRUD, connection testing, schema browsing, query execution, inline CRUD, SQL import, table actions (truncate/drop), server monitoring, and CSV export. All operations routed through SSH tunnels. Protected by `requireAuth` + `requireDeveloper` middleware.

| Section | Lines (approx.) | Description |
|---------|-----------------|-------------|
| Imports & middleware | 1–16 | Express Router, `mysql2/promise`, `ssh2` Client, `net`, `fs`, `path`, `crypto`, `fileURLToPath`, `requireAuth`, `AuthRequest`, `requireDeveloper`, `db`. Applies `router.use(requireAuth, requireDeveloper)`. |
| Constants | 17–18 | `KEYS_DIR = /var/opt/backend/keys/` |
| `TunnelConfig` interface | 29–35 | SSH tunnel parameters: `sshHost`, `sshPort`, `sshUser`, `sshPassword?`, `sshKeyFile?` |
| `ConnectionBody` interface | 37–58 | Full request body type with enhanced fields: `sortColumn?`, `sortDirection?`, `filters?`, `row?`, `where?`, `primaryKeys?` |
| `TunnelHandle` interface | 60–64 | Internal: `localPort`, `server`, `sshClient` |
| `createTunnel()` | 66–112 | Creates SSH tunnel: resolves private key from KEYS_DIR, configures ssh2 with key or password auth, opens `net.Server` on random port, forwards via `sshClient.forwardOut()`. 15-second timeout. Returns `TunnelHandle`. |
| `closeTunnel()` | 114–117 | Closes both `net.Server` and `sshClient` from a `TunnelHandle` |
| `withMySQL()` | 119–140 | RAII helper: opens tunnel (if configured) → creates `mysql2` connection → executes callback → auto-closes in `finally` block |
| `withMSSQL()` | 142–172 | RAII helper: dynamically imports `mssql` → opens tunnel → creates `ConnectionPool` → executes callback → closes. Catches `MODULE_NOT_FOUND`. |
| `GET /connections` | 178–205 | Lists all saved connections from `db_connections` table. Maps flat DB rows to nested `Connection` shape. |
| `POST /connections` | 207–240 | Creates or updates a connection via `INSERT ... ON DUPLICATE KEY UPDATE`. Generates UUID with `crypto.randomUUID()`. Stores `userId` from JWT. |
| `DELETE /connections/:id` | 242–249 | Deletes a connection by UUID. |
| `GET /keys` | 251–264 | Lists private SSH key files from `KEYS_DIR`. Filters out `.pub` files and dotfiles. |
| `POST /connect` | 266–278 | Tests connection: MySQL `ping()`, MSSQL `SELECT 1`. |
| `POST /databases` | 280–295 | Lists databases: MySQL `SHOW DATABASES`, MSSQL `sys.databases`. |
| `POST /tables` | 297–318 | Lists tables: queries `INFORMATION_SCHEMA.TABLES` with rows/engine (MySQL) or name/type (MSSQL). |
| `POST /describe` | 320–360 | Describes table columns: MySQL `DESCRIBE`, MSSQL `INFORMATION_SCHEMA.COLUMNS` with PK detection. |
| `POST /indexes` | 362–388 | Lists indexes: MySQL `SHOW INDEX`, MSSQL `sys.indexes` with `STRING_AGG`. |
| `POST /table-data` | 390–450 | Enhanced paginated data with server-side sort (`sortColumn`, `sortDirection`) and filter (`filters[]` array). Generates WHERE clauses with parameterized values (MySQL) or escaped strings (MSSQL). |
| `POST /row-insert` | 452–480 | Inserts a new row. Parameterized INSERT with dynamic columns from `row` object. Empty strings → null. |
| `POST /row-update` | 482–520 | Updates a row by primary key. Parameterized UPDATE with `SET` from `row` and `WHERE` from `where` object. `LIMIT 1` (MySQL). |
| `POST /row-delete` | 522–558 | Deletes a row by primary key. `DELETE ... WHERE pk=? LIMIT 1` (MySQL) or `DELETE TOP(1)` (MSSQL). |
| `POST /import-sql` | 560–608 | Executes SQL dump: splits by `;\n`, filters comments, executes sequentially, collects errors (max 20). Returns summary. |
| `POST /truncate` | 610–630 | Truncates a table with identifier escaping. |
| `POST /drop-table` | 632–652 | Drops a table with identifier escaping. |
| `POST /table-size` | 654–685 | Table size statistics from `information_schema.TABLES` (MySQL) or `sys.partitions` + `sys.allocation_units` (MSSQL). |
| `POST /table-create-sql` | 687–702 | DDL via `SHOW CREATE TABLE` (MySQL). MSSQL returns placeholder comment. |
| `POST /processes` | 704–722 | Active processes: `SHOW FULL PROCESSLIST` (MySQL) or `sys.dm_exec_requests` (MSSQL). |
| `POST /status` | 724–748 | Server status: `VERSION()` + `SHOW GLOBAL STATUS` (MySQL) or `@@SERVERNAME` + `@@VERSION` (MSSQL). |
| `POST /query` | 750–790 | Arbitrary SQL execution. Returns `{ columns, rows, rowCount }` for SELECT, `{ affectedRows, message }` for DML. |
| `POST /export-csv` | 792–833 | Server-side CSV export with proper escaping. Returns `text/csv` download. |

**Key patterns**:
- `withMySQL()` / `withMSSQL()` ensure tunnel and connection cleanup via `try/finally`
- Every endpoint follows: validate inputs → call `withMySQL` or `withMSSQL` → return JSON → catch → 400/500
- `router.use(requireAuth, requireDeveloper)` protects all routes at the router level
- Row CRUD endpoints use parameterized queries where possible (MySQL fully parameterized, MSSQL uses `pool.request().input()`)
- Table name escaping: MySQL strips backticks, MSSQL doubles `]` characters

---

### `/var/opt/backend/src/middleware/requireDeveloper.ts` (54 LOC)
**Purpose**: Express middleware that restricts access to users with developer, admin, or super_admin roles. Must be chained after `requireAuth`.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–3 | `Response`, `NextFunction` from Express, `AuthRequest` from auth middleware, `db` from mysql |
| `requireDeveloper()` | 12–54 | Extracts `userId` from `req.userId` (set by `requireAuth`). Queries `user_roles JOIN roles` for slug IN `('developer', 'admin', 'super_admin')`. Returns 403 if no matching role found. Calls `next()` on success. |

**SQL Query**:
```sql
SELECT r.slug FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
  AND r.slug IN ('developer', 'admin', 'super_admin')
LIMIT 1
```

---

## Frontend Files

### `/var/opt/frontend/src/pages/general/DatabaseManager.tsx` (~1939 LOC)
**Purpose**: Full database administration interface with shared connection management, SQL editor, Adminer-like table browser with inline CRUD, SQL import, table actions, and server monitoring.

| Section | Lines (approx.) | Description |
|---------|-----------------|-------------|
| Imports | 1–47 | React (useState, useEffect, useRef, useCallback), 40+ Heroicons, `notify`, `Swal`, `api` |
| `TunnelConfig` interface | 56–62 | SSH tunnel parameters |
| `Connection` interface | 64–74 | `id`, `name`, `host`, `port`, `user`, `password`, `database`, `type`, `tunnel` |
| `QueryResult` interface | 76–83 | `columns`, `rows`, `affectedRows?`, `executionTime?`, `error?`, `message?` |
| `TableInfo` interface | 85–90 | `name`, `type`, `rows?`, `engine?` |
| `SSHKeyInfo` interface | 92–96 | `name`, `hasPublicKey`, `size` |
| `MainTab` type | 98 | `'query' \| 'browse' \| 'structure' \| 'info' \| 'processes' \| 'status' \| 'import'` |
| `connPayload()` helper | 100 | Builds API request body from Connection + optional extras |
| **ConnectionDialog** component | 107–350 | Modal dialog for creating/editing connections. SSH Tunnel section (amber border, required): SSH Host, SSH Port (default 22), SSH User, Key File dropdown (from `GET /keys`), SSH Password. Database section: Host, Port, Username, Password, Database. Test Connection button. Always-visible edit button (PencilSquareIcon). |
| **TableBrowser** component | 355–800 | Adminer-like paginated data browser with: server-side sorting (click column headers, ASC/DESC/none), server-side filtering (column selector, operator dropdown, value input), inline row editing (click edit icon, input fields, save/cancel), new row insertion (form at bottom), row deletion (with SweetAlert2 confirm), multi-select with checkboxes, bulk delete, export buttons (CSV/JSON/clipboard), row count display, pagination (first/prev/next/last). Props: `conn`, `tableName`, `onRunQuery`, `onRefreshTables`. |
| **DatabaseManager** — state declarations | 805–870 | Connections (from API `GET /database/connections`), `loadingConnections`, `sshKeys`, `activeConnection`, `connected`, `connecting`, `sql`, `result`, `executing`, `databases`, `tables`, `loadingTables`, `expandedTable`, `tableColumns`, `dialogOpen`, `editingConn`, `mainTab`, `browsingTable`, `queryHistory`, `savedQueries`, `showHistory`, `showSaved`, `sidebarCollapsed`, `tableInfo`, `tableIndexes`, `createSQL`, `processes`, `serverStatus`, `infoTable` |
| Load connections effect | 870–885 | Fetches connections from `GET /database/connections` API on mount. Shows loading spinner. |
| SSH keys effect | 886–892 | Loads key list from `GET /database/keys` on mount |
| `saveConnection()` | 894–910 | Calls `POST /database/connections`, refreshes connections list from API on success |
| `deleteConnection()` | 912–930 | SweetAlert2 confirmation → `DELETE /database/connections/:id`, refreshes connections list |
| `handleConnect()` | 932–960 | Sets `activeConnection`, calls `POST /connect`, then `fetchTables()` + `fetchDatabases()` in parallel |
| `handleDisconnect()` | 962–970 | Resets connection state |
| `fetchTables()` | 972–985 | Calls `POST /database/tables`, updates `tables` state |
| `fetchDatabases()` | 987–995 | Calls `POST /database/databases`, updates `databases` state |
| `fetchTableColumns()` | 997–1010 | Calls `POST /database/describe`, caches in `tableColumns[tableName]` |
| `switchDatabase()` | 1012–1020 | Updates `activeConnection.database`, calls `fetchTables()` |
| `handleExecute()` | 1022–1060 | Executes SQL via `POST /database/query`. Auto-adds to history (dedup, max 100). On DDL, auto-refreshes tables. |
| `handleKeyDown()` | 1062–1075 | Keyboard handler: Ctrl+Enter → execute, Tab → insert 2 spaces |
| Export helpers | 1077–1110 | `exportCSV()`, `exportJSON()`, `copyToClipboard()` — client-side export functions |
| `loadTableInfo()` | 1112–1135 | Parallel fetch: `/table-size` + `/indexes` + `/table-create-sql`. Includes truncate/drop actions. |
| `loadProcesses()` | 1137–1145 | Calls `POST /database/processes` |
| `loadStatus()` | 1147–1155 | Calls `POST /database/status` |
| `saveQuery()` | 1157–1170 | SweetAlert2 input prompt → saves to localStorage |
| `quickSelect()` / `quickCount()` | 1172–1185 | Engine-aware SQL template generators |
| **JSX — Sidebar** | 1190–1400 | Collapsible sidebar (w-64 / w-12). Connection list with connect/edit/delete. Database selector dropdown. Tables tree with expand/collapse. Action buttons per table: SELECT, Browse, Info, Truncate (hover), Drop (hover). |
| **JSX — SQL Editor toolbar** | 1402–1470 | Execute button, Ctrl+Enter hint, Save/Saved/History toggles, Processes/Status buttons, connection status. |
| **JSX — Saved queries panel** | 1472–1495 | Dropdown with saved queries list |
| **JSX — History panel** | 1497–1515 | Dropdown with last 20 queries |
| **JSX — SQL textarea** | 1517–1530 | Dark themed (`bg-[#1e1e2e]`, `text-[#cdd6f4]`), monospace |
| **JSX — Tab bar** | 1532–1580 | 7 tabs: Results, Browse, Info, Processes, Server, Import. Export buttons on Results tab. |
| **JSX — Results tab** | 1582–1660 | Results table with stats bar, sticky headers, NULL styling, boolean badges |
| **JSX — Browse tab** | 1662–1680 | Renders `<TableBrowser>` with full CRUD capabilities |
| **JSX — Info tab** | 1682–1780 | Table stats cards, columns table, indexes table, CREATE SQL, Truncate/Drop buttons in header |
| **JSX — Processes tab** | 1782–1810 | Dynamic table from `processes` array with refresh |
| **JSX — Server Status tab** | 1812–1835 | Key-value cards with refresh |
| **JSX — Import tab** | 1837–1920 | File upload area (drag-and-drop + click), textarea for pasting SQL, execute button with progress. Shows results summary (executed count, errors). |
| ConnectionDialog render | 1922–1939 | Renders `<ConnectionDialog>` with props |

**Key patterns**:
- Three sub-components: `ConnectionDialog` (modal), `TableBrowser` (Adminer-like browser), `DatabaseManager` (main)
- Connections loaded from API (`GET /database/connections`) not localStorage
- `loadingConnections` state shows spinner while fetching
- All API calls go through the shared `api` axios instance
- `connPayload()` centralizes connection→request-body mapping
- Sidebar hover actions for truncate/drop with SweetAlert2 confirmation
- TableBrowser manages its own state for sort, filter, inline edit, new row

---

### `/var/opt/frontend/src/components/DeveloperRoute.tsx` (37 LOC)
**Purpose**: Route guard component that restricts access to users with developer, admin, or super_admin roles.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–4 | React, Navigate (react-router-dom), useAppStore (Zustand), ProtectedRoute |
| `hasDeveloperAccess()` | 19–26 | Checks `user.is_admin` (boolean), `user.role?.slug === 'developer'` (singular from backend), and `user.roles?.some(r => r.slug === 'developer')` (plural fallback). Returns `true` if any match. |
| Render | 28–33 | Wraps children in `<ProtectedRoute>` (handles auth redirect). If `hasDeveloperAccess()` is false, redirects to `/` via `<Navigate>`. |

**Critical Note**: Backend `mapUser()` returns `role` (singular object with `.slug`) NOT `roles` (plural array). The component checks both shapes for compatibility.

---

### `/var/opt/frontend/src/components/Layout/Layout.tsx` (sidebar changes)
**Purpose**: Main layout with sidebar navigation. Modified to support role-based menu item visibility.

**Changes**:
- `NavItem` interface: Added `roleSlug?: string` field
- Database menu item: `{ name: 'Database', href: '/database', icon: CircleStackIcon, permission: 'settings.view', roleSlug: 'developer' }`
- `SidebarSection` component: Added role check logic — if an item has `roleSlug`, verifies `user.is_admin || user.role?.slug === item.roleSlug || user.roles?.includes(slug)`. Returns `null` (hides item) if no match.

---

### `/var/opt/frontend/src/App.tsx` (route change)
**Purpose**: Main routing. Modified to wrap `/database` route with `<DeveloperRoute>`.

```tsx
<Route path="/database" element={<DeveloperRoute><Layout><DatabaseManager /></Layout></DeveloperRoute>} />
```

---

## Supporting Files

### `/var/opt/backend/keys/softaware_id_ed25519` (399 bytes)
**Purpose**: Ed25519 SSH private key used for tunnel connections. Permissions: `chmod 600`.

### `/var/opt/backend/keys/softaware_id_ed25519.pub` (91 bytes)
**Purpose**: Corresponding public key. Comment: "SoftAware". Must be in remote server's `~/.ssh/authorized_keys`.

### Route Registration
**File**: `/var/opt/backend/src/app.ts`  
**Line**: `apiRouter.use('/database', databaseManagerRouter)`  
**Note**: Auth middleware is applied within the router itself (`router.use(requireAuth, requireDeveloper)`), not at the mount point.
