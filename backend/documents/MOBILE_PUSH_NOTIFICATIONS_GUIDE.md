# Mobile Push Notifications — React Native Implementation Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-03-09  
> **Target:** React Native app developer  
> **Backend Base URL:** `https://api.softaware.net.za`  
> **Firebase Project:** `soft-aware` (project ID)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Firebase Setup](#2-firebase-setup)
3. [FCM Token Registration](#3-fcm-token-registration)
4. [Push Payload Structure](#4-push-payload-structure)
5. [Notification Types Reference](#5-notification-types-reference)
6. [Deep Linking & Navigation](#6-deep-linking--navigation)
7. [Android Notification Channels](#7-android-notification-channels)
8. [Foreground vs Background Handling](#8-foreground-vs-background-handling)
9. [User Notification Preferences](#9-user-notification-preferences)
10. [Complete Code Examples](#10-complete-code-examples)
11. [Testing Checklist](#11-testing-checklist)

---

## 1. Overview

The backend sends push notifications via **Firebase Cloud Messaging (FCM)** across four modules:

| Module | Events | Priority |
|--------|--------|----------|
| **Chat** | New messages, @mentions, incoming calls | High (calls ring immediately) |
| **Tasks** | Task assignment, workflow phase changes | Normal |
| **Cases** | Created, assigned, status change, comments, deletion | Normal |
| **Scheduling** | Call scheduled/cancelled/started, RSVP, reminders | Normal (started = high) |

All push notifications include a `data` payload with a `type` field that determines navigation. The `notification` field (title/body) is also present for display.

---

## 2. Firebase Setup

### 2.1 Firebase Project Config

```
Project ID:         soft-aware
Sender ID:          765240677597
```

Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) from the Firebase console for the `soft-aware` project.

### 2.2 React Native Dependencies

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
# iOS
cd ios && pod install
```

### 2.3 iOS Setup

In `AppDelegate.mm`, ensure Firebase is initialized and APNs registration is enabled:

```objc
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  [FIRApp configure];
  // ...
}
```

Request notification permissions (iOS requires explicit prompt):

```typescript
import messaging from '@react-native-firebase/messaging';

async function requestIOSPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}
```

### 2.4 Android Setup

In `android/app/build.gradle`, the `google-services` plugin handles config automatically. No manual changes needed beyond adding the plugin and `google-services.json`.

---

## 3. FCM Token Registration

### 3.1 Register Device Token

After login, get the FCM token and register it with the backend:

```
POST /api/fcm-tokens
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "token": "<fcm-device-token>",
  "device_name": "iPhone 15 Pro",     // optional, user-friendly label
  "platform": "ios"                    // "android" | "ios" | "web"
}
```

**Response:** `{ "success": true, "message": "Device registered for push notifications." }`

The backend uses UPSERT — safe to call on every app launch.

### 3.2 Unregister on Logout

```
DELETE /api/fcm-tokens/<url-encoded-token>
Authorization: Bearer <jwt>
```

### 3.3 Token Refresh

FCM tokens can rotate. Listen for refresh and re-register:

```typescript
import messaging from '@react-native-firebase/messaging';

messaging().onTokenRefresh(async (newToken) => {
  await api.post('/fcm-tokens', {
    token: newToken,
    device_name: getDeviceName(),
    platform: Platform.OS, // 'ios' | 'android'
  });
});
```

### 3.4 List Registered Devices

```
GET /api/fcm-tokens
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "token": "fcm_token...",
      "device_name": "iPhone 15 Pro",
      "platform": "ios",
      "created_at": "2026-03-09T10:00:00.000Z",
      "updated_at": "2026-03-09T10:00:00.000Z"
    }
  ],
  "fcm_enabled": true
}
```

### 3.5 Check FCM Status

```
GET /api/fcm-tokens/status
Authorization: Bearer <jwt>
```

**Response:** `{ "success": true, "data": { "fcm_enabled": true } }`

---

## 4. Push Payload Structure

Every push notification from the backend has this structure:

```json
{
  "notification": {
    "title": "Task Assigned to You",
    "body": "John assigned you: Fix login bug (Development)"
  },
  "data": {
    "type": "task_assigned",
    "task_id": "42",
    "workflow_phase": "Development",
    "link": "/tasks"
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "softaware_default",
      "sound": "default"
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "default",
        "badge": 1
      }
    }
  }
}
```

**Key rules:**
- `data.type` is **always** a string — use this for routing/navigation
- All `data` values are **strings** (FCM requirement) — parse numbers as needed
- `data.link` contains the web deep link path — map this to your native screen
- `notification.title` and `notification.body` are always present for display

---

## 5. Notification Types Reference

### 5.1 Chat Notifications

#### `chat_message` — New Message

Sent to offline conversation members (respects mute/DND settings).

```json
{
  "notification": {
    "title": "John Smith",
    "body": "Hey, are you available for a quick call?"
  },
  "data": {
    "type": "chat_message",
    "conversationId": "7",
    "messageId": "1234",
    "senderName": "John Smith",
    "messageType": "text",
    "badge": "3",
    "mentioned": "false",
    "sound": "default",
    "link": "/chat?c=7"
  }
}
```

**`messageType` values:** `text`, `image`, `video`, `audio`, `file`, `gif`, `location`, `contact`

When `messageType` is not `text`, the body will be an emoji preview:
- `image` → "📷 Photo"
- `video` → "🎥 Video"
- `audio` → "🎤 Voice message"
- `file` → "📎 filename.pdf"
- `gif` → "GIF"
- `location` → "📍 Location"
- `contact` → "👤 Contact"

#### `chat_mention` — @Mention

Same payload as `chat_message` but:
- `data.type` = `"chat_mention"`
- `data.mentioned` = `"true"`
- Title = "{name} mentioned you"
- **Bypasses mute and DND** — always delivered

```json
{
  "notification": {
    "title": "John Smith mentioned you",
    "body": "@YourName can you review this PR?"
  },
  "data": {
    "type": "chat_mention",
    "conversationId": "7",
    "messageId": "1235",
    "senderName": "John Smith",
    "messageType": "text",
    "badge": "4",
    "mentioned": "true",
    "sound": "default",
    "link": "/chat?c=7"
  }
}
```

#### `incoming_call` — Incoming Voice/Video Call

**⚠️ HIGH PRIORITY** — Must wake device and show full-screen call UI.

```json
{
  "notification": {
    "title": "Incoming video call",
    "body": "John Smith is calling..."
  },
  "data": {
    "type": "incoming_call",
    "callId": "99",
    "callType": "video",
    "conversationId": "7",
    "callerId": "user-uuid-123",
    "callerName": "John Smith",
    "priority": "high",
    "link": "/chat?c=7"
  }
}
```

**`callType` values:** `"voice"` | `"video"`

**Implementation note:** On Android, use a high-priority notification channel with full-screen intent to show an incoming call screen. On iOS, integrate CallKit via `react-native-callkeep` for native call UI.

The backend auto-misses calls after **45 seconds** if not answered.

---

### 5.2 Task Notifications

#### `task_assigned` — Task Assigned to You

```json
{
  "notification": {
    "title": "Task Assigned to You",
    "body": "John Smith assigned you: Fix login bug (Development)"
  },
  "data": {
    "type": "task_assigned",
    "task_id": "42",
    "workflow_phase": "Development",
    "link": "/tasks"
  }
}
```

**Not sent when:** User assigns a task to themselves.

#### `task_phase_changed` — Task Workflow Phase Updated

```json
{
  "notification": {
    "title": "Task Phase Updated",
    "body": "John Smith moved \"Fix login bug\" to QA Testing"
  },
  "data": {
    "type": "task_phase_changed",
    "task_id": "42",
    "workflow_phase": "QA Testing",
    "link": "/tasks"
  }
}
```

**Not sent when:** The assigned user changes the phase themselves.

---

### 5.3 Case Notifications

All case notifications include `caseId` and `caseNumber` in data, plus a `link` pointing to the case detail.

#### `case_created` — New Case Reported

Sent to **all admin users**.

```json
{
  "notification": {
    "title": "New Case: Login page crashes on iOS",
    "body": "Case CASE-0005 was reported — severity: high"
  },
  "data": {
    "type": "case_created",
    "caseId": "uuid-abc-123",
    "caseNumber": "CASE-0005",
    "severity": "high",
    "action_url": "/cases/uuid-abc-123",
    "link": "/cases/uuid-abc-123"
  }
}
```

#### `case_assigned` — Case Assigned to You

```json
{
  "notification": {
    "title": "Case Assigned: Login page crashes on iOS",
    "body": "You have been assigned to case CASE-0005"
  },
  "data": {
    "type": "case_assigned",
    "caseId": "uuid-abc-123",
    "caseNumber": "CASE-0005",
    "action_url": "/cases/uuid-abc-123",
    "link": "/cases/uuid-abc-123"
  }
}
```

#### `case_updated` — Case Status Changed

Sent to case reporter (and assignee on bulk updates).

```json
{
  "notification": {
    "title": "Case Updated: Login page crashes on iOS",
    "body": "Your case CASE-0005 status changed to in progress"
  },
  "data": {
    "type": "case_updated",
    "caseId": "uuid-abc-123",
    "caseNumber": "CASE-0005",
    "status": "in_progress",
    "action_url": "/cases/uuid-abc-123",
    "link": "/cases/uuid-abc-123"
  }
}
```

#### `case_resolved` — Case Resolved/Closed

Same structure as `case_updated` but with `type: "case_resolved"`. Sent when status changes to `resolved` or `closed`.

```json
{
  "notification": {
    "title": "Case Resolved: Login page crashes on iOS",
    "body": "Your case CASE-0005 status changed to resolved"
  },
  "data": {
    "type": "case_resolved",
    "caseId": "uuid-abc-123",
    "caseNumber": "CASE-0005",
    "status": "resolved",
    "action_url": "/cases/uuid-abc-123",
    "link": "/cases/uuid-abc-123"
  }
}
```

#### `case_comment` — New Comment on Case

Sent to reporter and assignee (if different from commenter).

```json
{
  "notification": {
    "title": "New Comment on Case CASE-0005",
    "body": "I've identified the root cause, deploying a fix now..."
  },
  "data": {
    "type": "case_comment",
    "caseId": "uuid-abc-123",
    "caseNumber": "CASE-0005",
    "action_url": "/cases/uuid-abc-123",
    "link": "/cases/uuid-abc-123"
  }
}
```

#### `case_deleted` — Case Removed by Admin

Sent to reporter when an admin deletes their case.

```json
{
  "notification": {
    "title": "Case Removed: Login page crashes on iOS",
    "body": "Your case CASE-0005 has been removed by an administrator"
  },
  "data": {
    "type": "case_deleted",
    "caseNumber": "CASE-0005",
    "link": "/cases"
  }
}
```

---

### 5.4 Scheduling Notifications

All scheduling notifications include `conversationId` and usually `scheduledCallId`.

#### `scheduled_call` — Call Scheduled / You Were Added

```json
{
  "notification": {
    "title": "📅 Video call scheduled",
    "body": "John Smith scheduled \"Sprint Planning\" for 10 Mar 2026, 09:00 (with screen sharing)"
  },
  "data": {
    "type": "scheduled_call",
    "conversationId": "7",
    "scheduledCallId": "15",
    "link": "/chat?c=7"
  }
}
```

Also sent when you're **added as a participant** to an existing scheduled call:

```json
{
  "notification": {
    "title": "📅 Added to scheduled call",
    "body": "You were added to \"Sprint Planning\""
  },
  "data": {
    "type": "scheduled_call",
    "conversationId": "7",
    "scheduledCallId": "15",
    "link": "/chat?c=7"
  }
}
```

#### `scheduled_call_cancelled` — Scheduled Call Cancelled

```json
{
  "notification": {
    "title": "❌ Scheduled call cancelled",
    "body": "John Smith cancelled \"Sprint Planning\""
  },
  "data": {
    "type": "scheduled_call_cancelled",
    "conversationId": "7",
    "link": "/chat?c=7"
  }
}
```

#### `scheduled_call_rsvp` — RSVP Response (to Creator)

Sent to the call creator when a participant accepts or declines.

```json
{
  "notification": {
    "title": "✅ RSVP: Sprint Planning",
    "body": "Jane Doe accepted your scheduled call"
  },
  "data": {
    "type": "scheduled_call_rsvp",
    "conversationId": "7",
    "scheduledCallId": "15",
    "link": "/chat?c=7"
  }
}
```

Declined uses `❌` emoji in title instead.

#### `scheduled_call_reminder` — 15-Minute Reminder

Sent automatically 15 minutes before the scheduled time.

```json
{
  "notification": {
    "title": "⏰ Call starting soon",
    "body": "\"Sprint Planning\" starts at 09:00"
  },
  "data": {
    "type": "scheduled_call_reminder",
    "conversationId": "7",
    "scheduledCallId": "15",
    "link": "/chat?c=7"
  }
}
```

#### `incoming_call` (from scheduled call start)

When a scheduled call is started, participants get a standard `incoming_call` push (same as section 5.1) with an additional `scheduledCallId` field:

```json
{
  "data": {
    "type": "incoming_call",
    "callId": "100",
    "callType": "video",
    "conversationId": "7",
    "callerId": "user-uuid-123",
    "callerName": "John Smith",
    "scheduledCallId": "15",
    "link": "/chat?c=7"
  }
}
```

---

## 6. Deep Linking & Navigation

Map the `data.type` field to native screens. Use `data.link` as a fallback reference.

### 6.1 Navigation Routing Map

```typescript
function getScreenFromNotification(data: Record<string, string>): NavigationTarget {
  const type = data.type || '';
  const conversationId = data.conversationId || data.conversation_id;

  // Chat messages & mentions → Chat screen
  if (type === 'chat_message' || type === 'chat_mention') {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Calls → Chat screen (call UI triggers from socket)
  if (type === 'incoming_call' || type === 'missed_call') {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Scheduled calls → Chat screen (shows scheduled calls panel)
  if (type.startsWith('scheduled_call')) {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Tasks → Task detail or tasks list
  if (type === 'task_assigned' || type === 'task_phase_changed') {
    return data.task_id
      ? { screen: 'TaskDetail', params: { taskId: data.task_id } }
      : { screen: 'TasksList' };
  }

  // Cases → Case detail or cases list
  if (type.startsWith('case_')) {
    return data.caseId && type !== 'case_deleted'
      ? { screen: 'CaseDetail', params: { caseId: data.caseId } }
      : { screen: 'CasesList' };
  }

  // Fallback
  return { screen: 'Notifications' };
}
```

### 6.2 React Navigation Deep Link Config

```typescript
const linking = {
  prefixes: ['softaware://', 'https://softaware.net.za'],
  config: {
    screens: {
      Main: {
        screens: {
          ChatScreen: 'chat',
          TaskDetail: 'tasks/:taskId',
          TasksList: 'tasks',
          CaseDetail: 'cases/:caseId',
          CasesList: 'cases',
          Notifications: 'notifications',
        },
      },
    },
  },
};
```

---

## 7. Android Notification Channels

The backend sends `channelId: 'softaware_default'` for all notifications. Create channels on app startup for Android 8+ (API 26+):

```typescript
import notifee from '@notifee/react-native';

async function createNotificationChannels() {
  // Default channel — normal notifications
  await notifee.createChannel({
    id: 'softaware_default',
    name: 'SoftAware Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  // High-priority channel for incoming calls
  await notifee.createChannel({
    id: 'softaware_calls',
    name: 'Incoming Calls',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    // Full-screen intent for call UI
  });

  // Chat messages
  await notifee.createChannel({
    id: 'softaware_chat',
    name: 'Chat Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  // Quiet channel for scheduling/task updates
  await notifee.createChannel({
    id: 'softaware_updates',
    name: 'Task & Case Updates',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
}
```

**Recommended channel mapping** (override the backend's default in your foreground handler):

| `data.type` | Channel |
|---|---|
| `incoming_call` | `softaware_calls` |
| `chat_message`, `chat_mention` | `softaware_chat` |
| `task_assigned`, `task_phase_changed` | `softaware_updates` |
| `case_*` | `softaware_updates` |
| `scheduled_call*` | `softaware_updates` |
| `scheduled_call_reminder` | `softaware_chat` (higher urgency) |

---

## 8. Foreground vs Background Handling

### 8.1 Background (App Killed or Backgrounded)

FCM automatically displays the `notification` payload as a system notification. No code needed — the OS handles display.

On tap, the app opens and you receive the `data` payload via the initial notification handler:

```typescript
import messaging from '@react-native-firebase/messaging';

// App opened from quit state via notification tap
messaging()
  .getInitialNotification()
  .then((remoteMessage) => {
    if (remoteMessage) {
      const target = getScreenFromNotification(remoteMessage.data);
      navigationRef.navigate(target.screen, target.params);
    }
  });

// App brought from background via notification tap
messaging().onNotificationOpenedApp((remoteMessage) => {
  const target = getScreenFromNotification(remoteMessage.data);
  navigationRef.navigate(target.screen, target.params);
});
```

### 8.2 Foreground (App Open & Active)

When the app is in the foreground, FCM does **not** display a notification automatically. Handle it manually:

```typescript
import messaging from '@react-native-firebase/messaging';

messaging().onMessage(async (remoteMessage) => {
  const data = remoteMessage.data || {};
  const title = remoteMessage.notification?.title || 'SoftAware';
  const body = remoteMessage.notification?.body || '';
  const type = data.type || '';

  // Option 1: Show in-app banner/toast
  showInAppNotification({ title, body, data });

  // Option 2: Show local notification (recommended for calls)
  if (type === 'incoming_call') {
    // Show full-screen call UI immediately
    showIncomingCallScreen({
      callId: data.callId,
      callType: data.callType,
      callerName: data.callerName,
      conversationId: data.conversationId,
    });
    return;
  }

  // Option 3: Show local notification via notifee
  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: getChannelForType(type),
      smallIcon: 'ic_notification',
      pressAction: { id: 'default' },
    },
  });
});
```

### 8.3 Data-Only Messages (Silent Push)

Currently, **all** backend push messages include both `notification` and `data` payloads. There are no data-only silent pushes.

### 8.4 Background Handler for Custom Processing

If you need to run code when a notification arrives in the background (e.g., update badge count from `data.badge`):

```typescript
// index.js (must be top-level, outside any component)
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const data = remoteMessage.data || {};

  // Update app badge count
  if (data.badge) {
    await notifee.setBadgeCount(parseInt(data.badge, 10));
  }

  // Pre-fetch chat message for instant display when app opens
  if (data.type === 'chat_message' && data.conversationId) {
    // Cache the message ID so ChatScreen scrolls to it on open
    await AsyncStorage.setItem('pending_message', JSON.stringify({
      conversationId: data.conversationId,
      messageId: data.messageId,
    }));
  }
});
```

---

## 9. User Notification Preferences

Users control their notification experience via three toggles in Profile settings.

### 9.1 Get Preferences

Preferences are returned as part of the profile response:

```
GET /api/profile
Authorization: Bearer <jwt>
```

Relevant fields in response:
```json
{
  "notifications_enabled": true,
  "push_notifications_enabled": true,
  "web_notifications_enabled": true
}
```

| Field | Default | Effect on Mobile |
|---|---|---|
| `notifications_enabled` | `true` | If `false`, backend sends **nothing** (no in-app, no push) |
| `push_notifications_enabled` | `true` | If `false`, backend skips FCM push (in-app DB row still created) |
| `web_notifications_enabled` | `true` | Controls web in-app only — **does not affect mobile push** |

### 9.2 Update Preferences

```
PUT /api/profile/notification-preferences
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "notifications_enabled": true,
  "push_notifications_enabled": true,
  "web_notifications_enabled": true
}
```

### 9.3 Mobile Settings Screen

Show two toggles in the mobile settings:

| Toggle | Maps to | Description |
|---|---|---|
| **All Notifications** | `notifications_enabled` | Master kill switch — disables everything |
| **Push Notifications** | `push_notifications_enabled` | Disable push while keeping in-app |

The `web_notifications_enabled` toggle is irrelevant for mobile — hide it or label it "Web Notifications" and explain it only affects the browser.

---

## 10. Complete Code Examples

### 10.1 Full Notification Service (`src/services/notifications.ts`)

```typescript
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { navigationRef } from '../navigation/RootNavigation';
import api from '../api/client';

const FCM_TOKEN_KEY = 'fcm_device_token';

// ─── Token Registration ────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<boolean> {
  try {
    // Request permission (iOS only, Android auto-grants)
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) return false;
    }

    const token = await messaging().getToken();
    if (!token) return false;

    // Skip if already registered with this token
    const existing = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (existing === token) return true;

    // Register with backend
    await api.post('/fcm-tokens', {
      token,
      device_name: getDeviceName(),
      platform: Platform.OS, // 'ios' | 'android'
    });

    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    console.log('[Push] Registered FCM token');
    return true;
  } catch (err) {
    console.error('[Push] Registration failed:', err);
    return false;
  }
}

export async function unregisterFromPushNotifications(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (!token) return;

    await api.delete(`/fcm-tokens/${encodeURIComponent(token)}`);
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    console.log('[Push] Unregistered FCM token');
  } catch (err) {
    console.error('[Push] Unregistration failed:', err);
  }
}

function getDeviceName(): string {
  // Use react-native-device-info for better names
  return Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
}

// ─── Notification Routing ──────────────────────────────────────────

interface NavigationTarget {
  screen: string;
  params?: Record<string, any>;
}

export function getScreenFromNotification(
  data: Record<string, string> | undefined,
): NavigationTarget {
  if (!data) return { screen: 'Notifications' };

  const type = data.type || '';
  const conversationId = data.conversationId || data.conversation_id;

  // Chat
  if (type === 'chat_message' || type === 'chat_mention') {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Calls
  if (type === 'incoming_call' || type === 'missed_call') {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Scheduled calls
  if (type.startsWith('scheduled_call')) {
    return { screen: 'ChatScreen', params: { conversationId } };
  }

  // Tasks
  if (type === 'task_assigned' || type === 'task_phase_changed') {
    return data.task_id
      ? { screen: 'TaskDetail', params: { taskId: data.task_id } }
      : { screen: 'TasksList' };
  }

  // Cases
  if (type.startsWith('case_')) {
    return data.caseId && type !== 'case_deleted'
      ? { screen: 'CaseDetail', params: { caseId: data.caseId } }
      : { screen: 'CasesList' };
  }

  return { screen: 'Notifications' };
}

// ─── Listeners ─────────────────────────────────────────────────────

export function setupNotificationListeners(): () => void {
  // Foreground message
  const unsubForeground = messaging().onMessage(async (remoteMessage) => {
    handleForegroundNotification(remoteMessage);
  });

  // Background tap → app brought to foreground
  const unsubBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
    if (remoteMessage.data) {
      const target = getScreenFromNotification(remoteMessage.data as Record<string, string>);
      navigationRef.current?.navigate(target.screen as never, target.params as never);
    }
  });

  // Token refresh
  const unsubTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
    try {
      await api.post('/fcm-tokens', {
        token: newToken,
        device_name: getDeviceName(),
        platform: Platform.OS,
      });
      await AsyncStorage.setItem(FCM_TOKEN_KEY, newToken);
    } catch (err) {
      console.error('[Push] Token refresh registration failed:', err);
    }
  });

  return () => {
    unsubForeground();
    unsubBackground();
    unsubTokenRefresh();
  };
}

// Check for initial notification (app opened from killed state)
export async function checkInitialNotification(): Promise<void> {
  const remoteMessage = await messaging().getInitialNotification();
  if (remoteMessage?.data) {
    const target = getScreenFromNotification(remoteMessage.data as Record<string, string>);
    // Small delay to let navigation mount
    setTimeout(() => {
      navigationRef.current?.navigate(target.screen as never, target.params as never);
    }, 500);
  }
}

function handleForegroundNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): void {
  const data = (remoteMessage.data || {}) as Record<string, string>;
  const type = data.type || '';

  // Incoming call → show call UI immediately
  if (type === 'incoming_call') {
    // Trigger your incoming call screen/overlay
    // e.g., IncomingCallManager.show({ ... })
    return;
  }

  // All other notifications → show in-app banner
  // Use your preferred in-app notification library
  // e.g., react-native-notifee, react-native-flash-message, custom component
}
```

### 10.2 Background Handler (`index.js`)

```typescript
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

// Must be registered at top level, outside of any component
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const data = remoteMessage.data || {};

  // Update badge
  if (data.badge) {
    await notifee.setBadgeCount(parseInt(data.badge, 10));
  }
});
```

### 10.3 App Entry Point Integration

```typescript
// App.tsx
import { useEffect } from 'react';
import {
  registerForPushNotifications,
  setupNotificationListeners,
  checkInitialNotification,
} from './services/notifications';

function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Register device for push
    registerForPushNotifications();

    // Set up all notification listeners
    const cleanup = setupNotificationListeners();

    // Check if app was opened from a notification
    checkInitialNotification();

    return cleanup;
  }, [isAuthenticated]);

  // ...
}
```

---

## 11. Testing Checklist

### 11.1 Token Registration
- [ ] FCM token registered on first login
- [ ] Token persisted in AsyncStorage — no duplicate registration on app relaunch
- [ ] Token refreshed when FCM rotates it
- [ ] Token unregistered on logout
- [ ] Token correctly shows platform as `ios` or `android`

### 11.2 Chat Notifications
- [ ] Receive push when offline and someone sends a message
- [ ] Tap notification → opens correct conversation
- [ ] @Mention notification arrives even if conversation is muted
- [ ] Media messages show correct emoji preview (📷, 🎥, 🎤, 📎)
- [ ] Badge count updates from `data.badge`
- [ ] No push received for own messages

### 11.3 Call Notifications
- [ ] `incoming_call` shows full-screen call UI (Android)
- [ ] `incoming_call` triggers CallKit (iOS)
- [ ] Call notification auto-dismisses after 45 seconds
- [ ] Tap call notification → opens conversation with active call

### 11.4 Task Notifications
- [ ] `task_assigned` → navigates to task detail
- [ ] `task_phase_changed` → navigates to task detail
- [ ] No notification when assigning task to yourself
- [ ] No notification when you change your own task's phase

### 11.5 Case Notifications
- [ ] `case_created` received by admin users
- [ ] `case_assigned` → navigates to case detail
- [ ] `case_updated` → navigates to case detail
- [ ] `case_resolved` → navigates to case detail
- [ ] `case_comment` → navigates to case detail
- [ ] `case_deleted` → navigates to cases list (no detail to show)

### 11.6 Scheduling Notifications
- [ ] `scheduled_call` (created) → opens conversation
- [ ] `scheduled_call` (added as participant) → opens conversation
- [ ] `scheduled_call_cancelled` → opens conversation
- [ ] `scheduled_call_rsvp` received by call creator
- [ ] `scheduled_call_reminder` arrives ~15 min before call
- [ ] Started scheduled call sends `incoming_call` push

### 11.7 User Preferences
- [ ] Disabling `notifications_enabled` stops ALL pushes
- [ ] Disabling `push_notifications_enabled` stops pushes but in-app still works
- [ ] Re-enabling push → next notification arrives normally

### 11.8 Edge Cases
- [ ] Notification tap from killed state navigates correctly
- [ ] Notification tap from background navigates correctly
- [ ] Foreground notification shows in-app banner (not system notification)
- [ ] Multiple rapid notifications don't crash the app
- [ ] Expired/invalid token auto-cleaned by backend (no action needed from app)

---

## Appendix A: All `data.type` Values

| `data.type` | Module | Navigate To |
|---|---|---|
| `chat_message` | Chat | ChatScreen (conversationId) |
| `chat_mention` | Chat | ChatScreen (conversationId) |
| `incoming_call` | Chat / Scheduling | ChatScreen (conversationId) + call UI |
| `task_assigned` | Tasks | TaskDetail (task_id) |
| `task_phase_changed` | Tasks | TaskDetail (task_id) |
| `case_created` | Cases | CaseDetail (caseId) |
| `case_assigned` | Cases | CaseDetail (caseId) |
| `case_updated` | Cases | CaseDetail (caseId) |
| `case_resolved` | Cases | CaseDetail (caseId) |
| `case_comment` | Cases | CaseDetail (caseId) |
| `case_deleted` | Cases | CasesList |
| `scheduled_call` | Scheduling | ChatScreen (conversationId) |
| `scheduled_call_cancelled` | Scheduling | ChatScreen (conversationId) |
| `scheduled_call_rsvp` | Scheduling | ChatScreen (conversationId) |
| `scheduled_call_reminder` | Scheduling | ChatScreen (conversationId) |

## Appendix B: Data Fields by Type

| `data.type` | Fields Always Present | Optional Fields |
|---|---|---|
| `chat_message` | `conversationId`, `messageId`, `senderName`, `messageType`, `badge`, `mentioned`, `sound`, `link` | |
| `chat_mention` | `conversationId`, `messageId`, `senderName`, `messageType`, `badge`, `mentioned`, `sound`, `link` | |
| `incoming_call` | `callId`, `callType`, `conversationId`, `callerId`, `callerName`, `link` | `priority`, `scheduledCallId` |
| `task_assigned` | `task_id`, `workflow_phase`, `link` | |
| `task_phase_changed` | `task_id`, `workflow_phase`, `link` | |
| `case_created` | `caseId`, `caseNumber`, `severity`, `action_url`, `link` | |
| `case_assigned` | `caseId`, `caseNumber`, `action_url`, `link` | |
| `case_updated` | `caseId`, `caseNumber`, `status`, `action_url`, `link` | |
| `case_resolved` | `caseId`, `caseNumber`, `status`, `action_url`, `link` | |
| `case_comment` | `caseId`, `caseNumber`, `action_url`, `link` | |
| `case_deleted` | `caseNumber`, `link` | |
| `scheduled_call` | `conversationId`, `scheduledCallId`, `link` | |
| `scheduled_call_cancelled` | `conversationId`, `link` | |
| `scheduled_call_rsvp` | `conversationId`, `scheduledCallId`, `link` | |
| `scheduled_call_reminder` | `conversationId`, `scheduledCallId`, `link` | |

> **Remember:** All data values are **strings**. Parse numeric IDs with `parseInt()` or `Number()` as needed.
