# Site Builder Module — Overview

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

---

## 1. Module Overview

### Purpose

The Site Builder module enables users to create, generate, and deploy single-page landing websites. Users provide business information (name, tagline, about, services) and the module uses AI (Qwen 2.5 3B Instruct via Ollama Chat API) to generate a complete, responsive HTML5 landing page **asynchronously**. Users are notified when generation completes. Generated sites can be downloaded as HTML or deployed directly to a remote server via FTP/SFTP.

### Business Value

- **Async AI website generation** — generation runs in background; frontend polls for status and notifies on completion (2–5 min on CPU)
- **Rich site list** — landing page dashboard with real-time status badges (Draft, Generating…, Ready to Deploy, Live, Failed), logo thumbnails, and auto-polling for in-progress sites
- **Embeddable AI chat widget** — generated sites automatically include the SoftAware chat widget if an assistant is selected
- **Lead capture form** — all generated sites include a contact form that posts to the SoftAware leads API
- **FTP/SFTP deployment** — one-click deploy to any hosting provider with encrypted credentials (AES-256-GCM)
- **Image uploads** — logo and hero banner upload with CDN-served URLs (served via Express static mount)
- **Live preview in new tab** — open the full generated site in a real browser tab via `/preview` endpoint (token-authenticated)
- **Assistant persistence on reload** — `widget_client_id` is loaded from DB when editing a site, and can be changed post-generation with immediate save
- **Download option** — users can download the raw HTML for manual hosting
- **Ownership enforcement** — all operations verify the authenticated user owns the site

### Key Statistics

| Metric | Value |
|--------|-------|
| Backend route file | 1 (siteBuilder.ts, 693 LOC) |
| Backend service files | 2 (siteBuilderService.ts 636 LOC, ftpDeploymentService.ts 206 LOC) |
| Backend migration | 1 (002_site_builder.ts, 111 LOC) |
| Frontend files | 2 (SiteBuilderEditor.tsx 779 LOC, SitesPage.tsx 374 LOC) |
| Total LOC | ~2,799 |
| API endpoints | 13 (11 original + generation-status polling + live preview) |
| MySQL tables | 2 (generated_sites, site_deployments) |
| New DB columns | 2 (generated_html LONGTEXT, generation_error VARCHAR) |
| AI Model | `qwen2.5:3b-instruct` via `SITE_BUILDER_OLLAMA_MODEL` env var |
| AI API | Ollama Chat API (`/api/chat`) — system + user messages |

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                  FRONTEND (React)                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  SitesPage.tsx (374 LOC) — Landing page dashboard        │ │
│  │  • Rich status badges (Draft/Generating/Ready/Live/Fail) │ │
│  │  • Logo thumbnails, relative timestamps                  │ │
│  │  • Auto-polls every 4s while any site is 'generating'    │ │
│  │  • Delete with SweetAlert confirmation                   │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                          │                                      │
│  ┌──────────────────────▼───────────────────────────────────┐ │
│  │  SiteBuilderEditor.tsx (779 LOC)                         │ │
│  │  • Business info form (name, tagline, about, svcs)       │ │
│  │  • Logo & hero image upload (drag or click)              │ │
│  │  • Assistant selector (embed chat widget)                │ │
│  │  • "Generate with AI" → async + poll for result          │ │
│  │  • SweetAlert loading modal during generation            │ │
│  │  • Live iframe preview (sandboxed)                       │ │
│  │  • "Open Live Preview" — full-tab preview via /preview   │ │
│  │  • Post-gen assistant change (auto-saves immediately)    │ │
│  │  • Download HTML button / FTP deploy modal               │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                          │                                      │
│  Routes:                                                        │
│  /portal/sites          → SitesPage (list/dashboard)           │
│  /portal/sites/new      → SiteBuilderEditor (create)           │
│  /portal/sites/:id/edit → SiteBuilderEditor (edit)             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                  BACKEND (Express)                              │
│                                                                │
│  /api/v1/sites/*  →  siteBuilder.ts (693 LOC)                 │
│                                                                │
│  POST   /                          → Create site record        │
│  GET    /                          → List user's sites (*)     │
│  GET    /:siteId                   → Get site details          │
│  PUT    /:siteId                   → Update site data (+widget)│
│  DELETE /:siteId                   → Delete site + files       │
│  POST   /:siteId/generate         → Generate static HTML/CSS  │
│  POST   /:siteId/deploy           → FTP/SFTP deployment       │
│  GET    /:siteId/deployments      → Deployment history        │
│  GET    /:siteId/generation-status → Poll generation progress  │
│  GET    /:siteId/preview           → Live HTML preview (token) │ ← NEW v2.1
│  POST   /upload/logo               → Upload logo image        │
│  POST   /upload/hero               → Upload hero image        │
│  POST   /generate-ai               → Async AI generation      │
│                                                                │
│  (*) List excludes generated_html LONGTEXT for performance     │
│                                                                │
│  Services:                                                     │
│  siteBuilderService.ts  → CRUD, HTML storage, status mgmt     │
│  ftpDeploymentService.ts → FTP/SFTP file upload                │
│                                                                │
│  Auto-migration on startup:                                    │
│  • Adds generated_html LONGTEXT column if missing              │
│  • Adds generation_error VARCHAR(2000) column if missing       │
│  • Adds 'generating' to status ENUM                            │
└───────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                  OLLAMA (Local AI)                              │
│                                                                │
│  Model: qwen2.5:3b-instruct (env.SITE_BUILDER_OLLAMA_MODEL)  │
│  Endpoint: /api/chat (system + user messages, non-streaming)   │
│  Timeout: 600 seconds (10 min)                                 │
│  Temperature: 0.4 | num_predict: 4096                         │
│  Typical generation: ~920 tokens, ~1m50s at 8.7 tok/s (CPU)   │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. AI Generation (v2.0 — Async)

The `/generate-ai` endpoint uses **`qwen2.5:3b-instruct`** (configured via `SITE_BUILDER_OLLAMA_MODEL`) with the **Ollama Chat API** for better instruction following. Generation is **fully asynchronous** — the endpoint returns immediately and the AI runs in a background IIFE.

### Why 3B instead of 7B?

The server runs CPU-only (AMD EPYC, 12 cores, 48GB RAM). Benchmarks showed:

| Model | Speed | Time for full page | Quality |
|-------|-------|--------------------|---------|
| qwen2.5-coder:7b | 5.3 tok/s | ~25 min | Excellent |
| qwen2.5:3b-instruct | 8.7 tok/s | ~2 min | Good |

The 3B model is **already pinned in RAM** (used by the chat assistant), so it loads instantly. The 7B coder model would need to be loaded on-demand, adding even more latency.

### Async Flow

```
Frontend: POST /generate-ai  ──→  Backend: validate + mark 'generating' + return 200 immediately
                                       │
                                       ▼ (background IIFE)
                                   Ollama /api/chat (system + user messages)
                                       │
                                       ├── Success → store HTML in generated_html column, status → 'generated'
                                       └── Failure → store error in generation_error column, status → 'failed'

Frontend: polls GET /:siteId/generation-status every 4s
  ├── status='generating' → keep polling (SweetAlert loading spinner)
  ├── status='generated'  → show preview + success notification
  └── status='failed'     → show error message
```

### Chat API Messages

**System message:** Concise instruction — output only raw HTML, use Tailwind CDN, be concise.

**User message:** Business data + pre-built contact form HTML (provided verbatim to ensure correct lead capture integration) + widget script tag.

### Post-processing

- Strips markdown code fences if present (` ```html ... ``` `)
- Validates response starts with `<!DOCTYPE` or `<html`
- Stores valid HTML in `generated_html` DB column
- On failure, stores error message in `generation_error` column

---

## 4. Security

| Feature | Implementation |
|---------|---------------|
| **Authentication** | All endpoints require JWT (`requireAuth` middleware); preview supports `?token=` query param for new-tab access |
| **Ownership** | Every read/write/delete verifies `site.user_id === req.userId` |
| **FTP passwords** | Encrypted with AES-256-GCM via `encryptPassword()` before storage |
| **Password never returned** | All GET responses strip `ftp_password: undefined` |
| **Image upload limits** | 5MB max, JPEG/PNG/GIF/WEBP only |
| **Widget client ID** | UUID-validated and existence-checked against `widget_clients` table |

---

## 5. Dependencies

| Dependency | Usage |
|-----------|-------|
| express | Route handling |
| multer | Image upload (disk storage, ESM-compatible paths) |
| axios | Ollama Chat API calls |
| jsonwebtoken | JWT verification in preview endpoint (token via query param) |
| path, url (fileURLToPath) | ESM-compatible `__dirname` polyfill for file paths |
| fs/promises | File system operations for generated sites |
| `../services/siteBuilderService.ts` | CRUD, HTML storage, status management |
| `../services/ftpDeploymentService.ts` | FTP/SFTP deployment |
| `../utils/cryptoUtils.ts` | AES-256-GCM password encryption/decryption |
| `../middleware/auth.ts` | JWT authentication |
| `../db/mysql.ts` | Direct DB access for auto-migration on startup |
| `../config/env.ts` | `SITE_BUILDER_OLLAMA_MODEL`, `OLLAMA_BASE_URL` |

---

## 6. Related Documentation

- [Routes](ROUTES.md) — Detailed API endpoint specifications
- [Fields](FIELDS.md) — Database schema and table definitions
- [Files](FILES.md) — Source file inventory with LOC counts
- [Patterns](PATTERNS.md) — Architecture patterns and anti-patterns
- [Changes](CHANGES.md) — Version history and known issues
