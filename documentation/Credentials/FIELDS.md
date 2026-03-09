# Credentials — Field Definitions

## Database Tables

### credentials

**Purpose:** Centralised vault for external service API keys, passwords, tokens, and certificates.

**Engine:** InnoDB, charset utf8mb4

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO (PK) | AUTO_INCREMENT | Primary key |
| service_name | VARCHAR(200) | NO | — | Logical service label (e.g. `SMS`, `OpenRouter`, `AWS`) |
| credential_type | ENUM | NO | `api_key` | `api_key`, `password`, `token`, `oauth`, `ssh_key`, `certificate`, `other` |
| identifier | VARCHAR(200) | YES | NULL | Optional label for the value (e.g. `ApiKey`, `ClientID`, username) |
| credential_value | TEXT | YES | NULL | The secret value — stored as plaintext or AES-256-GCM encrypted string |
| additional_data | JSON | YES | NULL | Structured metadata (e.g. `{"secret":"..."}` for a secondary key) |
| environment | ENUM | NO | `production` | `development`, `staging`, `production`, `all` |
| expires_at | DATETIME | YES | NULL | Optional expiry timestamp |
| is_active | TINYINT | NO | `1` | 1 = active, 0 = deactivated (soft delete) |
| notes | TEXT | YES | NULL | Free-form admin notes |
| created_by | VARCHAR(36) | YES | NULL | User UUID who created the row |
| updated_by | VARCHAR(36) | YES | NULL | User UUID who last updated the row |
| last_used_at | DATETIME | YES | NULL | Timestamp of last programmatic access |
| created_at | TIMESTAMP | YES | CURRENT_TIMESTAMP | Row creation time |
| updated_at | TIMESTAMP | YES | CURRENT_TIMESTAMP ON UPDATE | Auto-updated on any column change |

**Indexes:**
```sql
PRIMARY KEY (id)
-- No additional indexes defined (low-volume table)
```

**DDL:**
```sql
CREATE TABLE `credentials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `service_name` varchar(200) NOT NULL,
  `credential_type` enum('api_key','password','token','oauth','ssh_key','certificate','other') NOT NULL DEFAULT 'api_key',
  `identifier` varchar(200) DEFAULT NULL,
  `credential_value` text,
  `additional_data` json DEFAULT NULL,
  `environment` enum('development','staging','production','all') NOT NULL DEFAULT 'production',
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `notes` text,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**Business Rules:**
- `service_name` is the primary lookup key for programmatic consumers (not unique — allows multiple credentials per service in different environments)
- `is_active = 0` disables the credential without deleting it (soft delete / deactivation)
- `credential_value` can hold plaintext **or** AES-256-GCM encrypted strings in the format `iv:authTag:ciphertext` (hex, colon-delimited). Consumers must detect the format
- `additional_data` is used when a service needs more than one secret (e.g. SMS: clientId in `credential_value`, API secret in `additional_data.secret`)
- `last_used_at` is updated by consuming services (e.g. smsService) on each access
- `expires_at` enables the `/expired` and `/expiring` monitoring endpoints

---

### sms_log (Related — created by smsService)

**Purpose:** Audit log for every SMS sent through the SMSPortal gateway.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO (PK) | AUTO_INCREMENT | Primary key |
| event_id | VARCHAR(100) | YES | NULL | SMSPortal event ID |
| destination | VARCHAR(30) | NO | — | E.164 phone number |
| content | TEXT | NO | — | SMS body text |
| status | VARCHAR(50) | YES | NULL | Delivery status from gateway |
| error_code | VARCHAR(100) | YES | NULL | Error code if failed |
| credits | DECIMAL(10,4) | YES | NULL | SMS credits consumed |
| test_mode | TINYINT | NO | `0` | 1 = test mode (no actual send) |
| campaign | VARCHAR(200) | YES | NULL | Campaign name tag |
| raw_response | JSON | YES | NULL | Full gateway response per message |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | When the SMS was sent |

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_sms_event (event_id)
INDEX idx_sms_dest  (destination)
INDEX idx_sms_date  (created_at)
```

**Notes:**
- Table is auto-created on first SMS send (`CREATE TABLE IF NOT EXISTS`)
- One row per message in a bulk send (not one per batch)

---

## Encryption Configuration

### AES-256-GCM (cryptoUtils.ts)

| Parameter | Value |
|-----------|-------|
| Algorithm | `aes-256-gcm` |
| Master Key | 32-byte hex string from `ENCRYPTION_MASTER_KEY` env var |
| IV | 16 random bytes per encryption |
| Auth Tag | 16 bytes (GCM integrity check) |
| Output Format | `{iv_hex}:{authTag_hex}:{ciphertext_hex}` |

**Encrypt:**
```typescript
encryptPassword("my-secret-key")
// → "a1b2c3...32hex:d4e5f6...32hex:7890ab...variable_hex"
```

**Decrypt:**
```typescript
decryptPassword("a1b2c3...:d4e5f6...:7890ab...")
// → "my-secret-key"
```

**Detection Pattern (used by smsService):**
```typescript
// If the value has 3 colon-separated parts, each ≥ 16 hex chars → it's encrypted
const parts = raw.split(':');
if (parts.length === 3 && parts.every(p => /^[0-9a-f]{16,}$/i.test(p))) {
  raw = decryptPassword(raw);
}
```

---

## Current Data

As of 2026-03-04, the `credentials` table contains **1 row**:

| id | service_name | credential_type | identifier | credential_value | additional_data | environment | is_active |
|----|-------------|-----------------|------------|------------------|-----------------|-------------|-----------|
| 1 | SMS | api_key | ApiKey | `0d517784-f5c8-452f-8b87-dec6914ce23c` (plaintext UUID) | NULL | all | 1 |

**Note:** The SMS row stores the SMSPortal Client ID in `credential_value`. The API Secret needs to be added to `additional_data`:

```sql
UPDATE credentials
SET additional_data = '{"secret":"<your-smsportal-api-secret>"}'
WHERE service_name = 'SMS';
```

---

## Frontend Type Definitions

### Credential (CredentialModel.ts)

```typescript
interface Credential {
  id: number;
  service_name: string;
  credential_type: 'api_key' | 'password' | 'token' | 'oauth' | 'ssh_key' | 'certificate' | 'other';
  identifier?: string;
  credential_value?: string;   // Only present when decrypt=true
  additional_data?: Record<string, any>; // Only present when decrypt=true
  environment: 'development' | 'staging' | 'production' | 'all';
  expires_at?: string;
  is_active: number;
  notes?: string;
  created_by: number;
  updated_by?: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

interface CreateCredentialData {
  service_name: string;
  credential_type: string;
  identifier?: string;
  credential_value: string;
  additional_data?: Record<string, any>;
  environment: string;
  expires_at?: string;
  notes?: string;
}
```
