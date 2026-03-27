import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';

export const paymentsRouter = Router();

// All payment routes require admin
paymentsRouter.use(requireAuth, requireAdmin);

// SQL fragment that aliases payment columns to match the frontend Payment interface
const PAYMENT_SELECT = `
  p.id            AS payment_id,
  p.invoice_id    AS payment_invoice,
  p.payment_date,
  p.payment_amount,
  p.payment_method,
  p.reference_number,
  p.remarks       AS payment_notes,
  p.processed     AS payment_processed,
  p.transaction_id,
  UNIX_TIMESTAMP(p.created_at)  AS payment_time,
  UNIX_TIMESTAMP(p.updated_at)  AS payment_updated
`;

const createPaymentSchema = z.object({
  payment_invoice: z.coerce.number().int().positive(),
  payment_amount: z.coerce.number().positive(),
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
paymentsRouter.get('/', async (req: AuthRequest, res: Response, next) => {
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
paymentsRouter.get('/unprocessed', async (req: AuthRequest, res: Response, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const invoice_id = req.query.invoice_id ? parseInt(req.query.invoice_id as string) : undefined;

    let query = `
      SELECT ${PAYMENT_SELECT}, i.invoice_number, i.invoice_amount
      FROM payments p 
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.processed = 0
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
paymentsRouter.get('/invoice/:invoiceId', async (req: AuthRequest, res: Response, next) => {
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
paymentsRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
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
paymentsRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);

    // Verify invoice exists
    const invoice = await db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [data.payment_invoice]);
    if (!invoice) {
      throw badRequest('Invoice not found');
    }

    // Guard against duplicate payment (same invoice + amount + date)
    const paymentDate = data.payment_date || new Date().toISOString().split('T')[0];
    const duplicate = await db.queryOne<any>(
      'SELECT id FROM payments WHERE invoice_id = ? AND payment_amount = ? AND payment_date = ?',
      [data.payment_invoice, data.payment_amount, paymentDate]
    );
    if (duplicate) {
      throw badRequest('A payment with the same amount and date already exists for this invoice');
    }

    const insertId = await db.insertOne('payments', {
      invoice_id: data.payment_invoice,
      payment_amount: data.payment_amount,
      payment_date: paymentDate,
      payment_method: null,
      reference_number: null,
      remarks: null,
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Check if invoice is fully paid
    const totalPaidResult = await db.queryOne<any>(
      'SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?',
      [data.payment_invoice]
    );
    const totalPaid = totalPaidResult?.total_paid || 0;
    if (totalPaid >= invoice.invoice_amount) {
      await db.execute(
        'UPDATE invoices SET paid = 2, updated_at = ? WHERE id = ?',
        [toMySQLDate(new Date()), data.payment_invoice]
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
paymentsRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updatePaymentSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM payments WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Payment not found');
    }

    const updateFields: Record<string, any> = { updated_at: toMySQLDate(new Date()) };
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
paymentsRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne<any>('SELECT id, invoice_id FROM payments WHERE id = ?', [id]);
    if (!existing) {
      throw notFound('Payment not found');
    }

    await db.execute('DELETE FROM payments WHERE id = ?', [id]);

    // Recalculate invoice paid status after removing the payment
    if (existing.invoice_id) {
      const invoice = await db.queryOne<any>('SELECT id, invoice_amount FROM invoices WHERE id = ?', [existing.invoice_id]);
      if (invoice) {
        const totalPaidResult = await db.queryOne<any>(
          'SELECT COALESCE(SUM(payment_amount), 0) as total_paid FROM payments WHERE invoice_id = ?',
          [existing.invoice_id]
        );
        const totalPaid = Number(totalPaidResult?.total_paid || 0);
        const newStatus = totalPaid >= Number(invoice.invoice_amount) ? 2 : 0;
        await db.execute(
          'UPDATE invoices SET paid = ?, updated_at = ? WHERE id = ?',
          [newStatus, toMySQLDate(new Date()), existing.invoice_id]
        );
      }
    }

    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /payments/process - Process payments (create corresponding transactions)
 */
paymentsRouter.post('/process', async (req: AuthRequest, res: Response, next) => {
  try {
    const { payment_ids, invoice_id } = req.body;

    let paymentsToProcess: any[] = [];

    if (payment_ids && Array.isArray(payment_ids) && payment_ids.length > 0) {
      const placeholders = payment_ids.map(() => '?').join(',');
      paymentsToProcess = await db.query<any>(
        `SELECT * FROM payments WHERE id IN (${placeholders}) AND processed = 0`,
        payment_ids
      );
    } else if (invoice_id) {
      paymentsToProcess = await db.query<any>(
        'SELECT * FROM payments WHERE invoice_id = ? AND processed = 0',
        [invoice_id]
      );
    } else {
      throw badRequest('Either payment_ids or invoice_id is required');
    }

    const processed: Array<{ payment_id: number; transaction_id?: number }> = [];
    const errors: Array<{ payment_id: number; message: string }> = [];

    for (const payment of paymentsToProcess) {
      try {
        // Look up invoice and contact details for the transaction
        const invoice = await db.queryOne<any>(
          `SELECT i.id, i.invoice_number, i.invoice_amount,
                  c.company_name, c.vat_number
           FROM invoices i
           LEFT JOIN contacts c ON c.id = i.contact_id
           WHERE i.id = ?`,
          [payment.invoice_id]
        );

        // Check if any line items on this invoice are VAT-inclusive
        const vatInfo = await db.queryOne<any>(
          `SELECT SUM(CASE WHEN item_vat = 1 THEN line_total * 15 / 115 ELSE 0 END) as vat_amount
           FROM invoice_items WHERE invoice_id = ?`,
          [payment.invoice_id]
        );

        const totalAmount = Number(payment.payment_amount);
        const invoiceVat = Number(vatInfo?.vat_amount || 0);
        // Proportional VAT for partial payments
        const invoiceTotal = Number(invoice?.invoice_amount || totalAmount);
        const paymentRatio = invoiceTotal > 0 ? totalAmount / invoiceTotal : 1;
        const vatAmount = Math.round(invoiceVat * paymentRatio * 100) / 100;
        const exclusiveAmount = Math.round((totalAmount - vatAmount) * 100) / 100;

        // Create a transaction in transactions_vat (the active transactions table)
        const transactionId = await db.insertOne('transactions_vat', {
          transaction_date: payment.payment_date,
          transaction_type: 'income',
          party_name: invoice?.company_name || 'Unknown',
          party_vat_number: invoice?.vat_number || null,
          invoice_number: invoice?.invoice_number || `INV-${payment.invoice_id}`,
          total_amount: totalAmount,
          vat_type: vatAmount > 0 ? 'standard' : 'non-vat',
          vat_amount: vatAmount,
          exclusive_amount: exclusiveAmount,
          transaction_payment_id: payment.id,
          transaction_invoice_id: payment.invoice_id,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });

        // Mark payment as processed
        await db.execute(
          'UPDATE payments SET processed = 1, transaction_id = ?, updated_at = ? WHERE id = ?',
          [parseInt(transactionId), toMySQLDate(new Date()), payment.id]
        );

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
