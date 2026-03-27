# Authentication Module - Database Schema

**Version:** 2.0.0  
**Last Updated:** 2026-03-14

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Core tables** | 2 (users, user_two_factor) |
| **Supporting tables** | 5 (user_roles, roles, role_permissions, permissions, user_pins) |
| **Email tables** | 2 (credentials — SMTP config, email_log — send history) |
| **Mobile auth tables** | 1 (mobile_auth_challenges — push-to-approve + QR auth challenges) |
| **PIN login table** | 1 (user_pins — bcrypt-hashed PINs + rate limiting, v1.9.0) |
| **Legacy tables** | 2 (teams, team_members — write-only during registration for credit scoping) |
| **Password reset table** | 1 (sys_password_resets) |

---

## 2. Core Tables

### 2.1 `users` — User Accounts

**Purpose:** Stores user credentials and profile information. Central identity table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | UUID (crypto.randomUUID) |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email address |
| name | VARCHAR(255) | | Full name (first + last) |
| phone | VARCHAR(50) | | Phone number |
| avatarUrl | VARCHAR(500) | | Profile image URL |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt hash (12 rounds) |
| isActive | TINYINT(1) | NOT NULL, DEFAULT 1 | Whether account is active |
| is_admin | TINYINT(1) | NOT NULL, DEFAULT 0 | **Direct admin flag.** `1` = administrator. Checked by `requireAdmin` middleware and all admin-gated operations. Source of truth for admin status (v1.6.0+). |
| is_staff | TINYINT(1) | NOT NULL, DEFAULT 0 | **Direct staff flag.** `1` = staff member (developer, client manager, QA, deployer). Checked by `requireDeveloper` middleware. Source of truth for staff status (v1.6.0+). |
| oauth_provider | VARCHAR(20) | NULL | **(v2.0.0)** OAuth provider name (e.g., `'google'`). NULL for password-only accounts. Auto-added by `ensureOAuthColumns()`. |
| oauth_provider_id | VARCHAR(255) | NULL | **(v2.0.0)** Provider-specific user ID (Google `sub` claim). NULL for password-only accounts. Auto-added by `ensureOAuthColumns()`. |
| account_status | ENUM('active','suspended','demo_expired') | DEFAULT 'active' | Global account status |
| createdAt | DATETIME | NOT NULL | Registration timestamp |
| updatedAt | DATETIME | NOT NULL | Last modification |

**Indexes:** PRIMARY (id), UNIQUE (email), INDEX idx_oauth (oauth_provider, oauth_provider_id) (v2.0.0)

**Relationships:**
- `user_roles.user_id → users.id` — Role assignment (authoritative)
- `user_two_factor.user_id → users.id` — 2FA configuration
- `api_keys.userId → users.id` — API key ownership
- `teams.createdByUserId → users.id` — Team creator (legacy, credit scoping only)
- `team_members.userId → users.id` — Team membership (legacy, credit scoping only)

**Business Rules:**
- Email must be unique (enforced at DB + app level)
- Password hashed with bcrypt, 12 salt rounds
- `is_admin` and `is_staff` are the **authoritative source** for admin/staff detection (v1.6.0+). All middleware (`requireAdmin`, `requireDeveloper`) and backend routes read these columns directly.
- On registration, user is assigned `viewer` role via `user_roles` (legacy team/team_members records also created for credit balance scoping). `is_admin` and `is_staff` default to `0`.
- On user create/update via admin UI, `is_admin` and `is_staff` are written directly to the users table. `user_roles` is synced for legacy compatibility.
- account_status checked by statusCheck middleware on every authenticated request
- **(v2.0.0)** `oauth_provider` and `oauth_provider_id` are set when a user signs in via Google OAuth. Existing accounts are auto-linked by email on first OAuth sign-in. New OAuth accounts get empty `passwordHash` (`''`).
- **(v2.0.0)** Columns auto-added by `ensureOAuthColumns()` on backend startup — uses `SHOW COLUMNS` check + `ALTER TABLE` if missing.

**Example Data:**

```sql
SELECT id, email, name, account_status, createdAt FROM users LIMIT 2;
-- 'a1b2c3d4-...', 'admin@softaware.co.za', 'John Doe', 'active', '2026-01-15 10:00:00'
-- 'e5f6g7h8-...', 'user@example.com', 'Jane Smith', 'active', '2026-02-20 14:30:00'
```

---

### 2.2 `user_two_factor` — Multi-Method 2FA Configuration

**Purpose:** Stores TOTP secrets, email/SMS OTP codes, preferred method, and backup codes for two-factor authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| user_id | VARCHAR(36) | FK → users.id, UNIQUE | One 2FA config per user |
| secret | VARCHAR(255) | NOT NULL | TOTP base32 secret (plaintext) |
| preferred_method | VARCHAR(10) | DEFAULT 'totp' | `'totp'`, `'email'`, or `'sms'` |
| otp_code | VARCHAR(255) | NULL | SHA-256 hash of 6-digit OTP for email/SMS verification |
| otp_expires_at | DATETIME | NULL | Expiry timestamp for email/SMS OTP (5 minutes). **Must** be set via `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` — never from JS timestamps (timezone mismatch: MySQL CET vs JS UTC) |
| is_enabled | TINYINT(1) | DEFAULT 0 | 0=setup-in-progress, 1=active |
| backup_codes | JSON | NULL | JSON array of `{ code: sha256_hex, used: boolean }`. **Note:** mysql2 auto-parses JSON columns — code must handle both string and object types |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Indexes:** PRIMARY (id), UNIQUE (user_id)

**Business Rules:**
- Secret stored during `/2fa/setup`, `is_enabled` remains 0
- `is_enabled` set to 1 only after `/2fa/verify-setup` succeeds
- `preferred_method` set during setup and changeable via `PUT /2fa/method`
- `otp_code` stores a SHA-256 hash of the OTP (not plaintext). `otp_expires_at` is set via MySQL `DATE_ADD(NOW(), INTERVAL 5 MINUTE)` — **never** from JS-computed timestamps (MySQL runs CET/UTC+1, JS produces UTC, causing 1-hour offset)
- OTP is cleared after successful verification
- Backup codes are 10 SHA-256 hashed 8-char hex strings
- Used backup codes marked `used: true` in JSON, cannot be reused
- Disabling 2FA (`/2fa/disable`) DELETEs the entire row (clients only; staff/admin blocked)
- Regenerating backup codes replaces all codes (old codes invalid)

**Example Data:**

```sql
SELECT user_id, is_enabled, 
       JSON_LENGTH(backup_codes) as code_count 
FROM user_two_factor;
-- 'a1b2c3d4-...', 1, 10
```

**Backup Codes JSON Structure:**

```json
[
  { "code": "a3f1b2c8...", "used": false },
  { "code": "d4e5f6a7...", "used": true },
  ...
]
```

---

### 2.2b `user_pins` — PIN Quick Login (v1.9.0)

**Purpose:** Stores bcrypt-hashed 4-digit PINs for quick re-authentication and rate-limiting state. One PIN per user.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| user_id | VARCHAR(36) | FK → users.id, UNIQUE, NOT NULL | One PIN per user. Uses `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` to match `users.id` collation. |
| pin_hash | VARCHAR(255) | NOT NULL | bcrypt hash (10 rounds) of the 4-digit PIN |
| failed_attempts | INT | DEFAULT 0 | Consecutive failed PIN login attempts. Resets to 0 on successful login or PIN update. |
| locked_until | DATETIME | NULL | Lockout expiry timestamp. Set to `DATE_ADD(NOW(), INTERVAL 15 MINUTE)` when `failed_attempts` reaches 5. NULL when not locked. |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Indexes:** PRIMARY (id), UNIQUE (user_id)

**Relationships:**
- `user_pins.user_id → users.id` — ON DELETE CASCADE

**Business Rules:**
- PIN is hashed with bcrypt (10 salt rounds) — lower than password (12) because PINs are only 4 digits and rate-limited
- 5 consecutive failed PIN attempts trigger a 15-minute lockout
- Successful PIN login resets `failed_attempts` to 0 and `locked_until` to NULL
- Setting a new PIN (UPSERT) also resets the rate-limit counter
- `GET /auth/pin/check/:email` does NOT reveal whether an email exists (returns `has_pin: false` for unknown emails)
- Table auto-created by `ensurePinTable()` on backend startup
- Uses explicit `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` on `user_id` and table to match `users.id` collation (fixes MySQL 8.0 FK compatibility)

**Example Data:**

```sql
SELECT user_id, failed_attempts, locked_until, created_at FROM user_pins;
-- 'a1b2c3d4-...', 0, NULL, '2026-03-13 10:00:00'
-- 'e5f6g7h8-...', 3, NULL, '2026-03-13 11:30:00'
-- 'i9j0k1l2-...', 5, '2026-03-13 12:15:00', '2026-03-13 12:00:00'
```

---

### 2.3 `user_roles` — User-to-Role Assignment

**Purpose:** Maps users to their assigned roles (RBAC).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| user_id | VARCHAR(36) | FK → users.id | User reference |
| role_id | INT | FK → roles.id | Assigned role |

**Business Rules:**
- Users without a `user_roles` entry get fallback role `{ id: 0, name: 'Client', slug: 'client' }`
- ⚠️ **v1.6.0:** `is_admin` and `is_staff` are **no longer derived from role slugs**. They are read directly from the `users.is_admin` and `users.is_staff` columns. The `user_roles` table is now supplementary — used only for role display name and granular permission resolution.
- Legacy rule (pre-v1.6.0): `is_admin` = role slug in (`admin`, `super_admin`); `is_staff` = role slug in (`developer`, `client_manager`, `qa_specialist`, `deployer`)
- `user_roles` entries are still synced during user create/update for backward compatibility
- Collation `utf8mb4_unicode_ci` used in queries for UUID matching

**Example Query (from buildFrontendUser):**

```sql
SELECT r.id AS role_id, r.name AS role_name, r.slug AS role_slug
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ?
LIMIT 1
```

---

### 2.4 `roles` — Role Definitions

**Purpose:** Defines available roles in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Role ID |
| name | VARCHAR(255) | NOT NULL | Display name (e.g., "Admin", "Viewer") |
| slug | VARCHAR(255) | UNIQUE, NOT NULL | Machine name (e.g., "admin", "viewer", "super_admin") |

**Default Roles:**

| id | name | slug | Permissions |
|----|------|------|-------------|
| 1 | Admin | admin | Wildcard `*` |
| 2 | Viewer | viewer | Read-only (per role_permissions) |
| 3 | Super Admin | super_admin | Wildcard `*` |
| 4 | Developer | developer | Wildcard `*` (staff) |
| 5 | Client Manager | client_manager | Wildcard `*` (staff) |
| 6 | QA Specialist | qa_specialist | Wildcard `*` (staff) |
| 7 | Deployer | deployer | Wildcard `*` (staff) |
| — | Client | client | Fallback (no user_roles entry) |

---

### 2.5 `role_permissions` — Role-to-Permission Mapping

**Purpose:** Maps roles to their allowed permissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| role_id | INT | FK → roles.id | Role reference |
| permission_id | INT | FK → permissions.id | Permission reference |

**Example Query:**

```sql
SELECT p.id, p.name, p.slug
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE rp.role_id = ?
```

---

### 2.6 `permissions` — Permission Definitions

**Purpose:** Defines granular permissions (e.g., "view_invoices", "manage_users").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Permission ID |
| name | VARCHAR(255) | NOT NULL | Display name |
| slug | VARCHAR(255) | UNIQUE, NOT NULL | Machine name used in frontend `Can` component |

**Special Permission:**

| id | slug | Meaning |
|----|------|---------|
| 14 | `*` | All Access — granted to admins and staff |

---

### 2.7 `sys_password_resets` — Password Reset Tokens

**Purpose:** Stores OTP codes for password reset flow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| email | VARCHAR(255) | NOT NULL | User's email |
| token | VARCHAR(255) | NOT NULL | OTP code (6 digits) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Expiry anchor |

**Business Rules:**
- OTP valid for limited time (typically 10-15 minutes)
- Consumed on successful password reset
- Multiple requests possible (latest OTP is valid)

---

### 2.8 `credentials` — Encrypted Service Credentials (SMTP)

**Purpose:** Stores AES-256-GCM encrypted credentials for external services. Used by `emailService.ts` to store SMTP configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| service_name | VARCHAR(100) | UNIQUE, NOT NULL | Service identifier (e.g., `'SMTP'`) |
| encrypted_data | TEXT | NOT NULL | AES-256-GCM encrypted JSON (host, port, username, password, from_name, from_email, encryption) |
| iv | VARCHAR(64) | NOT NULL | Initialization vector (hex) |
| auth_tag | VARCHAR(64) | NOT NULL | GCM authentication tag (hex) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last modification |

**Business Rules:**
- `ENCRYPTION_KEY` from environment is used for AES-256-GCM encrypt/decrypt
- One row per service (UPSERT on `service_name`)
- `emailService.ts` reads the row with `service_name = 'SMTP'` and decrypts to get SMTP config
- Falls back to `SMTP_HOST`, `SMTP_PORT`, etc. env vars if no credentials row exists
- Password is masked (`••••••••`) in GET `/email/config` responses

---

### 2.9 `email_log` — Email Send History

**Purpose:** Logs all emails sent through the centralized email service for audit and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| to_email | VARCHAR(255) | NOT NULL | Recipient email address |
| subject | VARCHAR(500) | | Email subject line |
| status | ENUM('sent','failed') | NOT NULL | Delivery status |
| message_id | VARCHAR(255) | | SMTP message ID (null if failed) |
| error | TEXT | | Error message (null if sent) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Send timestamp |

**Business Rules:**
- Every call to `sendEmail()` creates a log entry regardless of success/failure
- Viewable by admins via `GET /email/logs` with pagination
- Used for debugging SMTP issues and auditing 2FA OTP delivery

---

### 2.10 `mobile_auth_challenges` — Push-to-Approve & QR Auth Challenges (v1.7.0)

**Purpose:** Stores temporary authentication challenges for mobile-initiated login flows. Supports both QR-scan authentication and push-to-approve 2FA. Created/managed by `twoFactor.ts`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(64) | PK | Challenge ID (crypto.randomBytes hex) |
| user_id | VARCHAR(36) | FK → users.id, NOT NULL | User who must approve the challenge |
| token | TEXT | NULL | Signed JWT or session data (used by QR flow) |
| status | ENUM('pending','completed','expired','denied') | DEFAULT 'pending' | Challenge state. `denied` added in v1.7.0 for push-to-approve rejection. |
| remember_me | TINYINT(1) | DEFAULT 0 | Whether the resulting JWT should use extended expiry (30 days) |
| source | ENUM('qr','push') | DEFAULT 'qr' | (v1.7.0) Distinguishes QR-scan challenges from push-to-approve challenges |
| short_code | VARCHAR(10) | NULL | (v1.8.0) 6-digit numeric code for manual entry (e.g., `482916`). Generated by `generateShortCode()` using `crypto.randomBytes()`. Displayed below QR code when scanning fails. Compatible with mobile app's 6-digit input field. |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp; challenges expire 5 minutes after creation |

**Indexes:** PRIMARY (id), INDEX (user_id)

**Business Rules:**
- Challenges expire after **5 minutes** from `created_at`
- **QR challenges** (`source = 'qr'`): Created when user scans a QR code on the web login page from the mobile app. The mobile app then calls a separate endpoint to complete the QR auth flow.
- **Push challenges** (`source = 'push'`): Created by `createPushChallenge()` during login when the user's 2FA method is TOTP and they have registered FCM devices. An FCM notification is sent to all devices.
- Only `source = 'push'` challenges can be approved/denied via `POST /auth/2fa/push-approve`
- Only the **owning user** can approve/deny (JWT userId must match `user_id`)
- Status transitions:
  - `pending` → `completed` (approved by user)
  - `pending` → `denied` (denied by user)
  - `pending` → `expired` (5-minute timeout; handled by checking `created_at`)
- `token` column stores the pre-signed JWT for QR flow; not used for push challenges
- The `remember_me` flag is carried through to the JWT issued when the challenge is completed
- Table auto-created by `ensureMobileChallengeTable()` on backend startup
- Auto-migration: if table exists without `source` column, `ALTER TABLE` adds it; if `status` ENUM doesn't include `denied`, it's extended; if `short_code` column is missing, `ALTER TABLE ADD COLUMN short_code VARCHAR(10) NULL` is run (v1.8.0)
- `short_code` is generated by `generateShortCode()` on challenge creation (both push and QR sources). Uses 6-digit numeric format (e.g., `482916`) compatible with the mobile app's numeric entry field

**Example Data:**

```sql
SELECT id, user_id, status, source, short_code, remember_me, created_at FROM mobile_auth_challenges;
-- 'a1b2c3d4...', 'user-uuid-1', 'completed', 'push', '482916', 0, '2026-03-12 10:30:00'
-- 'e5f6g7h8...', 'user-uuid-2', 'pending',   'qr',   '739205', 1, '2026-03-12 10:31:00'
-- 'i9j0k1l2...', 'user-uuid-1', 'denied',    'push', '158463', 0, '2026-03-12 10:28:00'
```

**Creation SQL:**

```sql
CREATE TABLE IF NOT EXISTS mobile_auth_challenges (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token TEXT,
  status ENUM('pending','completed','expired','denied') DEFAULT 'pending',
  remember_me TINYINT(1) DEFAULT 0,
  source ENUM('qr','push') DEFAULT 'qr',
  short_code VARCHAR(10) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 3. Table Relationships

```
users ──────────┬──── user_two_factor     (1:1 — multi-method 2FA config)
                │                ├──── mobile_auth_challenges (1:N — push/QR auth challenges, v1.7.0; short_code for manual entry, v1.8.0)
                │                ├──── user_roles ──────── roles ──── role_permissions ──── permissions
                │     (1:1)               (1:N)      (N:M)
                │                ├──── user_pins               (1:1 — PIN quick login, v1.9.0)
                │                ├──── team_members ─────── teams       ⚠️ LEGACY (credit scoping only)
                │     (N:M)                (1:N)
                │
                ├──── oauth_provider + oauth_provider_id  (columns on users — Google OAuth, v2.0.0)
                │
                └──── sys_password_resets  (1:N — reset tokens)

credentials ────── (standalone — SMTP config, AES-256-GCM encrypted)
email_log ─────── (standalone — email send history, optional FK to users)
```

---

## 4. Table Creation SQL

```sql
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  phone VARCHAR(50),
  avatarUrl VARCHAR(500),
  passwordHash VARCHAR(255) NOT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_staff TINYINT(1) NOT NULL DEFAULT 0,
  oauth_provider VARCHAR(20) NULL,
  oauth_provider_id VARCHAR(255) NULL,
  account_status ENUM('active','suspended','demo_expired') DEFAULT 'active',
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  INDEX idx_oauth (oauth_provider, oauth_provider_id)
);

CREATE TABLE IF NOT EXISTS user_two_factor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  secret VARCHAR(255) NOT NULL,
  preferred_method VARCHAR(10) DEFAULT 'totp',
  otp_code VARCHAR(10) DEFAULT NULL,
  otp_expires_at DATETIME DEFAULT NULL,
  is_enabled TINYINT(1) DEFAULT 0,
  backup_codes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sys_password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Used by emailService.ts for SMTP config (AES-256-GCM encrypted)
CREATE TABLE IF NOT EXISTS credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL UNIQUE,
  encrypted_data TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Used by emailService.ts for email send history
CREATE TABLE IF NOT EXISTS email_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  status ENUM('sent', 'failed') NOT NULL,
  message_id VARCHAR(255),
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PIN Quick Login (v1.9.0)
-- Uses explicit utf8mb4_unicode_ci to match users.id collation (MySQL 8.0 FK compatibility)
CREATE TABLE IF NOT EXISTS user_pins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
  pin_hash VARCHAR(255) NOT NULL,
  failed_attempts INT DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 5. Client-Side Storage (localStorage)

The masquerade feature stores additional keys in `localStorage` alongside the standard auth keys.

### 5.1 Standard Auth Keys

| Key | Type | Set By | Description |
|-----|------|--------|-------------|
| `jwt_token` | string (JWT) | `AuthModel.storeAuth()` | Active session JWT |
| `user` | string (JSON) | `AuthModel.storeAuth()` | Serialized user profile object |

### 5.2 Masquerade Keys

| Key | Type | Set By | Cleared By | Description |
|-----|------|--------|------------|-------------|
| `masquerade_admin_restore_token` | string (JWT) | `AuthModel.startMasquerade()` | `exitMasquerade()`, `clearAuth()`, `clearMasquerade()` | JWT scoped to admin user (2h TTL), used to restore admin session |
| `masquerade_admin_id` | string (UUID) | `AuthModel.startMasquerade()` | `exitMasquerade()`, `clearAuth()`, `clearMasquerade()` | Original admin's user ID, used for UI reference |

**Detection:** `AuthModel.isMasquerading()` returns `true` if `masquerade_admin_restore_token` exists in localStorage.

**Security Notes:**
- `clearAuth()` removes ALL keys (standard + masquerade) — ensures clean logout
- Masquerade keys are separate from `jwt_token` — the active session token is always the target user's token during masquerade
- The admin restore token is never sent as an Authorization header — it's only submitted in the body of `POST /auth/masquerade/exit`

---

## 6. Known Issues

| # | Severity | Table | Issue | Impact |
|---|----------|-------|-------|--------|
| 1 | 🟡 | user_two_factor | `secret` column stored in plaintext (base32) | If DB is compromised, attacker can generate TOTP codes |
| 2 | 🟡 | user_roles | Collation mismatch requires `COLLATE utf8mb4_unicode_ci` in queries | Performance impact on JOINs; should normalize collations |
| 3 | ✅ | users | `passwordHash` uses bcrypt 12 rounds | Correct and secure |
| 4 | ✅ | user_two_factor | Backup codes stored as SHA-256 hashes | Correct — cannot reverse to plaintext |
| 5 | ✅ | user_pins | PIN hashed with bcrypt 10 rounds + rate limiting | Correct — lower rounds than password offset by 5-attempt lockout |
