# Webhooks — Route & API Reference

## Route Registration

### Webhook Route (Public)
**Backend mount point**: `/v1/webhook` (no authentication required)

```
src/routes/enterpriseWebhook.ts → enterpriseWebhookRouter mounted at /v1/webhook
Full URL: /api/v1/webhook/:endpointId
```

### Admin Routes (Protected)
**Backend mount point**: `/admin/enterprise-endpoints` (requires `requireAuth` + `requireAdmin`)

```
src/routes/adminEnterpriseEndpoints.ts → adminEnterpriseEndpointsRouter mounted at /admin/enterprise-endpoints
Full URL: /api/admin/enterprise-endpoints/*
```

---

## Route Summary

### Webhook Route
| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | POST | `/api/v1/webhook/:endpointId` | None (endpoint-level auth) | Process inbound webhook request |

### Admin Routes
| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 2 | GET | `/api/admin/enterprise-endpoints` | JWT + Admin | List all endpoints |
| 3 | GET | `/api/admin/enterprise-endpoints/:id` | JWT + Admin | Get single endpoint |
| 4 | POST | `/api/admin/enterprise-endpoints` | JWT + Admin | Create new endpoint |
| 5 | PUT | `/api/admin/enterprise-endpoints/:id` | JWT + Admin | Update endpoint |
| 6 | PATCH | `/api/admin/enterprise-endpoints/:id/status` | JWT + Admin | Toggle endpoint status (kill switch) |
| 7 | DELETE | `/api/admin/enterprise-endpoints/:id` | JWT + Admin | Delete endpoint and all logs |
| 8 | GET | `/api/admin/enterprise-endpoints/:id/logs` | JWT + Admin | Get paginated request logs |

---

## Detailed Route Documentation

### 1. POST `/api/v1/webhook/:endpointId`
**Purpose**: Process an inbound webhook request through the configured AI pipeline  
**Auth**: None (public endpoint; optional endpoint-level `inbound_auth_type` validation)  
**Source**: `src/routes/enterpriseWebhook.ts`

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `endpointId` | `string` | Endpoint ID (e.g., `ep_silulumanzi_a1b2c3d4e5f6`) |

**Request body**: Provider-specific payload (see Provider Payloads below)

**Processing Pipeline**:
```
1. getEndpoint(endpointId)              → Fetch config from SQLite
2. Check status                          → 404 if not found, 503 if paused/disabled
3. normalizeInboundPayload(provider, body) → Extract text, sender_id, channel
4. Build messages array                  → [system prompt, user message]
5. Call LLM (callOllama or callOpenRouter) → Get AI response
6. If tool_call → forwardAction()        → POST to target_api_url
7. formatOutboundPayload(provider, text) → Format for channel
8. logRequest()                          → Log to endpoint_requests
9. Return formatted response             → 200 OK
```

**SQLite Queries**:
```sql
-- Step 1: Fetch endpoint config
SELECT * FROM enterprise_endpoints WHERE id = ?

-- Step 8: Log the request
INSERT INTO endpoint_requests (id, endpoint_id, timestamp, inbound_payload, ai_response, duration_ms, status, error_message)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)

-- Step 8: Update request counter
UPDATE enterprise_endpoints SET total_requests = total_requests + 1, last_request_at = ? WHERE id = ?
```

**Success Response** (200):
Provider-dependent format. Example for `custom_rest`:
```json
{
  "response": "Your account balance is R1,250.00. Your next payment is due on 2026-04-01.",
  "action": null
}
```

Example for `whatsapp`:
```json
{
  "messaging_product": "whatsapp",
  "to": "27821234567",
  "type": "text",
  "text": { "body": "Your account balance is R1,250.00." }
}
```

**Error Responses**:
| Status | Body | Condition |
|--------|------|-----------|
| 404 | `{ "error": "Endpoint not found" }` | No endpoint with that ID |
| 503 | `{ "error": "Endpoint is paused" }` | Status = `paused` |
| 503 | `{ "error": "Endpoint is disabled" }` | Status = `disabled` |
| 500 | `{ "error": "Webhook processing failed" }` | Any unhandled error |

---

### Provider Payloads (Inbound)

#### WhatsApp (Meta Cloud API)
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "27821234567",
          "text": { "body": "What is my balance?" },
          "timestamp": "1710500000"
        }]
      }
    }]
  }]
}
```

#### WhatsApp (Twilio)
```json
{
  "Body": "What is my balance?",
  "From": "whatsapp:+27821234567",
  "To": "whatsapp:+27831234567"
}
```

#### Slack (Event API)
```json
{
  "event": {
    "type": "message",
    "text": "What is my balance?",
    "user": "U12345678",
    "channel": "C12345678",
    "ts": "1710500000.000000"
  }
}
```

#### SMS (Twilio)
```json
{
  "Body": "What is my balance?",
  "From": "+27821234567",
  "To": "+27831234567"
}
```

#### Email
```json
{
  "from": "customer@example.com",
  "subject": "Balance inquiry",
  "body": "What is my account balance?",
  "to": "support@company.com"
}
```

#### Web (Chat Widget)
```json
{
  "message": "What is my balance?",
  "session_id": "sess_abc123"
}
```

#### Custom REST
```json
{
  "text": "What is my balance?",
  "sender_id": "customer_123",
  "metadata": { "source": "mobile_app" }
}
```

---

### 2. GET `/api/admin/enterprise-endpoints`
**Purpose**: List all enterprise endpoints  
**Auth**: JWT + Admin required  
**Source**: `src/routes/adminEnterpriseEndpoints.ts`

**SQLite Query**:
```sql
SELECT * FROM enterprise_endpoints ORDER BY created_at DESC
```

**Success Response** (200):
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
      "llm_tools_config": "[{\"type\":\"function\",...}]",
      "target_api_url": "https://api.silulumanzi.co.za/v1/actions",
      "target_api_auth_type": "bearer",
      "total_requests": 142,
      "last_request_at": "2026-03-15T10:30:00.000Z",
      "created_at": "2026-02-01T08:00:00.000Z",
      "updated_at": "2026-03-10T14:00:00.000Z"
    }
  ]
}
```

---

### 3. GET `/api/admin/enterprise-endpoints/:id`
**Purpose**: Get a single endpoint by ID  
**Auth**: JWT + Admin required

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Endpoint ID |

**SQLite Query**:
```sql
SELECT * FROM enterprise_endpoints WHERE id = ?
```

**Success Response** (200):
```json
{
  "success": true,
  "data": { /* full endpoint object */ }
}
```

**Error Response** (404):
```json
{ "success": false, "error": "Endpoint not found" }
```

---

### 4. POST `/api/admin/enterprise-endpoints`
**Purpose**: Create a new enterprise endpoint  
**Auth**: JWT + Admin required  
**Validation**: Zod `createSchema`

**Request Body**:
```json
{
  "client_id": "silulumanzi",
  "client_name": "Silulumanzi Water Services",
  "inbound_provider": "whatsapp",
  "llm_provider": "ollama",
  "llm_model": "qwen2.5:3b-instruct",
  "llm_system_prompt": "You are a helpful water services assistant for Silulumanzi. Help customers check balances, report faults, and get service information.",
  "llm_tools_config": "[{\"type\":\"function\",\"function\":{\"name\":\"check_balance\",\"description\":\"Check customer balance\",\"parameters\":{\"type\":\"object\",\"properties\":{\"account_number\":{\"type\":\"string\"}},\"required\":[\"account_number\"]}}}]",
  "llm_temperature": 0.3,
  "llm_max_tokens": 1024,
  "target_api_url": "https://api.silulumanzi.co.za/v1/actions",
  "target_api_auth_type": "bearer",
  "target_api_auth_value": "sk-silulumanzi-secret-key"
}
```

**SQLite Query**:
```sql
INSERT INTO enterprise_endpoints (
  id, client_id, client_name, status, inbound_provider,
  inbound_auth_type, inbound_auth_value,
  llm_provider, llm_model, llm_temperature, llm_max_tokens, llm_system_prompt,
  llm_tools_config, llm_knowledge_base,
  target_api_url, target_api_auth_type, target_api_auth_value, target_api_headers,
  created_at, updated_at
) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "ep_silulumanzi_a1b2c3d4e5f6",
    "client_id": "silulumanzi",
    "client_name": "Silulumanzi Water Services",
    "status": "active",
    "inbound_provider": "whatsapp",
    "llm_provider": "ollama",
    "llm_model": "qwen2.5:3b-instruct",
    "total_requests": 0,
    "created_at": "2026-03-20T12:00:00.000Z",
    "updated_at": "2026-03-20T12:00:00.000Z"
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "code": "invalid_enum_value", "path": ["inbound_provider"], "message": "Invalid enum value. Expected 'whatsapp' | 'slack' | 'custom_rest' | 'sms' | 'email' | 'web'" }
  ]
}
```

---

### 5. PUT `/api/admin/enterprise-endpoints/:id`
**Purpose**: Update an existing endpoint  
**Auth**: JWT + Admin required  
**Validation**: Zod `updateSchema` (all fields optional)

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Endpoint ID |

**Request Body** (partial — only send fields to update):
```json
{
  "llm_model": "qwen2.5:7b-instruct",
  "llm_temperature": 0.5,
  "llm_system_prompt": "Updated system prompt..."
}
```

**SQLite Query** (dynamic — only updates provided fields):
```sql
UPDATE enterprise_endpoints
SET llm_model = ?, llm_temperature = ?, llm_system_prompt = ?, updated_at = ?
WHERE id = ?
```

**Success Response** (200):
```json
{
  "success": true,
  "data": { /* updated endpoint object */ }
}
```

**Error Response** (404):
```json
{ "success": false, "error": "Endpoint not found" }
```

---

### 6. PATCH `/api/admin/enterprise-endpoints/:id/status`
**Purpose**: Quick status toggle (kill switch)  
**Auth**: JWT + Admin required  
**Validation**: Zod `statusSchema`

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Endpoint ID |

**Request Body**:
```json
{
  "status": "paused"
}
```

**SQLite Query**:
```sql
UPDATE enterprise_endpoints SET status = ?, updated_at = ? WHERE id = ?
```

**Success Response** (200):
```json
{ "success": true, "message": "Status updated" }
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [{ "code": "invalid_enum_value", "path": ["status"], "message": "Invalid enum value. Expected 'active' | 'paused' | 'disabled'" }]
}
```

---

### 7. DELETE `/api/admin/enterprise-endpoints/:id`
**Purpose**: Delete an endpoint and all associated request logs  
**Auth**: JWT + Admin required

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Endpoint ID |

**SQLite Query**:
```sql
-- Logs are automatically deleted via ON DELETE CASCADE
DELETE FROM enterprise_endpoints WHERE id = ?
```

**Success Response** (200):
```json
{ "success": true, "message": "Endpoint deleted" }
```

**Error Response** (404):
```json
{ "success": false, "error": "Endpoint not found" }
```

---

### 8. GET `/api/admin/enterprise-endpoints/:id/logs`
**Purpose**: Get paginated request logs for an endpoint  
**Auth**: JWT + Admin required

**Path params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Endpoint ID |

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | `number` | `50` | Number of logs to return |
| `offset` | `number` | `0` | Pagination offset |

**SQLite Query**:
```sql
SELECT * FROM endpoint_requests
WHERE endpoint_id = ?
ORDER BY timestamp DESC
LIMIT ? OFFSET ?
```

**Success Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "req_a1b2c3d4e5f6a7b8",
      "endpoint_id": "ep_silulumanzi_a1b2c3d4e5f6",
      "timestamp": "2026-03-15T10:30:00.000Z",
      "inbound_payload": "{\"text\":\"What is my balance?\",\"sender_id\":\"27821234567\"}",
      "ai_response": "{\"text\":\"Your balance is R1,250.00\"}",
      "duration_ms": 1250,
      "status": "success",
      "error_message": null
    },
    {
      "id": "req_b2c3d4e5f6a7b8c9",
      "endpoint_id": "ep_silulumanzi_a1b2c3d4e5f6",
      "timestamp": "2026-03-15T10:25:00.000Z",
      "inbound_payload": "{\"text\":\"Report a fault\"}",
      "ai_response": null,
      "duration_ms": 5000,
      "status": "error",
      "error_message": "LLM request timeout"
    }
  ]
}
```

---

## LLM API Calls (Internal)

### Ollama Call
**Function**: `callOllama()` in `enterpriseWebhook.ts`  
**Endpoint**: `POST ${OLLAMA_BASE_URL}/api/chat`  
**Timeout**: 60 seconds

```json
{
  "model": "qwen2.5:3b-instruct",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant..." },
    { "role": "user", "content": "What is my balance?" }
  ],
  "stream": false,
  "options": {
    "temperature": 0.3,
    "num_predict": 1024
  }
}
```

**Response parsing**: `response.data.message.content`

### OpenRouter Call
**Function**: `callOpenRouter()` in `enterpriseWebhook.ts`  
**Endpoint**: `POST ${OPENROUTER_BASE_URL}/chat/completions`

```json
{
  "model": "qwen2.5:3b-instruct",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant..." },
    { "role": "user", "content": "What is my balance?" }
  ],
  "temperature": 0.3,
  "max_tokens": 1024,
  "tools": [ /* from llm_tools_config */ ]
}
```

**Headers**:
```
Authorization: Bearer ${OPENROUTER_API_KEY}
Content-Type: application/json
```

**Response parsing**:
- Text: `response.data.choices[0].message.content`
- Tool calls: `response.data.choices[0].message.tool_calls` → triggers `forwardAction()`

### Action Forwarding
**Function**: `forwardAction()` in `enterpriseWebhook.ts`  
**Endpoint**: `POST ${endpoint.target_api_url}`

```json
{
  "action": "check_balance",
  "parameters": { "account_number": "ACC001" },
  "endpoint_id": "ep_silulumanzi_a1b2c3d4e5f6",
  "client_id": "silulumanzi"
}
```

**Auth headers** (based on `target_api_auth_type`):
| Type | Header |
|------|--------|
| `bearer` | `Authorization: Bearer ${target_api_auth_value}` |
| `basic` | `Authorization: Basic ${target_api_auth_value}` |
| `custom` | Custom headers from `target_api_headers` JSON |
| `none` | No auth headers |
