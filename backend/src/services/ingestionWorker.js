/**
 * Ingestion Background Worker
 *
 * Runs every POLL_INTERVAL_MS, picks up ingestion_jobs one at a time.
 * Priority: paid jobs first, then free jobs, ordered by created_at (FIFO within tier).
 *
 * Pipeline per job:
 *   1. Fetch raw content (URL → scrape via cheerio | file → read stored text)
 *   2. Clean content with AI router (free → Ollama, paid → OpenRouter)
 *   3. Chunk into ~800-char segments with 150-char overlap
 *   4. Embed each chunk with nomic-embed-text (local, same for both tiers)
 *   5. Store chunks + embeddings in assistant_knowledge (MySQL) AND sqlite-vec
 *   6. Sync assistants.pages_indexed from completed job count
 *   7. Mark job completed
 */
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, toMySQLDate } from '../db/mysql.js';
import { env } from '../config/env.js';
import { cleanContentWithAI } from './ingestionAIRouter.js';
import { categorizeContent, mergeChecklist, getStoredChecklist } from './knowledgeCategorizer.js';
import { upsertChunks } from './vectorStore.js';
const POLL_INTERVAL_MS = 6_000;
const EMBED_MODEL = 'nomic-embed-text';
const CHUNK_SIZE = 1_200; // larger chunks → fewer embeddings needed
const CHUNK_OVERLAP = 200;
const MAX_CONTENT_CHARS = 15_000; // cap per-job — lower limit prevents OOM on huge pages
const MAX_RETRIES = 3; // fail permanently after 3 attempts
// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------
function chunkText(text) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        let chunk = text.slice(start, end);
        // Try to end on a sentence boundary
        if (end < text.length) {
            const last = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
            if (last > CHUNK_SIZE * 0.6)
                chunk = chunk.slice(0, last + 1);
        }
        const trimmed = chunk.trim();
        if (trimmed.length > 40)
            chunks.push(trimmed);
        const advance = chunk.length - CHUNK_OVERLAP;
        start += advance > 0 ? advance : chunk.length; // never go backwards
    }
    return chunks;
}
function extractTextFromHTML(html) {
    // Hard-limit the HTML string BEFORE cheerio parses it to prevent a huge DOM.
    // 100 KB of HTML yields plenty of useful text for any business page.
    const safeHtml = html.length > 100_000 ? html.slice(0, 100_000) : html;
    const $ = cheerio.load(safeHtml);
    $('script,style,nav,header,footer,iframe,noscript,[role="navigation"],.nav,.menu,.sidebar,.advertisement,.cookie-notice,svg,path').remove();
    // First, collect text from all useful elements
    const textParts = [];
    // Always grab title and meta descriptions first
    $('title').each((_, el) => {
        const t = $(el).text().trim();
        if (t)
            textParts.push(t);
    });
    $('meta[name="description"], meta[property="og:description"]').each((_, el) => {
        const c = $(el).attr('content')?.trim();
        if (c)
            textParts.push(c);
    });
    // Try to get main content area first
    let mainText = '';
    for (const sel of ['main', 'article', '[role="main"]', '.content', '#content', '#main', '.post-content', '.entry-content', '.page-content']) {
        const el = $(sel);
        if (el.length && el.text().trim().length > 50) {
            mainText = el.text();
            break;
        }
    }
    // If no main content found, get body but be more aggressive about cleanup
    if (!mainText || mainText.trim().length < 50) {
        mainText = $('body').text();
    }
    // Collect headings separately for better context
    $('h1, h2, h3').each((_, el) => {
        const t = $(el).text().trim();
        if (t && t.length > 3)
            textParts.push(t);
    });
    // Collect paragraph text
    $('p').each((_, el) => {
        const t = $(el).text().trim();
        if (t && t.length > 20)
            textParts.push(t);
    });
    // Combine everything - prefer structured extraction over raw body
    let text = textParts.length > 3
        ? textParts.join(' ')
        : (mainText || textParts.join(' '));
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    // If we still have very little, try getting ALL text nodes
    if (text.length < 50) {
        const allText = $('body').text().replace(/\s+/g, ' ').trim();
        if (allText.length > text.length)
            text = allText;
    }
    return text;
}
// ---------------------------------------------------------------------------
// Embedding via local Ollama nomic-embed-text
// ---------------------------------------------------------------------------
async function embedText(text) {
    const base = env.OLLAMA_BASE_URL.replace(/\/$/, '');
    const res = await axios.post(`${base}/api/embeddings`, { model: EMBED_MODEL, prompt: text }, { timeout: 30_000 });
    return res.data.embedding;
}
// ---------------------------------------------------------------------------
// Fetch raw content for a URL job
// ---------------------------------------------------------------------------
import https from 'https';
// Create HTTPS agent that accepts self-signed certs (common in dev/internal sites)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
async function fetchURL(url) {
    const res = await axios.get(url, {
        timeout: 20_000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
        maxContentLength: 512 * 1024, // 512 KB cap — plenty for any business page
        maxRedirects: 5,
        httpsAgent, // Accept self-signed SSL certs
    });
    const html = String(res.data).slice(0, 400_000); // extra safety: trim before cheerio parse
    return extractTextFromHTML(html);
}
// ---------------------------------------------------------------------------
// Process a single ingestion job
// ---------------------------------------------------------------------------
async function processJob(job) {
    const now = toMySQLDate(new Date());
    console.log(`[Worker] Processing ${job.tier.toUpperCase()} job ${job.id} (${job.job_type}: ${job.source.slice(0, 60)})`);
    try {
        // 1. Obtain raw content
        let raw;
        if (job.job_type === 'url') {
            raw = await fetchURL(job.source);
        }
        else {
            if (!job.file_content)
                throw new Error('file_content is missing for file job');
            raw = job.file_content;
        }
        if (raw.length < 20)
            throw new Error('Content too short after extraction');
        // Cap total content to keep embedding count manageable (≤ ~25 chunks).
        const capped = raw.slice(0, MAX_CONTENT_CHARS);
        // 2. AI cleaning — only for paid tier (uses fast OpenRouter).
        //    Free tier skips cleaning to avoid slow local Ollama inference (CPU-only).
        //    cheerio extraction already strips tags/scripts so the text is usable as-is.
        let cleaned;
        if (job.tier === 'paid') {
            const AI_CLEAN_LIMIT = 8_000;
            const toClean = capped.slice(0, AI_CLEAN_LIMIT);
            const overflow = capped.length > AI_CLEAN_LIMIT ? capped.slice(AI_CLEAN_LIMIT) : '';
            const cleanedHead = await cleanContentWithAI(toClean, job.tier);
            cleaned = overflow ? cleanedHead + '\n\n' + overflow : cleanedHead;
        }
        else {
            // Free tier: use raw extracted text directly (already stripped of HTML by cheerio)
            cleaned = capped;
        }
        // 3. Chunk
        const chunks = chunkText(cleaned);
        if (chunks.length === 0)
            throw new Error('No chunks generated after cleaning');
        // 4. Embed chunks sequentially to avoid peak-memory GC spikes from concurrent HTTP buffers.
        //    Ollama serialises requests internally anyway so parallelism doesn't help throughput.
        const embeddings = [];
        for (let i = 0; i < chunks.length; i++) {
            try {
                embeddings.push(await embedText(chunks[i]));
            }
            catch (e) {
                console.warn(`[Worker] Embedding failed for chunk ${i}:`, e.message);
                embeddings.push(null);
            }
        }
        // 5. Bulk-insert all chunks in one query
        const valuePlaceholders = chunks.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
        const flatValues = [];
        chunks.forEach((chunk, i) => {
            flatValues.push(randomUUID(), job.assistant_id, job.id, chunk, job.source, job.job_type, i, chunk.length, embeddings[i] ? JSON.stringify(embeddings[i]) : null, now);
        });
        await db.execute(`INSERT INTO assistant_knowledge
        (id, assistant_id, job_id, content, source, source_type, chunk_index, char_count, embedding, created_at)
       VALUES ${valuePlaceholders}`, flatValues);
        const stored = chunks.length;
        // 5b. Store in sqlite-vec for fast vector search (RAG retrieval)
        const vecChunks = [];
        chunks.forEach((chunk, i) => {
            if (embeddings[i]) {
                vecChunks.push({
                    id: flatValues[i * 10], // the UUID we generated above
                    assistantId: job.assistant_id,
                    jobId: job.id,
                    content: chunk,
                    source: job.source,
                    sourceType: job.job_type,
                    chunkIndex: i,
                    charCount: chunk.length,
                    embedding: embeddings[i],
                    createdAt: now
                });
            }
        });
        if (vecChunks.length > 0) {
            try {
                upsertChunks(vecChunks);
                console.log(`[Worker] sqlite-vec: stored ${vecChunks.length} vectors`);
            }
            catch (vecErr) {
                console.warn('[Worker] sqlite-vec upsert failed (non-fatal):', vecErr.message);
            }
        }
        // 6. Sync pages_indexed from reality (count of completed jobs)
        //    Computed, not incremented — always accurate even after deletes/failures.
        await db.execute(`UPDATE assistants SET pages_indexed = (
         SELECT COUNT(*) FROM ingestion_jobs
         WHERE assistant_id = ? AND status = 'completed'
       ) + 1 WHERE id = ?`, [job.assistant_id, job.assistant_id]);
        // 7. Categorize content for Knowledge Health Score (dynamic checklist)
        try {
            const checklist = await getStoredChecklist(job.assistant_id);
            const newResults = await categorizeContent(cleaned, checklist);
            await mergeChecklist(job.assistant_id, newResults);
            console.log(`[Worker] Checklist updated for ${job.assistant_id}`);
        }
        catch (catError) {
            console.warn(`[Worker] Categorization failed (non-fatal):`, catError.message);
        }
        await db.execute(`UPDATE ingestion_jobs
       SET status = 'completed', chunks_created = ?, updated_at = ?, file_content = NULL
       WHERE id = ?`, [stored, now, job.id]);
        console.log(`[Worker] ✓ Job ${job.id} done — ${stored} chunks stored`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] ✗ Job ${job.id} failed:`, msg);
        await db.execute(`UPDATE ingestion_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`, [msg.slice(0, 1000), toMySQLDate(new Date()), job.id]);
    }
}
// ---------------------------------------------------------------------------
// Poll loop — paid jobs always dequeued before free jobs
// ---------------------------------------------------------------------------
let running = false;
async function poll() {
    if (running)
        return;
    running = true;
    try {
        // Paid-first priority sort within pending jobs (skip jobs that exceeded retry limit)
        const job = await db.queryOne(`SELECT id, assistant_id, job_type, source, file_content, tier, retry_count
       FROM ingestion_jobs
       WHERE status = 'pending' AND retry_count < ${MAX_RETRIES}
       ORDER BY
         CASE tier WHEN 'paid' THEN 0 ELSE 1 END ASC,
         created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`);
        if (!job) {
            running = false;
            return;
        }
        // Mark processing and bump retry counter
        await db.execute(`UPDATE ingestion_jobs SET status = 'processing', retry_count = retry_count + 1, updated_at = ? WHERE id = ?`, [toMySQLDate(new Date()), job.id]);
        console.log(`[Worker] Attempt ${job.retry_count + 1}/${MAX_RETRIES} for job ${job.id}`);
        // Wrap processJob in a 120s timeout so a hung URL can never stall the worker
        const JOB_TIMEOUT_MS = 120_000;
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Job timed out after ${JOB_TIMEOUT_MS / 1000}s`)), JOB_TIMEOUT_MS));
        await Promise.race([processJob(job), timeoutPromise]).catch(async (e) => {
            const msg = e.message;
            console.error(`[Worker] Job ${job.id} failed (attempt ${job.retry_count + 1}):`, msg);
            // If this was the last retry, mark as permanently failed; otherwise back to pending
            const newStatus = job.retry_count + 1 >= MAX_RETRIES ? 'failed' : 'pending';
            await db.execute(`UPDATE ingestion_jobs SET status = ?, error_message = ?, updated_at = ? WHERE id = ?`, [newStatus, msg.slice(0, 1000), toMySQLDate(new Date()), job.id]).catch(() => { });
            if (newStatus === 'failed') {
                console.error(`[Worker] Job ${job.id} permanently failed after ${MAX_RETRIES} attempts`);
            }
        });
    }
    catch (e) {
        console.error('[Worker] Poll error:', e.message);
    }
    running = false;
}
// ---------------------------------------------------------------------------
// Exported start function — call once from index.ts
// ---------------------------------------------------------------------------
export async function startIngestionWorker() {
    // Recover jobs left in 'processing' state from a previous crash.
    // Jobs that have already been retried MAX_RETRIES times get permanently failed.
    const now = toMySQLDate(new Date());
    await db.execute(`UPDATE ingestion_jobs SET status = 'failed', error_message = 'Max retries exceeded (worker crash)', updated_at = ?
     WHERE status = 'processing' AND retry_count >= ${MAX_RETRIES}`, [now]).catch(() => { });
    await db.execute(`UPDATE ingestion_jobs SET status = 'pending', updated_at = ?
     WHERE status = 'processing' AND retry_count < ${MAX_RETRIES}`, [now]).catch(e => console.error('[Worker] Recovery query failed:', e.message));
    // Also fail any pending jobs that somehow exceeded retries
    await db.execute(`UPDATE ingestion_jobs SET status = 'failed', error_message = 'Max retries exceeded', updated_at = ?
     WHERE status = 'pending' AND retry_count >= ${MAX_RETRIES}`, [now]).catch(() => { });
    console.log(`[Worker] Ingestion worker started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
    setInterval(poll, POLL_INTERVAL_MS);
    poll();
}
