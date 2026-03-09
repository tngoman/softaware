# AI Module Changes

## Version History

### v2.9.0 - March 2026
**GLM-First 3-Tier Cascading Routing**

Complete rewrite of `assistantAIRouter.ts` (~130 → ~435 LOC). GLM (ZhipuAI) via the Anthropic-compatible Messages API is now the **primary provider for all tiers**. The old 2-provider model (OpenRouter vs Ollama) is replaced with a 3-tier cascading fallback:

- **Free tier:** GLM (`glm-4.6`) → Ollama (`qwen2.5:1.5b-instruct`)
- **Paid tier:** GLM (`glm-4.6`) → OpenRouter (`openai/gpt-4o-mini`) → Ollama

#### GLM Provider Details
- **API:** Anthropic-compatible Messages API at `https://api.z.ai/api/anthropic/v1/messages`
- **Auth:** `x-api-key` header (key stored in credential vault, `service_name='GLM'`)
- **Plan:** GLM Coding Lite-Quarterly (valid until 2026-05-06, auto-renew)
- **Model:** `glm-4.6` (default) — supports glm-4.5-air (fastest, 2.5s), glm-4.5, glm-4.6 (4.3s), glm-4.7 (14.8s)
- **Streaming:** Anthropic SSE format (`event: content_block_delta`, `data: {"delta":{"text":"..."}}`)
- **System messages:** Extracted to top-level `system` field via `buildGLMBody()` helper

#### Key Changes
- **`assistantAIRouter.ts`** — Rewritten with `glmChat()`, `glmStream()`, `buildGLMBody()`, dual key caching (`_glmKey`, `_openRouterKey`). New `PaidProvider` type: `'glm' | 'openrouter' | 'ollama'`. `chatCompletion()` now returns `{ content, model, provider }` instead of plain string.
- **`assistants.ts`** — SSE parser now has 3 branches: `provider === 'glm'` (Anthropic SSE), `provider === 'openrouter'` (OpenAI SSE), else (Ollama NDJSON).
- **`ingestionAIRouter.ts`** — Content cleaning now tries GLM first (Anthropic Messages API) → OpenRouter → Ollama.
- **`mobileIntent.ts`** — `GET /conversations` now returns `assistant_id` and `preview` (first user message via subquery).
- **`.env`** — `GLM_MODEL=glm-4.6` (changed from `glm-4.5-air`).

#### Frontend: Chat History Sidebar
- **`Profile.tsx`** (1735 → 1858 LOC) — Staff chat modal now includes a collapsible left sidebar (256px) showing previous conversations with truncated first-message previews, relative timestamps ("2m ago", "3h ago"), hover-reveal delete, and active-conversation highlight. Modal widened from `max-w-2xl` → `max-w-5xl`.
- **`SystemModels.ts`** — `MobileConversation` type now includes `preview: string | null`.

#### Updated Model Routing Table

| Priority | Provider | Model | Use Cases | Auth |
|----------|----------|-------|-----------|------|
| **1st** | GLM (ZhipuAI) | `glm-4.6` | ALL assistant chat (free + paid), ingestion cleaning | Vault key `GLM` |
| **2nd** | OpenRouter | `openai/gpt-4o-mini` | Paid-tier fallback (chat + ingestion) | Vault key `OPENROUTER` |
| **3rd** | Ollama | `qwen2.5:1.5b-instruct` | Last resort, free-tier fallback | None (local) |
| **Tools** | Ollama | `qwen2.5:3b-instruct` | Staff mobile intent tool-calling (41 tools) | None (local) |
| **Large** | Ollama | `qwen2.5-coder:7b` | Site builder, code generation | None (local) |

---

### v2.8.1 - March 2026
**Enforce OpenRouter for ALL Paid-Tier AI Operations**

#### Fixed: Enterprise Endpoint Creation (`mobileActionExecutor.ts`)
`execGenerateEnterpriseEndpoint()` was hardcoding `llm_provider: 'ollama'` and `llm_model: 'qwen2.5:3b-instruct'` when creating enterprise endpoints. Enterprise endpoints are inherently paid-tier, so now defaults to `llm_provider: 'openrouter'` with `env.OPENROUTER_MODEL` (default: `openai/gpt-4o-mini`). All 3 existing endpoints in the SQLite database were migrated.

#### Fixed: Widget Chat Routing (`widgetChat.ts`)
`POST /api/v1/chat` was routing ALL tiers through local Ollama (defaulting to `qwen2.5:3b-instruct`). Now:
- **Free/Starter** → local Ollama (unchanged)
- **Advanced/Enterprise with external API** → client's configured external provider (unchanged)
- **Advanced/Enterprise** → OpenRouter via `chatCompletion('paid', ...)` from `assistantAIRouter.ts` **(new)**

#### Fixed: Mobile AI Model Override (`mobileAIProcessor.ts`)
When `assistantRow.preferred_model` was set (e.g., an Ollama model name), it was being passed as `modelOverride` to `chatCompletion()` even for paid-tier routing through OpenRouter, which would send an Ollama model name to an incompatible API. Now `modelOverride` is `undefined` for paid tiers, allowing the configured `ASSISTANT_OPENROUTER_MODEL` to be used.

#### Data Migration
Updated 3 existing enterprise endpoints in `/var/opt/backend/data/enterprise_endpoints.db`:
- `ep_silulumanzi_*`: ollama/qwen2.5:3b-instruct → openrouter/openai/gpt-4o-mini
- `ep_admin-softaware-001_*` (×2): ollama/qwen2.5:3b-instruct → openrouter/openai/gpt-4o-mini

---

### v2.8.0 - March 2026
**Paid-Tier Assistant Chat via OpenRouter**

#### New: `assistantAIRouter.ts` — Tier-Based Chat Routing
Created `src/services/assistantAIRouter.ts` (~130 LOC) — a centralized routing service that sends paid-tier assistant chat through OpenRouter and free-tier through local Ollama. Mirrors the existing `ingestionAIRouter.ts` pattern.

Exports:
- `chatCompletion(tier, messages, opts?, ollamaModel?)` — non-streaming, used by `mobileAIProcessor.ts`
- `chatCompletionStream(tier, messages, opts?, ollamaModel?)` — streaming, used by `assistants.ts` POST /chat
- `shouldUseOpenRouter(tier)` — tier check + key availability

Falls back gracefully to Ollama if no OpenRouter API key is available. API key is cached after first vault lookup.

#### Modified: Portal Chat Streaming (`assistants.ts`)
The `POST /api/assistants/chat` handler now routes through `chatCompletionStream()` instead of hardcoded Ollama. The stream parser handles both Ollama NDJSON and OpenRouter SSE formats. The `done` event now includes a `provider` field.

#### Modified: Mobile Intent (`mobileAIProcessor.ts`)
Removed the local `ollamaChat()` function. The tool-call loop now uses `chatCompletion()` from the centralized router. `loadAssistantPromptData()` SQL query now includes `COALESCE(tier,'free') AS tier`. The `AssistantPromptRow` interface was extended with a `tier` field.

#### New Environment Variable: `ASSISTANT_OPENROUTER_MODEL`
Added to `env.ts` with default `google/gemma-3-4b-it:free`. Controls which OpenRouter model is used for paid-tier assistant chat. Added to `.env`.

#### Updated Model Routing Table
OpenRouter is no longer "exclusively for enterprise webhook processing." It now also handles:
- **Paid-tier portal chat** (SSE streaming via `assistants.ts`)
- **Paid-tier mobile intent** (non-streaming via `mobileAIProcessor.ts`)
- Enterprise webhook processing (unchanged)
- Paid-tier ingestion cleaning (unchanged via `ingestionAIRouter.ts`)

#### Affected Assistants
- **Staff sandbox assistants** — tier forced to `paid` at creation → now use OpenRouter by default
- **Paid client assistants** — tier = `paid` → now use OpenRouter
- **Free client assistants** — tier = `free` → Ollama (no change)

#### Files Changed
- `src/services/assistantAIRouter.ts` — **NEW** — tier-based chat routing
- `src/routes/assistants.ts` — chat handler rewritten for dual-provider streaming
- `src/services/mobileAIProcessor.ts` — `ollamaChat` → `chatCompletion` from router, tier in SQL
- `src/config/env.ts` — added `ASSISTANT_OPENROUTER_MODEL`
- `.env` — added `ASSISTANT_OPENROUTER_MODEL=google/gemma-3-4b-it:free`

---

### v2.7.0 - March 2026
**Reliability, Performance & Chat Persistence**

#### Default Model Switch
Switched the default model from `gemma2:2b` to `qwen2.5:1.5b-instruct` after CPU performance benchmarking:
- `qwen2.5:1.5b-instruct`: **9.2 tok/s** (48% faster)
- `gemma2:2b`: 6.2 tok/s
- `qwen2.5:3b-instruct`: 7.3 tok/s

All `ASSISTANT_OLLAMA_MODEL`, `LEADS_OLLAMA_MODEL`, and `INGESTION_OLLAMA_MODEL` defaults updated.

#### Ollama Pre-warming on Startup
Added `warmOllamaModels()` in `src/index.ts` — fires a 1-token "hi" prompt at both Assistant and Tools models on server boot to eliminate cold-start delay. De-duplicates if both env vars point to the same model. Logs warm-up time per model.

#### Ollama Parallelism Reduction
`OLLAMA_NUM_PARALLEL` reduced from `8` → `2` via systemd override (`/etc/systemd/system/ollama.service.d/override.conf`). On CPU-only hardware (AMD EPYC 12 cores, 48GB RAM), 2 parallel slots provides better throughput per-request without memory contention.

#### Tool Error Messages Improved
All 41 tool executors in `mobileActionExecutor.ts` now return **actionable error messages** that guide the user to the exact dashboard location. Example: `"No software token found. Go to Dashboard → Software Connections to add your external software API token."` instead of generic "not configured" messages.

#### System Prompt Rules Updated
In `mobileTools.ts`:
- Rule #4 changed: **Relay tool errors directly** — do not rephrase or interpret error messages from tool results
- Rule #7 added: **Do not ask the user for API keys** — if a tool says "no token", relay the exact message which includes dashboard instructions

#### Collation Fix for `ingestion_jobs`
Two tools (`check_client_health`, `list_failed_jobs`) crashed with MySQL collation mismatch:
- `ingestion_jobs` columns used `utf8mb4_0900_ai_ci`
- `assistants` table used `utf8mb4_unicode_ci`

Fixed with:
1. `COLLATE utf8mb4_unicode_ci` added to JOIN conditions in executor queries
2. `ALTER TABLE ingestion_jobs MODIFY COLUMN id VARCHAR(36) ... COLLATE utf8mb4_unicode_ci`
3. `ALTER TABLE ingestion_jobs MODIFY COLUMN assistant_id VARCHAR(255) ... COLLATE utf8mb4_unicode_ci`

#### Tool Test Suite: 35/35 Passing
Created and ran `test-all-staff-tools.mjs` — comprehensive test of all 35 staff-accessible tools via `POST /api/v1/mobile/intent`. All 35 passed with 0 failures after the collation fix.

#### Chat Persistence (Staff + Client)
- **Staff chat** (`Profile.tsx`): `openChat()` no longer clears message state. Added `clearChat()` with trash icon button for explicit clearing.
- **Client chat** (`AssistantsPage.tsx`): Messages stored per-assistant via `chatHistoryRef` (keyed by assistant ID). History preserved across modal open/close. Added trash icon for clearing.

#### SSE Bug Fixes (Client Chat)
Fixed 4 bugs in `AssistantsPage.tsx` SSE streaming:
1. **Line buffering** — incomplete SSE lines now buffered until newline received
2. **`response.ok` check** — non-200 responses no longer silently fail
3. **Conversation history** — full history now sent with each request (was sending only current message)
4. **Error display** — network/parse errors now shown in chat bubble instead of silent failure

#### Staff Assistant Header Softened
Changed gradient from `slate-900`/`indigo-950` to `slate-800`/`indigo-900`. Dot pattern opacity `0.03` → `0.05`. Shadow `shadow-xl` → `shadow-lg`.

#### Files Changed
- `src/index.ts` — `warmOllamaModels()` function, startup log with model names
- `src/config/env.ts` — Default model values updated to `qwen2.5:1.5b-instruct`
- `src/services/mobileAIProcessor.ts` — `keep_alive` string→number conversion fix
- `src/services/mobileActionExecutor.ts` — Collation fixes in 2 JOINs, actionable error messages
- `src/services/mobileTools.ts` — System prompt Rule #4 and #7 updates
- `.env` — All model assignments updated
- `/etc/systemd/system/ollama.service.d/override.conf` — `OLLAMA_NUM_PARALLEL=2`
- `frontend/src/pages/general/Profile.tsx` — Chat persistence, clearChat(), header softened
- `frontend/src/pages/portal/AssistantsPage.tsx` — Per-assistant chat persistence, SSE fixes, trash icon

---

### v2.6.0 - March 2026
**Model Routing Overhaul**

#### Tiered Model Strategy
Restructured all Ollama model assignments into a clear priority hierarchy:

| Priority | Model | Role | Env Var |
|----------|-------|------|---------|
| **1st** | `qwen2.5:1.5b-instruct` | Default for all assistant chat, leads, widget chat, ingestion | `ASSISTANT_OLLAMA_MODEL` |
| **2nd** | `qwen2.5:3b-instruct` | Tool-calling only (staff mobile intent, 41 tools) | `TOOLS_OLLAMA_MODEL` |
| **3rd** | `qwen2.5-coder:7b` | Large/queueable tasks (site builder, code generation) | `OLLAMA_MODEL` |
| **External** | OpenRouter | Enterprise webhooks, paid-tier ingestion | `OPENROUTER_API_KEY` |

#### New Environment Variable
- **`TOOLS_OLLAMA_MODEL`** — Dedicated model for tool-calling in `mobileAIProcessor.ts`. Qwen 2.5 produces reliable structured output for function routing; Gemma 2 is not suited for tool selection.

#### Files Changed
- `src/config/env.ts` — Added `TOOLS_OLLAMA_MODEL` default `qwen2.5:3b-instruct`; updated `ASSISTANT_OLLAMA_MODEL` default → `qwen2.5:1.5b-instruct`; `LEADS_OLLAMA_MODEL` default → `qwen2.5:1.5b-instruct`; `INGESTION_OLLAMA_MODEL` default → `qwen2.5:1.5b-instruct`
- `src/services/mobileAIProcessor.ts` — `ollamaChat()` now uses `env.TOOLS_OLLAMA_MODEL` instead of `env.ASSISTANT_OLLAMA_MODEL`
- `src/routes/widgetChat.ts` — Default model changed from `qwen2.5:3b-instruct` → `qwen2.5:1.5b-instruct`
- `src/index.ts` — Startup log now shows both Assistant and Tools model
- `.env` — Updated all model assignments to match new hierarchy

#### Bug Fix
- Fixed `keep_alive` parameter in `mobileAIProcessor.ts` — was passing string `"-1"` (caused Ollama 400 error), now correctly converts to number `-1` (matching the fix already present in `assistants.ts`)

---

### v2.5.0 - March 2026
**Major Enhancements**

#### Multi-Provider Support
- Added support for 6 AI providers: Softaware, OpenAI, Azure OpenAI, Gemini, Groq, Ollama
- Implemented provider abstraction layer with `AIProviderManager`
- Added automatic provider fallback on errors
- Configurable provider preferences per team

#### Vision Capabilities
- Added multi-modal support for images in chat
- Implemented `/analyze-image` endpoint
- Support for both URL and base64 image inputs
- Vision support across OpenAI, Gemini, and Ollama providers

#### Streaming Support
- Implemented Server-Sent Events (SSE) for real-time responses
- Added streaming support to both `/chat` and `/simple` endpoints
- Streaming support for assistant conversations

#### API Changes
- **New**: `/api/ai/chat` - Advanced chat with full control
- **New**: `/api/ai/simple` - Simplified single-prompt endpoint
- **New**: `/api/ai/analyze-image` - Dedicated vision endpoint
- **Changed**: `/api/glm/*` endpoints deprecated in favor of `/api/ai/*`

---

### v2.4.0 - February 2026
**Assistant Platform Launch**

#### Core Features
- Launched assistant creation platform
- Implemented website scraping and indexing
- Added vector search for knowledge retrieval
- Implemented conversation context management

#### Routes Added
- `POST /api/assistants` - Create assistant
- `GET /api/assistants` - List assistants
- `GET /api/assistants/:id` - Get assistant details
- `PUT /api/assistants/:id` - Update assistant
- `DELETE /api/assistants/:id` - Delete assistant
- `POST /api/assistants/:id/chat` - Chat with assistant
- `POST /api/assistants/:id/reindex` - Trigger reindexing
- `GET /api/assistants/:id/health` - Knowledge health check
- `GET /api/assistants/:id/tools` - Available tools

#### Assistant Features
- Persona templates (Professional, Friendly, Expert, Casual)
- Two-tier system (Free/Paid) with feature differentiation
- Tool integration framework
- Lead capture and webhooks
- Automatic categorization of knowledge base

---

### v2.3.0 - January 2026
**Configuration Management**

#### AI Configuration
- Added team-level AI provider configuration
- Implemented model preference settings
- Separate configs for text, vision, and code models

#### Routes Added
- `GET /api/ai-config` - Get team configuration
- `PUT /api/ai-config` - Update configuration

#### Database Schema
- Added `ai_model_config` table
- Fields: `defaultTextProvider`, `defaultTextModel`, `visionProvider`, `visionModel`, `codeProvider`, `codeModel`

---

### v2.2.0 - December 2025
**Credit Integration**

#### Features
- Integrated credit system with AI operations
- Variable credit costs per operation type
- Exempt local Ollama from credit charges
- Minimal broker fee for external providers

#### Credit Rates
- Text chat: 1 credit
- Vision analysis: 3-5 credits (tier dependent)
- Tool execution: 1-2 credits (tier dependent)
- External provider broker: 0.1 credit

---

### v2.1.0 - November 2025
**Error Handling & Reliability**

#### Improvements
- Enhanced error messages with provider context
- Automatic retry logic for transient failures
- Rate limiting implementation (100 req/min per key)
- Better timeout handling for long operations

#### Bug Fixes
- Fixed token counting for Anthropic models
- Corrected image encoding for Gemini
- Resolved streaming connection issues
- Fixed system prompt handling across providers

---

### v2.0.0 - October 2025
**Major Refactor**

#### Breaking Changes
- Migrated from JavaScript to TypeScript
- Changed route prefix from `/glm` to `/ai`
- Updated request/response schemas with Zod validation
- Removed deprecated legacy endpoints

#### Architecture
- Introduced service layer separation
- Implemented provider interface pattern
- Added middleware for authentication and authorization
- Centralized configuration management

#### Migration Guide
```javascript
// Old (v1.x)
POST /api/glm/chat
{ prompt: "...", context: "..." }

// New (v2.0+)
POST /api/ai/simple
{ 
  prompt: "...", 
  systemPrompt: "...",
  provider: "softaware"
}
```

---

### v1.5.0 - September 2025
**Initial GLM Integration**

#### Features
- Basic GLM (ZhipuAI) integration
- Simple chat endpoint
- System prompt support
- Basic error handling

#### Routes
- `POST /api/glm/chat` - Chat with GLM model
- `GET /api/glm/models` - List available models

---

## Upcoming Features (Roadmap)

### v2.6.0 - Planned Q2 2026
- Function calling support across providers
- Conversation persistence and retrieval
- Advanced context management with semantic compression
- Multi-assistant orchestration
- Custom model fine-tuning interface

### v2.7.0 - Planned Q3 2026
- Voice input/output support
- Real-time collaboration features
- Assistant marketplace
- Enhanced analytics and insights
- A/B testing framework for prompts

---

## Breaking Changes Summary

### v2.0.0
- **Route prefix changed**: `/api/glm/*` → `/api/ai/*`
- **Schema validation**: Now using Zod, stricter validation
- **Provider required**: Must specify provider in config or request
- **Response format**: Standardized across all providers

### v1.5.0 → v2.0.0 Migration
```typescript
// Update all API calls
- fetch('/api/glm/chat', ...)
+ fetch('/api/ai/chat', ...)

// Update request body
- { prompt: "...", context: "..." }
+ { 
+   messages: [
+     { role: 'system', content: '...' },
+     { role: 'user', content: '...' }
+   ]
+ }

// Update response handling
- const { response } = await res.json()
+ const { content, model, usage } = await res.json()
```

---

## Deprecation Notices

### Deprecated in v2.5.0
- `/api/glm/*` routes (use `/api/ai/*` instead)
- `context` field in requests (use `systemPrompt` instead)
- Single-provider architecture (now multi-provider)

**Removal Date**: v3.0.0 (Q4 2026)

### Deprecated in v2.3.0
- Hard-coded model selection (use configuration instead)
- Global provider settings (use team-level config)

**Removal Date**: v2.7.0 (Q3 2026)

---

## Database Schema Changes

### v2.4.0
```sql
-- New tables
CREATE TABLE assistants (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  business_type VARCHAR(100),
  personality VARCHAR(50),
  primary_goal TEXT,
  website VARCHAR(500),
  tier ENUM('free', 'paid') DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'indexing',
  pages_indexed INT DEFAULT 0,
  lead_capture_email VARCHAR(255),
  webhook_url VARCHAR(500),
  enabled_tools TEXT,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE assistant_knowledge (
  id VARCHAR(36) PRIMARY KEY,
  assistant_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  embedding BLOB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### v2.3.0
```sql
-- New table
CREATE TABLE ai_model_config (
  id VARCHAR(36) PRIMARY KEY,
  teamId VARCHAR(36) NOT NULL UNIQUE,
  defaultTextProvider VARCHAR(50) DEFAULT 'softaware',
  defaultTextModel VARCHAR(100) DEFAULT 'glm-4-plus',
  visionProvider VARCHAR(50) DEFAULT 'glm',
  visionModel VARCHAR(100) DEFAULT 'glm-4v-plus',
  codeProvider VARCHAR(50) DEFAULT 'softaware',
  codeModel VARCHAR(100) DEFAULT 'glm-4-plus',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## Configuration Changes

### Environment Variables

#### Added in v2.5.0
```bash
# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Vision defaults
SOFTAWARE_VISION_PROVIDER=glm
GLM_VISION_MODEL=glm-4v-plus
```

#### Added in v2.4.0
```bash
# Assistant configuration
ASSISTANT_OLLAMA_MODEL=qwen2.5:1.5b-instruct
TOOLS_OLLAMA_MODEL=qwen2.5:3b-instruct
OLLAMA_KEEP_ALIVE=-1
VECTOR_DB_PATH=/var/opt/backend/data/vectors

# Scraping limits
MAX_SCRAPE_PAGES=100
SCRAPE_TIMEOUT=30000
```

---

## Performance Improvements

### v2.5.0
- Implemented connection pooling for provider APIs
- Added response caching for identical prompts
- Reduced cold start time by 40%
- Optimized token counting algorithms

### v2.4.0
- Vector search indexing optimization (3x faster)
- Parallel knowledge processing during ingestion
- Streaming response memory optimization

### v2.3.0
- Database query optimization for config retrieval
- Reduced config lookup overhead by 60%

---

## Security Updates

### v2.5.0
- Added input sanitization for all prompts
- Implemented rate limiting per API key
- Enhanced API key validation
- Added request size limits (10MB max)

### v2.4.0
- Secured assistant endpoints with ownership checks
- Added webhook signature verification
- Implemented lead email validation
- XSS protection for scraped content

### v2.3.0
- Encrypted provider API keys in database
- Added admin-only config update requirement
- Implemented audit logging for config changes
