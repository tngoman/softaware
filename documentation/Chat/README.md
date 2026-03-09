# Staff Chat Module

> **Last Updated**: 2026-03-08
> **Status**: 144/144 tasks complete (100%) — E2E validated (77/77 tests passing)
> **Total LOC**: ~14,855 across 41 files

---

## Purpose

Full-featured staff messaging system supporting **1-on-1 DMs** and **group conversations** with real-time delivery, voice/video calling, rich media, and biometric authentication. Built as a complete WhatsApp-style chat experience for internal staff communication.

---

## Feature Summary

### Core Messaging
- **DMs & Groups** — Unified conversation model with `direct` and `group` types
- **Real-time delivery** — Socket.IO `/chat` namespace, room-based (`conv:<id>`)
- **Delivery ticks** — Sent (✓), Delivered (✓✓), Read (✓✓ blue) via `message_status`
- **Edit & Delete** — Edit own messages, delete for self or everyone
- **Reply & Forward** — Inline reply with preview, forward to multiple conversations
- **Reactions** — Emoji reactions with toggle add/remove
- **@Mentions** — `@DisplayName` autocomplete, bypasses mute for push notifications
- **Starring** — Per-user starred messages with dedicated panel
- **Global Search** — Full-text search across all user's conversations

### Rich Media
- **File uploads** — Base64 via JSON body, images/video/audio/documents
- **Image processing** — Thumbnails via sharp, compression, lightbox viewer with zoom/pan
- **Video processing** — Thumbnail extraction via ffmpeg
- **Audio** — Duration detection via ffprobe, custom player with waveform + speed control
- **Voice recording** — MediaRecorder + AnalyserNode live waveform visualization
- **GIF picker** — Tenor API integration with trending + search
- **Link previews** — Open Graph extraction via cheerio, LRU-cached (500 URLs)
- **Drag & drop** — File upload via drag-and-drop overlay in MessageInput
- **Media gallery** — Tab-filtered gallery (images, videos, files) in conversation info panel

### Voice & Video Calling (WebRTC)
- **1-on-1 & group calls** — RTCPeerConnection with STUN servers
- **Call signaling** — Socket.IO relay (offer/answer/ICE candidates)
- **Screen sharing** — `getDisplayMedia()` with track replacement
- **Call UI** — Full-screen overlay, ringing animation, video grid (up to 6 tiles), PIP local video
- **Incoming call modal** — Accept/decline with pulse animation, 45s auto-dismiss
- **Call history** — Slide-over panel with status, duration, re-call
- **Scheduled calls** — Create/manage scheduled meetings with title, description, recurrence, RSVP tracking, and participant management

### Notifications & Offline
- **FCM push notifications** — For offline users, high-priority for calls
- **Service worker** — Background notification handling
- **DND schedule** — Configurable quiet hours (suppresses push except @mentions)
- **Custom sounds** — Per-conversation notification sound
- **Offline queue** — IndexedDB-backed message queue, flushes on reconnect
- **Reconnect catch-up** — Missed events replayed via last-event timestamp

### Conversation Management
- **Pin** — Pinned conversations sort to top (📌 indicator)
- **Archive** — Hidden from main list, accessible via toggle
- **Mute** — Duration options: 1h, 8h, 1d, 1w, always
- **Clear** — "Delete for me" via `cleared_at` timestamp
- **Group icon** — Upload custom group avatar
- **Member management** — Add/remove members, admin/member roles

### Sharing
- **Location** — Geolocation API + Nominatim reverse geocode, rendered as map card
- **Contact cards** — Staff member picker, rendered as contact card with name/email/phone

### Security
- **WebAuthn / Passkeys** — Biometric sign-in via platform authenticator
- **Session management** — List active sessions, revoke individual or all
- **Token tracking** — SHA-256 hashed JWT stored per-session

---

## Key Files

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend Route | `routes/staffChat.ts` | 3,036 | 48 REST endpoints — conversations, members, messages, reactions, stars, search, media, calls, scheduled calls, DND, upload, profile, GIFs, reporting |
| Backend Service | `services/chatSocket.ts` | 569 | Socket.IO `/chat` namespace — 13 event handlers, 14 exported emitters |
| Backend Service | `services/linkPreview.ts` | 170 | URL metadata extraction with LRU cache |
| Backend Service | `services/mediaProcessor.ts` | 239 | Image/video/audio processing |
| Backend Auth | `routes/auth.ts` | 885 | Login, WebAuthn passkey endpoints, session management |
| DB Migration | `migrations/014_chat_system.ts` | 391 | Core schema (10 tables) + data migration |
| DB Migration | `migrations/015–017` | 214 | Enhancements, scheduled calls, WebAuthn tables, legacy cleanup |
| Frontend Page | `pages/general/ChatPage.tsx` | 1,574 | Orchestrator — state, socket listeners, call handlers |
| Frontend UI | `pages/general/chat/*.tsx` | 5,810 | 20 sub-components (sidebar, header, messages, input, dialogs, calls, scheduled calls, etc.) |
| Frontend Model | `models/StaffChatModel.ts` | 554 | TypeScript interfaces + static API methods |
| Frontend Service | `services/staffChatSocket.ts` | 97 | Socket.IO singleton + 12 emit helpers |
| Frontend Service | `services/webrtcService.ts` | 507 | WebRTC peer connection manager |
| Frontend Service | `services/chatOfflineQueue.ts` | 153 | IndexedDB offline message queue |

---

## Tech Stack

### Backend
- **Express.js** — Router, middleware
- **MySQL2** — Via `db` helper (`query`, `queryOne`, `insert`, `execute`, `transaction`)
- **Socket.IO v4** — `/chat` namespace, room-based events
- **Zod** — Request body validation
- **JWT** — `signAccessToken`, `requireAuth` middleware
- **cheerio** — HTML/OG tag parsing for link previews
- **sharp** — Image processing (optional, graceful fallback)
- **ffmpeg/ffprobe** — Video/audio processing (optional)
- **axios** — HTTP client for link preview fetching
- **Firebase Admin SDK** — `sendPushToUser()` for push notifications
- **crypto** — SHA-256 token hashing, WebAuthn challenge generation

### Frontend
- **React 18.2** — Hooks-based (useState, useEffect, useRef, useCallback, useMemo, memo)
- **TypeScript 4.9.5** — Strict typing throughout
- **react-router-dom 6.20** — `/chat` route
- **Zustand 4.4.7** — `useAppStore` for user identity
- **socket.io-client 4.8.3** — Real-time connection
- **Tailwind CSS 3.3.6** — All styling
- **Heroicons v2** — `@heroicons/react/24/outline` + `24/solid`
- **DOMPurify** — XSS protection for rendered markdown
- **SweetAlert2** — Confirmation dialogs
- **react-hot-toast** — Toast notifications

### External Services
| Service | Purpose | Endpoint |
|---------|---------|----------|
| Firebase Cloud Messaging | Push notifications | Via Firebase Admin SDK |
| Tenor API | GIF search | `https://tenor.googleapis.com/v2/` |
| Nominatim (OSM) | Reverse geocoding | `https://nominatim.openstreetmap.org/` |
| Google STUN | WebRTC ICE | `stun:stun.l.google.com:19302` |
| Silulumanzi WebSocket | External groups bridge | `https://webhook.silulumanzi.com:90/groups` |

---

## Database Tables (14 tables)

| Table | Purpose |
|-------|---------|
| `conversations` | DM and group conversations |
| `conversation_members` | Membership with roles, mute, pin, archive |
| `messages` | All message types with file attachments, link previews |
| `message_status` | Per-user delivery tracking (sent/delivered/read) |
| `message_reactions` | Emoji reactions per message per user |
| `starred_messages` | Per-user starred messages |
| `deleted_messages` | Per-user "delete for me" tracking |
| `user_presence` | Online/offline status, DND schedule |
| `call_sessions` | Voice/video call sessions |
| `call_participants` | Per-call participant tracking |
| `scheduled_calls` | Scheduled meeting sessions with recurrence |
| `scheduled_call_participants` | Per-scheduled-call RSVP tracking |
| `webauthn_credentials` | Passkey/biometric credentials |
| `user_sessions` | Active JWT session tracking |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│                                                  │
│  ChatPage.tsx ─── StaffChatModel ─── REST API    │
│       │                                          │
│  staffChatSocket ─── Socket.IO ─── /chat ns      │
│       │                                          │
│  webrtcService ─── RTCPeerConnection ─── P2P     │
│       │                                          │
│  chatOfflineQueue ─── IndexedDB                  │
└────────────────────┬────────────────────────────-┘
                     │
┌────────────────────┴────────────────────────────-┐
│                   Backend                         │
│                                                   │
│  staffChat.ts (REST) ──┬── MySQL (14 tables)      │
│                        │                          │
│  chatSocket.ts ────────┤── Socket.IO rooms        │
│                        │                          │
│  linkPreview.ts ───────┤── cheerio + LRU cache    │
│  mediaProcessor.ts ────┤── sharp + ffmpeg         │
│                        │                          │
│  auth.ts ──────────────┤── WebAuthn + Sessions    │
│                        │                          │
│  firebaseService.ts ───┘── FCM push               │
└───────────────────────────────────────────────────┘
```

---

## E2E Test Suite

A comprehensive bash-based E2E test script (`e2e_chat_test.sh`) validates all 6 phases:

| Category | Tests | Status |
|----------|-------|--------|
| Conversations CRUD | 8 | ✅ |
| Members Management | 6 | ✅ |
| Messages CRUD | 7 | ✅ |
| Search | 2 | ✅ |
| Media & Profile | 3 | ✅ |
| Rich Media (links, GIFs, upload) | 3 | ✅ |
| DND & Notifications | 4 | ✅ |
| Sync | 1 | ✅ |
| Reactions | 3 | ✅ |
| Forward / Star / Report | 4 | ✅ |
| Voice & Video Calls | 3 | ✅ |
| Scheduled Calls | 4 | ✅ |
| Management (clear, WebAuthn, sessions) | 3 | ✅ |
| Auth & Permissions | 4 | ✅ |
| Cleanup (delete) | 4 | ✅ |
| Socket.IO (connect + events) | 2 | ✅ |
| Database Tables | 14 | ✅ |
| **Total** | **77** | **100%** |

**Run**: `cd /var/opt/backend && bash e2e_chat_test.sh`
