# Yoco Payment Gateway — Integration Documentation

## Overview

Yoco is wired as the **primary credit-card payment gateway** for purchasing AI credit packages. It uses the [Yoco Checkout API](https://developer.yoco.com/api-reference/checkout-api/checkout/create-checkout) to create hosted checkout sessions and processes results via webhooks.

Currency: **ZAR (South African Rand)**  
Auth scheme: **Secret key in `X-Auth-Secret-Key` header**  
Checkout flow: **Server-side checkout creation → redirect to Yoco-hosted page → webhook callback**

---

## Files Involved

| File | Role |
|------|------|
| `src/services/payment.ts` | Core integration — checkout creation, webhook processing, signature verification |
| `src/services/credentialVault.ts` | Retrieves Yoco credentials from DB (`credentials` table) with env fallback |
| `src/routes/credits.ts` | Exposes `/credits/purchase` (initiates checkout) and `/credits/webhook/yoco` (receives callbacks) |
| `src/routes/adminConfig.ts` | Admin endpoint to check Yoco configuration status and test API connectivity |
| `src/routes/adminPackages.ts` | Admin CRUD for packages; `contact_packages.payment_provider` can be `'YOCO'` |
| `src/services/packages.ts` | Package/subscription model — `ContactPackage.payment_provider` enum includes `'YOCO'` |
| `src/services/credits.ts` | `addCredits()` — called after successful Yoco payment to allocate credits |
| `src/db/mysql.ts` | TypeScript interfaces — `credit_transactions`, `Subscription`, `Payment` all include `'YOCO'` in their provider enums |
| `src/db/migrations/023_packages_system.ts` | DB migration — `contact_packages.payment_provider ENUM('PAYFAST','YOCO','MANUAL')` |

---

## Credential Management

Yoco credentials are retrieved via the **Credential Vault** (`src/services/credentialVault.ts`), which checks the `credentials` database table first and falls back to environment variables.

### `getYocoConfig()` — credentialVault.ts

```
DB lookup:   credentials table WHERE service_name = 'YOCO' AND is_active = 1
             → credential_value  = secret key (AES-256-GCM encrypted)
             → additional_data   = { "webhook_secret": "<encrypted>" }

Env fallback: YOCO_SECRET_KEY       → secret key
              YOCO_WEBHOOK_SECRET   → webhook signing secret
```

**Returns:**
```typescript
{
  secretKey: string;      // Used in X-Auth-Secret-Key header
  webhookSecret: string;  // Used for HMAC-SHA256 webhook signature verification
}
```

**Cache:** 5-minute in-memory TTL cache. Call `invalidateCache('YOCO')` after credential rotation.

### Environment Variables (fallback / admin status display)

| Variable | Purpose | Used In |
|----------|---------|---------|
| `YOCO_SECRET_KEY` | API secret key | `credentialVault.ts`, `adminConfig.ts` |
| `YOCO_PUBLIC_KEY` | Public key (status display only) | `adminConfig.ts` |
| `YOCO_WEBHOOK_SECRET` | HMAC signing secret for webhooks | `credentialVault.ts` |
| `YOCO_TEST_MODE` | Test mode flag (status display only) | `adminConfig.ts` |
| `FRONTEND_URL` | Used to build `success_url` / `cancel_url` | `payment.ts` |

---

## Checkout Flow

### Step 1: Client initiates purchase

**Endpoint:** `POST /v1/credits/purchase`  
**Auth:** API key (`requireApiKey` middleware)  
**Router:** `src/routes/credits.ts`

**Request body** (validated with Zod):
```json
{
  "packageId": "string",
  "paymentMethod": "YOCO",
  "returnUrl": "https://example.com/success",   // optional
  "cancelUrl": "https://example.com/cancel"      // optional
}
```

**What happens:**
1. Resolves user → team via `team_members` table
2. Validates the `credit_packages` record exists
3. Calls `createPayment()` from `src/services/payment.ts` with `provider: 'YOCO'`

### Step 2: Backend creates Yoco checkout

**Function:** `createYocoPayment()` in `src/services/payment.ts`

**Yoco API call:**
```
POST https://online.yoco.com/v1/checkouts
Headers:
  Content-Type: application/json
  X-Auth-Secret-Key: <secretKey from vault>
```

**Request payload:**
```json
{
  "amount": 50000,                    // amount in ZAR cents (e.g. R500.00 = 50000)
  "currency": "ZAR",
  "description": "Starter Credits (10,000 credits)",
  "metadata": {
    "teamId": "abc-123",
    "packageId": "pkg-456",
    "teamName": "Acme Corp",
    "credits": 10000,
    "userId": "user-789"
  },
  "success_url": "https://app.example.com/portal/credits?success=true",
  "cancel_url": "https://app.example.com/portal/credits?cancelled=true",
  "email": "user@example.com",       // optional, from team creator
  "name": "user"                      // optional, derived from email
}
```

**Success response from Yoco:**
```json
{
  "id": "checkout_abc123",
  "redirectUrl": "https://payments.yoco.com/...",
  "status": "...",
  "amount": 50000,
  "currency": "ZAR",
  "metadata": { ... },
  "created_at": "2026-03-13T..."
}
```

**Returned to client:**
```json
{
  "success": true,
  "paymentUrl": "https://payments.yoco.com/...",   // redirect user here
  "paymentId": "checkout_abc123",
  "package": {
    "id": "pkg-456",
    "name": "Starter",
    "credits": 10000,
    "price": 50000,
    "formattedPrice": "R500.00"
  }
}
```

### Step 3: User completes payment on Yoco-hosted page

The user is redirected to `paymentUrl`. After payment:
- **Success** → redirected to `success_url` (`/portal/credits?success=true`)
- **Cancel** → redirected to `cancel_url` (`/portal/credits?cancelled=true`)

### Step 4: Yoco sends webhook

**Endpoint:** `POST /v1/credits/webhook/yoco`  
**Auth:** None (public endpoint) — verified via HMAC signature  
**Router:** `src/routes/credits.ts`

**Webhook flow:**
1. Extract `x-yoco-signature` header
2. If signature present → verify with `verifyYocoWebhookSignature()`
3. If invalid → respond `401`
4. Call `processPaymentCallback('YOCO', body, signature)` → dispatches to `processYocoCallback()`

---

## Webhook Processing

### `processYocoCallback()` — payment.ts

**Signature verification:**
```
HMAC-SHA256(webhookSecret, JSON.stringify(payload)) → base64
Compare with x-yoco-signature header value
```

**Payload fields used:**
| Field | Purpose |
|-------|---------|
| `payload.metadata.teamId` | Target team for credit allocation |
| `payload.metadata.packageId` | Credit package to look up |
| `payload.status` | Must be `'successful'` or `'paid'` to process |
| `payload.amount` | Amount in cents — verified against package price (±1 cent tolerance) |
| `payload.id` | Yoco checkout ID — used as `externalPaymentId` for idempotency |

**Processing steps:**
1. Verify HMAC signature (if webhook secret configured)
2. Check `status === 'successful' || status === 'paid'`
3. Extract `teamId` and `packageId` from `metadata`
4. Look up `credit_packages` by `packageId`
5. Verify `amount` matches `package.price` (±1 cent)
6. **Idempotency check:** Query `credit_transactions WHERE externalPaymentId = ?` — skip if already processed
7. Call `addCredits(teamId, totalCredits, 'PURCHASE', { paymentProvider: 'YOCO', externalPaymentId })` 
8. Return `{ success: true, creditsAdded: N }`

**Credits added:** `package.credits + package.bonusCredits`

---

## Signature Verification

### `verifyYocoWebhookSignature()` — payment.ts (exported)

```typescript
const hmac = crypto
  .createHmac('sha256', webhookSecret)   // from credentialVault
  .update(JSON.stringify(payload))
  .digest('base64');

return hmac === signature;  // signature from x-yoco-signature header
```

If `webhookSecret` is not configured, verification is skipped with a warning log.

---

## Admin Configuration Endpoints

### GET `/v1/admin/config/payment-gateways`

**Auth:** JWT + admin role  
**Returns Yoco status:**
```json
{
  "provider": "YOCO",
  "name": "Yoco",
  "enabled": true,                    // based on YOCO_SECRET_KEY env var presence
  "configured": true,
  "settings": {
    "hasSecretKey": true,
    "hasPublicKey": false,
    "hasWebhookSecret": true,
    "testMode": false
  }
}
```

### POST `/v1/admin/config/payment-gateways/test`

**Auth:** JWT + admin role  
**Body:** `{ "provider": "YOCO" }`  
**Tests connectivity** by sending an `OPTIONS` request to `https://payments.yoco.com/api/checkouts` with the secret key.  
Returns success if status is `200` or `405` (OPTIONS not allowed but connection valid).

---

## Database Schema

### `contact_packages` table (migration 023)

```sql
payment_provider  ENUM('PAYFAST','YOCO','MANUAL') DEFAULT 'MANUAL'
external_customer_id      VARCHAR(255) NULL
external_subscription_id  VARCHAR(255) NULL
```

### TypeScript Interfaces (mysql.ts)

```typescript
// credit_transactions
paymentProvider?: 'PAYFAST' | 'YOCO' | 'MANUAL';
externalPaymentId?: string;          // stores Yoco checkout ID

// Subscription
paymentProvider?: 'PAYFAST' | 'YOCO' | 'MANUAL';
externalCustomerId?: string;
externalSubscriptionId?: string;

// Payment
provider: 'PAYFAST' | 'YOCO' | 'MANUAL';
externalPaymentId?: string;
```

### `credentials` table (Credential Vault)

```
service_name      = 'YOCO'
credential_value  = <AES-256-GCM encrypted secret key>
additional_data   = { "webhook_secret": "<AES-256-GCM encrypted>" }
is_active         = 1
```

---

## Error Handling

| Scenario | Response | Code |
|----------|----------|------|
| Yoco not configured (no secret key) | `"Yoco not configured. Please contact admin."` | 400 |
| Yoco API returns non-2xx | `"Yoco payment failed: {status} {errorText}"` | 400 |
| Network error calling Yoco | `"Failed to create Yoco checkout. Please try again."` | 400 |
| Invalid webhook signature | `"Invalid signature"` | 401 |
| Payment status not `successful`/`paid` | `"Payment not successful. Status: {status}"` | 400 |
| Missing `teamId`/`packageId` in metadata | `"Missing required metadata (teamId, packageId)"` | 400 |
| Package not found | `"Credit package not found"` | 400 |
| Amount mismatch (>1 cent diff) | `"Payment amount does not match package price"` | 400 |
| Already processed (idempotent) | `{ success: true, creditsAdded: 0 }` | 200 |

---

## Sequence Diagram

```
┌──────────┐       ┌──────────────┐       ┌────────────┐       ┌──────────┐
│  Client   │       │   Backend    │       │  Yoco API  │       │    DB    │
└─────┬─────┘       └──────┬───────┘       └─────┬──────┘       └────┬─────┘
      │  POST /credits/     │                     │                   │
      │  purchase           │                     │                   │
      │  {packageId, YOCO}  │                     │                   │
      ├────────────────────►│                     │                   │
      │                     │  getYocoConfig()    │                   │
      │                     ├─────────────────────┼──────────────────►│
      │                     │  ◄── secretKey ─────┼───────────────────┤
      │                     │                     │                   │
      │                     │  POST /v1/checkouts │                   │
      │                     │  X-Auth-Secret-Key  │                   │
      │                     ├────────────────────►│                   │
      │                     │  ◄── {id, redirect} │                   │
      │                     │                     │                   │
      │  ◄── {paymentUrl}───┤                     │                   │
      │                     │                     │                   │
      │  redirect to Yoco ──┼────────────────────►│                   │
      │  hosted checkout    │                     │                   │
      │                     │                     │                   │
      │  ◄── redirect back  │                     │                   │
      │  (success/cancel)   │                     │                   │
      │                     │                     │                   │
      │                     │  POST /credits/     │                   │
      │                     │  webhook/yoco       │                   │
      │                     │  x-yoco-signature   │                   │
      │                     │◄────────────────────┤                   │
      │                     │                     │                   │
      │                     │  verify HMAC sig    │                   │
      │                     │  check status       │                   │
      │                     │  idempotency check  │                   │
      │                     ├─────────────────────┼──────────────────►│
      │                     │  addCredits()       │                   │
      │                     ├─────────────────────┼──────────────────►│
      │                     │                     │                   │
      │                     │  200 OK ───────────►│                   │
      │                     │                     │                   │
└─────┴─────┘       └──────┴───────┘       └─────┴──────┘       └────┴─────┘
```

---

## Key Design Decisions

1. **Credential Vault over env vars** — Secrets are stored encrypted (AES-256-GCM) in the DB with a 5-min cache. Env vars serve as migration-period fallback only.

2. **Metadata-driven webhook routing** — `teamId` and `packageId` are embedded in Yoco checkout metadata, so the webhook handler can match the payment to the correct team without session state.

3. **Idempotent credit allocation** — Before adding credits, the handler checks `credit_transactions.externalPaymentId` to prevent double-crediting from duplicate webhook deliveries.

4. **Amount verification** — Webhook amount is verified against `credit_packages.price` with a ±1 cent tolerance to guard against tampered metadata.

5. **No client-side Yoco SDK** — The integration is entirely server-side (checkout API), not inline/popup. The frontend simply redirects to the Yoco-hosted payment page.

6. **Signature verification is optional** — If `webhookSecret` is not configured, webhooks are still processed (with a warning). This allows initial setup without webhook signing.

---

## Related Documentation

- [Payments Module README](README.md) — high-level overview of both payment domains
- [Payments Routes Reference](ROUTES.md) — invoice payment endpoint details
- [Yoco Checkout API Docs](https://developer.yoco.com/api-reference/checkout-api/checkout/create-checkout)
- [Yoco Webhook Docs](https://developer.yoco.com/api-reference/webhooks/webhook-notifications)
