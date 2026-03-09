# Invoices — Route & API Reference

## Route Registration

**Backend mount point**: `/v1/invoices` (all routes require JWT via `requireAuth`)

```
src/routes/invoices.ts → invoicesRouter mounted at /v1/invoices
```

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/invoices` | List invoices (paginated, filterable) |
| 2 | GET | `/v1/invoices/:id` | Get invoice with items and payments |
| 3 | POST | `/v1/invoices` | Create new invoice |
| 4 | PUT | `/v1/invoices/:id` | Update invoice |
| 5 | DELETE | `/v1/invoices/:id` | Soft delete invoice |
| 6 | POST | `/v1/invoices/:id/items` | Add line item |
| 7 | DELETE | `/v1/invoices/:id/items/:itemId` | Delete line item |
| 8 | POST | `/v1/invoices/:id/payments` | Record payment |
| 9 | GET | `/v1/invoices/:id/payments` | List payments for invoice |
| 10 | POST | `/v1/invoices/:id/generate-pdf` | Generate PDF |
| 11 | POST | `/v1/invoices/:id/send-email` | Send invoice via email |
| 12 | POST | `/v1/invoices/:id/mark-paid` | Mark invoice as paid |

---

## Detailed Route Documentation

### 1. GET `/v1/invoices`
**Purpose**: List all active invoices with optional pagination, search, and payment status filter  
**Auth**: JWT required  
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number |
| `limit` | `number` | `50` | Items per page |
| `paid` | `number` | — | Filter by paid status (0, 1, 2) |
| `search` | `string` | `''` | Search in invoice_number, company_name, remarks (LIKE) |

**SQL**:
```sql
SELECT {INVOICE_SELECT} FROM invoices i
LEFT JOIN contacts c ON c.id = i.contact_id
WHERE i.active = 1
  [AND i.paid = ?]
  [AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR i.remarks LIKE ?)]
ORDER BY i.id DESC
LIMIT ? OFFSET ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": [{ /* Invoice object */ }],
  "pagination": { "page": 1, "limit": 50, "total": 46 }
}
```

---

### 2. GET `/v1/invoices/:id`
**Purpose**: Get single invoice with line items and payments  
**Auth**: JWT required

**Flow**:
1. Fetch invoice with contact JOIN
2. Fetch `invoice_items` WHERE `invoice_id = ?`
3. Fetch `payments` WHERE `invoice_id = ?`
4. Merge into single response

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "invoice_id": 1,
    "...invoice fields...",
    "items": [{ "item_id": 1, "item_product": "...", "item_qty": 1, "item_price": 100, "item_subtotal": 100 }],
    "payments": [{ "payment_id": 1, "payment_date": "2024-01-15", "payment_amount": 50, "payment_invoice": 1 }]
  }
}
```

---

### 3. POST `/v1/invoices`
**Purpose**: Create new invoice with optional inline items  
**Auth**: JWT required  
**Body**: Validated with `createInvoiceSchema`

**Flow**:
1. Zod validate request body (supports `invoice_contact_id` or `contact_id`)
2. Verify contact exists in contacts table → `400` if not
3. Auto-generate `INV-NNNNN` number if not provided (sequential from last invoice)
4. Check uniqueness → append timestamp if duplicate
5. INSERT with `invoice_user_id = req.userId` and timestamps
6. If `items[]` array provided → INSERT each item into `invoice_items`
7. Fetch and return created invoice with contact JOIN

**Response** `201`: `{ success: true, id: 47, data: { /* Invoice */ } }`

---

### 4. PUT `/v1/invoices/:id`
**Purpose**: Update existing invoice (with optional item replacement)  
**Auth**: JWT required  
**Body**: Validated with `updateInvoiceSchema` (partial)

**Flow**:
1. Zod validate (partial)
2. Check invoice exists → `404` if not
3. UPDATE invoice fields with `updated_at` timestamp
4. If `items[]` provided → DELETE existing invoice_items → INSERT new items
5. Return updated invoice with contact JOIN

**Response** `200`: `{ success: true, data: { /* Invoice */ } }`

---

### 5. DELETE `/v1/invoices/:id`
**Purpose**: Soft delete (set `active = 0`)  
**Auth**: JWT required

**Flow**:
1. Verify invoice exists → `404` if not
2. `UPDATE invoices SET active = 0, updated_at = ? WHERE id = ?`

**Response** `200`: `{ success: true, message: "Invoice deleted" }`

---

### 6. POST `/v1/invoices/:id/items`
**Purpose**: Add a line item to an invoice  
**Auth**: JWT required  
**Body**: Validated with `createInvoiceItemSchema`

**Flow**:
1. Verify invoice exists → `404` if not
2. INSERT into `invoice_items` with `invoice_id`
3. Return created item

**Response** `201`: `{ success: true, data: { /* InvoiceItem */ } }`

---

### 7. DELETE `/v1/invoices/:id/items/:itemId`
**Purpose**: Remove a line item from an invoice  
**Auth**: JWT required  
**Note**: This is a **hard delete**, not soft delete

**Flow**:
1. Verify item exists AND belongs to invoice → `404` if not
2. `DELETE FROM invoice_items WHERE id = ?`

**Response** `200`: `{ success: true, message: "Item deleted" }`

---

### 8. POST `/v1/invoices/:id/payments`
**Purpose**: Record a payment against an invoice  
**Auth**: JWT required  
**Body**: Validated with `createPaymentSchema`

**Flow**:
1. Verify invoice exists → `404` if not
2. INSERT into `payments` with `invoice_id`
3. Calculate `SUM(payment_amount)` for this invoice
4. If total ≥ `invoice_amount` → set `invoices.paid = 1`
5. Return created payment

**Response** `201`: `{ success: true, data: { /* Payment */ } }`

**⚠️ Issue**: Auto-paid only sets `paid = 1`, not `paid = 2`. The status values (0=unpaid, 1=partial, 2=paid) are inconsistent with the auto-detection logic.

---

### 9. GET `/v1/invoices/:id/payments`
**Purpose**: List all payments for an invoice  
**Auth**: JWT required

**Response** `200`:
```json
{ "success": true, "data": [{ /* full payment records */ }] }
```

---

### 10. POST `/v1/invoices/:id/generate-pdf`
**Purpose**: Generate a branded PDF invoice document  
**Auth**: JWT required

**Flow**:
1. Load invoice with items and contact info
2. Load company settings via `loadCompanySettings()`
3. Build `PDFDocData` object with type='invoice'
4. Call `generatePdf()` → saves file to disk
5. Return `{ filename, path }` (web-accessible path)

**Response** `200`:
```json
{ "success": true, "filename": "invoice_INV-001.pdf", "path": "generated/invoices/invoice_INV-001.pdf" }
```

---

### 11. POST `/v1/invoices/:id/send-email`
**Purpose**: Send invoice via email using SMTP  
**Auth**: JWT required  
**Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Recipient email |
| `subject` | `string` | No | Default: `"Invoice #${id}"` |
| `body` | `string` | No | HTML body |

**Flow**:
1. Verify `to` field present → `400` if missing
2. Verify invoice exists → `404` if not
3. Create nodemailer transporter from env vars
4. Send email
5. On SMTP failure: returns `200` with "Email queued" message (graceful degradation)

**Response** `200`: `{ success: true, message: "Email sent successfully" }`

**⚠️ Note**: SMTP failure returns success (200) with a different message, not an error status.

---

### 12. POST `/v1/invoices/:id/mark-paid`
**Purpose**: Manually mark invoice as paid (override)  
**Auth**: JWT required

**Flow**:
1. Verify invoice exists → `404` if not
2. `UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?`

**Response** `200`: `{ success: true, message: "Invoice marked as paid" }`

**⚠️ Issue**: Sets `paid = 1` not `paid = 2` (inconsistent with PaymentStatusBadge which maps 2=Paid).

---

## Frontend Route Mapping

| URL Path | Component | Description |
|----------|-----------|-------------|
| `/invoices` | `Invoices` | Invoice list view |
| `/invoices/:id` | `Invoices` | Invoice detail view (same component, conditional render) |
| `/invoices/new` | `Invoices` | New invoice form (placeholder — not yet implemented) |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|----------------|--------------|------|---------------|
| Load invoice list | `InvoiceModel.getAll(params)` | GET | `/v1/invoices` |
| View invoice detail | `InvoiceModel.getById(id)` | GET | `/v1/invoices/:id` |
| Create invoice | `InvoiceModel.create(data)` | POST | `/v1/invoices` |
| Update invoice | `InvoiceModel.update(id, data)` | PUT | `/v1/invoices/:id` |
| Delete invoice | `InvoiceModel.delete(id)` | DELETE | `/v1/invoices/:id` |
| Mark as paid | `InvoiceModel.markAsPaid(id)` | POST | `/v1/invoices/:id/mark-paid` |
| Generate PDF | `InvoiceModel.generatePDF(id)` | POST | `/v1/invoices/:id/generate-pdf` |
| Send email | `InvoiceModel.sendEmail(id, data)` | POST | `/v1/invoices/:id/send-email` |
| Load items | `InvoiceModel.getItems(id)` | GET | `/invoice-items` ⚠️ |
| Update items | `InvoiceModel.updateItems(id, items)` | POST | `/invoice-items` ⚠️ |
| Record payment | `PaymentModel.create(data)` | POST | `/v1/invoices/:id/payments` |
| Process payment | `PaymentModel.process(data)` | POST | Payment routes |

> ⚠️ `getItems` and `updateItems` call `/invoice-items` which is not defined in `invoices.ts` — may be a separate route file.

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| View invoice list | `invoices.view` | Frontend `<Can>` only |
| View invoice detail | `invoices.view` | Frontend `<Can>` only |
| Create invoice | `invoices.create` | Frontend `<Can>` only |
| Edit invoice | `invoices.edit` | Frontend `<Can>` only |
| Delete invoice | `invoices.delete` | Frontend `<Can>` only |
| Record payment | — | Any authenticated user |
| Generate PDF | — | Any authenticated user |
| Send email | — | Any authenticated user |
| Mark as paid | — | Any authenticated user |

> ⚠️ **No backend permission enforcement.** All authorization is frontend-only via `<Can>` component.
