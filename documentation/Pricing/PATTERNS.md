# Pricing — Code Patterns & Best Practices

## Common Patterns

### 1. Composite Field Handling Pattern

**Problem**: The `pricing.description` field stores multiple values: `unit | note | category`

**Read Pattern** (extracting fields on SELECT):
```sql
SELECT 
  -- Extract unit (first segment)
  SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
  
  -- Extract note (second segment, handling cases with/without pipe)
  CASE 
    WHEN p.description LIKE '%|%|%' THEN 
      TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
    ELSE p.description
  END as pricing_note,
  
  p.unit_price as pricing_price,
  p.item_name as pricing_item
FROM pricing p
```

**Write Pattern** (combining fields on INSERT/UPDATE):
```typescript
const dbData = {
  item_name: data.pricing_item,
  description: [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | '),
  unit_price: data.pricing_price,
  category_id: data.pricing_category_id
};
```

**Best Practice**: When querying multiple times, create a VIEW or SQL function to avoid repeating the parsing logic.

---

### 2. Excel Import with Category Detection

**Pattern**: Detect category header rows vs data rows based on field presence

```typescript
for (const row of rows) {
  const description = row[1];
  const unit = row[2];
  const price = row[3];
  
  // Category header: has description but no unit and no/zero price
  if ((unit === null || unit === '') && 
      (price === null || price === 0 || isNaN(price))) {
    currentCategory = description;
    
    // Ensure category exists
    if (!categoryMap.has(currentCategory.toLowerCase())) {
      const catId = await db.insertOne('categories', {
        category_name: currentCategory,
        created_at: new Date().toISOString()
      });
      categoryMap.set(currentCategory.toLowerCase(), parseInt(catId));
    }
    continue;  // Skip to next row
  }
  
  // Data row: process as pricing item
  const categoryId = categoryMap.get(currentCategory.toLowerCase());
  // ... insert or update pricing item
}
```

**Best Practice**: 
- Use lowercase keys in category map to avoid case sensitivity issues
- Pre-load existing categories into Map for performance
- Validate row data before processing to avoid partial imports

---

### 3. Upsert Pattern (Update if exists, Insert if not)

**Pattern**: Check existence before deciding to INSERT or UPDATE

```typescript
// Check if item exists (by ID or item_name)
const existing = await db.queryOne<any>(
  'SELECT id FROM pricing WHERE id = ? OR item_name = ?',
  [itemId, itemName]
);

if (existing) {
  // Update existing record
  await db.execute(
    'UPDATE pricing SET item_name = ?, unit_price = ?, description = ?, updated_at = ? WHERE id = ?',
    [itemName, price, description, new Date().toISOString(), existing.id]
  );
  updated++;
} else {
  // Insert new record
  await db.insertOne('pricing', {
    item_name: itemName,
    unit_price: price,
    description,
    category_id: categoryId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  imported++;
}
```

**Best Practice**: 
- Use transactions for bulk operations
- Return statistics (imported, updated, skipped) for user feedback
- Consider MySQL's `ON DUPLICATE KEY UPDATE` for better performance

---

### 4. Frontend Field Name Mapping

**Pattern**: Map between frontend-friendly names and database column names

```typescript
// Frontend → Database (on write)
const dbData = {
  category_id: data.pricing_category_id,
  item_name: data.pricing_item,
  description: [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | '),
  unit_price: data.pricing_price
};

// Database → Frontend (on read via SQL aliases)
SELECT 
  p.id as pricing_id,
  p.item_name as pricing_item,
  p.unit_price as pricing_price,
  p.category_id as pricing_category_id
FROM pricing p
```

**Best Practice**: 
- Keep mapping logic in one place (route handler or dedicated mapper function)
- Document the mapping in FIELDS.md
- Use TypeScript types to enforce correct field names

---

### 5. ItemPickerModal Integration Pattern

**Pattern**: Reusable modal for selecting pricing items in quotations/invoices

```typescript
// Parent component (InvoiceForm.tsx)
const [showItemPicker, setShowItemPicker] = useState(false);

const handleItemSelected = (item: Pricing) => {
  setFormData({
    ...formData,
    item_description: item.pricing_item,
    item_price: item.pricing_price,
    item_quantity: 1,
    // ... other fields
  });
  setShowItemPicker(false);
};

return (
  <>
    <button onClick={() => setShowItemPicker(true)}>
      Select from Pricing Catalog
    </button>
    
    <ItemPickerModal
      isOpen={showItemPicker}
      onClose={() => setShowItemPicker(false)}
      onSelect={handleItemSelected}
    />
  </>
);
```

**ItemPickerModal** loads all pricing items on mount and provides search:

```typescript
const [pricingItems, setPricingItems] = useState<Pricing[]>([]);
const [search, setSearch] = useState('');

useEffect(() => {
  const loadPricing = async () => {
    const data = await PricingModel.getAll(undefined, { page: 0, limit: 10000 });
    setPricingItems(data.data || []);
  };
  if (isOpen) loadPricing();
}, [isOpen]);

const filtered = pricingItems.filter(item => 
  item.pricing_item.toLowerCase().includes(search.toLowerCase())
);
```

**Best Practice**:
- Load items on modal open, not on component mount
- Use large limit (10000) or implement server-side search for big catalogs
- Cache items during session to avoid repeated API calls

---

### 6. Zod Validation with Field Name Mapping

**Pattern**: Validate frontend field names, then map to database columns

```typescript
const createPricingSchema = z.object({
  pricing_category_id: z.number().int().positive().optional().nullable(),
  pricing_item: z.string().min(1),
  pricing_note: z.string().optional().nullable(),
  pricing_price: z.number().nonnegative(),
  pricing_unit: z.string().optional().nullable(),
});

export const create = async (req: Request, res: Response) => {
  // Validate with frontend field names
  const data = createPricingSchema.parse(req.body);
  
  // Map to database column names
  const dbData = {
    category_id: data.pricing_category_id,
    item_name: data.pricing_item,
    description: [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | '),
    unit_price: data.pricing_price,
  };
  
  const insertId = await db.insertOne('pricing', dbData);
  
  // Return with frontend field names (via SELECT with aliases)
  const created = await db.queryOne('{PRICING_SELECT}', [insertId]);
  res.json({ success: true, data: created });
};
```

**Best Practice**:
- Validate early with Zod (at route entry point)
- Use descriptive validation error messages
- Always return data with consistent field names (frontend format)

---

### 7. Category-Based Filtering Pattern

**Pattern**: Filter pricing items by category with optional "All Categories" view

**Frontend**:
```typescript
const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

const loadPricing = async () => {
  const params: any = { page, limit };
  if (selectedCategory) params.category = selectedCategory;
  
  const data = await PricingModel.getAll(params);
  setPricingItems(data);
};

// Category dropdown
<select onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}>
  <option value="">All Categories</option>
  {categories.map(cat => (
    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
  ))}
</select>
```

**Backend**:
```typescript
const category = req.query.category as string | undefined;
let query = 'SELECT {PRICING_SELECT} FROM pricing p WHERE 1=1';
const params: any[] = [];

if (category) {
  query += ' AND p.category_id = ?';
  params.push(category);
}
```

**Best Practice**:
- Use `null` for "All Categories" (not 0 or empty string)
- Provide category counts: `SELECT category_id, COUNT(*) FROM pricing GROUP BY category_id`
- Consider caching category list on frontend

---

### 8. Search Performance Pattern

**Problem**: `LIKE '%search%'` on composite description field is slow for large datasets

**Current Implementation** (acceptable for <1000 items):
```sql
WHERE (p.item_name LIKE ? OR p.description LIKE ?)
```

**Optimized Pattern** (for 1000+ items):

1. **Full-text index** (MySQL):
```sql
ALTER TABLE pricing ADD FULLTEXT INDEX ft_item_search (item_name, description);

SELECT {PRICING_SELECT} FROM pricing p
WHERE MATCH(p.item_name, p.description) AGAINST (? IN BOOLEAN MODE)
```

2. **Separate unit/note columns** (schema change):
```sql
ALTER TABLE pricing 
  ADD COLUMN unit VARCHAR(50),
  ADD COLUMN note TEXT;

-- Migrate data
UPDATE pricing 
SET unit = SUBSTRING_INDEX(description, ' | ', 1),
    note = SUBSTRING_INDEX(SUBSTRING_INDEX(description, ' | ', 2), ' | ', -1);

-- Drop composite field
ALTER TABLE pricing DROP COLUMN description;

-- Search query
WHERE (item_name LIKE ? OR unit LIKE ? OR note LIKE ?)
```

3. **Client-side filtering** (for small datasets):
```typescript
// Load all items once
const allItems = await PricingModel.getAll(undefined, { page: 0, limit: 10000 });

// Filter locally
const filtered = allItems.filter(item => 
  item.pricing_item.toLowerCase().includes(search.toLowerCase()) ||
  item.pricing_note?.toLowerCase().includes(search.toLowerCase())
);
```

**Best Practice**: Choose strategy based on dataset size:
- <500 items: Current LIKE pattern is fine
- 500-2000 items: Client-side filtering
- 2000+ items: Full-text index or separate columns

---

### 9. Error Handling Pattern

**Pattern**: Consistent error responses with proper HTTP status codes

```typescript
try {
  const data = createPricingSchema.parse(req.body);
  
  // Business logic...
  const existing = await db.queryOne('SELECT id FROM pricing WHERE id = ?', [id]);
  if (!existing) {
    throw notFound('Pricing item not found');  // 404
  }
  
  // Success response
  res.json({ success: true, data: result });
  
} catch (err) {
  // Zod validation errors → 400
  if (err instanceof z.ZodError) {
    return res.status(400).json({ 
      error: 'BAD_REQUEST', 
      message: err.errors[0].message 
    });
  }
  
  // Custom HttpErrors → proper status code
  if (err.status) {
    return res.status(err.status).json({ 
      error: err.code, 
      message: err.message 
    });
  }
  
  // Unknown errors → 500
  next(err);
}
```

**Best Practice**:
- Use `throw` instead of `return res.status()` for cleaner control flow
- Define custom error classes (`notFound`, `badRequest`, `unauthorized`)
- Let Express error handler catch unhandled errors
- Log errors but don't expose internal details to client

---

### 10. File Upload Security Pattern

**Pattern**: Validate file type, size, and content before processing

```typescript
const multer = (await import('multer')).default;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024  // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept Excel files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files allowed.'));
    }
  }
});

// Validate file exists
const file = (req as any).file;
if (!file) {
  throw badRequest('No file uploaded');
}

// Validate Excel structure
const workbook = XLSX.read(file.buffer, { type: 'buffer' });
if (!workbook.SheetNames.length) {
  throw badRequest('Excel file has no sheets');
}
```

**Best Practice**:
- Validate MIME type and file extension
- Set reasonable file size limits
- Use memory storage for temporary files
- Validate content structure before processing
- Sanitize filename if storing on disk

---

## Anti-Patterns to Avoid

### ❌ Loading All Items Without Pagination
```typescript
// BAD: Loads all 10,000 items every time
const items = await db.query('SELECT * FROM pricing');
```

**Solution**: Always use pagination with reasonable defaults:
```typescript
// GOOD
const page = parseInt(req.query.page as string) || 1;
const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
```

---

### ❌ N+1 Query Problem
```typescript
// BAD: Separate query for each item's category
for (const item of items) {
  const category = await db.queryOne('SELECT category_name FROM categories WHERE id = ?', [item.category_id]);
  item.category_name = category?.category_name;
}
```

**Solution**: Use JOINs in the main query:
```typescript
// GOOD
SELECT p.*, c.category_name 
FROM pricing p 
LEFT JOIN categories c ON p.category_id = c.id
```

---

### ❌ Exposing Database Column Names to Frontend
```typescript
// BAD: Frontend must know database schema
res.json({ item_name: 'Tiles', unit_price: 450 });
```

**Solution**: Use consistent field aliases:
```typescript
// GOOD: Frontend uses business-friendly names
SELECT 
  p.id as pricing_id,
  p.item_name as pricing_item,
  p.unit_price as pricing_price
FROM pricing p
```

---

### ❌ Mutating Composite Field Without Rewriting Full Value
```typescript
// BAD: Only updates unit, loses note
UPDATE pricing SET description = 'kg' WHERE id = 1
```

**Solution**: Always read-modify-write composite fields:
```typescript
// GOOD: Preserve all segments
const existing = await db.queryOne('SELECT description FROM pricing WHERE id = ?', [id]);
const [oldUnit, oldNote] = existing.description.split(' | ');
const newDescription = [newUnit || oldUnit, newNote || oldNote].join(' | ');
UPDATE pricing SET description = newDescription WHERE id = 1
```

---

## Testing Patterns

### Unit Test Pattern
```typescript
describe('POST /pricing', () => {
  it('should create pricing item with unit and note', async () => {
    const response = await request(app)
      .post('/v1/pricing')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        pricing_item: 'Test Item',
        pricing_unit: 'kg',
        pricing_note: 'Test note',
        pricing_price: 100,
        pricing_category_id: 1
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.pricing_item).toBe('Test Item');
    expect(response.body.data.pricing_unit).toBe('kg');
    expect(response.body.data.pricing_note).toBe('Test note');
  });
});
```

### Integration Test Pattern
```typescript
describe('Excel Import Flow', () => {
  it('should import pricing items with category detection', async () => {
    const testFile = generateTestExcelFile([
      ['', 'TILING', '', '', ''],  // Category header
      ['1', 'Ceramic Tiles', 'm²', '450', 'Supply only']
    ]);
    
    const response = await request(app)
      .post('/v1/pricing/import')
      .set('Authorization', `Bearer ${testToken}`)
      .attach('file', testFile);
    
    expect(response.body.imported).toBe(1);
    
    // Verify category was created
    const category = await db.queryOne('SELECT id FROM categories WHERE category_name = ?', ['TILING']);
    expect(category).toBeTruthy();
  });
});
```
