# Database Management — Known Issues & Change Log

## Change Log

### 2025-03 — Major Enhancement: Authentication, Shared Connections, Adminer-like Features

#### 🔒 Security — Authentication Added
- **Added `requireDeveloper` middleware** (`/var/opt/backend/src/middleware/requireDeveloper.ts`) — checks for `developer`, `admin`, or `super_admin` role slugs via `user_roles` JOIN `roles` table.
- **Applied `requireAuth` + `requireDeveloper` to all routes** — `router.use(requireAuth, requireDeveloper)` at the top of the database router. All 20 endpoints now require authentication + role verification.
- **Added `<DeveloperRoute>` frontend guard** (`/var/opt/frontend/src/components/DeveloperRoute.tsx`) — wraps `/database` route, checks `user.is_admin`, `user.role?.slug`, and `user.roles` for developer access. Redirects to dashboard if unauthorized.
- **Added sidebar role check** — Database menu item has `roleSlug: 'developer'` in Layout.tsx. Non-developer users don't see the Database link at all.

#### 💾 Shared Connections — localStorage → MySQL
- **Created `db_connections` table** — shared connection storage in the application MySQL database. All authorized users see the same connections.
- **Added `GET /connections`** — list all saved connections, maps flat DB rows to nested frontend `Connection` shape.
- **Added `POST /connections`** — create or update connection via upsert (`INSERT ... ON DUPLICATE KEY UPDATE`). Generates UUID with `crypto.randomUUID()`. Stores `created_by` user ID.
- **Added `DELETE /connections/:id`** — remove a connection by UUID.
- **Updated frontend** — connections fetched from API on mount instead of `localStorage`. `loadingConnections` state with spinner. Save/delete operations hit API endpoints.

#### 📝 Adminer-like Table Browser
- **Rewrote `TableBrowser` component** — from ~125 LOC basic paginated viewer to ~450 LOC Adminer-inspired browser with:
  - **Server-side sorting** — click column headers to cycle ASC/DESC/none. Sends `sortColumn` + `sortDirection` to backend.
  - **Server-side filtering** — column selector, operator dropdown (LIKE, =, !=, >, <, >=, <=, IS NULL, IS NOT NULL, REGEXP), value input. Multiple filters with AND logic. Sends `filters[]` array to backend.
  - **Inline row editing** — click edit icon to enter edit mode, modify values in input fields, save or cancel. Calls `POST /row-update`.
  - **Row insertion** — "New Row" button shows form at bottom of table. Calls `POST /row-insert`.
  - **Row deletion** — delete button per row with SweetAlert2 confirmation. Calls `POST /row-delete`.
  - **Multi-select** — checkboxes for row selection, bulk delete operation.
  - **Export buttons** — CSV, JSON, clipboard copy directly from browse tab.

#### 🔧 New Backend Endpoints (7 added)
- **`POST /row-insert`** — parameterized INSERT with dynamic columns from `row` object. Empty strings → null.
- **`POST /row-update`** — parameterized UPDATE with `SET` from `row` and `WHERE` from `where` object. `LIMIT 1` safety.
- **`POST /row-delete`** — parameterized DELETE with `WHERE` from `where` object. `LIMIT 1` safety.
- **`POST /import-sql`** — splits SQL by `;\n`, executes sequentially, collects errors (max 20), returns summary.
- **`POST /truncate`** — `TRUNCATE TABLE` with identifier escaping.
- **`POST /drop-table`** — `DROP TABLE` with identifier escaping.
- **Enhanced `POST /table-data`** — added `sortColumn`, `sortDirection`, `filters[]` parameters for server-side ORDER BY and WHERE generation.

#### 📥 Import SQL Tab
- **Added 'import' to `MainTab` type** — new tab in the main area.
- **File upload** — drag-and-drop area + file input for `.sql` files.
- **Paste textarea** — paste SQL directly into a textarea.
- **Execute with progress** — shows executed count, errors list, total statements.

#### 🗑️ Table Actions
- **Truncate button** — available in sidebar (hover) and Info tab header. SweetAlert2 double-confirmation.
- **Drop table button** — available in sidebar (hover) and Info tab header. SweetAlert2 double-confirmation with table name input.
- **Auto-refresh** — tables list refreshes after truncate/drop.

#### 🎨 UI Improvements
- **Always-visible edit button** — PencilSquareIcon with `e.stopPropagation()` instead of hidden hover-only icon.
- **Connection loading spinner** — shown while `GET /connections` is in flight.
- **Enhanced toolbar icons** — 40+ Heroicons imported for comprehensive iconography.

---

## Known Issues

### 🔴 Critical — Security

| ID | Issue | File | Status | Impact |
|----|-------|------|--------|--------|
| DBM-001 | ~~**No authentication on any endpoint**~~ | `databaseManager.ts` | ✅ **RESOLVED** — `requireAuth` + `requireDeveloper` applied to all routes | ~~Full database access to anyone~~ |
| DBM-002 | **SQL injection in MSSQL queries** — Table and database names are interpolated into SQL strings. MSSQL uses `[${table}]` with `]` doubling, MySQL strips backticks. Improved for CRUD endpoints (parameterized), but schema browsing endpoints still use string interpolation. | `databaseManager.ts` | ⚠️ Partially mitigated | Potential SQL injection via crafted table names |
| DBM-003 | ~~**Credentials in plaintext localStorage**~~ | `DatabaseManager.tsx` | ✅ **RESOLVED** — Connections now stored in server-side `db_connections` MySQL table | ~~Credential theft via XSS~~ |
| DBM-004 | **Credentials sent in every request body** — Full database and SSH credentials included in every POST body. Even with HTTPS, they appear in server logs if body logging is enabled. | `DatabaseManager.tsx` | ⚠️ Open | Credential exposure in transit or logs |
| DBM-005 | **Unrestricted arbitrary SQL execution** — `POST /query` executes any SQL including DROP DATABASE, GRANT, etc. No query whitelisting or dangerous-statement blocking. Now requires authentication, but any developer can still execute destructive queries. | `databaseManager.ts` | ⚠️ Reduced risk (auth required) | Database compromise via authorized developers |

### 🟡 Moderate

| ID | Issue | File | Status | Impact |
|----|-------|------|--------|--------|
| DBM-006 | **No connection pooling** — Every API request creates a new SSH tunnel + database connection. Improved somewhat by server-side sort/filter reducing the number of requests. | `databaseManager.ts` | ⚠️ Open | ~300-600ms per operation |
| DBM-007 | **MSSQL CREATE TABLE not implemented** — Returns a placeholder comment. | `databaseManager.ts` | ⚠️ Open | Incomplete MSSQL feature parity |
| DBM-008 | **No request body validation** — POST endpoints don't validate with any schema. Missing fields produce driver-level errors. | `databaseManager.ts` | ⚠️ Open | Poor error UX |
| DBM-009 | **No rate limiting** — With auth now required, brute-force risk is reduced but API abuse (expensive queries, resource exhaustion) is still possible. | `databaseManager.ts` | ⚠️ Reduced risk | Resource exhaustion |
| DBM-010 | **Non-deterministic MSSQL pagination** — `ORDER BY (SELECT NULL)` used when no sort column specified. | `databaseManager.ts` | ⚠️ Open | Inconsistent pagination |
| DBM-011 | ~~**Client-side filtering only**~~ | `DatabaseManager.tsx` | ✅ **RESOLVED** — Server-side WHERE filtering via `filters[]` array and `sortColumn`/`sortDirection` | ~~Inefficient for large datasets~~ |
| DBM-012 | **SSH key directory not configurable** — `KEYS_DIR` hardcoded to `/var/opt/backend/keys/`. | `databaseManager.ts` | ⚠️ Open | Inflexible deployment |
| DBM-020 | **Credentials stored in plaintext in MySQL** — `db_connections` table stores database and SSH passwords as plaintext VARCHAR. Should be encrypted at rest. | `databaseManager.ts`, DB schema | ⚠️ New | Credential exposure via DB access |

### 🟢 Minor

| ID | Issue | File | Status | Impact |
|----|-------|------|--------|--------|
| DBM-013 | **No TypeScript response types** — Backend endpoints return untyped objects. | `databaseManager.ts` | ⚠️ Open | No compile-time safety |
| DBM-014 | **No SQL syntax highlighting** — Plain `<textarea>` with dark theme. | `DatabaseManager.tsx` | ⚠️ Open | Poor editing experience |
| DBM-015 | **Static export filenames** — CSV exports use `export.csv`. | `databaseManager.ts` | ⚠️ Open | Confusing for multiple exports |
| DBM-016 | **No EXPLAIN / query plan support** | — | ⚠️ Open | Missing optimization feature |
| DBM-017 | **MySQL SHOW INDEX is denormalized** — Returns one row per column vs aggregated MSSQL. | `databaseManager.ts` | ⚠️ Open | Inconsistent display |
| DBM-018 | **No keyboard shortcut documentation** | `DatabaseManager.tsx` | ⚠️ Open | Discoverability issue |
| DBM-019 | **Query history duplicate by position** — Dedup only checks most recent entry. | `DatabaseManager.tsx` | ⚠️ Open | Minor clutter |

---

## Migration Notes

### Server-Side Connection Storage (DB Migration)
```sql
CREATE TABLE IF NOT EXISTS db_connections (
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

**Note**: Previous connections stored in `localStorage` key `db_connections_v2` are lost after migration. Users must re-create connections through the UI.

### Parameterizing Table Names (DBM-002 Partial Fix)
For MySQL, use the `mysql2` escapeId function:
```typescript
const escapedTable = conn.escapeId(table);
const [rows] = await conn.execute(`SELECT * FROM ${escapedTable} LIMIT ? OFFSET ?`, [pageSize, offset]);
```

For MSSQL, use bracket escaping with `]` doubling:
```typescript
const safeTable = table.replace(/\]/g, ']]');
const result = await pool.request().query(`SELECT * FROM [${safeTable}]`);
```

### Encrypting DB Credentials at Rest (DBM-020 Fix)
```typescript
import { encrypt, decrypt } from '../utils/credentialVault';

// On save:
const encryptedPassword = encrypt(password, process.env.DB_ENCRYPTION_KEY);
await db.query('INSERT INTO db_connections (..., password, ...) VALUES (..., ?, ...)', [encryptedPassword]);

// On read:
const decryptedPassword = decrypt(row.password, process.env.DB_ENCRYPTION_KEY);
```

---

## Future Enhancements

### Priority 1 — Security
- [x] ~~Add `requireAuth` + `requireDeveloper` middleware to database router (DBM-001)~~
- [ ] Parameterize all table/database name interpolation (DBM-002)
- [x] ~~Move credentials out of localStorage (DBM-003)~~
- [ ] Encrypt credentials at rest in `db_connections` table (DBM-020)
- [ ] Implement server-side connection sessions to avoid sending credentials per-request (DBM-004)
- [ ] Add query whitelist/blacklist or read-only mode option (DBM-005)
- [ ] Add rate limiting per user (DBM-009)

### Priority 2 — Performance
- [ ] Implement SSH tunnel + connection pooling with TTL (DBM-006)
- [x] ~~Add server-side WHERE filtering for table browser (DBM-011)~~
- [ ] Add deterministic ORDER BY for MSSQL pagination (DBM-010)

### Priority 3 — Feature Parity
- [ ] Implement MSSQL CREATE TABLE DDL generation (DBM-007)
- [ ] Normalize MySQL/MSSQL index response shapes (DBM-017)
- [ ] Add EXPLAIN / query plan visualization (DBM-016)
- [ ] Add MSSQL status variables parity with MySQL GLOBAL STATUS

### Priority 4 — UX Improvements
- [ ] Integrate SQL syntax highlighting (CodeMirror or Monaco) (DBM-014)
- [ ] Add dynamic export filenames with timestamp (DBM-015)
- [ ] Add keyboard shortcut help overlay (DBM-018)
- [ ] Add query tabs for multiple simultaneous queries
- [x] ~~Add table data inline editing (UPDATE on cell change)~~
- [ ] Add schema diff / comparison between databases
- [ ] Add visual query builder for non-SQL users

### Priority 5 — Code Quality
- [ ] Add Zod/Joi request validation to all endpoints (DBM-008)
- [ ] Add TypeScript response interfaces shared between frontend/backend (DBM-013)
- [ ] Make KEYS_DIR configurable via environment variable (DBM-012)
- [ ] Deduplicate query history properly (DBM-019)
- [ ] Extract ConnectionDialog and TableBrowser to separate files
