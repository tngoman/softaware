# Site Builder Module — Architectural Patterns

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

---

## 1. Overview

The Site Builder module follows a layered architecture:

```
Frontend (SiteBuilderEditor.tsx)
    ↓ Axios calls
Routes (siteBuilder.ts)       ← Auth middleware, validation, multer
    ↓ Method calls
Services (siteBuilderService) ← CRUD, generation, encryption
    ↓ SQL queries
Database (MySQL)              ← generated_sites, site_deployments
    ↓ FTP/SFTP
External Server               ← Client's hosting provider
```

---

## 2. Dual Generation Path

The module provides two distinct ways to generate a website:

### 2.1 Template-Based Generation (`POST /:siteId/generate`)

```
User fills form → Save to DB → generateStaticFiles(siteId)
                                    ├── buildHTML(site)     ← Handcrafted template
                                    ├── buildCSS(site)      ← Theme-colored CSS
                                    └── Write to /var/tmp/generated_sites/{id}/
```

**Characteristics:**
- Fast (~10ms generation time)
- Consistent, predictable output
- Fixed layout: header → hero → about → services → contact → footer
- Theme color applied via CSS variables
- Always produces valid HTML

### 2.2 AI-Powered Generation (`POST /generate-ai`) — Async (v2.0)

```
User fills form → "Generate with AI" → POST /generate-ai
                                            ├── Validate fields + ownership
                                            ├── Mark site status → 'generating'
                                            ├── Return 200 immediately
                                            └── Background IIFE:
                                                 ├── Build system + user chat messages
                                                 ├── POST /api/chat to Ollama (qwen2.5:3b-instruct)
                                                 ├── Strip markdown fences
                                                 ├── Validate HTML structure
                                                 ├── Store in generated_html column
                                                 └── Set status → 'generated' or 'failed'

Frontend polls GET /:siteId/generation-status every 4s:
  ├── 'generating' → SweetAlert loading spinner, keep polling
  ├── 'generated'  → close spinner, show preview + success alert
  └── 'failed'     → close spinner, show error alert
```

**Characteristics:**
- Fully asynchronous — non-blocking for the HTTP response
- Typical generation: ~920 tokens in ~1m50s at 8.7 tok/s (CPU)
- Uses Tailwind CSS via CDN
- Model: `qwen2.5:3b-instruct` (pinned in RAM, shared with chat assistant)
- Chat API: system message (concise HTML-only instruction) + user message (business data + verbatim form HTML)
- Temperature: 0.4 | num_predict: 4,096 | Timeout: 600s (10 min)
- Contact form HTML provided verbatim (not described) to ensure correct lead capture
- SoftAware widget `<script>` tag provided verbatim
- Generated HTML stored in `generated_html` DB column (no temp files)
- Errors stored in `generation_error` column with human-readable messages

---

## 3. FTP Credential Security

### 3.1 Encryption at Rest

```
User enters FTP password
    ↓
Route handler calls encrypt(password)
    ↓
AES-256-GCM with random 16-byte IV
    ↓
Stored as "iv:encrypted:authTag" (hex)
    ↓
Password NEVER returned in GET responses
```

### 3.2 Decryption in Transit

```
Deploy endpoint called
    ↓
getDecryptedFTPCredentials(site)
    ↓
AES-256-GCM decrypt in-memory
    ↓
Pass to FTP client
    ↓
Credentials released (garbage collected)
```

**Rules:**
1. FTP password is ALWAYS encrypted before DB storage
2. GET endpoints strip `ftp_password` from responses
3. Decryption only occurs during active deployment
4. `ENCRYPTION_KEY` must be 32-byte hex string in env
5. Each encryption uses a unique random IV

---

## 4. Ownership Verification Pattern

Every endpoint accessing a specific site performs:

```typescript
const site = await siteBuilderService.getSiteById(siteId);
if (!site || site.user_id !== req.user.id) {
  return res.status(404).json({ error: 'Site not found' });
}
```

**Key design decisions:**
- Returns 404 (not 403) to prevent user enumeration
- Checked on EVERY `:siteId` endpoint (no exceptions)
- Applied in the route handler, not middleware (keeps flexibility)

---

## 5. Image Upload Pattern

### 5.1 Multer Configuration

```
Incoming multipart/form-data
    ↓
Multer diskStorage
    ├── destination: /var/opt/backend/uploads/sites/  (ESM-resolved via __dirname)
    ├── filename: {timestamp}-{random 9 digits}{ext}
    └── limits: 5MB, JPEG/PNG/GIF/WEBP only
    ↓
fileFilter validates MIME type
    ↓
Return full CDN URL: https://api.softaware.net.za/uploads/sites/{filename}
```

> **v2.0 fix:** Upload directory changed from `/var/www/code/uploads/sites/` to `/var/opt/backend/uploads/sites/` to match the Express static mount path. Route uses ESM-compatible `__dirname` via `fileURLToPath(import.meta.url)` and goes up two levels from `dist/routes/` to project root.

### 5.2 Image Usage in Generated Sites

Images referenced in generated HTML use the CDN URL directly:
- Logo → `<img>` in header section
- Hero image → CSS `background-image` with overlay gradient

---

## 6. AI Prompt Engineering (v2.0 — Chat API)

### 6.1 Chat Message Structure

The AI generation uses Ollama's `/api/chat` endpoint with structured messages:

**System message (concise):**
> You are a frontend web developer. Output ONLY raw HTML. No markdown, no explanations. Start with <!DOCTYPE html>, end with </html>. Use Tailwind CSS CDN. Be concise — use utility classes, avoid excessive wrappers.

**User message (structured data + verbatim HTML):**
1. Business data: name, tagline, about text, services list
2. Logo URL or "use styled business name text"
3. Hero image URL or "use a gradient"
4. Required sections: Hero/banner, About, Services grid, Contact
5. **Contact form HTML provided verbatim** (not described) — ensures correct `action`, `client_id`, and honeypot field
6. **Widget script tag provided verbatim** — `<script src="...widget.js" data-client-id="..." defer></script>`

> **Design decision:** Providing form HTML verbatim (instead of describing it) eliminates AI hallucination of wrong URLs, missing fields, or incorrect field names. The AI wraps the form in its own styling but preserves the exact HTML structure.

### 6.2 Post-Processing Pipeline

```
Raw Ollama chat response (message.content)
    ↓
Strip markdown fences (```html ... ```)
    ↓
Trim whitespace
    ↓
Validate: must start with <!DOCTYPE or <html
    ↓
├── Valid → store in generated_html column, status → 'generated'
└── Invalid → store error in generation_error, status → 'failed'
```

---

## 7. Deployment Pipeline

### 7.1 Full Deployment Flow

```
1. User clicks "Deploy via FTP"
2. Frontend opens deploy modal → collects FTP credentials
3. Frontend saves site (PUT /:siteId) with FTP creds
4. Frontend calls POST /:siteId/deploy
5. Backend:
   a. Verify ownership
   b. Decrypt FTP credentials
   c. Create deployment record (status: pending)
   d. Generate static files if needed
   e. Connect to FTP/SFTP server
   f. Upload index.html + styles.css
   g. Update deployment record (success/failed)
   h. Update site (last_deployed_at / deployment_error)
6. Frontend receives result
```

### 7.2 Deployment Record Tracking

Each deployment attempt creates a `site_deployments` row:

| Phase | Status | files_uploaded |
|-------|--------|----------------|
| Start | `pending` | 0 |
| Uploading | `uploading` | incrementing |
| Done | `success` | = total_files |
| Error | `failed` | partial count |

Duration is tracked in milliseconds for performance monitoring.

---

## 8. Frontend State Machine

### 8.1 SitesPage (List Dashboard) States

```
LOADING
  └── Fetch GET /api/v1/sites
    ↓
DISPLAY
  ├── Render site cards with status badges
  ├── If any site status='generating' → auto-poll every 4s
  ├── Auto-poll stops when no more 'generating' sites
  ├── "Edit" → navigate to SiteBuilderEditor
  └── "Delete" → SweetAlert confirm → DELETE /api/v1/sites/:id
    ↓
EMPTY
  └── No sites → friendly CTA to create first site
```

### 8.2 SiteBuilderEditor Component States

```
INITIAL
  ├── New site: empty form
  └── Edit site: load existing data + generated_html from DB
    ↓
EDITING
  ├── Upload logo/hero images
  ├── Fill business details
  └── Select assistant for widget
    ↓
GENERATING (async)
  ├── Auto-save site record (if new) or update (if existing)
  ├── Call POST /generate-ai (returns immediately)
  ├── SweetAlert loading modal ("2–5 minutes")
  └── Poll GET /:siteId/generation-status every 4s (10 min max)
    ↓
PREVIEW
  ├── Display in sandboxed <iframe>
  ├── "Open Live Preview" → window.open(preview URL + ?token=jwt)
  ├── Change assistant → auto-save PUT /:siteId with widgetClientId
  ├── "Download HTML" → Blob download
  └── "Deploy via FTP" → deploy modal
    ↓
DEPLOYING
  ├── Collect/confirm FTP credentials
  ├── Save creds → generate → deploy
  └── Show progress/result
```

### 8.3 Error Recovery

- Generation failure → SweetAlert error, status shown on list page as "Failed" badge
- Poll timeout (10 min) → "taking too long" warning, can retry later
- Deployment failure → show error, keep preview, can retry
- Upload failure → show error, field not updated
- Network error → SweetAlert2 error dialog

---

## 9. Contact Form Integration

Generated websites include a contact form that submits leads to the SoftAware platform:

```
Website visitor fills form
    ↓
POST https://api.softaware.net.za/v1/leads/submit
    ├── widget_client_id (hidden field)
    ├── name, email, phone, message
    └── website (honeypot — must be empty)
    ↓
Lead appears in client's Leads table
```

This creates a seamless pipeline: AI-generated website → visitor fills form → lead captured in CRM.

---

## 10. File Lifecycle

```
Site created       → DB record (status: draft)
Images uploaded    → /var/opt/backend/uploads/sites/
                        (persisted, served via Express static mount)
AI generated       → generated_html column in DB (v2.0)
                        (no temp files for AI-generated sites)
Template generated → /var/tmp/generated_sites/{id}/
                        (temporary, regenerated as needed)
Site deployed      → FTP/SFTP to client's server
                        (files live on client's hosting)
Site deleted       → DB record removed (CASCADE)
                   → Generated files cleaned up
                   → Uploaded images remain (manual cleanup)
```
