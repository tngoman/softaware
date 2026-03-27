# Staff Chat — Changelog

> **Last Updated**: 2026-03-18
> **Status**: 144/144 tasks complete (100%)

---

## Version History

| Version | Date | Summary |
|---------|------|---------|
| **v3 (legacy)** | 2025-06 | Dual-source `GroupsPage` merging local `team_chats` REST + external Socket.IO groups. `teamChat.ts` (478 LOC), `GroupsPage.tsx` (1,696 LOC) |
| **v4.0** | 2025-07 | **Full rewrite — Phase 1**: New unified schema via migration 014 (10 tables). `staffChat.ts` REST API + `chatSocket.ts` real-time namespace. `ChatPage.tsx` with modular sub-components. DMs, groups, edit/delete, delivery ticks, presence, context menus, emoji picker. Data migrated from `team_chats` → `conversations` |
| **v4.1** | 2025-07 | **Phase 2**: Rich media — link previews (`linkPreview.ts`), media processing (`mediaProcessor.ts`), drag-drop upload, image lightbox with zoom/pan, media gallery, GIF picker (Tenor API) |
| **v4.2** | 2025-07 | **Phase 3**: Notifications & sync — FCM push notifications, service worker, DND schedule, custom notification sounds, offline message queue (IndexedDB), reconnect catch-up |
| **v4.3** | 2025-07 | **Phase 4**: Advanced messaging — reactions, @mentions, forwarding, starred messages, global search, message reporting |
| **v4.4** | 2025-07 | **Phase 5**: Voice & video calling — WebRTC peer connections, call signaling (Socket.IO), call overlay/controls, screen sharing, incoming call modal, call history panel |
| **v4.5** | 2025-07 | **Phase 6**: Management & polish — pin/archive/mute conversations, group icon upload, location & contact sharing, voice recording with waveform, custom audio player |
| **v4.6** | 2026-03 | **Phase 6 final**: WebAuthn biometric auth (migration 016), session management API, external groups tab in sidebar, migration 017 drops legacy `team_chats` tables |
| **v4.7** | 2026-03 | **Scheduled calls + E2E validation**: 9 scheduled-call endpoints, `ScheduleCallDialog.tsx` + `ScheduledCallsPanel.tsx` + `GifPicker.tsx` UI components. Full E2E test suite (77/77 passing). Fixed shared Socket.IO server, DB column mismatches, ISO datetime handling |
| **v4.8** | 2026-03 | **Socket event alignment + call bug fixes**: Fixed 13 backend event name/payload mismatches (hyphenated → underscored, camelCase → snake_case). Fixed WebRTC relay, call accept `started_at`, caller name lookup. Fixed `emitMessageStatusUpdate` to be room-scoped. Fixed `call_sessions.id` type (BIGINT, not UUID). Created comprehensive mobile wiring document |
| **v4.9** | 2026-03 | **Mobile push notification reliability**: Fixed stale presence causing skipped pushes after server restart. Added user notification preference checks to chat push path. Improved FCM payloads (iOS `content-available`, `mutable-content`, `apns-priority: 10`; Android dedicated `softaware_chat` channel; data payload duplication for background delivery). |

---

## Session-by-Session Changelog

### Session 1 — Core Foundation
- Created migration 014 with 10 tables + data migration from `team_chats`
- Built `staffChat.ts` REST API (conversations, members, messages, file upload)
- Built `chatSocket.ts` Socket.IO `/chat` namespace (typing, presence, message events)
- Created `StaffChatModel.ts` with TypeScript interfaces + static methods
- Created `staffChatSocket.ts` singleton connection factory
- Created `ChatPage.tsx` orchestrator + 8 sub-components

### Session 2 — TypeScript & Polish
- Fixed TypeScript compilation errors across frontend
- Added `chatHelpers.ts` shared utilities (markdown, file URLs, time formatting)
- Created barrel export `index.ts`

### Session 3 — Rich Features
- Markdown rendering with DOMPurify
- Starred messages panel
- @mention autocomplete with notification
- EmojiPicker with categories + search
- Forward message dialog
- Global search panel
- Message report → case creation

### Session 4 — UI Enhancements
- Pin / archive / mute conversation controls
- Media gallery with tab filtering
- Drag-and-drop file uploads
- Image lightbox with zoom, pan, keyboard nav, thumbnails

### Session 5 — Link Previews & Media
- Created `linkPreview.ts` service (cheerio + OG tags, LRU cache)
- Created `mediaProcessor.ts` (sharp thumbnails, ffmpeg video, ffprobe audio)
- GIF picker with Tenor API integration

### Session 6 — Offline & Notifications
- `chatOfflineQueue.ts` IndexedDB queue (enqueue/dequeue/flush)
- Location sharing (Geolocation API + Nominatim reverse geocode)
- Contact/staff card sharing
- Socket reconnect catch-up (last event timestamp)

### Session 7 — Voice & Audio
- `VoiceRecorder.tsx` — MediaRecorder + AnalyserNode live waveform
- `AudioPlayer.tsx` — custom player with waveform, seek, speed control
- Download progress tracking
- Service worker push notifications
- DND schedule (`user_presence` columns via migration 015)
- Custom notification sound per-conversation

### Session 8 — WebRTC Calling (Phase 5)
- `webrtcService.ts` (507 LOC) — RTCPeerConnection lifecycle, ICE candidates, media controls
- Call signaling events in `chatSocket.ts` (initiate, accept, decline, end, WebRTC relay)
- 6 call REST endpoints in `staffChat.ts` (ICE config, initiate, accept, history, detail, end)
- `CallOverlay.tsx` — full-screen overlay, video grid, voice avatars, call timer
- `IncomingCallModal.tsx` — accept/decline with pulse animation, 45s auto-dismiss
- `CallHistoryPanel.tsx` — slide-over with call log, re-call button
- Call buttons in ChatHeader + ChatSidebar

### Session 9 — Security & Completion (Phase 6 final)
- Migration 016: `webauthn_credentials` + `user_sessions` tables
- WebAuthn endpoints in `auth.ts` (register-options, register-verify, login-options, login-verify, credentials CRUD)
- Session management endpoints (GET/DELETE sessions, revoke all)
- `trackSession()` helper on every login
- Migration 017: dropped legacy `team_chats` / `team_chat_members` / `team_chat_messages`
- External groups "External" tab in ChatSidebar

### Session 10 — Scheduled Calls + E2E Validation
- **9 new scheduled-call endpoints** in `staffChat.ts`: create, list, detail, update, delete, RSVP, start, add/remove participants
- `scheduled_calls` + `scheduled_call_participants` tables (migration 015)
- `ScheduleCallDialog.tsx` (355 LOC) — scheduling UI with recurrence, description, participants
- `ScheduledCallsPanel.tsx` (388 LOC) — slide-over panel showing upcoming/past scheduled calls
- `GifPicker.tsx` (131 LOC) — standalone GIF search component extracted from MessageInput
- **77-test E2E suite** (`e2e_chat_test.sh`) — bash-based, covers all 6 phases + Socket.IO + DB verification
- **E2E test results**: 77/77 passing (100%) after iterative bug fixes

#### Bugs Found & Fixed During E2E
| Bug | Root Cause | Fix |
|-----|-----------|-----|
| All staff-chat endpoints returning 500 | `dist/` was stale — `staffChat.ts` never compiled since initial add | Rebuilt with `npm run build` |
| 32+ SQL queries failing | Queries used `u.first_name`, `u.last_name` but DB has single `u.name` column | Updated all `COALESCE(CONCAT(u.first_name, ' ', u.last_name), ...)` → `COALESCE(u.name, ...)` |
| Profile/user queries failing | Queries used `active = 1` but column is `account_status ENUM` | Changed to `account_status = 'active'` |
| Call history queries failing | Used `cs.created_at` but column is `cs.started_at` | Changed to `cs.started_at` |
| `displayName()` helper broken | Referenced `row.first_name`/`row.last_name` | Changed to `row.name` |
| Socket.IO crash on connect | Two `IOServer` instances on same HTTP server → `handleUpgrade()` called twice | Shared single IO instance: `initChatSocket(server, teamIO)` in `index.ts` |
| Scheduled call creation failing | MySQL DATETIME rejects ISO 8601 `T`/`Z` format | Strip `T`→space, `Z`→empty before INSERT |

### Session 11 — Socket Event Alignment + Call Fixes (v4.8)

**Critical discovery**: All 10 core Socket.IO server→client event names were mismatched between the backend (hyphenated) and frontend (underscored). Real-time chat was non-functional because events were silently dropped.

**Event name fixes** (chatSocket.ts):
| Before (broken) | After (correct) |
|---|---|
| `new-message` | `new_message` |
| `message-edited` | `message_edited` |
| `message-deleted` | `message_deleted` |
| `message-status-update` | `message_status` |
| `reaction-update` | `reaction_update` |
| `conversation-updated` | `conversation_updated` |
| `conversation-deleted` | `conversation_deleted` |
| `typing` | `user_typing` |
| `stop-typing` | `user_stop_typing` |
| `presence-change` | `presence_update` |

**Payload shape fixes** (camelCase → snake_case):
- `emitNewMessage`: `{ conversationId, message }` → `{ ...message, conversation_id }` (flattened)
- `emitMessageEdited`: `{ conversationId, messageId, content, editedAt }` → `{ message_id, content, edited_at }`
- `emitMessageDeleted`: `{ conversationId, messageId, deletedForEveryone }` → `{ message_id, deleted_for_everyone }`
- `emitMessageStatusUpdate`: `(userId, messageId, status)` → `(conversationId, messageId, status)` — now room-scoped, not namespace broadcast
- `emitReactionUpdate`: `{ conversationId, messageId, reactions }` → `{ message_id, reactions }`
- `emitConversationUpdated`: `{ conversationId, changes }` → `{ id, ...changes }` (flattened)
- `emitConversationDeleted`: `{ conversationId }` → `{ conversation_id }`
- `user_typing` / `user_stop_typing`: `{ conversationId, userId, userName }` → `{ conversation_id, user_id, user_name }`
- `presence_update`: `{ userId, status, lastSeen }` → `{ user_id, status }`

**WebRTC call fixes** (chatSocket.ts):
- WebRTC relay (offer/answer/ICE) used `chatNs?.to()` → fixed to `socket.to()` (excluded sender from receiving own signals)
- `call-ended` relay used `chatNs?.to()` → fixed to `socket.to()`
- `callerName` always showed UUID → added `userName` DB lookup on socket connection

**Call accept fix** (staffChat.ts):
- `started_at` never set on `POST /calls/:id/accept` → added `started_at = NOW()` so duration calculates correctly

**Room handler fix** (chatSocket.ts):
- `join-conversation` / `leave-conversation` accepted only bare `number` → now accepts `{ conversationId: number } | number`

**Caller signature fix** (staffChat.ts):
- `emitMessageStatusUpdate(s.sender_id, s.id, 'read')` → `emitMessageStatusUpdate(Number(convId), s.id, 'read')` to match new room-scoped signature

**Documentation**:
- Created `documentation/Mobile/STAFF_CHAT_WIRING_GUIDE.md` — comprehensive mobile wiring guide (48 REST endpoints, 22 socket events, data models, feature wiring, offline sync, common mistakes)
- Updated all `documentation/Chat/` files to match corrected backend code

---

## Resolved Issues (from Legacy)

| ID | Status | Resolution |
|----|--------|-----------|
| GRP-001 | ✅ | `groupsSocket.ts` now fetches URL from `sys_settings` via API (no hardcoded URL) |
| GRP-003 | ✅ | New system uses `staffChat.ts` with `requireAuth` on all routes |
| GRP-004 | ✅ | DOMPurify used throughout new chat system |
| GRP-005 | ✅ | `groupsSocket.ts` debug logging gated behind `NODE_ENV === 'development'` |
| GRP-006 | ✅ | New system uses Socket.IO real-time push — no polling |
| GRP-007 | ✅ | Cursor-based pagination with `before` param in MessageList |
| GRP-008 | ✅ | `chatOfflineQueue.ts` + `chatCache.ts` for IndexedDB persistence |
| GRP-009 | ✅ | User ID (UUID) matching — no name-based detection |
| GRP-010 | ✅ | `unread_count` tracked per-conversation server-side |
| GRP-011 | ✅ | Real-time typing indicators via `typing` / `stop-typing` Socket.IO events |
| GRP-012 | ✅ | ChatPage decomposed into 17 focused sub-components |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| `users` table | FK / JOIN | User identity, display names, avatars |
| `roles` / `user_roles` | JOIN | Admin role check for permissions |
| `fcm_tokens` | Query | Push notification delivery targets |
| `cases` table | INSERT | Message report → case creation |
| `sys_settings` | Query | External groups WebSocket URL |
| Firebase Cloud Messaging | Service | Push notifications for offline users |
| Tenor API | HTTP | GIF search integration |
| Nominatim | HTTP | Reverse geocoding for location sharing |
| Google STUN servers | WebRTC | ICE candidate exchange for voice/video calls |
