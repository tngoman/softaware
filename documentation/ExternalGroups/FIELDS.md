# External Groups Module — Data Schema

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Local MySQL tables** | 0 (no backend involvement in messaging) |
| **Local IndexedDB databases** | 1 (`softaware_chat_cache`) |
| **IndexedDB object stores** | 2 (`messages`, `meta`) |
| **TypeScript interfaces** | 4 (`UnifiedGroup`, `UnifiedMessage`, `CachedMessage`, `GroupMeta`) |
| **localStorage keys** | 1 (`jwt_token` — for socket auth) |
| **sys_settings keys** | 1 (`silulumanzi_chat_url`) |

**Important:** The External Groups module stores **no data in MySQL**. All message data lives on the remote Silulumanzi webhook server. The only local persistence is:
1. IndexedDB message cache for instant loading (GRP-008)
2. JWT token in localStorage for socket authentication
3. Server URL cached in-memory (not persisted)

---

## 2. TypeScript Interfaces

### 2.1 UnifiedGroup

**Source:** `src/pages/general/groups/chatTypes.ts`  
**Used by:** All sub-components and GroupsPage

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string` | — | Unique group identifier. Format: `"ext_{whatsapp_group_id}"` |
| `name` | `string` | — | Display name of the group |
| `last_message` | `string` | ✅ | Most recent message text preview |
| `timestamp` | `number` | ✅ | Unix timestamp (seconds) of last activity |
| `member_count` | `number` | ✅ | Number of group members |
| `description` | `string` | ✅ | Group description |
| `unread_count` | `number` | ✅ | Locally-tracked unread message count (GRP-010) |

**ID Format:**

The `id` field is constructed by prefixing the remote WhatsApp group ID with `ext_`:

```typescript
id: `ext_${g.whatsapp_group_id}`  // e.g., "ext_120363047890456789@g.us"
```

The prefix is stripped when emitting socket events:

```typescript
const whatsappId = group.id.replace('ext_', '');
```

**Mapping from Remote Server:**

| Remote Field | → | UnifiedGroup Field |
|-------------|---|-------------------|
| `whatsapp_group_id` | → | `id` (with `ext_` prefix) |
| `group_name` | → | `name` |
| `last_message` | → | `last_message` |
| `timestamp` | → | `timestamp` |
| (none) | → | `unread_count` (default: 0, managed locally) |

---

### 2.2 UnifiedMessage

**Source:** `src/pages/general/groups/chatTypes.ts`  
**Used by:** All sub-components and GroupsPage

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string` | — | Unique message identifier |
| `text` | `string` | — | Message text content |
| `user_id` | `string \| number` | ✅ | Sender's user ID on remote server (not local ID) |
| `user_name` | `string` | — | Sender's display name |
| `timestamp` | `number` | — | Unix timestamp in seconds |
| `direction` | `string` | ✅ | Message direction indicator |
| `message_type` | `string` | ✅ | `'image'`, `'video'`, `'audio'`, or undefined for text |
| `file_url` | `string` | ✅ | URL to attached file (relative or absolute) |
| `file_name` | `string` | ✅ | Original file name |
| `file_type` | `string` | ✅ | MIME type (e.g., `'image/png'`) |
| `file_size` | `number` | ✅ | File size in bytes |
| `caption` | `string` | ✅ | Text caption accompanying a file |
| `reply_to_message_id` | `string` | ✅ | ID of the message being replied to |
| `reply_to_content` | `string` | ✅ | Content of the replied-to message |
| `reply_to_user_name` | `string` | ✅ | Author name of the replied-to message |

**Mapping from Remote Server:**

The remote server sends messages with inconsistent field names. The frontend normalises them:

| Remote Field (alternatives) | → | UnifiedMessage Field |
|----------------------------|---|---------------------|
| `id` / `message_id` | → | `id` |
| `message` / `content` / `caption` | → | `text` (fallback chain) |
| `userId` / `user_id` | → | `user_id` |
| `userName` / `name` | → | `user_name` (fallback: `'Unknown'`) |
| `timestamp` | → | `timestamp` |
| `direction` | → | `direction` |
| `message_type` | → | `message_type` |
| `file_url` | → | `file_url` |
| `file_name` | → | `file_name` |
| `file_type` | → | `file_type` |
| `file_size` | → | `file_size` |
| `caption` | → | `caption` |
| `reply_to_message_id` | → | `reply_to_message_id` |

**Text Fallback Chain:**

```typescript
text: m.message || m.content || m.caption || ''
```

**User Name Fallback Chain:**

```typescript
user_name: m.userName || m.name || 'Unknown'
```

---

### 2.3 CachedMessage

**Source:** `src/services/chatCache.ts`  
**Used by:** GroupsPage (via `toCached` / `fromCached` helpers)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `groupId` | `string` | — | Group identifier (matches `UnifiedGroup.id`) |
| `messageId` | `string` | — | Message identifier (matches `UnifiedMessage.id`) |
| `text` | `string` | — | Message text |
| `user_id` | `string \| number` | ✅ | Sender user ID |
| `user_name` | `string` | — | Sender display name |
| `timestamp` | `number` | — | Unix timestamp |
| `direction` | `string` | ✅ | Message direction |
| `message_type` | `string` | ✅ | Media type |
| `file_url` | `string` | ✅ | Attached file URL |
| `file_name` | `string` | ✅ | File name |
| `file_type` | `string` | ✅ | MIME type |
| `file_size` | `number` | ✅ | File size |
| `caption` | `string` | ✅ | File caption |
| `reply_to_message_id` | `string` | ✅ | Reply parent ID |
| `reply_to_content` | `string` | ✅ | Reply parent content |
| `reply_to_user_name` | `string` | ✅ | Reply parent author |

**Conversion Functions:**

```typescript
// GroupsPage.tsx

function toCached(groupId: string, m: UnifiedMessage): CachedMessage {
  return {
    groupId,
    messageId: m.id,
    text: m.text,
    user_id: m.user_id,
    user_name: m.user_name,
    timestamp: m.timestamp,
    direction: m.direction,
    message_type: m.message_type,
    file_url: m.file_url,
    file_name: m.file_name,
    file_type: m.file_type,
    file_size: m.file_size,
    caption: m.caption,
    reply_to_message_id: m.reply_to_message_id,
    reply_to_content: m.reply_to_content,
    reply_to_user_name: m.reply_to_user_name,
  };
}

function fromCached(c: CachedMessage): UnifiedMessage {
  return {
    id: c.messageId,
    text: c.text,
    user_id: c.user_id,
    user_name: c.user_name,
    timestamp: c.timestamp,
    direction: c.direction,
    message_type: c.message_type,
    file_url: c.file_url,
    file_name: c.file_name,
    file_type: c.file_type,
    file_size: c.file_size,
    caption: c.caption,
    reply_to_message_id: c.reply_to_message_id,
    reply_to_content: c.reply_to_content,
    reply_to_user_name: c.reply_to_user_name,
  };
}
```

---

### 2.4 GroupMeta (Internal)

**Source:** `src/services/chatCache.ts` (internal, not exported)

| Field | Type | Description |
|-------|------|-------------|
| `groupId` | `string` | Group identifier (key path) |
| `lastFetched` | `number` | `Date.now()` timestamp of last cache update |
| `count` | `number` | Number of messages stored |

---

## 3. IndexedDB Schema

### 3.1 Database

| Property | Value |
|----------|-------|
| **Name** | `softaware_chat_cache` |
| **Version** | 1 |
| **Shared with** | Team Chat module (same cache service) |

### 3.2 Object Store: `messages`

| Property | Value |
|----------|-------|
| **Key path** | `[groupId, messageId]` (compound key) |
| **Index** | `by-group` on `groupId` (non-unique) |
| **Max records per group** | 200 (`MAX_MESSAGES_PER_GROUP`) |

**Record shape:** `CachedMessage` interface (see §2.3)

**Key format examples:**

```
["ext_120363047890456789@g.us", "msg_001"]
["ext_120363047890456789@g.us", "msg_002"]
["ext_987654321012345@g.us", "msg_001"]
```

### 3.3 Object Store: `meta`

| Property | Value |
|----------|-------|
| **Key path** | `groupId` |

**Record shape:** `GroupMeta` interface (see §2.4)

**Example record:**

```json
{
  "groupId": "ext_120363047890456789@g.us",
  "lastFetched": 1709730000000,
  "count": 147
}
```

---

## 4. localStorage Keys

| Key | Type | Set By | Used By | Description |
|-----|------|--------|---------|-------------|
| `jwt_token` | `string` | Auth module (login) | `groupsSocket.ts` | JWT Bearer token passed to Socket.IO `auth` object |

**Note:** Unlike many modules, External Groups does not use localStorage for any module-specific preferences. Group selection, search state, and unread counts are all in-memory and reset on page reload.

---

## 5. sys_settings Keys

| Key | Value Type | Default | Description |
|-----|-----------|---------|-------------|
| `silulumanzi_chat_url` | `string` (URL) | `https://webhook.silulumanzi.com:90` | Remote Socket.IO server URL |

**URL Normalisation:**

The `fetchChatUrl()` function normalises the stored value:

```typescript
url = url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
url = url.replace(/\/+$/, '');
```

This ensures the URL uses HTTP(S) scheme (required for Socket.IO polling transport) even if stored with WebSocket scheme.

---

## 6. In-Memory State

These data structures exist only in React component state and are not persisted:

### 6.1 GroupsPage State

| Variable | Type | Persistence | Description |
|----------|------|-------------|-------------|
| `extSocket` | `Socket \| null` | Session only | Socket.IO connection instance |
| `socketConnected` | `boolean` | Session only | Connection status |
| `externalGroups` | `UnifiedGroup[]` | Session only | Full group list from server |
| `selectedGroup` | `UnifiedGroup \| null` | Session only | Currently viewed group |
| `messages` | `UnifiedMessage[]` | IndexedDB cache | Messages for selected group |
| `unreadCounts` | `Map<string, number>` | Session only | Per-group unread badges |
| `searchQuery` | `string` | Session only | In-chat search text |
| `searchResults` | `{ messageId, index }[]` | Session only | Search match positions |

### 6.2 groupsSocket.ts Cache

| Variable | Type | Persistence | Description |
|----------|------|-------------|-------------|
| `_cachedChatUrl` | `string \| null` | In-memory (module-level) | Fetched server URL — survives across component re-mounts within same session |

### 6.3 Deduplication Set

| Variable | Type | Persistence | Description |
|----------|------|-------------|-------------|
| `seenMessageIds` | `Set<string>` | Ref (session only) | Prevents duplicate message rendering from concurrent socket events |

---

## 7. External Server Data Entities

These are the raw data shapes received from the remote Silulumanzi webhook server. They are **not** TypeScript interfaces in the codebase — they are untyped (`any`) and normalised into `UnifiedGroup` / `UnifiedMessage` on receipt.

### 7.1 Remote Group Object

| Field | Type | Description |
|-------|------|-------------|
| `whatsapp_group_id` | `string` | WhatsApp group JID (e.g., `120363047890456789@g.us`) |
| `group_name` | `string` | Human-readable group name |
| `last_message` | `string?` | Preview of most recent message |
| `timestamp` | `number?` | Unix timestamp of last activity |

### 7.2 Remote Message Object

| Field | Type | Description |
|-------|------|-------------|
| `id` / `message_id` | `string` | Unique message ID |
| `message` / `content` | `string` | Message text content |
| `caption` | `string?` | File caption text |
| `userId` / `user_id` | `string \| number?` | Sender ID on remote server |
| `userName` / `name` | `string?` | Sender display name |
| `timestamp` | `number` | Unix timestamp (seconds) |
| `channelId` | `string?` | Group ID (present on `new-group-message` events) |
| `direction` | `string?` | Message direction |
| `message_type` | `string?` | Media type: `image`, `video`, `audio` |
| `file_url` | `string?` | File URL (may be relative to portal.silulumanzi.com) |
| `file_name` | `string?` | Original file name |
| `file_type` | `string?` | MIME type |
| `file_size` | `number?` | File size in bytes |
| `reply_to_message_id` | `string?` | Parent message ID for replies |

**Note:** The remote server uses inconsistent field naming (camelCase vs snake_case, alternative names). The frontend mapping handles all variants with fallback chains.
