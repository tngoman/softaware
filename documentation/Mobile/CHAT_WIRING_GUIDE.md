# Mobile App — Chat Advanced Features Wiring Guide

> **Purpose**: Step-by-step guide for the React Native developer to implement the remaining chat features — Voice/Video Calling (WebRTC), Call History, Screen Sharing, Session Management, and DND Scheduling.
> **Prerequisite docs**: `Chat/README.md`, `Chat/ROUTES.md`, `Chat/FIELDS.md`, `Chat/PATTERNS.md`
> **Cross-references**: `Mobile/SCHEDULING_WIRING_GUIDE.md` (scheduled calls), `Mobile/APP_WIRING_AND_STATUS.md` (full app map)
> **Backend base URL**: `https://api.softaware.net.za`

---

## 1. Scope — What's Already Built vs. What's Needed

### ✅ Already Implemented (Phases 1–4)

These features are fully wired in the mobile app and do **not** need additional work:

| Feature | Mobile Files |
|---------|-------------|
| Conversations (DMs + groups) | `ChatListScreen`, `ChatScreen`, `NewChatScreen`, `GroupInfoScreen` |
| Messages (text, image, video, audio, file) | `ChatScreen`, `ChatBubble` |
| Reactions, @mentions, forwarding | `ReactionDetailModal`, `MentionAutocomplete`, `ForwardMessageSheet` |
| Starred messages | `StarredMessagesScreen` |
| Global search | `ChatSearchScreen` |
| Media gallery | `MediaGalleryScreen` |
| User profiles | `ChatUserProfileScreen` |
| Rich media (voice notes, image viewer, link previews, file download) | `VoiceNoteRecorder`, `VoiceNotePlayer`, `ImageViewerModal`, `MediaThumbnail`, `FileMessageBubble`, `LinkPreviewCard` |
| Attachment picker (camera, gallery, doc, GIF, location, contact) | `AttachmentPicker` |
| Socket.IO real-time (typing, presence, messages) | `useChatSocket`, `ChatContext`, `chatSocket.ts` |
| Offline sync + notification handler | `syncService.ts`, `chatNotificationHandler.ts`, `chatDb.ts` |
| Emoji picker | `EmojiPicker` |

### 🔨 To Build (This Guide)

| # | Feature | Complexity | Est. LOC |
|---|---------|-----------|----------|
| A | **Voice/Video Calling (WebRTC)** | High | ~1,200 |
| B | **Call History Screen** (replace stub) | Medium | ~350 |
| C | **Incoming Call UI** (full-screen + push) | Medium | ~400 |
| D | **Call Overlay / In-Call Screen** | High | ~600 |
| E | **Screen Sharing** | Medium | ~150 |
| F | **DND Schedule Management** | Low | ~250 |
| G | **Session Management** | Low | ~300 |
| H | **WebAuthn / Biometric Login** | Medium | ~350 |
| **Total** | | | **~3,600** |

---

## 2. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/services/webrtcService.ts` | WebRTC peer connection manager (singleton) | ~500 |
| 2 | `src/services/callKeepService.ts` | Native call UI integration (CallKeep / ConnectionService) | ~150 |
| 3 | `src/screens/groups/CallHistoryScreen.tsx` | Replace existing stub with full call history listing | ~350 |
| 4 | `src/screens/groups/InCallScreen.tsx` | Full-screen voice/video call overlay | ~600 |
| 5 | `src/components/ui/IncomingCallModal.tsx` | Global incoming call modal with accept/decline | ~300 |
| 6 | `src/screens/settings/SessionManagementScreen.tsx` | Active sessions list + revoke | ~300 |
| 7 | `src/screens/settings/DndScheduleScreen.tsx` | Do Not Disturb time range config | ~250 |
| 8 | `src/services/biometricAuth.ts` | WebAuthn / biometric login helper | ~200 |
| 9 | `src/hooks/useWebRTC.ts` | React hook wrapping webrtcService for component state | ~200 |

**Existing files to modify:**

| File | Change |
|------|--------|
| `src/api/chat.ts` | Add call endpoints (initiate, accept, end, history, detail, ICE config) |
| `src/api/auth.ts` | Add session + WebAuthn endpoints |
| `src/hooks/useChatSocket.ts` | Add call signaling event listeners |
| `src/contexts/ChatContext.tsx` | Add `activeCall` state, `incomingCall` state |
| `src/services/chatSocket.ts` | Add call event emitters |
| `src/navigation/FeatureStacks.tsx` | Add `InCallScreen`, replace `CallHistoryScreen` stub |
| `src/navigation/SettingsStack.tsx` | Add `SessionManagement`, `DndSchedule` routes |
| `App.tsx` or root navigator | Mount `IncomingCallModal` globally |

---

## 3. Dependencies to Install

```bash
# Core WebRTC
npm install react-native-webrtc

# Native call integration (Android ConnectionService / iOS CallKit)
npm install react-native-callkeep

# Keep screen awake during calls
npm install react-native-keep-awake

# InCallManager (proximity sensor, audio routing)
npm install react-native-incall-manager

# Biometric authentication (for WebAuthn)
# react-native-keychain is already installed — reuse it
```

**iOS** — add to `ios/Podfile` and run `pod install`:
```ruby
pod 'WebRTC', :modular_headers => true
```

**Android** — add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />
```

---

## 4. TypeScript Types

Add to `src/types/chat.ts` (extend existing file):

```typescript
// ─── Call Types ───────────────────────────────────────────

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined';

export interface CallSession {
  id: string;                    // UUID
  conversation_id: number;
  type: CallType;
  initiated_by: string;          // user UUID
  status: CallStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
}

export interface CallParticipant {
  id: number;
  call_id: string;
  user_id: string;
  joined_at: string | null;
  left_at: string | null;
  muted: boolean;
  camera_off: boolean;
  // Enriched from JOINs:
  name?: string;
  avatar_url?: string | null;
}

export interface CallHistoryEntry {
  id: string;                    // call_session UUID
  conversation_id: number;
  call_type: CallType;
  status: string;
  initiated_by: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  participant_count: number;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  other_user_name: string | null;   // DM: other user's name
  other_user_avatar: string | null; // DM: other user's avatar
}

export interface ICEServerConfig {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

// ─── Incoming Call Payload (from Socket.IO) ──────────────

export interface IncomingCallPayload {
  callId: string;
  callType: CallType;
  conversationId: number;
  callerUserId: string;
  callerName: string;
  callerAvatar: string | null;
  conversationName: string | null;
  conversationType: 'direct' | 'group';
}

// ─── WebRTC Signaling Payloads ───────────────────────────

export interface WebRTCOfferPayload {
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerPayload {
  fromUserId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRTCICECandidatePayload {
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallParticipantUpdate {
  callId: string;
  userId: string;
  muted?: boolean;
  cameraOff?: boolean;
}

// ─── Session Management ──────────────────────────────────

export interface UserSession {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

// ─── DND ─────────────────────────────────────────────────

export interface DndSettings {
  dnd_enabled: boolean;
  dnd_start: string | null;   // "22:00:00"
  dnd_end: string | null;     // "07:00:00"
}
```

---

## 5. API Service — Call & Session Endpoints

### 5a. Add to `src/api/chat.ts`

```typescript
import type {
  CallHistoryEntry, CallSession, CallParticipant,
  ICEServerConfig, DndSettings,
} from '../types/chat';

// ─── Calls ───────────────────────────────────────────────

/** Get ICE/STUN/TURN server config for WebRTC */
export async function getICEConfig(): Promise<ICEServerConfig> {
  const res = await client.get('/staff-chat/calls/ice-config');
  return res.data;
}

/** Initiate a voice or video call */
export async function initiateCall(
  conversationId: number,
  callType: 'voice' | 'video',
  callId: string
): Promise<CallSession> {
  const res = await client.post('/staff-chat/calls/initiate', {
    conversation_id: conversationId,
    call_type: callType,
    call_id: callId,
  });
  return res.data;
}

/** Accept an incoming call */
export async function acceptCall(callId: string): Promise<void> {
  await client.post(`/staff-chat/calls/${callId}/accept`);
}

/** End a call */
export async function endCall(callId: string): Promise<void> {
  await client.post(`/staff-chat/calls/${callId}/end`);
}

/** Get call history (paginated) */
export async function getCallHistory(
  page = 1,
  limit = 20
): Promise<{ calls: CallHistoryEntry[]; total: number }> {
  const res = await client.get('/staff-chat/calls/history', {
    params: { page, limit },
  });
  return res.data;
}

/** Get single call detail with participants */
export async function getCallDetail(
  callId: string
): Promise<{ call: CallSession; participants: CallParticipant[] }> {
  const res = await client.get(`/staff-chat/calls/${callId}`);
  return res.data;
}

// ─── DND ─────────────────────────────────────────────────

/** Get current DND settings */
export async function getDndSettings(): Promise<DndSettings> {
  const res = await client.get('/staff-chat/dnd');
  return res.data;
}

/** Update DND settings */
export async function updateDndSettings(
  settings: DndSettings
): Promise<DndSettings> {
  const res = await client.put('/staff-chat/dnd', settings);
  return res.data;
}
```

### 5b. Add to `src/api/auth.ts`

```typescript
import type { UserSession } from '../types/chat';

// ─── Sessions ────────────────────────────────────────────

/** List active sessions for current user */
export async function getSessions(): Promise<UserSession[]> {
  const res = await client.get('/auth/sessions');
  return res.data;
}

/** Revoke a specific session */
export async function revokeSession(sessionId: string): Promise<void> {
  await client.delete(`/auth/sessions/${sessionId}`);
}

/** Revoke all sessions except current */
export async function revokeAllSessions(): Promise<void> {
  await client.delete('/auth/sessions');
}

// ─── WebAuthn / Passkeys ─────────────────────────────────

export async function getWebAuthnRegisterOptions(): Promise<any> {
  const res = await client.post('/auth/webauthn/register-options');
  return res.data;
}

export async function verifyWebAuthnRegister(attestation: any): Promise<any> {
  const res = await client.post('/auth/webauthn/register-verify', attestation);
  return res.data;
}

export async function getWebAuthnLoginOptions(
  email?: string
): Promise<any> {
  const res = await client.post('/auth/webauthn/login-options', { email });
  return res.data;
}

export async function verifyWebAuthnLogin(assertion: any): Promise<any> {
  const res = await client.post('/auth/webauthn/login-verify', assertion);
  return res.data;
}

export async function getPasskeys(): Promise<any[]> {
  const res = await client.get('/auth/webauthn/credentials');
  return res.data;
}

export async function deletePasskey(credentialId: string): Promise<void> {
  await client.delete(`/auth/webauthn/credentials/${credentialId}`);
}
```

---

## 6. WebRTC Service — `src/services/webrtcService.ts`

This is the **core** of the calling feature. Singleton that manages `RTCPeerConnection` instances, ICE candidates, and media streams.

```typescript
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import { getICEConfig } from '../api/chat';
import { getChatSocket } from './chatSocket';
import type { ICEServerConfig, CallType } from '../types/chat';

type CallEventCallback = (event: string, data: any) => void;

class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private iceConfig: ICEServerConfig | null = null;
  private currentCallId: string | null = null;
  private currentCallType: CallType | null = null;
  private onEvent: CallEventCallback | null = null;
  private screenStream: MediaStream | null = null;

  /** Register a callback for call state events */
  setEventCallback(cb: CallEventCallback) {
    this.onEvent = cb;
  }

  /** Fetch ICE servers (cached after first call) */
  async getIceServers(): Promise<RTCConfiguration> {
    if (!this.iceConfig) {
      this.iceConfig = await getICEConfig();
    }
    return { iceServers: this.iceConfig.iceServers };
  }

  /** Acquire local media (camera + mic) */
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

  /** Create a peer connection for a remote user */
  async createPeerConnection(remoteUserId: string): Promise<RTCPeerConnection> {
    const config = await this.getIceServers();
    const pc = new RTCPeerConnection(config);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        const socket = getChatSocket();
        socket?.emit('webrtc-ice-candidate', {
          conversationId: this.currentConversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event: any) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStreams.set(remoteUserId, stream);
        this.onEvent?.('remote-stream', { userId: remoteUserId, stream });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      this.onEvent?.('connection-state', {
        userId: remoteUserId,
        state: pc.connectionState,
      });
    };

    this.peerConnections.set(remoteUserId, pc);
    this.pendingCandidates.set(remoteUserId, []);

    return pc;
  }

  /** Create and send an SDP offer */
  async createOffer(remoteUserId: string): Promise<void> {
    let pc = this.peerConnections.get(remoteUserId);
    if (!pc) pc = await this.createPeerConnection(remoteUserId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.currentCallType === 'video',
    });
    await pc.setLocalDescription(offer);

    const socket = getChatSocket();
    socket?.emit('webrtc-offer', {
      conversationId: this.currentConversationId,
      targetUserId: remoteUserId,
      sdp: offer,
    });
  }

  /** Handle incoming SDP offer and send answer */
  async handleOffer(
    fromUserId: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    let pc = this.peerConnections.get(fromUserId);
    if (!pc) pc = await this.createPeerConnection(fromUserId);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Flush pending ICE candidates
    this.flushPendingCandidates(fromUserId);

    const socket = getChatSocket();
    socket?.emit('webrtc-answer', {
      conversationId: this.currentConversationId,
      targetUserId: fromUserId,
      sdp: answer,
    });
  }

  /** Handle incoming SDP answer */
  async handleAnswer(
    fromUserId: string,
    sdp: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.flushPendingCandidates(fromUserId);
  }

  /** Handle incoming ICE candidate (queue if PC not ready) */
  async handleIceCandidate(
    fromUserId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue until remote description is set
      const queue = this.pendingCandidates.get(fromUserId) ?? [];
      queue.push(candidate);
      this.pendingCandidates.set(fromUserId, queue);
    }
  }

  /** Flush queued ICE candidates once PC is ready */
  private async flushPendingCandidates(userId: string): Promise<void> {
    const pc = this.peerConnections.get(userId);
    const queue = this.pendingCandidates.get(userId) ?? [];
    for (const candidate of queue) {
      await pc?.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.pendingCandidates.set(userId, []);
  }

  // ─── Media Controls ──────────────────────────────────

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.broadcastParticipantUpdate({ muted: !audioTrack.enabled });
      return !audioTrack.enabled; // true = muted
    }
    return false;
  }

  toggleCamera(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.broadcastParticipantUpdate({ cameraOff: !videoTrack.enabled });
      return !videoTrack.enabled; // true = camera off
    }
    return false;
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack && typeof (videoTrack as any)._switchCamera === 'function') {
      (videoTrack as any)._switchCamera();
    }
  }

  toggleSpeaker(enabled: boolean): void {
    // Use react-native-incall-manager for speaker routing
    // InCallManager.setSpeakerphoneOn(enabled);
  }

  private broadcastParticipantUpdate(update: { muted?: boolean; cameraOff?: boolean }) {
    if (!this.currentCallId) return;
    const socket = getChatSocket();
    socket?.emit('call-participant-update', {
      callId: this.currentCallId,
      conversationId: this.currentConversationId,
      ...update,
    });
  }

  // ─── Call Lifecycle ──────────────────────────────────

  private currentConversationId: number = 0;

  /** Start a new outgoing call */
  async startCall(
    callId: string,
    conversationId: number,
    callType: CallType
  ): Promise<MediaStream> {
    this.currentCallId = callId;
    this.currentCallType = callType;
    this.currentConversationId = conversationId;

    const stream = await this.acquireLocalMedia(callType);

    // Emit call-initiate via socket
    const socket = getChatSocket();
    socket?.emit('call-initiate', {
      conversationId,
      callType,
      callId,
    });

    return stream;
  }

  /** Accept an incoming call */
  async acceptIncomingCall(
    callId: string,
    conversationId: number,
    callType: CallType
  ): Promise<MediaStream> {
    this.currentCallId = callId;
    this.currentCallType = callType;
    this.currentConversationId = conversationId;

    const stream = await this.acquireLocalMedia(callType);

    const socket = getChatSocket();
    socket?.emit('call-accept', { callId, conversationId });

    return stream;
  }

  /** Decline an incoming call */
  declineIncomingCall(callId: string, conversationId: number): void {
    const socket = getChatSocket();
    socket?.emit('call-decline', {
      callId,
      conversationId,
      reason: 'declined',
    });
  }

  /** End the current call and clean up all resources */
  endCall(): void {
    if (this.currentCallId) {
      const socket = getChatSocket();
      socket?.emit('call-end', {
        callId: this.currentCallId,
        conversationId: this.currentConversationId,
      });
    }
    this.cleanup();
  }

  /** Release all WebRTC resources */
  cleanup(): void {
    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.remoteStreams.clear();

    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }

    this.currentCallId = null;
    this.currentCallType = null;
    this.currentConversationId = 0;
    this.onEvent?.('call-ended', {});
  }

  // ─── Getters ─────────────────────────────────────────

  getLocalStream(): MediaStream | null { return this.localStream; }
  getRemoteStream(userId: string): MediaStream | null {
    return this.remoteStreams.get(userId) ?? null;
  }
  getAllRemoteStreams(): Map<string, MediaStream> { return this.remoteStreams; }
  getCurrentCallId(): string | null { return this.currentCallId; }
  getCurrentCallType(): CallType | null { return this.currentCallType; }
  isInCall(): boolean { return this.currentCallId !== null; }
}

// Singleton export
export const webrtcService = new WebRTCService();
```

---

## 7. Socket Event Wiring for Calls

### 7a. Add to `src/services/chatSocket.ts`

Add these emitter helper functions alongside the existing socket setup:

```typescript
// ─── Call Signaling Emitters ─────────────────────────────

export function emitCallInitiate(conversationId: number, callType: string, callId: string) {
  socket?.emit('call-initiate', { conversationId, callType, callId });
}

export function emitCallAccept(callId: string, conversationId: number) {
  socket?.emit('call-accept', { callId, conversationId });
}

export function emitCallDecline(callId: string, conversationId: number, reason?: string) {
  socket?.emit('call-decline', { callId, conversationId, reason });
}

export function emitCallEnd(callId: string, conversationId: number) {
  socket?.emit('call-end', { callId, conversationId });
}
```

### 7b. Add to `src/hooks/useChatSocket.ts`

Register these listeners inside the existing `useEffect` that sets up socket events:

```typescript
// ─── Call Signaling Listeners ────────────────────────────

// Incoming call ring
socket.on('call-ringing', (data: IncomingCallPayload) => {
  // Update ChatContext with incoming call
  setIncomingCall(data);
});

// Call accepted by remote party
socket.on('call-accepted', (data: { callId: string; userId: string }) => {
  // Trigger WebRTC offer exchange
  webrtcService.createOffer(data.userId);
});

// Call declined
socket.on('call-declined', (data: { callId: string; userId: string; reason?: string }) => {
  // If all declined, show "call declined" toast
});

// Call ended
socket.on('call-ended', (data: { callId: string; duration?: number }) => {
  webrtcService.cleanup();
  setActiveCall(null);
  setIncomingCall(null);
});

// Call missed (45s timeout on backend)
socket.on('call-missed', (data: { callId: string }) => {
  setIncomingCall(null);
  // Show "Missed call" toast
});

// WebRTC signaling
socket.on('webrtc-offer', (data: WebRTCOfferPayload) => {
  webrtcService.handleOffer(data.fromUserId, data.sdp);
});

socket.on('webrtc-answer', (data: WebRTCAnswerPayload) => {
  webrtcService.handleAnswer(data.fromUserId, data.sdp);
});

socket.on('webrtc-ice-candidate', (data: WebRTCICECandidatePayload) => {
  webrtcService.handleIceCandidate(data.fromUserId, data.candidate);
});

// Participant mute/camera update
socket.on('call-participant-updated', (data: CallParticipantUpdate) => {
  // Update participant state in activeCall context
});

// Cleanup on unmount
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

## 8. ChatContext Additions

Add these state fields and methods to the existing `ChatContext.tsx`:

```typescript
// ─── New State ───────────────────────────────────────────

const [activeCall, setActiveCall] = useState<{
  callId: string;
  conversationId: number;
  callType: CallType;
  participants: Map<string, { muted: boolean; cameraOff: boolean }>;
} | null>(null);

const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

// ─── New Methods ─────────────────────────────────────────

/** Start an outgoing call */
const startCall = async (conversationId: number, callType: CallType) => {
  const callId = generateUUID(); // Use a UUID generator
  const stream = await webrtcService.startCall(callId, conversationId, callType);
  await chatApi.initiateCall(conversationId, callType, callId);
  setActiveCall({
    callId,
    conversationId,
    callType,
    participants: new Map(),
  });
  // Navigate to InCallScreen
};

/** Accept incoming call */
const acceptCall = async () => {
  if (!incomingCall) return;
  const { callId, conversationId, callType } = incomingCall;
  await webrtcService.acceptIncomingCall(callId, conversationId, callType);
  setActiveCall({
    callId,
    conversationId,
    callType,
    participants: new Map(),
  });
  setIncomingCall(null);
  // Navigate to InCallScreen
};

/** Decline incoming call */
const declineCall = () => {
  if (!incomingCall) return;
  webrtcService.declineIncomingCall(incomingCall.callId, incomingCall.conversationId);
  setIncomingCall(null);
};

/** End current call */
const endCurrentCall = () => {
  webrtcService.endCall();
  setActiveCall(null);
};

// ─── Expose in context value ─────────────────────────────

const value = {
  // ...existing values
  activeCall,
  incomingCall,
  startCall,
  acceptCall,
  declineCall,
  endCurrentCall,
  setActiveCall,
  setIncomingCall,
};
```

---

## 9. Push Notifications for Calls

### FCM Payload Format (sent by backend)

```json
{
  "notification": {
    "title": "Incoming video call",
    "body": "John Doe is calling...",
    "priority": "high"
  },
  "data": {
    "type": "incoming_call",
    "callId": "uuid-here",
    "callType": "video",
    "conversationId": "123",
    "callerName": "John Doe",
    "callerAvatar": "/uploads/avatars/john.jpg"
  }
}
```

### Handle in `src/services/chatNotificationHandler.ts`

Add a case for `incoming_call` in the existing notification handler:

```typescript
case 'incoming_call': {
  // If app is in foreground, set incomingCall in ChatContext
  // which will show IncomingCallModal
  chatContext.setIncomingCall({
    callId: data.callId,
    callType: data.callType as CallType,
    conversationId: parseInt(data.conversationId),
    callerUserId: data.callerUserId,
    callerName: data.callerName,
    callerAvatar: data.callerAvatar,
    conversationName: data.conversationName ?? null,
    conversationType: data.conversationType ?? 'direct',
  });

  // Optionally use react-native-callkeep for native call UI
  // RNCallKeep.displayIncomingCall(data.callId, data.callerName, data.callerName);
  break;
}
```

### Background / Killed State

For calls to ring when the app is killed:
1. Use **`react-native-callkeep`** to show the native Android/iOS call screen
2. Android: Register a headless JS task in `index.js` that handles `incoming_call` data messages
3. iOS: Use VoIP push certificates + CallKit via CallKeep

```typescript
// In index.js or App.tsx root setup:
import RNCallKeep from 'react-native-callkeep';

RNCallKeep.setup({
  ios: {
    appName: 'SoftAware',
    supportsVideo: true,
  },
  android: {
    alertTitle: 'Permissions Required',
    alertDescription: 'This app needs to access your phone accounts for calls',
    selfManaged: true,
    foregroundService: {
      channelId: 'com.softaware.calls',
      channelName: 'Calls',
      notificationTitle: 'Call in progress',
    },
  },
});

// When incoming call push arrives:
RNCallKeep.displayIncomingCall(callId, callerName, callerName, 'generic', callType === 'video');

// When user answers from native UI:
RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
  // Start WebRTC flow
});

// When user ends from native UI:
RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
  webrtcService.endCall();
});
```

---

## 10. Navigation Updates

### 10a. Replace CallHistoryScreen stub

In `src/navigation/FeatureStacks.tsx`, update the `GroupsStack`:

```typescript
import CallHistoryScreen from '../screens/groups/CallHistoryScreen';
import InCallScreen from '../screens/groups/InCallScreen';

// Inside GroupsStack:
<Stack.Screen
  name="CallHistory"
  component={CallHistoryScreen}
  options={{ title: 'Call History' }}
/>
<Stack.Screen
  name="InCall"
  component={InCallScreen}
  options={{
    headerShown: false,
    gestureEnabled: false,    // Prevent swipe-back during call
    animation: 'fade',
  }}
/>
```

### 10b. Add Settings routes

```typescript
import SessionManagementScreen from '../screens/settings/SessionManagementScreen';
import DndScheduleScreen from '../screens/settings/DndScheduleScreen';

// Inside SettingsStack:
<Stack.Screen name="SessionManagement" component={SessionManagementScreen} />
<Stack.Screen name="DndSchedule" component={DndScheduleScreen} />
```

### 10c. Mount IncomingCallModal globally

In `App.tsx` (or the root navigator), render the modal outside navigation so it shows on any screen:

```tsx
import IncomingCallModal from './components/ui/IncomingCallModal';

function App() {
  return (
    <ChatProvider>
      <NavigationContainer>
        {/* ... existing navigators */}
      </NavigationContainer>
      <IncomingCallModal />  {/* Always mounted, shows when incomingCall !== null */}
    </ChatProvider>
  );
}
```

---

## 11. Screen Blueprints

### 11a. InCallScreen (~600 LOC)

**Route**: `InCall`
**Params**: `{ callId, conversationId, callType }`

```
┌────────────────────────────────┐
│  ← Back   Group Call  0:03:42  │  ← Call timer + title
├────────────────────────────────┤
│                                │
│   ┌──────────┐ ┌──────────┐   │
│   │  Remote   │ │  Remote   │   │  ← RTCView for video
│   │  Video 1  │ │  Video 2  │   │     or Avatar for voice
│   └──────────┘ └──────────┘   │
│                                │
│         ┌──────────┐           │
│         │  Local    │           │  ← PIP local video
│         │  Preview  │           │
│         └──────────┘           │
│                                │
├────────────────────────────────┤
│  🔇 Mute  📹 Camera  🔊 Speaker │  ← Control buttons
│       🖥️ Share   📞 End (red)   │
└────────────────────────────────┘
```

**Key components**:
- `RTCView` from `react-native-webrtc` for video streams
- Call timer using `setInterval` (start when `activeCall` status becomes `active`)
- Floating PIP for local camera preview (draggable `Animated.View`)
- Grid layout adapts to participant count (1 = full-screen, 2 = split, 3+ = grid)
- For voice calls, show `Avatar` components instead of video
- Keep screen awake via `react-native-keep-awake`
- Use `react-native-incall-manager` for proximity sensor + audio routing

**State from context**:
```typescript
const { activeCall, endCurrentCall } = useChatContext();
const [isMuted, setIsMuted] = useState(false);
const [isCameraOff, setIsCameraOff] = useState(false);
const [isSpeaker, setIsSpeaker] = useState(false);
const [callDuration, setCallDuration] = useState(0);
const [localStream, setLocalStream] = useState<MediaStream | null>(null);
const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
```

### 11b. IncomingCallModal (~300 LOC)

**Mount**: Global (outside navigator)
**Shows when**: `ChatContext.incomingCall !== null`

```
┌────────────────────────────────┐
│        (dimmed background)     │
│                                │
│          ┌───────┐             │
│          │ 👤    │  pulse ring │
│          │Avatar │  animation  │
│          └───────┘             │
│       "John Doe"               │
│    "Incoming video call..."    │
│                                │
│    ❌ Decline    ✅ Accept      │
│                                │
└────────────────────────────────┘
```

**Key behaviors**:
- Pulse ring animation around caller avatar (use `Animated.loop`)
- Show caller name + call type (voice/video)
- Play ringtone sound via `react-native-incall-manager`
- Auto-dismiss after 45 seconds (matches backend `call-missed` timeout)
- Accept → navigate to `InCallScreen`, decline → dismiss
- Respect DND settings — suppress if in DND window (unless backend already handles this)

### 11c. CallHistoryScreen (~350 LOC)

**Route**: `CallHistory`
**Replaces**: Existing "Coming Soon" stub

```
┌────────────────────────────────┐
│  ← Call History                │
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │ 👤 John Doe              │  │
│  │ 📹 Video call · 5:23     │  │
│  │ Today, 2:30 PM       📞 │  │  ← Re-call button
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 👥 Design Team           │  │
│  │ 📞 Voice call · Missed   │  │  ← Red "Missed"
│  │ Yesterday, 4:15 PM   📞 │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 👤 Jane Smith            │  │
│  │ 📹 Video call · Declined │  │
│  │ Mar 5, 10:00 AM      📞 │  │
│  └──────────────────────────┘  │
│         Load more...           │
└────────────────────────────────┘
```

**Data source**: `GET /staff-chat/calls/history`

**Key features**:
- Use existing `PaginatedList` component
- Color-code by status: green = ended (completed), red = missed/declined, gray = other
- Show call type icon (📞 voice, 📹 video)
- Show duration for completed calls, status label for others
- Re-call button → `startCall(conversationId, callType)`
- Pull-to-refresh
- Tap row → navigate to call detail or conversation

### 11d. SessionManagementScreen (~300 LOC)

**Route**: `SessionManagement` (in SettingsStack)
**Data source**: `GET /auth/sessions`

```
┌────────────────────────────────┐
│  ← Active Sessions             │
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │ 📱 iPhone 15 Pro         │  │
│  │ 192.168.1.5              │  │
│  │ Active now  ● THIS DEVICE│  │  ← Green badge
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 💻 Chrome on Windows     │  │
│  │ 41.13.22.100             │  │
│  │ Last active: 2h ago  [X] │  │  ← Revoke button
│  └──────────────────────────┘  │
│                                │
│  [  Revoke All Other Sessions ]│  ← Red outline button
└────────────────────────────────┘
```

### 11e. DndScheduleScreen (~250 LOC)

**Route**: `DndSchedule` (in SettingsStack)
**Data source**: `GET /staff-chat/dnd` + `PUT /staff-chat/dnd`

```
┌────────────────────────────────┐
│  ← Do Not Disturb              │
├────────────────────────────────┤
│                                │
│  Enable DND          [Toggle]  │
│                                │
│  ── Schedule ──────────────    │
│  Start Time     [22:00]  ▼    │  ← Time picker
│  End Time       [07:00]  ▼    │  ← Time picker
│                                │
│  ℹ️ During DND hours, you      │
│  won't receive chat push       │
│  notifications. @mentions      │
│  will still come through.      │
│                                │
│  [       Save Settings       ] │
└────────────────────────────────┘
```

---

## 12. Screen Sharing (React Native Limitation)

Screen sharing on mobile uses platform-specific APIs:

### Android
Use `react-native-webrtc`'s built-in screen capture:
```typescript
import { mediaDevices } from 'react-native-webrtc';

async function startScreenShare() {
  // On Android, this shows a system permission dialog
  const screenStream = await (mediaDevices as any).getDisplayMedia({
    video: true,
    audio: false,
  });

  // Replace the camera track with screen track on all peers
  const screenTrack = screenStream.getVideoTracks()[0];
  for (const [userId, pc] of webrtcService.peerConnections) {
    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }
  }
}
```

### iOS
iOS screen sharing requires a **Broadcast Upload Extension**. This is complex:
1. Create a Broadcast Upload Extension target in Xcode
2. Use `RPSystemBroadcastPickerView` to trigger screen recording
3. Pipe frames to WebRTC via an app group shared memory

> **Recommendation**: Implement Android screen sharing first (straightforward). iOS screen sharing can follow as a separate effort.

### UI Toggle

Add a screen share button to `InCallScreen` controls. When active, swap the local video preview to show "Screen sharing" label and replace the camera track with the screen track.

---

## 13. Socket Event Reference

### Client → Server (emit from mobile)

| Event | Payload | When |
|-------|---------|------|
| `call-initiate` | `{ conversationId, callType, callId }` | User taps call button |
| `call-accept` | `{ callId, conversationId }` | User accepts incoming call |
| `call-decline` | `{ callId, conversationId, reason? }` | User declines incoming call |
| `call-end` | `{ callId, conversationId }` | User ends call |
| `webrtc-offer` | `{ conversationId, targetUserId, sdp }` | After creating RTCPeerConnection |
| `webrtc-answer` | `{ conversationId, targetUserId, sdp }` | After receiving offer |
| `webrtc-ice-candidate` | `{ conversationId, targetUserId, candidate }` | ICE candidate discovered |
| `call-participant-update` | `{ callId, conversationId, muted?, cameraOff? }` | Toggle mute/camera |

### Server → Client (listen on mobile)

| Event | Payload | Action |
|-------|---------|--------|
| `call-ringing` | `{ callId, callType, callerName, callerAvatar, ... }` | Show `IncomingCallModal` |
| `call-accepted` | `{ callId, userId }` | Begin WebRTC exchange |
| `call-declined` | `{ callId, userId, reason }` | Show toast if all declined |
| `call-ended` | `{ callId, duration }` | Cleanup WebRTC, navigate back |
| `call-missed` | `{ callId }` | Dismiss modal, show "Missed" toast |
| `webrtc-offer` | `{ fromUserId, sdp }` | `webrtcService.handleOffer()` |
| `webrtc-answer` | `{ fromUserId, sdp }` | `webrtcService.handleAnswer()` |
| `webrtc-ice-candidate` | `{ fromUserId, candidate }` | `webrtcService.handleIceCandidate()` |
| `call-participant-updated` | `{ callId, userId, muted?, cameraOff? }` | Update participant UI |

---

## 14. REST API Reference

### Call Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/staff-chat/calls/ice-config` | ICE/STUN/TURN server list |
| `POST` | `/staff-chat/calls/initiate` | Create call session |
| `POST` | `/staff-chat/calls/:id/accept` | Accept call (updates DB) |
| `POST` | `/staff-chat/calls/:id/end` | End call (calculates duration) |
| `GET` | `/staff-chat/calls/history` | Call history (paginated) |
| `GET` | `/staff-chat/calls/:id` | Call detail + participants |

### DND Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/staff-chat/dnd` | Current DND settings |
| `PUT` | `/staff-chat/dnd` | Update DND settings |

### Session Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/sessions` | List active sessions |
| `DELETE` | `/auth/sessions/:id` | Revoke specific session |
| `DELETE` | `/auth/sessions` | Revoke all except current |

### WebAuthn Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/webauthn/register-options` | Get registration challenge |
| `POST` | `/auth/webauthn/register-verify` | Complete registration |
| `POST` | `/auth/webauthn/login-options` | Get login challenge |
| `POST` | `/auth/webauthn/login-verify` | Complete login |
| `GET` | `/auth/webauthn/credentials` | List passkeys |
| `DELETE` | `/auth/webauthn/credentials/:id` | Delete passkey |

---

## 15. Call Flow Diagrams

### Outgoing Call (1-on-1)

```
Mobile A (caller)              Backend                    Mobile B (callee)
    │                            │                            │
    │── startCall() ────────────►│                            │
    │   emit call-initiate       │── INSERT call_session      │
    │                            │── emitCallRinging() ──────►│
    │                            │── FCM push (high priority)►│
    │                            │                            │
    │                            │                     show IncomingCallModal
    │                            │                            │
    │                            │◄── call-accept ───────────│
    │                            │── UPDATE joined_at         │
    │◄── call-accepted ─────────│                            │
    │                            │                            │
    │── webrtc-offer ───────────►│── relay ──────────────────►│
    │◄── webrtc-answer ─────────│◄── relay ──────────────────│
    │←→ webrtc-ice-candidate ──►│←→ relay ←─────────────────→│
    │                            │                            │
    │◄════════════ P2P Media (audio/video) ═══════════════►   │
    │                            │                            │
    │── call-end ───────────────►│                            │
    │                            │── UPDATE ended_at          │
    │                            │── emitCallEnded() ────────►│
    │                            │                            │
    │   cleanup()                │              cleanup()     │
```

### Incoming Call (background/killed app)

```
Backend                    FCM                        Mobile (callee)
    │                        │                            │
    │── FCM push ───────────►│                            │  (app killed)
    │   type: incoming_call  │── data message ───────────►│
    │                        │                            │
    │                        │         CallKeep.displayIncomingCall()
    │                        │         → shows native call UI
    │                        │                            │
    │                        │              User taps Accept
    │                        │                            │
    │◄── call-accept (socket reconnects) ────────────────│
    │                        │              WebRTC begins │
```

---

## 16. Field Mapping Gotchas

| Backend Field | Mobile Mapping | Notes |
|---------------|---------------|-------|
| `call_sessions.id` | `string` (UUID) | Not auto-increment — generated client-side for `call-initiate` |
| `call_sessions.type` | `'voice' \| 'video'` | Maps to `CallType` |
| `call_sessions.status` | `'ringing' \| 'active' \| 'ended' \| 'missed' \| 'declined'` | 5 states |
| `call_participants.muted` | `boolean` (TINYINT in DB) | 0/1 from API, treat as boolean |
| `call_participants.camera_off` | `boolean` (TINYINT in DB) | 0/1 from API, treat as boolean |
| `user_sessions.is_current` | `boolean` | Backend checks `token_hash` match |
| `user_presence.dnd_start/end` | `string` (`"HH:MM:SS"`) | MySQL TIME format, use time picker |
| Call duration | `duration_seconds: number` | Backend computes from `started_at` → `ended_at` |
| ICE config | `{ iceServers: [...] }` | Cache on the mobile side; refresh every 24h max |

---

## 17. WebAuthn / Biometric Login — Mobile Approach

The backend supports WebAuthn, but **React Native does not natively support the Web Authentication API**. The recommended approach for mobile biometric login:

### Option A — Use react-native-keychain (Simplest)

Store credentials in the secure keychain, gated by biometric:

```typescript
import * as Keychain from 'react-native-keychain';

// Save after successful login:
await Keychain.setInternetCredentials(
  'softaware-auth',
  email,
  token,
  {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  }
);

// On app launch, attempt biometric retrieval:
const credentials = await Keychain.getInternetCredentials('softaware-auth');
if (credentials) {
  // Use credentials.password (the JWT) to authenticate
  // Validate with GET /auth/validate first, then refresh if needed
}
```

### Option B — Native WebAuthn via Passkeys (iOS 16+ / Android 14+)

For true passkey support, use a library like `react-native-passkey`:

```bash
npm install react-native-passkey
```

```typescript
import { Passkey } from 'react-native-passkey';

// Registration:
const options = await getWebAuthnRegisterOptions();
const attestation = await Passkey.register(options);
await verifyWebAuthnRegister(attestation);

// Login:
const challenge = await getWebAuthnLoginOptions(email);
const assertion = await Passkey.authenticate(challenge);
const { token } = await verifyWebAuthnLogin(assertion);
```

> **Recommendation**: Start with **Option A** (Keychain biometric) — it works on all devices, requires no backend changes, and covers 95% of the use case. Add Option B later if passkey sync across devices is needed.

---

## 18. Implementation Checklist

### Phase 1 — WebRTC Foundation (~3–4 days)

- [ ] Install `react-native-webrtc`, `react-native-callkeep`, `react-native-keep-awake`, `react-native-incall-manager`
- [ ] Configure Android permissions (CAMERA, RECORD_AUDIO, FOREGROUND_SERVICE)
- [ ] Configure iOS permissions (NSCameraUsageDescription, NSMicrophoneUsageDescription)
- [ ] Create `src/services/webrtcService.ts` (singleton, peer connections, media controls)
- [ ] Create `src/hooks/useWebRTC.ts` (React hook wrapping service)
- [ ] Add call types to `src/types/chat.ts`
- [ ] Add call API methods to `src/api/chat.ts`
- [ ] Add call socket listeners to `src/hooks/useChatSocket.ts`
- [ ] Add call socket emitters to `src/services/chatSocket.ts`
- [ ] Add `activeCall` + `incomingCall` state to `ChatContext.tsx`
- [ ] Test: initiate call from web, verify socket events arrive on mobile

### Phase 2 — Call UI (~3–4 days)

- [ ] Create `IncomingCallModal` (global, pulse animation, accept/decline)
- [ ] Create `InCallScreen` (RTCView, controls, timer, PIP local preview)
- [ ] Mount `IncomingCallModal` in root App
- [ ] Add `InCallScreen` to GroupsStack navigation
- [ ] Wire call buttons in `ChatScreen` header (voice + video icons)
- [ ] Handle call end → navigate back, show duration toast
- [ ] Handle missed call (45s timeout) → dismiss modal, show notification
- [ ] Test: full call flow between mobile ↔ web, mobile ↔ mobile

### Phase 3 — Call History + Screen Share (~2 days)

- [ ] Replace `CallHistoryScreen` stub with full implementation
- [ ] Wire `GET /staff-chat/calls/history` with `PaginatedList`
- [ ] Add re-call button (tap to start new call)
- [ ] Implement Android screen sharing (`getDisplayMedia`)
- [ ] Add screen share toggle to `InCallScreen` controls
- [ ] Test: call history loads, screen share works on Android

### Phase 4 — Background Calls + Push (~2 days)

- [ ] Set up `react-native-callkeep` (Android `ConnectionService` + iOS `CallKit`)
- [ ] Handle `incoming_call` FCM data message when app is backgrounded/killed
- [ ] Display native call screen via CallKeep
- [ ] Wire CallKeep answer/end events to WebRTC service
- [ ] Test: receive call with app killed → native ring → answer → media flows

### Phase 5 — Settings Screens (~1–2 days)

- [ ] Create `DndScheduleScreen` (toggle + time pickers + save)
- [ ] Wire DND API endpoints
- [ ] Create `SessionManagementScreen` (list + revoke)
- [ ] Wire session API endpoints
- [ ] Add navigation entries in SettingsStack
- [ ] Implement biometric login (Keychain Option A)
- [ ] Test: DND saves, sessions list loads, biometric unlock works

---

## 19. Testing Strategy

| Test | How to Verify |
|------|--------------|
| **Outgoing call** | Tap call button on mobile → web receives `call-ringing` → accept → verify audio/video |
| **Incoming call** | Initiate call from web → mobile shows `IncomingCallModal` → accept → verify media |
| **Call controls** | Mute → verify `call-participant-updated` event → remote sees mute indicator |
| **Camera toggle** | Toggle camera off → remote video stream freezes/hides |
| **Switch camera** | Tap flip → local preview switches front/back |
| **Call end** | End call → both sides cleanup → navigate back → duration shown |
| **Missed call** | Don't answer for 45s → `call-missed` event → modal dismisses |
| **Declined call** | Tap decline → `call-declined` → caller sees "declined" |
| **Background call** | Kill app → call from web → native ring screen → answer → media works |
| **Call history** | Make several calls → history screen shows correct entries + status colors |
| **Screen share (Android)** | Tap share → system dialog → screen visible to remote |
| **DND** | Enable DND → send message → no push received during DND hours |
| **Sessions** | Login on 2 devices → session list shows both → revoke one → verify logged out |

---

## 20. Cross-References

| Topic | Document |
|-------|----------|
| Scheduled calls (create, RSVP, start) | `Mobile/SCHEDULING_WIRING_GUIDE.md` |
| Full chat backend documentation | `Chat/README.md`, `Chat/ROUTES.md` |
| Database schema (14 tables) | `Chat/FIELDS.md` |
| Architecture patterns (17 patterns) | `Chat/PATTERNS.md` |
| Full mobile app architecture | `Mobile/APP_WIRING_AND_STATUS.md` |
| Cases / issue tracking | `Mobile/CASES_WIRING_GUIDE.md` |

---

*Document created: auto-generated from Chat module documentation.*
*Estimated total effort: 11–16 days for one developer.*
