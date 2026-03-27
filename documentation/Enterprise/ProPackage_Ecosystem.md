# Soft Aware Pro Package: Enterprise Ecosystem Specification

This document defines the architecture, workflow, and user guides for the **Soft Aware Pro Package**. The Pro Package relies on a Zero-Knowledge API integration model, offering a risk-free trial with full Kill Switch controls and free-tier resource caps. The only hard restriction beyond resource limits is that **Vision/File processing requires the Advanced package or higher**.

---

## 1. Internal Guide for Soft Aware Staff
**Audience:** Sales, Engineering, and Support Teams.
**Purpose:** Understanding how the Pro Package operates behind the scenes.

### Core Architecture (Zero-Knowledge)
We do not ingest or duplicate the client's database. Instead, our AI acts as a secure intermediary payload generator. When an assistant is asked a question, it identifies the required tool (API endpoint) and calls our **Client API Gateway**, which forwards the request to the customer's exposed API. The client's API gives us the required data in real-time, meaning we have **Zero Knowledge of their internal infrastructure natively**.

### Trial Limitations
When a customer agrees to a demo, they get the **Pro Package Trial**. 
- The trial runs with **Free tier resource caps** (1 site, 1 widget, 500 actions/month, etc.).
- **All tools defined by the external developer have full action capability** — there is no read-only restriction. The developer defines whatever tools they need, and the AI can call any of them.
- The only hard gate beyond resource limits is **Vision/File processing**, which requires the **Advanced** package or higher. Vision requests are rejected before any file processing occurs.
- Enforcement is done via the `resolveTrialLimits()` chain in `packageResolver.ts`, which degrades TRIAL consumer packages to Free tier limits.

### Vision Gate
Vision and file processing (image analysis, document reading) is a premium feature:
- **Free, Starter, Pro** — `hasVision: false` — all vision requests are blocked before processing
- **Advanced, Enterprise** — `hasVision: true` — vision operations are allowed
- This is enforced at three entry points: assistant chat, mobile AI, and enterprise webhooks
- Enterprise webhook degrades gracefully (processes as text-only instead of rejecting)

### The Kill Switch & Authentication
To ensure absolute client control and security, the integration utilizes automated daily-updating authentication (`SHA256(shared_secret + YYYY-MM-DD)`). 
- Because the auth rotates daily, the most robust way to sever access is a **Kill Switch**. 
- The customer can toggle a Kill Switch from their Soft Aware Portal, or locally on their own server via an injected UI. Doing so blocks the requests from our IP immediately.

### Upgrading & Widget Activation
If the client wishes to unlock full Pro resource limits, they initiate billing via the Yoco Gateway (either via the Soft Aware portal or their local injected UI). 
Once the subscription is active:
1. Our middleware registers the account status as `ACTIVE`.
2. Resource limits instantly upgrade from Free tier to the full Pro tier (10 sites, 10 widgets, 5000 actions/month, etc.).
3. All tools already have full capability — the upgrade simply removes resource caps.
4. Vision remains gated until the **Advanced** package or higher.

---

## 2. Customer-Facing Website Copy (Marketing)
**Audience:** Potential Customers visiting the Soft Aware website.
**Purpose:** Pitch the risk-free trial, emphasize absolute data security, and offer a path to start.

### **Supercharge Your Platform with Soft Aware Pro — Risk Free.**
Imagine an AI assistant that instantly understands your customers and solves their problems in real-time, all without ever storing your sensitive data. 

With the **Soft Aware Pro Package Trial**, you can experience the future of customer interaction natively in your environment.

* **Zero-Knowledge Security:** We don't want your database. You expose a secure API; our AI queries only what it needs, exactly when it needs it. Your internal data stays strictly within your walls.
* **Bank-Grade Access Control:** Our connections run on IP-restricted, daily-rotating authentication tokens. 
* **The Ultimate Kill Switch:** You are always in control. With a single click from your Soft Aware Portal—or directly from your own admin dashboard—you can instantly sever our API's access. No questions asked.
* **Full Tool Capability:** During your trial, all your API tools work at full capacity. Define any endpoints you need — reads, writes, actions — they all work. The trial simply applies resource caps (limited sites, widgets, and monthly actions) that unlock when you subscribe.

**Ready to Unlock Full Power?**
Once you see the magic in action, upgrade seamlessly to the full Pro Package directly from your dashboard. Our Yoco-powered automated billing will activate instantly, removing resource caps and scaling your AI to its full potential.

[ **Start Your Secure Trial Today** ] *(Button)*

---

## 3. External UI Guide (For the Client's Admin Portal)
**Audience:** The Client's Internal Admins/Developers managing their own servers.
**Purpose:** Explain the "Injected UI" we have added to their internal system to manage the integration.

### **Welcome to Your Soft Aware Integration Panel**

This component manages the secure bridge between our AI platform and your application. We have wired this directly into your environment so you maintain absolute control over what we can and cannot do. 

#### **1. How the Wiring Works**
Your application is currently securely connected to the Soft Aware API Gateway using **IP Restriction** and a **Daily Rotating Key**. This ensures that no unauthorized parties can intercept queries, and that Soft Aware only accesses your API with a fresh, cryptographically secure token every 24 hours.

#### **2. Security Kill Switch**
We believe you should hold the keys to your data. Below is your Emergency Kill Switch. Placed directly in your environment, flipping this switch instantly drops our API connection, invalidating authentication before requests even leave your server. 
*(You can also trigger a remote kill switch from your softaware.net.za account).*
> `[ TOGGLE: SOFT AWARE API CONNECTION (ACTIVE) ]`

#### **3. Upgrade to Unlock Full Resources**
Currently, your AI Assistant is in **Trial Mode**. This means all your API tools work at full capability, but resource limits are capped (limited sites, widgets, and monthly actions). 
Click **Subscribe** below to initiate automated monthly billing via Yoco. Once activated, the Soft Aware middleware will instantly upgrade your resource limits to the full Pro tier.
> `[ SUBSCRIBE WITH YOCO ]`

#### **4. Customer Widget Activation**
Ready to deploy the AI to your actual customers? Use the toggle below to activate the Soft Aware Widget on your site. The Widget automatically talks to the Soft Aware API to check your account status and resource limits.
> `[ TOGGLE: ACTIVATE END-USER WIDGET (INACTIVE) ]`

---

## 4. Technical Flow & Ecosystem Specification

### A. API Gateway Middleware Flow
1. **Client End-User** interacts with the Soft Aware Widget on the Client's website.
2. Widget sends query to **Soft Aware Core API**.
3. Soft Aware Core API routes to the Enterprise Endpoint → `callOpenRouter()` sends the prompt + `llm_tools_config` to the LLM.
4. LLM returns a tool call (e.g., `getCustomerInfo`, `createFault`).
5. **Tool Execution** (`clientApiGateway.ts`):
   - The gateway's registered tools list is checked to verify the tool name is valid (security whitelist).
   - **If the tool IS registered:** Request is proxied to the client's `target_base_url/{action}` with auth headers, and the response payload is returned.
   - **If the tool IS NOT registered:** Returns `UNKNOWN_TOOL` error — prevents calling arbitrary endpoints.
   - **All tools have full action capability regardless of package tier.**
6. **Vision Gate** (if the request includes images/files):
   - `checkVisionAccess(contactId)` checks the contact's package `hasVision` flag.
   - **Free/Starter/Pro** → `hasVision: false` → vision request blocked before any file processing.
   - **Advanced/Enterprise** → `hasVision: true` → vision operations proceed.
   - Enterprise/Staff packages are always exempt.
7. Soft Aware generates daily token `SHA256(shared_secret + YYYY-MM-DD)` and fires the request to the Client's exposed API.
8. Client API receives request, checks IP whitelist, checks Daily Token, checks local **Kill Switch** state.
   - If Kill Switch is Active: HTTP 503 Service Unavailable / Connection Refused.
   - If Valid: Processes request and returns JSON to Soft Aware.

### B. Widget Intelligence Path
- **Script Injection:** The client embeds `<script src="https://api.softaware.net.za/widget.js?endpoint=..."></script>`.
- **Initialization:** Widget runs GET `/api/v1/widget/config`.
- **Payload:** Response includes account status and resource limits. The widget adapts its UI based on the account's capabilities.

### C. Kill Switch Synchronization
- **Local (Client-Side) Kill Switch**: Changes a local `.env` or `SQLite` flag on the client's server, explicitly dropping any HTTP requests matching the Soft Aware IP or Auth headers.
- **Remote (Platform) Kill Switch**: Handled in the Soft Aware Account portal. Sets `endpoint_status = disabled`. This stops the Soft Aware API from ever initiating the ping to the local server. Allowed for redundancy and ease of use.

### D. Client API Gateway Provisioning (Admin Import Flow)

Gateways are created by Soft Aware staff through the Admin UI's **Create Gateway** wizard. This is an admin-driven process — clients never fill out templates themselves.

#### Provisioning Steps

```
1. SELECT CLIENT ACCOUNT
   Admin picks a contact from the dropdown.
   → contact_id is stored on the gateway config
   → client_id is auto-derived by slugifying the contact's company_name
     (e.g., "Acme Corp" → "acme-corp")
   → client_name is set to the contact's company_name

2. SELECT ENTERPRISE ENDPOINT
   Admin picks an endpoint from the dropdown.
   → endpoint_id is stored on the gateway config
   → The endpoint's llm_tools_config is loaded to populate the tool picker

3. CHOOSE TOOLS (Tool Picker)
   The tool picker displays all tools from the endpoint's llm_tools_config.
   Each tool shows: name, description, parameter count.
   Admin toggles which tools to enable. "Select All" / "Clear" shortcuts available.
   → selected_tools[] is sent in the payload

4. AUTO-GENERATION (Backend)
   POST /admin/client-api-configs/import processes the request:
   → api_endpoint: auto-generated as /api/gateway/{client_id}
   → auth_type: defaults to 'rolling_token' (can override)
   → auth_secret: auto-generated 64-char hex via crypto.randomBytes(32)
   → target_base_url: defaults to placeholder (can override)
   → allowed_actions: set to ALL selected tools (security whitelist, not tier restriction)
   → tools: written to the gateway from selected_tools

5. TOOL REGISTRATION (Security Whitelist)
   All selected tools are registered in allowed_actions as a security whitelist.
   This prevents the AI from calling arbitrary endpoints on the client's API.
   There is NO tier-based restriction on tool capability — all tools have full
   read+write+action power regardless of the client's package tier.
```

#### Tool Access Model

| Aspect | Behavior |
|--------|----------|
| **Tool capability** | All tools have full action capability on all tiers |
| **Tool whitelisting** | `allowed_actions` acts as a security whitelist — only registered tools can be called |
| **Resource limits** | Trial accounts are capped at Free tier limits (sites, widgets, actions/month) |
| **Vision/Files** | Blocked below Advanced tier — `hasVision: false` for Free/Starter/Pro |

#### Vision Gate by Package Tier

| Tier | `hasVision` | Vision/File Processing |
|------|-------------|----------------------|
| **Free** | `false` | ❌ Blocked before processing |
| **Starter** | `false` | ❌ Blocked before processing |
| **Pro** | `false` | ❌ Blocked before processing |
| **Advanced** | `true` | ✅ Full vision capabilities |
| **Enterprise** | `true` | ✅ Full vision capabilities |

Vision is enforced at three entry points:
- **`assistants.ts`** (widget chat) → returns 403 JSON error
- **`mobileAIProcessor.ts`** (mobile AI) → returns friendly text message
- **`enterpriseWebhook.ts`** (enterprise endpoints) → degrades to text-only processing

#### Upgrade Path
When a trial client upgrades to a paid plan:
1. `contact_packages.status` changes from `'TRIAL'` to `'ACTIVE'`
2. Resource limits instantly upgrade from Free tier to the full package tier
3. All tools already have full capability — no tool-level changes needed
4. Vision remains gated until the Advanced package or higher

#### Export & Integration Spec System

- **Integration Spec (Generic)** (`GET /admin/client-api-configs/export-template`): Downloads a comprehensive v2.0.0 JSON integration specification. This is the document you hand to a client's developer. It includes:
  - **Request format** — How Soft Aware calls their API (`POST {base_url}/{action_name}` with JSON body)
  - **Authentication guide** — All 5 auth types documented with validation code examples in PHP, Node.js, and Python (rolling_token recommended, with full SHA-256 algorithm explanation)
  - **Response format** — Expected JSON structure for success and error responses, with tips
  - **Example tools** — 4 annotated example endpoints (`getCustomerInfo`, `checkOutages`, `createFault`, `updateRecord`) showing exact parameters, types, required flags, and expected return payloads
  - **Trial vs Paid** — Explains that all tools have full capability; trial applies free-tier resource caps only; vision requires Advanced+
  - **Kill Switch** — Remote and local implementation guide
  - **Config section** — Fields for the client to fill in (base_url, auth_type, shared_secret, available_actions) and share with Soft Aware staff

- **Integration Spec (Client-Specific)** (`GET /admin/client-api-configs/:id/export`): Exports a gateway-specific v2.0.0 spec for an existing config. Includes all of the above PLUS:
  - The actual `target_base_url`, `auth_type`, and `auth_header` configured on the gateway
  - The real tool definitions from the linked Enterprise Endpoint (parsed from `llm_tools_config`)
  - Rolling token validation examples pre-filled with the correct header name
  - Tool-by-tool endpoint URLs (e.g., `POST https://api.client.com/ai/getCustomerInfo`)
  - Auth secret hint (first 6 + last 4 chars) for identification without exposing the full secret

- **Endpoint Tools API** (`GET /admin/client-api-configs/endpoint-tools/:endpointId`): Returns the parsed tool catalog from an endpoint's `llm_tools_config`, used by the tool picker in the Create Gateway modal.

### E. Client-Facing Usage Stats API

Clients can query their own gateway usage statistics using the shared secret they already have. This enables them to build a usage dashboard within their own application.

#### Endpoint

```
GET /api/v1/client-api/:clientId/usage
```

#### Authentication

The client authenticates by sending their shared secret (or today's/yesterday's rolling token) in one of three ways:
- **Header (recommended):** `X-Client-Secret: <shared_secret>`
- **Bearer:** `Authorization: Bearer <shared_secret>`
- **Query param:** `?secret=<shared_secret>`

All three methods accept either the raw shared secret or a rolling token. Yesterday's rolling token is also accepted as a grace window for timezone edge cases.

#### Query Parameters

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `days` | 30 | 90 | Number of days to look back |
| `recent` | 25 | 100 | Max recent request log entries to return |

#### Response Fields

```json
{
  "success": true,
  "client_id": "acme-corp",
  "client_name": "Acme Corporation",
  "status": "active",
  "total_requests": 1247,
  "last_request_at": "2026-03-22T10:30:00.000Z",
  "period": { "from": "2026-02-20", "to": "2026-03-22" },
  "period_total": 342,
  "period_success": 330,
  "period_errors": 12,
  "avg_response_ms": 245,
  "daily_breakdown": [
    { "date": "2026-03-22", "requests": 18, "success": 17, "errors": 1, "avg_ms": 210 }
  ],
  "action_breakdown": [
    { "action": "getCustomerInfo", "requests": 200, "success": 198, "errors": 2, "avg_ms": 180, "last_called": "2026-03-22T10:30:00.000Z" }
  ],
  "recent_requests": [
    { "action": "getCustomerInfo", "status_code": 200, "duration_ms": 152, "error_message": null, "created_at": "2026-03-22T10:30:00.000Z" }
  ]
}
```

#### Example: PHP (for the client's admin dashboard)

```php
$clientId = 'acme-corp';
$secret = getenv('SOFTAWARE_SECRET');

$ch = curl_init("https://api.softaware.net.za/api/v1/client-api/{$clientId}/usage?days=30");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Client-Secret: {$secret}"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = json_decode(curl_exec($ch), true);

// Display in their dashboard
echo "Total requests (30 days): " . $response['period_total'];
echo "Success rate: " . round($response['period_success'] / max($response['period_total'], 1) * 100) . "%";
echo "Avg response: " . $response['avg_response_ms'] . "ms";
```

#### Security Notes
- This endpoint is **read-only** — it only returns statistics, never modifies data.
- The shared secret already exists on the client's server (used for API auth). No new credentials needed.
- Rate limited like all gateway endpoints (default 60 rpm).

---

## 5. Pro Trial System — Complete Technical Specification

### Design Principle
The Pro trial is not a lightweight preview — it is the **full Pro package assigned to a contact**, but with resource limits capped at the **Free tier** for the duration of the trial. This means the client can see the Pro dashboard, experience the Pro UI, and use all tools at full capability — but they are resource-capped as if they were on the Free plan. The moment billing is activated, limits instantly upgrade to full Pro.

### Two Trial Layers (How They Coexist)

The platform has two parallel trial mechanisms. Both are active and serve different audiences:

| Layer | Table | Trigger | Tier During Trial | Duration | Expiry Enforcement |
|-------|-------|---------|-------------------|----------|--------------------|
| **User-level** | `users` | Self-service via `/api/billing/start-trial` or `/register?trial=true` | Starter (full limits) | 14 days | `trialEnforcer.ts` hourly sweep |
| **Contact-level (Pro)** | `contact_packages` | Admin assigns via `/admin/packages/:id/assign-contact` with `status: 'TRIAL'` | **Free tier limits** | Set by `current_period_end` | `trialEnforcer.ts` hourly sweep |

**The Pro trial uses the contact-level layer.** When a Soft Aware staff member onboards an enterprise client for a demo, they assign the Pro (or Enterprise) package to the client's contact with `status = 'TRIAL'`. The client sees "Pro" branding in the portal, but every enforcement check returns **Free tier limits**.

### Limit Degradation During Trial

When `contact_packages.status = 'TRIAL'`, the function `resolveTrialLimits()` in `packageResolver.ts` intervenes:

```
resolveTrialLimits(packageStatus, packageType, fullLimits)
  → if packageStatus !== 'TRIAL'  → return fullLimits (no change)
  → if packageType is ENTERPRISE or STAFF → return fullLimits (exempt)
  → else → return getLimitsForTier('free')
```

This means during a Pro trial:

| Resource | Pro (Full) | Pro Trial (Actual) | Notes |
|----------|------------|-------------------|-------|
| Sites | 10 | **1** | Free tier limit |
| Widgets | 10 | **1** | Free tier limit |
| Actions/month | 5,000 | **500** | Free tier limit |
| Knowledge pages | 500 | **50** | Free tier limit |
| Enterprise endpoints | 2 | **0** | Free tier limit |
| Client API gateways | 2 | **0** | Free tier limit |
| Storage | 200 MB | **5 MB** | Free tier limit |
| Watermark removal | ✅ | **❌** | Free tier limit |
| Auto-recharge | ✅ | **❌** | Free tier limit |
| E-commerce site type | ✅ | **❌** (`single_page` only) | Free tier limit |
| Vision/Files | ❌ | **❌** | Pro doesn't have vision; requires Advanced+ |
| Tool capability | Full (all tools) | **Full (all tools)** | No tool-level restriction |

**Enterprise and Staff packages are exempt** — their trials always get full limits. This is intentional: enterprise demos need the full feature set to close.

### Where Free Limits Are Enforced (Resolution Chain)

Every enforcement point feeds through the same resolution chain, so the trial degradation is universal:

```
User Request
  ↓
requireActivePackageAccess (packageAccess.ts)
  → getActivePackageForUser(userId)
    → resolves user → contact_id → contact_packages (status IN 'ACTIVE','TRIAL')
    → packageRowToTierLimits(rawPackage) → fullLimits
    → resolveTrialLimits('TRIAL', 'CONSUMER', fullLimits) → FREE LIMITS ✓
  ↓
enforceEndpointLimit / enforceGatewayLimit / enforceKnowledgePageLimit (packageEnforcement.ts)
  → resolveContactPackage(contactId)
    → same join, same row
    → resolveTrialLimits('TRIAL', 'CONSUMER', fullLimits) → FREE LIMITS ✓
  ↓
checkVisionAccess (packageEnforcement.ts)
  → resolveContactPackage(contactId)
    → returns limits with hasVision flag
    → Free tier → hasVision: false → BLOCKED ✓
```

Enforcement middleware that checks these limits:
- **`enforceEndpointLimit`** → `max_enterprise_endpoints = 0` during trial → blocked
- **`enforceGatewayLimit`** → `max_enterprise_endpoints = 0` during trial → blocked
- **`enforceKnowledgePageLimit`** → `maxKnowledgePages = 50` during trial
- **`maxActionsPerMonth`** → 500 during trial (via `usageTracking.ts`)
- **`checkVisionAccess`** → `hasVision = false` during trial (Free tier) → blocked
- **Site/widget creation guards** → 1 site, 1 widget during trial

### Trial Lifecycle

```
1. ONBOARDING
   Staff assigns Pro package to contact:
   POST /admin/packages/8/assign-contact
   { contactId: 68, status: "TRIAL", billingCycle: "MONTHLY" }
   
   → contact_packages row created:
     status = 'TRIAL'
     current_period_start = NOW()
     current_period_end = NOW() + 30 days

2. DURING TRIAL
   Client logs in → sees "Pro" branding, Pro badge in portal
   All limit checks → resolveTrialLimits() → Free tier caps
   All API tools → full capability (read + write + action)
   Vision/file requests → blocked (hasVision: false at Free tier)
   Enterprise endpoints → blocked (max = 0 in Free tier)
   Resource limits → capped at Free tier (1 site, 1 widget, 500 actions)

3. CLIENT UPGRADES (Happy Path)
   Client subscribes via Yoco gateway
   → contact_packages.status updated to 'ACTIVE'
   → resolveTrialLimits() returns full Pro limits instantly
   → All 10 sites, 10 widgets, 5000 actions, etc. unlocked
   → Tools already have full capability — no tool changes needed
   → Vision still blocked on Pro (requires Advanced package)

4. TRIAL EXPIRES (No Payment)
   trialEnforcer.ts hourly sweep:
   → Finds contact_packages WHERE status='TRIAL' AND current_period_end < NOW()
   → Sets status = 'EXPIRED'
   → resolveContactPackage() / getActivePackageForUser() no longer match this row
   → Client loses all access (requireActivePackageAccess returns 403)
   
   Separately, user-level sweep:
   → Downgrades users.plan_type to 'free'
   → Freezes over-limit sites → 'locked_tier_limit'
   → Suspends over-limit widgets → 'suspended'
```

### Trial State in the Database

**`contact_packages` table:**
```sql
-- Active trial (limits degraded to Free)
SELECT status, current_period_start, current_period_end
FROM contact_packages WHERE contact_id = 68;
-- status = 'TRIAL', current_period_end = '2026-04-21 00:00:00'

-- After expiry (no access)
-- status = 'EXPIRED' (set by trialEnforcer sweep)

-- After payment (full Pro limits)
-- status = 'ACTIVE'
```

**`users` table (parallel):**
```sql
-- Self-service trial (user-level, Starter tier)
SELECT plan_type, has_used_trial, trial_expires_at FROM users WHERE id = ?;
-- plan_type = 'starter', has_used_trial = 1, trial_expires_at = '2026-04-05'

-- After expiry
-- plan_type = 'free', trial_expires_at = NULL, has_used_trial = 1 (permanent)
```

### Preventing Re-Trials

| Level | Prevention | Bypass |
|-------|-----------|--------|
| User-level | `has_used_trial = TRUE` (permanent in `users` table) | None — cannot restart |
| Contact-level | Admin-controlled — staff can re-assign TRIAL at any time | Staff can reset by updating `contact_packages.status = 'TRIAL'` and setting a new `current_period_end` |

### Files Involved

| File | Role |
|------|------|
| `config/tiers.ts` | `TierLimits` interface with `hasVision: boolean`; `TIER_LIMITS` per tier (free/starter/pro = `hasVision: false`, advanced/enterprise = `hasVision: true`) |
| `services/packageResolver.ts` | `resolveTrialLimits()` — degrades TRIAL to Free limits; `packageRowToTierLimits()` maps `has_vision` DB field |
| `middleware/packageEnforcement.ts` | `resolveContactPackage()` — applies trial degradation; `checkVisionAccess()` — validates hasVision flag; `enforceVisionAccess` — Express middleware for vision gate |
| `middleware/packageAccess.ts` | `requireActivePackageAccess()` — gates all authenticated routes |
| `services/trialEnforcer.ts` | `sweepExpiredContactTrials()` — expires TRIAL → EXPIRED on `contact_packages` |
| `routes/billing.ts` | `POST /start-trial` — user-level trial activation (Starter, 14 days) |
| `routes/adminPackages.ts` | `POST /:id/assign-contact` — staff assigns Pro with `status: 'TRIAL'` |
| `routes/assistants.ts` | Vision gate in chat handler — checks `checkVisionAccess()` before image processing |
| `services/mobileAIProcessor.ts` | Vision gate in mobile AI — checks `checkVisionAccess()` before image processing |
| `routes/enterpriseWebhook.ts` | Vision gate in enterprise endpoints — degrades to text-only if vision blocked; package-based (replaced legacy Kone hardcode) |
| `routes/adminClientApiConfigs.ts` | Gateway CRUD, `POST /import` (provisioning with security whitelist), `GET /export-template`, `GET /:id/export` |
| `routes/clientApiGateway.ts` | Runtime proxy — forwards tool calls to client API; validates against registered tools (security whitelist); `GET /:clientId/usage` — client-facing usage stats endpoint (authenticated via shared secret) |
| `services/clientApiGateway.ts` | `validateClientSecret()` — authenticates client by raw secret or rolling token; `getUsageStats()` — aggregates usage from `client_api_logs`; `recordRequest()` — logs every proxied request |
| `models/AdminAIModels.ts` | Frontend API: `importConfig()`, `getEndpointTools()`, `exportTemplate()` |
| `pages/admin/ClientApiConfigs.tsx` | Admin UI: Create Gateway modal with tool picker, export/import controls |
