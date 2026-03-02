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
 *   5. Store chunks + embeddings in assistant_knowledge
 *   6. Increment assistants.pages_indexed
 *   7. Mark job completed
 */

import { randomUUID } from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, toMySQLDate } from '../db/mysql.js';
import { env } from '../config/env.js';
import { cleanContentWithAI } from './ingestionAIRouter.js';
import { categorizeContent, mergeChecklist, getStoredChecklist } from './knowledgeCategorizer.js';

const POLL_INTERVAL_MS = 6_000;
const EMBED_MODEL = 'nomic-embed-text';
const CHUNK_SIZE = 1_200;   // larger chunks → fewer embeddings needed
const CHUNK_OVERLAP = 200;
const MAX_CONTENT_CHARS = 30_000; // cap per-job to keep embedding time < 60s (~25 chunks max)

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let chunk = text.slice(start, end);

    // Try to end on a sentence boundary
    if (end < text.length) {
      const last = Math.max(
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('?'),
        chunk.lastIndexOf('!')
      );
      if (last > CHUNK_SIZE * 0.6) chunk = chunk.slice(0, last + 1);
    }

    const trimmed = chunk.trim();
    if (trimmed.length > 40) chunks.push(trimmed);
    start += chunk.length - CHUNK_OVERLAP;
  }

  return chunks;
}

function extractTextFromHTML(html: string): string {
  // Hard-limit the HTML string BEFORE cheerio parses it to prevent a huge DOM.
  // 200 KB of HTML yields plenty of useful text for any page.
  const safeHtml = html.length > 200_000 ? html.slice(0, 200_000) : html;

  const $ = cheerio.load(safeHtml);
  $('script,style,nav,header,footer,iframe,noscript,[role="navigation"],.nav,.menu,.sidebar,.advertisement,.cookie-notice,svg,path').remove();

  // First, collect text from all useful elements
  const textParts: string[] = [];
  
  // Always grab title and meta descriptions first
  $('title').each((_, el) => { 
    const t = $(el).text().trim();
    if (t) textParts.push(t); 
  });
  $('meta[name="description"], meta[property="og:description"]').each((_, el) => {
    const c = $(el).attr('content')?.trim();
    if (c) textParts.push(c);
  });

  // Try to get main content area first
  let mainText = '';
  for (const sel of ['main','article','[role="main"]','.content','#content','#main','.post-content','.entry-content','.page-content']) {
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
    if (t && t.length > 3) textParts.push(t); 
  });

  // Collect paragraph text
  $('p').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 20) textParts.push(t);
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
    if (allText.length > text.length) text = allText;
  }

  return text;
}

// ---------------------------------------------------------------------------
// Embedding via local Ollama nomic-embed-text
// ---------------------------------------------------------------------------
async function embedText(text: string): Promise<number[]> {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, '');
  const res = await axios.post<{ embedding: number[] }>(
    `${base}/api/embeddings`,
    { model: EMBED_MODEL, prompt: text },
    { timeout: 30_000 }
  );
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

async function fetchURL(url: string): Promise<string> {
  const res = await axios.get(url, {
    timeout: 20_000,
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    maxContentLength: 512 * 1024,  // 512 KB cap — plenty for any business page
    maxRedirects: 5,
    httpsAgent, // Accept self-signed SSL certs
  });
  const html = String(res.data).slice(0, 400_000); // extra safety: trim before cheerio parse
  return extractTextFromHTML(html);
}

// ---------------------------------------------------------------------------
// Process a single ingestion job
// ---------------------------------------------------------------------------
async function processJob(job: {
  id: string;
  assistant_id: string;
  job_type: 'url' | 'file';
  source: string;
  file_content: string | null;
  tier: 'free' | 'paid';
}): Promise<void> {
  const now = toMySQLDate(new Date());
  console.log(`[Worker] Processing ${job.tier.toUpperCase()} job ${job.id} (${job.job_type}: ${job.source.slice(0, 60)})`);

  try {
    // 1. Obtain raw content
    let raw: string;
    if (job.job_type === 'url') {
      raw = await fetchURL(job.source);
    } else {
      if (!job.file_content) throw new Error('file_content is missing for file job');
      raw = job.file_content;
    }

    if (raw.length < 20) throw new Error('Content too short after extraction');

    // Cap total content to keep embedding count manageable (≤ ~25 chunks).
    const capped = raw.slice(0, MAX_CONTENT_CHARS);

    // 2. AI cleaning — only for paid tier (uses fast OpenRouter).
    //    Free tier skips cleaning to avoid slow local Ollama inference (CPU-only).
    //    cheerio extraction already strips tags/scripts so the text is usable as-is.
    let cleaned: string;
    if (job.tier === 'paid') {
      const AI_CLEAN_LIMIT = 8_000;
      const toClean = capped.slice(0, AI_CLEAN_LIMIT);
      const overflow = capped.length > AI_CLEAN_LIMIT ? capped.slice(AI_CLEAN_LIMIT) : '';
      const cleanedHead = await cleanContentWithAI(toClean, job.tier);
      cleaned = overflow ? cleanedHead + '\n\n' + overflow : cleanedHead;
    } else {
      // Free tier: use raw extracted text directly (already stripped of HTML by cheerio)
      cleaned = capped;
    }

    // 3. Chunk
    const chunks = chunkText(cleaned);
    if (chunks.length === 0) throw new Error('No chunks generated after cleaning');

    // 4. Embed chunks sequentially to avoid peak-memory GC spikes from concurrent HTTP buffers.
    //    Ollama serialises requests internally anyway so parallelism doesn't help throughput.
    const embeddings: (number[] | null)[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        embeddings.push(await embedText(chunks[i]));
      } catch (e) {
        console.warn(`[Worker] Embedding failed for chunk ${i}:`, (e as Error).message);
        embeddings.push(null);
      }
    }

    // 5. Bulk-insert all chunks in one query
    const valuePlaceholders = chunks.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
    const flatValues: unknown[] = [];
    chunks.forEach((chunk, i) => {
      flatValues.push(
        randomUUID(), job.assistant_id, job.id,
        chunk, job.source, job.job_type,
        i, chunk.length,
        embeddings[i] ? JSON.stringify(embeddings[i]) : null,
        now
      );
    });
    await db.execute(
      `INSERT INTO assistant_knowledge
        (id, assistant_id, job_id, content, source, source_type, chunk_index, char_count, embedding, created_at)
       VALUES ${valuePlaceholders}`,
      flatValues
    );
    const stored = chunks.length;

    // 6. Update assistant page count and job status
    await db.execute(
      `UPDATE assistants SET pages_indexed = pages_indexed + 1 WHERE id = ?`,
      [job.assistant_id]
    );

    // 7. Categorize content for Knowledge Health Score (dynamic checklist)
    try {
      const checklist = await getStoredChecklist(job.assistant_id);
      const newResults = await categorizeContent(cleaned, checklist);
      await mergeChecklist(job.assistant_id, newResults);
      console.log(`[Worker] Checklist updated for ${job.assistant_id}`);
    } catch (catError) {
      console.warn(`[Worker] Categorization failed (non-fatal):`, (catError as Error).message);
    }

    await db.execute(
      `UPDATE ingestion_jobs
       SET status = 'completed', chunks_created = ?, updated_at = ?, file_content = NULL
       WHERE id = ?`,
      [stored, now, job.id]
    );

    console.log(`[Worker] ✓ Job ${job.id} done — ${stored} chunks stored`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] ✗ Job ${job.id} failed:`, msg);
    await db.execute(
      `UPDATE ingestion_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`,
      [msg.slice(0, 1000), toMySQLDate(new Date()), job.id]
    );
  }
}

// ---------------------------------------------------------------------------
// Poll loop — paid jobs always dequeued before free jobs
// ---------------------------------------------------------------------------
let running = false;

async function poll(): Promise<void> {
  if (running) return;
  running = true;

  try {
    // Paid-first priority sort within pending jobs
    const job = await db.queryOne<{
      id: string;
      assistant_id: string;
      job_type: 'url' | 'file';
      source: string;
      file_content: string | null;
      tier: 'free' | 'paid';
    }>(
      `SELECT id, assistant_id, job_type, source, file_content, tier
       FROM ingestion_jobs
       WHERE status = 'pending'
       ORDER BY
         CASE tier WHEN 'paid' THEN 0 ELSE 1 END ASC,
         created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`
    );

    if (!job) { running = false; return; }

    // Mark processing immediately to prevent double-pickup
    await db.execute(
      `UPDATE ingestion_jobs SET status = 'processing', updated_at = ? WHERE id = ?`,
      [toMySQLDate(new Date()), job.id]
    );

    // Wrap processJob in a 180s timeout so a hung URL can never stall the worker
    const JOB_TIMEOUT_MS = 180_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Job timed out after 90s')), JOB_TIMEOUT_MS)
    );
    await Promise.race([processJob(job), timeoutPromise]).catch(async (e) => {
      console.error(`[Worker] Job ${job.id} failed:`, (e as Error).message);
      await db.execute(
        `UPDATE ingestion_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`,
        [(e as Error).message, toMySQLDate(new Date()), job.id]
      ).catch(() => {});
    });
  } catch (e) {
    console.error('[Worker] Poll error:', (e as Error).message);
  }

  running = false;
}

// ---------------------------------------------------------------------------
// Exported start function — call once from index.ts
// ---------------------------------------------------------------------------
export async function startIngestionWorker(): Promise<void> {
  // Recover any jobs left in 'processing' state from a previous crashed worker
  await db.execute(
    `UPDATE ingestion_jobs SET status = 'pending', updated_at = ? WHERE status = 'processing'`,
    [toMySQLDate(new Date())]
  ).catch(e => console.error('[Worker] Recovery query failed:', (e as Error).message));

  console.log(`[Worker] Ingestion worker started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
  setInterval(poll, POLL_INTERVAL_MS);
  poll();
}
