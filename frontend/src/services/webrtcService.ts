/**
 * WebRTC Service — Manages peer connections for voice/video calls.
 *
 * Handles:
 *   - RTCPeerConnection lifecycle
 *   - getUserMedia (mic + camera)
 *   - getDisplayMedia (screen sharing)
 *   - ICE candidate exchange
 *   - SDP offer/answer
 *   - Track management
 */

import { StaffChatModel } from '../models/StaffChatModel';

// ── Types ───────────────────────────────────────────────────

export interface CallState {
  callId: number;
  conversationId: number;
  callType: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'connecting';
  direction: 'outgoing' | 'incoming';
  participants: Map<string, ParticipantState>;
  startedAt: number | null;
}

export interface ParticipantState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  cameraOff: boolean;
  stream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
}

export type CallEventType =
  | 'state-changed'
  | 'remote-stream'
  | 'participant-updated'
  | 'error'
  | 'ended';

export type CallEventHandler = (data: any) => void;

// ── ICE Server Cache ────────────────────────────────────────

let cachedIceServers: RTCIceServer[] | null = null;
let iceCacheTimestamp = 0;
const ICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers && Date.now() - iceCacheTimestamp < ICE_CACHE_TTL) {
    return cachedIceServers;
  }
  try {
    const config = await StaffChatModel.getIceConfig();
    cachedIceServers = config.iceServers;
    iceCacheTimestamp = Date.now();
    console.log('[WebRTC] ICE servers fetched:', cachedIceServers.map(s => 
      typeof s.urls === 'string' ? s.urls : s.urls.join(', ')
    ));
    return cachedIceServers;
  } catch {
    // Fallback to Google STUN
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }
}

// ── WebRTC Service (Singleton) ──────────────────────────────

class WebRTCService {
  private callState: CallState | null = null;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private listeners: Map<CallEventType, Set<CallEventHandler>> = new Map();
  private iceCandidateQueue: Map<string, RTCIceCandidateInit[]> = new Map();

  // ── Event system ──────────────────────────────────────

  on(event: CallEventType, handler: CallEventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: CallEventType, handler: CallEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: CallEventType, data?: any): void {
    this.listeners.get(event)?.forEach((handler) => {
      try { handler(data); } catch (err) { console.error('[WebRTC] Event handler error', err); }
    });
  }

  // ── State accessors ───────────────────────────────────

  getCallState(): CallState | null {
    return this.callState;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  isInCall(): boolean {
    return this.callState !== null && this.callState.status !== 'ended';
  }

  // ── Start outgoing call ───────────────────────────────

  async startCall(
    callId: number,
    conversationId: number,
    callType: 'voice' | 'video',
  ): Promise<void> {
    if (this.isInCall()) {
      throw new Error('Already in a call');
    }

    // Get local media
    await this.acquireLocalMedia(callType);

    this.callState = {
      callId,
      conversationId,
      callType,
      status: 'ringing',
      direction: 'outgoing',
      participants: new Map(),
      startedAt: null,
    };

    this.emit('state-changed', this.callState);
  }

  // ── Accept incoming call ──────────────────────────────

  async acceptCall(
    callId: number,
    conversationId: number,
    callType: 'voice' | 'video',
    callerId: string,
    callerName: string,
  ): Promise<void> {
    if (this.isInCall()) {
      throw new Error('Already in a call');
    }

    // Get local media
    await this.acquireLocalMedia(callType);

    this.callState = {
      callId,
      conversationId,
      callType,
      status: 'connecting',
      direction: 'incoming',
      participants: new Map(),
      startedAt: null,
    };

    // Register the caller as a participant
    this.callState.participants.set(callerId, {
      userId: callerId,
      displayName: callerName,
      avatarUrl: null,
      muted: false,
      cameraOff: false,
      stream: null,
      peerConnection: null,
    });

    this.emit('state-changed', this.callState);
  }

  // ── Create peer connection for a remote user ──────────

  async createPeerConnection(
    remoteUserId: string,
    isInitiator: boolean,
    socket: any,
  ): Promise<RTCPeerConnection> {
    if (!this.callState) throw new Error('No active call');

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.callState) {
        socket.emit('webrtc-ice-candidate', {
          callId: this.callState.callId,
          conversationId: this.callState.conversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        const participant = this.callState?.participants.get(remoteUserId);
        if (participant) {
          participant.stream = remoteStream;
        }
        this.emit('remote-stream', { userId: remoteUserId, stream: remoteStream });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && this.callState) {
        if (this.callState.status !== 'active') {
          this.callState.status = 'active';
          this.callState.startedAt = Date.now();
          this.emit('state-changed', this.callState);
        }
      } else if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed'
      ) {
        this.removePeer(remoteUserId);
      }
    };

    pc.onicegatheringstatechange = () => {
      // Logging for debugging
      if (pc.iceGatheringState === 'complete') {
        console.log(`[WebRTC] ICE gathering complete for ${remoteUserId}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state: ${pc.iceConnectionState} for ${remoteUserId}`);
      if (pc.iceConnectionState === 'failed') {
        console.error(`[WebRTC] ICE failed for ${remoteUserId}. Attempting restart...`);
        pc.restartIce();
      }
    };

    this.peerConnections.set(remoteUserId, pc);

    // Update participant state
    if (!this.callState.participants.has(remoteUserId)) {
      this.callState.participants.set(remoteUserId, {
        userId: remoteUserId,
        displayName: remoteUserId,
        avatarUrl: null,
        muted: false,
        cameraOff: false,
        stream: null,
        peerConnection: pc,
      });
    } else {
      this.callState.participants.get(remoteUserId)!.peerConnection = pc;
    }

    // If initiator, create and send offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', {
        callId: this.callState.callId,
        conversationId: this.callState.conversationId,
        targetUserId: remoteUserId,
        sdp: pc.localDescription,
      });
    }

    // NOTE: Do NOT flush queued ICE candidates here.
    // remoteDescription has not been set yet, so addIceCandidate would throw.
    // Candidates are flushed in handleOffer / handleAnswer after setRemoteDescription.

    return pc;
  }

  // ── Handle incoming SDP offer ─────────────────────────

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

    // Flush any ICE candidates that were queued before remoteDescription was set
    await this.flushQueuedIceCandidates(fromUserId, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('webrtc-answer', {
      callId: this.callState.callId,
      conversationId: this.callState.conversationId,
      targetUserId: fromUserId,
      sdp: pc.localDescription,
    });
  }

  // ── Handle incoming SDP answer ────────────────────────

  async handleAnswer(
    fromUserId: string,
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush any ICE candidates that were queued before remoteDescription was set
      await this.flushQueuedIceCandidates(fromUserId, pc);
    }
  }

  // ── Flush queued ICE candidates after remoteDescription is set ──

  private async flushQueuedIceCandidates(
    remoteUserId: string,
    pc: RTCPeerConnection,
  ): Promise<void> {
    const queued = this.iceCandidateQueue.get(remoteUserId);
    if (queued && queued.length > 0) {
      console.log(`[WebRTC] Flushing ${queued.length} queued ICE candidates for ${remoteUserId}`);
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] Failed to add queued ICE candidate', err);
        }
      }
      this.iceCandidateQueue.delete(remoteUserId);
    }
  }

  // ── Handle incoming ICE candidate ─────────────────────

  async handleIceCandidate(
    fromUserId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue the candidate — PC not ready yet
      if (!this.iceCandidateQueue.has(fromUserId)) {
        this.iceCandidateQueue.set(fromUserId, []);
      }
      this.iceCandidateQueue.get(fromUserId)!.push(candidate);
    }
  }

  // ── Media controls ────────────────────────────────────

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
    return true;
  }

  async toggleScreenShare(socket: any): Promise<boolean> {
    if (!this.callState) return false;

    if (this.screenStream) {
      // Stop screen sharing — replace screen track with camera track
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;

      // Replace the video track on all peer connections
      const cameraTrack = this.localStream?.getVideoTracks()[0];
      if (cameraTrack) {
        this.replaceTrackOnAllPeers(cameraTrack);
      }
      return false;
    } else {
      // Start screen sharing
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = this.screenStream.getVideoTracks()[0];

        // When user stops sharing via browser UI
        screenTrack.onended = () => {
          this.toggleScreenShare(socket);
        };

        this.replaceTrackOnAllPeers(screenTrack);
        return true;
      } catch {
        return false;
      }
    }
  }

  private replaceTrackOnAllPeers(newTrack: MediaStreamTrack): void {
    this.peerConnections.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === newTrack.kind);
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
  }

  setSpeaker(enabled: boolean): void {
    // Web API doesn't directly support speaker routing
    // This is handled at the audio element level with setSinkId
    // Store preference for the UI
    (this as any)._speakerEnabled = enabled;
  }

  isSpeakerEnabled(): boolean {
    return (this as any)._speakerEnabled !== false;
  }

  // ── Acquire local media ───────────────────────────────

  private async acquireLocalMedia(callType: 'voice' | 'video'): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false,
      });
    } catch (err) {
      this.emit('error', { type: 'media-access', error: err });
      throw new Error('Failed to access media devices');
    }
  }

  // ── Remove a peer ─────────────────────────────────────

  private removePeer(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    if (this.callState) {
      const participant = this.callState.participants.get(userId);
      if (participant?.stream) {
        participant.stream.getTracks().forEach((t) => t.stop());
      }
      this.callState.participants.delete(userId);

      // If no more participants, end the call
      if (this.callState.participants.size === 0 && this.callState.status === 'active') {
        this.endCall();
      }
    }
  }

  // ── End call and clean up ─────────────────────────────

  endCall(): void {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.iceCandidateQueue.clear();

    if (this.callState) {
      this.callState.status = 'ended';
      this.emit('state-changed', this.callState);
      this.emit('ended', this.callState);
    }

    this.callState = null;
  }

  // ── Update participant info ───────────────────────────

  updateParticipant(userId: string, updates: {
    displayName?: string;
    avatarUrl?: string | null;
    muted?: boolean;
    cameraOff?: boolean;
  }): void {
    const p = this.callState?.participants.get(userId);
    if (p) {
      if (updates.displayName !== undefined) p.displayName = updates.displayName;
      if (updates.avatarUrl !== undefined) p.avatarUrl = updates.avatarUrl;
      if (updates.muted !== undefined) p.muted = updates.muted;
      if (updates.cameraOff !== undefined) p.cameraOff = updates.cameraOff;
      this.emit('participant-updated', { userId, ...updates });
    }
  }
}

// Export singleton
export const webrtcService = new WebRTCService();
