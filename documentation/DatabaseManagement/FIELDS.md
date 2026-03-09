# Database Management — Field & Data Dictionary

## Request Body: `ConnectionBody` (all POST endpoints)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host` | `string` | Yes | Database server hostname or IP |
| `port` | `number` | Yes | Database server port (3306 for MySQL, 1433 for MSSQL) |
| `user` | `string` | Yes | Database username |
| `password` | `string` | Yes | Database password |
| `database` | `string` | Some endpoints | Target database name (required for tables, describe, indexes, table-data, table-size, table-create-sql) |
| `type` | `'mysql' \| 'mssql'` | Yes | Database engine type |
| `tunnel` | `TunnelConfig \| null` | No | SSH tunnel configuration (see below) |
| `table` | `string` | Some endpoints | Target table name (for describe, indexes, table-data, table-size, table-create-sql) |
| `sql` | `string` | Some endpoints | SQL query string (for query, export-csv) |
| `page` | `number` | No | Page number for pagination (default 1) |
| `pageSize` | `number` | No | Rows per page (default 100, max 1000) |

## Request Body: `TunnelConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sshHost` | `string` | Yes | SSH server hostname |
| `sshPort` | `number` | No | SSH server port (default 22) |
| `sshUser` | `string` | Yes | SSH username |
| `sshPassword` | `string` | Conditional | SSH password — required if `sshKeyFile` is not provided |
| `sshKeyFile` | `string` | Conditional | Filename of private key in `/var/opt/backend/keys/` — required if `sshPassword` is not provided |

---

## API Response: `GET /api/database/keys`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `keys[]` | `array` | Filesystem | Array of SSH key file info objects |
| `keys[].name` | `string` | Filename | Private key filename (e.g., `softaware_id_ed25519`) |
| `keys[].hasPublicKey` | `boolean` | Filesystem check | Whether `{name}.pub` exists alongside the private key |
| `keys[].size` | `number` | `fs.statSync().size` | File size in bytes |

---

## API Response: `POST /api/database/connect`

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` if connection + ping/SELECT 1 succeeded |
| `error` | `string` | Error message if connection failed (only on failure) |

---

## API Response: `POST /api/database/databases`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `databases[]` | `string[]` | `SHOW DATABASES` (MySQL) or `sys.databases` (MSSQL) | List of database names |

### MySQL Query
```sql
SHOW DATABASES
```
Returns `Database` column, mapped to string array.

### MSSQL Query
```sql
SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name
```

---

## API Response: `POST /api/database/tables`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `tables[]` | `array` | `INFORMATION_SCHEMA.TABLES` | Array of table info objects |
| `tables[].name` | `string` | `TABLE_NAME` | Table or view name |
| `tables[].type` | `string` | `TABLE_TYPE` | `'BASE TABLE'` or `'VIEW'` |
| `tables[].rows` | `number \| null` | `TABLE_ROWS` (MySQL only) | Approximate row count (InnoDB estimate) |
| `tables[].engine` | `string \| null` | `ENGINE` (MySQL only) | Storage engine (InnoDB, MyISAM, etc.) |

### MySQL Query
```sql
SELECT TABLE_NAME AS name, TABLE_TYPE AS type, TABLE_ROWS AS `rows`, ENGINE AS engine
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = ?
ORDER BY TABLE_NAME
```

### MSSQL Query
```sql
SELECT TABLE_NAME AS name, TABLE_TYPE AS type
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_CATALOG = @db
ORDER BY TABLE_NAME
```

---

## API Response: `POST /api/database/describe`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `columns[]` | `array` | `DESCRIBE` (MySQL) or `INFORMATION_SCHEMA.COLUMNS` (MSSQL) | Column definitions |

### MySQL Fields
| Field | Type | Description |
|-------|------|-------------|
| `Field` | `string` | Column name |
| `Type` | `string` | Data type (e.g., `varchar(255)`, `int(11)`) |
| `Null` | `string` | `'YES'` or `'NO'` |
| `Key` | `string` | `'PRI'`, `'UNI'`, `'MUL'`, or empty |
| `Default` | `any` | Default value or `null` |
| `Extra` | `string` | Additional info (e.g., `auto_increment`) |

### MSSQL Fields
| Field | Type | Description |
|-------|------|-------------|
| `COLUMN_NAME` | `string` | Column name |
| `DATA_TYPE` | `string` | Data type (e.g., `nvarchar`, `int`) |
| `CHARACTER_MAXIMUM_LENGTH` | `number \| null` | Max length for string types |
| `IS_NULLABLE` | `string` | `'YES'` or `'NO'` |
| `COLUMN_DEFAULT` | `any` | Default value or `null` |
| `Key` | `string` | `'PRI'` if column is in a PRIMARY KEY constraint, else empty |

---

## API Response: `POST /api/database/indexes`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `indexes[]` | `array` | `SHOW INDEX` (MySQL) or `sys.indexes` (MSSQL) | Index definitions |

### MySQL Fields (from `SHOW INDEX`)
| Field | Type | Description |
|-------|------|-------------|
| `Table` | `string` | Table name |
| `Non_unique` | `number` | `0` = unique, `1` = non-unique |
| `Key_name` | `string` | Index name (e.g., `PRIMARY`) |
| `Column_name` | `string` | Indexed column name |
| `Index_type` | `string` | `BTREE`, `HASH`, `FULLTEXT` |
| (+ other MySQL SHOW INDEX fields) | | |

### MSSQL Fields (from query)
| Field | Type | Description |
|-------|------|-------------|
| `index_name` | `string` | Index name |
| `columns` | `string` | Comma-separated column names (via `STRING_AGG`) |
| `is_unique` | `boolean` | Whether the index is unique |
| `type_desc` | `string` | Index type (`CLUSTERED`, `NONCLUSTERED`, `HEAP`) |

---

## API Response: `POST /api/database/table-data`

| Field | Type | Description |
|-------|------|-------------|
| `rows[]` | `object[]` | Array of row objects (column→value) |
| `columns[]` | `string[]` | Column name array (order preserved) |
| `total` | `number` | Total row count in table (from `COUNT(*)`) |
| `page` | `number` | Current page number |
| `pageSize` | `number` | Rows per page (max 1000) |

---

## API Response: `POST /api/database/table-size`

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `size` | `object` | Query result | Size statistics object |

### MySQL `size` Fields
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `row_count` | `number` | `TABLE_ROWS` | Approximate row count |
| `data_kb` | `number` | `ROUND(DATA_LENGTH/1024)` | Data size in KB |
| `index_kb` | `number` | `ROUND(INDEX_LENGTH/1024)` | Index size in KB |
| `total_kb` | `number` | `ROUND((DATA_LENGTH+INDEX_LENGTH)/1024)` | Total size in KB |
| `engine` | `string` | `ENGINE` | Storage engine |
| `created` | `string` | `CREATE_TIME` | Table creation timestamp |
| `collation` | `string` | `TABLE_COLLATION` | Character collation |

### MSSQL `size` Fields
| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `row_count` | `number` | `SUM(rows)` from `sys.partitions` | Exact row count |
| `total_kb` | `number` | `SUM(total_pages)*8` from `sys.allocation_units` | Total allocated KB |
| `data_kb` | `number` | `SUM(used_pages)*8` | Used data KB |

---

## API Response: `POST /api/database/table-create-sql`

| Field | Type | Description |
|-------|------|-------------|
| `sql` | `string` | CREATE TABLE statement (MySQL) or placeholder message (MSSQL) |

**MySQL**: Returns the `Create Table` column from `SHOW CREATE TABLE tableName`.  
**MSSQL**: Returns `"(MSSQL CREATE TABLE scripting not yet supported)"`.

---

## API Response: `POST /api/database/processes`

| Field | Type | Description |
|-------|------|-------------|
| `processes[]` | `object[]` | Array of process objects (dynamic columns) |

### MySQL Fields (from `SHOW FULL PROCESSLIST`)
| Field | Type | Description |
|-------|------|-------------|
| `Id` | `number` | Connection/thread ID |
| `User` | `string` | MySQL user |
| `Host` | `string` | Client host:port |
| `db` | `string \| null` | Current database |
| `Command` | `string` | Current command (Query, Sleep, etc.) |
| `Time` | `number` | Seconds in current state |
| `State` | `string` | Thread state |
| `Info` | `string \| null` | Current SQL statement (full text) |

### MSSQL Fields (from `sys.dm_exec_requests`)
| Field | Type | Description |
|-------|------|-------------|
| `session_id` | `number` | Session ID (> 50 = user sessions) |
| `login_name` | `string` | Login name |
| `status` | `string` | Request status |
| `command` | `string` | Current command type |
| `wait_type` | `string \| null` | Current wait type |
| `cpu_time` | `number` | CPU time in ms |
| `total_elapsed_time` | `number` | Elapsed time in ms |
| `reads` | `number` | Logical reads |
| `writes` | `number` | Logical writes |

---

## API Response: `POST /api/database/status`

| Field | Type | Description |
|-------|------|-------------|
| `status` | `object` | Key-value pairs of server status variables |

### MySQL Status Keys
| Key | Source | Description |
|-----|--------|-------------|
| `version` | `SELECT VERSION()` | MySQL version string |
| `Uptime` | `SHOW GLOBAL STATUS` | Server uptime in seconds |
| `Threads_connected` | `SHOW GLOBAL STATUS` | Current connected threads |
| `Questions` | `SHOW GLOBAL STATUS` | Total queries executed |
| `Slow_queries` | `SHOW GLOBAL STATUS` | Slow query count |
| `Bytes_received` | `SHOW GLOBAL STATUS` | Total bytes received |
| `Bytes_sent` | `SHOW GLOBAL STATUS` | Total bytes sent |

### MSSQL Status Keys
| Key | Source | Description |
|-----|--------|-------------|
| `server_name` | `@@SERVERNAME` | Server instance name |
| `version` | `@@VERSION` | Full version string |
| `spid` | `@@SPID` | Current session process ID |
| `user_connections` | `SELECT COUNT(*)` from `sys.dm_exec_sessions` | Active user connections |

---

## API Response: `POST /api/database/query`

### SELECT Results
| Field | Type | Description |
|-------|------|-------------|
| `columns[]` | `string[]` | Column names from result set |
| `rows[]` | `object[]` | Row data as column→value objects |
| `executionTime` | `number` | Query execution time in milliseconds |

### DML Results (INSERT/UPDATE/DELETE)
| Field | Type | Description |
|-------|------|-------------|
| `affectedRows` | `number` | Number of rows affected |
| `insertId` | `number` | Last inserted auto-increment ID (MySQL) |
| `message` | `string` | Summary message (e.g., "Query executed: 5 rows affected") |
| `columns` | `[]` | Empty array |
| `rows` | `[]` | Empty array |
| `executionTime` | `number` | Query execution time in milliseconds |

---

## API Response: `POST /api/database/export-csv`

**Content-Type**: `text/csv`  
**Content-Disposition**: `attachment; filename="export.csv"`

Returns raw CSV text — header row followed by data rows. Fields containing commas, quotes, or newlines are properly escaped.

---

## Frontend State Variables

### DatabaseManager Component
| State | Type | Default | Storage | Description |
|-------|------|---------|---------|-------------|
| `connections` | `Connection[]` | `[]` | `localStorage: db_connections_v2` | Saved connection configurations |
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
| `expandedTable` | `string \| null` | `null` | — | Currently expanded table in sidebar tree |
| `tableColumns` | `Record<string, any[]>` | `{}` | — | Cached column info per table name |
| `dialogOpen` | `boolean` | `false` | — | Connection dialog visibility |
| `editingConn` | `Connection \| null` | `null` | — | Connection being edited (null = new) |
| `mainTab` | `MainTab` | `'query'` | — | Active main area tab |
| `browsingTable` | `string \| null` | `null` | — | Table being browsed in Browse tab |
| `queryHistory` | `string[]` | `[]` | `localStorage: db_query_history` | Recent SQL queries (max 100, deduped) |
| `savedQueries` | `{ name, sql }[]` | `[]` | `localStorage: db_saved_queries` | Named saved queries |
| `showHistory` | `boolean` | `false` | — | History panel visibility |
| `showSaved` | `boolean` | `false` | — | Saved queries panel visibility |
| `sidebarCollapsed` | `boolean` | `false` | — | Sidebar collapse state |
| `tableInfo` | `any` | `null` | — | Table size stats for Info tab |
| `tableIndexes` | `any[]` | `[]` | — | Table indexes for Info tab |
| `createSQL` | `string` | `''` | — | CREATE TABLE DDL for Info tab |
| `processes` | `any[]` | `[]` | — | Active processes for Processes tab |
| `serverStatus` | `any` | `null` | — | Server status for Server tab |
| `infoTable` | `string \| null` | `null` | — | Table currently shown in Info tab |

### TableBrowser Component
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `rows` | `any[]` | `[]` | Current page of table data |
| `columns` | `string[]` | `[]` | Column names |
| `total` | `number` | `0` | Total row count |
| `page` | `number` | `1` | Current page |
| `pageSize` | `number` | `100` | Rows per page |
| `loading` | `boolean` | `false` | Data loading state |
| `filterCol` | `string` | `''` | Selected filter column |
| `filterVal` | `string` | `''` | Filter value (client-side WHERE) |

### ConnectionDialog Component
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `form` | `Partial<Connection>` | From prop or empty | Form data for connection fields |
| `testing` | `boolean` | `false` | Test connection in progress |
| `testResult` | `string \| null` | `null` | Test result message |

---

## localStorage Keys

| Key | Type | Max Size | Description |
|-----|------|----------|-------------|
| `db_connections_v2` | `Connection[]` | Unbounded | Saved connection configs (⚠️ includes plaintext passwords) |
| `db_query_history` | `string[]` | 100 entries | Recent SQL queries (newest first, deduped) |
| `db_saved_queries` | `{ name: string, sql: string }[]` | Unbounded | Named saved queries |
