# Platform Core Wiring — Architecture Patterns

**Version:** 2.2.0  
**Last Updated:** 2026-03-14

---

## 1. Overview

This document catalogs the architecture patterns and anti-patterns found in the SoftAware platform's core wiring — the boot sequence, middleware chain, database layer, health monitoring, and frontend app shell.

---

## 2. Architectural Patterns

### 2.1 Dual-Mount Route Pattern

**Context:** The frontend SPA (served from `softaware.net.za`) calls the API through a `/api` prefix (e.g., `/api/auth/login`), but external clients and curl commands call the API directly without the prefix (e.g., `/auth/login`). This caused persistent 404s depending on how the request was made.

**Implementation:**

```typescript
// app.ts
const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/contacts', contactsRouter);
// ... 84 route mounts total

// Mount the same router at BOTH paths
app.use('/api', apiRouter);  // ← frontend calls /api/auth/login → strips /api → /auth/login
app.use('/',    apiRouter);  // ← direct calls  /auth/login     → /auth/login
```

**Benefits:**
- ✅ Single source of truth — routes defined once, accessible at both prefixes
- ✅ No URL rewriting, no reverse proxy rules
- ✅ Frontend can use `/api` prefix consistently
- ✅ External integrations (webhooks, MCP, mobile) can use bare paths

**Drawbacks:**
- ❌ Every route is effectively registered twice in Express's internal tree
- ❌ `req.originalUrl` includes the prefix when called via `/api`, which can confuse logging

---

### 2.2 Composable Middleware Chain Pattern

**Context:** Different routes need different combinations of auth, RBAC, billing, status checks, and auditing. A fixed middleware chain would be too restrictive (public routes don't need auth) or too permissive (AI routes need credit checks).

**Implementation:**

```typescript
// Per-route middleware composition in route files:
router.get('/resource', requireAuth, async (req, res) => { ... });
router.post('/admin-action', requireAuth, requireAdmin, async (req, res) => { ... });

// At the app.ts level, audit logging applied to admin route groups:
apiRouter.use('/admin', auditLogger as any, adminRouter);
apiRouter.use('/settings', auditLogger as any, settingsRouter);

// Status checks applied to resource-scoped routes:
apiRouter.use('/assistants', checkAssistantStatus, assistantsRouter);
apiRouter.use('/v1', checkWidgetStatus, widgetChatRouter);
```

**Middleware composition order:**
```
Global: helmet → CORS → cookieParser → JSON → morgan → apiErrorTracker
Route:  requireAuth → requireAdmin|requireDeveloper → auditLogger
        → checkAccountStatus → requirePackage → requireCredits
        → checkAssistantStatus|checkWidgetStatus → trackUsage
Final:  errorHandler
```

**Benefits:**
- ✅ Each route gets exactly the protection it needs
- ✅ New middleware can be added without modifying existing routes
- ✅ Clear separation: global middleware in app.ts, route middleware in route files

**Drawbacks:**
- ❌ Easy to forget middleware on a new route (no compile-time enforcement)
- ❌ `auditLogger as any` type assertion needed because of `AuthRequest` vs `Request` mismatch

---

### 2.3 Token Cascade Authentication Pattern

**Context:** The platform supports multiple client types — browser SPA (sends Bearer token), mobile app (sends Bearer token), and cookie-based sessions (after cache clear where localStorage is wiped but HTTP-only cookie persists).

**Implementation:**

```typescript
// middleware/auth.ts
export function requireAuth(req, _res, next) {
  let token: string | undefined;

  // 1. Prefer Authorization header (Bearer token)
  const auth = req.header('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    token = auth.slice('bearer '.length);
  }

  // 2. Fall back to HTTP-only cookie
  if (!token && req.cookies?.[AUTH_COOKIE]) {
    token = req.cookies[AUTH_COOKIE];
  }

  if (!token) return next(unauthorized('No token provided'));

  // 3. Verify and extract userId
  const decoded = jwt.verify(token, env.JWT_SECRET);
  req.userId = decoded.userId;
  req.auth = { userId: decoded.userId };
  next();
}
```

**Benefits:**
- ✅ Works for all client types (SPA, mobile, API, CLI)
- ✅ Cookie fallback provides session continuity after localStorage clear
- ✅ Single middleware handles all authentication paths

**Drawbacks:**
- ❌ Stateless JWT — no revocation without a blacklist
- ❌ Cookie + Bearer coexistence adds complexity to CORS/SameSite configuration

---

### 2.4 Silent Token Refresh Pattern (Frontend)

**Context:** JWTs expire (default 1h). When a request returns 401, the frontend must transparently refresh the token and retry the request without disrupting the user experience. Concurrent requests that fail with 401 during a refresh must be queued and replayed.

**Implementation:**

```typescript
// services/api.ts — Response interceptor
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status !== 401) return Promise.reject(error);

    // Skip for login/register attempts
    if (isLoginAttempt || isRegisterAttempt) return Promise.reject(error);

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest._retry = true;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const { data } = await axios.post('/auth/refresh', { accessToken: storedToken });
      localStorage.setItem('jwt_token', data.accessToken);
      onTokenRefreshed(data.accessToken);  // Replay all queued requests
      isRefreshing = false;
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch {
      isRefreshing = false;
      forceLogout();
    }
  }
);
```

**Benefits:**
- ✅ Transparent to all components — no manual refresh logic needed
- ✅ Concurrent 401s are queued, not duplicated (prevents refresh storms)
- ✅ Automatic retry of the original request after refresh
- ✅ Cookie-based session recovery as additional fallback

**Drawbacks:**
- ❌ Complex state machine (isRefreshing, subscribers, retry flag)
- ❌ No way to cancel queued requests if user navigates away

---

### 2.5 Worker Process Isolation Pattern

**Context:** The ingestion worker (web scraping with Cheerio, AI-powered content cleaning, vector embedding) can consume 50–200MB of heap. Running this in the Express process risks OOM kills that take down the entire API server.

**Implementation:**

```typescript
// index.ts
const worker = fork(workerScript, [], {
  env: { ...process.env },
  execArgv: isDev
    ? ['--import', 'tsx', '--max-old-space-size=1024']
    : ['--max-old-space-size=1024'],
});

// Auto-restart on crash
worker.on('exit', (code, signal) => {
  if (code !== 0) {
    setTimeout(() => {
      const w2 = fork(workerScript, [...]);
      console.log('[Worker] Restarted, pid:', w2.pid);
    }, 5_000);
  }
});
```

**Benefits:**
- ✅ Fully isolated heap — worker OOM doesn't kill Express
- ✅ Configurable memory limit (1GB) separate from main process
- ✅ Auto-restart on crash (5s delay) — single bad ingestion job doesn't kill the queue permanently
- ✅ Dev/prod agnostic — auto-detects `.ts` (tsx) vs `.js` extension

**Drawbacks:**
- ❌ IPC between parent and child is message-passing only (no shared memory)
- ❌ Only one restart attempt — sustained crashes will stop restarting after the second exit

---

### 2.6 Ollama Model Warm-Up Pattern

**Context:** Ollama cold-starts are 5–15 seconds as models load from disk into GPU/CPU RAM. The first user request after a server restart would experience this latency.

**Implementation:**

```typescript
async function warmOllamaModels(): Promise<void> {
  const models = [
    { name: env.ASSISTANT_OLLAMA_MODEL, label: 'Assistant' },
    { name: env.TOOLS_OLLAMA_MODEL,     label: 'Tools' },
  ];
  // De-duplicate if both point to the same model
  const unique = models.filter((m, i, arr) => arr.findIndex(x => x.name === m.name) === i);

  for (const m of unique) {
    await fetch(`${base}/api/chat`, {
      method: 'POST',
      body: JSON.stringify({
        model: m.name,
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        options: { num_predict: 1 },  // Generate exactly 1 token
        keep_alive: keepAlive,        // Pin in RAM (-1 = forever)
      }),
    });
  }
}
```

**Benefits:**
- ✅ First user request gets hot model (no 5–15s wait)
- ✅ `num_predict: 1` minimizes warm-up time and token cost
- ✅ `keep_alive: -1` keeps models pinned in RAM between requests
- ✅ De-duplicates if both models point to the same name
- ✅ Non-blocking — failures logged but never prevent server startup

**Drawbacks:**
- ❌ Increases server startup time by 2–10s per model
- ❌ Consumes RAM immediately even if no AI requests come in

---

### 2.7 Self-Healing Health Monitor Pattern

**Context:** A single-tenant platform with no dedicated ops team needs to detect and respond to infrastructure problems automatically. Manual monitoring is not scalable.

**Implementation:**

```
Every 60 seconds:
  1. Run 8 health checks (MySQL, API errors, memory, disk, Ollama, PM2, ingestion, enterprise)
  2. Each check returns { status: 'healthy'|'warning'|'error', details }
  3. Track consecutive failures per check in-memory Map
  4. If failures >= FAILURE_THRESHOLD (3):
     → Check if open case exists for this check_type
     → If not, INSERT INTO cases + notify admins
  5. If check recovers after having an open case:
     → Update case status to 'resolved' + notify admins
  6. If MySQL is down, queue deferred cases in memory
     → Flush when MySQL recovers
```

**Benefits:**
- ✅ Zero-human-intervention detection of infrastructure degradation
- ✅ Cases provide audit trail of every incident
- ✅ Threshold prevents alert storms from transient issues
- ✅ Auto-resolution reduces noise when issues self-heal
- ✅ In-memory state survives the very database outage it's detecting

**Drawbacks:**
- ❌ 60s polling interval means up to 60s detection lag
- ❌ `execSync` for `df` and `pm2 jlist` blocks the event loop briefly
- ❌ Health monitor itself can't be health-checked (circular)

---

### 2.8 Fail-Open Status Check Pattern

**Context:** The status check middleware blocks requests for suspended/expired accounts. But if the database is unreachable, should legitimate requests be blocked?

**Implementation:**

```typescript
export async function checkAccountStatus(req, res, next) {
  try {
    const user = await db.queryOne('SELECT account_status FROM users WHERE id = ?', [userId]);
    if (!user) return next();                    // User not found — let auth handle it
    if (user.account_status !== 'active') {
      return blockResponse(res, user.account_status);
    }
    next();
  } catch (err) {
    console.error('[statusCheck] Failed:', err);
    next();  // ← FAIL OPEN: don't block on DB errors
  }
}
```

**Benefits:**
- ✅ Legitimate users are never blocked by infrastructure failures
- ✅ Suspension enforcement only fails when DB is down (rare)

**Drawbacks:**
- ❌ Suspended users could access the system during DB outages
- ❌ Requires separate monitoring to detect DB connectivity issues

---

### 2.9 Smart Dashboard Routing Pattern (Frontend)

**Context:** The platform serves two distinct user types — admin/staff users (full dashboard) and client portal users (simplified portal). Both access `/` and `/dashboard`.

**Implementation:**

```tsx
const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAppStore();
  if (!isAuthenticated) return <LandingPage />;
  if (user?.is_admin || user?.is_staff) return <Layout><AdminDashboard /></Layout>;
  return <PortalLayout><PortalDashboard /></PortalLayout>;
};

const SmartDashboard: React.FC = () => {
  const { user } = useAppStore();
  if (user?.is_admin || user?.is_staff) return <Layout><AdminDashboard /></Layout>;
  return <PortalLayout><PortalDashboard /></PortalLayout>;
};
```

**Benefits:**
- ✅ Single URL (`/`) works for all user types
- ✅ Each user type gets the appropriate layout and dashboard
- ✅ No redirect chains — direct render based on role

**Drawbacks:**
- ❌ Layout wrapping happens inside the component, not in the route definition (inconsistent with other routes)
- ❌ `is_admin || is_staff` check duplicated in both components

---

### 2.10 Environment-Aware API Resolution Pattern (Frontend)

**Context:** The frontend must connect to different API URLs in development (localhost:8787), direct IP access (dev server via IP:3003), and production (api.softaware.net.za). A single hardcoded URL won't work.

**Implementation:**

```typescript
function getApiBaseUrl(): string {
  // 1. Skip LS override for local/IP access (prevents stale URLs)
  if (!isLocalEnvironment() && !isDirectIpAccess()) {
    // 2. Check localStorage for white-label override
    const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
    if (settings.site_base_url) return settings.site_base_url;
  }
  // 3. Fall back to environment detection
  if (isLocalEnvironment()) return 'http://localhost:8787/api';
  if (isDirectIpAccess()) return `http://${hostname}:8787/api`;
  return 'https://api.softaware.net.za/api';
}
```

**Benefits:**
- ✅ Zero-config for all three environments
- ✅ White-label support via `app_settings` localStorage override
- ✅ Direct IP access works for remote development
- ✅ Stale localStorage values skipped for dev environments

**Drawbacks:**
- ❌ Runtime detection relies on `window.location.hostname` — doesn't work in SSR
- ❌ White-label override stored in localStorage can become stale

---

## 3. Anti-Patterns & Technical Debt

### 3.1 `auditLogger as any` Type Assertion

**Location:** `app.ts` (9 occurrences)

**Issue:** The `auditLogger` middleware expects `AuthRequest` (which has `userId`) but Express types expect `Request`. The cast `auditLogger as any` bypasses type safety.

**Risk:** Low — `auditLogger` gracefully handles missing `userId` (logs empty string).

**Fix:** Define `auditLogger` with `(req: Request, ...)` and internally cast to `AuthRequest`, or use a type-compatible wrapper.

---

### 3.2 No Rate Limiting on Public Endpoints

**Location:** `app.ts` (global)

**Issue:** No `express-rate-limit` middleware is applied. Brute force attacks on `/auth/login`, `/auth/pin/verify`, and `/auth/register` are possible.

**Mitigation:** PIN login has its own rate limit (5 attempts → 15-min lockout). Login has no rate limit.

**Risk:** Medium — should add rate limiting to auth endpoints.

---

### 3.3 CORS Reflects All Origins

**Location:** `app.ts` (inline CORS middleware)

**Issue:** `Access-Control-Allow-Origin` is set to the request's `Origin` header value, effectively allowing any origin with credentials.

**Mitigation:** Single-tenant platform behind auth — risk is limited to CSRF vectors.

**Risk:** Low-Medium — consider allowlisting known origins in production.

---

### 3.4 Synchronous `execSync` in Health Monitor

**Location:** `healthMonitor.ts` (disk space check, PM2 restart check)

**Issue:** `execSync('df /')` and `execSync('pm2 jlist')` block the Node.js event loop for 10–100ms each.

**Mitigation:** Runs every 60s in the main loop, not on request path. Impact is ~200ms event loop block per minute.

**Risk:** Low — but should migrate to `exec` (async) for correctness.

---

### 3.5 Single Worker Restart Attempt

**Location:** `index.ts` (worker exit handler)

**Issue:** If the restarted worker also crashes, it won't restart again. There's no exponential backoff or max-restart limit.

**Risk:** Low — in practice, worker crashes are caused by individual bad jobs (which are processed and moved past on restart).

---

### 3.6 Legacy Entity Types in `db/mysql.ts`

**Location:** `db/mysql.ts` (lines 200–334)

**Issue:** The file defines 12+ entity interfaces (`Team`, `team_members`, `Subscription`, `Payment`, etc.) that are only partially used. Some reference the deprecated credit/subscription system.

**Risk:** Low — unused types don't affect runtime, but clutter the file.

**Fix:** Move entity types to their respective module files; keep only `User` and utility types in `mysql.ts`.
