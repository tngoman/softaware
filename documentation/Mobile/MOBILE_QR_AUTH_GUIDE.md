# Mobile App — QR-Based 2FA Authentication Guide

**Version:** 1.0.0  
**Date:** 2026-03-06  
**Backend Version Required:** ≥ 1.5.0  
**Base URL:** `https://api.softaware.net.za`

---

## 1. Overview

When a user has **TOTP (App)** selected as their 2FA method, the mobile app uses a **QR-based authentication flow** instead of requiring the user to type a 6-digit code.

### How It Works

| Step | Actor | Action |
|------|-------|--------|
| 1 | Mobile App | User logs in with email + password |
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

**Decision Logic in Mobile App:**

```
if (response.requires_2fa) {
  if (response.two_factor_method === 'totp') {
    → Use QR-based flow (this guide)
  } else {
    → Use standard OTP code entry (email/SMS code)
  }
}
```

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

After `POST /auth/login` returns `requires_2fa: true`:

```
if (two_factor_method === "totp") {
  navigate to → MobileQRAuthScreen
} else if (two_factor_method === "email") {
  navigate to → OTPEntryScreen (with message "Check your email")
} else if (two_factor_method === "sms") {
  navigate to → OTPEntryScreen (with message "Check your phone")
}
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

---

## 9. API Quick Reference

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | POST | `/auth/login` | None | Login → returns temp_token if 2FA required |
| 2 | POST | `/auth/2fa/mobile-challenge` | temp_token in body | Create QR challenge for mobile login |
| 3 | POST | `/auth/2fa/mobile-verify` | temp_token in body | Submit scanned QR data → get JWT |
| 4 | POST | `/auth/2fa/verify` | temp_token in body | Fallback: manual TOTP code entry |
| 5 | POST | `/auth/2fa/send-otp` | temp_token in body | Resend OTP (email/SMS only, not TOTP) |

### cURL Examples

**Create challenge:**
```bash
curl -X POST https://api.softaware.net.za/auth/2fa/mobile-challenge \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs..."}'
```

**Verify (after scanning QR):**
```bash
curl -X POST https://api.softaware.net.za/auth/2fa/mobile-verify \
  -H 'Content-Type: application/json' \
  -d '{
    "temp_token": "eyJhbGciOiJIUzI1NiIs...",
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "secret": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }'
```

**Fallback (manual code):**
```bash
curl -X POST https://api.softaware.net.za/auth/2fa/verify \
  -H 'Content-Type: application/json' \
  -d '{"temp_token":"eyJhbGciOiJIUzI1NiIs...","code":"123456"}'
```
