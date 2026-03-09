# Contacts — Route & API Reference

## Route Registration

**Backend mount point**: `/v1/contacts` (authenticated) and `/v1/leads` (public)

```
src/routes/contacts.ts       → router mounted at /v1/contacts (authMiddleware)
src/routes/contactFormRouter.ts → router mounted at /v1/leads (NO auth)
```

---

## Authenticated Routes (contacts.ts)

All routes require valid JWT via `authMiddleware`.

### 1. GET `/v1/contacts`
**Purpose**: List contacts with pagination and search  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.view`; backend has no check  
**Query params**: `page` (default 1), `limit` (default 50), `search` (partial match)

**Flow**:
1. Extract `page`, `limit`, `search` from `req.query`
2. Build `COUNT(*)` query; if `search`, apply `LIKE` on `company_name`, `contact_person`, `email`
3. Execute paginated `SELECT` using `CONTACT_SELECT` alias fragment, `WHERE active = 1`, `ORDER BY company_name ASC`
4. Return `{ success, data, pagination: { page, limit, total } }`

**SQL**:
```sql
SELECT {CONTACT_SELECT} FROM contacts
WHERE active = 1 [AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)]
ORDER BY company_name ASC
LIMIT ? OFFSET ?
```

---

### 2. GET `/v1/contacts/:id`
**Purpose**: Get single contact by ID  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. `SELECT {CONTACT_SELECT} FROM contacts WHERE id = ? AND active = 1`
2. If not found → `404 { success: false, message: 'Contact not found' }`
3. Return `{ success: true, data: contact }`

---

### 3. POST `/v1/contacts`
**Purpose**: Create a new contact  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.create`; backend has no check  
**Body**: Validated with `createContactSchema` (Zod)

**Flow**:
1. Validate `req.body` against `createContactSchema`
2. On validation failure → `400 { success: false, errors: zodErrors }`
3. `INSERT INTO contacts SET ?` with validated data
4. Fetch newly created contact using `insertId`
5. Return `201 { success: true, data: newContact }`

---

### 4. PUT `/v1/contacts/:id`
**Purpose**: Update an existing contact  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.edit`; backend has no check  
**Params**: `id` (route param)  
**Body**: Validated with `updateContactSchema` (partial)

**Flow**:
1. Validate `req.body` against `updateContactSchema`
2. On validation failure → `400`
3. `UPDATE contacts SET ? WHERE id = ?`
4. Fetch updated contact
5. Return `200 { success: true, data: updatedContact }`

---

### 5. DELETE `/v1/contacts/:id`
**Purpose**: Soft-delete a contact (set `active = 0`)  
**Auth**: JWT required  
**Permissions**: Frontend gates with `contacts.delete`; backend has no check  
**Params**: `id` (route param)

**Flow**:
1. `UPDATE contacts SET active = 0 WHERE id = ?`
2. Return `200 { success: true, message: 'Contact deleted' }`

---

### 6. GET `/v1/contacts/:id/quotations`
**Purpose**: List quotations linked to a contact  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. Query `quotations` table joined with `contacts`:
```sql
SELECT q.id AS quotation_id, q.contact_id AS quotation_contact_id,
       q.quotation_number, q.total AS quotation_total,
       q.date AS quotation_date, q.valid_until AS quotation_valid_until,
       q.notes AS quotation_notes, q.status AS quotation_status,
       c.company_name AS contact_name
FROM quotations q
LEFT JOIN contacts c ON q.contact_id = c.id
WHERE q.contact_id = ? AND q.active = 1
ORDER BY q.date DESC
```
2. Return `{ success: true, data: quotations }`

---

### 7. GET `/v1/contacts/:id/invoices`
**Purpose**: List invoices linked to a contact  
**Auth**: JWT required  
**Params**: `id` (route param)

**Flow**:
1. Query `invoices` table joined with `contacts`:
```sql
SELECT i.id AS invoice_id, i.contact_id AS invoice_contact_id,
       i.invoice_number, i.total AS invoice_total,
       i.date AS invoice_date, i.due_date AS invoice_due_date,
       i.payment_status AS invoice_payment_status,
       i.notes AS invoice_notes, i.active,
       i.quote_id AS invoice_quote_id,
       c.company_name AS contact_name
FROM invoices i
LEFT JOIN contacts c ON i.contact_id = c.id
WHERE i.contact_id = ? AND i.active = 1
ORDER BY i.date DESC
```
2. Return `{ success: true, data: invoices }`

---

## Public Routes (contactFormRouter.ts)

### 8. POST `/v1/leads/submit`
**Purpose**: Public contact form submission  
**Auth**: NONE  
**Rate limit**: 5 requests/minute per IP (in-memory Map)

**Flow**:
1. **Rate limit check**: Track `{ count, firstRequest }` per `req.ip` in `Map<string, RateLimitEntry>`. If `count ≥ 5` within 60 seconds → `429` response.
2. **Honeypot check**: If `req.body.honeypot` has a truthy value → silently return `200` success (bot detected).
3. **Validate fields**: `client_id`, `name`, `email`, `message` must be present → `400` if missing.
4. **Email format check**: Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → `400` if invalid.
5. **Owner email lookup cascade**:
   ```
   generated_sites (WHERE client_id = ?) → get owner email
   ↓ if not found
   widget_clients (WHERE client_id = ?) → get email
   ↓ if not found
   users (WHERE id = ?) → get email
   ↓ if all fail → 404
   ```
6. **Send email via SMTP** (nodemailer):
   - From: `process.env.SMTP_FROM`
   - To: resolved owner email
   - Subject: `"New Contact Form Submission from {name}"`
   - HTML body with formatted message
7. Return `200 { success: true, message: "Thank you..." }`

---

### 9. GET `/v1/leads/test`
**Purpose**: Health check endpoint  
**Auth**: NONE  
**Response**: `200 { success: true, message: 'Contact form router is working' }`

---

## Frontend Route Mapping

| URL Path | Component | File |
|----------|-----------|------|
| `/contacts` | `Contacts` | `src/pages/Contacts.tsx` |
| `/contacts/:id` | `ContactDetails` | `src/pages/ContactDetails.tsx` |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP Request | Backend Handler |
|----------------|--------------|--------------|-----------------|
| Load customer/supplier list | `ContactModel.getAll(type, page, search)` | `GET /v1/contacts?page=&search=` | `contacts.ts` GET `/` |
| View contact detail | `ContactModel.getById(id)` | `GET /v1/contacts/:id` | `contacts.ts` GET `/:id` |
| Create contact | `ContactModel.create(data)` | `POST /v1/contacts` | `contacts.ts` POST `/` |
| Edit contact | `ContactModel.update(id, data)` | `PUT /v1/contacts/:id` | `contacts.ts` PUT `/:id` |
| Delete contact | `ContactModel.delete(id)` | `DELETE /v1/contacts/:id` | `contacts.ts` DELETE `/:id` |
| Load statement data | `ContactModel.getStatementData(id)` | `GET /v1/contacts/:id/statement` | *(not in current router — may be a separate route or unimplemented)* |
| Download statement PDF | `ContactModel.downloadStatement(id, params)` | `GET /v1/contacts/:id/statement/download` | *(not in current router — may be a separate route or unimplemented)* |

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| View contacts list | `contacts.view` | Frontend `<Can>` only |
| Create contact | `contacts.create` | Frontend `<Can>` only |
| Edit contact | `contacts.edit` | Frontend `<Can>` only |
| Delete contact | `contacts.delete` | Frontend `<Can>` only |
| View contact details | `contacts.view` | Frontend `<Can>` only |
| Submit contact form | *(none)* | Public endpoint |

> ⚠️ **No backend permission enforcement exists.** All authorization is frontend-only.
