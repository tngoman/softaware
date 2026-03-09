# Notifications Module

**Version:** 2.2.0  
**Last Updated:** 2026-03-09

## Purpose
Provides a full-stack notification system with **in-app notifications** (persisted in MySQL, displayed in dropdown and full-page list), **push notifications** (Firebase Cloud Messaging for web, Android, and iOS), **toast notifications** (transient UI feedback via `react-hot-toast`), and **user notification preferences**. Supports device token management, background/foreground message handling, and granular user control over notification channels. Push notifications are sent across **all major modules**: Chat (messages, mentions, calls), Tasks (assignment, phase changes), Cases (creation, assignment, status, comments, deletion), and Scheduling (created, cancelled, RSVP, started, reminders).

## Module Scope
- **Toast Notifications**: Centralized `notify` utility (`src/utils/notify.ts`) for all transient user feedback — success, error, warning, info. See [TOAST_SYSTEM.md](TOAST_SYSTEM.md) for full details.
- **In-App Notifications**: CRUD operations on `notifications` table — list, count unread, mark as read (single/all), delete, create (with optional push).
- **Push Notifications (FCM)**: Firebase Admin SDK on backend sends multicast push to all user devices. Stale tokens auto-cleaned. Frontend registers/unregisters FCM tokens via service worker.
- **FCM Token Management**: Register device tokens with platform/device name metadata, list registered devices, check FCM configuration status.
- **User Notification Preferences**: Master toggle, web notifications toggle, push notifications toggle — stored in `users` table, controllable via Profile page.
- **Cross-Module Push Notifications**: Push notifications are sent across Chat (messages, @mentions, calls), Tasks (assignment, phase changes), Cases (creation→admins, assignment, status changes, comments, deletion), and Scheduling (created, cancelled, RSVP, started, participant added, 15-min reminders).
- **Service Worker Deep Linking**: Background notifications route clicks to the correct page based on `data.type` — chat conversations, tasks page, case detail, etc.
- **Frontend UI**: Notification bell dropdown (polls every 30s), full notifications page with pagination, inline read/delete actions, preferences in Profile.

## Key Features

### Notification Channels
1. **Web In-App Notifications** — Stored in `notifications` table, shown in bell dropdown and notifications page
2. **Push Notifications (FCM)** — Sent to all registered devices (web, Android, iOS) via Firebase Cloud Messaging
3. **User Control** — Each channel independently controllable via Profile → Notification Preferences

### User Notification Preferences

Users can control their notification experience via three toggles in Profile:

| Preference | Field | Default | Effect |
|------------|-------|---------|--------|
| Master Toggle | `notifications_enabled` | `true` | If `false`, NO notifications of any kind are sent |
| Web Notifications | `web_notifications_enabled` | `true` | If `false`, no in-app notification rows are created |
| Push Notifications | `push_notifications_enabled` | `true` | If `false`, no FCM push messages are sent |

**Logic Flow:**
```
createNotificationWithPush(userId, notification)
  ├─ Check user preferences from users table
  ├─ If notifications_enabled = false → exit early (no notification)
  ├─ If web_notifications_enabled != false → INSERT into notifications table
  └─ If push_notifications_enabled != false → sendPushToUser()
```

### Cross-Module Push Notification Coverage

All push notifications respect user preferences (`notifications_enabled`, `push_notifications_enabled`). Chat push also respects DND schedules, mute settings, and @mention overrides.

| Module | Event | Push Type | Recipients | Deep Link |
|--------|-------|-----------|------------|-----------|
| **Chat** | New message | `chat_message` | Offline members (respects mute/DND) | `/chat?c={id}` |
| **Chat** | @Mention | `chat_mention` | Mentioned user (bypasses mute/DND) | `/chat?c={id}` |
| **Chat** | Incoming call | `incoming_call` | Offline members | `/chat?c={id}` |
| **Tasks** | Task assigned | `task_assigned` | Assigned user (if not self-assigned) | `/tasks` |
| **Tasks** | Phase changed | `task_phase_changed` | Assigned user (if changed by someone else) | `/tasks` |
| **Cases** | Case created | `case_created` | All admins | `/cases/{id}` |
| **Cases** | Case assigned | `case_assigned` | Assignee | `/cases/{id}` |
| **Cases** | Status changed | `case_updated` / `case_resolved` | Reporter (+ assignee on bulk) | `/cases/{id}` |
| **Cases** | Comment added | `case_comment` | Reporter + assignee | `/cases/{id}` |
| **Cases** | Case deleted | `case_deleted` | Reporter | `/cases` |
| **Scheduling** | Call scheduled | `scheduled_call` | Offline participants | `/chat?c={id}` |
| **Scheduling** | Call cancelled | `scheduled_call_cancelled` | Offline participants | `/chat?c={id}` |
| **Scheduling** | RSVP response | `scheduled_call_rsvp` | Creator (if offline) | `/chat?c={id}` |
| **Scheduling** | Call started | `incoming_call` | Offline accepted participants | `/chat?c={id}` |
| **Scheduling** | Participant added | `scheduled_call` | New participant | `/chat?c={id}` |
| **Scheduling** | 15-min reminder | `scheduled_call_reminder` | Offline non-declined participants | `/chat?c={id}` |

**Push Delivery Paths:**
- **Chat & Scheduling**: Use `sendPushToUser()` directly (bypass in-app notification for real-time events)
- **Tasks**: Use `createNotificationWithPush()` directly (creates in-app + push)
- **Cases**: Use `createNotification()` → `notificationService.ts` → `createNotificationWithPush()` (maps case-specific types to DB-safe enums while preserving original type in push data)

## Key Files

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Frontend Utility | `utils/notify.ts` | 80 | Centralized toast utility wrapping react-hot-toast |
| Backend Route | `src/routes/notifications.ts` | 166 | In-app notification CRUD + create with push |
| Backend Route | `src/routes/fcmTokens.ts` | 81 | FCM device token registration/management |
| Backend Route | `src/routes/profile.ts` | ~370 | User profile + notification preferences GET/PUT |
| Backend Route | `src/routes/softawareTasks.ts` | ~320 | Task proxy + assignment/phase-change notification triggers |
| Backend Service | `src/services/firebaseService.ts` | 240 | Firebase Admin SDK init, push sending, preference checks |
| Backend Service | `src/services/notificationService.ts` | 59 | Notification wrapper — maps case-specific types to DB enums, preserves original type in push data |
| Frontend Page | `pages/Notifications.tsx` | 259 | Full notifications list with pagination |
| Frontend Page | `pages/general/Profile.tsx` | 385 | Profile with notification preferences UI |
| Frontend Component | `components/Notifications/NotificationDropdown.tsx` | 229 | Bell icon dropdown with 30s polling |
| Frontend Model | `models/NotificationModel.ts` | 89 | API wrapper for notification endpoints |
| Frontend Service | `services/pushNotifications.ts` | 157 | FCM token management, permission, foreground handler |
| Frontend Config | `config/firebase.ts` | 90 | Firebase client SDK initialization |
| Service Worker | `public/firebase-messaging-sw.js` | 175 | Background push handler with type-based deep linking, notification grouping/tagging, action buttons, click-to-navigate |

**Total**: 13 files, ~2,717 LOC

## Dependencies
- **Backend**: Express Router, Zod validation, `requireAuth` middleware, `db` (mysql2/promise), `firebase-admin` SDK
- **Frontend**: React 18, React Router DOM 6, Axios, Heroicons (BellIcon, ComputerDesktopIcon, DevicePhoneMobileIcon), date-fns (`formatDistanceToNow`), react-hot-toast (toast notifications), SweetAlert2 (confirmation dialogs only), Firebase Web SDK (`firebase/messaging`)
- **Environment**: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (server-side); Firebase config object (client-side)

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notifications` | In-app notification storage | `id`, `user_id`, `title`, `message`, `type`, `data`, `read_at`, `created_at` |
| `fcm_tokens` | Device push token registry | `id`, `user_id`, `token` (UNIQUE), `device_name`, `platform`, `created_at`, `updated_at` |
| `users` (extended) | User notification preferences | `notifications_enabled`, `push_notifications_enabled`, `web_notifications_enabled` (all BOOLEAN, default TRUE) |

## Architecture Notes
1. **Dual-channel design**: Every notification can be both in-app (DB row) and push (FCM). The `createNotificationWithPush()` helper does both atomically.
2. **User preference enforcement**: Before creating any notification, `createNotificationWithPush()` queries the user's preference flags and skips disabled channels.
3. **Push is fire-and-forget**: Push sending errors are caught and logged but never block the in-app notification insert.
4. **Stale token cleanup**: After each multicast send, tokens that return `registration-token-not-registered` or `invalid-registration-token` are automatically deleted from `fcm_tokens`.
5. **Polling, not WebSocket**: The dropdown polls unread count every 30 seconds. No real-time push event integration exists in the frontend.
6. **Service worker handles background**: `firebase-messaging-sw.js` shows browser notifications when the app is not focused and handles notification click navigation.
7. **Firebase initialized at module load**: Backend `initFirebase()` runs on import. If credentials are missing, push silently no-ops throughout the app lifecycle.
8. **Cross-module integration**: Push notifications are sent from four modules:
   - **Chat** (`staffChat.ts`): `sendPushToUser()` for messages (with @mention, DND, mute, badge logic), calls
   - **Tasks** (`softawareTasks.ts`): `createNotificationWithPush()` for assignment and phase changes
   - **Cases** (`cases.ts`, `adminCases.ts`): `createNotification()` → `notificationService.ts` for all lifecycle events
   - **Scheduling** (`staffChat.ts`): `sendPushToUser()` for scheduled call lifecycle + reminders
9. **Service worker deep linking**: `firebase-messaging-sw.js` routes notification clicks to the correct page based on `data.type` prefix (`chat_` → conversation, `task_` → tasks, `case_` → case detail, `scheduled_call` → conversation). Notifications are grouped by tag for stacking.
10. **Notification type preservation**: `notificationService.ts` maps case-specific types (e.g., `case_created`) to DB-safe enums (`info`, `success`) for storage, but preserves the original type in `data.type` so the service worker can route correctly.
