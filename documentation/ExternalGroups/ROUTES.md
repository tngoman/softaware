# External Groups Module — Socket Events (API Routes)

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total socket events** | 7 |
| **Client → Server (emitted)** | 4 |
| **Server → Client (received)** | 3 |
| **REST API endpoints** | 1 (settings lookup only) |
| **Socket namespace** | `/groups` |
| **Transport** | Polling only (no WebSocket upgrade) |
| **Default auth** | JWT token in Socket.IO `auth` object |

**Important:** External Groups does **not** use REST API routes for messaging. All real-time communication happens via Socket.IO events directly between the frontend and the remote Silulumanzi webhook server. The only REST interaction is fetching the server URL from `sys_settings`.

---

## 2. Event Directory

| # | Direction | Event Name | Auth | Purpose |
|---|-----------|------------|------|---------|
| 1 | → Server | `join-groups` | JWT | Register agent and request group list |
| 2 | ← Client | `groups-list-updated` | — | Receive full group list |
| 3 | → Server | `groups-set-channel` | JWT | Select a group / request message history |
| 4 | ← Client | `groups-channel-messages` | — | Receive batch message history |
| 5 | ← Client | `new-group-message` | — | Receive single real-time message |
| 6 | → Server | `send-group-message` | JWT | Send text message to group |
| 7 | → Server | `send-group-file` | JWT | Send file with optional caption |

---

## 3. REST API — Settings Lookup

### 3.1 GET /api/settings/key/silulumanzi_chat_url

**Purpose:** Fetch the remote Socket.IO server URL from the `sys_settings` table.

**Auth:** JWT Bearer token (via Axios interceptor)

**Request:**

```bash
curl "https://api.softaware.net.za/api/settings/key/silulumanzi_chat_url" \
  -H "Authorization: Bearer {jwt_token}"
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "value": "https://webhook.silulumanzi.com:90"
  }
}
```

**Frontend Handling:**
- URL is normalised: `wss://` → `https://`, `ws://` → `http://`, trailing slashes stripped
- Cached in-memory (`_cachedChatUrl`) — subsequent calls skip the API request
- Falls back to `https://webhook.silulumanzi.com:90` on error

---

## 4. Socket Events — Client → Server (Emitted)

### 4.1 `join-groups` — Register Agent

**Purpose:** Register the agent's identity on the remote server and trigger the initial group list delivery.

**Emitted by:** `GroupsPage.tsx` on socket `connect` event

**Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `number` | ✅ | Local Softaware user ID (`user.id`) |
| `agentName` | `string` | ✅ | Agent display name (first + last name, or username) |
| `filterByParticipation` | `boolean` | ✅ | `false` = get all groups, `true` = only groups agent participates in |

**Example:**

```typescript
sock.emit('join-groups', {
  agentId: 42,
  agentName: 'John Doe',
  filterByParticipation: false,
});
```

**Expected server response:** `groups-list-updated` event with full group list

**Notes:**
- Called on initial connect AND on reconnect (via `connect` event handler)
- `filterByParticipation` is always set to `false` in the current implementation — the agent sees all available groups

---

### 4.2 `groups-set-channel` — Select Group / Load Messages

**Purpose:** Tell the server which group the agent wants to view. Triggers batch message history delivery.

**Emitted by:** `GroupsPage.tsx` in `handleGroupSelect` callback

**Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agentId` | `number` | ✅ | Local Softaware user ID |
| `channelId` | `string` | ✅ | WhatsApp group ID (without `ext_` prefix) |

**Example:**

```typescript
// group.id = "ext_120363047890456789@g.us"
const whatsappId = group.id.replace('ext_', '');
extSocket.emit('groups-set-channel', {
  agentId: 42,
  channelId: '120363047890456789@g.us',
});
```

**Expected server response:** `groups-channel-messages` event with message history

**Notes:**
- The `ext_` prefix is stripped before sending — the server uses raw WhatsApp group IDs
- This also implicitly tells the server to route future `new-group-message` events for this channel to this agent

---

### 4.3 `send-group-message` — Send Text Message

**Purpose:** Send a text message to the currently selected group.

**Emitted by:** `GroupsPage.tsx` in `sendMessage` callback

**Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelId` | `string` | ✅ | WhatsApp group ID (without `ext_` prefix) |
| `message` | `string` | ✅ | Message text content (trimmed) |
| `agentId` | `number` | ✅ | Local Softaware user ID |
| `agentName` | `string` | ✅ | Agent display name |
| `replyToId` | `string \| null` | ❌ | ID of message being replied to, or `null` |

**Example:**

```typescript
extSocket.emit('send-group-message', {
  channelId: '120363047890456789@g.us',
  message: 'Hello team, the update is deployed.',
  agentId: 42,
  agentName: 'John Doe',
  replyToId: null,
});
```

**Expected behaviour:** Message appears in the group via `new-group-message` event (echo)

---

### 4.4 `send-group-file` — Send File with Caption

**Purpose:** Send a file attachment (image, document, etc.) to the currently selected group, with an optional text caption.

**Emitted by:** `GroupsPage.tsx` in `sendMessage` callback (when `attachedFiles.length > 0`)

**Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channelId` | `string` | ✅ | WhatsApp group ID (without `ext_` prefix) |
| `file` | `object` | ✅ | File data object (see below) |
| `file.name` | `string` | ✅ | Original file name |
| `file.type` | `string` | ✅ | MIME type (e.g., `image/png`) |
| `file.size` | `number` | ✅ | File size in bytes |
| `file.base64` | `string` | ✅ | Base64-encoded data URI |
| `caption` | `string` | ❌ | Optional text caption (empty string if none) |
| `agentId` | `number` | ✅ | Local Softaware user ID |
| `agentName` | `string` | ✅ | Agent display name |
| `replyToId` | `string \| null` | ❌ | ID of message being replied to, or `null` |

**Example:**

```typescript
const base64 = await fileToBase64(file);
extSocket.emit('send-group-file', {
  channelId: '120363047890456789@g.us',
  file: {
    name: 'screenshot_1709730000000.png',
    type: 'image/png',
    size: 245760,
    base64: 'data:image/png;base64,iVBORw0KGgo...',
  },
  caption: 'See the attached screenshot',
  agentId: 42,
  agentName: 'John Doe',
  replyToId: null,
});
```

**Notes:**
- Files are sent sequentially (loop with `await fileToBase64`)
- GRP-002: Files must be ≤ 10 MB (validated client-side before encoding)
- Caption comes from the text input field when files are attached
- Multiple files result in multiple `send-group-file` emissions

---

## 5. Socket Events — Server → Client (Received)

### 5.1 `groups-list-updated` — Group List

**Purpose:** Delivers the complete list of available external groups.

**Triggered by:** `join-groups` emission, or server-side group changes

**Payload:** `any[]` — Array of raw group objects from the remote server

**Raw group object shape:**

| Field | Type | Description |
|-------|------|-------------|
| `whatsapp_group_id` | `string` | WhatsApp group identifier |
| `group_name` | `string` | Display name of the group |
| `last_message` | `string?` | Most recent message text |
| `timestamp` | `number?` | Unix timestamp of last activity |

**Frontend Mapping:**

```typescript
const unified: UnifiedGroup[] = updatedGroups.map((g) => ({
  id: `ext_${g.whatsapp_group_id}`,       // Prefixed with ext_
  name: g.group_name,
  last_message: g.last_message || undefined,
  timestamp: g.timestamp || 0,
  unread_count: 0,                          // Initialized to 0, managed locally
}));
setExternalGroups(unified);
```

---

### 5.2 `groups-channel-messages` — Batch Message History

**Purpose:** Delivers the full message history for a selected group channel.

**Triggered by:** `groups-set-channel` emission

**Payload:** `any[]` — Array of raw message objects from the remote server

**Raw message object shape:**

| Field | Type | Description |
|-------|------|-------------|
| `id` / `message_id` | `string` | Unique message identifier |
| `message` / `content` | `string` | Message text content |
| `caption` | `string?` | File caption |
| `userId` / `user_id` | `string \| number?` | Sender's user ID on remote server |
| `userName` / `name` | `string` | Sender display name |
| `timestamp` | `number` | Unix timestamp (seconds) |
| `direction` | `string?` | Message direction |
| `message_type` | `string?` | `image`, `video`, `audio`, or text |
| `file_url` | `string?` | Relative or absolute URL to attached file |
| `file_name` | `string?` | Original file name |
| `file_type` | `string?` | MIME type of attached file |
| `file_size` | `number?` | File size in bytes |
| `reply_to_message_id` | `string?` | ID of the message being replied to |

**Frontend Handling:**

```typescript
sock.on('groups-channel-messages', (msgs: any[]) => {
  seenMessageIds.current.clear();

  const formatted: UnifiedMessage[] = msgs.map((m) => {
    const id = m.id || m.message_id;
    seenMessageIds.current.add(id);
    return {
      id,
      text: m.message || m.content || m.caption || '',
      user_id: m.userId || m.user_id,
      user_name: m.userName || m.name || 'Unknown',
      timestamp: m.timestamp,
      // ... remaining fields
    };
  });

  setMessages(formatted);
  setLoadingMessages(false);

  // Cache in IndexedDB (GRP-008)
  cacheMessages(group.id, formatted.map(m => toCached(group.id, m)));
  scrollToBottom();
});
```

**Notes:**
- Replaces all current messages (not appended)
- Clears and rebuilds the `seenMessageIds` set (dedup)
- Triggers IndexedDB cache update
- Auto-scrolls to bottom after rendering

---

### 5.3 `new-group-message` — Real-Time Incoming Message

**Purpose:** Delivers a single new message from any group in real-time.

**Triggered by:** Any participant (including the agent) sending a message in any group

**Payload:** Single raw message object (same shape as items in `groups-channel-messages`)

**Additional fields on real-time messages:**

| Field | Type | Description |
|-------|------|-------------|
| `channelId` | `string` | WhatsApp group ID this message belongs to |

**Frontend Handling:**

```typescript
sock.on('new-group-message', (msg: any) => {
  const extId = `ext_${msg.channelId}`;
  const isCurrentGroup = selectedGroupRef.current?.id === extId;

  // Always: Update group's last_message and timestamp
  setExternalGroups((prev) =>
    prev.map((g) =>
      g.id === extId ? { ...g, last_message: msg.message || msg.content, timestamp: msg.timestamp } : g
    ),
  );

  if (!isCurrentGroup) {
    // Not viewing this group → notify + increment unread
    showBrowserNotification(title, body, `group-${msg.channelId}`);
    toast(body, { icon: '💬', duration: 4000 });
    setUnreadCounts((prev) => { /* increment */ });
  } else {
    // Viewing this group → append message + cache
    if (seenMessageIds.current.has(messageId)) return;  // Dedup
    seenMessageIds.current.add(messageId);

    setMessages((prev) => [...prev, unified]);
    appendCachedMessage(extId, toCached(extId, unified));
    scrollToBottom();
  }
});
```

**Notes:**
- Uses `selectedGroupRef` (ref, not state) to avoid stale closure issues
- Deduplication via `seenMessageIds` Set prevents double-rendering
- Group last_message/timestamp updated regardless of which group is selected
- Unread badge incremented only for non-selected groups

---

## 6. Error Handling

### 6.1 Socket Connection Errors

| Scenario | Handling |
|----------|----------|
| No JWT token | `createGroupsSocket()` returns `null`, page shows "Select a group" empty state |
| Settings fetch fails | Falls back to `FALLBACK_URL` constant |
| Connection error | Logged to console, Socket.IO auto-reconnects (infinite attempts) |
| Socket creation fails | Warning logged, `extSocket` remains `null`, send operations show "Socket not connected" toast |
| Disconnect | `socketConnected` → `false`, UI shows "Reconnecting…" / "Offline" status |

### 6.2 Message Send Errors

| Scenario | Handling |
|----------|----------|
| Socket not connected | `toast.error('Socket not connected')` |
| Send exception | `toast.error('Failed to send message')`, logged to console |
| File too large (> 10 MB) | `toast.error('"filename" exceeds the 10 MB limit')` — file excluded, others proceed |

### 6.3 Cache Errors

| Scenario | Handling |
|----------|----------|
| IndexedDB open fails | Logged to console, cache operations silently fail, messages load from socket only |
| Cache read fails | Returns `[]`, triggers loading spinner and socket fetch |
| Cache write fails | Logged to console, no user-visible impact |
