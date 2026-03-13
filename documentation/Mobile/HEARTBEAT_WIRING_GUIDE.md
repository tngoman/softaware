# Mobile App — Heartbeat Feature Wiring Guide

> **Created:** March 2026  
> **Purpose:** Step-by-step guide for wiring heartbeat reporting into the React Native mobile app so the backend can track mobile client presence, version, and health.  
> **Audience:** Mobile developer(s)  
> **Pre-requisite reading:** `opt/documentation/Updates/CLIENT_INTEGRATION_SPEC.md` (full heartbeat protocol), `opt/documentation/Updates/HEARTBEAT_MONITORING_PLAN.md` (monitoring architecture), `opt/documentation/Mobile/MOBILE_APP_REFERENCE.md` (app structure)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [What Already Exists (Reuse These)](#3-what-already-exists)
4. [New Files to Create](#4-new-files-to-create)
5. [Files to Modify](#5-files-to-modify)
6. [Constants & Configuration](#6-constants--configuration)
7. [TypeScript Types](#7-typescript-types)
8. [Heartbeat Service — `services/heartbeatService.ts`](#8-heartbeat-service)
9. [API Module — `api/heartbeat.ts`](#9-api-module)
10. [Wiring Into the App Lifecycle](#10-wiring-into-the-app-lifecycle)
11. [AppState Handling — Foreground Only](#11-appstate-handling--foreground-only)
12. [Error Piggybacking (Optional Phase 2)](#12-error-piggybacking)
13. [Client Identifier Generation](#13-client-identifier-generation)
14. [Backend Reference — What Already Works](#14-backend-reference)
15. [Heartbeat Request & Response Examples](#15-heartbeat-request--response-examples)
16. [Response Handling — What the App Must Do](#16-response-handling)
17. [Network Awareness](#17-network-awareness)
18. [Testing & Verification](#18-testing--verification)
19. [Implementation Checklist](#19-implementation-checklist)

---

## 1. Overview

The SoftAware backend already has a fully functional heartbeat endpoint (`POST /api/updates/heartbeat`) that accepts client presence data and returns update availability, remote commands, and block status. The desktop app and PHP portal both use this endpoint today.

**The mobile app needs to send heartbeats so the backend can:**
- Track which mobile users are active and what screen they're viewing
- Detect when mobile clients go offline (for the Heartbeat Monitor dashboard)
- Deliver remote commands to mobile clients (force logout, server messages)
- Check if the mobile app is running the latest version
- Collect error reports (Phase 2, piggybacked on heartbeats)

**Critical rule:** Heartbeats must **only** be sent when the app is in the **foreground** (active state). When the app is sleeping, backgrounded, or the device screen is off, **no heartbeats should be sent**. This saves battery, avoids unnecessary network usage, and gives an accurate picture of real user activity.

---

## 2. Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Foreground only** | Heartbeats represent "user is actively using the app". Background heartbeats waste battery and give false presence signals. |
| **Pause on background, resume on foreground** | Use React Native's `AppState` API. When the app goes to background → stop the timer. When it returns to foreground → send an immediate heartbeat + restart the timer. |
| **Fail silently** | Heartbeat failures must never crash the app, show errors to users, or block any functionality. Log warnings and move on. |
| **No auth required** | The heartbeat endpoint uses `software_key` authentication, not JWT. This means heartbeats can be sent even if the user's JWT has expired (useful for detecting stale sessions). However, we also send the JWT user info when available for richer data. |
| **Lightweight** | Keep the payload small. Don't send data that hasn't changed since the last heartbeat unless it's trivial. |
| **Respect connectivity** | Check network status before attempting a heartbeat. Skip if offline. |

---

## 3. What Already Exists (Reuse These)

| Component | File | How it helps |
|-----------|------|-------------|
| `ApiClient` | `src/api/client.ts` | HTTP client — but heartbeat should use raw `fetch()` since it uses `software_key` auth, not JWT Bearer tokens. See §9. |
| `AuthContext` | `src/contexts/AuthContext.tsx` | Provides `user`, `isAuthenticated` — used to include `user_name` and `user_id` in heartbeats. |
| `AppContext` | `src/contexts/AppContext.tsx` | Provides `publicSettings` — could provide the software key. |
| `@react-native-community/netinfo` | Already installed | Network connectivity detection — check before sending heartbeats. |
| `@react-native-async-storage/async-storage` | Already installed | Cache the `client_identifier` so it persists across launches. |
| `constants/config.ts` | `src/constants/config.ts` | `API_BASE_URL` and `STORAGE_KEYS` — add heartbeat constants here. |
| Toast messages | `react-native-toast-message` | For displaying `server_message` from the heartbeat response. |
| Navigation ref | `src/services/notificationNavigation.ts` | `getNavigationRef()` — needed to read the current screen name for `active_page`. |
| `react-native-device-info` | **Needs to be installed** (or use RN built-in `Platform` APIs) | For generating a stable device-based `client_identifier`. |

---

## 4. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/services/heartbeatService.ts` | Core heartbeat logic: timer, AppState listener, send/stop/resume | ~180 |
| 2 | `src/api/heartbeat.ts` | Raw `fetch()` calls to the heartbeat endpoint (no JWT auth) | ~80 |
| 3 | `src/utils/deviceIdentifier.ts` | Generate and cache a stable SHA-256 `client_identifier` for this device | ~40 |

**Total new code: ~300 lines across 3 files.**

---

## 5. Files to Modify

| # | File | Change | LOC ± |
|---|------|--------|-------|
| 1 | `src/constants/config.ts` | Add `HEARTBEAT_SOFTWARE_KEY`, `HEARTBEAT_INTERVAL`, `HEARTBEAT_ENDPOINT`, storage keys | +10 |
| 2 | `src/contexts/AuthContext.tsx` | Start heartbeat on login, stop on logout | +8 |
| 3 | `src/api/index.ts` | Re-export `heartbeatApi` | +1 |
| 4 | `src/types/index.ts` | Add `HeartbeatPayload` and `HeartbeatResponse` types | +30 |

---

## 6. Constants & Configuration

Add to `src/constants/config.ts`:

```typescript
// ─── Heartbeat ──────────────────────────────────────────────────────
/**
 * Software key for the mobile app product.
 * This must match an entry in the backend's `update_software` table.
 * Ask the backend admin to create one if it doesn't exist.
 */
export const HEARTBEAT_SOFTWARE_KEY = '20260301SOFTMOBILE';

/**
 * Heartbeat endpoint - goes through the updates API, not the main API.
 * Uses software_key auth, not JWT.
 */
export const HEARTBEAT_BASE_URL = 'https://updates.softaware.net.za/api/updates';

/**
 * Interval in milliseconds between heartbeats.
 * - 60 seconds when app is active (foreground)
 * - First heartbeat is sent immediately on app launch / foreground resume
 */
export const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

// Add to STORAGE_KEYS:
// DEVICE_IDENTIFIER: '@device/client_identifier',
// LAST_HEARTBEAT: '@device/last_heartbeat',
```

> **⚠️ Important:** The `software_key` value (`20260301SOFTMOBILE`) must match a record in the backend's `update_software` table. Before the first heartbeat will work, an admin must create this entry via `POST /api/updates/software`:
> ```json
> {
>   "name": "SoftAware Mobile App",
>   "software_key": "20260301SOFTMOBILE",
>   "description": "React Native mobile app for Android and iOS"
> }
> ```

---

## 7. TypeScript Types

Add to `src/types/index.ts` (or create `src/types/heartbeat.ts` if preferred):

```typescript
// ─── Heartbeat ──────────────────────────────────────────────────────

/** Payload sent to POST /api/updates/heartbeat */
export interface HeartbeatPayload {
  software_key: string;
  client_identifier: string;
  hostname: string;
  machine_name: string;
  os_info: string;
  app_version: string;
  user_name?: string;
  user_id?: number;
  active_page?: string;
  ai_sessions_active?: number;
  ai_model?: string;
  metadata?: {
    platform: string;           // 'android' | 'ios'
    device_model: string;       // e.g. 'Pixel 7', 'iPhone 14'
    system_version: string;     // e.g. '14', '17.2'
    app_build: string;          // build number
    battery_level?: number;     // 0-1
    is_charging?: boolean;
    connection_type?: string;   // 'wifi' | 'cellular' | 'none'
    screen_width?: number;
    screen_height?: number;
    [key: string]: any;
  };
  recent_errors?: HeartbeatError[];
}

/** Error object piggybacked on heartbeat (Phase 2) */
export interface HeartbeatError {
  type: string;         // 'js_error' | 'exception' | 'reported_error'
  level: string;        // 'error' | 'warning' | 'notice'
  label: string;        // e.g. 'TypeError', 'ReferenceError'
  message: string;      // error message (max 500 chars)
  file?: string;        // source file
  line?: number;        // line number
  timestamp: string;    // ISO 8601
}

/** Response from POST /api/updates/heartbeat */
export interface HeartbeatResponse {
  success: boolean;
  client_id: number;
  action: 'created' | 'updated';
  software: string;
  update_available: boolean;
  latest_update: {
    id: number;
    version: string;
    description: string;
    has_migrations: number;
    released_at: string;
  } | null;
  message: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  force_logout: boolean;
  server_message: string | null;
  errors_received: number;
}
```

---

## 8. Heartbeat Service — `services/heartbeatService.ts`

This is the core service. It manages the heartbeat timer, listens to `AppState` changes, and coordinates sending.

```typescript
// src/services/heartbeatService.ts

import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { heartbeatApi } from '../api/heartbeat';
import { getDeviceIdentifier } from '../utils/deviceIdentifier';
import {
  HEARTBEAT_SOFTWARE_KEY,
  HEARTBEAT_INTERVAL_MS,
} from '../constants/config';
import type { HeartbeatPayload, HeartbeatResponse } from '../types';

const TAG = '[Heartbeat]';

// ─── Module State ───────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: any = null;
let currentAppState: AppStateStatus = AppState.currentState;
let isRunning = false;

// These are set externally via `configure()`
let currentUser: { id?: number; name?: string } | null = null;
let getActiveScreen: (() => string | undefined) | null = null;
let onForceLogout: (() => void) | null = null;
let onServerMessage: ((message: string) => void) | null = null;
let onBlocked: ((reason: string | null) => void) | null = null;

// ─── Configuration ──────────────────────────────────────────────────

interface HeartbeatConfig {
  /** Current authenticated user (null if logged out) */
  user: { id?: number; name?: string } | null;
  /** Function that returns the current screen/route name */
  getActiveScreen?: () => string | undefined;
  /** Called when the server sends force_logout: true */
  onForceLogout?: () => void;
  /** Called when the server sends a non-null server_message */
  onServerMessage?: (message: string) => void;
  /** Called when the server reports the client is blocked */
  onBlocked?: (reason: string | null) => void;
}

/**
 * Update the heartbeat service configuration.
 * Call this whenever the user logs in/out or when you want to
 * update the callbacks.
 */
export function configureHeartbeat(config: HeartbeatConfig): void {
  currentUser = config.user;
  getActiveScreen = config.getActiveScreen ?? null;
  onForceLogout = config.onForceLogout ?? null;
  onServerMessage = config.onServerMessage ?? null;
  onBlocked = config.onBlocked ?? null;
}

// ─── Start / Stop ───────────────────────────────────────────────────

/**
 * Start the heartbeat service.
 * - Sends an immediate heartbeat
 * - Starts a recurring timer (HEARTBEAT_INTERVAL_MS)
 * - Subscribes to AppState changes (pause on background, resume on foreground)
 *
 * Safe to call multiple times — will not create duplicate timers.
 */
export function startHeartbeat(): void {
  if (isRunning) {
    console.log(TAG, 'Already running, skipping start');
    return;
  }

  console.log(TAG, 'Starting heartbeat service');
  isRunning = true;

  // Send first heartbeat immediately
  sendHeartbeat();

  // Start recurring timer
  startTimer();

  // Listen for app state changes
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

/**
 * Stop the heartbeat service completely.
 * Call on logout or app teardown.
 */
export function stopHeartbeat(): void {
  console.log(TAG, 'Stopping heartbeat service');
  isRunning = false;
  stopTimer();

  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

// ─── Timer Management ───────────────────────────────────────────────

function startTimer(): void {
  if (heartbeatTimer) return; // already running
  heartbeatTimer = setInterval(() => {
    sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
  console.log(TAG, `Timer started (every ${HEARTBEAT_INTERVAL_MS / 1000}s)`);
}

function stopTimer(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log(TAG, 'Timer stopped');
  }
}

// ─── AppState Handler (FOREGROUND ONLY) ─────────────────────────────
//
// AppState values:
//   'active'   → app is in the foreground (SEND heartbeats)
//   'background' → app is in the background (STOP heartbeats)
//   'inactive' → transitional state on iOS (e.g. opening app switcher)
//                 On Android this happens briefly during transitions.
//
// Strategy:
//   active   → Start timer + send immediate heartbeat
//   background/inactive → Stop timer (no heartbeats while sleeping)
//
// When the user returns to the app, we send an immediate heartbeat
// so the backend knows the client is back, then resume the timer.

function handleAppStateChange(nextAppState: AppStateStatus): void {
  const previousState = currentAppState;
  currentAppState = nextAppState;

  if (!isRunning) return;

  // App came to foreground
  if (
    (previousState === 'background' || previousState === 'inactive') &&
    nextAppState === 'active'
  ) {
    console.log(TAG, 'App returned to foreground — resuming heartbeats');
    sendHeartbeat(); // Immediate heartbeat on resume
    startTimer();    // Restart the recurring timer
    return;
  }

  // App went to background
  if (nextAppState === 'background' || nextAppState === 'inactive') {
    console.log(TAG, 'App went to background — pausing heartbeats');
    stopTimer();
    return;
  }
}

// ─── Send Heartbeat ─────────────────────────────────────────────────

async function sendHeartbeat(): Promise<void> {
  try {
    // 1. Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log(TAG, 'Offline — skipping heartbeat');
      return;
    }

    // 2. Get device identifier (cached after first generation)
    const clientIdentifier = await getDeviceIdentifier();

    // 3. Determine the active screen name
    const activePage = getActiveScreen?.() ?? 'unknown';

    // 4. Build payload
    const payload: HeartbeatPayload = {
      software_key: HEARTBEAT_SOFTWARE_KEY,
      client_identifier: clientIdentifier,
      hostname: Platform.OS,                       // 'android' or 'ios'
      machine_name: `SoftAware Mobile (${Platform.OS})`,
      os_info: `${Platform.OS} ${Platform.Version}`,
      app_version: getAppVersion(),                // see helper below
      active_page: activePage,
      metadata: {
        platform: Platform.OS,
        device_model: getDeviceModel(),            // see helper below
        system_version: String(Platform.Version),
        app_build: getAppBuild(),                  // see helper below
        connection_type: netState.type || 'unknown',
      },
    };

    // 5. Add user info if authenticated
    if (currentUser) {
      payload.user_name = currentUser.name;
      payload.user_id = currentUser.id;
    }

    // 6. Send
    const response = await heartbeatApi.send(payload);

    // 7. Process response
    if (response) {
      handleHeartbeatResponse(response);
    }
  } catch (error) {
    // Never crash the app for a heartbeat failure
    console.warn(TAG, 'Heartbeat failed:', error);
  }
}

// ─── Response Handling ──────────────────────────────────────────────

function handleHeartbeatResponse(response: HeartbeatResponse): void {
  // Client is blocked — notify the app
  if (response.is_blocked) {
    console.warn(TAG, 'Client is blocked:', response.blocked_reason);
    onBlocked?.(response.blocked_reason);
    stopHeartbeat(); // No point continuing
    return;
  }

  // Force logout command from server
  if (response.force_logout) {
    console.warn(TAG, 'Force logout received from server');
    onForceLogout?.();
    return;
  }

  // Server message — show to user
  if (response.server_message) {
    console.log(TAG, 'Server message:', response.server_message);
    onServerMessage?.(response.server_message);
  }

  // Update available — can be used to show an in-app update prompt
  if (response.update_available && response.latest_update) {
    console.log(
      TAG,
      `Update available: v${response.latest_update.version}`,
    );
    // Future: trigger an in-app update notification
    // For now, just log it. The app store handles updates.
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Get app version from package.json / native build config.
 * Uses react-native-device-info if installed, falls back to a constant.
 */
function getAppVersion(): string {
  try {
    const DeviceInfo = require('react-native-device-info');
    return DeviceInfo.getVersion();
  } catch {
    // Fallback — update this when releasing
    return '1.0.0';
  }
}

function getAppBuild(): string {
  try {
    const DeviceInfo = require('react-native-device-info');
    return DeviceInfo.getBuildNumber();
  } catch {
    return '1';
  }
}

function getDeviceModel(): string {
  try {
    const DeviceInfo = require('react-native-device-info');
    return DeviceInfo.getModel();
  } catch {
    return Platform.OS === 'android' ? 'Android Device' : 'iOS Device';
  }
}
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| Uses `AppState.addEventListener` | React Native's official API for detecting foreground/background transitions. Works on both Android and iOS. |
| Stops timer on `background` **and** `inactive` | On iOS, `inactive` occurs when the user opens the app switcher, notification center, or an incoming call covers the app. We don't want heartbeats during these states. |
| Sends immediate heartbeat on resume | If the user was away for 30 minutes, the backend needs to know they're back *now*, not in 60 seconds. |
| Uses `require()` for `react-native-device-info` | Follows the app's native module safety pattern (§17 of MOBILE_APP_REFERENCE). Gracefully degrades if the module isn't installed. |
| Network check before send | Avoids pointless failed requests when offline. Uses `@react-native-community/netinfo` which is already installed. |

---

## 9. API Module — `api/heartbeat.ts`

The heartbeat endpoint uses `software_key` authentication, **not** JWT Bearer tokens. This means we use raw `fetch()` instead of the app's `ApiClient` (which auto-attaches JWT headers).

```typescript
// src/api/heartbeat.ts

import { HEARTBEAT_BASE_URL } from '../constants/config';
import type { HeartbeatPayload, HeartbeatResponse } from '../types';

const TAG = '[HeartbeatAPI]';

/**
 * Heartbeat API — uses software_key auth (NOT JWT).
 * This is intentionally separate from the main ApiClient
 * because the heartbeat endpoint does not require user authentication.
 */
export const heartbeatApi = {
  /**
   * Send a heartbeat to the updates server.
   * Returns the response or null if the request failed.
   */
  async send(payload: HeartbeatPayload): Promise<HeartbeatResponse | null> {
    try {
      const response = await fetch(`${HEARTBEAT_BASE_URL}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Software-Key': payload.software_key,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // 403 = blocked client — still parse the response
        if (response.status === 403) {
          const data = await response.json();
          return {
            success: false,
            client_id: 0,
            action: 'updated',
            software: '',
            update_available: false,
            latest_update: null,
            message: data.error || 'Client is blocked',
            is_blocked: true,
            blocked_reason: data.reason || null,
            force_logout: false,
            server_message: null,
            errors_received: 0,
          };
        }

        console.warn(TAG, `HTTP ${response.status}`);
        return null;
      }

      const data: HeartbeatResponse = await response.json();
      return data;
    } catch (error) {
      console.warn(TAG, 'Request failed:', error);
      return null;
    }
  },
};
```

Add to `src/api/index.ts`:
```typescript
export { heartbeatApi } from './heartbeat';
```

---

## 10. Wiring Into the App Lifecycle

The heartbeat service is started and stopped from `AuthContext.tsx`, which already manages login/logout lifecycle.

### Changes to `src/contexts/AuthContext.tsx`

```typescript
// Add import at the top:
import {
  startHeartbeat,
  stopHeartbeat,
  configureHeartbeat,
} from '../services/heartbeatService';
import { getNavigationRef } from '../services/notificationNavigation';
import Toast from 'react-native-toast-message';
```

#### On successful login (after token is stored and user is set):

```typescript
// Inside the login success handler, after setUser(userData):

configureHeartbeat({
  user: { id: userData.id, name: userData.display_name || userData.name },
  getActiveScreen: () => {
    const navRef = getNavigationRef();
    return navRef?.getCurrentRoute()?.name;
  },
  onForceLogout: () => {
    console.warn('[Auth] Force logout received via heartbeat');
    logout(); // Call the existing logout function
  },
  onServerMessage: (message: string) => {
    Toast.show({
      type: 'info',
      text1: 'Server Message',
      text2: message,
      visibilityTime: 6000,
    });
  },
  onBlocked: (reason: string | null) => {
    Toast.show({
      type: 'error',
      text1: 'Access Blocked',
      text2: reason || 'Your device has been blocked by an administrator.',
      visibilityTime: 10000,
    });
    logout();
  },
});
startHeartbeat();
```

#### On logout (in the existing logout handler):

```typescript
// Before clearing tokens:
stopHeartbeat();
```

#### On app cold start with restored session (in the useEffect that checks stored tokens):

```typescript
// After restoring user from AsyncStorage and verifying the session:
configureHeartbeat({
  user: { id: restoredUser.id, name: restoredUser.display_name || restoredUser.name },
  getActiveScreen: () => {
    const navRef = getNavigationRef();
    return navRef?.getCurrentRoute()?.name;
  },
  onForceLogout: () => logout(),
  onServerMessage: (msg: string) => {
    Toast.show({ type: 'info', text1: 'Server Message', text2: msg });
  },
  onBlocked: (reason: string | null) => {
    Toast.show({
      type: 'error',
      text1: 'Access Blocked',
      text2: reason || 'Your device has been blocked.',
    });
    logout();
  },
});
startHeartbeat();
```

---

## 11. AppState Handling — Foreground Only

This is the most critical part of the implementation. The heartbeat service **must** respect the app's lifecycle state.

### State Machine

```
┌───────────────────────────────────────────────────────────────┐
│                    APP LIFECYCLE                               │
│                                                               │
│  ┌─────────┐      ┌──────────┐      ┌────────────┐          │
│  │  ACTIVE  │ ───▶ │ INACTIVE │ ───▶ │ BACKGROUND │          │
│  │(sending) │ ◀─── │(paused)  │      │ (stopped)  │          │
│  └─────────┘      └──────────┘      └────────────┘          │
│       │                                     │                 │
│       │         ┌──────────┐                │                 │
│       └────────▶│ ACTIVE   │◀───────────────┘                │
│                 │(resumed) │                                  │
│                 │ • send   │                                  │
│                 │   now    │                                  │
│                 │ • start  │                                  │
│                 │   timer  │                                  │
│                 └──────────┘                                  │
└───────────────────────────────────────────────────────────────┘
```

### What Happens in Each State

| App State | Timer Running? | Sends Heartbeats? | Notes |
|-----------|---------------|-------------------|-------|
| `active` | ✅ Yes | ✅ Yes, every 60s | Normal operation |
| `inactive` (iOS) | ❌ No | ❌ No | App switcher open, notification center pulled down, incoming call overlay |
| `background` | ❌ No | ❌ No | User switched to another app, locked device, screen off |
| Returning to `active` | ✅ Restarted | ✅ Immediate + timer | Sends one heartbeat immediately so the backend sees the client is back |

### What NOT To Do

- ❌ Do NOT use `BackgroundFetch` or any background task API to send heartbeats while the app is sleeping
- ❌ Do NOT use `Headless JS` (Android) for heartbeat tasks
- ❌ Do NOT register a background timer via native modules
- ❌ Do NOT use push notifications to wake the app for heartbeats
- ❌ Do NOT use `react-native-background-timer` — it keeps the app awake and drains battery

### Edge Case: iOS `inactive` State

On iOS, the app enters `inactive` state when:
- The user pulls down the notification center
- The user opens the app switcher (double-tap home / swipe up)
- An incoming phone call overlay appears
- Face ID / Touch ID prompt is showing

During `inactive`, we **stop** the timer. If the user returns to `active` within a few seconds (dismissed the notification center), we resume with an immediate heartbeat. This prevents sending heartbeats during brief interruptions.

---

## 12. Error Piggybacking (Optional — Phase 2)

> **This section is for Phase 2.** Implement the basic heartbeat first, then add error piggybacking later.

The heartbeat payload supports a `recent_errors` array. The app can queue JS errors and piggyback them on the next heartbeat:

```typescript
// src/services/errorCollector.ts (Phase 2 — create later)

const errorQueue: HeartbeatError[] = [];
const MAX_QUEUE_SIZE = 10;

/** Called by a global error handler */
export function captureError(error: Error, level: 'error' | 'warning' = 'error'): void {
  errorQueue.push({
    type: 'js_error',
    level,
    label: error.name || 'Error',
    message: String(error.message).substring(0, 500),
    file: undefined, // Could parse from stack trace
    line: undefined,
    timestamp: new Date().toISOString(),
  });

  // Keep queue bounded
  if (errorQueue.length > MAX_QUEUE_SIZE * 2) {
    errorQueue.splice(0, errorQueue.length - MAX_QUEUE_SIZE);
  }
}

/** Called by heartbeatService before each send — drains up to 10 errors */
export function drainErrors(): HeartbeatError[] {
  return errorQueue.splice(0, MAX_QUEUE_SIZE);
}
```

In the heartbeat service's `sendHeartbeat()`, add:
```typescript
// After building the payload, before sending:
const errors = drainErrors();
if (errors.length > 0) {
  payload.recent_errors = errors;
}
```

When the heartbeat response contains `errors_received > 0`, the errors have been successfully stored server-side.

---

## 13. Client Identifier Generation

The backend uses `client_identifier` to uniquely identify each client device. For mobile, we generate a SHA-256 hash from device characteristics and cache it permanently.

```typescript
// src/utils/deviceIdentifier.ts

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@device/client_identifier';
let cachedIdentifier: string | null = null;

/**
 * Generate a stable client identifier for this device.
 * The identifier is a SHA-256 hash of device characteristics.
 * It's generated once and cached in AsyncStorage permanently.
 */
export async function getDeviceIdentifier(): Promise<string> {
  // Return cached value if available (fastest path)
  if (cachedIdentifier) return cachedIdentifier;

  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedIdentifier = stored;
      return stored;
    }
  } catch {
    // Continue to generation
  }

  // Generate new identifier
  const identifier = await generateIdentifier();
  cachedIdentifier = identifier;

  // Persist
  try {
    await AsyncStorage.setItem(STORAGE_KEY, identifier);
  } catch {
    // Non-critical — will regenerate next launch
  }

  return identifier;
}

async function generateIdentifier(): Promise<string> {
  let deviceModel = 'unknown';
  let deviceId = 'unknown';
  let systemVersion = String(Platform.Version);

  try {
    const DeviceInfo = require('react-native-device-info');
    deviceModel = DeviceInfo.getModel();
    deviceId = await DeviceInfo.getUniqueId(); // Android ID or iOS identifierForVendor
    systemVersion = DeviceInfo.getSystemVersion();
  } catch {
    // Fallback: use Platform info only
    deviceModel = Platform.OS;
    deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  const raw = `${deviceId}|${Platform.OS}|${deviceModel}|${systemVersion}`;

  // Use SubtleCrypto if available (React Native Hermes supports it),
  // otherwise use a simple hash function
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: simple hash (not cryptographic, but unique enough)
    return simpleHash(raw);
  }
}

/** Fallback hash function if SubtleCrypto is not available */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Pad to 64 chars to match SHA-256 length expectation
  const base = Math.abs(hash).toString(16);
  return (base + base + base + base).substring(0, 64);
}
```

### Why `react-native-device-info`?

The library provides stable, unique identifiers:
- **Android:** `getUniqueId()` returns the Android ID (persists across app reinstalls on Android 8+)
- **iOS:** `getUniqueId()` returns `identifierForVendor` (persists until all apps from the vendor are uninstalled)

If `react-native-device-info` is not installed, the fallback generates a random ID on first launch and caches it in AsyncStorage. This is less stable (cleared if the user clears app data) but functional.

### Installing `react-native-device-info` (Recommended)

```bash
npm install react-native-device-info
cd android && ./gradlew clean
# For iOS: cd ios && pod install
```

---

## 14. Backend Reference — What Already Works

The backend is **fully ready** to receive mobile heartbeats. No backend code changes are needed for the basic heartbeat flow.

### Endpoint

```
POST https://updates.softaware.net.za/api/updates/heartbeat
```

### What the Backend Does on Each Heartbeat

1. **Validates** `software_key` against the `update_software` table
2. **Generates** `client_identifier` from request data if not provided (but we always provide it)
3. **Creates** a new record in `update_clients` on the first heartbeat (returns `action: "created"`)
4. **Updates** the existing record on subsequent heartbeats (returns `action: "updated"`)
5. **Records** `last_heartbeat = NOW()` — this is what the monitoring dashboard uses to detect offline clients
6. **Checks** for available updates and includes them in the response
7. **Delivers** one-shot commands (`force_logout`, `server_message`) and clears them after delivery
8. **Checks** block status and returns 403 if the client is blocked
9. **Stores** `recent_errors[]` if provided (Phase 2)

### Backend Monitoring (Automatic)

Once heartbeats are flowing, the backend's `clientHeartbeatMonitor` service (when implemented per the HEARTBEAT_MONITORING_PLAN) will automatically:
- Track the mobile client's health status
- Detect when the mobile app goes dark (no heartbeat for 15 minutes while previously online)
- Auto-create a Case if the client is unresponsive
- Auto-resolve the Case when the client sends a heartbeat again

### One-Time Backend Setup Required

An admin must create the mobile app's software entry **once**:

```bash
# Via the web frontend: Updates → Software → Add New
# Or via API:
curl -X POST https://updates.softaware.net.za/api/updates/software \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SoftAware Mobile App",
    "software_key": "20260301SOFTMOBILE",
    "description": "React Native mobile app for Android and iOS"
  }'
```

---

## 15. Heartbeat Request & Response Examples

### Minimal Heartbeat (Not Logged In)

```json
// POST /api/updates/heartbeat
{
  "software_key": "20260301SOFTMOBILE",
  "client_identifier": "a3f8c2d1e5b7a9...64-char-hex...",
  "hostname": "android",
  "machine_name": "SoftAware Mobile (android)",
  "os_info": "android 14",
  "app_version": "1.0.0"
}
```

### Full Heartbeat (Logged In, Active)

```json
{
  "software_key": "20260301SOFTMOBILE",
  "client_identifier": "a3f8c2d1e5b7a9...64-char-hex...",
  "hostname": "android",
  "machine_name": "SoftAware Mobile (android)",
  "os_info": "android 14",
  "app_version": "1.2.0",
  "user_name": "John Doe",
  "user_id": 42,
  "active_page": "ChatScreen",
  "metadata": {
    "platform": "android",
    "device_model": "Pixel 7",
    "system_version": "14",
    "app_build": "28",
    "connection_type": "wifi"
  }
}
```

### Successful Response

```json
{
  "success": true,
  "client_id": 85,
  "action": "updated",
  "software": "SoftAware Mobile App",
  "update_available": false,
  "latest_update": null,
  "message": "Up to date",
  "is_blocked": false,
  "blocked_reason": null,
  "force_logout": false,
  "server_message": null,
  "errors_received": 0
}
```

### Response with Server Command

```json
{
  "success": true,
  "client_id": 85,
  "action": "updated",
  "software": "SoftAware Mobile App",
  "update_available": true,
  "latest_update": {
    "id": 70,
    "version": "1.3.0",
    "description": "New chat features and performance improvements",
    "has_migrations": 0,
    "released_at": "2026-03-15T00:00:00.000Z"
  },
  "message": "Update available",
  "is_blocked": false,
  "blocked_reason": null,
  "force_logout": false,
  "server_message": "Scheduled maintenance tonight at 11 PM SAST. Service may be briefly interrupted.",
  "errors_received": 0
}
```

---

## 16. Response Handling — What the App Must Do

| Response Field | App Action |
|---|---|
| `is_blocked: true` | Show toast with `blocked_reason`. Call `logout()`. Stop heartbeats. |
| `force_logout: true` | Immediately call `logout()`. The server clears this flag after delivery, so it's a one-shot command. |
| `server_message` (non-null) | Show an info toast with the message text. The server clears this after delivery. |
| `update_available: true` | **For now:** Log it. Mobile updates go through the Play Store / App Store, not the SoftAware update system. **Future:** Could show an in-app banner prompting the user to update from the store. |
| `errors_received > 0` | Confirmation that piggybacked errors were stored. No user-facing action needed. |
| Network error / timeout | Log warning. Do nothing. The next scheduled heartbeat will retry automatically. |
| HTTP 400 | Likely a misconfigured `software_key`. Log error. This needs developer attention. |
| HTTP 403 | Client is blocked. Parse the response body for `reason`. |

---

## 17. Network Awareness

The heartbeat service uses `@react-native-community/netinfo` (already installed) to:

1. **Skip heartbeats when offline** — No point making a request that will fail.
2. **Include connection type in metadata** — Helps the backend/admin understand the client's network conditions.

```typescript
import NetInfo from '@react-native-community/netinfo';

// Before sending:
const state = await NetInfo.fetch();
if (!state.isConnected) {
  console.log('[Heartbeat] Offline — skipping');
  return;
}

// Include in metadata:
metadata.connection_type = state.type; // 'wifi', 'cellular', 'ethernet', 'none'
```

### What About Reconnection?

You do **not** need to subscribe to `NetInfo.addEventListener` for reconnection events. The heartbeat timer is already running every 60 seconds. When the device reconnects, the next scheduled heartbeat will succeed naturally. The `AppState` listener handles foreground/background transitions, and network recovery is handled implicitly by the timer.

---

## 18. Testing & Verification

### How to Verify Heartbeats Are Working

1. **Launch the app** → Check logs for `[Heartbeat] Starting heartbeat service`
2. **Wait 60 seconds** → Check logs for periodic `[Heartbeat]` entries
3. **Background the app** → Check logs for `[Heartbeat] App went to background — pausing heartbeats`
4. **Return to foreground** → Check logs for `[Heartbeat] App returned to foreground — resuming heartbeats`
5. **Check backend** → Open the web admin panel → Updates → Client Management. You should see a new client entry with:
   - Hostname: `android` (or `ios`)
   - Machine name: `SoftAware Mobile (android)`
   - Last heartbeat: recent timestamp
   - User name: the logged-in user's name

### How to Test Force Logout

1. Find the mobile client's ID in the Client Management screen
2. Click the client → Send Command → Force Logout
3. The next heartbeat from the mobile app should trigger logout

### How to Test Server Message

1. Find the mobile client's ID in the Client Management screen
2. Click the client → Send Command → Send Message → "Test message from admin"
3. The next heartbeat should show the message as a toast

### How to Test Blocked Client

1. Find the mobile client's ID in the Client Management screen
2. Click the client → Block → Enter reason
3. The next heartbeat should trigger the blocked flow (toast + logout)

### Debugging Tips

- Filter `adb logcat` by `[Heartbeat]` tag: `adb logcat | grep "\[Heartbeat\]"`
- For iOS: filter Xcode console by `[Heartbeat]`
- To test with a short interval during development, temporarily set `HEARTBEAT_INTERVAL_MS = 10_000` (10 seconds)
- Check the `update_clients` table directly: `SELECT * FROM update_clients WHERE hostname = 'android' ORDER BY last_heartbeat DESC LIMIT 5;`

---

## 19. Implementation Checklist

### Phase 1 — Basic Heartbeat (Do This First)

- [ ] **Backend setup:** Ask admin to create the mobile software entry in `update_software` table with key `20260301SOFTMOBILE`
- [ ] **Install dependency:** `npm install react-native-device-info` (recommended but optional — the service degrades gracefully without it)
- [ ] **Create** `src/constants/config.ts` additions — `HEARTBEAT_SOFTWARE_KEY`, `HEARTBEAT_BASE_URL`, `HEARTBEAT_INTERVAL_MS`
- [ ] **Create** `src/types/index.ts` additions — `HeartbeatPayload`, `HeartbeatResponse`, `HeartbeatError`
- [ ] **Create** `src/utils/deviceIdentifier.ts` — device identifier generation + caching
- [ ] **Create** `src/api/heartbeat.ts` — raw fetch wrapper for the heartbeat endpoint
- [ ] **Create** `src/services/heartbeatService.ts` — timer, AppState listener, send logic
- [ ] **Modify** `src/api/index.ts` — add `heartbeatApi` export
- [ ] **Modify** `src/contexts/AuthContext.tsx` — call `configureHeartbeat()` + `startHeartbeat()` on login/restore, `stopHeartbeat()` on logout
- [ ] **Test:** Verify heartbeats appear in the Client Management screen
- [ ] **Test:** Verify heartbeats stop when app is backgrounded
- [ ] **Test:** Verify heartbeats resume immediately when app returns to foreground
- [ ] **Test:** Verify force logout, server message, and blocked client flows
- [ ] **Test:** Verify no heartbeats are sent when device is offline

### Phase 2 — Error Piggybacking (After Phase 1 Is Stable)

- [ ] **Create** `src/services/errorCollector.ts` — in-memory error queue
- [ ] **Wire** global error handler (`ErrorUtils.setGlobalHandler` on RN) to `captureError()`
- [ ] **Modify** `src/services/heartbeatService.ts` — call `drainErrors()` before each send, attach to `payload.recent_errors`
- [ ] **Test:** Trigger a JS error → verify it appears in the next heartbeat → verify `errors_received > 0` in the response

### Phase 3 — In-App Update Prompt (Optional)

- [ ] When `update_available: true`, show a dismissable banner: "A new version is available. Update from the Play Store."
- [ ] Link to the Play Store / App Store listing
- [ ] Track dismissed state in AsyncStorage so the banner only shows once per version

---

## Appendix A — Complete File Inventory

### New Files (3)

| File | Type | Purpose |
|------|------|---------|
| `src/services/heartbeatService.ts` | Service | Core heartbeat orchestration |
| `src/api/heartbeat.ts` | API | HTTP calls to heartbeat endpoint |
| `src/utils/deviceIdentifier.ts` | Utility | Device identifier generation |

### Modified Files (4)

| File | Change |
|------|--------|
| `src/constants/config.ts` | Add heartbeat constants |
| `src/types/index.ts` | Add heartbeat types |
| `src/api/index.ts` | Re-export heartbeatApi |
| `src/contexts/AuthContext.tsx` | Start/stop heartbeat on login/logout |

### Dependencies

| Package | Required? | Purpose |
|---------|-----------|---------|
| `react-native-device-info` | Recommended | Stable device identifier + version info |
| `@react-native-community/netinfo` | Already installed | Network connectivity check |
| `@react-native-async-storage/async-storage` | Already installed | Cache device identifier |

---

## Appendix B — Sequence Diagram

```
┌────────┐          ┌─────────────┐          ┌──────────────┐          ┌────────┐
│  User  │          │  Mobile App │          │  Heartbeat   │          │ Backend│
│        │          │             │          │  Service     │          │        │
└───┬────┘          └──────┬──────┘          └──────┬───────┘          └───┬────┘
    │   Opens app          │                        │                      │
    │──────────────────────▶                        │                      │
    │                      │  Login success         │                      │
    │                      │───────────────────────▶│                      │
    │                      │  configureHeartbeat()  │                      │
    │                      │  startHeartbeat()      │                      │
    │                      │                        │                      │
    │                      │                        │  POST /heartbeat     │
    │                      │                        │─────────────────────▶│
    │                      │                        │  { action: created } │
    │                      │                        │◀─────────────────────│
    │                      │                        │                      │
    │                      │         ... 60s ...    │                      │
    │                      │                        │                      │
    │                      │                        │  POST /heartbeat     │
    │                      │                        │─────────────────────▶│
    │                      │                        │  { action: updated } │
    │                      │                        │◀─────────────────────│
    │                      │                        │                      │
    │   Switches to        │                        │                      │
    │   another app        │  AppState→background   │                      │
    │──────────────────────▶──────────────────────▶│                      │
    │                      │                        │  [timer stopped]     │
    │                      │                        │  NO heartbeats sent  │
    │                      │                        │                      │
    │                      │     ... 20 min ...     │                      │
    │                      │                        │                      │
    │   Returns to app     │  AppState→active       │                      │
    │──────────────────────▶──────────────────────▶│                      │
    │                      │                        │  POST /heartbeat     │
    │                      │                        │  (immediate)         │
    │                      │                        │─────────────────────▶│
    │                      │                        │  [timer restarted]   │
    │                      │                        │◀─────────────────────│
    │                      │                        │                      │
    │                      │  Logout                │                      │
    │                      │───────────────────────▶│                      │
    │                      │  stopHeartbeat()       │                      │
    │                      │                        │  [timer stopped]     │
    │                      │                        │  [listener removed]  │
```

---

## Appendix C — Heartbeat Timing Explained

| Scenario | Heartbeat Behavior | Backend Sees |
|----------|-------------------|--------------|
| App launched, user logs in | Immediate heartbeat + 60s timer | Client created, online |
| User actively using app | Heartbeat every 60s with current screen name | Client online, `active_page` updating |
| User locks phone screen | AppState → background → timer stops | Last heartbeat was ~60s ago, then goes stale |
| User unlocks phone, returns to app | AppState → active → immediate heartbeat + timer restarts | Client comes back online |
| User force-quits the app | No more heartbeats (app is killed) | Client goes stale after 15 min threshold |
| User opens app but has no internet | Network check fails → heartbeat skipped | No change (client stays at last known state) |
| Internet returns while app is open | Next scheduled heartbeat succeeds | Client back online |
| User logs out | `stopHeartbeat()` called → timer + listener removed | Last heartbeat had the user info, subsequent ones won't |

---

*This guide covers everything needed to implement heartbeats in the mobile app. Start with Phase 1, verify it works end-to-end, then add error piggybacking in Phase 2.*
