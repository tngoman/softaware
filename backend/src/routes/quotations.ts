import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Quotation, QuoteItem } from '../db/businessTypes.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';
import { sendEmail } from '../services/emailService.js';

export const quotationsRouter = Router();

// All quotation routes require admin
quotationsRouter.use(requireAuth, requireAdmin);

const createQuotationSchema = z.object({
  quotation_number: z.string().min(1).optional(),
  quotation_contact_id: z.coerce.number().int().positive().optional(),
  contact_id: z.coerce.number().int().positive().optional(),
  quotation_amount: z.coerce.number().optional(),
  quotation_total: z.coerce.number().optional(),
  quotation_subtotal: z.coerce.number().optional(),
  quotation_vat: z.coerce.number().optional(),
  quotation_discount: z.coerce.number().optional(),
  quotation_date: z.string().optional(),
  quotation_valid_until: z.string().optional(),
  quotation_status: z.coerce.number().optional(),
  quotation_notes: z.string().optional(),
  quotation_user_id: z.string().uuid().optional(),
  remarks: z.string().optional(),
  terms_type: z.enum(['ppe', 'web']).optional(),
  qty_label: z.enum(['qty', 'hours']).optional(),
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

const createQuoteItemSchema = z.object({
  item_description: z.string().min(1),
  item_price: z.coerce.number().positive(),
  item_quantity: z.coerce.number().int().positive().default(1),
  item_discount: z.coerce.number().nonnegative().default(0),
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
  q.terms_type,
  q.qty_label,
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
quotationsRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    // Frontend sends 0-based page, convert to 1-based for offset calculation
    const page = parseInt(req.query.page as string) >= 0 ? parseInt(req.query.page as string) + 1 : 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'quotation_date';
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
       WHERE q.active >= 0`;
    let countQuery = 'SELECT COUNT(*) as count FROM quotations q LEFT JOIN contacts c ON c.id = q.contact_id WHERE q.active >= 0';
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
quotationsRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
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
              item_vat,
              0 AS item_profit,
              COALESCE(item_cost, 0) AS item_cost
       FROM quote_items WHERE quotation_id = ? ORDER BY id`,
      [id]
    );

    // Compute VAT from items
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);
    quotation.quotation_vat = computedVat;
    quotation.quotation_subtotal = subtotal;
    quotation.quotation_total = subtotal + computedVat;

    res.json({ success: true, data: { ...quotation, items } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations - Create new quotation
 */
quotationsRouter.post('/', async (req: AuthRequest, res: Response, next) => {
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
      terms_type: data.terms_type || 'ppe',
      qty_label: data.qty_label || 'qty',
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
quotationsRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
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
    if (data.quotation_date) updateData.quotation_date = data.quotation_date.split('T')[0];
    if (data.quotation_notes !== undefined || data.remarks !== undefined) updateData.remarks = data.quotation_notes || data.remarks || null;
    if (data.quotation_status !== undefined) updateData.active = data.quotation_status;
    if (data.terms_type) updateData.terms_type = data.terms_type;
    if (data.qty_label) updateData.qty_label = data.qty_label;

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
quotationsRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const quotation = await db.queryOne('SELECT id FROM quotations WHERE id = ?', [id]);
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    await db.execute(
      'UPDATE quotations SET active = -1, updated_at = ? WHERE id = ?',
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
quotationsRouter.post('/:id/items', async (req: AuthRequest, res: Response, next) => {
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
quotationsRouter.delete('/:id/items/:itemId', async (req: AuthRequest, res: Response, next) => {
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
quotationsRouter.post('/:id/generate-pdf', async (req: AuthRequest, res: Response, next) => {
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
              item_price, item_discount, item_vat,
              (item_quantity * item_price) AS item_subtotal
       FROM quote_items WHERE quotation_id = ? ORDER BY id`,
      [id]
    );

    // Load company settings and build PDF data
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const docData: PDFDocData = {
      type: 'quotation',
      number: quotation.quotation_number,
      date: quotation.quotation_date,
      validUntil: quotation.quotation_valid_until,
      notes: quotation.quotation_notes,
      termsType: quotation.terms_type || 'ppe',
      qtyLabel: quotation.qty_label || 'qty',
      subtotal,
      discount: Number(quotation.quotation_discount) || 0,
      vat: computedVat,
      total: subtotal + computedVat,
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
 * POST /quotations/:id/send-email - Send quotation via email with PDF attached
 */
quotationsRouter.post('/:id/send-email', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { to, cc, subject, body } = req.body;

    if (!to) throw badRequest('Recipient email (to) is required');

    // Fetch quotation with contact details
    const quotation = await db.queryOne<any>(
      `SELECT ${QUOTATION_SELECT}
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.id = ?`,
      [id]
    );
    if (!quotation) throw notFound('Quotation not found');

    // Fetch items
    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount, item_vat,
              (item_quantity * item_price) AS item_subtotal
       FROM quote_items WHERE quotation_id = ? ORDER BY id`,
      [id]
    );

    // Generate PDF
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const docData: PDFDocData = {
      type: 'quotation',
      number: quotation.quotation_number,
      date: quotation.quotation_date,
      validUntil: quotation.quotation_valid_until,
      notes: quotation.quotation_notes,
      termsType: quotation.terms_type || 'ppe',
      qtyLabel: quotation.qty_label || 'qty',
      subtotal,
      discount: Number(quotation.quotation_discount) || 0,
      vat: computedVat,
      total: subtotal + computedVat,
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
        vatFlag: it.item_vat ? 1 : 0,
        subtotal: Number(it.item_subtotal),
      })),
    };

    const { filename, filepath } = await generatePdf(docData, co);

    // Convert body text to HTML paragraphs
    const htmlBody = body
      ? body.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')
      : `<p>Please find attached quotation #${quotation.quotation_number}.</p>`;

    // Send email with PDF attached via main emailService
    const result = await sendEmail({
      to,
      cc: cc || undefined,
      subject: subject || `Quotation ${quotation.quotation_number}`,
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

    // Mark quotation as sent (active = 1) if it was a draft
    await db.execute('UPDATE quotations SET active = 1 WHERE id = ? AND active = 0', [id]);

    res.json({ success: true, message: 'Email sent successfully', messageId: result.messageId });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /quotations/:id/convert-to-invoice - Convert quotation to invoice
 */
quotationsRouter.post('/:id/convert-to-invoice', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { invoice_number, invoice_date, due_date } = req.body;

    // Get quotation with items
    const quotation = await db.queryOne<Quotation>(
      'SELECT * FROM quotations WHERE id = ?',
      [id]
    );
    if (!quotation) {
      throw notFound('Quotation not found');
    }

    // Auto-generate invoice number if not provided
    let invoiceNumber = invoice_number;
    if (!invoiceNumber) {
      const lastInv = await db.queryOne<any>(
        'SELECT invoice_number FROM invoices WHERE invoice_number LIKE "INV-%" ORDER BY id DESC LIMIT 1'
      );
      let nextNumber = 1;
      if (lastInv?.invoice_number) {
        const match = lastInv.invoice_number.match(/INV-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      invoiceNumber = `INV-${String(nextNumber).padStart(5, '0')}`;
    }

    // Check uniqueness — append timestamp if duplicate
    const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [invoiceNumber]);
    if (existing) invoiceNumber = `${invoiceNumber}-${Date.now()}`;

    // Default invoice_date to today if not provided
    const invoiceDate = invoice_date || new Date().toISOString().split('T')[0];

    // Default due_date to invoice_date + 7 days
    const dueDate = due_date || new Date(new Date(invoiceDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const quoteItems = await db.query<QuoteItem>(
      'SELECT * FROM quote_items WHERE quotation_id = ?',
      [id]
    );

    // Start transaction
    await db.execute('START TRANSACTION');

    try {
      // Create invoice
      const invoiceId = await db.insertOne('invoices', {
        invoice_number: invoiceNumber,
        contact_id: quotation.contact_id,
        quotation_id: quotation.id,
        invoice_amount: quotation.quotation_amount,
        invoice_date: invoiceDate,
        due_date: dueDate,
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
          item_cost: (item as any).item_cost || null,
          item_price: item.item_price,
          item_quantity: item.item_quantity,
          item_discount: item.item_discount,
          item_vat: (item as any).item_vat || 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }

      // Mark quotation as converted (active = 2 means converted)
      await db.execute(
        'UPDATE quotations SET active = 2, updated_at = ? WHERE id = ?',
        [toMySQLDate(new Date()), id]
      );

      await db.execute('COMMIT');

      const invoice = await db.queryOne(
        `SELECT i.id AS invoice_id, i.* FROM invoices i WHERE i.id = ?`,
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

/**
 * POST /quotations/:id/convert-to-proforma - Convert quotation to proforma invoice
 */
quotationsRouter.post('/:id/convert-to-proforma', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { invoice_number, invoice_date, due_date } = req.body;

    const quotation = await db.queryOne<Quotation>('SELECT * FROM quotations WHERE id = ?', [id]);
    if (!quotation) throw notFound('Quotation not found');

    const quoteItems = await db.query<QuoteItem>('SELECT * FROM quote_items WHERE quotation_id = ?', [id]);

    // Auto-generate proforma number if not provided
    let proformaNumber = invoice_number;
    if (!proformaNumber) {
      const lastPro = await db.queryOne<any>(
        'SELECT invoice_number FROM invoices WHERE invoice_number LIKE "PRO-%" ORDER BY id DESC LIMIT 1'
      );
      let nextNumber = 1;
      if (lastPro?.invoice_number) {
        const match = lastPro.invoice_number.match(/PRO-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      proformaNumber = `PRO-${String(nextNumber).padStart(5, '0')}`;
    }

    // Check uniqueness
    const existing = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [proformaNumber]);
    if (existing) proformaNumber = `${proformaNumber}-${Date.now()}`;

    await db.execute('START TRANSACTION');
    try {
      const invoiceId = await db.insertOne('invoices', {
        invoice_number: proformaNumber,
        invoice_type: 'proforma',
        contact_id: quotation.contact_id,
        quotation_id: quotation.id,
        invoice_amount: quotation.quotation_amount,
        invoice_date: invoice_date || new Date().toISOString().split('T')[0],
        due_date: due_date || new Date(new Date(invoice_date || new Date().toISOString().split('T')[0]).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoice_user_id: req.userId,
        active: 1,
        created_at: toMySQLDate(new Date()),
        updated_at: toMySQLDate(new Date()),
      });

      for (const item of quoteItems) {
        await db.insertOne('invoice_items', {
          invoice_id: invoiceId,
          item_description: item.item_description,
          item_cost: (item as any).item_cost || null,
          item_price: item.item_price,
          item_quantity: item.item_quantity,
          item_discount: item.item_discount,
          item_vat: (item as any).item_vat || 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }

      // Mark quotation as converted (active = 2)
      await db.execute('UPDATE quotations SET active = 2, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);

      await db.execute('COMMIT');

      const invoice = await db.queryOne('SELECT i.id AS invoice_id, i.* FROM invoices i WHERE i.id = ?', [invoiceId]);
      res.status(201).json({ success: true, message: 'Quotation converted to proforma invoice', data: invoice });
    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});
