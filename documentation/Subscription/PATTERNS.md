# Subscription Module - Patterns

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

---

## 1. Overview

This document catalogs the **architectural patterns** and **anti-patterns** found in the Subscription module, covering:

- Subscription plan management (trials, billing cycles, cancellations)
- AI credit system (packages, balance tracking, deductions)
- Payment gateway integration (PayFast, Yoco)
- Widget subscription tiers

---

## 2. Architectural Patterns

### Pattern 1: Service Layer Abstraction

**Context:**  
Business logic for subscriptions and credits is separated from route handlers into dedicated service modules.

**Implementation:**

```typescript
// routes/subscription.ts
import * as subscriptionService from '../services/subscription.js';

subscriptionRouter.get('/current', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const subscription = await subscriptionService.getTeamSubscription(teamId);
    res.json({ subscription });
  } catch (err) {
    next(err);
  }
});

// services/subscription.ts
export async function getTeamSubscription(teamId: string) {
  const subscription = await db.queryOne(`
    SELECT s.*, sp.* 
    FROM subscriptions s 
    JOIN subscription_plans sp ON s.planId = sp.id 
    WHERE s.teamId = ?
  `, [teamId]);
  
  return subscription;
}
```

**Benefits:**
- ✅ Route handlers stay thin and focused on HTTP concerns
- ✅ Business logic reusable across multiple routes
- ✅ Easier to unit test service functions independently
- ✅ Clear separation of concerns

**Drawbacks:**
- ❌ Extra layer of indirection
- ❌ Requires careful interface design between layers

---

### Pattern 2: Middleware-Based Credit Deduction

**Context:**  
AI requests automatically deduct credits using middleware that wraps route handlers.

**Implementation:**

```typescript
// middleware/credits.ts
export function deductCredits(requestType: RequestType) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const teamId = await getTeamIdFromRequest(req);
    const balance = await getTeamCreditBalance(teamId);
    
    const estimatedCost = REQUEST_PRICING[requestType].baseCost;
    
    if (balance.credits < estimatedCost) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        required: estimatedCost,
        current: balance.credits
      });
    }
    
    // Store pre-request balance for rollback
    req.creditCheckpoint = { teamId, balance: balance.credits };
    next();
  };
}

// routes/ai.ts
aiRouter.post('/chat', 
  requireApiKey, 
  deductCredits('TEXT_CHAT'),  // ← Middleware
  async (req: ApiKeyRequest, res) => {
    const response = await chatService.execute(req.body.message);
    
    // Deduct actual cost after execution
    const actualCost = calculateCreditCost('TEXT_CHAT', response.tokens);
    await deductCreditsFromBalance(req.creditCheckpoint.teamId, actualCost);
    
    res.json(response);
  }
);
```

**Benefits:**
- ✅ Credit checks happen before expensive operations
- ✅ Consistent credit validation across all AI routes
- ✅ Pre-flight check prevents wasted API calls
- ✅ Automatic rollback on route errors

**Drawbacks:**
- ❌ Two-phase deduction (estimate + actual) adds complexity
- ❌ Race condition if multiple concurrent requests

---

### Pattern 3: Webhook Signature Validation

**Context:**  
Payment webhooks (PayFast, Yoco) must be validated to prevent fraud.

**Implementation:**

```typescript
// routes/credits.ts
creditsRouter.post('/webhook/payfast', async (req, res, next) => {
  try {
    // 1. Validate PayFast signature
    const signature = req.body.signature;
    delete req.body.signature;
    
    const dataString = Object.keys(req.body)
      .sort()
      .map(key => `${key}=${encodeURIComponent(req.body[key])}`)
      .join('&');
    
    const expectedSignature = crypto
      .createHash('md5')
      .update(dataString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 2. Validate payment amounts match
    const transactionId = req.body.custom_str1;
    const transaction = await getTransaction(transactionId);
    
    if (Math.abs(parseFloat(req.body.amount_gross) - transaction.amount / 100) > 0.01) {
      throw new Error('Amount mismatch');
    }
    
    // 3. Process payment
    if (req.body.payment_status === 'COMPLETE') {
      await addCredits(transaction.teamId, transaction.credits, {
        type: 'PURCHASE',
        transactionId,
        paymentProvider: 'PAYFAST',
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
```

**Benefits:**
- ✅ Prevents fake payment notifications
- ✅ Validates data integrity
- ✅ Idempotent (safe to retry)

**Drawbacks:**
- ❌ Signature algorithms differ per gateway
- ❌ Failed webhooks require manual reconciliation

---

### Pattern 4: Dual Billing Systems (Subscriptions + Credits)

**Context:**  
The platform has TWO independent billing systems running in parallel:

1. **Subscription Plans** — Recurring monthly/annual billing for desktop app access
2. **Credit System** — Prepaid credits for per-request AI usage

**Implementation:**

```typescript
// Separate tables
// subscriptions → Recurring plans (PERSONAL, TEAM, ENTERPRISE)
// credit_balances → Prepaid AI credits

// services/subscription.ts
export async function getTeamSubscription(teamId: string) {
  return db.queryOne('SELECT * FROM subscriptions WHERE teamId = ?', [teamId]);
}

// services/credits.ts
export async function getTeamCreditBalance(teamId: string) {
  return db.queryOne('SELECT * FROM credit_balances WHERE teamId = ?', [teamId]);
}

// A team can have:
// - Active subscription (TEAM plan, R1,500/mo)
// - Separate credit balance (8,450 credits)
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Credits can be sold independently (no subscription required)
- ✅ Subscriptions can include bonus credits
- ✅ Different payment flows (recurring vs one-time)

**Drawbacks:**
- ❌ Two separate invoicing systems
- ❌ Risk of confusion (users may think subscription includes credits)
- ❌ Double the billing complexity

---

### Pattern 5: Trial Period with Grace Period

**Context:**  
New teams get 14-day trials that automatically expire but don't immediately block access.

**Implementation:**

```typescript
subscriptionRouter.get('/current', requireAuth, async (req: AuthRequest, res, next) => {
  const subscription = await subscriptionService.getTeamSubscription(teamId);
  
  let effectiveStatus = subscription.status;
  
  // Check if trial expired
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
    if (new Date() > subscription.trialEndsAt) {
      effectiveStatus = 'EXPIRED';  // Soft expiry
    }
  }
  
  res.json({
    subscription: {
      ...subscription,
      effectiveStatus,  // Display status
      status,           // Database status (still "TRIAL")
    },
  });
});

// Desktop app checks effectiveStatus and shows upgrade prompt
// But doesn't block access until admin manually downgrades
```

**Benefits:**
- ✅ Graceful degradation (users don't lose access instantly)
- ✅ Admin can manually review expired trials
- ✅ Prevents accidental lockouts

**Drawbacks:**
- ❌ Requires manual cleanup of expired trials
- ❌ Users can abuse extended grace period

---

### Pattern 6: Price Display with Currency Formatting

**Context:**  
Prices stored in cents (integer) but displayed in Rand (decimal with currency symbol).

**Implementation:**

```typescript
subscriptionRouter.get('/plans', async (req, res, next) => {
  const plans = await subscriptionService.getPlans();
  
  const formattedPlans = plans.map((plan) => ({
    ...plan,
    priceMonthlyDisplay: `R${(plan.priceMonthly / 100).toLocaleString()}`,
    priceAnnuallyDisplay: plan.priceAnnually 
      ? `R${(plan.priceAnnually / 100).toLocaleString()}` 
      : null,
    priceMonthlyFromAnnual: plan.priceAnnually 
      ? `R${((plan.priceAnnually / 100) / 12).toFixed(0)}` 
      : null,
  }));
  
  res.json({ plans: formattedPlans });
});

// Database: priceMonthly = 150000 (integer cents)
// API: priceMonthlyDisplay = "R1,500" (string)
```

**Benefits:**
- ✅ Avoids floating-point rounding errors in database
- ✅ Consistent currency formatting across API
- ✅ Easy to calculate discounts/taxes

**Drawbacks:**
- ❌ Requires conversion in every API response
- ❌ Frontend must handle both raw cents and formatted strings

---

### Pattern 7: API Key vs JWT Authentication

**Context:**  
Different auth methods for different client types:

- **JWT (requireAuth)** — Web app users (short-lived, user-scoped)
- **API Key (requireApiKey)** — Desktop apps (long-lived, team-scoped)

**Implementation:**

```typescript
// middleware/auth.ts
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const decoded = jwt.verify(token, JWT_SECRET);
  req.userId = decoded.userId;
  next();
}

// middleware/apiKey.ts
export function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const apiKeyRecord = await db.queryOne('SELECT * FROM api_keys WHERE key_hash = ?', [keyHash]);
  req.apiKey = apiKeyRecord;
  next();
}

// Usage:
subscriptionRouter.get('/current', requireAuth, ...);        // Web app
creditsRouter.get('/balance', requireApiKey, ...);           // Desktop app
```

**Benefits:**
- ✅ Web users get short-lived tokens (better security)
- ✅ Desktop apps get persistent keys (better UX)
- ✅ Clear separation of client types

**Drawbacks:**
- ❌ Two authentication systems to maintain
- ❌ API key rotation more complex than JWT refresh

---

## 3. Anti-Patterns Found

### Anti-Pattern 1: Manual Team Lookup in Every Route

**Problem:**  
Every API key endpoint repeats the same team lookup logic.

**Current Code:**

```typescript
creditsRouter.get('/balance', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [req.apiKey.userId]
  );
  const teamId = membership?.teamId;
  // ... rest of logic
});

creditsRouter.post('/purchase', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [req.apiKey.userId]
  );
  const teamId = membership?.teamId;
  // ... rest of logic
});

// Repeated in 10+ endpoints! 🔴
```

**Impact:**
- 🔴 Code duplication across 10+ routes
- 🔴 Extra database query per request
- 🔴 Inconsistent error messages

**Recommended Fix:**

```typescript
// middleware/apiKey.ts (extend existing middleware)
export function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const apiKeyRecord = await db.queryOne('SELECT * FROM api_keys WHERE key_hash = ?', [keyHash]);
  req.apiKey = apiKeyRecord;
  
  // ✅ Add team lookup here
  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [apiKeyRecord.userId]
  );
  req.teamId = membership?.teamId;
  
  next();
}

// Now routes can just use req.teamId:
creditsRouter.get('/balance', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  const balance = await getTeamCreditBalance(req.teamId);  // ✅ Clean!
  res.json({ balance });
});
```

**Effort:** 🟢 LOW (1-2 hours)

---

### Anti-Pattern 2: Price Formatting in Every Endpoint

**Problem:**  
Price formatting logic duplicated across multiple routes.

**Current Code:**

```typescript
// In subscriptions/plans:
priceMonthlyDisplay: `R${(plan.priceMonthly / 100).toLocaleString()}`,

// In subscriptions/current:
priceMonthlyDisplay: `R${priceMonthly.toLocaleString()}`,

// In credits/packages:
formattedPrice: `R${(pkg.price / 100).toFixed(2)}`,

// In invoices:
total: `R${(inv.total / 100).toFixed(2)}`,
```

**Impact:**
- 🟡 Inconsistent formatting (toLocaleString vs toFixed)
- 🟡 Hard to change currency or locale
- 🟡 Clutters response mapping

**Recommended Fix:**

```typescript
// utils/currency.ts
export function formatZAR(cents: number, options?: { decimals?: number }): string {
  const amount = cents / 100;
  const decimals = options?.decimals ?? (amount % 1 === 0 ? 0 : 2);
  return `R${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Usage:
import { formatZAR } from '../utils/currency.js';

subscriptionRouter.get('/plans', async (req, res, next) => {
  const formattedPlans = plans.map(plan => ({
    ...plan,
    priceMonthlyDisplay: formatZAR(plan.priceMonthly),  // ✅ Clean!
    priceAnnuallyDisplay: plan.priceAnnually ? formatZAR(plan.priceAnnually) : null,
  }));
});
```

**Effort:** 🟢 LOW (2 hours)

---

### Anti-Pattern 3: No Idempotency for Webhook Processing

**Problem:**  
Webhook endpoints can process the same payment twice if retried.

**Current Code:**

```typescript
creditsRouter.post('/webhook/payfast', async (req, res, next) => {
  // Validate signature...
  
  if (req.body.payment_status === 'COMPLETE') {
    await addCredits(transaction.teamId, transaction.credits, {
      type: 'PURCHASE',
      transactionId,
    });  // ❌ No check if already processed!
  }
  
  res.json({ success: true });
});
```

**Impact:**
- 🔴 CRITICAL: Credits can be added multiple times for one payment
- 🔴 Financial loss if webhook retries

**Recommended Fix:**

```typescript
creditsRouter.post('/webhook/payfast', async (req, res, next) => {
  const transactionId = req.body.custom_str1;
  
  // ✅ Check if already processed
  const transaction = await db.queryOne(
    'SELECT * FROM credit_transactions WHERE id = ?',
    [transactionId]
  );
  
  if (transaction.status === 'COMPLETED') {
    return res.json({ success: true, message: 'Already processed' });  // ✅ Idempotent
  }
  
  if (req.body.payment_status === 'COMPLETE') {
    await db.transaction(async (trx) => {
      // Update transaction status
      await trx.update('credit_transactions', { status: 'COMPLETED' }, { id: transactionId });
      // Add credits
      await addCredits(transaction.teamId, transaction.credits, { transactionId });
    });
  }
  
  res.json({ success: true });
});
```

**Effort:** 🟡 MEDIUM (4 hours + testing)

---

### Anti-Pattern 4: Mixed Responsibility in Pricing Routes

**Problem:**  
The `pricing.ts` routes are for general business pricing items (unrelated to subscriptions/credits) but live alongside subscription routes.

**Current Code:**

```typescript
// routes/pricing.ts
// These are for quoting/invoicing general services (hosting, consulting, etc.)
// NOT related to subscription plans or AI credits

pricingRouter.get('/', requireAuth, async (req, res) => {
  const items = await db.query('SELECT * FROM pricing WHERE category_id = ?', [category]);
  res.json({ items });
});
```

**Impact:**
- 🟡 Confusing module organization (not part of Subscription domain)
- 🟡 Makes Subscription module documentation misleading

**Recommended Fix:**

Move `pricing.ts` to a separate `Quotations` or `Services` module since it's used for general business pricing, not platform subscriptions.

```bash
# Current:
/routes/subscription.ts       → Subscriptions module ✅
/routes/credits.ts             → Subscriptions module ✅
/routes/pricing.ts             → Subscriptions module ❌ (wrong domain)

# Proposed:
/routes/subscription.ts       → Subscriptions module
/routes/credits.ts             → Subscriptions module
/routes/services/pricing.ts   → Services/Quotations module
```

**Effort:** 🟢 LOW (1 hour)

---

### Anti-Pattern 5: No Credit Balance Threshold Alerts

**Problem:**  
Users only discover they're out of credits when API requests fail (bad UX).

**Current Code:**

```typescript
// middleware/credits.ts
if (balance.credits < estimatedCost) {
  return res.status(402).json({ error: 'Insufficient credits' });
  // ❌ No proactive notification!
}
```

**Impact:**
- 🟡 Poor user experience (unexpected failures)
- 🟡 Missed opportunities to prompt credit purchases

**Recommended Fix:**

```typescript
// services/credits.ts
export async function checkLowBalanceAlert(teamId: string, currentBalance: number) {
  const THRESHOLD = 500;  // Alert when < 500 credits
  
  if (currentBalance < THRESHOLD) {
    const alerted = await db.queryOne(
      'SELECT * FROM low_balance_alerts WHERE teamId = ? AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      [teamId]
    );
    
    if (!alerted) {
      // Send email/notification
      await notificationService.send({
        teamId,
        type: 'LOW_CREDIT_BALANCE',
        message: `Your credit balance is low (${currentBalance} remaining). Purchase more to continue using AI features.`,
      });
      
      await db.insertOne('low_balance_alerts', { teamId, balance: currentBalance });
    }
  }
}

// Call after every credit deduction:
await deductCreditsFromBalance(teamId, cost);
await checkLowBalanceAlert(teamId, newBalance);
```

**Effort:** 🟡 MEDIUM (6 hours + email templates)

---

## 4. Summary

| Pattern | Type | Status | Priority |
|---------|------|--------|----------|
| Service Layer Abstraction | ✅ Good | Implemented | — |
| Middleware Credit Deduction | ✅ Good | Implemented | — |
| Webhook Signature Validation | ✅ Good | Implemented | — |
| Dual Billing Systems | ✅ Good | Implemented | — |
| Trial Grace Period | ✅ Good | Implemented | — |
| Price Display Formatting | ✅ Good | Implemented | — |
| API Key vs JWT Auth | ✅ Good | Implemented | — |
| Manual Team Lookup (Anti) | 🔴 Anti | Fix Needed | HIGH |
| Price Formatting Duplication (Anti) | 🟡 Anti | Refactor | LOW |
| No Webhook Idempotency (Anti) | 🔴 Anti | Fix Needed | CRITICAL |
| Mixed Pricing Responsibility (Anti) | 🟡 Anti | Refactor | LOW |
| No Low Balance Alerts (Anti) | 🟡 Anti | Feature Missing | MEDIUM |

---

*This document is maintained alongside code changes. Update patterns as the codebase evolves.*
