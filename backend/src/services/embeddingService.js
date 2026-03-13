import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import { env } from '../config/env.js';
/**
 * Generate embeddings using Ollama
 */
export async function generateEmbedding(text, model = 'nomic-embed-text') {
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
        const data = await response.json();
        return data.embedding;
    }
    catch (error) {
        console.error('Failed to generate embedding:', error);
        throw error;
    }
}
/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA, vecB) {
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
    async storeEmbedding(documentId, embedding, model = 'nomic-embed-text') {
        const id = randomUUID();
        const now = toMySQLDate(new Date());
        await db.execute(`INSERT INTO document_embeddings (id, document_id, embedding, embedding_model, created_at)
       VALUES (?, ?, ?, ?, ?)`, [id, documentId, JSON.stringify(embedding), model, now]);
        return id;
    },
    /**
     * Get embedding by document ID
     */
    async getEmbeddingByDocumentId(documentId) {
        const result = await db.queryOne('SELECT * FROM document_embeddings WHERE document_id = ?', [documentId]);
        if (!result)
            return null;
        return {
            ...result,
            embedding: JSON.parse(result.embedding)
        };
    },
    /**
     * Search for similar documents using vector similarity
     * Note: This is a naive implementation. For production, consider using a dedicated vector DB
     */
    async searchSimilar(clientId, queryEmbedding, limit = 5) {
        // Get all documents and their embeddings for this client
        const results = await db.query(`SELECT 
        dm.id as documentId,
        dm.content,
        dm.source_url as sourceUrl,
        dm.source_type as sourceType,
        de.embedding
       FROM document_metadata dm
       INNER JOIN document_embeddings de ON dm.id = de.document_id
       WHERE dm.client_id = ?`, [clientId]);
        if (results.length === 0) {
            return [];
        }
        // Calculate similarity scores
        const scored = results.map(row => {
            const embedding = JSON.parse(row.embedding);
            const similarity = cosineSimilarity(queryEmbedding, embedding);
            return {
                documentId: row.documentId,
                content: row.content,
                sourceUrl: row.sourceUrl,
                sourceType: row.sourceType,
                similarity
            };
        });
        // Sort by similarity (highest first) and return top N
        return scored
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    },
    /**
     * Generate and store embedding for a document chunk
     */
    async embedDocument(documentId, content, model = 'nomic-embed-text') {
        const embedding = await generateEmbedding(content, model);
        return this.storeEmbedding(documentId, embedding, model);
    },
    /**
     * Delete all embeddings for a client (cleanup)
     */
    async deleteClientEmbeddings(clientId) {
        await db.execute(`DELETE de FROM document_embeddings de
       INNER JOIN document_metadata dm ON de.document_id = dm.id
       WHERE dm.client_id = ?`, [clientId]);
    }
};
