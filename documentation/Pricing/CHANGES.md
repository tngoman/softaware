# Pricing — Change Log

## Current State (March 2026)

**Database**: 210 pricing items across multiple categories  
**Schema Version**: v2.1 (composite description field)  
**Router**: `/v1/pricing` with 6 endpoints (350 LOC)  
**Frontend**: Pricing management page (451 LOC) + ItemPickerModal integration

---

## Version History

### v2.1 — Current Production (March 2026)
**Status**: ✅ Active

**Features**:
- Excel import with automatic category detection
- Composite description field (`unit | note` parsing)
- Category-based filtering and grouping
- Search by item name or description
- Integration with quotation/invoice line items via ItemPickerModal

**Schema**:
```sql
CREATE TABLE pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT NULL,           -- Composite: "unit | note"
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
```

**Known Issues**:
- LIKE search on composite description field can be slow for >1000 items
- No soft delete — deleted items permanently removed
- Excel import creates duplicate categories if naming inconsistent

---

### v2.0 — Category Integration (February 2026)
**Status**: ⏸️ Superseded by v2.1

**Changes**:
- Added `category_id` foreign key to `pricing` table
- Created `categories` table for pricing groupings
- Added category filter to GET /pricing endpoint
- Updated frontend with category dropdown

**Migration**:
```sql
ALTER TABLE pricing ADD COLUMN category_id INT NULL;
ALTER TABLE pricing ADD FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
```

**Breaking Changes**:
- API response now includes `category_name` field
- Frontend must handle `pricing_category_id` in create/update forms

---

### v1.5 — Excel Import (January 2026)
**Status**: ⏸️ Superseded by v2.0

**Changes**:
- Added POST /pricing/import endpoint
- Implemented Excel file parsing with `xlsx` library
- Added upsert logic (update if exists, insert if new)
- Category header detection based on missing unit/price

**Dependencies Added**:
- `xlsx` — Excel file parsing
- `multer` — File upload handling

**Migration**: None (new feature, no schema changes)

---

### v1.0 — Initial Implementation (December 2025)
**Status**: ⏸️ Superseded by v1.5

**Features**:
- Basic CRUD operations on pricing items
- Pagination and search
- Field name mapping (frontend ↔ database)
- Composite description field with SQL parsing

**Initial Schema**:
```sql
CREATE TABLE pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME,
  updated_at DATETIME
);
```

---

## Planned Changes

### v3.0 — Schema Normalization (Planned: Q2 2026)
**Goal**: Improve search performance and simplify queries

**Planned Changes**:
1. **Separate unit and note columns**:
```sql
ALTER TABLE pricing 
  ADD COLUMN unit VARCHAR(50),
  ADD COLUMN note TEXT;

-- Migrate data
UPDATE pricing 
SET unit = SUBSTRING_INDEX(description, ' | ', 1),
    note = CASE 
      WHEN description LIKE '%|%' THEN 
        SUBSTRING_INDEX(SUBSTRING_INDEX(description, ' | ', 2), ' | ', -1)
      ELSE NULL
    END;

-- Drop composite field
ALTER TABLE pricing DROP COLUMN description;
```

2. **Add full-text indexes**:
```sql
ALTER TABLE pricing ADD FULLTEXT INDEX ft_search (item_name, note);
```

3. **Update route handlers** to use new columns instead of parsing

**Breaking Changes**:
- API response structure remains same (field names unchanged)
- Backend query logic simplified (no SUBSTRING_INDEX)
- Excel import must map to new columns

**Migration Strategy**:
- Run data migration script (extract unit/note from description)
- Deploy new backend code with updated queries
- Frontend requires no changes (field names unchanged)

---

### v2.2 — Soft Delete (Planned: Q2 2026)
**Goal**: Prevent data loss when pricing items deleted

**Planned Changes**:
```sql
ALTER TABLE pricing ADD COLUMN deleted_at DATETIME NULL;
```

**Route Changes**:
- DELETE endpoint sets `deleted_at` instead of hard delete
- GET endpoints filter `WHERE deleted_at IS NULL`
- Add GET /pricing/deleted endpoint for recovery

**Migration**: None (additive change)

---

## Migration Notes

### Migrating from v1.0 to v2.0 (Category Integration)
1. Create `categories` table (if not exists)
2. Add `category_id` column to `pricing`
3. Optionally populate categories from existing description field:
```sql
INSERT INTO categories (category_name, created_at, updated_at)
SELECT DISTINCT 
  SUBSTRING_INDEX(SUBSTRING_INDEX(description, ' | ', -1), ' | ', 1),
  NOW(),
  NOW()
FROM pricing 
WHERE description LIKE '%|%|%';
```
4. Update pricing items with category associations

### Migrating to v3.0 (when released)
1. Backup `pricing` table
2. Run schema migration (add unit/note columns)
3. Run data migration (extract from description)
4. Deploy new backend
5. Verify data integrity
6. Drop description column

---

## Data Fixes & Cleanups

### March 2026 — Import from SQL Dump
**Issue**: Pricing data replaced with exact records from `tb_pricing` backup  
**Action**: Imported 210 pricing items from `desilope_softaware.sql` with original IDs preserved  
**Result**: All pricing items match production SQL dump exactly

**Script Used**:
```sql
-- Import from temporary table
INSERT INTO pricing (id, category_id, item_name, description, unit_price, created_at, updated_at)
SELECT id, category_id, item_name, description, unit_price, created_at, updated_at
FROM tb_pricing
WHERE id NOT IN (SELECT id FROM pricing);
```

---

### February 2026 — Category Cleanup
**Issue**: Duplicate categories created during Excel imports (e.g., "Tiling" vs "TILING")  
**Action**: Merged duplicate categories, updated pricing items  
**Result**: Reduced from 45 to 32 unique categories

**Script Used**:
```sql
-- Find duplicates (case-insensitive)
SELECT LOWER(category_name), COUNT(*) 
FROM categories 
GROUP BY LOWER(category_name) 
HAVING COUNT(*) > 1;

-- Merge manually (example)
UPDATE pricing SET category_id = 5 WHERE category_id = 12;
DELETE FROM categories WHERE id = 12;
```

---

### January 2026 — Price Corrections
**Issue**: Some prices imported from Excel had incorrect decimal places (450 instead of 450.00)  
**Action**: Re-imported affected rows with correct precision  
**Result**: All prices now display correctly with 2 decimal places

---

## Breaking Changes Log

### v2.0 → v2.1 (No Breaking Changes)
- Added Excel import endpoint (new feature)
- API response structure unchanged
- Frontend compatible with v2.0

### v1.5 → v2.0 (Minor Breaking Change)
- **Added field**: `category_name` in API response
- **Frontend impact**: Must display category name in UI
- **Migration required**: Yes (add category_id column)

### v1.0 → v1.5 (No Breaking Changes)
- Added Excel import (new feature only)
- Existing CRUD endpoints unchanged

---

## Database Statistics

| Date | Pricing Items | Categories | Avg Items/Category |
|------|---------------|------------|-------------------|
| March 2026 | 210 | 32 | 6.6 |
| February 2026 | 198 | 32 | 6.2 |
| January 2026 | 185 | 45 | 4.1 |
| December 2025 | 120 | 28 | 4.3 |

---

## Known Issues & Workarounds

### Issue #1: Search Performance on Large Catalogs
**Status**: 🟡 Open  
**Severity**: Medium  
**Affects**: Catalogs with >1000 items  
**Workaround**: Use category filter to narrow results before searching  
**Fix**: Planned in v3.0 (full-text indexes)

### Issue #2: Duplicate Categories on Import
**Status**: 🟡 Open  
**Severity**: Low  
**Affects**: Excel imports with inconsistent category naming  
**Workaround**: Manually merge categories after import  
**Fix**: Add category name normalization in import logic

### Issue #3: Hard Delete Loses Historical Data
**Status**: 🟡 Open  
**Severity**: Low  
**Affects**: Deleted pricing items cannot be recovered  
**Workaround**: Manual database backup before bulk deletions  
**Fix**: Planned in v2.2 (soft delete)

---

## Deprecation Notices

None currently. All v2.1 endpoints are stable and actively maintained.

---

## Rollback Procedures

### Rolling Back from v2.1 to v2.0
1. Backup current pricing data
2. Remove Excel import endpoint from routes
3. Remove `multer` and `xlsx` dependencies
4. Deploy previous backend version
5. No schema changes needed (v2.1 only added features)

### Rolling Back from v2.0 to v1.5
1. Backup pricing data
2. Drop `category_id` foreign key constraint
3. Drop `category_id` column
4. Deploy previous backend version
5. Remove category filter from frontend

---

## Contact & Support

**Module Owner**: Backend Team  
**Documentation**: `/var/opt/documentation/Pricing/`  
**Issue Tracker**: (Link to issue tracker if applicable)  
**Last Updated**: March 4, 2026
