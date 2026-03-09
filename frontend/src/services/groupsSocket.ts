/**
 * Groups WebSocket service — connects to the /groups namespace
 * for real-time group chat messaging.
 *
 * Adapted from the desktop app's groups-socket.ts for the web frontend.
 * Uses polling transport only (matching the desktop Electron app exactly).
 *
 * The server URL is fetched from sys_settings (key: silulumanzi_chat_url)
 * and cached in-memory for subsequent calls.
 */
import { io, Socket } from 'socket.io-client';
import api from './api';

// Fallback URL if the setting hasn't been fetched yet
const FALLBACK_URL = 'https://webhook.silulumanzi.com:90';

// Cached URL — fetched once from sys_settings
let _cachedChatUrl: string | null = null;

function getToken(): string | null {
  return localStorage.getItem('jwt_token');
}

/**
 * Fetch the chat URL from sys_settings (key: silulumanzi_chat_url).
 * Caches the result in-memory. The stored value may use wss:// scheme
 * but Socket.IO polling needs https://, so we normalise it.
 */
export async function fetchChatUrl(): Promise<string> {
  if (_cachedChatUrl) return _cachedChatUrl;
  try {
    const res = await api.get<{ success: boolean; data: { value: string } }>('/settings/key/silulumanzi_chat_url');
    let url = res.data?.data?.value || FALLBACK_URL;
    // Socket.IO uses HTTPS for polling transport — normalise wss:// to https://
    url = url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    // Strip trailing slash
    url = url.replace(/\/+$/, '');
    _cachedChatUrl = url;
    return url;
  } catch {
    console.warn('[GroupsSocket] Failed to fetch silulumanzi_chat_url, using fallback');
    return FALLBACK_URL;
  }
}

/** Reset cached URL (call if settings change) */
export function resetChatUrlCache(): void {
  _cachedChatUrl = null;
}

/**
 * Create a Socket.IO connection to the /groups namespace.
 * Returns `null` if no auth token is available.
 * Now async because it fetches the URL from sys_settings on first call.
 */
export async function createGroupsSocket(): Promise<Socket | null> {
  const token = getToken();
  if (!token) {
    console.warn('[GroupsSocket] No auth token found');
    return null;
  }

  const chatUrl = await fetchChatUrl();

  if (process.env.NODE_ENV === 'development') {
    console.log('[GroupsSocket] Creating socket to', `${chatUrl}/groups`);
  }

  const socket = io(`${chatUrl}/groups`, {
    // Match the desktop Electron app exactly: polling only, no upgrade
    transports: ['polling'],
    upgrade: false,
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    timeout: 15000,
    withCredentials: false,
    extraHeaders: {},
  });

  socket.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GroupsSocket] Connected. id:', socket.id, 'transport:', socket.io.engine?.transport?.name);
    }
  });

  socket.on('disconnect', (reason) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GroupsSocket] Disconnected:', reason);
    }
  });

  socket.on('connect_error', (e) => {
    console.error('[GroupsSocket] Connection error:', e.message);
  });

  // GRP-005: Only log all events in development
  if (process.env.NODE_ENV === 'development') {
    socket.onAny((eventName: string, ...args: any[]) => {
      console.log('[GroupsSocket] EVENT:', eventName, args.length > 0 ? args : '');
    });
  }

  return socket;
}
