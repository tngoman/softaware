# Authentication Module - File Inventory

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 16 |
| **Total LOC** | ~3,900 |
| **Backend files** | 6 (~1,380 LOC) |
| **Frontend files** | 10 (~2,500 LOC) |

### Directory Tree

```
Backend:
  src/routes/auth.ts                       (283 LOC)
  src/routes/twoFactor.ts                  (674 LOC) — multi-method 2FA
  src/routes/email.ts                      (178 LOC) — email endpoints
  src/services/emailService.ts             (256 LOC) — centralized email transport
  src/routes/adminClientManager.ts         (~60 LOC masquerade endpoint)
  src/middleware/requireAdmin.ts           (55 LOC)

Frontend:
  src/pages/public/AuthPage.tsx            (631 LOC) — login/register + 2FA verify
  src/pages/auth/Login.tsx                 (300 LOC) — legacy login + 2FA verify
  src/pages/ForgotPassword.tsx             (302 LOC)
  src/pages/admin/ClientManager.tsx         (~40 LOC masquerade handler)
  src/hooks/useAuth.ts                     (43 LOC)
  src/models/AuthModel.ts                  (280 LOC) — auth + 2FA API methods
  src/components/TwoFactorSetup.tsx        (325 LOC) — reusable 2FA management
  src/pages/general/AccountSettings.tsx    (246 LOC) — 2FA for staff/admin
  src/pages/portal/Settings.tsx            (193 LOC) — 2FA for clients
  src/pages/system/SystemSettings.tsx      (795 LOC) — SMTP config tab
  src/components/Layout/Layout.tsx          (~50 LOC masquerade banner)
  src/components/Layout/PortalLayout.tsx    (~50 LOC masquerade banner)
```

---

## 2. Backend Files

### 2.1 `src/routes/auth.ts` — Core Auth Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/auth.ts` |
| **LOC** | 283 |
| **Purpose** | Registration, login (with multi-method 2FA gate), token refresh, user profile resolution, permissions, masquerade exit |
| **Dependencies** | bcryptjs, jsonwebtoken, zod, db/mysql, middleware/auth, config/env, utils/httpErrors |
| **Exports** | `authRouter`, `buildFrontendUser` |

#### Methods / Functions

| Function | Params | Returns | Description | DB Queries |
|----------|--------|---------|-------------|------------|
| `buildFrontendUser(userId)` | `userId: string` | Frontend user object or null | Resolves user → user_roles → role → permissions into frontend-compatible shape. No team dependency. | `SELECT FROM users`, `SELECT FROM user_roles JOIN roles`, `SELECT FROM role_permissions JOIN permissions` |
| `generateActivationKey(email)` | `email: string` | `string` (e.g., `USER-A3F1B2C8D4E5F6A7`) | SHA-256 hash of email + timestamp, truncated to 16 hex chars | — |

#### Endpoints

| Method | Path | Auth | Handler LOC |
|--------|------|------|------------|
| GET | /auth/me | requireAuth | L93-107 |
| POST | /auth/logout | requireAuth | L109-112 |
| POST | /auth/register | None | L124-173 |
| POST | /auth/login | None | L181-244 |
| POST | /auth/refresh | None | L247-258 |
| GET | /auth/permissions | requireAuth | L261-273 |
| POST | /auth/masquerade/exit | None (restore token) | L276-321 |

#### Code Excerpt — buildFrontendUser

```typescript
export async function buildFrontendUser(userId: string) {
  const user = await db.queryOne<User>(
    'SELECT id, email, name, phone, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?',
    [userId]
  );
  if (!user) return null;

  // Resolve role from user_roles table (no team dependency)
  const roleRow = await db.queryOne<{ role_id: number; role_name: string; role_slug: string }>(
    `SELECT r.id AS role_id, r.name AS role_name, r.slug AS role_slug
     FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
     LIMIT 1`,
    [userId]
  );

  // Fallback: users without a user_roles entry get 'client' role
  const userRole = roleRow
    ? { id: roleRow.role_id, name: roleRow.role_name, slug: roleRow.role_slug }
    : { id: 0, name: 'Client', slug: 'client' };

  const isAdmin = userRole.slug === 'admin' || userRole.slug === 'super_admin';
  const isStaff = ['developer', 'client_manager', 'qa_specialist', 'deployer'].includes(userRole.slug);

  // Admin/staff get wildcard; others get granular permissions
  // Returns: { id, email, name, avatar, is_admin, is_staff, role, permissions }
}
```

#### Code Excerpt — Registration Transaction

```typescript
const result = await db.transaction(async (conn) => {
  const userId = generateId();
  const teamId = generateId();
  const memberId = generateId();
  const keyId = generateId();
  const now = toMySQLDate(new Date());

  await conn.execute('INSERT INTO users ...', [userId, email, passwordHash, now, now]);

  // Legacy: team + membership kept for credit balance scoping
  await conn.execute('INSERT INTO teams ...', [teamId, teamName, userId, now, now]);
  await conn.execute('INSERT INTO team_members ...', [memberId, teamId, userId, 'OPERATOR', now]);

  // Role assignment via user_roles (the authoritative source)
  const [viewerRole] = await conn.execute('SELECT id FROM roles WHERE slug = ? LIMIT 1', ['viewer']);
  await conn.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, viewerRole[0].id]);

  await conn.execute('INSERT INTO activation_keys ...', [keyId, keyCode, 'PERSONAL', ...]);

  return { user, activationKey };
});
```

---

### 2.2 `src/routes/twoFactor.ts` — Multi-Method Two-Factor Authentication

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/twoFactor.ts` |
| **LOC** | 665 |
| **Purpose** | Multi-method 2FA (TOTP / Email OTP / SMS OTP) setup, verification, method switching, backup code management, role-based enforcement |
| **Dependencies** | otpauth, qrcode, crypto, bcryptjs, jsonwebtoken, zod, db/mysql, middleware/auth, auth.ts (buildFrontendUser), services/emailService (sendTwoFactorOtp) |
| **Exports** | `twoFactorRouter` |

#### Methods / Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `generateBackupCodes()` | — | `string[]` (10 items) | 10 random 8-char hex codes (e.g., `A3F1B2C8`) |
| `createTOTP(secretBase32, userEmail)` | secret, email | `TOTP` instance | Creates OTPAuth TOTP with SHA1, 6 digits, 30s period |
| `generateOTP()` | — | `string` (6 digits) | Random 6-digit numeric code for email/SMS |
| `sendSms(phone, message)` | phone, message | `void` | Stub for SMS delivery (implementation TBD) |

#### Endpoints

| Method | Path | Auth | Handler LOC |
|--------|------|------|------------|
| GET | /auth/2fa/status | requireAuth | ~L60-90 |
| POST | /auth/2fa/setup | requireAuth | ~L95-200 |
| POST | /auth/2fa/verify-setup | requireAuth | ~L205-280 |
| POST | /auth/2fa/verify | None (temp_token) | ~L285-420 |
| POST | /auth/2fa/send-otp | None (temp_token) | ~L425-480 |
| POST | /auth/2fa/disable | requireAuth | ~L485-530 |
| PUT | /auth/2fa/method | requireAuth | ~L535-610 |
| POST | /auth/2fa/backup-codes | requireAuth | ~L615-665 |

#### Code Excerpt — Multi-Method Verification

```typescript
// Determine verification strategy based on preferred method
const method = twoFactorRow.preferred_method || 'totp';
let isValid = false;
let usedBackupCode = false;

if (method === 'totp' && input.code.length === 6 && /^\d+$/.test(input.code)) {
  const totp = createTOTP(twoFactorRow.secret, user.email);
  const delta = totp.validate({ token: input.code, window: 1 });
  isValid = delta !== null;
} else if ((method === 'email' || method === 'sms') && input.code.length === 6) {
  // Verify OTP code stored in DB
  if (twoFactorRow.otp_code && twoFactorRow.otp_expires_at) {
    const now = new Date();
    const expires = new Date(twoFactorRow.otp_expires_at);
    if (now <= expires && twoFactorRow.otp_code === input.code) {
      isValid = true;
      // Clear used OTP
      await db.execute('UPDATE user_two_factor SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?', [userId]);
    }
  }
}

// Backup code fallback (works for any method)
if (!isValid) {
  const codeHash = crypto.createHash('sha256').update(input.code.toUpperCase()).digest('hex');
  const backupCodes = twoFactorRow.backup_codes ? JSON.parse(twoFactorRow.backup_codes) : [];
  const matchIdx = backupCodes.findIndex((bc: any) => bc.code === codeHash && !bc.used);
  if (matchIdx !== -1) {
    isValid = true;
    usedBackupCode = true;
    backupCodes[matchIdx].used = true;
    await db.execute('UPDATE user_two_factor SET backup_codes = ? WHERE user_id = ?',
      [JSON.stringify(backupCodes), userId]);
  }
}
```

---

### 2.3 `src/middleware/requireAdmin.ts` — Admin Gate Middleware

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/requireAdmin.ts` |
| **LOC** | 55 |
| **Purpose** | Express middleware that gates routes to admin/super_admin users only |
| **Dependencies** | db/mysql, utils/httpErrors |
| **Exports** | `requireAdmin` |

#### Methods / Functions

| Function | Params | Returns | Description | DB Queries |
|----------|--------|---------|-------------|------------|
| `requireAdmin` | `(req, res, next)` | void (calls `next()` or throws 403) | Checks `user_roles` JOIN `roles` for `admin` or `super_admin` slug | `SELECT FROM user_roles JOIN roles WHERE user_id = ? AND slug IN ('admin','super_admin')` |

#### Code Excerpt — Admin Check

```typescript
const adminRow = await db.queryOne<{ slug: string }>(
  `SELECT r.slug FROM user_roles ur
   JOIN roles r ON r.id = ur.role_id
   WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
   AND r.slug IN ('admin', 'super_admin')
   LIMIT 1`,
  [req.user.id]
);

if (!adminRow) {
  throw new ForbiddenError('Admin access required');
}
next();
```

---

### 2.4 `src/services/emailService.ts` — Centralized Email Transport

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/emailService.ts` |
| **LOC** | 256 |
| **Purpose** | Centralized nodemailer email service. Reads SMTP credentials from the `credentials` table (AES-256-GCM encrypted), with fallback to env vars. Caches transporter. Logs all sends to `email_log` table. |
| **Dependencies** | nodemailer, crypto, db/mysql, config/env (ENCRYPTION_KEY) |
| **Exports** | `EmailOptions`, `EmailResult`, `invalidateTransporter`, `sendEmail`, `sendTestEmail`, `sendTwoFactorOtp`, `emailService` |

#### Exported Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `sendEmail(options)` | `EmailOptions` (to, subject, html?, text?) | `Promise<EmailResult>` | Send email, log result to `email_log`, return messageId |
| `sendTestEmail(to, subject?, body?)` | to, optional subject/body | `Promise<EmailResult>` | Send a test email with default subject/body |
| `sendTwoFactorOtp(to, code)` | email, 6-digit code | `Promise<EmailResult>` | Send 2FA OTP email with branded HTML template |
| `invalidateTransporter()` | — | `void` | Clear cached transporter (called after SMTP config update) |

#### Internal Functions

| Function | Description |
|----------|-------------|
| `getSmtpConfig()` | Reads from `credentials` WHERE `service_name = 'SMTP'`, decrypts AES-256-GCM, falls back to env vars |
| `getTransporter()` | Lazy-creates and caches nodemailer transporter from SMTP config |
| `logEmail(to, subject, status, messageId?, error?)` | INSERT into `email_log` table |

#### Encryption Pattern

```typescript
// Decrypt AES-256-GCM credentials from DB
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
let decrypted = decipher.update(encrypted, 'hex', 'utf8');
decrypted += decipher.final('utf8');
const config = JSON.parse(decrypted);
```

---

### 2.5 `src/routes/email.ts` — Email Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/email.ts` |
| **LOC** | 178 |
| **Purpose** | Admin SMTP config management, test email sending, email log viewing |
| **Dependencies** | db/mysql, middleware/auth (requireAuth), middleware/requireAdmin, services/emailService, crypto, config/env |
| **Exports** | `emailRouter` |

#### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /email/test | requireAuth + requireAdmin | Send test email |
| POST | /email/send | requireAuth | Send email |
| GET | /email/config | requireAuth + requireAdmin | Get SMTP config (password masked) |
| PUT | /email/config | requireAuth + requireAdmin | Upsert SMTP credentials (AES-256-GCM) |
| GET | /email/logs | requireAuth + requireAdmin | View email send log with pagination |

---

## 3. Frontend Files

### 3.1 `src/pages/public/AuthPage.tsx` — Primary Login / Register Page

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/public/AuthPage.tsx` |
| **LOC** | 631 |
| **Route** | `/login`, `/register` |
| **Purpose** | Unified tabbed login/registration page with email auto-append and multi-method 2FA verification step |
| **Dependencies** | react-router-dom, AuthModel, useAppStore, useAppSettings, sweetalert2 |
| **Component** | `AuthPage` (React.FC, default export) |

#### Key Behaviors

| Behavior | Description |
|----------|-------------|
| Auto-redirect | If `isAuthenticated`, navigates to `/dashboard` |
| Tabbed UI | Sign In / Create Account tabs, synced with URL |
| Email auto-append | If login input has no `@`, appends `@softaware.co.za` before submitting |
| Email field type | `type="text"` (not `email`) to allow plain usernames |
| Placeholder | `you@youremail.com` |
| Login flow | Calls `AuthModel.login(finalEmail, password)` → stores token → fetches permissions → navigates |
| **2FA step** | If `requires_2fa` returned, shows verification UI based on `two_factor_method` (totp/email/sms) |
| **2FA resend** | For email/SMS, "Resend verification code" button calls `AuthModel.resend2FAOtp()` |
| Error display | Inline red error box |
| Registration | Name + email + password + confirm → `AuthModel.register()` → confirmation screen |

#### 2FA State

```typescript
const [twoFaRequired, setTwoFaRequired] = useState(false);
const [twoFaMethod, setTwoFaMethod] = useState<'totp' | 'email' | 'sms'>('totp');
const [twoFaTempToken, setTwoFaTempToken] = useState('');
const [twoFaCode, setTwoFaCode] = useState('');
const [twoFaVerifying, setTwoFaVerifying] = useState(false);
const [twoFaError, setTwoFaError] = useState('');
const [twoFaResending, setTwoFaResending] = useState(false);
```

---

### 3.2 `src/pages/auth/Login.tsx` — Legacy Billing Login Page

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/auth/Login.tsx` |
| **LOC** | 296 |
| **Route** | `/billing-login` |
| **Purpose** | Legacy login form with email auto-append, branding, redirect if authenticated, multi-method 2FA verification step |
| **Dependencies** | react-router-dom, AuthModel, AppSettingsModel, useAppStore, sweetalert2 |
| **Component** | `Login` (React.FC, default export) |

#### Key Behaviors

| Behavior | Description |
|----------|-------------|
| Auto-redirect | If `isAuthenticated`, navigates to `/dashboard` |
| Branding | Loads logo/name/description from localStorage cache + API |
| Email auto-append | If login input has no `@`, appends `@softaware.co.za` before submitting |
| Email field type | `type="text"` (not `email`) to allow plain usernames |
| Placeholder | `you@youremail.com` |
| Login flow | Calls `AuthModel.login(finalEmail, password)` → stores token → fetches permissions → navigates |
| **2FA step** | If `requires_2fa` returned, shows verification UI based on `two_factor_method` (totp/email/sms) |
| **2FA resend** | For email/SMS, "Resend verification code" button calls `AuthModel.resend2FAOtp()` |
| Error display | SweetAlert2 popup with API error message |
| Loading state | Disables inputs, shows spinner during login |

---

### 3.3 `src/pages/ForgotPassword.tsx` — Password Reset Page

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/ForgotPassword.tsx` |
| **LOC** | 302 |
| **Purpose** | 3-step password reset: email → OTP → new password |
| **Dependencies** | react-router-dom, AuthModel, AppSettingsModel, sweetalert2 |
| **Component** | `ForgotPassword` (React.FC, default export) |

#### Steps (state machine)

| Step | State | User Action | API Call |
|------|-------|-------------|----------|
| 1 | `'email'` | Enter email → Submit | `AuthModel.forgotPassword(email)` |
| 2 | `'otp'` | Enter 6-digit OTP → Verify | `AuthModel.verifyOTP(email, otp)` |
| 3 | `'reset'` | Enter new password (2×) → Reset | `AuthModel.resetPassword(email, otp, password)` |

#### Key Behaviors

| Behavior | Description |
|----------|-------------|
| OTP input | Numeric only, max 6 digits, centered tracking-widest |
| No enumeration | Always shows "If email exists, OTP sent" regardless of API result |
| Password validation | Min 8 chars, must match confirmation |
| Post-reset | 3-second SweetAlert2 success, then redirect to /login |

---

### 3.4 `src/hooks/useAuth.ts` — Auth Initialization Hook

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/hooks/useAuth.ts` |
| **LOC** | 43 |
| **Purpose** | On app load, validates existing JWT and restores auth state |
| **Dependencies** | useAppStore, AuthModel |
| **Exports** | `useAuth` |

#### Logic

```
1. Check localStorage for jwt_token
2. If no token → clear auth state
3. If token exists → call GET /auth/me
4. If valid → update store with user data
5. If expired/invalid → clear localStorage + store
```

---

### 3.5 `src/models/AuthModel.ts` — Auth API Client

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/models/AuthModel.ts` |
| **LOC** | 270 |
| **Purpose** | Static class wrapping all auth, 2FA, and masquerade API calls plus localStorage management |
| **Dependencies** | services/api.ts (Axios), types/User |
| **Exports** | `AuthModel` (class), `TwoFactorStatus` (interface), `TwoFactorSetupResult` (interface) |

#### Auth Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `login(email, password)` | POST | /auth/login | Returns { token, user } or { requires_2fa, temp_token, two_factor_method } |
| `register(data)` | POST | /auth/register | Returns { token, user } |
| `logout()` | POST | /auth/logout | Server-side acknowledgement |
| `me()` | GET | /auth/me | Returns { user } with permissions |
| `getUserPermissions()` | GET | /auth/permissions | Returns permission array |
| `updateProfile(data)` | PUT | /auth/profile | Update user profile |
| `changePassword(data)` | PUT | /auth/change-password | Change password |
| `forgotPassword(email)` | POST | /auth/forgot-password | Send OTP |
| `verifyOTP(email, otp)` | POST | /auth/verify-otp | Verify OTP |
| `resetPassword(email, otp, password)` | POST | /auth/reset-password | Reset with OTP |

#### 2FA Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `get2FAStatus()` | GET | /auth/2fa/status | Returns `TwoFactorStatus` (is_enabled, preferred_method, is_required, available_methods) |
| `setup2FA(method)` | POST | /auth/2fa/setup | Returns `TwoFactorSetupResult` (method, secret?, qr_code?, otpauth_url?) |
| `verifySetup2FA(code)` | POST | /auth/2fa/verify-setup | Returns backup_codes array |
| `verify2FA(tempToken, code)` | POST | /auth/2fa/verify | Returns { token, user } after login 2FA |
| `resend2FAOtp(tempToken)` | POST | /auth/2fa/send-otp | Resend OTP for email/SMS during login |
| `disable2FA(password)` | POST | /auth/2fa/disable | Disable 2FA (clients only) |
| `change2FAMethod(method, password, code)` | PUT | /auth/2fa/method | Change preferred method |
| `regenerateBackupCodes(password)` | POST | /auth/2fa/backup-codes | Generate new backup codes |

#### Masquerade Methods

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `startMasquerade(token, user, adminRestoreToken, adminId)` | — | — | Store masquerade state in localStorage |
| `isMasquerading()` | — | — | Check if masquerade session is active |
| `getMasqueradeAdminId()` | — | — | Get the original admin's user ID |
| `exitMasquerade()` | POST | /auth/masquerade/exit | Restore admin session, clear masquerade state |
| `clearMasquerade()` | — | — | Remove masquerade keys from localStorage |

#### Storage Methods

| Method | Description |
|--------|-------------|
| `storeAuth(token, user)` | Saves JWT and user to localStorage |
| `clearAuth()` | Removes JWT and user from localStorage |
| `getToken()` | Returns stored JWT or null |
| `getUser()` | Returns parsed user or null (handles corrupt JSON) |
| `isAuthenticated()` | Returns boolean based on token presence |
| `clearMasquerade()` | Removes masquerade-specific keys (admin restore token, admin ID) from localStorage |

#### Code Excerpt — Masquerade Lifecycle

```typescript
// Start masquerade — store both tokens, switch active session
static startMasquerade(token: string, user: User, adminRestoreToken: string, adminId: string) {
  localStorage.setItem('masquerade_admin_restore_token', adminRestoreToken);
  localStorage.setItem('masquerade_admin_id', adminId);
  this.storeAuth(token, user);  // overwrites jwt_token + user
}

// Exit masquerade — POST to backend, restore admin session
static async exitMasquerade(): Promise<{ token: string; user: User }> {
  const adminRestoreToken = localStorage.getItem('masquerade_admin_restore_token');
  if (!adminRestoreToken) throw new Error('No masquerade session to exit');

  const response = await api.post('/auth/masquerade/exit', { adminRestoreToken });

  localStorage.removeItem('masquerade_admin_restore_token');
  localStorage.removeItem('masquerade_admin_id');

  const { token, user } = response.data.data;
  this.storeAuth(token, user);  // restores admin session
  return { token, user };
}
```

---

### 3.6 `src/pages/admin/ClientManager.tsx` — Masquerade Handler (partial)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/admin/ClientManager.tsx` |
| **Auth-relevant LOC** | ~40 (masquerade handler + button) |
| **Purpose** | Admin client management page with "Login as this User" masquerade trigger |
| **Dependencies** | AdminClientModel, AuthModel, useAppStore, useNavigate, sweetalert2 |

#### Masquerade Handler

```typescript
const handleMasquerade = async (userId: string, email: string) => {
  const result = await Swal.fire({
    title: 'Login as User?',
    html: `You will be logged in as <strong>${email}</strong>.<br/><br/>
           A banner will appear at the top of the page to return to your admin session.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#7C3AED',  // purple
    confirmButtonText: 'Login as User',
  });
  if (!result.isConfirmed) return;

  const response = await AdminClientModel.masquerade(userId);
  if (response.success && response.data) {
    const { token, user, adminRestoreToken, adminId } = response.data;
    AuthModel.startMasquerade(token, user, adminRestoreToken, adminId);
    // Fetch permissions for the target user
    const permissions = await AuthModel.getUserPermissions();
    user.permissions = permissions;
    AuthModel.storeAuth(token, user);
    setUser(user);
    setIsAuthenticated(true);
    navigate('/dashboard');
  }
};
```

#### UI Element

- **"Login as this User" button:** Purple-themed button with `ArrowRightOnRectangleIcon`, shown in the client detail panel when a client is selected.

---

### 3.7 `src/components/Layout/Layout.tsx` — Masquerade Banner (partial)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/Layout/Layout.tsx` |
| **Auth-relevant LOC** | ~50 (state, handler, banner JSX) |
| **Purpose** | Admin/staff layout with masquerade detection and "Return to Admin" banner |
| **Used when** | Masquerading as a user who has admin or staff role (renders via `SmartDashboard` when `user.is_admin \|\| user.is_staff`) |
| **Dependencies** | AuthModel, useAppStore, useNavigate |

#### State & Effects

```typescript
const [isMasquerading, setIsMasquerading] = useState(false);
const [exitingMasquerade, setExitingMasquerade] = useState(false);

useEffect(() => {
  setIsMasquerading(AuthModel.isMasquerading());
}, [user]);
```

#### Exit Handler

```typescript
const handleExitMasquerade = async () => {
  setExitingMasquerade(true);
  try {
    const { token, user: adminUser } = await AuthModel.exitMasquerade();
    const permissions = await AuthModel.getUserPermissions();
    adminUser.permissions = permissions;
    AuthModel.storeAuth(token, adminUser);
    setUser(adminUser);
    setIsAuthenticated(true);
    setIsMasquerading(false);
    navigate('/admin/clients');
  } catch (error) {
    AuthModel.clearAuth();
    logout();
    navigate('/login');
  } finally {
    setExitingMasquerade(false);
  }
};
```

#### Banner JSX

- **Purple banner** (`bg-purple-600`) fixed at the top of the main content area
- Shows: `EyeIcon` + "You are viewing as **{user.email}** (masquerade mode)"
- **"Return to Admin" button** with `ArrowUturnLeftIcon`, loading spinner during exit
- Only rendered when `isMasquerading === true`

---

### 3.8 `src/components/Layout/PortalLayout.tsx` — Masquerade Banner (partial)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/Layout/PortalLayout.tsx` |
| **Auth-relevant LOC** | ~50 (state, handler, banner JSX) |
| **Purpose** | Client portal layout with masquerade detection and "Return to Admin" banner |
| **Used when** | Masquerading as a client user (non-admin, non-staff) — renders via `SmartDashboard` when `!user.is_admin && !user.is_staff` |
| **Dependencies** | AuthModel, useAppStore, useNavigate |
| **Added in** | v1.3.0 — previously this layout had no masquerade support, trapping admins in client view |

#### State & Effects

```typescript
const [isMasquerading, setIsMasquerading] = useState(false);
const [exitingMasquerade, setExitingMasquerade] = useState(false);

useEffect(() => {
  setIsMasquerading(AuthModel.isMasquerading());
}, [user]);
```

#### Exit Handler

Identical to `Layout.tsx`:

```typescript
const handleExitMasquerade = async () => {
  setExitingMasquerade(true);
  try {
    const { token, user: adminUser } = await AuthModel.exitMasquerade();
    const permissions = await AuthModel.getUserPermissions();
    adminUser.permissions = permissions;
    AuthModel.storeAuth(token, adminUser);
    setUser(adminUser);
    setIsAuthenticated(true);
    setIsMasquerading(false);
    navigate('/admin/clients');
  } catch (error) {
    AuthModel.clearAuth();
    logout();
    navigate('/login');
  } finally {
    setExitingMasquerade(false);
  }
};
```

#### Banner JSX

- **Identical to `Layout.tsx` banner** — purple `bg-purple-600`, `EyeIcon`, "Return to Admin" button
- Positioned above the header inside the main content column
- Only rendered when `isMasquerading === true`

---

### 3.9 `src/models/AdminAIModels.ts` — Masquerade API Call (partial)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/models/AdminAIModels.ts` |
| **Auth-relevant LOC** | ~15 (masquerade method) |
| **Purpose** | Admin model with `masquerade()` method that calls the backend endpoint |

#### Method

```typescript
static async masquerade(userId: number | string) {
  const res = await api.post<{
    success: boolean;
    message: string;
    data: {
      token: string;
      user: any;
      adminRestoreToken: string;
      masquerading: boolean;
      adminId: string;
      targetUser: { id: string; email: string; name: string };
    };
  }>(`/admin/clients/${userId}/masquerade`);
  return res.data;
}
```

---

### 3.10 `src/components/TwoFactorSetup.tsx` — Reusable 2FA Management Component

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/TwoFactorSetup.tsx` |
| **LOC** | 310 |
| **Purpose** | Reusable component for 2FA setup, verification, method change, disable, and backup code management. Role-aware: adapts available methods and disable capability based on `isStaffOrAdmin` prop. |
| **Dependencies** | AuthModel, @heroicons/react, sweetalert2 |
| **Component** | `TwoFactorSetup` (React.FC) |
| **Props** | `{ isStaffOrAdmin?: boolean }` |
| **Added in** | v1.4.0 |

#### Key Behaviors

| Behavior | Description |
|----------|-------------|
| Status fetch | On mount, calls `AuthModel.get2FAStatus()` → shows current state |
| Method selection | Staff/admin: TOTP, Email, SMS. Clients: TOTP, Email only. |
| TOTP setup | Displays QR code from `AuthModel.setup2FA('totp')` → user scans + enters code |
| Email/SMS setup | Calls `AuthModel.setup2FA('email'\|'sms')` → auto-sends OTP → user enters code |
| Verify step | Calls `AuthModel.verifySetup2FA(code)` → shows 10 backup codes |
| Change method | Calls `AuthModel.change2FAMethod(method, password, code)` with SweetAlert2 password prompt |
| Disable | Clients only. SweetAlert2 password confirmation → `AuthModel.disable2FA(password)`. Blocked for staff/admin. |
| Regenerate backup codes | SweetAlert2 password prompt → `AuthModel.regenerateBackupCodes(password)` |

#### Used By

| Parent Component | Context |
|-----------------|---------|
| `AccountSettings.tsx` | Staff/admin 2FA (mandatory) — `<TwoFactorSetup isStaffOrAdmin={true} />` |
| `PortalSettings.tsx` | Client 2FA (optional) — `<TwoFactorSetup isStaffOrAdmin={false} />` |

---

### 3.11 `src/pages/general/AccountSettings.tsx` — Staff/Admin Account Settings

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/AccountSettings.tsx` |
| **LOC** | 246 |
| **Purpose** | Account settings page with Two-Factor Authentication card for staff/admin users |
| **Dependencies** | TwoFactorSetup, useAppStore |
| **2FA Card** | Renders `<TwoFactorSetup isStaffOrAdmin={isStaffOrAdmin} />` where `isStaffOrAdmin` is derived from `user.is_admin || user.is_staff` in the Zustand store |
| **Updated in** | v1.4.0 — added 2FA card |

---

### 3.12 `src/pages/portal/Settings.tsx` — Client Portal Settings

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/Settings.tsx` |
| **LOC** | 193 |
| **Purpose** | Portal settings page with Security tab containing 2FA setup for client users |
| **Dependencies** | TwoFactorSetup |
| **2FA Card** | Under Security tab, renders `<TwoFactorSetup isStaffOrAdmin={false} />` |
| **Updated in** | v1.4.0 — added 2FA card under Security tab |

---

### 3.13 `src/pages/system/SystemSettings.tsx` — SMTP Configuration Tab

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/system/SystemSettings.tsx` |
| **LOC** | 795 |
| **Purpose** | System settings page with SMTP configuration tab for admin users. Reads/writes SMTP credentials via `/email/config` and sends test emails via `/email/test`. |
| **Dependencies** | api.ts (Axios), @heroicons/react, sweetalert2 |
| **SMTP Tab Fields** | host, port, username, password, from_name, from_email, encryption (ssl/tls/none) |
| **Test Email** | Sends test email to specified address; shows success/failure SweetAlert2 |
| **Updated in** | v1.4.0 — SMTP settings moved from general Settings.tsx to SystemSettings.tsx |
