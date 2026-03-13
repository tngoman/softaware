# Enterprise Endpoints Module — Architecture Patterns

**Version:** 1.2.0  
**Last Updated:** 2026-03-11

---

## 1. Overview

This document catalogs the architectural patterns found in the Enterprise Endpoints module, covering database design, webhook processing, payload normalization, LLM routing, and operational control.

---

## 2. Architectural Patterns

### Pattern 1: SQLite Lazy Singleton

**Context:**  
Enterprise endpoint configuration and request logs are stored in a dedicated SQLite database, separate from the main MySQL database. The connection is lazily initialized on first use and reused for all subsequent operations.

**Implementation:**

```typescript
// services/enterpriseEndpoints.ts
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`CREATE TABLE IF NOT EXISTS enterprise_endpoints (...)`);
  _db.exec(`CREATE TABLE IF NOT EXISTS endpoint_requests (...)`);

  return _db;
}
```

**Benefits:**
- ✅ Zero startup cost — DB opens only when first endpoint is accessed
- ✅ WAL mode enables concurrent reads during webhook bursts
- ✅ Foreign keys enforce referential integrity (cascade deletes)
- ✅ Schema is idempotent — safe to run on every initialization
- ✅ No MySQL dependency at webhook processing time
- ✅ Directory auto-creation prevents missing-path errors

**Drawbacks:**
- ❌ No connection pooling (single process assumed)
- ❌ No migration framework — schema changes require manual management
- ❌ SQLite data not included in MySQL backups

---

### Pattern 2: Three-State Kill Switch

**Context:**  
Enterprise endpoints need operational control without code changes. The kill switch provides three states for graduated response control.

**Implementation:**

```typescript
// routes/enterpriseWebhook.ts — status check at webhook entry
if (config.status === 'disabled') {
  return res.status(403).json({
    error: 'Endpoint disabled',
    message: 'This endpoint has been disabled by the administrator'
  });
}

if (config.status === 'paused') {
  return res.status(503).json({
    error: 'Endpoint paused',
    message: 'This endpoint is temporarily paused. Please try again later.'
  });
}

// routes/adminEnterpriseEndpoints.ts — toggle
adminEnterpriseEndpointsRouter.patch('/:id/status', (req, res) => {
  const { status } = statusSchema.parse(req.body);
  setEndpointStatus(req.params.id, status);
  res.json({ success: true, message: `Endpoint ${req.params.id} set to ${status}` });
});
```

**State Transitions:**

```
        ┌─────────┐
   ┌───▶│  active  │◀───┐
   │    └─────────┘     │
   │         │          │
   │    PATCH /status   │
   │         │          │
   │    ┌────▼────┐     │
   ├───▶│  paused │─────┤
   │    └─────────┘     │
   │         │          │
   │    PATCH /status   │
   │         │          │
   │    ┌────▼─────┐    │
   └───▶│ disabled │────┘
        └──────────┘
```

| Status | HTTP Response | Use Case |
|--------|--------------|----------|
| `active` | Normal (200) | Endpoint fully operational |
| `paused` | 503 Service Unavailable | Temporary maintenance — clients should retry |
| `disabled` | 403 Forbidden | Hard block — investigate before re-enabling |

**Benefits:**
- ✅ Instant operational control without deployment
- ✅ Graduated response (pause vs disable)
- ✅ HTTP status codes communicate intent to callers (503 = retry, 403 = stop)
- ✅ Visible in admin UI with color-coded badges

**Drawbacks:**
- ❌ No scheduled pause/resume (manual only)
- ❌ No audit trail for status changes

---

### Pattern 3: Payload Normalization Layer

**Context:**  
Enterprise endpoints accept messages from 6 different inbound channels, each with its own payload format. A normalization layer extracts a standard `{ text, sender_id, channel }` from any source, and a formatting layer converts AI responses back to provider-specific formats.

**Implementation:**

```typescript
// services/payloadNormalizer.ts

// Inbound: Provider → Standard
export function normalizeInboundPayload(provider: string, payload: any): NormalizedInbound {
  switch (provider.toLowerCase()) {
    case 'whatsapp': return normalizeWhatsApp(payload);
    case 'slack':    return normalizeSlack(payload);
    case 'sms':      return normalizeSMS(payload);
    case 'email':    return normalizeEmail(payload);
    case 'web':
    case 'custom_rest': return normalizeCustomRest(payload);
    default: return { text: payload.text || String(payload), channel: provider };
  }
}

// Outbound: AI Response → Provider
export function formatOutboundPayload(
  provider: string, aiText: string, action?: string, metadata?: Record<string, any>
): FormattedOutbound {
  switch (provider.toLowerCase()) {
    case 'whatsapp': return formatWhatsApp(aiText, metadata);
    case 'slack':    return formatSlack(aiText, metadata);
    case 'sms':      return formatSMS(aiText);
    case 'email':    return formatEmail(aiText, metadata);
    case 'web':
    case 'custom_rest': return formatCustomRest(aiText, action, metadata);
    default: return { body: { response: aiText }, contentType: 'application/json' };
  }
}
```

**Provider Adapters:**

| Provider | Inbound Extraction | Outbound Format | Content-Type |
|----------|--------------------|-----------------|-------------|
| WhatsApp | `entry[0].changes[0].value.messages[0].text.body` | Meta Business API JSON | `application/json` |
| Slack | `event.text` | Slack message JSON | `application/json` |
| SMS | `Body` (Twilio) | TwiML XML | `text/xml` |
| Email | `subject` + `body` | JSON email object | `application/json` |
| Web/REST | `message` or `text` | JSON with `response`, `action`, `language` | `application/json` |

**Benefits:**
- ✅ Single webhook handler serves all channels
- ✅ Adding a new provider requires only two new functions (normalize + format)
- ✅ Core processing pipeline is provider-agnostic
- ✅ Content-Type is set per-provider (critical for SMS TwiML)

**Drawbacks:**
- ❌ No payload signature validation for inbound webhooks (WhatsApp, Slack require this)
- ❌ Metadata extraction is minimal — provider-specific features may be lost
- ❌ No retry/delivery status support for outbound messages

---

### Pattern 4: Non-Fatal Action Forwarding

**Context:**  
When an OpenRouter LLM returns tool calls, the first tool call is forwarded to the endpoint's configured target API. This forwarding is intentionally non-fatal — if it fails, the AI response is still returned to the caller.

**Implementation:**

```typescript
// routes/enterpriseWebhook.ts

// 6. If the AI decided to take an action, forward it to the target API
if (requiresAction && config.target_api_url && actionData) {
  try {
    await forwardAction(config, actionData, normalized);
  } catch (actionError) {
    console.error(`[Webhook ${endpointId}] Action forwarding failed:`, actionError);
    // Non-fatal — we still return the AI response
  }
}

// 7. Format the response for the inbound provider (always reached)
const formatted = formatOutboundPayload(config.inbound_provider, aiResponse, 'reply', {...});
```

**Action Forwarding Details:**

```typescript
async function forwardAction(config, actionData, normalized) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Auth injection
  if (config.target_api_auth_type === 'bearer') {
    headers['Authorization'] = `Bearer ${config.target_api_auth_value}`;
  } else if (config.target_api_auth_type === 'basic') {
    headers['Authorization'] = `Basic ${config.target_api_auth_value}`;
  }

  // Custom headers
  if (config.target_api_headers) {
    Object.assign(headers, JSON.parse(config.target_api_headers));
  }

  // Inject sender context into action payload
  const payload = {
    ...actionData.arguments,
    phone_number: normalized.sender_id,
    sender_id: normalized.sender_id,
    action: actionData.tool
  };

  await axios.post(config.target_api_url, payload, { headers, timeout: 30000 });
}
```

**Benefits:**
- ✅ Users always get a response, even if the backend action fails
- ✅ Action failures are logged for debugging
- ✅ Sender context (phone number, ID) is injected into every action
- ✅ Flexible auth (bearer, basic, custom headers)

**Drawbacks:**
- ❌ Only first tool call is processed (multi-tool responses ignored)
- ❌ No retry mechanism for failed actions
- ❌ No confirmation to the user that the action succeeded/failed
- ❌ Action forwarding timeout (30s) adds to total response time

---

### Pattern 5: Dual-Path Endpoint Creation

**Context:**  
Enterprise endpoints can be created through two paths — the admin UI (web-based CRUD) and the mobile AI assistant (voice/text-driven). Both paths converge on the same `createEndpoint()` service function.

**Implementation:**

```
Path A: Admin UI
┌───────────────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│ EnterpriseEndpoints│───▶│ adminEnterpriseEndpoints │───▶│ createEndpoint() │
│ .tsx (React form)  │    │ .ts (Zod validated POST) │    │ (SQLite service)  │
└───────────────────┘    └─────────────────────────┘    └──────────────────┘

Path B: Mobile AI
┌───────────────────┐    ┌──────────────────────────┐   ┌──────────────────┐
│ Staff says:       │───▶│ mobileActionExecutor.ts   │──▶│ createEndpoint() │
│ "set up webhook"  │    │ execGenerateEnterprise    │   │ (SQLite service)  │
│                   │    │ Endpoint() + user verify  │   └──────────────────┘
└───────────────────┘    └──────────────────────────┘
```

**Differences between paths:**

| Aspect | Admin UI | Mobile AI |
|--------|----------|-----------|
| Validation | Full Zod schema (13+ fields) | Minimal (3 fields: clientId, provider, systemPrompt) |
| Client verification | None (admin responsible) | Verifies client exists in MySQL `users` table |
| Default LLM | Admin chooses any provider | Always `openrouter` / `openai/gpt-4o-mini` |
| Configuration depth | All fields available | Minimal defaults |
| Output | JSON response | Formatted markdown message with webhook URL |

**Benefits:**
- ✅ Both paths use the same underlying service — consistent behavior
- ✅ Mobile path is optimized for speed (minimal input, sensible defaults)
- ✅ Admin path offers full configurability

**Drawbacks:**
- ❌ Mobile-created endpoints may need admin follow-up to configure tools and target API

---

### Pattern 6: Request Logging with Counter

**Context:**  
Every webhook request is logged to the `endpoint_requests` table, and the parent endpoint's `total_requests` counter and `last_request_at` timestamp are atomically updated.

**Implementation:**

```typescript
// services/enterpriseEndpoints.ts

export function logRequest(
  endpointId: string,
  inboundPayload: any,
  aiResponse: any,
  durationMs: number,
  status: 'success' | 'error',
  errorMessage?: string
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `req_${randomBytes(8).toString('hex')}`;

  // Log the individual request
  db.prepare(`
    INSERT INTO endpoint_requests (
      id, endpoint_id, timestamp, inbound_payload, ai_response,
      duration_ms, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, endpointId, now, JSON.stringify(inboundPayload),
    JSON.stringify(aiResponse), durationMs, status, errorMessage || null);

  // Atomically update parent counters
  db.prepare(`
    UPDATE enterprise_endpoints
    SET last_request_at = ?, total_requests = total_requests + 1
    WHERE id = ?
  `).run(now, endpointId);
}
```

**Benefits:**
- ✅ Full audit trail — payload in, response out, timing, error details
- ✅ Atomic counter update in same DB (no race conditions with WAL)
- ✅ Paginated retrieval for admin dashboard
- ✅ Cascade delete — logs auto-deleted when endpoint is removed

**Drawbacks:**
- ❌ No log rotation — `endpoint_requests` table grows unbounded
- ❌ Full payload stored as JSON strings — can be large for WhatsApp payloads
- ❌ No aggregation queries (e.g., requests per hour/day)

---

### Pattern 7: Provider-Specific LLM Routing

**Context:**  
Each enterprise endpoint configures its own LLM provider and model. The webhook handler routes to the correct provider with different capabilities.

**Implementation:**

```typescript
// routes/enterpriseWebhook.ts

if (config.llm_provider === 'ollama') {
  aiResponse = await callOllama(config, messages);
} else if (config.llm_provider === 'openrouter') {
  const result = await callOpenRouter(config, messages);
  aiResponse = result.text;
  requiresAction = result.requiresAction;
  actionData = result.actionData;
} else {
  throw new Error(`Unsupported LLM provider: ${config.llm_provider}`);
}
```

**Provider Capabilities:**

| Capability | Ollama | OpenRouter |
|-----------|--------|------------|
| Text generation | ✅ | ✅ |
| Tool calling | ❌ | ✅ |
| Action forwarding | ❌ | ✅ |
| Auth | None (local) | Bearer token via credential vault |
| Timeout | 60s | 60s |
| API format | `/api/chat` (Ollama native) | `/chat/completions` (OpenAI-compatible) |
| Streaming | No (stream=false) | No (non-streaming) |

**Benefits:**
- ✅ Per-endpoint LLM flexibility
- ✅ OpenRouter supports tool calling for action-oriented workflows
- ✅ Ollama available as free/local option

**Drawbacks:**
- ❌ OpenAI provider listed in enum but not implemented in webhook handler
- ❌ No streaming support (could be useful for long responses)
- ❌ No GLM support (unlike assistant chat which uses GLM-first routing)

---

### Pattern 8: Language Detection for South African Context

**Context:**  
The system includes naive language detection for South African languages, adding a `language` field to outbound response metadata.

**Implementation:**

```typescript
// routes/enterpriseWebhook.ts

function detectLanguage(text: string): string {
  const zuWords = /\b(ngiyabonga|sawubona|yebo|cha)\b/i;   // isiZulu
  const xhWords = /\b(enkosi|molo|ewe|hayi)\b/i;          // isiXhosa
  const afWords = /\b(dankie|hallo|ja|nee)\b/i;            // Afrikaans

  if (zuWords.test(text)) return 'zu';
  if (xhWords.test(text)) return 'xh';
  if (afWords.test(text)) return 'af';
  return 'en';  // Default: English
}
```

**Benefits:**
- ✅ Zero-dependency language detection
- ✅ Covers the 4 most common languages for SA enterprise clients
- ✅ Enables downstream systems to route based on language

**Drawbacks:**
- ❌ Very naive — only 4 keywords per language, easily fooled
- ❌ Only detects language of AI *response*, not the user's input language
- ❌ Missing major SA languages: Sesotho, Setswana, Sepedi, Tshivenda, Xitsonga, siSwati, isiNdebele

---

## 3. Anti-Patterns & Technical Debt

### Anti-Pattern 1: No Inbound Webhook Signature Validation

**Severity:** 🔴 CRITICAL

Enterprise webhook endpoints are completely public — no inbound authentication is enforced. WhatsApp, Slack, and other providers send signature headers that should be validated.

**Impact:**
- Anyone with the endpoint URL can send fake messages
- No protection against replay attacks
- Could be abused for LLM cost inflation (OpenRouter credits)

**Recommended Fix:**
```typescript
if (config.inbound_auth_type === 'api_key') {
  const provided = req.headers['x-api-key'] || req.query.api_key;
  if (provided !== config.inbound_auth_value) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

---

### Anti-Pattern 2: No Request Log Rotation

**Severity:** 🟡 WARNING

The `endpoint_requests` table grows unbounded. High-traffic endpoints could accumulate millions of rows.

**Recommended Fix:**
```sql
-- Periodic cleanup: keep last 30 days
DELETE FROM endpoint_requests WHERE timestamp < datetime('now', '-30 days');
```

---

### Anti-Pattern 3: OpenAI Provider Not Implemented

**Severity:** 🟡 WARNING

The `llm_provider` field accepts `'openai'` as a value, and the admin UI allows selecting it, but the webhook handler has no `callOpenAI()` function. Endpoints configured with `openai` will throw `Error: Unsupported LLM provider: openai`.

**Recommended Fix:** Either implement `callOpenAI()` or remove `'openai'` from the Zod enum.

---

### Anti-Pattern 4: Only First Tool Call Processed

**Severity:** 🟢 LOW

When OpenRouter returns multiple tool calls, only the first one is extracted and forwarded. This limits multi-step workflows.

---

## 4. Conversation History Management

Enterprise webhooks support conversation context through the `history` field in the request body or via the `metadata.history` path from normalized payloads.

```typescript
// routes/enterpriseWebhook.ts
const conversationHistory = incomingPayload.history || normalized.metadata?.history || [];
const messages = [
  { role: 'system', content: config.llm_system_prompt },
  ...conversationHistory.slice(-10),  // Keep last 10 messages
  { role: 'user', content: normalized.text }
];
```

**Key Details:**
- History is **caller-managed** — the enterprise client sends previous messages in each request
- Only the last 10 messages are retained (context window management)
- No server-side conversation persistence (stateless)
- System prompt is always prepended as the first message
