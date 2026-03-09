# Invoices — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| INV-001 | 🔴 Critical | `invoices.ts` | No backend permission enforcement — any authenticated user can CRUD invoices | Add `permissionMiddleware('invoices.*')` |
| INV-003 | 🔴 Critical | `invoices.ts` | Payment status inconsistency — auto-paid sets `paid = 1` (shown as "Partial"), should be `2` ("Paid") | Change to `paid = 2` when fully paid |
| INV-004 | 🟠 High | `invoices.ts` | SMTP failure masked as success — `send-email` returns 200 even on failure | Return error status on SMTP failure |
| INV-005 | 🟠 High | `invoices.ts` | Invoice number uniqueness check — mitigated by auto-generation with timestamp fallback | Add `UNIQUE` index on `invoice_number` for full protection |
| INV-006 | 🟠 High | `Invoices.tsx` | Invoice creation form not implemented — renders placeholder text | Build full invoice creation form |
| INV-007 | 🟡 Medium | `INVOICE_SELECT` | VAT and discount hardcoded to `0` — non-functional | Add columns to DB or compute from items |
| INV-008 | 🟡 Medium | `invoices.ts` | Sequential DB queries in GET /:id — 3 queries not parallelized | Use `Promise.all()` |
| INV-009 | 🟡 Medium | `InvoiceModel.ts` | `getItems` and `updateItems` call `/invoice-items` endpoint not in invoices router | Verify route exists elsewhere or implement |
| INV-010 | 🟢 Low | `INVOICE_SELECT` | `invoice_amount` aliased to both `invoice_total` and `invoice_subtotal` — redundant | Remove one alias when VAT/discount implemented |
| INV-011 | 🟢 Low | `invoices.ts` | `mark-paid` sets `paid = 1` (should be `2`) | Align with status enum |
| INV-012 | 🟢 Low | `invoices.ts` | No invoice restoration endpoint (undo soft delete) | Add `PUT /invoices/:id/restore` |

---

## Migration Notes

### Fix Payment Status Values (INV-003, INV-011)
```sql
-- Update all fully-paid invoices that have paid = 1 to paid = 2
UPDATE invoices SET paid = 2 WHERE paid = 1 AND id IN (
  SELECT invoice_id FROM (
    SELECT p.invoice_id, SUM(p.payment_amount) as total_paid, i.invoice_amount
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    GROUP BY p.invoice_id
    HAVING total_paid >= i.invoice_amount
  ) AS fully_paid
);
```

### Add Invoice Number Uniqueness Constraint (INV-005)
```sql
-- Check for existing duplicates first
SELECT invoice_number, COUNT(*) as cnt
FROM invoices
GROUP BY invoice_number
HAVING cnt > 1;

-- If no duplicates, add constraint
ALTER TABLE invoices ADD UNIQUE INDEX idx_invoice_number (invoice_number);
```

### Add VAT and Discount Columns (INV-007)
```sql
ALTER TABLE invoices
  ADD COLUMN vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER invoice_amount,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER vat_amount;

-- Update INVOICE_SELECT to use actual columns:
-- Replace: 0 AS invoice_vat, 0 AS invoice_discount
-- With:    i.vat_amount AS invoice_vat, i.discount_amount AS invoice_discount
```

---

## Suggested Improvements

### Short-term (Sprint-level)

1. **Fix payment status values** (INV-003)
   ```typescript
   // In POST /:id/payments — change:
   if (totalPaid >= invoice.invoice_amount) {
     await db.execute('UPDATE invoices SET paid = 2 WHERE id = ?', [id]);
   } else if (totalPaid > 0) {
     await db.execute('UPDATE invoices SET paid = 1 WHERE id = ?', [id]);
   }
   ```

2. **Add backend permissions** (INV-001)
   ```typescript
   invoicesRouter.get('/', requireAuth, permissionMiddleware('invoices.view'), ...);
   invoicesRouter.post('/', requireAuth, permissionMiddleware('invoices.create'), ...);
   invoicesRouter.put('/:id', requireAuth, permissionMiddleware('invoices.edit'), ...);
   invoicesRouter.delete('/:id', requireAuth, permissionMiddleware('invoices.delete'), ...);
   ```

3. **Parallelize detail queries** (INV-008)
   ```typescript
   const [invoice, items, payments] = await Promise.all([
     db.queryOne(`SELECT ${INVOICE_SELECT} ...`, [id]),
     db.query('SELECT ... FROM invoice_items WHERE invoice_id = ?', [id]),
     db.query('SELECT ... FROM payments WHERE invoice_id = ?', [id])
   ]);
   ```

4. **Fix SMTP error handling** (INV-004)
   ```typescript
   try {
     await transporter.sendMail({ ... });
     res.json({ success: true, message: 'Email sent successfully' });
   } catch (emailErr) {
     res.status(502).json({ success: false, message: 'Email delivery failed' });
   }
   ```

### Medium-term

5. **Invoice creation form** (INV-006) — Full form with contact dropdown, line item editor, date pickers
6. **VAT and discount** (INV-007) — Proper tax calculation with configurable rates
7. **~~Invoice number auto-generation~~** — ✅ Implemented (INV-NNNNN sequential numbering with timestamp fallback)

### Long-term

9. **Recurring invoices** — Auto-generate invoices on schedule
10. **Invoice templates** — Customizable PDF layouts
11. **Multi-currency support** — Currency field with exchange rates
12. **Audit log** — Track all invoice modifications
13. **Batch operations** — Bulk send, bulk mark-paid, bulk export

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| March 2026 | — | Added server-side search (invoice_number, company_name, remarks) |
| March 2026 | — | Added auto-generated sequential numbering (INV-NNNNN format) |
| March 2026 | — | Added inline items array support on create and update |
| March 2026 | — | Expanded Zod schemas with field aliases (contact_id/invoice_contact_id, etc.) |
| March 2026 | — | Data reimported: 46 invoices with 184 items from SQL dump |
| *(initial)* | — | Core CRUD with pagination and contact JOIN |
| *(initial)* | — | Line item management (add/delete) |
| *(initial)* | — | Payment recording with auto-paid detection |
| *(initial)* | — | PDF generation via pdfGenerator utility |
| *(initial)* | — | Email sending via nodemailer SMTP |
| *(initial)* | — | Mark-as-paid manual override |
| *(initial)* | — | Frontend detail view with payment and email modals | |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| **Contacts** | Data (FK) | `invoices.contact_id → contacts.id` |
| **Quotations** | Data (FK) | `invoices.quotation_id → quotations.id` |
| **Payments** | Data (FK) | `payments.invoice_id → invoices.id` |
| **Authentication** | Auth | JWT `requireAuth` middleware on all routes |
| **Settings** | Config | Company settings for PDF generation, SMTP config |
| **Accounting** | Integration | Payments can be processed into transactions |

## Modules That Depend on Invoices

| Module | Usage |
|--------|-------|
| **Contacts** | Contact detail page shows linked invoices |
| **Payments** | Payments are recorded against invoices |
| **Dashboard** | Outstanding invoice totals displayed |
| **FinancialReports** | Invoice data used in financial summaries |
| **Accounting** | Invoice payments flow into accounting transactions |
