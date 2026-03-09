# Financial Reports — Field Definitions

## API Response Schemas

### Balance Sheet (`GET /v1/financial-reports/balance-sheet`)

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `as_of_date` | `string` (YYYY-MM-DD) | Today | Point-in-time for balance sheet |

**Response**:
```typescript
{
  as_of_date: string;
  assets: {
    current_assets: {
      bank: number;                // Cash at bank
      accounts_receivable: number; // Unpaid invoices
      total: number;               // bank + accounts_receivable
    };
    fixed_assets: {
      computer_equipment: number;  // fixedAssets × 0.6 (HARDCODED)
      office_equipment: number;    // fixedAssets × 0.4 (HARDCODED)
      total: number;               // R5,000 (PLACEHOLDER)
    };
    total_assets: number;          // current + fixed
  };
  liabilities: {
    current_liabilities: {
      accounts_payable: number;       // R0 (PLACEHOLDER)
      sales_tax: number;              // VAT liability
      unpaid_expense_claims: number;  // R0 (PLACEHOLDER)
      total: number;
    };
    total_liabilities: number;
  };
  equity: {
    net_assets: number;            // total_assets - total_liabilities
    retained_earnings: number;     // Cumulative income - expenses
    total_equity: number;          // = net_assets
  };
}
```

### Profit & Loss (`GET /v1/financial-reports/profit-loss`)

**Query Params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | `string` (YYYY-MM-DD) | Yes | Period start |
| `end_date` | `string` (YYYY-MM-DD) | Yes | Period end |

**Response**:
```typescript
{
  period: { start: string; end: string; };
  trading_income: {
    sales: number;
    total: number;          // = sales
  };
  cost_of_sales: {
    purchases: number;      // Expenses in 'cost_of_sales' category
    total: number;          // = purchases
  };
  gross_profit: number;     // trading_income.total - cost_of_sales.total
  operating_expenses: Array<{
    category: string;       // Account name or expense category
    amount: number;
  }>;
  total_operating_expenses: number;
  net_profit: number;       // gross_profit - total_operating_expenses
}
```

### Transaction Listing (`GET /v1/financial-reports/transaction-listing`)

**Query Params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | `string` | Yes | Period start |
| `end_date` | `string` | Yes | Period end |
| `type` | `string` | No | Filter: `income` or `expense` |

**Response**:
```typescript
{
  period: { start: string; end: string; };
  transactions: Array<{
    id: number;
    date: string;
    type: string;          // 'income' or 'expense'
    supplier: string;      // party_name
    reference: string;     // invoice_number
    vat_type: string;      // 'standard', 'zero', 'exempt', 'non-vat'
    net: number;           // exclusive_amount
    vat: number;           // vat_amount
    gross: number;         // total_amount
    payment_id: number | null;
  }>;
  totals: {
    gross: number;
    vat: number;
    net: number;
  };
  count: number;
}
```

### Trial Balance (`GET /v1/reports?type=trial-balance`)

**Query Params**: `from`, `to` (default: Jan 1 current year → today)

**Response**:
```typescript
{
  from: string;
  to: string;
  accounts: Array<{
    id: number;
    account_code: string;
    account_name: string;
    account_type: string;
    total_debit: number;   // SUM(debit_amount) for period
    total_credit: number;  // SUM(credit_amount) for period
  }>;
  totals: {
    total_debit: number;
    total_credit: number;
  };
}
```

### VAT Summary (`GET /v1/reports?type=vat`)

**Query Params**: `from`, `to`

**Response**:
```typescript
{
  from: string;
  to: string;
  tax_rates: TaxRate[];    // Active tax rate definitions
  output_vat: number;      // SUM(invoice_amount) × 0.15
  input_vat: number;       // SUM(expense debit_amount) × 0.15
  net_vat: number;         // output - input
}
```

### Income Statement (`GET /v1/reports?type=income-statement`)

**Query Params**: `from`, `to`

**Response**:
```typescript
{
  from: string;
  to: string;
  income: Array<{
    // Account fields + amount (credit - debit)
    amount: number;
  }>;
  expenses: Array<{
    // Account fields + amount (debit - credit)
    amount: number;
  }>;
  totals: {
    total_income: number;
    total_expenses: number;
    net_profit: number;
  };
}
```

### VAT201 Report (`GET /v1/vat-reports?type=vat201`)

**Required Params**: `period_start`, `period_end`

**Response**:
```typescript
{
  period_start: string;
  period_end: string;
  total_sales: number;         // SUM(invoice_amount) in period
  total_purchases: number;     // SUM(expense debits) in period
  output_vat: number;          // total_sales × 0.15
  input_vat: number;           // total_purchases × 0.15
  net_vat: number;             // output - input
  vat_payable: number;         // max(0, net_vat)
  vat_refundable: number;      // max(0, -net_vat)
}
```

### ITR14 Report (`GET /v1/vat-reports?type=itr14`)

**Query Params**: `year` (default: current year)  
**Fiscal Period**: March 1 of `year` → February 28 of `year+1`

**Response**:
```typescript
{
  year: number;
  period: string;              // "YYYY-03-01 to YYYY+1-02-28"
  gross_income: number;        // Income transactions (credit - debit)
  total_expenses: number;      // Expense transactions (debit - credit)
  taxable_income: number;      // gross_income - total_expenses
}
```

### IRP6 Report (`GET /v1/vat-reports?type=irp6`)

**Query Params**: `to_date` (default: today)  
**Period**: March 1 of to_date's year → to_date

**Response**:
```typescript
{
  from_date: string;
  to_date: string;
  estimated_income: number;
  estimated_expenses: number;
  estimated_taxable: number;   // income - expenses
}
```

---

## Frontend TypeScript Types

### Vat201Report
```typescript
{
  period: { start: string; end: string; };
  vat201: {
    field_1: number;    // Standard rated supplies
    field_4: number;    // Zero rated supplies
    field_5: number;    // Exempt supplies
    field_6: number;    // Total supplies
    field_11: number;   // Standard rated acquisitions
    field_14: number;   // Total acquisitions
    field_15: number;   // Output tax
    field_19: number;   // Input tax
  };
}
```

### Itr14Report
```typescript
{
  year: number;
  income: {
    total_revenue: number;
    taxable_income: number;
    zero_rated_income: number;
    exempt_income: number;
  };
  expenses_by_category: Array<{
    category_name: string;
    category_code: string;
    itr14_mapping: string;
    total: number;
  }>;
  summary: {
    total_revenue: number;
    total_expenses: number;
    taxable_income: number;
    corporate_tax_27_percent: number;
  };
}
```

### Irp6Report
```typescript
{
  period: {
    start: string;
    to_date: string;
    days_elapsed: number;
    days_in_year: number;
  };
  actual_to_date: {
    income: number;
    expenses: number;
    profit: number;
  };
  estimated_annual: {
    income: number;
    expenses: number;
    taxable_income: number;
    tax_due_27_percent: number;
  };
}
```

> **Note**: Frontend types are more detailed than backend responses. The frontend types reflect the intended SARS-compliant structure; the backend currently returns simplified versions.
