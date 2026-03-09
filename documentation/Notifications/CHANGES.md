# Notifications — Known Issues & Change Log

## Change Log

### 2026-03-09 — Cross-Module Push Notification Audit

**What changed:** Audited push notification coverage across Chat, Tasks, Cases, and Scheduling modules. Confirmed all expected events send push notifications. Fixed one gap: bulk-delete in `adminCases.ts` now notifies reporters (matching single-delete behavior).

**Coverage verified:**
- **Chat**: Messages (with @mention/DND/mute/badge), incoming calls ✅
- **Tasks**: Assignment, phase changes ✅
- **Cases**: Created→admins, assigned, status changes, comments→reporter+assignee, single delete→reporter, bulk assign, bulk status update ✅
- **Scheduling**: Created, cancelled, RSVP→creator, started, participant added, 15-min reminders ✅
- **Service worker**: Deep linking by `data.type` prefix for all modules, notification grouping by tag ✅

**Files changed:** `adminCases.ts` (added reporter notification on bulk delete)

**Documentation updated:** `Notifications/README.md` — added full cross-module push notification coverage table, updated architecture notes, file stats, service worker description.

---

### 2026-03-07 — Toast Notification Standardization

**What changed:** Migrated all 118 raw `toast()` / `toast.success()` / `toast.error()` calls across 16 frontend files to use the centralized `notify` utility from `src/utils/notify.ts`.

**Why:** Multiple files imported `toast` directly from `react-hot-toast`, bypassing the project's centralized notification utility. This caused:
- TypeScript build errors (`TS2304: Cannot find name 'toast'`) when files lost their imports
- Inconsistent toast styling and duration across pages
- No single place to change notification behavior

**Migration summary:**
- `toast.success(msg)` → `notify.success(msg)`
- `toast.error(msg)` → `notify.error(msg)`
- `toast(msg, { icon })` → `notify.info('icon msg')` or `notify.warning(msg)`
- All 16 files now import `{ notify }` from `utils/notify` instead of `toast` from `react-hot-toast`
- SweetAlert2 (`Swal`) retained only for confirmation dialogs and input prompts
- New documentation: [TOAST_SYSTEM.md](TOAST_SYSTEM.md)

**Files changed:** ChatPage.tsx, DatabaseManager.tsx, GroupsPage.tsx, PlanningPage.tsx, TasksPage.tsx, ErrorReports.tsx, PermissionSync.tsx, ScheduledCallsPanel.tsx, MessageInput.tsx (chat), ChatHeader.tsx, ChatSidebar.tsx, ScheduleCallDialog.tsx, ForwardDialog.tsx, ChatDialogs.tsx, StarredMessagesPanel.tsx, MessageInput.tsx (groups)

---

## Known Issues

### 🔴 Critical — Security

| ID | Issue | File | Impact |
|----|-------|------|--------|
| NOTIF-001 | **XSS via `dangerouslySetInnerHTML`** — Notification dropdown renders `notification.message` as raw HTML. Any notification with injected script tags will execute in the user's browser. | `NotificationDropdown.tsx:192` | Cross-site scripting vulnerability |
| NOTIF-002 | **No authorization on notification creation** — Any authenticated user can send notifications to ANY other user by setting `user_id` in `POST /notifications`. No sender permission validation. | `notifications.ts:102–130` | Unauthorized notification spam |

### 🔴 Critical — Functionality

| ID | Issue | File | Impact |
|----|-------|------|--------|
| NOTIF-004 | **Pagination is broken** — Backend only supports `LIMIT` (no `OFFSET`). Frontend `NotificationModel` hardcodes `total_pages: 1`. The pagination UI in `Notifications.tsx` renders but never fetches page 2+. | `NotificationModel.ts:28–34`, `notifications.ts:20–25` | Users can only see first 50 notifications |

### 🟡 Moderate

| ID | Issue | File | Impact |
|----|-------|------|--------|
| NOTIF-003 | **Firebase config duplicated** — Same Firebase project config is hardcoded in both `firebase.ts` and `firebase-messaging-sw.js`. Changes to one won't automatically update the other. | `firebase.ts:11–18`, `firebase-messaging-sw.js:9–17` | Config drift risk |
| NOTIF-006 | **Polling creates unnecessary load** — Every browser tab polls `/unread/count` every 30s. No deduplication or visibility-based throttling. | `NotificationDropdown.tsx:22–25` | Server load scales with open tabs |
| NOTIF-007 | **No per-type notification preferences** — Users can toggle master/web/push notifications but cannot opt out of specific notification types (e.g., disable case notifications while keeping chat). | — | No granular control over notification volume |
| NOTIF-008 | **Hard delete only** — No soft delete (`deleted_at`). Deleted notifications are permanently lost. | `notifications.ts:85–92` | No audit trail |

### 🟢 Minor

| ID | Issue | File | Impact |
|----|-------|------|--------|
| NOTIF-009 | **Inconsistent notification icons** — Full page uses Heroicons; dropdown uses emoji. | `Notifications.tsx` vs `NotificationDropdown.tsx` | Visual inconsistency |
| NOTIF-010 | **No notification grouping** — Similar notifications are not collapsed or summarized. | — | Notification fatigue |
| NOTIF-011 | **Service worker Firebase SDK version pinned** — `importScripts('...10.12.0...')` may diverge from npm package version. | `firebase-messaging-sw.js:6–7` | Potential compatibility issues |

---

## Migration Notes

### Fix Pagination (NOTIF-004)
**Backend** — Add `OFFSET` support:
```typescript
// Before:
const limit = Math.min(Number(req.query.limit) || 50, 100);
let sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;

// After:
const limit = Math.min(Number(req.query.limit) || 50, 100);
const page = Math.max(Number(req.query.page) || 1, 1);
const offset = (page - 1) * limit;

const countRow = await db.queryOne<{ count: number }>(
  `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?`, [userId]
);
const total = countRow?.count || 0;

let sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
const notifications = await db.query(sql, [userId, limit, offset]);

res.json({
  success: true,
  data: notifications,
  unread_count: unreadRow?.count || 0,
  pagination: { page, per_page: limit, total, total_pages: Math.ceil(total / limit) }
});
```

### Fix XSS (NOTIF-001)
Replace `dangerouslySetInnerHTML` with safe text rendering:
```tsx
// Before (DANGEROUS):
<div dangerouslySetInnerHTML={{ __html: notification.message }} />

// After (safe):
<p className="text-sm text-gray-600 mt-1">{notification.message}</p>

// Or if HTML is needed, use DOMPurify:
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notification.message) }} />
```

### Fix Authorization (NOTIF-002)
Add permission check on notification creation:
```typescript
// Before:
const targetUserId = input.user_id || req.userId!;

// After:
const targetUserId = input.user_id || req.userId!;
if (input.user_id && input.user_id !== req.userId) {
  // Only admins can send notifications to other users
  const isAdmin = await checkIsAdmin(req.userId!);
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Cannot send notifications to other users' });
  }
}
```

### Reduce Polling Load (NOTIF-006)
Use visibility API to pause polling when tab is hidden:
```typescript
useEffect(() => {
  let interval: NodeJS.Timer;

  const startPolling = () => {
    fetchUnreadCount();
    interval = setInterval(fetchUnreadCount, 30000);
  };

  const handleVisibility = () => {
    if (document.hidden) {
      clearInterval(interval);
    } else {
      startPolling();
    }
  };

  startPolling();
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, []);
```

---

## Future Enhancements

### Priority 1 — Security
- [ ] Sanitize notification message HTML or switch to plain text (NOTIF-001)
- [ ] Add permission check on `POST /notifications` for cross-user sends (NOTIF-002)
- [ ] Add rate limiting on notification creation endpoint

### Priority 2 — Core Functionality
- [ ] Implement server-side pagination with `OFFSET` (NOTIF-004)
- [ ] Add notification preferences (opt-in/opt-out per type)
- [ ] Implement real-time updates via WebSocket or SSE (replace polling)

### Priority 3 — Performance
- [ ] Add visibility-based polling throttle (NOTIF-006)
- [ ] Cache unread count with short TTL
- [ ] Batch notification creation for bulk events

### Priority 4 — Features
- [ ] Notification grouping/stacking (collapse similar notifications)
- [ ] Email notification channel (alongside in-app + push)
- [ ] Notification templates (predefined formats for common events)
- [ ] Notification history/archive (soft delete) (NOTIF-008)
- [ ] Admin notification broadcast (send to all users/teams)
- [ ] Scheduled notifications (send at future time)

### Priority 5 — Code Quality
- [ ] Unify notification icons between page and dropdown (NOTIF-009)
- [ ] Extract Firebase config to environment variables (NOTIF-003)
- [ ] Sync service worker Firebase SDK version with npm package (NOTIF-011)
- [ ] Add TypeScript strict typing to notification data field
