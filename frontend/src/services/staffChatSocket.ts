import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

/**
 * Staff Chat Socket Service
 * Singleton Socket.IO client for the /chat namespace.
 * Handles presence, typing, real-time messages, reactions, status updates.
 */

let _socket: Socket | null = null;

function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

function getSocketUrl(): string {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

export function getStaffChatSocket(): Socket {
  if (_socket && _socket.connected) return _socket;

  const token = getToken();
  if (!token) {
    throw new Error('No auth token for chat socket');
  }

  _socket = io(`${getSocketUrl()}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return _socket;
}

export function disconnectStaffChatSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function getStaffChatSocketInstance(): Socket | null {
  return _socket;
}

// ── Typed emit helpers ──────────────────────────────────────

export function emitTyping(conversationId: number): void {
  _socket?.emit('typing', { conversationId });
}

export function emitStopTyping(conversationId: number): void {
  _socket?.emit('stop-typing', { conversationId });
}

export function joinConversationRoom(conversationId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    _socket?.emit('join-conversation', { conversationId }, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function leaveConversationRoom(conversationId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    _socket?.emit('leave-conversation', { conversationId }, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Call signaling helpers ──────────────────────────────────

export function emitCallInitiate(conversationId: number, callType: 'voice' | 'video', callId: number): void {
  _socket?.emit('call-initiate', { conversationId, callType, callId });
}

export function emitCallAccept(callId: number, conversationId: number): void {
  _socket?.emit('call-accept', { callId, conversationId });
}

export function emitCallDecline(callId: number, conversationId: number, reason?: 'declined' | 'busy'): void {
  _socket?.emit('call-decline', { callId, conversationId, reason: reason || 'declined' });
}

export function emitCallEnd(callId: number, conversationId: number): void {
  _socket?.emit('call-end', { callId, conversationId });
}

export function emitCallParticipantUpdate(callId: number, conversationId: number, updates: {
  muted?: boolean;
  cameraOff?: boolean;
}): void {
  _socket?.emit('call-participant-update', { callId, conversationId, ...updates });
}
