import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../utils/httpErrors.js';
export const accountingRouter = Router();
// ============= Accounts Routes =============
const createAccountSchema = z.object({
    account_code: z.string().min(1),
    account_name: z.string().min(1),
    account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
    account_category: z.string().optional(),
    description: z.string().optional(),
    active: z.number().default(1),
});
const updateAccountSchema = createAccountSchema.partial();
/**
 * GET /accounting/accounts - List all accounts
 */
accountingRouter.get('/accounts', requireAuth, async (req, res, next) => {
    try {
        const type = req.query.type;
        let query = 'SELECT * FROM accounts WHERE active = 1';
        const params = [];
        if (type) {
            query += ' AND account_type = ?';
            params.push(type);
        }
        query += ' ORDER BY account_code';
        const accounts = await db.query(query, params);
        res.json({ success: true, data: accounts });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /accounting/accounts/:id - Get single account
 */
accountingRouter.get('/accounts/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const account = await db.queryOne('SELECT * FROM accounts WHERE id = ?', [id]);
        if (!account) {
            throw notFound('Account not found');
        }
        res.json({ success: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /accounting/accounts - Create account
 */
accountingRouter.post('/accounts', requireAuth, async (req, res, next) => {
    try {
        const data = createAccountSchema.parse(req.body);
        // Check if account code is unique
        const existing = await db.queryOne('SELECT id FROM accounts WHERE account_code = ?', [data.account_code]);
        if (existing) {
            throw badRequest('Account code already exists');
        }
        const insertId = await db.insertOne('accounts', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const account = await db.queryOne('SELECT * FROM accounts WHERE id = ?', [insertId]);
        res.status(201).json({ success: true, data: account });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /accounting/accounts/:id - Update account
 */
accountingRouter.put('/accounts/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateAccountSchema.parse(req.body);
        const account = await db.queryOne('SELECT id FROM accounts WHERE id = ?', [id]);
        if (!account) {
            throw notFound('Account not found');
        }
        const updateData = { ...data, updated_at: new Date().toISOString() };
        await db.execute('UPDATE accounts SET ? WHERE id = ?', [updateData, id]);
        const updated = await db.queryOne('SELECT * FROM accounts WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
// ============= Transactions Routes =============
const createTransactionSchema = z.object({
    transaction_date: z.string().date(),
    account_id: z.number().int().positive(),
    debit_amount: z.number().nonnegative().default(0),
    credit_amount: z.number().nonnegative().default(0),
    description: z.string().optional(),
    reference_number: z.string().optional(),
});
/**
 * GET /accounting/transactions - List transactions with filtering
 */
accountingRouter.get('/transactions', requireAuth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const account_id = req.query.account_id ? parseInt(req.query.account_id) : undefined;
        const type = req.query.type;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const search = req.query.search || '';
        let query = 'SELECT t.*, a.account_name, a.account_code, a.account_type FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as count FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id WHERE 1=1';
        const params = [];
        const countParams = [];
        if (account_id) {
            query += ' AND t.account_id = ?';
            countQuery += ' AND t.account_id = ?';
            params.push(account_id);
            countParams.push(account_id);
        }
        if (type) {
            query += ' AND a.account_type = ?';
            countQuery += ' AND a.account_type = ?';
            params.push(type);
            countParams.push(type);
        }
        if (startDate) {
            query += ' AND t.transaction_date >= ?';
            countQuery += ' AND t.transaction_date >= ?';
            params.push(startDate);
            countParams.push(startDate);
        }
        if (endDate) {
            query += ' AND t.transaction_date <= ?';
            countQuery += ' AND t.transaction_date <= ?';
            params.push(endDate);
            countParams.push(endDate);
        }
        if (search) {
            query += ' AND (t.description LIKE ? OR t.reference_number LIKE ?)';
            countQuery += ' AND (t.description LIKE ? OR t.reference_number LIKE ?)';
            const searchVal = `%${search}%`;
            params.push(searchVal, searchVal);
            countParams.push(searchVal, searchVal);
        }
        query += ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const transactions = await db.query(query, params);
        const countResult = await db.queryOne(countQuery, countParams);
        res.json({
            success: true,
            data: transactions,
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
 * POST /accounting/transactions - Create transaction
 */
accountingRouter.post('/transactions', requireAuth, async (req, res, next) => {
    try {
        const data = createTransactionSchema.parse(req.body);
        // Verify account exists
        const account = await db.queryOne('SELECT id FROM accounts WHERE id = ?', [data.account_id]);
        if (!account) {
            throw badRequest('Account not found');
        }
        const insertId = await db.insertOne('transactions', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const transaction = await db.queryOne('SELECT * FROM transactions WHERE id = ?', [insertId]);
        res.status(201).json({ success: true, data: transaction });
    }
    catch (err) {
        next(err);
    }
});
// ============= Ledger Routes =============
const createLedgerSchema = z.object({
    ledger_date: z.string().date(),
    account_id: z.number().int().positive(),
    debit_amount: z.number().nonnegative().default(0),
    credit_amount: z.number().nonnegative().default(0),
    balance: z.number(),
    description: z.string().optional(),
    reference_number: z.string().optional(),
});
/**
 * GET /accounting/ledger - Get ledger entries
 */
accountingRouter.get('/ledger', requireAuth, async (req, res, next) => {
    try {
        const account_id = req.query.account_id ? parseInt(req.query.account_id) : undefined;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM ledger WHERE 1=1';
        const params = [];
        if (account_id) {
            query += ' AND account_id = ?';
            params.push(account_id);
        }
        query += ' ORDER BY ledger_date DESC, id DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const entries = await db.query(query, params);
        const countQuery = 'SELECT COUNT(*) as count FROM ledger' + (account_id ? ' WHERE account_id = ?' : '');
        const countParams = account_id ? [account_id] : [];
        const countResult = await db.queryOne(countQuery, countParams);
        res.json({
            success: true,
            data: entries,
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
 * GET /accounting/accounts/:id/balance - Get account balance
 */
accountingRouter.get('/accounts/:id/balance', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const account = await db.queryOne('SELECT * FROM accounts WHERE id = ?', [id]);
        if (!account) {
            throw notFound('Account not found');
        }
        // Get the latest ledger entry for this account
        const latestLedger = await db.queryOne('SELECT * FROM ledger WHERE account_id = ? ORDER BY ledger_date DESC, id DESC LIMIT 1', [id]);
        const balance = latestLedger?.balance || 0;
        res.json({
            success: true,
            data: {
                account_id: id,
                account_code: account.account_code,
                account_name: account.account_name,
                balance,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// ============= Tax Rates Routes =============
const createTaxRateSchema = z.object({
    tax_name: z.string().min(1),
    tax_percentage: z.number().positive(),
    description: z.string().optional(),
    active: z.number().default(1),
});
const updateTaxRateSchema = createTaxRateSchema.partial();
/**
 * GET /accounting/tax-rates - List tax rates
 */
accountingRouter.get('/tax-rates', requireAuth, async (req, res, next) => {
    try {
        const taxRates = await db.query('SELECT * FROM tax_rates WHERE active = 1 ORDER BY tax_name');
        res.json({ success: true, data: taxRates });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /accounting/tax-rates - Create tax rate
 */
accountingRouter.post('/tax-rates', requireAuth, async (req, res, next) => {
    try {
        const data = createTaxRateSchema.parse(req.body);
        const insertId = await db.insertOne('tax_rates', {
            ...data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const taxRate = await db.queryOne('SELECT * FROM tax_rates WHERE id = ?', [insertId]);
        res.status(201).json({ success: true, data: taxRate });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /accounting/tax-rates/:id - Update tax rate
 */
accountingRouter.put('/tax-rates/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const data = updateTaxRateSchema.parse(req.body);
        const taxRate = await db.queryOne('SELECT id FROM tax_rates WHERE id = ?', [id]);
        if (!taxRate) {
            throw notFound('Tax rate not found');
        }
        const updateData = { ...data, updated_at: new Date().toISOString() };
        await db.execute('UPDATE tax_rates SET ? WHERE id = ?', [updateData, id]);
        const updated = await db.queryOne('SELECT * FROM tax_rates WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
