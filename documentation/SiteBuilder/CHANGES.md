# Site Builder Module — Changelog

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## Version 3.1.0 — Configurable Forms, Submissions System & Conditional Rendering (2026-03-15)

### New Features

| Feature | Description |
|---------|-------------|
| **Configurable contact form** | Users can toggle form inclusion on/off, configure custom form fields (text, email, phone, textarea, select), set destination email, auto-reply message, and submit button text via the SiteBuilderEditor UI. |
| **Form submission processing** | Public `POST /forms/submit` endpoint receives form data from generated sites, stores in `site_form_submissions` table, sends notification email to site owner, and sends auto-reply to submitter. |
| **Honeypot bot detection** | Hidden `bot_check_url` field traps bots — non-empty value returns silent success without storing. |
| **IP rate limiting** | In-memory rate limiter: max 10 submissions per IP per site per 10 minutes via `Map<string, { count, resetAt }>`. |
| **Free tier submission cap** | Free-tier sites limited to 50 total form submissions (enforced server-side via `resolveUserTier()`). |
| **Form submissions viewer** | New `FormSubmissions.tsx` portal page with inbox-style UI: unread/all filter, detail modal, mark-as-read, delete, pagination. |
| **Submissions button** | WebsiteManager header now includes a "Submissions" button linking to the FormSubmissions page. |
| **Conditional assistant widget** | AI chat widget is now opt-in (default: off) via `includeAssistant` toggle. Widget only injected when enabled AND a valid assistant clientId is provided. |
| **Conditional contact form** | Contact section, navigation "Contact" link, and hero CTA button are all conditionally rendered based on `includeForm` flag. |
| **Dynamic form fields** | Template generates form fields dynamically from `formConfig.fields` array. Supports text, email, tel, textarea, and select field types with validation. |
| **Form config persistence** | `form_config` JSON, `include_form`, and `include_assistant` stored in `generated_sites` table and restored on site edit. |
| **Email notifications** | Notification email to site owner includes HTML-formatted field summary, timestamp, IP, and link to submissions dashboard. Auto-reply uses configured message text. |

### Backend Changes

| File | LOC | Change |
|------|-----|--------|
| siteBuilder.ts | 2,118 (+346) | Added `POST /forms/submit` (public, rate-limited), `GET /:siteId/submissions` (paginated), `PATCH /:siteId/submissions/:id/read`, `DELETE /:siteId/submissions/:id`; form_config/include_form/include_assistant auto-migration; updated generate-ai, skip-queue, page-generate to pass form/assistant flags |
| siteBuilderTemplate.ts | 369 (+95) | Added FormFieldConfig/FormConfig interfaces; conditional form rendering; conditional assistant widget; dynamic form fields; JavaScript fetch submission to /forms/submit; honeypot hidden field |
| siteBuilderService.ts | 910 (+20) | Added form_config, include_form, include_assistant to GeneratedSite/SiteData interfaces; updateSite() handles new fields |

### Frontend Changes

| File | LOC | Change |
|------|-----|--------|
| FormSubmissions.tsx | 334 (NEW) | Inbox-style form submissions viewer — list with unread filter, detail modal, mark-as-read, delete, pagination, empty state |
| SiteBuilderEditor.tsx | 1,077 (+226) | Added FormField interface, includeForm/includeAssistant toggles, form field builder UI (add/remove fields, type selection), destination email input, auto-reply textarea; updated handleSave/handleGenerate to pass form config |
| WebsiteManager.tsx | 459 (+8) | Added EnvelopeIcon import; "Submissions" button in header linking to FormSubmissions page |
| App.tsx | +1 route | `/portal/sites/:siteId/submissions` → FormSubmissions |
| portal/index.ts | +1 export | Added FormSubmissions export |

### Database Changes

| Change | Type | SQL |
|--------|------|-----|
| Add `form_config` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN form_config JSON NULL AFTER generation_error` |
| Add `include_form` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN include_form TINYINT(1) NOT NULL DEFAULT 1 AFTER form_config` |
| Add `include_assistant` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN include_assistant TINYINT(1) NOT NULL DEFAULT 0 AFTER include_form` |
| Create `site_form_submissions` | CREATE TABLE | 7-column table with FK to generated_sites(id) CASCADE, indexes on site_id and submitted_at |

### Security Changes

| Change | Description |
|--------|-------------|
| Public form endpoint | `POST /forms/submit` requires no auth (public-facing) but is protected by honeypot, IP rate limiting, and free tier cap |
| Honeypot bot trap | Hidden `bot_check_url` field — bots filling all fields get silently rejected |
| IP rate limiting | In-memory Map limits 10 submissions per IP/site per 10 minutes |
| Free tier cap | Max 50 submissions per site for free-tier users (via `resolveUserTier()`) |
| Submissions auth | List/read/delete submissions require JWT + site ownership verification |
| Assistant opt-in | Widget script no longer auto-included — requires explicit `includeAssistant: true` |

### API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `/forms/submit` | POST | **NEW** — Public form submission with bot detection + rate limiting |
| `/:siteId/submissions` | GET | **NEW** — List submissions (paginated, unread filter) |
| `/:siteId/submissions/:id/read` | PATCH | **NEW** — Mark submission as read |
| `/:siteId/submissions/:id` | DELETE | **NEW** — Delete submission |
| `/generate-ai` | POST | **UPDATED** — `clientId` no longer required; accepts `includeForm`, `includeAssistant`, `formConfig` |

---

## Version 3.0.0 — Multi-Page Websites, Tier System & Admin Panel (2026-03-10)

### Breaking Changes

| Change | Detail |
|--------|--------|
| **Tier resolved server-side** | `req.body.tier` is no longer trusted. `resolveUserTier(userId)` queries `contact_packages → packages` to determine the actual tier. Clients sending `tier` in the request body will have it ignored. |
| **max_pages column added** | `generated_sites` table now has `max_pages INT NOT NULL DEFAULT 1`. All existing sites default to 1 page (free tier). |
| **site_pages table added** | New table for multi-page content — auto-created on startup via migration IIFE. |
| **Admin routes added** | New `/api/admin/sites/*` route group requires admin/staff/developer role. |

### New Features

| Feature | Description |
|---------|-------------|
| **Multi-page websites** | Paid-tier users can create up to 50 pages per site (Starter=5, Pro=15, Enterprise=50). Pages support 8 types: home, about, services, contact, gallery, faq, pricing, custom. |
| **Page CRUD** | Full REST API for pages: `GET/POST/PUT/DELETE /:siteId/pages[/:pageId]`. Tier-gated creation with quota enforcement. |
| **Per-page AI generation** | `POST /:siteId/pages/:pageId/generate` generates HTML for individual pages using their content_data. |
| **Navigation injection** | `injectNavigation()` in siteBuilderService auto-injects a nav bar linking all published pages into each page's HTML. |
| **GET /tier endpoint** | `GET /api/v1/sites/tier` returns the user's subscription tier info (`tier`, `maxPages`, `packageSlug`, `status`, `daysLeft`). |
| **Auto max_pages on site creation** | `POST /` now calls `resolveUserTier()` and auto-sets `max_pages` based on the user's subscription. |
| **Trial auto-downgrade** | `enforceTrialExpiry()` now also downgrades `max_pages → 1` on all expired users' sites via JOIN through `user_contact_link`. |
| **Trial expiry warnings** | `sendTrialExpiryWarnings()` sends notifications 3 days before trial ends. |
| **WebsiteManager page** | New portal page at `/portal/sites/:siteId/manage` — page tree, tier-gated "Add Page", quota progress bar, free-tier upsell, trial warning banner. |
| **PageEditor page** | New portal page at `/portal/sites/:siteId/pages/:pageId` — type-specific content fields, AI generate, save, publish toggle, slug editor, inline preview. |
| **AdminSites page** | New admin page at `/admin/sites` — 7 stat cards, searchable/filterable paginated table, admin actions (reset failed, edit page limit, delete), trial countdown. |
| **Admin site stats** | `GET /admin/sites/stats` — aggregate stats: total_sites, by-status counts, total_pages, trial_sites, recent_deployments. |
| **Admin site list** | `GET /admin/sites` — paginated + searchable + filterable list with owner info, page counts, subscription details. |
| **Admin override** | `PATCH /admin/sites/:siteId` — admin can override status and max_pages (1–50). |
| **Admin force-delete** | `DELETE /admin/sites/:siteId` — deletes site + all pages + deployments regardless of ownership. |
| **Active trials view** | `GET /admin/sites/trials/active` — lists all sites owned by trial users with days_left countdown. |

### Backend Changes

| File | LOC | Change |
|------|-----|--------|
| siteBuilder.ts | 1,772 (+1,079) | Added `GET /tier`, server-side `resolveUserTier()`, auto `max_pages` on creation, 6 multi-page endpoints, per-page AI generation |
| adminSites.ts | 271 (NEW) | Full admin route: stats, list, detail, override, delete, trials |
| siteBuilderService.ts | 890 (+254) | Added multi-page CRUD (getPagesBySiteId, getPageById, getPageCount, createPage, updatePage, deletePage), getMaxPages, setMaxPages, injectNavigation |
| packages.ts | 756 (+68) | Added `resolveUserTier()`, updated `enforceTrialExpiry()` to downgrade sites, added `sendTrialExpiryWarnings()` |
| app.ts | +2 lines | Mounted `adminSitesRouter` at `/admin/sites` with `auditLogger` |

### Frontend Changes

| File | LOC | Change |
|------|-----|--------|
| WebsiteManager.tsx | 451 (NEW) | Multi-page management — page tree, tier-gated add, quota bar, upsell, trial warning |
| PageEditor.tsx | 395 (NEW) | Per-page editor — type-specific content, AI gen, save, publish, preview |
| AdminSites.tsx | 380 (NEW) | Admin panel — 7 stat cards, search/filter table, pagination, admin actions |
| SitesPage.tsx | 623 (+249) | Added "Manage" button linking to WebsiteManager, UI improvements |
| SiteBuilderEditor.tsx | 851 (+72) | Minor integration updates for multi-page flow |
| App.tsx | +3 routes | `/portal/sites/:siteId/manage`, `/portal/sites/:siteId/pages/:pageId`, `/admin/sites` |
| portal/index.ts | +2 exports | Added WebsiteManager, PageEditor exports |
| PortalLayout.tsx | Renamed | "Landing Pages" → "Websites", "Create Landing Page" → "Create Website" |
| Layout.tsx | +1 link | Added "Sites" link under AI & Enterprise admin section |

### Database Changes

| Change | Type | SQL |
|--------|------|-----|
| Add `max_pages` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN max_pages INT NOT NULL DEFAULT 1` |
| Create `site_pages` | CREATE TABLE | 11-column table with UNIQUE(site_id, page_slug), FK to generated_sites(id) CASCADE |

### Security Changes

| Change | Description |
|--------|-------------|
| Server-side tier | `resolveUserTier()` replaces client-supplied `tier` — prevents free users from spoofing paid tier |
| Page quota enforcement | `POST /:siteId/pages` checks `max_pages` server-side; returns `UPGRADE_REQUIRED` or `PAGE_LIMIT_REACHED` |
| Admin middleware | `requireAdmin` checks `users.role` for admin/staff/developer before allowing admin endpoints |
| Audit logging | Admin site routes pass through `auditLogger` middleware for accountability |
| Slug sanitization | Page slugs are lowercased, non-alphanumeric stripped, UNIQUE constraint prevents duplicates |

---

## Version 2.1.0 — Live Preview, Assistant Persistence & Preview Button (2026-03-08)

### New Features

| Feature | Description |
|---------|-------------|
| **Live HTML preview endpoint** | New `GET /:siteId/preview` serves the generated HTML as a full web page in a new browser tab. Supports JWT via `?token=` query param (since `window.open()` can't send headers). |
| **"Open Live Preview" button** | SiteBuilderEditor shows a green "Open Live Preview" button in the Website Ready section that opens the full site in a real browser tab (not just the sandboxed iframe). |
| **"Preview" button on SitesPage** | Site cards for generated/deployed sites now show a "Preview" button that opens the live page in a new tab. |
| **Assistant restored on reload** | When editing an existing site, `widget_client_id` is now loaded from the DB and the assistant dropdown is correctly pre-selected. Previously it always defaulted to the first assistant. |
| **Post-generation assistant change** | After generation, a dedicated assistant selector appears in the "Website Ready" card. Changing the assistant immediately persists via `PUT /:siteId` (no need to scroll back to the form). Note shown: "Changing the assistant requires regeneration to take effect on the site." |
| **`widgetClientId` in updateSite** | `PUT /:siteId` now supports updating `widgetClientId`. UUID is validated and existence-checked against `widget_clients` table. Pass `null`/`""` to remove the assistant. |

### Backend Changes

| File | LOC | Change |
|------|-----|--------|
| siteBuilder.ts | 693 (+30) | New `GET /:siteId/preview` endpoint with JWT query-param auth; added `jsonwebtoken` import |
| siteBuilderService.ts | 636 (+15) | `updateSite()` now handles `widgetClientId` with UUID validation and `widget_clients` existence check |

### Frontend Changes

| File | LOC | Change |
|------|-----|--------|
| SiteBuilderEditor.tsx | 779 (+70) | "Open Live Preview" button; loads `widget_client_id` on edit; post-generation assistant selector with auto-save; added `ArrowTopRightOnSquareIcon`, `GlobeAltIcon` imports |
| SitesPage.tsx | 374 (+15) | "Preview" button on generated/deployed site cards; added `EyeIcon` import; uses `window.open()` with `?token=` param |

### Security Notes

| Concern | Mitigation |
|---------|------------|
| JWT in URL query string | Token is passed via `?token=` only for the preview endpoint (HTML page served in a new tab). The token is short-lived and only used for ownership verification. No sensitive data is exposed in server logs since the endpoint returns HTML, not JSON. |
| Preview endpoint auth | Manually verifies JWT using `jsonwebtoken.verify()` — does not use `requireAuth` middleware (which expects `Authorization` header). Checks both `userId` and `id` claims for compatibility. |

### API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `/:siteId/preview` | GET | **NEW** — Serves generated HTML as `text/html` with token-based auth |
| `/:siteId` | PUT | **UPDATED** — Now accepts `widgetClientId` in body for assistant management |

---

## Version 2.0.0 — Async Generation & Site List Dashboard (2026-03-07)

### Breaking Changes

| Change | Detail |
|--------|--------|
| **AI model switched** | `qwen2.5-coder:7b` → `qwen2.5:3b-instruct` (already pinned in RAM, 8.7 tok/s vs 5.3 tok/s on CPU) |
| **Env var renamed** | `OLLAMA_MODEL` → `SITE_BUILDER_OLLAMA_MODEL` (dedicated config, defaults to `qwen2.5:3b-instruct`) |
| **API changed** | Ollama `/api/generate` → `/api/chat` (system + user messages for better instruction following) |
| **generate-ai response** | Was synchronous `{ html }`. Now async `{ success, generating, siteId, message }`. HTML is stored in DB and retrieved via polling. |

### New Features

| Feature | Description |
|---------|-------------|
| **Async AI generation** | `POST /generate-ai` returns immediately. Background IIFE runs Ollama, stores result in DB. Frontend polls for completion. |
| **Generation status polling** | New `GET /:siteId/generation-status` endpoint — returns status + html or error |
| **SitesPage dashboard** | New `SitesPage.tsx` (359 LOC) — landing page list with rich status badges, logo thumbnails, relative timestamps, auto-polling |
| **5-state status badges** | Draft (slate), Generating… (blue, animated pulse), Ready to Deploy (amber), Live (green), Failed (red) |
| **Auto-poll on list** | SitesPage auto-polls every 4s while any site has `'generating'` status, stops when done |
| **generated_html DB column** | LONGTEXT column stores AI-generated HTML directly in `generated_sites` table — no temp files needed |
| **generation_error column** | VARCHAR(2000) stores human-readable error messages for failed generations |
| **'generating' status** | New ENUM value in `status` column to track in-progress AI generation |
| **Auto-migration** | Route file auto-adds new columns + ENUM value on startup (no manual migration needed) |
| **ESM __dirname fix** | Proper `fileURLToPath(import.meta.url)` polyfill for path resolution in ESM module |
| **List excludes HTML** | `GET /` (list) omits `generated_html` column for performance |
| **SweetAlert notifications** | Loading modal during generation, success/error on completion, 10-min max poll |

### Performance Improvements

| Metric | Before (v1.0) | After (v2.0) |
|--------|---------------|--------------|
| AI model | qwen2.5-coder:7b (4.8GB) | qwen2.5:3b-instruct (2.2GB, already in RAM) |
| Generation speed | 5.3 tok/s | 8.7 tok/s |
| Typical generation time | 15–25 min (often timeout) | ~2 min |
| Max tokens | 8,192 (wasteful) | 4,096 (ample for landing pages) |
| Timeout | 180s (caused failures) | 600s (10 min safety margin) |
| API endpoint | `/api/generate` (single prompt) | `/api/chat` (system + user messages) |
| Temperature | 0.3 | 0.4 (slightly more creative layouts) |
| UX during generation | Blocking spinner, network timeout | Async + poll + SweetAlert notification |

### Bug Fixes

| Bug | Fix |
|-----|-----|
| **Image uploads not displaying (NS_BINDING_ABORTED)** | Multer wrote to `/var/www/code/uploads/sites/` but Express served from `__dirname/../uploads/`. Fixed path to resolve correctly via ESM-compatible `__dirname` polyfill. |
| **`__dirname` undefined in ESM** | Added `const __dirname = path.dirname(fileURLToPath(import.meta.url))` — required because `package.json` has `"type": "module"`. |
| **Upload path double-off** | Route file is in `dist/routes/`, needs `../..` to reach project root. Fixed `SITE_UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'sites')`. |
| **Network timeout on generation** | Old 180s timeout was too short for 7B model on CPU. Switched to 3B model + 600s timeout. |
| **Frontend field mapping** | SitesPage now uses correct snake_case field names from backend (`business_name`, `created_at`, etc.) instead of mismatched camelCase. |

### Database Changes

| Change | Type | SQL |
|--------|------|-----|
| Add `generated_html` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN generated_html LONGTEXT NULL AFTER ftp_directory` |
| Add `generation_error` | ALTER TABLE | `ALTER TABLE generated_sites ADD COLUMN generation_error VARCHAR(2000) NULL AFTER generated_html` |
| Expand `status` ENUM | ALTER TABLE | `ALTER TABLE generated_sites MODIFY COLUMN status ENUM('draft','generating','generated','deployed','failed') NOT NULL DEFAULT 'draft'` |

### Service Layer Changes

| Method | Description |
|--------|-------------|
| `setGenerating(siteId)` | Marks site as 'generating', clears previous errors |
| `storeGeneratedHtml(siteId, html)` | Stores HTML, sets status to 'generated' |
| `setGenerationError(siteId, error)` | Stores error message, sets status to 'failed' |

### Files Changed

| File | LOC | Change |
|------|-----|--------|
| siteBuilder.ts | 663 (+70) | Async generation, chat API, ESM fix, status polling endpoint, auto-migration |
| siteBuilderService.ts | 621 (+31) | New methods: setGenerating, storeGeneratedHtml, setGenerationError; updated interface |
| SiteBuilderEditor.tsx | 709 (+70) | Async generate flow, SweetAlert polling, load generated_html from DB |
| SitesPage.tsx | 359 (NEW) | Full landing page list dashboard with status badges and auto-polling |
| env.ts | 110 (+2) | Added `SITE_BUILDER_OLLAMA_MODEL` with default |
| .env | — | Added `SITE_BUILDER_OLLAMA_MODEL=qwen2.5:3b-instruct` |

---

## Version 1.0.0 — Initial Release (2026-03-08)

### Features

| Feature | Description |
|---------|-------------|
| **Site CRUD** | Create, read, update, delete website records with full business data |
| **Template Generation** | Server-side HTML/CSS generation from form data with theme color support |
| **AI Generation** | AI-powered full-page website creation via `qwen2.5-coder:7b` (Ollama) |
| **Image Uploads** | Logo and hero image upload with multer (5MB limit, JPEG/PNG/GIF/WEBP) |
| **FTP Deployment** | FTP/SFTP deployment with encrypted credential storage (AES-256-GCM) |
| **Deployment History** | Full audit log of deployment attempts with timing and file counts |
| **Live Preview** | Sandboxed iframe preview of generated/AI websites in the editor |
| **HTML Download** | Browser-based download of generated HTML as a file |
| **Widget Embedding** | SoftAware chat assistant automatically embedded in generated sites |
| **Contact Form** | Lead capture form in generated sites → `leads/submit` API |
| **Ownership Security** | All `:siteId` endpoints verify user ownership; 404 on mismatch |

### Database

| Table | Description |
|-------|-------------|
| `generated_sites` | 22-column site record with encrypted FTP creds, status tracking |
| `site_deployments` | Deployment history with per-attempt status, file counts, duration |

### AI Configuration (v1.0 — superseded in v2.0)

| Setting | Value |
|---------|-------|
| Model | `qwen2.5-coder:7b` |
| Temperature | 0.3 |
| Max tokens | 8,192 |
| Timeout | 180 seconds |
| CSS framework | Tailwind CSS via CDN |

### Files

| File | LOC | Purpose |
|------|-----|---------|
| siteBuilder.ts | 593 | API endpoints (11 routes) |
| siteBuilderService.ts | 590 | Core service layer |
| ftpDeploymentService.ts | ~200 | FTP/SFTP upload engine |
| 002_site_builder.ts | 112 | Database migration |
| SiteBuilderEditor.tsx | 639 | Frontend page component |

### Known Limitations (resolved in later versions)

| Issue | Status | Resolution |
|-------|--------|------------|
| AI generation takes 30–120s on CPU | ✅ Resolved v2.0 | Switched to 3B model (~2 min) + async flow |
| No image cleanup on site deletion | ⚠ Open | Manual cleanup still needed |
| Single-page generation only | ✅ Resolved v3.0 | Multi-page websites with tier-gated quotas |
| No preview for template generation | ✅ Resolved v2.1 | Live preview endpoint |
| No way to change assistant after generation | ✅ Resolved v2.1 | Post-gen assistant selector |
| Assistant dropdown resets on reload | ✅ Resolved v2.1 | `widget_client_id` loaded from DB |
| FTP credentials stored per-site | ⚠ Open | Re-enter for each site |
| No site list page | ✅ Resolved v2.0 | SitesPage.tsx added |
| No admin management | ✅ Resolved v3.0 | Full admin panel with stats, search, override |
| Client-supplied tier trusted | ✅ Resolved v3.0 | Server-side `resolveUserTier()` |
| No trial lifecycle management | ✅ Resolved v3.0 | Auto-downgrade + 3-day warnings |
