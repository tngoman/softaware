# Staff Chat — File Inventory

> **Last Updated**: 2026-03-08
> **Total**: ~14,855 LOC across 41 files (Backend: 5,492 LOC, Frontend: 9,363 LOC)

---

## Backend Files

### Routes

| File | LOC | Purpose |
|------|-----|---------|
| `src/routes/staffChat.ts` | 3,036 | Unified REST API — 48 endpoints covering conversations, members, messages, reactions, stars, search, media, calls, scheduled calls, DND, upload, profile, GIFs, reporting |
| `src/routes/auth.ts` | 885 | Authentication routes — login, register, 2FA, WebAuthn passkey registration/login, session management (GET/DELETE sessions) |
| `src/routes/groups.ts` | 122 | Legacy external groups CRUD — retained for `/groups` page compatibility |

### Services

| File | LOC | Purpose |
|------|-----|---------|
| `src/services/chatSocket.ts` | 569 | Socket.IO `/chat` namespace — typing indicators, presence tracking, message events, call signaling (WebRTC offer/answer/ICE relay), 14 exported emitter functions |
| `src/services/linkPreview.ts` | 170 | URL metadata extraction — fetches Open Graph / meta tags via axios + cheerio. In-memory LRU cache (500 URLs, 1-hour TTL) |
| `src/services/mediaProcessor.ts` | 239 | Media processing — image resize/compression via sharp (optional), video thumbnails via ffmpeg, audio duration via ffprobe. Graceful fallback if deps not installed |

### Migrations

| File | LOC | Purpose |
|------|-----|---------|
| `src/db/migrations/014_chat_system.ts` | 391 | Core schema — 10 tables, indexes, data migration from `team_chats` |
| `src/db/migrations/015_chat_enhancements.ts` | 95 | Adds `cleared_at`, `icon_url`, DND columns, `notification_sound` |
| `src/db/migrations/016_webauthn_sessions.ts` | 73 | Creates `webauthn_credentials` + `user_sessions` tables |
| `src/db/migrations/017_drop_old_team_chats.ts` | 46 | Drops legacy `team_chat_messages`, `team_chat_members`, `team_chats` |

### Migration Runners

| File | Purpose |
|------|---------|
| `scripts/run_migration_014.ts` | Runs migration 014 |
| `scripts/run_migration_015.ts` | Runs migration 015 |
| `scripts/run_migration_016.ts` | Runs migration 016 |
| `scripts/run_migration_017.ts` | Runs migration 017 |

---

## Frontend Files

### Pages

| File | LOC | Purpose |
|------|-----|---------|
| `src/pages/general/ChatPage.tsx` | 1,574 | Main orchestrator — state management, socket listeners, WebRTC event wiring, call handlers, renders sidebar + message area + overlays |
| `src/pages/general/GroupsPage.tsx` | ~460 | Legacy external groups page (retained, accessible via sidebar "External" tab) |

### Chat Sub-Components (`src/pages/general/chat/`)

| File | LOC | Purpose |
|------|-----|---------|
| `ChatSidebar.tsx` | 412 | Conversation list — tabs (All/DMs/Groups/External), search, DND settings, archive toggle, external groups fetch |
| `ChatHeader.tsx` | 361 | Conversation header — name, presence dots, voice/video call buttons, search, dropdown (pin/archive/mute/clear/info) |
| `MessageList.tsx` | 743 | Scrolling message list — date separators, delivery ticks, reactions, mentions, context menu, scroll FAB, link previews, media rendering |
| `MessageInput.tsx` | 421 | Compose bar — text input, reply/edit preview, emoji picker trigger, attach menu (file/image/GIF/location/contact), drag-drop overlay, voice recorder toggle |
| `ChatDialogs.tsx` | 794 | Dialog suite — NewDMDialog, NewGroupDialog, AddMembersDialog, ConversationInfoPanel (with media gallery tabs) |
| `chatHelpers.ts` | 317 | Shared utilities — markdown renderer, file URL resolver, time formatting, initials, message preview, constants |
| `EmojiPicker.tsx` | 157 | Full emoji picker — 8 categories, search, recently-used, skin tone modifier |
| `StarredMessagesPanel.tsx` | 145 | Slide-over panel — starred messages list with unstar button, navigate to message |
| `ForwardDialog.tsx` | 202 | Forward message dialog — conversation multi-select with search |
| `GlobalSearchPanel.tsx` | 193 | Global message search — search across all conversations, results grouped by conversation |
| `ImageLightbox.tsx` | 207 | Full-screen image viewer — zoom, pan, arrow key navigation, thumbnail strip |
| `VoiceRecorder.tsx` | 365 | Voice recording UI — MediaRecorder + AnalyserNode waveform visualization, timer, cancel/send |
| `AudioPlayer.tsx` | 226 | Custom audio player — waveform display, seek bar, playback speed control (0.5×–2×) |
| `CallOverlay.tsx` | 391 | Full-screen call overlay — ringing pulse animation, video grid (up to 6 tiles), PIP local video, voice avatar mode, floating controls, call timer |
| `IncomingCallModal.tsx` | 117 | Incoming call modal — centered overlay with caller info, accept/decline buttons, pulse rings, 45s auto-dismiss |
| `CallHistoryPanel.tsx` | 213 | Call history slide-over — call list with status icons, duration, re-call button |
| `ScheduleCallDialog.tsx` | 355 | Schedule call dialog — title, description, date/time, recurrence, participant selection |
| `ScheduledCallsPanel.tsx` | 388 | Scheduled calls slide-over — upcoming/past calls, RSVP status, start/cancel actions |
| `GifPicker.tsx` | 131 | GIF picker panel — Tenor API search + trending grid, click to send |
| `index.ts` | 18 | Barrel exports for all chat sub-components |

### Models

| File | LOC | Purpose |
|------|-----|---------|
| `src/models/StaffChatModel.ts` | 554 | TypeScript interfaces + static API methods — 1:1 mapping to backend REST endpoints |

### Services

| File | LOC | Purpose |
|------|-----|---------|
| `src/services/staffChatSocket.ts` | 97 | Socket.IO singleton — `getStaffChatSocket()` factory, 12 exported emit helpers (typing, join/leave, call signaling) |
| `src/services/webrtcService.ts` | 507 | WebRTC manager — singleton `WebRTCService` class, RTCPeerConnection lifecycle, ICE candidate queuing, `acquireLocalMedia()`, `toggleMute/Camera/ScreenShare`, event system |
| `src/services/chatOfflineQueue.ts` | 153 | IndexedDB offline queue — enqueue messages when offline, dequeue/flush on reconnect |
| `src/services/chatCache.ts` | 215 | IndexedDB message cache — stores up to 200 messages per group with TTL |
| `src/services/groupsSocket.ts` | 107 | Socket.IO factory for external groups — connects to `/groups` namespace on Silulumanzi server |

### Modified Integration Files

| File | Change |
|------|--------|
| `src/App.tsx` | Added `/chat` route with `ChatPage` import |
| `src/components/Layout/Layout.tsx` | Added "Chat" nav item in Main section sidebar |

---

## Testing

| File | LOC | Purpose |
|------|-----|---------|
| `e2e_chat_test.sh` | 514 | Bash E2E test suite — 77 tests covering all 6 phases, Socket.IO connectivity, and DB table verification. Run: `bash e2e_chat_test.sh` |

---

## Route Registration

### Backend (`app.ts`)
```typescript
import { staffChatRouter } from './routes/staffChat.js';
apiRouter.use('/staff-chat', staffChatRouter);
// Legacy:
apiRouter.use('/groups', groupsRouter);
```

### Frontend (`App.tsx`)
```tsx
<Route path="/chat" element={<ProtectedRoute><Layout><ChatPage /></Layout></ProtectedRoute>} />
<Route path="/groups" element={<ProtectedRoute><Layout><GroupsPage /></Layout></ProtectedRoute>} />
```
