# Database Management — Field & Data Dictionary

## Request Body: `ConnectionBody` (all POST endpoints)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host` | `string` | Yes | Database server hostname or IP |
| `port` | `number` | Yes | Database server port (3306 for MySQL, 1433 for MSSQL) |
| `user` | `string` | Yes | Database username |
| `password` | `string` | Yes | Database password |
| `database` | `string` | Some endpoints | Target database name (required for tables, describe, indexes, table-data, table-size, table-create-sql, row-*, truncate, drop-table, import-sql, export-database) |
| `type` | `'mysql' \| 'mssql'` | Yes | Database engine type |
| `tunnel` | `TunnelConfig \| null` | No | SSH tunnel configuration (see below) |
| `table` | `string` | Some endpoints | Target table name (for describe, indexes, table-data, table-size, table-create-sql, row-*, truncate, drop-table) |
| `sql` | `string` | Some endpoints | SQL query string (for query, export-csv, import-sql) |
| `page` | `number` | No | Page number for pagination (default 1) |
| `pageSize` | `number` | No | Rows per page (default 100, max 1000) |
| `sortColumn` | `string` | No | Column name to ORDER BY (for table-data) |
| `sortDirection` | `'ASC' \| 'DESC'` | No | Sort direction (default 'ASC', for table-data) |
| `filters` | `FilterObject[]` | No | Array of filter objects for WHERE clause generation (for table-data) |
| `row` | `Record<string, any>` | Some endpoints | Key-value object of column→value pairs (for row-insert, row-update) |
| `where` | `Record<string, any>` | Some endpoints | Key-value object of primary key columns for WHERE clause (for row-update, row-delete) |
| `primaryKeys` | `string[]` | No | Array of primary key column names (reserved, not currently used) |
| `exportType` | `'structure' \| 'data' \| 'structure_and_data'` | No | Export content type (for export-database, default `'structure_and_data'`) |
| `selectedTables` | `string[]` | No | Tables to include in export (for export-database; omit for all tables) |
| `addDropTable` | `boolean` | No | Add `DROP TABLE IF EXISTS` before each CREATE (for export-database, default `true`) |
| `addCreateDatabase` | `boolean` | No | Add `CREATE DATABASE IF NOT EXISTS` + `USE` header (for export-database, default `false`) |
| `accessUserIds` | `string[]` | No | User UUIDs to grant access to a connection (for POST /connections, admin only) |

## Request Body: `FilterObject`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `column` | `string` | Yes | Column name to filter on |
| `operator` | `string` | No | Filter operator (default `'LIKE'`). Supported: `LIKE`, `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS NULL`, `IS NOT NULL`, `REGEXP` (MySQL only) |
| `value` | `string` | Conditional | Filter value — not required for `IS NULL` and `IS NOT NULL` operators |

## Request Body: `TunnelConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sshHost` | `string` | Yes | SSH server hostname |
| `sshPort` | `number` | No | SSH server port (default 22) |
| `sshUser` | `string` | Yes | SSH username |
| `sshPassword` | `string` | Conditional | SSH password — required if `sshKeyFile` is not provided |
| `sshKeyFile` | `string` | Conditional | Filename of private key in `/var/opt/backend/keys/` — required if `sshPassword` is not provided |

---

## Database Table: `db_connections`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `VARCHAR(36)` | NO | — | UUID primary key |
| `name` | `VARCHAR(255)` | NO | — | Connection display name |
| `host` | `VARCHAR(255)` | NO | — | Database server hostname or IP |
| `port` | `INT` | YES | `3306` | Database server port |
| `user` | `VARCHAR(255)` | YES | — | Database username |
| `password` | `VARCHAR(255)` | YES | — | Database password (plaintext) |
| `database` | `VARCHAR(255)` | YES | — | Default database name |
| `type` | `ENUM('mysql','mssql')` | YES | `'mysql'` | Database engine type |
| `ssh_host` | `VARCHAR(255)` | YES | — | SSH tunnel host |
| `ssh_port` | `INT` | YES | `22` | SSH tunnel port |
| `ssh_user` | `VARCHAR(255)` | YES | — | SSH tunnel username |
| `ssh_password` | `VARCHAR(255)` | YES | — | SSH tunnel password (plaintext) |
| `ssh_key_file` | `VARCHAR(255)` | YES | — | SSH private key filename |
| `created_by` | `VARCHAR(36)` | YES | — | User UUID who created the connection |
| `created_at` | `TIMESTAMP` | YES | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | YES | `CURRENT_TIMESTAMP ON UPDATE` | Last update timestamp |

**Column mapping** (DB → Frontend):
| DB Column | Frontend Field |
|-----------|---------------|
| `ssh_host` | `tunnel.sshHost` |
| `ssh_port` | `tunnel.sshPort` |
| `ssh_user` | `tunnel.sshUser` |
| `ssh_password` | `tunnel.sshPassword` |
| `ssh_key_file` | `tunnel.sshKeyFile` |
| `created_by` | `createdBy` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

---

## Database Table: `db_connection_access`

Grants per-user access to specific connections. Admin users bypass this table and always see all connections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `VARCHAR(36)` | NO | — | UUID primary key |
| `connection_id` | `VARCHAR(36)` | NO | — | FK to `db_connections.id` |
| `user_id` | `VARCHAR(36)` | NO | — | FK to `users.id` |
| `granted_by` | `VARCHAR(36)` | YES | — | Admin user UUID who granted access |
| `created_at` | `TIMESTAMP` | YES | `CURRENT_TIMESTAMP` | Grant timestamp |

**Unique constraint**: `(connection_id, user_id)` — prevents duplicate grants.

---

## API Responses

### `GET /api/database/connections`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `connections[]` | `Connection[]` | Array of connection objects (filtered by access for non-admins) |
| `connections[].id` | `string` | UUID |
| `connections[].name` | `string` | Display name |
| `connections[].host` | `string` | Database host |
| `connections[].port` | `number` | Database port |
| `connections[].user` | `string` | Database username |
| `connections[].password` | `string` | Database password |
| `connections[].database` | `string` | Default database |
| `connections[].type` | `string` | `'mysql'` or `'mssql'` |
| `connections[].tunnel` | `TunnelConfig` | SSH tunnel configuration |
| `connections[].createdBy` | `string \| null` | Creator user UUID |
| `connections[].createdAt` | `string` | ISO timestamp |
| `connections[].updatedAt` | `string` | ISO timestamp |
| `connections[].accessUsers[]` | `{ userId, name, email }[]` | Users granted access to this connection |

---

### `GET /api/database/developer-users`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `users[]` | `DeveloperUser[]` | Users with the `developer` role |
| `users[].id` | `string` | User UUID |
| `users[].name` | `string` | Full name |
| `users[].email` | `string` | Email address |

---

### `POST /api/database/export-database`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` (response is immediate; export runs in background) |
| `filename` | `string` | Generated filename e.g. `mydb_structure_and_data_2026-03-28_14-30-00.sql` |
| `message` | `string` | `"Export started"` |

---

### `GET /api/database/export-files`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `files[]` | `ExportFile[]` | List of SQL files on server, sorted by modified date desc |
| `files[].name` | `string` | Filename |
| `files[].size` | `number` | File size in bytes |
| `files[].createdAt` | `string` | ISO timestamp (file birth time) |
| `files[].modifiedAt` | `string` | ISO timestamp (last write) |

---

### `POST /api/database/connections`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `id` | `string` | UUID of created/updated connection |

---

### `GET /api/database/keys`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `keys[]` | `array` | Array of SSH key file info objects |
| `keys[].name` | `string` | Private key filename |
| `keys[].hasPublicKey` | `boolean` | Whether `{name}.pub` exists |
| `keys[].size` | `number` | File size in bytes |

---

### `POST /api/database/connect`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` if connection succeeded |
| `message` | `string` | `"Connected successfully"` |
| `error` | `string` | Error message (only on failure, status 400) |

---

### `POST /api/database/databases`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `databases[]` | `string[]` | List of database names |

---

### `POST /api/database/tables`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `tables[]` | `array` | Array of table info objects |
| `tables[].name` | `string` | Table or view name |
| `tables[].type` | `string` | `'BASE TABLE'` or `'VIEW'` |
| `tables[].rows` | `number \| null` | Approximate row count (MySQL only) |
| `tables[].engine` | `string \| null` | Storage engine (MySQL only) |

---

### `POST /api/database/describe`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `columns[]` | `array` | Column definitions |

#### MySQL Fields (from `DESCRIBE`)
| Field | Type | Description |
|-------|------|-------------|
| `Field` | `string` | Column name |
| `Type` | `string` | Data type (e.g., `varchar(255)`) |
| `Null` | `string` | `'YES'` or `'NO'` |
| `Key` | `string` | `'PRI'`, `'UNI'`, `'MUL'`, or empty |
| `Default` | `any` | Default value or `null` |
| `Extra` | `string` | e.g., `auto_increment` |

#### MSSQL Fields (normalized to match MySQL)
| Field | Type | Description |
|-------|------|-------------|
| `Field` | `string` | Column name (aliased from `COLUMN_NAME`) |
| `Type` | `string` | Data type with length (aliased) |
| `Null` | `string` | `'YES'` or `'NO'` (aliased from `IS_NULLABLE`) |
| `Key` | `string` | `'PRI'` or empty |
| `Default` | `any` | Default value (aliased from `COLUMN_DEFAULT`) |

---

### `POST /api/database/indexes`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `indexes[]` | `array` | Index definitions |

#### MySQL Fields (from `SHOW INDEX`)
| Field | Type | Description |
|-------|------|-------------|
| `Table` | `string` | Table name |
| `Non_unique` | `number` | `0` = unique, `1` = non-unique |
| `Key_name` | `string` | Index name |
| `Column_name` | `string` | Indexed column name |
| `Index_type` | `string` | `BTREE`, `HASH`, `FULLTEXT` |

#### MSSQL Fields
| Field | Type | Description |
|-------|------|-------------|
| `index_name` | `string` | Index name |
| `columns` | `string` | Comma-separated column names |
| `is_unique` | `boolean` | Whether unique |
| `index_type` | `string` | `CLUSTERED`, `NONCLUSTERED` |

---

### `POST /api/database/table-data`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `rows[]` | `object[]` | Array of row objects |
| `columns[]` | `string[]` | Column name array |
| `total` | `number` | Total row count (with filters applied) |
| `page` | `number` | Current page number |
| `pageSize` | `number` | Rows per page |

---

### `POST /api/database/row-insert`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | `"Row inserted"` |

---

### `POST /api/database/row-update`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | `"Row updated"` |

---

### `POST /api/database/row-delete`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | `"Row deleted"` |

---

### `POST /api/database/import-sql`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | Summary: `"15 statement(s) executed"` |
| `executed` | `number` | Number of statements successfully executed |
| `errors` | `string[]` | Array of error messages (max 20), format: `"error message — first 80 chars of statement…"` |
| `totalStatements` | `number` | Total number of statements parsed from input |

---

### `POST /api/database/truncate`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | `"Table {name} truncated"` |

---

### `POST /api/database/drop-table`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `message` | `string` | `"Table {name} dropped"` |

---

### `POST /api/database/table-size`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `size` | `object` | Size statistics object |

#### MySQL `size` Fields
| Field | Type | Description |
|-------|------|-------------|
| `row_count` | `number` | Approximate row count |
| `data_kb` | `number` | Data size in KB |
| `index_kb` | `number` | Index size in KB |
| `total_kb` | `number` | Total size in KB |
| `engine` | `string` | Storage engine |
| `collation` | `string` | Character collation |
| `CREATE_TIME` | `string` | Creation timestamp |
| `UPDATE_TIME` | `string` | Last update timestamp |

#### MSSQL `size` Fields
| Field | Type | Description |
|-------|------|-------------|
| `row_count` | `number` | Row count |
| `total_kb` | `number` | Total allocated KB |
| `used_kb` | `number` | Used KB |

---

### `POST /api/database/table-create-sql`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `sql` | `string` | CREATE TABLE DDL (MySQL) or placeholder comment (MSSQL) |

---

### `POST /api/database/processes`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `processes[]` | `object[]` | Array of process objects |

#### MySQL Fields (from `SHOW FULL PROCESSLIST`)
| Field | Type | Description |
|-------|------|-------------|
| `Id` | `number` | Thread ID |
| `User` | `string` | MySQL user |
| `Host` | `string` | Client host:port |
| `db` | `string \| null` | Current database |
| `Command` | `string` | Current command |
| `Time` | `number` | Seconds in current state |
| `State` | `string` | Thread state |
| `Info` | `string \| null` | Current SQL (full text) |

#### MSSQL Fields
| Field | Type | Description |
|-------|------|-------------|
| `Id` | `number` | Session ID (aliased from `session_id`) |
| `Status` | `string` | Request status |
| `Command` | `string` | Command type |
| `db` | `string` | Database name (via `DB_NAME()`) |
| `State` | `string \| null` | Wait type |
| `Time` | `number` | Elapsed time in ms |

---

### `POST /api/database/status`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `status` | `object` | Key-value status variables |

#### MySQL Status Keys
| Key | Source | Description |
|-----|--------|-------------|
| `version` | `SELECT VERSION()` | MySQL version string |
| `Uptime` | `SHOW GLOBAL STATUS` | Server uptime in seconds |
| `Threads_connected` | `SHOW GLOBAL STATUS` | Current connected threads |
| `Questions` | `SHOW GLOBAL STATUS` | Total queries executed |
| `Slow_queries` | `SHOW GLOBAL STATUS` | Slow query count |
| `Open_tables` | `SHOW GLOBAL STATUS` | Open tables count |
| `Bytes_received` | `SHOW GLOBAL STATUS` | Total bytes received |
| `Bytes_sent` | `SHOW GLOBAL STATUS` | Total bytes sent |

#### MSSQL Status Keys
| Key | Source | Description |
|-----|--------|-------------|
| `server_name` | `@@SERVERNAME` | Server instance name |
| `version` | `@@VERSION` | Full version string |
| `current_db` | `DB_NAME()` | Current database |
| `user_connections` | `sys.dm_exec_sessions` | Active user connections |

---

### `POST /api/database/query`

#### SELECT Results
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `columns[]` | `string[]` | Column names |
| `rows[]` | `object[]` | Row data |
| `rowCount` | `number` | Number of rows returned |

#### DML Results
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` |
| `affectedRows` | `number` | Rows affected |
| `insertId` | `number` | Last inserted ID (MySQL) |
| `message` | `string` | Summary message |
| `columns` | `[]` | Empty array |
| `rows` | `[]` | Empty array |

---

### `POST /api/database/export-csv`

**Content-Type**: `text/csv`  
**Content-Disposition**: `attachment; filename="export.csv"`

Returns raw CSV text with proper escaping.

---

## Frontend State Variables

### DatabaseManager Component
| State | Type | Default | Storage | Description |
|-------|------|---------|---------|-------------|
| `connections` | `Connection[]` | `[]` | API (`db_connections` table) | Saved connection configurations (shared across users) |
| `loadingConnections` | `boolean` | `true` | — | Whether connections are being fetched from API |
| `sshKeys` | `SSHKeyInfo[]` | `[]` | — | Available SSH keys from server |
| `activeConnection` | `Connection \| null` | `null` | — | Currently active connection |
| `connected` | `boolean` | `false` | — | Whether actively connected |
| `connecting` | `boolean` | `false` | — | Connection attempt in progress |
| `sql` | `string` | `''` | — | Current SQL editor content |
| `result` | `QueryResult \| null` | `null` | — | Last query result |
| `executing` | `boolean` | `false` | — | Query execution in progress |
| `databases` | `string[]` | `[]` | — | Available databases on connected server |
| `tables` | `TableInfo[]` | `[]` | — | Tables in current database |
| `loadingTables` | `boolean` | `false` | — | Table list loading |
| `expandedTable` | `string \| null` | `null` | — | Currently expanded table in sidebar |
| `tableColumns` | `Record<string, any[]>` | `{}` | — | Cached column info per table |
| `dialogOpen` | `boolean` | `false` | — | Connection dialog visibility |
| `editingConn` | `Connection \| null` | `null` | — | Connection being edited (null = new) |
| `mainTab` | `MainTab` | `'query'` | — | Active main area tab |
| `browsingTable` | `string \| null` | `null` | — | Table being browsed |
| `queryHistory` | `string[]` | `[]` | `localStorage: db_query_history` | Recent SQL queries (max 100) |
| `savedQueries` | `{ name, sql }[]` | `[]` | `localStorage: db_saved_queries` | Named saved queries |
| `showHistory` | `boolean` | `false` | — | History panel visibility |
| `showSaved` | `boolean` | `false` | — | Saved queries panel visibility |
| `sidebarCollapsed` | `boolean` | `false` | — | Sidebar collapse state |
| `tableInfo` | `any` | `null` | — | Table size stats |
| `tableIndexes` | `any[]` | `[]` | — | Table indexes |
| `createSQL` | `string` | `''` | — | CREATE TABLE DDL |
| `processes` | `any[]` | `[]` | — | Active processes |
| `serverStatus` | `any` | `null` | — | Server status |
| `infoTable` | `string \| null` | `null` | — | Table shown in Info tab |

### TableBrowser Component
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `rows` | `any[]` | `[]` | Current page of table data |
| `columns` | `string[]` | `[]` | Column names |
| `total` | `number` | `0` | Total row count |
| `page` | `number` | `1` | Current page |
| `pageSize` | `number` | `100` | Rows per page |
| `loading` | `boolean` | `false` | Data loading state |
| `sortColumn` | `string \| null` | `null` | Current sort column |
| `sortDirection` | `'ASC' \| 'DESC' \| null` | `null` | Current sort direction |
| `filters` | `FilterObject[]` | `[]` | Active server-side filters |
| `filterCol` | `string` | `''` | Filter column being configured |
| `filterOp` | `string` | `'LIKE'` | Filter operator being configured |
| `filterVal` | `string` | `''` | Filter value being configured |
| `editingRow` | `number \| null` | `null` | Index of row being edited inline |
| `editForm` | `Record<string, any>` | `{}` | Form data for inline edit |
| `showNewRow` | `boolean` | `false` | Whether new row form is visible |
| `newRowForm` | `Record<string, any>` | `{}` | Form data for new row |
| `selectedRows` | `Set<number>` | `new Set()` | Indices of selected rows (checkboxes) |
| `primaryKeys` | `string[]` | `[]` | Detected primary key columns |

### ConnectionDialog Component
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `form` | `Connection` | From prop or empty | Form data for connection fields |
| `testing` | `boolean` | `false` | Test connection in progress |
| `testResult` | `string \| null` | `null` | Test result message |

---

## localStorage Keys

| Key | Type | Max Size | Description |
|-----|------|----------|-------------|
| `db_query_history` | `string[]` | 100 entries | Recent SQL queries (newest first, deduped) |
| `db_saved_queries` | `{ name: string, sql: string }[]` | Unbounded | Named saved queries |

**Note**: Connection configurations are no longer stored in localStorage. They are stored in the `db_connections` MySQL table and fetched via `GET /database/connections`.
