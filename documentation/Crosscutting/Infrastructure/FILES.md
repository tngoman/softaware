# Crosscutting / Infrastructure Module - File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 12 |
| **Total LOC** | 1,683 |
| **Backend files** | 12 |
| **Frontend files** | 0 (infrastructure is backend-only) |

### Directory Tree

```
src/
├── config/
│   ├── env.ts               (105 LOC)
│   └── credits.ts           (171 LOC)
├── db/
│   └── mysql.ts             (373 LOC)
├── middleware/
│   ├── auth.ts              (45 LOC)
│   ├── apiKey.ts            (56 LOC)
│   ├── credits.ts           (196 LOC)
│   ├── errorHandler.ts      (12 LOC)
│   ├── requireAdmin.ts      (50 LOC)
│   ├── statusCheck.ts       (175 LOC)
│   ├── team.ts              (131 LOC)
│   └── usageTracking.ts     (344 LOC)
└── utils/
    └── httpErrors.ts        (26 LOC)
```

---

## 2. Backend Files

### 2.1 `src/config/env.ts` — Environment Configuration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/config/env.ts` |
| **LOC** | 105 |
| **Purpose** | Zod-validated environment variable schema with typed defaults |
| **Dependencies** | `dotenv/config`, `zod` |
| **Exports** | `env` (parsed & validated environment object) |

#### Methods / Exports

| Export | Type | Description |
|--------|------|-------------|
| `env` | `z.infer<typeof EnvSchema>` | Validated environment object — crashes on startup if required vars missing |

#### Key Configuration Groups

| Group | Variables | Purpose |
|-------|-----------|---------|
| Core | PORT, NODE_ENV, CORS_ORIGIN, JWT_SECRET, JWT_EXPIRES_IN, DATABASE_URL | Server basics |
| SMTP | SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM | Email sending |
| AI Providers | OLLAMA_*, GLM*, OPENROUTER_*, OPENAI*, AWS_* | LLM configuration |
| Firebase | FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY | Push notifications |
| MCP | MCP_ENABLED, CODE_AGENT_WORKSPACE, CODE_AGENT_ENABLED | MCP server |
| Forex | EXCHANGE_RATE_API_KEY, ZAR_THRESHOLD_* | Currency alerts |
| 2FA | TWO_FACTOR_APP_NAME | OTP configuration |

#### Code Excerpt

```typescript
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.string().default('development'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1h'),
  DATABASE_URL: z.string().min(1),
  // ... 90+ more variables with Zod validation
});

export const env = EnvSchema.parse(process.env);
```

---

### 2.2 `src/config/credits.ts` — Credit Pricing Configuration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/config/credits.ts` |
| **LOC** | 171 |
| **Purpose** | Defines request types, pricing tiers, credit packages, and conversion helpers |
| **Dependencies** | None |
| **Exports** | `REQUEST_TYPES`, `REQUEST_PRICING`, `calculateCreditCost`, `CREDIT_PACKAGES`, `creditsToZAR`, `zarToCredits` |

#### Methods / Exports

| Export | Type | Description |
|--------|------|-------------|
| `REQUEST_TYPES` | `readonly string[]` | `['TEXT_CHAT', 'TEXT_SIMPLE', 'AI_BROKER', 'CODE_AGENT_EXECUTE', 'FILE_OPERATION', 'MCP_TOOL']` |
| `RequestType` | Type alias | Union of REQUEST_TYPES values |
| `REQUEST_PRICING` | `Record<RequestType, RequestPricing>` | Base cost and per-token rates per request type |
| `calculateCreditCost(type, metadata)` | `(RequestType, {tokens?, complexityMultiplier?}) → number` | Calculates total cost with token + multiplier |
| `CREDIT_PACKAGES` | Array of 5 packages | Starter (R10) → Enterprise (R750) with volume discounts |
| `LOW_BALANCE_THRESHOLDS` | Object | WARNING: 5000, CRITICAL: 1000, EMPTY: 0 |
| `SIGNUP_BONUS_CREDITS` | `100` | R1.00 free credit on sign-up |
| `REFERRAL_BONUS_CREDITS` | `500` | R5.00 for referrals |
| `creditsToZAR(credits)` | `(number) → string` | Format credits as `R0.00` |
| `zarToCredits(rand)` | `(number) → number` | Convert ZAR to credits (×100) |

#### Pricing Table

| Request Type | Base Cost | Per Token | Notes |
|-------------|-----------|-----------|-------|
| TEXT_CHAT | 10 (R0.10) | 0.01/token | Complex AI conversations |
| TEXT_SIMPLE | 5 (R0.05) | 0.005/token | Simple text requests |
| AI_BROKER | 1 (R0.01) | — | Proxy to external providers |
| CODE_AGENT_EXECUTE | 20 (R0.20) | 0.02/token | Highest cost — code execution |
| FILE_OPERATION | 1 (R0.01) | — | Utility operations |
| MCP_TOOL | 5 (R0.05) | multiplier | Adjustable by tool complexity |

---

### 2.3 `src/db/mysql.ts` — Database Layer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/mysql.ts` |
| **LOC** | 373 |
| **Purpose** | MySQL connection pool, query helpers, UUID generation, entity type definitions |
| **Dependencies** | `mysql2/promise`, `crypto`, `config/env.ts` |
| **Exports** | `pool`, `db`, `generateId`, `toMySQLDate`, `fromMySQLDate`, entity interfaces |

#### Methods

| Method | Signature | Returns | Description | DB Queries |
|--------|-----------|---------|-------------|-----------|
| `db.query<T>` | `(sql, params?) → Promise<T[]>` | Array of rows | Execute SELECT, return all rows | Any SQL |
| `db.queryOne<T>` | `(sql, params?) → Promise<T \| null>` | Single row or null | Execute SELECT, return first row | Any SQL |
| `db.insert` | `(sql, params?) → Promise<string>` | Insert ID as string | Execute INSERT, return insertId | INSERT |
| `db.insertOne` | `(table, data) → Promise<string>` | Insert ID as string | Build INSERT from object keys/values | INSERT |
| `db.execute` | `(sql, params?) → Promise<number>` | Affected rows count | Execute UPDATE/DELETE | UPDATE/DELETE |
| `db.transaction<T>` | `(callback) → Promise<T>` | Callback result | BEGIN → callback → COMMIT (or ROLLBACK) | Transaction |
| `db.ping` | `() → Promise<boolean>` | true/false | Health check via SELECT 1 | SELECT 1 |
| `db.close` | `() → Promise<void>` | void | Close all pool connections | — |
| `generateId` | `() → string` | UUID v4 | `crypto.randomUUID()` | — |
| `toMySQLDate` | `(Date) → string` | `'YYYY-MM-DD HH:mm:ss'` | JS Date → MySQL datetime | — |
| `fromMySQLDate` | `(string\|Date) → Date` | Date object | MySQL datetime → JS Date | — |

#### Connection Pool Config

```typescript
export const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});
```

#### Entity Types Defined

| Interface | Key Fields | Used By |
|-----------|-----------|---------|
| `User` | id, email, name, passwordHash, createdAt | auth, users, profile |
| `Team` | id, name, createdByUserId | teams |
| `team_members` | id, teamId, userId, role (ADMIN/STAFF/ARCHITECT/OPERATOR/AUDITOR) | middleware/team.ts |
| `team_invites` | id, teamId, email, role, acceptedAt | teams |
| `Agent` | id, teamId, name, version, region, compliance, blueprint | agents |
| `vault_credentials` | id, teamId, name, kind, description, revokedAt | vault |
| `activation_keys` | id, code, tier, isActive, maxAgents, maxUsers | activation |
| `device_activations` | id, deviceId, appVersion, isActive, tier | admin |
| `client_agents` | id, deviceId, agentId, name, version | admin |
| `api_keys` | id, name, key, userId, isActive, expiresAt | apiKeys |
| `credit_balances` | id, teamId, balance, totalPurchased, totalUsed | credits |
| `credit_transactions` | id, creditBalanceId, type, amount, balanceAfter | credits |
| `credit_packages` | id, name, credits, price, bonusCredits | credits |
| `ai_model_config` | id, teamId, defaultTextProvider, visionProvider | aiConfig |
| `subscription_plans` | id, tier, name, priceMonthly, maxUsers, maxDevices | subscription |
| `Subscription` | id, teamId, planId, status, billingCycle | subscription |
| `Invoice` | id, subscriptionId, invoiceNumber, total, paidAt | invoices |
| `Payment` | id, invoiceId, amount, status, provider | payments |

---

### 2.4 `src/middleware/auth.ts` — JWT Authentication

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/auth.ts` |
| **LOC** | 45 |
| **Purpose** | JWT token verification middleware and token signing |
| **Dependencies** | `jsonwebtoken`, `config/env.ts`, `utils/httpErrors.ts` |
| **Exports** | `AuthUser`, `AuthRequest`, `signAccessToken`, `requireAuth`, `getAuth` |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `signAccessToken` | `(payload: AuthUser, expiresIn?: string) → string` | JWT string | Signs a JWT with userId, uses env.JWT_SECRET |
| `requireAuth` | Express middleware | void | Verifies Bearer token, sets req.userId and req.auth |
| `getAuth` | `(req: Request) → AuthUser` | `{ userId }` | Extracts auth from request, throws 401 if missing |

#### Code

```typescript
export function requireAuth(req, _res, next) {
  const auth = req.header('authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    return next(unauthorized('Missing Authorization header'));
  }
  const token = auth.slice('bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    (req as AuthRequest).auth = { userId: String(decoded.userId) };
    (req as AuthRequest).userId = String(decoded.userId);
    return next();
  } catch {
    return next(unauthorized('Invalid token'));
  }
}
```

---

### 2.5 `src/middleware/apiKey.ts` — API Key Authentication

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/apiKey.ts` |
| **LOC** | 56 |
| **Purpose** | X-API-Key header validation for external integrations |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `ApiKeyRequest`, `requireApiKey` |

#### Methods

| Method | Signature | Description | DB Queries |
|--------|-----------|-------------|-----------|
| `requireApiKey` | Express middleware | Validates X-API-Key header, checks active/expired, updates lastUsedAt | `SELECT FROM api_keys JOIN users`, `UPDATE api_keys SET lastUsedAt` |

#### Validation Chain

1. Check `X-API-Key` header exists → 401 if missing
2. Lookup key in `api_keys` table (JOIN users for email) → 401 if not found
3. Check `isActive` flag → 403 if inactive
4. Check `expiresAt` → 403 if expired
5. Update `lastUsedAt` timestamp
6. Attach `{ id, userId, name }` to `req.apiKey`

---

### 2.6 `src/middleware/credits.ts` — Credit Deduction

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/credits.ts` |
| **LOC** | 196 |
| **Purpose** | Pre-check credit balance and post-response credit deduction |
| **Dependencies** | `config/credits.ts`, `services/credits.ts` |
| **Exports** | `deductCreditsMiddleware`, `requireCredits`, `withCreditDeduction` |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `deductCreditsMiddleware(requestType)` | `(RequestType) → Express middleware` | Wraps `res.json()` and `res.send()` to deduct credits after 2xx response |
| `requireCredits(requestType, estimatedCost?)` | `(RequestType, number?) → Express middleware` | Pre-checks balance; returns 402 if empty |
| `withCreditDeduction(requestType)` | `(RequestType) → [requireCredits, deductCredits]` | Combined array: check + deduct |

#### Response Headers Set

| Header | Value | When |
|--------|-------|------|
| `X-Credit-Deducted` | `true` | After successful deduction |
| `X-Credit-Balance` | Formatted string | On pre-check |
| `X-Credit-Balance-Raw` | Number string | On pre-check |
| `X-Credit-Low-Balance` | `true` | Balance < 1000 credits (R10) |

---

### 2.7 `src/middleware/errorHandler.ts` — Global Error Handler

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/errorHandler.ts` |
| **LOC** | 12 |
| **Purpose** | Final Express error handler — converts errors to JSON responses |
| **Dependencies** | `utils/httpErrors.ts` |
| **Exports** | `errorHandler` |

#### Code

```typescript
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
}
```

---

### 2.8 `src/middleware/requireAdmin.ts` — Admin Role Guard

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/requireAdmin.ts` |
| **LOC** | 50 |
| **Purpose** | Ensures authenticated user has ADMIN role in at least one team |
| **Dependencies** | `middleware/auth.ts`, `db/mysql.ts` |
| **Exports** | `requireAdmin` |

#### DB Query

```sql
SELECT * FROM team_members WHERE userId = ? AND role = 'ADMIN' LIMIT 1
```

---

### 2.9 `src/middleware/statusCheck.ts` — Account/Resource Status

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/statusCheck.ts` |
| **LOC** | 175 |
| **Purpose** | 3-level status hierarchy — blocks suspended/expired accounts, assistants, widgets |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `checkAccountStatus`, `checkAssistantStatus`, `checkWidgetStatus` |

#### Methods

| Method | Level | DB Query | Blocks When |
|--------|-------|----------|-------------|
| `checkAccountStatus` | Account | `SELECT account_status FROM users WHERE id = ?` | account_status ≠ 'active' |
| `checkAssistantStatus` | Assistant + Account | `SELECT a.status, u.account_status FROM assistants a LEFT JOIN users u ON u.id = a.userId WHERE a.id = ?` | Either suspended/expired |
| `checkWidgetStatus` | Widget + Account | `SELECT wc.status, u.account_status FROM widget_clients wc LEFT JOIN users u ON u.id = wc.user_id WHERE wc.id = ?` | Either suspended/expired |

#### Status Responses

| Status | HTTP | Error Code | Message |
|--------|------|-----------|---------|
| `suspended` | 403 | `ACCOUNT_SUSPENDED` | "This account has been suspended…" |
| `demo_expired` | 403 | `DEMO_EXPIRED` | "Demo period has ended…" |

**Policy:** Fail open — DB errors in status checks don't block requests.

---

### 2.10 `src/middleware/team.ts` — Team Resolution

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/team.ts` |
| **LOC** | 131 |
| **Purpose** | Resolves user's team membership and attaches teamId to request |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `TeamRequest`, `requireTeam`, `validateTeamMembership`, `requireTeamAdmin` |
| **Status** | ⚠️ **DEAD CODE** — Not imported by any route file. Legacy artifact from pre-v1.1.0 architecture. Can be safely removed. |

#### Methods

| Method | Description | DB Query |
|--------|-------------|----------|
| `requireTeam` | Sets req.teamId from user's first team_members row | `SELECT * FROM team_members WHERE userId = ? LIMIT 1` |
| `validateTeamMembership` | Validates user is member of specific team (from params/body) | `SELECT * FROM team_members WHERE teamId = ? AND userId = ?` |
| `requireTeamAdmin` | Validates user is ADMIN of the team | Same as above + role check |

---

### 2.11 `src/middleware/usageTracking.ts` — Usage Limits

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/usageTracking.ts` |
| **LOC** | 344 |
| **Purpose** | Enforces per-tier monthly message limits for widget chat |
| **Dependencies** | `db/mysql.ts` |
| **Exports** | `trackUsage`, `checkUsageLimit` |

#### Tier Limits

| Tier | Max Messages/Month |
|------|-------------------|
| Free | 500 |
| Starter | 5,000 |
| Advanced | 15,000 |
| Enterprise | Unlimited |

#### Key Functions

| Function | Description |
|----------|-------------|
| `getTierLimits(tier)` | Fetch limits from `subscription_tier_limits` table |
| `getCurrentBillingCycle()` | Calculate current month start/end dates |
| `ensureBillingCycle(clientId)` | Initialize/reset billing cycle on widget_clients |
| `trackUsage` | Middleware — increments `messages_this_cycle`, blocks if limit reached |

---

### 2.12 `src/utils/httpErrors.ts` — HTTP Error Classes

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/utils/httpErrors.ts` |
| **LOC** | 26 |
| **Purpose** | Typed HTTP error classes caught by errorHandler middleware |
| **Dependencies** | None |
| **Exports** | `HttpError`, `notFound`, `unauthorized`, `forbidden`, `badRequest` |

#### Factory Functions

| Function | Status | Code |
|----------|--------|------|
| `notFound(message?)` | 404 | `NOT_FOUND` |
| `unauthorized(message?)` | 401 | `UNAUTHORIZED` |
| `forbidden(message?)` | 403 | `FORBIDDEN` |
| `badRequest(message?)` | 400 | `BAD_REQUEST` |

#### Code

```typescript
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}
```

---

## 3. Frontend Files

*No frontend files — Infrastructure is backend-only. See [Crosscutting/Frontend](../Frontend/FILES.md) for frontend infrastructure.*
