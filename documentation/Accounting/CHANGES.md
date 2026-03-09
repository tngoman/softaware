# Accounting — Change Log & Known Issues

## Current State Assessment

**Module Maturity**: ⚠️ Beta / Partially Functional  
**Last Source Analysis**: 2025 (documentation audit)  
**Total Source LOC**: ~4,707 (1,764 backend + 2,943 frontend)  
**Route Count**: 25 handlers across 5 routers

---

## Known Issues

### CRITICAL

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| ACC-001 | No double-entry enforcement — debits ≠ credits not validated | `accounting.ts` POST /transactions | Books can be unbalanced; fundamental accounting integrity broken |
| ACC-002 | Ledger not auto-updated when transactions created | `accounting.ts` | Ledger balances become stale; `accounts/:id/balance` returns outdated data |
| ACC-003 | No RBAC permissions on any accounting route | All 5 routers | Any authenticated user can view financials, create transactions, generate SARS reports |

### HIGH

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| ACC-004 | Hardcoded 15% VAT rate in all calculations | `reports.ts`, `vatReports.ts`, frontend | Cannot handle rate changes; `tax_rates` table unused |
| ACC-005 | Balance sheet uses placeholder values (fixed assets = R5000, payables = R0) | `financialReports.ts` | Balance sheet does not reflect actual data |
| ACC-006 | No transaction UPDATE or DELETE in accounting router | `accounting.ts` | Cannot correct or void transactions through normalised API |
| ACC-007 | VAT201 calculates VAT on invoice_amount, not on line-item VAT tracking | `vatReports.ts` | Inaccurate SARS VAT returns — no standard/zero/exempt distinction |

### MEDIUM

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| ACC-009 | Fixed asset split hardcoded 60/40 (computer/office) | `financialReports.ts` | Balance sheet asset breakdown is fictional |
| ACC-010 | Leap year: ITR14 year-end hardcoded to Feb 28 | `vatReports.ts` | Missing Feb 29 in leap years |
| ACC-011 | No tax rate DELETE route | `accounting.ts` | Cannot remove incorrect tax rates |
| ACC-012 | No account DELETE/deactivate route | `accounting.ts` | Cannot properly retire accounts |
| ACC-013 | Frontend `clearIncome()` deletes transactions en masse | `TransactionModel.ts` | Destructive bulk operation with no undo |

### LOW

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| ACC-014 | Invoice duplicate detection uses localStorage, not server-side | `AddIncome.tsx` | Per-browser only; bypassed on different devices |
| ACC-015 | `useLegacyTables` cached as module-level boolean (no TTL) | `financialReports.ts` | Schema changes after startup not detected without restart |

---

## Required Migrations

### Phase 1: Double-Entry Enforcement (addresses ACC-001)
```sql
-- Add journal_entry_id to group paired transactions
ALTER TABLE transactions ADD COLUMN journal_entry_id INT AFTER id;
ALTER TABLE transactions ADD INDEX idx_journal (journal_entry_id);

-- Backend: Validate SUM(debits) = SUM(credits) per journal_entry_id before committing
```

### Phase 2: Auto-Ledger Updates (addresses ACC-002)
```typescript
// After inserting a transaction:
// 1. Get current balance for account
// 2. Calculate new balance (asset/expense: + debit - credit; liability/equity/income: + credit - debit)
// 3. INSERT INTO ledger (account_id, ledger_date, debit_amount, credit_amount, balance)
```

### Phase 3: Dynamic VAT Rate (addresses ACC-004)
```sql
-- Add default_rate flag to tax_rates
ALTER TABLE tax_rates ADD COLUMN is_default TINYINT(1) DEFAULT 0;
UPDATE tax_rates SET is_default = 1 WHERE tax_name = 'Standard VAT';

-- Replace all hardcoded 0.15 with:
-- const defaultRate = await db.queryOne('SELECT tax_percentage FROM tax_rates WHERE is_default = 1 AND active = 1');
```

### Phase 4: Add RBAC Permissions (addresses ACC-003)
```sql
INSERT INTO permissions (name, description, module) VALUES
  ('accounting.view',         'View chart of accounts',        'accounting'),
  ('accounting.manage',       'Create/update accounts',        'accounting'),
  ('transactions.view',       'View transactions',             'accounting'),
  ('transactions.create',     'Create transactions',           'accounting'),
  ('transactions.manage',     'Update/delete transactions',    'accounting'),
  ('reports.financial',       'View financial reports',         'accounting'),
  ('reports.tax',             'View/generate SARS tax reports', 'accounting'),
  ('expense_categories.manage', 'Manage expense categories',   'accounting');
```

### Phase 5: Add Transaction CRUD (addresses ACC-006)
```typescript
// Add to accounting.ts:
accountingRouter.put('/transactions/:id', requireAuth, requirePermission('transactions.manage'), ...);
accountingRouter.delete('/transactions/:id', requireAuth, requirePermission('transactions.manage'), ...);
```

---

## Recommended Improvements

### Short-Term (Bug Fixes)
1. **Fix VAT201 calculation**: Use actual VAT amounts from line items, not `invoice_amount × 0.15`
2. **Fix ITR14 leap year**: Use `new Date(year+1, 2, 0).toISOString().split('T')[0]` for last day of February
3. **Add transaction update/delete routes** to accounting router for normalised schema
4. **Remove placeholder functions**: Implement real fixed asset and accounts payable calculations

### Medium-Term (Security & Integrity)
5. **Enforce double-entry**: Require journal entry groups with balanced debits/credits
6. **Auto-update ledger**: Trigger ledger writes on transaction creation
7. **Add RBAC**: Financial data routes are highest priority after payments
8. **Use dynamic tax rates**: Read from `tax_rates` table instead of hardcoding 0.15
9. **Server-side duplicate detection**: Replace localStorage-based invoice number check

### Long-Term (Architecture)
10. **Unified schema**: Complete migration from legacy `tb_*` tables and remove dual-schema layer
11. **Proper asset register**: Replace hardcoded fixed assets with asset tracking module
12. **Audit trail**: Log all transaction modifications with user, timestamp, and previous values
13. **Multi-currency support**: Currently all amounts assumed ZAR
14. **Period closing**: Prevent modifications to transactions in closed accounting periods
15. **Proper journal entries**: Group related transactions into journals with narrative descriptions

---

## Dependencies for Changes

| Change | Depends On |
|--------|-----------|
| RBAC permissions | Permissions table seeded, role assignments |
| Dynamic VAT rate | Default tax rate seeded in `tax_rates` |
| Double-entry enforcement | Journal entry model, UI for balanced entry creation |
| Ledger auto-update | Account type classification (DR/CR normal balance rules) |
| Asset register | New database schema, depreciation calculation logic |
| Period closing | Accounting period management, admin-only close operation |

---

## Module History

| Date | Change | Author |
|------|--------|--------|
| — | Legacy PHP schema (`tb_*` tables) established | — |
| — | Migration 006: Created normalised schema (accounts, transactions, ledger, etc.) | — |
| — | Dual-schema financial reports added | — |
| — | SA SARS tax reports (VAT201, ITR14, IRP6) implemented | — |
| — | VAT-compliant expense/income capture forms added | — |
| — | Expense categories with ITR14 mapping added | — |

> *Exact dates unavailable — no git history annotations in source files.*
