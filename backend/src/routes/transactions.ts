import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const transactionsRouter = Router();

/**
 * GET /transactions - List all VAT-compliant transactions with pagination and filtering
 */
transactionsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    // Frontend sends 0-based page, convert to 1-based for offset calculation
    const page = parseInt(req.query.page as string) >= 0 ? parseInt(req.query.page as string) + 1 : 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const type = req.query.type as string | undefined;
    const from_date = req.query.from_date as string | undefined;
    const to_date = req.query.to_date as string | undefined;

    let query = 'SELECT * FROM transactions_vat WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND transaction_type = ?';
      params.push(type);
    }

    if (from_date) {
      query += ' AND transaction_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      query += ' AND transaction_date <= ?';
      params.push(to_date);
    }

    // Order by newest first (last to first)
    query += ' ORDER BY transaction_date DESC, transaction_id DESC';
    
    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countResult] = await db.query<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

    // Get paginated results
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const transactions = await db.query(query, params);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: page - 1, // Return 0-based page to match frontend
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /transactions/:id - Get single transaction by ID
 */
transactionsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw badRequest('Invalid transaction ID');
    }

    const transaction = await db.queryOne(
      'SELECT * FROM transactions_vat WHERE transaction_id = ?',
      [id]
    );

    if (!transaction) {
      throw notFound('Transaction not found');
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /transactions - Create a new VAT transaction
 */
transactionsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      transaction_date,
      transaction_type,
      party_name,
      invoice_number,
      vat_type,
      vat_amount,
      exclusive_amount,
      total_amount,
      description,
      payment_method,
      reference_number,
    } = req.body;

    // Validation
    if (!transaction_date || !transaction_type || !party_name) {
      throw badRequest('Missing required fields: transaction_date, transaction_type, party_name');
    }

    if (!['income', 'expense'].includes(transaction_type)) {
      throw badRequest('transaction_type must be "income" or "expense"');
    }

    const insertId = await db.insertOne('transactions_vat', {
      transaction_date,
      transaction_type,
      party_name,
      invoice_number: invoice_number || null,
      vat_type: vat_type || null,
      vat_amount: vat_amount || 0,
      exclusive_amount: exclusive_amount || 0,
      total_amount: total_amount || 0,
      description: description || null,
      payment_method: payment_method || null,
      reference_number: reference_number || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      id: insertId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /transactions/:id - Update a transaction
 */
transactionsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw badRequest('Invalid transaction ID');
    }

    const existing = await db.queryOne(
      'SELECT transaction_id FROM transactions_vat WHERE transaction_id = ?',
      [id]
    );

    if (!existing) {
      throw notFound('Transaction not found');
    }

    const {
      transaction_date,
      transaction_type,
      party_name,
      invoice_number,
      vat_type,
      vat_amount,
      exclusive_amount,
      total_amount,
      description,
      payment_method,
      reference_number,
    } = req.body;

    const updates: any = {};

    if (transaction_date !== undefined) updates.transaction_date = transaction_date;
    if (transaction_type !== undefined) {
      if (!['income', 'expense'].includes(transaction_type)) {
        throw badRequest('transaction_type must be "income" or "expense"');
      }
      updates.transaction_type = transaction_type;
    }
    if (party_name !== undefined) updates.party_name = party_name;
    if (invoice_number !== undefined) updates.invoice_number = invoice_number;
    if (vat_type !== undefined) updates.vat_type = vat_type;
    if (vat_amount !== undefined) updates.vat_amount = vat_amount;
    if (exclusive_amount !== undefined) updates.exclusive_amount = exclusive_amount;
    if (total_amount !== undefined) updates.total_amount = total_amount;
    if (description !== undefined) updates.description = description;
    if (payment_method !== undefined) updates.payment_method = payment_method;
    if (reference_number !== undefined) updates.reference_number = reference_number;

    if (Object.keys(updates).length === 0) {
      throw badRequest('No fields to update');
    }

    updates.updated_at = new Date().toISOString();

    const updateFields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const updateValues = Object.values(updates);
    
    await db.execute(
      `UPDATE transactions_vat SET ${updateFields} WHERE transaction_id = ?`,
      [...updateValues, id]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /transactions/:id - Delete a transaction
 */
transactionsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw badRequest('Invalid transaction ID');
    }

    const affectedRows = await db.execute(
      'DELETE FROM transactions_vat WHERE transaction_id = ?',
      [id]
    );

    if (affectedRows === 0) {
      throw notFound('Transaction not found');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /transactions/clear-income - Clear all income transactions
 * Used to reset before reprocessing payments
 */
transactionsRouter.post('/clear-income', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const affectedRows = await db.execute(
      'DELETE FROM transactions_vat WHERE transaction_type = ?',
      ['income']
    );

    res.json({
      success: true,
      deleted: affectedRows,
    });
  } catch (err) {
    next(err);
  }
});
