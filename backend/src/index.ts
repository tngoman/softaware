import { createApp } from './app.js';
import { env } from './config/env.js';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { initTeamChatSocket, getIO } from './services/teamChatSocket.js';
import { initChatSocket } from './services/chatSocket.js';
import { siteBuilderService } from './services/siteBuilderService.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[softaware-backend] listening on http://localhost:${env.PORT}`);
  console.log(`[Ollama] Assistant model: ${env.ASSISTANT_OLLAMA_MODEL} | Tools model: ${env.TOOLS_OLLAMA_MODEL} | keep_alive: ${env.OLLAMA_KEEP_ALIVE}`);

  // ── Recover any site generations stuck from a previous crash / restart ──
  siteBuilderService.recoverStuckGenerations()
    .then(n => { if (n > 0) console.log(`[SiteBuilder] Recovered ${n} stuck generation(s) from previous restart`); })
    .catch(err => console.error('[SiteBuilder] Recovery check failed:', err.message));

  // ── Initialise Socket.IO for real-time team chat ──
  const teamIO = initTeamChatSocket(server);
  console.log('[Socket.IO] Team chat socket initialised on /team-chats namespace');

  // ── Initialise Socket.IO for unified staff chat (DMs + groups) ──
  // Reuse the same IO server to avoid duplicate handleUpgrade crashes
  initChatSocket(server, teamIO);
  console.log('[Socket.IO] Staff chat socket initialised on /chat namespace');

  // Spawn the ingestion worker as a separate child process so its heap
  // (cheerio DOM + embeddings) is fully isolated from the Express server.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // In dev (tsx): __dirname is /var/opt/backend/src, we need .ts file
  // In prod (node): __dirname is /var/opt/backend/dist, we need .js file
  const isDev = __dirname.endsWith('/src') || __dirname.includes('/src/');
  const workerExt = isDev ? '.ts' : '.js';
  const workerScript = path.join(__dirname, 'services', `ingestionWorkerProcess${workerExt}`);

  // ── Worker spawn with exponential backoff ──

  const MAX_RESTART_ATTEMPTS = 5;
  const BASE_DELAY_MS = 5_000;
  const MAX_DELAY_MS = 60_000;
  const HEALTHY_UPTIME_MS = 60_000; // reset attempt counter after 60s of stable running

  function spawnWorker(attempt = 0) {
    const w = fork(workerScript, [], {
      env: { ...process.env },
      execArgv: isDev
        ? ['--import', 'tsx', '--max-old-space-size=1024']
        : ['--max-old-space-size=1024'],
    });

    const spawnedAt = Date.now();

    w.on('error', (err) => {
      console.error('[Worker] Child process error:', err.message);
    });

    w.on('exit', (code, signal) => {
      if (code === 0) return; // clean exit, don't restart

      // If the worker ran long enough, reset the attempt counter
      const uptime = Date.now() - spawnedAt;
      const nextAttempt = uptime >= HEALTHY_UPTIME_MS ? 0 : attempt + 1;

      if (nextAttempt > MAX_RESTART_ATTEMPTS) {
        console.error(
          `[Worker] Max restarts reached (${MAX_RESTART_ATTEMPTS}). Manual intervention required.`
        );
        return;
      }

      const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
      console.error(
        `[Worker] Process exited (code=${code}, signal=${signal}), ` +
        `attempt ${nextAttempt}/${MAX_RESTART_ATTEMPTS}, restarting in ${delay / 1000}s`
      );

      setTimeout(() => spawnWorker(nextAttempt), delay);
    });

    console.log(`[Worker] Ingestion worker spawned, pid: ${w.pid}${attempt > 0 ? ` (restart #${attempt})` : ''}`);
    return w;
  }

  spawnWorker();

  // ── Pre-warm Ollama models so the first user message is fast ──
  warmOllamaModels();

  // ── Scheduled: enforce trial package expiry every hour ──
  const TRIAL_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
  setInterval(() => {
  }, TRIAL_CHECK_INTERVAL);
});

/**
 * Fire a tiny prompt at each Ollama model so it loads into RAM immediately
 * instead of waiting for the first real request (cold start can be 5-15 s).
 * Runs in the background — failures are logged but never block startup.
 */
async function warmOllamaModels(): Promise<void> {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, '');
  const keepAlive = env.OLLAMA_KEEP_ALIVE === '-1' ? -1 : env.OLLAMA_KEEP_ALIVE === '0' ? 0 : env.OLLAMA_KEEP_ALIVE;
  const models = [
    { name: env.ASSISTANT_OLLAMA_MODEL, label: 'Assistant' },
    { name: env.TOOLS_OLLAMA_MODEL,     label: 'Tools' },
  ];

  // De-duplicate if both point to the same model
  const unique = models.filter((m, i, arr) => arr.findIndex(x => x.name === m.name) === i);

  for (const m of unique) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m.name,
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
          options: { num_predict: 1 },   // generate exactly 1 token — just enough to force load
          keep_alive: keepAlive,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`[Ollama] ${m.label} model (${m.name}) warmed in ${Date.now() - t0}ms`);
    } catch (err: any) {
      console.warn(`[Ollama] Failed to warm ${m.label} model (${m.name}): ${err.message}`);
    }
  }
}

// Increase timeout to 120s to handle DeepSeek MoE generation (20-60s on CPU)
server.setTimeout(120000);

