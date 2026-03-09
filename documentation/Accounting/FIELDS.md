# Accounting — Field Definitions

## Database Tables

### accounts
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO_INCREMENT | Primary key |
| account_code | VARCHAR(50) | NO | — | Unique account code (e.g. "1000", "2100") |
| account_name | VARCHAR(255) | NO | — | Display name (unique) |
| account_type | VARCHAR(50) | NO | — | `asset`, `liability`, `equity`, `income`, `expense` |
| account_category | VARCHAR(50) | YES | NULL | Sub-category (e.g. `cost_of_sales`) |
| description | TEXT | YES | NULL | Free-text description |
| active | TINYINT(1) | NO | 1 | Soft delete flag |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Auto-updated |

**Indexes**: `idx_code` (account_code), `idx_type` (account_type), `idx_category` (account_category)

### transactions
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO_INCREMENT | Primary key |
| transaction_date | DATE | NO | — | Date of the transaction |
| account_id | INT | NO | — | FK → accounts.id (RESTRICT) |
| debit_amount | DECIMAL(15,4) | NO | 0 | Debit entry |
| credit_amount | DECIMAL(15,4) | NO | 0 | Credit entry |
| description | VARCHAR(255) | YES | NULL | Transaction description |
| reference_number | VARCHAR(100) | YES | NULL | External reference (invoice#, PAY-xxx) |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |

**Indexes**: `idx_account` (account_id), `idx_date` (transaction_date), `idx_reference` (reference_number)  
**Foreign Key**: account_id → accounts.id ON DELETE RESTRICT

### ledger
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO_INCREMENT | Primary key |
| ledger_date | DATE | NO | — | Date of the entry |
| account_id | INT | NO | — | FK → accounts.id (RESTRICT) |
| debit_amount | DECIMAL(15,4) | NO | 0 | Debit amount |
| credit_amount | DECIMAL(15,4) | NO | 0 | Credit amount |
| balance | DECIMAL(15,4) | NO | — | Running balance for this account |
| description | VARCHAR(255) | YES | NULL | Entry description |
| reference_number | VARCHAR(100) | YES | NULL | External reference |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |

**Foreign Key**: account_id → accounts.id ON DELETE RESTRICT

### tax_rates
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO_INCREMENT | Primary key |
| tax_name | VARCHAR(100) | NO | — | Unique name (e.g. "Standard VAT") |
| tax_percentage | DECIMAL(10,4) | NO | — | Rate (e.g. 15.0000 for 15%) |
| description | TEXT | YES | NULL | Description |
| active | TINYINT(1) | NO | 1 | Soft delete flag |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |

### expense_categories
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | INT | NO | AUTO_INCREMENT | Primary key |
| category_name | VARCHAR(255) | NO | — | Unique category name |
| account_id | INT | YES | NULL | FK → accounts.id (SET NULL) |
| description | TEXT | YES | NULL | Description |
| active | TINYINT(1) | NO | 1 | Soft delete flag |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | — |

**Foreign Key**: account_id → accounts.id ON DELETE SET NULL

---

## Legacy Tables (PHP Schema — `tb_` prefix)

### tb_transactions
| Column | Type | Description |
|--------|------|-------------|
| transaction_id | INT | Primary key |
| transaction_date | DATE | Transaction date |
| transaction_type | VARCHAR | `income` or `expense` |
| party_name | VARCHAR | Supplier/customer name |
| invoice_number | VARCHAR | Reference number |
| vat_type | VARCHAR | `standard`, `zero`, `exempt`, `non-vat` |
| exclusive_amount | DECIMAL | Amount excluding VAT |
| vat_amount | DECIMAL | VAT portion |
| total_amount | DECIMAL | Inclusive total |
| expense_category_id | INT | FK → tb_expense_categories |
| transaction_invoice_id | INT | FK → tb_invoices (for cost-of-sales) |
| transaction_payment_id | INT | FK → tb_payments (link to payment) |
| document_path | VARCHAR | Uploaded document path |

### tb_expense_categories
| Column | Type | Description |
|--------|------|-------------|
| category_id | INT | Primary key |
| category_name | VARCHAR | Display name |
| category_code | VARCHAR | Accounting code |
| category_group | VARCHAR | Grouping label |
| itr14_mapping | VARCHAR | SARS ITR14 field mapping |
| allows_vat_claim | TINYINT | Whether VAT can be claimed on this category |

---

## Zod Validation Schemas

### createAccountSchema
```typescript
{
  account_code: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  account_category: z.string().optional(),
  description: z.string().optional(),
  active: z.number().default(1),
}
```

### createTransactionSchema
```typescript
{
  transaction_date: z.string().date(),
  account_id: z.number().int().positive(),
  debit_amount: z.number().nonnegative().default(0),
  credit_amount: z.number().nonnegative().default(0),
  description: z.string().optional(),
  reference_number: z.string().optional(),
}
```

### createLedgerSchema
```typescript
{
  ledger_date: z.string().date(),
  account_id: z.number().int().positive(),
  debit_amount: z.number().nonnegative().default(0),
  credit_amount: z.number().nonnegative().default(0),
  balance: z.number(),
  description: z.string().optional(),
  reference_number: z.string().optional(),
}
```

### createTaxRateSchema
```typescript
{
  tax_name: z.string().min(1),
  tax_percentage: z.number().positive(),
  description: z.string().optional(),
  active: z.number().default(1),
}
```

### createExpenseCategorySchema
```typescript
{
  category_name: z.string().min(1),
  account_id: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  active: z.number().default(1),
}
```

---

## Frontend TypeScript Interfaces

### Account (frontend)
```typescript
{
  account_id?: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | string;
  is_active?: number;
}
```

### Transaction (frontend — legacy/VAT-compliant)
```typescript
{
  transaction_id?: number;
  transaction_date: string;
  transaction_type: 'expense' | 'income';
  party_name: string;
  party_vat_number?: string;
  invoice_number: string;
  document_path?: string;
  total_amount: number;
  vat_type: 'standard' | 'zero' | 'exempt' | 'non-vat';
  vat_amount: number;
  exclusive_amount: number;
  expense_category_id?: number;
  income_type?: string;
  category_name?: string;
  created_at?: string;
  updated_at?: string;
  transaction_payment_id?: number;
}
```

### LedgerEntry (frontend)
```typescript
{
  entry_id?: number;
  entry_date: string;
  description?: string;
  account_id: number;
  code?: string;
  name?: string;
  type?: string;
  debit?: number;
  credit?: number;
  linked_type?: string;
  linked_id?: number;
}
```

### ExpenseCategory (frontend — legacy)
```typescript
{
  category_id: number;
  category_name: string;
  category_code: string;
  category_group?: string;
  itr14_mapping: string;
  allows_vat_claim: number;
}
```

---

## Report Response Shapes

### Balance Sheet (`GET /financial-reports/balance-sheet`)
```typescript
{
  as_of_date: string;
  assets: {
    current_assets: { bank: number; accounts_receivable: number; total: number; };
    fixed_assets: { computer_equipment: number; office_equipment: number; total: number; };
    total_assets: number;
  };
  liabilities: {
    current_liabilities: { accounts_payable: number; sales_tax: number; unpaid_expense_claims: number; total: number; };
    total_liabilities: number;
  };
  equity: { net_assets: number; retained_earnings: number; total_equity: number; };
}
```

### Profit & Loss (`GET /financial-reports/profit-loss`)
```typescript
{
  period: { start: string; end: string; };
  trading_income: { sales: number; total: number; };
  cost_of_sales: { purchases: number; total: number; };
  gross_profit: number;
  operating_expenses: Array<{ category: string; amount: number; }>;
  total_operating_expenses: number;
  net_profit: number;
}
```

### VAT201 Report (`GET /vat-reports?type=vat201`)
```typescript
{
  period_start: string;
  period_end: string;
  total_sales: number;
  total_purchases: number;
  output_vat: number;
  input_vat: number;
  net_vat: number;
  vat_payable: number;    // max(0, output - input)
  vat_refundable: number; // max(0, input - output)
}
```

### ITR14 Report (`GET /vat-reports?type=itr14`)
```typescript
{
  year: number;
  period: string; // "YYYY-03-01 to YYYY+1-02-28"
  gross_income: number;
  total_expenses: number;
  taxable_income: number;
}
```

### IRP6 Report (`GET /vat-reports?type=irp6`)
```typescript
{
  from_date: string;
  to_date: string;
  estimated_income: number;
  estimated_expenses: number;
  estimated_taxable: number;
}
```
