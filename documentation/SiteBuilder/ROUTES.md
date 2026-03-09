# Site Builder Module — API Routes Reference

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

---

## 1. Overview

| Property | Value |
|----------|-------|
| **Base path** | `/api/v1/sites` |
| **Registered in** | `src/app.ts` → `app.use('/api/v1/sites', siteBuilderRoutes)` |
| **Auth** | All endpoints require JWT (`requireAuth` middleware); preview supports `?token=` query param |
| **Total endpoints** | 13 |

---

## 2. CRUD Endpoints

### 2.1 `POST /` — Create Site

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | JSON `SiteData` |
| Returns | 201 + `{ message, site }` |

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
| 201 | `{ message: "Site created successfully", site }` | Success |
| 400 | `{ error: "Business name is required" }` | Missing businessName |
| 500 | `{ error: "Failed to create site" }` | Server error |

---

### 2.2 `GET /` — List User's Sites

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

### 2.3 `GET /:siteId` — Get Site Details

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

### 2.4 `PUT /:siteId` — Update Site

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

### 2.5 `DELETE /:siteId` — Delete Site

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ message }` |

**Side Effects:**
- Deletes the DB record
- Removes generated files from `/var/tmp/generated_sites/{siteId}/`
- Cascades to `site_deployments` via FK

---

## 3. Generation Endpoints

### 3.1 `POST /:siteId/generate` — Generate Static Files (Template)

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

**Output Files:**

| File | Content |
|------|---------|
| `index.html` | Full landing page with business data, contact form, widget script |
| `styles.css` | Theme-colored responsive CSS |

---

### 3.2 `POST /generate-ai` — AI-Powered Website Generation (Async)

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | JSON (see below) |
| Returns | 200 + `{ success, generating, siteId, message }` — returns immediately |

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
  "clientId": "uuid-of-assistant"        // Required, for widget embedding
}
```

**AI Configuration:**

| Setting | Value |
|---------|-------|
| Model | `env.SITE_BUILDER_OLLAMA_MODEL` (`qwen2.5:3b-instruct`) |
| Temperature | 0.4 |
| num_predict | 4096 |
| Timeout | 600s (10 minutes) |
| API | `POST http://127.0.0.1:11434/api/chat` (system + user messages, non-streaming) |

**System Prompt:** Concise instruction — output only raw HTML, use Tailwind CDN, be concise.

**User Prompt Includes:**
- Business data (name, tagline, about, services)
- Logo URL or fallback instruction
- Hero image URL or gradient fallback
- Required sections: Hero, About, Services grid, Contact
- Contact form HTML provided **verbatim** (action URL, honeypot field, client_id)
- SoftAware chat widget `<script>` tag provided **verbatim**

**Post-Processing:**
1. Strips markdown code fences (` ```html ... ``` `)
2. Validates response starts with `<!DOCTYPE` or `<html`
3. Stores HTML in `generated_html` DB column, sets status → `generated`
4. On failure, stores error in `generation_error` column, sets status → `failed`

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ success, generating: true, siteId, message }` | Generation started (async) |
| 400 | `{ error: "Missing required fields" }` | Missing fields |
| 400 | `{ error: "services must be a non-empty array" }` | Invalid services |
| 500 | `{ error: "Failed to start website generation" }` | Server error |

---

### 3.3 `GET /:siteId/generation-status` — Poll AI Generation Progress

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

### 3.4 `GET /:siteId/preview` — Live HTML Preview (NEW v2.1)

| Property | Value |
|----------|-------|
| Auth | JWT via `Authorization` header **or** `?token=` query param |
| Params | `siteId` — UUID |
| Returns | `text/html` — the full generated HTML page |

**Behavior:**
1. Authenticates via Bearer token or `?token=` query parameter
2. Verifies JWT and extracts `userId`
3. Ownership check: `site.user_id === userId`
4. Serves `generated_html` as `text/html; charset=utf-8`

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

## 4. Deployment Endpoints

### 4.1 `POST /:siteId/deploy` — Deploy via FTP/SFTP

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

### 4.2 `GET /:siteId/deployments` — Deployment History

| Property | Value |
|----------|-------|
| Auth | JWT required + ownership check |
| Params | `siteId` — UUID |
| Returns | 200 + `{ deployments }` |

**Notes:**
- Returns all deployment attempts ordered by `deployed_at DESC`
- Includes status, file counts, duration, and error messages

---

## 5. Upload Endpoints

### 5.1 `POST /upload/logo` — Upload Logo Image

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `multipart/form-data` |
| Field | `logo` |
| Max size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Returns | 200 + `{ url }` |

**Response:**

```json
{
  "success": true,
  "url": "https://api.softaware.net.za/uploads/sites/1709901234567-a1b2c3.png"
}
```

---

### 5.2 `POST /upload/hero` — Upload Hero Image

| Property | Value |
|----------|-------|
| Auth | JWT required |
| Body | `multipart/form-data` |
| Field | `hero` |
| Max size | 5 MB |
| Allowed types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Returns | 200 + `{ url }` |

---

## 6. Error Handling

All endpoints follow consistent error patterns:

| Status | Meaning |
|--------|---------|
| 400 | Validation error (missing fields, invalid data) |
| 401 | Not authenticated (JWT missing/invalid) |
| 403 | Not authorized (ownership check failed) |
| 404 | Resource not found |
| 500 | Internal server error (logged) |

**Multer Errors:**

| Code | Message |
|------|---------|
| `LIMIT_FILE_SIZE` | "File too large. Maximum size is 5MB" |
| `LIMIT_UNEXPECTED_FILE` | "Unexpected field name" |
| Invalid MIME type | "Only JPEG, PNG, GIF and WEBP images are allowed" |

---

## 7. Ownership Verification

Every endpoint that takes `:siteId` performs ownership verification:

```
1. Fetch site by ID
2. If site.user_id !== req.user.id → 404
3. Proceed only if ownership confirmed
```

**Security rationale:** Returns 404 (not 403) to avoid leaking the existence of sites belonging to other users.
