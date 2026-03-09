# Payments — Field & Data Dictionary

## Database Schema: `payments` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `payment_id` | Primary key |
| `invoice_id` | `INT` (FK) | No | — | `payment_invoice` | Links to `invoices.id` |
| `payment_date` | `DATE` | No | — | `payment_date` | Payment date |
| `payment_amount` | `DECIMAL` | No | — | `payment_amount` | Payment amount |
| `payment_method` | `VARCHAR` | Yes | `NULL` | `payment_method` | Payment method label |
| `reference_number` | `VARCHAR` | Yes | `NULL` | `reference_number` | External reference |
| `remarks` | `TEXT` | Yes | `NULL` | `payment_notes` | Free-text notes |
| `created_at` | `DATETIME` | Yes | — | `payment_time` (UNIX) | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | `payment_updated` (UNIX) | Last update timestamp |

### SQL Column Aliasing (PAYMENT_SELECT)
```sql
p.id            AS payment_id,
p.invoice_id    AS payment_invoice,
p.payment_date,
p.payment_amount,
p.payment_method,
p.reference_number,
p.remarks       AS payment_notes,
0               AS payment_processed,       -- ⚠️ hardcoded 0, no DB column
UNIX_TIMESTAMP(p.created_at)  AS payment_time,
UNIX_TIMESTAMP(p.updated_at)  AS payment_updated
```

**Note**: `payment_processed` is always returned as `0` — the DB has no `processed` column. Processing creates a `transactions` row but doesn't mark the payment.

---

## Database Schema: `transactions` Table (created by payment processing)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | `INT` (PK) | No | Primary key |
| `transaction_date` | `DATE` | No | = payment_date |
| `account_id` | `INT` | No | Hardcoded to `1` (default income account) |
| `debit_amount` | `DECIMAL` | No | `0` for payment transactions |
| `credit_amount` | `DECIMAL` | No | = payment_amount |
| `description` | `VARCHAR` | No | `"Payment for invoice #${invoice_id}"` |
| `reference_number` | `VARCHAR` | No | payment reference or `"PAY-${id}"` |
| `created_at` | `DATETIME` | No | Timestamp |
| `updated_at` | `DATETIME` | No | Timestamp |

---

## Database Schema: `credit_packages` Table (used by payment service)

| Column | Type | Description |
|--------|------|-------------|
| `id` | `INT` (PK) | Package ID |
| `name` | `VARCHAR` | Package display name |
| `price` | `INT` | Price in cents (ZAR) |
| `credits` | `INT` | Base credits included |
| `bonusCredits` | `INT` | Bonus credits |
| `isActive` | `TINYINT` | 1=available for purchase |

---

## Zod Validation Schemas

### `createPaymentSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `payment_invoice` | `number` | Yes | `int().positive()` |
| `payment_amount` | `number` | Yes | `positive()` |
| `payment_date` | `string` | No | — (defaults to today) |
| `process_payment` | `boolean` | No | — |

### `updatePaymentSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `payment_invoice` | `number` | No | `int().positive()` |
| `payment_amount` | `number` | No | `positive()` |
| `payment_date` | `string` | No | — |
| `payment_processed` | `number` | No | `int()` |

---

## API Response Schemas

### Payment Object
```json
{
  "payment_id": 1,
  "payment_invoice": 5,
  "payment_date": "2024-02-01",
  "payment_amount": 750.00,
  "payment_method": null,
  "reference_number": null,
  "payment_notes": null,
  "payment_processed": 0,
  "payment_time": 1706745600,
  "payment_updated": 1706745600,
  "invoice_number": "INV-001"
}
```

### Process Response
```json
{
  "success": true,
  "processed": [
    { "payment_id": 1, "transaction_id": 42 },
    { "payment_id": 2, "transaction_id": 43 }
  ],
  "errors": [
    { "payment_id": 3, "message": "Duplicate entry..." }
  ]
}
```

### Payment Gateway Response (Service)
```json
{
  "success": true,
  "paymentUrl": "https://online.yoco.com/v1/checkouts/...",
  "paymentId": "checkout_abc123"
}
```

---

## Service Interfaces

### `PaymentRequest`
```typescript
interface PaymentRequest {
  teamId: string;       // Legacy: used only for credit balance scoping
  packageId: string;
  provider: 'PAYFAST' | 'YOCO' | 'MANUAL';
  returnUrl?: string;
  cancelUrl?: string;
}
```

### `PaymentResponse`
```typescript
interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
}
```

### `YocoCheckoutRequest`
```typescript
interface YocoCheckoutRequest {
  amount: number;        // Amount in cents
  currency: string;      // "ZAR"
  description: string;   // Package name + credits
  metadata: {
    teamId: string;      // Legacy: credit balance scoping only
    packageId: string;
    teamName: string;    // Legacy: display name from teams table
    credits: number;
    userId: string;
  };
  success_url?: string;
  cancel_url?: string;
  name?: string;
  email?: string;
}
```

---

## Frontend TypeScript Types

### `Payment` (from `types/index.ts`)
```typescript
interface Payment {
  payment_id?: number;
  payment_invoice: number;
  payment_date: string;
  payment_amount: number;
  payment_method?: string;
  reference_number?: string;
  payment_notes?: string;
  payment_processed?: number;
  payment_time?: number;
  payment_updated?: number;
  invoice_number?: string;
}
```

### `PaymentFormData` (PaymentModal.tsx)
```typescript
interface PaymentFormData {
  payment_amount: number;
  payment_date: string;
  process_payment: boolean;
}
```

---

## Frontend Component Props

### `PaymentModalProps`
| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Modal visibility |
| `onClose` | `() => void` | Close handler |
| `onSubmit` | `(data) => Promise<void>` | Submit handler |
| `invoiceId` | `number` | Invoice being paid |
| `invoiceTotal` | `number` | Total invoice amount |
| `amountPaid` | `number` | Already paid amount |
| `loading` | `boolean` | Loading state |

---

## Environment Variables (Payment Service)

| Variable | Purpose | Required By |
|----------|---------|-------------|
| `PAYFAST_MERCHANT_ID` | PayFast merchant ID | PayFast |
| `PAYFAST_MERCHANT_KEY` | PayFast merchant key | PayFast |
| `PAYFAST_PASSPHRASE` | PayFast passphrase | PayFast |
| `YOCO_SECRET_KEY` | Yoco API secret key | Yoco |
| `YOCO_WEBHOOK_SECRET` | Yoco webhook HMAC secret | Yoco webhooks |
| `FRONTEND_URL` | Redirect URL base | Yoco success/cancel URLs |
