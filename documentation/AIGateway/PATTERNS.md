# AI Module Patterns

## Common Use Cases

### 1. Simple Chat Interaction

```typescript
// Basic chat with default provider
const response = await fetch('/api/ai/simple', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: "Explain quantum computing",
    systemPrompt: "You are a physics teacher"
  })
});

const { content, model, usage } = await response.json();
console.log(`Response from ${model}: ${content}`);
```

### 2. Multi-Turn Conversation

```typescript
// Maintain conversation history
let history = [];

async function chat(userMessage) {
  history.push({ role: 'user', content: userMessage });
  
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant' },
        ...history
      ],
      model: 'gpt-4',
      provider: 'openai'
    })
  });
  
  const { content } = await response.json();
  history.push({ role: 'assistant', content });
  return content;
}
```

### 3. Vision Analysis

```typescript
// Analyze an image
async function analyzeImage(imageUrl, question) {
  const response = await fetch('/api/ai/analyze-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageUrl,
      prompt: question,
      model: 'gpt-4-vision-preview'
    })
  });
  
  return await response.json();
}

// Or with base64
async function analyzeBase64Image(base64Data, mimeType) {
  const response = await fetch('/api/ai/simple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: "Describe this image",
      images: [{
        mimeType,
        dataBase64: base64Data
      }],
      provider: 'openai',
      model: 'gpt-4-vision-preview'
    })
  });
  
  return await response.json();
}
```

### 4. Streaming Responses

```typescript
// Stream chat responses
async function streamChat(messages) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      stream: true,
      provider: 'openai',
      model: 'gpt-4'
    })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        
        try {
          const parsed = JSON.parse(data);
          process.stdout.write(parsed.content || '');
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
}
```

### 5. Multi-Provider Setup

```typescript
// Use different providers for different tasks
const providers = {
  text: {
    provider: 'openai',
    model: 'gpt-4',
    config: { apiKey: process.env.OPENAI_KEY }
  },
  vision: {
    provider: 'gemini',
    model: 'gemini-pro-vision',
    config: { apiKey: process.env.GEMINI_KEY }
  },
  code: {
    provider: 'anthropic',
    model: 'claude-3-opus',
    config: { apiKey: process.env.ANTHROPIC_KEY }
  },
  local: {
    provider: 'ollama',
    model: 'llama2',
    config: { baseUrl: 'http://localhost:11434' }
  }
};

async function aiRequest(type, prompt) {
  const config = providers[type];
  
  return await fetch('/api/ai/simple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      provider: config.provider,
      model: config.model,
      providerConfig: config.config
    })
  });
}
```

### 6. Assistant Creation and Chat

```typescript
// Create an assistant
async function createAssistant(config) {
  const response = await fetch('/api/assistants', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: config.name,
      description: config.description,
      businessType: config.businessType,
      personality: 'professional',
      primaryGoal: config.goal,
      website: config.website
    })
  });
  
  return await response.json();
}

// Chat with assistant
async function chatWithAssistant(assistantId, message, history = []) {
  const response = await fetch(`/api/assistants/${assistantId}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      conversationHistory: history
    })
  });
  
  return await response.json();
}

// Usage
const assistant = await createAssistant({
  name: "Tech Support Bot",
  description: "Helps with technical issues",
  businessType: "Technology",
  goal: "Provide quick solutions to common problems",
  website: "https://example.com"
});

// Wait for indexing
await new Promise(resolve => setTimeout(resolve, 5000));

const response = await chatWithAssistant(
  assistant.id,
  "How do I reset my password?"
);
```

### 7. Error Handling Pattern

```typescript
async function robustAIRequest(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('/api/ai/simple', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) {
        const error = await response.json();
        
        // Handle specific errors
        if (response.status === 403) {
          throw new Error('Insufficient credits');
        }
        
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        if (response.status === 502) {
          // Provider error - try different provider
          if (i === retries - 1) throw new Error('All providers failed');
          continue;
        }
        
        throw new Error(error.error || 'Request failed');
      }
      
      return await response.json();
      
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 8. Credit Management

```typescript
// Check credits before expensive operation
async function safeVisionRequest(imageUrl) {
  // Get current credits (from separate credits endpoint)
  const creditsResponse = await fetch('/api/credits', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const { available } = await creditsResponse.json();
  
  const VISION_COST = 5;
  if (available < VISION_COST) {
    throw new Error('Insufficient credits for vision analysis');
  }
  
  return await fetch('/api/ai/analyze-image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ imageUrl })
  });
}
```

### 9. Temperature and Token Control

```typescript
// Fine-tune model behavior
async function generateCreativeText(prompt) {
  return await fetch('/api/ai/simple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      temperature: 1.5, // More creative
      max_tokens: 500
    })
  });
}

async function generatePreciseCode(prompt) {
  return await fetch('/api/ai/simple', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      systemPrompt: "You are a code generator. Provide only code, no explanations.",
      temperature: 0.1, // More deterministic
      max_tokens: 2000,
      provider: 'openai',
      model: 'gpt-4'
    })
  });
}
```

### 10. Assistant Tool Integration

```typescript
// Enable tools for assistant
async function setupAssistantWithTools(assistantId) {
  const response = await fetch(`/api/assistants/${assistantId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enabledTools: ['web_search', 'calculator', 'send_email'],
      leadCaptureEmail: 'leads@example.com',
      webhookUrl: 'https://example.com/webhook'
    })
  });
  
  return await response.json();
}

// Chat will automatically use tools
const response = await chatWithAssistant(
  assistantId,
  "Search for the latest news about AI and email me a summary"
);

// Check tool calls
if (response.toolCalls) {
  console.log('Tools used:', response.toolCalls.map(t => t.tool));
}
```

---

## Best Practices

### Provider Selection
- Use `softaware` for general queries (managed credits)
- Use `ollama` for privacy-sensitive data (local)
- Use `openai` for best quality (external, requires API key)
- Use `gemini` for long context windows
- Use `anthropic` for complex reasoning

### Assistant Chat Provider Cascade (v2.9.0)
- **GLM (`glm-4.6`)** — Primary for ALL tiers. Free under Coding Lite plan. Anthropic-compatible API at `api.z.ai/api/anthropic`. ~4.3s response.
- **OpenRouter (`openai/gpt-4o-mini`)** — Paid-tier fallback when GLM fails. Reliable, moderate cost.
- **Ollama (`qwen2.5:1.5b-instruct`)** — Last resort fallback. 9.2 tok/s locally, no external dependency.

### Ollama Model Selection
- **`qwen2.5:1.5b-instruct`** — Last-resort local fallback for assistant chat, leads, widgets. 9.2 tok/s, 48% faster than Gemma 2 2B, low memory.
- **`qwen2.5:3b-instruct`** — Tool-calling only (staff mobile intent). Reliable structured output for function routing across 41 tools.
- **`qwen2.5-coder:7b`** — Large / queueable tasks only: site builder, code generation. Do not use for real-time chat.

### Token Management
- Set reasonable `max_tokens` to control costs
- Use streaming for long responses
- Monitor usage with the returned `usage` object

### Error Recovery
- Implement retry logic for transient errors
- Fall back to different providers on 502 errors
- Handle rate limits with exponential backoff
- Check credits before expensive operations

### Conversation Management
- Trim old messages to stay within context limits
- Include system prompts for consistent behavior
- Use conversation history for multi-turn chats

### Security
- Never expose provider API keys to clients
- Use `providerConfig` only with trusted user input
- Validate file uploads before processing
- Sanitize user prompts for injection attacks

### Performance
- Use streaming for real-time feedback
- Cache common responses when appropriate
- Batch similar requests when possible
- Use local Ollama for high-volume, low-complexity tasks
