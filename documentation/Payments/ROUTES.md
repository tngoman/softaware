# Payments — Route & API Reference

## Route Registration

**Backend mount point**: `/v1/payments` (all routes require JWT via `requireAuth`)

```
src/routes/payments.ts → paymentsRouter mounted at /v1/payments
```

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/payments` | List payments (paginated, searchable, filterable) |
| 2 | GET | `/v1/payments/unprocessed` | List unprocessed payments |
| 3 | GET | `/v1/payments/invoice/:invoiceId` | Payments for specific invoice |
| 4 | GET | `/v1/payments/:id` | Get single payment |
| 5 | POST | `/v1/payments` | Create payment |
| 6 | PUT | `/v1/payments/:id` | Update payment |
| 7 | DELETE | `/v1/payments/:id` | Hard delete payment |
| 8 | POST | `/v1/payments/process` | Batch process into transactions |

---

## Detailed Route Documentation

### 1. GET `/v1/payments`
**Purpose**: List all payments with pagination, search, and invoice filter  
**Auth**: JWT required  
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `50` | Items per page |
| `search` | `string` | `''` | Search reference_number, remarks, invoice_number |
| `invoice_id` | `number` | — | Filter to specific invoice |

**SQL**:
```sql
SELECT {PAYMENT_SELECT}, i.invoice_number
FROM payments p LEFT JOIN invoices i ON p.invoice_id = i.id
WHERE 1=1
[AND p.invoice_id = ?]
[AND (p.reference_number LIKE ? OR p.remarks LIKE ? OR i.invoice_number LIKE ?)]
ORDER BY p.payment_date DESC
LIMIT ? OFFSET ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": [{ /* Payment objects */ }],
  "pagination": { "page": 1, "limit": 50, "total": 45 }
}
```

---

### 2. GET `/v1/payments/unprocessed`
**Purpose**: List payments not yet processed into accounting transactions  
**Auth**: JWT required  
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | `number` | `50` | Max results |
| `invoice_id` | `number` | — | Filter to specific invoice |

**Note**: Since `payment_processed` is hardcoded to `0` in PAYMENT_SELECT, this essentially returns all payments. There's no actual filtering by processed status.

**Response** `200`: `{ success: true, data: [{ /* Payments with invoice details */ }] }`

---

### 3. GET `/v1/payments/invoice/:invoiceId`
**Purpose**: Get all payments for a specific invoice  
**Auth**: JWT required

**Response** `200`: `{ success: true, data: [{ /* Payment objects */ }] }`

---

### 4. GET `/v1/payments/:id`
**Purpose**: Get single payment by ID  
**Auth**: JWT required

**Response** `200`: `{ success: true, data: { /* Payment */ } }`  
**Error** `404`: `{ error: "Payment not found" }`

---

### 5. POST `/v1/payments`
**Purpose**: Create a payment against an invoice  
**Auth**: JWT required  
**Body**: Validated with `createPaymentSchema`

**Flow**:
1. Zod validate request body
2. Verify invoice exists → `400` if not
3. INSERT into `payments` with defaults (null method, reference, remarks)
4. Check if invoice fully paid: `SUM(payment_amount)` ≥ `invoice_amount`
5. If fully paid → `UPDATE invoices SET paid = 1`
6. Return created payment

**Response** `201`: `{ success: true, data: { /* Payment */ } }`

**⚠️ Issues**:
- Sets `paid = 1` (shown as "Partial") not `paid = 2` ("Paid") — same bug as invoices router
- `payment_method`, `reference_number`, `remarks` always null (not passed from schema)

---

### 6. PUT `/v1/payments/:id`
**Purpose**: Update payment fields  
**Auth**: JWT required  
**Body**: Validated with `updatePaymentSchema`

**Flow**:
1. Verify payment exists → `404` if not
2. Dynamic UPDATE (only provided fields + `updated_at`)
3. Return updated payment

**Response** `200`: `{ success: true, data: { /* Payment */ } }`

---

### 7. DELETE `/v1/payments/:id`
**Purpose**: Hard delete a payment record  
**Auth**: JWT required  
**Note**: Unlike other modules, this is a **hard delete** (`DELETE FROM`), not soft delete

**Flow**:
1. Verify payment exists → `404` if not
2. `DELETE FROM payments WHERE id = ?`
3. **⚠️ Does not recalculate invoice paid status** after deletion

**Response** `200`: `{ success: true, message: "Payment deleted" }`

---

### 8. POST `/v1/payments/process`
**Purpose**: Convert payments into accounting transactions  
**Auth**: JWT required  
**Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `payment_ids` | `number[]` | Either this or `invoice_id` | Specific payment IDs to process |
| `invoice_id` | `number` | Either this or `payment_ids` | Process all payments for an invoice |

**Flow**:
1. Load target payments (by IDs or by invoice)
2. For each payment → INSERT into `transactions` table:
   - `account_id = 1` (hardcoded default income account)
   - `debit_amount = 0`
   - `credit_amount = payment_amount`
   - `description = "Payment for invoice #${invoice_id}"`
3. Collect results and errors per payment
4. Return combined result

**Response** `200`:
```json
{
  "success": true,
  "processed": [{ "payment_id": 1, "transaction_id": 42 }],
  "errors": [{ "payment_id": 3, "message": "Duplicate entry" }]
}
```

**⚠️ Issues**:
- `account_id` hardcoded to `1` — should be configurable
- No idempotency check — processing same payment twice creates duplicate transactions
- Payments are not marked as processed after creation

---

## Payment Gateway Routes (via Service)

The payment service is consumed by subscription/credits routes, not directly exposed:

### `createPayment(request: PaymentRequest) → PaymentResponse`
- PayFast: Generates redirect URL with merchant credentials
- Yoco: Calls `POST https://online.yoco.com/v1/checkouts` with amount, metadata, redirect URLs

### `processPaymentCallback(provider, payload, signature?)`
- PayFast: Validates `payment_status === 'COMPLETE'`, matches amount to package, adds credits
- Yoco: Verifies HMAC-SHA256 signature, checks status, validates amount, checks idempotency, adds credits

---

## Frontend Route Mapping

No dedicated payments page exists. Payments are managed within:

| URL Path | Component | Payment Features |
|----------|-----------|-----------------|
| `/invoices/:id` | `Invoices` | PaymentModal for recording, payment list, process buttons |
| `/transactions` | `Transactions` | Shows processed payments, bulk process unprocessed |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|----------------|--------------|------|---------------|
| Load all payments | `PaymentModel.getAll(params)` | GET | `/v1/payments` |
| Get payment by ID | `PaymentModel.getById(id)` | GET | `/v1/payments/:id` |
| Get invoice payments | `PaymentModel.getByInvoice(invoiceId)` | GET | `/v1/payments/invoice/:invoiceId` |
| Get unprocessed | `PaymentModel.getUnprocessed(params)` | GET | `/v1/payments/unprocessed` |
| Record payment | `PaymentModel.create(data)` | POST | `/v1/payments` |
| Update payment | `PaymentModel.update(id, data)` | PUT | `/v1/payments/:id` |
| Delete payment | `PaymentModel.delete(id)` | DELETE | `/v1/payments/:id` |
| Process payments | `PaymentModel.process(data)` | POST | `/v1/payments/process` |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| All payment operations | — | JWT authentication only |

> ⚠️ **No RBAC permissions exist for payments.** Any authenticated user can record, modify, delete, and process payments.
