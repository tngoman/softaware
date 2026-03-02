import { env } from '../config/env.js';

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || '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';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = [
  'qwen/qwen-2.5-vl-7b-instruct',
  'meta-llama/llama-3.2-11b-vision-instruct',
  'openai/gpt-4o-mini',
];
const SITE_URL = 'https://softaware.net.za';
const APP_NAME = 'Softaware Vision Analysis';

interface ImageAttachment {
  mimeType: string;
  dataBase64: string;
}

interface VisionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

async function callOpenRouter(params: {
  model: string;
  messages: VisionMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; model: string }> {
  // Build OpenRouter message format
  const openRouterMessages = params.messages.map((msg) => {
    if (!msg.images || msg.images.length === 0) {
      return {
        role: msg.role,
        content: msg.content,
      };
    }

    // Message with images
    const contentParts: any[] = [
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

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
    const error = Object.assign(
      new Error(`OpenRouter API error: ${response.status} ${errorText}`.trim()),
      { status: response.status }
    );
    throw error;
  }

  const data: any = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from OpenRouter');
  }

  return {
    content: data.choices[0].message.content,
    model: data.model || params.model,
  };
}

export async function analyzeWithOpenRouter(params: {
  messages: VisionMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; model: string }> {
  try {
    console.log('[OpenRouter] Starting vision analysis, messages:', params.messages.length);
    let lastError: any;
    for (const model of OPENROUTER_MODELS) {
      try {
        return await callOpenRouter({
          model,
          messages: params.messages,
          temperature: params.temperature,
          maxTokens: params.maxTokens,
        });
      } catch (error: any) {
        lastError = error;
        const status = error?.status;
        if (status && status !== 429 && status < 500) {
          break;
        }
      }
    }
    throw lastError || new Error('OpenRouter request failed');
  } catch (error) {
    console.error('OpenRouter vision error:', error);
    throw error;
  }
}
