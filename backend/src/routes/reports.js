import { Router } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
export const reportsRouter = Router();
/**
 * GET /reports - Generate various reports
 * Query params: type (trial-balance | vat | income-statement), from, to
 */
reportsRouter.get('/', requireAuth, async (req, res, next) => {
    try {
        const type = req.query.type;
        const from = req.query.from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const to = req.query.to || new Date().toISOString().split('T')[0];
        if (!type) {
            throw badRequest('Report type is required (trial-balance, vat, income-statement)');
        }
        switch (type) {
            case 'trial-balance': {
                const accounts = await db.query(`SELECT a.*, 
            COALESCE(SUM(t.debit_amount), 0) as total_debit,
            COALESCE(SUM(t.credit_amount), 0) as total_credit
           FROM accounts a
           LEFT JOIN transactions t ON a.id = t.account_id AND t.transaction_date BETWEEN ? AND ?
           WHERE a.active = 1
           GROUP BY a.id
           ORDER BY a.account_code`, [from, to]);
                const totalDebit = accounts.reduce((sum, a) => sum + Number(a.total_debit), 0);
                const totalCredit = accounts.reduce((sum, a) => sum + Number(a.total_credit), 0);
                res.json({
                    success: true,
                    data: {
                        from,
                        to,
                        accounts,
                        totals: { total_debit: totalDebit, total_credit: totalCredit },
                    },
                });
                break;
            }
            case 'vat': {
                // Get VAT-related transactions
                const taxRates = await db.query('SELECT * FROM tax_rates WHERE active = 1');
                // Calculate output VAT (from invoices)
                const outputVat = await db.queryOne(`SELECT COALESCE(SUM(invoice_amount * 0.15), 0) as vat_amount, COUNT(*) as invoice_count
           FROM invoices WHERE active = 1 AND invoice_date BETWEEN ? AND ?`, [from, to]);
                // Calculate input VAT (from expense transactions)
                const inputVat = await db.queryOne(`SELECT COALESCE(SUM(t.debit_amount * 0.15), 0) as vat_amount, COUNT(*) as transaction_count
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'expense' AND t.transaction_date BETWEEN ? AND ?`, [from, to]);
                res.json({
                    success: true,
                    data: {
                        from,
                        to,
                        tax_rates: taxRates,
                        output_vat: outputVat?.vat_amount || 0,
                        input_vat: inputVat?.vat_amount || 0,
                        net_vat: (outputVat?.vat_amount || 0) - (inputVat?.vat_amount || 0),
                    },
                });
                break;
            }
            case 'income-statement': {
                const income = await db.query(`SELECT a.*, 
            COALESCE(SUM(t.credit_amount), 0) - COALESCE(SUM(t.debit_amount), 0) as amount
           FROM accounts a
           LEFT JOIN transactions t ON a.id = t.account_id AND t.transaction_date BETWEEN ? AND ?
           WHERE a.account_type = 'income' AND a.active = 1
           GROUP BY a.id
           ORDER BY a.account_code`, [from, to]);
                const expenses = await db.query(`SELECT a.*, 
            COALESCE(SUM(t.debit_amount), 0) - COALESCE(SUM(t.credit_amount), 0) as amount
           FROM accounts a
           LEFT JOIN transactions t ON a.id = t.account_id AND t.transaction_date BETWEEN ? AND ?
           WHERE a.account_type = 'expense' AND a.active = 1
           GROUP BY a.id
           ORDER BY a.account_code`, [from, to]);
                const totalIncome = income.reduce((sum, a) => sum + Number(a.amount), 0);
                const totalExpenses = expenses.reduce((sum, a) => sum + Number(a.amount), 0);
                res.json({
                    success: true,
                    data: {
                        from,
                        to,
                        income,
                        expenses,
                        totals: {
                            total_income: totalIncome,
                            total_expenses: totalExpenses,
                            net_profit: totalIncome - totalExpenses,
                        },
                    },
                });
                break;
            }
            default:
                throw badRequest(`Unknown report type: ${type}`);
        }
    }
    catch (err) {
        next(err);
    }
});
