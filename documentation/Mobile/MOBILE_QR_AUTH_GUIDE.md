# Mobile App — QR-Based 2FA Authentication Guide

**Version:** 2.0.0  
**Date:** 2026-03-13  
**Backend Version Required:** ≥ 1.9.0  
**Base URL:** `https://api.softaware.net.za`

---

## 1. Overview

When a user has **TOTP (App)** selected as their 2FA method, the mobile app uses a **QR-based authentication flow** instead of requiring the user to type a 6-digit code.

### How It Works

| Step | Actor | Action |
|------|-------|--------|
| 1 | Mobile App | User logs in with email + password **or PIN** |
| 2 | Backend | Returns `requires_2fa: true`, `two_factor_method: 'totp'`, `temp_token` |
| 3 | Mobile App | Detects `method === 'totp'` → calls `POST /auth/2fa/mobile-challenge` |
| 4 | Backend | Creates a 5-minute challenge → returns `challenge_id` |
| 5 | Mobile App | Shows "Open your profile on the web and scan the QR code" UI |
| 6 | Mobile App | Polls `POST /auth/2fa/mobile-verify` after QR scan |
| 7 | User | Opens web profile → sees QR code automatically (the web polls for pending challenges) |
| 8 | Mobile App | User taps "Scan QR" → scans QR code from web profile |
| 9 | QR Data | Contains `{ type, challengeId, secret }` |
| 10 | Mobile App | Sends `{ temp_token, challenge_id, secret }` to `POST /auth/2fa/mobile-verify` |
| 11 | Backend | Validates challenge → issues full JWT → marks challenge complete |
| 12 | Mobile App | Stores JWT, proceeds to dashboard |

> **Note:** For Email and SMS 2FA methods, the mobile app uses the standard OTP code entry flow (no QR needed). This QR flow is **only for TOTP (App) method**.

### Visual Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   MOBILE APP    │         │     BACKEND      │         │   WEB PROFILE   │
│                 │         │                  │         │  (browser)      │
│ 1. Login        │────────▶│ 2. requires_2fa  │         │                 │
│    email+pass   │◀────────│    temp_token    │         │                 │
│                 │         │                  │         │                 │
│ 3. Create       │────────▶│ 4. Store         │         │                 │
│    challenge    │◀────────│    challenge     │         │                 │
│    (temp_token) │         │    return id     │         │                 │
│                 │         │                  │         │                 │
│ 5. Show         │         │                  │    ┌───▶│ 7. Poll for     │
│    "Scan QR"    │         │                  │    │    │    pending QR   │
│    screen       │         │  6. QR ready  ───┼────┘    │    (every 5s)   │
│                 │         │                  │         │                 │
│                 │         │                  │◀────────│ 8. GET /mobile-qr│
│                 │         │                  │────────▶│ 9. Display QR   │
│                 │         │                  │         │                 │
│ 10. Scan QR  ◀─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤    (on screen)  │
│     (camera)    │         │                  │         │                 │
│                 │         │                  │         │                 │
│ 11. Send verify │────────▶│ 12. Validate     │         │                 │
│   challenge_id  │◀────────│     → JWT        │────────▶│ 13. Shows       │
│   + secret      │         │     issued       │         │     "Success!"  │
│                 │         │                  │         │                 │
│ 14. Store JWT   │         │                  │         │                 │
│     → Dashboard │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

---

## 2. API Endpoints

### 2.1 POST /auth/login (existing)

Standard login — no changes needed. When 2FA is required, the response includes a `temp_token`.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "secretpass",
  "rememberMe": true
}
```

**Response (2FA required):**

```json
{
  "success": true,
  "requires_2fa": true,
  "two_factor_method": "totp",
  "message": "Two-factor authentication required.",
  "temp_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2.1b POST /auth/pin/verify (NEW — PIN Quick Login)

Alternative login using a 4-digit PIN instead of a password. The user must have previously set up a PIN in their account settings. Returns the same response structure as `/auth/login`.

**Auth:** None (public endpoint)

**Request:**

```json
{
  "email": "user@example.com",
  "pin": "1234"
}
```

**Success Response (no 2FA):**

```json
{
  "success": true,
  "message": "PIN login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "bdc2efb3-d7b9-47b8-9a09-79daabb58c7e",
      "email": "user@example.com",
      "name": "John Doe",
      "is_admin": false,
      "role": { "id": 2, "name": "Client", "slug": "client" }
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "30d",
  "user": { ... }
}
```

**Success Response (2FA required — same as /auth/login):**

```json
{
  "success": true,
  "requires_2fa": true,
  "two_factor_method": "totp",
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "challenge_id": "a1b2c3d4-e5f6-...",
  "message": "2FA verification required"
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "Invalid email or PIN" | Wrong email or wrong PIN (deliberately vague for security) |
| 400 | "Account is not active" | User account is deactivated |
| 400 | "PIN login is not set up for this account. Please sign in with your password." | No PIN configured |
| 400 | "Too many failed attempts. PIN login locked for 15 minutes." | 5 failed attempts → lockout |
| 400 | "Too many failed attempts. Try again in X minute(s)." | During active lockout window |

**Rate Limiting:**
- **5 failed attempts** → 15-minute lockout
- Lockout resets automatically after 15 minutes
- Successful PIN login resets the failed attempt counter

### 2.1c GET /auth/pin/check/:email (NEW — Check PIN Availability)

Public endpoint to check if an email address has PIN login enabled. Used by the mobile app to decide whether to show the PIN pad.

**Auth:** None (public endpoint)

**Request:**

```
GET /api/auth/pin/check/user%40example.com
```

**Response:**

```json
{
  "success": true,
  "data": {
    "has_pin": true
  }
}
```

**Notes:**
- Returns `has_pin: false` for non-existent emails (does not reveal whether an email exists)
- Email must be URL-encoded in the path

### 2.1d GET /auth/pin/status (NEW — Current User PIN Status)

Check if the currently authenticated user has a PIN set. Used in the settings screen.

**Auth:** Required (JWT Bearer token)

**Response:**

```json
{
  "success": true,
  "data": {
    "has_pin": true
  }
}
```

### 2.1e POST /auth/pin/set (NEW — Set or Update PIN)

Set or change the user's 4-digit PIN. Requires password confirmation.

**Auth:** Required (JWT Bearer token)

**Request:**

```json
{
  "pin": "1234",
  "password": "currentPassword123"
}
```

**Success Response:**

```json
{
  "success": true,
  "message": "PIN set successfully"
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "PIN must be exactly 4 digits" | PIN is not 4 digits |
| 400 | "Incorrect password" | Password verification failed |
| 400 | "User not found" | Invalid user ID |

### 2.1f DELETE /auth/pin (NEW — Remove PIN)

Remove the user's PIN login capability.

**Auth:** Required (JWT Bearer token)

**Response:**

```json
{
  "success": true,
  "message": "PIN removed"
}
```

**Decision Logic in Mobile App:**

```
if (response.requires_2fa) {
  if (response.two_factor_method === 'totp') {
    → Use QR-based flow (this guide)
  } else {
    → Use standard OTP code entry (email/SMS code)
  }
} else {
  → Store JWT, navigate to dashboard
}
```

> **Note:** This same decision logic applies whether the user logged in with email+password (`POST /auth/login`) or with email+PIN (`POST /auth/pin/verify`). Both endpoints return the same 2FA response structure.

---

### 2.2 POST /auth/2fa/mobile-challenge

Creates a mobile authentication challenge. Call this immediately after receiving `requires_2fa: true` with `method: 'totp'`.

**Auth:** None (uses temp_token in body)

**Request:**

```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Mobile authentication challenge created. Open your profile on the web to scan the QR code.",
  "data": {
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "expires_in": 300
  }
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "Invalid or expired temporary token. Please log in again." | temp_token expired (5 min TTL) |
| 400 | "Two-factor authentication is not enabled." | No 2FA row or not enabled |
| 400 | "Mobile QR challenge is only available for TOTP (app) 2FA method." | User has email/SMS 2FA, not TOTP |

**Notes:**
- Challenge expires in **5 minutes**
- Creating a new challenge **automatically expires** any previous pending challenges for the same user
- `expires_in` is in seconds

---

### 2.3 POST /auth/2fa/mobile-verify

Submit the scanned QR data to complete authentication. Call this after the user scans the QR code from the web profile.

**Auth:** None (uses temp_token in body)

**Request:**

```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "secret": "e3b0c44298fc1c149afbf4c8996fb924..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Mobile authentication successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "admin-softaware-001",
      "email": "admin@softaware.co.za",
      "name": "Admin",
      "is_admin": true,
      "role": { "id": 1, "name": "Admin", "slug": "admin" },
      "permissions": [{ "id": 14, "name": "All Access", "slug": "*" }]
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "30d",
  "user": { ... }
}
```

**Error Responses:**

| Status | Message | When |
|--------|---------|------|
| 400 | "Invalid or expired temporary token." | temp_token expired |
| 400 | "Challenge not found or already used." | Invalid challenge_id or already completed/expired |
| 400 | "Challenge does not match this user." | challenge_id belongs to a different user |
| 400 | "Challenge has expired. Please start a new login." | 5-minute window elapsed |
| 400 | "Invalid QR code data." | secret doesn't match |

**Notes:**
- The `token` / `accessToken` fields contain the same JWT — use whichever your app prefers
- `expiresIn` is `"30d"` if the user checked "Remember me" during login, otherwise omitted (default 1h)
- After success, store the JWT and use it for all authenticated API requests
- The challenge is marked `completed` — it cannot be reused

---

### 2.4 POST /auth/2fa/verify (existing — for fallback)

The existing OTP code verification endpoint still works. If the mobile app user prefers to type a TOTP code manually (e.g., from a separate authenticator app), this endpoint accepts 6-digit TOTP codes and 8-character backup codes.

**Request:**

```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIs...",
  "code": "123456"
}
```

The mobile app should offer both options:
1. **Primary:** "Scan QR from web profile" (this guide)
2. **Fallback:** "Enter code manually" → shows numeric input field

---

## 3. QR Code Data Format

When the mobile app scans the QR code displayed on the web profile, the QR contains a **JSON string** with this structure:

```json
{
  "type": "softaware_mobile_auth",
  "challengeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "secret": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"softaware_mobile_auth"`. Use this to identify the QR as a mobile auth QR (vs other QR codes). |
| `challengeId` | string (UUID) | The challenge ID to send to the verify endpoint. |
| `secret` | string (64-char hex) | The one-time secret to prove the QR was scanned. Send as-is to the verify endpoint. |

### Parsing Logic (pseudocode)

```
scannedText = scanQRCode()

try {
  data = JSON.parse(scannedText)
  
  if (data.type !== "softaware_mobile_auth") {
    showError("Invalid QR code. Please scan the QR code from your SoftAware web profile.")
    return
  }
  
  if (!data.challengeId || !data.secret) {
    showError("Invalid QR code data.")
    return
  }
  
  // Submit to backend
  response = POST /auth/2fa/mobile-verify {
    temp_token: storedTempToken,
    challenge_id: data.challengeId,
    secret: data.secret
  }
  
  if (response.success) {
    storeJWT(response.data.token)
    navigateToDashboard()
  }
} catch {
  showError("Could not read QR code. Please try again.")
}
```

---

## 4. Mobile App UI Implementation Guide

### 4.1 Login Screen Modification

The login screen should support two login modes: **password** and **PIN**.

**Returning User Detection:**

On app launch or when the login screen loads:
1. Check if a `last_login_email` is stored locally
2. If yes, call `GET /auth/pin/check/:email` to check if PIN login is available
3. If `has_pin: true`, show PIN login mode by default
4. If not, show standard email+password form

```
onLoginScreenLoad:
  email = getStoredEmail("last_login_email")
  if (email) {
    response = GET /auth/pin/check/{email}
    if (response.data.has_pin) {
      showPinLoginMode(email)   // → PIN pad with 4 digit inputs
    } else {
      showPasswordLoginMode()   // → standard email + password
    }
  } else {
    showPasswordLoginMode()
  }
```

**PIN Login Mode UI:**

```
┌──────────────────────────────────────┐
│         Welcome back, John!          │
│         john@example.com             │
│                                      │
│         Enter your PIN               │
│                                      │
│      ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│      │ ● │ │ ● │ │ ● │ │   │       │
│      └───┘ └───┘ └───┘ └───┘       │
│                                      │
│      (auto-submits on 4th digit)     │
│                                      │
│  [ Use password instead ]            │ ← switches to password mode
│  [ Not you? Different account ]      │ ← clears stored email, shows password
│                                      │
└──────────────────────────────────────┘
```

**PIN Login Flow:**

```
onPinComplete(pin):  // triggered when user enters 4th digit
  response = POST /auth/pin/verify { email, pin }

  if (response.success && !response.requires_2fa) {
    storeEmail("last_login_email", email)
    storeJWT(response.data.token)
    navigateToDashboard()
  }
  else if (response.requires_2fa) {
    // Same 2FA handling as password login
    if (response.two_factor_method === "totp") {
      navigate to → MobileQRAuthScreen
    } else {
      navigate to → OTPEntryScreen
    }
  }
  else {
    showError(response.message)
    clearPinInputs()
  }
```

**Password Login Flow (after `POST /auth/login`):**

After successful login:

```
if (two_factor_method === "totp") {
  navigate to → MobileQRAuthScreen
} else if (two_factor_method === "email") {
  navigate to → OTPEntryScreen (with message "Check your email")
} else if (two_factor_method === "sms") {
  navigate to → OTPEntryScreen (with message "Check your phone")
}
```

**Always store the email after any successful login:**

```
AuthModel.setLastEmail(email)  // saves to local storage for next login
```

### 4.2 MobileQRAuthScreen Design

```
┌──────────────────────────────────────┐
│          🔐 Verify Your Identity     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │     📱 → 🖥️ → 📷            │    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  To complete sign-in:                │
│                                      │
│  1. Open SoftAware in your browser   │
│  2. Go to Account Settings           │
│  3. A QR code will appear            │
│     automatically                    │
│  4. Tap "Scan QR" below to scan it   │
│                                      │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │       [ 📷 Scan QR Code ]   │    │ ← Primary action button
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  ── or ──                            │
│                                      │
│  [ Enter code manually ]             │ ← Text link / secondary button
│                                      │
│  Expires in 4:32                     │ ← Countdown timer
│                                      │
│  [ ← Back to Login ]                │
│                                      │
└──────────────────────────────────────┘
```

### 4.3 Screen Lifecycle

```
onScreenLoad:
  1. Call POST /auth/2fa/mobile-challenge { temp_token }
  2. Store challenge_id
  3. Start countdown timer (expires_in seconds)
  4. Show instructions + "Scan QR" button

onScanQRTapped:
  1. Open device camera / QR scanner
  2. On scan success:
     a. Parse JSON from QR
     b. Validate type === "softaware_mobile_auth"
     c. Call POST /auth/2fa/mobile-verify {
          temp_token,
          challenge_id: scannedData.challengeId,
          secret: scannedData.secret
        }
     d. On success → store JWT, navigate to dashboard
     e. On error → show error message, allow retry

onCountdownExpired:
  1. Show "Challenge expired" message
  2. Show "Try Again" button → goes back to login

onEnterCodeManuallyTapped:
  1. Navigate to standard OTP entry screen
  2. User types 6-digit TOTP code from authenticator app
  3. Calls POST /auth/2fa/verify { temp_token, code }
```

### 4.4 Error Handling

| Error | User Message | Action |
|-------|-------------|--------|
| temp_token expired | "Your session has expired. Please log in again." | Navigate back to login |
| Challenge expired | "The QR challenge has expired. Please try again." | Navigate back to login |
| Invalid QR code type | "This QR code is not for authentication. Please scan the QR code from your SoftAware profile." | Stay on screen, allow retry |
| Secret mismatch | "Invalid QR code. Please try scanning again." | Stay on screen, allow retry |
| Network error | "Unable to connect. Please check your internet connection." | Stay on screen, allow retry |
| Challenge already used | "This challenge has already been used. Please log in again." | Navigate back to login |

---

## 5. Timing & Expiry

| Timer | Duration | What Happens |
|-------|----------|-------------|
| `temp_token` | 5 minutes | Backend rejects all requests with expired temp_token. Mobile must re-login. |
| Challenge | 5 minutes | Backend marks challenge as expired. Mobile must re-login and create new challenge. |
| QR code display (web) | Polls every 5s | Web profile auto-refreshes. QR disappears when challenge expires or completes. |
| Challenge status poll (web) | Every 3s | Web shows "✅ Authenticated" when mobile completes the flow. |

> **Important:** Both the temp_token and the challenge expire in 5 minutes. The user has a 5-minute window from login to QR scan.

---

## 6. Sequence Diagram

```
Mobile App                   Backend                    Web Browser
    │                           │                           │
    │── POST /auth/login ──────▶│                           │
    │◀── { requires_2fa,        │                           │
    │      method: 'totp',      │                           │
    │      temp_token } ────────│                           │
    │                           │                           │
    │── POST /2fa/mobile-       │                           │
    │   challenge ─────────────▶│                           │
    │   { temp_token }          │── INSERT challenge ──────▶│
    │◀── { challenge_id,        │                           │
    │      expires_in: 300 } ───│                           │
    │                           │                           │
    │  Shows "Scan QR" screen   │                    User opens
    │                           │                    Account Settings
    │                           │                           │
    │                           │◀── GET /2fa/mobile-qr ────│
    │                           │    (authenticated, JWT)    │
    │                           │── { has_pending: true,    │
    │                           │    qr_code, challenge_id }▶│
    │                           │                           │
    │                           │                    Shows QR code
    │                           │                           │
    │  User taps "Scan QR"      │                           │
    │  Camera scans QR from     │                           │
    │  web screen ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
    │                           │                           │
    │── POST /2fa/mobile-verify▶│                           │
    │   { temp_token,           │                           │
    │     challenge_id,         │── UPDATE challenge        │
    │     secret }              │   status='completed' ────▶│
    │◀── { token, user } ──────│                           │
    │                           │                           │
    │  Stores JWT               │◀── GET /mobile-qr/status─│
    │  → Dashboard              │── { status:'completed' }─▶│
    │                           │                    Shows "✅ Success"
```

---

## 7. Testing Checklist

### Happy Path
- [ ] Login with email/password → receives `requires_2fa: true, method: 'totp'`
- [ ] Login with email/PIN → receives `requires_2fa: true, method: 'totp'` (same flow)
- [ ] Call `POST /auth/2fa/mobile-challenge` → receives `challenge_id`
- [ ] Web profile shows QR code automatically (poll detects pending challenge)
- [ ] Scan QR with mobile app camera
- [ ] Parse QR JSON → extract `challengeId` and `secret`
- [ ] Call `POST /auth/2fa/mobile-verify` → receives JWT + user
- [ ] Store JWT → navigate to dashboard
- [ ] Web profile shows "✅ Mobile App Authenticated" then auto-hides

### Edge Cases
- [ ] Expired temp_token → app shows "session expired", returns to login
- [ ] Expired challenge (waited > 5 min) → app shows "challenge expired"
- [ ] Invalid QR code (not softaware_mobile_auth type) → helpful error message
- [ ] No web session open → QR not shown (user must open web profile first)
- [ ] Multiple login attempts → only latest challenge is valid (previous ones expired)
- [ ] User chooses "Enter code manually" → standard TOTP code entry works
- [ ] Poor camera / can't scan → fallback to manual code entry

### Security
- [ ] QR secret is a one-time 64-character hex string (cryptographically random)
- [ ] Challenge can only be used once (marked `completed` after verify)
- [ ] Challenge is bound to specific user (user_id check)
- [ ] Timing-safe comparison on secret (prevents timing attacks)
- [ ] Both temp_token and challenge expire in 5 minutes

---

## 8. Dependencies

### Mobile App Libraries Needed

| Library | Purpose | Platform |
|---------|---------|----------|
| QR Code Scanner | Camera-based QR scanning | `react-native-camera` or `expo-barcode-scanner` (React Native), `AVCaptureSession` (iOS native), `ML Kit` (Android native) |
| JSON Parser | Parse scanned QR text | Built-in |
| HTTP Client | API calls | `axios`, `fetch`, or platform native |
| Secure Storage | Store JWT token | `react-native-keychain` (RN), `Keychain` (iOS), `EncryptedSharedPreferences` (Android) |

### No Changes Needed To

- SMS OTP flow (unchanged)
- Email OTP flow (unchanged)  
- TOTP manual code entry (still works as fallback)
- Registration flow
- Password reset flow
- PIN login integrates with all existing 2FA methods (no separate handling needed)

---

## 9. API Quick Reference

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | POST | `/auth/login` | None | Login with email+password → returns JWT or temp_token if 2FA |
| 2 | POST | `/auth/pin/verify` | None | **NEW** Login with email+PIN → returns JWT or temp_token if 2FA |
| 3 | GET | `/auth/pin/check/:email` | None | **NEW** Check if email has PIN login enabled |
| 4 | GET | `/auth/pin/status` | JWT | **NEW** Check if current user has PIN set |
| 5 | POST | `/auth/pin/set` | JWT | **NEW** Set or update 4-digit PIN (requires password) |
| 6 | DELETE | `/auth/pin` | JWT | **NEW** Remove user's PIN |
| 7 | POST | `/auth/2fa/mobile-challenge` | temp_token in body | Create QR challenge for mobile login |
| 8 | POST | `/auth/2fa/mobile-verify` | temp_token in body | Submit scanned QR data → get JWT |
| 9 | POST | `/auth/2fa/verify` | temp_token in body | Fallback: manual TOTP/OTP code entry |
| 10 | POST | `/auth/2fa/send-otp` | temp_token in body | Resend OTP (email/SMS only, not TOTP) |

### cURL Examples

**Login with PIN:**
```bash
curl -X POST https://api.softaware.net.za/api/auth/pin/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","pin":"1234"}'
```

**Check if email has PIN:**
```bash
curl https://api.softaware.net.za/api/auth/pin/check/user%40example.com
```

**Set PIN (authenticated):**
```bash
curl -X POST https://api.softaware.net.za/api/auth/pin/set \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGci...' \
  -d '{"pin":"1234","password":"currentPassword123"}'
```

**Remove PIN (authenticated):**
```bash
curl -X DELETE https://api.softaware.net.za/api/auth/pin \
  -H 'Authorization: Bearer eyJhbGci...'
```

**Create challenge:**
```bash
curl -X POST https://api.softaware.net.za/api/auth/2fa/mobile-challenge \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs..."}'
```

**Verify (after scanning QR):**
```bash
curl -X POST https://api.softaware.net.za/api/auth/2fa/mobile-verify \
  -H 'Content-Type: application/json' \
  -d '{
    "temp_token": "eyJhbGciOiJIUzI1NiIs...",
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "secret": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }'
```

**Fallback (manual code):**
```bash
curl -X POST https://api.softaware.net.za/api/auth/2fa/verify \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs...","code":"123456"}'
```

---

## 10. PIN Login — Mobile App Implementation Guide

### 10.1 Overview

PIN login provides a faster re-authentication experience. Instead of typing a full password, returning users enter a 4-digit numeric PIN. The PIN:

- Is **bcrypt-hashed** on the server (never stored in plaintext)
- Is **rate-limited** (5 failed attempts → 15-minute lockout)
- Does **NOT** bypass 2FA — if 2FA is enabled, the standard 2FA flow still applies after PIN entry
- Uses a **30-day JWT** (same as "Remember Me" password login)

### 10.2 PIN Setup — Settings Screen

Add a "Quick PIN Login" section to the mobile app's Account/Security settings.

**UI Design:**

```
┌──────────────────────────────────────┐
│  🔑 Quick PIN Login                 │
│                                      │
│  Set a 4-digit PIN for faster        │
│  sign-in on this app.                │
│                                      │
│  Status: ● Not Set                   │  ← or "✅ Active"
│                                      │
│  [ Set Up PIN ]                      │  ← or "Change PIN" / "Remove"
└──────────────────────────────────────┘
```

**Setup Flow:**

```
onSetUpPinTapped:
  1. Check current status: GET /auth/pin/status
  2. Show PIN entry screen (4 digit boxes)

  Step 1: "Enter a 4-digit PIN"
    → User enters 4 digits
    → Tap "Next"

  Step 2: "Confirm your PIN"
    → User re-enters the same 4 digits
    → If mismatch → "PINs do not match. Try again."

  Step 3: "Enter your current password"
    → User enters account password
    → Tap "Set PIN"
    → POST /auth/pin/set { pin: "1234", password: "currentPass" }

  On success → show "PIN set! You can now use your PIN for quick login."
  On error  → show error message (e.g., "Incorrect password")

onRemovePinTapped:
  1. Confirm dialog: "Remove PIN? You'll need your password to sign in."
  2. DELETE /auth/pin
  3. On success → update UI to "Not Set"
```

### 10.3 PIN Login — Login Screen

**Returning User Detection:**

```
onLoginScreenLoad:
  email = secureStorage.get("last_login_email")
  if (email) {
    result = GET /auth/pin/check/{urlEncode(email)}
    if (result.data.has_pin) {
      showPinMode = true
    }
  }
```

**PIN Input Behavior:**
- 4 individual digit input boxes
- `inputMode: "numeric"` (shows number keyboard)
- `type: "password"` (masks digits as dots)
- Auto-advance to next box on digit entry
- Backspace navigates to previous box
- **Auto-submit** when 4th digit is entered (no submit button needed)

**PIN Submit:**

```
onAllFourDigitsEntered(pin):
  showLoadingSpinner()

  try {
    response = POST /auth/pin/verify { email, pin }

    if (response.success && response.data?.token) {
      // Direct login — no 2FA
      secureStorage.set("jwt_token", response.data.token)
      secureStorage.set("user", response.data.user)
      secureStorage.set("last_login_email", email)
      navigateToDashboard()
    }
    else if (response.requires_2fa) {
      // PIN was valid, but 2FA still required
      store temp_token = response.temp_token
      store method = response.two_factor_method
      store challenge_id = response.challenge_id  // for TOTP push

      if (method === "totp") {
        navigate to → MobileQRAuthScreen
      } else {
        navigate to → OTPEntryScreen
      }
    }
  } catch (error) {
    if (error.status === 400) {
      showError(error.message)  // "Invalid email or PIN", lockout message, etc.
      clearPinInputs()
      focusFirstPinInput()
    }
  }
```

**"Use password instead" button:**
- Switches to standard email+password form
- Pre-fills the email field from stored email

**"Not you? Different account" button:**
- Clears stored `last_login_email`
- Shows standard email+password form with empty fields

### 10.4 PIN Security Notes

| Aspect | Detail |
|--------|--------|
| Storage | PIN is bcrypt-hashed on server. Never store PIN locally. |
| Transmission | PIN is sent over HTTPS only. |
| Rate Limiting | 5 failed attempts → 15-minute lockout. Counter resets on success. |
| 2FA | PIN does NOT bypass 2FA. If 2FA is enabled, the full 2FA flow still runs. |
| Session | PIN login issues a 30-day JWT (same as "Remember Me"). |
| Uniqueness | One PIN per user account. Setting a new PIN replaces the old one. |
| Email check | `GET /pin/check/:email` does not reveal whether an email exists (returns `has_pin: false` for unknown emails). |

### 10.5 PIN Testing Checklist

**Setup:**
- [ ] `GET /auth/pin/status` returns `{ has_pin: false }` for new user
- [ ] Set PIN with valid 4 digits + correct password → success
- [ ] Set PIN with wrong password → "Incorrect password" error
- [ ] Set PIN with 3 digits → validation error
- [ ] `GET /auth/pin/status` returns `{ has_pin: true }` after setup
- [ ] Change PIN → replaces old PIN, new one works
- [ ] `DELETE /auth/pin` → removes PIN, status returns false

**Login:**
- [ ] `GET /auth/pin/check/:email` → `has_pin: true` for user with PIN
- [ ] `GET /auth/pin/check/:email` → `has_pin: false` for non-existent email
- [ ] `POST /auth/pin/verify` with correct PIN → JWT returned
- [ ] `POST /auth/pin/verify` with wrong PIN → "Invalid email or PIN"
- [ ] 5 wrong PINs → "Too many failed attempts. PIN login locked for 15 minutes."
- [ ] During lockout → "Try again in X minute(s)"
- [ ] After lockout expires → PIN login works again
- [ ] PIN login with 2FA enabled → returns `requires_2fa: true` + `temp_token`
- [ ] PIN login 2FA flow → same as password login 2FA flow

**Returning User:**
- [ ] After successful login, `last_login_email` is stored
- [ ] On next login screen load, PIN pad shown automatically
- [ ] "Use password instead" switches to password form
- [ ] "Not you?" clears stored email and shows password form
