# Business API Quick Reference

## Base URL
- **Dev**: `http://localhost:8787`
- **Prod**: `https://api.softaware.net.za`

## Authentication
```
Authorization: Bearer <jwt_token>
```

## Endpoints at a Glance

### Contacts (`/contacts`)
```
GET    /contacts                    # List with ?search, ?page, ?limit
GET    /contacts/:id               # Get single
POST   /contacts                   # Create { company_name (req), email, phone, ... }
PUT    /contacts/:id               # Update (partial)
DELETE /contacts/:id               # Soft delete

GET    /contacts/:id/quotations    # Get related quotations
GET    /contacts/:id/invoices      # Get related invoices
```

### Quotations (`/quotations`)
```
GET    /quotations                        # List with ?page, ?limit
GET    /quotations/:id                   # Get with items
POST   /quotations                       # Create
PUT    /quotations/:id                   # Update (partial)
DELETE /quotations/:id                   # Soft delete

POST   /quotations/:id/items             # Add line item
DELETE /quotations/:id/items/:itemId     # Remove line item
POST   /quotations/:id/convert-to-invoice # Convert to invoice ★
```

### Invoices (`/invoices`)
```
GET    /invoices                   # List with ?page, ?limit, ?paid=0|1
GET    /invoices/:id               # Get with items & payments
POST   /invoices                   # Create
PUT    /invoices/:id               # Update (partial)
DELETE /invoices/:id               # Soft delete

POST   /invoices/:id/items         # Add line item
DELETE /invoices/:id/items/:itemId # Remove line item
POST   /invoices/:id/payments      # Record payment (auto-mark-paid) ★
GET    /invoices/:id/payments      # Get payment history
```

### Accounting (`/accounting`)

**Accounts**
```
GET    /accounting/accounts              # List with ?type=asset|liability|equity|income|expense
GET    /accounting/accounts/:id          # Get single
POST   /accounting/accounts              # Create
PUT    /accounting/accounts/:id          # Update
GET    /accounting/accounts/:id/balance  # Get current balance ★
```

**Transactions**
```
GET    /accounting/transactions          # List with ?account_id, ?page, ?limit
POST   /accounting/transactions          # Create debit/credit entry
```

**Ledger**
```
GET    /accounting/ledger                # List with ?account_id, ?page, ?limit
```

**Tax Rates**
```
GET    /accounting/tax-rates             # List
POST   /accounting/tax-rates             # Create
PUT    /accounting/tax-rates/:id         # Update
```

---

## Common Examples

### Create Contact
```bash
curl -X POST http://localhost:8787/contacts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "ACME Corp",
    "contact_person": "John Doe",
    "email": "john@acme.com",
    "phone": "+27 11 123 4567",
    "location": "Johannesburg"
  }'
```

### Create Quotation
```bash
curl -X POST http://localhost:8787/quotations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quotation_number": "QT-2026-001",
    "contact_id": 1,
    "quotation_amount": 5000.00,
    "quotation_date": "2026-02-28"
  }'
```

### Add Line Item to Quotation
```bash
curl -X POST http://localhost:8787/quotations/1/items \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_description": "Professional Services",
    "item_price": 1000.00,
    "item_quantity": 5,
    "item_discount": 0.00
  }'
```

### Convert Quotation to Invoice
```bash
curl -X POST http://localhost:8787/quotations/1/convert-to-invoice \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_number": "INV-2026-001",
    "invoice_date": "2026-02-28",
    "due_date": "2026-03-31"
  }'
```

### Record Payment
```bash
curl -X POST http://localhost:8787/invoices/1/payments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_date": "2026-02-28",
    "payment_amount": 2500.00,
    "payment_method": "Bank Transfer",
    "reference_number": "TXN123456"
  }'
```

### List Unpaid Invoices
```bash
curl -X GET "http://localhost:8787/invoices?paid=0&page=1&limit=50" \
  -H "Authorization: Bearer TOKEN"
```

### Create Account
```bash
curl -X POST http://localhost:8787/accounting/accounts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account_code": "1000",
    "account_name": "Cash at Bank",
    "account_type": "asset"
  }'
```

### Record Transaction
```bash
curl -X POST http://localhost:8787/accounting/transactions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_date": "2026-02-28",
    "account_id": 1,
    "debit_amount": 1000.00,
    "credit_amount": 0.00,
    "description": "Cash deposit",
    "reference_number": "DEP123"
  }'
```

---

## Response Format

### Success (200/201)
```json
{
  "success": true,
  "data": { ... }
}
```

### Error (4xx/5xx)
```json
{
  "error": "ERROR_CODE",
  "message": "Description of what went wrong"
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK (GET, PUT) |
| 201 | Created (POST) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## Data Types

- **Currency**: DECIMAL(15,4) - e.g., `5000.00`
- **Discounts**: DECIMAL(10,4) - e.g., `100.50`
- **Dates**: YYYY-MM-DD - e.g., `2026-02-28`
- **IDs**: Integer - e.g., `1`
- **Booleans**: 0/1 - e.g., `1` for active, `0` for deleted

---

## Special Features ★

**Quote → Invoice Conversion**: Automatically copies all line items
```
POST /quotations/:id/convert-to-invoice
```

**Auto-mark Invoice as Paid**: When total payments >= invoice_amount
```
POST /invoices/:id/payments
```

**Get Account Balance**: Returns current balance from ledger
```
GET /accounting/accounts/:id/balance
```

---

## Pagination

Endpoints support optional pagination:
```
?page=1      # Page number (default: 1)
&limit=50    # Results per page (default: 50)
```

---

## Filtering

**Contacts**: `?search=company_name_or_person`

**Invoices**: `?paid=0` (unpaid) or `?paid=1` (paid)

**Accounts**: `?type=asset|liability|equity|income|expense`

**Transactions**: `?account_id=1` to filter by account

---

## Implementation Details

- **Soft Deletes**: Records marked `active=0`, not physically deleted
- **Timestamps**: Auto-managed `created_at` and `updated_at`
- **Line Totals**: Auto-calculated as `(price × qty) - discount`
- **Foreign Keys**: All validated before operations
- **Transactions**: Multi-table operations use database transactions

---

**Full Docs**: See [BACKEND_API_SPEC.md](backend/BACKEND_API_SPEC.md) for complete specifications.
