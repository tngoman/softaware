# Widgets Module — Overview

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Module Overview

### Purpose

The Widgets module delivers embeddable AI chat widgets that website owners add with a single `<script>` tag. It handles client registration, knowledge ingestion (URL crawling + file upload), RAG-powered chat with tier-based AI routing, lead capture with email notifications, subscription-based usage tracking, and a fully self-contained client-side widget rendered in Shadow DOM.

### Business Value

- **Single-line embed** — one `<script>` tag adds a floating AI chat bubble to any website (WordPress, Shopify, custom, etc.)
- **RAG-powered responses** — widget answers are grounded in the site's own knowledge base (crawled pages + uploaded documents)
- **4-tier subscription model** — Free (500 msg/mo), Starter (5,000), Advanced (15,000), Enterprise (unlimited)
- **Lead capture** — AI detects buying intent, collects visitor contact info, and sends real-time email notifications to the business owner
- **Tone control** — Advanced/Enterprise clients configure tone presets (professional, friendly, technical, sales, legal, medical, luxury) or custom instructions
- **Branding removal** — paid tiers remove the "Powered by Soft Aware" footer
- **External LLM support** — Advanced/Enterprise clients can bring their own API keys (Gemini, Claude)
- **Tier-based AI routing** — Free → GLM → Ollama; Paid → GLM → OpenRouter → Ollama cascading fallback
- **Shadow DOM isolation** — widget CSS/JS never conflicts with the host website's styles
- **Billing-cycle usage tracking** — automatic monthly resets, proactive limit-approaching warnings, upgrade prompts
- **Crawl queue** — URL ingestion with retry logic (max 3 retries), priority ordering
- **Site Builder integration** — generated sites can embed a widget via `widget_client_id` association

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 2 (widgetChat.ts, widgetIngest.ts) |
| Backend service files | 5 (widgetService.ts, documentService.ts, embeddingService.ts, crawlerService.ts, leadCaptureService.ts) |
| Backend middleware files | 2 (usageTracking.ts, statusCheck.ts — shared) |
| Backend LOC | ~2,150 |
| Client-side widget | 1 (widget.js — 453 LOC) |
| Total LOC | ~2,600 |
| API endpoints | 7 |
| MySQL tables | 7 (widget_clients, widget_leads_captured, widget_usage_logs, document_metadata, document_embeddings, crawl_queue, chat_messages) + 1 config (subscription_tier_limits) |
| Subscription tiers | 4 (free, starter, advanced, enterprise) |
| Tone presets | 7 (professional, friendly, technical, sales, legal, medical, luxury) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   CLIENT WEBSITE (any domain)                            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  <script src="https://api.softaware.net.za/widget.js"           │   │
│  │          data-client-id="YOUR_CLIENT_ID"></script>               │   │
│  └──────────┬───────────────────────────────────────────────────────┘   │
│             │                                                            │
│  ┌──────────▼───────────────────────────────────────────────────────┐   │
│  │  Shadow DOM Container                                            │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │ widget.js (IIFE, 453 LOC)                               │    │   │
│  │  │ • data-client-id, data-color, data-position, data-api-base│   │   │
│  │  │ • Shadow DOM style injection (no host CSS leaks)         │    │   │
│  │  │ • Floating action button (60×60, configurable color)     │    │   │
│  │  │ • Chat panel (380×600, responsive)                       │    │   │
│  │  │ • Message history + typing indicator                     │    │   │
│  │  │ • "Powered by Soft Aware" footer (free tier)             │    │   │
│  │  │ • POST /api/v1/chat with conversationHistory[]           │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Middleware Pipeline                                             │    │
│  │  checkWidgetStatus → enforceMessageLimit → route handler        │    │
│  │                                                                 │    │
│  │  checkWidgetStatus:                                             │    │
│  │    reads X-Widget-Client-Id header / params.clientId / body     │    │
│  │    checks widget_clients.status + owner user account_status     │    │
│  │                                                                 │    │
│  │  enforceMessageLimit:                                           │    │
│  │    reads client_id from body/query                              │    │
│  │    ensures billing cycle current → checks tier limit            │    │
│  │    429 with upgrade prompt if exceeded                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/v1/chat  →  widgetChat.ts                                 │    │
│  │  POST /chat           — RAG-powered chat (tier-based routing)   │    │
│  │  GET  /client/:id/status — usage stats + limits                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/v1/ingest  →  widgetIngest.ts                             │    │
│  │  POST /url                 — crawl + ingest URL                 │    │
│  │  POST /file                — upload + ingest file               │    │
│  │  GET  /sources/:clientId   — list ingested sources              │    │
│  │  DELETE /source            — delete specific source             │    │
│  │  DELETE /all/:clientId     — delete all documents               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  SERVICES                                                       │    │
│  │  widgetService.ts       — client CRUD, usage stats, chat logs   │    │
│  │  documentService.ts     — chunking, crawling, document storage  │    │
│  │  embeddingService.ts    — Ollama nomic-embed-text (768-dim)     │    │
│  │  crawlerService.ts      — crawl queue management (3 retries)    │    │
│  │  leadCaptureService.ts  — lead parsing, storage, email notify   │    │
│  │  assistantAIRouter.ts   — 3-tier chat routing (shared w/ Assistants) │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STORAGE (MySQL)                                                │    │
│  │  widget_clients          — client config, tier, billing, status │    │
│  │  document_metadata       — chunked content (text + source info) │    │
│  │  document_embeddings     — 768-dim JSON vectors per chunk       │    │
│  │  crawl_queue             — URL crawl jobs with retry tracking   │    │
│  │  chat_messages           — full chat history per session        │    │
│  │  widget_leads_captured   — captured visitor leads               │    │
│  │  widget_usage_logs       — per-cycle message counts             │    │
│  │  subscription_tier_limits — tier feature/limit definitions      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Widget Initialization (Client Website)

```
Website loads <script data-client-id="..." src=".../widget.js">
  → IIFE executes immediately
  → Reads data-client-id, data-color, data-position, data-api-base from script tag
  → Creates Shadow DOM container (style isolation)
  → Injects CSS (scoped to shadow root) + HTML structure
  → Attaches event listeners (toggle, close, send, Enter key)
  → Renders floating button (bottom-right by default)
  → Renders hidden chat panel with welcome message: "Hi! How can I help you today?"
  → Logs initialization to console
```

### 3.2 Widget Chat Conversation

```
Visitor types message → clicks Send or presses Enter
  → addMessage('user', message) to UI
  → Push to local conversationHistory[]
  → Show typing indicator (3 bouncing dots)
  → POST /api/v1/chat { clientId, message, conversationHistory }

Middleware Pipeline:
  → checkWidgetStatus: verify widget_clients.status == 'active'
  → enforceMessageLimit: check messages_this_cycle < tier limit
    → 429 if exceeded (upgrade prompt in response)
    → Increment messages_this_cycle + message_count

Route Handler (widgetChat.ts):
  → getClientByIdWithTier(clientId) — includes generated_sites business_name
  → generateEmbedding(message) via nomic-embed-text (768-dim)
  → embeddingService.searchSimilar(clientId, queryEmbedding, 5)
    → Loads ALL embeddings for client → cosine similarity → top 5
  → Build system prompt:
    ┌─────────────────────────────────────┐
    │ "You are a helpful AI assistant     │
    │  for {website_url}."                │
    │                                     │
    │ [RAG Context 1..5]                  │
    │                                     │
    │ [TONE & STYLE] (Advanced/Enterprise)│
    │                                     │
    │ [LEAD CAPTURE] (if enabled)         │
    └─────────────────────────────────────┘
  → Build messages[]: [system, ...conversationHistory, user]

  → IF client has external_api_provider (Gemini/Claude):
      → callExternalLLM(provider, encryptedKey, messages)
  → ELSE tier-based routing via assistantAIRouter.chatCompletion():
      → Paid: GLM → OpenRouter → Ollama
      → Free: GLM → Ollama

  → Parse lead capture signals from AI response
    → IF {"action": "capture_lead"} detected:
      → storeCapturedLead() in widget_leads_captured
      → sendLeadNotification() email to business owner
  → Log user + assistant messages to chat_messages
  → Return { success, message, relevantDocsFound, model, tier, poweredBy?, leadCaptured? }

Client-side:
  → hideTyping()
  → addMessage('assistant', data.message)
  → Warn if approaching limit (≥90%)
```

### 3.3 Knowledge Ingestion — URL Crawl

```
POST /api/v1/ingest/url { clientId, url }
  → Validate URL format
  → getClientById(clientId) — check exists
  → Check pages_ingested < 50 (page limit)
  → crawlerService.enqueueCrawl(clientId, url)
    → INSERT into crawl_queue (status: 'pending')
  → documentService.crawlWebsite(clientId, url)
    → axios.get(url) with 30s timeout, SoftAware-Bot/1.0 User-Agent
    → cheerio.load(html) → strip scripts/nav/ads → extract main content
    → chunkText(text, 1000 chars, 200 overlap, sentence-boundary aware)
    → For each chunk:
      → storeChunk() → INSERT into document_metadata
      → embeddingService.embedDocument() → generateEmbedding() → store in document_embeddings
    → UPDATE widget_clients SET pages_ingested += 1
  → Mark crawl job completed (or failed with error)
  → Return { success, jobId, chunksCreated }
```

### 3.4 Knowledge Ingestion — File Upload

```
POST /api/v1/ingest/file (multipart form: clientId + file)
  → multer validation: 10MB max, PDF/TXT/DOC/DOCX only
  → Check pages_ingested < 50
  → Extract text:
    → PDF: ❌ temporarily disabled (module resolution issues)
    → TXT: buffer.toString('utf-8')
    → DOC/DOCX: ❌ not yet implemented
  → Validate content length ≥ 100 chars
  → documentService.storeFileContent():
    → chunkText(content) → store chunks + embeddings
    → Update pages_ingested
  → Return { success, chunksCreated, filename }
```

### 3.5 Lead Capture Flow

```
Advanced/Enterprise widget chat:
  → System prompt includes LEAD CAPTURE INSTRUCTIONS
  → AI detects buying intent in conversation
  → AI naturally asks for email, then outputs JSON block:
    {"action": "capture_lead", "email": "...", "name": "...", "message": "..."}
  → parseLeadCapture(aiResponse):
    → Regex matches JSON block in response
    → Extracts leadData, cleans response text
  → storeCapturedLead(clientId, leadData, chatContext)
    → INSERT into widget_leads_captured
  → sendLeadNotification(clientId, leadData, businessName)
    → SMTP via credentialVault
    → HTML + plain text email with lead card, CTA, branding
    → Reply-To set to visitor's email
    → Mark notification_sent = TRUE
  → Return to widget with leadCaptured: true
```

### 3.6 Billing Cycle & Usage Tracking

```
Every chat message → enforceMessageLimit middleware:
  → ensureBillingCycle(clientId):
    → If billing_cycle_end < today → reset messages_this_cycle to 0
    → Set billing_cycle_start = 1st of current month
    → Set billing_cycle_end = last day of current month
  → checkMessageLimit(clientId):
    → JOIN widget_clients × subscription_tier_limits
    → Enterprise: always allowed (unlimited)
    → Others: messages_this_cycle < max_messages_per_month
    → Suspended: blocked regardless of usage
  → If allowed:
    → trackMessageUsage(): increment messages_this_cycle + message_count
    → Log to widget_usage_logs (ON DUPLICATE KEY UPDATE)
  → If exceeded:
    → 429 with tier name, usage/limit stats, reset date, upgrade CTA

Cron (resetExpiredBillingCycles):
  → UPDATE widget_clients SET messages_this_cycle = 0
    WHERE billing_cycle_end < CURDATE()
```

---

## 4. Key Features

### 4.1 Single-Line Embed

Any website can add the widget with one script tag:

```html
<script src="https://api.softaware.net.za/widget.js" data-client-id="YOUR_CLIENT_ID"></script>
```

**Configurable attributes:**

| Attribute | Purpose | Default |
|-----------|---------|---------|
| `data-client-id` | Widget client UUID (required) | — |
| `data-api-base` | API endpoint override | `https://api.softaware.net.za` |
| `data-color` | Primary color (hex) | `#0044cc` |
| `data-position` | `bottom-right` or `bottom-left` | `bottom-right` |

### 4.2 Shadow DOM Isolation

The widget renders inside a Shadow DOM container (`mode: 'open'`), ensuring:
- Widget CSS never leaks into the host page
- Host page CSS never affects widget appearance
- All selectors are scoped to the shadow root
- `getElementById` calls use `shadowRoot.getElementById()`

### 4.3 Tier-Based AI Routing

| Tier | Chat Model Routing | Features |
|------|-------------------|----------|
| Free | GLM → Ollama (qwen2.5:3b) | 500 msg/mo, branding, basic RAG |
| Starter | GLM → Ollama | 5,000 msg/mo, branding removal |
| Advanced | GLM → OpenRouter → Ollama | 15,000 msg/mo, tone control, lead capture, external API keys |
| Enterprise | GLM → OpenRouter → Ollama (or custom) | Unlimited, all features, loopback API access |

If a client has configured their own `external_api_provider` (Gemini or Claude), that provider is used directly instead of the tier cascade.

### 4.4 RAG-Powered Responses

Every chat message triggers a RAG pipeline:
1. **Embed** the user query via `nomic-embed-text` (768-dim float32)
2. **Search** all document embeddings for this client using cosine similarity
3. **Retrieve** top 5 most relevant chunks
4. **Inject** retrieved context into the system prompt
5. **Generate** response grounded in the knowledge base

### 4.5 Lead Capture (Advanced/Enterprise)

When `lead_capture_enabled = 1`, the system prompt includes lead capture instructions. The AI:
1. Detects buying intent in conversation
2. Naturally asks for visitor's email
3. Outputs a structured JSON block with lead data
4. Backend parses the JSON, stores the lead, and sends a branded HTML email notification to the business owner with a "Reply to Lead" CTA

### 4.6 Tone Control (Advanced/Enterprise)

7 built-in tone presets plus custom instructions:

| Preset | Description |
|--------|-------------|
| professional | Clear, direct, business-appropriate |
| friendly | Warm, conversational, approachable |
| technical | Precise technical language, domain-aware |
| sales | Enthusiastic, persuasive, benefit-focused |
| legal | Formal, precise, thorough |
| medical | Empathetic, professional, patient-friendly |
| luxury | Sophisticated, refined, premium-focused |

Clients can also provide free-form `custom_tone_instructions` that override the preset.

### 4.7 Usage Tracking & Billing Cycles

- Automatic monthly billing cycle management (1st → last day of month)
- Per-cycle message counting with automatic reset
- Proactive client notification when approaching limit (≥90%)
- Tier-aware upgrade prompts in 429 responses
- Usage logging for analytics (`widget_usage_logs`)
- `getClientsNearLimit()` for proactive outreach

### 4.8 Crawl Queue with Retry Logic

URL ingestion uses a persistent queue:
- Jobs enqueued with `status: 'pending'`
- Processing with retry tracking (max 3 retries)
- Re-enqueue support for daily recrawl (Advanced/Enterprise feature)
- Content extraction via cheerio (strips nav, ads, scripts, cookies)
- Sentence-boundary-aware chunking (1000 chars, 200 overlap)

---

## 5. Security

| Feature | Detail |
|---------|--------|
| Widget status gate | `checkWidgetStatus` middleware checks `widget_clients.status` + owner `account_status` |
| Usage enforcement | `enforceMessageLimit` middleware — tier-based monthly limits with 429 responses |
| File upload limits | 10MB max via multer, restricted to PDF/TXT/DOC/DOCX MIME types |
| External API keys | Encrypted at rest via `cryptoUtils.encryptPassword()`; decrypted only in-memory during API calls |
| Shadow DOM | Widget rendered in isolated shadow root — no CSS/JS cross-contamination |
| CORS | `Access-Control-Allow-Origin: *` on widget routes (required for cross-domain embed) |
| Crawl rate | 30-second timeout per URL, `SoftAware-Bot/1.0` User-Agent |
| Billing cycle reset | Automatic — `ensureBillingCycle()` runs on every chat; `resetExpiredBillingCycles()` for cron |
| Lead notification | SMTP credentials loaded from credential vault; Reply-To set to visitor email |
| Fail-open policy | `checkWidgetStatus` and `enforceMessageLimit` fail open (allow request) on internal errors |
| Input validation | URL format validation on ingest; content length ≥ 100 chars for files |
| Page limit | Hard cap at 50 pages per client (`pages_ingested >= 50` → 429) |

---

## 6. Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama API endpoint (embeddings + chat) | — |
| `WIDGET_OLLAMA_MODEL` | Default chat model for widget | `qwen2.5:1.5b-instruct` |
| `OPENROUTER_API_KEY` | OpenRouter auth for paid-tier routing | — |

| Hardcoded Constant | File | Value |
|--------------------|------|-------|
| `CHAT_MODEL` | widgetChat.ts | `qwen2.5:1.5b-instruct` (env override: `WIDGET_OLLAMA_MODEL`) |
| `TONE_PRESETS` | widgetChat.ts | 7 preset objects (professional, friendly, technical, sales, legal, medical, luxury) |
| `CHUNK_SIZE` | documentService.ts | 1000 chars |
| `CHUNK_OVERLAP` | documentService.ts | 200 chars |
| `MIN_CHUNK_LENGTH` | documentService.ts | 50 chars (filter threshold) |
| `MIN_CONTENT_LENGTH` | widgetIngest.ts | 100 chars (file rejection threshold) |
| `MAX_FILE_SIZE` | widgetIngest.ts | 10MB (multer limit) |
| `MAX_PAGES` | widgetIngest.ts | 50 per client |
| `MAX_RETRIES` | crawlerService.ts | 3 |
| `CRAWL_TIMEOUT` | documentService.ts | 30,000ms |
| `USER_AGENT` | documentService.ts | `SoftAware-Bot/1.0` |
| `EMBED_MODEL` | embeddingService.ts | `nomic-embed-text` |
| `EMBED_DIM` | embeddingService.ts | 768 (float32) |
| `RAG_TOP_K` | widgetChat.ts | 5 (similar docs retrieved) |
| `FREE_TIER_LIMIT` | usageTracking.ts | 500 msg/month |
| `STARTER_TIER_LIMIT` | subscription_tier_limits | 5,000 msg/month |
| `ADVANCED_TIER_LIMIT` | subscription_tier_limits | 15,000 msg/month |

---

## 7. Subscription Tiers

| Tier | Price Range | Pages | Messages/Month | Branding | Tone Control | Lead Capture | Document Upload | Daily Recrawl | Priority Support |
|------|------------|-------|----------------|----------|--------------|-------------|-----------------|--------------|-----------------|
| Free | R0 | 50 | 500 | ✅ Shown | ❌ | ❌ | ❌ | ❌ | ❌ |
| Starter | ~R299/mo | 50 | 5,000 | ❌ Removed | ❌ | ❌ | ❌ | ❌ | ❌ |
| Advanced | ~R899/mo | 50 | 15,000 | ❌ Removed | ✅ | ✅ | ✅ | ✅ | ❌ |
| Enterprise | Custom | 50 | Unlimited | ❌ Removed | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 8. Documentation Index

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | This file — module overview, architecture, data flows |
| [FILES.md](FILES.md) | File inventory with functions, interfaces, LOC per file |
| [FIELDS.md](FIELDS.md) | Complete database schema (8 MySQL tables) |
| [ROUTES.md](ROUTES.md) | All 7 API endpoints with curl examples and response shapes |
| [PATTERNS.md](PATTERNS.md) | Architecture patterns, anti-patterns, technical debt |
| [CHANGES.md](CHANGES.md) | Version history and known issues |
