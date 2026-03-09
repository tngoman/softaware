# Services — Database Tables & Key Interfaces

> Every MySQL table, SQLite table, and TypeScript interface used by the services layer.

---

## MySQL Tables (database: `softaware`)

### Billing & Credits

#### `credit_balances`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | `generateId()` |
| `teamId` | VARCHAR FK | → `teams.id` |
| `balance` | INT | Current balance in ZAR cents |
| `totalPurchased` | INT | Lifetime purchased cents |
| `totalUsed` | INT | Lifetime used cents |
| `lowBalanceThreshold` | INT | Warning threshold (cents) |
| `lowBalanceAlertSent` | BOOLEAN | Auto-resets when balance drops below warning |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

**Used by:** `credits.ts`

#### `credit_transactions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | `generateId()` |
| `creditBalanceId` | VARCHAR FK | → `credit_balances.id` |
| `type` | ENUM | `BONUS \| USAGE \| PURCHASE \| REFUND \| ADJUSTMENT` |
| `amount` | INT | Positive = add, negative = deduct |
| `requestType` | VARCHAR | AI request type (for USAGE) |
| `requestMetadata` | JSON | Tokens, complexity, etc. |
| `description` | VARCHAR | Human-readable |
| `paymentProvider` | VARCHAR | `PAYFAST \| YOCO \| MANUAL` |
| `externalPaymentId` | VARCHAR | Gateway reference (idempotency key) |
| `balanceAfter` | INT | Snapshot after transaction |
| `createdAt` | DATETIME | |

**Used by:** `credits.ts`, `payment.ts`

#### `credit_packages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | e.g., `starter`, `standard` |
| `name` | VARCHAR | Display name |
| `description` | VARCHAR | |
| `credits` | INT | Base credits (cents) |
| `price` | INT | Price in ZAR cents |
| `bonusCredits` | INT | Extra credits included |
| `isActive` | BOOLEAN | |
| `featured` | BOOLEAN | Highlight in UI |
| `displayOrder` | INT | Sort order |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

**Used by:** `credits.ts`, `payment.ts`

#### `subscription_plans`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | `generateId()` |
| `tier` | ENUM | `PERSONAL \| TEAM \| ENTERPRISE` |
| `name` | VARCHAR | |
| `description` | VARCHAR | |
| `priceMonthly` | INT | ZAR cents |
| `priceAnnually` | INT | ZAR cents |
| `maxUsers` | INT | |
| `maxAgents` | INT | nullable = unlimited |
| `maxDevices` | INT | |
| `cloudSyncAllowed` | BOOLEAN | |
| `vaultAllowed` | BOOLEAN | |
| `prioritySupport` | BOOLEAN | |
| `trialDays` | INT | |
| `isActive` | BOOLEAN | |
| `displayOrder` | INT | |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

**Used by:** `subscription.ts`

#### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | |
| `teamId` | VARCHAR FK | → `teams.id` |
| `planId` | VARCHAR FK | → `subscription_plans.id` |
| `status` | ENUM | `TRIAL \| ACTIVE \| PAST_DUE \| CANCELLED \| EXPIRED` |
| `billingCycle` | VARCHAR | `monthly \| annually` |
| `trialEndsAt` | DATETIME | nullable |
| `currentPeriodStart` | DATETIME | |
| `currentPeriodEnd` | DATETIME | |
| `cancelledAt` | DATETIME | nullable |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

**Used by:** `subscription.ts`

#### `billing_invoices`
| Column | Type | Notes |
|--------|------|-------|
| `subscriptionId` | VARCHAR FK | → `subscriptions.id` |
| …other columns | — | Shape inferred from `Invoice` type |

**Used by:** `subscription.ts`

---

### Widget & Chat

#### `widget_clients`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `user_id` | VARCHAR FK | nullable → `users.id` |
| `website_url` | VARCHAR | |
| `message_count` | INT | Current period messages |
| `max_messages` | INT | Limit per period |
| `max_pages` | INT | Max ingested pages |
| `pages_ingested` | INT | Current page count |
| `widget_color` | VARCHAR | Hex color |
| `lead_notification_email` | VARCHAR | For lead capture notifications |
| `status` | ENUM | `active \| suspended \| upgraded` |
| `created_at` | DATETIME | |
| `last_active` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `widgetService.ts`, `documentService.ts`, `crawlerService.ts`, `leadCaptureService.ts`

#### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `client_id` | VARCHAR FK | → `widget_clients.id` |
| `session_id` | VARCHAR | nullable |
| `role` | ENUM | `user \| assistant` |
| `content` | TEXT | Message body |
| `model` | VARCHAR | LLM model used |
| `tokens_used` | INT | |
| `response_time_ms` | INT | |
| `created_at` | DATETIME | |

**Used by:** `widgetService.ts`

#### `widget_leads_captured`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `client_id` | VARCHAR FK | |
| `visitor_email` | VARCHAR | |
| `visitor_name` | VARCHAR | nullable |
| `visitor_message` | VARCHAR | nullable |
| `chat_context` | TEXT | nullable |
| `notification_sent` | BOOLEAN | |
| `captured_at` | DATETIME | auto |

**Used by:** `leadCaptureService.ts`

#### `widget_usage_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID() |
| `assistant_id` | VARCHAR | |
| `action` | VARCHAR | e.g., `webhook:book_appointment` |
| `data` | JSON | |
| `response_code` | INT | |
| `created_at` | DATETIME | |

**Used by:** `actionRouter.ts`

#### `lead_captures`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | |
| `sessionId` | VARCHAR | |
| `sourcePage` | VARCHAR | assistant ID |
| `companyName` | VARCHAR | nullable |
| `contactName` | VARCHAR | nullable |
| `email` | VARCHAR | nullable |
| `phone` | VARCHAR | nullable |
| `useCase` | TEXT | Interest / inquiry |
| `requirements` | TEXT | Urgency or preferred time |
| `status` | ENUM | `NEW \| CALLBACK` |
| `score` | INT | |
| `messageCount` | INT | |
| `createdAt` | DATETIME | |
| `updatedAt` | DATETIME | |

**Used by:** `actionRouter.ts`

---

### Knowledge & Ingestion

#### `document_metadata`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `client_id` | VARCHAR FK | → `widget_clients.id` |
| `content` | TEXT | Chunk text |
| `source_url` | VARCHAR | nullable |
| `source_type` | ENUM | `website \| pdf \| txt \| doc` |
| `chunk_index` | INT | Position in source |
| `char_count` | INT | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `documentService.ts`, `embeddingService.ts`

#### `document_embeddings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `document_id` | VARCHAR FK | → `document_metadata.id` |
| `embedding` | JSON | Serialized float array |
| `embedding_model` | VARCHAR | e.g., `nomic-embed-text` |
| `created_at` | DATETIME | |

**Used by:** `embeddingService.ts`

#### `crawl_queue`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `client_id` | VARCHAR FK | |
| `url` | VARCHAR | |
| `status` | ENUM | `pending \| processing \| completed \| failed` |
| `error_message` | TEXT | nullable |
| `retries` | INT | Max 3 |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `crawlerService.ts`

#### `ingestion_jobs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | |
| `assistant_id` | VARCHAR FK | → `assistants.id` |
| `job_type` | ENUM | `url \| file` |
| `source` | VARCHAR | URL or filename |
| `file_content` | TEXT | nullable, cleared after processing |
| `tier` | ENUM | `free \| paid` |
| `status` | ENUM | `pending \| processing \| completed \| failed` |
| `retry_count` | INT | |
| `chunks_created` | INT | |
| `error_message` | TEXT | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `ingestionWorker.ts`

#### `assistant_knowledge`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `assistant_id` | VARCHAR FK | |
| `job_id` | VARCHAR FK | → `ingestion_jobs.id` |
| `content` | TEXT | Chunk text |
| `source` | VARCHAR | URL or filename |
| `source_type` | ENUM | `url \| file` |
| `chunk_index` | INT | |
| `char_count` | INT | |
| `embedding` | JSON | Serialized vector (nullable) |
| `created_at` | DATETIME | |

**Used by:** `ingestionWorker.ts`, `knowledgeCategorizer.ts`

#### `assistants`
| Column | Type | Notes |
|--------|------|-------|
| `knowledge_categories` | JSON | `{ checklist: ChecklistItem[] }` |
| `business_type` | VARCHAR | Used for default checklist template |
| `pages_indexed` | INT | Synced from completed job count |
| `tier` | ENUM | `free \| paid` |
| …other columns | — | |

**Used by:** `knowledgeCategorizer.ts`, `ingestionWorker.ts`

---

### Site Builder

#### `generated_sites`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `user_id` | VARCHAR FK | |
| `widget_client_id` | VARCHAR FK | nullable |
| `business_name` | VARCHAR | |
| `tagline` | VARCHAR | nullable |
| `logo_url` | VARCHAR | nullable |
| `hero_image_url` | VARCHAR | nullable |
| `about_us` | TEXT | nullable |
| `services` | TEXT | nullable |
| `contact_email` | VARCHAR | nullable |
| `contact_phone` | VARCHAR | nullable |
| `ftp_server` | VARCHAR | nullable |
| `ftp_username` | VARCHAR | nullable |
| `ftp_password` | VARCHAR | **AES-256-GCM encrypted** |
| `ftp_port` | INT | Default 21 |
| `ftp_protocol` | ENUM | `ftp \| sftp` |
| `ftp_directory` | VARCHAR | Default `/public_html` |
| `status` | ENUM | `draft \| generated \| deployed \| failed` |
| `last_deployed_at` | DATETIME | nullable |
| `deployment_error` | TEXT | nullable |
| `theme_color` | VARCHAR | Hex color, default `#0044cc` |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `siteBuilderService.ts`, `ftpDeploymentService.ts`, `widgetService.ts`

#### `site_deployments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `site_id` | VARCHAR FK | → `generated_sites.id` |
| `status` | ENUM | `pending \| uploading \| success \| failed` |
| `files_uploaded` | INT | |
| `total_files` | INT | |
| `deployment_duration_ms` | INT | |
| `error_message` | TEXT | nullable |
| `deployed_at` | DATETIME | |

**Used by:** `ftpDeploymentService.ts`

---

### SMS & Email

#### `credentials` (full schema)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `service_name` | VARCHAR | e.g., `SMTP`, `OPENROUTER`, `GLM`, `FIREBASE` |
| `credential_type` | VARCHAR | e.g., `api_key`, `password`, `oauth` |
| `identifier` | VARCHAR | Username / client ID |
| `credential_value` | TEXT | **AES-256-GCM encrypted** primary secret |
| `additional_data` | TEXT | JSON with supplementary fields (each value encrypted) |
| `environment` | VARCHAR | `production`, `staging`, etc. |
| `expires_at` | DATETIME | nullable |
| `is_active` | BOOLEAN | Default 1 |
| `notes` | TEXT | nullable |
| `created_by` | VARCHAR FK | nullable → `users.id` |
| `updated_by` | VARCHAR FK | nullable → `users.id` |
| `last_used_at` | DATETIME | nullable — updated by services on use |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `credentialVault.ts` (read), `emailService.ts` (read), `smsService.ts` (read), `systemCredentials.ts` route (CRUD)

#### `sms_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `recipient` | VARCHAR(20) | MSISDN |
| `body` | TEXT | |
| `cost` | DECIMAL(8,4) | |
| `event_id` | VARCHAR(64) | SMSPortal reference |
| `status` | VARCHAR(20) | `accepted`, `failed`, etc. |
| `sent_at` | DATETIME | |

**Used by:** `smsService.ts` (auto-created if missing)

#### `email_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `to_address` | VARCHAR(500) | Recipient(s) |
| `subject` | VARCHAR(500) | nullable |
| `status` | VARCHAR(50) | `sent`, `failed` |
| `message_id` | VARCHAR(200) | SMTP message ID |
| `error` | TEXT | nullable — error message on failure |
| `created_at` | TIMESTAMP | |

**Used by:** `emailService.ts` (auto-created if missing)

---

### Mobile AI Assistant

#### `mobile_conversations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `user_id` | VARCHAR FK | → `users.id` |
| `assistant_id` | VARCHAR FK | nullable → `assistants.id` |
| `role` | VARCHAR | `staff` or `client` |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `mobileAIProcessor.ts`

#### `mobile_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `conversation_id` | VARCHAR FK | → `mobile_conversations.id` |
| `role` | ENUM | `user \| assistant \| system \| tool` |
| `content` | TEXT | Message body |
| `tool_name` | VARCHAR | nullable — tool name if role is `tool` |
| `created_at` | DATETIME | |

**Used by:** `mobileAIProcessor.ts`

#### `staff_software_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | UUID |
| `user_id` | VARCHAR FK | → `users.id` |
| `software_id` | INT | External software ID |
| `software_name` | VARCHAR | nullable — display name |
| `api_url` | VARCHAR | External API base URL |
| `token` | TEXT | Bearer token for external API |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `mobileActionExecutor.ts` (task proxy), `staffAssistant.ts` route (CRUD)

---

### Team Chat

#### `team_chats`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `name` | VARCHAR(100) | Team/group name |
| `description` | VARCHAR(500) | nullable |
| `created_by` | VARCHAR FK | → `users.id` |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | nullable |

**Used by:** `teamChat.ts` route

#### `team_chat_members`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `team_id` | INT FK | → `team_chats.id` |
| `user_id` | VARCHAR FK | → `users.id` |
| `role` | VARCHAR | `admin` or `member` |
| `joined_at` | DATETIME | |
| `removed_at` | DATETIME | nullable — soft delete |

**Used by:** `teamChat.ts` route

#### `team_chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `team_id` | INT FK | → `team_chats.id` |
| `user_id` | VARCHAR FK | → `users.id` (sender) |
| `content` | TEXT | Message body |
| `message_type` | ENUM | `text \| image \| video \| audio \| file` |
| `file_url` | VARCHAR | nullable |
| `file_name` | VARCHAR | nullable |
| `file_type` | VARCHAR | nullable |
| `file_size` | INT | nullable |
| `reply_to_id` | INT FK | nullable → self (threaded replies) |
| `created_at` | DATETIME | |

**Used by:** `teamChat.ts` route

---

### FCM & Notifications

#### `fcm_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `user_id` | VARCHAR FK | → `users.id` |
| `token` | VARCHAR | FCM device token (UNIQUE) |
| `device_name` | VARCHAR | nullable |
| `platform` | VARCHAR | nullable |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `firebaseService.ts`

#### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | VARCHAR FK | |
| `title` | VARCHAR | |
| `message` | TEXT | |
| `type` | ENUM | `info \| success \| warning \| error` |
| `data` | JSON | nullable |
| `created_at` | DATETIME | |

**Used by:** `firebaseService.ts`

---

### Health Monitoring & Cases

#### `system_health_checks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | `generateId()` |
| `check_type` | VARCHAR | `database`, `service`, `ingestion`, `enterprise` |
| `check_name` | VARCHAR | e.g., `MySQL Connection`, `Ollama Service` |
| `status` | ENUM | `healthy \| warning \| error \| unknown` |
| `response_time_ms` | INT | nullable |
| `error_message` | TEXT | nullable |
| `details` | JSON | Check-specific metadata |
| `last_check` | DATETIME | |
| `last_success` | DATETIME | nullable |
| `last_failure` | DATETIME | nullable |
| `consecutive_failures` | INT | Resets to 0 on healthy |
| `case_id` | VARCHAR FK | nullable → `cases.id` |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `healthMonitor.ts`

#### `cases`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | |
| `case_number` | VARCHAR | e.g., `AUTO-12345678` |
| `title` | VARCHAR | |
| `description` | TEXT | |
| `severity` | ENUM | `high \| medium \| low` |
| `status` | ENUM | `open \| resolved \| …` |
| `type` | VARCHAR | e.g., `auto_detected` |
| `component_name` | VARCHAR | |
| `metadata` | JSON | |
| `resolution` | TEXT | nullable |
| `resolved_at` | DATETIME | nullable |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `healthMonitor.ts`

#### `case_activity`
| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR PK | |
| `case_id` | VARCHAR FK | → `cases.id` |
| `action` | VARCHAR | e.g., `auto_created` |
| `new_value` | TEXT | |
| `created_at` | DATETIME | |

**Used by:** `healthMonitor.ts`

---

### System Configuration

#### `sys_settings`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `setting_key` | VARCHAR(100) UNIQUE | Key name |
| `setting_value` | TEXT | Stored as string |
| `setting_type` | ENUM | `string`, `integer`, `float`, `boolean`, `json` |
| `is_public` | TINYINT(1) | 1 = exposed via GET /settings/public |
| `description` | TEXT | Admin notes |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `settings.ts` route

---

### RBAC (Roles & Permissions)

#### `roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `name` | VARCHAR(100) | Display name |
| `slug` | VARCHAR(100) UNIQUE | Machine key (e.g., `admin`, `staff`) |
| `description` | TEXT | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `systemRoles.ts` route, `mobileAIProcessor.ts` (role resolution)

#### `permissions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `name` | VARCHAR(150) | Display name |
| `slug` | VARCHAR(150) UNIQUE | Dot-notation (e.g., `cases.manage`) |
| `description` | TEXT | |
| `permission_group` | VARCHAR(100) | UI grouping label |
| `created_at` | DATETIME | |

**Used by:** `systemPermissions.ts` route

#### `role_permissions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `role_id` | INT FK | → `roles.id` |
| `permission_id` | INT FK | → `permissions.id` |

**Unique constraint:** `(role_id, permission_id)`

#### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | |
| `user_id` | VARCHAR(36) FK | → `users.id` |
| `role_id` | INT FK | → `roles.id` |

**Unique constraint:** `(user_id, role_id)`

---

### Authentication

#### `user_two_factor`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `user_id` | VARCHAR(36) UNIQUE FK | → `users.id` |
| `is_enabled` | TINYINT(1) | 0 or 1 |
| `preferred_method` | ENUM | `totp`, `email`, `sms` |
| `totp_secret` | VARCHAR(255) | Base32 TOTP secret (encrypted) |
| `backup_codes` | JSON | Array of SHA-256 hashed codes |
| `otp_code` | VARCHAR(10) | Ephemeral email/SMS OTP |
| `otp_expires_at` | DATETIME | 5-minute TTL |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `twoFactor.ts` route

---

### Credential Vault

#### `credentials`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `service_name` | VARCHAR(100) | `SMTP`, `SMS`, `OPENROUTER`, etc. |
| `name` | VARCHAR(200) | Human label |
| `credential_type` | ENUM | `api_key`, `password`, `oauth`, `certificate`, `token`, `other` |
| `credential_value` | TEXT | AES-256-GCM encrypted (`iv:authTag:ciphertext`) |
| `additional_data` | JSON | Extra config (e.g., SMTP host/port) |
| `environment` | VARCHAR(50) | `production`, `staging`, `development` |
| `description` | TEXT | |
| `is_active` | TINYINT(1) | Soft deactivation |
| `version` | INT | Incremented on rotate |
| `expires_at` | DATETIME | Optional expiry |
| `last_used_at` | DATETIME | Updated on read |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Used by:** `credentialVault.ts`, `systemCredentials.ts` route, `email.ts` route

---

### Communication Audit Logs

#### `email_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `to_address` | VARCHAR(500) | Recipient(s) |
| `subject` | VARCHAR(500) | Subject line |
| `status` | ENUM | `sent`, `failed` |
| `message_id` | VARCHAR(255) | SMTP message-id |
| `error` | TEXT | Error detail (failures) |
| `sent_at` | DATETIME | |

**Used by:** `emailService.ts`

#### `sms_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `to_number` | VARCHAR(30) | E.164 number |
| `message` | TEXT | Message body |
| `status` | VARCHAR(50) | `sent`, `failed`, `queued` |
| `message_id` | VARCHAR(255) | SMSPortal ID |
| `cost` | DECIMAL(10,4) | Cost per message |
| `error` | TEXT | Error detail (failures) |
| `sent_at` | DATETIME | |

**Used by:** `smsService.ts`

---

### Mobile AI

#### `staff_software_tokens`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | AUTO_INCREMENT |
| `user_id` | VARCHAR(36) FK | → `users.id` |
| `software_key` | VARCHAR(100) | Portal software key |
| `api_token` | TEXT | Auth token for external API |
| `api_url` | VARCHAR(500) | Custom base URL |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Unique constraint:** `(user_id, software_key)`  
**Used by:** `mobileActionExecutor.ts`, `myAssistant.ts` route

---

## SQLite Tables

### `enterprise_endpoints.db`

#### `enterprise_endpoints`
23 columns — see `enterpriseEndpoints.ts` `EnterpriseEndpoint` interface.

#### `endpoint_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `req_` + random hex |
| `endpoint_id` | TEXT FK | CASCADE delete |
| `timestamp` | TEXT | ISO string |
| `inbound_payload` | TEXT | JSON |
| `ai_response` | TEXT | JSON |
| `duration_ms` | INTEGER | |
| `status` | TEXT | `success \| error` |
| `error_message` | TEXT | nullable |

### `vectors.db`

#### `knowledge_chunks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `assistant_id` | TEXT | Indexed |
| `job_id` | TEXT | Indexed |
| `content` | TEXT | |
| `source` | TEXT | |
| `source_type` | TEXT | `url \| file` |
| `chunk_index` | INTEGER | |
| `char_count` | INTEGER | |
| `created_at` | TEXT | |

#### `knowledge_vectors` (virtual — vec0)
| Column | Type | Notes |
|--------|------|-------|
| `chunk_id` | TEXT PK | → `knowledge_chunks.id` |
| `embedding` | float[768] | Raw Float32Array buffer |

---

## Key TypeScript Interfaces

### AI Provider Pattern
```typescript
interface AIMessage { role: 'system' | 'user' | 'assistant'; content: string }
interface AIResponse { content: string; model: string; usage?: { promptTokens; completionTokens; totalTokens } }
interface AIProvider { name: string; chat(messages, options?): Promise<AIResponse>; isAvailable(): Promise<boolean> }
interface AIOptions { temperature?: number; maxTokens?: number; model?: string }
```

### Knowledge Health
```typescript
interface ChecklistItem { key: string; label: string; type: 'url' | 'file'; satisfied: boolean }
interface KnowledgeHealth { score: number; checklist: ChecklistItem[]; missing: string[]; recommendations: {...}[] }
```

### Normalized Messages
```typescript
interface NormalizedInbound { text: string; sender_id?: string; channel: string; timestamp?: string; metadata?: Record<string, any> }
interface FormattedOutbound { body: any; contentType: string }
```

### Credit System
```typescript
interface CreditBalanceInfo { id; teamId; balance; totalPurchased; totalUsed; lowBalanceThreshold; lowBalanceAlertSent; formattedBalance }
type CreditTransactionType = 'BONUS' | 'USAGE' | 'PURCHASE' | 'REFUND' | 'ADJUSTMENT'
type RequestType = /* from config/credits.ts */
```

### Credential Vault
```typescript
interface VaultEntry { value: string; data: Record<string, string> | null }
interface CachedCredential { value: string; data: Record<string, string> | null; fetchedAt: number }
```

### Mobile AI Assistant
```typescript
interface MobileIntentRequest { text: string; conversationId?: string; assistantId?: string; language?: string }
interface MobileIntentResponse { reply: string; conversationId: string; toolsUsed: string[]; data?: Record<string, unknown> }
interface MobileExecutionContext { userId: string; role: MobileRole; assistantId?: string }
type MobileRole = 'client' | 'staff'
```

### Email Service
```typescript
interface EmailOptions { to: string | string[]; subject: string; text?: string; html?: string; from?: string; replyTo?: string; cc?; bcc?; attachments? }
interface EmailSendResult { success: boolean; messageId?: string; error?: string }
```
