# Lead Assistant Wiring & Architecture

## Overview
The Soft Aware landing page now includes an AI-powered lead qualification assistant that engages visitors in real-time via the "Get Started" button. The assistant uses Ollama locally, captures lead information into a database, and protects against abuse.

---

## Technology Stack

### Backend
- **Framework**: Express.js (TypeScript)
- **AI Model**: Ollama (local, self-hosted)
- **Default Model**: `qwen2.5:7b-instruct` (configurable via `LEADS_OLLAMA_MODEL` env)
- **Database**: MySQL (lead capture table)
- **Rate Limiting**: In-memory window-based (IP-tracked)

### Frontend
- **Framework**: React + TypeScript
- **Component**: `LandingLeadAssistant.tsx`
- **State Management**: React hooks (useState)
- **Integration**: Wired into landing page "Get Started" button

---

## Backend Implementation

### Endpoint
```
POST /public/leads/assistant
```

### Request Schema
```typescript
{
  sessionId: string         // UUID-like session identifier
  page: string              // Source page (e.g., "landing")
  message: string           // User message (max 600 chars)
  history?: Array<{         // Previous conversation (max 12 messages)
    role: "user" | "assistant"
    content: string
  }>
}
```

### Response Schema
```typescript
{
  reply: string             // Assistant's response
  readyToContact: boolean   // Whether we have qualified lead info
  leadCaptured: boolean     // True if lead was upserted to DB
  leadId?: string           // Database ID if captured
  guarded?: boolean         // True if abuse detected
  error?: string            // Error message
  message?: string          // Fallback/informational message
}
```

### Rate Limiting
- **Window**: 15 minutes
- **Limit**: 25 requests per IP per window
- **Violation**: Blocks IP for 30 minutes, returns HTTP 429
- **Tracking**: IP hash stored (not raw IP)

### Abuse Detection (Multi-layer)
1. **Prompt injection detection**: Flags keywords like "ignore instructions", "jailbreak", "ddos", etc.
2. **Ollama response abuse score**: Model returns 0-100 score; score ≥ 85 triggers guard response
3. **Rate limiting**: Hard cap on requests per IP

### Lead Capture
- **Table**: `LeadCapture` (auto-created on first request)
- **Fields**:
  - `id` (UUID)
  - `sessionId` (unique constraint)
  - `sourcePage` (e.g., "landing")
  - `companyName`, `contactName`, `email`, `phone`, `useCase`, `requirements`, `budgetRange`, `timeline`
  - `status` ("NEW", "QUALIFIED")
  - `score` (40 for new, 80 if ready to contact)
  - `messageCount` (incremented per turn)
  - `ipHash` (SHA256 of IP)
  - `userAgent` (browser info)
  - `createdAt`, `updatedAt`

### Ollama Integration
```typescript
const model = env.LEADS_OLLAMA_MODEL || env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
const baseUrl = env.OLLAMA_BASE_URL.replace(/\/$/, ''); // Default: http://127.0.0.1:11434

// POST to {baseUrl}/api/chat
// Temperature: 0.2 (low randomness for consistent lead capture)
// Max tokens: 220 (concise responses)
```

### System Prompt Strategy
The assistant is given strict instructions:
- Only help gather sales requirements for AI backend projects
- Ask at most one follow-up question per turn
- Extract lead details (company, contact, email, phone, use case, budget, timeline)
- Respond in strict JSON with keys: `assistantReply`, `lead`, `readyToContact`, `abuseScore`
- Never provide coding help, essays, roleplay, or unrelated tasks

### JSON Extraction Logic
The Ollama response is expected to contain a JSON object. The backend:
1. Searches for first `{` and last `}`
2. Extracts and parses the JSON
3. Validates required fields
4. Sanitizes lead data (max length enforcement)

---

## Frontend Implementation

### Component: `LandingLeadAssistant.tsx`

#### Props
```typescript
interface LandingLeadAssistantProps {
  openSignal?: number  // Incremented to trigger open
}
```

#### State
```typescript
const [isOpen, setIsOpen] = useState(false)           // Chat window visibility
const [input, setInput] = useState('')                // User input field
const [isSending, setIsSending] = useState(false)     // Loading state
const [error, setError] = useState('')                // Error message
const [messages, setMessages] = useState<ChatMessage[]>([...]) // Chat history
```

#### Session Management
```typescript
const SESSION_KEY = 'softaware_lead_session_id'

function getOrCreateSessionId(): string {
  // Reads from localStorage, generates UUID-like ID if missing
  // Format: {timestamp}-{random}
}
```

#### Message Flow
1. User types in input field
2. On "Send" or Enter key, message is appended to local state
3. `api.sendLeadAssistantMessage()` is called with:
   - sessionId (from localStorage)
   - page: "landing"
   - message: user input
   - history: last 8 messages
4. Assistant response is appended to chat
5. Errors fall back to generic "temporarily unavailable" message

#### UI Elements
- **Chat Window**: 360px wide, max 100vw - 2rem, fixed bottom-right
- **Message Bubbles**: Different styles for user (primary blue) vs assistant (subtle gray)
- **Input Field**: 600-char limit
- **Send Button**: Disabled while sending or input empty
- **Toggle Button**: "AI Get Started" or "Hide Assistant"

---

## Landing Page Integration

### File: `src/pages/public/LandingPage.tsx`

#### Hook Setup
```typescript
const [assistantOpenSignal, setAssistantOpenSignal] = useState(0)
```

#### Navigation Changes
**Before**: "Get Started" button linked to `/login`  
**After**: "Get Started" button triggers:
```typescript
onClick={() => setAssistantOpenSignal((v) => v + 1)}
```

This increments the signal, which is passed to the assistant component:
```tsx
<LandingLeadAssistant openSignal={assistantOpenSignal} />
```

#### Three "Get Started" locations updated:
1. **Header navigation** (authenticated users see "Dashboard", unauthenticated see "Get Started" button)
2. **Hero section** ("Get Started" primary CTA button)
3. **Pricing tiers** (BYOE and Managed tier buttons call `handleStartTrial()`, Enterprise calls "Contact Sales")

---

## API Layer

### File: `src/ui/src/api.ts`

#### New Types
```typescript
export interface LeadAssistantRequest {
  sessionId: string
  page: string
  message: string
  history?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface LeadAssistantResponse {
  reply: string
  readyToContact: boolean
  leadCaptured: boolean
  guarded?: boolean
  leadId?: string
  error?: string
  message?: string
}
```

#### New Method
```typescript
async sendLeadAssistantMessage(payload: LeadAssistantRequest): Promise<LeadAssistantResponse> {
  const res = await client.post('/public/leads/assistant', payload)
  const data = await res.json()
  if (!res.ok && res.status !== 429) {
    throw new Error(data.message || data.error || 'Lead assistant request failed')
  }
  return data
}
```

---

## Environment Configuration

### Backend (.env)
```dotenv
# Ollama Base URL
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Default Ollama model for general tasks
OLLAMA_MODEL=qwen2.5-coder:7b

# Dedicated model for lead qualification (NEW)
LEADS_OLLAMA_MODEL=qwen2.5:7b-instruct
```

### Frontend (Vite .env)
```dotenv
VITE_API_URL=http://localhost:8787/api  # Or production endpoint
```

---

## Data Flow Diagram

```
User clicks "Get Started" on Landing Page
    ↓
React state: assistantOpenSignal++
    ↓
<LandingLeadAssistant openSignal={...} /> opens chat window
    ↓
User types message + presses Send
    ↓
Frontend: api.sendLeadAssistantMessage({
  sessionId,
  page: "landing",
  message,
  history
})
    ↓
Backend: POST /public/leads/assistant
    ├─ Rate limit check (IP-based)
    ├─ Malicious prompt detection
    ├─ Call Ollama /api/chat
    │  ├─ System prompt + conversation history
    │  ├─ Temperature: 0.2 (consistent)
    │  └─ Model: qwen2.5:7b-instruct
    ├─ Extract JSON response
    ├─ Upsert LeadCapture row
    └─ Return { reply, readyToContact, leadCaptured, leadId }
    ↓
Frontend: Append assistant message to chat
    ↓
Repeat or close
```

---

## Lead Qualification Criteria

A lead is marked as `readyToContact: true` when the assistant has extracted:
- ✅ `contactName` (at least first name)
- ✅ `email` OR `phone` (contact method)
- ✅ `useCase` (what they want to build)

Once qualified, the lead record:
- Status: "QUALIFIED"
- Score: 80 (vs. 40 for new leads)
- Can be filtered in admin dashboard for sales outreach

---

## Troubleshooting

### Assistant returns generic fallback message
- **Cause**: Ollama unavailable or timeout
- **Solution**: Ensure `OLLAMA_BASE_URL` is correct and Ollama service is running
- **Test**: `curl -X POST http://127.0.0.1:11434/api/chat -d '{"model":"qwen2.5:7b-instruct","messages":[...]}'`

### Rate limiting triggered
- **Cause**: IP sent >25 requests in 15 minutes
- **Solution**: Wait 30 minutes for unblock
- **Frontend**: Receives HTTP 429 with `retryAfterSeconds`

### Lead not captured
- **Cause**: Database error or missing LeadCapture table
- **Solution**: Check MySQL connection string in `DATABASE_URL`
- **Log**: Backend logs will show "Failed to upsert lead" errors

### Abuse score always high
- **Cause**: Ollama model not returning valid JSON or off-topic responses
- **Solution**: Test model directly; consider fine-tuning system prompt

---

## Security Considerations

1. **IP-based rate limiting**: Prevents brute force/DoS
2. **Session tracking**: localStorage sessionId + DB upsert on sessionId unique key
3. **Input sanitization**: Max length enforcement on all lead fields
4. **Prompt injection defense**: Keyword detection + model abuse score
5. **No auth required**: Intentionally public (lead capture pre-signup)
6. **IP hash only**: Raw IPs not stored (privacy)

---

## Future Enhancements

1. **Lead scoring algorithm**: Refine based on completeness + engagement
2. **Admin dashboard**: View qualified leads, conversion tracking
3. **Email notification**: Alert sales when lead is qualified
4. **Multi-language**: Translate assistant responses per user locale
5. **Custom prompts**: Allow sales team to configure assistant personality
6. **Analytics**: Track drop-off points, common questions, conversion funnel

---

## Files Modified/Created

| File | Change |
|------|--------|
| `/var/opt/backend/src/routes/publicLeadAssistant.ts` | **NEW** - Lead assistant endpoint & logic |
| `/var/opt/backend/src/app.ts` | Register route: `app.use('/public/leads', publicLeadAssistantRouter)` |
| `/var/opt/backend/src/config/env.ts` | Add `LEADS_OLLAMA_MODEL` env var |
| `/var/opt/backend/.env.example` | Document `LEADS_OLLAMA_MODEL` |
| `/var/opt/ui/src/api.ts` | Add types & `sendLeadAssistantMessage()` method |
| `/var/opt/ui/src/components/LandingLeadAssistant.tsx` | **NEW** - React component for chat widget |
| `/var/opt/ui/src/pages/public/LandingPage.tsx` | Wire assistant to "Get Started" buttons |

