# Services — File Inventory

> Every file under `backend/src/services/` with purpose, LOC, exports, and dependencies.

---

## Root Services (`src/services/`)

### actionRouter.ts — 503 LOC

**Purpose:** Function calling engine for AI assistants. Enables assistants to execute real-world actions (lead capture, webhooks, callbacks) via OpenAI-compatible tool definitions.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `ToolDefinition` | interface | OpenAI tool schema shape |
| `ToolCall` | interface | Parsed tool invocation |
| `ToolResult` | interface | Execution outcome |
| `getToolsForTier(tier, enabledTools?)` | function | Returns tool definitions by tier |
| `getToolsSystemPrompt(tools)` | function | Generates LLM system prompt for tools |
| `parseToolCall(response)` | function | Extracts tool JSON from LLM text |
| `executeToolCall(toolCall, assistantId, config)` | async function | Dispatches and executes a tool |

**Dependencies:** `db/mysql`, `nodemailer`, `axios`, `config/env`  
**Tables:** `lead_captures`, `widget_usage_logs`

---

### caseAnalyzer.ts — 189 LOC

**Purpose:** Uses Ollama + Gemma 2 to analyze user-reported issues and identify the specific component or code area related to a bug. Includes a hardcoded `COMPONENT_MAP` for route → React component lookup.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `analyzeComponentFromContext(context)` | async function | AI-powered component identification from bug context |
| `analyzeErrorStack(errorStack)` | async function | Identifies component from JS stack trace |

**Dependencies:** `ollama` (npm)  
**Tables:** None

---

### codeAgent.ts — 188 LOC

**Purpose:** AI-powered code editing agent restricted to `/var/www/code`. Reads context files, sends instructions to an AI provider, parses JSON responses, and applies file changes.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `CodeEditRequest` | interface | Input shape for code edit |
| `CodeEditResponse` | interface | Output shape with changes list |
| `CodeAgentService` | class | Main agent class |
| `codeAgentService` | singleton | Pre-instantiated instance |

**Dependencies:** `fs/promises`, `path`, `ai/AIProviderManager`  
**Tables:** None  
**Security:** Validates directory against `ALLOWED_DIRECTORIES` whitelist

---

### crawlerService.ts — 158 LOC

**Purpose:** Crawl queue management for website content ingestion. Provides FIFO job queue with retry logic (max 3 retries) and batch processing.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `CrawlJob` | interface | Queue job shape |
| `crawlerService` | object literal | CRUD + queue operations |

**Key Methods:** `enqueueCrawl`, `getNextJob`, `markProcessing`, `markCompleted`, `markFailed`, `processPendingJobs`, `getClientJobs`, `reEnqueueCompleted`

**Dependencies:** `crypto`, `db/mysql`, `documentService`  
**Tables:** `crawl_queue`, `widget_clients` (pages_ingested update)

---

### credentialVault.ts — 248 LOC

**Purpose:** Centralised encrypted credential reader. All API keys, passwords, and secrets are stored in the `credentials` table and encrypted with AES-256-GCM. Services call this module instead of reading raw `process.env` values. A 5-minute in-memory cache avoids hitting the DB on every request. Provides `invalidateCache()` for CRUD operations to clear stale entries.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `VaultEntry` | interface | `{ value: string; data: Record<string, string> \| null }` |
| `getCredential(serviceName)` | async function | Fetch credential by `service_name` — returns decrypted value + additional data |
| `getSecret(serviceName, envFallback?)` | async function | Convenience — primary secret with env-var fallback |
| `getSmtpConfig()` | async function | Ready-to-use nodemailer config from vault |
| `getFirebaseConfig()` | async function | Firebase project ID, client email, private key |
| `getPayFastConfig()` | async function | Merchant ID, key, passphrase |
| `getYocoConfig()` | async function | Secret key, webhook secret |
| `invalidateCache(serviceName?)` | function | Clear cache (call after credential rotation) |

**Dependencies:** `db/mysql`, `cryptoUtils`, `config/env`  
**Tables:** `credentials` (read-only)  
**Cache:** 5-minute TTL for hits, 1-minute TTL for misses  
**Note:** During migration, `tryDecrypt()` treats non-hex values as plaintext so unencrypted rows still work.

---

### credits.ts — 429 LOC

**Purpose:** Credit balance management. Handles balance creation (with signup bonus), deduction with insufficient-funds check, additions (purchase/bonus/refund), transaction history, usage statistics, low-balance alerts, and package seeding.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `CreditTransactionType` | type | `BONUS \| USAGE \| PURCHASE \| REFUND \| ADJUSTMENT` |
| `PaymentProvider` | type | `PAYFAST \| YOCO \| MANUAL` |
| `CreditBalanceInfo` | interface | Balance snapshot |
| `TransactionInfo` | interface | Transaction record |
| `getTeamCreditBalance(teamId, createIfMissing?)` | async function | Get or auto-create balance |
| `deductCredits(teamId, requestType, metadata?)` | async function | Deduct with validation |
| `addCredits(teamId, amount, type, options?)` | async function | Add credits |
| `getTransactionHistory(teamId, options?)` | async function | Paginated + filtered history |
| `getUsageStatistics(teamId, days?)` | async function | Daily usage breakdown |
| `getCreditPackages()` | async function | List active packages |
| `getCreditPackage(id)` | async function | Get single package |
| `seedCreditPackages()` | async function | Upsert 5 default packages |

**Dependencies:** `db/mysql`, `config/credits`  
**Tables:** `credit_balances`, `credit_transactions`, `credit_packages`  
**Currency:** All amounts in ZAR cents (R1.00 = 100)

---

### documentService.ts — 316 LOC

**Purpose:** Document storage, website crawling, and HTML text extraction using cheerio. Chunks text with sentence-boundary awareness (1000 chars, 200 overlap) and auto-generates embeddings on store.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `DocumentMetadata` | interface | Chunk metadata shape |
| `documentService` | object literal | Document CRUD + crawling |

**Key Methods:** `storeChunk`, `crawlWebsite`, `storeFileContent`, `getClientDocuments`, `getDocumentSources`, `deleteClientDocuments`, `deleteDocumentsBySource`

**Dependencies:** `crypto`, `db/mysql`, `axios`, `cheerio`, `embeddingService`  
**Tables:** `document_metadata`, `widget_clients` (pages_ingested)

---

### embeddingService.ts — 171 LOC

**Purpose:** Generates text embeddings via local Ollama `nomic-embed-text` model and stores them in MySQL. Provides naive cosine-similarity search (loads all embeddings into memory).

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `DocumentEmbedding` | interface | Embedding record shape |
| `generateEmbedding(text, model?)` | async function | Generate embedding vector |
| `cosineSimilarity(vecA, vecB)` | function | Vector similarity calculation |
| `embeddingService` | object literal | Storage + search operations |

**Key Methods:** `storeEmbedding`, `getEmbeddingByDocumentId`, `searchSimilar`, `embedDocument`, `deleteClientEmbeddings`

**Dependencies:** `crypto`, `db/mysql`, `config/env`  
**Tables:** `document_embeddings`, `document_metadata` (joined)  
**Note:** This is the MySQL-based search. `vectorStore.ts` provides the faster sqlite-vec alternative.

---

### emailService.ts — 325 LOC

**Purpose:** SMTP email integration via credentials table. Caches the nodemailer transporter until credentials change. Supports test emails, 2FA OTP emails, and general sending. Logs all sends to `email_log` table (auto-created on first use). Falls back to env vars (`SMTP_HOST`, etc.) if no credentials row exists.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `EmailOptions` | interface | Send options (to, subject, html, text, cc, bcc, attachments) |
| `EmailSendResult` | interface | `{ success, messageId?, error? }` |
| `sendEmail(options)` | async function | Send an email via SMTP |
| `sendTestEmail(to)` | async function | Send styled test email |
| `sendTwoFactorOtp(to, code, userName?)` | async function | Send 2FA verification code |
| `invalidateTransporter()` | function | Clear cached transporter (call after config update) |
| `emailService` | object literal | Namespace export of all functions |

**Dependencies:** `nodemailer`, `db/mysql`, `cryptoUtils`, `config/env`  
**Tables:** `credentials` (read — `SMTP` service), `email_log` (auto-created, write)  
**Note:** Falls back to env vars (`SMTP_HOST`, etc.) if no credentials row exists.

---

### enterpriseEndpoints.ts — 343 LOC

**Purpose:** Dynamic webhook configuration for enterprise clients. Uses a standalone SQLite database (not MySQL). Each endpoint has inbound auth config, LLM config, and outbound target config.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `EnterpriseEndpoint` | interface | Full endpoint shape (23 fields) |
| `EndpointCreateInput` | interface | Creation payload |
| `createEndpoint(input)` | function | Create with auto-generated ID |
| `getEndpoint(id)` | function | Get by ID |
| `getAllEndpoints()` | function | List all (admin) |
| `getEndpointsByClient(clientId)` | function | List by client |
| `updateEndpoint(id, updates)` | function | Partial update |
| `setEndpointStatus(id, status)` | function | Toggle active/paused/disabled |
| `deleteEndpoint(id)` | function | Hard delete |
| `logRequest(id, payload, response, ms, status, error?)` | function | Log request for analytics |
| `getRequestLogs(id, limit?, offset?)` | function | Paginated logs |
| `close()` | function | Close SQLite connection |

**Dependencies:** `better-sqlite3`, `crypto`  
**Database:** `/var/opt/backend/data/enterprise_endpoints.db` (SQLite)  
**Tables:** `enterprise_endpoints`, `endpoint_requests`  
**Note:** All functions are **synchronous** (SQLite) — no `async`.

---

### firebaseService.ts — 238 LOC

**Purpose:** Firebase Admin SDK for FCM push notifications. Manages device token registration, sends multicast pushes, auto-cleans stale tokens, and provides a unified `createNotificationWithPush` that respects user notification preferences.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `isFirebaseEnabled()` | function | Check if FCM is operational |
| `registerFcmToken(userId, token, device?, platform?)` | async function | Upsert device token |
| `unregisterFcmToken(userId, token)` | async function | Remove token |
| `listFcmTokens(userId)` | async function | List registered devices |
| `PushPayload` | interface | Push notification shape |
| `sendPushToUser(userId, payload)` | async function | Multicast push to all user devices |
| `sendPushToUsers(userIds, payload)` | async function | Batch push to multiple users |
| `createNotificationWithPush(userId, notification)` | async function | In-app notification + push |

**Dependencies:** `firebase-admin`, `config/env`, `db/mysql`, `credentialVault`  
**Tables:** `fcm_tokens`, `notifications`, `users` (preferences check)  
**Vault Key:** `FIREBASE` (project ID, client email, private key)  
**Note:** `initFirebase()` is now async — reads credentials from vault with env-var fallback.

---

### ftpDeploymentService.ts — 206 LOC

**Purpose:** Deploys generated sites to remote SFTP servers. Manages deployment lifecycle (pending → uploading → success/failed) with timing and file counting.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `DeploymentResult` | interface | Deployment outcome |
| `ftpDeploymentService` | object literal | Deploy + history operations |

**Key Methods:** `deploySite`, `deploySFTP`, `getDeploymentHistory`, `getDeploymentById`

**Dependencies:** `crypto`, `db/mysql`, `siteBuilderService`, `ssh2-sftp-client`  
**Tables:** `site_deployments`, `generated_sites`  
**Security:** Credentials decrypted in memory only; cleared after use.

---

### glmService.ts — 61 LOC

**Purpose:** Standalone wrapper for ZhipuAI GLM-4 API using OpenAI-compatible SDK. Provides `chat` and `simpleChat` methods.

> **⚠️ Deprecated** since 2025-07-15. Use `ai/GLMProvider.ts` via `AIProviderManager` instead.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `GLMMessage` | interface | Chat message shape |
| `GLMChatRequest` | interface | Request parameters |
| `GLMService` | class | GLM API wrapper |
| `glmService` | singleton | Pre-instantiated instance |

**Dependencies:** `openai` (npm), `config/env`  
**Tables:** None  
**Note:** Predates the `ai/` provider abstraction. Consider migrating callers to use `AIProviderManager` instead.

---

### healthMonitor.ts — 406 LOC

**Purpose:** Continuous system health monitoring (1-minute interval). Checks MySQL, Ollama, ingestion queue, and enterprise endpoints. Auto-creates support cases after 3 consecutive failures and auto-resolves when health restores.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `runHealthChecks()` | async function | Run all checks once |
| `startHealthMonitoring()` | function | Start continuous monitoring |
| `getHealthStatus()` | async function | Get current health summary |

**Dependencies:** `db/mysql`, `enterpriseEndpoints`, `ollama` (npm), `notificationService`  
**Tables:** `system_health_checks`, `cases`, `case_activity`, `users`, `user_roles`, `roles`

---

### ingestionAIRouter.ts — 99 LOC

**Purpose:** Tier-based AI routing for content cleaning during ingestion. Free tier uses local Ollama; paid tier uses OpenRouter. Falls back gracefully when OpenRouter key is missing.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `cleanContentWithAI(rawContent, tier)` | async function | Clean scraped content using appropriate AI |

**Dependencies:** `config/env`, `credentialVault`  
**Tables:** None  
**Vault Key:** `OPENROUTER` (with env-var fallback)

---

### ingestionWorker.ts — 404 LOC

**Purpose:** Background poll loop processing `ingestion_jobs` from MySQL. Paid jobs dequeued before free. Pipeline: fetch → clean → chunk → embed → store in MySQL + sqlite-vec → categorize → sync pages_indexed.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `startIngestionWorker()` | async function | Start poll loop (6s interval) |

**Dependencies:** `crypto`, `axios`, `cheerio`, `db/mysql`, `config/env`, `ingestionAIRouter`, `knowledgeCategorizer`, `vectorStore`  
**Tables:** `ingestion_jobs`, `assistant_knowledge`, `assistants`  
**Constants:** `POLL_INTERVAL_MS=6000`, `CHUNK_SIZE=1200`, `CHUNK_OVERLAP=200`, `MAX_CONTENT_CHARS=15000`, `MAX_RETRIES=3`

---

### ingestionWorkerProcess.ts — 32 LOC

**Purpose:** Standalone child process entry point. Spawned via `child_process.fork()` from `index.ts` to isolate ingestion memory (cheerio DOM + embeddings) from the Express server's heap.

**Exports:** None (entry point only)

**Dependencies:** `ingestionWorker`

---

### knowledgeCategorizer.ts — 366 LOC

**Purpose:** Dynamic knowledge checklist scoring. Uses Ollama to evaluate ingested content against an assistant's specific checklist (not hardcoded categories). Supports incremental OR-merge so satisfied items stay satisfied.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `ChecklistItem` | type (re-export) | Checklist item shape |
| `KnowledgeHealth` | interface | Health score + recommendations |
| `categorizeContent(content, checklist)` | async function | AI evaluation against checklist |
| `updateAssistantCategories(assistantId)` | async function | Full recategorization |
| `mergeChecklist(assistantId, newResults)` | async function | Incremental OR merge |
| `calculateHealthScore(checklist)` | function | Score computation (0–100) |
| `getAssistantKnowledgeHealth(assistantId)` | async function | Full health report for API |
| `getStoredChecklist(assistantId)` | async function | Read stored or default checklist |

**Dependencies:** `axios`, `config/env`, `db/mysql`, `config/personaTemplates`  
**Tables:** `assistants` (`knowledge_categories` JSON column), `assistant_knowledge`, `ingestion_jobs`

---

### leadCaptureService.ts — 302 LOC

**Purpose:** Detects buying intent in AI responses, stores captured leads, sends styled HTML email notifications to business owners, and provides lead statistics.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `parseLeadCapture(aiResponse)` | function | Extract lead JSON from AI text |
| `storeCapturedLead(clientId, leadData, chatContext?)` | async function | Store lead in DB |
| `sendLeadNotification(clientId, leadData, businessName?)` | async function | Email business owner |
| `getLeadStats(clientId, days?)` | async function | Lead statistics |
| `buildLeadCapturePrompt()` | function | LLM system prompt for lead detection |

**Dependencies:** `db/mysql`, `crypto`, `nodemailer`  
**Tables:** `widget_leads_captured`, `widget_clients`, `users`

---

### mobileAIProcessor.ts — 384 LOC

**Purpose:** Mobile AI assistant conversation workflow. Receives transcribed text, builds conversation history from MySQL, calls local Ollama with tool-augmented system prompt (via "prompt stitching"), and handles the iterative tool-call → tool-result loop until the LLM replies with plain text. Now supports per-assistant `core_instructions` (backend-only), `personality_flare` (user-editable), and context-aware history trimming.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `MobileIntentRequest` | interface | `{ text, conversationId?, assistantId?, language? }` |
| `MobileIntentResponse` | interface | `{ reply, conversationId, toolsUsed, data? }` |
| `processMobileIntent(req, userId, role)` | async function | Main pipeline: history → system prompt → Ollama → tool loop → reply |
| `resolveUserRole(userId)` | async function | Queries `user_roles` + `roles` to determine `'staff' \| 'client'` |

**Dependencies:** `config/env`, `db/mysql`, `actionRouter` (parseToolCall), `mobileTools`, `mobileActionExecutor`, `crypto`  
**Tables:** `mobile_conversations`, `mobile_messages`, `assistants`, `user_roles`, `roles`  
**Constants:** `MAX_TOOL_ROUNDS=5`, `MAX_HISTORY_MESSAGES=20`  
**Note:** Uses "prompt stitching" pattern — `core_instructions` (backend-enforced, hidden) + `personality_flare` (GUI-editable) + tool definitions (injected by role, never from DB).

---

### mobileActionExecutor.ts — 809 LOC

**Purpose:** Tool execution engine for the mobile AI assistant. Dispatches function calls emitted by the LLM, enforces ownership and role-based security, and returns human-readable results. Expanded with staff task proxy (external API via `staff_software_tokens`) and admin account management tools.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `MobileExecutionContext` | interface | `{ userId, role, assistantId? }` |
| `executeMobileAction(toolCall, ctx)` | async function | Main dispatcher (switch on tool name) |

**Client Tool Executors:** `list_my_assistants`, `toggle_assistant_status`, `get_usage_stats`, `list_failed_jobs`, `retry_failed_ingestion`  
**Staff Task Executors:** `list_tasks`, `create_task`, `update_task`, `add_task_comment` (proxy to external software API via `staff_software_tokens`)  
**Staff Admin Executors:** `search_clients`, `suspend_client_account`, `check_client_health`, `generate_enterprise_endpoint`

**Dependencies:** `db/mysql`, `knowledgeCategorizer`, `enterpriseEndpoints`, `actionRouter`  
**Tables:** `assistants`, `ingestion_jobs`, `users`, `user_roles`, `roles`, `team_members`, `subscriptions`, `subscription_plans`, `staff_software_tokens`  
**Security:** Client tools verify assistant ownership. Staff tools guarded by `requireStaff()`. Account suspension prevents targeting other staff members.

---

### mobileTools.ts — 420 LOC

**Purpose:** Defines the OpenAI-compatible function calling tool definitions available to the mobile AI assistant. Tools are separated by role (client vs staff) and injected dynamically based on JWT role — never stored in the DB. Expanded from 10 to 13 tools.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `MobileRole` | type | `'client' \| 'staff'` |
| `getToolsForRole(role)` | function | Returns permitted `ToolDefinition[]` |
| `getMobileToolsSystemPrompt(tools)` | function | Builds LLM system prompt describing available tools |

**Client Tools (5):** `list_my_assistants`, `toggle_assistant_status`, `get_usage_stats`, `list_failed_jobs`, `retry_failed_ingestion`  
**Staff Tools (8):** `list_tasks`, `create_task`, `update_task`, `add_task_comment`, `search_clients`, `suspend_client_account`, `check_client_health`, `generate_enterprise_endpoint`

**Dependencies:** `actionRouter` (ToolDefinition type)  
**Tables:** None (definitions only)

---

### notificationService.ts — 51 LOC

**Purpose:** Thin wrapper that maps fine-grained notification types (e.g., `case_created`, `case_assigned`) to the 4 DB enum values (`info`, `success`, `warning`, `error`) and delegates to `firebaseService.createNotificationWithPush`.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `createNotification(options)` | async function | Create notification + optional push |

**Dependencies:** `firebaseService`

---

### openRouterVision.ts — 130 LOC

**Purpose:** Vision analysis via OpenRouter with model fallback chain: `qwen/qwen-2.5-vl-7b-instruct` → `meta-llama/llama-3.2-11b-vision-instruct` → `openai/gpt-4o-mini`. Handles base64 image attachments.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `analyzeWithOpenRouter(params)` | async function | Vision analysis with auto-fallback |

**Dependencies:** `config/env`, `credentialVault`  
**Tables:** None  
**Note:** API key sourced from credential vault (`OPENROUTER`) with env-var fallback. Hardcoded key removed in 2025-07-15.

---

### payment.ts — 492 LOC

**Purpose:** Payment gateway integration for credit purchases. Supports PayFast (URL construction + MD5 signature verification) and Yoco (Checkout API with HMAC signature verification). Processes webhooks to add credits automatically. Credentials sourced from credential vault.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `PaymentRequest` | interface | Payment initiation shape |
| `PaymentResponse` | interface | Payment result |
| `createPayment(request)` | async function | Create payment intent |
| `processPaymentCallback(provider, payload, signature?)` | async function | Process webhook |
| `verifyYocoWebhookSignature(payload, signature)` | async function | HMAC verification |
| `verifyWebhookSignature(provider, payload, signature)` | async function | Provider-agnostic verification |

**Dependencies:** `db/mysql`, `credits` (dynamic import), `credentialVault`  
**Tables:** `credit_packages`, `teams`, `users`, `credit_transactions`  
**Vault Keys:** `PAYFAST`, `YOCO`

---

### payloadNormalizer.ts — 268 LOC

**Purpose:** Universal adapter layer that normalizes inbound messages from WhatsApp, Slack, SMS, email, and web/custom REST into a standard `NormalizedInbound` format, and formats AI responses back into provider-specific payloads.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `NormalizedInbound` | interface | Standardized inbound message |
| `FormattedOutbound` | interface | Provider-specific response |
| `normalizeInboundPayload(provider, payload)` | function | Provider → standard |
| `formatOutboundPayload(provider, text, action?, metadata?)` | function | Standard → provider |

**Dependencies:** None (pure functions)  
**Tables:** None

---

### siteBuilderService.ts — 579 LOC

**Purpose:** Full-lifecycle site management. Creates DB records, generates complete HTML/CSS with theme colors, handles FTP credential encryption/decryption, and manages widget embedding.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `GeneratedSite` | interface | Full site record (22 fields) |
| `SiteData` | interface | Creation/update payload |
| `siteBuilderService` | object literal | Full CRUD + generation |

**Key Methods:** `createSite`, `getSiteById`, `getSitesByUserId`, `updateSite`, `generateStaticFiles`, `buildHTML`, `buildCSS`, `adjustBrightness`, `deleteSite`, `getDecryptedFTPCredentials`

**Dependencies:** `crypto`, `db/mysql`, `cryptoUtils`, `fs/promises`, `path`  
**Tables:** `generated_sites`  
**Security:** FTP passwords encrypted with AES-256-GCM on write, decrypted in memory only during deployment.

---

### smsService.ts — 411 LOC

**Purpose:** SMSPortal REST API integration for bulk SMS. Reads credentials from the encrypted `credentials` table, supports dual credential layout (colon-delimited or split columns), caches OAuth tokens for 23 hours, auto-retries on 401, and logs all sends.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `sendSms(to, body)` | async function | Send single SMS |
| `sendBulkSms(recipients, body)` | async function | Send to multiple recipients |
| `getBalance()` | async function | Check prepaid balance |
| `normalisePhone(raw)` | function | Convert to MSISDN format |
| `invalidateToken()` | function | Force token re-fetch |

**Dependencies:** `axios`, `db/mysql`, `cryptoUtils`  
**Tables:** `credentials` (read), `sms_log` (auto-created, write)  
**External API:** `https://rest.smsportal.com/v2/`

---

### sshService.ts — 256 LOC

**Purpose:** SSH/SFTP file operations with connection pooling. Supports password and private key auth, file CRUD, directory operations, command execution, and connection testing.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `SSHConfig` | interface | Connection parameters |
| `FileInfo` | interface | File metadata |
| `SSHService` | class | Full SSH operations |
| `sshService` | singleton | Pre-instantiated instance |

**Key Methods:** `listDirectory`, `readFile`, `writeFile`, `deleteFile`, `createDirectory`, `moveFile`, `getFileInfo`, `executeCommand`, `disconnect`, `disconnectAll`, `testConnection`

**Dependencies:** `ssh2-sftp-client`, `ssh2`

---

### subscription.ts — 346 LOC

**Purpose:** Subscription plan management with 3 tiers (Personal, Team, Enterprise). Handles trial creation, plan changes, cancellation, invoice retrieval, and plan seeding.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `PlanFeatures` | interface | Feature set shape |
| `PlanInfo` | interface | Plan display info |
| `SubscriptionInfo` | interface | Active subscription state |
| `getPlans()` | async function | List active plans |
| `getPlanByTier(tier)` | async function | Get plan by tier |
| `getTeamSubscription(teamId)` | async function | Get team's subscription |
| `createTrialSubscription(teamId, tier?)` | async function | Start trial |
| `changePlan(teamId, tier, cycle?)` | async function | Upgrade/downgrade |
| `cancelSubscription(teamId)` | async function | Cancel at period end |
| `getInvoices(subscriptionId)` | async function | Get invoice list |
| `getAllSubscriptions(options?)` | async function | Admin: filtered list |
| `seedPlans()` | async function | Upsert default plans |

**Dependencies:** `db/mysql`  
**Tables:** `subscription_plans`, `subscriptions`, `billing_invoices`, `teams`, `users`

---

### vectorStore.ts — 262 LOC

**Purpose:** sqlite-vec powered vector storage for RAG retrieval. Provides KNN search using 768-dimensional `nomic-embed-text` embeddings. Stores chunks + vectors in separate tables with transactional batch operations.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `ChunkInput` | interface | Chunk + embedding input |
| `upsertChunks(chunks)` | function | Batch store chunks + vectors |
| `search(assistantId, embedding, topK?)` | function | KNN similarity search |
| `deleteByJob(jobId)` | function | Delete chunks by job |
| `deleteByAssistant(assistantId)` | function | Wipe all for assistant |
| `stats(assistantId)` | function | Chunk count + source breakdown |
| `close()` | function | Close SQLite connection |

**Dependencies:** `better-sqlite3`, `sqlite-vec`  
**Database:** `/var/opt/backend/data/vectors.db` (SQLite)  
**Tables:** `knowledge_chunks`, `knowledge_vectors` (virtual)

---

### widgetService.ts — 280 LOC

**Purpose:** Widget client lifecycle management. Handles client creation, message counting with limits, chat message logging, usage statistics, and admin listing.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `WidgetClient` | interface | Client record shape |
| `DocumentChunk` | interface | Chunk shape |
| `ChatMessage` | interface | Chat log entry |
| `widgetService` | object literal | Full CRUD + logging |

**Key Methods:** `createClient`, `getClientById`, `getClientByIdWithTier`, `getClientsByUserId`, `incrementMessageCount`, `hasReachedLimit`, `resetMessageCount`, `updateClient`, `getUsageStats`, `logChatMessage`, `getChatHistory`, `getAllClients`

**Dependencies:** `crypto`, `db/mysql`  
**Tables:** `widget_clients`, `chat_messages`, `generated_sites` (joined)

---

## AI Provider Subdirectory (`src/services/ai/`)

### AIProvider.ts — 27 LOC

**Purpose:** Abstract interface defining the contract all AI providers must implement.

**Exports:** `AIMessage`, `AIResponse`, `AIProvider`, `AIOptions` (all interfaces)

---

### AIProviderManager.ts — 54 LOC

**Purpose:** Provider registry and router. Registers GLM + Ollama at startup, allows runtime switching via `setProvider()`, defaults to `env.DEFAULT_AI_PROVIDER` or Ollama.

**Exports:**
| Export | Kind | Description |
|--------|------|-------------|
| `AIProviderManager` | class | Registry with get/set/list |
| `aiProviderManager` | singleton | Pre-instantiated instance |

**Dependencies:** `GLMProvider`, `OllamaProvider`, `config/env`

---

### GLMProvider.ts — 39 LOC

**Purpose:** ZhipuAI GLM implementation of `AIProvider`. Uses `GLM-4.5-Flash` model via OpenAI-compatible SDK pointed at `https://api.z.ai/api/paas/v4/`.

**Exports:** `GLMProvider` (class)  
**Dependencies:** `openai` (npm), `config/env`, `credentialVault`  
**Vault Key:** `GLM` (lazy client init on first use)

---

### OllamaProvider.ts — 58 LOC

**Purpose:** Local Ollama implementation of `AIProvider`. Calls `/api/chat` on the configured `OLLAMA_BASE_URL`. Checks availability via `/api/tags`.

**Exports:** `OllamaProvider` (class)  
**Dependencies:** `config/env`
