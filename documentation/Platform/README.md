# Platform Core Wiring — Overview

**Version:** 2.2.0  
**Last Updated:** 2026-03-14

---

## 1. Overview

### Purpose

The Core Wiring is the foundational glue that boots the SoftAware platform, connects every module, and defines the request lifecycle from browser click to database query and back. It is **not** a feature module — it owns no business logic. Instead, it provides:

- **Server Bootstrap** — Express + Socket.IO + ingestion worker + Ollama warm-up
- **Application Factory** — 84 route mounts, dual `/` + `/api` prefix, static asset serving
- **Middleware Chain** — 11 middleware functions composing auth, RBAC, billing, status, auditing, and error tracking
- **Database Layer** — mysql2/promise connection pool, query helpers, UUID generation, type definitions
- **Environment Config** — Zod-validated schema for 130+ environment variables
- **Error Pipeline** — Typed `HttpError` class + global error handler
- **Health Monitoring** — Continuous system health checks (MySQL, memory, disk, API errors, Ollama, PM2) with auto-case creation
- **Frontend App Shell** — React Router definitions, Zustand global state, Axios interceptors with silent JWT refresh, environment-aware API base URL
- **Route Guards** — ProtectedRoute, AdminRoute, DeveloperRoute, PermissionRoute, Can

Every feature module (Authentication, Contacts, Invoices, AI Gateway, etc.) is a plugin that registers itself into this wiring via `app.ts` route mounts and consumes the `db`, `requireAuth`, `HttpError`, and `env` exports.

### Business Value

- **Single boot sequence** — one `pm2 start` launches Express, Socket.IO, ingestion worker, and Ollama warm-up
- **Uniform request lifecycle** — every API call passes through the same middleware chain (CORS → Helmet → JSON → auth → RBAC → billing → handler → error handler)
- **Zero-config module registration** — adding a new module = import router + one `apiRouter.use()` line
- **Dual-mount pattern** — all routes accessible at both `/auth/login` and `/api/auth/login`, eliminating prefix mismatch bugs
- **Self-healing** — ingestion worker auto-restarts on crash; health monitor auto-creates cases for degraded services
- **Silent auth recovery** — frontend Axios interceptor handles 401 → refresh → retry transparently to the user

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend core files | 17 |
| Backend core LOC | 3,029 |
| Frontend core files | 10 |
| Frontend core LOC | 1,167 |
| **Total core files** | **27** |
| **Total core LOC** | **~4,196** |
| Middleware functions | 11 |
| Route mounts (app.ts) | 84 |
| Environment variables | 130+ (Zod-validated) |
| Health checks | 8 (MySQL, API errors, memory, disk, Ollama, PM2, ingestion, enterprise) |

---

## 2. Architecture

### 2.1 Server Bootstrap Sequence

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     PM2 → node dist/index.js                            │
│                                                                         │
│  1. createApp()                                                         │
│     ├── express()                                                       │
│     ├── helmet + CORS + cookieParser + JSON(20MB) + morgan              │
│     ├── apiErrorTracker middleware (hooks res.end for 5xx tracking)      │
│     ├── static assets: /public, /uploads, /assets                       │
│     ├── /healthz → { ok: true }                                         │
│     ├── apiRouter = express.Router()                                    │
│     │   └── 84 route mounts (auth, contacts, invoices, ai, etc.)        │
│     ├── app.use('/api', apiRouter)  ← UI proxy path                     │
│     ├── app.use('/',    apiRouter)  ← direct API path                   │
│     ├── 404 handler                                                     │
│     ├── errorHandler                                                    │
│     └── startHealthMonitoring()                                         │
│                                                                         │
│  2. server = app.listen(PORT)                                           │
│     ├── initTeamChatSocket(server)    → /team-chats namespace           │
│     ├── initChatSocket(server, io)    → /chat namespace (reuse io)      │
│     ├── fork(ingestionWorkerProcess)  → child process (1GB heap)        │
│     │   └── auto-restart on crash (5s delay)                            │
│     └── warmOllamaModels()            → fire "hi" at each model         │
│                                                                         │
│  3. server.setTimeout(120_000)  ← 2min for DeepSeek MoE generation     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Request Lifecycle

```
┌────────────┐     HTTPS      ┌──────────────┐    ProxyPass    ┌─────────────┐
│  Browser   │ ─────────────▶ │   Apache     │ ──────────────▶ │  Express    │
│  (React)   │                │  (TLS term)  │                 │  (:8787)    │
└────────────┘                └──────────────┘                 └──────┬──────┘
                                                                      │
          ┌───────────────────────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MIDDLEWARE CHAIN (applied per-request)                                  │
│                                                                         │
│  ┌─────────┐  ┌──────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Helmet  │→ │ CORS │→ │ cookieParser │→ │JSON(20MB)│→ │  morgan  │  │
│  └─────────┘  └──────┘  └──────────────┘  └──────────┘  └──────────┘  │
│                                                                         │
│  ┌──────────────────┐                                                   │
│  │ apiErrorTracker  │  ← hooks res.end() to feed 5xx to healthMonitor  │
│  └────────┬─────────┘                                                   │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ROUTE-LEVEL MIDDLEWARE (per-route, composable)                  │   │
│  │                                                                  │   │
│  │  requireAuth ──▶ requireAdmin / requireDeveloper                │   │
│  │       │                     │                                    │   │
│  │       ▼                     ▼                                    │   │
│  │  checkAccountStatus   auditLogger (admin routes only)           │   │
│  │       │                     │                                    │   │
│  │       ▼                     ▼                                    │   │
│  │  requirePackage ──▶ requireCredits ──▶ packageCreditMiddleware  │   │
│  │  (contact-scoped)   (402 if empty)    (deduct on res.json)      │   │
│  │                                                                  │   │
│  │  checkAssistantStatus / checkWidgetStatus (resource-scoped)     │   │
│  │  trackUsage (tier-based message limits)                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │  ROUTE HANDLER   │  ← db.query(), db.transaction(), etc.           │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐   ┌──────────────┐                               │
│  │  errorHandler    │   │  404 handler │                               │
│  │  HttpError→JSON  │   │  { error }   │                               │
│  └──────────────────┘   └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Frontend App Shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│  index.tsx → App.tsx                                                    │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Hooks (initialized once at root)                                │   │
│  │  useAuth()  — silent token refresh on mount                     │   │
│  │  useTheme() — applies 'dark' class to <html>, persists to LS   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  <Router>                                                        │   │
│  │    <Toaster />             ← react-hot-toast                    │   │
│  │    <CaseReportHandle />    ← print handler for case reports     │   │
│  │    <Routes>                                                      │   │
│  │      /                     → HomePage (LandingPage or Dashboard)│   │
│  │      /login, /register     → AuthPage (public)                  │   │
│  │      /dashboard            → SmartDashboard (admin vs portal)   │   │
│  │      /portal/*             → ProtectedRoute > PortalLayout      │   │
│  │      /contacts, /invoices  → PermissionRoute > Layout           │   │
│  │      /admin/*              → AdminRoute > Layout                │   │
│  │      /database             → DeveloperRoute > Layout            │   │
│  │      /system/*             → PermissionRoute > Layout           │   │
│  │    </Routes>                                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Route Guards                                                    │   │
│  │  ProtectedRoute  — redirects unauth to /login                   │   │
│  │  AdminRoute      — requires user.is_admin or user.is_staff      │   │
│  │  DeveloperRoute  — requires developer role                      │   │
│  │  PermissionRoute — requires specific permission slug            │   │
│  │  Can             — conditional render: <Can perm="x">...</Can> │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  services/api.ts (Axios)                                         │   │
│  │  ┌──────────────┐  ┌─────────────────────────────────────────┐  │   │
│  │  │ Request       │  │ Response Interceptor                    │  │   │
│  │  │ Interceptor   │  │                                         │  │   │
│  │  │               │  │ 401 → try silent refresh via POST       │  │   │
│  │  │ Attach Bearer │  │        /auth/refresh                    │  │   │
│  │  │ from LS token │  │      → retry original request           │  │   │
│  │  │               │  │      → queue concurrent 401s            │  │   │
│  │  │               │  │ 401 (no token) → try cookie session     │  │   │
│  │  │               │  │ 401 (refresh fail) → forceLogout()      │  │   │
│  │  │               │  │ 403 → toast error (permission denied)   │  │   │
│  │  └──────────────┘  └─────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  store/index.ts (Zustand)                                        │   │
│  │  Auth: user, isAuthenticated, hasPermission(), logout()         │   │
│  │  Contacts: contacts, customers, suppliers                       │   │
│  │  Finance: quotations, invoices, pricingItems, categories        │   │
│  │  UI: sidebarOpen, loading                                       │   │
│  │  Init: reads user + jwt_token from localStorage                 │   │
│  │  Logout: clears LS, disconnects Socket.IO                      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Health Monitoring Loop

```
┌──────────────────────────────────────────────────────────────────────────┐
│  startHealthMonitoring()  — called once from createApp()                │
│  setInterval(runAllChecks, 60_000)                                      │
│                                                                         │
│  Every 60 seconds:                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐    │
│  │ 1. MySQL         │ │ 2. API Error Rate│ │ 3. Memory & Heap    │    │
│  │ SELECT 1 + pool  │ │ 5xx in last 60s  │ │ process.memoryUsage │    │
│  │ + SHOW STATUS    │ │ from middleware   │ │ + os.freemem/total  │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐    │
│  │ 4. Disk Space    │ │ 5. Ollama        │ │ 6. PM2 Restarts     │    │
│  │ df / → usage %   │ │ GET /api/tags    │ │ pm2 jlist (JSON)    │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐                             │
│  │ 7. Ingestion Q   │ │ 8. Enterprise    │                             │
│  │ pending jobs > 5 │ │ endpoint health  │                             │
│  └──────────────────┘ └──────────────────┘                             │
│                                                                         │
│  On failure (≥3 consecutive):                                           │
│    → INSERT INTO cases (auto-case with severity + detail)              │
│    → createNotification() to admins                                    │
│  On recovery:                                                           │
│    → Auto-resolve the case                                             │
│                                                                         │
│  In-memory state survives DB outages → deferred cases queued           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Middleware Reference

| # | Middleware | File | LOC | Purpose | Applied To |
|---|-----------|------|-----|---------|------------|
| 1 | **Helmet** | express (built-in) | — | Security headers (CSP, HSTS, etc.) | All requests |
| 2 | **CORS** | app.ts (inline) | ~15 | Dynamic origin reflection + credentials | All requests |
| 3 | **cookieParser** | express (built-in) | — | Parse HTTP-only auth cookies | All requests |
| 4 | **JSON parser** | express (built-in) | — | Parse JSON body up to 20MB | All requests |
| 5 | **morgan** | morgan (built-in) | — | HTTP request logging (dev format) | All requests |
| 6 | **apiErrorTracker** | middleware/apiErrorTracker.ts | 27 | Feed 5xx errors to healthMonitor buffer | All requests (before routes) |
| 7 | **requireAuth** | middleware/auth.ts | 84 | JWT verification (Bearer header or cookie) → sets `req.userId` | Per-route |
| 8 | **requireAdmin** | middleware/requireAdmin.ts | 50 | Checks `users.is_admin = 1` | Admin routes |
| 9 | **requireDeveloper** | middleware/requireDeveloper.ts | 48 | Checks `users.is_admin = 1` OR `users.is_staff = 1` | Developer routes |
| 10 | **statusCheck** | middleware/statusCheck.ts | 175 | 3-level status hierarchy (account → assistant → widget) | Resource routes |
| 11 | **auditLogger** | middleware/auditLogger.ts | 121 | Logs admin actions (who, what, when, status, duration) | Admin routes via `auditLogger as any` |
| 12 | **packages** | middleware/packages.ts | 221 | Contact-scoped package/credit enforcement | AI/billing routes |
| 13 | **usageTracking** | middleware/usageTracking.ts | 344 | Tier-based monthly message limits | AI chat routes |
| 14 | **errorHandler** | middleware/errorHandler.ts | 12 | Global error → JSON response (`HttpError` or 500) | All requests (final) |

---

## 4. Dual-Mount Route Map

All 84 route files are mounted on a single `apiRouter` which is then attached at **two** mount points:

```typescript
app.use('/api', apiRouter);  // UI proxy (frontend calls /api/auth/login)
app.use('/',    apiRouter);  // Direct API (curl calls /auth/login)
```

### Route Mount Groups

| Group | Mount Path | Router | Middleware |
|-------|-----------|--------|------------|
| **Auth** | `/auth` | authRouter | — |
| **Auth 2FA** | `/auth/2fa` | twoFactorRouter | — |
| **Admin** | `/admin` | adminRouter | auditLogger |
| **Admin sub-routes** | `/admin/config`, `/admin/dashboard`, `/admin/ai-overview`, `/admin/packages`, `/admin/clients`, `/admin/enterprise-endpoints`, `/admin/client-api-configs`, `/admin/cases`, `/admin/audit-log` | Various | auditLogger |
| **AI & Assistants** | `/ai`, `/glm`, `/ai-config`, `/assistants`, `/assistants/:id/ingest` | Various | checkAssistantStatus |
| **Enterprise** | `/v1/webhook`, `/v1/client-api`, `/v1/mobile`, `/v1/mobile/my-assistant`, `/v1/mobile/staff-assistant` | Various | — |
| **Widgets** | `/v1` (widgetChat), `/v1/ingest`, `/v1/sites`, `/v1/leads` | Various | checkWidgetStatus |
| **Software/Tasks** | `/softaware/tasks`, `/softaware/software`, `/softaware/modules`, `/local-tasks`, `/bugs` | Various | — |
| **Updates** | `/updates/software`, `/updates/updates`, `/updates` (files), `/updates/heartbeat`, `/updates/error-report`, `/updates/clients`, `/updates/modules` | Various | — |
| **Business** | `/contacts`, `/quotations`, `/invoices`, `/transactions`, `/accounting`, `/payments`, `/financial-reports`, `/expense-categories`, `/reports`, `/vat-reports`, `/pricing`, `/categories` | Various | — |
| **System** | `/users`, `/roles`, `/permissions`, `/credentials`, `/settings`, `/app-settings`, `/database` | Various | auditLogger |
| **Communication** | `/team-chats`, `/staff-chat`, `/email`, `/sms`, `/webmail`, `/notifications`, `/fcm-tokens` | Various | auditLogger (email, sms) |
| **Other** | `/dashboard`, `/profile`, `/packages`, `/subscriptions`, `/cases`, `/planning`, `/agents`, `/teams`, `/vault`, `/activation`, `/sync`, `/mcp`, `/files`, `/api-keys`, `/code`, `/code/git`, `/code-implementation`, `/public/leads` | Various | — |
| **Aliases** | `/` (accountingRouter) | accountingRouter | — |

---

## 5. Environment Configuration Groups

The `config/env.ts` file defines 130+ environment variables via a Zod schema. They crash the server at startup if required vars are missing or malformed.

| Group | Count | Key Variables | Purpose |
|-------|-------|---------------|---------|
| **Core** | 6 | PORT, NODE_ENV, CORS_ORIGIN, JWT_SECRET, JWT_EXPIRES_IN, DATABASE_URL | Server essentials |
| **SMTP** | 6 | SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM | Email delivery |
| **Ollama** | 10 | OLLAMA_BASE_URL, OLLAMA_MODEL, ASSISTANT_OLLAMA_MODEL, TOOLS_OLLAMA_MODEL, VISION_OLLAMA_MODEL, LEADS_OLLAMA_MODEL, SITE_BUILDER_OLLAMA_MODEL, OLLAMA_VISION_MODEL, OLLAMA_KEEP_ALIVE, INGESTION_OLLAMA_MODEL | Local LLM config |
| **GLM (z.ai)** | 5 | GLM, GLM_MODEL, GLM_VISION_MODEL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL | GLM-4 API |
| **OpenRouter** | 7 | OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODEL, ASSISTANT_OPENROUTER_MODEL, INGESTION_OPENROUTER_MODEL, VISION_OPENROUTER_MODEL | OpenRouter API |
| **OpenAI** | 4 | OPENAI, OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL | OpenAI API |
| **AWS Bedrock** | 5 | AWS, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BEDROCK_MODEL | AWS Bedrock |
| **Vision** | 4 | SOFTAWARE_VISION_PROVIDER, VISION_OLLAMA_MODEL, VISION_OPENROUTER_MODEL, VISION_OPENROUTER_FALLBACK | Multimodal routing |
| **Site Builder** | 3 | SITE_BUILDER_OLLAMA_MODEL, SITE_BUILDER_GLM_MODEL, SITE_BUILDER_OPENROUTER_MODEL | AI site generation |
| **Firebase** | 3 | FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY | Push notifications |
| **Forex** | 7 | EXCHANGE_RATE_API_KEY, FOREX, ZAR_THRESHOLD_USD/EUR/GBP, ALERT_EMAIL, BRIEFING_EMAIL | Currency alerts |
| **News** | 2 | NEWSAPI, GNEWS | Market sentiment |
| **Fleet** | 4 | TRACCAR_HOST, TRACCAR_EMAIL, TRACCAR_PASSWORD, FLEET_ALERT_EMAIL | Fleet tracking |
| **Code Agent** | 2 | CODE_AGENT_WORKSPACE, CODE_AGENT_ENABLED | MCP code agent |
| **AI Selection** | 1 | DEFAULT_AI_PROVIDER | glm or ollama default |
| **MCP** | 1 | MCP_ENABLED | MCP server toggle |
| **2FA** | 1 | TWO_FACTOR_APP_NAME | OTP app name |

---

## 6. Database Layer API

The `db` object from `db/mysql.ts` is the sole database access point used by all 84 route files and 44 services.

| Method | Signature | Returns | Use Case |
|--------|-----------|---------|----------|
| `db.query<T>()` | `(sql, params?) → Promise<T[]>` | Array of rows | SELECT multiple rows |
| `db.queryOne<T>()` | `(sql, params?) → Promise<T \| null>` | Single row or null | SELECT one row (LIMIT 1) |
| `db.insert()` | `(sql, params?) → Promise<string>` | Insert ID (string) | Raw INSERT |
| `db.insertOne()` | `(table, data) → Promise<string>` | Insert ID (string) | Object → INSERT (auto-builds SQL) |
| `db.execute()` | `(sql, params?) → Promise<number>` | Affected rows count | UPDATE / DELETE |
| `db.transaction<T>()` | `(cb) → Promise<T>` | Callback result | BEGIN → callback → COMMIT/ROLLBACK |
| `db.ping()` | `() → Promise<boolean>` | true/false | Health check |
| `db.close()` | `() → Promise<void>` | void | Shutdown |

### Utilities

| Function | Signature | Returns | Purpose |
|----------|-----------|---------|---------|
| `generateId()` | `() → string` | UUID v4 | `crypto.randomUUID()` for all entity IDs |
| `toMySQLDate()` | `(Date) → string` | `'YYYY-MM-DD HH:mm:ss'` | JS Date → MySQL datetime (UTC) |
| `fromMySQLDate()` | `(string\|Date) → Date` | Date | MySQL datetime → JS Date |

### Pool Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| connectionLimit | 10 | Adequate for single-tenant; prevents MySQL thread exhaustion |
| waitForConnections | true | Queue rather than reject when pool is full |
| queueLimit | 0 | Unlimited queue (prevents dropped requests) |
| enableKeepAlive | true | Prevents idle timeout disconnects |
| timezone | `+00:00` | All dates stored/read as UTC |

---

## 7. Frontend Route Guard Matrix

| Guard | Component | Condition | Redirect | Usage Count |
|-------|-----------|-----------|----------|-------------|
| **ProtectedRoute** | ProtectedRoute.tsx (63 LOC) | `isAuthenticated` from Zustand store | → `/login` | ~30 routes |
| **AdminRoute** | AdminRoute.tsx (20 LOC) | `user.is_admin \|\| user.is_staff` | → `/` (home) | ~10 routes |
| **DeveloperRoute** | DeveloperRoute.tsx (34 LOC) | Developer role check | → `/` | 1 route (/database) |
| **PermissionRoute** | PermissionRoute.tsx (60 LOC) | `hasPermission(slug)` or `is_admin/is_staff` | → `/` | ~10 routes |
| **Can** | Can.tsx (66 LOC) | Inline conditional render by permission | — (hides content) | Throughout |
| **PermissionSync** | PermissionSync.tsx (269 LOC) | Syncs permissions on login/mount | — | Once (App root) |

---

## 8. Integration Map

### What Core Wiring Provides

| Export | From | Consumed By |
|--------|------|-------------|
| `db`, `generateId`, `toMySQLDate` | db/mysql.ts | All 84 route files, all 44 services |
| `requireAuth`, `getAuth`, `signAccessToken` | middleware/auth.ts | All authenticated routes |
| `requireAdmin` | middleware/requireAdmin.ts | Admin routes (admin/*, settings, users, roles) |
| `requireDeveloper` | middleware/requireDeveloper.ts | Developer routes (database) |
| `env` | config/env.ts | All services needing config (AI, SMTP, Firebase, etc.) |
| `HttpError`, `notFound`, `unauthorized`, `forbidden`, `badRequest` | utils/httpErrors.ts | All route handlers for error responses |
| `auditLogger` | middleware/auditLogger.ts | Admin routes in app.ts |
| `trackApiError` | services/healthMonitor.ts | middleware/apiErrorTracker.ts |
| `api` (Axios instance) | services/api.ts | All frontend Model classes |
| `useAppStore` | store/index.ts | All frontend pages and components |
| `getApiBaseUrl` | config/app.ts | services/api.ts |

### What Core Wiring Depends On

| Dependency | Purpose |
|-----------|---------|
| **Express 4.19** | HTTP server, middleware chain, routing |
| **mysql2/promise** | MySQL connection pool |
| **jsonwebtoken** | JWT sign/verify |
| **Zod** | Environment variable validation |
| **Socket.IO 4.8** | Real-time chat (staff + team) |
| **PM2** | Process management, restart tracking |
| **React Router DOM 6** | Frontend route definitions |
| **Zustand** | Frontend global state management |
| **Axios** | Frontend HTTP client |

---

## 9. Related Documentation

| Document | Purpose |
|----------|---------|
| [CODEBASE_MAP.md](../CODEBASE_MAP.md) | Full platform architecture and module map |
| [Authentication/README.md](../Authentication/README.md) | JWT auth, 2FA, PIN login |
| [Crosscutting/Infrastructure/README.md](../Crosscutting/Infrastructure/README.md) | Legacy infrastructure overview (v1.0.0) |
| [Crosscutting/Frontend/README.md](../Crosscutting/Frontend/README.md) | Frontend shared components, hooks, models |
| [Wiring/SQLITE_VEC_ARCHITECTURE.md](SQLITE_VEC_ARCHITECTURE.md) | Vector store deep-dive |
| [Wiring/KNOWLEDGE_BASE_EDITING.md](KNOWLEDGE_BASE_EDITING.md) | Knowledge base management |
| [Wiring/FILES.md](FILES.md) | File inventory for all core wiring files |
| [Wiring/PATTERNS.md](PATTERNS.md) | Architecture patterns in the core wiring |
| [Wiring/CHANGES.md](CHANGES.md) | Version history and known issues |
