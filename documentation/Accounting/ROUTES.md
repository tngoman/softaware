# Accounting — Route & API Reference

## Route Registration

```
apiRouter.use('/accounting',          accountingRouter);        // accounts, transactions, ledger, tax-rates
apiRouter.use('/expense-categories',  expenseCategoriesRouter); // expense category CRUD
apiRouter.use('/reports',             reportsRouter);           // trial-balance, vat, income-statement
apiRouter.use('/vat-reports',         vatReportsRouter);        // VAT201, ITR14, IRP6
apiRouter.use('/financial-reports',   financialReportsRouter);  // balance-sheet, profit-loss, transaction-listing
```

All routes require JWT authentication via `requireAuth`.

---

## Route Summary

### Accounts (accounting.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/accounting/accounts` | List accounts (filterable by type) |
| 2 | GET | `/v1/accounting/accounts/:id` | Get single account |
| 3 | POST | `/v1/accounting/accounts` | Create account |
| 4 | PUT | `/v1/accounting/accounts/:id` | Update account |
| 5 | GET | `/v1/accounting/accounts/:id/balance` | Get account balance (from latest ledger entry) |

### Transactions (accounting.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 6 | GET | `/v1/accounting/transactions` | List transactions (paginated, account filter) |
| 7 | POST | `/v1/accounting/transactions` | Create transaction |

### Ledger (accounting.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 8 | GET | `/v1/accounting/ledger` | Get ledger entries (paginated, account filter) |

### Tax Rates (accounting.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 9 | GET | `/v1/accounting/tax-rates` | List active tax rates |
| 10 | POST | `/v1/accounting/tax-rates` | Create tax rate |
| 11 | PUT | `/v1/accounting/tax-rates/:id` | Update tax rate |

### Expense Categories (expenseCategories.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 12 | GET | `/v1/expense-categories` | List expense categories (paginated) |
| 13 | GET | `/v1/expense-categories/:id` | Get single expense category |
| 14 | POST | `/v1/expense-categories` | Create expense category |
| 15 | PUT | `/v1/expense-categories/:id` | Update expense category |
| 16 | DELETE | `/v1/expense-categories/:id` | Soft delete expense category |

### Reports (reports.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 17 | GET | `/v1/reports?type=trial-balance` | Trial balance report |
| 18 | GET | `/v1/reports?type=vat` | VAT summary report |
| 19 | GET | `/v1/reports?type=income-statement` | Income statement |

### VAT Reports (vatReports.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 20 | GET | `/v1/vat-reports?type=vat201` | SARS VAT201 report |
| 21 | GET | `/v1/vat-reports?type=itr14` | SARS ITR14 corporate tax report |
| 22 | GET | `/v1/vat-reports?type=irp6` | SARS IRP6 provisional tax report |

### Financial Reports (financialReports.ts)
| # | Method | Path | Purpose |
|---|--------|------|---------|
| 23 | GET | `/v1/financial-reports/balance-sheet` | Balance sheet |
| 24 | GET | `/v1/financial-reports/profit-loss` | Profit & loss statement |
| 25 | GET | `/v1/financial-reports/transaction-listing` | Transaction listing |

**Total: 25 route handlers across 5 routers**

---

## Detailed Route Documentation

### 1. GET `/v1/accounting/accounts`
**Query params**: `type` (optional, filters by account_type)  
**SQL**: `SELECT * FROM accounts WHERE active = 1 [AND account_type = ?] ORDER BY account_code`  
**Response** `200`: `{ success: true, data: Account[] }`

### 2. GET `/v1/accounting/accounts/:id`
**Response** `200`: `{ success: true, data: Account }`  
**Error** `404`: Account not found

### 3. POST `/v1/accounting/accounts`
**Body**: `createAccountSchema` (account_code, account_name, account_type required)  
**Validation**: Unique account_code check  
**Response** `201`: `{ success: true, data: Account }`

### 4. PUT `/v1/accounting/accounts/:id`
**Body**: Partial `createAccountSchema`  
**Response** `200`: `{ success: true, data: Account }`

### 5. GET `/v1/accounting/accounts/:id/balance`
**Logic**: Fetches latest ledger entry for the account → returns its `balance`  
**Response** `200`:
```json
{ "success": true, "data": { "account_id": 1, "account_code": "1000", "account_name": "Bank", "balance": 12500.00 } }
```

### 6. GET `/v1/accounting/transactions`
**Query params**: `page`, `limit`, `account_id`  
**Response** `200`: `{ success: true, data: Transaction[], pagination: {...} }`

### 7. POST `/v1/accounting/transactions`
**Body**: `createTransactionSchema` (transaction_date, account_id required)  
**Validation**: Account existence check  
**Response** `201`: `{ success: true, data: Transaction }`

### 8. GET `/v1/accounting/ledger`
**Query params**: `page`, `limit`, `account_id`  
**Response** `200`: `{ success: true, data: Ledger[], pagination: {...} }`

### 9–11. Tax Rate Routes
Standard CRUD pattern. GET lists active only. POST validates uniqueness implicitly. PUT partial updates. No DELETE route.

### 12–16. Expense Category Routes
Standard CRUD with soft delete. GET includes joined account_name and account_code.  
**POST** validates unique `category_name`.  
**DELETE** sets `active = 0`.

### 17. GET `/v1/reports?type=trial-balance`
**Query params**: `from`, `to` (defaults: Jan 1 of current year → today)  
**Logic**: Aggregates debit/credit per account for date range  
**Response**: `{ success: true, data: { from, to, accounts: [...], totals: { total_debit, total_credit } } }`

### 18. GET `/v1/reports?type=vat`
**Logic**: Calculates output VAT (15% of invoice amounts) and input VAT (15% of expense debits)  
**Response**: `{ success: true, data: { from, to, tax_rates, output_vat, input_vat, net_vat } }`

### 19. GET `/v1/reports?type=income-statement`
**Logic**: Income accounts (credit - debit) and expense accounts (debit - credit) for date range  
**Response**: `{ data: { income: [...], expenses: [...], totals: { total_income, total_expenses, net_profit } } }`

### 20. GET `/v1/vat-reports?type=vat201`
**Required params**: `period_start`, `period_end`  
**Logic**: SA VAT201 calculation — sales × 15% = output VAT, purchases × 15% = input VAT  
**Response**: `{ data: { total_sales, total_purchases, output_vat, input_vat, net_vat, vat_payable, vat_refundable } }`

### 21. GET `/v1/vat-reports?type=itr14`
**Query params**: `year` (defaults to current year)  
**Fiscal period**: March 1 of `year` → February 28 of `year+1`  
**Response**: `{ data: { year, period, gross_income, total_expenses, taxable_income } }`

### 22. GET `/v1/vat-reports?type=irp6`
**Query params**: `to_date` (defaults to today)  
**Fiscal period**: March 1 of to_date's year → to_date  
**Response**: `{ data: { from_date, to_date, estimated_income, estimated_expenses, estimated_taxable } }`

### 23. GET `/v1/financial-reports/balance-sheet`
**Query params**: `as_of_date` (defaults to today)  
**Dual-schema**: Auto-detects legacy (`tb_*`) vs new (`accounts/transactions`) tables  
**Response**: Full balance sheet structure (see FIELDS.md)

### 24. GET `/v1/financial-reports/profit-loss`
**Required params**: `start_date`, `end_date`  
**Dual-schema**: Same auto-detection as balance sheet  
**Response**: Full P&L structure (see FIELDS.md)

### 25. GET `/v1/financial-reports/transaction-listing`
**Required params**: `start_date`, `end_date`; optional: `type` (income/expense)  
**Dual-schema**: Same auto-detection  
**Response**: `{ period, transactions: [...], totals: { gross, vat, net }, count }`

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|-----------------|-------------|------|---------------|
| List accounts | `AccountModel.getAll()` | GET | `/v1/accounting/accounts` |
| Get account | `AccountModel.getById(id)` | GET | `/v1/accounting/accounts/:id` |
| List transactions | `TransactionModel.getAll(params)` | GET | `/v1/accounting/transactions` (or legacy endpoint) |
| Create transaction | `TransactionModel.create(formData)` | POST | `/v1/accounting/transactions` |
| Update transaction | `TransactionModel.update(id, data)` | PUT | `/v1/accounting/transactions/:id` |
| Delete transaction | `TransactionModel.delete(id)` | DELETE | `/v1/accounting/transactions/:id` |
| Clear income | `TransactionModel.clearIncome()` | POST | `/v1/accounting/transactions/clear-income` |
| Get ledger | `LedgerModel.getAll(params)` | GET | `/v1/accounting/ledger` |
| List expense categories | `ExpenseCategoryModel.getAll()` | GET | `/v1/expense-categories` |
| Create expense category | `ExpenseCategoryModel.create(data)` | POST | `/v1/expense-categories` |
| Update expense category | `ExpenseCategoryModel.update(id, data)` | PUT | `/v1/expense-categories/:id` |
| Delete expense category | `ExpenseCategoryModel.delete(id)` | DELETE | `/v1/expense-categories/:id` |
| Trial balance | `ReportModel.getTrialBalance(params)` | GET | `/v1/reports?type=trial-balance` |
| VAT report | `ReportModel.getVatReport(params)` | GET | `/v1/reports?type=vat` |
| Income statement | `ReportModel.getIncomeStatement(params)` | GET | `/v1/reports?type=income-statement` |
| VAT201 | `VatReportModel.getVat201(params)` | GET | `/v1/vat-reports?type=vat201` |
| ITR14 | `VatReportModel.getItr14(params)` | GET | `/v1/vat-reports?type=itr14` |
| IRP6 | `VatReportModel.getIrp6(params)` | GET | `/v1/vat-reports?type=irp6` |
| Balance sheet | `FinancialReportModel.getBalanceSheet(params)` | GET | `/v1/financial-reports/balance-sheet` |
| Profit & loss | `FinancialReportModel.getProfitLoss(params)` | GET | `/v1/financial-reports/profit-loss` |
| Transaction listing | `FinancialReportModel.getTransactionListing(params)` | GET | `/v1/financial-reports/transaction-listing` |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| All accounting operations | — | JWT authentication only |

> ⚠️ **No RBAC permissions exist for any accounting route.** All authenticated users can view balance sheets, P&L statements, create transactions, and generate SARS tax reports.
