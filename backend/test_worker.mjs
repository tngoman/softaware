import { randomUUID } from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CONTENT_CHARS = 30000;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let chunk = text.slice(start, end);
    if (end < text.length) {
      const last = Math.max(chunk.lastIndexOf('.'), chunk.lastIndexOf('?'), chunk.lastIndexOf('!'));
      if (last > CHUNK_SIZE * 0.6) chunk = chunk.slice(0, last + 1);
    }
    const trimmed = chunk.trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    start = start + CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

async function embedText(text) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

console.log('Starting...');
const t0 = Date.now();

// Step 1: Fetch
console.log('Fetching HN...');
const res = await axios.get('https://news.ycombinator.com', {
  timeout: 20000, headers: { 'User-Agent': 'test' }, maxContentLength: 512*1024
});
const html = String(res.data).slice(0, 400000);
console.log(`HTML: ${html.length} chars in ${Date.now()-t0}ms`);

// Step 2: Parse
const $ = cheerio.load(html);
$('script,style,nav,header,footer').remove();
let text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_CONTENT_CHARS);
console.log(`Text: ${text.length} chars`);

// Step 3: Chunk
const chunks = chunkText(text);
console.log(`Chunks: ${chunks.length}`);

// Step 4: Embed
for (let i = 0; i < chunks.length; i++) {
  const t1 = Date.now();
  const emb = await embedText(chunks[i]);
  const memMB = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Chunk ${i}: ${emb.length} floats in ${Date.now()-t1}ms | heap: ${memMB.toFixed(1)}MB`);
}

console.log(`TOTAL: ${Date.now()-t0}ms | final heap: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(1)}MB`);
