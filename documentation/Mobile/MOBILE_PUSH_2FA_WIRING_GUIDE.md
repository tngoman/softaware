# Mobile App — Push-to-Approve 2FA Wiring Guide

**Version:** 3.0.0  
**Date:** 2026-03-12  
**Backend Version Required:** ≥ 1.7.0  
**Base URL:** `https://api.softaware.net.za`  
**Prerequisite Docs:** Read `MOBILE_APP_REFERENCE.md` first.

---

## 1. Overview

This feature implements **GitHub Mobile-style login approval**. It has two parts:

1. **One-tap activation** — The user enables 2FA directly from the mobile app settings. No QR codes. No external authenticator app. One tap and it's done.
2. **Push-to-approve login** — When the user logs in on the **web**, the mobile app receives a push notification. The user taps **Approve** and the web login completes instantly. No codes to type.

### How Activation Works

The user is already authenticated in the mobile app. They go to Settings → Two-Factor Settings and tap **"Enable App 2FA"**. Behind the scenes, the mobile app:

1. Calls `POST /auth/2fa/setup { method: "totp" }` → backend generates a TOTP secret
2. Uses a TOTP library to generate a 6-digit code from that secret
3. Calls `POST /auth/2fa/verify-setup { code: "123456" }` → backend enables 2FA

The user never sees a QR code, never scans anything, never types a code. The mobile app handles everything silently. After activation, the user's account has TOTP 2FA enabled, their FCM token is already registered, and push-to-approve is ready.

### How Login Approval Works

```
WEB BROWSER                          BACKEND                          MOBILE APP
                                                                   (already logged in)
    │                                    │                                │
    │  POST /auth/login                  │                                │
    │  { email, password }               │                                │
    │ ──────────────────────────────────► │                                │
    │                                    │                                │
    │  ◄─ { requires_2fa: true,          │                                │
    │       temp_token, challenge_id }   │                                │
    │                                    │  ── FCM Push ────────────────► │
    │  Show: "Waiting for approval..."   │  { type: 'login_approval',    │
    │                                    │    challenge_id, user_email }  │
    │                                    │                                │
    │                                    │                                │  📱 Push arrives:
    │                                    │                                │  "Login Approval Required"
    │                                    │                                │
    │                                    │                                │  User taps notification
    │                                    │                                │  ↓
    │                                    │                                │  LoginApprovalScreen opens
    │                                    │                                │  ↓
    │                                    │                                │  User taps ✅ "Approve"
    │                                    │                                │
    │                                    │  ◄── POST /auth/2fa/push-approve
    │                                    │      { challenge_id,           │
    │                                    │        action: 'approve' }     │
    │                                    │      (with mobile JWT)         │
    │                                    │                                │
    │  POST /auth/2fa/push-status        │                                │
    │  { temp_token, challenge_id }      │                                │
    │ ──────────────────────────────────► │                                │
    │                                    │                                │
    │  ◄─ { status: 'completed',         │                                │
    │       token: <jwt>, user: {...} }  │                                │
    │                                    │                                │
    │  ✅ Web login complete!            │                                │
    └────────────────────────────────────┘────────────────────────────────┘
```

### User Experience Summary

| Step | Actor | What Happens |
|------|-------|-------------|
| 1 | User | Enters email + password on the **web** login page |
| 2 | Backend | Detects TOTP 2FA + registered FCM devices → creates push challenge → sends FCM push |
| 3 | Mobile App | Receives push notification: **"Login Approval Required"** |
| 4 | User | Taps the notification (or opens app and sees the alert) → approval screen opens |
| 5 | User | Taps **"Approve"** ✅ (single tap) |
| 6 | Mobile App | Calls `POST /auth/2fa/push-approve` → backend marks challenge as completed |
| 7 | Web Browser | Polls `POST /auth/2fa/push-status` → receives JWT → user is logged in |

### Prerequisites

- The user must be **already authenticated in the mobile app** (valid JWT session)
- The mobile app must have a **registered FCM token** on the backend (`fcm_tokens` table — this happens automatically on login)
- The user must have **TOTP 2FA enabled** (activated from the mobile app or the web)
- If no FCM token exists, the backend omits `challenge_id` and the web falls back to manual TOTP code entry

---

## 2. Backend API (Already Implemented)

The backend is fully implemented. This section documents the exact contracts the mobile app must integrate with.

### 2.1 2FA Status — `GET /auth/2fa/status`

**Check whether 2FA is enabled** for the authenticated user. Use this on the TwoFactorSettings screen to show the current state.

- **Auth:** Requires valid JWT

**Response (not enabled):**

```json
{
  "success": true,
  "data": {
    "is_enabled": false,
    "has_setup": false,
    "preferred_method": "totp",
    "is_required": false,
    "available_methods": ["totp", "email"]
  }
}
```

**Response (enabled):**

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

| Field | Type | Description |
|-------|------|-------------|
| `is_enabled` | boolean | Whether 2FA is currently active |
| `has_setup` | boolean | Whether a `user_two_factor` row exists |
| `preferred_method` | `"totp"` \| `"email"` \| `"sms"` | Currently configured method (defaults to `"totp"` if no row) |
| `is_required` | boolean | `true` for staff/admin — they cannot disable 2FA |
| `available_methods` | string[] | Staff/admin: `["totp","email","sms"]`, clients: `["totp","email"]` |
```

### 2.2 2FA Setup — `POST /auth/2fa/setup`

**Start 2FA setup** for the chosen method. For TOTP, generates a secret and QR code. The mobile app only needs the `secret` field — ignore `qr_code` (that's for web browsers).

- **Auth:** Requires valid JWT

**Request:**

```json
{
  "method": "totp"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Scan the QR code with your authenticator app, then verify with a code.",
  "data": {
    "method": "totp",
    "secret": "JBSWY3DPEHPK3PXP...",
    "qr_code": "data:image/png;base64,...",
    "otpauth_url": "otpauth://totp/SoftAware:user@example.com?secret=..."
  }
}
```

> **Mobile app ignores `qr_code` and `otpauth_url`.** It only needs `data.secret` to generate a verification code.

### 2.3 2FA Verify Setup — `POST /auth/2fa/verify-setup`

**Complete 2FA setup** by verifying a TOTP code generated from the secret. After this call succeeds, 2FA is enabled and backup codes are returned.

- **Auth:** Requires valid JWT

**Request:**

```json
{
  "code": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Two-factor authentication has been enabled.",
  "data": {
    "backup_codes": [
      "A1B2C3D4",
      "E5F6G7H8",
      "..."
    ]
  }
}
```

> **Important:** Show the backup codes to the user once and instruct them to save them. These codes can be used to regain access if the mobile app is unavailable.

### 2.4 2FA Disable — `POST /auth/2fa/disable`

**Disable 2FA** for the authenticated user.

- **Auth:** Requires valid JWT
- **Staff/admin cannot disable 2FA** — the backend blocks it. They may only change their method via `PUT /auth/2fa/method`.

**Request:**

```json
{
  "password": "user_account_password"
}
```

> **Important:** Disabling requires the user's **account password**, NOT a TOTP code. The mobile app must prompt the user to enter their password. This is the same password they use to sign in.

### 2.5 Login Response (Web Context)

When the web calls `POST /auth/login` and the user has TOTP 2FA with registered mobile devices:

```json
{
  "success": true,
  "requires_2fa": true,
  "two_factor_method": "totp",
  "message": "Two-factor authentication required. Approve the login on your mobile app, or enter your authenticator code.",
  "temp_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

> `challenge_id` is only present when the user has registered FCM devices. If absent, the web falls back to standard TOTP code entry.

### 2.6 Push-Approve — `POST /auth/2fa/push-approve`

**Called by the mobile app** when the user taps Approve or Deny.

- **Auth:** Requires valid JWT (`Authorization: Bearer <mobile_jwt>`)
- **Validation:** The JWT must belong to the same user who owns the challenge

**Request:**

```json
{
  "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "action": "approve"
}
```

**Success Response (approve):**

```json
{
  "success": true,
  "message": "Login approved. The web session will be authenticated shortly.",
  "data": {
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed"
  }
}
```

**Success Response (deny):**

```json
{
  "success": true,
  "message": "Login denied. The web session will not be authenticated.",
  "data": {
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "denied"
  }
}
```

**Error Responses:**

| Condition | Message |
|-----------|---------|
| Challenge not found | "Challenge not found." |
| Wrong user | "This login challenge does not belong to your account." |
| Already approved | "This login has already been approved." |
| Already denied | "This login has already been denied." |
| Expired | "This challenge has expired. The user must log in again." |

### 2.7 Push-Status — `POST /auth/2fa/push-status`

**Polled by the web frontend** (every 3 seconds). The mobile app does NOT call this endpoint.

- **Auth:** Uses the `temp_token` from the login response (not a full JWT)

**Request:**

```json
{
  "temp_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Responses by status:**

| `data.status` | Meaning | Extra Fields |
|---|---|---|
| `pending` | Waiting for mobile approval | — |
| `completed` | Approved → login complete | `token`, `user` (full JWT + user object) |
| `denied` | User tapped Deny | — |
| `expired` | Challenge timed out (5 min) | — |
| `not_found` | Challenge doesn't exist | — |

### 2.8 FCM Push Payload

The backend sends this FCM payload via `sendPushToUser()`:

```json
{
  "notification": {
    "title": "Login Approval Required",
    "body": "Tap to approve sign-in for John Doe"
  },
  "data": {
    "type": "login_approval",
    "challenge_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_email": "john@example.com"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "softaware_default",
      "sound": "default"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"login_approval"` | Use this to identify push-to-approve notifications. Must match exactly. |
| `challenge_id` | string (UUID) | The challenge ID to send to `POST /auth/2fa/push-approve` |
| `user_email` | string | The email of the account being logged into (for display on the approval screen) |

---

## 3. Dependencies

### Required NPM Package

Install a TOTP library for the one-tap activation flow. The mobile app needs to generate a 6-digit TOTP code from the secret returned by `/auth/2fa/setup`:

```bash
npm install otpauth
```

This is the same library the backend uses. It's lightweight and works in React Native.

**Usage:**

```typescript
import { TOTP, Secret } from 'otpauth';

function generateTotpCode(secretBase32: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secretBase32),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}
```

---

## 4. Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/totp.ts` | **CREATE** | TOTP code generation helper |
| `src/utils/secureStorage.ts` | **CREATE** | Securely store TOTP secret for disable flow |
| `src/screens/auth/LoginApprovalScreen.tsx` | **CREATE** | Push notification → Approve/Deny screen (root-level modal) |
| `src/api/auth.ts` | **MODIFY** | Add `setup2fa()`, `verifySetup2fa()`, `get2faStatus()`, `disable2fa()`, `approveLogin()` |
| `src/screens/auth/TwoFactorSettingsScreen.tsx` | **MODIFY** | Add one-tap enable/disable UI |
| `src/services/notificationNavigation.ts` | **MODIFY** | Add `login_approval` type → navigate to `LoginApproval` screen |
| `src/services/notificationChannels.ts` | **MODIFY** | Map `login_approval` to a high-priority channel |
| `src/navigation/types.ts` | **MODIFY** | Add `LoginApproval` to `RootStackParamList` |
| `src/navigation/RootNavigator.tsx` | **MODIFY** | Register `LoginApprovalScreen` as a root-level modal |

---

## 5. Mobile App Implementation

### 5.1 TOTP Utility (`src/utils/totp.ts`)

Create a helper to generate TOTP codes from a base32 secret:

```typescript
import { TOTP, Secret } from 'otpauth';

/**
 * Generate a 6-digit TOTP code from a base32 secret.
 * Uses the same algorithm as the backend (SHA1, 30s period, 6 digits).
 */
export function generateTotpCode(secretBase32: string): string {
  const totp = new TOTP({
    secret: Secret.fromBase32(secretBase32),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  return totp.generate();
}
```

### 5.2 Secure Storage (`src/utils/secureStorage.ts`)

Store the TOTP secret securely so it can be used for the optional **mobile auto-login** enhancement (see §9 — "Mobile App Login with Stored Secret"). The disable flow uses the user's password instead, so the stored secret is only needed for seamless mobile login:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOTP_SECRET_KEY = '@2fa_totp_secret';

export async function storeTotpSecret(secret: string): Promise<void> {
  await AsyncStorage.setItem(TOTP_SECRET_KEY, secret);
}

export async function getTotpSecret(): Promise<string | null> {
  return AsyncStorage.getItem(TOTP_SECRET_KEY);
}

export async function clearTotpSecret(): Promise<void> {
  await AsyncStorage.removeItem(TOTP_SECRET_KEY);
}
```

> **Note:** For production, consider using `react-native-keychain` or `expo-secure-store` instead of AsyncStorage for storing the TOTP secret. AsyncStorage is unencrypted on Android. For now, AsyncStorage works since the JWT token is also stored there.

### 5.3 API Module Changes (`src/api/auth.ts`)

Add these methods to the `authApi` export:

```typescript
/**
 * Check current 2FA status for the authenticated user.
 */
get2faStatus() {
  return api.get<{
    is_enabled: boolean;
    has_setup: boolean;
    preferred_method: 'totp' | 'email' | 'sms';
    is_required: boolean;
    available_methods: ('totp' | 'email' | 'sms')[];
  }>('/auth/2fa/status');
},

/**
 * Start 2FA setup. For TOTP, returns a secret the app uses to generate codes.
 * The mobile app ignores qr_code and otpauth_url — those are for web browsers.
 */
setup2fa(method: 'totp' | 'email' | 'sms' = 'totp') {
  return api.post<{ method: string; secret?: string; qr_code?: string; otpauth_url?: string }>(
    '/auth/2fa/setup',
    { method },
  );
},

/**
 * Complete 2FA setup by verifying a TOTP code. Returns backup codes on success.
 */
verifySetup2fa(code: string) {
  return api.post<{ backup_codes: string[] }>(
    '/auth/2fa/verify-setup',
    { code },
  );
},

/**
 * Disable 2FA. Requires the user's account password (NOT a TOTP code).
 * Note: Staff/admin users cannot disable 2FA — the backend will reject the request.
 */
disable2fa(password: string) {
  return api.post<void>(
    '/auth/2fa/disable',
    { password },
  );
},

/**
 * Approve or deny a push-based 2FA login challenge.
 * Called when the user taps "Approve" or "Deny" on the LoginApprovalScreen.
 */
approveLogin(challengeId: string, action: 'approve' | 'deny' = 'approve') {
  return api.post<{ challenge_id: string; status: string }>(
    '/auth/2fa/push-approve',
    { challenge_id: challengeId, action },
  );
},
```

### 5.4 One-Tap Activation Logic

This is the key UX difference. The user taps one button and the mobile app handles TOTP setup silently:

```typescript
import { authApi } from '../../api';
import { generateTotpCode } from '../../utils/totp';
import { storeTotpSecret, clearTotpSecret, getTotpSecret } from '../../utils/secureStorage';

/**
 * Enable 2FA with one tap. The mobile app silently:
 * 1. Gets a TOTP secret from the backend
 * 2. Generates a verification code from it
 * 3. Sends the code back to complete setup
 * The user never sees a QR code or types a code.
 */
async function enableAppTwoFactor(): Promise<string[]> {
  // Step 1: Ask backend to generate a TOTP secret
  const setupResult = await authApi.setup2fa('totp');
  if (!setupResult.secret) {
    throw new Error('Failed to generate 2FA secret.');
  }

  // Step 2: Store the secret securely for later use (disable flow, auto-login)
  await storeTotpSecret(setupResult.secret);

  // Step 3: Generate a TOTP code from the secret (same algorithm as backend)
  const code = generateTotpCode(setupResult.secret);

  // Step 4: Verify the code to complete setup — 2FA is now enabled
  const verifyResult = await authApi.verifySetup2fa(code);

  // Return backup codes for the user to save
  return verifyResult.backup_codes;
}

/**
 * Disable 2FA. Requires the user's account password.
 * The mobile app must prompt the user for their password before calling this.
 * Note: Staff/admin users cannot disable 2FA — check `is_required` from status endpoint.
 */
async function disableAppTwoFactor(password: string): Promise<void> {
  await authApi.disable2fa(password);
  await clearTotpSecret();
}
```

### 5.5 Navigation Setup (Login Approval Screen)

The `LoginApprovalScreen` must be reachable from **any state** — the user could be on any screen when the push arrives. Register it as a **root-level modal**, same pattern as `IncomingCall` (see `MOBILE_APP_REFERENCE.md` §4).

**In `src/navigation/types.ts`**, add to `RootStackParamList`:

```typescript
export type RootStackParamList = {
  Main: undefined;
  IncomingCall: { callId: string; callerName: string; callerAvatar?: string; callType: 'audio' | 'video' };
  ActiveCall: { callType: 'audio' | 'video'; remoteName: string };
  // Push-to-approve login
  LoginApproval: {
    challengeId: string;
    userEmail: string;
  };
};
```

**In `src/navigation/RootNavigator.tsx`**, add alongside `IncomingCall` and `ActiveCall`:

```typescript
<RootStack.Screen
  name="LoginApproval"
  component={LoginApprovalScreen}
  options={{
    presentation: 'fullScreenModal',
    headerShown: false,
    animation: 'slide_from_bottom',
  }}
/>
```

> **Why root-level?** The user may be on the Dashboard, in a Chat, or anywhere else when the push arrives. Root-level modals are navigable from any context using the global navigation ref.

### 5.6 Push Notification Routing

**In `src/services/notificationNavigation.ts`**, add to `resolveNotificationRoute()`:

```typescript
case 'login_approval':
  return {
    screen: 'LoginApproval',
    params: {
      challengeId: data.challenge_id,
      userEmail: data.user_email,
    },
  };
```

**In `src/services/notificationChannels.ts`**, add to `getChannelForType()`:

```typescript
case 'login_approval':
  return {
    channelId: 'softaware_login_approval',
    channelName: 'Login Approvals',
    importance: 4, // HIGH — heads-up notification
    sound: 'default',
  };
```

> Use **high importance** (4) so the notification appears as a heads-up banner, similar to incoming call notifications.

### 5.7 Foreground Push Handling

When the app is in the foreground and a `login_approval` push arrives, navigate directly to the approval screen instead of showing a toast. Add this to the foreground handler (in `AuthContext` or `chatNotificationHandler.ts`):

```typescript
if (remoteMessage.data?.type === 'login_approval') {
  const navRef = getNavigationRef();
  if (navRef?.isReady()) {
    navRef.navigate('LoginApproval', {
      challengeId: remoteMessage.data.challenge_id,
      userEmail: remoteMessage.data.user_email,
    });
  }
  return; // Skip default toast/notification handling
}
```

> Same approach as `incoming_call` — immediate navigation, no intermediate notification.

### 5.8 LoginApprovalScreen

Create `src/screens/auth/LoginApprovalScreen.tsx`:

```
┌──────────────────────────────────────┐
│                                      │
│          🔐 Login Approval           │  ← GradientHeader (no back button)
│                                      │
├──────────────────────────────────────┤
│                                      │
│     ┌──────────────────────────┐     │
│     │                          │     │
│     │    👤  Someone is        │     │
│     │    trying to sign in     │     │
│     │    to your account       │     │
│     │                          │     │
│     └──────────────────────────┘     │
│                                      │
│     Account:                         │
│     john@example.com                 │  ← From push data.user_email
│                                      │
│     Time:                            │
│     March 12, 2026 at 14:32         │  ← Current timestamp
│                                      │
│     ⏱️  Expires in 4:28              │  ← Countdown (5 min from open)
│                                      │
│                                      │
│     ┌──────────────────────────┐     │
│     │                          │     │
│     │    ✅  Approve Login     │     │  ← Primary button (Primary[500])
│     │                          │     │
│     └──────────────────────────┘     │
│                                      │
│     ┌──────────────────────────┐     │
│     │                          │     │
│     │    ❌  Deny              │     │  ← Danger button (Scarlet[500])
│     │                          │     │
│     └──────────────────────────┘     │
│                                      │
│                                      │
│     ⚠️  If you didn't try to         │  ← Warning text (Gray[500])
│     sign in, tap Deny and            │
│     change your password             │
│     immediately.                     │
│                                      │
└──────────────────────────────────────┘
```

**Full component:**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Vibration,
  TouchableOpacity,
} from 'react-native';
import { format } from 'date-fns';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Primary, Scarlet, Gray, Spacing, FontSize, FontWeight, BorderRadius, Shadow, Semantic } from '../../theme';
import { authApi } from '../../api';
import { GradientHeader } from '../../components/ui/GradientHeader';
import Toast from 'react-native-toast-message';

export function LoginApprovalScreen({ navigation, route }: any) {
  const { challengeId, userEmail } = route.params;
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'deny' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 minutes
  const [completed, setCompleted] = useState(false);

  // Vibrate to get attention when screen opens
  useEffect(() => {
    Vibration.vibrate([0, 200, 100, 200]);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (completed) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [completed]);

  const handleExpired = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Login Expired',
      text2: 'The login request has expired.',
    });
    navigation.goBack();
  }, [navigation]);

  const handleAction = useCallback(async (selectedAction: 'approve' | 'deny') => {
    setLoading(true);
    setAction(selectedAction);
    try {
      await authApi.approveLogin(challengeId, selectedAction);
      setCompleted(true);

      Toast.show({
        type: selectedAction === 'approve' ? 'success' : 'info',
        text1: selectedAction === 'approve' ? 'Login Approved' : 'Login Denied',
        text2: selectedAction === 'approve'
          ? 'The web session has been authenticated.'
          : 'The login attempt has been blocked.',
      });

      // Auto-close after a brief delay so the user sees the confirmation
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      const message = error?.message || 'Something went wrong. Please try again.';
      Alert.alert('Error', message);
      setAction(null);
    } finally {
      setLoading(false);
    }
  }, [challengeId, navigation]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  // ── Completed State ──
  if (completed) {
    return (
      <View style={styles.container}>
        <GradientHeader title="Login Approval" />
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={action === 'approve' ? 'check-circle' : 'close-circle'}
              size={80}
              color={action === 'approve' ? Semantic.success.text : Scarlet[500]}
            />
          </View>
          <Text style={styles.completedTitle}>
            {action === 'approve' ? 'Login Approved' : 'Login Denied'}
          </Text>
          <Text style={styles.completedSubtitle}>
            {action === 'approve'
              ? 'The web session is now authenticated.'
              : 'The login attempt has been blocked.'}
          </Text>
        </View>
      </View>
    );
  }

  // ── Approval State ──
  return (
    <View style={styles.container}>
      <GradientHeader title="Login Approval" />
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-lock" size={64} color={Primary[500]} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Sign-In Request</Text>
        <Text style={styles.subtitle}>
          Someone is trying to sign in to your account
        </Text>

        {/* Details card */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account" size={20} color={Gray[500]} />
            <Text style={styles.detailLabel}>Account</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{userEmail}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={Gray[500]} />
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{format(new Date(), 'MMM d, yyyy \'at\' HH:mm')}</Text>
          </View>
          <View style={styles.timerRow}>
            <MaterialCommunityIcons name="timer-outline" size={20} color={secondsLeft < 60 ? Scarlet[500] : Gray[500]} />
            <Text style={[styles.timerText, secondsLeft < 60 && styles.timerWarning]}>
              Expires in {minutes}:{seconds.toString().padStart(2, '0')}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveButton, loading && styles.buttonDisabled]}
            onPress={() => handleAction('approve')}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="check-bold" size={22} color="#FFFFFF" />
            <Text style={styles.approveButtonText}>
              {loading && action === 'approve' ? 'Approving...' : 'Approve Login'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.denyButton, loading && styles.buttonDisabled]}
            onPress={() => handleAction('deny')}
            disabled={loading}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close-thick" size={22} color={Scarlet[500]} />
            <Text style={styles.denyButtonText}>
              {loading && action === 'deny' ? 'Denying...' : 'Deny'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View style={styles.warningContainer}>
          <MaterialCommunityIcons name="alert-outline" size={18} color={Semantic.warning.text} />
          <Text style={styles.warningText}>
            If you didn't try to sign in, tap Deny and change your password immediately.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Gray[50],
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Gray[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Gray[500],
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    ...Shadow.md,
    marginBottom: Spacing.xxl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Gray[100],
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Gray[500],
    marginLeft: Spacing.sm,
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Gray[800],
    textAlign: 'right',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  timerText: {
    fontSize: FontSize.sm,
    color: Gray[500],
    marginLeft: Spacing.sm,
  },
  timerWarning: {
    color: Scarlet[500],
    fontWeight: FontWeight.semibold,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Primary[500],
    borderRadius: BorderRadius.base,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  approveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  denyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.base,
    paddingVertical: Spacing.base,
    borderWidth: 1,
    borderColor: Scarlet[500],
    gap: Spacing.sm,
  },
  denyButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Scarlet[500],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Gray[500],
    lineHeight: 18,
  },
  completedTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Gray[900],
    marginTop: Spacing.base,
  },
  completedSubtitle: {
    fontSize: FontSize.md,
    color: Gray[500],
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});
```

---

## 6. TwoFactorSettingsScreen Update

The existing `TwoFactorSettingsScreen` needs to support the one-tap activation flow. Here's the reference implementation:

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Primary, Scarlet, Gray, Spacing, FontSize, FontWeight, BorderRadius, Shadow, Semantic } from '../../theme';
import { authApi } from '../../api';
import { GradientHeader } from '../../components/ui/GradientHeader';
import { generateTotpCode } from '../../utils/totp';
import { storeTotpSecret, clearTotpSecret, getTotpSecret } from '../../utils/secureStorage';
import Toast from 'react-native-toast-message';

export function TwoFactorSettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Fetch current 2FA status on mount
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await authApi.get2faStatus();
      setIsEnabled(status.is_enabled);
      setIsRequired(status.is_required); // Staff/admin cannot disable
    } catch (error: any) {
      console.warn('[2FA Settings] Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Enable 2FA (one tap) ──
  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      // Step 1: Setup — get TOTP secret from backend
      const setupResult = await authApi.setup2fa('totp');
      if (!setupResult.secret) {
        throw new Error('Failed to generate 2FA secret.');
      }

      // Step 2: Store secret securely
      await storeTotpSecret(setupResult.secret);

      // Step 3: Generate code and verify (completes setup)
      const code = generateTotpCode(setupResult.secret);
      const verifyResult = await authApi.verifySetup2fa(code);

      // Step 4: Show backup codes
      setBackupCodes(verifyResult.backup_codes);
      setIsEnabled(true);

      Toast.show({
        type: 'success',
        text1: 'App 2FA Enabled',
        text2: 'Your account is now protected with push-to-approve.',
      });
    } catch (error: any) {
      const message = error?.message || 'Failed to enable 2FA. Please try again.';
      Alert.alert('Error', message);
      await clearTotpSecret(); // Clean up on failure
    } finally {
      setEnabling(false);
    }
  }, []);

  // ── Disable 2FA ──
  const handleDisable = useCallback(async () => {
    // Staff/admin cannot disable 2FA
    if (isRequired) {
      Alert.alert('Cannot Disable', 'Staff and admin accounts are required to have 2FA enabled. You may change your 2FA method instead.');
      return;
    }

    // Prompt for password (required by the backend)
    Alert.prompt(
      'Disable 2FA?',
      'Enter your account password to confirm. Your account will be less secure without two-factor authentication.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async (password?: string) => {
            if (!password) { Alert.alert('Error', 'Password is required.'); return; }
            setDisabling(true);
            try {
              await authApi.disable2fa(password);
              await clearTotpSecret();
              setIsEnabled(false);
              setBackupCodes(null);

              Toast.show({
                type: 'info',
                text1: '2FA Disabled',
                text2: 'Two-factor authentication has been turned off.',
              });
            } catch (error: any) {
              const message = error?.response?.data?.message || error?.message || 'Failed to disable 2FA.';
              Alert.alert('Error', message);
            } finally {
              setDisabling(false);
            }
          },
        },
      ],
      'secure-text', // Input type — hides password
    );
  }, [isRequired]);

  if (loading) {
    return (
      <View style={styles.container}>
        <GradientHeader title="Two-Factor Authentication" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Primary[500]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GradientHeader title="Two-Factor Authentication" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Status card */}
        <View style={styles.statusCard}>
          <MaterialCommunityIcons
            name={isEnabled ? 'shield-check' : 'shield-off-outline'}
            size={48}
            color={isEnabled ? Semantic.success.text : Gray[400]}
          />
          <Text style={styles.statusTitle}>
            {isEnabled ? 'App 2FA is Active' : 'App 2FA is Off'}
          </Text>
          <Text style={styles.statusDescription}>
            {isEnabled
              ? 'Your account is protected. When you sign in on the web, you\'ll receive a push notification to approve the login from this app.'
              : 'Protect your account with one-tap login approval. When you sign in on the web, you\'ll get a push notification to approve the login from this app.'}
          </Text>
        </View>

        {/* Action button */}
        {isEnabled ? (
          <>
            {!isRequired && (
              <TouchableOpacity
                style={[styles.disableButton, disabling && styles.buttonDisabled]}
                onPress={handleDisable}
                disabled={disabling}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="shield-off-outline" size={20} color={Scarlet[500]} />
                <Text style={styles.disableButtonText}>
                  {disabling ? 'Disabling...' : 'Disable App 2FA'}
                </Text>
              </TouchableOpacity>
            )}
            {isRequired && (
              <View style={styles.requiredBadge}>
                <MaterialCommunityIcons name="lock" size={16} color={Gray[500]} />
                <Text style={styles.requiredText}>
                  2FA is required for your account and cannot be disabled.
                </Text>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.enableButton, enabling && styles.buttonDisabled]}
            onPress={handleEnable}
            disabled={enabling}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shield-check" size={20} color="#FFFFFF" />
            <Text style={styles.enableButtonText}>
              {enabling ? 'Enabling...' : 'Enable App 2FA'}
            </Text>
          </TouchableOpacity>
        )}

        {/* How it works explanation (only when disabled) */}
        {!isEnabled && (
          <View style={styles.howItWorks}>
            <Text style={styles.howItWorksTitle}>How it works</Text>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Tap "Enable App 2FA" above</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>When you sign in on the web, you'll get a push notification on this phone</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Tap "Approve" to sign in — no codes needed</Text>
            </View>
          </View>
        )}

        {/* Backup codes (shown after enabling) */}
        {backupCodes && (
          <View style={styles.backupCodesCard}>
            <MaterialCommunityIcons name="key-variant" size={24} color={Semantic.warning.text} />
            <Text style={styles.backupCodesTitle}>Save Your Backup Codes</Text>
            <Text style={styles.backupCodesDescription}>
              If you lose access to this phone, use one of these codes to sign in. Each code can only be used once. Save them somewhere safe.
            </Text>
            <View style={styles.codesGrid}>
              {backupCodes.map((code, index) => (
                <Text key={index} style={styles.codeItem}>{code}</Text>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// Styles follow the standard screen pattern — theme tokens only, no hardcoded values.
// See MOBILE_APP_REFERENCE.md §17 for full conventions.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Gray[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: Spacing.xl },
  statusCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadow.md,
    marginBottom: Spacing.xl,
  },
  statusTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Gray[900],
    marginTop: Spacing.base,
  },
  statusDescription: {
    fontSize: FontSize.md,
    color: Gray[500],
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Primary[500],
    borderRadius: BorderRadius.base,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  enableButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  disableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.base,
    paddingVertical: Spacing.base,
    borderWidth: 1,
    borderColor: Scarlet[500],
    gap: Spacing.sm,
  },
  disableButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: Scarlet[500],
  },
  buttonDisabled: { opacity: 0.6 },
  howItWorks: {
    marginTop: Spacing.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadow.sm,
  },
  howItWorksTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Gray[900],
    marginBottom: Spacing.base,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Primary[500],
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Gray[700],
    lineHeight: 22,
  },
  backupCodesCard: {
    marginTop: Spacing.xl,
    backgroundColor: Semantic.warning.bg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Semantic.warning.border,
  },
  backupCodesTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Gray[900],
    marginTop: Spacing.sm,
  },
  backupCodesDescription: {
    fontSize: FontSize.sm,
    color: Gray[600],
    marginTop: Spacing.xs,
    marginBottom: Spacing.base,
    lineHeight: 20,
  },
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  codeItem: {
    fontFamily: 'monospace',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Gray[800],
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});
```

---

## 7. Implementation Checklist

### Phase 1: Dependencies & Utilities (15 min)

- [ ] Install `otpauth` package: `npm install otpauth`
- [ ] Create `src/utils/totp.ts` with `generateTotpCode()` (see §5.1)
- [ ] Create `src/utils/secureStorage.ts` with secret storage helpers (see §5.2)

### Phase 2: API Integration (15 min)

- [ ] Add `get2faStatus()`, `setup2fa()`, `verifySetup2fa()`, `disable2fa()`, `approveLogin()` to `src/api/auth.ts` (see §5.3)
- [ ] Re-export from `src/api/index.ts` (if not already exported via `authApi`)

### Phase 3: One-Tap Activation (45 min)

- [ ] Update `src/screens/auth/TwoFactorSettingsScreen.tsx` with enable/disable flow (see §6)
- [ ] Test: tap Enable → 2FA enabled → backup codes shown
- [ ] Test: tap Disable → confirmation → 2FA disabled
- [ ] Test: check status persists across app restart

### Phase 4: Push Notification Handling (30 min)

- [ ] Add `login_approval` case to `resolveNotificationRoute()` in `notificationNavigation.ts` (see §5.6)
- [ ] Add `login_approval` channel in `notificationChannels.ts` (importance: 4 = HIGH) (see §5.6)
- [ ] Add foreground handler for `login_approval` (see §5.7)
- [ ] Test: trigger a web login → verify push arrives on the mobile device

### Phase 5: Approval Screen & Navigation (45 min)

- [ ] Add `LoginApproval` params to `RootStackParamList` in `types.ts` (see §5.5)
- [ ] Register `LoginApprovalScreen` in `RootNavigator.tsx` as root-level modal (see §5.5)
- [ ] Create `src/screens/auth/LoginApprovalScreen.tsx` (see §5.8)
- [ ] Test full flow: web login → push → tap → approve → web receives JWT

### Phase 6: Edge Cases (30 min)

- [ ] Expired challenge: countdown reaches 0 → toast "expired" → go back
- [ ] Deny action: `action: 'deny'` → confirmation → go back
- [ ] App killed/background: notification tap opens app → navigates to approval screen
- [ ] Network error on approve: `Alert.alert` with retry option
- [ ] Challenge already handled: API returns error → appropriate message
- [ ] TOTP secret not found on disable: show error, suggest contacting support
- [ ] Staff/admin tries to disable: show "2FA is required for your account" message (check `is_required` from status)

### Phase 7: End-to-End Testing (30 min)

- [ ] **Activation:** Enable 2FA from mobile → check backend shows `is_enabled: true, method: totp`
- [ ] **Happy path:** Web login → push → approve → web authenticated
- [ ] **Deny path:** Web login → push → deny → web shows "Login denied"
- [ ] **Expiry:** Web login → wait 5 min → push shows "expired"
- [ ] **Background:** App in background → push → tap → approval screen
- [ ] **Killed:** App killed → push → tap → opens app → approval screen
- [ ] **No FCM token:** Log out of mobile → web falls back to code entry
- [ ] **Disable:** Disable 2FA from mobile → web login no longer requires 2FA

**Estimated total time: ~3.5 hours**

---

## 8. Timing & Expiry

| Timer | Duration | Effect |
|-------|----------|--------|
| `temp_token` | 5 minutes | Web session token expires. Polling returns error. |
| Push challenge | 5 minutes | Challenge expires on backend. Mobile approve call returns error. |
| Screen countdown | 5 minutes | Visual countdown on approval screen. At 0, navigate back with "expired" toast. |
| Web poll interval | 3 seconds | Web frontend polls `POST /auth/2fa/push-status` every 3 seconds. |

> All three timers are aligned to 5 minutes. The screen countdown is purely visual — the backend enforces the actual expiry.

---

## 9. How It Interacts with Existing Flows

### Mobile App Login (no change needed)

When the **mobile app itself** logs in, the standard flow still works:

1. Mobile calls `POST /auth/login` → gets `requires_2fa: true, method: 'totp'`
2. Mobile navigates to `TwoFactor` screen → user enters 6-digit TOTP code
3. Mobile calls `POST /auth/2fa/verify` → gets JWT

> The push-to-approve flow is only triggered during **web login**. The mobile app does NOT receive a push when it's the one logging in.

### Mobile App Login with Stored Secret (Optional Enhancement)

If the mobile app has the TOTP secret stored (from the activation flow), it can optionally auto-generate and submit the TOTP code during mobile login, skipping manual code entry entirely:

```typescript
// In the TwoFactor screen, check if the app has a stored TOTP secret:
const secret = await getTotpSecret();
if (secret) {
  const code = generateTotpCode(secret);
  // Auto-submit the code — the user sees nothing
  await authApi.verify2fa(tempToken, code);
}
```

This makes the mobile app login seamless too — the user types email + password and gets in immediately without ever seeing a code prompt.

### Email / SMS 2FA (no change)

If the user's 2FA method is `email` or `sms`, the push-to-approve flow does not apply. No push challenge is created.

### Fallback: Manual TOTP Code Entry (Web)

The web login page always offers an "Enter code manually" option alongside the "Waiting for approval" screen. Users can type a 6-digit TOTP code via `POST /auth/2fa/verify` at any time. This covers:

- User doesn't have their phone nearby
- Push notification didn't arrive
- Mobile app session has expired

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Push sent to wrong device | Challenge is bound to `user_id`. Mobile app's JWT must belong to the same user. |
| Replay attack | Challenge can only be approved **once**. Status changes permanently. |
| Stale challenges | Auto-expired after 5 minutes. Creating a new challenge auto-expires pending ones. |
| Unauthorized approval | `POST /auth/2fa/push-approve` requires a valid JWT — only an authenticated mobile session can approve. |
| TOTP secret stored on device | Use secure storage (Keychain/Keystore) in production. Needed only for disable flow and optional auto-login. |
| Social engineering | Warning text on approval screen: "If you didn't try to sign in, tap Deny and change your password." |
| Denial-of-service | Push only sent after valid email + password. Brute-force login is blocked before reaching 2FA. |
| Lost/stolen phone | Phone must have active JWT session. Logout or password change invalidates it. Backup codes allow recovery. |
| Man-in-the-middle | All communication over HTTPS. FCM uses Google's encrypted transport. |

---

## 11. Quick API Reference

| # | Method | Endpoint | Auth | Purpose | Actor |
|---|--------|----------|------|---------|-------|
| 1 | GET | `/auth/2fa/status` | JWT | Check if 2FA is enabled | Mobile App |
| 2 | POST | `/auth/2fa/setup` | JWT | Start TOTP setup (get secret) | Mobile App |
| 3 | POST | `/auth/2fa/verify-setup` | JWT | Complete setup (verify code → enable) | Mobile App |
| 4 | POST | `/auth/2fa/disable` | JWT | Disable 2FA | Mobile App |
| 5 | POST | `/auth/login` | None | Login → returns `temp_token` + `challenge_id` | Web |
| 6 | POST | `/auth/2fa/push-approve` | JWT | Approve/deny push challenge | Mobile App |
| 7 | POST | `/auth/2fa/push-status` | temp_token | Poll challenge status → get JWT | Web |
| 8 | POST | `/auth/2fa/verify` | temp_token | Fallback: manual TOTP code entry | Web |

### cURL Examples

**Enable 2FA from mobile (step 1 — setup):**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/setup \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <mobile_jwt>' \
  -d '{"method": "totp"}'
```

**Enable 2FA from mobile (step 2 — verify):**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/verify-setup \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <mobile_jwt>' \
  -d '{"code": "123456"}'
```

**Approve login from mobile app:**

```bash
curl -X POST https://api.softaware.net.za/auth/2fa/push-approve \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <mobile_jwt>' \
  -d '{"challenge_id": "a1b2c3d4-...", "action": "approve"}'
```

---

## 12. Database Reference

### `mobile_auth_challenges` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36), PK | Challenge UUID |
| `user_id` | VARCHAR(36) | FK → users.id |
| `challenge_secret` | VARCHAR(64) | Random hex secret (reserved for future use) |
| `status` | ENUM | `'pending'`, `'completed'`, `'expired'`, `'denied'` |
| `source` | ENUM | `'push'` for push-to-approve challenges |
| `remember_me` | TINYINT(1) | Whether to issue a 30-day token |
| `expires_at` | DATETIME | 5-minute expiry |
| `created_at` | DATETIME | Record creation timestamp |

### `fcm_tokens` Table (existing, no changes)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT, PK, AUTO_INCREMENT | Row ID |
| `user_id` | VARCHAR(36) | FK → users.id |
| `token` | VARCHAR(512), UNIQUE | FCM device token |
| `device_name` | VARCHAR(255) | Optional device identifier |
| `platform` | ENUM('android','ios','web') | Device platform |
| `created_at` | DATETIME | When token was registered |
| `updated_at` | DATETIME | Last update |

> FCM tokens are registered by the mobile app on login (see `AuthContext` → `initializePushNotifications`). The backend checks this table to determine if push-to-approve is available. If no tokens exist, `challenge_id` is omitted from the login response and the web falls back to manual code entry.

### `user_two_factor` Table (existing, no changes)

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | VARCHAR(36), PK | FK → users.id |
| `secret` | VARCHAR(255) | TOTP secret (base32) |
| `preferred_method` | ENUM('totp','email','sms') | Current method |
| `is_enabled` | TINYINT(1) | Whether 2FA is active |
| `backup_codes` | JSON | Hashed backup codes |
| `otp_code` | VARCHAR(255) | Current OTP hash (email/sms) |
| `otp_expires_at` | DATETIME | OTP expiry |

---

## 13. Summary

The complete push-to-approve feature has two flows the mobile developer must implement:

**Flow A — Activation (Settings):**
User taps "Enable App 2FA" → mobile calls setup + verify endpoints silently → 2FA enabled → backup codes shown.

**Flow B — Login Approval (Push):**
Web login → FCM push arrives → mobile shows approval screen → user taps Approve → web login completes.

Both flows require **zero QR codes, zero scanning, zero manual code entry** from the user's perspective. The mobile app handles TOTP code generation internally for activation, and push-to-approve replaces code entry for web logins.

**New files to create:** 3 (`LoginApprovalScreen.tsx`, `totp.ts`, `secureStorage.ts`)  
**Files to modify:** 5 (`auth.ts` API, `notificationNavigation.ts`, `notificationChannels.ts`, `types.ts`, `RootNavigator.tsx`)  
**Existing file to update:** 1 (`TwoFactorSettingsScreen.tsx`)
