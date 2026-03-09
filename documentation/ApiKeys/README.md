# API Keys Module — Overview

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Module Overview

### Purpose

The API Keys module lets **individual users** generate, list, toggle, and delete personal API keys. These keys are used to authenticate external clients (desktop app, CI scripts, third-party integrations) against the `/api/*` endpoints via the `requireApiKey` middleware.

> **Not to be confused with [Credentials](../Credentials/README.md)** — that module manages **platform-level** service secrets (e.g. Stripe, SMS, Firebase) controlled by admins. This module manages **user-owned** keys for accessing the SoftAware API externally.

### Business Value

- Self-service key creation — no admin intervention needed
- Per-key naming and expiry for easy rotation
- One-click activate / deactivate without deleting the key
- Full key shown **only once** on creation (security best practice)

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 1 (`apiKeys.ts`) |
| Middleware consumers | 1 (`middleware/apiKey.ts`) |
| Backend LOC | ~120 |
| MySQL tables | 1 (`api_keys`) |
| API endpoints | 4 |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                             │
│  (Account Settings → API Keys tab)                               │
│                                                                  │
│  • List keys (masked)                                           │
│  • Create key (name, optional expiry)                           │
│  • Copy full key on creation                                    │
│  • Toggle active / inactive                                     │
│  • Delete key                                                   │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS  Authorization: Bearer <jwt>
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express)                            │
│                                                                  │
│  routes/apiKeys.ts  ─── /api/api-keys                           │
│    ├── GET    /           → List user's keys (masked)           │
│    ├── POST   /           → Generate new key                    │
│    ├── DELETE /:id        → Delete key                          │
│    └── PATCH  /:id/toggle → Toggle isActive                     │
│                                                                  │
│  middleware/apiKey.ts  ─── requireApiKey()                       │
│    • Reads x-api-key header or ?api_key param                   │
│    • Looks up `api_keys` row                                    │
│    • Rejects expired / inactive keys                            │
│    • Stamps lastUsedAt on success                               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  MySQL — `api_keys` table                                       │
│  id | name | key (unique, 64-char hex) | userId FK | isActive  │
│  lastUsedAt | createdAt | expiresAt                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Security Model

| Aspect | Detail |
|--------|--------|
| **Generation** | `crypto.randomBytes(32).toString('hex')` → 64-character hex |
| **Storage** | Stored as plaintext hex (not hashed — needed for middleware lookup) |
| **Display** | Full key shown once on creation; list endpoint masks to `****<last8>` |
| **Ownership** | Keys are scoped to `userId`; users can only see / manage their own |
| **Expiry** | Optional `expiresAt`; middleware rejects expired keys |
| **Revocation** | Soft-disable via `isActive` toggle or hard-delete |
| **Last-used tracking** | `lastUsedAt` updated on every successful auth |

---

## 4. Integration Points

| Consumer | How it uses API Keys |
|----------|----------------------|
| Desktop app | Sends `x-api-key` header for all API calls |
| CI / automation scripts | Authenticate build & deploy scripts |
| AI Gateway (`/api/ai/*`) | `requireApiKey` middleware gates all chat endpoints |
| Credit system | `apiKey.userId` used to resolve team → deduct credits |
| Webhook callbacks | External services authenticate callbacks with stored key |

---

## 5. Related Documentation

- [Routes](ROUTES.md) — Endpoint specifications
- [Fields](FIELDS.md) — Database schema
- [Files](FILES.md) — Source file inventory
- [Patterns](PATTERNS.md) — Usage patterns
- [Changes](CHANGES.md) — Version history
- [Credentials Module](../Credentials/README.md) — Platform-level service secrets (different system)
