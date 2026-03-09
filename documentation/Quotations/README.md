# Quotations Module

## Overview
The Quotations module provides full quotation lifecycle management: creation, editing, line-item management, PDF generation, email delivery, and conversion to invoices. Quotations link to contacts (customers) and serve as the pre-invoice stage of the billing pipeline. A quotation can be "accepted" and converted into an invoice with all line items automatically copied.

**Current Data**: 110 quotations with 484 line items (as of March 2026)

## Key Responsibilities
- CRUD operations on quotations with soft delete
- Search across quotation number, customer name, and remarks
- Server-side sorting by ID, date, customer name, total, or status
- Sequential auto-numbering (QUO-NNNNN format) with uniqueness enforcement
- Inline line-item creation/replacement on quotation create/update
- Line-item (quote_items) management — add/remove items per quotation
- PDF generation via `pdfGenerator` utility with company branding
- Email delivery of quotations via SMTP (nodemailer)
- Quotation-to-invoice conversion with line-item duplication (transactional)
- Quotation status tracking: Draft → Sent → Accepted

## Architecture

### Backend
- **Router**: `src/routes/quotations.ts` (592 LOC) — 10 route handlers mounted at `/v1/quotations`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; no dedicated service layer
- **Validation**: Zod schemas for quotation creation, item creation
- **PDF**: `pdfGenerator.ts` utility with `loadCompanySettings()` for branded output
- **Transaction**: Convert-to-invoice uses explicit `START TRANSACTION` / `COMMIT` / `ROLLBACK`

### Frontend
- **Page**: `src/pages/finance/Quotations.tsx` (715 LOC) — combined list + detail view with search, sort, and delete
- **Components**: `QuotationStatusBadge.tsx` (38 LOC) — status badge with icons
- **Model**: `src/models/QuotationModel.ts` (88 LOC) — static API wrapper
- **State**: Zustand store (`quotations`, `setQuotations`) + local component state

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Request validation |
| `nodemailer` | Email delivery |
| `pdfGenerator` | PDF quotation generation |
| `Contacts` module | Contact lookup for quotation recipient |
| `Invoices` module | Target for quotation-to-invoice conversion |
| `TanStack React Table` | Quotation list DataTable |
| `SweetAlert2` | User feedback dialogs |
| `react-router-dom` | URL-based quotation detail routing |

## Database Tables

| Table | Purpose |
|-------|---------|
| `quotations` | Quotation header records |
| `quote_items` | Line items per quotation |
| `contacts` | Customer linked via `contact_id` |
| `invoices` | Target table for conversion |
| `invoice_items` | Target for copied line items |
| `company_settings` | Company branding for PDF generation |

## Quotation Status Values

| Value | Label | Badge Color | Description |
|-------|-------|-------------|-------------|
| `0` | Draft | Gray | Initial state |
| `1` | Sent | Blue | Sent to customer |
| `2` | Accepted | Green | Customer accepted, can convert to invoice |

## Key Data Flows

### Quotation Creation
```
Frontend form → POST /quotations (Zod validated)
  → Verify contact exists
  → Auto-generate QUO-NNNNN number if not provided
  → Check quotation_number uniqueness (append timestamp if duplicate)
  → INSERT into quotations
  → If items provided → INSERT each into quote_items
  → Return created quotation with contact JOIN
```

### Convert to Invoice (Transaction)
```
POST /quotations/:id/convert-to-invoice
  → START TRANSACTION
  → Load quotation + quote_items
  → INSERT into invoices (copy header data)
  → For each quote_item → INSERT into invoice_items
  → COMMIT
  → Return created invoice
```

### PDF Generation
```
POST /quotations/:id/generate-pdf
  → Load quotation + items + company settings
  → Build PDFDocData object with type='quotation'
  → generatePdf() → writes file to disk
  → Return { filename, webPath }
  → Frontend opens PDF in new tab
```

## Valid Until Calculation
The `quotation_valid_until` field is computed dynamically:
```sql
DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until
```
There is no stored `valid_until` column — it is always 30 days after the quotation date.
