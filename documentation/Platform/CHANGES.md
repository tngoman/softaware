# Platform Core Wiring — Changelog & Known Issues

**Version:** 2.2.0  
**Last Updated:** 2026-03-14

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-14 | 2.2.0 | Documentation created — comprehensive wiring docs covering server bootstrap, middleware chain, DB layer, health monitor, frontend app shell |
| 2026-03-13 | 2.1.0 | HTTP-only cookie auth support added to `requireAuth` middleware (Bearer + cookie cascade) |
| 2026-03-12 | 2.0.0 | Package middleware replaces credit middleware (contact-scoped billing replaces team-scoped credits); `credits.ts` middleware removed |
| 2026-03-10 | 1.9.0 | Health monitor expanded — 8 health checks (added PM2 restart tracking, ingestion queue, enterprise endpoints) |
| 2026-03-08 | 1.8.0 | apiErrorTracker middleware added — feeds 5xx to healthMonitor in-memory buffer |
| 2026-03-07 | 1.7.0 | auditLogger middleware added — SQLite-backed admin action audit trail |
| 2026-03-07 | 1.6.0 | Admin/staff detection migrated from role-slug to `users.is_admin` / `users.is_staff` columns; `requireAdmin` and `requireDeveloper` updated |
| 2026-03-06 | 1.5.0 | Dual-mount pattern added — all routes registered at both `/` and `/api` |
| 2026-03-05 | 1.4.0 | Frontend silent token refresh + concurrent 401 queuing + cookie session recovery |
| 2026-03-04 | 1.3.0 | Ollama model warm-up added to server startup |
| 2026-03-03 | 1.2.0 | Worker auto-restart on crash (5s delay) |
| 2026-03-02 | 1.1.0 | Health monitor initial implementation (MySQL + memory) |
| 2026-03-02 | 1.0.0 | Initial platform wiring — Express factory, middleware chain, DB layer, env config |

---

## 2. Detailed Changelog

### 2.2.0 — Wiring Documentation (2026-03-14)

**Scope:** Documentation only — no code changes.

Created comprehensive platform core wiring documentation following the established module documentation pattern:
- `README.md` — Overview, architecture diagrams (boot sequence, request lifecycle, frontend shell, health monitor), middleware reference, route map, env config groups, DB API
- `FILES.md` — File inventory for all 27 core wiring files (17 backend, 10 frontend) with LOC, methods, exports
- `PATTERNS.md` — 10 architecture patterns (dual-mount, composable middleware, token cascade, silent refresh, worker isolation, Ollama warm-up, self-healing health monitor, fail-open status, smart dashboard, environment-aware API resolution) + 6 anti-patterns
- `CHANGES.md` — This file

---

### 2.1.0 — Cookie-Based Auth Cascade (2026-03-13)

**Scope:** Backend (`middleware/auth.ts`), Frontend (`services/api.ts`)

**Summary:** Added HTTP-only cookie support alongside Bearer tokens. The `requireAuth` middleware now checks the `Authorization` header first, then falls back to the `sw_token` HTTP-only cookie. On the frontend, the Axios response interceptor gained a cookie-based session recovery path for the "clear cache" scenario where localStorage is wiped but the cookie persists.

**Changes:**
- `middleware/auth.ts`: Added `setAuthCookie()`, `clearAuthCookie()`, cookie options with dynamic Secure/SameSite based on protocol
- `services/api.ts`: Added `GET /auth/session` recovery path for no-token 401s
- `app.ts`: Added `cookieParser()` to global middleware chain

---

### 2.0.0 — Package Billing Replaces Credits (2026-03-12)

**Scope:** Backend (`middleware/packages.ts` replaces `middleware/credits.ts`), Frontend (model changes)

**Summary:** The legacy team-scoped credit system (`credits.ts`, `credit_balances`, `credit_transactions`, `credit_packages` tables) was removed. Replaced by contact-scoped package enforcement via `middleware/packages.ts` which resolves the user's contact, finds their active package subscription, and enforces credit limits per-request.

**Breaking Changes:**
- `withCreditDeduction()`, `requireCredits` (old), `deductCreditsMiddleware` — all removed
- `config/credits.ts` — removed (pricing constants inlined into `middleware/packages.ts`)
- `credit_*` tables — dropped
- X-Credit headers now come from package middleware

---

### 1.9.0 — Expanded Health Monitoring (2026-03-10)

**Scope:** Backend (`services/healthMonitor.ts`)

**Summary:** Health monitor expanded from 3 checks to 8. Added PM2 restart tracking (via `pm2 jlist`), ingestion queue health (pending jobs count), enterprise endpoint health, disk space monitoring, and Ollama model availability checks. Added in-memory deferred case queue for MySQL outage resilience.

---

### 1.8.0 — API Error Tracking Middleware (2026-03-08)

**Scope:** Backend (`middleware/apiErrorTracker.ts`, `app.ts`)

**Summary:** New middleware that hooks `res.end()` on every request. When the response status is ≥ 500, it calls `trackApiError()` to feed the health monitor's in-memory error buffer (capped at 1000 entries). This enables the health monitor to report API error rates without any database overhead.

---

### 1.7.0 — Admin Audit Logger (2026-03-07)

**Scope:** Backend (`middleware/auditLogger.ts`, `db/auditLog.ts`, `app.ts`)

**Summary:** Added audit logging for all admin actions. The `auditLogger` middleware overrides `res.end` and `res.json` to capture response status, then logs the action asynchronously after the response is sent. Uses SQLite (not MySQL) for the audit log to avoid impacting production query performance. Includes user info caching (5-min TTL), body sanitization (truncate >2000 char fields), and skip patterns for read-only endpoints.

**New files:** `middleware/auditLogger.ts` (121 LOC), `db/auditLog.ts` (421 LOC)

---

### 1.6.0 — Direct Admin/Staff Detection (2026-03-07)

**Scope:** Backend (`middleware/requireAdmin.ts`, `middleware/requireDeveloper.ts`), Frontend (route guards)

**Summary:** Migrated admin/staff detection from role-slug-based derivation (`user_roles → roles → slug = 'admin'`) to direct column checks (`users.is_admin`, `users.is_staff`). This eliminated JOIN queries in every admin-gated request and simplified the authorization model.

**Changes:**
- `requireAdmin`: Now reads `SELECT is_admin FROM users WHERE id = ?` (single query, no JOIN)
- `requireDeveloper`: Now reads `SELECT is_admin, is_staff FROM users WHERE id = ?`
- Frontend `AdminRoute.tsx`, `DeveloperRoute.tsx`: Check `user.is_admin`, `user.is_staff` directly from Zustand store

---

### 1.5.0 — Dual-Mount Pattern (2026-03-06)

**Scope:** Backend (`app.ts`)

**Summary:** Previously, routes were mounted at `/` only and the frontend proxy stripped `/api`. This caused issues when external systems called `/api/auth/login`. Now all routes are mounted on an `apiRouter` sub-router, which is attached at both `/api` and `/`, eliminating the prefix mismatch.

---

### 1.4.0 — Silent Token Refresh (2026-03-05)

**Scope:** Frontend (`services/api.ts`)

**Summary:** Implemented transparent JWT refresh in the Axios response interceptor. When a 401 is received, the interceptor attempts `POST /auth/refresh` with the expired token. Concurrent 401s are queued (subscriber pattern) and replayed when the refresh completes. On refresh failure, `forceLogout()` clears localStorage and redirects to `/login`.

---

### 1.3.0 — Ollama Warm-Up (2026-03-04)

**Scope:** Backend (`index.ts`)

**Summary:** Added `warmOllamaModels()` to the server boot sequence. Fires a single-token "hi" prompt at each configured Ollama model immediately after server start, forcing models to load into RAM. Uses `num_predict: 1` to minimize generation cost and `keep_alive: -1` to pin models permanently.

---

### 1.2.0 — Worker Auto-Restart (2026-03-03)

**Scope:** Backend (`index.ts`)

**Summary:** The ingestion worker child process now auto-restarts after unexpected exit (non-zero exit code) with a 5-second delay. Previously, a single bad ingestion job that crashed the worker would permanently stop all ingestion processing until manual PM2 restart.

---

### 1.1.0 — Health Monitor (2026-03-02)

**Scope:** Backend (`services/healthMonitor.ts`)

**Summary:** Initial health monitoring implementation with MySQL connectivity and memory usage checks. Runs every 60 seconds, creates cases on persistent failures (≥3 consecutive), and auto-resolves on recovery.

---

### 1.0.0 — Initial Platform Wiring (2026-03-02)

**Scope:** All core files

**Summary:** Initial platform wiring: Express factory (`app.ts`), middleware chain (auth, admin, status check, usage tracking, error handler), MySQL database layer (`db/mysql.ts`), Zod environment validation (`config/env.ts`), worker process isolation, frontend Zustand store, Axios client, React Router definitions.

---

## 3. Known Issues

### 3.1 No Rate Limiting on Auth Endpoints

**Severity:** 🟡 Medium  
**Since:** v1.0.0  
**Status:** Open

No `express-rate-limit` middleware is applied to `/auth/login`, `/auth/register`, or `/auth/pin/verify`. While PIN login has its own rate limit (5 attempts → 15-min lockout in the `user_pins` table), password login has no rate limiting.

**Impact:** Brute force attacks possible on password login.  
**Workaround:** WAF/Apache rate limiting at the reverse proxy level.

---

### 3.2 CORS Allows All Origins with Credentials

**Severity:** 🟡 Low-Medium  
**Since:** v1.0.0  
**Status:** Open

The CORS middleware reflects the request `Origin` header and sets `Access-Control-Allow-Credentials: true`, effectively allowing any origin to make credentialed requests.

**Impact:** Potential CSRF vectors (mitigated by JWT-in-header auth model).  
**Workaround:** Single-tenant deployment reduces attack surface.

---

### 3.3 `execSync` in Health Monitor

**Severity:** 🟢 Low  
**Since:** v1.9.0  
**Status:** Open

`execSync('df /')` and `execSync('pm2 jlist')` block the event loop for 10–100ms during each health check cycle.

**Impact:** ~200ms event loop block per minute (non-critical on a single-tenant server).  
**Fix:** Migrate to `child_process.exec()` (async) with callback.

---

### 3.4 Legacy Entity Types in mysql.ts

**Severity:** 🟢 Low  
**Since:** v1.0.0  
**Status:** Open

`db/mysql.ts` defines 12+ entity interfaces, some referencing deprecated systems (credit_balances, subscription_plans). These types are only partially used by current code.

**Impact:** Code clutter, potential confusion for new developers.  
**Fix:** Move entity types to their respective module files.

---

### 3.5 Single Worker Restart Attempt

**Severity:** 🟢 Low  
**Since:** v1.2.0  
**Status:** Open

The worker auto-restart in `index.ts` only handles one level of restart. If the restarted worker also crashes, no further restart is attempted.

**Impact:** Sustained worker crashes (rare) require manual PM2 restart.  
**Fix:** Implement exponential backoff with max retry count.

---

## 4. Superseded Documentation

The following documentation is **superseded** by this Wiring documentation:

| Old Document | Status | Notes |
|-------------|--------|-------|
| [Crosscutting/Infrastructure/README.md](../Crosscutting/Infrastructure/README.md) | ⚠️ Outdated (v1.0.0) | References removed `credits.ts` middleware, missing apiErrorTracker, auditLogger, packages, requireDeveloper, healthMonitor, dual-mount pattern |
| [Crosscutting/Infrastructure/FILES.md](../Crosscutting/Infrastructure/FILES.md) | ⚠️ Outdated (v1.0.0) | Lists `credits.ts` (removed), `team.ts` (dead code), missing 6 new files |

These files are retained for historical reference but should not be used as the authoritative source for platform wiring. Use this `Wiring/` documentation set instead.
