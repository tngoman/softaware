import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { AIProvider, AIMessage, AIResponse, AIOptions } from './AIProvider.js';
import { getSecret } from '../credentialVault.js';

export class GLMProvider implements AIProvider {
  name = 'GLM';
  private client: OpenAI | null = null;

  private async getClient(): Promise<OpenAI> {
    if (this.client) return this.client;
    const apiKey = await getSecret('GLM', env.GLM);
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
    // Refresh client every 5 min to pick up rotated keys
    setTimeout(() => { this.client = null; }, 5 * 60 * 1000);
    return this.client;
  }

  async chat(messages: AIMessage[], options?: AIOptions): Promise<AIResponse> {
    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model: options?.model || 'GLM-4.5-Flash',
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
    });

    return {
      content: (response as any).choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    const key = await getSecret('GLM', env.GLM);
    return !!key;
  }
}
