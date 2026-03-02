import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { AIProvider, AIMessage, AIResponse, AIOptions } from './AIProvider.js';

export class GLMProvider implements AIProvider {
  name = 'GLM';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GLM,
      baseURL: 'https://api.z.ai/api/paas/v4/',
    });
  }

  async chat(messages: AIMessage[], options?: AIOptions): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
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
    return !!env.GLM;
  }
}
