# Crosscutting / Infrastructure Module - API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

The Infrastructure module does not define its own API endpoints. Instead, it provides **middleware** that is composed into routes defined by other modules.

| Metric | Value |
|--------|-------|
| **Own endpoints** | 0 |
| **Middleware exported** | 11 functions across 8 files |
| **Used by** | All 64 route files |

---

## 2. Middleware Exports (Used as Route Middleware)

These middleware functions are imported by route files and applied per-endpoint:

### Authentication Middleware

| Middleware | Import From | Purpose | Sets on req |
|-----------|-------------|---------|-------------|
| `requireAuth` | `middleware/auth.ts` | Verify JWT Bearer token | `req.userId`, `req.auth` |
| `requireApiKey` | `middleware/apiKey.ts` | Verify X-API-Key header | `req.apiKey` |

### Authorization Middleware

| Middleware | Import From | Purpose | Sets on req |
|-----------|-------------|---------|-------------|
| `requireTeam` | `middleware/team.ts` | Resolve user's team | `req.teamId` |
| `validateTeamMembership` | `middleware/team.ts` | Validate user belongs to specific team | `req.teamId` |
| `requireTeamAdmin` | `middleware/team.ts` | Validate user is ADMIN of team | `req.teamId` |
| `requireAdmin` | `middleware/requireAdmin.ts` | Validate user is ADMIN in any team | — |

### Enforcement Middleware

| Middleware | Import From | Purpose | Response Headers |
|-----------|-------------|---------|-----------------|
| `checkAccountStatus` | `middleware/statusCheck.ts` | Block suspended accounts | — |
| `checkAssistantStatus` | `middleware/statusCheck.ts` | Block suspended assistants | — |
| `checkWidgetStatus` | `middleware/statusCheck.ts` | Block suspended widgets | — |
| `deductCreditsMiddleware(type)` | `middleware/credits.ts` | Deduct credits post-response | `X-Credit-Deducted` |
| `requireCredits(type)` | `middleware/credits.ts` | Pre-check credit balance | `X-Credit-Balance`, `X-Credit-Low-Balance` |
| `withCreditDeduction(type)` | `middleware/credits.ts` | Combined check + deduct | Both sets of headers |
| `trackUsage` | `middleware/usageTracking.ts` | Enforce monthly message limits | — |

---

## 3. Global Middleware (Applied in app.ts)

These middleware are applied globally to all routes:

```typescript
// app.ts — applied to every request
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors_middleware);  // Access-Control-Allow-Origin: *
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Applied after all routes
app.use(errorHandler);     // Global error handler (middleware/errorHandler.ts)
```

---

## 4. Health Check Endpoint

The only endpoint registered in `app.ts` (not via a route file):

### `GET /healthz`

| Property | Value |
|----------|-------|
| **Method** | GET |
| **Path** | /healthz |
| **Auth** | None |
| **Purpose** | Health check for load balancers / monitoring |

**Response:**

```json
{
  "ok": true
}
```

**curl Example:**

```bash
curl http://localhost:8787/healthz
```

---

## 5. Common Middleware Patterns in Route Files

### Pattern A: Authenticated (JWT Required)

```typescript
router.get('/resource', requireAuth, handler);
```

Used by: contacts, invoices, quotations, accounting, dashboard, notifications, etc.

### Pattern B: Authenticated + Admin Only

```typescript
router.post('/admin-action', requireAuth, requireAdmin, handler);
```

Used by: systemUsers, systemRoles, adminDashboard, adminClientManager, etc.

### Pattern C: API Key Authentication

```typescript
router.post('/external', requireApiKey, handler);
```

Used by: sync, widgetChat, publicLeadAssistant, etc.

### Pattern D: With Credit Deduction

```typescript
router.post('/ai-endpoint', requireAuth, requireTeam, ...withCreditDeduction('TEXT_CHAT'), handler);
```

Used by: ai, codeWriter, glm, assistants, etc.

### Pattern E: Status Check + Authentication

```typescript
apiRouter.use('/assistants', checkAssistantStatus, assistantsRouter);
apiRouter.use('/v1', checkWidgetStatus, widgetChatRouter);
```

Used by: Mounted at the app.ts level for assistant and widget routes.
