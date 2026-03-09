import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { notFound, badRequest } from '../utils/httpErrors.js';

export const pricingRouter = Router();

const createPricingSchema = z.object({
  pricing_category_id: z.number().int().positive().optional().nullable(),
  pricing_item: z.string().min(1),
  pricing_note: z.string().optional().nullable(),
  pricing_price: z.number().nonnegative(),
  pricing_unit: z.string().optional().nullable(),
});

const updatePricingSchema = createPricingSchema.partial();

/**
 * GET /pricing - List pricing items with optional category filter and pagination
 */
pricingRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const category = req.query.category as string | undefined;
    const search = (req.query.search as string) || '';

    let query = `SELECT 
      p.id as pricing_id,
      p.item_name as pricing_item,
      CASE 
        WHEN p.description LIKE '%|%|%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
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
    WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as count FROM pricing p WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (category) {
      query += ' AND p.category_id = ?';
      countQuery += ' AND p.category_id = ?';
      params.push(category);
      countParams.push(category);
    }

    if (search) {
      query += ' AND (p.item_name LIKE ? OR p.description LIKE ?)';
      countQuery += ' AND (p.item_name LIKE ? OR p.description LIKE ?)';
      const searchVal = `%${search}%`;
      params.push(searchVal, searchVal);
      countParams.push(searchVal, searchVal);
    }

    query += ' ORDER BY p.item_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total: countResult?.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pricing/:id - Get single pricing item
 */
pricingRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const item = await db.queryOne<any>(
      `SELECT 
        p.id as pricing_id,
        p.item_name as pricing_item,
        CASE 
          WHEN p.description LIKE '%|%|%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
          ELSE p.description
        END as pricing_note,
        p.unit_price as pricing_price,
        SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
        p.category_id as pricing_category_id,
        c.category_name
      FROM pricing p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?`,
      [id]
    );
    if (!item) {
      throw notFound('Pricing item not found');
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pricing - Create pricing item
 */
pricingRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createPricingSchema.parse(req.body);
    
    // Map frontend field names to database column names
    const dbData = {
      category_id: data.pricing_category_id,
      item_name: data.pricing_item,
      description: [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | '),
      unit_price: data.pricing_price,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const insertId = await db.insertOne('pricing', dbData);
    
    // Return with frontend field names
    const item = await db.queryOne<any>(
      `SELECT 
        p.id as pricing_id,
        p.item_name as pricing_item,
        CASE 
          WHEN p.description LIKE '%|%|%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
          ELSE p.description
        END as pricing_note,
        p.unit_price as pricing_price,
        SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
        p.category_id as pricing_category_id,
        c.category_name
      FROM pricing p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?`,
      [insertId]
    );
    
    res.status(201).json({ success: true, id: parseInt(insertId), data: item });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /pricing/:id - Update pricing item
 */
pricingRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updatePricingSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM pricing WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Pricing item not found');
    }

    // Map frontend field names to database column names
    const dbData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (data.pricing_category_id !== undefined) dbData.category_id = data.pricing_category_id;
    if (data.pricing_item !== undefined) dbData.item_name = data.pricing_item;
    if (data.pricing_price !== undefined) dbData.unit_price = data.pricing_price;
    if (data.pricing_note !== undefined || data.pricing_unit !== undefined) {
      dbData.description = [data.pricing_unit, data.pricing_note].filter(Boolean).join(' | ');
    }

    await db.execute(
      `UPDATE pricing SET ${Object.keys(dbData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(dbData), id]
    );

    // Return with frontend field names
    const updated = await db.queryOne<any>(
      `SELECT 
        p.id as pricing_id,
        p.item_name as pricing_item,
        CASE 
          WHEN p.description LIKE '%|%|%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p.description, ' | ', 2), ' | ', -1))
          ELSE p.description
        END as pricing_note,
        p.unit_price as pricing_price,
        SUBSTRING_INDEX(p.description, ' | ', 1) as pricing_unit,
        p.category_id as pricing_category_id,
        c.category_name
      FROM pricing p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?`,
      [id]
    );
    
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /pricing/:id - Delete pricing item
 */
pricingRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT id FROM pricing WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Pricing item not found');
    }
    await db.execute('DELETE FROM pricing WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pricing item deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pricing/import - Import pricing items from Excel file
 * Expects multipart form with 'file' field (xlsx)
 * Excel format: ID | Item Description | Unit | Unit Price | Notes
 * Category header rows have merged cells (no unit/price) and become category groupings
 */
pricingRouter.post('/import', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const multer = (await import('multer')).default;
    const XLSX = await import('xlsx');
    
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
    
    // Handle file upload inline
    await new Promise<void>((resolve, reject) => {
      upload.single('file')(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const file = (req as any).file;
    if (!file) {
      throw badRequest('No file uploaded');
    }
    
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    let currentCategory = 'Uncategorized';
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    
    // Get or create categories mapping
    const categoryMap = new Map<string, number>();
    const existingCats = await db.query<any>('SELECT id, category_name FROM categories');
    for (const cat of existingCats) {
      categoryMap.set(cat.category_name.toLowerCase(), cat.id);
    }
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue; // skip empty rows
      
      // Skip header row
      if (i === 0 && String(row[1]).toLowerCase().includes('item') && String(row[0]).toLowerCase() === 'id') {
        continue;
      }
      
      const id = row[0];
      const description = row[1] ? String(row[1]).trim() : '';
      const unit = row[2] ? String(row[2]).trim() : null;
      const price = row[3] !== null && row[3] !== undefined ? Number(row[3]) : null;
      const notes = row[4] ? String(row[4]).trim() : null;
      
      if (!description) continue;
      
      // Category header row: has description but no unit and no price
      if ((unit === null || unit === '') && (price === null || price === 0 || isNaN(price as number))) {
        currentCategory = description;
        
        // Ensure category exists
        if (!categoryMap.has(currentCategory.toLowerCase())) {
          const catId = await db.insertOne('categories', {
            category_name: currentCategory,
            description: currentCategory,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          categoryMap.set(currentCategory.toLowerCase(), parseInt(catId));
        }
        continue;
      }
      
      // Data row
      const categoryId = categoryMap.get(currentCategory.toLowerCase()) || null;
      const descriptionField = [unit, notes, currentCategory].filter(Boolean).join(' | ');
      
      // Check if item already exists by id or item_name
      const existing = await db.queryOne<any>(
        'SELECT id FROM pricing WHERE id = ? OR item_name = ?',
        [id, description]
      );
      
      if (existing) {
        // Update existing
        await db.execute(
          'UPDATE pricing SET item_name = ?, unit_price = ?, description = ?, category_id = ?, updated_at = ? WHERE id = ?',
          [description, price || 0, descriptionField, categoryId, new Date().toISOString(), existing.id]
        );
        updated++;
      } else {
        // Insert new
        await db.insertOne('pricing', {
          item_name: description,
          unit_price: price || 0,
          description: descriptionField,
          category_id: categoryId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        imported++;
      }
    }
    
    res.json({
      success: true,
      message: `Import complete: ${imported} new, ${updated} updated, ${skipped} skipped`,
      imported,
      updated,
      skipped,
    });
  } catch (err) {
    next(err);
  }
});
