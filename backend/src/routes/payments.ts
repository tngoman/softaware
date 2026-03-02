import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const paymentsRouter = Router();

// SQL fragment that aliases payment columns to match the frontend Payment interface
const PAYMENT_SELECT = `
  p.id            AS payment_id,
  p.invoice_id    AS payment_invoice,
  p.payment_date,
  p.payment_amount,
  p.payment_method,
  p.reference_number,
  p.remarks       AS payment_notes,
  0               AS payment_processed,
  UNIX_TIMESTAMP(p.created_at)  AS payment_time,
  UNIX_TIMESTAMP(p.updated_at)  AS payment_updated
`;

const createPaymentSchema = z.object({
  payment_invoice: z.number().int().positive(),
  payment_amount: z.number().positive(),
  payment_date: z.string().optional(),
  process_payment: z.boolean().optional(),
});

const updatePaymentSchema = z.object({
  payment_invoice: z.number().int().positive().optional(),
  payment_amount: z.number().positive().optional(),
  payment_date: z.string().optional(),
  payment_processed: z.number().int().optional(),
});

/**
 * GET /payments - List all payments with pagination
 */
paymentsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const invoice_id = req.query.invoice_id ? parseInt(req.query.invoice_id as string) : undefined;

    let query = `SELECT ${PAYMENT_SELECT}, i.invoice_number FROM payments p LEFT JOIN invoices i ON p.invoice_id = i.id WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) as count FROM payments p WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (invoice_id) {
      query += ' AND p.invoice_id = ?';
      countQuery += ' AND p.invoice_id = ?';
      params.push(invoice_id);
      countParams.push(invoice_id);
    }

    if (search) {
      query += ' AND (p.reference_number LIKE ? OR p.remarks LIKE ? OR i.invoice_number LIKE ?)';
      countQuery += ' AND (p.reference_number LIKE ? OR p.remarks LIKE ?)';
      const searchVal = `%${search}%`;
      params.push(searchVal, searchVal, searchVal);
      countParams.push(searchVal, searchVal);
    }

    query += ' ORDER BY p.payment_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const payments = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: payments,
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
 * GET /payments/unprocessed - Get unprocessed payments
 */
paymentsRouter.get('/unprocessed', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const invoice_id = req.query.invoice_id ? parseInt(req.query.invoice_id as string) : undefined;

    let query = `
      SELECT ${PAYMENT_SELECT}, i.invoice_number, i.invoice_amount
      FROM payments p 
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (invoice_id) {
      query += ' AND p.invoice_id = ?';
      params.push(invoice_id);
    }

    query += ' ORDER BY p.payment_date DESC LIMIT ?';
    params.push(limit);

    const payments = await db.query<any>(query, params);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /payments/invoice/:invoiceId - Get payments for specific invoice
 */
paymentsRouter.get('/invoice/:invoiceId', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { invoiceId } = req.params;
    const payments = await db.query<any>(
      `SELECT ${PAYMENT_SELECT} FROM payments p WHERE p.invoice_id = ? ORDER BY p.payment_date DESC`,
      [invoiceId]
    );
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /payments/:id - Get single payment
 */
paymentsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const payment = await db.queryOne<any>(`SELECT ${PAYMENT_SELECT} FROM payments p WHERE p.id = ?`, [id]);
    if (!payment) {
      throw notFound('Payment not found');
    }
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payments - Create payment
 */
paymentsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);

    // Verify invoice exists
    const invoice = await db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [data.payment_invoice]);
    if (!invoice) {
      throw badRequest('Invoice not found');
    }

    const insertId = await db.insertOne('payments', {
      invoice_id: data.payment_invoice,
      payment_amount: data.payment_amount,
      payment_date: data.payment_date || new Date().toISOString().split('T')[0],
      payment_method: null,
      reference_number: null,
      remarks: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Check if invoice is fully paid
    const totalPaidResult = await db.queryOne<any>(
      'SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?',
      [data.payment_invoice]
    );
    const totalPaid = totalPaidResult?.total_paid || 0;
    if (totalPaid >= invoice.invoice_amount) {
      await db.execute(
        'UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), data.payment_invoice]
      );
    }

    const payment = await db.queryOne<any>(`SELECT ${PAYMENT_SELECT} FROM payments p WHERE p.id = ?`, [insertId]);
    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /payments/:id - Update payment
 */
paymentsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updatePaymentSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM payments WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Payment not found');
    }

    const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.payment_invoice !== undefined) updateFields.invoice_id = data.payment_invoice;
    if (data.payment_amount !== undefined) updateFields.payment_amount = data.payment_amount;
    if (data.payment_date !== undefined) updateFields.payment_date = data.payment_date;

    await db.execute(
      `UPDATE payments SET ${Object.keys(updateFields).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateFields), id]
    );

    const updated = await db.queryOne<any>(`SELECT ${PAYMENT_SELECT} FROM payments p WHERE p.id = ?`, [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /payments/:id - Delete payment
 */
paymentsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT id FROM payments WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Payment not found');
    }
    await db.execute('DELETE FROM payments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payments/process - Process payments (create corresponding transactions)
 */
paymentsRouter.post('/process', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { payment_ids, invoice_id } = req.body;

    let paymentsToProcess: any[] = [];

    if (payment_ids && Array.isArray(payment_ids) && payment_ids.length > 0) {
      const placeholders = payment_ids.map(() => '?').join(',');
      paymentsToProcess = await db.query<any>(
        `SELECT * FROM payments WHERE id IN (${placeholders})`,
        payment_ids
      );
    } else if (invoice_id) {
      paymentsToProcess = await db.query<any>(
        'SELECT * FROM payments WHERE invoice_id = ?',
        [invoice_id]
      );
    } else {
      throw badRequest('Either payment_ids or invoice_id is required');
    }

    const processed: Array<{ payment_id: number; transaction_id?: number }> = [];
    const errors: Array<{ payment_id: number; message: string }> = [];

    for (const payment of paymentsToProcess) {
      try {
        // Create a transaction for this payment
        const transactionId = await db.insertOne('transactions', {
          transaction_date: payment.payment_date,
          account_id: 1, // Default income account - should be configurable
          debit_amount: 0,
          credit_amount: payment.payment_amount,
          description: `Payment for invoice #${payment.invoice_id}`,
          reference_number: payment.reference_number || `PAY-${payment.id}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        processed.push({ payment_id: payment.id, transaction_id: parseInt(transactionId) });
      } catch (err: any) {
        errors.push({ payment_id: payment.id, message: err.message || 'Unknown error' });
      }
    }

    res.json({ success: true, processed, errors });
  } catch (err) {
    next(err);
  }
});
