# Platform Core Wiring — File Inventory

**Version:** 2.2.0  
**Last Updated:** 2026-03-14

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 27 |
| **Total LOC** | ~4,196 |
| **Backend files** | 17 (~3,029 LOC) |
| **Frontend files** | 10 (~1,167 LOC) |

### Directory Tree

```
Backend:
  src/index.ts                             (111 LOC) — server bootstrap, Socket.IO init, worker spawn, Ollama warm-up
  src/app.ts                               (267 LOC) — Express factory, middleware chain, 84 route mounts, dual-mount
  src/config/env.ts                        (123 LOC) — Zod-validated environment schema (130+ vars)
  src/db/mysql.ts                          (333 LOC) — MySQL connection pool, query helpers, UUID, entity types
  src/db/auditLog.ts                       (421 LOC) — SQLite-backed admin audit log helpers
  src/middleware/auth.ts                   (84 LOC) — JWT verification (Bearer + cookie), signAccessToken
  src/middleware/apiKey.ts                 (56 LOC) — X-API-Key header validation
  src/middleware/apiErrorTracker.ts        (27 LOC) — 5xx response tracking for health monitor
  src/middleware/auditLogger.ts            (121 LOC) — Admin action audit trail (async, non-blocking)
  src/middleware/errorHandler.ts           (12 LOC) — Global Express error → JSON handler
  src/middleware/packages.ts               (221 LOC) — Contact-scoped package/credit enforcement
  src/middleware/requireAdmin.ts           (50 LOC) — Admin role guard (users.is_admin)
  src/middleware/requireDeveloper.ts       (48 LOC) — Developer/staff role guard (is_admin OR is_staff)
  src/middleware/statusCheck.ts            (175 LOC) — 3-level status hierarchy (account → assistant → widget)
  src/middleware/usageTracking.ts          (344 LOC) — Tier-based monthly message limit enforcement
  src/utils/httpErrors.ts                  (26 LOC) — HttpError class + factory functions
  src/services/healthMonitor.ts            (610 LOC) — Comprehensive system health monitoring + auto-case creation

Frontend:
  src/App.tsx                              (210 LOC) — Root component, all route definitions, layout wrapping
  src/services/api.ts                      (188 LOC) — Axios instance, JWT interceptors, silent refresh
  src/store/index.ts                       (121 LOC) — Zustand global state (auth, contacts, finance, UI)
  src/config/app.ts                        (136 LOC) — Environment detection, API base URL resolution
  src/components/ProtectedRoute.tsx        (63 LOC) — Auth guard (redirects to /login)
  src/components/AdminRoute.tsx            (20 LOC) — Admin/staff guard (redirects to /)
  src/components/DeveloperRoute.tsx        (34 LOC) — Developer role guard
  src/components/PermissionRoute.tsx       (60 LOC) — Permission-based route guard
  src/components/PermissionSync.tsx        (269 LOC) — Syncs role/permission data from backend on login
  src/components/Can.tsx                   (66 LOC) — Conditional render by permission slug
```

---

## 2. Backend Files

### 2.1 `src/index.ts` — Server Bootstrap

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/index.ts` |
| **LOC** | 111 |
| **Purpose** | Entry point — creates Express app, starts HTTP server, initializes Socket.IO namespaces, spawns ingestion worker child process, pre-warms Ollama models |
| **Dependencies** | app.ts (createApp), config/env.ts, child_process (fork), services/teamChatSocket.ts, services/chatSocket.ts |
| **Exports** | None (entry point) |

#### Boot Sequence

| Step | Action | Detail |
|------|--------|--------|
| 1 | `createApp()` | Build Express app with all middleware and routes |
| 2 | `app.listen(PORT)` | Start HTTP server on configured port (default 8787) |
| 3 | `initTeamChatSocket(server)` | Attach Socket.IO `/team-chats` namespace |
| 4 | `initChatSocket(server, teamIO)` | Attach Socket.IO `/chat` namespace (reuses same IO instance to prevent duplicate `handleUpgrade` crashes) |
| 5 | `fork(ingestionWorkerProcess)` | Spawn child process with 1GB heap (`--max-old-space-size=1024`), auto-detects `.ts` (dev/tsx) vs `.js` (prod) |
| 6 | `warmOllamaModels()` | Fire a single-token "hi" prompt at each configured Ollama model to pre-load into RAM |
| 7 | `server.setTimeout(120_000)` | Set 2-minute HTTP timeout for long-running AI generation |

#### Worker Auto-Restart

```typescript
worker.on('exit', (code, signal) => {
  if (code !== 0) {
    // Auto-restart after 5 seconds on unexpected exit
    setTimeout(() => fork(workerScript, ...), 5_000);
  }
});
```

---

### 2.2 `src/app.ts` — Application Factory

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/app.ts` |
| **LOC** | 267 |
| **Purpose** | Creates and configures the Express app: global middleware, static asset serving, health endpoint, 84 route mounts on dual `/` + `/api` prefixes, 404 handler, error handler, health monitor startup |
| **Dependencies** | express, helmet, morgan, cookie-parser, all 84 route imports, all middleware imports, services/healthMonitor.ts |
| **Exports** | `createApp()` |

#### Key Responsibilities

| Responsibility | Implementation |
|---------------|----------------|
| Security headers | `helmet({ crossOriginResourcePolicy: 'cross-origin' })` |
| CORS | Inline middleware: reflects `req.headers.origin` for credentials support; falls back to `*` for non-browser clients |
| Cookie parsing | `cookieParser()` for HTTP-only auth cookies |
| Body parsing | `express.json({ limit: '20mb' })` for base64 image attachments |
| Logging | `morgan('dev')` |
| Error tracking | `apiErrorTracker` before routes (hooks `res.end`) |
| Static assets | `/public`, `/uploads`, `/assets` served via `express.static` |
| Health check | `GET /healthz → { ok: true }` |
| Route mounts | 84 `apiRouter.use()` calls organized by group |
| Dual mount | `app.use('/api', apiRouter)` + `app.use('/', apiRouter)` |
| Alias mount | `apiRouter.use('/', accountingRouter)` for `/accounts`, `/transactions`, `/ledger` |
| 404 handler | `res.status(404).json({ error: 'NOT_FOUND', path: req.path })` |
| Error handler | `errorHandler` as final middleware |
| Health monitoring | `startHealthMonitoring()` called once |

#### Admin Route Middleware Pattern

All admin sub-routes apply `auditLogger` inline:

```typescript
apiRouter.use('/admin', auditLogger as any, adminRouter);
apiRouter.use('/admin/config', auditLogger as any, adminConfigRouter);
apiRouter.use('/admin/dashboard', auditLogger as any, adminDashboardRouter);
// ... 9 admin mounts total
```

---

### 2.3 `src/config/env.ts` — Environment Configuration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/config/env.ts` |
| **LOC** | 123 |
| **Purpose** | Zod-validated environment variable schema — crashes at startup if required vars are missing or malformed |
| **Dependencies** | `dotenv/config`, `zod` |
| **Exports** | `env` (typed, validated environment object) |

#### Required Variables (no defaults, crash if missing)

| Variable | Zod Rule | Purpose |
|----------|----------|---------|
| `JWT_SECRET` | `z.string().min(16)` | Token signing key |
| `DATABASE_URL` | `z.string().min(1)` | MySQL connection string |

#### All Other Variables

Have Zod defaults — server starts even if unset. See README §5 for the full group breakdown.

---

### 2.4 `src/db/mysql.ts` — Database Layer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/mysql.ts` |
| **LOC** | 333 |
| **Purpose** | MySQL connection pool (mysql2/promise), query helper functions, UUID generation, date conversion utilities, and TypeScript entity type definitions for all core database tables |
| **Dependencies** | `mysql2/promise`, `crypto`, `config/env.ts` |
| **Exports** | `pool`, `db`, `generateId`, `toMySQLDate`, `fromMySQLDate`, 12+ entity interfaces |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `db.query<T>` | `(sql, params?) → Promise<T[]>` | Array of rows | Execute any SQL, return typed rows |
| `db.queryOne<T>` | `(sql, params?) → Promise<T \| null>` | Single row or null | First row of result set |
| `db.insert` | `(sql, params?) → Promise<string>` | Insert ID (string) | Execute INSERT, return auto-increment ID |
| `db.insertOne` | `(table, data) → Promise<string>` | Insert ID (string) | Build INSERT from object keys → columns, values → placeholders |
| `db.execute` | `(sql, params?) → Promise<number>` | Affected rows | Execute UPDATE/DELETE |
| `db.transaction<T>` | `(callback) → Promise<T>` | Callback return value | getConnection → BEGIN → callback → COMMIT (or ROLLBACK on throw) → release |
| `db.ping` | `() → Promise<boolean>` | boolean | `SELECT 1` health check |
| `db.close` | `() → Promise<void>` | void | Close all pool connections |

#### Utility Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `generateId` | `() → string` | UUID v4 | `crypto.randomUUID()` — used as primary key for all entities |
| `toMySQLDate` | `(Date) → string` | `'YYYY-MM-DD HH:mm:ss'` | Strips ISO to MySQL format (UTC) |
| `fromMySQLDate` | `(string\|Date) → Date` | Date object | Parse MySQL datetime to JS Date |
| `parseConnectionString` | `(url) → config` | `{ user, password, host, port, database }` | Parse `mysql://user:pass@host:port/db` |

#### Entity Types Defined

| Interface | Key Fields | Used By |
|-----------|-----------|---------|
| `User` | id, email, name, passwordHash | Auth, Users, Profile |
| `Team` | id, name, createdByUserId | Teams (legacy) |
| `team_members` | teamId, userId, role | Teams (legacy) |
| `Agent` | id, teamId, name, version, region, blueprint | Agents |
| `vault_credentials` | id, teamId, name, kind | Credentials |
| `activation_keys` | id, code, tier, isActive | Admin |
| `device_activations` | id, deviceId, isActive, tier | Admin |
| `api_keys` | id, name, key, userId, isActive | ApiKeys |
| `ai_model_config` | id, teamId, providers, models | AI Config |
| `subscription_plans` | id, tier, name, priceMonthly | Subscription |
| `Subscription` | id, teamId, planId, status | Subscription |
| `Invoice` | id, subscriptionId, total, paidAt | Invoices |
| `Payment` | id, invoiceId, amount, status | Payments |

---

### 2.5 `src/db/auditLog.ts` — Audit Log Helpers

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/auditLog.ts` |
| **LOC** | 421 |
| **Purpose** | SQLite-backed admin audit log — separate from MySQL to avoid performance impact on main DB. Provides insert, query with filtering/pagination, and log rotation |
| **Dependencies** | `better-sqlite3` |
| **Exports** | `auditLog` (object with insert/query/rotate methods) |

---

### 2.6 `src/middleware/auth.ts` — JWT Authentication

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/auth.ts` |
| **LOC** | 84 |
| **Purpose** | JWT token verification via Bearer header or HTTP-only cookie, token signing, cookie management |
| **Dependencies** | `jsonwebtoken`, `config/env.ts`, `utils/httpErrors.ts` |
| **Exports** | `requireAuth`, `getAuth`, `signAccessToken`, `setAuthCookie`, `clearAuthCookie`, `AuthRequest`, `AuthUser` |

#### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `requireAuth` | `(req, res, next)` | 1. Check `Authorization: Bearer <token>` header. 2. Fall back to `sw_token` HTTP-only cookie. 3. `jwt.verify()` → set `req.userId` and `req.auth`. 4. Throw `unauthorized()` on failure. |
| `getAuth` | `(req) → AuthUser` | Extract `{ userId }` from `req.auth`, throw if missing |
| `signAccessToken` | `(payload, expiresIn?) → string` | Sign JWT with HS256 using `env.JWT_SECRET` |
| `setAuthCookie` | `(req, res, token, maxAge?)` | Set `sw_token` HTTP-only cookie (secure + SameSite=None on HTTPS, lax on HTTP) |
| `clearAuthCookie` | `(req, res)` | Clear the auth cookie |

---

### 2.7 `src/middleware/apiKey.ts` — API Key Validation

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/apiKey.ts` |
| **LOC** | 56 |
| **Purpose** | Validate `X-API-Key` header against `api_keys` table, auto-track `lastUsedAt` |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `requireApiKey` |

---

### 2.8 `src/middleware/apiErrorTracker.ts` — Error Tracking

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/apiErrorTracker.ts` |
| **LOC** | 27 |
| **Purpose** | Hooks `res.end()` on every request; when status ≥ 500, calls `trackApiError()` to feed the health monitor's in-memory error buffer |
| **Dependencies** | `services/healthMonitor.ts` (trackApiError) |
| **Exports** | `apiErrorTracker` |

**Must be mounted BEFORE routes** so it can hook `res.end` before any handler writes.

---

### 2.9 `src/middleware/auditLogger.ts` — Admin Audit Trail

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/auditLogger.ts` |
| **LOC** | 121 |
| **Purpose** | Logs every admin action (who, what method, which resource, response status, duration) to SQLite audit log. Non-blocking — logging happens after response is sent. |
| **Dependencies** | `db/auditLog.ts`, `db/mysql.ts` (user info cache) |
| **Exports** | `auditLogger` |

#### Design Decisions

| Decision | Detail |
|----------|--------|
| Async logging | Overrides `res.end` + `res.json`, logs in `.then()` — never blocks response |
| User info cache | 5-minute TTL cache for user email/name lookups (avoids N+1 DB queries) |
| Skip patterns | `GET /api/admin/audit-log` skipped to prevent recursion |
| Body sanitization | Truncates string fields > 2000 chars to keep log entries small |

---

### 2.10 `src/middleware/errorHandler.ts` — Global Error Handler

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/errorHandler.ts` |
| **LOC** | 12 |
| **Purpose** | Final Express error handler — converts `HttpError` to JSON response, catches unknown errors as 500 |
| **Dependencies** | `utils/httpErrors.ts` |
| **Exports** | `errorHandler` |

```typescript
if (err instanceof HttpError) {
  return res.status(err.status).json({ error: err.code, message: err.message });
}
console.error(err);
return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
```

---

### 2.11 `src/middleware/packages.ts` — Package Credit Enforcement

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/packages.ts` |
| **LOC** | 221 |
| **Purpose** | Contact-scoped package/credit enforcement. Replaces the legacy team-scoped credit middleware. Resolves contact from user, checks package balance, deducts credits after successful responses. |
| **Dependencies** | `services/packages.ts` |
| **Exports** | `requirePackage`, `requireCredits`, `packageCreditMiddleware` |

#### Inline Request Pricing

| Request Type | Base Cost | Per Token | Use |
|-------------|-----------|-----------|-----|
| TEXT_CHAT | 10 (R0.10) | 0.01 | AI conversations |
| TEXT_SIMPLE | 5 (R0.05) | 0.005 | Simple text requests |
| AI_BROKER | 1 (R0.01) | — | Provider proxy |
| CODE_AGENT_EXECUTE | 20 (R0.20) | 0.02 | Code execution |
| FILE_OPERATION | 1 (R0.01) | — | File ops |
| MCP_TOOL | 5 (R0.05) | multiplier | MCP tools |

---

### 2.12 `src/middleware/requireAdmin.ts` — Admin Guard

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/requireAdmin.ts` |
| **LOC** | 50 |
| **Purpose** | Checks `users.is_admin = 1` directly on the users table. Must be chained after `requireAuth`. Returns 403 if not admin. |
| **Dependencies** | `db/mysql.ts`, `middleware/auth.ts` (AuthRequest) |
| **Exports** | `requireAdmin` |

---

### 2.13 `src/middleware/requireDeveloper.ts` — Developer/Staff Guard

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/requireDeveloper.ts` |
| **LOC** | 48 |
| **Purpose** | Checks `users.is_admin = 1` OR `users.is_staff = 1`. Allows both admins and staff through. Returns 403 if neither. |
| **Dependencies** | `db/mysql.ts`, `middleware/auth.ts` (AuthRequest) |
| **Exports** | `requireDeveloper` |

---

### 2.14 `src/middleware/statusCheck.ts` — Status Bouncer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/statusCheck.ts` |
| **LOC** | 175 |
| **Purpose** | 3-level status hierarchy that blocks requests for suspended/expired accounts, assistants, or widgets |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `checkAccountStatus`, `checkAssistantStatus`, `checkWidgetStatus` |

#### Status Hierarchy

| Level | Column | Blocks | Applied At |
|-------|--------|--------|------------|
| 1. Account | `users.account_status` | ALL requests for that user | After requireAuth |
| 2. Assistant | `assistants.status` (joins to owner's account) | Assistant endpoints only | `/assistants/*` routes |
| 3. Widget | `widget_clients.status` (joins to owner's account) | Widget endpoints only | `/v1/*` widget routes |

**Fail-open policy:** DB errors don't block requests (logged, then `next()` called).

---

### 2.15 `src/middleware/usageTracking.ts` — Message Limit Enforcement

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/usageTracking.ts` |
| **LOC** | 344 |
| **Purpose** | Tracks and enforces monthly message limits per subscription tier (Free: 500, Starter: 2000, Pro: 10000, Enterprise: unlimited) |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `trackUsage` |

---

### 2.16 `src/utils/httpErrors.ts` — Error Classes

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/utils/httpErrors.ts` |
| **LOC** | 26 |
| **Purpose** | `HttpError` class extending `Error` with `status` and `code` properties, plus factory functions |
| **Dependencies** | None |
| **Exports** | `HttpError`, `notFound`, `unauthorized`, `forbidden`, `badRequest` |

| Factory | Status | Code | Usage |
|---------|--------|------|-------|
| `notFound(msg)` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `unauthorized(msg)` | 401 | `UNAUTHORIZED` | No/invalid token |
| `forbidden(msg)` | 403 | `FORBIDDEN` | Insufficient permissions |
| `badRequest(msg)` | 400 | `BAD_REQUEST` | Invalid input |

---

### 2.17 `src/services/healthMonitor.ts` — System Health Monitor

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/healthMonitor.ts` |
| **LOC** | 610 |
| **Purpose** | Comprehensive system health monitoring that runs 8 checks every 60 seconds, auto-creates cases for persistent failures (≥3 consecutive), and auto-resolves on recovery |
| **Dependencies** | `db/mysql.ts`, `services/enterpriseEndpoints.ts`, `ollama`, `services/notificationService.ts`, `child_process`, `os` |
| **Exports** | `startHealthMonitoring`, `trackApiError` |

#### Health Checks

| # | Check | Thresholds | Source |
|---|-------|-----------|--------|
| 1 | **MySQL** | Warning: >500ms response or >70% connections. Critical: >1000ms or >90% | `SELECT 1` + `SHOW STATUS` + pool internals |
| 2 | **API Error Rate** | Warning: ≥10 5xx/min. Critical: ≥30 5xx/min | In-memory buffer (from apiErrorTracker) |
| 3 | **Memory** | Warning: >80% system or >300MB heap. Critical: >95% system or >500MB heap | `process.memoryUsage()` + `os.freemem()` |
| 4 | **Disk Space** | Warning: >80%. Critical: >95% | `df /` via `execSync` |
| 5 | **Ollama** | Warning: model list empty. Error: connection refused | `GET /api/tags` |
| 6 | **PM2 Restarts** | Warning: ≥5 total restarts. Error: ≥3 new restarts since last check | `pm2 jlist` via `execSync` |
| 7 | **Ingestion Queue** | Warning: >100 pending. Error: >500 pending or oldest >1h | `SELECT COUNT(*) FROM crawl_queue WHERE status='pending'` |
| 8 | **Enterprise Endpoints** | Error: consecutive failures per endpoint | SQLite `enterprise_endpoints.db` |

#### Auto-Case Creation

When a check fails ≥ `FAILURE_THRESHOLD` (3) consecutive times:
- Creates a case in the `cases` table with severity, title, and diagnostic details
- Sends notification to admin users via `createNotification()`
- Deduplicates: won't create if an open case already exists for same `check_type`

On recovery: auto-resolves the case and creates a recovery notification.

**In-memory resilience:** If MySQL is down, deferred cases are queued in memory and flushed when DB recovers.

---

## 3. Frontend Files

### 3.1 `src/App.tsx` — Root Component

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/App.tsx` |
| **LOC** | 210 |
| **Purpose** | Root React component — all route definitions (~60 routes), layout wrapping (Layout vs PortalLayout), auth guard composition, smart dashboard routing |
| **Dependencies** | react-router-dom, react-hot-toast, all page imports, all guard imports, hooks (useAuth, useTheme), store |
| **Exports** | `App` (default) |

#### Smart Components

| Component | Logic |
|-----------|-------|
| `HomePage` | Unauth → `<LandingPage />`. Admin/staff → `Layout > AdminDashboard`. Client → `PortalLayout > PortalDashboard` |
| `SmartDashboard` | Admin/staff → `AdminDashboard`. Client → `PortalDashboard` |

#### Route Organization

| Group | Guard | Layout | Count |
|-------|-------|--------|-------|
| Public | None | None | 5 (/landing, /login, /register, /activate, /forgot-password) |
| Home | Conditional | Conditional | 2 (/, /dashboard) |
| Portal | ProtectedRoute | PortalLayout | 9 (/portal/*) |
| Finance | ProtectedRoute | Layout | 14 |
| Contacts | PermissionRoute | Layout | 3 |
| Software/Tasks | ProtectedRoute | Layout | 8 |
| Admin | AdminRoute | Layout | 8 |
| Cases | ProtectedRoute | Layout | 3 |
| System | PermissionRoute | Layout | 8 (includes legacy aliases) |

---

### 3.2 `src/services/api.ts` — Axios HTTP Client

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/services/api.ts` |
| **LOC** | 188 |
| **Purpose** | Central Axios instance with JWT management: attaches Bearer token from localStorage, handles silent token refresh on 401, queues concurrent 401s during refresh, forces logout on unrecoverable auth failures |
| **Dependencies** | `axios`, `config/app.ts` (getApiBaseUrl) |
| **Exports** | `api` (default Axios instance), `API_BASE_URL` |

#### Request Interceptor

Attaches `Authorization: Bearer <jwt>` from `localStorage.getItem('jwt_token')` to every request.

#### Response Interceptor Logic

| Scenario | Action |
|----------|--------|
| 403 response | Toast error message (permission denied) |
| 401 on login/register | Pass through (let UI show feedback) |
| 401 on refresh endpoint | `forceLogout()` |
| 401 with retry flag | `forceLogout()` |
| 401 (no LS token) | Try cookie-based session recovery via `GET /auth/session` |
| 401 (has LS token) | Silent refresh via `POST /auth/refresh` with old token |
| 401 during existing refresh | Queue request, replay when refresh completes |

#### Force Logout

```typescript
function forceLogout() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
  axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
  window.location.href = '/login';
}
```

---

### 3.3 `src/store/index.ts` — Global State (Zustand)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/store/index.ts` |
| **LOC** | 121 |
| **Purpose** | Zustand store providing global state slices for auth, contacts, finance, and UI |
| **Dependencies** | `zustand`, `services/staffChatSocket.ts` |
| **Exports** | `useAppStore` |

#### State Slices

| Slice | State | Setters | Side Effects |
|-------|-------|---------|--------------|
| **Auth** | `user`, `isAuthenticated` | `setUser()`, `setIsAuthenticated()`, `logout()` | `logout()` clears LS + disconnects Socket.IO |
| **Permissions** | (computed) | `hasPermission(slug)` | Returns `true` for admin/staff, checks `user.permissions` for others |
| **Contacts** | `contacts`, `customers`, `suppliers` | `set*()` | — |
| **Quotations** | `quotations`, `currentQuotation` | `set*()` | — |
| **Invoices** | `invoices`, `currentInvoice` | `set*()` | — |
| **Pricing** | `pricingItems` | `setPricingItems()` | — |
| **Categories** | `categories` | `setCategories()` | — |
| **UI** | `sidebarOpen`, `loading` | `set*()` | — |

#### Initialization

`user` is initialized from `localStorage.getItem('user')` via `getInitialUser()` with try/catch for corrupt JSON. `isAuthenticated` is set from `!!localStorage.getItem('jwt_token')`.

---

### 3.4 `src/config/app.ts` — Environment Detection

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/config/app.ts` |
| **LOC** | 136 |
| **Purpose** | Detects runtime environment (local dev, direct IP, production) and resolves API base URL. Supports localStorage override from app_settings for white-label deployments. |
| **Dependencies** | None |
| **Exports** | `getApiBaseUrl`, `getBaseUrl`, `getAssetUrl`, `getConfig`, `isDevelopment`, `isProduction`, `appConfig` |

#### Environment Resolution

| Environment | Detection | API Base URL |
|-------------|-----------|-------------|
| Local dev | `hostname === 'localhost'` or `127.0.0.1` or `*.local` | `http://localhost:8787/api` |
| Direct IP | `hostname` matches IP regex | `http://<IP>:8787/api` |
| Production | Everything else | `https://api.softaware.net.za/api` |
| Override | `localStorage.app_settings.site_base_url` | Custom URL (white-label) |

---

### 3.5 Route Guards (5 files)

| File | LOC | Condition | On Fail |
|------|-----|-----------|---------|
| `ProtectedRoute.tsx` | 63 | `isAuthenticated` from store | Redirect to `/login` |
| `AdminRoute.tsx` | 20 | `user.is_admin \|\| user.is_staff` | Redirect to `/` |
| `DeveloperRoute.tsx` | 34 | Developer role check | Redirect to `/` |
| `PermissionRoute.tsx` | 60 | `hasPermission(slug)` or admin/staff bypass | Redirect to `/` |
| `Can.tsx` | 66 | Inline conditional — renders children only if permission met | Hides content |

### 3.6 `src/components/PermissionSync.tsx` — Permission Sync

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/PermissionSync.tsx` |
| **LOC** | 269 |
| **Purpose** | On mount (and on login), fetches the current user's resolved permissions from `/auth/permissions` and merges them into the Zustand store user object. Ensures the frontend RBAC state matches the backend. |
| **Dependencies** | `services/api.ts`, `store/index.ts` |
| **Exports** | `PermissionSync` |
