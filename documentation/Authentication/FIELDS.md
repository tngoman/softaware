# Authentication Module - Database Schema

**Version:** 1.5.0  
**Last Updated:** 2026-03-06

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Core tables** | 2 (users, user_two_factor) |
| **Supporting tables** | 4 (user_roles, roles, role_permissions, permissions) |
| **Email tables** | 2 (credentials — SMTP config, email_log — send history) |
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
| account_status | ENUM('active','suspended','demo_expired') | DEFAULT 'active' | Global account status |
| createdAt | DATETIME | NOT NULL | Registration timestamp |
| updatedAt | DATETIME | NOT NULL | Last modification |

**Indexes:** PRIMARY (id), UNIQUE (email)

**Relationships:**
- `user_roles.user_id → users.id` — Role assignment (authoritative)
- `user_two_factor.user_id → users.id` — 2FA configuration
- `api_keys.userId → users.id` — API key ownership
- `teams.createdByUserId → users.id` — Team creator (legacy, credit scoping only)
- `team_members.userId → users.id` — Team membership (legacy, credit scoping only)

**Business Rules:**
- Email must be unique (enforced at DB + app level)
- Password hashed with bcrypt, 12 salt rounds
- On registration, user is assigned `viewer` role via `user_roles` (legacy team/team_members records also created for credit balance scoping)
- account_status checked by statusCheck middleware on every authenticated request

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

### 2.3 `user_roles` — User-to-Role Assignment

**Purpose:** Maps users to their assigned roles (RBAC).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Row ID |
| user_id | VARCHAR(36) | FK → users.id | User reference |
| role_id | INT | FK → roles.id | Assigned role |

**Business Rules:**
- Users without a `user_roles` entry get fallback role `{ id: 0, name: 'Client', slug: 'client' }`
- `is_admin` = role slug in (`admin`, `super_admin`) → wildcard `*` permission
- `is_staff` = role slug in (`developer`, `client_manager`, `qa_specialist`, `deployer`) → wildcard `*` permission
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

## 3. Table Relationships

```
users ──────────┬──── user_two_factor     (1:1 — multi-method 2FA config)
                │
                ├──── user_roles ──────── roles ──── role_permissions ──── permissions
                │     (1:1)               (1:N)      (N:M)
                │
                ├──── team_members ─────── teams       ⚠️ LEGACY (credit scoping only)
                │     (N:M)                (1:N)
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
  account_status ENUM('active','suspended','demo_expired') DEFAULT 'active',
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
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
