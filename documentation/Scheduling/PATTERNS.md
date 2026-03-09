# Scheduling — Code Patterns & Architecture

## 1. Conversation Membership Guard

Every scheduling endpoint verifies the requesting user is a member of the target conversation before proceeding. This is the same pattern used by all chat endpoints.

```typescript
// staffChat.ts — repeated at every endpoint entry
const [members]: any = await db.query(
  `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?`,
  [conversation_id, req.user!.id]
);
if (!members.length) return res.status(403).json({ error: 'Not a conversation member' });
```

**Why**: Prevents data leakage across conversations. Even though `requireAuth` confirms identity, it does not confirm conversation access.

---

## 2. Creator-Only Permission Pattern

Destructive or state-changing operations (update, cancel, start) are restricted to the user who created the scheduled call.

```typescript
if (call.created_by !== req.user!.id) {
  return res.status(403).json({ error: 'Only the creator can update this scheduled call' });
}
```

**Applies to**: `PUT /:id` (update), `DELETE /:id` (cancel), `POST /:id/start` (start call), `POST /:id/participants` (add), `DELETE /:id/participants/:userId` (remove).  
**Does NOT apply to**: `POST /:id/rsvp` (any participant), `GET` (any conversation member).

---

## 3. Soft Cancel vs Hard Delete

Scheduled calls are never deleted from the database. The `DELETE` endpoint performs a soft cancel by setting `status = 'cancelled'`.

```typescript
await db.query(
  `UPDATE scheduled_calls SET status = 'cancelled' WHERE id = ?`,
  [callId]
);
```

**Why**: Preserves audit trail. Cancelled calls remain queryable for history.

---

## 4. Dynamic UPDATE Builder

The update endpoint builds SET clauses dynamically from provided fields, avoiding overwriting unsubmitted fields with `NULL`.

```typescript
const updates: string[] = [];
const values: any[] = [];

if (body.title)            { updates.push('title = ?');            values.push(body.title); }
if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
if (body.call_type)        { updates.push('call_type = ?');        values.push(body.call_type); }
// ... remaining fields ...

if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

values.push(callId);
await db.query(`UPDATE scheduled_calls SET ${updates.join(', ')} WHERE id = ?`, values);
```

**Key behaviour**: `description` uses `!== undefined` check (allows setting to `null`/empty), while other fields use truthy checks.

---

## 5. Transactional Create with Batch Participant Insert

The create endpoint wraps all writes in a single `db.transaction()` for atomicity. Participants are batch-inserted using multi-value INSERT.

```typescript
const { scId, result } = await db.transaction(async (conn) => {
  // 1. Insert the scheduled call
  const [insertResult] = await conn.query(
    `INSERT INTO scheduled_calls (...) VALUES (?, ?, ...)`,
    [...values],
  );
  const scId = String((insertResult as any).insertId);

  // 2. Batch insert participants (single query)
  if (participantIds.length > 0) {
    const placeholders = participantIds.map(() => '(?, ?, ?)').join(', ');
    const values = participantIds.flatMap(pid => [scId, pid, pid === userId ? 'accepted' : 'pending']);
    await conn.query(
      `INSERT INTO scheduled_call_participants (scheduled_call_id, user_id, rsvp) VALUES ${placeholders}`,
      values,
    );
  }

  // 3. Insert system message
  await conn.query(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at) VALUES (?, ?, ?, 'system', NOW())`,
    [...],
  );

  // Fetch complete record within transaction
  return { scId, result: { ...scheduled, participants } };
});
```

**Why transaction**: If participant insert or system message fails, the scheduled call INSERT is rolled back — no orphan data.

**Why batch insert**: Single query instead of N queries. Uses `flatMap` to build the multi-value parameter array.

**Note**: `db.transaction()` uses `mysql2/promise` connection pooling — it calls `getConnection()`, `beginTransaction()`, the callback, `commit()`, and auto-`rollback()` on error.

---

## 6. Socket.IO Room-Based Broadcasting

All scheduling events are broadcast to conversation rooms via a dedicated `emitScheduledCall()` helper.

```typescript
// chatSocket.ts
export function emitScheduledCall(
  conversationId: number,
  eventType: string,
  data: Record<string, any>
) {
  chatNamespace.to(`conv:${conversationId}`).emit('scheduled-call', { type: eventType, ...data });
}
```

**Event types emitted**:
| Event Type | Triggered By | Payload |
|------------|-------------|---------|
| `created` | POST create | Full call object + participants |
| `updated` | PUT update | Refreshed call object |
| `cancelled` | DELETE cancel | `{ id }` |
| `rsvp` | POST rsvp | `{ id, user_id, rsvp }` |
| `started` | POST start | `{ id, call_id, status: 'active' }` |

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

## 7. WebRTC Bridge: Scheduled → Live Call

The `POST /:id/start` endpoint bridges scheduled calls into the existing live-call infrastructure:

1. **Create call_session** → INSERT into `call_sessions` with `call_type`, `started_by`, `conversation_id`
2. **Link back** → UPDATE `scheduled_calls` SET `call_session_id`, `status = 'active'`
3. **Ring participants** → `emitCallRinging()` (from existing call infrastructure)
4. **45-second timeout** → `setTimeout` reverts status to `'scheduled'` and emits `emitCallMissed()` if no one answers

```typescript
const timeout = setTimeout(async () => {
  const [check]: any = await db.query(
    `SELECT status FROM call_sessions WHERE id = ?`, [sessionId]
  );
  if (check[0]?.status === 'ringing') {
    await db.query(`UPDATE call_sessions SET status = 'missed', ended_at = NOW() WHERE id = ?`, [sessionId]);
    await db.query(`UPDATE scheduled_calls SET status = 'scheduled', call_session_id = NULL WHERE id = ?`, [callId]);
    emitCallMissed(conversation_id, sessionId);
  }
}, 45000);
```

**Why revert to `'scheduled'`**: Allows the creator to try starting the call again if no one answered the first time.

**Why clear `call_session_id`**: Prevents orphan FK reference to a missed session.

**Safety net**: A periodic maintenance loop also catches stale ringing calls > 2 minutes old (see Pattern 15).

---

## 8. Push Notification with Online Check

After creating a scheduled call, push notifications are sent only to participants who are NOT currently connected via Socket.IO.

```typescript
const onlineUsers = getOnlineUsers(); // from chatSocket.ts

for (const p of participants) {
  if (p.user_id !== req.user!.id && !onlineUsers.has(p.user_id)) {
    sendPushToUser(p.user_id, {
      title: 'New Scheduled Call',
      body: `${req.user!.name} scheduled: ${title}`,
      data: { type: 'scheduled-call', conversation_id: String(conversation_id) }
    });
  }
}
```

**Why**: Avoids redundant push notifications for users already seeing real-time socket events.

---

## 9. System Message Injection

When a call is scheduled, a system message is inserted into the conversation so it appears in the chat timeline.

```typescript
await db.query(
  `INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES (?, ?, ?, 'system')`,
  [conversation_id, req.user!.id, `📅 Scheduled a call: "${title}" for ${new Date(scheduled_at).toLocaleString()}`]
);
```

**Message types used**: `'system'` (not a regular `'text'` message). Frontend renders system messages differently — centered, muted styling.

---

## 10. Optimistic UI Patterns (Frontend)

### Instant Dialog Close
`ScheduleCallDialog` closes immediately on successful API response, before the socket event arrives:
```typescript
const res = await StaffChatModel.createScheduledCall({ ... });
onCreated?.();  // triggers panel refresh via toggle
onClose();      // closes dialog immediately
```

The `onCreated` callback in `ChatPage.tsx` force-refreshes the `ScheduledCallsPanel` by toggling its `open` state (close → reopen after 50ms), which triggers the panel's `useEffect` to re-fetch from the API.

### Socket-Driven Refresh
`ScheduledCallsPanel` re-fetches from the API whenever:
- Panel opens (`useEffect` on `open` prop)
- `onCreated` toggle-refresh fires (50ms close→reopen cycle)
- Filter tab changes (`filter` state in `load()` dependency array)

### Duration Formatting
Frontend displays human-readable durations:
```typescript
const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};
```

---

## 11. Date/Time Handling

### Backend
- `scheduled_at` stored as MySQL `DATETIME` (no timezone)
- Passed through as ISO 8601 strings in JSON responses
- Comparisons done with `NOW()` for filtering upcoming calls

### Frontend
- Dates displayed using `toLocaleDateString()` and `toLocaleTimeString()` (browser locale)
- "Time until" calculated client-side: `new Date(scheduled_at).getTime() - Date.now()`
- Default new call: tomorrow's date, next half-hour time slot

---

## 12. Status Filter Pattern (GET List)

The list endpoint supports a `status` query parameter with special `upcoming` and `all` values:

```typescript
const status = (req.query.status as string) || 'upcoming'; // default = upcoming

let statusClause: string;
let statusParams: any[];
if (status === 'upcoming') {
  statusClause = `sc.status IN ('scheduled', 'active')`;
  statusParams = [];
} else if (status === 'all') {
  statusClause = `1=1`;
  statusParams = [];
} else {
  statusClause = `sc.status = ?`;
  statusParams = [status];
}
```

**Query string options**: `?status=upcoming` (default), `?status=all`, `?status=scheduled`, `?status=active`, `?status=completed`, `?status=cancelled`

Also supports `?conversation_id=N` for per-conversation filtering.

---

## 13. RSVP Upsert Pattern

The RSVP endpoint uses `INSERT ... ON DUPLICATE KEY UPDATE` to handle both first-time and changed RSVPs in a single query.

```typescript
await db.query(
  `INSERT INTO scheduled_call_participants (scheduled_call_id, user_id, rsvp)
   VALUES (?, ?, ?)
   ON DUPLICATE KEY UPDATE rsvp = VALUES(rsvp)`,
  [callId, req.user!.id, rsvp]
);
```

**Why**: The `uq_call_user` unique constraint on `(scheduled_call_id, user_id)` makes this safe. No need to check existence first.

---

## 14. Error Response Pattern

All scheduling endpoints follow the standard chat error envelope:

```json
// Validation error (400)
{ "error": "Validation failed", "details": [ ... zodErrors ] }

// Permission error (403)
{ "error": "Not a conversation member" }
{ "error": "Only the creator can update this scheduled call" }

// Not found (404)
{ "error": "Scheduled call not found" }

// Server error (500)
{ "error": "Failed to create scheduled call" }
```

**Pattern**: Try/catch wraps entire handler. Zod `.safeParse()` returns structured errors. Business logic returns specific 4xx. Catch block returns generic 500.

---

## 15. Periodic Maintenance Loop

A `setInterval` runs every 2 minutes to handle three background tasks that can't rely on request-triggered code:

```typescript
function startScheduledCallMaintenance(): void {
  setInterval(async () => {
    // 1. Stale-call cleanup (ringing > 2 min)
    // 2. Send reminders (15 min before start, reminder_sent = 0)
    // 3. Spawn recurrence (completed + recurrence != 'none')
  }, 2 * 60 * 1000);
}
startScheduledCallMaintenance(); // called at module load
```

**Why `setInterval` instead of cron**: Runs within the same Node.js process, has access to `db`, `emitScheduledCall()`, `sendPushToUser()`, and `isUserOnline()`. No external cron infrastructure needed.

**Guard**: Uses `let _cleanupInterval` to prevent duplicate intervals if the module is loaded twice.

---

## 16. Post-Creation Participant Management

Two dedicated endpoints allow adding/removing participants after a call is created:

```typescript
// Add — batch INSERT IGNORE (skips duplicates)
const placeholders = toAdd.map(() => "(?, ?, 'pending')").join(', ');
await db.execute(
  `INSERT IGNORE INTO scheduled_call_participants (...) VALUES ${placeholders}`,
  toAdd.flatMap(id => [scId, id]),
);

// Remove — hard DELETE (not soft)
await db.execute(
  `DELETE FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`,
  [scId, targetUserId],
);
```

**Constraints**: Creator-only, `status === 'scheduled'` only, cannot remove self, targets must be conversation members (validated before insert).

---

## 17. Recurrence Spawning Pattern

When a recurring call completes, the maintenance loop creates the next occurrence:

1. Query completed calls where `recurrence != 'none'`
2. Calculate next date based on recurrence type
3. Check `recurrence_end` boundary
4. Dedup: check if a future call with same title/conversation/creator already exists
5. INSERT new `scheduled_calls` row with same settings
6. Copy participants from the completed call (RSVP reset: creator → `'accepted'`, others → `'pending'`)
7. Set `recurrence = 'none'` on the completed call to prevent re-spawning

```typescript
// Date calculation
switch (call.recurrence) {
  case 'daily':    next = new Date(prev.getTime() + 86400000); break;
  case 'weekly':   next = new Date(prev.getTime() + 7 * 86400000); break;
  case 'biweekly': next = new Date(prev.getTime() + 14 * 86400000); break;
  case 'monthly':  next = new Date(prev); next.setMonth(next.getMonth() + 1); break;
}
```

**Why clear recurrence on old call**: Prevents the maintenance loop from creating duplicates on subsequent runs.
