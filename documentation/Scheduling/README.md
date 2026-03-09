# Scheduling Module

## Overview
The Scheduling module extends the staff-chat system with the ability to schedule voice and video calls with optional screen sharing support. It provides full CRUD for scheduled calls, an RSVP system for participants, automatic WebRTC call session creation when a scheduled call starts, and real-time notifications via Socket.IO and push. Scheduled calls live within conversations and are visible to all conversation members.

**Current Data**: 0 scheduled calls (tables created March 2026)  
**Last Updated**: March 2026 — 9 REST endpoints, 2 frontend components, Socket.IO integration, maintenance cron (reminders, recurrence, stale-call cleanup). Wiring audit completed: 8 issues fixed (socket payload field, ISO→MySQL in PUT, DB ENUM, RSVP status guard, recurrence RSVP reset, frontend listener, panel refresh, response consistency).

## Key Responsibilities
- Create scheduled calls within any staff-chat conversation (voice or video)
- Optional screen sharing flag on scheduled calls
- Recurring schedule support (daily, weekly, biweekly, monthly) with optional end date
- **Automatic recurrence**: maintenance loop spawns next occurrence when a recurring call completes
- **Reminder notifications**: push + socket reminder 15 minutes before scheduled time
- RSVP system — participants can accept or decline invitations
- **Participant management**: add/remove participants after creation (creator only)
- Start scheduled call → creates a real `call_sessions` record and triggers WebRTC signaling
- Automatic 45-second ringing timeout with fallback to missed state
- **Stale-call cleanup**: periodic maintenance catches ringing calls stuck > 2 minutes (server restart safety)
- **Transactional create**: call + participants + system message wrapped in a single DB transaction
- System messages posted to conversation on schedule creation
- Push notifications to offline participants on create, cancel, start, and reminder
- Real-time Socket.IO events for created, updated, cancelled, RSVP, started, and reminder
- List upcoming/all scheduled calls with participant counts and RSVP status
- Creator-only edit, cancel, and participant management permissions
- Frontend modal dialog for create/edit with date picker, time picker, call type toggle, screen share toggle, duration selector, recurrence options
- Frontend slide-over panel for viewing upcoming calls with RSVP buttons and start/edit/cancel actions

## Architecture

### Backend
- **Router**: `src/routes/staffChat.ts` (lines 2084–2854, ~770 LOC) — 9 route handlers + maintenance loop within the existing staff-chat router, mounted at `/staff-chat/scheduled-calls`
- **Socket Emitter**: `src/services/chatSocket.ts` — `emitScheduledCall()` function broadcasts to `conv:<id>` Socket.IO room
- **Migration**: `src/db/migrations/018_scheduled_calls.ts` (82 LOC) — Creates 2 tables with FK constraints and indexes
- **Database**: `mysql2/promise` pool queries via `db` helper; create endpoint uses `db.transaction()` for atomicity
- **Maintenance**: `startScheduledCallMaintenance()` runs every 2 min — stale-call cleanup, reminders, recurrence spawning
- **Validation**: Zod schemas inline in each route handler
- **Push**: Firebase push notifications via `sendPushToUser()` for offline participants
- **Auth**: All routes require JWT via `requireAuth` middleware

### Frontend
- **Schedule Dialog**: `src/pages/general/chat/ScheduleCallDialog.tsx` (355 LOC) — Modal for creating/editing scheduled calls
- **Scheduled Calls Panel**: `src/pages/general/chat/ScheduledCallsPanel.tsx` (384 LOC) — Slide-over panel listing calls with RSVP and actions
- **Model**: `src/models/StaffChatModel.ts` — `ScheduledCall` and `ScheduledCallParticipant` interfaces + 9 static API methods (within existing 554 LOC model)
- **Chat Header**: `src/pages/general/chat/ChatHeader.tsx` (361 LOC) — Calendar icon button + "Scheduled calls" dropdown menu item
- **Chat Page**: `src/pages/general/ChatPage.tsx` (1584 LOC) — State management, socket listener, handlers for schedule/start/edit
- **State**: Local component state (no Zustand store for scheduling)

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Request body validation |
| `chatSocket.ts` | `emitScheduledCall()` real-time events |
| `firebaseService.ts` | Push notifications via `sendPushToUser()` |
| `requireAuth` middleware | JWT authentication on all routes |
| `call_sessions` table | Real call session created when a scheduled call starts |
| `conversations` / `conversation_members` | Membership verification, participant resolution |
| `@heroicons/react` | CalendarDaysIcon, ClockIcon, ArrowPathIcon, etc. |
| `react-hot-toast` | Success/error notifications |

## Database Tables

| Table | Purpose |
|-------|---------|
| `scheduled_calls` | Scheduled call records (title, time, type, recurrence, status, linked call session) |
| `scheduled_call_participants` | Per-user RSVP state for each scheduled call |
| `conversations` | Parent conversation (FK from `scheduled_calls`) |
| `call_sessions` | Real WebRTC session created on start (FK from `scheduled_calls.call_session_id`) |
| `users` | Creator/participant name lookup via JOINs |
| `messages` | System message inserted on schedule creation |

## Status Values

| Value | Label | Description |
|-------|-------|-------------|
| `scheduled` | Scheduled | Call is upcoming, awaiting start |
| `active` | In Progress | Call has been started (linked to a `call_session`) |
| `completed` | Completed | Call session ended normally |
| `cancelled` | Cancelled | Creator cancelled the scheduled call |

## RSVP Values

| Value | Label | Badge Color |
|-------|-------|-------------|
| `pending` | Pending | Gray (`bg-gray-100`) |
| `accepted` | Accepted | Green (`bg-green-100`) |
| `declined` | Declined | Red (`bg-red-100`) |

## Call Type Values

| Value | Label | Icon |
|-------|-------|------|
| `voice` | Voice | `PhoneIcon` (green) |
| `video` | Video | `VideoCameraIcon` (blue) |

## Recurrence Values

| Value | Label |
|-------|-------|
| `none` | Does not repeat |
| `daily` | Daily |
| `weekly` | Weekly |
| `biweekly` | Every 2 weeks |
| `monthly` | Monthly |

## Key Data Flows

### Schedule a Call
```
Frontend (ScheduleCallDialog)
  → POST /staff-chat/scheduled-calls (Zod validated)
  → Verify user is conversation member
  → Resolve participant list (specified subset or all members)
  → BEGIN TRANSACTION
    → INSERT into scheduled_calls (status: 'scheduled')
    → Batch INSERT participants (multi-value, creator → 'accepted', others → 'pending')
    → INSERT system message into conversation
    → Fetch full record with participants
  → COMMIT
  → emitScheduledCall(conv, 'created', data) via Socket.IO
  → Push notify offline participants (fire-and-forget)
  → Return created scheduled call
```

### List Scheduled Calls
```
Frontend (ScheduledCallsPanel)
  → GET /staff-chat/scheduled-calls?status=upcoming (default)
  → Supports: ?status=upcoming|scheduled|active|completed|cancelled|all
  → Supports: ?conversation_id=N for per-conversation filtering
  → JOIN on scheduled_call_participants for user's RSVP
  → JOIN conversations for name/type
  → Enrich DM calls with other-user info
  → Return array with participant_count, accepted_count, my_rsvp
```

### RSVP to a Scheduled Call
```
Frontend (ScheduledCallsPanel → Accept/Decline button)
  → POST /staff-chat/scheduled-calls/:id/rsvp { rsvp: 'accepted'|'declined' }
  → Verify call exists and status = 'scheduled' (rejects cancelled/completed/active calls)
  → Verify user is a participant
  → UPDATE rsvp in scheduled_call_participants
  → emitScheduledCall(conv, 'rsvp', { userId, userName, rsvp })
  → Return success
```

### Start a Scheduled Call
```
Frontend (ScheduledCallsPanel → Start button)
  → POST /staff-chat/scheduled-calls/:id/start
  → Verify user is a participant
  → Check no active call in conversation
  → INSERT into call_sessions (status: 'ringing')
  → INSERT accepted participants into call_participants
  → UPDATE scheduled_calls SET status = 'active', call_session_id
  → emitCallRinging() to conversation
  → Push notify offline accepted participants
  → Set 45-second auto-miss timeout
  → Return { call_id, conversation_id, call_type, status }
  → Frontend then initiates WebRTC signaling with returned call_id
```

### Cancel a Scheduled Call
```
Frontend (ScheduledCallsPanel → Cancel button)
  → DELETE /staff-chat/scheduled-calls/:id
  → Verify creator ownership
  → UPDATE status = 'cancelled' (soft delete)
  → emitScheduledCall(conv, 'cancelled', { id })
  → Push notify offline participants
  → Return success
```

### Edit a Scheduled Call
```
Frontend (ScheduleCallDialog with existing prop)
  → PUT /staff-chat/scheduled-calls/:id (Zod validated)
  → Verify creator ownership + status = 'scheduled'
  → Build dynamic UPDATE from provided fields (scheduled_at/recurrence_end converted ISO→MySQL)
  → Reset reminder_sent if scheduled_at changed
  → emitScheduledCall(conv, 'updated', data)
  → Return updated record
```

### Add Participants (Post-Creation)
```
Frontend
  → POST /staff-chat/scheduled-calls/:id/participants { user_ids: [...] }
  → Verify creator ownership + status = 'scheduled'
  → Validate user_ids are conversation members
  → Batch INSERT IGNORE into scheduled_call_participants (rsvp: 'pending')
  → emitScheduledCall(conv, 'updated', { participants })
  → Push notify new participants
  → Return { added, participants }
```

### Remove a Participant
```
Frontend
  → DELETE /staff-chat/scheduled-calls/:id/participants/:userId
  → Verify creator ownership + status = 'scheduled'
  → Cannot remove self
  → DELETE from scheduled_call_participants
  → emitScheduledCall(conv, 'updated', { removedUserId })
  → Return success
```

### Maintenance Loop (every 2 minutes)
```
startScheduledCallMaintenance() — runs on module load
  1. Stale-call cleanup:
     → Find call_sessions WHERE status = 'ringing' AND created_at < NOW() - 2 MIN
     → Mark as missed, revert linked scheduled_calls to 'scheduled'
  2. Reminders:
     → Find scheduled_calls WHERE status = 'scheduled' AND reminder_sent = 0
       AND scheduled_at <= NOW() + 15 MIN AND scheduled_at > NOW()
     → Push notify non-declined participants
     → Emit 'reminder' socket event
     → Set reminder_sent = 1
  3. Recurrence spawning:
     → Find scheduled_calls WHERE status = 'completed' AND recurrence != 'none'
     → Calculate next occurrence date
     → INSERT new scheduled_call + copy participants (RSVP reset: creator → 'accepted', others → 'pending')
     → Clear recurrence on completed call to prevent re-spawn
     → Emit 'created' socket event for the new occurrence
```

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| Chat (Staff Chat) | Hard | Routes mounted within `staffChatRouter`; uses conversations and members |
| Authentication | Hard | JWT auth required for all routes |
| Users | Hard | Creator/participant name lookup via JOINs |
| Call Sessions | Hard | Real `call_sessions` record created on start |
| Socket.IO (Chat) | Hard | `emitScheduledCall()`, `emitCallRinging()`, `emitCallMissed()` |
| Firebase Push | Soft | Push notifications to offline participants (graceful failure) |
| Messages | Soft | System message posted on schedule creation |

## Modules That Depend on Scheduling

| Module | Usage |
|--------|-------|
| Chat (WebRTC) | Receives `call_id` from start endpoint to initiate WebRTC signaling |
| Chat (Socket) | Clients listen for `'scheduled-call'` events for toast notifications |
