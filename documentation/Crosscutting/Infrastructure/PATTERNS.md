# Crosscutting / Infrastructure Module - Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-02

---

## 1. Overview

This document catalogs the architecture patterns and anti-patterns found in the SoftAware Infrastructure module (middleware, database layer, configuration).

---

## 2. Architectural Patterns

### 2.1 Middleware Composition Pattern

**Context:** Express middleware functions are composed per-route to build custom auth/billing pipelines.

**Implementation:**

```typescript
// Route file composes middleware chain declaratively
router.post('/ai-request',
  requireAuth,           // 1. Verify JWT
  ...withCreditDeduction('TEXT_CHAT'),  // 2. Check + deduct credits
  async (req, res) => {
    // Handler only runs if all middleware passed
  }
);
```

**Benefits:**
- ✅ Each middleware has a single responsibility
- ✅ Easy to compose different auth/billing combinations per route
- ✅ Middleware is reusable across all 64 route files
- ✅ Order is explicit and visible in route definitions

**Drawbacks:**
- ❌ No compile-time check that middleware chain is correct
- ❌ Spread operator for withCreditDeduction returns array — must use `...`

---

### 2.2 Response Wrapping Pattern (Credit Deduction)

**Context:** Credits must be deducted only after a successful response (2xx), not on failures.

**Implementation:**

```typescript
// Override res.json() to intercept after handler completes
const originalJson = res.json.bind(res);
res.json = function (data: any) {
  if (!responseSent) {
    responseSent = true;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Deduct asynchronously — don't slow down response
      deductCredits(teamId, requestType, metadata).catch(console.error);
      res.setHeader('X-Credit-Deducted', 'true');
    }
    return originalJson(data);
  }
  return res;
};
```

**Benefits:**
- ✅ Credits only deducted on success — no charge for failed requests
- ✅ Async deduction doesn't block response delivery
- ✅ Can extract token usage from response data for accurate billing
- ✅ Response headers inform client of deduction

**Drawbacks:**
- ❌ Monkey-patching `res.json()` is fragile — could break with Express updates
- ❌ Must also wrap `res.send()` for non-JSON responses
- ❌ `responseSent` flag is mutable closure state — race conditions theoretically possible
- ❌ If deduction fails, credits are lost (no retry mechanism)

---

### 2.3 Database Helper Pattern (db Object)

**Context:** Raw mysql2 requires repetitive `pool.query()` calls and result destructuring.

**Implementation:**

```typescript
export const db = {
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  },
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  },
  async insert(sql: string, params?: any[]): Promise<string> {
    const [result] = await pool.query(sql, params);
    return String((result as any).insertId);
  },
  async insertOne(table: string, data: Record<string, any>): Promise<string> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return this.insert(sql, values);
  },
  async execute(sql: string, params?: any[]): Promise<number> {
    const [result] = await pool.query(sql, params);
    return (result as any).affectedRows;
  },
  async transaction<T>(callback: (conn) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },
};
```

**Benefits:**
- ✅ Eliminates repetitive `[rows] = await pool.query()` destructuring
- ✅ `queryOne` returns `T | null` instead of array — cleaner consumption
- ✅ `insertOne` auto-builds SQL from object — reduces boilerplate
- ✅ `transaction` handles BEGIN/COMMIT/ROLLBACK/release automatically
- ✅ Parameterized queries everywhere — no SQL injection

**Drawbacks:**
- ❌ `insertOne` interpolates table name directly — potential injection if table comes from user input (currently safe as all callers use string literals)
- ❌ TypeScript generics use `as T` casting — no runtime validation of shape
- ❌ No query logging/timing built in (Morgan logs HTTP, not SQL)

---

### 2.4 Fail-Open Status Check Pattern

**Context:** Status check middleware queries the database for account/resource suspension. If the DB is down, should users be blocked?

**Implementation:**

```typescript
export async function checkAccountStatus(req, res, next) {
  try {
    const userId = (req as any).userId;
    if (!userId) return next();  // No auth context — skip

    const user = await db.queryOne(
      'SELECT account_status FROM users WHERE id = ?', [userId]
    );
    if (!user) return next();  // User not found — skip
    if (user.account_status !== 'active') {
      blockResponse(res, user.account_status);
      return;
    }
    next();
  } catch (err) {
    console.error('[statusCheck] Account status check failed:', err);
    next(); // Fail open — don't block on DB errors
  }
}
```

**Benefits:**
- ✅ Transient DB errors don't cause total service outage
- ✅ Logged for debugging
- ✅ Correct for most SaaS scenarios — availability > enforcement

**Drawbacks:**
- ❌ Suspended users can access resources during DB outages
- ❌ No alerting mechanism for repeated failures

---

### 2.5 Zod Environment Validation Pattern

**Context:** Environment variables are stringly-typed and easy to misconfigure.

**Implementation:**

```typescript
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  DEFAULT_AI_PROVIDER: z.enum(['glm', 'ollama']).default('ollama'),
  // ...100+ more
});

export const env = EnvSchema.parse(process.env);  // Crashes on invalid
```

**Benefits:**
- ✅ Fails fast on startup if required vars are missing
- ✅ Type coercion (strings → numbers, booleans)
- ✅ Defaults for optional vars
- ✅ Exported object is fully typed

**Drawbacks:**
- ❌ All 100+ variables in a single schema — no modular decomposition
- ❌ Some defaults mask missing configuration (e.g., empty string defaults for API keys)

---

### 2.6 Dual-Mount API Pattern

**Context:** Frontend uses `/api/` prefix (via proxy), direct API calls use `/`. Both need to work.

**Implementation:**

```typescript
const apiRouter = express.Router();
// ... register all routes on apiRouter ...

// Mount at BOTH paths
app.use('/api', apiRouter);
app.use('/', apiRouter);
```

**Benefits:**
- ✅ Eliminates `/api` prefix mismatch between frontend proxy and direct calls
- ✅ Single router instance — no route duplication

**Drawbacks:**
- ❌ Every route effectively exists twice — could confuse logging/debugging
- ❌ No way to have different middleware for proxy vs direct access

---

## 3. Anti-Patterns Found

### 3.1 Type Assertions Instead of Runtime Validation

**Description:** Database query results are cast with `as T` without runtime shape validation.

**Current Code:**

```typescript
const user = await db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
// user is typed as User | null, but actual shape depends on query
```

**Impact:** 🟡 WARNING — If table schema changes or query uses different columns, TypeScript won't catch the mismatch.

**Recommended Fix:**

```typescript
// Use Zod to validate at runtime
const UserSchema = z.object({ id: z.string(), email: z.string(), ... });
const user = UserSchema.parse(await db.queryOne('SELECT * FROM users WHERE id = ?', [id]));
```

**Effort:** 🟡 MEDIUM — Would require adding Zod schemas for each entity type.

---

### 3.2 No Connection Release Guard in db.query

**Description:** Regular `db.query()` calls use the pool directly (auto-release), but if pool is exhausted, requests queue indefinitely.

**Current Code:**

```typescript
async query<T>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await pool.query(sql, params);  // Uses pool.query, not getConnection
  return rows as T[];
}
```

**Impact:** ✅ OK — `pool.query()` automatically gets and releases connections. Only `db.transaction()` uses `getConnection()` (with proper finally/release). However, `connectionLimit: 10` may be insufficient under load.

**Recommended Fix:** Add monitoring for pool queue depth; consider increasing connectionLimit or adding a timeout.

---

### 3.3 Dead Code: requireTeam Middleware

**Description:** `middleware/team.ts` exports `requireTeam`, `validateTeamMembership`, and `requireTeamAdmin` but **none are imported by any route file**. This is dead code from the pre-v1.1.0 architecture.

**Impact:** ✅ None — the middleware is not executed. Can be safely deleted.

**Recommended Fix:** Delete `middleware/team.ts` entirely.

**Effort:** 🟢 LOW — 15 min.

---

### 3.4 Credit Deduction Has No Retry Mechanism

**Description:** If async credit deduction fails, the request is already delivered but credits aren't charged.

**Current Code:**

```typescript
deductCredits(teamId, requestType, metadata).catch((error) => {
  console.error(`[Credits] Failed to deduct credits for team ${teamId}:`, error);
});
```

**Impact:** 🟡 WARNING — Revenue leakage on DB errors during deduction.

**Recommended Fix:** Write failed deductions to a retry queue (database table or in-memory queue with exponential backoff).

**Effort:** 🟡 MEDIUM

---

### 3.5 No Rate Limiting

**Description:** No `express-rate-limit` or similar middleware is applied to any endpoint.

**Impact:** 🔴 CRITICAL — Brute force on `/auth/login`, credential stuffing, and API abuse are unthrottled.

**Recommended Fix:**

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // 20 attempts per window
  standardHeaders: true,
});

apiRouter.use('/auth', authLimiter, authRouter);
```

**Effort:** 🟢 LOW — Single package install + 5 lines of config.
