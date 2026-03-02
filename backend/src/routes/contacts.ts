import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
import type { Contact } from '../db/businessTypes.js';

export const contactsRouter = Router();

// Validation schemas
const createContactSchema = z.object({
  company_name: z.string().min(1),
  contact_person: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  contact_code: z.string().optional(),
  remarks: z.string().optional(),
  active: z.number().default(1),
});

const updateContactSchema = createContactSchema.partial();

// ── SQL fragment that aliases contact columns to match the frontend Contact interface ──
const CONTACT_SELECT = `
  id            AS contact_id,
  company_name  AS contact_name,
  contact_person,
  location      AS contact_address,
  email         AS contact_email,
  phone         AS contact_phone,
  fax           AS contact_alt_phone,
  remarks       AS contact_notes,
  website,
  contact_code,
  active,
  1             AS contact_type
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

    let query = `SELECT ${CONTACT_SELECT} FROM contacts WHERE active = 1`;
    let countQuery = 'SELECT COUNT(*) as count FROM contacts WHERE active = 1';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      const searchClause = ' AND (company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
      const searchVal = `%${search}%`;
      query += searchClause;
      countQuery += searchClause;
      params.push(searchVal, searchVal, searchVal);
      countParams.push(searchVal, searchVal, searchVal);
    }

    query += ' ORDER BY company_name ASC LIMIT ? OFFSET ?';
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
      `SELECT ${CONTACT_SELECT} FROM contacts WHERE id = ?`,
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
    const insertId = await db.insertOne('contacts', {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const contact = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts WHERE id = ?`,
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

    // Update with timestamp
    const updateData = { ...data, updated_at: new Date().toISOString() };
    await db.execute('UPDATE contacts SET ? WHERE id = ?', [updateData, id]);

    const updated = await db.queryOne<any>(
      `SELECT ${CONTACT_SELECT} FROM contacts WHERE id = ?`,
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
      [new Date().toISOString(), id]
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
