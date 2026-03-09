# Pricing Module

## Overview
The Pricing module provides centralized management of product/service pricing items used throughout the billing system. Pricing items can be categorized, searched, imported from Excel, and integrated into quotations and invoices. The module serves as a product catalog with unit prices, descriptions, and optional categorization.

**Current Data**: 210 pricing items across multiple categories (as of March 2026)

## Key Responsibilities
- CRUD operations on pricing items (hard delete, no soft delete)
- Category-based pricing organization
- Excel import for bulk pricing data (with category grouping)
- Pricing lookup for quotation and invoice line-item creation
- Unit, price, and note field extraction from composite description field
- Search and pagination for large pricing catalogs

## Architecture

### Backend
- **Router**: `src/routes/pricing.ts` (350 LOC) — 6 route handlers mounted at `/v1/pricing`
- **Database**: Direct `mysql2/promise` pool queries via `db` helper; no dedicated service layer
- **Validation**: Zod schemas for pricing creation and updates
- **Import**: Excel file processing via `xlsx` library with automatic category creation

### Frontend
- **Page**: `src/pages/general/Pricing.tsx` (451 LOC) — combined list + create/edit modal
- **Components**: `PricingModal.tsx` (90 LOC), `ItemPickerModal.tsx` (160 LOC)
- **Model**: `src/models/OtherModels.ts` — `PricingModel` class (70 LOC)
- **State**: Local component state with React hooks

## Dependencies

| Dependency | Purpose |
|-----------|---------|
| `mysql2/promise` | Database queries |
| `zod` | Request validation |
| `xlsx` | Excel file import processing |
| `multer` | File upload handling |
| `Categories` module | Category lookup and association |
| `TanStack React Table` | Pricing list DataTable |
| `SweetAlert2` | User feedback dialogs |

## Database Tables

| Table | Purpose |
|-------|---------|
| `pricing` | Pricing item records with composite description field |
| `categories` | Category groupings for pricing items |

## Database Schema Note
The `pricing` table uses a **composite description field** that stores multiple values:
- Format: `{unit} | {notes} | {category}`
- Example: `"m² | Supply and install | TILING"`
- The backend parses this field using SQL `SUBSTRING_INDEX()` functions
- Frontend fields (`pricing_unit`, `pricing_note`) are extracted on read and recombined on write

## Key Data Flows

### Pricing Item Creation
```
Frontend form → POST /pricing (Zod validated)
  → Map frontend fields to database columns
  → Combine unit + note into description field
  → INSERT into pricing
  → Return with parsed fields (unit, note, price)
```

### Excel Import Flow
```
POST /pricing/import (multipart/form-data)
  → Read Excel rows via xlsx library
  → Detect category headers (rows with no unit/price)
  → Create categories if missing
  → For each data row:
    → Check if item exists by id or item_name
    → Update existing OR insert new
  → Return import statistics (imported, updated, skipped)
```

### Pricing Lookup (used in quotation/invoice creation)
```
GET /pricing?search={query}
  → Search by item_name or description
  → Return paginated results with parsed fields
  → Frontend displays in ItemPickerModal
  → Selected item populates line-item form
```

## Frontend Integration Points

| Feature | Component | Usage |
|---------|-----------|-------|
| Price catalog management | `Pricing.tsx` | Main pricing CRUD interface |
| Item picker for quotes/invoices | `ItemPickerModal.tsx` | Select pricing items to add as line items |
| Inline pricing reference | `PricingModal.tsx` | Quick pricing lookup modal |

## Excel Import Format
Expected Excel structure:
```
| ID  | Item Description      | Unit | Unit Price | Notes               |
|-----|-----------------------|------|------------|---------------------|
|     | CATEGORY HEADER       |      |            |                     | <- Category rows (no unit/price)
| 1   | Ceramic Wall Tiles    | m²   | 450.00     | Supply and install  | <- Data rows
| 2   | Porcelain Floor Tiles | m²   | 850.00     | Premium range       |
```

**Category Detection Logic**: Rows with description but no unit AND (no price OR price=0) are treated as category headers. All subsequent data rows belong to that category until the next category header.

## API Response Structure
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

## Known Quirks & Edge Cases

1. **Composite Description Field**: The database stores `unit | notes | category` in a single `description` column. The backend uses SQL string functions to parse it on every query.

2. **Category Auto-Creation on Import**: Excel import automatically creates missing categories. This can lead to duplicate categories if naming is inconsistent (e.g., "Tiling" vs "TILING").

3. **No Soft Delete**: Unlike quotations/invoices, pricing items use hard delete. Deleted items may leave orphaned references in historical quotations/invoices (stored as text in line items, so not broken).

4. **Unit Price vs. Line Total**: Pricing stores unit prices. Total calculation happens in quotation/invoice line items based on quantity.

5. **Search Performance**: The `LIKE` search on description field with composite values can be slow on large datasets. Consider full-text indexing if catalog exceeds 1000+ items.
