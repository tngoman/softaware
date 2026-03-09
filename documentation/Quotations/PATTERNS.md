# Quotations — Patterns & Anti-Patterns

## Architectural Patterns

### 1. QUOTATION_SELECT Column Aliasing
**Pattern**: Centralized SQL fragment mapping DB columns to frontend-friendly names, identical approach to Invoices.

```typescript
const QUOTATION_SELECT = `
  q.id AS quotation_id, q.contact_id AS quotation_contact_id, ...
`;
```

**Benefit**: Consistent API shape across all quotation endpoints.  
**Trade-off**: Hardcoded `0` for VAT and discount; computed `valid_until` (always 30 days from date).

---

### 2. Transactional Quotation-to-Invoice Conversion
**Pattern**: The convert-to-invoice route uses explicit MySQL transactions to ensure atomicity.

```typescript
await db.execute('START TRANSACTION');
try {
  const invoiceId = await db.insertOne('invoices', { ... });
  for (const item of quoteItems) {
    await db.insertOne('invoice_items', { ... });
  }
  await db.execute('COMMIT');
} catch (err) {
  await db.execute('ROLLBACK');
  throw err;
}
```

**Benefit**: If any step fails, the entire operation rolls back — no orphaned invoices.  
**Observation**: This is the **only route in the codebase** using explicit transactions.

---

### 3. Computed Valid-Until Date
**Pattern**: Instead of storing `valid_until`, it's computed dynamically:

```sql
DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until
```

**Benefit**: Always consistent — can't have stale data.  
**Limitation**: 30-day validity is hardcoded; no per-quotation customization.

---

### 4. UNIX Timestamp Conversion
**Pattern**: Timestamps are converted to UNIX format in the SELECT:

```sql
UNIX_TIMESTAMP(q.created_at) AS quotation_time,
UNIX_TIMESTAMP(q.updated_at) AS quotation_updated
```

**Benefit**: Frontend gets numeric timestamps for easy date math.  
**Inconsistency**: Other modules return ISO date strings, not UNIX timestamps.

---

### 5. Expired Quotation Visual Indicator
**Pattern**: Frontend computes expiry inline in the DataTable column:

```tsx
const validDate = new Date(getValue());
const isExpired = validDate < today;
return <span className={isExpired ? 'text-scarlet font-semibold' : '...'}>
  {formatDate(getValue())} {isExpired && ' (Expired)'}
</span>;
```

**Benefit**: Users immediately see expired quotations.  
**Note**: This is frontend-only — no backend filtering by expiry status.

---

### 6. Quick Stats in Header
**Pattern**: The list view header shows computed statistics from the current page data:

```tsx
<p>{quotations.filter(q => q.quotation_status === 0).length}</p>  // Pending count
<p>{formatCurrency(quotations.reduce((sum, q) => sum + Number(q.quotation_total), 0))}</p>  // Total value
```

**Limitation**: Stats are computed from current page only, not total dataset.

---

### 7. Confirmation Dialog for Conversion
**Pattern**: Convert-to-invoice uses SweetAlert2 for user confirmation before the irreversible action.

```typescript
const result = await Swal.fire({
  title: 'Convert to Invoice?',
  text: 'Are you sure you want to convert this quotation to an invoice?',
  showCancelButton: true,
});
if (result.isConfirmed) { ... }
```

**Benefit**: Prevents accidental conversions.

---

### 8. Parallel Module Architecture with Invoices
**Pattern**: Quotations and Invoices share nearly identical architecture:
- Same CRUD pattern with Zod validation
- Same column aliasing approach
- Same PDF generation flow
- Same email sending pattern
- Quotations additionally have convert-to-invoice

This makes the codebase consistent and predictable.

---

### 9. Server-Side Search
**Pattern**: The list endpoint supports text search across multiple columns:

```typescript
const search = (req.query.search as string) || '';
if (search) {
  const searchClause = ' AND (q.quotation_number LIKE ? OR c.company_name LIKE ? OR q.remarks LIKE ?)';
  const searchVal = `%${search}%`;
  query += searchClause;
  countQuery += searchClause;
  params.push(searchVal, searchVal, searchVal);
  countParams.push(searchVal, searchVal, searchVal);
}
```

**Benefit**: Search includes quotation number, customer name, and remarks.
**Note**: Search also applies to the count query for accurate pagination.

---

### 10. Server-Side Sorting with Column Mapping
**Pattern**: Frontend sort column names are mapped to safe database column references:

```typescript
const sortColumnMap: Record<string, string> = {
  'quotation_id': 'q.id',
  'quotation_date': 'q.quotation_date',
  'contact_name': 'c.company_name',
  'quotation_total': 'q.quotation_amount',
  'quotation_status': 'q.active'
};
const sortColumn = sortColumnMap[sortBy] || 'q.id';
```

**Benefit**: Prevents SQL injection by whitelisting sort columns.
**Note**: Default sort is `q.id DESC` (newest first).

---

### 11. Auto-Generated Sequential Numbering (QUO-NNNNN)
**Pattern**: Quotation numbers are auto-generated if not provided:

```typescript
const lastQuote = await db.queryOne<any>(
  'SELECT quotation_number FROM quotations WHERE quotation_number LIKE "QUO-%" ORDER BY id DESC LIMIT 1'
);
let nextNumber = 1;
if (lastQuote?.quotation_number) {
  const match = lastQuote.quotation_number.match(/QUO-(\d+)/);
  if (match) nextNumber = parseInt(match[1], 10) + 1;
}
quotationNumber = `QUO-${String(nextNumber).padStart(5, '0')}`;
```

**Benefit**: Sequential, human-readable quotation numbers.
**Uniqueness**: If a collision is detected, a timestamp is appended as fallback.

---

### 12. Inline Item Creation on Quotation Create/Update
**Pattern**: The create and update endpoints accept an `items[]` array to create/replace line items atomically:

```typescript
// On create: insert items after quotation
if (data.items && data.items.length > 0) {
  for (const item of data.items) {
    await db.insertOne('quote_items', { quotation_id: insertId, ... });
  }
}

// On update: replace all items
if (data.items && data.items.length > 0) {
  await db.execute('DELETE FROM quote_items WHERE quotation_id = ?', [id]);
  for (const item of data.items) {
    await db.insertOne('quote_items', { quotation_id: id, ... });
  }
}
```

**Benefit**: Frontend can submit quotation header + items in a single API call.
**Note**: Update replaces ALL items (delete-and-reinsert pattern).

---

## Anti-Patterns & Issues

### ~~A1. Frontend-Backend Route Mismatch~~ (FIXED)
**Status**: ✅ Resolved — `QuotationModel.convertToInvoice()` now correctly calls `/quotations/${quoteId}/convert-to-invoice`.

---

### A2. Hardcoded 30-Day Validity
**Problem**: `quotation_valid_until` is always computed as `DATE_ADD(date, INTERVAL 30 DAY)`.

**Impact**: Cannot customize validity period per quotation.  
**Fix**: Add `valid_until` column or `validity_days` column to quotations table.

---

### A3. Hardcoded VAT and Discount
**Problem**: Same as Invoices — `0 AS quotation_vat` and `0 AS quotation_discount` hardcoded in SQL.

**Impact**: VAT calculations shown in frontend (15% VAT display) don't match backend data.  
**Fix**: Add VAT/discount columns or compute from items.

---

### A4. No Backend Permission Enforcement
**Problem**: All quotation routes only require JWT authentication, not RBAC permissions.

**Impact**: Any authenticated user can CRUD all quotations and convert them to invoices.  
**Fix**: Add `permissionMiddleware('quotations.*')` to routes.

---

### A5. Sequential Item Copy in Conversion
**Problem**: Convert-to-invoice copies items one by one in a loop:

```typescript
for (const item of quoteItems) {
  await db.insertOne('invoice_items', { ... });
}
```

**Impact**: N sequential INSERT queries (one per item) inside a transaction.  
**Fix**: Use batch INSERT: `INSERT INTO invoice_items (cols) VALUES (...), (...), (...)`

---

### A7. No Status Update After Conversion
**Problem**: When a quotation is converted to an invoice, its `active` (status) field is not updated to `2` (Accepted).

**Impact**: Converted quotations still appear as Draft/Sent in the list.  
**Fix**: Add `UPDATE quotations SET active = 2 WHERE id = ?` in the conversion transaction.

---

### A8. Stats Computed from Current Page Only
**Problem**: Quick stats (Total Quotes, Pending, Total Value) are computed from the current page's data, not the full dataset.

```typescript
quotations.filter(q => q.quotation_status === 0).length  // Only current page
```

**Impact**: Stats change when navigating pages and don't reflect the total.  
**Fix**: Compute stats server-side and include in API response.

---

### ~~A9. Quotation Number Race Condition~~ (MITIGATED)
**Status**: Partially resolved — quotation numbers are now auto-generated as `QUO-NNNNN` with a timestamp fallback if a collision is detected. However, a `UNIQUE` index on `quotation_number` is still recommended for full protection.
**Problem**: Same as Invoices — uniqueness check at application level, not database level.

**Fix**: Add `UNIQUE` constraint on `quotations.quotation_number`.

---

### A10. Frontend VAT Calculation Mismatch
**Problem**: Frontend renders VAT at 15% from items, but backend always returns `0`:

```tsx
const itemVat = (item.item_vat === 1) 
  ? (Number(item.item_qty) * Number(item.item_price) * 0.15) 
  : 0;
```

**Impact**: VAT display depends on item_vat flag but backend always returns `item_vat = 0`.

---

## Design Patterns Summary

| Pattern | Location | Quality |
|---------|----------|---------|
| QUOTATION_SELECT aliasing | `quotations.ts` | ✅ Good (with caveats) |
| Transactional conversion | `quotations.ts` convert | ✅ Good |
| Computed valid_until | `QUOTATION_SELECT` | ⚠️ Not customizable |
| UNIX timestamp conversion | `QUOTATION_SELECT` | ⚠️ Inconsistent with other modules |
| Expired indicator | `Quotations.tsx` | ✅ Good UX |
| Confirmation dialogs | `Quotations.tsx` | ✅ Good UX |
| Parallel architecture with Invoices | Both modules | ✅ Good consistency |
| Frontend-only permissions | `Quotations.tsx` | ❌ Anti-pattern |
| Route mismatch (convertToInvoice) | `QuotationModel.ts` | ❌ Bug |
| No status update on conversion | `quotations.ts` | ❌ Missing logic |
| Hardcoded VAT/discount | `QUOTATION_SELECT` | ❌ Incomplete feature |
