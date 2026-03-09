# Services — Route Consumption Map

> Which route files import which services, and the HTTP endpoints exposed.

---

## Service → Route Matrix

| Service | Consumed By Routes | Startup |
|---------|-------------------|---------|
| `actionRouter` | `assistants.ts` | — |
| `ai/AIProvider` | `ai.ts` | — |
| `ai/AIProviderManager` | `ai.ts` | — |
| `caseAnalyzer` | `cases.ts` | — |
| `codeAgent` | *(no direct route import found)* | — |
| `crawlerService` | `widgetIngest.ts` | — |
| `credentialVault` | *(internal — consumed by 10+ services directly)* | — |
| `credits` | `credits.ts` | — |
| `documentService` | `widgetIngest.ts` | — |
| `emailService` | `email.ts` | — |
| `embeddingService` | `widgetChat.ts` | — |
| `enterpriseEndpoints` | `adminEnterpriseEndpoints.ts`, `enterpriseWebhook.ts` | — |
| `firebaseService` | `fcmTokens.ts`, `notifications.ts`, `softawareTasks.ts` | — |
| `ftpDeploymentService` | `siteBuilder.ts` | — |
| `glmService` | `glm.ts` | — |
| `healthMonitor` | `adminCases.ts` | `app.ts` (startHealthMonitoring) |
| `ingestionAIRouter` | *(internal — called by ingestionWorker)* | — |
| `ingestionWorker` | *(no route)* | `index.ts` (fork via ingestionWorkerProcess) |
| `ingestionWorkerProcess` | *(standalone entry point)* | `index.ts` (child_process.fork) |
| `knowledgeCategorizer` | `assistants.ts` | — |
| `leadCaptureService` | `widgetChat.ts` | — |
| `mobileAIProcessor` | `mobileIntent.ts`, `myAssistant.ts` | — |
| `mobileActionExecutor` | *(internal — called by mobileAIProcessor)* | — |
| `mobileTools` | *(internal — called by mobileAIProcessor)* | — |
| `notificationService` | `adminCases.ts`, `cases.ts` | — |
| `openRouterVision` | `ai.ts` | — |
| `payment` | `credits.ts` | — |
| `payloadNormalizer` | `enterpriseWebhook.ts` | — |
| `siteBuilderService` | `siteBuilder.ts` | — |
| `smsService` | `sms.ts`, `twoFactor.ts` | — |
| `sshService` | `files.ts` | — |
| `subscription` | `subscription.ts` | — |
| `vectorStore` | `assistantIngest.ts`, `assistants.ts` | — |
| `widgetService` | `widgetChat.ts`, `widgetIngest.ts` | — |

---

## Route File Details

### routes/ai.ts
**Auth:** `requireAuth`  
**Services:** `aiProviderManager`, `AIMessage`, `analyzeWithOpenRouter`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/ai/chat` | `aiProviderManager.getProvider().chat()` |
| POST | `/api/ai/vision` | `analyzeWithOpenRouter()` |
| GET | `/api/ai/providers` | `aiProviderManager.listAvailableProviders()` |

---

### routes/assistants.ts
**Auth:** `requireAuth`  
**Services:** `knowledgeCategorizer`, `actionRouter`, `vectorStore`

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/assistants/:id/knowledge-health` | `getAssistantKnowledgeHealth()` |
| POST | `/api/assistants/:id/recategorize` | `updateAssistantCategories()` |
| DELETE | `/api/assistants/:id` | `deleteVecByAssistant()` |
| POST | `/api/assistants/:id/chat` | `vectorSearch()`, `getToolsForTier()`, `parseToolCall()`, `executeToolCall()` |

---

### routes/assistantIngest.ts
**Auth:** `requireAuth`  
**Services:** `vectorStore`

| Method | Path | Service Call |
|--------|------|-------------|
| DELETE | `/api/assistants/:id/knowledge/:jobId` | `deleteVecByJob()` |

---

### routes/adminCases.ts
**Auth:** `requireAdmin`  
**Services:** `healthMonitor`, `notificationService`

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/admin/health` | `getHealthStatus()` |
| POST | `/api/admin/health/run` | `runHealthChecks()` |
| POST | `/api/admin/cases` | `createNotification()` (on creation) |

---

### routes/adminEnterpriseEndpoints.ts
**Auth:** `requireAdmin`  
**Services:** `enterpriseEndpoints` (all CRUD functions)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/admin/enterprise-endpoints` | `getAllEndpoints()` |
| POST | `/api/admin/enterprise-endpoints` | `createEndpoint()` |
| PUT | `/api/admin/enterprise-endpoints/:id` | `updateEndpoint()` |
| PATCH | `/api/admin/enterprise-endpoints/:id/status` | `setEndpointStatus()` |
| DELETE | `/api/admin/enterprise-endpoints/:id` | `deleteEndpoint()` |
| GET | `/api/admin/enterprise-endpoints/:id/logs` | `getRequestLogs()` |

---

### routes/cases.ts
**Auth:** `requireAuth`  
**Services:** `caseAnalyzer`, `notificationService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/cases` | `analyzeComponentFromContext()`, `createNotification()` |

---

### routes/credits.ts
**Auth:** `requireAuth`  
**Services:** `credits`, `payment`

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/credits/balance` | `getTeamCreditBalance()` |
| GET | `/api/credits/transactions` | `getTransactionHistory()` |
| GET | `/api/credits/usage` | `getUsageStatistics()` |
| GET | `/api/credits/packages` | `getCreditPackages()` |
| POST | `/api/credits/purchase` | `createPayment()` |

---

### routes/enterpriseWebhook.ts
**Auth:** Endpoint-specific (inbound auth)  
**Services:** `enterpriseEndpoints`, `payloadNormalizer`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/v1/webhook/:endpointId` | `getEndpoint()`, `normalizeInboundPayload()`, `formatOutboundPayload()`, `logRequest()` |

---

### routes/fcmTokens.ts
**Auth:** `requireAuth`  
**Services:** `firebaseService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/fcm/register` | `registerFcmToken()` |
| DELETE | `/api/fcm/unregister` | `unregisterFcmToken()` |
| GET | `/api/fcm/devices` | `listFcmTokens()` |

---

### routes/files.ts
**Auth:** `requireAuth`  
**Services:** `sshService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/files/connect` | `sshService.testConnection()` |
| GET | `/api/files/list` | `sshService.listDirectory()` |
| GET | `/api/files/read` | `sshService.readFile()` |
| POST | `/api/files/write` | `sshService.writeFile()` |
| DELETE | `/api/files/delete` | `sshService.deleteFile()` |

---

### routes/glm.ts
**Auth:** `requireAuth`  
**Services:** `glmService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/glm/chat` | `glmService.chat()` |

---

### routes/notifications.ts
**Auth:** `requireAuth`  
**Services:** `firebaseService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/notifications/push` | `sendPushToUser()` |

---

### routes/siteBuilder.ts
**Auth:** `requireAuth`  
**Services:** `siteBuilderService`, `ftpDeploymentService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/sites` | `siteBuilderService.createSite()` |
| GET | `/api/sites` | `siteBuilderService.getSitesByUserId()` |
| GET | `/api/sites/:id` | `siteBuilderService.getSiteById()` |
| PUT | `/api/sites/:id` | `siteBuilderService.updateSite()` |
| POST | `/api/sites/:id/generate` | `siteBuilderService.generateStaticFiles()` |
| POST | `/api/sites/:id/deploy` | `ftpDeploymentService.deploySite()` |
| GET | `/api/sites/:id/deployments` | `ftpDeploymentService.getDeploymentHistory()` |
| DELETE | `/api/sites/:id` | `siteBuilderService.deleteSite()` |

---

### routes/subscription.ts
**Auth:** `requireAuth`  
**Services:** `subscription` (namespace import `* as subscriptionService`)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/subscription/plans` | `getPlans()` |
| GET | `/api/subscription/current` | `getTeamSubscription()` |
| POST | `/api/subscription/start-trial` | `createTrialSubscription()` |
| POST | `/api/subscription/change-plan` | `changePlan()` |
| POST | `/api/subscription/cancel` | `cancelSubscription()` |
| GET | `/api/subscription/invoices` | `getInvoices()` |

---

### routes/widgetChat.ts
**Auth:** None (public widget endpoint)  
**Services:** `widgetService`, `embeddingService`, `leadCaptureService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/widget/chat` | `widgetService.getClientById()`, `generateEmbedding()`, `embeddingService.searchSimilar()`, `parseLeadCapture()`, `storeCapturedLead()`, `sendLeadNotification()`, `widgetService.logChatMessage()` |

---

### routes/widgetIngest.ts
**Auth:** `requireAuth`  
**Services:** `documentService`, `crawlerService`, `widgetService`

| Method | Path | Service Call |
|--------|------|-------------|
| POST | `/api/widget/ingest/url` | `crawlerService.enqueueCrawl()` |
| POST | `/api/widget/ingest/file` | `documentService.storeFileContent()` |
| GET | `/api/widget/ingest/sources` | `documentService.getDocumentSources()` |
| DELETE | `/api/widget/ingest/source` | `documentService.deleteDocumentsBySource()` |

---

### routes/softawareTasks.ts
**Auth:** `requireAuth`  
**Services:** `firebaseService`

| Method | Path | Service Call |
|--------|------|-------------|
| *(various task endpoints)* | *(task CRUD)* | `createNotificationWithPush()` |

---
### routes/sms.ts
**Auth:** `requireAuth` + `requireAdmin`  
**Services:** `smsService`

| Method | Path | Service Call |
|--------|------|--------------|
| POST | `/api/sms/send` | `sendSms()` |
| POST | `/api/sms/send-bulk` | `sendBulkSms()` |
| GET | `/api/sms/balance` | `getBalance()` |
| GET | `/api/sms/normalise/:phone` | `normalisePhone()` |

**Validation:** Zod schemas for send (`to`, `message`, `testMode`, `campaignName`, `scheduledDelivery`) and bulk send (array of `destination`/`content`, max 500).

---

### routes/email.ts
**Auth:** `requireAuth` (send), `requireAdmin` (test, config, logs)  
**Services:** `emailService`, `credentialVault` (indirect via emailService)

| Method | Path | Service Call |
|--------|------|--------------|
| POST | `/api/email/test` | `sendTestEmail()` |
| POST | `/api/email/send` | `sendEmail()` |
| GET | `/api/email/config` | DB query (password masked) |
| PUT | `/api/email/config` | DB upsert + `invalidateTransporter()` |
| GET | `/api/email/logs` | Paginated email_log query |

**Validation:** Zod schemas for test email, send email, and config update.

---

### routes/mobileIntent.ts
**Auth:** `requireAuth`  
**Mount:** `/api/v1/mobile`  
**Services:** `mobileAIProcessor` (`processMobileIntent`, `resolveUserRole`)

| Method | Path | Service Call |
|--------|------|--------------|
| POST | `/api/v1/mobile/intent` | `resolveUserRole()`, `processMobileIntent()` |
| GET | `/api/v1/mobile/assistants` | DB query (active assistants for user) |
| GET | `/api/v1/mobile/conversations` | DB query (user's conversations, latest 50) |
| GET | `/api/v1/mobile/conversations/:id/messages` | DB query (verified ownership) |
| DELETE | `/api/v1/mobile/conversations/:id` | DB delete (messages + conversation) |

**Validation:** Text max 2000 chars. Verifies account is active and assistant ownership.

---

### routes/staffAssistant.ts *(Deprecated — replaced by myAssistant.ts)*
**Auth:** `requireAuth` + staff role check  
**Mount:** `/api/v1/mobile/staff-assistant`  
**Services:** `mobileAIProcessor` (`resolveUserRole`)

> ⚠️ **Deprecated.** The unified `routes/myAssistant.ts` handles both staff and client roles. This file may be removed in a future release.

| Method | Path | Service Call |
|--------|------|--------------|
| GET | `/api/v1/mobile/staff-assistant/` | Get staff member's assistant (max 1) |
| POST | `/api/v1/mobile/staff-assistant/` | Create staff assistant (`is_staff_agent=1`) |
| PUT | `/api/v1/mobile/staff-assistant/` | Update staff assistant (personality, name, etc.) |
| DELETE | `/api/v1/mobile/staff-assistant/` | Delete staff assistant |
| POST | `/api/v1/mobile/staff-assistant/core-instructions` | Super-admin only: set core_instructions |
| GET | `/api/v1/mobile/staff-assistant/software-tokens` | List stored software tokens |
| POST | `/api/v1/mobile/staff-assistant/software-tokens` | Store or update a software token |
| DELETE | `/api/v1/mobile/staff-assistant/software-tokens/:id` | Remove a software token |

**Note:** `core_instructions` are hidden from the GUI — only super admins can set them. Staff edit `personality_flare` (the fun stuff). This enforces the "prompt stitching" guardrail.

---

### routes/teamChat.ts
**Auth:** `requireAuth` + membership checks  
**Mount:** `/api/team-chats`  
**Services:** None (direct DB operations)

| Method | Path | Service Call |
|--------|------|--------------|
| GET | `/api/team-chats/users/available` | DB query (all active users) |
| GET | `/api/team-chats/` | List user's teams (with last_message, member_count) |
| POST | `/api/team-chats/` | Create team (creator = admin) |
| GET | `/api/team-chats/:id` | Get team details + members |
| PUT | `/api/team-chats/:id` | Update team (admin only) |
| DELETE | `/api/team-chats/:id` | Delete team + cascade (admin only) |
| POST | `/api/team-chats/:id/members` | Add members (admin only) |
| DELETE | `/api/team-chats/:id/members/:userId` | Remove member (admin or self) |
| GET | `/api/team-chats/:id/messages` | List messages (paginated, cursor-based) |
| POST | `/api/team-chats/:id/messages` | Send message (text, image, video, audio, file) |
| DELETE | `/api/team-chats/:id/messages/:msgId` | Delete message (sender or admin) |
| POST | `/api/team-chats/:id/upload` | Upload file (base64 → disk) |

**Validation:** Zod schemas for team creation, message sending, member management.  
**Tables:** `team_chats`, `team_chat_members`, `team_chat_messages`  
**File storage:** `/uploads/team-chats/<teamId>/`

---

### routes/settings.ts
**Auth:** `requireAuth` + `requireAdmin` (except `/public`)  
**Mount:** `/api/settings`  
**Services:** None (direct DB operations on `sys_settings`)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/settings/public` | No auth — returns all `is_public=1` settings as key→value map |
| GET | `/api/settings/key/:key` | Get setting by key name |
| GET | `/api/settings` | List all settings |
| GET | `/api/settings/:id` | Get setting by ID |
| POST | `/api/settings` | Create setting |
| PUT | `/api/settings/:id` | Update setting |
| DELETE | `/api/settings/:id` | Delete setting |

---

### routes/systemUsers.ts
**Auth:** `requireAuth` + `requireAdmin`  
**Mount:** `/api/users`  
**Services:** None (direct DB operations)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/users` | List all users with roles |
| GET | `/api/users/:id` | Get user + roles |
| POST | `/api/users` | Create user (bcrypt 12 rounds) |
| PUT | `/api/users/:id` | Update user + re-hash password |
| DELETE | `/api/users/:id` | Delete user (cascades 14 FK tables) |

---

### routes/systemRoles.ts
**Auth:** `requireAuth` + `requireAdmin`  
**Mount:** `/api/roles`  
**Services:** None (direct DB operations)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/roles` | List roles with `permission_count` |
| GET | `/api/roles/:id` | Get role with permissions array |
| POST | `/api/roles` | Create role |
| PUT | `/api/roles/:id` | Update role |
| DELETE | `/api/roles/:id` | Delete role (cascades) |
| POST | `/api/roles/:id/assign` | Assign role to user |
| POST | `/api/roles/:id/remove` | Remove role from user |

---

### routes/systemPermissions.ts
**Auth:** `requireAuth` + `requireAdmin`  
**Mount:** `/api/permissions`  
**Services:** None (direct DB operations)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/permissions` | List all permissions |
| GET | `/api/permissions/user` | Current user's permissions (admin = `["*"]`) |
| GET | `/api/permissions/:id` | Get permission by ID |
| POST | `/api/permissions` | Create permission |
| PUT | `/api/permissions/:id` | Update permission |
| DELETE | `/api/permissions/:id` | Delete permission (cascades) |
| POST | `/api/permissions/:id/assign` | Assign to role |
| POST | `/api/permissions/:id/remove` | Remove from role |

---

### routes/systemCredentials.ts
**Auth:** `requireAuth` + `requireAdmin`  
**Mount:** `/api/credentials`  
**Services:** `credentialVault` (`invalidateCache`)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/credentials` | List (values masked; `?decrypt=true` to reveal) |
| GET | `/api/credentials/search` | Search by `?q=term` |
| GET | `/api/credentials/service/:name` | Get by service name |
| GET | `/api/credentials/expired` | List expired |
| GET | `/api/credentials/expiring` | List expiring in 30 days |
| GET | `/api/credentials/:id` | Get by ID (updates `last_used_at`) |
| POST | `/api/credentials` | Create (AES-256-GCM encrypt) |
| PUT | `/api/credentials/:id` | Update (re-encrypt + `invalidateCache`) |
| DELETE | `/api/credentials/:id` | Delete + `invalidateCache` |
| POST | `/api/credentials/:id/deactivate` | Soft deactivate |
| POST | `/api/credentials/:id/rotate` | Rotate value |
| POST | `/api/credentials/:id/test` | Test validity |

---

### routes/twoFactor.ts
**Auth:** Mixed — `requireAuth` for setup/disable, `temp_token` for login verification  
**Mount:** `/api/auth/2fa`  
**Services:** `emailService` (`sendTwoFactorOtp`), `smsService` (`sendSms`)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/auth/2fa/status` | Check 2FA status (requireAuth) |
| POST | `/api/auth/2fa/setup` | Start setup — TOTP→QR, email/SMS→sends OTP |
| POST | `/api/auth/2fa/setup/verify` | Confirm setup → enable + return backup codes |
| POST | `/api/auth/2fa/verify` | Verify during login (temp_token) |
| POST | `/api/auth/2fa/resend` | Resend OTP (temp_token) |
| POST | `/api/auth/2fa/disable` | Disable 2FA (blocked for staff/admin) |
| PUT | `/api/auth/2fa/method` | Change method (password + re-verify) |
| POST | `/api/auth/2fa/backup-codes` | Regenerate backup codes |

---

### routes/myAssistant.ts
**Auth:** `requireAuth` (no admin requirement — role logic is internal)  
**Mount:** `/api/v1/mobile/my-assistant`  
**Services:** None (direct DB operations on `assistants`, `staff_software_tokens`)

| Method | Path | Service Call |
|--------|------|-------------|
| GET | `/api/v1/mobile/my-assistant` | List user's assistants |
| GET | `/api/v1/mobile/my-assistant/:id` | Get assistant (owner-verified) |
| POST | `/api/v1/mobile/my-assistant` | Create assistant (staff: max 1) |
| PUT | `/api/v1/mobile/my-assistant/:id` | Update (core_instructions ignored) |
| PUT | `/api/v1/mobile/my-assistant/:id/set-primary` | Set as primary |
| DELETE | `/api/v1/mobile/my-assistant/:id` | Delete (auto-promotes next) |
| POST | `/api/v1/mobile/my-assistant/core-instructions` | Super-admin only |
| GET | `/api/v1/mobile/my-assistant/software-tokens` | Staff only: list tokens |
| POST | `/api/v1/mobile/my-assistant/software-tokens` | Staff only: upsert token |
| DELETE | `/api/v1/mobile/my-assistant/software-tokens/:id` | Staff only: delete token |

---

## Unrouted Services

These services have **no direct route import** — they are consumed internally:

| Service | Consumed By |
|---------|-------------|
| `credentialVault` | openRouterVision, ingestionAIRouter, firebaseService, payment, leadCaptureService, actionRouter, GLMProvider, glmService, emailService, smsService, systemCredentials route |
| `ingestionWorker` | `ingestionWorkerProcess` → forked from `index.ts` |
| `ingestionWorkerProcess` | `index.ts` (child_process.fork) |
| `ingestionAIRouter` | `ingestionWorker` |
| `mobileActionExecutor` | `mobileAIProcessor` |
| `mobileTools` | `mobileAIProcessor` |
| `codeAgent` | No known consumer (possibly unused or called from code routes not importing via services path) |

---

## Startup-Time Registrations

| Location | Service | Registration |
|----------|---------|-------------|
| `app.ts` | `healthMonitor` | `startHealthMonitoring()` — 1-minute interval |
| `index.ts` | `ingestionWorkerProcess` | `child_process.fork()` — isolated heap |
| Module load | `firebaseService` | `initFirebase()` — async init from vault (with env fallback) |
| Module load | `aiProviderManager` | Registers GLM + Ollama providers |
| Module load | `enterpriseEndpoints` | Creates SQLite schema on first `getDb()` |
| Module load | `vectorStore` | Creates SQLite schema on first `getDb()` |
