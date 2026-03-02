import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { notFound } from '../utils/httpErrors.js';

export const pricingRouter = Router();

const createPricingSchema = z.object({
  category_id: z.number().int().positive().optional().nullable(),
  item_name: z.string().min(1),
  description: z.string().optional().nullable(),
  unit_price: z.number().nonnegative(),
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

    let query = 'SELECT p.*, c.category_name FROM pricing p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
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
      'SELECT p.*, c.category_name FROM pricing p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
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
    const insertId = await db.insertOne('pricing', {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const item = await db.queryOne<any>('SELECT * FROM pricing WHERE id = ?', [insertId]);
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

    const updateData = { ...data, updated_at: new Date().toISOString() };
    await db.execute(
      `UPDATE pricing SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    const updated = await db.queryOne<any>('SELECT * FROM pricing WHERE id = ?', [id]);
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
