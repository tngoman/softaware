# Invoices — Field & Data Dictionary

## Database Schema: `invoices` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `invoice_id` | Primary key |
| `contact_id` | `INT` (FK) | No | — | `invoice_contact_id` | Links to `contacts.id` |
| `invoice_number` | `VARCHAR` | No | — | `invoice_number` | Unique invoice number (e.g., "INV-001") |
| `invoice_amount` | `DECIMAL` | No | — | `invoice_total` / `invoice_subtotal` | ⚠️ Aliased to BOTH total and subtotal |
| `invoice_date` | `DATE` | No | — | `invoice_date` | Invoice issue date |
| `due_date` | `DATE` | Yes | `NULL` | `invoice_due_date` / `invoice_valid_until` | ⚠️ Aliased to BOTH due_date and valid_until |
| `paid` | `TINYINT` | No | `0` | `invoice_payment_status` | 0=unpaid, 1=partial, 2=paid |
| `remarks` | `TEXT` | Yes | `NULL` | `invoice_notes` | Free-text notes |
| `invoice_user_id` | `INT` | Yes | — | `invoice_user_id` | Creating user's ID |
| `quotation_id` | `INT` (FK) | Yes | `NULL` | `invoice_quote_id` | Links to originating quotation |
| `active` | `TINYINT` | No | `1` | `invoice_status` | 1=active, 0=soft-deleted |
| `created_at` | `DATETIME` | Yes | — | — | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | — | Last update timestamp |

### SQL Column Aliasing (INVOICE_SELECT)
```sql
i.id            AS invoice_id,
i.contact_id    AS invoice_contact_id,
i.invoice_number,
i.invoice_amount AS invoice_total,
i.invoice_amount AS invoice_subtotal,   -- ⚠️ same column aliased twice
0               AS invoice_vat,          -- ⚠️ hardcoded 0
0               AS invoice_discount,     -- ⚠️ hardcoded 0
i.invoice_date,
i.due_date      AS invoice_due_date,
i.due_date      AS invoice_valid_until,  -- ⚠️ same column aliased twice
i.paid          AS invoice_payment_status,
i.remarks       AS invoice_notes,
i.invoice_user_id,
i.quotation_id  AS invoice_quote_id,
i.active        AS invoice_status,
c.company_name  AS contact_name,         -- JOIN from contacts
c.email         AS contact_email,        -- JOIN from contacts
c.phone         AS contact_phone,        -- JOIN from contacts
c.vat_number    AS contact_vat,          -- JOIN from contacts
c.location      AS contact_address       -- JOIN from contacts
```

---

## Database Schema: `invoice_items` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `item_id` | Primary key |
| `invoice_id` | `INT` (FK) | No | — | `item_invoice_id` | Links to `invoices.id` |
| `item_description` | `VARCHAR` | No | — | `item_product` | Line item description |
| `item_quantity` | `INT` | No | `1` | `item_qty` | Quantity |
| `item_price` | `DECIMAL` | No | — | `item_price` | Unit price |
| `item_discount` | `DECIMAL` | No | `0` | `item_discount` | Discount amount |
| `created_at` | `DATETIME` | Yes | — | — | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | — | Last update timestamp |

**Computed columns** (in SELECT only):
- `item_subtotal` = `item_quantity * item_price`
- `item_vat` = hardcoded `0`
- `item_profit` = hardcoded `0`
- `item_cost` = hardcoded `0`

---

## Database Schema: `payments` Table (invoice-related columns)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | Primary key |
| `invoice_id` | `INT` (FK) | No | — | Links to `invoices.id` |
| `payment_date` | `DATE` | No | — | Payment date |
| `payment_amount` | `DECIMAL` | No | — | Payment amount |
| `payment_method` | `VARCHAR` | Yes | `NULL` | Payment method label |
| `reference_number` | `VARCHAR` | Yes | `NULL` | External reference |
| `remarks` | `TEXT` | Yes | `NULL` | Payment notes |
| `created_at` | `DATETIME` | Yes | — | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | Last update timestamp |

---

## Zod Validation Schemas

### `createInvoiceSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `invoice_number` | `string` | No | `min(1)`, auto-generated as `INV-NNNNN` if omitted |
| `invoice_contact_id` | `number` | No* | `int().positive()` |
| `contact_id` | `number` | No* | `int().positive()` (alias for `invoice_contact_id`) |
| `quotation_id` | `number` | No | `int().positive()` |
| `invoice_quote_id` | `number` | No | `int().positive()` (alias for `quotation_id`) |
| `invoice_amount` | `number` | No | Total amount |
| `invoice_total` | `number` | No | Alias for amount |
| `invoice_subtotal` | `number` | No | Alias for amount |
| `invoice_vat` | `number` | No | VAT amount |
| `invoice_discount` | `number` | No | Discount amount |
| `invoice_date` | `string` | No | Defaults to today (YYYY-MM-DD) |
| `invoice_due_date` | `string` | No | Payment due date |
| `invoice_valid_until` | `string` | No | Alias for due_date |
| `due_date` | `string` | No | Alias for due_date |
| `invoice_status` | `number` | No | Default `1` |
| `invoice_payment_status` | `number` | No | Paid status |
| `invoice_notes` | `string` | No | Free-text notes |
| `remarks` | `string` | No | Alias for notes |
| `active` | `number` | No | Default `1` |
| `items` | `array` | No | Array of line items (see below) |

\* At least one of `invoice_contact_id` or `contact_id` must be provided.

#### `items[]` Array Schema
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `item_product` | `string` | No | Product name |
| `item_description` | `string` | No | Item description (alias for product) |
| `item_qty` | `number` | No | Quantity |
| `item_quantity` | `number` | No | Quantity (alias) |
| `item_price` | `number` | No | Unit price |
| `item_cost` | `number` | No | Cost price |
| `item_discount` | `number` | No | Discount amount |
| `item_subtotal` | `number` | No | Line subtotal |
| `item_vat` | `number` | No | VAT amount |
| `item_profit` | `number` | No | Profit amount |

### `updateInvoiceSchema`
All fields from `createInvoiceSchema`, all optional (`.partial()`).
When `items[]` is provided on update, existing items are **deleted and replaced**.

### `createInvoiceItemSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `item_description` | `string` | Yes | `min(1)` |
| `item_price` | `number` | Yes | `positive()` |
| `item_quantity` | `number` | No | `int().positive()`, default `1` |
| `item_discount` | `number` | No | `nonnegative()`, default `0` |

### `createPaymentSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `payment_date` | `string` | Yes | `.date()` format |
| `payment_amount` | `number` | Yes | `positive()` |
| `payment_method` | `string` | No | — |
| `reference_number` | `string` | No | — |
| `remarks` | `string` | No | — |

---

## API Response Schemas

### Invoice Object (from INVOICE_SELECT + JOINs)
```json
{
  "invoice_id": 1,
  "invoice_contact_id": 5,
  "invoice_number": "INV-001",
  "invoice_total": 1500.00,
  "invoice_subtotal": 1500.00,
  "invoice_vat": 0,
  "invoice_discount": 0,
  "invoice_date": "2024-01-20",
  "invoice_due_date": "2024-02-20",
  "invoice_valid_until": "2024-02-20",
  "invoice_payment_status": 0,
  "invoice_notes": "Net 30 terms",
  "invoice_user_id": 1,
  "invoice_quote_id": null,
  "invoice_status": 1,
  "contact_name": "Acme Corp",
  "contact_email": "billing@acme.com",
  "contact_phone": "+27 11 123 4567"
}
```

### Invoice Detail Object (GET /:id)
```json
{
  "invoice_id": 1,
  "...all fields above...",
  "items": [
    {
      "item_id": 1,
      "item_invoice_id": 1,
      "item_product": "Web Development",
      "item_qty": 10,
      "item_price": 150.00,
      "item_subtotal": 1500.00,
      "item_discount": 0,
      "item_vat": 0,
      "item_profit": 0,
      "item_cost": 0
    }
  ],
  "payments": [
    {
      "payment_id": 1,
      "payment_date": "2024-02-01",
      "payment_amount": 750.00,
      "payment_invoice": 1
    }
  ]
}
```

### PDF Generation Response
```json
{
  "success": true,
  "filename": "invoice_INV-001_20240120.pdf",
  "path": "generated/invoices/invoice_INV-001_20240120.pdf"
}
```

---

## Frontend TypeScript Types

### `Invoice` (from `types/index.ts`)
```typescript
interface Invoice {
  invoice_id?: number;
  invoice_contact_id: number;
  invoice_number?: string;
  invoice_total: number;
  invoice_subtotal?: number;
  invoice_vat?: number;
  invoice_discount?: number;
  invoice_date: string;
  invoice_due_date?: string;
  invoice_valid_until?: string;
  invoice_payment_status: number;
  invoice_payment_date?: string;
  invoice_notes?: string;
  invoice_user_id?: number;
  invoice_quote_id?: number;
  invoice_status: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}
```

### `InvoiceItem` (from `types/index.ts`)
```typescript
interface InvoiceItem {
  item_id?: number;
  item_invoice_id?: number;
  item_product: string;
  item_qty: number;
  item_price: number;
  item_subtotal?: number;
  item_discount?: number;
  item_vat?: number;
  item_profit?: number;
  item_cost?: number;
}
```

## Frontend Component State (Invoices.tsx)

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedInvoice` | `Invoice \| null` | `null` | Currently viewed invoice |
| `loading` | `boolean` | `false` | API call in progress |
| `emailModalOpen` | `boolean` | `false` | Email modal visibility |
| `paymentModalOpen` | `boolean` | `false` | Payment modal visibility |
| `payments` | `any[]` | `[]` | Payments for selected invoice |
| `pagination` | `{ page, limit, total }` | `{ 0, 10, 0 }` | Server-side pagination |
| `search` | `string` | `''` | Search query |

## Zustand Store Fields
| Field | Type | Description |
|-------|------|-------------|
| `invoices` | `Invoice[]` | Current page of invoices |
| `setInvoices` | `function` | Update invoices array |
| `customers` | `Contact[]` | Customer list for form dropdowns |
| `setCustomers` | `function` | Update customers array |
