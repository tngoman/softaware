# Staff Chat — Patterns & Architecture

> **Last Updated**: 2026-03-08

---

## Architectural Patterns

### 1. Unified Conversation Model (DMs + Groups)
**Pattern**: A single `conversations` table with `type ENUM('direct','group')` holds both DMs and groups. The same REST API, Socket.IO namespace, and UI components handle both types — the `type` field determines behavior (e.g., DMs skip group name, show the other user's info instead).

```typescript
interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;       // null for DMs
  dm_other_name: string | null;  // populated for DMs
  // ...
}
```

**Benefit**: One API, one socket namespace, one UI — no dual-source complexity.

---

### 2. Component Decomposition (20 Sub-Components)
**Pattern**: The chat UI is split into a main orchestrator (`ChatPage.tsx`, 1,574 LOC) and 20 focused sub-components in the `chat/` directory. Each component receives props from the parent — no global chat state store.

```
ChatPage.tsx (orchestrator)
  ├── ChatSidebar.tsx      (conversation list + tabs)
  ├── ChatHeader.tsx       (header bar + call buttons)
  ├── MessageList.tsx      (scrolling messages)
  ├── MessageInput.tsx     (compose bar)
  ├── ChatDialogs.tsx      (modals: new DM, new group, add members, info)
  ├── EmojiPicker.tsx      (emoji picker overlay)
  ├── StarredMessagesPanel.tsx
  ├── ForwardDialog.tsx
  ├── GlobalSearchPanel.tsx
  ├── ImageLightbox.tsx
  ├── VoiceRecorder.tsx
  ├── AudioPlayer.tsx
  ├── GifPicker.tsx
  ├── CallOverlay.tsx
  ├── IncomingCallModal.tsx
  ├── CallHistoryPanel.tsx
  ├── ScheduleCallDialog.tsx
  └── ScheduledCallsPanel.tsx
```

**Benefit**: Each component is <800 LOC, focused, and testable. Props-down pattern avoids hidden state dependencies.

---

### 3. Socket.IO Room-Based Real-Time
**Pattern**: Each conversation maps to a Socket.IO room named `conv:<id>`. When a message is sent via REST, the backend emits to the room via exported helper functions (e.g., `emitNewMessage()`). Clients join rooms on connection for all their conversations.

```typescript
// Backend (chatSocket.ts)
export function emitNewMessage(conversationId: number, message: any) {
  chatNs?.to(`conv:${conversationId}`).emit('new_message', {
    ...message,
    conversation_id: conversationId,
  });
}

// Client joins on connect
socket.emit('join-conversation', { conversationId });
```

**Benefit**: Server-push for all events — no polling. Room isolation ensures users only receive events for their conversations.

---

### 4. REST + Socket Hybrid
**Pattern**: All mutations (create, edit, delete) go through REST endpoints. The REST handler emits Socket.IO events after persisting. Clients receive real-time updates via socket listeners — they don't need to re-fetch.

```
Client → POST /staff-chat/conversations/:id/messages → Backend
Backend → INSERT into DB → emitNewMessage() → Socket.IO room
All clients in room receive "new-message" event
```

**Benefit**: REST gives reliable persistence with standard error handling. Socket gives instant UI updates without polling.

---

### 5. Delivery Status Tracking (Sent → Delivered → Read)
**Pattern**: The `message_status` table tracks per-user delivery state. Status is computed as the *minimum* across all recipients (if any user hasn't read, the sender sees ✓✓ not ✓✓✓).

```
sent      → message created in DB (single gray ✓)
delivered → recipient connects, server auto-marks delivered (double gray ✓✓)
read      → user scrolls to message / marks read via POST /read (blue ✓✓)
```

**Benefit**: WhatsApp-style delivery feedback with server-authoritative state.

---

### 6. Singleton Services (WebRTC + Socket)
**Pattern**: Both `webrtcService` and `staffChatSocket` use singleton patterns — one instance per browser tab, lazily created on first use.

```typescript
// staffChatSocket.ts
let socket: Socket | null = null;
export function getStaffChatSocket(): Socket { ... }

// webrtcService.ts
class WebRTCService { ... }
export const webrtcService = new WebRTCService();
```

**Benefit**: Prevents duplicate connections. All components share the same socket/WebRTC instance.

---

### 7. ICE Candidate Queuing (WebRTC)
**Pattern**: ICE candidates received before the `RTCPeerConnection` is ready are queued in an array. Once the peer connection is created and the remote description is set, queued candidates are flushed.

```typescript
private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

handleIceCandidate(fromUserId, candidate) {
  const pc = this.peerConnections.get(fromUserId);
  if (pc?.remoteDescription) {
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  } else {
    this.pendingCandidates.get(fromUserId)?.push(candidate);
  }
}
```

**Benefit**: Handles the race condition where ICE candidates arrive before the SDP offer/answer exchange completes.

---

### 8. Server-Side Emitters Imported by Routes
**Pattern**: `chatSocket.ts` exports named functions (`emitNewMessage`, `emitCallRinging`, etc.) that `staffChat.ts` imports and calls after DB writes. The socket module owns the emit logic; routes never access the socket namespace directly.

```typescript
// staffChat.ts (route)
import { emitNewMessage, emitReactionUpdate } from '../services/chatSocket.js';

// After INSERT:
emitNewMessage(conversationId, fullMessage);
```

**Benefit**: Clean separation — routes handle HTTP + DB, socket module handles real-time. Easy to test each independently.

---

### 9. Offline Message Queue (IndexedDB)
**Pattern**: When the socket is disconnected, outgoing messages are stored in IndexedDB via `chatOfflineQueue.ts`. On reconnect, the queue is flushed in order.

```typescript
// On send failure / offline:
await chatOfflineQueue.enqueue({ conversationId, content, messageType, ... });

// On reconnect:
const pending = await chatOfflineQueue.dequeueAll();
for (const msg of pending) {
  await StaffChatModel.sendMessage(msg.conversationId, msg);
}
```

**Benefit**: No message loss on flaky connections. User sees "pending" indicator.

---

### 10. Link Preview Caching (LRU)
**Pattern**: `linkPreview.ts` maintains an in-memory Map of URL → preview data with a 500-entry cap and 1-hour TTL. Subsequent requests for the same URL return cached data.

```typescript
const CACHE = new Map<string, { data: LinkPreview; ts: number }>();
const MAX = 500, TTL = 3600_000;
```

**Benefit**: Avoids re-fetching the same URL for every message render. LRU eviction prevents unbounded memory growth.

---

### 11. Call Signaling via Socket.IO
**Pattern**: Voice/video calls use Socket.IO for signaling (offer/answer/ICE exchange) and `RTCPeerConnection` for media. The backend relays signaling messages between participants in the conversation room.

```
Caller → socket.emit('call-initiate') → Server
Server → emitCallRinging() → All room members (event: call-ringing)
Callee → socket.emit('call-accept') → Server
Server → emits 'call-accepted' → Caller
Both → exchange webrtc-offer / webrtc-answer / webrtc-ice-candidate
Media flows peer-to-peer via RTCPeerConnection
```

**Benefit**: No media server needed for 1-on-1 calls. Server only relays signaling metadata.

---

### 12. Soft-Delete with Multiple Scopes
**Pattern**: Messages support three deletion scopes:
- **Delete for me**: Row in `deleted_messages` table (per-user)
- **Delete for everyone**: Sets `deleted_for_everyone_at` on the message (all users)
- **Clear conversation**: Sets `cleared_at` on `conversation_members` (messages before this date hidden for that user)

**Benefit**: Fine-grained control matching WhatsApp behavior. No data loss — all are reversible at the DB level.

---

### 13. DND Schedule with Server-Side Enforcement
**Pattern**: User sets DND start/end times stored in `user_presence`. When sending push notifications, the backend checks if the recipient is in their DND window and suppresses the notification (except for @mentions).

**Benefit**: Users aren't disturbed during configured quiet hours. @mentions still break through for important messages.

---

### 14. WebAuthn Challenge Storage via Session Table
**Pattern**: WebAuthn registration/login challenges are stored as temporary rows in `user_sessions` with a 5-minute expiry and a special `device_info` marker (`webauthn_register_challenge` / `webauthn_login_challenge`). The challenge is deleted after verification.

**Benefit**: Reuses existing table infrastructure — no separate challenge cache needed.

---

### 15. Token-Hashed Session Tracking
**Pattern**: On login, the JWT is SHA-256 hashed and stored in `user_sessions.token_hash`. Session listing/revocation operates on the hash — the raw token is never stored.

```typescript
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

**Benefit**: Even if the sessions table is compromised, raw JWTs cannot be recovered.

---

### 16. Shared Socket.IO Server Instance
**Pattern**: The backend runs two Socket.IO namespaces (`/team-chats` and `/chat`) on the same HTTP server. Rather than creating two separate `IOServer` instances (which causes a `handleUpgrade()` crash), `index.ts` passes the IO instance from `initTeamChatSocket()` into `initChatSocket()` via the optional `existingIO` parameter.

```typescript
// index.ts
const teamIO = initTeamChatSocket(server);
initChatSocket(server, teamIO);  // reuses same IOServer

// chatSocket.ts
export function initChatSocket(httpServer: HTTPServer, existingIO?: IOServer) {
  io = existingIO ?? new IOServer(httpServer, { ... });
  chatNs = io.of('/chat');
}
```

**Benefit**: Prevents WebSocket upgrade conflict. Both namespaces coexist on a single underlying server.

---

### 17. ISO 8601 → MySQL Datetime Conversion
**Pattern**: Frontend sends ISO 8601 timestamps (`2026-03-10T10:00:00Z`), but MySQL DATETIME columns reject the `T` and `Z` characters. The backend strips these before INSERT.

```typescript
const scheduledAtMysql = parsed.scheduled_at.replace('T', ' ').replace('Z', '');
// "2026-03-10T10:00:00Z" → "2026-03-10 10:00:00"
```

**Benefit**: Accepts standard ISO format from any client while storing valid MySQL datetimes.

---

## Anti-Patterns Addressed (from Legacy System)

| Legacy Issue | How It's Resolved |
|-------------|-------------------|
| Hardcoded WebSocket URL | `groupsSocket.ts` fetches from `sys_settings` API |
| No auth on `groups.ts` routes | `staffChat.ts` uses `requireAuth` on all routes |
| Custom HTML sanitizer | DOMPurify used throughout |
| Debug logging in production | Gated behind `NODE_ENV === 'development'` |
| 3s polling for messages | Socket.IO real-time push |
| No pagination UI | Cursor-based pagination with `before` param |
| No IndexedDB caching | `chatOfflineQueue.ts` + `chatCache.ts` |
| Name-based message detection | UUID-based user matching |
| Single 1,696 LOC component | 17 focused sub-components |

---

## Design Patterns Summary

| Pattern | Location | Category |
|---------|----------|----------|
| Unified conversation model | DB schema + API | ✅ Architecture |
| Component decomposition | ChatPage + 20 components | ✅ Architecture |
| Room-based Socket.IO | chatSocket.ts | ✅ Real-time |
| REST + Socket hybrid | staffChat.ts → chatSocket.ts | ✅ Architecture |
| Delivery status tracking | message_status table | ✅ Data |
| Singleton services | webrtcService, staffChatSocket | ✅ Frontend |
| ICE candidate queuing | webrtcService.ts | ✅ WebRTC |
| Server-side emitter exports | chatSocket.ts → staffChat.ts | ✅ Architecture |
| Offline message queue | chatOfflineQueue.ts | ✅ Resilience |
| Link preview LRU cache | linkPreview.ts | ✅ Performance |
| Call signaling via Socket.IO | chatSocket.ts + webrtcService.ts | ✅ WebRTC |
| Multi-scope soft-delete | messages + deleted_messages | ✅ Data |
| DND schedule enforcement | user_presence + push logic | ✅ UX |
| WebAuthn challenge in sessions | user_sessions table | ✅ Security |
| Token-hashed session tracking | auth.ts trackSession() | ✅ Security |
| Shared Socket.IO server | index.ts initChatSocket(server, teamIO) | ✅ Infrastructure |
| ISO → MySQL datetime conversion | staffChat.ts scheduled_at handling | ✅ Data |
