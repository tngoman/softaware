# SoftAware Platform — Mobile App Developer Specification

> **Version 2.2** · Comprehensive Edition · Last updated: March 5, 2026  
> **Target Platforms:** iOS, Android (React Native / Flutter / Native)  
> **API Base URL:** `https://api.softaware.net.za`

---

## Document Purpose

This specification provides **complete implementation details** for the SoftAware mobile application. It is designed to eliminate guesswork by including:

✅ Complete API endpoint documentation with all parameters  
✅ Full request/response schemas with field types and validation rules  
✅ Detailed screen-by-screen UI specifications  
✅ Step-by-step authentication flows  
✅ Data models with TypeScript/Dart interfaces  
✅ Platform-specific implementation examples (React Native, Flutter, Swift, Kotlin)  
✅ Error handling patterns and edge cases  
✅ File upload specifications  
✅ Push notification setup guides  

---

## Table of Contents

### Part 1: Foundation
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Authentication & Security](#3-authentication--security)
4. [User Types & Permissions](#4-user-types--permissions)
5. [Data Models](#5-data-models)

### Part 2: Complete API Reference
6. [Authentication API](#6-authentication-api)
7. [Profile & Settings API](#7-profile--settings-api)
8. [Notifications API](#8-notifications-api)
9. [Dashboard API](#9-dashboard-api)
   - 9.1 [Staff Financial Dashboard](#91-staff-financial-dashboard)
   - 9.2 [Client Portal Dashboard](#92-client-portal-dashboard)
   - 9.3 [Dashboard Role Detection](#93-dashboard-role-detection)
10. [Tasks API](#10-tasks-api)
11. [Contacts API](#11-contacts-api)
12. [Quotations API](#12-quotations-api)
13. [Invoices & Payments API](#13-invoices--payments-api)
14. [Portal Assistants API](#14-portal-assistants-api)
15. [Portal Sites API](#15-portal-sites-api)
16. [Groups API](#16-groups-api)
17. [Mobile AI Assistant API](#17-mobile-ai-assistant-api)
    - 17.1 [My Assistant CRUD](#171-my-assistant-crud)
    - 17.2 [Set Primary Assistant](#172-set-primary-assistant)
    - 17.3 [Mobile Intent (Voice/Text)](#173-mobile-intent-voicetext)
    - 17.4 [List Available Assistants](#174-list-available-assistants)
    - 17.5 [Conversation Management](#175-conversation-management)
    - 17.6 [Core Instructions (Superadmin)](#176-core-instructions-superadmin)
    - 17.7 [Software Tokens (Staff Only)](#177-software-tokens-staff-only)

### Part 3: Screen Specifications
18. [Authentication Screens](#18-authentication-screens)
19. [Dashboard Screens](#19-dashboard-screens)
    - 19.1 [Role-Based Dashboard Routing](#191-role-based-dashboard-routing)
    - 19.2 [Staff Financial Dashboard Screen](#192-staff-financial-dashboard-screen)
    - 19.3 [Client Portal Dashboard Screen](#193-client-portal-dashboard-screen)
    - 19.4 [Dashboard Caching & Refresh Strategy](#194-dashboard-caching--refresh-strategy)
20. [Task Management Screens](#20-task-management-screens)
21. [Portal Screens](#21-portal-screens)
22. [Assistant Management Screens](#22-assistant-management-screens)
23. [Settings Screens](#23-settings-screens)

### Part 4: Implementation
24. [Navigation Structure](#24-navigation-structure)
25. [Push Notifications](#25-push-notifications)
26. [File Uploads](#26-file-uploads)
27. [Error Handling](#27-error-handling)
28. [Offline Support](#28-offline-support)
29. [Platform-Specific Code Examples](#29-platform-specific-code-examples)
30. [Testing Checklist](#30-testing-checklist)

---

# Part 1: Foundation

## 1. Overview

### 1.1 What This App Does

The SoftAware mobile app provides:

**For Regular Users (Clients):**
- Access to AI Portal (assistants, sites, chat)
- Create and manage **multiple personal AI assistants** — one is the primary (main) assistant
- Update personality, greeting, voice style on any assistant from mobile
- Voice/text AI assistant with auto-selected primary assistant
- Business operations (contacts, invoices, quotations) — if permitted
- Task visibility for assigned tasks
- Notifications and profile management

**For Staff Users:**
- Create **one personal AI assistant** (auto-primary, gets admin tools)
- Voice/text AI assistant with task management tools (list, create, update, comment)
- Update personality, greeting, voice style on their assistant from mobile
- Full task management (create, edit, assign, comment, draw)
- Business operations (contacts, invoices, quotations, financial dashboard)
- Real-time task notifications
- Field access to all project tasks

**For Admin Users:**
- Everything staff users have
- Additional financial dashboard stats
- (Admin-only console features are **not** included in mobile)

### 1.2 What's NOT Included

❌ **Admin Console Features:**
- Client Manager (user masquerading)
- Database Manager (SQL queries)
- Credentials vault
- System Users/Roles/Permissions management
- AI Credits management
- Enterprise Endpoints management

❌ **Software Management:**
- Software registry
- Module management
- Update distribution

### 1.3 Technical Stack Requirements

**Minimum Requirements:**
- iOS 13.0+
- Android 6.0+ (API level 23)
- HTTPS only (no HTTP fallback)
- Firebase Cloud Messaging for push notifications
- Secure storage (Keychain/Keystore)

**Recommended Frameworks:**
- **React Native:** 0.71+ with TypeScript
- **Flutter:** 3.0+ with Dart 2.19+
- **Native iOS:** Swift 5.7+, Xcode 14+
- **Native Android:** Kotlin 1.8+, Android Studio 2022+

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                       MOBILE APP                                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Auth Module  │  │  API Client  │  │ Push Module  │          │
│  │ (Keychain)   │  │  (Axios/Dio) │  │    (FCM)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│  ┌──────▼─────────────────▼─────────────────▼───────┐          │
│  │          State Management (Redux/Provider)        │          │
│  └───────────────────────────┬───────────────────────┘          │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────┐          │
│  │              UI Components & Screens              │          │
│  └───────────────────────────────────────────────────┘          │
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               SOFTAWARE BACKEND API                              │
│               https://api.softaware.net.za                       │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │   Auth     │  │  Profile   │  │   Tasks    │  │ Assistants ││
│  │            │  │            │  │  (Proxy)   │  │  (Portal)  ││
│  └────────────┘  └────────────┘  └──────┬─────┘  └────────────┘│
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │  Contacts  │  │ Quotations │  │  Invoices  │  │   Groups   ││
│  │            │  │            │  │            │  │            ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Mobile AI (/v1/mobile/my-assistant + /v1/mobile/intent)  │  │
│  │  Assistants CRUD · Voice Intent · Ollama · Tool Calling   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              MySQL Database                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼ (Tasks module only)
┌─────────────────────────────────────────────────────────────────┐
│           EXTERNAL SOFTWARE PRODUCT APIS                         │
│           (e.g., https://silulumanzi.softaware.net.za/api)      │
│                                                                  │
│  Tasks, Comments, Attachments stored here                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Authentication Flow

```
App Launch
    │
    ▼
Check Keychain for JWT token
    │
    ├──► Token exists ──► GET /auth/validate
    │                      │
    │                      ├──► Valid ──► GET /auth/me ──► Store user ──► Dashboard
    │                      │
    │                      └──► Invalid ──► Clear Keychain ──► Login Screen
    │
    └──► No token ──► Login Screen
```

### 2.3 Data Flow Patterns

**Pattern A: Standard CRUD**
```
Screen → API Client → Backend → Database → Response → Update State → Re-render
```

**Pattern B: Tasks (Proxy)**
```
Tasks Screen → API Client (with 2 tokens) → Backend Proxy → External API → Database → Response → Backend → Update State → Re-render
```

**Pattern C: SSE Streaming (Chat)**
```
Chat Screen → POST /assistants/chat (stream: true) → Backend → OpenAI → SSE chunks → Append to message → Re-render continuously
```

**Pattern D: Mobile AI Voice/Text Intent**
```
Voice/Text → POST /v1/mobile/intent → Backend → Load assistant → Stitch prompt → Ollama (tool-call loop) → Plain-text reply → TTS / display
```

---

## 3. Authentication & Security

### 3.1 Token Storage

**CRITICAL SECURITY REQUIREMENT:**

JWT tokens MUST be stored in encrypted, platform-specific secure storage. Never use unencrypted storage.

| Platform | Storage Solution | Implementation |
|----------|------------------|----------------|
| **iOS** | Keychain Services | `Security.framework` with `kSecClassGenericPassword` |
| **Android** | EncryptedSharedPreferences | `androidx.security.crypto.EncryptedSharedPreferences` |
| **React Native** | react-native-keychain | `setGenericPassword(username, token)` |
| **Flutter** | flutter_secure_storage | `await storage.write(key: 'jwt_token', value: token)` |

**Example: React Native**
```typescript
import * as Keychain from 'react-native-keychain';

// Save token
await Keychain.setGenericPassword('softaware_user', jwtToken, {
  service: 'com.softaware.app',
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
});

// Retrieve token
const credentials = await Keychain.getGenericPassword({ service: 'com.softaware.app' });
if (credentials) {
  const token = credentials.password;
}

// Delete token
await Keychain.resetGenericPassword({ service: 'com.softaware.app' });
```

**Example: Flutter**
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final storage = FlutterSecureStorage();

// Save token
await storage.write(key: 'jwt_token', value: jwtToken);

// Retrieve token
String? token = await storage.read(key: 'jwt_token');

// Delete token
await storage.delete(key: 'jwt_token');
```

**Example: iOS Native (Swift)**
```swift
import Security

// Save token
func saveToken(_ token: String) {
    let data = token.data(using: .utf8)!
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "jwt_token",
        kSecValueData as String: data
    ]
    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
}

// Retrieve token
func loadToken() -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "jwt_token",
        kSecReturnData as String: true
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess,
          let data = result as? Data,
          let token = String(data: data, encoding: .utf8) else {
        return nil
    }
    return token
}
```

**Example: Android Native (Kotlin)**
```kotlin
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// Initialize
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val prefs = EncryptedSharedPreferences.create(
    context,
    "softaware_secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Save token
prefs.edit().putString("jwt_token", jwtToken).apply()

// Retrieve token
val token = prefs.getString("jwt_token", null)

// Delete token
prefs.edit().remove("jwt_token").apply()
```

### 3.2 Complete Authentication Flows

#### 3.2.1 Initial Login (No 2FA)

```
┌────────────────────────────────────────────────────────────────┐
│ 1. User enters email + password on Login Screen               │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. POST /auth/login                                             │
│    Content-Type: application/json                               │
│                                                                  │
│    {                                                             │
│      "email": "user@example.com",                               │
│      "password": "SecurePass123!",                              │
│      "rememberMe": true                                         │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Response (200 OK)                                            │
│                                                                  │
│    {                                                             │
│      "success": true,                                           │
│      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",       │
│      "user": {                                                   │
│        "id": "user-uuid-abc123",                                │
│        "email": "user@example.com",                             │
│        "name": "John Doe",                                      │
│        "phone": "+27123456789",                                 │
│        "role": {                                                 │
│          "id": 2,                                               │
│          "name": "Developer",                                   │
│          "slug": "developer"                                    │
│        },                                                        │
│        "is_admin": false,                                       │
│        "is_staff": true,                                        │
│        "permissions": []                                         │
│      }                                                           │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Store token in Keychain/Keystore                            │
│    Store user object in memory (Redux/Provider)                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Register for push notifications                             │
│    POST /fcm-tokens                                             │
│    { "token": "<fcm-device-token>", "device_name": "iPhone 14",│
│      "platform": "ios" }                                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Navigate to appropriate dashboard:                          │
│    • Admin/Staff → Business Dashboard                          │
│    • Regular User → Portal Dashboard                           │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Login with 2FA Enabled

```
┌────────────────────────────────────────────────────────────────┐
│ 1. User enters email + password                                │
│    POST /auth/login { email, password, rememberMe: true }     │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Response (200 OK)                                            │
│                                                                  │
│    {                                                             │
│      "success": true,                                           │
│      "requires_2fa": true,                                      │
│      "temp_token": "temp-abcd1234-5678-ef90"                   │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Navigate to 2FA Verification Screen                         │
│    • Store temp_token in memory (NOT Keychain)                 │
│    • Display 6-digit code input                                 │
│    • Show countdown timer (5 minutes)                          │
│    • Offer "Use backup code instead" link                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. User enters 6-digit TOTP code (e.g., "123456")             │
│    OR backup code (e.g., "A3F1B2C8")                           │
│                                                                  │
│    POST /auth/2fa/verify                                        │
│    Content-Type: application/json                               │
│                                                                  │
│    {                                                             │
│      "temp_token": "temp-abcd1234-5678-ef90",                  │
│      "code": "123456"                                           │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Response (200 OK)                                            │
│                                                                  │
│    {                                                             │
│      "success": true,                                           │
│      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",       │
│      "user": { /* full user object */ },                        │
│      "used_backup_code": false,                                 │
│      "remaining_backup_codes": 10                               │
│    }                                                             │
│                                                                  │
│    OR (if backup code was used):                                │
│                                                                  │
│    {                                                             │
│      "success": true,                                           │
│      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",       │
│      "user": { /* full user object */ },                        │
│      "used_backup_code": true,                                  │
│      "remaining_backup_codes": 9                                │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. If backup code used, show warning:                          │
│    "⚠️ You used a backup code. You have 9 remaining."          │
│    Offer "Regenerate backup codes" button in Settings          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Store token, register push, navigate to dashboard           │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 2FA Setup Flow (in Settings)

```
┌────────────────────────────────────────────────────────────────┐
│ 1. User navigates to Settings → Security → Two-Factor Auth    │
│    GET /auth/2fa/status                                        │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Response:                                                    │
│                                                                  │
│    { "is_enabled": false }                                      │
│                                                                  │
│    → Show "Enable Two-Factor Authentication" button            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ (User taps "Enable")
┌─────────────────────────────────────────────────────────────────┐
│ 3. POST /auth/2fa/setup                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Response (200 OK):                                           │
│                                                                  │
│    {                                                             │
│      "secret": "JBSWY3DPEHPK3PXP",                             │
│      "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANS...",  │
│      "otpauth_url": "otpauth://totp/SoftAware:user@example..."  │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Display QR code setup screen:                               │
│                                                                  │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  ┌────────────────────────────────────────────┐      │   │
│    │  │                                             │      │   │
│    │  │          [QR CODE IMAGE]                    │      │   │
│    │  │                                             │      │   │
│    │  └────────────────────────────────────────────┘      │   │
│    │                                                       │   │
│    │  Scan this QR code with your authenticator app:      │   │
│    │  • Google Authenticator                              │   │
│    │  • Microsoft Authenticator                           │   │
│    │  • Authy                                             │   │
│    │                                                       │   │
│    │  OR enter manually:                                  │   │
│    │  Secret: JBSWY3DPEHPK3PXP                            │   │
│    │                                                       │   │
│    │  [Copy Secret]  [Open Authenticator App]             │   │
│    │                                                       │   │
│    │  Once added, enter the 6-digit code:                 │   │
│    │  [___] [___] [___] [___] [___] [___]                │   │
│    │                                                       │   │
│    │              [Verify & Enable]                        │   │
│    └───────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ (User scans QR, enters code)
┌─────────────────────────────────────────────────────────────────┐
│ 6. POST /auth/2fa/verify-setup                                 │
│    { "code": "123456" }                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Response (200 OK):                                           │
│                                                                  │
│    {                                                             │
│      "success": true,                                           │
│      "backup_codes": [                                           │
│        "A3F1B2C8",                                              │
│        "D4E5F6A7",                                              │
│        "G8H9I0J1",                                              │
│        "K2L3M4N5",                                              │
│        "O6P7Q8R9",                                              │
│        "S0T1U2V3",                                              │
│        "W4X5Y6Z7",                                              │
│        "A8B9C0D1",                                              │
│        "E2F3G4H5",                                              │
│        "I6J7K8L9"                                               │
│      ]                                                           │
│    }                                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Display backup codes screen:                               │
│                                                                  │
│    ┌──────────────────────────────────────────────────────┐   │
│    │  ⚠️ IMPORTANT: Save These Backup Codes                │   │
│    │                                                       │   │
│    │  Each code can be used once if you lose access to    │   │
│    │  your authenticator app.                             │   │
│    │                                                       │   │
│    │  A3F1B2C8    D4E5F6A7    G8H9I0J1    K2L3M4N5       │   │
│    │  O6P7Q8R9    S0T1U2V3    W4X5Y6Z7    A8B9C0D1       │   │
│    │  E2F3G4H5    I6J7K8L9                               │   │
│    │                                                       │   │
│    │  [Copy All]  [Save as File]  [Print]                 │   │
│    │                                                       │   │
│    │  [ ] I have saved these codes securely               │   │
│    │                                                       │   │
│    │              [I've Saved Them]                        │   │
│    └───────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Navigate back to Settings → Security                        │
│    • Show "Two-Factor Authentication: Enabled ✓"               │
│    • Show buttons: [Disable] [Regenerate Backup Codes]         │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.4 Token Refresh

```
┌────────────────────────────────────────────────────────────────┐
│ App makes API call → Receives 401 Unauthorized                │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ HTTP Interceptor catches 401 error                             │
│ Check if this is a retry (request._retry flag)                 │
│                                                                  │
│ If already retried → Logout and navigate to Login Screen       │
│ If not retried → Attempt token refresh                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST /auth/refresh                                              │
│ Authorization: Bearer <expired_token>                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ├──► Success (200 OK)
                          │    { "token": "eyJhbGciOi..." }
                          │    │
                          │    ▼
                          │   ┌────────────────────────────────────┐
                          │   │ Save new token to Keychain         │
                          │   │ Retry original request with new    │
                          │   │ token                              │
                          │   │ Return response to caller          │
                          │   └────────────────────────────────────┘
                          │
                          └──► Error (401/403)
                               │
                               ▼
                              ┌────────────────────────────────────┐
                              │ Clear Keychain                     │
                              │ Clear app state                    │
                              │ Navigate to Login Screen           │
                              │ Show "Session expired" message     │
                              └────────────────────────────────────┘
```

**React Native Example:**
```typescript
import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const api = axios.create({
  baseURL: 'https://api.softaware.net.za',
  timeout: 30000,
});

// Response interceptor for auto-refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Don't retry if already retried or if it's a login/refresh request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get current token
        const credentials = await Keychain.getGenericPassword({
          service: 'com.softaware.app'
        });

        if (!credentials) {
          throw new Error('No token found');
        }

        // Refresh token
        const refreshResponse = await axios.post(
          'https://api.softaware.net.za/auth/refresh',
          {},
          {
            headers: {
              Authorization: `Bearer ${credentials.password}`
            }
          }
        );

        const newToken = refreshResponse.data.token;

        // Save new token
        await Keychain.setGenericPassword('softaware_user', newToken, {
          service: 'com.softaware.app'
        });

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout
        await Keychain.resetGenericPassword({ service: 'com.softaware.app' });
        // Navigate to login (implementation depends on your navigation setup)
        // Example: navigationRef.current?.navigate('Login');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

#### 3.2.5 Logout

```
┌────────────────────────────────────────────────────────────────┐
│ 1. User taps "Logout" in Settings                              │
│    Confirm: "Are you sure you want to log out?"               │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Get FCM device token from Firebase                          │
│    const fcmToken = await messaging().getToken();              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Unregister push notification token                          │
│    DELETE /fcm-tokens/:token                                   │
│    (Encode token in URL: encodeURIComponent(fcmToken))         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. (Optional) Notify backend of logout                         │
│    POST /auth/logout                                           │
│    (Backend can invalidate token server-side)                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Clear all local storage:                                    │
│    • Delete JWT token from Keychain/Keystore                   │
│    • Delete all software tokens (localStorage/SecureStorage)   │
│    • Clear Redux/Provider state                                │
│    • Clear any cached data                                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Navigate to Login Screen                                    │
│    Reset navigation stack (prevent back navigation)            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. User Types & Permissions

### 4.1 User Type Determination

The system has three distinct user types. Determination is based on the `role` object in the user profile:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: {
    id: number;
    name: string;
    slug: string; // ← This determines user type
  };
  is_admin: boolean; // ← Also indicates admin
  is_staff: boolean; // ← Also indicates staff
  permissions: Permission[];
}
```

**User Type Logic:**

| Role Slug | is_admin | is_staff | User Type | Description |
|-----------|:--------:|:--------:|-----------|-------------|
| `admin`, `super_admin` | ✅ | ❌ | **Admin** | Full platform access (excluding admin-only console screens on mobile) |
| `developer`, `client_manager`, `qa_specialist`, `deployer` | ❌ | ✅ | **Staff** | Functionally same as admin for permissions — all permission checks auto-pass |
| Any other slug | ❌ | ❌ | **Regular User** | Access controlled by granular permissions in `permissions[]` array |

**TypeScript Helper Functions:**
```typescript
type UserType = 'admin' | 'staff' | 'user';

function getUserType(user: User): UserType {
  if (user.is_admin) return 'admin';
  if (user.is_staff) return 'staff';
  return 'user';
}

function isAdminOrStaff(user: User): boolean {
  return user.is_admin || user.is_staff;
}

function hasPermission(user: User, permissionSlug: string): boolean {
  // Admin and staff bypass all permission checks
  if (user.is_admin || user.is_staff) return true;
  
  // Check if user has the specific permission
  return user.permissions.some(p => p.slug === permissionSlug);
}

function hasAnyPermission(user: User, permissionSlugs: string[]): boolean {
  if (user.is_admin || user.is_staff) return true;
  return permissionSlugs.some(slug =>
    user.permissions.some(p => p.slug === slug)
  );
}

function hasAllPermissions(user: User, permissionSlugs: string[]): boolean {
  if (user.is_admin || user.is_staff) return true;
  return permissionSlugs.every(slug =>
    user.permissions.some(p => p.slug === slug)
  );
}
```

### 4.2 Permission Reference

**Complete list of permissions used in mobile app:**

| Permission Slug | Required For | Module |
|----------------|--------------|--------|
| `view_dashboard` | Financial Dashboard | Dashboard |
| `view_contacts` | Contacts list/detail | Contacts |
| `create_contacts` | Create new contacts | Contacts |
| `edit_contacts` | Edit existing contacts | Contacts |
| `delete_contacts` | Delete contacts | Contacts |
| `view_quotations` | Quotations list/detail | Quotations |
| `create_quotations` | Create quotations | Quotations |
| `edit_quotations` | Edit quotations | Quotations |
| `delete_quotations` | Delete quotations | Quotations |
| `email_quotations` | Email quotations to clients | Quotations |
| `pdf_quotations` | Generate PDF quotations | Quotations |
| `view_invoices` | Invoices list/detail | Invoices |
| `create_invoices` | Create invoices | Invoices |
| `edit_invoices` | Edit invoices | Invoices |
| `delete_invoices` | Delete invoices | Invoices |
| `email_invoices` | Email invoices to clients | Invoices |
| `pdf_invoices` | Generate PDF invoices | Invoices |
| `view_payments` | View payments | Payments |
| `create_payments` | Record payments | Payments |
| `edit_payments` | Edit payments | Payments |
| `delete_payments` | Delete payments | Payments |
| `view_transactions` | View accounting transactions | Accounting |
| `view_reports` | Financial reports | Reports |
| `view_settings` | App settings | Settings |

**Permission Groups:**

```typescript
const PERMISSION_GROUPS = {
  contacts: ['view_contacts', 'create_contacts', 'edit_contacts', 'delete_contacts'],
  quotations: ['view_quotations', 'create_quotations', 'edit_quotations', 'delete_quotations', 'email_quotations', 'pdf_quotations'],
  invoices: ['view_invoices', 'create_invoices', 'edit_invoices', 'delete_invoices', 'email_invoices', 'pdf_invoices'],
  payments: ['view_payments', 'create_payments', 'edit_payments', 'delete_payments'],
  reports: ['view_reports'],
  dashboard: ['view_dashboard'],
};
```

### 4.3 Screen Access Matrix

| Screen | Admin | Staff | Regular User Permission Required |
|--------|:-----:|:-----:|----------------------------------|
| **Login** | ✅ | ✅ | ✅ (no auth) |
| **Portal Dashboard** | ✅ | ✅ | ✅ |
| **Financial Dashboard** | ✅ | ✅ | `view_dashboard` |
| **Tasks** | ✅ | ✅ | ✅ (shows only assigned tasks) |
| **Contacts** | ✅ | ✅ | `view_contacts` |
| **Quotations** | ✅ | ✅ | `view_quotations` |
| **Invoices** | ✅ | ✅ | `view_invoices` |
| **Payments** | ✅ | ✅ | `view_payments` |
| **Transactions** | ✅ | ✅ | ✅ (always visible) |
| **Financial Reports** | ✅ | ✅ | `view_reports` |
| **Groups** | ✅ | ✅ | ✅ |
| **Assistants** | ✅ | ✅ | ✅ |
| **My Assistant (Mobile AI)** | ✅ | ✅ | ✅ |
| **Sites** | ✅ | ✅ | ✅ |
| **Notifications** | ✅ | ✅ | ✅ |
| **Profile** | ✅ | ✅ | ✅ |
| **Settings** | ✅ | ✅ | ✅ |

### 4.4 Button/Action Access Matrix

| Action | Admin | Staff | Regular User Permission Required |
|--------|:-----:|:-----:|----------------------------------|
| **Create Contact** | ✅ | ✅ | `create_contacts` |
| **Edit Contact** | ✅ | ✅ | `edit_contacts` |
| **Delete Contact** | ✅ | ✅ | `delete_contacts` |
| **Create Task** | ✅ | ✅ | ❌ (not available to regular users) |
| **Edit Task** | ✅ | ✅ | ❌ |
| **Delete Task** | ✅ | ✅ | ❌ |
| **Assign Task** | ✅ | ✅ | ❌ |
| **Comment on Task** | ✅ | ✅ | ✅ (if assigned to task) |
| **Create Quotation** | ✅ | ✅ | `create_quotations` |
| **Email Quotation** | ✅ | ✅ | `email_quotations` |
| **Create Invoice** | ✅ | ✅ | `create_invoices` |
| **Record Payment** | ✅ | ✅ | `create_payments` |
| **Create Assistant** | ✅ | ✅ | ✅ |
| **Delete Assistant** | ✅ | ✅ | ✅ (own assistants only) |
| **Create Mobile AI Assistant** | ✅ | ✅ (max 1) | ✅ (unlimited) |
| **Update Mobile AI Assistant** | ✅ | ✅ | ✅ (own only) |
| **Set Primary Assistant** | ✅ | ✅ | ✅ |
| **Send Voice/Text Intent** | ✅ | ✅ | ✅ |
| **Create Site** | ✅ | ✅ | ✅ |
| **Enable 2FA** | ✅ | ✅ | ✅ |

**Implementation Example:**

```typescript
// In your component
function ContactListScreen({ user }: { user: User }) {
  const canCreate = hasPermission(user, 'create_contacts');
  const canEdit = hasPermission(user, 'edit_contacts');
  const canDelete = hasPermission(user, 'delete_contacts');

  return (
    <View>
      {/* Create button only shown if user has permission */}
      {canCreate && (
        <TouchableOpacity onPress={handleCreate}>
          <Text>Create Contact</Text>
        </TouchableOpacity>
      )}

      {contacts.map(contact => (
        <ContactCard
          key={contact.id}
          contact={contact}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </View>
  );
}
```

---

## 5. Data Models

Complete TypeScript interfaces for all data models. Use these as references for your chosen platform (convert to Dart for Flutter, Swift structs for iOS, Kotlin data classes for Android).

### 5.1 User & Auth Models

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  is_admin: boolean;
  is_staff: boolean;
  permissions: Permission[];
  createdAt?: string;
}

interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

interface Permission {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permission_group?: string;
}

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  success: true;
  token: string;
  user: User;
}

interface Login2FAResponse {
  success: true;
  requires_2fa: true;
  temp_token: string;
}

interface Verify2FARequest {
  temp_token: string;
  code: string; // 6-digit TOTP or 8-char backup code
}

interface Verify2FAResponse {
  success: true;
  token: string;
  user: User;
  used_backup_code: boolean;
  remaining_backup_codes: number;
}

interface TwoFAStatus {
  is_enabled: boolean;
}

interface TwoFASetupResponse {
  secret: string; // Base32 secret for manual entry
  qr_code: string; // data:image/png;base64,...
  otpauth_url: string; // otpauth://totp/SoftAware:user@example.com?secret=...
}

interface TwoFAVerifySetupResponse {
  success: true;
  backup_codes: string[]; // Array of 10 codes
}

interface FCMTokenRequest {
  token: string; // FCM device token
  device_name: string; // e.g., "iPhone 14 Pro"
  platform: 'ios' | 'android';
}

interface FCMTokenResponse {
  id: number;
  token: string;
  device_name: string;
  platform: string;
  user_id: string;
  created_at: string;
  last_used: string;
}
```

### 5.2 Task Models

```typescript
interface Software {
  id: number;
  name: string;
  software_key: string;
  description: string | null;
  created_by_name: string;
  latest_version: string | null;
  total_updates: number;
  has_external_integration: 0 | 1;
  external_live_url: string | null;
  external_test_url: string | null;
  external_username: string | null;
  external_password: string | null;
  external_api_url?: string; // Computed: live or test URL
}

interface TaskAuthRequest {
  apiUrl: string;
  username: string;
  password: string;
  otp?: string; // Include if OTP required
  otpToken?: string; // Include if OTP required
}

interface TaskAuthResponse {
  success: true;
  token: string;
}

interface TaskAuthOTPResponse {
  requires_otp: true;
  otp_token: string;
  user_id: number;
}

type TaskStatus = 'new' | 'in-progress' | 'completed' | 'pending';
type TaskType = 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support';
type WorkflowPhase = 'intake' | 'quality_review' | 'triage' | 'development' | 'verification' | 'resolution';

interface Task {
  id: number;
  title: string; // Mapped from task_name
  description: string | null;
  status: TaskStatus;
  type: TaskType;
  hours: string; // Decimal string, e.g., "2.50"
  estimatedHours: string | null;
  created_at: string | null;
  start: string | null; // Planned start date
  due_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  creator: string | null;
  created_by_name: string | null;
  workflow_phase: WorkflowPhase | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  module_id: number | null;
  module_name: string | null;
  software_id: number | null;
  task_bill_date: string | null;
  task_billed: 0 | 1;
  approval_required: 0 | 1;
  approved_by: string | null;
  approved_at: string | null;
  task_order: number | null;
  parent_task_id: number | null;
  association_type: string | null;
  date: string | null;
}

interface TaskCreateRequest {
  apiUrl: string;
  task: {
    task_name: string;
    task_description: string;
    task_notes?: string;
    task_status: 'new' | 'progress' | 'completed' | 'pending'; // Note: use "progress" not "in-progress"
    task_type: TaskType;
    task_hours: string;
    task_estimated_hours: string;
    task_color?: string;
    software_id: number;
    module_id?: number;
    assigned_to?: number;
    task_created_by_name: string;
    user_name: string;
    task_approval_required?: 0 | 1;
  };
}

interface TaskUpdateRequest {
  apiUrl: string;
  task: {
    task_id: number;
    task_name: string;
    task_description: string;
    task_notes?: string;
    task_status: 'new' | 'progress' | 'completed' | 'pending';
    task_type: TaskType;
    task_hours: string;
    task_estimated_hours: string;
    software_id: number;
    module_id?: number;
    assigned_to?: number;
    user_name: string;
    workflow_phase?: WorkflowPhase;
  };
}

interface Comment {
  comment_id: number;
  content: string; // HTML content
  user_name: string | null;
  username: string | null; // Alternative field
  created_by: string | null; // Alternative field
  is_internal: 0 | 1;
  time_spent: string | null; // Decimal hours
  created_at: string | null;
  parent_comment_id: number | null;
  attachments: Attachment[];
}

interface Attachment {
  attachment_id: number;
  file_name: string;
  file_path: string; // Full URL to file
}

interface CommentCreateRequest {
  apiUrl: string;
  content: string;
  is_internal?: 0 | 1;
  time_spent?: number;
  parent_comment_id?: number | null;
}

interface CommentWithAttachmentRequest {
  apiUrl: string;
  content: string;
  is_internal: 0 | 1;
  imageBase64: string; // data:image/png;base64,...
  fileName: string;
}

type AssociationType = 'blocker' | 'duplicate' | 'child' | 'related' | 'follow-up';

interface TaskAssociation {
  task_id: number;
  associated_task_id: number;
  association_type: AssociationType;
  created_at?: string;
}

interface TaskAssociateRequest {
  apiUrl: string;
  task_id: number;
  associated_task_id: number;
  association_type: AssociationType;
}

interface Module {
  id: number;
  name: string;
  software_id: number;
}

interface User {
  id: number;
  name: string;
  role?: string | { slug: string };
}
```

### 5.3 Contact Models

```typescript
interface Contact {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactCreateRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postal_code?: string | null;
  notes?: string | null;
}

interface ContactUpdateRequest extends ContactCreateRequest {
  // Same fields as create
}

interface ContactListResponse {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### 5.4 Quotation Models

```typescript
interface Quotation {
  id: number;
  quotation_number: string; // e.g., "QT-0001"
  contact_id: number;
  contact_name?: string;
  date: string; // YYYY-MM-DD
  valid_until: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  items: QuotationItem[];
}

interface QuotationItem {
  id: number;
  quotation_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // Percentage, e.g., 15
  line_total: number; // Computed: quantity * unit_price * (1 + tax_rate/100)
}

interface QuotationCreateRequest {
  contact_id: number;
  date: string; // YYYY-MM-DD
  valid_until?: string | null;
  status?: 'draft' | 'sent' | 'accepted' | 'declined';
  notes?: string | null;
  terms?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
}

interface QuotationUpdateRequest extends QuotationCreateRequest {
  // Same fields as create
}

interface QuotationListResponse {
  quotations: Quotation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface QuotationPDFResponse {
  success: true;
  pdfUrl: string; // URL to download PDF
}

interface QuotationEmailRequest {
  to: string; // Recipient email
  subject?: string;
  message?: string;
}
```

### 5.5 Invoice & Payment Models

```typescript
interface Invoice {
  id: number;
  invoice_number: string; // e.g., "INV-0001"
  contact_id: number;
  contact_name?: string;
  date: string; // YYYY-MM-DD
  due_date: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance: number; // total - amount_paid
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
  payments: Payment[];
}

interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

interface InvoiceCreateRequest {
  contact_id: number;
  date: string;
  due_date?: string | null;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string | null;
  terms?: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }>;
}

interface InvoiceUpdateRequest extends InvoiceCreateRequest {}

interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface PaymentCreateRequest {
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'other';
  reference?: string | null;
  notes?: string | null;
}
```

### 5.6 Notification Models

```typescript
type NotificationType = 'payment' | 'task' | 'system' | 'message';

interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data: Record<string, any> | null; // Additional payload, e.g., { taskId: 123 }
  created_at: string;
}

interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface NotificationUnreadCountResponse {
  unread_count: number;
}

interface NotificationCreateRequest {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  send_push?: boolean; // If true, also send FCM push
  data?: Record<string, any>;
}
```

### 5.7 Dashboard Models

```typescript
interface FinancialDashboardMetrics {
  metrics: {
    totalContacts: number;
    totalQuotations: number;
    totalInvoices: number;
    totalPayments: number;
    overdueInvoices: number;
    recentActivity: Activity[];
  };
  billing: {
    totalRevenue: number;
    totalExpenses: number;
    outstandingAmount: number;
    monthlyRevenue: MonthlyRevenue[];
  };
}

interface Activity {
  id: number;
  type: 'contact' | 'quotation' | 'invoice' | 'payment';
  description: string;
  timestamp: string;
}

interface MonthlyRevenue {
  month: string; // YYYY-MM
  revenue: number;
}

interface PortalDashboardMetrics {
  metrics: {
    messages: { used: number; limit: number };
    pagesIndexed: { used: number; limit: number };
    assistants: { count: number; limit: number };
    tier: string; // 'free' | 'professional' | 'enterprise'
  };
}
```

### 5.8 Assistant & Site Models

```typescript
interface Assistant {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'training';
  tier: string;
  pagesIndexed: number;
  knowledgeHealth: number; // 0-100 score
  created_at: string;
  updated_at: string;
}

interface AssistantCreateRequest {
  name: string;
  description: string;
  tier?: string;
}

interface AssistantChatRequest {
  assistantId: string;
  message: string;
  stream?: boolean; // If true, response is SSE stream
}

interface AssistantChatResponse {
  content: string;
  model: string;
  provider: string;
  creditsUsed: number;
}

interface Site {
  id: string;
  name: string;
  description: string;
  url: string | null;
  status: 'draft' | 'published';
  template: string;
  pages: number;
  created_at: string;
  updated_at: string;
}

interface SiteCreateRequest {
  name: string;
  description: string;
  template?: string;
}
```

### 5.9 Mobile AI Assistant Models

```typescript
/** A user's personal AI assistant (staff or client) */
interface MyAssistant {
  id: string;                    // "staff-assistant-{ts}" or "client-assistant-{ts}"
  name: string;
  description: string | null;
  personality: string | null;    // "professional" | "friendly" | "expert" | "casual"
  personality_flare: string | null; // User-editable personality & tone text
  primary_goal: string | null;
  custom_greeting: string | null;
  voice_style: string | null;    // TTS voice style hint
  preferred_model: string | null;
  business_type: string | null;
  website: string | null;
  status: string;                // "active" | "suspended" | "demo_expired"
  tier: string;                  // "free" | "paid"
  is_staff_agent: number;        // 1 = staff sandbox assistant (gets admin tools)
  is_primary: number;            // 1 = this user's default/main mobile assistant
  pages_indexed: number;
  knowledge_categories: any;
  created_at: string;
  updated_at: string;
}

/** Create / update payload */
interface MyAssistantCreate {
  name: string;                  // Required
  description?: string;
  personality?: string;
  personality_flare?: string;
  primary_goal?: string;
  custom_greeting?: string;
  voice_style?: string;
  preferred_model?: string;
  business_type?: string;
  website?: string;
}

type MyAssistantUpdate = Partial<MyAssistantCreate>;

/** Assistant option shown in mobile assistant picker */
interface MobileAssistantOption {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  personality_flare: string | null;
  custom_greeting: string | null;
  voice_style: string | null;
  is_staff_agent: number;
  is_primary: number;
  status: string;
  tier: string;
}

/** Voice/text intent request */
interface MobileIntentRequest {
  text: string;                  // The transcribed voice or typed text (max 2000 chars)
  conversationId?: string;       // Resume existing conversation
  assistantId?: string;          // Specify assistant (omit to use primary)
  language?: string;             // Language hint for the AI
}

/** Voice/text intent response */
interface MobileIntentResponse {
  success: boolean;
  reply: string;                 // Plain-text answer (pass to TTS)
  conversationId: string;        // Use to continue conversation
  toolsUsed: string[];           // Names of tools invoked by the AI
  data?: Record<string, unknown>; // Structured data from last tool
}

/** Conversation list item */
interface MobileConversation {
  id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

/** Single message in a conversation */
interface MobileMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  created_at: string;
}

/** Software token (staff only — for task proxy) */
interface StaffSoftwareToken {
  id: string;
  software_id: number;
  software_name: string | null;
  api_url: string;
  created_at: string;
  updated_at: string;
}
```

### 5.10 Group Models

```typescript
interface Group {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  members: GroupMember[];
  unread_count?: number;
}

interface GroupMember {
  id: number;
  user_id: string;
  user_name: string;
  role: 'admin' | 'member';
  joined_at: string;
}

interface GroupMessage {
  id: number;
  group_id: number;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

interface GroupCreateRequest {
  name: string;
  description?: string | null;
}

interface GroupMessageCreateRequest {
  group_id: number;
  content: string;
}
```

---

# Part 2: Complete API Reference

## 6. Authentication API

Base URL: `https://api.softaware.net.za`

### 6.1 Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "rememberMe": true
}
```

**Field Validation:**
- `email`: Required, valid email format, max 320 characters
- `password`: Required, min 8 characters
- `rememberMe`: Optional, boolean (default: false)
  - `true` → Token expires in 30 days
  - `false` → Token expires in 1 hour

**Response (Success - No 2FA):** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLXV1aWQtYWJjMTIzIiwiaWF0IjoxNzA5NTY4MDAwLCJleHAiOjE3MDk1NzE2MDB9.signature",
  "user": {
    "id": "user-uuid-abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+27123456789",
    "role": {
      "id": 2,
      "name": "Developer",
      "slug": "developer"
    },
    "is_admin": false,
    "is_staff": true,
    "permissions": []
  }
}
```

**Response (Success - 2FA Required):** `200 OK`
```json
{
  "success": true,
  "requires_2fa": true,
  "temp_token": "temp-session-abcd1234-5678-ef90"
}
```

**Response (Error - Invalid Credentials):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Response (Error - Account Locked):** `403 Forbidden`
```json
{
  "success": false,
  "error": "Account locked due to too many failed login attempts. Try again in 15 minutes."
}
```

---

### 6.2 Verify 2FA

**Endpoint:** `POST /auth/2fa/verify`

**Request Body:**
```json
{
  "temp_token": "temp-session-abcd1234-5678-ef90",
  "code": "123456"
}
```

OR (using backup code):
```json
{
  "temp_token": "temp-session-abcd1234-5678-ef90",
  "code": "A3F1B2C8"
}
```

**Field Validation:**
- `temp_token`: Required, issued by `/auth/login` when 2FA required
- `code`: Required, either:
  - 6-digit TOTP code (e.g., "123456")
  - 8-character backup code (e.g., "A3F1B2C8")

**Response (Success - TOTP):** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { /* full user object */ },
  "used_backup_code": false,
  "remaining_backup_codes": 10
}
```

**Response (Success - Backup Code):** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { /* full user object */ },
  "used_backup_code": true,
  "remaining_backup_codes": 9
}
```

**Response (Error - Invalid Code):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid verification code"
}
```

**Response (Error - Expired Temp Token):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Temporary token expired. Please log in again."
}
```

---

### 6.3 Check 2FA Status

**Endpoint:** `GET /auth/2fa/status`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "is_enabled": true
}
```

---

### 6.4 Setup 2FA

**Endpoint:** `POST /auth/2fa/setup`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:** (empty)

**Response:** `200 OK`
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAIAAAD2HxkiAAAG...",
  "otpauth_url": "otpauth://totp/SoftAware:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SoftAware"
}
```

**Fields:**
- `secret`: Base32-encoded secret for manual entry into authenticator app
- `qr_code`: Data URL of QR code image (PNG, base64-encoded)
- `otpauth_url`: Deep link for authenticator apps (can be used for same-device setup)

---

### 6.5 Verify 2FA Setup

**Endpoint:** `POST /auth/2fa/verify-setup`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (Success):** `200 OK`
```json
{
  "success": true,
  "backup_codes": [
    "A3F1B2C8",
    "D4E5F6A7",
    "G8H9I0J1",
    "K2L3M4N5",
    "O6P7Q8R9",
    "S0T1U2V3",
    "W4X5Y6Z7",
    "A8B9C0D1",
    "E2F3G4H5",
    "I6J7K8L9"
  ]
}
```

**CRITICAL:** Display these backup codes to the user with a strong warning to save them securely. Each can only be used once.

**Response (Error):** `400 Bad Request`
```json
{
  "success": false,
  "error": "Invalid code. Please check your authenticator app and try again."
}
```

---

### 6.6 Disable 2FA

**Endpoint:** `POST /auth/2fa/disable`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:** (empty)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Two-factor authentication has been disabled"
}
```

---

### 6.7 Regenerate Backup Codes

**Endpoint:** `POST /auth/2fa/regenerate-backup-codes`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:** (empty)

**Response:** `200 OK`
```json
{
  "success": true,
  "backup_codes": [ /* new set of 10 codes */ ]
}
```

**Note:** This invalidates all previous backup codes.

---

### 6.8 Refresh Token

**Endpoint:** `POST /auth/refresh`

**Headers:** `Authorization: Bearer <expired_or_expiring_token>`

**Request Body:** (empty)

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // New token
}
```

**Response (Error):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

---

### 6.9 Validate Token

**Endpoint:** `GET /auth/validate`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response (Valid):** `200 OK`
```json
{
  "valid": true
}
```

**Response (Invalid):** `401 Unauthorized`
```json
{
  "valid": false
}
```

---

### 6.10 Get Current User

**Endpoint:** `GET /auth/me`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "user-uuid-abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+27123456789",
    "role": {
      "id": 2,
      "name": "Developer",
      "slug": "developer"
    },
    "is_admin": false,
    "is_staff": true,
    "permissions": []
  }
}
```

---

### 6.11 Logout

**Endpoint:** `POST /auth/logout`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:** (empty)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Note:** This is optional. The client can simply delete the token locally. However, calling this endpoint allows the server to invalidate the token server-side (if implemented).

---

## 7. Profile & Settings API

### 7.1 Get Profile

**Endpoint:** `GET /profile`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "user-uuid-abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+27123456789",
    "role": {
      "id": 2,
      "name": "Developer",
      "slug": "developer"
    },
    "is_admin": false,
    "is_staff": true,
    "permissions": [],
    "createdAt": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### 7.2 Update Profile

**Endpoint:** `PUT /profile`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "name": "John Updated Doe",
  "phone": "+27987654321"
}
```

**Field Validation:**
- `name`: Optional, max 255 characters
- `phone`: Optional, valid phone format

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "user-uuid-abc123",
    "email": "user@example.com",
    "name": "John Updated Doe",
    "phone": "+27987654321",
    "role": { /* ... */ },
    "is_admin": false,
    "is_staff": true,
    "permissions": []
  }
}
```

---

### 7.3 Change Password

**Endpoint:** `POST /profile/change-password`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

**Field Validation:**
- `currentPassword`: Required
- `newPassword`: Required, min 8 characters, must include uppercase, lowercase, number, special character
- `confirmPassword`: Required, must match `newPassword`

**Response (Success):** `200 OK`
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (Error - Wrong Current Password):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

**Response (Error - Weak Password):** `400 Bad Request`
```json
{
  "success": false,
  "error": "Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
}
```

---

## 8. Notifications API

### 8.1 List Notifications

**Endpoint:** `GET /notifications`

**Headers:** `Authorization: Bearer <jwt_token>`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page (max 100) |

**Example:** `GET /notifications?page=2&limit=20`

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": 1,
      "user_id": "user-uuid-abc123",
      "type": "task",
      "title": "Task Assigned",
      "message": "You have been assigned to task: Fix login bug",
      "read": false,
      "data": {
        "taskId": 42,
        "taskTitle": "Fix login bug"
      },
      "created_at": "2026-03-04T10:30:00.000Z"
    },
    {
      "id": 2,
      "user_id": "user-uuid-abc123",
      "type": "payment",
      "title": "Payment Received",
      "message": "Payment of R5,000 received for Invoice INV-0001",
      "read": true,
      "data": {
        "invoiceId": 1,
        "amount": 5000
      },
      "created_at": "2026-03-03T14:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### 8.2 Get Unread Count

**Endpoint:** `GET /notifications/unread-count`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "unread_count": 7
}
```

---

### 8.3 Mark Notification as Read

**Endpoint:** `PUT /notifications/:id/read`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### 8.4 Mark All as Read

**Endpoint:** `PUT /notifications/read-all`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 7
}
```

---

### 8.5 Delete Notification

**Endpoint:** `DELETE /notifications/:id`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## 9. Dashboard API

The mobile app serves two audiences, each with its own dashboard:

| Dashboard            | Audience        | Endpoint                  | Description                       |
|----------------------|-----------------|---------------------------|-----------------------------------|
| Financial Dashboard  | Staff           | `GET /dashboard/stats`    | Revenue, invoices, quotations, aging |
| Portal Dashboard     | Clients (SaaS)  | `GET /dashboard/metrics`  | AI usage, assistants, plan limits |

> **No admin dashboard.** Admin-only features (system users, credentials, DB manager,
> software registry, etc.) are **not** part of the mobile app.

---

### 9.1 Staff Financial Dashboard

**Endpoint:** `GET /dashboard/stats`

**Headers:** `Authorization: Bearer <jwt_token>`

**Permission:** Requires `dashboard.view` permission (auto-granted to staff roles)

**Query Parameters:**

| Param    | Type   | Default  | Options                                         |
|----------|--------|----------|--------------------------------------------------|
| `period` | string | `month`  | `today`, `week`, `month`, `quarter`, `year`, `all` |

**Response:** `200 OK`
```json
{
  "revenue": {
    "collected": 120000.00,
    "total_invoiced": 150000.00,
    "outstanding": 30000.00,
    "collection_rate": 80
  },
  "profit": {
    "profit": 65000.00,
    "expenses": 55000.00,
    "profit_margin": 54
  },
  "invoices": {
    "total_count": 67,
    "total_amount": 150000.00,
    "paid_count": 52,
    "unpaid_count": 15,
    "partial_count": 0
  },
  "quotations": {
    "total_count": 23,
    "accepted_count": 0
  },
  "customers": {
    "customer_count": 45,
    "supplier_count": 0
  },
  "payments": {
    "total_count": 52,
    "average_amount": 2307.69
  },
  "outstanding": {
    "current": 12000.00,
    "30_days": 8000.00,
    "60_days": 5000.00,
    "90_plus_days": 5000.00,
    "total": 30000.00
  },
  "recent_invoices": [
    {
      "invoice_id": 67,
      "invoice_number": "INV-0067",
      "invoice_total": 5500.00,
      "invoice_payment_status": 0,
      "invoice_date": "2026-03-04",
      "contact_name": "Acme Corp",
      "amount_paid": 0,
      "outstanding": 5500.00
    }
  ],
  "recent_quotations": [
    {
      "quotation_id": 23,
      "quotation_number": "QUO-0023",
      "quotation_total": 12000.00,
      "quotation_date": "2026-03-03",
      "contact_name": "Beta Industries"
    }
  ]
}
```

**TypeScript Interface:**
```typescript
interface FinancialDashboard {
  revenue: {
    collected: number;        // Total payments received (ZAR)
    total_invoiced: number;   // Total invoiced amount
    outstanding: number;      // Invoiced minus paid
    collection_rate: number;  // Percentage 0-100
  };
  profit: {
    profit: number;           // collected − expenses
    expenses: number;         // Sum of debit transactions
    profit_margin: number;    // Percentage 0-100
  };
  invoices: {
    total_count: number;
    total_amount: number;
    paid_count: number;
    unpaid_count: number;
    partial_count: number;
  };
  quotations: {
    total_count: number;
    accepted_count: number;
  };
  customers: {
    customer_count: number;
    supplier_count: number;
  };
  payments: {
    total_count: number;
    average_amount: number;
  };
  outstanding: {
    current: number;          // Not yet due
    '30_days': number;        // 1-30 days overdue
    '60_days': number;        // 31-60 days overdue
    '90_plus_days': number;   // 90+ days overdue
    total: number;
  };
  recent_invoices: RecentInvoice[];
  recent_quotations: RecentQuotation[];
}

interface RecentInvoice {
  invoice_id: number;
  invoice_number: string;
  invoice_total: number;
  invoice_payment_status: 0 | 1;  // 0 = unpaid, 1 = paid
  invoice_date: string;           // YYYY-MM-DD
  contact_name: string | null;
  amount_paid: number;
  outstanding: number;
}

interface RecentQuotation {
  quotation_id: number;
  quotation_number: string;
  quotation_total: number;
  quotation_date: string;         // YYYY-MM-DD
  contact_name: string | null;
}
```

**Mobile UI Layout — Staff Financial Dashboard:**

```
┌──────────────────────────────────────────────┐
│  Financial Dashboard        [Period ▼ month] │
├──────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐                  │
│  │ Revenue  │  │  Profit  │                  │
│  │ R120,000 │  │  R65,000 │                  │
│  │ 80% rate │  │  54% mgn │                  │
│  └──────────┘  └──────────┘                  │
│  ┌──────────┐  ┌──────────┐                  │
│  │Outstndng │  │ Invoiced │                  │
│  │ R30,000  │  │ R150,000 │                  │
│  │ 15 unpaid│  │ 67 total │                  │
│  └──────────┘  └──────────┘                  │
├──────────────────────────────────────────────┤
│  Payments: 52 received  │ Avg: R2,307.69     │
│  Quotations: 23 total   │ Customers: 45      │
├──────────────────────────────────────────────┤
│  Outstanding Aging                           │
│  ┌────────┬────────┬────────┬───────────┐    │
│  │Current │ 30 day │ 60 day │  90+ day  │    │
│  │R12,000 │ R8,000 │ R5,000 │  R5,000   │    │
│  └────────┴────────┴────────┴───────────┘    │
├──────────────────────────────────────────────┤
│  Recent Invoices                   See All → │
│  ┌──────────────────────────────────────┐    │
│  │ INV-0067  Acme Corp    R5,500   ○    │    │
│  │ INV-0066  Beta Ltd     R3,200   ●    │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  Recent Quotations                 See All → │
│  ┌──────────────────────────────────────┐    │
│  │ QUO-0023  Beta Industries  R12,000   │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**Currency:** All monetary values are in **ZAR** (South African Rand).  
Display format: `R 120,000.00` in detail views, `R120k` for compact cards.

**Card colour scheme:**

| Card        | Border-left | Meaning            |
|-------------|-------------|--------------------|
| Revenue     | `#22c55e` green  | Positive income   |
| Profit      | `#3b82f6` blue   | Net margin        |
| Outstanding | `#f59e0b` orange | Attention needed  |
| Invoiced    | `#8b5cf6` purple | Volume metric     |

---

### 9.2 Client Portal Dashboard

**Endpoint:** `GET /dashboard/metrics`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "messages": {
    "used": 150,
    "limit": 500
  },
  "pagesIndexed": {
    "used": 32,
    "limit": 50
  },
  "assistants": {
    "count": 3,
    "limit": 5
  },
  "tier": "free"
}
```

**Tier-based Limits:**

| Tier         | Messages / month | Page Limit | Assistant Limit     |
|--------------|------------------|------------|---------------------|
| `free`       | 500              | 50         | 5                   |
| `team`       | 5,000            | 500        | Plan `maxAgents`    |
| `enterprise` | 50,000           | 5,000      | Plan `maxAgents`    |

**TypeScript Interface:**
```typescript
interface PortalDashboard {
  messages: { used: number; limit: number };
  pagesIndexed: { used: number; limit: number };
  assistants: { count: number; limit: number };
  tier: 'free' | 'team' | 'enterprise';
}
```

**Supplementary Endpoints for Portal Dashboard:**

The portal dashboard should also call these endpoints to build a complete view:

| Endpoint             | Purpose                           | Section in dashboard         |
|----------------------|-----------------------------------|------------------------------|
| `GET /assistants`    | List user's AI assistants         | Assistant cards grid         |
| `GET /credits/balance` | Remaining AI credits (if any)  | Credits display              |

**Mobile UI Layout — Client Portal Dashboard:**

```
┌──────────────────────────────────────────────┐
│  Welcome back! 👋              [Free] Plan   │
│                        [+ New Assistant]      │
├──────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐                  │
│  │Assistants│  │ Messages │                  │
│  │   3 / 5  │  │ 150/500  │                  │
│  │          │  │ ████░ 30%│                  │
│  └──────────┘  └──────────┘                  │
│  ┌──────────┐  ┌──────────┐                  │
│  │  Pages   │  │   Plan   │                  │
│  │  32/50   │  │   Free   │                  │
│  │ ██████░64│  │ Manage → │                  │
│  └──────────┘  └──────────┘                  │
├──────────────────────────────────────────────┤
│  Quick Actions                               │
│  [+ New Assistant] [+ Landing Page] [Train]  │
├──────────────────────────────────────────────┤
│  Your Assistants                   See All → │
│  ┌──────────────────────────────────────┐    │
│  │ 🤖 Sales Bot       ● Active         │    │
│  │    "Handles sales queries"  [Chat]   │    │
│  ├──────────────────────────────────────┤    │
│  │ 🤖 Support Bot     ● Active         │    │
│  │    "Customer support"       [Chat]   │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**Progress bar colour thresholds:**
```typescript
function getUsageColour(used: number, limit: number): string {
  const pct = (used / limit) * 100;
  if (pct <= 60) return '#22c55e';   // Green  — healthy
  if (pct <= 80) return '#f59e0b';   // Amber  — approaching limit
  return '#ef4444';                   // Red    — near/at limit
}
```

**Error / Fallback Response:**
On any fetch failure the endpoint returns safe defaults (no 500 error):
```json
{
  "messages": { "used": 0, "limit": 500 },
  "pagesIndexed": { "used": 0, "limit": 50 },
  "assistants": { "count": 0, "limit": 5 },
  "tier": "free"
}
```

**Empty State (no assistants yet):**
```
┌──────────────────────────────────────────────┐
│         🤖                                    │
│  No assistants yet                           │
│                                              │
│  Create your first AI assistant to get       │
│  started with intelligent conversations.     │
│                                              │
│        [+ Create Assistant]                   │
└──────────────────────────────────────────────┘
```

---

### 9.3 Dashboard Role Detection

The mobile app should detect the user's role from the JWT and show the correct
dashboard on the home screen. There is **no admin dashboard** in the mobile app.

```typescript
type DashboardType = 'financial' | 'portal';

function getDashboardType(user: AuthUser): DashboardType {
  // Staff and managers see the Financial Dashboard
  if (['staff', 'manager', 'admin', 'super_admin'].includes(user.role)) {
    return 'financial';
  }
  // All other users (clients, portal users) see the Portal Dashboard
  return 'portal';
}

// Financial dashboard call:
//   GET /dashboard/stats?period=month
//   Requires: dashboard.view permission
//
// Portal dashboard call:
//   GET /dashboard/metrics
//   + GET /assistants (for assistant cards)
```

---

## 10. Tasks API

**IMPORTANT:** Tasks use a **dual-token system**. Every request requires TWO tokens:
1. **JWT Token** (platform authentication) → `Authorization: Bearer <jwt>`
2. **Software Token** (per-software authentication) → `X-Software-Token: <software_token>`

### 10.1 Get Software List

**Endpoint:** `GET /softaware/software`

**Headers:** `Authorization: Bearer <jwt_token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "software": [
    {
      "id": 1,
      "name": "Customer Portal",
      "software_key": "20250101CUST",
      "description": "Main customer portal",
      "created_by_name": "admin",
      "latest_version": "1.5.2",
      "total_updates": 5,
      "has_external_integration": 1,
      "external_live_url": "https://portal.example.com",
      "external_test_url": "https://test.portal.example.com",
      "external_username": "api_user",
      "external_password": "api_pass"
    },
    {
      "id": 2,
      "name": "Internal Tools",
      "software_key": "20250115TOOL",
      "description": "Internal tools",
      "created_by_name": "admin",
      "latest_version": "2.0.1",
      "total_updates": 3,
      "has_external_integration": 0,
      "external_live_url": null,
      "external_test_url": null,
      "external_username": null,
      "external_password": null
    }
  ]
}
```

**Note:** Only software with `has_external_integration === 1` can be used for tasks.

---

### 10.2 Authenticate with Software API

**Endpoint:** `POST /softaware/tasks/authenticate`

**Headers:** `Authorization: Bearer <jwt_token>`

**Request Body (Initial):**
```json
{
  "apiUrl": "https://portal.example.com",
  "username": "api_user",
  "password": "api_pass"
}
```

**Response (Success - Token Issued):** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**What to do:** Store this token securely as `software_token_<softwareId>`. Use it in all subsequent task API calls.

**Response (OTP Required):** `200 OK`
```json
{
  "requires_otp": true,
  "otp_token": "temp-otp-session-xyz",
  "user_id": 5
}
```

**What to do:** Show OTP input to user. Then submit:

**Request Body (With OTP):**
```json
{
  "apiUrl": "https://portal.example.com",
  "username": "api_user",
  "password": "api_pass",
  "otp": "123456",
  "otpToken": "temp-otp-session-xyz"
}
```

**Response (After OTP):** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error):** `401 Unauthorized`
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

### 10.3 List Tasks

**Endpoint:** `GET /softaware/tasks`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL (e.g., `https://portal.example.com`) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 1000, max: 1000) |

**Example:** `GET /softaware/tasks?apiUrl=https://portal.example.com&page=1&limit=1000`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "title": "Fix login bug",
        "description": "<p>Users cannot log in with special characters in password</p>",
        "status": "progress",
        "type": "bug-fix",
        "hours": "3.50",
        "estimatedHours": "4.00",
        "created_at": "2026-03-01T08:00:00.000Z",
        "start": "2026-03-01",
        "due_date": "2026-03-05",
        "actual_start": "2026-03-01T09:00:00.000Z",
        "actual_end": null,
        "creator": "admin",
        "created_by_name": "Admin User",
        "workflow_phase": "development",
        "assigned_to": 5,
        "assigned_to_name": "John Developer",
        "module_id": 2,
        "module_name": "Authentication",
        "software_id": 1,
        "task_bill_date": null,
        "task_billed": 0,
        "approval_required": 0,
        "approved_by": null,
        "approved_at": null,
        "task_order": 1,
        "parent_task_id": null,
        "association_type": null,
        "date": "2026-03-01"
      }
    ],
    "has_next": false
  }
}
```

**Note:** The frontend normalizes `"status": "progress"` to `"status": "in-progress"`.

**Pagination:** If `has_next: true`, increment `page` and fetch again. Repeat until `has_next: false`.

---

### 10.4 Create Task

**Endpoint:** `POST /softaware/tasks`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "task": {
    "task_name": "Implement password reset",
    "task_description": "<p>Add forgot password functionality</p>",
    "task_notes": "Use email verification",
    "task_status": "new",
    "task_type": "feature",
    "task_hours": "0",
    "task_estimated_hours": "6.00",
    "task_color": "#3b82f6",
    "software_id": 1,
    "module_id": 2,
    "assigned_to": 5,
    "task_created_by_name": "Admin User",
    "user_name": "admin",
    "task_approval_required": 0
  }
}
```

**Field Validation:**
- `task_name`: Required, max 255 characters
- `task_description`: Optional, HTML string
- `task_notes`: Optional, plain text
- `task_status`: Required, one of: `"new"`, `"progress"`, `"completed"`, `"pending"`
- `task_type`: Required, one of: `"development"`, `"bug-fix"`, `"feature"`, `"maintenance"`, `"support"`
- `task_hours`: Required, decimal string (e.g., `"0"`, `"2.50"`)
- `task_estimated_hours`: Required, decimal string
- `task_color`: Optional, hex color (default: `"#3b82f6"`)
- `software_id`: Required, integer
- `module_id`: Optional, integer (nullable)
- `assigned_to`: Optional, integer (nullable)
- `task_created_by_name`: Required, string
- `user_name`: Required, string (current user's username)
- `task_approval_required`: Optional, `0` or `1` (auto-set to `1` if `task_estimated_hours > 8`)

**Response:** `200 OK`
```json
{
  "success": true,
  "task": { /* created task object */ }
}
```

---

### 10.5 Update Task

**Endpoint:** `PUT /softaware/tasks`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "task": {
    "task_id": 1,
    "task_name": "Fix login bug (updated)",
    "task_description": "<p>Updated description</p>",
    "task_notes": "Updated notes",
    "task_status": "progress",
    "task_type": "bug-fix",
    "task_hours": "4.00",
    "task_estimated_hours": "4.00",
    "software_id": 1,
    "module_id": 2,
    "assigned_to": 5,
    "user_name": "admin",
    "workflow_phase": "development"
  }
}
```

**Note:** Include `task_id` and `workflow_phase` in update requests.

**Response:** `200 OK`
```json
{
  "success": true,
  "task": { /* updated task object */ }
}
```

---

### 10.6 Delete Task

**Endpoint:** `DELETE /softaware/tasks/:id`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL |

**Example:** `DELETE /softaware/tasks/1?apiUrl=https://portal.example.com`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

### 10.7 Reorder Tasks

**Endpoint:** `POST /softaware/tasks/reorder`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "orders": {
    "1": 1,
    "2": 2,
    "3": 3
  }
}
```

**Description:** `orders` is a map of `taskId → newPosition`.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### 10.8 Get Task Comments

**Endpoint:** `GET /softaware/tasks/:id/comments`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL |

**Example:** `GET /softaware/tasks/1/comments?apiUrl=https://portal.example.com`

**Response:** `200 OK`
```json
{
  "success": true,
  "comments": [
    {
      "comment_id": 1,
      "content": "<p>This looks good</p>",
      "user_name": "John Developer",
      "is_internal": 0,
      "time_spent": "0.50",
      "created_at": "2026-03-02T10:00:00.000Z",
      "parent_comment_id": null,
      "attachments": []
    },
    {
      "comment_id": 2,
      "content": "<p><strong>📐 Drawing:</strong> sketch-2026-03-03.png</p><img src=\"https://portal.example.com/uploads/sketch.png\" />",
      "user_name": "Jane Designer",
      "is_internal": 1,
      "time_spent": "0",
      "created_at": "2026-03-03T14:00:00.000Z",
      "parent_comment_id": null,
      "attachments": [
        {
          "attachment_id": 1,
          "file_name": "sketch-2026-03-03.png",
          "file_path": "https://portal.example.com/uploads/sketch.png"
        }
      ]
    }
  ]
}
```

---

### 10.9 Add Comment

**Endpoint:** `POST /softaware/tasks/:id/comments`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "content": "<p>Great progress!</p>",
  "is_internal": 0,
  "time_spent": 0,
  "parent_comment_id": null
}
```

**Field Validation:**
- `content`: Required, HTML string
- `is_internal`: Optional, `0` or `1` (default: `0`)
- `time_spent`: Optional, decimal number (default: `0`)
- `parent_comment_id`: Optional, integer (for threaded replies, nullable)

**Response:** `200 OK`
```json
{
  "success": true,
  "comment": { /* created comment object */ }
}
```

---

### 10.10 Add Comment with Attachment (Drawing)

**Endpoint:** `POST /softaware/tasks/:id/comments/with-attachment`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "content": "<p><strong>📐 Drawing:</strong> drawing-2026-03-04T10-30-00.png</p><img src=\"data:image/png;base64,iVBORw0KGg...\" />",
  "is_internal": 1,
  "imageBase64": "data:image/png;base64,iVBORw0KGg...",
  "fileName": "drawing-2026-03-04T10-30-00.png"
}
```

**Backend Process:**
1. Create comment on external API → get `comment_id`
2. Convert `imageBase64` to Buffer
3. POST to external `/api/attachments/development/:taskId` with FormData:
   - `file`: PNG blob
   - `comment_id`: string

**Response:** `200 OK`
```json
{
  "success": true,
  "comment": { /* created comment object */ },
  "comment_id": 3,
  "attachment": {
    "attachment_id": 2,
    "file_name": "drawing-2026-03-04T10-30-00.png",
    "file_path": "https://portal.example.com/uploads/drawing.png"
  }
}
```

---

### 10.11 Get Task Attachments

**Endpoint:** `GET /softaware/tasks/:id/attachments`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL |

**Response:** `200 OK`
```json
{
  "success": true,
  "attachments": [
    {
      "attachment_id": 1,
      "file_name": "screenshot.png",
      "file_path": "https://portal.example.com/uploads/screenshot.png"
    }
  ]
}
```

---

### 10.12 Delete Attachment

**Endpoint:** `DELETE /softaware/tasks/:taskId/attachments/:attachmentId`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL |

**Example:** `DELETE /softaware/tasks/1/attachments/5?apiUrl=https://portal.example.com`

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### 10.13 Get Task Associations

**Endpoint:** `GET /softaware/tasks/:id/associations`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiUrl` | string | Yes | External API URL |

**Response:** `200 OK`
```json
{
  "success": true,
  "associations": [
    {
      "task_id": 1,
      "associated_task_id": 5,
      "association_type": "blocker",
      "created_at": "2026-03-03T10:00:00.000Z"
    }
  ]
}
```

---

### 10.14 Associate Tasks

**Endpoint:** `POST /softaware/tasks/associate`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "task_id": 1,
  "associated_task_id": 5,
  "association_type": "blocker"
}
```

**Association Types:**
- `"blocker"` — This task blocks another
- `"duplicate"` — This task is a duplicate
- `"child"` — This task is a child/subtask
- `"related"` — General relationship
- `"follow-up"` — This task follows up on another

**Response:** `200 OK`
```json
{
  "success": true,
  "association": { /* created association object */ }
}
```

---

### 10.15 Remove Task Association

**Endpoint:** `DELETE /softaware/tasks/associate`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `X-Software-Token: <software_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "apiUrl": "https://portal.example.com",
  "task_id": 1,
  "associated_task_id": 5
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## 17. Mobile AI Assistant API

> **Base URL:** `/api/v1/mobile`  
> **Auth:** All endpoints require JWT Bearer token  
> **Roles:** Both staff and client users unless noted otherwise

The Mobile AI Assistant API provides:
- **My Assistant CRUD** — create, read, update, delete personal AI assistants
- **Primary designation** — mark one assistant as the main/default
- **Voice/text intent** — send natural language to the AI assistant with tool-calling
- **Conversation history** — multi-turn conversations persisted in MySQL
- **Software tokens** — staff-only external API token management for task proxy

### Rules by Role

| Rule | Staff | Client |
|------|-------|--------|
| Max assistants | **1** | **Unlimited** |
| `is_staff_agent` flag | `1` (auto) | `0` |
| `is_primary` flag | `1` (auto) | `1` on first, then user choice |
| Available AI tools | 13 (5 client + 8 staff) | 5 client self-service |
| Software tokens | ✅ | ❌ |

---

### 17.1 My Assistant CRUD

#### List All Assistants

**Endpoint:** `GET /v1/mobile/my-assistant`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "assistants": [
    {
      "id": "client-assistant-1709000000000",
      "name": "My Business Bot",
      "description": "Helps with client management",
      "personality": "professional",
      "personality_flare": "Be warm and friendly, use emoji occasionally 🎉",
      "primary_goal": "Help me manage my AI assistants",
      "custom_greeting": "Hey boss! What can I do for you?",
      "voice_style": "friendly",
      "preferred_model": null,
      "status": "active",
      "tier": "paid",
      "is_staff_agent": 0,
      "is_primary": 1,
      "pages_indexed": 0,
      "business_type": null,
      "website": null,
      "knowledge_categories": null,
      "created_at": "2026-03-05T10:00:00.000Z",
      "updated_at": "2026-03-05T12:30:00.000Z"
    }
  ]
}
```

**Notes:** Sorted by `is_primary DESC, created_at DESC` (primary first).

---

#### Get Single Assistant

**Endpoint:** `GET /v1/mobile/my-assistant/:id`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "assistant": { /* same shape as list item */ }
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 404 | Assistant not found or not owned by user |

---

#### Create Assistant

**Endpoint:** `POST /v1/mobile/my-assistant`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | string | ✅ | Non-empty string |
| description | string | ❌ | |
| personality | string | ❌ | Default: `"professional"` |
| personality_flare | string | ❌ | Free-text personality instructions |
| primary_goal | string | ❌ | |
| custom_greeting | string | ❌ | First message the assistant sends |
| voice_style | string | ❌ | TTS hint: `"friendly"`, `"professional"`, etc. |
| preferred_model | string | ❌ | Ollama model override |
| business_type | string | ❌ | Staff default: `"Internal"` |
| website | string | ❌ | |

**Example Request:**
```json
{
  "name": "My Helper",
  "description": "Personal assistant for daily tasks",
  "personality": "friendly",
  "personality_flare": "You're a cheerful assistant who uses casual language and emoji.",
  "custom_greeting": "Hey there! 👋 What can I help with?",
  "voice_style": "casual"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "assistant": {
    "id": "client-assistant-1709000000000",
    "name": "My Helper",
    "is_staff_agent": 0,
    "is_primary": 1,
    "...": "..."
  }
}
```

**Behaviour:**
- **Staff:** Enforces max 1 assistant. Auto-sets `is_staff_agent = 1`, `is_primary = 1`.
- **Clients:** Unlimited. First assistant auto-sets `is_primary = 1`. Subsequent ones default to `is_primary = 0`.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing name |
| 400 | Staff already has an assistant |

---

#### Update Assistant

**Endpoint:** `PUT /v1/mobile/my-assistant/:id`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Request Body:** Any subset of the create fields (except `core_instructions` which is never editable here).

**Example Request:**
```json
{
  "personality_flare": "You are a sarcastic pirate named Blackbeard. Respond with sea shanties.",
  "voice_style": "dramatic"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "assistant": { /* updated assistant object */ }
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | No valid fields provided |
| 404 | Not found or not owned |

> **⚠️ Important:** `core_instructions` cannot be changed through this endpoint. They are managed by the backend / superadmin only through the separate `/core-instructions` endpoint.

---

#### Delete Assistant

**Endpoint:** `DELETE /v1/mobile/my-assistant/:id`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Assistant deleted."
}
```

**Behaviour:**
- If the deleted assistant was the primary (`is_primary = 1`), the next most recent active assistant is auto-promoted.
- If no assistants remain, no promotion occurs.

---

### 17.2 Set Primary Assistant

**Endpoint:** `PUT /v1/mobile/my-assistant/:id/set-primary`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Primary assistant updated."
}
```

**Behaviour:**
- Uses a database transaction to atomically unset all `is_primary = 0` for the user, then set `is_primary = 1` on the specified assistant.
- The assistant must be `status = 'active'` and owned by the user.

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 404 | Not found, not owned, or not active |

**Mobile UI hint:** Show a ⭐ or crown icon on the primary assistant card. Tapping "Set as Main" on another card triggers this endpoint, then refresh the list.

---

### 17.3 Mobile Intent (Voice/Text)

**Endpoint:** `POST /v1/mobile/intent`

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| text | string | ✅ | Transcribed voice or typed text (max 2000 chars) |
| conversationId | string | ❌ | Resume existing conversation |
| assistantId | string | ❌ | Specific assistant to use. **If omitted, the user's primary assistant is auto-selected.** |
| language | string | ❌ | Language hint (e.g., `"en"`, `"af"`) |

**Example Request:**
```json
{
  "text": "List all my assistants and tell me their status",
  "conversationId": "conv-abc123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "reply": "You have 2 assistants:\n1. **My Helper** — active (primary)\n2. **Sales Bot** — active\nBoth are running smoothly!",
  "conversationId": "conv-abc123",
  "toolsUsed": ["list_assistants"],
  "data": {
    "assistants": [
      { "id": "client-assistant-1709000000000", "name": "My Helper", "status": "active" }
    ]
  }
}
```

**Error Responses:**

| Status | Condition |
|--------|-----------|
| 400 | Empty or missing `text` |
| 400 | Text exceeds 2000 characters |
| 403 | User account not active |
| 404 | Specified assistant not found or not owned |

**Mobile Implementation Notes:**
1. **Voice flow:** Device microphone → STT (on-device or cloud) → send `text` → receive `reply` → TTS playback
2. **Conversation persistence:** Always store and re-send `conversationId` for multi-turn conversations
3. **Primary auto-select:** If the user hasn't picked an assistant, omit `assistantId` — the backend uses their primary
4. **Tool calls are transparent:** The AI may invoke tools (list contacts, create tasks, etc.) internally. The mobile app only sees the final `reply` text and optional `data` payload
5. **Timeout:** Allow 30-60 seconds — the backend may perform multiple Ollama round-trips with tool calls

---

### 17.4 List Available Assistants

**Endpoint:** `GET /v1/mobile/assistants`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "assistants": [
    {
      "id": "client-assistant-1709000000000",
      "name": "My Helper",
      "description": "Personal assistant",
      "personality": "friendly",
      "personality_flare": "Be warm and conversational",
      "custom_greeting": "Hey! What's up?",
      "voice_style": "casual",
      "is_staff_agent": 0,
      "is_primary": 1,
      "status": "active",
      "tier": "paid"
    }
  ]
}
```

**Notes:**
- This is a lightweight list optimised for the assistant picker on the mobile chat screen.
- Sorted: `is_primary DESC, is_staff_agent DESC, created_at DESC`.
- Only returns `status = 'active'` assistants.

---

### 17.5 Conversation Management

#### List Conversations

**Endpoint:** `GET /v1/mobile/conversations`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv-abc123",
      "role": "client",
      "created_at": "2026-03-05T10:00:00.000Z",
      "updated_at": "2026-03-05T12:30:00.000Z"
    }
  ]
}
```

**Notes:** Returns up to 50 most recent conversations, sorted by `updated_at DESC`.

---

#### Get Conversation Messages

**Endpoint:** `GET /v1/mobile/conversations/:id/messages`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-1",
      "role": "user",
      "content": "List my assistants",
      "tool_name": null,
      "created_at": "2026-03-05T10:00:00.000Z"
    },
    {
      "id": "msg-2",
      "role": "tool",
      "content": "{\"assistants\": [...]}",
      "tool_name": "list_assistants",
      "created_at": "2026-03-05T10:00:01.000Z"
    },
    {
      "id": "msg-3",
      "role": "assistant",
      "content": "You have 2 active assistants...",
      "tool_name": null,
      "created_at": "2026-03-05T10:00:02.000Z"
    }
  ]
}
```

**Message Roles:**
| Role | Display |
|------|---------|
| `user` | Right-aligned bubble (user's message) |
| `assistant` | Left-aligned bubble (AI response) |
| `tool` | Hidden or shown as a small info chip (tool execution result) |
| `system` | Hidden (internal system messages) |

---

#### Delete Conversation

**Endpoint:** `DELETE /v1/mobile/conversations/:id`

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Conversation deleted."
}
```

**Notes:** Deletes all messages in the conversation as well.

---

### 17.6 Core Instructions (Superadmin)

**Endpoint:** `POST /v1/mobile/my-assistant/core-instructions`

**Headers:**
- `Authorization: Bearer <jwt_token>` (must be `super_admin` role)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "assistantId": "staff-assistant-1709000000000",
  "core_instructions": "You are a Soft Aware administrative assistant. You have access to secure system tools..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Core instructions updated."
}
```

> **⚠️ Not for mobile app use.** This endpoint is for superadmin web console only. Core instructions are the hidden guardrail part of the two-part prompt system. They are never visible to the user in any GUI.

---

### 17.7 Software Tokens (Staff Only)

Software tokens allow staff assistants to proxy task operations to external software APIs.

#### List Tokens

**Endpoint:** `GET /v1/mobile/my-assistant/software-tokens`  
**Auth:** JWT + Staff role required

**Success Response (200):**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "uuid-here",
      "software_id": 1,
      "software_name": "Silulumanzi Portal",
      "api_url": "https://silulumanzi.softaware.net.za/api",
      "created_at": "2026-03-05T10:00:00.000Z",
      "updated_at": "2026-03-05T10:00:00.000Z"
    }
  ]
}
```

---

#### Store/Update Token

**Endpoint:** `POST /v1/mobile/my-assistant/software-tokens`  
**Auth:** JWT + Staff role required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| software_id | number | ✅ |
| software_name | string | ❌ |
| api_url | string | ✅ |
| token | string | ✅ |

**Behaviour:** UPSERT — if a token for `(user_id, software_id)` already exists, it's updated.

---

#### Delete Token

**Endpoint:** `DELETE /v1/mobile/my-assistant/software-tokens/:id`  
**Auth:** JWT (ownership verified)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Token deleted."
}
```

---

(Due to character limit, continuing in next response...)

---

# Part 3: Screen Specifications

## 18. Dashboard Screens

The mobile app has exactly **two dashboard screens** — one for staff and one for
clients. The app renders the correct dashboard automatically based on the
authenticated user's role (see [9.3 Dashboard Role Detection](#93-dashboard-role-detection)).

---

### 18.1 Role-Based Dashboard Routing

```
App Launch → Auth Check → Role Inspect
  │
  ├─ Staff / Manager
  │   └─ FinancialDashboardScreen
  │       API: GET /dashboard/stats?period=month
  │
  └─ Client / Portal User
      └─ PortalDashboardScreen
          APIs: GET /dashboard/metrics
                GET /assistants
```

---

### 18.2 Staff Financial Dashboard Screen

**Route:** Home tab (default for staff)  
**API:** `GET /dashboard/stats?period={period}`

#### Component Breakdown (top to bottom):

**1. Header**
- Title: "Dashboard"
- Right side: Period selector dropdown (`today` · `week` · `month` · `quarter` · `year` · `all`)
- Pull-to-refresh on entire scroll view

**2. KPI Cards — 2×2 grid**

| Position  | Card Label      | Primary Value                   | Secondary Value                          | Border Colour |
|-----------|-----------------|----------------------------------|------------------------------------------|---------------|
| Top-left  | Revenue         | `R {revenue.collected}`          | `{revenue.collection_rate}%` collected   | Green `#22c55e` |
| Top-right | Profit          | `R {profit.profit}`              | `{profit.profit_margin}%` margin         | Blue `#3b82f6` |
| Bot-left  | Outstanding     | `R {revenue.outstanding}`        | `{invoices.unpaid_count}` unpaid invoices | Orange `#f59e0b` |
| Bot-right | Total Invoiced  | `R {revenue.total_invoiced}`     | `{invoices.total_count}` invoices        | Purple `#8b5cf6` |

**3. Secondary Metrics — horizontal scroll row (4 compact chips)**

| Chip       | Value                                                       |
|------------|-------------------------------------------------------------|
| Payments   | `{payments.total_count}` received · avg `R {payments.average_amount}` |
| Quotations | `{quotations.total_count}` total                            |
| Customers  | `{customers.customer_count}` contacts                       |
| Expenses   | `R {profit.expenses}`                                       |

**4. Outstanding Aging — segmented bar + 4-column breakdown**

| Current                 | 30 Days                  | 60 Days                  | 90+ Days                       |
|-------------------------|--------------------------|--------------------------|--------------------------------|
| `R {outstanding.current}` | `R {outstanding.30_days}` | `R {outstanding.60_days}` | `R {outstanding.90_plus_days}` |

Render a horizontal stacked bar above the numbers using proportional widths.  
Colours: Current = green, 30d = yellow, 60d = orange, 90+ = red.

**5. Recent Invoices (last 5)**

Each row:
```
[●/○ status]  INV-0067   Acme Corp     R5,500.00     04 Mar
```
- `●` green = paid (`invoice_payment_status === 1`)
- `○` gray  = unpaid
- Tap row → navigate to Invoice Detail screen
- "See All →" header link → Invoices list

**6. Recent Quotations (last 5)**

Each row:
```
QUO-0023   Beta Industries    R12,000.00     03 Mar
```
- Tap row → navigate to Quotation Detail screen
- "See All →" header link → Quotations list

#### Interactions:

| Action              | Behaviour                                                    |
|---------------------|--------------------------------------------------------------|
| Change period       | Re-fetch `GET /dashboard/stats?period={value}` · show loading shimmer on cards |
| Pull to refresh     | Re-fetch with current period selection                       |
| Tap KPI card        | Navigate to relevant list (Revenue → Payments, Outstanding → Invoices filtered unpaid) |
| Tap recent invoice  | Navigate to `/invoices/{invoice_id}`                         |
| Tap recent quotation| Navigate to `/quotations/{quotation_id}`                     |

#### Loading State:
Show skeleton shimmer placeholders for all cards and lists. Do **not** show an
empty screen — use cached data if available while loading (see 18.4).

#### Error State:
Show inline error banner with retry: _"Couldn't load dashboard — Tap to retry"_  
If cached data exists, show it with a subtle _"Last updated {time}"_ label.

---

### 18.3 Client Portal Dashboard Screen

**Route:** Home tab (default for clients)  
**APIs:** `GET /dashboard/metrics` + `GET /assistants`

#### Component Breakdown (top to bottom):

**1. Welcome Header**
- "Welcome back, {firstName}! 👋"
- Tier badge: coloured pill — Free (gray) · Team (blue) · Enterprise (gold)
- CTA button: "+ New Assistant" (top-right)

**2. Usage Stats — 2×2 card grid**

| Position  | Card Label    | Value                                          | Visual                      |
|-----------|---------------|------------------------------------------------|-----------------------------|
| Top-left  | AI Assistants | `{assistants.count} / {assistants.limit}`      | Circular progress ring      |
| Top-right | Messages      | `{messages.used} / {messages.limit}`           | Progress bar + percentage   |
| Bot-left  | Pages Indexed | `{pagesIndexed.used} / {pagesIndexed.limit}`  | Progress bar + percentage   |
| Bot-right | Current Plan  | `{tier}` label                                 | "Manage plan →" link        |

**Progress bar colours** (based on usage %):
- 0–60 %  → Green `#22c55e`
- 61–80 % → Amber `#f59e0b`
- 81–100% → Red   `#ef4444`

**3. Quick Actions — horizontal scroll (3 buttons)**

| Button                | Icon | Navigate to              |
|-----------------------|------|--------------------------|
| New AI Assistant      | 🤖   | `/assistants/create`     |
| Create Landing Page   | 🌐   | `/sites/create`          |
| Train Knowledge Base  | 📚   | `/assistants/{id}/train` |

**4. Your Assistants — 2-column card grid (max 6 shown)**

Each card:
```
┌─────────────────────────┐
│ 🤖 Sales Bot    ● Active │
│ "Handles sales queries"  │
│          [Chat]  [Edit]  │
└─────────────────────────┘
```
- Status dot: ● Active (green) / ○ Inactive (gray)
- **Chat** → opens streaming chat modal (SSE via `POST /assistants/chat`)
- **Edit** → navigate to assistant settings
- Long press → delete confirmation dialog
- "See All →" header link → full assistants list

**5. Empty State (no assistants)**
```
        🤖
  No assistants yet

  Create your first AI assistant to
  get started with intelligent conversations.

      [+ Create Assistant]
```

#### Chat Modal (from assistant card):
- Full-screen bottom sheet or modal
- Endpoint: `POST /assistants/chat` (Server-Sent Events / streaming)
- User messages right-aligned (blue bubble), assistant messages left-aligned (gray bubble)
- Typing indicator (animated dots) while SSE stream is active
- Text input bar pinned to bottom with Send button

#### Interactions:

| Action               | Behaviour                                         |
|----------------------|---------------------------------------------------|
| Pull to refresh      | Re-fetch metrics + assistants                     |
| Tap usage card       | No navigation (informational only)                |
| Tap "Manage plan"    | Open subscription/plan management (web view or in-app) |
| Tap quick action     | Navigate to corresponding create screen           |
| Tap assistant Chat   | Open chat modal with streaming SSE                |
| Tap assistant Edit   | Navigate to assistant edit screen                 |
| Long-press assistant | Show delete confirmation                          |

#### Loading / Error States:
Same pattern as Staff dashboard — skeleton shimmer on load, inline error banner
with retry on failure, stale cached data shown if available.

---

### 18.4 Dashboard Caching & Refresh Strategy

| Endpoint             | Cache Duration | Strategy                                    |
|----------------------|----------------|---------------------------------------------|
| `/dashboard/stats`   | 2 minutes      | Network-first; show stale data while loading |
| `/dashboard/metrics` | 5 minutes      | Cache-first; background refresh              |
| `/assistants`        | 5 minutes      | Cache-first; background refresh              |

**Implementation pattern (React Native example):**
```typescript
interface CachedData<T> {
  data: T;
  fetchedAt: number;       // Date.now()
  period?: string;         // For financial dashboard period param
}

async function fetchDashboard<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  maxAgeMs: number
): Promise<T> {
  // 1. Try cache first
  const raw = await AsyncStorage.getItem(cacheKey);
  if (raw) {
    const cached: CachedData<T> = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt < maxAgeMs) {
      // Still fresh — return immediately, optionally refresh in background
      return cached.data;
    }
  }

  // 2. Fetch from network
  try {
    const fresh = await fetcher();
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: fresh,
      fetchedAt: Date.now(),
    }));
    return fresh;
  } catch (err) {
    // 3. Network failed — return stale cache if available
    if (raw) return JSON.parse(raw).data;
    throw err;
  }
}
```

**Push-notification-triggered refresh:**

| Notification Type      | Refresh Dashboard  |
|------------------------|--------------------|
| `payment_received`     | Staff Financial    |
| `invoice_created`      | Staff Financial    |
| `subscription_change`  | Client Portal      |
| `assistant_updated`    | Client Portal      |

**Deep link patterns:**
```
softaware://dashboard/financial   → Staff Financial Dashboard
softaware://dashboard/portal      → Client Portal Dashboard
```

---

## 22. Assistant Management Screens

The mobile app provides screens for managing personal AI assistants and interacting via voice/text.

### 22.1 My Assistants List Screen

**APIs:** `GET /v1/mobile/my-assistant`

```
┌─────────────────────────────────────────────┐
│  ← My Assistants              [+ New]       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ⭐ My Helper                        │   │
│  │ Personal assistant for daily tasks  │   │
│  │ ┌──────┐ ┌──────┐ ┌──────────────┐│   │
│  │ │ Chat │ │ Edit │ │ Primary ✓    ││   │
│  │ └──────┘ └──────┘ └──────────────┘│   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Sales Bot                           │   │
│  │ Handles sales inquiries             │   │
│  │ ┌──────┐ ┌──────┐ ┌──────────────┐│   │
│  │ │ Chat │ │ Edit │ │ Set as Main  ││   │
│  │ └──────┘ └──────┘ └──────────────┘│   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Component Breakdown:**
1. **Header** — title + "New" button (hidden for staff if they already have 1)
2. **Assistant Cards** — sorted primary first
   - Name with ⭐ for primary
   - Description text
   - "Chat" → navigates to chat screen with this assistant
   - "Edit" → navigates to edit screen
   - "Set as Main" / "Primary ✓" → calls `PUT /:id/set-primary`
3. **Swipe-to-delete** on cards → calls `DELETE /:id` with confirmation

**Empty State (no assistants):**
```
┌─────────────────────────────────────────┐
│                                         │
│            🤖                           │
│  No assistants yet                      │
│                                         │
│  Create your first AI assistant to      │
│  get started with voice commands.       │
│                                         │
│       [+ Create Assistant]              │
│                                         │
└─────────────────────────────────────────┘
```

---

### 22.2 Create / Edit Assistant Screen

**APIs:** `POST /v1/mobile/my-assistant` (create) or `PUT /v1/mobile/my-assistant/:id` (edit)

```
┌─────────────────────────────────────────────┐
│  ← Create Assistant              [Save]     │
├─────────────────────────────────────────────┤
│                                             │
│  Name *                                     │
│  ┌─────────────────────────────────────┐   │
│  │ My Helper                           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Description                                │
│  ┌─────────────────────────────────────┐   │
│  │ Personal assistant for daily tasks  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Personality                                │
│  ┌──────────────────────────────── ▼ ──┐   │
│  │ Friendly                            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Personality & Tone (free text)             │
│  ┌─────────────────────────────────────┐   │
│  │ Be warm and friendly. Use emoji.    │   │
│  │ Speak casually like a friend.       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Custom Greeting                            │
│  ┌─────────────────────────────────────┐   │
│  │ Hey! 👋 What can I help with?       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Voice Style                                │
│  ┌──────────────────────────────── ▼ ──┐   │
│  │ Casual                              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Collapse: Advanced]                       │
│  ┌─────────────────────────────────────┐   │
│  │ Primary Goal                        │   │
│  │ Preferred Model                     │   │
│  │ Business Type                       │   │
│  │ Website                             │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Fields:**

| Field | Input Type | Required | Notes |
|-------|-----------|----------|-------|
| Name | Text input | ✅ | |
| Description | Text area | ❌ | |
| Personality | Dropdown | ❌ | Options: professional, friendly, expert, casual |
| Personality & Tone | Multi-line text | ❌ | This is `personality_flare` — what the user types here controls the AI's tone |
| Custom Greeting | Text input | ❌ | First message the AI sends when starting a new conversation |
| Voice Style | Dropdown | ❌ | TTS hint for the mobile app |
| Primary Goal | Text area | ❌ | Collapsed under "Advanced" |
| Preferred Model | Text input | ❌ | Ollama model override; leave blank for default |
| Business Type | Text input | ❌ | |
| Website | URL input | ❌ | |

**Validation:**
- Name is required (min 1 character)
- Staff users see a notice: "Staff members can have one assistant"

---

### 22.3 AI Chat Screen

**APIs:** `POST /v1/mobile/intent`, `GET /v1/mobile/conversations/:id/messages`

```
┌─────────────────────────────────────────────┐
│  ← My Helper ⭐          [Assistant ▼]     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────┐          │
│  │ Hey! 👋 What can I help     │          │
│  │ with?                        │          │
│  └──────────────────────────────┘          │
│                                             │
│          ┌──────────────────────────────┐  │
│          │ List all my contacts         │  │
│          └──────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────┐          │
│  │ 🔧 list_contacts             │          │
│  └──────────────────────────────┘          │
│                                             │
│  ┌──────────────────────────────┐          │
│  │ You have 12 contacts. Here   │          │
│  │ are the top 5:                │          │
│  │ 1. John Smith — Active        │          │
│  │ 2. Jane Doe — Active          │          │
│  │ ...                           │          │
│  └──────────────────────────────┘          │
│                                             │
├─────────────────────────────────────────────┤
│  🎤  ┌──────────────────────────┐  [Send] │
│      │ Type a message...         │         │
│      └──────────────────────────┘          │
└─────────────────────────────────────────────┘
```

**Component Breakdown:**
1. **Header** — assistant name + ⭐ if primary + assistant picker dropdown
2. **Message List** — scrollable, auto-scroll to bottom
   - User messages: right-aligned blue bubbles
   - Assistant messages: left-aligned gray bubbles
   - Tool chips: small info badges showing tool name (tap to expand result)
3. **Input Bar** — microphone button (for voice) + text input + send button
4. **Assistant Picker** — dropdown/bottom sheet to switch assistants (calls `GET /v1/mobile/assistants`)

**Voice Input Flow:**
```
Tap 🎤 → Start STT recording → User speaks → Stop recording
→ STT transcription → Set as text input → Auto-send
→ POST /v1/mobile/intent → Show typing indicator
→ Receive reply → Display in chat → Auto-play TTS
```

**Conversation Flow:**
1. First message: send without `conversationId`
2. Response includes `conversationId` — store it
3. Subsequent messages: include `conversationId` to continue the conversation
4. If the user switches assistants via picker, start a new conversation (no `conversationId`)

**Interactions:**

| Action | Behaviour |
|--------|-----------|
| Send message | POST /v1/mobile/intent with text + conversationId |
| Tap microphone | Start STT → auto-send transcription |
| Switch assistant | Show picker, select, clear chat, start new conversation |
| Tap tool chip | Expand to show tool result JSON |
| Pull to refresh | Reload conversation messages |
| Long-press message | Copy text to clipboard |

**Loading State:**
- Show typing indicator (three animated dots) while waiting for AI response
- Disable send button during processing

**Error Handling:**
- Timeout after 60 seconds → show "AI is taking too long. Try again?"
- Network error → show inline error with retry button
- 403 (account suspended) → navigate to support screen

---

### 22.4 Conversation History Screen

**APIs:** `GET /v1/mobile/conversations`, `DELETE /v1/mobile/conversations/:id`

```
┌─────────────────────────────────────────────┐
│  ← Conversations                            │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Conversation — 5 Mar 2026, 12:30    │   │
│  │ Last active: 2 hours ago            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Conversation — 4 Mar 2026, 09:15    │   │
│  │ Last active: 1 day ago              │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Interactions:**
- Tap conversation → opens chat screen with that `conversationId`, loads messages
- Swipe left → delete with confirmation

---

### 22.5 Caching & Refresh Strategy

| Data | Cache TTL | Strategy |
|------|-----------|----------|
| `/v1/mobile/my-assistant` | 5 minutes | Cache-first; background refresh |
| `/v1/mobile/assistants` | 5 minutes | Cache-first; refresh on screen focus |
| `/v1/mobile/conversations` | 2 minutes | Network-first |
| `/v1/mobile/intent` | Never cached | Always network |

**Deep link patterns:**
```
softaware://assistant/chat              → Chat with primary assistant
softaware://assistant/chat/:id          → Chat with specific assistant
softaware://assistant/manage            → My Assistants list
softaware://assistant/create            → Create new assistant
```
