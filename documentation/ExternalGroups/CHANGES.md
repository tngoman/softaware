# External Groups Module — Changelog & Known Issues

**Version:** 1.0.0  
**Last Updated:** 2026-03-06

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-06 | 1.0.0 | Initial documentation — Socket.IO chat, component decomposition, IndexedDB cache, unread badges |

---

## 1.1 v1.0.0 — Initial Documentation

**Date:** 2026-03-06  
**Scope:** Complete documentation of existing External Groups chat module

### Summary

Documented the full External Groups module as it exists in production. The module provides real-time chat with external WhatsApp groups via a remote Socket.IO server (`webhook.silulumanzi.com:90`). Key features documented:

**Architecture:**
- Direct Socket.IO connection from frontend to remote server (no backend proxy for messaging)
- Backend involvement limited to single sys_settings URL lookup
- Polling transport only (no WebSocket upgrade — matches desktop Electron app)

**Feature references documented:**
- GRP-002: File size limit (10 MB max per attachment)
- GRP-004: DOMPurify message sanitisation with strict tag allowlist
- GRP-005: Development-only event logging (`onAny`)
- GRP-008: IndexedDB message cache for instant loading (200 messages/group)
- GRP-010: Unread badge counters per group (in-memory Map)
- GRP-011: Typing event emission with 2s idle timeout
- GRP-012: Component decomposition into 4 sub-components

**UI Components:**
- ChatSidebar (133 LOC) — group list, search, connection status, unread badges
- ChatHeader (131 LOC) — group info, "External" badge, in-chat search
- MessageList (369 LOC) — message rendering, 9-level media priority, reply previews, lightbox
- MessageInput (265 LOC) — text compose, file attach/paste, reply preview, typing events

**Services:**
- groupsSocket.ts (107 LOC) — Socket.IO factory with async URL fetch and in-memory caching
- chatCache.ts (216 LOC) — IndexedDB cache shared with Team Chat module

### File Statistics

| File | LOC |
|------|-----|
| GroupsPage.tsx | 549 |
| chatTypes.ts | 158 |
| ChatSidebar.tsx | 133 |
| ChatHeader.tsx | 131 |
| MessageList.tsx | 369 |
| MessageInput.tsx | 265 |
| index.ts | 6 |
| groupsSocket.ts | 107 |
| chatCache.ts | 216 |
| **Total** | **~1,934** |

---

## 2. Known Issues & Limitations

### 2.1 Display Name Identity Matching

**Severity:** Low  
**Impact:** Outgoing message detection may fail or misidentify

The module identifies outgoing messages by comparing `msg.user_name` with the current user's display name (case-insensitive). This can cause issues:

- **Name collisions:** If two users share the same name, both appear as outgoing
- **Name changes:** If a user updates their profile name, old messages won't match
- **Empty names:** Messages with empty sender names default to incoming

**Root cause:** Remote server user IDs don't correspond to local Softaware user IDs, so name matching is the only viable approach.

### 2.2 Unread Counts Not Persisted

**Severity:** Low  
**Impact:** Unread badges reset to 0 on page reload

Unread counts are tracked in an in-memory `Map<string, number>` that resets when the component unmounts. There is no server-side unread tracking.

### 2.3 No Message Persistence Guarantee

**Severity:** Low  
**Impact:** IndexedDB cache may show stale data briefly

The cache-first pattern means users may briefly see cached messages that have been deleted on the remote server. Fresh data from the socket replaces the cache shortly after.

### 2.4 Sequential File Upload

**Severity:** Low  
**Impact:** Multiple file attachments are sent one at a time

Files are encoded to base64 and sent sequentially in a loop. This means 3 attached files result in 3 sequential socket emissions rather than parallel sends. Large files may cause noticeable delays.

### 2.5 Base64 File Size Overhead

**Severity:** Low  
**Impact:** 33% payload increase for file transfers

Files are encoded as base64 data URIs before sending via Socket.IO. A 10 MB file becomes ~13.3 MB in transit. Native binary transfer would be more efficient but requires server-side changes.

### 2.6 No Offline Message Queue

**Severity:** Medium  
**Impact:** Messages typed while disconnected are lost

If the socket disconnects while the user is composing a message, the text remains in the input but any send attempt will fail with "Socket not connected" toast. There is no offline queue that retries on reconnection.

### 2.7 Polling Transport Latency

**Severity:** Low  
**Impact:** Higher latency than native WebSocket

The module uses `transports: ['polling']` with `upgrade: false` to match the desktop app. HTTP long-polling has higher latency than WebSocket transport. This is intentional for compatibility but could be improved if the remote server supports WebSocket connections.

---

## 3. Feature Reference Index

| Code | Feature | Status | File(s) |
|------|---------|--------|---------|
| GRP-002 | File size limit (10 MB) | ✅ Active | chatTypes.ts, MessageInput.tsx |
| GRP-004 | DOMPurify sanitisation | ✅ Active | chatTypes.ts, MessageList.tsx |
| GRP-005 | Development event logging | ✅ Active | groupsSocket.ts |
| GRP-008 | IndexedDB message cache | ✅ Active | chatCache.ts, GroupsPage.tsx |
| GRP-010 | Unread badge counters | ✅ Active | GroupsPage.tsx, ChatSidebar.tsx |
| GRP-011 | Typing events | ✅ Active | MessageInput.tsx, GroupsPage.tsx |
| GRP-012 | Component decomposition | ✅ Active | groups/*.tsx |
