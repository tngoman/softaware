# Financial Reports — File Inventory

## Backend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| financialReports.ts | `src/routes/financialReports.ts` | 486 | Balance sheet, profit & loss, transaction listing (dual-schema) |
| reports.ts | `src/routes/reports.ts` | 135 | Trial balance, VAT summary, income statement |
| vatReports.ts | `src/routes/vatReports.ts` | 144 | SARS VAT201, ITR14, IRP6 tax reports |

**Backend Total: 765 LOC**

## Frontend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| BalanceSheet.tsx | `src/pages/BalanceSheet.tsx` | 295 | Balance sheet display with date selector |
| ProfitAndLoss.tsx | `src/pages/ProfitAndLoss.tsx` | 258 | P&L statement with date range selector |
| TransactionListing.tsx | `src/pages/TransactionListing.tsx` | 226 | Transaction listing report with type filter |
| VatReports.tsx | `src/pages/VatReports.tsx` | 464 | Tabbed SARS reports (VAT201, ITR14, IRP6) |
| OtherModels.ts (partial) | `src/models/OtherModels.ts` | ~60 | ReportModel, VatReportModel, FinancialReportModel |
| types/index.ts (partial) | `src/types/index.ts` | ~80 | Vat201Report, Itr14Report, Irp6Report, VatPeriod |

**Frontend Total: ~1,383 LOC**

## Combined Total: ~2,148 LOC

---

## File Relationship Map

```
Backend Routers                         Frontend Pages
┌──────────────────────┐               ┌──────────────────────┐
│ financialReports.ts  │◀──────────────│ BalanceSheet.tsx      │
│ /balance-sheet       │ Financial     │ ProfitAndLoss.tsx     │
│ /profit-loss         │ ReportModel   │ TransactionListing.tsx│
│ /transaction-listing │               │                       │
├──────────────────────┤               ├──────────────────────┤
│ reports.ts           │◀──────────────│ (consumed by          │
│ ?type=trial-balance  │ ReportModel   │  VatReports.tsx       │
│ ?type=vat            │               │  and other pages)     │
│ ?type=income-statement│              │                       │
├──────────────────────┤               ├──────────────────────┤
│ vatReports.ts        │◀──────────────│ VatReports.tsx        │
│ ?type=vat201         │ VatReport     │ (tabbed: VAT201,      │
│ ?type=itr14          │ Model         │  ITR14, IRP6)         │
│ ?type=irp6           │               │                       │
└──────────────────────┘               └──────────────────────┘

Data Sources (read-only)
┌──────────────────────┐
│ accounts             │ ← Chart of accounts for grouping
│ transactions         │ ← Double-entry records for calculations
│ ledger               │ ← Running balances (balance sheet)
│ invoices             │ ← Sales data for VAT / AR
│ payments             │ ← Payment data for AR / receivables
│ tb_transactions      │ ← Legacy table (if available)
│ tb_invoices          │ ← Legacy table (if available)
│ tb_payments          │ ← Legacy table (if available)
│ tb_expense_categories│ ← Legacy table (if available)
└──────────────────────┘
```

## Helper Functions (financialReports.ts)

| Function | Schema | Purpose |
|----------|--------|---------|
| `getBankBalance()` | Legacy | Bank balance from tb_transactions |
| `getAccountsReceivable()` | Legacy | Unpaid invoices from tb_invoices/tb_payments |
| `getFixedAssets()` | Both | **Placeholder**: returns hardcoded R5,000 |
| `getAccountsPayable()` | Both | **Placeholder**: returns R0 |
| `getSalesTaxLiability()` | Legacy | VAT liability from tb_transactions |
| `getUnpaidExpenses()` | Both | **Placeholder**: returns R0 |
| `getRetainedEarnings()` | Legacy | Cumulative income − expenses |
| `getSales()` | Legacy | Revenue for period from tb_transactions |
| `getPurchases()` | Legacy | COGS from tb_transactions joined to tb_invoices |
| `getExpensesByCategory()` | Legacy | Expenses grouped by tb_expense_categories |
| `getBankBalanceFallback()` | Normalised | Asset accounts debit − credit |
| `getAccountsReceivableFallback()` | Normalised | Unpaid invoices from invoices/payments |
| `getRetainedEarningsFallback()` | Normalised | Income − expense from accounts/transactions |
| `getSalesFallback()` | Normalised | Income account credits − debits |
| `getPurchasesFallback()` | Normalised | Expense (cost_of_sales) debits − credits |
| `getExpensesByCategoryFallback()` | Normalised | Expenses grouped by account name |
| `checkLegacyTables()` | — | Detect schema, cache result |
