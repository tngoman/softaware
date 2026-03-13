# Packages — Route & API Reference

## Route Registration

**Backend mount points**:
```
src/routes/adminPackages.ts  → /admin/packages    (requireAuth + requireAdmin)
src/routes/packages.ts       → /packages           (NO auth — public pricing)
```

**Registered in `src/app.ts`**:
```typescript
apiRouter.use('/admin/packages', adminPackagesRouter);   // Admin CRUD
apiRouter.use('/packages', packagesRouter);               // Public pricing
```

---

## Public Routes (packages.ts)

No authentication required. Intended for landing page and unauthenticated visitors.

### 1. GET `/packages/pricing`
**Purpose**: Return consumer and enterprise packages for the landing page pricing section  
**Auth**: None  

**Flow**:
1. Call `packageService.getPublicPricing()` — queries `packages WHERE is_active = 1 AND is_public = 1`
2. Split into `consumer` (package_type = CONSUMER) and `enterprise` (package_type = ENTERPRISE)
3. Each package run through `formatPublicPackage()` — parses `features` JSON, shapes output

**Response** `200`:
```json
{
  "success": true,
  "consumer": [
    {
      "id": 1, "slug": "free", "name": "Free", "description": "Get started with AI...",
      "package_type": "CONSUMER", "price_monthly": 0, "price_annually": null,
      "credits_included": 500, "features": ["1 AI assistant", "1 website widget", ...],
      "display_order": 1, "featured": false, "cta_text": "Get Started",
      "max_users": 1, "max_agents": 1, "max_widgets": 1, "max_landing_pages": 1, "max_enterprise_endpoints": 0
    }
  ],
  "enterprise": [ /* same shape */ ]
}
```

---

### 2. GET `/packages/list`
**Purpose**: All active public packages (all types)  
**Auth**: None  

**Flow**:
1. `packageService.getPublicPackages()` — `WHERE is_active = 1 AND is_public = 1 ORDER BY display_order`
2. Each package formatted via `formatPublicPackage()`

**Response** `200`:
```json
{ "success": true, "packages": [ /* PackagePublic[] */ ] }
```

---

### 3. GET `/packages/:slug`
**Purpose**: Single package by slug  
**Auth**: None  

**Flow**:
1. `packageService.getPackageBySlug(slug)`
2. If not found, inactive, or not public → `404`

**Response** `200`:
```json
{ "success": true, "package": { /* PackagePublic */ } }
```

---

## Admin Routes (adminPackages.ts)

All routes require `requireAuth` + `requireAdmin` middleware (applied via `adminPackagesRouter.use()`).

### 4. GET `/admin/packages`
**Purpose**: List all packages (including inactive, non-public)  
**Auth**: JWT + admin role  

**Response** `200`:
```json
{ "success": true, "packages": [ /* Package[] — full details */ ] }
```

---

### 5. GET `/admin/packages/:id`
**Purpose**: Single package by ID  
**Auth**: JWT + admin role  

**Response** `200`:
```json
{ "success": true, "package": { /* Package */ } }
```
**Error** `404`:
```json
{ "success": false, "error": "Package not found" }
```

---

### 6. POST `/admin/packages`
**Purpose**: Create a new package  
**Auth**: JWT + admin role  
**Body**: Validated with Zod `createPackageSchema`

**Request body**:
```json
{
  "slug": "premium",
  "name": "Premium",
  "description": "Premium package for power users",
  "package_type": "CONSUMER",
  "price_monthly": 79900,
  "price_annually": 799000,
  "credits_included": 50000,
  "max_users": 20,
  "max_agents": 20,
  "max_widgets": 20,
  "max_landing_pages": 50,
  "max_enterprise_endpoints": 5,
  "features": ["Up to 20 AI assistants", "50,000 credits/month"],
  "is_active": true,
  "is_public": true,
  "display_order": 4,
  "featured": false,
  "cta_text": "Get Started"
}
```

**Response** `201`:
```json
{ "success": true, "id": 8 }
```

---

### 7. PUT `/admin/packages/:id`
**Purpose**: Update an existing package  
**Auth**: JWT + admin role  
**Body**: Validated with Zod `updatePackageSchema` (partial)

**Response** `200`:
```json
{ "success": true, "message": "Package updated" }
```

---

### 8. DELETE `/admin/packages/:id`
**Purpose**: Delete a package  
**Auth**: JWT + admin role  

**Guard**: Checks for active subscriptions (status IN TRIAL, ACTIVE, PAST_DUE). If any exist, returns error.

**Response** `200`:
```json
{ "success": true, "message": "Package deleted" }
```
**Error** `400`:
```json
{ "success": false, "error": "Cannot delete package — 3 active subscription(s) exist" }
```

---

### 9. GET `/admin/packages/subscriptions/all`
**Purpose**: List all contact subscriptions across all packages  
**Auth**: JWT + admin role  
**Query**: `?status=ACTIVE` (optional filter)

**Response** `200`:
```json
{
  "success": true,
  "subscriptions": [
    {
      "id": 1, "contact_id": 1, "package_id": 7, "status": "ACTIVE",
      "billing_cycle": "NONE", "credits_balance": 100000, "credits_used": 0,
      "current_period_start": "2026-03-11 ...", "current_period_end": "2026-04-10 ...",
      "contact_name": "Soft Aware", "package_name": "Staff", "package_slug": "staff"
    }
  ]
}
```

---

### 10. GET `/admin/packages/subscriptions/:contactId`
**Purpose**: All subscriptions for a specific contact  
**Auth**: JWT + admin role  

**Response** `200`:
```json
{ "success": true, "subscriptions": [ /* ContactPackage[] */ ] }
```

---

### 11. POST `/admin/packages/subscriptions/assign`
**Purpose**: Assign a package to a contact  
**Auth**: JWT + admin role  
**Body**: Validated with Zod `assignPackageSchema`

**Request body**:
```json
{
  "contact_id": 5,
  "package_id": 2,
  "billing_cycle": "MONTHLY",
  "status": "ACTIVE"
}
```

**Flow**:
1. Validate with Zod
2. Call `packageService.assignPackageToContact()` — uses `INSERT ... ON DUPLICATE KEY UPDATE`
3. Initial credit allocation logged as `MONTHLY_ALLOCATION` transaction

**Response** `201`:
```json
{ "success": true, "id": 2 }
```

---

### 12. PATCH `/admin/packages/subscriptions/:id/status`
**Purpose**: Update subscription status (activate, cancel, suspend, etc.)  
**Auth**: JWT + admin role  
**Body**: `{ "status": "CANCELLED" }`

**Valid statuses**: TRIAL, ACTIVE, PAST_DUE, CANCELLED, EXPIRED, SUSPENDED

**Response** `200`:
```json
{ "success": true, "message": "Status updated" }
```

---

### 13. POST `/admin/packages/credits/adjust`
**Purpose**: Manually adjust credits on a subscription (add or deduct)  
**Auth**: JWT + admin role  
**Body**: Validated with Zod `adjustCreditsSchema`

**Request body**:
```json
{
  "contact_package_id": 1,
  "amount": 5000,
  "reason": "Bonus credits for early adopter"
}
```

**Flow**:
1. `packageService.adjustCredits()` — updates `credits_balance`, logs ADJUSTMENT transaction
2. Positive amounts add credits, negative amounts deduct
3. Balance cannot go below 0 (clamped with `Math.max(0, ...)`)

**Response** `200`:
```json
{ "success": true, "balance_after": 105000 }
```

---

### 14. GET `/admin/packages/transactions/all`
**Purpose**: Paginated transaction history across all contacts  
**Auth**: JWT + admin role  
**Query**: `?limit=50&offset=0&type=USAGE` (all optional)

**Response** `200`:
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1, "contact_package_id": 1, "contact_id": 1, "user_id": null,
      "type": "MONTHLY_ALLOCATION", "amount": 100000, "request_type": null,
      "description": "Initial Staff allocation: 100000 credits",
      "balance_after": 100000, "created_at": "2026-03-11T...",
      "contact_name": "Soft Aware", "package_name": "Staff"
    }
  ],
  "total": 1
}
```

---

### 15. GET `/admin/packages/transactions/:contactId`
**Purpose**: Transactions for a specific contact  
**Auth**: JWT + admin role  

**Response** `200`:
```json
{ "success": true, "transactions": [ /* PackageTransaction[] */ ], "total": 15 }
```

---

### 16. GET `/admin/packages/usage/:contactId`
**Purpose**: Usage breakdown stats for a contact (last N days)  
**Auth**: JWT + admin role  
**Query**: `?days=30` (default 30)

**Response** `200`:
```json
{
  "success": true,
  "usage": {
    "byType": [
      { "request_type": "TEXT_CHAT", "count": 45, "total_credits": 1250 }
    ],
    "daily": [
      { "date": "2026-03-10", "credits_used": 350, "requests": 12 }
    ]
  }
}
```

---

### 17. POST `/admin/packages/link-user`
**Purpose**: Link a user to a contact (company)  
**Auth**: JWT + admin role  
**Body**: Validated with Zod `linkUserSchema`

**Request body**:
```json
{
  "user_id": "abc-123-def",
  "contact_id": 1,
  "role": "STAFF"
}
```

**Response** `200`:
```json
{ "success": true, "message": "User linked to contact" }
```

---

### 18. GET `/admin/packages/contact-users/:contactId`
**Purpose**: List all users linked to a contact  
**Auth**: JWT + admin role  

**Response** `200`:
```json
{
  "success": true,
  "users": [
    { "id": 1, "user_id": "abc-123", "contact_id": 1, "role": "STAFF", "email": "admin@softaware.net.za", "name": "Admin User" }
  ]
}
```

---

## Middleware (middleware/packages.ts)

Not mounted as routes — imported and applied to individual routers (e.g., AI endpoints).

### `requirePackage`
**Purpose**: Resolves `req.contactId` and `req.contactPackageId` from authenticated user  
**Prerequisite**: `requireAuth` (needs `req.user.id`)  
**Flow**:
1. Look up `user_contact_link` for `req.user.id`
2. If no link → `403 { error: 'NO_PACKAGE' }`
3. Find active subscription (`status IN TRIAL, ACTIVE`)
4. Set `req.contactId`, `req.contactPackageId`, `req.creditBalance`

### `requireCredits`
**Purpose**: Block request if contact has no credits  
**Prerequisite**: `requirePackage`  
**Flow**:
1. Sum `credits_balance` across active subscriptions for `req.contactId`
2. Set `X-Credit-Balance` and `X-Credit-Low-Balance` response headers
3. If balance ≤ 0 → `402 { error: 'INSUFFICIENT_CREDITS' }`

### `deductCreditsAfterResponse`
**Purpose**: Async credit deduction after successful response  
**Flow**:
1. Hooks into `res.end` and `res.json`
2. On successful response (2xx), detects request type from URL path
3. Calculates cost using `REQUEST_PRICING` from config
4. Calls `packageService.deductCredits()` — deducts from highest-balance active package
5. Sets `X-Credit-Deducted` and `X-Credit-Balance-After` headers

### `packageCreditMiddleware`
**Purpose**: Combined middleware — `requirePackage` → `requireCredits` → `deductCreditsAfterResponse`  
**Usage**: Apply to AI endpoint routers for full credit enforcement.

```typescript
import { packageCreditMiddleware } from '../middleware/packages.js';
aiRouter.use(packageCreditMiddleware);
```
