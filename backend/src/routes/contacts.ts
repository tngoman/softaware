import { Router, Response } from 'express';
import { z } from 'zod';
import { db, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Contact } from '../db/businessTypes.js';
import { loadCompanySettings, logoToBase64 } from '../utils/pdfGenerator.js';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';

export const contactsRouter = Router();

// Validation schemas
const createContactSchema = z.object({
  company_name: z.string().nullish(),
  contact_name: z.string().nullish(),
  contact_person: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')),
  contact_email: z.string().email().nullish().or(z.literal('')),
  phone: z.string().nullish(),
  contact_phone: z.string().nullish(),
  fax: z.string().nullish(),
  contact_alt_phone: z.string().nullish(),
  website: z.string().nullish(),
  location: z.string().nullish(),
  contact_address: z.string().nullish(),
  contact_code: z.string().nullish(),
  contact_vat: z.string().nullish(),
  contact_notes: z.string().nullish(),
  remarks: z.string().nullish(),
  contact_type: z.number().nullish(),
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
contactsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    let query = `SELECT ${CONTACT_SELECT},
            (SELECT GROUP_CONCAT(u.id) FROM users u WHERE u.contact_id = c.id) AS linked_user_ids,
            (SELECT GROUP_CONCAT(u.email) FROM users u WHERE u.contact_id = c.id) AS linked_user_emails
         FROM contacts c WHERE c.active = 1`;
    let countQuery = 'SELECT COUNT(*) as count FROM contacts c WHERE c.active = 1';
    const params: any[] = [];
    const countParams: any[] = [];

    // Filter by contact type (customers vs suppliers)
    const type = req.query.type as string;
    if (type === 'customers') {
      query += ' AND COALESCE(c.contact_type, 1) = 1';
      countQuery += ' AND COALESCE(c.contact_type, 1) = 1';
    } else if (type === 'suppliers') {
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

    const contacts = await db.query<any>(query, params);
    const countResult = await db.queryOne<any>(countQuery, countParams);

    res.json({
      success: true,
      data: contacts,
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
 * GET /contacts/:id - Get single contact
 */
contactsRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT},
            (SELECT GROUP_CONCAT(u.id) FROM users u WHERE u.contact_id = c.id) AS linked_user_ids,
            (SELECT GROUP_CONCAT(u.email) FROM users u WHERE u.contact_id = c.id) AS linked_user_emails
       FROM contacts c WHERE c.id = ?`,
      [id]
    );
    if (!contact) {
      throw notFound('Contact not found');
    }
    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /contacts - Create new contact
 */
contactsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
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
    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`,
      [insertId]
    );
    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /contacts/:id - Update contact
 */
contactsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateContactSchema.parse(req.body);

    // Check if contact exists
    const contact = await db.queryOne<any>('SELECT id FROM contacts WHERE id = ?', [id]);
    if (!contact) {
      throw notFound('Contact not found');
    }

    // Map frontend fields to DB fields
    const updateData: any = { updated_at: toMySQLDate(new Date()) };
    if (data.company_name || data.contact_name) updateData.company_name = data.company_name || data.contact_name;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.email || data.contact_email) updateData.email = data.email || data.contact_email;
    if (data.phone || data.contact_phone) updateData.phone = data.phone || data.contact_phone;
    if (data.fax || data.contact_alt_phone) updateData.fax = data.fax || data.contact_alt_phone;
    if (data.location || data.contact_address) updateData.location = data.location || data.contact_address;
    if (data.website !== undefined) updateData.website = data.website;
    if (data.contact_code !== undefined) updateData.contact_code = data.contact_code;
    if (data.contact_vat !== undefined) updateData.vat_number = data.contact_vat;
    if (data.contact_type !== undefined) updateData.contact_type = data.contact_type;
    if (data.remarks !== undefined || data.contact_notes !== undefined) updateData.remarks = data.remarks || data.contact_notes;
    if (data.active !== undefined) updateData.active = data.active;

    await db.execute(
      `UPDATE contacts SET ${Object.keys(updateData).map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      [...Object.values(updateData), id]
    );

    const updated = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`,
      [id]
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /contacts/:id - Soft delete contact
 */
contactsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Check if contact exists
    const contact = await db.queryOne<Contact>('SELECT * FROM contacts WHERE id = ?', [id]);
    if (!contact) {
      throw notFound('Contact not found');
    }

    // Soft delete
    await db.execute(
      'UPDATE contacts SET active = 0, updated_at = ? WHERE id = ?',
      [toMySQLDate(new Date()), id]
    );

    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /contacts/:id/quotations - Get all quotations for contact
 */
contactsRouter.get('/:id/quotations', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
    if (!contact) {
      throw notFound('Contact not found');
    }

    const quotations = await db.query(
      `SELECT q.id AS quotation_id, q.contact_id AS quotation_contact_id,
              q.quotation_number, q.quotation_amount AS quotation_total,
              q.quotation_date,
              DATE_ADD(q.quotation_date, INTERVAL 30 DAY) AS quotation_valid_until,
              q.remarks AS quotation_notes, q.active AS quotation_status,
              c.company_name AS contact_name
       FROM quotations q
       LEFT JOIN contacts c ON c.id = q.contact_id
       WHERE q.contact_id = ? ORDER BY q.quotation_date DESC`,
      [id]
    );
    res.json({ success: true, data: quotations });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /contacts/:id/invoices - Get all invoices for contact
 */
contactsRouter.get('/:id/invoices', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Verify contact exists
    const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [id]);
    if (!contact) {
      throw notFound('Contact not found');
    }

    const invoices = await db.query(
      `SELECT i.id AS invoice_id, i.contact_id AS invoice_contact_id,
              i.invoice_number, i.invoice_amount AS invoice_total,
              i.invoice_date, i.due_date AS invoice_due_date,
              i.paid AS invoice_payment_status, i.remarks AS invoice_notes,
              i.active, i.quotation_id AS invoice_quote_id,
              c.company_name AS contact_name
       FROM invoices i
       LEFT JOIN contacts c ON c.id = i.contact_id
       WHERE i.contact_id = ? ORDER BY i.invoice_date DESC`,
      [id]
    );
    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /contacts/:id/statement-data - Get statement data with aging analysis
 */
contactsRouter.get('/:id/statement-data', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`,
      [id]
    );
    if (!contact) {
      throw notFound('Contact not found');
    }

    // Get all invoices for this contact
    const invoices = await db.query<any>(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date,
              i.invoice_amount, i.paid,
              COALESCE(
                (SELECT SUM(p.payment_amount) FROM payments p WHERE p.invoice_id = i.id), 0
              ) as total_paid
       FROM invoices i
       WHERE i.contact_id = ? AND i.active = 1
       ORDER BY i.invoice_date ASC`,
      [id]
    );

    // Build transaction list and calculate aging
    const now = new Date();
    let closingBalance = 0;
    let aging = { current: 0, '30_days': 0, '60_days': 0, '90_days': 0, total: 0 };
    const transactions: any[] = [];

    for (const inv of invoices) {
      const amount = Number(inv.invoice_amount) || 0;
      const paid = Number(inv.total_paid) || 0;
      const balance = amount - paid;

      // Calculate days overdue for this invoice
      const dueDate = new Date(inv.due_date || inv.invoice_date);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Add invoice as a transaction
      transactions.push({
        date: inv.invoice_date,
        type: 'invoice' as const,
        reference: inv.invoice_number,
        description: `Invoice ${inv.invoice_number}`,
        invoice_id: inv.id,
        amount: amount,
        debit: amount,
        credit: 0,
        balance: 0,
        payment_status: Number(inv.paid) || 0,
        days_overdue: balance > 0 ? daysOverdue : 0,
        due_date: inv.due_date,
      });

      // Add payments for this invoice
      const payments = await db.query<any>(
        'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC',
        [inv.id]
      );
      for (const pmt of payments) {
        transactions.push({
          date: pmt.payment_date,
          type: 'payment' as const,
          reference: pmt.reference_number || `PMT-${pmt.id}`,
          description: `Payment — ${inv.invoice_number}${pmt.payment_method ? ' (' + pmt.payment_method + ')' : ''}`,
          invoice_id: inv.id,
          amount: -Number(pmt.payment_amount),
          debit: 0,
          credit: Number(pmt.payment_amount),
          balance: 0,
        });
      }

      // Aging calculation based on outstanding balance
      if (balance > 0) {
        if (daysOverdue <= 0) {
          aging.current += balance;
        } else if (daysOverdue <= 30) {
          aging['30_days'] += balance;
        } else if (daysOverdue <= 60) {
          aging['60_days'] += balance;
        } else {
          aging['90_days'] += balance;
        }
        aging.total += balance;
      }

      closingBalance += balance;
    }

    // Calculate running balance
    let runBal = 0;
    transactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
  } catch (err) {
    next(err);
  }
});

/**
 * GET /contacts/:id/statement - Generate statement PDF for download
 */
contactsRouter.get('/:id/statement', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`,
      [id]
    );
    if (!contact) throw notFound('Contact not found');

    // Fetch same data as statement-data
    const invoices = await db.query<any>(
      `SELECT i.id, i.invoice_number, i.invoice_date, i.due_date,
              i.invoice_amount, i.paid,
              COALESCE(
                (SELECT SUM(p.payment_amount) FROM payments p WHERE p.invoice_id = i.id), 0
              ) as total_paid
       FROM invoices i
       WHERE i.contact_id = ? AND i.active = 1
       ORDER BY i.invoice_date ASC`,
      [id]
    );

    const now = new Date();
    let closingBalance = 0;
    const aging = { current: 0, '30_days': 0, '60_days': 0, '90_days': 0, total: 0 };
    const transactions: any[] = [];

    for (const inv of invoices) {
      const amount = Number(inv.invoice_amount) || 0;
      const paid = Number(inv.total_paid) || 0;
      const balance = amount - paid;
      const dueDate = new Date(inv.due_date || inv.invoice_date);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      transactions.push({ date: inv.invoice_date, type: 'invoice', description: `Invoice ${inv.invoice_number}`, debit: amount, credit: 0, balance: 0 });

      const payments = await db.query<any>('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date ASC', [inv.id]);
      for (const pmt of payments) {
        transactions.push({ date: pmt.payment_date, type: 'payment', description: `Payment — ${inv.invoice_number}${pmt.payment_method ? ' (' + pmt.payment_method + ')' : ''}`, debit: 0, credit: Number(pmt.payment_amount), balance: 0 });
      }

      if (balance > 0) {
        if (daysOverdue <= 0) aging.current += balance;
        else if (daysOverdue <= 30) aging['30_days'] += balance;
        else if (daysOverdue <= 60) aging['60_days'] += balance;
        else aging['90_days'] += balance;
        aging.total += balance;
      }
      closingBalance += balance;
    }

    transactions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runBal = 0;
    for (const t of transactions) { runBal += t.debit - t.credit; t.balance = runBal; }

    // Build HTML for statement PDF
    const co = await loadCompanySettings();
    const logoDataUri = await logoToBase64(co.site_logo);
    const R = (v: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
    const fmtDate = (d: string | Date) => {
      try {
        const date = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(date.getTime())) return String(d);
        return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
      } catch { return String(d); }
    };
    const contactName = contact.contact_company || contact.contact_person || '';
    const stmtDate = fmtDate(now.toISOString());

    const transRows = transactions.map(t => `
      <tr style="${t.type === 'payment' ? 'background:#F0FDF4;' : ''}">
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:11px">${fmtDate(t.date)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:11px">${t.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;text-align:right">${t.debit > 0 ? R(t.debit) : ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;text-align:right;color:#16A34A">${t.credit > 0 ? R(t.credit) : ''}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:11px;text-align:right;font-weight:600">${R(t.balance)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;color:#1F2937}
      .header{background:linear-gradient(135deg,#00A4EE,#0066CC);color:#fff;padding:24px 30px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
      .section{background:#fff;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:16px;overflow:hidden}
      .section-title{background:#F9FAFB;padding:12px 16px;font-weight:700;font-size:13px;border-bottom:1px solid #E5E7EB;color:#374151}
      table{width:100%;border-collapse:collapse}
    </style></head><body>
      <div class="header">
        <div>
          ${logoDataUri
            ? `<div style="background:#fff;border-radius:8px;padding:8px;display:inline-block"><img src="${logoDataUri}" style="max-height:60px;max-width:180px" /></div>`
            : `<div style="font-size:22px;font-weight:700">${co.site_name || 'Statement'}</div>`
          }
          <div style="font-size:12px;opacity:0.9">${co.site_email || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:700">STATEMENT</div>
          <div style="font-size:11px;opacity:0.9">Date: ${stmtDate}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Account Details</div>
        <div style="padding:14px 16px;display:flex;gap:40px;font-size:12px">
          <div><div style="color:#6B7280;margin-bottom:2px">Customer</div><div style="font-weight:600">${contactName}</div></div>
          <div><div style="color:#6B7280;margin-bottom:2px">Email</div><div>${contact.contact_email || '-'}</div></div>
          <div><div style="color:#6B7280;margin-bottom:2px">Phone</div><div>${contact.contact_phone || '-'}</div></div>
          <div><div style="color:#6B7280;margin-bottom:2px">VAT No.</div><div>${contact.contact_vat_number || '-'}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title" style="background:#FEF2F2;color:#991B1B">Aging Summary</div>
        <div style="padding:14px 16px;display:flex;gap:12px">
          <div style="flex:1;text-align:center;background:#F0FDF4;border:2px solid #22C55E;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#6B7280">CURRENT</div><div style="font-size:16px;font-weight:700">${R(aging.current)}</div>
          </div>
          <div style="flex:1;text-align:center;background:#FEFCE8;border:2px solid #EAB308;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#6B7280">31-60 DAYS</div><div style="font-size:16px;font-weight:700">${R(aging['30_days'])}</div>
          </div>
          <div style="flex:1;text-align:center;background:#FFF7ED;border:2px solid #F97316;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#6B7280">61-90 DAYS</div><div style="font-size:16px;font-weight:700">${R(aging['60_days'])}</div>
          </div>
          <div style="flex:1;text-align:center;background:#FEF2F2;border:2px solid #EF4444;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#6B7280">90+ DAYS</div><div style="font-size:16px;font-weight:700">${R(aging['90_days'])}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Transaction History</div>
        <table>
          <thead><tr style="background:#00A4EE;color:#fff">
            <th style="padding:8px 12px;text-align:left;font-size:11px">DATE</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px">DESCRIPTION</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px">DEBIT</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px">CREDIT</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px">BALANCE</th>
          </tr></thead>
          <tbody>
            ${transRows}
            <tr style="background:#00A4EE;color:#fff">
              <td colspan="3"></td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:12px">CLOSING BALANCE:</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px">${R(closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="text-align:center;padding:16px;font-size:11px;color:#9CA3AF">
        This is a computer-generated statement and does not require a signature.
      </div>
    </body></html>`;

    // Render to PDF
    const PUBLIC_DIR = path.join(import.meta.dirname || __dirname, '..', '..', 'public');
    const outDir = path.join(PUBLIC_DIR, 'pdfs');
    await fs.mkdir(outDir, { recursive: true });
    const timestamp = Math.floor(Date.now() / 1000);
    const safeContact = contactName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const filename = `statement_${safeContact}_${timestamp}.pdf`;
    const filepath = path.join(outDir, filename);
    const webPath = `public/pdfs/${filename}`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.pdf({ path: filepath, format: 'A4', printBackground: true, margin: { top: '16px', bottom: '16px', left: '15px', right: '15px' } });
    } finally {
      await browser.close();
    }

    res.json({ success: true, filename, path: webPath });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /contacts/:id/expenses - Get all expense transactions for a supplier contact
 * Matches transactions_vat.party_name against contacts.company_name
 */
contactsRouter.get('/:id/expenses', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts c WHERE c.id = ?`,
      [id]
    );
    if (!contact) {
      throw notFound('Contact not found');
    }

    // Get the supplier's company_name from the contacts table
    const contactRaw = await db.queryOne<any>('SELECT company_name FROM contacts WHERE id = ?', [id]);
    const supplierName = contactRaw?.company_name;
    if (!supplierName) {
      return res.json({ success: true, data: [], summary: { total_expenses: 0, total_vat: 0, total_exclusive: 0, count: 0 } });
    }

    // Get all expense transactions matching this supplier
    const expenses = await db.query<any>(
      `SELECT tv.*, tec.category_name
       FROM transactions_vat tv
       LEFT JOIN tb_expense_categories tec ON tec.category_id = tv.expense_category_id
       WHERE tv.party_name = ? AND tv.transaction_type = 'expense'
       ORDER BY tv.transaction_date DESC`,
      [supplierName]
    );

    // Calculate summary stats
    let totalExpenses = 0;
    let totalVat = 0;
    let totalExclusive = 0;
    for (const exp of expenses) {
      totalExpenses += Number(exp.total_amount) || 0;
      totalVat += Number(exp.vat_amount) || 0;
      totalExclusive += Number(exp.exclusive_amount) || 0;
    }

    res.json({
      success: true,
      data: expenses,
      summary: {
        total_expenses: totalExpenses,
        total_vat: totalVat,
        total_exclusive: totalExclusive,
        count: expenses.length,
      },
    });
  } catch (err) {
    next(err);
  }
});
