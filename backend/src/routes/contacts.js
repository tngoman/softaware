import { Router } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const contactsRouter = Router();
// Validation schemas
const createContactSchema = z.object({
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    contact_person: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    contact_email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    contact_phone: z.string().optional(),
    fax: z.string().optional(),
    contact_alt_phone: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    contact_address: z.string().optional(),
    contact_code: z.string().optional(),
    contact_vat: z.string().optional(),
    contact_notes: z.string().optional(),
    remarks: z.string().optional(),
    contact_type: z.number().optional(),
    active: z.number().default(1),
});
const updateContactSchema = createContactSchema.partial();
// ── SQL fragment that aliases contact columns to match the frontend Contact interface ──
const CONTACT_SELECT = `
  c.id            AS contact_id,
  c.company_name  AS contact_name,
  c.contact_person,
  c.location      AS contact_address,
  c.email         AS contact_email,
  c.phone         AS contact_phone,
  c.fax           AS contact_alt_phone,
  c.remarks       AS contact_notes,
  c.vat_number    AS contact_vat,
  c.website,
  c.contact_code,
  c.active,
  COALESCE(c.contact_type, 1) AS contact_type
`;
/**
 * GET /contacts - List all contacts with pagination and search
 */
contactsRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        let query = `SELECT ${CONTACT_SELECT},
            (SELECT GROUP_CONCAT(u.id) FROM users u WHERE u.contact_id = c.id) AS linked_user_ids,
            (SELECT GROUP_CONCAT(u.email) FROM users u WHERE u.contact_id = c.id) AS linked_user_emails
         FROM contacts c WHERE c.active = 1`;
        let countQuery = 'SELECT COUNT(*) as count FROM contacts c WHERE c.active = 1';
        const params = [];
        const countParams = [];
        // Filter by contact type (customers vs suppliers)
        const type = req.query.type;
        if (type === 'customers') {
            query += ' AND COALESCE(c.contact_type, 1) = 1';
            countQuery += ' AND COALESCE(c.contact_type, 1) = 1';
        }
        else if (type === 'suppliers') {
            query += ' AND c.contact_type = 2';
            countQuery += ' AND c.contact_type = 2';
        }
        if (search) {
            const searchClause = ' AND (c.company_name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ?)';
            const searchVal = `%${search}%`;
            query += searchClause;
            countQuery += searchClause;
            params.push(searchVal, searchVal, searchVal);
            countParams.push(searchVal, searchVal, searchVal);
        }
        query += ' ORDER BY c.company_name ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const contacts = await db.query(query, params);
        const countResult = await db.queryOne(countQuery, countParams);
        res.json({
            success: true,
            data: contacts,
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
 * GET /contacts/:id - Get single contact
 */
contactsRouter.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const contact = await db.queryOne(`SELECT ${CONTACT_SELECT},
            (SELECT GROUP_CONCAT(u.id) FROM users u WHERE u.contact_id = c.id) AS linked_user_ids,
            (SELECT GROUP_CONCAT(u.email) FROM users u WHERE u.contact_id = c.id) AS linked_user_emails
       FROM contacts c WHERE c.id = ?`, [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        res.json({ success: true, data: contact });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /contacts - Create new contact
 */
contactsRouter.post('/', requireAuth, async (req, res, next) => {
    try {
        const data = createContactSchema.parse(req.body);
        const companyName = data.company_name || data.contact_name;
        if (!companyName) {
            throw badRequest('Company name is required');
        }
        const insertId = await db.insertOne('contacts', {
            company_name: companyName,
            contact_person: data.contact_person || null,
            email: data.email || data.contact_email || null,
            phone: data.phone || data.contact_phone || null,
            fax: data.fax || data.contact_alt_phone || null,
            location: data.location || data.contact_address || null,
            website: data.website || null,
            contact_code: data.contact_code || null,
            vat_number: data.contact_vat || null,
            contact_type: data.contact_type || 1,
            remarks: data.remarks || data.contact_notes || null,
            active: data.active ?? 1,
            created_at: toMySQLDate(new Date()),
            updated_at: toMySQLDate(new Date()),
        });
        const contact = await db.queryOne(`SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`, [insertId]);
        res.status(201).json({ success: true, data: contact });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /contacts/:id - Update contact
 */
contactsRouter.put('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateContactSchema.parse(req.body);
        // Check if contact exists
        const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        // Map frontend fields to DB fields
        const updateData = { updated_at: toMySQLDate(new Date()) };
        if (data.company_name || data.contact_name)
            updateData.company_name = data.company_name || data.contact_name;
        if (data.contact_person !== undefined)
            updateData.contact_person = data.contact_person;
        if (data.email || data.contact_email)
            updateData.email = data.email || data.contact_email;
        if (data.phone || data.contact_phone)
            updateData.phone = data.phone || data.contact_phone;
        if (data.fax || data.contact_alt_phone)
            updateData.fax = data.fax || data.contact_alt_phone;
        if (data.location || data.contact_address)
            updateData.location = data.location || data.contact_address;
        if (data.website !== undefined)
            updateData.website = data.website;
        if (data.contact_code !== undefined)
            updateData.contact_code = data.contact_code;
        if (data.contact_vat !== undefined)
            updateData.vat_number = data.contact_vat;
        if (data.contact_type !== undefined)
            updateData.contact_type = data.contact_type;
        if (data.remarks !== undefined || data.contact_notes !== undefined)
            updateData.remarks = data.remarks || data.contact_notes;
        if (data.active !== undefined)
            updateData.active = data.active;
        await db.execute(`UPDATE contacts SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(updateData), id]);
        const updated = await db.queryOne(`SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`, [id]);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /contacts/:id - Soft delete contact
 */
contactsRouter.delete('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Check if contact exists
        const contact = await db.queryOne('SELECT * FROM contacts WHERE id = ?', [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        // Soft delete
        await db.execute('UPDATE contacts SET active = 0, updated_at = ? WHERE id = ?', [toMySQLDate(new Date()), id]);
        res.json({ success: true, message: 'Contact deleted' });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /contacts/:id/quotations - Get all quotations for contact
 */
contactsRouter.get('/:id/quotations', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify contact exists
        const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        const quotations = await db.query(`SELECT q.id AS quotation_id, q.contact_id AS quotation_contact_id,
              q.quotation_number, q.quotation_amount AS quotation_total,
              q.quotation_date,
              DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until,
              q.remarks AS quotation_notes, q.active AS quotation_status,
              c.company_name AS contact_name
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.contact_id = ? ORDER BY q.quotation_date DESC`, [id]);
        res.json({ success: true, data: quotations });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /contacts/:id/invoices - Get all invoices for contact
 */
contactsRouter.get('/:id/invoices', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify contact exists
        const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        const invoices = await db.query(`SELECT i.id AS invoice_id, i.contact_id AS invoice_contact_id,
              i.invoice_number, i.invoice_amount AS invoice_total,
              i.invoice_date, i.due_date AS invoice_due_date,
              i.paid AS invoice_payment_status, i.remarks AS invoice_notes,
              i.active, i.quotation_id AS invoice_quote_id,
              c.company_name AS contact_name
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.contact_id = ? ORDER BY i.invoice_date DESC`, [id]);
        res.json({ success: true, data: invoices });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /contacts/:id/statement-data - Get statement data with aging analysis
 */
contactsRouter.get('/:id/statement-data', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const contact = await db.queryOne(`SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`, [id]);
        if (!contact) {
            throw notFound('Contact not found');
        }
        // Get all invoices for this contact
        const invoices = await db.query(`SELECT i.id, i.invoice_number, i.invoice_date, i.due_date,
              i.invoice_amount, i.paid,
              COALESCE(
                (SELECT SUM(p.payment_amount) FROM payments p WHERE p.invoice_id = i.id), 0
              ) as total_paid
       FROM invoices i
       WHERE i.contact_id = ? AND i.active = 1
       ORDER BY i.invoice_date ASC`, [id]);
        // Build transaction list and calculate aging
        const now = new Date();
        let closingBalance = 0;
        let aging = { current: 0, '30_days': 0, '60_days': 0, '90_days': 0, total: 0 };
        const transactions = [];
        for (const inv of invoices) {
            const amount = Number(inv.invoice_amount) || 0;
            const paid = Number(inv.total_paid) || 0;
            const balance = amount - paid;
            // Add invoice as a transaction
            transactions.push({
                date: inv.invoice_date,
                type: 'invoice',
                reference: inv.invoice_number,
                description: `Invoice ${inv.invoice_number}`,
                debit: amount,
                credit: 0,
                balance: 0, // Will be running balance
            });
            // Add payments for this invoice
            const payments = await db.query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC', [inv.id]);
            for (const pmt of payments) {
                transactions.push({
                    date: pmt.payment_date,
                    type: 'payment',
                    reference: pmt.reference_number || `PMT-${pmt.id}`,
                    description: `Payment for ${inv.invoice_number}`,
                    debit: 0,
                    credit: Number(pmt.payment_amount),
                    balance: 0,
                });
            }
            // Aging calculation based on outstanding balance
            if (balance > 0) {
                const dueDate = new Date(inv.due_date || inv.invoice_date);
                const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysOverdue <= 0) {
                    aging.current += balance;
                }
                else if (daysOverdue <= 30) {
                    aging['30_days'] += balance;
                }
                else if (daysOverdue <= 60) {
                    aging['60_days'] += balance;
                }
                else {
                    aging['90_days'] += balance;
                }
                aging.total += balance;
            }
            closingBalance += balance;
        }
        // Calculate running balance
        let runBal = 0;
        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (const t of transactions) {
            runBal += t.debit - t.credit;
            t.balance = runBal;
        }
        res.json({
            success: true,
            data: {
                contact,
                transactions,
                closing_balance: closingBalance,
                aging,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
