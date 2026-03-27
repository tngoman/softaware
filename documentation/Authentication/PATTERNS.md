# Authentication Module - Architecture Patterns

**Version:** 2.0.0  
**Last Updated:** 2026-03-14

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

**Context:** Frontend expects a specific user object shape with role and permissions — but backend stores these across 3+ tables. Admin/staff status is stored directly on the `users` table (v1.6.0+).

**Implementation:**

```typescript
export async function buildFrontendUser(userId: string) {
  // v1.6.0: is_admin and is_staff read directly from users table columns
  const user = await db.queryOne('SELECT id, email, name, ..., is_admin, is_staff FROM users WHERE id = ?', [userId]);
  const roleRow = await db.queryOne('SELECT ... FROM user_roles JOIN roles ...', [userId]);
  const permissions = await db.query('SELECT ... FROM role_permissions JOIN permissions ...', [roleId]);

  // Fallback for users without user_roles entry
  const userRole = roleRow
    ? { id: roleRow.role_id, name: roleRow.role_name, slug: roleRow.role_slug }
    : { id: 0, name: 'Client', slug: 'client' };

  // v1.6.0: Read directly from users table columns (not derived from role slugs)
  const isAdmin = !!user.is_admin;
  const isStaff = !!user.is_staff;

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
- ✅ Admin/staff status from direct DB columns — no dependency on role slug naming (v1.6.0+)

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

// v1.6.0: Re-verify admin status via users.is_admin column (no role slug dependency)
const [rows] = await db.execute('SELECT is_admin FROM users WHERE id = ? LIMIT 1', [adminId]);
const adminUser = (rows as any[])[0];
if (!adminUser || !adminUser.is_admin) return res.status(403).json({ error: 'Not an admin' });

// Issue fresh admin JWT
const token = signAccessToken({ userId: adminId });
const user = await buildFrontendUser(adminId);
```

**Benefits:**
- ✅ Two independent JWTs — compromise of masquerade token doesn't give admin access
- ✅ Admin restore token has separate (longer) expiry — admin can return even after masquerade token expires
- ✅ Exit endpoint re-verifies admin status via `users.is_admin` column — prevents privilege escalation if admin flag was removed during masquerade (v1.6.0+)
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
// v1.6.0: Staff/admin detection via users.is_admin/is_staff columns (not role slugs)
const [rows] = await db.execute('SELECT is_admin, is_staff FROM users WHERE id = ? LIMIT 1', [req.user.id]);
const userRow = (rows as any[])[0];
const isStaffOrAdmin = userRow && (userRow.is_admin || userRow.is_staff);
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

### 2.9 Push-to-Approve 2FA Pattern (v1.7.0)

**Context:** TOTP code entry requires the user to open their authenticator app, read a 6-digit code, switch to the browser, and type it — all within 30 seconds. Push-to-approve provides a single-tap alternative for users with the mobile app installed.

**Implementation:**

```typescript
// auth.ts — During login, after detecting TOTP method:
let challengeId: string | null = null;
try {
  challengeId = await createPushChallenge(
    user.id, input.rememberMe, user.email, user.name
  );
} catch (err) {
  console.error('[Auth] Push challenge failed (non-fatal):', err);
}

return res.json({
  requires_2fa: true,
  two_factor_method: method,
  temp_token: tempToken,
  ...(challengeId ? { challenge_id: challengeId } : {}),
  message: challengeId
    ? 'Approve the login on your mobile app, or enter your authenticator code.'
    : 'Two-factor authentication required.',
});
```

```typescript
// twoFactor.ts — createPushChallenge()
export async function createPushChallenge(
  userId: string, rememberMe: boolean, userEmail: string, userName?: string
): Promise<string | null> {
  const challengeId = crypto.randomBytes(32).toString('hex');

  await db.execute(
    `INSERT INTO mobile_auth_challenges (id, user_id, status, remember_me, source)
     VALUES (?, ?, 'pending', ?, 'push')`,
    [challengeId, userId, rememberMe ? 1 : 0]
  );

  const result = await sendPushToUser(userId, {
    type: 'login_approval',
    challenge_id: challengeId,
    user_email: userEmail,
    title: 'Login Approval Request',
    body: `Tap to approve login for ${userEmail}`,
  });

  if (!result || result.successCount === 0) return null;
  return challengeId;
}
```

```typescript
// twoFactor.ts — POST /auth/2fa/push-approve (mobile app endpoint)
// Validates: JWT ownership, source='push', pending status, not expired
// Sets status to 'completed' (approve) or 'denied' (deny)

// twoFactor.ts — POST /auth/2fa/push-status (web frontend polling endpoint)
// Validates: temp_token JWT with purpose='2fa'
// Returns: { status: 'pending' | 'denied' | 'expired' }
//   OR on 'completed': issues full JWT (same shape as /auth/2fa/verify)
```

**Flow Diagram:**

```
  Web Login          Backend              Mobile App         FCM
     │                  │                     │               │
     │── POST /login ──▶│                     │               │
     │                  │── createPushChallenge()              │
     │                  │── INSERT challenge ──▶ DB            │
     │                  │── sendPushToUser() ─────────────▶│
     │                  │                     │◀── FCM push ──┘
     │◀── { requires_2fa,│                     │
     │   challenge_id } │                     │
     │                  │                     │
     │                  │  POST /push-approve  │
     │                  │◀── { approve } ─────┘
     │                  │── status='completed' ▶ DB
     │                  │                     │
     │── POST /push-status ▶│                  │
     │                  │── status='completed'
     │                  │── issue JWT ─────▶
     │◀── { token, user }│
     │                  │
```

**Benefits:**
- ✅ Single-tap approval — no code transcription needed
- ✅ Non-breaking, additive change — existing TOTP code entry still works as fallback
- ✅ Non-fatal push — `createPushChallenge()` wrapped in try/catch; FCM failure never blocks login
- ✅ Parallel paths — web frontend can poll push-status while also accepting manual TOTP code entry
- ✅ Ownership enforced — only the challenge owner (by JWT userId) can approve/deny
- ✅ Source guard — only `source='push'` challenges accepted by push-approve endpoint
- ✅ Time-limited — 5-minute expiry matches temp_token TTL
- ✅ Deny support — user can explicitly deny suspicious login attempts
- ✅ Same JWT issuance path — push-status uses `buildFrontendUser()` + `signAccessToken()` (identical to /auth/2fa/verify)
- ✅ Reuses existing infrastructure — `mobile_auth_challenges` table, `fcm_tokens` table, `firebaseService.ts`

**Drawbacks:**
- ❌ Polling-based — push-status requires frontend to poll every 2-3 seconds (no WebSocket/SSE push to web)
- ❌ Requires FCM setup — Firebase Admin SDK must be configured; mobile app must register FCM tokens
- ❌ No challenge cleanup — expired/completed challenges accumulate in DB (should add periodic purge)
- ❌ Same JWT_SECRET for temp and real tokens — inherits existing weakness from temp token pattern

---

### 2.10 Alternative Authentication Fallback Pattern (v1.8.0)

**Context:** A user's preferred 2FA method may be temporarily unavailable (e.g., TOTP push requires a mobile app the user doesn't have nearby, SMS requires phone reception, email may be inaccessible). The system needs a way to fall back to any other available method without changing the user's permanent preference.

**Implementation:**

```typescript
// Backend: POST /auth/2fa/send-alt-otp
const decoded = jwt.verify(input.temp_token, env.JWT_SECRET);
if (decoded.purpose !== '2fa') throw badRequest('Invalid temporary token.');

const method = input.method; // 'email' or 'sms'
const otp = generateOTP(); // 6-digit random
const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

// Store OTP using the user's existing 2FA row (does NOT change preferred_method)
await db.execute(
  'UPDATE user_two_factor SET otp_code = ?, otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE user_id = ?',
  [otpHash, decoded.userId]
);

// Send via the requested alternative method
if (method === 'email') {
  await sendTwoFactorOtp(user.email, otp);
} else if (method === 'sms') {
  await sendSms(user.phone, `Your verification code is: ${otp}`);
}
```

```typescript
// Backend: POST /auth/2fa/verify — Universal TOTP validation
// v1.8.0: Always try TOTP first, regardless of preferred_method
let isValid = false;

// 1. Try TOTP (always, for any 6-digit numeric code)
if (input.code.length === 6 && /^\d+$/.test(input.code)) {
  const totp = createTOTP(twoFactorRow.secret, user.email);
  const delta = totp.validate({ token: input.code, window: 1 });
  if (delta !== null) isValid = true;
}

// 2. Try email/SMS OTP (if TOTP didn't match)
if (!isValid && twoFactorRow.otp_code) { /* check OTP hash + expiry */ }

// 3. Try backup code (if neither matched)
if (!isValid) { /* check SHA-256 hash against backup_codes JSON */ }
```

```typescript
// Frontend: AuthPage.tsx — Dynamic alternative method buttons
const handleSendAltOtp = async (method: 'email' | 'sms') => {
  setSendingAltOtp(true);
  try {
    await AuthModel.sendAltOtp(twoFaTempToken, method);
    setShowManualCode(true); // Switch to code entry screen
    // Show success message based on method
  } catch (err) { /* show error */ }
  finally { setSendingAltOtp(false); }
};

// On push screen or manual code screen, show the OTHER two methods:
// If preferred=totp: show Email + SMS buttons
// If preferred=email: show Authenticator + SMS buttons
// If preferred=sms: show Authenticator + Email buttons
```

**Benefits:**
- ✅ Non-destructive — does NOT change `preferred_method`, just sends a one-time OTP
- ✅ Universal verify — TOTP codes work regardless of which method was used to send OTP
- ✅ Full coverage — user always has at least 2 fallback options (email, SMS, or authenticator app)
- ✅ Same temp_token — reuses the existing 5-minute temp_token pattern
- ✅ Backup codes always work — 8-char hex codes accepted as final fallback regardless of method
- ✅ Frontend dynamically shows only the alternative methods (not the current one)

**Drawbacks:**
- ❌ SMS availability depends on user having a phone number on file
- ❌ Overwriting `otp_code` — if user requests multiple alternatives, only the latest OTP is valid
- ❌ No tracking of which alternative method was used for audit purposes

---

### 2.11 Push-to-Approve Frontend Polling Pattern (v1.8.0)

**Context:** The push-to-approve flow requires the web frontend to detect when the mobile app has approved/denied the challenge. Since the system doesn't use WebSockets, the frontend must poll.

**Implementation:**

```typescript
// AuthPage.tsx — Push-to-approve polling useEffect
useEffect(() => {
  if (!challengeId || !twoFaTempToken || pushStatus === 'denied' || pushStatus === 'expired') return;
  if (showManualCode) return; // Stop polling when user switches to manual entry

  const interval = setInterval(async () => {
    try {
      const response = await AuthModel.pollPushStatus(twoFaTempToken, challengeId);

      if (response.success && response.data?.token) {
        // Approved! Auto-complete login
        clearInterval(interval);
        AuthModel.storeAuth(response.data.token, response.data.user);
        // ... navigate to dashboard
      } else if (response.status === 'denied') {
        setPushStatus('denied');
        clearInterval(interval);
      } else if (response.status === 'expired') {
        setPushStatus('expired');
        clearInterval(interval);
      }
      // 'pending' — continue polling
    } catch (err) {
      // Token expired — stop polling
      clearInterval(interval);
    }
  }, 3000); // Poll every 3 seconds

  return () => clearInterval(interval); // Cleanup on unmount
}, [challengeId, twoFaTempToken, pushStatus, showManualCode]);
```

```typescript
// State management
const [challengeId, setChallengeId] = useState<string | null>(null);
const [pushStatus, setPushStatus] = useState<string>('');
const [showManualCode, setShowManualCode] = useState(false);

// On login response:
if (data.challenge_id) {
  setChallengeId(data.challenge_id);
  // Show push waiting screen
}

// User actions:
// "Enter code manually" → setShowManualCode(true)  // stops polling
// "Back to push approval" → setShowManualCode(false)  // resumes polling
// "Use Email Instead" → handleSendAltOtp('email')
// "Use SMS Instead" → handleSendAltOtp('sms')
```

**UI States:**

| State | pushStatus | showManualCode | Screen |
|-------|-----------|----------------|--------|
| Waiting for approval | `''` (empty) | false | Spinning indicator + "Waiting for approval on your mobile device..." + "Enter code manually" link + Alt method buttons |
| Push denied | `'denied'` | false | Red message "Login was denied on your mobile device" + "Try Again" + "Enter code manually" link |
| Push expired | `'expired'` | false | Yellow message "The approval request has expired" + "Try Again" + "Enter code manually" link |
| Manual code entry | any | true | Code input field + "Verify" button + "Back to push approval" link + Alt method buttons |
| Login complete | — | — | Navigates to `/dashboard` |

**Benefits:**
- ✅ Simple polling approach — no WebSocket complexity
- ✅ Automatic cleanup — interval cleared on unmount, status change, or navigation
- ✅ Parallel paths — user can enter TOTP code manually while push is pending
- ✅ Graceful degradation — denied/expired show clear messages with recovery options
- ✅ Alternative methods always available — user never gets stuck on push screen
- ✅ 3-second interval balances responsiveness vs server load

**Drawbacks:**
- ❌ Polling — not real-time (up to 3-second delay after approval)
- ❌ Server load — continuous polling for duration of challenge (max ~100 requests over 5 minutes)
- ❌ No exponential backoff — constant 3-second interval regardless of time elapsed

---

### 2.12 PIN Quick Login Pattern (v1.9.0)

**Context:** Returning users on trusted devices must enter their full email and password every login. For frequent users (e.g., staff checking in multiple times per day), this creates unnecessary friction. A 4-digit PIN provides a faster alternative credential without compromising security.

**Implementation:**

```typescript
// Backend: Auto-migration on module load
async function ensurePinTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_pins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      pin_hash VARCHAR(255) NOT NULL,
      failed_attempts INT DEFAULT 0,
      locked_until DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_pin (user_id),
      CONSTRAINT fk_user_pins_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
ensurePinTable(); // Called on module load — zero manual migration
```

```typescript
// Backend: POST /auth/pin/set — UPSERT pattern
const pinHash = await bcrypt.hash(pin, 10);
await db.execute(
  `INSERT INTO user_pins (user_id, pin_hash, failed_attempts, locked_until)
   VALUES (?, ?, 0, NULL)
   ON DUPLICATE KEY UPDATE pin_hash = VALUES(pin_hash),
     failed_attempts = 0, locked_until = NULL`,
  [userId, pinHash]
);
// Single query handles both initial set and PIN change
// Also resets failed attempts and lockout on change
```

```typescript
// Backend: POST /auth/pin/verify — Rate-limited with per-user lockout
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;

// 1. Find user by email (don't reveal if email exists)
const user = await findUserByEmail(email);
if (!user) return res.status(401).json({ error: 'Invalid email or PIN' });

// 2. Find PIN (don't reveal if PIN is set)
const pinRow = await findPinByUserId(user.id);
if (!pinRow) return res.status(401).json({ error: 'Invalid email or PIN' });

// 3. Check lockout
if (pinRow.locked_until && new Date(pinRow.locked_until) > new Date()) {
  return res.status(429).json({ error: 'Too many attempts. Try again later.' });
}

// 4. Verify PIN
const valid = await bcrypt.compare(pin, pinRow.pin_hash);
if (!valid) {
  const newAttempts = pinRow.failed_attempts + 1;
  if (newAttempts >= PIN_MAX_ATTEMPTS) {
    // Lock for 15 minutes
    await db.execute(
      'UPDATE user_pins SET failed_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE user_id = ?',
      [newAttempts, PIN_LOCKOUT_MINUTES, user.id]
    );
  } else {
    await db.execute('UPDATE user_pins SET failed_attempts = ? WHERE user_id = ?',
      [newAttempts, user.id]);
  }
  return res.status(401).json({ error: 'Invalid email or PIN' });
}

// 5. Reset attempts on success
await db.execute('UPDATE user_pins SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?', [user.id]);

// 6. Check 2FA — PIN does NOT bypass 2FA
if (twoFactorRow?.is_enabled) {
  // Issue temp_token + auto-send push/OTP (same as password login)
  return res.json({ requires_2fa: true, temp_token, ... });
}

// 7. No 2FA — issue JWT directly
const token = signAccessToken({ userId: user.id });
const frontendUser = await buildFrontendUser(user.id);
return res.json({ success: true, data: { token, user: frontendUser } });
```

```typescript
// Frontend: Returning user detection
const lastEmail = AuthModel.getLastEmail(); // localStorage
if (lastEmail) {
  const { has_pin } = await AuthModel.checkPinByEmail(lastEmail);
  if (has_pin) {
    // Show PIN pad instead of password form
    setLoginMode('pin');
  }
}
// "Not you?" → clears lastEmail, shows normal login
// "Use password instead" → switches to password form
```

**Security Model:**

| Aspect | Implementation |
|--------|---------------|
| PIN storage | bcrypt (10 rounds) — same as passwords |
| Brute force | 5 failed attempts → 15-minute lockout (per-user, not per-IP) |
| Error messages | Deliberately vague — "Invalid email or PIN" for all failure modes |
| 2FA integration | PIN does NOT bypass 2FA — if 2FA is enabled, PIN login triggers the same 2FA flow as password login |
| Email enumeration | `GET /pin/check/:email` returns `{ has_pin: false }` for non-existent emails (doesn't reveal existence) |
| PIN complexity | 4 digits (10,000 combinations) — acceptable given lockout policy |
| Table creation | Auto-migration with explicit collation matching `users.id` column |

**Benefits:**
- ✅ Zero backend changes needed for existing auth — purely additive
- ✅ PIN is an alternative to password, not a replacement — full password login always available
- ✅ 2FA not bypassed — same security guarantees as password login
- ✅ UPSERT handles set/change in single query — no separate "update" vs "create" logic
- ✅ Per-user lockout tracks attempts in DB — survives server restarts, not bypassable by switching IPs
- ✅ Auto-migration on module load — no manual migration step required
- ✅ Collation explicitly set — prevents FK mismatch with `users.id` on MySQL 8.0 (utf8mb4_0900_ai_ci default vs utf8mb4_unicode_ci)
- ✅ Returning user detection via localStorage — seamless UX for repeat visitors
- ✅ Frontend auto-submits on 4th digit — fastest possible PIN entry

**Drawbacks:**
- ❌ 4-digit PIN has only 10,000 combinations — relying entirely on lockout policy for brute force protection
- ❌ No server-side rate limiting on `/pin/verify` — only per-user lockout (no IP-based throttling)
- ❌ `lastEmail` in localStorage — reveals which email was used on this browser (acceptable for trusted devices)
- ❌ No PIN expiry — PIN remains valid indefinitely (user must manually remove)
- ❌ No PIN change notification — user not notified via email when PIN is changed

---

### 2.13 Google OAuth2 SSO Pattern (v2.0.0)

**Context:** Users want to sign in with their existing Google account for convenience and reduced friction. The system must support both a server-side redirect flow (for web) and a stateless token verification flow (for mobile/SPA).

**Implementation:**

```
Dual Flow Architecture:

Flow 1 — Web (Server-Side Redirect):
  GET /auth/google
    → Generate random state
    → Set state as httpOnly cookie (CSRF protection)
    → Build Google consent URL with scopes: openid, email, profile
    → Return URL to frontend

  Frontend redirects browser to Google consent URL (window.location.href)

  GET /auth/google/callback?code=...&state=...
    → Verify state matches cookie (CSRF check)
    → Clear state cookie
    → Exchange code for tokens via OAuth2Client.getToken()
    → Verify ID token via OAuth2Client.verifyIdToken()
    → Extract sub, email, name, picture from payload
    → Lookup/create/link user (see below)
    → Sign JWT via signAccessToken()
    → Redirect to ${frontendOrigin}/auth/oauth-callback?token=<jwt>

  OAuthCallback.tsx
    → Read ?token= from URL
    → Store JWT in localStorage
    → Fetch profile via /auth/me
    → Set Zustand store state
    → Navigate to /dashboard

Flow 2 — Mobile/SPA (Token Verification):
  POST /auth/google/token { id_token: '...' }
    → Verify ID token via OAuth2Client.verifyIdToken()
    → Extract sub, email, name, picture
    → Lookup/create/link user (see below)
    → Return { token: '<jwt>', user: {...} }

User Lookup/Link/Create Logic (shared):
  1. SELECT * FROM users WHERE oauth_provider='google' AND oauth_provider_id=sub
  2. If found → use existing user
  3. If not → SELECT * FROM users WHERE email=payload.email
  4. If email match → UPDATE users SET oauth_provider='google', oauth_provider_id=sub
  5. If no match → Transaction: INSERT contact, user (passwordHash=''), team, team_member, user_roles, activation_key
```

**Auto-Migration:**

```typescript
async function ensureOAuthColumns() {
  const [cols] = await db.execute(`SHOW COLUMNS FROM users LIKE 'oauth_provider'`);
  if ((cols as any[]).length === 0) {
    await db.execute(`ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(20) NULL AFTER is_staff`);
    await db.execute(`ALTER TABLE users ADD COLUMN oauth_provider_id VARCHAR(255) NULL AFTER oauth_provider`);
    await db.execute(`ALTER TABLE users ADD INDEX idx_oauth (oauth_provider, oauth_provider_id)`);
  }
}
ensureOAuthColumns().catch((e) => console.warn('[OAuth] migration:', e));
```

**Security Measures:**

| Measure | Implementation |
|---------|---------------|
| CSRF protection | Random `state` param set as httpOnly cookie, verified on callback |
| Token verification | `google-auth-library` checks signature, audience, issuer, expiry |
| OAuth-only accounts | Empty `passwordHash` (`''`) prevents password/PIN login |
| Email auto-linking | Existing accounts linked by exact email match only |
| No user enumeration | OAuth creates accounts silently — no error if email exists/doesn't exist |

**Benefits:**
- ✅ Dual flow supports web, mobile, and SPA clients with the same backend
- ✅ Auto-migration adds columns on startup — no manual DDL required
- ✅ Auto-linking prevents duplicate accounts when existing users try Google sign-in
- ✅ OAuth-only accounts cannot use password reset or PIN — no orphaned credentials
- ✅ CSRF state cookie prevents redirect-based attacks
- ✅ `google-auth-library` handles all cryptographic verification — no custom JWT/OIDC parsing
- ✅ Full transaction on user creation — same atomicity guarantees as regular registration
- ✅ Frontend uses `window.location.href` redirect — works with all browsers, no popup issues
- ✅ OAuthCallback.tsx provides loading/error states — user never sees a blank screen

**Drawbacks:**
- ❌ OAuth-only accounts cannot set a password later — no "add password" flow exists yet
- ❌ No Google account unlinking UI — once linked, cannot be unlinked through the frontend
- ❌ `google-auth-library` is an additional dependency (~2MB)
- ❌ If Google is down, OAuth-only users cannot login at all (no fallback)
- ❌ No 2FA integration for OAuth login — Google's own 2FA is relied upon instead

---

## 3. Anti-Patterns Found

### 3.1 Sequential Queries in buildFrontendUser

**Description:** 3 sequential database queries to build a single user object.

**Current Code (v1.6.0):**

```typescript
// Query 1: User data + is_admin/is_staff from users table columns
const user = await db.queryOne('SELECT id, email, name, ..., is_admin, is_staff FROM users WHERE id = ?', [userId]);
// Query 2: Role name/slug for display (user_roles is now supplementary)
const roleRow = await db.queryOne('SELECT ... FROM user_roles JOIN roles ...', [userId]);
// Query 3: Granular permissions
const permissions = await db.query('SELECT ... FROM role_permissions JOIN permissions ...', [roleId]);
```

**Impact:** 🟡 WARNING — 3 round trips to MySQL per login/me request. Under load, this multiplies connection usage. Note: admin/staff detection no longer depends on the role query (v1.6.0+), but the query is still needed for role display name and permission resolution.

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

**Description:** The user_roles query uses explicit `COLLATE utf8mb4_unicode_ci` to work around a collation mismatch. Note: since v1.6.0, `buildFrontendUser()` no longer uses this query for admin/staff detection (reads from `users` columns directly), but the collation hack remains in the role name/slug lookup.

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
