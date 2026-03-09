# Payments — Architecture Patterns & Anti-Patterns

## Dual-Domain Architecture

The Payments module spans two distinct domains with different data flows:

### Domain 1: Invoice Payments (Manual)
```
PaymentModal → PaymentModel.create() → POST /v1/payments → INSERT payments
                                                          → Check auto-paid
                                                          → UPDATE invoices.paid
```
- User-initiated via modal on invoice detail view
- Records cash, EFT, or other payment methods against invoices
- Immediate database write with auto-paid detection
- Amount validated against outstanding balance (frontend only)

### Domain 2: Credit Purchases (Gateway)
```
User → Select Package → payment.ts service → PayFast/Yoco
     ← Redirect URL ←                     
                                           → Gateway processes
                                           → Webhook callback
                                           → Verify signature
                                           → Add credits
```
- Automated via PayFast redirect or Yoco Checkout API
- No direct payments table write — credits added to users table
- Asynchronous callback/webhook processing
- Provider-specific verification (HMAC for Yoco, signature for PayFast)

---

## Key Patterns

### 1. Auto-Paid Detection
After creating a payment, the system checks if the invoice is fully covered:

```
SUM(payment_amount) WHERE invoice_id = ? >= invoice_amount → SET paid = 1
```

**Pattern**: Derived status from aggregate query at write time  
**Problem**: Uses `paid = 1` which maps to "Partial" in frontend badge (see Anti-Patterns)

### 2. Hard Delete
Unlike contacts, invoices, and quotations (which have `active = 0/1` soft delete):

```sql
DELETE FROM payments WHERE id = ?
```

**Rationale**: Payments may need to be voided/removed for accounting corrections  
**Problem**: No audit trail, no recalculation of invoice paid status after deletion

### 3. Batch Processing to Transactions
Payments can be batch-converted to accounting transactions:

```
payment_ids[] → For each → INSERT INTO transactions (account_id=1, credit_amount=payment_amount)
```

**Pattern**: Event-sourcing-lite — payments are raw events, transactions are the accounting record  
**Problem**: No idempotency, no marking source as processed

### 4. Webhook Idempotency (Gateway only)
```typescript
const existingPayment = await db.query(
  'SELECT id FROM payments WHERE externalPaymentId = ?', [checkoutId]
);
if (existingPayment.length > 0) return; // Already processed
```

**Pattern**: Check-before-write using external ID as dedup key  
**Scope**: Only for Yoco credit purchases, not for invoice payment processing

### 5. Multi-Provider Gateway Strategy
```typescript
// Provider selection via request parameter
if (provider === 'payfast') { /* URL generation */ }
else if (provider === 'yoco') { /* API checkout */ }
```

**Pattern**: Strategy pattern (informal, via if/else)  
**Each provider has distinct**:
- Authentication (merchant keys vs secret key + HMAC)
- Flow (redirect vs API + webhook)
- Verification (signature string vs HMAC-SHA256)

### 6. Outstanding Balance Calculation (Frontend)
```typescript
const outstandingBalance = invoiceTotal - amountPaid;
// Quick-fill buttons
<button onClick={() => setValue('amount', outstandingBalance * 0.5)}>50%</button>
<button onClick={() => setValue('amount', outstandingBalance)}>Full Amount</button>
```

**Pattern**: Derived computed values with convenience shortcuts  
**Note**: No backend validation prevents overpayment

### 7. VAT Ledger Toggle
```typescript
<input type="checkbox" {...register('process_payment')} />
// Label: "Add to VAT ledger"
```

**Pattern**: User-controlled accounting flag on payment creation  
**Maps to**: `payment_processed` field (despite the name suggesting automatic processing)

---

## Anti-Patterns & Technical Debt

### PAY-AP-001: Paid Status Value Mismatch ⚠️ CRITICAL
**Location**: `payments.ts` line ~150  
**Problem**: Auto-paid sets `paid = 1` but `PaymentStatusBadge` maps `1 = Partial (yellow)`  
**Expected**: Should set `paid = 2` for fully paid (green)  
**Impact**: Fully paid invoices display as "Partial" in UI

### PAY-AP-002: Hardcoded Account ID
**Location**: `payments.ts` POST `/process`  
**Problem**: `account_id = 1` for all transactions  
**Impact**: All payment transactions go to same account regardless of type, making multi-account bookkeeping impossible

### PAY-AP-003: No Payment Processing Tracking
**Location**: `payments.ts` POST `/process`  
**Problem**: After inserting into `transactions`, the source payment is not updated. No `payment_processed = 1` write.  
**Impact**: Same payment can be processed into transactions multiple times (duplicate accounting entries)

### PAY-AP-004: Hardcoded `payment_processed = 0` in SELECT
**Location**: `payments.ts` line ~10 (PAYMENT_SELECT constant)  
```sql
0 AS payment_processed  -- always 0 regardless of actual state
```
**Impact**: GET `/unprocessed` returns ALL payments, not just unprocessed ones. The filtering concept exists but isn't functional.

### PAY-AP-005: PayFast Signature Verification Not Implemented
**Location**: `payment.ts` service  
**Problem**: PayFast callback handler does not verify the signature/source. Comment marked as TODO.  
**Impact**: Potential for forged payment confirmations

### PAY-AP-006: No RBAC Permissions
**Location**: `payments.ts` (all routes)  
**Problem**: No `requirePermission()` middleware on any payment route  
**Impact**: Any authenticated user can create, modify, delete, and process payments — severe for financial operations

### PAY-AP-007: Invoice Paid Status Not Recalculated on Delete
**Location**: `payments.ts` DELETE `/:id`  
**Problem**: Hard deleting a payment doesn't recalculate whether the invoice is still paid  
**Impact**: Invoice can remain `paid = 1` even after its only payment is deleted

### PAY-AP-008: No Backend Overpayment Validation
**Location**: `payments.ts` POST `/`  
**Problem**: No check that `payment_amount ≤ outstanding_balance`  
**Impact**: Users can record payments exceeding invoice total. Frontend prevents this but API doesn't.

### PAY-AP-009: Payment Fields Dropped on Create
**Location**: `payments.ts` POST `/`  
```typescript
payment_method: null,
reference_number: null,
remarks: null,
```
**Problem**: Schema may accept these fields but the insert hardcodes them to null  
**Impact**: Payment method/reference data from PaymentModal is not persisted

---

## Data Flow Diagrams

### Invoice Payment Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ PaymentModal │────▶│   POST /     │────▶│   payments   │
│ (react-hook- │     │  payments    │     │    table     │
│    form)     │     │              │     └──────┬───────┘
└──────────────┘     │  Auto-paid   │            │
                     │  detection   │     ┌──────▼───────┐
                     └──────────────┘     │   invoices   │
                                          │ paid = 0|1   │
                                          └──────────────┘
```

### Payment Processing Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  payments    │────▶│ POST /process│────▶│ transactions │
│   table      │     │              │     │    table     │
│ (source)     │     │ account_id=1 │     │ (accounting) │
└──────────────┘     │ debit=0      │     └──────────────┘
  NOT marked         │ credit=amount│
  as processed       └──────────────┘
```

### Credit Purchase Flow
```
┌───────┐     ┌───────────┐     ┌─────────┐     ┌──────────┐
│ User  │────▶│ payment.ts│────▶│ PayFast │────▶│ Callback │
│       │     │  service  │     │  /Yoco  │     │ Webhook  │
│       │     │           │◀────│         │◀────│          │
└───────┘     │ Verify +  │     └─────────┘     └──────────┘
              │ Add Credits│
              └───────────┘
```

---

## Relationship to Other Modules

| Module | Relationship |
|--------|-------------|
| **Invoices** | Parent — payments reference `invoice_id`. Auto-paid updates `invoices.paid`. |
| **Accounting** | Downstream — `/process` creates `transactions` records |
| **Subscription** | Parallel — credit purchases use same payment service but different tables |
| **Contacts** | Indirect — invoices belong to contacts, payments inherit contact context |
