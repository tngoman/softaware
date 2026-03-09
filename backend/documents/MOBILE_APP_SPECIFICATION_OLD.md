# SoftAware Platform — Mobile App Developer Specification

> **Version 2.0** · Comprehensive Edition · Last updated: March 4, 2026  
> **Target Platforms:** iOS, Android (React Native / Flutter / Native)  
> **API Base URL:** `https://api.softaware.net.za`

---

## Table of Contents

### Part 1: Foundation
1. [Overview](#1-overview)
2. [Authentication & Security](#2-authentication--security)
3. [User Types & Permissions](#3-user-types--permissions)
4. [Data Models](#4-data-models)

### Part 2: API Reference
5. [Authentication API](#5-authentication-api)
6. [Profile & Settings API](#6-profile--settings-api)
7. [Notifications API](#7-notifications-api)
8. [Dashboard API](#8-dashboard-api)
9. [Tasks API](#9-tasks-api)
10. [Contacts API](#10-contacts-api)
11. [Quotations API](#11-quotations-api)
12. [Invoices API](#12-invoices-api)
13. [Portal Assistants API](#13-portal-assistants-api)
14. [Portal Sites API](#14-portal-sites-api)
15. [Groups API](#15-groups-api)

### Part 3: Implementation
16. [Screen Specifications](#16-screen-specifications)
17. [Navigation Structure](#17-navigation-structure)
18. [Push Notifications](#18-push-notifications)
19. [File Uploads](#19-file-uploads)
20. [Error Handling](#20-error-handling)
21. [Offline Support](#21-offline-support)
22. [Platform-Specific Code](#22-platform-specific-code)
23. [Testing Checklist](#23-testing-checklist)

---

## Overview

The SoftAware mobile app provides **client portal access** and **task management** for field staff. It is **not** a full admin console — administrative operations beyond task management are intentionally excluded from the mobile experience.

### What's Included

✅ **Client Portal Features**
- AI Assistants (create, manage, chat)
- AI-generated Websites (create, edit)
- Portal Settings (account, notifications, security, billing)
- Dashboard (usage stats, quick actions)

✅ **Task Management** (Full-Featured)
- List, create, edit, delete tasks
- Assign tasks to users
- Add comments (text + internal flag)
- Upload attachments (photos, files)
- Draw and attach sketches (Excalidraw integration)
- Task associations (blockers, dependencies, duplicates)
- Workflow phase management
- Real-time task assignment notifications

✅ **Business Operations** (Permission-Gated)
- Financial Dashboard (if user has `view_dashboard` permission)
- Contacts (if user has `view_contacts` permission)
- Quotations (if user has `view_quotations` permission)
- Invoices (if user has `view_invoices` permission)
- Transactions (always visible)
- Reports (if user has `view_reports` permission)

✅ **Core Features** (All Users)
- Profile management
- Notifications center
- Push notifications (FCM)
- 2FA setup and management

### What's Excluded

❌ **Admin-Only Screens** (Not Available on Mobile)
- Admin Dashboard
- Client Manager (user masquerading)
- AI Overview / AI Credits management
- Enterprise Endpoints management
- Database Manager
- Credentials vault
- System Users / Roles / Permissions management
- System Settings

❌ **Software Management** (Not Included)
- Software product registry
- Module management
- Update distribution
- Client monitoring

---

## Authentication & Security

### Token Storage

**Critical:** JWT tokens must be stored securely using platform-specific encrypted storage:

| Platform | Recommended Storage |
|----------|---------------------|
| **iOS** | Keychain Services (`SecItemAdd`, `SecItemCopyMatching`) |
| **Android** | EncryptedSharedPreferences or Android Keystore |
| **React Native** | `react-native-keychain` or `@react-native-async-storage/async-storage` with encryption |
| **Flutter** | `flutter_secure_storage` |

**Never** store tokens in:
- `AsyncStorage` (React Native) — not encrypted
- `SharedPreferences` (Android) — not encrypted
- `localStorage` (web view) — not encrypted

### Authentication Flow

#### 1. Initial Login

```
┌─────────────────────────────────────────────────────────────┐
│ App Launch (First Time)                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ GET /app-settings/public                                    │
│ → Display branding (logo, app name, colors) on login       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ User enters email + password                                │
│ POST /auth/login { email, password, rememberMe: true }     │
└─────────────────────────────────────────────────────────────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
                 ▼                   ▼
   ┌─────────────────────┐  ┌────────────────────────┐
   │ No 2FA              │  │ 2FA Enabled            │
   │ { token, user }     │  │ { requires_2fa: true,  │
   │                     │  │   temp_token: "..." }  │
   └─────────────────────┘  └────────────────────────┘
                 │                   │
                 │                   ▼
                 │      ┌─────────────────────────────────┐
                 │      │ Navigate to 2FA Screen          │
                 │      │ User enters 6-digit TOTP code   │
                 │      │ POST /auth/2fa/verify           │
                 │      │   { temp_token, code }          │
                 │      └─────────────────────────────────┘
                 │                   │
                 └───────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Store token in secure storage                               │
│ Store user object in memory/state                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Register for push notifications                             │
│ POST /fcm-tokens { token, device_name, platform }          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Navigate to appropriate dashboard:                          │
│ • Admin/Staff → Business Dashboard                          │
│ • Regular User → Portal Dashboard                           │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Returning User

```
App Launch
   │
   ▼
Read token from secure storage
   │
   ▼
GET /auth/validate
   │
   ├─ { valid: true }  → GET /auth/me → Load user → Dashboard
   │
   └─ { valid: false } → Clear storage → Login Screen
```

#### 3. Token Refresh

Set up an interceptor to catch 401 responses and automatically refresh:

```javascript
// Example: Axios interceptor
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshToken();
      error.config.headers['Authorization'] = `Bearer ${newToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

async function refreshToken() {
  const response = await api.post('/auth/refresh');
  const newToken = response.data.token;
  await secureStorage.setItem('jwt_token', newToken);
  return newToken;
}
```

#### 4. Logout

```
User taps Logout
   │
   ▼
GET current FCM device token
   │
   ▼
DELETE /fcm-tokens/:deviceToken
   │
   ▼
POST /auth/logout (optional, for server-side cleanup)
   │
   ▼
Clear all secure storage
   │
   ▼
Clear app state (user, tokens, cached data)
   │
   ▼
Navigate to Login Screen
```

### Two-Factor Authentication (2FA)

2FA is **optional** and **user-enabled**. Support TOTP (Time-based One-Time Password) compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.

#### Setup Flow (in Settings)

```
Settings → Security → Two-Factor Authentication
   │
   ▼
GET /auth/2fa/status
   │
   ├─ { is_enabled: false } → Show "Enable 2FA" button
   │
   └─ { is_enabled: true }  → Show "Disable 2FA" / "Regenerate Backup Codes" buttons
   │
   ▼ (User taps "Enable 2FA")
POST /auth/2fa/setup
   │
   ▼
Response: { secret, qr_code, otpauth_url }
   │
   ├─ Display QR code as image (for scanning from another device)
   ├─ OR use otpauth_url for deep-linking to authenticator app (same device)
   └─ Show secret as manual entry fallback
   │
   ▼
User adds to authenticator app, enters 6-digit code
   │
   ▼
POST /auth/2fa/verify-setup { code }
   │
   ▼
Response: { backup_codes: ["A3F1B2C8", "D4E5F6A7", ...] }
   │
   ▼
⚠️ CRITICAL: Display backup codes prominently
   "Save these codes securely. Each can be used once if you lose access to your authenticator app."
   │
   ▼
User confirms they've saved the codes → 2FA enabled
```

#### Login with 2FA

After entering email/password, if `requires_2fa: true` is returned:

```
Navigate to 2FA Verification Screen
   │
   ▼
Display 6-digit code input
"Enter the code from your authenticator app"
   │
   ▼
User enters code (or backup code)
   │
   ▼
POST /auth/2fa/verify { temp_token, code }
   │
   ├─ Success: { token, user, used_backup_code: false, remaining_backup_codes: 10 }
   │   └─ Store token, navigate to dashboard
   │
   ├─ Backup code used: { token, user, used_backup_code: true, remaining_backup_codes: 9 }
   │   └─ Show warning: "Backup code used. You have 9 remaining."
   │   └─ Store token, navigate to dashboard
   │
   └─ Error: Invalid code → Show error, allow retry
```

**Important:** The `temp_token` expires in **5 minutes**. If it expires, the user must log in again.

---

## User Types & Permissions

The platform has **three distinct user types** that determine navigation and feature access:

| User Type | `is_admin` | `is_staff` | How Determined | Description |
|-----------|:----------:|:----------:|----------------|-------------|
| **Admin** | ✅ | ❌ | Role slug: `admin` or `super_admin` | Full platform access (but admin-only screens excluded from mobile) |
| **Staff** | ❌ | ✅ | Role slug: `developer`, `client_manager`, `qa_specialist`, `deployer` | Functionally same as admin for permissions — all checks auto-pass |
| **Regular User** | ❌ | ❌ | Any other role slug (`viewer`, `manager`, `accountant`, `sales`, `support`) | Access controlled by granular permissions |

### Permission Checking

```javascript
// Helper functions for permission checks
function getUserType(user) {
  if (user.is_admin) return 'admin';
  if (user.is_staff) return 'staff';
  return 'user';
}

function isAdminOrStaff(user) {
  return user.is_admin || user.is_staff;
}

function hasPermission(user, permissionSlug) {
  // Admin and staff bypass all permission checks
  if (user.is_admin || user.is_staff) return true;
  
  // Check if user has the specific permission
  return user.permissions.some(p => p.slug === permissionSlug);
}

function hasAnyPermission(user, permissionSlugs) {
  if (user.is_admin || user.is_staff) return true;
  return permissionSlugs.some(slug => 
    user.permissions.some(p => p.slug === slug)
  );
}
```

### Available Permissions

Common permissions used in the mobile app:

| Permission Slug | Required For |
|----------------|--------------|
| `view_dashboard` | Financial Dashboard |
| `view_contacts` | Contacts list/detail |
| `create_contacts` | Create new contacts |
| `edit_contacts` | Edit existing contacts |
| `delete_contacts` | Delete contacts |
| `view_quotations` | Quotations list/detail |
| `create_quotations` | Create quotations |
| `view_invoices` | Invoices list/detail |
| `create_invoices` | Create invoices |
| `view_reports` | Financial reports |
| `view_settings` | App settings |

---

## Navigation Structure

The app should dynamically build its navigation based on the user's type and permissions.

### Admin / Staff Navigation

```javascript
function buildAdminStaffNavigation(user) {
  return [
    { screen: 'Dashboard', icon: 'chart-bar', route: '/dashboard' },
    { screen: 'Tasks', icon: 'tasks', route: '/tasks' },
    { screen: 'Contacts', icon: 'users', route: '/contacts' },
    { screen: 'Quotations', icon: 'file-text', route: '/quotations' },
    { screen: 'Invoices', icon: 'file-invoice', route: '/invoices' },
    { screen: 'Transactions', icon: 'receipt', route: '/transactions' },
    { screen: 'Financial Dashboard', icon: 'chart-pie', route: '/financial-dashboard' },
    { screen: 'Reports', icon: 'chart-line', route: '/reports' },
    { screen: 'Groups', icon: 'comments', route: '/groups' },
    { section: 'Account' },
    { screen: 'Notifications', icon: 'bell', route: '/notifications' },
    { screen: 'Profile', icon: 'user', route: '/profile' },
    { screen: 'Settings', icon: 'cog', route: '/settings' },
  ];
}
```

### Regular User Navigation

```javascript
function buildRegularUserNavigation(user) {
  const nav = [
    { screen: 'Portal', icon: 'home', route: '/portal' },
    { screen: 'Assistants', icon: 'robot', route: '/portal/assistants' },
    { screen: 'Sites', icon: 'globe', route: '/portal/sites' },
    { screen: 'Tasks', icon: 'tasks', route: '/tasks' },
    { screen: 'Groups', icon: 'comments', route: '/groups' },
  ];
  
  // Permission-gated business screens
  if (hasPermission(user, 'view_dashboard')) {
    nav.push({ screen: 'Financial Dashboard', icon: 'chart-pie', route: '/financial-dashboard' });
  }
  if (hasPermission(user, 'view_contacts')) {
    nav.push({ screen: 'Contacts', icon: 'users', route: '/contacts' });
  }
  if (hasPermission(user, 'view_quotations')) {
    nav.push({ screen: 'Quotations', icon: 'file-text', route: '/quotations' });
  }
  if (hasPermission(user, 'view_invoices')) {
    nav.push({ screen: 'Invoices', icon: 'file-invoice', route: '/invoices' });
  }
  if (hasPermission(user, 'view_reports')) {
    nav.push({ screen: 'Reports', icon: 'chart-line', route: '/reports' });
  }
  
  // Always visible
  nav.push({ screen: 'Transactions', icon: 'receipt', route: '/transactions' });
  
  // Account section
  nav.push({ section: 'Account' });
  nav.push({ screen: 'Notifications', icon: 'bell', route: '/notifications' });
  nav.push({ screen: 'Profile', icon: 'user', route: '/profile' });
  nav.push({ screen: 'Portal Settings', icon: 'cog', route: '/portal/settings' });
  
  return nav;
}
```

---

## Core Features

### 1. Dashboard

**Endpoint:** `GET /dashboard`

#### Admin/Staff Dashboard

Shows comprehensive business metrics:

```json
{
  "metrics": {
    "totalContacts": 45,
    "totalQuotations": 23,
    "totalInvoices": 67,
    "totalPayments": 52,
    "overdueInvoices": 3,
    "recentActivity": []
  },
  "billing": {
    "totalRevenue": 150000,
    "totalExpenses": 85000,
    "outstandingAmount": 25000,
    "monthlyRevenue": [
      { "month": "2026-01", "revenue": 45000 },
      { "month": "2026-02", "revenue": 52000 }
    ]
  }
}
```

**UI Components:**
- KPI cards (Total Revenue, Outstanding, Overdue Invoices)
- Monthly revenue chart
- Recent activity feed
- Quick action buttons (New Invoice, New Quote, New Contact)

#### Regular User Dashboard (Portal)

**Endpoint:** `GET /portal/dashboard` (custom endpoint, not in API docs — may need to be implemented or use assistants list)

Shows AI usage and assistant overview:

```json
{
  "metrics": {
    "messages": { "used": 150, "limit": 1000 },
    "pagesIndexed": { "used": 45, "limit": 100 },
    "assistants": { "count": 3, "limit": 5 },
    "tier": "free"
  },
  "assistants": [
    {
      "id": "assistant-123",
      "name": "Customer Support Bot",
      "description": "Answers product questions",
      "status": "active",
      "pagesIndexed": 15
    }
  ]
}
```

**UI Components:**
- Usage cards (Messages, Pages Indexed, Assistants)
- Assistant cards with quick actions (Chat, Edit, View)
- "Create Assistant" button

### 2. Tasks (Full-Featured)

Tasks are the **core feature** of the mobile app for staff users. Implementation requires handling dual authentication (platform JWT + per-software token).

#### Two-Token System

Every task API call requires **two tokens**:

| Token | Purpose | Header | Storage Key |
|-------|---------|--------|-------------|
| JWT | Platform auth | `Authorization: Bearer <token>` | `jwt_token` |
| Software Token | Per-software task auth | `X-Software-Token: <token>` | `software_token_<softwareId>` |

#### Authentication Flow

```
1. User selects software from dropdown
   │
   ▼
2. Check if software_token_<id> exists in secure storage
   │
   ├─ Token exists → Load tasks
   │
   └─ No token → Show authentication panel
       │
       ▼
3. User enters external API credentials (email + password)
   │
   ▼
4. POST /softaware/tasks/authenticate
   {
     "apiUrl": "<software.external_live_url or external_test_url>",
     "username": "user@example.com",
     "password": "password"
   }
   │
   ├─ Response: { success: true, token: "..." }
   │   └─ Save to secure storage as software_token_<id>
   │   └─ Load tasks
   │
   └─ Response: { requires_otp: true, otp_token: "..." }
       │
       ▼
5. Show OTP input (6-digit code)
   │
   ▼
6. POST /softaware/tasks/authenticate
   {
     "apiUrl": "...",
     "username": "user@example.com",
     "password": "password",
     "otp": "123456",
     "otpToken": "..."
   }
   │
   └─ Response: { success: true, token: "..." }
       └─ Save token, load tasks
```

#### Task Endpoints

All task endpoints require both tokens in headers:

```
Authorization: Bearer <jwt_token>
X-Software-Token: <software_token_<id>>
```

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/softaware/tasks?apiUrl=<url>&page=1&limit=1000` | List tasks |
| POST | `/softaware/tasks` | Create task |
| PUT | `/softaware/tasks` | Update task |
| DELETE | `/softaware/tasks/:id?apiUrl=<url>` | Delete task |
| POST | `/softaware/tasks/reorder` | Reorder tasks |
| GET | `/softaware/tasks/:id/comments?apiUrl=<url>` | List comments |
| POST | `/softaware/tasks/:id/comments` | Add comment |
| GET | `/softaware/tasks/:id/attachments?apiUrl=<url>` | List attachments |
| POST | `/softaware/tasks/:id/attachments` | Upload attachment |
| DELETE | `/softaware/tasks/:id/attachments/:attachmentId?apiUrl=<url>` | Delete attachment |

#### Task List Screen

**Components:**
- Software dropdown (filtered to those with external integration)
- Status filter tabs (New, In Progress, Completed)
- Search bar
- Task cards showing:
  - Title
  - Status badge
  - Type badge (Development, Bug Fix, Feature, etc.)
  - Assigned user
  - Estimated vs actual hours
  - Module name
  - Last comment preview
  - Workflow phase badge

**Actions per task:**
- Tap card → Task Detail Screen
- Long press → Quick actions (Assign, Delete)

#### Task Detail Screen

**Tabs:**
1. **Details** — Full task info with edit button
2. **Comments** — Comment history with add comment input
3. **Attachments** — Photos/files with upload button

**Details Tab Components:**
- Task title (large, bold)
- Status and type badges
- Metadata grid:
  - Planned Start / End
  - Actual Start / End
  - Estimated Hours / Actual Hours
  - Created By / Assigned To
  - Module
- Description (HTML rendered)
- Notes (plain text)

**Comments Tab Components:**
- Comment list (reverse chronological)
- Each comment shows:
  - User name and avatar
  - Timestamp (relative, e.g., "2 hours ago")
  - Internal badge (amber, if `is_internal === 1`)
  - Time spent badge (if > 0)
  - Content (HTML rendered, with clickable images)
  - Attachments (thumbnails for images, file icons for others)
- Add Comment section (pinned at bottom):
  - Text input (multiline)
  - Internal checkbox
  - Attach button (camera/file picker)
  - Post button

**Attachments Tab Components:**
- Grid of attachments (images as thumbnails, files as icons)
- Upload button (camera + file picker)
- Tap attachment → Fullscreen view / download

#### Task Assignment

**Workflow Dialog:**
- Assign to user (dropdown filtered by workflow phase permissions)
- Select module (dropdown)
- Workflow phase automatically transitions based on assigned user's role

**Workflow Permissions:**

| Workflow Phase | Can Be Assigned By |
|----------------|---------------------|
| intake | client_manager |
| quality_review | qa_specialist |
| triage | client_manager, qa_specialist, developer |
| development | developer |
| verification | qa_specialist |
| resolution | client_manager |

**Assignment Trigger:**
When a task is assigned, the backend automatically sends a notification to the assigned user via `POST /notifications` with `send_push: true`.

### 3. Notifications

**Endpoint:** `GET /notifications?page=1&limit=20`

#### Notification Center Screen

**Components:**
- Unread count badge (in tab bar)
- Filter tabs (All / Unread)
- Pull-to-refresh
- Notification list:
  - Icon based on type (payment, task, system)
  - Title (bold if unread)
  - Message (1-2 lines, truncated)
  - Timestamp (relative)
  - Swipe actions: Mark Read, Delete

**Actions:**
- Tap notification → Navigate to related screen (if applicable)
- Swipe left → Delete
- Swipe right → Mark as read/unread
- "Mark All Read" button

**Endpoints:**
- `GET /notifications/unread-count` — For badge
- `PUT /notifications/:id/read` — Mark single as read
- `PUT /notifications/read-all` — Mark all as read
- `DELETE /notifications/:id` — Delete

### 4. Push Notifications (FCM)

#### Setup (On Login)

```javascript
// After successful login, register device
async function registerPushNotifications() {
  // 1. Request permission (iOS) / Get FCM token (both platforms)
  const fcmToken = await getFCMToken();
  
  // 2. Get device info
  const deviceName = await getDeviceName(); // e.g., "iPhone 14 Pro"
  const platform = Platform.OS; // 'ios' or 'android'
  
  // 3. Register with backend
  await api.post('/fcm-tokens', {
    token: fcmToken,
    device_name: deviceName,
    platform: platform
  });
}
```

#### Handling Push Notifications

```javascript
// Foreground notification (app is open)
messaging().onMessage(async remoteMessage => {
  // Show in-app notification (banner or snackbar)
  showInAppNotification(remoteMessage.notification);
  
  // Update notification badge
  updateNotificationBadge();
});

// Background / quit notification (app is closed)
messaging().onNotificationOpenedApp(remoteMessage => {
  // Navigate to appropriate screen based on notification data
  navigateToNotificationTarget(remoteMessage.data);
});

// Notification that opened the app (app was quit)
messaging().getInitialNotification().then(remoteMessage => {
  if (remoteMessage) {
    navigateToNotificationTarget(remoteMessage.data);
  }
});
```

#### Unregister on Logout

```javascript
async function unregisterPushNotifications() {
  const fcmToken = await getFCMToken();
  await api.delete(`/fcm-tokens/${encodeURIComponent(fcmToken)}`);
}
```

### 5. Assistants (Portal Feature)

**Endpoints:**
- `GET /assistants` — List all assistants
- `POST /assistants/create` — Create new assistant
- `GET /assistants/:id` — Get single assistant
- `PUT /assistants/:id/update` — Update assistant
- `DELETE /assistants/:id` — Delete assistant
- `POST /assistants/chat` — Chat with assistant (SSE stream)

#### Assistants List Screen

**Components:**
- "Create Assistant" button
- Assistant cards showing:
  - Name
  - Description
  - Knowledge health badge (circular progress ring with score)
  - Pages indexed
  - Status badge
- Actions per assistant: Chat, Edit, Delete

#### Chat Screen

**SSE Streaming Implementation:**

```javascript
async function sendMessage(assistantId, message) {
  const response = await fetch(`${API_URL}/assistants/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId,
      message,
      stream: true
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop(); // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.content) {
          // Append to message display
          appendToCurrentMessage(data.content);
        }
        if (data.done) {
          // Streaming complete
          finalizeMessage();
        }
      }
    }
  }
}
```

### 6. Profile & Settings

**Endpoint:** `GET /profile`

#### Profile Screen

**Sections:**
1. **Account** — Name, email, phone
   - `PUT /profile { name, phone }` — Update profile
   
2. **Security**
   - Change Password — `POST /profile/change-password`
   - Two-Factor Authentication (see 2FA section)
   
3. **Notifications**
   - Push notifications toggle
   - Email notifications toggle
   - (Note: Backend may need to expose this as `PUT /profile/notification-preferences`)

---

## API Integration

### Base Configuration

```javascript
const API_BASE_URL = 'https://api.softaware.net.za';

// Or for local testing:
// const API_BASE_URL = 'http://192.168.1.100:5001';
```

### Axios Setup (React Native Example)

```javascript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — add JWT token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (auto-refresh or logout)
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      
      // Try to refresh token
      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${await SecureStore.getItemAsync('jwt_token')}`
            }
          }
        );
        
        const newToken = refreshResponse.data.token;
        await SecureStore.setItemAsync('jwt_token', newToken);
        
        // Retry original request with new token
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return api(error.config);
      } catch (refreshError) {
        // Refresh failed — logout user
        await logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### Task API Headers Helper

```javascript
// For task endpoints, add software token header
function getTaskHeaders(softwareId) {
  return async (config) => {
    const softwareToken = await SecureStore.getItemAsync(`software_token_${softwareId}`);
    if (softwareToken) {
      config.headers['X-Software-Token'] = softwareToken;
    }
    return config;
  };
}

// Usage:
const response = await api.get('/softaware/tasks', {
  params: { apiUrl: software.externalUrl },
  transformRequest: [await getTaskHeaders(software.id)]
});
```

---

## Push Notifications

### Firebase Cloud Messaging Setup

#### iOS Configuration

1. **Generate APNs Certificate** in Apple Developer Portal
2. **Upload to Firebase Console** (Project Settings → Cloud Messaging)
3. **Add Firebase to Xcode project**:
   - Install `Firebase/Messaging` pod
   - Add `GoogleService-Info.plist`
   - Enable Push Notifications capability
   - Request user permission in `AppDelegate`

```swift
// AppDelegate.swift
import Firebase
import UserNotifications

func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
  FirebaseApp.configure()
  
  UNUserNotificationCenter.current().delegate = self
  UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
    if granted {
      DispatchQueue.main.async {
        application.registerForRemoteNotifications()
      }
    }
  }
  
  return true
}
```

#### Android Configuration

1. **Download `google-services.json`** from Firebase Console
2. **Place in `android/app/`**
3. **Add to `android/build.gradle`**:

```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

4. **Add to `android/app/build.gradle`**:

```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
  implementation 'com.google.firebase:firebase-messaging:23.1.2'
}
```

5. **Create notification channel** (Android 8+):

```java
// MainActivity.java
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

@Override
protected void onCreate(Bundle savedInstanceState) {
  super.onCreate(savedInstanceState);
  
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    NotificationChannel channel = new NotificationChannel(
      "default",
      "General Notifications",
      NotificationManager.IMPORTANCE_HIGH
    );
    NotificationManager manager = getSystemService(NotificationManager.class);
    manager.createNotificationChannel(channel);
  }
}
```

### FCM Token Management

```javascript
// Get FCM token
async function getFCMToken() {
  const token = await messaging().getToken();
  return token;
}

// Register token with backend (on login)
async function registerDevice() {
  const token = await getFCMToken();
  const deviceName = await getDeviceName();
  const platform = Platform.OS;
  
  await api.post('/fcm-tokens', {
    token,
    device_name: deviceName,
    platform
  });
}

// Unregister token (on logout)
async function unregisterDevice() {
  const token = await getFCMToken();
  await api.delete(`/fcm-tokens/${encodeURIComponent(token)}`);
}

// Handle token refresh (FCM tokens can change)
messaging().onTokenRefresh(async newToken => {
  // Update backend
  await registerDevice();
});
```

### Notification Handlers

```javascript
// Foreground (app is open)
messaging().onMessage(async remoteMessage => {
  console.log('Notification received in foreground:', remoteMessage);
  
  // Show in-app banner
  showLocalNotification({
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
  });
  
  // Update badge count
  await updateBadgeCount();
});

// Background (app is in background)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message:', remoteMessage);
  // Background processing (update local cache, etc.)
});

// Notification opened (user tapped notification)
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('Notification opened:', remoteMessage);
  
  // Navigate based on notification data
  if (remoteMessage.data?.type === 'task_assigned') {
    navigation.navigate('TaskDetail', { taskId: remoteMessage.data.taskId });
  } else if (remoteMessage.data?.type === 'invoice_paid') {
    navigation.navigate('InvoiceDetail', { invoiceId: remoteMessage.data.invoiceId });
  }
});

// App opened from quit state via notification
messaging().getInitialNotification().then(remoteMessage => {
  if (remoteMessage) {
    // Navigate to appropriate screen
    handleNotificationNavigation(remoteMessage.data);
  }
});
```

---

## Offline Support

### Minimal Offline Support

The app should handle **temporary network loss** gracefully:

1. **Cache authentication tokens** — Allow navigation while offline
2. **Queue failed API calls** — Retry when connection restored
3. **Show connection status** — Banner at top when offline
4. **Graceful failures** — User-friendly error messages

### Not Required

❌ Full offline sync (tasks, contacts, etc.)
❌ Conflict resolution
❌ Local database (SQLite)

### Implementation Pattern

```javascript
import NetInfo from '@react-native-community/netinfo';

// Monitor connection status
NetInfo.addEventListener(state => {
  if (!state.isConnected) {
    showOfflineBanner();
  } else {
    hideOfflineBanner();
    retryQueuedRequests();
  }
});

// Queue failed requests
const requestQueue = [];

async function apiCallWithQueue(request) {
  try {
    return await api(request);
  } catch (error) {
    if (error.message === 'Network Error') {
      requestQueue.push(request);
      throw new Error('No internet connection. Request will be retried when online.');
    }
    throw error;
  }
}

async function retryQueuedRequests() {
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    try {
      await api(request);
    } catch (error) {
      // Re-queue if still failing
      requestQueue.unshift(request);
      break;
    }
  }
}
```

---

## Error Handling

### Standard Error Response

All API errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Continue |
| 201 | Created | Continue |
| 400 | Bad Request | Show error message, highlight invalid fields |
| 401 | Unauthorized | Refresh token or logout |
| 403 | Forbidden | Show "You don't have permission" message |
| 404 | Not Found | Show "Item not found" message |
| 500 | Server Error | Show "Something went wrong. Please try again." |

### Error Display Pattern

```javascript
async function handleApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    let message = 'Something went wrong. Please try again.';
    
    if (error.response) {
      // Server responded with error
      message = error.response.data?.error || message;
    } else if (error.message === 'Network Error') {
      message = 'No internet connection. Please check your network.';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Request timed out. Please try again.';
    }
    
    showErrorAlert(message);
    throw error;
  }
}

function showErrorAlert(message) {
  Alert.alert('Error', message, [{ text: 'OK' }]);
}
```

---

## Testing Checklist

### Authentication

- [ ] Login with email/password
- [ ] Login with 2FA enabled
- [ ] 2FA setup flow (QR code scan + manual entry)
- [ ] 2FA verification with valid code
- [ ] 2FA verification with backup code
- [ ] 2FA backup code usage warning
- [ ] Login failure (wrong password)
- [ ] Login failure (invalid 2FA code)
- [ ] Token refresh on 401
- [ ] Auto-logout on invalid token
- [ ] Logout (clear storage, unregister FCM)
- [ ] Remember me (30-day token)

### Navigation

- [ ] Admin sees business dashboard
- [ ] Regular user sees portal dashboard
- [ ] Navigation menu filters by permissions
- [ ] Permission-gated screens hidden correctly

### Tasks

- [ ] Software selection dropdown
- [ ] Task authentication (email/password)
- [ ] Task authentication with OTP
- [ ] List tasks (pagination)
- [ ] Create task
- [ ] Edit task
- [ ] Delete task
- [ ] Add comment (text)
- [ ] Add comment (with photo attachment)
- [ ] Add internal comment
- [ ] View comment history
- [ ] View attachments
- [ ] Upload attachment (camera)
- [ ] Upload attachment (file picker)
- [ ] Delete attachment
- [ ] Task assignment
- [ ] Assignment notification received

### Notifications

- [ ] Notification list (all/unread filter)
- [ ] Unread count badge
- [ ] Mark notification as read
- [ ] Mark all as read
- [ ] Delete notification
- [ ] Tap notification → navigate to target

### Push Notifications

- [ ] FCM token registration on login
- [ ] Foreground notification (in-app banner)
- [ ] Background notification (system tray)
- [ ] Notification tap navigation
- [ ] App opened from quit via notification
- [ ] FCM token unregister on logout

### Offline

- [ ] Offline banner displays when network lost
- [ ] Offline banner hides when network restored
- [ ] Failed requests queued
- [ ] Queued requests retried on reconnect

### Error Handling

- [ ] 400 Bad Request → user-friendly message
- [ ] 401 Unauthorized → token refresh or logout
- [ ] 403 Forbidden → permission message
- [ ] 404 Not Found → not found message
- [ ] 500 Server Error → generic error message
- [ ] Network error → no internet message
- [ ] Timeout → timeout message

---

## Notes for Developers

### What's Different from Web

1. **No Admin-Only Features** — Database Manager, Client Manager, Credentials, etc. are **not** included
2. **No Software Management** — Software registry, modules, updates are **not** included
3. **Simplified UI** — Mobile-optimized layouts, bottom tab navigation
4. **Focus on Tasks** — Task management is the primary feature for staff users
5. **Portal for Regular Users** — AI Assistants and Sites are the primary features for clients

### Backend Compatibility

The mobile app uses the **exact same API** as the web app. No mobile-specific endpoints are required (except possibly `GET /portal/dashboard` if the portal metrics endpoint doesn't exist yet).

### Performance Considerations

- **Pagination:** Always paginate lists (tasks, contacts, invoices)
- **Image Optimization:** Compress photos before upload
- **Caching:** Cache user profile, software list, and notification counts
- **Lazy Loading:** Load data on-demand, not all at once

### Security Best Practices

- ✅ Store tokens in encrypted storage (Keychain/Keystore)
- ✅ Use HTTPS only (no HTTP fallback)
- ✅ Validate SSL certificates
- ✅ Clear all data on logout
- ✅ Implement auto-logout on inactivity (optional)
- ✅ Obfuscate code (ProGuard/R8 for Android, app thinning for iOS)

---

## Support

For questions or issues:
- Email: support@softaware.co.za
- API Base URL: https://api.softaware.net.za
- Web App: https://softaware.net.za

**Last Updated:** March 4, 2026
