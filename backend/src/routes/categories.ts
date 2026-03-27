import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const categoriesRouter = Router();

const createCategorySchema = z.object({
  category_name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const updateCategorySchema = createCategorySchema.partial();

/**
 * GET /categories - List all categories
 */
categoriesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = page * limit;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'category_name';
    const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'DESC' : 'ASC';

    // Whitelist sort columns
    const allowedSorts = ['category_name', 'id', 'created_at'];
    const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'category_name';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      whereClause += ' AND category_name LIKE ?';
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    const countResult = await db.queryOne<any>(
      `SELECT COUNT(*) as total FROM categories${whereClause}`,
      countParams
    );
    const total = countResult?.total || 0;

    const categories = await db.query<any>(
      `SELECT id AS category_id, category_name, description, created_at, updated_at FROM categories${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /categories/:id - Get single category
 */
categoriesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const category = await db.queryOne<any>('SELECT id AS category_id, category_name, description, created_at, updated_at FROM categories WHERE id = ?', [id]);
    if (!category) {
      throw notFound('Category not found');
    }
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /categories - Create category
 */
categoriesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createCategorySchema.parse(req.body);

    // Check uniqueness
    const existing = await db.queryOne('SELECT id FROM categories WHERE category_name = ?', [data.category_name]);
    if (existing) {
      throw badRequest('Category name already exists');
    }

    const insertId = await db.insertOne('categories', {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const category = await db.queryOne<any>('SELECT * FROM categories WHERE id = ?', [insertId]);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /categories/:id - Update category
 */
categoriesRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Category not found');
    }

    const updateData = { ...data, updated_at: new Date().toISOString() };
    await db.execute(
      `UPDATE categories SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    const updated = await db.queryOne<any>('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /categories/:id - Delete category
 */
categoriesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Category not found');
    }

    // Check if category is in use by pricing items
    const inUse = await db.queryOne<any>('SELECT COUNT(*) as count FROM pricing WHERE category_id = ? AND is_deleted = 0', [id]);
    if (inUse && inUse.count > 0) {
      throw badRequest('Category is in use by pricing items and cannot be deleted');
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});
