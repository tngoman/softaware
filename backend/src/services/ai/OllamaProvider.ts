import { env } from '../../config/env.js';
import { AIProvider, AIMessage, AIResponse, AIOptions } from './AIProvider.js';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private baseURL: string;
  private defaultModel: string;

  constructor(baseURL: string = env.OLLAMA_BASE_URL) {
    this.baseURL = baseURL;
    this.defaultModel = env.OLLAMA_MODEL;
  }

  async chat(messages: AIMessage[], options?: AIOptions): Promise<AIResponse> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data: any = await response.json();
    
    return {
      content: data.message?.content || '',
      model: data.model,
      usage: data.prompt_eval_count ? {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      } : undefined,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
