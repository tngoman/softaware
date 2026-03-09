# Mobile App — External Groups Wiring Guide

> **Purpose**: Step-by-step guide for the React Native developer to implement the External Groups (WhatsApp) chat feature in the mobile app.
> **Prerequisite docs**: `ExternalGroups/README.md`, `ExternalGroups/ROUTES.md`, `ExternalGroups/FIELDS.md`, `ExternalGroups/PATTERNS.md`
> **Cross-references**: `Mobile/CHAT_WIRING_GUIDE.md` (staff chat calls), `Mobile/APP_WIRING_AND_STATUS.md` (full app map)
> **Backend base URL**: `https://api.softaware.net.za`

---

## 1. Scope — What Exists vs. What's Needed

### ✅ Already Exists in the Mobile App

| Item | File | Notes |
|------|------|-------|
| Legacy `GroupsListScreen` | `screens/groups/GroupsListScreen.tsx` (99 LOC) | Uses REST `api/groups.ts` — internal team groups, **not** external WhatsApp groups |
| Legacy `GroupChatScreen` | `screens/groups/GroupChatScreen.tsx` (152 LOC) | Basic message list + input for internal groups |
| `api/groups.ts` | `src/api/groups.ts` | CRUD + members + messages for **internal** team groups |
| Staff Chat screens (9 screens) | `screens/groups/Chat*.tsx` etc. | Fully wired for the `/chat` namespace staff chat |
| `chatSocket.ts` service | `src/services/chatSocket.ts` | Staff chat `/chat` namespace — **not** reusable for external `/groups` namespace |
| IndexedDB-style cache | `src/services/chatDb.ts` | AsyncStorage-based cache for staff chat — can be extended |

### 🔨 To Build (This Guide)

The External Groups module is a **completely separate** chat system. It connects directly to a remote Socket.IO server (Silulumanzi webhook) via the `/groups` namespace, **bypasses the Softaware backend entirely** for messaging, and stores no messages in the local database.

| # | Feature | Complexity | Est. LOC |
|---|---------|-----------|----------|
| A | **Socket.IO `/groups` connection service** | Medium | ~150 |
| B | **External Groups list screen** | Medium | ~400 |
| C | **External Group chat screen** | High | ~800 |
| D | **Message cache (AsyncStorage)** | Low | ~200 |
| E | **Shared types & helpers** | Low | ~120 |
| F | **Rich media rendering** (images, video, audio, files) | Medium | ~250 |
| G | **File attachment & base64 upload** | Medium | ~200 |
| H | **In-chat search** | Low | ~150 |
| **Total** | | | **~2,270** |

### ❌ Intentionally Excluded from Mobile

| Feature | Reason |
|---------|--------|
| Browser desktop notifications | Mobile uses FCM push — not applicable |
| `dangerouslySetInnerHTML` sanitisation | React Native uses `<Text>` — no HTML rendering needed |
| Image lightbox (custom) | Reuse existing `ImageViewerModal` component |
| IndexedDB (browser API) | Use `AsyncStorage` instead |
| Clipboard image paste | Not applicable on mobile (use camera/gallery picker instead) |
| Drag-and-drop file attach | Not applicable on mobile |

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (React Native)                     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ ExternalGroupsListScreen                                      │ │
│  │  • Group list with search, unread badges, connection status   │ │
│  │  • Sorted by last activity, filterable                       │ │
│  └──────────────────┬───────────────────────────────────────────┘ │
│                      │ navigate with group param                   │
│  ┌──────────────────▼───────────────────────────────────────────┐ │
│  │ ExternalGroupChatScreen                                       │ │
│  │  • FlatList message rendering (inverted)                      │ │
│  │  • Rich media (images, video, audio, files)                   │ │
│  │  • Reply threading, in-chat search                            │ │
│  │  • File attach (camera, gallery, document)                    │ │
│  │  • Typing indicator emission                                  │ │
│  └──────────────────┬───────────────────────────────────────────┘ │
│                      │                                             │
│  ┌──────────────────▼───────────────────────────────────────────┐ │
│  │ Services                                                       │ │
│  │  • externalGroupsSocket.ts — Socket.IO /groups factory        │ │
│  │  • externalGroupsCache.ts — AsyncStorage message cache        │ │
│  │  • externalGroupsTypes.ts — Types & helpers                   │ │
│  └──────────────────┬───────────────────────────────────────────┘ │
│                      │                                             │
│  ┌──────────────────▼───────────────────────────────────────────┐ │
│  │ ExternalGroupsContext — React Context                          │ │
│  │  • socket instance, connection status                          │ │
│  │  • groups list, unread counts                                  │ │
│  │  • Selected group messages                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
            Socket.IO (polling transport)
            Auth: JWT token
            Namespace: /groups
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  REMOTE SOCKET.IO SERVER                           │
│  URL: from sys_settings (key: silulumanzi_chat_url)               │
│  Fallback: https://webhook.silulumanzi.com:90                     │
│  Namespace: /groups                                                │
│  Data source: WhatsApp Business API groups                        │
└──────────────────────────────────────────────────────────────────┘
```

**Critical distinction**: Unlike Staff Chat which routes through the Softaware backend (`/staff-chat/*` REST + `/chat` Socket.IO), External Groups connects the mobile app **directly** to the remote Silulumanzi server. The only backend interaction is a single `GET /api/settings/key/silulumanzi_chat_url` to discover the server URL.

---

## 3. New Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/services/externalGroupsSocket.ts` | Socket.IO connection factory for `/groups` namespace | ~150 |
| 2 | `src/services/externalGroupsCache.ts` | AsyncStorage message cache (200 msgs/group max) | ~200 |
| 3 | `src/types/externalGroups.ts` | TypeScript types + helper functions | ~120 |
| 4 | `src/contexts/ExternalGroupsContext.tsx` | React Context for socket, groups, messages, unread | ~300 |
| 5 | `src/screens/groups/ExternalGroupsListScreen.tsx` | Group list with search, badges, status | ~400 |
| 6 | `src/screens/groups/ExternalGroupChatScreen.tsx` | Full chat with media, reply, search, attach | ~800 |
| 7 | `src/components/ui/ExternalMessageBubble.tsx` | Message bubble with media rendering | ~250 |
| 8 | `src/hooks/useExternalGroupsSocket.ts` | Hook wiring socket events to context | ~150 |

**Existing files to modify:**

| File | Change |
|------|--------|
| `src/api/settings.ts` or `src/api/client.ts` | Add `getSettingByKey(key)` if not already available |
| `src/navigation/FeatureStacks.tsx` | Add `ExternalGroupsList` and `ExternalGroupChat` to `GroupsStack` |
| `src/navigation/types.ts` | Add route params for new screens |
| `src/screens/groups/ChatListScreen.tsx` | Add an "External" tab/button to navigate to external groups |
| `App.tsx` or root | Wrap with `ExternalGroupsProvider` |

---

## 4. TypeScript Types — `src/types/externalGroups.ts`

```typescript
// ─── External Group ─────────────────────────────────────

export interface ExternalGroup {
  id: string;                    // "ext_{whatsapp_group_id}"
  name: string;
  last_message?: string;
  timestamp?: number;            // Unix seconds
  unread_count: number;          // Managed locally, not from server
}

// ─── External Message ────────────────────────────────────

export interface ExternalMessage {
  id: string;
  text: string;
  user_id?: string | number;
  user_name: string;
  timestamp: number;             // Unix seconds
  direction?: string;
  message_type?: 'image' | 'video' | 'audio' | string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  caption?: string;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_user_name?: string;
}

// ─── Cached Message (AsyncStorage) ───────────────────────

export interface CachedExternalMessage extends ExternalMessage {
  groupId: string;
}

// ─── Socket Payloads ─────────────────────────────────────

export interface JoinGroupsPayload {
  agentId: number;
  agentName: string;
  filterByParticipation: boolean;
}

export interface SetChannelPayload {
  agentId: number;
  channelId: string;             // WhatsApp group ID (without ext_ prefix)
}

export interface SendMessagePayload {
  channelId: string;
  message: string;
  agentId: number;
  agentName: string;
  replyToId: string | null;
}

export interface SendFilePayload {
  channelId: string;
  file: {
    name: string;
    type: string;
    size: number;
    base64: string;              // Data URI
  };
  caption: string;
  agentId: number;
  agentName: string;
  replyToId: string | null;
}

// ─── Constants ───────────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024;          // 10 MB
export const MAX_FILE_SIZE_LABEL = '10 MB';
export const MAX_CACHED_MESSAGES_PER_GROUP = 200;
export const FILE_BASE_URL = 'https://portal.silulumanzi.com';
export const FALLBACK_SOCKET_URL = 'https://webhook.silulumanzi.com:90';

// ─── Helper Functions ────────────────────────────────────

/**
 * Resolve file URL — prepend base URL for relative paths,
 * pass through absolute URLs and data URIs.
 */
export function getFileUrl(relativePath?: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http') || relativePath.startsWith('data:')) {
    return relativePath;
  }
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${FILE_BASE_URL}${path}`;
}

/**
 * Detect if content is an image URL by extension or data URI.
 */
export function isImageUrl(content?: string): boolean {
  if (!content) return false;
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(content)
    || content.startsWith('data:image/');
}

/**
 * Detect if content is a video URL.
 */
export function isVideoUrl(content?: string): boolean {
  if (!content) return false;
  return /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i.test(content)
    || content.startsWith('data:video/');
}

/**
 * Detect if content is an audio URL.
 */
export function isAudioUrl(content?: string): boolean {
  if (!content) return false;
  return /\.(mp3|wav|ogg|aac|m4a|opus|flac|wma)(\?.*)?$/i.test(content)
    || content.startsWith('data:audio/');
}

/**
 * Check if a message is outgoing by display name comparison.
 * External user IDs do NOT correspond to local Softaware IDs,
 * so we match by display name (case-insensitive).
 */
export function isOutgoingMessage(
  msg: ExternalMessage,
  currentUserNameLower: string,
): boolean {
  const senderName = (msg.user_name || '').toLowerCase().trim();
  return senderName !== '' && senderName === currentUserNameLower;
}

/**
 * Get 2-letter initials from a display name.
 */
export function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/**
 * Format unix timestamp for display:
 * - Today: "14:30"
 * - Other: "5 Mar, 14:30"
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;

  const month = date.toLocaleString('default', { month: 'short' });
  return `${date.getDate()} ${month}, ${time}`;
}

/**
 * Map raw remote server message to ExternalMessage.
 * Handles inconsistent field names from the Silulumanzi server.
 */
export function mapRawMessage(raw: any): ExternalMessage {
  return {
    id: raw.id || raw.message_id || String(Date.now()),
    text: raw.message || raw.content || raw.caption || '',
    user_id: raw.userId || raw.user_id,
    user_name: raw.userName || raw.name || 'Unknown',
    timestamp: raw.timestamp || Math.floor(Date.now() / 1000),
    direction: raw.direction,
    message_type: raw.message_type,
    file_url: raw.file_url,
    file_name: raw.file_name,
    file_type: raw.file_type,
    file_size: raw.file_size,
    caption: raw.caption,
    reply_to_message_id: raw.reply_to_message_id,
    reply_to_content: raw.reply_to_content,
    reply_to_user_name: raw.reply_to_user_name,
  };
}

/**
 * Map raw remote group to ExternalGroup.
 */
export function mapRawGroup(raw: any): ExternalGroup {
  return {
    id: `ext_${raw.whatsapp_group_id}`,
    name: raw.group_name || 'Unnamed Group',
    last_message: raw.last_message || undefined,
    timestamp: raw.timestamp || 0,
    unread_count: 0,
  };
}

/**
 * Strip the ext_ prefix to get the raw WhatsApp group ID.
 */
export function stripExtPrefix(groupId: string): string {
  return groupId.replace(/^ext_/, '');
}
```

---

## 5. Socket Service — `src/services/externalGroupsSocket.ts`

```typescript
import io, { Socket } from 'socket.io-client';
import { getToken } from '../api/client'; // or however you read the JWT
import { FALLBACK_SOCKET_URL } from '../types/externalGroups';

let _cachedUrl: string | null = null;
let _socket: Socket | null = null;

/**
 * Fetch the remote Socket.IO server URL from sys_settings.
 * Caches in-memory after first fetch.
 */
export async function fetchExternalChatUrl(apiBaseUrl: string): Promise<string> {
  if (_cachedUrl) return _cachedUrl;

  try {
    const token = getToken();
    const res = await fetch(`${apiBaseUrl}/api/settings/key/silulumanzi_chat_url`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    let url: string = json?.data?.value || FALLBACK_SOCKET_URL;

    // Normalise: wss:// → https://, ws:// → http://
    url = url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    url = url.replace(/\/+$/, '');

    _cachedUrl = url;
    return url;
  } catch (err) {
    console.warn('[ExternalGroups] Failed to fetch chat URL, using fallback:', err);
    return FALLBACK_SOCKET_URL;
  }
}

/**
 * Clear the cached URL (call if sys_settings changes).
 */
export function resetChatUrlCache(): void {
  _cachedUrl = null;
}

/**
 * Create a Socket.IO connection to the remote /groups namespace.
 * Returns null if no JWT token is available.
 *
 * IMPORTANT: Uses polling-only transport to match the desktop app.
 */
export async function createExternalGroupsSocket(
  apiBaseUrl: string,
): Promise<Socket | null> {
  const token = getToken();
  if (!token) {
    console.warn('[ExternalGroups] No JWT token — cannot connect');
    return null;
  }

  const chatUrl = await fetchExternalChatUrl(apiBaseUrl);

  const socket = io(`${chatUrl}/groups`, {
    transports: ['polling'],       // Polling only — no WebSocket upgrade
    upgrade: false,
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
    timeout: 15000,
    withCredentials: false,
  });

  if (__DEV__) {
    socket.on('connect', () => console.log('[ExternalGroups] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[ExternalGroups] Disconnected:', reason));
    socket.on('connect_error', (err) => console.warn('[ExternalGroups] Error:', err.message));
  }

  _socket = socket;
  return socket;
}

/**
 * Get the current socket instance (if connected).
 */
export function getExternalGroupsSocket(): Socket | null {
  return _socket;
}

/**
 * Disconnect and clean up the socket.
 */
export function disconnectExternalGroups(): void {
  _socket?.disconnect();
  _socket = null;
}
```

---

## 6. Message Cache — `src/services/externalGroupsCache.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CachedExternalMessage, ExternalMessage } from '../types/externalGroups';
import { MAX_CACHED_MESSAGES_PER_GROUP } from '../types/externalGroups';

const CACHE_KEY_PREFIX = 'ext_group_msgs_';
const META_KEY = 'ext_group_meta';

/**
 * Cache all messages for a group (replaces existing cache).
 * Trims to MAX_CACHED_MESSAGES_PER_GROUP (200).
 */
export async function cacheMessages(
  groupId: string,
  messages: CachedExternalMessage[],
): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_CACHED_MESSAGES_PER_GROUP);
    await AsyncStorage.setItem(
      `${CACHE_KEY_PREFIX}${groupId}`,
      JSON.stringify(trimmed),
    );
  } catch (err) {
    console.warn('[ExtCache] Failed to cache messages:', err);
  }
}

/**
 * Append a single real-time message to the cache.
 */
export async function appendCachedMessage(
  groupId: string,
  message: CachedExternalMessage,
): Promise<void> {
  try {
    const key = `${CACHE_KEY_PREFIX}${groupId}`;
    const raw = await AsyncStorage.getItem(key);
    const existing: CachedExternalMessage[] = raw ? JSON.parse(raw) : [];
    existing.push(message);

    // Trim if over limit
    const trimmed = existing.slice(-MAX_CACHED_MESSAGES_PER_GROUP);
    await AsyncStorage.setItem(key, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[ExtCache] Failed to append message:', err);
  }
}

/**
 * Get cached messages for a group, sorted by timestamp ascending.
 */
export async function getCachedMessages(
  groupId: string,
): Promise<CachedExternalMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${groupId}`);
    if (!raw) return [];
    const messages: CachedExternalMessage[] = JSON.parse(raw);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) {
    console.warn('[ExtCache] Failed to read cache:', err);
    return [];
  }
}

/**
 * Clear cache for one group.
 */
export async function clearGroupCache(groupId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${groupId}`);
  } catch (err) {
    console.warn('[ExtCache] Failed to clear group cache:', err);
  }
}

/**
 * Clear all external group caches (call on logout).
 */
export async function clearAllExternalGroupCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const extKeys = allKeys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));
    if (extKeys.length > 0) {
      await AsyncStorage.multiRemove(extKeys);
    }
  } catch (err) {
    console.warn('[ExtCache] Failed to clear all caches:', err);
  }
}

/**
 * Convert an ExternalMessage to CachedExternalMessage.
 */
export function toCached(
  groupId: string,
  msg: ExternalMessage,
): CachedExternalMessage {
  return { ...msg, groupId };
}

/**
 * Convert a CachedExternalMessage back to ExternalMessage.
 */
export function fromCached(cached: CachedExternalMessage): ExternalMessage {
  const { groupId, ...msg } = cached;
  return msg;
}
```

---

## 7. React Context — `src/contexts/ExternalGroupsContext.tsx`

```typescript
import React, {
  createContext, useContext, useState, useEffect, useRef,
  useCallback, useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  createExternalGroupsSocket,
  disconnectExternalGroups,
} from '../services/externalGroupsSocket';
import {
  cacheMessages, appendCachedMessage, getCachedMessages,
  toCached, fromCached, clearAllExternalGroupCache,
} from '../services/externalGroupsCache';
import {
  ExternalGroup, ExternalMessage,
  mapRawGroup, mapRawMessage, stripExtPrefix,
} from '../types/externalGroups';

// API base URL — use the same constant as the rest of the app
const API_BASE = 'https://api.softaware.net.za';

interface ExternalGroupsContextType {
  groups: ExternalGroup[];
  selectedGroup: ExternalGroup | null;
  messages: ExternalMessage[];
  isConnected: boolean;
  loadingMessages: boolean;
  unreadCounts: Map<string, number>;
  selectGroup: (group: ExternalGroup) => void;
  sendMessage: (text: string, replyToId?: string | null) => void;
  sendFile: (
    file: { name: string; type: string; size: number; base64: string },
    caption: string,
    replyToId?: string | null,
  ) => void;
  refreshGroups: () => void;
  totalUnread: number;
}

const ExternalGroupsContext = createContext<ExternalGroupsContextType | null>(null);

export function useExternalGroups() {
  const ctx = useContext(ExternalGroupsContext);
  if (!ctx) throw new Error('useExternalGroups must be inside ExternalGroupsProvider');
  return ctx;
}

export function ExternalGroupsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [groups, setGroups] = useState<ExternalGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExternalGroup | null>(null);
  const [messages, setMessages] = useState<ExternalMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  const selectedGroupRef = useRef<ExternalGroup | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());

  // Current user identity for outgoing detection
  const agentName = useMemo(() => {
    if (!user) return '';
    return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '';
  }, [user]);

  // ─── Socket Lifecycle ────────────────────────────────

  useEffect(() => {
    if (!user?.id || !token) return;
    let cancelled = false;

    (async () => {
      const sock = await createExternalGroupsSocket(API_BASE);
      if (cancelled || !sock) return;
      setSocket(sock);

      sock.on('connect', () => {
        setIsConnected(true);
        sock.emit('join-groups', {
          agentId: user.id,
          agentName,
          filterByParticipation: false,
        });
      });

      sock.on('disconnect', () => setIsConnected(false));

      // ── Group list received
      sock.on('groups-list-updated', (rawGroups: any[]) => {
        const mapped = rawGroups.map(mapRawGroup);
        setGroups(mapped);
      });

      // ── Batch message history for selected group
      sock.on('groups-channel-messages', (rawMsgs: any[]) => {
        seenMessageIds.current.clear();
        const mapped = rawMsgs.map((m) => {
          const msg = mapRawMessage(m);
          seenMessageIds.current.add(msg.id);
          return msg;
        });
        setMessages(mapped);
        setLoadingMessages(false);

        // Cache
        const gId = selectedGroupRef.current?.id;
        if (gId) {
          cacheMessages(gId, mapped.map((m) => toCached(gId, m)));
        }
      });

      // ── Real-time incoming message
      sock.on('new-group-message', (raw: any) => {
        const extId = `ext_${raw.channelId}`;
        const msg = mapRawMessage(raw);
        const isCurrentGroup = selectedGroupRef.current?.id === extId;

        // Update group's last message
        setGroups((prev) =>
          prev.map((g) =>
            g.id === extId
              ? { ...g, last_message: msg.text, timestamp: msg.timestamp }
              : g
          ),
        );

        if (!isCurrentGroup) {
          // Increment unread
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            next.set(extId, (next.get(extId) ?? 0) + 1);
            return next;
          });
          // TODO: Show in-app toast notification
        } else {
          // Append to current conversation
          if (seenMessageIds.current.has(msg.id)) return;
          seenMessageIds.current.add(msg.id);
          setMessages((prev) => [...prev, msg]);
          appendCachedMessage(extId, toCached(extId, msg));
        }
      });
    })();

    return () => {
      cancelled = true;
      disconnectExternalGroups();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?.id, token]);

  // ── Clean up cache on logout
  useEffect(() => {
    if (!token) {
      clearAllExternalGroupCache();
      setGroups([]);
      setMessages([]);
      setUnreadCounts(new Map());
    }
  }, [token]);

  // ── Keep ref in sync with state
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // ─── Actions ─────────────────────────────────────────

  const selectGroup = useCallback(async (group: ExternalGroup) => {
    setSelectedGroup(group);
    seenMessageIds.current.clear();

    // Clear unread
    setUnreadCounts((prev) => {
      const next = new Map(prev);
      next.delete(group.id);
      return next;
    });

    // Load cache first
    const cached = await getCachedMessages(group.id);
    if (cached.length > 0) {
      setMessages(cached.map(fromCached));
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }

    // Request fresh from server
    if (socket) {
      socket.emit('groups-set-channel', {
        agentId: user!.id,
        channelId: stripExtPrefix(group.id),
      });
    }
  }, [socket, user]);

  const sendMessage = useCallback((text: string, replyToId?: string | null) => {
    if (!socket || !selectedGroup || !text.trim()) return;
    socket.emit('send-group-message', {
      channelId: stripExtPrefix(selectedGroup.id),
      message: text.trim(),
      agentId: user!.id,
      agentName,
      replyToId: replyToId || null,
    });
  }, [socket, selectedGroup, user, agentName]);

  const sendFile = useCallback((
    file: { name: string; type: string; size: number; base64: string },
    caption: string,
    replyToId?: string | null,
  ) => {
    if (!socket || !selectedGroup) return;
    socket.emit('send-group-file', {
      channelId: stripExtPrefix(selectedGroup.id),
      file,
      caption: caption || '',
      agentId: user!.id,
      agentName,
      replyToId: replyToId || null,
    });
  }, [socket, selectedGroup, user, agentName]);

  const refreshGroups = useCallback(() => {
    if (!socket || !user) return;
    socket.emit('join-groups', {
      agentId: user.id,
      agentName,
      filterByParticipation: false,
    });
  }, [socket, user, agentName]);

  // ─── Computed ────────────────────────────────────────

  const totalUnread = useMemo(() => {
    let sum = 0;
    unreadCounts.forEach((v) => (sum += v));
    return sum;
  }, [unreadCounts]);

  // ─── Provider ────────────────────────────────────────

  const value: ExternalGroupsContextType = {
    groups,
    selectedGroup,
    messages,
    isConnected,
    loadingMessages,
    unreadCounts,
    selectGroup,
    sendMessage,
    sendFile,
    refreshGroups,
    totalUnread,
  };

  return (
    <ExternalGroupsContext.Provider value={value}>
      {children}
    </ExternalGroupsContext.Provider>
  );
}
```

---

## 8. Navigation Updates

### 8a. Add routes to `src/navigation/types.ts`

```typescript
// Add to GroupsStackParamList:
ExternalGroupsList: undefined;
ExternalGroupChat: { group: ExternalGroup };
```

### 8b. Add screens to `src/navigation/FeatureStacks.tsx`

```typescript
import ExternalGroupsListScreen from '../screens/groups/ExternalGroupsListScreen';
import ExternalGroupChatScreen from '../screens/groups/ExternalGroupChatScreen';

// Inside GroupsStack:
<Stack.Screen
  name="ExternalGroupsList"
  component={ExternalGroupsListScreen}
  options={{ title: 'External Groups' }}
/>
<Stack.Screen
  name="ExternalGroupChat"
  component={ExternalGroupChatScreen}
  options={({ route }) => ({
    title: route.params.group.name,
  })}
/>
```

### 8c. Add entry point in ChatListScreen

Add a button or tab in the existing `ChatListScreen` header to navigate to external groups:

```tsx
// In ChatListScreen header right:
<TouchableOpacity onPress={() => navigation.navigate('ExternalGroupsList')}>
  <GlobeIcon size={24} color={theme.colors.primary} />
  {totalUnread > 0 && <Badge count={totalUnread} />}
</TouchableOpacity>
```

### 8d. Wrap with provider

In `App.tsx` (inside the auth-protected area):

```tsx
import { ExternalGroupsProvider } from './contexts/ExternalGroupsContext';

// Wrap around the admin/staff navigators:
<ExternalGroupsProvider>
  <AdminTabNavigator />
</ExternalGroupsProvider>
```

---

## 9. Screen Blueprints

### 9a. ExternalGroupsListScreen (~400 LOC)

**Route**: `ExternalGroupsList`

```
┌────────────────────────────────┐
│  ← External Groups    🔄      │  ← Header with refresh
├────────────────────────────────┤
│  🔍 Search groups...           │  ← Filter input
├────────────────────────────────┤
│  ● Connected                   │  ← Green/gray status dot
├────────────────────────────────┤
│  ┌──────────────────────────┐  │
│  │ 🌐 Water & Sanitation    │  │
│  │ "The update is deployed" │  │
│  │ 14:30            ③       │  │  ← Unread badge
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 🌐 Engineering Team      │  │
│  │ "Meeting at 3pm"         │  │
│  │ 13:45                    │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ 🌐 Finance Group         │  │
│  │ "Invoice attached"       │  │
│  │ 5 Mar, 10:22             │  │
│  └──────────────────────────┘  │
│                                │
│       No more groups           │
└────────────────────────────────┘
```

**Key behaviors**:
- Groups sorted by `timestamp` descending (most recent first)
- Search filters by group name (case-insensitive)
- Connection status indicator (green "Connected" / gray "Reconnecting…")
- Unread badge shows count (capped at "99+")
- Tap group → navigate to `ExternalGroupChat` with group param
- Pull-to-refresh → `refreshGroups()`
- Use `FlatList` for efficient rendering
- Reuse `Avatar` component with `getInitials()` and globe icon overlay

### 9b. ExternalGroupChatScreen (~800 LOC)

**Route**: `ExternalGroupChat`
**Params**: `{ group: ExternalGroup }`

```
┌────────────────────────────────┐
│  ← Water & Sanitation  🔍 📎  │  ← Header: back, search, attach
│  ● Connected · External        │  ← Status + "External" badge
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐  │
│  │ 👤 Thabo M.              │  │  ← Incoming (left-aligned)
│  │ "Good morning team"      │  │
│  │ 09:15                ↩️  │  │  ← Reply button
│  └──────────────────────────┘  │
│                                │
│         ┌────────────────────┐ │
│         │ You                │ │  ← Outgoing (right-aligned)
│         │ "Update deployed"  │ │
│         │ 09:18              │ │
│         └────────────────────┘ │
│                                │
│  ┌──────────────────────────┐  │
│  │ 👤 Sarah K.              │  │
│  │ ┌─────────────────────┐  │  │  ← Image message
│  │ │ 📷 photo.jpg         │  │  │
│  │ │ [image thumbnail]    │  │  │
│  │ └─────────────────────┘  │  │
│  │ "See the attached"       │  │  ← Caption
│  │ 09:20                ↩️  │  │
│  └──────────────────────────┘  │
│                                │
├────────────────────────────────┤
│  ┌ Reply to: Thabo M.      X┐ │  ← Reply preview (if replying)
│  │ "Good morning team"       │ │
│  └───────────────────────────┘ │
│  ┌────────────────────────┐ ➤  │  ← Message input + send
│  │ Type a message...       │   │
│  └────────────────────────┘    │
└────────────────────────────────┘
```

**Key components**:
- **FlatList (inverted)** for messages — most efficient for chat UIs on RN
- **ExternalMessageBubble** component — handles all media types
- **Smart auto-scroll** — only scroll to bottom if user is near bottom
- **Reply threading** — tap reply icon → shows reply preview bar above input
- **File attachment** — reuse existing `AttachmentPicker` component, validate 10 MB limit
- **In-chat search** — search icon in header toggles search bar with result navigation
- **Loading state** — show spinner while waiting for socket history, instant if cached
- **Typing indicator** — emit typing events on input change (2s idle timeout)
- **Outgoing detection** — `isOutgoingMessage(msg, currentUserNameLower)` for bubble direction

### 9c. ExternalMessageBubble (~250 LOC)

Renders a single message with media detection priority:

```
Priority order (same as web):
1. file_url + image type    → Image with tap-to-view
2. file_url + video type    → Video player (react-native-video)
3. file_url + audio type    → Audio player (VoiceNotePlayer)
4. file_url + other         → File download card (FileMessageBubble)
5. No file_url + image URL  → Image with tap-to-view
6. No file_url + video URL  → Video player
7. No file_url + audio URL  → Audio player
8. Plain text               → <Text> component
```

**Reuse existing components**:
- `ImageViewerModal` for full-screen image viewing
- `VoiceNotePlayer` for audio playback
- `FileMessageBubble` for file download cards
- `MediaThumbnail` for image/video thumbnails
- `Avatar` for user initials

---

## 10. Socket Event Reference

### Client → Server (emit from mobile)

| Event | Payload | When |
|-------|---------|------|
| `join-groups` | `{ agentId: number, agentName: string, filterByParticipation: boolean }` | On socket connect + reconnect |
| `groups-set-channel` | `{ agentId: number, channelId: string }` | User selects a group |
| `send-group-message` | `{ channelId, message, agentId, agentName, replyToId }` | User sends text |
| `send-group-file` | `{ channelId, file: { name, type, size, base64 }, caption, agentId, agentName, replyToId }` | User sends file |

### Server → Client (listen on mobile)

| Event | Payload | Action |
|-------|---------|--------|
| `groups-list-updated` | `any[]` (raw groups) | Map with `mapRawGroup()`, set groups state |
| `groups-channel-messages` | `any[]` (raw messages) | Map with `mapRawMessage()`, replace messages, cache |
| `new-group-message` | Single raw message + `channelId` | Append to current group or increment unread for other group |

---

## 11. REST API Reference

Only **one** REST endpoint is used by this module:

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/settings/key/silulumanzi_chat_url` | Fetch remote Socket.IO server URL | JWT Bearer |

**Response**: `{ success: true, data: { value: "https://webhook.silulumanzi.com:90" } }`

**Fallback**: If the request fails, use hardcoded `https://webhook.silulumanzi.com:90`.

---

## 12. File Sending Flow

### Converting Files to Base64 on React Native

React Native doesn't have the browser `FileReader` API. Use `react-native-fs` or the URI returned by the image/document picker:

```typescript
import RNFS from 'react-native-fs';

async function fileToBase64(uri: string, mimeType: string): Promise<string> {
  const base64Data = await RNFS.readFile(uri, 'base64');
  return `data:${mimeType};base64,${base64Data}`;
}
```

### Attachment Flow

```
User taps 📎 → AttachmentPicker opens (Camera, Gallery, Document)
  → User selects file(s)
  → Validate each file ≤ 10 MB
  → Show preview thumbnails in input area
  → User taps Send
  → For each file:
    → fileToBase64(uri, mimeType)
    → socket.emit('send-group-file', { channelId, file, caption, ... })
  → Clear attached files
```

### Dependencies for File Handling

```bash
# If not already installed:
npm install react-native-fs
npm install react-native-document-picker  # for documents
npm install react-native-image-picker     # for camera/gallery
```

> **Note**: If the app already uses `react-native-image-picker` and `react-native-document-picker` for the staff chat `AttachmentPicker`, reuse those — no new dependencies needed.

---

## 13. Key Differences from Staff Chat

Understanding these differences is critical for the mobile developer:

| Aspect | Staff Chat (`/chat`) | External Groups (`/groups`) |
|--------|---------------------|---------------------------|
| **Backend** | Softaware Express backend | Remote Silulumanzi server |
| **REST endpoints** | 48+ endpoints | 0 (only 1 settings lookup) |
| **Socket namespace** | `/chat` | `/groups` |
| **Socket transport** | WebSocket + polling fallback | **Polling only** (no WS upgrade) |
| **Message storage** | Local MySQL | Remote server only + local cache |
| **User ID mapping** | Same user UUIDs | **No mapping** — use display name matching |
| **Outgoing detection** | `sender_id === userId` | `msg.user_name === currentUserName` (name match) |
| **Delivery ticks** | Sent → Delivered → Read | None (no delivery status) |
| **Reactions** | Full emoji reactions | None |
| **Message editing** | Edit within 15 min | None |
| **Message deletion** | Delete for me / everyone | None |
| **Typing indicators** | Bidirectional | Outgoing only (emit to server) |
| **Push notifications** | FCM via backend | None from remote server |
| **File upload** | HTTP multipart to backend | **Base64 via Socket.IO** |
| **File size limit** | Server-configured | **10 MB** (client-enforced) |
| **Offline queue** | Full queue + retry | **None** (message lost if offline) |
| **Group management** | Create, edit, delete, add/remove members | Read-only group list from server |

---

## 14. Outgoing Message Detection — Important Gotcha

Since external user IDs don't map to local Softaware user IDs, the **only way** to detect outgoing messages is by comparing display names:

```typescript
// The agent's name must match EXACTLY what the remote server records
const agentName = user.name || `${user.first_name} ${user.last_name}`.trim();
const currentUserNameLower = agentName.toLowerCase().trim();

// Then for each message:
const isOutgoing = isOutgoingMessage(msg, currentUserNameLower);
```

**Known limitations**:
- If the user changes their profile name, old messages may switch from "outgoing" to "incoming" styling
- If two agents share the same name, both appear as outgoing
- Empty sender names default to incoming

**Recommendation**: Construct `agentName` using the same logic as the web frontend (first + last name, or username fallback) and ensure it matches what the `join-groups` event sends as `agentName`.

---

## 15. Reusable Components from Existing App

| Existing Component | Reuse For |
|--------------------|-----------|
| `Avatar` | Group and sender avatars with initials |
| `Badge` / `NotificationDot` | Unread count badges on groups |
| `GradientHeader` | Screen headers |
| `ImageViewerModal` | Full-screen image tap-to-view |
| `VoiceNotePlayer` | Audio message playback |
| `FileMessageBubble` | File download cards |
| `MediaThumbnail` | Image/video thumbnails in messages |
| `AttachmentPicker` | File attachment (camera, gallery, document) |
| `PaginatedList` | Group list with pull-to-refresh |
| `StateViews` | Loading, empty, and error states |
| `AppTextInput` | Message compose input |
| `AppButton` | Send button |

---

## 16. Implementation Checklist

### Phase 1 — Foundation (~2 days)

- [ ] Create `src/types/externalGroups.ts` — types, constants, helper functions
- [ ] Create `src/services/externalGroupsSocket.ts` — Socket.IO factory
- [ ] Create `src/services/externalGroupsCache.ts` — AsyncStorage cache
- [ ] Create `src/contexts/ExternalGroupsContext.tsx` — React Context + provider
- [ ] Wire `ExternalGroupsProvider` in App.tsx
- [ ] Add navigation routes + types
- [ ] Test: socket connects, groups-list-updated fires, groups appear in state

### Phase 2 — Groups List Screen (~1–2 days)

- [ ] Create `ExternalGroupsListScreen` — FlatList of groups
- [ ] Implement search filtering
- [ ] Implement unread badge display
- [ ] Show connection status indicator
- [ ] Sort groups by timestamp (most recent first)
- [ ] Add pull-to-refresh
- [ ] Add entry point button in `ChatListScreen` header (globe icon)
- [ ] Test: groups render, search filters, unread badges increment/clear

### Phase 3 — Chat Screen (~3–4 days)

- [ ] Create `ExternalGroupChatScreen` — inverted FlatList + input
- [ ] Create `ExternalMessageBubble` — media type detection + rendering
- [ ] Implement outgoing vs incoming bubble styling (name-based detection)
- [ ] Implement reply threading (reply icon → preview → send with replyToId)
- [ ] Implement cache-first loading (cached → show, then socket replaces)
- [ ] Implement smart auto-scroll (only if near bottom)
- [ ] Implement message deduplication (seenMessageIds Set)
- [ ] Implement typing event emission (2s idle timeout)
- [ ] Test: messages render, reply works, cached messages show instantly

### Phase 4 — File Attach + Media (~2 days)

- [ ] Wire file attachment using `AttachmentPicker`
- [ ] Implement `fileToBase64()` using `react-native-fs`
- [ ] Validate 10 MB file size limit with user-facing error
- [ ] Send files via `send-group-file` socket event
- [ ] Render image messages with tap-to-view (`ImageViewerModal`)
- [ ] Render video messages (inline player or open externally)
- [ ] Render audio messages (`VoiceNotePlayer`)
- [ ] Render file download cards (`FileMessageBubble`)
- [ ] Test: attach image → sends as base64 → appears in chat

### Phase 5 — Polish (~1 day)

- [ ] Implement in-chat search with result highlighting + navigation
- [ ] Add in-app toast for messages in non-selected groups
- [ ] Handle reconnection gracefully (re-emit `join-groups`, re-request channel)
- [ ] Clear cache on logout
- [ ] Handle edge case: socket null / not connected → show toast
- [ ] Test: full end-to-end flow, reconnection, search

---

## 17. Testing Strategy

| Test | How to Verify |
|------|--------------|
| **Socket connects** | Launch app → navigate to External Groups → status shows "Connected" |
| **Groups load** | Group list populates after socket connect |
| **Group select** | Tap group → messages load (cached first if available, then fresh) |
| **Send text** | Type message → send → message appears in group (via echo) |
| **Send file** | Attach image → send → base64 sent via socket → appears in group |
| **File size limit** | Attach 15 MB file → error toast "exceeds 10 MB limit" |
| **Incoming message** | Another user sends message → appears in real-time |
| **Unread badge** | Receive message for non-selected group → badge increments |
| **Badge clear** | Tap group → badge clears immediately |
| **Reply** | Tap reply → preview shows → send → message has reply context |
| **Outgoing detection** | Own messages right-aligned, others left-aligned |
| **Reconnection** | Toggle airplane mode → reconnects → groups reload |
| **Cache** | Select group → leave → return → messages show instantly from cache |
| **Search** | Search text → matching messages highlighted + navigable |
| **Image viewer** | Tap image → full-screen viewer opens |
| **Logout cleanup** | Logout → all external group cache cleared |

---

## 18. Cross-References

| Topic | Document |
|-------|----------|
| External Groups backend documentation | `ExternalGroups/README.md`, `ExternalGroups/ROUTES.md` |
| Data schema (types, IndexedDB, remote entities) | `ExternalGroups/FIELDS.md` |
| Architecture patterns (17 patterns) | `ExternalGroups/PATTERNS.md` |
| Staff Chat mobile wiring (calls, WebRTC) | `Mobile/CHAT_WIRING_GUIDE.md` |
| Scheduling mobile wiring | `Mobile/SCHEDULING_WIRING_GUIDE.md` |
| Cases mobile wiring | `Mobile/CASES_WIRING_GUIDE.md` |
| Full mobile app architecture | `Mobile/APP_WIRING_AND_STATUS.md` |

---

*Document created: auto-generated from ExternalGroups module documentation.*
*Estimated total effort: 9–13 days for one developer.*
