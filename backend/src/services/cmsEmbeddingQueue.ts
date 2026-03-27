/**
 * cmsEmbeddingQueue.ts — Background Embedding Worker for CMS Data
 *
 * When a CMS record is saved (POST/PUT), the controller queues
 * an embedding job instead of blocking the HTTP response. This
 * worker picks up jobs, generates embeddings via Ollama
 * (nomic-embed-text), and writes the result to sqlite-vec via
 * cmsVectorStore.
 *
 * The queue is an in-memory array (good enough for single-process).
 * If the process crashes, unprocessed jobs are lost but the MySQL
 * record survives — a reconciliation endpoint can re-embed later.
 */

import { generateEmbedding } from './embeddingService.js';
import { upsertCmsChunk, deleteCmsChunk } from './cmsVectorStore.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CmsEmbeddingJob {
  itemId: string;
  clientId: string;
  collectionName: string;
  textToEmbed: string;
  operation: 'upsert' | 'delete';
}

// ---------------------------------------------------------------------------
// In-memory job queue
// ---------------------------------------------------------------------------
const queue: CmsEmbeddingJob[] = [];
let processing = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const POLL_INTERVAL_MS = 2_000;   // check queue every 2 seconds
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Public: enqueue a job
// ---------------------------------------------------------------------------

/**
 * Queue an embedding job for a CMS record.
 * Returns immediately — the embedding happens asynchronously.
 */
export function queueEmbeddingJob(job: CmsEmbeddingJob): void {
  queue.push(job);
  // If the worker isn't running yet, start it
  if (!pollTimer) {
    startCmsEmbeddingWorker();
  }
}

// ---------------------------------------------------------------------------
// Worker logic
// ---------------------------------------------------------------------------

async function processNextJob(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;

  const job = queue.shift()!;

  try {
    if (job.operation === 'delete') {
      // Just remove from sqlite-vec — no embedding needed
      deleteCmsChunk(job.itemId);
      console.log(`[CMS-Embed] Deleted vector for item ${job.itemId}`);
    } else {
      // Generate embedding via Ollama (nomic-embed-text, 768-dim)
      const embedding = await generateEmbedding(job.textToEmbed);

      // Write to sqlite-vec
      upsertCmsChunk({
        itemId: job.itemId,
        clientId: job.clientId,
        collectionName: job.collectionName,
        textToEmbed: job.textToEmbed,
        embedding
      });

      console.log(`[CMS-Embed] Shadowed CMS item ${job.itemId} (${job.collectionName}) → sqlite-vec`);
    }
  } catch (error) {
    const retryCount = (job as any)._retries || 0;
    if (retryCount < MAX_RETRIES) {
      (job as any)._retries = retryCount + 1;
      queue.push(job); // Re-queue for retry
      console.warn(`[CMS-Embed] Failed item ${job.itemId}, retrying (${retryCount + 1}/${MAX_RETRIES}):`, (error as Error).message);
    } else {
      console.error(`[CMS-Embed] Permanently failed item ${job.itemId} after ${MAX_RETRIES} retries:`, error);
    }
  } finally {
    processing = false;
  }
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

export function startCmsEmbeddingWorker(): void {
  if (pollTimer) return; // already running

  pollTimer = setInterval(() => {
    processNextJob().catch(err =>
      console.error('[CMS-Embed] Unexpected worker error:', err)
    );
  }, POLL_INTERVAL_MS);

  console.log(`[CMS-Embed] Worker started (poll every ${POLL_INTERVAL_MS}ms)`);
}

export function stopCmsEmbeddingWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[CMS-Embed] Worker stopped');
  }
}

/**
 * Get the current queue depth (for health/stats endpoints).
 */
export function getCmsQueueDepth(): number {
  return queue.length;
}
