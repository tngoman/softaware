# Pro Package & Enterprise Ecosystem — API Route Reference

**Version:** 1.1.0  
**Last Updated:** 2026-03-28  
**Base URL:** `https://api.softaware.net.za`

> All admin routes (`/api/admin/*`) require `requireAuth` + `requireAdmin` middleware.  
> All routes pass through `auditLogger` for admin-level audit trails.

---

## Table of Contents

| Section | Base Path | Routes |
|---------|-----------|--------|
| [1. Package Management](#1-package-management) | `/api/admin/packages` | 5 |
| [2. Enterprise Endpoints](#2-enterprise-endpoints) | `/api/admin/enterprise-endpoints` | 9 |
| [3. Client API Gateway (Admin)](#3-client-api-gateway) | `/api/admin/client-api-configs` | 12 |
| [4. Client API Gateway (Client-Facing)](#4-client-api-gateway-client-facing) | `/api/v1/client-api` | 3 |
| [5. Billing / Trials](#5-billing--trials) | `/api/billing` | 2 |
| [6. Assistant Ingest](#6-assistant-ingest) | `/api/assistants/:assistantId/ingest` | 4 |
| [7. Widget Ingest](#7-widget-ingest) | `/api/v1/ingest` | 5 |

**Total: 40 endpoints**

---

## 1. Package Management

**File:** `src/routes/adminPackages.ts` (339 LOC)  
**Mount:** `apiRouter.use('/admin/packages', auditLogger, adminPackagesRouter)`  
**Auth:** `requireAuth` → `requireAdmin`

### `GET /admin/packages`

List all packages with assignment counts.

**Response:**
```json
{
  "success": true,
  "packages": [
    {
      "id": 8,
      "slug": "pro",
      "name": "Pro",
      "tier": "pro",
      "limits": { "maxSites": 10, "maxWidgets": 10, "..." : "..." },
      "raw": { "/* full row */" },
      "assignmentCount": 3
    }
  ]
}
```

---

### `GET /admin/packages/contacts`

List all active contacts with their current package assignment and linked users.

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "contact_id": 68,
      "contact_name": "SA Water Works",
      "contact_person": "John Doe",
      "contact_email": "john@example.com",
      "contact_phone": "+27...",
      "contact_type": "Company",
      "contact_package_id": 15,
      "package_status": "ACTIVE",
      "billing_cycle": "MONTHLY",
      "current_period_start": "2026-03-01",
      "current_period_end": "2026-03-31",
      "package_id": 10,
      "package_slug": "enterprise",
      "package_name": "Enterprise",
      "linked_user_emails": "user1@example.com, user2@example.com",
      "linked_user_count": 2
    }
  ]
}
```

---

### `POST /admin/packages`

Create a new package in the catalog.

**Request Body** (Zod-validated):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `slug` | string 2–50 | ✅ | Unique identifier (e.g. `pro`) |
| `name` | string 2–100 | ✅ | Display name (e.g. `Pro`) |
| `description` | string ≤500 | | Nullable |
| `package_type` | enum | ✅ | `CONSUMER`, `ENTERPRISE`, `STAFF`, `ADDON` |
| `price_monthly` | int ≥0 | ✅ | Cents |
| `price_annually` | int ≥0 | | Nullable |
| `max_users` | int ≥0 | | |
| `max_agents` | int ≥0 | | |
| `max_widgets` | int ≥0 | | |
| `max_landing_pages` | int ≥0 | | |
| `max_enterprise_endpoints` | int ≥0 | | |
| `max_sites` | int ≥0 | | |
| `max_collections_per_site` | int ≥0 | | |
| `max_storage_bytes` | int ≥0 | | |
| `max_actions_per_month` | int ≥0 | | |
| `max_knowledge_pages` | int ≥0 | | |
| `allowed_site_type` | enum | | `single_page`, `classic_cms`, `ecommerce`, `web_application`, `headless` |
| `can_remove_watermark` | boolean | | Default: `false` |
| `allowed_system_actions` | string[] | | Default: `[]` |
| `has_custom_knowledge_categories` | boolean | | Default: `false` |
| `has_omni_channel_endpoints` | boolean | | Default: `false` |
| `ingestion_priority` | int 1–10 | | Default: `1` |
| `features` | string[] | | JSON array of feature labels |
| `is_active` | boolean | | Default: `true` |
| `is_public` | boolean | | Default: `true` |
| `display_order` | int ≥0 | | Default: `0` |
| `featured` | boolean | | Default: `false` |
| `cta_text` | string 1–50 | | Default: `"Get Started"` |
| `gateway_plan_id` | string ≤100 | | For payment gateway integration |
| `allow_auto_recharge` | boolean | | Default: `false` |

**Response:** `201`
```json
{
  "success": true,
  "package": { "/* formatted package */" }
}
```

---

### `PUT /admin/packages/:id`

Update an existing package. Same body schema as POST.

After update, **all contacts assigned to this package** have their linked users synced:
- `syncUsersForContactPackage()` updates `users.plan_type` and `users.storage_limit_bytes`

**Response:** `200`
```json
{
  "success": true,
  "package": { "/* formatted package */" }
}
```

---

### `POST /admin/packages/:id/assign-contact`

Assign a package to a contact (company). **Transactional** — cancels any other active/trial packages first.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `contactId` | int > 0 | ✅ | MySQL `contacts.id` |
| `billingCycle` | enum | | `MONTHLY` (default), `ANNUALLY`, `NONE` |
| `status` | enum | | `ACTIVE` (default), `TRIAL` |

**Behaviour:**
1. Cancel all other `ACTIVE`/`TRIAL` packages for this contact
2. Upsert the new contact_packages row (INSERT or UPDATE if already exists)
3. `syncUsersForContactPackage(contactId, pkg)` → update all linked users

**Response:** `200`
```json
{
  "success": true,
  "contactId": 68,
  "package": {
    "id": 10,
    "slug": "enterprise",
    "name": "Enterprise",
    "limits": { "maxSites": 999, "..." : "..." }
  }
}
```

---

## 2. Enterprise Endpoints

**File:** `src/routes/adminEnterpriseEndpoints.ts` (237 LOC)  
**Mount:** `apiRouter.use('/admin/enterprise-endpoints', auditLogger, adminEnterpriseEndpointsRouter)`  
**Auth:** `requireAuth` → `requireAdmin`  
**Storage:** SQLite (`enterprise_endpoints.db`)

### `GET /admin/enterprise-endpoints`

List all enterprise endpoints.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "client_id": "silulumanzi",
      "client_name": "SA Water Works",
      "contact_id": 68,
      "inbound_provider": "whatsapp",
      "llm_provider": "ollama",
      "llm_model": "llama3.1:8b",
      "status": "active",
      "created_at": "2026-03-01T...",
      "/* ... */" : ""
    }
  ]
}
```

---

### `GET /admin/enterprise-endpoints/:id`

Get a single endpoint by UUID with full configuration.

**Response:** `200` or `404`

---

### `POST /admin/enterprise-endpoints` ⚡ **ENFORCED**

Create a new enterprise endpoint.

**Middleware:** `enforceEndpointLimit` — checks `max_enterprise_endpoints` for the contact's package.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `client_id` | string 1–100 | ✅ | Unique client slug |
| `client_name` | string 1–255 | ✅ | Display name |
| `contact_id` | int | | MySQL contacts.id for package resolution |
| `inbound_provider` | enum | ✅ | `whatsapp`, `slack`, `custom_rest`, `sms`, `email`, `web` |
| `llm_provider` | enum | ✅ | `ollama`, `openrouter`, `openai` |
| `llm_model` | string | ✅ | Model identifier |
| `llm_system_prompt` | string | ✅ | System prompt |
| `llm_tools_config` | string | | JSON tools definition |
| `llm_temperature` | number 0–2 | | |
| `llm_max_tokens` | int 1–16384 | | |
| `target_api_url` | url | | External API endpoint |
| `target_api_auth_type` | enum | | `bearer`, `basic`, `custom`, `none` |
| `target_api_auth_value` | string | | Auth credential |
| `target_api_headers` | string | | JSON extra headers |

**Enforcement Deny Response** (`403`):
```json
{
  "success": false,
  "error": "TIER_LIMIT_REACHED",
  "message": "This contact has reached the enterprise endpoint limit for the Pro package (2/2). Upgrade to create more.",
  "current": 2,
  "limit": 2,
  "package": "pro"
}
```

---

### `PUT /admin/enterprise-endpoints/:id`

Update an endpoint. Partial update — all fields optional. Also accepts `status` and `allowed_ips`.

---

### `PATCH /admin/enterprise-endpoints/:id/status`

**Kill switch.** Quick status toggle.

**Request Body:**
```json
{ "status": "active" | "paused" | "disabled" }
```

---

### `PATCH /admin/enterprise-endpoints/:id/config`

Update IP restrictions for an endpoint.

**Request Body:**
```json
{ "allowed_ips": "[\"192.168.1.1\", \"10.0.0.0/8\"]" }
```

Validates IP format (IPv4, IPv6, CIDR). Must be a JSON array string.

---

### `DELETE /admin/enterprise-endpoints/:id`

Delete an endpoint and all its associated data.

---

### `GET /admin/enterprise-endpoints/:id/logs`

Get request logs for an endpoint.

**Query Params:** `limit` (default 50), `offset` (default 0)

**Response:**
```json
{
  "success": true,
  "data": [ { "/* log entries */" } ],
  "pagination": { "limit": 50, "offset": 0 }
}
```

---

### `GET /admin/enterprise-endpoints/:id/stats`

Get aggregate statistics for an endpoint over a time period.

**Query Params:** `days` (default 30)

---

## 3. Client API Gateway

**File:** `src/routes/adminClientApiConfigs.ts` (932 LOC)  
**Mount:** `apiRouter.use('/admin/client-api-configs', auditLogger, adminClientApiConfigsRouter)`  
**Auth:** `requireAuth` → `requireAdmin`  
**Storage:** SQLite (`enterprise_endpoints.db → client_api_configs`)

### `GET /admin/client-api-configs`

List all client API gateway configurations.

---

### `GET /admin/client-api-configs/:id`

Get a single config by UUID or `client_id`. Tries UUID first, falls back to `client_id`.

---

### `POST /admin/client-api-configs` ⚡ **ENFORCED**

Create a new client API gateway configuration.

**Middleware:** `enforceGatewayLimit` — checks `max_enterprise_endpoints` for the contact's package (gateways share the same limit pool as enterprise endpoints).

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `client_id` | string | ✅ | Alphanumeric + hyphens/underscores. Must be unique. |
| `client_name` | string | ✅ | Display name |
| `contact_id` | int | | MySQL contacts.id |
| `endpoint_id` | string | | Link to enterprise endpoint UUID |
| `target_base_url` | url | ✅ | Client's API base URL |
| `auth_type` | enum | | `rolling_token`, `bearer`, `basic`, `api_key`, `none` |
| `auth_secret` | string | | Shared secret for rolling_token or credential |
| `auth_header` | string | | Custom header name |
| `allowed_actions` | string[] | | Whitelist of action names |
| `rate_limit_rpm` | int > 0 | | Requests per minute |
| `timeout_ms` | int > 0 | | Request timeout in milliseconds |

**409 on duplicate `client_id`.**

---

### `PUT /admin/client-api-configs/:id`

Update an existing config. All fields optional except `client_id` (immutable).

---

### `PATCH /admin/client-api-configs/:id/status`

**Kill switch.** Quick status toggle.

**Request Body:**
```json
{ "status": "active" | "paused" | "disabled" }
```

---

### `DELETE /admin/client-api-configs/:id`

Delete a client API gateway configuration.

---

### `GET /admin/client-api-configs/:id/logs`

Get request logs. **Query Params:** `limit` (default 50, max 200), `offset` (default 0)

---

### `POST /admin/client-api-configs/:id/sync-tools`

Sync tool definitions to the linked enterprise endpoint's `llm_tools_config`.

**Request Body:**
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "getCustomerInfo",
        "description": "Look up customer details by account number",
        "parameters": { "type": "object", "properties": { "account_number": { "type": "string" } } }
      }
    }
  ]
}
```

**Errors:**
- `400 NO_LINKED_ENDPOINT` — Config has no `endpoint_id`
- `404 ENDPOINT_NOT_FOUND` — Linked endpoint doesn't exist in SQLite

---

### `GET /admin/client-api-configs/export-template`

Download a generic v2.0.0 integration specification JSON. Self-documenting — tells a client's developer exactly how to build their API for the Soft Aware gateway.

**Response:** `200`
```json
{
  "_meta": {
    "type": "softaware_gateway_integration_spec",
    "version": "2.0.0",
    "generated_at": "2026-03-28T...",
    "purpose": "This specification defines how the Soft Aware AI platform will call YOUR API..."
  },
  "request_format": { "method": "POST", "url_pattern": "{your_base_url}/{action_name}", "..." : "..." },
  "authentication": { "supported_methods": ["rolling_token", "bearer", "basic", "api_key", "none"], "..." : "..." },
  "tool_definitions": { "format": "openai_function_calling", "..." : "..." },
  "usage_stats": {
    "endpoint": "GET /api/v1/client-api/{client_id}/usage",
    "authentication": "X-Client-Secret header with shared secret or rolling token",
    "..." : "..."
  }
}
```

---

### `GET /admin/client-api-configs/:id/export`

Export a per-gateway integration specification with pre-filled values (base URL, auth type, registered tools, usage stats URL).

**Response:** `200` — Same v2.0.0 format as export-template, but populated with the specific gateway's configuration.

---

### `POST /admin/client-api-configs/import` ⚡ **ENFORCED**

Import a gateway configuration from an integration spec JSON. Multi-step UI flow: upload spec → select tools → review → create.

**Middleware:** `enforceGatewayLimit` — checks `max_enterprise_endpoints` for the contact's package.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `client_id` | string | ✅ | Alphanumeric + hyphens/underscores |
| `client_name` | string | ✅ | Display name |
| `contact_id` | int | | MySQL contacts.id |
| `endpoint_id` | string | | Link to enterprise endpoint |
| `target_base_url` | url | ✅ | Client's API base URL |
| `auth_type` | enum | | Auth method |
| `auth_secret` | string | | Shared secret |
| `allowed_actions` | string[] | | Selected tools from the import picker |
| `rate_limit_rpm` | int | | Requests per minute |
| `timeout_ms` | int | | Request timeout |

**Response:** `201`
```json
{
  "success": true,
  "config": { "/* created config */" }
}
```

---

### `GET /admin/client-api-configs/endpoint-tools/:endpointId`

Get the tool catalog from a linked enterprise endpoint's `llm_tools_config`.

**Response:** `200`
```json
{
  "success": true,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "getCustomerInfo",
        "description": "Look up customer details",
        "parameters": { "type": "object", "properties": { "..." : "..." } }
      }
    }
  ]
}
```

**Errors:**
- `404` — Endpoint not found

---

## 4. Client API Gateway (Client-Facing)

**File:** `src/routes/clientApiGateway.ts` (258 LOC)  
**Mount:** `apiRouter.use('/v1/client-api', clientApiGatewayRouter)`  
**Auth:** None (tool proxy is internal); Shared secret (usage stats)  
**Storage:** SQLite (`enterprise_endpoints.db → client_api_configs + client_api_logs`)

### `POST /v1/client-api/:clientId/:action`

Forward a tool-call request to the client's target API. Called by the AI tool-calling loop (same server / internal).

**URL Params:**
- `clientId` — matches `client_api_configs.client_id` (e.g., `silulumanzi`)
- `action` — the tool/action name (e.g., `getCustomerContext`)

**Body:** JSON payload to forward (tool arguments from the AI)

**Validation:** Action must be in `allowed_actions` whitelist (if set). Returns `400 UNKNOWN_TOOL` for unregistered tools.

**Response:** Verbatim forwarded response from the target API.

**Error Codes:**
- `404 CLIENT_NOT_FOUND` — No config for this clientId
- `403 CLIENT_API_DISABLED` — Gateway is disabled
- `503 CLIENT_API_PAUSED` — Gateway is temporarily paused
- `400 UNKNOWN_TOOL` — Action not in allowed_actions whitelist
- `504 GATEWAY_TIMEOUT` — Target API didn't respond in time
- `502 BAD_GATEWAY` — Cannot reach target API

---

### `GET /v1/client-api/:clientId/usage` 🔐 **SECRET AUTH**

Client-facing usage statistics endpoint. Authenticated via shared secret.

**Auth:** `X-Client-Secret` header (or `Authorization: Bearer <secret>` or `?secret=` query param)

Accepts:
- Raw shared secret (exact match)
- Today's rolling token: `SHA256(secret + YYYY-MM-DD)`
- Yesterday's rolling token (grace period)

**Query Params:**

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `days` | int | 30 | 90 | Days to look back |
| `recent` | int | 25 | 100 | Max recent requests |

**Response:** `200`
```json
{
  "success": true,
  "client_id": "silulumanzi",
  "client_name": "SA Water Works",
  "status": "active",
  "total_requests": 1547,
  "last_request_at": "2026-03-28T14:30:00.000Z",
  "period": { "from": "2026-02-26", "to": "2026-03-28" },
  "period_total": 342,
  "period_success": 328,
  "period_errors": 14,
  "avg_response_ms": 245,
  "daily_breakdown": [ { "date": "...", "requests": 15, "success": 14, "errors": 1, "avg_ms": 230 } ],
  "action_breakdown": [ { "action": "getCustomerInfo", "requests": 200, "..." : "..." } ],
  "recent_requests": [ { "action": "getCustomerInfo", "status_code": 200, "duration_ms": 150, "..." : "..." } ]
}
```

**Errors:**
- `401 UNAUTHORIZED` — Invalid or missing client secret
- `404 CLIENT_NOT_FOUND` — No config for this clientId

---

### `GET /v1/client-api/:clientId/health`

Quick health check — verifies the config exists and returns status. No auth required. Does NOT call the target API.

**Response:** `200`
```json
{
  "status": "active",
  "clientId": "silulumanzi",
  "clientName": "SA Water Works",
  "targetUrl": "https://api.silulumanzi.co.za",
  "authType": "rolling_token",
  "totalRequests": 1547,
  "lastRequestAt": "2026-03-28T14:30:00.000Z"
}
```

---

## 5. Billing / Trials

**File:** `src/routes/billing.ts` (128 LOC)  
**Mount:** `apiRouter.use('/billing', billingRouter)`  
**Auth:** `requireAuth` (user-level, not admin)

### `POST /billing/start-trial`

Activate a 14-day Starter trial for the current user. **One-time only.**

**Eligibility:**
- `has_used_trial = FALSE`
- `plan_type = 'free'`
- Not already on a paid tier

**Effect:**
- Sets `plan_type = 'starter'`, `has_used_trial = TRUE`, `trial_expires_at = NOW() + 14 days`

**Response:** `200`
```json
{
  "success": true,
  "message": "Your 14-day Starter trial is now active!",
  "trial": {
    "tier": "starter",
    "tierName": "Starter",
    "expiresAt": "2026-04-05T00:00:00.000Z",
    "daysRemaining": 14,
    "limits": {
      "maxSites": 3,
      "maxWidgets": 3,
      "maxActionsPerMonth": 2000,
      "maxKnowledgePages": 200,
      "allowedSiteType": "classic_cms"
    }
  }
}
```

**Errors:**
- `403` — Already used trial
- `400` — Already on paid plan

---

### `GET /billing/trial-status`

Get current trial status for the authenticated user.

**Response:**
```json
{
  "success": true,
  "trial": {
    "hasUsedTrial": true,
    "isOnTrial": false,
    "tier": "free",
    "expiresAt": null,
    "daysRemaining": 0,
    "canStartTrial": false
  }
}
```

---

## 6. Assistant Ingest

**File:** `src/routes/assistantIngest.ts` (281 LOC)  
**Mount:** `apiRouter.use('/assistants/:assistantId/ingest', requireActivePackageAccess, checkAssistantStatus, assistantIngestRouter)`  
**Auth:** `requireAuth` → `requireActivePackageAccess` → `checkAssistantStatus`

### `POST /assistants/:assistantId/ingest/url` ⚡ **ENFORCED**

Submit a URL for knowledge ingestion.

**Middleware:** `enforceKnowledgePageLimit` — checks `max_knowledge_pages` for the contact's package.

---

### `POST /assistants/:assistantId/ingest/file` ⚡ **ENFORCED**

Upload a file for knowledge ingestion (multipart/form-data).

**Middleware:** `enforceKnowledgePageLimit` (before `multer.single('file')`)

---

### `GET /assistants/:assistantId/ingest/status`

Get ingestion job status for the assistant.

---

### `DELETE /assistants/:assistantId/ingest/job/:jobId`

Cancel or delete an ingestion job.

---

## 7. Widget Ingest

**File:** `src/routes/widgetIngest.ts` (244 LOC)  
**Mount:** `apiRouter.use('/v1/ingest', checkWidgetStatus, widgetIngestRouter)`  
**Auth:** Widget-level (API key / client verification, no user auth)

### `POST /v1/ingest/url`

Submit a URL for widget knowledge base ingestion. Has an **inline page limit check**:

```typescript
if (client.pages_ingested >= (client.max_pages || 50)) {
  return res.status(429).json({ error: 'Page limit reached', limit: client.max_pages || 50 });
}
```

---

### `POST /v1/ingest/file`

Upload a file for widget knowledge base (multipart/form-data). Same inline page limit check.

---

### `GET /v1/ingest/sources/:clientId`

List all ingested knowledge sources for a widget client.

---

### `DELETE /v1/ingest/source`

Delete a specific knowledge source.

---

### `DELETE /v1/ingest/all/:clientId`

Delete all knowledge sources for a widget client.

---

## Enforcement Summary

| Route | Middleware | Limit Checked | Error Code |
|-------|-----------|---------------|------------|
| `POST /admin/enterprise-endpoints` | `enforceEndpointLimit` | `max_enterprise_endpoints` | `TIER_LIMIT_REACHED` |
| `POST /admin/client-api-configs` | `enforceGatewayLimit` | `max_enterprise_endpoints` (shared) | `TIER_LIMIT_REACHED` |
| `POST /admin/client-api-configs/import` | `enforceGatewayLimit` | `max_enterprise_endpoints` (shared) | `TIER_LIMIT_REACHED` |
| `POST /assistants/:id/ingest/url` | `enforceKnowledgePageLimit` | `max_knowledge_pages` | `KNOWLEDGE_LIMIT_REACHED` |
| `POST /assistants/:id/ingest/file` | `enforceKnowledgePageLimit` | `max_knowledge_pages` | `KNOWLEDGE_LIMIT_REACHED` |
| `POST /v1/ingest/url` | inline check | `client.max_pages` | `429 Page limit reached` |
| `POST /v1/ingest/file` | inline check | `client.max_pages` | `429 Page limit reached` |
| Chat image upload | `checkVisionAccess` (inline) | `hasVision` | `VISION_NOT_AVAILABLE` |
| Mobile AI image processing | `checkVisionAccess` (inline) | `hasVision` | `VISION_NOT_AVAILABLE` |
| Enterprise webhook files | `checkVisionAccess` (inline) | `hasVision` | `VISION_NOT_AVAILABLE` |
| `POST /v1/client-api/:clientId/:action` | `allowed_actions` whitelist | Tool registration | `UNKNOWN_TOOL` |

> ⚡ **Enterprise** and **Staff** package types **bypass all enforcement** — guards call `next()` immediately.

---

## Common Error Shapes

### Enforcement Denial (403)
```json
{
  "success": false,
  "error": "TIER_LIMIT_REACHED",
  "message": "This contact has reached the enterprise endpoint limit for the Pro package (2/2). Upgrade to create more.",
  "current": 2,
  "limit": 2,
  "package": "pro"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "path": ["client_id"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Endpoint not found"
}
```
