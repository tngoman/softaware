# Site Builder Module — API Routes Reference

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## 1. Overview

| Property | Value |
|----------|-------|
| **User base path** | `/api/v1/sites` |
| **Admin base path** | `/api/admin/sites` |
| **Registered in** | `src/app.ts` → `apiRouter.use('/v1/sites', siteBuilderRoutes)` + `apiRouter.use('/admin/sites', auditLogger, adminSitesRouter)` |
| **Auth** | User endpoints require JWT (`requireAuth`); admin endpoints require JWT + admin role (`requireAdmin`); preview supports `?token=` query param |
| **Total endpoints** | 33 (27 user-facing + 6 admin) |

---

## 2. CRUD Endpoints

### 2.1 `POST /` — Create Site

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | JSON `SiteData` |
| Returns | 201 + `{ success, site }` |

**Behavior (v3.0):**
1. Creates site record in `generated_sites`
2. Auto-resolves user's subscription tier via `resolveUserTier(userId)`
3. Sets `max_pages` based on tier (Free = 1, Starter = 5, Pro = 15, Enterprise = 50)

**Request Body:**

```json
{
  "businessName": "Acme Corp",          // Required
  "tagline": "Building Better Solutions",
  "aboutUs": "About text here...",
  "services": "Web Dev, Hosting, IT Support",
  "contactEmail": "info@acme.com",
  "contactPhone": "+27 11 123 4567",
  "themeColor": "#0044cc",
  "widgetClientId": "uuid-of-assistant"
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ success: true, site }` | Success (ftp_password stripped) |
| 400 | `{ error: "Business name is required" }` | Missing businessName |
| 500 | `{ error: "Failed to create site" }` | Server error |

---

### 2.2 `GET /tier` — Get User's Subscription Tier ★ NEW v3.0

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ success, tier, maxPages, packageSlug, status, daysLeft }` |

**Response:**

```json
{
  "success": true,
  "tier": "paid",
  "maxPages": 15,
  "packageSlug": "pro",
  "status": "ACTIVE",
  "daysLeft": null
}
```

**Free user response:**

```json
{
  "success": true,
  "tier": "free",
  "maxPages": 1,
  "packageSlug": null,
  "status": null,
  "daysLeft": null
}
```

---

### 2.3 `GET /` — List User's Sites

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Returns | 200 + `{ sites: GeneratedSite[] }` |

**Notes:**
- Returns only sites belonging to the authenticated user
- `ftp_password` is stripped from all returned records
- `generated_html` is excluded from list response for performance (can be very large)
- Ordered by `created_at DESC`
- Frontend uses snake_case field names directly (`business_name`, `status`, `created_at`, etc.)

---

### 2.4 `GET /:siteId` — Get Site Details

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ site }` |

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ site }` | Found and owned by user |
| 404 | `{ error: "Site not found" }` | Not found or not owned |

---

### 2.5 `PUT /:siteId` — Update Site

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Body | Partial `SiteData` |
| Returns | 200 + `{ message, site }` |

**Notes:**
- Only provided fields are updated (dynamic SET clause)
- FTP password is encrypted before storage if provided
- `widgetClientId` can be updated (UUID-validated, existence-checked against `widget_clients`; pass `null`/`""` to clear)
- Ownership verified before update

---

### 2.6 `DELETE /:siteId` — Delete Site

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ message }` |

**Side Effects:**
- Deletes the DB record
- Removes generated files from `/var/tmp/generated_sites/{siteId}/`
- Cascades to `site_deployments` and `site_pages` via FK

---

## 3. Generation Endpoints

### 3.1 `POST /generate-ai` — AI-Powered Website Generation (Async, Tiered)

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | JSON (see below) |
| Returns | 200 + `{ success, generating, siteId, message }` — returns immediately |

**Behavior (v3.0):**
1. Resolves user tier **server-side** via `resolveUserTier(userId)` — the `tier` field in the request body is **ignored**
2. Validates fields and ownership
3. Marks site status → `'generating'`
4. Returns 200 immediately
5. Background IIFE selects AI model based on tier:
   - **Paid:** GLM → OpenRouter → Ollama fallback chain
   - **Free:** Ollama only (qwen2.5:3b-instruct)

**Request Body:**

```json
{
  "siteId": "uuid-of-site",              // Optional — auto-created if missing
  "businessName": "Acme Corp",           // Required
  "tagline": "Building Better Solutions", // Required
  "aboutText": "About the company...",   // Required
  "services": ["Web Development", "IT Support"],  // Required, array
  "logoUrl": "https://...",              // Optional
  "heroImageUrl": "https://...",         // Optional
  "clientId": "uuid-of-assistant",       // Optional — for widget embedding
  "includeForm": true,                   // Optional (default true) ★ v3.1
  "includeAssistant": false,             // Optional (default false) ★ v3.1
  "formConfig": {                        // Optional ★ v3.1
    "fields": [
      { "name": "name", "label": "Name", "type": "text", "required": true },
      { "name": "email", "label": "Email", "type": "email", "required": true },
      { "name": "message", "label": "Message", "type": "textarea", "required": false }
    ],
    "destinationEmail": "info@acme.com",
    "autoReplyMessage": "Thanks for reaching out!",
    "submitButtonText": "Send Message"
  }
}
```

> **Security note (v3.0):** The `tier` field was removed from the request body. Tier is now resolved server-side to prevent clients from spoofing paid-tier access.

> **v3.1 changes:** `clientId` is no longer required. New `includeForm`, `includeAssistant`, and `formConfig` fields control whether the contact form and AI assistant widget are included in the generated site.

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success, generating: true, siteId, tier, queuePosition, message }` | Generation started (async) |
| 400 | `{ error: "Missing required fields" }` | Missing fields |
| 400 | `{ error: "services must be a non-empty array" }` | Invalid services |
| 500 | `{ error: "Failed to start website generation" }` | Server error |

---

### 3.2 `GET /:siteId/generation-status` — Poll AI Generation Progress

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ success, status, html?, error? }` |

**Behavior:**
- Returns current status: `generating`, `generated`, `failed`
- If `generated` → includes `html` field with full generated HTML
- If `failed` → includes `error` field with human-readable message
- Frontend polls every 4s with 10-min max timeout

---

### 3.3 `POST /:siteId/generate` — Generate Static Files (Template)

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ message, outputDir }` |

**Behavior:**
1. Fetches site by ID with ownership check
2. Calls `siteBuilderService.generateStaticFiles(siteId)`
3. Builds HTML + CSS via `buildHTML()` / `buildCSS()` templates
4. Writes to `/var/tmp/generated_sites/{siteId}/`
5. Updates site status → `generated`

---

### 3.4 `POST /:siteId/skip-queue` — Priority Re-Trigger (Paid)

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ success, generating, siteId, tier, queuePosition, message }` |

**Behavior:**
- Re-triggers generation with paid-tier AI for a site currently in `'generating'` status
- Uses site data already stored in DB
- Returns immediately, runs generation in background
- Only valid when `site.status === 'generating'`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success: true, generating: true, siteId, tier: 'paid', queuePosition: 0, message }` | Re-triggered |
| 400 | `{ error: "Site is not currently generating" }` | Wrong status |

---

### 3.5 `POST /:siteId/polish` — AI Design Polish

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Body | `{ prompt: string }` |
| Returns | 200 + `{ success, generating, siteId, queuePosition, message }` |

**Behavior:**
1. Takes user's design prompt + current `generated_html`
2. Sends both to AI with instructions to modify the HTML
3. Runs asynchronously (marks `generating`, returns immediately)
4. Stores modified HTML on completion

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success: true, generating: true, siteId, queuePosition, message }` | Polish started |
| 400 | `{ error: "A polish prompt is required" }` | Missing prompt |
| 400 | `{ error: "This site has no generated HTML to polish" }` | No HTML yet |
| 409 | `{ error: "Site is already being generated" }` | Already generating |

---

### 3.6 `GET /:siteId/preview` — Live HTML Preview

| Property | Value |
|----------|-------|
| Auth | JWT via `Authorization` header **or** `?token=` query param |
| Params | `siteId` — UUID |
| Returns | `text/html` — the full generated HTML page |

**Why `?token=` query param?**  
This endpoint is opened in a new browser tab via `window.open()`, which cannot send custom Authorization headers. The JWT is passed as a query parameter instead.

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | Raw HTML page | Success |
| 401 | `<h1>Unauthorized</h1>` | No token provided |
| 401 | `<h1>Invalid or expired token</h1>` | JWT verification failed |
| 403 | `<h1>Access denied</h1>` | User doesn't own this site |
| 404 | `<h1>Site not found</h1>` | Site ID doesn't exist |
| 404 | `<h1>No generated content yet</h1>` | Site has no `generated_html` |

---

## 4. Multi-Page Endpoints ★ NEW v3.0

All multi-page endpoints are nested under `/:siteId/pages`. Ownership of the parent site is verified on every request.

### 4.1 `GET /:siteId/pages` — List Site Pages

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ success, pages, maxPages, currentCount }` |

**Notes:**
- Pages ordered by `sort_order ASC, created_at ASC`
- `generated_html` is stripped from list response (fetch via individual page endpoint)
- `content_data` is parsed from JSON string to object
- Returns `maxPages` (from `generated_sites.max_pages`) and `currentCount` for quota display

---

### 4.2 `POST /:siteId/pages` — Create Page (Tier-Gated)

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Body | JSON (see below) |
| Returns | 201 + `{ success, page }` |

**Tier Enforcement:**
1. Checks `max_pages` for the site
2. If `max_pages <= 1` → returns 403 with `UPGRADE_REQUIRED` code
3. If current page count >= `max_pages` → returns 400 with `PAGE_LIMIT_REACHED` code

**Request Body:**

```json
{
  "pageType": "about",                   // Required — see valid types below
  "pageSlug": "about-us",               // Required — auto-sanitized
  "pageTitle": "About Us",              // Required
  "contentData": { "heading": "..." },  // Optional — JSON object
  "sortOrder": 1                        // Optional — auto-assigned if omitted
}
```

**Valid Page Types:** `home`, `about`, `services`, `contact`, `gallery`, `faq`, `pricing`, `custom`

**Slug Sanitization:**
- Lowercased
- Non-alphanumeric characters replaced with `-`
- Consecutive hyphens collapsed
- Leading/trailing hyphens stripped
- Must contain at least one alphanumeric character

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ success: true, page }` | Page created |
| 400 | `{ error: "pageType, pageSlug, and pageTitle are required" }` | Missing fields |
| 400 | `{ error: "Invalid pageType..." }` | Invalid type |
| 400 | `{ error: "Page limit reached (N)" , code: "PAGE_LIMIT_REACHED" }` | Quota exceeded |
| 403 | `{ error: "Multi-page sites are available on paid plans only", code: "UPGRADE_REQUIRED" }` | Free tier |
| 409 | `{ error: "A page with that slug already exists for this site" }` | Duplicate slug |

---

### 4.3 `GET /:siteId/pages/:pageId` — Get Page Details

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `pageId` — UUID |
| Returns | 200 + `{ success, page }` |

**Notes:**
- Includes full `generated_html` (unlike list endpoint)
- `content_data` is parsed from JSON string to object
- Verifies page belongs to the specified site

---

### 4.4 `PUT /:siteId/pages/:pageId` — Update Page

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `pageId` — UUID |
| Body | Partial update fields |
| Returns | 200 + `{ success, page }` |

**Updatable Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `pageTitle` | string | Page display title |
| `pageSlug` | string | URL slug (re-sanitized) |
| `pageType` | string | Page type (validated against allowed list) |
| `contentData` | object | Type-specific content JSON |
| `generatedHtml` | string | Full generated HTML |
| `sortOrder` | number | Display order |
| `isPublished` | boolean | Publish toggle |

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success: true, page }` | Updated |
| 400 | `{ error: "Invalid pageType..." }` | Invalid type |
| 400 | `{ error: "pageSlug must contain..." }` | Invalid slug |
| 409 | `{ error: "A page with that slug already exists..." }` | Duplicate slug |

---

### 4.5 `DELETE /:siteId/pages/:pageId` — Delete Page

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `pageId` — UUID |
| Returns | 200 + `{ success, message }` |

---

### 4.6 `POST /:siteId/pages/:pageId/generate` — Generate Single Page (AI)

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `pageId` — UUID |
| Returns | 200 + generation result |

**Behavior:**
1. Reads the page's `content_data` and the parent site's business context
2. Generates HTML for that specific page type using AI
3. Stores the result in the page's `generated_html` column
4. Calls `injectNavigation()` to add consistent nav bar across all site pages

---

## 5. Deployment Endpoints

### 5.1 `POST /:siteId/deploy` — Deploy via FTP/SFTP

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ message, deployment }` |

**Behavior:**
1. Ownership check
2. Decrypts FTP credentials in-memory
3. Creates `site_deployments` record (status: `pending`)
4. Generates static files if not already generated
5. Connects to FTP/SFTP server
6. Uploads all files from `/var/tmp/generated_sites/{siteId}/`
7. Updates deployment record (status → `success` or `failed`)
8. Updates site `last_deployed_at` or `deployment_error`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ message: "Deployed successfully", deployment }` | All files uploaded |
| 400 | `{ error: "FTP credentials not configured" }` | Missing FTP config |
| 404 | `{ error: "Site not found" }` | Not found or not owned |
| 500 | `{ error: "Deployment failed: ..." }` | Connection or upload error |

---

### 5.2 `GET /:siteId/deployments` — Deployment History

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ deployments }` |

**Notes:**
- Returns all deployment attempts ordered by `deployed_at DESC`
- Includes status, file counts, duration, and error messages

---

## 6. Upload Endpoints

### 6.1 `POST /upload/logo` — Upload Logo Image

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `multipart/form-data` |
| Field | `logo` |
| Max size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Returns | 200 + `{ success, url }` |

---

### 6.2 `POST /upload/hero` — Upload Hero Image

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `multipart/form-data` |
| Field | `hero` |
| Max size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Returns | 200 + `{ success, url }` |

---

## 7. Admin Endpoints ★ NEW v3.0

**Base path:** `/api/admin/sites`  
**Auth:** All endpoints require JWT + admin role (`admin`, `staff`, or `developer`)  
**Middleware:** `requireAuth` → `requireAdmin` → `auditLogger`

### 7.1 `GET /stats` — Aggregate Statistics

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Returns | 200 + `{ success, stats }` |

**Response:**

```json
{
  "success": true,
  "stats": {
    "total_sites": 42,
    "draft_count": 10,
    "generating_count": 2,
    "generated_count": 15,
    "deployed_count": 12,
    "failed_count": 3,
    "total_pages": 87,
    "trial_sites": 5,
    "recent_deployments": 8
  }
}
```

| Stat | Description |
|------|-------------|
| `total_sites` | All sites across all users |
| `draft_count` | Sites in draft status |
| `generating_count` | Sites currently being generated |
| `generated_count` | Sites with completed generation |
| `deployed_count` | Sites deployed to FTP |
| `failed_count` | Sites with failed generation/deployment |
| `total_pages` | Total rows in `site_pages` table |
| `trial_sites` | Sites owned by users on active trials |
| `recent_deployments` | Sites deployed in the last 7 days |

---

### 7.2 `GET /` — List All Sites (Paginated)

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Query params | `search`, `status`, `page`, `limit`, `sort`, `order` |
| Returns | 200 + `{ success, sites, pagination }` |

**Query Parameters:**

| Param | Default | Description |
|-------|---------|-------------|
| `search` | `''` | Search in business_name, owner email, owner name |
| `status` | `''` | Filter by site status (draft/generating/generated/deployed/failed) |
| `page` | `1` | Page number |
| `limit` | `25` | Results per page (max 100) |
| `sort` | `created_at` | Sort column (created_at, updated_at, business_name, status) |
| `order` | `DESC` | Sort order (ASC/DESC) |

**Response includes:**
- Owner info (email, name)
- Page count per site
- Subscription status and package name
- Trial end date

---

### 7.3 `GET /:siteId` — Get Site Detail (Admin)

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Params | `siteId` — UUID |
| Returns | 200 + `{ success, site, pages }` |

**Notes:**
- Returns full site details (ftp_password stripped)
- Includes all pages (generated_html stripped from pages)
- No ownership restriction — admin can view any site

---

### 7.4 `PATCH /:siteId` — Admin Override

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Params | `siteId` — UUID |
| Body | `{ status?, maxPages? }` |
| Returns | 200 + `{ success, site }` |

**Overridable Fields:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `status` | string | Valid ENUM value | Override site status |
| `maxPages` | number | 1–50 | Override page limit |

**Use Cases:**
- Reset a failed site to `draft` status
- Override a user's page limit for support purposes
- Manually mark a site as `deployed`

---

### 7.5 `DELETE /:siteId` — Force Delete

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Params | `siteId` — UUID |
| Returns | 200 + `{ success, message }` |

**Behavior:**
- Deletes pages first (`site_pages`), then deployments (`site_deployments`), then the site (`generated_sites`)
- No ownership restriction — admin can delete any site

---

### 7.6 `GET /trials/active` — Active Trials

| Property | Value |
|----------|-------|
| Auth | JWT + admin role |
| Returns | 200 + `{ success, trials }` |

**Response:**

```json
{
  "success": true,
  "trials": [
    {
      "id": "site-uuid",
      "business_name": "Trial Corp",
      "status": "generated",
      "max_pages": 5,
      "created_at": "2026-03-01T...",
      "owner_email": "trial@example.com",
      "owner_name": "Trial User",
      "trial_ends_at": "2026-03-15T...",
      "sub_status": "TRIAL",
      "package_name": "Starter",
      "days_left": 5
    }
  ]
}
```

**Notes:**
- Only shows sites owned by users with `cp.status = 'TRIAL'`
- Ordered by `trial_ends_at ASC` (soonest expiry first)
- Includes `days_left` (computed via `DATEDIFF`)

---

## 8. Error Handling

All endpoints follow consistent error patterns:

| Status | Meaning |
|--------|---------|
| 400 | Validation error (missing fields, invalid data, page limit reached) |
| 401 | Not authenticated (JWT missing/invalid) |
| 403 | Not authorized (ownership check failed, upgrade required, admin required) |
| 404 | Resource not found |
| 409 | Conflict (duplicate slug, already generating) |
| 500 | Internal server error (logged) |

**Multer Errors:**

| Code | Message |
|------|---------|
| `LIMIT_FILE_SIZE` | "File too large. Maximum size is 5MB" |
| `LIMIT_UNEXPECTED_FILE` | "Unexpected field name" |
| Invalid MIME type | "Only JPEG, PNG, GIF and WEBP images are allowed" |

**Tier-Specific Error Codes (v3.0):**

| Code | Status | Description |
|------|--------|-------------|
| `UPGRADE_REQUIRED` | 403 | Free-tier user attempting to create additional pages |
| `PAGE_LIMIT_REACHED` | 400 | User has reached their max_pages quota |

---

## 9. Ownership Verification

Every endpoint that takes `:siteId` performs ownership verification:

```
1. Fetch site by ID
2. If site.user_id !== req.user.id → 404 (or 403 for pages)
3. Proceed only if ownership confirmed
```

**Exception:** Admin endpoints bypass ownership checks — they can access any site.

**Security rationale:** Returns 404 (not 403) on CRUD endpoints to avoid leaking the existence of sites belonging to other users. Page endpoints return 403 since the user already knows the site exists.

---

## 10. Form Submission Endpoints ★ NEW v3.1

### 10.1 `POST /forms/submit` — Public Form Submission

| Property | Value |
|----------|-------|
| Auth | **None** (public endpoint) |
| Body | JSON (see below) |
| Returns | 200 + `{ success, message }` |

**Behavior:**
1. Honeypot check — if `bot_check_url` field is non-empty, returns silent success (bot trap)
2. IP rate limit — max 10 submissions per IP per site per 10 minutes (in-memory Map)
3. Free tier cap — max 50 total submissions per site for free-tier users
4. Stores submission in `site_form_submissions` table
5. Sends notification email to `formConfig.destinationEmail` (background, non-blocking)
6. Sends auto-reply to submitter's email if `autoReplyMessage` is configured (background)

**Request Body:**

```json
{
  "site_id": "uuid-of-site",             // Required
  "bot_check_url": "",                    // Honeypot — must be empty
  "name": "John Doe",                    // Dynamic form fields
  "email": "john@example.com",           // (varies per form config)
  "message": "Hello..."
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success: true, message: "Thank you..." }` | Submission stored |
| 200 | `{ success: true, message: "Thank you!" }` | Bot detected (silent fail) |
| 400 | `{ error: "Missing site_id" }` | No site_id in body |
| 404 | `{ error: "Site not found" }` | Invalid site_id |
| 429 | `{ error: "Too many submissions..." }` | IP rate limit exceeded |
| 429 | `{ error: "This site has reached its submission limit." }` | Free tier 50 cap |
| 500 | `{ error: "Failed to process submission" }` | Server error |

**Email Notifications:**
- **To site owner:** HTML email with all form fields, timestamp, IP, link to submissions dashboard
- **Auto-reply to submitter:** Configured `autoReplyMessage` text, sent only if both `autoReplyMessage` and submitter `email` exist

---

### 10.2 `GET /:siteId/submissions` — List Form Submissions

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Query | `page` (default 1), `limit` (default 20, max 100), `unread` (0 or 1) |
| Returns | 200 + `{ success, submissions, pagination, unreadCount }` |

**Response:**

```json
{
  "success": true,
  "submissions": [
    {
      "id": "submission-uuid",
      "form_data": { "name": "John", "email": "john@example.com", "message": "Hello" },
      "submitted_at": "2026-03-15T10:30:00.000Z",
      "ip_address": "41.13.x.x",
      "is_read": 0,
      "notification_sent": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "unreadCount": 3
}
```

**Notes:**
- `form_data` is parsed from JSON string to object
- Ordered by `submitted_at DESC` (newest first)
- `unreadCount` always returned regardless of filter

---

### 10.3 `PATCH /:siteId/submissions/:submissionId/read` — Mark as Read

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `submissionId` — UUID |
| Returns | 200 + `{ success: true }` |

---

### 10.4 `DELETE /:siteId/submissions/:submissionId` — Delete Submission

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID, `submissionId` — UUID |
| Returns | 200 + `{ success: true, message: "Submission deleted" }` |
