# Crosscutting / Infrastructure Module - Overview

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Module Overview

### Purpose

The Infrastructure module provides the shared foundation that every other SoftAware module depends on: database connectivity, authentication middleware, error handling, environment configuration, and request processing pipelines.

### Business Value

- Single source of truth for database access patterns
- Centralized authentication enforced before any route handler
- Consistent error response format across all 64 API endpoints
- Credit/billing enforcement at the middleware level
- Account suspension propagated to all sub-resources automatically

### Key Statistics

| Metric | Value |
|--------|-------|
| Source files | 12 |
| Total LOC | 1,683 |
| Middleware files | 8 (1,009 LOC) |
| Config files | 2 (277 LOC) |
| DB layer | 1 (373 LOC) |
| Error utilities | 1 (26 LOC) |
| Database tables used | teams, team_members, api_keys, sys_users, users, assistants, widget_clients |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       INCOMING REQUEST                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Express Built-in Middleware                                            │
│  ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────────────┐                  │
│  │ Helmet │ │ CORS │ │ Morgan │ │ express.json(10MB)│                  │
│  └────────┘ └──────┘ └────────┘ └──────────────────┘                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Custom Middleware Chain (per-route, composed in route files)            │
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐                              │
│  │ requireAuth  │───▶│ requireAdmin     │                              │
│  │ (auth.ts)    │    │ (requireAdmin.ts)│  Uses user_roles + roles     │
│  └──────────────┘    └──────────────────┘                              │
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────┐   │
│  │requireApiKey │    │ statusCheck.ts    │    │ usageTracking.ts   │   │
│  │ (apiKey.ts)  │    │ account/assistant │    │ tier-based limits  │   │
│  └──────────────┘    │ /widget status    │    └─────────────────────┘   │
│                      └──────────────────┘                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ credits.ts — deductCreditsMiddleware / requireCredits           │   │
│  │ Wraps res.json() to deduct credits after successful response    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Route Handler                                                          │
│  Uses db.query() / db.insert() / db.execute() / db.transaction()       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  mysql.ts — Connection Pool (mysql2/promise)                            │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ pool = mysql.createPool({                                    │      │
│  │   connectionLimit: 10, enableKeepAlive: true                │      │
│  │ })                                                           │      │
│  │                                                              │      │
│  │ db.query<T>()     → SELECT rows                             │      │
│  │ db.queryOne<T>()  → SELECT first row or null                │      │
│  │ db.insert()       → INSERT → returns insertId               │      │
│  │ db.insertOne()    → Build INSERT from object → insertId     │      │
│  │ db.execute()      → UPDATE/DELETE → returns affectedRows    │      │
│  │ db.transaction()  → BEGIN → callback → COMMIT/ROLLBACK      │      │
│  │ db.ping()         → SELECT 1 health check                   │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                         │
│  Utilities: generateId() (crypto.randomUUID), toMySQLDate, fromMySQLDate│
│  Types: User, Team, team_members, Agent, api_keys, activation_keys, etc│
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Error Handling                                                         │
│  ┌────────────────────────┐    ┌───────────────────────────────────┐   │
│  │ httpErrors.ts          │    │ errorHandler.ts                   │   │
│  │ HttpError(status,code) │    │ Catches thrown HttpError and      │   │
│  │ notFound()       404   │    │ unknown errors, returns JSON      │   │
│  │ unauthorized()   401   │    │ { error, message }               │   │
│  │ forbidden()      403   │    └───────────────────────────────────┘   │
│  │ badRequest()     400   │                                            │
│  └────────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Guide

### Adding a New Authenticated Route

```typescript
import { Router } from 'express';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { db } from '../db/mysql.js';

const router = Router();

// 1. Apply requireAuth to protect the route
router.get('/my-resource', requireAuth, async (req, res, next) => {
  try {
    // 2. Get authenticated user
    const { userId } = getAuth(req);

    // 3. Query database
    const items = await db.query('SELECT * FROM my_table WHERE userId = ?', [userId]);

    // 4. Return response
    res.json({ success: true, data: items });
  } catch (err) {
    next(err); // 5. Delegate to errorHandler
  }
});
```

### Adding a Permission-Protected Route

```typescript
import { requireAuth } from '../middleware/auth.js';
import { permissionMiddleware } from '../middleware/permissions.js';

router.get('/protected-resource', requireAuth, permissionMiddleware('resource.view'), async (req, res, next) => {
  const userId = req.userId!;
  const items = await db.query('SELECT * FROM resources WHERE active = 1');
  res.json({ success: true, data: items });
});
```

### Adding a Credit-Deducted Endpoint

```typescript
import { requireAuth } from '../middleware/auth.js';
import { withCreditDeduction } from '../middleware/credits.js';

// Combined middleware: check balance + deduct after success
router.post('/ai-request',
  requireAuth,
  ...withCreditDeduction('TEXT_CHAT'),
  async (req, res) => {
    // Credits are automatically deducted when res.json() is called
    res.json({ success: true, response: 'AI result here' });
  }
);
```

### Throwing Typed Errors

```typescript
import { notFound, badRequest, forbidden } from '../utils/httpErrors.js';

// These are caught by errorHandler middleware and returned as JSON
if (!record) throw notFound('Resource not found');
if (!valid) throw badRequest('Invalid input');
if (!allowed) throw forbidden('Not authorized');
```

---

## 4. Business Workflows

### Authentication Flow

```
Client                    requireAuth               Database
  │                          │                         │
  │── Bearer <jwt> ─────────▶│                         │
  │                          │── jwt.verify() ────────▶│
  │                          │                         │
  │                          │◀── { userId } ──────────│
  │                          │                         │
  │                          │── req.userId = userId   │
  │                          │── req.auth = { userId } │
  │◀── next() ──────────────│                         │
  │                          │                         │
```

### Credit Deduction Flow

```
Client          requireCredits      Handler         deductCredits
  │                  │                 │                 │
  │── request ──────▶│                 │                 │
  │                  │── check bal ───▶│                 │
  │                  │◀── balance ok ──│                 │
  │                  │── next() ──────▶│                 │
  │                  │                 │── process ─────▶│
  │                  │                 │── res.json() ──▶│
  │                  │                 │                 │── deduct async
  │◀── response ─────────────────────│                 │
  │ (X-Credit-Deducted: true)        │                 │
```

### Status Check Hierarchy

```
┌──────────────────────────────────────────────────────┐
│ 1. Account Level (sys_users.account_status)          │
│    ↓ If suspended → block ALL requests               │
│                                                      │
│ 2. Assistant Level (assistants.status)               │
│    ↓ If suspended → block assistant endpoints only   │
│                                                      │
│ 3. Widget Level (widget_clients.status)              │
│    ↓ If suspended → block widget endpoints only      │
│                                                      │
│ Statuses: active | suspended | demo_expired          │
│ Policy: "fail open" — DB errors don't block requests │
└──────────────────────────────────────────────────────┘
```

---

## 5. Key Features

| Feature | Implementation | File |
|---------|---------------|------|
| **JWT Auth** | HS256 signing, configurable expiry | middleware/auth.ts |
| **API Key Auth** | X-API-Key header, auto-tracks lastUsedAt | middleware/apiKey.ts |
| **Team Resolution** | Auto-attaches teamId from team_members | middleware/team.ts |
| **Admin Guard** | Checks ADMIN role in team_members | middleware/requireAdmin.ts |
| **Credit System** | Post-response deduction, pre-check balance, 402 on empty | middleware/credits.ts |
| **Usage Limits** | Per-tier monthly message limits (Free: 500, Enterprise: ∞) | middleware/usageTracking.ts |
| **Status Bouncer** | 3-level hierarchy (account → assistant → widget) | middleware/statusCheck.ts |
| **Connection Pool** | mysql2/promise, 10 connections, keepalive | db/mysql.ts |
| **Transaction Support** | BEGIN/COMMIT/ROLLBACK with auto-release | db/mysql.ts |
| **UUID Generation** | crypto.randomUUID() | db/mysql.ts |
| **Env Validation** | Zod schema, 100+ vars, typed defaults | config/env.ts |
| **Error Handling** | HttpError class with status/code, global handler | utils/httpErrors.ts + middleware/errorHandler.ts |

---

## 6. Integration Points

| Depends On | Purpose |
|-----------|---------|
| **MySQL** | All data persistence via mysql2/promise connection pool |
| **jsonwebtoken** | JWT signing and verification |
| **Zod** | Environment variable validation at startup |
| **bcryptjs** | Used by auth routes (not in middleware itself) |
| **dotenv** | Loaded by config/env.ts for .env parsing |

| Used By | How |
|---------|-----|
| **All 64 route files** | Import requireAuth, db, getAuth, HttpError helpers |
| **All service files** | Import db for database operations |
| **app.ts** | Mounts errorHandler as final middleware |
| **index.ts** | Imports env for PORT |

---

## 7. Security Model

### ✅ Strengths

| Feature | Detail |
|---------|--------|
| JWT validation | Token verified on every request, userId extracted server-side |
| Parameterized queries | All db.query() calls use `?` placeholders — no SQL injection |
| Fail-open status checks | DB errors in statusCheck don't block legitimate requests |
| Credit pre-check | 402 response before expensive operations |
| API key tracking | lastUsedAt updated on every use |

### 🔴 Security Considerations

| Issue | Severity | File | Detail |
|-------|----------|------|--------|
| CORS allows all origins | 🟡 WARNING | app.ts:L88 | `Access-Control-Allow-Origin: *` — acceptable for API but consider allowlisting in production |
| No rate limiting | 🟡 WARNING | — | No express-rate-limit middleware; brute force possible on /auth/login |
| Token in memory only | 🟡 WARNING | middleware/auth.ts | No token blacklist/revocation — stolen tokens valid until expiry |
| Admin check uses `user_roles` | ✅ OK | middleware/requireAdmin.ts | ADMIN role checked via `user_roles` + `roles` tables (v1.1.0 architecture) |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Missing Authorization header` (401) | No `Bearer <jwt>` header sent | Ensure frontend sends `Authorization: Bearer <token>` |
| `Invalid token` (401) | JWT expired or wrong secret | Check `JWT_EXPIRES_IN` env var; regenerate token |
| `Insufficient credits` (402) | Credit balance ≤ 0 | Top up credits via admin panel or purchase |
| `ACCOUNT_SUSPENDED` (403) | users.account_status = 'suspended' | Admin must reactivate the account |
| `DEMO_EXPIRED` (403) | users.account_status = 'demo_expired' | Upgrade subscription plan |
| Database connection timeout | Pool exhausted (10 connections) | Check for leaked connections; increase connectionLimit |
| `Invalid DATABASE_URL format` | Env var malformed | Format: `mysql://user:pass@host:port/db` |

---

## 9. Related Documentation

- [CODEBASE_MAP.md](../CODEBASE_MAP.md) — Platform architecture overview
- [Authentication](../Authentication/README.md) — Login, register, JWT, 2FA
- [Roles](../Roles/README.md) — RBAC roles and permissions
- [Subscription](../Subscription/README.md) — Credit system and billing tiers
- [Crosscutting/Services](../Crosscutting/Services/README.md) — Shared services (Firebase, PDF, email)
