# Enterprise Endpoints Module — Overview

**Version:** 1.4.0  
**Last Updated:** 2026-03-12

---

## 1. Module Overview

### Purpose

The Enterprise Endpoints module manages dynamic, database-driven webhook endpoints for enterprise clients. Each client receives a unique webhook URL (`/api/v1/webhook/:endpointId`) that accepts inbound messages from any channel (WhatsApp, Slack, SMS, email, web, custom REST), routes them through a configurable LLM, and optionally forwards AI-determined actions to a target API.

> **Not to be confused with [Widget Clients](../Subscription/README.md)** — those are self-service embeddable chat widgets with tier-based billing and message limits. Enterprise endpoints are admin-provisioned, have no message limits, support multi-channel inbound (not just web chat), and include outbound action forwarding with tool calling.

### Business Value

- **Single dynamic webhook URL** replaces hardcoded per-client routes (legacy `/silulumanzi` route removed in v1.2.0)
- **Package enforcement** — endpoints linked to contacts are gated by package status and credit balance (v1.2.0)
- **Credit tracking** — each webhook request deducts credits with full transaction audit trail (v1.2.0)
- **Multi-channel inbound** — WhatsApp, Slack, SMS, email, web, and custom REST from one codebase
- **Per-endpoint LLM configuration** — each client can use a different model, provider, temperature, and system prompt
- **Tool calling pipeline** — OpenRouter endpoints support function calling with automatic action forwarding to target APIs
- **Kill switch** — multi-layer control: endpoint status, package status, and credit balance
- **Admin UI + mobile AI creation** — endpoints can be created via the admin dashboard or by staff via voice/mobile assistant
- **Request logging & analytics** — every webhook request is logged with payload, response, duration, and status
- **Health monitoring** — integrated into the system health monitor with auto-case creation on consecutive failures
- **South African language detection** — naive detection for isiZulu, isiXhosa, Afrikaans, and English in outbound metadata
- **Per-client documentation** — each enterprise client has a dedicated profile in [Clients/](Clients/README.md)
- **AI Telemetry** — POPIA-compliant anonymized chat logging with PII sanitization for all webhook interactions (v1.3.0)
- **Client API Gateway** — standardized TypeScript proxy for all client APIs at `/api/v1/client-api/:clientId/:action`, replacing ad-hoc PHP/Python proxy files (v1.4.0)

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 4 (enterpriseWebhook.ts, adminEnterpriseEndpoints.ts, clientApiGateway.ts, adminClientApiConfigs.ts) |
| Backend service files | 4 (enterpriseEndpoints.ts, payloadNormalizer.ts, analyticsLogger.ts, **clientApiGateway.ts**) |
| Backend LOC | ~1,750 (enterprise webhook, client API gateway, admin routes, services) |
| Frontend source files | 2 (EnterpriseEndpoints.tsx, AdminAIModels.ts partial) |
| Frontend LOC | ~830 |
| Total LOC | ~2,580 |
| API endpoints | 16 (1 webhook + 7 admin CRUD + 2 client-api + 6 admin client-api-configs) |
| SQLite tables | 4 (enterprise_endpoints, endpoint_requests, client_api_configs, client_api_logs) |
| MySQL tables used | 2 (contact_packages, package_transactions — via package service) |
| Inbound providers | 6 (whatsapp, slack, custom_rest, sms, email, web) |
| LLM providers | 3 (ollama, openrouter, openai) |
| Live endpoints | 3 (Silulumanzi Water Services + 2 Soft Aware Admin) |
| Enterprise clients | 2 (see [Clients/](Clients/README.md)) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│                                                                          │
│  ┌──────────────────────────────────┐   ┌──────────────────────────┐    │
│  │ EnterpriseEndpoints.tsx          │   │ AdminAIModels.ts         │    │
│  │ • Endpoint card grid             │   │ • AdminEnterpriseModel   │    │
│  │ • Create/Edit form modal         │   │ • EnterpriseEndpoint     │    │
│  │ • Status toggle (kill switch)    │   │ • EndpointCreateInput    │    │
│  │ • Request logs viewer            │   │ • RequestLog             │    │
│  │ • Copy webhook URL               │   │ • Axios API client       │    │
│  └──────────┬───────────────────────┘   └──────────┬───────────────┘    │
│             │                                       │                    │
│             ▼                                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  api.ts — Axios client                                         │    │
│  │  GET/POST/PUT/PATCH/DELETE /admin/enterprise-endpoints/*       │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/admin/enterprise-endpoints/*  → adminEnterpriseEndpoints │    │
│  │  GET  /                — List all endpoints (admin)             │    │
│  │  GET  /:id             — Get single endpoint                   │    │
│  │  POST /                — Create endpoint (Zod validated)       │    │
│  │  PUT  /:id             — Update endpoint                       │    │
│  │  PATCH /:id/status     — Toggle kill switch                    │    │
│  │  DELETE /:id           — Delete endpoint + cascade logs        │    │
│  │  GET  /:id/logs        — Paginated request logs                │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │  /api/v1/webhook/:endpointId  → enterpriseWebhookRouter       │    │
│  │  POST /:endpointId     — Universal webhook handler (public)    │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │                                                            │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │  Services Layer                                                 │    │
│  │  enterpriseEndpoints.ts  — SQLite CRUD, request logging         │    │
│  │  payloadNormalizer.ts    — Inbound/outbound format adapters     │    │
│  │  analyticsLogger.ts      — PII-sanitized telemetry to SQLite    │    │
│  │  clientApiGateway.ts     — Client API proxy configs & routing   │    │
│  │  credentialVault.ts      — API key retrieval (OpenRouter)       │    │
│  │  healthMonitor.ts        — Enterprise endpoint health checks    │    │
│  │  mobileActionExecutor.ts — AI-driven endpoint creation          │    │
│  └──────────┬──────────────────────────────────────────────────────┘    │
│             │                                                            │
│  ┌──────────▼──────────────────────────────────────────────────────┐    │
│  │  SQLite Database: /var/opt/backend/data/enterprise_endpoints.db │    │
│  │  ┌───────────────────┐    ┌──────────────────┐                  │    │
│  │  │ enterprise_       │    │ endpoint_        │                  │    │
│  │  │ endpoints         │───▶│ requests         │                  │    │
│  │  │ (config + state)  │ FK │ (audit log)      │                  │    │
│  │  └───────────────────┘    └──────────────────┘                  │    │
│  │  ┌───────────────────┐    ┌──────────────────┐                  │    │
│  │  │ client_api_       │    │ client_api_      │                  │    │
│  │  │ configs           │───▶│ logs             │                  │    │
│  │  │ (gateway proxy)   │ FK │ (request audit)  │                  │    │
│  │  └───────────────────┘    └──────────────────┘                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘

External Services
┌──────────────────────────────────────────────────────────────────────────┐
│  Ollama (local)     — LLM inference (no tool calling)                    │
│  OpenRouter (cloud) — LLM inference + tool calling                       │
│  Target APIs        — Action forwarding (per-endpoint config)            │
│  WhatsApp/Slack/etc — Inbound message sources                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Webhook Processing Pipeline

The full lifecycle of an inbound enterprise webhook request:

```
1. RECEIVE   → POST /api/v1/webhook/:endpointId (public, no auth)
2. LOOKUP    → getEndpoint(endpointId) from SQLite → 404 if not found
3. KILL SW.  → Check status: disabled → 403, paused → 503
4. PACKAGE   → If contact_id set: check contact_packages in MySQL
               • No active subscription → 403 NO_ACTIVE_PACKAGE
               • Zero credit balance    → 402 INSUFFICIENT_CREDITS
5. NORMALIZE → normalizeInboundPayload() extracts text from provider format
6. VALIDATE  → Reject if no text extracted (400)
7. MESSAGES  → Build [system_prompt, ...last_10_history, user_message]
8. LLM CALL  → Route to configured provider:
               • Ollama:     POST /api/chat (stream=false, 60s timeout)
               • OpenRouter: POST /chat/completions (tool calling support)
9. ANALYTICS → logAnonymizedChat() — PII-sanitized, fire-and-forget to SQLite
10. TOOLS    → If OpenRouter returns tool_calls, extract first → actionData
11. FORWARD  → If action + target_api_url:
               • If URL contains /v1/client-api/ → append action as path segment
               • Client API Gateway validates action, builds auth, proxies to real target
               • POST to target (non-fatal on failure)
12. FORMAT   → formatOutboundPayload() converts to provider-specific response
13. LOG      → logRequest() writes to SQLite + increments total_requests
14. CREDITS  → If contact_id: deductCredits(10) async + log ENTERPRISE_WEBHOOK
15. RESPOND  → Set Content-Type from formatter, return formatted body
```

---

## 4. Enterprise vs Widget Clients

| Concept | Widget Clients | Enterprise Endpoints |
|---------|---------------|---------------------|
| Storage | MySQL (`widget_clients`) | SQLite (`enterprise_endpoints.db`) |
| Auth | Widget SDK (clientId embedded) | Public URL with endpoint ID |
| AI routing | Tier-based: free→Ollama, paid→OpenRouter | Per-endpoint config (any LLM) |
| Creation | User self-service (registration) | Admin-only or staff-via-mobile |
| Inbound channels | Web chat widget only | WhatsApp, Slack, SMS, Email, Web, custom REST |
| Outbound actions | None (chat-only) | Forward to target API (tool calling) |
| Message limits | Tier-based (free=500/mo … enterprise=unlimited) | Credit-based (10 credits/request, enforced per-package) |
| Knowledge base | RAG via sqlite-vec embeddings | Optional plain-text `llm_knowledge_base` field |
| Billing | `subscription_tier_limits` on `widget_clients` | Package-based credits via `contact_packages` (10 credits/request) |
| Tool calling | No | Yes (OpenRouter only) |
| Health monitoring | No | Yes (60s health check cycle) |

---

## 5. Integration Points

| System | Integration |
|--------|-------------|
| **Health Monitor** (`healthMonitor.ts`) | Checks all enterprise endpoints every 60s; records check type `enterprise`; auto-creates cases after 3 consecutive failures |
| **Mobile AI Assistant** (`mobileActionExecutor.ts`) | Staff can say "set up a webhook for client X" → `generate_enterprise_endpoint` tool creates endpoint |
| **Credential Vault** (`credentialVault.ts`) | OpenRouter API key retrieved via `getSecret('OPENROUTER')` (DB-backed with env fallback) |
| **MySQL Users** (`users` table) | Mobile endpoint creation verifies client exists in MySQL `users` table |
| **Package System** (`packages.ts`) | Webhook handler checks `contact_packages` for active subscription + credits; deducts 10 credits per request |
| **Contacts** (`contacts` table) | Each endpoint links to a MySQL contact via `contact_id` for package billing |
| **AI Telemetry** (`analyticsLogger.ts`) | All webhook interactions logged (PII-sanitized) to `ai_analytics_logs` SQLite table in vectors.db. Fire-and-forget — never blocks response. |
| **Case Management** | Health monitor auto-creates cases when enterprise endpoints fail consecutively |
| **Push Notifications** | Health monitor notifies all admin users when endpoint health changes |
| **Client API Gateway** (`clientApiGateway.ts`) | Standardized proxy for tool-call forwarding. Replaces per-client PHP/Python proxy files. Config stored in SQLite `client_api_configs`. See [CLIENT_API_STANDARDS.md](CLIENT_API_STANDARDS.md) |

---

## 6. Quick Start

### Create an endpoint (Admin API)

```bash
curl -X POST https://api.softaware.net.za/api/admin/enterprise-endpoints \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "inbound_provider": "custom_rest",
    "llm_provider": "openrouter",
    "llm_model": "openai/gpt-4o-mini",
    "llm_system_prompt": "You are a helpful customer service assistant for Acme Corp."
  }'
```

### Send a message to the webhook

```bash
curl -X POST https://api.softaware.net.za/api/v1/webhook/ep_acme-corp_a1b2c3d4 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are your business hours?",
    "phone_number": "+27821234567"
  }'
```

### Create via mobile AI assistant (staff)

```
Staff: "Set up a webhook for client john@acme.com using WhatsApp"
AI: ✅ Enterprise endpoint created!
    Endpoint ID: ep_u123_8f3a7b2c
    Webhook URL: https://api.softaware.net.za/api/v1/webhook/ep_u123_8f3a7b2c
```

---

## Related Documentation

- [Clients](Clients/README.md) — Per-client documentation (Silulumanzi, Soft Aware)
- [Client API Standards](CLIENT_API_STANDARDS.md) — Client API gateway architecture & onboarding guide
- [Routes](ROUTES.md) — Detailed route specifications
- [Files](FILES.md) — File inventory with exports and LOC
- [Fields](FIELDS.md) — Database schema definitions
- [Patterns](PATTERNS.md) — Architectural patterns
- [Changes](CHANGES.md) — Version history and known issues
- [Webhooks](../Webhooks/README.md) — Cross-cutting webhook documentation
- [Assistants](../Assistants/README.md) — RAG-powered assistant module (different system)
- [Subscription](../Subscription/README.md) — Widget tier system (different system)
