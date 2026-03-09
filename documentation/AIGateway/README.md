# AI Gateway Module Documentation

**Version:** 2.9.0  
**Last Updated:** 2026-03-09

> **Not to be confused with [Assistants](../Assistants/README.md)** — that module covers RAG-powered lead-capture assistants with knowledge bases and embeddable widgets. This module is the **multi-provider LLM gateway** used by the desktop app, API key consumers, and internal services.

## Overview

The AI Gateway module is a multi-provider LLM broker. It accepts a single, unified request schema and routes it to the correct upstream provider (OpenRouter, OpenAI, Azure OpenAI, Anthropic / Claude, Google Gemini, Groq, or local Ollama). It also handles vision analysis, streaming, credit deduction, and per-team model configuration.

## Purpose

- Provide a **single unified API** (`/api/ai/*`) that abstracts away provider differences
- Route requests to the correct provider based on the caller's choice or team defaults
- Support vision / multi-modal requests with file & image attachments
- Deduct credits for paid providers; exempt user-hosted Ollama
- Stream responses via SSE for real-time UX
- Allow per-team default model & provider configuration (`/api/ai-config`)

## Key Components

### Routes
- **AI Routes** (`routes/ai.js`): Main AI conversation endpoints
- **Messages Routes** (`routes/messages.js`): Message management
- **Assistant Routes** (`routes/assistant.js`): Assistant-specific features

### Services
- **AI Service** (`services/aiService.js`): Core AI functionality and provider management
- **Model Manager**: Model selection and routing logic
- **Conversation Manager**: Context and history management

### Models
- **AI Conversations**: Stores conversation metadata and settings
- **AI Messages**: Individual messages within conversations
- **Model Configurations**: Provider and model settings

## Integration Points

- **User Module**: Associates conversations with users
- **Audit Module**: Logs AI interactions
- **Configuration**: Model provider credentials and settings
- **Streaming**: Real-time response delivery

## Related Documentation

- [Routes](ROUTES.md) - Detailed route specifications
- [Patterns](PATTERNS.md) - Common usage patterns
- [Changes](CHANGES.md) - Version history and updates

## Quick Start

```javascript
// Start a new conversation
POST /api/ai/conversations
{
  "title": "New Chat",
  "model": "openai/gpt-4",
  "systemPrompt": "You are a helpful assistant"
}

// Send a message
POST /api/ai/conversations/:id/messages
{
  "content": "Hello, how can you help?",
  "stream": true
}
```

## Model Routing Strategy

The gateway routes requests to different Ollama models based on task complexity:

| Priority | Provider | Model | Use Cases | Auth / Env Var |
|----------|----------|-------|-----------|----------------|
| **1st (primary)** | GLM (ZhipuAI) | `glm-4.6` | ALL assistant chat (free + paid), ingestion cleaning — tried first for every request | Vault key `GLM` / `GLM_MODEL` |
| **2nd (paid fallback)** | OpenRouter | `openai/gpt-4o-mini` | Paid-tier fallback when GLM fails — assistant chat, ingestion, enterprise webhooks | Vault key `OPENROUTER` / `OPENROUTER_FALLBACK_MODEL` |
| **3rd (last resort)** | Ollama | `qwen2.5:1.5b-instruct` | Last-resort local fallback for all chat, leads, widget chat | `ASSISTANT_OLLAMA_MODEL` |
| **Tools** | Ollama | `qwen2.5:3b-instruct` | Staff mobile intent with tool-calling (41 tools, structured output) | `TOOLS_OLLAMA_MODEL` |
| **Large/queue** | Ollama | `qwen2.5-coder:7b` | Site builder, code generation, queueable AI processes | `OLLAMA_MODEL` |

**Design rationale:** GLM (`glm-4.6`) is the primary provider for all tiers — free access under the Coding Lite-Quarterly plan via the Anthropic-compatible API at `api.z.ai/api/anthropic`. Response time ~4.3s for glm-4.6, with better reasoning than local models. OpenRouter (`gpt-4o-mini`) is a paid-tier fallback when GLM is unavailable. Ollama is always the last resort. Qwen 2.5 (3B instruct) is reserved for tool-calling because it produces reliable structured output for function routing across 41 tools. Large models (7B+) are only used for queueable background tasks.

## Ollama Performance Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `OLLAMA_NUM_PARALLEL` | `2` | Max concurrent Ollama requests (systemd override) |
| `OLLAMA_MAX_QUEUE` | `512` | Max queued requests before rejection |
| `OLLAMA_KEEP_ALIVE` | `-1` | Pin models in RAM permanently (no unload timeout) |

### Model Pre-warming

On server startup, the backend fires a 1-token "hi" prompt at both the Assistant and Tools models to eliminate cold-start latency. If both env vars point to the same model, only one warm-up request is sent (de-duplicated).

```typescript
// index.ts — warmOllamaModels()
for (const m of uniqueModels) {
  await fetch(`${base}/api/chat`, {
    body: JSON.stringify({ model: m.name, messages: [{ role: 'user', content: 'hi' }], stream: false, options: { num_predict: 1 }, keep_alive: -1 })
  });
}
```

## Configuration

The AI module requires the following environment variables:
- `OPENROUTER_API_KEY`: For OpenRouter access — paid-tier assistant chat, enterprise webhooks, paid ingestion
- `ASSISTANT_OPENROUTER_MODEL`: Model for paid-tier assistant chat via OpenRouter (default: `google/gemma-3-4b-it:free`)
- `OPENAI_API_KEY`: For direct OpenAI access
- `ANTHROPIC_API_KEY`: For Claude models
- `OLLAMA_BASE_URL`: For local Ollama instance
- `ASSISTANT_OLLAMA_MODEL`: Default model for chat/leads/widgets (default: `qwen2.5:1.5b-instruct`)
- `TOOLS_OLLAMA_MODEL`: Tool-calling model for staff AI (default: `qwen2.5:3b-instruct`)
- `OLLAMA_MODEL`: Large model for site builder/code gen (default: `qwen2.5-coder:7b`)

## Features

- Multi-provider support with automatic failover
- Streaming and non-streaming responses
- Conversation branching and history
- Token counting and cost tracking
- Model capability matching
- Context window management
