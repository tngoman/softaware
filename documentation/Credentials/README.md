# Credentials Module

## Overview

The Credentials module provides a centralised vault for storing, managing, and consuming external service API keys, passwords, tokens, and certificates used by the SoftAware platform. It supports encrypted storage via AES-256-GCM, admin-only CRUD through the web UI, and programmatic retrieval by backend services (e.g. the SMS service reads its SMSPortal keys from this table at runtime).

## Module Scope

| Sub-Domain | Description |
|------------|-------------|
| **Credential Storage** | AES-256-GCM encrypted `credential_value` and `additional_data` columns |
| **Admin CRUD** | Create, read, update, delete, deactivate, rotate, and test credentials |
| **Service Consumption** | Backend services query `credentials` by `service_name` at runtime |
| **Expiry Tracking** | Optional `expires_at` with expiring/expired list endpoints |
| **Audit Trail** | `created_by`, `updated_by`, `last_used_at` timestamps |
| **Environment Scoping** | Per-credential environment flag (`development`, `staging`, `production`, `all`) |

## Architecture

### Backend Structure
```
src/routes/systemCredentials.ts   → /api/credentials/* (CRUD, deactivate, rotate, test)
src/utils/cryptoUtils.ts          → encryptPassword() / decryptPassword() (AES-256-GCM)
src/services/smsService.ts        → First consumer — reads SMS credential at runtime
src/db/mysql.ts                   → Database pool + db helper (query, queryOne, execute, …)
```

### Frontend Structure
```
pages/general/Credentials.tsx     → Admin list page (DataTable, view/decrypt modal, delete)
pages/general/CreateCredential.tsx→ Create / edit form with type-aware inputs
models/CredentialModel.ts         → Typed model class (getAll, getById, create, update, delete, deactivate, rotate, test)
components/Layout/Layout.tsx      → Nav entry gated by 'credentials.view' permission
App.tsx                           → Routes: /credentials, /credentials/new, /credentials/:id/edit
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                       FRONTEND (React)                               │
│                                                                      │
│  Credentials.tsx  ──▶  CredentialModel.ts  ──▶  api.get/post/put/del│
│  CreateCredential.tsx                                                │
│       (AdminRoute — requires admin role)                             │
└────────────────────────┬─────────────────────────────────────────────┘
                         │  HTTPS  Authorization: Bearer <admin-jwt>
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Express)                              │
│                                                                      │
│  app.ts ──▶ apiRouter.use('/credentials', credentialsRouter)         │
│                                                                      │
│  systemCredentials.ts (route)                                        │
│    GET    /credentials           — list (masked by default)          │
│    GET    /credentials/expired   — expired credentials               │
│    GET    /credentials/expiring  — expiring within 30 days           │
│    GET    /credentials/:id       — single (masked unless decrypt=1)  │
│    POST   /credentials           — create                            │
│    PUT    /credentials/:id       — update                            │
│    DELETE /credentials/:id       — hard delete                       │
│    POST   /credentials/:id/deactivate — soft delete (is_active=0)    │
│    POST   /credentials/:id/rotate     — replace value                │
│    POST   /credentials/:id/test       — validity check               │
│                                                                      │
│  cryptoUtils.ts (utility)                                            │
│    encryptPassword(text) → "iv:authTag:ciphertext"                   │
│    decryptPassword(hash) → plaintext                                 │
│                                                                      │
│  smsService.ts (consumer)                                            │
│    getCredentials() → reads service_name='SMS' row                   │
│    Auto-detects encrypted vs plaintext values                        │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       MySQL (softaware)                              │
│                                                                      │
│  credentials   — centralised key vault (1 row: SMS)                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Dependencies

| Dependency | Usage |
|-----------|-------|
| `crypto` (Node built-in) | AES-256-GCM encryption, `randomBytes`, `createCipheriv` / `createDecipheriv` |
| `mysql2/promise` | All database operations via `db` helper |
| `axios` | HTTP calls to external APIs (smsService) |
| `express` / `Router` | Route definitions |
| `../middleware/auth.ts` | `requireAuth` + `getAuth` for all credential routes |
| `../utils/httpErrors.ts` | `badRequest()`, `notFound()` error factories |
| `@tanstack/react-table` | DataTable in Credentials.tsx |
| `sweetalert2` | Confirmation dialogs in frontend |
| `react-hook-form` | Form handling in CreateCredential.tsx |

## Key Concepts

- **Encryption at Rest**: `cryptoUtils.ts` uses AES-256-GCM with a 32-byte hex master key from `ENCRYPTION_MASTER_KEY` env var. Format: `iv:authTag:ciphertext` (hex, colon-delimited)
- **Masking by Default**: The list/get endpoints return `'••••••••'` for `credential_value` and `'(encrypted)'` for `additional_data` unless `?decrypt=true` is passed
- **No Auto-Encryption on Write**: The `POST`/`PUT` routes store values as-is — the `encryptPassword()` function is available but not wired into the CRUD routes (see PATTERNS.md Anti-Pattern 1)
- **Service Name Convention**: Consumers query by `service_name` (e.g. `'SMS'`). This is the primary lookup key
- **Additional Data**: The `additional_data` JSON column holds structured metadata (e.g. `{"secret": "..."}` for the SMS API secret)
- **Credential Types**: `api_key`, `password`, `token`, `oauth`, `ssh_key`, `certificate`, `other`
- **Environment Scoping**: Each credential is tagged `development`, `staging`, `production`, or `all`
- **Frontend Access Control**: Routes wrapped in `<AdminRoute>`, nav gated by `credentials.view` permission. Backend uses `requireAuth` but does **not** enforce `requireAdmin`
