# AI Module Files

## Overview

This document catalogs all source files in the AI module, including route handlers, services, and utilities.

**Version:** 2.9.0  
**Last Updated:** March 2026

---

## Route Files

### `/var/opt/backend/src/routes/ai.ts`
**Lines of Code:** 853  
**Purpose:** Main AI chat and conversation endpoints

**Exported Entities:**
- `aiRouter: Router` - Express router for AI endpoints

**Key Functions:**
- Chat completion handlers (POST `/chat`, `/simple`)
- Image analysis (POST `/analyze-image`)
- Provider routing logic
- Credit deduction integration

**Dependencies:**
- `AIProviderManager` - Multi-provider abstraction
- `db` - Database access
- `requireAuth`, `requireApiKey` - Authentication middleware
- `analyzeWithOpenRouter` - Vision analysis service

**Code Excerpt:**
```typescript
const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
      files: z.array(FileAttachmentSchema).optional(),
      images: z.array(FileAttachmentSchema).optional(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  provider: z
    .enum(['softaware', 'openai', 'azure-openai', 'gemini', 'groq', 'ollama'] as const)
    .optional(),
  providerConfig: z.record(z.any()).optional(),
});
```

---

### `/var/opt/backend/src/routes/assistants.ts`
**Lines of Code:** 968  
**Purpose:** Assistant creation, management, and chat

**Exported Entities:**
- `router: Router` - Assistant endpoints

**Key Functions:**
- `POST /` - Create assistant
- `GET /` - List assistants
- `GET /:id` - Get assistant details
- `PUT /:id` - Update assistant
- `DELETE /:id` - Delete assistant
- `POST /:id/chat` - Chat with assistant
- `POST /:id/reindex` - Trigger reindexing
- `GET /:id/health` - Knowledge health check
- `GET /:id/tools` - Get available tools

**Dependencies:**
- `db` - Database access
- `vectorSearch` - Knowledge retrieval
- `getToolsForTier` - Tool management
- `checkAssistantStatus` - Status middleware

**Code Excerpt:**
```typescript
const createAssistantSchema = z.object({
  name: z.string().min(1, 'Assistant name is required'),
  description: z.string().min(1, 'Description is required'),
  businessType: z.string().min(1, 'Business type is required'),
  personality: z.enum(['professional', 'friendly', 'expert', 'casual']),
  primaryGoal: z.string().min(1, 'Primary goal is required'),
  website: z.string().optional()
});
```

---

### `/var/opt/backend/src/routes/aiConfig.ts`
**Lines of Code:** ~150  
**Purpose:** AI configuration management

**Exported Entities:**
- `aiConfigRouter: Router`

**Key Functions:**
- `GET /ai-config` - Get team AI config
- `PUT /ai-config` - Update config (admin only)

**Code Excerpt:**
```typescript
interface AIConfig {
  defaultTextProvider: string;
  defaultTextModel: string;
  visionProvider: string;
  visionModel: string;
  codeProvider: string;
  codeModel: string;
}
```

---

### `/var/opt/backend/src/routes/assistantIngest.ts`
**Lines of Code:** ~200  
**Purpose:** Website scraping and ingestion

**Key Functions:**
- `POST /scrape` - Start website scraping
- `GET /status/:assistantId` - Get scraping status

---

## Service Files

### `/var/opt/backend/src/services/ai/AIProviderManager.ts`
**Lines of Code:** ~500  
**Purpose:** Multi-provider abstraction layer

**Exported Entities:**
- `AIProviderManager` - Singleton manager
- `aiProviderManager` - Default instance

**Key Methods:**
```typescript
class AIProviderManager {
  async chat(params: ChatParams): Promise<ChatResponse>
  async streamChat(params: ChatParams): AsyncIterator<string>
  getProvider(name: string): AIProvider
  registerProvider(name: string, provider: AIProvider): void
}
```

**Supported Providers:**
- Softaware (OpenRouter)
- OpenAI
- Azure OpenAI
- Anthropic
- Gemini
- Groq
- Ollama

---

### `/var/opt/backend/src/services/ai/AIProvider.ts`
**Lines of Code:** ~150  
**Purpose:** Provider interface definition

**Exported Types:**
```typescript
interface AIProvider {
  name: string;
  chat(messages: AIMessage[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat?(messages: AIMessage[], options?: ChatOptions): AsyncIterator<string>;
  supportsVision(): boolean;
  supportsStreaming(): boolean;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
}

interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

### `/var/opt/backend/src/services/openRouterVision.ts`
**Lines of Code:** ~200  
**Purpose:** Vision analysis using OpenRouter

**Exported Functions:**
- `analyzeWithOpenRouter(params)` - Analyze image with vision model

**Code Excerpt:**
```typescript
export async function analyzeWithOpenRouter(params: {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
  model?: string;
}): Promise<string>
```

---

### `/var/opt/backend/src/services/glmService.ts`
**Lines of Code:** ~300  
**Purpose:** ZhipuAI GLM integration (legacy)

**Note:** Being phased out in favor of AIProviderManager

---

### `/var/opt/backend/src/services/ingestionWorker.ts`
**Lines of Code:** ~400  
**Purpose:** Background worker for website scraping

**Key Functions:**
- Website crawling
- Content extraction
- Vector embedding generation
- Knowledge base updates

---

### `/var/opt/backend/src/services/vectorStore.ts`
**Lines of Code:** ~350  
**Purpose:** Vector database operations

**Exported Functions:**
- `insert(assistantId, content, metadata)` - Insert document
- `search(assistantId, query, limit)` - Search knowledge base
- `deleteByAssistant(assistantId)` - Delete all docs for assistant

**Technology:** SQLite with sqlite-vec extension

---

### `/var/opt/backend/src/services/mobileAIProcessor.ts`
**Lines of Code:** ~385  
**Purpose:** Staff mobile AI intent processor with tool-calling

**Exported Functions:**
- `processMobileIntent(req, userId, role)` - Full AI + tool-calling pipeline
- `resolveUserRole(userId)` - Resolve user role from DB

**Model Used:** `env.TOOLS_OLLAMA_MODEL` (`qwen2.5:3b-instruct`) — requires structured output for reliable tool routing across 41 tools in 10 categories.

**Key Flow:** User text → prompt stitching (core_instructions + personality_flare + tools) → Ollama chat → tool-call parse → tool execute → loop → final reply.

---

### `/var/opt/backend/src/services/embeddingService.ts`
**Lines of Code:** ~200  
**Purpose:** Text embedding generation

**Exported Functions:**
- `generateEmbedding(text)` - Generate vector embedding

**Models Used:**
- OpenAI text-embedding-3-small
- Local embedding models (Ollama)

---

### `/var/opt/backend/src/services/knowledgeCategorizer.ts`
**Lines of Code:** ~250  
**Purpose:** Automatic knowledge categorization

**Exported Functions:**
- `updateAssistantCategories(assistantId)` - Categorize knowledge base
- `getAssistantKnowledgeHealth(assistantId)` - Health metrics

---

### `/var/opt/backend/src/services/actionRouter.ts`
**Lines of Code:** ~600  
**Purpose:** Tool execution framework for assistants

**Exported Functions:**
- `getToolsForTier(tier)` - Get available tools
- `parseToolCall(response)` - Parse tool invocation
- `executeToolCall(tool, params)` - Execute tool

**Available Tools:**
- Web search
- Calculator
- Email sending
- Calendar integration
- CRM access

---

## Configuration Files

### `/var/opt/backend/.env`
**Relevant Variables:**
```bash
# OpenRouter (enterprise webhooks + paid-tier ingestion)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Ollama — Model Routing
OLLAMA_BASE_URL=http://localhost:11434
ASSISTANT_OLLAMA_MODEL=qwen2.5:1.5b-instruct  # Default for all assistant/leads/widget chat
TOOLS_OLLAMA_MODEL=qwen2.5:3b-instruct  # Tool-calling (staff mobile intent)
OLLAMA_MODEL=qwen2.5-coder:7b           # Large tasks (site builder, code gen)
LEADS_OLLAMA_MODEL=qwen2.5:1.5b-instruct  # Lead assistant
INGESTION_OLLAMA_MODEL=qwen2.5:1.5b-instruct  # Free-tier ingestion
OLLAMA_KEEP_ALIVE=-1                    # Pin model in RAM

# Vision
SOFTAWARE_VISION_PROVIDER=glm
GLM_VISION_MODEL=glm-4.7

# ZhipuAI
GLM=...
GLM_MODEL=glm-4.7
```

---

## Type Definitions

### `/var/opt/backend/src/types/ai.d.ts`
**Purpose:** TypeScript type definitions

```typescript
declare module '@modelcontextprotocol/sdk' {
  export interface Tool {
    name: string;
    description: string;
    parameters: Record<string, any>;
  }
}
```

---

## Frontend Files

### `/var/opt/frontend/src/pages/portal/ChatInterface.tsx`
**Lines of Code:** ~400  
**Purpose:** AI chat UI

**Components:**
- Message display
- Input handling
- Streaming support
- Model selection
- Provider configuration

---

### `/var/opt/frontend/src/pages/portal/AssistantsPage.tsx`
**Lines of Code:** ~300  
**Purpose:** Assistant management UI

---

### `/var/opt/frontend/src/pages/portal/CreateAssistant.tsx`
**Lines of Code:** ~400  
**Purpose:** Assistant creation wizard

---

## Database Schema

See [FIELDS.md](FIELDS.md) for complete schema.

**Tables:**
- `assistants` - Assistant configurations
- `assistant_knowledge` - Knowledge base documents
- `ai_model_config` - Team AI settings
- `ai_conversations` (planned)
- `ai_messages` (planned)

---

## Testing Files

### `/var/opt/backend/tests/ai.test.ts`
**Purpose:** AI endpoint tests

**Coverage:**
- Chat completion
- Streaming
- Vision analysis
- Error handling
- Provider switching

---

## Dependencies

### Production
```json
{
  "axios": "^1.6.0",
  "openai": "^4.20.0",
  "@anthropic-ai/sdk": "^0.9.0",
  "ollama": "^0.5.0",
  "cheerio": "^1.2.0",
  "sqlite": "^5.1.0",
  "sqlite-vec": "^0.1.7"
}
```

### Development
```json
{
  "@types/node": "^20.x",
  "typescript": "^5.6"
}
```

---

## Code Statistics

| Category | Files | Lines of Code |
|----------|-------|---------------|
| Route files | 4 | ~2,200 |
| Service files | 9 | ~3,200 |
| Frontend pages | 3 | ~1,100 |
| Tests | 1 | ~500 |
| **Total** | **17** | **~7,000** |

---

## File Organization

```
/var/opt/backend/src/
├── routes/
│   ├── ai.ts                    # Main AI chat endpoints
│   ├── assistants.ts            # Assistant management
│   ├── aiConfig.ts              # Configuration
│   └── assistantIngest.ts       # Scraping
├── services/
│   ├── ai/
│   │   ├── AIProviderManager.ts # Provider abstraction
│   │   ├── AIProvider.ts        # Provider interface
│   │   ├── OpenAIProvider.ts    # OpenAI implementation
│   │   ├── AnthropicProvider.ts # Anthropic implementation
│   │   └── OllamaProvider.ts    # Ollama implementation
│   ├── openRouterVision.ts      # Vision analysis
│   ├── glmService.ts            # Legacy GLM
│   ├── vectorStore.ts           # Vector DB
│   ├── embeddingService.ts      # Embeddings
│   ├── knowledgeCategorizer.ts  # Categorization
│   ├── actionRouter.ts          # Tool execution
│   └── ingestionWorker.ts       # Background scraping
└── middleware/
    └── statusCheck.ts           # Assistant status check

/var/opt/frontend/src/
└── pages/
    └── portal/
        ├── ChatInterface.tsx
        ├── AssistantsPage.tsx
        └── CreateAssistant.tsx
```

---

## Code Quality Metrics

- **TypeScript Coverage:** 100%
- **Test Coverage:** 78%
- **Linting:** ESLint passing
- **Security Audit:** No high/critical vulnerabilities
- **Performance:** Average response time <2s
