# Site Builder Module — Architectural Patterns

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## 1. Overview

The Site Builder module follows a layered architecture with tier-gated multi-page support:

```
Frontend (SitesPage / SiteBuilderEditor / WebsiteManager / PageEditor / FormSubmissions / AdminSites)
    ↓ Axios calls
Routes (siteBuilder.ts + adminSites.ts) ← Auth, validation, multer, tier resolution
    ↓ Method calls
Services (siteBuilderService + siteBuilderTemplate + packages) ← CRUD, pages, generation, encryption, tier
    ↓ SQL queries
Database (MySQL)                         ← generated_sites, site_pages, site_deployments, site_form_submissions
    ↓ FTP/SFTP
External Server                          ← Client's hosting provider
```

---

## 2. Tier-Gated Access Pattern ★ NEW v3.0

### 2.1 Server-Side Tier Resolution

The tier is **never** trusted from the client. Every operation that depends on the user's subscription level resolves it server-side:

```
Client request arrives
    ↓
resolveUserTier(userId)
    ↓ query chain:
    getUserContact(userId)
        → user_contact_link.contact_id
    ↓
    contact_packages (status IN ('TRIAL','ACTIVE'))
        → JOIN packages (slug, max_landing_pages, price_monthly)
    ↓
    ├── No subscription / price_monthly === 0 → { tier: 'free', maxPages: 1 }
    └── Paid subscription → { tier: 'paid', maxPages: N, packageSlug, status, daysLeft }
```

**Key design decisions:**
- `resolveUserTier()` is called in the route handler (not middleware) to keep it opt-in
- The `tier` field in `POST /generate-ai` request body is **ignored** — always server-resolved
- `max_pages` is set on site creation and can be overridden by admin
- Returns `daysLeft` for trial users (computed from `trial_ends_at`)

### 2.2 Page Quota Enforcement

```
POST /:siteId/pages → Create new page
    ↓
1. Ownership check (site.user_id === req.userId)
    ↓
2. maxPages = getMaxPages(siteId)    ← reads generated_sites.max_pages
    ↓
3. if (maxPages <= 1) → 403 UPGRADE_REQUIRED
    ↓
4. currentCount = getPageCount(siteId)
    ↓
5. if (currentCount >= maxPages) → 400 PAGE_LIMIT_REACHED
    ↓
6. Create page (validate type, sanitize slug, auto sort_order)
```

**Error codes returned:**

| Code | HTTP | Meaning |
|------|------|---------|
| `UPGRADE_REQUIRED` | 403 | Free-tier user attempting to add pages |
| `PAGE_LIMIT_REACHED` | 400 | Paid user has hit their quota |

---

## 3. Trial Lifecycle Pattern ★ NEW v3.0

### 3.1 Trial Subscription Flow

```
User subscribes to a paid package with trial
    ↓
contact_packages row:
  status = 'TRIAL'
  trial_ends_at = NOW() + 14 days
    ↓
resolveUserTier() returns: { tier: 'paid', maxPages: N, status: 'TRIAL', daysLeft: 14 }
    ↓
User creates site → max_pages auto-set to N
    ↓
User creates pages (up to N pages)
    ↓
[3 days before expiry]
    ↓
sendTrialExpiryWarnings() cron
    → finds contacts WHERE trial_ends_at BETWEEN NOW() AND NOW()+3 days
    → sends notification to user
    ↓
[trial_ends_at reached]
    ↓
enforceTrialExpiry() cron
    → cp.status → 'EXPIRED'
    → credits → 0
    → JOIN user_contact_link → generated_sites
    → UPDATE generated_sites SET max_pages = 1
        WHERE user_id IN (expired users)
    ↓
User can still see all pages but cannot create new ones
(existing pages beyond page 1 remain in DB, just inaccessible for editing)
```

### 3.2 Frontend Trial Awareness

```
WebsiteManager loads:
    ↓
GET /api/v1/sites/tier → { tier, maxPages, status, daysLeft }
    ↓
├── status === 'TRIAL' && daysLeft <= 3
│   → Red warning banner: "Trial expires in X days"
│
├── status === 'TRIAL' && daysLeft > 3
│   → Amber info banner: "Trial: X days remaining"
│
├── tier === 'free'
│   → Upsell card with locked page types
│
└── tier === 'paid' && status !== 'TRIAL'
    → Full access, no banners
```

---

## 4. Dual Generation Path

The module provides two distinct ways to generate a website:

### 4.1 Template-Based Generation (`POST /:siteId/generate`)

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

### 4.2 AI-Powered Generation (`POST /generate-ai`) — Async, Tiered (v3.0)

```
User fills form → "Generate with AI" → POST /generate-ai
                                            ├── resolveUserTier(userId) ★ server-side
                                            ├── Validate fields + ownership
                                            ├── Mark site status → 'generating'
                                            ├── Return 200 immediately
                                            └── Background IIFE:
                                                 ├── Paid → GLM → OpenRouter → Ollama (fallback)
                                                 ├── Free → Ollama only (qwen2.5:3b-instruct)
                                                 ├── Build system + user chat messages
                                                 ├── Call selected AI model
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
- Tiered AI: paid users get higher-quality models
- Typical generation: ~920 tokens in ~1m50s at 8.7 tok/s (CPU, Ollama)
- Uses Tailwind CSS via CDN
- Contact form HTML provided verbatim (not described) to ensure correct lead capture
- SoftAware widget `<script>` tag provided verbatim
- Generated HTML stored in `generated_html` DB column (no temp files)

---

## 5. Multi-Page Generation Pattern ★ NEW v3.0

### 5.1 Per-Page AI Generation

```
POST /:siteId/pages/:pageId/generate
    ↓
1. Ownership check
    ↓
2. Load page record (page_type, content_data)
    ↓
3. Load parent site context (business_name, tagline, theme_color, etc.)
    ↓
4. Build AI prompt tailored to page_type:
   ├── about  → "Create an About Us page with: {story}, {mission}, {team}"
   ├── services → "Create a Services page with: {intro}, {services[]}"
   ├── contact → "Create a Contact page with: {address}, {phone}, {email}, {hours}"
   ├── gallery → "Create a Gallery page with: {images[]}"
   ├── faq → "Create an FAQ page with: {questions[]}"
   ├── pricing → "Create a Pricing page with: {plans[]}"
   └── custom → "Create a page with: {heading}, {content}"
    ↓
5. AI generates HTML
    ↓
6. Store in page.generated_html
    ↓
7. injectNavigation() across all site pages
```

### 5.2 Navigation Injection

```
injectNavigation(html, navLinks, currentSlug)
    ↓
1. Build nav links array from all published pages:
   [{ slug: 'index', title: 'Home', href: 'index.html' },
    { slug: 'about', title: 'About', href: 'about.html' },
    { slug: 'services', title: 'Services', href: 'services.html' }]
    ↓
2. Generate <nav> HTML with active state for currentSlug
    ↓
3. Inject after <body> tag in the page HTML
    ↓
4. Return modified HTML
```

**Key design decisions:**
- Navigation is injected post-generation (not part of the AI prompt)
- Current page gets an "active" CSS class for highlighting
- Navigation regenerated whenever a page is added/removed/renamed
- Only published pages (`is_published = 1`) appear in navigation

---

## 6. FTP Credential Security

### 6.1 Encryption at Rest

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

### 6.2 Decryption in Transit

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

## 7. Ownership Verification Pattern

Every endpoint accessing a specific site performs:

```typescript
const site = await siteBuilderService.getSiteById(siteId);
if (!site || site.user_id !== req.user.id) {
  return res.status(404).json({ error: 'Site not found' });
}
```

**Multi-page extension (v3.0):**

```typescript
// Page endpoints also verify the page belongs to the site
const page = await siteBuilderService.getPageById(pageId);
if (!page || page.site_id !== siteId) {
  return res.status(404).json({ error: 'Page not found' });
}
```

**Key design decisions:**
- Returns 404 (not 403) on site CRUD to prevent user enumeration
- Page endpoints return 403 for ownership (user already knows site exists)
- Applied in the route handler, not middleware (keeps flexibility)
- **Admin endpoints bypass ownership** — admin can access any site

---

## 8. Admin Management Pattern ★ NEW v3.0

### 8.1 Admin Authorization

```
Admin request arrives
    ↓
requireAuth middleware (JWT validation)
    ↓
requireAdmin middleware:
    SELECT role FROM users WHERE id = ?
    ↓
    ├── role IN ('admin', 'staff', 'developer') → proceed
    └── else → 403 "Admin access required"
    ↓
auditLogger middleware (logs action)
    ↓
Route handler (no ownership check)
```

### 8.2 Admin Override Pattern

```
PATCH /admin/sites/:siteId { status?, maxPages? }
    ↓
1. Fetch site by ID (no ownership check)
    ↓
2. If status provided → validate against ENUM → UPDATE generated_sites SET status = ?
    ↓
3. If maxPages provided → validate 1–50 → siteBuilderService.setMaxPages(siteId, maxPages)
    ↓
4. Return updated site
```

**Use cases:**
- Reset a `failed` site to `draft` for retry
- Override `max_pages` for a specific customer (support request)
- Manually mark a site as `deployed` after external intervention

### 8.3 Admin Stats Pattern

```
GET /admin/sites/stats
    ↓
Parallel queries:
├── COUNT(*) + SUM(status='X') FROM generated_sites    → per-status counts
├── COUNT(*) FROM site_pages                            → total pages
├── COUNT(DISTINCT gs.id) JOIN ... WHERE cp.status='TRIAL' → trial sites
└── COUNT(*) WHERE last_deployed_at >= NOW()-7d         → recent deploys
    ↓
Return aggregated stats object
```

---

## 9. Image Upload Pattern

### 9.1 Multer Configuration

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

### 9.2 Image Usage in Generated Sites

Images referenced in generated HTML use the CDN URL directly:
- Logo → `<img>` in header section
- Hero image → CSS `background-image` with overlay gradient

---

## 10. AI Prompt Engineering (v2.0 — Chat API, v3.0 — Tiered)

### 10.1 Chat Message Structure

The AI generation uses structured messages for instruction following:

**System message (concise):**
> You are a frontend web developer. Output ONLY raw HTML. No markdown, no explanations. Start with <!DOCTYPE html>, end with </html>. Use Tailwind CSS CDN. Be concise — use utility classes, avoid excessive wrappers.

**User message (structured data + verbatim HTML):**
1. Business data: name, tagline, about text, services list
2. Logo URL or "use styled business name text"
3. Hero image URL or "use a gradient"
4. Required sections: Hero/banner, About, Services grid, Contact
5. **Contact form HTML provided verbatim** (not described) — ensures correct lead capture integration
6. **Widget script tag provided verbatim** — `<script src="...widget.js" data-client-id="..." defer></script>`

> **Design decision:** Providing form HTML verbatim (instead of describing it) eliminates AI hallucination of wrong URLs, missing fields, or incorrect field names.

### 10.2 AI Polish Prompt (v2.x)

```
System: You are an expert web designer and frontend developer.
        You will receive HTML source and an edit instruction.
        Return ONLY the complete modified HTML.

User:   [current generated_html]
        ---
        Edit instruction: [user's prompt]
```

### 10.3 Post-Processing Pipeline

```
Raw AI response (message.content)
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

## 11. Slug Sanitization Pattern ★ NEW v3.0

```
User provides pageSlug: "About Us Page!"
    ↓
1. toLowerCase()           → "about us page!"
2. Replace [^a-z0-9-]     → "about-us-page-"
3. Collapse --+            → "about-us-page-"
4. Strip leading/trailing  → "about-us-page"
5. Validate non-empty      → ✓
    ↓
INSERT INTO site_pages (page_slug = 'about-us-page')
    ↓
UNIQUE(site_id, page_slug) constraint prevents duplicates
    → 409 "A page with that slug already exists for this site"
```

---

## 12. Deployment Pipeline

### 12.1 Full Deployment Flow

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
   f. Upload index.html + styles.css (+ page files for multi-page sites)
   g. Update deployment record (success/failed)
   h. Update site (last_deployed_at / deployment_error)
6. Frontend receives result
```

### 12.2 Deployment Record Tracking

Each deployment attempt creates a `site_deployments` row:

| Phase | Status | files_uploaded |
|-------|--------|----------------|
| Start | `pending` | 0 |
| Uploading | `uploading` | incrementing |
| Done | `success` | = total_files |
| Error | `failed` | partial count |

---

## 13. Frontend State Machines

### 13.1 SitesPage (List Dashboard)

```
LOADING
  └── Fetch GET /api/v1/sites
    ↓
DISPLAY
  ├── Render site cards with status badges
  ├── If any site status='generating' → auto-poll every 4s
  ├── "Edit" → SiteBuilderEditor
  ├── "Manage" → WebsiteManager  ★ NEW
  ├── "Preview" → window.open(preview URL)
  └── "Delete" → SweetAlert confirm → DELETE
    ↓
EMPTY
  └── No sites → CTA to create first site
```

### 13.2 WebsiteManager (Multi-Page) ★ NEW v3.0

```
LOADING
  ├── Fetch GET /api/v1/sites/:siteId (site info)
  ├── Fetch GET /api/v1/sites/:siteId/pages (page list)
  └── Fetch GET /api/v1/sites/tier (subscription tier)
    ↓
DISPLAY
  ├── Page tree (sorted by sort_order)
  ├── Quota bar (currentCount / maxPages)
  ├── If tier='free' → show upsell card, disable "Add Page"
  ├── If tier='paid' && status='TRIAL' → show trial warning
  ├── "Add Page" → SweetAlert form (title, type, slug) → POST /:siteId/pages
  ├── "Generate" → POST /:siteId/pages/:pageId/generate
  ├── "Edit" → navigate to PageEditor
  ├── "Submissions" → navigate to FormSubmissions  ★ v3.1
  └── "Delete" → SweetAlert confirm → DELETE /:siteId/pages/:pageId
```

### 13.3 FormSubmissions ★ NEW v3.1

```
LOADING
  └── Fetch GET /api/v1/sites/:siteId/submissions
    ↓
DISPLAY
  ├── Inbox-style list (name/email + preview + date)
  ├── Unread badge highlighting
  ├── Unread/All filter toggle → re-fetch with ?unread=1
  ├── Click row → detail modal → PATCH /:siteId/submissions/:id/read
  └── Delete → SweetAlert confirm → DELETE /:siteId/submissions/:id
    ↓
EMPTY
  └── No submissions → friendly empty state with illustration
```

### 13.4 PageEditor ★ NEW v3.0

```
LOADING
  ├── Fetch GET /api/v1/sites/:siteId/pages/:pageId
  └── Parse content_data JSON
    ↓
EDITING
  ├── Type-specific content fields rendered based on page_type
  ├── "Save" → PUT /:siteId/pages/:pageId { contentData }
  ├── "AI Generate" → auto-save → POST /:siteId/pages/:pageId/generate
  ├── "Publish" toggle → PUT /:siteId/pages/:pageId { isPublished }
  └── Slug editor → PUT /:siteId/pages/:pageId { pageSlug }
    ↓
PREVIEW
  └── Inline iframe showing generated_html (sandboxed)
```

### 13.5 AdminSites ★ NEW v3.0

```
LOADING
  ├── Fetch GET /admin/sites/stats
  └── Fetch GET /admin/sites?page=1
    ↓
DISPLAY
  ├── 7 stat cards (from /stats response)
  ├── Search input → re-fetch with ?search=
  ├── Status filter dropdown → re-fetch with ?status=
  ├── Paginated table with owner info, page counts, trial countdown
  ├── "Reset" (failed → draft) → PATCH /admin/sites/:id { status: 'draft' }
  ├── "Edit Pages" → SweetAlert input → PATCH /admin/sites/:id { maxPages: N }
  └── "Delete" → SweetAlert confirm → DELETE /admin/sites/:id
```

---

## 14. Contact Form System ★ UPDATED v3.1

### 14.1 Conditional Form Inclusion

Generated websites include a contact form **only when `includeForm` is enabled** (default: true). The form, navigation contact link, and hero CTA button are all conditionally rendered:

```
SiteBuilderEditor:
  User toggles "Include Contact Form" (includeForm state)
    ├── ON  → Show form config UI (destination email, auto-reply, field builder)
    └── OFF → Hide form config UI, no form in generated site

generateSiteHtml():
  if (includeForm) {
    ├── Render contact section with dynamic fields from formConfig
    ├── Include nav "Contact" link
    └── Include hero CTA button linking to #contact
  } else {
    ├── Omit contact section entirely
    ├── Omit nav "Contact" link
    └── Omit hero CTA button
  }
```

### 14.2 Custom Form Fields

Form fields are configured via `formConfig.fields` array. Each field defines:
- `name` — form field key (used in submission JSON)
- `label` — display label
- `type` — text | email | tel | textarea | select
- `required` — validation flag
- `options` — select dropdown options (for select type only)

Default fields (when no custom config): Name (text), Email (email), Message (textarea).

### 14.3 Form Submission Flow

```
Website visitor fills form
    ↓
JavaScript fetch() → POST /api/v1/sites/forms/submit
    ├── site_id (hidden)
    ├── bot_check_url (honeypot — hidden, must be empty)
    └── Dynamic form fields (name, email, message, etc.)
    ↓
Backend receives submission:
    ├── 1. Honeypot check — bot_check_url non-empty → silent 200 (trap)
    ├── 2. IP rate limit — max 10 per IP/site per 10 minutes
    ├── 3. Free tier cap — max 50 submissions per site
    ├── 4. Store in site_form_submissions table
    ├── 5. Send notification email to destinationEmail (background)
    └── 6. Send auto-reply to submitter's email (background)
    ↓
Site owner views submissions:
    WebsiteManager → "Submissions" button → FormSubmissions page
    ├── Inbox-style list with unread badges
    ├── Click to view detail + auto mark-as-read
    └── Delete with confirmation
```

### 14.4 Rate Limiting (In-Memory)

```
formSubmitLimiter = Map<string, { count: number; resetAt: number }>

Key: "{ip}:{site_id}"
Window: 10 minutes (600,000ms)
Max: 10 submissions per key per window

On submit:
  ├── Key exists && window active && count >= 10 → 429 "Too many submissions"
  ├── Key exists && window active && count < 10  → count++, proceed
  ├── Key exists && window expired               → reset count=1, new window
  └── Key missing                                → create key, count=1, new window
```

### 14.5 Email Notifications

```
Form submission stored
    ↓
Background IIFE (non-blocking):
    ├── Notification to site owner (if destinationEmail configured):
    │   Subject: "New form submission — {business_name}"
    │   Body: HTML table of all submitted fields + timestamp + IP + dashboard link
    │   On success: UPDATE notification_sent = 1
    │
    └── Auto-reply to submitter (if autoReplyMessage + submitter email exist):
        Subject: "Thank you for contacting {business_name}"
        Body: Configured auto-reply message
```

### 14.6 AI Chat Widget (Conditional)

Generated sites include the SoftAware chat widget **only when `includeAssistant` is enabled** (default: false) **and** a valid `clientId` is provided:

```
generateSiteHtml():
  isRealAssistant = includeAssistant === true
    && clientId is truthy
    && clientId !== 'preview'
    && matches UUID pattern
  
  if (isRealAssistant) {
    → Include <script src="...widget.js" data-client-id="..." defer></script>
  } else {
    → No widget script in generated HTML
  }
```

---

## 15. File Lifecycle

```
Site created       → DB record (status: draft, max_pages from tier)
Pages created      → site_pages rows (tier-gated)
Images uploaded    → /var/opt/backend/uploads/sites/
                        (persisted, served via Express static mount)
AI generated       → generated_html column in DB (site or page level)
                        (no temp files for AI-generated content)
Navigation injected → injectNavigation() updates all page HTML with nav bar
Form configured    → form_config JSON, include_form, include_assistant stored in DB
                        (persisted with site record)
Template generated → /var/tmp/generated_sites/{id}/
                        (temporary, regenerated as needed)
Form submitted     → site_form_submissions row (visitor form data as JSON)
                        (notification + auto-reply emails sent in background)
Site deployed      → FTP/SFTP to client's server
                        (files live on client's hosting)
Trial expires      → max_pages → 1 (auto-downgrade)
                   → Existing pages remain, new pages blocked
Site deleted       → DB record removed (CASCADE to pages + deployments + submissions)
                   → Generated files cleaned up
                   → Uploaded images remain (manual cleanup)
Admin force-delete → Explicit deletion of pages, deployments, then site
```
