import OpenAI from 'openai';
import { env } from '../config/env.js';

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMChatRequest {
  model?: string;
  messages: GLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class GLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GLM,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
    
    if (!env.GLM) {
      console.warn('GLM API key not configured');
    }
  }

  async chat(request: GLMChatRequest) {
    if (!env.GLM) {
      throw new Error('GLM API key not configured');
    }

    const response = await this.client.chat.completions.create({
      model: request.model || 'GLM-4.7',
      messages: request.messages as any,
      temperature: request.temperature ?? 1.0,
      max_tokens: request.max_tokens,
      stream: false,
    });

    return response;
  }

  async simpleChat(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: GLMMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat({ messages });
    return (response as any).choices[0]?.message?.content || '';
  }
}

export const glmService = new GLMService();
