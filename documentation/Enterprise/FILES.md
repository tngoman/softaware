# Enterprise Endpoints Module — File Inventory

**Version:** 1.3.0  
**Last Updated:** 2026-03-12

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 9 (4 backend + 1 utility + 2 frontend + 2 integration) |
| **Total LOC** | ~2,120 (source) |
| **Backend route files** | 2 (~521 LOC) |
| **Backend service files** | 3 (~777 LOC) |
| **Frontend files** | 2 (~830 LOC) |
| **Integration files** | 2 (mobileActionExecutor.ts partial, healthMonitor.ts partial) |

### Directory Tree

```
Backend:
  src/routes/enterpriseWebhook.ts              (345 LOC)  Webhook handler + package enforcement + telemetry
  src/routes/adminEnterpriseEndpoints.ts       (176 LOC)  Admin CRUD API
  src/services/enterpriseEndpoints.ts          (348 LOC)  SQLite CRUD + logging
  src/services/payloadNormalizer.ts            (269 LOC)  Inbound/outbound adapters
  src/utils/analyticsLogger.ts                 (~160 LOC) ⭐ NEW — PII-sanitized telemetry logging
  src/services/mobileActionExecutor.ts         (~50 LOC)  ⭐ partial — generate_enterprise_endpoint executor
  src/services/mobileTools.ts                  (~45 LOC)  ⭐ partial — tool definition
  src/services/healthMonitor.ts                (~30 LOC)  ⭐ partial — enterprise health checks

Frontend:
  src/pages/admin/EnterpriseEndpoints.tsx      (617 LOC)  Admin UI page
  src/models/AdminAIModels.ts                  (~213 LOC) ⭐ partial — API client + types

Data:
  data/enterprise_endpoints.db                 SQLite database (WAL mode)
```

---

## 2. Backend Route Files

### `src/routes/enterpriseWebhook.ts`

**Lines of Code:** 345  
**Purpose:** Universal webhook handler with package enforcement and telemetry logging — single POST route that serves all enterprise clients

**Exported Entities:**
- `default: Router` — Express router (default export)

**Key Functions:**
- `POST /:endpointId` — Universal webhook handler (public, no auth)
- `callOllama(config, messages)` — Ollama LLM inference (internal)
- `callOpenRouter(config, messages)` — OpenRouter LLM inference with tool calling (internal)
- `forwardAction(config, actionData, normalized)` — Action forwarding to target API (internal)
- `detectLanguage(text)` — Naive SA language detection (internal)

**Dependencies:**
- `enterpriseEndpoints.ts` → `getEndpoint()`, `logRequest()`
- `payloadNormalizer.ts` → `normalizeInboundPayload()`, `formatOutboundPayload()`
- `packages.ts` → `getContactPackages()`, `deductCredits()` (MySQL package enforcement)
- `analyticsLogger.ts` → `logAnonymizedChat()` (PII-sanitized telemetry) ⭐ NEW (v1.3.0)
- `credentialVault.ts` → `getSecret('OPENROUTER')`
- `env.ts` → `OLLAMA_BASE_URL`, `OPENROUTER_BASE_URL`
- `axios` — HTTP client for LLM calls and action forwarding

**Code Excerpt:**
```typescript
router.post('/:endpointId', async (req, res) => {
  const { endpointId } = req.params;
  const config = getEndpoint(endpointId);
  
  if (!config) return res.status(404).json({ error: 'Endpoint not found' });
  if (config.status === 'disabled') return res.status(403).json({ error: 'Endpoint disabled' });
  if (config.status === 'paused') return res.status(503).json({ error: 'Endpoint paused' });
  
  // Package enforcement (v1.2.0)
  if (config.contact_id) {
    const subs = await packageService.getContactPackages(config.contact_id);
    const activeSub = subs.find(s => s.status === 'ACTIVE' || s.status === 'TRIAL');
    if (!activeSub) return res.status(403).json({ error: 'NO_ACTIVE_PACKAGE' });
    if (activeSub.credits_balance <= 0) return res.status(402).json({ error: 'INSUFFICIENT_CREDITS' });
  }
  
  const normalized = normalizeInboundPayload(config.inbound_provider, incomingPayload);
  // ... LLM call, action forwarding, response formatting, credit deduction
});
```

---

### `src/routes/adminEnterpriseEndpoints.ts`

**Lines of Code:** 176  
**Purpose:** Admin CRUD API for managing enterprise endpoints

**Exported Entities:**
- `adminEnterpriseEndpointsRouter: Router` — Express router (named export)

**Key Functions:**
- `GET /` — List all endpoints
- `GET /:id` — Get single endpoint
- `POST /` — Create endpoint (Zod validated)
- `PUT /:id` — Update endpoint (Zod validated)
- `PATCH /:id/status` — Toggle kill switch
- `DELETE /:id` — Delete endpoint (cascade deletes logs)
- `GET /:id/logs` — Paginated request logs

**Dependencies:**
- `enterpriseEndpoints.ts` → All CRUD functions
- `auth.ts` → `requireAuth`
- `requireAdmin.ts` → `requireAdmin`
- `zod` — Request validation

**Zod Schemas:**
```typescript
const createSchema = z.object({
  client_id: z.string().min(1).max(100),
  client_name: z.string().min(1).max(255),
  inbound_provider: z.enum(['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web']),
  llm_provider: z.enum(['ollama', 'openrouter', 'openai']),
  llm_model: z.string().min(1),
  llm_system_prompt: z.string().min(1),
  llm_tools_config: z.string().optional(),
  llm_temperature: z.number().min(0).max(2).optional(),
  llm_max_tokens: z.number().min(1).max(16384).optional(),
  target_api_url: z.string().url().optional().or(z.literal('')),
  target_api_auth_type: z.enum(['bearer', 'basic', 'custom', 'none']).optional(),
  target_api_auth_value: z.string().optional(),
  target_api_headers: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
```

---

## 3. Backend Service Files

### `src/services/enterpriseEndpoints.ts`

**Lines of Code:** 348  
**Purpose:** Core service — SQLite database management, CRUD operations, request logging

**Exported Entities:**
| Export | Kind | Description |
|--------|------|-------------|
| `EnterpriseEndpoint` | interface | Full endpoint shape (26 fields) |
| `EndpointCreateInput` | interface | Required fields for creation (10 fields) |
| `createEndpoint(input)` | function | Creates endpoint, generates `ep_{client_id}_{random8hex}` ID |
| `getEndpoint(id)` | function | Get single by ID |
| `getAllEndpoints()` | function | Get all (admin dashboard, health monitor) |
| `getEndpointsByClient(clientId)` | function | Get all for a specific client |
| `updateEndpoint(id, updates)` | function | Partial update (dynamic SET clause) |
| `setEndpointStatus(id, status)` | function | Kill-switch: active/paused/disabled |
| `deleteEndpoint(id)` | function | Hard delete (cascade deletes request logs) |
| `logRequest(endpointId, ...)` | function | Log to `endpoint_requests` + increment counter |
| `getRequestLogs(endpointId, limit, offset)` | function | Paginated request logs |
| `close()` | function | Close SQLite connection |

**Dependencies:**
- `better-sqlite3` — SQLite database driver
- `crypto` → `randomBytes` — ID generation

**Configuration:**
```typescript
const DB_DIR  = '/var/opt/backend/data';
const DB_PATH = '/var/opt/backend/data/enterprise_endpoints.db';
```

**Key Patterns:**
- Lazy singleton database initialization via `getDb()`
- WAL journal mode for concurrent reads
- Foreign keys enabled (`PRAGMA foreign_keys = ON`)
- Directory auto-creation (`mkdirSync` with `recursive: true`)
- Schema created on first access (`CREATE TABLE IF NOT EXISTS`)
- ID format: `ep_{client_id}_{randomBytes(4).toString('hex')}`
- Request log ID format: `req_{randomBytes(8).toString('hex')}`

---

### `src/services/payloadNormalizer.ts`

**Lines of Code:** 269  
**Purpose:** Universal adapters for inbound and outbound payload transformation

**Exported Entities:**
| Export | Kind | Description |
|--------|------|-------------|
| `NormalizedInbound` | interface | `{ text, sender_id?, channel, timestamp?, metadata? }` |
| `FormattedOutbound` | interface | `{ body, contentType }` |
| `normalizeInboundPayload(provider, payload)` | function | Switch on 6 providers → `NormalizedInbound` |
| `formatOutboundPayload(provider, aiText, action?, metadata?)` | function | Switch on 6 providers → `FormattedOutbound` |

**Inbound Provider Mappings:**

| Provider | Input Format | Extracted Text |
|----------|-------------|----------------|
| `whatsapp` | Meta Business API: `entry[0].changes[0].value.messages[0].text.body` | Message body |
| `slack` | Event API: `event.text` | Event text |
| `sms` | Twilio: `Body` field | SMS body |
| `email` | Custom: `subject` + `body` | Combined subject + body |
| `web` / `custom_rest` | Generic: `message` or `text` | Message field |

**Outbound Provider Mappings:**

| Provider | Output Format | Content-Type |
|----------|--------------|-------------|
| `whatsapp` | Meta Business API: `{ messaging_product, to, type, text }` | `application/json` |
| `slack` | Slack message: `{ text, thread_ts?, channel? }` | `application/json` |
| `sms` | TwiML XML: `<Response><Message>...</Message></Response>` | `text/xml` |
| `email` | JSON: `{ to, subject, body }` | `application/json` |
| `web` / `custom_rest` | JSON: `{ response, action, language, ... }` | `application/json` |

---

## 4. Frontend Files

### `src/pages/admin/EnterpriseEndpoints.tsx`

**Lines of Code:** 617  
**Purpose:** Admin UI page for managing enterprise endpoints

**Key Components:**
- `StatusBadge` — Color-coded status indicator (green/yellow/red)
- `EnterpriseEndpoints` — Main page component with:
  - Endpoint card grid with status badges and stats
  - Create/Edit form modal with all configuration fields
  - Status toggle (kill switch) with confirmation dialog
  - Delete with SweetAlert2 confirmation
  - Copy webhook URL to clipboard
  - Expandable request logs viewer per endpoint

**Dependencies:**
- `AdminEnterpriseModel` — API client from models
- `@heroicons/react/24/outline` — Icons
- `Card, Button, Input, Select, Textarea` — UI components
- `sweetalert2` — Confirmation dialogs

---

### `src/models/AdminAIModels.ts` (partial)

**Lines of Code:** ~213 (enterprise-related portion)  
**Purpose:** TypeScript types and Axios API client for enterprise endpoints

**Exported Entities:**
| Export | Kind | Description |
|--------|------|-------------|
| `EnterpriseEndpoint` | interface | Mirrors backend `EnterpriseEndpoint` (26 fields) |
| `EndpointCreateInput` | interface | Mirrors backend `EndpointCreateInput` (13 fields) |
| `RequestLog` | interface | Log entry: `{ id, endpoint_id, timestamp, inbound_payload, ai_response, duration_ms, status, error_message? }` |
| `AdminEnterpriseModel` | class | Static methods: `getAll()`, `get(id)`, `create(data)`, `update(id, data)`, `setStatus(id, status)`, `delete(id)`, `getLogs(id, limit, offset)` |

**Re-exported from `src/models/index.ts`:**
- `AdminEnterpriseModel`
- `EnterpriseEndpoint`

---

## 5. Integration Files (Partial)

### `src/services/mobileActionExecutor.ts` (lines ~1581–1625)

**Purpose:** Executor for `generate_enterprise_endpoint` AI tool

**Function:** `execGenerateEnterpriseEndpoint(args)` — Creates an enterprise endpoint when staff requests via mobile AI assistant.

**Flow:**
1. Extract `clientId`, `provider`, `systemPrompt` from args
2. Verify client exists in MySQL `users` table
3. Create endpoint with defaults: `openrouter` provider, `openai/gpt-4o-mini` model
4. Return webhook URL: `https://api.softaware.net.za/api/v1/webhook/{endpoint.id}`

---

### `src/services/mobileTools.ts` (lines ~951–990)

**Purpose:** Tool definition for `generate_enterprise_endpoint`

**Parameters:**
- `clientId` (required) — User ID of the client
- `provider` (required) — Inbound channel enum
- `systemPrompt` (optional) — Custom system prompt

---

### `src/services/healthMonitor.ts` (lines ~291–301, ~560–575)

**Purpose:** Enterprise endpoint health checking

**Function:** `checkEnterpriseEndpoint(endpointId)` — Verifies endpoint exists and is active. Called every 60 seconds for all endpoints. Records check type `enterprise` with name `Enterprise: {client_name}`.

---

## 6. File Relationship Map

```
External Sources                 Backend Routes                    Frontend
┌──────────────┐    ┌────────────────────────────┐    ┌──────────────────────┐
│ WhatsApp     │    │ enterpriseWebhook.ts       │    │                      │
│ Slack        │───▶│ POST /:endpointId          │    │                      │
│ SMS (Twilio) │    │ (public, no auth)          │    │                      │
│ Email        │    └────────────┬───────────────┘    │                      │
│ Web/REST     │                 │                     │                      │
└──────────────┘                 ▼                     │                      │
                    ┌────────────────────────────┐    │                      │
                    │ payloadNormalizer.ts        │    │                      │
                    │ normalize ←→ format         │    │                      │
                    └────────────┬───────────────┘    │                      │
                                 │                     │                      │
                    ┌────────────▼───────────────┐    │  EnterpriseEndpoints │
                    │ enterpriseEndpoints.ts      │◀───│  .tsx (admin page)  │
                    │ SQLite CRUD + logging       │    │                      │
                    │ getEndpoint / logRequest    │    │  AdminAIModels.ts   │
                    └────────────┬───────────────┘    │  (API client)       │
                                 │                     │                      │
                    ┌────────────▼───────────────┐    ├──────────────────────┤
                    │ adminEnterpriseEndpoints.ts │◀───│  GET/POST/PUT/PATCH │
                    │ 7 admin routes (JWT+Admin) │    │  DELETE /admin/     │
                    └────────────────────────────┘    │  enterprise-endpts  │
                                                       └──────────────────────┘
Integration Points
┌────────────────────────────────┐
│ healthMonitor.ts               │ → checkEnterpriseEndpoint() every 60s
│ mobileActionExecutor.ts        │ → execGenerateEnterpriseEndpoint()
│ mobileTools.ts                 │ → generate_enterprise_endpoint tool def
│ credentialVault.ts             │ → getSecret('OPENROUTER')
└────────────────────────────────┘

LLM Providers
┌────────────────────────────────┐
│ Ollama   → /api/chat           │ (local, no tool calling, 60s timeout)
│ OpenRouter → /chat/completions │ (cloud, tool calling, 60s timeout)
└────────────────────────────────┘

Target APIs (per-endpoint)
┌────────────────────────────────┐
│ e.g. Silulumanzi AiClient.php │ ← Action forwarding (non-fatal)
└────────────────────────────────┘
```

---

## 7. Route Registration

In `src/app.ts`:

```typescript
import enterpriseWebhookRouter from './routes/enterpriseWebhook.js';                    // L74
import { adminEnterpriseEndpointsRouter } from './routes/adminEnterpriseEndpoints.js';  // L75

apiRouter.use('/admin/enterprise-endpoints', adminEnterpriseEndpointsRouter);  // L161
apiRouter.use('/v1/webhook', enterpriseWebhookRouter);                         // L184
```

Both are also available at `/api/admin/enterprise-endpoints` and `/api/v1/webhook` (dual-mounted with `/api` prefix).

> **Note (v1.2.0):** The legacy `chatRouter` import and `apiRouter.use('/silulumanzi', chatRouter)` mount were removed. The file `src/routes/chat.ts` was archived as `_legacy_silulumanzi_chat.ts.bak`.
