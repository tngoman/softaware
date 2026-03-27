import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';
import { sendEmail } from '../services/emailService.js';

export const creditNotesRouter = Router();
creditNotesRouter.use(requireAuth, requireAdmin);

const createCreditNoteSchema = z.object({
  credit_note_number: z.string().min(1).optional(),
  contact_id: z.number().int().positive(),
  invoice_id: z.number().int().positive().optional().nullable(),
  credit_note_amount: z.number().optional(),
  credit_note_total: z.number().optional(),
  credit_note_date: z.string().optional(),
  reason: z.string().optional(),
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
    item_vat: z.number().optional(),
  })).optional(),
});

const updateCreditNoteSchema = createCreditNoteSchema.partial();

const CREDIT_NOTE_SELECT = `
  cn.id              AS credit_note_id,
  cn.credit_note_number,
  cn.contact_id,
  cn.invoice_id,
  cn.credit_note_user_id,
  cn.credit_note_amount AS credit_note_total,
  cn.credit_note_amount AS credit_note_subtotal,
  cn.credit_note_date,
  cn.reason,
  cn.remarks,
  cn.active           AS credit_note_status,
  c.company_name      AS contact_name,
  c.email             AS contact_email,
  c.phone             AS contact_phone,
  c.vat_number        AS contact_vat,
  c.location          AS contact_address,
  i.invoice_number    AS linked_invoice_number
`;

/**
 * GET /credit-notes - List all credit notes
 */
creditNotesRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    let query = `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.active >= 0`;
    let countQuery = `SELECT COUNT(*) as count FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       WHERE cn.active >= 0`;
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      const searchClause = ' AND (cn.credit_note_number LIKE ? OR c.company_name LIKE ? OR cn.reason LIKE ?)';
      const searchVal = `%${search}%`;
      query += searchClause;
      countQuery += searchClause;
      params.push(searchVal, searchVal, searchVal);
      countParams.push(searchVal, searchVal, searchVal);
    }

    query += ' ORDER BY cn.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const creditNotes = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: creditNotes,
      pagination: { page, limit, total: countResult?.count || 0 },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /credit-notes/:id - Get single credit note with items
 */
creditNotesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const creditNote = await db.queryOne<any>(
      `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?`,
      [id]
    );
    if (!creditNote) throw notFound('Credit note not found');

    const items = await db.query<any>(
      `SELECT id AS item_id, credit_note_id,
              item_description AS item_product,
              item_quantity AS item_qty,
              item_price,
              (item_quantity * item_price) AS item_subtotal,
              item_discount,
              item_vat,
              0 AS item_profit,
              COALESCE(item_cost, 0) AS item_cost
       FROM credit_note_items WHERE credit_note_id = ? ORDER BY id`,
      [id]
    );

    // Compute VAT from items
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);
    creditNote.credit_note_vat = computedVat;
    creditNote.credit_note_subtotal = subtotal;
    creditNote.credit_note_total = subtotal + computedVat;

    res.json({ success: true, data: { ...creditNote, items } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credit-notes - Create new credit note
 */
creditNotesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createCreditNoteSchema.parse(req.body);

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [data.contact_id]);
    if (!contact) throw badRequest('Contact not found');

    // Auto-generate credit note number if not provided
    let cnNumber = data.credit_note_number;
    if (!cnNumber) {
      const lastCn = await db.queryOne<any>(
        'SELECT credit_note_number FROM credit_notes WHERE credit_note_number LIKE "CN-%" ORDER BY id DESC LIMIT 1'
      );
      let nextNumber = 1;
      if (lastCn?.credit_note_number) {
        const match = lastCn.credit_note_number.match(/CN-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      cnNumber = `CN-${String(nextNumber).padStart(5, '0')}`;
    }

    const existing = await db.queryOne('SELECT id FROM credit_notes WHERE credit_note_number = ?', [cnNumber]);
    if (existing) cnNumber = `${cnNumber}-${Date.now()}`;

    const totalAmount = data.credit_note_total || data.credit_note_amount || 0;

    const insertId = await db.insertOne('credit_notes', {
      credit_note_number: cnNumber,
      contact_id: data.contact_id,
      invoice_id: data.invoice_id || null,
      credit_note_amount: totalAmount,
      credit_note_date: data.credit_note_date || new Date().toISOString().split('T')[0],
      credit_note_user_id: req.userId,
      reason: data.reason || null,
      remarks: data.remarks || null,
      active: data.active,
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Insert line items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue;
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('credit_note_items', {
          credit_note_id: insertId,
          item_description: desc,
          item_cost: item.item_cost || null,
          item_price: price,
          item_quantity: qty,
          item_discount: discount,
          item_vat: item.item_vat ? 1 : 0,
          created_at: toMySQLDate(new Date()),
          updated_at: toMySQLDate(new Date()),
        });
      }
    }

    const creditNote = await db.queryOne<any>(
      `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, id: parseInt(insertId), data: creditNote });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /credit-notes/:id - Update credit note
 */
creditNotesRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateCreditNoteSchema.parse(req.body);

    const existing = await db.queryOne('SELECT id FROM credit_notes WHERE id = ?', [id]);
    if (!existing) throw notFound('Credit note not found');

    const updateData: any = { updated_at: toMySQLDate(new Date()) };
    if (data.contact_id) updateData.contact_id = data.contact_id;
    if (data.invoice_id !== undefined) updateData.invoice_id = data.invoice_id;
    if (data.credit_note_total !== undefined || data.credit_note_amount !== undefined)
      updateData.credit_note_amount = data.credit_note_total || data.credit_note_amount;
    if (data.credit_note_date) updateData.credit_note_date = data.credit_note_date.split('T')[0];
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;

    await db.execute(
      `UPDATE credit_notes SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    // Replace line items if provided
    if (data.items && data.items.length > 0) {
      await db.execute('DELETE FROM credit_note_items WHERE credit_note_id = ?', [id]);
      for (const item of data.items) {
        const desc = item.item_product || item.item_description || '';
        if (!desc) continue;
        const qty = item.item_qty || item.item_quantity || 1;
        const price = item.item_price || 0;
        const discount = item.item_discount || 0;

        await db.insertOne('credit_note_items', {
          credit_note_id: id,
          item_description: desc,
          item_cost: item.item_cost || null,
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
      `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?`,
      [id]
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /credit-notes/:id - Soft delete credit note
 */
creditNotesRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne('SELECT id FROM credit_notes WHERE id = ?', [id]);
    if (!existing) throw notFound('Credit note not found');

    await db.execute('UPDATE credit_notes SET active = -1, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);
    res.json({ success: true, message: 'Credit note deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /credit-notes/:id/generate-pdf - Generate PDF for credit note
 */
creditNotesRouter.post('/:id/generate-pdf', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const creditNote = await db.queryOne<any>(
      `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?`,
      [id]
    );
    if (!creditNote) throw notFound('Credit note not found');

    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount, item_vat,
              (item_quantity * item_price) AS item_subtotal
       FROM credit_note_items WHERE credit_note_id = ? ORDER BY id`,
      [id]
    );

    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_price) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const docData: PDFDocData = {
      type: 'credit_note',
      number: creditNote.credit_note_number,
      date: creditNote.credit_note_date,
      validUntil: creditNote.linked_invoice_number || undefined,
      notes: creditNote.reason || creditNote.remarks,
      subtotal,
      discount: 0,
      vat: computedVat,
      total: subtotal + computedVat,
      contact: {
        name: creditNote.contact_name || '',
        vat: creditNote.contact_vat || '',
        address: creditNote.contact_address || '',
        phone: creditNote.contact_phone || '',
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
 * POST /credit-notes/from-invoice/:invoiceId - Create credit note from existing invoice
 */
creditNotesRouter.post('/from-invoice/:invoiceId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw notFound('Invoice not found');

    const invoiceItems = await db.query<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    // Auto-generate credit note number
    const lastCn = await db.queryOne<any>(
      'SELECT credit_note_number FROM credit_notes WHERE credit_note_number LIKE "CN-%" ORDER BY id DESC LIMIT 1'
    );
    let nextNumber = 1;
    if (lastCn?.credit_note_number) {
      const match = lastCn.credit_note_number.match(/CN-(\d+)/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }
    const cnNumber = `CN-${String(nextNumber).padStart(5, '0')}`;

    const insertId = await db.insertOne('credit_notes', {
      credit_note_number: cnNumber,
      contact_id: invoice.contact_id,
      invoice_id: invoice.id,
      credit_note_amount: invoice.invoice_amount,
      credit_note_date: new Date().toISOString().split('T')[0],
      credit_note_user_id: req.userId,
      reason: `Credit note for invoice ${invoice.invoice_number}`,
      active: 0, // Start as draft
      created_at: toMySQLDate(new Date()),
      updated_at: toMySQLDate(new Date()),
    });

    // Copy items from invoice
    for (const item of invoiceItems) {
      await db.insertOne('credit_note_items', {
        credit_note_id: insertId,
        item_description: item.item_description,
        item_cost: item.item_cost || null,
        item_price: item.item_price,
        item_quantity: item.item_quantity,
        item_discount: item.item_discount,
        item_vat: item.item_vat || 0,
        created_at: toMySQLDate(new Date()),
        updated_at: toMySQLDate(new Date()),
      });
    }

    const creditNote = await db.queryOne<any>(
      `SELECT ${CREDIT_NOTE_SELECT}
       FROM credit_notes cn
       LEFT JOIN contacts c ON c.id = cn.contact_id
       LEFT JOIN invoices i ON i.id = cn.invoice_id
       WHERE cn.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, id: parseInt(insertId), data: creditNote });
  } catch (err) {
    next(err);
  }
});
