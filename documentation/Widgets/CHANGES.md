# Widgets Module — Changelog & Known Issues

**Version:** 1.0.0  
**Last Updated:** 2026-03-10

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-14 | 1.1.0 | Replaced iframe-based assistant embed widget with inline chat UI + SSE streaming — fixes "refused to connect" error caused by X-Frame-Options blocking |
| 2026-03-10 | 1.0.0 | Initial documentation — embeddable widget, RAG chat, tier-based routing, lead capture, usage tracking, knowledge ingestion |

---

## 2. v1.1.0 — Inline Chat Replaces iframe Embed

**Date:** 2026-03-14  
**Scope:** Replaced the iframe-based assistant embed widget (`/api/assistants/widget.js`) with a fully inline chat UI that communicates directly with the chat API via SSE streaming.

### Problem

The assistant embed widget used an `<iframe>` pointing to `https://softaware.net.za/chat/{assistantId}`. The site's `X-Frame-Options` / CSP headers blocked framing, causing a "refused to connect" error when the widget was opened on third-party websites.

### Solution

Replaced the iframe with an inline chat UI built entirely via DOM manipulation within the embed script. The widget now:
- Renders a messages area, input field, and send button directly in the chat container
- Sends messages via `POST /api/assistants/chat` (SSE streaming)
- Streams tokens in real-time using `ReadableStream` reader
- Maintains conversation history client-side (last 10 messages)
- Shows typing indicator (animated bouncing dots)
- Displays assistant responses with word-by-word streaming

### Files Changed

| File | Change |
|------|--------|
| `src/routes/assistants.ts` | Rewrote widget.js script: removed iframe + chatUrl, added inline messages area, input, send button, SSE streaming reader, typing indicator, conversation state |
| `src/routes/assistants.js` | Same changes (compiled JS) |

### Key Implementation Details

- **No iframe** — all DOM elements created inline (messages area, input, send button)
- **SSE streaming** — uses `fetch()` with `response.body.getReader()` to stream tokens
- **Token-by-token rendering** — assistant bubble updates with each `{token}` SSE event
- **Conversation history** — maintained in-memory array, last 10 messages sent with each request
- **Typing indicator** — 3 animated dots with CSS `@keyframes` injected into document head
- **Error handling** — graceful fallback messages for network errors and non-OK responses
- **Responsive** — `max-height: calc(100vh - 120px)` prevents overflow on small screens

---

## 3. v1.0.0 — Initial Documentation

**Date:** 2026-03-10  
**Scope:** Complete documentation of the existing Widgets module covering all backend services, API routes, database schema, client-side widget, and architecture patterns.

### Summary

The Widgets module provides an embeddable AI chat widget that website owners deploy with a single `<script>` tag. The module was built as the primary revenue surface for the Soft Aware platform, offering a 4-tier subscription model (Free → Starter → Advanced → Enterprise) with progressively unlocked features.

### Core Components Documented

| Component | Files | LOC | Description |
|-----------|-------|-----|-------------|
| Widget Chat | widgetChat.ts | 332 | RAG-powered chat with tier-based AI routing, lead capture, external LLM support |
| Widget Ingest | widgetIngest.ts | 244 | URL crawling, file upload, source management |
| Widget Service | widgetService.ts | 280 | Client CRUD, usage stats, chat logging |
| Document Service | documentService.ts | 316 | HTML extraction, text chunking, document storage |
| Embedding Service | embeddingService.ts | 171 | Ollama embeddings (768-dim), cosine similarity search |
| Crawler Service | crawlerService.ts | 158 | Crawl queue with retry logic |
| Lead Capture | leadCaptureService.ts | 304 | AI lead detection, SMTP notifications |
| Usage Tracking | usageTracking.ts | 345 | Billing cycles, tier limits, usage enforcement |
| Client Widget | widget.js | 453 | Shadow DOM chat widget (vanilla JS, IIFE) |

### Database Tables

| Table | Purpose |
|-------|---------|
| widget_clients | Client config, tier, billing, status |
| document_metadata | Chunked knowledge base content |
| document_embeddings | 768-dim JSON vectors per chunk |
| crawl_queue | URL crawl jobs with retry tracking |
| chat_messages | Full chat history per session |
| widget_leads_captured | Captured visitor leads |
| widget_usage_logs | Per-cycle message counts |
| subscription_tier_limits | Tier feature/limit definitions |

### Key Architecture Decisions

1. **Shadow DOM** for CSS isolation on third-party websites
2. **MySQL JSON** for embedding storage (vs sqlite-vec in Assistants module)
3. **Synchronous crawling** (inline during POST, not background worker)
4. **Lazy billing cycle reset** (checked on every request, no dedicated cron)
5. **Prompt-engineered lead capture** (AI outputs JSON in response text)
6. **Shared AI router** (`assistantAIRouter.ts`) for tier-based model cascading

---

## 3. Known Issues

### 3.1 Critical

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 1 | No auth on ingest endpoints | Anyone with a clientId can modify the knowledge base | Use obscure clientIds; add auth in future |
| 2 | No cascade delete for embeddings | Orphaned `document_embeddings` rows when sources are deleted | Manually run `deleteClientEmbeddings()` |

### 3.2 High

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 3 | PDF support disabled | Clients cannot upload PDF files | Use TXT files only |
| 4 | DOC/DOCX not implemented | Clients cannot upload Word documents | Convert to TXT before uploading |
| 5 | Full table scan for vector search | O(n) per query; degrades with large knowledge bases | Keep per-client chunk count under ~1000 |
| 6 | Double `checkWidgetStatus` middleware | Unnecessary extra DB query per request | Acceptable overhead; fix in refactor |

### 3.3 Medium

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 7 | No rate limiting on ingest endpoints | Potential crawl spam / resource exhaustion | 50-page cap provides some protection |
| 8 | Synchronous crawling blocks response | Long response times for slow websites | Accept 30s timeout; retry on failure |
| 9 | String-based API key "clearing" is ineffective | Keys may persist in V8 memory pool | Minimize key lifetime; use Buffer in future |
| 10 | `session_id` not generated server-side | Chat history grouping relies on client-sent session ID | Accept for now; add server sessions later |

### 3.4 Low

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 11 | Widget color not validated (hex format) | Invalid colors silently fail in CSS | Frontend validates before saving |
| 12 | `max_messages` column is legacy | Superseded by `subscription_tier_limits.max_messages_per_month` | Both exist; tier limits take precedence |
| 13 | No widget analytics dashboard | Usage data collected but not surfaced in portal | Query `widget_usage_logs` directly |
| 14 | Crawl queue `processPendingJobs()` not called automatically | Batch processing exists but no scheduler | Not needed — inline crawling is current approach |

---

## 4. Planned Improvements

| Priority | Improvement | Description |
|----------|-------------|-------------|
| 🔴 High | Auth on ingest endpoints | Add API key or JWT authentication for knowledge base modifications |
| 🔴 High | PDF support | Integrate `pdfjs-dist` or `pdf2json` for PDF parsing |
| 🟡 Medium | sqlite-vec migration | Move from MySQL JSON embeddings to sqlite-vec for indexed KNN search |
| 🟡 Medium | Background crawl worker | Async URL processing with status polling (like Assistants ingestionWorker) |
| 🟡 Medium | Embedding cascade delete | Add FK constraint or explicit delete in source removal methods |
| 🟢 Low | Widget analytics dashboard | Surface `widget_usage_logs` and `chat_messages` data in portal |
| 🟢 Low | DOC/DOCX support | Integrate `mammoth` for Word document parsing |
| 🟢 Low | Crawl rate limiting | Per-client limits on ingest requests |
