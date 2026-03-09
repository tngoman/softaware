# Notifications — Field & Data Dictionary

## Database Schema

### `notifications` Table
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Notification ID |
| `user_id` | `VARCHAR` (FK) | No | — | Target user |
| `title` | `VARCHAR` | No | — | Notification heading |
| `message` | `TEXT` | No | — | Notification body (may contain HTML) |
| `type` | `ENUM` | No | `'info'` | One of: `info`, `success`, `warning`, `error` |
| `data` | `JSON` | Yes | `NULL` | Arbitrary JSON payload (e.g., `{ action_url: "/..." }`) |
| `read_at` | `DATETIME` | Yes | `NULL` | When read; NULL = unread |
| `created_at` | `DATETIME` | No | `NOW()` | Creation timestamp |

### `fcm_tokens` Table
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Token record ID |
| `user_id` | `VARCHAR` (FK) | No | — | Owning user |
| `token` | `VARCHAR` (UNIQUE) | No | — | FCM device token string |
| `device_name` | `VARCHAR` | Yes | `NULL` | Friendly name (e.g., "Chrome Browser") |
| `platform` | `ENUM` | Yes | `NULL` | `android`, `ios`, or `web` |
| `created_at` | `DATETIME` | No | — | Registration timestamp |
| `updated_at` | `DATETIME` | No | — | Last update (refreshed on re-register) |

---

## API Request/Response Schemas

### `POST /notifications` — Create Notification
**Request body** (Zod-validated):
| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `user_id` | `string` | No | Authenticated user | Target user ID |
| `title` | `string` | Yes | — | `min(1)` |
| `message` | `string` | Yes | — | `min(1)` |
| `type` | `string` | No | `'info'` | `enum('info', 'success', 'warning', 'error')` |
| `send_push` | `boolean` | No | `true` | Whether to also send push notification |

**Response**:
```json
{ "success": true, "message": "Notification created" }
```

---

### `GET /notifications` — List Notifications
**Query parameters**:
| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `limit` | `number` | `50` | `100` | Number of notifications to return |
| `unread` | `string` | — | — | If `'true'`, return only unread |

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "uuid",
      "title": "Welcome!",
      "message": "Your account has been created.",
      "type": "info",
      "data": null,
      "read_at": null,
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "unread_count": 5
}
```

---

### `GET /notifications/unread/count` — Unread Count
**Response**:
```json
{ "success": true, "data": { "count": 5 } }
```

---

### `PUT /notifications/:id/read` — Mark as Read
**Path params**: `id` (notification ID)
**Response**:
```json
{ "success": true, "message": "Notification marked as read" }
```

---

### `PUT /notifications/read-all` — Mark All Read
**Response**:
```json
{ "success": true, "message": "All notifications marked as read" }
```

---

### `DELETE /notifications/:id` — Delete Notification
**Path params**: `id` (notification ID)
**Response**:
```json
{ "success": true, "message": "Notification deleted" }
```

---

### `POST /notifications/test-push` — Test Push
**Response**:
```json
{
  "success": true,
  "message": "Test push sent. 1 delivered, 0 failed.",
  "data": { "sent": 1, "failed": 0 }
}
```

---

### `POST /fcm-tokens` — Register Device
**Request body** (Zod-validated):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `token` | `string` | Yes | `min(1)` |
| `device_name` | `string` | No | — |
| `platform` | `string` | No | `enum('android', 'ios', 'web')` |

**Response**:
```json
{ "success": true, "message": "Device registered for push notifications." }
```

---

### `GET /fcm-tokens` — List Devices
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "token": "fcm_token_string...",
      "device_name": "Chrome Browser",
      "platform": "web",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "fcm_enabled": true
}
```

---

### `DELETE /fcm-tokens/:token` — Unregister Device
**Path params**: `token` (URL-encoded FCM token)
**Response**:
```json
{ "success": true, "message": "Device unregistered from push notifications." }
```

---

### `GET /fcm-tokens/status` — FCM Status
**Response**:
```json
{ "success": true, "data": { "fcm_enabled": true } }
```

---

## Frontend TypeScript Interfaces

### `Notification` (from `NotificationModel.ts`)
```typescript
interface Notification {
  id: number;
  user_id: number;
  type: string;           // 'info' | 'success' | 'warning' | 'error'
  title: string;
  message: string;
  data?: any;             // JSON payload, may contain action_url
  read_at?: string;       // ISO date string or undefined
  created_at: string;
  updated_at: string;
}
```

### `DashboardMetrics` (Portal — uses notification count)
```typescript
// No direct notification type — unread count is fetched independently
```

### `PushPayload` (from `firebaseService.ts`)
```typescript
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}
```

---

## Frontend State

### Notifications.tsx (Full Page)
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `notifications` | `Notification[]` | `[]` | Current page of notifications |
| `loading` | `boolean` | `true` | Fetching state |
| `pagination` | `object` | `{ page:1, per_page:20, total:0, total_pages:0 }` | Client-side pagination state |

### NotificationDropdown.tsx
| State | Type | Default | Description |
|-------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Dropdown visibility |
| `notifications` | `Notification[]` | `[]` | Latest 5 notifications |
| `unreadCount` | `number` | `0` | Badge count |
| `loading` | `boolean` | `false` | Fetching state |

### Push Notification (localStorage)
| Key | Value | Description |
|-----|-------|-------------|
| `fcm_device_token` | FCM token string | Stored after successful registration |

---

## Environment Variables

### Backend (Firebase Admin SDK)
| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | For push | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | For push | Service account email |
| `FIREBASE_PRIVATE_KEY` | For push | Service account private key (with `\\n` for newlines) |

### Frontend (Hardcoded in `firebase.ts`)
| Config | Value |
|--------|-------|
| `apiKey` | `AIzaSyCvMx3rJgu5QgRU3LezBQ6lU-aoK25KsOM` |
| `projectId` | `soft-aware` |
| `messagingSenderId` | `765240677597` |
| `VAPID_KEY` | `BFOEsh3THfvgWiTDbsK5ecaDIVTXmfuJbubj_ev4x4OCfz8VB8Bl3SwjVfp8nxwRJd5hrjAs_qBaZ9EoA0Aw1WQ` |
