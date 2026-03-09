# Accounting — Architecture Patterns & Anti-Patterns

## Key Patterns

### 1. Dual-Schema Compatibility Layer
The `financialReportsRouter` supports both legacy PHP tables and new normalised tables:

```typescript
let useLegacyTables: boolean | null = null;

async function checkLegacyTables(): Promise<boolean> {
  if (useLegacyTables !== null) return useLegacyTables;
  try {
    await db.query('SELECT 1 FROM tb_transactions LIMIT 1');
    useLegacyTables = true;
  } catch {
    useLegacyTables = false;
  }
  return useLegacyTables;
}
```

**Pattern**: Runtime feature detection with lazy evaluation and caching  
**Each report has two query paths**: `getSales()` (legacy) / `getSalesFallback()` (new schema)  
**Scope**: Only in `financialReports.ts` — other routers use new schema exclusively

### 2. Chart of Accounts (5-Type Model)
```
┌─────────┐  ┌───────────┐  ┌────────┐  ┌────────┐  ┌─────────┐
│  Asset  │  │ Liability │  │ Equity │  │ Income │  │ Expense │
│ DR = +  │  │ CR = +    │  │ CR = + │  │ CR = + │  │ DR = +  │
└─────────┘  └───────────┘  └────────┘  └────────┘  └─────────┘
```

Accounts are typed via `account_type` enum. Sub-classification via `account_category` (e.g. `cost_of_sales` for P&L separation).

### 3. Double-Entry via Single-Row Transactions
Each transaction row contains both `debit_amount` and `credit_amount` against ONE account:

```typescript
{ account_id: 1, debit_amount: 1000, credit_amount: 0 }   // Debit bank
{ account_id: 5, debit_amount: 0, credit_amount: 1000 }   // Credit income
```

**Note**: There's no enforced pairing — journal entries are not atomic. Each transaction is independent.

### 4. Running-Balance Ledger
The `ledger` table maintains a `balance` column per account:

```typescript
{ account_id: 1, debit_amount: 500, credit_amount: 0, balance: 12500 }
```

Account balance is derived from the latest ledger entry: `ORDER BY ledger_date DESC, id DESC LIMIT 1`

### 5. VAT Calculation Pattern (SA 15%)
```typescript
// Output VAT (on sales/income)
const outputVat = totalSales * 0.15;

// Input VAT (on purchases/expenses)  
const inputVat = totalPurchases * 0.15;

// Frontend auto-calculation
const vatAmount = totalAmount * (15 / 115);  // Extract VAT from inclusive amount
const exclusiveAmount = totalAmount - vatAmount;
```

**Hardcoded**: 15% rate used in `reports.ts`, `vatReports.ts`, `AddExpense.tsx`, `AddIncome.tsx`  
**tax_rates table exists** but is NOT used by any calculation — purely informational

### 6. Expense Category → Account Linking
```typescript
expense_categories.account_id → accounts.id (FK, ON DELETE SET NULL)
```

Allows mapping expense types to chart of accounts entries. Frontend joins account info on GET.

### 7. Report Type Dispatch (Single Endpoint, Multiple Reports)
```typescript
// reports.ts and vatReports.ts
switch (req.query.type) {
  case 'trial-balance': { ... }
  case 'vat': { ... }
  case 'income-statement': { ... }
}
```

**Pattern**: Query-param-based routing within a single GET handler  
**Alternative**: Could be separate endpoints (`/reports/trial-balance`, etc.)

### 8. SA Tax Year Alignment
```typescript
// ITR14: March 1 → February 28
const yearStart = `${year}-03-01`;
const yearEnd = `${year + 1}-02-28`;

// IRP6: March 1 of current year → specified date
const fromDate = `${new Date(to_date).getFullYear()}-03-01`;
```

Correctly aligns to South African fiscal year for corporate tax calculations.

### 9. VAT-Compliant Transaction Capture (Frontend)
**AddExpense.tsx**:
- Supplier VAT number validation (`4xxxxxxxxx` SA format)
- Category-aware VAT claim eligibility
- Auto-locks to "non-vat" when supplier has no VAT number
- Document upload (PDF/JPG/PNG, max 5MB)

**AddIncome.tsx**:
- Income type classification (Services, Goods, Consulting, Other)
- VAT output type selection (Standard/Zero/Exempt)
- LocalStorage-based invoice duplicate detection

### 10. Balance Sheet Helper Functions
```typescript
async function getBankBalance(asOfDate): Promise<number>
async function getAccountsReceivable(asOfDate): Promise<number>
async function getFixedAssets(asOfDate): Promise<number>       // Returns hardcoded 5000
async function getAccountsPayable(asOfDate): Promise<number>   // Returns 0
async function getSalesTaxLiability(asOfDate): Promise<number>
async function getRetainedEarnings(asOfDate): Promise<number>
```

Each has a `*Fallback()` variant for the new schema. Composed into the balance sheet response.

---

## Anti-Patterns & Technical Debt

### ACC-AP-001: No Double-Entry Enforcement ⚠️ CRITICAL
**Location**: `accounting.ts` POST `/transactions`  
**Problem**: Transactions are single-row with debit and credit amounts, but there's no validation that total debits = total credits across a journal entry  
**Impact**: Unbalanced books — fundamental accounting integrity not enforced

### ACC-AP-002: Ledger Not Auto-Updated
**Location**: `accounting.ts`  
**Problem**: Creating a transaction does NOT automatically create a ledger entry. Ledger and transactions are disconnected.  
**Impact**: Ledger balances become stale; account balance endpoint may return outdated data

### ACC-AP-003: Hardcoded VAT Rate (15%)
**Location**: `reports.ts` lines 58–64, `vatReports.ts` lines 48–50, frontend forms  
**Problem**: `const vatRate = 0.15` and `* 0.15` hardcoded throughout. `tax_rates` table exists but is unused.  
**Impact**: Cannot handle rate changes, zero-rated items, or exempt items in backend calculations

### ACC-AP-004: Placeholder Functions in Balance Sheet
**Location**: `financialReports.ts`  
```typescript
async function getFixedAssets(_asOfDate: string): Promise<number> { return 5000.00; }
async function getAccountsPayable(_asOfDate: string): Promise<number> { return 0.00; }
async function getUnpaidExpenses(_asOfDate: string): Promise<number> { return 0.00; }
```
**Impact**: Balance sheet has hardcoded values — not reflecting actual data

### ACC-AP-005: Fixed Asset Split Hardcoded
**Location**: `financialReports.ts` balance sheet response  
```typescript
computer_equipment: r(fixedAssets * 0.6),
office_equipment: r(fixedAssets * 0.4),
```
**Impact**: 60/40 split is arbitrary — no actual asset tracking

### ACC-AP-006: No RBAC on Financial Data
**Location**: All 5 routers  
**Problem**: No `requirePermission()` middleware. Any authenticated user can view balance sheets, create transactions, generate tax reports.  
**Impact**: Major security concern — financial data should be role-restricted

### ACC-AP-007: No Account Soft Delete
**Location**: `accounting.ts`  
**Problem**: No DELETE route for accounts, and no cascading deactivation. Accounts with `active = 0` are filtered out of lists but transactions against them remain.  
**Impact**: Cannot properly decommission accounts

### ACC-AP-008: No Tax Rate Delete Route
**Location**: `accounting.ts`  
**Problem**: Tax rates have CREATE and UPDATE but no DELETE (not even soft delete)  
**Impact**: Cannot remove incorrect tax rates

### ACC-AP-009: Transaction Update/Delete Missing
**Location**: `accounting.ts`  
**Problem**: Only GET (list) and POST (create) for transactions. No PUT or DELETE routes in the accounting router.  
**Impact**: Created transactions cannot be corrected or voided through the accounting API  
**Note**: Frontend `TransactionModel` has `update()`, `delete()`, and `clearIncome()` methods that may hit legacy endpoints

### ACC-AP-010: VAT Report Uses Invoice Amount (Not Line Items)
**Location**: `vatReports.ts`  
**Problem**: VAT201 calculates VAT as `SUM(invoice_amount) * 0.15` rather than from actual VAT-tracked line items  
**Impact**: Inaccurate VAT returns — doesn't distinguish standard/zero/exempt items

### ACC-AP-012: Feb 28 Hardcoded (Not 29)
**Location**: `vatReports.ts` ITR14 year-end  
```typescript
const yearEnd = `${year + 1}-02-28`;
```
**Impact**: Missing last day in leap years. Should use `02-28` or compute dynamically.

---

## Data Flow Diagrams

### Transaction Flow
```
Frontend Form (AddExpense/AddIncome)
        │
        ▼
  TransactionModel.create(FormData)
        │
        ▼
  POST /v1/accounting/transactions  ──OR──  POST /v1/transactions (legacy)
        │                                          │
        ▼                                          ▼
  transactions table                       tb_transactions table
  (debit/credit)                           (amount/vat/type)
        │
        ✗ No auto-ledger update
```

### Report Generation Flow
```
  Frontend Report Page
        │
        ▼
  FinancialReportModel.getBalanceSheet()
        │
        ▼
  GET /v1/financial-reports/balance-sheet
        │
        ▼
  checkLegacyTables()
        │
   ┌────┴────┐
   ▼         ▼
 Legacy    Fallback
 (tb_*)    (accounts)
   │         │
   ▼         ▼
  Response (same shape)
```

### SA Tax Report Flow
```
  VatReports.tsx
        │
   ┌────┼──────────┐
   ▼    ▼          ▼
 VAT201 ITR14    IRP6
   │      │        │
   ▼      ▼        ▼
 period  year    to_date
 params  param    param
   │      │        │
   ▼      ▼        ▼
 Sales + Purchases aggregation
 × 0.15 (hardcoded)
```

---

## Relationship to Other Modules

| Module | Relationship |
|--------|-------------|
| **Payments** | Upstream — payments processed via POST `/v1/payments/process` create transactions with `account_id = 1` |
| **Invoices** | Upstream — invoice amounts feed VAT report calculations; accounts receivable in balance sheet |
| **Contacts** | Indirect — supplier/customer VAT numbers used in transaction capture |
| **Dashboard** | Consumer — financial stats shown on admin dashboard |
| **Quotations** | Indirect — converted quotations become invoices which feed accounting |
