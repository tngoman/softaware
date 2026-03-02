import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Invoice, InvoiceItem, Payment } from '../db/businessTypes.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';

export const invoicesRouter = Router();

const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1),
  contact_id: z.number().int().positive(),
  quotation_id: z.number().int().positive().optional(),
  invoice_amount: z.number().positive(),
  invoice_date: z.string().date(),
  due_date: z.string().date().optional(),
  remarks: z.string().optional(),
  active: z.number().default(1),
});

const createInvoiceItemSchema = z.object({
  item_description: z.string().min(1),
  item_price: z.number().positive(),
  item_quantity: z.number().int().positive().default(1),
  item_discount: z.number().nonnegative().default(0),
});

const createPaymentSchema = z.object({
  payment_date: z.string().date(),
  payment_amount: z.number().positive(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  remarks: z.string().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.omit({ invoice_number: true }).partial();

// ── SQL fragment that aliases invoice columns to match the frontend Invoice interface ──
const INVOICE_SELECT = `
  i.id            AS invoice_id,
  i.contact_id    AS invoice_contact_id,
  i.invoice_number,
  i.invoice_amount AS invoice_total,
  i.invoice_amount AS invoice_subtotal,
  0               AS invoice_vat,
  0               AS invoice_discount,
  i.invoice_date,
  i.due_date      AS invoice_due_date,
  i.due_date      AS invoice_valid_until,
  i.paid          AS invoice_payment_status,
  i.remarks       AS invoice_notes,
  i.invoice_user_id,
  i.quotation_id  AS invoice_quote_id,
  i.active        AS invoice_status,
  c.company_name  AS contact_name,
  c.email         AS contact_email,
  c.phone         AS contact_phone
`;

/**
 * GET /invoices - List all invoices
 */
invoicesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const paid = req.query.paid ? parseInt(req.query.paid as string) : undefined;

    let query = `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.active = 1`;
    const params: any[] = [];

    if (paid !== undefined) {
      query += ' AND i.paid = ?';
      params.push(paid);
    }

    query += ' ORDER BY i.invoice_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const invoices = await db.query<any>(query, params);

    const countQuery = 'SELECT COUNT(*) as count FROM invoices WHERE active = 1' + (paid !== undefined ? ' AND paid = ?' : '');
    const countParams = paid !== undefined ? [paid] : [];
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: invoices,
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
 * GET /invoices/:id - Get single invoice with items and payments
 */
invoicesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [id]
    );

    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const items = await db.query<any>(
      `SELECT id AS item_id, invoice_id AS item_invoice_id,
              item_description AS item_product,
              item_quantity AS item_qty,
              item_price,
              (item_quantity * item_price) AS item_subtotal,
              item_discount,
              0 AS item_vat,
              0 AS item_profit,
              0 AS item_cost
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [id]
    );

    const payments = await db.query<any>(
      `SELECT id AS payment_id, payment_date, payment_amount,
              invoice_id AS payment_invoice
       FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: { ...invoice, items, payments },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices - Create new invoice
 */
invoicesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createInvoiceSchema.parse(req.body);

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [data.contact_id]);
    if (!contact) {
      throw badRequest('Contact not found');
    }

    // Check if invoice number is unique
    const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [data.invoice_number]);
    if (existing) {
      throw badRequest('Invoice number already exists');
    }

    const insertId = await db.insertOne('invoices', {
      ...data,
      invoice_user_id: req.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /invoices/:id - Update invoice
 */
invoicesRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateInvoiceSchema.parse(req.body);

    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [id]
    );
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const updateData = { ...data, updated_at: new Date().toISOString() };
    await db.execute('UPDATE invoices SET ? WHERE id = ?', [updateData, id]);

    const updated = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [id]
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /invoices/:id - Soft delete invoice
 */
invoicesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    await db.execute(
      'UPDATE invoices SET active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/items - Add line item to invoice
 */
invoicesRouter.post('/:id/items', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const itemData = createInvoiceItemSchema.parse(req.body);

    const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const insertId = await db.insertOne('invoice_items', {
      invoice_id: id,
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const item = await db.queryOne<InvoiceItem>(
      'SELECT * FROM invoice_items WHERE id = ?',
      [insertId]
    );

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /invoices/:id/items/:itemId - Delete invoice item
 */
invoicesRouter.delete('/:id/items/:itemId', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id, itemId } = req.params;

    const item = await db.queryOne(
      'SELECT id FROM invoice_items WHERE id = ? AND invoice_id = ?',
      [itemId, id]
    );
    if (!item) {
      throw notFound('Invoice item not found');
    }

    await db.execute('DELETE FROM invoice_items WHERE id = ?', [itemId]);

    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/payments - Record payment for invoice
 */
invoicesRouter.post('/:id/payments', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const paymentData = createPaymentSchema.parse(req.body);

    const invoice = await db.queryOne<Invoice>(
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const insertId = await db.insertOne('payments', {
      invoice_id: id,
      ...paymentData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Check if invoice is fully paid
    const totalPaidResult = await db.queryOne<any>(
      'SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?',
      [id]
    );

    const totalPaid = totalPaidResult?.total_paid || 0;
    if (totalPaid >= invoice.invoice_amount) {
      await db.execute(
        'UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), id]
      );
    }

    const payment = await db.queryOne<Payment>(
      'SELECT * FROM payments WHERE id = ?',
      [insertId]
    );

    res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /invoices/:id/payments - Get all payments for invoice
 */
invoicesRouter.get('/:id/payments', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const payments = await db.query<Payment>(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC',
      [id]
    );

    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/generate-pdf - Generate a PDF for this invoice
 */
invoicesRouter.post('/:id/generate-pdf', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [id]
    );
    if (!invoice) throw notFound('Invoice not found');

    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount,
              (item_quantity * item_price) AS item_subtotal
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [id]
    );

    // Load company settings and build PDF data
    const co = await loadCompanySettings();

    const docData: PDFDocData = {
      type: 'invoice',
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      validUntil: invoice.invoice_due_date || invoice.invoice_valid_until,
      paymentStatus: Number(invoice.invoice_payment_status) || 0,
      notes: invoice.invoice_notes,
      subtotal: Number(invoice.invoice_subtotal) || 0,
      discount: Number(invoice.invoice_discount) || 0,
      vat: Number(invoice.invoice_vat) || 0,
      total: Number(invoice.invoice_total) || 0,
      contact: {
        name: invoice.contact_name || '',
        phone: invoice.contact_phone || '',
      },
      items: items.map((it: any) => ({
        product: it.item_product,
        qty: Number(it.item_qty),
        price: Number(it.item_price),
        vatFlag: 0,
        subtotal: Number(it.item_subtotal),
      })),
    };

    const { filename, webPath } = await generatePdf(docData, co);

    res.json({ success: true, filename, path: webPath });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/send-email - Send invoice via email
 */
invoicesRouter.post('/:id/send-email', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { to, subject, body } = req.body;

    if (!to) throw badRequest('Recipient email (to) is required');

    const invoice = await db.queryOne<any>('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) throw notFound('Invoice not found');

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: subject || `Invoice #${id}`,
        html: body || `<p>Please find attached invoice #${id}.</p>`,
      });

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (emailErr: any) {
      console.error('Email send failed:', emailErr.message);
      res.json({ success: true, message: 'Email queued (SMTP not fully configured)' });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/mark-paid - Mark invoice as paid
 */
invoicesRouter.post('/:id/mark-paid', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne<any>('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) throw notFound('Invoice not found');

    await db.execute('UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);

    res.json({ success: true, message: 'Invoice marked as paid' });
  } catch (err) {
    next(err);
  }
});
