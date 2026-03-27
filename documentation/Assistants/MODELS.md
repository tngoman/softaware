# AI Model Routing & Fallback Chains

**Last Updated:** 2026-03-14

---

## 1. Overview

All AI chat traffic in the Soft Aware platform routes through a **cascading fallback** system.
The primary model is always **GLM (glm-4.6)** via the ZhipuAI Anthropic-compatible API at `api.z.ai`.
If GLM fails, the system falls through to paid (OpenRouter) and/or local (Ollama) providers
depending on the user's subscription tier and whether the request involves tool calling.

This document covers:

- Text chat routing (Assistants, Staff, Mobile)
- Vision/multimodal routing
- Enterprise webhook routing
- Ingestion pipeline routing
- All model constants and environment variables

---

## 2. Text Chat — 3-Tier Cascade

> **File:** `src/services/assistantAIRouter.ts`
> **Used by:** `assistants.ts` (portal SSE chat), `mobileAIProcessor.ts` (mobile intent), `enterpriseWebhook.ts` (non-tool endpoints)

### Free Tier

```
GLM (glm-4.6) → Ollama (local)
```

| Step | Provider | Model | API | Cost |
|------|----------|-------|-----|------|
| 1 | GLM / ZhipuAI | `glm-4.6` | Anthropic Messages API at `https://api.z.ai/api/anthropic` | Free (Coding Lite plan) |
| 2 | Ollama | `$ASSISTANT_OLLAMA_MODEL` (e.g. `deepseek-r1`) | Local `http://localhost:11434/api/chat` | Free (self-hosted) |

### Paid Tier

```
GLM (glm-4.6) → OpenRouter (gpt-4o-mini) → Ollama (local)
```

| Step | Provider | Model | API | Cost |
|------|----------|-------|-----|------|
| 1 | GLM / ZhipuAI | `glm-4.6` | Anthropic Messages API at `https://api.z.ai/api/anthropic` | Free (Coding Lite plan) |
| 2 | OpenRouter | `openai/gpt-4o-mini` | `https://openrouter.ai/api/v1/chat/completions` | ~$0.15/1M tokens |
| 3 | Ollama | `$ASSISTANT_OLLAMA_MODEL` | Local | Free |

### Fallback Behavior

1. **GLM is always tried first** for all tiers. It's free under the ZhipuAI Coding Lite plan.
2. If GLM's API key is missing or the request fails, the system falls through.
3. **Free tier** skips OpenRouter entirely (no paid API calls for free users).
4. **Paid tier** tries OpenRouter before Ollama.
5. **Ollama is always the last resort** — it never fails unless the local server is down.

### SSE Stream Formats

Each provider returns a different streaming format. The caller checks the `provider` field:

| Provider | Format | Parser |
|----------|--------|--------|
| `glm` | Anthropic SSE (`event: content_block_delta`) | `delta.text` |
| `openrouter` | OpenAI SSE (`data: {choices:[{delta:{content}}]}`) | `choices[0].delta.content` |
| `ollama` | NDJSON (`{"message":{"content":"..."}}`) | `message.content` |

---

## 3. Vision / Multimodal — Image Analysis

> **File:** `src/services/assistantAIRouter.ts` (bottom half)
> **Used by:** `assistants.ts` (when images attached to chat)

**GLM is skipped for vision** — it's a text-only model.

### Free Tier

```
Ollama qwen2.5vl:7b (local)
```

| Step | Provider | Model | Cost |
|------|----------|-------|------|
| 1 | Ollama | `qwen2.5vl:7b` | Free (self-hosted) |

### Paid Tier

```
OpenRouter gpt-4o → OpenRouter gemini-2.0-flash → Ollama qwen2.5vl:7b
```

| Step | Provider | Model | Cost |
|------|----------|-------|------|
| 1 | OpenRouter | `openai/gpt-4o` | ~$2.50/1M input tokens |
| 2 | OpenRouter | `google/gemini-2.0-flash-001` | ~$0.10/1M input tokens |
| 3 | Ollama | `qwen2.5vl:7b` | Free (self-hosted) |

### Image Payload Format

| Provider | Format |
|----------|--------|
| OpenRouter | OpenAI content array: `[{type:"text",...}, {type:"image_url", image_url:{url:"data:..."}}]` |
| Ollama | Separate `images` field with raw base64 (data-URI prefix stripped) |

---

## 4. Enterprise Webhooks

> **File:** `src/routes/enterpriseWebhook.ts`
> **Database:** SQLite at `/var/opt/backend/data/enterprise_endpoints.db`

Enterprise endpoints are database-driven. Each endpoint stores its own `llm_provider` and `llm_model`,
but **all endpoints** use the GLM-first 3-tier cascade regardless of configuration.

### Routing (all endpoints)

```
GLM (glm-4.6) → OpenRouter (configured model) → Ollama (local)
```

| Step | What happens |
|------|-------------|
| 1. GLM | Simple text chat via Anthropic API. If it responds, the answer is used immediately. |
| 2. OpenRouter | If GLM fails: for **tool-calling endpoints**, runs the multi-round tool loop (up to 5 rounds). For **non-tool endpoints**, simple chat. |
| 3. Ollama | If both GLM and OpenRouter fail, Ollama handles the request as a last resort. |

### Tool-Calling Endpoints

Tool-calling endpoints (those with `llm_tools_config`) still benefit from GLM-first routing.
If GLM answers the query directly (e.g. general conversation), tool calling is bypassed.
When GLM fails, OpenRouter handles the request with full tool-call support:

1. Send messages + tools definition to OpenRouter
2. If response contains `tool_calls`:
   - Execute each tool via `target_api_url`
   - Feed tool results back as `role: "tool"` messages
   - Re-call OpenRouter for the next round
3. Repeat up to `MAX_TOOL_ROUNDS` (5) times
4. Final response is the text without tool calls

---

## 5. Ingestion Pipeline

> **File:** `src/services/ingestionAIRouter.ts`

Knowledge ingestion (URL scraping, file processing) uses a **separate** routing scheme — not the main cascade:

| Tier | Provider | Model |
|------|----------|-------|
| Paid | OpenRouter | `google/gemma-3-4b-it:free` |
| Free | Ollama | `qwen2.5:3b-instruct` |

### Other Ingestion Models

| Task | Model | Provider |
|------|-------|----------|
| Content categorization | `qwen2.5:3b-instruct` | Ollama |
| Embedding | `nomic-embed-text` (768-dim) | Ollama |

---

## 6. Model Pre-Warming

On server startup, both the **Assistant chat model** and the **Tools model** are pre-warmed
by sending a dummy request to Ollama with `keep_alive` set. This eliminates cold-start latency
for the first user request.

| Model | Purpose |
|-------|---------|
| `$ASSISTANT_OLLAMA_MODEL` | Chat (last-resort fallback) |
| `qwen2.5:3b-instruct` | Categorization / ingestion |
| `nomic-embed-text` | Embedding |
| `qwen2.5vl:7b` | Vision (last-resort fallback) |

---

## 7. Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama API base URL | — (required) |
| `ASSISTANT_OLLAMA_MODEL` | Ollama chat model (last resort) | — (required) |
| `OLLAMA_KEEP_ALIVE` | Model RAM pinning (`-1` = forever, `0` = unload after request) | — |
| `GLM_MODEL` | GLM model name | `glm-4.6` |
| `GLM` | GLM API key (fallback if not in credential vault) | — |
| `OPENROUTER_FALLBACK_MODEL` | OpenRouter text fallback model | `openai/gpt-4o-mini` |
| `OPENROUTER_API_KEY` | OpenRouter auth (via credential vault) | — |
| `VISION_OPENROUTER_MODEL` | Primary vision model via OpenRouter | `openai/gpt-4o` |
| `VISION_OPENROUTER_FALLBACK` | Fallback vision model via OpenRouter | `google/gemini-2.0-flash-001` |
| `VISION_OLLAMA_MODEL` | Local vision model for free tier + last resort | `qwen2.5vl:7b` |

---

## 8. Hardcoded Constants

| Constant | File | Value |
|----------|------|-------|
| `GLM_BASE_URL` | assistantAIRouter.ts | `https://api.z.ai/api/anthropic` |
| `GLM_MODEL` | assistantAIRouter.ts | `glm-4.6` |
| `OPENROUTER_FALLBACK_MODEL` | assistantAIRouter.ts | `openai/gpt-4o-mini` |
| `VISION_OLLAMA_MODEL` | assistantAIRouter.ts | `qwen2.5vl:7b` |
| `VISION_OPENROUTER_MODEL` | assistantAIRouter.ts | `openai/gpt-4o` |
| `VISION_OPENROUTER_FALLBACK` | assistantAIRouter.ts | `google/gemini-2.0-flash-001` |
| `INGESTION_OPENROUTER_MODEL` | ingestionAIRouter.ts | `google/gemma-3-4b-it:free` |
| `INGESTION_OLLAMA_MODEL` | ingestionAIRouter.ts | `qwen2.5:3b-instruct` |
| `CATEGORIZER_MODEL` | knowledgeCategorizer.ts | `qwen2.5:3b-instruct` |
| `EMBED_MODEL` | ingestionWorker.ts | `nomic-embed-text` |
| `MAX_TOOL_ROUNDS` | enterpriseWebhook.ts | 5 |

---

## 9. API Key Sources

Keys are loaded via `credentialVault.ts` with env-var fallback:

| Key | Vault Name | Env Fallback | Used By |
|-----|-----------|--------------|---------|
| GLM / ZhipuAI | `GLM` | `$GLM` | assistantAIRouter (text chat) |
| OpenRouter | `OPENROUTER` | `$OPENROUTER_API_KEY` | assistantAIRouter (text + vision fallback) |

Keys are **cached in memory** after first fetch. If an API returns 401/403, the cached key is
invalidated and re-fetched on the next request.

---

## 10. Routing Decision Diagram

```
                    ┌─────────────────────┐
                    │   Incoming Request   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Has image/vision?  │
                    └──┬──────────────┬───┘
                      YES            NO
                       │              │
              ┌────────▼──────┐  ┌───▼────────────────┐
              │ Vision Router │  │ GLM-first 3-tier   │
              │ (skip GLM)   │  │ cascade             │
              └────────┬──────┘  │                     │
                       │         │ GLM → OpenRouter    │
                  ┌────▼────┐    │ → Ollama            │
                  │ Paid?   │    │                     │
                  └─┬────┬──┘    │ (Both Assistants &  │
                   Y    N        │  Enterprise use     │
                   │    │        │  this same chain)   │
         ┌─────────▼┐ ┌▼──────┐ │                     │
         │ gpt-4o   │ │Ollama │ │ Tool endpoints:     │
         │→gemini   │ │qwen   │ │ If GLM fails →      │
         │→Ollama   │ │2.5vl  │ │ OpenRouter runs     │
         │ qwen2.5vl│ │       │ │ tool-call loop      │
         └──────────┘ └───────┘ └─────────────────────┘
```

---

## 11. Cost Optimization Strategy

1. **GLM first** — free under ZhipuAI Coding Lite plan; handles majority of text requests at zero cost
2. **OpenRouter gpt-4o-mini** — cheap fallback (~$0.15/1M tokens) when GLM is unavailable
3. **Ollama local** — zero marginal cost; always available as final safety net
4. **Vision tiering** — free users get local Ollama vision; paid users get high-quality GPT-4o with multi-level fallback
5. **Ingestion** — uses free/cheap models (gemma-3-4b:free, qwen2.5:3b) since quality tolerance is higher for content cleaning
