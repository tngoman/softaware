# Site Builder Module — Fields & Schema Reference

**Version:** 3.1.0  
**Last Updated:** 2026-03-15

---

## 1. Database Tables

### 1.1 `generated_sites` — Main Site Record

Stores all information for client-generated websites, including business data, design settings, page quota, and encrypted FTP credentials for deployment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | NO | — | UUID primary key |
| `user_id` | VARCHAR(36) | NO | — | FK → `User(id)` CASCADE |
| `widget_client_id` | VARCHAR(36) | YES | NULL | FK → `widget_clients(id)` SET NULL — links site to a chat assistant |
| `business_name` | VARCHAR(255) | NO | — | Business display name (required on creation) |
| `tagline` | VARCHAR(512) | YES | NULL | Hero section subtitle |
| `logo_url` | VARCHAR(1024) | YES | NULL | CDN path to uploaded logo image |
| `hero_image_url` | VARCHAR(1024) | YES | NULL | CDN path to uploaded hero image |
| `about_us` | TEXT | YES | NULL | About section content |
| `services` | TEXT | YES | NULL | Services list (free text or JSON) |
| `contact_email` | VARCHAR(255) | YES | NULL | Contact form recipient email |
| `contact_phone` | VARCHAR(50) | YES | NULL | Contact phone number |
| `ftp_server` | VARCHAR(255) | YES | NULL | Deployment FTP/SFTP server hostname |
| `ftp_username` | VARCHAR(255) | YES | NULL | FTP username |
| `ftp_password` | TEXT | YES | NULL | **Encrypted** — AES-256-GCM with IV + auth tag |
| `ftp_port` | INT | YES | 21 | FTP/SFTP port |
| `ftp_protocol` | ENUM('ftp','sftp') | YES | 'sftp' | Transfer protocol |
| `ftp_directory` | VARCHAR(512) | YES | '/public_html' | Remote upload directory |
| `generated_html` | LONGTEXT | YES | NULL | **v2.0** — AI-generated full HTML stored directly in DB |
| `generation_error` | VARCHAR(2000) | YES | NULL | **v2.0** — Human-readable error message if generation failed |
| `form_config` | JSON | YES | NULL | **v3.1** — Form field configuration (fields, destinationEmail, autoReplyMessage, submitButtonText) |
| `include_form` | TINYINT(1) | NO | 1 | **v3.1** — Whether to include contact form in generated site |
| `include_assistant` | TINYINT(1) | NO | 0 | **v3.1** — Whether to include AI chat widget in generated site |
| `max_pages` | INT | NO | 1 | **v3.0** — Maximum allowed pages; set from subscription tier |
| `status` | ENUM('draft','generating','generated','deployed','failed') | YES | 'draft' | Current site lifecycle status |
| `last_deployed_at` | DATETIME | YES | NULL | Timestamp of last successful deployment |
| `deployment_error` | TEXT | YES | NULL | Last deployment error message |
| `theme_color` | VARCHAR(7) | YES | '#0044cc' | Primary theme color (hex) |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Row creation time |
| `updated_at` | DATETIME | YES | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

#### Indexes

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | `id` | Primary Key |
| `idx_generated_sites_user` | `user_id` | Non-unique |
| `idx_generated_sites_client` | `widget_client_id` | Non-unique |
| `idx_generated_sites_status` | `status` | Non-unique |

#### Foreign Keys

| FK Name | Column | References | On Delete |
|---------|--------|------------|-----------|
| `fk_generated_sites_user` | `user_id` | `User(id)` | CASCADE |
| `fk_generated_sites_client` | `widget_client_id` | `widget_clients(id)` | SET NULL |

#### Status Transitions

```
draft ──→ generating ──→ generated ──→ deployed
               │            │             │
               ▼            ▼             ▼
            failed ───── failed ──── failed
                             │
                             └──→ generating (retry)
```

| From | To | Trigger |
|------|----|------|
| draft | generating | `POST /generate-ai` accepted |
| generating | generated | Background AI completes successfully |
| generating | failed | Background AI errors (timeout, invalid HTML, Ollama down) |
| generated | deployed | `POST /:siteId/deploy` succeeds |
| generated | failed | Deployment fails |
| generated | generating | Polish or regeneration requested |
| deployed | generating | Re-generation or polish after changes |
| deployed | failed | Re-deployment fails |
| failed | generating | Retry generation |
| failed | draft | Admin override via `PATCH /admin/sites/:siteId` |

#### max_pages Values by Tier

| Tier | max_pages | Set By |
|------|-----------|--------|
| Free (no subscription) | 1 | Default |
| Starter | 5 | `resolveUserTier()` on site creation |
| Pro | 15 | `resolveUserTier()` on site creation |
| Enterprise | 50 | `resolveUserTier()` on site creation |
| Trial expired | 1 | `enforceTrialExpiry()` auto-downgrade |
| Admin override | 1–50 | `PATCH /admin/sites/:siteId` |

---

### 1.2 `site_pages` — Multi-Page Content ★ NEW v3.0

Stores individual pages for multi-page websites. Each page has a type, slug, content data (JSON), and optionally generated HTML.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | NO | — | UUID primary key |
| `site_id` | VARCHAR(36) | NO | — | FK → `generated_sites(id)` CASCADE |
| `page_type` | ENUM('home','about','services','contact','gallery','faq','pricing','custom') | NO | — | Page template type |
| `page_slug` | VARCHAR(255) | NO | — | URL slug (sanitized, unique per site) |
| `page_title` | VARCHAR(255) | NO | — | Display title |
| `content_data` | JSON | YES | '{}' | Type-specific content fields (JSON object) |
| `generated_html` | LONGTEXT | YES | NULL | AI-generated HTML for this page |
| `sort_order` | INT | NO | 0 | Display order (ascending) |
| `is_published` | TINYINT(1) | NO | 1 | Whether page is published (0/1) |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Row creation time |
| `updated_at` | DATETIME | YES | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

#### Indexes

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | `id` | Primary Key |
| `idx_site_pages_site` | `site_id` | Non-unique |
| UNIQUE | `site_id, page_slug` | Unique (no duplicate slugs per site) |

#### Foreign Keys

| FK Name | Column | References | On Delete |
|---------|--------|------------|-----------|
| `fk_site_pages_site` | `site_id` | `generated_sites(id)` | CASCADE |

#### Page Types

| Type | Typical content_data Fields | Description |
|------|----------------------------|-------------|
| `home` | heading, hero_text | Main landing page (auto-created with site) |
| `about` | heading, story, mission, team | Company information |
| `services` | heading, intro, services[] | List of services offered |
| `contact` | heading, address, phone, email, hours | Contact details + form |
| `gallery` | heading, images[] | Image gallery |
| `faq` | heading, questions[] | Frequently asked questions |
| `pricing` | heading, plans[] | Pricing tiers/plans |
| `custom` | heading, content | Free-form custom content |

#### content_data Example (Services page)

```json
{
  "heading": "Our Services",
  "intro": "We offer a wide range of professional services.",
  "services": [
    { "name": "Web Development", "description": "Custom websites..." },
    { "name": "Cloud Hosting", "description": "Reliable hosting..." }
  ]
}
```

#### content_data Example (About page)

```json
{
  "heading": "About Us",
  "story": "Founded in 2020, we set out to...",
  "mission": "Our mission is to empower businesses...",
  "team": "A team of dedicated professionals..."
}
```

#### content_data Example (Contact page)

```json
{
  "heading": "Get in Touch",
  "address": "123 Main Street, Johannesburg",
  "phone": "+27 11 123 4567",
  "email": "info@example.com",
  "hours": "Mon-Fri 8:00-17:00"
}
```

---

### 1.3 `site_deployments` — Deployment History

Logs every deployment attempt with timing, file count, and error tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | NO | — | UUID primary key |
| `site_id` | VARCHAR(36) | NO | — | FK → `generated_sites(id)` CASCADE |
| `status` | ENUM('pending','uploading','success','failed') | YES | 'pending' | Deployment step status |
| `files_uploaded` | INT | YES | 0 | Count of files successfully uploaded |
| `total_files` | INT | YES | 0 | Total files to upload |
| `error_message` | TEXT | YES | NULL | Error details if failed |
| `deployment_duration_ms` | INT | YES | NULL | Total deployment time in milliseconds |
| `deployed_at` | DATETIME | YES | CURRENT_TIMESTAMP | Deployment attempt timestamp |

#### Indexes

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | `id` | Primary Key |
| `idx_deployments_site` | `site_id` | Non-unique |
| `idx_deployments_status` | `status` | Non-unique |
| `idx_deployments_deployed_at` | `deployed_at` | Non-unique |

#### Foreign Keys

| FK Name | Column | References | On Delete |
|---------|--------|------------|-----------|
| `fk_deployments_site` | `site_id` | `generated_sites(id)` | CASCADE |

#### Deployment Status Flow

```
pending ──→ uploading ──→ success
                │
                ▼
              failed
```

---

### 1.4 `site_form_submissions` — Form Submissions ★ NEW v3.1

Stores form submissions received from generated websites. Each submission contains the form data as JSON, IP address for rate limiting, and read/notification tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR(36) | NO | — | UUID primary key |
| `site_id` | VARCHAR(36) | NO | — | FK → `generated_sites(id)` CASCADE |
| `form_data` | JSON | NO | — | Submitted form fields as JSON object |
| `submitted_at` | DATETIME | YES | CURRENT_TIMESTAMP | Submission timestamp |
| `ip_address` | VARCHAR(45) | YES | NULL | Submitter's IP (IPv4/IPv6) for rate limiting |
| `is_read` | TINYINT(1) | NO | 0 | Whether the site owner has read this submission |
| `notification_sent` | TINYINT(1) | NO | 0 | Whether a notification email was successfully sent |

#### Indexes

| Index | Columns | Type |
|-------|---------|------|
| PRIMARY | `id` | Primary Key |
| `idx_form_subs_site` | `site_id` | Non-unique |
| `idx_form_subs_submitted` | `submitted_at` | Non-unique |

#### Foreign Keys

| FK Name | Column | References | On Delete |
|---------|--------|------------|----------|
| `fk_form_subs_site` | `site_id` | `generated_sites(id)` | CASCADE |

#### form_data Example

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+27 11 123 4567",
  "message": "I'm interested in your services."
}
```

---

## 2. TypeScript Interfaces

### 2.1 `GeneratedSite` — Full DB Row Type

```typescript
interface GeneratedSite {
  id: string;
  user_id: string;
  widget_client_id: string | null;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  about_us: string | null;
  services: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  ftp_server: string | null;
  ftp_username: string | null;
  ftp_password: string | null;       // Encrypted in DB
  ftp_port: number;
  ftp_protocol: 'ftp' | 'sftp';
  ftp_directory: string;
  generated_html: string | null;     // v2.0 — full AI-generated HTML
  generation_error: string | null;   // v2.0 — error message if generation failed
  form_config: string | null;        // v3.1 — JSON form configuration
  include_form: number;              // v3.1 — 1=include form, 0=exclude
  include_assistant: number;         // v3.1 — 1=include widget, 0=exclude
  max_pages: number;                 // v3.0 — page quota from subscription tier
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  last_deployed_at: Date | null;
  deployment_error: string | null;
  theme_color: string;
  created_at: Date;
  updated_at: Date;
}
```

### 2.2 `SitePage` — Page Record Type ★ NEW v3.0

```typescript
interface SitePage {
  id: string;
  site_id: string;
  page_type: 'home' | 'about' | 'services' | 'contact' | 'gallery' | 'faq' | 'pricing' | 'custom';
  page_slug: string;
  page_title: string;
  content_data: string;              // JSON string in DB, parsed on read
  generated_html: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2.3 `SiteData` — Create/Update Payload (camelCase)

```typescript
interface SiteData {
  userId: string;                      // Required: from JWT
  widgetClientId?: string;             // Optional: link to assistant
  businessName: string;                // Required on creation
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  aboutUs?: string;
  services?: string;
  contactEmail?: string;
  contactPhone?: string;
  ftpServer?: string;
  ftpUsername?: string;
  ftpPassword?: string;               // Encrypted before storage
  ftpPort?: number;
  ftpProtocol?: 'ftp' | 'sftp';
  ftpDirectory?: string;
  themeColor?: string;
  includeForm?: number;                // v3.1: 1=include, 0=exclude contact form
  includeAssistant?: number;           // v3.1: 1=include, 0=exclude AI widget
  formConfig?: string;                 // v3.1: JSON string of form configuration
}
```

### 2.4 `TierInfo` — Tier Resolution Result ★ NEW v3.0

```typescript
interface TierInfo {
  tier: 'free' | 'paid';
  maxPages: number;                    // 1 (free), 5/15/50 (paid tiers)
  packageSlug: string | null;         // 'starter', 'pro', 'enterprise', or null
  status: string | null;              // 'TRIAL', 'ACTIVE', or null
  daysLeft: number | null;            // Days left in trial, or null
}
```

### 2.5 `FormFieldConfig` — Form Field Definition ★ NEW v3.1

```typescript
interface FormFieldConfig {
  name: string;                        // Field name (used as form field key)
  label: string;                       // Display label
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];                  // For select type only
}
```

### 2.6 `FormConfig` — Form Configuration ★ NEW v3.1

```typescript
interface FormConfig {
  fields: FormFieldConfig[];           // Custom form fields
  destinationEmail: string;            // Where to send notification emails
  autoReplyMessage?: string;           // Auto-reply text to submitter
  submitButtonText?: string;           // Button text (default: "Send Message")
}
```

### 2.7 `FormSubmission` — Submission Record ★ NEW v3.1

```typescript
interface FormSubmission {
  id: string;
  site_id: string;
  form_data: Record<string, any>;      // Parsed JSON of submitted fields
  submitted_at: string;
  ip_address: string | null;
  is_read: number;                     // 0 = unread, 1 = read
  notification_sent: number;           // 0 = not sent, 1 = sent
}
```

---

## 3. Encryption Details

### FTP Password Storage

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key source | `env.ENCRYPTION_KEY` (32-byte hex) |
| IV | 16 random bytes, prepended to ciphertext |
| Auth tag | 16 bytes, appended to ciphertext |
| Storage format | `{iv}:{encrypted}:{authTag}` (hex-encoded) |
| Decryption | In-memory only via `getDecryptedFTPCredentials()` |

> **Security:** FTP passwords are NEVER returned in API responses. The `ftp_password` field is stripped from GET responses. Decryption only occurs during active deployment.

---

## 4. Example Data

### `generated_sites` Row

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "user-uuid-here",
  "widget_client_id": "client-uuid-here",
  "business_name": "Acme Corporation",
  "tagline": "Building Better Solutions",
  "logo_url": "https://api.softaware.net.za/uploads/sites/1709901234567-abc123.png",
  "hero_image_url": "https://api.softaware.net.za/uploads/sites/1709901234567-def456.jpg",
  "about_us": "We are a leading provider of business solutions...",
  "services": "Web Development, Cloud Hosting, IT Support",
  "contact_email": "info@acme.example.com",
  "contact_phone": "+27 11 123 4567",
  "ftp_server": "ftp.acme.example.com",
  "ftp_username": "acme-deploy",
  "ftp_password": "a1b2c3...:encrypted...:d4e5f6...",
  "ftp_port": 22,
  "ftp_protocol": "sftp",
  "ftp_directory": "/public_html",
  "generated_html": "<!DOCTYPE html><html>...full AI-generated page...</html>",
  "generation_error": null,
  "form_config": "{\"fields\":[{\"name\":\"name\",\"label\":\"Name\",\"type\":\"text\",\"required\":true},{\"name\":\"email\",\"label\":\"Email\",\"type\":\"email\",\"required\":true},{\"name\":\"message\",\"label\":\"Message\",\"type\":\"textarea\",\"required\":false}],\"destinationEmail\":\"info@acme.example.com\",\"autoReplyMessage\":\"Thanks for reaching out! We'll get back to you within 24 hours.\",\"submitButtonText\":\"Send Message\"}",
  "include_form": 1,
  "include_assistant": 0,
  "max_pages": 15,
  "status": "deployed",
  "last_deployed_at": "2026-03-07T14:30:00.000Z",
  "deployment_error": null,
  "theme_color": "#0044cc",
  "created_at": "2026-03-07T10:00:00.000Z",
  "updated_at": "2026-03-07T14:30:00.000Z"
}
```

### `site_pages` Row ★ NEW

```json
{
  "id": "page-uuid-here",
  "site_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "page_type": "about",
  "page_slug": "about-us",
  "page_title": "About Us",
  "content_data": "{\"heading\":\"About Us\",\"story\":\"Founded in 2020...\",\"mission\":\"To empower...\",\"team\":\"A dedicated team...\"}",
  "generated_html": "<!DOCTYPE html><html>...about page HTML...</html>",
  "sort_order": 1,
  "is_published": true,
  "created_at": "2026-03-10T10:00:00.000Z",
  "updated_at": "2026-03-10T10:15:00.000Z"
}
```

### `site_deployments` Row

```json
{
  "id": "deploy-uuid-here",
  "site_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "success",
  "files_uploaded": 2,
  "total_files": 2,
  "error_message": null,
  "deployment_duration_ms": 3421,
  "deployed_at": "2026-03-08T14:30:00.000Z"
}
```

### `site_form_submissions` Row ★ NEW v3.1

```json
{
  "id": "sub-uuid-here",
  "site_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "form_data": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "message": "I'd like to discuss a project."
  },
  "submitted_at": "2026-03-15T10:30:00.000Z",
  "ip_address": "41.13.245.10",
  "is_read": 0,
  "notification_sent": 1
}
```

---

## 5. Related Tables (External)

These tables are not part of the Site Builder module but are referenced by it:

| Table | Usage |
|-------|-------|
| `users` | `user_id` FK, role check for admin endpoints |
| `widget_clients` | `widget_client_id` FK, assistant embedding in generated sites |
| `user_contact_link` | Links users to contacts for subscription lookup |
| `contact_packages` | Active/trial subscriptions — used by `resolveUserTier()` |
| `packages` | Package definitions with `max_landing_pages`, `price_monthly` — used by `resolveUserTier()` |
