# Subscription Module - Changes

**Version:** 1.0.0  
**Last Updated:** 2026-03-04

> ⚠️ **DEPRECATION NOTICE (June 2025)**: The team-scoped credit system has been superseded by the [Packages module](../Packages/README.md). Legacy routes and tables are retained for backward compatibility but are no longer the active billing path. New credit operations flow through `services/packages.ts` and `middleware/packages.ts`. See [Packages CHANGES.md](../Packages/CHANGES.md) for the replacement system.

---

## 1. Overview

This document tracks version history, known issues, and migration notes for the Subscription module.

---

## 2. Version History

### Version 1.1.0 — Superseded by Packages (June 2025)

**Status:** ⚠️ Legacy — Superseded  
**Release Notes:**

The team-scoped credit model has been replaced by the contact-scoped [Packages system](../Packages/README.md):

| Legacy Concept | New Equivalent | Notes |
|---------------|---------------|-------|
| `teams` credit owner | `contacts` (via `contact_packages`) | Billing scoped per-contact, not per-team |
| `credit_balances` | `contact_packages.credits_balance` | Per-subscription balance |
| `credit_transactions` | `package_transactions` | Full audit trail with `balance_after` |
| `credit_packages` (purchase tiers) | `packages` (subscription tiers) | 7 seeded packages (Free → Staff) |
| `middleware/credits.ts` | `middleware/packages.ts` | New middleware chain: requirePackage → requireCredits → deductCreditsAfterResponse |
| `CREDIT_COSTS` config | `REQUEST_PRICING` config | Renamed with `baseCost`, `perToken`, `perMultiplier` |
| `adminCredits.ts` routes | `adminPackages.ts` routes | New admin API at `/admin/packages/*` |
| `AICredits.tsx` frontend | `AIPackages.tsx` frontend | 4-tab interface (Packages, Subscriptions, Transactions, User Links) |

**Migration**: `023_packages_system.ts` — creates 4 new tables, seeds 7 packages, links Soft Aware (contact 1) to Staff package.

**Legacy tables retained** (not dropped): `credit_packages`, `credit_balances`, `credit_transactions`, `teams`, `team_members`  
**Legacy routes retained** (not removed): `/admin/credits/*`, `/v1/credits/*`

### Version 1.0.0 — Current (2026-03-04)

**Status:** ✅ Production  
**Release Notes:**

Core subscription and credit systems operational:
- Team subscription plans (PERSONAL, TEAM, ENTERPRISE) with 14-day trials
- AI credit packages with PayFast and Yoco payment integration
- Widget subscription tiers (Free, Starter, Advanced, Enterprise)
- Credit balance tracking and transaction history
- Webhook processing for payment confirmations
- Admin credit management tools

**Features:**
- ✅ Subscription plan management (create trial, change plan, cancel)
- ✅ Credit package purchases via PayFast/Yoco
- ✅ Automated credit deduction middleware
- ✅ Invoice generation for subscriptions
- ✅ Widget tier management with usage tracking
- ✅ Admin credit top-ups and balance adjustments
- ✅ Transaction history and usage statistics

**Limitations:**
- ❌ No automated trial expiry enforcement (requires manual admin review)
- ❌ No proactive low-balance notifications
- ❌ Single currency support (ZAR only)
- ❌ No subscription downgrades (only upgrades/cancellations)
- ❌ No credit refunds (purchases are final)
- ❌ Widget tier upgrades require manual payment processing

**Known Issues:** See Section 3 below

**Migration Notes:** Initial release, no migrations required

---

### Version 0.9.0 — Pre-Launch (2026-02-15)

**Status:** 🟡 Beta Testing  
**Changes:**
- Added widget subscription tiers
- Implemented Yoco payment gateway (alongside PayFast)
- Split credit packages into 5 tiers (Starter → Enterprise)
- Added bonus credits to packages

**Migration:**
```sql
-- Add bonusCredits column to credit_packages
ALTER TABLE credit_packages ADD COLUMN bonusCredits INT DEFAULT 0;

-- Add widget subscription tables
CREATE TABLE subscription_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  features JSON,
  active BOOLEAN DEFAULT 1
);
```

---

### Version 0.5.0 — Initial Alpha (2026-01-10)

**Status:** 🟢 Internal Testing  
**Changes:**
- Basic subscription plan CRUD
- PayFast payment integration
- Credit balance tracking
- Simple trial management

---

## 3. Known Issues

### Issue 1: Webhook Idempotency Not Enforced

**Severity:** 🔴 CRITICAL  
**Status:** 🔴 Open  
**File:Line:** [credits.ts](../backend/src/routes/credits.ts#L345-L360)

**Description:**  
PayFast and Yoco webhooks do not check if a payment has already been processed before adding credits. If a webhook is retried (which payment gateways do automatically on timeout), credits will be added multiple times for the same purchase.

**Impact:**
- Financial loss (users get free credits)
- Data integrity issues
- Cannot trust transaction history

**Recommended Fix:**

```typescript
// routes/credits.ts
creditsRouter.post('/webhook/payfast', async (req, res, next) => {
  const transactionId = req.body.custom_str1;
  
  // Check if already processed
  const transaction = await db.queryOne(
    'SELECT * FROM credit_transactions WHERE id = ? AND status = ?',
    [transactionId, 'COMPLETED']
  );
  
  if (transaction) {
    return res.json({ success: true, message: 'Already processed' });
  }
  
  // Process payment in transaction
  await db.transaction(async (trx) => {
    await trx.update('credit_transactions', { status: 'COMPLETED' }, { id: transactionId });
    await addCredits(teamId, amount, { transactionId });
  });
  
  res.json({ success: true });
});
```

**Effort:** 🟡 MEDIUM (4 hours + testing with sandbox webhooks)

---

### Issue 2: Manual Team Lookup in Every API Key Endpoint

**Severity:** 🟡 WARNING  
**Status:** 🔴 Open  
**File:Line:** [credits.ts](../backend/src/routes/credits.ts#L145), [credits.ts#L168](../backend/src/routes/credits.ts#L168), [credits.ts#L218](../backend/src/routes/credits.ts#L218), etc.

**Description:**  
Every API key-protected endpoint repeats the same team lookup query:

```typescript
const membership = await db.queryOne<team_members>(
  'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
  [req.apiKey.userId]
);
const teamId = membership?.teamId;
```

**Impact:**
- 10+ duplicated database queries across routes
- Code duplication (DRY violation)
- Inconsistent error messages
- Extra latency per request

**Recommended Fix:**

Move team lookup into the `requireApiKey` middleware so `req.teamId` is available to all routes.

```typescript
// middleware/apiKey.ts
export async function requireApiKey(req: ApiKeyRequest, res: Response, next: NextFunction) {
  // ... existing API key validation ...
  
  const membership = await db.queryOne<team_members>(
    'SELECT * FROM team_members WHERE userId = ? LIMIT 1',
    [req.apiKey.userId]
  );
  
  req.teamId = membership?.teamId;
  
  if (!req.teamId) {
    return res.status(404).json({ 
      error: 'No team found for user. Please create a team first.' 
    });
  }
  
  next();
}

// Now all routes can use req.teamId directly
creditsRouter.get('/balance', requireApiKey, async (req: ApiKeyRequest, res, next) => {
  const balance = await getTeamCreditBalance(req.teamId);
  res.json({ balance });
});
```

**Effort:** 🟢 LOW (1-2 hours)

---

### Issue 3: No Low Credit Balance Alerts

**Severity:** 🟡 WARNING  
**Status:** 🔴 Open  
**File:Line:** [credits.ts](../backend/src/services/credits.ts)

**Description:**  
Users only discover they're out of credits when API requests fail with `402 Payment Required`. No proactive notifications are sent when balance drops below a threshold.

**Impact:**
- Poor user experience (unexpected failures mid-workflow)
- Missed opportunities to prompt credit purchases
- Higher support ticket volume

**Recommended Fix:**

Add a background job or post-deduction check that sends email/notification when balance < 500 credits.

```typescript
// services/credits.ts
export async function checkLowBalanceAlert(teamId: string, currentBalance: number) {
  const THRESHOLD = 500;
  
  if (currentBalance < THRESHOLD) {
    const recentAlert = await db.queryOne(
      'SELECT * FROM low_balance_alerts WHERE teamId = ? AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      [teamId]
    );
    
    if (!recentAlert) {
      await notificationService.send({
        teamId,
        type: 'LOW_CREDIT_BALANCE',
        message: `Your credit balance is low (${currentBalance} remaining).`,
        actionUrl: '/credits/purchase',
      });
      
      await db.insertOne('low_balance_alerts', { teamId, balance: currentBalance });
    }
  }
}

// Call after every deduction
await deductCreditsFromBalance(teamId, cost);
await checkLowBalanceAlert(teamId, newBalance);
```

**Effort:** 🟡 MEDIUM (6 hours + email templates)

---

### Issue 4: Price Formatting Inconsistency

**Severity:** 🟢 LOW  
**Status:** 🔴 Open  
**File:Line:** [subscription.ts](../backend/src/routes/subscription.ts#L20), [credits.ts#L67](../backend/src/routes/credits.ts#L67), etc.

**Description:**  
Price formatting is duplicated across routes with inconsistent methods:

- Some use `toLocaleString()` (adds commas but no decimals)
- Others use `toFixed(2)` (adds decimals but no commas)
- All manually prepend `R` currency symbol

**Impact:**
- Inconsistent display formats across API
- Hard to change currency or locale
- Cluttered response mapping code

**Recommended Fix:**

Create a shared `formatZAR()` utility function:

```typescript
// utils/currency.ts
export function formatZAR(cents: number, options?: { decimals?: number }): string {
  const amount = cents / 100;
  const decimals = options?.decimals ?? (amount % 1 === 0 ? 0 : 2);
  return `R${amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Usage:
priceMonthlyDisplay: formatZAR(plan.priceMonthly),  // → "R1,500"
formattedPrice: formatZAR(pkg.price),               // → "R100.00"
```

**Effort:** 🟢 LOW (2 hours)

---

### Issue 5: No Subscription Downgrade Support

**Severity:** 🟢 LOW  
**Status:** 🟡 By Design (Future Feature)  
**File:Line:** [subscription.ts#L141-L173](../backend/src/routes/subscription.ts#L141-L173)

**Description:**  
The `change-plan` endpoint only supports upgrades. Users cannot downgrade from ENTERPRISE → TEAM or TEAM → PERSONAL. They must cancel and start a new subscription.

**Impact:**
- Users forced to cancel + re-subscribe (poor UX)
- Lost revenue during gap
- Extra support overhead

**Recommended Fix:**

Add downgrade logic with proration:

```typescript
subscriptionRouter.post('/change-plan', requireAuth, async (req: AuthRequest, res, next) => {
  const currentPlan = subscription.plan;
  const newPlan = await getSubscriptionPlan(input.tier);
  
  if (newPlan.priceMonthly < currentPlan.priceMonthly) {
    // Downgrade: Apply at end of current period
    await db.update('subscriptions', {
      pendingPlanId: newPlan.id,
      changeAtPeriodEnd: true,
    }, { id: subscription.id });
    
    return res.json({
      message: 'Plan will be downgraded at end of billing period',
      effectiveDate: subscription.currentPeriodEnd,
    });
  } else {
    // Upgrade: Apply immediately with proration
    const proration = calculateProration(currentPlan, newPlan, subscription.currentPeriodEnd);
    await db.update('subscriptions', { planId: newPlan.id });
    await createInvoice({ amount: proration });
    
    return res.json({ message: 'Plan upgraded successfully' });
  }
});
```

**Effort:** 🟡 MEDIUM (8 hours + proration calculations)

---

### Issue 6: Pricing Routes in Wrong Module

**Severity:** 🟢 LOW  
**Status:** 🔴 Open  
**File:Line:** [pricing.ts](../backend/src/routes/pricing.ts)

**Description:**  
The `pricing.ts` routes handle general business pricing (for quoting services like hosting, consulting, etc.) and are NOT related to subscription plans or AI credits. This file doesn't belong in the Subscription module.

**Impact:**
- Confusing module organization
- Misleading documentation
- Harder to find pricing logic for subscriptions

**Recommended Fix:**

Move `pricing.ts` to a separate `Services` or `Quotations` module:

```bash
# Current:
/routes/subscription.ts    → Subscription module ✅
/routes/credits.ts          → Subscription module ✅
/routes/pricing.ts          → Subscription module ❌

# Proposed:
/routes/subscription.ts    → Subscription module
/routes/credits.ts          → Subscription module
/routes/services/pricing.ts → Services module (new)
```

Update documentation to clarify:
- Subscription module = SaaS plans + AI credits
- Services module = General business pricing/quoting

**Effort:** 🟢 LOW (1 hour)

---

### Issue 7: Trial Expiry Not Automated

**Severity:** 🟡 WARNING  
**Status:** 🟡 By Design (Manual Review)  
**File:Line:** [subscription.ts#L40-L99](../backend/src/routes/subscription.ts#L40-L99)

**Description:**  
Expired trials are soft-flagged (`effectiveStatus: 'EXPIRED'`) but not automatically downgraded or blocked. Desktop app shows upgrade prompt, but users retain access until admin manually intervenes.

**Impact:**
- Trial abuse (users continue using after expiry)
- Revenue loss
- Manual admin workload

**Current Behavior:**

```typescript
// Soft expiry check
if (subscription.status === 'TRIAL' && subscription.trialEndsAt) {
  if (new Date() > subscription.trialEndsAt) {
    effectiveStatus = 'EXPIRED';  // Display only, no enforcement
  }
}
```

**Recommended Fix:**

Add a daily cron job to auto-downgrade expired trials:

```typescript
// jobs/expireTrials.ts
export async function expireTrialsJob() {
  const expiredTrials = await db.query(
    'SELECT * FROM subscriptions WHERE status = ? AND trialEndsAt < NOW()',
    ['TRIAL']
  );
  
  for (const sub of expiredTrials) {
    await db.update('subscriptions', { status: 'EXPIRED' }, { id: sub.id });
    
    await notificationService.send({
      teamId: sub.teamId,
      type: 'TRIAL_EXPIRED',
      message: 'Your trial has ended. Upgrade to continue using SoftAware.',
      actionUrl: '/subscription/plans',
    });
  }
  
  console.log(`Expired ${expiredTrials.length} trials`);
}

// Schedule: Every day at 2 AM
cron.schedule('0 2 * * *', expireTrialsJob);
```

**Effort:** 🟡 MEDIUM (4 hours + cron setup)

---

### Issue 8: No Credit Refund Support

**Severity:** 🟢 LOW  
**Status:** 🟡 By Design (Policy Decision)  
**File:Line:** N/A

**Description:**  
All credit purchases are final. No API endpoint or admin tool exists to refund credits or reverse transactions.

**Impact:**
- Poor customer service options
- Manual database edits required for refunds
- Risk of errors in manual refunds

**Recommended Fix:**

Add admin refund endpoint:

```typescript
// routes/adminCredits.ts
adminCreditsRouter.post('/refund', requireAuth, requireAdmin, async (req, res) => {
  const { transactionId, reason } = req.body;
  
  const transaction = await db.queryOne('SELECT * FROM credit_transactions WHERE id = ?', [transactionId]);
  
  if (transaction.type !== 'PURCHASE') {
    throw badRequest('Can only refund purchases');
  }
  
  // Reverse transaction
  await db.transaction(async (trx) => {
    await trx.insertOne('credit_transactions', {
      teamId: transaction.teamId,
      type: 'REFUND',
      amount: -transaction.amount,
      description: `Refund: ${reason}`,
      relatedTransactionId: transactionId,
    });
    
    await trx.update('credit_balances', {
      credits: db.raw('credits - ?', [transaction.amount]),
    }, { teamId: transaction.teamId });
  });
  
  res.json({ success: true, message: 'Refund processed' });
});
```

**Effort:** 🟡 MEDIUM (6 hours + payment gateway reversals)

---

## 4. Migration Notes

### Upgrading to 1.0.0 from Beta

**Database Changes:**

```sql
-- Add bonusCredits column (if not exists)
ALTER TABLE credit_packages ADD COLUMN bonusCredits INT DEFAULT 0;

-- Add widget subscription tables
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  features JSON,
  active BOOLEAN DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  clientId VARCHAR(50) NOT NULL,
  tierId VARCHAR(50) NOT NULL,
  status ENUM('ACTIVE', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
  currentPeriodEnd TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clientId) REFERENCES clients(id),
  FOREIGN KEY (tierId) REFERENCES subscription_tiers(id)
);

-- Add indexes
CREATE INDEX idx_client_subscriptions_clientId ON client_subscriptions(clientId);
CREATE INDEX idx_client_subscriptions_status ON client_subscriptions(status);
```

**Code Changes:**

- Update API key endpoints to expect `req.teamId` after middleware refactor
- Replace hardcoded price formatting with `formatZAR()` utility
- Add webhook idempotency checks to payment handlers

**Breaking Changes:**

None. All endpoints maintain backward compatibility.

---

## 5. Roadmap

### Planned for 1.1.0 (Q2 2026)

- ✅ Automated trial expiry enforcement
- ✅ Low credit balance alerts (email + in-app)
- ✅ Webhook idempotency guarantees
- ✅ Subscription downgrade support with proration
- ✅ Credit refund admin endpoint

### Planned for 1.2.0 (Q3 2026)

- Multi-currency support (USD, EUR)
- Annual subscription discounts (10% off)
- Team member seat-based billing
- Credit usage analytics dashboard
- Subscription pause/resume feature

### Planned for 2.0.0 (Q4 2026)

- Stripe payment gateway integration
- Recurring credit top-ups (subscription + credits hybrid)
- Enterprise custom pricing
- Usage-based billing (pay-per-request alternative to credits)

---

## 6. Support & Troubleshooting

### Common Issues

**Issue:** "Insufficient credits" error  
**Solution:** Check balance via `/credits/balance` endpoint. Purchase credits via `/credits/purchase`.

**Issue:** Webhook not processing payment  
**Solution:** Check webhook signature validation. Verify payment amounts match. Check logs for errors.

**Issue:** Trial expired but user still has access  
**Solution:** Expected behavior. Trials are soft-expired. Admin must manually downgrade via database:
```sql
UPDATE subscriptions SET status = 'EXPIRED' WHERE id = ?
```

**Issue:** Price displays wrong currency  
**Solution:** Only ZAR supported currently. Multi-currency planned for 1.2.0.

---

## 7. Summary

| Issue | Severity | Status | Effort | Priority |
|-------|----------|--------|--------|----------|
| Webhook Idempotency | 🔴 CRITICAL | Open | 🟡 MEDIUM | HIGH |
| Manual Team Lookup | 🟡 WARNING | Open | 🟢 LOW | HIGH |
| No Low Balance Alerts | 🟡 WARNING | Open | 🟡 MEDIUM | MEDIUM |
| Price Formatting | 🟢 LOW | Open | 🟢 LOW | LOW |
| No Downgrade Support | 🟢 LOW | Future | 🟡 MEDIUM | LOW |
| Pricing Route Location | 🟢 LOW | Open | 🟢 LOW | LOW |
| Trial Not Automated | 🟡 WARNING | By Design | 🟡 MEDIUM | MEDIUM |
| No Refunds | 🟢 LOW | By Design | 🟡 MEDIUM | LOW |

**Total Open Issues:** 6 critical/high priority

---

*This document is updated with every release. Report new issues via GitHub or support@softaware.net.za.*
