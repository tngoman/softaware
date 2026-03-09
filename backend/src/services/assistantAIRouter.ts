/**
 * Assistant AI Router
 *
 * Routes assistant chat requests based on tier with cascading fallback:
 *
 *   Free tier  → GLM → Ollama
 *   Paid tier  → GLM → OpenRouter (gpt-4o-mini) → Ollama
 *
 * Provides both streaming (SSE for /api/assistants/chat) and
 * non-streaming (for mobileAIProcessor) interfaces.
 *
 * GLM (ZhipuAI) uses the Anthropic-compatible Messages API at
 * api.z.ai/api/anthropic.  The Coding Lite plan grants access via
 * this endpoint.  GLM is tried first for ALL tiers.  OpenRouter
 * is only used as a paid-tier fallback.  Ollama is always the
 * last resort.
 */

import { env } from '../config/env.js';
import { getSecret } from './credentialVault.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
}

export type PaidProvider = 'glm' | 'openrouter' | 'ollama';

// ─── Constants ───────────────────────────────────────────────────────────────

const OLLAMA_BASE = env.OLLAMA_BASE_URL.replace(/\/$/, '');
const OLLAMA_MODEL = env.ASSISTANT_OLLAMA_MODEL;
const GLM_BASE_URL = 'https://api.z.ai/api/anthropic';
const GLM_MODEL = env.GLM_MODEL || 'glm-4.6';
const OPENROUTER_FALLBACK_MODEL = env.OPENROUTER_FALLBACK_MODEL || 'openai/gpt-4o-mini';
const KEEP_ALIVE = env.OLLAMA_KEEP_ALIVE;
const keepAliveValue = KEEP_ALIVE === '-1' ? -1 : KEEP_ALIVE === '0' ? 0 : KEEP_ALIVE;

// ─── Key Cache ───────────────────────────────────────────────────────────────

let _glmKey: string | null | undefined;
let _glmKeyFetched = false;

let _openRouterKey: string | null | undefined;
let _orKeyFetched = false;

async function getGLMKey(): Promise<string | null> {
  if (_glmKeyFetched) return _glmKey ?? null;
  try {
    const secret = await getSecret('GLM', env.GLM);
    _glmKey = secret || null;
    if (_glmKey) {
      console.log(`[AssistantRouter] GLM key loaded (${_glmKey.substring(0, 8)}...)`);
    } else {
      console.warn('[AssistantRouter] No GLM key found');
    }
  } catch (err) {
    console.error('[AssistantRouter] Failed to fetch GLM key:', err);
    _glmKey = null;
  }
  _glmKeyFetched = true;
  return _glmKey;
}

async function getOpenRouterKey(): Promise<string | null> {
  if (_orKeyFetched) return _openRouterKey ?? null;
  try {
    const secret = await getSecret('OPENROUTER');
    _openRouterKey = secret || null;
    if (_openRouterKey) {
      console.log(`[AssistantRouter] OpenRouter key loaded (${_openRouterKey.substring(0, 12)}...)`);
    } else {
      console.warn('[AssistantRouter] No OpenRouter key found in vault');
    }
  } catch (err) {
    console.error('[AssistantRouter] Failed to fetch OpenRouter key:', err);
    _openRouterKey = null;
  }
  _orKeyFetched = true;
  return _openRouterKey;
}

/**
 * Should this tier use external providers (GLM / OpenRouter)?
 * Returns true only if tier is 'paid' AND we have at least one external key.
 */
export async function shouldUseOpenRouter(tier: string): Promise<boolean> {
  if (tier !== 'paid') return false;
  const glm = await getGLMKey();
  const or = await getOpenRouterKey();
  if (!glm && !or) {
    console.warn('[AssistantRouter] No GLM or OpenRouter keys — paid tier falling back to Ollama');
    return false;
  }
  return true;
}

// ─── GLM Chat (Anthropic Messages API) ───────────────────────────────────────

/**
 * Build the Anthropic-compatible request body for GLM.
 * Extracts the first system message (if any) into the top-level `system`
 * field, and maps the rest as user/assistant messages.
 */
function buildGLMBody(messages: ChatMessage[], opts: ChatOptions, stream = false) {
  let system: string | undefined;
  const filtered: { role: string; content: string }[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system = m.content;
    } else {
      filtered.push({ role: m.role, content: m.content });
    }
  }
  const body: Record<string, unknown> = {
    model: GLM_MODEL,
    max_tokens: opts.max_tokens ?? 2048,
    messages: filtered,
  };
  if (system) body.system = system;
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (stream) body.stream = true;
  return body;
}

async function glmChat(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<{ content: string; model: string; provider: 'glm' }> {
  const apiKey = await getGLMKey();
  if (!apiKey) throw new Error('GLM key not available');

  const res = await fetch(`${GLM_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGLMBody(messages, opts)),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GLM ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await res.json();
  // Anthropic response: { content: [{ type: "text", text: "..." }] }
  const text = data.content
    ?.filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('') ?? '';
  return {
    content: text.trim(),
    model: data.model || GLM_MODEL,
    provider: 'glm',
  };
}

async function glmStream(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; model: string; provider: 'glm' }> {
  const apiKey = await getGLMKey();
  if (!apiKey) throw new Error('GLM key not available');

  const res = await fetch(`${GLM_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGLMBody(messages, opts, true)),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '');
    throw new Error(`GLM stream ${res.status}: ${err.slice(0, 200)}`);
  }

  return { stream: res.body, model: GLM_MODEL, provider: 'glm' };
}

// ─── OpenRouter Chat ─────────────────────────────────────────────────────────

async function openRouterChat(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<{ content: string; model: string; provider: 'openrouter' }> {
  const apiKey = await getOpenRouterKey();
  if (!apiKey) throw new Error('OpenRouter key not available');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://softaware.net.za',
      'X-Title': 'Softaware Assistant Chat',
    },
    body: JSON.stringify({
      model: OPENROUTER_FALLBACK_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? 0.4,
      top_p: opts.top_p ?? 0.9,
      max_tokens: opts.max_tokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) _openRouterKey = null;
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await res.json();
  return {
    content: (data.choices?.[0]?.message?.content ?? '').trim(),
    model: OPENROUTER_FALLBACK_MODEL,
    provider: 'openrouter',
  };
}

async function openRouterStream(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; model: string; provider: 'openrouter' }> {
  const apiKey = await getOpenRouterKey();
  if (!apiKey) throw new Error('OpenRouter key not available');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://softaware.net.za',
      'X-Title': 'Softaware Assistant Chat',
    },
    body: JSON.stringify({
      model: OPENROUTER_FALLBACK_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? 0.4,
      top_p: opts.top_p ?? 0.9,
      max_tokens: opts.max_tokens ?? 2048,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) _openRouterKey = null;
    throw new Error(`OpenRouter stream ${res.status}: ${err.slice(0, 200)}`);
  }

  return { stream: res.body, model: OPENROUTER_FALLBACK_MODEL, provider: 'openrouter' };
}

// ─── Ollama Chat (final fallback) ────────────────────────────────────────────

async function ollamaChat(
  messages: ChatMessage[],
  opts: ChatOptions,
  modelOverride?: string,
): Promise<{ content: string; model: string; provider: 'ollama' }> {
  const model = modelOverride || OLLAMA_MODEL;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      keep_alive: keepAliveValue,
      options: {
        temperature: opts.temperature ?? 0.4,
        top_p: opts.top_p ?? 0.9,
        top_k: opts.top_k ?? 40,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await res.json();
  return {
    content: data.message?.content?.trim() || '',
    model,
    provider: 'ollama',
  };
}

async function ollamaStream(
  messages: ChatMessage[],
  opts: ChatOptions,
  modelOverride?: string,
): Promise<{ stream: ReadableStream<Uint8Array>; model: string; provider: 'ollama' }> {
  const model = modelOverride || OLLAMA_MODEL;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: keepAliveValue,
      options: {
        temperature: opts.temperature ?? 0.4,
        top_p: opts.top_p ?? 0.9,
        top_k: opts.top_k ?? 40,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama stream error ${res.status}: ${body.slice(0, 200)}`);
  }

  return { stream: res.body, model, provider: 'ollama' };
}

// ─── Non-Streaming: 3-Tier Fallback ─────────────────────────────────────────

/**
 * Send a chat request and return the full response string.
 *
 * Free tier fallback chain:
 *   1. GLM (free under Coding Lite plan)
 *   2. Ollama (local fallback)
 *
 * Paid tier fallback chain:
 *   1. GLM (free under Coding Lite plan)
 *   2. OpenRouter / gpt-4o-mini (reliable paid fallback)
 *   3. Ollama (last resort)
 */
export async function chatCompletion(
  tier: string,
  messages: ChatMessage[],
  opts: ChatOptions = {},
  modelOverride?: string,
): Promise<{ content: string; model: string; provider: PaidProvider }> {
  // ── 1. GLM (tried first for ALL tiers) ──
  const glmKey = await getGLMKey();
  if (glmKey) {
    try {
      return await glmChat(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] GLM failed: ${(err as Error).message} — trying ${tier === 'paid' ? 'OpenRouter' : 'Ollama'}`);
    }
  }

  // ── 2. OpenRouter (paid tier only) ──
  if (tier !== 'paid') {
    return ollamaChat(messages, opts, modelOverride);
  }
  const orKey = await getOpenRouterKey();
  if (orKey) {
    try {
      return await openRouterChat(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] OpenRouter failed: ${(err as Error).message} — falling back to Ollama`);
    }
  }

  // ── 3. Ollama (last resort) ──
  console.warn('[AssistantRouter] All external providers failed — using Ollama');
  return ollamaChat(messages, opts, modelOverride);
}

// ─── Streaming: 3-Tier Fallback ──────────────────────────────────────────────

/**
 * Stream a chat response. Returns a ReadableStream of raw bytes.
 *
 * Free tier:  GLM → Ollama
 * Paid tier:  GLM → OpenRouter → Ollama
 *
 * GLM returns Anthropic SSE (event: content_block_delta, data: {delta:{text:"..."}}).
 * OpenRouter returns OpenAI-compatible SSE (data: {choices:[{delta:{content:"..."}}]}).
 * Ollama returns NDJSON. The caller (assistants.ts) handles all three
 * formats by checking the `provider` field.
 */
export async function chatCompletionStream(
  tier: string,
  messages: ChatMessage[],
  opts: ChatOptions = {},
  modelOverride?: string,
): Promise<{
  stream: ReadableStream<Uint8Array>;
  model: string;
  provider: PaidProvider;
}> {
  // ── 1. GLM (tried first for ALL tiers) ──
  const glmKey = await getGLMKey();
  if (glmKey) {
    try {
      return await glmStream(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] GLM stream failed: ${(err as Error).message} — trying ${tier === 'paid' ? 'OpenRouter' : 'Ollama'}`);
    }
  }

  // ── 2. OpenRouter (paid tier only) ──
  if (tier !== 'paid') {
    return ollamaStream(messages, opts, modelOverride);
  }
  const orKey = await getOpenRouterKey();
  if (orKey) {
    try {
      return await openRouterStream(messages, opts);
    } catch (err) {
      console.warn(`[AssistantRouter] OpenRouter stream failed: ${(err as Error).message} — falling back to Ollama`);
    }
  }

  // ── 3. Ollama (last resort) ──
  console.warn('[AssistantRouter] All external stream providers failed — using Ollama');
  return ollamaStream(messages, opts, modelOverride);
}