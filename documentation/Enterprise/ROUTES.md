# Enterprise Endpoints Module — API Routes

**Version:** 1.3.0  
**Last Updated:** 2026-03-12

---

## 1. Overview

The Enterprise Endpoints module exposes **8 API endpoints** across 2 route files:

| Route File | Base Path | Endpoints | Description |
|------------|-----------|-----------|-------------|
| enterpriseWebhook.ts | /api/v1/webhook | 1 | Universal webhook handler (public) |
| adminEnterpriseEndpoints.ts | /api/admin/enterprise-endpoints | 7 | Admin CRUD + logs (JWT + Admin) |

**Base URL:** `https://api.softaware.net.za`

**Authentication:**
- 🔓 Public: Webhook endpoint (no auth — identified by endpoint ID in URL)
- 🔒 `requireAuth` + `requireAdmin`: All admin endpoints

---

## 2. Endpoint Directory

### Webhook (Public)

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | POST | /api/v1/webhook/:endpointId | None | Universal webhook handler |

### Admin CRUD

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 2 | GET | /api/admin/enterprise-endpoints | JWT + Admin | List all endpoints |
| 3 | GET | /api/admin/enterprise-endpoints/:id | JWT + Admin | Get single endpoint |
| 4 | POST | /api/admin/enterprise-endpoints | JWT + Admin | Create endpoint |
| 5 | PUT | /api/admin/enterprise-endpoints/:id | JWT + Admin | Update endpoint |
| 6 | PATCH | /api/admin/enterprise-endpoints/:id/status | JWT + Admin | Toggle kill switch |
| 7 | DELETE | /api/admin/enterprise-endpoints/:id | JWT + Admin | Delete endpoint |
| 8 | GET | /api/admin/enterprise-endpoints/:id/logs | JWT + Admin | Get request logs |

---

## 3. Webhook Endpoint

### POST `/api/v1/webhook/:endpointId`

**Source:** `src/routes/enterpriseWebhook.ts`  
**Purpose:** Universal webhook handler with package enforcement and telemetry logging — accepts inbound messages from any channel, verifies package subscription and credits, processes through LLM, logs anonymized analytics, deducts credits, returns formatted response  
**Auth:** None (public — endpoint identified by unique ID in URL; package enforcement via contact_id link)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `endpointId` | string | Unique endpoint ID (e.g., `ep_silulumanzi_91374147`) |

**Request Body (custom_rest / web):**
```json
{
  "message": "What are your business hours?",
  "phone_number": "+27821234567",
  "channel": "web",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Request Body (WhatsApp — Meta Business API):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "27821234567",
          "text": { "body": "What are your business hours?" },
          "timestamp": "1710000000"
        }]
      }
    }]
  }]
}
```

**Request Body (Slack — Event API):**
```json
{
  "event": {
    "type": "message",
    "text": "What are your business hours?",
    "user": "U12345",
    "channel": "C67890",
    "ts": "1710000000.123456"
  }
}
```

**Request Body (SMS — Twilio):**
```json
{
  "From": "+27821234567",
  "Body": "What are your business hours?",
  "MessageSid": "SM1234567890"
}
```

**Request Body (Email):**
```json
{
  "from": "user@example.com",
  "subject": "Question about hours",
  "body": "What are your business hours?"
}
```

**Response (200 OK — custom_rest/web):**
```json
{
  "response": "Our business hours are Monday to Friday, 8am to 5pm.",
  "action": "reply",
  "language": "en"
}
```

**Response (200 OK — WhatsApp):**
```json
{
  "messaging_product": "whatsapp",
  "to": "27821234567",
  "type": "text",
  "text": { "body": "Our business hours are Monday to Friday, 8am to 5pm." }
}
```

**Response (200 OK — Slack):**
```json
{
  "text": "Our business hours are Monday to Friday, 8am to 5pm.",
  "thread_ts": "1710000000.123456",
  "channel": "C67890"
}
```

**Response (200 OK — SMS, Content-Type: text/xml):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Our business hours are Monday to Friday, 8am to 5pm.</Message>
</Response>
```

**Response (200 OK — Email):**
```json
{
  "to": "user@example.com",
  "subject": "Re: Question about hours",
  "body": "Our business hours are Monday to Friday, 8am to 5pm."
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Endpoint ID not found | `{ "error": "Endpoint not found", "message": "No enterprise endpoint configured with ID: ..." }` |
| 403 | Endpoint disabled | `{ "error": "Endpoint disabled", "message": "This endpoint has been disabled by the administrator" }` |
| 403 | No active package | `{ "error": "NO_ACTIVE_PACKAGE", "message": "This endpoint is linked to a contact with no active package subscription." }` |
| 402 | No credits remaining | `{ "error": "INSUFFICIENT_CREDITS", "message": "This endpoint has exhausted its credit allocation...", "balance": 0 }` |
| 503 | Endpoint paused | `{ "error": "Endpoint paused", "message": "This endpoint is temporarily paused. Please try again later." }` |
| 400 | No message text | `{ "error": "Invalid payload", "message": "No message text found in the request" }` |
| 500 | Processing error | `{ "error": "Processing error", "message": "An error occurred while processing your request" }` |

**Processing Pipeline:**
1. Lookup endpoint config from SQLite
2. Check kill switch (disabled → 403, paused → 503)
3. **Package enforcement** — if `contact_id` set, check `contact_packages` in MySQL:
   - No ACTIVE/TRIAL subscription → 403 `NO_ACTIVE_PACKAGE`
   - Zero credit balance → 402 `INSUFFICIENT_CREDITS`
4. Normalize inbound payload via `normalizeInboundPayload()`
5. Build LLM messages: `[system_prompt, ...last_10_history, user_message]`
6. Call configured LLM (Ollama or OpenRouter)
7. If tool call returned (OpenRouter only), forward action to target API
8. Format response via `formatOutboundPayload()`
9. Log request to SQLite `endpoint_requests`
10. **Credit deduction** — if `contact_id` set, async deduct 10 credits via `packageService.deductCredits()`
11. Return formatted response with appropriate Content-Type

**LLM Provider Routing:**

| Provider | Endpoint | Timeout | Tool Calling | Auth |
|----------|----------|---------|-------------|------|
| `ollama` | `{OLLAMA_BASE_URL}/api/chat` | 60s | No | None (local) |
| `openrouter` | `{OPENROUTER_BASE_URL}/chat/completions` | 60s | Yes | `Bearer {credentialVault.OPENROUTER}` |

**Action Forwarding (OpenRouter only):**

When the LLM returns a `tool_calls` response, the first tool call is extracted and forwarded to the endpoint's `target_api_url` with:
- Auth headers based on `target_api_auth_type` (bearer/basic/custom)
- Custom headers from `target_api_headers` (JSON)
- Payload: `{ ...tool_arguments, phone_number, sender_id, action }`
- Timeout: 30s
- **Non-fatal** — failure is logged but AI response is still returned

---

## 4. Admin Endpoints

### GET `/api/admin/enterprise-endpoints`

**Source:** `src/routes/adminEnterpriseEndpoints.ts`  
**Purpose:** List all enterprise endpoints for admin dashboard  
**Auth:** JWT + Admin

**Request:**
```bash
curl -X GET https://api.softaware.net.za/api/admin/enterprise-endpoints \
  -H "Authorization: Bearer <admin-jwt>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "ep_silulumanzi_91374147",
      "client_id": "silulumanzi",
      "client_name": "Silulumanzi Water Services",
      "status": "active",
      "inbound_provider": "custom_rest",
      "llm_provider": "openrouter",
      "llm_model": "openai/gpt-4o-mini",
      "llm_temperature": 0.3,
      "llm_max_tokens": 1024,
      "llm_system_prompt": "You are a helpful assistant for Silulumanzi Water Services...",
      "llm_tools_config": "[...]",
      "llm_knowledge_base": null,
      "target_api_url": "https://softaware.net.za/AiClient.php",
      "target_api_auth_type": "bearer",
      "target_api_auth_value": "...",
      "target_api_headers": null,
      "created_at": "2026-03-06T10:00:00.000Z",
      "updated_at": "2026-03-08T14:30:00.000Z",
      "last_request_at": "2026-03-10T09:15:22.000Z",
      "total_requests": 2
    }
  ]
}
```

**Database Query:**
```sql
SELECT * FROM enterprise_endpoints ORDER BY created_at DESC
```

---

### GET `/api/admin/enterprise-endpoints/:id`

**Purpose:** Get single endpoint with full configuration  
**Auth:** JWT + Admin

**Request:**
```bash
curl -X GET https://api.softaware.net.za/api/admin/enterprise-endpoints/ep_silulumanzi_91374147 \
  -H "Authorization: Bearer <admin-jwt>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* full EnterpriseEndpoint object */ }
}
```

**Error Responses:**
- `404` — `{ "success": false, "error": "Endpoint not found" }`

**Database Query:**
```sql
SELECT * FROM enterprise_endpoints WHERE id = ?
```

---

### POST `/api/admin/enterprise-endpoints`

**Purpose:** Create a new enterprise endpoint  
**Auth:** JWT + Admin

**Request Body (Zod validated):**
```json
{
  "client_id": "acme-corp",
  "client_name": "Acme Corporation",
  "inbound_provider": "custom_rest",
  "llm_provider": "openrouter",
  "llm_model": "openai/gpt-4o-mini",
  "llm_system_prompt": "You are a helpful customer service assistant for Acme Corp.",
  "llm_tools_config": "[{\"type\":\"function\",\"function\":{...}}]",
  "llm_temperature": 0.3,
  "llm_max_tokens": 1024,
  "target_api_url": "https://acme.com/api/actions",
  "target_api_auth_type": "bearer",
  "target_api_auth_value": "secret-token",
  "target_api_headers": "{\"X-Custom-Header\":\"value\"}"
}
```

**Validation Rules:**
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `client_id` | string | Yes | 1–100 chars |
| `client_name` | string | Yes | 1–255 chars |
| `inbound_provider` | enum | Yes | whatsapp, slack, custom_rest, sms, email, web |
| `llm_provider` | enum | Yes | ollama, openrouter, openai |
| `llm_model` | string | Yes | Min 1 char |
| `llm_system_prompt` | string | Yes | Min 1 char |
| `llm_tools_config` | string | No | JSON array of tool definitions |
| `llm_temperature` | number | No | 0–2 |
| `llm_max_tokens` | number | No | 1–16384 |
| `target_api_url` | string | No | Valid URL or empty string |
| `target_api_auth_type` | enum | No | bearer, basic, custom, none |
| `target_api_auth_value` | string | No | Auth credential |
| `target_api_headers` | string | No | JSON object of custom headers |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "ep_acme-corp_a1b2c3d4",
    "client_id": "acme-corp",
    "client_name": "Acme Corporation",
    "status": "active",
    "total_requests": 0,
    "created_at": "2026-03-10T12:00:00.000Z",
    "updated_at": "2026-03-10T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` — `{ "success": false, "error": "Validation failed", "details": [...] }`

**ID Generation:**
```typescript
const id = `ep_${input.client_id}_${randomBytes(4).toString('hex')}`;
```

---

### PUT `/api/admin/enterprise-endpoints/:id`

**Purpose:** Update an enterprise endpoint's configuration  
**Auth:** JWT + Admin

**Request Body:** Same schema as POST but all fields optional. Includes additional:
- `status`: `'active' | 'paused' | 'disabled'` (optional)

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* updated EnterpriseEndpoint object */ }
}
```

**Error Responses:**
- `404` — Endpoint not found
- `400` — Validation failed

**Database:**
```sql
UPDATE enterprise_endpoints SET field1 = ?, field2 = ?, updated_at = ? WHERE id = ?
-- Dynamic SET clause — only provided fields are updated
```

---

### PATCH `/api/admin/enterprise-endpoints/:id/status`

**Purpose:** Quick status toggle — kill switch  
**Auth:** JWT + Admin

**Request Body:**
```json
{ "status": "paused" }
```

**Allowed Values:** `active`, `paused`, `disabled`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Endpoint ep_silulumanzi_91374147 set to paused"
}
```

**Error Responses:**
- `404` — Endpoint not found
- `400` — Invalid status value

**Kill Switch Behavior:**

| Status | Webhook Response | Description |
|--------|-----------------|-------------|
| `active` | Normal processing | Endpoint fully operational |
| `paused` | `503 Service Unavailable` | Temporary pause — clients should retry |
| `disabled` | `403 Forbidden` | Hard block — admin must re-enable |

---

### DELETE `/api/admin/enterprise-endpoints/:id`

**Purpose:** Permanently delete an enterprise endpoint  
**Auth:** JWT + Admin

**Request:**
```bash
curl -X DELETE https://api.softaware.net.za/api/admin/enterprise-endpoints/ep_acme-corp_a1b2c3d4 \
  -H "Authorization: Bearer <admin-jwt>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Endpoint ep_acme-corp_a1b2c3d4 deleted"
}
```

**Error Responses:**
- `404` — Endpoint not found

**Side Effects:**
- Cascade deletes all request logs (`endpoint_requests`) via `ON DELETE CASCADE` foreign key

---

### GET `/api/admin/enterprise-endpoints/:id/logs`

**Purpose:** Get paginated request logs for an endpoint  
**Auth:** JWT + Admin

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max results per page |
| `offset` | number | 0 | Pagination offset |

**Request:**
```bash
curl -X GET "https://api.softaware.net.za/api/admin/enterprise-endpoints/ep_silulumanzi_91374147/logs?limit=20&offset=0" \
  -H "Authorization: Bearer <admin-jwt>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "req_a1b2c3d4e5f6g7h8",
      "endpoint_id": "ep_silulumanzi_91374147",
      "timestamp": "2026-03-10T09:15:22.000Z",
      "inbound_payload": "{\"message\":\"What are your hours?\",\"phone_number\":\"+27821234567\"}",
      "ai_response": "{\"response\":\"Our hours are...\",\"action\":\"reply\",\"language\":\"en\"}",
      "duration_ms": 2340,
      "status": "success",
      "error_message": null
    }
  ]
}
```

**Database Query:**
```sql
SELECT * FROM endpoint_requests
WHERE endpoint_id = ?
ORDER BY timestamp DESC
LIMIT ? OFFSET ?
```

---

## 5. Mobile AI Tool (Staff Only)

### Tool: `generate_enterprise_endpoint`

**Source:** `src/services/mobileTools.ts` (definition), `src/services/mobileActionExecutor.ts` (executor)  
**Trigger:** Staff says "set up a webhook for client X", "create an enterprise endpoint", etc.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientId` | string | Yes | User ID of the client |
| `provider` | enum | Yes | whatsapp, slack, custom_rest, sms, email, web |
| `systemPrompt` | string | No | Custom system prompt (default: "You are a helpful customer service assistant.") |

**Processing:**
1. Validate `clientId` exists in MySQL `users` table
2. Create endpoint with defaults: `llm_provider: 'openrouter'`, `llm_model: env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'`
3. Return webhook URL

**Response (success):**
```
✅ Enterprise endpoint created!

**Endpoint ID:** ep_u123_8f3a7b2c
**Webhook URL:** https://api.softaware.net.za/api/v1/webhook/ep_u123_8f3a7b2c
**Provider:** custom_rest
**Client:** John Doe

The client can start sending requests to this URL immediately.
```

**Response (error):**
```
Client not found.
```
