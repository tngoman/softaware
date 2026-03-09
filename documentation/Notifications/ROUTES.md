# Notifications — Routes & API Reference

## Backend Route Map

### Notification Routes (`notifications.ts`)
| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| `GET` | `/api/notifications` | JWT | List notifications | Paginated list with optional unread filter |
| `GET` | `/api/notifications/unread/count` | JWT | Unread count | Badge count for dropdown |
| `PUT` | `/api/notifications/:id/read` | JWT | Mark single read | Sets `read_at = NOW()` |
| `PUT` | `/api/notifications/read-all` | JWT | Mark all read | Bulk update for user |
| `DELETE` | `/api/notifications/:id` | JWT | Delete notification | Hard delete, scoped to user |
| `POST` | `/api/notifications` | JWT | Create notification | In-app + optional push |
| `POST` | `/api/notifications/test-push` | JWT | Test push | Send test push to self |

### FCM Token Routes (`fcmTokens.ts`)
| Method | Path | Auth | Handler | Purpose |
|--------|------|------|---------|---------|
| `POST` | `/api/fcm-tokens` | JWT | Register device | Store FCM token for push |
| `GET` | `/api/fcm-tokens` | JWT | List devices | User's registered devices |
| `DELETE` | `/api/fcm-tokens/:token` | JWT | Unregister device | Remove FCM token |
| `GET` | `/api/fcm-tokens/status` | JWT | FCM status | Check if Firebase is configured |

**Total**: 11 endpoints (7 notifications + 4 FCM tokens)

---

## Request/Response Flow

### Create Notification with Push
```
Client                    Backend                   Firebase
  │                         │                         │
  │ POST /notifications     │                         │
  │ { title, message,       │                         │
  │   type, send_push:true }│                         │
  │ ───────────────────────>│                         │
  │                         │ INSERT notifications    │
  │                         │ ──────────> MySQL       │
  │                         │                         │
  │                         │ SELECT fcm_tokens       │
  │                         │ ──────────> MySQL       │
  │                         │                         │
  │                         │ sendEachForMulticast    │
  │                         │ ────────────────────────>│
  │                         │                         │ Deliver to devices
  │                         │ <────────────────────────│ { successCount, failures }
  │                         │                         │
  │                         │ DELETE stale tokens     │
  │                         │ ──────────> MySQL       │
  │                         │                         │
  │ { success: true }       │                         │
  │ <───────────────────────│                         │
```

### Push Registration Flow
```
Browser                   Frontend                  Backend                Firebase
  │                         │                         │                      │
  │ User clicks "Enable"    │                         │                      │
  │ ───────────────────────>│                         │                      │
  │                         │ Notification.request()  │                      │
  │ <───────────────────────│ Permission prompt       │                      │
  │ "Allow"                 │                         │                      │
  │ ───────────────────────>│                         │                      │
  │                         │ getToken(VAPID_KEY)     │                      │
  │                         │ ────────────────────────────────────────────────>│
  │                         │ <────────────────────────────────────────────────│
  │                         │ FCM token               │                      │
  │                         │                         │                      │
  │                         │ POST /fcm-tokens        │                      │
  │                         │ { token, device_name,   │                      │
  │                         │   platform: 'web' }     │                      │
  │                         │ ───────────────────────>│                      │
  │                         │                         │ UPSERT fcm_tokens    │
  │                         │ <───────────────────────│                      │
  │                         │                         │                      │
  │                         │ localStorage.set(token) │                      │
```

### Dropdown Polling Flow
```
NotificationDropdown          Backend
  │                              │
  │ [mount] GET /unread/count    │
  │ ────────────────────────────>│
  │ <────────────────────────────│ { count: 5 }
  │                              │
  │ [30s interval]               │
  │ GET /unread/count            │
  │ ────────────────────────────>│
  │ <────────────────────────────│ { count: 3 }
  │                              │
  │ [user clicks bell]           │
  │ GET /notifications?limit=5   │
  │ ────────────────────────────>│
  │ <────────────────────────────│ { data: [...5] }
  │                              │
  │ [user clicks notification]   │
  │ PUT /:id/read                │
  │ ────────────────────────────>│
  │ <────────────────────────────│ { success }
  │ navigate(data.action_url)    │
```

---

## Frontend Routes

| Route Path | Component | Purpose |
|------------|-----------|---------|
| `/notifications` | `Notifications.tsx` | Full notification list page |
| — (component) | `NotificationDropdown.tsx` | Bell icon in header/navbar |

---

## Service Worker Routes

The service worker (`firebase-messaging-sw.js`) handles:

| Event | Handler | Action |
|-------|---------|--------|
| `onBackgroundMessage` | Show notification | `self.registration.showNotification(title, options)` |
| `notificationclick` | Navigate | Focus existing window or open new; navigate to `data.link` |

---

## Backend Service Functions

### `firebaseService.ts` Exports
| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `isFirebaseEnabled()` | — | `boolean` | Whether Firebase is initialized |
| `registerFcmToken()` | userId, token, deviceName?, platform? | `void` | UPSERT token in DB |
| `unregisterFcmToken()` | userId, token | `void` | DELETE token from DB |
| `listFcmTokens()` | userId | `FcmToken[]` | All tokens for user |
| `sendPushToUser()` | userId, PushPayload | `{ sent, failed }` | Multicast push to all user devices |
| `sendPushToUsers()` | userIds[], PushPayload | `void` | Batch push to multiple users |
| `createNotificationWithPush()` | userId, { title, message, type?, data? } | `void` | INSERT notification + fire-and-forget push |

### `notificationService.ts` Exports
| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `createNotification()` | { userId, title, message, type?, data? } | `void` | Maps case-specific types to DB enums, preserves original type in push data, delegates to `createNotificationWithPush()` |

### `pushNotifications.ts` Frontend Exports
| Function | Returns | Description |
|----------|---------|-------------|
| `registerForPushNotifications()` | `boolean` | Request permission + register token |
| `unregisterFromPushNotifications()` | `void` | Remove token from backend + localStorage |
| `isPushEnabled()` | `boolean` | Check localStorage for token |
| `isPushSupported()` | `boolean` | Feature-detect browser support |
| `getNotificationPermission()` | `NotificationPermission` | Browser permission state |
| `initForegroundNotifications(callback?)` | `void` | Set up in-app notification handler |
| `getFcmStatus()` | `{ fcm_enabled }` | Check backend FCM status |
| `listRegisteredDevices()` | `any[]` | Get user's registered devices |
