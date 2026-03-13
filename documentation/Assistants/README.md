# Assistants Module — Overview

**Version:** 2.3.0  
**Last Updated:** 2026-03-13

---

## 1. Module Overview

### Purpose

The Assistants module manages the full lifecycle of AI assistants: creation, configuration, knowledge ingestion, health scoring, RAG-powered chat, embeddable widget delivery, and deletion with optional knowledge base cleanup. It is the core product surface of the Soft Aware platform.

### Business Value

- Self-service AI assistant creation with persona-based knowledge checklists
- RAG-powered chat with **tier-based routing** — free→Ollama, paid→OpenRouter — SSE streaming and per-personality temperature tuning
- Dual-storage knowledge base (MySQL + sqlite-vec) for structured queries and semantic search
- Tiered ingestion pipeline — paid jobs jump the queue, free jobs process FIFO
- Per-assistant Knowledge Health scoring visible on the portal dashboard
- Embeddable chat widget (single `<script>` tag) for any external website
- Safe delete with user choice to clear or keep knowledge base data
- **Staff sandbox assistants** — each staff member can create ONE personal AI assistant with customizable personality, voice style, and preferred model
- **Unified assistant management** — both staff and clients create/manage assistants through `/api/v1/mobile/my-assistant`; clients can create multiple, staff limited to one
- **Primary assistant flag** — one assistant per user is marked `is_primary`; auto-selected when no assistant is specified in mobile intent
- **Two-part prompt system** — `core_instructions` (hidden, backend-managed) + `personality_flare` (GUI-editable) stitched at runtime
- **Voice-driven task management** — staff can manage full task lifecycle (22 tools) via mobile voice: CRUD, bookmark, prioritize, tag, sync, invoice, workflow actions, stats
- **Source-level API key auth** — task operations use API keys from `task_sources` table (no per-user software tokens needed)
- **Mobile assistant selection** — clients and staff can choose which assistant to use on mobile
- **Client capabilities awareness** — toggleable panel showing 6 capability categories (chat, leads, embed, KB, email, site builder)
- **Staff capabilities dashboard** — collapsible 10-category tool inventory with 59 tools, webhook/integration info panel
- **Enhanced staff assistant UI** — dark gradient header, quick-stats strip, card-based personality/voice picker, section-grouped form
- **Visual parity** — staff assistant view mode redesigned to match client-side visual quality
- **Chat persistence (staff)** — staff chat messages survive modal close/reopen; explicit trash icon to clear
- **Chat persistence (client)** — per-assistant chat history stored via `chatHistoryRef`, keyed by assistant ID; survives modal close
- **Staff chat UI** — real-time chat with AI assistant via `MobileModel.sendIntent()` in StaffAssistantTab, with full tool access
- **"Help me write this with AI"** — button next to Personality Flare textarea generates creative personality text via AI
- **SSE streaming fixes** — line buffering, `response.ok` check, conversation history in requests, error display in chat bubbles
- **53/53 staff tools** — all staff tools (22 task + 31 other) registered and route-dispatched with 0 compile errors
- **Actionable tool errors** — all tool error messages guide user to exact dashboard location (e.g., "Go to Dashboard → Software Connections")
- **Collation fix** — `ingestion_jobs` table columns ALTERed from `utf8mb4_0900_ai_ci` to `utf8mb4_unicode_ci` to match `assistants`
- **Model pre-warming** — both Assistant and Tools Ollama models warmed on server startup to eliminate cold-start latency
- **GLM-first 3-tier routing** — all assistant chat routes through GLM (Anthropic API) → OpenRouter → Ollama cascading fallback; default model `glm-4.6`
- **Chat history sidebar** — staff chat modal includes collapsible sidebar showing previous conversations with first-message previews, relative timestamps, and delete
- **Conversation preview API** — `GET /conversations` returns `preview` field (first user message) and `assistant_id`
- **Vision/multimodal support** — image analysis via tier-based routing: paid → GPT-4o → Gemini 2.0 Flash → Ollama qwen2.5vl:7b; free → Ollama qwen2.5vl:7b. GLM bypassed for vision (text-only model)
- **Image attachment UI** — staff chat modal includes 📎 attach button, image preview strip, automatic vision routing, and `📎` prefix in chat bubbles
- **Bidirectional voice** — OpenAI-compatible neural TTS (`/api/v1/mobile/tts`) for voice output; browser-native Web Speech API for STT input
- **Voice interaction awareness** — `STAFF_CORE_DEFAULT` and `CLIENT_CORE_DEFAULT` include `VOICE INTERACTION:` section: AI knows it receives speech via STT and replies via TTS, never claims "I can't hear you", avoids markdown formatting (asterisks, bullets, headers) in responses since they're spoken aloud
- **Base64 image payloads** — express body limit increased to 20mb to accommodate base64-encoded images (up to ~10MB original)
- **AI Telemetry** — POPIA-compliant anonymized chat logging across all 3 chat routes (portal SSE, widget, enterprise webhook) with automatic PII sanitization
- **PII sanitization** — emails, SA phone numbers, SA ID numbers, credit cards, account numbers, and street addresses stripped before analytics storage
- **Telemetry consent flow** — users must accept telemetry terms before first assistant creation; paid users get an opt-out toggle
- **Fire-and-forget analytics** — `analyticsLogger.ts` writes to SQLite asynchronously; errors never break chat flow

> **🔗 sqlite-vec Deep Dive:** This module is the primary consumer of sqlite-vec vector storage. See [SQLITE_VEC_ARCHITECTURE.md](SQLITE_VEC_ARCHITECTURE.md) for a comprehensive deep-dive covering the vec0 KNN engine, embedding pipeline, dual-storage write path, drift risks, and performance characteristics.

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 5 (assistants.ts, assistantIngest.ts, myAssistant.ts, staffAssistant.ts, mobileIntent.ts) |
| Backend service files | 9 (vectorStore.ts, knowledgeCategorizer.ts, ingestionWorker.ts, ingestionAIRouter.ts, **assistantAIRouter.ts**, mobileTools.ts, mobileAIProcessor.ts, mobileActionExecutor.ts, **analyticsLogger.ts**) |
| Backend LOC | ~7,440 |
| Frontend source files | 5 (AssistantsPage.tsx, CreateAssistant.tsx, Dashboard.tsx, KnowledgeHealthBadge.tsx, KnowledgeHealthScore.tsx) + Profile.tsx (StaffAssistantTab) + SystemModels.ts |
| Frontend LOC | ~4,666 |
| Total LOC | ~12,106 |
| API endpoints | 38 (+ 2 telemetry consent) |
| Staff AI tools | 59 (53 staff-accessible) — 22 task tools + 31 other staff tools |
| MySQL tables | 4 (assistants, ingestion_jobs, mobile_conversations, staff_software_tokens) + 3 task tables (task_sources, local_tasks, task_sync_log) + 1 legacy (assistant_knowledge) + telemetry columns on `users` |
| sqlite-vec tables | 2 (knowledge_chunks, knowledge_vectors) + 1 analytics (ai_analytics_logs) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│                                                                          │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌────────────────────┐ │
│  │ Dashboard.tsx     │  │ CreateAssistant.tsx │  │ KnowledgeHealth    │ │
│  │ • Assistant cards │  │ • 4-step wizard     │  │ Score.tsx (full)   │ │
│  │ • Delete + KB opt │  │ • Text editing      │  │ • Full ring + list │ │
│  │ • Test Chat modal │  │ • Source management │  │ • Add custom item  │ │
│  └──────┬───────────┘  └──────────┬──────────┘  └──────────┬─────────┘ │
│         │                          │                         │           │
│  ┌──────────────────┐  ┌─────────────────────┐                          │
│  │ AssistantsPage   │  │ Profile.tsx          │                          │
│  │ • Card grid list │  │ StaffAssistantTab   │                          │
│  │ • Capabilities   │  │ • Dark gradient card│                          │
│  │   helper panel   │  │ • 10-cat tool panel │                          │
│  │ • Embed/Chat     │  │ • Webhook info card │                          │
│  │ • Empty state    │  │ • Card-based form   │                          │
│  └──────┬───────────┘  └──────────┬──────────┘                          │
│         │                          │                                     │
│         ▼                          ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  api.ts — Axios client                                         │    │
│  │  GET /assistants | DELETE /assistants/:id?clearKnowledge=...   │    │
│  │  GET /assistants/:id/knowledge-health | POST /assistants/chat  │    │
│  └──────────────────────────┬──────────────────────────────────────┘    │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/assistants/*  →  assistants.ts (assistantsRouter)         │    │
│  │  GET  /                — list all assistants                    │    │
│  │  POST /create          — create with persona checklist          │    │
│  │  PUT  /:id/update      — update configuration                  │    │
│  │  GET  /:id             — get single assistant                  │    │
│  │  DELETE /:id           — delete + optional KB clear             │    │
│  │  GET  /:id/knowledge-health — health score + checklist          │    │
│  │  POST /:id/recategorize — re-analyze content with LLM          │    │
│  │  POST /:id/checklist/add — custom checklist item (paid only)    │    │
│  │  POST /chat            — SSE streaming chat with RAG            │    │
│  │  GET  /widget.js       — embeddable chat widget script          │    │
│  │  GET  /templates       — persona templates for creation UI      │    │
│  │  GET  /telemetry-consent — user's telemetry consent status      │    │
│  │  POST /telemetry-consent — accept/update telemetry consent      │    │
│  │  POST /admin/unload-model — free Ollama RAM                    │    │
│  │  GET  /admin/model-status — check loaded models                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  /api/assistants/:assistantId/ingest/*  →  assistantIngest.ts   │    │
│  │  POST /url             — enqueue URL for scraping               │    │
│  │  POST /file            — upload + enqueue file ingestion        │    │
│  │  GET  /status          — jobs list + indexed count              │    │
│  │  DELETE /job/:jobId    — delete job + its knowledge chunks      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  SERVICES                                                       │    │
│  │  vectorStore.ts  — sqlite-vec CRUD (768-dim float32 vectors)    │    │
│  │  knowledgeCategorizer.ts — LLM-based checklist analysis         │    │
│  │  ingestionWorker.ts — background poll loop (6s interval)        │    │
│  │  assistantAIRouter.ts — 3-tier text routing + vision routing    │    │
│  │  analyticsLogger.ts — PII-sanitized telemetry to SQLite         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  STORAGE                                                        │    │
│  │  MySQL: assistants, ingestion_jobs, assistant_knowledge,        │    │
│  │         mobile_conversations, staff_software_tokens              │    │
│  │         users (telemetry_consent_*, telemetry_opted_out)        │    │
│  │  sqlite-vec: knowledge_chunks, knowledge_vectors (vec0)         │    │
│  │  SQLite analytics: ai_analytics_logs (PII-sanitized chat logs)  │    │
│  │  Path: /var/opt/backend/data/vectors.db                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow

### 3.1 Assistant Creation

```
User fills form → POST /api/assistants/create
  → Zod validation
  → Generate ID: "assistant-{timestamp}"
  → Lookup persona template for businessType → default checklist
  → INSERT into MySQL (assistants table)
  → Return { success, assistantId, assistant }
```

### 3.2 Knowledge Ingestion

```
User submits URL/file → POST /api/assistants/:id/ingest/url (or /file)
  → Queue position calculated (paid = 0, free = N+1)
  → INSERT into ingestion_jobs (status: pending)

Background Worker (every 6s):
  → SELECT pending job (paid first, then free FIFO)
  → FOR UPDATE SKIP LOCKED (prevents double-processing)
  → Fetch/parse content (cheerio for HTML, pdf-parse for PDF, mammoth for DOCX)
  → AI clean (paid → OpenRouter, free → raw)
  → Chunk (1200 chars, 200 overlap, sentence-boundary aware)
  → Embed each chunk via nomic-embed-text (768-dim, local Ollama)
  → Store in MySQL (assistant_knowledge) AND sqlite-vec (knowledge_chunks + knowledge_vectors)
  → LLM categorize content against checklist (qwen2.5:3b-instruct)
  → Merge results (OR-merge: once satisfied, stays satisfied)
  → Sync pages_indexed from completed job count
  → Mark job completed
```

### 3.3 RAG Chat

```
User sends message → POST /api/assistants/chat (SSE)
  → Embed user query via nomic-embed-text
  → sqlite-vec KNN search (top 5 chunks by distance)
  → Build system prompt: persona + business context + RAG knowledge + tools
  → IF image attached:
      → Route to chatCompletionStreamWithVision() (see 3.8 Vision/Image Chat)
  → ELSE text-only:
      → 3-tier routing via assistantAIRouter.chatCompletionStream():
          1. GLM (glm-4.6) via Anthropic SSE — tried first for ALL tiers
          2. OpenRouter (gpt-4o-mini) via OpenAI SSE — paid-tier fallback
          3. Ollama (qwen2.5:1.5b-instruct) via NDJSON — last resort
  → 3-format parser handles Anthropic SSE, OpenAI SSE, and Ollama NDJSON
  → Parse tool calls if present → execute → append to stream
  → Done event includes { provider: 'ollama' | 'openrouter' | 'openrouter-fallback' | 'ollama-vision' }
  → Client renders tokens in real-time
  → IF user not opted out (telemetry_opted_out = 0):
      → logAnonymizedChat(userId, prompt, fullResponse, { source: 'portal', model, provider })
      → PII sanitized → fire-and-forget SQLite INSERT into ai_analytics_logs
```

### 3.4 Delete with Knowledge Base Option

```
User clicks TrashIcon → SweetAlert2 dialog
  → Checkbox: "Also delete knowledge base data (sqlite-vec)" (checked by default)
  → DELETE /api/assistants/:id?clearKnowledge=true|false

Backend:
  → DELETE FROM assistants WHERE id = ?
  → DELETE FROM ingestion_jobs WHERE assistant_id = ? (cleanup)
  → IF clearKnowledge:
      → deleteByAssistant(id) → sqlite-vec chunks + vectors removed
  → Return { success: true, knowledgeCleared: boolean }

Frontend:
  → Success toast (message varies by clearKnowledge)
  → Reload dashboard data
```

### 3.5 Staff Sandbox Assistant — Creation & Configuration ⭐ NEW (v1.4.0)

```
Staff opens Profile → Assistant Tab
  → GET /api/v1/mobile/staff-assistant
  → If null: show "Create Assistant" form
  → POST /api/v1/mobile/staff-assistant
    → name (required), personality_flare, custom_greeting, voice_style, etc.
    → Backend enforces max 1 per user (is_staff_agent = 1 check)
    → ID: "staff-assistant-{timestamp}", tier forced to "paid"
    → Return created assistant

  → If exists: show edit form (personality_flare, greeting, voice, etc.)
  → PUT /api/v1/mobile/staff-assistant
    → Allowed fields: name, personality_flare, voice_style, preferred_model, etc.
    → CANNOT modify core_instructions (backend-only, superadmin endpoint)

Superadmin sets hidden rules:
  → POST /api/v1/mobile/staff-assistant/core-instructions
    → { assistantId, core_instructions }
    → Never exposed in staff GUI
```

### 3.6 Prompt Stitching — Two-Part System Prompt ⭐ NEW (v1.4.0)

```
Mobile voice input → POST /api/v1/mobile/intent { text, assistantId }
  → Load assistant: SELECT core_instructions, personality_flare, personality,
                           name, preferred_model FROM assistants WHERE id = ?

  → buildStitchedPrompt():
    ┌─────────────────────────────────────────────────────┐
    │  CORE INSTRUCTIONS (hidden from GUI)                 │
    │  Source: assistants.core_instructions                │
    │  Fallback: STAFF_CORE_DEFAULT / CLIENT_CORE_DEFAULT  │
    ├─────────────────────────────────────────────────────┤
    │  IDENTITY: "You are {name}..."                       │
    ├─────────────────────────────────────────────────────┤
    │  CRITICAL INSTRUCTION FOR TONE AND PERSONALITY       │
    │  Source: assistants.personality_flare                │
    │  Fallback: legacy personality column mapping          │
    ├─────────────────────────────────────────────────────┤
    │  TOOL DEFINITIONS (injected dynamically by role)     │
    │  Staff: 53 tools (incl. 22 task tools)              │
    │  Client: 17 tools                                    │
    │  NEVER stored in DB                                  │
    └─────────────────────────────────────────────────────┘

  → 3-tier routing via assistantAIRouter.chatCompletion():
      1. GLM (glm-4.6) — tried first for ALL tiers (free under Coding Lite plan)
      2. OpenRouter (gpt-4o-mini) — paid-tier only fallback
      3. Ollama (preferred_model or TOOLS_OLLAMA_MODEL) — last resort
  → Handle tool calls ↔ results loop
  → Return plain text reply for TTS
```

### 3.7 Task Management via Voice ⭐ REWIRED (v2.1.0)

```
Staff says "Show me pending tasks" → POST /api/v1/mobile/intent
  → AI recognizes intent → emits tool_call: list_tasks { status: "pending" }

  → mobileActionExecutor.ts:
    → READ path (list_tasks, get_task, get_task_stats, get_task_tags, etc.):
      → Direct SQL query to local MySQL `local_tasks` table
      → No external API call needed — tasks already synced locally
      → Supports all filters: status, type, priority, bookmarked, tags, search, etc.

    → WRITE path (create_task, update_task, start_task, complete_task, approve_task):
      → resolveTaskSourceForTools(software_id?)
        → SELECT base_url, api_key FROM task_sources WHERE sync_enabled = 1
      → taskProxyV2(baseUrl, '/api/tasks-api/...', method, apiKey, body)
        → Headers: X-API-Key: {apiKey}  ← source-level auth (NOT per-user tokens)
      → Also updates local DB immediately (marks dirty for sync)

    → LOCAL path (bookmark_task, set_task_priority, set_task_color, set_task_tags):
      → Direct UPDATE on local_tasks table
      → No external API call (local-only enhancements)

    → SYNC path (sync_tasks, get_sync_status):
      → syncAllSources() from taskSyncService.ts
      → Pulls latest from all configured external sources

    → INVOICE path (stage_tasks_for_invoice, get_staged_invoices, process_staged_invoices):
      → Stage: UPDATE local_tasks SET task_billed = 2 (local staging)
      → Process: POST /api/tasks-api/invoice-tasks (external) → mark as billed

  → AI wraps result in conversational reply
  → Return to mobile for TTS playback

22 Task tools (v2.0):
  ┌─ Core CRUD ──────────────────────────────────────────────┐
  │ list_tasks        → Local DB query (filterable)           │
  │ get_task          → Local DB query by id/external_id      │
  │ create_task       → POST /api/tasks-api (proxy + sync)    │
  │ update_task       → Local DB + PUT /api/tasks-api/:id     │
  │ delete_task       → Soft-delete local (dirty flag)        │
  ├─ Comments ───────────────────────────────────────────────┤
  │ get_task_comments → GET /api/tasks-api/:id/comments       │
  │ add_task_comment  → POST /api/tasks-api/:id/comments      │
  ├─ Local Enhancements ─────────────────────────────────────┤
  │ bookmark_task     → Toggle is_bookmarked (local only)     │
  │ set_task_priority → Set priority level (local only)       │
  │ set_task_color    → Set color label (local only)          │
  │ set_task_tags     → Set tags array (local only)           │
  ├─ Workflow Actions ───────────────────────────────────────┤
  │ start_task        → POST /api/tasks-api/:id/start         │
  │ complete_task     → POST /api/tasks-api/:id/complete       │
  │ approve_task      → POST /api/tasks-api/:id/approve        │
  ├─ Stats & Queries ────────────────────────────────────────┤
  │ get_task_stats    → Local DB aggregation (by status/type)  │
  │ get_pending_approvals → GET /api/tasks-api/pending-approval│
  │ get_task_tags     → Local DB distinct tags                 │
  ├─ Sync ───────────────────────────────────────────────────┤
  │ sync_tasks        → syncAllSources() (pull from externals) │
  │ get_sync_status   → Query task_sources sync metadata       │
  ├─ Invoice Staging ────────────────────────────────────────┤
  │ stage_tasks_for_invoice → Stage tasks (task_billed = 2)   │
  │ get_staged_invoices     → List staged tasks               │
  │ process_staged_invoices → Sync to portal + mark billed    │
  └──────────────────────────────────────────────────────────┘

Key architectural change (v2.1.0):
  OLD: getStaffSoftwareToken(userId) → taskProxy(apiUrl, path, 'Bearer', token)
       ❌ Per-user software tokens from staff_software_tokens table
       ❌ External API calls for ALL operations (reads + writes)
       ❌ Only 4 tools (list, create, update, comment)

  NEW: resolveTaskSourceForTools() → taskProxyV2(baseUrl, path, 'X-API-Key', apiKey)
       ✅ Source-level API keys from task_sources table
       ✅ Reads from local DB (no external call needed)
       ✅ 22 tools covering full task lifecycle
       ✅ Local enhancements (bookmark, priority, tags, colors)
       ✅ Sync engine integration
       ✅ Invoice staging workflow
```

### 3.8 Vision/Image Chat ⭐ NEW (v2.0.0)

```
User attaches image → 📎 button in chat modal → FileReader → base64 data-URI
  → POST /api/assistants/chat { assistantId, message, image: "data:image/png;base64,..." }
  → Zod validates image field (optional string)
  → Backend detects hasImage: image.startsWith('data:image/')
  → Builds VisionChatMessage[] with images[] on last user message
  → Routes to chatCompletionStreamWithVision(tier, messages):

      PAID TIER:
        1. OpenRouter openai/gpt-4o (primary)
           → content[] array format: [{type:"text",...}, {type:"image_url", image_url:{url:dataUri}}]
           → Stream: OpenAI SSE (choices[0].delta.content)
        2. OpenRouter google/gemini-2.0-flash-001 (fallback)
           → Same content[] array format
           → Stream: OpenAI SSE
        3. Ollama qwen2.5vl:7b (last resort)
           → Ollama format: messages[].images[] (raw base64, no data-URI prefix)
           → Stream: NDJSON (message.content)

      FREE TIER:
        1. Ollama qwen2.5vl:7b (only option)
           → Same Ollama format as above

  → Stream parser branches on provider:
      'openrouter' / 'openrouter-fallback' → OpenAI SSE
      'ollama-vision' → NDJSON
  → Done event includes { provider, model }
  → Client renders AI description of image in real-time

Mobile intent path:
  POST /api/v1/mobile/intent { text, image: "data:image/..." }
  → Validates: must be data:image/*, max 15M chars (~10MB)
  → On round 0: chatCompletionWithVision() (non-streaming, same tier fallback)
  → Subsequent rounds: text-only chatCompletion() (image only analyzed once)
```

---

## 4. Key Features

### 4.1 Per-Assistant Knowledge Health Badge

Each assistant card on the portal dashboard displays a compact `KnowledgeHealthBadge` showing:
- **Mini SVG progress ring** (36×36, radius 14, stroke-width 3)
- **Score percentage** (0–100%) with color coding: ≥80 emerald, ≥60 yellow, ≥40 orange, <40 red
- **Status label**: "Knowledge Healthy", "Knowledge Partial", or "Knowledge Low"
- **Stats**: "{satisfied}/{total} topics · {pages} pages"

The badge fetches from `GET /assistants/:id/knowledge-health` per assistant and gracefully degrades (returns null on error).

### 4.2 Knowledge Base Editing & Management

**New in v1.3.0** — Complete knowledge base editing interface:
- **Three Input Methods:**
  - 🔗 URLs (single entry + bulk paste with category selection)
  - 📝 Paste Text (custom naming, persistent editing, category assignment)
  - 📎 Upload Files (PDF, TXT, DOC, DOCX with category selection)
  
- **Source Management:**
  - Visual status badges (✓ Indexed, ⟳ Processing, ✗ Failed, ⏳ Pending)
  - Type badges (URL-blue, TEXT-green, FILE-purple)
  - Category badges with emojis (💰 Pricing, 📞 Contact, ⚙️ Services, ℹ️ About)
  - Chunk count display for completed jobs
  
- **Text Editing:**
  - Edit button (pencil icon) for TEXT sources
  - Modal pre-fills with existing content from `original_content` column
  - Update text and/or category, re-index on save
  - True editing (not just re-pasting)
  
- **Delete Sources:**
  - X button on any source
  - Confirmation dialog
  - Cascade deletes job + chunks + vectors
  - Knowledge health recalculates automatically

### 4.3 Knowledge Health Score (Full)

The full `KnowledgeHealthScore` component (used on assistant detail/edit pages) provides:
- Large SVG progress ring (144×144)
- Dynamic checklist with per-item actions (Add URL / Upload)
- Custom requirement addition (paid tier only)
- Re-scan button (triggers `/recategorize`)
- Pages indexed progress bar (sums chunks_created across completed jobs)
- Upsell prompts when storage is full and score is low

**Improvements in v1.2.0:**
- Fixed JSON parsing (handles MySQL auto-parsed objects)
- Increased Ollama timeout (30s → 120s for categorization)
- Better error logging with axios details

### 4.3 Persona Templates

On creation, assistants receive a business-type-specific knowledge checklist (e.g., restaurant gets "Menu Prices", "Opening Hours"; SaaS gets "Pricing Plans", "Integrations"). Templates are defined in `personaTemplates.ts`.

### 4.4 Embeddable Widget (Branded)

`GET /api/assistants/widget.js` serves a self-contained JavaScript snippet that creates a **branded floating chat widget** on external websites. The widget uses the Soft Aware favicon (`/images/favicon.png`) as the FAB button icon, displays a branded header bar with the Soft Aware logo and title, and includes a "Powered by Soft Aware" footer. External sites embed it with a single script tag:

```html
<script src="https://softaware.net.za/widget.js" data-assistant-id="assistant-123"></script>
```

**Widget visual structure:**

```
┌─────────────────────────────┐
│ [favicon] Soft Aware Asst  ✕│  ← Branded header (gradient)
├─────────────────────────────┤
│                             │
│        Chat iframe          │  ← Full chat UI
│                             │
├─────────────────────────────┤
│  [icon] Powered by Soft Aware│  ← Branded footer
└─────────────────────────────┘

           [favicon]            ← FAB button (brand icon)
```

Also available via the API route: `https://softaware.net.za/api/assistants/widget.js`

### 4.5 Tiered Ingestion Queue

Paid-tier jobs always dequeue before free-tier jobs. The ingestion worker uses `FOR UPDATE SKIP LOCKED` to prevent double-processing and supports up to 3 retries with a 120-second timeout per job.

### 4.6 Staff Sandbox Assistants ⭐ NEW (v1.4.0)

Each staff member can create **one personal AI assistant** via their profile tab. Key characteristics:

- **Max 1 per user** — enforced by `is_staff_agent = 1` flag + existence check
- **Two-part prompt** — `core_instructions` (hidden, superadmin-managed) + `personality_flare` (GUI-editable)
- **Full customization** — name, description, personality, custom greeting, voice style, preferred Ollama model
- **Tier forced to `paid`** — staff assistants get priority processing
- **ID format** — `staff-assistant-{timestamp}` (vs `assistant-{timestamp}` for clients)
- **Prompt stitching guardrail** — tools injected dynamically at runtime, never stored in DB. Staff CANNOT inject tools via the personality field.

### 4.7 Voice-Driven Task Management ⭐ REWIRED (v2.1.0)

Staff can manage tasks from external software portals through voice commands on mobile:

- **22 task tools** — full lifecycle coverage (up from 4 in v1.4.0)
- **Dual-path architecture** — reads from local MySQL `local_tasks`, writes proxied to external APIs
- **Source-level auth** — API keys resolved from `task_sources` table (no per-user tokens required)
- **Local enhancements** — bookmark, priority, color labels, tags (managed locally, not synced)
- **Workflow actions** — start, complete, approve tasks directly from voice
- **Sync integration** — trigger syncs, check sync status from voice
- **Invoice staging** — stage, review, and process task invoices through voice
- **Task fields** — title, status (new/progress/completed/pending), type (development/bug-fix/feature/maintenance/support), priority (urgent/high/normal/low), assigned_to, hours, workflow_phase, tags, bookmarks, color labels

### 4.8 Mobile Assistant Selection ⭐ NEW (v1.4.0)

Both staff and clients can select which assistant to use on mobile:

- **GET /api/v1/mobile/assistants** — returns available assistants (own + staff agents)
- **assistantId** in intent request — routes to specific assistant's prompt + model
- **Conversation tracking** — `mobile_conversations.assistant_id` records which assistant is used
- **Falls back to defaults** — if no assistantId provided, uses role-appropriate default prompts

### 4.9 Client Capabilities Awareness Panel ⭐ NEW (v1.6.0)

The client-facing `AssistantsPage.tsx` includes a toggleable capabilities helper:

- **Trigger:** "What Can My Assistant Do?" button in page header (toggles with chevron icon)
- **6 capability tiles** in a responsive grid:
  1. 💬 AI-Powered Chat — 24/7 knowledge base responses
  2. 👥 Lead Capture — visitor details + email notifications
  3. 🌐 Website Embed — single-line script tag or direct link
  4. 🔍 Knowledge Base — URLs, documents, pasted text training
  5. ✉️ Email Notifications — chat/form/lead alerts
  6. 🚀 Site Builder — landing page with embedded assistant
- **Pro tip callout** with practical guidance
- **Enhanced empty state** with dark gradient hero, "Get Started" CTA, 3-step "How it works" cards

### 4.10 Staff Capabilities Dashboard ⭐ NEW (v1.6.0)

The staff `StaffAssistantTab` in `Profile.tsx` provides rich capabilities awareness:

**View Mode:**
- **Dark gradient header** with status dot indicator, personality/voice/tier badges
- **Quick-stats strip** — 3 metrics: Tools Available (59), Categories (10), Pages Indexed
- **Detail section** — description, primary goal, greeting blockquote, personality flare, model, created date
- **Collapsible capabilities panel** — 2-column grid of 10 tool categories:
  - Task Management (22 tools), Client Admin (4 tools), Support Cases (4 tools)
  - CRM & Contacts (3 tools), Finance (3 tools), Scheduling (2 tools)
  - Chat & Messaging (2 tools), Lead Management (4 tools), Email Automation (2 tools)
  - Site Builder (5 tools)
  - Each category shows color-coded icon, description, and pill-badge tool names
- **Pro tip** about natural language voice commands
- **Webhooks & Integrations info card** — explains enterprise endpoint generation, shows Inbound Webhooks / Auto-Processing / Field Mapping capability badges

**Empty State:**
- Dark gradient hero with "Get Started" CTA
- 3-step "How it works" (Customize → Connect → Automate)
- Capabilities preview grid showing all 10 categories

**Create/Edit Form:**
- Gradient header with subtitle context
- 3 section dividers with icons: Identity (UserIcon), Personality & Voice (ChatBubbleIcon), Greeting & Model (CogIcon)
- **Card-based personality picker** — 4 clickable cards: Professional, Friendly, Expert, Casual (replacing dropdown)
- **Card-based voice style picker** — 4 clickable cards: Concise, Detailed, Conversational, Formal (replacing dropdown)
- Footer info note: "Changes take effect on your next mobile conversation"
- Gradient save button with shadow

---

## 5. Security

| Feature | Detail |
|---------|--------|
| Input validation | Zod schemas on create/update/chat |
| File upload limits | 10MB max, PDF/TXT/DOC/DOCX only (multer) |
| Assistant ownership | Currently no per-user isolation on client assistants (all visible) |
| Custom checklist gate | Only `paid` tier can add custom checklist items |
| Delete confirmation | SweetAlert2 dialog with cancel button, focusCancel=true |
| Tool execution | Tools gated by tier via `getToolsForTier()` |
| Widget CORS | `Access-Control-Allow-Origin: *` on widget.js |
| **Staff assistant auth** | JWT + staff role check via `requireStaffRole()` on all staff endpoints |
| **core_instructions lockout** | Only `super_admin` can set `core_instructions` via dedicated endpoint |
| **Prompt injection guard** | Tools injected dynamically by role at runtime — never stored in or loaded from DB |
| **Task proxy auth** | Source-level API key from `task_sources` table (X-API-Key header); no per-user tokens needed |
| **Max 1 staff assistant** | Enforced by DB check before INSERT (`is_staff_agent = 1` unique per user) |
| **Software token ownership** | Token deletion verifies `user_id` match before DELETE |
| **Telemetry PII sanitization** | All chat logs stripped of emails, phones, SA IDs, credit cards, account numbers, addresses before SQLite storage |
| **Telemetry consent** | Users must accept telemetry terms before first assistant creation; paid users can opt out entirely |
| **Fire-and-forget logging** | Analytics errors caught silently — never blocks or breaks chat responses |

---

## 6. Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama API endpoint | — |
| `ASSISTANT_OLLAMA_MODEL` | Chat model (e.g., deepseek-r1) | — |
| `OLLAMA_KEEP_ALIVE` | Model RAM pinning (`-1` = forever) | — |
| `ASSISTANT_OPENROUTER_MODEL` | **NEW (v1.8.0)** Paid-tier chat model via OpenRouter | `google/gemma-3-4b-it:free` |
| `OPENROUTER_API_KEY` | OpenRouter auth (checked via credentialVault) | — |
| `VISION_OPENROUTER_MODEL` | **NEW (v2.0.0)** Primary vision model via OpenRouter | `openai/gpt-4o` |
| `VISION_OPENROUTER_FALLBACK` | **NEW (v2.0.0)** Fallback vision model via OpenRouter | `google/gemini-2.0-flash-001` |
| `VISION_OLLAMA_MODEL` | **NEW (v2.0.0)** Local vision model for free tier + last resort | `qwen2.5vl:7b` |

| Hardcoded Constant | File | Value |
|--------------------|------|-------|
| `VECTOR_DIM` | vectorStore.ts | 768 |
| `DB_PATH` | vectorStore.ts | `/var/opt/backend/data/vectors.db` |
| `POLL_INTERVAL_MS` | ingestionWorker.ts | 6000 (6s) |
| `CHUNK_SIZE` | ingestionWorker.ts | 1200 chars |
| `CHUNK_OVERLAP` | ingestionWorker.ts | 200 chars |
| `MAX_CONTENT_CHARS` | ingestionWorker.ts | 15000 |
| `MAX_RETRIES` | ingestionWorker.ts | 3 |
| `CATEGORIZER_MODEL` | knowledgeCategorizer.ts | `qwen2.5:3b-instruct` |
| `EMBED_MODEL` | ingestionWorker.ts | `nomic-embed-text` |
| `INGESTION_OPENROUTER_MODEL` | ingestionAIRouter.ts | `google/gemma-3-4b-it:free` |
| `INGESTION_OLLAMA_MODEL` | ingestionAIRouter.ts | `qwen2.5:3b-instruct` |
| `MAX_TOOL_ROUNDS` | mobileAIProcessor.ts | 5 |
| `MAX_HISTORY_MESSAGES` | mobileAIProcessor.ts | 20 |
| `STAFF_CORE_DEFAULT` | mobileAIProcessor.ts | Default staff core instructions |
| `CLIENT_CORE_DEFAULT` | mobileAIProcessor.ts | Default client core instructions |

---

## 7. Documentation Index

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | This file — module overview, architecture, data flows |
| [FILES.md](FILES.md) | File inventory with functions, interfaces, LOC per file |
| [FIELDS.md](FIELDS.md) | Complete database schema (MySQL + sqlite-vec tables) |
| [ROUTES.md](ROUTES.md) | All 30 API endpoints with curl examples and response shapes |
| [PATTERNS.md](PATTERNS.md) | Architecture patterns, anti-patterns, technical debt |
| [CHANGES.md](CHANGES.md) | Version history (v1.0.0–v1.6.0) and known issues |
| [MODELS.md](MODELS.md) | **AI model routing, 3-tier fallback chains, vision routing, enterprise routing, env vars** |
| [KNOWLEDGE_BASE_EDITING.md](KNOWLEDGE_BASE_EDITING.md) | Knowledge base CRUD workflows and editing UX |
| [SQLITE_VEC_ARCHITECTURE.md](SQLITE_VEC_ARCHITECTURE.md) | **Deep dive:** vec0 engine, KNN search, embedding pipeline, dual-storage, performance |