# API Keys Module — Source Files

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. File Inventory

| # | File | LOC | Purpose |
|---|------|-----|---------|
| 1 | `src/routes/apiKeys.ts` | 120 | CRUD endpoints for user-owned API keys |
| 2 | `src/middleware/apiKey.ts` | ~60 | `requireApiKey` — validates key on every protected request |
| 3 | `src/db/mysql.ts` | — | `api_keys` type export, `generateId()`, `toMySQLDate()` |

**Total module-specific LOC:** ~180

---

## 2. Detailed File Descriptions

### 2.1 `src/routes/apiKeys.ts`

**Lines:** 120  
**Mount:** `/api/api-keys`  
**Auth:** All routes guarded by `requireAuth` (JWT)

**Exports:**
```typescript
export const apiKeysRouter: Router;
```

**Endpoints:**

| Method | Path | Handler summary |
|--------|------|-----------------|
| GET | `/` | Query `api_keys WHERE userId = ?`, mask key to `****<last8>` |
| POST | `/` | Validate with Zod, `crypto.randomBytes(32)`, INSERT, return full key once |
| DELETE | `/:id` | Verify ownership, hard DELETE |
| PATCH | `/:id/toggle` | Verify ownership, flip `isActive` |

**Key code — key generation:**

```typescript
import crypto from 'crypto';

const apiKey = crypto.randomBytes(32).toString('hex');
const keyId = generateId();
const now = toMySQLDate(new Date());

const expiresAt = expiresInDays
  ? toMySQLDate(new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000))
  : null;

await db.execute(
  `INSERT INTO api_keys (id, name, \`key\`, userId, isActive, createdAt, expiresAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [keyId, name, apiKey, req.user!.id, true, now, expiresAt]
);
```

**Key code — masking:**

```typescript
const maskedKeys = apiKeys.map(key => ({
  ...key,
  key: `****${key.key.slice(-8)}`
}));
```

**Dependencies:**
- `express` Router
- `zod` — `createApiKeySchema`
- `crypto` — `randomBytes`
- `db` helpers — `query`, `queryOne`, `execute`, `generateId`, `toMySQLDate`
- `requireAuth` middleware

---

### 2.2 `src/middleware/apiKey.ts`

**Lines:** ~60  
**Purpose:** Express middleware that authenticates requests via API key

**Exports:**
```typescript
export function requireApiKey(req: Request, res: Response, next: NextFunction): void;
```

**Logic flow:**

1. Read key from `req.headers['x-api-key']` or `req.query.api_key`
2. `SELECT * FROM api_keys WHERE \`key\` = ?`
3. If not found → 401
4. If `isActive === false` → 403
5. If `expiresAt` is set and in the past → 403
6. Stamp `UPDATE api_keys SET lastUsedAt = NOW(3) WHERE id = ?`
7. Attach `req.apiKey = row` (includes `.userId`)
8. Call `next()`

**Used by:**
- `routes/ai.ts` — AI Gateway endpoints
- `routes/credits.ts` — Credit balance queries
- Any route that external clients call with `x-api-key`

---

### 2.3 `src/db/mysql.ts` (shared)

Provides the `api_keys` type and utility functions used by the module:

```typescript
export type api_keys = {
  id: string;
  name: string;
  key: string;
  userId: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
};

export function generateId(): string;      // UUID v4
export function toMySQLDate(d: Date): string; // 'YYYY-MM-DD HH:mm:ss.SSS'
```

---

## 3. File Dependency Graph

```
apiKeys.ts (routes)
  ├── middleware/auth.ts        → requireAuth
  ├── db/mysql.ts               → db, generateId, toMySQLDate, api_keys type
  ├── zod                       → createApiKeySchema
  └── crypto                    → randomBytes

apiKey.ts (middleware)
  ├── db/mysql.ts               → db, api_keys type
  └── (no other internal deps)
```

---

## 4. Frontend Files

| File | LOC | Purpose |
|------|-----|---------|
| `pages/general/AccountSettings.tsx` | — | Contains "API Keys" tab |
| `models/ApiKeyModel.ts` | — | Typed CRUD helpers (if separate) |
| `components/ApiKeyList.tsx` | — | Table of masked keys with actions |

> Frontend files are part of the broader AccountSettings page, not a standalone module.
