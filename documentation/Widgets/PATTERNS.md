# Widgets Module — Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

This document catalogs the architecture patterns found in the Widgets module, covering embedding storage, RAG retrieval, tier-based routing, lead capture, usage enforcement, knowledge ingestion, and client-side widget isolation.

---

## 2. Architectural Patterns

### 2.1 Shadow DOM Isolation Pattern

**Context:** The widget must render on any third-party website without CSS/JS conflicts. Host page styles (global resets, font-size, z-index, etc.) must not affect widget appearance, and widget styles must not leak out.

**Implementation:**

```javascript
// widget.js — IIFE entry point
const widgetContainer = document.createElement('div');
widgetContainer.id = 'softaware-widget-container';
const shadowRoot = widgetContainer.attachShadow({ mode: 'open' });

// Inject scoped styles
const style = document.createElement('style');
style.textContent = `
  :host { all: initial; font-family: -apple-system, ...; }
  .widget-wrapper { position: fixed; right: 20px; bottom: 20px; z-index: 9999; }
  ...
`;
shadowRoot.appendChild(style);

// All DOM queries use shadowRoot instead of document
const toggleBtn = shadowRoot.getElementById('widget-toggle');
const input = shadowRoot.getElementById('widget-input');
```

**Benefits:**
- ✅ Complete CSS isolation — no style leaks in or out
- ✅ `:host { all: initial }` resets all inherited properties
- ✅ `mode: 'open'` allows debugging via DevTools
- ✅ No iframe overhead or cross-origin restrictions
- ✅ Widget feels native — no visible boundary

**Drawbacks:**
- ❌ Cannot use global document selectors (must use `shadowRoot.getElementById()`)
- ❌ Some CSS frameworks may not fully support Shadow DOM
- ❌ Font-face declarations inside shadow DOM may need special handling

---

### 2.2 Inline SSE Chat Pattern (Assistant Embed Widget)

**Context:** The assistant embed widget (`/api/assistants/widget.js`) needs to render a fully functional chat UI on any third-party website. Previously used an iframe pointing to `softaware.net.za/chat/{id}`, but `X-Frame-Options` headers blocked framing, causing a "refused to connect" error.

**Implementation:**

```javascript
// assistants.ts — widget.js served from /api/assistants/widget.js

// Build inline chat UI (no iframe)
var messagesArea = document.createElement('div');
messagesArea.style.cssText = 'flex:1; overflow-y:auto; padding:16px; background:#f5f5f5; display:flex; flex-direction:column; gap:12px;';
chatContainer.appendChild(messagesArea);

// Input area with text input + send button
var chatInput = document.createElement('input');
var sendBtn = document.createElement('button');
// ... input area appended to chatContainer

// SSE streaming via fetch + ReadableStream
fetch(chatApiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assistantId, message, conversationHistory })
}).then(function(response) {
  var reader = response.body.getReader();
  var decoder = new TextDecoder();
  var assistantBubble = null;
  var fullText = '';

  function readChunk() {
    reader.read().then(function(result) {
      if (result.done) return;
      // Parse SSE lines: data: {"token":"..."} or data: {"done":true}
      // Update assistantBubble.textContent with accumulated tokens
      readChunk();
    });
  }
  readChunk();
});
```

**Benefits:**
- ✅ No iframe — eliminates X-Frame-Options / CSP blocking entirely
- ✅ Real-time streaming — tokens appear word-by-word as the AI generates them
- ✅ Works on any domain — no cross-origin framing issues
- ✅ Consistent design — same branded header, footer, and chat bubble styles
- ✅ Conversation history maintained client-side (last 10 messages)
- ✅ Typing indicator with animated dots while waiting for first token

**Drawbacks:**
- ❌ Larger script payload (~300 LOC of DOM creation vs single iframe tag)
- ❌ No CSS isolation (unlike Shadow DOM widget.js) — styles injected via inline `style.cssText`
- ❌ ReadableStream API requires modern browsers (IE11 not supported)

**Contrast with widget.js (Shadow DOM):**
The standalone `widget.js` at `/var/www/code/widget.js` uses Shadow DOM for CSS isolation and `fetch()` with JSON responses (non-streaming). The assistant embed widget uses inline DOM + SSE streaming for real-time token display. Both render chat UIs directly without iframes.

---

### 2.3 MySQL-Based Vector Search Pattern

**Context:** The Widgets module stores embeddings as JSON arrays in MySQL and performs cosine similarity in application code, rather than using a dedicated vector database.

**Implementation:**

```typescript
// embeddingService.ts — searchSimilar()

// 1. Load ALL embeddings for client from MySQL
const results = await db.query<any>(
  `SELECT dm.id, dm.content, dm.source_url, dm.source_type, de.embedding
   FROM document_metadata dm
   INNER JOIN document_embeddings de ON dm.id = de.document_id
   WHERE dm.client_id = ?`,
  [clientId]
);

// 2. Parse JSON and compute cosine similarity in JS
const scored = results.map(row => {
  const embedding = JSON.parse(row.embedding);
  const similarity = cosineSimilarity(queryEmbedding, embedding);
  return { ...row, similarity };
});

// 3. Sort and return top N
return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
```

**Benefits:**
- ✅ No additional database dependency (sqlite-vec, pgvector, etc.)
- ✅ Simple to implement and debug
- ✅ Works with standard MySQL hosting
- ✅ JSON storage is flexible — easy to change embedding dimensions

**Drawbacks:**
- ❌ O(n) — loads ALL embeddings into memory per query
- ❌ JSON parsing overhead for every embedding on every search
- ❌ No indexing — linear scan instead of approximate nearest neighbor
- ❌ Scales poorly beyond ~10K chunks per client
- ❌ Memory pressure with many concurrent queries

**Contrast with Assistants Module:**
The Assistants module uses sqlite-vec with a `vec0` virtual table for true KNN indexing. The Widgets module uses the naive MySQL approach, which is simpler but less performant. Consider migrating to sqlite-vec for clients with large knowledge bases.

---

### 2.4 Tier-Based AI Routing Pattern

**Context:** Different subscription tiers get different AI model quality. The routing cascades through providers, falling back to cheaper options if premium providers fail.

**Implementation:**

```typescript
// widgetChat.ts — POST /chat handler

const isPaidTier = client.subscription_tier === 'advanced' 
                || client.subscription_tier === 'enterprise';

if (isPaidTier && client.external_api_provider) {
  // Client's own API key (Gemini, Claude)
  assistantMessage = await callExternalLLM(provider, encryptedKey, messages);
} else {
  // Tier-based cascading fallback via assistantAIRouter
  const tier = isPaidTier ? 'paid' : 'free';
  const result = await chatCompletion(tier, messages, { temperature: 0.4 });
  // Paid:  GLM → OpenRouter → Ollama
  // Free:  GLM → Ollama
}
```

**Routing Cascade:**

```
External API (if configured)
  ↓ (not configured)
GLM (glm-4.6 via Anthropic API) ← tried first for ALL tiers
  ↓ (fails/timeout)
OpenRouter (gpt-4o-mini) ← paid tiers only
  ↓ (fails/timeout)
Ollama (qwen2.5:1.5b-instruct) ← last resort / free tier fallback
```

**Benefits:**
- ✅ Best available model for each tier
- ✅ Graceful degradation — never fails completely
- ✅ Clients can bring their own API keys
- ✅ Shared routing logic with Assistants module (`assistantAIRouter.ts`)

**Drawbacks:**
- ❌ Latency variability — first-tier failures add delay before fallback
- ❌ No per-request model selection (tier dictates routing)

---

### 2.5 Middleware Pipeline Pattern

**Context:** Widget requests must pass through status checks and usage enforcement before reaching route handlers. The pipeline is composable and fail-open.

**Implementation:**

```typescript
// app.ts — route mounting
apiRouter.use('/v1', checkWidgetStatus, widgetChatRouter);
apiRouter.use('/v1/ingest', checkWidgetStatus, widgetIngestRouter);

// widgetChat.ts — per-route middleware
router.post('/chat', checkWidgetStatus, enforceMessageLimit, async (req, res) => { ... });
```

**Pipeline Flow:**

```
Request
  → checkWidgetStatus
    → Read clientId from header / params / body
    → SELECT widget_clients.status + users.account_status
    → Block if suspended/demo_expired (403)
    → Pass if active or not found (let route handler 404)
  → enforceMessageLimit
    → ensureBillingCycle() — auto-reset if expired
    → checkMessageLimit() — compare usage vs tier limit
    → Block if exceeded (429 with upgrade prompt)
    → Track usage + attach usageInfo to request
  → Route Handler
    → Business logic
```

**Benefits:**
- ✅ Separation of concerns — auth/billing decoupled from business logic
- ✅ Fail-open on errors — `catch` blocks call `next()` to prevent outages
- ✅ Reusable — `checkWidgetStatus` shared with other widget routes
- ✅ Rich error responses — 429 includes tier info, reset date, upgrade CTA

**Drawbacks:**
- ❌ Fail-open policy means billing errors could allow free messages
- ❌ Double status check (mounted on router AND on individual route)

---

### 2.6 Lead Capture via AI Prompt Engineering Pattern

**Context:** The AI assistant detects buying intent and captures visitor contact info without a separate form. The mechanism relies on prompt engineering + regex-based response parsing.

**Implementation:**

```typescript
// leadCaptureService.ts — buildLeadCapturePrompt()
// Injected into system prompt for Advanced/Enterprise:

"If the user expresses strong interest... gently ask for their email..."
"When you successfully collect their email, output the following JSON AFTER your natural response:"
'{"action": "capture_lead", "email": "...", "name": "...", "message": "..."}'

// parseLeadCapture() — extract JSON from AI response
const jsonMatch = aiResponse.match(/\{[^}]*"action"\s*:\s*"capture_lead"[^}]*\}/);
if (jsonMatch) {
  const leadData = JSON.parse(jsonMatch[0]);
  return { message: aiResponse.replace(jsonMatch[0], '').trim(), action: 'capture_lead', leadData };
}
```

**Benefits:**
- ✅ No separate form UI — natural conversational capture
- ✅ AI decides when to ask — avoids being pushy
- ✅ Structured data extracted from free-text response
- ✅ Clean message returned to user (JSON block stripped)

**Drawbacks:**
- ❌ Regex-based parsing is fragile — nested JSON or malformed output breaks
- ❌ AI may not always follow the format precisely
- ❌ No validation of email format (relies on AI output)
- ❌ Cannot capture leads if AI hallucinates or ignores prompt

---

### 2.7 Synchronous Crawl Pattern

**Context:** URL ingestion currently processes crawl jobs inline (synchronously) during the POST request, rather than using a background worker.

**Implementation:**

```typescript
// widgetIngest.ts — POST /url

// Enqueue (for tracking/retry)
const job = await crawlerService.enqueueCrawl(clientId, url);

// Process immediately (blocks response)
const result = await documentService.crawlWebsite(clientId, url);

if (result.success) {
  await crawlerService.markCompleted(job.id);
} else {
  await crawlerService.markFailed(job.id, result.error);
}

return res.json({ success: result.success, jobId: job.id, chunksCreated: result.chunksCreated });
```

**Benefits:**
- ✅ Simple — no background worker, no polling, no WebSocket for status
- ✅ Immediate feedback — client knows success/failure right away
- ✅ Crawl queue still tracks history for re-enqueue/recrawl

**Drawbacks:**
- ❌ Long response times — crawling can take 30+ seconds
- ❌ Request timeout risk for slow or large pages
- ❌ No parallel crawling — one URL per request
- ❌ Failed crawls must be manually re-triggered (no automatic retry)

**Contrast with Assistants Module:**
The Assistants module uses a background polling worker (`ingestionWorker.ts`, 6s interval) with `FOR UPDATE SKIP LOCKED` for concurrent-safe job processing. The Widgets module should consider adopting this pattern for better reliability.

---

### 2.8 Billing Cycle Auto-Reset Pattern

**Context:** Message limits reset monthly. Instead of a dedicated cron job, billing cycles are lazily checked on every request and reset if expired.

**Implementation:**

```typescript
// usageTracking.ts — ensureBillingCycle()

// On every chat request:
await db.execute(
  `UPDATE widget_clients 
   SET billing_cycle_start = ?,
       billing_cycle_end = ?,
       messages_this_cycle = CASE 
         WHEN billing_cycle_start IS NULL OR billing_cycle_start < ? 
         THEN 0 
         ELSE messages_this_cycle 
       END
   WHERE id = ? AND (billing_cycle_start IS NULL OR billing_cycle_end < CURDATE())`,
  [cycleStart, cycleEnd, cycleStart, clientId]
);
```

**Benefits:**
- ✅ Self-healing — no cron dependency for cycle resets
- ✅ Lazy evaluation — only clients who send messages are checked
- ✅ Atomic — single UPDATE handles both reset and cycle setup

**Drawbacks:**
- ❌ Extra DB write on every request (even if cycle is current — WHERE clause helps)
- ❌ Clients who don't send messages in a month keep stale cycle data
- ❌ `resetExpiredBillingCycles()` exists as backup but must be manually invoked or scheduled

---

## 3. Anti-Patterns & Technical Debt

### 3.1 No Authentication on Ingest Endpoints

**Issue:** All `/api/v1/ingest/*` endpoints are publicly accessible with no authentication. Anyone who knows a `clientId` can add/delete knowledge base content.

**Risk:** Knowledge base tampering, data injection attacks, unauthorized deletion.

**Recommended Fix:** Add API key authentication or require JWT auth for ingest operations. Widget client IDs should be treated as public (exposed in script tag), so a separate secret key is needed for administrative operations.

---

### 3.2 Full Table Scan for Vector Search

**Issue:** `embeddingService.searchSimilar()` loads ALL embeddings for a client into memory, parses each JSON array, and computes cosine similarity in JavaScript.

**Risk:** O(n) memory and CPU per query. Will degrade significantly for clients with thousands of chunks.

**Recommended Fix:** Migrate to sqlite-vec (already used by Assistants module) or PostgreSQL pgvector for indexed KNN search. Alternatively, add a chunk count threshold that switches to a different search strategy.

---

### 3.3 PDF and DOC/DOCX Support Disabled

**Issue:** PDF parsing is commented out due to `pdf-parse` ESM module resolution issues. DOC/DOCX support is not implemented.

**Risk:** Clients are limited to plain text file uploads only.

**Recommended Fix:** Integrate `pdf2json` or `pdfjs-dist` for PDF support. Use `mammoth` for DOCX. The Assistants module already supports these formats via its ingestion pipeline — consider sharing the parsing logic.

---

### 3.4 No Embedding Cascade Delete

**Issue:** When documents are deleted via `deleteDocumentsBySource()` or `deleteClientDocuments()`, the associated `document_embeddings` rows are not explicitly deleted. They become orphaned.

**Risk:** Database bloat from orphaned embedding rows. Possible stale results if document_id references are reused.

**Recommended Fix:** Add `ON DELETE CASCADE` foreign key constraint, or add explicit `DELETE FROM document_embeddings` in the deletion methods. `deleteClientEmbeddings()` exists but is not called from the ingest routes.

---

### 3.5 External API Key Security

**Issue:** `callExternalLLM()` decrypts the API key and attempts to clear it from memory (`apiKey.split('').fill('0')`), but strings are immutable in JavaScript — `split().fill()` operates on a new array and doesn't actually clear the original string.

**Risk:** API keys may persist in memory longer than intended.

**Recommended Fix:** Use `Buffer` instead of strings for sensitive data, which can be explicitly zeroed. Or accept that V8 string handling makes true memory clearing impractical and focus on minimizing key lifetime.

---

### 3.6 Double Middleware Application

**Issue:** `checkWidgetStatus` is applied both at the router mount level in `app.ts` AND again on individual routes in `widgetChat.ts`.

**Risk:** Double database query on every request (status checked twice).

**Recommended Fix:** Apply the middleware only once — either at the router mount or at the route level, not both.

---

### 3.7 No Rate Limiting on Ingest

**Issue:** `enforceMessageLimit` only applies to the `/chat` endpoint. Ingest endpoints (`/url`, `/file`) have no rate limiting beyond the 50-page cap.

**Risk:** Clients could spam crawl requests, exhausting server resources (CPU for crawling, Ollama for embedding generation).

**Recommended Fix:** Add a per-client crawl rate limit (e.g., max 5 URLs per minute) and queue excess requests for deferred processing.

---

## 4. Pattern Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                       Request Pipeline                           │
│                                                                  │
│  checkWidgetStatus ──→ enforceMessageLimit ──→ Route Handler    │
│  (status gate)         (billing/tier gate)     (business logic) │
└─────────────────────────────────────────────────────────────────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                    ┌──────────┐ ┌──────────┐ ┌──────────┐
                                    │ RAG Chat │ │ Ingest   │ │ Status   │
                                    │          │ │          │ │          │
                                    │ embed()  │ │ crawl()  │ │ stats()  │
                                    │ search() │ │ chunk()  │ │          │
                                    │ route()  │ │ embed()  │ │          │
                                    │ capture()│ │ store()  │ │          │
                                    └──────────┘ └──────────┘ └──────────┘
                                         │            │
                                         ▼            ▼
                                    ┌──────────────────────┐
                                    │ MySQL Storage         │
                                    │ • document_metadata   │
                                    │ • document_embeddings │
                                    │ • chat_messages       │
                                    │ • widget_leads        │
                                    │ • usage_logs          │
                                    └──────────────────────┘
```
