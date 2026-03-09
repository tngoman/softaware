# Staff Chat — Route & Event Reference

> **Last Updated**: 2026-03-08

---

## Part 1: REST API — Staff Chat

**Base URL**: `/api/staff-chat`
**Auth**: All endpoints require `requireAuth` middleware (JWT Bearer token)
**Total**: 48 endpoints

---

### Users & Profiles

#### 1. `GET /staff-chat/users/available`
List all active users for DM/member picker dialogs.

**Response** `200`:
```json
{
  "success": true,
  "data": [{ "id": "uuid", "name": "John Smith", "email": "john@example.com", "avatar_url": "..." }]
}
```

#### 2. `GET /staff-chat/users/:id/profile`
Get a specific user's public profile.

#### 3. `POST /staff-chat/profile/avatar`
Upload a profile avatar (base64 in JSON body).

---

### Conversations

#### 4. `GET /staff-chat/conversations`
List all conversations for the current user. Returns enriched data: unread count, last message, DM other-user info, member count. Sorted by pinned first, then `last_message_at DESC`.

#### 5. `POST /staff-chat/conversations`
Create a new conversation.

**Request Body**:
```json
{
  "type": "direct" | "group",
  "name": "Engineering",          // optional, 1-100 chars (for groups)
  "description": "Dev team chat", // optional, max 500 chars
  "member_ids": ["uuid1", "uuid2"] // required, min 1
}
```

**DM dedup**: If `type === "direct"` and a DM already exists between the two users, returns the existing conversation. Creator is auto-added as admin.

#### 6. `GET /staff-chat/conversations/:id`
Get conversation details with full member list (names, avatars, roles, online status).

#### 7. `PUT /staff-chat/conversations/:id`
Update conversation name, description, or icon_url. Admin only for groups.

#### 8. `DELETE /staff-chat/conversations/:id`
Delete a conversation. Admin only for groups.

#### 9. `POST /staff-chat/conversations/:id/clear`
"Delete for me" — sets `cleared_at` on the member record. Messages before this timestamp are hidden.

---

### Members

#### 10. `POST /staff-chat/conversations/:id/members`
Add members to a group. Admin only.

**Request Body**: `{ "user_ids": ["uuid1", "uuid2"] }`

Re-add support: if a user was previously removed (`removed_at` set), the row is reactivated.

#### 11. `DELETE /staff-chat/conversations/:id/members/:userId`
Remove a member. Admin can remove anyone; members can self-leave.

#### 12. `PATCH /staff-chat/conversations/:id/members/me`
Update own member settings: `pinned`, `archived`, `muted_until`, `notification_sound`.

**Request Body** (all optional):
```json
{
  "pinned": true,
  "archived": false,
  "muted_until": "2025-07-20T00:00:00Z",
  "notification_sound": "chime"
}
```

---

### Messages

#### 13. `GET /staff-chat/conversations/:id/messages`
Paginated messages (oldest first in response). JOINs user names, reply info, reactions, star status, delivery status.

**Query params**: `limit` (default 50, max 100), `before` (message ID cursor — fetches messages older than this ID)

#### 14. `POST /staff-chat/conversations/:id/messages`
Send a message. Creates `message_status` rows for all members. Emits `new_message` via Socket.IO. Sends FCM push to offline members (respects DND + mute). For text messages, auto-extracts link preview.

**Request Body**:
```json
{
  "content": "Hello!",
  "message_type": "text",
  "file_url": null,
  "file_name": null,
  "file_size": null,
  "reply_to_id": null,
  "forwarded_from_id": null,
  "media_metadata": null
}
```

**Message types**: `text`, `image`, `video`, `audio`, `file`, `gif`, `location`, `contact`, `system`

#### 15. `PUT /staff-chat/conversations/:id/messages/:msgId`
Edit a message. Sender only. Sets `edited_at`. Emits `message_edited`.

#### 16. `DELETE /staff-chat/conversations/:id/messages/:msgId`
Delete a message.

**Query param**: `for=everyone` for delete-for-everyone (sender only, within 5 min), `for=me` (default) for delete-for-me.

---

### Reactions

#### 17. `POST /staff-chat/messages/:msgId/reactions`
Toggle a reaction emoji on a message. If the same user+emoji exists, removes it.

**Request Body**: `{ "emoji": "👍" }`

---

### Starring

#### 18. `POST /staff-chat/messages/:msgId/star`
Toggle star on a message for the current user.

#### 19. `GET /staff-chat/starred-messages`
List all starred messages for the current user, with message content and conversation info.

---

### Forwarding

#### 20. `POST /staff-chat/messages/:msgId/forward`
Forward a message to multiple conversations.

**Request Body**: `{ "conversation_ids": [1, 2, 3] }`

Creates a new message in each target with `forwarded_from_id` set.

---

### Read Receipts

#### 21. `POST /staff-chat/conversations/:id/read`
Mark all messages in a conversation as read up to the specified message. Updates `message_status` + `last_read_message_id`.

**Request Body**: `{ "message_id": 123 }`

---

### Search

#### 22. `GET /staff-chat/search`
Global message search across all user's conversations.

**Query params**: `q` (search text), `limit`, `offset`

Uses `FULLTEXT` index on `messages.content`.

#### 23. `GET /staff-chat/conversations/:id/search`
Search within a specific conversation.

---

### Media

#### 24. `GET /staff-chat/conversations/:id/media`
Get media files from a conversation, filterable by type.

**Query params**: `type` (`image`, `video`, `audio`, `file`), `limit`, `offset`

#### 25. `POST /staff-chat/conversations/:id/upload`
Upload a file (base64 in JSON body). Runs through `mediaProcessor` for images/video/audio if available.

**Request Body**:
```json
{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "fileData": "base64encodedstring"
}
```

**Storage**: `uploads/staff-chat/<conversationId>/<timestamp>_<name>`

---

### Reporting

#### 26. `POST /staff-chat/messages/:msgId/report`
Report a message — creates a case in the `cases` table with message content + conversation context.

**Request Body**: `{ "reason": "Inappropriate content" }`

---

### GIFs

#### 27. `GET /staff-chat/gifs`
Search GIFs via Tenor API.

**Query params**: `q` (search text, omit for trending), `limit`

---

### Link Previews

#### 28. `GET /staff-chat/link-preview`
Fetch link preview metadata for a URL.

**Query params**: `url`

**Response**: `{ url, title, description, image, siteName, favicon }`

---

### DND (Do Not Disturb)

#### 29. `GET /staff-chat/dnd`
Get current user's DND settings.

#### 30. `PUT /staff-chat/dnd`
Update DND settings.

**Request Body**: `{ "dnd_enabled": true, "dnd_start": "22:00", "dnd_end": "07:00" }`

---

### Notification Sound

#### 31. `PUT /staff-chat/conversations/:id/notification-sound`
Set custom notification sound for a conversation.

**Request Body**: `{ "sound": "chime" }`

---

### Voice & Video Calls

#### 32. `GET /staff-chat/calls/ice-config`
Get ICE server configuration (STUN/TURN). Returns Google STUN servers + TURN placeholder.

#### 33. `POST /staff-chat/calls/initiate`
Initiate a call. Creates `call_session` + `call_participants`. Sends FCM push to offline members. Auto-miss after 45s timeout.

**Request Body**: `{ "conversationId": 1, "callType": "voice" | "video" }`

#### 34. `POST /staff-chat/calls/:id/accept`
Accept a call. Marks session active, updates participant `joined_at`.

#### 35. `GET /staff-chat/calls/history`
Call history for the current user. DM calls enriched with other-user info.

#### 36. `GET /staff-chat/calls/:id`
Call detail with full participant list.

#### 37. `POST /staff-chat/calls/:id/end`
Force-end a call. Calculates duration, emits `call-ended` to conversation room.

---

### Scheduled Calls

#### 38. `POST /staff-chat/scheduled-calls`
Create a scheduled call/meeting.

**Request Body**:
```json
{
  "conversation_id": 1,
  "title": "Weekly Standup",
  "description": "Optional description",
  "call_type": "video",
  "screen_share": false,
  "scheduled_at": "2026-03-10 10:00:00",
  "duration_minutes": 30,
  "recurrence": "weekly",
  "recurrence_end": "2026-06-30 10:00:00",
  "participant_ids": ["uuid1", "uuid2"]
}
```

**Note**: `scheduled_at` accepts MySQL datetime format (`YYYY-MM-DD HH:MM:SS`). ISO 8601 with `T`/`Z` is auto-converted.

#### 39. `GET /staff-chat/scheduled-calls`
List scheduled calls for the current user (upcoming + recent). Includes participant RSVP status.

#### 40. `GET /staff-chat/scheduled-calls/:id`
Get scheduled call detail with full participant list and RSVP statuses.

#### 41. `PUT /staff-chat/scheduled-calls/:id`
Update a scheduled call. Creator only.

#### 42. `DELETE /staff-chat/scheduled-calls/:id`
Cancel a scheduled call. Creator only. Sets status to `cancelled`.

#### 43. `POST /staff-chat/scheduled-calls/:id/rsvp`
RSVP to a scheduled call.

**Request Body**: `{ "response": "accepted" | "declined" }`

#### 44. `POST /staff-chat/scheduled-calls/:id/start`
Start a scheduled call. Creates a `call_session` and links it. Creator only.

#### 45. `POST /staff-chat/scheduled-calls/:id/participants`
Add participants to a scheduled call.

**Request Body**: `{ "user_ids": ["uuid1", "uuid2"] }`

#### 46. `DELETE /staff-chat/scheduled-calls/:id/participants/:userId`
Remove a participant from a scheduled call.

---

## Part 2: REST API — Auth (Session & WebAuthn)

**Base URL**: `/api/auth`

### Sessions

#### `GET /auth/sessions`
List active sessions for the current user. Each session has `is_current` flag.

#### `DELETE /auth/sessions/:id`
Revoke a specific session.

#### `DELETE /auth/sessions`
Revoke all sessions except the current one.

### WebAuthn / Passkeys

#### `POST /auth/webauthn/register-options`
Generate registration challenge + PublicKeyCredentialCreationOptions. Requires auth.

#### `POST /auth/webauthn/register-verify`
Verify attestation and store credential. Requires auth.

#### `POST /auth/webauthn/login-options`
Generate authentication challenge. Public (no auth required). Accepts optional `email`.

#### `POST /auth/webauthn/login-verify`
Verify assertion, issue JWT, track session. Public.

#### `GET /auth/webauthn/credentials`
List registered passkeys for the current user. Requires auth.

#### `DELETE /auth/webauthn/credentials/:id`
Remove a passkey. Requires auth.

---

## Part 3: Socket.IO — `/chat` Namespace

### Connection

| Property | Value |
|----------|-------|
| Namespace | `/chat` |
| Auth | JWT token via `auth: { token }` in handshake |
| Transport | WebSocket with polling fallback |
| Rooms | `conv:<conversationId>` per conversation |
| Reconnection | Enabled (socket.io-client defaults) |

---

### Client → Server Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `join-conversation` | `{ conversationId }` | Join a conversation room |
| `leave-conversation` | `{ conversationId }` | Leave a conversation room |
| `typing` | `{ conversationId }` | Signal that user is typing |
| `stop-typing` | `{ conversationId }` | Signal that user stopped typing |
| `call-initiate` | `{ conversationId, callType, callId }` | Start a call |
| `call-accept` | `{ callId, conversationId }` | Accept incoming call |
| `call-decline` | `{ callId, conversationId, reason? }` | Decline incoming call |
| `call-end` | `{ callId, conversationId }` | End a call |
| `webrtc-offer` | `{ conversationId, targetUserId, sdp }` | SDP offer relay |
| `webrtc-answer` | `{ conversationId, targetUserId, sdp }` | SDP answer relay |
| `webrtc-ice-candidate` | `{ conversationId, targetUserId, candidate }` | ICE candidate relay |
| `call-participant-update` | `{ callId, conversationId, muted?, cameraOff? }` | Mute/camera toggle |

---

### Server → Client Events

| Event | Payload | Source |
|-------|---------|--------|
| `new_message` | `{ ...message, conversation_id }` (flat) | `emitNewMessage()` from REST |
| `message_edited` | `{ message_id, content, edited_at }` | `emitMessageEdited()` from REST |
| `message_deleted` | `{ message_id, deleted_for_everyone }` | `emitMessageDeleted()` from REST |
| `message_status` | `{ message_id, status }` | `emitMessageStatusUpdate()` from REST |
| `reaction_update` | `{ message_id, reactions[] }` | `emitReactionUpdate()` from REST |
| `conversation_updated` | `{ id, ...changes }` (flat) | `emitConversationUpdated()` from REST |
| `conversation_deleted` | `{ conversation_id }` | `emitConversationDeleted()` from REST |
| `user_typing` | `{ conversation_id, user_id, user_name }` | Relayed from client `typing` |
| `user_stop_typing` | `{ conversation_id, user_id, user_name }` | Relayed from client `stop-typing` |
| `presence_update` | `{ user_id, status }` | On connect/disconnect |
| `call-ringing` | `{ callId, conversationId, callType, callerId, callerName }` | `emitCallRinging()` |
| `call-accepted` | `{ callId, conversationId, userId }` | From `call-accept` handler |
| `call-declined` | `{ callId, conversationId, userId, reason }` | From `call-decline` handler |
| `call-ended` | `{ callId, conversationId, endedBy, durationSeconds }` | `emitCallEnded()` |
| `call-missed` | `{ callId, conversationId }` | `emitCallMissed()` (45s timeout) |
| `webrtc-offer` | `{ callId, conversationId, fromUserId, targetUserId, sdp }` | Relayed from client |
| `webrtc-answer` | `{ callId, conversationId, fromUserId, targetUserId, sdp }` | Relayed from client |
| `webrtc-ice-candidate` | `{ callId, conversationId, fromUserId, targetUserId, candidate }` | Relayed from client |
| `call-participant-updated` | `{ callId, conversationId, userId, muted?, cameraOff? }` | Relayed from client |
| `scheduled-call` | `{ type, conversationId, ...data }` | From scheduled-call endpoints |

---

### Backend Exported Emitter Functions (`chatSocket.ts`)

These are imported by `staffChat.ts` and called after DB writes:

| Function | Emits Event | Emits To |
|----------|-------------|----------|
| `emitNewMessage(convId, message)` | `new_message` | `conv:<convId>` room |
| `emitMessageEdited(convId, msgId, content, editedAt)` | `message_edited` | `conv:<convId>` room |
| `emitMessageDeleted(convId, msgId, deletedForEveryone)` | `message_deleted` | `conv:<convId>` room |
| `emitMessageStatusUpdate(convId, msgId, status)` | `message_status` | `conv:<convId>` room |
| `emitReactionUpdate(convId, msgId, reactions)` | `reaction_update` | `conv:<convId>` room |
| `emitConversationUpdated(convId, changes)` | `conversation_updated` | `conv:<convId>` room |
| `emitConversationDeleted(convId)` | `conversation_deleted` | `conv:<convId>` room |
| `emitCallRinging(convId, data)` | `call-ringing` | `conv:<convId>` room |
| `emitCallEnded(convId, data)` | `call-ended` | `conv:<convId>` room |
| `emitCallMissed(convId, callId)` | `call-missed` | `conv:<convId>` room |
| `emitScheduledCall(convId, eventType, data)` | `scheduled-call` | `conv:<convId>` room |
| `isUserOnline(userId)` | — | — (returns boolean) |
| `getChatIO()` | — | — (returns IO instance) |
| `getChatNamespace()` | — | — (returns namespace) |
| `initChatSocket(httpServer, existingIO?)` | — | — (initializer) |

---

## Part 4: Socket.IO — External Groups (Legacy)

### Connection

| Property | Value |
|----------|-------|
| Server URL | Fetched from `sys_settings` key `silulumanzi_chat_url` |
| Fallback URL | `https://webhook.silulumanzi.com:90` |
| Namespace | `/groups` |
| Transport | HTTP long-polling only (`transports: ['polling']`, `upgrade: false`) |
| Auth | JWT via `auth: { token }` |

### Events

| Direction | Event | Purpose |
|-----------|-------|---------|
| Client → Server | `join-groups` | Register agent, request group list |
| Client → Server | `groups-set-channel` | Select group, request history |
| Client → Server | `send-group-message` | Send text message |
| Client → Server | `send-group-file` | Send file (base64) |
| Server → Client | `groups-list-updated` | Full group list |
| Server → Client | `groups-channel-messages` | Message history for selected group |
| Server → Client | `new-group-message` | Real-time new message |

---

## Permission Matrix

### Staff Chat API

| Action | Permission | Enforcement |
|--------|-----------|-------------|
| List conversations | Authenticated | `requireAuth` + membership filter |
| Create conversation | Authenticated | Creator becomes admin |
| View conversation + members | Conversation member | Membership check in SQL |
| Update conversation | Group admin | Role check |
| Delete conversation | Group admin | Role check |
| Add members | Group admin | Role check |
| Remove member | Admin (any) or self-leave | Role + self check |
| Send/view messages | Conversation member | Membership check |
| Edit message | Sender only | `sender_id === userId` |
| Delete for everyone | Sender only | `sender_id === userId` |
| Delete for me | Any member | Creates `deleted_messages` row |
| React to message | Any member | Membership check |
| Star message | Any member | Per-user |
| Report message | Any member | Creates case |
| Initiate call | Any member | Membership check |
| Upload file | Any member | Membership check |

### Auth / Sessions

| Action | Permission |
|--------|-----------|
| List sessions | Authenticated (own sessions only) |
| Revoke session | Authenticated (own sessions only) |
| Register passkey | Authenticated |
| Login with passkey | Public (credential must exist) |
| List/delete passkeys | Authenticated (own credentials only) |

---

## Event Flow Diagrams

### Message Send
```
Client                          Backend                      Other Clients
  │── POST /messages ──────────►│                               │
  │                              │── INSERT into DB              │
  │                              │── emitNewMessage() ──────────►│
  │                              │── sendPushToUser() ──►FCM     │
  │◄── 201 { message } ────────│                               │
  │                              │               new-message ──►│
```

### Voice/Video Call
```
Caller                         Server                       Callee
  │── POST /calls/initiate ────►│                               │
  │                              │── INSERT call_session          │
  │                              │── emitCallRinging() ─────────►│
  │                              │── sendPushToUser() ──►FCM     │
  │                              │                               │
  │                              │◄── call-accept ──────────────│
  │                              │── UPDATE joined_at            │
  │◄── call-accepted ──────────│                               │
  │                              │                               │
  │── webrtc-offer ─────────────►│── relay ─────────────────────►│
  │◄── webrtc-answer ───────────│◄── relay ─────────────────────│
  │←→ webrtc-ice-candidate ←──→│←→ relay ←────────────────────→│
  │                              │                               │
  │        ◄═══════ P2P Media Stream ═══════►                   │
```
