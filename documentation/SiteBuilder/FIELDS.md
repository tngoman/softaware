# Site Builder Module — Fields & Schema Reference

**Version:** 2.1.0  
**Last Updated:** 2026-03-08

---

## 1. Database Tables

### 1.1 `generated_sites` — Main Site Record

Stores all information for client-generated websites, including business data, design settings, and encrypted FTP credentials for deployment.

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
| `generated_html` | LONGTEXT | YES | NULL | **NEW v2.0** — AI-generated full HTML stored directly in DB |
| `generation_error` | VARCHAR(2000) | YES | NULL | **NEW v2.0** — Human-readable error message if generation failed |
| `status` | ENUM('draft','generating','generated','deployed','failed') | YES | 'draft' | Current site lifecycle status (**'generating' added in v2.0**) |
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
| deployed | generating | Re-generation after changes |
| deployed | failed | Re-deployment fails |
| failed | generating | Retry generation |

---

### 1.2 `site_deployments` — Deployment History

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
  generated_html: string | null;     // NEW v2.0 — full AI-generated HTML
  generation_error: string | null;   // NEW v2.0 — error message if generation failed
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';  // 'generating' added v2.0
  last_deployed_at: Date | null;
  deployment_error: string | null;
  theme_color: string;
  created_at: Date;
  updated_at: Date;
}
```

### 2.2 `SiteData` — Create/Update Payload (camelCase)

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
  "status": "deployed",
  "last_deployed_at": "2026-03-07T14:30:00.000Z",
  "deployment_error": null,
  "theme_color": "#0044cc",
  "created_at": "2026-03-07T10:00:00.000Z",
  "updated_at": "2026-03-07T14:30:00.000Z"
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
