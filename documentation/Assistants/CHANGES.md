# Assistants Module — Changelog & Known Issues

**Version:** 2.4.0  
**Last Updated:** 2026-03-14

---

## 1. Version History

| Date | Version | Description |
|------|---------|-------------|
| 2026-03-14 | 2.4.0 | Widget customization — inline chat UI (no iframe), theme color picker, proactive greeting toggle, custom welcome message, squircle FAB, cache busting, dark text input; frontend config UI in CreateAssistant.tsx |
| 2026-03-13 | 2.3.0 | Voice interaction awareness — VOICE INTERACTION section added to STAFF_CORE_DEFAULT and CLIENT_CORE_DEFAULT; AI no longer claims it "can't hear" users or formats responses with markdown when used via mobile voice |
| 2026-03-12 | 2.2.0 | AI Telemetry — POPIA-compliant anonymized chat analytics, PII sanitization, consent API, frontend consent modal with opt-out for paid users |
| 2026-03-10 | 2.1.0 | Task tools rewired — 22 tools (up from 4), dual-path architecture (local reads + proxy writes), source-level API keys, full lifecycle support |
| 2026-03-10 | 2.0.0 | Vision/multimodal support (image analysis), bidirectional voice (TTS + STT), image attachment UI |
| 2026-03-09 | 1.9.0 | GLM-first 3-tier routing (GLM→OpenRouter→Ollama), chat history sidebar, conversation preview API |
| 2026-03-09 | 1.8.0 | Tier-based OpenRouter routing for paid-tier assistant chat (portal + mobile) |
| 2026-03-08 | 1.7.0 | Chat persistence, SSE fixes, tool reliability (35/35), collation fix, model pre-warming, actionable errors |
| 2026-03-07 | 1.6.0 | Assistant UI customization — client capabilities panel, staff assistant view/form overhaul, tool inventory, webhook info |
| 2026-03-05 | 1.5.0 | Unified assistant model — both staff and clients create/manage assistants from mobile, primary assistant flag, auto-select |
| 2026-03-05 | 1.4.0 | Staff sandbox assistants — two-part prompt stitching, task proxy tools, assistant selection, software tokens |
| 2026-03-04 | 1.3.0 | Knowledge base editing — text content editing, source management, status badges |
| 2026-03-04 | 1.2.0 | AI categorization fixes — timeout increase, JSON parsing, knowledge health improvements |
| 2026-03-02 | 1.1.0 | Widget branding — brand favicon, header bar, powered-by footer |
| 2026-03-02 | 1.0.0 | Initial documentation — per-assistant dashboard health, delete with KB option |

---

| 2026-03-14 | 2.4.0 | Widget customization — inline chat UI (no iframe), theme color picker, proactive greeting toggle, custom welcome message, squircle FAB, cache busting, dark text input; frontend config UI in CreateAssistant.tsx |

---

## 1.5 v2.4.0 — Widget Customization & Inline Chat UI

**Date:** 2026-03-14  
**Scope:** Replace iframe-based widget with fully inline DOM chat, add theme color, proactive greeting toggle, custom welcome message, squircle FAB, and frontend configuration UI.

### Summary

The embeddable widget (`GET /api/assistants/widget.js`) was completely rewritten from an iframe-based approach to a fully inline DOM chat UI. This eliminates `X-Frame-Options` / `refused to connect` errors on third-party sites. The widget now supports configurable theme colors, proactive greeting tooltips, custom welcome messages, and an Android-style squircle FAB button. The frontend `CreateAssistant.tsx` wizard gained a "Widget Appearance & Behavior" configuration section with a toggle switch for proactive greetings.

### Changes — Database

| Migration | Table | Column | Type | Default | Purpose |
|-----------|-------|--------|------|---------|---------|
| Manual ALTER | assistants | `proactive_greeting` | TEXT NULL | NULL | Tooltip text near chat button |
| Manual ALTER | assistants | `proactive_delay` | INT NOT NULL | 5 | Seconds before tooltip appears |
| Manual ALTER | assistants | `theme_color` | VARCHAR(7) NULL | NULL | Hex color for widget gradient |

### Changes — Backend

#### Modified: `src/routes/assistants.ts` (~1,108 → ~1,541 LOC)

| Change | Detail |
|--------|--------|
| **`parseAssistantRow()`** | Added `customGreeting`, `proactiveGreeting`, `proactiveDelay`, `themeColor` to both JSON data path and column fallback |
| **`createAssistantSchema`** | Added `customGreeting` (string, optional), `proactiveGreeting` (string, optional), `proactiveDelay` (int ≥0, optional), `themeColor` (string, optional) |
| **`updateAssistantSchema`** | Same 4 fields + `themeColor` regex validation (`/^#[0-9a-fA-F]{6}$/`) |
| **POST /create** | INSERT includes `custom_greeting`, `proactive_greeting`, `proactive_delay`, `theme_color` columns |
| **PUT /:id/update** | UPDATE SET includes all 4 new columns; merge logic preserves existing values |
| **Widget script (complete rewrite)** | Replaced iframe with inline DOM: squircle button, chat container, SSE streaming via `fetch()` + `ReadableStream`, typing indicator, proactive tooltip, dynamic theming helpers (`darkenHex()`, `hexToRgba()`, `makeGradient()`, `applyTheme()`), custom greeting, dark text input |
| **Widget response headers** | Changed `Cache-Control` from `public, max-age=3600` to `no-cache, no-store, must-revalidate` |

#### Modified: `src/routes/assistants.js` (~980 → ~1,391 LOC)

| Change | Detail |
|--------|--------|
| All `.ts` changes | Mirrored identically in compiled `.js` file |

### Widget Script Architecture

The widget script is a template literal string (~500 lines) inside the `GET /widget.js` route handler. It's served dynamically with the `assistantId` injected from `data-assistant-id`.

**Key components built via DOM manipulation:**

| Component | Element | Purpose |
|-----------|---------|---------|
| `button` | `div#softaware-chat-button` | Squircle FAB (56×56, border-radius: 16px, pulse animation) |
| `proactiveBubble` | `div#softaware-proactive` | Tooltip near button (max-width: 260px, auto-dismiss 12s) |
| `chatContainer` | `div#softaware-chat-container` | Chat window (400×520px, fixed bottom-right) |
| `header` | `div` | Gradient header bar with assistant name + close button |
| `messagesDiv` | `div` | Scrollable message area |
| `inputRow` | `div` | Text input + send button |
| `footer` | `div` | "Powered by Soft Aware" link |

**Dynamic theming helpers:**

| Function | Purpose |
|----------|---------|
| `darkenHex(hex, pct)` | Darkens hex color by percentage for gradient "to" stop |
| `hexToRgba(hex, a)` | Converts hex to rgba string for box-shadow colors |
| `makeGradient()` | Returns `linear-gradient(135deg, themeFrom, themeTo)` |
| `applyTheme()` | Re-applies gradient + shadow to button, header, send button, pulse animation |

**SSE streaming chat flow:**

```
User types → fetch(POST /api/assistants/chat) with ReadableStream
  → Read chunks → TextDecoder → split by newlines
  → Parse JSON tokens → append to message bubble
  → Detect {done: true} → finalize message
  → Auto-scroll messages div
```

### Changes — Frontend

#### Modified: `src/pages/portal/CreateAssistant.tsx` (~1,259 → ~1,537 LOC)

| Change | Detail |
|--------|--------|
| **`FormData` interface** | Added `customGreeting: string`, `proactiveGreeting: string`, `proactiveDelay: number`, `themeColor: string` |
| **`proactiveEnabled` state** | New `useState<boolean>(false)` — controls toggle switch visibility |
| **`loadAssistant()`** | Populates all 4 new fields from API response; sets `proactiveEnabled` from `!!a.proactiveGreeting` |
| **`fullPayload`** | Sends `customGreeting`, `proactiveGreeting` (only if toggle ON), `proactiveDelay` (only if toggle ON, else 5), `themeColor` |
| **Step 1 UI** | New "Widget Appearance & Behavior" section with: color picker + 8 presets + reset, custom greeting input, proactive toggle switch, proactive text input (conditional), delay slider (conditional) |
| **Step 3 review** | Shows color swatch + hex, welcome message, proactive greeting with ● Enabled / ○ Disabled badge |

**Proactive toggle switch implementation:**

```tsx
<button
  type="button"
  role="switch"
  aria-checked={proactiveEnabled}
  onClick={() => {
    setProactiveEnabled(prev => !prev);
    if (proactiveEnabled) {
      setForm(prev => ({ ...prev, proactiveGreeting: '' }));
    }
  }}
  className={`... ${proactiveEnabled ? 'bg-picton-blue' : 'bg-gray-300'}`}
>
  <span className={`... ${proactiveEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
</button>
```

**Color picker presets:**

| Color | Label | Hex |
|-------|-------|-----|
| Indigo | Default | `#667eea` |
| Emerald | Green | `#10b981` |
| Amber | Orange | `#f59e0b` |
| Red | Red | `#ef4444` |
| Violet | Purple | `#8b5cf6` |
| Cyan | Teal | `#06b6d4` |
| Pink | Pink | `#ec4899` |
| Dark | Slate | `#1e293b` |

### Root Cause Analysis

The original widget used an iframe pointing to `softaware.net.za/chat/{id}`, which was blocked by the server's `X-Frame-Options` header returning "refused to connect" on third-party sites. The fix replaced the entire iframe approach with inline DOM construction + SSE streaming, eliminating any cross-origin embedding issues.

Additionally, the widget.js response had `Cache-Control: public, max-age=3600`, causing browsers to cache stale versions for up to 1 hour. Changed to `no-cache, no-store, must-revalidate`.

The widget's text input had white text on a white background because no explicit color was set. Fixed with `color: #1f2937; background: #fff;`.

### Verification

- ✅ Widget loads on third-party sites without iframe errors
- ✅ Theme color applied to FAB button, header, send button, pulse animation
- ✅ Proactive tooltip appears after configured delay, auto-dismisses after 12s
- ✅ Custom welcome message displayed as first chat bubble
- ✅ SSE streaming works with `fetch()` + `ReadableStream`
- ✅ Input text visible (dark on white background)
- ✅ Both `.ts` and `.js` files in sync
- ✅ `createAssistantSchema` and `updateAssistantSchema` include all 4 new fields
- ✅ CREATE and UPDATE SQL include all 4 new columns
- ✅ Frontend toggle switch controls proactive greeting visibility and save behavior
- ✅ No compile errors in any modified files

### Files Changed

| File | Changes | LOC |
|------|---------|-----|
| `src/routes/assistants.ts` | parseAssistantRow, schemas, CRUD SQL, widget script rewrite, cache headers | ~1,541 |
| `src/routes/assistants.js` | Mirror of all .ts changes | ~1,391 |
| `frontend/src/pages/portal/CreateAssistant.tsx` | FormData, proactiveEnabled state, loadAssistant, fullPayload, Step 1 widget config UI, Step 3 review | ~1,537 |

---

## 2.00 v2.3.0 — Voice Interaction Awareness

**Date:** 2026-03-13  
**Scope:** Fix two voice-related bugs: (1) AI says "I can't hear you" when user tests mic via voice, (2) TTS reads asterisks as the word "asterisk" because model outputs markdown.

### Summary

The mobile app uses speech-to-text to transcribe user voice into text, passes it to the AI, and reads the AI's text reply back via TTS. Two bugs emerged:

1. **"Can you hear me?" bug** — The `STAFF_CORE_DEFAULT` and `CLIENT_CORE_DEFAULT` prompt constants in `mobileAIProcessor.ts` had no mention of the voice pipeline. When a user said "can you hear me?" the model responded literally: "I'm a text-only model, I can't hear you." In reality, the user's voice IS transcribed and the reply IS spoken back.

2. **Asterisk/markdown bug** — Without instructions to avoid markdown, the model formatted responses with `**bold**`, `* bullets`, and `#` headers. While `stripMarkdownForSpeech()` strips most of these, some patterns (especially when the model writes the `*` character mid-sentence) result in TTS reading "asterisk" aloud.

Both bugs had the same root cause: the compiled `.js` files were stale and missing the VOICE INTERACTION section that existed in the `.ts` source.

### Changes — Backend

#### Modified: `src/services/mobileAIProcessor.ts` (~387 → ~418 LOC)

| Change | Detail |
|--------|--------|
| **`STAFF_CORE_DEFAULT`** | Added `VOICE INTERACTION:` section (6 rules) — tells AI it receives voice via STT, responds via TTS, should never claim it "can't hear", must avoid markdown formatting, use commas/periods for pauses, and say "dash" instead of hyphen markers |
| **`CLIENT_CORE_DEFAULT`** | Added matching `VOICE INTERACTION:` section (5 rules) — same voice awareness but slightly shorter |
| **Compiled `.js` sync** | Both `.ts` constants and `.js` compiled output now include the VOICE INTERACTION section |

**`STAFF_CORE_DEFAULT` additions:**

```
VOICE INTERACTION:
- Users interact with you via voice (speech-to-text). Your replies are read aloud via text-to-speech.
- If someone says "can you hear me?", "is this working?", "hello?", or tests their mic — YES, you can
  receive their voice input. Respond warmly: "Yes, I can hear you! How can I help?"
- Do NOT say you are text-only, cannot hear, or lack audio capabilities.
- Do NOT use markdown formatting (no asterisks, underscores, hash symbols, backticks, or bullet symbols).
  Write in plain natural sentences since your response will be spoken aloud.
- Use commas and periods for pauses instead of bullet points or numbered lists.
- Say "dash" or skip the character entirely instead of using hyphens as list markers.
```

**`CLIENT_CORE_DEFAULT` additions:**

```
VOICE INTERACTION:
- Users interact with you via voice (speech-to-text). Your replies are read aloud via text-to-speech.
- If someone says "can you hear me?", "is this working?", or tests their mic — YES, respond warmly.
- Do NOT say you are text-only or cannot hear.
- Do NOT use markdown formatting (no asterisks, hash symbols, backticks, or bullet symbols).
- Use commas and periods for pauses instead of bullet points or numbered lists.
```

### Root Cause Analysis

The project does not use `outDir` in `tsconfig.json` — compiled `.js` files sit alongside `.ts` source files. PM2 runs the `.js` files. When the `.ts` source was updated with the VOICE INTERACTION section (during v2.0.0 bidirectional voice work), the `.js` files were not recompiled. The stale `.js` had the old prompts without any voice awareness.

### Verification

- ✅ `STAFF_CORE_DEFAULT` in `.js` contains "VOICE INTERACTION" (6 rules)
- ✅ `CLIENT_CORE_DEFAULT` in `.js` contains "VOICE INTERACTION" (5 rules)
- ✅ `node -c src/services/mobileAIProcessor.js` passes syntax check
- ✅ `node -c src/utils/stripMarkdown.js` passes syntax check
- ✅ Both `.ts` and `.js` now in sync

### Files Changed

| File | Changes | LOC |
|------|---------|-----|
| `src/services/mobileAIProcessor.ts` | Already had VOICE INTERACTION (source of truth) | 418 |
| `src/services/mobileAIProcessor.js` | Synced: added VOICE INTERACTION to both core defaults, removed duplicate dangling blocks | 297 |

---

## 2.0 v2.2.0 — AI Telemetry (POPIA-Compliant Analytics)

**Date:** 2026-03-12  
**Scope:** Anonymized AI chat logging across all 3 chat routes, PII sanitization, MySQL consent tracking, frontend consent modal with paid-user opt-out

### Summary

All AI chat interactions (portal SSE chat, widget chat, enterprise webhooks) are now logged to a SQLite analytics table with full PII sanitization. Personal data — email addresses, South African phone numbers, SA ID numbers, credit card numbers, account numbers, and street addresses — is automatically stripped from prompts and responses before storage. Users must accept a telemetry consent modal before creating their first assistant. Paid-tier users get an additional opt-out toggle.

### Changes — Backend

**NEW: `src/utils/analyticsLogger.ts` (~160 LOC):**

| Export | Purpose |
|--------|---------|
| `sanitizeText(text)` | Strips PII via regex: emails → `[EMAIL REMOVED]`, SA phones → `[PHONE REMOVED]`, SA IDs (13 digits) → `[SA_ID REMOVED]`, credit cards → `[CARD REMOVED]`, account numbers → `[ACCOUNT REMOVED]`, street addresses → `[ADDRESS REMOVED]` |
| `logAnonymizedChat(clientId, rawPrompt, rawResponse, options?)` | Fire-and-forget SQLite insert into `ai_analytics_logs`. Options: `source` (portal/widget/enterprise), `model`, `provider`, `durationMs` |

- Auto-creates `ai_analytics_logs` table in `/var/opt/backend/data/vectors.db` on first call
- All errors caught silently (fire-and-forget — never breaks chat flow)
- Uses `better-sqlite3` for synchronous writes

**NEW: `src/db/migrations/026_ai_telemetry.ts`:**

| Column Added | Table | Type | Default |
|-------------|-------|------|---------|
| `telemetry_consent_accepted` | `users` | TINYINT(1) | 0 |
| `telemetry_opted_out` | `users` | TINYINT(1) | 0 |
| `telemetry_consent_date` | `users` | DATETIME | NULL |

**MODIFIED: `src/routes/assistants.ts` (+80 LOC → ~1,108 LOC):**

| Change | Detail |
|--------|--------|
| Added import | `import { logAnonymizedChat } from '../utils/analyticsLogger.js'` |
| SSE chat telemetry | After stream completes, JOINs `users` table to check `telemetry_opted_out`; if not opted out, calls `logAnonymizedChat()` with source `'portal'` |
| `GET /telemetry-consent` | Returns `{ consent: { accepted, optedOut, consentDate }, assistantCount }` for authenticated user |
| `POST /telemetry-consent` | Accepts `{ accepted: boolean, optOut?: boolean }`, updates `users` table consent columns |

**MODIFIED: `src/routes/widgetChat.ts` (+5 LOC → ~338 LOC):**

| Change | Detail |
|--------|--------|
| Added import | `import { logAnonymizedChat } from '../utils/analyticsLogger.js'` |
| Widget chat telemetry | Calls `logAnonymizedChat(clientId, message, assistantMessage, { source: 'widget', model, provider })` before response |

**MODIFIED: `src/routes/enterpriseWebhook.ts` (+8 LOC → ~345 LOC):**

| Change | Detail |
|--------|--------|
| Added import | `import { logAnonymizedChat } from '../utils/analyticsLogger.js'` |
| Webhook telemetry | Step 9 (new): logs anonymized chat with source `'enterprise'`, model, provider, durationMs. Response send renumbered to step 10. |

### Changes — Frontend

**MODIFIED: `src/pages/portal/CreateAssistant.tsx` (+66 LOC → ~1,259 LOC):**

| Change | Detail |
|--------|--------|
| New imports | `ShieldCheckIcon`, `EyeSlashIcon` from Heroicons; `useAppStore` from Zustand |
| State additions | `showTelemetryModal`, `telemetryConsent` (loaded/accepted/optedOut/assistantCount), `telemetryOptOut`, `isPaidUser` |
| Consent check | `useEffect` on mount: `GET /api/assistants/telemetry-consent` — loads consent status |
| Modal intercept | `handleNext` at step 0 for new assistants: if consent not yet accepted, shows modal instead of proceeding |
| Consent modal | POPIA compliance info box, terms text (what is collected, what is sanitized), opt-out toggle for paid users, Cancel/Accept buttons |
| Consent submit | `POST /api/assistants/telemetry-consent` with accepted=true + optOut flag, then proceeds to `proceedWithSave()` |

### New Database Objects

**SQLite table `ai_analytics_logs`** (in vectors.db):

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, autoincrement |
| client_id | TEXT | User/client identifier |
| source | TEXT | `portal`, `widget`, or `enterprise` |
| sanitized_prompt | TEXT | PII-stripped user message |
| sanitized_response | TEXT | PII-stripped AI response |
| model | TEXT | LLM model used (nullable) |
| provider | TEXT | LLM provider used (nullable) |
| duration_ms | INTEGER | Request duration in ms (nullable) |
| created_at | TEXT | ISO timestamp (DEFAULT CURRENT_TIMESTAMP) |

**MySQL columns on `users` table** (migration 026):

| Column | Type | Description |
|--------|------|-------------|
| telemetry_consent_accepted | TINYINT(1) | 1 = user accepted telemetry terms |
| telemetry_opted_out | TINYINT(1) | 1 = paid user opted out of logging |
| telemetry_consent_date | DATETIME | When consent was given/updated |

### PII Sanitization Patterns

| Pattern | Regex | Replacement |
|---------|-------|-------------|
| Email addresses | `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` | `[EMAIL REMOVED]` |
| SA phone numbers | `/(?:\+27\|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g` | `[PHONE REMOVED]` |
| SA ID numbers | `/\b\d{13}\b/g` (13 consecutive digits) | `[SA_ID REMOVED]` |
| Credit cards | `/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g` | `[CARD REMOVED]` |
| Account numbers | `/\b\d{7,12}\b/g` (7–12 digits) | `[ACCOUNT REMOVED]` |
| Street addresses | `/\d+\s+[A-Z][a-z]+\s+(Street\|St\|Avenue\|Ave\|Road\|Rd\|Drive\|Dr\|Lane\|Ln\|Boulevard\|Blvd)/gi` | `[ADDRESS REMOVED]` |

### Verification

- ✅ Sent message with phone `0821234567`, email `john@test.com`, SA ID `9501015001087` — all stripped to `[PHONE REMOVED]`, `[EMAIL REMOVED]`, `[SA_ID REMOVED]`
- ✅ Portal SSE chat logs to `ai_analytics_logs` with source `'portal'`
- ✅ Widget chat logs with source `'widget'`
- ✅ Enterprise webhook logs with source `'enterprise'`
- ✅ Opted-out users (telemetry_opted_out=1) are NOT logged from portal chat
- ✅ Frontend consent modal shows before first assistant creation
- ✅ Paid users see opt-out toggle; free users do not
- ✅ Backend compiles clean, frontend compiles clean

---

## 2.1 v2.1.0 — Task Tools Rewired (Full Lifecycle Support)

**Date:** 2026-03-10  
**Scope:** Complete rewiring of staff AI assistant task tools from the broken v1.x pattern (per-user software tokens, 4 tools, external-only) to the new Tasks v2.0 architecture (source-level API keys, 22 tools, local DB reads + proxy writes).

### Summary

The 4 original task tools (`list_tasks`, `create_task`, `update_task`, `add_task_comment`) used a per-user software token from `staff_software_tokens` to proxy ALL operations to external APIs. This pattern was broken because: (1) the Tasks system was rewritten to use source-level API keys from `task_sources`, (2) tasks are now synced to a local `local_tasks` MySQL table, and (3) the old `/api/development/tasks/` endpoints no longer exist.

The rewiring replaces all 4 tools with 22 comprehensive tools organized into 7 categories:
- **Core CRUD** (5): list_tasks, get_task, create_task, update_task, delete_task
- **Comments** (2): get_task_comments, add_task_comment
- **Local Enhancements** (4): bookmark_task, set_task_priority, set_task_color, set_task_tags
- **Workflow Actions** (3): start_task, complete_task, approve_task
- **Stats & Queries** (3): get_task_stats, get_pending_approvals, get_task_tags
- **Sync** (2): sync_tasks, get_sync_status
- **Invoice Staging** (3): stage_tasks_for_invoice, get_staged_invoices, process_staged_invoices

### Architecture Change

```
OLD (v1.4.0 — broken):
  getStaffSoftwareToken(userId)
    → SELECT token FROM staff_software_tokens WHERE user_id = ?
  taskProxy(apiUrl, '/api/development/tasks/', 'Bearer', token)
    ❌ Per-user tokens — no longer used
    ❌ All operations hit external API — slow for reads
    ❌ Only 4 tools — minimal coverage

NEW (v2.1.0):
  READ:  Direct SQL to local_tasks table (synced data)
  WRITE: resolveTaskSourceForTools() → taskProxyV2(baseUrl, path, 'X-API-Key', apiKey)
  LOCAL: Direct SQL for bookmark/priority/tags/color (no external call)
    ✅ Source-level API keys from task_sources table
    ✅ Fast local reads — no external API call needed
    ✅ 22 tools — full task lifecycle coverage
    ✅ Local enhancements — bookmark, priority, tags, colors
    ✅ Sync integration — trigger/check syncs from voice
    ✅ Invoice staging — stage/review/process from voice
```

### Changes — Backend

#### Rewritten: `src/services/mobileTools.ts` (~1211 → ~1580 LOC)

| Change | Detail |
|--------|--------|
| **Removed** | 4 old task tool definitions (LIST_TASKS, CREATE_TASK, UPDATE_TASK, ADD_TASK_COMMENT) |
| **Added** | 22 new task tool definitions across 7 categories |
| **list_tasks** | Now supports: status, type, priority, workflow_phase, bookmarked, tag, search, assignedToMe, limit filters |
| **get_task** | New tool — full task detail display including priority, tags, bookmark, description, notes |
| **delete_task** | New tool — soft-delete with dirty flag |
| **get_task_comments** | New tool — fetch comments from external source |
| **bookmark_task** | New tool — toggle bookmark (local enhancement) |
| **set_task_priority** | New tool — set priority level (urgent/high/normal/low) |
| **set_task_color** | New tool — set/clear color label |
| **set_task_tags** | New tool — set tags (comma-separated, replaces existing) |
| **start_task** | New tool — start task (external workflow action) |
| **complete_task** | New tool — complete task (external workflow action) |
| **approve_task** | New tool — approve task (external workflow action) |
| **get_task_stats** | New tool — aggregated stats by status/type/phase |
| **get_pending_approvals** | New tool — list tasks awaiting approval |
| **get_task_tags** | New tool — list all unique tags in use |
| **sync_tasks** | New tool — trigger syncAllSources() |
| **get_sync_status** | New tool — sync metadata per source |
| **stage_tasks_for_invoice** | New tool — stage tasks for billing |
| **get_staged_invoices** | New tool — view staged tasks |
| **process_staged_invoices** | New tool — finalize billing |
| **software_id param** | create_task accepts optional software_id to target a specific source |
| **staffTaskTools array** | New separate array in getToolsForRole() for task tools |

#### Rewritten: `src/services/mobileActionExecutor.ts` (~2128 → ~2680 LOC)

| Change | Detail |
|--------|--------|
| **Removed** | `SoftwareTokenRow` interface, `getStaffSoftwareToken()`, `taskProxy()` |
| **Added** | `TaskSourceRow` interface, `resolveTaskSourceForTools()`, `taskProxyV2()`, `resolveLocalTask()` |
| **Auth pattern** | `X-API-Key` header with source-level key (was: `Authorization: Bearer` with per-user token) |
| **Read pattern** | Direct SQL queries to `local_tasks` table (was: HTTP GET to external API) |
| **Write pattern** | `taskProxyV2()` → external `/api/tasks-api/*` endpoints (was: `/api/development/tasks/`) |
| **Local pattern** | Direct SQL UPDATE for bookmark/priority/tags/color (no external call) |
| **resolveLocalTask()** | Resolves task by local DB `id` OR `external_id` — flexible ID handling |
| **Notifications** | Assignment notifications via `createNotificationWithPush` on task updates |
| **Post-create sync** | After create_task, triggers `syncAllSources()` fire-and-forget |
| **Graceful fallback** | If external proxy fails on update, local changes still persist (dirty flag) |
| **New imports** | `syncAllSources` from taskSyncService, `createNotificationWithPush` from firebaseService |
| **22 new switch cases** | Full dispatch table for all task operations |

### Changes — Frontend

#### Updated: `src/pages/general/Profile.tsx`

| Change | Detail |
|--------|--------|
| **Task Management category** | Tools list expanded from 4 to 15 display items |
| **Category description** | Updated: "Full task lifecycle — CRUD, workflow, local enhancements, sync & invoicing" |
| **Tool count** | All hardcoded "41 tools" references updated to "59 tools" |
| **totalTools computed** | Auto-calculated from STAFF_TOOL_CATEGORIES — accurately reflects new count |

### Changes — Documentation

| File | Change |
|------|--------|
| `README.md` Section 3.6 | Updated tool counts: Staff 53 tools (22 task), Client 17 tools |
| `README.md` Section 3.7 | Complete rewrite — documents new dual-path architecture with all 22 tools |
| `README.md` Section 4.7 | Updated from 4 tools to 22, describes new auth pattern |
| `README.md` Section 4.10 | Updated tool counts in Staff Capabilities Dashboard |
| `README.md` Security table | Task proxy auth updated to source-level API key |
| `README.md` Key Statistics | Tool count 59, added task tables to MySQL table list |

---

## 1.9 v2.0.0 — Vision/Multimodal Support + Bidirectional Voice

**Date:** 2026-03-10  
**Scope:** Image analysis via GPT-4o / Gemini Flash / Ollama qwen2.5vl. Bidirectional voice with OpenAI neural TTS and browser STT. Image attachment UI in staff chat. Express body limit increased for base64 payloads.

### Summary

`assistantAIRouter.ts` extended from ~435 LOC to ~751 LOC with a full vision subsystem. When a user attaches an image, the router bypasses the text-only GLM pipeline and routes directly to vision-capable models: **GPT-4o → Gemini 2.0 Flash → Ollama qwen2.5vl:7b** (paid tier) or **Ollama qwen2.5vl:7b** (free tier). Images are sent as base64 data-URIs in the OpenAI `content[]` array format (OpenRouter) or Ollama's `images[]` field. The staff chat modal in `Profile.tsx` gains an image attach button (📎), preview strip, and automatic vision routing. A new `/api/v1/mobile/tts` endpoint provides OpenAI-compatible neural TTS for mobile voice output. Browser-native Web Speech API handles STT input.

### Changes — Backend

#### Extended: `src/services/assistantAIRouter.ts` (~435 → ~751 LOC)

| Change | Detail |
|--------|--------|
| **`VisionChatMessage` type** | Extends `ChatMessage` with `images?: string[]` — base64 data-URIs |
| **`ContentBlock` type** | Union of `{type:'text', text}` and `{type:'image_url', image_url:{url}}` for OpenAI/OpenRouter format |
| **`VisionProvider` type** | `'openrouter' \| 'openrouter-fallback' \| 'ollama-vision'` |
| **`stripDataUri()`** | Removes `data:image/*;base64,` prefix for Ollama (expects raw base64) |
| **`buildOpenRouterVisionMessages()`** | Converts messages to OpenAI `content[]` array format with `image_url` blocks |
| **`buildOllamaVisionMessages()`** | Converts messages to Ollama format with separate `images` field (raw base64) |
| **`openRouterVisionChat()` / `openRouterVisionStream()`** | Non-streaming / streaming calls to OpenRouter with vision models |
| **`ollamaVisionChat()` / `ollamaVisionStream()`** | Non-streaming / streaming calls to Ollama with vision model |
| **`chatCompletionWithVision()`** | Non-streaming, tier-based fallback: Paid → OpenRouter GPT-4o → Gemini Flash → Ollama qwen2.5vl; Free → Ollama qwen2.5vl |
| **`chatCompletionStreamWithVision()`** | Streaming variant with same tier-based fallback chain |
| **3 new env vars** | `VISION_OLLAMA_MODEL`, `VISION_OPENROUTER_MODEL`, `VISION_OPENROUTER_FALLBACK` |

#### Modified: `src/routes/assistants.ts` (~996 → ~1028 LOC)

| Change | Detail |
|--------|--------|
| **Import** | Added `chatCompletionStreamWithVision`, `VisionChatMessage` |
| **`chatRequestSchema`** | Added `image: z.string().optional()` field |
| **Vision detection** | `hasImage = typeof image === 'string' && image.startsWith('data:image/')` |
| **Vision routing** | When `hasImage`, builds `VisionChatMessage[]` with `images` on last user message, routes to `chatCompletionStreamWithVision()` |
| **Stream parser** | Extended: `provider === 'openrouter-fallback'` → OpenAI SSE; default (includes `ollama-vision`) → NDJSON |

#### Modified: `src/services/mobileAIProcessor.ts` (~385 → ~387 LOC)

| Change | Detail |
|--------|--------|
| **Import** | Added `chatCompletionWithVision`, `VisionChatMessage` |
| **`MobileIntentRequest`** | Added `image?: string` field |
| **Vision routing** | On round 0, if `hasImage`, routes to `chatCompletionWithVision()` instead of text `chatCompletion()` |
| **Debug logging** | `[MobileAI] Image attached (XXkB base64), routing to vision model` |

#### Modified: `src/routes/mobileIntent.ts` (~241 → ~338 LOC)

| Change | Detail |
|--------|--------|
| **Image extraction** | Destructures `image` from `req.body` |
| **Validation** | Must be `data:image/*` format; max 15M chars (~10MB base64) |
| **Pass-through** | `image` included in `processMobileIntent()` request object |

#### Modified: `src/config/env.ts`

| Change | Detail |
|--------|--------|
| **`VISION_OLLAMA_MODEL`** | New env var — `z.string().default('qwen2.5vl:7b')` |
| **`VISION_OPENROUTER_MODEL`** | New env var — `z.string().default('openai/gpt-4o')` |
| **`VISION_OPENROUTER_FALLBACK`** | New env var — `z.string().default('google/gemini-2.0-flash-001')` |

#### Modified: `src/app.ts`

| Change | Detail |
|--------|--------|
| **Body limit** | `express.json({ limit: '20mb' })` (was `10mb`) — accommodates base64-encoded images |

### Changes — Frontend

#### Modified: `src/pages/general/Profile.tsx` (~1858 → ~2227 LOC)

| Change | Detail |
|--------|--------|
| **New imports** | `PaperClipIcon`, `PhotoIcon` from `@heroicons/react` |
| **`attachedImage` state** | Base64 data-URI of attached image |
| **`attachedImageName` state** | Display filename of attached image |
| **`fileInputRef`** | Hidden `<input type="file" accept="image/*">` ref |
| **`handleFileSelect()`** | Validates image/*, max 10MB, reads via FileReader → base64 |
| **`removeAttachedImage()`** | Clears image state |
| **Image preview strip** | Blue gradient bar above input showing thumbnail + filename + remove ✕ |
| **📎 Attach button** | Between mic button and textarea in chat input area |
| **Send with image** | `sendChatMessage()` captures image, sends via `MobileModel.sendIntent()`, clears after send |
| **Default prompt** | If image attached with no text, defaults to "What is in this image?" |
| **📎 in chat bubbles** | Messages starting with `📎` render PhotoIcon + filename + optional text |

#### Modified: `src/models/SystemModels.ts`

| Change | Detail |
|--------|--------|
| **`MobileIntentRequest`** | Added `image?: string` field with JSDoc comment |

### Vision Routing Matrix (v2.0.0)

| Caller | Tier | Fallback Chain | Stream Format |
|--------|------|----------------|---------------|
| Portal chat (`assistants.ts`) — with image | free | Ollama qwen2.5vl:7b | NDJSON |
| Portal chat (`assistants.ts`) — with image | paid | OpenRouter GPT-4o → Gemini Flash → Ollama qwen2.5vl:7b | OpenAI SSE / NDJSON |
| Mobile intent (`mobileAIProcessor.ts`) — with image | free | Ollama qwen2.5vl:7b | Non-streaming |
| Mobile intent (`mobileAIProcessor.ts`) — with image | paid | OpenRouter GPT-4o → Gemini Flash → Ollama qwen2.5vl:7b | Non-streaming |
| Portal/Mobile — text only | free | GLM → Ollama (unchanged from v1.9.0) | Anthropic SSE / NDJSON |
| Portal/Mobile — text only | paid | GLM → OpenRouter → Ollama (unchanged from v1.9.0) | Anthropic SSE / OpenAI SSE / NDJSON |

### Vision Provider Details

| Provider | API Style | Model | Image Format | Auth |
|----------|-----------|-------|--------------|------|
| **OpenRouter (primary)** | OpenAI Chat Completions | `openai/gpt-4o` | `content[]` array with `image_url` blocks (data-URI) | `Authorization: Bearer` |
| **OpenRouter (fallback)** | OpenAI Chat Completions | `google/gemini-2.0-flash-001` | `content[]` array with `image_url` blocks (data-URI) | `Authorization: Bearer` |
| **Ollama (local)** | Ollama native | `qwen2.5vl:7b` | `images[]` field with raw base64 (no data-URI prefix) | None |

### .env Vision Configuration

| Variable | Default | Used By |
|----------|---------|---------|
| `VISION_OLLAMA_MODEL` | `qwen2.5vl:7b` | assistantAIRouter (free-tier vision + last resort) |
| `VISION_OPENROUTER_MODEL` | `openai/gpt-4o` | assistantAIRouter (paid-tier primary vision) |
| `VISION_OPENROUTER_FALLBACK` | `google/gemini-2.0-flash-001` | assistantAIRouter (paid-tier vision fallback) |

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|--------|
| `backend/src/services/assistantAIRouter.ts` | +316 | Vision subsystem — types, message builders, chat/stream functions, tier routing |
| `backend/src/routes/assistants.ts` | +32 | Image field in schema, vision detection, stream routing for vision providers |
| `backend/src/services/mobileAIProcessor.ts` | +2 | Image field, vision routing on round 0 |
| `backend/src/routes/mobileIntent.ts` | +97 | Image extraction, validation (type + size), pass-through |
| `backend/src/config/env.ts` | +3 | 3 new vision env vars with defaults |
| `backend/src/app.ts` | ~1 | Body limit 10mb → 20mb |
| `frontend/src/pages/general/Profile.tsx` | +369 | Image attach UI, preview, 📎 button, send-with-image, chat bubble rendering |
| `frontend/src/models/SystemModels.ts` | +1 | image field on MobileIntentRequest |
| **Total** | **~821** | |

### How to Send an Image (Code Example)

```typescript
import { chatCompletionWithVision, VisionChatMessage } from '../services/assistantAIRouter.js';

const tier = assistant.tier; // 'free' or 'paid'
const messages: VisionChatMessage[] = [
  { role: 'system', content: 'Describe what you see.' },
  { role: 'user', content: 'What is in this image?', images: ['data:image/png;base64,...'] },
];

const result = await chatCompletionWithVision(tier, messages);
// result.content  — the AI description of the image
// result.model    — e.g. 'openai/gpt-4o' or 'qwen2.5vl:7b'
// result.provider — 'openrouter' | 'openrouter-fallback' | 'ollama-vision'
```

For streaming, use `chatCompletionStreamWithVision()` and check `result.provider` to select the parser.

---

## 1.10 v1.9.0 — GLM-First 3-Tier Routing + Chat History Sidebar

**Date:** 2026-03-09  
**Scope:** Complete rewrite of the AI routing layer. GLM (ZhipuAI) via Anthropic-compatible API is now the primary provider for ALL tiers. Chat history sidebar added to staff assistant modal. Conversation list API returns first-message previews.

### Summary

`assistantAIRouter.ts` rewritten from ~130 LOC to ~435 LOC. The old 2-provider model (OpenRouter vs Ollama) is replaced with a 3-tier cascading fallback: **GLM → OpenRouter → Ollama** (paid) or **GLM → Ollama** (free). GLM uses the Anthropic-compatible Messages API at `api.z.ai/api/anthropic`. The SSE parser in `assistants.ts` now handles three stream formats (Anthropic, OpenAI, NDJSON). Default model changed to `glm-4.6`. Staff chat modal now includes a collapsible sidebar showing previous conversations with first-message previews.

### Changes — Backend

#### Rewritten: `src/services/assistantAIRouter.ts` (~130 → ~435 LOC)

| Change | Detail |
|--------|--------|
| **GLM provider** | New primary provider using Anthropic Messages API at `https://api.z.ai/api/anthropic/v1/messages`. Auth via `x-api-key` header. |
| **3-tier fallback** | Free: GLM→Ollama. Paid: GLM→OpenRouter→Ollama. Each step catches errors silently and falls to next. |
| **`buildGLMBody()`** | Extracts system message into top-level `system` field (Anthropic format). Maps remaining messages as user/assistant. |
| **`glmChat()` / `glmStream()`** | Non-streaming and streaming calls to GLM Anthropic endpoint. |
| **Key caching** | GLM key fetched once from credential vault (`service_name='GLM'`), cached in module-level variable. |
| **`PaidProvider` type** | New union type: `'glm' \| 'openrouter' \| 'ollama'` |
| **Return shape** | `chatCompletion()` now returns `{ content, model, provider }` instead of plain string |

#### Modified: `src/routes/assistants.ts`

| Change | Detail |
|--------|--------|
| **3-format SSE parser** | Now branches on `provider` field: `glm` → Anthropic SSE (`content_block_delta` events, `delta.text`), `openrouter` → OpenAI SSE (`choices[0].delta.content`), else → Ollama NDJSON (`message.content`) |
| **Done event** | Now includes `provider: 'glm' \| 'openrouter' \| 'ollama'` |

#### Modified: `src/services/ingestionAIRouter.ts` (100 → 138 LOC)

| Change | Detail |
|--------|--------|
| **GLM primary** | Content cleaning now tries GLM first (Anthropic Messages API), then OpenRouter, then Ollama |
| **Default model** | Hardcoded fallback changed from `glm-4.5-air` → `glm-4.6` |

#### Modified: `src/routes/mobileIntent.ts` (228 → 241 LOC)

| Change | Detail |
|--------|--------|
| **Conversation preview** | `GET /conversations` now includes `assistant_id` and a `preview` field (first user message via subquery) |

#### Modified: `.env`

| Change | Detail |
|--------|--------|
| **`GLM_MODEL`** | Changed from `glm-4.5-air` → `glm-4.6` (better capability, slightly slower) |

### Changes — Frontend

#### Modified: `src/pages/general/Profile.tsx` (1735 → 1858 LOC)

| Change | Detail |
|--------|--------|
| **Chat history sidebar** | New collapsible left panel (256px) in chat modal showing previous conversations with truncated first-message previews, relative timestamps, hover-reveal delete button, active-conversation highlight |
| **`loadConversations()`** | Fetches conversation list via `MobileModel.getConversations()`, filtered by current assistant |
| **`selectConversation()`** | Loads messages via `MobileModel.getMessages()`, populates chat, sets conversationId |
| **`handleDeleteConversation()`** | SweetAlert confirmation → `MobileModel.deleteConversation()` → removes from sidebar |
| **`formatRelativeTime()`** | Relative timestamps: "2m ago", "3h ago", "5d ago", or "12 Jun" |
| **Sidebar toggle** | Hamburger icon (Bars3Icon) in chat header toggles sidebar visibility |
| **Modal width** | Increased from `max-w-2xl` → `max-w-5xl` to accommodate sidebar |
| **New Chat button** | Header button changed from trash icon to PlusIcon |
| **New imports** | `ClockIcon`, `Bars3Icon`, `MobileConversation` type |

#### Modified: `src/models/SystemModels.ts`

| Change | Detail |
|--------|--------|
| **`MobileConversation`** | Added `preview: string \| null` field |

### Routing Matrix (v1.9.0)

| Caller | Tier | Fallback Chain | Stream Format |
|--------|------|----------------|---------------|
| Portal chat (`assistants.ts`) | free | GLM → Ollama | GLM: Anthropic SSE / Ollama: NDJSON |
| Portal chat (`assistants.ts`) | paid | GLM → OpenRouter → Ollama | GLM: Anthropic SSE / OR: OpenAI SSE / Ollama: NDJSON |
| Mobile intent (`mobileAIProcessor.ts`) | free | GLM → Ollama | Non-streaming |
| Mobile intent (`mobileAIProcessor.ts`) | paid | GLM → OpenRouter → Ollama | Non-streaming |
| Widget chat (`widgetChat.ts`) | paid | GLM → OpenRouter → Ollama | Non-streaming |
| Ingestion cleaning (`ingestionAIRouter.ts`) | paid | GLM → OpenRouter → Ollama | Non-streaming |

### Provider Details

| Provider | API Style | Base URL | Auth | Stream Format |
|----------|-----------|----------|------|---------------|
| **GLM (ZhipuAI)** | Anthropic Messages | `api.z.ai/api/anthropic/v1/messages` | `x-api-key` header | SSE: `content_block_delta` → `delta.text` |
| **OpenRouter** | OpenAI Chat Completions | `openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer` | SSE: `choices[0].delta.content` |
| **Ollama** | Ollama native | `127.0.0.1:11434/api/chat` | None | NDJSON: `message.content` per line |

### .env Model Configuration

| Variable | Value | Used By |
|----------|-------|---------|
| `GLM_MODEL` | `glm-4.6` | assistantAIRouter, ingestionAIRouter |
| `OPENROUTER_FALLBACK_MODEL` | `openai/gpt-4o-mini` | assistantAIRouter |
| `ASSISTANT_OLLAMA_MODEL` | `qwen2.5:1.5b-instruct` | assistantAIRouter (Ollama fallback) |

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|--------|
| `backend/src/services/assistantAIRouter.ts` | +305 | Complete GLM rewrite — Anthropic Messages API, 3-tier fallback |
| `backend/src/routes/assistants.ts` | ~40 | 3-format SSE parser (Anthropic/OpenAI/NDJSON) |
| `backend/src/services/ingestionAIRouter.ts` | +38 | GLM-first cleaning with Anthropic API |
| `backend/src/routes/mobileIntent.ts` | +13 | Conversation preview subquery, assistant_id in SELECT |
| `backend/.env` | ~1 | GLM_MODEL=glm-4.6 |
| `frontend/src/pages/general/Profile.tsx` | +123 | Chat history sidebar, conversation loading, delete |
| `frontend/src/models/SystemModels.ts` | +1 | preview field on MobileConversation |
| **Total** | **~521** | |

### How to Wire a New Feature with the Same Tiers

```typescript
import { chatCompletion } from '../services/assistantAIRouter.js';

const tier = assistant.tier; // 'free' or 'paid'
const result = await chatCompletion(tier, [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user',   content: userInput },
], { temperature: 0.5, max_tokens: 1024 });

// result.content  — the AI response text
// result.model    — which model answered (e.g. 'glm-4.6')
// result.provider — 'glm' | 'openrouter' | 'ollama'
```

For streaming, use `chatCompletionStream()` and check `result.provider` to select the correct parser.

---

## 1.8 v1.8.0 — Tier-Based OpenRouter Routing for Paid Assistants

**Date:** 2026-03-09  
**Scope:** Paid-tier assistant chat now routes through OpenRouter instead of local Ollama. Affects both portal SSE streaming chat and mobile intent processing. Free-tier assistants remain on Ollama.

### Summary

New `assistantAIRouter.ts` service provides centralized tier-based routing for all assistant chat. Paid-tier assistants (including all staff assistants, whose tier is forced to `paid`) now use OpenRouter for higher-quality responses. Free-tier assistants continue to use local Ollama. The router falls back gracefully to Ollama if no OpenRouter API key is available. The portal chat endpoint (`POST /api/assistants/chat`) now handles both Ollama NDJSON and OpenRouter SSE stream formats via a unified stream parser.

### Changes — Backend

#### New: `src/services/assistantAIRouter.ts` (~130 LOC)

| Export | Purpose |
|--------|---------|
| `chatCompletion(tier, messages, opts?, ollamaModel?)` | Non-streaming chat — used by `mobileAIProcessor.ts`. Returns assistant text string. |
| `chatCompletionStream(tier, messages, opts?, ollamaModel?)` | Streaming chat — used by `assistants.ts` POST /chat. Returns raw `Response` for caller to stream. |
| `shouldUseOpenRouter(tier)` | Returns `true` if tier is `paid` AND an OpenRouter key exists (via credentialVault or env fallback). |

Internal helpers: `ollamaChat()`, `openRouterChat()`, `ollamaChatStream()`, `openRouterChatStream()`. API key cached in module-level variable after first vault lookup.

#### Modified: `src/routes/assistants.ts`

| Change | Detail |
|--------|--------|
| **Import** | Added `{ chatCompletionStream, shouldUseOpenRouter }` from `assistantAIRouter.js` |
| **Chat handler** | Replaced hardcoded Ollama `axios.post()` streaming with `chatCompletionStream()`. Now uses `ReadableStream.getReader()` loop. |
| **Dual-format parser** | Handles both Ollama NDJSON (`{"message":{"content":"..."}}`) and OpenRouter SSE (`data: {"choices":[{"delta":{"content":"..."}}]}`) |
| **Done event** | Now includes `provider: 'ollama' | 'openrouter'` field |

#### Modified: `src/services/mobileAIProcessor.ts`

| Change | Detail |
|--------|--------|
| **Import** | Added `{ chatCompletion }` from `assistantAIRouter.js` |
| **Removed** | Local `ollamaChat()` function removed — replaced by centralized router |
| **SQL query** | `loadAssistantPromptData()` now SELECTs `COALESCE(tier,'free') AS tier` |
| **`AssistantPromptRow`** | Interface extended with `tier: string` field |
| **Tool-call loop** | `ollamaChat(messages, ollamaModel)` → `chatCompletion(assistantTier, messages, opts, ollamaModel)` |

#### Modified: `src/config/env.ts`

| Change | Detail |
|--------|--------|
| **`ASSISTANT_OPENROUTER_MODEL`** | New env var — `z.string().default('google/gemma-3-4b-it:free')` |

#### Modified: `.env`

| Change | Detail |
|--------|--------|
| **`ASSISTANT_OPENROUTER_MODEL`** | Set to `google/gemma-3-4b-it:free` |

### Routing Matrix

| Caller | Tier | Provider | Model | Stream Format |
|--------|------|----------|-------|--------------|
| Portal chat (assistants.ts) | free | Ollama | `ASSISTANT_OLLAMA_MODEL` | NDJSON |
| Portal chat (assistants.ts) | paid | OpenRouter | `ASSISTANT_OPENROUTER_MODEL` | SSE |
| Mobile intent (mobileAIProcessor.ts) | free | Ollama | `TOOLS_OLLAMA_MODEL` / preferred_model | JSON (non-stream) |
| Mobile intent (mobileAIProcessor.ts) | paid | OpenRouter | `ASSISTANT_OPENROUTER_MODEL` | JSON (non-stream) |

### Affected Assistant Types

| Type | Tier | Previous Provider | New Provider |
|------|------|-------------------|-------------|
| Client assistant (free) | free | Ollama | Ollama (no change) |
| Client assistant (paid) | paid | Ollama | **OpenRouter** |
| Staff sandbox assistant | paid (forced) | Ollama | **OpenRouter** |
| Enterprise webhook | — | OpenRouter | OpenRouter (no change) |

### Files Changed

- `src/services/assistantAIRouter.ts` — **NEW** — tier-based chat routing service
- `src/routes/assistants.ts` — chat handler rewritten for dual-provider streaming
- `src/services/mobileAIProcessor.ts` — `ollamaChat` replaced with `chatCompletion` from router
- `src/config/env.ts` — added `ASSISTANT_OPENROUTER_MODEL`
- `.env` — added `ASSISTANT_OPENROUTER_MODEL=google/gemma-3-4b-it:free`

---

## 1.7 v1.7.0 — Chat Persistence, Tool Reliability & Performance

**Date:** 2026-03-08  
**Scope:** Chat persistence (staff + client), SSE streaming fixes, 35/35 tool verification, collation bug fix, model pre-warming, actionable error messages, system prompt rule updates, UI refinements

### Summary

Major reliability and UX release. Staff and client chat messages now persist across modal open/close cycles. All 35 staff-accessible tools verified passing via automated test suite. Two collation-mismatch crashes fixed. All tool error messages rewritten to be actionable with dashboard navigation guidance. Ollama models pre-warmed on server startup. Default model switched from `gemma2:2b` to `qwen2.5:1.5b-instruct` (48% faster).

### Changes — Backend

#### Modified: `src/index.ts` (was 65 → now 108 LOC)

| Change | Detail |
|--------|--------|
| **`warmOllamaModels()`** | New async function — fires 1-token "hi" prompt at both Assistant and Tools models on startup. De-duplicates if both point to same model. Logs warm-up time. |
| **Startup log** | Now shows: `[Ollama] Assistant model: ${env.ASSISTANT_OLLAMA_MODEL} \| Tools model: ${env.TOOLS_OLLAMA_MODEL} \| keep_alive: ${env.OLLAMA_KEEP_ALIVE}` |

#### Modified: `src/config/env.ts`

| Change | Detail |
|--------|--------|
| `ASSISTANT_OLLAMA_MODEL` | Default changed from `gemma2:2b` → `qwen2.5:1.5b-instruct` |
| `LEADS_OLLAMA_MODEL` | Default changed from `gemma2:2b` → `qwen2.5:1.5b-instruct` |
| `INGESTION_OLLAMA_MODEL` | Default changed from `gemma2:2b` → `qwen2.5:1.5b-instruct` |

#### Modified: `src/services/mobileAIProcessor.ts` (385 LOC)

| Change | Detail |
|--------|--------|
| **`keep_alive` fix** | Was passing string `"-1"` (caused Ollama HTTP 400: `"time: missing unit in duration"`), now correctly converts to number `-1` via `parseFloat()` |

#### Modified: `src/services/mobileActionExecutor.ts` (was 810 → now 2127 LOC)

| Change | Detail |
|--------|--------|
| **Collation fix (2 queries)** | `check_client_health` and `list_failed_jobs` JOINs between `ingestion_jobs` and `assistants` now include `COLLATE utf8mb4_unicode_ci` |
| **Actionable error messages** | All task tool errors now include dashboard navigation: `"Go to Dashboard → Software Connections"` instead of generic "not configured" |
| **Database ALTER** | `ingestion_jobs.id` and `ingestion_jobs.assistant_id` ALTERed from `utf8mb4_0900_ai_ci` to `utf8mb4_unicode_ci` permanently |

#### Modified: `src/services/mobileTools.ts` (was 421 → now 1211 LOC)

| Change | Detail |
|--------|--------|
| **Rule #4 updated** | "Relay tool errors directly — do not rephrase or interpret error messages from tool results" |
| **Rule #7 added** | "Do not ask the user for API keys — if a tool says 'no token found', relay the exact message which includes dashboard instructions" |
| **41 tools** | Full tool inventory: 6 client tools + 35 staff tools across 10 categories |

### Changes — Frontend

#### Modified: `src/pages/general/Profile.tsx` (was 1524 → now 1735 LOC)

| Change | Detail |
|--------|--------|
| **Chat persistence** | `openChat()` no longer clears `chatMessages` state. Messages survive modal close/reopen. |
| **`clearChat()`** | New function with trash icon button in chat header for explicit clearing |
| **"Help me write this with AI"** | New button next to Personality Flare textarea — sends AI request to generate creative personality text |
| **Header softened** | Gradient changed from `slate-900`/`indigo-950` → `slate-800`/`indigo-900`. Dot pattern opacity `0.03` → `0.05`. Shadow `shadow-xl` → `shadow-lg`. |

#### Modified: `src/pages/portal/AssistantsPage.tsx` (was 548 → now 592 LOC)

| Change | Detail |
|--------|--------|
| **Per-assistant chat history** | Messages stored via `chatHistoryRef` (React ref, keyed by assistant ID). History preserved across modal open/close. |
| **SSE line buffering** | Incomplete SSE lines now buffered until newline received (fixes truncated responses) |
| **`response.ok` check** | Non-200 HTTP responses now properly detected and displayed as errors |
| **Conversation history** | Full chat history now sent with each SSE request (was sending only current message) |
| **Error display** | Network/parse errors now shown as red error bubbles in chat instead of silent failure |
| **Trash icon** | Clear button with trash icon in chat header |

### Changes — Infrastructure

| Change | Detail |
|--------|--------|
| **`OLLAMA_NUM_PARALLEL`** | Reduced from `8` → `2` via `/etc/systemd/system/ollama.service.d/override.conf`. Better per-request throughput on CPU-only hardware. |
| **Default model switch** | Benchmarked: `qwen2.5:1.5b-instruct` at 9.2 tok/s vs `gemma2:2b` at 6.2 tok/s (48% faster). All defaults updated. |

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|--------|
| `backend/src/index.ts` | +43 | warmOllamaModels(), startup log |
| `backend/src/config/env.ts` | ~3 | Model defaults → qwen2.5:1.5b-instruct |
| `backend/src/services/mobileAIProcessor.ts` | ~2 | keep_alive string→number fix |
| `backend/src/services/mobileActionExecutor.ts` | +1317 | 41 executors, collation fixes, actionable errors |
| `backend/src/services/mobileTools.ts` | +790 | 41 tool defs, system prompt rule updates |
| `backend/.env` | ~5 | All model assignments updated |
| `frontend/src/pages/general/Profile.tsx` | +211 | Chat persistence, clearChat, AI flare helper, header |
| `frontend/src/pages/portal/AssistantsPage.tsx` | +44 | Per-assistant chat, SSE fixes, trash icon |
| **Total** | **~2,415** | |

### Verification

- ✅ 35/35 staff tools pass automated test (`test-all-staff-tools.mjs`)
- ✅ 0 collation mismatches after ALTER + COLLATE in JOINs
- ✅ Both Ollama models warm on startup (<3s each)
- ✅ Staff chat persists across modal close/reopen
- ✅ Client chat persists per-assistant across modal close/reopen
- ✅ SSE streaming: no truncation, proper error display
- ✅ All TypeScript compilation passes (zero errors)

---

## 1.6 v1.6.0 — Assistant UI Customization Enhancement

**Date:** 2026-03-07  
**Scope:** Client capabilities awareness panel, staff assistant view/form overhaul, tool inventory dashboard, webhook integration info

### Summary

Enhanced the AI assistant customization UI for both clients and staff. **Client-side** (`AssistantsPage.tsx`): added a toggleable capabilities helper panel showing 6 capability categories, and an improved empty state with a dark gradient hero and "How it works" steps. **Staff-side** (`Profile.tsx` `StaffAssistantTab`): complete visual overhaul of the assistant view mode with dark gradient header, quick-stats strip, collapsible 10-category tool inventory showing all 41 tools, webhook/integration info card, and a redesigned create/edit form with card-based personality/voice pickers and section-grouped layout.

### Changes — Frontend (no backend changes)

#### Modified: `src/pages/portal/AssistantsPage.tsx` (was 460 → now 548 LOC)

| Change | Detail |
|--------|--------|
| **New imports** | 8 icons: `LightBulbIcon`, `GlobeAltIcon`, `UserGroupIcon`, `DocumentMagnifyingGlassIcon`, `EnvelopeIcon`, `ChevronDownIcon`, `ChevronUpIcon`, `RocketLaunchIcon` |
| **New state** | `showCapabilities: boolean` — toggles capabilities panel |
| **New constant** | `CAPABILITIES` — 6-item array with icon, title, description, color for each capability |
| **Capabilities panel** | Toggleable "What Can My Assistant Do?" button in header; reveals 3-col grid of 6 capability tiles with gradient background and pro tip callout |
| **Enhanced empty state** | Dark gradient hero card with `RocketLaunchIcon`, "Get Started" CTA, and 3-step "How it works" section (Create → Train → Embed) |
| **Hooks fix** | Moved `useState` before conditional `return` to fix React `rules-of-hooks` violation |

#### Modified: `src/pages/general/Profile.tsx` (was 1189 → now 1524 LOC)

| Change | Detail |
|--------|--------|
| **New imports** | 16 icons: `ClipboardDocumentListIcon`, `ChatBubbleLeftRightIcon`, `CurrencyDollarIcon`, `CalendarDaysIcon`, `UserGroupIcon`, `ShieldCheckIcon`, `GlobeAltIcon`, `BoltIcon`, `ChevronDownIcon`, `ChevronUpIcon`, `LightBulbIcon`, `RocketLaunchIcon`, `InformationCircleIcon`, `WrenchScrewdriverIcon`, `CommandLineIcon`, `CogIcon` |
| **New constant** | `STAFF_TOOL_CATEGORIES` — 10-item array mapping all 41 staff tools to color-coded categories with icons, tool name arrays, and descriptions |
| **New state** | `showCapabilities: boolean` — toggles capabilities panel in view mode |
| **Loading state** | Redesigned: pulsing gradient icon instead of plain spinner |
| **Empty state** | Complete redesign: dark gradient hero (slate-900 → indigo-950) with "Get Started" CTA, 3-step "How It Works" cards, 10-category capabilities preview grid |
| **View mode** | Major overhaul (see component structure below) |
| **Create/Edit form** | Reorganized into 3 sections with icon dividers; dropdowns replaced with card-based pickers |

**View mode redesign detail:**

| Element | Before (v1.5.0) | After (v1.6.0) |
|---------|-----------------|----------------|
| Header | White card, simple badges | Dark gradient header, status dot indicator, personality/voice/tier badges |
| Stats | None | 3-column strip: 41 Tools / 10 Categories / Pages Indexed |
| Details | Plain `dl` grid | Styled sections: greeting blockquote with left border, flare in gray card, monospace model |
| Capabilities | None | Collapsible 2-col grid of 10 categories with color-coded icons and tool pill badges |
| Webhooks | None | Enterprise endpoint info card with 3 capability badges (Inbound Webhooks, Auto-Processing, Field Mapping) |
| Actions | Flat gray Edit/Delete buttons | Glass-effect Edit button + red-tinted Delete on dark header |

**Form redesign detail:**

| Element | Before (v1.5.0) | After (v1.6.0) |
|---------|-----------------|----------------|
| Header | Plain "Edit Assistant" text | Gradient header with icon + subtitle |
| Layout | Flat `space-y-5` | 3 sections with icon dividers: Identity, Personality & Voice, Greeting & Model |
| Personality | `<select>` dropdown | 4 clickable cards (2×2 grid) with active ring highlight |
| Voice Style | `<select>` dropdown | 4 clickable cards (4×1 grid) with purple active ring |
| Inputs | `rounded-lg` borders | `rounded-xl` with `focus:ring-2 focus:ring-picton-blue/20` |
| Save button | Flat `bg-picton-blue` | `bg-gradient-to-r from-picton-blue to-indigo-500` with shadow |
| Footer | None | Info note: "Changes take effect on your next mobile conversation" |

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|--------|
| `frontend/src/pages/portal/AssistantsPage.tsx` | +88 (460 → 548) | Capabilities panel, enhanced empty state, hooks fix |
| `frontend/src/pages/general/Profile.tsx` | +335 (1189 → 1524) | Full StaffAssistantTab overhaul: view mode, empty state, form, capabilities |
| **Total** | **+423** | |

### Verification

- ✅ Both files pass TypeScript compilation (zero errors)
- ✅ No ESLint errors (hooks-of-rules fix applied)
- ✅ No backend changes required — all UI-only enhancements
- ✅ `StaffAssistantModel` API calls unchanged — backward compatible
- ✅ 10 STAFF_TOOL_CATEGORIES map to all 41 tools from `mobileTools.ts getToolsForRole('staff')`
- ✅ 6 CAPABILITIES cover all client-facing features

### Design Decisions

- **Dark gradient headers** (`slate-900 via indigo-950`) chosen to match the existing profile page gradient header and provide visual contrast with the white content sections
- **Card-based pickers** over dropdowns for personality/voice because: (a) show descriptions inline, (b) easier touch targets on mobile, (c) visual feedback with ring highlight
- **Collapsible capabilities panel** to avoid overwhelming the view mode — starts collapsed, user can expand when curious
- **Webhooks info as guidance** rather than a configuration panel because enterprise endpoints are generated through the AI assistant voice commands (no GUI config needed)
- **Tool pills** use each category's `lightColor` class for visual grouping — e.g., blue pills for Task Management, green for CRM

---

## 1.5 v1.5.0 — Unified Assistant Model (Staff + Clients)

**Date:** 2026-03-05  
**Scope:** Unified assistant CRUD for both roles, primary assistant flag, auto-select on mobile, clients create multiple assistants

### Summary

Refactored assistant management so both **staff and client** users create and manage assistants through the same mobile endpoint (`/api/v1/mobile/my-assistant`). Clients can now create **multiple** assistants; one is designated as `is_primary` (the main assistant used by default). Both roles can update personality, greeting, voice style, and other editable fields on any of their assistants from mobile. The old staff-only route (`/api/v1/mobile/staff-assistant`) is preserved for backward compatibility but deprecated.

### Changes — Database

#### Migration 013: `013_unified_assistant_primary.ts`

**Added column to `assistants`:**

| Column | Type | Purpose |
|--------|------|--------|
| `is_primary` | TINYINT(1) NOT NULL DEFAULT 0 | 1 = the default mobile assistant for this user |

**Backfill logic:**
- All existing `is_staff_agent = 1` assistants → `is_primary = 1`
- Client users with exactly 1 active assistant → auto-promoted to `is_primary = 1`

**Added index:** `idx_user_primary (userId, is_primary)` on assistants.

### Changes — Backend

#### New: `src/routes/myAssistant.ts` (~340 LOC)

Unified assistant CRUD mounted at `/api/v1/mobile/my-assistant`:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /` | JWT | List all of user's assistants |
| `GET /:id` | JWT | Get single assistant (ownership verified) |
| `POST /` | JWT | Create assistant (staff: max 1 auto-primary; client: first auto-primary) |
| `PUT /:id` | JWT | Update editable fields (NOT core_instructions) |
| `PUT /:id/set-primary` | JWT | Designate assistant as primary (unsets previous) |
| `DELETE /:id` | JWT | Delete assistant (auto-promotes next if was primary) |
| `POST /core-instructions` | JWT + SuperAdmin | Set hidden core_instructions |
| `GET /software-tokens` | JWT + Staff | List software tokens (staff-only) |
| `POST /software-tokens` | JWT + Staff | Store/update token (staff-only) |
| `DELETE /software-tokens/:id` | JWT | Remove token |

**Key behaviours:**
- Staff: max 1 assistant enforced (`is_staff_agent = 1`), auto-marked `is_primary = 1`
- Clients: unlimited assistants, first one auto-marked `is_primary = 1`
- `PUT /:id/set-primary` uses a transaction to atomically unset all → set the chosen one
- `DELETE /:id` auto-promotes the next most recent active assistant if the deleted one was primary

#### Deprecated: `src/routes/staffAssistant.ts`

The old staff-only route at `/api/v1/mobile/staff-assistant` is still mounted for backward compatibility but all new code should use `/api/v1/mobile/my-assistant`.

#### Modified: `src/routes/mobileIntent.ts`

| Change | Detail |
|--------|--------|
| Auto-select primary | When no `assistantId` is provided in POST /intent, the user's `is_primary = 1` assistant is automatically selected |
| `is_primary` in GET /assistants | The assistant list now includes `is_primary` column, sorted primary-first |

#### Modified: `src/services/mobileAIProcessor.ts`

| Change | Detail |
|--------|--------|
| `AssistantPromptRow.is_primary` | Added `is_primary` to the interface and SQL query |

#### Modified: `src/app.ts`

| Change | Detail |
|--------|--------|
| New import | `myAssistantRouter` from `./routes/myAssistant.js` |
| New mount | `/api/v1/mobile/my-assistant` → `myAssistantRouter` |
| Legacy mount | `/api/v1/mobile/staff-assistant` kept, marked deprecated in comment |

### Changes — Frontend

#### Modified: `src/models/SystemModels.ts`

| Change | Detail |
|--------|--------|
| `MobileAssistantOption.is_primary` | Added `is_primary: number` to the interface |
| `StaffAssistant.is_primary` | Added `is_primary: number` and `is_staff_agent: number` |
| `MyAssistantCreate` interface | Create payload for unified endpoint |
| `MyAssistantUpdate` interface | Partial update payload |
| `MyAssistantModel` class | Full CRUD: `list()`, `get(id)`, `create()`, `update(id)`, `setPrimary(id)`, `delete(id)`, token management |

---

## 1.4 v1.4.0 — Staff Sandbox Assistants & Prompt Concatenation

**Date:** 2026-03-05  
**Scope:** Staff personal assistants, two-part prompt stitching, task proxy tools, mobile assistant selection, software token management

### Summary

Implemented the Staff Sandbox feature allowing each staff member to create one personal AI assistant with a two-part prompt system. `core_instructions` (hidden from GUI, superadmin-only) define behavioral guardrails while `personality_flare` (GUI-editable) controls tone and style. Added 4 new task management tools that proxy to external software APIs using per-staff stored tokens. Mobile users can now select which assistant to use.

### Changes — Database

#### Migration 012: `012_staff_sandbox_prompts.ts`

**Added columns to `assistants`:**

| Column | Type | Purpose |
|--------|------|--------|
| `core_instructions` | TEXT NULL | System-level rules hidden from GUI |
| `personality_flare` | TEXT NULL | User-editable personality & tone |
| `is_staff_agent` | TINYINT(1) DEFAULT 0 | 1 = internal staff sandbox assistant |
| `custom_greeting` | TEXT NULL | Custom greeting message |
| `voice_style` | VARCHAR(50) NULL | TTS voice style hint |
| `preferred_model` | VARCHAR(100) NULL | Override Ollama model per assistant |

**Added column to `mobile_conversations`:**

| Column | Type | Purpose |
|--------|------|--------|
| `assistant_id` | VARCHAR(255) NULL | Tracks which assistant is being used |

**Added index:** `idx_staff_agent (userId, is_staff_agent)` on assistants.

**New table: `staff_software_tokens`**

| Column | Type | Purpose |
|--------|------|--------|
| `id` | VARCHAR(36) PK | UUID |
| `user_id` | VARCHAR(36) | Staff user ID |
| `software_id` | INT | External software reference |
| `software_name` | VARCHAR(255) | Display name |
| `api_url` | VARCHAR(1000) | External API base URL |
| `token` | TEXT | External API token |
| UNIQUE | `(user_id, software_id)` | One token per software per staff |

### Changes — Backend

#### New: `src/routes/staffAssistant.ts` (382 LOC)

Full CRUD for staff sandbox assistants mounted at `/api/v1/mobile/staff-assistant`:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /` | JWT + Staff | Get staff member's assistant (or null) |
| `POST /` | JWT + Staff | Create assistant (max 1, tier forced to paid) |
| `PUT /` | JWT + Staff | Update editable fields (NOT core_instructions) |
| `DELETE /` | JWT + Staff | Delete staff assistant |
| `POST /core-instructions` | JWT + SuperAdmin | Set hidden core_instructions |
| `GET /software-tokens` | JWT + Staff | List software tokens |
| `POST /software-tokens` | JWT + Staff | Store/update token (UPSERT) |
| `DELETE /software-tokens/:id` | JWT | Remove token |

#### Modified: `src/services/mobileTools.ts` (+150 LOC)

Added 4 new staff task tools:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_tasks` | status?, assignee? | List tasks from external software with filtering |
| `create_task` | task_name, task_type, description?, assigned_to?, due_date?, hours? | Create a task |
| `update_task` | task_id, status?, assigned_to?, hours?, description? | Update task fields |
| `add_task_comment` | task_id, comment, is_internal? | Add a comment to a task |

Updated `getToolsForRole()`: staff now gets 13 tools (5 client + 8 staff including 4 task tools).

#### Modified: `src/services/mobileAIProcessor.ts` (+165 LOC)

| Change | Detail |
|--------|--------|
| `assistantId` in `MobileIntentRequest` | Optional assistant selection |
| `loadAssistantPromptData()` | Loads core_instructions, personality_flare, personality, name, preferred_model |
| `buildStitchedPrompt()` | THE guardrail function: core_instructions + personality_flare + dynamic tools |
| `STAFF_CORE_DEFAULT` / `CLIENT_CORE_DEFAULT` | Fallback prompts when no core_instructions set |
| Ollama model override | Uses assistant's `preferred_model` if set |
| `getOrCreateConversation()` | Now stores `assistant_id` in mobile_conversations |

#### Modified: `src/services/mobileActionExecutor.ts` (+300 LOC)

| Change | Detail |
|--------|--------|
| `assistantId` in `MobileExecutionContext` | Optional, for future per-assistant execution logic |
| `getStaffSoftwareToken()` | Fetches stored token from `staff_software_tokens` |
| `taskProxy()` | HTTP proxy to external software API (mirrors `proxyToExternal()`) |
| `execListTasks()` | Proxy GET with status/assignee filtering, formatted output |
| `execCreateTask()` | Proxy POST with field mapping (task_name, task_type, etc.) |
| `execUpdateTask()` | Proxy PUT with change tracking |
| `execAddTaskComment()` | Proxy POST comment with internal note support |

#### Modified: `src/routes/mobileIntent.ts` (+45 LOC)

| Change | Detail |
|--------|--------|
| `assistantId` in POST /intent | Passes to `processMobileIntent()` |
| Ownership verification | Verifies user owns the selected assistant |
| `GET /assistants` | **New endpoint** — lists available assistants for mobile selection |

#### Modified: `src/app.ts` (+2 lines)

Registered `staffAssistantRouter` at `/api/v1/mobile/staff-assistant`.

### Changes — Frontend

#### Modified: `src/models/SystemModels.ts` (+120 LOC)

**New interfaces:**

| Interface | Description |
|-----------|-------------|
| `MobileAssistantOption` | `{ id, name, description, personality }` for mobile selection |
| `StaffAssistant` | Full staff assistant shape (17 fields) |
| `StaffAssistantCreate` | Creation fields (name required, rest optional) |
| `StaffAssistantUpdate` | Update fields (all optional, excludes core_instructions) |
| `StaffSoftwareToken` | Token metadata shape |

**New classes:**

| Class | Methods |
|-------|---------|
| `StaffAssistantModel` | `get()`, `create()`, `update()`, `delete()`, `getTokens()`, `saveToken()`, `deleteToken()` |

**Updated:**
- `MobileModel.getAssistants()` — new method
- `MobileIntentRequest.assistantId` — new field
- `MobileConversation.assistant_id` — new field

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|--------|
| `backend/src/routes/staffAssistant.ts` | **+382** (new) | Staff assistant CRUD + token management |
| `backend/src/services/mobileTools.ts` | +150 | 4 task tools, updated getToolsForRole |
| `backend/src/services/mobileAIProcessor.ts` | +165 | Prompt stitching, assistant loading, model override |
| `backend/src/services/mobileActionExecutor.ts` | +300 | Task proxy + 4 executors, assistantId in context |
| `backend/src/routes/mobileIntent.ts` | +45 | assistantId support, GET /assistants |
| `backend/src/app.ts` | +2 | Route registration |
| `backend/src/db/migrations/012_staff_sandbox_prompts.ts` | **+77** (new) | Migration |
| `frontend/src/models/SystemModels.ts` | +120 | StaffAssistant types + model |
| **Total** | **~1,241** | |

### Security Guardrails

- ✅ `core_instructions` only settable by `super_admin` via dedicated endpoint
- ✅ Staff PUT endpoint explicitly excludes `core_instructions` from allowed fields
- ✅ Tools injected dynamically by role — never stored in DB, never editable via GUI
- ✅ Staff role enforced on all staff assistant endpoints via `requireStaffRole()`
- ✅ Max 1 assistant per staff member (existence check before INSERT)
- ✅ Task proxy uses per-staff stored tokens — no shared credentials
- ✅ Software token deletion verifies `user_id` ownership

### Verification

- ✅ All 8 files pass TypeScript compilation (zero errors)
- ✅ Database migration executed successfully
- ✅ 6 new columns on `assistants` table confirmed
- ✅ `staff_software_tokens` table created with UNIQUE constraint
- ✅ `mobile_conversations.assistant_id` column added
- ✅ All new endpoints registered in Express router chain

### Known Limitations

- **No GUI for core_instructions:** Superadmins must use the API directly (curl/Postman)
- **Software tokens in plaintext:** External tokens stored unencrypted in MySQL
- **Single software token used:** `getStaffSoftwareToken()` uses `LIMIT 1` — doesn't handle multiple portals
- **No frontend profile tab yet:** ~~Staff assistant management UI needs to be built in the React frontend~~ → **RESOLVED in v1.6.0** — full StaffAssistantTab with capabilities dashboard
- **Legacy personality fallback:** If `personality_flare` is null, falls back to the old `personality` column mapping

---

## 1.2 v1.3.0 — Knowledge Base Editing & Management

**Date:** 2026-03-04  
**Scope:** Text content editing, source management, status badges, metrics clarity

### Summary

Implemented complete knowledge base editing capabilities, allowing users to view, edit, and delete all content sources. Added persistent storage of original text content to enable true editing (not just re-pasting). Fixed metrics display to show total indexed pages. Added visual status badges for better job tracking.

### Changes — Database

#### Added Column: `ingestion_jobs.original_content`

```sql
ALTER TABLE ingestion_jobs 
ADD COLUMN original_content LONGTEXT NULL;
```

| Purpose | Detail |
|---------|--------|
| Stores original text | Saves raw text content for sources without file extensions (.txt, pasted text) |
| Enables editing | Pre-fills edit modal with existing content instead of starting blank |
| Populated on upload | Backend detects text files and saves content during initial ingestion |
| Returned in status | `/ingest/status` endpoint now includes this field |

### Changes — Backend

#### Modified: POST `/api/assistants/:id/ingest/file`

```typescript
// Detection logic
const isTextFile = mimetype === 'text/plain' || 
                   !filename.match(/\.(pdf|docx?)$/i);

// Now saves to database
INSERT INTO ingestion_jobs (..., original_content, ...)
VALUES (..., ${isTextFile ? content : null}, ...)
```

| Change | Impact |
|--------|--------|
| Text detection | Identifies files without .pdf/.doc/.docx extensions as plain text |
| Content storage | Saves text to `original_content` column for future editing |
| Binary files | PDFs/DOCs get `original_content = null` (not editable) |

#### Modified: GET `/api/assistants/:id/ingest/status`

```typescript
// Returns original content in response
SELECT 
  id, assistant_id, url, file_path, status, 
  job_type, chunks_created, error_message,
  original_content,  // NEW
  created_at
FROM ingestion_jobs
WHERE assistant_id = ?
```

| Change | Impact |
|--------|--------|
| New field returned | Frontend receives `originalContent` for each job |
| Used for editing | Pre-fills edit modal textarea |
| Null for URLs/PDFs | Only text sources have content |

#### Modified: DELETE `/api/assistants/:id/ingest/job/:jobId`

No schema changes, but usage expanded:

| Before | After |
|--------|-------|
| Only deleted failed jobs | Now deletes any job (pending, processing, completed, failed) |
| Cascade delete | Still removes chunks from `assistant_knowledge` and vectors from SQLite-vec |

### Changes — Frontend

#### Modified: `CreateAssistant.tsx` — Knowledge Tab

**Added: Source Management UI**

```typescript
// Visual status badges
✓ Indexed    (green check, completed jobs)
⟳ Processing (blue spinner, processing jobs)
✗ Failed     (red X, failed jobs)
⏳ Pending    (gray clock, pending jobs)

// Type badges
URL (blue), TEXT (green), FILE (purple)

// Category badges
💰 Pricing/Rates
📞 Contact Details
⚙️ Services Offered
ℹ️ About/Company Info
```

**Added: Edit Button for Text Sources**

```typescript
{source.type === 'text' && isExisting && (
  <button onClick={() => editTextContent(source.label)}>
    <PencilIcon className="w-4 h-4" />
  </button>
)}
```

**Added: Edit Modal Implementation**

```typescript
const editTextContent = async (label) => {
  const job = ingestionJobs.find(j => j.filePath === label);
  
  const result = await Swal.fire({
    title: `Edit "${label}"`,
    html: `
      <select id="edit-category">...</select>
      <textarea id="edit-text">${job.originalContent || ''}</textarea>
    `,
    preConfirm: () => ({
      category: $('#edit-category').value,
      text: $('#edit-text').value.trim()
    })
  });
  
  if (result.isConfirmed) {
    await removeSource(label);  // Delete old version
    setSources([...prev, {      // Add new version
      type: 'text',
      label: label,
      content: result.value.text,
      category: result.value.category
    }]);
  }
};
```

**Added: Load Existing Sources**

```typescript
// In loadAssistant()
const jobsRes = await api.get(`/assistants/${id}/ingest/status`);

const existingSources = jobs.map(j => ({
  type: j.filePath && !j.filePath.match(/\.(pdf|docx?)$/i) 
    ? 'text' 
    : j.url ? 'url' : 'file',
  label: j.url || j.filePath,
  category: extractCategoryFromPath(j.filePath)  // Parse from filename
}));

setSources(existingSources);
setIngestionJobs(jobs);
```

**Fixed: Metrics Display**

```typescript
// Before: Counted completed jobs
{ingestionJobs.filter(j => j.status === 'completed').length}

// After: Sums chunks_created
{ingestionJobs.filter(j => j.status === 'completed')
  .reduce((sum, j) => sum + (j.pagesIndexed || 0), 0)}
```

**Fixed: Delete Confirmation**

```typescript
const removeSource = async (label) => {
  const job = ingestionJobs.find(j => 
    j.url === label || j.filePath === label
  );
  
  if (job) {
    const result = await Swal.fire({
      title: 'Delete from knowledge base?',
      text: 'This will remove all indexed content.',
      icon: 'warning',
      showCancelButton: true
    });
    
    if (result.isConfirmed) {
      await api.delete(`/assistants/${id}/ingest/job/${job.id}`);
      setSources(prev => prev.filter(s => s.label !== label));
      setIngestionJobs(prev => prev.filter(j => j.id !== job.id));
    }
  }
};
```

#### Updated Interfaces

```typescript
interface IngestSource {
  type: 'url' | 'text' | 'file';
  label: string;
  file?: File;
  content?: string;
  category?: string;  // Added for all input types
}

interface IngestionJob {
  id: string;
  url?: string;
  filePath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pagesIndexed: number;       // Renamed from chunks_created
  error?: string;             // Renamed from error_message
  originalContent?: string;   // NEW: For text editing
}
```

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|---------|
| `backend/src/routes/assistantIngest.ts` | ~30 | Store/return original_content |
| `frontend/src/pages/portal/CreateAssistant.tsx` | ~200 | Edit modal, load sources, status badges, metrics fix |
| Schema: `ingestion_jobs` | +1 column | Added original_content LONGTEXT |

### User Workflows

**Edit Text Content:**
1. Open assistant editor → Knowledge tab
2. Find TEXT source in list
3. Click pencil icon
4. Modal opens with existing content
5. Modify text/category
6. Click "Update & Re-index"
7. Old deleted, new added, re-indexed

**Delete Source:**
1. Find source in list
2. Click X button
3. Confirm deletion
4. Backend removes job + chunks + vectors
5. Knowledge health recalculates

### Verification

- ✅ Database column added successfully
- ✅ Backend stores text content on upload
- ✅ Status endpoint returns `original_content` field
- ✅ Edit modal pre-fills with existing text
- ✅ Delete removes job + chunks + vectors
- ✅ Metrics show "5 Pages Indexed" not "2 Indexed"
- ✅ Status badges display correctly
- ✅ PM2 restart #82 completed

### Known Limitations

- **Legacy Content:** Text added before v1.3.0 has no `original_content`
  - Edit modal will be empty for old sources
  - Re-paste once to enable future editing
  
- **File Editing:** Only TEXT sources editable, PDFs/DOCs must be re-uploaded

---

## 1.1 v1.2.0 — AI Categorization Fixes

**Date:** 2026-03-04  
**Scope:** Knowledge health scoring, categorization timeouts, JSON parsing

### Summary

Fixed multiple issues preventing AI categorization from working correctly. Increased Ollama timeout from 30s to 120s to prevent ECONNABORTED errors. Fixed MySQL auto-parsing JSON causing TypeError. Updated knowledge health interface to match backend response structure.

### Changes — Backend

#### Modified: `services/knowledgeCategorizer.ts`

**Fixed: Ollama Timeout**

```typescript
// Before
const response = await axios.post('http://localhost:11434/api/chat', {
  model: 'qwen2.5:3b-instruct',
  messages: [...]
}, { timeout: 30000 });  // 30 seconds

// After
}, { timeout: 120000 });  // 120 seconds (2 minutes)
```

| Issue | Solution |
|-------|----------|
| ECONNABORTED errors | Categorization often took >30s, causing silent failures |
| Impact | Health score always showed 0% even with indexed content |
| Fix | Increased to 120s, added better error logging with axios error details |

**Fixed: JSON Parsing**

```typescript
// Before
function parseStoredChecklist(raw) {
  return typeof raw === 'string' ? JSON.parse(raw) : [];
}

// After
function parseStoredChecklist(raw) {
  if (typeof raw === 'object' && raw !== null) {
    return raw;  // Already parsed by MySQL driver
  }
  return typeof raw === 'string' ? JSON.parse(raw) : [];
}
```

| Issue | Solution |
|-------|----------|
| TypeError: raw.slice is not a function | MySQL driver auto-parsed JSON column to object |
| Impact | Couldn't read checklist, always showed empty |
| Fix | Added type check to handle pre-parsed objects |

#### Modified: `routes/assistants.ts` — Knowledge Health Endpoint

**Fixed: Response Structure**

```typescript
// Backend returns
{
  score: 50,
  checklist: [
    { key: 'pricing', label: 'Pricing/Rates', satisfied: true, type: 'url' },
    { key: 'contact', label: 'Contact Details', satisfied: false, type: 'url' }
  ],
  missing: ['Contact Details', 'Services Offered'],
  pagesIndexed: 5,
  tier: 'free',
  pageLimit: 100,
  storageFull: false
}
```

| Change | Detail |
|--------|--------|
| checklist structure | Each item has key, label, satisfied, type (not category, status, urls) |
| missing array | Lists unsatisfied category labels |
| pagesIndexed | Total chunks across all jobs |

### Changes — Frontend

#### Fixed: Interface Mismatch

```typescript
// Before
interface KnowledgeHealth {
  checklist: Array<{
    category: string;
    status: string;
    urls: string[];
  }>;
}

// After
interface KnowledgeHealth {
  score: number;
  checklist: Array<{
    key: string;
    label: string;
    satisfied: boolean;
    type: 'url' | 'file';
  }>;
  missing: string[];
  pagesIndexed: number;
  tier: 'free' | 'paid';
  pageLimit: number;
  storageFull: boolean;
}
```

#### Fixed: Display Logic

```typescript
// Before
{health.checklist.map(item => (
  <div>{item.category}: {item.status}</div>
))}

// After
{health.checklist.map(item => (
  <div>
    {item.satisfied ? '✓' : '○'} {item.label}
  </div>
))}
```

### Files Changed

| File | Lines Changed | Summary |
|------|--------------|---------|
| `backend/src/services/knowledgeCategorizer.ts` | ~20 | Timeout increase, JSON parsing fix |
| `frontend/src/pages/portal/CreateAssistant.tsx` | ~30 | Interface update, display fix |

### Verification

- ✅ Ollama categorization completes without timeout
- ✅ Knowledge health score calculates correctly (50% = 2/4 categories)
- ✅ Checklist displays with proper checkmarks
- ✅ Missing categories listed correctly
- ✅ Manual `/recategorize` endpoint works

---

## 1.0 v1.1.0 — Widget Chat Client Branding

**Date:** 2026-03-02  
**Scope:** Backend widget.js endpoint, static widget files (chat-widget.js, embed.js, widget.js)

### Summary

Replaced the generic 💬 emoji chat button with the Soft Aware brand favicon (`/images/favicon.png`), added a branded header bar with logo and title to the chat container, and added a "Powered by Soft Aware" footer. Changes applied to all three widget delivery mechanisms (API endpoint, static chat-widget.js, static embed.js).

### Changes — Backend

#### Modified: GET `/api/assistants/widget.js`

| Change | Detail |
|--------|--------|
| Replaced 💬 emoji button | FAB button now uses `<img>` of `/images/favicon.png` (32×32, rounded) |
| Brand origin detection | Derives base URL from `currentScript.src` (falls back to `https://softaware.net.za`) |
| Added branded header bar | Gradient header with favicon (28×28) + "Soft Aware Assistant" title + ✕ close |
| Added "Powered by Soft Aware" footer | Light gray bar with mini favicon (14×14) + text |
| Open/close toggle redesigned | Closed: FAB shows favicon; Open: FAB shows ✕, chat container with header/footer visible |
| Chat container restructured | Was bare `<iframe>`; now flexbox container with header → iframe → footer |
| ES5-compatible output | Changed `const`/`let`/arrow to `var`/`function` for broader browser support |

**Before:**

```javascript
button.innerHTML = '💬';
// ... bare iframe with display: none/block toggle
button.innerHTML = isOpen ? '✕' : '💬';
```

**After:**

```javascript
// Brand icon image for the button
var btnIcon = document.createElement('img');
btnIcon.src = faviconUrl;  // derived from script src origin + '/images/favicon.png'
button.appendChild(btnIcon);

// Branded header + iframe + "Powered by Soft Aware" footer in flex container
// Toggle swaps btnIcon/btnClose visibility + container display
```

### Changes — Static Files

#### Updated: `/var/opt/softaware.net.za/public_html/chat-widget.js`

Same branding as the API-served widget.js — brand favicon button, header bar, powered-by footer.

#### Updated: `/var/opt/softaware.net.za/public_html/embed.js`

Branded header bar with favicon + "Soft Aware Assistant" title, "Powered by Soft Aware" footer with mini favicon.

#### New: `/var/opt/softaware.net.za/public_html/widget.js`

Copy of `chat-widget.js` at the root path — matches the `getEmbedCode()` output in AssistantsPage.tsx (`${origin}/widget.js`).

### Brand Assets Used

| Asset | Path | Size | Usage |
|-------|------|------|-------|
| `favicon.png` | `/var/opt/frontend/public/images/favicon.png` | 5,801 bytes | FAB icon, header icon, footer icon |
| Deployed at | `https://softaware.net.za/images/favicon.png` | 200 OK | Cross-origin accessible from any embedding site |

### Files Changed

| File | Change Type | Summary |
|------|------------|---------|
| `backend/src/routes/assistants.ts` | Modified | Widget.js endpoint: brand favicon, header bar, footer, ES5 compat |
| `softaware.net.za/public_html/chat-widget.js` | Modified | Static branded widget |
| `softaware.net.za/public_html/embed.js` | Modified | Static branded embed |
| `softaware.net.za/public_html/widget.js` | **New** | Root-path copy of branded widget |

### Verification

- ✅ Backend compiles clean (TypeScript, `tsc --noEmit`)
- ✅ PM2 restarted successfully
- ✅ `curl /api/assistants/widget.js` returns branded script with 10 favicon/branding references
- ✅ `https://softaware.net.za/images/favicon.png` returns 200 (5,801 bytes, image/png)
- ✅ Static `widget.js`, `chat-widget.js`, `embed.js` all contain branding elements
- ✅ Widget button shows brand icon instead of 💬 emoji
- ✅ Chat container includes header bar + footer with "Powered by Soft Aware"

---

## 1.1 v1.0.0 — Per-Assistant Dashboard Health & Delete with KB Option

**Date:** 2026-03-02  
**Scope:** Backend assistants.ts DELETE endpoint, frontend Dashboard.tsx restructure, new KnowledgeHealthBadge component

### Summary

Rewired the portal dashboard to display knowledge health **per assistant** (previously a standalone card for `assistants[0]` only) and added an assistant delete button with a user-controlled option to clear or keep the sqlite-vec knowledge base.

### Changes — Backend

#### Modified: DELETE `/api/assistants/:assistantId`

| Change | Detail |
|--------|--------|
| Added `clearKnowledge` query parameter | `?clearKnowledge=true` (default) or `?clearKnowledge=false` |
| Added `ingestion_jobs` cleanup | `DELETE FROM ingestion_jobs WHERE assistant_id = ?` — previously missing |
| sqlite-vec cleanup conditional | `deleteVecByAssistant()` only called when `clearKnowledge !== 'false'` |
| New response shape | `{ success: true, knowledgeCleared: boolean }` — was `{ success: true }` |
| Error isolation | ingestion_jobs and sqlite-vec cleanup wrapped in try/catch (non-fatal) |

**Before:**

```typescript
router.delete('/:assistantId', async (req, res) => {
  const { assistantId } = req.params;
  await db.execute('DELETE FROM assistants WHERE id = ?', [assistantId]);
  return res.json({ success: true });
});
```

**After:**

```typescript
router.delete('/:assistantId', async (req, res) => {
  const { assistantId } = req.params;
  const clearKnowledge = req.query.clearKnowledge !== 'false';

  const affected = await db.execute('DELETE FROM assistants WHERE id = ?', [assistantId]);
  if (affected === 0) return res.status(404).json({ success: false, error: 'Assistant not found' });

  // Clean up ingestion_jobs
  try {
    await db.execute('DELETE FROM ingestion_jobs WHERE assistant_id = ?', [assistantId]);
  } catch (e) {
    console.warn('[Assistant] ingestion_jobs cleanup failed:', (e as Error).message);
  }

  // Clean up sqlite-vec vectors (unless user opted to keep KB)
  if (clearKnowledge) {
    try {
      deleteVecByAssistant(assistantId);
    } catch (e) {
      console.warn('[Assistant] sqlite-vec cleanup failed:', (e as Error).message);
    }
  }

  return res.json({ success: true, knowledgeCleared: clearKnowledge });
});
```

---

### Changes — Frontend

#### New Component: `KnowledgeHealthBadge.tsx`

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/components/KnowledgeHealthBadge.tsx` |
| **LOC** | 107 |
| **Purpose** | Compact per-assistant health indicator for dashboard cards |

**Features:**
- Self-fetching: calls `GET /assistants/:id/knowledge-health` independently
- Mini SVG progress ring (36×36, radius 14, strokeWidth 3)
- Color-coded thresholds: ≥80 emerald, ≥60 yellow, ≥40 orange, <40 red
- Labels: score %, "Knowledge Healthy/Partial/Low", "{satisfied}/{total} topics · {pages} pages"
- Graceful degradation: loading skeleton → null on error
- Cleanup: cancellation flag prevents state updates after unmount

#### Modified: `Dashboard.tsx`

| Change | Detail |
|--------|--------|
| **Removed import** | `KnowledgeHealthScore` — was `from '../../components/KnowledgeHealthScore'` |
| **Added imports** | `TrashIcon` (heroicons), `Swal` (sweetalert2), `KnowledgeHealthBadge` |
| **Removed section** | Standalone `<KnowledgeHealthScore assistantId={assistants[0].id} tier={metrics?.tier} />` that rendered below the stat cards — only showed health for the first assistant |
| **Added function** | `handleDeleteAssistant(assistant: AssistantSummary)` |
| **Modified assistant cards** | Each card now includes: (1) `TrashIcon` button top-right, (2) `<KnowledgeHealthBadge>` in middle, (3) `flex flex-col` layout with `mt-auto` on buttons |

**handleDeleteAssistant flow:**

1. SweetAlert2 fires with `icon: 'warning'`, cancel button focused
2. HTML includes a checked checkbox: "Also delete knowledge base data (sqlite-vec)"
3. `preConfirm` reads checkbox state → returns `boolean`
4. If user cancelled (`clearKnowledge === undefined`), return early
5. `api.delete(/assistants/${id}?clearKnowledge=${clearKnowledge})`
6. Success toast (2.5s auto-dismiss) with message varying by clearKnowledge
7. Error toast on failure
8. `loadData()` refreshes dashboard

**Card layout change:**

```
BEFORE:                          AFTER:
┌─────────────────┐             ┌─────────────────┐
│ Avatar + Name   │             │ Avatar + Name  🗑│  ← TrashIcon added
│ Description     │             │ Description     │
│ Test Chat | Edit│             │ KnowledgeHealth │  ← Badge added
└─────────────────┘             │ Test Chat | Edit│  ← mt-auto pins to bottom
                                └─────────────────┘
```

---

### Files Changed

| File | Change Type | Summary |
|------|------------|---------|
| `backend/src/routes/assistants.ts` | Modified | DELETE endpoint: added `clearKnowledge` param, ingestion_jobs cleanup, conditional sqlite-vec cleanup, new response shape |
| `frontend/src/components/KnowledgeHealthBadge.tsx` | **New** | Compact per-assistant health badge (107 LOC) |
| `frontend/src/pages/portal/Dashboard.tsx` | Modified | Removed standalone health card, added per-card KnowledgeHealthBadge + TrashIcon delete with SweetAlert2 |

### Verification

- ✅ Backend compiles clean (TypeScript)
- ✅ PM2 restarted successfully (restart #63)
- ✅ `DELETE /assistants/:id` returns `{ success: true, knowledgeCleared: true }`
- ✅ `DELETE /assistants/:id?clearKnowledge=false` returns `{ success: true, knowledgeCleared: false }`
- ✅ Each assistant card renders KnowledgeHealthBadge independently
- ✅ Delete dialog shows checkbox (checked by default)
- ✅ Success toast varies message based on KB clear/keep choice
- ✅ Dashboard reloads after deletion

---

## 2. Known Issues

### 2.1 🟡 WARNING — No Per-User Assistant Isolation

- **Status:** OPEN
- **Module File:** `backend/src/routes/assistants.ts` — `GET /`
- **Description:** The list endpoint returns all assistants regardless of the authenticated user. The `userId` column exists but is not filtered.
- **Impact:** Multi-tenant isolation is not enforced. All users see all assistants.
- **Recommended Fix:** Add `WHERE userId = ?` using the authenticated user's ID from JWT.
- **Effort:** LOW (~3 lines)

### 2.2 🟡 WARNING — N+1 Knowledge Health Requests on Dashboard

- **Status:** OPEN
- **Module File:** `frontend/src/components/KnowledgeHealthBadge.tsx`
- **Description:** Each assistant card fires an independent `GET /knowledge-health` request. For 6 cards, that's 6 HTTP round-trips.
- **Impact:** Slower dashboard load, increased backend load.
- **Recommended Fix:** Batch endpoint `GET /assistants/knowledge-health/batch?ids=a,b,c`.
- **Effort:** MEDIUM

### 2.3 🟡 WARNING — Orphaned sqlite-vec Data on clearKnowledge=false

- **Status:** OPEN (accepted design)
- **Module File:** `backend/src/routes/assistants.ts` — DELETE handler
- **Description:** When user opts to keep KB data, the `knowledge_chunks` rows reference a deleted `assistant_id`. No re-import mechanism exists.
- **Impact:** Data is preserved but unreachable via the API.
- **Recommended Fix:** Add `POST /assistants/:id/import-vectors?fromAssistant=oldId` or document the limitation.
- **Effort:** MEDIUM

### 2.4 🟡 WARNING — No Ingestion Limit Enforcement

- **Status:** OPEN
- **Module File:** `backend/src/routes/assistantIngest.ts` — POST /url and POST /file
- **Description:** Free-tier page limit (50) is displayed but not enforced at ingestion time. Users can queue unlimited jobs.
- **Impact:** Free users can exceed their page limit.
- **Recommended Fix:** Check `pages_indexed >= pageLimit` before INSERT.
- **Effort:** LOW (~5 lines)

### 2.5 🟡 WARNING — No Authentication on Assistant Endpoints

- **Status:** OPEN
- **Module File:** `backend/src/routes/assistants.ts` — all endpoints
- **Description:** No `requireAuth` middleware on any assistant endpoint. All operations are publicly accessible.
- **Impact:** Anyone with the API URL can create, delete, or modify assistants.
- **Recommended Fix:** Add `requireAuth` middleware and `userId` filtering.
- **Effort:** LOW

### 2.6 🟢 INFO — assistant_knowledge Legacy Dual-Write

- **Status:** OPEN (tech debt)
- **Module File:** `backend/src/services/ingestionWorker.ts`
- **Description:** Chunks are written to both MySQL `assistant_knowledge` table and sqlite-vec. MySQL copy is only used for recategorization.
- **Impact:** Double storage cost, potential data drift.
- **Recommended Fix:** Migrate recategorization to read from sqlite-vec `knowledge_chunks`, then drop `assistant_knowledge` table.
- **Effort:** MEDIUM

### 2.7 🟢 INFO — No Chat Persistence

- **Status:** OPEN (tech debt)
- **Module File:** `frontend/src/pages/portal/Dashboard.tsx` — chat modal
- **Description:** Chat messages exist only in React state. Closing the modal loses all conversation history.
- **Recommended Fix:** Add `chat_sessions` + `chat_messages` tables.
- **Effort:** MEDIUM

### 2.8 🟢 INFO — Widget CORS Allows All Origins

- **Status:** OPEN (by design)
- **Module File:** `backend/src/routes/assistants.ts` — `GET /widget.js`
- **Description:** `Access-Control-Allow-Origin: *` on the widget script. Required for embedding on any domain.
- **Impact:** Expected for an embeddable widget. Chat endpoint itself should have tighter CORS.
- **Effort:** N/A (by design)

### 2.9 🟢 INFO — Redundant data JSON Column

- **Status:** OPEN (tech debt)
- **Module File:** `backend/src/routes/assistants.ts` — `parseAssistantRow()`
- **Description:** The `data` JSON column mirrors individual columns (`name`, `description`, etc.). Both are maintained.
- **Recommended Fix:** Consolidate to one approach.
- **Effort:** MEDIUM

---

## 3. Future Enhancements

| Enhancement | Priority | Effort | Description |
|-------------|----------|--------|-------------|
| Per-user assistant isolation | 🔴 HIGH | LOW | Filter by `userId` from JWT on all endpoints |
| Auth middleware on all endpoints | 🔴 HIGH | LOW | Add `requireAuth` to assistant router |
| Batch knowledge health endpoint | 🟡 MEDIUM | MEDIUM | Single request for all dashboard badges |
| Chat persistence | 🟡 MEDIUM | MEDIUM | Store conversations in MySQL for history/analytics |
| Ingestion limit enforcement | 🟡 MEDIUM | LOW | Reject jobs when `pages_indexed >= pageLimit` |
| Vector re-import tool | 🟢 LOW | MEDIUM | Import orphaned vectors into a new assistant |
| Multi-model support | 🟢 LOW | HIGH | Allow different Ollama models per assistant |
| Conversation analytics | 🟢 LOW | MEDIUM | Track message counts, topics, satisfaction per assistant |
| Bulk assistant delete | 🟢 LOW | LOW | Select multiple assistants for batch deletion |
| Real-time ingestion status | 🟢 LOW | MEDIUM | WebSocket updates for job progress instead of polling |
