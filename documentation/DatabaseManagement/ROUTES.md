# Database Management — Routes & API Reference

## Backend Routes

All routes are mounted under `/api/database` via:
```typescript
apiRouter.use('/database', databaseManagerRouter);
```
**Auth**: ⚠️ None — no `requireAuth` or permission middleware is applied.

---

### `GET /api/database/keys`
**Auth**: None  
**Purpose**: List available SSH private key files for tunnel configuration.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| — | — | — | No parameters |

**Response** `200`:
```json
{
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

**Error behavior**: Returns `{ error: message }` with status 500.

---

### `POST /api/database/connect`
**Auth**: None  
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
{ "success": true }
```

**Error Response** `500`:
```json
{ "error": "Connection refused" }
```

**Flow**:
1. If `type === 'mysql'`: call `withMySQL()` → `connection.ping()`
2. If `type === 'mssql'`: call `withMSSQL()` → `pool.request().query('SELECT 1 AS ok')`
3. SSH tunnel is created/destroyed within the `with*` helper

---

### `POST /api/database/databases`
**Auth**: None  
**Purpose**: List all databases on the connected server.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{
  "databases": ["information_schema", "mysql", "myapp_production", "test"]
}
```

**MySQL Query**: `SHOW DATABASES` → maps `Database` column  
**MSSQL Query**: `SELECT name FROM sys.databases WHERE state_desc='ONLINE' ORDER BY name`

---

### `POST /api/database/tables`
**Auth**: None  
**Purpose**: List tables and views in a specific database.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `database` | Body | Yes | Target database name |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200`:
```json
{
  "tables": [
    { "name": "users", "type": "BASE TABLE", "rows": 1250, "engine": "InnoDB" },
    { "name": "user_sessions", "type": "BASE TABLE", "rows": 8430, "engine": "InnoDB" },
    { "name": "active_users_view", "type": "VIEW", "rows": null, "engine": null }
  ]
}
```

**Note**: `rows` and `engine` are only populated for MySQL. MSSQL returns `null` for both.

---

### `POST /api/database/describe`
**Auth**: None  
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
  "columns": [
    { "Field": "id", "Type": "int(11)", "Null": "NO", "Key": "PRI", "Default": null, "Extra": "auto_increment" },
    { "Field": "email", "Type": "varchar(255)", "Null": "NO", "Key": "UNI", "Default": null, "Extra": "" },
    { "Field": "created_at", "Type": "timestamp", "Null": "YES", "Key": "", "Default": "CURRENT_TIMESTAMP", "Extra": "" }
  ]
}
```

**Response** `200` (MSSQL):
```json
{
  "columns": [
    { "COLUMN_NAME": "id", "DATA_TYPE": "int", "CHARACTER_MAXIMUM_LENGTH": null, "IS_NULLABLE": "NO", "COLUMN_DEFAULT": null, "Key": "PRI" },
    { "COLUMN_NAME": "email", "DATA_TYPE": "nvarchar", "CHARACTER_MAXIMUM_LENGTH": 255, "IS_NULLABLE": "NO", "COLUMN_DEFAULT": null, "Key": "" }
  ]
}
```

**MSSQL PK Detection**: Joins `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` (constraint_type='PRIMARY KEY') with `INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE` to identify primary key columns.

---

### `POST /api/database/indexes`
**Auth**: None  
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
  "indexes": [
    { "Table": "users", "Non_unique": 0, "Key_name": "PRIMARY", "Column_name": "id", "Index_type": "BTREE" },
    { "Table": "users", "Non_unique": 0, "Key_name": "idx_email", "Column_name": "email", "Index_type": "BTREE" }
  ]
}
```

**Response** `200` (MSSQL — aggregated by index):
```json
{
  "indexes": [
    { "index_name": "PK_users", "columns": "id", "is_unique": true, "type_desc": "CLUSTERED" },
    { "index_name": "IX_users_email", "columns": "email, tenant_id", "is_unique": false, "type_desc": "NONCLUSTERED" }
  ]
}
```

---

### `POST /api/database/table-data`
**Auth**: None  
**Purpose**: Fetch paginated rows from a table.

| Param | Location | Required | Default | Description |
|-------|----------|----------|---------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | — | Connection details |
| `database` | Body | Yes | — | Target database |
| `table` | Body | Yes | — | Target table |
| `page` | Body | No | `1` | Page number (1-based) |
| `pageSize` | Body | No | `100` | Rows per page (max 1000) |
| `tunnel` | Body | No | — | SSH tunnel config |

**Response** `200`:
```json
{
  "rows": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ],
  "columns": ["id", "name", "email"],
  "total": 1250,
  "page": 1,
  "pageSize": 100
}
```

**MySQL Query**: `SELECT * FROM \`table\` LIMIT pageSize OFFSET offset`  
**MSSQL Query**: `SELECT * FROM [table] ORDER BY (SELECT NULL) OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`

**Note**: `pageSize` is capped at 1000 regardless of request value.

---

### `POST /api/database/table-size`
**Auth**: None  
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
  "size": {
    "row_count": 1250,
    "data_kb": 256,
    "index_kb": 64,
    "total_kb": 320,
    "engine": "InnoDB",
    "created": "2024-01-15 10:30:00",
    "collation": "utf8mb4_general_ci"
  }
}
```

**Response** `200` (MSSQL):
```json
{
  "size": {
    "row_count": 1250,
    "total_kb": 320,
    "data_kb": 256
  }
}
```

---

### `POST /api/database/table-create-sql`
**Auth**: None  
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
  "sql": "CREATE TABLE `users` (\n  `id` int(11) NOT NULL AUTO_INCREMENT,\n  `email` varchar(255) NOT NULL,\n  PRIMARY KEY (`id`),\n  UNIQUE KEY `idx_email` (`email`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
}
```

**Response** `200` (MSSQL):
```json
{
  "sql": "(MSSQL CREATE TABLE scripting not yet supported)"
}
```

---

### `POST /api/database/processes`
**Auth**: None  
**Purpose**: List active database processes/sessions.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "processes": [
    { "Id": 42, "User": "app_user", "Host": "10.0.0.5:52412", "db": "production", "Command": "Query", "Time": 0, "State": "executing", "Info": "SELECT * FROM orders WHERE status='pending'" },
    { "Id": 43, "User": "root", "Host": "localhost", "db": null, "Command": "Sleep", "Time": 120, "State": "", "Info": null }
  ]
}
```

**Response** `200` (MSSQL):
```json
{
  "processes": [
    { "session_id": 55, "login_name": "sa", "status": "running", "command": "SELECT", "wait_type": null, "cpu_time": 156, "total_elapsed_time": 200, "reads": 1024, "writes": 0 }
  ]
}
```

**MySQL Query**: `SHOW FULL PROCESSLIST`  
**MSSQL Query**: `SELECT ... FROM sys.dm_exec_requests r JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id WHERE r.session_id > 50`

---

### `POST /api/database/status`
**Auth**: None  
**Purpose**: Get server version and status variables.

| Param | Location | Required | Description |
|-------|----------|----------|-------------|
| `host`, `port`, `user`, `password`, `type` | Body | Yes | Connection details |
| `tunnel` | Body | No | SSH tunnel config |

**Response** `200` (MySQL):
```json
{
  "status": {
    "version": "8.0.35-0ubuntu0.22.04.1",
    "Uptime": "345600",
    "Threads_connected": "5",
    "Questions": "1234567",
    "Slow_queries": "12",
    "Bytes_received": "987654321",
    "Bytes_sent": "1234567890"
  }
}
```

**Response** `200` (MSSQL):
```json
{
  "status": {
    "server_name": "SQLSERVER01",
    "version": "Microsoft SQL Server 2019 (RTM-CU18)...",
    "spid": "55",
    "user_connections": "12"
  }
}
```

**Flow (MySQL)**:
1. `SELECT VERSION() AS version` → store version
2. `SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime','Threads_connected','Questions','Slow_queries','Bytes_received','Bytes_sent')` → merge into status object

---

### `POST /api/database/query`
**Auth**: None  
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
  "columns": ["id", "name", "email"],
  "rows": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" }
  ],
  "executionTime": 42
}
```

**Response** `200` (DML):
```json
{
  "columns": [],
  "rows": [],
  "affectedRows": 5,
  "insertId": 0,
  "message": "Query executed: 5 rows affected",
  "executionTime": 15
}
```

**Error Response** `500`:
```json
{
  "error": "You have an error in your SQL syntax; check the manual..."
}
```

**Flow**:
1. Record start time
2. Execute SQL via `withMySQL` or `withMSSQL`
3. If result has `fields` or `columns` property → SELECT result → extract columns + rows
4. Otherwise → DML result → extract `affectedRows`, `insertId`
5. Calculate `executionTime = Date.now() - start`

---

### `POST /api/database/export-csv`
**Auth**: None  
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
3,"She said ""hello""",carol@example.com
```

**CSV escaping**: Fields containing commas, double-quotes, or newlines are wrapped in double-quotes. Internal double-quotes are doubled (`""` → `""`).

---

## Frontend Routes

| Route Path | Component | Description |
|------------|-----------|-------------|
| `/database` | `DatabaseManager.tsx` | Full database administration interface |

---

## Frontend → Backend API Call Map

| Frontend Action | API Call | Trigger |
|-----------------|----------|---------|
| Component mount | `GET /database/keys` | `useEffect` on mount |
| Connect to server | `POST /database/connect` | "Test Connection" button or connection click |
| Load databases | `POST /database/databases` | After successful connect |
| Load tables | `POST /database/tables` | After successful connect + on database switch |
| Expand table columns | `POST /database/describe` | Click table expand arrow in sidebar |
| Browse table data | `POST /database/table-data` | Click browse icon or Browse tab |
| Load table info | `POST /database/table-size` + `/indexes` + `/table-create-sql` | Click info icon (parallel fetch) |
| Execute SQL | `POST /database/query` | Ctrl+Enter or Execute button |
| View processes | `POST /database/processes` | Click Processes tab or toolbar button |
| View server status | `POST /database/status` | Click Server tab or toolbar button |
| Export CSV (client) | — (client-side) | CSV export button on Results tab |
| Export JSON (client) | — (client-side) | JSON export button on Results tab |
| Copy to clipboard | — (client-side) | Copy button on Results tab |
