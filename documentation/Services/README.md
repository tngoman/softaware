# Services Layer — Technical Documentation

> **Module:** `backend/src/services/`  
> **Total Files:** 36 (32 root + 4 in `ai/` subdirectory)  
> **Total LOC:** ~9,925  
> **Last Updated:** 2026-03-05

---

## Overview

The Services layer is the core business logic of the SoftAware platform.  
Every service is a **stateless module** exporting named async functions or singleton objects — no Express middleware, no HTTP concerns.  
Route handlers import services and call them; services never import routes.

```
┌───────────────────────────────────────────────────────────────┐
│                      Route Handlers                           │
│   (Express controllers in src/routes/*.ts)                    │
└──────────────┬────────────────────────────────────────────────┘
               │  import { fn } from '../services/…'
               ▼
┌───────────────────────────────────────────────────────────────┐
│                      SERVICES LAYER                           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐      │
│  │ AI & LLM    │  │ Knowledge   │  │ Widget / Chat    │      │
│  │             │  │ Ingestion   │  │                  │      │
│  │ AIProvider  │  │ Pipeline    │  │ widgetService    │      │
│  │ GLMProvider │  │             │  │ actionRouter     │      │
│  │ OllamaProvi│  │ ingestion   │  │ leadCapture      │      │
│  │ glmService  │  │ Worker      │  │ payloadNorm.     │      │
│  │ openRouter  │  │ documentSvc │  │                  │      │
│  │ Vision      │  │ embedding   │  └──────────────────┘      │
│  │ caseAnalyz. │  │ vectorStore │                             │
│  │ ingestionAI │  │ crawler     │  ┌──────────────────┐      │
│  │ Router      │  │ knowledge   │  │ Billing          │      │
│  │ codeAgent   │  │ Categorizer │  │                  │      │
│  └─────────────┘  └─────────────┘  │ credits          │      │
│                                     │ payment          │      │
│  ┌─────────────┐  ┌─────────────┐  │ subscription     │      │
│  │ Site Builder│  │ Infra &     │  └──────────────────┘      │
│  │             │  │ Monitoring  │                             │
│  │ siteBuilder │  │             │  ┌──────────────────┐      │
│  │ ftpDeploy   │  │ healthMon.  │  │ External         │      │
│  │             │  │ notification│  │                  │      │
│  └─────────────┘  │ firebase    │  │ sshService       │      │
│                    └─────────────┘  │ smsService       │      │
│  ┌─────────────┐                    │ emailService     │      │
│  │ Credential  │  ┌─────────────┐   │ enterprise       │      │
│  │ Vault       │  │ Mobile AI   │   │ Endpoints        │      │
│  │             │  │ Assistant   │   └──────────────────┘      │
│  │ credential  │  │             │                             │
│  │ Vault.ts    │  │ mobileAI    │                             │
│  │ (encrypted  │  │ Processor   │                             │
│  │  reads +    │  │ mobileActn  │                             │
│  │  5-min      │  │ Executor    │                             │
│  │  cache)     │  │ mobileTools │                             │
│  └──────┬──────┘  └─────────────┘                             │
│         │  consumed by 9+ services                            │
│                                                               │
│  ┌─────────────────────────────┐                              │
│  │ ai/ Provider Abstraction    │                              │
│  │ AIProvider.ts (interface)   │                              │
│  │ AIProviderManager.ts        │                              │
│  │ GLMProvider.ts              │                              │
│  │ OllamaProvider.ts           │                              │
│  └─────────────────────────────┘                              │
└───────────────────────────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────────────┐
│  db/mysql.ts   │  config/env.ts   │  utils/cryptoUtils.ts    │
│  (MySQL pool)  │  (Zod schema)    │  (AES-256-GCM)           │
└───────────────────────────────────────────────────────────────┘
```

---

## Service Groups

### 1. AI & LLM Layer (8 files, ~764 LOC)

> *Note: `glmService.ts` is deprecated since 2025-07-15 — use `ai/GLMProvider.ts` instead.*

Abstracts LLM interaction behind a strategy pattern with multiple providers.

| Service | Purpose | Provider |
|---------|---------|----------|
| `ai/AIProvider.ts` | Abstract interface (`AIProvider`, `AIMessage`, `AIResponse`) | — |
| `ai/AIProviderManager.ts` | Registry + router; selects active provider | All |
| `ai/GLMProvider.ts` | ZhipuAI GLM-4.5-Flash via OpenAI-compatible SDK | GLM |
| `ai/OllamaProvider.ts` | Local Ollama models via REST | Ollama |
| `glmService.ts` | Standalone GLM wrapper (legacy, predates provider pattern) | GLM |
| `openRouterVision.ts` | Vision analysis with model fallback chain | OpenRouter |
| `ingestionAIRouter.ts` | Tier-based AI routing: free → Ollama, paid → OpenRouter | Both |
| `caseAnalyzer.ts` | Bug triage via Ollama + Gemma 2 with component mapping | Ollama |

### 2. Knowledge Ingestion Pipeline (7 files, ~1,721 LOC)

Crawls, cleans, chunks, embeds, and stores business knowledge for RAG retrieval.

| Service | Purpose |
|---------|---------|
| `ingestionWorker.ts` | Background poll loop — fetches jobs, processes pipeline |
| `ingestionWorkerProcess.ts` | Isolated child process entry point (fork from index.ts) |
| `ingestionAIRouter.ts` | AI content cleaning (shared with AI layer) |
| `knowledgeCategorizer.ts` | Dynamic checklist scoring via Ollama |
| `documentService.ts` | Document storage, crawling, HTML extraction |
| `embeddingService.ts` | Ollama `nomic-embed-text` embedding + cosine similarity |
| `vectorStore.ts` | sqlite-vec vector storage and KNN search |
| `crawlerService.ts` | Crawl queue management (enqueue, dequeue, retry) |

### 3. Widget / Chat System (4 files, ~1,353 LOC)

Powers the embeddable AI chat widget and lead capture.

| Service | Purpose |
|---------|---------|
| `widgetService.ts` | Widget client CRUD, message logging, usage stats |
| `actionRouter.ts` | Function calling engine (lead capture, webhooks, callbacks) |
| `leadCaptureService.ts` | Lead detection from AI responses, email notifications |
| `payloadNormalizer.ts` | Multi-channel adapter (WhatsApp, Slack, SMS, email, web) |

### 4. Billing & Subscription (3 files, ~1,267 LOC)

Credit-based monetisation with SA payment gateways.

| Service | Purpose |
|---------|---------|
| `credits.ts` | Credit balance CRUD, deduction, low-balance alerts |
| `payment.ts` | PayFast + Yoco checkout creation and webhook processing |
| `subscription.ts` | Plan management, trial creation, upgrades, cancellation |

### 5. Site Builder (2 files, ~785 LOC)

Generates and deploys static HTML sites for clients.

| Service | Purpose |
|---------|---------|
| `siteBuilderService.ts` | Site CRUD, HTML/CSS generation, FTP credential encryption |
| `ftpDeploymentService.ts` | SFTP deployment with deployment history |

### 6. Infrastructure & Monitoring (3 files, ~695 LOC)

System health, notifications, and push messaging.

| Service | Purpose |
|---------|---------|
| `healthMonitor.ts` | Continuous health checks, auto-case creation, admin alerts |
| `notificationService.ts` | Thin wrapper mapping notification types |
| `firebaseService.ts` | FCM push notifications, token management, stale token cleanup |

### 7. External Connectivity (4 files, ~1,521 LOC)

SSH, SMS, email, and enterprise webhook integrations.

| Service | LOC | Purpose |
|---------|-----|---------|-------|
| `sshService.ts` | ~285 | SSH/SFTP file operations with connection pooling |
| `smsService.ts` | ~411 | SMSPortal REST API — send, bulk, balance, SA phone normalisation, token caching, `sms_log` audit |
| `emailService.ts` | ~325 | SMTP email via nodemailer — auto-creates transporter from credentials table, `email_log` audit, 2FA OTP delivery |
| `enterpriseEndpoints.ts` | ~500 | Dynamic webhook config (SQLite), request logging |

### 8. Credential Vault (1 file, ~248 LOC)

Centralised encrypted credential reader for all services.

| Service | Purpose |
|---------|---------|-------|
| `credentialVault.ts` | AES-256-GCM credential reads from `credentials` table with 5-min cache, env-var fallback, and `invalidateCache()` API for CRUD ops |

### 9. Mobile AI Assistant (3 files, ~1,613 LOC)

Voice/text AI assistant for the mobile app with role-based tool calling.

| Service | LOC | Purpose |
|---------|-----|---------|-------|
| `mobileAIProcessor.ts` | ~384 | Ollama conversation workflow with iterative tool-call loop, prompt stitching (core_instructions + personality), context history |
| `mobileActionExecutor.ts` | ~809 | 13 tool implementations with ownership verification, staff task proxy via external API, multi-table DB queries |
| `mobileTools.ts` | ~420 | OpenAI-compatible tool definitions — 5 client tools + 8 staff-only tools |

### 10. Code Agent (1 file, 188 LOC)

AI-powered code editing restricted to `/var/www/code`.

| Service | Purpose |
|---------|---------|
| `codeAgent.ts` | Accepts instructions, generates file changes via AI, executes safely |

---

## Cross-Service Dependencies

```
credentialVault  (consumed by 10+ services)
  └── cryptoUtils  (decryptPassword)
  └── db/mysql    (credentials table)
  Consumers: openRouterVision, ingestionAIRouter, firebaseService,
             payment, leadCaptureService, actionRouter, GLMProvider,
             glmService, emailService, smsService

ingestionWorker
  ├── ingestionAIRouter  (AI cleaning)
  ├── knowledgeCategorizer  (checklist scoring)
  ├── vectorStore  (sqlite-vec storage)
  └── embeddingService  (generates embeddings — but calls Ollama directly too)

mobileAIProcessor
  ├── mobileTools  (role-based tool definitions)
  ├── mobileActionExecutor  (tool execution engine)
  ├── actionRouter  (parseToolCall)
  └── db/mysql  (mobile_conversations, mobile_messages, assistants)

mobileActionExecutor
  ├── knowledgeCategorizer  (getAssistantKnowledgeHealth)
  └── enterpriseEndpoints  (createEndpoint)

emailService
  └── credentialVault / db/mysql  (SMTP credentials)
  └── nodemailer  (send via SMTP)

documentService
  └── embeddingService  (embed on store)

crawlerService
  └── documentService  (crawlWebsite)

ftpDeploymentService
  └── siteBuilderService  (getSiteById, getDecryptedFTPCredentials, generateStaticFiles)

siteBuilderService
  └── cryptoUtils  (encryptPassword / decryptPassword)

smsService
  └── cryptoUtils  (decryptPassword for SMS credentials)

healthMonitor
  ├── enterpriseEndpoints  (check endpoint health)
  └── notificationService  (admin alerts)

notificationService
  └── firebaseService  (createNotificationWithPush)

actionRouter
  └── credentialVault / nodemailer  (lead notification emails)

payment
  ├── credentialVault  (PayFast / Yoco credentials)
  └── credits  (addCredits after successful payment)

codeAgent
  └── ai/AIProviderManager  (get AI provider for code generation)
```

---

## Databases Used

| Database | Technology | Services |
|----------|------------|----------|
| `softaware` | MySQL 8 | credits, payment, subscription, widgetService, documentService, embeddingService, crawlerService, smsService, firebaseService, healthMonitor, siteBuilderService, ftpDeploymentService, leadCaptureService, actionRouter, knowledgeCategorizer, ingestionWorker |
| `enterprise_endpoints.db` | SQLite (better-sqlite3) | enterpriseEndpoints |
| `vectors.db` | SQLite + sqlite-vec | vectorStore |

---

## External APIs

| API | Service | Auth Method | Credential Source |
|-----|---------|-------------|-------------------|
| SMSPortal REST | smsService | OAuth2 client_credentials (Basic header) | `credentials` table (encrypted) |
| OpenRouter | openRouterVision, ingestionAIRouter | Bearer token | Vault key `OPENROUTER` |
| Ollama (local) | OllamaProvider, embeddingService, caseAnalyzer, knowledgeCategorizer, ingestionWorker, mobileAIProcessor | None (localhost) | `OLLAMA_BASE_URL` env |
| ZhipuAI GLM | GLMProvider, glmService | API key via OpenAI SDK | Vault key `GLM` |
| Firebase FCM | firebaseService | Service account cert | Vault key `FIREBASE` |
| PayFast | payment | Merchant ID + Key | Vault key `PAYFAST` |
| Yoco Checkout | payment | Secret key | Vault key `YOCO` |
| SMTP | emailService, actionRouter, leadCaptureService | SMTP auth | Vault key `SMTP` |
| External Software API | mobileActionExecutor | Bearer token | `staff_software_tokens` table |

---

## Quick Start

```typescript
// Import a service function
import { sendSms } from '../services/smsService.js';

// Call it from a route handler
const result = await sendSms('27821234567', 'Hello from SoftAware');

// Services handle their own DB access, error logging, and retries
```

All services use the `.js` extension in imports (ESM with TypeScript).
