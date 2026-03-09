# Financial Reports — Architecture Patterns & Anti-Patterns

## Key Patterns

### 1. Dual-Schema Auto-Detection
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

**Pattern**: Runtime feature detection with lazy evaluation and permanent caching  
**Usage**: Called at the start of each financial report route  
**Dual query functions**: Each report has a legacy function and a `*Fallback()` function

### 2. Helper Function Composition (Balance Sheet)
The balance sheet is composed from individual async helper functions:

```typescript
const bank = await getBankBalance(asOfDate);
const accountsReceivable = await getAccountsReceivable(asOfDate);
const fixedAssets = await getFixedAssets(asOfDate);
// ... 4 more
```

**Pattern**: Functional decomposition — each balance sheet line item is an independent query  
**Benefit**: Readable, testable  
**Problem**: Sequential execution (7 queries) instead of `Promise.all()`

### 3. Query-Param Report Dispatch
```typescript
switch (req.query.type) {
  case 'trial-balance': { ... }
  case 'vat': { ... }
  case 'income-statement': { ... }
  default: throw badRequest(`Unknown report type: ${type}`);
}
```

**Pattern**: Single endpoint, type-dispatched  
**Usage**: `reports.ts` and `vatReports.ts`  
**Alternative**: Separate routes would give clearer API design

### 4. Rounding Utility
```typescript
const r = (n: number) => Math.round(n * 100) / 100;
```

**Pattern**: Local rounding function for financial precision  
**Used in**: Balance sheet and P&L responses  
**Note**: Uses `Math.round` which can have floating-point edge cases; `toFixed(2)` or a proper decimal library would be more accurate

### 5. SA Tax Year Alignment
```typescript
// ITR14 fiscal year: March 1 → February 28
const yearStart = `${year}-03-01`;
const yearEnd = `${year + 1}-02-28`;

// IRP6: Year-to-date from March 1
const fromDate = `${new Date(to_date).getFullYear()}-03-01`;
```

**Pattern**: Hardcoded South African fiscal year boundaries  
**Correct**: SA corporate tax year runs March 1 – end of February

### 6. Read-Only Report Endpoints
All 9 endpoints are GET-only. No data mutation. Reports are computed on-the-fly from underlying transaction data.

**Pattern**: CQRS-lite — reporting reads from the same tables as operations but only queries  
**Benefit**: Always reflects current data  
**Cost**: Complex queries on every request (no caching or materialised views)

---

## Anti-Patterns & Technical Debt

### FR-AP-001: Placeholder Balance Sheet Values ⚠️ HIGH
**Location**: `financialReports.ts`
```typescript
async function getFixedAssets(_asOfDate: string): Promise<number> { return 5000.00; }
async function getAccountsPayable(_asOfDate: string): Promise<number> { return 0.00; }
async function getUnpaidExpenses(_asOfDate: string): Promise<number> { return 0.00; }
```
**Impact**: Balance sheet contains hardcoded fictitious data

### FR-AP-002: Hardcoded Fixed Asset Split
```typescript
computer_equipment: r(fixedAssets * 0.6),
office_equipment: r(fixedAssets * 0.4),
```
**Impact**: 60/40 split is arbitrary — no actual asset classification

### FR-AP-003: Hardcoded 15% VAT Rate
**Location**: `reports.ts` (vat report), `vatReports.ts` (all 3 reports)
```typescript
const vatRate = 0.15;
const outputVat = totalSales * vatRate;
```
**Impact**: Cannot accommodate rate changes, mixed-rate transactions, or zero/exempt items in calculations. The `tax_rates` table exists but is never queried for calculations.

### FR-AP-004: ITR14 Leap Year Bug
```typescript
const yearEnd = `${year + 1}-02-28`;  // Missing Feb 29 in leap years
```
**Impact**: One day of transactions excluded in leap years

### FR-AP-005: VAT Calculation on Gross Amounts
**Location**: `reports.ts` and `vatReports.ts`
```typescript
SUM(invoice_amount * 0.15) as vat_amount  // Treating total as VAT-inclusive
```
**Impact**: Incorrect — should either track actual VAT amounts per line item, or use `amount × 15/115` to extract VAT from an inclusive amount

### FR-AP-006: No RBAC on Financial Reports
**Location**: All 3 routers  
**Impact**: Any authenticated user sees full financial data

### FR-AP-007: Sequential Helper Queries
**Location**: `financialReports.ts` balance sheet  
**Problem**: 7 async functions called sequentially instead of in parallel  
**Impact**: Balance sheet response time = sum of all 7 query times

### FR-AP-008: No Report Caching
**Location**: All routes  
**Problem**: Complex aggregate queries run on every request  
**Impact**: Performance degrades with data volume; same report requested repeatedly runs same queries

### FR-AP-009: Legacy Cache Never Invalidated
```typescript
let useLegacyTables: boolean | null = null;
```
**Problem**: Module-level variable cached permanently — if schema changes after startup, requires server restart  
**Impact**: Schema migration during runtime not detected

### FR-AP-010: Frontend/Backend Type Mismatch
**Problem**: Frontend types (Vat201Report, Itr14Report, Irp6Report) are more detailed than actual backend responses  
**Example**: Frontend Itr14Report has `expenses_by_category`, `corporate_tax_27_percent`; backend only returns `gross_income`, `total_expenses`, `taxable_income`  
**Impact**: Frontend may render undefined/NaN values for missing fields

---

## Data Flow Diagrams

### Balance Sheet Flow
```
GET /financial-reports/balance-sheet?as_of_date=2025-01-31
        │
        ▼
  checkLegacyTables() ──▶ cached boolean
        │
   ┌────┴────┐
   ▼         ▼
 Legacy    Fallback
   │         │
   ├─ getBankBalance()           ──▶ tb_transactions / transactions+accounts
   ├─ getAccountsReceivable()    ──▶ tb_invoices+tb_payments / invoices+payments
   ├─ getFixedAssets()           ──▶ return 5000 (HARDCODED)
   ├─ getAccountsPayable()       ──▶ return 0 (HARDCODED)
   ├─ getSalesTaxLiability()     ──▶ tb_transactions / 0
   ├─ getUnpaidExpenses()        ──▶ return 0 (HARDCODED)
   └─ getRetainedEarnings()      ──▶ tb_transactions / transactions+accounts
        │
        ▼
  Compute: assets, liabilities, equity
  Round to 2 decimal places
  Return JSON response
```

### SARS Report Flow
```
VatReports.tsx (tabbed UI)
        │
   ┌────┼──────────────┐
   ▼    ▼              ▼
VAT201  ITR14         IRP6
   │      │              │
   ▼      ▼              ▼
period  year           to_date
params  param          param
   │      │              │
   ▼      ▼              ▼
Sales + Purchases      Income + Expenses
aggregation            aggregation
   │                     │
   ▼                     ▼
× 0.15 (hardcoded)    Net taxable
   │
   ▼
payable / refundable
```

---

## Relationship to Other Modules

| Module | Relationship |
|--------|-------------|
| **Accounting** | Data source — reports read from accounts, transactions, ledger tables |
| **Invoices** | Data source — invoice amounts used for sales, AR, VAT calculations |
| **Payments** | Data source — payment amounts used for AR calculations |
| **Dashboard** | Consumer — financial summary stats may reference these reports |
