# Database Module — API Surface

**Version:** 1.0.0  
**Last Updated:** 2026-03-05

---

## 1. Overview

The Database module has **no HTTP endpoints of its own** — it is a pure library consumed by every route module in the application. This document describes the **programmatic API surface** exposed by the database files.

---

## 2. `db` Helper API (mysql.ts)

The `db` object is the single entry point for all MySQL access in the application. It is imported by every route file.

### 2.1 `db.query<T>(sql, params?): Promise<T[]>`

Execute a SELECT and return all matching rows.

```typescript
import { db } from '../db/mysql.js';

const contacts = await db.query<Contact>(
  'SELECT * FROM contacts WHERE active = ? ORDER BY company_name',
  [1]
);
// → Contact[]
```

### 2.2 `db.queryOne<T>(sql, params?): Promise<T | null>`

Execute a SELECT and return the first row, or `null` if no match.

```typescript
const user = await db.queryOne<User>(
  'SELECT * FROM users WHERE email = ?',
  ['admin@softaware.net.za']
);
if (!user) return res.status(404).json({ error: 'User not found' });
```

### 2.3 `db.insert(sql, params?): Promise<string>`

Execute an INSERT and return the `insertId` as a string.

```typescript
const id = await db.insert(
  'INSERT INTO notifications (id, userId, title, body, type) VALUES (?, ?, ?, ?, ?)',
  [uuid, userId, 'New Invoice', 'Invoice #INV-001 created', 'invoice']
);
```

### 2.4 `db.insertOne(table, data): Promise<string>`

Build and execute an INSERT from a table name and data object.

```typescript
const id = await db.insertOne('contacts', {
  company_name: 'Acme Corp',
  email: 'info@acme.com',
  active: 1
});
// Generates: INSERT INTO contacts (company_name, email, active) VALUES (?, ?, ?)
```

### 2.5 `db.execute(sql, params?): Promise<number>`

Execute an UPDATE or DELETE and return the number of affected rows.

```typescript
const affected = await db.execute(
  'UPDATE invoices SET paid = 1, remarks = ? WHERE id = ?',
  ['Paid via EFT', invoiceId]
);
if (affected === 0) return res.status(404).json({ error: 'Invoice not found' });
```

### 2.6 `db.transaction<T>(callback): Promise<T>`

Run multiple queries in an ACID transaction.

```typescript
const invoiceId = await db.transaction(async (conn) => {
  const [result] = await conn.query('INSERT INTO invoices ...', [...]);
  const id = (result as any).insertId;
  await conn.query('INSERT INTO invoice_items ...', [...]);
  return id;  // returned from transaction
});
// On error: automatic rollback + re-throw
```

### 2.7 `db.ping(): Promise<boolean>`

Health check — returns `true` if the database responds to `SELECT 1`.

### 2.8 `db.close(): Promise<void>`

Close all pool connections. Called during graceful shutdown.

---

## 3. `pool` (raw mysql2/promise pool)

For advanced use cases requiring direct pool access (e.g., streaming large result sets, `FOR UPDATE SKIP LOCKED`):

```typescript
import { pool } from '../db/mysql.js';

// Direct pool query (used by ingestion worker for SELECT ... FOR UPDATE SKIP LOCKED)
const [rows] = await pool.query('SELECT ... FOR UPDATE SKIP LOCKED');

// Get a raw connection for multi-step transactions
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ...
  await conn.commit();
} finally {
  conn.release();
}
```

---

## 4. Utility Functions

### 4.1 `generateId(): string`

```typescript
import { generateId } from '../db/mysql.js';
const uuid = generateId();  // crypto.randomUUID() → "f47ac10b-58cc-..."
```

### 4.2 `toMySQLDate(date: Date): string`

```typescript
import { toMySQLDate } from '../db/mysql.js';
const now = toMySQLDate(new Date());  // "2026-03-05 12:00:00"
```

### 4.3 `fromMySQLDate(date: string | Date): Date`

```typescript
import { fromMySQLDate } from '../db/mysql.js';
const jsDate = fromMySQLDate('2026-03-05 12:00:00');  // Date object
```

---

## 5. Vector Store API (vectorStore.ts)

Imported from `../services/vectorStore.js` (not from `../db/`).

### 5.1 `upsertChunks(chunks: ChunkInput[]): void`

Batch insert/replace chunks + their embeddings. Synchronous (better-sqlite3). Transactional.

### 5.2 `search(assistantId, queryEmbedding, topK?): Result[]`

KNN similarity search. Returns `{ id, content, source, distance }[]` ordered by distance ASC.

### 5.3 `deleteByJob(jobId): number`

Delete all chunks + vectors for a job. Returns count deleted.

### 5.4 `deleteByAssistant(assistantId): number`

Delete all chunks + vectors for an assistant. Returns count deleted.

### 5.5 `stats(assistantId): { totalChunks, sources[] }`

Get chunk count and source breakdown.

### 5.6 `close(): void`

Close the sqlite-vec database connection.

---

## 6. Embedding Service API (embeddingService.ts)

Legacy widget-path embedding service (MySQL JSON storage, brute-force search).

### 6.1 `generateEmbedding(text, model?): Promise<number[]>`

Call Ollama `nomic-embed-text` to generate a 768-dim vector.

### 6.2 `embeddingService.storeEmbedding(documentId, embedding, model?): Promise<string>`

Store embedding as JSON in `document_embeddings` table.

### 6.3 `embeddingService.searchSimilar(clientId, queryEmbedding, limit?): Promise<Result[]>`

Brute-force cosine similarity search over all embeddings for a widget client.

### 6.4 `embeddingService.embedDocument(documentId, content, model?): Promise<string>`

Generate + store embedding in one call.

### 6.5 `embeddingService.deleteClientEmbeddings(clientId): Promise<void>`

Delete all embeddings for a widget client (JOIN through `document_metadata`).

### 6.6 `cosineSimilarity(vecA, vecB): number`

Pure JavaScript cosine similarity calculation.

---

## 7. Consumer Map

Every route module imports from the database layer. Key consumers:

| Consumer | Imports | Usage |
|----------|---------|-------|
| All 28+ route files | `db` from `mysql.ts` | `db.query()`, `db.execute()`, `db.insert()` |
| `ingestionWorker.ts` | `db` + `upsertChunks` from vectorStore | Dual-write to MySQL + sqlite-vec |
| `assistants.ts` (chat) | `search` from vectorStore | RAG retrieval for chat |
| `assistantIngest.ts` | `deleteByJob` from vectorStore | Job deletion cleanup |
| `assistants.ts` (delete) | `deleteByAssistant` from vectorStore | Assistant deletion cleanup |
| `knowledgeCategorizer.ts` | `db` | Read chunks for recategorization |
| `embeddingService.ts` | `db` + Ollama API | Widget path embedding |
| All migration files | `pool` or `db` | Schema changes + data seeding |
