# Subscription Module - API Routes

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

The Subscription module exposes **30 API endpoints** across 4 route files:

| Route File | Base Path | Endpoints | Description |
|------------|-----------|-----------|-------------|
| subscription.ts | /api/subscriptions | 8 | Team subscription plans, trials, billing |
| subscriptionTiers.ts | /api/subscriptions | 6 | Widget tier management & usage |
| credits.ts | /api/credits | 10 | Credit packages, balance, purchases, webhooks |
| pricing.ts | /api/pricing | 6 | General pricing items (independent system) |

**Base URL:** `https://api.softaware.net.za/v1`

**Authentication:**
- 🔓 Public endpoints: Credit packages, pricing info
- 🔑 `requireAuth`: User JWT token (team subscription management)
- 🔑 `requireApiKey`: API key for desktop apps (credit balance/purchase)
- 🔒 `requireAdmin`: Admin-only endpoints

---

## 2. Endpoint Directory

### Subscription Plans & Trials

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /subscriptions/plans | None | Get all available subscription plans |
| GET | /subscriptions/current | JWT | Get current user's team subscription |
| POST | /subscriptions/start-trial | JWT | Start a trial subscription |
| POST | /subscriptions/change-plan | JWT | Change subscription tier/cycle |
| POST | /subscriptions/cancel | JWT | Cancel subscription |
| GET | /subscriptions/invoices | JWT | Get subscription invoices |
| GET | /subscriptions/admin/all | JWT + Admin | Admin: List all subscriptions |
| POST | /subscriptions/admin/seed-plans | JWT + Admin | Admin: Seed subscription plans |

### Widget Subscription Tiers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /subscriptions/current | JWT | Get widget client subscription tier |
| GET | /subscriptions/tiers | None | List all widget subscription tiers |
| POST | /subscriptions/:clientId/upgrade | JWT | Upgrade widget tier |
| PUT | /subscriptions/:clientId/config | JWT | Update widget tier config |
| GET | /subscriptions/:clientId/usage | JWT | Get widget usage stats |
| GET | /subscriptions/:clientId/leads | JWT | Get widget captured leads |

### AI Credits

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /credits/packages | None | List credit packages |
| GET | /credits/packages/:id | None | Get single credit package |
| GET | /credits/pricing | None | Get AI request pricing |
| GET | /credits/balance | API Key | Get team credit balance |
| POST | /credits/purchase | API Key | Purchase credits |
| GET | /credits/transactions | API Key | Get credit transaction history |
| GET | /credits/usage | API Key | Get credit usage statistics |
| POST | /credits/topup | JWT + Admin | Admin: Top up team credits |
| POST | /credits/webhook/payfast | None | PayFast payment webhook |
| POST | /credits/webhook/yoco | None | Yoco payment webhook |

### Pricing (General)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /pricing | JWT | List pricing items |
| GET | /pricing/:id | JWT | Get single pricing item |
| POST | /pricing | JWT | Create pricing item |
| PUT | /pricing/:id | JWT | Update pricing item |
| DELETE | /pricing/:id | JWT | Delete pricing item |
| POST | /pricing/import | JWT | Import pricing from CSV/JSON |

---

## 3. Subscription Plans Endpoints

### GET /api/subscriptions/plans
**Purpose:** Get all available subscription plans (PERSONAL, TEAM, ENTERPRISE)  
**Auth:** None (public)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/subscriptions/plans
```

**Response (200 OK):**
```json
{
  "plans": [
    {
      "id": "plan_personal_2024",
      "name": "Personal",
      "tier": "PERSONAL",
      "description": "For individual users and small projects",
      "priceMonthly": 25000,
      "priceAnnually": 270000,
      "priceMonthlyDisplay": "R250",
      "priceAnnuallyDisplay": "R2,700",
      "priceMonthlyFromAnnual": "R225",
      "trialDays": 14,
      "features": {
        "users": 1,
        "projects": 5,
        "storage": "10GB",
        "aiCredits": 1000
      }
    },
    {
      "id": "plan_team_2024",
      "name": "Team",
      "tier": "TEAM",
      "description": "For growing teams",
      "priceMonthly": 150000,
      "priceAnnually": 1620000,
      "priceMonthlyDisplay": "R1,500",
      "priceAnnuallyDisplay": "R16,200",
      "priceMonthlyFromAnnual": "R1,350",
      "trialDays": 14,
      "features": {
        "users": 10,
        "projects": 50,
        "storage": "100GB",
        "aiCredits": 10000
      }
    }
  ]
}
```

**Database Queries:**
```sql
SELECT * FROM subscription_plans WHERE active = 1 ORDER BY priceMonthly ASC
```

---

### GET /api/subscriptions/current
**Purpose:** Get the current user's team subscription  
**Auth:** JWT (requireAuth)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/subscriptions/current \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "subscription": {
    "id": "sub_abc123",
    "status": "ACTIVE",
    "effectiveStatus": "ACTIVE",
    "plan": {
      "id": "plan_team_2024",
      "name": "Team",
      "tier": "TEAM",
      "priceMonthlyDisplay": "R1,500",
      "priceAnnuallyDisplay": "R16,200"
    },
    "billingCycle": "monthly",
    "currentPeriodStart": "2026-02-04T00:00:00Z",
    "currentPeriodEnd": "2026-03-04T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "trialEndsAt": null,
    "createdAt": "2026-01-04T10:30:00Z"
  },
  "team": {
    "id": "team_xyz",
    "name": "Acme Corp"
  }
}
```

**Response (200 OK - No Subscription):**
```json
{
  "subscription": null,
  "status": "NO_SUBSCRIPTION",
  "team": {
    "id": "team_xyz",
    "name": "Acme Corp"
  }
}
```

**Error Responses:**
- `404 Not Found` - User has no team
- `401 Unauthorized` - Invalid/missing JWT

**Database Queries:**
```sql
-- Get user's team membership
SELECT tm.*, t.name as teamName 
FROM team_members tm 
JOIN teams t ON tm.teamId = t.id 
WHERE tm.userId = ? 
LIMIT 1

-- Get team subscription
SELECT s.*, sp.* 
FROM subscriptions s 
JOIN subscription_plans sp ON s.planId = sp.id 
WHERE s.teamId = ?
```

**Business Logic:**
- Checks if TRIAL status has expired and sets effectiveStatus to EXPIRED
- Formats prices in Rand with currency symbol

---

### POST /api/subscriptions/start-trial
**Purpose:** Start a trial subscription for a team  
**Auth:** JWT (requireAuth)

**Request Body:**
```json
{
  "tier": "TEAM"
}
```

**Request:**
```bash
curl -X POST https://api.softaware.net.za/v1/subscriptions/start-trial \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"tier":"TEAM"}'
```

**Response (201 Created):**
```json
{
  "message": "Trial started successfully",
  "subscription": {
    "id": "sub_trial_123",
    "status": "TRIAL",
    "plan": {
      "tier": "TEAM",
      "name": "Team",
      "priceMonthly": 150000
    },
    "billingCycle": "monthly",
    "trialEndsAt": "2026-03-18T00:00:00Z"
  },
  "trialEndsAt": "2026-03-18T00:00:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Team already has an active subscription
- `404 Not Found` - User has no team
- `401 Unauthorized` - Invalid/missing JWT

**Database Queries:**
```sql
-- Check existing subscription
SELECT * FROM subscriptions WHERE teamId = ?

-- Insert trial subscription
INSERT INTO subscriptions (id, teamId, planId, status, trialEndsAt, billingCycle, createdAt)
VALUES (?, ?, ?, 'TRIAL', DATE_ADD(NOW(), INTERVAL 14 DAY), 'monthly', NOW())
```

---

### POST /api/subscriptions/change-plan
**Purpose:** Change subscription tier or billing cycle  
**Auth:** JWT (requireAuth) + Team Admin role

**Request Body:**
```json
{
  "tier": "ENTERPRISE",
  "billingCycle": "annually"
}
```

**Request:**
```bash
curl -X POST https://api.softaware.net.za/v1/subscriptions/change-plan \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"tier":"ENTERPRISE","billingCycle":"annually"}'
```

**Response (200 OK):**
```json
{
  "message": "Plan changed successfully",
  "subscription": {
    "id": "sub_abc123",
    "status": "ACTIVE",
    "plan": {
      "tier": "ENTERPRISE",
      "name": "Enterprise"
    },
    "billingCycle": "annually",
    "currentPeriodEnd": "2027-03-04T00:00:00Z"
  }
}
```

**Error Responses:**
- `403 Forbidden` - User is not a team admin
- `404 Not Found` - User has no team or subscription not found
- `400 Bad Request` - Invalid tier or billing cycle

**Database Queries:**
```sql
-- Verify admin role
SELECT * FROM team_members WHERE userId = ? AND teamId = ? AND role = 'ADMIN'

-- Update subscription
UPDATE subscriptions 
SET planId = ?, billingCycle = ?, updatedAt = NOW()
WHERE teamId = ?
```

---

### POST /api/subscriptions/cancel
**Purpose:** Cancel subscription (access continues until period end)  
**Auth:** JWT (requireAuth) + Team Admin role

**Request:**
```bash
curl -X POST https://api.softaware.net.za/v1/subscriptions/cancel \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "message": "Subscription cancelled. Access will continue until end of billing period.",
  "subscription": {
    "id": "sub_abc123",
    "status": "ACTIVE",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2026-04-04T00:00:00Z"
  },
  "accessEndsAt": "2026-04-04T00:00:00Z"
}
```

**Error Responses:**
- `403 Forbidden` - User is not a team admin
- `404 Not Found` - User has no team or subscription

**Database Queries:**
```sql
UPDATE subscriptions 
SET cancelAtPeriodEnd = 1, updatedAt = NOW()
WHERE teamId = ?
```

---

### GET /api/subscriptions/invoices
**Purpose:** Get team's subscription invoices  
**Auth:** JWT (requireAuth)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/subscriptions/invoices \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "invoices": [
    {
      "id": "inv_202603_001",
      "invoiceNumber": "INV-2026-03-001",
      "description": "Team Plan - March 2026",
      "subtotal": "R1,304.35",
      "vatAmount": "R195.65",
      "total": "R1,500.00",
      "periodStart": "2026-03-04T00:00:00Z",
      "periodEnd": "2026-04-04T00:00:00Z",
      "dueDate": "2026-03-14T00:00:00Z",
      "paidAt": "2026-03-04T10:30:00Z",
      "status": "PAID",
      "pdfUrl": "https://api.softaware.net.za/invoices/inv_202603_001.pdf"
    }
  ]
}
```

**Database Queries:**
```sql
SELECT * FROM invoices WHERE subscriptionId = ? ORDER BY createdAt DESC
```

---

## 4. Credit System Endpoints

### GET /api/credits/packages
**Purpose:** List all available credit packages  
**Auth:** None (public)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/credits/packages
```

**Response (200 OK):**
```json
{
  "success": true,
  "packages": [
    {
      "id": "pkg_starter",
      "name": "Starter",
      "description": "Perfect for trying out AI features",
      "credits": 1000,
      "bonusCredits": 100,
      "totalCredits": 1100,
      "price": 1000,
      "formattedPrice": "R10.00",
      "discountPercent": 9,
      "featured": false
    },
    {
      "id": "pkg_pro",
      "name": "Professional",
      "description": "Best value for regular users",
      "credits": 10000,
      "bonusCredits": 2000,
      "totalCredits": 12000,
      "price": 10000,
      "formattedPrice": "R100.00",
      "discountPercent": 17,
      "featured": true
    }
  ]
}
```

**Database Queries:**
```sql
SELECT * FROM credit_packages WHERE active = 1 ORDER BY price ASC
```

---

### GET /api/credits/balance
**Purpose:** Get team's current credit balance  
**Auth:** API Key (requireApiKey)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/credits/balance \
  -H "X-API-Key: sk_live_abc123..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "balance": {
    "teamId": "team_xyz",
    "credits": 8450,
    "lastUpdated": "2026-03-04T14:22:00Z",
    "lastTransaction": {
      "type": "USAGE",
      "amount": -50,
      "description": "Code Agent Execute",
      "createdAt": "2026-03-04T14:22:00Z"
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - No team found for API key user
- `401 Unauthorized` - Invalid API key

**Database Queries:**
```sql
-- Get team from API key user
SELECT teamId FROM team_members WHERE userId = (
  SELECT userId FROM api_keys WHERE key_hash = SHA2(?, 256)
) LIMIT 1

-- Get credit balance
SELECT * FROM credit_balances WHERE teamId = ?

-- Get last transaction
SELECT * FROM credit_transactions 
WHERE teamId = ? 
ORDER BY createdAt DESC 
LIMIT 1
```

---

### POST /api/credits/purchase
**Purpose:** Purchase credit package via PayFast or Yoco  
**Auth:** API Key (requireApiKey)

**Request Body:**
```json
{
  "packageId": "pkg_pro",
  "paymentMethod": "YOCO",
  "returnUrl": "https://app.softaware.net.za/credits/success",
  "cancelUrl": "https://app.softaware.net.za/credits/cancel"
}
```

**Request:**
```bash
curl -X POST https://api.softaware.net.za/v1/credits/purchase \
  -H "X-API-Key: sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"packageId":"pkg_pro","paymentMethod":"YOCO"}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "transaction": {
    "id": "txn_abc123",
    "teamId": "team_xyz",
    "packageId": "pkg_pro",
    "credits": 10000,
    "bonusCredits": 2000,
    "totalCredits": 12000,
    "amount": 10000,
    "status": "PENDING",
    "paymentProvider": "YOCO"
  },
  "payment": {
    "provider": "YOCO",
    "checkoutUrl": "https://checkout.yoco.com/abc123...",
    "reference": "PAY_abc123"
  }
}
```

**Error Responses:**
- `404 Not Found` - Package not found or no team for API key
- `400 Bad Request` - Payment creation failed

**Database Queries:**
```sql
-- Get package
SELECT * FROM credit_packages WHERE id = ?

-- Create transaction record
INSERT INTO credit_transactions (id, teamId, type, amount, packageId, status, paymentProvider)
VALUES (?, ?, 'PURCHASE', ?, ?, 'PENDING', ?)

-- Create payment record (via payment service)
INSERT INTO payments (id, teamId, amount, provider, status, reference)
VALUES (?, ?, ?, ?, 'PENDING', ?)
```

---

### POST /api/credits/webhook/payfast
**Purpose:** PayFast payment notification webhook  
**Auth:** None (validated via PayFast signature)

**Request Body:**
```
m_payment_id=123456
pf_payment_id=789012
payment_status=COMPLETE
item_name=Professional Credits
amount_gross=100.00
amount_fee=2.50
amount_net=97.50
custom_str1=txn_abc123
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment processed"
}
```

**Business Logic:**
1. Validates PayFast signature
2. Verifies payment amounts match
3. Updates transaction status to COMPLETED
4. Adds credits to team balance
5. Sends email notification

---

### POST /api/credits/webhook/yoco
**Purpose:** Yoco payment notification webhook  
**Auth:** None (validated via Yoco signature)

**Request Body:**
```json
{
  "type": "payment.succeeded",
  "payload": {
    "id": "ch_abc123",
    "amount": 10000,
    "currency": "ZAR",
    "status": "successful",
    "metadata": {
      "transactionId": "txn_abc123"
    }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Webhook processed"
}
```

---

### GET /api/credits/transactions
**Purpose:** Get team's credit transaction history  
**Auth:** API Key (requireApiKey)

**Query Parameters:**
- `limit` (optional): Max results (1-100, default 50)
- `offset` (optional): Pagination offset (default 0)
- `type` (optional): Filter by type (BONUS, USAGE, PURCHASE)
- `startDate` (optional): ISO 8601 datetime
- `endDate` (optional): ISO 8601 datetime

**Request:**
```bash
curl -X GET "https://api.softaware.net.za/v1/credits/transactions?limit=10&type=USAGE" \
  -H "X-API-Key: sk_live_abc123..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "txn_001",
      "type": "USAGE",
      "amount": -50,
      "description": "Code Agent Execute - 1250 tokens",
      "requestType": "CODE_AGENT_EXECUTE",
      "metadata": {
        "tokens": 1250,
        "model": "claude-3-5-sonnet"
      },
      "createdAt": "2026-03-04T14:22:00Z"
    },
    {
      "id": "txn_002",
      "type": "PURCHASE",
      "amount": 12000,
      "description": "Professional Package Purchase",
      "packageId": "pkg_pro",
      "createdAt": "2026-03-04T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 47
  }
}
```

**Database Queries:**
```sql
SELECT * FROM credit_transactions
WHERE teamId = ?
  AND (? IS NULL OR type = ?)
  AND (? IS NULL OR createdAt >= ?)
  AND (? IS NULL OR createdAt <= ?)
ORDER BY createdAt DESC
LIMIT ? OFFSET ?
```

---

### GET /api/credits/usage
**Purpose:** Get credit usage statistics  
**Auth:** API Key (requireApiKey)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/credits/usage \
  -H "X-API-Key: sk_live_abc123..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "usage": {
    "today": 250,
    "thisWeek": 1420,
    "thisMonth": 5780,
    "byRequestType": {
      "TEXT_CHAT": 3200,
      "CODE_AGENT_EXECUTE": 2100,
      "FILE_OPERATION": 480
    },
    "averagePerDay": 186,
    "projectedMonthlyUsage": 5580
  }
}
```

---

### POST /api/credits/topup
**Purpose:** Admin manual credit top-up  
**Auth:** JWT (requireAuth + requireAdmin)

**Request Body:**
```json
{
  "teamId": "team_xyz",
  "amount": 5000,
  "reason": "Compensation for service outage"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "balance": {
    "teamId": "team_xyz",
    "credits": 13450,
    "lastUpdated": "2026-03-04T15:30:00Z"
  },
  "transaction": {
    "id": "txn_admin_001",
    "type": "BONUS",
    "amount": 5000,
    "description": "Admin top-up: Compensation for service outage"
  }
}
```

---

## 5. Widget Subscription Tiers Endpoints

### GET /api/subscriptions/tiers
**Purpose:** List all widget subscription tiers  
**Auth:** None (public)

**Request:**
```bash
curl -X GET https://api.softaware.net.za/v1/subscriptions/tiers
```

**Response (200 OK):**
```json
{
  "success": true,
  "tiers": [
    {
      "id": "tier_free",
      "name": "Free",
      "price": 0,
      "features": {
        "messagesPerMonth": 100,
        "leadCapture": false,
        "customBranding": false,
        "toneControl": false
      }
    },
    {
      "id": "tier_starter",
      "name": "Starter",
      "price": 29900,
      "priceDisplay": "R299/month",
      "features": {
        "messagesPerMonth": 1000,
        "leadCapture": true,
        "customBranding": false,
        "toneControl": true
      }
    }
  ]
}
```

---

### POST /api/subscriptions/:clientId/upgrade
**Purpose:** Upgrade widget subscription tier  
**Auth:** JWT (requireAuth)

**Request Body:**
```json
{
  "tierId": "tier_advanced",
  "paymentMethod": "YOCO"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "subscription": {
    "clientId": "client_abc123",
    "tierId": "tier_advanced",
    "status": "ACTIVE",
    "currentPeriodEnd": "2026-04-04T00:00:00Z"
  },
  "payment": {
    "checkoutUrl": "https://checkout.yoco.com/..."
  }
}
```

---

## 6. Pricing Endpoints (General)

### GET /api/pricing
**Purpose:** List general pricing items (not AI credits)  
**Auth:** JWT (requireAuth)

**Query Parameters:**
- `page` (optional): Page number (default 1)
- `limit` (optional): Items per page (default 50)
- `category` (optional): Filter by category ID
- `search` (optional): Search item name/description

**Request:**
```bash
curl -X GET "https://api.softaware.net.za/v1/pricing?search=hosting&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "pricing_id": 42,
      "pricing_item": "Web Hosting - Shared",
      "pricing_note": "1GB SSD, 10GB bandwidth",
      "pricing_price": 9900,
      "pricing_unit": "month",
      "pricing_category_id": 5,
      "category_name": "Hosting Services"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 87
  }
}
```

---

### POST /api/pricing
**Purpose:** Create new pricing item  
**Auth:** JWT (requireAuth)

**Request Body:**
```json
{
  "pricing_item": "Premium Support",
  "pricing_note": "24/7 phone + email support",
  "pricing_price": 49900,
  "pricing_unit": "month",
  "pricing_category_id": 3
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "pricing_id": 123,
    "pricing_item": "Premium Support",
    "pricing_note": "24/7 phone + email support",
    "pricing_price": 49900,
    "pricing_unit": "month",
    "pricing_category_id": 3
  }
}
```

---

### PUT /api/pricing/:id
**Purpose:** Update pricing item  
**Auth:** JWT (requireAuth)

**Request:**
```bash
curl -X PUT https://api.softaware.net.za/v1/pricing/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"pricing_price":59900}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "pricing_id": 123,
    "pricing_price": 59900
  }
}
```

---

### DELETE /api/pricing/:id
**Purpose:** Delete pricing item  
**Auth:** JWT (requireAuth)

**Request:**
```bash
curl -X DELETE https://api.softaware.net.za/v1/pricing/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Pricing item deleted"
}
```

---

## 7. Error Responses

All endpoints follow standard HTTP error codes:

| Code | Meaning | Example Response |
|------|---------|------------------|
| 400 | Bad Request | `{"success":false,"error":"Invalid packageId"}` |
| 401 | Unauthorized | `{"success":false,"error":"Invalid or missing API key"}` |
| 403 | Forbidden | `{"success":false,"error":"Admin access required"}` |
| 404 | Not Found | `{"success":false,"error":"Credit package not found"}` |
| 500 | Internal Server Error | `{"success":false,"error":"Database connection failed"}` |

---

## 8. Rate Limiting

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Public (plans, packages) | 100 requests | per minute |
| Authenticated (JWT) | 1000 requests | per hour |
| API Key (balance, purchase) | 500 requests | per hour |
| Webhooks | No limit | N/A |

---

## 9. Security Notes

🔴 **CRITICAL:**
- All webhook endpoints MUST validate signatures (PayFast MD5, Yoco HMAC-SHA256)
- API keys are hashed with SHA-256 in database
- Payment amounts validated server-side (never trust client input)
- Team admin role verified before plan changes/cancellations

✅ **IMPLEMENTED:**
- JWT token expiry: 7 days
- API key rotation supported
- SQL injection protection via parameterized queries
- CORS restricted to `softaware.net.za` domains

---

*This document is auto-generated from source code and validated against running API tests.*
