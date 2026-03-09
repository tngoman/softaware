# Invoices — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/invoices.ts` (622 LOC)
**Purpose**: All invoice route handlers — CRUD, items, payments, PDF, email  
**Mount**: `/v1/invoices` via `invoicesRouter`

| Section | Lines | Description |
|---------|-------|-------------|
| Imports & setup | 1–8 | Express, Zod, db, auth, httpErrors, pdfGenerator |
| `createInvoiceSchema` | 10–46 | Zod schema with inline items array support |
| `createInvoiceItemSchema` | 48–53 | Zod schema for line item creation |
| `createPaymentSchema` | 55–61 | Zod schema for payment creation |
| `updateInvoiceSchema` | 63 | Partial of create schema |
| `INVOICE_SELECT` | 65–88 | SQL column alias fragment (19 aliased columns incl. contact) |
| `GET /` | 90–140 | List invoices with search, pagination, and paid-filter |
| `GET /:id` | 142–190 | Get invoice with items and payments |
| `POST /` | 192–290 | Create invoice with auto-numbering (INV-NNNNN), inline items |
| `PUT /:id` | 292–360 | Update invoice with item replacement |
| `DELETE /:id` | 362–380 | Soft delete (active = 0) |
| `POST /:id/items` | 382–410 | Add line item to invoice |
| `DELETE /:id/items/:itemId` | 412–432 | Delete invoice item (hard delete) |
| `POST /:id/payments` | 434–475 | Record payment; auto-detect paid status |
| `GET /:id/payments` | 477–498 | List payments for invoice |
| `POST /:id/generate-pdf` | 500–555 | Generate branded PDF invoice |
| `POST /:id/send-email` | 557–595 | Send invoice via SMTP |
| `POST /:id/mark-paid` | 597–622 | Manually set paid = 1 |

---

## Frontend Files

### `/var/opt/frontend/src/models/InvoiceModel.ts` (88 LOC)
**Purpose**: Static API wrapper for invoice operations

| Method | HTTP | Endpoint |
|--------|------|----------|
| `getAll(params?)` | GET | `/invoices` |
| `getById(id)` | GET | `/invoices/:id` |
| `create(invoice)` | POST | `/invoices` |
| `update(id, invoice)` | PUT | `/invoices/:id` |
| `delete(id)` | DELETE | `/invoices/:id` |
| `markAsPaid(id)` | POST | `/invoices/:id/mark-paid` |
| `generatePDF(id)` | POST | `/invoices/:id/generate-pdf` |
| `sendEmail(id, data)` | POST | `/invoices/:id/send-email` |
| `getItems(invoiceId)` | GET | `/invoice-items?invoice_id=` |
| `updateItems(invoiceId, items)` | POST | `/invoice-items` |

---

### `/var/opt/frontend/src/pages/finance/Invoices.tsx` (826 LOC)
**Purpose**: Combined list/detail page for invoices with search

| Section | Lines (approx) | Description |
|---------|----------------|-------------|
| Imports | 1–15 | React, router, icons, models, store, types |
| State declarations | 16–25 | selectedInvoice, loading, modals, payments, pagination |
| Column definitions | 27–65 | TanStack DataTable column config (7 columns) |
| `useEffect` hooks | 67–100 | Load invoices, handle route ID changes |
| `loadPayments` | ~100 | Fetch payments for selected invoice |
| `loadInvoices` | ~105–130 | Paginated invoice fetch |
| `loadCustomers` | ~132–140 | Load customers for form dropdown |
| `viewInvoice` | ~142 | Navigate to detail URL |
| `markAsPaid` | ~144–160 | Mark invoice as paid via API |
| `handleSendEmail` | ~162–190 | Send invoice email via modal |
| `handleAddPayment` | ~192–230 | Record payment via modal |
| `handleProcessPayment` | ~232–260 | Process individual payment into transactions |
| `handleProcessPendingPayments` | ~262–300 | Bulk process pending payments |
| `generatePDF` | ~302–325 | Trigger PDF generation and open in new tab |
| Detail view JSX | ~330–450 | Invoice header, customer info, actions, items, payments |
| List view JSX | ~452–509 | DataTable with search and Create button |

---

### `/var/opt/frontend/src/components/Invoices/InvoiceDetails.tsx` (69 LOC)
**Purpose**: Reusable invoice detail card with customer info and status badge

| Section | Lines | Description |
|---------|-------|-------------|
| Props interface | 1–8 | Accepts `Invoice` object |
| Customer info | 10–35 | Name, phone, email, parsed notes |
| Payment status | 37–50 | Badge + payment date |
| Invoice metadata | 52–69 | Number, date, due date grid |

---

### `/var/opt/frontend/src/components/Invoices/PaymentStatusBadge.tsx` (27 LOC)
**Purpose**: Status badge component with color-coded display

| Status Value | Label | Colors |
|-------------|-------|--------|
| `0` (default) | Unpaid | `bg-red-100 text-red-800` |
| `1` | Partial | `bg-yellow-100 text-yellow-800` |
| `2` | Paid | `bg-green-100 text-green-800` |

---

### `/var/opt/frontend/src/components/Invoices/index.ts` (3 LOC)
**Purpose**: Barrel export for `PaymentStatusBadge` and `InvoiceDetails`

---

## File Relationship Map

```
invoices.ts (backend router)
  ├── POST / ──────────────────→ invoices table
  │     ├── validates contact_id → contacts table
  │     └── checks invoice_number uniqueness
  ├── POST /:id/items ─────────→ invoice_items table
  ├── POST /:id/payments ──────→ payments table
  │     └── auto-updates invoices.paid when fully paid
  ├── POST /:id/generate-pdf ──→ pdfGenerator utility → file system
  └── POST /:id/send-email ────→ nodemailer SMTP

InvoiceModel.ts (frontend model)
  └── all methods → axios → invoices.ts routes

Invoices.tsx (frontend page)
  ├── uses InvoiceModel for data
  ├── uses ContactModel for customer dropdown
  ├── uses PaymentModel for payment operations
  ├── renders InvoiceDetails component
  ├── renders PaymentStatusBadge component
  ├── renders EmailModal component
  └── renders PaymentModal component
```

## Total Lines of Code

| File | LOC |
|------|----:|
| `invoices.ts` | 622 |
| `InvoiceModel.ts` | 88 |
| `Invoices.tsx` | 826 |
| `InvoiceDetails.tsx` | 69 |
| `PaymentStatusBadge.tsx` | 27 |
| `index.ts` | 3 |
| **Total** | **1,635** |
