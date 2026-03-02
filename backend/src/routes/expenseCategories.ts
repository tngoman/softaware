import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const expenseCategoriesRouter = Router();

const createSchema = z.object({
  category_name: z.string().min(1),
  account_id: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  active: z.number().default(1),
});

const updateSchema = createSchema.partial();

/**
 * GET /expense-categories - List all expense categories
 */
expenseCategoriesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;

    const categories = await db.query<any>(
      'SELECT ec.*, a.account_name, a.account_code FROM expense_categories ec LEFT JOIN accounts a ON ec.account_id = a.id WHERE ec.active = 1 ORDER BY ec.category_name ASC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countResult = await db.queryOne<any>(
      'SELECT COUNT(*) as count FROM expense_categories WHERE active = 1'
    );

    res.json({
      success: true,
      data: categories,
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
 * GET /expense-categories/:id - Get single expense category
 */
expenseCategoriesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const category = await db.queryOne<any>(
      'SELECT ec.*, a.account_name, a.account_code FROM expense_categories ec LEFT JOIN accounts a ON ec.account_id = a.id WHERE ec.id = ?',
      [id]
    );
    if (!category) {
      throw notFound('Expense category not found');
    }
    res.json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /expense-categories - Create expense category
 */
expenseCategoriesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM expense_categories WHERE category_name = ?', [data.category_name]);
    if (existing) {
      throw badRequest('Expense category name already exists');
    }

    const insertId = await db.insertOne('expense_categories', {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const category = await db.queryOne<any>('SELECT * FROM expense_categories WHERE id = ?', [insertId]);
    res.status(201).json({ success: true, id: parseInt(insertId), data: category });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /expense-categories/:id - Update expense category
 */
expenseCategoriesRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM expense_categories WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Expense category not found');
    }

    const updateData = { ...data, updated_at: new Date().toISOString() };
    await db.execute(
      `UPDATE expense_categories SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    const updated = await db.queryOne<any>('SELECT * FROM expense_categories WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /expense-categories/:id - Soft delete expense category
 */
expenseCategoriesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT id FROM expense_categories WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Expense category not found');
    }

    await db.execute(
      'UPDATE expense_categories SET active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    res.json({ success: true, message: 'Expense category deleted' });
  } catch (err) {
    next(err);
  }
});
