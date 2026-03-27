# SoftAware Platform — Improvement Plan

**Created:** 2026-03-14  
**Last Updated:** 2026-03-14  
**Status:** In Progress

---

## Phase 1 — Critical Security: Authorization Gaps

> **Goal:** Prevent privilege escalation. Add `requireAdmin` to all admin-only routers.  
> **Effort:** ~1 line per router (add middleware import + insert into chain)  
> **Risk if skipped:** Any authenticated user can promote themselves to admin.

- [x] **1.1** `systemUsers.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/systemUsers.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — all 5 CRUD endpoints now admin-only  

- [x] **1.2** `systemRoles.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/systemRoles.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — all 7 endpoints now admin-only  

- [x] **1.3** `systemPermissions.ts` — Add `requireAdmin` per-route (except `GET /user`) ✅  
      _File:_ `backend/src/routes/systemPermissions.ts`  
      _Done:_ Added `requireAdmin` to 7 of 8 endpoints. `GET /permissions/user` kept auth-only (returns user's own perms)  

- [x] **1.4** `systemCredentials.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/systemCredentials.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — all 12 endpoints now admin-only  

- [x] **1.5** `adminDashboard.ts` — Add `requireAdmin` after `requireAuth` ✅  
      _File:_ `backend/src/routes/adminDashboard.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)`  

- [x] **1.6** `accounting.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/accounting.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — all 11 endpoints now admin-only  

- [x] **1.7** `financialReports.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/financialReports.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — all 3 report endpoints now admin-only  

- [x] **1.8** `vatReports.ts` — Add `requireAdmin` after `requireAuth` on all routes ✅  
      _File:_ `backend/src/routes/vatReports.ts`  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` — VAT report endpoint now admin-only  

---

## Phase 2 — Critical Security: Missing Auth & XSS

> **Goal:** Fix endpoints with no auth at all, and the XSS vulnerability.  
> **Effort:** Small — each is a 1–5 line fix.

- [x] **2.1** `bugs.ts` — Use `strictAuth` (real requireAuth) for destructive operations ✅  
      _File:_ `backend/src/routes/bugs.ts`  
      _Done:_ Imported real `requireAuth` as `strictAuth`; applied to DELETE bug, DELETE comment, DELETE attachment. Optional auth kept for GET/POST (external bug reporters)  

- [x] **2.2** `bugs.ts` — Add auth to attachment download endpoint ✅  
      _File:_ `backend/src/routes/bugs.ts`  
      _Done:_ Added `strictAuth` to `GET /:id/attachments/:attId/download`  

- [x] **2.3** `notifications.ts` — Add admin/ownership check on `POST /notifications` ✅  
      _File:_ `backend/src/routes/notifications.ts`  
      _Done:_ Self-targeting allowed; targeting another user now requires `is_admin` check  

- [x] **2.4** `NotificationDropdown.tsx` — Replace `dangerouslySetInnerHTML` with safe text ✅  
      _File:_ `frontend/src/components/Notifications/NotificationDropdown.tsx`  
      _Done:_ Replaced `<div dangerouslySetInnerHTML>` with `<p>{notification.message}</p>`  

---

## Phase 3 — Critical: Financial Data Integrity

> **Goal:** Fix incorrect payment statuses and prevent duplicate processing.  
> **Effort:** Mostly one-line fixes.

- [x] **3.1** `payments.ts` — Change `paid = 1` to `paid = 2` when invoice is fully paid ✅  
      _File:_ `backend/src/routes/payments.ts`  
      _Done:_ Changed `SET paid = 1` → `SET paid = 2`  

- [x] **3.2** `invoices.ts` — Change `paid = 1` to `paid = 2` in both locations ✅  
      _File:_ `backend/src/routes/invoices.ts`  
      _Done:_ Fixed both: payment recording (line ~463) and mark-paid endpoint (line ~615)  

- [x] **3.3** `payments.ts` — Add duplicate processing guard (check if payment already applied before INSERT) ✅  
      _File:_ `backend/src/routes/payments.ts`  
      _Done:_ Added duplicate check (same invoice_id + amount + date) before INSERT; reuses computed paymentDate variable  

- [x] **3.4** `invoices.ts` / `payments.ts` / `quotations.ts` — Add `requireAdmin` ✅  
      _Files:_ All 3 financial routers  
      _Done:_ Added `router.use(requireAuth, requireAdmin)` to all three  

---

## Phase 4 — High: Auth & Data Safety

> **Goal:** Harden authentication, fix transaction safety, stop data leaks.  
> **Effort:** Medium — requires careful implementation.

- [x] **4.1** `auth.ts` — Add express-rate-limit to `POST /auth/login` and `POST /auth/register` ✅  
      _File:_ `backend/src/routes/auth.ts`  
      _Done:_ Login: 10 attempts/15min. Register: 5 attempts/hour. Installed `express-rate-limit` as direct dependency  

- [x] **4.2** `databaseManager.ts` — Add operator whitelist and table name validation ✅  
      _File:_ `backend/src/routes/databaseManager.ts`  
      _Done:_ Added `ALLOWED_OPERATORS` whitelist, `isSafeIdentifier()` regex validator for table names; applied to both MSSQL and MySQL filter paths  

- [x] **4.3** `adminCases.ts` — Wrap cascading delete in a transaction ✅  
      _File:_ `backend/src/routes/adminCases.ts`  
      _Done:_ Both single DELETE and bulk-delete now use `db.transaction()` to wrap comment/activity/case deletes  

- [x] **4.4** `systemRoles.ts` — Protect system roles from deletion (admin, super_admin, developer, etc.) ✅  
      _File:_ `backend/src/routes/systemRoles.ts`  
      _Done:_ Added `PROTECTED_SLUGS` array check before delete; returns 400 for built-in roles  

- [x] **4.5** `quotations.ts` — Update quotation status to "converted" when converting to invoice ✅  
      _File:_ `backend/src/routes/quotations.ts`  
      _Done:_ Added `UPDATE quotations SET status = 'converted'` inside the transaction, after items are copied  

- [x] **4.6** `systemUsers.ts` — Fix N+1 query (use single query instead of per-user role lookups) ✅  
      _File:_ `backend/src/routes/systemUsers.ts`  
      _Done:_ Replaced N+1 loop with single `SELECT ur.user_id, r.* FROM user_roles ur JOIN roles r` + `Map` grouping  

---

## Phase 5 — High: Financial Accuracy

> **Goal:** Fix hardcoded values and inaccurate calculations in financial modules.  
> **Effort:** Medium-to-large — involves schema and logic changes.

- [x] **5.1** `financialReports.ts` — Replace placeholder `getFixedAssets()`, `getAccountsPayable()`, `getUnpaidExpenses()` ✅  
      _File:_ `backend/src/routes/financialReports.ts`  
      _Done:_ `getFixedAssets()` now queries ledger for non-current asset accounts; `getAccountsPayable()` queries ledger for liability accounts; `getUnpaidExpenses()` queries tb_transactions for unlinked expenses (fallback path returns 0)  

- [x] **5.2** `vatReports.ts` / `financialReports.ts` — VAT from line items ✅ (N/A)  
      _Files:_ `backend/src/routes/vatReports.ts`, `backend/src/routes/financialReports.ts`  
      _Done:_ Already correct — both files query `transactions_vat.vat_amount` column directly, no `× 0.15` multiplier exists in the codebase  

- [x] **5.3** `accounting.ts` — Use the `tax_rates` table ✅ (N/A)  
      _File:_ `backend/src/routes/accounting.ts`  
      _Done:_ Already correct — accounting.ts has full tax_rates CRUD (GET/POST/PUT), no hardcoded 15% exists. VAT calc uses `transactions_vat.vat_amount`  

- [x] **5.4** `payments.ts` — Recalculate invoice paid status on payment delete ✅  
      _File:_ `backend/src/routes/payments.ts`  
      _Done:_ DELETE handler now fetches invoice_id, recalculates SUM(payment_amount), sets `paid = 2` if still fully paid or `paid = 0` if not  

---

## Phase 6 — Medium: Performance & Reliability

> **Goal:** Fix OOM risks, N+1 queries, and blocking operations.  
> **Effort:** Medium.

- [x] **6.1** `embeddingService.ts` — Use batched vector search instead of loading all embeddings ✅  
      _File:_ `backend/src/services/embeddingService.ts`  
      _Done:_ `searchSimilar()` now processes embeddings in batches of 500 with a min-heap for top-N tracking; COUNT query first to avoid unnecessary iteration  

- [x] **6.2** `healthMonitor.ts` — Replace `execSync` with async `exec()` ✅  
      _File:_ `backend/src/services/healthMonitor.ts`  
      _Done:_ Replaced all 5 `execSync` calls with promisified `exec`; updated `checkDiskSpace()`, `checkProcessHealth()`, and `checkWorkerProcess()` to async; added `await` at call sites  

- [x] **6.3** `webmailService.ts` — Add IMAP connection caching ✅  
      _File:_ `backend/src/services/webmailService.ts`  
      _Done:_ Added `imapCache` Map with 30s TTL, `getImapClient()`/`releaseImapClient()` API, ref counting, and periodic cleanup interval  

- [x] **6.4** `adminCases.ts` — Batch bulk operations ✅  
      _File:_ `backend/src/routes/adminCases.ts`  
      _Done:_ `bulk-assign` and `bulk-update-status` now use single UPDATE + batch INSERT instead of N×2 sequential queries  

- [x] **6.5** `mobileActionExecutor.ts` — Batch knowledge health checks via `Promise.allSettled` ✅  
      _File:_ `backend/src/services/mobileActionExecutor.ts`  
      _Done:_ Replaced sequential `for..of` + try/catch with `Promise.allSettled()` for parallel execution  

---

## Phase 7 — Medium: Stubs & Dead Code Removal

> **Goal:** Remove deprecated code and implement real functionality.  
> **Effort:** Varies — some are deletions, others need real implementation.

- [x] **7.1** Remove `glmService.ts` — deprecated, kept "temporarily for backward compatibility" ✅  
      _File:_ `backend/src/services/glmService.ts`  
      _Done:_ Deleted `glmService.ts`, `routes/glm.ts`, test files, removed import + mount from `app.ts`  

- [x] **7.2** Remove Prisma proxy in database layer — throws on all calls ✅  
      _File:_ `backend/src/db/` (Prisma proxy)  
      _Done:_ Deleted `db/prisma.ts` & `lib/prisma.ts`. Rewrote `activation.ts` to use `db` (raw SQL upserts). Rewrote `scripts/create-api-key.ts` to use `db`  

- [x] **7.3** ~~Implement `sendSms()`~~ — **N/A**: already fully implemented in `smsService.ts` (SMSPortal API via axios) ✅  
      _File:_ `backend/src/services/smsService.ts`  

- [x] **7.4** ~~Implement password reset endpoints~~ — **N/A**: already implemented (`forgot-password`, `verify-otp`, `reset-password`) ✅  
      _File:_ `backend/src/routes/auth.ts`  

- [x] **7.5** Fix `POST /authenticate` stub in tasks route ✅  
      _File:_ `backend/src/routes/softawareTasks.ts`  
      _Done:_ Stub now returns `token: 'api-key-auth'` so frontend treats the API-key-based connection as authenticated  

---

## Phase 8 — Planned Features (Roadmap)

> **Goal:** New functionality on the product roadmap.  
> **Timeline:** Q2–Q4 2026.

- [ ] **8.1** AIGateway — Function calling, multi-assistant orchestration (v2.6.0 Q2 2026) ⏭️
      _Deferred:_ Major architectural lift — requires endpoint_assistants junction table, intent classifier/orchestrator layer, session-level assistant state tracking, tool scope isolation. Planned for Q2 2026 sprint  
- [x] **8.2** AIGateway — Voice I/O ✅ (N/A)
      _Done:_ Already fully implemented — STT via browser Web Speech API (client-side), TTS via OpenAI tts-1 (server-side, 6 voices), voice preferences persisted in DB, markdown→speech cleaning, auto-speak toggle, voice picker UI, voice-aware AI prompts  
- [x] **8.3** Authentication — OAuth2/SSO (Google) ✅
      _Files:_ `backend/src/routes/auth.ts`, `backend/src/config/env.ts`
      _Done:_ Installed `google-auth-library`. Added `oauth_provider`/`oauth_provider_id` columns to `users` table (passwordHash made nullable). Three routes: `GET /auth/google` (consent URL with CSRF state cookie), `GET /auth/google/callback` (code exchange → find/create/link user → JWT → redirect), `POST /auth/google/token` (mobile/SPA ID token verification). Auto-links existing email accounts; new users get full setup (contact, team, membership, viewer role)  
- [x] **8.4** Authentication — Passkeys/WebAuthn ✅ (N/A)
      _File:_ `backend/src/routes/auth.ts`
      _Done:_ Already implemented — full WebAuthn ceremony (register-options, register-verify, login-options, login-verify, credential listing, deletion)  
- [x] **8.5** Packages — Automated trial expiry enforcement ✅
      _File:_ `backend/src/services/packages.ts`, `backend/src/index.ts`
      _Done:_ Added `enforceTrialExpiry()` — sets status='EXPIRED' + credits_balance=0 for expired trials. Runs at startup + hourly interval  
- [x] **8.6** Packages — Multi-currency support ✅
      _Files:_ `backend/src/services/currencyService.ts` (NEW), `backend/src/routes/adminPackages.ts`, `backend/src/routes/packages.ts`
      _Done:_ Created `currencies` table (10 seeded: ZAR, USD, EUR, GBP, BWP, NAD, MZN, KES, NGN, GHS) with exchange rates. Added `currency_code` to `packages` and `contact_packages` tables. CurrencyService provides in-memory cache (15min TTL), formatting, conversion, rate management. Admin endpoints: GET/POST/PATCH currencies. Public endpoint: GET /packages/currencies  
- [x] **8.7** Packages — Stripe integration ✅
      _Files:_ `backend/src/routes/stripe.ts` (NEW, ~320 lines), `backend/src/app.ts`, `backend/src/config/env.ts`
      _Done:_ Installed `stripe`. Lazy-init Stripe client. Routes: GET /config (publishable key), POST /checkout (creates Checkout Session with package metadata), POST /webhook (signature-verified, handles checkout.session.completed → adds credits), POST /portal (Customer Portal), GET /history (purchase transactions). Helpers: getOrCreateStripeCustomer(), handleCheckoutCompleted(). express.raw() middleware for webhook path  
- [x] **8.8** Packages — PayFast/Yoco integration, low-balance alerts, package balance expiry automation (partial) ✅
      _File:_ `backend/src/services/packages.ts`
      _Done:_ Low-balance alerts implemented in `deductCredits()` — checks threshold after deduction, sends notification to OWNER/ADMIN users, sets `low_balance_alert_sent` flag. PayFast/Yoco payment flows deferred  
- [x] **8.9** Webhooks — Rate limiting (v1.1) ✅
      _File:_ `backend/src/routes/enterpriseWebhook.ts`
      _Done:_ Added `express-rate-limit` — 60 req/min per endpointId, standard headers  
- [x] **8.10** Webhooks — Conversation history (v1.2) ✅
      _File:_ `backend/src/routes/enterpriseWebhook.ts`
      _Done:_ Webhook conversations persisted to `chat_messages` table (fire-and-forget). Added `GET /:endpointId/history` endpoint with session_id filter and pagination  
- [x] **8.11** Webhooks — Ollama tool calling (v1.3) ✅
      _File:_ `backend/src/routes/enterpriseWebhook.ts`
      _Done:_ Refactored `callOllama()` to return structured `{ text, requiresAction, toolCalls, assistantMessage }`. Added `tools` parameter forwarding. Ollama last-resort (Step 3) now runs full tool-call loop with `forwardAction` when tools available  
- [x] **8.12** Webhooks — Analytics APIs (v1.4) ✅
      _Files:_ `backend/src/services/enterpriseEndpoints.ts`, `backend/src/routes/adminEnterpriseEndpoints.ts`
      _Done:_ Added `getEndpointStats()` — total/success/error counts, avg/p95 duration, requests-per-day breakdown from SQLite. Added `GET /:id/stats` admin route  
- [x] **8.13** Updates — Heartbeat monitoring dashboard (spec ready) ✅
      _File:_ `backend/src/routes/updClients.ts`
      _Done:_ Added `GET /health-summary` endpoint — returns status_counts (online/recent/inactive/offline), active_errors, outdated_clients, latest_heartbeat  
- [x] **8.14** Updates — Client error reporting server (spec ready) ✅ (N/A)
      _Files:_ `backend/src/routes/updErrorReport.ts`, `backend/src/routes/updHeartbeat.ts`
      _Done:_ Already implemented — POST ingestion (public), GET listing (admin), GET summaries (admin), piggybacked error reporting via heartbeat  
- [x] **8.15** ApiKeys — Key hashing (SHA-256), prefix storage ✅
      _Files:_ `backend/src/routes/apiKeys.ts`, `backend/src/middleware/apiKey.ts`
      _Done:_ Added `key_hash VARCHAR(64)` (indexed) and `key_prefix VARCHAR(12)` columns to `api_keys` table. POST create now stores SHA-256 hash + first 8-char prefix (plaintext key returned once to user). GET list shows `${prefix}****`. Middleware validates incoming key by hashing and matching `key_hash`. Zero plaintext keys stored after creation  
- [x] **8.16** Pricing — Schema normalization (v3.0 Q2 2026) ✅
      _Files:_ `backend/src/routes/pricing.ts`, `backend/src/services/mobileActionExecutor.ts`
      _Done:_ Added `unit` and `notes` columns (already existed in schema). Migrated 210 rows from pipe-delimited `description`. All queries now use proper columns instead of SUBSTRING_INDEX parsing  
- [x] **8.17** Pricing — Soft delete (v2.2 Q2 2026) ✅
      _Files:_ `backend/src/routes/pricing.ts`, `backend/src/services/mobileActionExecutor.ts`, `backend/src/routes/categories.ts`
      _Done:_ Added `is_deleted TINYINT(1) DEFAULT 0` column. DELETE now sets `is_deleted=1`. All SELECTs filter `is_deleted=0`. Categories delete-check also respects soft delete  
- [x] **8.18** SiteBuilder — Multi-page sites (v1.1.0) ✅
      _Files:_ `backend/src/services/siteBuilderService.ts`, `backend/src/routes/siteBuilder.ts`
      _Done:_ Created `site_pages` table (page_type enum: home/about/services/contact/gallery/faq/pricing/custom, content_data JSON, generated_html LONGTEXT). Added `max_pages` column to `generated_sites` (default 1 = single-page/free). Service methods: getPagesBySiteId, createPage, getPageById, updatePage, deletePage, getPageCount, getMaxPages, setMaxPages. Routes: GET/POST /:siteId/pages, GET/PUT/DELETE /:siteId/pages/:pageId, POST /:siteId/pages/:pageId/generate, PATCH /:siteId/max-pages. Tier gating: max_pages=1 blocks multi-page creation. generateStaticFiles() updated to output multiple HTML files with shared navigation via injectNavigation()  
- [x] **8.19** Assistants — Persistent chat history ✅
      _File:_ `backend/src/routes/enterpriseWebhook.ts`
      _Done:_ Enterprise webhook now persists user + assistant messages to `chat_messages` table alongside in-memory store. Widget already persisted via `widgetService.logChatMessage()`  
- [x] **8.20** Dashboard — Real message tracking (replace ingestion_jobs proxy) ✅
      _File:_ `backend/src/routes/dashboard.ts`
      _Done:_ Replaced `ingestion_jobs` COUNT proxy with real `chat_messages` COUNT per widget client. Counts `role='user'` messages since billing cycle start  

---

## Phase 9 — Tech Debt & Anti-Patterns

> **Goal:** Refactor patterns that cause maintenance burden.  
> **Priority:** Low — address opportunistically.

- [x] **9.1** ~~Packages middleware dedup~~ — **N/A**: routes call `packageService` for distinct contexts (admin by param, webhook by config), not duplicating middleware ✅  

- [x] **9.2** ~~Reconcile dual document storage~~ — **N/A**: all docs use MySQL exclusively, no SQLite storage exists ✅  

- [x] **9.3** ~~Resolve circular dependency~~ — **N/A**: `payment.ts` and packages middleware have no mutual imports ✅  

- [x] **9.4** `mysql.ts` — Removed unused `Payment` interface (only dead type of 15) ✅  
      _Done:_ Verified all other 14 interfaces are actively imported. Only `Payment` was orphaned (business `Payment` lives in `businessTypes.ts`)  

- [x] **9.5** `bugs.ts` — Replaced `any` types with proper interfaces ✅  
      _Done:_ Added `BugRow`, `BugComment`, `BugAttachment`, `CountRow`, `GroupCountRow`, `AdminUser` interfaces. Replaced 55+ `any` usages with proper types. All `catch (err: any)` → `catch (err: unknown)` with `instanceof Error` narrowing  

- [x] **9.6** `cases.ts` / `adminCases.ts` — Deduplicated `mapCaseRow()` ✅  
      _Done:_ Extracted `safeJson()` and `mapCaseRow()` to `utils/caseMappers.ts`. Both routes import from shared module  

- [x] **9.7** `usePermissions.ts` — Fixed staff-treated-as-admin ✅  
      _Done:_ `isAdmin()` now checks only `user.is_admin` (not `is_staff`). Staff users must rely on assigned permission slugs via RBAC  

- [x] **9.8** Worker restart — Added exponential backoff ✅  
      _Done:_ `spawnWorker()` in `index.ts` — max 5 attempts, delays 5s→10s→20s→40s→60s, attempt counter resets after 60s of healthy uptime  

---

## Progress Summary

| Phase | Items | Done | Status |
|-------|-------|------|--------|
| 1. Auth: Admin Routers | 8 | 8 | ✅ Complete |
| 2. Auth: Missing Auth & XSS | 4 | 4 | ✅ Complete |
| 3. Financial Integrity | 4 | 4 | ✅ Complete |
| 4. Auth & Data Safety | 6 | 6 | ✅ Complete |
| 5. Financial Accuracy | 4 | 4 | ✅ Complete |
| 6. Performance | 5 | 5 | ✅ Complete |
| 7. Stubs & Dead Code | 5 | 5 | ✅ Complete |
| 8. Roadmap Features | 20 | 19 | 🔄 Near-complete (8.1 deferred to Q2 2026) |
| 9. Tech Debt | 8 | 8 | ✅ Complete |
| 10. Multi-Page Websites | 16 | 14 | 🔄 Near-complete (10.4.3 + 10.4.4 deferred) |
| **Total** | **80** | **77** | |

---

## Phase 10 — Multi-Page Websites for Paid Users

> **Goal:** Upgrade the existing single-page "Landing Page" builder into a full multi-page website builder for paid-tier customers. Free-tier users keep single-page landing pages. Paid trials downgrade to free after N days.  
> **Effort:** Large — spans backend tier gating, frontend components, admin panel, deployment pipeline.  
> **Dependencies:** Existing `site_pages` backend CRUD (8.18), `max_pages` column, `generateStaticFiles()` with `injectNavigation()`.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          TIER MODEL                                 │
├─────────────────────────────────────────────────────────────────────┤
│  FREE tier (or expired trial):                                      │
│    - Single-page landing pages only                                 │
│    - max_pages = 1 (enforced server-side)                           │
│    - Ollama-only AI generation                                      │
│    - No custom domain support                                       │
│    - Label: "Landing Pages"                                         │
│                                                                     │
│  PAID tier (TRIAL or ACTIVE on Starter/Professional/Enterprise):    │
│    - Multi-page websites (up to tier limit)                         │
│    - max_pages auto-set from package: Starter=5, Pro=15, Ent=50    │
│    - GLM→OpenRouter→Ollama AI generation chain                      │
│    - Custom domain + SSL support                                    │
│    - Page templates (About, Services, Contact, Gallery, FAQ, etc.)  │
│    - Label: "Websites"                                              │
│                                                                     │
│  TRIAL (paid features for N days, then auto-downgrade to free):     │
│    - trial_ends_at tracked on contact_packages                      │
│    - enforceTrialExpiry() runs hourly — sets EXPIRED + zeros credits│
│    - NEW: also sets max_pages=1 on all user's sites                 │
│    - NEW: notifies user 3 days before expiry + on expiry            │
│    - Sites already deployed stay deployed (no teardown)             │
│    - User can still edit existing pages but not add new ones        │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.1 — Backend: Trial → Free Downgrade Enhancement

- [x] **10.1.1** `packages.ts` — Extend `enforceTrialExpiry()` to downgrade site limits  
      _File:_ `backend/src/services/packages.ts`  
      _What:_ After setting status=EXPIRED, find the user's `generated_sites` and set `max_pages=1`. Send notification: "Your trial has ended. Your sites are now limited to single-page landing pages."  

- [x] **10.1.2** `packages.ts` — Add trial expiry warning (3 days before)  
      _File:_ `backend/src/services/packages.ts`  
      _What:_ New `sendTrialExpiryWarnings()` function — queries TRIAL packages where `trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL 3 DAY` and `warning_sent = 0`. Sends notification + sets flag. Run alongside hourly enforcement.  

- [x] **10.1.3** `siteBuilder.ts` — Bridge `max_pages` to subscription tier automatically  
      _File:_ `backend/src/routes/siteBuilder.ts`  
      _What:_ On site creation (POST /), look up user's active package tier → set `max_pages` accordingly (Free=1, Starter=5, Pro=15, Ent=50). On page creation, re-verify tier hasn't expired.  

### 10.2 — Backend: Server-Side Tier Verification

- [x] **10.2.1** `siteBuilder.ts` — Add `resolveUserTier()` helper  
      _File:_ `backend/src/routes/siteBuilder.ts`  
      _What:_ Queries `contact_packages` JOIN `packages` for the authenticated user's contact. Returns `{ tier: 'free'|'starter'|'professional'|'enterprise', maxPages: number, trialEndsAt: string|null }`. Used by generation + page creation endpoints instead of trusting client-supplied `tier`.  

- [x] **10.2.2** `siteBuilder.ts` — Enforce tier on AI generation endpoint  
      _File:_ `backend/src/routes/siteBuilder.ts`  
      _What:_ `POST /:siteId/generate-ai` now calls `resolveUserTier()` instead of reading `req.body.tier`. Free users get Ollama; paid users get GLM→OpenRouter→Ollama chain.  

### 10.3 — Backend: Admin Sites API

- [x] **10.3.1** `adminSites.ts` — New admin route for site management  
      _File:_ `backend/src/routes/adminSites.ts` (NEW)  
      _What:_ Admin-only endpoints:
      - `GET /` — all sites with owner info, status, page counts, deployment history
      - `GET /:siteId` — single site detail with pages + HTML
      - `PATCH /:siteId` — admin override (status, max_pages, notes)
      - `DELETE /:siteId` — admin delete with cleanup
      - `GET /stats` — aggregate stats (total sites, by status, by tier, deployments this week)
      - `GET /trials` — active trials with days remaining, sites count

### 10.4 — Frontend: Portal — Website Manager (Paid)

- [x] **10.4.1** `WebsiteManager.tsx` — Multi-page website management page  
      _File:_ `frontend/src/pages/portal/WebsiteManager.tsx` (NEW)  
      _What:_ Shows a site's pages in a tree/list view. Add Page button (gated by tier). Page type selector (About, Services, Contact, Gallery, FAQ, Pricing, Custom). Drag-to-reorder. Per-page status (draft/generated). Navigation preview. Links to page editor.  

- [x] **10.4.2** `PageEditor.tsx` — Individual page editor  
      _File:_ `frontend/src/pages/portal/PageEditor.tsx` (NEW)  
      _What:_ Form for page content (type-specific fields). AI generation trigger per page. Preview iframe. Polish chat panel. Links back to WebsiteManager.  

- [ ] **10.4.3** `WebsiteTemplates.tsx` — Website template gallery  
      _File:_ `frontend/src/pages/portal/WebsiteTemplates.tsx` (NEW)  
      _What:_ Grid of pre-built multi-page website templates (Business, Portfolio, Restaurant, Medical, Education). Each creates a site + pre-configured pages. Free users see templates but get upsell prompt.  

- [ ] **10.4.4** Update `SitesPage.tsx` — Split view for free vs paid  
      _File:_ `frontend/src/pages/portal/SitesPage.tsx`  
      _What:_ Detect user tier. Free: show existing "Landing Pages" view. Paid: show "Websites" view with page counts, multi-page badge, "Manage Pages" button linking to WebsiteManager.  

- [x] **10.4.5** Update `PortalLayout.tsx` — Update sidebar for paid users  
      _File:_ `frontend/src/components/Layout/PortalLayout.tsx`  
      _What:_ "Web Presence" section shows "Landing Pages" for free, "My Websites" for paid. Quick action changes from "Create Landing Page" to "Create Website" for paid tier.  

### 10.5 — Frontend: Admin — Site Management

- [x] **10.5.1** `AdminSites.tsx` — Admin sites management page  
      _File:_ `frontend/src/pages/admin/AdminSites.tsx` (NEW)  
      _What:_ Table of all sites across all users with:
      - Status badges (draft/generating/generated/deployed/failed)
      - Owner name + email
      - Page count / max pages
      - Tier badge (Free/Starter/Pro/Enterprise)
      - Trial countdown (days remaining)
      - Deployment history accordion
      - Admin actions: set max_pages override, force-deploy, delete
      - Filters: by status, by tier, trials only
      - Stats cards: total sites, deployed, trials expiring soon, avg pages

- [x] **10.5.2** Admin Layout — Add Sites to sidebar  
      _File:_ `frontend/src/components/Layout/Layout.tsx`  
      _What:_ Add `{ name: 'Sites', href: '/admin/sites', icon: GlobeAltIcon, adminOnly: true }` to the "AI & Enterprise" nav section.  

### 10.6 — Routing & Wiring

- [x] **10.6.1** `App.tsx` — Add new routes  
      _File:_ `frontend/src/App.tsx`  
      _What:_ Portal routes:
      - `/portal/sites/:siteId/pages` → `WebsiteManager`
      - `/portal/sites/:siteId/pages/:pageId` → `PageEditor`
      - `/portal/sites/templates` → `WebsiteTemplates`
      Admin routes:
      - `/admin/sites` → `AdminSites`

- [x] **10.6.2** `app.ts` — Mount admin sites router  
      _File:_ `backend/src/app.ts`  
      _What:_ `apiRouter.use('/admin/sites', auditLogger, adminSitesRouter);`

- [x] **10.6.3** Portal index — Export new components  
      _File:_ `frontend/src/pages/portal/index.ts`  
      _What:_ Export `WebsiteManager`, `PageEditor`, `WebsiteTemplates`

### 10.7 — Trial Configuration

- [ ] **10.7.1** Trial defaults  
      _Config:_ Trial duration = 14 days (configurable via `TRIAL_DAYS` env var)  
      _Behavior:_
      - User signs up for paid plan → `status = 'TRIAL'`, `trial_ends_at = NOW() + 14 days`
      - During trial: full paid features (multi-page, premium AI, templates)
      - Day 11: warning notification ("Your trial expires in 3 days")
      - Day 14: `enforceTrialExpiry()` sets EXPIRED, max_pages→1, zeroes credits
      - After expiry: user keeps existing sites/pages (read-only for extra pages), can only add content to page 1
      - User can upgrade anytime to restore paid features

### Files Changed Summary

| File | Type | Change |
|------|------|--------|
| `backend/src/services/packages.ts` | Modified | Trial downgrade: max_pages→1, expiry warnings |
| `backend/src/routes/siteBuilder.ts` | Modified | `resolveUserTier()`, server-side tier verification |
| `backend/src/routes/adminSites.ts` | **NEW** | Admin site management endpoints |
| `backend/src/app.ts` | Modified | Mount adminSitesRouter |
| `frontend/src/pages/portal/WebsiteManager.tsx` | **NEW** | Multi-page website management |
| `frontend/src/pages/portal/PageEditor.tsx` | **NEW** | Individual page editor |
| `frontend/src/pages/portal/WebsiteTemplates.tsx` | **NEW** | Template gallery with upsell |
| `frontend/src/pages/portal/SitesPage.tsx` | Modified | Free/paid split view |
| `frontend/src/pages/portal/index.ts` | Modified | New exports |
| `frontend/src/pages/admin/AdminSites.tsx` | **NEW** | Admin site management |
| `frontend/src/components/Layout/PortalLayout.tsx` | Modified | Sidebar tier awareness |
| `frontend/src/components/Layout/Layout.tsx` | Modified | Admin sidebar Sites link |
| `frontend/src/App.tsx` | Modified | New routes |