# Quotations — Changelog & Pending Changes

## Known Issues

| ID | Severity | Component | Description | Suggested Fix |
|----|----------|-----------|-------------|---------------|
| QUOT-001 | ~~🔴 Critical~~ ✅ Fixed | `QuotationModel.ts` | ~~Frontend calls `/convert-quote` but backend exposes `/quotations/:id/convert-to-invoice`~~ — Now correctly calls `/quotations/${quoteId}/convert-to-invoice` | Resolved |
| QUOT-002 | 🔴 Critical | `quotations.ts` | No backend permission enforcement — any authenticated user can CRUD quotations and convert to invoices | Add `permissionMiddleware('quotations.*')` |
| QUOT-004 | 🟠 High | `quotations.ts` | Convert-to-invoice doesn't update quotation status to "Accepted" | Add `UPDATE quotations SET active = 2 WHERE id = ?` in transaction |
| QUOT-005 | 🟠 High | `QUOTATION_SELECT` | VAT and discount hardcoded to `0` — frontend shows 15% VAT but backend returns `0` | Add columns or compute from items |
| QUOT-006 | 🟡 Medium | `QUOTATION_SELECT` | `quotation_valid_until` hardcoded to 30 days — not customizable | Add `valid_until` or `validity_days` column |
| QUOT-007 | 🟡 Medium | `quotations.ts` | Sequential item copy in conversion — loop of INSERT queries | Use batch INSERT |
| QUOT-008 | 🟡 Medium | `Quotations.tsx` | Quick stats computed from current page only, not total dataset | Move stats to server-side API |
| QUOT-009 | 🟡 Medium | `quotations.ts` | Quotation number uniqueness at app level — mitigated by auto-generation with timestamp fallback | Add `UNIQUE` index on `quotation_number` for full protection |
| QUOT-010 | 🟡 Medium | `quotations.ts` | SMTP failure masked as success in send-email | Return error status on failure |
| QUOT-011 | 🟢 Low | `QUOTATION_SELECT` | UNIX timestamps inconsistent with other modules that return ISO strings | Standardize timestamp format |
| QUOT-012 | 🟢 Low | `quotations.ts` | No restore endpoint for soft-deleted quotations | Add `PUT /quotations/:id/restore` |

---

## Migration Notes

### Fix Quotation Status After Conversion (QUOT-004)
```sql
-- No schema change needed. Update the convert-to-invoice route:
-- Inside the transaction, after invoice creation:
-- await db.execute('UPDATE quotations SET active = 2, updated_at = ? WHERE id = ?', [now, id]);
```

### Add Validity Period Column (QUOT-006)
```sql
ALTER TABLE quotations ADD COLUMN valid_until DATE NULL AFTER quotation_date;

-- Backfill existing records
UPDATE quotations SET valid_until = DATE_ADD(quotation_date, INTERVAL 30 DAY)
WHERE valid_until IS NULL;

-- Update QUOTATION_SELECT:
-- Replace: DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until
-- With:    COALESCE(q.valid_until, DATE_ADD(q.quotation_date, INTERVAL 30 DAY)) AS quotation_valid_until
```

### Add Quotation Number Uniqueness (QUOT-009)
```sql
SELECT quotation_number, COUNT(*) as cnt
FROM quotations GROUP BY quotation_number HAVING cnt > 1;

-- If no duplicates:
ALTER TABLE quotations ADD UNIQUE INDEX idx_quotation_number (quotation_number);
```

---

## Suggested Improvements

### Short-term (Sprint-level)

1. **~~Fix convert-to-invoice route mismatch~~** (QUOT-001) — ✅ Resolved
   ```typescript
   // QuotationModel.ts — now correctly uses:
   static async convertToInvoice(quoteId: number) {
     return api.post(`/quotations/${quoteId}/convert-to-invoice`, {});
   }
   ```

2. **Update status on conversion** (QUOT-004)
   ```typescript
   // In convert-to-invoice route, inside transaction after invoice creation:
   await db.execute(
     'UPDATE quotations SET active = 2, updated_at = ? WHERE id = ?',
     [new Date().toISOString(), id]
   );
   ```

3. **Add backend permissions** (QUOT-002)
   ```typescript
   quotationsRouter.get('/', requireAuth, permissionMiddleware('quotations.view'), ...);
   quotationsRouter.post('/', requireAuth, permissionMiddleware('quotations.create'), ...);
   quotationsRouter.post('/:id/convert-to-invoice', requireAuth, permissionMiddleware('quotations.approve'), ...);
   ```

### Medium-term

4. **Configurable validity period** (QUOT-006) — per-quotation or per-company setting
5. **Server-side stats** (QUOT-008) — return aggregate counts and totals in list API
7. **Batch item insertion** (QUOT-007) — use multi-row INSERT
8. **VAT/discount implementation** (QUOT-005) — proper tax calculations

### Long-term

9. **Quotation approval workflow** — multi-step approval with notifications
10. **Quotation templates** — save and reuse common quotations
11. **Quotation revisions** — version history with comparison
12. **Bulk PDF generation** — generate and download multiple PDFs
13. **Quotation expiry notifications** — alert when quotations are about to expire

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| March 2026 | — | Added server-side search (quotation_number, company_name, remarks) |
| March 2026 | — | Added server-side sorting with column mapping (5 sortable columns) |
| March 2026 | — | Added delete button with SweetAlert confirmation in list view |
| March 2026 | — | Added auto-generated sequential numbering (QUO-NNNNN format) |
| March 2026 | — | Added inline items array support on create and update |
| March 2026 | — | Fixed 0-based pagination (frontend sends page=0 for first page) |
| March 2026 | — | Fixed `convertToInvoice` route mismatch (QUOT-001) |
| March 2026 | — | Data reimported: 110 quotations with 484 items from SQL dump |
| *(initial)* | — | Core CRUD with pagination and contact JOIN |
| *(initial)* | — | Line item management (add/delete) |
| *(initial)* | — | PDF generation via pdfGenerator utility |
| *(initial)* | — | Email sending via nodemailer SMTP |
| *(initial)* | — | Convert-to-invoice with transactional safety |
| *(initial)* | — | Frontend detail view with status badges and email modal | |

---

## Dependencies on Other Modules

| Module | Dependency Type | Description |
|--------|----------------|-------------|
| **Contacts** | Data (FK) | `quotations.contact_id → contacts.id` |
| **Invoices** | Target | Conversion creates invoices and invoice_items |
| **Authentication** | Auth | JWT `requireAuth` middleware on all routes |
| **Settings** | Config | Company settings for PDF generation, SMTP config |

## Modules That Depend on Quotations

| Module | Usage |
|--------|-------|
| **Contacts** | Contact detail page shows linked quotations |
| **Invoices** | Invoice may reference originating `quotation_id` |
| **Dashboard** | Quotation counts/values may appear in stats |
