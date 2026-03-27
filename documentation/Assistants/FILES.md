# Assistants Module — File Inventory

**Version:** 2.4.0  
**Last Updated:** 2026-03-14

> **See also:** [SQLITE_VEC_ARCHITECTURE.md](SQLITE_VEC_ARCHITECTURE.md) for a deep-dive into the vector storage engine.

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 26 (18 source + 3 migration + 3 static widget + 2 new frontend) |
| **Total LOC** | ~12,400 (source) |
| **Backend route files** | 5 (~2,620 LOC) |
| **Backend service files** | 9 (~4,600 LOC) |
| **Backend migration files** | 3 (77 + 62 + 45 LOC) |
| **Frontend files** | 5 (~4,266 LOC) + models ~630 LOC |
| **Static widget files** | 3 (widget.js, chat-widget.js, embed.js) |

### Directory Tree

```
Backend:
  src/routes/assistants.ts                 (1541 LOC) ⭐ inline widget chat UI + theme color + proactive greeting + SSE streaming + telemetry consent
  src/routes/assistantIngest.ts            (224 LOC)
  src/routes/myAssistant.ts                (~340 LOC) ⭐ NEW — unified assistant CRUD (staff + clients)
  src/routes/staffAssistant.ts             (382 LOC)  ⚠️ DEPRECATED — use myAssistant.ts
  src/routes/mobileIntent.ts               (338 LOC)  ⭐ updated — image validation, conversation preview
  src/services/vectorStore.ts              (263 LOC)  ⭐ sqlite-vec deep-dive
  src/services/knowledgeCategorizer.ts     (367 LOC)
  src/services/ingestionWorker.ts          (405 LOC)
  src/services/ingestionAIRouter.ts        (138 LOC)  ⭐ updated — GLM-first AI cleaning
  src/services/assistantAIRouter.ts         (751 LOC)  ⭐ EXTENDED — 3-tier text + vision routing
  src/utils/analyticsLogger.ts             (~160 LOC) ⭐ NEW — PII-sanitized telemetry logging
  src/services/mobileTools.ts              (1211 LOC) ⭐ updated — 41 tools, system prompt rules
  src/services/mobileAIProcessor.ts        (387 LOC)  ⭐ updated — tier-based + vision routing
  src/services/mobileActionExecutor.ts     (2127 LOC) ⭐ updated — 41 executors, collation fix, actionable errors
  src/db/migrations/012_staff_sandbox_prompts.ts (77 LOC)  migration
  src/db/migrations/013_unified_assistant_primary.ts (62 LOC) ⭐ NEW migration
  src/db/migrations/026_ai_telemetry.ts    (45 LOC)  ⭐ NEW migration — telemetry consent columns

Frontend:
  src/pages/portal/Dashboard.tsx           (564 LOC)  ⭐ recently modified
  src/pages/portal/AssistantsPage.tsx      (592 LOC)  ⭐ ENHANCED (v1.7.0) — SSE fixes, per-assistant chat persistence, trash icon
  src/pages/portal/CreateAssistant.tsx     (1537 LOC) ⭐ 4-step wizard + widget config (theme, greeting, proactive toggle) + telemetry consent modal
  src/pages/general/Profile.tsx            (2227 LOC) ⭐ ENHANCED (v2.0.0) — image attachment, voice, chat history sidebar
  src/components/KnowledgeHealthBadge.tsx  (107 LOC)
  src/components/KnowledgeHealthScore.tsx  (275 LOC)
  src/models/SystemModels.ts               (~625 LOC) ⭐ updated — MobileConversation.preview, MyAssistantModel class

Static (deployed):
  softaware.net.za/public_html/widget.js          ⭐ branded widget (root path)
  softaware.net.za/public_html/chat-widget.js     ⭐ branded widget (legacy path)
  softaware.net.za/public_html/embed.js            ⭐ branded embed variant

Brand Assets:
  frontend/public/images/favicon.png       (5.8 KB)  — widget brand icon
```

---

## 2. Backend Files

### 2.1 `src/routes/assistants.ts` — Core Assistant Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/assistants.ts` |
| **LOC** | ~1,541 |
| **Purpose** | Full CRUD, knowledge health, chat (SSE + RAG + vision), inline widget delivery with dynamic theming, admin model management, delete with KB option, **telemetry consent API + chat analytics logging**, widget customization (theme color, proactive greeting, custom welcome message) |
| **Dependencies** | express, zod, axios, db/mysql, services/vectorStore, services/knowledgeCategorizer, config/personaTemplates, services/actionRouter, middleware/statusCheck, **utils/analyticsLogger** |
| **Exports** | `assistantsRouter`, `unloadAssistantModel()` |

#### Interfaces

| Interface | Description |
|-----------|-------------|
| `AssistantRow` | MySQL row shape — snake_case columns + JSON `data` field |
| `AssistantData` | Clean camelCase shape returned to frontend |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `parseAssistantRow(row)` | `AssistantRow` | `AssistantData` | Parses JSON `data` field first, falls back to individual columns |
| `getPersonalityInstructions(personality)` | `string` | `string` | Maps personality to system prompt instructions |
| `getTemperatureForPersonality(personality)` | `string` | `number` | Maps personality to Ollama temperature (0.2–0.8) |
| `unloadAssistantModel()` | — | `Promise<void>` | Sends `keep_alive: 0` to Ollama to free RAM |

#### Endpoints

| Method | Path | Auth | Handler LOC |
|--------|------|------|-------------|
| POST | /admin/unload-model | None | L106-115 |
| GET | /admin/model-status | None | L121-128 |
| GET | / | None | L134-156 |
| POST | /create | None | L162-218 |
| PUT | /:assistantId/update | None | L224-282 |
| GET | /templates | None | L288-290 |
| POST | /:assistantId/checklist/add | None | L296-349 |
| GET | /widget.js | None | L357-432 |
| GET | /:assistantId | None | L439-465 |
| DELETE | /:assistantId | None | L471-503 ⭐ |
| GET | /:assistantId/knowledge-health | None | L516-532 |
| POST | /:assistantId/recategorize | None | L539-553 |
| POST | /chat | None | L560-777 |
| GET | /telemetry-consent | JWT | ⭐ NEW (v2.2.0) |
| POST | /telemetry-consent | JWT | ⭐ NEW (v2.2.0) |

---

### 2.2 `src/routes/assistantIngest.ts` — Ingestion Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/assistantIngest.ts` |
| **LOC** | 224 |
| **Purpose** | URL/file ingestion queuing, job status, job deletion with vector cleanup |
| **Dependencies** | express, crypto, multer, services/vectorStore, db/mysql |
| **Exports** | `default` (Express router with `mergeParams: true`) |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `calculateQueuePosition(tier)` | `'free' \| 'paid'` | `Promise<number>` | Paid = 0; free = count of all pending jobs |
| `assertAssistantExists(assistantId)` | `string` | `Promise<boolean>` | Quick existence check |

#### Endpoints

| Method | Path | Auth | Handler LOC |
|--------|------|------|-------------|
| POST | /url | None | L73-107 |
| POST | /file | None | L113-163 |
| GET | /status | None | L169-202 |
| DELETE | /job/:jobId | None | L208-244 |

#### Multer Config

| Setting | Value |
|---------|-------|
| Storage | Memory (no disk writes) |
| Max file size | 10 MB |
| Allowed MIME types | `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

---

### 2.3 `src/services/vectorStore.ts` — sqlite-vec Knowledge Storage

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/vectorStore.ts` |
| **LOC** | 219 |
| **Purpose** | Central vector storage for all assistant knowledge using sqlite-vec |
| **Dependencies** | better-sqlite3, sqlite-vec, path, fs |
| **Exports** | `upsertChunks()`, `search()`, `deleteByJob()`, `deleteByAssistant()`, `stats()`, `close()`, `ChunkInput` |

#### Functions

| Function | Params | Returns | Description | Used By |
|----------|--------|---------|-------------|---------|
| `getDb()` | — | `Database` | Singleton connection, creates tables on first call | All exports |
| `upsertChunks(chunks)` | `ChunkInput[]` | `void` | Batch insert chunks + vectors in a transaction | ingestionWorker |
| `search(assistantId, queryEmbedding, topK)` | `string, number[], number` | Results array | KNN cosine search for RAG retrieval | assistants.ts /chat |
| `deleteByJob(jobId)` | `string` | `number` (count) | Delete all chunks for a specific job | assistantIngest.ts |
| `deleteByAssistant(assistantId)` | `string` | `number` (count) | Delete ALL chunks for an assistant | assistants.ts DELETE ⭐ |
| `stats(assistantId)` | `string` | `{totalChunks, sources[]}` | Count + source breakdown | (health endpoint) |
| `close()` | — | `void` | Clean DB shutdown | (process exit) |

#### Database Config

| Constant | Value |
|----------|-------|
| `VECTOR_DIM` | 768 (nomic-embed-text dimensions) |
| `DB_PATH` | `/var/opt/backend/data/vectors.db` |
| Journal mode | WAL (concurrent reads during writes) |
| Busy timeout | 5000ms |

---

### 2.4 `src/services/knowledgeCategorizer.ts` — Knowledge Health Scoring

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/knowledgeCategorizer.ts` |
| **LOC** | 271 |
| **Purpose** | LLM-based content categorization against dynamic checklists, health score calculation |
| **Dependencies** | axios, config/env, db/mysql, config/personaTemplates |
| **Exports** | `categorizeContent()`, `updateAssistantCategories()`, `mergeChecklist()`, `calculateHealthScore()`, `getAssistantKnowledgeHealth()`, `getStoredChecklist()`, `ChecklistItem` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `categorizeContent(content, checklist)` | `string, ChecklistItem[]` | `Promise<Record<string, boolean>>` | Sends content to `qwen2.5:3b-instruct` with dynamic prompt, returns key→boolean map |
| `updateAssistantCategories(assistantId)` | `string` | `Promise<ChecklistItem[]>` | Full recategorization — reads top 50 chunks, overwrites satisfaction values |
| `mergeChecklist(assistantId, newResults)` | `string, Record<string, boolean>` | `Promise<ChecklistItem[]>` | OR-merge — once satisfied, stays satisfied |
| `calculateHealthScore(checklist)` | `ChecklistItem[]` | `KnowledgeHealth` | Pure calculation: score %, missing list, recommendations |
| `getAssistantKnowledgeHealth(assistantId)` | `string` | Full health response | API-facing: score + checklist + pages + limits + sync |
| `getStoredChecklist(assistantId)` | `string` | `Promise<ChecklistItem[]>` | Load from DB with template fallback |
| `parseStoredChecklist(raw, businessType)` | `string \| null, string` | `ChecklistItem[]` | Handles new format `{checklist: [...]}`, array format, and legacy boolean migration |
| `saveChecklist(assistantId, checklist)` | `string, ChecklistItem[]` | `Promise<void>` | Persist to `knowledge_categories` JSON column |

---

### 2.5 `src/services/ingestionWorker.ts` — Background Ingestion Worker

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/ingestionWorker.ts` |
| **LOC** | ~300 |
| **Purpose** | Background poll loop that processes ingestion jobs: fetch → clean → chunk → embed → store → categorize |
| **Dependencies** | crypto, axios, cheerio, db/mysql, config/env, services/ingestionAIRouter, services/knowledgeCategorizer, services/vectorStore |
| **Exports** | `startIngestionWorker()` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `chunkText(text)` | `string` | `string[]` | Split into ~1200-char chunks with 200-char overlap, sentence-boundary aware |
| `extractTextFromHTML(html)` | `string` | `string` | Cheerio-based extraction: strips nav/header/footer/scripts, prioritizes main/article content |
| `embedText(text)` | `string` | `Promise<number[]>` | Embed via local Ollama `nomic-embed-text` |
| `fetchURL(url)` | `string` | `Promise<string>` | HTTP GET with browser User-Agent, HTTPS agent (rejectUnauthorized: false), extract text from HTML |
| `processJob(job)` | Job row | `Promise<void>` | Full pipeline: fetch → clean → chunk → embed → store MySQL + sqlite-vec → categorize → sync pages |
| `poll()` | — | `Promise<void>` | Dequeue one job (paid first, FIFO within tier), process with 120s timeout, retry up to 3× |
| `startIngestionWorker()` | — | `Promise<void>` | Recovery (reset stuck `processing` jobs), start interval |

#### Worker Config

| Constant | Value |
|----------|-------|
| `POLL_INTERVAL_MS` | 6000 (6 seconds) |
| `EMBED_MODEL` | `nomic-embed-text` |
| `CHUNK_SIZE` | 1200 characters |
| `CHUNK_OVERLAP` | 200 characters |
| `MAX_CONTENT_CHARS` | 15000 |
| `MAX_RETRIES` | 3 |
| Job timeout | 120 seconds |

---

### 2.6 `src/services/ingestionAIRouter.ts` — Tier-Based AI Content Cleaning ⭐ NEW

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/ingestionAIRouter.ts` |
| **LOC** | 100 |
| **Purpose** | Route content cleaning through paid (OpenRouter) or free (Ollama) AI pipelines. Both tiers produce cleaned text; embeddings use the same model regardless of tier. |
| **Dependencies** | config/env, services/credentialVault |
| **Exports** | `cleanContentWithAI()` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `cleanContentWithAI(rawContent, tier)` | `string, 'free'\|'paid'` | `Promise<string>` | Routes to OpenRouter (paid) or Ollama (free); truncates input to 12,000 chars |
| `cleanWithOpenRouter(content)` | `string` | `Promise<string>` | Sends to `google/gemma-3-4b-it:free` via OpenRouter API; falls back to Ollama if no API key |
| `cleanWithOllama(content)` | `string` | `Promise<string>` | Sends to local `qwen2.5:3b-instruct` via Ollama `/api/chat` |

#### AI Cleaning System Prompt

```
You are a content extraction assistant.
Given raw text scraped from a web page or document, extract ONLY the
meaningful informational content. Remove: navigation menus, cookie notices,
footer links, repetitive headers, ads. Keep: product descriptions, FAQs,
pricing info, contact details, business information, policies.
Return only the cleaned text, no commentary.
```

#### Tier Routing

| Tier | Provider | Model | Temperature | Fallback |
|------|----------|-------|-------------|----------|
| `paid` | OpenRouter | `google/gemma-3-4b-it:free` (configurable) | 0.1 | Ollama (if no API key) |
| `free` | Ollama (local) | `qwen2.5:3b-instruct` (configurable) | 0.1 | None (error thrown) |

**Important:** Free-tier ingestion in `ingestionWorker.ts` actually skips AI cleaning entirely (`cleaned = capped`) to avoid slow local inference. The AI router is only called for paid-tier jobs.

#### Configuration

| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `OPENROUTER_API_KEY` | OpenRouter auth (checked via credentialVault) | — |
| `INGESTION_OPENROUTER_MODEL` | Paid-tier cleaning model | `google/gemma-3-4b-it:free` |
| `INGESTION_OLLAMA_MODEL` | Free-tier cleaning model | `qwen2.5:3b-instruct` |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | — |

---

### 2.6b `src/services/assistantAIRouter.ts` — Tier-Based Chat + Vision Routing ⭐ EXTENDED (v2.0.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/assistantAIRouter.ts` |
| **LOC** | ~751 |
| **Purpose** | Centralized routing for ALL assistant chat — text (GLM→OpenRouter→Ollama) and vision (GPT-4o→Gemini Flash→Ollama qwen2.5vl). Handles both streaming and non-streaming for portal SSE and mobile intent. |
| **Dependencies** | config/env, services/credentialVault |
| **Exports** | `chatCompletion()`, `chatCompletionStream()`, `shouldUseOpenRouter()`, `chatCompletionWithVision()`, `chatCompletionStreamWithVision()`, `VisionChatMessage`, `ContentBlock`, `VisionProvider` |

#### Types

| Type | Description |
|------|-------------|
| `ChatMessage` | `{ role: 'system'\|'user'\|'assistant', content: string }` |
| `VisionChatMessage` | Extends `ChatMessage` with `images?: string[]` — base64 data-URIs |
| `ContentBlock` | `{type:'text', text}` \| `{type:'image_url', image_url:{url}}` — OpenAI content array format |
| `VisionProvider` | `'openrouter' \| 'openrouter-fallback' \| 'ollama-vision'` |
| `PaidProvider` | `'glm' \| 'openrouter' \| 'ollama'` |

#### Text Routing Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `shouldUseOpenRouter(tier)` | `'free'\|'paid'` | `Promise<boolean>` | `true` if tier `paid` AND OpenRouter key available |
| `chatCompletion(tier, messages, opts?, ollamaModel?)` | — | `Promise<{content, model, provider}>` | Non-streaming, 3-tier fallback: GLM→OpenRouter→Ollama (paid) or GLM→Ollama (free) |
| `chatCompletionStream(tier, messages, opts?, ollamaModel?)` | — | `Promise<{stream, provider}>` | Streaming, same 3-tier fallback. Returns raw fetch `Response`. |

#### Vision Routing Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `chatCompletionWithVision(tier, messages, opts?)` | — | `Promise<{content, model, provider}>` | Non-streaming vision. Paid: GPT-4o→Gemini Flash→Ollama qwen2.5vl. Free: Ollama qwen2.5vl. |
| `chatCompletionStreamWithVision(tier, messages, opts?)` | — | `Promise<{stream, provider}>` | Streaming vision with same tier-based fallback chain. |

#### Internal Helpers

| Function | Description |
|----------|-------------|
| `buildGLMBody(messages, opts)` | Extracts system message into top-level `system` field (Anthropic format) |
| `glmChat()` / `glmStream()` | GLM via Anthropic Messages API at `api.z.ai` |
| `ollamaChat()` / `ollamaChatStream()` | Local Ollama native API |
| `openRouterChat()` / `openRouterChatStream()` | OpenRouter OpenAI-compatible API |
| `stripDataUri(dataUri)` | Removes `data:image/*;base64,` prefix for Ollama (expects raw base64) |
| `buildOpenRouterVisionMessages(messages)` | Converts to OpenAI `content[]` array format with `image_url` blocks |
| `buildOllamaVisionMessages(messages)` | Converts to Ollama format with separate `images[]` field |
| `openRouterVisionChat()` / `openRouterVisionStream()` | OpenRouter calls with vision-capable models |
| `ollamaVisionChat()` / `ollamaVisionStream()` | Ollama calls with local vision model |

#### Text Routing

| Tier | Fallback Chain | Model |
|------|----------------|-------|
| `paid` | GLM → OpenRouter → Ollama | glm-4.6 → gpt-4o-mini → qwen2.5:1.5b-instruct |
| `free` | GLM → Ollama | glm-4.6 → qwen2.5:1.5b-instruct |

#### Vision Routing

| Tier | Fallback Chain | Model |
|------|----------------|-------|
| `paid` | OpenRouter → OpenRouter fallback → Ollama | openai/gpt-4o → google/gemini-2.0-flash-001 → qwen2.5vl:7b |
| `free` | Ollama (direct) | qwen2.5vl:7b |

#### Configuration

| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `OPENROUTER_API_KEY` | OpenRouter auth | — |
| `ASSISTANT_OPENROUTER_MODEL` | Paid text chat model | `google/gemma-3-4b-it:free` |
| `ASSISTANT_OLLAMA_MODEL` | Free text chat model | `qwen2.5:1.5b-instruct` |
| `VISION_OPENROUTER_MODEL` | Paid vision primary | `openai/gpt-4o` |
| `VISION_OPENROUTER_FALLBACK` | Paid vision fallback | `google/gemini-2.0-flash-001` |
| `VISION_OLLAMA_MODEL` | Free vision + last resort | `qwen2.5vl:7b` |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | — |

#### Key Design Decisions

- **GLM bypassed for vision** — GLM (glm-4.6) is text-only; vision requests skip directly to OpenRouter/Ollama vision models.
- **OpenRouter API key is cached** — first retrieval from `credentialVault.getSecret()` stored in module-level `cachedApiKey`.
- **Falls back gracefully** — each tier step catches errors silently and falls to next provider.
- **Image format conversion** — OpenRouter expects `content[]` array with `image_url` blocks (data-URI preserved); Ollama expects `images[]` with raw base64 (prefix stripped via `stripDataUri()`).
- **Dual-format streams** — callers must handle OpenAI SSE (`openrouter`/`openrouter-fallback`) and Ollama NDJSON (`ollama-vision`) formats.

---

### 2.7 `src/routes/staffAssistant.ts` — Staff Assistant CRUD + Token Management ⭐ NEW (v1.4.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/staffAssistant.ts` |
| **LOC** | 382 |
| **Purpose** | Full CRUD for staff sandbox assistants (max 1 per user), superadmin-only core_instructions endpoint, external software token management |
| **Dependencies** | express, crypto, db/mysql, middleware/auth, utils/httpErrors, services/mobileAIProcessor |
| **Mount** | `/api/v1/mobile/staff-assistant` |
| **Exports** | `default` (Express router) |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `requireStaffRole(userId)` | `string` | `Promise<void>` | Resolves user role via `resolveUserRole()`, throws 403 if not staff |

#### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | / | JWT + Staff | Get current user's staff assistant (or null) |
| POST | / | JWT + Staff | Create staff assistant (max 1 per user) |
| PUT | / | JWT + Staff | Update editable fields (NOT core_instructions) |
| DELETE | / | JWT + Staff | Delete staff assistant |
| POST | /core-instructions | JWT + SuperAdmin | Set hidden core_instructions for any assistant |
| GET | /software-tokens | JWT + Staff | List stored software tokens |
| POST | /software-tokens | JWT + Staff | Store/update a software token (UPSERT) |
| DELETE | /software-tokens/:id | JWT | Remove a software token |

#### Security Model

| Guard | Implementation |
|-------|----------------|
| Staff role check | `requireStaffRole()` on all staff endpoints |
| Max 1 assistant | `SELECT ... WHERE is_staff_agent = 1` check before INSERT |
| core_instructions lockout | Staff PUT endpoint explicitly excludes `core_instructions` from allowed fields |
| SuperAdmin gate | `POST /core-instructions` queries `user_roles + roles` for `super_admin` slug |
| Token ownership | DELETE token verifies `user_id` match |

---

### 2.8 `src/routes/mobileIntent.ts` — Mobile Intent Route (updated v2.0.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/mobileIntent.ts` |
| **LOC** | 338 |
| **Purpose** | Mobile AI voice intent processing, image attachment validation, conversation management, assistant listing |
| **Dependencies** | express, db/mysql, middleware/auth, services/mobileAIProcessor, utils/httpErrors |
| **Mount** | `/api/v1/mobile` |
| **Exports** | `default` (Express router) |

#### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /intent | JWT | Process voice intent through AI assistant with optional `assistantId` |
| GET | /assistants | JWT | **NEW (v1.4.0):** List active assistants for mobile selection |
| GET | /conversations | JWT | List user's conversation history |
| GET | /conversations/:id/messages | JWT | Get messages for a conversation |
| DELETE | /conversations/:id | JWT | Delete a conversation |

#### Key Changes (v1.4.0)

| Change | Description |
|--------|-------------|
| **assistantId support** | POST /intent now accepts optional `assistantId` in request body |
| **Ownership verification** | When `assistantId` provided, verifies the assistant is owned by the user (staff) or is a staff agent |
| **GET /assistants** | New endpoint lists all active assistants the user can select (own + staff agents) |

---

### 2.9 `src/services/mobileTools.ts` — Mobile Tool Definitions (updated v1.4.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/mobileTools.ts` |
| **LOC** | 421 |
| **Purpose** | Function-calling tool definitions for the mobile AI assistant, separated by role |
| **Dependencies** | services/actionRouter |
| **Exports** | `getToolsForRole()`, `getMobileToolsSystemPrompt()`, `MobileRole` |

#### Tool Inventory

| Tool Name | Role | Description |
|-----------|------|-------------|
| `list_my_assistants` | Client | List the user's AI assistants |
| `toggle_assistant_status` | Client | Enable/disable an assistant |
| `get_usage_stats` | Client | View usage statistics |
| `list_failed_jobs` | Client | Check failed ingestion jobs |
| `retry_failed_ingestion` | Client | Retry a failed job |
| `search_clients` | Staff | Search across all client accounts |
| `suspend_client_account` | Staff | Suspend/reactivate a client |
| `check_client_health` | Staff | Check a client's system health |
| `generate_enterprise_endpoint` | Staff | Create an enterprise API endpoint |
| `list_tasks` | Staff | **NEW (v1.4.0):** List tasks from external software (with status/assignee filter) |
| `create_task` | Staff | **NEW (v1.4.0):** Create a task in external software |
| `update_task` | Staff | **NEW (v1.4.0):** Update task fields (status, hours, assignment, etc.) |
| `add_task_comment` | Staff | **NEW (v1.4.0):** Add a comment to a task |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `getToolsForRole(role)` | `MobileRole` | `ToolDefinition[]` | Returns 5 client tools or 13 staff tools (staff includes all client tools) |
| `getMobileToolsSystemPrompt(tools)` | `ToolDefinition[]` | `string` | Formats tools as JSON for the LLM system prompt |

---

### 2.10 `src/services/mobileAIProcessor.ts` — AI Processor with Prompt Stitching (updated v2.0.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/mobileAIProcessor.ts` |
| **LOC** | ~418 |
| **Purpose** | Tier-based AI conversation workflow with two-part prompt stitching, conversation persistence, tool-call loop, **vision routing for image attachments**. Routes through `assistantAIRouter` for Ollama/OpenRouter selection. |
| **Dependencies** | config/env, db/mysql, services/actionRouter, services/mobileTools, services/mobileActionExecutor, **services/assistantAIRouter**, crypto |
| **Exports** | `processMobileIntent()`, `resolveUserRole()`, `MobileIntentRequest`, `MobileIntentResponse` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `processMobileIntent(req, userId, userRole)` | `MobileIntentRequest, string, MobileRole` | `Promise<MobileIntentResponse>` | Full conversation flow: load assistant → stitch prompt → **route via assistantAIRouter** → handle tool calls → persist messages |
| `resolveUserRole(userId)` | `string` | `Promise<MobileRole>` | Queries `user_roles + roles` to determine `'staff'` or `'client'` |
| `loadAssistantPromptData(assistantId)` | `string` | `Promise<AssistantPromptRow \| null>` | Loads assistant's core_instructions, personality_flare, personality, name, preferred_model, **tier** |
| `buildStitchedPrompt(role, tools, assistantData?)` | — | `string` | THE core guardrail function — stitches core_instructions + personality_flare + tools |
| `getOrCreateConversation(userId, conversationId?, assistantId?)` | — | `Promise<{id, history}>` | Creates or resumes a conversation, stores `assistant_id` |

#### Changes in v1.8.0

| Change | Description |
|--------|-------------|
| **Tier-based routing** | `ollamaChat()` replaced with `chatCompletion()` from `assistantAIRouter` — paid-tier assistants route through OpenRouter |
| **`tier` in SQL** | `loadAssistantPromptData()` now SELECTs `COALESCE(tier,'free') AS tier` from the `assistants` table |
| **`AssistantPromptRow`** | Interface extended with `tier: string` field |

#### Changes in v2.0.0

| Change | Description |
|--------|-------------|
| **Vision routing** | On round 0, if `image` present in request, routes to `chatCompletionWithVision()` instead of text `chatCompletion()` |
| **`MobileIntentRequest`** | Added `image?: string` field for base64 data-URI image payloads |
| **Debug logging** | `[MobileAI] Image attached (XXkB base64), routing to vision model` |
| **Subsequent rounds** | Tool-call rounds 1+ use text-only `chatCompletion()` (image only analyzed once) |

#### Changes in v2.3.0

| Change | Description |
|--------|-------------|
| **`STAFF_CORE_DEFAULT`** | Added `VOICE INTERACTION:` section (6 rules) — voice awareness, no markdown, natural pause formatting |
| **`CLIENT_CORE_DEFAULT`** | Added matching `VOICE INTERACTION:` section (5 rules) — voice awareness, no markdown |
| **Bug fix: "can't hear"** | AI no longer claims it is text-only when user tests mic via speech |
| **Bug fix: asterisks in TTS** | Model instructed to avoid markdown; stray `*` no longer read as "asterisk" by TTS |

#### Prompt Stitching Architecture

```
┌─────────────────────────────────────────────────┐
│  core_instructions (hidden, backend-managed)     │
│  ─ falls back to STAFF_CORE_DEFAULT or           │
│    CLIENT_CORE_DEFAULT if not set                │
│  ─ includes VOICE INTERACTION section (v2.3.0):  │
│    • STT/TTS awareness (never say "can't hear") │
│    • No markdown formatting in responses         │
│    • Commas/periods for pauses, not bullets       │
├─────────────────────────────────────────────────┤
│  Identity: "You are {name}..."                   │
├─────────────────────────────────────────────────┤
│  "CRITICAL INSTRUCTION FOR TONE AND PERSONALITY" │
│  personality_flare (GUI-editable by staff)        │
│  ─ falls back to legacy personality column        │
├─────────────────────────────────────────────────┤
│  Dynamic tool definitions (injected by role,     │
│  NEVER stored in DB)                             │
└─────────────────────────────────────────────────┘
```

---

### 2.11 `src/services/mobileActionExecutor.ts` — Tool Execution Engine (updated v1.4.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/mobileActionExecutor.ts` |
| **LOC** | 810 |
| **Purpose** | Executes LLM function calls with security checks, ownership validation, and external task proxy |
| **Dependencies** | db/mysql, services/knowledgeCategorizer, services/enterpriseEndpoints, services/actionRouter, services/mobileTools |
| **Exports** | `executeMobileAction()`, `MobileExecutionContext` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `executeMobileAction(toolCall, ctx)` | `ToolCall, MobileExecutionContext` | `Promise<ToolResult>` | Main dispatcher — routes to handler by tool name |
| `getStaffSoftwareToken(userId)` | `string` | `Promise<{api_url, token}>` | **NEW (v1.4.0):** Fetches stored software token from `staff_software_tokens` |
| `taskProxy(apiUrl, path, method, token, body?)` | — | `Promise<any>` | **NEW (v1.4.0):** Proxies HTTP requests to external software API |
| `execListTasks(args, ctx)` | — | `Promise<ToolResult>` | **NEW (v1.4.0):** Proxy GET with status/assignee filtering |
| `execCreateTask(args, ctx)` | — | `Promise<ToolResult>` | **NEW (v1.4.0):** Proxy POST with field mapping |
| `execUpdateTask(args, ctx)` | — | `Promise<ToolResult>` | **NEW (v1.4.0):** Proxy PUT with change tracking |
| `execAddTaskComment(args, ctx)` | — | `Promise<ToolResult>` | **NEW (v1.4.0):** Proxy POST comment |

#### Task Proxy Architecture

```
mobileActionExecutor.ts                     External Software API
┌────────────────────────┐                 ┌──────────────────────┐
│ execListTasks()        │   HTTP GET      │ /api/development/    │
│ execCreateTask()       │ ──────────────► │   tasks/             │
│ execUpdateTask()       │   Bearer token  │                      │
│ execAddTaskComment()   │   from          │ (e.g. Silulumanzi    │
│                        │   staff_        │  Portal)             │
│ getStaffSoftwareToken()│   software_     │                      │
│ taskProxy()            │   tokens        │                      │
└────────────────────────┘                 └──────────────────────┘
```

---

### 2.12 `src/db/migrations/012_staff_sandbox_prompts.ts` — Migration ⭐ NEW (v1.4.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/012_staff_sandbox_prompts.ts` |
| **LOC** | 77 |
| **Purpose** | Adds staff sandbox columns/tables: two-part prompt fields, staff agent flag, software tokens table |
| **Exports** | `up()`, `down()` |

#### Migration Steps (up)

| Step | Action |
|------|--------|
| 1 | ALTER assistants: add `core_instructions`, `personality_flare`, `is_staff_agent`, `custom_greeting`, `voice_style`, `preferred_model` |
| 2 | ALTER mobile_conversations: add `assistant_id` |
| 3 | CREATE TABLE `staff_software_tokens` |
| 4 | ADD INDEX `idx_staff_agent` on assistants |

---

### 2.13 `src/db/migrations/013_unified_assistant_primary.ts` — Migration ⭐ NEW (v1.5.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/013_unified_assistant_primary.ts` |
| **LOC** | 62 |
| **Purpose** | Adds `is_primary` column to assistants table for default mobile assistant selection |
| **Exports** | `up()`, `down()` |

---

### 2.14 `src/utils/analyticsLogger.ts` — PII-Sanitized Telemetry ⭐ NEW (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/utils/analyticsLogger.ts` |
| **LOC** | ~160 |
| **Purpose** | POPIA-compliant anonymized chat logging — strips PII from prompts/responses, writes to SQLite analytics table. Used by all 3 chat routes. |
| **Dependencies** | better-sqlite3 |
| **Exports** | `sanitizeText()`, `logAnonymizedChat()` |

#### Functions

| Function | Params | Returns | Description |
|----------|--------|---------|-------------|
| `sanitizeText(text)` | `string` | `string` | Strips PII via 6 regex patterns: emails, SA phones, SA IDs, credit cards, account numbers, street addresses |
| `logAnonymizedChat(clientId, rawPrompt, rawResponse, options?)` | `string, string, string, LogOptions?` | `void` | Fire-and-forget INSERT into `ai_analytics_logs` SQLite table. Options: `source`, `model`, `provider`, `durationMs` |

#### Internal Details

| Detail | Description |
|--------|-------------|
| **Table auto-creation** | `ai_analytics_logs` table created on first `logAnonymizedChat()` call via `CREATE TABLE IF NOT EXISTS` |
| **Database path** | `/var/opt/backend/data/vectors.db` (shared with knowledge vectors) |
| **Error handling** | All errors caught in try/catch — never propagated. Logs error to console but never throws. |
| **Sync writes** | Uses better-sqlite3 synchronous API (not async mysql2) |

---

### 2.15 `src/db/migrations/026_ai_telemetry.ts` — Migration ⭐ NEW (v2.2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/026_ai_telemetry.ts` |
| **LOC** | ~45 |
| **Purpose** | Adds telemetry consent columns to MySQL `users` table: `telemetry_consent_accepted`, `telemetry_opted_out`, `telemetry_consent_date` |
| **Exports** | `up()`, `down()` |
| **Runner** | `src/scripts/run_migration_026.ts` |

#### Migration Steps (up)

| Step | Action |
|------|--------|
| 1 | ALTER users: add `telemetry_consent_accepted` TINYINT(1) DEFAULT 0 |
| 2 | ALTER users: add `telemetry_opted_out` TINYINT(1) DEFAULT 0 |
| 3 | ALTER users: add `telemetry_consent_date` DATETIME DEFAULT NULL |

---

## 3. Frontend Files

### 3.1 `src/pages/portal/Dashboard.tsx` — Portal Dashboard ⭐ RECENTLY MODIFIED

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/Dashboard.tsx` |
| **LOC** | 564 |
| **Purpose** | Portal dashboard with usage metrics, assistant cards (per-assistant health badge + delete), quick actions, inline test chat modal |
| **Dependencies** | react, react-router-dom, @heroicons/react, sweetalert2, api.ts, KnowledgeHealthBadge |
| **Exports** | `default` (PortalDashboard component) |

#### Key Changes (v1.0.0)

| Change | Description |
|--------|-------------|
| **Removed** | Standalone `<KnowledgeHealthScore>` that rendered outside the assistant cards for `assistants[0]` only |
| **Added import** | `TrashIcon`, `Swal` (sweetalert2), `KnowledgeHealthBadge` |
| **Added function** | `handleDeleteAssistant(assistant)` — SweetAlert2 dialog with KB clear/keep checkbox |
| **Modified cards** | Each card now includes: `TrashIcon` (top-right), `KnowledgeHealthBadge` (middle), Test Chat + Edit (bottom) |
| **Layout** | Cards use `flex flex-col` with `mt-auto` on button row for consistent heights |

#### Functions

| Function | Description |
|----------|-------------|
| `loadData()` | Parallel fetch of `/dashboard/metrics` + `/assistants` |
| `sendMessage()` | SSE streaming chat handler for test chat modal |
| `handleChatKeyDown(e)` | Enter-to-send (Shift+Enter for newline) |
| `handleDeleteAssistant(assistant)` | SweetAlert2 confirmation → `DELETE /assistants/:id?clearKnowledge=...` → reload |
| `usagePercent(used, limit)` | Percentage calculation clamped to 100 |
| `barColor(pct)` | Red ≥90%, amber ≥70%, blue otherwise |

#### Component Structure

```
<PortalDashboard>
  ├── Tier + Usage Strip (h1 + "New Assistant" button)
  ├── Stat Cards Grid (4 cols: Assistants, Messages, Pages, Plan)
  ├── Quick Actions Grid (3 cols: New Assistant, Landing Page, Train KB)
  ├── Your Assistants Grid (1-3 cols)
  │   └── Assistant Card (each)
  │       ├── Avatar + Name + "Active" badge
  │       ├── TrashIcon delete button (top-right) ⭐ NEW
  │       ├── Description (2-line clamp)
  │       ├── <KnowledgeHealthBadge /> ⭐ NEW
  │       └── Test Chat + Edit buttons
  └── Chat Modal (fixed overlay)
      ├── Header (assistant name + close button)
      ├── Messages area (SSE streaming)
      └── Input (textarea + send button)
```

---

### 3.2 `src/pages/portal/AssistantsPage.tsx` — Client Assistant List ⭐ NEW (v1.6.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/AssistantsPage.tsx` |
| **LOC** | 548 |
| **Purpose** | Client-facing assistant list with card grid, capabilities helper panel, embed modal, inline chat modal, enhanced empty state |
| **Dependencies** | react, react-router-dom, @heroicons/react (14 icons), api.ts, sweetalert2 |
| **Exports** | `default` (AssistantsPage component) |

#### State

| State Variable | Type | Description |
|---------------|------|-------------|
| `assistants` | `Assistant[]` | Loaded assistant list |
| `loading` | `boolean` | Loading state |
| `embedModal` | `Assistant \| null` | Selected assistant for embed code modal |
| `chatModal` | `Assistant \| null` | Selected assistant for inline chat |
| `copied` | `boolean` | Clipboard copy confirmation |
| `messages` | `ChatMessage[]` | Chat messages in inline modal |
| `chatInput` | `string` | Current chat input |
| `streaming` | `boolean` | SSE stream active |
| `showCapabilities` | `boolean` | **NEW:** Toggle for capabilities panel |

#### Constants

| Constant | Description |
|----------|-------------|
| `CAPABILITIES` | 6-item array: AI-Powered Chat, Lead Capture, Website Embed, Knowledge Base, Email Notifications, Site Builder — each with icon, title, desc, color |

#### Functions

| Function | Description |
|----------|-------------|
| `loadAssistants()` | Fetches `GET /assistants` |
| `sendMessage()` | SSE streaming chat with event-stream parsing |
| `handleChatKeyDown(e)` | Enter-to-send, Shift+Enter for newline |
| `handleDelete(id, name)` | SweetAlert2 → `DELETE /assistants/:id` |
| `getEmbedCode(assistantId)` | Generates `<script>` embed snippet |
| `copyToClipboard(text)` | Navigator clipboard API |

#### Component Structure

```
<AssistantsPage>
  ├── Header ("My Assistants" title)
  │   ├── "What Can My Assistant Do?" toggle button ⭐ NEW
  │   └── "New Assistant" → navigate('/create-assistant')
  ├── Capabilities Helper Panel (collapsible) ⭐ NEW
  │   ├── 3-column grid of 6 capability tiles (icon + title + desc)
  │   └── Pro tip callout (amber gradient)
  ├── Loading skeleton (3 placeholder cards)
  ├── Empty State (enhanced) ⭐ NEW
  │   ├── Dark gradient hero card with SparklesIcon
  │   ├── "Get Started" CTA button
  │   └── "How it works" 3-step section
  ├── Assistant Card Grid (responsive 1-3 cols)
  │   └── Card (each)
  │       ├── Gradient icon + Name + personality badge
  │       ├── Description (2-line clamp)
  │       ├── Action buttons: Chat, Embed, Edit, Delete
  │       └── Status badges
  ├── Embed Modal (fixed overlay with code snippet + copy)
  └── Chat Modal (fixed overlay with SSE streaming)
```

---

### 3.3 `src/pages/general/Profile.tsx` — StaffAssistantTab Component ⭐ ENHANCED (v2.0.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/general/Profile.tsx` |
| **LOC** | 2,227 (full file) / ~550 (StaffAssistantTab only, lines 55–605) |
| **Purpose** | Staff AI assistant management with customization UI, **image attachment**, **chat history sidebar**, capabilities awareness, webhook info |
| **Dependencies** | react, @heroicons/react (31 icons), StaffAssistantModel, sweetalert2 |
| **Exports** | Component embedded in Profile page (not standalone export) |

#### State (StaffAssistantTab)

| State Variable | Type | Description |
|---------------|------|-------------|
| `assistant` | `StaffAssistant \| null` | Loaded staff assistant |
| `loading` | `boolean` | Loading state |
| `saving` | `boolean` | Save operation in progress |
| `isEditing` | `boolean` | Edit mode toggle |
| `showCapabilities` | `boolean` | **NEW (v1.6.0):** Collapsible capabilities panel |
| `formData` | `StaffAssistantCreate` | Form state for create/edit |

#### Constants

| Constant | Description |
|----------|-------------|
| `PERSONALITY_OPTIONS` | 4 items: Professional, Friendly, Expert, Casual — each with label + description |
| `VOICE_STYLE_OPTIONS` | 4 items: Concise, Detailed, Conversational, Formal |
| `STAFF_TOOL_CATEGORIES` | **NEW (v1.6.0):** 10-item array mapping all 41 tools to color-coded categories with icons, tool lists, descriptions |

#### STAFF_TOOL_CATEGORIES Detail

| Category | Icon | Color | Tools |
|----------|------|-------|-------|
| Task Management | ClipboardDocumentListIcon | blue-500 | List Tasks, Create Task, Update Task, Add Comments |
| Client Admin | ShieldCheckIcon | indigo-500 | Search Clients, Suspend Accounts, Health Check, Generate Endpoints |
| Support Cases | WrenchScrewdriverIcon | amber-500 | List Cases, Case Details, Update Cases, Add Comments |
| CRM & Contacts | UserGroupIcon | green-500 | List Contacts, Contact Details, Create Contact |
| Finance | CurrencyDollarIcon | emerald-500 | Quotations, Invoices, Search Pricing |
| Scheduling | CalendarDaysIcon | purple-500 | List Calls, Schedule Calls |
| Chat & Messaging | ChatBubbleLeftRightIcon | pink-500 | List Conversations, Send Messages |
| Lead Management | BoltIcon | orange-500 | List Leads, Lead Details, Update Status, Lead Stats |
| Email Automation | EnvelopeIcon | cyan-500 | Follow-up Emails, Info Emails |
| Site Builder | GlobeAltIcon | teal-500 | List Sites, Site Details, Update Fields, Regenerate, Deploy |

#### Functions

| Function | Description |
|----------|-------------|
| `loadAssistant()` | Fetches `StaffAssistantModel.get()`, populates form |
| `handleInputChange(field, value)` | Generic form field updater |
| `handleCreate()` | `StaffAssistantModel.create(formData)` + success toast |
| `handleUpdate()` | `StaffAssistantModel.update(formData)` + success toast |
| `handleDelete()` | SweetAlert2 confirm → `StaffAssistantModel.delete()` |

#### Component Structure (v1.6.0)

```
<StaffAssistantTab>
  ├── Loading State
  │   └── Pulsing gradient icon + text
  │
  ├── Empty State (no assistant, not editing)
  │   ├── Dark gradient hero card (slate-900 → indigo-950)
  │   │   └── "Create Your Staff AI Assistant" + "Get Started" CTA
  │   ├── "How It Works" 3-step section
  │   │   └── Customize → Connect → Automate
  │   └── Capabilities Preview Grid
  │       └── 10 category tiles (2×5 grid on desktop)
  │
  ├── View Mode (assistant exists, not editing)
  │   ├── Main Assistant Card
  │   │   ├── Dark gradient header (status dot, badges, Edit/Delete)
  │   │   ├── Quick stats strip (41 Tools / 10 Categories / Pages Indexed)
  │   │   └── Detail section (description, goal, greeting blockquote, flare, model, date)
  │   ├── Capabilities Panel (collapsible)
  │   │   ├── 2-column grid of 10 categories (icon + name + desc + tool pills)
  │   │   └── Pro tip callout (amber gradient)
  │   └── Webhooks & Integrations Info Card
  │       ├── Enterprise endpoint generation guidance
  │       └── 3 capability badges (Inbound Webhooks, Auto-Processing, Field Mapping)
  │
  └── Create/Edit Form
      ├── Gradient header (icon + title + subtitle + Cancel)
      ├── Section: Identity (UserIcon divider)
      │   ├── Assistant Name (required)
      │   ├── Description
      │   └── Primary Goal
      ├── Section: Personality & Voice (ChatBubbleIcon divider)
      │   ├── Personality: 4 clickable cards (2×2 / 4×1 grid)
      │   ├── Voice Style: 4 clickable cards (2×2 / 4×1 grid)
      │   └── Personality Flare (textarea)
      ├── Section: Greeting & Model (CogIcon divider)
      │   ├── Custom Greeting
      │   └── Preferred Model (monospace)
      └── Actions
          ├── Info note: "Changes take effect on your next mobile conversation"
          └── Gradient save button
```

---

### 3.4 `src/components/KnowledgeHealthBadge.tsx` — Compact Health Badge ⭐ NEW

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/KnowledgeHealthBadge.tsx` |
| **LOC** | 107 |
| **Purpose** | Compact knowledge health indicator for assistant cards on the dashboard |
| **Dependencies** | react, api.ts |
| **Exports** | `KnowledgeHealthBadge` (named + default) |

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| assistantId | string | ✅ | Which assistant to fetch health for |

#### Behavior

| State | Rendering |
|-------|-----------|
| Loading | Skeleton: gray circle (w-9 h-9) + gray bar (w-16 h-3) |
| Error | Returns `null` (graceful degradation — card just won't show badge) |
| Success | Mini SVG ring + score + label + stats |

#### Visual Spec

| Element | Spec |
|---------|------|
| SVG ring | 36×36 viewBox, radius 14, strokeWidth 3 |
| Score text | 9px bold, color-coded |
| Label | 11px semibold: "Knowledge Healthy" / "Partial" / "Low" |
| Stats | 10px gray: "{satisfied}/{total} topics · {pages} pages" |

#### Color Thresholds

| Score | Ring Color | Text Color |
|-------|------------|------------|
| ≥ 80 | `stroke-emerald-500` | `text-emerald-600` |
| ≥ 60 | `stroke-yellow-500` | `text-yellow-600` |
| ≥ 40 | `stroke-orange-500` | `text-orange-600` |
| < 40 | `stroke-red-500` | `text-red-600` |

---

### 3.5 `src/components/KnowledgeHealthScore.tsx` — Full Health Component

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/KnowledgeHealthScore.tsx` |
| **LOC** | 275 |
| **Purpose** | Full-size knowledge health display with interactive checklist, custom requirements, re-scan, upsell |
| **Dependencies** | react, @heroicons/react, api.ts |
| **Exports** | `KnowledgeHealthScore` (named + default) |

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| assistantId | string | ✅ | Which assistant to display |
| tier | string | ❌ | Plan tier (for upsell logic) |
| onAddUrl | function | ❌ | Callback when "Add URL" clicked on checklist item |
| onUploadFile | function | ❌ | Callback when "Upload" clicked on checklist item |
| onUpgrade | function | ❌ | Callback when upgrade button clicked |

#### Visual Spec

| Element | Spec |
|---------|------|
| SVG ring | 144×144 viewBox, radius 58, strokeWidth 8 |
| Checklist | Per-item rows with emoji, label, check/action |
| Custom requirement button | Paid: functional prompt; Free: locked with PRO badge |
| Re-scan button | ArrowPathIcon with spin animation during recategorization |
| Pages bar | 1.5px height progress bar with red when full |
| Upsell | Amber gradient card when `storageFull && score < 80 && tier === 'free'` |
| Celebration | Emerald gradient card with 🎉 when `score === 100` |

#### Emoji Map

Maps common checklist keys to emoji (e.g., `pricing_info` → 💰, `contact_details` → 📞, `faq` → ❓). Falls back to 📋 for unknown keys.

---

### 3.6 `src/models/SystemModels.ts` — Frontend Type Models (updated v1.4.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/models/SystemModels.ts` |
| **LOC** | 623 |
| **Purpose** | TypeScript interfaces and API client classes for mobile AI + staff assistants |
| **Dependencies** | api.ts (Axios client) |
| **Exports** | `MobileModel`, `StaffAssistantModel`, `MobileIntentRequest`, `MobileConversation`, `MobileAssistantOption`, `StaffAssistant`, `StaffAssistantCreate`, `StaffAssistantUpdate`, `StaffSoftwareToken` |

#### Interfaces (v1.4.0 additions)

| Interface | Description |
|-----------|-------------|
| `MobileAssistantOption` | `{ id, name, description, personality }` — for mobile assistant selection dropdown |
| `StaffAssistant` | Full staff assistant shape: id, name, personality_flare, custom_greeting, voice_style, preferred_model, etc. |
| `StaffAssistantCreate` | Fields for creating a staff assistant (name required, rest optional) |
| `StaffAssistantUpdate` | Partial fields for updating (all optional, excludes core_instructions) |
| `StaffSoftwareToken` | Software token shape: id, software_id, software_name, api_url, timestamps |

#### Classes (v1.4.0 additions)

| Class | Methods | Description |
|-------|---------|-------------|
| `MobileModel` | `getAssistants()` | **NEW:** Fetches available assistants for mobile selection |
| `StaffAssistantModel` | `get()`, `create()`, `update()`, `delete()`, `getTokens()`, `saveToken()`, `deleteToken()` | **NEW:** Full CRUD + token management |
