# Database Module — Architecture Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

This document catalogs the architecture and usage patterns of the SoftAware database layer, covering the MySQL connection helper, sqlite-vec vector store, migration system, and cross-engine dual-write strategy.

---

## 2. Connection & Query Patterns

### 2.1 Thin Wrapper over mysql2/promise (No ORM)

**Context:** The platform migrated away from Prisma ORM to a thin custom wrapper (`db.*` helper) for full SQL control and zero abstraction overhead.

**Implementation:**

```typescript
// src/db/mysql.ts — the ONLY import needed for all MySQL access
import { db } from '../db/mysql.js';

// SELECT — returns typed array
const users = await db.query<User>('SELECT * FROM users WHERE email = ?', [email]);

// SELECT ONE — returns null if not found
const user = await db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);

// INSERT — returns insertId as string
const id = await db.insert(
  'INSERT INTO contacts (company_name, email) VALUES (?, ?)',
  ['Acme', 'acme@example.com']
);

// INSERT (convenience) — builds SQL from table + object
const id = await db.insertOne('contacts', { company_name: 'Acme', email: 'acme@example.com' });

// UPDATE/DELETE — returns affectedRows
const affected = await db.execute(
  'UPDATE invoices SET paid = 1 WHERE id = ?',
  [invoiceId]
);
```

**Benefits:**
- ✅ Zero ORM overhead — direct SQL, full MySQL feature access
- ✅ Parameterised queries prevent SQL injection
- ✅ TypeScript generics provide return type safety
- ✅ Connection pooling handled automatically
- ✅ `insertOne()` convenience method eliminates repetitive INSERT boilerplate

**Drawbacks:**
- ❌ No schema validation at compile time (SQL errors are runtime-only)
- ❌ No migration tracking integration
- ❌ No query builder — complex queries are raw string SQL

---

### 2.2 Transaction Pattern

**Context:** Operations that span multiple tables (e.g., creating an invoice + line items + updating balance) need atomic execution.

**Implementation:**

```typescript
await db.transaction(async (conn) => {
  // conn is a PoolConnection with beginTransaction already called

  const [result] = await conn.query(
    'INSERT INTO invoices (invoice_number, contact_id, invoice_amount) VALUES (?, ?, ?)',
    ['INV-001', contactId, totalAmount]
  );
  const invoiceId = (result as any).insertId;

  for (const item of lineItems) {
    await conn.query(
      'INSERT INTO invoice_items (invoice_id, item_description, item_price, item_quantity, line_total) VALUES (?, ?, ?, ?, ?)',
      [invoiceId, item.desc, item.price, item.qty, item.total]
    );
  }

  // If any query throws, the entire transaction is rolled back
});
```

**Lifecycle:**
```
pool.getConnection() → beginTransaction() → callback(conn) → commit() → release()
                                             ↓ (on throw)
                                           rollback() → release() → re-throw
```

**Benefits:**
- ✅ Automatic rollback on any error
- ✅ Connection always released (finally block)
- ✅ Generic return type preserves callback result

**Used in:** Migration 009 (roles/permissions seeding), Subscription creation, Credit purchases

---

### 2.3 Health Check Pattern

```typescript
// Used by system_health_checks automated monitoring
const isHealthy = await db.ping();  // SELECT 1

// Also used by the /api/health endpoint
if (!isHealthy) {
  // Create case automatically if consecutive failures exceed threshold
}
```

---

## 3. sqlite-vec Patterns

### 3.1 Singleton Connection + Extension Loading

**Context:** sqlite-vec must be loaded as an extension into better-sqlite3. The connection is created lazily on first use and reused for the process lifetime.

**Implementation:**

```typescript
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database('/var/opt/backend/data/vectors.db');
  _db.pragma('journal_mode = WAL');     // concurrent reads during writes
  _db.pragma('busy_timeout = 5000');    // 5s wait for locks

  // Load the sqlite-vec extension — provides vec0() virtual table type
  sqliteVec.load(_db);

  // Create tables (idempotent)
  _db.exec(`CREATE TABLE IF NOT EXISTS knowledge_chunks (...)`);
  _db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(...)`);

  return _db;
}
```

**Benefits:**
- ✅ Zero startup cost — DB only opened when first chunk is stored or searched
- ✅ WAL mode allows concurrent reads during background worker writes
- ✅ `busy_timeout` prevents immediate failures under load
- ✅ Idempotent table creation — safe to restart the process

---

### 3.2 KNN Search Pattern (RAG Retrieval)

**Context:** The assistant chat needs to find the most semantically similar knowledge chunks for a given user query. This is the core of the RAG pipeline.

**Implementation:**

```typescript
export function search(
  assistantId: string,
  queryEmbedding: number[],
  topK: number = 5
) {
  const db = getDb();
  const buf = new Float32Array(queryEmbedding).buffer;

  return db.prepare(`
    SELECT kv.chunk_id, kv.distance, kc.content, kc.source
    FROM knowledge_vectors kv
    JOIN knowledge_chunks kc ON kc.id = kv.chunk_id
    WHERE kv.embedding MATCH ?        -- vec0 KNN operator
      AND kc.assistant_id = ?          -- filter to this assistant
      AND k = ?                        -- top-K results
    ORDER BY kv.distance ASC
  `).all(Buffer.from(buf), assistantId, topK);
}
```

**Key details:**
- `MATCH ?` — the vec0 extension's KNN operator; accepts a raw Float32Array buffer
- `k = ?` — vec0 syntax for limiting results (not SQL LIMIT)
- `distance` — L2 (Euclidean); lower = more similar
- The JOIN filters by `assistant_id` since vec0 doesn't support partitions
- Returns distance for debugging/logging (not exposed to user)

---

### 3.3 Batch Upsert Pattern (Ingestion)

**Context:** The ingestion worker processes one job at a time, producing 5–25 chunks per job. All chunks must be atomically inserted.

**Implementation:**

```typescript
export function upsertChunks(chunks: ChunkInput[]): void {
  const db = getDb();

  const insertChunk = db.prepare(`INSERT OR REPLACE INTO knowledge_chunks (...) VALUES (...)`);
  const insertVec = db.prepare(`INSERT OR REPLACE INTO knowledge_vectors (chunk_id, embedding) VALUES (?, ?)`);

  // Wrap in transaction for atomicity
  const tx = db.transaction((items: ChunkInput[]) => {
    for (const c of items) {
      insertChunk.run(c.id, c.assistantId, c.jobId, c.content, ...);
      const buf = new Float32Array(c.embedding).buffer;
      insertVec.run(c.id, Buffer.from(buf));
    }
  });

  tx(chunks);  // All-or-nothing
}
```

**Benefits:**
- ✅ `INSERT OR REPLACE` handles re-ingestion (idempotent)
- ✅ Transaction ensures chunk + vector are always paired
- ✅ Prepared statements reused across loop iterations (faster)
- ✅ Float32Array buffer conversion matches vec0's expected format

---

## 4. Dual-Storage Pattern (MySQL + sqlite-vec)

### 4.1 Write Path

Every ingested knowledge chunk is written to **both** stores by the ingestion worker:

```
ingestionWorker.ts → processJob()
  │
  ├─→ MySQL: INSERT INTO assistant_knowledge (id, content, embedding JSON, ...)
  │   Purpose: Relational queries, recategorization reads top-50 chunks
  │
  └─→ sqlite-vec: upsertChunks([{ id, content, embedding float32[], ... }])
      Purpose: KNN search for RAG chat
```

### 4.2 Read Paths

| Operation | Store Used | Why |
|-----------|-----------|-----|
| RAG chat search (KNN) | sqlite-vec | Fast vector similarity via vec0 MATCH |
| Recategorization | MySQL (`assistant_knowledge`) | Relational query: `SELECT content ... LIMIT 50` |
| Job status / page count | MySQL (`ingestion_jobs`) | Relational query with status filter |
| Stats (chunk count per source) | sqlite-vec (`knowledge_chunks`) | GROUP BY source |

### 4.3 Delete Paths

| Operation | MySQL | sqlite-vec |
|-----------|-------|------------|
| Delete job | `DELETE FROM assistant_knowledge WHERE job_id = ?` | `deleteByJob(jobId)` — per-chunk loop |
| Delete assistant (KB clear) | `DELETE FROM ingestion_jobs WHERE assistant_id = ?` | `deleteByAssistant(id)` — per-chunk loop |
| Delete assistant (keep KB) | `DELETE FROM ingestion_jobs WHERE assistant_id = ?` | **Skipped** — orphaned but preserved |

### 4.4 Consistency Concerns

| Risk | Mitigation |
|------|-----------|
| MySQL write succeeds, sqlite-vec fails | sqlite-vec upsert is wrapped in try/catch — logged as warning, non-fatal |
| sqlite-vec write succeeds, MySQL fails | Entire processJob() throws → job marked `failed` → both stores may have partial data |
| Delete from MySQL but not sqlite-vec | Delete is also try/caught — orphaned vectors logged |
| No reconciliation | No automated process to detect or fix drift between stores |

> **Recommendation:** Add a periodic reconciliation job that compares `COUNT(*)` between `assistant_knowledge` and `knowledge_chunks` per assistant.

---

## 5. Migration Patterns

### 5.1 Column Addition with Idempotency

```typescript
// Pattern A: INFORMATION_SCHEMA check (migration 004)
const [cols] = await conn.query(
  `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatarUrl'`
);
if (!cols.length) {
  await conn.query(`ALTER TABLE users ADD COLUMN avatarUrl VARCHAR(512)`);
}

// Pattern B: MySQL 8.0.19+ syntax (migration 010)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

// Pattern C: Try/catch ER_DUP_FIELDNAME (migration 003)
try {
  await pool.query(`ALTER TABLE widget_clients ADD COLUMN subscription_tier ...`);
} catch (e) {
  if (e.code !== 'ER_DUP_FIELDNAME') throw e;  // ignore duplicate, re-throw others
}
```

### 5.2 Table Rename Pattern (migration 005)

```typescript
// Bulk rename with FK checks disabled
await conn.query('SET FOREIGN_KEY_CHECKS = 0');
const renames = [
  ['User', 'users'],
  ['Team', 'teams'],
  ['Subscription', 'subscriptions'],
  // ... ~26 renames
];
for (const [from, to] of renames) {
  await conn.query(`RENAME TABLE \`${from}\` TO \`${to}\``);
}
await conn.query('SET FOREIGN_KEY_CHECKS = 1');
```

### 5.3 Data Seeding Pattern (migration 008, 009)

```typescript
// Transaction-wrapped seeding
const conn = await pool.getConnection();
await conn.beginTransaction();
try {
  // Insert roles
  for (const role of roles) {
    await conn.query('INSERT IGNORE INTO roles (name, description) VALUES (?, ?)', [role.name, role.desc]);
  }
  // Wire permissions
  for (const [roleName, perms] of Object.entries(rolePermMap)) {
    for (const perm of perms) {
      await conn.query(`INSERT IGNORE INTO role_permissions (...) SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = ? AND p.name = ?`, [roleName, perm]);
    }
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}
```

---

## 6. Anti-Patterns & Technical Debt

### 6.1 🔴 No Migration Tracking

**Impact:** No table records which migrations have been applied. Re-running a migration may fail or cause data duplication.

**Mitigation:** Most migrations have idempotent guards (IF NOT EXISTS, IGNORE, column checks).

**Recommendation:** Add a `schema_migrations` table: `(version INT, name TEXT, applied_at TIMESTAMP)`.

### 6.2 🔴 Mixed Collations

**Impact:** JOINs between `utf8mb4_unicode_ci` and `utf8mb4_0900_ai_ci` tables require explicit `COLLATE` clauses, or they error/misbehave.

**Recommendation:** Standardise all tables to `utf8mb4_unicode_ci` with a one-time migration.

### 6.3 🟡 Inconsistent Migration Signatures

**Impact:** Some migrations self-execute, some need a connection, some need a pool. No unified runner.

**Recommendation:** Standardise on `export async function up(): Promise<void>` importing `pool` internally, then create a single `runMigrations.ts` script.

### 6.4 🟡 Legacy `tb_*` Tables

**Impact:** 15 tables using old PHP schema (some MyISAM) remain in the database. Migration 008 partially loads their data but doesn't drop them.

**Recommendation:** After data verification, drop `tb_*` tables to reduce schema noise.

### 6.5 🟡 Prisma Remnants

**Impact:** `prisma.ts` exports a Proxy that throws — any unreachable code path importing Prisma will crash at runtime.

**Recommendation:** Delete `prisma.ts` and remove all Prisma imports from the codebase.

### 6.6 🟢 No Application-Level FK for Assistants

**Impact:** `ingestion_jobs.assistant_id` and `assistant_knowledge.assistant_id` have no FK constraint. Orphaned rows possible if delete logic has bugs.

**Recommendation:** Add FK constraints with `ON DELETE CASCADE`, or add a periodic cleanup job.

---

## 7. Embedding Service (Legacy Widget Path)

The `embeddingService.ts` file provides an **older, MySQL-only** approach to vector search for the widget system (as opposed to the Assistants system which uses sqlite-vec):

| Method | Description |
|--------|-------------|
| `generateEmbedding(text)` | Call Ollama `nomic-embed-text` for 768-dim vector |
| `storeEmbedding(documentId, embedding)` | Store in `document_embeddings` as JSON |
| `searchSimilar(clientId, queryEmbedding, limit)` | **Brute-force scan**: loads ALL embeddings, computes cosine similarity in JavaScript, sorts, returns top-N |
| `embedDocument(documentId, content)` | Generate + store in one call |
| `deleteClientEmbeddings(clientId)` | Cascade delete via JOIN |
| `cosineSimilarity(vecA, vecB)` | Manual dot-product / magnitude calculation |

> **Contrast with sqlite-vec:** The `embeddingService.ts` approach loads all embeddings into memory and scans them in JavaScript. The sqlite-vec approach uses the vec0 extension's native KNN index, which is orders of magnitude faster for large datasets. The widget system uses the old approach; the Assistants system uses sqlite-vec.
