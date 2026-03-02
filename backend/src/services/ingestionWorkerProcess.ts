/**
 * Ingestion Worker — standalone child process entry point.
 *
 * Spawned by index.ts via child_process.fork() so it runs in a separate V8
 * heap, completely isolated from the Express server's memory space.
 * This prevents the large cheerio DOM + embeddings from exhausting the
 * server's heap during ingestion.
 */

import { startIngestionWorker } from './ingestionWorker.js';

// Give the parent process a chance to start fully before the worker begins
// polling so that any startup DB migrations are already applied.
setTimeout(async () => {
  try {
    await startIngestionWorker();
  } catch (e) {
    console.error('[WorkerProcess] Fatal startup error:', e);
    process.exit(1);
  }
}, 2_000);

// Relay parent signals for clean shutdown
process.on('SIGTERM', () => {
  console.log('[WorkerProcess] SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WorkerProcess] SIGINT received, shutting down');
  process.exit(0);
});
