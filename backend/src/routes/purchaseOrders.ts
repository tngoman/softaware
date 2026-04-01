import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import { generatePdf, loadCompanySettings, type PDFDocData } from '../utils/pdfGenerator.js';
import { sendEmail } from '../services/emailService.js';

export const purchaseOrdersRouter = Router();

// All PO routes require admin
purchaseOrdersRouter.use(requireAuth, requireAdmin);

/* ── Zod schemas ──────────────────────────────────────────── */

const createPOSchema = z.object({
  po_number: z.string().optional(),
  contact_id: z.coerce.number().int().positive(),
  po_contact_id: z.coerce.number().int().positive().optional(),
  invoice_id: z.coerce.number().int().positive().optional().nullable(),
  po_amount: z.coerce.number().optional(),
  po_date: z.string().optional(),
  due_date: z.string().optional().nullable(),
  po_due_date: z.string().optional().nullable(),
  po_status: z.coerce.number().optional(),
  remarks: z.string().optional().nullable(),
  po_notes: z.string().optional().nullable(),
  items: z.array(z.object({
    item_description: z.string().optional(),
    item_product: z.string().optional(),
    item_cost: z.coerce.number().optional(),
    item_price: z.coerce.number().optional(),
    item_quantity: z.coerce.number().optional(),
    item_qty: z.coerce.number().optional(),
    item_discount: z.coerce.number().optional(),
    item_vat: z.coerce.number().optional(),
  })).optional(),
});

const updatePOSchema = z.object({
  po_number: z.string().optional(),
  contact_id: z.coerce.number().int().positive().optional(),
  po_contact_id: z.coerce.number().int().positive().optional(),
  invoice_id: z.coerce.number().int().positive().optional().nullable(),
  po_amount: z.coerce.number().optional(),
  po_date: z.string().optional(),
  due_date: z.string().optional().nullable(),
  po_due_date: z.string().optional().nullable(),
  po_status: z.coerce.number().optional(),
  remarks: z.string().optional().nullable(),
  po_notes: z.string().optional().nullable(),
  items: z.array(z.object({
    item_description: z.string().optional(),
    item_product: z.string().optional(),
    item_cost: z.coerce.number().optional(),
    item_price: z.coerce.number().optional(),
    item_quantity: z.coerce.number().optional(),
    item_qty: z.coerce.number().optional(),
    item_discount: z.coerce.number().optional(),
    item_vat: z.coerce.number().optional(),
  })).optional(),
});

/* ── SQL fragment for aliased columns ─────────────────────── */

const PO_SELECT = `
  po.id            AS po_id,
  po.po_number,
  po.contact_id    AS po_contact_id,
  po.invoice_id    AS po_invoice_id,
  po.po_amount,
  po.po_date,
  po.due_date      AS po_due_date,
  po.po_status,
  po.po_user_id,
  po.remarks       AS po_notes,
  po.active,
  c.company_name   AS contact_name,
  c.email          AS contact_email,
  c.phone          AS contact_phone,
  c.vat_number     AS contact_vat,
  c.location       AS contact_address
`;

/* ── Helper: auto-generate PO number ─────────────────────── */

async function generatePONumber(): Promise<string> {
  const last = await db.queryOne<any>(
    'SELECT po_number FROM purchase_orders WHERE po_number LIKE "PO-%" ORDER BY id DESC LIMIT 1'
  );
  let nextNum = 1;
  if (last?.po_number) {
    const match = last.po_number.match(/PO-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `PO-${String(nextNum).padStart(5, '0')}`;
}

/* ──────────────────────────────────────────────────────────── *
 *  GET /purchase-orders — list with search & pagination
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const status = req.query.status !== undefined ? parseInt(req.query.status as string) : undefined;

    let query = `SELECT ${PO_SELECT}
       FROM purchase_orders po
       LEFT JOIN contacts c ON c.id = po.contact_id
       WHERE po.active = 1`;
    let countQuery = 'SELECT COUNT(*) as count FROM purchase_orders po LEFT JOIN contacts c ON c.id = po.contact_id WHERE po.active = 1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (status !== undefined) {
      query += ' AND po.po_status = ?';
      countQuery += ' AND po.po_status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (search) {
      const clause = ' AND (po.po_number LIKE ? OR c.company_name LIKE ? OR po.remarks LIKE ?)';
      const val = `%${search}%`;
      query += clause;
      countQuery += clause;
      params.push(val, val, val);
      countParams.push(val, val, val);
    }

    query += ' ORDER BY po.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total: countResult?.count || 0 },
    });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  GET /purchase-orders/:id — single PO with items
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const po = await db.queryOne<any>(
      `SELECT ${PO_SELECT}
       FROM purchase_orders po
       LEFT JOIN contacts c ON c.id = po.contact_id
       WHERE po.id = ?`,
      [id]
    );
    if (!po) throw notFound('Purchase order not found');

    const items = await db.query<any>(
      `SELECT id AS item_id, purchase_order_id AS item_po_id,
              item_description AS item_product,
              item_quantity AS item_qty,
              item_cost,
              item_price,
              (item_quantity * item_cost) AS item_subtotal,
              item_discount,
              item_vat
       FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id`,
      [id]
    );

    // Compute VAT from items using cost price
    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_cost) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);
    po.po_subtotal = subtotal;
    po.po_vat = computedVat;
    po.po_total = subtotal + computedVat;

    res.json({ success: true, data: { ...po, items } });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  POST /purchase-orders — create new PO
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = createPOSchema.parse(req.body);

    const contactId = data.contact_id || data.po_contact_id;
    if (!contactId) throw badRequest('Contact ID is required');

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [contactId]);
    if (!contact) throw badRequest('Contact not found');

    // Auto-generate PO number
    let poNumber = data.po_number;
    if (!poNumber) {
      poNumber = await generatePONumber();
    }
    // Check uniqueness
    const existing = await db.queryOne('SELECT id FROM purchase_orders WHERE po_number = ?', [poNumber]);
    if (existing) poNumber = `${poNumber}-${Date.now()}`;

    const now = toMySQLDate(new Date());
    const poDate = data.po_date || new Date().toISOString().split('T')[0];
    const dueDate = data.due_date || data.po_due_date || null;
    const remarks = data.remarks || data.po_notes || null;

    // Compute amount from items
    let poAmount = data.po_amount || 0;
    if (data.items && data.items.length > 0 && !data.po_amount) {
      poAmount = data.items.reduce((sum, it) => {
        const cost = it.item_cost || 0;
        const qty = it.item_quantity || it.item_qty || 1;
        return sum + (cost * qty);
      }, 0);
    }

    const insertId = await db.insertOne('purchase_orders', {
      po_number: poNumber,
      contact_id: contactId,
      invoice_id: data.invoice_id || null,
      po_amount: poAmount,
      po_date: poDate,
      due_date: dueDate,
      po_status: data.po_status || 0,
      po_user_id: req.user?.id || null,
      remarks: remarks,
      active: 1,
      created_at: now,
      updated_at: now,
    });

    // Insert items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const description = item.item_description || item.item_product || '';
        const qty = item.item_quantity || item.item_qty || 1;
        
        await db.insertOne('purchase_order_items', {
          purchase_order_id: insertId,
          item_description: description,
          item_cost: item.item_cost != null ? item.item_cost : 0,
          item_price: item.item_price != null ? item.item_price : 0,
          item_quantity: qty,
          item_discount: item.item_discount || 0,
          item_vat: item.item_vat || 0,
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Return created PO
    const created = await db.queryOne<any>(
      `SELECT ${PO_SELECT} FROM purchase_orders po LEFT JOIN contacts c ON c.id = po.contact_id WHERE po.id = ?`,
      [insertId]
    );

    res.status(201).json({ success: true, data: created, id: parseInt(insertId) });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  PUT /purchase-orders/:id — update PO
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updatePOSchema.parse(req.body);

    const po = await db.queryOne<any>('SELECT id FROM purchase_orders WHERE id = ?', [id]);
    if (!po) throw notFound('Purchase order not found');

    const now = toMySQLDate(new Date());
    const updateData: any = { updated_at: now };

    const contactId = data.contact_id || data.po_contact_id;
    if (contactId !== undefined) updateData.contact_id = contactId;
    if (data.invoice_id !== undefined) updateData.invoice_id = data.invoice_id;
    if (data.po_date !== undefined) updateData.po_date = data.po_date;
    
    const dueDate = data.due_date || data.po_due_date;
    if (dueDate !== undefined) updateData.due_date = dueDate;
    
    if (data.po_status !== undefined) updateData.po_status = data.po_status;
    
    const remarks = data.remarks || data.po_notes;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Update items if provided
    if (data.items) {
      // Delete old items and re-insert
      await db.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);

      let total = 0;
      for (const item of data.items) {
        const description = item.item_description || item.item_product || '';
        const cost = item.item_cost != null ? item.item_cost : 0;
        const qty = item.item_quantity || item.item_qty || 1;
        total += cost * qty;

        await db.insertOne('purchase_order_items', {
          purchase_order_id: id,
          item_description: description,
          item_cost: cost,
          item_price: item.item_price != null ? item.item_price : 0,
          item_quantity: qty,
          item_discount: item.item_discount || 0,
          item_vat: item.item_vat || 0,
          created_at: now,
          updated_at: now,
        });
      }
      updateData.po_amount = data.po_amount ?? total;
    } else if (data.po_amount !== undefined) {
      updateData.po_amount = data.po_amount;
    }

    // Build SET clause
    const setClauses = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    const setValues = Object.values(updateData);
    await db.execute(`UPDATE purchase_orders SET ${setClauses} WHERE id = ?`, [...setValues, id]);

    res.json({ success: true, message: 'Purchase order updated' });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  DELETE /purchase-orders/:id — soft-delete
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const po = await db.queryOne('SELECT id FROM purchase_orders WHERE id = ?', [id]);
    if (!po) throw notFound('Purchase order not found');

    await db.execute('UPDATE purchase_orders SET active = 0, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);

    res.json({ success: true, message: 'Purchase order deleted' });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  POST /purchase-orders/:id/generate-pdf
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.post('/:id/generate-pdf', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const po = await db.queryOne<any>(
      `SELECT ${PO_SELECT} FROM purchase_orders po LEFT JOIN contacts c ON c.id = po.contact_id WHERE po.id = ?`,
      [id]
    );
    if (!po) throw notFound('Purchase order not found');

    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_cost, item_price, item_discount, item_vat,
              (item_quantity * item_cost) AS item_subtotal
       FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id`,
      [id]
    );

    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_cost) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const docData: PDFDocData = {
      type: 'purchase_order',
      number: po.po_number,
      date: po.po_date,
      validUntil: po.po_due_date,
      notes: po.po_notes,
      subtotal,
      discount: 0,
      vat: computedVat,
      total: subtotal + computedVat,
      contact: {
        name: po.contact_name || '',
        vat: po.contact_vat || '',
        address: po.contact_address || '',
        phone: po.contact_phone || '',
      },
      items: items.map((it: any) => ({
        product: it.item_product,
        qty: Number(it.item_qty),
        price: Number(it.item_cost),       // Use cost price for PO PDF
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

/* ──────────────────────────────────────────────────────────── *
 *  POST /purchase-orders/:id/send-email
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.post('/:id/send-email', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { to, cc, subject, body } = req.body;
    if (!to) throw badRequest('Recipient email (to) is required');

    const po = await db.queryOne<any>(
      `SELECT ${PO_SELECT} FROM purchase_orders po LEFT JOIN contacts c ON c.id = po.contact_id WHERE po.id = ?`,
      [id]
    );
    if (!po) throw notFound('Purchase order not found');

    const items = await db.query<any>(
      `SELECT item_description AS item_product, item_quantity AS item_qty,
              item_cost, item_price, item_discount, item_vat,
              (item_quantity * item_cost) AS item_subtotal
       FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id`,
      [id]
    );

    const co = await loadCompanySettings();
    const vatRate = parseFloat(co.vat_percentage) || 15;
    const computedVat = items.reduce((sum: number, it: any) =>
      sum + (it.item_vat ? Number(it.item_qty) * Number(it.item_cost) * vatRate / 100 : 0), 0
    );
    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.item_subtotal), 0);

    const docData: PDFDocData = {
      type: 'purchase_order',
      number: po.po_number,
      date: po.po_date,
      validUntil: po.po_due_date,
      notes: po.po_notes,
      subtotal,
      discount: 0,
      vat: computedVat,
      total: subtotal + computedVat,
      contact: {
        name: po.contact_name || '',
        vat: po.contact_vat || '',
        address: po.contact_address || '',
        phone: po.contact_phone || '',
      },
      items: items.map((it: any) => ({
        product: it.item_product,
        qty: Number(it.item_qty),
        price: Number(it.item_cost),
        vatFlag: it.item_vat ? 1 : 0,
        subtotal: Number(it.item_subtotal),
      })),
    };

    const { filename, filepath } = await generatePdf(docData, co);

    const htmlBody = body
      ? body.split('\n').map((line: string) => line.trim() ? `<p>${line}</p>` : '<br>').join('')
      : `<p>Please find attached purchase order #${po.po_number}.</p>`;

    const result = await sendEmail({
      to,
      cc: cc || undefined,
      subject: subject || `Purchase Order ${po.po_number}`,
      html: htmlBody,
      attachments: [{ filename, path: filepath, contentType: 'application/pdf' }],
    });

    if (!result.success) {
      res.status(502).json({ success: false, error: result.error || 'Failed to send email' });
      return;
    }

    // Mark PO as sent if it was a draft
    if (po.po_status === 0) {
      await db.execute('UPDATE purchase_orders SET po_status = 1, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);
    }

    res.json({ success: true, message: 'Email sent successfully', messageId: result.messageId });
  } catch (err) {
    next(err);
  }
});

/* ──────────────────────────────────────────────────────────── *
 *  POST /purchase-orders/create-from-invoice/:invoiceId
 *  Creates a PO from an invoice, mapping cost prices
 * ──────────────────────────────────────────────────────────── */
purchaseOrdersRouter.post('/create-from-invoice/:invoiceId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { invoiceId } = req.params;
    const { contact_id } = req.body; // Supplier contact ID (may differ from invoice customer)

    const invoice = await db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw notFound('Invoice not found');

    const invoiceItems = await db.query<any>(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [invoiceId]
    );

    // Resolve supplier: use provided contact_id, or fall back to invoice customer
    const supplierId = contact_id || invoice.contact_id;
    const supplier = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [supplierId]);
    if (!supplier) throw badRequest('Supplier contact not found');

    const now = toMySQLDate(new Date());
    const poNumber = await generatePONumber();

    // Check uniqueness
    let finalPONumber = poNumber;
    const existingPO = await db.queryOne('SELECT id FROM purchase_orders WHERE po_number = ?', [poNumber]);
    if (existingPO) finalPONumber = `${poNumber}-${Date.now()}`;

    // Calculate total from cost prices
    const poTotal = invoiceItems.reduce((sum: number, it: any) => {
      const cost = it.item_cost != null ? Number(it.item_cost) : 0;
      const qty = Number(it.item_quantity) || 1;
      return sum + (cost * qty);
    }, 0);

    const insertId = await db.insertOne('purchase_orders', {
      po_number: finalPONumber,
      contact_id: supplierId,
      invoice_id: parseInt(invoiceId),
      po_amount: poTotal,
      po_date: new Date().toISOString().split('T')[0],
      due_date: null,
      po_status: 0,
      po_user_id: req.user?.id || null,
      remarks: `Created from Invoice #${invoice.invoice_number || invoiceId}`,
      active: 1,
      created_at: now,
      updated_at: now,
    });

    // Copy items — use cost price as the PO cost
    for (const item of invoiceItems) {
      await db.insertOne('purchase_order_items', {
        purchase_order_id: insertId,
        item_description: item.item_description || '',
        item_cost: item.item_cost != null ? Number(item.item_cost) : 0,
        item_price: item.item_price || 0,
        item_quantity: item.item_quantity || 1,
        item_discount: item.item_discount || 0,
        item_vat: item.item_vat || 0,
        created_at: now,
        updated_at: now,
      });
    }

    // Fetch created PO
    const created = await db.queryOne<any>(
      `SELECT ${PO_SELECT} FROM purchase_orders po LEFT JOIN contacts c ON c.id = po.contact_id WHERE po.id = ?`,
      [insertId]
    );

    res.status(201).json({
      success: true,
      message: `Purchase order ${finalPONumber} created from invoice`,
      data: created,
    });
  } catch (err) {
    next(err);
  }
});
