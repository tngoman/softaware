# External Groups Module — Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

This document catalogs the architecture patterns found in the External Groups module, covering the direct Socket.IO connection to a remote server, IndexedDB message caching, component decomposition, outgoing message detection by display name, and the unread badge counter system.

---

## 2. Architectural Patterns

### 2.1 Direct Socket.IO Pattern (No Backend Proxy)

**Context:** Unlike most modules in the platform that route all requests through the Express backend, External Groups connects **directly** from the React frontend to a remote Socket.IO server. The backend is only used for a single settings lookup to discover the server URL.

**Implementation:**

```typescript
// groupsSocket.ts — async socket factory

export async function createGroupsSocket(): Promise<Socket | null> {
  const token = getToken();                    // 1. Get JWT from localStorage
  if (!token) return null;

  const chatUrl = await fetchChatUrl();        // 2. Fetch URL from sys_settings

  const socket = io(`${chatUrl}/groups`, {     // 3. Connect to /groups namespace
    transports: ['polling'],                    //    Polling only (no WS upgrade)
    upgrade: false,
    auth: { token },                            //    JWT in auth object
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 15000,
  });

  return socket;
}
```

The page component manages the full socket lifecycle:

```typescript
// GroupsPage.tsx — socket setup in useEffect

useEffect(() => {
  let sock: Socket | null = null;
  let cancelled = false;

  (async () => {
    sock = await createGroupsSocket();
    if (cancelled || !sock) return;

    setExtSocket(sock);

    sock.on('connect', () => {
      setSocketConnected(true);
      sock!.emit('join-groups', { agentId: user.id, agentName, filterByParticipation: false });
    });

    sock.on('disconnect', () => setSocketConnected(false));
    sock.on('groups-list-updated', (groups) => { /* update state */ });
    sock.on('new-group-message', (msg) => { /* append + notify */ });
    sock.on('groups-channel-messages', (msgs) => { /* replace messages */ });
  })();

  return () => {
    cancelled = true;
    sock?.disconnect();
  };
}, [user?.id]);
```

**Benefits:**
- ✅ Zero backend load for real-time messaging — all traffic goes directly to remote server
- ✅ Lower latency — one hop instead of two (frontend → remote, not frontend → backend → remote)
- ✅ Backend outage doesn't affect ongoing chat (only initial URL fetch needs backend)
- ✅ Socket.IO handles reconnection automatically with exponential backoff
- ✅ Clean async factory pattern — socket creation is awaitable

**Drawbacks:**
- ❌ No server-side logging or auditing of messages
- ❌ No backend middleware (auth, rate limiting) on chat operations
- ❌ Frontend must handle all error scenarios independently
- ❌ Remote server URL change requires sys_settings update (no hot-reload — needs `resetChatUrlCache()`)
- ❌ Polling-only transport may have higher latency than native WebSocket

---

### 2.2 IndexedDB Cache-First Pattern (GRP-008)

**Context:** When a user selects a group, the socket must fetch message history from the remote server. This introduces a loading delay. To provide instant feedback, messages are cached in IndexedDB and shown immediately while the socket fetches fresh data.

**Implementation:**

```typescript
// GroupsPage.tsx — handleGroupSelect

const handleGroupSelect = useCallback(async (group: UnifiedGroup) => {
  setSelectedGroup(group);

  // 1. Load cached messages immediately
  const cached = await getCachedMessages(group.id);
  if (cached.length > 0) {
    setMessages(cached.map(fromCached));
    setLoadingMessages(false);              // No spinner needed
  } else {
    setMessages([]);
    setLoadingMessages(true);               // Show spinner
  }

  // 2. Request fresh data from socket (will replace cache on arrival)
  extSocket.emit('groups-set-channel', { agentId, channelId });
}, [extSocket, user]);
```

Cache is updated on two events:

```typescript
// Batch load — replace entire cache
sock.on('groups-channel-messages', (msgs) => {
  setMessages(formatted);
  cacheMessages(group.id, formatted.map(m => toCached(group.id, m)));
});

// Real-time message — append to cache
sock.on('new-group-message', (msg) => {
  setMessages(prev => [...prev, unified]);
  appendCachedMessage(extId, toCached(extId, unified));
});
```

**Benefits:**
- ✅ Instant message display on group revisit (no loading spinner)
- ✅ Bounded cache — maximum 200 messages per group (prevents storage bloat)
- ✅ Automatic replacement — fresh socket data always overwrites stale cache
- ✅ Graceful degradation — if IndexedDB fails, falls back to socket-only loading
- ✅ Shared cache service — same `chatCache.ts` used by Team Chat module

**Drawbacks:**
- ❌ Brief flash of stale data if messages were deleted on the server
- ❌ No TTL/expiry — cached messages remain until replaced or explicitly cleared
- ❌ IndexedDB cursor iteration for delete-and-replace is slower than a single `clear()`
- ❌ No cache invalidation signal from server — relies on batch replacement

---

### 2.3 Component Decomposition Pattern (GRP-012)

**Context:** The External Groups chat UI has significant complexity: group list, header with search, message rendering with multiple media types, and a composer with file handling. Keeping everything in a single file would exceed maintainable LOC thresholds.

**Implementation:**

```
GroupsPage.tsx (549 LOC) — orchestrator
  ├── ChatSidebar (133 LOC) — group list + search + status
  ├── ChatHeader (131 LOC) — group info + in-chat search
  ├── MessageList (369 LOC) — messages + media + lightbox
  └── MessageInput (265 LOC) — compose + files + reply + typing
```

All sub-components:
- Accept only the props they need (no prop drilling of unrelated state)
- Are wrapped in `React.memo` to prevent unnecessary re-renders
- Are exported via a barrel file (`groups/index.ts`) for clean imports
- Share types and helpers from `chatTypes.ts` (no duplicated interfaces)

```typescript
// GroupsPage.tsx — clean composition
<ChatSidebar groups={filteredGroups} selectedGroup={selectedGroup} onSelectGroup={handleGroupSelect} ... />
<ChatHeader selectedGroup={selectedGroup} searchQuery={searchQuery} ... />
<MessageList messages={messages} currentUserNameLower={currentUserNameLower} ... />
<MessageInput newMessage={newMessage} attachedFiles={attachedFiles} onSend={sendMessage} ... />
```

**Benefits:**
- ✅ Each component has a single clear responsibility
- ✅ `React.memo` prevents cascade re-renders (e.g., typing in input doesn't re-render message list)
- ✅ Components are individually testable
- ✅ Shared types prevent interface drift between components
- ✅ Barrel export keeps parent imports clean: `import { ChatSidebar, ChatHeader, ... } from './groups'`

**Drawbacks:**
- ❌ More files to navigate compared to a single-file approach
- ❌ Prop interfaces must be maintained in sync with parent state
- ❌ Some logic (e.g., search result scrolling) split between parent and child

---

### 2.4 Display Name Identity Matching Pattern

**Context:** The platform connects to the remote Socket.IO server as a single agent. The remote server has its own user ID system that does **not** correspond to local Softaware user IDs. Therefore, outgoing messages cannot be detected by comparing `msg.user_id` with `user.id`.

**Implementation:**

```typescript
// chatTypes.ts — identity matching by display name

export function isOutgoingMessage(
  msg: UnifiedMessage,
  currentUserNameLower?: string,
): boolean {
  if (currentUserNameLower && currentUserNameLower !== '') {
    const senderName = (msg.user_name || '').toLowerCase().trim();
    if (senderName !== '' && senderName === currentUserNameLower) return true;
  }
  return false;
}
```

The current user's identity is constructed in the parent:

```typescript
// GroupsPage.tsx
const currentUserFullName = useMemo(() => {
  const first = user.first_name || '';
  const last = user.last_name || '';
  return `${first} ${last}`.trim() || user.username || '';
}, [user]);

const currentUserNameLower = useMemo(
  () => currentUserFullName.toLowerCase().trim(),
  [currentUserFullName],
);
```

**Benefits:**
- ✅ Works without any ID mapping between systems
- ✅ Simple string comparison — no API call needed
- ✅ Case-insensitive and trimmed for robustness

**Drawbacks:**
- ❌ Name collisions: if two users have the same display name, both appear as outgoing
- ❌ Name changes: if user updates their name, old messages won't match
- ❌ Empty names: falls through to `false` (message appears as incoming)

---

### 2.5 Event-Driven Group Discovery Pattern

**Context:** The list of available external groups is not fetched via a REST API call. Instead, it's received as a socket event response after joining.

**Implementation:**

```typescript
// 1. Client joins with identity
sock.emit('join-groups', {
  agentId: user.id,
  agentName: currentUserFullName,
  filterByParticipation: false,           // Get all groups, not just participating
});

// 2. Server responds with group list
sock.on('groups-list-updated', (updatedGroups: any[]) => {
  const unified: UnifiedGroup[] = updatedGroups.map((g) => ({
    id: `ext_${g.whatsapp_group_id}`,
    name: g.group_name,
    last_message: g.last_message || undefined,
    timestamp: g.timestamp || 0,
    unread_count: 0,
  }));
  setExternalGroups(unified);
});
```

**Benefits:**
- ✅ Single connection handles both group discovery and messaging
- ✅ Group list updates are pushed in real-time (no polling)
- ✅ Agent identity established on join — server knows who's connected

**Drawbacks:**
- ❌ No group list until socket connects (brief empty state)
- ❌ `filterByParticipation: false` fetches ALL groups — no server-side filtering

---

### 2.6 Unread Counter Pattern (GRP-010)

**Context:** When messages arrive for groups the user isn't currently viewing, unread counts must be tracked and displayed as badges.

**Implementation:**

```typescript
// State: in-memory Map
const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

// Increment on new message for non-selected group
sock.on('new-group-message', (msg) => {
  const extId = `ext_${msg.channelId}`;
  const isCurrentGroup = selectedGroupRef.current?.id === extId;

  if (!isCurrentGroup) {
    setUnreadCounts((prev) => {
      const next = new Map(prev);
      next.set(extId, (next.get(extId) ?? 0) + 1);
      return next;
    });
  }
});

// Clear on group select
const handleGroupSelect = (group) => {
  setUnreadCounts((prev) => {
    const next = new Map(prev);
    next.delete(group.id);
    return next;
  });
};

// Merge into group list for display
const filteredGroups = useMemo(() => {
  return externalGroups.map((g) => ({
    ...g,
    unread_count: unreadCounts.get(g.id) ?? g.unread_count ?? 0,
  }));
}, [externalGroups, unreadCounts]);
```

**Benefits:**
- ✅ Immediate badge update without server roundtrip
- ✅ Map provides O(1) lookup and update per group
- ✅ Badge clears instantly on group select (before messages even load)
- ✅ Merged into group list via useMemo — no prop drilling

**Drawbacks:**
- ❌ Not persisted across page reloads (resets to 0)
- ❌ No server-side unread tracking — counts are approximate
- ❌ Ref-based selected group check (`selectedGroupRef`) needed to avoid stale closure

---

### 2.7 DOMPurify Message Sanitisation Pattern (GRP-004)

**Context:** Messages come from external WhatsApp groups and may contain untrusted HTML or script content. The message text is rendered via `dangerouslySetInnerHTML` for formatting support, so XSS prevention is critical.

**Implementation:**

```typescript
// chatTypes.ts — sanitisation with strict allowlist

export function sanitizeMessage(message?: string): string {
  if (!message || typeof message !== 'string') return 'Empty message';
  const withBreaks = message.replace(/\n/g, '<br>');
  return DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
}
```

Used in MessageList for text rendering:

```tsx
<div dangerouslySetInnerHTML={{ __html: sanitizeMessage(msg.text) }} />
```

**Benefits:**
- ✅ Strict allowlist — only formatting tags and safe attributes pass through
- ✅ Script tags, event handlers, and dangerous attributes are stripped
- ✅ Newlines preserved as `<br>` before sanitisation
- ✅ DOMPurify is a well-maintained, battle-tested library
- ✅ Empty/null messages handled gracefully (returns "Empty message")

**Drawbacks:**
- ❌ Rich formatting beyond the allowlist is stripped (tables, images in text, etc.)
- ❌ Search highlighting bypasses sanitisation (uses `HighlightText` component instead)

---

### 2.8 File-to-Base64 Upload Pattern

**Context:** Files are sent to the remote server via Socket.IO events, not HTTP multipart uploads. Socket.IO supports binary data, but the implementation uses base64 encoding for compatibility with the remote server's expected format.

**Implementation:**

```typescript
// chatTypes.ts — FileReader-based conversion
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

// GroupsPage.tsx — send loop
for (const file of attachedFiles) {
  const base64 = await fileToBase64(file);
  extSocket.emit('send-group-file', {
    channelId,
    file: { name: file.name, type: file.type, size: file.size, base64 },
    caption: newMessage.trim() || '',
    agentId: user.id,
    agentName: senderName,
    replyToId: replyingTo?.id || null,
  });
}
```

**Benefits:**
- ✅ Works over Socket.IO polling transport (no binary framing needed)
- ✅ File metadata (name, type, size) sent alongside data
- ✅ Caption support — text message accompanies file
- ✅ Reply threading preserved on file messages

**Drawbacks:**
- ❌ Base64 encoding increases payload size by ~33%
- ❌ 10 MB file becomes ~13.3 MB in transit
- ❌ No upload progress feedback (entire file sent in one event)
- ❌ Sequential file sending (loop with await) — not parallelised

---

## 3. UI Patterns

### 3.1 Outgoing vs Incoming Bubble Styling

Messages use a bi-directional layout based on sender identity:

| Aspect | Outgoing (self) | Incoming (others) |
|--------|----------------|-------------------|
| Alignment | Right (`flex-row-reverse ml-auto`) | Left (`mr-auto`) |
| Background | `bg-picton-blue text-white` | `bg-white text-gray-900 border` |
| Border radius | `rounded-br-md` (bottom-right squared) | `rounded-bl-md` (bottom-left squared) |
| Avatar colour | Blue | Gray |
| Reply button hover | `hover:bg-white/20` | `hover:bg-gray-100` |
| Username colour | `text-white/80` | `text-picton-blue` |
| Timestamp colour | `text-white/60` | `text-gray-400` |
| File link style | `bg-white/10 text-white/90` | `bg-gray-100 text-picton-blue` |

### 3.2 Media Type Detection Priority

The `MessageList` renders media in this priority order:

1. **Explicit file_url + image type** → `<img>` with click-to-lightbox
2. **Explicit file_url + video type** → `<video controls>`
3. **Explicit file_url + audio type** → `<audio controls>`
4. **Explicit file_url + other type** → Download link with DocumentIcon
5. **No file_url + video URL in text** → `<video controls>`
6. **No file_url + audio URL in text** → `<audio controls>`
7. **No file_url + image URL in text** → `<img>` with click-to-lightbox
8. **No file_url + search active** → `HighlightText` component
9. **No file_url + plain text** → DOMPurify-sanitised HTML

### 3.3 Connection Status Indicator

Connection status is displayed in two places:

| Location | Connected | Disconnected |
|----------|-----------|-------------|
| ChatSidebar header | Green dot + "Live" | Gray dot + "Offline" |
| ChatHeader subtitle | "Connected" | "Reconnecting…" |
