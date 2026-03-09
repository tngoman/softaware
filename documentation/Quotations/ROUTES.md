# Quotations — Route & API Reference

## Route Registration

**Backend mount point**: `/v1/quotations` (all routes require JWT via `requireAuth`)

```
src/routes/quotations.ts → quotationsRouter mounted at /v1/quotations
```

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/quotations` | List quotations (paginated) |
| 2 | GET | `/v1/quotations/:id` | Get quotation with items |
| 3 | POST | `/v1/quotations` | Create new quotation |
| 4 | PUT | `/v1/quotations/:id` | Update quotation |
| 5 | DELETE | `/v1/quotations/:id` | Soft delete quotation |
| 6 | POST | `/v1/quotations/:id/items` | Add line item |
| 7 | DELETE | `/v1/quotations/:id/items/:itemId` | Delete line item |
| 8 | POST | `/v1/quotations/:id/generate-pdf` | Generate PDF |
| 9 | POST | `/v1/quotations/:id/send-email` | Send quotation via email |
| 10 | POST | `/v1/quotations/:id/convert-to-invoice` | Convert to invoice |

---

## Detailed Route Documentation

### 1. GET `/v1/quotations`
**Purpose**: List all active quotations with search, sort, and pagination  
**Auth**: JWT required  
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `0` | Page number (0-based, converted to 1-based internally) |
| `limit` | `number` | `50` | Items per page |
| `search` | `string` | `''` | Search in quotation_number, company_name, remarks (LIKE) |
| `sortBy` | `string` | `'quotation_id'` | Sort column: `quotation_id`, `quotation_date`, `contact_name`, `quotation_total`, `quotation_status` |
| `sortOrder` | `string` | `'desc'` | Sort direction: `asc` or `desc` |

**SQL**:
```sql
SELECT {QUOTATION_SELECT} FROM quotations q
LEFT JOIN contacts c ON c.id = q.contact_id
WHERE q.active = 1
  [AND (q.quotation_number LIKE ? OR c.company_name LIKE ? OR q.remarks LIKE ?)]
ORDER BY {sortColumn} {sortDirection}
LIMIT ? OFFSET ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": [{ /* Quotation objects */ }],
  "pagination": { "page": 0, "limit": 50, "total": 110 }
}
```

**Note**: Returns 0-based page to match frontend pagination.

---

### 2. GET `/v1/quotations/:id`
**Purpose**: Get single quotation with line items  
**Auth**: JWT required

**Flow**:
1. Fetch quotation with contact JOIN
2. Fetch `quote_items` WHERE `quotation_id = ?`
3. Merge into single response

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "quotation_id": 1,
    "...fields...",
    "items": [{ "item_id": 1, "item_product": "...", "item_qty": 1, "item_price": 100 }]
  }
}
```

---

### 3. POST `/v1/quotations`
**Purpose**: Create new quotation with optional inline items  
**Auth**: JWT required  
**Body**: Validated with `createQuotationSchema`

**Flow**:
1. Zod validate request body (supports `quotation_contact_id` or `contact_id`)
2. Verify contact exists → `400` if not
3. Auto-generate `QUO-NNNNN` number if not provided (sequential from last quotation)
4. Check uniqueness → append timestamp if duplicate
5. INSERT into quotations with timestamps
6. If `items[]` array provided → INSERT each item into `quote_items`
7. Fetch and return created quotation with contact JOIN

**Response** `201`: `{ success: true, id: 123, data: { /* Quotation */ } }`

---

### 4. PUT `/v1/quotations/:id`
**Purpose**: Update existing quotation (with optional item replacement)  
**Auth**: JWT required  
**Body**: Validated with `updateQuotationSchema` (partial)

**Flow**:
1. Zod validate (partial)
2. Check quotation exists → `404` if not
3. UPDATE quotation fields with new `updated_at`
4. If `items[]` provided → DELETE existing quote_items → INSERT new items
5. Return updated quotation with contact JOIN

**Response** `200`: `{ success: true, data: { /* updated Quotation */ } }`

---

### 5. DELETE `/v1/quotations/:id`
**Purpose**: Soft delete (set `active = 0`)  
**Auth**: JWT required

**Response** `200`: `{ success: true, message: "Quotation deleted" }`

---

### 6. POST `/v1/quotations/:id/items`
**Purpose**: Add a line item to a quotation  
**Auth**: JWT required  
**Body**: Validated with `createQuoteItemSchema`

**Response** `201`: `{ success: true, data: { /* QuoteItem */ } }`

---

### 7. DELETE `/v1/quotations/:id/items/:itemId`
**Purpose**: Remove a line item (hard delete)  
**Auth**: JWT required

**Response** `200`: `{ success: true, message: "Item deleted" }`

---

### 8. POST `/v1/quotations/:id/generate-pdf`
**Purpose**: Generate branded PDF quotation  
**Auth**: JWT required

**Flow**:
1. Load quotation with items and contact info
2. Load company settings via `loadCompanySettings()`
3. Build `PDFDocData` with type='quotation'
4. Call `generatePdf()` → saves to disk
5. Return `{ filename, path }`

**Response** `200`:
```json
{ "success": true, "filename": "quotation_QUO-001.pdf", "path": "generated/quotations/quotation_QUO-001.pdf" }
```

---

### 9. POST `/v1/quotations/:id/send-email`
**Purpose**: Send quotation via SMTP  
**Auth**: JWT required  
**Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | `string` | Yes | Recipient email |
| `subject` | `string` | No | Default: `"Quotation #${id}"` |
| `body` | `string` | No | HTML body |

**Note**: Returns `200 { success: true }` even on SMTP failure (graceful degradation).

---

### 10. POST `/v1/quotations/:id/convert-to-invoice`
**Purpose**: Convert quotation to invoice with all line items  
**Auth**: JWT required  
**Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invoice_number` | `string` | Yes | New invoice number |
| `invoice_date` | `string` | Yes | Invoice date (YYYY-MM-DD) |
| `due_date` | `string` | No | Payment due date |

**Flow** (transactional):
1. Validate `invoice_number` and `invoice_date` → `400` if missing
2. Load quotation → `404` if not found
3. Load quote_items
4. `START TRANSACTION`
5. INSERT into `invoices` (copies contact_id, amount, sets quotation_id FK)
6. Loop: INSERT each quote_item into `invoice_items`
7. `COMMIT`
8. Return created invoice

**On failure**: `ROLLBACK`

**Response** `201`:
```json
{
  "success": true,
  "message": "Quotation converted to invoice",
  "data": { "id": 42, "invoice_number": "INV-042", "..." }
}
```

---

## Frontend Route Mapping

| URL Path | Component | Description |
|----------|-----------|-------------|
| `/quotations` | `Quotations` | Quotation list view |
| `/quotations/:id` | `Quotations` | Quotation detail view (same component) |
| `/quotations/new` | `Quotations` | New quotation (route exists but no form) |

---

## Frontend → Backend API Calls

| Frontend Action | Model Method | HTTP | Backend Route |
|----------------|--------------|------|---------------|
| Load list | `QuotationModel.getAll(params)` | GET | `/v1/quotations` |
| View detail | `QuotationModel.getById(id)` | GET | `/v1/quotations/:id` |
| Create | `QuotationModel.create(data)` | POST | `/v1/quotations` |
| Update | `QuotationModel.update(id, data)` | PUT | `/v1/quotations/:id` |
| Delete | `QuotationModel.delete(id)` | DELETE | `/v1/quotations/:id` |
| Convert to invoice | `QuotationModel.convertToInvoice(id)` | POST | `/v1/quotations/:id/convert-to-invoice` |
| Generate PDF | `QuotationModel.generatePDF(id)` | POST | `/v1/quotations/:id/generate-pdf` |
| Send email | `QuotationModel.sendEmail(id, data)` | POST | `/v1/quotations/:id/send-email` |
| Get items | `QuotationModel.getItems(id)` | GET | `/quote-items` ⚠️ |
| Update items | `QuotationModel.updateItems(id, items)` | POST | `/quote-items` ⚠️ |

> ⚠️ `getItems` and `updateItems` call `/quote-items` which may be a separate route file

---

## Permission Matrix

| Action | Permission Key | Enforcement |
|--------|---------------|-------------|
| View quotation list | `quotations.view` | Frontend `<Can>` only |
| View quotation detail | `quotations.view` | Frontend `<Can>` only |
| Create quotation | `quotations.create` | Frontend `<Can>` only |
| Edit quotation | `quotations.edit` | Frontend `<Can>` only |
| Convert to invoice | `quotations.approve` | Frontend `<Can>` only |
| Delete quotation | — | Any authenticated user |
| Generate PDF | — | Any authenticated user |
| Send email | — | Any authenticated user |

> ⚠️ **No backend permission enforcement.** The `quotations.approve` permission is only checked on the frontend Accept/Convert button.
