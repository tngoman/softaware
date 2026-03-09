# Pricing — File Reference

## Backend Files

### Core Router
| File | LOC | Purpose |
|------|-----|---------|
| `src/routes/pricing.ts` | 350 | Main pricing router with 6 route handlers |

### Dependencies
| File | Usage |
|------|-------|
| `src/db/mysql.ts` | Database connection pool and query helpers |
| `src/middleware/auth.ts` | JWT authentication (`requireAuth`) |
| `src/utils/httpErrors.ts` | Error response utilities (`notFound`, `badRequest`) |

---

## Frontend Files

### Pages
| File | LOC | Purpose |
|------|-----|---------|
| `src/pages/general/Pricing.tsx` | 451 | Main pricing management page with CRUD operations |

### Components
| File | LOC | Purpose |
|------|-----|---------|
| `src/components/UI/PricingModal.tsx` | 90 | Quick pricing lookup modal |
| `src/components/UI/ItemPickerModal.tsx` | 160 | Select pricing items for quotations/invoices |

### Models
| File | Section | LOC | Purpose |
|------|---------|-----|---------|
| `src/models/OtherModels.ts` | `PricingModel` class | ~70 | API wrapper for pricing endpoints |

### Types
| File | Interface | Purpose |
|------|-----------|---------|
| `src/types/index.ts` | `Pricing` | TypeScript type definition |

---

## Database Files

### Schema Definition
| File | Table | Purpose |
|------|-------|---------|
| `database/migrations/*` | `pricing` | Pricing items table |
| `database/migrations/*` | `categories` | Category groupings |

### Seed Data
| File | Purpose |
|------|---------|
| `database/seeds/*` | Sample pricing data (if exists) |

---

## File Dependencies Graph

```
pricing.ts (Router)
├── mysql.ts (Database)
├── auth.ts (Middleware)
├── httpErrors.ts (Errors)
├── zod (Validation)
├── xlsx (Excel import)
└── multer (File upload)

Pricing.tsx (Frontend Page)
├── PricingModel (API calls)
├── CategoryModel (Category dropdown)
├── DataTable (List view)
├── PricingModal (Quick lookup)
└── ItemPickerModal (Item selection)

ItemPickerModal
└── PricingModel (Fetch items)

Invoice/Quotation Line Item Forms
└── ItemPickerModal (Select pricing)
```

---

## Related Configuration Files

| File | Purpose |
|------|---------|
| `src/app.ts` | Router registration: `apiRouter.use('/pricing', pricingRouter)` |
| `.env` | Database credentials (shared with all routes) |
| `tsconfig.json` | TypeScript compilation settings |
| `package.json` | Dependencies: `zod`, `xlsx`, `multer` |

---

## Import Modules (External Dependencies)

### Backend
```typescript
import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { notFound, badRequest } from '../utils/httpErrors.js';
import multer from 'multer';  // File upload (imported inline in /import route)
import XLSX from 'xlsx';      // Excel parsing (imported inline in /import route)
```

### Frontend
```typescript
import { PricingModel, CategoryModel } from '../../models';
import { Pricing, PaginationParams, PaginationResponse } from '../../types';
import { DataTable } from '../../components/UI';
import Swal from 'sweetalert2';
```

---

## Test Files

| File | Purpose |
|------|---------|
| `tests/routes/pricing.test.ts` | (If exists) Unit tests for pricing routes |
| `tests/models/PricingModel.test.ts` | (If exists) Frontend model tests |

---

## Documentation Files

| File | Purpose |
|------|---------|
| `documentation/Pricing/README.md` | Module overview and architecture |
| `documentation/Pricing/FIELDS.md` | Field reference and data dictionary |
| `documentation/Pricing/ROUTES.md` | API endpoint documentation |
| `documentation/Pricing/FILES.md` | **This file** — file reference |
| `documentation/Pricing/PATTERNS.md` | Code patterns and best practices |
| `documentation/Pricing/CHANGES.md` | Change log and migration notes |

---

## Key Code Locations

### Composite Description Field Logic
**File**: `src/routes/pricing.ts`  
**Lines**: ~35-40 (SELECT parsing), ~130-135 (INSERT/UPDATE combining)

**SQL Parsing** (extracting unit and note):
```sql
SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
CASE 
  WHEN p.description LIKE '%|%|%' THEN 
    TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
  ELSE p.description
END as pricing_note
```

**Write Logic** (combining unit and note):
```typescript
description: [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | ')
```

### Excel Import Category Detection
**File**: `src/routes/pricing.ts`  
**Lines**: ~280-295

```typescript
// Category header row: has description but no unit and no price
if ((unit === null || unit === '') && (price === null || price === 0 || isNaN(price as number))) {
  currentCategory = description;
  // Create category if missing...
}
```

### Frontend Pricing List Table
**File**: `src/pages/general/Pricing.tsx`  
**Lines**: ~100-150 (column definitions), ~60-80 (data loading)

### ItemPickerModal Integration
**File**: `src/components/UI/ItemPickerModal.tsx`  
**Lines**: ~45-60 (pricing data fetch), ~80-120 (selection handling)

---

## Build Outputs

### Backend
| Source | Compiled Output |
|--------|-----------------|
| `src/routes/pricing.ts` | `dist/routes/pricing.js` |

### Frontend
| Source | Build Output |
|--------|--------------|
| `src/pages/general/Pricing.tsx` | `build/static/js/main.{hash}.js` (bundled) |
| `src/models/OtherModels.ts` | `build/static/js/main.{hash}.js` (bundled) |

---

## Asset Files

### Excel Import Template
**Recommended location**: `public/templates/pricing_import_template.xlsx`  
**Purpose**: Sample Excel file showing correct format for bulk import

**Template structure**:
```
| ID  | Item Description      | Unit | Unit Price | Notes               |
|-----|-----------------------|------|------------|---------------------|
|     | CATEGORY HEADER       |      |            |                     |
| 1   | Ceramic Wall Tiles    | m²   | 450.00     | Supply and install  |
| 2   | Porcelain Floor Tiles | m²   | 850.00     | Premium range       |
```

---

## Environment Variables

No pricing-specific environment variables. Uses shared database configuration:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=softaware
DB_PASSWORD=softaware
DB_NAME=softaware
```

---

## Logs & Debug Files

### Backend Logs
- `logs/pricing-import.log` — Excel import operations (if implemented)
- PM2 logs: `~/.pm2/logs/softaware-backend-out.log`

### Error Logs
- `~/.pm2/logs/softaware-backend-error.log` — Backend errors

---

## File Size Reference

| File | Type | Size (approx) |
|------|------|---------------|
| `pricing.ts` | TypeScript | 12 KB |
| `pricing.js` (compiled) | JavaScript | 15 KB |
| `Pricing.tsx` | TypeScript JSX | 16 KB |
| Excel import file | XLSX | 50-500 KB (varies) |

---

## Migration Files

**Location**: `database/migrations/`

Expected migration files:
- `001_create_pricing_table.sql`
- `002_add_category_id_to_pricing.sql`
- `003_add_description_composite_field.sql` (if applicable)

**Current Schema**:
```sql
CREATE TABLE pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```
