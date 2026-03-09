# Subscription — File Inventory

## Backend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| subscription.ts | `src/routes/subscription.ts` | 268 | Plan listing, current subscription, trial start, plan change, cancellation, invoices, admin endpoints |
| credits.ts | `src/routes/credits.ts` | 284 | Credit packages (public), purchase (API key), balance, transactions, usage, webhooks |
| adminCredits.ts | `src/routes/adminCredits.ts` | 264 | Admin: package CRUD, pricing view, balance management, adjustments, transaction listing |
| subscriptionTiers.ts | `src/routes/subscriptionTiers.ts` | 308 | Widget subscription tiers, upgrade, config, usage, leads |
| subscription.ts | `src/services/subscription.ts` | 262 | Plan management, trial creation, plan changes, cancellation, invoice retrieval, seeding |
| credits.ts | `src/services/credits.ts` | 343 | Balance CRUD, deduct/add credits, transaction history, usage stats, low-balance alerts, seeding |
| payment.ts | `src/services/payment.ts` | 345 | PayFast redirect URL, Yoco Checkout API, webhook callbacks, signature verification |
| credits.ts | `src/config/credits.ts` | 155 | Request types, pricing config, cost calculation, package definitions, thresholds |
| credits.ts | `src/middleware/credits.ts` | 169 | `requireCredits()`, `deductCreditsMiddleware()`, `withCreditDeduction()` |
| mysql.ts (partial) | `src/db/mysql.ts` | ~150 | DB interfaces: credit_balances, credit_transactions, credit_packages, subscription_plans, Subscription, Invoice, Payment |

**Backend Total: ~2,548 LOC**

## Frontend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| AICredits.tsx | `src/pages/admin/AICredits.tsx` | 208 | Admin: credit packages, team balances, transactions tabs |
| AdminAIModels.ts | `src/models/AdminAIModels.ts` | 224 | AdminCreditsModel class, CreditPackage/CreditBalance/SystemStats types |
| index.ts (partial) | `src/models/index.ts` | ~10 | Re-exports AdminCreditsModel, CreditPackage, CreditBalance |

**Frontend Total: ~442 LOC**

## Combined Total: ~2,990 LOC

---

## File Relationship Map

```
Backend Routes                           Frontend
┌─────────────────────────┐             ┌──────────────────────┐
│ subscription.ts (route) │             │                      │
│ GET /plans (public)     │             │  No dedicated page   │
│ GET /current            │             │  (API consumed by    │
│ POST /start-trial       │             │   desktop app)       │
│ POST /change-plan       │             │                      │
│ POST /cancel            │             │                      │
│ GET /invoices           │             │                      │
│ GET /admin/all          │             │                      │
│ POST /admin/seed-plans  │             │                      │
├─────────────────────────┤             ├──────────────────────┤
│ credits.ts (route)      │             │ AICredits.tsx         │
│ GET /packages (public)  │◀────────────│ (admin panel)        │
│ GET /packages/:id       │             │                      │
│ GET /pricing            │             │ AdminAIModels.ts     │
│ GET /balance (API key)  │◀────────────│ AdminCreditsModel    │
│ POST /purchase (API key)│             │                      │
│ GET /transactions       │             │                      │
│ GET /usage              │             │                      │
│ POST /webhook/payfast   │◀── PayFast callback               │
│ POST /webhook/yoco      │◀── Yoco webhook                   │
├─────────────────────────┤             │                      │
│ adminCredits.ts (route) │◀────────────│ AICredits.tsx         │
│ GET /packages           │             │ (admin panel)        │
│ POST /packages          │             │                      │
│ PUT /packages/:id       │             │                      │
│ DELETE /packages/:id    │             │                      │
│ GET /balances           │             │                      │
│ POST /balances/:teamId/adjust         │                      │
│ GET /transactions       │             │                      │
└─────────────────────────┘             └──────────────────────┘

Services Layer
┌─────────────────────────┐
│ subscription.ts (svc)   │ ← Plan CRUD, trials, billing
│ credits.ts (svc)        │ ← Balance ops, deduction, stats
│ payment.ts (svc)        │ ← PayFast + Yoco gateway
└─────────────────────────┘

Config & Middleware
┌─────────────────────────┐
│ credits.ts (config)     │ ← Pricing, packages, thresholds
│ credits.ts (middleware)  │ ← Balance check + deduction
└─────────────────────────┘

Database Tables
┌─────────────────────────┐
│ subscription_plans      │ ← PERSONAL, TEAM, ENTERPRISE
│ subscriptions           │ ← Subscription records (teamId is legacy)
│ billing_invoices        │ ← Subscription billing invoices
│ credit_packages         │ ← Purchasable credit bundles
│ credit_balances         │ ← Credit balance (teamId is legacy scoping)
│ credit_transactions     │ ← Credit debit/credit audit log
│ subscription_tier_limits│ ← Widget tier feature limits
│ widget_clients          │ ← Widget subscription state
│ widget_usage_logs       │ ← Widget message counting
│ widget_leads_captured   │ ← Widget lead capture data
└─────────────────────────┘
```
