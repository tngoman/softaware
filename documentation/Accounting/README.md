# Accounting Module

## Overview

The Accounting module provides the core financial backbone for SoftAware: a chart of accounts, double-entry transactions, a general ledger, tax rates, expense categories, and a VAT-compliant transaction capture system tailored for South African tax compliance (VAT201, ITR14, IRP6).

## Module Scope

| Sub-Domain | Description |
|------------|-------------|
| **Chart of Accounts** | Asset, Liability, Equity, Income, Expense accounts with codes & categories |
| **Transactions** | Double-entry debits/credits linked to accounts |
| **Ledger** | Running-balance journal entries per account |
| **Tax Rates** | Configurable VAT/tax rates (default 15% SA VAT) |
| **Expense Categories** | Categorisation with ITR14 mapping and VAT-claim flags |
| **Income Capture** | VAT-compliant income transactions with document upload |
| **Expense Capture** | VAT-compliant expense transactions with supplier VAT validation |
| **Payment Processing** | Batch-convert payments into accounting transactions |

## Architecture

### Dual-Schema Design
The system maintains compatibility with a legacy PHP database schema (`tb_transactions`, `tb_invoices`, `tb_payments`, `tb_expense_categories`) while migrating to a normalised new schema (`accounts`, `transactions`, `ledger`). The `financialReportsRouter` auto-detects which schema is available at startup and routes queries accordingly.

### Backend Structure
```
src/routes/accounting.ts      → /v1/accounting/* (accounts, transactions, ledger, tax-rates)
src/routes/expenseCategories.ts → /v1/expense-categories (expense category CRUD)
src/routes/reports.ts          → /v1/reports (trial-balance, vat, income-statement)
src/routes/vatReports.ts       → /v1/vat-reports (VAT201, ITR14, IRP6)
src/routes/financialReports.ts → /v1/financial-reports (balance-sheet, profit-loss, transaction-listing)
src/db/businessTypes.ts        → TypeScript interfaces (Account, Transaction, Ledger, TaxRate, ExpenseCategory)
src/db/migrations/006_business_tables.ts → Schema definitions
```

### Frontend Structure
```
pages/Transactions.tsx       → Transaction list with filters, processing, clear-income
pages/AddExpense.tsx         → Expense capture form (SA VAT-compliant)
pages/AddIncome.tsx          → Income capture form (SA VAT-compliant)
pages/BalanceSheet.tsx       → Balance sheet report view
pages/ProfitAndLoss.tsx      → P&L statement report view
pages/TransactionListing.tsx → Transaction listing report view
pages/VatReports.tsx         → SARS tax reports (VAT201, ITR14, IRP6)
models/OtherModels.ts        → AccountModel, LedgerModel, ReportModel, ExpenseCategoryModel, etc.
models/TransactionModel.ts   → Transaction CRUD + clear-income
types/index.ts               → Account, Transaction, LedgerEntry, ExpenseCategory, VatPeriod, etc.
```

## Dependencies

| Dependency | Usage |
|-----------|-------|
| mysql2/promise | Database queries |
| Zod | Request validation (accounts, transactions, ledger, tax-rates, expense-categories) |
| Express Router | Route handling |
| date-fns | Date formatting in frontend reports |
| TanStack React Table | Transaction listing with sorting/filtering |
| SweetAlert2 | Confirmation modals for destructive operations |
| react-hook-form | Expense and income capture forms |

## Key Concepts

- **Account Types**: `asset`, `liability`, `equity`, `income`, `expense`
- **Account Categories**: `cost_of_sales` (for P&L COGS separation), plus custom categories
- **Double-Entry**: Each transaction has `debit_amount` and `credit_amount` against one account
- **Ledger Entries**: Track running `balance` per account with dated entries
- **SA VAT Rate**: Hardcoded 15% (both backend and frontend)
- **Fiscal Year**: March 1 – February 28/29 (South African tax year for ITR14)
- **Legacy Detection**: `checkLegacyTables()` probes for `tb_transactions` existence at runtime
