# Assistants Module — Architecture Patterns

**Version:** 2.3.0  
**Last Updated:** 2026-03-13

> **See also:** [SQLITE_VEC_ARCHITECTURE.md](SQLITE_VEC_ARCHITECTURE.md) for a deep-dive into the vector storage engine internals.

---

## 1. Overview

This document catalogs the architecture patterns found in the Assistants module, covering knowledge ingestion, RAG retrieval, health scoring, dashboard display, assistant deletion, and frontend UI customization.

---

## 2. Architectural Patterns

### 2.1 Dual-Storage Write Pattern (MySQL + sqlite-vec)

**Context:** Knowledge chunks need to be stored in both MySQL (for relational queries, recategorization) and sqlite-vec (for fast semantic similarity search). The two databases have different strengths.

**Implementation:**

```typescript
// ingestionWorker.ts — processJob()

// 1. Store in MySQL (assistant_knowledge) — relational access
await db.execute(
  `INSERT INTO assistant_knowledge
    (id, assistant_id, job_id, content, source, source_type, chunk_index, char_count, embedding, created_at)
   VALUES ${valuePlaceholders}`,
  flatValues
);

// 2. Store in sqlite-vec (knowledge_chunks + knowledge_vectors) — semantic search
const vecChunks: ChunkInput[] = chunks.map((chunk, i) => ({
  id: flatValues[i * 10] as string,
  assistantId: job.assistant_id,
  jobId: job.id,
  content: chunk,
  source: job.source,
  sourceType: job.job_type,
  chunkIndex: i,
  charCount: chunk.length,
  embedding: embeddings[i]!,
  createdAt: now
}));
upsertChunks(vecChunks);
```

**Benefits:**
- ✅ MySQL provides relational queries (JOIN with assistants, job status tracking)
- ✅ sqlite-vec provides fast KNN similarity search (essential for RAG)
- ✅ Same chunk IDs in both stores — consistent cross-references
- ✅ sqlite-vec failures are non-fatal (wrapped in try/catch)

**Drawbacks:**
- ❌ Two sources of truth — possible drift if one write fails silently
- ❌ Double storage cost (content duplicated in both databases)
- ❌ No transactional guarantee across MySQL + sqlite-vec
- ❌ No automatic reconciliation mechanism

---

### 2.2 Per-Assistant Knowledge Health Badge Pattern

**Context:** The portal dashboard needs to show knowledge health per assistant, not as a standalone widget. Each assistant card embeds a compact `KnowledgeHealthBadge` that independently fetches its own health data.

**Implementation:**

```tsx
// Dashboard.tsx — each assistant card
{assistants.slice(0, 6).map((a) => (
  <div key={a.id} className="... flex flex-col">
    {/* Header: avatar + name + delete button */}
    {/* Description */}

    {/* Per-assistant health badge — self-fetching */}
    <div className="mb-3 px-1">
      <KnowledgeHealthBadge assistantId={a.id} />
    </div>

    {/* Action buttons pinned to bottom */}
    <div className="flex items-center gap-2 mt-auto">
      <button>Test Chat</button>
      <Link>Edit</Link>
    </div>
  </div>
))}
```

```tsx
// KnowledgeHealthBadge.tsx — self-contained data fetch
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { data: res } = await api.get(`/assistants/${assistantId}/knowledge-health`);
    if (!cancelled && res.success) {
      setData({ score, pagesIndexed, pageLimit, satisfied, total });
    }
  })();
  return () => { cancelled = true; };
}, [assistantId]);
```

**Benefits:**
- ✅ Each badge is independent — no parent state management needed
- ✅ Graceful degradation: returns `null` on error (card renders without badge)
- ✅ Cancel flag prevents state updates on unmounted components
- ✅ Consistent card heights via `flex flex-col` + `mt-auto`

**Drawbacks:**
- ❌ N+1 HTTP requests (one per assistant card) — consider batching for >6 assistants
- ❌ No caching — refetches on every dashboard load
- ❌ Loading skeleton briefly visible for each card independently

---

### 2.3 Delete with Knowledge Base Option Pattern

**Context:** When deleting an assistant, the user may want to keep the knowledge base data (e.g., to re-import into a new assistant) or clear it entirely. This is exposed as a checkbox in the SweetAlert2 confirmation dialog.

**Implementation (Frontend):**

```typescript
// Dashboard.tsx — handleDeleteAssistant()
const { value: clearKnowledge } = await Swal.fire({
  title: `Delete "${assistant.name}"?`,
  html: `
    <p>This assistant will be permanently removed.</p>
    <label>
      <input type="checkbox" id="swal-clear-kb" checked />
      Also delete knowledge base data (sqlite-vec)
    </label>
  `,
  preConfirm: () => {
    const checkbox = document.getElementById('swal-clear-kb') as HTMLInputElement;
    return checkbox?.checked ?? true;   // true = clear KB (default)
  },
});

if (clearKnowledge === undefined) return;  // user cancelled

await api.delete(`/assistants/${assistant.id}?clearKnowledge=${clearKnowledge}`);
```

**Implementation (Backend):**

```typescript
// assistants.ts — DELETE /:assistantId
const clearKnowledge = req.query.clearKnowledge !== 'false';  // default: true

// 1. Delete assistant record
await db.execute('DELETE FROM assistants WHERE id = ?', [assistantId]);

// 2. Clean up ingestion jobs (always)
await db.execute('DELETE FROM ingestion_jobs WHERE assistant_id = ?', [assistantId]);

// 3. Clean up sqlite-vec (only if user opted in)
if (clearKnowledge) {
  deleteVecByAssistant(assistantId);
}

return res.json({ success: true, knowledgeCleared: clearKnowledge });
```

**Benefits:**
- ✅ User controls data retention — "keep KB" enables future re-import
- ✅ Default is `true` (clear KB) — safe default for most users
- ✅ Backend validates with `!== 'false'` — anything else defaults to clear
- ✅ Response includes `knowledgeCleared` flag for frontend messaging
- ✅ Cleanup failures are try/caught — don't block the deletion

**Drawbacks:**
- ❌ Orphaned vectors if `clearKnowledge=false` — no mechanism to re-associate later
- ❌ No bulk delete — each assistant must be deleted individually
- ❌ `ingestion_jobs` always deleted (no option to keep job history)

---

### 2.4 SSE Streaming Chat Pattern

**Context:** Chat responses must stream token-by-token for perceived responsiveness. The backend proxies Ollama's streaming response as Server-Sent Events (SSE).

**Implementation (Backend):**

```typescript
// assistants.ts — POST /chat

// Set SSE headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no');  // disable nginx buffering
res.flushHeaders();

// Stream from Ollama
const ollamaResponse = await axios.post(`${OLLAMA_API}/api/chat`, {
  model: CHAT_MODEL,
  messages,
  stream: true,
  keep_alive: KEEP_ALIVE,
}, { responseType: 'stream' });

ollamaResponse.data.on('data', (chunk: Buffer) => {
  // Parse NDJSON lines from Ollama
  const parsed = JSON.parse(line);
  const token = parsed.message?.content ?? '';
  res.write(`data: ${JSON.stringify({ token })}\n\n`);
});

ollamaResponse.data.on('end', () => {
  res.write(`data: ${JSON.stringify({ done: true, model: CHAT_MODEL })}\n\n`);
  res.end();
});
```

**Implementation (Frontend):**

```typescript
// Dashboard.tsx — sendMessage()
const response = await fetch(`${API_BASE_URL}/assistants/chat`, { method: 'POST', ... });
const reader = response.body?.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Parse SSE lines, accumulate tokens, update message state
  fullText += parsed.token;
  setMessages((prev) => prev.map((m) =>
    m.id === assistantMsgId ? { ...m, content: fullText } : m
  ));
}
```

**Benefits:**
- ✅ First token visible in ~1-2s (vs 10-30s for full response)
- ✅ `X-Accel-Buffering: no` prevents nginx proxy from buffering the stream
- ✅ Line buffer handles partial NDJSON lines from Ollama
- ✅ Tool calls detected after full response assembled, appended as separate SSE event

**Drawbacks:**
- ❌ No reconnection logic on client disconnect
- ❌ 90-second timeout — long responses may be truncated
- ❌ No conversation persistence — history exists only in client state

---

### 2.5 Priority Queue Ingestion Pattern

**Context:** Paid-tier users expect faster ingestion. The background worker always processes paid jobs before free jobs, using SQL-level ordering and row-level locking.

**Implementation:**

```sql
-- Worker dequeue query
SELECT id, assistant_id, job_type, source, file_content, tier, retry_count
FROM ingestion_jobs
WHERE status = 'pending' AND retry_count < 3
ORDER BY
  CASE tier WHEN 'paid' THEN 0 ELSE 1 END ASC,
  created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED
```

**Pipeline:**

```
Enqueue: POST /ingest/url or /ingest/file
  → calculateQueuePosition(tier)  — paid=0, free=count(pending)
  → INSERT with status='pending'

Dequeue: poll() every 6 seconds
  → SELECT ... FOR UPDATE SKIP LOCKED (prevents double-processing)
  → UPDATE status='processing', retry_count++
  → processJob() with 120s timeout
  → On success: status='completed'
  → On failure: status='failed' or status='pending' (if retries remain)
```

**Recovery on startup:**

```typescript
// startIngestionWorker()
// Reset stuck 'processing' jobs from a previous crash
await db.execute(
  `UPDATE ingestion_jobs SET status = 'failed' WHERE status = 'processing' AND retry_count >= 3`
);
await db.execute(
  `UPDATE ingestion_jobs SET status = 'pending' WHERE status = 'processing' AND retry_count < 3`
);
```

**Benefits:**
- ✅ Paid jobs always processed first — clear tier differentiation
- ✅ `FOR UPDATE SKIP LOCKED` prevents double-processing in multi-instance scenarios
- ✅ Automatic retry (up to 3 attempts) handles transient failures
- ✅ Crash recovery resets stuck jobs on worker restart

**Drawbacks:**
- ❌ Single-threaded worker — one job at a time
- ❌ 6-second poll interval means up to 6s latency even for paid jobs
- ❌ `file_content` stored in LONGTEXT — large files bloat the DB until processing

---

### 2.6 OR-Merge Checklist Pattern

**Context:** As content is ingested incrementally (one URL at a time), checklist satisfaction should only grow — once an item is marked satisfied by any ingestion, it should stay satisfied even if later content doesn't mention it.

**Implementation:**

```typescript
// knowledgeCategorizer.ts — mergeChecklist()
const merged = checklist.map((item) => ({
  ...item,
  satisfied: item.satisfied || Boolean(newResults[item.key]),  // OR merge
}));
```

**Contrast with recategorize:**

```typescript
// updateAssistantCategories() — OVERWRITES (not OR-merge)
const updated = checklist.map((item) => ({
  ...item,
  satisfied: Boolean(results[item.key]),  // direct assignment
}));
```

**Benefits:**
- ✅ Incremental ingestion only adds knowledge — never loses it
- ✅ Simple boolean OR — no complex state tracking needed
- ✅ Recategorize provides a "reset and re-evaluate" escape hatch

**Drawbacks:**
- ❌ False positive from LLM categorization is permanent (until recategorize)
- ❌ Deleting content (a URL job) doesn't un-satisfy checklist items
- ❌ No history of which job satisfied which item

---

### 2.7 Personality-to-Temperature Mapping Pattern

**Context:** Different assistant personalities should produce different response styles. This is achieved by mapping personality types to Ollama temperature settings.

**Implementation:**

```typescript
function getTemperatureForPersonality(personality: string): number {
  const temperatures = {
    professional: 0.3,  // More focused and consistent
    friendly: 0.7,      // More creative and varied
    expert: 0.2,        // Very focused and precise
    casual: 0.8         // Most creative and conversational
  };
  return temperatures[personality] || 0.5;
}
```

**Combined with personality instructions:**

```typescript
const systemPrompt = `You are ${name}...
PERSONALITY: ${personality.toUpperCase()}
${getPersonalityInstructions(personality)}`;
// + temperature controls generation randomness
```

**Benefits:**
- ✅ Personality expressed both semantically (instructions) and numerically (temperature)
- ✅ Expert/professional = low temperature → more deterministic/factual
- ✅ Casual/friendly = high temperature → more creative/varied

---

### 2.8 Two-Part Prompt Stitching Pattern ⭐ NEW (v1.4.0)

**Context:** Staff members can customize their assistant's personality ("personality_flare"), but the system needs to enforce hidden behavioral rules ("core_instructions") that staff cannot see or modify. Tools must be injected dynamically by role, never stored in the database.

**Implementation:**

```typescript
// mobileAIProcessor.ts — buildStitchedPrompt()

// 1. Core instructions (hidden from GUI — backend-managed)
const core = assistantData?.core_instructions || roleDefault;

// 2. Identity
const identity = assistantData?.name
  ? `You are ${assistantData.name}...`
  : `You are a ${role} AI assistant...`;

// 3. Personality flare (GUI-editable by staff)
const flare = assistantData?.personality_flare
  || personalityMapping[assistantData?.personality]
  || 'Be helpful and professional.';

// 4. Dynamic tool definitions (injected, never from DB)
const toolPrompt = getMobileToolsSystemPrompt(tools);

// Stitch together
return `${core}\n\n${identity}\n\nCRITICAL INSTRUCTION FOR TONE AND PERSONALITY:\n${flare}\n\n${toolPrompt}`;
```

**Separation of Concerns:**

| Layer | Source | Editable By | Purpose |
|-------|--------|-------------|---------|
| `core_instructions` | DB column | Superadmin only | Behavioral guardrails, safety rules |
| Identity | Derived from name | Staff (via name field) | "You are {name}" prefix |
| `personality_flare` | DB column | Staff via GUI | Tone, style, personality |
| Tool definitions | `mobileTools.ts` | Nobody (code-only) | Available function calls |

**Benefits:**
- ✅ Staff get maximum personality customization without access to system rules
- ✅ Core instructions can enforce "never reveal system internals" etc.
- ✅ Tools are code-controlled — no prompt injection via personality field
- ✅ Fallback chain: DB → legacy column → hardcoded default (never breaks)
- ✅ Per-assistant model override via `preferred_model` column

**Drawbacks:**
- ❌ Two DB columns (`core_instructions` + legacy `personality`) for similar purposes
- ❌ No version history on prompt changes
- ❌ Superadmin must use a separate API endpoint (no GUI for core_instructions yet)

---

### 2.9 External Task Proxy Pattern ⚠️ DEPRECATED (v2.1.0)

> **⚠️ DEPRECATED:** This pattern was replaced in v2.1.0 with the dual-path architecture.
> Task reads now go directly to the local `local_tasks` MySQL table.
> Task writes use `resolveTaskSourceForTools()` → `taskProxyV2()` with source-level
> API keys from `task_sources` (not per-user software tokens).
> See Section 2.9a below for the current pattern.

**Original Context (v1.4.0):** Staff needed to manage tasks from external software portals through voice commands. Tasks were NOT stored locally — all operations were proxied to the external API using per-user tokens from `staff_software_tokens`.

---

### 2.9a Task Dual-Path Pattern ⭐ CURRENT (v2.1.0)

**Context:** Staff manage tasks through 22 AI assistant tools. The system uses a dual-path architecture — local DB reads for speed, external API proxy for writes.

**Implementation:**

```typescript
// mobileActionExecutor.ts

async function resolveTaskSourceForTools(softwareId?: number | null) {
  // Resolves first enabled source with API key from task_sources table
  return db.queryOne(
    `SELECT id, base_url, api_key, software_id, name
     FROM task_sources
     WHERE sync_enabled = 1 AND api_key IS NOT NULL AND api_key != ''
     ORDER BY id ASC LIMIT 1`
  );
}

async function taskProxyV2(baseUrl, path, method, apiKey, body?) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'X-API-Key': apiKey,     // Source-level key (not per-user token)
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

async function resolveLocalTask(taskId: string) {
  // Try local id first, then external_id — flexible lookup
  return db.queryOne('SELECT * FROM local_tasks WHERE id = ? AND task_deleted = 0', [taskId])
    ?? db.queryOne('SELECT * FROM local_tasks WHERE external_id = ? AND task_deleted = 0', [taskId]);
}
```

**Data Flow Paths:**

```
READ:   LLM → execListTasks/execGetTask → local_tasks SQL → formatted response
WRITE:  LLM → execCreateTask/execUpdateTask → taskProxyV2() → external API → sync local
LOCAL:  LLM → execBookmark/execPriority/execTags → UPDATE local_tasks → done
SYNC:   LLM → execSyncTasks → syncAllSources() → fetch + upsert
INVOICE: LLM → execStage → local flag → execProcess → taskProxyV2 → mark billed
```

**Benefits:**
- ✅ Fast reads — local DB, no external dependency
- ✅ Source-level auth — no per-user token management
- ✅ 22 tools — full task lifecycle including workflow, billing, sync
- ✅ Graceful degradation — local changes persist even if external fails
- ✅ Local enhancements — bookmarks, priority, tags, colors never leave the local DB
- ❌ Token stored as plaintext in DB (should encrypt)

---

### 2.10 Staff Max-One-Assistant Pattern ⭐ NEW (v1.4.0)

**Context:** Each staff member should have exactly one personal AI assistant. The system enforces this at the API level.

**Implementation:**

```typescript
// staffAssistant.ts — POST /
const existing = await db.queryOne(
  'SELECT id FROM assistants WHERE userId = ? AND is_staff_agent = 1',
  [userId]
);
if (existing) throw badRequest('You already have a staff assistant.');
```

**Benefits:**
- ✅ Simple DB check — no complex multi-assistant state management
- ✅ `is_staff_agent` flag cleanly separates staff assistants from client assistants in the same table
- ✅ Single assistant simplifies the profile tab UI

**Drawbacks:**
- ❌ No DB-level unique constraint (relies on application logic)
- ❌ Race condition: two concurrent POSTs could create duplicates (mitigated by low concurrency)

---

### 2.11 Vision Tier-Based Routing Pattern ⭐ NEW (v2.0.0)

**Context:** When a user attaches an image, the text-only GLM pipeline must be bypassed entirely in favor of vision-capable models. The routing must still respect the user's tier (free/paid) and fall back gracefully through multiple providers.

**Implementation:**

```typescript
// assistantAIRouter.ts — chatCompletionWithVision()

async function chatCompletionWithVision(
  tier: string,
  messages: VisionChatMessage[],
  opts?: { temperature?: number; max_tokens?: number }
) {
  if (tier === 'paid') {
    // 1. Try OpenRouter with GPT-4o (best quality)
    try {
      const orMessages = buildOpenRouterVisionMessages(messages);
      return await openRouterVisionChat(orMessages, VISION_OPENROUTER_MODEL, opts);
      // provider: 'openrouter'
    } catch (e) { /* fall through */ }

    // 2. Try OpenRouter with Gemini Flash (cost fallback)
    try {
      const orMessages = buildOpenRouterVisionMessages(messages);
      return await openRouterVisionChat(orMessages, VISION_OPENROUTER_FALLBACK, opts);
      // provider: 'openrouter-fallback'
    } catch (e) { /* fall through */ }
  }

  // 3. Ollama qwen2.5vl:7b (free tier or last resort)
  const ollamaMessages = buildOllamaVisionMessages(messages);
  return await ollamaVisionChat(ollamaMessages, VISION_OLLAMA_MODEL, opts);
  // provider: 'ollama-vision'
}
```

**Image Format Conversion:**

```typescript
// OpenRouter: OpenAI content[] array format
function buildOpenRouterVisionMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: m.images?.length
      ? [
          { type: 'text', text: m.content },
          ...m.images.map(img => ({
            type: 'image_url',
            image_url: { url: img }  // data-URI preserved
          }))
        ]
      : m.content
  }));
}

// Ollama: separate images[] field with raw base64
function buildOllamaVisionMessages(messages) {
  return messages.map(m => ({
    role: m.role,
    content: m.content,
    images: m.images?.map(stripDataUri)  // remove 'data:image/png;base64,' prefix
  }));
}
```

**Detection & Routing:**

```typescript
// assistants.ts — POST /chat handler
const hasImage = typeof image === 'string' && image.startsWith('data:image/');
if (hasImage) {
  // Build VisionChatMessage[] with images on last user message
  // Route to chatCompletionStreamWithVision(tier, visionMessages)
} else {
  // Route to chatCompletionStream(tier, messages) — text-only GLM pipeline
}
```

**Benefits:**
- ✅ GLM text-only model cleanly bypassed — no wasted API call
- ✅ Three-level fallback for paid tier: GPT-4o (best) → Gemini Flash (fast/cheap) → Ollama (free/local)
- ✅ Free tier works fully offline with local Ollama vision model
- ✅ Image format automatically converted per provider (data-URI vs raw base64)
- ✅ Same `VisionChatMessage` type used everywhere — single interface for all callers
- ✅ `provider` field in response lets caller select correct stream parser

**Drawbacks:**
- ❌ Images not persisted — re-analysis requires re-upload
- ❌ Base64 encoding increases payload size ~33% (10MB image → ~13.3MB body)
- ❌ Express body limit at 20mb may be tight for very large images
- ❌ Only one image per message supported in current UI (backend supports multiple)

---

## 3. Anti-Patterns & Technical Debt

### 3.1 🟡 N+1 Knowledge Health Requests

**Location:** Dashboard.tsx — each `KnowledgeHealthBadge` fires its own API request.

**Impact:** For 6 assistants, 6 separate HTTP requests + 6 DB queries. Could be a single batch endpoint.

**Recommended Fix:** Add `GET /api/assistants/knowledge-health/batch?ids=a,b,c` that returns health for multiple assistants in one response.

---

### 3.2 🟡 No Per-User Assistant Isolation

**Location:** `assistants.ts` — `GET /` returns ALL assistants, no `userId` filter.

**Impact:** All users see all assistants. The `userId` column exists but isn't used for filtering.

**Recommended Fix:** Add `WHERE userId = ?` using the authenticated user's ID.

---

### 3.3 🟡 Orphaned Vectors on clearKnowledge=false

**Location:** `assistants.ts` DELETE endpoint.

**Impact:** When `clearKnowledge=false`, sqlite-vec chunks reference a deleted `assistant_id`. No mechanism exists to re-associate them with a new assistant.

**Recommended Fix:** Either add a re-import tool or document this as "data is preserved but not retrievable via the API."

---

### 3.4 🟢 Redundant Data Column

**Location:** `assistants` table — `data` JSON column mirrors individual columns.

**Impact:** Two sources of truth per assistant. `parseAssistantRow()` prefers JSON but falls back to columns.

**Recommended Fix:** Remove individual columns and use only JSON, or vice versa.

---

### 3.5 🟢 No Chat Persistence

**Location:** `Dashboard.tsx` — chat messages exist only in React state.

**Impact:** Closing the chat modal or navigating away loses all conversation history.

**Recommended Fix:** Add a `chat_messages` table and persist conversations.

---

### 3.6 🟡 No Ingestion Job Limit per Assistant

**Location:** `assistantIngest.ts` — no check against `pages_indexed` limit before enqueuing.

**Impact:** Free-tier users can enqueue unlimited jobs; the limit is only checked on the health display, not enforced on ingestion.

**Recommended Fix:** Check `pages_indexed >= pageLimit` before INSERT into `ingestion_jobs`.

---

### 3.7 🔴 No Partition-Level Filtering in sqlite-vec

**Location:** `vectorStore.ts` — `search()` function.

**Impact:** The KNN `MATCH` operator scans all vectors across all assistants. The `assistant_id` filter is a post-JOIN filter, meaning the engine may return K candidates that belong to other assistants, reducing effective recall. At scale (many assistants with many chunks each), this degrades retrieval quality.

**Recommended Fix:** Increase `topK` beyond the desired result count (e.g., request 20, filter to 5), or monitor retrieval quality and consider per-assistant vec0 tables when degradation is observed.

> **Deep dive:** [SQLITE_VEC_ARCHITECTURE.md §11](SQLITE_VEC_ARCHITECTURE.md) — Known Limitations.

---

### 3.8 🟡 No Vector Dimensionality Validation

**Location:** `vectorStore.ts` — `upsertChunks()` does not verify `embedding.length === 768`.

**Impact:** A mis-dimensioned vector would silently corrupt the vec0 index. If the embedding model is ever changed without updating `VECTOR_DIM`, all subsequent searches will produce garbage results.

**Recommended Fix:** Add `if (c.embedding.length !== VECTOR_DIM) throw new Error(...)` in the insert loop.

---

### 3.9 🟡 No Backup for vectors.db

**Location:** `/var/opt/backend/data/vectors.db` — not included in any backup rotation.

**Impact:** Loss of this file requires re-ingesting all knowledge sources for all assistants. Re-ingestion is possible (sources are tracked in MySQL `ingestion_jobs`) but time-consuming.

**Recommended Fix:** Add `vectors.db` to the backup script. Checkpoint WAL before copying: `PRAGMA wal_checkpoint(TRUNCATE)`.

---

### 3.10 � ~~Software Tokens Stored as Plaintext~~ — RESOLVED (v2.1.0)

**Location:** `staff_software_tokens.token` column.

**Status:** ~~Risk~~ → **Resolved.** Task tools no longer use per-user software tokens.
API keys are now stored in `task_sources.api_key` (one key per source, admin-managed).
The `staff_software_tokens` table is deprecated and will be dropped in a future migration.
The remaining security note applies only to the legacy SoftwareManagement auth flow
which is also scheduled for removal.

---

### 3.11 🟢 No core_instructions GUI for Superadmins ⭐ NEW (v1.4.0)

**Location:** `staffAssistant.ts` — `POST /core-instructions`.

**Impact:** Superadmins must use the API endpoint directly (curl/Postman) to set core instructions. No admin panel UI exists.

**Recommended Fix:** Add a superadmin panel page for managing staff assistant core instructions.
**Effort:** MEDIUM

---

### 3.12 🟢 Single Software Token per Staff ⭐ NEW (v1.4.0)

**Location:** `mobileActionExecutor.ts` — `getStaffSoftwareToken()` uses `LIMIT 1`.

**Impact:** If a staff member has tokens for multiple software portals, only the first one is used for task proxy. Cannot select which portal to target.

**Recommended Fix:** Add `software_id` parameter to task tools, or allow selecting default software in assistant config.
**Effort:** LOW

---

### 2.11 3-Tier Cascading Chat Routing ⭐ REWRITTEN (v1.9.0)

**Context:** All assistant chat (free and paid) should use the best available provider with graceful degradation. GLM (ZhipuAI) via Anthropic-compatible API is now the primary provider for all tiers (free under Coding Lite plan). OpenRouter is a paid-tier fallback. Ollama is the last resort.

**Fallback Chain:**

```
Free tier:   GLM (glm-4.6) → Ollama (qwen2.5:1.5b-instruct)
Paid tier:   GLM (glm-4.6) → OpenRouter (gpt-4o-mini) → Ollama
```

**Implementation:**

```typescript
// assistantAIRouter.ts — 3-tier cascading fallback

export async function chatCompletion(
  tier: string,
  messages: ChatMessage[],
  opts: ChatOptions = {},
  modelOverride?: string,
): Promise<{ content: string; model: string; provider: PaidProvider }> {
  // 1. GLM (tried first for ALL tiers)
  const glmKey = await getGLMKey();
  if (glmKey) {
    try {
      return await glmChat(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] GLM failed — trying next`);
    }
  }

  // 2. OpenRouter (paid tier only)
  if (tier !== 'paid') return ollamaChat(messages, opts, modelOverride);
  const orKey = await getOpenRouterKey();
  if (orKey) {
    try {
      return await openRouterChat(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] OpenRouter failed — falling back to Ollama`);
    }
  }

  // 3. Ollama (last resort)
  return ollamaChat(messages, opts, modelOverride);
}
```

**GLM Anthropic API Integration:**

```typescript
// GLM uses the Anthropic Messages API (NOT OpenAI-compatible)
function buildGLMBody(messages: ChatMessage[], opts: ChatOptions, stream = false) {
  let system: string | undefined;
  const filtered: { role: string; content: string }[] = [];
  for (const m of messages) {
    if (m.role === 'system') system = m.content;
    else filtered.push({ role: m.role, content: m.content });
  }
  return {
    model: GLM_MODEL,           // 'glm-4.6'
    max_tokens: opts.max_tokens ?? 2048,
    messages: filtered,
    ...(system && { system }),  // Top-level system field (Anthropic format)
    ...(stream && { stream: true }),
  };
}

// GLM request
const res = await fetch('https://api.z.ai/api/anthropic/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(buildGLMBody(messages, opts)),
});
// Response: { content: [{ type: 'text', text: '...' }] }
```

**3-Format Stream Parsing (caller side — assistants.ts):**

```typescript
// The `provider` field tells the caller which parser to use:
const { stream, provider } = await chatCompletionStream(tier, messages, opts);

if (provider === 'glm') {
  // Anthropic SSE: event: content_block_delta\ndata: {"delta":{"text":"token"}}
  token = parsed.delta?.text ?? '';
} else if (provider === 'openrouter') {
  // OpenAI SSE: data: {"choices":[{"delta":{"content":"token"}}]}
  token = parsed.choices?.[0]?.delta?.content ?? '';
} else {
  // Ollama NDJSON: {"message":{"content":"token"},"done":false}
  token = parsed.message?.content ?? '';
}
```

**Routing Matrix:**

| Caller | Tier | Step 1 | Step 2 | Step 3 |
|--------|------|--------|--------|--------|
| Portal chat (`assistants.ts`) | free | GLM (Anthropic SSE) | — | Ollama (NDJSON) |
| Portal chat (`assistants.ts`) | paid | GLM (Anthropic SSE) | OpenRouter (OpenAI SSE) | Ollama (NDJSON) |
| Mobile intent | free | GLM (non-stream) | — | Ollama |
| Mobile intent | paid | GLM (non-stream) | OpenRouter | Ollama |
| Widget chat | paid | GLM (non-stream) | OpenRouter | Ollama |
| Ingestion cleaning | paid | GLM (non-stream) | OpenRouter | Ollama |

**API Key Sources:**

| Provider | Vault Key | Env Fallback | Cached |
|----------|-----------|-------------|--------|
| GLM | `service_name='GLM'` | `env.GLM` | `_glmKey` (module-level) |
| OpenRouter | `service_name='OPENROUTER'` | — | `_openRouterKey` (module-level) |

**Benefits:**
- ✅ GLM is free under Coding Lite plan — no cost for primary provider
- ✅ 3-tier cascade — always reaches a working provider
- ✅ Each failure is caught and logged, then falls through silently
- ✅ Both keys cached after first vault lookup — no repeated vault calls
- ✅ `modelOverride` preserved for Ollama step (staff `preferred_model`)
- ✅ Same pattern used by both `assistantAIRouter.ts` and `ingestionAIRouter.ts`

**Drawbacks:**
- ❌ Callers must handle three different stream formats (Anthropic SSE, OpenAI SSE, Ollama NDJSON)
- ❌ No circuit breaker — if GLM is slow/down, every request waits for timeout before OpenRouter
- ❌ Cached keys never invalidated (module-level variables, reset on process restart)

---

## 4. UI Patterns ⭐ NEW (v1.6.0)

### 4.1 Capabilities Awareness Panel Pattern

**Context:** Both clients and staff need to understand what their AI assistant can do, without cluttering the primary view.

**Implementation (client — AssistantsPage.tsx):**

```tsx
// Static capability definitions
const CAPABILITIES = [
  { icon: ChatBubbleLeftRightIcon, title: 'AI-Powered Chat', desc: '...', color: 'text-blue-600 bg-blue-50' },
  // ... 5 more
];

// Toggle button in header
<button onClick={() => setShowCapabilities(!showCapabilities)}>
  What Can My Assistant Do?
  {showCapabilities ? <ChevronUpIcon /> : <ChevronDownIcon />}
</button>

// Collapsible panel
{showCapabilities && (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {CAPABILITIES.map(cap => <CapabilityTile {...cap} />)}
  </div>
)}
```

**Implementation (staff — Profile.tsx StaffAssistantTab):**

```tsx
// Tool category definitions with color coding
const STAFF_TOOL_CATEGORIES = [
  { name: 'Task Management', icon: ClipboardDocumentListIcon,
    color: 'bg-blue-500', lightColor: 'bg-blue-50 text-blue-700 ring-blue-200',
    tools: ['List Tasks', 'Create Task', 'Update Task', 'Add Comments'],
    description: 'Create, track, and manage work tasks' },
  // ... 9 more categories
];

// Collapsible panel with category grid
{showCapabilities && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {STAFF_TOOL_CATEGORIES.map(cat => (
      <div>
        <cat.icon /> {cat.name}
        {cat.tools.map(t => <span className={cat.lightColor}>{t}</span>)}
      </div>
    ))}
  </div>
)}
```

**Benefits:**
- ✅ Zero API calls — all capability data is static/hardcoded
- ✅ Collapsible by default — doesn't overwhelm the primary view
- ✅ Color-coded categories provide visual grouping
- ✅ Same pattern works for both client (6 capabilities) and staff (10 categories, 41 tools)

**Drawbacks:**
- ❌ Capability list is hardcoded — adding tools to `mobileTools.ts` requires manual STAFF_TOOL_CATEGORIES update
- ❌ No dynamic discovery from backend — future enhancement to fetch from API

---

### 4.2 Card-Based Picker Pattern (replacing dropdowns)

**Context:** Personality and voice style are limited-option selections (4 choices each). Dropdowns hide the options; cards show all choices with descriptions.

**Implementation:**

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {PERSONALITY_OPTIONS.map(opt => (
    <button
      type="button"
      onClick={() => handleInputChange('personality', opt.value)}
      className={`p-3 rounded-xl border-2 text-left transition-all ${
        formData.personality === opt.value
          ? 'border-picton-blue bg-picton-blue/5 ring-2 ring-picton-blue/20'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <p className="text-sm font-semibold">{opt.label}</p>
      <p className="text-xs text-gray-500">{opt.desc}</p>
    </button>
  ))}
</div>
```

**Benefits:**
- ✅ All options visible at once — no click-to-open required
- ✅ Descriptions visible inline (dropdowns truncate or hide descriptions)
- ✅ Better touch targets for mobile/tablet users
- ✅ Visual feedback with ring highlight on selection

**Used for:** Personality (4 options), Voice Style (4 options)

---

### 4.3 Section-Grouped Form Pattern

**Context:** The staff assistant form has 8+ fields that become overwhelming as a flat list. Grouping by purpose improves scannability.

**Implementation:**

```tsx
{/* Section divider with icon */}
<div className="flex items-center gap-2 mb-4">
  <UserIcon className="h-4 w-4 text-picton-blue" />
  <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
  <div className="flex-1 h-px bg-gray-100" />
</div>

{/* Fields for this section */}
<div className="space-y-4">
  {/* Name, Description, Primary Goal */}
</div>
```

**Sections:**
1. **Identity** (UserIcon, blue) — Name, Description, Primary Goal
2. **Personality & Voice** (ChatBubbleIcon, purple) — Personality cards, Voice cards, Flare textarea
3. **Greeting & Model** (CogIcon, emerald) — Custom Greeting, Preferred Model

**Benefits:**
- ✅ Visual hierarchy — users can scan section headers to find what they need
- ✅ Icon + color coding provides context without reading
- ✅ Horizontal rule (`h-px bg-gray-100`) visually separates sections

---

### 4.4 Dark Gradient Hero Pattern

**Context:** Empty states and view mode headers need visual distinction from the white content sections below.

**Implementation:**

```tsx
<div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl p-8">
  {/* Dot pattern overlay */}
  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,...')] opacity-50" />
  <div className="relative text-center">
    <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center mb-5 shadow-lg shadow-picton-blue/25">
      <SparklesIcon className="h-10 w-10 text-white" />
    </div>
    <h3 className="text-2xl font-bold text-white">...</h3>
    <button className="bg-white text-slate-900 rounded-xl">Get Started</button>
  </div>
</div>
```

**Benefits:**
- ✅ Matches the existing Profile page gradient header (`bg-gradient-to-r from-picton-blue to-picton-blue/80`)
- ✅ Dot pattern SVG overlay adds depth without image dependencies
- ✅ White CTA button creates strong contrast on dark background
- ✅ Shadow on icon (`shadow-picton-blue/25`) creates depth illusion

**Used in:** Staff empty state, Staff view mode header, Client empty state
