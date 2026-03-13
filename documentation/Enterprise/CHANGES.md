# Enterprise Endpoints Module — Changelog & Known Issues

**Version:** 1.3.0  
**Last Updated:** 2026-03-12

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-12 | 1.3.0 | AI Telemetry — POPIA-compliant anonymized chat logging for all webhook requests via `analyticsLogger.ts` |
| 2026-03-11 | 1.2.0 | Package enforcement, credit deduction, legacy `/silulumanzi` route removed, `contact_id` wiring, Clients documentation directory |
| 2026-03-09 | 1.1.0 | LLM provider migration — all endpoints moved from Ollama to OpenRouter; GLM-first routing in AI Gateway (enterprise endpoints not yet migrated to GLM) |
| 2026-03-08 | 1.0.0 | Initial release — dynamic enterprise webhooks replacing hardcoded routes |

---

## 2. v1.3.0 — AI Telemetry (2026-03-12)

**Date:** 2026-03-12  
**Scope:** Anonymized chat logging for all enterprise webhook requests

### Summary

Enterprise webhook responses are now logged to a POPIA-compliant analytics table with automatic PII sanitization. The new `analyticsLogger.ts` utility strips emails, SA phone numbers, SA ID numbers, credit card numbers, account numbers, and street addresses from both prompts and AI responses before writing to SQLite. Logging is fire-and-forget — failures never affect webhook response delivery.

### Changes

**`src/routes/enterpriseWebhook.ts` (+8 LOC → ~345 LOC):**
- Added `import { logAnonymizedChat } from '../utils/analyticsLogger.js'`
- New step 9 in pipeline: `logAnonymizedChat(config.client_id, userText, aiResponse, { source: 'enterprise', model, provider, durationMs })`
- Response send renumbered from step 9 to step 10
- Logging fires after LLM response, before HTTP response is sent

**New dependency: `src/utils/analyticsLogger.ts` (~160 LOC):**

| Export | Purpose |
|--------|---------|
| `sanitizeText(text)` | Strips PII via 6 regex patterns |
| `logAnonymizedChat(clientId, rawPrompt, rawResponse, options?)` | Fire-and-forget SQLite INSERT into `ai_analytics_logs` |

### Pipeline Update

```
Previous pipeline (v1.2.0):
  1. RECEIVE → 2. LOOKUP → 3. KILL SW. → 4. PACKAGE → 5. NORMALIZE
  → 6. VALIDATE → 7. MESSAGES → 8. LLM CALL → 9. TOOLS → 10. FORWARD
  → 11. FORMAT → 12. LOG → 13. CREDITS → 14. RESPOND

Updated pipeline (v1.3.0):
  1–8. (unchanged)
  9. ANALYTICS → logAnonymizedChat() — PII-sanitized, fire-and-forget SQLite
  10–14. (renumbered, unchanged)
```

### Verification

- ✅ Enterprise webhook requests logged to `ai_analytics_logs` with source `'enterprise'`
- ✅ PII properly stripped: phone numbers, emails, SA IDs all replaced with `[TYPE REMOVED]`
- ✅ Analytics errors do not affect webhook response delivery
- ✅ TypeScript compiles cleanly

---

## 3. v1.2.0 — Package Enforcement & Legacy Removal (2026-03-11)

**Date:** 2026-03-11  
**Scope:** Package system integration, credit tracking, legacy route removal, per-client documentation

### Summary

Enterprise webhook endpoints are now gated by the package system. Each endpoint with a `contact_id` checks the contact's subscription status and credit balance before processing. Successful requests deduct 10 credits. The legacy hardcoded `/silulumanzi` route was removed. A new `Clients/` documentation directory was created for per-client profiles.

### Changes

**`src/routes/enterpriseWebhook.ts` (+43 LOC → 337 LOC):**
- Added `import * as packageService` from `../services/packages.js`
- After endpoint status check, if `config.contact_id` is set:
  - Queries `contact_packages` for ACTIVE/TRIAL subscription
  - No active subscription → 403 `NO_ACTIVE_PACKAGE`
  - Zero credit balance → 402 `INSUFFICIENT_CREDITS`
- After successful response, deducts 10 credits asynchronously via `packageService.deductCredits()`
- Credit transactions logged as type `USAGE` with request_type `ENTERPRISE_WEBHOOK`

**`src/services/enterpriseEndpoints.ts` (+2 LOC → 348 LOC):**
- Added `contact_id?: number` to `EnterpriseEndpoint` interface

**`src/app.ts` (−2 LOC):**
- Removed `import { chatRouter } from './routes/chat.js'`
- Removed `apiRouter.use('/silulumanzi', chatRouter)`

**`src/routes/chat.ts` → `src/routes/_legacy_silulumanzi_chat.ts.bak`:**
- 640-line legacy file archived (not compiled, kept for reference)

### Data Changes

**MySQL — Silulumanzi package assignment:**
```sql
-- Assigned BYOE package to Silulumanzi (contact 68)
INSERT INTO contact_packages (contact_id, package_id, status, billing_cycle, credits_balance, payment_provider)
VALUES (68, 4, 'ACTIVE', 'MONTHLY', 50000, 'MANUAL');

-- Seeded initial allocation
INSERT INTO package_transactions (contact_package_id, contact_id, type, amount, description, balance_after)
VALUES (2, 68, 'MONTHLY_ALLOCATION', 50000, 'Initial BYOE allocation: 50,000 credits', 50000);
```

**SQLite — contact_id linking:**
```sql
-- Link all endpoints to their MySQL contacts
UPDATE enterprise_endpoints SET contact_id = 1 WHERE client_id = 'admin-softaware-001';
-- Silulumanzi already had contact_id = 68
```

### New Files

| File | Purpose |
|------|---------|
| `Enterprise/Clients/README.md` | Client index, onboarding checklist, package enforcement reference |
| `Enterprise/Clients/Silulumanzi.md` | Full Silulumanzi client profile (config, tools, migration history, kill switches) |
| `Enterprise/Clients/SoftAware.md` | Soft Aware internal endpoints profile |

### Verification

- ✅ `POST /api/v1/webhook/ep_silulumanzi_91374147` returns 200 with AI response
- ✅ Credits deducted: 50,000 → 49,970 after 3 test requests (10 credits each)
- ✅ Package SUSPENDED → webhook returns 403 `NO_ACTIVE_PACKAGE`
- ✅ Package restored to ACTIVE → webhook resumes
- ✅ Legacy `POST /api/silulumanzi` returns 404
- ✅ TypeScript compiles cleanly with no errors

---

## 3. v1.1.0 — OpenRouter Migration (2026-03-09)

**Date:** 2026-03-09  
**Scope:** Enterprise endpoint LLM provider migration from Ollama to OpenRouter

### Summary

The `execGenerateEnterpriseEndpoint()` function in `mobileActionExecutor.ts` was hardcoding `llm_provider: 'ollama'` and `llm_model: 'qwen2.5:3b-instruct'` when creating enterprise endpoints via the mobile AI assistant. Enterprise endpoints are inherently paid-tier, so this was incorrect. All new endpoints now default to `llm_provider: 'openrouter'` with `env.OPENROUTER_MODEL` (default: `openai/gpt-4o-mini`).

### Changes

**`src/services/mobileActionExecutor.ts`:**
- Changed default `llm_provider` from `'ollama'` to `'openrouter'`
- Changed default `llm_model` from `'qwen2.5:3b-instruct'` to `env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'`

### Data Migration

Updated 3 existing enterprise endpoints in SQLite database:

| Endpoint ID | Before | After |
|-------------|--------|-------|
| `ep_silulumanzi_91374147` | ollama / qwen2.5:3b-instruct | openrouter / openai/gpt-4o-mini |
| `ep_admin-softaware-001_1982b216` | ollama / qwen2.5:3b-instruct | openrouter / openai/gpt-4o-mini |
| `ep_admin-softaware-001_693b2d88` | ollama / qwen2.5:3b-instruct | openrouter / openai/gpt-4o-mini |

```sql
-- Migration applied directly to SQLite
UPDATE enterprise_endpoints
SET llm_provider = 'openrouter', llm_model = 'openai/gpt-4o-mini'
WHERE llm_provider = 'ollama';
```

---

## 4. v1.0.0 — Initial Release (2026-03-08)

**Date:** 2026-03-08  
**Scope:** Complete enterprise endpoints system

### Summary

Replaced hardcoded per-client webhook routes (e.g., `/silulumanzi`) with a dynamic, database-driven system. Each enterprise client gets a unique webhook URL (`/api/v1/webhook/:endpointId`) configured entirely through the admin UI or mobile AI assistant.

### Features

- ✅ Dynamic webhook endpoints stored in SQLite
- ✅ Multi-channel inbound (WhatsApp, Slack, SMS, email, web, custom REST)
- ✅ Per-endpoint LLM configuration (provider, model, temperature, max_tokens, system prompt)
- ✅ Tool calling support (OpenRouter only)
- ✅ Action forwarding to target APIs with auth
- ✅ Three-state kill switch (active/paused/disabled)
- ✅ Request logging with full payload audit trail
- ✅ Admin CRUD API (7 endpoints, JWT + Admin protected)
- ✅ Admin UI page with card grid, form modal, status toggle, log viewer
- ✅ Mobile AI tool (`generate_enterprise_endpoint`) for staff-driven creation
- ✅ Health monitoring integration (60s check cycle)
- ✅ Payload normalization for 6 inbound providers
- ✅ South African language detection in outbound metadata

### Files Created

| File | LOC | Purpose |
|------|-----|---------|
| `src/services/enterpriseEndpoints.ts` | 344 | SQLite CRUD + request logging |
| `src/routes/enterpriseWebhook.ts` | 294 | Universal webhook handler |
| `src/routes/adminEnterpriseEndpoints.ts` | 176 | Admin CRUD API |
| `src/services/payloadNormalizer.ts` | 269 | Inbound/outbound adapters |
| `src/pages/admin/EnterpriseEndpoints.tsx` | 617 | Admin UI page |
| `src/models/AdminAIModels.ts` (additions) | ~213 | API client + types |

**Total:** ~1,913 LOC

### Route Registration

Added to `src/app.ts`:
```typescript
import enterpriseWebhookRouter from './routes/enterpriseWebhook.js';                    // L75
import { adminEnterpriseEndpointsRouter } from './routes/adminEnterpriseEndpoints.js';  // L76

apiRouter.use('/admin/enterprise-endpoints', adminEnterpriseEndpointsRouter);  // L161
apiRouter.use('/v1/webhook', enterpriseWebhookRouter);                         // L180
```

---

## 5. Known Issues

### Issue 1: No Inbound Webhook Signature Validation

**Severity:** 🔴 CRITICAL  
**Status:** 🔴 Open  
**File:** `src/routes/enterpriseWebhook.ts`

**Description:**  
Enterprise webhook endpoints are completely public — no inbound authentication is validated. The `inbound_auth_type` and `inbound_auth_value` fields exist in the database schema but are never checked in the webhook handler. WhatsApp (Meta), Slack, and Twilio all provide webhook signature verification that should be enforced.

**Impact:**
- Anyone with the endpoint URL can send fake messages
- No protection against replay attacks
- LLM cost inflation via OpenRouter (paid API calls)
- Potential data exfiltration through crafted prompts

**Recommended Fix:**
```typescript
// Add to webhook handler before normalization
if (config.inbound_auth_type && config.inbound_auth_type !== 'none') {
  const provided = req.headers['x-api-key'] || req.headers['authorization'];
  if (!validateAuth(config.inbound_auth_type, config.inbound_auth_value, provided)) {
    logRequest(endpointId, incomingPayload, null, Date.now() - startTime, 'error', 'Auth failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

**Effort:** 🟡 MEDIUM (4–6 hours — need provider-specific signature validation)

---

### Issue 2: No Request Log Rotation

**Severity:** 🟡 WARNING  
**Status:** 🔴 Open  
**File:** `src/services/enterpriseEndpoints.ts`

**Description:**  
The `endpoint_requests` table grows unbounded. Full inbound payloads and AI responses are stored as JSON strings. High-traffic endpoints could accumulate millions of rows with large payloads.

**Impact:**
- SQLite database file grows continuously
- Query performance degrades over time
- Disk space consumption

**Recommended Fix:**
```sql
-- Add scheduled cleanup (e.g., in health monitor every 24h)
DELETE FROM endpoint_requests
WHERE timestamp < datetime('now', '-30 days');

-- Or add a VACUUM after cleanup
VACUUM;
```

**Effort:** 🟢 LOW (1–2 hours)

---

### Issue 3: OpenAI Provider Not Implemented

**Severity:** 🟡 WARNING  
**Status:** 🔴 Open  
**File:** `src/routes/enterpriseWebhook.ts`

**Description:**  
The `llm_provider` field and Zod schema accept `'openai'` as a valid value, and the admin UI allows selecting it, but the webhook handler only implements `callOllama()` and `callOpenRouter()`. Endpoints configured with `openai` will throw `Error: Unsupported LLM provider: openai` at runtime.

**Impact:**
- Admin can create endpoints that will always fail
- Confusing error message
- 500 error on every webhook request

**Recommended Fix:** Either:
1. Implement `callOpenAI()` following the same pattern as `callOpenRouter()`
2. Remove `'openai'` from the Zod enum and admin UI dropdown

**Effort:** 🟢 LOW (2 hours for option 1, 30 minutes for option 2)

---

### Issue 4: No GLM Provider Support

**Severity:** 🟢 LOW  
**Status:** 🟡 Deferred  
**File:** `src/routes/enterpriseWebhook.ts`

**Description:**  
The AI Gateway module now uses GLM (ZhipuAI) as the primary provider for all tiers (v2.9.0), but enterprise endpoints still only support Ollama and OpenRouter. Adding GLM would provide a free high-quality option for enterprise endpoints.

**Impact:**
- Enterprise endpoints cannot benefit from the GLM-first routing strategy
- All enterprise endpoints using OpenRouter incur costs

**Recommended Fix:** Add `callGLM()` function mirroring the implementation in `assistantAIRouter.ts` (Anthropic-compatible Messages API).

**Effort:** 🟡 MEDIUM (4 hours)

---

### Issue 5: Only First Tool Call Processed

**Severity:** 🟢 LOW  
**Status:** 🔴 Open  
**File:** `src/routes/enterpriseWebhook.ts`

**Description:**  
When OpenRouter returns multiple `tool_calls`, only `tool_calls[0]` is extracted and forwarded. Multi-step workflows that require sequential tool execution are not supported.

**Impact:**
- Complex AI workflows limited to single-action responses
- Subsequent tool calls are silently dropped

**Effort:** 🟡 MEDIUM (4–6 hours — requires sequential tool execution loop)

---

### Issue 6: Stateless Conversation History

**Severity:** 🟢 LOW  
**Status:** 🟡 By Design  
**File:** `src/routes/enterpriseWebhook.ts`

**Description:**  
Conversation history is caller-managed — the client must send previous messages in each request via the `history` field. The server does not persist conversations. This is by design for simplicity but limits use cases where the client cannot maintain state (e.g., simple WhatsApp integrations).

**Impact:**
- Clients without state management get no conversation context
- Each request is effectively a new conversation unless history is provided
- Max 10 messages retained per request (context window management)

**Recommended Fix (if needed):**
```sql
-- Add server-side conversation table
CREATE TABLE endpoint_conversations (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  messages TEXT NOT NULL,  -- JSON array
  updated_at TEXT NOT NULL,
  FOREIGN KEY (endpoint_id) REFERENCES enterprise_endpoints(id) ON DELETE CASCADE
);
```

**Effort:** 🔴 HIGH (8–12 hours — requires sender identification, conversation matching, TTL management)

---

## 6. Future Considerations

| Feature | Priority | Description |
|---------|----------|-------------|
| Inbound auth validation | 🔴 HIGH | Enforce `inbound_auth_type` checks at webhook entry |
| Log rotation | 🟡 MEDIUM | Scheduled cleanup of old request logs |
| GLM provider | 🟡 MEDIUM | Add GLM as a free LLM option for enterprise endpoints |
| Server-side conversations | 🟢 LOW | Persist conversation history per sender |
| Rate limiting | 🟡 MEDIUM | Per-endpoint rate limits to prevent abuse |
| Webhook retries | 🟢 LOW | Retry failed action forwards with exponential backoff |
| Multi-tool execution | 🟢 LOW | Process all tool calls, not just the first |
| Streaming responses | 🟢 LOW | SSE streaming for long AI responses |
| Credit deduction | ✅ DONE | ~~Integrate with credit system for OpenRouter cost tracking~~ Implemented in v1.2.0 |
| Endpoint analytics | 🟢 LOW | Aggregated metrics (requests/hour, avg latency, error rate) |

---

## 7. Package System Impact (v1.2.0 — Implemented)

The [Packages module](../Packages/README.md) introduces `max_enterprise_endpoints` as a per-package limit:

| Package | `max_enterprise_endpoints` |
|---------|---------------------------|
| Free | `NULL` (none allowed) |
| Starter | `NULL` (none allowed) |
| Professional | `NULL` (none allowed) |
| Bring Your Own Endpoint | 5 |
| Managed | 20 |
| Architecture & Build | `NULL` (unlimited — custom) |
| Staff | `NULL` (unlimited) |

**Impact**: Enterprise endpoint creation should check the contact's package limit before allowing new endpoints. The webhook handler now enforces package status and credit balance (v1.2.0), but the `max_enterprise_endpoints` limit is not yet checked at creation time in `adminEnterpriseEndpoints.ts`.

**Cross-reference**: See [Packages FIELDS.md](../Packages/FIELDS.md) for the `max_enterprise_endpoints` column definition.
