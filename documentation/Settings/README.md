# Settings Module

**Version:** 1.0.0  
**Last Updated:** 2026-03-12  
**Status:** ✅ Active — Platform configuration & branding

---

## Overview

The Settings module manages two distinct configuration stores and an admin configuration inspector:

1. **App Settings** (`app_settings` table) — Tenant branding, SMTP, and feature configuration. Key-value pairs with category prefixes (e.g. `smtp_*`, `site_*`). Consumed by the frontend `Settings.tsx` page and the public branding endpoint.
2. **System Settings** (`sys_settings` table) — Admin-only typed key-value store with visibility controls (`is_public`). Managed via the `SystemSettings.tsx` admin page with full CRUD, SMTP configuration, and webmail domain settings.
3. **Admin Config** — Read-only inspector showing payment gateway status, AI provider status, and system configuration. Data sourced from environment variables, not the database.

---

## Source Files

### Backend

| File | LOC | Purpose |
|------|-----|---------|
| [routes/settings.ts](/var/opt/backend/src/routes/settings.ts) | 256 | CRUD for `sys_settings` table — typed key-value pairs with public/private visibility |
| [routes/appSettings.ts](/var/opt/backend/src/routes/appSettings.ts) | 135 | Key-value settings for branding, SMTP, features — public branding endpoint |
| [routes/adminConfig.ts](/var/opt/backend/src/routes/adminConfig.ts) | 324 | Read-only config inspector — payment gateways, AI providers, system status |

### Frontend

| File | LOC | Purpose |
|------|-----|---------|
| [pages/general/Settings.tsx](/var/opt/frontend/src/pages/general/Settings.tsx) | 624 | App settings page — branding (logo, icon, site name), SMTP, base URL configuration |
| [pages/system/SystemSettings.tsx](/var/opt/frontend/src/pages/system/SystemSettings.tsx) | 982 | Admin system settings — CRUD table, SMTP config tab, webmail domain settings tab |
| [models/AppSettingsModel.ts](/var/opt/frontend/src/models/AppSettingsModel.ts) | 80 | TypeScript types and API methods for app settings |

**Total LOC:** ~2,401

---

## Database Tables

### `app_settings`

| Column | Type | Description |
|--------|------|-------------|
| `setting_key` | VARCHAR (PK) | Dot/underscore-namespaced key (e.g. `site_logo`, `smtp_host`) |
| `setting_value` | TEXT | String value |
| `data_type` | VARCHAR | Optional type hint (`string`, `integer`, `boolean`, `json`) |
| `description` | VARCHAR | Optional human-readable description |

### `sys_settings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment ID |
| `key` | VARCHAR(100) | Unique setting key |
| `value` | TEXT | String value |
| `type` | ENUM | `string`, `integer`, `float`, `boolean`, `json` |
| `description` | VARCHAR(255) | Human-readable description |
| `is_public` | BOOLEAN | Whether setting is exposed via `/settings/public` without auth |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

---

## API Routes

### App Settings (`/app-settings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/app-settings/branding` | Public | Returns branding keys only (logo, icon, site name, title, description) |
| GET | `/app-settings` | Auth | All settings as key-value object. Optional `?category=smtp_` prefix filter |
| GET | `/app-settings/:key` | Auth | Single setting by key |
| PUT | `/app-settings` | Admin | Bulk upsert settings (object body) |
| PUT | `/app-settings/:key` | Admin | Update single setting |

### System Settings (`/settings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings/public` | Public | Public settings as typed key-value map |
| GET | `/settings/key/:key` | Auth | Lookup by key |
| GET | `/settings` | Auth | List all settings. Optional `?public_only=1` filter |
| GET | `/settings/:id` | Auth | Get by ID |
| POST | `/settings` | Admin | Create new setting (key uniqueness enforced) |
| PUT | `/settings/:id` | Admin | Update setting (duplicate key check on rename) |
| DELETE | `/settings/:id` | Admin | Delete setting |

### Admin Config (`/admin/config`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/config/payment-gateways` | Admin | Payment gateway status (PayFast, Yoco, Manual) |
| POST | `/admin/config/payment-gateways/test` | Admin | Test gateway connection |
| GET | `/admin/config/ai-providers` | Admin | AI provider status (GLM, Ollama) with model lists |
| POST | `/admin/config/ai-providers/test` | Admin | Test AI provider connection |
| GET | `/admin/config/system` | Admin | System config summary (env, SMTP, ports, flags) |

---

## Key Patterns

- **Dual settings stores**: `app_settings` is the primary branding/feature store consumed by the frontend Settings page. `sys_settings` is the admin-level typed store with public/private visibility.
- **Public branding endpoint**: `/app-settings/branding` is unauthenticated — used by the landing page, login page, and public registration to display the company logo and site name.
- **Type casting**: `sys_settings` supports typed values (`integer`, `float`, `boolean`, `json`) that are cast on read via the `castValue()` helper.
- **Admin config is read-only**: The `/admin/config/*` routes inspect environment variables and test external service connections — they do not write to any database.
- **Category prefixes**: App settings use underscore-prefixed keys for grouping: `site_*` (branding), `smtp_*` (email), `modules_*` (feature toggles).
- **SMTP configuration**: The SystemSettings page has a dedicated SMTP tab that reads/writes SMTP config and supports sending a test email.
- **Webmail domain settings**: The SystemSettings page includes a webmail tab for configuring default IMAP/SMTP host, port, and TLS settings per domain.
- **Audit logging**: The `/settings` routes are mounted with the `auditLogger` middleware — all changes to system settings are recorded in the admin audit log.
