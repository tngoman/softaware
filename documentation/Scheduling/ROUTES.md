# Scheduling — Route & API Reference

## Route Registration

**Backend mount point**:
- `/staff-chat/scheduled-calls` — All routes require JWT via `requireAuth`

```
src/routes/staffChat.ts → staffChatRouter mounted at /staff-chat
  └── /scheduled-calls/* (lines 2084–2854)
```

All scheduling routes are part of the existing `staffChatRouter` — not a separate router.

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | POST | `/staff-chat/scheduled-calls` | Create a new scheduled call |
| 2 | GET | `/staff-chat/scheduled-calls` | List scheduled calls for current user |
| 3 | GET | `/staff-chat/scheduled-calls/:id` | Get scheduled call detail with participants |
| 4 | PUT | `/staff-chat/scheduled-calls/:id` | Update a scheduled call (creator only) |
| 5 | DELETE | `/staff-chat/scheduled-calls/:id` | Cancel a scheduled call (creator only) |
| 6 | POST | `/staff-chat/scheduled-calls/:id/rsvp` | Accept or decline an invitation |
| 7 | POST | `/staff-chat/scheduled-calls/:id/start` | Start the call — creates real WebRTC session |
| 8 | POST | `/staff-chat/scheduled-calls/:id/participants` | Add participants (creator only) |
| 9 | DELETE | `/staff-chat/scheduled-calls/:id/participants/:userId` | Remove a participant (creator only) |

---

## Detailed Route Documentation

### 1. POST `/staff-chat/scheduled-calls`
**Purpose**: Schedule a new call in a conversation  
**Auth**: JWT required  
**Body**: Validated with inline Zod schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `conversation_id` | `number` | Yes | — | Conversation to schedule the call in |
| `title` | `string` | Yes | — | Call title (1–255 chars) |
| `description` | `string` | No | `null` | Optional notes/agenda (max 1000 chars) |
| `call_type` | `enum` | No | `'video'` | `'voice'` or `'video'` |
| `screen_share` | `boolean` | No | `false` | Enable screen sharing flag |
| `scheduled_at` | `string` | Yes | — | ISO 8601 datetime string |
| `duration_minutes` | `number` | No | `30` | Expected duration (5–480 minutes) |
| `recurrence` | `enum` | No | `'none'` | `'none'`, `'daily'`, `'weekly'`, `'biweekly'`, `'monthly'` |
| `recurrence_end` | `string` | No | `null` | ISO 8601 date when recurrence stops |
| `participant_ids` | `string[]` | No | all members | Specific user IDs to invite (creator always included) |

**Flow**:
1. Zod validate request body
2. Verify user is a conversation member (`conversation_members` table, `removed_at IS NULL`)
3. Resolve participants: if `participant_ids` provided, use those (always add creator); else all conversation members
4. **BEGIN TRANSACTION**:
   - INSERT into `scheduled_calls` with status `'scheduled'`
   - Batch INSERT all participants into `scheduled_call_participants` (creator → `'accepted'`, others → `'pending'`)
   - INSERT system message into `messages` table (type: `'system'`)
   - Fetch full record with creator name/email JOIN
   - Fetch all participants with user name/email/avatar JOINs
5. **COMMIT**
6. `emitScheduledCall(conversation_id, 'created', result)` via Socket.IO
7. Push notify each offline participant via Firebase (fire-and-forget)

**Response** `201`:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "conversation_id": 5,
    "created_by": "user-uuid",
    "title": "Sprint Planning",
    "description": "Review sprint goals",
    "call_type": "video",
    "screen_share": true,
    "scheduled_at": "2026-03-07T10:00:00.000Z",
    "duration_minutes": 30,
    "recurrence": "weekly",
    "recurrence_end": "2026-06-01T23:59:59.000Z",
    "status": "scheduled",
    "call_session_id": null,
    "reminder_sent": 0,
    "created_at": "2026-03-06T08:00:00.000Z",
    "updated_at": "2026-03-06T08:00:00.000Z",
    "creator_name": "Admin",
    "creator_email": "admin@softaware.co.za",
    "participants": [
      {
        "user_id": "user-uuid",
        "name": "Admin",
        "email": "admin@softaware.co.za",
        "avatar_url": null,
        "rsvp": "accepted"
      },
      {
        "user_id": "user-uuid-2",
        "name": "John",
        "email": "john@example.com",
        "avatar_url": "/uploads/john.jpg",
        "rsvp": "pending"
      }
    ]
  }
}
```

**System message posted**:
```
📅 Admin scheduled a video call: "Sprint Planning" for 7 Mar 2026, 10:00 (screen sharing enabled)
```

---

### 2. GET `/staff-chat/scheduled-calls`
**Purpose**: List scheduled calls for the current user  
**Auth**: JWT required  
**Query params**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `string` | `'upcoming'` | Filter: `upcoming` (scheduled+active), `all`, `scheduled`, `active`, `completed`, `cancelled` |
| `conversation_id` | `number` | — | Optional — filter by conversation |
| `limit` | `number` | `50` | Max results (capped at 100) |
| `offset` | `number` | `0` | Pagination offset |

**SQL** (dynamic `WHERE` based on status):
```sql
-- When status = 'upcoming' (default)
WHERE sc.status IN ('scheduled', 'active')

-- When status = 'all'
WHERE 1=1

-- When status = specific value
WHERE sc.status = ?

-- Optional conversation filter
AND sc.conversation_id = ?
```

**DM enrichment**: For `conversation_type = 'direct'`, an additional query fetches the other user's name, email, and avatar.

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "conversation_id": 5,
      "title": "Sprint Planning",
      "call_type": "video",
      "screen_share": true,
      "scheduled_at": "2026-03-07T10:00:00.000Z",
      "duration_minutes": 30,
      "recurrence": "weekly",
      "status": "scheduled",
      "creator_name": "Admin",
      "conversation_name": "Dev Team",
      "conversation_type": "group",
      "my_rsvp": "accepted",
      "participant_count": 4,
      "accepted_count": 3
    }
  ]
}
```

---

### 3. GET `/staff-chat/scheduled-calls/:id`
**Purpose**: Get full scheduled call detail with all participants  
**Auth**: JWT required (must be a participant)

**Flow**:
1. Fetch scheduled call with creator and conversation JOINs
2. Verify user is a participant (`scheduled_call_participants` table)
3. Fetch all participants with user name/email/avatar JOINs

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "conversation_id": 5,
    "title": "Sprint Planning",
    "description": "Review sprint goals",
    "call_type": "video",
    "screen_share": true,
    "scheduled_at": "2026-03-07T10:00:00.000Z",
    "duration_minutes": 30,
    "recurrence": "weekly",
    "status": "scheduled",
    "creator_name": "Admin",
    "conversation_name": "Dev Team",
    "conversation_type": "group",
    "my_rsvp": "accepted",
    "participants": [
      { "user_id": "...", "name": "Admin", "email": "...", "avatar_url": null, "rsvp": "accepted" },
      { "user_id": "...", "name": "John", "email": "...", "avatar_url": "...", "rsvp": "pending" }
    ]
  }
}
```

---

### 4. PUT `/staff-chat/scheduled-calls/:id`
**Purpose**: Update a scheduled call (creator only, must be in `'scheduled'` status)  
**Auth**: JWT required  
**Body**: Validated with inline Zod schema (all fields optional)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Updated title (1–255 chars) |
| `description` | `string` | No | Updated description (max 1000 chars) |
| `call_type` | `enum` | No | `'voice'` or `'video'` |
| `screen_share` | `boolean` | No | Screen sharing flag |
| `scheduled_at` | `string` | No | Updated datetime |
| `duration_minutes` | `number` | No | 5–480 minutes |
| `recurrence` | `enum` | No | Recurrence pattern |
| `recurrence_end` | `string|null` | No | Recurrence end date |

**Flow**:
1. Zod validate; fetch existing call
2. Verify `created_by === userId` → 403 if not creator
3. Verify `status === 'scheduled'` → 400 if call already started/cancelled
4. Build dynamic UPDATE SET from provided fields (`scheduled_at` and `recurrence_end` converted from ISO 8601 to MySQL datetime format via `.replace('T', ' ').replace('Z', '')`)
5. If `scheduled_at` changed → reset `reminder_sent = 0`
6. Re-fetch updated record with `creator_avatar` JOIN
7. `emitScheduledCall(conversation_id, 'updated', data)` via Socket.IO

**Response** `200`:
```json
{
  "success": true,
  "data": { /* updated scheduled call object */ }
}
```

---

### 5. DELETE `/staff-chat/scheduled-calls/:id`
**Purpose**: Cancel a scheduled call (creator only, status must be `'scheduled'`)  
**Auth**: JWT required  
**Note**: This is a **soft delete** — sets `status = 'cancelled'`, does not remove the row.

**Flow**:
1. Fetch call; verify `created_by === userId`; verify `status === 'scheduled'`
2. `UPDATE scheduled_calls SET status = 'cancelled' WHERE id = ?`
3. `emitScheduledCall(conversation_id, 'cancelled', { id })`
4. Fetch all participants; push notify offline ones

**Response** `200`:
```json
{ "success": true }
```

---

### 6. POST `/staff-chat/scheduled-calls/:id/rsvp`
**Purpose**: Accept or decline a scheduled call invitation  
**Auth**: JWT required (must be a participant)  
**Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rsvp` | `enum` | Yes | `'accepted'` or `'declined'` |

**Flow**:
1. Zod validate body
2. Verify call exists and `status === 'scheduled'` → 400 if cancelled/completed/active
3. Verify user is a participant
4. `UPDATE scheduled_call_participants SET rsvp = ? WHERE scheduled_call_id = ? AND user_id = ?`
5. `emitScheduledCall(conversation_id, 'rsvp', { scheduledCallId, userId, userName, rsvp })`

**Response** `200`:
```json
{ "success": true }
```

---

### 7. POST `/staff-chat/scheduled-calls/:id/start`
**Purpose**: Start a scheduled call — creates a real `call_sessions` record and triggers WebRTC signaling  
**Auth**: JWT required (must be a participant)

**Flow**:
1. Verify call exists and `status === 'scheduled'`
2. Verify user is a participant
3. Check no active/ringing call already exists in the conversation
4. INSERT into `call_sessions` (status: `'ringing'`, type from scheduled call)
5. INSERT accepted participants into `call_participants` (caller → `joined_at = NOW()`, others → `joined_at = NULL`)
6. UPDATE `scheduled_calls SET status = 'active', call_session_id = ?`
7. `emitCallRinging()` to conversation (reuses existing WebRTC signaling)
8. Push notify offline accepted participants
9. Set 45-second timeout: if still ringing → mark as missed, revert scheduled call status to `'scheduled'`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "call_id": 42,
    "conversation_id": 5,
    "call_type": "video",
    "screen_share": true,
    "status": "ringing"
  }
}
```

**After response**: Frontend uses `call_id` to initiate WebRTC signaling via `handleStartCall()` — same flow as ad-hoc calls.

**45-second timeout behavior** (dual approach):
- **In-process** `setTimeout(45s)`: Primary mechanism
  - If call is still `'ringing'` after 45 seconds:
  - `call_sessions.status` → `'missed'`, `ended_at` → `NOW()`
  - `call_participants.left_at` → `NOW()` for all
  - `scheduled_calls.status` → reverted to `'scheduled'`, `call_session_id` → `NULL` (can be retried)
  - `emitCallMissed()` to conversation
- **Periodic cleanup** (every 2 min): Safety net for server restarts
  - Catches `'ringing'` sessions older than 2 minutes
  - Same revert logic as above

---

### 8. POST `/staff-chat/scheduled-calls/:id/participants`
**Purpose**: Add participants to an existing scheduled call (creator only)  
**Auth**: JWT required  
**Body**: Validated with inline Zod schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_ids` | `string[]` | Yes | Array of user IDs to add (min 1) |

**Flow**:
1. Zod validate body
2. Verify call exists, `created_by === userId`, `status === 'scheduled'`
3. Verify all `user_ids` are conversation members
4. Batch `INSERT IGNORE` into `scheduled_call_participants` with `rsvp = 'pending'`
5. Fetch updated participant list
6. `emitScheduledCall(conversation_id, 'updated', { id, participants })`
7. Push notify new offline participants

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "added": 2,
    "participants": [
      { "user_id": "...", "name": "Admin", "email": "...", "avatar_url": null, "rsvp": "accepted" },
      { "user_id": "...", "name": "New User", "email": "...", "avatar_url": null, "rsvp": "pending" }
    ]
  }
}
```

---

### 9. DELETE `/staff-chat/scheduled-calls/:id/participants/:userId`
**Purpose**: Remove a participant from a scheduled call (creator only, cannot remove self)  
**Auth**: JWT required

**Flow**:
1. Verify call exists, `created_by === userId`, `status === 'scheduled'`
2. Verify `targetUserId !== userId` (cannot remove self)
3. `DELETE FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`
4. `emitScheduledCall(conversation_id, 'updated', { id, removedUserId })`

**Response** `200`:
```json
{ "success": true }
```

---

## Socket Events

### `scheduled-call` (emitted by server)
**Room**: `conv:<conversation_id>`  
**Emitter**: `emitScheduledCall(conversationId, eventType, data)`

| Event Type | When | Data Shape |
|------------|------|------------|
| `created` | New call scheduled | Full scheduled call object + participants |
| `updated` | Creator edits call or participants change | Updated scheduled call object |
| `cancelled` | Creator cancels call | `{ id: number }` |
| `rsvp` | Participant accepts/declines | `{ scheduledCallId, userId, userName, rsvp }` |
| `reminder` | 15 min before start (maintenance cron) | `{ id, title, scheduled_at }` |
| `started` | Call starts (via `/start`) | Triggers via `emitCallRinging()` instead |

**Frontend listener** (ChatPage.tsx):
```typescript
socket.on('scheduled-call', (data: { type: string; title?: string; [key: string]: any }) => {
  if (data.type === 'created' && data.title) {
    toast(`📅 New call scheduled: "${data.title}"`, { duration: 4000 });
  } else if (data.type === 'cancelled') {
    toast('❌ A scheduled call was cancelled', { duration: 4000 });
  } else if (data.type === 'reminder' && data.title) {
    toast(`⏰ "${data.title}" starts in 15 minutes`, { duration: 8000 });
  }
});
```

---

## Frontend Route Mapping

The scheduling module does not have its own page routes. All UI is modal/panel-based within the chat page:

| UI Component | Trigger | Type |
|-------------|---------|------|
| `ScheduleCallDialog` | Calendar icon in chat header | Modal overlay |
| `ScheduledCallsPanel` | "Scheduled calls" in dropdown menu | Slide-over panel |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|-----------------|-------------|------|---------------|
| Schedule a call | `StaffChatModel.createScheduledCall()` | POST | `/staff-chat/scheduled-calls` |
| List calls | `StaffChatModel.getScheduledCalls()` | GET | `/staff-chat/scheduled-calls` |
| View call detail | `StaffChatModel.getScheduledCallDetail()` | GET | `/staff-chat/scheduled-calls/:id` |
| Edit call | `StaffChatModel.updateScheduledCall()` | PUT | `/staff-chat/scheduled-calls/:id` |
| Cancel call | `StaffChatModel.cancelScheduledCall()` | DELETE | `/staff-chat/scheduled-calls/:id` |
| Accept/Decline | `StaffChatModel.rsvpScheduledCall()` | POST | `/staff-chat/scheduled-calls/:id/rsvp` |
| Start call | `StaffChatModel.startScheduledCall()` | POST | `/staff-chat/scheduled-calls/:id/start` |
| Add participants | `StaffChatModel.addScheduledCallParticipants()` | POST | `/staff-chat/scheduled-calls/:id/participants` |
| Remove participant | `StaffChatModel.removeScheduledCallParticipant()` | DELETE | `/staff-chat/scheduled-calls/:id/participants/:userId` |

---

## Permission Matrix

| Action | Enforcement |
|--------|-------------|
| Create scheduled call | Backend: `requireAuth` + must be conversation member |
| List scheduled calls | Backend: `requireAuth` + implicit filter (JOIN on user's participations) |
| View call detail | Backend: `requireAuth` + must be a participant |
| Update call | Backend: `requireAuth` + `created_by === userId` + `status === 'scheduled'` |
| Cancel call | Backend: `requireAuth` + `created_by === userId` + `status === 'scheduled'` |
| RSVP | Backend: `requireAuth` + must be a participant + `status === 'scheduled'` |
| Start call | Backend: `requireAuth` + must be a participant |
| Add participants | Backend: `requireAuth` + `created_by === userId` + `status === 'scheduled'` + targets must be conversation members |
| Remove participant | Backend: `requireAuth` + `created_by === userId` + `status === 'scheduled'` + cannot remove self |
| Start call (UI) | Frontend: only shows "Start" button if `created_by === currentUserId` and within 5 min of scheduled time |
