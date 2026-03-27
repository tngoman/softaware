/**
 * cmsVectorStore.ts — sqlite-vec Storage for CMS Data (AI Shadow)
 *
 * Extends the existing vectors.db with two new tables dedicated to
 * the Generic CMS (client_custom_data) dual-write pipeline:
 *
 *   ai_knowledge_meta  — readable text version of each CMS record
 *   ai_knowledge        — vec0 virtual table (768-dim float32 embeddings)
 *
 * The rowid linkage between the two tables mirrors the pattern already
 * used by knowledge_chunks / knowledge_vectors in vectorStore.ts.
 *
 * This module reuses the same vectors.db singleton so that one SQLite
 * file and one sqlite-vec extension load serves both the Assistants KB
 * and the CMS knowledge store.
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Config — same DB as vectorStore.ts (shared singleton)
// ---------------------------------------------------------------------------
const VECTOR_DIM = 768;
const DB_DIR = path.resolve('/var/opt/backend/data');
const DB_PATH = path.join(DB_DIR, 'vectors.db');

// ---------------------------------------------------------------------------
// Singleton (separate from vectorStore.ts to avoid circular imports,
// but points at the same file — SQLite handles this fine in WAL mode)
// ---------------------------------------------------------------------------
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('busy_timeout = 5000');

  // Load sqlite-vec extension
  sqliteVec.load(_db);

  // ── CMS-specific tables ─────────────────────────────────────────────────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_knowledge_meta (
      rowid           INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         TEXT    NOT NULL,
      client_id       TEXT    NOT NULL,
      collection_name TEXT    NOT NULL,
      content_text    TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_akm_client
      ON ai_knowledge_meta(client_id);
    CREATE INDEX IF NOT EXISTS idx_akm_item
      ON ai_knowledge_meta(item_id);
  `);

  _db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ai_knowledge USING vec0(
      embedding float[${VECTOR_DIM}]
    );
  `);

  console.log('[CmsVectorStore] sqlite-vec CMS tables initialised at', DB_PATH);
  return _db;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CmsChunkInput {
  itemId: string;
  clientId: string;
  collectionName: string;
  textToEmbed: string;
  embedding: number[];        // 768-dim float32
}

/**
 * Upsert a CMS record into the AI knowledge store.
 * If the item_id already exists (UPDATE path), we delete old rows first
 * and re-insert with the new content + embedding.
 */
export function upsertCmsChunk(input: CmsChunkInput): void {
  const db = getDb();

  const tx = db.transaction(() => {
    // Remove previous version (for UPDATE operations)
    const existing = db.prepare(
      `SELECT rowid FROM ai_knowledge_meta WHERE item_id = ?`
    ).all(input.itemId) as { rowid: number }[];

    for (const row of existing) {
      db.prepare(`DELETE FROM ai_knowledge WHERE rowid = ?`).run(row.rowid);
    }
    db.prepare(`DELETE FROM ai_knowledge_meta WHERE item_id = ?`).run(input.itemId);

    // Insert metadata
    const meta = db.prepare(`
      INSERT INTO ai_knowledge_meta (item_id, client_id, collection_name, content_text)
      VALUES (?, ?, ?, ?)
    `).run(input.itemId, input.clientId, input.collectionName, input.textToEmbed);

    const newRowId = meta.lastInsertRowid;

    // Insert vector — sqlite-vec expects raw float32 buffer
    const buf = new Float32Array(input.embedding).buffer;
    db.prepare(`
      INSERT INTO ai_knowledge (rowid, embedding)
      VALUES (?, ?)
    `).run(newRowId, Buffer.from(buf));
  });

  tx();
}

/**
 * Delete a CMS record from the AI knowledge store.
 * Called when a client deletes a record via the CMS API.
 */
export function deleteCmsChunk(itemId: string): number {
  const db = getDb();

  const rows = db.prepare(
    `SELECT rowid FROM ai_knowledge_meta WHERE item_id = ?`
  ).all(itemId) as { rowid: number }[];

  if (rows.length === 0) return 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare(`DELETE FROM ai_knowledge WHERE rowid = ?`).run(row.rowid);
    }
    db.prepare(`DELETE FROM ai_knowledge_meta WHERE item_id = ?`).run(itemId);
  });

  tx();
  return rows.length;
}

/**
 * Delete ALL CMS knowledge for a specific client.
 * Used when a client's site is deleted or account is cancelled.
 */
export function deleteCmsChunksByClient(clientId: string): number {
  const db = getDb();

  const rows = db.prepare(
    `SELECT rowid FROM ai_knowledge_meta WHERE client_id = ?`
  ).all(clientId) as { rowid: number }[];

  if (rows.length === 0) return 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare(`DELETE FROM ai_knowledge WHERE rowid = ?`).run(row.rowid);
    }
    db.prepare(`DELETE FROM ai_knowledge_meta WHERE client_id = ?`).run(clientId);
  });

  tx();
  return rows.length;
}

/**
 * Semantic search across a client's CMS data.
 * Returns the top-K most similar CMS records for a given query embedding.
 * Used by the AI assistant to answer questions about the client's site content.
 */
export function searchCms(
  clientId: string,
  queryEmbedding: number[],
  topK: number = 5
): { itemId: string; collectionName: string; content: string; distance: number }[] {
  const db = getDb();

  const buf = new Float32Array(queryEmbedding).buffer;

  const rows = db.prepare(`
    SELECT
      ak.rowid,
      ak.distance,
      akm.item_id,
      akm.collection_name,
      akm.content_text
    FROM ai_knowledge ak
    JOIN ai_knowledge_meta akm ON akm.rowid = ak.rowid
    WHERE ak.embedding MATCH ?
      AND akm.client_id = ?
      AND k = ?
    ORDER BY ak.distance ASC
  `).all(Buffer.from(buf), clientId, topK) as {
    rowid: number;
    distance: number;
    item_id: string;
    collection_name: string;
    content_text: string;
  }[];

  return rows.map(r => ({
    itemId: r.item_id,
    collectionName: r.collection_name,
    content: r.content_text,
    distance: r.distance
  }));
}

/**
 * Get stats for a client's CMS vector store.
 */
export function cmsStats(clientId: string): {
  totalRecords: number;
  collections: { name: string; count: number }[];
} {
  const db = getDb();

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM ai_knowledge_meta WHERE client_id = ?`
  ).get(clientId) as { cnt: number };

  const collections = db.prepare(`
    SELECT collection_name, COUNT(*) as cnt
    FROM ai_knowledge_meta
    WHERE client_id = ?
    GROUP BY collection_name
  `).all(clientId) as { collection_name: string; cnt: number }[];

  return {
    totalRecords: total.cnt,
    collections: collections.map(c => ({ name: c.collection_name, count: c.cnt }))
  };
}

/**
 * Close the CMS vector database connection.
 */
export function closeCms(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[CmsVectorStore] Database connection closed');
  }
}
