# Credentials — File Inventory

## Backend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| systemCredentials.ts | `src/routes/systemCredentials.ts` | 252 | Full CRUD + deactivate, rotate, test endpoints for the `credentials` table |
| cryptoUtils.ts | `src/utils/cryptoUtils.ts` | 70 | `encryptPassword()` / `decryptPassword()` using AES-256-GCM |
| smsService.ts | `src/services/smsService.ts` | 411 | SMSPortal integration — first consumer of the credentials table |
| app.ts (partial) | `src/app.ts` | ~2 | Mounts `credentialsRouter` at `/api/credentials` (lines 67, 197) |
| mysql.ts (partial) | `src/db/mysql.ts` | ~10 | `db` helper used by all credential operations |

**Backend Total: ~745 LOC**

## Frontend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| CredentialModel.ts | `src/models/CredentialModel.ts` | 161 | Typed API client class: `getAll`, `getById`, `getByService`, `getExpired`, `getExpiringSoon`, `search`, `create`, `update`, `delete`, `deactivate`, `rotate`, `test` |
| Credentials.tsx | `src/pages/general/Credentials.tsx` | 464 | Admin list page — DataTable with filters, view-decrypted modal, deactivate/delete actions |
| CreateCredential.tsx | `src/pages/general/CreateCredential.tsx` | 411 | Create / edit form — type-aware labels, JSON additional_data field, show/hide value toggle |
| App.tsx (partial) | `src/App.tsx` | ~3 | Routes: `/credentials`, `/credentials/new`, `/credentials/:id/edit` — all wrapped in `<AdminRoute>` (lines 164-166) |
| Layout.tsx (partial) | `src/components/Layout/Layout.tsx` | ~2 | Nav entry: `{ name: 'Credentials', href: '/credentials', icon: KeyIcon, permission: 'credentials.view' }` (line 148) |

**Frontend Total: ~1,041 LOC**

## Combined Total: ~1,786 LOC

---

## File Relationship Map

```
Frontend                                Backend
┌──────────────────────────┐           ┌──────────────────────────────────────┐
│ App.tsx                  │           │ app.ts                               │
│  /credentials/*          │           │  apiRouter.use('/credentials',       │
│  (AdminRoute wrapper)    │           │    credentialsRouter)                │
├──────────────────────────┤           ├──────────────────────────────────────┤
│ Layout.tsx               │           │                                      │
│  Nav: Credentials        │           │ systemCredentials.ts (route)         │
│  (credentials.view perm) │           │  GET    /credentials                │
├──────────────────────────┤           │  GET    /credentials/expired        │
│ Credentials.tsx          │           │  GET    /credentials/expiring       │
│  List + filter UI        │───────▶  │  GET    /credentials/:id            │
│  View decrypted modal    │           │  POST   /credentials               │
│  Delete confirmation     │           │  PUT    /credentials/:id           │
├──────────────────────────┤           │  DELETE /credentials/:id            │
│ CreateCredential.tsx     │───────▶  │  POST   /credentials/:id/deactivate│
│  Create / edit form      │           │  POST   /credentials/:id/rotate    │
├──────────────────────────┤           │  POST   /credentials/:id/test      │
│ CredentialModel.ts       │           ├──────────────────────────────────────┤
│  getAll()                │───────▶  │  GET  /credentials                  │
│  getById(id, decrypt)    │───────▶  │  GET  /credentials/:id?decrypt=true │
│  getByService(name)      │─ ─ ─ ▶  │  ❌ /credentials/service/:name      │
│  search(query)           │─ ─ ─ ▶  │  ❌ /credentials/search             │
│  create(data)            │───────▶  │  POST /credentials                  │
│  update(id, data)        │───────▶  │  PUT  /credentials/:id              │
│  delete(id)              │───────▶  │  DELETE /credentials/:id            │
│  deactivate(id)          │───────▶  │  POST /credentials/:id/deactivate  │
│  rotate(id, value)       │───────▶  │  POST /credentials/:id/rotate      │
│  test(id)                │───────▶  │  POST /credentials/:id/test        │
└──────────────────────────┘           └──────────────────────────────────────┘
                                        ❌ = endpoint called by frontend but
                                             NOT implemented in backend

                                       ┌──────────────────────────────────────┐
                                       │ cryptoUtils.ts (utility)             │
                                       │  encryptPassword(text) → hash        │
                                       │  decryptPassword(hash) → text        │
                                       │  (used by smsService, NOT by routes) │
                                       ├──────────────────────────────────────┤
                                       │ smsService.ts (consumer)             │
                                       │  getCredentials()                    │
                                       │    → SELECT ... WHERE service_name   │
                                       │      = 'SMS'                         │
                                       │  Auto-detects encrypted vs plaintext │
                                       │  Auth token cached 23 h in memory    │
                                       └──────────────────────────────────────┘

Database
┌──────────────────────────────────────────────────────────────────────┐
│ credentials       — Centralised key vault (1 row: SMS)              │
│ sms_log           — SMS send audit log (auto-created by smsService) │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variable

| Variable | File | Required | Description |
|----------|------|----------|-------------|
| `ENCRYPTION_MASTER_KEY` | `.env` | YES (for encryption) | 32-byte hex string for AES-256-GCM. Generate with: `openssl rand -hex 32` |
