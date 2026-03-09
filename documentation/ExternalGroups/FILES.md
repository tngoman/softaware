# External Groups Module — File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 9 source files |
| **Total LOC** | ~2,060 |
| **Frontend page files** | 1 (549 LOC) |
| **Frontend sub-component files** | 4 (898 LOC) |
| **Frontend shared types/helpers** | 1 (158 LOC) |
| **Frontend barrel export** | 1 (6 LOC) |
| **Frontend service files** | 2 (323 LOC) |
| **Backend route files** | 0 (direct Socket.IO — bypasses backend) |

### Directory Tree

```
Frontend — Page & Sub-components:
  src/pages/general/GroupsPage.tsx                (549 LOC)  ⭐ main page orchestrator
  src/pages/general/groups/index.ts                 (6 LOC)     barrel exports
  src/pages/general/groups/chatTypes.ts           (158 LOC)  ⭐ shared types, constants & helpers
  src/pages/general/groups/ChatSidebar.tsx         (133 LOC)     group list sidebar
  src/pages/general/groups/ChatHeader.tsx          (131 LOC)     header bar + in-chat search
  src/pages/general/groups/MessageList.tsx         (369 LOC)  ⭐ message rendering + media + lightbox
  src/pages/general/groups/MessageInput.tsx        (265 LOC)     message compose + file attach

Frontend — Services:
  src/services/groupsSocket.ts                    (107 LOC)  ⭐ Socket.IO connection factory
  src/services/chatCache.ts                       (216 LOC)  ⭐ IndexedDB message cache (GRP-008)

Related files (not part of this module, but used by it):
  src/store/index.ts                               (~50 LOC relevant: useAppStore → user)
  src/services/api.ts                              (75 LOC)  — Axios client (used only for settings fetch)
```

---

## 2. Frontend Files — Page

### 2.1 `src/pages/general/GroupsPage.tsx` — Main Page Orchestrator

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/GroupsPage.tsx` |
| **LOC** | 549 |
| **Purpose** | Top-level page component for External Groups chat. Manages Socket.IO lifecycle, group/message state, search, unread counts, and composes all sub-components. |
| **Dependencies** | socket.io-client, react-hot-toast, @heroicons/react, useAppStore, groupsSocket, chatCache, groups/* sub-components |
| **Default Export** | `GroupsPage` (React.FC) |
| **Route** | `/groups` (via ProtectedRoute + Layout in App.tsx) |

#### Conversion Helpers

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `toCached(groupId, m)` | `string, UnifiedMessage` | `CachedMessage` | Converts a UnifiedMessage to CachedMessage for IndexedDB storage |
| `fromCached(c)` | `CachedMessage` | `UnifiedMessage` | Converts a CachedMessage back to UnifiedMessage for display |

#### Component State

| State Variable | Type | Default | Purpose |
|----------------|------|---------|---------|
| `extSocket` | `Socket \| null` | `null` | Socket.IO connection instance |
| `socketConnected` | `boolean` | `false` | Connection status flag |
| `externalGroups` | `UnifiedGroup[]` | `[]` | Full list of external groups from server |
| `selectedGroup` | `UnifiedGroup \| null` | `null` | Currently viewed group |
| `groupSearch` | `string` | `''` | Group list search filter |
| `messages` | `UnifiedMessage[]` | `[]` | Messages for selected group |
| `newMessage` | `string` | `''` | Current text input |
| `sendingMessage` | `boolean` | `false` | Send-in-progress flag |
| `loadingMessages` | `boolean` | `false` | Message fetch spinner |
| `attachedFiles` | `File[]` | `[]` | Pending file attachments |
| `sendingFile` | `boolean` | `false` | File upload spinner |
| `replyingTo` | `UnifiedMessage \| null` | `null` | Message being replied to |
| `searchQuery` | `string` | `''` | In-chat search text |
| `searchResults` | `{ messageId, index }[]` | `[]` | Matching message IDs |
| `currentSearchIdx` | `number` | `0` | Active result position |
| `lightboxSrc` | `string \| null` | `null` | Fullscreen image URL |
| `unreadCounts` | `Map<string, number>` | `new Map()` | Per-group unread badges |

#### Key Callbacks

| Callback | Description |
|----------|-------------|
| `handleGroupSelect(group)` | Selects group, loads cached messages, emits `groups-set-channel`, clears unread |
| `sendMessage(e?)` | Sends text or files via socket, handles reply threading |
| `searchNext()` / `searchPrev()` | Navigates search results with wraparound |
| `clearSearch()` | Resets search state |
| `scrollToBottom()` | Smooth-scrolls to latest message |

#### Socket Events Handled

| Event | Handler Action |
|-------|----------------|
| `connect` | `setSocketConnected(true)`, emit `join-groups` |
| `disconnect` | `setSocketConnected(false)` |
| `groups-list-updated` | Map to `UnifiedGroup[]`, update `externalGroups` |
| `new-group-message` | Dedup, append message, update group, notify if not selected, cache |
| `groups-channel-messages` | Map batch to `UnifiedMessage[]`, replace messages, cache |

---

## 3. Frontend Files — Sub-Components

### 3.1 `src/pages/general/groups/index.ts` — Barrel Export

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/index.ts` |
| **LOC** | 6 |
| **Purpose** | Re-exports all sub-components and shared types for clean imports |
| **Named Exports** | `ChatSidebar`, `ChatHeader`, `MessageList`, `MessageInput`, + all `chatTypes` exports |

---

### 3.2 `src/pages/general/groups/chatTypes.ts` — Shared Types & Helpers

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/chatTypes.ts` |
| **LOC** | 158 |
| **Purpose** | Constants, TypeScript interfaces, and utility functions shared across all sub-components |
| **Dependencies** | dompurify |

#### Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `MAX_FILE_SIZE` | `number` | `10485760` | 10 MB in bytes (GRP-002) |
| `MAX_FILE_SIZE_LABEL` | `string` | `'10 MB'` | Human-readable limit |

#### Interfaces

| Interface | Key Fields | Description |
|-----------|------------|-------------|
| `UnifiedGroup` | `id`, `name`, `last_message?`, `timestamp?`, `member_count?`, `description?`, `unread_count?` | External group representation. ID format: `"ext_{whatsapp_group_id}"` |
| `UnifiedMessage` | `id`, `text`, `user_id?`, `user_name`, `timestamp`, `direction?`, `message_type?`, `file_url?`, `file_name?`, `file_type?`, `file_size?`, `caption?`, `reply_to_message_id?`, `reply_to_content?`, `reply_to_user_name?` | Chat message representation |

#### Helper Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `getFileUrl(relativePath?)` | `string?` | `string` | Resolves relative paths against `https://portal.silulumanzi.com`; passes through absolute URLs and data URIs |
| `isImageMessage(content?)` | `string?` | `boolean` | Detects image URLs by extension or data URI |
| `isVideoMessage(content?)` | `string?` | `boolean` | Detects video URLs by extension or data URI |
| `isAudioMessage(content?)` | `string?` | `boolean` | Detects audio URLs by extension or data URI |
| `sanitizeMessage(message?)` | `string?` | `string` | DOMPurify sanitisation with `<br>` conversion (GRP-004) |
| `formatMessageTime(timestamp)` | `number` | `string` | Formats unix timestamp: time-only for today, date+time otherwise |
| `getInitials(name?)` | `string?` | `string` | Extracts 2-letter initials for avatar display |
| `fileToBase64(file)` | `File` | `Promise<string>` | Converts File to base64 data URI via FileReader |
| `requestNotificationPermission()` | — | `void` | Requests browser notification permission if not yet granted |
| `showBrowserNotification(title, body, tag)` | `string, string, string` | `void` | Shows native Notification with icon |
| `isOutgoingMessage(msg, currentUserNameLower?)` | `UnifiedMessage, string?` | `boolean` | Matches sender by display name (external user IDs don't map to local IDs) |

---

### 3.3 `src/pages/general/groups/ChatSidebar.tsx` — Group List Sidebar

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/ChatSidebar.tsx` |
| **LOC** | 133 |
| **Purpose** | Left sidebar panel showing searchable list of external groups with connection status, unread badges, and last message preview |
| **Dependencies** | @heroicons/react, chatTypes (UnifiedGroup, getInitials, formatMessageTime) |
| **Default Export** | `ChatSidebar` (React.memo) |

#### Props Interface: `ChatSidebarProps`

| Prop | Type | Description |
|------|------|-------------|
| `groups` | `UnifiedGroup[]` | Filtered and sorted group list |
| `selectedGroup` | `UnifiedGroup \| null` | Currently active group (highlighted) |
| `onSelectGroup` | `(group: UnifiedGroup) => void` | Group click handler |
| `socketConnected` | `boolean` | Connection status for indicator dot |
| `groupSearch` | `string` | Current search filter text |
| `onGroupSearchChange` | `(val: string) => void` | Search input handler |

#### Visual Features

- Header with GlobeAltIcon + "External Groups" title
- Live/Offline connection dot (green/gray)
- Search input with magnifying glass icon
- Group items: avatar (initials), name, GlobeAltIcon indicator, timestamp, unread badge
- Selected group: blue left border + blue tint background
- Empty state: "No groups available" or "No matching groups"

---

### 3.4 `src/pages/general/groups/ChatHeader.tsx` — Header Bar

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/ChatHeader.tsx` |
| **LOC** | 131 |
| **Purpose** | Top header bar for the active chat, showing group name, "External" badge, connection status, and toggle-able in-chat search bar |
| **Dependencies** | @heroicons/react, chatTypes (UnifiedGroup, getInitials) |
| **Default Export** | `ChatHeader` (React.memo) |

#### Props Interface: `ChatHeaderProps`

| Prop | Type | Description |
|------|------|-------------|
| `selectedGroup` | `UnifiedGroup` | Active group for display |
| `socketConnected` | `boolean` | Connection status text |
| `searchQuery` | `string` | Current search text |
| `onSearchQueryChange` | `(val: string) => void` | Search input handler |
| `searchResults` | `{ messageId, index }[]` | Match list for counter |
| `currentSearchIdx` | `number` | Active match position |
| `onSearchNext` | `() => void` | Navigate to next match |
| `onSearchPrev` | `() => void` | Navigate to previous match |
| `onClearSearch` | `() => void` | Reset search |

#### Visual Features

- Group avatar (initials) with gradient background
- Group name with indigo "External" pill badge
- "Connected" / "Reconnecting…" status text
- Toggle search: magnifying glass button (blue when active)
- Search bar: input + result counter (`N/M`) + up/down arrows + close button
- Keyboard: Enter → next match, Escape → close search

---

### 3.5 `src/pages/general/groups/MessageList.tsx` — Message Rendering

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/MessageList.tsx` |
| **LOC** | 369 |
| **Purpose** | Renders scrollable chat message list with media type detection, reply previews, search term highlighting, outgoing/incoming bubble styling, and image lightbox |
| **Dependencies** | @heroicons/react, chatTypes (all helpers and types) |
| **Default Export** | `MessageList` (React.memo) |

#### Internal Sub-Components

| Component | Props | Description |
|-----------|-------|-------------|
| `HighlightText` | `text, query, isCurrentMatch` | Wraps first search match in yellow/amber highlight span |
| `ImageLightbox` | `src, alt?, onClose` | Fullscreen black overlay with image, X close button |

#### Props Interface: `MessageListProps`

| Prop | Type | Description |
|------|------|-------------|
| `messages` | `UnifiedMessage[]` | Messages to render |
| `selectedGroup` | `UnifiedGroup` | Active group context |
| `loadingMessages` | `boolean` | Show loading spinner |
| `currentUserNameLower` | `string` | For outgoing message detection |
| `searchQuery` | `string` | For text highlighting |
| `searchResults` | `{ messageId, index }[]` | For highlight styling |
| `currentSearchIdx` | `number` | For current match emphasis |
| `onReply` | `(msg: UnifiedMessage) => void` | Reply action handler |
| `onLightbox` | `(src: string) => void` | Open image lightbox |
| `lightboxSrc` | `string \| null` | Current lightbox image |
| `onCloseLightbox` | `() => void` | Close lightbox |
| `messagesEndRef` | `React.RefObject<HTMLDivElement>` | Scroll-to-bottom anchor |

#### Message Rendering Logic

1. **Outgoing detection:** `isOutgoingMessage(msg, currentUserNameLower)` → right-aligned blue bubble
2. **Incoming:** Left-aligned white bubble with border
3. **Avatar:** Initials with blue (outgoing) or gray (incoming) background
4. **Reply preview:** If `reply_to_content` or `reply_to_message_id` → purple-bordered quote block
5. **Media priority:** Image → Video → Audio → Generic file → Inline media detection → Sanitised HTML text
6. **Caption:** Shown below file attachment if present
7. **Timestamp:** Clock icon + formatted time at bottom of bubble
8. **Reply button:** Visible on hover (group-hover opacity transition)

#### Smart Auto-Scroll

- Tracks scroll position via `isNearBottom` ref (120px threshold)
- Only auto-scrolls on new messages if user is near bottom
- Prevents jarring scroll jumps when reading history

---

### 3.6 `src/pages/general/groups/MessageInput.tsx` — Message Composer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/groups/MessageInput.tsx` |
| **LOC** | 265 |
| **Purpose** | Message composition area with text input, file attachment (click, paste, multi-select), reply preview, typing event emission, and send controls |
| **Dependencies** | react-hot-toast, @heroicons/react, chatTypes (UnifiedMessage, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL) |
| **Default Export** | `MessageInput` (React.memo) |

#### Props Interface: `MessageInputProps`

| Prop | Type | Description |
|------|------|-------------|
| `newMessage` | `string` | Current text value |
| `onMessageChange` | `(val: string) => void` | Text change handler |
| `attachedFiles` | `File[]` | Pending attachments |
| `onFilesChange` | `(files: File[]) => void` | Attachment list update |
| `replyingTo` | `UnifiedMessage \| null` | Message being replied to |
| `onCancelReply` | `() => void` | Dismiss reply |
| `sendingMessage` | `boolean` | Disable controls during send |
| `sendingFile` | `boolean` | Show spinner during upload |
| `onSend` | `(e?: FormEvent) => void` | Submit handler |
| `onTyping?` | `() => void` | Typing start event (GRP-011) |
| `onStopTyping?` | `() => void` | Typing stop event (GRP-011) |

#### Key Internal Functions

| Function | Description |
|----------|-------------|
| `validateFileSize(files)` | Filters files ≤ 10 MB, shows toast error for oversized (GRP-002) |
| `handlePaste(e)` | Detects pasted images from clipboard, converts to named File objects |
| `handleFileSelect(e)` | Processes file input selection with size validation |
| `removeFile(index)` | Removes single attachment by index |
| `handleInputChange(e)` | Updates text, auto-resizes textarea (max 200px), emits typing events |
| `handleKeyDown(e)` | Enter → send, Shift+Enter → newline |

#### Typing Events (GRP-011)

- On input change with content: calls `onTyping?.()`
- After 2s idle: calls `onStopTyping?.()`
- On Enter send: immediately calls `onStopTyping?.()` before sending

#### Visual Features

- Reply preview: purple left-border banner with sender name and truncated content
- File previews: 70×70 grid thumbnails with image preview or DocumentIcon
- Textarea: auto-resizing, max 200px height, rounded corners
- Send button: blue circle with PaperAirplaneIcon (or spinner during file send)
- Attach button: PaperClipIcon for file picker dialog
- Disabled state: all controls disabled during send/upload

---

## 4. Frontend Files — Services

### 4.1 `src/services/groupsSocket.ts` — Socket.IO Connection

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/services/groupsSocket.ts` |
| **LOC** | 107 |
| **Purpose** | Creates and configures the Socket.IO connection to the remote `/groups` namespace. Fetches server URL from sys_settings and caches it. |
| **Dependencies** | socket.io-client, api.ts (Axios) |
| **Named Exports** | `fetchChatUrl`, `resetChatUrlCache`, `createGroupsSocket` |

#### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `FALLBACK_URL` | `'https://webhook.silulumanzi.com:90'` | Used if sys_settings fetch fails |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `fetchChatUrl()` | — | `Promise<string>` | Fetches URL from `GET /api/settings/key/silulumanzi_chat_url`, normalises `wss://` → `https://`, caches in-memory |
| `resetChatUrlCache()` | — | `void` | Clears cached URL (call if settings change) |
| `createGroupsSocket()` | — | `Promise<Socket \| null>` | Creates Socket.IO connection to `{chatUrl}/groups` with polling transport, JWT auth, infinite reconnection. Returns `null` if no JWT token. |

#### Socket.IO Configuration

| Option | Value |
|--------|-------|
| `transports` | `['polling']` |
| `upgrade` | `false` |
| `auth` | `{ token: jwt_token }` |
| `reconnection` | `true` |
| `reconnectionDelay` | `2000` |
| `reconnectionDelayMax` | `10000` |
| `reconnectionAttempts` | `Infinity` |
| `timeout` | `15000` |
| `withCredentials` | `false` |

#### Development Logging

- `connect` → logs socket ID and transport name
- `disconnect` → logs reason
- `connect_error` → logs error message (always)
- `onAny` → logs all events with args (dev only)

---

### 4.2 `src/services/chatCache.ts` — IndexedDB Message Cache

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/services/chatCache.ts` |
| **LOC** | 216 |
| **Purpose** | IndexedDB-backed caching layer for chat messages. Provides instant message loading on group revisit before socket delivers fresh data. Shared with Team Chat. |
| **Dependencies** | None (native IndexedDB API) |
| **Named Exports** | `cacheMessages`, `appendCachedMessage`, `removeCachedMessage`, `getCachedMessages`, `clearGroupCache`, `clearAllChatCache` |
| **Named Types** | `CachedMessage` |

#### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DB_NAME` | `'softaware_chat_cache'` | IndexedDB database name |
| `DB_VERSION` | `1` | Schema version |
| `MSG_STORE` | `'messages'` | Object store name for messages |
| `META_STORE` | `'meta'` | Object store name for group metadata |
| `MAX_MESSAGES_PER_GROUP` | `200` | Cache trim threshold |

#### Schema

```
Database: softaware_chat_cache (v1)

Object Store: messages
  Key Path: [groupId, messageId]  (compound)
  Index: "by-group" on "groupId"

Object Store: meta
  Key Path: groupId
  Fields: { groupId, lastFetched, count }
```

#### Public Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `cacheMessages(groupId, messages)` | `string, CachedMessage[]` | `Promise<void>` | Replaces all cached messages for a group. Deletes existing, inserts new (trimmed to 200). Updates meta. |
| `appendCachedMessage(groupId, message)` | `string, CachedMessage` | `Promise<void>` | Inserts/updates a single message (for real-time events) |
| `removeCachedMessage(groupId, messageId)` | `string, string` | `Promise<void>` | Deletes one cached message |
| `getCachedMessages(groupId)` | `string` | `Promise<CachedMessage[]>` | Retrieves all messages for a group, sorted by timestamp ascending |
| `clearGroupCache(groupId)` | `string` | `Promise<void>` | Deletes all messages + meta for one group |
| `clearAllChatCache()` | — | `Promise<void>` | Clears entire database (used on logout) |

#### Internal Helpers

| Function | Description |
|----------|-------------|
| `openDb()` | Singleton IndexedDB open with onupgradeneeded handler for schema creation |
| `wrapRequest<T>(req)` | Wraps IDBRequest in a Promise |
| `wrapTransaction(tx)` | Wraps IDBTransaction in a Promise (resolves on complete, rejects on error/abort) |
