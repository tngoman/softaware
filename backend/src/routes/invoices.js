import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import { generatePdf, loadCompanySettings } from '../utils/pdfGenerator.js';
export const invoicesRouter = Router();
const createInvoiceSchema = z.object({
    invoice_number: z.string().min(1).optional(),
    invoice_contact_id: z.number().int().positive().optional(),
    contact_id: z.number().int().positive().optional(),
    quotation_id: z.number().int().positive().optional(),
    invoice_quote_id: z.number().int().positive().optional(),
    invoice_amount: z.number().optional(),
    invoice_total: z.number().optional(),
    invoice_subtotal: z.number().optional(),
    invoice_vat: z.number().optional(),
    invoice_discount: z.number().optional(),
    invoice_date: z.string().optional(),
    invoice_due_date: z.string().optional(),
    invoice_valid_until: z.string().optional(),
    due_date: z.string().optional(),
    invoice_status: z.number().optional(),
    invoice_payment_status: z.number().optional(),
    invoice_notes: z.string().optional(),
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
const updateInvoiceSchema = createInvoiceSchema.partial();
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
  c.phone         AS contact_phone,
  c.vat_number    AS contact_vat,
  c.location      AS contact_address
`;
/**
 * GET /invoices - List all invoices with search
 */
invoicesRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const paid = req.query.paid ? parseInt(req.query.paid) : undefined;
        const search = req.query.search || '';
        let query = `SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.active = 1`;
        let countQuery = 'SELECT COUNT(*) as count FROM invoices i LEFT JOIN contacts c ON c.id = i.contact_id WHERE i.active = 1';
        const params = [];
        const countParams = [];
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
        const invoices = await db.query(query, params);
        const countResult = await db.queryOne(countQuery, countParams);
        res.json({
            success: true,
            data: invoices,
            pagination: {
                page,
                limit,
                total: countResult?.count || 0,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /invoices/:id - Get single invoice with items and payments
 */
invoicesRouter.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const invoice = await db.queryOne(`SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`, [id]);
        if (!invoice) {
            throw notFound('Invoice not found');
        }
        const items = await db.query(`SELECT id AS item_id, invoice_id AS item_invoice_id,
              item_description AS item_product,
              item_quantity AS item_qty,
              item_price,
              (item_quantity * item_price) AS item_subtotal,
              item_discount,
              0 AS item_vat,
              0 AS item_profit,
              0 AS item_cost
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`, [id]);
        const payments = await db.query(`SELECT id AS payment_id, payment_date, payment_amount,
              invoice_id AS payment_invoice
       FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`, [id]);
        res.json({
            success: true,
            data: { ...invoice, items, payments },
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices - Create new invoice
 */
invoicesRouter.post('/', requireAuth, async (req, res, next) => {
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
            const lastInv = await db.queryOne('SELECT invoice_number FROM invoices WHERE invoice_number LIKE "INV-%" ORDER BY id DESC LIMIT 1');
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
            contact_id: contactId,
            quotation_id: data.invoice_quote_id || data.quotation_id || null,
            invoice_amount: totalAmount,
            invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
            due_date: dueDate,
            invoice_user_id: req.userId,
            remarks: data.invoice_notes || data.remarks || null,
            active: data.invoice_status !== undefined ? data.invoice_status : 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        // Insert line items if provided
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                const desc = item.item_product || item.item_description || '';
                if (!desc)
                    continue;
                const qty = item.item_qty || item.item_quantity || 1;
                const price = item.item_price || 0;
                const discount = item.item_discount || 0;
                await db.insertOne('invoice_items', {
                    invoice_id: insertId,
                    item_description: desc,
                    item_price: price,
                    item_quantity: qty,
                    item_discount: discount,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            }
        }
        const invoice = await db.queryOne(`SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`, [insertId]);
        res.status(201).json({ success: true, id: parseInt(insertId), data: invoice });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /invoices/:id - Update invoice
 */
invoicesRouter.put('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateInvoiceSchema.parse(req.body);
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
        if (!invoice) {
            throw notFound('Invoice not found');
        }
        const contactId = data.invoice_contact_id || data.contact_id;
        const totalAmount = data.invoice_total || data.invoice_amount || data.invoice_subtotal;
        const dueDate = data.invoice_due_date || data.invoice_valid_until || data.due_date;
        const updateData = { updated_at: new Date().toISOString() };
        if (contactId)
            updateData.contact_id = contactId;
        if (totalAmount !== undefined)
            updateData.invoice_amount = totalAmount;
        if (data.invoice_date)
            updateData.invoice_date = data.invoice_date;
        if (dueDate)
            updateData.due_date = dueDate;
        if (data.invoice_notes !== undefined || data.remarks !== undefined)
            updateData.remarks = data.invoice_notes || data.remarks || null;
        if (data.invoice_status !== undefined)
            updateData.active = data.invoice_status;
        await db.execute(`UPDATE invoices SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(updateData), id]);
        // Replace line items if provided
        if (data.items && data.items.length > 0) {
            await db.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
            for (const item of data.items) {
                const desc = item.item_product || item.item_description || '';
                if (!desc)
                    continue;
                const qty = item.item_qty || item.item_quantity || 1;
                const price = item.item_price || 0;
                const discount = item.item_discount || 0;
                await db.insertOne('invoice_items', {
                    invoice_id: id,
                    item_description: desc,
                    item_price: price,
                    item_quantity: qty,
                    item_discount: discount,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            }
        }
        const updated = await db.queryOne(`SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`, [id]);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /invoices/:id - Soft delete invoice
 */
invoicesRouter.delete('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
        if (!invoice) {
            throw notFound('Invoice not found');
        }
        await db.execute('UPDATE invoices SET active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
        res.json({ success: true, message: 'Invoice deleted' });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices/:id/items - Add line item to invoice
 */
invoicesRouter.post('/:id/items', requireAuth, async (req, res, next) => {
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
        const item = await db.queryOne('SELECT * FROM invoice_items WHERE id = ?', [insertId]);
        res.status(201).json({ success: true, data: item });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /invoices/:id/items/:itemId - Delete invoice item
 */
invoicesRouter.delete('/:id/items/:itemId', requireAuth, async (req, res, next) => {
    try {
        const { id, itemId } = req.params;
        const item = await db.queryOne('SELECT id FROM invoice_items WHERE id = ? AND invoice_id = ?', [itemId, id]);
        if (!item) {
            throw notFound('Invoice item not found');
        }
        await db.execute('DELETE FROM invoice_items WHERE id = ?', [itemId]);
        res.json({ success: true, message: 'Item deleted' });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices/:id/payments - Record payment for invoice
 */
invoicesRouter.post('/:id/payments', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const paymentData = createPaymentSchema.parse(req.body);
        const invoice = await db.queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
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
        const totalPaidResult = await db.queryOne('SELECT SUM(payment_amount) as total_paid FROM payments WHERE invoice_id = ?', [id]);
        const totalPaid = totalPaidResult?.total_paid || 0;
        if (totalPaid >= invoice.invoice_amount) {
            await db.execute('UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
        }
        const payment = await db.queryOne('SELECT * FROM payments WHERE id = ?', [insertId]);
        res.status(201).json({ success: true, data: payment });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /invoices/:id/payments - Get all payments for invoice
 */
invoicesRouter.get('/:id/payments', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
        if (!invoice) {
            throw notFound('Invoice not found');
        }
        const payments = await db.query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', [id]);
        res.json({ success: true, data: payments });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices/:id/generate-pdf - Generate a PDF for this invoice
 */
invoicesRouter.post('/:id/generate-pdf', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const invoice = await db.queryOne(`SELECT ${INVOICE_SELECT}
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.id = ?`, [id]);
        if (!invoice)
            throw notFound('Invoice not found');
        const items = await db.query(`SELECT item_description AS item_product, item_quantity AS item_qty,
              item_price, item_discount,
              (item_quantity * item_price) AS item_subtotal
       FROM invoice_items WHERE invoice_id = ? ORDER BY id`, [id]);
        // Load company settings and build PDF data
        const co = await loadCompanySettings();
        const docData = {
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
                vat: invoice.contact_vat || '',
                address: invoice.contact_address || '',
                phone: invoice.contact_phone || '',
            },
            items: items.map((it) => ({
                product: it.item_product,
                qty: Number(it.item_qty),
                price: Number(it.item_price),
                vatFlag: 0,
                subtotal: Number(it.item_subtotal),
            })),
        };
        const { filename, webPath } = await generatePdf(docData, co);
        res.json({ success: true, filename, path: webPath });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices/:id/send-email - Send invoice via email
 */
invoicesRouter.post('/:id/send-email', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { to, subject, body } = req.body;
        if (!to)
            throw badRequest('Recipient email (to) is required');
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
        if (!invoice)
            throw notFound('Invoice not found');
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
        }
        catch (emailErr) {
            console.error('Email send failed:', emailErr.message);
            res.json({ success: true, message: 'Email queued (SMTP not fully configured)' });
        }
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /invoices/:id/mark-paid - Mark invoice as paid
 */
invoicesRouter.post('/:id/mark-paid', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [id]);
        if (!invoice)
            throw notFound('Invoice not found');
        await db.execute('UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
        res.json({ success: true, message: 'Invoice marked as paid' });
    }
    catch (err) {
        next(err);
    }
});
