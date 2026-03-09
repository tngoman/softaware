# Assistants Module — sqlite-vec Vector Architecture Deep Dive

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Why sqlite-vec Exists

### The Problem

The platform's first embedding system (`embeddingService.ts`) stores vectors as JSON strings in MySQL's `document_embeddings` table. Similarity search requires:

1. Load **all** embeddings for a client into Node.js memory
2. `JSON.parse()` each row's embedding (768 floats as a string → `number[]`)
3. Compute cosine similarity in a JavaScript loop: `O(n × d)` per query (n = rows, d = 768)
4. Sort all results, take top-K

This is `O(n)` full-table scan — acceptable for the Widget system (~100 documents per client), but unusable for the Assistants knowledge base where a single assistant may accumulate thousands of chunks across dozens of ingested URLs.

### The Solution

sqlite-vec provides a `vec0` virtual table with native KNN (K-Nearest-Neighbour) indexing. The MATCH operator performs similarity search at the storage engine level — no JavaScript loop, no JSON parsing, no full-table scan.

| Metric | embeddingService.ts (Widget) | vectorStore.ts (Assistants) |
|--------|------------------------------|----------------------------|
| Storage | MySQL `document_embeddings.embedding` JSON | sqlite-vec `knowledge_vectors.embedding` float[768] |
| Search | JS cosine similarity loop | SQL `MATCH` + `k` (KNN operator) |
| Complexity | O(n × d) per query | O(log n) approximate |
| Parse overhead | `JSON.parse()` per row | Zero (native float32 buffer) |
| Distance metric | Cosine similarity (JS) | L2 / Euclidean (native) |
| Filtering | `WHERE dm.client_id = ?` in SQL, then JS sort | `JOIN knowledge_chunks` + `WHERE assistant_id` |
| Max practical scale | ~500 documents | ~100,000+ chunks |

---

## 2. Architecture Overview

```
                    ┌──────────────────────────────────────────┐
                    │         Ingestion Worker (6s poll)        │
                    │                                          │
                    │  URL/File → AI Clean → Chunk → Embed     │
                    │                  │                        │
                    │          nomic-embed-text                 │
                    │          (Ollama, 768-dim)                │
                    │                  │                        │
                    │         ┌────────┴────────┐              │
                    │         ▼                  ▼              │
                    │   ┌──────────┐    ┌──────────────┐       │
                    │   │  MySQL   │    │  sqlite-vec   │       │
                    │   │ (legacy) │    │  (primary)    │       │
                    │   └──────────┘    └──────────────┘       │
                    └──────────────────────────────────────────┘

┌───────────────────────────────┐    ┌───────────────────────────────┐
│   MySQL: assistant_knowledge  │    │  sqlite-vec: vectors.db       │
│                               │    │                               │
│  id             VARCHAR(36)   │    │  knowledge_chunks             │
│  assistant_id   VARCHAR(255)  │    │  ├── id          TEXT PK      │
│  job_id         VARCHAR(36)   │    │  ├── assistant_id TEXT         │
│  content        TEXT          │    │  ├── job_id      TEXT         │
│  embedding      JSON ←─ slow │    │  ├── content     TEXT         │
│  ...                          │    │  └── ...                      │
│                               │    │                               │
│  Used by: recategorize only   │    │  knowledge_vectors (vec0)     │
│  Search: NOT used             │    │  ├── chunk_id    TEXT PK      │
│                               │    │  └── embedding   float[768]   │
│                               │    │                               │
│                               │    │  Used by: RAG chat search     │
│                               │    │  Search: KNN via MATCH        │
└───────────────────────────────┘    └───────────────────────────────┘
              │                                     │
              │  Reads (recategorize)                │  Reads (RAG chat)
              ▼                                     ▼
    knowledgeCategorizer.ts              assistants.ts POST /chat
    └── reads top 50 chunks              └── search(assistantId, embedding, 5)
        from MySQL (content only)            └── KNN → top 5 chunks → system prompt
```

---

## 3. sqlite-vec Internals

### 3.1 Database File

| Property | Value |
|----------|-------|
| Path | `/var/opt/backend/data/vectors.db` |
| Engine | SQLite 3 via `better-sqlite3` |
| Extension | `sqlite-vec` (loaded at runtime) |
| Journal mode | WAL (Write-Ahead Logging) |
| Busy timeout | 5000ms |
| Access pattern | Singleton — one `Database` instance, reused across all requests |

**WAL mode** enables concurrent reads during a write transaction. This is critical because the ingestion worker writes chunks while the chat endpoint simultaneously reads for RAG retrieval. Without WAL, readers would block on the writer's lock.

**Busy timeout** (5s) handles the rare case where both the ingestion write transaction and a search query contend for the same page. The reader waits up to 5 seconds instead of failing immediately.

### 3.2 Table Schema

**`knowledge_chunks`** — Relational metadata (standard SQLite table):

```sql
CREATE TABLE knowledge_chunks (
  id            TEXT PRIMARY KEY,     -- UUID (matches MySQL assistant_knowledge.id)
  assistant_id  TEXT NOT NULL,        -- parent assistant
  job_id        TEXT NOT NULL,        -- parent ingestion job
  content       TEXT NOT NULL,        -- chunk text (for RAG context injection)
  source        TEXT,                 -- URL or filename
  source_type   TEXT NOT NULL,        -- 'url' or 'file'
  chunk_index   INTEGER DEFAULT 0,   -- position within source
  char_count    INTEGER DEFAULT 0,   -- character count
  created_at    TEXT NOT NULL         -- ISO datetime string
);

CREATE INDEX idx_kc_assistant ON knowledge_chunks(assistant_id);
CREATE INDEX idx_kc_job       ON knowledge_chunks(job_id);
```

**`knowledge_vectors`** — vec0 virtual table (sqlite-vec KNN index):

```sql
CREATE VIRTUAL TABLE knowledge_vectors
USING vec0(
  chunk_id   TEXT PRIMARY KEY,        -- matches knowledge_chunks.id
  embedding  float[768]               -- 768-dim float32 vector
);
```

The `vec0` module is sqlite-vec's virtual table implementation. It stores vectors in a specialized on-disk format optimized for approximate nearest-neighbour search, **not** as regular SQLite rows. The `float[768]` declaration tells vec0 to allocate exactly `768 × 4 = 3072 bytes` per vector.

### 3.3 Vector Encoding

Embeddings flow through the system as JavaScript `number[]` arrays (64-bit IEEE 754 doubles). Before storage, they're converted to raw float32 buffers:

```typescript
// Write path (upsertChunks)
const buf = new Float32Array(embedding).buffer;   // number[] → ArrayBuffer (768 × 4 bytes)
insertVec.run(chunkId, Buffer.from(buf));          // Node Buffer wraps the ArrayBuffer

// Read path (search)
const buf = new Float32Array(queryEmbedding).buffer;
const rows = stmt.all(Buffer.from(buf), assistantId, topK);
```

**Precision loss:** Converting from float64 to float32 truncates each dimension from ~15 decimal digits to ~7. For normalized embeddings this is negligible — the KNN ordering is preserved.

### 3.4 KNN Search Query

```sql
SELECT
  kv.chunk_id,
  kv.distance,
  kc.content,
  kc.source
FROM knowledge_vectors kv
JOIN knowledge_chunks kc ON kc.id = kv.chunk_id
WHERE kv.embedding MATCH ?        -- float32 buffer of query embedding
  AND kc.assistant_id = ?          -- filter to specific assistant
  AND k = ?                        -- top-K results
ORDER BY kv.distance ASC
```

**How this works:**

1. **`MATCH ?`** — sqlite-vec's KNN operator. Accepts a raw float32 buffer and returns the K nearest vectors by L2 (Euclidean) distance.
2. **`k = ?`** — Not a column filter. This is vec0 syntax that tells the engine how many neighbours to return.
3. **`JOIN knowledge_chunks`** — Fetches the text content and metadata for each matched vector.
4. **`WHERE kc.assistant_id = ?`** — Post-filter to isolate vectors belonging to one assistant. Since vec0 doesn't support partitioned indexes, all assistants' vectors live in one flat index and the assistant filter is applied _after_ KNN retrieval.
5. **`ORDER BY kv.distance ASC`** — L2 distance: lower = more similar. 0 = identical.

**Important:** The assistant_id filter is a post-filter on the JOIN, not a pre-filter on the vector scan. This means vec0 may retrieve K candidates that belong to _other_ assistants, then the JOIN discards them. For a small number of assistants with similar chunk counts, this works fine. At scale (1000+ assistants), the effective recall degrades because many of the K candidates may be filtered out.

### 3.5 Distance Metric

sqlite-vec's `vec0` uses **L2 (Euclidean) distance** by default:

$$d(\mathbf{a}, \mathbf{b}) = \sqrt{\sum_{i=1}^{768} (a_i - b_i)^2}$$

For unit-normalized embeddings (which `nomic-embed-text` produces), L2 distance and cosine distance are monotonically related:

$$d_{L2}^2 = 2(1 - \cos\theta)$$

This means the KNN ranking by L2 is identical to ranking by cosine similarity — no re-ranking needed.

---

## 4. Embedding Pipeline

### 4.1 Model: nomic-embed-text

| Property | Value |
|----------|-------|
| Model | `nomic-embed-text` |
| Provider | Ollama (local) |
| Dimensions | 768 |
| Type | float32 (stored), float64 (in JS) |
| API | `POST /api/embeddings { model, prompt }` |
| Timeout | 30s per chunk |
| Used by | Both ingestion (write) and chat (query) |

Both tiers (free and paid) use the **same** embedding model. This is critical: vectors must be comparable. The AI content cleaning differs by tier (paid → OpenRouter, free → Ollama), but the embedding step is always local Ollama `nomic-embed-text`.

### 4.2 Embedding Flow

```
                                    nomic-embed-text
                                    (Ollama, local)
                                         │
            ┌────────────────────────────┤
            │                            │
      Write Path                   Read Path
   (ingestion worker)            (chat endpoint)
            │                            │
    for each chunk:              embed user query:
    embedding = await              embedding = await
      embedText(chunk)               embedText(message)
            │                            │
    Float32Array(embedding)      Float32Array(embedding)
      .buffer → Buffer             .buffer → Buffer
            │                            │
    INSERT OR REPLACE             MATCH ? AND k = 5
    INTO knowledge_vectors        FROM knowledge_vectors
            │                            │
    upsertChunks()                search()
```

### 4.3 Chunking Strategy

Before embedding, content is split into overlapping chunks:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Chunk size | 1,200 chars | Balances context per chunk vs embedding count |
| Overlap | 200 chars | Ensures cross-chunk concepts aren't lost at boundaries |
| Boundary | Sentence-aware | Cuts at last `.` `?` `!` after 60% of chunk size |
| Min length | 40 chars | Drops trivially short chunks |
| Max content | 15,000 chars | Caps per-job to ~12–15 chunks (prevents OOM) |

**Sentence-boundary logic:**

```typescript
if (end < text.length) {
  const last = Math.max(
    chunk.lastIndexOf('.'),
    chunk.lastIndexOf('?'),
    chunk.lastIndexOf('!')
  );
  if (last > CHUNK_SIZE * 0.6) chunk = chunk.slice(0, last + 1);
}
```

This prefers to end chunks at natural sentence boundaries rather than mid-word, improving embedding quality and RAG coherence.

---

## 5. Dual-Storage Write Path

The ingestion worker writes every chunk to **two** databases in sequence:

```
Step 5:  MySQL INSERT (assistant_knowledge)     ← relational store
Step 5b: sqlite-vec upsertChunks()              ← vector store
```

### 5.1 MySQL Write (Step 5)

```typescript
await db.execute(
  `INSERT INTO assistant_knowledge
    (id, assistant_id, job_id, content, source, source_type,
     chunk_index, char_count, embedding, created_at)
   VALUES ${valuePlaceholders}`,
  flatValues
);
```

- Embedding stored as `JSON.stringify(embedding)` — a 768-element JSON array in a TEXT column
- **Used for:** Recategorization only (`updateAssistantCategories()` reads top 50 chunks)
- **NOT used for:** RAG search (too slow for JSON-parse + cosine loop)

### 5.2 sqlite-vec Write (Step 5b)

```typescript
const vecChunks: ChunkInput[] = [];
chunks.forEach((chunk, i) => {
  if (embeddings[i]) {          // skip chunks whose embedding failed
    vecChunks.push({
      id: flatValues[i * 10],   // same UUID as MySQL row
      assistantId: job.assistant_id,
      jobId: job.id,
      content: chunk,
      source: job.source,
      sourceType: job.job_type,
      chunkIndex: i,
      charCount: chunk.length,
      embedding: embeddings[i]!,
      createdAt: now
    });
  }
});

if (vecChunks.length > 0) {
  try {
    upsertChunks(vecChunks);
  } catch (vecErr) {
    console.warn('[Worker] sqlite-vec upsert failed (non-fatal):', (vecErr as Error).message);
  }
}
```

**Key design decisions:**

1. **Same UUIDs** — Chunk IDs are identical in both stores, enabling cross-reference
2. **Embedding failures skipped** — If `embedText()` fails for a chunk, it's stored in MySQL (with `null` embedding) but NOT in sqlite-vec (no point storing a chunk without a vector)
3. **sqlite-vec failures are non-fatal** — Wrapped in try/catch. MySQL is considered the authoritative store; sqlite-vec is an acceleration layer
4. **Transaction semantics** — `upsertChunks()` internally wraps all INSERTs in a sqlite transaction (atomic within sqlite-vec), but there is no cross-database transaction guarantee between MySQL and sqlite-vec

### 5.3 Drift Risk

Since the two writes are independent and the sqlite-vec write is non-fatal:

| Scenario | MySQL | sqlite-vec | Impact |
|----------|-------|------------|--------|
| Both succeed | ✅ Full data | ✅ Full data | Normal operation |
| sqlite-vec write fails | ✅ Full data | ❌ Missing chunks | RAG search returns fewer results; recategorization unaffected |
| MySQL write fails | ❌ Job fails | ❌ Not attempted | Worker retries (up to 3×); no partial state |
| Embedding fails for 1 chunk | ✅ null embedding | ❌ Chunk skipped | MySQL has the content (no vector); sqlite-vec doesn't |

**Reconciliation:** There is no automatic reconciliation. If drift is suspected, re-ingesting the source (delete job + re-add URL) will rebuild both stores from scratch.

---

## 6. Read Paths

### 6.1 RAG Chat (sqlite-vec) — Primary Search Path

```typescript
// assistants.ts — POST /chat

// 1. Embed user query
const queryEmbedding = await embedText(message);

// 2. KNN search in sqlite-vec
const results = search(assistantId, queryEmbedding, 5);

// 3. Inject into system prompt
const knowledgeSection = results.map(r =>
  `[Source: ${r.source}]\n${r.content}`
).join('\n\n---\n\n');

const systemPrompt = `...
KNOWLEDGE BASE:
${knowledgeSection}
...`;

// 4. Stream Ollama response
```

**Latency breakdown:**
- Embedding: ~100–300ms (local Ollama, GPU if available)
- sqlite-vec KNN: ~1–5ms (in-process, no network)
- System prompt build: <1ms
- Ollama first token: ~500–2000ms (model dependent)

### 6.2 Recategorization (MySQL) — Secondary Read Path

```typescript
// knowledgeCategorizer.ts — updateAssistantCategories()

const chunks = await db.query<{ content: string }>(
  `SELECT content FROM assistant_knowledge
   WHERE assistant_id = ?
   ORDER BY created_at DESC
   LIMIT 50`,
  [assistantId]
);

const combined = chunks.map(c => c.content).join('\n---\n');
const results = await categorizeContent(combined, checklist);
```

**Why MySQL, not sqlite-vec?** Recategorization only needs text content (not vectors). The MySQL query is a simple indexed lookup by `assistant_id` — no vector operation needed. Reading from sqlite-vec would work equally well but would require importing `vectorStore.ts` into the categorizer, tightening the coupling.

### 6.3 Stats (sqlite-vec)

```typescript
// vectorStore.ts — stats()

const total = db.prepare(
  `SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE assistant_id = ?`
).get(assistantId);

const sources = db.prepare(`
  SELECT source, COUNT(*) as chunk_count
  FROM knowledge_chunks WHERE assistant_id = ?
  GROUP BY source
`).all(assistantId);
```

Used by the knowledge health endpoint to report chunk counts and source breakdowns.

---

## 7. Delete Paths

### 7.1 Delete by Job

When a user removes a specific ingestion source:

```typescript
export function deleteByJob(jobId: string): number {
  const db = getDb();
  const ids = db.prepare(
    `SELECT id FROM knowledge_chunks WHERE job_id = ?`
  ).all(jobId);

  const tx = db.transaction(() => {
    for (const { id } of ids) {
      deleteVec.run(id);      // DELETE FROM knowledge_vectors WHERE chunk_id = ?
      deleteChunk.run(id);    // DELETE FROM knowledge_chunks WHERE id = ?
    }
  });

  tx();
  return ids.length;
}
```

**Note:** Deletion iterates chunk-by-chunk in a transaction because `knowledge_vectors` is a virtual table — you can't `DELETE ... WHERE chunk_id IN (SELECT ...)` on vec0 tables. Each vector must be deleted individually by primary key.

### 7.2 Delete by Assistant

When an assistant is deleted with `clearKnowledge=true`:

```typescript
export function deleteByAssistant(assistantId: string): number {
  const db = getDb();
  const ids = db.prepare(
    `SELECT id FROM knowledge_chunks WHERE assistant_id = ?`
  ).all(assistantId);

  // Same per-chunk iteration pattern as deleteByJob
  const tx = db.transaction(() => {
    for (const { id } of ids) {
      deleteVec.run(id);
      deleteChunk.run(id);
    }
  });

  tx();
  return ids.length;
}
```

### 7.3 MySQL Parallel Cleanup

The delete endpoints ALSO clean up MySQL `assistant_knowledge`:

```typescript
// assistantIngest.ts — DELETE /job/:jobId
await db.execute('DELETE FROM assistant_knowledge WHERE job_id = ?', [jobId]);
vectorStore.deleteByJob(jobId);

// assistants.ts — DELETE /:assistantId
if (clearKnowledge) {
  vectorStore.deleteByAssistant(assistantId);
}
// Note: assistant_knowledge is NOT explicitly cleaned on assistant delete
// (no CASCADE FK constraint — orphaned rows remain)
```

---

## 8. Singleton Connection Pattern

```typescript
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');
  sqliteVec.load(_db);

  // Create tables ...
  return _db;
}
```

**Why singleton?**

- `better-sqlite3` is synchronous — no connection pool needed
- Loading the `sqlite-vec` extension is a one-time cost (~10ms)
- Table creation (`CREATE TABLE IF NOT EXISTS`) runs once, on first access
- WAL mode and busy timeout are per-connection pragmas, set once

**Shutdown:**

```typescript
export function close(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
```

Called during process exit to flush WAL and release file locks.

---

## 9. Comparison: Two Embedding Approaches

The platform has two completely separate embedding systems:

| Aspect | `vectorStore.ts` (Assistants) | `embeddingService.ts` (Widget) |
|--------|-------------------------------|--------------------------------|
| **Tables** | `knowledge_vectors` (vec0) + `knowledge_chunks` | `document_embeddings` (MySQL) + `document_metadata` |
| **Storage** | Native float32 buffer (3 KB/vector) | JSON string (~6 KB/vector after encoding) |
| **Search** | sqlite-vec KNN MATCH (O(log n)) | JS cosine loop over all rows (O(n)) |
| **Filtering** | JOIN + WHERE assistant_id | SQL WHERE client_id, then JS sort |
| **Distance** | L2 (Euclidean) | Cosine similarity |
| **Write path** | `upsertChunks()` in sqlite transaction | `storeEmbedding()` individual MySQL INSERT |
| **Embed model** | nomic-embed-text (768-dim) | nomic-embed-text (768-dim) |
| **Scale target** | Thousands of chunks per assistant | Hundreds of documents per widget client |
| **Consumer** | Assistants RAG chat | Widget chat (legacy) |
| **Location** | `/var/opt/backend/data/vectors.db` | MySQL `softaware.document_embeddings` |

**Migration note:** The Widget system has not been migrated to sqlite-vec. Both systems will coexist until the Widget module is either deprecated or migrated.

---

## 10. Performance Characteristics

### 10.1 Write Performance

| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| Embed one chunk (nomic-embed-text) | 100–300ms | CPU-bound on Ollama, sequential |
| sqlite-vec INSERT one vector | <1ms | Synchronous, in-process |
| Transaction of 10 chunks | ~2–5ms | Batch insert, single lock acquisition |
| MySQL INSERT 10 chunks | ~5–15ms | Network round-trip + InnoDB write |

The embedding step dominates ingestion time. sqlite-vec writes are negligible.

### 10.2 Read Performance

| Operation | Typical Time | Notes |
|-----------|-------------|-------|
| sqlite-vec KNN (top 5, ~100 chunks) | 1–3ms | In-process, no network |
| sqlite-vec KNN (top 5, ~10,000 chunks) | 5–15ms | Scales logarithmically |
| embeddingService brute-force (100 docs) | 10–30ms | JSON.parse + cosine loop |
| embeddingService brute-force (10,000 docs) | 1–3 seconds | Unusable at scale |

### 10.3 Storage Requirements

| Component | Per Vector | Per 1000 Chunks |
|-----------|-----------|-----------------|
| sqlite-vec embedding | 3,072 bytes (768 × 4) | ~3 MB |
| knowledge_chunks row | ~2 KB avg (content + metadata) | ~2 MB |
| MySQL assistant_knowledge (JSON embedding) | ~6 KB (JSON overhead) | ~6 MB |
| **Total per 1000 chunks** | — | **~11 MB** (5 MB sqlite-vec + 6 MB MySQL) |

---

## 11. Known Limitations & Technical Debt

### 🔴 HIGH — No Partition-Level Filtering

sqlite-vec's `vec0` doesn't support partitioned indexes. All assistants' vectors live in one flat index. The `assistant_id` filter is a post-filter on the JOIN result.

**Impact:** As the number of assistants grows, the KNN scan returns candidates from other assistants that get filtered out, reducing effective recall.

**Mitigation options:**
1. Increase `topK` beyond 5 to compensate for filtered-out candidates
2. Create per-assistant vec0 tables (complex migration, management overhead)
3. Monitor recall quality and adjust when degradation is observed

### 🔴 HIGH — No Reconciliation Between MySQL and sqlite-vec

If the sqlite-vec write silently fails, there's no mechanism to detect or repair the drift.

**Recommended fix:** Add a periodic reconciliation job that compares `COUNT(*)` between `assistant_knowledge` and `knowledge_chunks` per assistant, flagging mismatches.

### 🟡 MEDIUM — Per-Chunk Deletion on vec0

Deleting a job's chunks requires iterating and deleting each vector individually (vec0 limitation). For a job with 50 chunks, this means 50 DELETE statements in a transaction.

**Impact:** Negligible at current scale. Could become slow if a single job produces hundreds of chunks (unlikely given the 15,000 char content cap).

### 🟡 MEDIUM — assistant_knowledge Dual-Write is Redundant

MySQL `assistant_knowledge` is only used for recategorization (reading content, not vectors). The same content is available in sqlite-vec `knowledge_chunks`.

**Recommended fix:** Migrate `updateAssistantCategories()` to read from `knowledge_chunks`, then drop `assistant_knowledge`. Saves ~6 KB per chunk in MySQL storage.

### 🟡 MEDIUM — No Vector Dimensionality Validation

`upsertChunks()` does not verify that `embedding.length === 768` before writing. A mis-dimensioned vector would corrupt the vec0 index.

**Recommended fix:** Add a runtime check: `if (c.embedding.length !== VECTOR_DIM) throw new Error(...)`.

### 🟢 LOW — No Backup Strategy for vectors.db

The sqlite-vec database file at `/var/opt/backend/data/vectors.db` is not included in any backup rotation. Loss of this file would require re-ingesting all knowledge sources.

**Recommended fix:** Add `vectors.db` to the backup script, or checkpoint WAL before copying.

### 🟢 LOW — Single-File Database

All assistants share one `vectors.db` file. For extreme multi-tenancy, separate files per tenant would provide better isolation and backup granularity.

---

## 12. Configuration Reference

| Constant | File | Value | Purpose |
|----------|------|-------|---------|
| `VECTOR_DIM` | vectorStore.ts | 768 | Must match embedding model output |
| `DB_PATH` | vectorStore.ts | `/var/opt/backend/data/vectors.db` | sqlite-vec file location |
| `EMBED_MODEL` | ingestionWorker.ts | `nomic-embed-text` | Ollama embedding model |
| `CHUNK_SIZE` | ingestionWorker.ts | 1,200 | Characters per chunk |
| `CHUNK_OVERLAP` | ingestionWorker.ts | 200 | Overlap between chunks |
| `MAX_CONTENT_CHARS` | ingestionWorker.ts | 15,000 | Max chars per job |
| Journal mode | vectorStore.ts (pragma) | WAL | Concurrent read/write |
| Busy timeout | vectorStore.ts (pragma) | 5,000ms | Lock wait time |

---

## 13. Cross-References

| Document | Relevant Sections |
|----------|-------------------|
| [Database/README.md](../Database/README.md) | Two-engine design, sqlite-vec as secondary store |
| [Database/PATTERNS.md](../Database/PATTERNS.md) | Singleton sqlite-vec pattern, dual-storage write, KNN search |
| [Database/FIELDS.md](../Database/FIELDS.md) | sqlite-vec table schemas, vec0 virtual table |
| [Assistants/FILES.md](FILES.md) | vectorStore.ts API surface, ingestionWorker.ts pipeline |
| [Assistants/PATTERNS.md](PATTERNS.md) | Dual-Storage Write Pattern (§2.1), Priority Queue (§2.5) |
| [Assistants/FIELDS.md](FIELDS.md) | knowledge_chunks + knowledge_vectors schema |
| [Assistants/ROUTES.md](ROUTES.md) | RAG chat pipeline, delete with KB option |
