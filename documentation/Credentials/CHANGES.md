# Credentials Module — Changes

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

This document tracks version history, known issues, and migration notes for the Credentials module.

---

## 2. Version History

### Version 1.0.0 — Current (2026-03-04)

**Status:** ✅ Production  
**Release Notes:**

Core credential vault and SMS service integration operational:
- `credentials` table with full admin CRUD (create, read, update, delete)
- Soft delete via deactivation endpoint
- Credential rotation endpoint
- Basic validity test endpoint
- Expiry monitoring endpoints (expired, expiring within 30 days)
- AES-256-GCM encryption utility (`cryptoUtils.ts`)
- Value masking by default in API responses
- Admin UI with list, filter, view-decrypted, create/edit form
- SMSPortal integration (`smsService.ts`) as first consumer
- SMS send logging to `sms_log` table

**Features:**
- ✅ Admin CRUD for credentials (10 endpoints)
- ✅ Value masking in API responses (opt-in decrypt via `?decrypt=true`)
- ✅ Soft delete via deactivation
- ✅ Credential rotation
- ✅ Expiry tracking with `/expired` and `/expiring` endpoints
- ✅ `created_by`, `updated_by`, `last_used_at` audit fields
- ✅ Environment scoping (`development`, `staging`, `production`, `all`)
- ✅ 7 credential types (`api_key`, `password`, `token`, `oauth`, `ssh_key`, `certificate`, `other`)
- ✅ AES-256-GCM encryption utility available for consumers
- ✅ SMSPortal service integration (token auth, bulk send, balance check, logging)
- ✅ Frontend admin pages with DataTable, filter/search, create/edit forms

**Limitations:**
- ~~❌ Credentials stored as plaintext~~ → ✅ Fixed: CRUD routes now encrypt on write, decrypt on read
- ❌ No `requireAdmin` middleware — API-level access is gated only by `requireAuth`
- ~~❌ Two frontend endpoints (`search`, `getByService`) call backend routes that don't exist~~ → ✅ Fixed: Both routes added
- ❌ Rotate endpoint field name mismatch between frontend and backend
- ~~❌ No credential caching for service consumers~~ → ✅ Fixed: `credentialVault.ts` provides 5-min cached reads
- ❌ `service_name` is not unique — no constraint prevents duplicate rows per service
- ❌ SMS `additional_data.secret` not yet populated (requires manual UPDATE)

**Known Issues:** See Section 3 below

**Migration Notes:** Initial release. Ensure `ENCRYPTION_MASTER_KEY` env var is set:
```bash
# Generate a 32-byte hex master key
openssl rand -hex 32
# Add to .env:
ENCRYPTION_MASTER_KEY=<generated-key>
```

---

## 3. Known Issues

### Issue 1: Credential Values Stored as Plaintext

**Severity:** 🔴 CRITICAL  
**Status:** ✅ RESOLVED (2025-07-15)  
**File:Line:** [systemCredentials.ts](../../opt/backend/src/routes/systemCredentials.ts#L103-L120)

**Description:**  
The `POST` and `PUT` credential endpoints stored `credential_value` and `additional_data` as plaintext in the database.

**Resolution:**  
- `encryptPassword()` wired into POST (create), PUT (update), and rotate endpoints
- `decryptPassword()` wired into GET list and GET single when `?decrypt=true`
- Vault cache invalidated on every write/delete/rotate operation
- New `credentialVault.ts` service provides cached decrypted reads for all services
- Seed script (`scripts/seed-credentials.ts`) migrates existing .env secrets to encrypted vault

---

### Issue 2: No Admin-Level Authorization on API

**Severity:** 🟡 MEDIUM  
**Status:** 🟡 Open  
**File:Line:** [systemCredentials.ts](../../opt/backend/src/routes/systemCredentials.ts#L14)

**Description:**  
All 10 credential endpoints use `requireAuth` (any authenticated JWT user) instead of `requireAdmin`. The admin restriction exists only in the React frontend (`<AdminRoute>`), which a direct API call bypasses.

**Impact:**
- Any authenticated user can list, view (including `?decrypt=true`), create, update, and delete any credential

**Workaround:**  
None — the restriction must be added server-side.

**Fix Plan:**
```typescript
import { requireAdmin } from '../middleware/auth.js';
credentialsRouter.use(requireAuth, requireAdmin);
```

---

### Issue 3: Frontend Calls Non-Existent Endpoints

**Severity:** 🟡 MEDIUM  
**Status:** ✅ RESOLVED (2025-07-15)  
**File:Line:** [CredentialModel.ts](../../opt/frontend/src/models/CredentialModel.ts#L74-L85)

**Description:**  
`CredentialModel.getByService()` calls `GET /credentials/service/:name` and `CredentialModel.search()` calls `GET /credentials/search?q=...` — neither endpoint existed.

**Resolution:**  
Both endpoints added to `systemCredentials.ts`:
- `GET /credentials/search?q=...` — searches by service_name, identifier, and notes
- `GET /credentials/service/:serviceName` — returns the latest active credential for a service

---

### Issue 4: Rotate Endpoint Field Mismatch

**Severity:** 🟢 LOW  
**Status:** 🟢 Open  
**File:Line:** [systemCredentials.ts#L206](../../opt/backend/src/routes/systemCredentials.ts#L206), [CredentialModel.ts#L141](../../opt/frontend/src/models/CredentialModel.ts#L141)

**Description:**  
Backend reads `req.body.new_value`, frontend sends `{ new_credential_value: ... }`.

**Impact:**  
Rotation always returns the "provide new_value" prompt instead of actually rotating.

**Fix Plan:**  
Align field name to `new_value` in both frontend and backend.

---

### Issue 5: SMS Secret Not Populated

**Severity:** 🟡 MEDIUM  
**Status:** 🟡 Open  
**File:Line:** [smsService.ts](../../opt/backend/src/services/smsService.ts#L119-L123)

**Description:**  
The SMS credential row (id=1) has `additional_data = NULL`. The smsService requires the API secret in `additional_data.secret` to authenticate with SMSPortal.

**Impact:**  
SMS sending will fail with: `[SMS] additional_data.secret is missing`

**Fix:**
```sql
UPDATE credentials
SET additional_data = '{"secret":"<your-smsportal-api-secret>"}'
WHERE service_name = 'SMS';
```

---

## 4. Migration Guide

### Setting Up the Credentials Module

1. **Ensure the `credentials` table exists** (it should already be present):
   ```sql
   -- Verify:
   DESCRIBE credentials;
   ```

2. **Set the encryption master key**:
   ```bash
   openssl rand -hex 32
   # Add to /var/opt/backend/.env:
   ENCRYPTION_MASTER_KEY=<generated-key>
   ```

3. **Add SMS Portal secret** (if using SMS service):
   ```sql
   UPDATE credentials
   SET additional_data = '{"secret":"<your-smsportal-api-secret>"}'
   WHERE service_name = 'SMS';
   ```

4. **Verify frontend routes** are registered in `App.tsx`:
   ```
   /credentials       → Credentials list page
   /credentials/new   → Create new credential
   /credentials/:id/edit → Edit existing credential
   ```

### Adding a New Service Credential

```sql
INSERT INTO credentials
  (service_name, credential_type, identifier, credential_value, additional_data, environment, is_active)
VALUES
  ('NewService', 'api_key', 'PrimaryKey', 'key-value-here', '{"extra":"data"}', 'production', 1);
```

### Consuming a Credential in a New Service

```typescript
import { db } from '../db/mysql.js';
import { decryptPassword } from '../utils/cryptoUtils.js';

async function getMyServiceKey(): Promise<string> {
  const row = await db.queryOne<any>(
    'SELECT credential_value FROM credentials WHERE service_name = ? AND is_active = 1 LIMIT 1',
    ['NewService'],
  );
  if (!row?.credential_value) throw new Error('No credential found for NewService');

  // Auto-detect encryption
  const parts = row.credential_value.split(':');
  if (parts.length === 3 && parts.every((p: string) => /^[0-9a-f]{16,}$/i.test(p))) {
    return decryptPassword(row.credential_value) ?? '';
  }
  return row.credential_value;
}
```

---

*This document is maintained alongside code changes. Update when issues are resolved or new versions are released.*
