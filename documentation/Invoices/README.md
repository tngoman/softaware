# Invoices Module

## Overview
The Invoices module provides full invoice lifecycle management: creation, editing, payment tracking, PDF generation, and email delivery. Invoices link to contacts (customers) and can be generated from quotations. The module includes line-item management, multi-payment recording with auto-paid detection, and configurable payment status tracking.

**Current Data**: 46 invoices with 191 line items and 52 associated payments (as of March 2026)

## Key Responsibilities
- CRUD operations on invoices with soft delete
- Search across invoice number, customer name, and remarks
- Sequential auto-numbering (INV-NNNNN format) with uniqueness enforcement
- Inline line-item creation/replacement on invoice create/update
- Line-item (invoice_items) management — add/remove items per invoice
- Payment recording with automatic paid-status detection when total payments ≥ invoice amount
- PDF generation via `pdfGenerator` utility with company settings branding
- Email delivery of invoices via SMTP (nodemailer)
- Mark-as-paid manual override
- Payment processing into accounting transactions

## Architecture

### Backend
- **Router**: `src/routes/invoices.ts` (622 LOC) — 12 route handlers mounted at `/v1/invoices`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; no dedicated service layer
- **Validation**: Zod schemas for invoice creation, item creation, payment creation
- **PDF**: `pdfGenerator.ts` utility with `loadCompanySettings()` for branded output

### Frontend
- **Page**: `src/pages/finance/Invoices.tsx` (826 LOC) — list view + detail view with search in single component
- **Components**: `InvoiceDetails.tsx` (69 LOC), `PaymentStatusBadge.tsx` (27 LOC)
- **Model**: `src/models/InvoiceModel.ts` (88 LOC) — static API wrapper
- **State**: Zustand store (`invoices`, `setInvoices`) + local component state

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Request validation |
| `nodemailer` | Email delivery |
| `pdfGenerator` | PDF invoice generation |
| `Contacts` module | Contact lookup for invoice recipient |
| `Payments` module | Payment recording and processing |
| `TanStack React Table` | Invoice list DataTable |
| `SweetAlert2` | User feedback dialogs |
| `react-router-dom` | URL-based invoice detail routing |

## Database Tables

| Table | Purpose |
|-------|---------|
| `invoices` | Invoice header records |
| `invoice_items` | Line items per invoice |
| `payments` | Payment records linked to invoices |
| `contacts` | Customer/supplier linked via `contact_id` |
| `company_settings` | Company branding for PDF generation |

## Payment Status Values

| Value | Label | Badge Color |
|-------|-------|-------------|
| `0` | Unpaid | Red |
| `1` | Partial | Yellow |
| `2` | Paid | Green |

## Key Data Flows

### Invoice Creation
```
Frontend form → POST /invoices (Zod validated)
  → Verify contact exists
  → Auto-generate INV-NNNNN number if not provided
  → Check invoice_number uniqueness (append timestamp if duplicate)
  → INSERT into invoices
  → If items provided → INSERT each into invoice_items
  → Return created invoice with contact JOIN
```

### Payment Recording
```
Frontend PaymentModal → POST /invoices/:id/payments
  → Validate payment data (Zod)
  → INSERT into payments
  → SUM all payments for invoice
  → If total ≥ invoice_amount → UPDATE paid = 1
  → Return payment record
```

### PDF Generation
```
POST /invoices/:id/generate-pdf
  → Load invoice + items + company settings
  → Build PDFDocData object
  → generatePdf() → writes file to disk
  → Return { filename, webPath }
  → Frontend opens PDF in new tab
```
