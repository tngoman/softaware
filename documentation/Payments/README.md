# Payments Module

## Overview
The Payments module handles two distinct payment domains:

1. **Invoice Payments** — Recording, tracking, and processing payments against customer invoices. Includes payment-to-transaction processing for accounting integration.
2. **Credit Purchases** — Payment gateway integration (PayFast + Yoco) for purchasing AI credit packages. Includes checkout creation, webhook processing, and idempotent credit allocation.

These two domains share the module name but serve different purposes and live in separate files.

**Current Data**: 52 invoice payments with payment-to-transaction processing for VAT-compliant accounting (as of March 2026)

## Key Responsibilities

### Invoice Payments (payments.ts router)
- CRUD operations on payment records (hard delete, no soft delete)
- Per-invoice payment listing
- Unprocessed payment listing
- Auto-paid detection (updates invoice `paid` status when total payments ≥ amount)
- Payment processing — converts payments into accounting `transactions`
- Batch processing by payment IDs or by invoice ID

### Credit Purchases (payment.ts service)
- PayFast payment URL generation for South African payments
- Yoco Checkout API integration (REST)
- Webhook callback processing for both providers
- HMAC-SHA256 signature verification for Yoco webhooks
- Idempotent credit allocation (checks `externalPaymentId` before adding)
- Credit package matching and validation

## Architecture

### Backend
- **Router**: `src/routes/payments.ts` (232 LOC) — 8 route handlers for invoice payment CRUD and processing
- **Service**: `src/services/payment.ts` (340 LOC) — Gateway integration for credit purchases
- **Database**: Direct `mysql2/promise` pool queries; no shared payment service for invoice payments

### Frontend
- **Model**: `PaymentModel` in `src/models/OtherModels.ts` (~60 LOC) — static API wrapper
- **Component**: `PaymentModal.tsx` (218 LOC) — payment recording modal with balance preview
- **Component**: `PaymentStatusBadge.tsx` (30 LOC) — color-coded status badge
- **No dedicated page** — payments managed inline within Invoices module

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Payment validation |
| `node-fetch` (built-in) | Yoco API calls |
| `crypto` | HMAC-SHA256 webhook verification |
| `Credits` service | Adding credits after successful purchase |
| `react-hook-form` | Payment modal form handling |

## Database Tables

| Table | Purpose |
|-------|---------|
| `payments` | Invoice payment records |
| `invoices` | Updated when fully paid |
| `transactions` | Target for payment processing |
| `credit_packages` | Available credit packages for purchase |
| `credit_transactions` | Idempotency check for webhook processing |
| `users` | User email for checkout |

## Payment Providers

| Provider | Status | Use Case |
|----------|--------|----------|
| **Yoco** | ✅ Implemented | Credit card checkout via Yoco API |
| **PayFast** | ⚠️ Partial | URL generation only, signature verification TODO |
| **Manual** | ❌ Stub | Returns "must be processed by admin" |
