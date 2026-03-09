# Scheduling — Known Issues & Suggested Changes

## Known Issues

> ✅ All 16 issues have been resolved. See the Changelog below for details.

---

## Resolved Issues (Original — Issues 1–8)

### 1. ~~`upcoming` Status Filter Not a Real Enum Value~~ ✅ FIXED

**Resolution**: Backend now defaults `status` to `'upcoming'` when not provided. Also added `'all'` filter support for the "All Calls" tab. Frontend sends `?status=upcoming` or `?status=all` explicitly.

---

### 2. ~~Recurrence Stored but Never Executed~~ ✅ FIXED

**Resolution**: Added a maintenance interval (`startScheduledCallMaintenance()`) that runs every 2 minutes. When a recurring call completes, the next occurrence is automatically created with the same title, description, participants, and settings. The completed call's `recurrence` is set to `'none'` to prevent duplicate spawning.

---

### 3. ~~Reminder Notifications Not Implemented~~ ✅ FIXED

**Resolution**: The same maintenance interval queries for scheduled calls within 15 minutes of their start time where `reminder_sent = 0`. It sends push notifications to non-declined participants, emits a `'reminder'` socket event, and sets `reminder_sent = 1`.

---

### 4. ~~No Participant Management After Creation~~ ✅ FIXED

**Resolution**: Added two new endpoints:
- `POST /staff-chat/scheduled-calls/:id/participants` — add participants (validates conversation membership, batch INSERT IGNORE)
- `DELETE /staff-chat/scheduled-calls/:id/participants/:userId` — remove a participant (creator only, cannot remove self)

Frontend API methods added: `addScheduledCallParticipants()`, `removeScheduledCallParticipant()`.

---

### 5. ~~Sequential Participant INSERT Loop~~ ✅ FIXED

**Resolution**: Replaced the `for` loop with a single batch INSERT using multi-value syntax: `INSERT INTO ... VALUES (?,?,?), (?,?,?), ...`. Applied in both the create endpoint (inside transaction) and the add-participants endpoint.

---

### 6. ~~No Transaction Wrapping on Create~~ ✅ FIXED

**Resolution**: The create endpoint now uses `db.transaction(async (conn) => { ... })` which wraps the scheduled_call INSERT, participant batch INSERT, and system message INSERT in a single transaction with automatic rollback on failure.

---

### 7. ~~45-Second Timeout Uses `setTimeout` In-Process~~ ✅ FIXED

**Resolution**: Dual approach:
1. The in-process `setTimeout(45s)` is retained as a primary mechanism
2. A periodic cleanup query runs every 2 minutes to catch stale `'ringing'` sessions older than 2 minutes (covers server restart edge case). Also clears `call_session_id` on the linked scheduled call.

---

### 8. ~~Frontend Field Name Mismatch for Participants~~ ✅ FIXED

**Resolution**: Backend SQL aliases changed from `u.name AS user_name, u.email AS user_email` to `u.name, u.email` — matching the frontend `ScheduledCallParticipant` interface which expects `name` and `email`. Applied in both the create (transaction) and detail (GET /:id) queries.

---

## Resolved Issues (Wiring Audit — Issues 9–16)

### 9. ~~Socket Payload Field Name Mismatch~~ ✅ FIXED

**Problem**: `emitScheduledCall()` in `chatSocket.ts` emitted `{ eventType, conversationId, ...data }` but the frontend listener expected the field to be `type`. Every socket event was arriving with `eventType` instead of `type`, so the frontend's `data.type === 'created'` checks never matched — **all toast notifications were silent/broken**.

**Resolution**: Changed `chatSocket.ts` to emit `{ type: eventType, conversationId, ...data }`. Now the frontend `data.type` checks work correctly.

---

### 10. ~~PUT Route: ISO→MySQL Conversion Missing~~ ✅ FIXED

**Problem**: The POST (create) route correctly converted `scheduled_at` from ISO 8601 to MySQL format via `.replace('T', ' ').replace('Z', '')`, but the PUT (update) route passed the raw ISO string directly to MySQL. Updating a call's time would either fail (strict mode) or silently mangle the datetime. Same issue for `recurrence_end`.

**Resolution**: Added `.replace('T', ' ').replace('Z', '')` conversion for both `scheduled_at` and `recurrence_end` in the PUT route's dynamic SET builder, matching the POST route pattern.

---

### 11. ~~DB ENUM Missing `'biweekly'` Value~~ ✅ FIXED

**Problem**: The Zod validation schemas (POST and PUT) accepted `'biweekly'` as a recurrence value, but the MySQL migration (018) defined the `recurrence` column as `ENUM('none','daily','weekly','monthly')` — without `'biweekly'`. Attempting to save a biweekly schedule would fail at the database level.

**Resolution**: Applied `ALTER TABLE scheduled_calls MODIFY COLUMN recurrence ENUM('none','daily','weekly','biweekly','monthly')` to the live database. Updated migration 018 to match. All Zod schemas, backend maintenance code, and frontend UI already supported `'biweekly'`.

---

### 12. ~~Frontend Socket Listener Accessing Wrong Fields~~ ✅ FIXED

**Problem**: The `ChatPage.tsx` socket listener for `'scheduled-call'` events expected data in the shape `{ type: string; scheduled_call: any }` and accessed `data.scheduled_call.title` (nested). But `emitScheduledCall()` spreads data at the top level: `{ type, conversationId, title, ... }`. So `data.scheduled_call` was always `undefined` — **all toast notifications showed nothing**.

**Resolution**: Updated the listener to access `data.title` directly. Also added handlers for `cancelled` and `reminder` event types (previously only `started` and `created` were handled, and `started` was never emitted since the start route uses `emitCallRinging()` instead).

---

### 13. ~~RSVP Route: No Status Guard~~ ✅ FIXED

**Problem**: The RSVP endpoint only verified the user was a participant — it did NOT check the call's status. Users could RSVP to calls with status `'cancelled'`, `'completed'`, or `'active'`, which is semantically meaningless.

**Resolution**: Added `if (call.status !== 'scheduled') throw badRequest('Cannot RSVP to a call that is not in scheduled state')` before the participant check. Now returns 400 for non-scheduled calls.

---

### 14. ~~Recurrence Spawning Copied Old RSVP Status~~ ✅ FIXED

**Problem**: When the maintenance loop spawned the next occurrence of a recurring call, it copied each participant's RSVP status verbatim from the completed call. This meant a user who declined one occurrence was auto-declined for the next one, with no opportunity to reconsider.

**Resolution**: Changed the recurrence spawner to reset RSVP: creator → `'accepted'`, all other participants → `'pending'`. This matches the behavior of most calendar applications.

---

### 15. ~~ChatPage `onCreated` Callback Was a No-Op~~ ✅ FIXED

**Problem**: The `ScheduleCallDialog`'s `onCreated` callback in `ChatPage.tsx` was:
```typescript
setShowScheduledCalls((prev) => { if (prev) return prev; return prev; });
```
This always returned `prev` unchanged — React would not re-render. If the `ScheduledCallsPanel` was already open when a call was created/edited, it would not refresh.

**Resolution**: Changed to a toggle-refresh pattern: if the panel is open, it's briefly closed (`false`) then reopened via `setTimeout(() => setShowScheduledCalls(true), 50)`, which triggers the panel's `useEffect` on `open` to re-fetch from the API.

---

### 16. ~~PUT Route Response Missing `creator_avatar`~~ ✅ FIXED

**Problem**: The PUT (update) route's re-fetch SELECT was `SELECT sc.*, u.name AS creator_name, u.email AS creator_email` — missing `u.avatar_url AS creator_avatar`. The GET list and GET detail routes both included it, creating an inconsistency where the response after editing a call lacked the avatar field.

**Resolution**: Added `u.avatar_url AS creator_avatar` to the PUT route's re-fetch SELECT to match the other endpoints.

---

## Suggested Enhancements

### A. Calendar Integration
Add `.ics` file generation so users can add scheduled calls to Google Calendar / Outlook. The endpoint could be `GET /scheduled-calls/:id/ical`.

### B. Recurring Call Dashboard
A dedicated UI view showing all recurring call series with the ability to edit the recurrence pattern or cancel future occurrences.

### C. Call Minutes / Notes
After a call completes, allow attaching meeting notes or an auto-generated summary. Could use a `call_notes` table linked via `call_session_id`.

### D. Screen Share Pre-Selection
Currently `screen_share` is a boolean flag stored at scheduling time. The actual WebRTC screen-share negotiation happens separately at call start. Consider auto-enabling screen share in the WebRTC flow when `screen_share = true`.

### E. Timezone-Aware Scheduling
Store `scheduled_at` as UTC and add a `timezone` column so users in different timezones see the correct local time. Currently relies on the browser's local timezone interpretation.

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-01-01 | Copilot | Initial documentation created with module implementation |
| 2026-03-06 | Copilot | Fixed all 8 known issues: upcoming filter default, recurrence cron, reminder cron, participant management endpoints, batch INSERTs, transaction wrapping, stale-call cleanup, field name aliasing |
| 2026-03-06 | Copilot | Wiring audit: fixed 8 additional issues (#9–#16): socket payload field `eventType`→`type`, PUT ISO→MySQL conversion, DB ENUM `biweekly`, frontend socket listener field access, RSVP status guard, recurrence RSVP reset, `onCreated` no-op callback, PUT response `creator_avatar` |
