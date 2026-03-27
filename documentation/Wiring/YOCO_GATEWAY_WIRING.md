# Yoco Payment Gateway — Full Wiring Specification

> **Status:** Specification — not yet implemented  
> **Author:** Auto-generated from codebase analysis + WooCommerce Yoco plugin study  
> **Date:** 2026-03-15  
> **Scope:** Wire Yoco Checkout API into every real purchase and upgrade path; add live/test mode toggle

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target State](#2-target-state)
3. [Live / Test Mode Architecture](#3-live--test-mode-architecture)
4. [Credential Vault Changes](#4-credential-vault-changes)
5. [Purchase Path: Package Subscription (New / Upgrade)](#5-purchase-path-package-subscription-new--upgrade)
6. [Purchase Path: Credit Top-Up](#6-purchase-path-credit-top-up)
7. [Purchase Path: Widget Tier Upgrade](#7-purchase-path-widget-tier-upgrade)
8. [Purchase Path: SiteBuilder Tier Upgrade](#8-purchase-path-sitebuilder-tier-upgrade)
9. [Purchase Path: Enterprise BYOE Package](#9-purchase-path-enterprise-byoe-package)
10. [Webhook Processing (Unified)](#10-webhook-processing-unified)
11. [Signature Verification (Svix Pattern)](#11-signature-verification-svix-pattern)
12. [Status Polling (Safety Net)](#12-status-polling-safety-net)
13. [Refund Flow](#13-refund-flow)
14. [Invoice Generation on Payment](#14-invoice-generation-on-payment)
15. [Admin Panel Changes](#15-admin-panel-changes)
16. [Settings UI Changes](#16-settings-ui-changes)
17. [Database Changes](#17-database-changes)
18. [Frontend Changes](#18-frontend-changes)
19. [File Inventory — What to Create / Modify](#19-file-inventory--what-to-create--modify)
20. [Implementation Order](#20-implementation-order)
21. [Testing Checklist](#21-testing-checklist)

---

## 1. Current State Analysis

### What exists today

| Component | Status | Notes |
|-----------|--------|-------|
| `services/payment.ts` | ✅ Yoco checkout creation | Legacy team-scoped, calls `https://online.yoco.com/v1/checkouts`, adds credits to legacy `credit_transactions` |
| `services/credentialVault.ts` → `getYocoConfig()` | ✅ Retrieves `secretKey` + `webhookSecret` | No live/test separation — single key pair |
| `routes/credits.ts` → `POST /credits/purchase` | ✅ Initiates Yoco checkout | Legacy path — uses API key auth, resolves user→team (not contact) |
| `routes/credits.ts` → `POST /credits/webhook/yoco` | ✅ Webhook endpoint | Signature check exists but uses old HMAC pattern (not Svix 3-header) |
| `routes/adminConfig.ts` → payment gateway status | ✅ Shows Yoco config status | Reads `YOCO_SECRET_KEY` env var; `testMode` flag exists but isn't used |
| `routes/stripe.ts` | ✅ Full Stripe Checkout integration | Contact-scoped, uses `packages` service, handles `checkout.session.completed` webhook |
| `services/packages.ts` → `assignPackageToContact()` | ✅ Assigns package + credits | Accepts `payment_provider: 'YOCO'`, creates `contact_packages` row |
| `services/subscription.ts` → `changePlan()` | ✅ Upgrades team subscription | **No payment collection** — changes plan immediately without checkout |
| `routes/subscriptionTiers.ts` → `POST /subscriptions/:clientId/upgrade` | ✅ Widget tier upgrade | **No payment collection** — just updates `widget_clients.subscription_tier` directly |
| `middleware/packages.ts` → `packageCreditMiddleware` | ✅ Credit enforcement | Contact-scoped, deducts from `contact_packages` |

### Gaps identified

| # | Gap | Impact |
|---|-----|--------|
| G1 | **No live/test mode** — single Yoco key, no toggle | Can't test payments safely |
| G2 | **No per-mode credentials** — vault stores one `YOCO` entry | Test key and live key can't coexist |
| G3 | **Legacy team-scoped checkout** — `payment.ts` writes to `credit_transactions`, not `package_transactions` | Credits go to wrong system |
| G4 | **`changePlan()` skips payment** — upgrades happen without checkout | Revenue leak |
| G5 | **Widget upgrade skips payment** — `subscriptions/:clientId/upgrade` just writes to DB | Revenue leak |
| G6 | **SiteBuilder upgrade has no purchase path** — tier resolved server-side but no paid upgrade | Revenue leak |
| G7 | **Enterprise BYOE packages have no self-serve purchase** — admin-only assignment | Limits growth |
| G8 | **Webhook uses old HMAC** — Yoco actually uses Svix 3-header pattern (`webhook_id`, `webhook_timestamp`, `webhook_signature`) | Signature verification may fail on real webhooks |
| G9 | **No status polling** — if webhook fails, payment is lost | Silent payment failures |
| G10 | **No refund flow** — no endpoint to request Yoco refund | Manual refunds only |
| G11 | **No invoice generation on payment** — successful Yoco payment doesn't create an `invoices` record | Accounting gap |
| G12 | **STRIPE in code but not in DB ENUM** — `contact_packages.payment_provider` is `ENUM('PAYFAST','YOCO','MANUAL')` but Stripe code writes `'STRIPE'` | Potential DB errors |

---

## 2. Target State

After wiring is complete:

```
User clicks "Subscribe" / "Upgrade" / "Top Up" / "Buy Credits"
       │
       ▼
Backend resolves mode (live|test) → picks correct Yoco key
       │
       ▼
Creates Yoco Checkout Session with metadata
  (contactId, packageId, action, billingCycle, userId, mode)
       │
       ▼
Returns redirectUrl → frontend redirects user to Yoco-hosted page
       │
       ▼
User completes payment on Yoco → redirected to success/cancel URL
       │
       ▼
Yoco sends webhook → POST /v1/webhooks/yoco
       │
       ▼
Verify Svix signature (3-header pattern) → route by payload.type
       │
       ▼
payment.succeeded → idempotency check → fulfil action:
  • Package subscription: assignPackageToContact() or changePlan()
  • Credit top-up: addCredits() to contact_packages
  • Widget upgrade: update widget_clients.subscription_tier
  • SiteBuilder upgrade: update generated_sites tier
  • Enterprise BYOE: assignPackageToContact() with BYOE package
       │
       ▼
Generate invoice → link to contact → email receipt
       │
       ▼
Status poller catches any missed webhooks (exponential backoff)
```

---

## 3. Live / Test Mode Architecture

### Design (learned from WooCommerce Yoco plugin)

The Yoco API uses **the same base URL** for both live and test modes. The mode is determined entirely by **which secret key** is used in the `Authorization` header. There are no separate API endpoints.

```
API Base URL (both modes): https://payments.yoco.com/api/checkouts
Live key prefix:           sk_live_...
Test key prefix:           sk_test_...
```

### System Setting

Add a `sys_settings` entry to control the mode:

| Key | Type | Default | Public | Description |
|-----|------|---------|--------|-------------|
| `yoco_mode` | `string` | `test` | `false` | Payment gateway mode: `live` or `test` |

### Runtime resolution

```typescript
// New function in credentialVault.ts
export async function getYocoConfigForMode(): Promise<YocoConfig> {
  const mode = await getSettingValue('yoco_mode') || 'test';  // default safe
  const serviceName = mode === 'live' ? 'YOCO_LIVE' : 'YOCO_TEST';
  const cred = await getCredential(serviceName);
  
  // Fallback to legacy single 'YOCO' entry
  if (!cred) {
    const legacy = await getCredential('YOCO');
    return {
      mode,
      secretKey: legacy?.value || '',
      webhookSecret: legacy?.data?.webhook_secret || '',
    };
  }
  
  return {
    mode: mode as 'live' | 'test',
    secretKey: cred.value,
    webhookSecret: cred.data?.webhook_secret || '',
  };
}
```

### Credential Vault Entries (per mode)

| `service_name` | `credential_value` | `additional_data` |
|---------------|--------------------|-------------------|
| `YOCO_LIVE` | `sk_live_...` (encrypted) | `{ "webhook_secret": "whsec_..." }` |
| `YOCO_TEST` | `sk_test_...` (encrypted) | `{ "webhook_secret": "whsec_..." }` |
| `YOCO` | (legacy, keep for backward compat) | (legacy) |

---

## 4. Credential Vault Changes

### File: `src/services/credentialVault.ts`

**Modify `getYocoConfig()`** → rename to `getYocoConfigLegacy()` (kept for backward compat)

**Add new function:**

```typescript
interface YocoConfig {
  mode: 'live' | 'test';
  secretKey: string;
  webhookSecret: string;
}

export async function getYocoActiveConfig(): Promise<YocoConfig | null> {
  // 1. Read mode from sys_settings
  const modeRow = await db.queryOne<any>(
    "SELECT `value` FROM sys_settings WHERE `key` = 'yoco_mode'",
  );
  const mode = (modeRow?.value === 'live') ? 'live' : 'test';

  // 2. Fetch mode-specific credential
  const serviceName = mode === 'live' ? 'YOCO_LIVE' : 'YOCO_TEST';
  const cred = await getCredential(serviceName);
  if (cred?.value) {
    return {
      mode,
      secretKey: cred.value,
      webhookSecret: cred.data?.webhook_secret || '',
    };
  }

  // 3. Fallback to legacy 'YOCO'
  const legacy = await getCredential('YOCO');
  if (legacy?.value) {
    return {
      mode,
      secretKey: legacy.value,
      webhookSecret: legacy.data?.webhook_secret || '',
    };
  }

  // 4. Env fallback
  const envKey = process.env.YOCO_SECRET_KEY;
  if (envKey) {
    return {
      mode,
      secretKey: envKey,
      webhookSecret: process.env.YOCO_WEBHOOK_SECRET || '',
    };
  }

  return null;
}
```

---

## 5. Purchase Path: Package Subscription (New / Upgrade)

### Current state
- `subscription.ts` → `changePlan()` changes the plan with **no payment**.
- `stripe.ts` → `POST /stripe/checkout` creates a Stripe session for package purchase.
- No equivalent Yoco checkout for package purchase exists.

### Wiring needed

**New endpoint:** `POST /v1/yoco/checkout`  
**Auth:** JWT (`requireAuth`)  
**File:** `src/routes/yoco.ts` (new)

```typescript
// Request body
{
  package_id: number;          // packages.id
  billing_cycle: 'MONTHLY' | 'ANNUALLY';
  action: 'SUBSCRIBE' | 'UPGRADE' | 'TOPUP';
  success_url?: string;
  cancel_url?: string;
}
```

**Flow:**
1. Resolve `userId` → `contactId` via `user_contact_link`
2. Load package from `packages` table
3. Determine price: `billing_cycle === 'ANNUALLY' ? pkg.price_annually : pkg.price_monthly`
4. Call `getYocoActiveConfig()` → get mode-aware secret key
5. Build Yoco checkout payload (see [Checkout Payload](#checkout-payload-structure))
6. POST to `https://payments.yoco.com/api/checkouts`
7. Store pending checkout: insert into `yoco_checkouts` table (new)
8. Return `{ session_id, url: checkout.redirectUrl }`

### Checkout payload structure

```typescript
interface YocoCheckoutPayload {
  amount: number;               // ZAR cents (integer)
  currency: 'ZAR';
  successUrl: string;           // https://mcp.softaware.net.za/billing?yoco_checkout_id={id}
  cancelUrl: string;            // https://mcp.softaware.net.za/billing?cancelled=true
  failureUrl: string;           // https://mcp.softaware.net.za/billing?failed=true
  metadata: {
    softaware_contact_id: string;
    softaware_user_id: string;
    softaware_package_id: string;
    softaware_action: 'SUBSCRIBE' | 'UPGRADE' | 'TOPUP' | 'WIDGET_UPGRADE' | 'SITE_UPGRADE' | 'ENTERPRISE';
    softaware_billing_cycle: string;
    softaware_mode: 'live' | 'test';
    // Action-specific (optional)
    softaware_widget_client_id?: string;
    softaware_site_id?: string;
    softaware_target_tier?: string;
  };
  // Line items (optional but recommended)
  lineItems?: Array<{
    displayName: string;
    quantity: number;
    pricingDetails: {
      price: number;            // ZAR cents
      taxAmount: number;
    };
  }>;
}
```

**Headers:**
```
POST https://payments.yoco.com/api/checkouts
Content-Type: application/json
Authorization: Bearer <secretKey>
```

> **Note:** The WooCommerce plugin uses `X-Auth-Secret-Key` header in older code, but the current Yoco API docs and WooCommerce plugin v3+ use standard `Authorization: Bearer` header. Our existing `payment.ts` uses `X-Auth-Secret-Key`. The new code should use `Authorization: Bearer` for forward compatibility.

---

## 6. Purchase Path: Credit Top-Up

### Current state
- `routes/credits.ts` → `POST /credits/purchase` with `paymentMethod: 'YOCO'` → calls `payment.ts` → legacy team-scoped flow.
- Credits land in `credit_transactions` (legacy), not `package_transactions` (new).

### Wiring needed

**Reuse:** `POST /v1/yoco/checkout` with `action: 'TOPUP'`

**Webhook fulfillment (action = TOPUP):**
1. Look up `contact_packages` for `contactId` where `status IN ('ACTIVE','TRIAL')`
2. Call `packageService.addCredits(contactPackageId, credits, 'PURCHASE', userId, description)`
3. Log `package_transactions` row with `type = 'PURCHASE'`

**Deprecation:** Mark `POST /credits/purchase` as deprecated. Keep it working but route through new Yoco service internally.

---

## 7. Purchase Path: Widget Tier Upgrade

### Current state
- `routes/subscriptionTiers.ts` → `POST /subscriptions/:clientId/upgrade` — directly updates `widget_clients.subscription_tier` with **no payment**.
- Tier prices exist in `subscription_tier_limits` table.

### Wiring needed

**New endpoint:** `POST /v1/yoco/checkout` with `action: 'WIDGET_UPGRADE'`

**Additional request fields:**
```json
{
  "action": "WIDGET_UPGRADE",
  "widget_client_id": "abc-123",
  "target_tier": "advanced",
  "package_id": null          // price resolved from subscription_tier_limits
}
```

**Price resolution:**
```sql
SELECT monthly_price FROM subscription_tier_limits WHERE tier = ?
```

**Webhook fulfillment (action = WIDGET_UPGRADE):**
1. Extract `widget_client_id` and `target_tier` from `metadata`
2. Verify ownership: `widget_clients.user_id = userId`
3. Update `widget_clients` row: `subscription_tier`, `monthly_price`, `billing_cycle_start/end`, reset `messages_this_cycle`
4. Deduct corresponding credits from `contact_packages` if the model is credit-based, OR treat this as a standalone subscription payment

**Existing endpoint modification:**
- `POST /subscriptions/:clientId/upgrade` should be kept for **admin overrides** only
- For user-facing upgrades, redirect through `POST /v1/yoco/checkout`

---

## 8. Purchase Path: SiteBuilder Tier Upgrade

### Current state
- Tier resolved server-side by `resolveUserTier()` from `contact_packages`
- No direct "upgrade site tier" purchase path
- Trial system: 14-day free trial with auto-downgrade

### Wiring needed

**New endpoint:** `POST /v1/yoco/checkout` with `action: 'SITE_UPGRADE'`

**Additional request fields:**
```json
{
  "action": "SITE_UPGRADE",
  "site_id": 42,
  "target_tier": "pro",
  "package_id": null          // price resolved from tier config
}
```

**Price resolution:** Map tier → package:
```
free     → no payment needed
starter  → Starter package (look up by slug)
pro      → Professional package
enterprise → Enterprise package
```

**Webhook fulfillment (action = SITE_UPGRADE):**
1. Assign the corresponding package to the contact via `assignPackageToContact()`
2. The next `resolveUserTier()` call will pick up the higher package → higher tier → more pages allowed

---

## 9. Purchase Path: Enterprise BYOE Package

### Current state
- Enterprise endpoints configured by admin only
- `contact_packages` assigned manually with `payment_provider = 'MANUAL'`
- No self-serve purchase path

### Wiring needed

**New endpoint:** `POST /v1/yoco/checkout` with `action: 'ENTERPRISE'`

**Webhook fulfillment (action = ENTERPRISE):**
1. `assignPackageToContact(contactId, packageId, { payment_provider: 'YOCO', billing_cycle })`
2. If contact already has the package, add credits via `addCredits()`

---

## 10. Webhook Processing (Unified)

### Current state
- `routes/credits.ts` → `POST /credits/webhook/yoco` — processes legacy `payment.ts` callbacks
- Uses `x-yoco-signature` single-header HMAC

### Wiring needed

**New unified webhook endpoint:** `POST /v1/webhooks/yoco`  
**Auth:** None (public) — verified via Svix signature  
**File:** `src/routes/yoco.ts`  
**Raw body required:** Must be registered with `express.raw({ type: 'application/json' })` before JSON parser

**Event routing:**

| Yoco Event | Handler | Action |
|------------|---------|--------|
| `payment.succeeded` | `handlePaymentSucceeded()` | Fulfil based on `metadata.softaware_action` |
| `refund.succeeded` | `handleRefundSucceeded()` | Reverse credits, update invoice, mark refunded |
| `refund.failed` | `handleRefundFailed()` | Log failure, notify admin |
| `payment.failed` | `handlePaymentFailed()` | Update `yoco_checkouts` status, notify user |

**`handlePaymentSucceeded()` dispatcher:**

```typescript
async function handlePaymentSucceeded(payload: YocoWebhookPayload): Promise<void> {
  const meta = payload.metadata;
  const action = meta.softaware_action;

  // Idempotency: check yoco_checkouts.status !== 'completed'
  const existing = await db.queryOne(
    'SELECT id, status FROM yoco_checkouts WHERE checkout_id = ?',
    [payload.checkoutId]
  );
  if (existing?.status === 'completed') return; // already processed

  // Concurrency guard: per-checkout lock
  const lockKey = `yoco_processing_${payload.checkoutId}`;
  // ... (Redis SET NX or DB flag)

  switch (action) {
    case 'SUBSCRIBE':
    case 'UPGRADE':
      await fulfilPackageSubscription(meta);
      break;
    case 'TOPUP':
      await fulfilCreditTopUp(meta);
      break;
    case 'WIDGET_UPGRADE':
      await fulfilWidgetUpgrade(meta);
      break;
    case 'SITE_UPGRADE':
      await fulfilSiteUpgrade(meta);
      break;
    case 'ENTERPRISE':
      await fulfilEnterprise(meta);
      break;
    default:
      console.warn(`[Yoco] Unknown action: ${action}`);
  }

  // Mark checkout completed
  await db.execute(
    'UPDATE yoco_checkouts SET status = ?, payment_id = ?, completed_at = NOW() WHERE checkout_id = ?',
    ['completed', payload.paymentId, payload.checkoutId]
  );

  // Generate invoice
  await generatePaymentInvoice(meta, payload);
}
```

---

## 11. Signature Verification (Svix Pattern)

### Current state
The existing `verifyYocoWebhookSignature()` uses `x-yoco-signature` with a simple `HMAC-SHA256(JSON.stringify(body))` pattern.

### WooCommerce plugin pattern (correct)
Yoco uses the **Svix** webhook standard with 3 headers:

| Header | Purpose |
|--------|---------|
| `webhook-id` | Unique message ID for deduplication |
| `webhook-timestamp` | Unix seconds — reject if >5 min from now |
| `webhook-signature` | `v1,<base64(HMAC-SHA256(signing_content, decoded_secret))>` |

**Signing content:** `"{webhook-id}.{webhook-timestamp}.{rawBody}"`  
**Secret format:** `whsec_<base64-encoded-key>` — strip prefix, base64-decode to get raw bytes  
**Tolerance:** ±300 seconds (5 minutes)

### Implementation

**File:** `src/services/yocoWebhookVerifier.ts` (new)

```typescript
import crypto from 'crypto';

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

export function verifyYocoWebhook(
  rawBody: Buffer | string,
  headers: {
    'webhook-id': string;
    'webhook-timestamp': string;
    'webhook-signature': string;
  },
  secret: string  // "whsec_..." format
): { valid: boolean; error?: string } {
  const webhookId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatures = headers['webhook-signature'];

  if (!webhookId || !timestamp || !signatures) {
    return { valid: false, error: 'Missing required webhook headers' };
  }

  // Timestamp replay protection
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, error: 'Webhook timestamp outside tolerance' };
  }

  // Decode secret: strip "whsec_" prefix, base64-decode
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice(6) : secret,
    'base64'
  );

  // Build signing content
  const signingContent = `${webhookId}.${timestamp}.${rawBody}`;

  // Compute expected signature
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signingContent)
    .digest('base64');

  // Compare against all provided signatures (space-separated, "v1,<sig>" format)
  const providedSigs = signatures.split(' ');
  for (const sig of providedSigs) {
    const parts = sig.split(',');
    if (parts.length !== 2) continue;
    const [version, sigValue] = parts;
    if (version !== 'v1') continue;

    if (crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sigValue)
    )) {
      return { valid: true };
    }
  }

  return { valid: false, error: 'No matching signature found' };
}
```

---

## 12. Status Polling (Safety Net)

### Design (learned from WooCommerce plugin)

Webhooks can fail. A background poller provides a safety net.

**New table:** `yoco_checkouts` (tracks pending payments)

**Polling logic:**
- Cron job runs every **60 seconds**
- Selects checkouts where `status = 'pending'` AND `next_poll_at <= NOW()`
- GETs `https://payments.yoco.com/api/checkouts/{checkoutId}` with auth header
- If response `status === 'completed'` → process as if webhook arrived
- If `status === 'expired'` or `status === 'cancelled'` → mark as such
- Otherwise, increment `poll_count`, calculate next poll time with **cubic backoff**: $t = n^3$ minutes, capped at 7200 min
- After 30 attempts → give up, mark `status = 'abandoned'`

**Implementation:** Use `node-cron` or a `setInterval` in the app startup.

**File:** `src/services/yocoStatusPoller.ts` (new)

**Return-URL immediate check:**
When the user's browser returns to `successUrl`, the frontend calls `GET /v1/yoco/checkout/:checkoutId/status` which triggers an immediate poll for that specific checkout.

---

## 13. Refund Flow

### Design (learned from WooCommerce plugin)

**New endpoint:** `POST /v1/yoco/refund` (admin only)

```typescript
// Request
{
  checkout_id: string;
  amount?: number;       // partial refund in cents; omit for full refund
  reason?: string;
}
```

**Flow:**
1. Look up `yoco_checkouts` row for `checkout_id`
2. Use the **secret key for the mode the original checkout was created in** (from `yoco_checkouts.mode`)
3. POST to `https://payments.yoco.com/api/checkouts/{checkoutId}/refund`
4. Headers: `Authorization: Bearer <key>`, `Idempotency-Key: SHA256(paymentId + amount + refundedAmount)`
5. Body: `{ "amount": <cents> }`
6. On success → deduct credits from `contact_packages`, update invoice, log `package_transactions` with `type = 'REFUND'`

**Webhook handling:**
- `refund.succeeded` → verify not already processed → create refund record
- `refund.failed` → log and notify admin

---

## 14. Invoice Generation on Payment

### Current gap
Successful Yoco payments don't create `invoices` records. The invoices system is disconnected from the credit purchase system.

### Wiring needed

After `handlePaymentSucceeded()` completes the action:

1. Create `invoices` row:
   ```sql
   INSERT INTO invoices (contact_id, invoice_number, invoice_date, invoice_amount,
     vat_amount, invoice_status, paid, payment_method, notes, created_at)
   VALUES (?, ?, NOW(), ?, ?, 'Paid', 2, 'Yoco', ?, NOW())
   ```
2. Create `invoice_items` row(s) for the package/credits purchased
3. Create matching `payments` row linked to the invoice
4. **Invoice number**: Auto-generated `INV-NNNNN` (existing pattern from invoices module)

---

## 15. Admin Panel Changes

### Payment Gateway Settings Page

**Modify:** `src/routes/adminConfig.ts` → `GET /admin/config/payment-gateways`

Add to Yoco gateway object:
```json
{
  "provider": "YOCO",
  "name": "Yoco",
  "mode": "test",                        // from sys_settings.yoco_mode
  "enabled": true,
  "configured": true,
  "settings": {
    "mode": "test",
    "hasLiveSecretKey": true,             // credential YOCO_LIVE exists
    "hasTestSecretKey": true,             // credential YOCO_TEST exists
    "hasLiveWebhookSecret": true,
    "hasTestWebhookSecret": true,
    "webhookUrl": "https://api.softaware.net.za/v1/webhooks/yoco"
  }
}
```

**New endpoint:** `POST /admin/config/payment-gateways/yoco/mode`

```json
// Request
{ "mode": "live" | "test" }

// Action: UPDATE sys_settings SET value = ? WHERE key = 'yoco_mode'
// Invalidate credential vault cache
```

### Yoco Checkout History (admin)

**New endpoint:** `GET /admin/yoco/checkouts`

Returns paginated list from `yoco_checkouts` table with status, amount, contact, created/completed dates.

### Manual Retry

**New endpoint:** `POST /admin/yoco/checkouts/:id/retry-poll`

Triggers an immediate status poll for a stuck checkout.

---

## 16. Settings UI Changes

### Frontend: Admin → Settings → Payment Gateways

Add a Yoco configuration card:

```
┌─────────────────────────────────────────────────┐
│  🟢 Yoco Payment Gateway                        │
│                                                  │
│  Mode:  ○ Test  ● Live                          │
│                                                  │
│  Live Secret Key:    ●●●●●●●●●sk_live_***1234   │
│  Test Secret Key:    ●●●●●●●●●sk_test_***5678   │
│  Live Webhook Secret: Configured ✓               │
│  Test Webhook Secret: Configured ✓               │
│                                                  │
│  Webhook URL: https://api.softaware.net.za/      │
│               v1/webhooks/yoco       [Copy]       │
│                                                  │
│  [Test Connection]  [Save Mode]                  │
└─────────────────────────────────────────────────┘
```

The toggle writes to `sys_settings.yoco_mode` via `POST /admin/config/payment-gateways/yoco/mode`.

---

## 17. Database Changes

### New table: `yoco_checkouts`

```sql
CREATE TABLE IF NOT EXISTS yoco_checkouts (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  checkout_id       VARCHAR(255) NOT NULL UNIQUE     COMMENT 'Yoco checkout ID from API response',
  contact_id        INT NOT NULL,
  user_id           VARCHAR(36) NOT NULL,
  package_id        INT NULL,
  action            VARCHAR(50) NOT NULL             COMMENT 'SUBSCRIBE|UPGRADE|TOPUP|WIDGET_UPGRADE|SITE_UPGRADE|ENTERPRISE',
  amount            INT NOT NULL                     COMMENT 'ZAR cents',
  currency          VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  mode              ENUM('live','test') NOT NULL,
  status            ENUM('pending','completed','failed','expired','cancelled','abandoned') NOT NULL DEFAULT 'pending',
  payment_id        VARCHAR(255) NULL                COMMENT 'Yoco payment ID from webhook',
  metadata          JSON NULL                        COMMENT 'Full metadata sent to Yoco',
  redirect_url      TEXT NULL,
  success_url       TEXT NULL,
  cancel_url        TEXT NULL,
  failure_url       TEXT NULL,
  invoice_id        INT NULL                         COMMENT 'Generated invoice ID after payment',
  poll_count        INT NOT NULL DEFAULT 0,
  next_poll_at      DATETIME NULL,
  completed_at      DATETIME NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_yc_status (status),
  INDEX idx_yc_contact (contact_id),
  INDEX idx_yc_poll (status, next_poll_at),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### New table: `yoco_refunds`

```sql
CREATE TABLE IF NOT EXISTS yoco_refunds (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  checkout_id       VARCHAR(255) NOT NULL,
  refund_id         VARCHAR(255) NULL UNIQUE         COMMENT 'Yoco refund ID',
  contact_id        INT NOT NULL,
  amount            INT NOT NULL                     COMMENT 'Refund amount in ZAR cents',
  status            ENUM('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
  reason            VARCHAR(500) NULL,
  mode              ENUM('live','test') NOT NULL,
  idempotency_key   VARCHAR(255) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      DATETIME NULL,
  
  INDEX idx_yr_checkout (checkout_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Alter `contact_packages.payment_provider`

```sql
ALTER TABLE contact_packages 
  MODIFY COLUMN payment_provider ENUM('PAYFAST','YOCO','MANUAL','STRIPE') DEFAULT 'MANUAL';
```

### New `sys_settings` row

```sql
INSERT INTO sys_settings (`key`, `value`, `type`, `description`, `is_public`, `created_at`)
VALUES ('yoco_mode', 'test', 'string', 'Yoco payment gateway mode: live or test', 0, NOW())
ON DUPLICATE KEY UPDATE `value` = `value`;
```

### New `credentials` rows (admin must populate)

```sql
-- These should be inserted via the admin Credentials UI, not raw SQL
-- service_name: YOCO_LIVE, credential_value: <encrypted sk_live_...>
-- service_name: YOCO_TEST, credential_value: <encrypted sk_test_...>
```

---

## 18. Frontend Changes

### Billing Page (`/billing` or `/portal/credits`)

- **Package cards** → "Subscribe" / "Upgrade" button calls `POST /v1/yoco/checkout`
- **Credit top-up** → "Buy Credits" button calls `POST /v1/yoco/checkout` with `action: 'TOPUP'`
- On success redirect → page checks `?yoco_checkout_id=` param → calls `GET /v1/yoco/checkout/:id/status` to confirm
- Show toast: "Payment successful! Credits have been added."

### Widget Settings Page

- Tier upgrade buttons → call `POST /v1/yoco/checkout` with `action: 'WIDGET_UPGRADE'`
- Grey out current tier, highlight upgrade options with prices

### SiteBuilder Page

- When user hits page limit → show upgrade modal
- "Upgrade to Pro" button → `POST /v1/yoco/checkout` with `action: 'SITE_UPGRADE'`

### Admin Settings

- Payment gateway configuration card (see [Settings UI](#16-settings-ui-changes))
- Yoco checkout history table
- Refund action on payment records

---

## 19. File Inventory — What to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `src/routes/yoco.ts` | Unified Yoco router: checkout creation, webhook, status check, refund |
| `src/services/yocoCheckout.ts` | Checkout session creation, payload building, API calls |
| `src/services/yocoWebhookVerifier.ts` | Svix 3-header signature verification |
| `src/services/yocoWebhookHandler.ts` | Event dispatcher + fulfilment functions per action type |
| `src/services/yocoStatusPoller.ts` | Background cron poller for pending checkouts |
| `src/services/yocoRefund.ts` | Refund creation + idempotency key generation |
| `src/db/migrations/0XX_yoco_checkouts.ts` | Migration for `yoco_checkouts`, `yoco_refunds`, `sys_settings` seed, ENUM alter |

### Modified files

| File | Change |
|------|--------|
| `src/app.ts` | Mount `yocoRouter` at `/v1/yoco`, register raw body middleware for `/v1/webhooks/yoco`, start poller |
| `src/services/credentialVault.ts` | Add `getYocoActiveConfig()` with mode-aware credential lookup |
| `src/routes/adminConfig.ts` | Update `GET /payment-gateways` to show mode + per-mode key status; add `POST /payment-gateways/yoco/mode` |
| `src/routes/credits.ts` | Deprecation notice on `POST /credits/purchase`; redirect Yoco path to new service |
| `src/routes/subscriptionTiers.ts` | Add payment gate to `POST /subscriptions/:clientId/upgrade` (require checkout for non-admin) |
| `src/services/payment.ts` | Mark Yoco functions as `@deprecated`, delegate to new service |
| `src/services/packages.ts` | No changes needed — `assignPackageToContact()` already accepts `'YOCO'` |
| `src/db/mysql.ts` | Add `YocoCheckout` and `YocoRefund` interfaces; update `Payment.provider` union |
| `src/config/env.ts` | Add optional `YOCO_WEBHOOK_ENDPOINT_URL` for self-referencing webhook URL |

### Frontend files (to modify)

| File | Change |
|------|--------|
| Billing/Pricing page component | Add Yoco checkout buttons → redirect to `paymentUrl` |
| Widget settings component | Add tier upgrade buttons with payment gate |
| SiteBuilder component | Add upgrade modal with payment gate |
| Admin settings page | Add Yoco config card with mode toggle |
| Admin models/types | Add `YocoCheckout`, `YocoRefund` types |

---

## 20. Implementation Order

### Phase 1: Foundation (prerequisites)

| # | Task | Files | Depends |
|---|------|-------|---------|
| 1.1 | Create DB migration (tables + settings + ENUM alter) | `migrations/0XX_yoco_checkouts.ts` | — |
| 1.2 | Add `getYocoActiveConfig()` to credential vault | `credentialVault.ts` | — |
| 1.3 | Seed `YOCO_LIVE` and `YOCO_TEST` credentials (admin UI or migration) | — | 1.1 |
| 1.4 | Create `yocoWebhookVerifier.ts` (Svix pattern) | `services/yocoWebhookVerifier.ts` | — |

### Phase 2: Checkout + Webhook core

| # | Task | Files | Depends |
|---|------|-------|---------|
| 2.1 | Create `yocoCheckout.ts` service (build payload, call API, store in DB) | `services/yocoCheckout.ts` | 1.1, 1.2 |
| 2.2 | Create `yocoWebhookHandler.ts` (event dispatcher + fulfilment stubs) | `services/yocoWebhookHandler.ts` | 1.4, 2.1 |
| 2.3 | Create `yoco.ts` router (checkout endpoint + webhook endpoint) | `routes/yoco.ts` | 2.1, 2.2 |
| 2.4 | Mount in `app.ts` (raw body for webhook, JSON for rest) | `app.ts` | 2.3 |
| 2.5 | Admin mode toggle endpoint | `routes/adminConfig.ts` | 1.1 |

### Phase 3: Purchase paths

| # | Task | Files | Depends |
|---|------|-------|---------|
| 3.1 | Package subscription/upgrade fulfilment | `yocoWebhookHandler.ts` | 2.2 |
| 3.2 | Credit top-up fulfilment | `yocoWebhookHandler.ts` | 2.2 |
| 3.3 | Widget tier upgrade fulfilment | `yocoWebhookHandler.ts`, `subscriptionTiers.ts` | 2.2 |
| 3.4 | SiteBuilder upgrade fulfilment | `yocoWebhookHandler.ts` | 2.2 |
| 3.5 | Enterprise BYOE fulfilment | `yocoWebhookHandler.ts` | 2.2 |

### Phase 4: Safety net + refunds

| # | Task | Files | Depends |
|---|------|-------|---------|
| 4.1 | Status poller (cron job) | `services/yocoStatusPoller.ts`, `app.ts` | 2.1 |
| 4.2 | Return-URL status check endpoint | `routes/yoco.ts` | 2.1 |
| 4.3 | Refund service + admin endpoint | `services/yocoRefund.ts`, `routes/yoco.ts` | 2.1 |

### Phase 5: Invoice generation

| # | Task | Files | Depends |
|---|------|-------|---------|
| 5.1 | Auto-invoice on successful payment | `yocoWebhookHandler.ts`, `invoices` service | 3.x |

### Phase 6: Frontend

| # | Task | Files | Depends |
|---|------|-------|---------|
| 6.1 | Billing page — Yoco checkout buttons | Frontend | 2.3 |
| 6.2 | Widget upgrade modal with payment | Frontend | 3.3 |
| 6.3 | SiteBuilder upgrade modal | Frontend | 3.4 |
| 6.4 | Admin Yoco settings card (mode toggle) | Frontend | 2.5 |
| 6.5 | Admin checkout history table | Frontend | 2.3 |

### Phase 7: Deprecation + cleanup

| # | Task | Files | Depends |
|---|------|-------|---------|
| 7.1 | Deprecate `POST /credits/purchase` Yoco path | `routes/credits.ts` | 3.2 |
| 7.2 | Deprecate `payment.ts` Yoco functions | `services/payment.ts` | 2.1 |
| 7.3 | Update YOCO_GATEWAY.md documentation | `documentation/Payments/YOCO_GATEWAY.md` | All |

---

## 21. Testing Checklist

### Test mode (use `sk_test_...` key)

- [ ] `sys_settings.yoco_mode = 'test'` → checkout uses test key
- [ ] Create checkout for each action type → verify Yoco returns `redirectUrl`
- [ ] Simulate webhook → verify signature validation (Svix pattern)
- [ ] Simulate `payment.succeeded` → verify credits/package assigned
- [ ] Simulate `payment.succeeded` duplicate → verify idempotency (no double-credit)
- [ ] Simulate `payment.failed` → verify status updated, no credits
- [ ] Simulate webhook with wrong signature → verify 401 rejection
- [ ] Simulate webhook with expired timestamp → verify 401 rejection
- [ ] Status poller picks up pending checkout → polls Yoco API → marks completed
- [ ] Status poller respects exponential backoff (check `next_poll_at` values)
- [ ] Refund endpoint → verify Yoco API called with correct key + idempotency key
- [ ] Invoice generated after successful payment
- [ ] Admin can toggle mode to `live` via API

### Live mode validation

- [ ] Toggle `yoco_mode = 'live'` → verify live key used
- [ ] Create a real R2.00 checkout (Yoco minimum) → complete payment → verify credits
- [ ] Verify webhook arrives and is processed
- [ ] Verify invoice appears in invoices list
- [ ] Refund the R2.00 test payment → verify credits deducted

### Edge cases

- [ ] Checkout created in test mode, webhook arrives after switching to live mode → still uses test key (from `yoco_checkouts.mode`)
- [ ] Concurrent webhooks for same checkout → only one processes (concurrency guard)
- [ ] Network timeout calling Yoco API → graceful error returned to frontend
- [ ] Credential vault cache invalidated after mode switch
- [ ] Legacy `POST /credits/purchase` still works (backward compat)

---

## Appendix A: Yoco API Reference (Quick Reference)

| Operation | Method | URL | Auth Header |
|-----------|--------|-----|-------------|
| Create checkout | POST | `https://payments.yoco.com/api/checkouts` | `Authorization: Bearer <sk>` |
| Get checkout status | GET | `https://payments.yoco.com/api/checkouts/{id}` | `Authorization: Bearer <sk>` |
| Create refund | POST | `https://payments.yoco.com/api/checkouts/{id}/refund` | `Authorization: Bearer <sk>` |

**Checkout response:**
```json
{
  "id": "ch_abc123",
  "redirectUrl": "https://payments.yoco.com/pay/ch_abc123",
  "status": "created",
  "amount": 50000,
  "currency": "ZAR",
  "metadata": { ... }
}
```

**Webhook payload:**
```json
{
  "type": "payment.succeeded",
  "payload": {
    "id": "evt_xxx",
    "checkoutId": "ch_abc123",
    "paymentId": "pay_xxx",
    "amount": 50000,
    "currency": "ZAR",
    "status": "succeeded",
    "metadata": { ... }
  }
}
```

**Webhook headers:**
```
webhook-id: msg_xxx
webhook-timestamp: 1710500000
webhook-signature: v1,base64signature==
```

## Appendix B: Related Documentation

| Document | Location |
|----------|----------|
| Current Yoco gateway docs | `documentation/Payments/YOCO_GATEWAY.md` |
| Payments module overview | `documentation/Payments/README.md` |
| Subscription module | `documentation/Subscription/README.md` |
| Packages service | `documentation/Packages/` (if exists) |
| Admin module | `documentation/Admin/README.md` |
| Contacts module | `documentation/Contacts/README.md` |
| SiteBuilder module | `documentation/SiteBuilder/README.md` |
| Enterprise module | `documentation/Enterprise/README.md` |
| WooCommerce Yoco plugin (reference) | `/var/yoco-payment-gateway/` |
