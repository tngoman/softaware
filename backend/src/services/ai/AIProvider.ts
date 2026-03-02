// Abstract AI Provider interface
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  name: string;
  chat(messages: AIMessage[], options?: AIOptions): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}
