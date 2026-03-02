import { createApp } from './app.js';
import { env } from './config/env.js';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[softaware-backend] listening on http://localhost:${env.PORT}`);
  console.log(`[Ollama] Assistant model: ${env.ASSISTANT_OLLAMA_MODEL} | keep_alive: ${env.OLLAMA_KEEP_ALIVE}`);

  // Spawn the ingestion worker as a separate child process so its heap
  // (cheerio DOM + embeddings) is fully isolated from the Express server.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workerScript = path.join(__dirname, 'services', 'ingestionWorkerProcess.js');

  const worker = fork(workerScript, [], {
    env: { ...process.env },
    // Give the worker its own generous heap — it only needs ~50–200 MB in practice
    // but we allow 1 GB to handle unexpectedly large pages gracefully.
    execArgv: ['--max-old-space-size=1024'],
  });

  worker.on('error', (err) => {
    console.error('[Worker] Child process error:', err.message);
  });

  worker.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[Worker] Child process exited (code=${code}, signal=${signal}), restarting in 5s`);
      // Auto-restart on unexpected exit so a single bad job doesn't kill ingestion forever
      setTimeout(() => {
        const w2 = fork(workerScript, [], {
          env: { ...process.env },
          execArgv: ['--max-old-space-size=1024'],
        });
        w2.on('error', (e) => console.error('[Worker] Restart error:', e.message));
        w2.on('exit', (c) => console.log(`[Worker] Restarted process exited with code ${c}`));
        console.log('[Worker] Child process restarted, pid:', w2.pid);
      }, 5_000);
    }
  });

  console.log('[Worker] Ingestion worker process spawned, pid:', worker.pid);
});

// Increase timeout to 120s to handle DeepSeek MoE generation (20-60s on CPU)
server.setTimeout(120000);

