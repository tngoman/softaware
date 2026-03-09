/**
 * @deprecated Use `aiProviderManager.getProvider('glm')` from ai/AIProviderManager.ts instead.
 * This file is kept temporarily for backward compatibility and will be removed.
 */
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { getSecret } from './credentialVault.js';

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
  private client: OpenAI | null = null;

  private async getClient(): Promise<OpenAI> {
    if (this.client) return this.client;
    const apiKey = await getSecret('GLM', env.GLM);
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
    setTimeout(() => { this.client = null; }, 5 * 60 * 1000);
    if (!apiKey) {
      console.warn('GLM API key not configured');
    }
    return this.client;
  }

  async chat(request: GLMChatRequest) {
    const client = await this.getClient();
    const apiKey = await getSecret('GLM', env.GLM);
    if (!apiKey) {
      throw new Error('GLM API key not configured');
    }

    const response = await client.chat.completions.create({
      model: request.model || env.GLM_MODEL || 'GLM-4.7',
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
