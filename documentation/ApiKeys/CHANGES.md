# API Keys Module — Change Log

**Module:** ApiKeys  
**Source:** `src/routes/apiKeys.ts`, `src/middleware/apiKey.ts`

---

## v1.0.0 — Initial Release

**Date:** 2024 (exact date unavailable)  
**Type:** Feature — New Module

### Summary
User-owned API key management for external/headless authentication to the SoftAware platform.

### Changes

| Change | Type | Description |
|--------|------|-------------|
| `GET /api/api-keys` | Feature | List all keys for the authenticated user, with masked values |
| `POST /api/api-keys` | Feature | Generate a new 64-character hex key with optional name and expiry |
| `DELETE /api/api-keys/:id` | Feature | Permanently delete a key |
| `PATCH /api/api-keys/:id/toggle` | Feature | Toggle `isActive` without deleting |
| `requireApiKey` middleware | Feature | Auth middleware that accepts `x-api-key` header or `api_key` query param |
| `api_keys` table | Schema | 8-column table with FK to `users`, unique constraint on `key` |

### Database Changes
```sql
CREATE TABLE api_keys (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) DEFAULT 'Default',
  key        VARCHAR(255) NOT NULL UNIQUE,
  userId     INT NOT NULL,
  isActive   TINYINT(1) DEFAULT 1,
  lastUsedAt DATETIME DEFAULT NULL,
  createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt  DATETIME DEFAULT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### Authentication Flow
```
Request → requireApiKey middleware
  → Extract key from x-api-key header or api_key query param
  → SELECT from api_keys WHERE key = ?
  → Check isActive = 1
  → Check expiresAt is null or in the future
  → UPDATE lastUsedAt
  → Attach userId to req.user
  → next()
```

### Notes
- Keys are stored in plaintext (not hashed) — accepted risk for v1
- The full key is only shown once at creation time
- No rate limiting on key creation
- No scope/permission system — key grants full API access

---

## Planned — v1.1.0

| Change | Type | Description |
|--------|------|-------------|
| Key hashing | Security | Store bcrypt hash + 8-char prefix instead of plaintext |
| Key limit | Security | Max 20 active keys per user |
| Key scopes | Feature | Restrict key access to specific endpoints or actions |
| Usage analytics | Feature | Track request counts per key for quota monitoring |
