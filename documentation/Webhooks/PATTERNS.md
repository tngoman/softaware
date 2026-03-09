# Webhooks — Code Patterns & Best Practices

## Common Patterns

### 1. SQLite Singleton Pattern

**Problem**: Multiple imports of `enterpriseEndpoints.ts` must share a single database connection.

**Pattern**: Lazy singleton via module-level `let` variable initialized on first call to `getDb()`.

```typescript
import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(__dirname, '../../data/enterprise_endpoints.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Auto-create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS enterprise_endpoints (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        ...
      );
      CREATE TABLE IF NOT EXISTS endpoint_requests (
        id TEXT PRIMARY KEY,
        endpoint_id TEXT NOT NULL,
        ...
        FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
      );
    `);
  }
  return db;
}
```

**Why SQLite over MySQL?**
- Webhook config is isolated from core app data
- No migration overhead — schema auto-creates
- WAL mode enables concurrent reads during writes
- Single-file portability for backup/restore
- Synchronous API eliminates async boilerplate for simple CRUD

**Best Practice**: Always call `close()` on shutdown (e.g., in PM2 graceful shutdown handler).

---

### 2. Payload Normalization Pattern

**Problem**: Inbound webhooks arrive in different formats per provider (WhatsApp, Slack, SMS, etc.) but the LLM processing pipeline needs a unified format.

**Pattern**: Strategy pattern using a switch on `inbound_provider` to normalize payloads into a common `NormalizedInbound` interface.

```typescript
interface NormalizedInbound {
  text: string;
  sender_id: string;
  channel: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export function normalizeInboundPayload(
  provider: string,
  payload: any
): NormalizedInbound {
  switch (provider) {
    case 'whatsapp': return normalizeWhatsApp(payload);
    case 'slack':    return normalizeSlack(payload);
    case 'sms':      return normalizeSMS(payload);
    case 'email':    return normalizeEmail(payload);
    case 'web':      return normalizeWeb(payload);
    case 'custom_rest':
    default:         return normalizeCustomRest(payload);
  }
}
```

**Outbound formatting** follows the same pattern in reverse:
```typescript
export function formatOutboundPayload(
  provider: string,
  aiText: string,
  action?: any,
  metadata?: any
): FormattedOutbound {
  switch (provider) {
    case 'whatsapp': return formatWhatsApp(aiText, metadata);
    case 'slack':    return formatSlack(aiText);
    // ... etc
  }
}
```

**Best Practice**: Each normalizer should gracefully handle malformed payloads with sensible defaults rather than throwing.

---

### 3. WhatsApp Dual-Format Detection

**Problem**: WhatsApp webhooks can arrive in either Meta Cloud API format or Twilio format.

**Pattern**: Check for Meta-specific nesting (`entry[0].changes[0].value.messages`), fall back to Twilio flat format.

```typescript
function normalizeWhatsApp(payload: any): NormalizedInbound {
  // Meta Cloud API format
  if (payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
    const msg = payload.entry[0].changes[0].value.messages[0];
    return {
      text: msg.text?.body || msg.interactive?.body?.text || '',
      sender_id: msg.from || 'unknown',
      channel: 'whatsapp',
      timestamp: msg.timestamp || new Date().toISOString(),
      metadata: { format: 'meta_cloud_api', raw: payload }
    };
  }

  // Twilio format
  return {
    text: payload.Body || '',
    sender_id: (payload.From || '').replace('whatsapp:', ''),
    channel: 'whatsapp',
    timestamp: new Date().toISOString(),
    metadata: { format: 'twilio', raw: payload }
  };
}
```

**Best Practice**: Always store `metadata.format` so outbound formatting knows which format to use.

---

### 4. Kill Switch Pattern

**Problem**: Need instant ability to stop an endpoint from processing requests without deleting it.

**Pattern**: Status check at the top of the webhook handler with immediate 503 response.

```typescript
router.post('/:endpointId', async (req, res) => {
  const endpoint = getEndpoint(req.params.endpointId);

  if (!endpoint) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  // Kill switch — check before any processing
  if (endpoint.status === 'paused') {
    return res.status(503).json({ error: 'Endpoint is paused' });
  }
  if (endpoint.status === 'disabled') {
    return res.status(503).json({ error: 'Endpoint is disabled' });
  }

  // ... proceed with normal processing
});
```

**Admin toggle** (single field update):
```typescript
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  setEndpointStatus(id, status);
  res.json({ success: true, message: 'Status updated' });
});
```

**Best Practice**: Use `503 Service Unavailable` (not 403 or 404) for paused/disabled endpoints — this tells the caller the endpoint exists but is temporarily unavailable.

---

### 5. LLM Provider Abstraction Pattern

**Problem**: Different LLM providers (Ollama, OpenRouter, OpenAI) have different API formats.

**Pattern**: Provider-specific caller functions that return a unified response structure.

```typescript
// Ollama — native /api/chat format
async function callOllama(
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const response = await axios.post(`${env.OLLAMA_BASE_URL}/api/chat`, {
    model,
    messages,
    stream: false,
    options: { temperature, num_predict: maxTokens }
  }, { timeout: 60000 });

  return response.data.message.content;
}

// OpenRouter — OpenAI-compatible /chat/completions format
async function callOpenRouter(
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  tools?: any[]
): Promise<{ text: string; requiresAction: boolean; actionData: any }> {
  const body: any = { model, messages, temperature, max_tokens: maxTokens };
  if (tools?.length) body.tools = tools;

  const response = await axios.post(`${env.OPENROUTER_BASE_URL}/chat/completions`, body, {
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const choice = response.data.choices[0];
  if (choice.message.tool_calls?.length) {
    return {
      text: choice.message.content || '',
      requiresAction: true,
      actionData: choice.message.tool_calls[0]
    };
  }
  return { text: choice.message.content, requiresAction: false, actionData: null };
}
```

**Key difference**: Only OpenRouter supports tool calling. Ollama returns plain text only.

**Best Practice**: Use the `llm_tools_config` field only when `llm_provider` is `openrouter` or `openai`.

---

### 6. Action Forwarding Pattern

**Problem**: When the LLM decides to call a tool, the result must be forwarded to the client's target API.

**Pattern**: Extract tool call data → POST to target API with auth → return result.

```typescript
async function forwardAction(
  endpoint: EnterpriseEndpoint,
  actionData: any
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Apply auth
  switch (endpoint.target_api_auth_type) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${endpoint.target_api_auth_value}`;
      break;
    case 'basic':
      headers['Authorization'] = `Basic ${endpoint.target_api_auth_value}`;
      break;
    case 'custom':
      if (endpoint.target_api_headers) {
        Object.assign(headers, JSON.parse(endpoint.target_api_headers));
      }
      break;
  }

  const response = await axios.post(endpoint.target_api_url!, {
    action: actionData.function.name,
    parameters: JSON.parse(actionData.function.arguments),
    endpoint_id: endpoint.id,
    client_id: endpoint.client_id
  }, { headers, timeout: 30000 });

  return response.data;
}
```

**Best Practice**: Always set a timeout on action forwarding (30s recommended) to prevent hanging.

---

### 7. Request Logging Pattern

**Problem**: All webhook requests must be logged for debugging and analytics.

**Pattern**: Wrap the processing pipeline in a try/catch with timing, log regardless of outcome.

```typescript
const startTime = Date.now();
let status = 'success';
let errorMessage: string | null = null;

try {
  // ... full processing pipeline
  const response = await processWebhook(endpoint, req.body);
  res.json(response);
} catch (err: any) {
  status = 'error';
  errorMessage = err.message;
  res.status(500).json({ error: 'Webhook processing failed' });
} finally {
  const durationMs = Date.now() - startTime;
  logRequest({
    endpoint_id: endpoint.id,
    inbound_payload: JSON.stringify(req.body),
    ai_response: aiResponse ? JSON.stringify(aiResponse) : null,
    duration_ms: durationMs,
    status,
    error_message: errorMessage
  });
}
```

**Best Practice**: Log in the `finally` block so both successes and failures are captured.

---

### 8. Zod Validation Pattern (Admin Routes)

**Problem**: Admin API needs input validation with clear error messages.

**Pattern**: Parse with Zod, catch `ZodError`, return structured details.

```typescript
import { z, ZodError } from 'zod';

const createSchema = z.object({
  client_id: z.string().min(1),
  client_name: z.string().min(1),
  inbound_provider: z.enum(['whatsapp', 'slack', 'custom_rest', 'sms', 'email', 'web']),
  llm_provider: z.enum(['ollama', 'openrouter', 'openai']),
  llm_model: z.string().min(1),
  llm_system_prompt: z.string().min(1),
  // ... optional fields
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = createSchema.parse(req.body);
    const endpoint = createEndpoint(data);
    res.status(201).json({ success: true, data: endpoint });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors
      });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
```

**Best Practice**: Return Zod `err.errors` array directly — it provides path, code, and message for each field.

---

### 9. Dynamic Update Pattern (Partial Updates)

**Problem**: PUT endpoint should only update fields that are provided in the request body.

**Pattern**: Use `Object.entries()` to build a dynamic SET clause from validated partial data.

```typescript
export function updateEndpoint(id: string, updates: Partial<EndpointCreateInput>): EnterpriseEndpoint | null {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getEndpoint(id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id); // WHERE clause

  db.prepare(`UPDATE enterprise_endpoints SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getEndpoint(id);
}
```

**Best Practice**: Always update `updated_at` even if no other fields change.

---

### 10. Language Detection Pattern

**Problem**: Some endpoints may need to detect the language of inbound messages for multilingual responses.

**Pattern**: Naive regex-based detection for South African languages.

```typescript
function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(yini|ngicela|ngifuna|unjani)\b/.test(lower)) return 'zu'; // isiZulu
  if (/\b(ndifuna|ndincede|unjani)\b/.test(lower)) return 'xh';    // isiXhosa
  if (/\b(asseblief|dankie|hoe gaan)\b/.test(lower)) return 'af';  // Afrikaans
  return 'en'; // default English
}
```

**Best Practice**: This is a fallback — for production multilingual support, use the LLM's native language detection or a dedicated NLP library.

---

## Anti-Patterns to Avoid

### ❌ Don't store parsed JSON in SQLite
```typescript
// BAD — storing parsed object
db.prepare('INSERT INTO ... VALUES (?)').run(toolsConfig);

// GOOD — always stringify
db.prepare('INSERT INTO ... VALUES (?)').run(JSON.stringify(toolsConfig));
```

### ❌ Don't skip status check in webhook handler
```typescript
// BAD — processes even paused endpoints
const endpoint = getEndpoint(id);
const result = await processWebhook(endpoint, payload);

// GOOD — check status first
const endpoint = getEndpoint(id);
if (endpoint.status !== 'active') {
  return res.status(503).json({ error: `Endpoint is ${endpoint.status}` });
}
```

### ❌ Don't hardcode LLM provider URLs
```typescript
// BAD
await axios.post('http://localhost:11434/api/chat', ...);

// GOOD — use env variables
await axios.post(`${env.OLLAMA_BASE_URL}/api/chat`, ...);
```

### ❌ Don't forget to log failed requests
```typescript
// BAD — only logs successes
try {
  const result = await processWebhook(endpoint, payload);
  logRequest({ status: 'success', ... });
} catch (err) {
  res.status(500).json({ error: 'Failed' });
  // Missing log!
}

// GOOD — log in finally block
try { ... } catch { ... } finally {
  logRequest({ status, error_message, ... });
}
```

---

## Configuration Checklist (New Endpoint Setup)

1. ✅ Choose `inbound_provider` based on the channel (WhatsApp, Slack, etc.)
2. ✅ Choose `llm_provider` — use `ollama` for local, `openrouter` for cloud with tool calling
3. ✅ Set `llm_model` — ensure the model is available on the chosen provider
4. ✅ Write `llm_system_prompt` — be specific about the client's domain and capabilities
5. ✅ Define `llm_tools_config` JSON if tool calling is needed (OpenRouter only)
6. ✅ Set `target_api_url` if tools need to forward actions to a client API
7. ✅ Configure `target_api_auth_type` and credentials
8. ✅ Test with a sample payload via `curl POST /api/v1/webhook/{endpoint_id}`
9. ✅ Check request logs via admin UI or `GET /api/admin/enterprise-endpoints/{id}/logs`
10. ✅ Monitor `total_requests` and `last_request_at` for activity
