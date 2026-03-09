# Invoices — Patterns & Anti-Patterns

## Architectural Patterns

### 1. INVOICE_SELECT Column Aliasing
**Pattern**: Centralized SQL fragment that maps database column names to frontend-friendly aliases.

```typescript
const INVOICE_SELECT = `
  i.id AS invoice_id, i.contact_id AS invoice_contact_id,
  i.invoice_amount AS invoice_total, i.invoice_amount AS invoice_subtotal,
  0 AS invoice_vat, 0 AS invoice_discount, ...
`;
```

**Benefit**: Consistent API shape across all invoice endpoints. Frontend never sees raw DB column names.  
**Trade-off**: Hardcoded `0` values for VAT and discount mean these features are stubbed but not implemented.

---

### 2. Composite Detail Response
**Pattern**: `GET /:id` returns the invoice header, all line items, and all payments in a single response.

```typescript
const invoice = await db.queryOne(...);
const items = await db.query('SELECT ... FROM invoice_items WHERE invoice_id = ?', [id]);
const payments = await db.query('SELECT ... FROM payments WHERE invoice_id = ?', [id]);
res.json({ success: true, data: { ...invoice, items, payments } });
```

**Benefit**: Single API call to render full invoice detail page.  
**Trade-off**: 3 sequential DB queries (not parallelized) — could use `Promise.all()`.

---

### 3. Auto-Paid Detection
**Pattern**: After recording a payment, the system checks if total payments meet or exceed the invoice amount.

```typescript
const totalPaid = await db.queryOne('SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?', [id]);
if (totalPaid >= invoice.invoice_amount) {
  await db.execute('UPDATE invoices SET paid = 1 WHERE id = ?', [id]);
}
```

**Benefit**: Automatic status updates reduce manual bookkeeping.  
**Issue**: Sets `paid = 1` when fully paid, but frontend `PaymentStatusBadge` expects `2` for "Paid" — see anti-pattern A2.

---

### 4. Soft Delete for Invoices, Hard Delete for Items
**Pattern**: Invoice deletion is soft (sets `active = 0`), but line item deletion is hard (`DELETE FROM`).

**Rationale**: Invoice records have financial significance (audit trail), while line items are considered mutable sub-records.  
**Consistency**: Follows the platform-wide soft delete convention for parent records.

---

### 5. URL-Based Detail View
**Pattern**: The `Invoices.tsx` component uses `useParams()` to switch between list and detail views:

```typescript
const { id } = useParams();
// If id exists → detail view; if not → list view
if (selectedInvoice) { return <DetailView />; }
return <ListView />;
```

**Benefit**: Deep-linkable invoice URLs (`/invoices/42`).  
**Trade-off**: Single component handles both views — grows complex (509 LOC).

---

### 6. Zod Validation Before Database Operations
**Pattern**: All write operations validate request body with Zod before touching the database.

```typescript
const data = createInvoiceSchema.parse(req.body);
// Only reaches here if validation passes
```

**Benefit**: Type-safe, consistent error responses with detailed field-level errors.  
**Consistency**: Applied to invoices, items, and payments.

---

### 7. Contact Existence Verification
**Pattern**: Invoice creation verifies the contact exists before inserting:

```typescript
const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [data.contact_id]);
if (!contact) throw badRequest('Contact not found');
```

**Benefit**: Prevents orphaned invoices referencing non-existent contacts.  
**Note**: No FK constraint check in SQL — relies on application-level validation.

---

### 8. Invoice Number Uniqueness Check
**Pattern**: Before creating an invoice, checks for duplicate invoice numbers:

```typescript
const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [data.invoice_number]);
if (existing) throw badRequest('Invoice number already exists');
```

**Benefit**: Prevents duplicate invoice numbers in the system.  
**Race condition**: Two concurrent requests could both pass the check before either inserts.

---

### 9. Graceful SMTP Failure
**Pattern**: Email sending catches SMTP errors and returns success with a different message:

```typescript
try {
  await transporter.sendMail({ ... });
  res.json({ success: true, message: 'Email sent successfully' });
} catch (emailErr) {
  console.error('Email send failed:', emailErr.message);
  res.json({ success: true, message: 'Email queued (SMTP not fully configured)' });
}
```

**Benefit**: Email failures don't break the user workflow.  
**Issue**: Returns `success: true` even on failure — frontend can't distinguish between success and failure.

---

### 10. Server-Side Search
**Pattern**: The list endpoint supports text search across multiple columns:

```typescript
if (search) {
  const searchClause = ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR i.remarks LIKE ?)';
  const searchVal = `%${search}%`;
  query += searchClause;
  countQuery += searchClause;
}
```

**Benefit**: Search includes invoice number, customer name, and remarks.
**Note**: Search is combined with paid-status filter for compound queries.

---

### 11. Auto-Generated Sequential Numbering (INV-NNNNN)
**Pattern**: Invoice numbers are auto-generated if not provided:

```typescript
const lastInv = await db.queryOne<any>(
  'SELECT invoice_number FROM invoices WHERE invoice_number LIKE "INV-%" ORDER BY id DESC LIMIT 1'
);
let nextNumber = 1;
if (lastInv?.invoice_number) {
  const match = lastInv.invoice_number.match(/INV-(\d+)/);
  if (match) nextNumber = parseInt(match[1], 10) + 1;
}
invoiceNumber = `INV-${String(nextNumber).padStart(5, '0')}`;
```

**Benefit**: Sequential, human-readable invoice numbers.
**Uniqueness**: If a collision is detected, a timestamp is appended as fallback.

---

### 12. Inline Item Creation on Invoice Create/Update
**Pattern**: The create and update endpoints accept an `items[]` array:

```typescript
// On create: insert items after invoice
if (data.items && data.items.length > 0) {
  for (const item of data.items) {
    await db.insertOne('invoice_items', { invoice_id: insertId, ... });
  }
}

// On update: replace all items
if (data.items && data.items.length > 0) {
  await db.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
  for (const item of data.items) {
    await db.insertOne('invoice_items', { invoice_id: id, ... });
  }
}
```

**Benefit**: Frontend can submit invoice header + items in a single API call.
**Note**: Update replaces ALL items (delete-and-reinsert pattern).

---

## Anti-Patterns & Issues

### A1. Hardcoded VAT and Discount
**Problem**: `INVOICE_SELECT` returns `0 AS invoice_vat` and `0 AS invoice_discount` — these values never reflect real data.

**Impact**: VAT and discount calculations are non-functional. The `invoice_subtotal` equals `invoice_total` always.  
**Fix**: Add `vat` and `discount` columns to the `invoices` table, or compute from items.

---

### A2. Inconsistent Payment Status Values
**Problem**: Auto-paid detection sets `paid = 1` when fully paid, and `mark-paid` also sets `paid = 1`. But `PaymentStatusBadge` maps: 0=Unpaid, 1=Partial, 2=Paid.

```typescript
// Backend: sets paid = 1 for "fully paid"
if (totalPaid >= invoice.invoice_amount) {
  await db.execute('UPDATE invoices SET paid = 1 WHERE id = ?', [id]);
}

// Frontend: expects paid = 2 for "Paid"
case 2: return <span className="...bg-green-100...">Paid</span>;
case 1: return <span className="...bg-yellow-100...">Partial</span>;
```

**Impact**: Fully paid invoices show as "Partial" in the UI.  
**Fix**: Backend should set `paid = 2` when fully paid, or use a consistent status enum.

---

### A3. No Backend Permission Enforcement
**Problem**: All invoice routes only check JWT authentication, not RBAC permissions.

**Impact**: Any authenticated user can create, modify, delete, and send invoices regardless of their role.  
**Fix**: Add `permissionMiddleware('invoices.*')` to each route handler.

---

### A4. Sequential Queries in Detail Endpoint
**Problem**: `GET /:id` runs 3 sequential DB queries instead of parallel:

```typescript
const invoice = await db.queryOne(...);  // Query 1
const items = await db.query(...);       // Query 2
const payments = await db.query(...);    // Query 3
```

**Impact**: 3x latency (each query waits for the previous).  
**Fix**:
```typescript
const [invoice, items, payments] = await Promise.all([
  db.queryOne(...), db.query(...), db.query(...)
]);
```

---

### A6. Invoice Creation Form Not Implemented
**Problem**: `Invoices.tsx` has a code path for `/invoices/new` that renders a placeholder:

```tsx
if (selectedInvoice.invoice_id === 0) {
  return <div>Invoice creation form is not yet implemented.</div>;
}
```

**Impact**: Users cannot create invoices through the frontend UI.

---

### A7. SMTP Failure Masked as Success
**Problem**: The `send-email` route returns `{ success: true }` even when SMTP sending fails.

**Impact**: Users believe the email was sent when it wasn't.  
**Fix**: Return `{ success: false, message: "Email delivery failed" }` or use a queue with retry.

---

### ~~A8. Invoice Number Race Condition~~ (MITIGATED)
**Status**: Partially resolved — invoice numbers are now auto-generated as `INV-NNNNN` with a timestamp fallback if a collision is detected. However, a `UNIQUE` index on `invoice_number` is still recommended for full protection.

---

### A9. Model-Route Mismatch
**Problem**: `InvoiceModel` has `getItems()` and `updateItems()` calling `/invoice-items` endpoint, but no corresponding routes exist in `invoices.ts`.

```typescript
static async getItems(invoiceId: number) {
  return api.get('/invoice-items', { params: { invoice_id: invoiceId } });
}
```

**Impact**: These model methods may call a separate route file, or they may 404.

---

## Design Patterns Summary

| Pattern | Location | Quality |
|---------|----------|---------|
| INVOICE_SELECT aliasing | `invoices.ts` | ✅ Good (with caveats) |
| Composite detail response | `invoices.ts` GET /:id | ✅ Good |
| Auto-paid detection | `invoices.ts` payments | ⚠️ Buggy status values |
| Soft delete (invoices) | `invoices.ts` | ✅ Good |
| Hard delete (items) | `invoices.ts` | ✅ Acceptable |
| Zod validation | `invoices.ts` | ✅ Good |
| Contact verification | `invoices.ts` POST | ✅ Good |
| Number auto-generation | `invoices.ts` POST | ✅ Good (INV-NNNNN) |
| Server-side search | `invoices.ts` GET / | ✅ Good |
| Inline item creation | `invoices.ts` POST/PUT | ✅ Good |
| URL-based routing | `Invoices.tsx` | ✅ Good |
| Graceful SMTP failure | `invoices.ts` email | ❌ Masks real errors |
| Frontend-only permissions | `Invoices.tsx` | ❌ Anti-pattern |
| Hardcoded VAT/discount | `INVOICE_SELECT` | ❌ Incomplete feature |
