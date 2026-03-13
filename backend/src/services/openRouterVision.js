import { getSecret } from './credentialVault.js';
// Resolved lazily on first call — reads from encrypted credential vault.
// NEVER hardcode the key.
let _cachedKey = null;
async function getApiKey() {
    if (_cachedKey)
        return _cachedKey;
    _cachedKey = await getSecret('OPENROUTER');
    // Clear cache after 5 min so vault rotation takes effect
    setTimeout(() => { _cachedKey = null; }, 5 * 60 * 1000);
    return _cachedKey;
}
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = [
    'qwen/qwen-2.5-vl-7b-instruct',
    'meta-llama/llama-3.2-11b-vision-instruct',
    'openai/gpt-4o-mini',
];
const SITE_URL = 'https://softaware.net.za';
const APP_NAME = 'Softaware Vision Analysis';
async function callOpenRouter(params) {
    // Build OpenRouter message format
    const openRouterMessages = params.messages.map((msg) => {
        if (!msg.images || msg.images.length === 0) {
            return {
                role: msg.role,
                content: msg.content,
            };
        }
        // Message with images
        const contentParts = [
            {
                type: 'text',
                text: msg.content,
            },
        ];
        // Add images
        for (const img of msg.images) {
            contentParts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${img.mimeType};base64,${img.dataBase64}`,
                },
            });
        }
        return {
            role: msg.role,
            content: contentParts,
        };
    });
    const apiKey = await getApiKey();
    if (!apiKey)
        throw new Error('OpenRouter API key not configured — check credential vault');
    const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': SITE_URL,
            'X-Title': APP_NAME,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: params.model,
            messages: openRouterMessages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.maxTokens ?? 1024,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const error = Object.assign(new Error(`OpenRouter API error: ${response.status} ${errorText}`.trim()), { status: response.status });
        throw error;
    }
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenRouter');
    }
    return {
        content: data.choices[0].message.content,
        model: data.model || params.model,
    };
}
export async function analyzeWithOpenRouter(params) {
    try {
        console.log('[OpenRouter] Starting vision analysis, messages:', params.messages.length);
        let lastError;
        for (const model of OPENROUTER_MODELS) {
            try {
                return await callOpenRouter({
                    model,
                    messages: params.messages,
                    temperature: params.temperature,
                    maxTokens: params.maxTokens,
                });
            }
            catch (error) {
                lastError = error;
                const status = error?.status;
                if (status && status !== 429 && status < 500) {
                    break;
                }
            }
        }
        throw lastError || new Error('OpenRouter request failed');
    }
    catch (error) {
        console.error('OpenRouter vision error:', error);
        throw error;
    }
}
