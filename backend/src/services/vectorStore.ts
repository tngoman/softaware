/**
 * vectorStore.ts — sqlite-vec Knowledge Base Service
 *
 * Central vector storage for all assistant knowledge using sqlite-vec.
 * Each assistant gets its own virtual table partition (filtered by assistant_id).
 * Provides:
 *   - upsertChunks()  — store embedded chunks from the ingestion worker
 *   - search()        — cosine-similarity search for RAG retrieval
 *   - deleteByJob()   — remove all chunks when a job is deleted
 *   - deleteByAssistant() — wipe everything for an assistant
 *   - stats()         — chunk count & sources for an assistant
 *
 * The sqlite DB lives at /var/opt/backend/data/vectors.db
 * Embeddings use nomic-embed-text (768-dimensional float32 vectors).
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const VECTOR_DIM = 768;                              // nomic-embed-text dimensions
const DB_DIR = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'vectors.db');

// ---------------------------------------------------------------------------
// Singleton database connection
// ---------------------------------------------------------------------------
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');     // concurrent reads during writes
  _db.pragma('busy_timeout = 5000');    // wait up to 5s for locks

  // Load the sqlite-vec extension
  sqliteVec.load(_db);

  // Create tables if they don't exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id            TEXT PRIMARY KEY,
      assistant_id  TEXT NOT NULL,
      job_id        TEXT NOT NULL,
      content       TEXT NOT NULL,
      source        TEXT,
      source_type   TEXT NOT NULL,
      chunk_index   INTEGER NOT NULL DEFAULT 0,
      char_count    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kc_assistant ON knowledge_chunks(assistant_id);
    CREATE INDEX IF NOT EXISTS idx_kc_job      ON knowledge_chunks(job_id);
  `);

  // Create the virtual vector table for embeddings
  // vec0 stores float32 vectors alongside a rowid that we map to knowledge_chunks
  _db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors
    USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding float[${VECTOR_DIM}]
    );
  `);

  console.log('[VectorStore] sqlite-vec initialised at', DB_PATH);
  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChunkInput {
  id: string;
  assistantId: string;
  jobId: string;
  content: string;
  source: string;
  sourceType: 'url' | 'file';
  chunkIndex: number;
  charCount: number;
  embedding: number[];        // 768-dim float32
  createdAt: string;          // ISO or MySQL datetime
}

/**
 * Store one or more embedded chunks.  
 * Called by the ingestion worker after embedding each chunk.
 */
export function upsertChunks(chunks: ChunkInput[]): void {
  const db = getDb();

  const insertChunk = db.prepare(`
    INSERT OR REPLACE INTO knowledge_chunks
      (id, assistant_id, job_id, content, source, source_type, chunk_index, char_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVec = db.prepare(`
    INSERT OR REPLACE INTO knowledge_vectors (chunk_id, embedding)
    VALUES (?, ?)
  `);

  const tx = db.transaction((items: ChunkInput[]) => {
    for (const c of items) {
      insertChunk.run(
        c.id, c.assistantId, c.jobId,
        c.content, c.source, c.sourceType,
        c.chunkIndex, c.charCount, c.createdAt
      );
      // sqlite-vec expects a raw float32 buffer
      const buf = new Float32Array(c.embedding).buffer;
      insertVec.run(c.id, Buffer.from(buf));
    }
  });

  tx(chunks);
}

/**
 * Semantic similarity search — the core RAG retrieval.
 * Returns the top-K most similar chunks for a given query embedding.
 */
export function search(
  assistantId: string,
  queryEmbedding: number[],
  topK: number = 5
): { id: string; content: string; source: string; distance: number }[] {
  const db = getDb();

  const buf = new Float32Array(queryEmbedding).buffer;

  // vec0 KNN query: returns (chunk_id, distance) ordered by distance ASC
  // distance is L2 (euclidean) by default in vec0 — lower = more similar
  const rows = db.prepare(`
    SELECT
      kv.chunk_id,
      kv.distance,
      kc.content,
      kc.source
    FROM knowledge_vectors kv
    JOIN knowledge_chunks kc ON kc.id = kv.chunk_id
    WHERE kv.embedding MATCH ?
      AND kc.assistant_id = ?
      AND k = ?
    ORDER BY kv.distance ASC
  `).all(Buffer.from(buf), assistantId, topK) as {
    chunk_id: string;
    distance: number;
    content: string;
    source: string;
  }[];

  return rows.map(r => ({
    id: r.chunk_id,
    content: r.content,
    source: r.source,
    distance: r.distance
  }));
}

/**
 * Delete all chunks + vectors belonging to a specific ingestion job.
 */
export function deleteByJob(jobId: string): number {
  const db = getDb();

  // Get chunk IDs first so we can delete from the virtual table
  const ids = db.prepare(
    `SELECT id FROM knowledge_chunks WHERE job_id = ?`
  ).all(jobId) as { id: string }[];

  if (ids.length === 0) return 0;

  const deleteVec = db.prepare(`DELETE FROM knowledge_vectors WHERE chunk_id = ?`);
  const deleteChunk = db.prepare(`DELETE FROM knowledge_chunks WHERE id = ?`);

  const tx = db.transaction(() => {
    for (const { id } of ids) {
      deleteVec.run(id);
      deleteChunk.run(id);
    }
  });

  tx();
  return ids.length;
}

/**
 * Delete ALL knowledge for an assistant (used when assistant is deleted).
 */
export function deleteByAssistant(assistantId: string): number {
  const db = getDb();

  const ids = db.prepare(
    `SELECT id FROM knowledge_chunks WHERE assistant_id = ?`
  ).all(assistantId) as { id: string }[];

  if (ids.length === 0) return 0;

  const deleteVec = db.prepare(`DELETE FROM knowledge_vectors WHERE chunk_id = ?`);
  const deleteChunk = db.prepare(`DELETE FROM knowledge_chunks WHERE id = ?`);

  const tx = db.transaction(() => {
    for (const { id } of ids) {
      deleteVec.run(id);
      deleteChunk.run(id);
    }
  });

  tx();
  return ids.length;
}

/**
 * Get stats for an assistant's vector store.
 */
export function stats(assistantId: string): {
  totalChunks: number;
  sources: { source: string; chunkCount: number }[];
} {
  const db = getDb();

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM knowledge_chunks WHERE assistant_id = ?`
  ).get(assistantId) as { cnt: number };

  const sources = db.prepare(`
    SELECT source, COUNT(*) as chunk_count
    FROM knowledge_chunks
    WHERE assistant_id = ?
    GROUP BY source
  `).all(assistantId) as { source: string; chunk_count: number }[];

  return {
    totalChunks: total.cnt,
    sources: sources.map(s => ({ source: s.source, chunkCount: s.chunk_count }))
  };
}

/**
 * Close the database connection (for clean shutdown).
 */
export function close(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[VectorStore] Database connection closed');
  }
}
