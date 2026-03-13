# Subscription Module

> ⚠️ **DEPRECATION NOTICE (June 2025)**: The legacy team-scoped credit system described in this document has been **superseded by the [Packages module](../Packages/README.md)**. The new system uses **contact-scoped billing** instead of team-scoped billing, with 7 defined package tiers, per-contact credit balances, and the `contact_packages` / `package_transactions` tables. Legacy tables (`credit_packages`, `credit_balances`, `credit_transactions`, `teams`) are retained for data reference but are **no longer the active billing path**. New AI credit deductions flow through `middleware/packages.ts` → `services/packages.ts`. See [Packages CHANGES.md](../Packages/CHANGES.md) for migration details.

## Overview

The Subscription module manages two distinct billing domains for the SoftAware platform:

1. **Team Subscription Plans** — Tiered SaaS plans (Personal/Team/Enterprise) with trials, billing cycles, and feature gating for the desktop application
2. **AI Credit System** — Prepaid credit packages for AI/LLM usage, purchased via PayFast or Yoco payment gateways, consumed per-request with token-based pricing
3. **Widget Subscription Tiers** — Separate tier system (Free/Starter/Advanced/Enterprise) for embeddable AI chat widgets, with message limits, lead capture, and tone control

## Module Scope

| Sub-Domain | Description |
|------------|-------------|
| **Subscription Plans** | PERSONAL (R250/mo), TEAM (R1,500/mo), ENTERPRISE (R5,000/mo) with trials |
| **Credit Packages** | 5 tiers: Starter (R10) → Enterprise (R750) with bonus credits |
| **Credit Balance** | Per-team balance tracking, deduction, low-balance alerts |
| **Credit Pricing** | Per-request-type pricing (TEXT_CHAT, CODE_AGENT_EXECUTE, etc.) |
| **Payment Gateways** | PayFast (redirect) and Yoco (API + webhook) for credit purchases |
| **Widget Tiers** | Free/Starter/Advanced/Enterprise for AI widget clients |
| **Admin Management** | Package CRUD, balance adjustments, transaction auditing |

## Architecture

### Backend Structure
```
src/routes/subscription.ts        → /v1/subscriptions/* (plans, trials, billing)
src/routes/credits.ts             → /v1/credits/* (packages, purchase, balance, webhooks)
src/routes/adminCredits.ts        → /v1/admin/credits/* (package CRUD, balance management)
src/routes/subscriptionTiers.ts   → /v1/subscriptions/* (widget tier management)
src/services/subscription.ts      → Plan management, trial creation, cancellation
src/services/credits.ts           → Balance operations, deduction, usage stats
src/services/payment.ts           → PayFast + Yoco gateway integration
src/config/credits.ts             → Request pricing, package definitions, thresholds
src/middleware/credits.ts         → Credit deduction + balance check middleware
```

### Frontend Structure
```
pages/admin/AICredits.tsx          → Admin credits management (packages, balances, transactions)
models/AdminAIModels.ts           → AdminCreditsModel + types
```

> **Note**: No dedicated frontend subscription page exists yet. Subscription management is API-only (consumed by desktop app).

## Dependencies

| Dependency | Usage |
|-----------|-------|
| Zod | Request validation for all schemas |
| crypto | UUID generation, HMAC-SHA256 for Yoco webhooks |
| mysql2/promise | All database operations |
| `../services/payment.ts` | PayFast URL generation, Yoco Checkout API |
| `../middleware/apiKey.ts` | API key auth for desktop app credit operations |
| `../middleware/requireAdmin.ts` | Admin-only routes for credit management |

## Key Concepts

- **Currency**: All prices stored in ZAR cents (R250/mo = 25000 cents)
- **Credits ≠ Currency**: Credits are an internal unit; 1 credit ≈ R0.01 (100 credits = R1)
- **Legacy Team Scoping**: Credit balances reference `teams.id` (legacy table retained solely for credit balance grouping — see Authentication v1.1.0). The system is **not multi-tenant**; `teams` exists only as a credit-scoping artifact from the original architecture. **Superseded by contact-scoped billing in the [Packages module](../Packages/README.md).**
- **Dual Auth**: Credits endpoints accept API key (desktop) or JWT (web); admin endpoints require JWT + admin role
- **Signup Bonus**: New registrations receive 100 credits automatically
- **Low Balance Alerts**: WARNING at 5,000 credits, CRITICAL at 1,000 credits
