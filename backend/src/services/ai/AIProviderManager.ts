import { AIProvider } from './AIProvider.js';
import { GLMProvider } from './GLMProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { env } from '../../config/env.js';

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private currentProvider: string;

  constructor() {
    // Register available providers
    this.registerProvider('glm', new GLMProvider());
    this.registerProvider('ollama', new OllamaProvider());

    const defaultProvider = (env.DEFAULT_AI_PROVIDER || 'ollama').toLowerCase();
    this.currentProvider = this.providers.has(defaultProvider) ? defaultProvider : 'ollama';
  }

  registerProvider(name: string, provider: AIProvider) {
    this.providers.set(name.toLowerCase(), provider);
  }

  setProvider(name: string) {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`AI provider '${name}' not found`);
    }
    this.currentProvider = name.toLowerCase();
  }

  getProvider(name?: string): AIProvider {
    const providerName = name?.toLowerCase() || this.currentProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found`);
    }
    return provider;
  }

  getCurrentProviderName(): string {
    return this.currentProvider;
  }

  async listAvailableProviders(): Promise<Array<{ name: string; available: boolean }>> {
    const results = [];
    for (const [name, provider] of this.providers) {
      const available = await provider.isAvailable();
      results.push({ name, available });
    }
    return results;
  }
}

export const aiProviderManager = new AIProviderManager();
