# Staff Chat — Complete Mobile Wiring Guide

> **Generated from live backend code audit — NOT from stale documentation.**
> Backend: `/var/opt/backend/src/routes/staffChat.ts` (48 REST endpoints)
> Sockets: `/var/opt/backend/src/services/chatSocket.ts` (Socket.IO v4, `/chat` namespace)
> Last verified: 2026-03-08
> **Phase 15 Updates:** Fixed socket lifecycle, WebRTC initiator/acceptor roles, added TURN server, GlobalCallProvider, ringtone
## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication](#2-authentication)
3. [Socket Connection](#3-socket-connection)
4. [Data Models](#4-data-models)
5. [REST API Reference](#5-rest-api-reference)
6. [Socket Events Reference](#6-socket-events-reference)
7. [Feature Wiring Guide](#7-feature-wiring-guide)
8. [Offline & Reconnection](#8-offline--reconnection)
9. [Calling System](#9-calling-system)
10. [Critical Rules & Common Mistakes](#10-critical-rules--common-mistakes)
11. [Testing Checklist](#11-testing-checklist)

---

## 1. Architecture Overview

```
┌──────────────┐       HTTPS (REST)       ┌──────────────────┐
│  Mobile App  │ ◄──────────────────────► │   Express.js     │
│  (React      │       WSS (Socket.IO)    │   Backend        │
│   Native)    │ ◄──────────────────────► │   /chat ns       │
└──────────────┘                          └──────┬───────────┘
                                                 │
                                          ┌──────▼───────────┐
                                          │   MySQL (InnoDB)  │
                                          └──────────────────┘
```

- **REST API** — All CRUD operations: conversations, messages, members, reactions, stars, search, media, calls, etc.
- **Socket.IO** — Real-time only: new messages, edits, deletes, typing, presence, call signaling. The socket NEVER creates data — REST endpoints create data AND emit socket events.
- **All IDs are numbers** — `conversation.id`, `message.id`, `call_sessions.id` are all `BIGINT AUTO_INCREMENT`. **NOT UUIDs.** Only `user.id` is a UUID string.

---

## 2. Authentication

Every REST request and socket connection requires a JWT token.

### Obtaining the Token

```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "success": true, "data": { "token": "eyJ...", "user": { "id": "uuid", ... } } }
```

### Using the Token

**REST:** Send as `Authorization: Bearer <token>` header on every request.

**Socket:** Pass in the `auth` handshake option (see section 3).

The token payload contains `{ userId: string }` — the backend extracts this for all auth checks.

---

## 3. Socket Connection

### Connection Setup

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://your-api-domain.com/chat', {
  auth: { token: '<jwt_token>' },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
```

**Critical details:**
- Namespace is `/chat` (append to server URL)
- Token goes in `auth.token`, NOT in headers
- Use `['websocket', 'polling']` — websocket first, polling fallback
- Enable infinite reconnection — the app should always reconnect

### What Happens on Connect (Server-Side, Automatic)

When your socket connects, the server automatically:
1. **Verifies the JWT** — rejects with `Error('Invalid token')` if invalid
2. **Joins all conversation rooms** — queries `conversation_members` and joins `conv:<id>` for each
3. **Sets presence to online** — upserts `user_presence` table, broadcasts `presence_update` to all shared conversations
4. **Marks pending messages as delivered** — updates `message_status` rows from `'sent'` to `'delivered'`
5. **Activates call listener** — server is now listening for incoming call events

You do NOT need to manually join rooms on initial connect. The server does it for you.

**⚠️ CRITICAL (Phase 15):** The socket now persists across page/conversation changes on the web app. Mobile apps should maintain a single socket connection for the entire session. If you disconnect and reconnect, you'll miss calls and real-time events.

### Lifecycle Events

```typescript
socket.on('connect', () => {
  console.log('Connected to chat');
  // Trigger reconnection sync here (see Section 8)
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Socket.IO auto-reconnects if reconnection: true
});

socket.on('connect_error', (err) => {
  if (err.message === 'Authentication required' || err.message === 'Invalid token') {
    // Token expired — re-authenticate and reconnect
  }
});
```

---

## 4. Data Models

### 4.1 Conversation

Returned by `GET /conversations` and `GET /conversations/:id`.

```typescript
interface Conversation {
  id: number;                    // BIGINT AUTO_INCREMENT
  type: 'direct' | 'group';
  name: string | null;           // null for DMs
  description: string | null;
  icon_url: string | null;
  created_by: string;            // UUID
  created_at: string;            // ISO datetime
  updated_at: string | null;

  // Membership fields (from conversation_members join):
  pinned: 0 | 1;
  archived: 0 | 1;
  muted_until: string | null;    // ISO datetime or null
  last_read_message_id: number | null;

  // Computed fields:
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_sender_name: string | null;
  member_count: number;
  unread_count: number;

  // DM-only fields (populated only when type === 'direct'):
  dm_user_name: string | null;
  dm_user_avatar: string | null;
  dm_user_id: string | null;

  // Detail endpoint only (GET /conversations/:id):
  members?: ConversationMember[];
}
```

### 4.2 ConversationMember

Included in `GET /conversations/:id` response.

```typescript
interface ConversationMember {
  user_id: string;               // UUID
  role: 'admin' | 'member';
  joined_at: string;             // ISO datetime
  name: string | null;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  status: 'online' | 'away' | 'offline';  // from user_presence
  last_seen_at: string | null;
}
```

### 4.3 Message

Returned by `GET /conversations/:id/messages` and `POST /conversations/:id/messages`.

```typescript
interface ChatMessage {
  id: number;                    // BIGINT AUTO_INCREMENT
  conversation_id: number;
  sender_id: string;             // UUID
  content: string | null;        // null for media-only messages
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif' | 'location' | 'contact' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_size: string | null;      // stored as string in DB
  reply_to_id: number | null;
  forwarded_from_id: number | null;
  media_metadata: string | null; // JSON string — parse client-side
  edited_at: string | null;      // ISO datetime, null if never edited
  deleted_at: string | null;
  created_at: string;            // ISO datetime

  // Joined fields:
  sender_name: string;
  sender_avatar: string | null;
  link_preview: object | null;   // parsed from link_preview_json

  // Reply preview (populated when reply_to_id is set):
  reply_to: {
    id: number;
    content: string | null;
    message_type: string;
    file_name: string | null;
    sender_name: string;
  } | null;

  // Aggregated fields:
  status: 'sent' | 'delivered' | 'read';  // minimum status across all recipients
  reactions: Reaction[];                    // array, empty if no reactions
}
```

### 4.4 Reaction

```typescript
interface Reaction {
  emoji: string;
  user_id: string;
  user_name: string;
  created_at: string;
}
```

### 4.5 CallSession

Returned by `GET /calls/history` and `GET /calls/:id`.

```typescript
interface CallSession {
  id: number;                    // BIGINT AUTO_INCREMENT — NOT UUID
  conversation_id: number;
  call_type: 'voice' | 'video';
  initiated_by: string;          // UUID
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  started_at: string;            // ISO datetime — when call was initiated
  ended_at: string | null;
  duration_seconds: number | null;

  // Joined fields (from history endpoint):
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  caller_name: string;
  participant_count: number;

  // DM-only:
  other_user_name: string | null;
  other_user_avatar: string | null;
  other_user_id: string | null;
}
```

### 4.6 ScheduledCall

```typescript
interface ScheduledCall {
  id: number;
  conversation_id: number;
  created_by: string;
  title: string;
  description: string | null;
  call_type: 'voice' | 'video';
  is_recurring: 0 | 1;
  scheduled_at: string;          // ISO datetime
  duration_minutes: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  linked_call_id: number | null;
  created_at: string;
  updated_at: string;

  // Joined:
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  creator_name: string;
  participant_count: number;
  accepted_count: number;

  // DM-only:
  other_user_name: string | null;
  other_user_avatar: string | null;
}
```

---

## 5. REST API Reference

> **Base URL:** `https://your-api-domain.com/api/staff-chat`
> **Auth:** ALL endpoints require `Authorization: Bearer <token>`
> **Content-Type:** `application/json` (except upload which accepts base64 in JSON)

### 5.1 Available Users

#### `GET /users/available`

Returns all staff/admin users who can be added to conversations.

**Response:**
```json
{ "success": true, "data": [{ "id": "uuid", "name": "...", "email": "...", "avatar_url": "..." }] }
```

---

### 5.2 Conversations

#### `GET /conversations`

List all conversations for the authenticated user.

**Query params:** `type` (optional) — `"direct"` or `"group"` to filter.

**Response:**
```json
{
  "success": true,
  "data": [Conversation, ...]  // sorted: pinned first, then by last_message_at desc
}
```

#### `POST /conversations`

Create a new conversation.

**Body:**
```json
{
  "type": "direct" | "group",   // required
  "name": "Team Chat",          // optional, 1-100 chars (required for groups in practice)
  "description": "...",         // optional, max 500 chars
  "member_ids": ["uuid1", "uuid2"]  // required, min 1 member
}
```

**DM dedup:** If `type === "direct"`, the server checks for an existing DM between the two users and returns it instead of creating a duplicate. The creator is automatically added as admin.

**Response (201):**
```json
{ "success": true, "data": Conversation }
```

**Socket event emitted:** `conversation_updated` → `{ id, type: 'created', conversation: Conversation }`

#### `GET /conversations/:id`

Get conversation detail with full member list.

**Response:**
```json
{ "success": true, "data": { ...Conversation, members: [ConversationMember, ...] } }
```

#### `PUT /conversations/:id`

Update group conversation (admin only for groups).

**Body (all optional):**
```json
{
  "name": "New Name",           // 1-100 chars
  "description": "New desc",    // max 500 chars
  "icon_url": "https://..."     // max 512 chars
}
```

**Response:**
```json
{ "success": true, "data": Conversation }
```

**Socket event emitted:** `conversation_updated` → `{ id, name, description, icon_url, updated_at, ... }`

#### `DELETE /conversations/:id`

Delete a group conversation (admin only, cannot delete DMs).

**Response:**
```json
{ "success": true }
```

**Socket event emitted:** `conversation_deleted` → `{ conversation_id: number }`

#### `POST /conversations/:id/clear`

Clear chat history for the authenticated user only. Sets `cleared_at = NOW()` — messages before this time are hidden for this user but still exist for others.

**Response:**
```json
{ "success": true }
```

---

### 5.3 Members

#### `POST /conversations/:id/members`

Add members to a group conversation (admin only).

**Body:**
```json
{ "user_ids": ["uuid1", "uuid2"] }
```

**Response:**
```json
{ "success": true, "data": { "added": 2 } }
```

**Socket event emitted:** `conversation_updated` → `{ id, type: 'members_added', count: 2 }`

#### `DELETE /conversations/:id/members/:userId`

Remove a member or leave a conversation. You can leave yourself, or admins can remove others.

**Response:**
```json
{ "success": true }
```

**Socket event emitted:** `conversation_updated` → `{ id, type: 'member_removed', userId: 'uuid' }`

#### `PATCH /conversations/:id/members/me`

Update your own membership preferences.

**Body (all optional):**
```json
{
  "pinned": true,
  "archived": false,
  "muted_until": "2025-02-01T00:00:00Z",  // or null to unmute
  "nickname": "My Nickname"
}
```

**Response:**
```json
{ "success": true }
```

---

### 5.4 Messages

#### `GET /conversations/:id/messages`

Fetch messages with cursor-based pagination.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `before` | number | null (latest) | Message ID cursor — fetch messages older than this |
| `limit` | number | 50 | Max 100 |

**Response:**
```json
{
  "success": true,
  "data": [ChatMessage, ...]  // chronological order (oldest first)
}
```

**Important:** Messages deleted-for-everyone, deleted-for-me, and before `cleared_at` are excluded.

**Pagination pattern:**
1. First load: `GET /conversations/123/messages` (no `before` — gets latest 50)
2. Load more: `GET /conversations/123/messages?before=<oldest_msg_id>&limit=50`
3. Stop when response has fewer items than `limit`

#### `POST /conversations/:id/messages`

Send a new message.

**Body:**
```json
{
  "content": "Hello!",                          // max 5000 chars, optional if file_url present
  "message_type": "text",                       // default "text"
  "file_url": "https://...",                    // max 512 chars, optional
  "file_name": "photo.jpg",                    // max 255 chars, optional
  "file_size": "1024",                          // max 100 chars, optional
  "reply_to_id": 456,                           // optional, message ID being replied to
  "forwarded_from_id": 789,                     // optional (set by forward endpoint)
  "media_metadata": "{\"width\":800,\"height\":600}"  // optional JSON string
}
```

**Response (201):**
```json
{ "success": true, "data": ChatMessage }
```

**Socket event emitted:** `new_message` → `{ ...ChatMessage, conversation_id: number }`

**Side effects:**
- Push notifications sent to offline members (respects mute/DND, overrides on @mention)
- Link preview generated asynchronously for text messages

#### `PUT /conversations/:id/messages/:msgId`

Edit a message. Sender only, within 15 minutes of creation.

**Body:**
```json
{ "content": "Updated text" }  // 1-5000 chars, required
```

**Response:**
```json
{ "success": true, "data": { "id": 123, "content": "Updated text", "edited_at": "..." } }
```

**Socket event emitted:** `message_edited` → `{ message_id: number, content: string, edited_at: string }`

#### `DELETE /conversations/:id/messages/:msgId`

Delete a message.

**Query params:** `for` — `"me"` (default) or `"everyone"` (sender only, within 5 min)

**Response:**
```json
{ "success": true }
```

**Socket event emitted (only for `everyone`):** `message_deleted` → `{ message_id: number, deleted_for_everyone: true }`

#### `POST /messages/:msgId/forward`

Forward a message to one or more conversations.

**Body:**
```json
{ "conversation_ids": [10, 20, 30] }  // min 1
```

**Response:**
```json
{ "success": true, "data": { "forwarded_to": 3 } }
```

**Socket event emitted:** `new_message` in each target conversation.

---

### 5.5 Reactions

#### `POST /messages/:msgId/reactions`

Toggle a reaction. If the same user+emoji exists, it's removed; otherwise added.

**Body:**
```json
{ "emoji": "👍" }  // 1-20 chars
```

**Response:**
```json
{ "success": true, "data": [Reaction, ...] }  // updated full reaction list
```

**Socket event emitted:** `reaction_update` → `{ message_id: number, reactions: Reaction[] }`

#### `GET /messages/:msgId/reactions`

Get all reactions on a message.

**Response:**
```json
{ "success": true, "data": [Reaction, ...] }
```

---

### 5.6 Stars

#### `POST /messages/:msgId/star`

Toggle star on a message. If already starred, unstars it.

**Response:**
```json
{ "success": true, "starred": true }  // or false if unstarred
```

#### `GET /starred-messages`

Get all starred messages for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [{
    "message_id": 123,
    "starred_at": "...",
    "content": "...",
    "message_type": "text",
    "sender_name": "...",
    "conversation_id": 456,
    "conversation_name": "..."
  }]
}
```

---

### 5.7 Read Receipts

#### `POST /conversations/:id/read`

Mark messages as read up to a specific message ID.

**Body:**
```json
{ "message_id": 999 }  // required, the last message ID the user has seen
```

**Response:**
```json
{ "success": true }
```

**Socket event emitted:** `message_status` → `{ message_id: number, status: 'read' }` for each distinct sender's message up to the read point.

---

### 5.8 Search

#### `GET /search`

Global search across all user's conversations.

**Query params:**
| Param | Type | Required |
|---|---|---|
| `q` | string | ✅ |
| `limit` | number | default 20, max 50 |

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": 123,
    "content": "...",
    "message_type": "text",
    "sender_name": "...",
    "created_at": "...",
    "conversation_id": 456,
    "conversation_name": "..."
  }]
}
```

#### `GET /conversations/:id/search`

Search within a specific conversation.

**Query params:** `q` (required string)

**Response:** Same shape as global search, limited to 50 results.

---

### 5.9 Media Gallery

#### `GET /conversations/:id/media`

Get media items from a conversation.

**Query params:**
| Param | Type | Default |
|---|---|---|
| `type` | `"images"` \| `"videos"` \| `"docs"` \| `"links"` | `"images"` |
| `page` | number | 1 |

Page size is fixed at 30.

**Response:**
```json
{ "success": true, "data": [ChatMessage, ...] }
```

---

### 5.10 File Upload

#### `POST /conversations/:id/upload`

Upload a file for a conversation. Send the file as base64 in JSON (NOT multipart form).

**Body:**
```json
{
  "fileName": "photo.jpg",           // required
  "fileType": "image/jpeg",          // optional MIME type
  "fileData": "base64encodedstring"  // required (with or without data:...;base64, prefix)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://your-domain.com/uploads/chat/file.jpg",
    "fileName": "photo.jpg",
    "fileType": "image/jpeg",
    "fileSize": 12345,
    "metadata": {                    // varies by type
      "width": 800,                  // images
      "height": 600,
      "thumbnailUrl": "https://...", // images and videos
      "duration": 120,               // audio files (seconds)
      "thumbnailWidth": 200,
      "thumbnailHeight": 150
    }
  }
}
```

**Workflow for sending media messages:**
1. Upload the file → get `url` and `metadata`
2. Send a message with `file_url`, `file_name`, `file_size`, `message_type`, and `media_metadata`

---

### 5.11 Profile

#### `GET /users/:id/profile`

Get a user's profile. Returns shared groups between you and the target user.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "...",
    "email": "...",
    "avatar_url": "...",
    "job_title": "...",
    "department": "...",
    "status": "online" | "offline",
    "last_seen_at": "...",
    "shared_groups": [{ "id": 1, "name": "Team Chat" }]
  }
}
```

#### `POST /profile/avatar`

Update your chat avatar.

**Body:**
```json
{
  "image": "base64encodedstring",
  "fileName": "avatar.png"          // optional, defaults to .png
}
```

**Response:**
```json
{ "success": true, "data": { "avatar_url": "https://..." } }
```

---

### 5.12 Sync (Reconnection Catch-Up)

#### `GET /sync`

Fetch changes since a timestamp. Used after socket reconnection to catch up on missed events.

**Query params:** `since` (required, ISO datetime string)

**Response:**
```json
{
  "success": true,
  "data": {
    "new_messages": [ChatMessage, ...],        // max 500
    "edited_messages": [{
      "id": 123,
      "conversation_id": 456,
      "content": "updated text",
      "edited_at": "..."
    }],
    "deleted_message_ids": [789, 790],
    "status_updates": [{
      "message_id": 123,
      "status": "read",
      "timestamp": "..."
    }]
  }
}
```

---

### 5.13 DND (Do Not Disturb)

#### `GET /dnd`

**Response:**
```json
{
  "success": true,
  "data": {
    "dnd_enabled": true,
    "dnd_start": "22:00",   // HH:MM or null
    "dnd_end": "07:00"      // HH:MM or null
  }
}
```

#### `PUT /dnd`

**Body:**
```json
{
  "dnd_enabled": true,
  "dnd_start": "22:00",     // HH:MM or null
  "dnd_end": "07:00"        // HH:MM or null
}
```

---

### 5.14 Notification Sound

#### `PUT /conversations/:id/notification-sound`

Set a custom notification sound for a conversation.

**Body:**
```json
{ "sound": "chime" }  // string, required
```

---

### 5.15 GIFs

#### `GET /gifs`

Search or browse trending GIFs (proxies Tenor API).

**Query params:**
| Param | Type | Default |
|---|---|---|
| `q` | string | empty (returns trending) |
| `limit` | number | 20, max 50 |

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": "...",
    "title": "...",
    "url": "...",
    "preview_url": "...",
    "width": 400,
    "height": 300
  }]
}
```

**To send a GIF:** Send a message with `message_type: "gif"` and `file_url` set to the GIF URL.

---

### 5.16 Link Preview

#### `GET /link-preview`

**Query params:** `url` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "...",
    "description": "...",
    "image": "https://...",
    "url": "https://..."
  }
}
```

---

### 5.17 Reporting

#### `POST /messages/:msgId/report`

Report a message.

**Body:**
```json
{ "reason": "Inappropriate content" }  // 1-1000 chars, required
```

**Response:**
```json
{ "success": true }
```

---

### 5.18 Calls

> See also: [MOBILE_CHAT_CALLING_GUIDE.md](./MOBILE_CHAT_CALLING_GUIDE.md) for full WebRTC wiring.

#### `GET /calls/ice-config`

Get TURN/STUN server configuration for WebRTC. Call this **once at app startup** and cache the result.

**Response:**
```json
{
  "success": true,
  "data": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      { "urls": "stun:stun1.l.google.com:19302" },
      { "urls": "turn:softaware.net.za:3478?transport=udp", "username": "softaware", "credential": "S0ftAware2026!Turn" },
      { "urls": "turn:softaware.net.za:3478?transport=tcp", "username": "softaware", "credential": "S0ftAware2026!Turn" }
    ]
  }
}
```

**Phase 15 Note:** TURN server is now configured for NAT traversal. Clients behind firewalls will automatically relay through `turn:softaware.net.za:3478` (UDP+TCP). STUN is tried first for direct P2P.

#### `POST /calls/initiate`

Start a new call. Server creates the `call_sessions` row and `call_participants` rows.

**Body:**
```json
{
  "conversationId": 123,
  "callType": "voice" | "video"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "callId": 456,         // BIGINT AUTO_INCREMENT — use this number everywhere
    "conversationId": 123,
    "callType": "voice"
  }
}
```

**Side effects:**
- Push notifications sent to offline members
- 45-second timeout: if no one accepts, call auto-marked as `missed` and `call-missed` emitted

**⚠️ CRITICAL:** The `callId` is a number generated by the server. Do NOT generate your own ID. Do NOT send a `call_id` in the request body.

#### `POST /calls/:id/accept`

Accept an incoming call.

**Response:**
```json
{ "success": true }
```

#### `GET /calls/history`

Get call history for the authenticated user.

**Query params:** `limit` (default 50, max 100), `offset` (default 0)

**Response:**
```json
{ "success": true, "data": [CallSession, ...] }
```

#### `GET /calls/:id`

Get details of a specific call.

**Response:**
```json
{
  "success": true,
  "data": {
    ...CallSession,
    "participants": [{
      "user_id": "uuid",
      "name": "...",
      "joined_at": "...",
      "left_at": "...",
      "muted": 0,
      "camera_off": 0
    }]
  }
}
```

#### `POST /calls/:id/end`

End a call.

**Response:**
```json
{ "success": true }
```

**Socket event emitted:** `call-ended` → `{ callId, conversationId, endedBy, durationSeconds }`

---

### 5.19 Scheduled Calls

#### `POST /scheduled-calls`

Create a scheduled call.

**Body:**
```json
{
  "conversation_id": 123,
  "title": "Weekly Standup",
  "description": "Team sync",              // optional
  "call_type": "video",                     // default "video"
  "is_recurring": false,
  "scheduled_at": "2025-02-01T10:00:00Z",  // ISO datetime, required
  "duration_minutes": 30,                    // 5-480, default 30
  "recurrence": "weekly",                   // default "none"
  "recurrence_end": "2025-06-01T00:00:00Z", // optional
  "participant_ids": ["uuid1", "uuid2"]     // optional, defaults to all conv members
}
```

**Response (201):**
```json
{ "success": true, "data": ScheduledCall }
```

#### `GET /scheduled-calls`

List scheduled calls.

**Query params:** `status`, `limit` (max 100), `offset`, `conversation_id` (optional filter)

#### `GET /scheduled-calls/:id`

Get a specific scheduled call.

#### `PUT /scheduled-calls/:id`

Update (creator only, status must be `scheduled`). All body fields optional — same fields as create.

#### `DELETE /scheduled-calls/:id`

Cancel (creator only, status must be `scheduled`).

#### `POST /scheduled-calls/:id/rsvp`

RSVP to a scheduled call.

**Body:**
```json
{ "response": "accepted" | "declined" }
```

#### `POST /scheduled-calls/:id/start`

Start a scheduled call. Creates a real `call_sessions` entry and triggers ringing.

#### `POST /scheduled-calls/:id/participants`

Add participants (creator only).

**Body:**
```json
{ "user_ids": ["uuid1", "uuid2"] }
```

#### `DELETE /scheduled-calls/:id/participants/:userId`

Remove a participant (creator only, cannot remove self).

---

## 6. Socket Events Reference

### 6.1 Client → Server Events (You Emit)

| Event Name | Payload | Description |
|---|---|---|
| `typing` | `{ conversationId: number }` | User started typing |
| `stop-typing` | `{ conversationId: number }` | User stopped typing |
| `join-conversation` | `{ conversationId: number }` | Join a conversation room (for new convos mid-session) |
| `leave-conversation` | `{ conversationId: number }` | Leave a conversation room |
| `call-initiate` | `{ conversationId: number, callType: 'voice'\|'video', callId: number }` | Start call signaling |
| `call-accept` | `{ callId: number, conversationId: number }` | Accept incoming call |
| `call-decline` | `{ callId: number, conversationId: number, reason?: 'declined'\|'busy' }` | Decline call |
| `call-end` | `{ callId: number, conversationId: number }` | End active call |
| `call-participant-update` | `{ callId: number, conversationId: number, muted?: boolean, cameraOff?: boolean }` | Toggle mute/camera |
| `webrtc-offer` | `{ callId: number, conversationId: number, targetUserId: string, sdp: RTCSessionDescriptionInit }` | SDP offer |
| `webrtc-answer` | `{ callId: number, conversationId: number, targetUserId: string, sdp: RTCSessionDescriptionInit }` | SDP answer |
| `webrtc-ice-candidate` | `{ callId: number, conversationId: number, targetUserId: string, candidate: RTCIceCandidateInit }` | ICE candidate |

### 6.2 Server → Client Events (You Listen For)

#### Core Messaging Events

| Event Name | Payload | When Emitted |
|---|---|---|
| `new_message` | `{ ...ChatMessage, conversation_id: number }` | A new message was sent (via REST POST) |
| `message_edited` | `{ message_id: number, content: string, edited_at: string }` | A message was edited |
| `message_deleted` | `{ message_id: number, deleted_for_everyone: boolean }` | A message was deleted for everyone |
| `message_status` | `{ message_id: number, status: 'delivered' \| 'read' }` | A message's delivery/read status changed |
| `reaction_update` | `{ message_id: number, reactions: Reaction[] }` | Reactions on a message changed |

#### Conversation Events

| Event Name | Payload | When Emitted |
|---|---|---|
| `conversation_updated` | `{ id: number, ...changes }` | Conversation metadata or members changed |
| `conversation_deleted` | `{ conversation_id: number }` | A conversation was deleted |

#### Presence & Typing Events

| Event Name | Payload | When Emitted |
|---|---|---|
| `user_typing` | `{ conversation_id: number, user_id: string, user_name: string }` | Someone is typing in a conversation |
| `user_stop_typing` | `{ conversation_id: number, user_id: string, user_name: string }` | Someone stopped typing |
| `presence_update` | `{ user_id: string, status: 'online' \| 'offline' }` | A user came online or went offline |

#### Call Events

| Event Name | Payload | When Emitted |
|---|---|---|
| `call-ringing` | `{ callId: number, conversationId: number, callType: string, callerId: string, callerName: string }` | Incoming call notification |
| `call-accepted` | `{ callId: number, conversationId: number, userId: string }` | Someone accepted the call |
| `call-declined` | `{ callId: number, conversationId: number, userId: string, reason: string }` | Someone declined |
| `call-ended` | `{ callId: number, conversationId: number, endedBy: string, durationSeconds: number }` | Call ended |
| `call-missed` | `{ callId: number, conversationId: number }` | Call timed out (45s) with no answer |
| `call-participant-updated` | `{ callId: number, conversationId: number, userId: string, muted?: boolean, cameraOff?: boolean }` | Participant toggled mute/camera |
| `webrtc-offer` | `{ callId, conversationId, fromUserId, targetUserId, sdp }` | SDP offer relayed |
| `webrtc-answer` | `{ callId, conversationId, fromUserId, targetUserId, sdp }` | SDP answer relayed |
| `webrtc-ice-candidate` | `{ callId, conversationId, fromUserId, targetUserId, candidate }` | ICE candidate relayed |
| `scheduled-call` | `{ type: string, conversationId: number, ...data }` | Scheduled call event (created/updated/cancelled/reminder/started) |

---

## 7. Feature Wiring Guide

### 7.1 Conversation List Screen

**On mount:**
```
1. GET /conversations → populate list
2. Socket is already connected (connect on app launch)
```

**Real-time updates:**
```typescript
socket.on('new_message', (msg) => {
  // Update the conversation in the list:
  // - Set last_message_content = msg.content
  // - Set last_message_type = msg.message_type
  // - Set last_message_at = msg.created_at
  // - If NOT the currently open conversation, increment unread_count
  // - Re-sort: pinned first, then by last_message_at desc
});

socket.on('conversation_updated', (data) => {
  // data has { id, ...changes }
  // If data.type === 'created' → add new conversation (data.conversation)
  // If data.type === 'members_added' or 'member_removed' → refresh member count
  // Otherwise → merge changes into existing conversation
});

socket.on('conversation_deleted', (data) => {
  // Remove conversation with id === data.conversation_id from list
  // If currently viewing this conversation, navigate back
});

socket.on('presence_update', (data) => {
  // Update online indicator for DM conversations where dm_user_id === data.user_id
});

socket.on('user_typing', (data) => {
  // Show typing indicator under conversation where id === data.conversation_id
  // Auto-clear after 3 seconds if no new typing event
});

socket.on('user_stop_typing', (data) => {
  // Clear typing indicator for data.conversation_id
});
```

### 7.2 Chat / Messages Screen

**On mount (when user taps a conversation):**
```
1. JOIN the room: socket.emit('join-conversation', { conversationId: convId })
   (Server auto-joins on connect, but this handles mid-session navigation)
2. GET /conversations/:id/messages → populate message list
3. POST /conversations/:id/read { message_id: <last_msg_id> } → mark as read
```

**On unmount:**
```
socket.emit('leave-conversation', { conversationId: convId })
```

**Sending a message:**
```
POST /conversations/:id/messages { content: "Hello", message_type: "text" }
→ Server responds with the full ChatMessage AND emits new_message to the room
→ The sender ALSO receives the new_message socket event
→ Deduplicate: check if message ID already exists before adding to list
```

**Sending media:**
```
1. POST /conversations/:id/upload { fileName, fileType, fileData (base64) }
   → Returns { url, fileName, fileSize, metadata }
2. POST /conversations/:id/messages {
     content: null,  // or caption text
     message_type: "image",  // or "video", "audio", "file"
     file_url: url,
     file_name: fileName,
     file_size: String(fileSize),
     media_metadata: JSON.stringify(metadata)
   }
```

**Real-time updates:**
```typescript
socket.on('new_message', (msg) => {
  if (msg.conversation_id === currentConversationId) {
    // Add to message list (deduplicate by msg.id)
    // Auto-scroll if near bottom
    // Mark read: POST /conversations/:id/read { message_id: msg.id }
  }
});

socket.on('message_edited', (data) => {
  // Find message by data.message_id, update content and edited_at
});

socket.on('message_deleted', (data) => {
  // Remove message with id === data.message_id from list
});

socket.on('message_status', (data) => {
  // Find message by data.message_id, update status to data.status
  // This updates the delivery ticks (✓ sent, ✓✓ delivered, blue ✓✓ read)
});

socket.on('reaction_update', (data) => {
  // Find message by data.message_id, replace reactions array
});
```

**Typing indicators:**
```typescript
// When user types:
let typingTimeout: NodeJS.Timeout;
function onTextChange() {
  socket.emit('typing', { conversationId: currentConvId });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop-typing', { conversationId: currentConvId });
  }, 2000);
}

// When user sends or clears input:
socket.emit('stop-typing', { conversationId: currentConvId });
```

### 7.3 Message Actions

**Edit:**
```
PUT /conversations/:convId/messages/:msgId { content: "Updated text" }
→ Socket emits message_edited to room
```

**Delete for me:**
```
DELETE /conversations/:convId/messages/:msgId?for=me
→ No socket event (only affects requesting user)
→ Remove from local list
```

**Delete for everyone:**
```
DELETE /conversations/:convId/messages/:msgId?for=everyone
→ Socket emits message_deleted to room
```

**Forward:**
```
POST /messages/:msgId/forward { conversation_ids: [10, 20] }
→ Socket emits new_message in each target conversation
```

**React:**
```
POST /messages/:msgId/reactions { emoji: "👍" }
→ Socket emits reaction_update to room
→ Toggle: same user+emoji again removes the reaction
```

**Star/Unstar:**
```
POST /messages/:msgId/star
→ Toggle: returns { starred: true/false }
→ No socket event (personal action)
```

**Reply:**
```
POST /conversations/:convId/messages {
  content: "My reply",
  reply_to_id: 456  // the message being replied to
}
→ Response includes reply_to preview object
```

### 7.4 Presence

Presence is fully automatic:
- **Online:** Set automatically when socket connects
- **Offline:** Set automatically when last socket disconnects
- **Listen:** `presence_update` events give `{ user_id, status }`
- **Display:** Maintain a `Set<string>` of online user IDs, show green dot on avatars

### 7.5 Search

```
// Global search:
GET /search?q=keyword&limit=20

// Search within conversation:
GET /conversations/:id/search?q=keyword
```

Results include `conversation_id` so you can navigate to the message.

### 7.6 Media Gallery

```
GET /conversations/:id/media?type=images&page=1
GET /conversations/:id/media?type=videos&page=1
GET /conversations/:id/media?type=docs&page=1
GET /conversations/:id/media?type=links&page=1
```

Page size is 30. Paginate by incrementing `page`.

---

## 8. Offline & Reconnection

### Strategy

1. **Track last sync time** — store `new Date().toISOString()` whenever you process a socket event
2. **On reconnect**, call the sync endpoint to catch up:

```typescript
socket.on('connect', () => {
  const lastSync = getLastSyncTimestamp(); // from AsyncStorage/SecureStore
  if (lastSync) {
    fetch(`/api/staff-chat/sync?since=${lastSync}`)
      .then(res => res.json())
      .then(data => {
        // Apply new_messages (deduplicate by ID)
        // Apply edited_messages (update content/edited_at)
        // Apply deleted_message_ids (remove from list)
        // Apply status_updates (update delivery ticks)
      });
  }
  updateLastSyncTimestamp(new Date().toISOString());
});
```

### What Sync Returns

| Field | Description |
|---|---|
| `new_messages` | Messages created since `since` (max 500) |
| `edited_messages` | Messages edited since `since` (id, conversation_id, content, edited_at) |
| `deleted_message_ids` | IDs of messages deleted-for-everyone since `since` |
| `status_updates` | Status changes since `since` (message_id, status, timestamp) |

### Presence on Reconnect

The server automatically re-sets your presence to `online` when you reconnect. No manual action needed.

### Message Delivery

When your socket connects, the server automatically marks all pending `sent` messages as `delivered`. This is server-side — you don't need to do anything.

---

## 9. Calling System

> **Full WebRTC wiring details:** See [MOBILE_CHAT_CALLING_GUIDE.md](./MOBILE_CHAT_CALLING_GUIDE.md)

### Call Signaling Events (Phase 15 - Corrected)

**These are the socket events you must handle:**

```typescript
// Incoming call notifications
socket.on('call-ringing', (data: {
  callId: number;
  conversationId: number;
  callType: 'voice' | 'video';
  callerId: string;        // caller's user UUID
  callerName: string;
}) => {
  // Show incoming call UI with caller info
  // Play ringtone
  // Auto-dismiss after 45 seconds (server will mark as missed)
});

socket.on('call-accepted', (data: {
  callId: number;
  conversationId: number;
  userId: string;          // the acceptor's UUID
}) => {
  // Your outgoing call was accepted
  // Acceptor will send WebRTC offer — wait for it
  // Create RTCPeerConnection as NON-INITIATOR (wait for offer)
});

socket.on('call-declined', (data: {
  callId: number;
  conversationId: number;
  userId: string;
  reason: 'declined' | 'busy';
}) => {
  // Call was rejected
  // Clear call UI
});

socket.on('call-ended', (data: {
  callId: number;
  conversationId: number;
  endedBy: string;
  durationSeconds: number;
}) => {
  // Call ended (by any participant)
  // Close RTCPeerConnection
  // Show call duration
});

socket.on('call-missed', (data: { callId: number; conversationId: number }) => {
  // Incoming call was not answered (45s timeout)
  // Clear call UI
});

// WebRTC Peer Connection Setup (Phase 15 - NEW ROLES)
socket.on('webrtc-offer', (data: {
  callId: number;
  conversationId: number;
  fromUserId: string;     // sender
  targetUserId: string;   // recipient (you?)
  sdp: RTCSessionDescriptionInit;
}) => {
  if (data.targetUserId !== myUserId) return; // not for me
  
  // You are the NON-INITIATOR
  // This is the SDP offer from the acceptor
  // Create answer and send back via webrtc-answer
  const pc = new RTCPeerConnection({ iceServers: cachedIceServers });
  // Add local tracks...
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await pc.createAnswer();
  pc.setLocalDescription(answer);
  
  // Send answer back
  socket.emit('webrtc-answer', {
    callId: data.callId,
    conversationId: data.conversationId,
    targetUserId: data.fromUserId,
    sdp: pc.localDescription
  });
});

socket.on('webrtc-answer', (data: {
  callId: number;
  conversationId: number;
  fromUserId: string;
  targetUserId: string;
  sdp: RTCSessionDescriptionInit;
}) => {
  if (data.targetUserId !== myUserId) return; // not for me
  
  // You sent the offer (you're the initiator)
  // This is the answer from the other side
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
});

socket.on('webrtc-ice-candidate', (data: {
  callId: number;
  conversationId: number;
  fromUserId: string;
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}) => {
  if (data.targetUserId !== myUserId) return; // not for me
  
  // Add ICE candidate from other side
  if (data.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

socket.on('call-participant-updated', (data: {
  callId: number;
  conversationId: number;
  userId: string;
  muted?: boolean;
  cameraOff?: boolean;
}) => {
  // Participant toggled mute/camera
  // Update UI to show muted/camera-off icons
});
```

### Quick Reference

**Outgoing call flow:**
```
1. POST /calls/initiate { conversationId, callType }
   → Returns { callId: number }
2. socket.emit('call-initiate', { callId, conversationId, callType })
3. Listen for 'call-accepted' from recipient
4. WAIT for 'webrtc-offer' from acceptor (you are non-initiator)
5. Create RTCPeerConnection, send 'webrtc-answer'
6. Exchange 'webrtc-ice-candidate' events
7. P2P connection established
```

**Incoming call flow:**
```
1. Receive 'call-ringing' event → show incoming call UI
2. User taps Accept
3. POST /calls/:id/accept
4. socket.emit('call-accept', { callId, conversationId })
5. Create RTCPeerConnection as INITIATOR (you send offer)
6. socket.emit('webrtc-offer', { ..., targetUserId, sdp })
7. Listen for 'webrtc-answer' from caller
8. Exchange 'webrtc-ice-candidate' events
9. P2P connection established
```

### WebRTC Initiator/Acceptor Roles (Phase 15 CRITICAL)

**ACCEPTOR sends the SDP offer (initiator=true):**
```typescript
// When accepting a call, you are the INITIATOR
const pc = new RTCPeerConnection({ iceServers });
pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('webrtc-ice-candidate', {
      callId, conversationId, targetUserId: callerId, candidate: event.candidate
    });
  }
};

// Add your local tracks (getUserMedia)
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Create and send offer
const offer = await pc.createOffer();
pc.setLocalDescription(offer);
socket.emit('webrtc-offer', {
  callId, conversationId, targetUserId: callerId, sdp: pc.localDescription
});
```

**CALLER waits for offer (initiator=false):**
```typescript
// When receiving call-accepted event
const pc = new RTCPeerConnection({ iceServers });
pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit('webrtc-ice-candidate', {
      callId, conversationId, targetUserId: acceptorId, candidate: event.candidate
    });
  }
};
pc.ontrack = (event) => {
  // Display remote stream
  setRemoteStream(event.streams[0]);
};

// Add your local tracks
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// Wait for webrtc-offer event, then send answer
socket.on('webrtc-offer', async (data) => {
  if (data.targetUserId !== myUserId) return;
  pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await pc.createAnswer();
  pc.setLocalDescription(answer);
  socket.emit('webrtc-answer', {
    callId: data.callId,
    conversationId: data.conversationId,
    targetUserId: data.fromUserId,
    sdp: pc.localDescription
  });
});
```

### Key Rules (Phase 15 Updated)

- `callId` is always a **number** (BIGINT AUTO_INCREMENT), never a UUID
- Server creates the call — you NEVER generate your own callId
- **ACCEPTOR is the SDP initiator** (sends offer first, creates PC with offer)
- **CALLER is the non-initiator** (waits for offer, creates PC with answer)
- 45-second ringing timeout — server auto-marks as `missed`
- Filter `webrtc-offer`/`webrtc-answer`/`webrtc-ice-candidate` by `targetUserId === myUserId`
- Cache ICE servers at app startup (`GET /calls/ice-config`), reuse for all calls
- **Mobile MUST listen for `call-ringing` on socket** — this is how calls arrive when app is not in foreground

---

## 10. Critical Rules & Common Mistakes

### ❌ DON'T: Use wrong event names

The backend emits these **exact** event names. Using hyphenated or differently named events will silently fail:

```
CORRECT (Chat): new_message, message_edited, message_deleted, message_status,
                 reaction_update, conversation_updated, conversation_deleted,
                 user_typing, user_stop_typing, presence_update

CORRECT (Calls): call-ringing, call-accepted, call-declined, call-ended, call-missed,
                 webrtc-offer, webrtc-answer, webrtc-ice-candidate,
                 call-participant-updated

WRONG:          new-message, message-edited, messageEdited, newMessage, etc.
                (underscore vs hyphen matters!)
```

### ❌ DON'T: Generate your own call ID

```typescript
// WRONG — will not match any DB record
socket.emit('call-initiate', { callId: uuid(), ... });

// CORRECT — use the callId from the REST response
const { data } = await api.post('/calls/initiate', { conversationId, callType });
socket.emit('call-initiate', { callId: data.callId, conversationId, callType });
```

### ❌ DON'T: Send call_id in the initiate request body

```typescript
// WRONG
await api.post('/calls/initiate', { conversationId, callType, call_id: '...' });

// CORRECT — server generates callId
await api.post('/calls/initiate', { conversationId, callType });
```

### ❌ DON'T: Forget to deduplicate messages

The sender receives their own `new_message` event via the socket. Always check:
```typescript
socket.on('new_message', (msg) => {
  if (messages.find(m => m.id === msg.id)) return; // already have it
  addMessage(msg);
});
```

### ❌ DON'T: Forget to filter WebRTC events

All WebRTC events are broadcast to the conversation room. Only process events meant for you:
```typescript
socket.on('webrtc-offer', (data) => {
  if (data.targetUserId !== myUserId) return; // not for me
  // process offer...
});
```

### ❌ DON'T: Wrap typing data in extra nesting

```typescript
// WRONG
socket.emit('typing', { data: { conversationId: 123 } });

// CORRECT
socket.emit('typing', { conversationId: 123 });
```

### ❌ DON'T: Use string IDs for conversations/messages/calls

```typescript
// WRONG — IDs are numbers
GET /conversations/"abc"/messages

// CORRECT
GET /conversations/123/messages
```

Only `user_id` is a UUID string. Everything else is a number.

### ❌ DON'T: Forget to join conversation rooms

The server auto-joins rooms on initial connect, but if a new conversation is created mid-session:
```typescript
socket.on('conversation_updated', (data) => {
  if (data.type === 'created') {
    socket.emit('join-conversation', { conversationId: data.id });
  }
});
```

### ✅ DO: Handle the conversation_updated event's multiple shapes

The `conversation_updated` event carries different payloads depending on what happened:

```typescript
socket.on('conversation_updated', (data) => {
  if (data.type === 'created') {
    // data.conversation contains the full Conversation object
    addConversation(data.conversation);
  } else if (data.type === 'members_added') {
    // data.count tells how many were added
    refreshConversation(data.id);
  } else if (data.type === 'member_removed') {
    // data.userId was removed
    refreshConversation(data.id);
  } else if (data._link_preview) {
    // Link preview generated for a message
    const { messageId, preview } = data._link_preview;
    updateMessageLinkPreview(messageId, preview);
  } else {
    // General metadata update (name, description, etc.)
    mergeConversationChanges(data);
  }
});
```

### ✅ DO: Sort conversations correctly

```
1. Pinned conversations first (pinned = 1)
2. Then by last_message_at descending (newest first)
3. Fall back to created_at if no messages
```

### ✅ DO: Store lastSyncTimestamp persistently

Use AsyncStorage or SecureStore. Update it on every socket event. Use it on reconnect to call `GET /sync?since=<timestamp>`.

### ✅ DO: Maintain a single persistent socket connection (Phase 15)

**Mobile-specific guidance:**

```typescript
// On app launch, establish socket ONCE
let globalSocket: Socket | null = null;

export function initSocket(token: string) {
  if (globalSocket?.connected) return; // already connected
  
  globalSocket = io('https://api.softaware.net.za/chat', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  
  // Register all event listeners ONCE
  globalSocket.on('call-ringing', handleIncomingCall);
  globalSocket.on('call-accepted', handleCallAccepted);
  // ... all other events ...
  
  globalSocket.on('connect', () => {
    // Call sync endpoint
    syncMissedEvents();
  });
}

// On user logout, disconnect
export function disconnectSocket() {
  globalSocket?.disconnect();
  globalSocket = null;
}

// Export for use throughout app
export function getSocket(): Socket {
  if (!globalSocket) throw new Error('Socket not initialized');
  return globalSocket;
}
```

Do NOT create new socket connections for each page/feature. Reuse the same global socket.

**Why:** Incoming calls arrive via socket events. If you disconnect when leaving the chat page, you'll miss calls when the user is in a different part of the app.

---

## 11. Testing Checklist

### Connection
- [ ] Socket connects with valid JWT
- [ ] Socket rejects invalid/expired JWT with `connect_error`
- [ ] Socket auto-reconnects after network drop
- [ ] Sync endpoint called on reconnect with correct timestamp

### Conversations
- [ ] List loads and sorts correctly (pinned first, then by date)
- [ ] Create DM — returns existing if duplicate
- [ ] Create group with name and members
- [ ] Update group name/description/icon (admin only)
- [ ] Delete group (admin only, DMs can't be deleted)
- [ ] Clear chat history (personal, not affecting others)

### Members
- [ ] Add members to group (admin only)
- [ ] Remove member from group (admin or self-leave)
- [ ] Pin/unpin, archive/unarchive, mute/unmute conversation

### Messages
- [ ] Send text message → appears in both sender and receiver
- [ ] Send image/video/audio/file via upload → message workflow
- [ ] Send GIF message
- [ ] Edit message (within 15 minutes, sender only)
- [ ] Delete for me (no socket event, local only)
- [ ] Delete for everyone (within 5 minutes, sender only)
- [ ] Forward message to multiple conversations
- [ ] Reply to message (reply_to_id + reply_to preview)
- [ ] Message deduplication (sender doesn't see double)

### Real-Time
- [ ] `new_message` received and displayed in real-time
- [ ] `message_edited` updates message content in-place
- [ ] `message_deleted` removes message from list
- [ ] `message_status` updates delivery ticks (✓ → ✓✓ → blue ✓✓)
- [ ] `reaction_update` updates reactions on message
- [ ] `conversation_updated` updates sidebar/list
- [ ] `conversation_deleted` removes from list
- [ ] `user_typing` shows typing indicator
- [ ] `user_stop_typing` clears typing indicator
- [ ] `presence_update` updates online/offline dot
- [ ] Typing auto-clears after 3 seconds of no new event

### Calling (Phase 15 - Corrected WebRTC Flow)
- [ ] Initiate voice call → other user sees 'call-ringing' event → call UI shows
- [ ] Initiate video call → ringing on both sides → acceptor shown first
- [ ] Accept call → you (acceptor) create RTCPeerConnection as **initiator=true**
      → you send **webrtc-offer** → caller receives offer → sends answer
      → ICE candidates exchanged → P2P connects
- [ ] Caller receives 'call-accepted' → creates RTCPeerConnection as **initiator=false**
      → waits for webrtc-offer → sends webrtc-answer
- [ ] Decline call → caller receives 'call-declined' event
- [ ] End call → any side emits 'call-end' → all sides receive 'call-ended' → close PC
- [ ] Missed call after 45s timeout → 'call-missed' emitted, DB status = 'missed'
- [ ] Mute/unmute during call → emit 'call-participant-updated' with muted flag
- [ ] Camera on/off during call → emit 'call-participant-updated' with cameraOff flag
- [ ] Call history shows correct entries + duration
- [ ] TURN relay working for NAT traversal (test cross-network calls)
- [ ] WebRTC offer/answer/ice events all received in correct order
- [ ] Ringtone plays on incoming call (or use system ringtone)

### Search & Media
- [ ] Global search returns results across conversations
- [ ] Conversation search returns results within one conversation
- [ ] Media gallery shows images/videos/docs/links with pagination
- [ ] Starred messages list

### Edge Cases
- [ ] Multi-device: actions on one device reflect on another
- [ ] Large messages (5000 chars) send and render
- [ ] Rapid typing doesn't flood socket events
- [ ] New conversation created mid-session → auto-joined via `conversation_updated`
- [ ] Network loss → reconnect → sync catches up all missed events
- [ ] Incoming call while in different app → notification shows, app foregrounds to accept
- [ ] Incoming call while in background → notification with accept/decline actions
- [ ] Socket persists across navigation → no disconnect on page change
- [ ] ICE candidates still being exchanged after peer connection connects (normal)
- [ ] TURN relay activates when direct P2P fails (automatic)
- [ ] Both sides send webrtc-offer? → should not happen, only acceptor sends offer
- [ ] Call connects but no audio? → check audio track added to PC, permissions granted
- [ ] Call connects but one-way audio? → check offer/answer being sent to correct targetUserId
