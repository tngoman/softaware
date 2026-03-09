# Authentication Module - Overview

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Module Overview

### Purpose

The Authentication module handles user registration, login, JWT token management, multi-method two-factor authentication (TOTP / Email / SMS), centralized email service, password reset via OTP, permission resolution, and admin masquerade (login-as-user). It is the entry point for every user session.

### Business Value

- Secure user identity verification (bcrypt + JWT)
- **Multi-method 2FA** — staff/admin: TOTP + email + SMS (mandatory); clients: TOTP + email (optional, encouraged)
- Centralized email service reading SMTP credentials from the `credentials` table (AES-256-GCM encrypted)
- Self-service password reset via email OTP
- Role-based permissions resolved at login and available throughout the session
- "Remember me" support (30-day tokens) for mobile/desktop clients
- Admin masquerade — login as any client to see their portal experience

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend source files | 6 (auth.ts, twoFactor.ts, email.ts, emailService.ts, requireAdmin.ts, adminClientManager.ts) |
| Backend LOC | ~1,380 (283 + 665 + 178 + 256) |
| Frontend source files | 12 (Login.tsx, AuthPage.tsx, ForgotPassword.tsx, useAuth.ts, AuthModel.ts, TwoFactorSetup.tsx, AccountSettings.tsx, PortalSettings.tsx, SystemSettings.tsx SMTP tab, ClientManager.tsx, Layout.tsx, PortalLayout.tsx) |
| Frontend LOC | ~2,500 |
| Total LOC | ~3,900 |
| API endpoints | 21 (11 core auth + 8 2FA + 5 email + 2 masquerade — some share base counts) |
| Database tables | 5 (users, user_two_factor, user_roles, sys_password_resets, email_log) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│                                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌────────────┐│
│  │ AuthPage.tsx│  │ Login.tsx     │  │ ForgotPassword.tsx│  │ useAuth.ts ││
│  │ login/reg   │  │ legacy login  │  │ email→OTP→reset  │  │ token check││
│  │ 2FA verify  │  │ 2FA verify    │  │ → AuthModel      │  │ → /auth/me ││
│  │ → AuthModel │  │ → AuthModel   │  │                  │  │            ││
│  └──────┬─────┘  └──────┬───────┘  └────────┬─────────┘  └──────┬─────┘│
│         │                │                    │                    │      │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  TwoFactorSetup.tsx — Reusable 2FA management component     │       │
│  │  Method selection (TOTP/email/SMS) | QR code | OTP verify   │       │
│  │  Backup codes | Enable/Disable/Change | Role-aware           │       │
│  └──────┬────────────────────┬──────────────────────────────────┘       │
│         │                    │                                           │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐      │
│  │AccountSettings│  │PortalSettings.tsx│  │SystemSettings.tsx    │      │
│  │ 2FA for       │  │ 2FA for clients  │  │ SMTP config tab      │      │
│  │ staff/admin   │  │ (optional)       │  │ → /email/config      │      │
│  └──────┬────────┘  └──────┬───────────┘  └──────┬───────────────┘      │
│         │                  │                      │                      │
│         ▼                  ▼                      ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  AuthModel.ts — Static API client class                        │    │
│  │  login() | register() | me() | forgotPassword() | verifyOTP()  │    │
│  │  resetPassword() | storeAuth() | clearAuth() | getToken()      │    │
│  │  getUserPermissions() | changePassword() | updateProfile()     │    │
│  │  startMasquerade() | exitMasquerade() | isMasquerading()       │    │
│  │  get2FAStatus() | setup2FA() | verifySetup2FA() | verify2FA()  │    │
│  │  resend2FAOtp() | disable2FA() | change2FAMethod()             │    │
│  │  regenerateBackupCodes()                                       │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
│                              │ Axios (api.ts)                            │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /auth/*  →  auth.ts (authRouter)                               │    │
│  │  POST /login     — bcrypt verify → 2FA check → JWT/temp_token  │    │
│  │                    (auto-sends OTP for email/SMS methods)       │    │
│  │  POST /register  — bcrypt hash → transaction (user+team+key)   │    │
│  │  GET  /me        — requireAuth → buildFrontendUser()           │    │
│  │  POST /logout    — acknowledgement (stateless JWT)             │    │
│  │  POST /refresh   — verify old JWT → issue new JWT              │    │
│  │  GET  /permissions — requireAuth → user permissions array      │    │
│  │  POST /masquerade/exit — restore admin session from masquerade │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /auth/2fa/*  →  twoFactor.ts (twoFactorRouter)                │    │
│  │  GET  /status        — 2FA status + preferred_method + avail.  │    │
│  │  POST /setup         — setup TOTP/email/SMS (method param)     │    │
│  │  POST /verify-setup  — verify code, enable 2FA, backup codes   │    │
│  │  POST /verify        — login 2FA (TOTP/email/SMS or backup)    │    │
│  │  POST /send-otp      — resend OTP during login (email/SMS)     │    │
│  │  POST /disable       — disable 2FA (clients only; blocked for  │    │
│  │                        staff/admin)                             │    │
│  │  PUT  /method        — change preferred 2FA method             │    │
│  │  POST /backup-codes  — password confirm → regenerate codes     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /email/*  →  email.ts (emailRouter)                            │    │
│  │  POST /test          — admin: send test email                  │    │
│  │  POST /send          — authenticated: send email               │    │
│  │  GET  /config        — admin: get SMTP config (password masked)│    │
│  │  PUT  /config        — admin: upsert SMTP credentials          │    │
│  │  GET  /logs          — admin: view email send log              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  emailService.ts — Centralized email transport                  │    │
│  │  Reads SMTP from credentials table (AES-256-GCM encrypted)    │    │
│  │  Fallback to env vars │ Caches transporter │ Logs to email_log │    │
│  │  sendEmail() | sendTestEmail() | sendTwoFactorOtp()            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐│
│  │ buildFrontendUser() │  │ signAccessToken()    │  │ requireAdmin()   ││
│  │ Resolves user +     │  │ JWT HS256 signing    │  │ user_roles check ││
│  │ role + permissions  │  │ Configurable expiry  │  │ admin/super_admin││
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /admin/clients/*  →  adminClientManager.ts (masquerade)        │    │
│  │  POST /:userId/masquerade — issue dual JWT (target + restore)  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MySQL — users, user_two_factor, user_roles, roles,                      │
│          role_permissions, permissions, sys_password_resets,              │
│          credentials (SMTP), email_log                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Guide

### Registration

1. User navigates to registration page (or calls `POST /auth/register`)
2. Provides email (unique), password (min 8 chars), optional team name
3. System creates: user → user_role (viewer) → activation_key in a transaction
4. Returns JWT access token + user object + activation key code

> **Note:** A legacy `teams` + `team_members` record is still created for backward compatibility with the credit balance system, but role/permission resolution uses `user_roles` exclusively.

### Login (Without 2FA)

1. User enters email/username + password on AuthPage.tsx (primary, at `/login`) or Login.tsx (legacy, at `/billing-login`)
2. If the input does not contain `@`, the frontend auto-appends `@softaware.co.za` (e.g., `john` → `john@softaware.co.za`)
3. Frontend calls `AuthModel.login(finalEmail, password)` → `POST /auth/login`
4. Backend verifies bcrypt hash
5. Checks if 2FA is enabled — if not, issues JWT immediately
6. Frontend stores token in localStorage, fetches permissions, navigates to `/dashboard`

> **Note:** The email field uses `type="text"` (not `type="email"`) to allow plain usernames. Placeholder: `you@youremail.com`.

### Login (With 2FA)

1. Steps 1-3 same as above
2. Backend detects 2FA enabled → determines `preferred_method` (totp, email, or sms)
3. For **email/SMS methods**: backend auto-sends OTP code via `sendTwoFactorOtp()` / `sendSms()`
4. Returns `{ requires_2fa: true, two_factor_method: 'totp'|'email'|'sms', temp_token: '...' }`
5. Frontend shows method-specific verification UI:
   - **TOTP:** "Enter the code from your authenticator app"
   - **Email:** "A verification code has been sent to your email"
   - **SMS:** "A verification code has been sent to your phone"
6. User enters 6-digit code (or 8-char backup code)
7. Frontend calls `POST /auth/2fa/verify` with temp_token + code
8. Backend verifies code (TOTP validate / OTP match / backup code hash) → issues full JWT
9. Login continues as normal

> **Resend:** For email/SMS methods, a "Resend verification code" button calls `POST /auth/2fa/send-otp` with the temp_token.

### 2FA Setup & Management

**Staff/Admin users:**
- **Required** — 2FA must be enabled; cannot be disabled
- **3 methods available:** TOTP (SoftAware App / Google Authenticator), Email, SMS
- Managed in **Account Settings** → Two-Factor Authentication card
- Can change method at any time (requires password + new verification)

**Client users:**
- **Encouraged** — blue banner recommends enabling 2FA, but not mandatory
- **2 methods available:** TOTP (SoftAware App) and Email
- Managed in **Portal Settings** → Security tab → Two-Factor Authentication card
- Can disable 2FA (requires password confirmation)

**Setup flow:**
1. User selects a method from the available options
2. **TOTP:** QR code displayed → scan with authenticator app → enter 6-digit code to verify
3. **Email/SMS:** OTP sent automatically → enter 6-digit code to verify
4. On successful verification → 2FA enabled, 10 backup codes displayed (save once)
5. Backup codes are SHA-256 hashed; each can be used once as a login fallback

### Password Reset

1. User clicks "Forgot password?" → navigates to ForgotPassword.tsx
2. **Step 1 (email):** Enters email → `POST /auth/forgot-password` → sends OTP via email
3. **Step 2 (OTP):** Enters 6-digit OTP → `POST /auth/verify-otp` → verified
4. **Step 3 (reset):** Enters new password (min 8 chars, confirmed) → `POST /auth/reset-password`
5. Redirected to login page after success

### Session Persistence

1. On app load, `useAuth` hook checks for existing JWT in localStorage
2. Calls `GET /auth/me` to validate token and fetch fresh user data
3. If valid → updates store, user remains logged in
4. If expired → clears localStorage, redirects to login

### Masquerade (Admin Login-as-User)

1. Admin navigates to **Admin → Client Manager** and selects a client
2. Clicks **"Login as this User"** → SweetAlert2 confirmation
3. Frontend calls `AdminClientModel.masquerade(userId)` → `POST /admin/clients/:userId/masquerade`
4. Backend verifies admin role, issues **two JWTs**:
   - A 1-hour token for the target user (masquerade session)
   - A 2-hour admin restore token (to return to admin session)
5. Frontend calls `AuthModel.startMasquerade()` which stores both tokens in localStorage
6. User/permissions updated in Zustand store, navigates to `/dashboard`
7. A **purple banner** appears at the top of every page: "You are viewing as **user@example.com** (masquerade mode)"
   - For admin/staff users the banner is rendered by `Layout.tsx`
   - For client users the banner is rendered by `PortalLayout.tsx`
   - Both layouts detect masquerade state via `AuthModel.isMasquerading()` and provide a **"Return to Admin"** button
8. Admin clicks **"Return to Admin"** → `POST /auth/masquerade/exit` with the adminRestoreToken
9. Backend verifies the restore token belongs to an admin, issues fresh admin JWT
10. Frontend restores admin session, navigates back to `/admin/clients`

> **Safety:** Masquerade tokens are short-lived (1h target, 2h restore). Admins cannot masquerade as themselves. The restore endpoint re-verifies admin role before issuing tokens.

> **Routing note:** When masquerading as a client (non-admin) user, the app routes to `PortalLayout` (not `Layout`) because `SmartDashboard` checks `user.is_admin || user.is_staff`. Both layouts include the masquerade banner and exit handler.

---

## 4. Business Workflows

### Login Flow

```
User                Frontend              Backend                Database
  │                    │                     │                      │
  │── email/pass ────▶│                     │                      │
  │                    │── POST /auth/login ▶│                      │
  │                    │                     │── SELECT user ──────▶│
  │                    │                     │◀── user row ─────────│
  │                    │                     │── bcrypt.compare() ──│
  │                    │                     │                      │
  │                    │                     │── SELECT 2FA ───────▶│
  │                    │                     │◀── not enabled ──────│
  │                    │                     │                      │
  │                    │                     │── signAccessToken() ─│
  │                    │                     │── buildFrontendUser()│
  │                    │◀── JWT + user ─────│                      │
  │                    │                     │                      │
  │                    │── storeAuth(token) ─│                      │
  │                    │── GET /auth/perms ──▶│                      │
  │                    │◀── permissions ─────│                      │
  │                    │                     │                      │
  │◀── /dashboard ────│                     │                      │
```

### 2FA Setup Flow

```
User             Frontend            Backend              Database
  │                 │                   │                     │
  │── enable 2FA ──▶│                   │                     │
  │   (choose       │── POST /2fa/setup │                     │
  │    method)      │   { method }     ▶│                     │
  │                 │                   │── new Secret() ─────│
  │                 │                   │   (TOTP: QR code)   │
  │                 │                   │   (email/SMS: OTP)  │
  │                 │                   │── UPSERT secret ───▶│
  │                 │◀── QR/secret OR   │                     │
  │                 │   "OTP sent" ─────│                     │
  │                 │                   │                     │
  │── TOTP: scan QR code, enter 6-digit │                     │
  │── email/SMS: enter received OTP     │                     │
  │── enter code ──▶│                   │                     │
  │                 │── POST /verify-setup▶│                   │
  │                 │                   │── validate code ────│
  │                 │                   │── generate 10 backup│
  │                 │                   │── SET is_enabled=1 ▶│
  │                 │                   │── SET preferred_    │
  │                 │                   │   method ──────────▶│
  │                 │◀── backup codes ──│                     │
  │◀── save codes ─│                   │                     │
```

### Masquerade Flow

```
Admin            Frontend               Backend                Database
  │                 │                      │                       │
  │── "Login as     │                      │                       │
  │   this User" ──▶│                      │                       │
  │                 │── SweetAlert2 ──────▶│                       │
  │                 │   confirm?           │                       │
  │── confirm ─────▶│                      │                       │
  │                 │                      │                       │
  │                 │── POST /admin/       │                       │
  │                 │   clients/:id/       │                       │
  │                 │   masquerade ────────▶│                       │
  │                 │                      │── requireAuth+Admin ──│
  │                 │                      │── SELECT target user ▶│
  │                 │                      │◀── user row ──────────│
  │                 │                      │── buildFrontendUser() │
  │                 │                      │── signAccessToken()×2 │
  │                 │                      │   (1h target + 2h     │
  │                 │                      │    adminRestore)      │
  │                 │◀── { token, user,  ──│                       │
  │                 │   adminRestoreToken } │                       │
  │                 │                      │                       │
  │                 │── startMasquerade() ─│                       │
  │                 │   stores both tokens │                       │
  │                 │   in localStorage    │                       │
  │                 │── navigate /dashboard │                      │
  │                 │                      │                       │
  │◀── purple       │                      │                       │
  │   masquerade    │                      │                       │
  │   banner ──────│                      │                       │
  │                 │                      │                       │
  │── "Return to   │                      │                       │
  │   Admin" ──────▶│                      │                       │
  │                 │── POST /auth/       │                       │
  │                 │   masquerade/exit ───▶│                       │
  │                 │   { adminRestore     │                       │
  │                 │     Token }          │                       │
  │                 │                      │── jwt.verify() ───────│
  │                 │                      │── SELECT admin role ─▶│
  │                 │                      │◀── admin confirmed ───│
  │                 │                      │── buildFrontendUser() │
  │                 │                      │── signAccessToken()   │
  │                 │◀── { token, user } ──│                       │
  │                 │                      │                       │
  │                 │── exitMasquerade()   │                       │
  │                 │   clear masquerade   │                       │
  │                 │   keys, storeAuth()  │                       │
  │                 │── navigate /admin/   │                       │
  │                 │   clients            │                       │
  │◀── admin view ─│                      │                       │
```

---

## 5. Key Features

| Feature | Detail |
|---------|--------|
| **Registration** | Email + password, assigns `viewer` role via user_roles + activation key, all in a transaction |
| **Login** | bcrypt verification, optional/mandatory 2FA gate, "remember me" (30-day tokens) |
| **JWT Tokens** | HS256, configurable expiry (default 1h), refresh endpoint |
| **Multi-Method 2FA** | 3 methods: TOTP (RFC 6238, 30s, SHA1, ±1 window), Email OTP, SMS OTP (via SMSPortal REST API). Staff/admin: all 3, mandatory. Clients: TOTP + Email, optional |
| **2FA Role Enforcement** | Staff/admin cannot disable 2FA. Clients can enable/disable freely. Frontend TwoFactorSetup component adapts UI based on `isStaffOrAdmin` prop |
| **2FA Backup Codes** | 10 random 8-char hex codes, SHA-256 hashed storage, single-use; password required to regenerate |
| **Centralized Email Service** | `emailService.ts` — reads SMTP from `credentials` table (AES-256-GCM encrypted); fallback to env vars; caches nodemailer transporter; logs to `email_log` table |
| **SMTP Admin UI** | System Settings → SMTP tab: configure host, port, username, password, from name/email, encryption; test email button |
| **Password Reset** | 3-step flow: email → OTP → new password |
| **Permission Resolution** | User → user_roles → roles → role_permissions → permissions; admin/staff get wildcard `*` |
| **Frontend User Shape** | `buildFrontendUser()` compiles id, email, name, avatar, role, permissions into one object (no team field) |
| **Branding** | Login/forgot pages load site logo, name, description from cached app settings |
| **Masquerade** | Admin can login as any client user; dual-JWT pattern (target + restore); purple banner in Layout; return-to-admin with role re-verification |

---

## 6. Integration Points

| Depends On | Purpose |
|-----------|---------|
| **middleware/auth.ts** | JWT signing/verification, requireAuth |
| **db/mysql.ts** | All database operations |
| **utils/httpErrors.ts** | badRequest error responses |
| **config/env.ts** | JWT_SECRET, JWT_EXPIRES_IN, TWO_FACTOR_APP_NAME, ENCRYPTION_KEY |
| **bcryptjs** | Password hashing (12 rounds) |
| **otpauth** | TOTP generation and validation |
| **qrcode** | QR code generation for TOTP 2FA setup |
| **jsonwebtoken** | JWT signing/verification |
| **nodemailer** | SMTP email transport (used by emailService.ts) |
| **smsService.ts** | SMS sending via SMSPortal REST API (used by 2FA and auth login) |
| **credentials table** | AES-256-GCM encrypted SMTP credentials (service_name='SMTP') + SMS credentials (SMS KEY / SMS SECRET) |

| Used By | How |
|---------|-----|
| **All authenticated routes** | JWT token issued by this module |
| **Crosscutting/Infrastructure** | `buildFrontendUser` re-used by 2FA and email modules |
| **twoFactor.ts** | Calls `sendTwoFactorOtp()` from emailService for email 2FA |
| **Frontend store** | Auth state (user, isAuthenticated) set by useAuth hook |
| **Frontend api.ts** | Axios interceptor reads token from localStorage |
| **SystemSettings.tsx** | SMTP config tab reads/writes via `/email/config` and `/email/test` |

---

## 7. Security Model

### ✅ Strengths

| Feature | Detail |
|---------|--------|
| bcrypt with 12 rounds | Strong password hashing; resistant to brute force |
| Zod input validation | All inputs validated before processing |
| Transaction for registration | User + role + key created atomically — no partial state |
| Multi-method 2FA | TOTP, Email OTP, SMS OTP — each with distinct verification paths |
| Role-based 2FA enforcement | Staff/admin cannot disable 2FA; clients have opt-in/opt-out freedom |
| SHA-256 hashed backup codes | 10 single-use codes; password required to regenerate |
| Temp token for 2FA | 5-minute expiry; purpose-scoped (`purpose: '2fa'`); includes user ID + method |
| OTP expiry for email/SMS | Email/SMS OTP codes expire after 5 minutes (`otp_expires_at` via MySQL `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` — never JS-computed timestamps) |
| Generic error on login failure | "Invalid email or password" — no user enumeration |
| OTP timing-safe | Uses `totp.validate()` with window for TOTP; bcrypt compare for backup codes |
| SMTP credentials encrypted | AES-256-GCM encryption via `credentials` table; ENCRYPTION_KEY from env |
| Masquerade dual-JWT | Separate tokens for target session and admin restore — compromise of one doesn't affect the other |
| Masquerade self-guard | Admin cannot masquerade as themselves — prevents accidental session corruption |
| Masquerade exit re-verifies role | `/auth/masquerade/exit` checks admin role before issuing token — prevents privilege escalation if restore token is stolen |

### 🔴 Security Considerations

| Issue | Severity | Detail |
|-------|----------|--------|
| No rate limiting on /auth/login | 🔴 CRITICAL | Brute force attacks possible — add express-rate-limit |
| No rate limiting on /auth/forgot-password | 🔴 CRITICAL | Email spam possible — add rate limiting |
| JWT stateless — no revocation | 🟡 WARNING | Stolen tokens valid until expiry; consider blacklist for sensitive ops |
| Password reset OTP not documented server-side | 🟡 WARNING | The /auth/forgot-password and /auth/verify-otp endpoints aren't in auth.ts — may be in a separate service or missing |
| 2FA secret stored in plaintext | 🟡 WARNING | user_two_factor.secret is base32 plaintext; consider encrypting at rest |
| Token in localStorage | 🟡 WARNING | XSS vulnerability could steal token; httpOnly cookies preferred but adds CSRF complexity |
| No account lockout | 🟡 WARNING | Unlimited login attempts; no failed-attempt counter |
| Masquerade restore token in localStorage | 🟡 WARNING | XSS could steal admin restore token; mitigated by 2h TTL and admin role re-verification on exit |
| No masquerade audit log | 🟡 WARNING | Masquerade events only logged to console; consider a persistent audit table for compliance |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Invalid email or password" | Wrong credentials or user doesn't exist | Check email/password; verify user exists in DB |
| "Two-factor authentication required" | 2FA enabled; frontend must handle requires_2fa flow | Send temp_token + code to /auth/2fa/verify |
| "Invalid or expired temporary token" | 2FA temp token expired (5 min) | Re-authenticate via /auth/login |
| "Invalid verification code" | Wrong TOTP/OTP code or backup code | Check authenticator app time sync; try backup code; check email inbox |
| "OTP has expired" | Email/SMS OTP older than 10 minutes | Click "Resend verification code" or re-login |
| Email OTP not received | SMTP not configured or credentials invalid | Check System Settings → SMTP tab; verify credentials; send test email |
| "SMTP configuration not found" | No `credentials` row with service_name='SMTP' | Configure SMTP in System Settings → SMTP tab, or set SMTP_* env vars as fallback |
| Test email fails | Wrong SMTP host/port/credentials | Verify SMTP settings; check server can reach mail host on port |
| "Staff and admin users cannot disable 2FA" | Backend blocks disable for staff/admin roles | 2FA is mandatory for staff/admin; can only change method |
| 2FA setup shows no SMS option | User is a client (not staff/admin) | SMS is only available for staff/admin users |
| Token expires too quickly | Default JWT_EXPIRES_IN is 1h | Set JWT_EXPIRES_IN in .env or use rememberMe: true |
| Permissions empty after login | user_roles record missing for user | Assign role via admin panel or INSERT into user_roles |
| "Email already registered" | Duplicate email on registration | Use different email or login with existing account |
| Logo not showing on login page | Branding not cached in localStorage | Ensure app-settings API returns valid logo URL |
| Masquerade banner not showing | `masquerade_admin_restore_token` missing from localStorage, or wrong layout used | Check that `startMasquerade()` was called; inspect localStorage. Both `Layout.tsx` and `PortalLayout.tsx` render the banner. |
| "Return to Admin" fails | Admin restore token expired (2h TTL) | Re-authenticate as admin via normal login |
| "Cannot masquerade as yourself" | Admin tried to masquerade as their own account | Select a different (client) user |
| Masquerade exits to login page | Restore token invalid or user no longer has admin role | Re-authenticate normally |

---

## 9. Related Documentation

- [Crosscutting/Infrastructure](../Crosscutting/Infrastructure/README.md) — JWT middleware, error handling
- [Users](../Users/README.md) — User management, profile editing
- [Roles](../Roles/README.md) — Role and permission management
- [Notifications](../Notifications/README.md) — FCM token registration after login
- [CODEBASE_MAP.md](../CODEBASE_MAP.md) — Platform architecture overview
