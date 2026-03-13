import { createApp } from './app.js';
import { env } from './config/env.js';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { initTeamChatSocket } from './services/teamChatSocket.js';
import { initChatSocket } from './services/chatSocket.js';
const app = createApp();
const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[softaware-backend] listening on http://localhost:${env.PORT}`);
    console.log(`[Ollama] Assistant model: ${env.ASSISTANT_OLLAMA_MODEL} | Tools model: ${env.TOOLS_OLLAMA_MODEL} | keep_alive: ${env.OLLAMA_KEEP_ALIVE}`);
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
    const worker = fork(workerScript, [], {
        env: { ...process.env },
        // Give the worker its own generous heap — it only needs ~50–200 MB in practice
        // but we allow 1 GB to handle unexpectedly large pages gracefully.
        execArgv: isDev
            ? ['--import', 'tsx', '--max-old-space-size=1024'] // tsx loader for TypeScript in dev
            : ['--max-old-space-size=1024'],
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
    // ── Pre-warm Ollama models so the first user message is fast ──
    warmOllamaModels();
});
/**
 * Fire a tiny prompt at each Ollama model so it loads into RAM immediately
 * instead of waiting for the first real request (cold start can be 5-15 s).
 * Runs in the background — failures are logged but never block startup.
 */
async function warmOllamaModels() {
    const base = env.OLLAMA_BASE_URL.replace(/\/$/, '');
    const keepAlive = env.OLLAMA_KEEP_ALIVE === '-1' ? -1 : env.OLLAMA_KEEP_ALIVE === '0' ? 0 : env.OLLAMA_KEEP_ALIVE;
    const models = [
        { name: env.ASSISTANT_OLLAMA_MODEL, label: 'Assistant' },
        { name: env.TOOLS_OLLAMA_MODEL, label: 'Tools' },
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
                    options: { num_predict: 1 }, // generate exactly 1 token — just enough to force load
                    keep_alive: keepAlive,
                }),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            console.log(`[Ollama] ${m.label} model (${m.name}) warmed in ${Date.now() - t0}ms`);
        }
        catch (err) {
            console.warn(`[Ollama] Failed to warm ${m.label} model (${m.name}): ${err.message}`);
        }
    }
}
// Increase timeout to 120s to handle DeepSeek MoE generation (20-60s on CPU)
server.setTimeout(120000);
