# Notifications — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/notifications.ts` (166 LOC)
**Purpose**: In-app notification CRUD routes with optional push notification creation.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–5 | Express Router, Zod, `requireAuth`, `db`, `sendPushToUser`, `createNotificationWithPush` |
| `GET /notifications` | 7–35 | List notifications for authenticated user. Supports `?limit=` (max 100, default 50) and `?unread=true` filter. Returns `{ data, unread_count }`. |
| `GET /notifications/unread/count` | 37–50 | Return only unread count: `{ data: { count } }`. |
| `PUT /notifications/:id/read` | 52–65 | Mark single notification as read. Sets `read_at = NOW()`. Scoped to `user_id`. |
| `PUT /notifications/read-all` | 67–78 | Mark all unread notifications as read for the user. |
| `DELETE /notifications/:id` | 80–92 | Hard delete a notification. Scoped to `user_id`. |
| Zod schema | 94–100 | `CreateNotificationSchema`: `user_id?`, `title`, `message`, `type` (info/success/warning/error), `send_push` (default true). |
| `POST /notifications` | 102–130 | Create notification. If `send_push=true`, uses `createNotificationWithPush()`. Otherwise direct INSERT. Target user defaults to self if `user_id` omitted. |
| `POST /notifications/test-push` | 132–166 | Send test push to self via `sendPushToUser()`. Returns `{ sent, failed }` counts. |

---

### `/var/opt/backend/src/routes/fcmTokens.ts` (81 LOC)
**Purpose**: FCM device token registration and management routes.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–12 | Express Router, Zod, auth middleware, `badRequest` helper, firebase service functions |
| Zod schema | 14–18 | `RegisterTokenSchema`: `token` (required), `device_name?`, `platform?` (android/ios/web) |
| `POST /fcm-tokens` | 20–35 | Register device token. Calls `registerFcmToken()`. |
| `GET /fcm-tokens` | 37–50 | List registered devices for user. Returns `{ data, fcm_enabled }`. |
| `DELETE /fcm-tokens/:token` | 52–68 | Unregister a device token. URL-decodes the token parameter. |
| `GET /fcm-tokens/status` | 70–81 | Check if FCM is configured: `{ data: { fcm_enabled } }`. |

---

### `/var/opt/backend/src/services/firebaseService.ts` (240 LOC)
**Purpose**: Firebase Admin SDK initialization, push notification sending, token CRUD, and the combined notification+push helper.

| Section | Lines | Description |
|---------|-------|-------------|
| Firebase init | 1–40 | `initFirebase()`: Checks for `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` env vars. Initializes `admin.initializeApp()` with cert credentials. Converts `\\n` in private key. Auto-runs on module load. |
| `isFirebaseEnabled()` | 42–44 | Returns boolean: whether Firebase initialized successfully. |
| `registerFcmToken()` | 46–60 | UPSERT: `INSERT ... ON DUPLICATE KEY UPDATE` on `fcm_tokens`. Token is UNIQUE. |
| `unregisterFcmToken()` | 62–64 | DELETE from `fcm_tokens` WHERE user_id AND token. |
| `listFcmTokens()` | 66–76 | SELECT all tokens for user, ordered by `updated_at DESC`. |
| `PushPayload` interface | 78–84 | `{ title, body, data?, imageUrl? }` |
| `sendPushToUser()` | 86–155 | Core push function. Loads all device tokens for user, builds `MulticastMessage` with Android/iOS specific config, sends via `sendEachForMulticast()`, auto-cleans stale tokens. Returns `{ sent, failed }`. |
| `sendPushToUsers()` | 157–160 | Batch push to multiple users via `Promise.allSettled()`. |
| `createNotificationWithPush()` | 162–240 | Combined helper: INSERT notification row → fire-and-forget `sendPushToUser()`. Primary function for notifying users. |

---

### `/var/opt/backend/src/services/notificationService.ts` (59 LOC)
**Purpose**: Notification wrapper used by Cases module. Maps case-specific types to DB-safe enums while preserving original type in push data for service worker routing.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–6 | `createNotificationWithPush` from `firebaseService` |
| `NotificationOptions` interface | 8–14 | Extends type union with case-specific types: `case_created`, `case_assigned`, `case_updated`, `case_comment`, `case_resolved`, `case_deleted`, `system_alert` |
| `mapNotificationType()` | 19–33 | Maps case types to DB enum: `case_created`→`info`, `case_assigned`→`success`, `case_deleted`→`warning`, etc. |
| `createNotification()` | 40–59 | Converts data values to strings, preserves original `type` in `pushData.type` so service worker can route by category (e.g., `case_created` → `/cases/{id}`), then delegates to `createNotificationWithPush()` with mapped DB type. |

---

## Frontend Files

### `/var/opt/frontend/src/pages/Notifications.tsx` (259 LOC)
**Purpose**: Full-page notification list with read/delete actions and pagination.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–10 | React, Heroicons, `NotificationModel`, `formatDistanceToNow`, SweetAlert2 |
| State | 12–20 | `notifications`, `loading`, `pagination` (page/per_page/total/total_pages) |
| `loadNotifications()` | 22–35 | Fetches via `NotificationModel.getNotifications()`. |
| `handleMarkAsRead()` | 37–47 | Optimistic update: calls API then updates local state. |
| `handleMarkAllAsRead()` | 49–60 | Marks all read, shows SweetAlert success toast. |
| `handleDelete()` | 62–82 | SweetAlert confirmation dialog, then API delete + filter from state. |
| `getNotificationIcon()` | 84–95 | Returns colored Heroicon based on type (info→blue, success→green, warning→yellow, error→red). |
| Header | 97–115 | Title with unread count, "Mark All as Read" button (shown if unread > 0). |
| Notification list | 117–200 | Card list with type icon, title (with "New" badge), message, relative time, read/delete buttons. Unread items have blue background. |
| Pagination | 202–259 | Full pagination with page numbers, previous/next buttons, mobile-responsive. |

---

### `/var/opt/frontend/src/components/Notifications/NotificationDropdown.tsx` (229 LOC)
**Purpose**: Bell icon dropdown in the app header, showing latest 5 notifications with unread badge.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–6 | React, React Router, BellIcon, `NotificationModel`, `formatDistanceToNow` |
| Props | 8–10 | `onUnreadCountChange?: (count: number) => void` — callback for parent badge update |
| State | 12–18 | `isOpen`, `notifications`, `unreadCount`, `loading` |
| Polling effect | 20–25 | Fetches unread count on mount, then every 30 seconds via `setInterval`. |
| Dropdown open effect | 27–30 | Fetches last 5 notifications when dropdown opens. |
| Click outside effect | 32–43 | Closes dropdown on outside click via `mousedown` listener. |
| `handleNotificationClick()` | 71–90 | Marks as read, then navigates to `data.action_url` if present. |
| `handleMarkAllAsRead()` | 92–105 | Bulk mark read, reset unread count. |
| Bell button | 107–120 | Bell icon with red badge (`99+` cap). |
| Dropdown panel | 122–229 | Header with "Mark all as read", scrollable notification list (emoji icons), "View all" link to `/notifications`. |

**Key behaviors**:
- Polls every 30s (not real-time)
- Shows last 5 notifications only
- Uses emoji icons instead of Heroicons (different from full page)
- Renders message with `dangerouslySetInnerHTML` ⚠️
- Links to `/notifications` for full list

---

### `/var/opt/frontend/src/models/NotificationModel.ts` (89 LOC)
**Purpose**: Static API wrapper class for notification endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getNotifications(page, limit)` | `GET /notifications?limit=` | Returns `{ notifications, pagination }`. Note: pagination is client-side constructed (always `total_pages: 1`). |
| `getUnreadCount()` | `GET /notifications/unread/count` | Returns `number`. |
| `markAsRead(id)` | `PUT /notifications/:id/read` | Returns `{ success, message }`. |
| `markAllAsRead()` | `PUT /notifications/read-all` | Returns `{ success, message }`. |
| `deleteNotification(id)` | `DELETE /notifications/:id` | Returns `{ success, message }`. |

**Exports**: `Notification` interface, `NotificationModel` class.

---

### `/var/opt/frontend/src/services/pushNotifications.ts` (157 LOC)
**Purpose**: Client-side push notification lifecycle management.

| Function | Description |
|----------|-------------|
| `registerForPushNotifications()` | Request browser permission → get FCM token → POST to `/fcm-tokens`. Stores token in `localStorage`. Returns boolean success. |
| `unregisterFromPushNotifications()` | DELETE `/fcm-tokens/:token` → remove from localStorage. |
| `isPushEnabled()` | Check localStorage for stored FCM token. |
| `isPushSupported()` | Feature-detect `Notification` API + `serviceWorker`. |
| `getNotificationPermission()` | Return `Notification.permission` state. |
| `initForegroundNotifications(callback)` | Set up `onMessage` handler for in-app toasts when app is focused. Also shows browser notification if tab is hidden. |
| `getFcmStatus()` | `GET /fcm-tokens/status` — check if FCM is enabled server-side. |
| `listRegisteredDevices()` | `GET /fcm-tokens` — list user's registered devices. |

---

### `/var/opt/frontend/src/config/firebase.ts` (90 LOC)
**Purpose**: Firebase Web SDK initialization for push notifications.

| Export | Description |
|--------|-------------|
| `requestPushPermission()` | Init messaging → request permission → `getToken()` with VAPID key. Returns token string or null. |
| `onForegroundMessage(callback)` | Subscribe to `onMessage` events from Firebase Messaging. |
| `firebaseApp` | Initialized Firebase app instance. |

**Config**: Hardcoded Firebase project config (apiKey, projectId, messagingSenderId, appId, VAPID_KEY).

---

### `/var/opt/frontend/public/firebase-messaging-sw.js` (175 LOC)
**Purpose**: Service worker for background push notification handling with type-based deep linking, notification grouping, and action buttons.

| Section | Lines | Description |
|---------|-------|-------------|
| Firebase init | 1–20 | Imports Firebase compat SDKs via `importScripts()`, initializes with same config. |
| `buildDeepLink(data)` | 22–57 | Routes notification type to correct URL: `chat_message`/`chat_mention` → `/chat?c={id}`, `incoming_call`/`missed_call` → `/chat?c={id}`, `scheduled_call*` → `/chat?c={id}`, `task_*` → `/tasks`, `case_*` → `/cases/{id}` or `data.action_url`/`data.link`. Falls back to `/notifications`. |
| `onBackgroundMessage` | 59–112 | Receives background pushes, determines notification category (chat/call/scheduled/case/task), assigns grouping `tag`, builds action buttons (Reply/Mark-read for chat, View for calls), sets `requireInteraction` for calls, shows browser notification with deep link in data. |
| `notificationclick` | 114–175 | Handles notification click: checks `data.link` first, then `data.action_url`, then falls back to type-based routing. Focuses existing app window and sends `NOTIFICATION_CLICK` postMessage for SPA navigation, or opens new window. |
