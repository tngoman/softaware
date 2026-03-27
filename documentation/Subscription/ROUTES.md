# Subscription Routes Reference

> **v3.0.0 — Hybrid Package Catalog**
> Legacy credit endpoints remain removed. Package management endpoints have been restored.
> **Terminology:** "Actions" = billing metric (unified for chatbot + webhook). "System Actions" = technical AI function calls (email_capture, etc.).

---

## 1. Admin Packages — `routes/adminPackages.ts` (NEW v3.0.0)

Mounted at **`/api/v1/admin/packages`** via `app.ts`. Requires `requireAuth` + `requireAdmin`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/admin/packages` | ✅ Admin | List all packages with assignment counts |
| `GET`  | `/admin/packages/contacts` | ✅ Admin | List all contacts with their active package |
| `POST` | `/admin/packages` | ✅ Admin | Create a new package |
| `PUT`  | `/admin/packages/:id` | ✅ Admin | Update a package (syncs all linked contacts) |
| `POST` | `/admin/packages/:id/assign-contact` | ✅ Admin | Assign/reassign a contact to a package |

### `GET /api/v1/admin/packages`

Returns all packages with their active assignment count.

**Response (200):**
```json
{
  "success": true,
  "packages": [
    {
      "id": 1,
      "slug": "free",
      "name": "Free",
      "description": null,
      "packageType": "CONSUMER",
      "priceMonthly": 0,
      "priceAnnually": null,
      "featured": false,
      "ctaText": "Get Started",
      "isPublic": true,
      "displayOrder": 0,
      "limits": { "maxSites": 1, "maxWidgets": 1, ... },
      "features": [],
      "assignmentCount": 5,
      "raw": { "is_active": 1, "max_users": null, ... }
    }
  ]
}
```

### `GET /api/v1/admin/packages/contacts`

Returns all active contacts with their current package assignment (if any), linked user emails, and user count.

**Response (200):**
```json
{
  "success": true,
  "contacts": [
    {
      "contact_id": 1,
      "contact_name": "Acme Corp",
      "contact_person": "Jane Doe",
      "contact_email": "jane@acme.com",
      "contact_phone": "+27...",
      "contact_type": 1,
      "contact_package_id": 42,
      "package_status": "ACTIVE",
      "billing_cycle": "MONTHLY",
      "current_period_start": "2026-04-01T00:00:00.000Z",
      "current_period_end": "2026-05-01T00:00:00.000Z",
      "package_id": 3,
      "package_slug": "pro",
      "package_name": "Pro",
      "linked_user_emails": "jane@acme.com, john@acme.com",
      "linked_user_count": 2
    }
  ]
}
```

### `POST /api/v1/admin/packages`

Creates a new package. Validated by Zod `packageSchema`.

**Body (all fields):**
```json
{
  "slug": "pro",
  "name": "Pro",
  "description": "For growing agencies",
  "package_type": "CONSUMER",
  "price_monthly": 69900,
  "price_annually": null,
  "max_users": null,
  "max_agents": null,
  "max_widgets": 10,
  "max_landing_pages": null,
  "max_enterprise_endpoints": null,
  "features": ["10 Sites", "10 Widgets", "5,000 Actions/mo"],
  "is_active": true,
  "is_public": true,
  "display_order": 2,
  "featured": true,
  "cta_text": "Get Started",
  "gateway_plan_id": "PLN_pro_def456",
  "max_sites": 10,
  "max_collections_per_site": 15,
  "max_storage_bytes": 209715200,
  "max_actions_per_month": 5000,
  "allow_auto_recharge": true,
  "max_knowledge_pages": 500,
  "allowed_site_type": "ecommerce",
  "can_remove_watermark": true,
  "allowed_system_actions": ["email_capture", "payment_gateway_hook"],
  "has_custom_knowledge_categories": true,
  "has_omni_channel_endpoints": false,
  "ingestion_priority": 3
}
```

### `PUT /api/v1/admin/packages/:id`

Updates a package. After update, calls `syncUsersForContactPackage()` for all contacts with an active assignment to this package, updating their `users.plan_type` and `users.storage_limit_bytes`.

### `POST /api/v1/admin/packages/:id/assign-contact`

Assigns a contact to a package. If the contact has an existing active package assignment to a *different* package, it is cancelled first (status → 'CANCELLED'). If the same package was previously assigned, the row is reactivated.

**Body:**
```json
{
  "contactId": 5,
  "billingCycle": "MONTHLY",
  "status": "ACTIVE"
}
```

**Side effects:**
1. Cancels existing active assignments for the contact (different packages only)
2. Creates or reactivates `contact_packages` row with billing period (30 days for monthly, 365 for annually)
3. Calls `syncUsersForContactPackage()` — updates all users linked to the contact

---

## 2. Public Packages — `routes/publicPackages.ts` (NEW v3.0.0)

Mounted at **`/api/public`** via `app.ts`. No authentication required.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/api/public/packages` | ❌ | List active, public packages for pricing pages |

### `GET /api/public/packages`

Returns all packages where `is_active = 1 AND is_public = 1`, ordered by `display_order`. Each package is transformed via `formatPublicPackage()` which resolves tier limits and parses features JSON.

**Response (200):**
```json
{
  "success": true,
  "packages": [
    {
      "id": 1,
      "slug": "free",
      "name": "Free",
      "description": null,
      "packageType": "CONSUMER",
      "priceMonthly": 0,
      "priceAnnually": null,
      "featured": false,
      "ctaText": "Get Started",
      "isPublic": true,
      "displayOrder": 0,
      "limits": { ... },
      "features": ["1 Site", "1 Widget", "500 Actions/mo"]
    }
  ]
}
```

---

## 3. Billing — `routes/billing.ts`

Mounted at **`/api/v1/billing`** via `app.ts`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/billing/start-trial` | ✅ | Activate a 14-day Starter trial |
| `GET`  | `/billing/trial-status` | ✅ | Get current trial status |

### `POST /api/v1/billing/start-trial`

Activates a one-time 14-day Starter trial for the authenticated user.

**Guards:**
- `has_used_trial = TRUE` → 403 (permanent, cannot be reset)
- Already on a paid plan → 400

**Mutations:**
- `plan_type = 'starter'`
- `has_used_trial = TRUE`
- `trial_expires_at = NOW() + 14 days`

**Response (200):**
```json
{
  "success": true,
  "message": "Your 14-day Starter trial is now active!",
  "trial": {
    "tier": "starter",
    "tierName": "Starter",
    "expiresAt": "2026-04-10T12:00:00.000Z",
    "daysRemaining": 14,
    "limits": { ... }
  }
}
```

### `GET /api/v1/billing/trial-status`

Returns the current trial state for the authenticated user.

---

## 3b. Registration with Trial — `routes/auth.ts`

### `POST /api/v1/auth/register` (extended)

When `trial: true` in body:
1. User row is created normally
2. Immediately sets `plan_type = 'starter'`, `has_used_trial = TRUE`, `trial_expires_at = NOW() + 14 days`
3. Response includes `trialActivated: true`

---

## 3c. Dashboard Trial Metrics — `routes/dashboard.ts`

### `GET /api/v1/dashboard/metrics` (extended)

Returns trial state alongside existing stats:

**Computed fields:**
- `isOnTrial`: `trial_expires_at !== null && trial_expires_at > NOW()`
- `daysRemaining`: `Math.ceil((trial_expires_at - now) / 86400000)`, clamped to 0
- `canStartTrial`: `!has_used_trial && plan_type === 'free'`

---

## 4. Widget Tiers — `routes/subscriptionTiers.ts`

Mounted at **`/api/v1`** via `app.ts`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/subscriptions/current` | ✅ | List all widget clients with their tier limits |
| `GET`  | `/subscriptions/tiers` | ❌ | Get all 5 static tier definitions |
| `POST` | `/subscriptions/:clientId/upgrade` | ✅ | Upgrade a widget client to a new tier |
| `PUT`  | `/subscriptions/:clientId/config` | ✅ | Update widget config (tone, lead capture, model) |
| `GET`  | `/subscriptions/:clientId/usage` | ✅ | Get usage statistics for a widget client |
| `GET`  | `/subscriptions/:clientId/leads` | ✅ | Get captured leads for a widget client |

### `GET /api/v1/subscriptions/tiers`

Returns all 5 tiers from `config/tiers.ts`. **No database query.**

### `POST /api/v1/subscriptions/:clientId/upgrade`

Validates tier against `config/tiers.ts`, updates `widget_clients.subscription_tier`.

---

## 5. Yoco Payment Gateway — `routes/yoco.ts`

Mounted at **`/api/v1/yoco`** via `app.ts`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/yoco/checkout` | ✅ | Create a Yoco Checkout session |
| `GET`  | `/yoco/checkout/:checkoutId/status` | ✅ | Poll checkout status |
| `POST` | `/webhooks/yoco` | ❌ | Yoco Svix webhook receiver |

### `POST /api/v1/yoco/checkout`

Creates a Yoco Checkout session for plan upgrade. Prices in ZAR cents:
- `starter` → 34,900 (R349)
- `pro` → 69,900 (R699)
- `advanced` → 149,900 (R1,499)
- Enterprise → not self-serve (no checkout)

### `POST /api/v1/webhooks/yoco`

Receives Svix-signed webhooks from Yoco. On payment success, fulfils the checkout by upgrading `users.plan_type`.

---

## 6. Stripe (REMOVED) — `routes/stripe.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `ALL`  | `/stripe/*` | ❌ | Returns 410 Gone for all requests |

---

## 7. Team Subscriptions (Legacy) — `routes/subscription.ts`

Mounted at **`/api/subscriptions`** via `app.ts`. Used by the desktop app for team-scoped billing.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/plans` | ❌ | List all team subscription plans |
| `GET`  | `/current` | ✅ | Get current team subscription |
| `POST` | `/start-trial` | ✅ | Start a team trial |
| `POST` | `/change-plan` | ✅ | Change team subscription plan (admin only) |
| `POST` | `/cancel` | ✅ | Cancel team subscription (admin only) |
| `GET`  | `/invoices` | ✅ | List team invoices |
| `GET`  | `/admin/all` | ✅ | Admin: list all subscriptions |
| `POST` | `/admin/seed-plans` | ✅ | Admin: seed subscription plans |

> **Note:** Uses `subscription_plans` and `subscriptions` DB tables (team-scoped, separate from user-scoped `plan_type` / package catalog).
