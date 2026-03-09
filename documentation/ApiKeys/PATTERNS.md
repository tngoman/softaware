# API Keys Module — Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Design Patterns Used

### 1.1 Show-Once Secret

The full API key is returned **only** in the POST creation response. All subsequent GET requests mask it to `****<last8>`.

```typescript
// POST — creation (full key)
res.json({
  key: apiKey,  // "7f4a3b2c1d0e...64hex"
  warning: 'Save this key! It will not be shown again.'
});

// GET — list (masked)
const maskedKeys = apiKeys.map(key => ({
  ...key,
  key: `****${key.key.slice(-8)}`
}));
```

**Why:** Mirrors GitHub, Stripe, and AWS key management UX. If user loses the key, they delete and create a new one.

### 1.2 Soft Revocation via Toggle

Instead of deleting a key, users can toggle `isActive`:

```typescript
// PATCH /:id/toggle
const newStatus = !apiKey.isActive;
await db.execute('UPDATE api_keys SET isActive = ? WHERE id = ?', [newStatus, id]);
```

**Why:** Allows temporary suspension (e.g. investigating a leak) without losing the key record.

### 1.3 Ownership Scoping

Every query filters by `userId` to ensure users can only see/manage their own keys:

```sql
SELECT * FROM api_keys WHERE id = ? AND userId = ?
```

**Why:** Simple, reliable tenant isolation without a separate authorization layer.

---

## 2. Usage Patterns — Consumers

### 2.1 Desktop App Authentication

```typescript
// Desktop app stores key in local encrypted config
const response = await fetch('https://api.softaware.net.za/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': storedApiKey,
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    provider: 'softaware'
  })
});
```

### 2.2 CI Pipeline Authentication

```bash
# .github/workflows/deploy.yml
curl -X POST https://api.softaware.net.za/api/sync/push \
  -H "x-api-key: ${{ secrets.SOFTAWARE_API_KEY }}" \
  -H "Content-Type: application/json" \
  -d '{"data": "..."}'
```

### 2.3 Query Parameter Fallback

For environments where custom headers are difficult (e.g. webhooks):

```
GET https://api.softaware.net.za/api/notifications?api_key=7f4a3b2c...
```

> ⚠️ Less secure — key appears in access logs. Prefer header when possible.

---

## 3. Anti-Patterns & Warnings

### 3.1 ❌ Plaintext Key Storage

**Current state:** Keys are stored as plaintext hex in the database.

**Risk:** If the database is compromised, all keys are immediately usable.

**Ideal:** Hash keys with bcrypt and store a prefix for identification:

```typescript
// Ideal (not yet implemented)
const prefix = apiKey.slice(0, 8);
const hash = await bcrypt.hash(apiKey, 12);
// Store: { prefix, hash }
// Lookup: SELECT * WHERE prefix = ? → then bcrypt.compare()
```

**Status:** Accepted risk for v1; planned improvement for v2.

### 3.2 ❌ No Rate Limiting on Key Creation

Users can currently create unlimited API keys. Consider adding:
- Max 20 active keys per user
- Rate limit: 5 new keys per hour

### 3.3 ❌ No Scope Restriction

All keys have full access to every endpoint behind `requireApiKey`. Consider adding scopes:

```typescript
// Future: scoped keys
{ scopes: ['ai:read', 'ai:write', 'credits:read'] }
```

---

## 4. Security Patterns

### 4.1 Key Rotation Workflow

```
1. User creates new key with a name like "Desktop App v2"
2. User updates desktop app config with new key
3. User verifies new key works (lastUsedAt updates)
4. User deactivates old key (toggle)
5. After confirmation period, user deletes old key
```

### 4.2 Leak Response

```
1. User notices unauthorized usage (audit logs, unexpected credit deduction)
2. User toggles key inactive immediately (PATCH /:id/toggle)
3. User creates replacement key
4. User updates all consumers
5. User deletes compromised key
```

### 4.3 Expiry-Based Keys for Contractors

```typescript
// Create key that expires in 30 days
POST /api/api-keys
{
  "name": "Contractor - March 2026",
  "expiresInDays": 30
}
```

No need to remember to revoke — key auto-expires.

---

## 5. Testing Patterns

### Verify key works
```bash
curl -s https://api.softaware.net.za/api/ai/simple \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "ping"}' | jq .content
```

### Check key status (from web UI)
```
GET /api/api-keys → look for isActive and lastUsedAt
```

### Verify expired key is rejected
```bash
# Should return 403 with "API key has expired"
curl -s -o /dev/null -w "%{http_code}" \
  https://api.softaware.net.za/api/ai/simple \
  -H "x-api-key: EXPIRED_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```
