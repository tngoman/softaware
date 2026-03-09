# Payments — Change Log & Known Issues

## Current State Assessment

**Module Maturity**: ⚠️ Alpha / Partially Functional  
**Last Source Analysis**: 2025 (documentation audit)  
**Total Source LOC**: ~880 (232 routes + 340 service + 218 modal + 30 badge + 60 model)

---

## Known Issues

### CRITICAL

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| PAY-001 | Paid status set to 1 (Partial) instead of 2 (Paid) | `payments.ts` POST / | Fully paid invoices show yellow "Partial" badge instead of green "Paid" |
| PAY-002 | No RBAC permissions on any route | `payments.ts` (all) | Any authenticated user can create, modify, delete, and process payments |
| PAY-003 | PayFast signature verification not implemented | `payment.ts` service | Forged PayFast callbacks could grant credits without real payment |
| PAY-004 | Payments not marked as processed | `payments.ts` POST /process | Same payment can be processed repeatedly, creating duplicate transactions |

### HIGH

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| PAY-005 | Hardcoded `payment_processed = 0` in SELECT | `payments.ts` PAYMENT_SELECT | GET /unprocessed returns ALL payments, not just unprocessed |
| PAY-006 | Hardcoded `account_id = 1` in transaction creation | `payments.ts` POST /process | All transactions go to same account — multi-account bookkeeping broken |
| PAY-008 | Invoice paid status not recalculated on delete | `payments.ts` DELETE /:id | Invoice remains "paid" after its payment is deleted |

### MEDIUM

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| PAY-009 | No backend overpayment validation | `payments.ts` POST / | API accepts payment_amount > outstanding balance |
| PAY-010 | payment_method, reference_number, remarks hardcoded null | `payments.ts` POST / | Frontend sends these fields but backend discards them |
| PAY-011 | Hard delete with no audit trail | `payments.ts` DELETE /:id | Financial records permanently lost, no undo capability |

### LOW

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| PAY-012 | PayFast merchant credentials in ENV but not validated on startup | `payment.ts` service | Silent failure if env vars missing |
| PAY-013 | Yoco secret key used in both header and HMAC | `payment.ts` service | Single key compromise exposes both API access and verification |

---

## Required Migrations

### Phase 1: Fix Payment Status (addresses PAY-001)
```sql
-- Fix auto-paid logic to use correct status value
-- In payments.ts, change: paid = 1 → paid = 2
-- Also fix any historically incorrect records:
UPDATE invoices i
SET i.paid = 2
WHERE i.paid = 1
  AND (SELECT COALESCE(SUM(p.payment_amount), 0) FROM payments p WHERE p.invoice_id = i.id) >= i.invoice_amount;
```

### Phase 2: Add payment_processed tracking (addresses PAY-004, PAY-005)
```sql
-- Add actual processing tracking column
ALTER TABLE payments ADD COLUMN payment_processed TINYINT(1) DEFAULT 0 AFTER payment_amount;

-- Update PAYMENT_SELECT to use actual column instead of hardcoded 0:
-- REMOVE: 0 AS payment_processed
-- ADD:    p.payment_processed

-- After POST /process, mark source payments:
-- UPDATE payments SET payment_processed = 1 WHERE id IN (?)
```

### Phase 3: Add RBAC permissions (addresses PAY-002)
```sql
INSERT INTO permissions (name, description, module) VALUES
  ('payments.view', 'View payments', 'payments'),
  ('payments.create', 'Record payments', 'payments'),
  ('payments.update', 'Modify payments', 'payments'),
  ('payments.delete', 'Delete payments', 'payments'),
  ('payments.process', 'Process payments to transactions', 'payments');

-- Add to appropriate roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.module = 'payments';
```

---

## Recommended Improvements

### Short-Term (Bug Fixes)
1. **Fix paid status value**: Change `paid = 1` to `paid = 2` in auto-paid detection
2. **Persist payment fields**: Map `payment_method`, `reference_number`, `remarks` from request body to INSERT
3. **Recalculate on delete**: After deleting a payment, re-check and update invoice paid status
4. **Add overpayment check**: Validate `payment_amount ≤ outstanding_balance` server-side

### Medium-Term (Security & Integrity)
5. **Add RBAC permissions**: Wrap all routes in `requirePermission()` — financial routes are highest priority
6. **Implement PayFast signature verification**: Complete the TODO in payment service callback handler
7. **Add processing idempotency**: Track `payment_processed` flag, prevent double-processing

### Long-Term (Architecture)
9. **Soft delete for payments**: Replace hard DELETE with `active = 0` for audit trail
10. **Configurable transaction accounts**: Replace hardcoded `account_id = 1` with chart-of-accounts mapping
11. **Payment gateway abstraction**: Refactor if/else provider logic into proper strategy pattern with interfaces
12. **Webhook retry handling**: Add idempotency to all payment callbacks (currently only Yoco credit purchases)
13. **Payment receipts**: Generate and email payment confirmation (similar to invoice PDF flow)
14. **Refund support**: Add refund/credit-note workflow for reversed payments

---

## Dependencies for Changes

| Change | Depends On |
|--------|-----------|
| RBAC permissions | Permissions table seeded, role assignments configured |
| Transaction account mapping | Chart of accounts / account categories defined in Accounting module |
| Payment receipts | Email service (already exists), PDF generator (already exists for invoices) |
| Refund support | New database schema, accounting journal entry patterns |

---

## Module History

| Date | Change | Author |
|------|--------|--------|
| — | Initial implementation: basic CRUD, auto-paid detection | — |
| — | Added PayFast integration for credit purchases | — |
| — | Added Yoco Checkout API integration | — |
| — | Added batch processing to transactions | — |
| — | PaymentModal frontend component added | — |

> *Exact dates unavailable — no git history annotations in source files.*
