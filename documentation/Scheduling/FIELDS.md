# Scheduling — Field & Data Dictionary

## Database Schema: `scheduled_calls` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `BIGINT UNSIGNED` (PK, AUTO_INCREMENT) | No | — | `id` | Auto-increment primary key |
| `conversation_id` | `BIGINT UNSIGNED` (FK) | No | — | `conversation_id` | Links to `conversations.id` (CASCADE on delete) |
| `created_by` | `VARCHAR(36)` (FK) | No | — | `created_by` | Creator user ID → `users.id` (CASCADE on delete) |
| `title` | `VARCHAR(255)` | No | — | `title` | Call title (1–255 chars) |
| `description` | `TEXT` | Yes | `NULL` | `description` | Optional notes/agenda (max 1000 chars per Zod) |
| `call_type` | `ENUM('voice','video')` | No | `'video'` | `call_type` | Voice or video call |
| `screen_share` | `TINYINT(1)` | No | `0` | `screen_share` | Screen sharing enabled (boolean) |
| `scheduled_at` | `DATETIME` | No | — | `scheduled_at` | When the call is scheduled for |
| `duration_minutes` | `INT UNSIGNED` | No | `30` | `duration_minutes` | Expected duration in minutes (5–480 per Zod) |
| `recurrence` | `ENUM('none','daily','weekly','biweekly','monthly')` | No | `'none'` | `recurrence` | Recurrence pattern |
| `recurrence_end` | `DATETIME` | Yes | `NULL` | `recurrence_end` | Date recurrence stops |
| `status` | `ENUM('scheduled','active','completed','cancelled')` | No | `'scheduled'` | `status` | Lifecycle status |
| `call_session_id` | `BIGINT UNSIGNED` (FK) | Yes | `NULL` | `call_session_id` | Links to `call_sessions.id` when started (SET NULL on delete) |
| `reminder_sent` | `TINYINT(1)` | No | `0` | — | Whether a reminder notification has been sent |
| `created_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` | `created_at` | Record creation time |
| `updated_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` (on update) | `updated_at` | Last modification time |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `PRIMARY` | `id` | Primary | Row identity |
| `idx_conversation` | `conversation_id` | Index | Filter by conversation |
| `idx_created_by` | `created_by` | Index | Filter by creator |
| `idx_scheduled_at` | `scheduled_at` | Index | Sort/filter by scheduled time |
| `idx_status` | `status` | Index | Filter by status |
| `idx_reminder` | `status, reminder_sent, scheduled_at` | Composite | Reminder cron query optimization |

### Foreign Keys

| Name | Column | References | On Delete |
|------|--------|------------|-----------|
| `fk_scheduled_calls_conversation` | `conversation_id` | `conversations(id)` | CASCADE |
| `fk_scheduled_calls_user` | `created_by` | `users(id)` | CASCADE |
| `fk_scheduled_calls_session` | `call_session_id` | `call_sessions(id)` | SET NULL |

### SQL Column Aliasing (via JOINs)

```sql
-- Creator name (from users table)
u.name AS creator_name
u.email AS creator_email
u.avatar_url AS creator_avatar

-- Conversation info (from conversations table)
c.name AS conversation_name
c.type AS conversation_type

-- Current user's RSVP (from scheduled_call_participants)
scp.rsvp AS my_rsvp

-- Aggregate counts (subqueries)
(SELECT COUNT(*) FROM scheduled_call_participants WHERE scheduled_call_id = sc.id) AS participant_count
(SELECT COUNT(*) FROM scheduled_call_participants WHERE scheduled_call_id = sc.id AND rsvp = 'accepted') AS accepted_count
```

### Status Lifecycle

```
scheduled → active → completed
    │                    ↑
    │                    │ (call_session ended)
    ├─→ cancelled        │
    │                    │
    └─→ active ──────────┘
          │
          └─→ scheduled  (reverted on 45s timeout / missed call)
```

---

## Database Schema: `scheduled_call_participants` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `BIGINT UNSIGNED` (PK, AUTO_INCREMENT) | No | — | — | Auto-increment primary key |
| `scheduled_call_id` | `BIGINT UNSIGNED` (FK) | No | — | `scheduled_call_id` | Links to `scheduled_calls.id` (CASCADE on delete) |
| `user_id` | `VARCHAR(36)` (FK) | No | — | `user_id` | Participant user ID → `users.id` (CASCADE on delete) |
| `rsvp` | `ENUM('pending','accepted','declined')` | No | `'pending'` | `rsvp` | Participant's RSVP status |
| `created_at` | `DATETIME` | No | `CURRENT_TIMESTAMP` | `created_at` | Record creation time |

### Indexes & Constraints

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `PRIMARY` | `id` | Primary | Row identity |
| `uq_call_user` | `scheduled_call_id, user_id` | Unique | Prevent duplicate participants |
| `idx_user` | `user_id` | Index | Find all calls for a user |

### Foreign Keys

| Name | Column | References | On Delete |
|------|--------|------------|-----------|
| `fk_scp_call` | `scheduled_call_id` | `scheduled_calls(id)` | CASCADE |
| `fk_scp_user` | `user_id` | `users(id)` | CASCADE |

### SQL Column Aliasing (via JOINs)

```sql
-- Participant info (from users table)
u.name
u.email
u.avatar_url
```

---

## Zod Validation Schemas

### Create Scheduled Call (POST `/scheduled-calls`)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `conversation_id` | `number` | Yes | int, positive |
| `title` | `string` | Yes | min(1), max(255) |
| `description` | `string` | No | max(1000) |
| `call_type` | `enum` | No | `'voice'` \| `'video'`, default: `'video'` |
| `screen_share` | `boolean` | No | default: `false` |
| `scheduled_at` | `string` | Yes | min(1), ISO 8601 datetime |
| `duration_minutes` | `number` | No | int, min(5), max(480), default: `30` |
| `recurrence` | `enum` | No | `'none'` \| `'daily'` \| `'weekly'` \| `'biweekly'` \| `'monthly'`, default: `'none'` |
| `recurrence_end` | `string` | No | ISO 8601 datetime |
| `participant_ids` | `string[]` | No | Array of user UUIDs |

### Update Scheduled Call (PUT `/scheduled-calls/:id`)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | No | min(1), max(255) |
| `description` | `string` | No | max(1000) |
| `call_type` | `enum` | No | `'voice'` \| `'video'` |
| `screen_share` | `boolean` | No | — |
| `scheduled_at` | `string` | No | ISO 8601 datetime |
| `duration_minutes` | `number` | No | int, min(5), max(480) |
| `recurrence` | `enum` | No | `'none'` \| `'daily'` \| `'weekly'` \| `'biweekly'` \| `'monthly'` |
| `recurrence_end` | `string\|null` | No | nullable |

### RSVP (POST `/scheduled-calls/:id/rsvp`)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `rsvp` | `enum` | Yes | `'accepted'` \| `'declined'` |

### Add Participants (POST `/scheduled-calls/:id/participants`)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `user_ids` | `string[]` | Yes | min(1), array of user UUIDs |

---

## API Response Schemas

### Scheduled Call Object (from list/detail endpoints)

```json
{
  "id": 1,
  "conversation_id": 5,
  "created_by": "user-uuid",
  "title": "Sprint Planning",
  "description": "Review sprint goals and blockers",
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
  "creator_avatar": null,
  "conversation_name": "Dev Team",
  "conversation_type": "group",
  "my_rsvp": "accepted",
  "participant_count": 4,
  "accepted_count": 3,
  "participants": [
    {
      "user_id": "user-uuid",
      "name": "Admin",
      "email": "admin@softaware.co.za",
      "avatar_url": null,
      "rsvp": "accepted"
    }
  ]
}
```

> **Note**: `participants` array is only included in create (POST) and detail (GET /:id) responses. List (GET) responses include `participant_count` and `accepted_count` aggregates instead.

### Start Response (POST `/:id/start`)

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

---

## Frontend TypeScript Types

### `ScheduledCallParticipant` (from `StaffChatModel.ts`)

```typescript
export interface ScheduledCallParticipant {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  rsvp: 'pending' | 'accepted' | 'declined';
}
```

### `ScheduledCall` (from `StaffChatModel.ts`)

```typescript
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
  scheduled_at: string;          // ISO 8601
  duration_minutes: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  call_session_id: number | null;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  participants: ScheduledCallParticipant[];
  my_rsvp: 'pending' | 'accepted' | 'declined';
}
```

> **Note**: Backend SQL aliases participant fields directly as `name` and `email` (not `user_name` / `user_email`), matching the frontend `ScheduledCallParticipant` interface exactly.

---

## Frontend Component State

### `ScheduleCallDialog`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | `string` | `''` | Call title input |
| `description` | `string` | `''` | Description textarea |
| `callType` | `'voice' \| 'video'` | `'video'` | Call type toggle |
| `screenShare` | `boolean` | `false` | Screen share toggle |
| `scheduledDate` | `string` | tomorrow | Date input (YYYY-MM-DD) |
| `scheduledTime` | `string` | next half-hour | Time input (HH:MM) |
| `durationMinutes` | `number` | `30` | Duration select |
| `recurrence` | `enum` | `'none'` | Recurrence select |
| `recurrenceEnd` | `string` | `''` | End date input |
| `saving` | `boolean` | `false` | Submit loading state |

### `ScheduledCallsPanel`
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `calls` | `ScheduledCall[]` | `[]` | Fetched scheduled calls |
| `loading` | `boolean` | `false` | Loading indicator |
| `filter` | `'upcoming' \| 'all'` | `'upcoming'` | Tab filter |

### `ChatPage` (scheduling additions)
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `showScheduleCall` | `boolean` | `false` | Dialog visibility |
| `showScheduledCalls` | `boolean` | `false` | Panel visibility |
| `editingScheduledCall` | `ScheduledCall \| null` | `null` | Call being edited (null = create mode) |
