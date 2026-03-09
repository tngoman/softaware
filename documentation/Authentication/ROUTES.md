# Authentication Module - API Routes

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 21 |
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
| 8 | POST | /auth/2fa/setup | JWT | Setup 2FA (TOTP / email / SMS) |
| 9 | POST | /auth/2fa/verify-setup | JWT | Verify code, enable 2FA, get backup codes |
| 10 | POST | /auth/2fa/verify | None (temp_token) | Verify 2FA during login (any method) |
| 11 | POST | /auth/2fa/send-otp | None (temp_token) | Resend OTP for email/SMS 2FA |
| 12 | POST | /auth/2fa/disable | JWT | Disable 2FA (clients only) |
| 13 | PUT | /auth/2fa/method | JWT | Change preferred 2FA method |
| 14 | POST | /auth/2fa/backup-codes | JWT | Regenerate backup codes |
| 15 | POST | /email/test | JWT (admin) | Send test email |
| 16 | POST | /email/send | JWT | Send email |
| 17 | GET | /email/config | JWT (admin) | Get SMTP config (password masked) |
| 18 | PUT | /email/config | JWT (admin) | Upsert SMTP credentials |
| 19 | GET | /email/logs | JWT (admin) | View email send log |
| 20 | POST | /admin/clients/:userId/masquerade | JWT (admin) | Login as a client user |
| 21 | POST | /auth/masquerade/exit | None (restore token) | Return to admin session |

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
  "message": "Two-factor authentication required.",
  "temp_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

> **Note:** `two_factor_method` is one of `"totp"`, `"email"`, or `"sms"`. For email/SMS methods, the backend auto-sends the OTP code before returning this response.

**Error Responses:**

| Status | Error | When |
|--------|-------|------|
| 400 | `BAD_REQUEST` | "Invalid email or password" |

**Business Logic:**
- Looks up user by email, compares bcrypt hash
- If 2FA enabled: issues 5-minute temp_token with `purpose: '2fa'`
- If rememberMe: token expires in 30 days instead of default
- Calls `buildFrontendUser()` to resolve full user shape with role/permissions (no team dependency)

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

### 3.8 POST /auth/2fa/setup

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

**Purpose:** Verify 2FA code during login. Supports TOTP, email OTP, SMS OTP, and backup codes.

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

### 3.12 POST /auth/2fa/disable

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

### 3.13 PUT /auth/2fa/method

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

### 3.14 POST /auth/2fa/backup-codes

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

### 3.15 POST /email/test

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

### 3.16 POST /email/send

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

### 3.17 GET /email/config

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

### 3.18 PUT /email/config

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

### 3.19 GET /email/logs

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

### 3.20 POST /admin/clients/:userId/masquerade

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
| 403 | "Admin access required" | Caller is not an admin/super_admin |
| 404 | "User not found" | Target userId doesn't exist |
| 404 | "Failed to build user profile" | buildFrontendUser returned null |

**Business Logic:**
- Requires `requireAuth` + `requireAdmin` middleware chain
- Verifies target user exists in `users` table
- Prevents self-masquerade (adminId ≠ targetUserId)
- Issues two separate JWTs via `signAccessToken()`:
  - **Masquerade token:** 1-hour expiry, scoped to target user
  - **Admin restore token:** 2-hour expiry, scoped to admin user
- Calls `buildFrontendUser(targetUserId)` for the complete user shape
- Logs: `[AdminClientManager] MASQUERADE: Admin {adminId} → User {targetUserId} ({email})`

---

### 3.21 POST /auth/masquerade/exit

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
| 403 | "Restore token does not belong to an admin" | Decoded userId has no admin/super_admin role |
| 404 | "Admin user not found" | Admin user no longer exists |

**Business Logic:**
- Decodes and verifies the adminRestoreToken JWT
- Re-checks admin role via `user_roles` JOIN `roles` (prevents privilege escalation if role was removed during masquerade)
- Issues a fresh JWT for the admin user
- Calls `buildFrontendUser(adminId)` for complete admin user shape
- Logs: `[Auth] MASQUERADE EXIT: Admin {adminId} restored their session`
