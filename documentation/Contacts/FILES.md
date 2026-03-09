# Contacts — File Inventory

## Backend Files

### `/var/opt/backend/src/routes/contacts.ts` (240 LOC)
**Purpose**: Authenticated CRUD for contacts plus per-contact invoice and quotation listing.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–6 | Express Router, Zod, `db`, `requireAuth`, `httpErrors`, `Contact` type |
| `createContactSchema` | 8–19 | Zod: `company_name` (required), `contact_person?`, `email?`, `phone?`, `fax?`, `website?`, `location?`, `contact_code?`, `remarks?`, `active` (default 1) |
| `updateContactSchema` | 21 | `createContactSchema.partial()` |
| `CONTACT_SELECT` | 23–35 | SQL alias fragment: maps DB columns → frontend interface names. Also adds hardcoded `contact_type = 1`. |
| `GET /contacts` | 37–72 | List contacts with pagination (`page`, `limit`, `search`). Filters `active = 1`. Searches `company_name`, `contact_person`, `email`. Returns `{ data, pagination }`. |
| `GET /contacts/:id` | 74–88 | Single contact by ID. Returns 404 if not found. |
| `POST /contacts` | 90–112 | Create contact. Zod-validates, uses `db.insertOne()`, returns created record. |
| `PUT /contacts/:id` | 114–140 | Update contact. Partial validation, checks existence, updates with timestamp. |
| `DELETE /contacts/:id` | 142–164 | Soft delete: sets `active = 0`, updates timestamp. |
| `GET /contacts/:id/quotations` | 166–196 | All quotations for contact. Joins `quotations` + `contacts`. Calculates `valid_until` as `quotation_date + 30 days`. |
| `GET /contacts/:id/invoices` | 198–240 | All invoices for contact. Joins `invoices` + `contacts`. Returns payment status and related fields. |

---

### `/var/opt/backend/src/routes/contactFormRouter.ts` (215 LOC)
**Purpose**: Public (no auth) endpoint for website contact form submissions with rate limiting and email forwarding.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–4 | Express, `db`, `env`, `nodemailer` |
| Rate limit setup | 6–30 | In-memory `Map<IP, timestamps[]>`. 5 requests/minute per IP. Cleanup every 5 minutes. |
| `POST /v1/leads/submit` | 32–185 | Full contact form handler: rate limit check → honeypot bot detection → field validation → email regex validation → site owner lookup (`generated_sites` → `widget_clients` → `users`) → nodemailer SMTP send → success response. |
| `GET /v1/leads/test` | 187–215 | Health check endpoint returning rate limit config. |

**Key patterns**:
- Honeypot field: if `honeypot` is filled, silently returns success (drops spam)
- Owner lookup cascade: `generated_sites.contact_email` → `users.email` via `user_id` → `widget_clients.user_id` → `users.email`
- SMTP config from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- HTML + plain text email with reply-to set to submitter's email

---

## Frontend Files

### `/var/opt/frontend/src/pages/Contacts.tsx` (510 LOC)
**Purpose**: Main contacts page with customer/supplier tabs, search, DataTable, and inline CRUD form.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–12 | React, Router, Heroicons, TanStack Table, models, store, types, UI components, Can |
| State | 14–35 | `activeTab` (customers/suppliers), `showForm`, `editingContact`, `loading`, `pagination`, `search`, `formData` |
| URL edit handling | 37–55 | Reads `?edit=` query param or `:id` route param to pre-populate edit form |
| `loadContacts()` | 57–85 | Calls `ContactModel.getAll(activeTab, params)`. Stores in Zustand (`setCustomers`/`setSuppliers`). |
| `handleSubmit()` | 95–120 | Create or update via `ContactModel`. Shows SweetAlert success/error. |
| `handleDelete()` | 130–145 | `window.confirm()` → `ContactModel.delete()`. |
| Table columns | 147–235 | TanStack column defs: Name (with icon), Email (mailto), Phone (tel), VAT, Actions (View/Edit/Delete with `<Can>` gates) |
| Form view | 237–370 | 3-column grid form: Name, Contact Person, Type (select), Email, Phone, Alt Phone, VAT, Address (textarea), Notes (textarea). Cancel/Submit buttons. |
| List view | 372–510 | Gradient header with search + "Add New" button, customer/supplier tabs with counts, `<DataTable>` with server-side pagination. Wrapped in `<Can permission="contacts.view">`. |

---

### `/var/opt/frontend/src/pages/ContactDetails.tsx` (629 LOC)
**Purpose**: Rich contact detail page with financial overview, invoices, quotations, and account statement.

| Section | Lines | Description |
|---------|-------|-------------|
| Imports | 1–25 | React, Router, Heroicons, models (Contact, Invoice, Quotation), UI components, formatters, `API_BASE_URL` |
| Interfaces | 27–50 | `Transaction` (invoice/payment row), `StatementData` (transactions + closing balance + aging) |
| State | 52–60 | `contact`, `statementData`, `invoices`, `quotations`, `loading`, `activeTab` (overview/invoices/quotations/statement) |
| Data loading | 62–105 | `loadContactData()` → loads contact, then if customer: loads invoices (client-side filtered from all), quotations (client-side filtered), and statement data. |
| `downloadStatement()` | 107–135 | Calls `ContactModel.downloadStatement()`, opens PDF URL in new tab. |
| `calculateTotals()` | 137–155 | Derives totalInvoiced, totalOutstanding, totalPaid from invoices array. |
| Table columns | 157–225 | Invoice columns (id, date, due date, amount, status, view) + Quotation columns (id, date, valid until, amount, status, view). |
| Header | 227–310 | Gradient banner with contact name, type badge, contact person, email/phone/vat/address grid, edit button. |
| Tab navigation | 312–365 | Overview, Invoices, Quotations, Statement tabs (customers only). |
| Overview tab | 367–450 | Financial summary card (invoiced/outstanding/paid/counts) + recent invoices (last 5). |
| Invoices tab | 452–465 | DataTable with invoice columns. |
| Quotations tab | 467–480 | DataTable with quotation columns. |
| Statement tab | 482–600 | Transaction table (date/description/debit/credit/balance) with closing balance footer. Download PDF button. Aging data available but displayed in statement context. |
| Supplier placeholder | 602–629 | Empty state for supplier-type contacts. |

---

### `/var/opt/frontend/src/models/ContactModel.ts` (79 LOC)
**Purpose**: Static API wrapper class for contact endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getAll(type?, params?)` | `GET /contacts` | List contacts with pagination. `type` param filters customer/supplier. |
| `getById(id)` | `GET /contacts/:id` | Single contact. |
| `create(contact)` | `POST /contacts` | Create contact. |
| `update(id, contact)` | `PUT /contacts/:id` | Update contact. |
| `delete(id)` | `DELETE /contacts/:id` | Soft delete contact. |
| `getStatementData(id)` | `GET /contacts/:id/statement-data` | Statement transactions + aging. |
| `downloadStatement(id)` | `GET /contacts/:id/statement` | Generate and return PDF path. |

**Exports**: `ContactModel` class.
