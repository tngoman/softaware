import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z.string().default('*'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1h'),
  DATABASE_URL: z.string().min(1),

  // SMTP configuration for email sending
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().email().default('noreply@softaware.local'),

  // MCP Server config
  MCP_ENABLED: z.coerce.boolean().default(true),

  // ExchangeRate-API for Forex
  EXCHANGE_RATE_API_KEY: z.string().default(''),
  FOREX: z.string().default(''),  // Alias for EXCHANGE_RATE_API_KEY
  ZAR_THRESHOLD_USD: z.coerce.number().default(19.50),
  ZAR_THRESHOLD_EUR: z.coerce.number().default(21.00),
  ZAR_THRESHOLD_GBP: z.coerce.number().default(24.50),
  ALERT_EMAIL: z.string().email().optional(),

  // NewsAPI for Market Sentiment
  NEWSAPI: z.string().default(''),
  GNEWS: z.string().default(''),  // GNews API as alternative/fallback
  BRIEFING_EMAIL: z.string().email().optional(),

  // Traccar Fleet Tracking
  TRACCAR_HOST: z.string().default('http://tracking.login.net.za:8082'),
  TRACCAR_EMAIL: z.string().default(''),
  TRACCAR_PASSWORD: z.string().default(''),
  FLEET_ALERT_EMAIL: z.string().email().optional(),

  // Code Agent MCP Server
  CODE_AGENT_WORKSPACE: z.string().default(process.cwd()),
  CODE_AGENT_ENABLED: z.coerce.boolean().default(true),

  // Default AI provider selection
  DEFAULT_AI_PROVIDER: z.enum(['glm', 'ollama']).default('ollama'),

  // AWS Bedrock
  AWS: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('eu-north-1'),
  AWS_BEDROCK_MODEL: z.string().default('eu.amazon.nova-lite-v1:0'),

  // SoftAware routing for multimodal (vision) requests
  // If unset, backend will best-effort choose a vision-capable option.
  SOFTAWARE_VISION_PROVIDER: z.enum(['glm', 'ollama', 'openrouter']).optional(),

  // OpenRouter for vision (free tier)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4o-mini'),

  // Ingestion AI router models
  // Paid tier: OpenRouter model used to clean/extract scraped content
  INGESTION_OPENROUTER_MODEL: z.string().default('google/gemma-3-4b-it:free'),
  // Free tier: local Ollama model used to clean/extract scraped content
  INGESTION_OLLAMA_MODEL: z.string().default('qwen2.5:3b-instruct'),

  // OpenAI
  OPENAI: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

  // Ollama configuration
  OLLAMA_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5-coder:7b'),
  OLLAMA_VISION_MODEL: z.string().default('moondream'),
  LEADS_OLLAMA_MODEL: z.string().default('qwen2.5:7b-instruct'),
  // Assistant chat model — DeepSeek Coder V2 Lite MoE
  ASSISTANT_OLLAMA_MODEL: z.string().default('deepseek-coder-v2:16b-lite-instruct-q4_K_M'),
  // keep_alive: -1 = pin model in RAM indefinitely. Set to 0 to unload immediately.
  OLLAMA_KEEP_ALIVE: z.string().default('-1'),

  // GLM API
  GLM: z.string().default(''),
  GLM_MODEL: z.string().default('glm-4-plus'),
  GLM_VISION_MODEL: z.string().default('glm-4v-plus'),

  // Anthropic-compatible endpoint (z.ai proxy for GLM)
  ANTHROPIC_AUTH_TOKEN: z.string().default(''),
  ANTHROPIC_BASE_URL: z.string().default('https://api.z.ai/api/anthropic'),

  // Firebase Cloud Messaging (Push Notifications)
  FIREBASE_PROJECT_ID: z.string().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_PRIVATE_KEY: z.string().default(''),

  // Two-Factor Authentication
  TWO_FACTOR_APP_NAME: z.string().default('SoftAware'),
});

export const env = EnvSchema.parse(process.env);
