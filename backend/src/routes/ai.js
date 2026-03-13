import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { aiProviderManager } from '../services/ai/AIProviderManager.js';
import { db } from '../db/mysql.js';
import { env } from '../config/env.js';
import { analyzeWithOpenRouter } from '../services/openRouterVision.js';
import dns from 'node:dns';
// Force IPv4 resolution
dns.setDefaultResultOrder('ipv4first');
export const aiRouter = Router();
const FileAttachmentSchema = z.object({
    mimeType: z.string().min(1),
    dataBase64: z.string().min(1),
});
// Validation schemas (kept compatible with existing /glm endpoints)
const ChatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
        files: z.array(FileAttachmentSchema).optional(),
        images: z.array(FileAttachmentSchema).optional(), // Backwards compatibility
    })),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
    stream: z.boolean().optional(),
    provider: z
        .enum(['softaware', 'openai', 'azure-openai', 'gemini', 'groq', 'ollama'])
        .optional(),
    providerConfig: z.record(z.any()).optional(),
});
const SimpleChatRequestSchema = z.object({
    prompt: z.string().min(1),
    systemPrompt: z.string().optional(),
    files: z.array(FileAttachmentSchema).optional(),
    images: z.array(FileAttachmentSchema).optional(), // Backwards compatibility
    provider: z
        .enum(['softaware', 'openai', 'azure-openai', 'gemini', 'groq', 'ollama'])
        .optional(),
    providerConfig: z.record(z.any()).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().positive().optional(),
});
const OpenAIConfigSchema = z.object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional(),
    model: z.string().min(1).optional(),
});
const GroqConfigSchema = z.object({
    apiKey: z.string().min(1),
    model: z.string().min(1).optional(),
});
const AzureOpenAIConfigSchema = z.object({
    endpoint: z.string().url(),
    apiVersion: z.string().min(1),
    deployment: z.string().min(1),
    apiKey: z.string().min(1),
});
const GeminiConfigSchema = z.object({
    apiKey: z.string().min(1),
    model: z.string().min(1),
});
const OllamaConfigSchema = z.object({
    baseUrl: z.string().url(),
    model: z.string().min(1).optional(),
});
function hasImagesInChat(body) {
    return body.messages.some((m) => (m.images?.length || 0) > 0);
}
function toDataUrl(img) {
    return `data:${img.mimeType};base64,${img.dataBase64}`;
}
function toOpenAICompatibleMessages(messages) {
    return messages.map((m) => {
        if (!m.images || m.images.length === 0) {
            return { role: m.role, content: m.content };
        }
        return {
            role: m.role,
            content: [
                { type: 'text', text: m.content },
                ...m.images.map((img) => ({
                    type: 'image_url',
                    image_url: { url: toDataUrl(img) },
                })),
            ],
        };
    });
}
function toAnthropicCompatibleMessages(messages) {
    return messages.map((m) => {
        if (!m.images || m.images.length === 0) {
            return { role: m.role, content: m.content };
        }
        return {
            role: m.role,
            content: [
                { type: 'text', text: m.content },
                ...m.images.map((img) => ({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: img.mimeType,
                        data: img.dataBase64,
                    },
                })),
            ],
        };
    });
}
async function ollamaChatWithImages(params) {
    const url = `${params.baseUrl.replace(/\/$/, '')}/api/chat`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: params.model,
            messages: params.messages.map((m) => ({
                role: m.role,
                content: m.content,
                images: m.images?.map((i) => i.dataBase64),
            })),
            stream: false,
            options: {
                temperature: params.temperature ?? 0.7,
                num_predict: params.maxTokens,
            },
        }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw Object.assign(new Error(`Provider API error: ${response.status} ${text}`.trim()), { status: 502 });
    }
    const data = await response.json();
    return {
        content: data?.message?.content ?? '',
        model: data?.model ?? params.model,
        usage: data?.prompt_eval_count
            ? {
                promptTokens: data.prompt_eval_count,
                completionTokens: data.eval_count ?? 0,
                totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
            }
            : undefined,
    };
}
async function getTeamIdFromApiKey(req) {
    const apiKey = req.apiKey;
    if (!apiKey)
        return undefined;
    const membership = await db.queryOne('SELECT * FROM team_members WHERE userId = ? LIMIT 1', [apiKey.userId]);
    return membership?.teamId;
}
async function getTeamAIConfig(teamId) {
    if (teamId) {
        const config = await db.queryOne('SELECT * FROM ai_model_config WHERE teamId = ? LIMIT 1', [teamId]);
        if (config) {
            return {
                defaultTextProvider: config.defaultTextProvider,
                defaultTextModel: config.defaultTextModel,
                visionProvider: config.visionProvider,
                visionModel: config.visionModel,
                codeProvider: config.codeProvider,
                codeModel: config.codeModel,
            };
        }
    }
    // Fallback to env defaults
    return {
        defaultTextProvider: env.DEFAULT_AI_PROVIDER || 'glm',
        defaultTextModel: env.GLM_MODEL || 'glm-4-plus',
        visionProvider: env.SOFTAWARE_VISION_PROVIDER || 'glm',
        visionModel: env.GLM_VISION_MODEL || 'glm-4v-plus',
        codeProvider: env.DEFAULT_AI_PROVIDER || 'glm',
        codeModel: env.GLM_MODEL || 'glm-4-plus',
    };
}
function normalizeProvider(provider) {
    return (provider || 'softaware').toLowerCase();
}
async function maybeChargeCredits(params) {
    const teamId = await getTeamIdFromApiKey(params.req);
    if (!teamId)
        return;
    // Ollama is explicitly exempt (user-hosted)
    if (params.provider === 'ollama')
        return;
    const { deductCredits } = await import('../services/credits.js');
    if (params.provider === 'softaware') {
        await deductCredits(teamId, params.kind === 'chat' ? 'TEXT_CHAT' : 'TEXT_SIMPLE', {
            userId: params.req.apiKey?.userId,
            endpoint: params.endpoint,
        });
        return;
    }
    // External providers: minimal processing fee
    await deductCredits(teamId, 'AI_BROKER', {
        userId: params.req.apiKey?.userId,
        endpoint: params.endpoint,
        provider: params.provider,
    });
}
function requireModel(model, provider) {
    const trimmed = model?.trim();
    if (!trimmed) {
        throw Object.assign(new Error(`Model is required for provider '${provider}'`), { status: 400 });
    }
    return trimmed;
}
async function openaiCompatibleChat(params) {
    const url = `${params.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            stream: false,
        }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw Object.assign(new Error(`Provider API error: ${response.status} ${text}`.trim()), {
            status: 502,
        });
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const usage = data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
        }
        : undefined;
    return { content, model: data?.model ?? params.model, usage };
}
async function anthropicCompatibleChat(params) {
    const base = params.baseUrl.replace(/\/$/, '');
    const url = `${base}/v1/messages`;
    // Separate system message from conversation messages
    const systemMessages = params.messages.filter((m) => m.role === 'system');
    const conversationMessages = params.messages.filter((m) => m.role !== 'system');
    const systemPrompt = systemMessages.map((m) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n') || undefined;
    const body = {
        model: params.model,
        messages: conversationMessages.map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : m.content,
        })),
        max_tokens: params.maxTokens ?? 4096,
    };
    if (systemPrompt)
        body.system = systemPrompt;
    if (params.temperature !== undefined)
        body.temperature = params.temperature;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': params.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw Object.assign(new Error(`Provider API error: ${response.status} ${text}`.trim()), {
            status: 502,
        });
    }
    const data = await response.json();
    const content = data?.content?.[0]?.text ?? '';
    const usage = data?.usage
        ? {
            promptTokens: data.usage.input_tokens ?? 0,
            completionTokens: data.usage.output_tokens ?? 0,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
        }
        : undefined;
    return { content, model: data?.model ?? params.model, usage };
}
async function azureOpenAIChat(params) {
    const base = params.endpoint.replace(/\/$/, '');
    const url = `${base}/openai/deployments/${encodeURIComponent(params.deployment)}/chat/completions?api-version=${encodeURIComponent(params.apiVersion)}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': params.apiKey,
        },
        body: JSON.stringify({
            messages: params.messages,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            stream: false,
        }),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw Object.assign(new Error(`Provider API error: ${response.status} ${text}`.trim()), {
            status: 502,
        });
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const usage = data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
        }
        : undefined;
    return { content, model: params.deployment, usage };
}
function toGeminiPayload(messages) {
    const system = messages.find((m) => m.role === 'system')?.content;
    const rest = messages.filter((m) => m.role !== 'system');
    const contents = rest.map((m) => {
        const parts = [{ text: m.content }];
        if (m.images?.length) {
            for (const img of m.images) {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.dataBase64,
                    },
                });
            }
        }
        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
        };
    });
    return {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
    };
}
async function geminiChat(params) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
    const payload = toGeminiPayload(params.messages);
    payload.generationConfig = {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw Object.assign(new Error(`Provider API error: ${response.status} ${text}`.trim()), {
            status: 502,
        });
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const content = parts.map((p) => p?.text || '').join('');
    return { content, model: params.model };
}
async function runChat(params) {
    if (params.provider === 'softaware') {
        // Check for files or images (backwards compatibility)
        const hasFiles = params.messages.some((m) => (m.files?.length || 0) > 0 || (m.images?.length || 0) > 0);
        const teamConfig = await getTeamAIConfig(params.teamId);
        const effectiveVisionProvider = env.SOFTAWARE_VISION_PROVIDER || teamConfig.visionProvider;
        const effectiveVisionModel = (() => {
            if (env.SOFTAWARE_VISION_PROVIDER) {
                if (effectiveVisionProvider === 'ollama')
                    return env.OLLAMA_VISION_MODEL || teamConfig.visionModel;
                if (effectiveVisionProvider === 'glm')
                    return env.GLM_VISION_MODEL || teamConfig.visionModel;
            }
            return teamConfig.visionModel;
        })();
        if (!hasFiles) {
            // Text path: use team config (or env fallback)
            if (teamConfig.defaultTextProvider === 'ollama') {
                return ollamaChatWithImages({
                    baseUrl: env.OLLAMA_BASE_URL,
                    model: teamConfig.defaultTextModel,
                    messages: params.messages,
                    temperature: params.temperature,
                    maxTokens: params.maxTokens,
                });
            }
            // GLM text — use Anthropic-compatible endpoint (z.ai)
            const glmToken = env.ANTHROPIC_AUTH_TOKEN || env.GLM;
            if (!glmToken) {
                throw Object.assign(new Error('GLM is not configured on the server (missing ANTHROPIC_AUTH_TOKEN or GLM env var)'), { status: 500 });
            }
            const glmBaseUrl = env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic';
            return anthropicCompatibleChat({
                baseUrl: glmBaseUrl,
                apiKey: glmToken,
                model: teamConfig.defaultTextModel,
                messages: toOpenAICompatibleMessages(params.messages),
                temperature: params.temperature,
                maxTokens: params.maxTokens,
            });
        }
        // File/Vision path: Use configured vision provider
        // Normalize files/images to unified format
        const normalizedMessages = params.messages.map(m => ({
            ...m,
            images: m.files || m.images // Use files if present, fall back to images for backwards compatibility
        }));
        // Use team config or env settings for vision provider
        if (effectiveVisionProvider === 'ollama') {
            return ollamaChatWithImages({
                baseUrl: env.OLLAMA_BASE_URL,
                model: effectiveVisionModel,
                messages: normalizedMessages,
                temperature: params.temperature,
                maxTokens: params.maxTokens,
            });
        }
        // OpenRouter vision path
        if (effectiveVisionProvider === 'openrouter') {
            return analyzeWithOpenRouter({
                messages: normalizedMessages,
                temperature: params.temperature,
                maxTokens: params.maxTokens,
            });
        }
        // GLM vision path (default) — use Anthropic-compatible endpoint (same as text path)
        const glmVisionToken = env.ANTHROPIC_AUTH_TOKEN || env.GLM;
        if (!glmVisionToken) {
            throw Object.assign(new Error('GLM is not configured on the server (missing ANTHROPIC_AUTH_TOKEN or GLM env var)'), { status: 500 });
        }
        const glmVisionBaseUrl = env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic';
        return anthropicCompatibleChat({
            baseUrl: glmVisionBaseUrl,
            apiKey: glmVisionToken,
            model: effectiveVisionModel,
            messages: toAnthropicCompatibleMessages(normalizedMessages),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    if (params.provider === 'ollama') {
        const cfg = OllamaConfigSchema.parse(params.providerConfig || {});
        return ollamaChatWithImages({
            baseUrl: cfg.baseUrl,
            model: cfg.model || params.model || env.OLLAMA_MODEL,
            messages: params.messages,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    if (params.provider === 'openai') {
        const cfg = OpenAIConfigSchema.parse(params.providerConfig || {});
        const model = requireModel(cfg.model || params.model, params.provider);
        const baseUrl = cfg.baseUrl || 'https://api.openai.com/v1';
        return openaiCompatibleChat({
            baseUrl,
            apiKey: cfg.apiKey,
            model,
            messages: toOpenAICompatibleMessages(params.messages),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    if (params.provider === 'groq') {
        const cfg = GroqConfigSchema.parse(params.providerConfig || {});
        const model = requireModel(cfg.model || params.model, params.provider);
        const baseUrl = 'https://api.groq.com/openai/v1';
        return openaiCompatibleChat({
            baseUrl,
            apiKey: cfg.apiKey,
            model,
            messages: toOpenAICompatibleMessages(params.messages),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    if (params.provider === 'azure-openai') {
        const cfg = AzureOpenAIConfigSchema.parse(params.providerConfig || {});
        return azureOpenAIChat({
            endpoint: cfg.endpoint,
            apiVersion: cfg.apiVersion,
            deployment: cfg.deployment,
            apiKey: cfg.apiKey,
            messages: toOpenAICompatibleMessages(params.messages),
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    if (params.provider === 'gemini') {
        const cfg = GeminiConfigSchema.parse(params.providerConfig || {});
        const model = requireModel(cfg.model || params.model, params.provider);
        return geminiChat({
            apiKey: cfg.apiKey,
            model,
            messages: params.messages,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
    throw Object.assign(new Error(`Unsupported provider '${params.provider}'`), { status: 400 });
}
function toOpenAIChatCompletion(params) {
    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: params.model,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: params.content,
                },
                finish_reason: 'stop',
            },
        ],
        ...(params.usage
            ? {
                usage: {
                    prompt_tokens: params.usage.promptTokens,
                    completion_tokens: params.usage.completionTokens,
                    total_tokens: params.usage.totalTokens,
                },
            }
            : {}),
    };
}
// Test endpoint (no auth required)
aiRouter.get('/test', async (_req, res) => {
    try {
        const provider = aiProviderManager.getProvider();
        const messages = [
            { role: 'user', content: 'Say "Hello! AI API is working correctly." in a single sentence.' },
        ];
        const response = await provider.chat(messages, { temperature: 0.2, maxTokens: 64 });
        res.json({
            success: true,
            message: 'AI API connection successful',
            provider: aiProviderManager.getCurrentProviderName(),
            model: response.model,
            response: response.content,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err?.message || 'AI API error' });
    }
});
// ============================================
// API Key Protected Endpoints (for desktop apps)
// ============================================
// Chat endpoint with API key auth
aiRouter.post('/api/chat', requireApiKey, async (req, res, next) => {
    try {
        console.log('[/api/chat] ===== START =====');
        console.log('[/api/chat] Request body:', JSON.stringify(req.body).substring(0, 200));
        console.log('[/api/chat] Received request, has files:', req.body.messages?.[0]?.files?.length > 0);
        const body = ChatRequestSchema.parse(req.body);
        console.log('[/api/chat] Schema validation passed');
        const provider = normalizeProvider(body.provider);
        console.log('[/api/chat] Provider:', provider);
        const teamId = await getTeamIdFromApiKey(req);
        console.log('[/api/chat] Team ID:', teamId);
        await maybeChargeCredits({ req: req, endpoint: '/ai/api/chat', provider, kind: 'chat' });
        console.log('[/api/chat] Credits checked/charged');
        const messages = body.messages;
        console.log('[/api/chat] Calling runChat with', messages.length, 'messages, has files:', messages[0]?.files?.length > 0);
        const result = await runChat({
            provider,
            providerConfig: body.providerConfig,
            messages,
            model: body.model,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
            teamId,
        });
        console.log('[/api/chat] Success, model:', result.model);
        res.json(toOpenAIChatCompletion({
            model: result.model,
            content: result.content,
            usage: result.usage,
        }));
    }
    catch (err) {
        console.error('[/api/chat] Error:', err);
        next(err);
    }
});
// Simple chat with API key auth
aiRouter.post('/api/simple', requireApiKey, async (req, res, next) => {
    try {
        const { prompt, systemPrompt, files, images, provider: providerRaw, providerConfig, model, temperature, max_tokens } = SimpleChatRequestSchema.parse(req.body);
        const provider = normalizeProvider(providerRaw);
        const teamId = await getTeamIdFromApiKey(req);
        await maybeChargeCredits({ req: req, endpoint: '/ai/api/simple', provider, kind: 'simple' });
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt, files: files, images: images });
        const result = await runChat({
            provider,
            providerConfig,
            messages,
            model,
            temperature: temperature ?? 0.7,
            maxTokens: max_tokens,
            teamId,
        });
        res.json({
            success: true,
            response: result.content,
        });
    }
    catch (err) {
        next(err);
    }
});
// ============================================
// JWT Protected Endpoints (for web UI)
// ============================================
aiRouter.use(requireAuth);
aiRouter.post('/chat', async (req, res, next) => {
    try {
        const body = ChatRequestSchema.parse(req.body);
        // Use the same runChat logic as API key endpoints for vision support
        const provider = normalizeProvider(body.provider);
        const messages = body.messages;
        const result = await runChat({
            provider,
            providerConfig: body.providerConfig,
            messages,
            model: body.model,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
            teamId: undefined, // JWT auth doesn't provide teamId
        });
        res.json(toOpenAIChatCompletion({
            model: result.model,
            content: result.content,
            usage: result.usage,
        }));
    }
    catch (err) {
        next(err);
    }
});
aiRouter.post('/simple', async (req, res, next) => {
    try {
        const { prompt, systemPrompt } = SimpleChatRequestSchema.parse(req.body);
        const provider = aiProviderManager.getProvider();
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const result = await provider.chat(messages, { temperature: 0.7 });
        res.json({
            success: true,
            response: result.content,
        });
    }
    catch (err) {
        next(err);
    }
});
