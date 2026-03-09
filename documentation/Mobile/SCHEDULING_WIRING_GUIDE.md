# Mobile App — Scheduling Feature Wiring Guide

> **Created:** March 2026  
> **Purpose:** Step-by-step guide for wiring the call-scheduling module into the React Native mobile app.  
> **Audience:** Mobile developer(s)  
> **Pre-requisite reading:** `opt/documentation/Scheduling/` (full backend docs), `opt/documentation/Mobile/APP_WIRING_AND_STATUS.md` (current app state)

---

## Table of Contents

1. [Overview](#1-overview)
2. [What Already Exists (Reuse These)](#2-what-already-exists)
3. [New Files to Create](#3-new-files-to-create)
4. [Files to Modify](#4-files-to-modify)
5. [TypeScript Types](#5-typescript-types)
6. [API Service — `api/scheduling.ts`](#6-api-service)
7. [Socket Events — Extend `useChatSocket`](#7-socket-events)
8. [Push Notifications — Extend `chatNotificationHandler`](#8-push-notifications)
9. [Context — Extend `ChatContext`](#9-context-updates)
10. [Navigation Changes](#10-navigation-changes)
11. [Screens](#11-screens)
12. [Reusable Components](#12-reusable-components)
13. [Offline & Caching](#13-offline--caching)
14. [API Reference (Quick)](#14-api-reference)
15. [Socket Event Reference](#15-socket-event-reference)
16. [Implementation Checklist](#16-implementation-checklist)

---

## 1. Overview

The backend already has 9 REST endpoints + Socket.IO events + push notifications for call scheduling. The web frontend has a modal dialog and slide-over panel. The mobile app needs equivalent screens wired to the same backend.

**What scheduling does:**
- Schedule voice/video calls within any chat conversation
- RSVP system (accept/decline) for participants
- Recurring schedules (daily, weekly, biweekly, monthly)
- Start a scheduled call → creates a real WebRTC call session (reuses existing call infrastructure)
- Reminders (push + socket) 15 minutes before
- Creator can add/remove participants after creation

**What the mobile app already has that scheduling plugs into:**
- `api/client.ts` — HTTP client with JWT auto-attach (scheduling endpoints use the same auth)
- `api/chat.ts` — Call-related endpoints already wired (ad-hoc calls)
- `useChatSocket` hook — Socket.IO `/chat` namespace, already handles `call-ringing`, `call-missed` events
- `chatNotificationHandler.ts` — FCM foreground handler for chat, already suppresses same-conversation toasts
- `ChatScreen` — Full calling UI (WebRTC), triggered via `handleStartCall()`
- `ChatContext` — Conversations, presence, typing, unread counts
- `GroupsStack` navigation — All chat screens nested here

**Effort estimate:** ~1,200–1,500 LOC across 5–7 new files + 4–5 modified files.

---

## 2. What Already Exists (Reuse These)

### HTTP Client
```
src/api/client.ts
```
Singleton with JWT auto-attach. All scheduling endpoints are under `/staff-chat/scheduled-calls` — same auth as existing chat endpoints. Use the same `client.get()`, `client.post()`, `client.put()`, `client.delete()` pattern as `api/chat.ts`.

### Socket.IO Connection
```
src/services/chatSocket.ts   — raw socket singleton
src/hooks/useChatSocket.ts   — React hook that wires events to state
```
The scheduling socket event is `'scheduled-call'` on the `/chat` namespace — same namespace already connected. You only need to add one new event listener.

### Push Notifications
```
src/services/chatNotificationHandler.ts
src/services/notifications.ts
```
The backend sends push notifications with `data.type = 'scheduled-call'` and `data.type = 'scheduled-call-reminder'`. You need to handle these in the existing notification handler.

### Call Infrastructure
```
src/screens/groups/ChatScreen.tsx → handleStartCall()
```
When a scheduled call is started via `POST /:id/start`, the response returns `{ call_id, conversation_id, call_type, status: 'ringing' }`. This feeds directly into the existing WebRTC flow — no new call UI needed.

### Navigation Deep-Linking
```
src/services/notificationNavigation.ts
```
Already maps notification types to navigation routes. Add the scheduling types here.

### UI Components
```
src/components/ui/Avatar.tsx          — participant avatars
src/components/ui/Badge.tsx           — RSVP status badges (StatusDot, color variants)
src/components/ui/AppCard.tsx         — card container for call items
src/components/ui/FormControls.tsx    — AppTextInput, AppButton
src/components/ui/StateViews.tsx      — LoadingView, EmptyView, ErrorBanner
src/components/ui/GradientHeader.tsx  — screen header
src/components/ui/PaginatedList.tsx   — if pagination needed for call history
```

---

## 3. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/api/scheduling.ts` | API service — 9 methods matching backend endpoints | ~120 |
| 2 | `src/types/scheduling.ts` | TypeScript interfaces for scheduled calls + participants | ~50 |
| 3 | `src/screens/groups/ScheduledCallsScreen.tsx` | List view — upcoming/all calls with RSVP actions | ~350 |
| 4 | `src/screens/groups/ScheduleCallFormScreen.tsx` | Create/edit form — title, date, time, type, recurrence, participants | ~400 |
| 5 | `src/screens/groups/ScheduledCallDetailScreen.tsx` | Detail view — full info, participant list, actions | ~300 |
| 6 | `src/components/ui/ScheduledCallCard.tsx` | Reusable card for rendering a call in lists | ~100 |

**Total new: ~1,320 LOC across 6 files**

---

## 4. Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `src/hooks/useChatSocket.ts` | Add `'scheduled-call'` event listener, expose callback prop |
| 2 | `src/services/chatNotificationHandler.ts` | Handle `'scheduled-call'` and `'scheduled-call-reminder'` push types |
| 3 | `src/services/notificationNavigation.ts` | Map scheduling notification types → screen navigation |
| 4 | `src/navigation/FeatureStacks.tsx` | Add 3 new screens to `GroupsStack` |
| 5 | `src/navigation/types.ts` | Add param types for new screens |
| 6 | `src/screens/groups/ChatScreen.tsx` | Add calendar icon to header, navigate to ScheduledCallsScreen |
| 7 | `src/contexts/ChatContext.tsx` | *(Optional)* Add `scheduledCallCount` for badge on chat header |

---

## 5. TypeScript Types

Create `src/types/scheduling.ts`:

```typescript
export interface ScheduledCallParticipant {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  rsvp: 'pending' | 'accepted' | 'declined';
}

export interface ScheduledCall {
  id: number;
  conversation_id: number;
  created_by: string;
  creator_name: string;
  creator_avatar: string | null;
  title: string;
  description: string | null;
  call_type: 'voice' | 'video';
  screen_share: boolean;
  scheduled_at: string;            // ISO 8601
  duration_minutes: number;
  recurrence: RecurrenceType;
  recurrence_end: string | null;
  status: ScheduledCallStatus;
  call_session_id: number | null;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  my_rsvp: 'pending' | 'accepted' | 'declined';
  // Present on detail & create responses:
  participants?: ScheduledCallParticipant[];
  // Present on list responses:
  participant_count?: number;
  accepted_count?: number;
}

export type ScheduledCallStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type RsvpValue = 'pending' | 'accepted' | 'declined';

export interface CreateScheduledCallPayload {
  conversation_id: number;
  title: string;
  description?: string;
  call_type?: 'voice' | 'video';
  screen_share?: boolean;
  scheduled_at: string;            // ISO 8601
  duration_minutes?: number;
  recurrence?: RecurrenceType;
  recurrence_end?: string;
  participant_ids?: string[];
}

export interface UpdateScheduledCallPayload {
  title?: string;
  description?: string;
  call_type?: 'voice' | 'video';
  screen_share?: boolean;
  scheduled_at?: string;
  duration_minutes?: number;
  recurrence?: RecurrenceType;
  recurrence_end?: string | null;
}

export interface StartCallResponse {
  call_id: number;
  conversation_id: number;
  call_type: 'voice' | 'video';
  screen_share: boolean;
  status: 'ringing';
}

/** Socket.IO payload for 'scheduled-call' event */
export interface ScheduledCallSocketEvent {
  type: 'created' | 'updated' | 'cancelled' | 'rsvp' | 'reminder';
  id?: number;
  // 'created'/'updated' include full or partial call object
  // 'cancelled' includes { id }
  // 'rsvp' includes { scheduledCallId, userId, userName, rsvp }
  // 'reminder' includes { id, title, scheduled_at }
  [key: string]: any;
}
```

---

## 6. API Service

Create `src/api/scheduling.ts`. Follow the same pattern as `api/chat.ts` — use the singleton `client` from `api/client.ts`.

```typescript
import client from './client';
import {
  ScheduledCall,
  CreateScheduledCallPayload,
  UpdateScheduledCallPayload,
  StartCallResponse,
  ScheduledCallParticipant,
} from '../types/scheduling';

const BASE = '/staff-chat/scheduled-calls';

const schedulingApi = {

  /** List scheduled calls. Default status = 'upcoming'. */
  list: async (params?: {
    status?: string;           // 'upcoming' | 'all' | 'scheduled' | 'active' | 'completed' | 'cancelled'
    conversation_id?: number;
    limit?: number;
    offset?: number;
  }): Promise<ScheduledCall[]> => {
    const query = new URLSearchParams();
    if (params?.status)          query.set('status', params.status);
    if (params?.conversation_id) query.set('conversation_id', String(params.conversation_id));
    if (params?.limit)           query.set('limit', String(params.limit));
    if (params?.offset)          query.set('offset', String(params.offset));
    const qs = query.toString();
    const res = await client.get(`${BASE}${qs ? `?${qs}` : ''}`);
    return res.data.data;
  },

  /** Get full detail + participant list for one call. */
  getDetail: async (id: number): Promise<ScheduledCall> => {
    const res = await client.get(`${BASE}/${id}`);
    return res.data.data;
  },

  /** Create a new scheduled call. */
  create: async (payload: CreateScheduledCallPayload): Promise<ScheduledCall> => {
    const res = await client.post(BASE, payload);
    return res.data.data;
  },

  /** Update a scheduled call (creator only, status must be 'scheduled'). */
  update: async (id: number, payload: UpdateScheduledCallPayload): Promise<ScheduledCall> => {
    const res = await client.put(`${BASE}/${id}`, payload);
    return res.data.data;
  },

  /** Cancel (soft-delete) a scheduled call (creator only). */
  cancel: async (id: number): Promise<void> => {
    await client.delete(`${BASE}/${id}`);
  },

  /** RSVP — accept or decline. */
  rsvp: async (id: number, rsvp: 'accepted' | 'declined'): Promise<void> => {
    await client.post(`${BASE}/${id}/rsvp`, { rsvp });
  },

  /** Start the scheduled call → creates a WebRTC call session. */
  start: async (id: number): Promise<StartCallResponse> => {
    const res = await client.post(`${BASE}/${id}/start`);
    return res.data.data;
  },

  /** Add participants (creator only, status must be 'scheduled'). */
  addParticipants: async (
    id: number,
    userIds: string[],
  ): Promise<{ added: number; participants: ScheduledCallParticipant[] }> => {
    const res = await client.post(`${BASE}/${id}/participants`, { user_ids: userIds });
    return res.data.data;
  },

  /** Remove a participant (creator only, cannot remove self). */
  removeParticipant: async (id: number, userId: string): Promise<void> => {
    await client.delete(`${BASE}/${id}/participants/${userId}`);
  },
};

export default schedulingApi;
```

---

## 7. Socket Events — Extend `useChatSocket`

The backend emits a `'scheduled-call'` event on the `/chat` namespace. The existing `useChatSocket` hook already connects to this namespace.

### What to add in `useChatSocket.ts`

```typescript
// Add a callback prop:
onScheduledCallEvent?: (data: ScheduledCallSocketEvent) => void;

// Inside the useEffect that sets up socket listeners, add:
socket.on('scheduled-call', (data: ScheduledCallSocketEvent) => {
  onScheduledCallEvent?.(data);
});

// In the cleanup:
socket.off('scheduled-call');
```

### Event types the mobile app should handle

| `type` | What to do |
|--------|-----------|
| `created` | Re-fetch call list if the ScheduledCallsScreen is open. Show toast: "📅 New call scheduled". |
| `updated` | Re-fetch call list / detail. |
| `cancelled` | Remove from local list. Show toast: "❌ Call cancelled". |
| `rsvp` | Update participant RSVP in detail view if open. |
| `reminder` | Show in-app alert / local notification: "⏰ {title} starts in 15 minutes". |

### Where to consume it

In `ChatScreen.tsx` (or a parent that wraps all chat screens):

```typescript
useChatSocket({
  // ...existing props...
  onScheduledCallEvent: (data) => {
    if (data.type === 'reminder') {
      // Show prominent alert
      Alert.alert('Upcoming Call', `"${data.title}" starts in 15 minutes`, [
        { text: 'Dismiss' },
        { text: 'View', onPress: () => navigation.navigate('ScheduledCallDetail', { callId: data.id }) },
      ]);
    }
    if (data.type === 'created') {
      Toast.show({ type: 'info', text1: '📅 New call scheduled' });
    }
    // Trigger re-fetch in ScheduledCallsScreen via a ref or event
  },
});
```

---

## 8. Push Notifications — Extend `chatNotificationHandler`

The backend sends FCM pushes with these `data` payloads:

| `data.type` | When | `data.conversation_id` |
|-------------|------|----------------------|
| `'scheduled-call'` | Call created, cancelled, or started | Yes |
| `'scheduled-call-reminder'` | 15 min before call | Yes |

### Changes to `chatNotificationHandler.ts`

In the foreground handler:

```typescript
if (data.type === 'scheduled-call' || data.type === 'scheduled-call-reminder') {
  // Suppress if user is already viewing the ScheduledCallsScreen for this conversation
  // Otherwise, show in-app toast
  Toast.show({
    type: data.type === 'scheduled-call-reminder' ? 'warning' : 'info',
    text1: notification.title,
    text2: notification.body,
    onPress: () => {
      // Navigate to scheduled calls for this conversation
      navigationRef.navigate('ScheduledCalls', {
        conversationId: Number(data.conversation_id),
      });
    },
  });
  return; // handled — don't fall through to generic handler
}
```

### Changes to `notificationNavigation.ts`

```typescript
case 'scheduled-call':
case 'scheduled-call-reminder':
  navigation.navigate('GroupsTab', {
    screen: 'ScheduledCalls',
    params: { conversationId: Number(data.conversation_id) },
  });
  break;
```

---

## 9. Context Updates

### Option A — Lightweight (Recommended)

Don't add scheduling state to `ChatContext`. Each screen fetches its own data via `schedulingApi` and re-fetches on socket events. This matches the web frontend's approach (no Zustand store for scheduling).

### Option B — Badge Count (Optional Enhancement)

If you want a badge on the calendar icon showing upcoming call count:

```typescript
// In ChatContext.tsx, add:
const [scheduledCallCount, setScheduledCallCount] = useState(0);

// Fetch on mount + every 5 min:
const refreshScheduledCallCount = async () => {
  try {
    const calls = await schedulingApi.list({ status: 'upcoming', limit: 1 });
    // The API doesn't return a total count header, so either:
    // - Fetch all upcoming and use .length
    // - Or add a lightweight /count endpoint later
    setScheduledCallCount(calls.length);
  } catch {}
};
```

---

## 10. Navigation Changes

### `src/navigation/types.ts` — Add param types

```typescript
// Add to GroupsStackParamList:
ScheduledCalls: { conversationId?: number } | undefined;
ScheduleCallForm: {
  conversationId: number;
  editCall?: ScheduledCall;      // undefined = create mode
};
ScheduledCallDetail: { callId: number };
```

### `src/navigation/FeatureStacks.tsx` — Add screens to GroupsStack

```typescript
<GroupsStack.Screen
  name="ScheduledCalls"
  component={ScheduledCallsScreen}
  options={{ title: 'Scheduled Calls' }}
/>
<GroupsStack.Screen
  name="ScheduleCallForm"
  component={ScheduleCallFormScreen}
  options={({ route }) => ({
    title: route.params?.editCall ? 'Edit Scheduled Call' : 'Schedule a Call',
  })}
/>
<GroupsStack.Screen
  name="ScheduledCallDetail"
  component={ScheduledCallDetailScreen}
  options={{ title: 'Call Details' }}
/>
```

### Navigation flow

```
ChatScreen
  → Header calendar icon → ScheduledCalls (for this conversation)
     → FAB "+" → ScheduleCallForm (create, pre-filled with conversationId)
     → Tap card → ScheduledCallDetail
        → "Edit" → ScheduleCallForm (edit mode)
        → "Start" → triggers WebRTC flow (navigates back to ChatScreen)

ChatListScreen (optional)
  → Header calendar icon → ScheduledCalls (all conversations)
```

---

## 11. Screens

### 11.1 `ScheduledCallsScreen` (~350 LOC)

**Entry points:** Calendar icon in ChatScreen header, push notification tap, ChatListScreen header.

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "Scheduled Calls"      [+] │
├─────────────────────────────┤
│  [Upcoming]  [All Calls]    │  ← Tab bar (filter toggle)
├─────────────────────────────┤
│  ┌─ ScheduledCallCard ────┐ │
│  │ 📹 Sprint Planning     │ │
│  │ Tomorrow, 10:00 · 30m  │ │
│  │ Dev Team · 4 people    │ │
│  │ [Accept] [Decline]     │ │  ← Only if my_rsvp === 'pending'
│  └────────────────────────┘ │
│  ┌─ ScheduledCallCard ────┐ │
│  │ 📞 Quick Sync          │ │
│  │ Today, 14:30 · 15m     │ │
│  │ John (DM) · Accepted ✓ │ │
│  │ [Start]                │ │  ← Only if creator + within 5 min
│  └────────────────────────┘ │
│         ...                  │
├─────────────────────────────┤
│  EmptyView if no calls      │
│  "No scheduled calls"       │
└─────────────────────────────┘
```

**Data fetching:**
```typescript
const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

const { data: calls, loading, refresh } = useCachedFetch<ScheduledCall[]>(
  `scheduling-${filter}-${conversationId || 'all'}`,
  () => schedulingApi.list({
    status: filter === 'upcoming' ? 'upcoming' : 'all',
    conversation_id: conversationId,
  }),
  { enabled: true, ttl: 60_000 }   // 1-min cache
);
```

**RSVP actions (inline on each card):**
```typescript
const handleRsvp = async (callId: number, rsvp: 'accepted' | 'declined') => {
  try {
    await schedulingApi.rsvp(callId, rsvp);
    refresh();  // re-fetch list
    Toast.show({ type: 'success', text1: rsvp === 'accepted' ? 'Accepted' : 'Declined' });
  } catch (err: any) {
    // Server returns 400 if call status is not 'scheduled' (safety guard)
    const msg = err?.response?.data?.error || 'Failed to update RSVP';
    Toast.show({ type: 'error', text1: msg });
  }
};
```

**Start call action:**
```typescript
const handleStartCall = async (call: ScheduledCall) => {
  try {
    const result = await schedulingApi.start(call.id);
    // Navigate back to ChatScreen and trigger WebRTC with the returned call_id
    navigation.navigate('ChatScreen', {
      conversationId: call.conversation_id,
      incomingCall: {
        call_id: result.call_id,
        call_type: result.call_type,
        screen_share: result.screen_share,
      },
    });
  } catch (err: any) {
    Alert.alert('Cannot Start', err?.response?.data?.error || 'Failed to start call');
  }
};
```

**Socket-driven refresh:**
```typescript
// Receive via useChatSocket's onScheduledCallEvent callback
// or subscribe directly:
useEffect(() => {
  const handler = () => refresh();
  // Listen for a custom event emitter or use the socket directly
  chatSocket.on('scheduled-call', handler);
  return () => { chatSocket.off('scheduled-call', handler); };
}, []);
```

---

### 11.2 `ScheduleCallFormScreen` (~400 LOC)

**Entry points:** FAB on ScheduledCallsScreen, "Edit" on ScheduledCallDetailScreen.

**Params:** `{ conversationId: number, editCall?: ScheduledCall }`

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "Schedule a Call"  [Save]  │
├─────────────────────────────┤
│  Title          [__________]│
│  Description    [__________]│
│                              │
│  Call Type   [Voice] [Video]│  ← Toggle buttons
│  Screen Share       [toggle]│  ← Switch
│                              │
│  Date        [Mar 7, 2026 ▾]│  ← Date picker
│  Time        [10:00      ▾]│  ← Time picker
│  Duration    [30 min     ▾]│  ← Picker: 15/30/45/60/90/120
│                              │
│  Recurrence  [None       ▾]│  ← Picker: none/daily/weekly/biweekly/monthly
│  Ends        [Never      ▾]│  ← Date picker (if recurrence != 'none')
│                              │
│  Participants                │
│  ┌──────────────────────┐   │
│  │ ○ All members (5)    │   │  ← Default: include everyone
│  │ ● Select specific    │   │
│  │   ☑ Admin            │   │
│  │   ☑ John             │   │
│  │   ☐ Sarah            │   │
│  └──────────────────────┘   │
│                              │
│  [Schedule Call]             │  ← AppButton primary
└─────────────────────────────┘
```

**Date/time pickers:** Use `@react-native-community/datetimepicker` (likely already installed for tasks). Alternatively, use a bottom-sheet date picker.

**Submit:**
```typescript
const handleSubmit = async () => {
  setSaving(true);
  try {
    const payload: CreateScheduledCallPayload = {
      conversation_id: conversationId,
      title,
      description: description || undefined,
      call_type: callType,
      screen_share: screenShare,
      scheduled_at: new Date(`${date}T${time}`).toISOString(),
      duration_minutes: duration,
      recurrence,
      recurrence_end: recurrence !== 'none' && recurrenceEnd ? recurrenceEnd : undefined,
      participant_ids: useAllMembers ? undefined : selectedIds,
    };

    if (editCall) {
      await schedulingApi.update(editCall.id, payload);
      Toast.show({ type: 'success', text1: 'Call updated' });
    } else {
      await schedulingApi.create(payload);
      Toast.show({ type: 'success', text1: 'Call scheduled' });
    }
    navigation.goBack();
  } catch (err: any) {
    const msg = err?.response?.data?.error || 'Failed to save';
    Alert.alert('Error', msg);
  } finally {
    setSaving(false);
  }
};
```

**Participant list:** Fetch conversation members from the existing `api/chat.ts`:
```typescript
// Existing API (already wired):
const members = await chatApi.getConversationMembers(conversationId);
```

---

### 11.3 `ScheduledCallDetailScreen` (~300 LOC)

**Entry point:** Tap a card on ScheduledCallsScreen.

**Params:** `{ callId: number }`

**Layout:**
```
┌─────────────────────────────┐
│  GradientHeader             │
│  "Sprint Planning"    [···] │  ← Menu: Edit, Cancel, Add People
├─────────────────────────────┤
│  Status badge: Scheduled    │
│                              │
│  📹 Video call · Screen share│
│  🗓 Mar 7, 2026 at 10:00    │
│  ⏱ 30 minutes               │
│  🔄 Repeats weekly           │
│  📝 "Review sprint goals"    │
│                              │
│  Created by Admin            │
│  in Dev Team conversation    │
├─────────────────────────────┤
│  Participants (4)            │
│  ┌──────────────────────┐   │
│  │ 🟢 Admin    Accepted │   │
│  │ 🟡 John     Pending  │   │
│  │ 🟢 Sarah    Accepted │   │
│  │ 🔴 Mike     Declined │   │
│  └──────────────────────┘   │
├─────────────────────────────┤
│  [Accept]  [Decline]        │  ← If my RSVP is pending
│  [Start Call]               │  ← If creator + within 5 min
└─────────────────────────────┘
```

**Data fetching:**
```typescript
const [call, setCall] = useState<ScheduledCall | null>(null);
const [loading, setLoading] = useState(true);

const fetchDetail = async () => {
  try {
    const data = await schedulingApi.getDetail(callId);
    setCall(data);
  } catch (err) {
    Toast.show({ type: 'error', text1: 'Failed to load call details' });
    navigation.goBack();
  } finally {
    setLoading(false);
  }
};
```

**Creator actions (menu):**
```typescript
const isCreator = call.created_by === user?.id;
const isScheduled = call.status === 'scheduled';

// Edit — only if creator + scheduled
if (isCreator && isScheduled) {
  navigation.navigate('ScheduleCallForm', { conversationId: call.conversation_id, editCall: call });
}

// Cancel — confirmation dialog
Alert.alert('Cancel Call', `Cancel "${call.title}"?`, [
  { text: 'No' },
  { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
    await schedulingApi.cancel(call.id);
    navigation.goBack();
  }},
]);

// Add participants — show a member picker bottom sheet
// then call schedulingApi.addParticipants(call.id, selectedIds)
```

---

## 12. Reusable Components

### `ScheduledCallCard` (~100 LOC)

Renders a single scheduled call in a list. Used in `ScheduledCallsScreen`.

```typescript
interface ScheduledCallCardProps {
  call: ScheduledCall;
  currentUserId: string;
  onPress: () => void;
  onRsvp: (rsvp: 'accepted' | 'declined') => void;
  onStart: () => void;
}
```

**Visual elements:**
- Call type icon: `📹` (video) or `📞` (voice) — use the theme colors
- Title (bold)
- Formatted date/time: `"Tomorrow, 10:00"` or `"Mar 7, 10:00"`
- Duration: `"30m"` or `"1h 30m"`
- Conversation name + participant count
- RSVP badge (color-coded): green = accepted, gray = pending, red = declined
- Recurrence indicator: `🔄 Weekly`
- **Inline action buttons** (conditional):
  - `[Accept] [Decline]` — only if `my_rsvp === 'pending'` and `status === 'scheduled'`
  - `[Start]` — only if `created_by === currentUserId` and within 5 minutes of `scheduled_at`

**Formatting helpers:**
```typescript
const formatCallDate = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return `Today, ${formatTime(date)}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${formatTime(date)}`;
  return `${date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}, ${formatTime(date)}`;
};

const formatDuration = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const canStart = (call: ScheduledCall, userId: string): boolean => {
  if (call.created_by !== userId || call.status !== 'scheduled') return false;
  const diff = new Date(call.scheduled_at).getTime() - Date.now();
  return diff <= 5 * 60 * 1000 && diff >= -30 * 60 * 1000; // 5 min before to 30 min after
};
```

---

## 13. Offline & Caching

### Read caching (via `useCachedFetch`)
- Cache the call list in AsyncStorage with a 1-minute TTL
- Key pattern: `scheduling-upcoming-{conversationId}` or `scheduling-all-{conversationId}`
- On socket event → call `refresh()` to bust cache and re-fetch

### Write operations (no offline queue needed initially)
- Create, edit, cancel, RSVP, start — all require server round-trip (no optimistic writes)
- Show loading state on buttons during API call
- Show error toast on failure
- **Do NOT queue scheduling writes offline** — scheduling is time-sensitive, stale creates would be confusing

### Recurrence behaviour (server-side, no mobile action needed)
- When a recurring call completes, the server automatically spawns the next occurrence
- All participant RSVPs on the new occurrence are reset to `'pending'` (creator → `'accepted'`)
- The mobile list will pick this up via the `scheduled-call` socket event (`type: 'created'`), so the existing `refresh()` handler covers it

### Cache cleanup
- When a call is cancelled or completed, it will naturally disappear from the `upcoming` query
- No manual cache eviction needed

---

## 14. API Reference (Quick)

All endpoints require `Authorization: Bearer <jwt>`.  
Base URL: `https://api.softaware.net.za/staff-chat/scheduled-calls`

| # | Method | Path | Body | Response |
|---|--------|------|------|----------|
| 1 | `POST` | `/` | `CreateScheduledCallPayload` | `{ success, data: ScheduledCall }` |
| 2 | `GET` | `/?status=upcoming` | — | `{ success, data: ScheduledCall[] }` |
| 3 | `GET` | `/:id` | — | `{ success, data: ScheduledCall }` (includes `participants[]`) |
| 4 | `PUT` | `/:id` | `UpdateScheduledCallPayload` | `{ success, data: ScheduledCall }` |
| 5 | `DELETE` | `/:id` | — | `{ success: true }` |
| 6 | `POST` | `/:id/rsvp` | `{ rsvp: 'accepted'\|'declined' }` | `{ success: true }` |
| 7 | `POST` | `/:id/start` | — | `{ success, data: StartCallResponse }` |
| 8 | `POST` | `/:id/participants` | `{ user_ids: string[] }` | `{ success, data: { added, participants[] } }` |
| 9 | `DELETE` | `/:id/participants/:userId` | — | `{ success: true }` |

**Query params for GET list:**

| Param | Type | Default | Options |
|-------|------|---------|---------|
| `status` | string | `'upcoming'` | `upcoming`, `all`, `scheduled`, `active`, `completed`, `cancelled` |
| `conversation_id` | number | — | Filter by conversation |
| `limit` | number | `50` | Max 100 |
| `offset` | number | `0` | Pagination |

**RSVP guard:** The `POST /:id/rsvp` endpoint returns `400` if the call status is not `'scheduled'` (e.g. already active, completed, or cancelled). The mobile UI already hides RSVP buttons when `status !== 'scheduled'`, so this is a server-side safety net — but the error handler should still surface the message.

**Error shape:** `{ error: string, details?: ZodError[] }`

---

## 15. Socket Event Reference

**Event name:** `'scheduled-call'`  
**Namespace:** `/chat` (already connected)  
**Room:** `conv:<conversation_id>` (already joined when viewing a conversation)

| `type` field | Payload | When |
|-------------|---------|------|
| `created` | Full `ScheduledCall` object | New call scheduled |
| `updated` | Updated `ScheduledCall` object | Call edited or participants changed |
| `cancelled` | `{ id: number }` | Call cancelled |
| `rsvp` | `{ scheduledCallId, userId, userName, rsvp }` | Someone accepts/declines |
| `reminder` | `{ id, title, scheduled_at }` | 15 min before start |

**Push notification `data` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'scheduled-call'` or `'scheduled-call-reminder'` | Notification category |
| `conversation_id` | string (number as string) | Target conversation |

---

## 16. Implementation Checklist

### Phase 1 — Core (MVP)

- [ ] Create `src/types/scheduling.ts` — interfaces and types
- [ ] Create `src/api/scheduling.ts` — 9 API methods
- [ ] Add navigation types to `src/navigation/types.ts`
- [ ] Add 3 screens to `src/navigation/FeatureStacks.tsx` (GroupsStack)
- [ ] Create `src/components/ui/ScheduledCallCard.tsx` — list card component
- [ ] Create `src/screens/groups/ScheduledCallsScreen.tsx` — list with tabs + RSVP
- [ ] Create `src/screens/groups/ScheduleCallFormScreen.tsx` — create/edit form
- [ ] Create `src/screens/groups/ScheduledCallDetailScreen.tsx` — detail + actions
- [ ] Add calendar icon to `ChatScreen.tsx` header → navigates to ScheduledCallsScreen
- [ ] Wire "Start Call" action → pass `call_id` to existing WebRTC flow

### Phase 2 — Real-Time

- [ ] Add `'scheduled-call'` listener to `useChatSocket.ts`
- [ ] Handle socket events in ScheduledCallsScreen (auto-refresh)
- [ ] Handle `reminder` event — show `Alert.alert()` with "View" action
- [ ] Extend `chatNotificationHandler.ts` for scheduling push types
- [ ] Extend `notificationNavigation.ts` for deep-linking to ScheduledCallsScreen

### Phase 3 — Polish

- [ ] Add/remove participants in ScheduledCallDetailScreen (member picker bottom sheet)
- [ ] Cache call list via `useCachedFetch` with 1-min TTL
- [ ] Replace `CallHistoryScreen` stub with real call history (ties into scheduling)
- [ ] Add optional badge count on calendar icon (upcoming call count)
- [ ] Add calendar icon to `ChatListScreen` header for all-conversations view
- [ ] Empty states, loading skeletons, error handling edge cases

### Testing Checkpoints

- [ ] Create a scheduled call from mobile → verify it appears on web
- [ ] RSVP from mobile → verify socket event updates web panel
- [ ] Start a scheduled call → verify WebRTC ringing reaches other participants
- [ ] Cancel from web → verify mobile list updates in real-time
- [ ] Receive reminder push when app is backgrounded
- [ ] Tap reminder push → deep-links to correct screen
- [ ] Edit a call → verify update reflects on both platforms
- [ ] Add/remove participant → verify list updates

---

## Appendix: Mapping Web → Mobile

| Web Component | Mobile Equivalent | Notes |
|-------------|-----------------|-------|
| `ScheduleCallDialog` (modal) | `ScheduleCallFormScreen` (full screen) | Modals work poorly on mobile for complex forms — use a full screen |
| `ScheduledCallsPanel` (slide-over) | `ScheduledCallsScreen` (full screen) | Mobile slide-overs are harder to dismiss — use a stacked screen |
| `ChatHeader` calendar icon | `ChatScreen` header right action | Same UX — icon in the header bar |
| `StaffChatModel` static methods | `schedulingApi` module | Same pattern — just uses different HTTP client |
| Socket listener in `ChatPage` | Socket listener in `useChatSocket` | Centralized in the hook instead of a page |
| `react-hot-toast` | `react-native-toast-message` | Already used throughout the mobile app |
| Tailwind CSS badges | `Badge` component (`ui/Badge.tsx`) | Map RSVP colors: accepted→green, pending→gray, declined→red |
