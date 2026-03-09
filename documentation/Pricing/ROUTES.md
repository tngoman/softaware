# Pricing — Route & API Reference

## Route Registration

**Backend mount point**: `/v1/pricing` (all routes require JWT via `requireAuth`)

```
src/routes/pricing.ts → pricingRouter mounted at /v1/pricing
```

---

## Route Summary

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/v1/pricing` | List pricing items (paginated, searchable) |
| 2 | GET | `/v1/pricing/:id` | Get single pricing item |
| 3 | POST | `/v1/pricing` | Create new pricing item |
| 4 | PUT | `/v1/pricing/:id` | Update pricing item |
| 5 | DELETE | `/v1/pricing/:id` | Delete pricing item (hard delete) |
| 6 | POST | `/v1/pricing/import` | Import pricing items from Excel |

---

## Detailed Route Documentation

### 1. GET `/v1/pricing`
**Purpose**: List all pricing items with optional filtering, search, and pagination  
**Auth**: JWT required  
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-based) |
| `limit` | `number` | `50` | Items per page |
| `category` | `number` | — | Filter by category ID |
| `search` | `string` | — | Search in item_name or description (LIKE) |

**SQL**:
```sql
SELECT 
  p.id as pricing_id,
  p.item_name as pricing_item,
  CASE 
    WHEN p.description LIKE '%|%|%' THEN 
      TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
    ELSE p.description
  END as pricing_note,
  p.unit_price as pricing_price,
  SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
  p.category_id as pricing_category_id,
  c.category_name,
  p.created_at,
  p.updated_at
FROM pricing p 
LEFT JOIN categories c ON p.category_id = c.id 
WHERE 1=1
  [AND p.category_id = ?]
  [AND (p.item_name LIKE ? OR p.description LIKE ?)]
ORDER BY p.item_name ASC
LIMIT ? OFFSET ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "pricing_id": 1,
      "pricing_item": "Ceramic Wall Tiles",
      "pricing_note": "Supply and install",
      "pricing_price": 450.00,
      "pricing_unit": "m²",
      "pricing_category_id": 5,
      "category_name": "TILING"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 210
  }
}
```

**Error** `401`:
```json
{ "error": "UNAUTHORIZED", "message": "Missing or invalid token" }
```

---

### 2. GET `/v1/pricing/:id`
**Purpose**: Get single pricing item by ID  
**Auth**: JWT required  
**Params**:
| Param | Type | Description |
|-------|------|-------------|
| `id` | `number` | Pricing item ID |

**SQL**:
```sql
SELECT {PRICING_SELECT} FROM pricing p 
LEFT JOIN categories c ON p.category_id = c.id 
WHERE p.id = ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "pricing_id": 1,
    "pricing_item": "Ceramic Wall Tiles",
    "pricing_note": "Supply and install",
    "pricing_price": 450.00,
    "pricing_unit": "m²",
    "pricing_category_id": 5,
    "category_name": "TILING"
  }
}
```

**Error** `404`:
```json
{ "error": "NOT_FOUND", "message": "Pricing item not found" }
```

---

### 3. POST `/v1/pricing`
**Purpose**: Create new pricing item  
**Auth**: JWT required  
**Body**: Validated with `createPricingSchema`

**Request body**:
```json
{
  "pricing_item": "Ceramic Wall Tiles",
  "pricing_unit": "m²",
  "pricing_note": "Supply and install",
  "pricing_price": 450.00,
  "pricing_category_id": 5
}
```

**Flow**:
1. Zod validate request body
2. Map frontend field names to database columns:
   - `pricing_item` → `item_name`
   - `pricing_price` → `unit_price`
   - Combine `pricing_unit` + `pricing_note` → `description` (e.g., "m² | Supply and install")
3. INSERT with timestamps
4. Fetch and return created item with parsed fields

**SQL**:
```sql
INSERT INTO pricing (category_id, item_name, description, unit_price, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
```

**Response** `201`:
```json
{
  "success": true,
  "id": 211,
  "data": {
    "pricing_id": 211,
    "pricing_item": "Ceramic Wall Tiles",
    "pricing_note": "Supply and install",
    "pricing_price": 450.00,
    "pricing_unit": "m²",
    "pricing_category_id": 5,
    "category_name": "TILING"
  }
}
```

**Error** `400`:
```json
{ "error": "BAD_REQUEST", "message": "Validation failed: ..." }
```

---

### 4. PUT `/v1/pricing/:id`
**Purpose**: Update existing pricing item  
**Auth**: JWT required  
**Params**: `id` (pricing item ID)  
**Body**: Validated with `updatePricingSchema` (all fields optional)

**Request body** (partial update):
```json
{
  "pricing_price": 475.00,
  "pricing_note": "Premium quality | Supply and install"
}
```

**Flow**:
1. Zod validate (partial schema)
2. Check item exists → `404` if not
3. Map frontend fields to database columns
4. If `pricing_note` or `pricing_unit` provided, recombine into `description`
5. UPDATE with new `updated_at` timestamp
6. Fetch and return updated item with parsed fields

**SQL**:
```sql
UPDATE pricing 
SET unit_price = ?, description = ?, updated_at = ?
WHERE id = ?
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "pricing_id": 1,
    "pricing_item": "Ceramic Wall Tiles",
    "pricing_note": "Premium quality | Supply and install",
    "pricing_price": 475.00,
    "pricing_unit": "m²",
    "pricing_category_id": 5,
    "category_name": "TILING"
  }
}
```

**Error** `404`:
```json
{ "error": "NOT_FOUND", "message": "Pricing item not found" }
```

---

### 5. DELETE `/v1/pricing/:id`
**Purpose**: Permanently delete pricing item (hard delete)  
**Auth**: JWT required  
**Params**: `id` (pricing item ID)

**⚠️ Warning**: This is a **hard delete**. The item is permanently removed from the database. Historical quotations/invoices that reference this item will retain the text data (stored in line items), but the pricing record is gone.

**Flow**:
1. Check item exists → `404` if not
2. DELETE from database

**SQL**:
```sql
DELETE FROM pricing WHERE id = ?
```

**Response** `200`:
```json
{
  "success": true,
  "message": "Pricing item deleted"
}
```

**Error** `404`:
```json
{ "error": "NOT_FOUND", "message": "Pricing item not found" }
```

---

### 6. POST `/v1/pricing/import`
**Purpose**: Bulk import pricing items from Excel file  
**Auth**: JWT required  
**Content-Type**: `multipart/form-data`  
**Form field**: `file` (Excel file, max 10MB)

**Excel Format**:
| Column | Index | Required | Description |
|--------|-------|----------|-------------|
| ID | A | No | Existing pricing ID (for updates) |
| Item Description | B | Yes | Item name OR category header |
| Unit | C | No | Unit of measure (e.g., "m²", "kg") |
| Unit Price | D | No | Numeric price (if empty/0 + no unit → category header) |
| Notes | E | No | Additional description |

**Category Header Detection**:
- Row with description but **no unit** AND (**no price** OR **price = 0**)
- Example: `| | TILING | | | |` → Creates/uses "TILING" category
- All subsequent data rows belong to that category until next header

**Import Logic**:
```
For each Excel row:
  IF no unit AND (no price OR price = 0):
    → Treat as category header
    → Create category if not exists
    → Set currentCategory for subsequent rows
  ELSE:
    → Data row
    → Check if item exists (by ID or item_name)
    → IF exists: UPDATE
    → ELSE: INSERT
    → Associate with currentCategory
```

**Request**:
```bash
curl -X POST http://localhost:3001/v1/pricing/import \
  -H "Authorization: Bearer {JWT}" \
  -F "file=@pricing_catalog.xlsx"
```

**Response** `200`:
```json
{
  "success": true,
  "message": "Import complete: 150 new, 45 updated, 5 skipped",
  "imported": 150,
  "updated": 45,
  "skipped": 5
}
```

**Error** `400`:
```json
{ "error": "BAD_REQUEST", "message": "No file uploaded" }
```

**Import Statistics**:
- `imported`: New items created
- `updated`: Existing items modified (matched by ID or item_name)
- `skipped`: Rows with missing required data (no description)

---

## Frontend Model Methods

**File**: `src/models/OtherModels.ts` → `PricingModel`

### `PricingModel.getAll(categoryId?, paginationParams?)`
**Purpose**: List pricing items with optional filters  
**Params**:
- `categoryId?: number` — Filter by category
- `paginationParams?: { page, limit }` — Pagination

**Maps to**: `GET /v1/pricing?category={id}&page={page}&limit={limit}`

### `PricingModel.getById(id: number)`
**Purpose**: Get single pricing item  
**Maps to**: `GET /v1/pricing/:id`

### `PricingModel.create(data: Pricing)`
**Purpose**: Create new pricing item  
**Maps to**: `POST /v1/pricing`

### `PricingModel.update(id: number, data: Partial<Pricing>)`
**Purpose**: Update pricing item  
**Maps to**: `PUT /v1/pricing/:id`

### `PricingModel.delete(id: number)`
**Purpose**: Delete pricing item  
**Maps to**: `DELETE /v1/pricing/:id`

### `PricingModel.import(formData: FormData)`
**Purpose**: Import pricing from Excel  
**Maps to**: `POST /v1/pricing/import`

---

## Route Authorization

All routes require JWT authentication via `requireAuth` middleware.

**Token header**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Unauthorized response** `401`:
```json
{ "error": "UNAUTHORIZED", "message": "Missing or invalid token" }
```

---

## Performance Considerations

1. **Search Performance**: The `LIKE '%search%'` pattern on `item_name` and composite `description` field can be slow. Consider:
   - Full-text index on `item_name`
   - Separate columns for unit/note instead of composite field
   - Client-side filtering for small datasets (<500 items)

2. **Category Join**: Every query LEFT JOINs categories. For large datasets, consider denormalizing category_name into pricing table.

3. **Excel Import Memory**: The import loads entire Excel file into memory. For files >5000 rows, consider streaming parser.

4. **No Pagination Limit**: Frontend can request `limit: 10000` which bypasses pagination. Add max limit enforcement (e.g., 500).
