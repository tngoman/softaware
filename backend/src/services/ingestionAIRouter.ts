/**
 * Ingestion AI Router
 *
 * Free tier  → local Ollama (qwen2.5:3b-instruct) — queued, slower
 * Paid tier  → OpenRouter (google/gemma-3-4b-it:free or configurable) — priority, fast
 *
 * Both tiers use the same nomic-embed-text embeddings so vectors stay compatible.
 */

import { env } from '../config/env.js';

const CLEAN_SYSTEM_PROMPT = `You are a content extraction assistant.
Given raw text scraped from a web page or document, extract ONLY the meaningful informational content.
Remove: navigation menus, cookie notices, footer links, repetitive headers, ads, "read more" links, social sharing text.
Keep: product descriptions, FAQs, pricing info, contact details, business information, policies, and any factual content about the business.
Return only the cleaned text, no commentary.`;

export async function cleanContentWithAI(
  rawContent: string,
  tier: 'free' | 'paid'
): Promise<string> {
  // Truncate very long content to avoid token limits
  const truncated = rawContent.slice(0, 12000);

  if (tier === 'paid') {
    return cleanWithOpenRouter(truncated);
  }
  return cleanWithOllama(truncated);
}

// ---------------------------------------------------------------------------
// Paid: OpenRouter
// ---------------------------------------------------------------------------
async function cleanWithOpenRouter(content: string): Promise<string> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[IngestionRouter] No OPENROUTER_API_KEY — falling back to Ollama for paid job');
    return cleanWithOllama(content);
  }

  const model = env.INGESTION_OPENROUTER_MODEL || 'google/gemma-3-4b-it:free';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://softaware.net.za',
      'X-Title': 'Softaware Ingestion',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: CLEAN_SYSTEM_PROMPT },
        { role: 'user', content: content },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  return (data.choices?.[0]?.message?.content ?? content).trim();
}

// ---------------------------------------------------------------------------
// Free: Local Ollama
// ---------------------------------------------------------------------------
async function cleanWithOllama(content: string): Promise<string> {
  const baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, '');
  const model = env.INGESTION_OLLAMA_MODEL || 'qwen2.5:3b-instruct';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: 60,
      messages: [
        { role: 'system', content: CLEAN_SYSTEM_PROMPT },
        { role: 'user', content: content },
      ],
      options: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama cleaning error ${response.status}`);
  }

  const data = (await response.json()) as any;
  return (data.message?.content ?? content).trim();
}
