# Authentication Module - Changelog & Known Issues

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-06 | 1.5.0 | 2FA bug fixes (timezone, JSON.parse crash, method switching, resend UX), profile update fix, SMS service integration |
| 2026-03-05 | 1.4.0 | Multi-method 2FA (TOTP/email/SMS), centralized email service, SMTP admin UI |
| 2026-03-03 | 1.3.0 | Masquerade banner in PortalLayout + login email auto-append |
| 2026-03-02 | 1.2.0 | Admin masquerade (login-as-user) feature |
| 2026-03-02 | 1.1.0 | Migrated role detection from team_members to user_roles |
| 2026-03-02 | 1.0.0 | Initial documentation of existing authentication system |

---

## 1.5 v1.5.0 — 2FA Bug Fixes, Profile Update Fix, SMS Service Integration

**Date:** 2026-03-06  
**Scope:** Backend (twoFactor.ts, auth.ts, profile.ts, systemCredentials.ts, smsService.ts), Frontend (Login.tsx, TwoFactorSetup.tsx, AuthModel.ts)

### Summary

Critical bug-fix release addressing multiple issues discovered during production 2FA testing. The SMS OTP flow was non-functional due to a timezone mismatch between JavaScript UTC timestamps and MySQL CET (UTC+1). The 2FA verify endpoint crashed with a 500 error due to MySQL's `json` column type auto-parsing `backup_codes` while the code called `JSON.parse()` on it again. Profile updates silently failed because the backend schema didn't include the `email` field and the response lacked a `success` flag. The SMS service was integrated with SMSPortal REST API with proper credential handling.

### Bug Fixes

| # | Issue | Root Cause | Fix | File(s) |
|---|-------|-----------|-----|---------|
| 1 | **2FA SMS OTP always expired** — "Invalid Code / Verification code has expired" even with fresh code | JavaScript `new Date().toISOString()` produces UTC, but MySQL CET (UTC+1) stores it as local time. OTP appeared to expire 1 hour early. | Replaced JS-computed `otp_expires_at` with `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` in all 3 OTP storage locations | `twoFactor.ts` (sendOtpByMethod), `auth.ts` (email OTP + SMS OTP in login) |
| 2 | **2FA verify 500 crash** — `SyntaxError: Unexpected token 'o', "[object Obj"... is not valid JSON` | `backup_codes` column is MySQL `json` type → mysql2 driver auto-parses it into a JS object. Code called `JSON.parse(row.backup_codes)` on the already-parsed object, producing `"[object Object]"` then failing to parse that string. | Added `typeof` guard: `typeof row.backup_codes === 'string' ? JSON.parse(row.backup_codes) : row.backup_codes` at both backup_codes parse locations | `twoFactor.ts` (lines 400, 427) |
| 3 | **2FA method switching blocked** — "Two-factor authentication is already enabled. Disable it first to reconfigure." | `/setup` endpoint rejected setup when `is_enabled = 1`, regardless of whether the user was trying a different method | Modified `/setup` to allow re-setup if the new method differs from current. If same method is already active, still blocks. Temporarily disables before re-setup. | `twoFactor.ts` (/setup endpoint) |
| 4 | **2FA email OTP silently failed** — No email received, no error shown | `sendTwoFactorOtp` returned `{ success: false }` when SMTP delivery failed (550 rejection), but `sendOtpByMethod` didn't check the return value | Added result check in `sendOtpByMethod`: if `!result.success`, throws `badRequest()` with clear message | `twoFactor.ts` (sendOtpByMethod) |
| 5 | **Profile update not saving** — Success toast shown but data not persisted | Three bugs: (a) `UpdateProfileSchema` didn't include `email` field, (b) response lacked `success: true` flag (frontend checked `response.success` which was undefined), (c) frontend `updateProfile()` only sent `{ name, phone }` — dropped email and notification prefs | Added `email` to Zod schema with duplicate check, added `success: true` to response JSON, updated frontend to send email + phone + all 3 notification preferences | `profile.ts`, `AuthModel.ts` |
| 6 | **Credentials PUT 500** — `ER_TRUNCATED_WRONG_VALUE` on save | Empty string `''` sent for `expires_at` DATETIME column — MySQL rejects empty strings for DATETIME | Coerced empty strings to NULL: `params.push(expires_at \|\| null)` (same for `notes`) | `systemCredentials.ts` (line 275-276) |
| 7 | **2FA resend overwrites OTP without feedback** — User enters first SMS code after clicking resend, gets "Invalid" | Clicking "Resend verification code" generates a new OTP, replacing the first. User entered the old code. | Clear code input field on resend, updated success message to "Please enter the **new** code" | `Login.tsx` (handleResendOtp) |

### UX Improvements

| # | Enhancement | Description | File(s) |
|---|------------|-------------|---------|
| 1 | **2FA sending indicator** | Method selection buttons show spinning ArrowPathIcon + "Sending verification code..." text while API call is in progress. Other method buttons disabled/greyed during loading. | `TwoFactorSetup.tsx` |
| 2 | **2FA resend clears input** | When user clicks "Resend verification code", the code input field is cleared and message explicitly says to enter the new code | `Login.tsx` |
| 3 | **Zod trim on OTP codes** | Added `.trim()` to `VerifySetupSchema.code` and `VerifyLoginSchema.code` to handle whitespace copy-paste | `twoFactor.ts` |

### SMS Service Integration

| Detail | Value |
|--------|-------|
| Provider | SMSPortal REST API (`https://rest.smsportal.com`) |
| Auth | HTTP Basic (clientId:clientSecret → Base64), token cached for 24h |
| Credential storage | Two rows in `credentials` table: `SMS KEY` (clientId) + `SMS SECRET` (AES-256-GCM encrypted secret) |
| API type | **REST** (not HTTP — HTTP type keys return 401) |
| File | `src/services/smsService.ts` |
| Balance | 1092 credits remaining (as of 2026-03-06) |

### Updated Backend Files

| File | Change |
|------|--------|
| `src/routes/twoFactor.ts` | **665 → 674 LOC.** Fixed JSON.parse crash on backup_codes (typeof guard). Fixed OTP expiry (DATE_ADD). Method switching without disable. Email delivery error reporting. Trim on code fields. |
| `src/routes/auth.ts` | **283 LOC.** Two OTP storage locations fixed to use `DATE_ADD(NOW(), INTERVAL 5 MINUTE)`. |
| `src/routes/profile.ts` | Added `email` to `UpdateProfileSchema` with duplicate check. Added `success: true` to PUT response. Relaxed phone to `.max(50)` (removed `.min(1)`). |
| `src/routes/systemCredentials.ts` | Fixed `expires_at` and `notes` empty string → NULL coercion on PUT. |
| `src/services/smsService.ts` | **Rewritten.** `getCredentials()` supports 3 layouts: two separate rows (SMS KEY + SMS SECRET), single colon-delimited row, or single row + additional_data JSON. AES-256-GCM decryption for secrets. |

### Updated Frontend Files

| File | Change |
|------|--------|
| `src/pages/auth/Login.tsx` | **296 → 300 LOC.** Resend handler clears code input, updated success message. |
| `src/components/TwoFactorSetup.tsx` | **310 → 325 LOC.** Method buttons show spinner + "Sending verification code..." during loading. Other buttons disabled while sending. |
| `src/models/AuthModel.ts` | **270 → 280 LOC.** `updateProfile()` now sends email, phone, and all notification preferences (was only name + phone). |

### Database Schema Note

| Table | Column | Type | Note |
|-------|--------|------|------|
| user_two_factor | backup_codes | **JSON** (not TEXT) | mysql2 auto-parses this column. Code must handle both string and object types. |
| user_two_factor | otp_code | VARCHAR(255) | Stores SHA-256 hash of 6-digit OTP (not plaintext) |
| user_two_factor | otp_expires_at | DATETIME | Must be set via `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` — never from JS timestamps due to timezone mismatch |

### Critical Lesson: MySQL Timezone vs JavaScript UTC

The MySQL server runs in **CET (UTC+1)**. When JavaScript writes `new Date().toISOString()` (e.g., `2026-03-06T14:00:00.000Z`), MySQL stores this as CET local time `2026-03-06 14:00:00` — which is actually UTC+1, meaning the stored time is 1 hour behind what was intended. When read back and compared with `new Date()` (UTC), the OTP appears to have expired 1 hour early.

**Rule:** Always use `NOW()` and `DATE_ADD(NOW(), INTERVAL ...)` for MySQL timestamps. Never compute timestamps in JavaScript and pass them as parameters.

### Verification Status

- ✅ SMS 2FA login flow: send OTP → enter code → verify → login — working end-to-end
- ✅ 2FA method switching (TOTP ↔ email ↔ SMS) without disabling first
- ✅ Profile update saves email, phone, name, and notification preferences
- ✅ Credentials PUT handles empty expires_at without 500
- ✅ Backup codes JSON parsing safe for both string and object types
- ✅ Resend clears old code from input, shows "enter new code" message

---

## 1.4 v1.4.0 — Multi-Method 2FA + Centralized Email Service + SMTP Admin UI

**Date:** 2026-03-05  
**Scope:** Backend (twoFactor.ts, emailService.ts, email.ts, auth.ts, app.ts), Frontend (TwoFactorSetup.tsx, AuthModel.ts, AuthPage.tsx, Login.tsx, AccountSettings.tsx, PortalSettings.tsx, SystemSettings.tsx)

### Summary

Major security and infrastructure upgrade. Two-factor authentication expanded from TOTP-only to three methods: TOTP (authenticator app), Email OTP, and SMS OTP. Staff and admin users are now **required** to have 2FA enabled (cannot disable). Client users can opt in with TOTP or Email methods.

A centralized email service (`emailService.ts`) was introduced, reading SMTP credentials from the `credentials` table with AES-256-GCM encryption. SMTP configuration was moved from the general Settings page to a dedicated tab in **System Settings** (admin only), with a test email feature.

Both login pages (AuthPage.tsx and Login.tsx) now handle the multi-method 2FA verification step inline, with method-specific messaging and a resend button for email/SMS.

### New Backend Files

| File | LOC | Purpose |
|------|-----|---------|
| `src/services/emailService.ts` | 256 | Centralized nodemailer email transport. Reads SMTP from credentials table (AES-256-GCM). Caches transporter. Logs to email_log. Exports: sendEmail, sendTestEmail, sendTwoFactorOtp, invalidateTransporter |
| `src/routes/email.ts` | 178 | Email router: POST /test, POST /send, GET /config, PUT /config, GET /logs. Admin SMTP management + email send API. |

### New Frontend Files

| File | LOC | Purpose |
|------|-----|---------|
| `src/components/TwoFactorSetup.tsx` | 310 | Reusable 2FA management component. Method selection (TOTP/email/SMS), QR code display, OTP verification, backup codes, enable/disable/change. Props: `{ isStaffOrAdmin?: boolean }` |

### Updated Backend Files

| File | Change |
|------|--------|
| `src/routes/twoFactor.ts` | **366 → 665 LOC.** Rewritten for multi-method. Added: `preferred_method` support, `generateOTP()`, `sendSms()` stub, email/SMS OTP storage (otp_code/otp_expires_at), multi-method verify logic, role-based enforcement (staff/admin cannot disable), `POST /send-otp` endpoint (resend during login), `PUT /method` endpoint (change preferred method). Updated: /status returns `preferred_method`, `is_required`, `available_methods`; /setup accepts `method` param; /verify handles TOTP+email+SMS; /disable checks role. |
| `src/routes/auth.ts` | **321 → 283 LOC.** Login now detects `preferred_method` from user_two_factor, auto-sends OTP for email/SMS methods via sendTwoFactorOtp/sendSms before returning temp_token. Response includes `two_factor_method` field. |
| `src/app.ts` | Mounted email router: `app.use('/email', emailRouter)` |

### Updated Frontend Files

| File | Change |
|------|--------|
| `src/models/AuthModel.ts` | **162 → 270 LOC.** Added 8 new 2FA methods: get2FAStatus, setup2FA, verifySetup2FA, verify2FA, resend2FAOtp, disable2FA, change2FAMethod, regenerateBackupCodes. Added TwoFactorStatus and TwoFactorSetupResult interfaces. Login method now hoists top-level 2FA fields (requires_2fa, two_factor_method, temp_token) into `data` property for consistent access. |
| `src/pages/public/AuthPage.tsx` | **464 → 631 LOC.** Added 2FA verification step after login: 7 state variables (twoFaRequired, twoFaMethod, twoFaTempToken, twoFaCode, twoFaVerifying, twoFaError, twoFaResending), method-specific UI (TOTP/email/SMS messaging), resend button for email/SMS, backup code hint. Type cast for two_factor_method. |
| `src/pages/auth/Login.tsx` | **251 → 296 LOC.** Same 2FA verification step as AuthPage.tsx: state variables, method-specific UI, resend button. Type cast for two_factor_method. |
| `src/pages/general/AccountSettings.tsx` | Added Two-Factor Authentication card importing TwoFactorSetup with `isStaffOrAdmin` derived from user store. |
| `src/pages/portal/Settings.tsx` | Added 2FA card under Security tab: `<TwoFactorSetup isStaffOrAdmin={false} />`. Wrapped in React fragment to fix sibling element issue. |
| `src/pages/system/SystemSettings.tsx` | Added SMTP tab: full configuration UI (host, port, username, password, from_name, from_email, encryption), test email button, reads/writes via /email/config and /email/test. |
| `src/pages/general/Settings.tsx` | **Removed** SMTP configuration section (relocated to SystemSettings.tsx). |
| `src/types/index.ts` | Added `two_factor_enabled?: boolean` and `two_factor_method?: string` to User interface. |

### New API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|--------|
| POST | /auth/2fa/send-otp | temp_token | Resend OTP during login for email/SMS 2FA |
| PUT | /auth/2fa/method | JWT | Change preferred 2FA method |
| POST | /email/test | JWT (admin) | Send test email |
| POST | /email/send | JWT | Send email via centralized service |
| GET | /email/config | JWT (admin) | Get SMTP config (password masked) |
| PUT | /email/config | JWT (admin) | Upsert encrypted SMTP credentials |
| GET | /email/logs | JWT (admin) | View email send log with pagination |

### Updated API Endpoints

| Endpoint | Change |
|----------|--------|
| POST /auth/login | Response now includes `two_factor_method` field. Auto-sends OTP for email/SMS methods. |
| GET /auth/2fa/status | Response now includes `preferred_method`, `is_required`, `available_methods`. |
| POST /auth/2fa/setup | Accepts `method` param (`'totp'`/`'email'`/`'sms'`). Email/SMS sends OTP instead of returning QR. |
| POST /auth/2fa/verify-setup | Handles TOTP validation AND email/SMS OTP matching. |
| POST /auth/2fa/verify | Handles TOTP, email OTP, SMS OTP, and backup codes based on preferred_method. |
| POST /auth/2fa/disable | Returns 403 for staff/admin users (mandatory 2FA). |

### New Database Columns

| Table | Column | Type | Purpose |
|-------|--------|------|--------|
| user_two_factor | preferred_method | VARCHAR(10) DEFAULT 'totp' | Active 2FA method (totp/email/sms) |
| user_two_factor | otp_code | VARCHAR(255) NULL | SHA-256 hashed 6-digit OTP for email/SMS (v1.5.0: confirmed as hash, not plaintext) |
| user_two_factor | otp_expires_at | DATETIME NULL | OTP expiry (5 minutes via `DATE_ADD(NOW(), INTERVAL 5 MINUTE)`) |

### New Database Tables

| Table | Purpose |
|-------|---------|
| credentials | AES-256-GCM encrypted service credentials (service_name='SMTP' for email) |
| email_log | Email send history (to, subject, status, message_id, error, timestamp) |

### Bug Fixes During Implementation

| # | Issue | Fix |
|---|-------|-----|
| 1 | PortalSettings.tsx syntax error — two sibling `<div>` in `&&` conditional | Wrapped in `<>...</>` React fragment |
| 2 | AuthModel.ts login return type missing 2FA fields on `data` | Added hoisting logic to copy top-level 2FA fields into `data` property |
| 3 | AuthPage.tsx type error — `two_factor_method` string not assignable to union | Added explicit cast `as 'totp' \| 'email' \| 'sms'` |
| 4 | Login.tsx identical type error | Same cast fix as AuthPage.tsx |

### Verification Status

- ✅ Backend compiles clean (TypeScript)
- ✅ Frontend compiles clean (TypeScript)
- ✅ All 21 endpoints documented
- ✅ All new DB columns added
- ✅ SMTP config UI functional in System Settings
- ✅ 2FA setup works for all 3 methods
- ✅ Login 2FA flow works for all 3 methods
- ✅ Role-based enforcement working (staff/admin cannot disable)

> **Note:** v1.4.0 shipped with SMS as a stub (console log only) and several bugs that were fixed in v1.5.0: timezone mismatch in OTP expiry, JSON.parse crash on backup_codes, and missing profile update fields.

---

## 1.3 v1.3.0 — Masquerade PortalLayout Banner + Login Email Auto-Append

**Date:** 2026-03-03  
**Scope:** Frontend PortalLayout, AuthPage, Login

### Summary

Fixed a critical masquerade usability bug: when an admin masqueraded as a client user, the app routed to `PortalLayout` (which had no masquerade banner), leaving the admin stuck with no way to return. Added the same purple masquerade banner and "Return to Admin" handler to `PortalLayout.tsx`.

Also enhanced both login forms (`AuthPage.tsx` at `/login` and `Login.tsx` at `/billing-login`) with email auto-append: if the user enters a value without `@`, the frontend appends `@softaware.co.za` before submitting. The email field type was changed from `email` to `text` to allow plain usernames, and the placeholder was updated to `you@youremail.com`.

### Bug Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| No way to switch back from masquerade as client | `PortalLayout.tsx` had no masquerade banner. When `SmartDashboard` detects non-admin user, it renders `PortalLayout` instead of `Layout`. | Added masquerade state detection, exit handler, and purple banner to `PortalLayout.tsx` — identical to `Layout.tsx` implementation. |

### Enhancements

| Enhancement | Detail |
|-------------|--------|
| Email auto-append | If login input has no `@`, append `@softaware.co.za` (e.g., `john` → `john@softaware.co.za`) |
| Field type `text` | Changed `type="email"` → `type="text"` to allow plain usernames |
| Placeholder update | Changed to `you@youremail.com` on both login forms |

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/components/Layout/PortalLayout.tsx` | Added `EyeIcon`, `ArrowUturnLeftIcon`, `ArrowPathIcon` imports; added `isMasquerading`/`exitingMasquerade` state; added `handleExitMasquerade()` handler; added purple masquerade banner above header; pulled `setUser`/`setIsAuthenticated` from store |
| `frontend/src/pages/public/AuthPage.tsx` | Login email field: `type="email"` → `type="text"`, placeholder → `you@youremail.com`; `handleLogin()`: auto-appends `@softaware.co.za` if input has no `@` |
| `frontend/src/pages/Login.tsx` | Same changes as AuthPage: email field `type="text"`, placeholder `you@youremail.com`, `handleSubmit()` auto-appends `@softaware.co.za` |

### Verification

- ✅ All three modified files compile with zero TypeScript errors
- ✅ PortalLayout masquerade banner renders identically to Layout banner
- ✅ "Return to Admin" in PortalLayout calls `AuthModel.exitMasquerade()` and navigates to `/admin/clients`
- ✅ Login with `john` submits as `john@softaware.co.za`
- ✅ Login with `john@gmail.com` submits as-is (no double append)

---

## 1.2 v1.2.0 — Admin Masquerade (Login-as-User)

**Date:** 2026-03-02  
**Scope:** Backend auth + admin routes, frontend AuthModel + ClientManager + Layout

### Summary

Added the ability for admin users to masquerade (login-as) any client user. Uses a **dual-JWT pattern**: a short-lived token for the target user session, and a separate admin restore token to safely return to the admin's own session. A purple banner in the Layout component provides visual indication and a "Return to Admin" button.

### New Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/admin/clients/:userId/masquerade` | JWT (admin) | Issue dual JWT for target user + admin restore |
| POST | `/auth/masquerade/exit` | None (restore token in body) | Verify admin restore token, re-verify role, issue fresh admin JWT |

### Files Changed

| File | Change |
|------|--------|
| `backend/src/routes/adminClientManager.ts` | Added `POST /:userId/masquerade` endpoint — verifies target exists, prevents self-masquerade, issues two JWTs (1h target + 2h restore), logs event |
| `backend/src/routes/auth.ts` | Added `POST /auth/masquerade/exit` endpoint — verifies restore token, re-checks admin role via user_roles, issues fresh admin JWT, builds frontend user shape |
| `frontend/src/models/AuthModel.ts` | Added 5 masquerade methods: `startMasquerade()`, `isMasquerading()`, `getMasqueradeAdminId()`, `exitMasquerade()`, `clearMasquerade()`; updated `clearAuth()` to also remove masquerade localStorage keys |
| `frontend/src/models/AdminAIModels.ts` | Added `masquerade(userId)` method to `AdminClientModel` — calls `POST /admin/clients/:userId/masquerade` |
| `frontend/src/pages/admin/ClientManager.tsx` | Added `handleMasquerade()` function with SweetAlert2 confirmation, "Login as this User" purple button in client detail panel |
| `frontend/src/components/Layout/Layout.tsx` | Added masquerade state detection (`isMasquerading`), `handleExitMasquerade()` handler, purple `bg-purple-600` banner with `EyeIcon` + "Return to Admin" button |

### New localStorage Keys

| Key | Purpose | TTL |
|-----|---------|-----|
| `masquerade_admin_restore_token` | Admin's JWT to restore session | 2 hours |
| `masquerade_admin_id` | Original admin's user ID | Until cleared |

### Security Design

| Feature | Detail |
|---------|--------|
| Dual-JWT isolation | Target token and admin restore token are independent — compromise of one doesn't affect the other |
| Self-masquerade prevention | Backend rejects `adminId === targetUserId` with 400 error |
| Short-lived tokens | Masquerade: 1h, Restore: 2h — limits exposure window |
| Role re-verification on exit | `/auth/masquerade/exit` re-queries `user_roles` before issuing admin JWT — prevents escalation if admin role was removed during masquerade |
| Clean logout | `clearAuth()` removes both standard and masquerade keys |

### Verification

- ✅ Backend compiles clean (TypeScript)
- ✅ PM2 restarted successfully (restart #62)
- ✅ `POST /admin/clients/:userId/masquerade` returns `{ token, user, adminRestoreToken, masquerading: true }`
- ✅ `POST /auth/masquerade/exit` returns fresh admin JWT + user
- ✅ Purple masquerade banner renders with correct user email
- ✅ "Return to Admin" restores admin session and navigates to /admin/clients

---

## 1.1 v1.1.0 — Teams → User Roles Migration

**Date:** 2026-03-02  
**Scope:** Backend auth, middleware, admin routes, system routes

### Summary

Removed all dependency on `team_members` table for role detection. The `user_roles` + `roles` tables are now the **sole authoritative source** for determining a user’s role, admin status, and staff status. Legacy `teams` and `team_members` tables are retained only for credit balance scoping.

### Breaking Changes

| Change | Impact |
|--------|--------|
| `buildFrontendUser()` no longer returns `team` field | Frontend code referencing `user.team` will get `undefined` |
| Login/me responses no longer include `team` object | API consumers expecting `team` in response must update |
| New users get `viewer` role instead of team `ADMIN` | Role-checking logic that relied on team membership must use `user_roles` |

### Files Changed

| File | Change |
|------|--------|
| `src/routes/auth.ts` | `buildFrontendUser()` — removed team_members query, derives `is_admin`/`is_staff` from role slugs, no `team` in return |
| `src/routes/auth.ts` | Register — assigns `viewer` role via `user_roles`; legacy team/team_members still created for credit scoping |
| `src/middleware/requireAdmin.ts` | Admin gate now checks `user_roles` JOIN `roles` for `admin`/`super_admin` slug |
| `src/routes/systemUsers.ts` | All CRUD uses `user_roles` instead of `team_members` for role management |
| `src/routes/systemPermissions.ts` | Admin check uses `user_roles` |
| `src/routes/adminClientManager.ts` | Client list excludes users with admin/staff roles via `user_roles` subquery |
| `src/services/credits.ts` | Removed `type team_members` import |
| `src/routes/glm.ts` | Removed `type team_members` import |

### Role Resolution (New)

```typescript
// is_admin = role slug in ('admin', 'super_admin')
// is_staff = role slug in ('developer', 'client_manager', 'qa_specialist', 'deployer')
// Fallback (no user_roles entry) = { id: 0, name: 'Client', slug: 'client' }
```

### Verification

- ✅ Backend compiles clean (TypeScript)
- ✅ PM2 restarted successfully
- ✅ Client list: 11 → 7 (4 admin/staff users correctly excluded)
- ✅ Admin login: `is_admin: true`, `role: admin`, `permissions: [*]`, no `team` field

---

## 2. Known Issues

### 2.1 🔴 CRITICAL — No Rate Limiting on Login

- **Status:** OPEN
- **Module File:** `backend/src/routes/auth.ts` — `/auth/login` route
- **Description:** No throttling on login attempts. Brute force and credential stuffing attacks are unthrottled.
- **Impact:** Direct security vulnerability. Attackers can test unlimited credentials.
- **Recommended Fix:** Add `express-rate-limit` middleware to login endpoint (10 attempts / 15 min).
- **Effort:** LOW (~5 lines)

### 2.2 🔴 CRITICAL — No Account Lockout Mechanism

- **Status:** OPEN
- **Module File:** `backend/src/routes/auth.ts` — login handler
- **Description:** No tracking of failed login attempts. No account lockout after N failures.
- **Impact:** Compounds the rate-limiting issue. Even if rate limiting is added per-IP, distributed attacks bypass it without account-level lockout.
- **Recommended Fix:** Add `failed_attempts` and `locked_until` columns to `users` table. Increment on failure, lock after 5 consecutive failures for 15 minutes. Reset on success.
- **Effort:** MEDIUM

### 2.3 🟡 WARNING — 2FA Secret Stored in Plaintext

- **Status:** OPEN
- **Module File:** `backend/src/routes/twoFactor.ts` — setup handler
- **Description:** TOTP secrets stored as plaintext base32 in `user_two_factor.secret` column.
- **Impact:** If database is compromised, attacker can generate valid TOTP codes for all users with 2FA enabled.
- **Recommended Fix:** Encrypt at rest with AES-256-GCM using a server-side key from environment variable. Decrypt only during verification.
- **Effort:** MEDIUM

### 2.4 🟡 WARNING — No Token Revocation

- **Status:** OPEN
- **Module File:** `backend/src/routes/auth.ts` — `/auth/logout` route
- **Description:** Logout is client-side only. JWT tokens remain valid until expiry. No server-side blacklist or refresh token rotation.
- **Impact:** Compromised tokens cannot be revoked. Session remains active after logout if attacker has token.
- **Recommended Fix:** Implement either: (a) Redis blacklist with TTL matching token expiry, or (b) refresh token rotation with short-lived access tokens (15m) and database-tracked refresh tokens.
- **Effort:** HIGH

### 2.5 🟡 WARNING — Backup Codes Not Individually Tracked

- **Status:** OPEN
- **Module File:** `backend/src/routes/twoFactor.ts` — backup code verification
- **Description:** Backup codes are stored as a JSON array. When used, the code is removed from the array and updated. No audit trail of which code was used or when.
- **Impact:** Difficult to investigate if a backup code was used maliciously.
- **Recommended Fix:** Create a `user_backup_codes` table with individual rows, each having `used_at` and `used_ip` columns.
- **Effort:** MEDIUM

### 2.6 🟡 WARNING — Collation Mismatch in user_roles Query

- **Status:** OPEN
- **Module File:** `backend/src/routes/auth.ts` — `buildFrontendUser()`
- **Description:** Query uses explicit `COLLATE utf8mb4_unicode_ci` on both sides of the WHERE clause, indicating a collation mismatch between `users.id` and `user_roles.user_id`.
- **Impact:** Prevents index usage on the join — forces full scan. Performance degrades with more users.
- **Recommended Fix:** `ALTER TABLE user_roles MODIFY user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
- **Effort:** LOW

### 2.7 🟢 INFO — Duplicate Token Fields in Login Response

- **Status:** OPEN (tech debt)
- **Module File:** `backend/src/routes/auth.ts` — login response
- **Description:** Login response includes `data.token`, `accessToken`, and `token` — three references to the same value.
- **Impact:** Confusing for API consumers. Increased payload size. Risk of inconsistency if one is changed.
- **Recommended Fix:** Standardize on `data.token` for web and `accessToken` for mobile via API versioning or Accept header negotiation.
- **Effort:** LOW (but requires coordinated frontend/mobile change)

### 2.8 🟢 INFO — Password Reset Endpoints Unclear

- **Status:** OPEN
- **Module File:** `frontend/src/api/AuthModel.ts`
- **Description:** Frontend `AuthModel` references `/auth/forgot-password`, `/auth/verify-otp`, and `/auth/reset-password` endpoints, but these are not found in `auth.ts`. They may be defined elsewhere or not yet implemented.
- **Impact:** Potential dead code in frontend. Password reset flow may be broken.
- **Recommended Fix:** Locate or implement these endpoints. Link them to the auth module documentation.
- **Effort:** MEDIUM

### 2.9 🟡 WARNING — No Masquerade Audit Log

- **Status:** OPEN
- **Module File:** `backend/src/routes/adminClientManager.ts` — masquerade endpoint
- **Description:** Masquerade events are only logged via `console.log()`. No persistent audit trail exists in the database.
- **Impact:** In a compliance-sensitive environment, there is no way to prove which admin masqueraded as which user, or when. Console logs may be rotated and lost.
- **Recommended Fix:** Create a `masquerade_audit_log` table with columns: `admin_id`, `target_user_id`, `action` (start/exit), `created_at`, `ip_address`. Insert on both masquerade start and exit.
- **Effort:** LOW

### 2.10 🟡 WARNING — Admin Restore Token in localStorage

- **Status:** OPEN (accepted risk)
- **Module File:** `frontend/src/models/AuthModel.ts` — `startMasquerade()`
- **Description:** The admin restore token is stored in `localStorage` under `masquerade_admin_restore_token`. An XSS attack could steal this token and use it to obtain an admin JWT.
- **Impact:** If XSS is present, attacker could call `/auth/masquerade/exit` with the stolen restore token and receive an admin-level JWT.
- **Mitigation:** 2-hour TTL limits exposure. Exit endpoint re-verifies admin role. `clearAuth()` removes the token on logout.
- **Recommended Fix:** Move to `sessionStorage` (cleared on tab close) or use httpOnly cookies for the restore token.
- **Effort:** LOW

### 2.11 🟢 INFO — No Server-Side Masquerade Session Tracking

- **Status:** OPEN
- **Module File:** `backend/src/routes/adminClientManager.ts`
- **Description:** The server does not track active masquerade sessions. There is no way for a super admin to forcibly end another admin's masquerade session.
- **Impact:** Low — masquerade tokens expire naturally (1h). But in emergency situations (e.g., rogue admin), there's no kill switch.
- **Recommended Fix:** Store active masquerade sessions in Redis or a DB table with the ability to revoke by admin ID.
- **Effort:** MEDIUM

---

## 3. Migration Notes

### From Current to Secure Authentication

If implementing the recommended fixes, follow this migration order:

1. **Collation Fix** (non-breaking)
   - Run: `ALTER TABLE user_roles MODIFY user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
   - Remove COLLATE hacks from `buildFrontendUser` queries
   - Test: Verify login still works

2. **Rate Limiting** (non-breaking)
   - Install: `npm install express-rate-limit`
   - Add middleware to `/auth/login` and `/auth/register`
   - Test: Verify 11th rapid login attempt is rejected

3. **Account Lockout** (schema change)
   - Add columns: `ALTER TABLE users ADD failed_attempts INT DEFAULT 0, ADD locked_until DATETIME NULL;`
   - Update login logic to check/increment/reset
   - Test: Verify lockout after 5 failures, unlock after 15 min

4. **2FA Secret Encryption** (schema change + code)
   - Add `TOTP_ENCRYPTION_KEY` to env
   - Migrate existing secrets: read → encrypt → update
   - Update setup/verify to encrypt/decrypt
   - Test: Verify 2FA setup and login still work

5. **Token Revocation** (architecture change)
   - Choose: Redis blacklist or refresh token rotation
   - Implement logout invalidation
   - Update frontend to handle token refresh
   - Test: Verify logout actually prevents further API access

---

## 4. Future Enhancements

| Enhancement | Priority | Effort | Description |
|------------|----------|--------|-------------|
| OAuth2/SSO | 🟡 MEDIUM | HIGH | Support Google, Microsoft, SAML login |
| Passkey/WebAuthn | 🟢 LOW | HIGH | FIDO2 passwordless authentication |
| Session Management UI | 🟡 MEDIUM | MEDIUM | Show active sessions, allow remote logout |
| Login Audit Log | 🟡 MEDIUM | LOW | Log all login attempts with IP, user agent, result |
| Password Policy | 🟡 MEDIUM | LOW | Configurable min length, complexity, history |
| Email Verification Flow | 🟡 MEDIUM | MEDIUM | Verify email before account activation |
| Magic Link Login | 🟢 LOW | MEDIUM | Passwordless email-based authentication |
| Masquerade Audit Table | 🟡 MEDIUM | LOW | Persist masquerade start/exit events with admin ID, target ID, IP, timestamp |
| Masquerade Session Storage | 🟢 LOW | LOW | Move admin restore token from localStorage to sessionStorage to reduce XSS risk |
