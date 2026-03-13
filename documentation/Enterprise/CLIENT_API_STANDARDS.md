# Client API Gateway — Standards & Architecture

**Version:** 1.0.0  
**Date:** 2026-03-12  
**Status:** ✅ Active

---

## 1. Problem Statement

The legacy approach to connecting enterprise AI endpoints with client APIs was ad hoc:

- **Silulumanzi** had `AiClient.php` — a PHP proxy file placed at `https://softaware.net.za/AiClient.php`
- The PHP file forwarded requests to `portal.silulumanzi.com/api/ai/` with rolling token auth
- Future clients would have needed their own proxy files (Python, PHP, Node) at random URLs
- No central management, logging, or kill switches for the proxy layer
- Mixed languages and deployment patterns across clients

This is unsustainable. Every new client would require:
1. Writing a proxy in whatever language
2. Finding a web-accessible location to host it
3. Configuring Apache/nginx to serve it
4. Manual auth token management
5. No visibility into proxy health or request logs

---

## 2. Solution: Standardized Client API Gateway

All client API proxies now flow through a single TypeScript gateway:

```
POST https://api.softaware.net.za/api/v1/client-api/:clientId/:action
```

### Architecture

```
┌───────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Enterprise        │     │  Client API Gateway   │     │  Client's Real API  │
│  Webhook Handler   │────▶│  /v1/client-api/      │────▶│  e.g., portal.      │
│  (tool call)       │     │  :clientId/:action     │     │  silulumanzi.com    │
└───────────────────┘     └──────────────────────┘     └─────────────────────┘
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  SQLite Config    │
                           │  client_api_      │
                           │  configs table    │
                           └──────────────────┘
```

### Flow

1. AI tool call triggers `forwardAction()` in the enterprise webhook handler
2. The `target_api_url` on the endpoint now points to `https://api.softaware.net.za/api/v1/client-api/:clientId`
3. The webhook appends the tool name as a path segment: `.../silulumanzi/getCustomerContext`
4. The gateway looks up the client config in SQLite
5. Validates the action against the allowed list
6. Builds auth headers (rolling token, bearer, API key, etc.)
7. Forwards the request to the real target API
8. Logs the request and returns the response

---

## 3. URL Convention

### Standard Pattern

```
POST /api/v1/client-api/{client_id}/{action}
```

| Segment | Description | Example |
|---------|-------------|---------|
| `client_id` | Lowercase alphanumeric slug for the client | `silulumanzi` |
| `action` | The tool/action name | `getCustomerContext` |

### Health Check

```
GET /api/v1/client-api/{client_id}/health
```

Returns config status, total requests, and last activity timestamp.

### Examples

```bash
# Silulumanzi — Get customer context
POST /api/v1/client-api/silulumanzi/getCustomerContext
Content-Type: application/json
{"phone_number": "0831234567"}

# Silulumanzi — Report a fault
POST /api/v1/client-api/silulumanzi/reportFault
Content-Type: application/json
{"description": "No water", "faultType": "no_water", "address": "123 Main St"}

# Future client — Example
POST /api/v1/client-api/acme-corp/getOrderStatus
Content-Type: application/json
{"order_id": "ORD-12345"}
```

---

## 4. Client API Configuration

Each client has a configuration record in the `client_api_configs` table:

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | Auto-generated: `capi_{client_id}_{hex}` |
| `client_id` | TEXT | Unique slug (e.g., `silulumanzi`) |
| `client_name` | TEXT | Display name |
| `endpoint_id` | TEXT | Linked enterprise endpoint ID |
| `status` | TEXT | `active` / `paused` / `disabled` |
| `target_base_url` | TEXT | The real API URL (e.g., `https://portal.silulumanzi.com/api/ai`) |
| `auth_type` | TEXT | `rolling_token` / `bearer` / `basic` / `api_key` / `none` |
| `auth_secret` | TEXT | Shared secret or token |
| `auth_header` | TEXT | Header name for the auth token (default: `X-AI-Auth-Token`) |
| `allowed_actions` | TEXT | JSON array of allowed action names (null = allow all) |
| `rate_limit_rpm` | INT | Requests per minute limit |
| `timeout_ms` | INT | Request timeout in milliseconds |

### Authentication Types

| Type | Header | Value |
|------|--------|-------|
| `rolling_token` | Custom (default `X-AI-Auth-Token`) | `SHA256(secret + YYYY-MM-DD)` — rotates daily |
| `bearer` | `Authorization` | `Bearer {secret}` |
| `basic` | `Authorization` | `Basic {secret}` |
| `api_key` | Custom (default `X-API-Key`) | Raw secret value |
| `none` | — | No authentication |

---

## 5. Admin API

All admin routes require authentication and admin role.

### List All Configs
```
GET /api/admin/client-api-configs
```

### Get Single Config
```
GET /api/admin/client-api-configs/:id
```

### Create Config
```
POST /api/admin/client-api-configs
Content-Type: application/json
{
  "client_id": "silulumanzi",
  "client_name": "Silulumanzi Water Services",
  "endpoint_id": "ep_silulumanzi_91374147",
  "target_base_url": "https://portal.silulumanzi.com/api/ai",
  "auth_type": "rolling_token",
  "auth_secret": "SHARED_SECRET_HERE",
  "auth_header": "X-AI-Auth-Token",
  "allowed_actions": ["getCustomerContext", "reportFault", ...],
  "timeout_ms": 30000
}
```

### Update Config
```
PUT /api/admin/client-api-configs/:id
```

### Update Status
```
PATCH /api/admin/client-api-configs/:id/status
{"status": "active" | "paused" | "disabled"}
```

### Delete Config
```
DELETE /api/admin/client-api-configs/:id
```

### View Request Logs
```
GET /api/admin/client-api-configs/:id/logs?limit=50&offset=0
```

---

## 6. Adding a New Client

To onboard a new enterprise client API:

### Step 1: Create the Client API Config

```bash
curl -X POST https://api.softaware.net.za/api/admin/client-api-configs \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "new-client",
    "client_name": "New Client Corp",
    "target_base_url": "https://api.newclient.com/v1",
    "auth_type": "bearer",
    "auth_secret": "their-api-key-here",
    "allowed_actions": ["getAccount", "submitTicket"]
  }'
```

### Step 2: Create the Enterprise Endpoint

Set the `target_api_url` to:
```
https://api.softaware.net.za/api/v1/client-api/new-client
```

### Step 3: Configure LLM Tools

In the enterprise endpoint's `llm_tools_config`, define tools whose function calls will be forwarded through the gateway.

### Step 4: Test

```bash
# Health check
curl https://api.softaware.net.za/api/v1/client-api/new-client/health

# Test a tool call
curl -X POST https://api.softaware.net.za/api/v1/client-api/new-client/getAccount \
  -H "Content-Type: application/json" \
  -d '{"account_id": "12345"}'
```

---

## 7. Kill Switches

The client API gateway has its own kill switch layer:

| Layer | Action | Effect |
|-------|--------|--------|
| **Config status → disabled** | Gateway returns `403 CLIENT_API_DISABLED` | All tool calls for this client fail |
| **Config status → paused** | Gateway returns `503 CLIENT_API_PAUSED` | Temporary pause |
| **Allowed actions** | Remove action from list | Gateway returns `400 INVALID_ACTION` |
| **Enterprise endpoint disabled** | Webhook returns `403` | No tool calls reach the gateway |
| **Package credits exhausted** | Webhook returns `402` | No tool calls reach the gateway |

---

## 8. Files

| File | Purpose |
|------|---------|
| `src/services/clientApiGateway.ts` | SQLite CRUD, auth token generation, request logging |
| `src/routes/clientApiGateway.ts` | Express route: `POST /v1/client-api/:clientId/:action` |
| `src/routes/adminClientApiConfigs.ts` | Admin CRUD routes for managing configs |
| `src/migrations/027_seed_client_api_configs.ts` | Silulumanzi seed + endpoint migration |

### Legacy (Archived)

| File | Status |
|------|--------|
| `client/AiClient.php` | ❌ Archived — replaced by TypeScript gateway |
| `client/AiClient copy.php` | ❌ Archived — was a backup copy |
| `client/AI_Chat_API.md` | ❌ Archived — legacy API documentation |

---

## 9. Migration History

### v1 — PHP Proxy (pre 2026-03-12)
- `AiClient.php` hosted at random URL (`https://softaware.net.za/AiClient.php`)
- PHP cURL proxy to `portal.silulumanzi.com/api/ai/`
- Rolling SHA-256 token auth
- No logging, no admin management, no kill switches

### v2 — TypeScript Gateway (2026-03-12)
- Standardized route: `POST /api/v1/client-api/:clientId/:action`
- Database-driven configuration in SQLite
- Per-client allowed actions, auth type, timeout
- Request logging with `client_api_logs` table
- Admin CRUD API at `/api/admin/client-api-configs`
- Kill switch support (status field)
- Health check endpoint
- Migration 027 seeds Silulumanzi config and updates enterprise endpoint
