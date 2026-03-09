# Contacts Module

## Purpose
Manages the customer and supplier address book — the core CRM entity that connects to invoices, quotations, payments, and statements. Also includes a public contact form router for website lead capture with email forwarding.

## Module Scope
- **Contact CRUD**: Create, read, update, soft-delete contacts. Contacts are classified as customers (type 1) or suppliers (type 2).
- **Contact Details**: Rich detail view with tabbed interface — overview (financial summary), invoices, quotations, and account statement with aging analysis and PDF download.
- **Related Records**: Per-contact invoice and quotation listings via dedicated sub-routes.
- **Contact Form / Leads**: Public endpoint for website contact form submissions — validates, rate-limits, looks up site owner, and emails the submission via SMTP.

## Key Files (summary)

| Layer | File | LOC | Role |
|-------|------|-----|------|
| Backend Route | `src/routes/contacts.ts` | 240 | Contact CRUD + per-contact invoices/quotations |
| Backend Route | `src/routes/contactFormRouter.ts` | 215 | Public contact form submission + email |
| Frontend Page | `pages/Contacts.tsx` | 510 | Contact list with tabs, search, CRUD form |
| Frontend Page | `pages/ContactDetails.tsx` | 629 | Contact detail with invoices/quotations/statement |
| Frontend Model | `models/ContactModel.ts` | 79 | API wrapper for contact endpoints |

**Total**: 5 files, ~1,673 LOC

## Dependencies
- **Backend**: Express Router, Zod validation, `requireAuth` middleware, `db`, `httpErrors` (badRequest/notFound), `nodemailer`, `businessTypes.ts` (Contact type)
- **Frontend**: React 18, React Router DOM 6, TanStack React Table, Zustand store (`customers`/`suppliers`), Heroicons, SweetAlert2, UI component library (Input, Select, Textarea, Button, Card, DataTable, BackButton), Can (permissions), formatters utility
- **Frontend Models**: `ContactModel`, `InvoiceModel`, `QuotationModel`
- **Frontend Components**: `PaymentStatusBadge`, `QuotationStatusBadge`

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `contacts` | Customer/supplier master data | `id`, `company_name`, `contact_person`, `email`, `phone`, `fax`, `website`, `location`, `contact_code`, `remarks`, `active` |
| `invoices` | Related invoices (via `contact_id`) | Read for contact detail + statement |
| `quotations` | Related quotations (via `contact_id`) | Read for contact detail |
| `payments` | Related payments (via invoice) | Read for statement data |
| `generated_sites` | Site owner lookup for contact form | `contact_email`, `user_id` |
| `widget_clients` | Fallback owner lookup | `user_id` |
| `users` | Email lookup for site owners | `email` |

## Architecture Notes
1. **Column aliasing**: Backend uses a `CONTACT_SELECT` SQL fragment that aliases DB columns to frontend-expected names (e.g., `company_name → contact_name`, `location → contact_address`, `fax → contact_alt_phone`).
2. **Soft delete only**: Contacts are never hard-deleted — `active` is set to 0. List queries filter `WHERE active = 1`.
3. **Customer/Supplier split**: Frontend uses a tab-based UI with Zustand store separating `customers` and `suppliers`. Backend returns all contacts; `contact_type` (1=customer, 2=supplier) differentiates them.
4. **Contact form is public**: `contactFormRouter.ts` has no auth middleware — it's designed for website visitors. Has in-memory rate limiting (5 req/min/IP) and honeypot bot detection.
5. **Statement feature**: Contact detail page includes an account statement tab with debit/credit transaction history, closing balance, and aging analysis. Statement can be downloaded as PDF.
6. **Permission gating**: Frontend wraps the contacts list in `<Can permission="contacts.view">` with per-action permissions for create, edit, and delete.
