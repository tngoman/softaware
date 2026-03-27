# Site Builder Module — File Inventory

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 14 (4 backend routes/services + 1 template + 1 migration + 6 frontend + 1 barrel + 1 shared service) |
| **Total LOC** | ~6,856 (SiteBuilder-specific) + 756 (shared packages.ts) |
| **Backend route files** | 2 (2,118 LOC + 271 LOC) |
| **Backend service files** | 3 (910 LOC + 369 LOC + 310 LOC) |
| **Frontend files** | 6 (623 + 1,077 + 459 + 395 + 334 + 380 LOC) |
| **Migration files** | 1 (111 LOC) |

### Directory Tree

```
Backend:
  src/routes/siteBuilder.ts                (2,118 LOC)  ⭐ CRUD, AI gen, multi-page, form submissions, upload, deploy, preview, auto-migration
  src/routes/adminSites.ts                 (  271 LOC)  ⭐ Admin stats, search, override, delete, trials          ★ NEW
  src/services/siteBuilderService.ts       (  910 LOC)  ⭐ CRUD, pages, HTML storage, navigation, status mgmt
  src/services/siteBuilderTemplate.ts      (  369 LOC)  ⭐ HTML template with conditional form/assistant           ★ UPDATED v3.1
  src/services/ftpDeploymentService.ts     (  310 LOC)  ⭐ FTP/SFTP file upload engine
  src/services/packages.ts                 (  756 LOC)  ⭐ resolveUserTier(), enforceTrialExpiry() (shared)       ★ USED
  src/services/emailService.ts             (shared)     Email sending via nodemailer (SMTP credentials from DB)  ★ USED v3.1
  src/db/migrations/002_site_builder.ts    (  111 LOC)  Migration: generated_sites + site_deployments
  src/config/env.ts                        (  110 LOC)  SITE_BUILDER_OLLAMA_MODEL env var (shared)
  src/utils/cryptoUtils.ts                 (shared)     AES-256-GCM encrypt/decrypt

Frontend:
  src/pages/portal/SitesPage.tsx           (  623 LOC)  ⭐ Site list dashboard with status badges, preview, auto-poll
  src/pages/portal/SiteBuilderEditor.tsx   (1,077 LOC)  ⭐ Editor: form, images, form config, assistant toggle, async AI gen
  src/pages/portal/WebsiteManager.tsx      (  459 LOC)  ⭐ Multi-page management, tier gating, submissions link    ★ UPDATED v3.1
  src/pages/portal/PageEditor.tsx          (  395 LOC)  ⭐ Per-page editor: type-specific fields, AI gen, preview  ★ NEW
  src/pages/portal/FormSubmissions.tsx     (  334 LOC)  ⭐ Inbox-style form submissions viewer                     ★ NEW v3.1
  src/pages/admin/AdminSites.tsx           (  380 LOC)  ⭐ Admin site management, stats, search, actions           ★ NEW
  src/pages/portal/index.ts               (   11 LOC)  Barrel: re-exports all portal page components

Upload Directory:
  /var/opt/backend/uploads/sites/          (runtime)    Uploaded logo/hero images (served via Express static)
  /var/tmp/generated_sites/{siteId}/       (runtime)    Generated HTML/CSS files (pre-deployment, template path)
```

---

## 2. Backend Files

### 2.1 `src/routes/siteBuilder.ts` — Site Builder API Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/siteBuilder.ts` |
| **LOC** | 2,118 |
| **Purpose** | Full CRUD, tier resolution, multi-page CRUD, image uploads, tiered async AI website generation, form submission processing, AI polish, live HTML preview, static file generation, FTP deployment, auto-migration |
| **Dependencies** | express, multer, axios, jsonwebtoken, crypto, path, url (fileURLToPath), fs/promises, siteBuilderService, siteBuilderTemplate, ftpDeploymentService, emailService, requireAuth, env, db, resolveUserTier (from packages) |
| **Exports** | `default` (Express router) |

#### Endpoints (27)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | JWT | Create new site record (auto max_pages via tier) |
| GET | /tier | JWT | **NEW** — Get user's subscription tier info |
| GET | / | JWT | List user's sites (excludes generated_html) |
| GET | /:siteId | JWT | Get single site (ownership verified) |
| PUT | /:siteId | JWT | Update site data |
| DELETE | /:siteId | JWT | Delete site + generated files |
| POST | /generate-ai | JWT | Async AI generation (tiered: GLM/OpenRouter/Ollama) |
| GET | /:siteId/generation-status | JWT | Poll AI generation progress |
| POST | /:siteId/generate | JWT | Generate static HTML/CSS files (template) |
| POST | /:siteId/skip-queue | JWT | **NEW** — Re-trigger as paid priority |
| POST | /:siteId/polish | JWT | **NEW** — AI design polish with prompt |
| GET | /:siteId/preview | JWT or `?token=` | Serve generated HTML as full page |
| POST | /:siteId/deploy | JWT | Deploy via FTP/SFTP |
| GET | /:siteId/deployments | JWT | Get deployment history |
| POST | /upload/logo | JWT | Upload logo (multer, 5MB) |
| POST | /upload/hero | JWT | Upload hero image |
| GET | /:siteId/pages | JWT | **NEW** — List site pages |
| POST | /:siteId/pages | JWT | **NEW** — Create page (tier-gated) |
| GET | /:siteId/pages/:pageId | JWT | **NEW** — Get page details |
| PUT | /:siteId/pages/:pageId | JWT | **NEW** — Update page |
| DELETE | /:siteId/pages/:pageId | JWT | **NEW** — Delete page |
| POST | /:siteId/pages/:pageId/generate | JWT | **NEW** — AI generate single page |
| PATCH | /:siteId/max-pages | JWT | Update max_pages (admin) |
| POST | /forms/submit | None | **v3.1** — Public form submission (no auth) |
| GET | /:siteId/submissions | JWT | **v3.1** — List form submissions (paginated) |
| PATCH | /:siteId/submissions/:id/read | JWT | **v3.1** — Mark submission as read |
| DELETE | /:siteId/submissions/:id | JWT | **v3.1** — Delete submission |

#### Auto-Migration on Startup

The route file includes an IIFE that runs on import:
1. Checks for `generated_html` column → adds if missing (LONGTEXT)
2. Checks for `generation_error` column → adds if missing (VARCHAR 2000)
3. Checks for `form_config` column → adds if missing (JSON NULL)
4. Checks for `include_form` column → adds if missing (TINYINT(1) DEFAULT 1)
5. Checks for `include_assistant` column → adds if missing (TINYINT(1) DEFAULT 0)
6. Checks for `max_pages` column → adds if missing (INT DEFAULT 1)
7. Modifies `status` ENUM to include `'generating'`
8. Creates `site_pages` table if it doesn't exist
9. Creates `site_form_submissions` table if it doesn't exist

---

### 2.2 `src/routes/adminSites.ts` — Admin Site Management ★ NEW v3.0

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/adminSites.ts` |
| **LOC** | 271 |
| **Purpose** | Admin-level access to all generated sites across all users — stats, paginated list, override, delete, trial monitoring |
| **Dependencies** | express, requireAuth, AuthRequest, db, siteBuilderService |
| **Exports** | `adminSitesRouter` (Express router) |
| **Registered at** | `/api/admin/sites` with `auditLogger` middleware |

#### Middleware

- `requireAdmin` — Queries `users.role` and requires `admin`, `staff`, or `developer`

#### Endpoints (6)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /stats | Aggregate site statistics (7 metrics) |
| GET | / | List all sites with owner info, pagination, search & filter |
| GET | /:siteId | Get full site + pages (admin view) |
| PATCH | /:siteId | Admin override — update status, max_pages |
| DELETE | /:siteId | Force-delete site + pages + deployments |
| GET | /trials/active | List sites owned by users on active trials with days_left |

---

### 2.3 `src/services/siteBuilderService.ts` — Core Service Layer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/siteBuilderService.ts` |
| **LOC** | 910 |
| **Purpose** | CRUD operations, multi-page CRUD, HTML/CSS template generation, navigation injection, FTP credential management, async generation status, widget_client_id updates, form config persistence |
| **Dependencies** | crypto, db/mysql, utils/cryptoUtils, path, fs/promises |
| **Exports** | `siteBuilderService` (singleton object), `GeneratedSite`, `SitePage`, `SiteData` |

#### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `createSite(data)` | `GeneratedSite` | Create site record with encrypted FTP password |
| `getSiteById(siteId)` | `GeneratedSite \| null` | Get by ID |
| `getSitesByUserId(userId)` | `GeneratedSite[]` | List user's sites |
| `updateSite(siteId, data)` | `void` | Partial update with dynamic SET clause |
| `generateStaticFiles(siteId)` | `string` (output dir) | Build HTML + CSS files on disk |
| `buildHTML(site)` | `string` | Template-based HTML with business data |
| `buildCSS(site)` | `string` | Theme-colored CSS |
| `adjustBrightness(hex, percent)` | `string` | Utility: darken/lighten hex color |
| `deleteSite(siteId)` | `void` | Delete DB record + clean up generated files |
| `getDecryptedFTPCredentials(site)` | `object \| null` | Decrypt FTP password in-memory only |
| `setGenerating(siteId)` | `void` | Mark site as 'generating', clear previous errors |
| `storeGeneratedHtml(siteId, html)` | `void` | Store HTML in DB, set status to 'generated' |
| `setGenerationError(siteId, error)` | `void` | Store error message, set status to 'failed' |
| `injectNavigation(html, navLinks, currentSlug)` | `string` | **NEW** — Inject nav bar HTML into generated page |
| `getPagesBySiteId(siteId)` | `SitePage[]` | **NEW** — Get all pages, ordered by sort_order |
| `getPageById(pageId)` | `SitePage \| null` | **NEW** — Get single page |
| `getPageCount(siteId)` | `number` | **NEW** — Count pages for quota enforcement |
| `createPage(data)` | `SitePage` | **NEW** — Create page with auto sort_order |
| `updatePage(pageId, data)` | `void` | **NEW** — Partial page update |
| `deletePage(pageId)` | `void` | **NEW** — Delete page |
| `getMaxPages(siteId)` | `number` | **NEW** — Get max_pages from generated_sites |
| `setMaxPages(siteId, maxPages)` | `void` | **NEW** — Update max_pages limit |

---

### 2.4 `src/services/siteBuilderTemplate.ts` — HTML Template Engine ★ UPDATED v3.1

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/siteBuilderTemplate.ts` |
| **LOC** | 369 |
| **Purpose** | Generates complete responsive HTML5 landing pages with conditional contact form and AI chat widget. Supports custom form fields, dynamic form submission via fetch API, and configurable form/assistant toggles. |
| **Dependencies** | None (pure template function) |
| **Exports** | `generateSiteHtml()`, `FormFieldConfig`, `FormConfig` |

#### Key Interfaces

| Interface | Fields | Description |
|-----------|--------|-------------|
| `FormFieldConfig` | name, label, type, required, placeholder?, options? | Defines a single form field |
| `FormConfig` | fields, destinationEmail, autoReplyMessage?, submitButtonText? | Full form configuration |

#### Conditional Rendering (v3.1)

| Flag | Default | Controls |
|------|---------|----------|
| `includeForm` | `true` | Contact section, nav contact link, hero CTA button |
| `includeAssistant` | `false` | AI chat widget `<script>` tag injection |

#### Form Submission Target

Form submissions use JavaScript `fetch()` to POST JSON to `/api/v1/sites/forms/submit` with `site_id`, `bot_check_url` (honeypot), and all form fields. Success/error messages displayed inline.

---

### 2.5 `src/services/ftpDeploymentService.ts` — FTP/SFTP Deployment

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/ftpDeploymentService.ts` |
| **LOC** | 310 |
| **Purpose** | FTP/SFTP file upload engine with progress tracking |
| **Dependencies** | ftp, ssh2-sftp-client, fs/promises, path |
| **Exports** | `ftpDeploymentService` |

---

### 2.6 `src/services/packages.ts` — Tier Resolution (Shared) ★ USED v3.0

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/packages.ts` |
| **LOC** | 756 |
| **Purpose** | Package subscription management, tier resolution for site builder, trial expiry enforcement |
| **Key Functions (SiteBuilder-relevant)** | |

| Function | Returns | Description |
|----------|---------|-------------|
| `resolveUserTier(userId)` | `{ tier, maxPages, packageSlug, status, daysLeft }` | **NEW** — Server-side tier resolution from `contact_packages` → `packages` |
| `enforceTrialExpiry()` | `void` | **UPDATED** — Now also downgrades `max_pages → 1` on all expired users' sites |
| `sendTrialExpiryWarnings()` | `void` | **NEW** — Sends notifications 3 days before trial ends |

---

### 2.7 `src/db/migrations/002_site_builder.ts` — Migration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/002_site_builder.ts` |
| **LOC** | 111 |
| **Purpose** | Creates `generated_sites` and `site_deployments` tables |
| **Engine** | InnoDB, utf8mb4_unicode_ci |

> **Note:** The `site_pages` table, `max_pages` column, form config columns (`form_config`, `include_form`, `include_assistant`), and `site_form_submissions` table are created via auto-migration in `siteBuilder.ts` on startup (not in this migration file).

---

## 3. Frontend Files

### 3.1 `src/pages/portal/SitesPage.tsx` — Site List Dashboard

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/SitesPage.tsx` |
| **LOC** | 623 |
| **Purpose** | Landing page list/dashboard with rich status badges, logo thumbnails, live preview button, auto-polling for generating sites |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2 |
| **Route** | `/portal/sites` |

#### Features

| Feature | Description |
|---------|-------------|
| **5-state status badges** | Draft (slate), Generating… (blue+pulse), Ready to Deploy (amber), Live (green), Failed (red) |
| **Logo thumbnails** | Shows logo image if uploaded, otherwise gradient placeholder with initials |
| **Auto-polling** | Polls `GET /api/v1/sites` every 4s while any site has `status='generating'` |
| **Live preview button** | "Preview" button opens full page in new tab via `?token=` auth |
| **Manage button** | Links to WebsiteManager for multi-page management |
| **Delete with confirmation** | SweetAlert confirm dialog before deletion |

---

### 3.2 `src/pages/portal/SiteBuilderEditor.tsx` — Site Builder UI

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/SiteBuilderEditor.tsx` |
| **LOC** | 1,077 |
| **Purpose** | Full site builder page: business info form, image uploads, contact form configuration (toggle, custom fields, destination email, auto-reply), AI assistant toggle, async AI generation with polling, live preview (iframe + new tab), post-generation assistant management, FTP deployment |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2 |
| **Routes** | `/portal/sites/new` (create), `/portal/sites/:siteId/edit` (edit) |

#### Key Flows

1. **Create flow:** Fill form → "Generate with AI" → auto-saves site record → calls `/generate-ai` (async) → SweetAlert loading modal → polls `/generation-status` every 4s → success notification + preview
2. **Edit flow:** Load existing site + `generated_html` from DB → modify fields → regenerate/redeploy
3. **Deploy flow:** "Deploy via FTP" → modal with credentials → saves creds → generates static files → uploads via FTP/SFTP
4. **Download flow:** "Download HTML" → creates Blob → triggers browser download

---

### 3.3 `src/pages/portal/WebsiteManager.tsx` — Multi-Page Management ★ NEW v3.0

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/WebsiteManager.tsx` |
| **LOC** | 459 |
| **Purpose** | Multi-page website management view — page tree, tier-gated page creation, quota tracking, trial warnings, submissions link |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2, axios |
| **Route** | `/portal/sites/:siteId/manage` |

#### Features

| Feature | Description |
|---------|-------------|
| **Page tree** | Lists all pages sorted by sort_order with type badges and published status |
| **Tier-gated "Add Page"** | SweetAlert form with title, type dropdown, slug; disabled if quota reached |
| **Quota progress bar** | Shows `currentCount / maxPages` with color coding (green → amber → red) |
| **Free-tier upsell** | Card showing locked page types with upgrade CTA |
| **Trial warning banner** | Red if ≤3 days left, amber otherwise; shows days remaining |
| **Per-page actions** | AI generate, edit (→ PageEditor), delete with confirmation |
| **Preview button** | Opens full site preview in new tab |
| **Submissions button** | Links to FormSubmissions page for viewing form submissions ★ v3.1 |

---

### 3.4 `src/pages/portal/PageEditor.tsx` — Per-Page Content Editor ★ NEW v3.0

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/PageEditor.tsx` |
| **LOC** | 395 |
| **Purpose** | Per-page content editor with type-specific fields, AI generation, save/publish controls |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2, axios |
| **Route** | `/portal/sites/:siteId/pages/:pageId` |

#### Type-Specific Content Fields

| Page Type | Fields |
|-----------|--------|
| About | heading, story, mission, team |
| Services | heading, intro, services list |
| Contact | heading, address, phone, email, hours |
| Gallery | heading, images array |
| FAQ | heading, questions array |
| Pricing | heading, plans array |
| Custom | heading, custom content (free-text) |

#### Features

| Feature | Description |
|---------|-------------|
| **Save** | Saves content_data to backend via `PUT /:siteId/pages/:pageId` |
| **AI Generate** | Generates page HTML using `POST /:siteId/pages/:pageId/generate`; auto-saves first |
| **Publish toggle** | Toggle `is_published` state |
| **Slug editor** | Editable URL slug with auto-sanitization |
| **Inline preview** | Sandboxed iframe showing generated HTML |

---

### 3.5 `src/pages/portal/FormSubmissions.tsx` — Form Submissions Viewer ★ NEW v3.1

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/FormSubmissions.tsx` |
| **LOC** | 334 |
| **Purpose** | Inbox-style form submissions viewer — list, filter, detail modal, mark-as-read, delete |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2, axios |
| **Route** | `/portal/sites/:siteId/submissions` |

#### Features

| Feature | Description |
|---------|-------------|
| **Inbox list** | Email-style rows with icon, name/email, preview, date |
| **Unread/All filter** | Toggle between showing all submissions or only unread |
| **Detail modal** | Click to view full submission data, auto-marks as read |
| **Delete** | SweetAlert confirmation before deletion |
| **Pagination** | Page navigation for large submission lists |
| **Empty state** | Friendly message when no submissions exist |
| **Back link** | Returns to WebsiteManager (`/portal/sites/:siteId/manage`) |

---

### 3.6 `src/pages/admin/AdminSites.tsx` — Admin Site Management ★ NEW v3.0

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/admin/AdminSites.tsx` |
| **LOC** | 380 |
| **Purpose** | Admin panel for managing all sites across all users — stats dashboard, search/filter, admin actions |
| **Dependencies** | React, @heroicons/react, sweetalert2, axios |
| **Route** | `/admin/sites` |

#### Features

| Feature | Description |
|---------|-------------|
| **7 stat cards** | Total Sites, Deployed, Generating, Failed, Total Pages, Trial Sites, Recent Deploys |
| **Search** | Filter by business name, owner email, owner name |
| **Status filter** | Dropdown filter by site status |
| **Pagination** | Paginated results with page size controls |
| **Status badges** | Color-coded badges matching portal SitesPage |
| **Page count** | Shows `page_count / max_pages` with click-to-edit |
| **Package info** | Shows package name + trial countdown (days_left) |
| **Admin actions** | Reset failed → draft, edit page limit (SweetAlert input), delete |

---

### 3.7 `src/pages/portal/index.ts` — Barrel Export

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/index.ts` |
| **LOC** | 11 |
| **Purpose** | Re-exports all portal page components including SiteBuilderEditor, SitesPage, WebsiteManager, PageEditor, FormSubmissions |

---

## 4. Code Statistics

| Category | Files | Lines of Code |
|----------|-------|---------------|
| Route files | 2 | 2,389 |
| Service files | 3 | 1,589 |
| Shared service (packages.ts) | 1 | 756 (partial) |
| Migration | 1 | 111 |
| Config (env.ts) | 1 | 110 (shared) |
| Frontend pages | 6 | 3,268 |
| Frontend barrel | 1 | 11 |
| **Total (SiteBuilder-specific)** | **14** | **~6,856** |

### LOC Growth by Version

| Version | Total LOC | Files | Change |
|---------|-----------|-------|--------|
| v1.0.0 | ~1,942 | 5 | Initial release |
| v2.0.0 | ~2,612 | 7 | +SitesPage, async gen, status polling |
| v2.1.0 | ~2,799 | 7 | +preview endpoint, assistant persistence |
| v3.0.0 | ~5,670 | 12 | +multi-page, admin, tiers, 5 new files, +2,871 LOC |
| v3.1.0 | ~6,856 | 14 | +form system, submissions, conditional form/assistant, +1,186 LOC |
