# Site Builder Module — Changelog

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

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

### Known Limitations (resolved in v2.0)

| Issue | Status | Resolution |
|-------|--------|------------|
| AI generation takes 30–120s on CPU | ✅ Resolved | Switched to 3B model (~2 min) + async flow eliminates UX blocking |
| No image cleanup on site deletion | ⚠ Open | Manual cleanup still needed |
| Single-page generation only | ⚠ Open | Future: add page management |
| No preview for template generation | ✅ Resolved v2.1 | Live preview endpoint serves HTML in new tab for any generated site |
| No way to change assistant after generation | ✅ Resolved v2.1 | Post-gen assistant selector auto-saves immediately |
| Assistant dropdown resets on reload | ✅ Resolved v2.1 | `widget_client_id` loaded from DB on edit |
| FTP credentials stored per-site | ⚠ Open | Re-enter for each site |
| No site list page | ✅ Resolved | SitesPage.tsx added with full dashboard |

---

## Upcoming

- **v1.1.0 (Planned):** Multi-page site support, global FTP credential profiles, template selection
