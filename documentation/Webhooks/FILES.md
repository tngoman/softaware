# Webhooks — File Reference

## Backend Files

### Core Service
| File | LOC | Purpose |
|------|-----|---------|
| `src/services/enterpriseEndpoints.ts` | 343 | SQLite singleton service — CRUD for endpoints, request logging, DB lifecycle |

### Route Handlers
| File | LOC | Purpose |
|------|-----|---------|
| `src/routes/enterpriseWebhook.ts` | 292 | Universal webhook handler — POST `/:endpointId` with full processing pipeline |
| `src/routes/adminEnterpriseEndpoints.ts` | 175 | Admin CRUD API — 7 endpoints with Zod validation |

### Utilities
| File | LOC | Purpose |
|------|-----|---------|
| `src/services/payloadNormalizer.ts` | 268 | Inbound/outbound payload adapters for 6 providers |

### Dependencies (Shared)
| File | Usage |
|------|-------|
| `src/middleware/auth.ts` | JWT authentication (`requireAuth`) |
| `src/middleware/requireAdmin.ts` | Admin role enforcement |
| `src/utils/env.ts` | Environment variables (`OLLAMA_BASE_URL`, `OPENROUTER_BASE_URL`, `OPENROUTER_API_KEY`) |
| `src/app.ts` | Route mounting: `/v1/webhook` and `/admin/enterprise-endpoints` |

---

## Frontend Files

### Pages
| File | LOC | Purpose |
|------|-----|---------|
| `src/pages/admin/EnterpriseEndpoints.tsx` | 617 | Full admin interface — endpoint table, create/edit modal, logs viewer, status toggle |

### Models
| File | Section | LOC | Purpose |
|------|---------|-----|---------|
| `src/models/AdminAIModels.ts` | `AdminEnterpriseModel` class | ~50 | API wrapper for admin CRUD (getAll, get, create, update, setStatus, delete, getLogs) |
| `src/models/AdminAIModels.ts` | `EnterpriseEndpoint` interface | ~25 | TypeScript interface for endpoint data |
| `src/models/AdminAIModels.ts` | `EndpointCreateInput` interface | ~15 | TypeScript interface for endpoint creation payload |
| `src/models/AdminAIModels.ts` | `RequestLog` interface | ~10 | TypeScript interface for request log entries |

### Exports
| File | Export | Purpose |
|------|--------|---------|
| `src/models/index.ts` | `AdminEnterpriseModel` | Re-export of model class |
| `src/models/index.ts` | `EnterpriseEndpoint` | Re-export of interface |

---

## Database Files

### Schema Definition
| File | Table | Purpose |
|------|-------|---------|
| (auto-created) | `enterprise_endpoints` | Webhook endpoint configuration |
| (auto-created) | `endpoint_requests` | Request logs |

> ⚠️ **No migration file** — Schema is auto-created by `getDb()` in `enterpriseEndpoints.ts` on first access. Tables are created inline via `db.exec()` with `CREATE TABLE IF NOT EXISTS`.

### Database File Location
| Path | Purpose |
|------|---------|
| `data/enterprise_endpoints.db` | SQLite database file |
| `data/enterprise_endpoints.db-wal` | WAL journal file (auto-generated) |
| `data/enterprise_endpoints.db-shm` | Shared memory file (auto-generated) |

---

## File Dependencies Graph

```
┌──────────────────────────────────────────────────────────┐
│                       app.ts                             │
│  apiRouter.use('/v1/webhook', enterpriseWebhookRouter)   │
│  apiRouter.use('/admin/enterprise-endpoints', adminRouter)│
└──────────────┬───────────────────────┬───────────────────┘
               │                       │
     ┌─────────▼─────────┐  ┌─────────▼──────────────────┐
     │ enterpriseWebhook  │  │ adminEnterpriseEndpoints   │
     │ .ts (292 LOC)      │  │ .ts (175 LOC)              │
     │                    │  │                             │
     │ POST /:endpointId  │  │ GET    /                   │
     │                    │  │ GET    /:id                 │
     │ Imports:           │  │ POST   /                   │
     │ - enterpriseEnd... │  │ PUT    /:id                │
     │ - payloadNormal... │  │ PATCH  /:id/status         │
     │ - axios            │  │ DELETE /:id                │
     │ - env              │  │ GET    /:id/logs           │
     └────────┬───┬───────┘  │                             │
              │   │          │ Imports:                     │
              │   │          │ - enterpriseEndpoints.ts     │
              │   │          │ - zod                        │
              │   │          │ - requireAuth, requireAdmin  │
     ┌────────▼───┘          └──────────┬──────────────────┘
     │                                  │
┌────▼─────────────────┐  ┌─────────────▼─────────────────┐
│ payloadNormalizer.ts  │  │ enterpriseEndpoints.ts        │
│ (268 LOC)             │  │ (343 LOC)                     │
│                       │  │                               │
│ normalizeInbound()    │  │ getDb() — SQLite singleton    │
│ formatOutbound()      │  │ createEndpoint()              │
│                       │  │ getEndpoint()                 │
│ 6 provider adapters:  │  │ getAllEndpoints()              │
│ - WhatsApp            │  │ updateEndpoint()              │
│ - Slack               │  │ setEndpointStatus()           │
│ - SMS                 │  │ deleteEndpoint()              │
│ - Email               │  │ logRequest()                  │
│ - Web                 │  │ getRequestLogs()              │
│ - Custom REST         │  │ close()                       │
│                       │  │                               │
│ No dependencies       │  │ Imports: better-sqlite3, crypto│
└───────────────────────┘  └───────────────────────────────┘
```

---

## Frontend File Dependencies

```
┌─────────────────────────────────────────────────────────┐
│ EnterpriseEndpoints.tsx (617 LOC)                       │
│                                                         │
│ Components: StatusBadge, endpoint table, modals         │
│ State: endpoints[], form, logs[], showForm, showLogs    │
│                                                         │
│ Imports:                                                │
│ ├── AdminEnterpriseModel (src/models/AdminAIModels.ts)  │
│ ├── EnterpriseEndpoint interface                        │
│ ├── Card, Button, Input, Select, Textarea (UI lib)      │
│ ├── @heroicons/react (12 icons)                         │
│ └── sweetalert2 (confirmations + feedback)              │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────▼────────────────┐
         │ AdminEnterpriseModel        │
         │ (src/models/AdminAIModels)  │
         │                             │
         │ .getAll()                   │
         │ .get(id)                    │
         │ .create(data)              │
         │ .update(id, data)          │
         │ .setStatus(id, status)     │
         │ .delete(id)               │
         │ .getLogs(id, limit, offset)│
         │                             │
         │ Uses: api (axios instance)  │
         │ Base: /admin/enterprise-    │
         │       endpoints             │
         └─────────────────────────────┘
```

---

## File Summary

| Layer | Files | Total LOC |
|-------|-------|-----------|
| Backend Service | 1 | 343 |
| Backend Routes | 2 | 467 |
| Backend Utilities | 1 | 268 |
| Frontend Page | 1 | 617 |
| Frontend Model | 1 (shared) | ~100 |
| **Total** | **6** | **~1,795** |

---

## Related Documentation

| File | Purpose |
|------|---------|
| `documentation/Webhooks/README.md` | Module overview and architecture |
| `documentation/Webhooks/FIELDS.md` | Field and data dictionary |
| `documentation/Webhooks/FILES.md` | This file |
| `documentation/Webhooks/ROUTES.md` | API endpoint documentation |
| `documentation/Webhooks/PATTERNS.md` | Code patterns and best practices |
| `documentation/Webhooks/CHANGES.md` | Version history and change log |
