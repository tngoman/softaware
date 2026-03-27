import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { env } from '../config/env.js';

export interface DocumentEmbedding {
  id: string;
  document_id: string;
  embedding: number[];
  embedding_model: string;
  created_at: string;
}

/**
 * Generate embeddings using Ollama
 */
export async function generateEmbedding(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
  const baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct / (magA * magB);
}

export const embeddingService = {
  /**
   * Store embedding for a document chunk
   */
  async storeEmbedding(documentId: string, embedding: number[], model: string = 'nomic-embed-text'): Promise<string> {
    const id = randomUUID();
    const now = toMySQLDate(new Date());

    await db.execute(
      `INSERT INTO document_embeddings (id, document_id, embedding, embedding_model, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, documentId, JSON.stringify(embedding), model, now]
    );

    return id;
  },

  /**
   * Get embedding by document ID
   */
  async getEmbeddingByDocumentId(documentId: string): Promise<DocumentEmbedding | null> {
    const result = await db.queryOne<any>(
      'SELECT * FROM document_embeddings WHERE document_id = ?',
      [documentId]
    );

    if (!result) return null;

    return {
      ...result,
      embedding: JSON.parse(result.embedding)
    };
  },

  /**
   * Search for similar documents using vector similarity
   * Uses batched fetching to avoid loading all embeddings into memory at once.
   */
  async searchSimilar(clientId: string, queryEmbedding: number[], limit: number = 5): Promise<Array<{
    documentId: string;
    content: string;
    sourceUrl: string | null;
    sourceType: string;
    similarity: number;
  }>> {
    const BATCH_SIZE = 500;
    let offset = 0;

    // Min-heap to track top-N results without holding all scored rows in memory
    const topN: Array<{ documentId: string; content: string; sourceUrl: string | null; sourceType: string; similarity: number }> = [];

    // Get total count first
    const countResult = await db.queryOne<any>(
      `SELECT COUNT(*) as cnt
       FROM document_metadata dm
       INNER JOIN document_embeddings de ON dm.id = de.document_id
       WHERE dm.client_id = ?`,
      [clientId]
    );
    const totalRows = Number(countResult?.cnt || 0);
    if (totalRows === 0) return [];

    while (offset < totalRows) {
      const batch = await db.query<any>(
        `SELECT 
          dm.id as documentId,
          dm.content,
          dm.source_url as sourceUrl,
          dm.source_type as sourceType,
          de.embedding
         FROM document_metadata dm
         INNER JOIN document_embeddings de ON dm.id = de.document_id
         WHERE dm.client_id = ?
         LIMIT ? OFFSET ?`,
        [clientId, BATCH_SIZE, offset]
      );

      for (const row of batch) {
        const embedding = JSON.parse(row.embedding);
        const similarity = cosineSimilarity(queryEmbedding, embedding);

        if (topN.length < limit) {
          topN.push({ documentId: row.documentId, content: row.content, sourceUrl: row.sourceUrl, sourceType: row.sourceType, similarity });
          topN.sort((a, b) => a.similarity - b.similarity); // keep sorted ascending so [0] is the lowest
        } else if (similarity > topN[0].similarity) {
          topN[0] = { documentId: row.documentId, content: row.content, sourceUrl: row.sourceUrl, sourceType: row.sourceType, similarity };
          topN.sort((a, b) => a.similarity - b.similarity);
        }
      }

      offset += BATCH_SIZE;
    }

    // Return sorted descending (highest similarity first)
    return topN.sort((a, b) => b.similarity - a.similarity);
  },

  /**
   * Generate and store embedding for a document chunk
   */
  async embedDocument(documentId: string, content: string, model: string = 'nomic-embed-text'): Promise<string> {
    const embedding = await generateEmbedding(content, model);
    return this.storeEmbedding(documentId, embedding, model);
  },

  /**
   * Delete all embeddings for a client (cleanup)
   */
  async deleteClientEmbeddings(clientId: string): Promise<void> {
    await db.execute(
      `DELETE de FROM document_embeddings de
       INNER JOIN document_metadata dm ON de.document_id = dm.id
       WHERE dm.client_id = ?`,
      [clientId]
    );
  }
};
