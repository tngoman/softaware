import { GLMProvider } from './GLMProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { env } from '../../config/env.js';
export class AIProviderManager {
    providers = new Map();
    currentProvider;
    constructor() {
        // Register available providers
        this.registerProvider('glm', new GLMProvider());
        this.registerProvider('ollama', new OllamaProvider());
        const defaultProvider = (env.DEFAULT_AI_PROVIDER || 'ollama').toLowerCase();
        this.currentProvider = this.providers.has(defaultProvider) ? defaultProvider : 'ollama';
    }
    registerProvider(name, provider) {
        this.providers.set(name.toLowerCase(), provider);
    }
    setProvider(name) {
        const provider = this.providers.get(name.toLowerCase());
        if (!provider) {
            throw new Error(`AI provider '${name}' not found`);
        }
        this.currentProvider = name.toLowerCase();
    }
    getProvider(name) {
        const providerName = name?.toLowerCase() || this.currentProvider;
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`AI provider '${providerName}' not found`);
        }
        return provider;
    }
    getCurrentProviderName() {
        return this.currentProvider;
    }
    async listAvailableProviders() {
        const results = [];
        for (const [name, provider] of this.providers) {
            const available = await provider.isAvailable();
            results.push({ name, available });
        }
        return results;
    }
}
export const aiProviderManager = new AIProviderManager();
