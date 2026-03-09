/**
 * Team Chat Socket.IO client — connects to the backend /team-chats namespace
 * for real-time local team chat events (messages, typing, membership changes).
 *
 * This is separate from groupsSocket.ts which handles EXTERNAL groups
 * via the remote Silulumanzi chat server.
 */
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

let _socket: Socket | null = null;

function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

/** Derive the Socket.IO server URL from the API base URL */
function getSocketUrl(): string {
  // API_BASE_URL is like "https://host/api" – strip the /api path
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    // Fallback: same origin
    return window.location.origin;
  }
}

/**
 * Get (or create) a singleton Socket.IO client for the /team-chats namespace.
 * Returns null if no auth token is available.
 */
export function getTeamChatSocket(): Socket | null {
  if (_socket?.connected) return _socket;
  if (_socket) {
    // Socket exists but disconnected — try reconnect
    _socket.connect();
    return _socket;
  }

  const token = getToken();
  if (!token) return null;

  const serverUrl = getSocketUrl();

  if (process.env.NODE_ENV === 'development') {
    console.log('[TeamChatSocket] Connecting to', `${serverUrl}/team-chats`);
  }

  _socket = io(`${serverUrl}/team-chats`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
  });

  _socket.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TeamChatSocket] Connected, id:', _socket?.id);
    }
  });

  _socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TeamChatSocket] Disconnected:', reason);
    }
  });

  _socket.on('connect_error', (err) => {
    console.error('[TeamChatSocket] Connection error:', err.message);
  });

  return _socket;
}

/** Disconnect and destroy the singleton socket */
export function disconnectTeamChatSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/** Emit a typing event for a given team */
export function emitTyping(teamId: number): void {
  _socket?.emit('typing', { teamId });
}

/** Emit a stop-typing event for a given team */
export function emitStopTyping(teamId: number): void {
  _socket?.emit('stop-typing', { teamId });
}

/** Join a specific team room (called when selecting a team) */
export function joinTeamRoom(teamId: number): void {
  _socket?.emit('join-team', { teamId });
}

/** Leave a specific team room */
export function leaveTeamRoom(teamId: number): void {
  _socket?.emit('leave-team', { teamId });
}
