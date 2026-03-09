# Pricing — Field & Data Dictionary

## Database Schema: `pricing` Table

| Column | Type | Nullable | Default | Frontend Alias | Description |
|--------|------|----------|---------|----------------|-------------|
| `id` | `INT` (PK) | No | AUTO_INCREMENT | `pricing_id` | Primary key |
| `category_id` | `INT` (FK) | Yes | `NULL` | `pricing_category_id` | Links to `categories.id` |
| `item_name` | `VARCHAR(255)` | No | — | `pricing_item` | Product/service name |
| `description` | `TEXT` | Yes | `NULL` | ⚠️ Composite field | Stores `unit \| note \| category` (parsed on read) |
| `unit_price` | `DECIMAL(10,2)` | No | `0.00` | `pricing_price` | Unit price (Rands) |
| `created_at` | `DATETIME` | Yes | — | `created_at` | Creation timestamp |
| `updated_at` | `DATETIME` | Yes | — | `updated_at` | Last update timestamp |

### Composite Description Field Parsing
The `description` column stores multiple values separated by ` | `:

**Example**: `"m² | Supply and install | TILING"`

**SQL Parsing** (used in SELECT queries):
```sql
-- Extract unit (first segment)
SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit

-- Extract note (second segment, if exists)
CASE 
  WHEN p.description LIKE '%|%|%' THEN 
    TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
  ELSE p.description
END as pricing_note
```

**Write Logic** (used in INSERT/UPDATE):
```typescript
description = [pricing_unit, pricing_note].filter(Boolean).join(' | ')
// Result: "m² | Supply and install"
```

### Column Aliasing (PRICING_SELECT fragment)
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
```

**Frontend receives parsed fields**:
- `pricing_unit`: Extracted from description (e.g., "m²")
- `pricing_note`: Extracted from description (e.g., "Supply and install")
- Original composite `description` field is NOT returned to frontend

---

## Zod Validation Schemas

### `createPricingSchema`
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `pricing_category_id` | `number` | No | `int().positive()` or `null` |
| `pricing_item` | `string` | Yes | `min(1)` |
| `pricing_note` | `string` | No | Optional or `null` |
| `pricing_price` | `number` | Yes | `nonnegative()` (allows 0) |
| `pricing_unit` | `string` | No | Optional or `null` |

### `updatePricingSchema`
All fields from `createPricingSchema`, all optional (`.partial()`).

---

## API Response Schemas

### Pricing Object (from SELECT with JOINs)
```json
{
  "pricing_id": 1,
  "pricing_item": "Ceramic Wall Tiles",
  "pricing_note": "Supply and install",
  "pricing_price": 450.00,
  "pricing_unit": "m²",
  "pricing_category_id": 5,
  "category_name": "TILING",
  "created_at": "2026-02-15T10:30:00.000Z",
  "updated_at": "2026-02-15T10:30:00.000Z"
}
```

### List Response
```json
{
  "success": true,
  "data": [/* Pricing objects */],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 210
  }
}
```

### Import Response
```json
{
  "success": true,
  "message": "Import complete: 150 new, 45 updated, 5 skipped",
  "imported": 150,
  "updated": 45,
  "skipped": 5
}
```

---

## Field Mapping: Frontend ↔ Database

| Frontend Field | Database Column | Transformation |
|----------------|-----------------|----------------|
| `pricing_id` | `id` | Direct |
| `pricing_item` | `item_name` | Direct |
| `pricing_price` | `unit_price` | Direct |
| `pricing_category_id` | `category_id` | Direct |
| `pricing_unit` | `description` | **Extracted** from composite field (first segment) |
| `pricing_note` | `description` | **Extracted** from composite field (second segment) |

### Write Operation Field Mapping
```typescript
// Frontend sends:
{
  pricing_item: "Ceramic Tiles",
  pricing_unit: "m²",
  pricing_note: "Supply and install",
  pricing_price: 450.00,
  pricing_category_id: 5
}

// Backend transforms to:
{
  item_name: "Ceramic Tiles",
  description: "m² | Supply and install",  // Combined
  unit_price: 450.00,
  category_id: 5
}
```

---

## Excel Import Field Mapping

| Excel Column | Index | Maps To | Notes |
|--------------|-------|---------|-------|
| ID | 0 | `id` (optional) | Used to match existing records for updates |
| Item Description | 1 | `item_name` | Required; if no unit/price, treated as category header |
| Unit | 2 | First segment of `description` | e.g., "m²", "kg", "hr" |
| Unit Price | 3 | `unit_price` | Numeric; if empty/0 → category header detection |
| Notes | 4 | Second segment of `description` | Optional |

### Import Row Types

**Category Header Row**:
```
| ID | Item Description | Unit | Unit Price | Notes |
|    | TILING           |      |            |       |
```
- No unit AND (no price OR price = 0)
- Creates/uses category for subsequent data rows

**Data Row**:
```
| ID  | Item Description      | Unit | Unit Price | Notes               |
| 123 | Ceramic Wall Tiles    | m²   | 450.00     | Supply and install  |
```
- Has unit OR price > 0
- Inserts/updates pricing record
- Associates with current category

---

## Type Definitions

### TypeScript Frontend Type
```typescript
interface Pricing {
  pricing_id: number;
  pricing_item: string;
  pricing_note?: string | null;
  pricing_price: number;
  pricing_unit?: string | null;
  pricing_category_id?: number | null;
  category_name?: string;
  created_at?: string;
  updated_at?: string;
}
```

### Database Type (Internal)
```typescript
interface PricingRow {
  id: number;
  category_id: number | null;
  item_name: string;
  description: string | null;  // Composite: "unit | note"
  unit_price: number;
  created_at: Date;
  updated_at: Date;
}
```

---

## Field Constraints & Validation

| Field | Min | Max | Pattern | Notes |
|-------|-----|-----|---------|-------|
| `pricing_item` | 1 char | 255 chars | Any | Required |
| `pricing_price` | 0 | 9999999.99 | Numeric | Can be 0 for "quote only" items |
| `pricing_unit` | — | 50 chars | Any | Common: "m²", "kg", "hr", "each" |
| `pricing_note` | — | 1000 chars | Any | Optional description |
| `pricing_category_id` | — | — | FK to categories.id | Optional |

---

## Common Query Patterns

### Search by Name or Description
```sql
SELECT * FROM pricing 
WHERE item_name LIKE '%tiles%' OR description LIKE '%tiles%'
ORDER BY item_name ASC
```

### Get All Items in Category
```sql
SELECT * FROM pricing 
WHERE category_id = 5
ORDER BY item_name ASC
```

### Find Item by Exact Name (for duplicate check)
```sql
SELECT id FROM pricing 
WHERE item_name = 'Ceramic Wall Tiles'
LIMIT 1
```

### Import Upsert Logic
```sql
-- Check existence
SELECT id FROM pricing WHERE id = ? OR item_name = ?

-- If exists: UPDATE
UPDATE pricing 
SET item_name = ?, unit_price = ?, description = ?, category_id = ?, updated_at = ?
WHERE id = ?

-- If not exists: INSERT
INSERT INTO pricing (item_name, unit_price, description, category_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
```
