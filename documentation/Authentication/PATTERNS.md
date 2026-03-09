# Authentication Module - Architecture Patterns

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

This document catalogs the architecture patterns and anti-patterns found in the Authentication module.

---

## 2. Architectural Patterns

### 2.1 Transactional Registration Pattern

**Context:** Registration creates multiple related records (user, user_role, legacy team/team_member, activation_key) that must all succeed or all fail.

**Implementation:**

```typescript
const result = await db.transaction(async (conn) => {
  const userId = generateId();
  const teamId = generateId();
  const memberId = generateId();
  const keyId = generateId();
  const now = toMySQLDate(new Date());

  await conn.execute('INSERT INTO users ...', [userId, ...]);

  // Legacy: team + membership kept for credit balance scoping
  await conn.execute('INSERT INTO teams ...', [teamId, ...]);
  await conn.execute('INSERT INTO team_members ...', [memberId, teamId, userId, 'OPERATOR', now]);

  // Role assignment via user_roles (the authoritative source)
  const [viewerRole] = await conn.execute('SELECT id FROM roles WHERE slug = ? LIMIT 1', ['viewer']);
  await conn.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, viewerRole[0].id]);

  await conn.execute('INSERT INTO activation_keys ...', [keyId, ...]);

  return { user, activationKey };
});
```

**Benefits:**
- ✅ No partial state — if any INSERT fails, all are rolled back
- ✅ UUIDs pre-generated so all records can reference each other
- ✅ Role assigned via `user_roles` (authoritative) — no dependency on team membership for role detection
- ✅ Clean return value with created entities (no team in response)

**Drawbacks:**
- ❌ Long transaction holds connection — if bcrypt is slow, connection is locked
- ❌ No retry logic on deadlock (unlikely but possible under high concurrency)

---

### 2.2 Two-Phase Multi-Method 2FA Setup Pattern

**Context:** 2FA must not be enabled until user proves they can generate valid codes. Supports 3 methods: TOTP, email OTP, and SMS OTP.

**Implementation:**

```
Phase 1: /auth/2fa/setup { method: 'totp'|'email'|'sms' }
  → TOTP: Generate secret, QR code → store in DB with is_enabled = 0
  → Email: Generate 6-digit OTP, store in otp_code/otp_expires_at, send via emailService
  → SMS: Generate 6-digit OTP, store in otp_code/otp_expires_at, send via sendSms()
  → Set preferred_method on the row

Phase 2: /auth/2fa/verify-setup { code }
  → TOTP: User scans QR, enters 6-digit code → validate with otpauth
  → Email/SMS: User enters received 6-digit code → match otp_code, check otp_expires_at
  → Set is_enabled = 1
  → Generate and return 10 backup codes
```

**Benefits:**
- ✅ Prevents users from enabling 2FA without working method
- ✅ Method-agnostic verification phase — same endpoint handles all 3 methods
- ✅ Backup codes only generated after verification — no wasted codes
- ✅ Setup can be retried (UPSERT on user_two_factor)
- ✅ Email/SMS OTP has 5-minute expiry (`otp_expires_at` via `DATE_ADD(NOW(), INTERVAL 5 MINUTE)`)

**Drawbacks:**
- ❌ TOTP secret stored in plaintext during setup phase
- ❌ No expiry on un-verified TOTP setup — stale secrets persist
- ✅ SMS implemented via SMSPortal REST API (`smsService.ts`)

---

### 2.3 Temp Token for Multi-Method 2FA Login

**Context:** After password verification, user must provide 2FA code, but we can't issue a real JWT until 2FA is verified. The temp token carries the user's preferred 2FA method so the frontend knows which verification UI to show.

**Implementation:**

```typescript
// On successful password check with 2FA enabled:
const method = twoFactorRow.preferred_method || 'totp';

// Auto-send OTP for email/SMS methods
if (method === 'email') {
  const otp = generateOTP();  // 6-digit random
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  // CRITICAL: Use MySQL DATE_ADD(NOW(), ...) — never JS timestamps (timezone mismatch)
  await db.execute('UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE user_id = ?',
    [otpHash, user.id]);
  await sendTwoFactorOtp(user.email, otp);
} else if (method === 'sms') {
  const otp = generateOTP();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  await db.execute('UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE user_id = ?',
    [otpHash, user.id]);
  await sendSms(user.phone, `Your SoftAware verification code is: ${otp}. This code expires in 5 minutes.`);
}

const tempToken = jwt.sign(
  { userId: user.id, purpose: '2fa', rememberMe: input.rememberMe },
  env.JWT_SECRET,
  { expiresIn: '5m' },
);
return res.json({
  requires_2fa: true,
  two_factor_method: method,
  temp_token: tempToken,
});

// On /auth/2fa/verify:
const decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
if (decoded.purpose !== '2fa') throw badRequest('Invalid temporary token.');
// ... verify code based on method, then issue real token
const token = signAccessToken({ userId }, decoded.rememberMe ? '30d' : undefined);
```

**Benefits:**
- ✅ Password check result carried forward without re-authenticating
- ✅ 5-minute TTL limits exposure window
- ✅ `purpose: '2fa'` prevents temp token from being used as real auth
- ✅ rememberMe preference preserved across the 2FA step
- ✅ `two_factor_method` in response tells frontend which UI to show (TOTP entry vs "check your email" vs "check your phone")
- ✅ Auto-sends OTP for email/SMS — user doesn't need to request it
- ✅ Resend available via `POST /auth/2fa/send-otp` with temp_token

**Drawbacks:**
- ❌ Same JWT_SECRET for both temp and real tokens — if secret leaks, both are compromised
- ❌ No jti (JWT ID) claim — token can be replayed within the 5-minute window

---

### 2.4 Frontend User Shape Builder Pattern

**Context:** Frontend expects a specific user object shape with role and permissions — but backend stores these across 3+ tables.

**Implementation:**

```typescript
export async function buildFrontendUser(userId: string) {
  // 3 sequential DB queries (no team dependency):
  const user = await db.queryOne('SELECT ... FROM users WHERE id = ?', [userId]);
  const roleRow = await db.queryOne('SELECT ... FROM user_roles JOIN roles ...', [userId]);
  const permissions = await db.query('SELECT ... FROM role_permissions JOIN permissions ...', [roleId]);

  // Fallback for users without user_roles entry
  const userRole = roleRow
    ? { id: roleRow.role_id, name: roleRow.role_name, slug: roleRow.role_slug }
    : { id: 0, name: 'Client', slug: 'client' };

  const isAdmin = userRole.slug === 'admin' || userRole.slug === 'super_admin';
  const isStaff = ['developer', 'client_manager', 'qa_specialist', 'deployer'].includes(userRole.slug);

  return {
    id, email, name, avatar, is_admin, is_staff,
    role: { id, name, slug },
    permissions: [...],
  };
}
```

**Benefits:**
- ✅ Single reusable function called by login, me, and 2FA verify
- ✅ Frontend receives a denormalized object — no additional API calls needed
- ✅ Permission resolution (wildcard for admins/staff) encapsulated
- ✅ No team dependency — role resolved entirely from `user_roles` table

**Drawbacks:**
- ❌ 3 sequential DB queries per call — could be a single JOIN
- ❌ No caching — called on every /auth/me request
- ❌ Tight coupling to frontend object shape

---

### 2.5 Dual-Format Response Pattern

**Context:** Mobile app and web frontend expect different response shapes.

**Implementation:**

```typescript
res.json({
  // Frontend shape
  success: true,
  message: 'Login successful',
  data: { token, user: frontendUser },
  // Legacy mobile shape
  accessToken: token,
  token: token,
  expiresIn: '1h',
  user: frontendUser,
});
```

**Benefits:**
- ✅ Backward compatible with existing mobile clients
- ✅ Web frontend can use `response.data.data.token`
- ✅ No need for API versioning

**Drawbacks:**
- ❌ Duplicate data in response — increased payload size
- ❌ Confusing: `data.token` vs `accessToken` vs `token`
- ❌ Technical debt — should be cleaned up with versioned API

---

### 2.6 Dual-JWT Masquerade Pattern

**Context:** Admin needs to impersonate a client user to see their portal experience, but must be able to safely return to their own admin session.

**Implementation:**

```typescript
// Backend: POST /admin/clients/:userId/masquerade
const masqueradeToken = signAccessToken({ userId: targetUserId }, '1h');  // short-lived
const adminRestoreToken = signAccessToken({ userId: adminId }, '2h');     // slightly longer

return res.json({
  data: {
    token: masqueradeToken,          // used as active JWT
    user: buildFrontendUser(target),  // target user's profile
    adminRestoreToken,               // stored separately in localStorage
    adminId,                         // for UI reference
  },
});
```

```typescript
// Frontend: AuthModel.startMasquerade()
localStorage.setItem('masquerade_admin_restore_token', adminRestoreToken);
localStorage.setItem('masquerade_admin_id', adminId);
this.storeAuth(token, user);  // overwrites active session with target user
```

```typescript
// Backend: POST /auth/masquerade/exit
const decoded = jwt.verify(adminRestoreToken, env.JWT_SECRET);
const adminId = decoded.userId;

// Re-verify admin role (prevents escalation if role was removed during masquerade)
const adminRole = await db.queryOne('SELECT ... FROM user_roles ... WHERE slug IN ("admin","super_admin")', [adminId]);
if (!adminRole) return res.status(403).json({ error: 'Not an admin' });

// Issue fresh admin JWT
const token = signAccessToken({ userId: adminId });
const user = await buildFrontendUser(adminId);
```

**Benefits:**
- ✅ Two independent JWTs — compromise of masquerade token doesn't give admin access
- ✅ Admin restore token has separate (longer) expiry — admin can return even after masquerade token expires
- ✅ Exit endpoint re-verifies admin role — prevents privilege escalation if role was revoked during masquerade
- ✅ Self-masquerade blocked — admin cannot masquerade as themselves
- ✅ Clear visual indicator (purple banner) prevents confusion about which session is active
- ✅ Frontend localStorage keys are separate from normal auth — `clearAuth()` also cleans masquerade state

**Drawbacks:**
- ❌ Admin restore token stored in localStorage — XSS could steal it (mitigated by 2h TTL + role re-verification)
- ❌ No server-side masquerade tracking — no way to forcibly end a masquerade session
- ❌ Console-only audit logging — should be persisted to database for compliance
- ❌ Same JWT_SECRET for masquerade and regular tokens — no cryptographic separation

> **v1.3.0 fix:** Both `Layout.tsx` (admin/staff) and `PortalLayout.tsx` (client) now render the masquerade banner. Previously only `Layout.tsx` had the banner, so masquerading as a client user left the admin with no "Return to Admin" button.

**localStorage Keys (during masquerade):**

| Key | Value | Set By | Cleared By |
|-----|-------|--------|------------|
| `jwt_token` | Target user's JWT (1h) | `startMasquerade()` | `exitMasquerade()` / `clearAuth()` |
| `user` | Target user's profile JSON | `startMasquerade()` | `exitMasquerade()` / `clearAuth()` |
| `masquerade_admin_restore_token` | Admin's JWT (2h) | `startMasquerade()` | `exitMasquerade()` / `clearAuth()` / `clearMasquerade()` |
| `masquerade_admin_id` | Admin's user ID | `startMasquerade()` | `exitMasquerade()` / `clearAuth()` / `clearMasquerade()` |

---

### 2.7 Role-Based 2FA Enforcement Pattern

**Context:** Staff and admin users must have 2FA enabled (mandatory). Client users are encouraged but not required.

**Implementation:**

```typescript
// Backend: GET /auth/2fa/status
const isStaffOrAdmin = roleRow && ['admin', 'super_admin', 'developer', 'client_manager', 'qa_specialist', 'deployer'].includes(roleRow.slug);
const availableMethods = isStaffOrAdmin ? ['totp', 'email', 'sms'] : ['totp', 'email'];

return res.json({
  data: {
    is_enabled: twoFactorRow?.is_enabled || false,
    preferred_method: twoFactorRow?.preferred_method || 'totp',
    is_required: isStaffOrAdmin,
    available_methods: availableMethods,
  }
});

// Backend: POST /auth/2fa/disable
if (isStaffOrAdmin) {
  return res.status(403).json({ error: 'Staff and admin users cannot disable 2FA' });
}

// Frontend: TwoFactorSetup.tsx
<TwoFactorSetup isStaffOrAdmin={user.is_admin || user.is_staff} />
// → Shows all 3 methods if staff/admin, 2 if client
// → Hides disable button if staff/admin
// → Shows "2FA is required" banner if staff/admin without 2FA
```

**Benefits:**
- ✅ Strong security for privileged accounts — mandatory 2FA
- ✅ Flexible for clients — opt-in without friction
- ✅ SMS only available for staff/admin (cost control)
- ✅ Single reusable component adapts behavior via prop
- ✅ Backend enforces policy — frontend is just UI

**Drawbacks:**
- ❌ No grace period — newly promoted staff must enable 2FA immediately
- ❌ No admin ability to force 2FA for specific clients

---

### 2.8 Centralized Email Service with Encrypted Credentials

**Context:** Multiple features need to send email (2FA OTP, password reset, notifications). SMTP credentials must be securable and configurable via admin UI without redeploying.

**Implementation:**

```typescript
// emailService.ts — Credential Resolution
async function getSmtpConfig() {
  // 1. Try credentials table (admin-configured via UI)
  const row = await db.queryOne('SELECT * FROM credentials WHERE service_name = ?', ['SMTP']);
  if (row) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return JSON.parse(decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8'));
  }
  // 2. Fallback to environment variables
  return { host: env.SMTP_HOST, port: env.SMTP_PORT, ... };
}

// Transporter caching
let cachedTransporter: nodemailer.Transporter | null = null;
async function getTransporter() {
  if (!cachedTransporter) {
    const config = await getSmtpConfig();
    cachedTransporter = nodemailer.createTransport({ host, port, auth, ... });
  }
  return cachedTransporter;
}

// Cache invalidation on config change
export function invalidateTransporter() {
  cachedTransporter = null;
}

// Called by PUT /email/config after saving new credentials
```

**Benefits:**
- ✅ AES-256-GCM encryption — SMTP password never stored in plaintext
- ✅ Admin can change SMTP config without server restart or env changes
- ✅ Fallback to env vars — works in development without DB config
- ✅ Transporter cached — avoids reconnecting to SMTP server on every send
- ✅ All sends logged to `email_log` table for audit
- ✅ Single service used by 2FA, password reset, and general email

**Drawbacks:**
- ❌ ENCRYPTION_KEY in env — if env is compromised, credentials can be decrypted
- ❌ No connection pooling beyond nodemailer's built-in reuse
- ❌ No retry logic on transient SMTP failures

---

## 3. Anti-Patterns Found

### 3.1 Sequential Queries in buildFrontendUser

**Description:** 3 sequential database queries to build a single user object.

**Current Code:**

```typescript
const user = await db.queryOne('SELECT ... FROM users WHERE id = ?', [userId]);
const roleRow = await db.queryOne('SELECT ... FROM user_roles JOIN roles ...', [userId]);
const permissions = await db.query('SELECT ... FROM role_permissions JOIN permissions ...', [roleId]);
```

**Impact:** 🟡 WARNING — 3 round trips to MySQL per login/me request. Under load, this multiplies connection usage.

**Recommended Fix:**

```sql
SELECT u.id, u.email, u.name, u.phone, u.avatarUrl,
       r.id AS role_id, r.name AS role_name, r.slug AS role_slug
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.id = ?
LIMIT 1
```

Then fetch permissions in a second query. **2 queries instead of 3.**

**Effort:** 🟢 LOW

---

### 3.2 No Rate Limiting on Login

**Description:** No throttling on the /auth/login endpoint.

**Impact:** 🔴 CRITICAL — Brute force and credential stuffing attacks are unthrottled.

**Recommended Fix:**

```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

authRouter.post('/login', loginLimiter, async (req, res, next) => { ... });
```

**Effort:** 🟢 LOW (5 lines)

---

### 3.3 Password Reset Endpoints Not in auth.ts

**Description:** The frontend `AuthModel` calls `/auth/forgot-password`, `/auth/verify-otp`, and `/auth/reset-password`, but these endpoints are not defined in `auth.ts`. They may be in a separate file or missing entirely.

**Impact:** 🟡 WARNING — Frontend code references endpoints that may not exist or are in an undocumented location.

**Recommended Fix:** Verify these endpoints exist; if not, implement them in `auth.ts`.

**Effort:** 🟡 MEDIUM

---

### 3.4 Collation Hack in user_roles Query

**Description:** The user_roles query uses explicit `COLLATE utf8mb4_unicode_ci` to work around a collation mismatch.

**Current Code:**

```sql
WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
```

**Impact:** 🟡 WARNING — Forces full table scan (no index use) because collation override prevents index matching.

**Recommended Fix:** Alter the user_roles table to match the users table collation:

```sql
ALTER TABLE user_roles MODIFY user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**Effort:** 🟢 LOW

---

### 3.5 2FA Secret in Plaintext

**Description:** The TOTP secret is stored as plaintext base32 in `user_two_factor.secret`.

**Impact:** 🟡 WARNING — If database is compromised, attacker can generate valid TOTP codes for all users.

**Recommended Fix:** Encrypt the secret at rest using a server-side key (AES-256-GCM), decrypt only during validation.

**Effort:** 🟡 MEDIUM
