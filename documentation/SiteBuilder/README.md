# Site Builder Module — Overview

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## 1. Module Overview

### Purpose

The Site Builder module enables users to create, generate, and deploy **multi-page websites** with **configurable contact forms** and **form submission management**. Users provide business information (name, tagline, about, services) and the module uses AI to generate complete, responsive HTML5 pages **asynchronously**. Free-tier users get a single-page landing site (max 50 form submissions); paid-tier users unlock multi-page websites with up to 50 pages depending on their subscription package. Sites can be downloaded as HTML or deployed directly to a remote server via FTP/SFTP.

### Business Value

- **Multi-page websites** — paid-tier users can add About, Services, Contact, Gallery, FAQ, Pricing, and Custom pages with auto-injected navigation
- **Tier-gated page quotas** — Free = 1 page, Starter = 5, Pro = 15, Enterprise = 50; server-side enforcement via `resolveUserTier()`
- **Trial system with auto-downgrade** — paid users on trial get full access; on expiry, `max_pages` is downgraded to 1 automatically; 3-day warning notifications sent
- **Async AI website generation** — generation runs in background; frontend polls for status and notifies on completion (2–5 min on CPU)
- **Tiered AI models** — free users use Ollama (qwen2.5:3b-instruct); paid users get GLM→OpenRouter→Ollama fallback chain for higher quality
- **AI design polish** — post-generation prompt-based design tweaks via `POST /:siteId/polish`
- **Admin site management** — admin dashboard with aggregate stats, site search/filter/pagination, override controls, trial monitoring
- **Rich site list** — landing page dashboard with real-time status badges (Draft, Generating…, Ready to Deploy, Live, Failed), logo thumbnails, and auto-polling for in-progress sites
- **Per-page editor** — type-specific content forms (About: heading/story/mission/team; Services: heading/intro/list; Contact: heading/address/phone/email/hours; Gallery, FAQ, Pricing, Custom)
- **Configurable contact form** — optional contact form with custom fields (text, email, phone, textarea, select), destination email, and auto-reply message; form inclusion is controlled via `includeForm` toggle
- **Form submission system** — public submission endpoint with honeypot bot detection, IP rate limiting (10/10min), free-tier cap (50 per site), email notifications to site owner, and auto-reply to submitter
- **Form submissions viewer** — inbox-style portal page for viewing, reading, and managing form submissions per site
- **Optional AI chat widget** — generated sites include the SoftAware chat widget only when explicitly enabled via `includeAssistant` toggle (default: off)
- **FTP/SFTP deployment** — one-click deploy to any hosting provider with encrypted credentials (AES-256-GCM)
- **Image uploads** — logo and hero banner upload with CDN-served URLs (served via Express static mount)
- **Live preview in new tab** — open the full generated site in a real browser tab via `/preview` endpoint (token-authenticated)
- **Page-level AI generation** — individual pages can be generated/regenerated independently via `POST /:siteId/pages/:pageId/generate`
- **Ownership enforcement** — all operations verify the authenticated user owns the site

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route files | 2 (siteBuilder.ts 2,118 LOC, adminSites.ts 271 LOC) |
| Backend service files | 3 (siteBuilderService.ts 910 LOC, siteBuilderTemplate.ts 369 LOC, ftpDeploymentService.ts 310 LOC) |
| Backend migration | 1 (002_site_builder.ts, 111 LOC) |
| Tier resolution | packages.ts — `resolveUserTier()` (756 LOC total, shared) |
| Frontend files | 6 (SitesPage 623, SiteBuilderEditor 1,077, WebsiteManager 459, PageEditor 395, FormSubmissions 334, AdminSites 380 LOC) |
| Total LOC | ~6,856 (SiteBuilder-specific, excl. shared packages.ts) |
| API endpoints | 27 user-facing + 6 admin = 33 total |
| MySQL tables | 4 (generated_sites, site_pages, site_deployments, site_form_submissions) |
| AI Model (free) | `qwen2.5:3b-instruct` via Ollama |
| AI Model (paid) | GLM → OpenRouter → Ollama fallback chain |

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                  FRONTEND (React + Tailwind)                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  SitesPage.tsx (623 LOC) — Site list dashboard                  │  │
│  │  • Rich status badges (Draft/Generating/Ready/Live/Fail)        │  │
│  │  • Logo thumbnails, relative timestamps, auto-poll              │  │
│  │  • Edit → SiteBuilderEditor  |  Manage → WebsiteManager        │  │
│  └──────────────────────┬──────────────────────────────────────────┘  │
│                          │                                             │
│  ┌──────────────────────▼──────────────────────────────────────────┐  │
│  │  SiteBuilderEditor.tsx (1,077 LOC) — Site builder form           │  │
│  │  • Business info, image upload, assistant toggle                 │  │
│  │  • Contact form config: toggle, fields, destination, auto-reply  │  │
│  │  • "Generate with AI" → async + poll for result                  │  │
│  │  • Live iframe preview, FTP deploy, download HTML                │  │
│  └──────────────────────┬──────────────────────────────────────────┘  │
│                          │                                             │
│  ┌──────────────────────▼──────────────────────────────────────────┐  │
│  │  WebsiteManager.tsx (459 LOC) — Multi-page management  ★ NEW    │  │
│  │  • Page tree with sort_order, status, type badges               │  │
│  │  • Tier-gated "Add Page" with quota progress bar                │  │
│  │  • Free-tier upsell card, trial warning banner                  │  │
│  │  • Per-page AI generate, edit (→ PageEditor), delete            │  │
│  │  • "Submissions" button → FormSubmissions page      ★ v3.1     │  │
│  └──────────────────────┬──────────────────────────────────────────┘  │
│                          │                                             │
│  ┌──────────────────────▼──────────────────────────────────────────┐  │
│  │  PageEditor.tsx (395 LOC) — Per-page content editor   ★ NEW     │  │
│  │  • Type-specific content fields (About/Services/Contact/etc.)   │  │
│  │  • Save, AI generate with auto-save, publish toggle             │  │
│  │  • Slug editor, inline iframe preview                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  FormSubmissions.tsx (334 LOC) — Form submissions      ★ v3.1   │  │
│  │  • Inbox-style list with unread/all filter toggle               │  │
│  │  • Detail modal, mark-as-read, delete with confirmation         │  │
│  │  • Pagination, empty state, back link to WebsiteManager         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  AdminSites.tsx (380 LOC) — Admin site management     ★ NEW     │  │
│  │  • 7 stat cards (Total/Deployed/Generating/Failed/Pages/Trials) │  │
│  │  • Searchable/filterable paginated table with status badges     │  │
│  │  • Admin actions: reset failed, edit page limit, delete         │  │
│  │  • Trial countdown, package name display                        │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Routes:                                                               │
│  /portal/sites                 → SitesPage (list/dashboard)           │
│  /portal/sites/new             → SiteBuilderEditor (create)           │
│  /portal/sites/:id/edit        → SiteBuilderEditor (edit)             │
│  /portal/sites/:siteId/manage  → WebsiteManager (multi-page)  ★ NEW  │
│  /portal/sites/:siteId/submissions → FormSubmissions          ★ v3.1 │
│  /portal/sites/:siteId/pages/:pageId → PageEditor (page edit) ★ NEW  │
│  /admin/sites                  → AdminSites (admin panel)     ★ NEW  │
└───────────────────────────────────┼───────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                  BACKEND (Express)                                     │
│                                                                       │
│  /api/v1/sites/*  →  siteBuilder.ts (2,118 LOC)                      │
│                                                                       │
│  CRUD:                                                                │
│  POST   /                              → Create site (auto max_pages) │
│  GET    /                              → List user's sites (*)        │
│  GET    /tier                          → User's tier info      ★ NEW  │
│  GET    /:siteId                       → Get site details             │
│  PUT    /:siteId                       → Update site data (+widget)   │
│  DELETE /:siteId                       → Delete site + files          │
│                                                                       │
│  Generation:                                                          │
│  POST   /generate-ai                   → Async AI generation (tiered)│
│  GET    /:siteId/generation-status     → Poll generation progress     │
│  POST   /:siteId/generate              → Generate static HTML/CSS    │
│  POST   /:siteId/skip-queue            → Re-trigger as paid priority │
│  POST   /:siteId/polish                → AI design polish             │
│  GET    /:siteId/preview               → Live HTML preview (token)   │
│                                                                       │
│  Multi-page:                                                   ★ NEW  │
│  GET    /:siteId/pages                 → List site pages              │
│  POST   /:siteId/pages                 → Create page (tier-gated)    │
│  GET    /:siteId/pages/:pageId         → Get page details            │
│  PUT    /:siteId/pages/:pageId         → Update page                 │
│  DELETE /:siteId/pages/:pageId         → Delete page                 │
│  POST   /:siteId/pages/:pageId/generate → AI generate single page   │
│                                                                       │
│  Form Submissions:                                             ★ v3.1│
│  POST   /forms/submit                  → Public form submit (no auth)│
│  GET    /:siteId/submissions           → List submissions (paginated)│
│  PATCH  /:siteId/submissions/:id/read  → Mark submission as read     │
│  DELETE /:siteId/submissions/:id       → Delete submission           │
│                                                                       │
│  Deployment:                                                          │
│  POST   /:siteId/deploy               → FTP/SFTP deployment          │
│  GET    /:siteId/deployments           → Deployment history           │
│                                                                       │
│  Uploads:                                                             │
│  POST   /upload/logo                   → Upload logo image            │
│  POST   /upload/hero                   → Upload hero image            │
│                                                                       │
│  (*) List excludes generated_html LONGTEXT for performance            │
│                                                                       │
│  /api/admin/sites/*  →  adminSites.ts (271 LOC)               ★ NEW  │
│                                                                       │
│  GET    /stats                         → Aggregate site statistics    │
│  GET    /                              → All sites (paginated+search)│
│  GET    /:siteId                       → Site detail (any user)       │
│  PATCH  /:siteId                       → Admin override status/pages │
│  DELETE /:siteId                       → Force-delete site            │
│  GET    /trials/active                 → Active trials with countdown│
│                                                                       │
│  Services:                                                            │
│  siteBuilderService.ts  → CRUD, pages, HTML storage, navigation     │
│  siteBuilderTemplate.ts → HTML template with conditional form/widget│
│  ftpDeploymentService.ts → FTP/SFTP file upload                      │
│  packages.ts            → resolveUserTier(), enforceTrialExpiry()    │
│                                                                       │
│  Auto-migration on startup:                                           │
│  • Adds generated_html, generation_error columns if missing          │
│  • Adds form_config JSON, include_form, include_assistant if missing │
│  • Adds max_pages INT DEFAULT 1 column if missing                    │
│  • Adds 'generating' to status ENUM                                  │
│  • Creates site_pages table if missing                               │
│  • Creates site_form_submissions table if missing           ★ v3.1  │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                  AI (Tiered)                                           │
│                                                                       │
│  FREE TIER:                                                           │
│  Ollama — qwen2.5:3b-instruct (local, env.SITE_BUILDER_OLLAMA_MODEL)│
│  Endpoint: /api/chat | Timeout: 600s | Temp: 0.4 | num_predict: 4096│
│  Typical: ~920 tokens, ~1m50s at 8.7 tok/s (CPU)                    │
│                                                                       │
│  PAID TIER:                                                           │
│  GLM → OpenRouter → Ollama (fallback chain)                          │
│  Higher quality models, faster generation                             │
│  Priority queue position (skip-queue support)                         │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier Model (v3.0)

### Subscription Tiers

| Tier | Package | max_pages | AI Model | Price |
|------|---------|-----------|----------|-------|
| Free | — | 1 | Ollama (qwen2.5:3b-instruct) | R0 |
| Starter | starter | 5 | GLM → OpenRouter → Ollama | Paid |
| Pro | pro | 15 | GLM → OpenRouter → Ollama | Paid |
| Enterprise | enterprise | 50 | GLM → OpenRouter → Ollama | Paid |

### Server-Side Tier Resolution

Tier is **never** trusted from the client. The `resolveUserTier(userId)` function in `packages.ts` queries the actual subscription:

```
resolveUserTier(userId)
    ↓ query user_contact_link → contact_packages → packages
    ↓
    ├── No subscription / free package → { tier: 'free', maxPages: 1 }
    └── Paid/trial subscription       → { tier: 'paid', maxPages: N, packageSlug, status, daysLeft }
```

Returns: `{ tier, maxPages, packageSlug, status, daysLeft }`

### Trial Lifecycle

```
User subscribes to trial
    ↓
cp.status = 'TRIAL', cp.trial_ends_at = +14 days
    ↓
Full paid-tier access (max_pages from package)
    ↓
3 days before expiry → sendTrialExpiryWarnings() notification
    ↓
Trial expires → enforceTrialExpiry()
    ├── cp.status → 'EXPIRED'
    ├── credits → 0
    └── All user's sites: max_pages → 1 (downgrade)
        (existing pages beyond page 1 remain but are effectively locked)
```

### Page Types (Multi-Page)

| Type | Slug | Description |
|------|------|-------------|
| `home` | `index` | Main landing page (auto-created) |
| `about` | `about` | About Us page |
| `services` | `services` | Services listing |
| `contact` | `contact` | Contact form page |
| `gallery` | `gallery` | Image gallery |
| `faq` | `faq` | FAQ page |
| `pricing` | `pricing` | Pricing page |
| `custom` | user-defined | Free-form custom page |

---

## 4. AI Generation (v2.0 — Async, v3.0 — Tiered)

The `/generate-ai` endpoint uses **tiered AI** — free users get Ollama, paid users get the GLM→OpenRouter→Ollama fallback chain. Generation is **fully asynchronous** — the endpoint returns immediately and the AI runs in a background IIFE.

### Tiered AI Models

| Tier | Primary | Fallback | Quality |
|------|---------|----------|---------|
| Free | Ollama (qwen2.5:3b-instruct) | — | Good |
| Paid | GLM (zhipu-ai) | OpenRouter → Ollama | Excellent |

### Async Flow

```
Frontend: POST /generate-ai  ──→  Backend:
                                     1. resolveUserTier(userId) — server-side
                                     2. Validate fields + ownership
                                     3. Mark site status → 'generating'
                                     4. Return 200 immediately
                                     5. Background IIFE:
                                        ├── Paid → GLM → OpenRouter → Ollama
                                        └── Free → Ollama only
                                     6. Store HTML in generated_html column
                                     7. Set status → 'generated' or 'failed'

Frontend: polls GET /:siteId/generation-status every 4s
  ├── status='generating' → keep polling (SweetAlert loading spinner)
  ├── status='generated'  → show preview + success notification
  └── status='failed'     → show error message
```

### AI Design Polish (v2.x)

```
POST /:siteId/polish  { prompt: "make the hero section larger" }
    ↓
Backend receives current generated_html + user prompt
    ↓
AI modifies HTML based on instruction
    ↓
Stores updated HTML, status → 'generated'
```

### Per-Page AI Generation (v3.0)

```
POST /:siteId/pages/:pageId/generate
    ↓
Reads page's content_data + site context
    ↓
AI generates HTML for that specific page type
    ↓
Stores in page's generated_html column
    ↓
injectNavigation() adds nav bar across all pages
```

---

## 5. Security

| Feature | Implementation |
|---------|---------------|
| **Authentication** | All endpoints require JWT (`requireAuth` middleware); preview supports `?token=` query param for new-tab access |
| **Ownership** | Every read/write/delete verifies `site.user_id === req.userId` |
| **Admin access** | Admin endpoints use `requireAdmin` middleware — checks `users.role` is `admin`, `staff`, or `developer` |
| **Tier verification** | Server-side `resolveUserTier()` — never trusts client-supplied tier |
| **Page quota** | `max_pages` enforced server-side on `POST /:siteId/pages` |
| **FTP passwords** | Encrypted with AES-256-GCM via `encryptPassword()` before storage |
| **Password never returned** | All GET responses strip `ftp_password: undefined` |
| **Image upload limits** | 5MB max, JPEG/PNG/GIF/WEBP only |
| **Widget client ID** | UUID-validated and existence-checked against `widget_clients` table |
| **Slug sanitization** | Page slugs lowercased, non-alphanumeric stripped, duplicates rejected (UNIQUE constraint) |
| **Audit logging** | Admin site routes pass through `auditLogger` middleware |
| **Honeypot bot detection** | Form submit includes hidden `bot_check_url` field; bots silently rejected |
| **IP rate limiting** | Form submissions rate-limited to 10 per IP per 10 minutes (in-memory Map) |
| **Free tier submission cap** | Max 50 form submissions per site for free-tier users |

---

## 6. Dependencies

| Dependency | Usage |
|-----------|-------|
| express | Route handling |
| multer | Image upload (disk storage, ESM-compatible paths) |
| axios | Ollama Chat API calls, OpenRouter API calls |
| jsonwebtoken | JWT verification in preview endpoint (token via query param) |
| path, url (fileURLToPath) | ESM-compatible `__dirname` polyfill for file paths |
| fs/promises | File system operations for generated sites |
| `../services/siteBuilderService.ts` | CRUD, pages, HTML storage, navigation injection, status management |
| `../services/siteBuilderTemplate.ts` | HTML template generation with conditional form/assistant |
| `../services/ftpDeploymentService.ts` | FTP/SFTP deployment |
| `../services/emailService.ts` | Email notifications and auto-replies for form submissions |
| `../services/packages.ts` | `resolveUserTier()`, `enforceTrialExpiry()`, `sendTrialExpiryWarnings()` |
| `../utils/cryptoUtils.ts` | AES-256-GCM password encryption/decryption |
| `../middleware/auth.ts` | JWT authentication |
| `../db/mysql.ts` | Direct DB access for auto-migration on startup |
| `../config/env.ts` | `SITE_BUILDER_OLLAMA_MODEL`, `OLLAMA_BASE_URL` |

---

## 7. Related Documentation

- [Routes](ROUTES.md) — Detailed API endpoint specifications (22 user + 6 admin)
- [Fields](FIELDS.md) — Database schema and table definitions (3 tables)
- [Files](FILES.md) — Source file inventory with LOC counts
- [Patterns](PATTERNS.md) — Architecture patterns and anti-patterns
- [Changes](CHANGES.md) — Version history and known issues
