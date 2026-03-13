# Widgets Module — File Inventory

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 9 (2 route + 5 service + 1 middleware + 1 client-side widget) |
| **Total LOC** | ~2,600 |
| **Backend route files** | 2 (~576 LOC) |
| **Backend service files** | 5 (~1,229 LOC) |
| **Backend middleware files** | 1 (~345 LOC) — widget-specific; statusCheck.ts shared |
| **Client-side widget** | 1 (~453 LOC) |

### Directory Tree

```
Backend:
  src/routes/widgetChat.ts                 (332 LOC)  ⭐ RAG chat + tier routing + lead capture
  src/routes/widgetIngest.ts               (244 LOC)  ⭐ URL crawl + file upload + source management
  src/services/widgetService.ts            (280 LOC)  ⭐ client CRUD, usage stats, chat logging
  src/services/documentService.ts          (316 LOC)  ⭐ chunking, crawling, document storage
  src/services/embeddingService.ts         (171 LOC)  ⭐ Ollama nomic-embed-text, cosine similarity
  src/services/crawlerService.ts           (158 LOC)  ⭐ crawl queue management, retry logic
  src/services/leadCaptureService.ts       (304 LOC)  ⭐ lead parsing, storage, SMTP notification
  src/middleware/usageTracking.ts          (345 LOC)  ⭐ billing cycles, tier limits, usage tracking

Client-side (deployed):
  /var/www/code/widget.js                  (453 LOC)  ⭐ embeddable Shadow DOM chat widget

Shared (not counted — belong to other modules):
  src/middleware/statusCheck.ts             (shared)   checkWidgetStatus() function
  src/services/assistantAIRouter.ts        (shared)   chatCompletion() for tier-based routing
```

---

## 2. Backend Files

### 2.1 `src/routes/widgetChat.ts` — Widget Chat Endpoint

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/widgetChat.ts` |
| **LOC** | 332 |
| **Purpose** | RAG-powered chat with tier-based AI routing, lead capture detection, external LLM support, client status/usage endpoint |
| **Dependencies** | express, axios, widgetService, embeddingService, usageTracking (enforceMessageLimit), statusCheck (checkWidgetStatus), leadCaptureService, assistantAIRouter |
| **Exports** | `default` (Express Router) |

#### Constants

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `OLLAMA_API` | string | `process.env.OLLAMA_API \|\| 'http://localhost:11434'` | Ollama endpoint |
| `CHAT_MODEL` | string | `process.env.WIDGET_OLLAMA_MODEL \|\| 'qwen2.5:1.5b-instruct'` | Default chat model |
| `TONE_PRESETS` | Record<string, string> | 7 entries | Tone instruction templates |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `callExternalLLM` | `provider, encryptedKey, messages` | `Promise<string>` | Routes to Gemini or Claude with decrypted API key |
| `callGeminiAPI` | `apiKey, messages` | `Promise<string>` | Calls Google Gemini 1.5 Flash (converts message format) |
| `callClaudeAPI` | `apiKey, messages` | `Promise<string>` | Calls Anthropic Claude 3.5 Haiku (separates system message) |

#### Endpoints

| Method | Path | Auth | Middleware | Handler Purpose |
|--------|------|------|-----------|-----------------|
| POST | /chat | None | checkWidgetStatus, enforceMessageLimit | RAG chat with tier-based routing + lead capture |
| GET | /client/:clientId/status | None | — | Widget client status + usage stats |

---

### 2.2 `src/routes/widgetIngest.ts` — Knowledge Ingestion

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/widgetIngest.ts` |
| **LOC** | 244 |
| **Purpose** | URL crawling, file upload ingestion, source management (list/delete) |
| **Dependencies** | express, multer, documentService, crawlerService, widgetService |
| **Exports** | `default` (Express Router) |

#### Configuration

| Config | Value | Description |
|--------|-------|-------------|
| `multer.memoryStorage` | — | Files buffered in memory (not disk) |
| `fileSize limit` | 10MB | Maximum upload size |
| `allowedTypes` | `['application/pdf', 'text/plain', 'application/msword', '...wordprocessingml...']` | Accepted MIME types |

#### Endpoints

| Method | Path | Auth | Handler Purpose |
|--------|------|------|-----------------|
| POST | /url | None | Crawl URL + ingest content |
| POST | /file | None (multer) | Upload + ingest file |
| GET | /sources/:clientId | None | List ingested sources |
| DELETE | /source | None | Delete specific source |
| DELETE | /all/:clientId | None | Delete all client documents |

---

### 2.3 `src/services/widgetService.ts` — Client Management

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/widgetService.ts` |
| **LOC** | 280 |
| **Purpose** | CRUD for widget clients, usage statistics, chat message logging, admin client listing |
| **Dependencies** | crypto, db/mysql |
| **Exports** | `widgetService` (object with methods) |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `WidgetClient` | MySQL row shape for `widget_clients` table |
| `DocumentChunk` | MySQL row shape for `document_metadata` table |
| `ChatMessage` | MySQL row shape for `chat_messages` table |

#### Methods

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `createClient` | `{ userId?, websiteUrl, widgetColor? }` | `Promise<WidgetClient>` | Create new widget client (UUID) |
| `getClientById` | `clientId` | `Promise<WidgetClient \| null>` | Fetch single client |
| `getClientByIdWithTier` | `clientId` | `Promise<any \| null>` | Client + JOIN generated_sites for business_name |
| `getClientsByUserId` | `userId` | `Promise<WidgetClient[]>` | All clients for a user |
| `incrementMessageCount` | `clientId` | `Promise<void>` | Increment message_count + update last_active |
| `hasReachedLimit` | `clientId` | `Promise<boolean>` | Check message_count >= max_messages |
| `resetMessageCount` | `clientId` | `Promise<void>` | Reset message_count to 0 |
| `updateClient` | `clientId, updates` | `Promise<void>` | Partial update (whitelisted fields only) |
| `getUsageStats` | `clientId` | `Promise<UsageStats>` | Compute message/page percentages |
| `logChatMessage` | `{ clientId, role, content, ...optional }` | `Promise<ChatMessage>` | INSERT into chat_messages |
| `getChatHistory` | `clientId, sessionId, limit?` | `Promise<ChatMessage[]>` | Recent messages by session |
| `getAllClients` | `page?, limit?` | `Promise<PaginatedResult>` | Admin paginated client list |

---

### 2.4 `src/services/documentService.ts` — Document Processing

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/documentService.ts` |
| **LOC** | 316 |
| **Purpose** | Text chunking, HTML extraction (cheerio), website crawling, file content storage, source management |
| **Dependencies** | crypto, db/mysql, axios, cheerio, embeddingService |
| **Exports** | `documentService` (object with methods) |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `DocumentMetadata` | MySQL row shape for `document_metadata` table |

#### Helper Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `chunkText` | `text, maxChunkSize=1000, overlap=200` | `string[]` | Sentence-boundary-aware chunking with overlap |
| `extractTextFromHTML` | `html, url` | `string` | Cheerio-based extraction — strips scripts, nav, ads; prefers `<main>` / `<article>` |

#### Methods

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `storeChunk` | `{ clientId, content, sourceUrl?, sourceType, chunkIndex }` | `Promise<DocumentMetadata>` | INSERT chunk + auto-generate embedding |
| `crawlWebsite` | `clientId, url` | `Promise<{ success, chunksCreated, error? }>` | Fetch URL → extract text → chunk → store + embed → update pages_ingested |
| `storeFileContent` | `{ clientId, content, filename, sourceType }` | `Promise<{ success, chunksCreated, error? }>` | Chunk uploaded content → store + embed → update pages_ingested |
| `getClientDocuments` | `clientId` | `Promise<DocumentMetadata[]>` | All chunks for client ordered by source + index |
| `getDocumentSources` | `clientId` | `Promise<SourceSummary[]>` | Grouped sources with chunk count + total chars |
| `deleteClientDocuments` | `clientId` | `Promise<void>` | Delete all documents + reset pages_ingested |
| `deleteDocumentsBySource` | `clientId, sourceUrl` | `Promise<void>` | Delete source documents + decrement pages_ingested |

---

### 2.5 `src/services/embeddingService.ts` — Vector Embeddings

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/embeddingService.ts` |
| **LOC** | 171 |
| **Purpose** | Generate 768-dim embeddings via Ollama, store in MySQL JSON, cosine similarity search |
| **Dependencies** | crypto, db/mysql, config/env |
| **Exports** | `embeddingService` (object), `generateEmbedding()`, `cosineSimilarity()` |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `DocumentEmbedding` | MySQL row shape for `document_embeddings` table |

#### Standalone Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `generateEmbedding` | `text, model='nomic-embed-text'` | `Promise<number[]>` | Call Ollama `/api/embeddings` → return 768-dim float32 array |
| `cosineSimilarity` | `vecA, vecB` | `number` | Dot product / (magA × magB) — returns -1 to 1 |

#### Methods

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `storeEmbedding` | `documentId, embedding, model?` | `Promise<string>` | INSERT JSON embedding into document_embeddings |
| `getEmbeddingByDocumentId` | `documentId` | `Promise<DocumentEmbedding \| null>` | Fetch + parse JSON embedding |
| `searchSimilar` | `clientId, queryEmbedding, limit=5` | `Promise<ScoredDoc[]>` | Load ALL client embeddings → compute cosine similarity → top N |
| `embedDocument` | `documentId, content, model?` | `Promise<string>` | generateEmbedding() + storeEmbedding() combined |
| `deleteClientEmbeddings` | `clientId` | `Promise<void>` | Cascade delete via JOIN with document_metadata |

---

### 2.6 `src/services/crawlerService.ts` — Crawl Queue

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/crawlerService.ts` |
| **LOC** | 158 |
| **Purpose** | Crawl queue management — enqueue, dequeue, retry, batch processing, re-enqueue for recrawl |
| **Dependencies** | crypto, db/mysql, documentService |
| **Exports** | `crawlerService` (object with methods) |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `CrawlJob` | MySQL row shape for `crawl_queue` table |

#### Methods

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `enqueueCrawl` | `clientId, url` | `Promise<CrawlJob>` | INSERT pending job into crawl_queue |
| `getNextJob` | — | `Promise<CrawlJob \| null>` | SELECT oldest pending job with retries < 3 |
| `markProcessing` | `jobId` | `Promise<void>` | Update status to 'processing' |
| `markCompleted` | `jobId` | `Promise<void>` | Update status to 'completed' |
| `markFailed` | `jobId, errorMessage` | `Promise<void>` | Update status to 'failed', increment retry_count |
| `processPendingJobs` | `maxJobs=10` | `Promise<{ processed, succeeded, failed }>` | Batch process pending crawl jobs |
| `getClientJobs` | `clientId` | `Promise<CrawlJob[]>` | All jobs for client (newest first) |
| `reEnqueueCompleted` | — | `Promise<number>` | Reset all completed jobs to pending (daily recrawl) |

---

### 2.7 `src/services/leadCaptureService.ts` — Lead Capture

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/leadCaptureService.ts` |
| **LOC** | 304 |
| **Purpose** | Parse AI responses for lead signals, store captured leads, send branded email notifications, lead statistics |
| **Dependencies** | db/mysql, crypto, nodemailer, credentialVault |
| **Exports** | `parseLeadCapture()`, `storeCapturedLead()`, `sendLeadNotification()`, `getLeadStats()`, `buildLeadCapturePrompt()` |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `LeadCaptureData` | `{ email, name?, message?, chatContext? }` |
| `AIResponse` | `{ message, action?, leadData? }` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `parseLeadCapture` | `aiResponse: string` | `AIResponse \| null` | Regex-match `{"action":"capture_lead"}` JSON in AI text → extract lead data, clean message |
| `storeCapturedLead` | `clientId, leadData, chatContext?` | `Promise<string>` | INSERT into widget_leads_captured → return lead ID |
| `sendLeadNotification` | `clientId, leadData, businessName?` | `Promise<boolean>` | SMTP branded HTML email with lead card, Reply-To CTA, plain text fallback |
| `getLeadStats` | `clientId, days=30` | `Promise<any>` | Aggregated stats: total leads, unique visitors, notifications sent, by date |
| `buildLeadCapturePrompt` | — | `string` | Returns system prompt instructions for AI lead detection |

---

### 2.8 `src/middleware/usageTracking.ts` — Billing & Usage

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/middleware/usageTracking.ts` |
| **LOC** | 345 |
| **Purpose** | Billing cycle management, tier-based message limit enforcement, usage tracking/analytics, proactive limit warnings |
| **Dependencies** | express, db/mysql, crypto |
| **Exports** | `enforceMessageLimit` (middleware), `trackMessageUsage()`, `checkMessageLimit()`, `getUsageStats()`, `resetExpiredBillingCycles()`, `getClientsNearLimit()` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `getTierLimits` | `tier: string` | `Promise<TierLimits \| null>` | SELECT from subscription_tier_limits |
| `getCurrentBillingCycle` | — | `{ start, end }` | 1st to last day of current month |
| `ensureBillingCycle` | `clientId` | `Promise<void>` | Auto-reset if cycle expired |
| `trackMessageUsage` | `clientId` | `Promise<void>` | Increment messages_this_cycle + log to widget_usage_logs |
| `checkMessageLimit` | `clientId` | `Promise<LimitCheck>` | Check tier limit; Enterprise = unlimited; suspended = blocked |
| `enforceMessageLimit` | `req, res, next` | `Promise<void>` | Express middleware — 429 with upgrade prompt if exceeded; fail-open on error |
| `getUsageStats` | `clientId, months=3` | `Promise<any>` | Aggregated monthly stats with active days |
| `resetExpiredBillingCycles` | — | `Promise<number>` | Bulk reset for cron — returns affected row count |
| `getClientsNearLimit` | `threshold=0.9` | `Promise<any[]>` | Clients at ≥90% usage with email/name for notifications |

---

## 3. Client-Side Widget

### 3.1 `widget.js` — Embeddable Chat Widget

| Property | Value |
|----------|-------|
| **Location** | `/var/www/code/widget.js` |
| **LOC** | 453 |
| **Purpose** | Self-contained embeddable chat widget rendered in Shadow DOM |
| **Dependencies** | None (vanilla JS, IIFE) |
| **Embedding** | `<script src="..." data-client-id="..."></script>` |

#### Configuration (data attributes)

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-client-id` | ✅ | — | Widget client UUID |
| `data-api-base` | ❌ | `https://api.softaware.net.za` | API endpoint |
| `data-color` | ❌ | `#0044cc` | Primary color (hex) |
| `data-position` | ❌ | `bottom-right` | `bottom-right` or `bottom-left` |

#### UI Components

| Component | Description |
|-----------|-------------|
| **FAB Button** | 60×60 rounded button with SVG icon, hover scale animation |
| **Chat Panel** | 380×600 (responsive), header + messages + input + footer |
| **Header** | Colored bar with "Chat with us" title + close button |
| **Messages Area** | Scrollable container with user (right-aligned, colored) + assistant (left-aligned, white) bubbles |
| **Input Area** | Text input (rounded) + circular send button |
| **Footer** | "Powered by Soft Aware" link (free tier) |
| **Typing Indicator** | 3 bouncing dots animation |
| **Error Banner** | Red banner with auto-dismiss (5 seconds) |

#### Functions

| Function | Description |
|----------|-------------|
| `toggleChat()` | Toggle chat panel open/closed, focus input on open |
| `addMessage(role, content)` | Append message bubble to messages container, auto-scroll |
| `showTyping()` | Add typing indicator (3 animated dots) |
| `hideTyping()` | Remove typing indicator |
| `showError(message)` | Show red error banner with 5s auto-dismiss |
| `sendMessage()` | Read input → POST /api/v1/chat → handle response/error |

#### Responsive Behavior

| Breakpoint | Chat Panel Size |
|------------|----------------|
| Desktop (>480px) | 380×600, max 100vw-40px × 100vh-120px |
| Mobile (≤480px) | 100vw-40px × 100vh-120px |
