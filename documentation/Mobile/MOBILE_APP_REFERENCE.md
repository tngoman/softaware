# SoftAware Mobile App — Implementation Reference

> **Purpose:** Context document for anyone creating wiring/implementation guides for new features in the mobile app. Read this first so you understand what already exists, how the app is structured, and the conventions to follow.
>
> **Last Updated:** 2026-03-11
> **React Native:** 0.76.5 &nbsp;|&nbsp; **Language:** TypeScript
> **Platforms:** Android + iOS &nbsp;|&nbsp; **Package Manager:** npm

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [App Entry Point & Provider Tree](#3-app-entry-point--provider-tree)
4. [Navigation Architecture](#4-navigation-architecture)
5. [Screens Inventory](#5-screens-inventory)
6. [State Management (Contexts)](#6-state-management-contexts)
7. [API Layer](#7-api-layer)
8. [Services Layer](#8-services-layer)
9. [Type System](#9-type-system)
10. [Theme & Design Tokens](#10-theme--design-tokens)
11. [Reusable UI Components](#11-reusable-ui-components)
12. [Custom Hooks](#12-custom-hooks)
13. [Authentication & User Roles](#13-authentication--user-roles)
14. [Push Notifications](#14-push-notifications)
15. [Real-Time (Socket.IO)](#15-real-time-socketio)
16. [Offline & Caching Strategy](#16-offline--caching-strategy)
17. [Coding Conventions](#17-coding-conventions)
18. [How to Add a New Feature](#18-how-to-add-a-new-feature)

---

## 1. Project Structure

```
SoftAwareApp/
├── App.tsx                         # Root component, provider tree, deep linking
├── index.js                        # RN entry, FCM background handler registration
├── package.json
├── tsconfig.json
├── metro.config.js
├── babel.config.js
├── android/                        # Native Android project
├── ios/                            # Native iOS project (placeholder)
├── documentation/WIRING/           # Feature wiring guides (this folder)
└── src/
    ├── api/                        # REST API modules (one file per domain)
    │   ├── client.ts               # Singleton ApiClient (fetch wrapper)
    │   ├── index.ts                # Barrel re-exports
    │   ├── auth.ts
    │   ├── chat.ts
    │   ├── cases.ts
    │   ├── tasks.ts
    │   ├── profile.ts
    │   ├── fcm.ts
    │   ├── notifications.ts
    │   ├── ai.ts
    │   ├── webmail.ts
    │   ├── sites.ts
    │   └── ... (admin, dashboard, groups, settings, software, teams, updates, webhooks)
    ├── components/
    │   ├── ui/                     # Reusable UI primitives (cards, buttons, lists, media)
    │   ├── ai/                     # AI-specific components
    │   └── navigation/             # DrawerContent, tab bar customizations
    ├── config/                     # (unused / minimal)
    ├── constants/
    │   ├── config.ts               # API_BASE_URL, STORAGE_KEYS, TOKEN_REFRESH_INTERVAL
    │   ├── colors.ts               # Legacy color constants
    │   └── caseConfig.ts           # Case severity/status config
    ├── contexts/                   # React Context providers (global state)
    │   ├── AuthContext.tsx          # Auth state, login/logout, token refresh, FCM setup
    │   ├── AppContext.tsx           # Public settings, unread notification count
    │   ├── ChatContext.tsx          # Conversation list, socket lifecycle, unread badges
    │   ├── CallContext.tsx          # WebRTC call state, incoming/active call navigation
    │   └── ExternalGroupsContext.tsx # WhatsApp bridge groups (external system)
    ├── hooks/
    │   ├── useCachedFetch.ts       # Cache-first + background refresh (AsyncStorage)
    │   ├── useChatSocket.ts        # Socket.IO event → React state bridge
    │   └── useVoiceAssistant.ts    # TTS + STT for AI voice interaction
    ├── navigation/
    │   ├── AppNavigator.tsx        # Re-exports RootNavigator
    │   ├── RootNavigator.tsx       # Top-level stack: Main + fullscreen modals (calls)
    │   ├── AuthNavigator.tsx       # Login / Register / 2FA / QR Auth
    │   ├── AdminTabNavigator.tsx   # Admin/staff bottom tabs (wrapped in drawer)
    │   ├── PortalTabNavigator.tsx  # Portal/user bottom tabs (wrapped in drawer)
    │   ├── FeatureStacks.tsx       # All stack navigators (Dashboard, Tasks, Groups, etc.)
    │   ├── PortalStacks.tsx        # Portal-only stacks (Home, Assistants, Account, etc.)
    │   └── types.ts                # All ParamList type definitions
    ├── screens/                    # Screen components (one folder per module)
    │   ├── admin/
    │   ├── ai/
    │   ├── auth/
    │   ├── cases/
    │   ├── dashboard/
    │   ├── groups/                 # Chat, calls, external groups
    │   ├── mail/
    │   ├── notifications/
    │   ├── portal/
    │   ├── profile/
    │   ├── settings/
    │   ├── sites/
    │   ├── tasks/
    │   ├── teams/
    │   └── updates/
    ├── services/                   # Business logic, sockets, native bridges
    │   ├── notifications.ts        # FCM token registration, permission, listeners
    │   ├── notificationNavigation.ts # Push type → screen routing + navigation ref
    │   ├── notificationChannels.ts # Android notification channels (notifee, optional)
    │   ├── chatNotificationHandler.ts # Foreground chat/call push handling
    │   ├── chatSocket.ts           # Socket.IO /chat namespace connection manager
    │   ├── chatDb.ts               # AsyncStorage chat cache (offline-first)
    │   ├── syncService.ts          # Delta sync on reconnect / foreground resume
    │   ├── webrtcService.ts        # RTCPeerConnection lifecycle, media streams
    │   ├── externalGroupsSocket.ts # Socket.IO for WhatsApp bridge groups
    │   └── externalGroupsCache.ts  # AsyncStorage cache for external groups
    ├── theme/
    │   └── index.ts                # Design tokens (colors, spacing, typography, shadows)
    ├── types/
    │   ├── index.ts                # All shared TypeScript interfaces
    │   ├── chat.ts                 # Chat-specific types (Conversation, Message, Call, Socket events)
    │   ├── cases.ts                # Case types
    │   ├── externalGroups.ts       # WhatsApp bridge types
    │   ├── sites.ts                # Site builder types
    │   ├── webhooks.ts             # Webhook/capability types
    │   └── webmail.ts              # Mail types
    └── utils/
        ├── permissions.ts          # getUserType, isAdminOrStaff, hasPermission
        ├── formatting.ts           # Date formatting, relative time, currency
        ├── validation.ts           # Form validation helpers
        └── fileDownload.ts         # Blob download via react-native-blob-util
```

---

## 2. Tech Stack & Dependencies

### Core

| Library | Version | Purpose |
|---------|---------|---------|
| `react-native` | 0.76.5 | Framework |
| `react` | 18.3.1 | UI library |
| `typescript` | ~5.3 | Type safety |

### Navigation

| Library | Purpose |
|---------|---------|
| `@react-navigation/native` ^6.1 | Core navigation |
| `@react-navigation/native-stack` ^6.9 | Stack navigators (native performance) |
| `@react-navigation/bottom-tabs` ^6.5 | Bottom tab bars |
| `@react-navigation/drawer` ^6.6 | Side drawer (admin/portal) |

### UI

| Library | Purpose |
|---------|---------|
| `react-native-paper` ^5.12 | Material Design 3 components (used for Switch, Surface, etc.) |
| `react-native-vector-icons` ^10 | Icons (MaterialCommunityIcons throughout) |
| `react-native-linear-gradient` | Header gradients |
| `react-native-toast-message` ^2.3 | In-app toast notifications |
| `react-native-gesture-handler` + `react-native-reanimated` | Gestures and animations |
| `react-native-safe-area-context` + `react-native-screens` | Safe area + native screen containers |
| `react-native-context-menu-view` | Long-press context menus |

### Data & Networking

| Library | Purpose |
|---------|---------|
| `@react-native-async-storage/async-storage` | Persistent key-value store (tokens, cache, chat DB) |
| `socket.io-client` ^4.8 | Real-time WebSocket (chat, presence, calls) |

### Firebase & Notifications

| Library | Purpose |
|---------|---------|
| `@react-native-firebase/app` + `/messaging` ^23.8 | FCM push notifications |
| `@notifee/react-native` ^9.1 | Local notifications & Android channels (optional — gracefully degrades) |

### Media & Files

| Library | Purpose |
|---------|---------|
| `react-native-image-picker` | Photo/video selection |
| `react-native-camera-kit` | Camera access |
| `react-native-document-picker` | File selection |
| `react-native-compressor` | Image/video compression before upload |
| `react-native-video` | Video playback |
| `react-native-image-zoom-viewer` | Full-screen image viewing |
| `react-native-fs` + `react-native-blob-util` | File system access + downloads |
| `react-native-share` | Native share sheet |

### Communication

| Library | Purpose |
|---------|---------|
| `react-native-webrtc` | Voice/video calls (WebRTC) |
| `react-native-incall-manager` | Audio routing, proximity sensor during calls |
| `react-native-tts` | Text-to-speech (AI voice assistant) |
| `@react-native-voice/voice` | Speech-to-text (AI voice input) |
| `react-native-audio-recorder-player` | Voice note recording/playback |

### Utilities

| Library | Purpose |
|---------|---------|
| `date-fns` ^3.6 | Date formatting and manipulation |
| `react-native-svg` | SVG rendering |
| `react-native-webview` | WebView for embedded content |
| `@react-native-community/datetimepicker` | Native date/time picker |
| `@react-native-community/netinfo` | Network connectivity detection |

---

## 3. App Entry Point & Provider Tree

### `index.js`

Registers the FCM background message handler **before** `AppRegistry.registerComponent`. This must stay at the top level — outside any component. Also suppresses noisy LogBox warnings.

### `App.tsx` — Provider Nesting Order

```
GestureHandlerRootView
  SafeAreaProvider
    PaperProvider (theme)
      NavigationContainer (ref, linking, theme)
        AuthProvider          ← Auth state, token refresh, FCM init
          AppProvider         ← Public settings, unread notification count
            ChatProvider      ← Socket.IO lifecycle, conversation list
              CallProvider    ← WebRTC state, call navigation
                ExternalGroupsProvider  ← WhatsApp bridge groups
                  StatusBar
                  AppNavigator  → RootNavigator
    Toast                     ← Toast message overlay (outside nav)
```

**Key rules:**
- `AuthProvider` must wrap everything that needs auth state
- `ChatProvider` needs auth (for socket token) and app state
- `CallProvider` needs chat (for socket events) and navigation ref
- `Toast` is placed **outside** the NavigationContainer so it overlays everything
- The `NavigationContainer` `onReady` callback stores the navigation ref globally via `setNavigationRef()` for use by services (FCM, calls)

### Deep Linking

```typescript
prefixes: ['softaware://', 'https://app.softaware.net.za']
```

Screen paths are mapped in `App.tsx` under the `linking.config.screens` object. When adding new screens that should be deep-linkable, add them here.

---

## 4. Navigation Architecture

### Hierarchy

```
RootNavigator (NativeStack)
├── Main (screen)
│   ├── [if not authenticated]  AuthNavigator (NativeStack)
│   │   ├── Login
│   │   ├── Register
│   │   ├── TwoFactor
│   │   └── MobileQRAuth
│   │
│   ├── [if admin/staff]  AdminTabNavigator (Drawer → BottomTab)
│   │   ├── DashboardTab  → DashboardStack
│   │   ├── TasksTab      → TasksStack
│   │   ├── CasesTab      → CasesStack
│   │   ├── AiTab         → AiStack
│   │   ├── GroupsTab     → GroupsStack
│   │   ├── MailTab       → MailStack
│   │   └── SettingsTab   → SettingsStack
│   │
│   └── [if portal user]  PortalTabNavigator (Drawer → BottomTab)
│       ├── PortalHomeTab → PortalHomeStack
│       ├── CasesTab      → CasesStack (shared)
│       ├── SitesTab      → SitesStack
│       ├── AiTab         → AiStack (shared)
│       ├── AssistantsTab → AssistantsStack
│       ├── NotificationsTab → NotificationsStack
│       └── AccountTab    → AccountStack
│
├── IncomingCall (fullScreenModal)   ← Root-level so it's reachable from anywhere
└── ActiveCall (fullScreenModal)
```

### Key Patterns

- **Two user experiences:** Admin/staff and Portal (regular user) have different tab bars. The `RootNavigator` switches based on `isAdminOrStaff` from `AuthContext`.
- **Shared stacks:** `CasesStackNavigator`, `AiStackNavigator` and some others are reused in both Admin and Portal navigators.
- **Root-level modals:** `IncomingCall` and `ActiveCall` are placed on the `RootStack` so they can be navigated to from any context (push notification, socket event, etc.) without knowing the current tab.
- **Screen options:** The default stack screen options use `Primary[500]` header background, white tint, `slide_from_right` animation, and `Gray[50]` content background. Most screens use `headerShown: false` and implement their own `GradientHeader` component.

### Navigation Type Definitions

All param lists are in `src/navigation/types.ts`. Every screen's route params are typed. When adding a new screen:

1. Add the params to the relevant `*StackParamList` type
2. Add the screen to the stack navigator in `FeatureStacks.tsx` (or `PortalStacks.tsx`)
3. If it needs a tab, add it to `AdminTabNavigator.tsx` or `PortalTabNavigator.tsx`
4. If it should be deep-linkable, add it to the `linking` config in `App.tsx`

### Global Navigation Ref

A global navigation ref is stored via `setNavigationRef()` in `src/services/notificationNavigation.ts`. This allows services (push notification handlers, call context) to navigate without having access to React's navigation prop. Access it with `getNavigationRef()`.

---

## 5. Screens Inventory

### Admin/Staff Screens

| Tab | Screen Name | File | Route Params |
|-----|-------------|------|-------------|
| DashboardTab | `Dashboard` | `screens/dashboard/DashboardScreen.tsx` | — |
| DashboardTab | `Notifications` | `screens/notifications/NotificationsScreen.tsx` | — |
| DashboardTab | `AiAssistants` | `screens/ai/AiAssistantsScreen.tsx` | — |
| DashboardTab | `AssistantForm` | `screens/ai/AssistantFormScreen.tsx` | `{ id? }` |
| DashboardTab | `AssistantChat` | `screens/ai/AiChatScreen.tsx` | `{ assistantId?, assistantName?, conversationId? }` |
| DashboardTab | `ConversationHistory` | `screens/ai/ConversationHistoryScreen.tsx` | — |
| TasksTab | `TasksList` | `screens/tasks/TasksListScreen.tsx` | `{ softwareId, softwareName? }` |
| TasksTab | `TaskDetail` | `screens/tasks/TaskDetailScreen.tsx` | `{ softwareId, id, externalId }` |
| TasksTab | `TaskForm` | `screens/tasks/TaskFormScreen.tsx` | `{ softwareId, id?, externalId? }` |
| CasesTab | `CasesList` | `screens/cases/CasesListScreen.tsx` | — |
| CasesTab | `CaseDetail` | `screens/cases/CaseDetailScreen.tsx` | `{ caseId: string }` |
| CasesTab | `ReportCase` | `screens/cases/ReportCaseScreen.tsx` | — |
| AiTab | `AiChat` | `screens/ai/AiChatScreen.tsx` | `{ assistantId?, assistantName?, conversationId? }` |
| GroupsTab | `ChatList` | `screens/groups/ChatListScreen.tsx` | — |
| GroupsTab | `ChatScreen` | `screens/groups/ChatScreen.tsx` | `{ conversationId, name, type }` |
| GroupsTab | `NewChat` | `screens/groups/NewChatScreen.tsx` | — (modal) |
| GroupsTab | `GroupInfo` | `screens/groups/GroupInfoScreen.tsx` | `{ conversationId }` |
| GroupsTab | `ChatUserProfile` | `screens/groups/ChatUserProfileScreen.tsx` | `{ userId }` |
| GroupsTab | `MediaGallery` | `screens/groups/MediaGalleryScreen.tsx` | `{ conversationId, initialTab? }` |
| GroupsTab | `StarredMessages` | `screens/groups/StarredMessagesScreen.tsx` | — |
| GroupsTab | `ChatSearch` | `screens/groups/ChatSearchScreen.tsx` | — |
| GroupsTab | `CallHistory` | `screens/groups/CallHistoryScreen.tsx` | — |
| GroupsTab | `ExternalGroupsList` | `screens/groups/ExternalGroupsListScreen.tsx` | — |
| GroupsTab | `ExternalGroupChat` | `screens/groups/ExternalGroupChatScreen.tsx` | `{ group }` |
| MailTab | `MailInbox` | `screens/mail/MailInboxScreen.tsx` | — |
| MailTab | `MailFolders` | `screens/mail/MailFoldersScreen.tsx` | `{ accountId }` |
| MailTab | `MailMessages` | `screens/mail/MailMessagesScreen.tsx` | `{ accountId, folder }` |
| MailTab | `MailMessageDetail` | `screens/mail/MailMessageDetailScreen.tsx` | `{ accountId, folder, uid }` |
| MailTab | `MailCompose` | `screens/mail/MailComposeScreen.tsx` | `{ accountId, replyTo?, forward? }` |
| MailTab | `MailAccounts` | `screens/mail/MailAccountsScreen.tsx` | — |
| MailTab | `MailAccountForm` | `screens/mail/MailAccountFormScreen.tsx` | `{ accountId? }` |
| SettingsTab | `Settings` | `screens/settings/SettingsScreen.tsx` | — |
| SettingsTab | `Profile` | `screens/profile/ProfileScreen.tsx` | — |
| SettingsTab | `TwoFactorSettings` | `screens/auth/TwoFactorSettingsScreen.tsx` | — |
| SettingsTab | `Notifications` | `screens/notifications/NotificationsScreen.tsx` | — |
| SettingsTab | `NotificationPreferences` | `screens/settings/NotificationPreferencesScreen.tsx` | — |

### Portal (Regular User) Screens

| Tab | Screen Name | File |
|-----|-------------|------|
| PortalHomeTab | `PortalDashboard` | `screens/portal/PortalDashboardScreen.tsx` |
| CasesTab | (shared CasesStack — same as admin) | |
| SitesTab | `LandingPages` | `screens/sites/LandingPagesScreen.tsx` |
| SitesTab | `SiteDetail` | `screens/sites/SiteDetailScreen.tsx` |
| SitesTab | `GenerateSite` | `screens/sites/GenerateSiteScreen.tsx` |
| AiTab | (shared AiStack) | |
| AssistantsTab | `AssistantsList` → `AssistantChat` → `AssistantForm` → `ConversationHistory` | `screens/ai/*` |
| NotificationsTab | `Notifications` | `screens/notifications/NotificationsScreen.tsx` |
| AccountTab | `Profile`, `TwoFactorSettings`, `Settings`, `MailAccounts`, `MailAccountForm` | various |

### Root-Level Modals (accessible from anywhere)

| Screen | File | Params |
|--------|------|--------|
| `IncomingCall` | `screens/groups/IncomingCallScreen.tsx` | `{ callId, callerName, callerAvatar, callType }` |
| `ActiveCall` | `screens/groups/ActiveCallScreen.tsx` | `{ callType, remoteName }` |

---

## 6. State Management (Contexts)

The app uses **React Context** exclusively — no Redux, MobX, or Zustand.

### `AuthContext`

| Provides | Description |
|----------|-------------|
| `user: User \| null` | Current authenticated user object |
| `isLoading` | True during initial auth check |
| `isAuthenticated` | Whether user is logged in |
| `userType` | `'admin'` / `'staff'` / `'user'` |
| `isAdminOrStaff` | Convenience boolean |
| `hasPermission(slug)` | Check RBAC permission |
| `login()`, `logout()`, `register()` | Auth actions |
| `verify2fa()`, `completeAuthWithToken()` | 2FA and QR auth flows |
| `refreshUser()` | Re-fetch user from `/api/profile` |

**On login:** starts token refresh timer (45-min interval), initializes push notifications (channels, permissions, FCM token, listeners).
**On logout:** cleans up push listeners, unregisters FCM token from backend, calls `/auth/logout`, clears stored token + user.

### `AppContext`

| Provides | Description |
|----------|-------------|
| `publicSettings` | App name, logo, company name, primary color |
| `unreadCount` | Total unread notification count (polled every 60s) |
| `refreshUnreadCount()` | Manual refresh |

### `ChatContext`

| Provides | Description |
|----------|-------------|
| `conversations` | All conversations sorted by most recent |
| `chatUnreadCount` | Total unread across all conversations |
| `isSocketConnected` | Socket connection status |
| `presenceMap` | User online/offline status |
| `typingUsers` | Currently typing users |
| `refreshConversations()` | Re-fetch from API |
| `markConversationRead()` | Mark as read |
| `togglePin()`, `toggleArchive()`, `muteConversation()` | Conversation actions |

**Socket lifecycle:** Connects on auth, disconnects on logout. Auto-reconnects. Syncs on app foreground resume.

### `CallContext`

| Provides | Description |
|----------|-------------|
| `callState` | Current WebRTC state (idle/ringing/connecting/active) |
| `isInCall` | Convenience boolean |
| `initiateCall()` | Start outgoing call |
| `acceptCall()`, `declineCall()`, `endCall()` | Call actions |
| `toggleMute()`, `toggleCamera()`, `toggleSpeaker()`, `switchCamera()` | In-call controls |
| `remoteParticipant` | Name + avatar of the other party |
| `callDuration` | Timer (seconds) |

**Navigates automatically** to `IncomingCall` (root modal) when a call-ringing socket event arrives. Navigates to `ActiveCall` on accept.

### `ExternalGroupsContext`

Manages the WhatsApp bridge — separate socket connection (`/groups` namespace) to a remote system. Has its own message cache and unread counts.

---

## 7. API Layer

### Client (`src/api/client.ts`)

Singleton `ApiClient` class using `fetch()`:

- **Base URL:** `https://api.softaware.net.za` (from `constants/config.ts`)
- **Auth:** `Authorization: Bearer <jwt>` header on all requests
- **Token storage:** AsyncStorage (`jwt_token`)
- **Auto-refresh:** On 401, attempts `POST /auth/refresh` then retries
- **Auto-retry:** 502/503/504 → exponential backoff, up to 2 retries
- **Response unwrap:** Strips `{ success: true, data: ... }` envelope, preserves sibling fields like `pagination`
- **Session expired handler:** Triggers logout flow when 401 is unrecoverable
- **Error class:** `ApiError { code, message, status }`

### Convenience Methods

```typescript
api.get<T>(path)           // GET
api.post<T>(path, body?)   // POST
api.put<T>(path, body?)    // PUT
api.del<T>(path)           // DELETE
api.patch<T>(path, body?)  // PATCH
api.upload<T>(path, FormData)  // POST multipart
api.downloadPdf(path)      // GET → Blob
```

### API Modules (one file per domain)

Each module exports an object with methods that call `api.get/post/put/del`:

| File | Export | Key Endpoints |
|------|--------|---------------|
| `auth.ts` | `authApi` | `/auth/login`, `/auth/register`, `/auth/me`, `/auth/refresh`, `/auth/logout`, 2FA endpoints |
| `profile.ts` | `profileApi` | `/profile`, `/profile/change-password`, `/profile/notification-preferences` |
| `tasks.ts` | `tasksApi` | `/tasks/proxy/*` (external task system), `/tasks/v2/*` (local enhancements) |
| `chat.ts` | `chatApi` | `/chat/conversations`, `/chat/messages/*`, `/chat/calls/*`, `/chat/sync` |
| `cases.ts` | `casesApi` | `/cases`, `/cases/:id`, `/cases/:id/comments` |
| `notifications.ts` | `notificationsApi` | `/notifications`, `/notifications/unread-count`, `/notifications/:id/read` |
| `fcm.ts` | `fcmApi` | `/fcm-tokens` (register/unregister/list/status) |
| `ai.ts` | `aiApi` | `/mobile/assistants/*`, `/mobile/intent`, `/mobile/conversations/*` |
| `webmail.ts` | `webmailApi` | `/webmail/accounts/*`, `/webmail/messages/*` |
| `sites.ts` | `sitesApi` | `/sites`, `/sites/generate`, `/sites/:id` |
| `settings.ts` | `settingsApi` | `/settings/public` |
| `dashboard.ts` | `dashboardApi` | `/dashboard/metrics` |
| `software.ts` | `softwareApi` | `/software` (list software entries) |
| `admin.ts` | `adminApi` | `/admin/*` (admin dashboard, users, roles) |
| `groups.ts` | `groupsApi` | Legacy group endpoints |
| `teams.ts` | `teamsApi` | `/teams` |
| `updates.ts` | `updatesApi` | `/software/:id/updates/*` |
| `database.ts` | `databaseApi` | Database browsing endpoints |
| `webhooks.ts` | `webhooksApi`, `capabilitiesApi` | Webhook management, assistant capabilities |

### Adding a New API Module

1. Create `src/api/myFeature.ts`
2. Import `api` from `./client`
3. Export an object: `export const myFeatureApi = { list() { return api.get(...); }, ... }`
4. Re-export from `src/api/index.ts`

---

## 8. Services Layer

Services contain business logic that doesn't belong in React components or contexts.

| Service | File | Purpose |
|---------|------|---------|
| **Notifications** | `notifications.ts` | FCM permission, token register/unregister, background handler, foreground/opened listeners |
| **Notification Navigation** | `notificationNavigation.ts` | Maps push `data.type` → screen route, global nav ref, `navigateFromNotification()` |
| **Notification Channels** | `notificationChannels.ts` | Android channels via notifee (lazy-loaded, gracefully degrades) |
| **Chat Notification Handler** | `chatNotificationHandler.ts` | Foreground chat/call push: suppress if viewing conversation, respect mute, show toast, navigate for calls |
| **Chat Socket** | `chatSocket.ts` | Socket.IO `/chat` namespace connection, reconnect, emit helpers |
| **Chat DB** | `chatDb.ts` | AsyncStorage-backed offline cache: conversations, messages (max 200/conv), pending queue |
| **Sync Service** | `syncService.ts` | Delta sync on reconnect using `/chat/sync` with cursor-based pagination |
| **WebRTC Service** | `webrtcService.ts` | RTCPeerConnection lifecycle, ICE, media streams, InCallManager audio routing |
| **External Groups Socket** | `externalGroupsSocket.ts` | Socket.IO for WhatsApp bridge `/groups` namespace |
| **External Groups Cache** | `externalGroupsCache.ts` | AsyncStorage cache for external group messages |

### Service Conventions

- Services are plain TypeScript modules (not classes) — export functions
- Services that need native modules use **lazy `require()`** with try-catch to avoid crashes when the module isn't linked
- Services use `console.log('[Tag]')` / `console.warn('[Tag]')` with bracketed tags for log filtering
- Socket connections use the JWT token from `api.getToken()`

---

## 9. Type System

### Main Type File: `src/types/index.ts`

Contains **all shared interfaces**: `User`, `Profile`, `Task`, `Notification`, `Software`, `Pagination`, etc. Organized by domain with section comments.

### Domain-Specific Type Files

| File | Contains |
|------|----------|
| `types/chat.ts` | `Conversation`, `Message`, `MessageType`, `MessageStatus`, `CallType`, `CallStatus`, all `Socket*` event payload types |
| `types/cases.ts` | `Case`, `CaseComment`, `CaseStatus`, `CaseSeverity` |
| `types/externalGroups.ts` | `ExternalGroup`, `ExternalMessage`, mapping helpers |
| `types/sites.ts` | Site builder types |
| `types/webhooks.ts` | `AssistantWebhook`, `WebhookEndpoint`, `AssistantCapabilities` |
| `types/webmail.ts` | `MailAccount`, `MailMessage`, `MailAttachment` |

### Key Type Patterns

- **API response types** often use `{ success: boolean, data: T, pagination?: Pagination }` — the API client unwraps this automatically, so callers work with `T` directly
- **Socket event types** are prefixed with `Socket` (e.g., `SocketNewMessage`, `SocketCallRinging`)
- **Form data types** are separate from display types (e.g., `TaskFormData` vs `Task`)
- **Union types for status fields:** `TaskStatus`, `MessageStatus`, `CallStatus`, etc.

---

## 10. Theme & Design Tokens

All design tokens are in `src/theme/index.ts`. **Always import from the theme** — never hardcode colors, spacing, or font sizes.

### Color Palettes

| Export | Shades | Main Color |
|--------|--------|------------|
| `Primary` | 50–900 | `#00A4EE` (Picton Blue) — brand color |
| `Scarlet` | 500–700 | `#E7370B` — danger/error |
| `Accent` | `purple`, `green`, `orange`, `pink` | Accent colors |
| `Gray` | 50–900 | Neutral scale |
| `Semantic` | `success`, `warning`, `error`, `info` | Each has `{ bg, text, border }` |
| `Status` | `paid`, `partial`, `unpaid`, `draft`, `sent`, `active`, `overdue` | Each has `{ dot, bg, text }` |
| `Colors` | flat object | Convenience shortcuts: `Colors.primary`, `Colors.text`, `Colors.error`, etc. |

**⚠️ Note:** `Scarlet` only has keys `500`, `600`, `700` — do NOT use `Scarlet[50]` or other shades (they don't exist and will cause a TypeScript error).

### Spacing (4pt grid)

```typescript
Spacing.xs = 4    Spacing.sm = 8    Spacing.md = 12   Spacing.base = 16
Spacing.lg = 20   Spacing.xl = 24   Spacing.xxl = 32
```

### Typography

```typescript
FontSize.xs = 11   FontSize.sm = 13   FontSize.md = 14   FontSize.lg = 16
FontSize.xl = 18   FontSize.xxl = 24
FontWeight.regular = '400'   FontWeight.medium = '500'
FontWeight.semibold = '600'  FontWeight.bold = '700'
```

### Other Tokens

- `BorderRadius` — `sm(4)`, `md(6)`, `base(8)`, `lg(12)`, `xl(16)`, `full(9999)`
- `Shadow` — `sm`, `base`, `md`, `lg`, `xl` (React Native shadow objects with elevation)
- `Gradients` — `primary`, `primaryLight`, `avatar`, `header` (color arrays for LinearGradient)

---

## 11. Reusable UI Components

Located in `src/components/ui/`. Import from `../../components/ui/ComponentName`.

| Component | Purpose |
|-----------|---------|
| `AppCard` | Standard card wrapper with shadow and border radius |
| `AppButton` / `AppTextInput` (in `FormControls`) | Styled button and input field |
| `GradientHeader` | Primary→PrimaryDark gradient header with back button |
| `PaginatedList` | FlatList with pull-to-refresh, infinite scroll, empty state |
| `ListItemCard` | Standardized list row with icon, title, subtitle, right text |
| `Avatar` | User avatar with fallback initials |
| `Badge` | Status badge (colored dot + text) |
| `LoadingScreen` | Full-screen centered ActivityIndicator |
| `StateViews` | Empty state, error state, loading state views |
| `SkeletonLoader` | Placeholder shimmer while loading |
| `Cards` | Specialized card variants |
| `CaseCard` | Case list item card |
| `ChatBubble` | Message bubble (sent/received) |
| `VoiceNoteRecorder` / `VoiceNotePlayer` | Audio recording and playback UI |
| `AttachmentPicker` | Bottom sheet for photo/file/camera/location/contact |
| `EmojiPicker` | Emoji selection grid |
| `MentionAutocomplete` | @mention user search dropdown |
| `ImageLightbox` / `ImageViewerModal` | Full-screen image viewing |
| `MediaThumbnail` | Thumbnail for image/video/file messages |
| `LinkPreviewCard` | URL preview card in chat |
| `LocationBubble` / `ContactBubble` / `FileMessageBubble` | Specialized message types |
| `ReactionDetailModal` | Who reacted with which emoji |
| `ForwardMessageSheet` | Forward message to another conversation |
| `AddMemberSheet` | Add member to group chat |
| `FolderRow` | Mail folder list item |
| `MailListItem` | Email list item |

---

## 12. Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useCachedFetch<T>` | `hooks/useCachedFetch.ts` | Cache-first data loading with AsyncStorage. Returns `{ data, loading, error, refresh }`. Configurable TTL (default 5 min). |
| `useChatSocket` | `hooks/useChatSocket.ts` | Subscribes to socket events, normalizes payloads, manages typing indicators and presence map. Used by `ChatContext`. |
| `useVoiceAssistant` | `hooks/useVoiceAssistant.ts` | Text-to-speech + speech-to-text bridge for AI voice chat. Uses `react-native-tts` and `@react-native-voice/voice`. |

---

## 13. Authentication & User Roles

### Login Flows

1. **Standard:** Email + password → JWT token + user object
2. **2FA:** Login returns `{ requires_2fa, temp_token }` → navigate to `TwoFactor` screen → verify code → JWT
3. **QR Auth:** Scan QR code on desktop → `MobileQRAuth` screen → complete auth with token

### Token Management

- JWT stored in AsyncStorage under key `jwt_token`
- Token refresh: `POST /auth/refresh` every 45 minutes (timer in `AuthContext`)
- On 401: API client attempts one refresh before triggering session expired
- On session expired: auto-logout, clear all stored data

### User Roles

Determined by `User.is_admin` and `User.is_staff` flags:

| `is_admin` | `is_staff` | `userType` | Experience |
|------------|------------|------------|------------|
| true | — | `'admin'` | AdminTabNavigator (full access) |
| false | true | `'staff'` | AdminTabNavigator (permission-gated) |
| false | false | `'user'` | PortalTabNavigator (limited) |

### RBAC Permissions

```typescript
import { hasPermission, hasAnyPermission } from '../utils/permissions';
// OR via context:
const { hasPermission } = useAuth();
if (hasPermission('manage_tasks')) { /* show admin UI */ }
```

Permission slugs come from the user's role. Used to gate specific features within the admin experience.

---

## 14. Push Notifications

### Architecture

- **Backend:** Sends FCM push via Firebase Admin SDK
- **Transport:** `@react-native-firebase/messaging`
- **Token registration:** `POST /api/fcm-tokens` (upsert, safe to call on every launch)
- **Token unregister:** `DELETE /api/fcm-tokens/<token>` (called on logout)

### Notification Types (from backend)

| `data.type` | Module | Navigates To |
|---|---|---|
| `chat_message` | Chat | ChatScreen |
| `chat_mention` | Chat | ChatScreen (bypasses mute) |
| `incoming_call` | Chat | IncomingCall (root modal) |
| `missed_call` | Chat | ChatScreen |
| `task_assigned` | Tasks | TaskDetail |
| `task_phase_changed` | Tasks | TaskDetail |
| `case_created` / `case_assigned` / `case_updated` / `case_resolved` / `case_comment` | Cases | CaseDetail |
| `case_deleted` | Cases | CasesList |
| `scheduled_call` / `scheduled_call_cancelled` / `scheduled_call_rsvp` / `scheduled_call_reminder` | Scheduling | ChatScreen |

### Handler Chain (Foreground)

1. FCM `onMessage` fires in `AuthContext`
2. → `handleForegroundChatPush()` checks if chat/call type
   - Incoming call → navigates to `IncomingCall` screen immediately
   - Chat message → suppresses if viewing same conversation or muted, otherwise shows toast
3. → If not handled by chat handler, shows generic toast via `formatNotificationForToast()`
4. → Toast `onPress` calls `navigateFromNotification(data)`

### Handler Chain (Background / Killed)

- **Background tap:** `onNotificationOpenedApp` → `navigateFromNotification(data)`
- **Killed state:** `getInitialNotification()` on launch → delayed navigate (500ms for nav mount)
- **Background processing:** `setBackgroundMessageHandler` updates badge count if `data.badge` present

### Routing Logic

`notificationNavigation.ts` → `resolveNotificationRoute(data)` returns `{ tab, stack, screen, params }`. For tabbed navigation, dispatches `CommonActions.navigate` to switch tab first, then screen within the stack.

---

## 15. Real-Time (Socket.IO)

### Chat Socket (`/chat` namespace)

- **Connection:** `io(API_BASE_URL/chat, { auth: { token } })`
- **Transports:** Polling → WebSocket upgrade
- **Auto-reconnect:** Infinite attempts, 1s–10s backoff
- **Events consumed:** `new_message`, `message_edited`, `message_deleted`, `message_status_update`, `reaction_update`, `typing`, `stop_typing`, `presence_change`, `conversation_updated`, `conversation_deleted`, `call_ringing`, `call_accepted`, `call_declined`, `call_ended`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `call_participant_update`
- **Events emitted:** `send_message`, `edit_message`, `delete_message`, `typing`, `stop_typing`, `mark_read`, `add_reaction`, `remove_reaction`, `call_initiate`, `call_accept`, `call_decline`, `call_end`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `participant_update`

### External Groups Socket (`/groups` namespace)

Separate socket connection to a remote system for WhatsApp bridge groups. Has its own connect/disconnect lifecycle managed by `ExternalGroupsContext`.

---

## 16. Offline & Caching Strategy

### Chat (AsyncStorage-based)

- **Conversations:** Cached at `@chat/conversations`
- **Messages:** Cached at `@chat/messages/<conversationId>` (max 200 per conversation)
- **Pending queue:** `@chat/pending` — messages sent while offline, retried on reconnect
- **Sync timestamp:** `@chat/sync_timestamp` — cursor for delta sync
- **Strategy:** Load from cache → display → fetch from API → merge. In-memory mirror for synchronous reads.

### Dashboard & Assistants (`useCachedFetch` hook)

- AsyncStorage key per endpoint
- 5-minute TTL by default
- Cache-first: show stale data immediately, refresh in background

### Auth Data

- JWT token: `AsyncStorage → jwt_token`
- User object: `AsyncStorage → user_data` (restored on cold start for instant UI)
- FCM token: `AsyncStorage → fcm_device_token`

---

## 17. Coding Conventions

### File Naming

- **Screens:** `PascalCaseScreen.tsx` (e.g., `TaskDetailScreen.tsx`)
- **Components:** `PascalCase.tsx` (e.g., `AppCard.tsx`)
- **Services/hooks/utils:** `camelCase.ts` (e.g., `chatSocket.ts`)
- **Types:** `camelCase.ts` (e.g., `chat.ts`)
- **API modules:** `camelCase.ts` (e.g., `tasks.ts`)

### Export Patterns

- **Screens:** Named export: `export function TaskDetailScreen() {}`
- **Contexts:** Named exports for provider + hook: `export function AuthProvider` + `export function useAuth`
- **API modules:** Named export of an object: `export const tasksApi = { ... }`
- **Services:** Named function exports: `export function connectChatSocket()`
- **Types:** Named type/interface exports

### Screen Structure

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
// Theme imports
import { Gray, Primary, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '../../theme';
// Context hooks
import { useAuth } from '../../contexts/AuthContext';
// API
import { myFeatureApi } from '../../api';
// Components
import { AppCard } from '../../components/ui/AppCard';
import { GradientHeader } from '../../components/ui/GradientHeader';

export function MyFeatureScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  // ... fetch, handlers, render

  return (
    <View style={styles.container}>
      <GradientHeader title="My Feature" onBack={() => navigation.goBack()} />
      {/* content */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Gray[50] },
  // ...
});
```

### Logging Convention

Use bracketed tags for easy `adb logcat` filtering:

```typescript
console.log('[Chat] Socket connected');
console.warn('[FCM] Token registration failed:', error);
console.error('[WebRTC] Peer connection error:', error);
```

### Error Handling

- API calls: wrap in try-catch, show `Alert.alert('Error', message)` or toast
- Services: log warnings, don't crash the app
- Native modules: lazy-require with try-catch, gracefully degrade

### Native Module Safety

When using an optional native module, **never** use a top-level `import`. Instead:

```typescript
// ✅ Safe — checks NativeModules first, lazy requires
import { NativeModules } from 'react-native';

function getMyNativeModule(): any | null {
  if (!NativeModules.MyModule) return null;
  try {
    return require('my-native-package').default;
  } catch { return null; }
}

// ❌ Dangerous — crashes if native module not linked
import myModule from 'my-native-package';
```

---

## 18. How to Add a New Feature

### Checklist for a new feature wiring guide

When writing an implementation guide for a new feature in this app, cover these items:

1. **API endpoints** — List the REST endpoints the feature needs. The app already has a pattern for API modules (see §7).

2. **Types** — Define TypeScript interfaces. Add to `src/types/index.ts` or create a new `src/types/myFeature.ts` if complex.

3. **API module** — Create `src/api/myFeature.ts`, export from `src/api/index.ts`.

4. **Screen(s)** — Create in `src/screens/myFeature/`. Follow the screen structure pattern (§17). Use theme tokens, not hardcoded values.

5. **Navigation** — Add params to `src/navigation/types.ts`, register screen in `FeatureStacks.tsx` (or `PortalStacks.tsx`), add tab if needed in `AdminTabNavigator.tsx` / `PortalTabNavigator.tsx`.

6. **Deep linking** — Add to `linking.config.screens` in `App.tsx` if the screen should be reachable via URL.

7. **Push notifications** — If the backend sends push notifications for this feature:
   - Add the `data.type` handler in `src/services/notificationNavigation.ts` → `resolveNotificationRoute()`
   - Add the channel mapping in `src/services/notificationChannels.ts` → `getChannelForType()`
   - Update the foreground handler if special behavior is needed

8. **Real-time** — If the feature uses Socket.IO events, document which events to listen for and emit. Wire them in a hook or context.

9. **Offline support** — If applicable, use the `useCachedFetch` hook or add AsyncStorage caching similar to `chatDb.ts`.

10. **User role gating** — Specify if the feature is admin-only, staff-only, or available to portal users. The app switches between `AdminTabNavigator` and `PortalTabNavigator` based on role.

### Important Things to Know

- **Backend base URL:** `https://api.softaware.net.za`
- **All API calls go through `src/api/client.ts`** — never use `fetch()` directly from screens
- **The API client auto-unwraps** `{ success, data }` envelopes — your API module receives `data` directly
- **Auth token is auto-attached** — no need to pass it manually
- **The icon library is `MaterialCommunityIcons`** from `react-native-vector-icons` — check [materialdesignicons.com](https://materialdesignicons.com) for available icons
- **The app currently targets Android** — iOS support is planned but not actively tested
- **React Navigation v6** — not v7. Use `navigation.navigate('ScreenName', params)` pattern
- **No Expo** — this is a bare React Native project. Native modules require manual linking or autolinking
- **AsyncStorage is the only persistence layer** — no SQLite, no Realm, no MMKV
- **Toast messages** use `react-native-toast-message` — call `Toast.show({ type, text1, text2 })` from anywhere
