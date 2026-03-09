# Scheduling — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/staffChat.ts` (lines 2084–2854, ~770 LOC of scheduling code)
**Purpose**: 9 scheduled call REST endpoints + maintenance loop within the existing staff-chat router  
**Mount**: `/staff-chat` via `staffChatRouter`

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Section header | 2084–2086 | `// SCHEDULED CALLS` delimiter comment |
| `POST /scheduled-calls` | 2088–2230 | Create scheduled call with transaction, batch participants, socket emit, push |
| `GET /scheduled-calls` | 2232–2300 | List calls with `upcoming`/`all`/specific status filters + `conversation_id` filter |
| `GET /scheduled-calls/:id` | 2302–2345 | Get call detail with full participant list (corrected field aliases) |
| `PUT /scheduled-calls/:id` | 2347–2400 | Update call (creator only), dynamic SET, reset reminder |
| `DELETE /scheduled-calls/:id` | 2402–2445 | Cancel call (soft delete → `status = 'cancelled'`), push notify |
| `POST /scheduled-calls/:id/rsvp` | 2447–2490 | Accept/decline invitation, socket emit |
| `POST /scheduled-calls/:id/start` | 2492–2600 | Start call → create `call_sessions`, `emitCallRinging()`, 45s timeout |
| `POST /scheduled-calls/:id/participants` | 2602–2665 | Add participants (creator only, batch INSERT IGNORE, push notify) |
| `DELETE /scheduled-calls/:id/participants/:userId` | 2667–2700 | Remove participant (creator only, cannot remove self) |
| Maintenance header | 2702–2704 | `// SCHEDULED CALL MAINTENANCE` delimiter |
| `startScheduledCallMaintenance()` | 2706–2848 | Every-2-min interval: stale-call cleanup, reminders, recurrence spawning |
| Module init | 2850 | `startScheduledCallMaintenance()` called at module load |

---

### `/var/opt/backend/src/services/chatSocket.ts` (lines 509–515, 7 LOC added)
**Purpose**: `emitScheduledCall()` export function for broadcasting scheduled call events  
**Used by**: All 7 scheduling route handlers

```typescript
export function emitScheduledCall(conversationId: number, eventType: string, data: any): void {
  chatNs?.to(`conv:${conversationId}`).emit('scheduled-call', {
    type: eventType,
    conversationId,
    ...data,
  });
}
```

**Room pattern**: Emits to `conv:<conversationId>` — all members currently connected to that conversation's Socket.IO room.

---

### `/var/opt/backend/src/db/migrations/018_scheduled_calls.ts` (82 LOC)
**Purpose**: Creates `scheduled_calls` and `scheduled_call_participants` tables  
**Runner**: `src/scripts/run_migration_018.ts` — `npx tsx src/scripts/run_migration_018.ts`

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Module doc | 1–13 | Table descriptions, column docs |
| Import | 15 | `db` from `../mysql.js` |
| `up()` | 17–76 | CREATE TABLE for both tables with indexes and FK constraints |
| `down()` | 78–82 | DROP TABLE for both tables |

**Tables created**:
- `scheduled_calls` — 15 columns, 5 indexes, 3 FK constraints
- `scheduled_call_participants` — 5 columns, 1 unique key, 1 index, 2 FK constraints

---

### `/var/opt/backend/src/scripts/run_migration_018.ts`
**Purpose**: Standalone runner for migration 018  
**Usage**: `cd /var/opt/backend && npx tsx src/scripts/run_migration_018.ts`

---

## Frontend Files

### `/var/opt/frontend/src/models/StaffChatModel.ts` (554 LOC total, ~115 LOC scheduling)
**Purpose**: TypeScript interfaces and static API methods for scheduled calls (added to existing model)

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| `ScheduledCallParticipant` interface | 179–185 | User ID, name, email, avatar, RSVP status |
| `ScheduledCall` interface | 187–208 | Full scheduled call shape with participants, my_rsvp |
| `createScheduledCall()` | 476–490 | POST to `/staff-chat/scheduled-calls` |
| `getScheduledCalls()` | 492–505 | GET with query params (sends `?status=upcoming` or `?status=all`) |
| `getScheduledCallDetail()` | 507–510 | GET by ID |
| `updateScheduledCall()` | 512–523 | PUT with optional fields |
| `cancelScheduledCall()` | 525–527 | DELETE |
| `rsvpScheduledCall()` | 529–531 | POST RSVP (accepted/declined) |
| `startScheduledCall()` | 533–542 | POST start → returns call_id for WebRTC |
| `addScheduledCallParticipants()` | 544–547 | POST to add participants (user_ids array) |
| `removeScheduledCallParticipant()` | 549–551 | DELETE to remove a participant |

---

### `/var/opt/frontend/src/pages/general/chat/ScheduleCallDialog.tsx` (355 LOC)
**Purpose**: Modal dialog for creating or editing a scheduled call

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–15 | React, Heroicons (6 icons), StaffChatModel, toast |
| Props interface | 17–25 | `open`, `onClose`, `conversationId`, `conversationName`, `existing`, `onCreated` |
| State declarations | 27–38 | title, description, callType, screenShare, date, time, duration, recurrence, recurrenceEnd, saving |
| Reset effect | 40–73 | Resets form on open; populates from `existing` prop for edit mode; defaults to tomorrow for new |
| `handleSubmit()` | 76–128 | Validates inputs, calls create or update API, shows toast |
| Modal JSX | 130–355 | Overlay + form with: title input, description textarea, date/time pickers, duration select, call type toggle buttons (voice/video), screen share toggle switch, recurrence select, conditional recurrence end date, cancel/submit footer |

**UI pattern**: Fixed overlay with `bg-black/40` backdrop, `max-w-lg` white card with `stopPropagation()`.

---

### `/var/opt/frontend/src/pages/general/chat/ScheduledCallsPanel.tsx` (388 LOC)
**Purpose**: Slide-over panel listing scheduled calls with RSVP actions and management

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–25 | React, Heroicons (12 icons), StaffChatModel, chatHelpers, toast |
| Props interface | 27–35 | `open`, `onClose`, `currentUserId`, `conversationId`, `onStartCall`, `onEdit` |
| State declarations | 37–40 | calls, loading, filter (upcoming/all) |
| `load()` callback | 42–55 | Fetches calls via `StaffChatModel.getScheduledCalls()` |
| Helper functions | 57–110 | `formatDateTime()`, `formatDuration()`, `getTimeUntil()`, `isStartable()` |
| `handleRsvp()` | 112–125 | Posts RSVP, optimistically updates local state |
| `handleCancel()` | 127–135 | Cancels call, removes from local state |
| `recurrenceLabel` map | 137–143 | Display labels for recurrence values |
| Panel JSX | 145–384 | Slide-over panel with: header, upcoming/all filter tabs, loading spinner, empty state, call cards with title/description, date/time/duration/recurrence, time-until badge, status badge, participant avatars (max 5 + overflow), RSVP buttons (accept/decline), RSVP status display, start/edit/cancel buttons for creator |

**UI pattern**: Fixed right-aligned panel (`w-[420px]`) with `bg-black/20` backdrop, same as `CallHistoryPanel`.

---

### `/var/opt/frontend/src/pages/general/chat/ChatHeader.tsx` (361 LOC)
**Purpose**: Conversation header bar — modified to add scheduling button and menu item

| Added | Lines (approx) | Description |
|-------|----------------|-------------|
| `CalendarDaysIcon` import | 15 | Added to icon imports |
| `onScheduleCall` prop | 37 | Optional callback |
| `onShowScheduledCalls` prop | 38 | Optional callback |
| Calendar button | 173–181 | `CalendarDaysIcon` button between video call and search |
| "Scheduled calls" menu item | 208–216 | Dropdown menu item after "Conversation info" |

---

### `/var/opt/frontend/src/pages/general/ChatPage.tsx` (1584 LOC)
**Purpose**: Main chat orchestrator — modified to manage scheduling state and wire components

| Added | Lines (approx) | Description |
|-------|----------------|-------------|
| `ScheduledCall` type import | 27 | Added to model imports |
| `ScheduleCallDialog` import | 63 | Added to chat component imports |
| `ScheduledCallsPanel` import | 64 | Added to chat component imports |
| `showScheduleCall` state | 122 | Boolean for dialog visibility |
| `showScheduledCalls` state | 123 | Boolean for panel visibility |
| `editingScheduledCall` state | 124 | `ScheduledCall | null` for edit mode |
| `scheduled-call` socket listener | 459–468 | Listens for scheduled call events (created/cancelled/reminder), shows toasts with titles |
| `socket.off('scheduled-call')` | 480 | Cleanup in useEffect return |
| `handleScheduleCall` callback | 770–773 | Opens dialog for current conversation |
| `handleStartScheduledCall` callback | 775–784 | Calls API to start → triggers WebRTC |
| `onScheduleCall` prop | 1362 | Passed to ChatHeader |
| `onShowScheduledCalls` prop | 1363 | Passed to ChatHeader |
| `ScheduleCallDialog` JSX | 1500–1511 | Dialog rendered with props |
| `ScheduledCallsPanel` JSX | 1513–1525 | Panel rendered with props |

---

### `/var/opt/frontend/src/pages/general/chat/index.ts` (18 LOC)
**Purpose**: Barrel exports for chat sub-components — modified to add new exports

| Added | Description |
|-------|-------------|
| `export { default as ScheduleCallDialog } from './ScheduleCallDialog'` | New dialog export |
| `export { default as ScheduledCallsPanel } from './ScheduledCallsPanel'` | New panel export |

---

## File Relationship Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                                                                 │
│  ChatPage.tsx ─────────────────── state management + wiring     │
│    ├── ChatHeader.tsx ──────────── 📅 button + dropdown item    │
│    ├── ScheduleCallDialog.tsx ──── create/edit modal             │
│    └── ScheduledCallsPanel.tsx ─── list + RSVP + start/cancel   │
│                                                                 │
│  StaffChatModel.ts ─── 2 interfaces + 9 static API methods     │
│    ├── ScheduledCall interface                                  │
│    └── ScheduledCallParticipant interface                       │
│                                                                 │
│  chat/index.ts ─── barrel exports                               │
└─────────────┬───────────────────────────────────────────────────┘
              │ HTTP (axios via api service) + Socket.IO
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                        │
│                                                                 │
│  staffChat.ts (lines 2084–2854) ── 9 scheduled call endpoints   │
│    ├── Zod validation (inline schemas)                          │
│    ├── db.transaction() for atomic create                        │
│    ├── conversation_members membership check                    │
│    ├── scheduled_call_participants RSVP + participant management  │
│    ├── call_sessions creation on start                          │
│    ├── emitScheduledCall() → Socket.IO notifications            │
│    ├── sendPushToUser() → Firebase push                         │
│    └── startScheduledCallMaintenance() → cleanup + reminders     │
│                                                                 │
│  chatSocket.ts ── emitScheduledCall() emitter function          │
│                                                                 │
│  migrations/018_scheduled_calls.ts ── DDL for 2 tables          │
│                                                                 │
│  ┌────────────────┐  ┌─────────────────────────────┐           │
│  │ scheduled_calls │──│ scheduled_call_participants  │           │
│  │  (main table)   │  │ (RSVP per user)             │           │
│  └───────┬────────┘  └─────────────────────────────┘           │
│          │                                                      │
│          ├── FK → conversations (ON DELETE CASCADE)             │
│          ├── FK → users (ON DELETE CASCADE)                     │
│          └── FK → call_sessions (ON DELETE SET NULL)            │
└─────────────────────────────────────────────────────────────────┘
```

## Total Lines of Code (Scheduling-Specific)

| File | LOC (scheduling) | LOC (total) |
|------|-------------------|-------------|
| `backend/src/routes/staffChat.ts` (scheduling section) | ~770 | 3038 |
| `backend/src/services/chatSocket.ts` (emitter) | 7 | 558 |
| `backend/src/db/migrations/018_scheduled_calls.ts` | 82 | 82 |
| `frontend/src/pages/general/chat/ScheduleCallDialog.tsx` | 355 | 355 |
| `frontend/src/pages/general/chat/ScheduledCallsPanel.tsx` | 388 | 388 |
| `frontend/src/models/StaffChatModel.ts` (scheduling section) | ~115 | 554 |
| `frontend/src/pages/general/ChatPage.tsx` (scheduling additions) | ~50 | 1584 |
| `frontend/src/pages/general/chat/ChatHeader.tsx` (scheduling additions) | ~20 | 361 |
| `frontend/src/pages/general/chat/index.ts` (new exports) | 2 | 18 |
| **Total (scheduling-specific)** | **~1,779** | |
