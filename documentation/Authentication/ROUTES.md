# Authentication Module - API Routes

**Version:** 1.9.0  
**Last Updated:** 2026-03-13

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 31 |
| **Base URL** | `https://api.softaware.net.za` |
| **Auth router mount** | `/auth` |
| **2FA router mount** | `/auth/2fa` |
| **Email router mount** | `/email` |
| **Admin masquerade mount** | `/admin/clients` |
| **Default auth** | Bearer JWT in Authorization header |

---

## 2. Endpoint Directory

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | POST | /auth/register | None | Create new user account |
| 2 | POST | /auth/login | None | Authenticate with email/password |
| 3 | GET | /auth/me | JWT | Get current user profile |
| 4 | POST | /auth/logout | JWT | Acknowledge logout (stateless) |
| 5 | POST | /auth/refresh | None | Refresh JWT token |
| 6 | GET | /auth/permissions | JWT | Get current user's permissions |
| 7 | GET | /auth/2fa/status | JWT | Check 2FA status + preferred method |
| 8 | POST | /auth/pin/verify | None | **NEW v1.9.0** Login with email + PIN |
| 9 | GET | /auth/pin/check/:email | None | **NEW v1.9.0** Check if email has PIN login |
| 10 | GET | /auth/pin/status | JWT | **NEW v1.9.0** Check if current user has PIN |
| 11 | POST | /auth/pin/set | JWT | **NEW v1.9.0** Set/update 4-digit PIN (requires password) |
| 12 | DELETE | /auth/pin | JWT | **NEW v1.9.0** Remove user's PIN |
| 13 | POST | /auth/2fa/setup | JWT | Setup 2FA (TOTP / email / SMS) |
| 9 | POST | /auth/2fa/verify-setup | JWT | Verify code, enable 2FA, get backup codes |
| 10 | POST | /auth/2fa/verify | None (temp_token) | Verify 2FA during login (always tries TOTP first, v1.8.0) |
| 11 | POST | /auth/2fa/send-otp | None (temp_token) | Resend OTP for email/SMS 2FA |
| 12 | POST | /auth/2fa/send-alt-otp | None (temp_token) | Send OTP via alternative method (v1.8.0) |
| 13 | POST | /auth/2fa/disable | JWT | Disable 2FA (clients only) |
| 14 | PUT | /auth/2fa/method | JWT | Change preferred 2FA method |
| 15 | POST | /auth/2fa/backup-codes | JWT | Regenerate backup codes |
| 16 | POST | /auth/2fa/push-approve | JWT | Mobile approves/denies push challenge (v1.7.0) |
| 17 | POST | /auth/2fa/push-status | None (temp_token) | Web polls for push challenge completion (v1.7.0) |
| 18 | POST | /auth/2fa/mobile-challenge | JWT | Create QR auth challenge for mobile login |
| 19 | GET | /auth/2fa/mobile-qr | JWT | Get QR code + short code for mobile auth (v1.8.0: includes challenge_code) |
| 20 | GET | /auth/2fa/mobile-qr/status/:id | JWT | Poll QR auth challenge status |
| 21 | POST | /email/test | JWT (admin) | Send test email |
| 22 | POST | /email/send | JWT | Send email |
| 23 | GET | /email/config | JWT (admin) | Get SMTP config (password masked) |
| 24 | PUT | /email/config | JWT (admin) | Upsert SMTP credentials |
| 25 | GET | /email/logs | JWT (admin) | View email send log |
| 26 | POST | /admin/clients/:userId/masquerade | JWT (admin) | Login as a client user |
| 27 | POST | /auth/masquerade/exit | None (restore token) | Return to admin session |

---

## 3. Endpoints

### 3.1 POST /auth/register

**Purpose:** Create a new user account with a role assignment and activation key.

**Auth:** None

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | ✅ | Valid email format |
| password | string | ✅ | Min 8 characters |
| teamName | string | ❌ | Min 1 char (default: "My Team") |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"securepass123","teamName":"Acme Corp"}'
```

**Success Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "a1b2c3d4-...", "email": "user@example.com" },
  "activationKey": "USER-A3F1B2C8D4E5F6A7"
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `BAD_REQUEST` | "Email already registered" |
| 400 | `BAD_REQUEST` | Zod validation failure (invalid email, short password) |

**Business Logic:**
- Hashes password with bcrypt (12 rounds)
- Creates user, assigns `viewer` role via `user_roles`, creates activation_key in a single transaction
- Legacy: also creates team + team_member (OPERATOR) for credit balance scoping
- Issues JWT with default expiry

---

### 3.2 POST /auth/login

**Purpose:** Authenticate user with email and password.

**Auth:** None

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | ✅ | Valid email |
| password | string | ✅ | Min 1 char |
| rememberMe | boolean | ❌ | Default: false |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"securepass123","rememberMe":true}'
```

**Success Response (200) — Without 2FA:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "username": "user@example.com",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_admin": true,
      "role": { "id": 1, "name": "Admin", "slug": "admin" },
      "permissions": [{ "id": 14, "name": "All Access", "slug": "*" }]
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "30d"
}
```

**Success Response (200) — With 2FA Required:**

```json
{
  "success": true,
  "requires_2fa": true,
  "two_factor_method": "totp",
  "message": "Approve the login on your mobile app, or enter your authenticator code.",
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "challenge_id": "a1b2c3d4e5f6..."
}
```

> **Note:** `two_factor_method` is one of `"totp"`, `"email"`, or `"sms"`. For email/SMS methods, the backend auto-sends the OTP code before returning this response.

> **v1.7.0:** `challenge_id` is included when the method is `"totp"` and the user has registered FCM devices. If no devices are registered or push challenge creation fails, `challenge_id` is omitted and the message reverts to "Two-factor authentication required." The web frontend can poll `POST /auth/2fa/push-status` with `challenge_id` to check for push approval.

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `BAD_REQUEST` | "Invalid email or password" |

**Business Logic:**
- Looks up user by email, compares bcrypt hash
- If 2FA enabled: issues 5-minute temp_token with `purpose: '2fa'`
- If 2FA method is TOTP (v1.7.0): calls `createPushChallenge()` to send FCM push notification to all registered mobile devices. Non-fatal — wrapped in try/catch. Returns `challenge_id` in response if successful.
- If rememberMe: token expires in 30 days instead of default
- Calls `buildFrontendUser()` to resolve full user shape with role/permissions; `is_admin`/`is_staff` read from `users` table columns (v1.6.0+, no team dependency)

---

### 3.3 GET /auth/me

**Purpose:** Returns current authenticated user's full profile.

**Auth:** Bearer JWT (requireAuth)

**curl Example:**

```bash
curl https://api.softaware.net.za/auth/me \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "User retrieved",
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "username": "user@example.com",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "name": "John Doe",
      "phone": "+27123456789",
      "avatar": null,
      "is_admin": true,
      "is_staff": false,
      "is_active": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "role": { "id": 1, "name": "Admin", "slug": "admin" },
      "permissions": [{ "id": 14, "name": "All Access", "slug": "*" }]
    }
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 404 | — | User not found in database |

---

### 3.4 POST /auth/logout

**Purpose:** Server-side logout acknowledgement. JWT is stateless; client must clear token.

**Auth:** Bearer JWT (requireAuth)

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/logout \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{ "success": true, "message": "Logged out" }
```

---

### 3.5 POST /auth/refresh

**Purpose:** Exchange a valid JWT for a fresh one.

**Auth:** None (token in body)

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| accessToken | string | ✅ |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"accessToken":"eyJhbGciOiJIUzI1NiIs..."}'
```

**Success Response (200):**

```json
{ "accessToken": "eyJhbGciOiJIUzI1NiIs..." }
```

---

### 3.6 GET /auth/permissions

**Purpose:** Returns the permission array for the current user.

**Auth:** Bearer JWT (requireAuth)

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    { "id": 14, "name": "All Access", "slug": "*" }
  ]
}
```

---

### 3.7 GET /auth/2fa/status

**Purpose:** Check 2FA status, preferred method, and available methods for the authenticated user.

**Auth:** Bearer JWT (requireAuth)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "is_enabled": true,
    "has_setup": true,
    "preferred_method": "totp",
    "is_required": true,
    "available_methods": ["totp", "email", "sms"]
  }
}
```

> **Note:** `is_required` is `true` for staff/admin users. `available_methods` is `["totp", "email", "sms"]` for staff/admin and `["totp", "email"]` for clients.

---

### 3.8 POST /auth/pin/verify (v1.9.0)

**Purpose:** Quick login with email + 4-digit PIN. Alternative to email+password. Returns the same response structure as `/auth/login`.

**Auth:** None (public endpoint)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | ✅ | Valid email |
| pin | string | ✅ | Exactly 4 digits |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/pin/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","pin":"1234"}'
```

**Success Response (200) — Without 2FA:**

```json
{
  "success": true,
  "message": "PIN login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "user@example.com",
      "name": "John Doe",
      "is_admin": false,
      "role": { "id": 2, "name": "Client", "slug": "client" }
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "30d"
}
```

**Success Response (200) — With 2FA Required:**

```json
{
  "success": true,
  "requires_2fa": true,
  "two_factor_method": "totp",
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "challenge_id": "a1b2c3d4e5f6...",
  "message": "2FA verification required"
}
```

> **Note:** Same 2FA response as `/auth/login`. Auto-sends OTP for email/SMS methods. Creates push challenge for TOTP method.

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Invalid email or PIN" | Wrong email or wrong PIN (deliberately vague) |
| 400 | "Account is not active" | User account deactivated |
| 400 | "PIN login is not set up for this account. Please sign in with your password." | No PIN configured |
| 400 | "Too many failed attempts. PIN login locked for 15 minutes." | 5 failed attempts → lockout |
| 400 | "Too many failed attempts. Try again in X minute(s)." | During active lockout |

**Business Logic:**
- Looks up user by email, then retrieves PIN hash from `user_pins` table
- Checks lockout status (`locked_until` column)
- Verifies PIN via `bcrypt.compare()`
- On failure: increments `failed_attempts`; if ≥ 5, sets `locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE)`
- On success: resets `failed_attempts` to 0 and `locked_until` to NULL
- Issues 30-day JWT (same as "Remember Me" password login)
- If 2FA enabled: same flow as `/auth/login` — auto-sends OTP, creates push challenge for TOTP
- Does NOT reveal whether an email exists (returns same "Invalid email or PIN" error)

---

### 3.9 GET /auth/pin/check/:email (v1.9.0)

**Purpose:** Public endpoint to check if an email address has PIN login enabled. Used by frontend to decide whether to show PIN pad vs password form.

**Auth:** None (public endpoint)

**URL Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✅ | URL-encoded email address |

**curl Example:**

```bash
curl https://api.softaware.net.za/auth/pin/check/user%40example.com
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "has_pin": true
  }
}
```

**Business Logic:**
- Returns `has_pin: false` for non-existent emails (does not reveal whether an email exists)
- Email must be URL-encoded in the path (e.g., `user%40example.com`)

---

### 3.10 GET /auth/pin/status (v1.9.0)

**Purpose:** Check if the currently authenticated user has a PIN set. Used in the settings screen.

**Auth:** Bearer JWT (requireAuth)

**curl Example:**

```bash
curl https://api.softaware.net.za/auth/pin/status \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "has_pin": true
  }
}
```

---

### 3.11 POST /auth/pin/set (v1.9.0)

**Purpose:** Set or update the user's 4-digit PIN. Requires password confirmation for security.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| pin | string | ✅ | Exactly 4 digits (regex: `/^\d{4}$/`) |
| password | string | ✅ | Current account password |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/pin/set \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -d '{"pin":"1234","password":"currentPassword123"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "PIN set successfully"
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "PIN must be exactly 4 digits" | PIN fails regex validation |
| 400 | "Incorrect password" | bcrypt comparison failed |
| 400 | "User not found" | Invalid user ID |

**Business Logic:**
- Verifies current password via `bcrypt.compare()` against `users.passwordHash`
- Hashes PIN with `bcrypt.hash(pin, 10)` (10 salt rounds)
- Uses UPSERT: `INSERT ... ON DUPLICATE KEY UPDATE` — sets or replaces the PIN
- On update: also resets `failed_attempts` to 0 and `locked_until` to NULL

---

### 3.12 DELETE /auth/pin (v1.9.0)

**Purpose:** Remove the user's PIN login capability.

**Auth:** Bearer JWT (requireAuth)

**curl Example:**

```bash
curl -X DELETE https://api.softaware.net.za/auth/pin \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "PIN removed"
}
```

**Business Logic:**
- Deletes the user's row from `user_pins` table
- Returns success even if no PIN existed (idempotent)

---

### 3.13 POST /auth/2fa/setup

**Purpose:** Setup 2FA using a chosen method (TOTP, email, or SMS).

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| method | string | ❌ | `"totp"` (default), `"email"`, or `"sms"` |

**Success Response (200) — TOTP:**

```json
{
  "success": true,
  "message": "Scan the QR code with your authenticator app, then verify with a code.",
  "data": {
    "method": "totp",
    "secret": "JBSWY3DPEHPK3PXP",
    "qr_code": "data:image/png;base64,iVBORw0KGgo...",
    "otpauth_url": "otpauth://totp/SoftAware:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SoftAware&algorithm=SHA1&digits=6&period=30"
  }
}
```

**Success Response (200) — Email/SMS:**

```json
{
  "success": true,
  "message": "A verification code has been sent to your email.",
  "data": {
    "method": "email"
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "2FA is already enabled" | 2FA already active |
| 400 | "SMS is only available for staff and admin" | Client tried SMS method |
| 400 | "No phone number on file" | SMS method but user has no phone |
| 500 | "Failed to send OTP" | Email/SMS delivery failed |

---

### 3.9 POST /auth/2fa/verify-setup

**Purpose:** Verify the first code (TOTP / email OTP / SMS OTP) to activate 2FA.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| code | string | ✅ | 6-digit code |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully.",
  "data": {
    "backup_codes": ["A3F1B2C8", "D4E5F6A7", "B8C9D0E1", "F2A3B4C5", "D6E7F8A9", "B0C1D2E3", "F4A5B6C7", "D8E9F0A1", "B2C3D4E5", "F6A7B8C9"]
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "2FA has not been set up yet" | No pending setup found |
| 400 | "Invalid verification code" | Code does not match |
| 400 | "OTP has expired" | Email/SMS OTP older than 10 minutes |

⚠️ **Backup codes shown ONCE — user must save them.**

---

### 3.10 POST /auth/2fa/verify

**Purpose:** Verify 2FA code during login. Supports TOTP, email OTP, SMS OTP, and backup codes. **(v1.8.0)** Always attempts TOTP validation first regardless of `preferred_method`, then tries email/SMS OTP, then tries backup codes. This means a user with email as their preferred method can still enter a TOTP code from their authenticator app.

**Auth:** None (uses temp_token from login response)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| temp_token | string | ✅ | JWT from login (5-min TTL) |
| code | string | ✅ | 6-digit TOTP/OTP or 8-char backup code |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful. Two-factor verification passed.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "..." },
    "used_backup_code": false,
    "remaining_backup_codes": 10
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 3.11 POST /auth/2fa/send-otp

**Purpose:** Resend an OTP code during login for email/SMS 2FA methods.

**Auth:** None (uses temp_token from login response)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| temp_token | string | ✅ | JWT from login (5-min TTL) |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Verification code sent to your email."
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Invalid or expired temporary token" | Temp token expired or malformed |
| 400 | "2FA is not enabled" | User's 2FA not active |
| 400 | "Resend is only available for email or SMS methods" | User's method is TOTP |
| 500 | "Failed to send verification code" | Email/SMS delivery failed |

---

### 3.12 POST /auth/2fa/send-alt-otp (v1.8.0)

**Purpose:** Send an OTP code via an alternative 2FA method during login. Used when the user's preferred method is unavailable (e.g., no mobile app for TOTP push, or phone unavailable for SMS). The frontend shows the two alternative methods that are not the user's preferred method.

**Auth:** None (uses temp_token from login response)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| temp_token | string | ✅ | JWT from login (5-min TTL) |
| method | string | ✅ | `"email"` or `"sms"` |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/send-alt-otp \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs...","method":"email"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Verification code sent to your email."
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Invalid or expired temporary token" | Temp token expired or malformed |
| 400 | "2FA is not enabled" | User's 2FA not active |
| 400 | "method must be 'email' or 'sms'" | Invalid method parameter |
| 400 | "No phone number on file" | SMS method but user has no phone |
| 500 | "Failed to send verification code" | Email/SMS delivery failed |

**Business Logic:**
- Verifies `temp_token` JWT (same pattern as `/auth/2fa/verify`) — must have `purpose: '2fa'`
- Generates a 6-digit OTP, hashes with SHA-256, stores in `user_two_factor.otp_code` with `otp_expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)`
- Sends OTP via the requested method (email via `sendTwoFactorOtp()`, SMS via `sendSms()`)
- Does **not** change the user's `preferred_method` — this is a one-time alternative delivery
- The code sent can be verified via `POST /auth/2fa/verify` (which tries all validation methods)

---

### 3.13 POST /auth/2fa/disable

**Purpose:** Disable 2FA. Only available for client users — staff/admin are blocked.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| password | string | ✅ |

**Success Response (200):**

```json
{ "success": true, "message": "Two-factor authentication has been disabled." }
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Invalid password" | Wrong password |
| 400 | "2FA is not enabled" | 2FA already off |
| 403 | "Staff and admin users cannot disable 2FA" | Staff/admin tried to disable |

---

### 3.14 PUT /auth/2fa/method

**Purpose:** Change the preferred 2FA method. Requires password confirmation and a verification code for the new method.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| method | string | ✅ | `"totp"`, `"email"`, or `"sms"` |
| password | string | ✅ | Current password |
| code | string | ✅ | Verification code for the new method |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Two-factor method changed to email."
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Invalid password" | Wrong password |
| 400 | "Invalid verification code" | Code doesn't match new method |
| 400 | "SMS is only available for staff and admin" | Client tried SMS |
| 400 | "2FA is not enabled" | 2FA not active yet |

---

### 3.15 POST /auth/2fa/backup-codes

**Purpose:** Regenerate all backup codes. Requires password confirmation.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| password | string | ✅ |

**Success Response (200):**

```json
{
  "success": true,
  "message": "New backup codes generated. Previous codes are now invalid.",
  "data": {
    "backup_codes": ["A3F1B2C8", "D4E5F6A7", "..."]
  }
}
```

---

### 3.16 POST /email/test

**Purpose:** Send a test email to verify SMTP configuration.

**Auth:** Bearer JWT (requireAuth + requireAdmin)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| to | string | ✅ | Valid email address |
| subject | string | ❌ | Default: "Test Email from SoftAware" |
| body | string | ❌ | Default: test message |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/email/test \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"to":"admin@example.com"}'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Test email sent successfully",
  "data": { "messageId": "<abc123@mail.softaware.co.za>" }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Recipient email is required" | Missing `to` field |
| 500 | "Failed to send test email" | SMTP connection or auth failure |

---

### 3.17 POST /email/send

**Purpose:** Send an email using the centralized email service.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| to | string | ✅ | Valid email address |
| subject | string | ✅ | Non-empty |
| html | string | ❌ | HTML body |
| text | string | ❌ | Plain text body |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Email sent successfully",
  "data": { "messageId": "<abc123@mail.softaware.co.za>" }
}
```

---

### 3.18 GET /email/config

**Purpose:** Get current SMTP configuration. Password is masked in the response.

**Auth:** Bearer JWT (requireAuth + requireAdmin)

**curl Example:**

```bash
curl https://api.softaware.net.za/email/config \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "host": "mail.softaware.co.za",
    "port": 465,
    "username": "noreply@softaware.co.za",
    "password": "••••••••",
    "from_name": "SoftAware",
    "from_email": "noreply@softaware.co.za",
    "encryption": "ssl"
  }
}
```

---

### 3.19 PUT /email/config

**Purpose:** Create or update SMTP credentials in the `credentials` table (AES-256-GCM encrypted).

**Auth:** Bearer JWT (requireAuth + requireAdmin)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| host | string | ✅ | SMTP hostname |
| port | number | ✅ | Port number (25, 465, 587, etc.) |
| username | string | ✅ | SMTP username |
| password | string | ✅ | SMTP password |
| from_name | string | ❌ | Sender display name |
| from_email | string | ❌ | Sender email address |
| encryption | string | ❌ | `"ssl"`, `"tls"`, or `"none"` |

**Success Response (200):**

```json
{
  "success": true,
  "message": "SMTP configuration saved successfully"
}
```

**Business Logic:**
- Upserts into `credentials` table with `service_name = 'SMTP'`
- Encrypts the credentials JSON using AES-256-GCM with `ENCRYPTION_KEY` from env
- Invalidates the cached nodemailer transporter so next send uses new config

---

### 3.20 GET /email/logs

**Purpose:** Retrieve email send log entries.

**Auth:** Bearer JWT (requireAuth + requireAdmin)

**Query Parameters:**

| Param | Type | Required | Default |
|-------|------|----------|---------|
| limit | number | ❌ | 50 |
| offset | number | ❌ | 0 |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "to_email": "user@example.com",
      "subject": "Your verification code",
      "status": "sent",
      "message_id": "<abc123@mail.softaware.co.za>",
      "error": null,
      "created_at": "2026-03-05T10:30:00.000Z"
    }
  ]
}
```

---

### 3.21 POST /admin/clients/:userId/masquerade

**Purpose:** Admin logs in as a client user. Issues a JWT for the target user and a separate restore token for the admin to return to their own session.

**Auth:** Bearer JWT (requireAuth + requireAdmin)

**URL Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string (UUID) | ✅ | Target user's ID |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/admin/clients/e5f6g7h8-xxxx/masquerade \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Now masquerading as user@example.com",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "e5f6g7h8-...",
      "email": "user@example.com",
      "name": "Jane Smith",
      "is_admin": false,
      "role": { "id": 0, "name": "Client", "slug": "client" },
      "permissions": []
    },
    "adminRestoreToken": "eyJhbGciOiJIUzI1NiIs...",
    "masquerading": true,
    "adminId": "a1b2c3d4-...",
    "targetUser": {
      "id": "e5f6g7h8-...",
      "email": "user@example.com",
      "name": "Jane Smith"
    }
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Cannot masquerade as yourself" | Admin tried to masquerade as their own account |
| 403 | "Admin access required" | Caller's `users.is_admin` column is `0` (v1.6.0+) |
| 404 | "User not found" | Target userId doesn't exist |
| 404 | "Failed to build user profile" | buildFrontendUser returned null |

**Business Logic:**
- Requires `requireAuth` + `requireAdmin` middleware chain (v1.6.0: `requireAdmin` checks `users.is_admin` column directly)
- Verifies target user exists in `users` table
- Prevents self-masquerade (adminId ≠ targetUserId)
- Issues two separate JWTs via `signAccessToken()`:
  - **Masquerade token:** 1-hour expiry, scoped to target user
  - **Admin restore token:** 2-hour expiry, scoped to admin user
- Calls `buildFrontendUser(targetUserId)` for the complete user shape
- Logs: `[AdminClientManager] MASQUERADE: Admin {adminId} → User {targetUserId} ({email})`

---

### 3.22 POST /auth/masquerade/exit

**Purpose:** Exit masquerade mode and restore the admin's own session.

**Auth:** None (uses adminRestoreToken in request body)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| adminRestoreToken | string | ✅ | JWT issued during masquerade start |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/masquerade/exit \
  -H 'Content-Type: application/json' \
  -d '{"adminRestoreToken":"eyJhbGciOiJIUzI1NiIs..."}'
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Admin session restored",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "admin@softaware.co.za",
      "is_admin": true,
      "role": { "id": 1, "name": "Admin", "slug": "admin" },
      "permissions": [{ "id": 14, "name": "All Access", "slug": "*" }]
    }
  }
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "Missing adminRestoreToken" | Request body missing the token |
| 401 | "Invalid restore token" | JWT verification failed (expired/malformed) |
| 403 | "Restore token does not belong to an admin" | Decoded userId's `users.is_admin` column is `0` (v1.6.0+) |
| 404 | "Admin user not found" | Admin user no longer exists |

**Business Logic:**
- Decodes and verifies the adminRestoreToken JWT
- Re-checks admin status via `users.is_admin` column directly (v1.6.0+ — no longer queries `user_roles`/`roles` tables)
- Issues a fresh JWT for the admin user
- Calls `buildFrontendUser(adminId)` for complete admin user shape
- Logs: `[Auth] MASQUERADE EXIT: Admin {adminId} restored their session`

---

### 3.23 POST /auth/2fa/push-approve (v1.7.0)

**Purpose:** Mobile app approves or denies a push-to-approve 2FA challenge. Called by the mobile app when the user taps "Approve" or "Deny" on the login approval screen.

**Auth:** Bearer JWT (requireAuth) — the mobile app must be logged in with its own session

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| challenge_id | string | ✅ | Non-empty string | The push challenge ID from the FCM notification payload |
| action | string | ✅ | `'approve'` or `'deny'` | Whether to approve or deny the login |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/push-approve \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"challenge_id":"a1b2c3d4e5f6...","action":"approve"}'
```

**Success Response (200) — Approved:**

```json
{
  "success": true,
  "message": "Login approved"
}
```

**Success Response (200) — Denied:**

```json
{
  "success": true,
  "message": "Login denied"
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "challenge_id and action (approve/deny) are required" | Missing or invalid request body |
| 404 | "Challenge not found or does not belong to you" | Challenge doesn't exist, belongs to another user, or has wrong `source` |
| 400 | "Challenge has expired" | Challenge is older than 5 minutes |
| 400 | "Challenge is no longer pending" | Challenge already completed, expired, or denied |

**Business Logic:**
- Requires JWT authentication (the mobile app user's token)
- Validates `challenge_id` and `action` from request body
- Looks up challenge in `mobile_auth_challenges` WHERE `id = ?` AND `user_id = ?` AND `source = 'push'`
- Verifies challenge is not expired (created_at < 5 minutes ago)
- Verifies challenge status is `'pending'`
- If `action === 'approve'`: updates status to `'completed'`
- If `action === 'deny'`: updates status to `'denied'`
- The web frontend discovers the result by polling `POST /auth/2fa/push-status`

---

### 3.24 POST /auth/2fa/push-status (v1.7.0)

**Purpose:** Web frontend polls this endpoint to check whether a push-to-approve challenge has been completed by the mobile app. When the challenge is completed, issues a full JWT — same response shape as `POST /auth/2fa/verify`.

**Auth:** None (uses temp_token in request body, same as other 2FA verification endpoints)

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| temp_token | string | ✅ | Valid JWT with `purpose: '2fa'` | The temporary token from the login response |
| challenge_id | string | ✅ | Non-empty string | The push challenge ID from the login response |

**curl Example:**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/push-status \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs...","challenge_id":"a1b2c3d4e5f6..."}'
```

**Response (200) — Still Pending:**

```json
{
  "status": "pending"
}
```

**Response (200) — Denied by User:**

```json
{
  "status": "denied"
}
```

**Response (200) — Expired:**

```json
{
  "status": "expired"
}
```

**Success Response (200) — Approved (issues JWT):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "a1b2c3d4-...",
      "email": "user@example.com",
      "name": "John Doe",
      "is_admin": true,
      "role": { "id": 1, "name": "Admin", "slug": "admin" },
      "permissions": [{ "id": 14, "name": "All Access", "slug": "*" }]
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "1h"
}
```

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | "temp_token and challenge_id are required" | Missing request body fields |
| 400 | "Invalid or expired temporary token" | JWT verification failed or `purpose` is not `'2fa'` |
| 404 | "Challenge not found" | Challenge doesn't exist for this user |

**Business Logic:**
- Verifies `temp_token` JWT (same pattern as `/auth/2fa/verify`) — must have `purpose: '2fa'`
- Extracts `userId` and `rememberMe` from temp_token
- Looks up challenge in `mobile_auth_challenges` WHERE `id = ?` AND `user_id = ?`
- If `status === 'pending'`: returns `{ status: 'pending' }` (frontend should continue polling)
- If `status === 'denied'`: returns `{ status: 'denied' }` (frontend should show denial message)
- If `status === 'expired'` or challenge expired by time: returns `{ status: 'expired' }`
- If `status === 'completed'`: issues full JWT using `signAccessToken()` and `buildFrontendUser()`, same response shape as the existing `/auth/2fa/verify` endpoint (dual-format with `data.token`, `accessToken`, `token`)
- Respects `rememberMe` from temp_token for token expiry (30d vs default)
- **Polling pattern:** Frontend should poll every 2-3 seconds with a maximum of ~100 polls (5-minute window)

---

### 3.25 POST /auth/2fa/mobile-challenge

**Purpose:** Create a QR authentication challenge for mobile app login. The web frontend generates a QR code that the mobile app scans to authenticate.

**Auth:** Bearer JWT (requireAuth)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| remember_me | boolean | ❌ | Whether the resulting JWT should use extended expiry (30 days). Default: false |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "challenge_id": "a1b2c3d4e5f6...",
    "qr_data": "softaware://auth?challenge=a1b2c3d4e5f6...",
    "expires_in": 300
  }
}
```

**Business Logic:**
- Creates a challenge in `mobile_auth_challenges` with `source = 'qr'`
- Generates a `short_code` for manual entry (v1.8.0)
- Signs a JWT token stored in the `token` column for QR flow completion
- Challenge expires after 5 minutes

---

### 3.26 GET /auth/2fa/mobile-qr

**Purpose:** Get the current pending QR authentication challenge for the user, including the QR code data and human-friendly short code for manual entry.

**Auth:** Bearer JWT (requireAuth)

**curl Example:**

```bash
curl https://api.softaware.net.za/auth/2fa/mobile-qr \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'
```

**Success Response (200) — With pending challenge:**

```json
{
  "success": true,
  "data": {
    "challenge_id": "a1b2c3d4e5f6...",
    "qr_data": "softaware://auth?challenge=a1b2c3d4e5f6...",
    "status": "pending",
    "challenge_code": "482916",
    "created_at": "2026-03-13T10:30:00.000Z"
  }
}
```

> **v1.8.0:** Response now includes `challenge_code` — a 6-digit numeric code (e.g., `482916`) for manual entry in the mobile app. Displayed below the QR code when scanning fails.

**Success Response (200) — No pending challenge:**

```json
{
  "success": true,
  "data": null
}
```

**Business Logic:**
- Queries `mobile_auth_challenges` for the most recent pending challenge for the authenticated user
- SELECT now includes `short_code` column (v1.8.0), returned as `challenge_code` in the response
- Returns `null` data if no pending challenge exists

---

### 3.27 GET /auth/2fa/mobile-qr/status/:id

**Purpose:** Poll the status of a QR authentication challenge. Used by the web frontend to detect when the mobile app has scanned and completed the QR auth flow.

**Auth:** Bearer JWT (requireAuth)

**URL Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | ✅ | Challenge ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "pending"
  }
}
```

**Business Logic:**
- Returns the current status of the challenge: `pending`, `completed`, or `expired`
- When `completed`, the mobile app has authenticated and the challenge token can be used
