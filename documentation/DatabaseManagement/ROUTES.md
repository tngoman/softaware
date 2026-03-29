# Database Management — Routes & API Reference

## Backend Routes

All routes are mounted under `/api/database` via:
```typescript
apiRouter.use('/database', databaseManagerRouter);
```

**Auth**: ✅ All routes protected by `requireAuth` + `requireDeveloper` middleware chain.
```typescript
// In databaseManager.ts:
router.use(requireAuth, requireDeveloper);
```

**Allowed Roles**: `developer`, `admin`, `super_admin` (checked via `user_roles` JOIN `roles` table).

---

## Connection Management Endpoints

### `GET /api/database/connections`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List saved database connections. Admins see all; non-admin developers see only connections they've been granted access to via `db_connection_access`.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
  "success": true,
  "connections": [
    {
      "id": "a1b2c3d4-...",
      "name": "Production MySQL",
      "host": "10.0.6.12",
      "port": 3306,
      "user": "app_user",
      "password": "***",
      "database": "myapp",
      "type": "mysql",
      "tunnel": {
        "sshHost": "40.123.240.58",
        "sshPort": 2288,
        "sshUser": "SoftAware",
        "sshPassword": null,
        "sshKeyFile": "softaware_id_ed25519"
      },
      "createdBy": "user-uuid",
      "createdAt": "2025-03-01T...",
      "updatedAt": "2025-03-01T...",
      "accessUsers": [
        { "userId": "uuid", "name": "Jane Dev", "email": "jane@example.com" }
      ]
    }
  ]
}
```

**Flow**:
1. Call `isAdminUser()` to check `users.is_admin` for requesting user
2. If admin: `SELECT * FROM db_connections ORDER BY name ASC`
3. If non-admin: filter by `JOIN db_connection_access WHERE user_id = requestingUserId`
4. For each connection, JOIN `db_connection_access` + `users` to build `accessUsers[]`
5. Map flat DB rows to nested `Connection` shape and return

---

### `POST /api/database/connections`
**Auth**: requireAuth + requireDeveloper + **admin only**  
**Purpose**: Create or update a connection (upsert) and set per-user access. Returns 403 for non-admin users.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `id` | Body | No | Connection UUID (if updating; auto-generated via `crypto.randomUUID()` if creating) |
| `name` | Body | Yes | Connection display name |
| `host` | Body | Yes | Database host |
| `port` | Body | No | Database port (default 3306) |
| `user` | Body | No | Database username |
| `password` | Body | No | Database password |
| `database` | Body | No | Default database name |
| `type` | Body | Yes | `'mysql'` or `'mssql'` |
| `tunnel` | Body | No | SSH tunnel config object |
| `accessUserIds` | Body | No | Array of user UUIDs to grant access to this connection |

**Response** `200`:
```json
{ "success": true, "id": "a1b2c3d4-..." }
```

**Response** `403` (non-admin):
```json
{ "success": false, "error": "Admin access required" }
```

**Flow**:
1. Check `isAdminUser()` — return 403 if not admin
2. Validate `name`, `host`, and `type` required
3. Extract `userId` from JWT (via `AuthRequest`)
4. Generate UUID if no `id` provided
5. `INSERT INTO db_connections ... ON DUPLICATE KEY UPDATE`
6. Sync `db_connection_access`: delete existing rows for this connection, re-insert one row per `accessUserIds` entry (with `granted_by = userId`)
7. Return connection ID

---

### `DELETE /api/database/connections/:id`
**Auth**: requireAuth + requireDeveloper + **admin only**  
**Purpose**: Delete a saved connection and all its access entries. Returns 403 for non-admin users.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `id` | URL | Yes | Connection UUID |

**Response** `200`:
```json
{ "success": true }
```

**Response** `403` (non-admin):
```json
{ "success": false, "error": "Admin access required" }
```

**Flow**:
1. Check `isAdminUser()` — return 403 if not admin
2. `DELETE FROM db_connection_access WHERE connection_id = ?`
3. `DELETE FROM db_connections WHERE id = ?`

---

## SSH Key Endpoint

---

### `GET /api/database/developer-users`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List all users with the `developer` role. Used by the ConnectionDialog access panel to populate the user checkbox list.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
  "success": true,
  "users": [
    { "id": "uuid", "name": "Jane Dev", "email": "jane@example.com" }
  ]
}
```

**Flow**:
1. Query `users` JOIN `user_roles` JOIN `roles` WHERE `r.slug = 'developer'`
2. Return `id`, `name`, `email` for each matching user

---

### `GET /api/database/keys`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List available SSH private key files for tunnel configuration.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
  "success": true,
  "keys": [
    { "name": "softaware_id_ed25519", "hasPublicKey": true, "size": 399 }
  ]
}
```

**Flow**:
1. Read `/var/opt/backend/keys/` directory
2. Filter out `.pub` files and dotfiles (names starting with `.`)
3. For each remaining file, check if `{name}.pub` exists
4. Return file info array

---

## Connection & Schema Endpoints

### `POST /api/database/connect`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Test database connection (optionally through SSH tunnel).

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host` | Body | Yes | Database host |
| `port` | Body | Yes | Database port |
| `user` | Body | Yes | Database username |
| `password` | Body | Yes | Database password |
| `type` | Body | Yes | `'mysql'` or `'mssql'` |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{ "success": true, "message": "Connected successfully" }
```

**Error Response** `400`:
```json
{ "success": false, "error": "Connection refused" }
```

**Flow**:
1. If `type === 'mysql'`: call `withMySQL()` → `connection.ping()`
2. If `type === 'mssql'`: call `withMSSQL()` → `pool.request().query('SELECT 1 AS ok')`
3. SSH tunnel is created/destroyed within the `with*` helper

---

### `POST /api/database/databases`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List all databases on the connected server.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{
  "success": true,
  "databases": ["information_schema", "mysql", "myapp_production", "test"]
}
```

**MySQL Query**: `SHOW DATABASES` → maps `Database` column  
**MSSQL Query**: `SELECT name FROM sys.databases WHERE state_desc='ONLINE' ORDER BY name`

---

### `POST /api/database/tables`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List tables and views in a specific database.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database name |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{
  "success": true,
  "tables": [
    { "name": "users", "type": "BASE TABLE", "rows": 1250, "engine": "InnoDB" },
    { "name": "active_users_view", "type": "VIEW", "rows": null, "engine": null }
  ]
}
```

**Note**: `rows` and `engine` are only populated for MySQL. MSSQL returns `null` for both.

---

### `POST /api/database/describe`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Get column definitions for a table.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "success": true,
  "columns": [
    { "Field": "id", "Type": "int(11)", "Null": "NO", "Key": "PRI", "Default": null, "Extra": "auto_increment" },
    { "Field": "email", "Type": "varchar(255)", "Null": "NO", "Key": "UNI", "Default": null, "Extra": "" }
  ]
}
```

**Response** `200` (MSSQL):
```json
{
  "success": true,
  "columns": [
    { "Field": "id", "Type": "int", "Null": "NO", "Key": "PRI", "Default": null },
    { "Field": "email", "Type": "nvarchar(255)", "Null": "NO", "Key": "", "Default": null }
  ]
}
```

**Note**: MSSQL response now normalizes column names to match MySQL (`Field`, `Type`, `Null`, `Key`, `Default`) via aliased SQL.

---

### `POST /api/database/indexes`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List indexes on a table.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL — one row per index-column combination):
```json
{
  "success": true,
  "indexes": [
    { "Table": "users", "Non_unique": 0, "Key_name": "PRIMARY", "Column_name": "id", "Index_type": "BTREE" }
  ]
}
```

**Response** `200` (MSSQL — aggregated by index):
```json
{
  "success": true,
  "indexes": [
    { "index_name": "PK_users", "columns": "id", "is_unique": true, "index_type": "CLUSTERED" }
  ]
}
```

---

## Table Data & CRUD Endpoints

### `POST /api/database/table-data`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Fetch paginated rows from a table with server-side sorting and filtering.

| Param | Location | Required | Default | Description |
|-------|----------|----------|---------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | — | Connection details |
| `database` | Body | Yes | — | Target database |
| `table` | Body | Yes | — | Target table |
| `page` | Body | No | `1` | Page number (1-based) |
| `pageSize` | Body | No | `100` | Rows per page (max 1000) |
| `sortColumn` | Body | No | — | Column name to sort by |
| `sortDirection` | Body | No | `'ASC'` | `'ASC'` or `'DESC'` |
| `filters` | Body | No | `[]` | Array of filter objects (see below) |
| `tunnel` | Body | No | — | SSH tunnel config |

**Filter Object Shape**:
```json
{ "column": "email", "operator": "LIKE", "value": "example.com" }
```

**Supported Filter Operators**: `LIKE`, `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS NULL`, `IS NOT NULL`, `REGEXP` (MySQL only)

**Response** `200`:
```json
{
  "success": true,
  "rows": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" }
  ],
  "columns": ["id", "name", "email"],
  "total": 1250,
  "page": 1,
  "pageSize": 100
}
```

**MySQL Query**: `SELECT * FROM \`table\` WHERE ... ORDER BY \`col\` ASC LIMIT ? OFFSET ?` (parameterized values)  
**MSSQL Query**: `SELECT * FROM [table] WHERE ... ORDER BY [col] ASC OFFSET N ROWS FETCH NEXT M ROWS ONLY`

**Note**: `pageSize` is capped at 1000 regardless of request value. Filters generate server-side WHERE clauses. MySQL uses parameterized queries for filter values; MSSQL uses string interpolation with quote escaping.

---

### `POST /api/database/row-insert`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Insert a new row into a table.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `row` | Body | Yes | Key-value object of column→value pairs |
| `tunnel` | Body | No | SSH tunnel config |

**Request Example**:
```json
{
  "...connection fields...",
  "table": "users",
  "row": { "name": "Alice", "email": "alice@example.com", "active": 1 }
}
```

**Response** `200`:
```json
{ "success": true, "message": "Row inserted" }
```

**Flow**: Generates `INSERT INTO table (col1, col2) VALUES (?, ?)` with parameterized values. Empty strings are converted to `null`.

---

### `POST /api/database/row-update`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Update a row identified by primary key values.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `row` | Body | Yes | Key-value object of columns to update |
| `where` | Body | Yes | Key-value object of primary key columns for WHERE clause |
| `tunnel` | Body | No | SSH tunnel config |

**Request Example**:
```json
{
  "...connection fields...",
  "table": "users",
  "row": { "name": "Alice Updated", "email": "newalice@example.com" },
  "where": { "id": 1 }
}
```

**Response** `200`:
```json
{ "success": true, "message": "Row updated" }
```

**Flow**: Generates `UPDATE table SET col1=?, col2=? WHERE pk_col=? LIMIT 1` (MySQL) or `UPDATE TOP(1) [table] SET ... WHERE ...` (MSSQL). Null values in `where` generate `IS NULL` clauses.

---

### `POST /api/database/row-delete`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Delete a row identified by primary key values.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `where` | Body | Yes | Key-value object of primary key columns for WHERE clause |
| `tunnel` | Body | No | SSH tunnel config |

**Request Example**:
```json
{
  "...connection fields...",
  "table": "users",
  "where": { "id": 1 }
}
```

**Response** `200`:
```json
{ "success": true, "message": "Row deleted" }
```

**Flow**: Generates `DELETE FROM table WHERE pk_col=? LIMIT 1` (MySQL) or `DELETE TOP(1) FROM [table] WHERE ...` (MSSQL). Null values in `where` generate `IS NULL` clauses.

---

## Table Operations Endpoints

### `POST /api/database/import-sql`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Execute a SQL file/dump by splitting statements and running them sequentially.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | No | Target database |
| `sql` | Body | Yes | SQL content (multiple statements separated by `;\n`) |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{
  "success": true,
  "message": "15 statement(s) executed",
  "executed": 15,
  "errors": [],
  "totalStatements": 15
}
```

**Response with partial errors**:
```json
{
  "success": true,
  "message": "12 statement(s) executed",
  "executed": 12,
  "errors": [
    "Table 'foo' already exists — CREATE TABLE foo...",
    "Unknown column 'bar' — ALTER TABLE baz ADD COLUMN bar..."
  ],
  "totalStatements": 15
}
```

**Flow**:
1. Split SQL by `;\n` (semicolon followed by newline)
2. Filter empty lines and `--` comments
3. Execute each statement sequentially
4. Collect errors (max 20 returned) without stopping execution
5. Return summary with executed count + error list

---

### `POST /api/database/truncate`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Truncate (empty) a table.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{ "success": true, "message": "Table users truncated" }
```

**Flow**: Executes `TRUNCATE TABLE \`table\`` (MySQL) or `TRUNCATE TABLE [table]` (MSSQL) with identifier escaping.

---

### `POST /api/database/drop-table`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Drop (delete) a table permanently.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{ "success": true, "message": "Table users dropped" }
```

**Flow**: Executes `DROP TABLE \`table\`` (MySQL) or `DROP TABLE [table]` (MSSQL) with identifier escaping.

---

## Table Info Endpoints

### `POST /api/database/table-size`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Get table size statistics.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "success": true,
  "size": {
    "row_count": 1250,
    "data_kb": 256,
    "index_kb": 64,
    "total_kb": 320,
    "engine": "InnoDB",
    "collation": "utf8mb4_general_ci",
    "CREATE_TIME": "2024-01-15 10:30:00",
    "UPDATE_TIME": "2025-03-01 14:00:00"
  }
}
```

**Response** `200` (MSSQL):
```json
{
  "success": true,
  "size": {
    "row_count": 1250,
    "total_kb": 320,
    "used_kb": 256
  }
}
```

---

### `POST /api/database/table-create-sql`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Get the CREATE TABLE DDL statement.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database |
| `table` | Body | Yes | Target table |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "success": true,
  "sql": "CREATE TABLE `users` (\n  `id` int(11) NOT NULL AUTO_INCREMENT,\n  ...)"
}
```

**Response** `200` (MSSQL):
```json
{
  "success": true,
  "sql": "-- CREATE TABLE DDL not supported for MSSQL in this version"
}
```

---

## Monitoring Endpoints

### `POST /api/database/processes`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List active database processes/sessions.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "success": true,
  "processes": [
    { "Id": 42, "User": "app_user", "Host": "10.0.0.5:52412", "db": "production", "Command": "Query", "Time": 0, "State": "executing", "Info": "SELECT * FROM orders" }
  ]
}
```

**MySQL Query**: `SHOW FULL PROCESSLIST`  
**MSSQL Query**: `SELECT session_id AS Id, status, command, DB_NAME(database_id) AS [db], wait_type, total_elapsed_time AS Time FROM sys.dm_exec_requests WHERE session_id > 50`

---

### `POST /api/database/status`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Get server version and status variables.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "success": true,
  "status": {
    "version": "8.0.35-0ubuntu0.22.04.1",
    "Uptime": "345600",
    "Threads_connected": "5",
    "Questions": "1234567",
    "Slow_queries": "12",
    "Open_tables": "200",
    "Bytes_received": "987654321",
    "Bytes_sent": "1234567890"
  }
}
```

**Response** `200` (MSSQL):
```json
{
  "success": true,
  "status": {
    "server_name": "SQLSERVER01",
    "version": "Microsoft SQL Server 2019...",
    "current_db": "master",
    "user_connections": "12"
  }
}
```

---

## Query & Export Endpoints

### `POST /api/database/query`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Execute arbitrary SQL and return results.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | No | Target database |
| `sql` | Body | Yes | SQL query to execute |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (SELECT):
```json
{
  "success": true,
  "columns": ["id", "name", "email"],
  "rows": [{ "id": 1, "name": "Alice", "email": "alice@example.com" }],
  "rowCount": 1
}
```

**Response** `200` (DML):
```json
{
  "success": true,
  "columns": [],
  "rows": [],
  "affectedRows": 5,
  "insertId": 0,
  "message": "5 row(s) affected"
}
```

---

### `POST /api/database/export-csv`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Execute SQL and return results as a downloadable CSV file.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | No | Target database |
| `sql` | Body | Yes | SQL query to execute |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="export.csv"

id,name,email
1,Alice,alice@example.com
2,"Bob, Jr.","bob@example.com"
```

**CSV escaping**: Fields containing commas, double-quotes, or newlines are wrapped in double-quotes. Internal double-quotes are doubled.

---

## Database Export Endpoints

### `POST /api/database/export-database`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Start a full database SQL dump. Writes to server filesystem asynchronously; responds immediately with the output filename. MySQL only (MSSQL returns 400).

| Param | Location | Required | Default | Description |
|-------|----------|----------|---------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | — | Connection details |
| `database` | Body | Yes | — | Database to export |
| `tunnel` | Body | No | — | SSH tunnel config |
| `exportType` | Body | No | `'structure_and_data'` | `'structure'`, `'data'`, or `'structure_and_data'` |
| `selectedTables` | Body | No | all tables | Array of table names to include |
| `addDropTable` | Body | No | `true` | Prepend `DROP TABLE IF EXISTS` before each CREATE |
| `addCreateDatabase` | Body | No | `false` | Prepend `CREATE DATABASE IF NOT EXISTS` + `USE` |

**Response** `200` (immediate — export runs in background):
```json
{ "success": true, "filename": "mydb_structure_and_data_2026-03-28_14-30-00.sql", "message": "Export started" }
```

**Error Response** `400`:
```json
{ "success": false, "error": "Database export is currently supported for MySQL only" }
```

**Flow**:
1. Validate `database` required, reject MSSQL
2. Generate filename: `{safeDbName}_{exportType}_{timestamp}.sql`
3. Respond immediately with `{success, filename, message}`
4. In background: open `fs.WriteStream` to `EXPORTS_DIR/filename`
5. Write SQL header lines, SET statements
6. If no `selectedTables`, query `information_schema.TABLES` for all base tables
7. For each table: write DROP/CREATE DDL (if structure), write batched INSERT statements (if data, 100 rows/batch)
8. Write `SET FOREIGN_KEY_CHECKS = 1` footer
9. On error: write `-- EXPORT FAILED: {message}` to file, close stream

**File location**: `/var/opt/backend/db-exports/{filename}`

---

### `GET /api/database/export-files`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: List all SQL export files stored on the server.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
  "success": true,
  "files": [
    {
      "name": "mydb_structure_and_data_2026-03-28_14-30-00.sql",
      "size": 2048576,
      "createdAt": "2026-03-28T14:30:00.000Z",
      "modifiedAt": "2026-03-28T14:30:45.000Z"
    }
  ]
}
```

**Flow**: Read `EXPORTS_DIR`, filter `.sql` files, stat each, sort by `modifiedAt` descending.

---

### `GET /api/database/export-files/:filename/download`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Stream a specific export file to the client as a download.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `filename` | URL | Yes | Filename (must end in `.sql`) |

**Response** `200`:
```
Content-Type: application/sql
Content-Disposition: attachment; filename="mydb_export.sql"
[file contents streamed]
```

**Security**: `path.basename()` applied to `filename` param to prevent path traversal. Only `.sql` files allowed.

---

### `DELETE /api/database/export-files/:filename`
**Auth**: requireAuth + requireDeveloper  
**Purpose**: Delete a specific export file from the server.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `filename` | URL | Yes | Filename (must end in `.sql`) |

**Response** `200`:
```json
{ "success": true }
```

**Security**: `path.basename()` applied to prevent path traversal. Only `.sql` extension allowed.

---

## Frontend Routes

| Route Path | Component | Guard | Description |
|------------|-----------|-------|-------------|
| `/database` | `DatabaseManager.tsx` | `<DeveloperRoute>` | Full database administration interface |

---

## Frontend → Backend API Call Map

| Frontend Action | API Call | Trigger |
|-----------------|----------|---------|
| Component mount | `GET /database/keys` | `useEffect` on mount |
| Load connections | `GET /database/connections` | `useEffect` on mount |
| Load developer users | `GET /database/developer-users` | `useEffect` on mount (admin only — used for access panel) |
| Save connection | `POST /database/connections` | Save button in ConnectionDialog (admin only) |
| Delete connection | `DELETE /database/connections/:id` | Delete button (admin only, with SweetAlert2 confirm) |
| Connect to server | `POST /database/connect` | "Test Connection" button or connection click |
| Load databases | `POST /database/databases` | After successful connect |
| Load tables | `POST /database/tables` | After successful connect + on database switch |
| Expand table columns | `POST /database/describe` | Click table expand arrow in sidebar |
| Browse table data | `POST /database/table-data` | Click browse icon or Browse tab (with sort/filter params) |
| Insert row | `POST /database/row-insert` | New row form submit in TableBrowser |
| Update row | `POST /database/row-update` | Inline edit save in TableBrowser |
| Delete row | `POST /database/row-delete` | Delete button in TableBrowser (with confirm) |
| Import SQL | `POST /database/import-sql` | Import tab — file upload, paste, or execute button |
| Truncate table | `POST /database/truncate` | Truncate button (sidebar hover or Info tab, with SweetAlert2 confirm) |
| Drop table | `POST /database/drop-table` | Drop button (sidebar hover or Info tab, with SweetAlert2 confirm) |
| Load table info | `POST /table-size` + `/indexes` + `/table-create-sql` | Click info icon (parallel fetch) |
| Execute SQL | `POST /database/query` | Ctrl+Enter or Execute button |
| View processes | `POST /database/processes` | Click Processes tab or toolbar button |
| View server status | `POST /database/status` | Click Server tab or toolbar button |
| Start database export | `POST /database/export-database` | "Start Export" button on Export tab |
| List export files | `GET /database/export-files` | Export tab open + Refresh button + post-export polling (3s, 8s, 20s) |
| Download export file | `GET /database/export-files/:filename/download` | Download button on file list row (direct `<a href>`) |
| Delete export file | `DELETE /database/export-files/:filename` | Delete button on file list row (with SweetAlert2 confirm) |
| Export CSV (client) | — (client-side) | CSV export button on Results tab |
| Export JSON (client) | — (client-side) | JSON export button on Results tab |
| Copy to clipboard | — (client-side) | Copy button on Results tab |
