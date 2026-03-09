# sqlite-vec Knowledge Base — Architecture & Wiring

**Implemented:** March 2, 2026  
**Status:** Production  
**Vector Dimensions:** 768 (nomic-embed-text)  
**Database:** `/var/opt/backend/data/vectors.db`

---

## Overview

All assistant knowledge is stored in **sqlite-vec** for fast semantic similarity search (RAG retrieval). When a user chats with an assistant, their question is embedded and matched against indexed knowledge chunks to provide accurate, context-aware answers.

## Data Flow

```
URL/File → Ingestion Worker → Ollama Embed → sqlite-vec + MySQL
                                                    ↓
User Question → Ollama Embed → sqlite-vec KNN Search → Top-5 Chunks → System Prompt → LLM → Response
```

## File Map

| File | Role |
|---|---|
| `src/services/vectorStore.ts` | sqlite-vec service layer (singleton DB, upsert, search, delete) |
| `src/services/ingestionWorker.ts` | Background worker — fetches, chunks, embeds, stores in sqlite-vec |
| `src/services/ingestionWorkerProcess.ts` | Worker entry point (forked as child process) |
| `src/routes/assistants.ts` | Chat endpoint — embeds user query, searches sqlite-vec, injects context |
| `src/routes/assistantIngest.ts` | REST API for submitting URLs/files + deleting jobs (syncs sqlite-vec) |
| `src/services/knowledgeCategorizer.ts` | AI categorisation of content for Knowledge Health Score |
| `src/config/personaTemplates.ts` | Business-type templates defining knowledge categories |
| `src/index.ts` | Spawns ingestion worker as isolated child process |

## vectorStore.ts — Core Service

Singleton `better-sqlite3` connection with `sqlite-vec` extension loaded.

### Tables

```sql
-- Chunk metadata (text content, source, assistant mapping)
CREATE TABLE knowledge_chunks (
  id            TEXT PRIMARY KEY,    -- UUID
  assistant_id  TEXT NOT NULL,
  job_id        TEXT NOT NULL,
  content       TEXT NOT NULL,
  source        TEXT,                -- URL or filename
  source_type   TEXT NOT NULL,       -- 'url' | 'file'
  chunk_index   INTEGER NOT NULL,
  char_count    INTEGER NOT NULL,
  created_at    TEXT NOT NULL
);

-- Virtual vector table for KNN search
CREATE VIRTUAL TABLE knowledge_vectors USING vec0(
  chunk_id TEXT PRIMARY KEY,         -- maps to knowledge_chunks.id
  embedding float[768]               -- nomic-embed-text dimensions
);
```

### API

```typescript
// Store embedded chunks (called by ingestion worker)
upsertChunks(chunks: ChunkInput[]): void

// Semantic search — returns top-K nearest chunks for an assistant
search(assistantId: string, queryEmbedding: number[], topK?: number):
  { id, content, source, distance }[]

// Delete vectors when a job is removed
deleteByJob(jobId: string): number

// Delete all vectors when an assistant is deleted
deleteByAssistant(assistantId: string): number

// Stats for an assistant's vector store
stats(assistantId: string): { totalChunks, sources[] }

// Clean shutdown
close(): void
```

### Embedding Format

sqlite-vec expects raw `Float32Array` buffers:
```typescript
const buf = new Float32Array(embedding).buffer;
insertVec.run(chunkId, Buffer.from(buf));
```

### Search (KNN)

```sql
SELECT kv.chunk_id, kv.distance, kc.content, kc.source
FROM knowledge_vectors kv
JOIN knowledge_chunks kc ON kc.id = kv.chunk_id
WHERE kv.embedding MATCH ?          -- query vector as Float32 buffer
  AND kc.assistant_id = ?           -- scope to one assistant
  AND k = ?                         -- top-K results
ORDER BY kv.distance ASC            -- lower distance = more similar
```

---

## Ingestion Pipeline

### Worker Lifecycle (`src/index.ts`)

```
Express server starts
  └─ fork('ingestionWorkerProcess.ts', { maxOldSpace: 1024MB })
       └─ polls ingestion_jobs every 6s
       └─ on crash: auto-restart after 5s
```

The worker runs in a **separate V8 heap** so cheerio DOM parsing and embedding buffers don't affect the Express server.

### Processing Steps (`ingestionWorker.ts`)

```
1. Poll MySQL for next pending job (paid-first priority, retry < 3)
2. Mark job as 'processing', bump retry_count
3. Fetch content:
   - URL job → HTTP GET + cheerio text extraction (max 100KB HTML)
   - File job → read file_content column
4. Cap at 15,000 chars to limit chunk count
5. AI cleaning (paid tier only — OpenRouter; free tier skips)
6. Chunk text (~1,200 chars, 200 char overlap, sentence boundaries)
7. Embed each chunk sequentially via Ollama nomic-embed-text
8. Bulk INSERT into MySQL assistant_knowledge (backward compat)
9. Upsert into sqlite-vec via vectorStore.upsertChunks()
10. Sync pages_indexed = COUNT(completed jobs)
11. Categorise content for Knowledge Health Score
12. Mark job 'completed'
```

### Retry Logic

- `MAX_RETRIES = 3` — after 3 failed attempts, job is marked permanently failed
- `retry_count` column tracks attempts
- On crash, recovery query resets `processing` jobs back to `pending` (if under retry limit)
- Jobs exceeding retry limit during recovery are marked `failed`

### Memory Guards

| Limit | Value | Purpose |
|---|---|---|
| Worker heap | 1,024 MB | Isolated child process |
| HTML input | 100 KB | Prevents cheerio OOM on huge DOMs |
| Content cap | 15,000 chars | Keeps chunk count ≤ ~25 |
| Chunk size | 1,200 chars | Balance between context and embedding quality |
| Chunk overlap | 200 chars | Continuity across boundaries |
| HTTP timeout | 20s | Prevents hanging on slow sites |
| Embed timeout | 30s | Prevents blocking on Ollama |

---

## RAG in Assistant Chat (`src/routes/assistants.ts`)

### Flow

```
POST /api/assistants/chat
  ├─ 1. Parse request (assistantId, message, conversationHistory)
  ├─ 2. Load assistant config from MySQL
  ├─ 3. Embed user message → Ollama nomic-embed-text (768-dim)
  ├─ 4. vectorSearch(assistantId, queryEmbedding, topK=5)
  │     └─ Returns up to 5 most relevant chunks from sqlite-vec
  ├─ 5. Build system prompt:
  │     ├─ Business context (name, type, description, goal)
  │     ├─ Personality instructions
  │     ├─ KNOWLEDGE BASE section (RAG context from step 4)
  │     └─ Tool system prompt (action router)
  ├─ 6. Stream response from Ollama via SSE
  └─ 7. Check for tool calls in response
```

### Knowledge Injection

```typescript
// Injected into system prompt when RAG results are found:
KNOWLEDGE BASE (use this information to answer accurately):
[Source 1: https://example.com/pricing]
Our pricing starts at R299/month for the Starter package...

[Source 2: https://example.com/about]
We are a South African software company founded in 2020...
```

### Non-Fatal RAG

If embedding or search fails, the chat still works — it just responds without knowledge context. Error is logged but doesn't interrupt the conversation.

---

## Deletion Sync

Both sqlite-vec and MySQL stay in sync:

| Action | MySQL | sqlite-vec |
|---|---|---|
| Job deleted (`DELETE /ingest/job/:jobId`) | `DELETE FROM assistant_knowledge WHERE job_id = ?` | `deleteByJob(jobId)` |
| Assistant deleted (`DELETE /assistants/:id`) | Cascade from `assistants` table | `deleteByAssistant(assistantId)` |

---

## Dual Storage (MySQL + sqlite-vec)

Knowledge is stored in **both** systems:

| Store | Table | Purpose |
|---|---|---|
| MySQL | `assistant_knowledge` | Metadata, admin queries, backward compatibility |
| MySQL | `ingestion_jobs` | Job queue, status tracking, pages_indexed |
| sqlite-vec | `knowledge_chunks` | Chunk text + metadata |
| sqlite-vec | `knowledge_vectors` | 768-dim float32 vectors for KNN search |

**Why both?** MySQL handles job management, status queries, and admin dashboards. sqlite-vec handles the vector search that MySQL can't do efficiently. The ingestion worker writes to both atomically.

---

## API Endpoints

### Ingestion

```
POST   /api/assistants/:id/ingest/url     { url, tier }
POST   /api/assistants/:id/ingest/file    FormData(file, tier)
GET    /api/assistants/:id/ingest/status   → jobs list + pages_indexed
DELETE /api/assistants/:id/ingest/job/:jobId
```

### Chat (with RAG)

```
POST   /api/assistants/chat    { assistantId, message, conversationHistory }
       → SSE stream: data: {"token": "..."} ... data: {"done": true}
```

### Knowledge Health

```
GET    /api/assistants/:id/knowledge-health
       → { score, checklist[], missing[], recommendations[], pagesIndexed, tier }
```

---

## Configuration

| Env Var | Default | Used By |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Embedding + chat LLM |
| `ASSISTANT_OLLAMA_MODEL` | `qwen2.5:3b-instruct` | Chat model |
| `OLLAMA_KEEP_ALIVE` | `-1` (pinned) | Model memory management |

Embedding model (`nomic-embed-text`) is hardcoded — it must stay consistent across ingest and search.

---

## Database Location

```
/var/opt/backend/data/vectors.db        ← main database
/var/opt/backend/data/vectors.db-wal    ← write-ahead log (WAL mode)
/var/opt/backend/data/vectors.db-shm    ← shared memory for WAL
```

WAL mode enables concurrent reads during writes. `busy_timeout = 5000ms` handles lock contention.
