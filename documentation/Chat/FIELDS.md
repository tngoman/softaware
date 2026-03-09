# Staff Chat — Field & Data Dictionary

> **Last Updated**: 2026-03-08

---

## Part 1: Database Schema (MySQL)

### `conversations`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `type` | ENUM('direct','group') | No | `'group'` | Conversation type |
| `name` | VARCHAR(100) | Yes | NULL | Group name (NULL for DMs — derived from other member) |
| `description` | VARCHAR(500) | Yes | NULL | Group description |
| `icon_url` | VARCHAR(512) | Yes | NULL | Group icon image URL |
| `created_by` | VARCHAR(36) | No | — | Creator user ID (UUID) |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | DATETIME | Yes | ON UPDATE | Last update timestamp |

**Indexes**: `idx_conv_created_by`, `idx_conv_type`

---

### `conversation_members`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `conversation_id` | BIGINT UNSIGNED | No | — | FK → `conversations.id` CASCADE |
| `user_id` | VARCHAR(36) | No | — | User UUID |
| `role` | ENUM('admin','member') | No | `'member'` | Member role |
| `nickname` | VARCHAR(100) | Yes | NULL | Per-conversation display name |
| `muted_until` | DATETIME | Yes | NULL | Mute expiry (NULL = not muted) |
| `pinned` | TINYINT(1) | No | 0 | Pinned conversation flag |
| `archived` | TINYINT(1) | No | 0 | Archived conversation flag |
| `last_read_message_id` | BIGINT UNSIGNED | Yes | NULL | Last read message ID |
| `joined_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Join timestamp |
| `removed_at` | DATETIME | Yes | NULL | Soft-delete timestamp |
| `cleared_at` | DATETIME | Yes | NULL | "Delete for me" — messages before this are hidden |
| `notification_sound` | VARCHAR(50) | Yes | NULL | Custom notification sound identifier |

**Indexes**: `idx_cm_user (user_id, removed_at)`, `idx_cm_conv (conversation_id, removed_at)`, UNIQUE `idx_cm_conv_user (conversation_id, user_id)`
**FK**: `fk_cm_conv` → `conversations(id)` ON DELETE CASCADE

---

### `messages`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `conversation_id` | BIGINT UNSIGNED | No | — | FK → `conversations.id` CASCADE |
| `sender_id` | VARCHAR(36) | No | — | Sender user UUID |
| `content` | TEXT | Yes | NULL | Message text content |
| `message_type` | ENUM('text','image','video','audio','file','gif','location','contact','system') | No | `'text'` | Content type discriminator |
| `file_url` | VARCHAR(512) | Yes | NULL | Uploaded file path |
| `file_name` | VARCHAR(255) | Yes | NULL | Original filename |
| `file_type` | VARCHAR(100) | Yes | NULL | MIME type |
| `file_size` | BIGINT UNSIGNED | Yes | NULL | File size in bytes |
| `thumbnail_url` | VARCHAR(512) | Yes | NULL | Compressed thumbnail path |
| `link_preview_json` | JSON | Yes | NULL | Cached link preview metadata |
| `reply_to_id` | BIGINT UNSIGNED | Yes | NULL | FK → self (SET NULL) |
| `forwarded_from_id` | BIGINT UNSIGNED | Yes | NULL | FK → self (SET NULL) |
| `edited_at` | DATETIME | Yes | NULL | Edit timestamp |
| `deleted_for_everyone_at` | DATETIME | Yes | NULL | Soft-delete for all |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Message timestamp |

**Indexes**: `idx_msg_conv_date (conversation_id, created_at)`, `idx_msg_sender (sender_id)`, FULLTEXT `ft_msg_content (content)`
**FKs**: `fk_msg_conv` → `conversations(id)` CASCADE, `fk_msg_reply` → self SET NULL, `fk_msg_fwd` → self SET NULL

---

### `message_status`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `message_id` | BIGINT UNSIGNED | No | — | FK → `messages.id` CASCADE |
| `user_id` | VARCHAR(36) | No | — | Recipient user UUID |
| `status` | ENUM('sent','delivered','read') | No | — | Delivery status |
| `timestamp` | DATETIME | No | `CURRENT_TIMESTAMP` | Status change time |

**PK**: Composite `(message_id, user_id)`
**Indexes**: `idx_ms_user_status (user_id, status)`

---

### `message_reactions`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `message_id` | BIGINT UNSIGNED | No | — | FK → `messages.id` CASCADE |
| `user_id` | VARCHAR(36) | No | — | Reactor user UUID |
| `emoji` | VARCHAR(20) | No | — | Emoji character(s) |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Reaction timestamp |

**Unique**: `(message_id, user_id, emoji)`

---

### `starred_messages`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | VARCHAR(36) | No | — | User UUID |
| `message_id` | BIGINT UNSIGNED | No | — | FK → `messages.id` CASCADE |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Star timestamp |

**PK**: Composite `(user_id, message_id)`

---

### `deleted_messages`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | VARCHAR(36) | No | — | User UUID |
| `message_id` | BIGINT UNSIGNED | No | — | FK → `messages.id` CASCADE |
| `deleted_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Deletion timestamp |

**PK**: Composite `(user_id, message_id)`

---

### `user_presence`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `user_id` | VARCHAR(36) | No | — | PK — User UUID |
| `status` | ENUM('online','away','offline') | No | `'offline'` | Current status |
| `last_seen_at` | DATETIME | Yes | NULL | Last activity timestamp |
| `socket_ids` | JSON | Yes | NULL | Active socket connection IDs |
| `dnd_enabled` | TINYINT(1) | No | 0 | Do Not Disturb enabled |
| `dnd_start` | TIME | Yes | NULL | DND start time (e.g., `22:00:00`) |
| `dnd_end` | TIME | Yes | NULL | DND end time (e.g., `07:00:00`) |

---

### `call_sessions`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `conversation_id` | BIGINT UNSIGNED | No | — | FK → `conversations.id` |
| `call_type` | ENUM('voice','video') | No | — | Call type |
| `initiated_by` | VARCHAR(36) | No | — | Caller user UUID |
| `status` | ENUM('ringing','active','ended','missed','declined') | No | `'ringing'` | Call state |
| `started_at` | DATETIME | Yes | NULL | When call became active |
| `ended_at` | DATETIME | Yes | NULL | When call ended |
| `duration_seconds` | INT UNSIGNED | Yes | NULL | Computed duration |

---

### `call_participants`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `call_id` | BIGINT UNSIGNED | No | — | FK → `call_sessions.id` |
| `user_id` | VARCHAR(36) | No | — | Participant user UUID |
| `joined_at` | DATETIME | Yes | NULL | When participant joined |
| `left_at` | DATETIME | Yes | NULL | When participant left |
| `muted` | TINYINT(1) | No | 0 | Audio muted |
| `camera_off` | TINYINT(1) | No | 0 | Camera disabled |

---

### `webauthn_credentials`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(255) | No | — | PK — credential ID from browser |
| `user_id` | VARCHAR(36) | No | — | Owner user UUID |
| `public_key` | TEXT | No | — | Stored public key / attestation |
| `counter` | INT UNSIGNED | No | 0 | Signature counter |
| `device_type` | VARCHAR(50) | Yes | NULL | e.g., `platform` |
| `backed_up` | TINYINT(1) | No | 0 | Credential backed up flag |
| `transports` | JSON | Yes | NULL | Supported transports array |
| `friendly_name` | VARCHAR(100) | Yes | `'Passkey'` | User-assigned name |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Registration timestamp |
| `last_used_at` | DATETIME | Yes | NULL | Last authentication timestamp |

---

### `user_sessions`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | No | — | PK — UUID |
| `user_id` | VARCHAR(36) | No | — | Owner user UUID |
| `token_hash` | VARCHAR(64) | No | — | SHA-256 hash of JWT |
| `device_info` | VARCHAR(100) | Yes | NULL | Parsed device description |
| `ip_address` | VARCHAR(45) | Yes | NULL | Login IP address |
| `user_agent` | VARCHAR(500) | Yes | NULL | Raw User-Agent header |
| `last_active_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Last activity |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Session creation |
| `expires_at` | DATETIME | No | — | JWT expiration timestamp |
| `revoked_at` | DATETIME | Yes | NULL | Session revocation timestamp |

---

### `scheduled_calls`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `conversation_id` | BIGINT UNSIGNED | No | — | FK → `conversations.id` |
| `created_by` | VARCHAR(36) | No | — | Creator user UUID |
| `title` | VARCHAR(255) | No | — | Meeting title |
| `description` | TEXT | Yes | NULL | Meeting description |
| `call_type` | ENUM('voice','video') | No | `'video'` | Call type |
| `screen_share` | TINYINT(1) | No | 0 | Screen share enabled |
| `scheduled_at` | DATETIME | No | — | Scheduled start time |
| `duration_minutes` | INT UNSIGNED | No | 30 | Expected duration |
| `recurrence` | ENUM('none','daily','weekly','biweekly','monthly') | No | `'none'` | Recurrence pattern |
| `recurrence_end` | DATETIME | Yes | NULL | Recurrence end date |
| `status` | ENUM('scheduled','active','completed','cancelled') | No | `'scheduled'` | Call state |
| `call_session_id` | BIGINT UNSIGNED | Yes | NULL | FK → `call_sessions.id` (when started) |
| `reminder_sent` | TINYINT(1) | No | 0 | Whether reminder was sent |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | DATETIME | No | `CURRENT_TIMESTAMP` ON UPDATE | Last update |

**Indexes**: `idx_sc_conv (conversation_id)`, `idx_sc_creator (created_by)`, `idx_sc_scheduled (scheduled_at)`, `idx_sc_status (status)`

---

### `scheduled_call_participants`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | BIGINT UNSIGNED | No | AUTO_INCREMENT | Primary key |
| `scheduled_call_id` | BIGINT UNSIGNED | No | — | FK → `scheduled_calls.id` CASCADE |
| `user_id` | VARCHAR(36) | No | — | Participant user UUID |
| `rsvp` | ENUM('pending','accepted','declined') | No | `'pending'` | RSVP status |
| `created_at` | DATETIME | No | `CURRENT_TIMESTAMP` | Invite timestamp |

**Indexes**: `idx_scp_call (scheduled_call_id)`, `idx_scp_user (user_id)`

---

## Part 2: Key TypeScript Interfaces (Frontend)

### `Conversation` (StaffChatModel.ts)

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Conversation primary key |
| `type` | `'direct' \| 'group'` | Conversation type |
| `name` | string \| null | Group name (null for DMs) |
| `description` | string \| null | Group description |
| `icon_url` | string \| null | Group icon URL |
| `created_by` | string | Creator user UUID |
| `created_at` | string | ISO timestamp |
| `updated_at` | string \| null | ISO timestamp |
| `pinned` | boolean | Is pinned |
| `archived` | boolean | Is archived |
| `muted_until` | string \| null | Mute expiry ISO timestamp |
| `last_read_message_id` | number \| null | Last read message |
| `last_message_id` | number \| null | Latest message ID |
| `last_message_content` | string \| null | Latest message preview |
| `last_message_type` | string \| null | Latest message type |
| `last_message_at` | string \| null | Latest message ISO timestamp |
| `last_message_sender_id` | string \| null | Latest message sender |
| `last_message_sender_name` | string \| null | Latest message sender name |
| `unread_count` | number | Server-computed unread count |
| `member_count` | number | Active member count |
| `dm_other_name` | string \| null | DM: other user's display name |
| `dm_other_avatar` | string \| null | DM: other user's avatar URL |
| `dm_other_user_id` | string \| null | DM: other user's UUID |
| `members` | ConversationMember[] \| undefined | Populated in detail view |

### `ConversationMember` (StaffChatModel.ts)

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | string | User UUID |
| `role` | `'admin' \| 'member'` | Member role |
| `nickname` | string \| null | Per-conversation nickname |
| `joined_at` | string | ISO timestamp |
| `name` | string \| null | From users table (single name column) |
| `email` | string | User email |
| `avatar_url` | string \| null | User avatar |
| `display_name` | string | Computed display name |
| `online_status` | `'online' \| 'away' \| 'offline'` | Live presence |

### `Message` (StaffChatModel.ts)

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Message primary key |
| `conversation_id` | number | Parent conversation |
| `sender_id` | string | Sender UUID |
| `sender_name` | string | Sender display name (JOIN) |
| `sender_avatar` | string \| null | Sender avatar URL (JOIN) |
| `content` | string \| null | Message text |
| `message_type` | string | Content type enum |
| `file_url` | string \| null | Uploaded file path |
| `file_name` | string \| null | Original filename |
| `file_type` | string \| null | MIME type |
| `file_size` | number \| null | Bytes |
| `thumbnail_url` | string \| null | Compressed thumbnail |
| `link_preview_json` | object \| null | `{ url, title, description, image, siteName, favicon }` |
| `reply_to_id` | number \| null | Reply target message ID |
| `reply_to_content` | string \| null | Reply target content (JOIN) |
| `reply_to_sender_name` | string \| null | Reply target sender (JOIN) |
| `forwarded_from_id` | number \| null | Forwarded source message |
| `edited_at` | string \| null | Edit ISO timestamp |
| `deleted_for_everyone_at` | string \| null | Soft-delete timestamp |
| `created_at` | string | Message ISO timestamp |
| `status` | string | Aggregated delivery status |
| `reactions` | `{ emoji, count, users }[]` | Reaction summary (subquery) |
| `is_starred` | boolean | Whether current user starred this message |

### `CallHistoryEntry` (StaffChatModel.ts)

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Call session ID (BIGINT AUTO_INCREMENT) |
| `conversation_id` | number | Conversation reference |
| `call_type` | `'voice' \| 'video'` | Call type |
| `status` | string | ringing / active / ended / missed / declined |
| `initiated_by` | string | Caller UUID |
| `started_at` | string \| null | When call became active |
| `ended_at` | string \| null | When call ended |
| `duration_seconds` | number \| null | Call duration |
| `participant_count` | number | Number of participants |
| `conversation_name` | string \| null | Group name |
| `conversation_type` | string | direct / group |
| `other_user_name` | string \| null | DM: other user name |
| `other_user_avatar` | string \| null | DM: other user avatar |

---

## Part 3: Migrations Inventory

| Migration | File | Tables Affected |
|-----------|------|----------------|
| **014** | `014_chat_system.ts` (391 LOC) | Creates: `conversations`, `conversation_members`, `messages`, `message_status`, `message_reactions`, `starred_messages`, `deleted_messages`, `user_presence`, `call_sessions`, `call_participants`. Migrates data from `team_chats` → `conversations`. Adds `avatar_url` to `users` |
| **015** | `015_chat_enhancements.ts` (95 LOC) | Adds columns: `conversation_members.cleared_at`, `conversations.icon_url`, `user_presence.dnd_start/dnd_end/dnd_enabled`, `conversation_members.notification_sound`. Creates: `scheduled_calls`, `scheduled_call_participants` |
| **016** | `016_webauthn_sessions.ts` (73 LOC) | Creates: `webauthn_credentials`, `user_sessions` |
| **017** | `017_drop_old_team_chats.ts` (46 LOC) | Drops: `team_chat_messages`, `team_chat_members`, `team_chats` |
