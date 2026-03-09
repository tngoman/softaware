# Services — Architectural Patterns & Anti-Patterns

> Recurring design patterns, conventions, and issues identified across the services layer.

---

## ✅ Patterns (Best Practices in Use)

### 1. Stateless Exported Functions

All services export named async functions or object literals. No classes hold request-scoped state. This makes them safe for concurrent use behind Express.

```typescript
// credits.ts — typical pattern
export async function getTeamCreditBalance(teamId: string): Promise<CreditBalanceInfo | null> { … }
export async function deductCredits(teamId: string, requestType: RequestType): Promise<CreditBalanceInfo> { … }
```

**Used by:** 25 of 27 root service files.  
**Exceptions:** `codeAgent.ts` (class), `sshService.ts` (class), `glmService.ts` (class) — all export singletons.

---

### 2. Strategy Pattern — AI Providers

The `ai/` subdirectory implements the Strategy pattern via `AIProvider` interface, `AIProviderManager` registry, and concrete providers (GLM, Ollama).

```
AIProvider (interface)
  ├── GLMProvider
  └── OllamaProvider
       ↑
AIProviderManager.getProvider('ollama')
```

Runtime switching: `aiProviderManager.setProvider('glm')`  
**Benefit:** New LLM backends (OpenAI, Anthropic) can be added without changing consumers.

---

### 3. Tiered Processing

The ingestion pipeline and AI routing split behavior by subscription tier:

| Tier | AI Cleaning | Embedding | Priority |
|------|-------------|-----------|----------|
| Free | Skip (raw cheerio text) | Same (nomic-embed-text) | Low (dequeued last) |
| Paid | OpenRouter (fast) | Same (nomic-embed-text) | High (dequeued first) |

**Used by:** `ingestionWorker.ts`, `ingestionAIRouter.ts`

---

### 4. Dual Database Architecture

| Use Case | Technology | Why |
|----------|------------|-----|
| Relational data (users, credits, subscriptions) | MySQL 8 | ACID, joins, existing schema |
| Vector search (KNN) | SQLite + sqlite-vec | No server dependency, in-process, fast cosine search |
| Enterprise endpoints | SQLite (better-sqlite3) | Isolated from main DB, WAL mode, no async overhead |

**Benefit:** sqlite-vec provides proper vector indexing without adding a separate service (Pinecone, Weaviate), while MySQL handles relational integrity.

---

### 5. Encrypted Credentials at Rest + Credential Vault

FTP passwords, SMS credentials, and all API keys use AES-256-GCM encryption via `cryptoUtils.ts`. Since 2025-07-15, the centralised `credentialVault.ts` provides a single read interface with 5-min cache and env-var fallback:

```typescript
// Write (in systemCredentials route)
const encrypted = encryptPassword(plaintext);  // → "iv:authTag:ciphertext"

// Read (via credentialVault)
const apiKey = await getSecret('OPENROUTER');  // decrypts from DB, caches 5 min
const smtp = await getSmtpConfig();            // ready-to-use nodemailer config
```

**Used by:** `siteBuilderService.ts` (FTP), `smsService.ts` (SMS), and 9+ services via `credentialVault.ts`  
**Master key:** `ENCRYPTION_MASTER_KEY` env var  
**Cache:** 5-min TTL for found credentials, 1-min TTL for misses

---

### 6. Graceful Fallback Chains

Multiple services implement cascading fallback:

| Service | Fallback Chain |
|---------|---------------|
| `openRouterVision` | `qwen/qwen-2.5-vl-7b` → `meta-llama/3.2-11b-vision` → `openai/gpt-4o-mini` |
| `ingestionAIRouter` | OpenRouter (paid) → Ollama (free) |
| `caseAnalyzer` | Ollama AI analysis → static route-based component map |
| `smsService` | Colon-delimited credentials → split column credentials |

---

### 7. Transaction Logging

Financial operations create an audit trail:

```
credits.ts:  credit_transactions (every debit/credit with balanceAfter snapshot)
payment.ts:  externalPaymentId for idempotent webhook processing
smsService:  sms_log with per-message cost tracking
```

---

### 8. Process Isolation for Heavy Work

The ingestion worker runs in a separate V8 process:

```
index.ts  →  child_process.fork('ingestionWorkerProcess.ts')
                  ↓
          Isolated heap: cheerio DOM parsing + embeddings
          Express server heap stays clean
```

**Benefit:** Large HTML parsing and embedding arrays don't cause GC pressure on API responses.

---

### 9. Auto-Healing via Health Monitor

The health monitor creates a closed feedback loop:

```
healthMonitor  →  Detects failure (3 consecutive)
               →  Creates case in `cases` table
               →  Notifies admins via notifications
               →  On recovery: auto-resolves case
```

---

### 10. OR-Merge for Knowledge Scoring

`knowledgeCategorizer.ts` uses monotonic OR-merge — once a checklist item is satisfied, it stays satisfied across future ingestions:

```typescript
const merged = checklist.map(item => ({
  ...item,
  satisfied: item.satisfied || Boolean(newResults[item.key]),
}));
```

**Benefit:** Progressive knowledge building. Deleting a page doesn't immediately degrade the score (requires explicit recategorization).

---

### 11. Prompt Stitching — The Guardrail (Mobile AI)

The mobile AI assistant uses a "prompt stitching" pattern to separate backend-enforced safety from GUI-editable personality:

```
System Prompt = core_instructions       ← hidden from GUI, backend-only
              + personality_flare       ← editable in GUI ("be a pirate")
              + tool definitions        ← injected by role, never from DB
```

```typescript
function buildStitchedPrompt(assistant, toolsPrompt, role) {
  return `${adminCore}\n${identity}\n${personalityFlare}\n${toolsPrompt}`;
}
```

**Benefit:** A staff member can configure their assistant as "a sarcastic pirate named Blackbeard" and the AI will still successfully execute admin tools — it'll just confirm actions using sea shanties.  
**Used by:** `mobileAIProcessor.ts`

---

### 12. Role-Based Tool Injection (Mobile AI)

Tool definitions are selected at runtime based on the user's role from the JWT:

| Role | Tools Available |
|------|-----------------|
| `client` | 5 self-service tools (list assistants, toggle status, usage stats, failed jobs, retry) |
| `staff` | All 13 tools (client tools + task CRUD + admin actions) |

**Security:** Tool definitions never come from the database. Staff cannot escalate their tool access from the GUI. Client tools enforce ownership checks on every execution.

**Used by:** `mobileTools.ts`, `mobileActionExecutor.ts`

---

### 13. Temp Token 2FA Login Flow

Two-factor authentication uses a split-token pattern during login:

```
1. POST /auth/login     → user has 2FA enabled
   → issue temp_token (JWT with { twofa_pending: true }, short TTL)
   → email/SMS OTP sent (if applicable)

2. POST /auth/2fa/verify  → validates temp_token + OTP code
   → issue real JWT (full session) on success
```

**Why:** The temp token prevents the user from accessing any authenticated endpoint before completing 2FA. Regular `requireAuth` middleware rejects tokens with `twofa_pending: true`. The 2FA verify endpoint explicitly checks for this flag.

**Enforcement:** Staff and admin roles have 2FA mandatory. They cannot disable 2FA, only change the method. This is enforced in `POST /auth/2fa/disable`.

**Used by:** `twoFactor.ts` route, `auth.ts` route

---

### 14. Credential Cache Invalidation

The credential vault uses a 5-minute in-memory cache to avoid hitting MySQL on every request. When admin CRUD operations modify a credential, they must explicitly call `invalidateCache(serviceName)` to clear the stale entry.

```typescript
// systemCredentials.ts — after update/delete/rotate
import { invalidateCache } from '../services/credentialVault.js';
invalidateCache(credential.service_name);
```

Similarly, the email service caches its nodemailer transporter instance. After SMTP config changes, `invalidateTransporter()` forces a fresh transporter on the next send.

**Used by:** `systemCredentials.ts` route, `email.ts` route, `credentialVault.ts`

---

### 15. FK Cascade Deletion — User Cleanup

Deleting a user via `systemUsers.ts` cascades across 14 foreign key tables using individual `DELETE FROM` statements in a loop. This ensures referential integrity even for tables without `ON DELETE CASCADE` constraints.

```typescript
const cascadeTables = [
  'user_roles', 'team_members', 'fcm_tokens', 'api_keys',
  'device_activations', 'activation_keys', 'agents_config',
  'vault_credentials', 'user_two_factor', 'group_members',
  'group_messages', 'widget_clients', 'generated_sites', 'notifications'
];
for (const table of cascadeTables) {
  await db.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
}
```

**Note:** Each `DELETE` is wrapped in a try-catch so missing tables (not yet created) don't break the cascade.

**Used by:** `systemUsers.ts` route

---

## ⚠️ Anti-Patterns & Technical Debt

### 1. ~~Hardcoded API Key in Source~~ — ✅ FIXED (2025-07-15)

**File:** `openRouterVision.ts`  
**Resolution:** Hardcoded fallback removed. Now reads from credential vault via `getSecret('OPENROUTER')` with env-var fallback.

---

### 2. Legacy glmService.ts vs ai/GLMProvider.ts — ⚠️ Deprecated

**Files:** `glmService.ts` (61 LOC) and `ai/GLMProvider.ts` (39 LOC)  
**Issue:** Two separate GLM implementations exist. `glmService.ts` predates the provider abstraction and is consumed by `routes/glm.ts`.  
**Status:** `glmService.ts` marked `@deprecated` since 2025-07-15 and wired to vault. `ai/GLMProvider.ts` is the canonical implementation with lazy client init.  
**Remaining:** Migrate `routes/glm.ts` to use `aiProviderManager.getProvider('glm')` and delete `glmService.ts`.

---

### 3. embeddingService.ts Naive Search

**File:** `embeddingService.ts` — `searchSimilar()`  
**Issue:** Loads ALL embeddings for a client into memory and computes cosine similarity in a loop. Does not scale past ~10K documents.  
**Mitigation:** `vectorStore.ts` (sqlite-vec) provides proper KNN search and is used by the ingestion pipeline. But `widgetChat.ts` still imports `embeddingService.searchSimilar()`.  
**Fix:** Migrate `widgetChat.ts` to use `vectorStore.search()`.

---

### 4. Two Document Storage Systems

**Files:** `documentService.ts` (MySQL) and `vectorStore.ts` (SQLite)  
**Issue:** Documents are stored in both `document_metadata` (MySQL) via `documentService` and `knowledge_chunks` (SQLite) via `vectorStore`. The ingestion worker writes to both. Different services read from different stores.  
**Risk:** Data drift between the two stores.  
**Fix:** Consolidate on one store or add a sync/reconciliation step.

---

### 5. ~~smsService Not Wired to Any Route~~ — ✅ FIXED (2025-07-15)

**File:** `smsService.ts` (411 LOC)  
**Resolution:** `routes/sms.ts` created with 4 endpoints (send, send-bulk, balance, normalise). Requires `requireAuth` + `requireAdmin`. Registered in `app.ts` at `/sms`.

---

### 6. codeAgent Possibly Unused

**File:** `codeAgent.ts` (188 LOC)  
**Issue:** No route file imports `codeAgentService`. The `ALLOWED_DIRECTORIES` whitelist (`/var/www/code`) is a single-element array.  
**Fix:** Verify usage or remove dead code.

---

### 7. Inconsistent Export Patterns

| Pattern | Files | Example |
|---------|-------|---------|
| Named functions | credits, payment, subscription, smsService | `export async function sendSms()` |
| Object literal | documentService, crawlerService, widgetService, embeddingService, ftpDeploymentService, siteBuilderService | `export const widgetService = { … }` |
| Class + singleton | codeAgent, sshService, glmService | `export class SSHService { } export const sshService = new SSHService()` |

**Issue:** Three different patterns make it harder to predict import shape.  
**Recommendation:** Standardise on named function exports (most common pattern).

---

### 8. Dynamic Imports in payment.ts

**File:** `payment.ts` lines ~200, ~393  
**Issue:** Uses `const { addCredits } = await import('./credits.js')` instead of a top-level import. This is done to avoid circular dependencies but makes the dependency graph implicit.  
**Fix:** Extract shared types to a neutral module to break the cycle.

---

### 9. Inconsistent Error Handling

Some services throw errors for callers to catch:
```typescript
// credits.ts
throw new Error('Insufficient credits...');
```

Others return result objects:
```typescript
// documentService.ts
return { success: false, chunksCreated: 0, error: '...' };
```

**Recommendation:** Standardise on one pattern. Thrown errors work better with Express error middleware.

---

### 10. No Unit Tests

**Issue:** Zero test files exist for any service.  
**Risk:** Regressions go undetected. Services with financial impact (credits, payment, subscription) are especially risky.  
**Fix:** Priority test targets: `credits.ts`, `payment.ts`, `smsService.ts`, `payloadNormalizer.ts` (pure functions).

---

### 11. Missing Input Validation in Services

**Issue:** Most services trust their callers to provide valid input. Validation happens (if at all) in route handlers.  
**Example:** `sendSms()` validates phone format but `addCredits()` accepts negative amounts without checking.  
**Fix:** Add Zod schemas or runtime checks at service boundaries.

---

### 12. ~~Credentials Table Read Without Encryption Check~~ — ✅ FIXED (2025-07-15)

**File:** `systemCredentials.ts` route  
**Resolution:** CRUD routes now call `encryptPassword()` on write and `decryptPassword()` on read. The `credentialVault.ts` service uses `tryDecrypt()` which handles both encrypted and plaintext values during the migration period.

---

## Naming Conventions

| Convention | Example | Notes |
|------------|---------|-------|
| Service files | `camelCase.ts` | e.g., `siteBuilderService.ts` |
| Interfaces | `PascalCase` | e.g., `CreditBalanceInfo` |
| DB table names | `snake_case` | e.g., `credit_balances` |
| Column names | `camelCase` or `snake_case` | **Mixed** — MySQL tables use both |
| Function exports | `camelCase` | e.g., `getTeamCreditBalance` |
| Singleton exports | `camelCase` | e.g., `sshService`, `glmService` |
| Constants | `SCREAMING_SNAKE` | e.g., `POLL_INTERVAL_MS`, `MAX_RETRIES` |

**Issue:** Column naming is inconsistent — `credit_balances` uses `camelCase` columns (`teamId`, `totalPurchased`) while `widget_clients` uses `snake_case` columns (`user_id`, `website_url`). This reflects different development phases.
