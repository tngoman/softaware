# API Keys Module — Database Fields

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Table: `api_keys`

**Engine:** InnoDB  
**Charset:** utf8mb4_unicode_ci

### Schema

```sql
CREATE TABLE `api_keys` (
  `id`         varchar(36)  NOT NULL,
  `name`       varchar(100) NOT NULL,
  `key`        varchar(64)  NOT NULL,
  `userId`     varchar(36)  NOT NULL,
  `isActive`   tinyint(1)   NOT NULL DEFAULT '1',
  `lastUsedAt` datetime(3)  DEFAULT NULL,
  `createdAt`  datetime(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt`  datetime(3)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ApiKey_key_key` (`key`),
  KEY `ApiKey_userId_idx` (`userId`),
  KEY `ApiKey_key_idx` (`key`),
  CONSTRAINT `ApiKey_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Column Reference

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | varchar(36) | NO | — | UUID primary key (`generateId()`) |
| `name` | varchar(100) | NO | — | Human-readable label ("Desktop App", "CI Pipeline") |
| `key` | varchar(64) | NO | — | 64-char hex string (`crypto.randomBytes(32)`) |
| `userId` | varchar(36) | NO | — | FK → `users.id` — owner |
| `isActive` | tinyint(1) | NO | `1` | `1` = active, `0` = disabled (soft-revoke) |
| `lastUsedAt` | datetime(3) | YES | `NULL` | Updated by `requireApiKey` middleware on each use |
| `createdAt` | datetime(3) | NO | `CURRENT_TIMESTAMP(3)` | Row creation time |
| `expiresAt` | datetime(3) | YES | `NULL` | Optional expiry; `NULL` = never expires |

### Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `PRIMARY` | Primary | `id` | Row identity |
| `ApiKey_key_key` | Unique | `key` | Ensure no duplicate keys; fast lookup by middleware |
| `ApiKey_userId_idx` | Index | `userId` | List user's own keys efficiently |
| `ApiKey_key_idx` | Index | `key` | Redundant with unique (exists from migration) |

### Foreign Keys

| Constraint | Column | References | On Delete | On Update |
|-----------|--------|------------|-----------|-----------|
| `ApiKey_userId_fkey` | `userId` | `users.id` | RESTRICT | CASCADE |

> **RESTRICT on delete:** A user cannot be deleted while they have API keys. Delete keys first.

---

## 2. Relationships

```
users (1) ───FK──→ (N) api_keys
                        │
                        ├── key looked up by requireApiKey middleware
                        └── userId used to resolve team → credits
```

---

## 3. Example Data

```sql
INSERT INTO api_keys (id, name, `key`, userId, isActive, lastUsedAt, createdAt, expiresAt)
VALUES
  ('k-001', 'Desktop App',  '7f4a3b2c...64hex', 'u-001', 1, '2026-03-04 10:30:00.000', '2026-02-01 08:00:00.000', NULL),
  ('k-002', 'CI Pipeline',  'a9b8c7d6...64hex', 'u-001', 0, '2026-01-15 12:00:00.000', '2026-01-01 09:00:00.000', '2026-06-01 00:00:00.000'),
  ('k-003', 'Webhook Auth', 'e1f2a3b4...64hex', 'u-002', 1, NULL,                       '2026-03-01 14:00:00.000', '2026-09-01 00:00:00.000');
```

---

## 4. Key Generation

```typescript
import crypto from 'crypto';

// 32 bytes → 64 hex characters
const apiKey = crypto.randomBytes(32).toString('hex');
// Example: "7f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a"
```

**Properties:**
- 256 bits of entropy (cryptographically strong)
- Hex-encoded → safe in HTTP headers with no encoding needed
- 64 characters long → unique-index collision probability ≈ 0

---

## 5. Middleware Lookup Query

The `requireApiKey` middleware runs this on every API-key-authenticated request:

```sql
-- 1. Find key
SELECT * FROM api_keys WHERE `key` = ? LIMIT 1;

-- 2. If found and valid, stamp last-used
UPDATE api_keys SET lastUsedAt = NOW(3) WHERE id = ?;
```

### Rejection conditions (checked in application code)

| Condition | Check |
|-----------|-------|
| Key not found | `result === null` |
| Key inactive | `isActive === 0` |
| Key expired | `expiresAt !== NULL AND expiresAt < NOW()` |

---

## 6. Common Queries

### List user's keys
```sql
SELECT id, name, `key`, isActive, lastUsedAt, createdAt, expiresAt
  FROM api_keys
 WHERE userId = ?
 ORDER BY createdAt DESC;
```

### Find stale keys (unused > 90 days)
```sql
SELECT * FROM api_keys
 WHERE isActive = 1
   AND (lastUsedAt IS NULL OR lastUsedAt < DATE_SUB(NOW(), INTERVAL 90 DAY));
```

### Count active keys per user
```sql
SELECT userId, COUNT(*) AS active_keys
  FROM api_keys
 WHERE isActive = 1
 GROUP BY userId;
```

---

## 7. Known Issues

| Severity | Issue | Notes |
|----------|-------|-------|
| 🟡 WARNING | Key stored as **plaintext hex** — not hashed | Required because `requireApiKey` looks up by exact `key` value. Hashing would require sending key → hash → lookup, which is slower but more secure. Consider migrating to bcrypt + prefix lookup in v2. |
| ✅ OK | `RESTRICT` on user delete prevents orphaned keys | Correct — keys must be removed before user deletion |
| ✅ OK | `UNIQUE` on `key` prevents duplicates | Collision probability negligible with 256-bit randomness |
