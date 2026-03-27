# Soft Aware — Client API Gateway Integration Guide

**For External Developers**  
**Version:** 1.1.0  
**Last Updated:** 2026-03-22

---

## 1. What Is This?

The **Soft Aware AI platform** lets businesses add conversational AI (chat assistants) to their websites and channels. When a user asks a question like _"What's my account balance?"_, the AI needs to fetch real data from **your** system.

The **Client API Gateway** is the bridge. Soft Aware's AI calls **your API** via a secured proxy, gets the answer, and responds to the end user — all in real time.

**You build the API endpoints. We handle the AI, the chat widget, and the proxy.**

```
End User → Chat Widget → Soft Aware AI → Client API Gateway → YOUR API
                                                ↑                    ↓
                                           (auth + proxy)      (real data)
                                                ↓                    ↑
End User ← Chat Widget ← Soft Aware AI ← ← ← ← ← ← ← ← ← ← ← ←
```

---

## 2. Import Template Format

When onboarding, Soft Aware staff may provide you with a JSON template file. The **minimal import template** looks like this:

```json
{
  "_meta": {
    "type": "softaware_client_api_gateway",
    "version": "1.1.0",
    "exported_at": "2026-03-22T15:48:35.785Z",
    "instructions": "Optional connection overrides. If omitted, the system auto-generates a gateway URL and auth credentials. Import via the Client API Gateway admin UI."
  },
  "connection": {
    "target_base_url": "",
    "auth_type": "rolling_token",
    "auth_secret": "",
    "auth_header": "X-AI-Auth-Token"
  }
}
```

### Template Fields

| Field | Required | Description |
|-------|----------|-------------|
| `_meta.type` | ✅ | Must be `"softaware_client_api_gateway"`. Identifies the file format. |
| `_meta.version` | ✅ | Template version. Current: `"1.1.0"`. |
| `_meta.exported_at` | — | ISO timestamp of when the template was generated. Informational only. |
| `_meta.instructions` | — | Human-readable notes. Ignored by the importer. |
| `connection.target_base_url` | ✅ | **Your API's base URL.** Soft Aware sends all tool calls to `{base_url}/{action_name}`. Example: `https://api.yourcompany.com/ai-gateway` |
| `connection.auth_type` | ✅ | Authentication method. One of: `rolling_token`, `bearer`, `basic`, `api_key`, `none`. See [Section 3](#3-authentication). |
| `connection.auth_secret` | ✅ | The shared secret or credential used for authentication. See details per auth type below. |
| `connection.auth_header` | — | Custom header name for the auth token. Default: `X-AI-Auth-Token`. Only relevant for `rolling_token` and `api_key` types. |

### What Happens on Import

1. Soft Aware staff selects your company contact and a linked enterprise endpoint
2. The import wizard reads the template's `connection` overrides
3. A tool-picker screen shows all available tools from the enterprise endpoint
4. Staff selects which tools to enable on your gateway
5. The system creates the gateway config with:
   - `client_id` derived from your company name (e.g., `acme-store`)
   - `allowed_actions` = all selected tools (security whitelist)
   - Auth credentials from the template (or auto-generated if blank)
   - Rate limit: 60 requests/minute (configurable)
   - Timeout: 30 seconds (configurable)

> **If `target_base_url` or `auth_secret` are empty**, the system auto-generates defaults. You can update them later via the Soft Aware Portal.

---

## 3. Authentication

Soft Aware sends an authentication header with **every** request to your API. You **must** validate it on your side to ensure only legitimate Soft Aware requests reach your data.

### 3.1 Rolling Token (Recommended)

A daily-rotating SHA-256 token. Both sides compute the same hash from a shared secret + today's UTC date. The token automatically expires at midnight UTC — no manual key rotation needed.

**Algorithm:**

```
token = SHA256(shared_secret + "YYYY-MM-DD")
```

**Header sent:** `X-AI-Auth-Token: <64-char hex hash>`

**How it works:**

1. You and Soft Aware agree on a `shared_secret` (a long random string, e.g., 64 hex characters)
2. Each day, both sides independently compute: `SHA256(secret + "2026-03-22")`
3. Soft Aware sends the token in the `X-AI-Auth-Token` header (or your custom header)
4. Your API computes the same hash and compares — if they match, the request is authentic

**Validation — PHP:**

```php
$sharedSecret = getenv("SOFTAWARE_SECRET"); // your shared secret
$expectedToken = hash("sha256", $sharedSecret . gmdate("Y-m-d"));
$receivedToken = $_SERVER["HTTP_X_AI_AUTH_TOKEN"] ?? "";

if (!hash_equals($expectedToken, $receivedToken)) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "UNAUTHORIZED"]);
    exit;
}
```

**Validation — Node.js:**

```javascript
const crypto = require("crypto");

const sharedSecret = process.env.SOFTAWARE_SECRET;
const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC
const expected = crypto.createHash("sha256").update(sharedSecret + today).digest("hex");
const received = req.headers["x-ai-auth-token"];

if (expected !== received) {
  return res.status(401).json({ success: false, error: "UNAUTHORIZED" });
}
```

**Validation — Python:**

```python
import hashlib, datetime, os

secret = os.environ["SOFTAWARE_SECRET"]
today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
expected = hashlib.sha256((secret + today).encode()).hexdigest()
received = request.headers.get("X-AI-Auth-Token", "")

if expected != received:
    return jsonify({"success": False, "error": "UNAUTHORIZED"}), 401
```

**Validation — C#:**

```csharp
using System.Security.Cryptography;
using System.Text;

var secret = Environment.GetEnvironmentVariable("SOFTAWARE_SECRET");
var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
var expected = Convert.ToHexString(
    SHA256.HashData(Encoding.UTF8.GetBytes(secret + today))
).ToLower();
var received = Request.Headers["X-AI-Auth-Token"].FirstOrDefault() ?? "";

if (expected != received)
    return Unauthorized(new { success = false, error = "UNAUTHORIZED" });
```

> **Tip:** Accept both today's AND yesterday's token to handle timezone edge cases around midnight UTC.

### 3.2 Bearer Token

A static token sent in the standard `Authorization` header.

```
Authorization: Bearer <your_token>
```

You provide Soft Aware a long-lived API key or token. We send it verbatim on every request. Simple but does not rotate — you must manually revoke and regenerate if compromised.

### 3.3 API Key

A static API key in a custom header.

```
X-API-Key: <your_key>
```

Similar to Bearer but in a custom header. Useful if your API already uses `X-API-Key` authentication. The header name is configurable (defaults to `X-API-Key`).

### 3.4 Basic Auth

HTTP Basic Authentication with Base64-encoded credentials.

```
Authorization: Basic <base64("username:password")>
```

You provide us a Base64-encoded `username:password` string.

### 3.5 None

No authentication headers sent. **Only use this if your API is already secured by IP whitelisting, VPN, or other network-level controls.** Not recommended.

---

## 4. Request Format

For every AI tool call, Soft Aware sends a **POST** request to your API:

```
POST {your_base_url}/{action_name}
Content-Type: application/json
X-AI-Auth-Token: <auth_token>

{
  "param1": "value1",
  "param2": "value2"
}
```

### How It Works

1. A user asks the AI chatbot a question (e.g., _"What's the status of my order?"_)
2. The AI decides which tool to call (e.g., `getOrderStatus`)
3. The AI extracts parameters from the conversation (e.g., `order_id: "ORD-10042"`) 
4. Soft Aware's gateway sends: `POST https://your-api.com/ai-gateway/getOrderStatus`
5. Your API processes the request and returns JSON
6. The AI reads your response and formulates a user-friendly answer

### Example Request

```http
POST https://api.yourcompany.com/ai-gateway/getOrderStatus
Content-Type: application/json
X-AI-Auth-Token: a1b2c3d4e5f6...

{
  "order_id": "ORD-10042"
}
```

### Timeout

Default: **30 seconds**. If your API does not respond in time, the user gets a timeout error. If your operations take longer, consider returning a job ID and having a separate status-check tool.

### Rate Limit

Default: **60 requests per minute** per gateway. This is configurable per client.

---

## 5. Response Format

Your API should return **JSON** on every request. The AI reads the response body to formulate answers for the end user.

### Success Response

```json
{
  "success": true,
  "data": {
    "order_id": "ORD-10042",
    "customer_name": "Jane Doe",
    "email": "jane@example.com",
    "status": "shipped",
    "total": 1250.00,
    "tracking_number": "ZA-9876543210",
    "estimated_delivery": "2026-03-25"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "ORDER_NOT_FOUND",
  "message": "No order found with that ID."
}
```

### Tips

- Always return `Content-Type: application/json`
- Use meaningful HTTP status codes (`200`, `400`, `404`, `500`)
- Include a human-readable `message` field in errors — the AI uses it to explain the problem to the user
- Return as much relevant context as possible — the AI produces better answers with richer data
- Keep responses under 10 KB for optimal performance
- Never return sensitive internal data (database IDs, stack traces, etc.)

---

## 6. Tool Definitions

Each "tool" maps to one endpoint on your API. Tools are configured by Soft Aware staff when setting up your gateway. You just need to build the endpoints.

### Example Tools

Below are generic example tools. Your actual tools will be specific to your business — ecommerce, services, SaaS, etc.

#### `lookupCustomer` — Look up customer details

```
POST {base_url}/lookupCustomer

Body:
  email           string  (required)  — Customer email address
  customer_name   string  (optional)  — Name for fuzzy search

Response:
  {
    "success": true,
    "data": {
      "customer_id": "CUST-0012345",
      "customer_name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "0821234567",
      "account_status": "active",
      "total_orders": 12,
      "created_at": "2025-08-15"
    }
  }
```

#### `getOrderStatus` — Check an order's current status

```
POST {base_url}/getOrderStatus

Body:
  order_id         string  (required)  — Order reference number
  email            string  (optional)  — Customer email for verification

Response:
  {
    "success": true,
    "data": {
      "order_id": "ORD-10042",
      "status": "shipped",
      "items": 3,
      "total": 1250.00,
      "tracking_number": "ZA-9876543210",
      "estimated_delivery": "2026-03-25"
    }
  }
```

#### `createTicket` — Log a support ticket

```
POST {base_url}/createTicket

Body:
  email           string  (required)  — Customer email address
  category        string  (required)  — e.g. "billing", "delivery", "product", "general"
  description     string  (required)  — Detailed issue description from the user
  priority        string  (optional)  — "low", "medium", "high" (default: "medium")

Response:
  {
    "success": true,
    "data": {
      "ticket_id": "TKT-2026-00456",
      "status": "open",
      "message": "Support ticket created. Reference: TKT-2026-00456."
    }
  }
```

#### `updateCustomer` — Update customer details

```
POST {base_url}/updateCustomer

Body:
  email           string  (required)  — Customer email (identifies the record)
  field           string  (required)  — Field name (e.g. "phone", "address", "name")
  value           string  (required)  — New value

Response:
  {
    "success": true,
    "data": {
      "customer_id": "CUST-0012345",
      "field": "phone",
      "old_value": "0821234567",
      "new_value": "0839876543",
      "updated_at": "2026-03-22T10:30:00Z"
    }
  }
```

> **All tools have full action capability** — there is no read-only vs write distinction. You define whatever tools your business needs.

---

## 7. Usage Statistics API

You can query your gateway's usage statistics from your own application using your shared secret. This lets you build a client-side dashboard showing request counts, error rates, and response times.

### Endpoint

```
GET https://api.softaware.net.za/api/v1/client-api/{your_client_id}/usage
```

### Authentication

Send your shared secret (or today's rolling token) in the `X-Client-Secret` header:

```
X-Client-Secret: <your_shared_secret_or_rolling_token>
```

Alternative authentication methods:
- `Authorization: Bearer <secret_or_token>`
- Query parameter: `?secret=<secret_or_token>`

> Yesterday's rolling token is also accepted (grace window for timezone edge cases).

### Query Parameters

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `days` | 30 | 90 | Number of days to look back |
| `recent` | 25 | 100 | Max recent request log entries to return |

### Response

```json
{
  "success": true,
  "client_id": "your-client-id",
  "client_name": "Your Company",
  "status": "active",
  "total_requests": 1547,
  "last_request_at": "2026-03-22T14:30:00.000Z",
  "period": { "from": "2026-02-20", "to": "2026-03-22" },
  "period_total": 342,
  "period_success": 328,
  "period_errors": 14,
  "avg_response_ms": 245,
  "daily_breakdown": [
    { "date": "2026-03-22", "requests": 15, "success": 14, "errors": 1, "avg_ms": 230 }
  ],
  "action_breakdown": [
    { "action": "lookupCustomer", "requests": 200, "success": 195, "errors": 5, "avg_ms": 180, "last_called": "2026-03-22T14:30:00Z" }
  ],
  "recent_requests": [
    { "action": "lookupCustomer", "status_code": 200, "duration_ms": 150, "error_message": null, "created_at": "2026-03-22T14:30:00Z" }
  ]
}
```

### Examples

**cURL:**

```bash
curl -H "X-Client-Secret: YOUR_SECRET" \
  "https://api.softaware.net.za/api/v1/client-api/{your_client_id}/usage?days=7"
```

**PHP:**

```php
$ch = curl_init("https://api.softaware.net.za/api/v1/client-api/{$clientId}/usage?days=30");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Client-Secret: " . $sharedSecret]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);
// $response["period_total"], $response["daily_breakdown"], etc.
```

**Node.js:**

```javascript
const res = await fetch(
  `https://api.softaware.net.za/api/v1/client-api/${clientId}/usage?days=30`,
  { headers: { "X-Client-Secret": sharedSecret } }
);
const stats = await res.json();
// stats.period_total, stats.daily_breakdown, etc.
```

**Python:**

```python
import requests

r = requests.get(
    f"https://api.softaware.net.za/api/v1/client-api/{client_id}/usage?days=30",
    headers={"X-Client-Secret": shared_secret}
)
stats = r.json()
# stats["period_total"], stats["daily_breakdown"], etc.
```

---

## 8. Health Check

A quick health check endpoint that verifies your gateway config exists and is active. No authentication required. Does **not** call your API.

```
GET https://api.softaware.net.za/api/v1/client-api/{your_client_id}/health
```

**Response:**

```json
{
  "status": "active",
  "clientId": "your-client-id",
  "clientName": "Your Company",
  "targetUrl": "https://api.yourcompany.com/ai-gateway",
  "authType": "rolling_token",
  "totalRequests": 1547,
  "lastRequestAt": "2026-03-22T14:30:00.000Z"
}
```

Use this to verify the gateway is configured and running before you go live.

---

## 9. Kill Switch

You can instantly block all Soft Aware API access at any time using two independent mechanisms:

### Remote Kill Switch (Soft Aware Portal)

Toggle from your Soft Aware Portal dashboard. This stops our gateway from sending any requests to your API.

### Local Kill Switch (Your Server)

Implement a server-side flag. When activated, reject all requests from Soft Aware with HTTP 503:

```javascript
// In your API middleware:
if (getKillSwitchStatus() === "active") {
  return res.status(503).json({
    success: false,
    error: "SERVICE_SUSPENDED",
    message: "AI gateway disabled by admin"
  });
}
```

### IP Whitelisting

For additional security, restrict your AI gateway endpoints to only accept requests from Soft Aware's server IP. Contact support for the current IP address.

---

## 10. Trial vs Paid — What You Need to Know

During a **trial period**, the client has Free tier resource limits but **all tools function normally** with full capability. There are no read-only restrictions.

| Aspect | Trial (Free Limits) | Paid Package |
|--------|-------------------|--------------|
| Tool access | ✅ All tools work | ✅ All tools work |
| Actions/month | 500 | Up to 999,999 |
| Vision (image/file analysis) | ❌ Not available | ✅ Advanced+ only |
| Sites | 1 | Up to 999 |
| Widgets | 1 | Up to 999 |

**You do NOT need to enforce trial logic on your side.** Just build all your endpoints — Soft Aware handles resource caps and access control.

> **Vision restriction:** Image and file analysis requires the Advanced package or higher (not available on Free, Starter, or Pro). Files sent from non-vision packages are blocked before reaching your API.

### 10.1 Branding — "Powered by Soft Aware"

Free-tier and trial integrations **must** display a "Powered by Soft Aware" badge in any UI that renders AI features powered by the gateway. This is enforced automatically — you don't need to build the logic yourself.

#### How It Works

The gateway injects a `_branding` object into every proxy response and management API response. Your code reads this object and renders (or hides) the badge accordingly.

**Free / Trial — branding required:**

```json
{
  "_branding": {
    "powered_by": "Powered by Soft Aware",
    "logo_url": "https://softaware.net.za/assets/logo-badge.png",
    "link_url": "https://softaware.net.za"
  }
}
```

**Paid plan (Starter+) — branding removed automatically:**

The `_branding` field is **absent** from proxy responses, and the `/config` endpoint returns `"branding": { "required": false }`.

#### Where Branding Appears

| Source | Free / Trial | Paid |
|--------|:------------:|:----:|
| **Proxy responses** (`POST /:clientId/:action`) | `_branding` injected into response body | No `_branding` field |
| **GET /config** | `branding.required = true` + logo/link | `branding.required = false` |
| **GET /health** | `branding.required = true` + logo/link | `branding.required = false` |
| **GET /export** (spec JSON) | Branding policy included | Branding marked optional |

#### What You Must Display

If `branding.required` is `true`, your UI must include:

1. The **Soft Aware logo** — use the URL from `logo_url`
2. The **"Powered by Soft Aware"** text from `powered_by`
3. A **clickable link** to `link_url` (https://softaware.net.za)

The badge should be visible wherever AI-generated content is displayed to end users (chat window, tool results, dashboard widgets, etc.).

#### Example: Reading Branding from /config

```javascript
const res = await fetch(`https://api.softaware.net.za/api/v1/client-api/${clientId}/config`, {
  headers: { 'X-Client-Secret': SECRET },
});
const { data } = await res.json();

if (data.branding.required) {
  // Render the badge
  showBadge({
    text: data.branding.powered_by,    // "Powered by Soft Aware"
    logo: data.branding.logo_url,       // logo image URL
    link: data.branding.link_url,       // https://softaware.net.za
  });
} else {
  // Paid plan — no branding needed
  hideBadge();
}
```

#### Example: Reading Branding from Proxy Response

```javascript
// After receiving a tool-call result through the gateway:
const result = await callGatewayTool('getOrderStatus', { order_id: 'ORD-10042' });

if (result._branding) {
  // Free tier — show branding alongside the result
  renderResult(result.data);
  renderBadge(result._branding);
} else {
  // Paid tier — just show the result
  renderResult(result.data);
}
```

#### Automatic Upgrade

When the account upgrades from free to a paid plan, the branding disappears from all responses **immediately** — no code changes needed on your side. The `_branding` field simply stops appearing in proxy responses, and `branding.required` flips to `false` in `/config`.

> ⚠ **Removing branding without a paid plan is a violation of the Soft Aware terms of service.** The gateway enforces this server-side, so it cannot be bypassed by ignoring the `_branding` field — but you must render it when present.

---

## 11. Managing Your AI Gateway — What You'll See in the UI

You can manage your AI gateway from **two places**:

1. **The Soft Aware Portal** — log in at [https://softaware.net.za/portal](https://softaware.net.za/portal) and navigate to **Integrations → API Gateway**
2. **The AI page in your own application** — if you've integrated the Soft Aware platform into your app, the AI page includes a gateway management section

Both places show the **same information and controls**. The sections below explain what each part of the AI page means and how to use it, whether you're seeing it in the Soft Aware Portal or embedded in your own application.

---

### 11.1 The AI Page — What You'll See

When you open the AI page in your application (or the gateway page in the Soft Aware Portal), you'll see a page divided into these sections:

```
┌──────────────────────────────────────────────────────────────────┐
│  🤖 AI Integration                                               │
│                                                                  │
│  ┌─ Gateway Status ─────────────────────────────────────┐    │
│  │  ● Active       Your Company        your-client-id    │    │
│  │  Rolling Token   X-AI-Auth-Token     60 req/min          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ Tabs ───────────────────────────────────────────────────┐    │
│  │ [Connection] [Security] [Usage] [Tools] [Logs] [Export]  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  (selected tab content appears here)                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

The **status banner** at the top is always visible. Below it, a **tab bar** lets you switch between the different management sections. Each tab is explained below.

---

### 11.2 Status Banner

The banner at the top of the AI page shows your gateway's current state at a glance.

| Field | What it means |
|-------|---------------|
| **Status indicator** | A colored dot with label — 🟢 `Active` (everything working), 🟡 `Paused` (you paused it), or 🔴 `Disabled` (Soft Aware admin disabled it) |
| **Company name** | Your company name as registered with Soft Aware |
| **Client ID** | Your unique identifier (e.g., `acme-store`). This appears in API URLs |
| **Auth type** | The authentication method in use: Rolling Token, Bearer, API Key, Basic, or None |
| **Auth header** | The HTTP header name used when calling your API (e.g., `X-AI-Auth-Token`) |
| **Rate limit** | How many requests per minute Soft Aware will send (default: 60) |

Next to the status, you'll see action buttons:

| Button | What it does |
|--------|-------------|
| **⏸ Pause** | Immediately stops all AI requests to your API. Changes to **▶ Resume** when paused. See [11.5 Kill Switch](#115-kill-switch-pause--resume). |
| **📥 Export** | Downloads your integration spec as a JSON file. See [11.8 Export](#118-export-integration-spec). |

---

### 11.3 Connection Tab

This tab shows where Soft Aware sends requests and lets you update your API details.

```
┌──────────────────────────────────────────────────────────────────┐
│  Connection Settings                                             │
│                                                                  │
│  Target Base URL                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ https://api.yourcompany.com/ai-gateway                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ℹ Soft Aware sends tool calls to {base_url}/{tool_name}         │
│                                                                  │
│  Authentication Type                                             │
│  ┌──────────────────────────┐                                    │
│  │ Rolling Token (SHA-256) ▼│                                    │
│  └──────────────────────────┘                                    │
│                                                                  │
│  Auth Header Name                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ X-AI-Auth-Token                                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠ Changes take effect immediately. Make sure your API is        │
│    ready before saving.                                          │
│                                                                  │
│                              [ Cancel ]  [ Save Changes ]        │
└──────────────────────────────────────────────────────────────────┘
```

**What you can change:**

| Setting | What to enter | When to change it |
|---------|---------------|-------------------|
| **Target Base URL** | The full URL of your API. Soft Aware appends the tool name to this, e.g., `https://api.yourcompany.com/ai-gateway/lookupCustomer` | When migrating to a new server or changing your API path |
| **Authentication Type** | Dropdown: Rolling Token, Bearer, API Key, Basic Auth, or None | When switching auth methods (rare — coordinate with your team) |
| **Auth Header Name** | The HTTP header name (default: `X-AI-Auth-Token`). Only editable for Rolling Token and API Key | When your API expects a different header name |

> ⚠ **Changes are instant.** If you change the base URL, the very next AI tool call will go to the new URL. Make sure your new endpoint is live before saving.

---

### 11.4 Security Tab — API Key & Secret Management

This is where you manage the credentials Soft Aware uses to authenticate with your API. This is the most critical section — **if these credentials don't match what your server expects, all AI tool calls will fail with 401 Unauthorized.**

```
┌──────────────────────────────────────────────────────────────────┐
│  Shared Secret                                                   │
│                                                                  │
│  Your secret:  a1b2c3••••••••••••••••••••••••••••x7y8z9          │
│  Length: 64 characters                                           │
│                                                                  │
│  [ 👁 Show ]   [ 📋 Copy ]   [ 🔄 Regenerate ]                   │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                  │
│  Use your own secret                                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│  [ Save Custom Secret ]                                          │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                  │
│  ℹ This secret is used to authenticate Soft Aware's requests     │
│    to YOUR API. If you're using Rolling Token auth, both your    │
│    server and Soft Aware compute: SHA256(secret + "YYYY-MM-DD")  │
│    and compare the result. See the Authentication section of     │
│    this guide for validation code in PHP, Node.js, Python, C#.   │
│                                                                  │
│  ⚠ After changing your secret here, update it on your server     │
│    IMMEDIATELY. Old tokens will stop working.                    │
└──────────────────────────────────────────────────────────────────┘
```

**What each button does:**

| Button | Action | Important notes |
|--------|--------|-----------------|
| **👁 Show** | Reveals the full secret (masked by default) | Use this to copy the secret when setting up your server for the first time |
| **📋 Copy** | Copies the full secret to your clipboard | Paste it into your server's environment variable (e.g., `SOFTAWARE_SECRET`) |
| **🔄 Regenerate** | Creates a new random 64-character secret | **The old secret stops working immediately.** Update your server first, then regenerate here, then update your server again. Or: pause the gateway first, regenerate, update your server, then resume. |
| **Save Custom Secret** | Use your own secret instead of the auto-generated one | Must be at least 32 characters. Useful if you want the same secret across staging and production |

**How to safely rotate your secret:**

1. Click **⏸ Pause** on the status banner (stops all AI calls)
2. Click **🔄 Regenerate** (or paste a new custom secret)
3. Copy the new secret and update your server's environment variable
4. Restart your server / reload your config
5. Click **▶ Resume** on the status banner
6. Test by asking the AI chatbot a question that triggers a tool call

> **Rolling Token users:** The secret is not sent directly — it's combined with today's date to produce a daily token via `SHA256(secret + "YYYY-MM-DD")`. See [Section 3.1](#31-rolling-token-recommended) for full validation code.

---

### 11.5 Kill Switch (Pause / Resume)

The **Pause** button on the status banner is your kill switch. One click stops all AI requests to your API.

**What happens when you pause:**

| What changes | Detail |
|-------------|--------|
| Gateway status | Changes to 🟡 **Paused** |
| AI tool calls | Blocked — Soft Aware does not send any requests to your API |
| Chat behavior | The AI tells end users: _"This service is temporarily unavailable, please try again later."_ |
| Your server | Receives zero requests from Soft Aware while paused |
| Usage stats | Preserved — pausing does not erase history |
| Button | Changes from **⏸ Pause** to **▶ Resume** |

**What happens when you resume:**

Everything goes back to normal instantly. No re-configuration needed. The AI immediately starts calling your API again.

**When to use the kill switch:**

- 🔧 **Server maintenance** — Pause before taking your API down for updates
- 🔑 **Credential rotation** — Pause → change secret → update server → resume
- 🚨 **Incident response** — If you notice unexpected calls or your API is misbehaving
- 🧪 **Testing** — Pause production while you test changes on staging

**Three status levels:**

| Status | Who controls it | What it means |
|--------|----------------|---------------|
| 🟢 **Active** | You or Soft Aware | Normal operation — AI calls flow to your API |
| 🟡 **Paused** | You (from the UI) | Temporarily suspended — resume any time |
| 🔴 **Disabled** | Soft Aware admin only | Permanently disabled — contact support to re-enable |

> You can also implement a **local kill switch** on your own server as a second layer of control. See [Section 9](#9-kill-switch) for a code example.

---

### 11.6 Usage Tab — Monitoring Dashboard

The Usage tab gives you real-time visibility into how the AI is using your API.

```
┌──────────────────────────────────────────────────────────────────┐
│  Usage Statistics                     Period: [ Last 30 days ▼]  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   342    │  │   328    │  │    14    │  │  245 ms  │        │
│  │ Requests │  │ Success  │  │  Errors  │  │ Avg Time │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  Daily Request Volume                                            │
│  █ █ ██ ███ ██ █ ██ ███ █ █ ██ ██ █████ ██ █ ██ ██ ██ █ ██ ██  │
│  (bar chart — green = success, red = errors)                     │
│                                                                  │
│  ── Per-Tool Breakdown ────────────────────────────────────    │
│  │ Tool              │ Calls │ Success │ Errors │ Avg ms │      │
│  ├───────────────────┼───────┼─────────┼────────┼────────┤      │
│  │ lookupCustomer    │  200  │   195   │    5   │  180   │      │
│  │ getOrderStatus    │   85  │    82   │    3   │  120   │      │
│  │ createTicket      │   42  │    40   │    2   │  350   │      │
│  │ updateCustomer    │   15  │    11   │    4   │  280   │      │
│  └───────────────────┴───────┴─────────┴────────┴────────┘      │
│                                                                  │
│  ── Recent Requests ───────────────────────────────────────    │
│  │ Time       │ Tool             │ Status │ Duration │ Error │   │
│  ├────────────┼──────────────────┼────────┼──────────┼───────┤   │
│  │ 14:30:05   │ lookupCustomer   │  200   │  150ms   │  —    │   │
│  │ 14:28:12   │ getOrderStatus   │  200   │  120ms   │  —    │   │
│  │ 14:25:44   │ createTicket     │  500   │  2100ms  │ DB err│   │
│  └────────────┴──────────────────┴────────┴──────────┴───────┘   │
│                                                                  │
│  [ Export CSV ]  [ Refresh ]                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Summary cards at the top:**

| Card | What it shows |
|------|--------------|
| **Requests** | Total tool calls made in the selected period |
| **Success** | Calls that returned HTTP 2xx from your API |
| **Errors** | Calls that returned 4xx/5xx or timed out |
| **Avg Time** | Average round-trip time in milliseconds |

**Daily chart:** A bar chart showing requests per day. Green = success, red = errors. Hover over a bar for exact numbers.

**Per-tool breakdown:** See which tools get the most traffic, which have the highest error rates, and which are slowest. This helps you prioritize optimization — if `createTicket` averages 350ms while others are under 200ms, investigate why.

**Recent requests:** The last 25 calls with timestamp, tool name, HTTP status code, duration, and error message (if any). Click a row to see full details.

**Period selector options:** Last 7 days, Last 30 days, Last 60 days, Last 90 days.

> **What to look for:**
> - **High error count on one tool** — likely a bug in that specific endpoint on your server
> - **All tools suddenly failing** — probably an auth issue (secret mismatch) or your server is down
> - **Slow response times** — your API is taking too long; the AI waits for your response before replying to the user
> - **Zero requests** — either no users are asking relevant questions, or the AI isn't configured to use your tools

**Programmatic access:** You can also query these stats from your own code using the [Usage Statistics API](#7-usage-statistics-api) — same data, accessible via HTTP.

---

### 11.7 Tools Tab — Your Registered Endpoints

The Tools tab shows which of your API endpoints are registered on the gateway and available to the AI.

```
┌──────────────────────────────────────────────────────────────────┐
│  Registered Tools (4)                                            │
│                                                                  │
│  ✅ lookupCustomer                                                │
│     "Look up customer details by email or name"                  │
│     Parameters: email (required), customer_name                   │
│     200 calls  │  Avg: 180ms  │  Last called: 2 min ago         │
│                                                                  │
│  ✅ getOrderStatus                                                │
│     "Check an order's current status and tracking"               │
│     Parameters: order_id (required), email                        │
│     85 calls   │  Avg: 120ms  │  Last called: 5 min ago         │
│                                                                  │
│  ✅ createTicket                                                  │
│     "Log a support ticket on behalf of a customer"               │
│     Parameters: email (req), category (req),                      │
│                 description (req), priority                       │
│     42 calls   │  Avg: 350ms  │  Last called: 1 hr ago          │
│                                                                  │
│  ✅ updateCustomer                                                │
│     "Update a customer's contact details"                        │
│     Parameters: email (req), field (req), value (req)             │
│     15 calls   │  Avg: 280ms  │  Last called: 3 hrs ago         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**What this tells you:**

- **Tool name** — The endpoint path the AI calls on your API (e.g., `POST {base_url}/lookupCustomer`)
- **Description** — What the AI thinks this tool does. This text helps the AI decide _when_ to use the tool.
- **Parameters** — The inputs the AI sends to your endpoint. `(req)` = required.
- **Stats** — How often the tool is called, average response time, and when it was last used.

**This tab is read-only.** The tool definitions (names, descriptions, parameters) are configured by Soft Aware staff to ensure the AI uses them correctly. If you need to:
- **Add a new tool** → Contact Soft Aware support with the endpoint path, description, and parameter list
- **Remove a tool** → Contact support
- **Change a tool's parameters** → Update your API endpoint, then contact support to update the AI's tool definition

> The AI decides which tool to call based on the user's question and the tool descriptions. If users aren't triggering a tool you expect, the description may need adjustment — contact support.

---

### 11.8 Export Integration Spec

The **📥 Export** button (on the status banner or the Export tab) downloads a JSON file containing your complete gateway configuration. This file is meant to be **shared with your development team**.

**What the exported file includes:**

| Section | Contents |
|---------|----------|
| `connection` | Your base URL, auth type, auth header, rate limit, timeout |
| `auth_validation` | Ready-to-use code snippets for validating auth tokens in PHP, Node.js, and Python |
| `tools` | All registered tool definitions with parameter schemas and descriptions |
| `kill_switch` | How to implement a local kill switch on your server |
| `usage_stats` | Pre-filled API URL and auth details for querying your usage stats programmatically |
| `response_format` | Expected success/error JSON shapes |

> ⚠ The exported file shows a **hint** of your secret (first 6 + last 4 characters, e.g., `a1b2c3...y8z9`), **not** the full secret. Your developers will need to get the full secret from the Security tab.

**Use cases:**
- Hand to a developer who needs to build or maintain your API endpoints
- Keep as a backup of your gateway configuration
- Use to set up an identical gateway in a staging environment

---

### 11.9 Logs Tab — Request History

The Logs tab shows a detailed history of every request the AI made to your API.

```
┌──────────────────────────────────────────────────────────────────┐
│  Request Logs                                  [ Refresh ]       │
│                                                                  │
│  │ #    │ Time            │ Tool            │ HTTP │ ms   │ Err │
│  ├──────┼─────────────────┼─────────────────┼──────┼──────┼─────┤
│  │ 1547 │ 14:30:05 Today  │ lookupCustomer  │ 200  │ 150  │  —  │
│  │ 1546 │ 14:28:12 Today  │ getOrderStatus  │ 200  │ 120  │  —  │
│  │ 1545 │ 14:25:44 Today  │ createTicket    │ 500  │ 2100 │ Yes │
│  │ 1544 │ 14:20:01 Today  │ lookupCustomer  │ 200  │ 180  │  —  │
│  │ 1543 │ 13:55:30 Today  │ updateCustomer  │ 401  │  45  │ Yes │
│  │ ...  │                 │                 │      │      │     │
│  └──────┴─────────────────┴─────────────────┴──────┴──────┴─────┘
│                                                                  │
│  Click a row to see full details (request body, response, error) │
│                                                                  │
│  Showing 1–50 of 1,547          [ ← Previous ]  [ Next → ]      │
└──────────────────────────────────────────────────────────────────┘
```

**Log columns:**

| Column | Description |
|--------|-------------|
| **#** | Request sequence number (lifetime counter) |
| **Time** | When the request was made |
| **Tool** | Which tool/endpoint was called |
| **HTTP** | The HTTP status code your API returned (200, 400, 401, 500, etc.) |
| **ms** | Round-trip time in milliseconds |
| **Err** | Whether the request resulted in an error |

**Clicking a row** expands it to show:
- The JSON body that was sent to your API
- The JSON response your API returned
- The full error message (if any)

**What to look for in logs:**

| Pattern | Likely cause | Action |
|---------|-------------|--------|
| Lots of **401** errors | Secret mismatch — your server is rejecting the auth token | Check that the secret on the Security tab matches your server's `SOFTAWARE_SECRET` env var |
| **500** errors on one tool | Bug in that endpoint on your server | Check your server logs for the stack trace |
| **504** timeout errors | Your API is too slow | Optimize the slow endpoint or ask Soft Aware to increase the timeout |
| **502** errors | Your server is unreachable | Check that your server is running and the base URL is correct |

---

### 11.10 Notifications & Alerts

The platform can notify you when something goes wrong with your gateway.

| Alert | What triggers it | How you're notified |
|-------|-----------------|---------------------|
| **High Error Rate** | More than 20% of requests fail over 1 hour | Email + in-app notification |
| **Gateway Down** | 5 consecutive requests fail | Email + in-app notification |
| **Secret Expiring** | Soft Aware-managed secret approaching scheduled rotation | Email (7 days before) |
| **Usage Threshold** | Monthly request count nearing your package limit | In-app notification |

Notifications appear as a bell icon badge in the AI page header. Email alerts go to the primary email address on your account.

---

### 11.11 Summary — What You Control vs. What Soft Aware Controls

| Feature | You manage it | Soft Aware manages it |
|---------|:------------:|:--------------------:|
| Base URL (where requests go) | ✅ | — |
| Auth type selection | ✅ | — |
| Shared secret / API key | ✅ | — |
| Pause / Resume (kill switch) | ✅ | ✅ (can also disable) |
| View usage stats | ✅ | ✅ |
| View request logs | ✅ | ✅ |
| Export integration spec | ✅ | ✅ |
| Add / remove / modify tools | — | ✅ |
| Rate limit adjustment | — | ✅ |
| Timeout adjustment | — | ✅ |
| Enable / Disable gateway | — | ✅ |

---

## 12. Self-Service Management API

All the features described in [Section 11](#11-managing-your-ai-gateway--what-youll-see-in-the-ui) are powered by a REST API. If you're building your **own admin page** inside your application (instead of using the Soft Aware Portal), call these endpoints directly.

### Authentication

Every endpoint below requires your **shared secret** in the `X-Client-Secret` header:

```
X-Client-Secret: <your_shared_secret_or_rolling_token>
```

Alternative methods (same as the Usage endpoint):
- `Authorization: Bearer <secret_or_token>`
- Query parameter: `?secret=<secret_or_token>`

### Base URL

```
https://api.softaware.net.za/api/v1/client-api/{your_client_id}
```

---

### 12.1 GET /config — Read Gateway Configuration

Returns your gateway settings, registered tools, and status. **Does not expose the full secret** — only a masked hint.

**Request:**

```bash
curl -H "X-Client-Secret: YOUR_SECRET" \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/config
```

**Response:**

```json
{
  "success": true,
  "data": {
    "client_id": "your-client-id",
    "client_name": "Your Company",
    "status": "active",
    "target_base_url": "https://api.yourcompany.com/ai-gateway",
    "auth_type": "rolling_token",
    "auth_header": "X-AI-Auth-Token",
    "auth_secret_hint": "a1b2c3...y8z9",
    "auth_secret_length": 64,
    "rate_limit_rpm": 60,
    "timeout_ms": 30000,
    "total_requests": 1547,
    "last_request_at": "2026-03-22T14:30:00.000Z",
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-03-22T14:30:00.000Z",
    "tools": [
      {
        "name": "lookupCustomer",
        "description": "Look up customer details by email or name",
        "parameters": [
          { "name": "email", "type": "string", "description": "Customer email address", "required": true },
          { "name": "customer_name", "type": "string", "description": "Name for fuzzy search", "required": false }
        ]
      }
    ]
  }
}
```

---

### 12.2 PATCH /config — Update Connection Settings

Update your base URL, auth type, or auth header. Changes take effect immediately.

**Allowed fields:**

| Field | Type | Description |
|-------|------|-------------|
| `target_base_url` | string | Your API's base URL (must start with `http`) |
| `auth_type` | string | `rolling_token`, `bearer`, `api_key`, `basic`, or `none` |
| `auth_header` | string | Custom header name (1–100 chars) |

**Request:**

```bash
curl -X PATCH \
  -H "X-Client-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"target_base_url": "https://api-v2.yourcompany.com/ai-gateway"}' \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/config
```

**Response:**

```json
{
  "success": true,
  "message": "Updated 1 field(s)",
  "updated": ["target_base_url"]
}
```

> ⚠ Changes are instant. The next AI tool call will use the new settings.

---

### 12.3 POST /secret/rotate — Rotate Shared Secret

Generate a new random 64-character secret, or set your own custom secret. The new secret is returned **once** — store it securely.

**Auto-generate:**

```bash
curl -X POST \
  -H "X-Client-Secret: YOUR_CURRENT_SECRET" \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/secret/rotate
```

**Custom secret:**

```bash
curl -X POST \
  -H "X-Client-Secret: YOUR_CURRENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"custom_secret": "my-own-64-char-secret-that-is-at-least-32-characters-long-ok"}' \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/secret/rotate
```

**Response:**

```json
{
  "success": true,
  "message": "Secret updated. Store this securely — it will not be shown again.",
  "secret": "e4f7a8c2d1b5e9f3...new64charhexsecret",
  "length": 64,
  "auth_type": "rolling_token",
  "note": "Your new rolling token = SHA256(\"e4f7a8...\" + \"YYYY-MM-DD\"). Update your server's SOFTAWARE_SECRET env var immediately."
}
```

> ⚠ **The old secret stops working immediately.** Recommended flow: pause → rotate → update server → resume.

---

### 12.4 PATCH /status — Pause / Resume Gateway

Toggle between `active` and `paused`. You cannot set `disabled` — that's admin-only.

**Pause:**

```bash
curl -X PATCH \
  -H "X-Client-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}' \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/status
```

**Resume:**

```bash
curl -X PATCH \
  -H "X-Client-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}' \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/status
```

**Response:**

```json
{
  "success": true,
  "message": "Gateway paused — no AI requests will be sent to your API",
  "status": "paused",
  "previous_status": "active"
}
```

| Status | Allowed via API | Effect |
|--------|:--------------:|--------|
| `active` | ✅ | Normal operation |
| `paused` | ✅ | All AI calls blocked, users see "service unavailable" |
| `disabled` | ❌ | Admin-only. Returns 403 if you try to resume. |

---

### 12.5 GET /logs — Request History

Paginated request logs. Same data as the Logs tab.

**Request:**

```bash
curl -H "X-Client-Secret: YOUR_SECRET" \
  "https://api.softaware.net.za/api/v1/client-api/{your_client_id}/logs?limit=10&offset=0"
```

**Query parameters:**

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `limit` | 50 | 200 | Number of log entries per page |
| `offset` | 0 | — | Pagination offset |

**Response:**

```json
{
  "success": true,
  "client_id": "your-client-id",
  "total": 1547,
  "limit": 10,
  "offset": 0,
  "has_more": true,
  "logs": [
    {
      "id": "calog_a1b2c3d4e5f6",
      "action": "lookupCustomer",
      "status_code": 200,
      "duration_ms": 150,
      "error_message": null,
      "created_at": "2026-03-22T14:30:05.000Z"
    },
    {
      "id": "calog_f6e5d4c3b2a1",
      "action": "createTicket",
      "status_code": 500,
      "duration_ms": 2100,
      "error_message": "Internal Server Error: database connection failed",
      "created_at": "2026-03-22T14:25:44.000Z"
    }
  ]
}
```

---

### 12.6 GET /export — Download Integration Spec

Downloads a JSON file with your complete gateway spec — connection details, auth validation code examples, tool definitions, and management API endpoints. Same format as the Export button in the UI.

```bash
curl -H "X-Client-Secret: YOUR_SECRET" \
  -o gateway-spec.json \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/export
```

The file is returned as `application/json` with a `Content-Disposition: attachment` header.

---

### 12.7 POST /billing/checkout — Initiate Payment

Create a Yoco checkout session for subscribing to or upgrading your plan. Returns a URL — redirect the user to this URL to complete payment.

**Request:**

```bash
curl -X POST \
  -H "X-Client-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_type": "pro",
    "success_url": "https://yourapp.com/billing/success",
    "cancel_url": "https://yourapp.com/billing/cancel"
  }' \
  https://api.softaware.net.za/api/v1/client-api/{your_client_id}/billing/checkout
```

**Body parameters:**

| Field | Required | Description |
|-------|----------|-------------|
| `plan_type` | ✅ | `starter`, `pro`, or `advanced` |
| `success_url` | — | Where to redirect after successful payment |
| `cancel_url` | — | Where to redirect if user cancels |

**Response:**

```json
{
  "success": true,
  "redirect_url": "https://payments.yoco.com/checkout/abc123...",
  "checkout_id": "abc123-def456-ghi789",
  "plan": "pro",
  "plan_name": "Pro",
  "amount_zar": 699,
  "message": "Open the redirect_url in a browser to complete payment for the Pro plan (R699/month)."
}
```

**Payment flow:**

1. Your app calls `POST /billing/checkout` with the chosen plan
2. Soft Aware creates a Yoco checkout session and returns `redirect_url`
3. Your app opens `redirect_url` in a new tab or redirects the user there
4. User completes payment on Yoco's hosted checkout page
5. Yoco redirects to your `success_url` (or `cancel_url`)
6. Yoco's webhook notifies Soft Aware → user's plan is upgraded automatically

> **Enterprise plans** are not available for self-serve checkout. Contact sales.

---

### 12.8 GET /billing/plans — List Available Plans

Public endpoint (no authentication required). Returns available plans with pricing and feature limits. Useful for building a pricing page in your app.

**Request:**

```bash
curl https://api.softaware.net.za/api/v1/client-api/{your_client_id}/billing/plans
```

**Response:**

```json
{
  "success": true,
  "currency": "ZAR",
  "plans": [
    {
      "plan": "starter",
      "name": "Starter",
      "price_zar": 349,
      "price_monthly_display": "R349/month",
      "limits": {
        "sites": 3,
        "widgets": 3,
        "actions_per_month": 2000,
        "knowledge_pages": 200,
        "storage_mb": 50,
        "has_vision": false,
        "can_remove_watermark": true
      }
    },
    {
      "plan": "pro",
      "name": "Pro",
      "price_zar": 699,
      "price_monthly_display": "R699/month",
      "limits": {
        "sites": 10,
        "widgets": 10,
        "actions_per_month": 5000,
        "knowledge_pages": 500,
        "storage_mb": 200,
        "has_vision": false,
        "can_remove_watermark": true
      }
    },
    {
      "plan": "advanced",
      "name": "Advanced",
      "price_zar": 1499,
      "price_monthly_display": "R1499/month",
      "limits": {
        "sites": 25,
        "widgets": 25,
        "actions_per_month": 20000,
        "knowledge_pages": 2000,
        "storage_mb": 1024,
        "has_vision": true,
        "can_remove_watermark": true
      }
    }
  ],
  "enterprise": {
    "plan": "enterprise",
    "name": "Enterprise",
    "price": "Custom — contact sales",
    "contact": "support@softaware.net.za"
  }
}
```

---

### 12.9 Quick Reference — All Management Endpoints

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/{clientId}/health` | ❌ | Health check (public) |
| GET | `/{clientId}/config` | ✅ | Read gateway config + tools |
| PATCH | `/{clientId}/config` | ✅ | Update base URL, auth type, auth header |
| POST | `/{clientId}/secret/rotate` | ✅ | Rotate or set custom secret |
| PATCH | `/{clientId}/status` | ✅ | Pause / resume gateway |
| GET | `/{clientId}/usage` | ✅ | Usage stats (daily, per-tool, recent) |
| GET | `/{clientId}/logs` | ✅ | Paginated request logs |
| GET | `/{clientId}/export` | ✅ | Download integration spec JSON |
| POST | `/{clientId}/billing/checkout` | ✅ | Create Yoco payment session |
| GET | `/{clientId}/billing/plans` | ❌ | List plans + pricing (public) |

---

## 13. Checklist for Going Live

- [ ] **Choose an auth type** — Rolling token is recommended
- [ ] **Share your base URL** with Soft Aware staff (e.g., `https://api.yourcompany.com/ai-gateway`)
- [ ] **Exchange the shared secret** securely (use the Soft Aware Portal secure messaging, NOT email)
- [ ] **Build your API endpoints** — one POST endpoint per tool/action
- [ ] **Validate auth tokens** on every request (see [Section 3](#3-authentication))
- [ ] **Return JSON responses** with `success`, `data`, and meaningful error messages
- [ ] **Test the health check** — `GET /api/v1/client-api/{your_client_id}/health`
- [ ] **Test each tool** — Soft Aware staff will trigger test calls from the admin portal
- [ ] **Set up monitoring** — Check the [Usage Dashboard](#116-usage-tab--monitoring-dashboard) in the AI page, call the [Usage Statistics API](#7-usage-statistics-api), or use the [Self-Service Management API](#12-self-service-management-api) to fetch logs and stats programmatically
- [ ] **Configure your kill switch** — Test the Pause button in the AI page ([Section 11.5](#115-kill-switch-pause--resume)), call `PATCH /{clientId}/status` to pause/resume via API, and implement a local kill switch on your server
- [ ] **(Optional) Build your own admin page** — Use the [Self-Service Management API](#12-self-service-management-api) to build a custom admin UI in your own app
- [ ] **(Optional) IP whitelist** — Restrict your endpoints to Soft Aware's server IP

---

## 14. Error Codes You May See

These are error codes returned by the Soft Aware gateway (not your API):

| Code | HTTP | Meaning |
|------|------|---------|
| `CLIENT_NOT_FOUND` | 404 | No gateway configured for this client ID |
| `CLIENT_API_DISABLED` | 403 | Gateway has been disabled (kill switch) |
| `CLIENT_API_PAUSED` | 503 | Gateway is temporarily paused |
| `UNKNOWN_TOOL` | 400 | The requested tool/action is not registered on this gateway |
| `GATEWAY_TIMEOUT` | 504 | Your API did not respond within the timeout window |
| `BAD_GATEWAY` | 502 | Cannot reach your API (connection refused or DNS failure) |
| `GATEWAY_ERROR` | 500 | Internal gateway error |
| `UNAUTHORIZED` | 401 | Invalid client secret (for usage stats endpoint) |

---

## 15. FAQ

**Q: Do I need to build a special SDK or use a specific framework?**  
A: No. Build standard REST endpoints that accept POST requests with JSON bodies and return JSON responses. Any language or framework works.

**Q: Can I use the same API endpoints for other purposes?**  
A: Yes. Your endpoints are regular HTTP endpoints. You can call them from your own apps too — just validate the auth token to distinguish Soft Aware requests.

**Q: What if my API is slow for some operations?**  
A: The default timeout is 30 seconds. If you need longer, we can increase it. Alternatively, return a job ID immediately and provide a separate status-check tool.

**Q: How do I update my base URL or auth credentials?**  
A: Three options: (1) Open the AI page in your app, (2) log in to the Soft Aware Portal, or (3) call the [Self-Service Management API](#12-self-service-management-api) programmatically. Use `PATCH /config` to change your base URL and `POST /secret/rotate` to rotate credentials. Changes take effect immediately.

**Q: Can I build my own admin dashboard instead of using the Soft Aware Portal?**  
A: Yes. The [Self-Service Management API](#12-self-service-management-api) exposes every management feature — config, secrets, pause/resume, logs, billing — as REST endpoints. Build any UI you want.

**Q: How does billing work via the API?**  
A: Call `POST /{clientId}/billing/checkout` with a `plan_type` (starter, pro, or advanced). You'll get a `redirect_url` — open it in a browser so the user can pay on Yoco's hosted checkout page. After successful payment, the plan upgrades automatically via webhook. Enterprise plans require contacting sales.

**Q: What happens if my API is down?**  
A: The AI will tell the user it couldn't reach the service and suggest trying again later. The error is logged in your gateway's request logs.

**Q: Can I have multiple gateways?**  
A: Yes. Each gateway has its own `client_id`, tools, auth credentials, and rate limits. Useful if you have separate APIs for different business functions.

---

## Contact

For setup assistance, credential exchange, or technical questions:

- **Soft Aware Portal:** https://softaware.net.za/portal
- **Support Email:** support@softaware.net.za
