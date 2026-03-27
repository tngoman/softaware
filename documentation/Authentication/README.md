# Authentication Module - Overview

**Version:** 2.0.0  
**Last Updated:** 2026-03-14

---

## 1. Module Overview

### Purpose

The Authentication module handles user registration, login, JWT token management, multi-method two-factor authentication (TOTP / Email / SMS / Push-to-Approve), alternative auth method fallback, PIN-based quick login (v1.9.0), Google OAuth2 SSO (v2.0.0), centralized email service, password reset via OTP, permission resolution, and admin masquerade (login-as-user). It is the entry point for every user session.

### Business Value

- Secure user identity verification (bcrypt + JWT)
- **Multi-method 2FA** — staff/admin: TOTP + email + SMS (mandatory); clients: TOTP + email (optional, encouraged)
- **Push-to-approve** — TOTP users with a registered mobile app receive a push notification to approve/deny login with a single tap (v1.7.0); full polling UI in AuthPage.tsx (v1.8.0)
- **Alternative auth fallback** — When preferred 2FA method is unavailable, users can request OTP via email or SMS as an alternative (v1.8.0)
- **Universal TOTP validation** — Verify endpoint always tries TOTP codes regardless of preferred method (v1.8.0)
- **6-digit numeric short codes** — Mobile QR challenges include a 6-digit code (e.g., `482916`) for manual entry when scanning fails (v1.8.0)
- **PIN Quick Login** — Returning users can set a 4-digit PIN for faster re-authentication instead of typing a full password. Bcrypt-hashed, rate-limited (5 attempts → 15-minute lockout), does NOT bypass 2FA (v1.9.0)
- **Google OAuth2 SSO** — Users can sign in or register with their Google account. Existing accounts with matching email are auto-linked. OAuth-only accounts get an empty password hash (Google-only login). Dual flow: server-side redirect for web + ID token verification for mobile/SPA (v2.0.0)
- Centralized email service reading SMTP credentials from the `credentials` table (AES-256-GCM encrypted)
- Self-service password reset via email OTP
- Role-based permissions resolved at login and available throughout the session
- "Remember me" support (30-day tokens) for mobile/desktop clients
- Admin masquerade — login as any client to see their portal experience

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend source files | 6 (auth.ts, twoFactor.ts, email.ts, emailService.ts, requireAdmin.ts, adminClientManager.ts) |
| Backend LOC | ~2,600 (1563 + 1304 + 178 + 256) |
| Frontend source files | 17 (Login.tsx, LoginPage.tsx, AuthPage.tsx, OAuthCallback.tsx, ForgotPassword.tsx, useAuth.ts, AuthModel.ts, TwoFactorSetup.tsx, PinSetup.tsx, MobileAuthQR.tsx, totp.ts, AccountSettings.tsx, PortalSettings.tsx, SystemSettings.tsx SMTP tab, ClientManager.tsx, Layout.tsx, PortalLayout.tsx) |
| Frontend LOC | ~4,290 |
| Total LOC | ~6,890 |
| API endpoints | 34 (11 core auth + 3 Google OAuth + 5 PIN + 11 2FA + 5 email + 2 masquerade — some share base counts) |
| Database tables | 7 (users, user_two_factor, user_pins, user_roles, sys_password_resets, email_log, mobile_auth_challenges) |

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
│  │ Google SSO  │  │ Google SSO    │  │                  │  │            ││
│  │ → AuthModel │  │ → AuthModel   │  │                  │  │            ││
│  └──────┬─────┘  └──────┬───────┘  └────────┬─────────┘  └──────┬─────┘│
│         │                │                    │                    │      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  OAuthCallback.tsx — Google OAuth redirect handler (v2.0.0)     │   │
│  │  Reads ?token= from URL | Stores JWT | Fetches profile         │   │
│  │  Sets user/permissions in Zustand | Navigates to /dashboard     │   │
│  └──────┬───────────────────────────────────────────────────────────┘   │
│         │                                                                │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  TwoFactorSetup.tsx — Reusable 2FA management component     │       │
│  │  Method selection (TOTP/email/SMS) | QR code | OTP verify   │       │
│  │  Backup codes | Enable/Disable/Change | Role-aware           │       │
│  │  Auto-verify TOTP via totp.ts (browser HMAC-SHA1)           │       │
│  └──────┬────────────────────┬──────────────────────────────────┘       │
│         │                    │                                           │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │  MobileAuthQR.tsx — Mobile QR auth component (always visible)│       │
│  │  QR code display | Short code for manual entry | Polling    │       │
│  │  Shows on AccountSettings + PortalSettings (v1.8.0)         │       │
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
│  │  regenerateBackupCodes() | sendAltOtp() | pollPushStatus()     │    │
│  │  getMobileAuthQR() | getMobileAuthStatus()                     │    │
│  │  getGoogleAuthUrl() | loginWithGoogleToken()                   │    │
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
│  │  ── PIN Quick Login (v1.9.0) ───────────────────────────────── │    │
│  │  GET  /pin/status    — requireAuth → has_pin boolean           │    │
│  │  POST /pin/set       — requireAuth → set/update PIN (password) │    │
│  │  DELETE /pin         — requireAuth → remove PIN                │    │
│  │  POST /pin/verify    — public → email+PIN login → JWT/2FA     │    │
│  │  GET  /pin/check/:e  — public → check if email has PIN        │    │
│  │  ── Google OAuth2 SSO (v2.0.0) ─────────────────────────────── │    │
│  │  GET  /google        — public → Google consent URL             │    │
│  │  GET  /google/callback — public → exchange code → JWT redirect │    │
│  │  POST /google/token  — public → verify ID token → JWT         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /auth/2fa/*  →  twoFactor.ts (twoFactorRouter)                │    │
│  │  GET  /status        — 2FA status + preferred_method + avail.  │    │
│  │  POST /setup         — setup TOTP/email/SMS (method param)     │    │
│  │  POST /verify-setup  — verify code, enable 2FA, backup codes   │    │
│  │  POST /verify        — login 2FA (any code type accepted;      │    │
│  │                        always tries TOTP first, v1.8.0)        │    │
│  │  POST /send-otp      — resend OTP during login (email/SMS)     │    │
│  │  POST /send-alt-otp  — send OTP via alternative method (v1.8.0)│    │
│  │  POST /disable       — disable 2FA (clients only; blocked for  │    │
│  │                        staff/admin)                             │    │
│  │  PUT  /method        — change preferred 2FA method             │    │
│  │  POST /backup-codes  — password confirm → regenerate codes     │    │
│  │  POST /push-approve  — mobile approves/denies push challenge   │    │
│  │  POST /push-status   — web polls for push challenge completion │    │
│  │  POST /mobile-challenge — create QR auth challenge             │    │
│  │  GET  /mobile-qr     — get QR + short_code for mobile auth    │    │
│  │  GET  /mobile-qr/status/:id — poll QR challenge status        │    │
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
│  │ Resolves user +     │  │ JWT HS256 signing    │  │ users.is_admin   ││
│  │ role + permissions  │  │ Configurable expiry  │  │ direct column    ││
│  │ is_admin/is_staff   │  │                      │  │ check (v1.6.0)   ││
│  │ from users columns  │  │                      │  │                  ││
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  firebaseService.ts — FCM Push Notifications (v1.7.0)           │    │
│  │  sendPushToUser() — sends multicast FCM to all user devices    │    │
│  │  Used by createPushChallenge() for push-to-approve 2FA         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /admin/clients/*  →  adminClientManager.ts (masquerade)        │    │
│  │  POST /:userId/masquerade — issue dual JWT (target + restore)  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MySQL — users, user_two_factor, user_pins, user_roles, roles,           │
│          role_permissions, permissions, sys_password_resets,              │
│          credentials (SMTP), email_log, mobile_auth_challenges           │
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

### Login with PIN (v1.9.0)

1. On login screen load, frontend checks for a stored `last_login_email` in localStorage
2. If found, calls `GET /auth/pin/check/:email` to check if PIN login is available
3. If `has_pin: true`, shows PIN login mode (4-digit PIN pad with auto-submit)
4. User enters 4-digit PIN → auto-submits on 4th digit → `POST /auth/pin/verify`
5. Backend verifies bcrypt-hashed PIN, checks rate limiting (5 attempts → 15-minute lockout)
6. If 2FA is enabled → returns `requires_2fa` (same flow as password login)
7. If no 2FA → issues JWT (30-day, same as "Remember Me"), navigates to dashboard
8. "Use password instead" link switches to standard email+password form
9. "Not you?" link clears stored email and shows standard email+password form

> **Note:** PIN login does NOT bypass 2FA. If 2FA is enabled, the full 2FA flow still runs after PIN verification. The PIN is bcrypt-hashed on the server (never stored in plaintext). Rate limiting is per-user (not per-IP).

### Login with Google OAuth (v2.0.0)

**Web Flow (Redirect):**
1. User clicks "Continue with Google" button on AuthPage.tsx or Login.tsx
2. Frontend calls `AuthModel.getGoogleAuthUrl()` → `GET /auth/google` → returns Google consent URL
3. Browser redirects to Google consent screen (`window.location.href = url`)
4. User authorizes the application on Google
5. Google redirects to `GET /auth/google/callback` with authorization code
6. Backend exchanges code for tokens, verifies ID token, extracts email + name + Google ID
7. Backend looks up user by `oauth_provider='google'` + `oauth_provider_id`
8. If not found, checks by email — if existing user, links Google to their account (`UPDATE oauth_provider`)
9. If no user exists, creates a new user account in a transaction (user, contact, team, team_member, user_roles, activation_key) with empty `passwordHash` (OAuth-only)
10. Backend issues JWT, redirects to `${frontendOrigin}/auth/oauth-callback?token=<jwt>`
11. `OAuthCallback.tsx` reads the token from URL, stores in localStorage, fetches user profile via `/auth/me`, fetches permissions, sets Zustand state, navigates to `/dashboard`

**Mobile/SPA Flow (Token):**
1. Mobile app obtains a Google ID token from Google Sign-In SDK
2. App calls `POST /auth/google/token` with `{ id_token: '...' }`
3. Backend verifies the ID token using `google-auth-library`, extracts email + name + Google ID
4. Same user lookup/creation logic as redirect flow (steps 7-9)
5. Returns `{ token: '<jwt>', user: {...} }` — mobile app stores and uses directly

> **Note:** OAuth-only accounts (created via Google login) have an empty `passwordHash` and cannot use password login or PIN login. Existing accounts with matching email are automatically linked to Google on first Google sign-in. The `google-auth-library` package handles all token verification.

### Login (With 2FA)

1. Steps 1-3 same as above
2. Backend detects 2FA enabled → determines `preferred_method` (totp, email, or sms)
3. For **email/SMS methods**: backend auto-sends OTP code via `sendTwoFactorOtp()` / `sendSms()`
4. For **TOTP method** (v1.7.0): backend also calls `createPushChallenge()` to send an FCM push notification to all registered mobile devices. This is non-fatal — if no devices are registered or FCM fails, the flow falls back to standard TOTP code entry.
5. Returns `{ requires_2fa: true, two_factor_method: 'totp'|'email'|'sms', temp_token: '...', challenge_id?: '...' }`
   - `challenge_id` is included only when a push challenge was successfully created (TOTP method with registered FCM devices)
6. Frontend shows method-specific verification UI:
   - **TOTP:** "Approve the login on your mobile app, or enter your authenticator code" (v1.7.0 — updated message when push challenge exists)
   - **Email:** "A verification code has been sent to your email"
   - **SMS:** "A verification code has been sent to your phone"
7. **Path A — Push-to-Approve (v1.7.0):** Mobile user receives push notification → taps to approve/deny → frontend polls `POST /auth/2fa/push-status` with temp_token + challenge_id → backend issues JWT when challenge completed
8. **Path B — Code Entry (existing):** User enters 6-digit code (or 8-char backup code) → frontend calls `POST /auth/2fa/verify` with temp_token + code → backend verifies (always tries TOTP first, then email/SMS OTP, then backup codes — v1.8.0) → issues JWT
9. Login continues as normal

> **Resend:** For email/SMS methods, a "Resend verification code" button calls `POST /auth/2fa/send-otp` with the temp_token.

> **Alternative Methods (v1.8.0):** If the user's preferred method is unavailable, they can click "Use Email Instead" or "Use SMS Instead" to receive an OTP via an alternative method. This calls `POST /auth/2fa/send-alt-otp` with the temp_token and desired method. The verify endpoint accepts the code regardless of which method sent it.

> **Push-to-Approve (v1.7.0, v1.8.0):** The push and code-entry paths run in parallel. AuthPage.tsx (v1.8.0) polls `push-status` every 3 seconds while also allowing manual TOTP code entry or alternative method OTP. Whichever completes first wins. Push challenges expire after 5 minutes. If the push is denied or expires, the user can switch to manual code entry or alternative methods. See [MOBILE_PUSH_2FA_WIRING_GUIDE.md](../Mobile/MOBILE_PUSH_2FA_WIRING_GUIDE.md) for mobile implementation details.

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

### PIN Setup & Management (v1.9.0)

Managed in the Security tab of both **Account Settings** (staff/admin) and **Portal Settings** (clients) via the `PinSetup` component.

**Setup flow:**
1. User taps "Set Up PIN" → enters 4-digit PIN → confirms PIN
2. Enters current password for verification
3. Calls `POST /auth/pin/set` with PIN + password → PIN bcrypt-hashed on server
4. On success → PIN is active for quick login

**Change PIN:** Same flow as setup — new PIN replaces old one, resets failed attempt counter.

**Remove PIN:** Calls `DELETE /auth/pin` → removes PIN, user must use password to login.

> **Note:** One PIN per user account. Setting a new PIN replaces the old one and resets the rate-limit counter. The PIN is bcrypt-hashed with 10 rounds.

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
9. Backend verifies the restore token belongs to an admin (checks `users.is_admin` column directly), issues fresh admin JWT
10. Frontend restores admin session, navigates back to `/admin/clients`

> **Safety:** Masquerade tokens are short-lived (1h target, 2h restore). Admins cannot masquerade as themselves. The restore endpoint re-verifies admin status via `users.is_admin` column before issuing tokens.

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
| **Push-to-Approve 2FA** | (v1.7.0) TOTP users with registered mobile devices receive an FCM push notification on login. Approve/deny with a single tap — no code entry required. Falls back to standard TOTP if no devices registered. Uses `mobile_auth_challenges` table with `source='push'`. (v1.8.0) Full push-to-approve polling UI in AuthPage.tsx. |
| **Alternative Auth Methods** | (v1.8.0) When preferred 2FA method is unavailable, users can request OTP via email or SMS as an alternative. `POST /auth/2fa/send-alt-otp` endpoint. Frontend dynamically shows the two alternative methods. |
| **Universal TOTP Validation** | (v1.8.0) Verify endpoint always attempts TOTP code validation regardless of `preferred_method`. Users can enter TOTP codes even when email/SMS is their preferred method. |
| **Mobile QR Short Codes** | (v1.8.0) Mobile auth challenges include 6-digit numeric codes (`482916` format) for manual entry when QR scanning fails. Compatible with mobile app's numeric input field. Stored in `short_code` column of `mobile_auth_challenges`. |
| **PIN Quick Login** | (v1.9.0) Returning users can set a 4-digit numeric PIN for faster re-authentication. Bcrypt-hashed (10 rounds). Rate-limited: 5 failed attempts → 15-minute lockout. Does NOT bypass 2FA. Issues 30-day JWT. Frontend detects returning user via `last_login_email` in localStorage, auto-shows PIN pad. 5 new endpoints + `user_pins` table. |
| **Google OAuth2 SSO** | (v2.0.0) Sign in or register with Google account. Dual flow: server-side redirect (web) + ID token verification (mobile/SPA). Auto-links existing accounts by email. OAuth-only accounts get empty passwordHash. 3 new endpoints (`GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/token`). Uses `google-auth-library` for token verification. CSRF protection via state cookie on redirect flow. New `oauth_provider` + `oauth_provider_id` columns on `users` table (auto-migrated by `ensureOAuthColumns()`). Frontend: Google Sign-In button on AuthPage.tsx + Login.tsx, OAuthCallback.tsx redirect handler. |
| **2FA Role Enforcement** | Staff/admin cannot disable 2FA. Clients can enable/disable freely. Frontend TwoFactorSetup component adapts UI based on `isStaffOrAdmin` prop |
| **2FA Backup Codes** | 10 random 8-char hex codes, SHA-256 hashed storage, single-use; password required to regenerate |
| **Centralized Email Service** | `emailService.ts` — reads SMTP from `credentials` table (AES-256-GCM encrypted); fallback to env vars; caches nodemailer transporter; logs to `email_log` table |
| **SMTP Admin UI** | System Settings → SMTP tab: configure host, port, username, password, from name/email, encryption; test email button |
| **Password Reset** | 3-step flow: email → OTP → new password |
| **Permission Resolution** | User → `users.is_admin`/`users.is_staff` (direct columns) for admin/staff detection; `user_roles` → `roles` → `role_permissions` → `permissions` for granular permissions; admin/staff get wildcard `*` |
| **Frontend User Shape** | `buildFrontendUser()` compiles id, email, name, avatar, role, permissions into one object; `is_admin`/`is_staff` read directly from `users` table columns (v1.6.0+, no team field) |
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
| **google-auth-library** | (v2.0.0) Google OAuth2 client — generates consent URLs, exchanges authorization codes, verifies ID tokens. Used by 3 OAuth endpoints in auth.ts |
| **smsService.ts** | SMS sending via SMSPortal REST API (used by 2FA and auth login) |
| **firebaseService.ts** | FCM push notifications via `sendPushToUser()` (used by push-to-approve 2FA, v1.7.0) |
| **fcm_tokens table** | FCM device tokens registered by mobile app — used to send push notifications |
| **mobile_auth_challenges table** | Push/QR challenge state — `source` distinguishes push vs QR, `status` tracks pending/completed/expired/denied |
| **user_pins table** | (v1.9.0) PIN hash storage + rate limiting state — `pin_hash` (bcrypt), `failed_attempts`, `locked_until` |
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
| Masquerade exit re-verifies role | `/auth/masquerade/exit` checks `users.is_admin` column directly before issuing token — prevents privilege escalation if admin status was revoked during masquerade |
| Push challenge ownership (v1.7.0) | Push challenges can only be approved/denied by the owning user — JWT userId must match challenge user_id |
| Push challenge source guard (v1.7.0) | Only `source='push'` challenges accepted by push-approve endpoint — QR challenges use a different flow |
| Push non-fatal design (v1.7.0) | Push challenge creation wrapped in try/catch — FCM failure never blocks login; user can always fall back to TOTP code entry |
| Push challenge expiry (v1.7.0) | Push challenges expire after 5 minutes; expired/completed/denied challenges cannot be replayed |
| PIN bcrypt hashed (v1.9.0) | PINs hashed with bcrypt (10 rounds) — not stored in plaintext |
| PIN rate limiting (v1.9.0) | 5 failed PIN attempts → 15-minute lockout per user; counter resets on success |
| PIN does not bypass 2FA (v1.9.0) | PIN login with 2FA enabled still requires full 2FA verification (same flow as password login) |
| PIN check does not reveal email existence (v1.9.0) | `GET /pin/check/:email` returns `has_pin: false` for non-existent emails |
| PIN vague error messages (v1.9.0) | "Invalid email or PIN" — same generic message for wrong email or wrong PIN (no user enumeration) |
| Google OAuth CSRF protection (v2.0.0) | Redirect flow uses a random state parameter set as an httpOnly cookie — verified on callback to prevent CSRF attacks |
| Google ID token verification (v2.0.0) | `google-auth-library` verifies token signature, audience (client ID), issuer, and expiry — prevents forged tokens |
| OAuth account auto-linking (v2.0.0) | Existing accounts with matching email are automatically linked to Google — no duplicate accounts created |
| OAuth-only accounts secured (v2.0.0) | OAuth-only users get empty `passwordHash` (`''`), preventing password/PIN login — they can only authenticate via Google |

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
| No push notification received | No FCM devices registered for user, or Firebase not configured | Register mobile device via `POST /fcm-tokens/register`; verify Firebase Admin SDK is initialized |
| Push challenge stuck on "pending" | Mobile app didn't respond within 5 minutes | Challenge expires; enter TOTP code manually as fallback |
| Push-status returns "denied" | User denied the login request on the mobile app | Show appropriate message; user can still enter TOTP code manually |
| `challenge_id` missing from login response | No FCM devices registered for user, or `createPushChallenge()` returned null | Push-to-approve not available; standard TOTP code entry is the only path |
| No alternative method buttons shown | User's preferred method is not TOTP, or frontend not updated to v1.8.0 | Alternative methods only shown during 2FA verification step when preferred method is unavailable |
| Short code not showing below QR | Backend not updated to v1.8.0 (no `short_code` column), or challenge has no `short_code` | Run `ensureMobileChallengeTable()` migration or manually add `short_code VARCHAR(10) NULL` to `mobile_auth_challenges` |
| MobileAuthQR not visible on profile page | Component not imported or not rendered | MobileAuthQR is shown on AccountSettings and portal Settings pages, not on Profile page |
| PIN login returns "Invalid email or PIN" | Wrong PIN or email not in database | Generic message by design — verify email is correct and re-enter PIN |
| PIN login returns "PIN login is not set up" | User has no PIN configured | Set up a PIN in Account/Portal Settings → Security tab |
| PIN login locked for 15 minutes | 5 consecutive failed PIN attempts | Wait for lockout to expire (15 minutes), then try again |
| PIN setup returns "Incorrect password" | Wrong password entered during PIN setup | Password confirmation failed — re-enter current account password |
| `user_pins` table not created | Collation mismatch between `users.id` and FK | Run `ensurePinTable()` — table uses `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` on `user_id` column to match `users.id` collation |
| PIN pad not showing on login page | No `last_login_email` stored, or user has no PIN | PIN pad only appears for returning users with a stored email + active PIN |
| "Google OAuth not configured" from `/auth/google` | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set in environment | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` file |
| Google Sign-In button redirects but callback fails | `GOOGLE_CALLBACK_URL` mismatch or not registered in Google Cloud Console | Ensure callback URL in `.env` matches the Authorized Redirect URI in Google Console (default: `/api/v1/auth/google/callback`) |
| Google login creates duplicate account | User signed up with password first, then Google with different email | Auto-linking only works when Google email matches existing account email |
| "Sign-in Failed" on OAuthCallback page | Backend error during code exchange or user creation | Check backend logs; verify Google credentials are valid and not expired |
| Google button not appearing on login page | Frontend not updated to v2.0.0 | Update frontend files: AuthPage.tsx, Login.tsx must include Google Sign-In button |

---

## 9. Related Documentation

- [Crosscutting/Infrastructure](../Crosscutting/Infrastructure/README.md) — JWT middleware, error handling
- [Users](../Users/README.md) — User management, profile editing
- [Roles](../Roles/README.md) — Role and permission management
- [Notifications](../Notifications/README.md) — FCM token registration after login
- [MOBILE_PUSH_2FA_WIRING_GUIDE.md](../Mobile/MOBILE_PUSH_2FA_WIRING_GUIDE.md) — Mobile app implementation guide for push-to-approve 2FA (v1.7.0)
- [MOBILE_QR_AUTH_GUIDE.md](../Mobile/MOBILE_QR_AUTH_GUIDE.md) — Mobile app QR-based 2FA + PIN login implementation guide (v2.0.0)
- [CODEBASE_MAP.md](../CODEBASE_MAP.md) — Platform architecture overview
