# SoftAware Mobile App — Wiring & Implementation Status

> **Last updated:** June 4, 2025  
> **Purpose:** Concise map of the app's architecture, what's wired, and what still needs work.  
> **Scope:** User-facing mobile features only — admin consoles, financial dashboards, reports, quotes, invoices, and payments are intentionally excluded.

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + TypeScript |
| Navigation | React Navigation 6 (Native Stack + Bottom Tabs + Drawer) |
| State | React Context (`AuthContext`, `AppContext`) |
| **HTTP** | Custom fetch-based singleton (`src/api/client.ts`) with JWT auto-attach + 401 retry |
| Caching | `useCachedFetch` hook with AsyncStorage + configurable TTL |
| Real-time | Socket.IO client v4 (`src/services/chatSocket.ts`) — `/chat` namespace |
| Local DB | `AsyncStorage` JSON cache (`src/services/chatDb.ts`) — in-memory mirror + background persist |
| Voice | `react-native-voice` (STT) + `react-native-tts` (TTS) via `useVoiceAssistant` hook |
| Push | Firebase Cloud Messaging (`src/services/notifications.ts`) |
| Secure Storage | `react-native-keychain` |
| Design System | Custom tokens in `src/theme/index.ts` (colors, spacing, typography, shadows, gradients) |

---

## 2. Navigation Map

```
AppNavigator (root)
│
├─ NOT AUTH → AuthNavigator
│   ├─ Login         → LoginScreen
│   ├─ Register      → RegisterScreen
│   └─ TwoFactor     → TwoFactorScreen              ⚠️ STUB
│
├─ STAFF → AdminTabNavigator (Drawer + BottomTabs)
│   ├─ DashboardTab → DashboardStack
│   │   ├─ Dashboard               (DashboardScreen)
│   │   ├─ Notifications           (NotificationsScreen)
│   │   └─ AiAssistants → AssistantForm / AssistantChat / ConversationHistory
│   ├─ TasksTab → TasksStack
│   │   ├─ TasksList               (TasksListScreen)
│   │   ├─ TaskDetail              (TaskDetailScreen)
│   │   └─ TaskForm                (TaskFormScreen)
│   ├─ AiTab → AiStack
│   │   └─ AiChat                  (AiChatScreen)
│   ├─ GroupsTab → GroupsStack
│   │   ├─ ChatList                (ChatListScreen)         ✅ NEW
│   │   ├─ ChatScreen              (ChatScreen)             ✅ NEW
│   │   ├─ NewChat                 (NewChatScreen) modal    ✅ NEW
│   │   ├─ GroupInfo               (GroupInfoScreen)        ✅ NEW
│   │   ├─ ChatUserProfile         (ChatUserProfileScreen)  ✅ NEW
│   │   ├─ StarredMessages         (StarredMessagesScreen)  ✅ NEW
│   │   ├─ MediaGallery            (MediaGalleryScreen)     ✅ NEW
│   │   ├─ CallHistory             (CallHistoryScreen) stub ✅ NEW
│   │   ├─ ChatSearch              (ChatSearchScreen)       ✅ Phase 4
│   │   ├─ GroupsList              (GroupsListScreen) legacy
│   │   └─ GroupChat               (GroupChatScreen)  legacy
│   └─ SettingsTab → SettingsStack
│       ├─ Settings                (SettingsScreen)         ⚠️ READ-ONLY
│       ├─ Profile                 (ProfileScreen)          ⚠️ READ-ONLY
│       ├─ TwoFactorSettings       (TwoFactorSettingsScreen)
│       └─ Notifications           (NotificationsScreen)
│
└─ REGULAR USER → PortalTabNavigator (Drawer + BottomTabs)
    ├─ PortalHomeTab → PortalStack
    │   ├─ PortalDashboard         (PortalDashboardScreen)
    │   └─ PortalSettings
    ├─ AssistantsTab → AssistantsStack
    │   └─ AssistantsList → AssistantChat / AssistantForm / ConversationHistory
    ├─ NotificationsTab → NotifStack
    │   └─ Notifications           (NotificationsScreen)
    ├─ GroupsTab → GroupsStack (shared)
    │   ├─ GroupsList
    │   └─ GroupChat
    └─ AccountTab → AccountStack
        ├─ Profile
        ├─ TwoFactorSettings
        └─ Settings
```

---

## 3. API Layer Wiring

### Base Client (`src/api/client.ts`)
- Singleton Axios instance → `https://api.softaware.net.za`
- Auto-attaches `Authorization: Bearer <jwt>` to every request
- 401 interceptor → attempts token refresh → retries original request → logs out on failure
- Task endpoints use dual-token pattern: JWT + `X-Software-Token`

### Service Modules

| Module | File | Key Endpoints | Status |
|--------|------|---------------|--------|
| **Auth** | `api/auth.ts` | `POST /auth/login`, `/register`, `/logout`, `/refresh`, `/validate`, `/me`, 2FA setup/verify/disable/regenerate | ✅ Wired |
| **Profile** | `api/profile.ts` | `GET /profile`, `PUT /profile` | ✅ Wired (but PUT not used in UI) |
| **Dashboard** | `api/dashboard.ts` | `GET /dashboard/stats` | ✅ Wired |
| **Notifications** | `api/notifications.ts` | CRUD + mark-read + unread-count | ✅ Wired |
| **Tasks** | `api/tasks.ts` | Full CRUD + comments + attachments + reorder + software auth | ✅ Wired |
| **AI / Assistants** | `api/ai.ts` | My-assistant CRUD, set primary, mobile intent, conversations, chat SSE | ✅ Wired |
| **Groups** | `api/groups.ts` | CRUD + members + messages (paginated) + send | ✅ Wired |
| **Chat** | `api/chat.ts` | Conversations CRUD, messages, reactions, stars, media, file upload, user profiles, sync, calls | ✅ Wired (NEW) |
| **FCM** | `api/fcm.ts` | Register/unregister device token | ✅ Wired |
| **Settings** | `api/settings.ts` | Public settings, company settings | ✅ Wired |
| **Teams** | `api/teams.ts` | Invite member | ✅ Wired |
| **Updates** | `api/updates.ts` | Summary + history + software CRUD | ✅ Wired |
| **Admin** | `api/admin.ts` | Users, roles, credits, subscriptions | ✅ Wired (admin only — out of scope) |
| **Software** | `api/software.ts` | Software registry | ✅ Wired |
| **Database** | `api/database.ts` | DB operations | ✅ Wired (admin only — out of scope) |

---

## 4. State Management

### AuthContext (`src/contexts/AuthContext.tsx`)
| State / Method | Description | Status |
|---------------|-------------|--------|
| `user`, `token`, `isAuthenticated` | Core auth state | ✅ |
| `login(email, password)` | Calls API, stores token in Keychain, registers FCM | ✅ |
| `logout()` | Clears Keychain, unregisters FCM, resets navigation | ✅ |
| `refreshToken()` | Auto-refresh every 45 min | ✅ |
| `isStaff`, `isAdmin`, `isRegularUser` | Role checks | ✅ |
| `hasPermission(slug)` | Permission gate | ✅ |
| FCM foreground handler | Shows in-app toast via react-native-toast-message | ✅ |
| FCM notification-opened handler | Deep-links to relevant screen via notificationNavigation | ✅ |
| FCM initial-notification handler | Cold-launch deep-link via notificationNavigation | ✅ |

### AppContext (`src/contexts/AppContext.tsx`)
| State / Method | Description | Status |
|---------------|-------------|--------|
| `publicSettings` | Loaded on mount | ✅ |
| `unreadCount` | Polled every 60 s | ✅ |
| `refreshUnreadCount()` | Manual trigger | ✅ |

### ChatContext (`src/contexts/ChatContext.tsx`) — NEW
| State / Method | Description | Status |
|---------------|-------------|--------|
| `conversations` | Array of all user conversations | ✅ |
| `chatUnreadCount` | Total unread across all conversations | ✅ |
| `isSocketConnected` | Socket.IO connection status | ✅ |
| `presenceMap` | Online/offline status for all users | ✅ |
| `typingUsers` | Currently typing users per conversation | ✅ |
| `refreshConversations()` | Manual pull from API + AsyncStorage cache | ✅ |
| `getTypingUsersForConversation()` | Per-conv typing info | ✅ |
| `isUserOnline()` | Presence check per user | ✅ |
| `markConversationRead()` | Mark conv read + update unread | ✅ |

---

## 5. Custom Hooks

| Hook | File | Purpose | Status |
|------|------|---------|--------|
| `useCachedFetch` | `hooks/useCachedFetch.ts` | Cache-first data fetch with AsyncStorage + TTL (default 5 min). Supports `enabled` flag to conditionally skip fetch. Returns `{ data, loading, error, refresh }` | ✅ |
| `useVoiceAssistant` | `hooks/useVoiceAssistant.ts` | Full push-to-talk state machine: idle → listening → processing → speaking → idle. Handles STT, TTS, multi-turn `conversationId`, error recovery | ✅ |
| `useChatSocket` | `hooks/useChatSocket.ts` | Wires Socket.IO events to React state — typing users, presence map, message events. Returns `{ isConnected, typingUsers, presenceMap }` | ✅ NEW |

### Phase 3 Services

| Service | File | Purpose | Status |
|---------|------|---------|--------|
| `ChatNotificationHandler` | `services/chatNotificationHandler.ts` | Foreground push handler for chat — suppresses when viewing same conv, respects mute, badge count | ✅ Phase 3 |
| `SyncService` | `services/syncService.ts` | Delta sync on reconnect via `/chat/sync`, offline message queue with file upload support, cache eviction | ✅ Phase 3 |

---

## 6. Reusable Components

| Component | File | Description |
|-----------|------|-------------|
| `AppCard` | `ui/AppCard.tsx` | Card with accent border, `KpiCard`, `ListRow`, `SectionTitle`, `Divider` |
| `Avatar` | `ui/Avatar.tsx` | Gradient circular avatar with initials |
| `Badge` | `ui/Badge.tsx` | 9 color variants + `NotificationDot` + `StatusDot` |
| `ChatBubble` | `ui/ChatBubble.tsx` | User/assistant bubble + `TypingIndicator` |
| `FormControls` | `ui/FormControls.tsx` | `AppTextInput` (focus ring, error, icons) + `AppButton` (5 variants, 3 sizes, loading) |
| `GradientHeader` | `ui/GradientHeader.tsx` | Screen header with gradient, title, subtitle, back/right actions |
| `ListItemCard` | `ui/ListItemCard.tsx` | Pressable card + `SectionHeader` |
| `LoadingScreen` | `ui/LoadingScreen.tsx` | Full-screen spinner |
| `PaginatedList` | `ui/PaginatedList.tsx` | Generic paginated FlatList with pull-to-refresh + load-more + empty state |
| `StateViews` | `ui/StateViews.tsx` | `LoadingView`, `EmptyView`, `ErrorBanner`, `AccessDenied` |
| `EmojiPicker` | `ui/EmojiPicker.tsx` | Full emoji grid with 8 categories, recent emojis, `QuickReactRow` for reactions | ✅ NEW |
| `AttachmentPicker` | `ui/AttachmentPicker.tsx` | Bottom sheet for Camera, Gallery, Document, GIF, Location, Contact | ✅ NEW |
| `VoiceNoteRecorder` | `ui/VoiceNoteRecorder.tsx` | Hold-to-record overlay with slide-to-cancel, pulse animation, timer | ✅ Phase 2 |
| `VoiceNotePlayer` | `ui/VoiceNotePlayer.tsx` | Inline voice note player with waveform bars, progress, singleton playback | ✅ Phase 2 |
| `ImageViewerModal` | `ui/ImageViewerModal.tsx` | Full-screen pinch-to-zoom image viewer, share/save, caption overlay | ✅ Phase 2 |
| `MediaThumbnail` | `ui/MediaThumbnail.tsx` | Image/video thumbnail for chat bubbles, tap opens viewer/player | ✅ Phase 2 |
| `FileMessageBubble` | `ui/FileMessageBubble.tsx` | File attachment display with download progress bar, tap to open | ✅ Phase 2 |
| `LinkPreviewCard` | `ui/LinkPreviewCard.tsx` | URL preview card for messages with image, title, description, domain | ✅ Phase 2 |
| `MentionAutocomplete` | `ui/MentionAutocomplete.tsx` | @mention autocomplete dropdown for group chat input, floating member list | ✅ Phase 4 |
| `ForwardMessageSheet` | `ui/ForwardMessageSheet.tsx` | Modal for forwarding messages to multiple conversations, searchable multi-select | ✅ Phase 4 |
| `ReactionDetailModal` | `ui/ReactionDetailModal.tsx` | Bottom sheet showing who reacted with which emoji, tabs per emoji | ✅ Phase 4 |
| `DrawerContent` | `navigation/DrawerContent.tsx` | Admin + Portal drawer menus |

---

## 7. Screens — Implementation Status (User-Facing Only)

### ✅ Fully Implemented (24 screens)

| Screen | File | Lines | Notes |
|--------|------|------:|-------|
| LoginScreen | `screens/auth/LoginScreen.tsx` | 344 | Robot mascot, email auto-suffix, 2FA redirect |
| RegisterScreen | `screens/auth/RegisterScreen.tsx` | 348 | Full form with validation |
| TwoFactorSettingsScreen | `screens/auth/TwoFactorSettingsScreen.tsx` | 358 | Setup, QR, verify, backup codes, disable |
| DashboardScreen | `screens/dashboard/DashboardScreen.tsx` | 530 | Role-aware: staff/admin see Task status cards; portal/client see AI usage metrics + plan. Quick actions & assistants for all |
| PortalDashboardScreen | `screens/portal/PortalDashboardScreen.tsx` | 233 | Tier badge, portal layout |
| NotificationsScreen | `screens/notifications/NotificationsScreen.tsx` | 161 | Paginated, mark read, pull-to-refresh |
| TasksListScreen | `screens/tasks/TasksListScreen.tsx` | 942 | Software selection, search, filter, 30 s auto-refresh |
| TaskDetailScreen | `screens/tasks/TaskDetailScreen.tsx` | 740 | Hero header, status picker, comments |
| TaskFormScreen | `screens/tasks/TaskFormScreen.tsx` | 737 | Create/edit with chips, date pickers, hours |
| **ChatListScreen** | `screens/groups/ChatListScreen.tsx` | ~350 | WhatsApp-like conv list: pinned/archived, search, unread badges, typing, online dots, long-press context | ✅ NEW |
| **ChatScreen** | `screens/groups/ChatScreen.tsx` | ~1530 | Full messaging + rich media + Phase 3 (sync, notifications, divider) + Phase 4 (reactions, @mentions, forward, report) | ✅ Phase 4 |
| **NewChatScreen** | `screens/groups/NewChatScreen.tsx` | ~200 | Start DM or create group with searchable staff list | ✅ NEW |
| **GroupInfoScreen** | `screens/groups/GroupInfoScreen.tsx` | ~280 | Group details, edit name/desc (admin), member list, leave/delete | ✅ NEW |
| **ChatUserProfileScreen** | `screens/groups/ChatUserProfileScreen.tsx` | ~320 | User profile from chat, quick actions, shared media/groups | ✅ NEW |
| **StarredMessagesScreen** | `screens/groups/StarredMessagesScreen.tsx` | ~180 | Card-based starred messages list with unstar toggle | ✅ NEW |
| **MediaGalleryScreen** | `screens/groups/MediaGalleryScreen.tsx` | ~290 | Three tabs (Media grid, Docs list, Links list) with pagination | ✅ NEW |
| **ChatSearchScreen** | `screens/groups/ChatSearchScreen.tsx` | ~225 | Global message search with debounce, highlighted results, navigate to conversation | ✅ Phase 4 |
| GroupsListScreen | `screens/groups/GroupsListScreen.tsx` | 99 | Legacy — paginated list |
| GroupChatScreen | `screens/groups/GroupChatScreen.tsx` | 152 | Legacy — messages, input, auto-scroll |
| AiChatScreen | `screens/ai/AiChatScreen.tsx` | 798 | Voice push-to-talk, text fallback, assistant picker, conversations |
| AiAssistantsScreen | `screens/ai/AiAssistantsScreen.tsx` | 232 | List, set primary, delete, chat/edit |
| AssistantFormScreen | `screens/ai/AssistantFormScreen.tsx` | 346 | Create/edit, personality/voice chips |
| ConversationHistoryScreen | `screens/ai/ConversationHistoryScreen.tsx` | 170 | List, delete, resume |
| TeamManagementScreen | `screens/teams/TeamManagementScreen.tsx` | 183 | Member list, invite, remove |
| ProfileScreen | `screens/profile/ProfileScreen.tsx` | ~200 | Edit mode (name/phone), change password section | ✅ UPDATED |

### ⚠️ Partially Implemented (1 screen)

| Screen | Issue |
|--------|-------|
| **SettingsScreen** | Read-only — fetches and displays company/billing info but no edit capability. |

### ❌ Stub (2 screens)

| Screen | Issue |
|--------|-------|
| **TwoFactorScreen** | Shows "not currently supported" message. Needs full 6-digit OTP input, countdown timer, backup code fallback to complete login 2FA flow. |
| **CallHistoryScreen** | Placeholder "Coming Soon" screen. Will be replaced with full call history listing in Phase 5 (Voice/Video Calls). | ✅ NEW |

---

## 8. What Still Needs to Be Implemented

### 🔴 Priority 1 — Broken / Blocking Flows

| # | Item | Detail |
|---|------|--------|
| 1 | **TwoFactorScreen — complete the login 2FA flow** | The screen is a stub. Users with 2FA enabled cannot log in. Needs: 6-digit OTP input, `POST /auth/2fa/verify` call, backup-code fallback link, countdown timer, error handling. |
| 2 | ~~**FCM push handlers — wire notification actions**~~ | ✅ DONE — Foreground shows in-app toast, notification-opened & cold-launch deep-link via `notificationNavigation.ts` |

### 🟡 Priority 2 — Missing Core User Features

| # | Item | Detail |
|---|------|--------|
| 3 | ~~**Profile editing**~~ | ✅ DONE — ProfileScreen now has edit mode for name/phone + change password section |
| 4 | ~~**Change password**~~ | ✅ DONE — Included in updated ProfileScreen |
| 5 | ~~**Notification deep-linking**~~ | ✅ DONE — `notificationNavigation.ts` maps notification types to nav routes |
| 6 | **Portal Sites — basic CRUD** | Specified for portal users: list, view, create, edit personal landing-page sites. Needs `SitesListScreen`, `SiteDetailScreen`, `SiteFormScreen`. No API module exists yet — will need `api/sites.ts`. |

### 🟠 Priority 3 — Enhancements to Existing Screens

| # | Item | Detail |
|---|------|--------|
| 7 | **Task attachments — view & upload** | `api/tasks.ts` already has attachment endpoints. `TaskDetailScreen` needs an attachments section with image/document viewer and an upload button (image picker + `POST /tasks/:id/comments/with-attachment`). |
| 8 | **Task associations** | Link related/blocking/child tasks. API endpoints are wired (`api/tasks.ts`). Needs UI in `TaskDetailScreen` — a "Related Tasks" section with add/remove. |
| 9 | **Settings screen — make editable** | Currently read-only. At minimum add notification preference toggles and theme selection. |
| 10 | **AI Chat — tool execution chips** | When the AI assistant calls tools (e.g., create task, list tasks), show collapsible chips in the chat UI that display the tool name and result. Currently tool calls return as plain text. |
| 11 | **AI Chat — assistant picker in header** | Spec calls for a dropdown in the chat header to switch assistants mid-conversation. `AiChatScreen` may partially have this — verify and complete. |

### ⚪ Priority 4 — Infrastructure & Polish

| # | Item | Detail |
|---|------|--------|
| 12 | **Offline mutation queue** | `useCachedFetch` handles read caching. Write operations (create task, send message, etc.) should queue when offline and retry on reconnect. |
| 13 | **Skeleton / shimmer loading states** | Screens currently show a spinner. Replace with content-shaped skeleton placeholders for a smoother perceived load. |
| 14 | **Deep linking configuration** | Navigation types exist but no React Navigation linking config. Needed for push notifications and universal links. |
| 15 | **Component cleanup** | `Cards.tsx` (legacy) overlaps with `AppCard.tsx` (current). `EmptyState` in `PaginatedList` overlaps with `EmptyView` in `StateViews`. Consolidate. |
| 16 | **Unit / integration tests** | Zero test files exist. Add at minimum: API client tests, auth flow tests, hook tests, and screen snapshot tests. |

---

## 9. Intentionally Excluded from Mobile

These features exist in the spec or API layer but are **admin/back-office** and should **not** be built into the mobile app:

- ❌ Financial Dashboard (revenue, profit, outstanding, aging charts)
- ❌ Quotations CRUD + PDF + email
- ❌ Invoices CRUD + PDF + email
- ❌ Payments recording
- ❌ Financial Reports / Transactions
- ❌ Admin Dashboard (user management, subscriptions, credits)
- ❌ Database Manager
- ❌ Credentials Vault
- ❌ System Users / Roles / Permissions management
- ❌ AI Credits management
- ❌ Software Registry / Module management
- ❌ Update Distribution console

> **Note:** `AdminDashboardScreen` and `UpdatesDashboardScreen` exist in the codebase and reference admin-only data. Consider whether these screens should be removed or repurposed to avoid confusion.

---

## 10. File Quick-Reference

```
src/
├── api/            17 service modules — all wired to backend (incl. chat.ts NEW)
├── components/
│   ├── navigation/ DrawerContent (admin + portal)
│   └── ui/         23 reusable components (incl. Phase 2 rich media, Phase 4: MentionAutocomplete, ForwardMessageSheet, ReactionDetailModal)
├── constants/      config (URLs, keys), colors (re-export)
├── contexts/       AuthContext, AppContext, ChatContext (NEW)
├── hooks/          useCachedFetch, useVoiceAssistant, useChatSocket (NEW)
├── navigation/     AppNavigator, AuthNavigator, AdminTabNavigator,
│                   PortalTabNavigator, FeatureStacks, PortalStacks, types
├── screens/        28 screens across 10 feature folders (9 NEW chat screens)
├── services/       FCM wrapper, chatSocket.ts, chatDb.ts, notificationNavigation.ts,
│                   chatNotificationHandler.ts (Phase 3), syncService.ts (Phase 3)
├── theme/          Full design token system
├── types/          35+ TypeScript interfaces + chat.ts (NEW) + vendor declarations
├── utils/          formatting, permissions, validation
└── utils/fileDownload.ts  File download with progress, cache, open/save utilities (Phase 2)
```

**Total: ~93 source files · ~19,500+ lines of TypeScript/TSX**
