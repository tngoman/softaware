/**
 * @deprecated Use `aiProviderManager.getProvider('glm')` from ai/AIProviderManager.ts instead.
 * This file is kept temporarily for backward compatibility and will be removed.
 */
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { getSecret } from './credentialVault.js';
export class GLMService {
    client = null;
    async getClient() {
        if (this.client)
            return this.client;
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
    async chat(request) {
        const client = await this.getClient();
        const apiKey = await getSecret('GLM', env.GLM);
        if (!apiKey) {
            throw new Error('GLM API key not configured');
        }
        const response = await client.chat.completions.create({
            model: request.model || env.GLM_MODEL || 'GLM-4.7',
            messages: request.messages,
            temperature: request.temperature ?? 1.0,
            max_tokens: request.max_tokens,
            stream: false,
        });
        return response;
    }
    async simpleChat(prompt, systemPrompt) {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        const response = await this.chat({ messages });
        return response.choices[0]?.message?.content || '';
    }
}
export const glmService = new GLMService();
