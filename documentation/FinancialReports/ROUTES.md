# Financial Reports — Route & API Reference

## Route Registration

```
apiRouter.use('/financial-reports',  financialReportsRouter);  // balance-sheet, profit-loss, transaction-listing
apiRouter.use('/reports',            reportsRouter);           // trial-balance, vat, income-statement
apiRouter.use('/vat-reports',        vatReportsRouter);        // vat201, itr14, irp6
```

All routes require JWT authentication via `requireAuth`. All routes are GET-only (read-only reporting).

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/financial-reports/balance-sheet` | Balance sheet as of date |
| 2 | GET | `/v1/financial-reports/profit-loss` | Profit & loss for period |
| 3 | GET | `/v1/financial-reports/transaction-listing` | Transaction listing for period |
| 4 | GET | `/v1/reports?type=trial-balance` | Trial balance for period |
| 5 | GET | `/v1/reports?type=vat` | VAT summary for period |
| 6 | GET | `/v1/reports?type=income-statement` | Income statement for period |
| 7 | GET | `/v1/vat-reports?type=vat201` | SARS VAT201 return |
| 8 | GET | `/v1/vat-reports?type=itr14` | SARS ITR14 corporate tax |
| 9 | GET | `/v1/vat-reports?type=irp6` | SARS IRP6 provisional tax |

**Total: 9 read-only endpoints across 3 routers**

---

## Detailed Route Documentation

### 1. GET `/v1/financial-reports/balance-sheet`
**Query params**: `as_of_date` (default: today)  
**Dual-schema**: Yes — auto-detects legacy vs normalised tables  
**Logic**:
1. `checkLegacyTables()` — probe for `tb_transactions`
2. Call 7 helper functions (legacy or fallback) for each balance sheet component
3. Compute derived values (current assets, total assets, liabilities, equity)
4. Round all values to 2 decimal places

**Data sources (legacy)**: `tb_transactions`, `tb_invoices`, `tb_payments`  
**Data sources (normalised)**: `accounts`, `transactions`, `invoices`, `payments`  
**Response**: Full balance sheet (see FIELDS.md)

---

### 2. GET `/v1/financial-reports/profit-loss`
**Required params**: `start_date`, `end_date`  
**Dual-schema**: Yes  
**Logic**:
1. Get total sales (income transactions for period)
2. Get total purchases (cost-of-sales expenses for period)
3. Get expenses by category (operating expenses grouped)
4. Calculate gross profit = sales − purchases
5. Calculate net profit = gross profit − operating expenses

**Response**: Full P&L (see FIELDS.md)

---

### 3. GET `/v1/financial-reports/transaction-listing`
**Required params**: `start_date`, `end_date`; optional: `type` (income/expense)  
**Dual-schema**: Yes  
**Logic**:
1. Query all transactions in date range, optionally filtered by type
2. Map to standard format: id, date, type, supplier, reference, vat_type, net, vat, gross
3. Accumulate totals

**Response**: Transaction list with running totals

---

### 4. GET `/v1/reports?type=trial-balance`
**Query params**: `from`, `to` (defaults: Jan 1 → today)  
**Schema**: Normalised only (accounts + transactions)  
**Logic**: Aggregate SUM(debit), SUM(credit) per account for date range  
**Response**: Account list with totals

---

### 5. GET `/v1/reports?type=vat`
**Query params**: `from`, `to`  
**Schema**: Normalised only  
**Logic**:
- Output VAT = `SUM(invoice_amount) × 0.15` for period invoices
- Input VAT = `SUM(expense debit_amount) × 0.15` for period expense transactions
- Net VAT = output − input

**⚠️**: Uses hardcoded 15% rate, ignores actual VAT tracking on line items

---

### 6. GET `/v1/reports?type=income-statement`
**Query params**: `from`, `to`  
**Schema**: Normalised only  
**Logic**: Groups income accounts (credit − debit) and expense accounts (debit − credit)  
**Response**: Income/expense breakdown with net profit

---

### 7. GET `/v1/vat-reports?type=vat201`
**Required params**: `period_start`, `period_end`  
**Schema**: Normalised only  
**Logic**: SA VAT201 calculation
- Total sales from invoices in period
- Total purchases from expense transactions in period
- Apply 15% rate to both
- Calculate payable (max 0) and refundable (max 0)

---

### 8. GET `/v1/vat-reports?type=itr14`
**Query params**: `year` (default: current year)  
**Fiscal period**: March 1 of year → February 28 of year+1  
**Schema**: Normalised only  
**Logic**: Aggregate income and expense transactions for SA fiscal year  
**Response**: Gross income, expenses, taxable income

---

### 9. GET `/v1/vat-reports?type=irp6`
**Query params**: `to_date` (default: today)  
**Period**: March 1 of to_date's year → to_date  
**Schema**: Normalised only  
**Logic**: Year-to-date income and expenses  
**Response**: Estimated income, expenses, taxable amount

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|-----------------|-------------|------|---------------|
| View balance sheet | `FinancialReportModel.getBalanceSheet({ as_of_date })` | GET | `/v1/financial-reports/balance-sheet` |
| View P&L | `FinancialReportModel.getProfitLoss({ start_date, end_date })` | GET | `/v1/financial-reports/profit-loss` |
| View transactions | `FinancialReportModel.getTransactionListing({ start_date, end_date, type? })` | GET | `/v1/financial-reports/transaction-listing` |
| Trial balance | `ReportModel.getTrialBalance({ from, to })` | GET | `/v1/reports?type=trial-balance` |
| VAT summary | `ReportModel.getVatReport({ from, to })` | GET | `/v1/reports?type=vat` |
| Income statement | `ReportModel.getIncomeStatement({ from, to })` | GET | `/v1/reports?type=income-statement` |
| VAT201 report | `VatReportModel.getVat201({ period_start, period_end })` | GET | `/v1/vat-reports?type=vat201` |
| ITR14 report | `VatReportModel.getItr14({ year })` | GET | `/v1/vat-reports?type=itr14` |
| IRP6 report | `VatReportModel.getIrp6({ to_date })` | GET | `/v1/vat-reports?type=irp6` |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| All financial reports | — | JWT authentication only |

> ⚠️ **No RBAC permissions exist.** Any authenticated user can view all financial reports including SARS tax reports. Financial data should be restricted to finance roles.
