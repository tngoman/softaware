# Services — Change Log & Known Issues

> Version history, migration notes, and tracked issues for the services layer.

---

## Version History

### 2025-07-14 — Services Documentation Created

- **Scope:** Full documentation of all 31 service files across 6 documents
- **Added:** README.md, FILES.md, FIELDS.md, ROUTES.md, PATTERNS.md, CHANGES.md
- **Coverage:** AI providers, knowledge ingestion pipeline, widget/chat, billing/subscription, site builder, infrastructure/monitoring, external connectivity, code agent

### 2025-07-14 — smsService.ts Created

- **File:** `smsService.ts` (411 LOC)
- **Purpose:** SMSPortal REST API integration
- **Exports:** `sendSms`, `sendBulkSms`, `getBalance`, `normalisePhone`, `invalidateToken`
- **Note:** Not yet wired to any route handler

### 2025-07-15 — Credential Vault Migration & Finding Remediation

Major security and architecture update: moved all API keys and passwords from `.env` to the encrypted credential vault (`credentials` table + AES-256-GCM).

#### New Files Created
| File | Purpose |
|------|---------|
| `services/credentialVault.ts` | Centralised encrypted credential reader with 5-min cache and env-var fallback |
| `routes/sms.ts` | HTTP surface for smsService (POST /send, POST /send-bulk, GET /balance) |
| `scripts/seed-credentials.ts` | One-time migration script — reads .env secrets, encrypts, inserts into DB |

### 2025-07-17 — Mobile AI Assistant, Email Service, Team Chat & Documentation Refresh

Major feature addition: mobile AI assistant with voice/text tool-calling, SMTP email service, team chat, and staff assistant management. Full documentation refresh across all 6 docs.

#### New Service Files
| File | LOC | Purpose |
|------|-----|---------|
| `services/emailService.ts` | ~270 | SMTP email via credentials table (nodemailer), test emails, 2FA OTP, logging |
| `services/mobileAIProcessor.ts` | ~305 | Ollama conversation workflow with iterative tool-call loop + prompt stitching |
| `services/mobileActionExecutor.ts` | ~530 | Tool execution engine (13 tools) with ownership/role security checks |
| `services/mobileTools.ts` | ~310 | OpenAI-compatible tool definitions for client (5) + staff (8) roles |

#### New Route Files
| File | Mount | Purpose |
|------|-------|---------|
| `routes/email.ts` | `/email` | SMTP test, send, config CRUD, logs (admin) |
| `routes/mobileIntent.ts` | `/v1/mobile` | POST /intent (AI pipeline), GET /assistants, conversations CRUD |
| `routes/staffAssistant.ts` | `/v1/mobile/staff-assistant` | Staff assistant CRUD, core_instructions (super-admin), software token management |
| `routes/teamChat.ts` | `/team-chats` | Team CRUD, membership, messages, file uploads |

#### New MySQL Tables
| Table | Used By |
|-------|---------|
| `email_log` | `emailService.ts` |
| `mobile_conversations` | `mobileAIProcessor.ts` |
| `mobile_messages` | `mobileAIProcessor.ts` |
| `staff_software_tokens` | `mobileActionExecutor.ts`, `staffAssistant.ts` route |
| `team_chats` | `teamChat.ts` route |
| `team_chat_members` | `teamChat.ts` route |
| `team_chat_messages` | `teamChat.ts` route |

#### Architectural Patterns Added
| Pattern | Description |
|---------|-------------|
| Prompt Stitching | `core_instructions` (backend-enforced) + `personality_flare` (GUI-editable) + tool defs (role-injected) |
| Role-Based Tool Injection | Tool definitions selected at runtime from JWT role; never stored in DB |

#### Documentation Updated
| File | Changes |
|------|---------|
| README.md | File count 31→36, LOC 7,664→9,290, architecture diagram (added credential vault, mobile AI, email), 3 new service groups (#8 Credential Vault, #9 Mobile AI Assistant), updated cross-service deps, external APIs table |
| FILES.md | 5 new service entries, 6 modified entries (vault deps, anti-pattern notes), deprecated tag on glmService |
| FIELDS.md | Full credentials table schema, 7 new tables, 4 new TypeScript interfaces |
| ROUTES.md | 5 new route file sections with full endpoint tables, updated service→route matrix (+6 services), unrouted services cleaned up |
| PATTERNS.md | 2 new patterns (#11 Prompt Stitching, #12 Role-Based Tool Injection), 3 anti-patterns marked FIXED (#1, #5, #12), #2 updated to deprecated |
| CHANGES.md | This entry |

#### Findings Resolved
| ID | Status | Resolution |
|----|--------|------------|
| **S-001** | ✅ Fixed | Removed hardcoded OpenRouter API key; `openRouterVision.ts` now reads from vault with env fallback |
| **S-002** | ✅ Fixed | `systemCredentials.ts` now calls `encryptPassword()` on create/update/rotate and `decryptPassword()` on read |
| **S-003** | ✅ Fixed | Created `routes/sms.ts` with send, send-bulk, balance, normalise endpoints; registered in `app.ts` |
| **S-005** | ✅ Mitigated | `glmService.ts` marked `@deprecated` and wired to vault; `ai/GLMProvider.ts` is canonical |
| **S-006** | ✅ Fixed | Implemented proper PayFast MD5 signature verification per PayFast docs |

#### Services Wired to Credential Vault
| Service | Credential(s) | Vault Key |
|---------|---------------|-----------|
| `openRouterVision.ts` | API key | `OPENROUTER` |
| `ingestionAIRouter.ts` | API key | `OPENROUTER` |
| `firebaseService.ts` | Project ID, email, private key | `FIREBASE` |
| `payment.ts` | Merchant key, passphrase | `PAYFAST` |
| `payment.ts` | Secret key, webhook secret | `YOCO` |
| `leadCaptureService.ts` | SMTP host/port/user/pass/from | `SMTP` |
| `actionRouter.ts` | SMTP host/port/user/pass/from | `SMTP` |
| `ai/GLMProvider.ts` | API key | `GLM` |
| `glmService.ts` | API key | `GLM` |

#### Missing Backend Routes Added
| Route | Method | Purpose |
|-------|--------|---------|
| `/credentials/search` | GET | Search by service_name, identifier, or notes |
| `/credentials/service/:serviceName` | GET | Lookup by service name (used by frontend `CredentialModel.getByService()`) |

#### Credentials Migrated to Vault (via seed script)
`SMTP`, `OPENROUTER`, `GLM`, `GEMINI`, `OPENAI`, `AWS`, `ANTHROPIC`, `FIREBASE`, `PAYFAST`, `YOCO`, `TRACCAR`, `FOREX`, `NEWSAPI`, `GNEWS`

#### Values Safe to Keep in .env
`PORT`, `NODE_ENV`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `DATABASE_URL`, `ENCRYPTION_MASTER_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_VISION_MODEL`, `OLLAMA_KEEP_ALIVE`, `DEFAULT_AI_PROVIDER`, `TWO_FACTOR_APP_NAME`, `SOFTAWARE_VISION_PROVIDER`, model selection vars, URLs, `MCP_ENABLED`, `CODE_AGENT_*`, threshold values

### Pre-existing Services (estimated timeline)

| Phase | Services Added | Notes |
|-------|---------------|-------|
| **Phase 1 — Core Platform** | `credits.ts`, `payment.ts`, `subscription.ts`, `widgetService.ts`, `documentService.ts`, `embeddingService.ts` | Initial billing + widget system |
| **Phase 2 — AI Assistants** | `actionRouter.ts`, `leadCaptureService.ts`, `knowledgeCategorizer.ts`, `ingestionWorker.ts`, `ingestionAIRouter.ts` | AI chat + ingestion pipeline |
| **Phase 3 — Enterprise** | `enterpriseEndpoints.ts`, `payloadNormalizer.ts`, `healthMonitor.ts`, `notificationService.ts`, `firebaseService.ts` | Multi-channel + monitoring |
| **Phase 4 — Site Builder** | `siteBuilderService.ts`, `ftpDeploymentService.ts`, `sshService.ts` | Static site generation + deployment |
| **Phase 5 — AI Providers** | `ai/AIProvider.ts`, `ai/AIProviderManager.ts`, `ai/GLMProvider.ts`, `ai/OllamaProvider.ts`, `glmService.ts`, `openRouterVision.ts` | LLM abstraction layer |
| **Phase 6 — Vector Store** | `vectorStore.ts`, `ingestionWorkerProcess.ts` | sqlite-vec + process isolation |
| **Phase 7 — Latest** | `smsService.ts`, `caseAnalyzer.ts`, `codeAgent.ts`, `crawlerService.ts` | External integrations + dev tools |
| **Phase 8 — Vault + Mobile** | `credentialVault.ts`, `emailService.ts`, `mobileAIProcessor.ts`, `mobileActionExecutor.ts`, `mobileTools.ts` | Encrypted vault, SMTP, mobile AI assistant |
| **Phase 9 — System Management + 2FA** | (route files only) | System settings, RBAC, credentials admin, multi-method 2FA, unified assistant CRUD |

---

### 2026-03-05 — System Management, RBAC, 2FA & Unified Assistant

Full RBAC system, system settings, multi-method two-factor authentication, credential vault admin UI, SMTP/SMS admin, and unified mobile assistant endpoint.

#### Updated Service Files
| File | Old LOC | New LOC | Changes |
|------|---------|---------|---------|
| `credentialVault.ts` | ~210 | ~248 | Added `invalidateCache()` API, improved `tryDecrypt()` migration helper |
| `emailService.ts` | ~270 | ~325 | Added `sendTwoFactorOtp()`, auto-create `email_log` table on first use, improved error handling |
| `mobileAIProcessor.ts` | ~305 | ~384 | Per-assistant `core_instructions`, `personality_flare` prompt stitching, improved context history trimming |
| `mobileActionExecutor.ts` | ~530 | ~809 | 3 new staff tools, external API task proxy via `staff_software_tokens`, improved ownership checks |
| `mobileTools.ts` | ~310 | ~420 | Expanded from 10 to 13 tool definitions, richer parameter schemas |

#### New Route Files
| File | Mount | Endpoints | Purpose |
|------|-------|-----------|---------|
| `routes/settings.ts` | `/settings` | 7 | System key-value settings CRUD + public API |
| `routes/systemUsers.ts` | `/users` | 5 | User account management with role assignment |
| `routes/systemRoles.ts` | `/roles` | 7 | Role CRUD + user assignment |
| `routes/systemPermissions.ts` | `/permissions` | 8 | Permission CRUD + role assignment |
| `routes/systemCredentials.ts` | `/credentials` | 12 | Encrypted credential vault admin |
| `routes/twoFactor.ts` | `/auth/2fa` | 8 | Multi-method 2FA (TOTP, email, SMS) |
| `routes/myAssistant.ts` | `/v1/mobile/my-assistant` | 10 | Unified assistant CRUD (replaces staffAssistant.ts) |

#### New MySQL Tables
| Table | Used By |
|-------|---------|
| `sys_settings` | `settings.ts` route |
| `roles` | `systemRoles.ts` route, `mobileAIProcessor.ts` |
| `permissions` | `systemPermissions.ts` route |
| `role_permissions` | Junction: roles ↔ permissions |
| `user_roles` | Junction: users ↔ roles |
| `user_two_factor` | `twoFactor.ts` route |
| `credentials` | `credentialVault.ts`, `systemCredentials.ts` route, `email.ts` route |
| `sms_log` | `smsService.ts` |

#### Architectural Highlights
| Feature | Description |
|---------|-------------|
| Multi-method 2FA | TOTP (Google Authenticator), email OTP, SMS OTP with mandatory enforcement for staff/admin |
| RBAC system | Roles → permissions with wildcard admin, `<Can>` frontend component |
| Unified assistant route | `myAssistant.ts` replaces `staffAssistant.ts`, handles both staff and client roles |
| Credential vault admin | Full CRUD with AES-256-GCM encryption, rotation, deactivation, expiry tracking |
| Temp token login flow | 2FA-enabled users receive `temp_token` (JWT with `twofa_pending`) before real JWT |

#### Documentation Updated
| File | Changes |
|------|---------|
| Admin/README.md | Version 1.2.0, metrics updated (116 endpoints, 10 pages, 16 routes), 7 new feature sections (§3.9–3.15), architecture diagram expanded |
| Admin/ROUTES.md | Version 1.2.0, 66 new endpoints documented (§15–23), endpoint directory table expanded to 116 rows |
| Admin/FIELDS.md | Version 1.2.0, 10 new table schemas (§8.1–8.10), metrics updated |
| Services/README.md | LOC updated (~9,925), date 2026-03-05, groups 7-9 expanded with per-file LOC, vault consumer list updated |
| Services/FILES.md | 5 service files updated with new LOC counts and expanded purpose descriptions |
| Services/FIELDS.md | 12 new MySQL table schemas added (sys_settings, RBAC tables, 2FA, credentials, audit logs, tokens) |
| Services/CHANGES.md | This entry |

---

## Known Issues

### Critical

| ID | Service | Issue | Status |
|----|---------|-------|--------|
| S-001 | `openRouterVision.ts` | ~~API key hardcoded as fallback in source~~ | ✅ Fixed — reads from vault |
| S-002 | `credentials` table | ~~Plaintext storage — CRUD routes don't encrypt~~ | ✅ Fixed — encrypt on write, decrypt on read |

### High

| ID | Service | Issue | Status |
|----|---------|-------|--------|
| S-003 | `smsService.ts` | ~~No route handler — cannot be called via API~~ | ✅ Fixed — `routes/sms.ts` |
| S-004 | `embeddingService.ts` | `searchSimilar()` loads all embeddings into memory | 🔴 Open — OOM risk |
| S-005 | `glmService.ts` | ~~Duplicate of `ai/GLMProvider.ts`~~ | ✅ Deprecated — vault-wired |
| S-006 | `payment.ts` | ~~PayFast signature verification returns `true` unconditionally~~ | ✅ Fixed — MD5 verification |

### Medium

| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| S-007 | `documentService.ts` + `vectorStore.ts` | Dual document storage (MySQL + SQLite) | Data drift potential |
| S-008 | `codeAgent.ts` | No route imports it — possibly dead code | Maintenance waste |
| S-009 | All services | No unit tests | Regression risk (especially billing) |
| S-010 | Various | Inconsistent export patterns (functions vs objects vs classes) | Developer confusion |
| S-011 | Various | Mixed column naming (`camelCase` vs `snake_case`) | Query bugs |
| S-012 | `payment.ts` | Dynamic `import('./credits.js')` to avoid circular deps | Implicit dependency graph |

### Low

| ID | Service | Issue | Impact |
|----|---------|-------|--------|
| S-013 | `knowledgeCategorizer.ts` | OR-merge means deleted content still counts as "satisfied" | Inflated health scores |
| S-014 | `leadCaptureService.ts` | `getLeadStats()` uses `db.execute` returning raw `[rows]` pattern | Inconsistent with other services using `db.query` |
| S-015 | `healthMonitor.ts` | Checks all enterprise endpoints sequentially | Slow if many endpoints |

---

## Migration Checklist

### Before Next Release

- [x] **S-001:** Remove hardcoded OpenRouter API key from `openRouterVision.ts` ✅ 2025-07-15
- [x] **S-003:** Create `routes/sms.ts` to expose `smsService` via API ✅ 2025-07-15
- [x] **S-005:** Migrate `routes/glm.ts` to use `aiProviderManager` and delete `glmService.ts` ✅ Deprecated, vault-wired
- [x] **Credential Migration:** Run `scripts/seed-credentials.ts` to populate vault ⏳ Pending execution

### Technical Debt Sprint

- [x] **S-002:** Add `encryptPassword()` call to credential CRUD routes ✅ 2025-07-15
- [ ] **S-004:** Migrate `widgetChat.ts` from `embeddingService.searchSimilar()` to `vectorStore.search()`
- [x] **S-006:** Implement proper PayFast signature verification ✅ 2025-07-15
- [ ] **S-007:** Choose single document store or add reconciliation
- [ ] **S-008:** Verify if `codeAgent` is used; delete if dead code
- [ ] **S-009:** Add unit tests for `credits.ts`, `payment.ts`, `smsService.ts`, `payloadNormalizer.ts`
- [ ] **S-012:** Break circular dependency between `payment.ts` and `credits.ts`

### Nice to Have

- [ ] Standardise export patterns across all services
- [ ] Standardise column naming convention
- [ ] Add Zod validation at service boundaries
- [ ] Parallelise health checks for enterprise endpoints
- [ ] Add retry logic to `sendLeadNotification` email sending

---

## Related Documentation

| Document | Path |
|----------|------|
| Credentials Module | `documentation/Credentials/` |
| Subscription Module | `documentation/Subscription/` |
| AI Gateway | `documentation/AIGateway/` |
| Site Builder | `documentation/SiteBuilder/` |
| Lead Assistants | `documentation/LeadAssistants/` |
| Notifications | `documentation/Notifications/` |
| Admin Module | `documentation/Admin/` |
