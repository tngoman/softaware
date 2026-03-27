import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Invoice, InvoiceItem, Payment } from '../db/businessTypes.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';
import { sendEmail } from '../services/emailService.js';

export const invoicesRouter = Router();

// All invoice routes require admin
invoicesRouter.use(requireAuth, requireAdmin);

const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1).optional(),
  invoice_type: z.enum(['tax', 'proforma']).optional(),
  invoice_contact_id: z.coerce.number().int().positive().optional(),
  contact_id: z.coerce.number().int().positive().optional(),
  quotation_id: z.coerce.number().int().positive().optional(),
  invoice_quote_id: z.coerce.number().int().positive().optional(),
  invoice_amount: z.coerce.number().optional(),
  invoice_total: z.coerce.number().optional(),
  invoice_subtotal: z.coerce.number().optional(),
  invoice_vat: z.coerce.number().optional(),
  invoice_discount: z.coerce.number().optional(),
  invoice_date: z.string().optional(),
  invoice_due_date: z.string().optional(),
  invoice_valid_until: z.string().optional(),
  due_date: z.string().optional(),
  invoice_status: z.coerce.number().optional(),
  invoice_payment_status: z.coerce.number().optional(),
  invoice_notes: z.string().optional(),
  remarks: z.string().optional(),
  active: z.coerce.number().default(1),
  items: z.array(z.object({
    item_product: z.string().optional(),
    item_description: z.string().optional(),
    item_qty: z.coerce.number().optional(),
    item_quantity: z.coerce.number().optional(),
    item_price: z.coerce.number().optional(),
    item_cost: z.coerce.number().optional(),
    item_discount: z.coerce.number().optional(),
    item_subtotal: z.coerce.number().optional(),
    item_vat: z.coerce.number().optional(),
    item_profit: z.coerce.number().optional(),
  })).optional(),
});

const createInvoiceItemSchema = z.object({
  item_description: z.string().min(1),
  item_price: z.coerce.number().positive(),
  item_quantity: z.coerce.number().int().positive().default(1),
  item_discount: z.coerce.number().nonnegative().default(0),
});

const createPaymentSchema = z.object({
  payment_date: z.string().date(),
  payment_amount: z.coerce.number().positive(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  remarks: z.string().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

// ── SQL fragment that aliases invoice columns to match the frontend Invoice interface ──
const INVOICE_SELECT = `
  i.id            AS invoice_id,
  i.contact_id    AS invoice_contact_id,
  i.invoice_number,
  i.invoice_type,
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
  c.phone         AS contact_phone,
  c.vat_number    AS contact_vat,
  c.location      AS contact_address
`;

/**
 * GET /invoices - List all invoices with search
 */
invoicesRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const paid = req.query.paid ? parseInt(req.query.paid as string) : undefined;
    const search = (req.query.search as string) || '';
    const invoiceType = (req.query.invoice_type as string) || '';

    let query = `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.active = 1`;
    let countQuery = 'SELECT COUNT(*) as count FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id WHERE i.active = 1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (invoiceType) {
      query += ' AND i.invoice_type = ?';
      countQuery += ' AND i.invoice_type = ?';
      params.push(invoiceType);
      countParams.push(invoiceType);
    } else {
      // Default to only tax invoices when no filter
      query += ' AND i.invoice_type = ?';
      countQuery += ' AND i.invoice_type = ?';
      params.push('tax');
      countParams.push('tax');
    }

    if (paid !== undefined) {
      query += ' AND i.paid = ?';
      countQuery += ' AND i.paid = ?';
      params.push(paid);
      countParams.push(paid);
    }

    if (search) {
      const searchClause = ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR i.remarks LIKE ?)';
      const searchVal = `%${search}%`;
      query += searchClause;
      countQuery += searchClause;
      params.push(searchVal, searchVal, searchVal);
      countParams.push(searchVal, searchVal, searchVal);
    }

    query += ' ORDER BY i.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const invoices = await db.query<any>(query, params);
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
invoicesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
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
              item_vat,
              0 AS item_profit,
              COALESCE(item_cost, 0) AS item_cost
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [id]
    );

    const payments = await db.query<any>(
      `SELECT id AS payment_id, payment_date, payment_amount,
              invoice_id AS payment_invoice,
              processed AS payment_processed,
              transaction_id
       FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    // Compute VAT from items
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);
    invoice.invoice_vat = computedVat;
    invoice.invoice_subtotal = subtotal;
    invoice.invoice_total = subtotal + computedVat;

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
invoicesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createInvoiceSchema.parse(req.body);

    const contactId = data.invoice_contact_id || data.contact_id;
    if (!contactId) {
      throw badRequest('Contact ID is required');
    }

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [contactId]);
    if (!contact) {
      throw badRequest('Contact not found');
    }

    // Auto-generate invoice number if not provided
    let invoiceNumber = data.invoice_number;
    if (!invoiceNumber) {
      // Get the last invoice number (not just the max ID)
      const lastInv = await db.queryOne<any>(
        'SELECT invoice_number FROM invoices WHERE invoice_number LIKE "INV-%" ORDER BY id DESC LIMIT 1'
      );
      
      let nextNumber = 1;
      if (lastInv?.invoice_number) {
        // Extract number from "INV-00123" format
        const match = lastInv.invoice_number.match(/INV-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      invoiceNumber = `INV-${String(nextNumber).padStart(5, '0')}`;
    }

    // Check uniqueness
    const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [invoiceNumber]);
    if (existing) {
      invoiceNumber = `${invoiceNumber}-${Date.now()}`;
    }

    const totalAmount = data.invoice_total || data.invoice_amount || data.invoice_subtotal || 0;
    const dueDate = data.invoice_due_date || data.invoice_valid_until || data.due_date || null;

    const insertId = await db.insertOne('invoices', {
      invoice_number: invoiceNumber,
      invoice_type: data.invoice_type || 'tax',
      contact_id: contactId,
      quotation_id: data.invoice_quote_id || data.quotation_id || null,
      invoice_amount: totalAmount,
      invoice_date: data.invoice_date ? data.invoice_date.split('T')[0] : new Date().toISOString().split('T')[0],
      due_date: dueDate ? String(dueDate).split('T')[0] : null,
      invoice_user_id: req.userId,
      remarks: data.invoice_notes || data.remarks || null,
      active: data.invoice_status !== undefined ? data.invoice_status : 1,
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Insert line items if provided
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue;
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('invoice_items', {
          invoice_id: insertId,
          item_description: desc,
          item_cost: item.item_cost != null ? item.item_cost : null,
          item_price: price,
          item_quantity: qty,
          item_discount: discount,
          item_vat: item.item_vat ? 1 : 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }
    }

    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, id: parseInt(insertId), data: invoice });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /invoices/:id - Update invoice
 */
invoicesRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateInvoiceSchema.parse(req.body);

    const invoice = await db.queryOne<any>(
      'SELECT id FROM invoices WHERE id = ?',
      [id]
    );
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    const contactId = data.invoice_contact_id || data.contact_id;
    const totalAmount = data.invoice_total || data.invoice_amount || data.invoice_subtotal;
    const dueDate = data.invoice_due_date || data.invoice_valid_until || data.due_date;

    const updateData: any = { updated_at: toMySQLDate(new Date()) };
    if (contactId) updateData.contact_id = contactId;
    if (totalAmount !== undefined) updateData.invoice_amount = totalAmount;
    if (data.invoice_date) updateData.invoice_date = String(data.invoice_date).split('T')[0];
    if (dueDate) updateData.due_date = String(dueDate).split('T')[0];
    if (data.invoice_notes !== undefined || data.remarks !== undefined) updateData.remarks = data.invoice_notes || data.remarks || null;
    if (data.invoice_status !== undefined) updateData.active = data.invoice_status;

    await db.execute(
      `UPDATE invoices SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    // Replace line items if provided
    if (data.items && data.items.length > 0) {
      await db.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue;
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('invoice_items', {
          invoice_id: id,
          item_description: desc,
          item_cost: item.item_cost != null ? item.item_cost : null,
          item_price: price,
          item_quantity: qty,
          item_discount: discount,
          item_vat: item.item_vat ? 1 : 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }
    }

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
invoicesRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) {
      throw notFound('Invoice not found');
    }

    await db.execute(
      'UPDATE invoices SET active = 0, updated_at = ? WHERE id = ?',
      [toMySQLDate(new Date()), id]
    );

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/items - Add line item to invoice
 */
invoicesRouter.post('/:id/items', async (req: AuthRequest, res: Response, next) => {
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
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
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
invoicesRouter.delete('/:id/items/:itemId', async (req: AuthRequest, res: Response, next) => {
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
invoicesRouter.post('/:id/payments', async (req: AuthRequest, res: Response, next) => {
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
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Check if invoice is fully paid
    const totalPaidResult = await db.queryOne<any>(
      'SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?',
      [id]
    );

    const totalPaid = totalPaidResult?.total_paid || 0;
    if (totalPaid >= invoice.invoice_amount) {
      await db.execute(
        'UPDATE invoices SET paid = 2, updated_at = ? WHERE id = ?',
        [toMySQLDate(new Date()), id]
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
invoicesRouter.get('/:id/payments', async (req: AuthRequest, res: Response, next) => {
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
invoicesRouter.post('/:id/generate-pdf', async (req: AuthRequest, res: Response, next) => {
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
              item_price, item_discount, item_vat,
              (item_quantity * item_price) AS item_subtotal
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [id]
    );

    // Load company settings and build PDF data
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const pdfType = invoice.invoice_type === 'proforma' ? 'proforma' : 'invoice';

    const docData: PDFDocData = {
      type: pdfType as PDFDocData['type'],
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      validUntil: invoice.invoice_due_date || invoice.invoice_valid_until,
      paymentStatus: Number(invoice.invoice_payment_status) || 0,
      notes: invoice.invoice_notes,
      subtotal,
      discount: Number(invoice.invoice_discount) || 0,
      vat: computedVat,
      total: subtotal + computedVat,
      contact: {
        name: invoice.contact_name || '',
        vat: invoice.contact_vat || '',
        address: invoice.contact_address || '',
        phone: invoice.contact_phone || '',
      },
      items: items.map((it: any) => ({
        product: it.item_product,
        qty: Number(it.item_qty),
        price: Number(it.item_price),
        vatFlag: it.item_vat ? 1 : 0,
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
 * POST /invoices/:id/send-email - Send invoice via email with PDF attached
 */
invoicesRouter.post('/:id/send-email', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { to, cc, subject, body } = req.body;

    if (!to) throw badRequest('Recipient email (to) is required');

    // Fetch invoice with contact details
    const invoice = await db.queryOne<any>(
      `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`,
      [id]
    );
    if (!invoice) throw notFound('Invoice not found');

    // Fetch items
    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount, item_vat,
              (item_quantity * item_price) AS item_subtotal
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`,
      [id]
    );

    // Generate PDF
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const emailPdfType = invoice.invoice_type === 'proforma' ? 'proforma' : 'invoice';

    const docData: PDFDocData = {
      type: emailPdfType as PDFDocData['type'],
      number: invoice.invoice_number,
      date: invoice.invoice_date,
      validUntil: invoice.invoice_due_date || invoice.invoice_valid_until,
      paymentStatus: Number(invoice.invoice_payment_status) || 0,
      notes: invoice.invoice_notes,
      subtotal,
      discount: Number(invoice.invoice_discount) || 0,
      vat: computedVat,
      total: subtotal + computedVat,
      contact: {
        name: invoice.contact_name || '',
        vat: invoice.contact_vat || '',
        address: invoice.contact_address || '',
        phone: invoice.contact_phone || '',
      },
      items: items.map((it: any) => ({
        product: it.item_product,
        qty: Number(it.item_qty),
        price: Number(it.item_price),
        vatFlag: it.item_vat ? 1 : 0,
        subtotal: Number(it.item_subtotal),
      })),
    };

    const { filename, filepath } = await generatePdf(docData, co);

    // Convert body text to HTML paragraphs
    const htmlBody = body
      ? body.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')
      : `<p>Please find attached invoice #${invoice.invoice_number}.</p>`;

    // Send email with PDF attached via main emailService
    const result = await sendEmail({
      to,
      cc: cc || undefined,
      subject: subject || `Invoice ${invoice.invoice_number}`,
      html: htmlBody,
      attachments: [{
        filename,
        path: filepath,
        contentType: 'application/pdf',
      }],
    });

    if (!result.success) {
      res.status(502).json({ success: false, error: result.error || 'Failed to send email' });
      return;
    }

    res.json({ success: true, message: 'Email sent successfully', messageId: result.messageId });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/mark-paid - Mark invoice as paid
 */
invoicesRouter.post('/:id/mark-paid', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const invoice = await db.queryOne<any>('SELECT id FROM invoices WHERE id = ?', [id]);
    if (!invoice) throw notFound('Invoice not found');

    await db.execute('UPDATE invoices SET paid = 2, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);

    res.json({ success: true, message: 'Invoice marked as paid' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /invoices/:id/convert-to-tax - Convert proforma invoice to tax invoice
 */
invoicesRouter.post('/:id/convert-to-tax', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { invoice_number, invoice_date, due_date } = req.body;

    const proforma = await db.queryOne<any>('SELECT * FROM invoices WHERE id = ? AND invoice_type = ?', [id, 'proforma']);
    if (!proforma) throw notFound('Proforma invoice not found');

    // Auto-generate tax invoice number if not provided
    let taxInvNumber = invoice_number;
    if (!taxInvNumber) {
      const lastInv = await db.queryOne<any>(
        'SELECT invoice_number FROM invoices WHERE invoice_number LIKE "INV-%" AND invoice_type = "tax" ORDER BY id DESC LIMIT 1'
      );
      let nextNumber = 1;
      if (lastInv?.invoice_number) {
        const match = lastInv.invoice_number.match(/INV-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      taxInvNumber = `INV-${String(nextNumber).padStart(5, '0')}`;
    }

    // Check uniqueness
    const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [taxInvNumber]);
    if (existing) taxInvNumber = `${taxInvNumber}-${Date.now()}`;

    await db.execute('START TRANSACTION');
    try {
      // Create tax invoice from proforma
      const insertId = await db.insertOne('invoices', {
        invoice_number: taxInvNumber,
        invoice_type: 'tax',
        contact_id: proforma.contact_id,
        quotation_id: proforma.quotation_id,
        invoice_amount: proforma.invoice_amount,
        invoice_date: invoice_date || new Date().toISOString().split('T')[0],
        due_date: due_date || proforma.due_date,
        invoice_user_id: proforma.invoice_user_id,
        remarks: proforma.remarks,
        active: 1,
        created_at: toMySQLDate(new Date()),
        updated_at: toMySQLDate(new Date()),
      });

      // Copy items
      const proformaItems = await db.query<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);
      for (const item of proformaItems) {
        await db.insertOne('invoice_items', {
          invoice_id: insertId,
          item_description: item.item_description,
          item_cost: item.item_cost != null ? item.item_cost : null,
          item_price: item.item_price,
          item_quantity: item.item_quantity,
          item_discount: item.item_discount,
          item_vat: item.item_vat || 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }

      // Mark proforma as converted (active = 2)
      await db.execute('UPDATE invoices SET active = 2, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);

      await db.execute('COMMIT');

      const invoice = await db.queryOne<any>(
        `SELECT ${INVOICE_SELECT} FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id WHERE i.id = ?`,
        [insertId]
      );

      res.status(201).json({ success: true, message: 'Proforma converted to tax invoice', data: invoice });
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});
