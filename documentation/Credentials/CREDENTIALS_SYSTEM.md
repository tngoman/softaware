# Encrypted Credentials System

> **Last Updated:** 2026-03-04  
> **Status:** Active — 1 credential row (SMS) in production  

---

## 1. Overview

The Softaware platform has **two distinct credential systems**:

| System | Table | Purpose | Encryption | Scope |
|--------|-------|---------|------------|-------|
| **Service Credentials** | `credentials` | Store API keys, passwords, tokens for _platform-level_ integrations (SMS gateway, SMTP, Stripe, etc.) | AES-256-GCM via `cryptoUtils.ts` | Global / admin-managed |
| **Vault Credentials** | `vault_credentials` | Metadata-only records for _team-level_ credential grants (no secret storage) | None (metadata only) | Per-team / RBAC |

This document primarily covers the **Service Credentials** system (the `credentials` table), which is the encrypted credential store.

---

## 2. Database Schema

### 2.1 `credentials` Table

```sql
CREATE TABLE `credentials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_name` varchar(200) NOT NULL,
  `credential_type` enum('api_key','password','token','oauth','ssh_key','certificate','other') NOT NULL DEFAULT 'api_key',
  `identifier` varchar(200) DEFAULT NULL,
  `credential_value` text,
  `additional_data` json DEFAULT NULL,
  `environment` enum('development','staging','production','all') NOT NULL DEFAULT 'production',
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Column Reference:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | `int AUTO_INCREMENT` | Primary key |
| `service_name` | `varchar(200)` | Logical name of the service (e.g. `'SMS'`, `'SMTP'`, `'Stripe'`) |
| `credential_type` | `enum` | One of: `api_key`, `password`, `token`, `oauth`, `ssh_key`, `certificate`, `other` |
| `identifier` | `varchar(200)` | Optional public identifier — username, key name, client ID label |
| `credential_value` | `text` | The secret value. May be plaintext or AES-256-GCM encrypted (`iv:authTag:cipher` format) |
| `additional_data` | `json` | Optional JSON blob for supplementary config (e.g. `{"secret":"...","port":587}`) |
| `environment` | `enum` | `development`, `staging`, `production`, or `all` |
| `expires_at` | `datetime` | Optional expiry timestamp |
| `is_active` | `tinyint` | `1` = active, `0` = deactivated (soft delete) |
| `notes` | `text` | Free-form notes |
| `created_by` | `varchar(36)` | User ID who created the row |
| `updated_by` | `varchar(36)` | User ID who last updated |
| `last_used_at` | `datetime` | Auto-updated when the credential is consumed by a service |
| `created_at` | `timestamp` | Row creation time |
| `updated_at` | `timestamp` | Auto-updated on any change |

### 2.2 `vault_credentials` Table (Separate System)

```sql
CREATE TABLE `vault_credentials` (
  `id` varchar(36) NOT NULL,
  `teamId` varchar(36) NOT NULL,
  `name` varchar(200) NOT NULL,
  `kind` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revokedAt` datetime(3) DEFAULT NULL,
  `createdByUserId` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `VaultCredential_teamId_idx` (`teamId`),
  KEY `VaultCredential_createdByUserId_idx` (`createdByUserId`),
  KEY `VaultCredential_revokedAt_idx` (`revokedAt`),
  CONSTRAINT `VaultCredential_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`),
  CONSTRAINT `VaultCredential_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `teams` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> **Note:** `vault_credentials` stores **metadata only** — it does NOT store any secret values. It is used for team-scoped credential grants in the Vault feature (see `vault.ts` route). It is a completely separate system from the `credentials` table.

---

## 3. Encryption Layer — `cryptoUtils.ts`

**File:** `backend/src/utils/cryptoUtils.ts`

### 3.1 Algorithm

| Property | Value |
|----------|-------|
| Algorithm | **AES-256-GCM** (authenticated encryption) |
| Key size | 32 bytes (256 bits) |
| IV size | 16 bytes (128 bits), randomly generated per encryption |
| Auth tag | 16 bytes (128 bits) — prevents tampering |
| Key source | `process.env.ENCRYPTION_MASTER_KEY` (64-char hex string) |
| Fallback | `Buffer.alloc(32)` — **insecure zero-key** with console warning |

### 3.2 Storage Format

Encrypted values are stored as a single colon-delimited string:

```
<iv_hex>:<authTag_hex>:<ciphertext_hex>
```

Example:
```
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4:f0e1d2c3b4a59687f0e1d2c3b4a59687:9f8e7d6c5b4a3928
```

### 3.3 Detection Heuristic

Services detect whether a `credential_value` is encrypted by checking:

```typescript
const parts = raw.split(':');
if (parts.length === 3 && parts.every((p: string) => /^[0-9a-f]{16,}$/i.test(p))) {
  // This is AES-256-GCM encrypted → decrypt it
  raw = decryptPassword(raw) ?? '';
}
```

Three colon-separated hex segments, each ≥ 16 chars = encrypted.

### 3.4 Full Source

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY 
  ? Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex')
  : Buffer.alloc(32);

if (!process.env.ENCRYPTION_MASTER_KEY) {
  console.warn('[SECURITY] ENCRYPTION_MASTER_KEY not set. Using insecure default. Generate with: openssl rand -hex 32');
}

export function encryptPassword(text: string): string | null {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptPassword(hash: string): string | null {
  if (!hash) return null;
  try {
    const parts = hash.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted string format');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[SECURITY] Decryption failed. Data may have been tampered with or key is wrong.', error);
    throw new Error('Decryption failed');
  }
}
```

### 3.5 Environment Variable

```bash
# In /var/opt/backend/.env
ENCRYPTION_MASTER_KEY=ada051a2d51b339c5496e9bc36dc6d2b3de7cb09452794afb6be57e5984a5ed3
```

Generate a new key: `openssl rand -hex 32`

> ⚠️ **If this key is changed, ALL existing encrypted values become permanently unreadable.**

---

## 4. Backend Routes — `systemCredentials.ts`

**File:** `backend/src/routes/systemCredentials.ts`  
**Mount point:** `apiRouter.use('/credentials', credentialsRouter)` → base path is `/api/credentials`  
**Auth:** All routes require `requireAuth` middleware.

### 4.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/credentials` | List all credentials. Values masked (`••••••••`) unless `?decrypt=true` |
| `GET` | `/credentials/expired` | List active credentials past their `expires_at` date |
| `GET` | `/credentials/expiring` | List credentials expiring within 30 days |
| `GET` | `/credentials/:id` | Get single credential (masked unless `?decrypt=true`). Updates `last_used_at` |
| `POST` | `/credentials` | Create a new credential row |
| `PUT` | `/credentials/:id` | Update any fields on a credential |
| `DELETE` | `/credentials/:id` | **Hard delete** a credential row |
| `POST` | `/credentials/:id/deactivate` | Soft delete — sets `is_active = 0` |
| `POST` | `/credentials/:id/rotate` | Rotate: accepts `new_value` in body to replace `credential_value` |
| `POST` | `/credentials/:id/test` | Basic validity check (is active, has value, not expired) |

### 4.2 Query Parameters

| Parameter | Used On | Description |
|-----------|---------|-------------|
| `decrypt` | GET list / GET single | `"true"` → return raw `credential_value` and `additional_data` |
| `type` | GET list | Filter by `credential_type` enum value |
| `environment` | GET list | Filter by `environment` enum value |

### 4.3 Masking Behaviour

When `decrypt` is NOT `true`, the response transforms:
```json
{
  "credential_value": "••••••••",
  "additional_data": "(encrypted)"
}
```

### 4.4 Key Notes

- **No server-side encryption on write:** The `POST /credentials` and `PUT /credentials/:id` routes store `credential_value` **as-is**. Encryption must happen _before_ the API call or in a future middleware.
- **No role/permission check beyond `requireAuth`:** Any authenticated user can CRUD credentials. The frontend gates access with `AdminRoute` + `credentials.view` permission, but the API does not enforce this.
- The `rotate` endpoint simply overwrites `credential_value` — it does not archive the old value.

---

## 5. Consumer: SMS Service — `smsService.ts`

**File:** `backend/src/services/smsService.ts`

The SMS service is the **only current consumer** of the `credentials` table. It reads the `SMS` row to authenticate with the SMSPortal REST API.

### 5.1 Credential Lookup

```typescript
async function getCredentials(): Promise<SmsCredentials> {
  const row = await db.queryOne<any>(
    `SELECT credential_value, additional_data
       FROM credentials
      WHERE service_name = ? AND is_active = 1
      LIMIT 1`,
    ['SMS'],
  );
  // ...
}
```

### 5.2 Two Supported Layouts

**Layout 1 — Colon-delimited pair in `credential_value`:**
```
credential_value = "clientId:secret"
additional_data  = NULL
```

**Layout 2 — Split across columns:**
```
credential_value = "clientId"
additional_data  = {"secret": "<api-secret>"}
```

Both `credential_value` and `additional_data.secret` are individually checked for AES-256-GCM encryption and decrypted if detected.

### 5.3 Token Caching

After resolving credentials, the service:
1. Builds a Basic Auth header: `Base64(clientId:secret)`
2. Calls `GET https://rest.smsportal.com/Authentication`
3. Caches the returned bearer token for 23 hours (tokens expire at 24h)
4. Updates `last_used_at` on the credentials row

### 5.4 Current Data

```
id:               1
service_name:     SMS
credential_type:  api_key
identifier:       ApiKey
credential_value: 0d517784-f5c8-452f-8b87-dec6914ce23c   (plaintext UUID — NOT encrypted)
additional_data:  NULL
environment:      all
is_active:        1
last_used_at:     2026-03-04 22:42:44
```

> ⚠️ The current SMS credential is stored in **plaintext**. It is not AES-256-GCM encrypted. The `smsService.ts` detection heuristic will pass it through as-is (it doesn't match the `iv:authTag:cipher` pattern).

---

## 6. Vault System — `vault.ts` (Separate)

**File:** `backend/src/routes/vault.ts`  
**Mount point:** `/api/vault`

The Vault is a **completely separate system** from the `credentials` table. It uses the `vault_credentials` table for **metadata-only** records tied to teams.

### 6.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vault/credentials` | List vault credential metadata for user's teams |
| `POST` | `/vault/credentials` | Create a vault credential record (ADMIN role required) |
| `DELETE` | `/vault/credentials/:id` | Soft-revoke by setting `revokedAt` (ADMIN role required) |
| `POST` | `/vault/grant` | Issue a grant token for a credential |

### 6.2 Key Differences from `credentials` Table

- No `credential_value` column — no secrets are stored
- Team-scoped with foreign keys to `teams` and `users`
- Uses UUID `id` (not auto-increment)
- Has RBAC: only team `ADMIN` role can create/revoke
- Cleanup on user deletion: `DELETE FROM vault_credentials WHERE createdByUserId = ?` (in `systemUsers.ts`)

---

## 7. Frontend

### 7.1 Routes (Admin-only)

Defined in `App.tsx`, all wrapped in `<AdminRoute>`:

| Route | Component | Description |
|-------|-----------|-------------|
| `/credentials` | `Credentials.tsx` | List/search/filter/delete credentials |
| `/credentials/new` | `CreateCredential.tsx` | Create form |
| `/credentials/:id/edit` | `CreateCredential.tsx` | Edit form (same component, edit mode) |

Navigation entry in `Layout.tsx`:
```typescript
{ name: 'Credentials', href: '/credentials', icon: KeyIcon, permission: 'credentials.view' }
```

### 7.2 Model — `CredentialModel.ts`

**File:** `frontend/src/models/CredentialModel.ts`

```typescript
export interface Credential {
  id: number;
  service_name: string;
  credential_type: 'api_key' | 'password' | 'token' | 'oauth' | 'ssh_key' | 'certificate' | 'other';
  identifier?: string;
  credential_value?: string;     // Only present when decrypt=true
  additional_data?: Record<string, any>; // Only present when decrypt=true
  environment: 'development' | 'staging' | 'production' | 'all';
  expires_at?: string;
  is_active: number;
  notes?: string;
  created_by: number;
  updated_by?: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}
```

**Static Methods:**

| Method | Endpoint Hit | Description |
|--------|-------------|-------------|
| `getAll(decrypt, filters)` | `GET /credentials` | List with optional type/environment filters |
| `getById(id, decrypt)` | `GET /credentials/:id` | Single credential |
| `getByService(name, env, decrypt)` | `GET /credentials/service/:name` | By service name (⚠️ no backend route exists for this) |
| `getExpired(decrypt)` | `GET /credentials/expired` | Expired list |
| `getExpiringSoon(days, decrypt)` | `GET /credentials/expiring` | Expiring soon |
| `search(query, decrypt)` | `GET /credentials/search` | Search (⚠️ no backend route exists for this) |
| `create(data)` | `POST /credentials` | Create |
| `update(id, data)` | `PUT /credentials/:id` | Update |
| `delete(id)` | `DELETE /credentials/:id` | Hard delete |
| `deactivate(id)` | `POST /credentials/:id/deactivate` | Soft delete |
| `rotate(id, newValue)` | `POST /credentials/:id/rotate` | Rotate value |
| `test(id)` | `POST /credentials/:id/test` | Validity check |

> ⚠️ `getByService` and `search` call endpoints that don't exist in the backend yet. These will 404.

### 7.3 Credentials List Page — `Credentials.tsx`

- DataTable with columns: Service Name, Type, Identifier, Environment, Expires, Status, Actions
- Actions per row: View Decrypted (eye icon), Edit (pencil), Delete (trash)
- "View Decrypted" modal with show/hide toggle for `credential_value`
- Delete confirmation dialog offers "Deactivate Instead" as a safer alternative
- Security warning banner at the top of the page
- Filter controls: search text, credential type dropdown, environment dropdown

### 7.4 Create/Edit Page — `CreateCredential.tsx`

- Uses `react-hook-form` with `Controller` components
- Fields: service_name, credential_type, identifier, credential_value, environment, expires_at, notes, additional_data (raw JSON textarea)
- SSH keys and certificates use a multi-line `<Textarea>` for the credential value
- Other types use a password input with show/hide toggle
- Blue info banner: "Credentials are automatically encrypted using AES-256 before storage"

---

## 8. File Map

| File | Role |
|------|------|
| `backend/src/utils/cryptoUtils.ts` | AES-256-GCM encrypt/decrypt functions |
| `backend/src/routes/systemCredentials.ts` | CRUD REST API for `credentials` table |
| `backend/src/services/smsService.ts` | Consumes `credentials` table for SMS gateway auth |
| `backend/src/routes/vault.ts` | Separate vault metadata system (`vault_credentials` table) |
| `backend/src/routes/systemUsers.ts` | Cleans up `vault_credentials` on user deletion |
| `backend/src/db/mysql.ts` | TypeScript interface for `vault_credentials` |
| `backend/src/app.ts` | Mounts `credentialsRouter` at `/api/credentials` (line 67, 197) |
| `backend/.env` | Contains `ENCRYPTION_MASTER_KEY` |
| `frontend/src/models/CredentialModel.ts` | API client model with typed interfaces |
| `frontend/src/pages/general/Credentials.tsx` | List/manage page (admin-only) |
| `frontend/src/pages/general/CreateCredential.tsx` | Create/edit form (admin-only) |
| `frontend/src/App.tsx` | Route definitions (lines 164-166) |
| `frontend/src/components/Layout/Layout.tsx` | Nav entry with `credentials.view` permission |

---

## 9. Security Considerations

### Current Gaps

1. **No server-side encryption on write:** The `POST` and `PUT` endpoints store `credential_value` as received. The frontend claims "automatically encrypted using AES-256" but the backend does not call `encryptPassword()` during create/update.

2. **No role enforcement on API:** All `requireAuth` users can access all credential endpoints. The frontend uses `AdminRoute` + `credentials.view` permission, but the API is unprotected.

3. **Plaintext SMS credential:** The only credential in the database (`id=1`, SMS) stores a plaintext UUID. It is not encrypted.

4. **Missing backend endpoints:** The frontend model calls `/credentials/service/:name` and `/credentials/search` which don't exist in `systemCredentials.ts`.

5. **Master key in `.env`:** The `ENCRYPTION_MASTER_KEY` is stored in a plaintext `.env` file on the server.

### Recommendations

- Add `encryptPassword()` call in the `POST /credentials` and `PUT /credentials/:id` handlers before storing `credential_value`
- Add role/permission middleware (e.g. `requirePermission('credentials.manage')`) to the credentials routes
- Encrypt the existing SMS credential: `UPDATE credentials SET credential_value = '<encrypted_value>' WHERE id = 1;`
- Implement the missing `/service/:name` and `/search` backend endpoints
- Consider moving `ENCRYPTION_MASTER_KEY` to a secrets manager or OS keyring

---

## 10. Usage Examples

### Encrypting a credential value manually (Node.js)

```typescript
import { encryptPassword } from './utils/cryptoUtils.js';

const encrypted = encryptPassword('my-secret-api-key');
// Returns: "a1b2c3...:f0e1d2...:9f8e7d..."

// Store in DB:
await db.execute(
  'UPDATE credentials SET credential_value = ? WHERE id = ?',
  [encrypted, 1]
);
```

### Reading and auto-decrypting (as smsService does)

```typescript
import { decryptPassword } from './utils/cryptoUtils.js';

const row = await db.queryOne('SELECT credential_value FROM credentials WHERE service_name = ?', ['MyService']);
let value = row.credential_value;

// Check if encrypted
const parts = value.split(':');
if (parts.length === 3 && parts.every(p => /^[0-9a-f]{16,}$/i.test(p))) {
  value = decryptPassword(value);
}

// `value` is now plaintext
```

### Creating a new credential via API

```bash
curl -X POST https://your-domain/api/credentials \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "SMTP",
    "credential_type": "password",
    "identifier": "noreply@example.com",
    "credential_value": "smtp-password-here",
    "additional_data": {"host": "smtp.gmail.com", "port": 587},
    "environment": "production",
    "notes": "Gmail SMTP for transactional emails"
  }'
```
