# Quotations — Field & Data Dictionary

## Database Schema: `quotations` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `quotation_id` | Primary key |
| `contact_id` | `INT` (FK) | No | — | `quotation_contact_id` | Links to `contacts.id` |
| `quotation_number` | `VARCHAR` | No | — | `quotation_number` | Unique quotation number |
| `quotation_amount` | `DECIMAL` | No | — | `quotation_total` / `quotation_subtotal` | ⚠️ Aliased to BOTH total and subtotal |
| `quotation_date` | `DATE` | No | — | `quotation_date` | Quotation issue date |
| `quotation_user_id` | `VARCHAR` | Yes | `NULL` | `quotation_user_id` | Creating user ID (UUID format in schema) |
| `remarks` | `TEXT` | Yes | `NULL` | `quotation_notes` | Free-text notes |
| `active` | `TINYINT` | No | `1` | `quotation_status` | 1=active, 0=soft-deleted |
| `created_at` | `DATETIME` | Yes | — | `quotation_time` (UNIX_TIMESTAMP) | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | `quotation_updated` (UNIX_TIMESTAMP) | Last update timestamp |

### Column Aliasing (QUOTATION_SELECT)
```sql
q.id            AS quotation_id,
q.contact_id    AS quotation_contact_id,
q.quotation_number,
q.quotation_amount AS quotation_total,
q.quotation_amount AS quotation_subtotal,  -- ⚠️ same column aliased twice
q.quotation_date,
DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until,  -- ⚠️ computed
q.quotation_user_id,
q.remarks       AS quotation_notes,
q.active        AS quotation_status,
0               AS quotation_vat,           -- ⚠️ hardcoded 0
0               AS quotation_discount,      -- ⚠️ hardcoded 0
UNIX_TIMESTAMP(q.created_at)  AS quotation_time,
UNIX_TIMESTAMP(q.updated_at)  AS quotation_updated,
c.company_name  AS contact_name,            -- JOIN from contacts
c.email         AS contact_email,           -- JOIN from contacts
c.phone         AS contact_phone,           -- JOIN from contacts
c.vat_number    AS contact_vat,             -- JOIN from contacts
c.location      AS contact_address          -- JOIN from contacts
```

**Notable computed/hardcoded fields**:
- `quotation_valid_until`: Always 30 days after `quotation_date` (not stored in DB)
- `quotation_vat`, `quotation_discount`: Always `0` (not stored)
- Timestamps returned as UNIX timestamps

---

## Database Schema: `quote_items` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `item_id` | Primary key |
| `quotation_id` | `INT` (FK) | No | — | `item_quote_id` | Links to `quotations.id` |
| `item_description` | `VARCHAR` | No | — | `item_product` | Line item description |
| `item_quantity` | `INT` | No | `1` | `item_qty` | Quantity |
| `item_price` | `DECIMAL` | No | — | `item_price` | Unit price |
| `item_discount` | `DECIMAL` | No | `0` | `item_discount` | Discount amount |
| `line_total` | `DECIMAL` | Yes | — | — | Stored total (in type but not used in SELECT) |
| `created_at` | `DATETIME` | Yes | — | — | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | — | Last update timestamp |

**Computed columns** (in SELECT only):
- `item_subtotal` = `item_quantity * item_price`
- `item_vat` = hardcoded `0`
- `item_profit` = hardcoded `0`
- `item_cost` = hardcoded `0`

---

## Zod Validation Schemas

### `createQuotationSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `quotation_number` | `string` | No | `min(1)`, auto-generated as `QUO-NNNNN` if omitted |
| `quotation_contact_id` | `number` | No* | `int().positive()` |
| `contact_id` | `number` | No* | `int().positive()` (alias for `quotation_contact_id`) |
| `quotation_amount` | `number` | No | Total amount |
| `quotation_total` | `number` | No | Alias for amount |
| `quotation_subtotal` | `number` | No | Alias for amount |
| `quotation_vat` | `number` | No | VAT amount |
| `quotation_discount` | `number` | No | Discount amount |
| `quotation_date` | `string` | No | Defaults to today (YYYY-MM-DD) |
| `quotation_valid_until` | `string` | No | Valid-until date |
| `quotation_status` | `number` | No | Default `1` |
| `quotation_notes` | `string` | No | Free-text notes |
| `quotation_user_id` | `string` | No | `.uuid()` |
| `remarks` | `string` | No | Alias for notes |
| `active` | `number` | No | Default `1` |
| `items` | `array` | No | Array of line items (see below) |

\* At least one of `quotation_contact_id` or `contact_id` must be provided.

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

### `updateQuotationSchema`
All fields from `createQuotationSchema`, all optional (`.partial()`).
When `items[]` is provided on update, existing items are **deleted and replaced**.

### `createQuoteItemSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `item_description` | `string` | Yes | `min(1)` |
| `item_price` | `number` | Yes | `positive()` |
| `item_quantity` | `number` | No | `int().positive()`, default `1` |
| `item_discount` | `number` | No | `nonnegative()`, default `0` |

---

## API Response Schemas

### Quotation Object (from QUOTATION_SELECT + JOINs)
```json
{
  "quotation_id": 1,
  "quotation_contact_id": 5,
  "quotation_number": "QUO-001",
  "quotation_total": 2500.00,
  "quotation_subtotal": 2500.00,
  "quotation_date": "2024-01-15",
  "quotation_valid_until": "2024-02-14",
  "quotation_user_id": null,
  "quotation_notes": "Web project proposal",
  "quotation_status": 1,
  "quotation_vat": 0,
  "quotation_discount": 0,
  "quotation_time": 1705312800,
  "quotation_updated": 1705312800,
  "contact_name": "Acme Corp",
  "contact_email": "billing@acme.com",
  "contact_phone": "+27 11 123 4567"
}
```

### Quotation Detail Object (GET /:id)
```json
{
  "quotation_id": 1,
  "...all fields above...",
  "items": [
    {
      "item_id": 1,
      "item_quote_id": 1,
      "item_product": "Website Design",
      "item_qty": 1,
      "item_price": 2500.00,
      "item_subtotal": 2500.00,
      "item_discount": 0,
      "item_vat": 0,
      "item_profit": 0,
      "item_cost": 0
    }
  ]
}
```

### Convert-to-Invoice Response
```json
{
  "success": true,
  "message": "Quotation converted to invoice",
  "data": {
    "id": 42,
    "invoice_number": "INV-042",
    "contact_id": 5,
    "quotation_id": 1,
    "invoice_amount": 2500.00,
    "...full invoice row..."
  }
}
```

---

## Frontend TypeScript Types

### `Quotation` (from `types/index.ts`)
```typescript
interface Quotation {
  quotation_id?: number;
  quotation_contact_id: number;
  quotation_date?: string;
  quotation_valid_until?: string;
  quotation_subtotal?: number;
  quotation_vat?: number;
  quotation_total?: number;
  quotation_discount?: number;
  quotation_notes?: string;
  quotation_status?: number;
  quotation_user_id?: number;
  quotation_time?: number;
  quotation_updated?: number;
  quotation_email?: string;
  quotation_subject?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  items?: QuoteItem[];
}
```

### `QuoteItem` (from `types/index.ts`)
```typescript
interface QuoteItem {
  item_id?: number;
  item_quote_id?: number;
  item_product: string;
  item_qty: number;
  item_price: number;
  item_subtotal: number;
  item_profit?: number;
  item_cost?: number;
  item_discount?: number;
  item_vat?: number;
}
```

---

## Frontend Component State (Quotations.tsx)

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedQuote` | `Quotation \| null` | `null` | Currently viewed quotation |
| `loading` | `boolean` | `false` | API call in progress |
| `emailModalOpen` | `boolean` | `false` | Email modal visibility |
| `generatingPdf` | `boolean` | `false` | PDF generation in progress |
| `pdfPath` | `string \| null` | `null` | Last generated PDF path |
| `pagination` | `{ page, limit, total }` | `{ 0, 10, 0 }` | Server-side pagination |
| `search` | `string` | `''` | Search query |

## Zustand Store Fields
| Field | Type | Description |
|-------|------|-------------|
| `quotations` | `Quotation[]` | Current page of quotations |
| `setQuotations` | `function` | Update quotations array |
| `customers` | `Contact[]` | Customer list for form dropdowns |
| `setCustomers` | `function` | Update customers array |
