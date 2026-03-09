# Payments — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/payments.ts` (232 LOC)
**Purpose**: REST API for invoice payment management  
**Mount**: `/v1/payments` via `paymentsRouter`

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports & setup | 1–6 | Express, Zod, db, auth, httpErrors |
| `PAYMENT_SELECT` | 8–20 | SQL column alias fragment (10 columns) |
| `createPaymentSchema` | 22–27 | Zod schema for payment creation |
| `updatePaymentSchema` | 29–34 | Zod schema for payment update |
| `GET /` | 36–80 | List payments with pagination, search, invoice filter |
| `GET /unprocessed` | 82–110 | List unprocessed payments |
| `GET /invoice/:invoiceId` | 112–125 | Payments for specific invoice |
| `GET /:id` | 127–140 | Get single payment |
| `POST /` | 142–180 | Create payment with auto-paid detection |
| `PUT /:id` | 182–210 | Update payment |
| `DELETE /:id` | 212–225 | Hard delete payment |
| `POST /process` | 227–232 | Batch process payments into transactions |

---

### `/var/opt/backend/src/services/payment.ts` (340 LOC)
**Purpose**: Payment gateway integration for credit purchases  
**Used by**: Subscription/Credits routes (not directly by payments router)

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Types & interfaces | 1–30 | PaymentProvider, PaymentRequest, PaymentResponse |
| `createPayment()` | 32–80 | Main entry point — routes to provider |
| `processPaymentCallback()` | 82–100 | Webhook handler dispatcher |
| PayFast integration | 102–180 | URL generation, callback processing |
| Yoco integration | 182–300 | Checkout API, webhook processing, signature verification |
| `verifyWebhookSignature()` | 302–340 | Provider-agnostic signature verification |

---

## Frontend Files

### `/var/opt/frontend/src/models/OtherModels.ts` (lines 142–210)
**Purpose**: `PaymentModel` static API wrapper

| Method | HTTP | Endpoint |
|--------|------|----------|
| `getAll(params?)` | GET | `/payments` |
| `getById(id)` | GET | `/payments/:id` |
| `getByInvoice(invoiceId)` | GET | `/payments/invoice/:invoiceId` |
| `getUnprocessed(params?)` | GET | `/payments/unprocessed` |
| `create(payload)` | POST | `/payments` |
| `update(id, payload)` | PUT | `/payments/:id` |
| `delete(id)` | DELETE | `/payments/:id` |
| `process(payload)` | POST | `/payments/process` |

---

### `/var/opt/frontend/src/components/UI/PaymentModal.tsx` (218 LOC)
**Purpose**: Modal dialog for recording invoice payments

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Interfaces | 1–20 | PaymentFormData, PaymentModalProps |
| Component setup | 22–55 | useForm with defaults, outstanding calculation |
| Form handlers | 57–75 | Submit, close, currency formatting |
| Modal overlay | 77–95 | Backdrop, positioning |
| Header | 97–115 | Gradient header with invoice ID |
| Payment summary | 117–145 | Total, paid, outstanding display |
| Amount input | 147–180 | Input with quick buttons (50%, Full) |
| Date input | 182–195 | Date picker |
| Balance preview | 197–210 | Post-payment balance calculation |
| VAT toggle | 212–218 | Process payment checkbox |

---

### `/var/opt/frontend/src/components/Invoices/PaymentStatusBadge.tsx` (30 LOC)
**Purpose**: Color-coded payment status badge

| Status | Label | Colors |
|--------|-------|--------|
| `0` (default) | Unpaid | `bg-red-100 text-red-800` |
| `1` | Partial | `bg-yellow-100 text-yellow-800` |
| `2` | Paid | `bg-green-100 text-green-800` |

---

## File Relationship Map

```
payments.ts (backend router) ─── Invoice Payments
  ├── POST / → payments table
  │     └── auto-updates invoices.paid when fully paid
  ├── POST /process → transactions table (creates accounting entries)
  ├── GET /invoice/:id → per-invoice payment list
  └── GET /unprocessed → unprocessed payment list

payment.ts (backend service) ─── Credit Purchases
  ├── createPayment() → PayFast URL or Yoco Checkout API
  ├── processPaymentCallback()
  │     ├── PayFast callback → addCredits()
  │     └── Yoco webhook → verify signature → addCredits()
  └── depends on: credits service, credit_packages table

PaymentModel (frontend)
  └── all methods → axios → payments.ts routes

PaymentModal.tsx (frontend component)
  ├── used by Invoices.tsx
  ├── uses react-hook-form
  └── calls PaymentModel.create()

PaymentStatusBadge.tsx (frontend component)
  └── used by Invoices.tsx, InvoiceDetails.tsx
```

## Total Lines of Code

| File | LOC |
|------|----:|
| `payments.ts` (routes) | 232 |
| `payment.ts` (service) | 340 |
| `PaymentModel` (in OtherModels) | ~60 |
| `PaymentModal.tsx` | 218 |
| `PaymentStatusBadge.tsx` | 30 |
| **Total** | **~880** |
