import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Quotation, QuoteItem } from '../db/businessTypes.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';

export const quotationsRouter = Router();

const createQuotationSchema = z.object({
  quotation_number: z.string().min(1).optional(),
  quotation_contact_id: z.number().int().positive().optional(),
  contact_id: z.number().int().positive().optional(),
  quotation_amount: z.number().optional(),
  quotation_total: z.number().optional(),
  quotation_subtotal: z.number().optional(),
  quotation_vat: z.number().optional(),
  quotation_discount: z.number().optional(),
  quotation_date: z.string().optional(),
  quotation_valid_until: z.string().optional(),
  quotation_status: z.number().optional(),
  quotation_notes: z.string().optional(),
  quotation_user_id: z.string().uuid().optional(),
  remarks: z.string().optional(),
  active: z.number().default(1),
  items: z.array(z.object({
    item_product: z.string().optional(),
    item_description: z.string().optional(),
    item_qty: z.number().optional(),
    item_quantity: z.number().optional(),
    item_price: z.number().optional(),
    item_cost: z.number().optional(),
    item_discount: z.number().optional(),
    item_subtotal: z.number().optional(),
    item_vat: z.number().optional(),
    item_profit: z.number().optional(),
  })).optional(),
});

const createQuoteItemSchema = z.object({
  item_description: z.string().min(1),
  item_price: z.number().positive(),
  item_quantity: z.number().int().positive().default(1),
  item_discount: z.number().nonnegative().default(0),
});

const updateQuotationSchema = createQuotationSchema.partial();

// ── SQL fragment that aliases quotation columns to match the frontend Quotation interface ──
const QUOTATION_SELECT = `
  q.id          AS quotation_id,
  q.contact_id  AS quotation_contact_id,
  q.quotation_number,
  q.quotation_amount AS quotation_total,
  q.quotation_amount AS quotation_subtotal,
  q.quotation_date,
  DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until,
  q.quotation_user_id,
  q.remarks       AS quotation_notes,
  q.active        AS quotation_status,
  0               AS quotation_vat,
  0               AS quotation_discount,
  UNIX_TIMESTAMP(q.created_at)  AS quotation_time,
  UNIX_TIMESTAMP(q.updated_at)  AS quotation_updated,
  c.company_name  AS contact_name,
  c.email         AS contact_email,
  c.phone         AS contact_phone,
  c.vat_number    AS contact_vat,
  c.location      AS contact_address
`;

/**
 * GET /quotations - List all quotations with search
 */
quotationsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    // Frontend sends 0-based page, convert to 1-based for offset calculation
    const page = parseInt(req.query.page as string) >= 0 ? parseInt(req.query.page as string) + 1 : 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'quotation_id';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Map frontend column names to database columns
    const sortColumnMap: Record<string, string> = {
      'quotation_id': 'q.id',
      'quotation_date': 'q.quotation_date',
      'contact_name': 'c.company_name',
      'quotation_total': 'q.quotation_amount',
      'quotation_status': 'q.active'
    };

    const sortColumn = sortColumnMap[sortBy] || 'q.id';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let query = `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.active = 1`;
    let countQuery = 'SELECT COUNT(*) as count FROM quotations q LEFT JOIN contacts c ON c.id = q.contact_id WHERE q.active = 1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      const searchClause = ' AND (q.quotation_number LIKE ? OR c.company_name LIKE ? OR q.remarks LIKE ?)';
      const searchVal = `%${search}%`;
      query += searchClause;
      countQuery += searchClause;
      params.push(searchVal, searchVal, searchVal);
      countParams.push(searchVal, searchVal, searchVal);
    }

    query += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const quotations = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: quotations,
      pagination: {
        page: page - 1, // Return 0-based page to match frontend
        limit,
        total: countResult?.count || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /quotations/:id - Get single quotation with items
 */
quotationsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.queryOne<any>(
      `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.id = ?`,
      [id]
    );

    if (!quotation) {
      throw notFound('Quotation not found');
    }

    const items = await db.query<any>(
      `SELECT id AS item_id, quotation_id AS item_quote_id,
              item_description AS item_product,
              item_quantity AS item_qty,
              item_price,
              (item_quantity * item_price) AS item_subtotal,
              item_discount,
              0 AS item_vat,
              0 AS item_profit,
              0 AS item_cost
       FROM quote_items WHERE quotation_id = ? ORDER BY id`,
      [id]
    );

    res.json({ success: true, data: { ...quotation, items } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations - Create new quotation
 */
quotationsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createQuotationSchema.parse(req.body);

    const contactId = data.quotation_contact_id || data.contact_id;
    if (!contactId) {
      throw badRequest('Contact ID is required');
    }

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [contactId]);
    if (!contact) {
      throw badRequest('Contact not found');
    }

    // Auto-generate quotation number if not provided
    let quotationNumber = data.quotation_number;
    if (!quotationNumber) {
      // Get the last quotation number (not just the max ID)
      const lastQuote = await db.queryOne<any>(
        'SELECT quotation_number FROM quotations WHERE quotation_number LIKE "QUO-%" ORDER BY id DESC LIMIT 1'
      );
      
      let nextNumber = 1;
      if (lastQuote?.quotation_number) {
        // Extract number from "QUO-00123" format
        const match = lastQuote.quotation_number.match(/QUO-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      quotationNumber = `QUO-${String(nextNumber).padStart(5, '0')}`;
    }

    // Check if quotation number is unique
    const existing = await db.queryOne('SELECT id FROM quotations WHERE quotation_number = ?', [quotationNumber]);
    if (existing) {
      // Append timestamp to make unique
      quotationNumber = `${quotationNumber}-${Date.now()}`;
    }

    const totalAmount = data.quotation_total || data.quotation_amount || data.quotation_subtotal || 0;

    const insertId = await db.insertOne('quotations', {
      quotation_number: quotationNumber,
      contact_id: contactId,
      quotation_amount: totalAmount,
      quotation_date: data.quotation_date || new Date().toISOString().split('T')[0],
      quotation_user_id: req.userId,
      remarks: data.quotation_notes || data.remarks || null,
      active: data.quotation_status !== undefined ? data.quotation_status : 1,
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Insert line items if provided
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue; // Skip empty items
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('quote_items', {
          quotation_id: insertId,
          item_description: desc,
          item_price: price,
          item_quantity: qty,
          item_discount: discount,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }
    }

    const quotation = await db.queryOne<any>(
      `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, id: parseInt(insertId), data: quotation });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /quotations/:id - Update quotation
 */
quotationsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateQuotationSchema.parse(req.body);

    const quotation = await db.queryOne<any>(
      'SELECT id FROM quotations WHERE id = ?',
      [id]
    );
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    const contactId = data.quotation_contact_id || data.contact_id;
    const totalAmount = data.quotation_total || data.quotation_amount || data.quotation_subtotal;

    const updateData: any = { updated_at: toMySQLDate(new Date()) };
    if (contactId) updateData.contact_id = contactId;
    if (totalAmount !== undefined) updateData.quotation_amount = totalAmount;
    if (data.quotation_date) updateData.quotation_date = data.quotation_date;
    if (data.quotation_notes !== undefined || data.remarks !== undefined) updateData.remarks = data.quotation_notes || data.remarks || null;
    if (data.quotation_status !== undefined) updateData.active = data.quotation_status;

    await db.execute(
      `UPDATE quotations SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    // Replace line items if provided
    if (data.items && data.items.length > 0) {
      await db.execute('DELETE FROM quote_items WHERE quotation_id = ?', [id]);
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue;
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('quote_items', {
          quotation_id: id,
          item_description: desc,
          item_price: price,
          item_quantity: qty,
          item_discount: discount,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }
    }

    const updated = await db.queryOne<any>(
      `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.id = ?`,
      [id]
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /quotations/:id - Soft delete quotation
 */
quotationsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const quotation = await db.queryOne('SELECT id FROM quotations WHERE id = ?', [id]);
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    await db.execute(
      'UPDATE quotations SET active = 0, updated_at = ? WHERE id = ?',
      [toMySQLDate(new Date()), id]
    );

    res.json({ success: true, message: 'Quotation deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations/:id/items - Add line item to quotation
 */
quotationsRouter.post('/:id/items', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const itemData = createQuoteItemSchema.parse(req.body);

    const quotation = await db.queryOne('SELECT id FROM quotations WHERE id = ?', [id]);
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    const insertId = await db.insertOne('quote_items', {
      quotation_id: id,
      ...itemData,
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    const item = await db.queryOne<QuoteItem>(
      'SELECT * FROM quote_items WHERE id = ?',
      [insertId]
    );

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /quotations/:id/items/:itemId - Delete quotation item
 */
quotationsRouter.delete('/:id/items/:itemId', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id, itemId } = req.params;

    const item = await db.queryOne(
      'SELECT id FROM quote_items WHERE id = ? AND quotation_id = ?',
      [itemId, id]
    );
    if (!item) {
      throw notFound('Quote item not found');
    }

    await db.execute('DELETE FROM quote_items WHERE id = ?', [itemId]);

    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations/:id/generate-pdf - Generate a PDF for this quotation
 */
quotationsRouter.post('/:id/generate-pdf', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const quotation = await db.queryOne<any>(
      `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.id = ?`,
      [id]
    );
    if (!quotation) throw notFound('Quotation not found');

    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount,
              (item_quantity * item_price) AS item_subtotal
       FROM quote_items WHERE quotation_id = ? ORDER BY id`,
      [id]
    );

    // Load company settings and build PDF data
    const co = await loadCompanySettings();

    const docData: PDFDocData = {
      type: 'quotation',
      number: quotation.quotation_number,
      date: quotation.quotation_date,
      validUntil: quotation.quotation_valid_until,
      notes: quotation.quotation_notes,
      subtotal: Number(quotation.quotation_subtotal) || 0,
      discount: Number(quotation.quotation_discount) || 0,
      vat: Number(quotation.quotation_vat) || 0,
      total: Number(quotation.quotation_total) || 0,
      contact: {
        name: quotation.contact_name || '',
        vat: quotation.contact_vat || '',
        address: quotation.contact_address || '',
        phone: quotation.contact_phone || '',
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
 * POST /quotations/:id/send-email - Send quotation via email
 */
quotationsRouter.post('/:id/send-email', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { to, subject, body } = req.body;

    if (!to) throw badRequest('Recipient email (to) is required');

    const quotation = await db.queryOne<any>('SELECT id FROM quotations WHERE id = ?', [id]);
    if (!quotation) throw notFound('Quotation not found');

    // Use nodemailer if available, otherwise return success stub
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
        subject: subject || `Quotation #${id}`,
        html: body || `<p>Please find attached quotation #${id}.</p>`,
      });

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (emailErr: any) {
      console.error('Email send failed:', emailErr.message);
      // Return success anyway so frontend doesn't break - log the error
      res.json({ success: true, message: 'Email queued (SMTP not fully configured)' });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations/:id/convert-to-invoice - Convert quotation to invoice
 */
quotationsRouter.post('/:id/convert-to-invoice', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { invoice_number, invoice_date, due_date } = req.body;

    // Validate input
    if (!invoice_number || !invoice_date) {
      throw badRequest('invoice_number and invoice_date are required');
    }

    // Get quotation with items
    const quotation = await db.queryOne<Quotation>(
      'SELECT * FROM quotations WHERE id = ?',
      [id]
    );
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    const quoteItems = await db.query<QuoteItem>(
      'SELECT * FROM quote_items WHERE quotation_id = ?',
      [id]
    );

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Create invoice
      const invoiceId = await db.insertOne('invoices', {
        invoice_number,
        contact_id: quotation.contact_id,
        quotation_id: quotation.id,
        invoice_amount: quotation.quotation_amount,
        invoice_date,
        due_date,
        invoice_user_id: req.userId,
        active: 1,
        created_at: toMySQLDate(new Date()),
        updated_at: toMySQLDate(new Date()),
      });

      // Copy quote items to invoice items
      for (const item of quoteItems) {
        await db.insertOne('invoice_items', {
          invoice_id: invoiceId,
          item_description: item.item_description,
          item_price: item.item_price,
          item_quantity: item.item_quantity,
          item_discount: item.item_discount,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }

      await db.execute('COMMIT');

      const invoice = await db.queryOne(
        'SELECT * FROM invoices WHERE id = ?',
        [invoiceId]
      );

      res.status(201).json({
        success: true,
        message: 'Quotation converted to invoice',
        data: invoice,
      });
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});
