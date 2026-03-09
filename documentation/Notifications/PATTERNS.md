# Notifications — Architecture Patterns

## Design Patterns

### 1. Dual-Channel Notification (In-App + Push)
The primary notification function `createNotificationWithPush()` inserts a DB row and sends a push notification in a single call:

```typescript
// 1. Insert in-app notification (synchronous, must succeed)
await db.execute('INSERT INTO notifications ...', [...]);

// 2. Send push (fire-and-forget, failures logged but don't throw)
sendPushToUser(userId, payload).catch(err => console.error(...));
```

**Rationale**: In-app notification is the source of truth. Push is a delivery optimization that must never block or fail the notification creation.

### 2. Graceful Degradation (Firebase Optional)
Firebase initialization is attempted at module load but doesn't throw if credentials are missing:

```typescript
// Module load — non-blocking
initFirebase(); // logs warning if env vars missing, sets firebaseInitialized = false

// Every push function checks first
if (!firebaseInitialized) return { sent: 0, failed: 0 };
```

**Result**: The entire notification system works without Firebase configured — in-app notifications function normally, push simply no-ops.

### 3. Stale Token Auto-Cleanup
After every multicast push, the system inspects per-token results and removes invalid tokens:

```typescript
response.responses.forEach((resp, idx) => {
  if (!resp.success) {
    const code = resp.error?.code;
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') {
      staleTokenIds.push(devices[idx].id);
    }
  }
});

if (staleTokenIds.length > 0) {
  await db.execute('DELETE FROM fcm_tokens WHERE id IN (...)', staleTokenIds);
}
```

**Rationale**: FCM tokens expire when users uninstall apps or clear browser data. Without cleanup, the `fcm_tokens` table accumulates dead tokens that slow future sends.

### 4. UPSERT Token Registration
Device tokens use `INSERT ... ON DUPLICATE KEY UPDATE` to handle re-registration gracefully:

```sql
INSERT INTO fcm_tokens (user_id, token, device_name, platform)
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  device_name = VALUES(device_name),
  platform = VALUES(platform),
  updated_at = NOW()
```

**Rationale**: FCM can return the same token across sessions. A user might switch devices that happen to get the same token. UPSERT handles all cases without error.

### 5. Polling-Based Badge Updates
The `NotificationDropdown` polls the unread count every 30 seconds:

```typescript
useEffect(() => {
  fetchUnreadCount();
  const interval = setInterval(fetchUnreadCount, 30000);
  return () => clearInterval(interval);
}, []);
```

**Trade-off**: Simple and reliable, but introduces up to 30s latency for new notifications. WebSocket or Server-Sent Events would provide real-time updates.

### 6. Platform-Specific Push Configuration
The multicast message includes platform-specific overrides:

```typescript
const message = {
  notification: { title, body },
  android: {
    priority: 'high',
    notification: { channelId: 'softaware_default', sound: 'default' },
  },
  apns: {
    payload: { aps: { sound: 'default', badge: 1 } },
  },
};
```

**Rationale**: Android requires high priority for immediate delivery. iOS needs explicit sound and badge configuration.

### 7. Service Worker Background Handling
Background notifications are handled by a dedicated service worker that runs independently of the main app:

```
App focused    → onForegroundMessage() → in-app toast / custom handler
App background → firebase-messaging-sw.js → self.registration.showNotification()
Notification click → focus existing window OR open new → navigate to data.link
```

### 8. User-Scoped Queries
All notification operations are scoped to the authenticated user:

```sql
-- List: only user's notifications
SELECT * FROM notifications WHERE user_id = ?
-- Read: can only mark own notifications
UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?
-- Delete: can only delete own
DELETE FROM notifications WHERE id = ? AND user_id = ?
```

### 9. Notification Action URLs
Notifications can carry an `action_url` in their `data` JSON field. The dropdown parses it on click:

```typescript
const data = typeof notification.data === 'string'
  ? JSON.parse(notification.data)
  : notification.data;

if (data?.action_url) {
  navigate(data.action_url);
}
```

This enables deep-linking from notifications to specific pages.

---

## Anti-Patterns & Technical Debt

### 🔴 Critical

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| NOTIF-001 | **`dangerouslySetInnerHTML` on notification message** — The dropdown renders `notification.message` as raw HTML. If any notification contains user-supplied or untrusted content, this is an XSS vulnerability. | `NotificationDropdown.tsx:192` | XSS risk |
| NOTIF-002 | **No authorization on create endpoint** — `POST /notifications` allows any authenticated user to create notifications for ANY other user (`user_id` field). No check that the sender has permission to notify the target. | `notifications.ts:102–130` | Any user can spam any other user |
| NOTIF-003 | **Firebase credentials hardcoded in frontend** — Firebase config (apiKey, projectId, VAPID_KEY) is hardcoded in `firebase.ts` and `firebase-messaging-sw.js`. While Firebase client keys are designed to be public, the duplication creates maintenance risk. | `firebase.ts`, `firebase-messaging-sw.js` | Config drift between files |

### 🟡 Moderate

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| NOTIF-004 | **Client-side pagination is fake** — `NotificationModel.getNotifications()` always returns `total_pages: 1` and uses the response array length as total. The backend `LIMIT` is treated as page size, but there's no `OFFSET`. | `NotificationModel.ts:28–34` | Pagination UI doesn't work beyond page 1 |
| NOTIF-005 | **No server-side pagination** — Backend `GET /notifications` only supports `LIMIT`, not `OFFSET` or `page`. | `notifications.ts:20–25` | Can only fetch first N notifications |
| NOTIF-006 | **Polling overhead** — Every open browser tab polls `/unread/count` every 30 seconds. With many users, this creates unnecessary load. | `NotificationDropdown.tsx:22–25` | O(tabs × users) requests/minute |
| NOTIF-007 | **No per-type notification preferences** — Users have master/web/push toggles but cannot opt out of specific notification types (e.g., disable case notifications while keeping chat). | — | No granular control over notification volume |
| NOTIF-008 | **Hard delete with no soft-delete** — `DELETE /notifications/:id` permanently removes the row. No `deleted_at` or archive mechanism. | `notifications.ts:85–92` | No audit trail |

### 🟢 Minor

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| NOTIF-009 | **Inconsistent icons** — Full page uses Heroicons for notification types; dropdown uses emoji (🔵, ✅, ⚠️, ❌). | `Notifications.tsx:84–95` vs `NotificationDropdown.tsx:118–127` | Visual inconsistency |
| NOTIF-010 | **No notification grouping** — Multiple notifications of the same type are listed individually. No collapse or summary. | — | Notification fatigue |
| NOTIF-011 | **Service worker Firebase version hardcoded** — `importScripts('...firebase/10.12.0/...')` pins a specific version that may diverge from the npm-installed version. | `firebase-messaging-sw.js:6–7` | Version mismatch potential |

---

## Performance Characteristics

| Operation | DB Queries | Est. Time | Frequency |
|-----------|-----------|-----------|-----------|
| List notifications | 2 (SELECT + COUNT) | ~10ms | On page load |
| Unread count | 1 (COUNT) | ~5ms | Every 30s per tab |
| Mark as read | 1 (UPDATE) | ~5ms | Per click |
| Mark all read | 1 (UPDATE) | ~5ms | Per click |
| Delete | 1 (DELETE) | ~5ms | Per click |
| Create + push | 2 (INSERT + SELECT tokens) + FCM call | ~50-200ms | Per event |
| Register FCM token | 1 (UPSERT) | ~5ms | On registration |

---

## Security Considerations

1. **All routes require JWT** — No anonymous access to any notification endpoint.
2. **User scoping on read/delete** — WHERE clause includes `user_id = ?` preventing cross-user access.
3. **Missing**: No rate limiting on `POST /notifications` (NOTIF-002 amplifies this).
4. **Missing**: No input sanitization on `message` field before HTML rendering (NOTIF-001).
5. **Firebase private key** — Server-side only, loaded from env vars. Not exposed to client.
6. **VAPID key** — Public by design (Firebase client push registration). Safe to expose.
