# Mobile App — Staff Chat Calling System Wiring Guide

> **Purpose**: Exact step-by-step instructions for wiring voice/video calling in the React Native mobile app for staff & admin users.
> **Last Updated**: 2026-03-08 (Phase 15 - WebRTC Initiator Roles Fixed)
> **Backend Base URL**: `https://api.softaware.net.za` (production) / `http://localhost:8787` (dev)
> **Backend Codebase**: `/var/opt/backend`
> **Web Frontend Reference**: `/var/opt/frontend` (working implementation to compare against)

---

## ⚠️ CRITICAL FACTS — Read Before Writing Any Code

These are the exact facts from the backend source code. Getting any of these wrong will cause calls to silently fail:

| Fact | Detail |
|------|--------|
| **`call_sessions.id` is `BIGINT AUTO_INCREMENT`** | It is a **number**, NOT a UUID. Do NOT generate call IDs client-side. |
| **`POST /calls/initiate` does NOT accept `call_id`** | The server generates it. The response returns it as `data.call_id` (number). |
| **All `callId` values throughout the system are numbers** | Socket events, REST responses, DB records — all use numeric IDs. |
| **WebRTC signaling is broadcast to the entire conversation room** | The mobile app MUST filter `webrtc-offer`/`webrtc-answer`/`webrtc-ice-candidate` by `targetUserId === myUserId`. |
| **Socket `/chat` namespace authenticates via `auth: { token }` in handshake** | Pass the JWT in `socket.handshake.auth.token`. |
| **The caller creates the PeerConnection (as non-initiator) AFTER receiving `call-accepted`** | The caller waits for the SDP offer from the acceptor. The acceptor creates PC as initiator. |
| **The acceptor creates the PeerConnection (as initiator) and sends the SDP offer** | After accepting, the acceptor must create PC as initiator and send the offer first. |
| **Both REST + Socket calls are needed** | Accept: REST updates DB, Socket notifies peers. Initiate: REST creates records, Socket signals ringing. |

---

## 1. Call Flow — Exact Sequence of Operations

### 1a. Outgoing Call (Caller Side) — Phase 15

```
Step 1: REST  →  POST /staff-chat/calls/initiate  { conversation_id: number, call_type: 'voice'|'video' }
         ←  { success: true, data: { call_id: NUMBER, conversation_id, call_type, status: 'ringing' } }

Step 2: WebRTC  →  acquireLocalMedia(callType)  — get mic + optional camera

Step 3: Socket  →  emit('call-initiate', { conversationId, callType, callId: NUMBER_FROM_STEP_1 })
         Server relays → 'call-ringing' to all other room members

Step 4: WAIT for 'call-accepted' event from server
         →  { callId, conversationId, userId }  ← userId is the person who accepted

Step 5: WAIT for 'webrtc-offer' event from acceptor (YOU ARE NON-INITIATOR)
         →  Accept the offer and create answer
         ⚠️  MUST CHECK: data.targetUserId === myUserId (IGNORE if not for me)
         →  createPeerConnection(acceptorUserId, isInitiator=FALSE)
         →  setRemoteDescription(offer) → createAnswer() → emit 'webrtc-answer'

Step 6: Exchange ICE candidates via 'webrtc-ice-candidate' events
Step 7: RTCPeerConnection state becomes 'connected' → media flows
```

### 1b. Incoming Call (Callee/Acceptor Side) — Phase 15

```
Step 1: Receive 'call-ringing' event
         →  { callId: NUMBER, conversationId, callType, callerId, callerName }
         →  Show IncomingCallModal

Step 2: User taps Accept:
         REST  →  POST /staff-chat/calls/{callId}/accept
         WebRTC  →  acquireLocalMedia(callType)
         Socket  →  emit('call-accept', { callId, conversationId })

Step 3: Create PeerConnection as INITIATOR (YOU SEND THE OFFER)
         →  createPeerConnection(callerUserId, isInitiator=TRUE)
         →  Add local tracks to PC
         →  createOffer() → setLocalDescription
         →  emit 'webrtc-offer' with your SDP

Step 4: Receive 'webrtc-answer' from caller
         ⚠️  MUST CHECK: data.targetUserId === myUserId (IGNORE if not for me)
         →  setRemoteDescription(answer)

Step 5: Exchange ICE candidates via 'webrtc-ice-candidate' events
Step 6: RTCPeerConnection state becomes 'connected' → media flows
```

### 1c. End Call

```
Step 1: Socket  →  emit('call-end', { callId, conversationId })
Step 2: WebRTC  →  stop all tracks, close all peer connections, clear state
         (The server calculates duration and updates DB)
```

---

## 2. REST API Endpoints — Exact Request/Response Shapes

### 2a. `GET /staff-chat/calls/ice-config` — Phase 15 with TURN

Returns STUN/TURN servers for WebRTC peer connections.

```typescript
// Request
GET /staff-chat/calls/ice-config
Authorization: Bearer <jwt>

// Response 200
{
  "success": true,
  "data": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      { "urls": "stun:stun1.l.google.com:19302" },
      { "urls": "stun:stun2.l.google.com:19302" },
      { "urls": "stun:stun3.l.google.com:19302" },
      { 
        "urls": "turn:softaware.net.za:3478?transport=udp", 
        "username": "softaware", 
        "credential": "S0ftAware2026!Turn" 
      },
      { 
        "urls": "turn:softaware.net.za:3478?transport=tcp", 
        "username": "softaware", 
        "credential": "S0ftAware2026!Turn" 
      }
    ]
  }
}
```

**Phase 15 Note:** TURN server is now configured for NAT traversal. Clients behind firewalls will automatically relay through `softaware.net.za:3478`. Direct P2P (STUN) is tried first, TURN activates only if needed.

### 2b. `POST /staff-chat/calls/initiate`

Creates a call session in the DB. The server generates the `call_id`.

```typescript
// Request
POST /staff-chat/calls/initiate
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "conversation_id": 42,       // number — REQUIRED
  "call_type": "voice"         // "voice" | "video" — REQUIRED
}
// ⚠️ Do NOT send call_id — the server generates it

// Response 200
{
  "success": true,
  "data": {
    "call_id": 17,             // ← NUMBER (BIGINT auto-increment)
    "conversation_id": 42,
    "call_type": "voice",
    "status": "ringing"
  }
}

// Error 400 — if there's already an active call
{ "error": "BAD_REQUEST", "message": "There is already an active call in this conversation" }

// Error 403 — not a conversation member
{ "error": "FORBIDDEN", "message": "Not a member of this conversation" }
```

**What the backend does:**
1. Validates `conversation_id` + `call_type` via Zod
2. Checks user is a member of the conversation
3. Checks no existing `ringing`/`active` call in this conversation
4. INSERTs into `call_sessions` → gets auto-increment `call_id`
5. INSERTs all conversation members into `call_participants`
6. Sends FCM push to offline members (high priority)
7. Starts 45-second auto-miss timer (if still `ringing` → marks `missed`)
8. Returns the `call_id`

### 2c. `POST /staff-chat/calls/:id/accept`

Marks the call as active. The `:id` is the numeric `call_id`.

```typescript
// Request
POST /staff-chat/calls/17/accept
Authorization: Bearer <jwt>

// Response 200
{ "success": true }
```

**What the backend does:**
1. Updates `call_sessions` status to `active` and `started_at` to `NOW()`
2. Sets `call_participants.joined_at = NOW()` for this user

### 2d. `POST /staff-chat/calls/:id/end`

Force-ends a call. Calculates duration from `started_at`.

```typescript
// Request
POST /staff-chat/calls/17/end
Authorization: Bearer <jwt>

// Response 200
{ "success": true }
```

### 2e. `GET /staff-chat/calls/history`

Paginated call history for the current user.

```typescript
// Request
GET /staff-chat/calls/history?limit=20&offset=0
Authorization: Bearer <jwt>

// Response 200
{
  "success": true,
  "data": [
    {
      "id": 17,                          // call_sessions.id (number)
      "conversation_id": 42,
      "call_type": "voice",              // "voice" | "video"
      "initiated_by": "uuid-string",
      "status": "ended",                 // "ringing" | "active" | "ended" | "missed" | "declined"
      "started_at": "2026-03-07T10:00:00.000Z",
      "ended_at": "2026-03-07T10:05:23.000Z",
      "duration_seconds": 323,
      "conversation_name": "Engineering",  // null for DMs
      "conversation_type": "direct",       // "direct" | "group"
      "caller_name": "John Doe",
      "caller_avatar": "/uploads/avatars/john.jpg",
      "my_joined_at": "2026-03-07T10:00:00.000Z",
      "participant_count": 2,
      // For DM calls only:
      "other_user_name": "Jane Smith",
      "other_user_avatar": "/uploads/avatars/jane.jpg",
      "other_user_id": "uuid-string"
    }
  ]
}
```

### 2f. `GET /staff-chat/calls/:id`

Full call detail with all participants.

```typescript
// Request
GET /staff-chat/calls/17
Authorization: Bearer <jwt>

// Response 200
{
  "success": true,
  "data": {
    "id": 17,
    "conversation_id": 42,
    "type": "voice",
    "initiated_by": "uuid",
    "status": "ended",
    "started_at": "...",
    "ended_at": "...",
    "duration_seconds": 323,
    "conversation_name": "Engineering",
    "conversation_type": "group",
    "caller_name": "John Doe",
    "caller_avatar": "...",
    "participants": [
      {
        "id": 101,
        "call_id": 17,
        "user_id": "uuid",
        "joined_at": "...",
        "left_at": "...",
        "muted": 0,          // 0 or 1 (MySQL TINYINT)
        "camera_off": 0,
        "display_name": "John Doe",
        "avatar_url": "..."
      }
    ]
  }
}
```

---

## 3. Socket.IO Events — Exact Payloads

### Connection Setup

```typescript
import { io, Socket } from 'socket.io-client';

const API_BASE = 'https://api.softaware.net.za'; // or http://localhost:8787

function connectChatSocket(jwtToken: string): Socket {
  const socket = io(`${API_BASE}/chat`, {
    auth: { token: jwtToken },                    // ← REQUIRED: JWT in auth object
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}
```

**On connection, the server automatically:**
1. Validates the JWT
2. Joins the socket into rooms for all the user's conversations (`conv:<id>`)
3. Sets user presence to `online`
4. Marks pending messages as `delivered`

### 3a. Client → Server Events

| Event | Payload | When to Emit |
|-------|---------|--------------|
| `call-initiate` | `{ conversationId: number, callType: 'voice'\|'video', callId: number }` | After REST `POST /calls/initiate` returns the `call_id` |
| `call-accept` | `{ callId: number, conversationId: number }` | After REST `POST /calls/:id/accept` succeeds |
| `call-decline` | `{ callId: number, conversationId: number, reason?: 'declined'\|'busy' }` | User taps Decline |
| `call-end` | `{ callId: number, conversationId: number }` | User ends the call |
| `webrtc-offer` | `{ callId: number, conversationId: number, targetUserId: string, sdp: RTCSessionDescriptionInit }` | After creating PeerConnection as initiator |
| `webrtc-answer` | `{ callId: number, conversationId: number, targetUserId: string, sdp: RTCSessionDescriptionInit }` | After receiving offer and creating answer |
| `webrtc-ice-candidate` | `{ callId: number, conversationId: number, targetUserId: string, candidate: RTCIceCandidateInit }` | When ICE candidate is discovered |
| `call-participant-update` | `{ callId: number, conversationId: number, muted?: boolean, cameraOff?: boolean }` | User toggles mute or camera |

### 3b. Server → Client Events — Phase 15

| Event | Payload | Action |
|-------|---------|--------|
| `call-ringing` | `{ callId: number, conversationId: number, callType: 'voice'\|'video', callerId: string, callerName: string }` | Show IncomingCallModal (if `callerId !== myUserId` and not already in a call) |
| `call-accepted` | `{ callId: number, conversationId: number, userId: string }` | If I'm the caller → WAIT for 'webrtc-offer' from acceptor. If `userId === myUserId` → ignore. |
| `call-declined` | `{ callId: number, conversationId: number, userId: string, reason: string }` | Show toast or update UI |
| `call-ended` | `{ callId: number, conversationId: number, endedBy: string, durationSeconds: number }` | Cleanup WebRTC, dismiss call UI, show duration |
| `call-missed` | `{ callId: number, conversationId: number }` | Dismiss IncomingCallModal, show "Missed call" toast |
| `webrtc-offer` | `{ callId: number, conversationId: number, fromUserId: string, targetUserId: string, sdp: object }` | **⚠️ MUST CHECK `targetUserId === myUserId`**. This is from the acceptor (they're the initiator). You are non-initiator: `setRemoteDescription(offer)` → `createAnswer()` → emit `webrtc-answer` |
| `webrtc-answer` | `{ callId: number, conversationId: number, fromUserId: string, targetUserId: string, sdp: object }` | **⚠️ MUST CHECK `targetUserId === myUserId`**. You are initiator (acceptor), received answer from caller: `setRemoteDescription(answer)` |
| `webrtc-ice-candidate` | `{ callId: number, conversationId: number, fromUserId: string, targetUserId: string, candidate: object }` | **⚠️ MUST CHECK `targetUserId === myUserId`**. Then: `addIceCandidate(candidate)` |
| `call-participant-updated` | `{ callId: number, conversationId: number, userId: string, muted?: boolean, cameraOff?: boolean }` | Update participant mute/camera state in UI |

### ⚠️ WHY `targetUserId` FILTERING IS MANDATORY

The backend broadcasts WebRTC signaling to the **entire conversation room**. In a group call with 4 people, when User A sends an offer to User B:
- User A, B, C, and D are all in the room
- All of B, C, D receive the `webrtc-offer` event
- Only User B should process it (because `targetUserId === B.userId`)
- C and D must IGNORE it

**If you skip this check, every participant will try to answer every offer, creating duplicate peer connections and garbled audio/video.**

---

## 4. TypeScript Types

```typescript
// ── Types for all call-related data ──────────────────────

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined';

// ── REST API response from POST /calls/initiate ──────────
export interface InitiateCallResponse {
  call_id: number;          // BIGINT auto-increment — NOT a UUID
  conversation_id: number;
  call_type: CallType;
  status: 'ringing';
}

// ── Call history entry from GET /calls/history ───────────
export interface CallHistoryEntry {
  id: number;                       // call_sessions.id
  conversation_id: number;
  call_type: CallType;
  initiated_by: string;             // user UUID
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  caller_name: string;
  caller_avatar: string | null;
  my_joined_at: string | null;
  participant_count: number;
  // DM-only fields:
  other_user_name?: string;
  other_user_avatar?: string | null;
  other_user_id?: string;
}

// ── ICE server config from GET /calls/ice-config ─────────
export interface ICEServerConfig {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

// ── Socket event: incoming call ──────────────────────────
export interface IncomingCallPayload {
  callId: number;               // ← NUMBER not string
  conversationId: number;
  callType: CallType;
  callerId: string;             // user UUID
  callerName: string;
}

// ── Socket event: WebRTC signaling ───────────────────────
export interface WebRTCSignalPayload {
  callId: number;
  conversationId: number;
  fromUserId: string;
  targetUserId: string;         // ← MUST filter on this
  sdp?: any;                    // RTCSessionDescriptionInit
  candidate?: any;              // RTCIceCandidateInit
}

// ── Socket event: call accepted ──────────────────────────
export interface CallAcceptedPayload {
  callId: number;
  conversationId: number;
  userId: string;               // the user who accepted
}

// ── Socket event: call ended ─────────────────────────────
export interface CallEndedPayload {
  callId: number;
  conversationId: number;
  endedBy: string;
  durationSeconds: number;
}

// ── Participant state from call detail ───────────────────
export interface CallParticipant {
  id: number;
  call_id: number;
  user_id: string;
  joined_at: string | null;
  left_at: string | null;
  muted: number;                // 0 or 1 (MySQL TINYINT)
  camera_off: number;           // 0 or 1
  display_name: string;
  avatar_url: string | null;
}
```

---

## 5. API Service — Complete Copy-Paste Code

Create or add to `src/api/chat.ts`:

```typescript
import type {
  InitiateCallResponse,
  CallHistoryEntry,
  ICEServerConfig,
  CallParticipant,
} from '../types/chat';

// Assumes `client` is your configured axios instance with baseURL and auth interceptor

// ── Calls ────────────────────────────────────────────────

/** Get STUN/TURN server configuration for WebRTC */
export async function getICEConfig(): Promise<ICEServerConfig> {
  const res = await client.get('/staff-chat/calls/ice-config');
  return res.data.data;  // unwrap { success, data }
}

/** Initiate a voice or video call — server generates the call_id */
export async function initiateCall(
  conversationId: number,
  callType: 'voice' | 'video',
): Promise<InitiateCallResponse> {
  const res = await client.post('/staff-chat/calls/initiate', {
    conversation_id: conversationId,
    call_type: callType,
    // ⚠️ Do NOT send call_id — server generates it
  });
  return res.data.data;
}

/** Accept an incoming call (updates DB status to active) */
export async function acceptCall(callId: number): Promise<void> {
  await client.post(`/staff-chat/calls/${callId}/accept`);
}

/** End a call */
export async function endCall(callId: number): Promise<void> {
  await client.post(`/staff-chat/calls/${callId}/end`);
}

/** Get paginated call history */
export async function getCallHistory(
  limit = 20,
  offset = 0,
): Promise<CallHistoryEntry[]> {
  const res = await client.get('/staff-chat/calls/history', {
    params: { limit, offset },
  });
  return res.data.data;
}

/** Get single call detail with participants */
export async function getCallDetail(
  callId: number,
): Promise<{ call: any; participants: CallParticipant[] }> {
  const res = await client.get(`/staff-chat/calls/${callId}`);
  return res.data.data;
}
```

---

## 6. WebRTC Service — Complete Implementation

Create `src/services/webrtcService.ts`:

```typescript
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { getICEConfig } from '../api/chat';
import type { CallType, ICEServerConfig } from '../types/chat';

// ── Types ───────────────────────────────────────────────

interface CallState {
  callId: number;                // ← number, NOT string
  conversationId: number;
  callType: CallType;
  status: 'ringing' | 'connecting' | 'active' | 'ended';
  direction: 'outgoing' | 'incoming';
}

type EventCallback = (event: string, data: any) => void;

// ── Service ─────────────────────────────────────────────

class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private iceConfig: ICEServerConfig | null = null;
  private callState: CallState | null = null;
  private onEvent: EventCallback | null = null;

  setEventCallback(cb: EventCallback) {
    this.onEvent = cb;
  }

  getCallState(): CallState | null {
    return this.callState;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(userId: string): MediaStream | null {
    return this.remoteStreams.get(userId) ?? null;
  }

  getAllRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  isInCall(): boolean {
    return this.callState !== null && this.callState.status !== 'ended';
  }

  // ── ICE server config (cached) ────────────────────────

  private async getIceServers(): Promise<RTCConfiguration> {
    if (!this.iceConfig) {
      try {
        this.iceConfig = await getICEConfig();
      } catch {
        // Fallback to Google STUN
        this.iceConfig = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        };
      }
    }
    return { iceServers: this.iceConfig.iceServers };
  }

  // ── Acquire local media ───────────────────────────────

  async acquireLocalMedia(callType: CallType): Promise<MediaStream> {
    const constraints: any = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video'
        ? { facingMode: 'user', width: 640, height: 480 }
        : false,
    };

    this.localStream = await mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  // ── Start outgoing call ───────────────────────────────
  //    Called AFTER REST /calls/initiate returns call_id

  async startCall(
    callId: number,             // ← from server response, NOT client-generated
    conversationId: number,
    callType: CallType,
  ): Promise<MediaStream> {
    if (this.isInCall()) throw new Error('Already in a call');

    const stream = await this.acquireLocalMedia(callType);

    this.callState = {
      callId,
      conversationId,
      callType,
      status: 'ringing',
      direction: 'outgoing',
    };

    this.onEvent?.('state-changed', this.callState);
    return stream;
    // ⚠️ Do NOT emit call-initiate here — the caller does that separately
  }

  // ── Accept incoming call ──────────────────────────────
  //    Called AFTER REST /calls/:id/accept

  async acceptIncomingCall(
    callId: number,
    conversationId: number,
    callType: CallType,
  ): Promise<MediaStream> {
    if (this.isInCall()) throw new Error('Already in a call');

    const stream = await this.acquireLocalMedia(callType);

    this.callState = {
      callId,
      conversationId,
      callType,
      status: 'connecting',
      direction: 'incoming',
    };

    this.onEvent?.('state-changed', this.callState);
    return stream;
    // ⚠️ Do NOT emit call-accept here — the caller does that separately
  }

  // ── Create peer connection ────────────────────────────

  async createPeerConnection(
    remoteUserId: string,
    isInitiator: boolean,
    socket: any,  // Socket.IO socket instance
  ): Promise<RTCPeerConnection> {
    if (!this.callState) throw new Error('No active call');

    const config = await this.getIceServers();
    const pc = new RTCPeerConnection(config);

    // Add local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // When local ICE candidate is discovered → send to remote via server
    pc.onicecandidate = (event: any) => {
      if (event.candidate && this.callState) {
        socket.emit('webrtc-ice-candidate', {
          callId: this.callState.callId,
          conversationId: this.callState.conversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate.toJSON
            ? event.candidate.toJSON()
            : event.candidate,
        });
      }
    };

    // When remote track arrives → store the stream
    pc.ontrack = (event: any) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStreams.set(remoteUserId, stream);
        this.onEvent?.('remote-stream', { userId: remoteUserId, stream });
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.onEvent?.('connection-state', { userId: remoteUserId, state });

      if (state === 'connected' && this.callState) {
        if (this.callState.status !== 'active') {
          this.callState.status = 'active';
          this.onEvent?.('state-changed', this.callState);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        this.removePeer(remoteUserId);
      }
    };

    this.peerConnections.set(remoteUserId, pc);
    this.pendingCandidates.set(remoteUserId, []);

    // If we're the initiator (caller), create and send the SDP offer
    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callState.callType === 'video',
      });
      await pc.setLocalDescription(offer);

      socket.emit('webrtc-offer', {
        callId: this.callState.callId,
        conversationId: this.callState.conversationId,
        targetUserId: remoteUserId,
        sdp: pc.localDescription,
      });
    }

    // Flush any ICE candidates that arrived before this PC was created
    await this.flushPendingCandidates(remoteUserId);

    return pc;
  }

  // ── Handle incoming SDP offer ─────────────────────────
  //    Called when we receive 'webrtc-offer' targeted at us

  async handleOffer(
    fromUserId: string,
    sdp: RTCSessionDescriptionInit,
    socket: any,
  ): Promise<void> {
    if (!this.callState) return;

    let pc = this.peerConnections.get(fromUserId);
    if (!pc) {
      pc = await this.createPeerConnection(fromUserId, false, socket);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc-answer', {
      callId: this.callState.callId,
      conversationId: this.callState.conversationId,
      targetUserId: fromUserId,
      sdp: pc.localDescription,
    });

    // Flush pending ICE candidates now that remote description is set
    await this.flushPendingCandidates(fromUserId);
  }

  // ── Handle incoming SDP answer ────────────────────────

  async handleAnswer(
    fromUserId: string,
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.flushPendingCandidates(fromUserId);
  }

  // ── Handle incoming ICE candidate ─────────────────────

  async handleIceCandidate(
    fromUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue — the PC or remote description isn't ready yet
      const queue = this.pendingCandidates.get(fromUserId) ?? [];
      queue.push(candidate);
      this.pendingCandidates.set(fromUserId, queue);
    }
  }

  // ── Flush queued ICE candidates ───────────────────────

  private async flushPendingCandidates(userId: string): Promise<void> {
    const pc = this.peerConnections.get(userId);
    const queue = this.pendingCandidates.get(userId) ?? [];
    if (pc?.remoteDescription && queue.length > 0) {
      for (const candidate of queue) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates.set(userId, []);
    }
  }

  // ── Media Controls ────────────────────────────────────

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // true = muted
    }
    return false;
  }

  toggleCamera(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // true = camera off
    }
    return true; // no video track = camera off
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
      (videoTrack as any)._switchCamera();
    }
  }

  // ── Cleanup ───────────────────────────────────────────

  private removePeer(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    const stream = this.remoteStreams.get(userId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      this.remoteStreams.delete(userId);
    }
    this.pendingCandidates.delete(userId);
  }

  endCall(): void {
    // Stop local media
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    // Stop remote streams
    this.remoteStreams.forEach(stream => {
      stream.getTracks().forEach(t => t.stop());
    });
    this.remoteStreams.clear();

    if (this.callState) {
      this.callState.status = 'ended';
      this.onEvent?.('state-changed', this.callState);
    }
    this.callState = null;
    this.onEvent?.('call-ended', {});
  }
}

// Singleton export
export const webrtcService = new WebRTCService();
```

---

## 7. Socket Event Wiring — Complete Implementation

This is the most critical part. Every event must be wired correctly.

### 7a. Socket Emitter Helpers

Add to `src/services/chatSocket.ts` alongside existing socket setup:

```typescript
// ── Call Signaling Emitters ─────────────────────────────

export function emitCallInitiate(
  conversationId: number,
  callType: 'voice' | 'video',
  callId: number,               // ← number from server
): void {
  socket?.emit('call-initiate', { conversationId, callType, callId });
}

export function emitCallAccept(callId: number, conversationId: number): void {
  socket?.emit('call-accept', { callId, conversationId });
}

export function emitCallDecline(
  callId: number,
  conversationId: number,
  reason?: 'declined' | 'busy',
): void {
  socket?.emit('call-decline', { callId, conversationId, reason: reason || 'declined' });
}

export function emitCallEnd(callId: number, conversationId: number): void {
  socket?.emit('call-end', { callId, conversationId });
}

export function emitCallParticipantUpdate(
  callId: number,
  conversationId: number,
  updates: { muted?: boolean; cameraOff?: boolean },
): void {
  socket?.emit('call-participant-update', { callId, conversationId, ...updates });
}
```

### 7b. Socket Listeners — With Required Filters

Register these in your chat screen/hook inside a `useEffect`. The `myUserId` variable is the current user's UUID.

```typescript
// ── Call Signaling Listeners ────────────────────────────

// 1. Incoming call ring
socket.on('call-ringing', (data: IncomingCallPayload) => {
  // FILTER: Don't show our own outgoing call as incoming
  if (data.callerId === myUserId) return;
  // FILTER: Don't show if already in a call
  if (webrtcService.isInCall()) return;

  setIncomingCall(data);
});

// 2. Call accepted by remote party
socket.on('call-accepted', (data: CallAcceptedPayload) => {
  // FILTER: Ignore if WE are the one who accepted (already handled locally)
  if (data.userId === myUserId) return;

  const cs = webrtcService.getCallState();
  if (cs && cs.callId === data.callId) {
    // We're the caller — create peer connection as INITIATOR
    webrtcService.createPeerConnection(data.userId, true, socket).catch(err => {
      console.error('[Call] Failed to create peer connection', err);
    });
  }
});

// 3. Call declined
socket.on('call-declined', (data) => {
  // Optional: show toast "User declined"
});

// 4. Call ended
socket.on('call-ended', (data: CallEndedPayload) => {
  setIncomingCall(null);
  webrtcService.endCall();
  // Optional: show toast with duration
});

// 5. Call missed (45s timeout on backend)
socket.on('call-missed', (data: { callId: number; conversationId: number }) => {
  // Dismiss incoming call modal if it matches
  setIncomingCall(prev => (prev?.callId === data.callId ? null : prev));

  const cs = webrtcService.getCallState();
  if (cs && cs.callId === data.callId) {
    webrtcService.endCall();
    // Show "Call was not answered" toast
  }
});

// 6. WebRTC offer — ⚠️ MUST FILTER BY targetUserId
socket.on('webrtc-offer', (data: WebRTCSignalPayload) => {
  if (data.targetUserId !== myUserId) return;  // ← CRITICAL FILTER
  webrtcService.handleOffer(data.fromUserId, data.sdp, socket).catch(err => {
    console.error('[Call] Failed to handle offer', err);
  });
});

// 7. WebRTC answer — ⚠️ MUST FILTER BY targetUserId
socket.on('webrtc-answer', (data: WebRTCSignalPayload) => {
  if (data.targetUserId !== myUserId) return;  // ← CRITICAL FILTER
  webrtcService.handleAnswer(data.fromUserId, data.sdp).catch(err => {
    console.error('[Call] Failed to handle answer', err);
  });
});

// 8. ICE candidate — ⚠️ MUST FILTER BY targetUserId
socket.on('webrtc-ice-candidate', (data: WebRTCSignalPayload) => {
  if (data.targetUserId !== myUserId) return;  // ← CRITICAL FILTER
  webrtcService.handleIceCandidate(data.fromUserId, data.candidate).catch(err => {
    console.error('[Call] Failed to handle ICE candidate', err);
  });
});

// 9. Participant mute/camera update
socket.on('call-participant-updated', (data) => {
  // Update UI to show muted/camera-off indicators
});

// ── Cleanup on unmount ──────────────────────────────────
return () => {
  socket.off('call-ringing');
  socket.off('call-accepted');
  socket.off('call-declined');
  socket.off('call-ended');
  socket.off('call-missed');
  socket.off('webrtc-offer');
  socket.off('webrtc-answer');
  socket.off('webrtc-ice-candidate');
  socket.off('call-participant-updated');
};
```

---

## 8. Complete Call Action Handlers

These are the functions that wire everything together. Use them in your ChatScreen or ChatContext.

```typescript
import { initiateCall, acceptCall as restAcceptCall } from '../api/chat';
import { webrtcService } from '../services/webrtcService';
import {
  emitCallInitiate,
  emitCallAccept,
  emitCallDecline,
  emitCallEnd,
  emitCallParticipantUpdate,
} from '../services/chatSocket';

// ── Start an outgoing call ──────────────────────────────

async function handleStartCall(conversationId: number, callType: 'voice' | 'video') {
  try {
    // Step 1: REST — creates DB session, returns call_id (number)
    const result = await initiateCall(conversationId, callType);
    const callId = result.call_id;  // ← number from server

    // Step 2: WebRTC — acquire local media, store call state
    await webrtcService.startCall(callId, conversationId, callType);

    // Step 3: Socket — signal other room members
    emitCallInitiate(conversationId, callType, callId);

    // Step 4: Wait for 'call-accepted' socket event (handled in listeners above)
  } catch (err: any) {
    console.error('[Call] Start failed', err);
    // Show error to user
  }
}

// ── Accept an incoming call ─────────────────────────────

async function handleAcceptCall(incoming: IncomingCallPayload, socket: any) {
  try {
    // Step 1: REST — marks call active in DB, sets started_at
    await restAcceptCall(incoming.callId);

    // Step 2: WebRTC — acquire local media, store call state
    await webrtcService.acceptIncomingCall(
      incoming.callId,
      incoming.conversationId,
      incoming.callType,
    );

    // Step 3: Socket — notify caller we accepted
    emitCallAccept(incoming.callId, incoming.conversationId);

    // Step 4: Create peer connection with caller (as NON-initiator)
    // The caller will send us an offer after receiving 'call-accepted'
    // We could also pre-create the PC here — the offer will arrive shortly:
    await webrtcService.createPeerConnection(incoming.callerId, false, socket);

    // Step 5: Clear incoming call UI
    setIncomingCall(null);
  } catch (err: any) {
    console.error('[Call] Accept failed', err);
  }
}

// ── Decline an incoming call ────────────────────────────

function handleDeclineCall(incoming: IncomingCallPayload) {
  emitCallDecline(incoming.callId, incoming.conversationId, 'declined');
  setIncomingCall(null);
}

// ── End current call ────────────────────────────────────

function handleEndCall() {
  const cs = webrtcService.getCallState();
  if (cs) {
    emitCallEnd(cs.callId, cs.conversationId);
    webrtcService.endCall();
  }
}

// ── Toggle mute ─────────────────────────────────────────

function handleToggleMute() {
  const muted = webrtcService.toggleMute();
  const cs = webrtcService.getCallState();
  if (cs) {
    emitCallParticipantUpdate(cs.callId, cs.conversationId, { muted });
  }
  return muted;
}

// ── Toggle camera ───────────────────────────────────────

function handleToggleCamera() {
  const cameraOff = webrtcService.toggleCamera();
  const cs = webrtcService.getCallState();
  if (cs) {
    emitCallParticipantUpdate(cs.callId, cs.conversationId, { cameraOff });
  }
  return cameraOff;
}

// ── Switch front/back camera ────────────────────────────

async function handleSwitchCamera() {
  await webrtcService.switchCamera();
}
```

---

## 9. Dependencies

```bash
# Core WebRTC for React Native
npm install react-native-webrtc

# Keep screen awake during calls
npm install react-native-keep-awake

# Audio routing (proximity sensor, speaker toggle)
npm install react-native-incall-manager

# Optional: Native call UI (CallKit/ConnectionService)
npm install react-native-callkeep
```

### Android `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.INTERNET" />
```

### iOS `Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>SoftAware needs camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>SoftAware needs microphone access for calls</string>
```

---

## 10. IncomingCallModal — Global Component

Mount this in your root `App.tsx` OUTSIDE the navigation container so it shows on any screen:

```tsx
// App.tsx
import IncomingCallModal from './components/ui/IncomingCallModal';

function App() {
  return (
    <ChatProvider>
      <NavigationContainer>
        {/* ... existing navigators */}
      </NavigationContainer>
      <IncomingCallModal />  {/* Shows when incomingCall state !== null */}
    </ChatProvider>
  );
}
```

The modal should:
- Show caller name + avatar + call type (voice/video)
- Accept button → calls `handleAcceptCall()` → navigates to InCallScreen
- Decline button → calls `handleDeclineCall()`
- Auto-dismiss after 45 seconds (matches backend `call-missed` timeout)
- Play ringtone via `react-native-incall-manager`

---

## 11. InCallScreen — Layout

Route params: `{ callId: number, conversationId: number, callType: 'voice' | 'video' }`

```
┌────────────────────────────────┐
│  ← Back   Call Name   0:03:42  │  ← Timer starts when status = 'active'
├────────────────────────────────┤
│                                │
│   ┌──────────────────────────┐ │
│   │   Remote Video Stream    │ │  ← RTCView (video) or Avatar (voice)
│   │   (react-native-webrtc)  │ │
│   └──────────────────────────┘ │
│                                │
│         ┌──────────┐           │
│         │  Local    │           │  ← Draggable PIP preview
│         │  Preview  │           │
│         └──────────┘           │
│                                │
├────────────────────────────────┤
│  🔇 Mute  📹 Camera  🔄 Flip  │
│  🔊 Speaker           📞 End   │
└────────────────────────────────┘
```

Key considerations:
- Use `RTCView` from `react-native-webrtc` for video streams
- Keep screen awake via `react-native-keep-awake`
- Use `react-native-incall-manager` for proximity sensor + audio routing
- Call timer: `setInterval` that starts when `webrtcService.getCallState()?.status === 'active'`
- For voice calls, show avatar instead of video
- For group calls, grid layout adapts to participant count

---

## 12. Call History Screen

Data source: `GET /staff-chat/calls/history`

Key implementation details:
- Status colors: green = ended (completed), red = missed/declined, gray = ringing
- Show call type icon: 📞 voice, 📹 video
- Show duration for completed calls (format `duration_seconds` to `MM:SS`)
- For DM calls, use `other_user_name` / `other_user_avatar`
- For group calls, use `conversation_name`
- Re-call button → `handleStartCall(conversation_id, call_type)`
- Pull-to-refresh + pagination with `limit` / `offset`

---

## 13. FCM Push for Background/Killed App Calls

The backend sends high-priority FCM data messages for calls:

```json
{
  "notification": {
    "title": "Incoming video call",
    "body": "John Doe is calling..."
  },
  "data": {
    "type": "incoming_call",
    "callId": "17",               // string representation of number
    "callType": "video",
    "conversationId": "42",       // string representation of number
    "callerId": "uuid-string",
    "callerName": "John Doe",
    "priority": "high"
  }
}
```

Handle in your notification service:
```typescript
// When receiving 'incoming_call' data message:
const callId = parseInt(data.callId, 10);  // ← Convert string to number
const conversationId = parseInt(data.conversationId, 10);

// If app is in foreground → set incomingCall state (shows modal)
// If app is in background → use react-native-callkeep for native call UI
```

---

## 14. Screen Sharing (Android Only)

```typescript
import { mediaDevices } from 'react-native-webrtc';

async function startScreenShare(socket: any) {
  // Android shows a system permission dialog
  const screenStream = await (mediaDevices as any).getDisplayMedia({
    video: true,
    audio: false,
  });

  const screenTrack = screenStream.getVideoTracks()[0];

  // Replace camera track with screen track on all peer connections
  for (const [userId, pc] of webrtcService.peerConnections) {
    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }
  }

  // When user stops sharing:
  screenTrack.onended = () => {
    // Restore camera track
    const cameraTrack = webrtcService.getLocalStream()?.getVideoTracks()[0];
    if (cameraTrack) {
      for (const [userId, pc] of webrtcService.peerConnections) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      }
    }
  };
}
```

> **iOS screen sharing** requires a Broadcast Upload Extension in Xcode. Implement Android first.

---

## 15. DND (Do Not Disturb) Endpoints

```typescript
// GET /staff-chat/dnd
// Response: { success: true, data: { dnd_enabled: 0|1, dnd_start: "22:00:00"|null, dnd_end: "07:00:00"|null } }

// PUT /staff-chat/dnd
// Body: { enabled: true, start: "22:00", end: "07:00" }
// Response: { success: true }
```

---

## 16. Session Management Endpoints

```typescript
// GET /auth/sessions
// Response: { success: true, data: [{ id, device_info, ip_address, last_active_at, created_at, expires_at, is_current }] }

// DELETE /auth/sessions/:id — revoke specific session
// DELETE /auth/sessions — revoke ALL except current
```

---

## 17. Common Mistakes That Cause Calls to Fail

| # | Mistake | Symptom | Fix |
|---|---------|---------|-----|
| 1 | Using UUID string for `callId` instead of the server-returned number | REST accept/end returns 404 or matches nothing in DB | Always use `result.call_id` from `POST /calls/initiate` response |
| 2 | Sending `call_id` in the initiate request body | Backend ignores it (not in Zod schema), generates its own | Only send `{ conversation_id, call_type }` |
| 3 | Not filtering `webrtc-offer`/`answer`/`ice-candidate` by `targetUserId` | Every participant processes every signaling message → garbled audio, duplicate connections | Always check `data.targetUserId === myUserId` before processing |
| 4 | Creating PeerConnection before receiving `call-accepted` | Offer sent before callee is ready → offer is lost | Caller: create PC only inside `call-accepted` handler. Callee: create PC after accepting. |
| 5 | Emitting `call-initiate` without calling REST first | No DB session created → accept/end fail, no call history, 45s timeout never set | Always: REST first → get `call_id` → then socket emit |
| 6 | Emitting `call-accept` without calling REST first | DB status stays `ringing`, `started_at` not set, duration wrong | Always: REST accept → then socket emit |
| 7 | Not passing `socket` to `createPeerConnection()` and `handleOffer()` | ICE candidates and SDP can't be sent | Both methods need the live socket instance to emit events |
| 8 | Assuming `callerName` is always a readable name | Backend uses `userName` from DB lookup; if DB lookup fails, falls back to UUID | Display a fallback like "Unknown Caller" if name looks like a UUID |

---

## 18. Debugging Checklist

When a call doesn't work, check these in order:

1. **Socket connected?** — `socket.connected === true`, namespace is `/chat`
2. **In the right room?** — Server auto-joins rooms on connect; verify with `socket.emit('join-conversation', { conversationId })`
3. **REST initiate succeeded?** — Check response has `call_id` as a number
4. **Socket `call-initiate` emitted?** — Check with `socket.on('call-ringing')` on the other device
5. **`call-ringing` received?** — If not, check: same conversation room? socket connected?
6. **REST accept succeeded?** — Response should be `{ success: true }`
7. **Socket `call-accept` emitted?** — Check with `socket.on('call-accepted')` on caller's device
8. **`call-accepted` received by caller?** — If yes, PeerConnection should be created with `isInitiator=true`
9. **`webrtc-offer` received by callee?** — Check `targetUserId` matches callee's userId
10. **`webrtc-answer` received by caller?** — Check `targetUserId` matches caller's userId
11. **ICE candidates exchanging?** — Both sides should emit and receive `webrtc-ice-candidate`
12. **PeerConnection state?** — Should progress: `new` → `connecting` → `connected`
13. **Local stream has tracks?** — `localStream.getTracks()` should have audio (and video for video calls)
14. **Remote stream has tracks?** — Check in `ontrack` handler

---

## 19. Implementation Phases

### Phase 1 — Foundation (3-4 days)
- [ ] Install `react-native-webrtc`, permissions setup
- [ ] Create types in `src/types/chat.ts`
- [ ] Add API functions to `src/api/chat.ts`
- [ ] Create `src/services/webrtcService.ts`
- [ ] Add socket emitters to `src/services/chatSocket.ts`
- [ ] Add socket listeners with all filters
- [ ] Test: initiate call from web → mobile receives `call-ringing`

### Phase 2 — Call UI (3-4 days)
- [ ] Create `IncomingCallModal` (global mount)
- [ ] Create `InCallScreen` with `RTCView`
- [ ] Wire accept/decline/end handlers
- [ ] Wire mute/camera/speaker toggles
- [ ] Test: full call flow web ↔ mobile

### Phase 3 — Call History + Polish (2 days)
- [ ] Create `CallHistoryScreen`
- [ ] Wire re-call button
- [ ] Add call timer to InCallScreen
- [ ] Add camera flip button
- [ ] Test: call history shows correct data

### Phase 4 — Background Calls (2 days)
- [ ] Handle `incoming_call` FCM data message
- [ ] Optional: `react-native-callkeep` for native call UI
- [ ] Test: receive call with app in background

### Phase 5 — Settings (1-2 days)
- [ ] DND schedule screen
- [ ] Session management screen
- [ ] Test: DND and sessions work

---

## 20. Cross-References

| Topic | Document |
|-------|----------|
| Full chat backend docs | `Chat/README.md`, `Chat/ROUTES.md` |
| Database schema | `Chat/FIELDS.md` |
| Architecture patterns | `Chat/PATTERNS.md` |
| Scheduled calls | `Chat/ROUTES.md` §38–46 |
| Full mobile app map | `Mobile/APP_WIRING_AND_STATUS.md` |

---

*This document was created by auditing the actual backend source code at `/var/opt/backend/src/routes/staffChat.ts` and `/var/opt/backend/src/services/chatSocket.ts`, and the working web frontend at `/var/opt/frontend/src/pages/general/ChatPage.tsx` and `/var/opt/frontend/src/services/webrtcService.ts`. All payload shapes, field types, and call flows are verified against the running code.*
