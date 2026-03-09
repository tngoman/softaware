# Financial Reports — Change Log & Known Issues

## Current State Assessment

**Module Maturity**: ⚠️ Beta — Reports generate but with accuracy limitations  
**Last Source Analysis**: 2025 (documentation audit)  
**Total Source LOC**: ~2,148 (765 backend + 1,383 frontend)  
**Endpoints**: 9 GET-only routes across 3 routers

---

## Known Issues

### CRITICAL

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| FR-001 | VAT calculated as `invoice_amount × 0.15` instead of actual VAT tracking | `reports.ts`, `vatReports.ts` | SARS VAT201 returns will be inaccurate — doesn't distinguish standard/zero/exempt items |
| FR-002 | Balance sheet has hardcoded placeholder values (fixed assets = R5000, payables = R0) | `financialReports.ts` | Balance sheet does not reflect actual financial position |
| FR-003 | No RBAC — any authenticated user sees all financial reports | All 3 routers | Sensitive financial data exposed to all users |

### HIGH

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| FR-004 | Hardcoded 15% VAT rate — `tax_rates` table unused in calculations | Multiple files | Cannot handle rate changes or mixed-rate scenarios |
| FR-005 | Frontend type shapes don't match backend responses | Frontend types vs backend | Frontend Itr14Report expects `expenses_by_category`, `corporate_tax_27_percent` which backend doesn't return |

### MEDIUM

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| FR-007 | ITR14 fiscal year end hardcoded to Feb 28 (misses Feb 29 in leap years) | `vatReports.ts` | One day of data excluded in leap years |
| FR-008 | Balance sheet queries run sequentially (7 queries) | `financialReports.ts` | Slow response — could use `Promise.all()` |
| FR-009 | No report caching | All routes | Repeated requests re-run expensive aggregate queries |
| FR-010 | Legacy schema detection cached permanently (no TTL) | `financialReports.ts` | Schema changes require server restart |
| FR-011 | Rounding uses `Math.round(n * 100) / 100` — floating-point imprecision | `financialReports.ts` | Edge-case rounding errors on financial data |

### LOW

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| FR-012 | Fixed asset 60/40 split (computer/office) is hardcoded | `financialReports.ts` | Fictional asset breakdown |

---

## Recommended Improvements

### Short-Term (Bug Fixes)
1. **Fix VAT calculation**: Use actual tracked VAT amounts from `tb_transactions.vat_amount` or `invoice_items` VAT fields
2. **Fix leap year**: Compute last day of February dynamically
3. **Align frontend/backend types**: Either enhance backend responses or simplify frontend types
4. **Parallelise balance sheet queries**: Use `Promise.all()` for independent helper functions

### Medium-Term (Accuracy & Security)
5. **Implement real balance sheet values**: Replace placeholder functions with actual data queries for fixed assets, accounts payable, and unpaid expenses
6. **Add RBAC**: `reports.financial` and `reports.tax` permissions
7. **Dynamic VAT rate**: Query `tax_rates` table for default rate
8. **Add report caching**: Cache results with TTL (5–15 min) or cache-invalidation on transaction changes

### Long-Term (Architecture)
10. **Materialised report views**: Pre-compute reports on schedule for large datasets
11. **Complete legacy migration**: Remove dual-schema layer once all data migrated to normalised tables
12. **Export support**: PDF export for balance sheets, P&L, and SARS reports
13. **Proper SARS field mapping**: Implement full VAT201 fields (field_1 through field_19) as per SARS specifications
14. **ITR14 expense categorisation**: Implement full ITR14 expense mapping using `itr14_mapping` from expense categories
15. **Financial period management**: Support opening/closing accounting periods to prevent retroactive changes

---

## Dependencies for Changes

| Change | Depends On |
|--------|-----------|
| Real fixed assets | Asset register module (does not exist yet) |
| Accounts payable | Supplier invoice/bill tracking (does not exist yet) |
| RBAC | Permissions table seeded |
| Dynamic VAT rate | Default rate configured in `tax_rates` |
| Caching | Redis or in-memory cache infrastructure |
| Full SARS compliance | Detailed transaction-level VAT tracking per line item |

---

## Module History

| Date | Change | Author |
|------|--------|--------|
| — | Legacy PHP reporting system (tb_* tables) | — |
| — | Financial reports router with dual-schema support | — |
| — | Reports router (trial balance, VAT, income statement) | — |
| — | VAT reports router (VAT201, ITR14, IRP6) | — |
| — | Frontend report pages (Balance Sheet, P&L, Transaction Listing, VAT Reports) | — |

> *Exact dates unavailable — no git history annotations in source files.*
