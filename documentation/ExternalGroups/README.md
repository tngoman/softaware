# External Groups Module — Overview

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Module Overview

### Purpose

The External Groups module provides real-time chat functionality with external WhatsApp groups via a remote Socket.IO server. Unlike internal team chat (Staff Chat at `/chat`), this module connects to an external Silulumanzi webhook server and does **not** store messages in the local database. The frontend provides a full chat experience with:

- **Real-Time Messaging** — Socket.IO connection to remote `/groups` namespace for live message delivery
- **Group List Sidebar** — Searchable external group list with unread badges, connection status, and last message preview
- **Rich Media Support** — Image, video, audio rendering inline; generic file download links; clipboard paste for images
- **Message Search** — In-chat search with highlight, result count, and prev/next navigation
- **Reply Threading** — Reply-to-message with inline preview of the original message
- **File Attachments** — Multi-file attach with 10 MB size limit, drag-and-drop, clipboard paste support
- **IndexedDB Message Cache** — Instant message loading on revisit before socket delivers fresh data (GRP-008)
- **Unread Badge Counters** — Per-group unread counts with visual badges (GRP-010)
- **Browser Notifications** — Desktop notifications and toast alerts for messages in non-selected groups
- **DOMPurify Sanitisation** — All message HTML sanitised before rendering (GRP-004)
- **Image Lightbox** — Click any image to view in a fullscreen overlay
- **Typing Events** — Typing indicator emission to the remote server (GRP-011)
- **Component Decomposition** — UI split into 4 reusable sub-components (GRP-012)

### Business Value

- Enables the Softaware platform to act as an agent console for external WhatsApp group conversations
- Single-agent model: the platform connects as one participant to the remote group messaging server
- No local message storage — all messages live on the remote server; IndexedDB cache is for UX performance only
- Outgoing message detection by display name matching (external user IDs do not correspond to local user IDs)
- Connection URL fetched from `sys_settings` (key: `silulumanzi_chat_url`) — configurable per deployment
- Polling transport only (matches the desktop Electron app for compatibility)
- Seamless reconnection with exponential backoff on connection loss

### Key Statistics

| Metric | Value |
|--------|-------|
| Frontend page files | 1 (GroupsPage.tsx — 549 LOC) |
| Frontend sub-component files | 4 (ChatSidebar, ChatHeader, MessageList, MessageInput) |
| Frontend shared types/helpers | 1 (chatTypes.ts — 158 LOC) |
| Frontend barrel export | 1 (index.ts — 6 LOC) |
| Frontend service files | 2 (groupsSocket.ts — 107 LOC, chatCache.ts — 216 LOC) |
| Backend route files | 0 (bypasses backend — direct Socket.IO to remote server) |
| Total frontend LOC | ~2,060 |
| Socket events (emitted) | 4 (join-groups, groups-set-channel, send-group-message, send-group-file) |
| Socket events (received) | 3 (groups-list-updated, groups-channel-messages, new-group-message) |
| IndexedDB tables | 2 (messages, meta) |
| localStorage keys | 1 (jwt_token for socket auth) |
| External dependencies | socket.io-client, dompurify, react-hot-toast, @heroicons/react |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ GroupsPage.tsx (549 LOC) — Main page orchestrator                      │  │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │  │
│  │  │ ChatSidebar  │  │ ChatHeader       │  │ MessageList             │  │  │
│  │  │ • Group list │  │ • Group info     │  │ • Message bubbles       │  │  │
│  │  │ • Search     │  │ • Status dot     │  │ • Media rendering       │  │  │
│  │  │ • Unread     │  │ • In-chat search │  │ • Reply previews        │  │  │
│  │  │ • Status     │  │ • Result nav     │  │ • Search highlights     │  │  │
│  │  └──────────────┘  └──────────────────┘  │ • Image lightbox        │  │  │
│  │  ┌──────────────────────────┐             └─────────────────────────┘  │  │
│  │  │ MessageInput             │                                          │  │
│  │  │ • Text compose           │                                          │  │
│  │  │ • File attach/paste      │                                          │  │
│  │  │ • Reply preview          │                                          │  │
│  │  │ • Typing events          │                                          │  │
│  │  │ • Send controls          │                                          │  │
│  │  └──────────────────────────┘                                          │  │
│  └──────────────┬─────────────────────────────────────────────────────────┘  │
│                 │                                                             │
│  ┌──────────────▼──────────┐   ┌──────────────────────────────────────────┐  │
│  │ chatTypes.ts (shared)   │   │ groupsSocket.ts (service)               │  │
│  │ • UnifiedGroup type     │   │ • fetchChatUrl() from sys_settings      │  │
│  │ • UnifiedMessage type   │   │ • createGroupsSocket() → Socket.IO     │  │
│  │ • sanitizeMessage()     │   │ • Polling transport, JWT auth           │  │
│  │ • Media type detection  │   │ • Auto-reconnect (∞ attempts)          │  │
│  │ • isOutgoingMessage()   │   │ • In-memory URL cache                   │  │
│  └─────────────────────────┘   └───────────────────┬─────────────────────┘  │
│                                                     │                        │
│  ┌──────────────────────────────────────────────────▼────────────────────┐   │
│  │ chatCache.ts (IndexedDB service)                                      │   │
│  │ • cacheMessages() — bulk save (trim to 200/group)                    │   │
│  │ • appendCachedMessage() — real-time single insert                    │   │
│  │ • getCachedMessages() — instant load on group select                 │   │
│  │ • clearGroupCache() / clearAllChatCache() — cleanup                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ useAppStore (Zustand) — provides current user identity               │   │
│  │ api.ts (Axios) — used only for fetching sys_settings chat URL        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┼───────────────────────────────────────────┘
                                   │
                    Socket.IO (polling transport)
                    Auth: JWT token from localStorage
                    Namespace: /groups
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     REMOTE SOCKET.IO SERVER                                   │
│                                                                              │
│  URL: https://webhook.silulumanzi.com:90 (or from sys_settings)             │
│  Namespace: /groups                                                          │
│                                                                              │
│  Incoming events (server → client):                                          │
│    • groups-list-updated    — Full group list payload                        │
│    • groups-channel-messages — Batch message history for selected group      │
│    • new-group-message       — Single real-time incoming message             │
│                                                                              │
│  Outgoing events (client → server):                                          │
│    • join-groups            — Register agent with identity                   │
│    • groups-set-channel     — Select a group / request message history       │
│    • send-group-message     — Send text message to group                    │
│    • send-group-file        — Send file with optional caption               │
│                                                                              │
│  Data source: WhatsApp Business API groups                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Note:** The Softaware backend is **not involved** in real-time messaging. The only backend interaction is a single GET request to `/api/settings/key/silulumanzi_chat_url` to discover the remote server URL. All chat data flows directly between the frontend and the remote Socket.IO server.

---

## 3. Data Flow

### 3.1 Socket Connection & Group Discovery

```
GroupsPage mounts → useEffect fires (depends on user.id)
  → createGroupsSocket() (async)
    → fetchChatUrl()
      → GET /api/settings/key/silulumanzi_chat_url  (backend)
      → Cache URL in-memory for subsequent calls
      → Normalise wss:// → https:// for polling transport
    → io(chatUrl + '/groups', { transports: ['polling'], auth: { token } })
  → Socket connects
    → setSocketConnected(true)
    → emit('join-groups', { agentId, agentName, filterByParticipation: false })

Server responds:
  → 'groups-list-updated' event fires
    → Map each group: { id: "ext_{whatsapp_group_id}", name, last_message, timestamp }
    → setExternalGroups(unified)
    → Groups appear in ChatSidebar
```

### 3.2 Group Selection & Message Loading

```
User clicks group in ChatSidebar
  → handleGroupSelect(group)
    → setSelectedGroup(group)
    → Clear search, reply, files state
    → Clear unread count for this group (GRP-010)
    → getCachedMessages(group.id) from IndexedDB
      → If cached: show immediately, setLoadingMessages(false)
      → If empty: show spinner, setLoadingMessages(true)
    → emit('groups-set-channel', { agentId, channelId: whatsappId })

Server responds:
  → 'groups-channel-messages' event fires
    → Map raw messages to UnifiedMessage[]
    → setMessages(formatted)
    → setLoadingMessages(false)
    → cacheMessages() → IndexedDB (trim to 200)
    → scrollToBottom()
```

### 3.3 Real-Time Message Reception

```
Socket fires 'new-group-message' event:
  → Extract extId = "ext_{channelId}"
  → Is this the currently selected group?

  If NOT current group:
    → showBrowserNotification(title, body)
    → toast() with 💬 icon
    → Increment unreadCounts Map for that group (GRP-010)
    → Update group.last_message and timestamp in externalGroups

  If current group:
    → Check seenMessageIds (dedup)
    → Map to UnifiedMessage
    → Append to messages state
    → appendCachedMessage() → IndexedDB
    → scrollToBottom()
```

### 3.4 Sending Messages

```
Text message:
  → User types in MessageInput → Enter (or click Send)
  → sendMessage() fires
    → emit('send-group-message', {
        channelId, message, agentId, agentName, replyToId
      })
    → Clear newMessage, replyingTo
    → scrollToBottom()

File message:
  → User attaches files (click, drag, or paste)
  → GRP-002: Validate each file ≤ 10 MB
  → On send:
    → setSendingFile(true)
    → For each file: fileToBase64(file)
    → emit('send-group-file', {
        channelId,
        file: { name, type, size, base64 },
        caption, agentId, agentName, replyToId
      })
    → Clear attachedFiles
    → setSendingFile(false)
```

### 3.5 In-Chat Search

```
User toggles search (magnifying glass icon in ChatHeader)
  → Shows inline search bar
  → On input change: setSearchQuery(value)

useEffect on [searchQuery, messages]:
  → Filter messages where text or userName includes query (case-insensitive)
  → Build searchResults array: [{ messageId, index }]
  → setCurrentSearchIdx(0)

useEffect on [currentSearchIdx, searchResults]:
  → Scroll to matching message element via getElementById + scrollIntoView

Navigation:
  → Next: (currentIdx + 1) % results.length
  → Prev: (currentIdx - 1 + results.length) % results.length
  → Escape: clearSearch()

MessageList renders HighlightText component:
  → Current match: amber-400 background
  → Other matches: yellow-200 background
```

---

## 4. Key Features

### 4.1 Real-Time Socket.IO Communication

The module uses Socket.IO with **polling transport only** (no WebSocket upgrade) to match the desktop Electron app's connection model. The connection is configured with:

| Setting | Value |
|---------|-------|
| Transport | `polling` (no upgrade) |
| Auth | JWT token from `localStorage.jwt_token` |
| Reconnection | Enabled, infinite attempts |
| Reconnection delay | 2s–10s (exponential backoff) |
| Connection timeout | 15s |
| Credentials | Disabled (`withCredentials: false`) |

The connection URL is fetched from the `sys_settings` table (key: `silulumanzi_chat_url`) via a single backend API call, then cached in-memory for subsequent reconnections.

### 4.2 Component Decomposition (GRP-012)

The UI is split into 4 focused sub-components, all exported from `pages/general/groups/`:

| Component | LOC | Responsibility |
|-----------|-----|----------------|
| `ChatSidebar` | 133 | Group list, search, connection status, unread badges |
| `ChatHeader` | 131 | Group info, "External" badge, in-chat search toggle and controls |
| `MessageList` | 369 | Message rendering, media, replies, search highlights, lightbox |
| `MessageInput` | 265 | Text compose, file attach/paste, reply preview, typing events |

All sub-components are wrapped in `React.memo` for performance optimisation. The parent `GroupsPage` orchestrates state and passes props down.

### 4.3 IndexedDB Message Cache (GRP-008)

Messages are cached locally in IndexedDB for instant loading:

- **On group select:** Cached messages load immediately while socket fetches fresh data
- **On batch load:** Full message set replaces cache (trimmed to 200 per group)
- **On real-time message:** Single message appended to cache
- **On logout:** `clearAllChatCache()` wipes all cached data

The cache uses a compound key `[groupId, messageId]` with a `by-group` index for efficient per-group queries.

### 4.4 Rich Media Message Rendering

The `MessageList` component handles multiple media types:

| Media Type | Detection Method | Rendering |
|------------|-----------------|-----------|
| Image | `message_type === 'image'` or `file_type.startsWith('image/')` | `<img>` with click-to-lightbox |
| Video | `message_type === 'video'` or `file_type.startsWith('video/')` | `<video controls>` |
| Audio | `message_type === 'audio'` or `file_type.startsWith('audio/')` | `<audio controls>` |
| Document | file_url present, not image/video/audio | Download link with DocumentIcon |
| Inline image | `isImageMessage(text)` — detects URLs ending in image extensions | `<img>` with click-to-lightbox |
| Inline video | `isVideoMessage(text)` — detects URLs ending in video extensions | `<video controls>` |
| Inline audio | `isAudioMessage(text)` — detects URLs ending in audio extensions | `<audio controls>` |
| Text | Default | DOMPurify-sanitised HTML with `<br>` conversion |

File URLs are resolved via `getFileUrl()` which prepends `https://portal.silulumanzi.com` for relative paths.

### 4.5 Unread Badge System (GRP-010)

Each group tracks unread message counts:

- **Increment:** When `new-group-message` arrives for a non-selected group
- **Clear:** When user selects a group via `handleGroupSelect`
- **Display:** Badge in `ChatSidebar` shows count (capped at "99+")
- **Visual weight:** Unread groups show bold name and medium-weight last message text
- **Storage:** In-memory `Map<string, number>` (not persisted across sessions)

### 4.6 Message Sanitisation (GRP-004)

All message content is sanitised with DOMPurify before rendering:

```typescript
DOMPurify.sanitize(withBreaks, {
  ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
});
```

Newlines are converted to `<br>` tags before sanitisation. This prevents XSS attacks from untrusted external message content while preserving basic formatting.

### 4.7 File Attachment System (GRP-002)

Files are sent to the remote server as base64-encoded data:

| Feature | Detail |
|---------|--------|
| Max file size | 10 MB per file |
| Accepted types | Images, video, audio, PDF, Office docs, text, archives |
| Attach methods | File picker button, clipboard paste (images), multi-file |
| Preview | Image thumbnails (70×70), document icon for non-images |
| Validation | Per-file size check with toast error on rejection |
| Upload encoding | `fileToBase64()` → data URI → sent via socket event |
| Caption support | Text input acts as caption when files are attached |

### 4.8 Reply Threading

Users can reply to specific messages:

- **Initiate:** Hover over message → click reply icon (ArrowUturnLeftIcon)
- **Preview:** Purple-bordered reply banner in MessageInput with sender name and truncated content
- **Cancel:** X button to dismiss reply
- **Send:** `replyToId` included in `send-group-message` / `send-group-file` events
- **Display:** Replied messages show a purple-bordered quote block above the message content
- **Resolution:** Reply content resolved from `reply_to_content` field or by finding `reply_to_message_id` in loaded messages

### 4.9 Browser Notifications

Desktop notifications are triggered for messages arriving in non-selected groups:

- **Permission:** Requested on component mount via `requestNotificationPermission()`
- **Notification:** Native `Notification` API with title (sender name), body (message text), and app icon
- **Tag:** `group-{channelId}` — prevents duplicate notifications per group
- **Toast:** Concurrent toast alert with 💬 icon, 4s duration, top-right position

### 4.10 Outgoing Message Detection

Since the platform connects as a single agent to the remote server, external user IDs don't correspond to local user IDs. Outgoing messages are detected by **display name matching**:

```typescript
export function isOutgoingMessage(msg, currentUserNameLower): boolean {
  const senderName = (msg.user_name || '').toLowerCase().trim();
  return senderName !== '' && senderName === currentUserNameLower;
}
```

The current user's full name is constructed from `user.first_name + user.last_name` (or `user.username` fallback).

---

## 5. Security

| Feature | Detail |
|---------|--------|
| Socket auth | JWT token from `localStorage.jwt_token` sent in Socket.IO `auth` object |
| Message sanitisation | DOMPurify with strict allowlist (GRP-004) — prevents XSS from external content |
| File size limit | 10 MB max per file (GRP-002) — enforced client-side before base64 encoding |
| Transport | HTTPS polling only — no raw WebSocket (matches desktop app) |
| Credential exposure | No external credentials involved — single JWT authenticates the agent |
| CORS | `withCredentials: false` — no cookies sent to remote server |
| Content rendering | `dangerouslySetInnerHTML` used only after DOMPurify sanitisation |
| URL handling | `getFileUrl()` validates absolute URLs and data URIs — only prepends base for relative paths |
| ID isolation | External group IDs prefixed with `ext_` to avoid collision with any local IDs |

---

## 6. Configuration

| Setting | Source | Value |
|---------|--------|-------|
| Chat server URL | `sys_settings.silulumanzi_chat_url` (fetched via backend API) | Default: `https://webhook.silulumanzi.com:90` |
| File base URL | Hardcoded in `chatTypes.ts` | `https://portal.silulumanzi.com` |
| Frontend route | App.tsx route config | `/groups` |
| API Base URL | `REACT_APP_API_URL` env var | Used only for fetching sys_settings |
| JWT token | `localStorage.jwt_token` | Passed to Socket.IO auth |

| Hardcoded Constant | File | Value |
|--------------------|------|-------|
| MAX_FILE_SIZE | chatTypes.ts | 10,485,760 (10 MB) |
| MAX_MESSAGES_PER_GROUP | chatCache.ts | 200 |
| DB_NAME | chatCache.ts | `softaware_chat_cache` |
| DB_VERSION | chatCache.ts | 1 |
| FALLBACK_URL | groupsSocket.ts | `https://webhook.silulumanzi.com:90` |
| Reconnection delay | groupsSocket.ts | 2,000–10,000 ms |
| Reconnection attempts | groupsSocket.ts | Infinity |
| Connection timeout | groupsSocket.ts | 15,000 ms |
| Auto-scroll threshold | MessageList.tsx | 120 px from bottom |
| Typing timeout | MessageInput.tsx | 2,000 ms |
| Toast duration | GroupsPage.tsx | 4,000 ms |
| Notification tag pattern | GroupsPage.tsx | `group-{channelId}` |

---

## 7. Relationship to Other Chat Systems

The Softaware platform has multiple chat systems. External Groups is distinct:

| System | Route | Backend | Storage | Purpose |
|--------|-------|---------|---------|---------|
| **External Groups** (this module) | `/groups` | None (direct Socket.IO) | Remote server + IndexedDB cache | WhatsApp group conversations |
| Staff Chat | `/chat` | `staffChatSocket.ts` / `chatSocket.ts` | Local MySQL | Internal team messaging |
| Team Chat | `/teams` | `teamChatSocket.ts` | Local MySQL | Team-based internal chat |

External Groups is the **only** chat module that bypasses the local backend entirely for messaging.
