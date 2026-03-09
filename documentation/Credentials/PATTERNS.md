# Credentials Module — Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

This document catalogs the **architectural patterns** and **anti-patterns** found in the Credentials module, covering:

- Credential storage and retrieval
- Encryption utilities
- Service consumption (smsService)
- Admin CRUD and frontend
- Access control

---

## 2. Architectural Patterns

### Pattern 1: Centralised Credential Vault

**Context:**  
Instead of scattering API keys across `.env` variables, services can store and retrieve credentials from a single `credentials` table with UI management.

**Implementation:**

```typescript
// smsService.ts — consumer reads at runtime
const row = await db.queryOne<any>(
  `SELECT credential_value, additional_data
     FROM credentials
    WHERE service_name = ? AND is_active = 1 LIMIT 1`,
  ['SMS'],
);
const clientId = row.credential_value;
const secret = row.additional_data?.secret;
```

**Benefits:**
- ✅ Credentials managed via admin UI (no server restarts for key rotation)
- ✅ Audit trail (`created_by`, `updated_by`, `last_used_at`)
- ✅ Expiry tracking with monitoring endpoints
- ✅ Environment scoping (`production`, `staging`, `all`)
- ✅ Soft-delete via `is_active` flag

**Drawbacks:**
- ❌ Database dependency at startup (if DB is down, credential retrieval fails)
- ❌ No caching layer — each service call hits the DB
- ❌ `service_name` is not unique, so multiple rows could match

---

### Pattern 2: AES-256-GCM Encryption with Composite Format

**Context:**  
The `cryptoUtils.ts` module provides authenticated encryption with a fixed-format output.

**Implementation:**

```typescript
// cryptoUtils.ts
const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex');

export function encryptPassword(text: string): string | null {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptPassword(hash: string): string | null {
  const [ivHex, authTagHex, cipherHex] = hash.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY,
    Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**Format:** `{iv_hex}:{authTag_hex}:{ciphertext_hex}`

**Benefits:**
- ✅ Authenticated encryption (tamper detection via GCM auth tag)
- ✅ Random IV per encryption (identical inputs produce different outputs)
- ✅ Self-contained — IV and auth tag stored alongside ciphertext
- ✅ Graceful error handling (returns `null` on failure)

**Drawbacks:**
- ❌ Single master key — if compromised, all secrets are exposed
- ❌ No key rotation mechanism for the master key itself
- ❌ `MASTER_KEY` falls back to `Buffer.alloc(32)` (all zeros) if env var is missing — insecure default in development

---

### Pattern 3: Auto-Detection of Encrypted vs Plaintext Values

**Context:**  
The smsService must handle both encrypted and plaintext `credential_value` entries because the CRUD routes don't auto-encrypt on write.

**Implementation:**

```typescript
// smsService.ts — getCredentials()
let raw: string = row.credential_value;

// Detect AES-256-GCM format: 3 colon-separated hex parts, each ≥ 16 chars
const parts = raw.split(':');
if (parts.length === 3 && parts.every(p => /^[0-9a-f]{16,}$/i.test(p))) {
  raw = decryptPassword(raw) ?? '';
}
```

**Benefits:**
- ✅ Backward-compatible — works with existing plaintext values
- ✅ Future-proof — will automatically decrypt if values are later encrypted
- ✅ No schema changes needed

**Drawbacks:**
- ❌ Every consumer must implement this detection logic
- ❌ Edge case: a plaintext value that happens to match the hex pattern would be wrongly decrypted

---

### Pattern 4: Value Masking at the API Layer

**Context:**  
The list/get endpoints mask sensitive values by default to prevent accidental leakage in logs or UI.

**Implementation:**

```typescript
// systemCredentials.ts — GET /credentials
const result = creds.map((c: any) => {
  if (!decrypt) {
    return {
      ...c,
      credential_value: c.credential_value ? '••••••••' : null,
      additional_data: c.additional_data ? '(encrypted)' : null,
    };
  }
  return c;
});
```

**Benefits:**
- ✅ Safe default — values never leak unless explicitly requested
- ✅ Simple toggle via `?decrypt=true` query parameter

**Drawbacks:**
- ❌ `?decrypt=true` is not additionally auth-gated (any authenticated user can decrypt)
- ❌ Masking happens in the route, not in a shared middleware

---

### Pattern 5: Multi-Layout Credential Consumption (smsService)

**Context:**  
The smsService supports two credential layouts to accommodate different storage conventions:

1. **Single value**: `credential_value = "clientId:secret"` (colon-delimited pair)
2. **Split storage**: `credential_value = clientId`, `additional_data.secret = secret`

**Implementation:**

```typescript
// Layout 1: colon-delimited pair
if (raw.includes(':')) {
  const [clientId, ...rest] = raw.split(':');
  return { clientId, secret: rest.join(':') };
}

// Layout 2: split across columns
const extra = typeof row.additional_data === 'string'
  ? JSON.parse(row.additional_data)
  : row.additional_data;
const secret = extra?.secret;
```

**Benefits:**
- ✅ Flexible — no rigid format requirements
- ✅ Clear error message if neither layout matches

**Drawbacks:**
- ❌ Implicit contract — not documented in the database schema
- ❌ Other services consuming different credential types would need their own layout logic

---

### Pattern 6: Token Caching with Auto-Retry (smsService)

**Context:**  
The SMSPortal auth token is valid for 24 hours. The service caches it in-memory for 23 hours and auto-retries on 401.

**Implementation:**

```typescript
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;  // Cache hit
  }
  // Fetch fresh token from SMSPortal /Authentication endpoint
  cachedToken = token;
  tokenExpiresAt = Date.now() + (23 * 60 * 60 * 1000);
  return token;
}

// In sendBulkSms — auto-retry on 401:
catch (err) {
  if (err.response?.status === 401) {
    invalidateToken();
    const freshToken = await getAuthToken();
    // Retry with fresh token
  }
}
```

**Benefits:**
- ✅ Avoids unnecessary token fetches (per SMSPortal best practices)
- ✅ Graceful recovery from expired tokens
- ✅ 1-hour safety margin before actual expiry

**Drawbacks:**
- ❌ In-memory cache — lost on server restart (harmless, just re-fetches)
- ❌ Single retry — if the retry also fails, the error propagates

---

## 3. Anti-Patterns Found

### Anti-Pattern 1: No Encryption on Write 🔴

**Severity:** 🔴 CRITICAL  
**Status:** 🔴 Open  
**File:Line:** [systemCredentials.ts](../../opt/backend/src/routes/systemCredentials.ts#L103-L120)

**Problem:**  
The `POST /credentials` and `PUT /credentials/:id` routes store `credential_value` as plaintext. The `encryptPassword()` function exists in `cryptoUtils.ts` but is **never called** by the CRUD routes.

**Current Code:**

```typescript
// POST /credentials — stores as-is
const id = await db.insertOne('credentials', {
  credential_value,  // ← plaintext!
  additional_data: additional_data ? JSON.stringify(additional_data) : null,
  // ...
});
```

**Impact:**
- 🔴 All credentials stored in plaintext in the database
- 🔴 Database dump / SQL injection exposes all secrets
- 🔴 Contradicts the frontend's claim: "Credentials are automatically encrypted using AES-256 before storage"

**Recommended Fix:**

```typescript
import { encryptPassword } from '../utils/cryptoUtils.js';

// POST /credentials
const encryptedValue = encryptPassword(credential_value);
const id = await db.insertOne('credentials', {
  credential_value: encryptedValue,
  // ...
});

// GET /credentials/:id?decrypt=true
import { decryptPassword } from '../utils/cryptoUtils.js';
if (decrypt) {
  cred.credential_value = decryptPassword(cred.credential_value);
}
```

**Effort:** 🟢 LOW (2-3 hours) — but requires migrating existing plaintext values.

---

### Anti-Pattern 2: No Admin Middleware on API Routes 🟡

**Severity:** 🟡 MEDIUM  
**Status:** 🟡 Open  
**File:Line:** [systemCredentials.ts](../../opt/backend/src/routes/systemCredentials.ts#L14-L16)

**Problem:**  
All credential endpoints use `requireAuth` (any authenticated user) instead of `requireAdmin`. The admin restriction only exists in the frontend (`<AdminRoute>`), which is trivially bypassed by calling the API directly.

**Current Code:**

```typescript
credentialsRouter.get('/', requireAuth, async (req, res, next) => {
  // Any authenticated user can list all credentials
});
```

**Impact:**
- 🟡 Any authenticated user can list/view/create/delete credentials via API
- 🟡 The `?decrypt=true` parameter exposes all secrets to non-admin users

**Recommended Fix:**

```typescript
import { requireAdmin } from '../middleware/auth.js';

// Apply to ALL credential routes
credentialsRouter.use(requireAuth, requireAdmin);
```

**Effort:** 🟢 LOW (15 minutes)

---

### Anti-Pattern 3: Frontend/Backend Endpoint Mismatch 🟡

**Severity:** 🟡 MEDIUM  
**Status:** 🟡 Open  
**Files:** [CredentialModel.ts](../../opt/frontend/src/models/CredentialModel.ts#L74-L85)

**Problem:**  
The frontend `CredentialModel` calls two endpoints that don't exist in the backend:

| Frontend Method | Calls | Backend Status |
|----------------|-------|----------------|
| `getByService(serviceName)` | `GET /credentials/service/:serviceName` | ❌ Not implemented |
| `search(query)` | `GET /credentials/search?q=...` | ❌ Not implemented |

**Impact:**
- 🟡 `search()` is called by `Credentials.tsx` → will throw 404/500
- 🟡 `getByService()` is available but unused in current UI

**Recommended Fix (Backend):**

```typescript
// GET /credentials/search
credentialsRouter.get('/search', requireAuth, async (req, res, next) => {
  const q = req.query.q as string;
  const creds = await db.query(
    `SELECT * FROM credentials
     WHERE service_name LIKE ? OR identifier LIKE ? OR notes LIKE ?
     ORDER BY service_name`,
    [`%${q}%`, `%${q}%`, `%${q}%`]
  );
  res.json({ success: true, data: creds });
});

// GET /credentials/service/:serviceName
credentialsRouter.get('/service/:serviceName', requireAuth, async (req, res, next) => {
  const cred = await db.queryOne(
    'SELECT * FROM credentials WHERE service_name = ? AND is_active = 1 LIMIT 1',
    [req.params.serviceName]
  );
  if (!cred) throw notFound('Credential not found');
  res.json({ success: true, data: cred });
});
```

**Effort:** 🟢 LOW (1 hour)

---

### Anti-Pattern 4: Rotate Endpoint Field Name Mismatch 🟢

**Severity:** 🟢 LOW  
**Status:** 🟢 Open  
**Files:** [systemCredentials.ts](../../opt/backend/src/routes/systemCredentials.ts#L206), [CredentialModel.ts](../../opt/frontend/src/models/CredentialModel.ts#L141)

**Problem:**  
The backend expects `req.body.new_value` but the frontend sends `{ new_credential_value: ... }`.

**Backend:**
```typescript
const { new_value } = req.body;
```

**Frontend:**
```typescript
static async rotate(id: number, newCredentialValue: string): Promise<Credential> {
  const response = await api.post(`${this.endpoint}/${id}/rotate`, {
    new_credential_value: newCredentialValue  // ← mismatched key
  });
}
```

**Impact:**
- 🟢 Rotate endpoint will always respond with "Provide new_value to complete rotation" because it reads the wrong key

**Recommended Fix:** Align on one field name (either `new_value` or `new_credential_value`).

**Effort:** 🟢 LOW (5 minutes)

---

### Anti-Pattern 5: No Credential Caching for Service Consumers 🟡

**Severity:** 🟡 MEDIUM  
**Status:** 🟡 Open  
**File:Line:** [smsService.ts](../../opt/backend/src/services/smsService.ts#L87-L98)

**Problem:**  
Every SMS send triggers a `SELECT` on the `credentials` table. For high-throughput services, this adds unnecessary database load.

**Impact:**
- 🟡 Extra DB query per SMS send (mitigated by token caching — credential fetch only happens every 23 h)
- 🟡 Would be more impactful for services without token caching

**Recommended Fix:**

```typescript
let cachedCredentials: SmsCredentials | null = null;
let credentialsCacheExpiry = 0;
const CRED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCredentials(): Promise<SmsCredentials> {
  if (cachedCredentials && Date.now() < credentialsCacheExpiry) {
    return cachedCredentials;
  }
  // ... fetch from DB ...
  cachedCredentials = { clientId, secret };
  credentialsCacheExpiry = Date.now() + CRED_CACHE_TTL;
  return cachedCredentials;
}
```

**Effort:** 🟢 LOW (30 minutes)

---

## 4. Summary

| Pattern | Type | Status | Priority |
|---------|------|--------|----------|
| Centralised Credential Vault | ✅ Good | Implemented | — |
| AES-256-GCM Encryption Utility | ✅ Good | Implemented | — |
| Auto-Detection of Encrypted Values | ✅ Good | Implemented | — |
| Value Masking at API Layer | ✅ Good | Implemented | — |
| Multi-Layout Credential Consumption | ✅ Good | Implemented | — |
| Token Caching with Auto-Retry | ✅ Good | Implemented | — |
| No Encryption on Write (Anti) | 🔴 Anti | Fix Needed | CRITICAL |
| No Admin Middleware on Routes (Anti) | 🟡 Anti | Fix Needed | MEDIUM |
| Frontend/Backend Endpoint Mismatch (Anti) | 🟡 Anti | Fix Needed | MEDIUM |
| Rotate Field Name Mismatch (Anti) | 🟢 Anti | Fix Needed | LOW |
| No Credential Caching (Anti) | 🟡 Anti | Improvement | MEDIUM |

---

*This document is maintained alongside code changes. Update patterns as the codebase evolves.*
