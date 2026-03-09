# Webhooks Module (Enterprise Endpoints)

## Overview
The Webhooks module provides a dynamic, database-driven webhook system for enterprise clients. Each endpoint is independently configurable with its own inbound provider, LLM backend, system prompt, tool definitions, and outbound target API. The system acts as an AI-powered middleware: it receives inbound messages from various channels (WhatsApp, Slack, SMS, Email, Web, Custom REST), processes them through a configurable LLM (Ollama, OpenRouter, or OpenAI), optionally executes tool calls against a target API, and returns a formatted response in the original channel's format.

**Current Stack**: SQLite (via `better-sqlite3`) for configuration storage, Express route handlers for webhook processing, Zod for admin API validation.

## Key Responsibilities
- Dynamic webhook endpoint creation and management (no code changes required per client)
- Multi-provider inbound payload normalization (6 providers)
- Configurable LLM processing with tool calling support (Ollama, OpenRouter, OpenAI)
- Kill switch / status control per endpoint (active → paused → disabled)
- Action forwarding to target APIs when LLM requests tool execution
- Request logging with duration tracking and error capture
- Admin CRUD API with Zod validation
- Frontend admin UI for endpoint management, status toggling, and log viewing

## Architecture

### Backend
- **Service**: `src/services/enterpriseEndpoints.ts` (343 LOC) — SQLite singleton, CRUD operations, request logging
- **Webhook Route**: `src/routes/enterpriseWebhook.ts` (292 LOC) — Universal POST `/:endpointId` handler with full processing pipeline
- **Admin Route**: `src/routes/adminEnterpriseEndpoints.ts` (175 LOC) — 7 CRUD endpoints with Zod validation
- **Normalizer**: `src/services/payloadNormalizer.ts` (268 LOC) — Inbound/outbound adapters for 6 providers
- **Database**: SQLite (NOT MySQL) at `data/enterprise_endpoints.db` using `better-sqlite3` with WAL mode

### Frontend
- **Page**: `src/pages/admin/EnterpriseEndpoints.tsx` (617 LOC) — Full admin interface with table, create/edit modal, logs viewer
- **Model**: `src/models/AdminAIModels.ts` — `AdminEnterpriseModel` class + `EnterpriseEndpoint` / `RequestLog` interfaces
- **State**: Local component state with React hooks

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `better-sqlite3` | SQLite database driver (WAL mode, synchronous) |
| `crypto` | Endpoint/request ID generation (`randomBytes`) |
| `axios` | LLM API calls (Ollama, OpenRouter) and action forwarding |
| `zod` | Admin API request validation |
| `requireAuth` middleware | JWT authentication for admin routes |
| `requireAdmin` middleware | Admin-only access control |
| `@heroicons/react` | Icons in admin UI (SignalIcon, PlusIcon, etc.) |
| `sweetalert2` | User feedback dialogs in admin UI |

## Database Tables

| Table | Engine | Purpose |
|-------|--------|---------|
| `enterprise_endpoints` | SQLite | Webhook endpoint configuration (client, provider, LLM, target API) |
| `endpoint_requests` | SQLite | Request logs with payload, response, duration, and status |

## Database Schema Note
The webhook system uses a **separate SQLite database** (`data/enterprise_endpoints.db`), not the main MySQL database used by the rest of the application. This design provides:
- **Isolation**: Webhook data doesn't affect core application MySQL performance
- **Portability**: Each endpoint's configuration is self-contained
- **Simplicity**: No migration system needed; schema auto-creates on first access
- **WAL mode**: Enables concurrent reads during writes

The `llm_tools_config` and `target_api_headers` columns store **JSON strings** that are parsed at runtime. The `llm_knowledge_base` column stores optional context text injected into the system prompt.

## Key Data Flows

### Inbound Webhook Processing Pipeline
```
POST /api/v1/webhook/:endpointId
  → Fetch endpoint config from SQLite
  → Check status (active/paused/disabled kill switch)
  → Normalize inbound payload via provider adapter
  → Build conversation messages [system prompt + user message]
  → Call configured LLM (Ollama or OpenRouter)
  → If tool_call → Forward action to target API
  → Format outbound response for provider
  → Log request to endpoint_requests
  → Return formatted response (200 / 503 / 404 / 500)
```

### Endpoint Creation Flow
```
Admin UI → POST /api/admin/enterprise-endpoints (Zod validated)
  → Generate ID: ep_{client_id}_{random_hex}
  → INSERT into enterprise_endpoints
  → Return endpoint with webhook URL
  → Admin copies URL: /api/v1/webhook/{endpoint_id}
  → Client configures their system to POST to that URL
```

### Kill Switch (Status Toggle)
```
Admin UI → PATCH /api/admin/enterprise-endpoints/:id/status
  → Update status to active/paused/disabled
  → Next webhook request checks status:
    - active: process normally
    - paused: return 503 "Endpoint is paused"
    - disabled: return 503 "Endpoint is disabled"
```

### LLM Provider Routing
```
Endpoint config: llm_provider = "ollama" | "openrouter" | "openai"
  → ollama:     POST ${OLLAMA_BASE_URL}/api/chat
  → openrouter: POST ${OPENROUTER_BASE_URL}/chat/completions
  → openai:     (same OpenAI-compatible format as OpenRouter)
```

### Tool Call → Action Forwarding
```
LLM returns: { tool_calls: [{ function: { name, arguments } }] }
  → Extract action name + arguments
  → POST to endpoint.target_api_url with:
    - Auth headers (bearer/basic/custom)
    - Custom headers from target_api_headers JSON
    - Body: { action, parameters, endpoint_id, client_id }
  → Return action result in outbound response
```

## Frontend Integration Points

| Feature | Component | Usage |
|---------|-----------|-------|
| Endpoint management table | `EnterpriseEndpoints.tsx` | List, expand details, copy webhook URL |
| Create/edit modal | `EnterpriseEndpoints.tsx` | Form with all endpoint configuration fields |
| Status toggle | `EnterpriseEndpoints.tsx` | Quick pause/activate with SweetAlert confirmation |
| Request logs viewer | `EnterpriseEndpoints.tsx` | Modal with paginated logs, payload inspection |
| Webhook URL copy | `EnterpriseEndpoints.tsx` | One-click copy to clipboard |

## Provider Support Matrix

| Provider | Inbound Normalization | Outbound Formatting | Notes |
|----------|----------------------|---------------------|-------|
| `whatsapp` | Meta/Twilio payload → text + sender | JSON `{ to, type, text }` | Supports both Meta Cloud API and Twilio formats |
| `slack` | Event API → text + channel | JSON `{ text }` | Event subscription format |
| `sms` | Twilio SMS → text + from | JSON `{ body, to }` | Standard Twilio SMS webhook |
| `email` | Subject + body + from | JSON `{ to, subject, body }` | Generic email webhook format |
| `web` | `{ message }` or `{ text }` → text | JSON `{ response }` | Simple web chat integration |
| `custom_rest` | Pass-through with text extraction | JSON `{ response, action }` | Generic REST API format |

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama API base URL | `http://localhost:11434` |
| `OPENROUTER_BASE_URL` | OpenRouter API base URL | `https://openrouter.ai/api/v1` |
| `OPENROUTER_API_KEY` | OpenRouter authentication key | `sk-or-...` |
