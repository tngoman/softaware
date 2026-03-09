# Accounting — File Inventory

## Backend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| accounting.ts | `src/routes/accounting.ts` | 371 | Accounts CRUD, Transactions CRUD, Ledger queries, Tax rates CRUD |
| expenseCategories.ts | `src/routes/expenseCategories.ts` | 139 | Expense category CRUD with account linking |
| reports.ts | `src/routes/reports.ts` | 135 | Trial balance, VAT report, income statement |
| vatReports.ts | `src/routes/vatReports.ts` | 144 | SA SARS reports: VAT201, ITR14, IRP6 |
| financialReports.ts | `src/routes/financialReports.ts` | 486 | Balance sheet, profit & loss, transaction listing (dual-schema) |
| businessTypes.ts | `src/db/businessTypes.ts` | 178 | TypeScript interfaces: Account, Transaction, Ledger, TaxRate, ExpenseCategory |
| 006_business_tables.ts | `src/db/migrations/006_business_tables.ts` | 311 | Schema: accounts, transactions, ledger, expense_categories, tax_rates |

**Backend Total: ~1,764 LOC**

## Frontend Files

| File | Path | LOC | Purpose |
|------|------|-----|---------|
| Transactions.tsx | `src/pages/Transactions.tsx` | 445 | Transaction list with pagination, filters, processing |
| AddExpense.tsx | `src/pages/AddExpense.tsx` | 460 | Expense capture form (VAT-compliant) |
| AddIncome.tsx | `src/pages/AddIncome.tsx` | 352 | Income capture form (VAT-compliant) |
| BalanceSheet.tsx | `src/pages/BalanceSheet.tsx` | 295 | Balance sheet report view |
| ProfitAndLoss.tsx | `src/pages/ProfitAndLoss.tsx` | 258 | Profit & loss statement view |
| TransactionListing.tsx | `src/pages/TransactionListing.tsx` | 226 | Transaction listing report page |
| VatReports.tsx | `src/pages/VatReports.tsx` | 464 | SARS tax reports (VAT201, ITR14, IRP6) |
| TransactionModel.ts | `src/models/TransactionModel.ts` | 63 | Transaction API model (CRUD + clear-income) |
| OtherModels.ts (partial) | `src/models/OtherModels.ts` | ~180 | AccountModel, LedgerModel, ReportModel, ExpenseCategoryModel, VatReportModel, FinancialReportModel |
| types/index.ts (partial) | `src/types/index.ts` | ~200 | Account, Transaction, LedgerEntry, Payment, ExpenseCategory, VatPeriod, Vat201Report, Itr14Report, Irp6Report |

**Frontend Total: ~2,943 LOC**

## Combined Total: ~4,707 LOC

---

## File Relationship Map

```
Backend Routes                           Frontend Pages
┌─────────────────────┐                 ┌─────────────────────────┐
│ accounting.ts       │◀────────────────│ Transactions.tsx         │
│ /accounts           │   AccountModel  │ AddExpense.tsx           │
│ /transactions       │   LedgerModel   │ AddIncome.tsx            │
│ /ledger             │                 │                          │
│ /tax-rates          │                 │                          │
│ /accounts/:id/balance│                │                          │
├─────────────────────┤                 ├─────────────────────────┤
│ expenseCategories.ts│◀────────────────│ AddExpense.tsx           │
│ /expense-categories │ ExpCategory     │ VatReports.tsx           │
├─────────────────────┤  Model          ├─────────────────────────┤
│ reports.ts          │◀────────────────│ (used by VatReports.tsx) │
│ /reports            │  ReportModel    │                          │
├─────────────────────┤                 ├─────────────────────────┤
│ vatReports.ts       │◀────────────────│ VatReports.tsx           │
│ /vat-reports        │  VatReportModel │                          │
├─────────────────────┤                 ├─────────────────────────┤
│ financialReports.ts │◀────────────────│ BalanceSheet.tsx         │
│ /financial-reports  │ FinancialReport │ ProfitAndLoss.tsx        │
│ /balance-sheet      │  Model          │ TransactionListing.tsx   │
│ /profit-loss        │                 │                          │
│ /transaction-listing│                 │                          │
└─────────────────────┘                 └─────────────────────────┘

Shared Types
┌─────────────────────┐
│ businessTypes.ts    │ ← Backend interfaces
│ types/index.ts      │ ← Frontend interfaces (not identical)
└─────────────────────┘

Database Schema
┌─────────────────────┐
│ accounts            │ ← Chart of accounts (5 types)
│ transactions        │ ← Double-entry records → references accounts
│ ledger              │ ← Running balances → references accounts
│ tax_rates           │ ← Tax rate definitions
│ expense_categories  │ ← Categorisation → references accounts
│ tb_transactions     │ ← Legacy PHP table (if exists)
│ tb_expense_categories│ ← Legacy PHP table (if exists)
└─────────────────────┘
```
