# Mobile App — Gateway AI Assistant Wiring Guide

> **Created:** March 24, 2026
> **Purpose:** Step-by-step guide for wiring the **API Gateway AI assistant** into the React Native mobile app, reusing the existing AI chat UI with full voice support.
> **Audience:** Mobile developer(s)
> **Pre-requisite reading:**
> - `MOBILE_APP_REFERENCE.md` (app structure, navigation, API layer)
> - `TTS_VOICE_SELECTION_WIRING_GUIDE.md` (TTS voice picker, already wired)
> - `ASSISTANT_CAPABILITIES_WIRING_PLAN.md` (tool system architecture)

---

## Table of Contents

1. [Overview](#1-overview)
2. [What is a Gateway Assistant?](#2-what-is-a-gateway-assistant)
3. [Architecture Diagram](#3-architecture-diagram)
4. [What Already Exists](#4-what-already-exists)
5. [Backend Changes Required](#5-backend-changes-required)
6. [New & Updated API Endpoints](#6-new--updated-api-endpoints)
7. [TypeScript Types](#7-typescript-types)
8. [API Module Changes — `api/ai.ts`](#8-api-module-changes--apiaits)
9. [API Module — New `api/gateway.ts`](#9-api-module--new-apigatewaysts)
10. [Hook — `useGatewayContext.ts`](#10-hook--usegatewaycontextts)
11. [Gateway Detection Flow](#11-gateway-detection-flow)
12. [Screen Changes — `AiChatScreen.tsx`](#12-screen-changes--aichatscreentsx)
13. [Screen Changes — `AiAssistantsScreen.tsx`](#13-screen-changes--aiassistantsscreentsx)
14. [New Screen — `GatewayDashboardScreen.tsx`](#14-new-screen--gatewaydashboardscreentsx)
15. [Navigation Changes](#15-navigation-changes)
16. [Voice Support (TTS + STT)](#16-voice-support-tts--stt)
17. [Gateway Tool Results in Chat UI](#17-gateway-tool-results-in-chat-ui)
18. [Offline & Error Handling](#18-offline--error-handling)
19. [Implementation Checklist](#19-implementation-checklist)
20. [Testing Guide](#20-testing-guide)

---

## 1. Overview

Some users are **API Gateway clients** — they don't have a generated website or widget chatbot. Instead, they have a **gateway configuration** that connects their own business API (e.g., an e-commerce backend) to the Soft Aware AI platform. Their AI assistant can call gateway tools like `listOrders`, `searchCustomers`, `getSalesReport`, etc.

**What's needed:** These gateway users should be able to use the **same AI chat UI** in the mobile app (voice + text), but their assistant must:

1. Know it's a **gateway assistant** (not a website chatbot)
2. Have the **gateway tools** listed in its system prompt
3. Respond concisely as a **business operations assistant**
4. Support **all 6 OpenAI TTS voices** (already wired)
5. Show **gateway-specific dashboard data** (tools, stats, connection status)

### Summary of Work

| Area | Change | Effort |
|------|--------|--------|
| **Backend** (we do this) | Inject gateway context into mobile intent path (mirrors what web widget chat already does) | ~50 LOC |
| **Backend** (we do this) | New `GET /api/v1/mobile/gateway-context` endpoint for mobile to know if user is a gateway client | ~40 LOC |
| **Mobile — Types** | Add gateway types (`GatewayConfig`, `GatewayProduct`, `GatewayTool`) | ~40 LOC |
| **Mobile — API** | New `gatewayApi` module + update `aiApi` | ~60 LOC |
| **Mobile — Hook** | New `useGatewayContext` hook | ~50 LOC |
| **Mobile — Chat UI** | Gateway badge in chat, tool result cards, context-aware greeting | ~80 LOC |
| **Mobile — Assistants** | Gateway indicator on assistant cards | ~20 LOC |
| **Mobile — Dashboard** | New `GatewayDashboardScreen` (optional) | ~200 LOC |
| **Mobile — Navigation** | Add gateway screens to nav stacks | ~20 LOC |
| **Voice** | No changes needed — TTS/STT already works | 0 LOC |

---

## 2. What is a Gateway Assistant?

### The Three Types of Mobile Assistant

The mobile app has **three distinct assistant personalities**. Understanding all three is essential — the current bug is that gateway users are getting Type 2 when they should get Type 3.

#### Type 1 — Staff/Admin Assistant

- **Who:** Internal staff with `admin`, `developer`, `client_manager`, etc. roles
- **System prompt core:** `STAFF_CORE_DEFAULT` — "You are a Soft Aware administrative assistant with access to secure system tools..."
- **Tools available (41+):** Cases, CRM, Tasks, Quotations, Invoices, Pricing, Scheduling, Chat, Bug Tracking, Admin tools
- **Mobile role resolved as:** `'staff'`
- **How to tell:** `resolveUserRole()` returns `'staff'`

#### Type 2 — Regular Client Assistant (Website / Widget)

- **Who:** Clients who have generated landing pages or widget chatbots via the SiteBuilder
- **System prompt core:** `CLIENT_CORE_DEFAULT` — "You are a Soft Aware account assistant. You help the user manage their AI assistants, monitor usage, troubleshoot ingestion issues, manage their website leads, send follow-up emails, and make changes to their generated landing page."
- **Tools available (17):** `list_my_assistants`, `list_leads`, `send_followup_email`, `update_site_field`, `deploy_site`, etc.
- **Mobile role resolved as:** `'client'`
- **How to tell:** No `client_api_configs` rows for the user's `contact_id`

#### Type 3 — Gateway Client Assistant ⚠️ THE ONE THIS GUIDE IMPLEMENTS

- **Who:** Clients who have an **API Gateway configuration** connecting their own business API to Soft Aware. They do NOT necessarily have a generated website.
- **System prompt core:** `CLIENT_CORE_DEFAULT` **PLUS** gateway context injection — `GATEWAY TOOLS: tool1, tool2, ...` and conciseness rules
- **Tools available:** Standard 17 client tools **PLUS** their business-specific gateway tools (e.g., `listOrders`, `searchCustomers`, `getSalesReport`, etc.)
- **Mobile role resolved as:** `'client'` (same as Type 2 — the role is not different)
- **How to tell:** `client_api_configs` rows EXIST for the user's `contact_id`

### ⚠️ The Current Bug

**Right now, when a gateway client (e.g., Braai Online user `masiya.e@gmail.com`) opens the mobile app and chats with their assistant, they get a Type 2 (Regular Client) assistant.** This means:

- The AI introduces itself as a "Soft Aware account assistant" that helps manage websites and leads
- It has no knowledge of the user's business operations (orders, customers, drivers, etc.)
- It cannot call any gateway tools (`listOrders`, `getDashboardSummary`, etc.)
- It may try to use `list_leads` and `update_site_field` which are irrelevant to this user

**The correct behaviour** (Type 3) should be:

- The AI introduces itself as "Braai AI, a concise business assistant"
- It knows it has 10 gateway tools for managing the Braai Online store
- It responds to "Show me today's orders" by calling `listOrders` on the client's API
- It keeps replies concise because they are read aloud

### Why The Bug Exists

The web widget chat (`POST /api/assistants/chat`) already correctly detects gateway users and injects gateway context. **The mobile intent path (`POST /api/v1/mobile/intent` → `processMobileIntent()`) never got this update.** It only uses `resolveUserRole()` which returns `'client'` for both Type 2 and Type 3 users — the two are indistinguishable without the extra gateway lookup.

```
Mobile path (BROKEN for gateway users):
  resolveUserRole(userId) → 'client'
  getToolsForRole('client') → 17 standard client tools
  buildStitchedPrompt() → CLIENT_CORE_DEFAULT (website assistant)
                                    ↑
                          WRONG for gateway users

Web widget path (CORRECT):
  getConfigsByContactId(contactId) → [gateway configs]
  if configs found → inject GATEWAY TOOLS into system prompt
  → gateway assistant behaviour ✅
```

### How Detection Works (Backend)

```
User logs in → userId → users.contact_id → client_api_configs WHERE contact_id = ?
  → If rows exist → Type 3 (Gateway) — inject gateway context
  → If no rows    → Type 2 (Regular client) — standard website assistant
```

There is **no explicit flag** on the `assistants` table row. A user's assistant doesn't know it's a "gateway assistant" — that determination is made at request time by checking the **owner's `contact_id`** against the `client_api_configs` SQLite table.

### Gateway Tools (Example — Braai Online)

A real gateway client (Braai Online, an e-commerce store) has these 10 tools:

| Tool Name | Description |
|-----------|-------------|
| `getDashboardSummary` | Overview of orders, revenue, customers |
| `listOrders` | List/filter orders by status, date, customer |
| `updateOrderStatus` | Change order status (processing, shipped, delivered) |
| `getOrderDetail` | Full order details with items, customer, payment |
| `searchCustomers` | Search customers by name, email, phone |
| `getCustomerDetail` | Full customer profile with order history |
| `getTopCustomers` | Top customers by order count or revenue |
| `getSalesReport` | Sales analytics by period |
| `listDrivers` | List delivery drivers |
| `notifyCustomer` | Send notification to a customer |

These tools are stored as a JSON array in `client_api_configs.allowed_actions`. When the AI assistant calls one of these tools, the gateway proxy forwards the request to the client's real API.

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                            │
│                                                                             │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐ │
│  │ AiChatScreen    │   │ GatewayDashboard │   │ AiAssistantsScreen      │ │
│  │ • Voice (STT)   │   │ • Connection sts │   │ • Gateway badge on card │ │
│  │ • Text input    │   │ • Tool inventory │   │ • "Gateway Assistant"   │ │
│  │ • Tool results  │   │ • Request stats  │   │   label for gateway     │ │
│  │ • TTS playback  │   │ • API docs link  │   │   users' assistants     │ │
│  └────────┬────────┘   └────────┬─────────┘   └─────────────────────────┘ │
│           │                     │                                           │
│           ▼                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Layer (src/api/)                         │   │
│  │  aiApi.sendIntent()  │  gatewayApi.getContext()  │  aiApi.tts()    │   │
│  └──────────────────────┴──────────────────────────┴──────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express.js)                                │
│                                                                             │
│  POST /api/v1/mobile/intent     ◄─── Main AI chat (voice + text)           │
│    │                                                                        │
│    ├─ processMobileIntent()                                                 │
│    │   ├─ getToolsForRole(role)  ◄── Standard client/staff tools           │
│    │   ├─ ★ getGatewayContext()  ◄── NEW: Inject gateway tools into prompt │
│    │   ├─ buildStitchedPrompt()  ◄── System prompt assembly                │
│    │   └─ chatCompletion()       ◄── LLM call (GLM → OpenRouter → Ollama) │
│    │       │                                                                │
│    │       ├─ [If tool_call detected]                                      │
│    │       │   ├─ Standard tool? → executeMobileAction()                   │
│    │       │   └─ Gateway tool?  → POST /v1/client-api/:clientId/:action   │
│    │       │       │                                                        │
│    │       │       └─ Proxy to client's real API ──► Client Backend         │
│    │       │                                                                │
│    │       └─ [Final text reply] → Return to mobile                        │
│    │                                                                        │
│  GET /api/v1/mobile/gateway-context  ◄── NEW: Gateway detection for mobile │
│    └─ Returns: isGateway, tools, gateways[], package info                  │
│                                                                             │
│  POST /api/v1/mobile/tts         ◄── Text-to-Speech (OpenAI, 6 voices)    │
│  POST /api/v1/mobile/tts/preview ◄── Voice preview samples                │
│                                                                             │
│  GET /api/dashboard/products     ◄── Product detection (also works)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. What Already Exists

### Mobile Components (Already Working)

| Component | File | Relevant Detail |
|-----------|------|-----------------|
| `useVoiceAssistant` hook | `src/hooks/useVoiceAssistant.ts` | Push-to-talk state machine. STT → intent → TTS cycle. Works for all assistants. |
| `AiChatScreen` | `src/screens/ai/AiChatScreen.tsx` | Voice push-to-talk UI, text input, assistant picker, conversation history. |
| `AiAssistantsScreen` | `src/screens/ai/AiAssistantsScreen.tsx` | Lists user's assistants with cards. |
| `AssistantFormScreen` | `src/screens/ai/AssistantFormScreen.tsx` | Create/edit assistant — personality, voice, TTS voice picker. |
| `ConversationHistoryScreen` | `src/screens/ai/ConversationHistoryScreen.tsx` | Lists past conversations. |
| `aiApi` module | `src/api/ai.ts` | `aiApi.sendIntent()`, `aiApi.getAssistants()`, `aiApi.speakText()`, `aiApi.previewVoice()` |
| `VoicePicker` component | `src/components/ai/VoicePicker.tsx` | 6-voice grid with preview playback (alloy, echo, fable, onyx, nova, shimmer). |
| `dashboardApi` module | `src/api/dashboard.ts` | `dashboardApi.getMetrics()` — existing dashboard API. |

### Backend Components (Already Working)

| Component | File | Status |
|-----------|------|--------|
| `POST /api/v1/mobile/intent` | `mobileIntent.ts` | ✅ Working — but does NOT inject gateway context yet |
| `processMobileIntent()` | `mobileAIProcessor.ts` | ✅ Working — tool loop, history, prompt stitching |
| `getToolsForRole()` | `mobileTools.ts` | ✅ Working — returns 17 client tools or 41+ staff tools |
| `POST /api/v1/client-api/:clientId/:action` | `clientApiGateway.ts` (route) | ✅ Working — proxies tool calls to client APIs |
| `getConfigsByContactId()` | `clientApiGateway.ts` (service) | ✅ Working — queries SQLite for gateway configs |
| `GET /api/dashboard/products` | `dashboard.ts` | ✅ Working — returns `{ products: { ai_assistant, api_gateway }, gateway_summary }` |
| `POST /api/v1/mobile/tts` | `mobileIntent.ts` | ✅ Working — OpenAI TTS with 6 voices |
| `POST /api/v1/mobile/tts/preview` | `mobileIntent.ts` | ✅ Working — voice preview samples |
| Web widget chat gateway injection | `assistants.ts` (chat endpoint) | ✅ Working — detects gateway, injects tools into prompt |

### The Gap — Why Gateway Users See a Website Assistant

The **mobile intent path** (`POST /api/v1/mobile/intent` → `processMobileIntent()`) does NOT currently:

1. Look up the user's `contact_id`
2. Query `client_api_configs` for gateway configs
3. Inject gateway tool names into the system prompt
4. Route gateway tool calls through the client API gateway proxy

Without step 3, the prompt sent to the LLM is `CLIENT_CORE_DEFAULT` — the generic website assistant prompt — which is **completely wrong** for a Braai Online user whose assistant is supposed to know about orders and customers.

The web widget chat path (`POST /api/assistants/chat`) already does all four steps. The mobile path needs to mirror this. See **Section 5** for the exact before/after.

---

## 5. Backend Changes Required

> **All backend changes will be done by the backend team.** This section documents what will change so you understand the data flow and can coordinate testing.

### 5.1 Gateway Context Injection in `mobileAIProcessor.ts`

**File:** `/var/opt/backend/src/services/mobileAIProcessor.ts`  
**Function:** `processMobileIntent()`

This is the **root fix** for the "website assistant" bug. Without this change, all client users — including gateway users — receive the `CLIENT_CORE_DEFAULT` prompt, making their assistant act as a website/widget assistant.

#### Current Behaviour (WRONG for gateway users)

The current `CLIENT_CORE_DEFAULT` prompt that gateway users are currently receiving on mobile:

```
You are a Soft Aware account assistant. You help the user manage their AI
assistants, monitor usage, troubleshoot ingestion issues, manage their website
leads, send follow-up emails, and make changes to their generated landing page.
You have access to self-service tools. Use them when the user requests an action.
Never reveal tool names or JSON schemas. When a user asks about their leads or
form submissions, use the lead tools. When they want to change their website
details (phone, email, about text), use the site tools and remind them to
regenerate and deploy afterwards.

VOICE INTERACTION: ...
```

A Braai Online user saying "Show me today's orders" with this prompt will get a confused response because:
- The AI thinks it's a website chatbot manager
- It has no `listOrders` tool
- It may incorrectly try to use `list_leads` or suggest they "check their landing page"

#### After the Fix (CORRECT for gateway users)

The system prompt that gateway users will receive after the backend change:

```
You are a Soft Aware account assistant. [... CLIENT_CORE_DEFAULT ...]

Your name is "Braai AI".

CRITICAL INSTRUCTION FOR TONE AND PERSONALITY:
Be friendly, helpful, and to the point.

GATEWAY CONTEXT:
You are also a business operations assistant. You have access to the following
business gateway tools:
GATEWAY TOOLS: getDashboardSummary, listOrders, updateOrderStatus, getOrderDetail,
searchCustomers, getCustomerDetail, getTopCustomers, getSalesReport, listDrivers,
notifyCustomer

GATEWAY RULES:
- Keep replies short and direct — 1-2 sentences for greetings and simple questions.
- Only list gateway capabilities when the user explicitly asks what you can do.
- Do not dump the tools list or gateway details unless asked.
- Be concise — your responses are spoken aloud via text-to-speech.

[standard mobile tool definitions — list_leads, update_site_field, etc. still present]
```

Now when the user says "Show me today's orders", the LLM knows about `listOrders` and can call it.

**What changes in code:**

After `buildStitchedPrompt()` assembles the base prompt, the function checks for gateway configs and appends the gateway context block:

```typescript
// NEW — after buildStitchedPrompt() call in processMobileIntent():
const userObj2 = await db.queryOne<{ contact_id: number | null }>(
  'SELECT contact_id FROM users WHERE id = ?', [userId]
);
if (userObj2?.contact_id) {
  const gwConfigs = getConfigsByContactId(userObj2.contact_id);
  if (gwConfigs.length > 0) {
    const allTools: string[] = [];
    for (const gc of gwConfigs) {
      try { allTools.push(...JSON.parse(gc.allowed_actions || '[]')); } catch {}
    }
    if (allTools.length > 0) {
      // Append gateway context to the system prompt
      systemPrompt += `

GATEWAY CONTEXT:
You are also a business operations assistant. You have access to the following business gateway tools:
GATEWAY TOOLS: ${allTools.join(', ')}

GATEWAY RULES:
- Keep replies short and direct — 1-2 sentences for greetings and simple questions.
- Only list gateway capabilities when the user explicitly asks what you can do.
- Do not dump the tools list or gateway details unless asked.
- Be concise — your responses are spoken aloud via text-to-speech.`;
      // Store for executor context
      ctx.gatewayTools = allTools;
      ctx.gatewayClientId = gwConfigs[0].client_id;
    }
  }
}
```

> **Important for mobile developer:** The `systemPrompt` change happens entirely on the backend. You do NOT need to change the `aiApi.sendIntent()` call or any part of the chat UI for this fix to take effect. Once the backend is deployed, gateway users will automatically get the correct behaviour.

### 5.2 Gateway Tool Execution in `mobileActionExecutor.ts`

**File:** `/var/opt/backend/src/services/mobileActionExecutor.ts`  
**Function:** `executeMobileAction()`

Currently, if a gateway user's assistant tries to call `listOrders` (a gateway tool), the action executor doesn't know what to do with it — it would fall through to the default case and return an error.

**What changes:** A new case is added to the executor switch that detects gateway tools and proxies them:

```typescript
// NEW — in executeMobileAction() default/fallback case:
// Check if this is a gateway tool for the user
if (ctx.gatewayTools?.includes(toolCall.name) && ctx.gatewayClientId) {
  const response = await fetch(
    `http://localhost:8787/api/v1/client-api/${ctx.gatewayClientId}/${toolCall.name}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCall.arguments || {}),
    }
  );
  const result = await response.json();
  return {
    message: JSON.stringify(result),
    data: result,
  };
}
```

This routes the gateway tool call through the existing `POST /api/v1/client-api/:clientId/:action` proxy, which handles auth, rate limiting, and forwarding to the client's real API.

**The execution context** (`MobileExecutionContext`) needs two new optional fields:

```typescript
interface MobileExecutionContext {
  userId: string;
  role: MobileRole;
  assistantId?: string;
  gatewayTools?: string[];      // ← NEW: list of valid gateway tool names for this user
  gatewayClientId?: string;     // ← NEW: the client_id for gateway proxy calls
}
```

### 5.3 New Endpoint: `GET /api/v1/mobile/gateway-context`

**File:** `/var/opt/backend/src/routes/mobileIntent.ts`

A new endpoint so the mobile app can detect whether the user is a gateway client and display the correct UI (badges, gateway dashboard, tool inventory).

This is **separate from the chat fix** in 5.1/5.2. The chat fix makes the AI behave correctly. This endpoint makes the mobile UI display correctly.

Without this endpoint, the mobile app has no way to know it should show a "Gateway" badge on the assistant card or navigate to the gateway dashboard.

---

## 6. New & Updated API Endpoints

### 6.1 Gateway Context (NEW)

```
GET /api/v1/mobile/gateway-context
Authorization: Bearer <jwt>
```

**Response (gateway user):**

```json
{
  "success": true,
  "is_gateway": true,
  "gateways": [
    {
      "client_id": "braai-online",
      "client_name": "Braai Online",
      "status": "active",
      "target_base_url": "https://braaionline.africa/AiClient.php",
      "auth_type": "rolling_token",
      "tools": [
        "getDashboardSummary",
        "listOrders",
        "updateOrderStatus",
        "getOrderDetail",
        "searchCustomers",
        "getCustomerDetail",
        "getTopCustomers",
        "getSalesReport",
        "listDrivers",
        "notifyCustomer"
      ],
      "tools_count": 10,
      "rate_limit_rpm": 60,
      "total_requests": 1247,
      "last_request_at": "2026-03-24T10:15:00.000Z",
      "created_at": "2026-03-01T08:00:00.000Z"
    }
  ],
  "total_tools": 10,
  "package": {
    "slug": "pro",
    "name": "Professional",
    "status": "TRIAL"
  }
}
```

**Response (non-gateway user):**

```json
{
  "success": true,
  "is_gateway": false,
  "gateways": [],
  "total_tools": 0,
  "package": null
}
```

### 6.2 Products Endpoint (EXISTING — also works)

```
GET /api/dashboard/products
Authorization: Bearer <jwt>
```

Returns `products.api_gateway: true/false` along with `gateway_summary` containing the same gateway data. The mobile app can use **either** this or the new endpoint above — the new endpoint is more focused.

### 6.3 Intent Endpoint (EXISTING — behaviour changes for gateway users)

```
POST /api/v1/mobile/intent
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "text": "Show me today's orders",
  "conversationId": "existing-conv-id",
  "assistantId": "assistant-1774305018268"
}
```

**Response (unchanged format):**

```json
{
  "success": true,
  "reply": "You have 12 orders today. 8 are delivered, 3 are in transit, and 1 is processing. Total revenue: R4,250.",
  "tts_text": "You have 12 orders today. 8 are delivered, 3 are in transit, and 1 is processing. Total revenue: R4,250.",
  "conversationId": "conv-abc-123",
  "toolsUsed": ["getDashboardSummary"],
  "data": {
    "total_orders": 12,
    "delivered": 8,
    "in_transit": 3,
    "processing": 1,
    "revenue": 4250
  }
}
```

**Key difference:** The `toolsUsed` array may now contain gateway tool names (e.g., `getDashboardSummary`, `listOrders`) in addition to standard tools. The `data` field contains structured results from the gateway's target API.

### 6.4 Assistants List (EXISTING — no changes needed)

```
GET /api/v1/mobile/assistants
Authorization: Bearer <jwt>
```

Returns the user's assistants. Gateway users will have assistants just like regular users — the assistant itself doesn't know it's a "gateway assistant". Gateway detection happens via the user's `contact_id`.

### 6.5 TTS Endpoints (EXISTING — no changes needed)

```
POST /api/v1/mobile/tts
POST /api/v1/mobile/tts/preview
```

Voice support works identically for gateway and non-gateway users. The 6 OpenAI voices (alloy, echo, fable, onyx, nova, shimmer) are available to all users. See `TTS_VOICE_SELECTION_WIRING_GUIDE.md` for full details.

### 6.6 Conversations (EXISTING — no changes needed)

```
GET  /api/v1/mobile/conversations
GET  /api/v1/mobile/conversations/:id/messages
DELETE /api/v1/mobile/conversations/:id
```

Conversation history works the same. Gateway tool calls appear in the history as tool messages.

---

## 7. TypeScript Types

### Add to `src/types/index.ts` (or create `src/types/gateway.ts`)

```typescript
// ── Gateway AI Types ─────────────────────────────────────────────────

/** A single gateway configuration */
export interface GatewayConfig {
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  target_base_url: string;
  auth_type: 'rolling_token' | 'bearer' | 'basic' | 'api_key' | 'none';
  tools: string[];
  tools_count: number;
  rate_limit_rpm: number;
  total_requests: number;
  last_request_at: string | null;
  created_at: string;
}

/** Response from GET /api/v1/mobile/gateway-context */
export interface GatewayContextResponse {
  is_gateway: boolean;
  gateways: GatewayConfig[];
  total_tools: number;
  package: {
    slug: string;
    name: string;
    status: 'ACTIVE' | 'TRIAL';
  } | null;
}

/** Response from GET /api/dashboard/products (alternative) */
export interface ProductsResponse {
  products: {
    ai_assistant: boolean;
    api_gateway: boolean;
  };
  package: {
    slug: string;
    name: string;
    status: string;
    tier: string;
  } | null;
  gateway_summary: {
    total_gateways: number;
    gateways: GatewayConfig[];
  } | null;
  assistant_summary: {
    assistant_count: number;
    site_count: number;
  };
}

/** Gateway tool — for display in UI */
export interface GatewayTool {
  name: string;
  /** Derived display name: getDashboardSummary → "Get Dashboard Summary" */
  displayName: string;
  /** Icon name (MaterialCommunityIcons) — derived from tool name patterns */
  icon: string;
}

/** Predefined icon mapping for common gateway tool name patterns */
export const GATEWAY_TOOL_ICONS: Record<string, string> = {
  dashboard: 'view-dashboard',
  order: 'package-variant',
  orders: 'package-variant',
  customer: 'account-group',
  customers: 'account-group',
  sales: 'chart-line',
  report: 'chart-bar',
  driver: 'truck-delivery',
  drivers: 'truck-delivery',
  notify: 'bell-ring',
  search: 'magnify',
  update: 'pencil',
  list: 'format-list-bulleted',
  get: 'information',
  detail: 'text-box-search',
};
```

### Update the existing Assistant interface

```typescript
export interface Assistant {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  personality_flare: string | null;
  custom_greeting: string | null;
  voice_style: string | null;
  tts_voice: string | null;
  preferred_model: string | null;
  is_staff_agent: number;
  is_primary: number;
  status: string;
  tier: string;
}
```

> **No changes to the Assistant interface for gateway.** Gateway status is determined externally, not from the assistant object.

---

## 8. API Module Changes — `api/ai.ts`

No changes needed to `aiApi` for gateway support. The existing `sendIntent()` method works identically — the backend handles gateway context injection server-side.

For reference, `sendIntent()` already returns `toolsUsed` and `data`:

```typescript
// Already exists in src/api/ai.ts:
async sendIntent(params: {
  text: string;
  conversationId?: string;
  assistantId?: string;
  language?: string;
  image?: string;
}): Promise<{
  reply: string;
  tts_text: string;
  conversationId: string;
  toolsUsed: string[];
  data?: Record<string, unknown>;
}> {
  return api.post('/api/v1/mobile/intent', params);
}
```

The `toolsUsed` array will now include gateway tool names when a gateway user's assistant calls gateway tools. **No client-side changes are needed to the intent call itself.**

---

## 9. API Module — New `api/gateway.ts`

Create a new API module for gateway-specific endpoints:

**File:** `src/api/gateway.ts`

```typescript
import api from './client';
import type { GatewayContextResponse, ProductsResponse } from '../types';

export const gatewayApi = {
  /**
   * Get the user's gateway context — whether they're a gateway client,
   * their gateway configs, tools, and package info.
   */
  async getContext(): Promise<GatewayContextResponse> {
    return api.get('/api/v1/mobile/gateway-context');
  },

  /**
   * Alternative: Get full product detection including gateway + assistant info.
   * This returns more data but is a single call for everything.
   */
  async getProducts(): Promise<ProductsResponse> {
    return api.get('/api/dashboard/products');
  },
};
```

**Register in `src/api/index.ts`:**

```typescript
export { gatewayApi } from './gateway';
```

---

## 10. Hook — `useGatewayContext.ts`

Create a hook that loads and caches the user's gateway status. This is used by multiple screens to conditionally render gateway UI.

**File:** `src/hooks/useGatewayContext.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { gatewayApi } from '../api/gateway';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GatewayContextResponse, GatewayConfig, GatewayTool, GATEWAY_TOOL_ICONS } from '../types';

const CACHE_KEY = 'gateway_context';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Convert camelCase tool name to display name: getDashboardSummary → "Get Dashboard Summary" */
function toolNameToDisplay(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Resolve an icon for a tool based on its name */
function resolveToolIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [pattern, icon] of Object.entries(GATEWAY_TOOL_ICONS)) {
    if (lower.includes(pattern)) return icon;
  }
  return 'cog'; // fallback
}

/** Parse gateway tools into display-friendly objects */
function parseTools(toolNames: string[]): GatewayTool[] {
  return toolNames.map((name) => ({
    name,
    displayName: toolNameToDisplay(name),
    icon: resolveToolIcon(name),
  }));
}

export interface GatewayContextState {
  /** Whether the user is a gateway client */
  isGateway: boolean;
  /** Gateway configurations (may have multiple) */
  gateways: GatewayConfig[];
  /** All tools across all gateways, parsed for display */
  tools: GatewayTool[];
  /** Total tool count */
  totalTools: number;
  /** Package info */
  package: GatewayContextResponse['package'];
  /** Loading state */
  loading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Refresh gateway context from server */
  refresh: () => Promise<void>;
}

export function useGatewayContext(): GatewayContextState {
  const [data, setData] = useState<GatewayContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setData(cachedData);
            setLoading(false);
            // Still refresh in background
            gatewayApi.getContext().then((fresh) => {
              setData(fresh);
              AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
                data: fresh,
                timestamp: Date.now(),
              }));
            }).catch(() => {});
            return;
          }
        } catch {}
      }

      // Fetch fresh
      const result = await gatewayApi.getContext();
      setData(result);

      // Cache it
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data: result,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.warn('[useGatewayContext] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gateway context');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchContext();
    }
  }, [fetchContext]);

  // Parse tools from all gateways
  const allToolNames: string[] = [];
  if (data?.gateways) {
    for (const gw of data.gateways) {
      allToolNames.push(...(gw.tools || []));
    }
  }
  const tools = parseTools([...new Set(allToolNames)]);

  return {
    isGateway: data?.is_gateway ?? false,
    gateways: data?.gateways ?? [],
    tools,
    totalTools: data?.total_tools ?? 0,
    package: data?.package ?? null,
    loading,
    error,
    refresh: fetchContext,
  };
}
```

---

## 11. Gateway Detection Flow

When the user opens the app, the gateway detection happens as follows:

```
App opens → Auth completes → User lands on appropriate tab navigator
                                   │
                                   ▼
                        useGatewayContext() fires
                                   │
                        GET /api/v1/mobile/gateway-context
                                   │
                      ┌────────────┴────────────┐
                      │                         │
                 is_gateway: true          is_gateway: false
                      │                         │
                      ▼                         ▼
            Show gateway UI:              Show standard UI:
            • Gateway badge on            • Normal assistant cards
              assistant cards             • Leads, Sites, Email tools
            • Gateway dashboard           • Standard chat behaviour
              in portal nav
            • Tool list in chat
              header/info
```

### Where to Call the Hook

The `useGatewayContext()` hook should be called in:

1. **`AiChatScreen`** — To show gateway badge and context-aware UI
2. **`AiAssistantsScreen`** — To show gateway indicator on assistant cards
3. **`PortalDashboardScreen`** — To show gateway stats on the portal home
4. **`GatewayDashboardScreen`** (new) — Full gateway management screen

### Caching Strategy

- Cache gateway context in `AsyncStorage` with a 5-minute TTL
- On cache hit: show cached data immediately, refresh in background
- On cache miss: show loading spinner, fetch fresh data
- On refresh (pull-to-refresh): bypass cache, fetch fresh
- Gateway status changes very rarely (admin action), so aggressive caching is fine

---

## 12. Screen Changes — `AiChatScreen.tsx`

The `AiChatScreen` is the main AI chat screen used by both admin/staff and portal users. For gateway users, add visual indicators and context.

### Changes Overview

| Change | Description |
|--------|-------------|
| Gateway badge | Show a small "Gateway" badge next to the assistant name in the header |
| Tool indicator | When `toolsUsed` contains gateway tools, show a tool result card |
| Context info button | Optional "ℹ" button that shows gateway tool inventory |
| No voice changes | TTS + STT work identically — no changes needed |

### 12.1 Gateway Badge in Header

```typescript
import { useGatewayContext } from '../../hooks/useGatewayContext';

// Inside AiChatScreen:
const { isGateway, tools: gatewayTools } = useGatewayContext();

// In the header area, next to the assistant name:
{isGateway && (
  <View style={styles.gatewayBadge}>
    <MaterialCommunityIcons name="api" size={12} color="#fff" />
    <Text style={styles.gatewayBadgeText}>Gateway</Text>
  </View>
)}
```

```typescript
// Styles:
gatewayBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Primary[500],
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: BorderRadius.full,
  marginLeft: Spacing.xs,
  gap: 4,
},
gatewayBadgeText: {
  color: '#fff',
  fontSize: FontSize.xs,
  fontWeight: FontWeight.semibold,
},
```

### 12.2 Tool Result Cards in Chat

When the AI response includes `toolsUsed` with gateway tool names, render a subtle tool result indicator above the response text:

```typescript
// In the message bubble rendering:
function ToolUsedBadge({ toolName }: { toolName: string }) {
  const displayName = toolName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();

  return (
    <View style={styles.toolBadge}>
      <MaterialCommunityIcons name="cog" size={12} color={Gray[500]} />
      <Text style={styles.toolBadgeText}>Used: {displayName}</Text>
    </View>
  );
}

// In the assistant message rendering:
{message.toolsUsed?.length > 0 && (
  <View style={styles.toolBadges}>
    {message.toolsUsed.map((tool) => (
      <ToolUsedBadge key={tool} toolName={tool} />
    ))}
  </View>
)}
```

> **Note:** This applies to ALL tool calls (not just gateway tools). It makes the AI's actions visible to the user.

### 12.3 Gateway Info Sheet (Optional)

A bottom sheet or modal that shows the gateway tool inventory when the user taps the info button:

```typescript
// In the header, next to the gateway badge:
{isGateway && (
  <TouchableOpacity onPress={() => setShowGatewayInfo(true)}>
    <MaterialCommunityIcons name="information-outline" size={20} color={Gray[600]} />
  </TouchableOpacity>
)}

// Bottom sheet content:
<View>
  <Text style={styles.sheetTitle}>Gateway Tools</Text>
  <Text style={styles.sheetSubtitle}>
    Your assistant can use these tools to manage your business:
  </Text>
  {gatewayTools.map((tool) => (
    <View key={tool.name} style={styles.toolRow}>
      <MaterialCommunityIcons name={tool.icon} size={18} color={Primary[500]} />
      <Text style={styles.toolName}>{tool.displayName}</Text>
    </View>
  ))}
</View>
```

---

## 13. Screen Changes — `AiAssistantsScreen.tsx`

The assistants list screen shows cards for each assistant. For gateway users, add a visual indicator.

### Changes

```typescript
import { useGatewayContext } from '../../hooks/useGatewayContext';

// Inside AiAssistantsScreen:
const { isGateway, totalTools } = useGatewayContext();

// On each assistant card (below the name/personality):
{isGateway && (
  <View style={styles.gatewayIndicator}>
    <MaterialCommunityIcons name="api" size={14} color={Primary[500]} />
    <Text style={styles.gatewayIndicatorText}>
      Gateway Assistant — {totalTools} tools
    </Text>
  </View>
)}
```

```typescript
// Styles:
gatewayIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: Spacing.xs,
  gap: 4,
},
gatewayIndicatorText: {
  fontSize: FontSize.xs,
  color: Primary[600],
  fontWeight: FontWeight.medium,
},
```

---

## 14. New Screen — `GatewayDashboardScreen.tsx`

An optional dedicated screen for gateway users to view their gateway configuration, tool inventory, and request statistics.

**File:** `src/screens/portal/GatewayDashboardScreen.tsx`
**Estimated LOC:** ~200

### UI Layout

```
┌──────────────────────────────────────┐
│ ◄  Gateway Dashboard                │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 🟢 Braai Online              │   │
│  │ Status: Active               │   │
│  │ API: braaionline.africa      │   │
│  │ Auth: Rolling Token          │   │
│  │ Rate Limit: 60 req/min       │   │
│  │ Total Requests: 1,247        │   │
│  │ Last Request: 2 hours ago    │   │
│  └──────────────────────────────┘   │
│                                      │
│  ── Available Tools (10) ─────────  │
│                                      │
│  📊 Get Dashboard Summary           │
│  📦 List Orders                     │
│  ✏️  Update Order Status             │
│  📦 Get Order Detail                │
│  🔍 Search Customers                │
│  👤 Get Customer Detail             │
│  🏆 Get Top Customers               │
│  📈 Get Sales Report                │
│  🚛 List Drivers                    │
│  🔔 Notify Customer                 │
│                                      │
│  ── Package ──────────────────────  │
│                                      │
│  Pro Plan (TRIAL)                   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │   💬 Chat with Assistant     │   │
│  └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

### Reference Implementation

```typescript
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useGatewayContext } from '../../hooks/useGatewayContext';
import { Primary, Gray, Spacing, FontSize, FontWeight, BorderRadius, Shadow, Semantic } from '../../theme';

export function GatewayDashboardScreen() {
  const navigation = useNavigation();
  const {
    isGateway, gateways, tools, totalTools, package: pkg,
    loading, error, refresh,
  } = useGatewayContext();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Primary[500]} />
      </View>
    );
  }

  if (!isGateway) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="api-off" size={48} color={Gray[400]} />
        <Text style={styles.emptyText}>No API gateway configured</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      {/* Gateway Cards */}
      {gateways.map((gw) => (
        <View key={gw.client_id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[
              styles.statusDot,
              { backgroundColor: gw.status === 'active' ? Semantic.success.text : Semantic.warning.text }
            ]} />
            <Text style={styles.cardTitle}>{gw.client_name}</Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text style={styles.cardValue}>{gw.status}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>API Endpoint</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{gw.target_base_url}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Authentication</Text>
            <Text style={styles.cardValue}>{gw.auth_type.replace('_', ' ')}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Rate Limit</Text>
            <Text style={styles.cardValue}>{gw.rate_limit_rpm} req/min</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Total Requests</Text>
            <Text style={styles.cardValue}>{gw.total_requests.toLocaleString()}</Text>
          </View>
          {gw.last_request_at && (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Last Request</Text>
              <Text style={styles.cardValue}>{formatRelativeTime(gw.last_request_at)}</Text>
            </View>
          )}
        </View>
      ))}

      {/* Tool Inventory */}
      <Text style={styles.sectionTitle}>Available Tools ({totalTools})</Text>
      <View style={styles.toolsGrid}>
        {tools.map((tool) => (
          <View key={tool.name} style={styles.toolItem}>
            <MaterialCommunityIcons name={tool.icon} size={18} color={Primary[500]} />
            <Text style={styles.toolName}>{tool.displayName}</Text>
          </View>
        ))}
      </View>

      {/* Package Info */}
      {pkg && (
        <>
          <Text style={styles.sectionTitle}>Package</Text>
          <View style={styles.packageCard}>
            <Text style={styles.packageName}>{pkg.name}</Text>
            <View style={[
              styles.packageBadge,
              { backgroundColor: pkg.status === 'ACTIVE' ? Semantic.success.bg : Semantic.warning.bg }
            ]}>
              <Text style={[
                styles.packageBadgeText,
                { color: pkg.status === 'ACTIVE' ? Semantic.success.text : Semantic.warning.text }
              ]}>
                {pkg.status}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Chat CTA */}
      <TouchableOpacity
        style={styles.chatButton}
        onPress={() => navigation.navigate('AiChat' as never)}
      >
        <MaterialCommunityIcons name="message-text" size={20} color="#fff" />
        <Text style={styles.chatButtonText}>Chat with Assistant</Text>
      </TouchableOpacity>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

/** Helper: format ISO date to relative time (e.g., "2 hours ago") */
function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// StyleSheet: ~80 lines covering card, toolsGrid, packageCard, chatButton, etc.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Gray[50], padding: Spacing.base },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Gray[500], fontSize: FontSize.md, marginTop: Spacing.sm },
  card: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginBottom: Spacing.md, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Gray[900] },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Gray[100],
  },
  cardLabel: { fontSize: FontSize.sm, color: Gray[500] },
  cardValue: { fontSize: FontSize.sm, color: Gray[800], fontWeight: FontWeight.medium, maxWidth: '60%' },
  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Gray[900],
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  toolsGrid: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg,
    padding: Spacing.sm, ...Shadow.sm,
  },
  toolItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm, gap: Spacing.sm,
  },
  toolName: { fontSize: FontSize.sm, color: Gray[800] },
  packageCard: {
    backgroundColor: '#fff', borderRadius: BorderRadius.lg, padding: Spacing.base,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    ...Shadow.sm,
  },
  packageName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Gray[900] },
  packageBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  packageBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  chatButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Primary[500], borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginTop: Spacing.lg, gap: Spacing.sm,
  },
  chatButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
```

---

## 15. Navigation Changes

### Add Gateway Dashboard to Portal Navigation

**File:** `src/navigation/PortalStacks.tsx`

Add the `GatewayDashboard` screen to the Portal home stack or create a dedicated stack:

```typescript
import { GatewayDashboardScreen } from '../screens/portal/GatewayDashboardScreen';

// Inside PortalHomeStackNavigator (or a new GatewayStack):
<Stack.Screen
  name="GatewayDashboard"
  component={GatewayDashboardScreen}
  options={{ title: 'API Gateway' }}
/>
```

**File:** `src/navigation/types.ts`

Add the route params:

```typescript
export type PortalHomeStackParamList = {
  PortalDashboard: undefined;
  GatewayDashboard: undefined;   // ← ADD
  // ... existing routes
};
```

### Conditional Navigation Entry

In `PortalDashboardScreen` (or the drawer), conditionally show a "Gateway" menu item for gateway users:

```typescript
const { isGateway } = useGatewayContext();

// In the dashboard cards/menu:
{isGateway && (
  <TouchableOpacity
    style={styles.menuCard}
    onPress={() => navigation.navigate('GatewayDashboard')}
  >
    <MaterialCommunityIcons name="api" size={28} color={Primary[500]} />
    <Text style={styles.menuLabel}>API Gateway</Text>
  </TouchableOpacity>
)}
```

---

## 16. Voice Support (TTS + STT)

### No Changes Needed

Voice support works **identically** for gateway assistants and regular assistants. The entire voice pipeline is assistant-agnostic:

```
User speaks → @react-native-voice/voice (STT) → text
  → POST /api/v1/mobile/intent → AI processes with gateway tools → reply text
  → POST /api/v1/mobile/tts (OpenAI voice) → MP3 audio → playback
```

### Voice Selection

Gateway users can choose from the same 6 OpenAI TTS voices as any other user:

| Voice | Character |
|-------|-----------|
| **Nova** (default) | Warm & friendly |
| **Alloy** | Neutral & balanced |
| **Echo** | Smooth & clear male |
| **Fable** | Expressive British |
| **Onyx** | Deep & authoritative |
| **Shimmer** | Bright & upbeat |

The voice is configured per-assistant in `AssistantFormScreen` using the `VoicePicker` component (already wired per `TTS_VOICE_SELECTION_WIRING_GUIDE.md`).

### Voice Interaction Examples (Gateway)

These are the kinds of voice interactions gateway users will have:

| User Says | AI Does | AI Says (via TTS) |
|-----------|---------|-------------------|
| "Hi" | Nothing (greeting) | "Hi! How can I help with your store today?" |
| "Show me today's orders" | Calls `getDashboardSummary` | "You have 12 orders today. 8 delivered, 3 in transit, 1 processing. Revenue is R4,250." |
| "Update order 5042 to shipped" | Calls `updateOrderStatus` | "Done! Order 5042 has been updated to shipped." |
| "Who are my top customers?" | Calls `getTopCustomers` | "Your top 3 customers are John Doe with 45 orders, Jane Smith with 38, and Mike Johnson with 22." |
| "Send a delivery notification to the customer on order 5042" | Calls `getOrderDetail` then `notifyCustomer` | "Notification sent to the customer. They'll receive a delivery update shortly." |
| "What can you do?" | Lists capabilities | "I can help you manage orders, search customers, view sales reports, check on drivers, and send notifications. What would you like to do?" |

### Speech-Optimized Responses

The backend system prompt includes `VOICE INTERACTION` rules that instruct the AI to:

- Write in plain natural sentences (no markdown formatting)
- Use commas and periods instead of bullet points
- Keep responses concise (since they'll be spoken aloud)
- Avoid reading out technical details like JSON or tool names

This ensures TTS playback sounds natural regardless of whether it's a gateway or regular assistant.

---

## 17. Gateway Tool Results in Chat UI

### Message Data Model

When the AI uses a gateway tool, the intent response includes:

```json
{
  "toolsUsed": ["getDashboardSummary"],
  "data": {
    "total_orders": 12,
    "delivered": 8,
    "in_transit": 3,
    "revenue": 4250
  }
}
```

### Rendering Tool Results

You can optionally render structured tool data as cards within the chat. This is **purely a UI enhancement** — the AI's text reply already contains the information in natural language.

```typescript
/** Detect if a tool is a gateway tool (not a standard mobile tool) */
const STANDARD_TOOLS = new Set([
  'list_my_assistants', 'toggle_assistant_status', 'get_usage_stats',
  'list_failed_jobs', 'retry_failed_ingestion', 'list_leads',
  'get_lead_details', 'update_lead_status', 'get_lead_stats',
  'send_followup_email', 'send_info_email', 'list_my_sites',
  'get_site_details', 'update_site_field', 'regenerate_site',
  'deploy_site', 'get_site_deployments',
  // ... staff tools omitted for brevity
]);

function isGatewayTool(toolName: string): boolean {
  return !STANDARD_TOOLS.has(toolName);
}

// In message rendering:
{message.toolsUsed?.some(isGatewayTool) && message.data && (
  <View style={styles.gatewayDataCard}>
    <View style={styles.gatewayDataHeader}>
      <MaterialCommunityIcons name="api" size={14} color={Primary[500]} />
      <Text style={styles.gatewayDataTitle}>Gateway Data</Text>
    </View>
    {/* Render key-value pairs from data */}
    {Object.entries(message.data).map(([key, value]) => (
      <View key={key} style={styles.dataRow}>
        <Text style={styles.dataKey}>{key.replace(/_/g, ' ')}</Text>
        <Text style={styles.dataValue}>{String(value)}</Text>
      </View>
    ))}
  </View>
)}
```

> **This is optional.** The text reply from the AI already contains the information. The structured data card is a nice-to-have for users who want to see the raw data.

---

## 18. Offline & Error Handling

### Gateway Context Unavailable

If the gateway context endpoint fails or the user is offline:

```typescript
const { isGateway, loading, error } = useGatewayContext();

// While loading, show the chat normally (it still works — the backend handles gateway detection)
// If error, show chat normally with a subtle banner:

{error && (
  <View style={styles.offlineBanner}>
    <MaterialCommunityIcons name="cloud-off-outline" size={14} color={Semantic.warning.text} />
    <Text style={styles.offlineBannerText}>Gateway info unavailable — chat still works</Text>
  </View>
)}
```

**Key point:** The gateway context endpoint is only used for **UI decoration** (badges, dashboard, tool inventory). The actual gateway AI behaviour is handled entirely on the backend. If the mobile app can't fetch gateway context, the chat still works perfectly — the backend injects gateway tools into the system prompt regardless.

### Network Errors During Chat

If a gateway tool call fails (target API down, timeout, etc.), the backend returns an error message through the normal tool-call loop:

```
User: "Show me today's orders"
AI: [calls getDashboardSummary → target API timeout]
AI: "I'm having trouble reaching your store's API right now. The connection timed out. Please check that your API server is running and try again in a moment."
```

This is handled entirely server-side. The mobile app sees it as a normal text reply.

### TTS Fallback

If server-side TTS fails (e.g., OpenAI API down), the app should fall back to local `react-native-tts` as documented in `TTS_VOICE_SELECTION_WIRING_GUIDE.md`, Section 8:

```typescript
async function speak(text: string, voice?: string): Promise<void> {
  try {
    await speakWithOpenAI(text, voice);
  } catch (error) {
    console.warn('[Voice] Server TTS failed, falling back to local:', error);
    Tts.speak(text);
  }
}
```

---

## 19. Implementation Checklist

### Files to Create

| # | File | Purpose | Est. LOC |
|---|------|---------|----------|
| 1 | `src/types/gateway.ts` | Gateway TypeScript types + icon mapping | ~65 |
| 2 | `src/api/gateway.ts` | Gateway API module (`getContext`, `getProducts`) | ~25 |
| 3 | `src/hooks/useGatewayContext.ts` | Gateway detection hook with caching | ~120 |
| 4 | `src/screens/portal/GatewayDashboardScreen.tsx` | Gateway dashboard (tools, stats, config) | ~200 |

### Files to Modify

| # | File | Change | Est. LOC Δ |
|---|------|--------|------------|
| 5 | `src/types/index.ts` | Re-export gateway types | +2 |
| 6 | `src/api/index.ts` | Re-export `gatewayApi` | +1 |
| 7 | `src/screens/ai/AiChatScreen.tsx` | Gateway badge in header, tool result indicators, optional info sheet | +60 |
| 8 | `src/screens/ai/AiAssistantsScreen.tsx` | Gateway indicator on assistant cards | +15 |
| 9 | `src/screens/portal/PortalDashboardScreen.tsx` | Gateway menu card (conditional) | +15 |
| 10 | `src/navigation/PortalStacks.tsx` | Add `GatewayDashboard` screen to stack | +5 |
| 11 | `src/navigation/types.ts` | Add `GatewayDashboard` to param list types | +2 |

### Files NOT Modified (No Changes Needed)

| File | Reason |
|------|--------|
| `src/api/ai.ts` | `sendIntent()` already returns `toolsUsed` and `data` — works as-is |
| `src/hooks/useVoiceAssistant.ts` | Voice pipeline is assistant-agnostic — works as-is |
| `src/components/ai/VoicePicker.tsx` | Voice picker is already wired — works as-is |
| `src/screens/ai/AssistantFormScreen.tsx` | Assistant creation/editing — works as-is |
| `src/screens/ai/ConversationHistoryScreen.tsx` | History — works as-is |

### Step-by-Step Order

- [ ] **Step 1:** Add gateway types (`src/types/gateway.ts` + re-export from `index.ts`)
- [ ] **Step 2:** Create gateway API module (`src/api/gateway.ts` + re-export from `index.ts`)
- [ ] **Step 3:** Create `useGatewayContext` hook (`src/hooks/useGatewayContext.ts`)
- [ ] **Step 4:** Update `AiChatScreen` — add gateway badge + tool result indicators
- [ ] **Step 5:** Update `AiAssistantsScreen` — add gateway indicator on cards
- [ ] **Step 6:** Create `GatewayDashboardScreen` (`src/screens/portal/GatewayDashboardScreen.tsx`)
- [ ] **Step 7:** Add navigation — register `GatewayDashboard` in `PortalStacks.tsx` + `types.ts`
- [ ] **Step 8:** Update `PortalDashboardScreen` — add gateway menu card for gateway users
- [ ] **Step 9:** Test end-to-end with a gateway user account (see Testing Guide below)

### Backend Steps (Done By Backend Team)

- [ ] **Backend 1:** Inject gateway context into `mobileAIProcessor.ts` → `processMobileIntent()`
- [ ] **Backend 2:** Add gateway tool execution to `mobileActionExecutor.ts`
- [ ] **Backend 3:** Create `GET /api/v1/mobile/gateway-context` endpoint in `mobileIntent.ts`
- [ ] **Backend 4:** Deploy + restart backend

---

## 20. Testing Guide

### Test Account

| Field | Value |
|-------|-------|
| Email | `masiya.e@gmail.com` |
| User ID | `5e9bc8d3-a915-47e6-bdc3-a427645b74f2` |
| Contact ID | 73 |
| Package | Pro (TRIAL) |
| Gateway Client ID | `braai-online` |
| Gateway Client Name | Braai Online |
| Assistant ID | `assistant-1774305018268` |
| Assistant Name | Braai AI |
| Tool Count | 10 |

### Phase 1 — Confirm the Bug (Before Backend Fix)

Run these to confirm you can reproduce the current broken state. This gives you a baseline to verify the fix works.

| # | Test | What You'll See (BROKEN) | What It Should Be (FIXED) |
|---|------|--------------------------|---------------------------|
| B1 | Login as `masiya.e@gmail.com`, open chat, say "Hi" | AI introduces itself as a "Soft Aware account assistant" for managing websites/leads | Short: "Hi! How can I help with your store today?" |
| B2 | Say "Show me today's orders" | AI says it can't access orders, or tries to call `list_leads` | AI calls `getDashboardSummary`, returns order summary |
| B3 | Say "What can you do?" | Lists: leads, email follow-up, website editing, assistant management | Lists: orders, customers, sales reports, drivers, notifications |
| B4 | Say "Update order 5042 to shipped" | AI says it can't do that / doesn't understand | AI calls `updateOrderStatus`, confirms the change |

### Phase 2 — Test After Backend Fix

Once backend steps 1–3 in Section 19 are deployed, run these:

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | **Gateway detection** | Login as test account → call `GET /api/v1/mobile/gateway-context` directly | `is_gateway: true`, 1 gateway, 10 tools listed |
| 2 | **Chat corrected** | Open chat → say "Hi" | Short greeting as "Braai AI" — NOT "Soft Aware account assistant" |
| 3 | **Gateway tool call** | Say "Show me today's orders" | AI calls `getDashboardSummary`, responds with real order data. `toolsUsed: ["getDashboardSummary"]` |
| 4 | **Multi-tool chain** | Say "Send a delivery update to the customer on order 5042" | AI chains `getOrderDetail` → `notifyCustomer`. Both in `toolsUsed`. |
| 5 | **Capabilities query** | Say "What can you do?" | Describes gateway tools in natural language — no tool name dump |
| 6 | **Assistant list badge** | Navigate to Assistants screen (after mobile UI changes) | "Braai AI" card shows "Gateway Assistant — 10 tools" badge |
| 7 | **Gateway dashboard** | Navigate to Gateway Dashboard screen | Shows Braai Online card with status, API URL, auth type, request count |
| 8 | **Non-gateway user** | Login as a non-gateway user | `is_gateway: false`. No badges. AI behaves as normal website assistant. |
| 9 | **Tool result card** | After a gateway tool response, inspect the message | Tool badge shows "Used: Get Dashboard Summary" above the reply |
| 10 | **Offline fallback** | Turn off WiFi → open chat → send message | Chat works from conversation cache. Gateway badge may not load, but chat still works. |

### Voice-Specific Tests

| # | Test | Expected |
|---|------|----------|
| V1 | Say "can you hear me?" | "Yes, I can hear you! How can I help?" (NOT "I'm a text-only AI") |
| V2 | Say "list my orders" in voice mode | Response spoken naturally, no asterisks or markdown read aloud |
| V3 | Switch to each of the 6 voices in AssistantForm | Preview plays correctly for each voice |
| V4 | Save a voice preference (e.g., "Echo") → chat | TTS uses Echo voice |
| V5 | Network disconnects during TTS playback | Falls back to local `react-native-tts` on-device voice |
| V6 | Long response (e.g., "Show top 10 customers") | TTS reads smoothly with natural sentence flow, not bullet points |

### Voice-Specific Tests

| # | Test | Expected |
|---|------|----------|
| V1 | Say "can you hear me?" | "Yes, I can hear you! How can I help?" (NOT "I'm a text-only AI") |
| V2 | Say "list my orders" in voice mode | Response spoken naturally, no asterisks or markdown read aloud |
| V3 | Switch to each of the 6 voices | Preview plays correctly, TTS uses the selected voice |
| V4 | Network disconnects during TTS | Falls back to local `react-native-tts` on-device voice |
| V5 | Long response (e.g., top 10 customers) | TTS reads smoothly with commas for pauses, not bullet points |

---

## Appendix A: Full Gateway Tool List (Braai Online Example)

| # | Tool Name | What It Does | Typical Voice Command |
|---|-----------|-------------|----------------------|
| 1 | `getDashboardSummary` | Revenue, order count, customer count overview | "Give me a summary" / "How's business today?" |
| 2 | `listOrders` | List orders filtered by status, date, customer | "Show me today's orders" / "List pending orders" |
| 3 | `updateOrderStatus` | Change order status | "Mark order 5042 as shipped" / "Update order status" |
| 4 | `getOrderDetail` | Full order details (items, customer, payment) | "Show me order 5042" / "What's in order 5042?" |
| 5 | `searchCustomers` | Search customers by name/email/phone | "Find customer John" / "Search for john@email.com" |
| 6 | `getCustomerDetail` | Full customer profile with order history | "Show me John Doe's profile" |
| 7 | `getTopCustomers` | Top customers by orders or revenue | "Who are my top customers?" / "Best customers this month" |
| 8 | `getSalesReport` | Sales analytics by period | "Sales report for this week" / "How were sales last month?" |
| 9 | `listDrivers` | List delivery drivers and their status | "Show me the drivers" / "Who's available for delivery?" |
| 10 | `notifyCustomer` | Send notification to a customer | "Notify the customer on order 5042 about delivery" |

---

## Appendix B: Endpoint Quick Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/mobile/intent` | JWT | Main AI chat (text + voice) — gateway tools injected server-side |
| `GET` | `/api/v1/mobile/assistants` | JWT | List user's assistants |
| `GET` | `/api/v1/mobile/conversations` | JWT | List conversations |
| `GET` | `/api/v1/mobile/conversations/:id/messages` | JWT | Conversation message history |
| `DELETE` | `/api/v1/mobile/conversations/:id` | JWT | Delete a conversation |
| `POST` | `/api/v1/mobile/tts` | JWT | Text-to-Speech (OpenAI, 6 voices) |
| `POST` | `/api/v1/mobile/tts/preview` | JWT | Voice preview sample |
| `GET` | `/api/v1/mobile/gateway-context` | JWT | **NEW** — Gateway detection + tool inventory |
| `GET` | `/api/dashboard/products` | JWT | Product detection (alternative to gateway-context) |
| `GET` | `/api/v1/mobile/my-assistant` | JWT | Full assistant CRUD (GET/POST/PUT/DELETE) |

---

## Appendix C: Decision Log

| Decision | Rationale |
|----------|-----------|
| Gateway detection via endpoint, not assistant flag | Gateway is a **user-level** property (tied to `contact_id`), not an assistant property. One user might have multiple assistants; all inherit gateway status. |
| Reuse same `AiChatScreen` for gateway | The chat UI is assistant-agnostic. Gateway differences are handled server-side (prompt, tools). Mobile just needs badges. |
| No separate gateway chat endpoint | `POST /intent` handles everything. Backend detects gateway and injects context. Mobile doesn't need to know the difference for chat to work. |
| Cache gateway context for 5 min | Gateway configs rarely change (admin action). Aggressive caching avoids unnecessary API calls on every screen transition. |
| TTS unchanged for gateway | Voice pipeline is content-agnostic. The backend ensures AI responses are speech-friendly (no markdown, concise sentences). |
| `useGatewayContext` hook pattern | Consistent with existing hooks (`useCachedFetch`, `useVoiceAssistant`). Cache-first + background refresh. |
| Optional `GatewayDashboardScreen` | Gateway users benefit from seeing their config at a glance, but the chat is the primary interaction. Dashboard is a nice-to-have. |

---

*End of wiring guide.*
