# Webhooks — Field & Data Dictionary

## Database Engine: SQLite
**File**: `data/enterprise_endpoints.db`  
**Driver**: `better-sqlite3`  
**Mode**: WAL (Write-Ahead Logging)  
**Foreign Keys**: Enabled (`PRAGMA foreign_keys = ON`)

> ⚠️ This module uses a **separate SQLite database**, not the main MySQL database.

---

## Database Schema: `enterprise_endpoints` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `TEXT` (PK) | No | — | Auto-generated: `ep_{client_id}_{random_hex}` |
| `client_id` | `TEXT` | No | — | Client identifier (e.g., `silulumanzi`) |
| `client_name` | `TEXT` | No | — | Human-readable client name |
| `status` | `TEXT` | No | `'active'` | Endpoint status: `active` / `paused` / `disabled` |
| `inbound_provider` | `TEXT` | No | — | Inbound channel: `whatsapp` / `slack` / `custom_rest` / `sms` / `email` / `web` |
| `inbound_auth_type` | `TEXT` | Yes | `NULL` | Auth method for inbound: `api_key` / `bearer` / `basic` / `none` |
| `inbound_auth_value` | `TEXT` | Yes | `NULL` | Auth credential for inbound verification |
| `llm_provider` | `TEXT` | No | — | LLM backend: `ollama` / `openrouter` / `openai` |
| `llm_model` | `TEXT` | No | — | Model identifier (e.g., `qwen2.5:3b-instruct`) |
| `llm_temperature` | `REAL` | No | `0.3` | LLM sampling temperature (0–2) |
| `llm_max_tokens` | `INTEGER` | No | `1024` | Maximum response tokens (1–16384) |
| `llm_system_prompt` | `TEXT` | No | — | System prompt sent to LLM |
| `llm_tools_config` | `TEXT` | Yes | `NULL` | JSON array of OpenAI-format tool definitions |
| `llm_knowledge_base` | `TEXT` | Yes | `NULL` | Optional knowledge context appended to system prompt |
| `target_api_url` | `TEXT` | Yes | `NULL` | URL to forward tool call actions to |
| `target_api_auth_type` | `TEXT` | Yes | `NULL` | Target API auth: `bearer` / `basic` / `custom` / `none` |
| `target_api_auth_value` | `TEXT` | Yes | `NULL` | Target API auth credential |
| `target_api_headers` | `TEXT` | Yes | `NULL` | JSON object of custom headers for target API |
| `created_at` | `TEXT` | No | — | ISO 8601 timestamp |
| `updated_at` | `TEXT` | No | — | ISO 8601 timestamp |
| `last_request_at` | `TEXT` | Yes | `NULL` | ISO 8601 timestamp of last webhook request |
| `total_requests` | `INTEGER` | No | `0` | Lifetime request counter |

### CHECK Constraints
```sql
CHECK(status IN ('active', 'paused', 'disabled'))
```

### ID Generation
```typescript
const id = `ep_${input.client_id}_${crypto.randomBytes(6).toString('hex')}`;
// Example: "ep_silulumanzi_a1b2c3d4e5f6"
```

---

## Database Schema: `endpoint_requests` Table

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `TEXT` (PK) | No | — | Auto-generated: `req_{random_hex}` |
| `endpoint_id` | `TEXT` (FK) | No | — | References `enterprise_endpoints.id` |
| `timestamp` | `TEXT` | No | — | ISO 8601 timestamp |
| `inbound_payload` | `TEXT` | Yes | `NULL` | JSON string of raw inbound payload |
| `ai_response` | `TEXT` | Yes | `NULL` | JSON string of LLM response |
| `duration_ms` | `INTEGER` | Yes | `NULL` | Request processing time in milliseconds |
| `status` | `TEXT` | Yes | `NULL` | `success` or `error` |
| `error_message` | `TEXT` | Yes | `NULL` | Error details (if status = `error`) |

### Foreign Key Constraint
```sql
FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
```

### Request ID Generation
```typescript
const id = `req_${crypto.randomBytes(8).toString('hex')}`;
// Example: "req_a1b2c3d4e5f6a7b8"
```

---

## Zod Validation Schemas (Admin API)

### `createSchema`
Used by: `POST /api/admin/enterprise-endpoints`

```typescript
const createSchema = z.object({
  client_id:            z.string().min(1),
  client_name:          z.string().min(1),
  inbound_provider:     z.enum(['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web']),
  llm_provider:         z.enum(['ollama', 'openrouter', 'openai']),
  llm_model:            z.string().min(1),
  llm_system_prompt:    z.string().min(1),
  llm_tools_config:     z.string().optional(),                   // JSON array string
  llm_temperature:      z.number().min(0).max(2).optional(),     // default: 0.3
  llm_max_tokens:       z.number().min(1).max(16384).optional(), // default: 1024
  target_api_url:       z.string().optional(),
  target_api_auth_type: z.string().optional(),                   // bearer/basic/custom/none
  target_api_auth_value:z.string().optional(),
  target_api_headers:   z.string().optional(),                   // JSON object string
});
```

### `updateSchema`
Used by: `PUT /api/admin/enterprise-endpoints/:id`

```typescript
const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
});
```

### `statusSchema`
Used by: `PATCH /api/admin/enterprise-endpoints/:id/status`

```typescript
const statusSchema = z.object({
  status: z.enum(['active', 'paused', 'disabled']),
});
```

---

## TypeScript Interfaces

### Backend: `EnterpriseEndpoint`
**File**: `src/services/enterpriseEndpoints.ts`

```typescript
interface EnterpriseEndpoint {
  id: string;
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  inbound_provider: string;
  inbound_auth_type: string | null;
  inbound_auth_value: string | null;
  llm_provider: string;
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  llm_system_prompt: string;
  llm_tools_config: string | null;
  llm_knowledge_base: string | null;
  target_api_url: string | null;
  target_api_auth_type: string | null;
  target_api_auth_value: string | null;
  target_api_headers: string | null;
  created_at: string;
  updated_at: string;
  last_request_at: string | null;
  total_requests: number;
}
```

### Backend: `EndpointCreateInput`
**File**: `src/services/enterpriseEndpoints.ts`

```typescript
interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  inbound_provider: string;
  llm_provider: string;
  llm_model: string;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_knowledge_base?: string;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
  target_api_headers?: string;
}
```

### Frontend: `EnterpriseEndpoint`
**File**: `src/models/AdminAIModels.ts`

```typescript
export interface EnterpriseEndpoint {
  id: string;
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  inbound_provider: string;
  inbound_auth_type?: string;
  llm_provider: string;
  llm_model: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_knowledge_base?: string;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
  target_api_headers?: string;
  created_at: string;
  updated_at: string;
  last_request_at?: string;
  total_requests: number;
}
```

### Frontend: `EndpointCreateInput`
**File**: `src/models/AdminAIModels.ts`

```typescript
export interface EndpointCreateInput {
  client_id: string;
  client_name: string;
  inbound_provider: string;
  llm_provider: string;
  llm_model: string;
  llm_system_prompt: string;
  llm_tools_config?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  target_api_url?: string;
  target_api_auth_type?: string;
  target_api_auth_value?: string;
  target_api_headers?: string;
}
```

### Frontend: `RequestLog`
**File**: `src/models/AdminAIModels.ts`

```typescript
export interface RequestLog {
  id: string;
  endpoint_id: string;
  timestamp: string;
  inbound_payload: string;
  ai_response: string;
  duration_ms: number;
  status: string;
  error_message?: string;
}
```

---

## Normalizer Interfaces

### `NormalizedInbound`
**File**: `src/services/payloadNormalizer.ts`

```typescript
interface NormalizedInbound {
  text: string;
  sender_id: string;
  channel: string;
  timestamp: string;
  metadata: Record<string, any>;
}
```

### `FormattedOutbound`
**File**: `src/services/payloadNormalizer.ts`

```typescript
interface FormattedOutbound {
  body: any;
  contentType: string;
}
```

---

## API Response Schemas

### Success: List Endpoints
```json
{
  "success": true,
  "data": [
    {
      "id": "ep_silulumanzi_a1b2c3d4e5f6",
      "client_id": "silulumanzi",
      "client_name": "Silulumanzi Water Services",
      "status": "active",
      "inbound_provider": "whatsapp",
      "llm_provider": "ollama",
      "llm_model": "qwen2.5:3b-instruct",
      "llm_temperature": 0.3,
      "llm_max_tokens": 1024,
      "llm_system_prompt": "You are a helpful water services assistant...",
      "total_requests": 142,
      "last_request_at": "2026-03-15T10:30:00.000Z",
      "created_at": "2026-02-01T08:00:00.000Z",
      "updated_at": "2026-03-10T14:00:00.000Z"
    }
  ]
}
```

### Success: Webhook Response (Custom REST)
```json
{
  "response": "Your account balance is R1,250.00. Your next payment of R350 is due on 2026-04-01.",
  "action": null
}
```

### Success: Webhook Response (WhatsApp)
```json
{
  "messaging_product": "whatsapp",
  "to": "27821234567",
  "type": "text",
  "text": {
    "body": "Your account balance is R1,250.00."
  }
}
```

### Error: Endpoint Not Found
```json
{
  "error": "Endpoint not found"
}
```

### Error: Endpoint Paused
```json
{
  "error": "Endpoint is paused"
}
```

### Error: Validation Failed
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "code": "too_small", "minimum": 1, "path": ["client_id"], "message": "String must contain at least 1 character(s)" }
  ]
}
```

---

## JSON Column Formats

### `llm_tools_config` (OpenAI Function Calling Format)
```json
[
  {
    "type": "function",
    "function": {
      "name": "check_balance",
      "description": "Check a customer's account balance",
      "parameters": {
        "type": "object",
        "properties": {
          "account_number": { "type": "string", "description": "Customer account number" }
        },
        "required": ["account_number"]
      }
    }
  }
]
```

### `target_api_headers` (Custom Headers Object)
```json
{
  "X-Client-ID": "silulumanzi",
  "X-API-Version": "2.0",
  "Content-Type": "application/json"
}
```

---

## Enum Value Reference

### `status` (Endpoint Status)
| Value | Description | Webhook Behavior |
|-------|-------------|------------------|
| `active` | Endpoint is live | Processes requests normally |
| `paused` | Temporarily stopped | Returns 503 "Endpoint is paused" |
| `disabled` | Permanently stopped | Returns 503 "Endpoint is disabled" |

### `inbound_provider` (Inbound Channel)
| Value | Description |
|-------|-------------|
| `whatsapp` | WhatsApp Business API (Meta or Twilio) |
| `slack` | Slack Event API |
| `sms` | SMS via Twilio |
| `email` | Email webhook |
| `web` | Web chat widget |
| `custom_rest` | Generic REST API |

### `llm_provider` (LLM Backend)
| Value | Description | API Format |
|-------|-------------|------------|
| `ollama` | Local Ollama instance | `/api/chat` (Ollama native) |
| `openrouter` | OpenRouter cloud API | `/chat/completions` (OpenAI compatible) |
| `openai` | Direct OpenAI API | `/chat/completions` (OpenAI native) |

### `inbound_auth_type` / `target_api_auth_type`
| Value | Description |
|-------|-------------|
| `api_key` | API key in header |
| `bearer` | Bearer token in Authorization header |
| `basic` | Basic auth (username:password base64) |
| `custom` | Custom header format |
| `none` | No authentication |
