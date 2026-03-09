# Site Builder Module — File Inventory

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total files** | 7 (3 backend + 1 migration + 2 frontend + 1 barrel export) |
| **Total LOC** | ~2,799 (source) |
| **Backend route files** | 1 (693 LOC) |
| **Backend service files** | 2 (636 LOC + 206 LOC) |
| **Frontend files** | 2 (779 LOC + 374 LOC) |
| **Migration files** | 1 (111 LOC) |

### Directory Tree

```
Backend:
  src/routes/siteBuilder.ts                (693 LOC)  ⭐ Async AI gen, CRUD, image upload, deploy, preview, auto-migration
  src/services/siteBuilderService.ts       (636 LOC)  ⭐ CRUD, HTML storage, status management, widgetClientId update
  src/services/ftpDeploymentService.ts     (206 LOC)  ⭐ FTP/SFTP file upload engine
  src/db/migrations/002_site_builder.ts    (111 LOC)  Migration: generated_sites + site_deployments
  src/config/env.ts                        (110 LOC)  SITE_BUILDER_OLLAMA_MODEL env var
  src/utils/cryptoUtils.ts                 (shared)   AES-256-GCM encrypt/decrypt

Frontend:
  src/pages/portal/SitesPage.tsx           (374 LOC)  ⭐ Site list dashboard with status badges, preview button, auto-poll
  src/pages/portal/SiteBuilderEditor.tsx   (779 LOC)  ⭐ Editor: form, image upload, async AI gen, live preview, assistant mgmt, deploy
  src/pages/portal/index.ts                (barrel)   Re-exports SiteBuilderEditor + SitesPage

Upload Directory:
  /var/opt/backend/uploads/sites/          (runtime)  Uploaded logo/hero images (served via Express static)
  /var/tmp/generated_sites/{siteId}/       (runtime)  Generated HTML/CSS files (pre-deployment, template path)
```

---

## 2. Backend Files

### 2.1 `src/routes/siteBuilder.ts` — Site Builder API Endpoints

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/routes/siteBuilder.ts` |
| **LOC** | 693 |
| **Purpose** | Full CRUD, image uploads, async AI website generation, live HTML preview, static file generation, FTP deployment, auto-migration |
| **Dependencies** | express, multer, axios, jsonwebtoken, path, url (fileURLToPath), fs/promises, siteBuilderService, ftpDeploymentService, requireAuth, env, db |
| **Exports** | `default` (Express router) |

#### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | JWT | Create new site record |
| GET | / | JWT | List user's sites (excludes generated_html) |
| GET | /:siteId | JWT | Get single site (ownership verified) |
| PUT | /:siteId | JWT | Update site data |
| DELETE | /:siteId | JWT | Delete site + generated files |
| POST | /:siteId/generate | JWT | Generate static HTML/CSS files |
| POST | /:siteId/deploy | JWT | Deploy via FTP/SFTP |
| GET | /:siteId/deployments | JWT | Get deployment history |
| GET | /:siteId/generation-status | JWT | Poll AI generation progress |
| GET | /:siteId/preview | JWT or `?token=` | **NEW v2.1** — Serve generated HTML as full page in browser tab |
| POST | /upload/logo | JWT | Upload logo (multer, 5MB, JPEG/PNG/GIF/WEBP) |
| POST | /upload/hero | JWT | Upload hero image |
| POST | /generate-ai | JWT | Async AI generation via Ollama Chat API |

#### Multer Config

| Setting | Value |
|---------|-------|
| Storage | Disk (`/var/opt/backend/uploads/sites/` — ESM-resolved via `__dirname`) |
| Max file size | 5 MB |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Filename | `{timestamp}-{random}{ext}` |

#### Auto-Migration on Startup

The route file includes an IIFE that runs on import:
1. Checks for `generated_html` column → adds if missing (LONGTEXT)
2. Checks for `generation_error` column → adds if missing (VARCHAR 2000)
3. Modifies `status` ENUM to include `'generating'`

---

### 2.2 `src/services/siteBuilderService.ts` — Core Service Layer

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/services/siteBuilderService.ts` |
| **LOC** | 636 |
| **Purpose** | CRUD operations, HTML/CSS template generation, FTP credential management, async generation status, widget_client_id updates |
| **Dependencies** | crypto, db/mysql, utils/cryptoUtils, path, fs/promises |
| **Exports** | `siteBuilderService` (singleton object), `GeneratedSite`, `SiteData` |

#### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `createSite(data)` | `GeneratedSite` | Create site record with encrypted FTP password, validate widget_client_id |
| `getSiteById(siteId)` | `GeneratedSite \| null` | Get by ID |
| `getSitesByUserId(userId)` | `GeneratedSite[]` | List user's sites |
| `updateSite(siteId, data)` | `void` | Partial update with dynamic SET clause |
| `generateStaticFiles(siteId)` | `string` (output dir) | Build HTML + CSS files on disk, update status → `generated` |
| `buildHTML(site)` | `string` | Template-based HTML with business data, contact form, widget script |
| `buildCSS(site)` | `string` | Theme-colored CSS with responsive breakpoints |
| `adjustBrightness(hex, percent)` | `string` | Utility: darken/lighten hex color for gradients |
| `deleteSite(siteId)` | `void` | Delete DB record + clean up generated files |
| `getDecryptedFTPCredentials(site)` | `object \| null` | Decrypt FTP password in-memory only |
| `setGenerating(siteId)` | `void` | **NEW** — Mark site as 'generating', clear previous errors |
| `storeGeneratedHtml(siteId, html)` | `void` | **NEW** — Store HTML in DB, set status to 'generated' |
| `setGenerationError(siteId, error)` | `void` | **NEW** — Store error message, set status to 'failed' |
| `deleteSite(siteId)` | `void` | Delete DB record + clean up generated files |
| `getDecryptedFTPCredentials(site)` | `object \| null` | Decrypt FTP password in-memory only (used during deployment) |

#### Built-in HTML Template

The `buildHTML()` function generates a complete landing page with:
- Header with optional logo
- Hero section with gradient background (theme color) and optional hero image
- About Us section (if provided)
- Services section (if provided)
- Contact form → `https://api.softaware.net.za/v1/leads/submit` with honeypot field
- Footer with copyright and "Powered by Soft Aware" link
- Optional SoftAware chat widget `<script>` tag

---

### 2.3 `src/db/migrations/002_site_builder.ts` — Migration

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/backend/src/db/migrations/002_site_builder.ts` |
| **LOC** | 112 |
| **Purpose** | Creates `generated_sites` and `site_deployments` tables |
| **Engine** | InnoDB, utf8mb4_unicode_ci |

Creates:
- `generated_sites` — main site data with encrypted FTP creds
- `site_deployments` — deployment history log

See [FIELDS.md](FIELDS.md) for full schema.

---

## 3. Frontend Files

### 3.1 `src/pages/portal/SitesPage.tsx` — Site List Dashboard (NEW in v2.0)

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/SitesPage.tsx` |
| **LOC** | 374 |
| **Purpose** | Landing page list/dashboard with rich status badges, logo thumbnails, live preview button, auto-polling for generating sites |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2 |
| **Route** | `/portal/sites` |

#### Features

| Feature | Description |
|---------|-------------|
| **5-state status badges** | Draft (slate), Generating… (blue+pulse), Ready to Deploy (amber), Live (green), Failed (red) |
| **Logo thumbnails** | Shows logo image if uploaded, otherwise gradient placeholder with initials |
| **Relative timestamps** | "just now", "5m ago", "2h ago", "3d ago" via `timeAgo()` helper |
| **Auto-polling** | Polls `GET /api/v1/sites` every 4s while any site has `status='generating'`, stops automatically |
| **Error display** | Failed sites show `generation_error` in tooltip and subtitle |
| **Live preview button** | **NEW v2.1** — "Preview" button on generated/deployed sites opens full page in new tab via `?token=` auth |
| **Delete with confirmation** | SweetAlert confirm dialog before deletion |
| **Loading skeleton** | Animated placeholder cards while data loads |
| **Empty state** | Friendly illustration + "Create your first site" CTA |

#### Component State

| State | Type | Purpose |
|-------|------|---------|
| sites | Site[] | Loaded site list |
| loading | boolean | Initial load indicator |
| pollRef | ref | Interval timer for auto-polling |

#### Interface: Site (matches backend snake_case)

```typescript
interface Site {
  id: string;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  generation_error: string | null;
  deployment_error: string | null;
  ftp_server: string | null;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

---

### 3.2 `src/pages/portal/SiteBuilderEditor.tsx` — Site Builder UI

| Property | Value |
|----------|-------|
| **Location** | `/var/opt/frontend/src/pages/portal/SiteBuilderEditor.tsx` |
| **LOC** | 779 |
| **Purpose** | Full site builder page: business info form, image uploads, async AI generation with polling, live preview (iframe + new tab), post-generation assistant management, FTP deployment |
| **Dependencies** | React, react-router-dom, @heroicons/react, sweetalert2 |
| **Routes** | `/portal/sites/new` (create), `/portal/sites/:siteId/edit` (edit) |

#### Component State

| State | Type | Purpose |
|-------|------|---------|
| businessName, tagline, aboutText, services | string | Form fields |
| logoUrl, heroImageUrl | string | Uploaded image URLs |
| uploadingLogo, uploadingHero | boolean | Upload progress |
| generating | boolean | AI generation in progress |
| generatedHtml | string | AI-generated HTML output (loaded from DB or live) |
| showPreview | boolean | Toggle iframe preview |
| showDeployForm | boolean | FTP deploy modal visibility |
| deploying | boolean | Deployment in progress |
| ftpServer, ftpProtocol, ftpPort, ftpUsername, ftpPassword, ftpDirectory | FTP config | Deploy credentials |
| assistants | array | Available AI assistants for widget embed |
| selectedAssistantId | string | Chosen assistant for widget |
| savedSiteId | string \| null | Site ID after first save |

#### Key Flows (v2.0)

1. **Create flow:** Fill form → "Generate with AI" → auto-saves site record → calls `/generate-ai` (async) → SweetAlert loading modal → polls `/generation-status` every 4s → success notification + preview
2. **Edit flow:** Load existing site + `generated_html` from DB → modify fields → regenerate/redeploy
3. **Deploy flow:** "Deploy via FTP" → modal with credentials → saves creds → generates static files → uploads via FTP/SFTP
4. **Download flow:** "Download HTML" → creates Blob → triggers browser download
5. **Poll timeout:** 10-minute max → shows "taking too long" warning

---

## 4. Code Statistics

| Category | Files | Lines of Code |
|----------|-------|---------------|
| Route files | 1 | 693 |
| Service files | 2 | ~842 |
| Migration | 1 | 111 |
| Config (env.ts) | 1 | 110 (shared) |
| Frontend pages | 2 | 1,153 |
| **Total** | **7** | **~2,799** |
