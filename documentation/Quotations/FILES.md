# Quotations — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/quotations.ts` (592 LOC)
**Purpose**: All quotation route handlers — CRUD, items, PDF, email, convert-to-invoice  
**Mount**: `/v1/quotations` via `quotationsRouter`

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports & setup | 1–8 | Express, Zod, db, auth, httpErrors, pdfGenerator |
| `createQuotationSchema` | 10–42 | Zod schema with inline items array support |
| `createQuoteItemSchema` | 44–49 | Zod schema for line item creation |
| `updateQuotationSchema` | 51 | Partial of create schema |
| `QUOTATION_SELECT` | 53–75 | SQL column alias fragment (19 aliased columns incl. contact) |
| `GET /` | 77–135 | List quotations with search, sort, and pagination |
| `GET /:id` | 137–170 | Get quotation with items |
| `POST /` | 172–260 | Create quotation with auto-numbering (QUO-NNNNN), inline items |
| `PUT /:id` | 262–325 | Update quotation with item replacement |
| `DELETE /:id` | 327–345 | Soft delete (active = 0) |
| `POST /:id/items` | 347–375 | Add line item to quotation |
| `DELETE /:id/items/:itemId` | 377–395 | Delete quote item (hard delete) |
| `POST /:id/generate-pdf` | 397–460 | Generate branded PDF quotation |
| `POST /:id/send-email` | 462–510 | Send quotation via SMTP |
| `POST /:id/convert-to-invoice` | 512–592 | Convert quotation to invoice (transactional) |

### `/var/opt/backend/src/db/businessTypes.ts` (lines 47–71)
**Purpose**: TypeScript interfaces for backend DB types

| Interface | Description |
|-----------|-------------|
| `Quotation` | DB row type for quotations table |
| `QuoteItem` | DB row type for quote_items table |

---

## Frontend Files

### `/var/opt/frontend/src/models/QuotationModel.ts` (88 LOC)
**Purpose**: Static API wrapper for quotation operations

| Method | HTTP | Endpoint |
|--------|------|----------|
| `getAll(params?)` | GET | `/quotations` |
| `getById(id)` | GET | `/quotations/:id` |
| `create(quotation)` | POST | `/quotations` |
| `update(id, quotation)` | PUT | `/quotations/:id` |
| `delete(id)` | DELETE | `/quotations/:id` |
| `convertToInvoice(quoteId)` | POST | `/convert-quote` ⚠️ |
| `generatePDF(id)` | POST | `/quotations/:id/generate-pdf` |
| `sendEmail(id, data)` | POST | `/quotations/:id/send-email` |
| `getItems(quoteId)` | GET | `/quote-items` ⚠️ |
| `updateItems(quoteId, items)` | POST | `/quote-items` ⚠️ |

> ⚠️ `convertToInvoice` calls `/convert-quote` but backend route is `/quotations/:id/convert-to-invoice`  
> ⚠️ `getItems` and `updateItems` call `/quote-items` which may be a separate route

---

### `/var/opt/frontend/src/pages/finance/Quotations.tsx` (715 LOC)
**Purpose**: Combined list/detail page for quotations with search, sort, and delete

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–14 | React, router, icons, models, store, types, Swal |
| State declarations | 15–30 | selectedQuote, loading, modals, pagination, search, sort |
| Column definitions | 32–110 | TanStack DataTable column config (7 columns + actions with delete) |
| `useEffect` hooks | 112–155 | Load quotations, handle route ID changes, search/sort triggers |
| `loadQuotations` | 157–195 | Paginated quotation fetch with search and sort params |
| `loadCustomers` | 197–205 | Load customers for dropdown |
| `viewQuotation` | 207 | Navigate to detail URL |
| `deleteQuotation` | 209–240 | SweetAlert confirmation → soft delete API call |
| `convertToInvoice` | 242–275 | SweetAlert confirmation → convert API → navigate to invoice |
| `generatePDF` | 277–310 | Trigger PDF and open in new tab |
| `handleSendEmail` | 312–340 | Send email via modal |
| Detail view JSX | 345–580 | Quote header, customer info, items table, totals |
| List view JSX | 582–715 | Header with stats, search input, sort controls, DataTable |

---

### `/var/opt/frontend/src/components/Quotations/QuotationStatusBadge.tsx` (38 LOC)
**Purpose**: Status badge component with icons and color coding

| Status Value | Label | Colors |
|-------------|-------|--------|
| `0` (default) | Draft | `bg-gray-50 text-gray-700 border-gray-200` |
| `1` | Sent | `bg-blue-50 text-blue-700 border-blue-200` |
| `2` | Accepted | `bg-green-50 text-green-700 border-green-200` |

---

### `/var/opt/frontend/src/components/Quotations/index.ts` (1 LOC)
**Purpose**: Barrel export for `QuotationStatusBadge`

---

### `/var/opt/frontend/src/types/index.ts` (lines 172–205)
**Purpose**: Frontend TypeScript interfaces

| Interface | Fields |
|-----------|--------|
| `QuoteItem` | item_id, item_quote_id, item_product, item_qty, item_price, item_subtotal, item_profit, item_cost, item_discount, item_vat |
| `Quotation` | quotation_id, quotation_contact_id, quotation_date, quotation_valid_until, quotation_subtotal, quotation_vat, quotation_total, quotation_discount, quotation_notes, quotation_status, etc. |

---

## File Relationship Map

```
quotations.ts (backend router)
  ├── POST / ────────────────────→ quotations table
  │     ├── validates contact_id → contacts table
  │     └── checks quotation_number uniqueness
  ├── POST /:id/items ───────────→ quote_items table
  ├── POST /:id/generate-pdf ────→ pdfGenerator utility → file system
  ├── POST /:id/send-email ──────→ nodemailer SMTP
  └── POST /:id/convert-to-invoice → TRANSACTION
        ├── INSERT → invoices table
        └── INSERT (loop) → invoice_items table

QuotationModel.ts (frontend model)
  └── all methods → axios → quotations.ts routes

Quotations.tsx (frontend page)
  ├── uses QuotationModel for data
  ├── uses ContactModel for customer dropdown
  ├── renders QuotationStatusBadge component
  ├── renders EmailModal component
  └── renders DataTable component
```

## Total Lines of Code

| File | LOC |
|------|----:|
| `quotations.ts` | 457 |
| `businessTypes.ts` (excerpt) | 25 |
| `QuotationModel.ts` | 88 |
| `Quotations.tsx` | 638 |
| `QuotationStatusBadge.tsx` | 38 |
| `index.ts` | 1 |
| `types/index.ts` (excerpt) | 34 |
| **Total** | **~1,281** |
