# AI Module Routes

## Overview

This document details all API routes for AI-related operations including chat completions, assistants, and AI configuration.

---

## AI Chat Routes (`/api/ai`)

### POST `/api/ai/chat`
**Purpose**: Advanced chat completions with multi-provider support

**Authentication**: Required (API Key)

**Request Body**:
```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    files?: Array<{ mimeType: string; dataBase64: string }>;
    images?: Array<{ mimeType: string; dataBase64: string }>;
  }>;
  model?: string;
  temperature?: number; // 0-2
  max_tokens?: number;
  stream?: boolean;
  provider?: 'softaware' | 'openai' | 'azure-openai' | 'gemini' | 'groq' | 'ollama';
  providerConfig?: {
    // Provider-specific configuration
    apiKey?: string;
    baseUrl?: string;
    deployment?: string; // Azure only
    endpoint?: string; // Azure only
    apiVersion?: string; // Azure only
  };
}
```

**Response**:
```typescript
{
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**Features**:
- Multi-provider support (OpenAI, Azure OpenAI, Gemini, Groq, Ollama)
- Vision support with image attachments
- Automatic fallback to team configuration
- Credit deduction for paid providers
- Streaming support

---

### POST `/api/ai/simple`
**Purpose**: Simplified chat endpoint for quick queries

**Authentication**: Required (API Key)

**Request Body**:
```typescript
{
  prompt: string;
  systemPrompt?: string;
  files?: Array<{ mimeType: string; dataBase64: string }>;
  images?: Array<{ mimeType: string; dataBase64: string }>;
  provider?: 'softaware' | 'openai' | 'azure-openai' | 'gemini' | 'groq' | 'ollama';
  providerConfig?: Record<string, any>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}
```

**Response**: Same as `/chat`

---

### POST `/api/ai/analyze-image`
**Purpose**: Analyze images using vision models

**Authentication**: Required (API Key)

**Request Body**:
```typescript
{
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string; // Required if imageBase64
  prompt?: string;
  model?: string;
}
```

**Response**:
```typescript
{
  analysis: string;
  model: string;
}
```

---

## Assistant Routes (`/api/assistants`)

### POST `/api/assistants`
**Purpose**: Create a new assistant

**Authentication**: Required (Auth Token)

**Request Body**:
```typescript
{
  name: string; // min 1 char
  description: string; // min 1 char
  businessType: string; // min 1 char
  personality: 'professional' | 'friendly' | 'expert' | 'casual';
  primaryGoal: string; // min 1 char
  website?: string;
}
```

**Response**:
```typescript
{
  id: string;
  name: string;
  description: string;
  businessType: string;
  personality: string;
  primaryGoal: string;
  website?: string;
  tier: 'free' | 'paid';
  status: 'indexing' | 'ready' | 'error';
  pagesIndexed: number;
  createdAt: string;
  updatedAt: string;
}
```

---

### GET `/api/assistants`
**Purpose**: List all assistants for the authenticated user

**Authentication**: Required

**Query Parameters**: None

**Response**:
```typescript
{
  assistants: Array<Assistant>;
}
```

---

### GET `/api/assistants/:id`
**Purpose**: Get assistant details

**Authentication**: Required

**Path Parameters**:
- `id`: Assistant ID

**Response**: Single assistant object

---

### PUT `/api/assistants/:id`
**Purpose**: Update assistant configuration

**Authentication**: Required

**Request Body** (all optional):
```typescript
{
  name?: string;
  description?: string;
  businessType?: string;
  personality?: 'professional' | 'friendly' | 'expert' | 'casual';
  primaryGoal?: string;
  website?: string;
  leadCaptureEmail?: string;
  webhookUrl?: string;
  enabledTools?: string[];
}
```

**Response**: Updated assistant object

---

### DELETE `/api/assistants/:id`
**Purpose**: Delete an assistant

**Authentication**: Required

**Response**:
```typescript
{
  message: "Assistant deleted successfully"
}
```

---

### POST `/api/assistants/:id/chat`
**Purpose**: Chat with an assistant

**Authentication**: Required

**Request Body**:
```typescript
{
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
}
```

**Response** (non-streaming):
```typescript
{
  response: string;
  toolCalls?: Array<{
    tool: string;
    result: any;
  }>;
}
```

**Response** (streaming): Server-Sent Events with `data:` prefix

---

### POST `/api/assistants/:id/reindex`
**Purpose**: Trigger website reindexing

**Authentication**: Required

**Response**:
```typescript
{
  message: "Reindexing started",
  status: "indexing"
}
```

---

### GET `/api/assistants/:id/health`
**Purpose**: Get knowledge base health metrics

**Authentication**: Required

**Response**:
```typescript
{
  totalDocs: number;
  categories: Array<{
    category: string;
    count: number;
    samples: string[];
  }>;
  lastUpdated: string;
}
```

---

### GET `/api/assistants/:id/tools`
**Purpose**: Get available tools for assistant tier

**Authentication**: Required

**Response**:
```typescript
{
  tools: Array<{
    name: string;
    description: string;
    tier: 'free' | 'paid';
  }>;
}
```

---

### GET `/api/assistants/persona-templates`
**Purpose**: Get available persona templates

**Authentication**: Required

**Response**:
```typescript
{
  templates: Array<{
    id: string;
    name: string;
    description: string;
    personality: string;
    primaryGoal: string;
    businessType: string;
  }>;
}
```

---

## AI Configuration Routes (`/api/ai-config`)

### GET `/api/ai-config`
**Purpose**: Get team AI configuration

**Authentication**: Required

**Response**:
```typescript
{
  defaultTextProvider: string;
  defaultTextModel: string;
  visionProvider: string;
  visionModel: string;
  codeProvider: string;
  codeModel: string;
}
```

---

### PUT `/api/ai-config`
**Purpose**: Update team AI configuration

**Authentication**: Required (Admin only)

**Request Body**:
```typescript
{
  defaultTextProvider?: string;
  defaultTextModel?: string;
  visionProvider?: string;
  visionModel?: string;
  codeProvider?: string;
  codeModel?: string;
}
```

**Response**: Updated configuration

---

## Assistant Ingestion Routes (`/api/assistant-ingest`)

### POST `/api/assistant-ingest/scrape`
**Purpose**: Scrape and ingest website content

**Authentication**: Required

**Request Body**:
```typescript
{
  assistantId: string;
  website: string;
  maxPages?: number;
}
```

**Response**:
```typescript
{
  message: "Scraping started",
  pagesQueued: number;
}
```

---

### GET `/api/assistant-ingest/status/:assistantId`
**Purpose**: Get ingestion status

**Authentication**: Required

**Response**:
```typescript
{
  status: 'indexing' | 'ready' | 'error';
  pagesIndexed: number;
  lastIndexed: string;
}
```

---

## Error Responses

All routes may return these error formats:

**400 Bad Request**:
```typescript
{
  error: string;
  details?: any; // Validation errors
}
```

**401 Unauthorized**:
```typescript
{
  error: "Authentication required"
}
```

**403 Forbidden**:
```typescript
{
  error: "Insufficient credits" | "Access denied"
}
```

**404 Not Found**:
```typescript
{
  error: "Assistant not found" | "Resource not found"
}
```

**429 Too Many Requests**:
```typescript
{
  error: "Rate limit exceeded",
  retryAfter: number; // seconds
}
```

**500 Internal Server Error**:
```typescript
{
  error: string;
  details?: string;
}
```

**502 Bad Gateway**:
```typescript
{
  error: "Provider API error: <details>"
}
```

---

## Rate Limiting

- **Chat endpoints**: 100 requests per minute per API key
- **Assistant creation**: 10 per hour per user
- **Reindexing**: 1 per 5 minutes per assistant

---

## Credit Costs

| Operation | Free Tier | Paid Tier | Notes |
|-----------|-----------|-----------|-------|
| Text Chat (Softaware) | 1 credit | 1 credit | Per message |
| Simple Query | 1 credit | 1 credit | Per query |
| Vision Analysis | 5 credits | 3 credits | Per image |
| External Provider | 0.1 credit | 0.1 credit | Processing fee only |
| Ollama | Free | Free | User-hosted |
| Assistant Tool Call | 2 credits | 1 credit | Per tool execution |

---

## Notes

- All timestamps are in ISO 8601 format
- Image data must be base64-encoded
- Streaming responses use Server-Sent Events (SSE) format
- Provider configs are validated based on provider type
- Assistants inherit user's tier unless explicitly set
- Tool availability depends on assistant tier
