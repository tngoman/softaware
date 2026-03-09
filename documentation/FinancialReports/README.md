# Financial Reports Module

## Overview

The Financial Reports module provides comprehensive reporting for the SoftAware platform, generating balance sheets, profit & loss statements, transaction listings, and South African SARS tax compliance reports (VAT201, ITR14, IRP6). It supports dual-schema queries for backward compatibility with the legacy PHP database.

## Module Scope

| Report Category | Reports |
|----------------|---------|
| **Financial Statements** | Balance Sheet, Profit & Loss |
| **Transaction Reports** | Transaction Listing (with type filter) |
| **Management Reports** | Trial Balance, Income Statement, VAT Summary |
| **SARS Tax Reports** | VAT201 (bi-monthly VAT return), ITR14 (corporate income tax), IRP6 (provisional tax) |

## Architecture

### Dual-Schema Strategy
The module auto-detects whether legacy PHP tables (`tb_transactions`, `tb_invoices`, `tb_payments`, `tb_expense_categories`) exist at runtime. If found, queries use the legacy schema; otherwise, queries target the normalised schema (`accounts`, `transactions`, `ledger`).

```
┌──────────────┐     ┌─────────────────┐
│ Report Route │────▶│ checkLegacyTables│
└──────────────┘     └────────┬────────┘
                         ┌────┴────┐
                         ▼         ▼
                     Legacy     Fallback
                    (tb_*)     (normalised)
                         │         │
                         ▼         ▼
                    Same response shape
```

### Backend Structure
```
src/routes/financialReports.ts  → /v1/financial-reports/* (balance-sheet, profit-loss, transaction-listing)
src/routes/reports.ts           → /v1/reports (trial-balance, vat, income-statement)
src/routes/vatReports.ts        → /v1/vat-reports (vat201, itr14, irp6)
```

### Frontend Structure
```
pages/BalanceSheet.tsx          → Balance sheet report view
pages/ProfitAndLoss.tsx         → Profit & loss statement view
pages/TransactionListing.tsx    → Transaction listing report page
pages/VatReports.tsx            → SARS tax reports (VAT201, ITR14, IRP6)
models/OtherModels.ts           → ReportModel, VatReportModel, FinancialReportModel
```

## Dependencies

| Dependency | Usage |
|-----------|-------|
| mysql2/promise | Database queries (complex aggregations and JOINs) |
| Express Router | Route handling |
| date-fns | Date formatting in frontend report views |
| Tailwind CSS | Report styling and print layouts |

## Key Concepts

- **SA Fiscal Year**: March 1 – February 28/29 (used for ITR14, IRP6)
- **VAT Rate**: 15% (South African standard rate, hardcoded)
- **Balance Sheet Equation**: Assets = Liabilities + Equity
- **Gross Profit**: Trading Income − Cost of Sales
- **Net Profit**: Gross Profit − Operating Expenses
- **VAT Payable**: Output VAT (on sales) − Input VAT (on purchases)
