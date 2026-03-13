import { Router } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';
export const financialReportsRouter = Router();
// ── Helper functions (mirror PHP logic using tb_transactions / tb_invoices / tb_payments) ──
async function getBankBalance(asOfDate) {
    const result = await db.queryOne(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) -
      SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as balance
    FROM tb_transactions
    WHERE transaction_date <= ?
  `, [asOfDate]);
    return Number(result?.balance ?? 0);
}
async function getAccountsReceivable(asOfDate) {
    const result = await db.queryOne(`
    SELECT SUM(invoice_total - COALESCE(paid_amount, 0)) as total
    FROM tb_invoices
    LEFT JOIN (
      SELECT payment_invoice, SUM(payment_amount) as paid_amount
      FROM tb_payments
      WHERE payment_date <= ?
      GROUP BY payment_invoice
    ) payments ON payments.payment_invoice = tb_invoices.invoice_id
    WHERE invoice_date <= ?
    AND invoice_status != 'Paid'
  `, [asOfDate, asOfDate]);
    return Math.max(0, Number(result?.total ?? 0));
}
async function getFixedAssets(_asOfDate) {
    return 5000.00; // Placeholder - matches PHP implementation
}
async function getAccountsPayable(_asOfDate) {
    return 0.00; // Placeholder - matches PHP implementation
}
async function getSalesTaxLiability(asOfDate) {
    const result = await db.queryOne(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN vat_amount ELSE 0 END) -
      SUM(CASE WHEN transaction_type = 'expense' THEN vat_amount ELSE 0 END) as liability
    FROM tb_transactions
    WHERE transaction_date <= ?
  `, [asOfDate]);
    return Math.max(0, Number(result?.liability ?? 0));
}
async function getUnpaidExpenses(_asOfDate) {
    return 0.00; // Placeholder - matches PHP implementation
}
async function getRetainedEarnings(asOfDate) {
    const result = await db.queryOne(`
    SELECT 
      SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) -
      SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as earnings
    FROM tb_transactions
    WHERE transaction_date <= ?
  `, [asOfDate]);
    return Number(result?.earnings ?? 0);
}
async function getSales(startDate, endDate) {
    const result = await db.queryOne(`
    SELECT SUM(total_amount) as total
    FROM tb_transactions
    WHERE transaction_type = 'income'
    AND transaction_date BETWEEN ? AND ?
  `, [startDate, endDate]);
    return Number(result?.total ?? 0);
}
async function getPurchases(startDate, endDate) {
    const result = await db.queryOne(`
    SELECT SUM(t.total_amount) as total
    FROM tb_transactions t
    INNER JOIN tb_invoices i ON t.transaction_invoice_id = i.invoice_id
    WHERE t.transaction_type = 'expense'
    AND i.invoice_date BETWEEN ? AND ?
  `, [startDate, endDate]);
    return Number(result?.total ?? 0);
}
async function getExpensesByCategory(startDate, endDate) {
    const results = await db.query(`
    SELECT 
      COALESCE(ec.category_name, 'Uncategorised') as category,
      SUM(t.total_amount) as amount
    FROM tb_transactions t
    LEFT JOIN tb_expense_categories ec ON t.expense_category_id = ec.category_id
    WHERE t.transaction_type = 'expense'
    AND t.transaction_date BETWEEN ? AND ?
    AND t.transaction_invoice_id IS NULL
    GROUP BY ec.category_id, ec.category_name
    ORDER BY amount DESC
  `, [startDate, endDate]);
    return results.map((row) => ({
        category: row.category,
        amount: Number(row.amount),
    }));
}
// ── Check if tb_transactions exists; fallback to accounts-based queries ──
let useLegacyTables = null;
async function checkLegacyTables() {
    if (useLegacyTables !== null)
        return useLegacyTables;
    try {
        await db.query('SELECT 1 FROM tb_transactions LIMIT 1');
        useLegacyTables = true;
    }
    catch {
        useLegacyTables = false;
    }
    return useLegacyTables;
}
// Fallback helpers using the accounts/transactions schema (non-legacy)
async function getSalesFallback(startDate, endDate) {
    const result = await db.queryOne(`
    SELECT COALESCE(SUM(t.credit_amount - t.debit_amount), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'income'
    AND t.transaction_date BETWEEN ? AND ?
  `, [startDate, endDate]);
    return Number(result?.total ?? 0);
}
async function getPurchasesFallback(startDate, endDate) {
    const result = await db.queryOne(`
    SELECT COALESCE(SUM(t.debit_amount - t.credit_amount), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'expense'
    AND a.account_category = 'cost_of_sales'
    AND t.transaction_date BETWEEN ? AND ?
  `, [startDate, endDate]);
    return Number(result?.total ?? 0);
}
async function getExpensesByCategoryFallback(startDate, endDate) {
    const results = await db.query(`
    SELECT 
      COALESCE(a.account_name, 'Uncategorised') as category,
      SUM(t.debit_amount - t.credit_amount) as amount
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'expense'
    AND (a.account_category IS NULL OR a.account_category != 'cost_of_sales')
    AND t.transaction_date BETWEEN ? AND ?
    GROUP BY a.id, a.account_name
    HAVING amount != 0
    ORDER BY amount DESC
  `, [startDate, endDate]);
    return results.map((row) => ({
        category: row.category,
        amount: Math.round(Number(row.amount) * 100) / 100,
    }));
}
async function getBankBalanceFallback(asOfDate) {
    const result = await db.queryOne(`
    SELECT COALESCE(SUM(t.debit_amount - t.credit_amount), 0) as balance
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'asset'
    AND t.transaction_date <= ?
  `, [asOfDate]);
    return Number(result?.balance ?? 0);
}
async function getAccountsReceivableFallback(asOfDate) {
    const result = await db.queryOne(`
    SELECT SUM(i.invoice_amount - COALESCE(p.paid, 0)) as total
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(payment_amount) as paid
      FROM payments
      WHERE payment_date <= ?
      GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.invoice_date <= ?
    AND i.active = 1
    AND (i.paid IS NULL OR i.paid = 0)
  `, [asOfDate, asOfDate]);
    return Math.max(0, Number(result?.total ?? 0));
}
async function getRetainedEarningsFallback(asOfDate) {
    const income = await db.queryOne(`
    SELECT COALESCE(SUM(t.credit_amount - t.debit_amount), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'income' AND t.transaction_date <= ?
  `, [asOfDate]);
    const expenses = await db.queryOne(`
    SELECT COALESCE(SUM(t.debit_amount - t.credit_amount), 0) as total
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.account_type = 'expense' AND t.transaction_date <= ?
  `, [asOfDate]);
    return Number(income?.total ?? 0) - Number(expenses?.total ?? 0);
}
// ═══════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════
/**
 * GET /financial-reports/balance-sheet
 * Returns the exact shape the frontend BalanceSheet.tsx expects
 */
financialReportsRouter.get('/balance-sheet', requireAuth, async (req, res, next) => {
    try {
        const asOfDate = req.query.as_of_date || new Date().toISOString().split('T')[0];
        const legacy = await checkLegacyTables();
        let bank, accountsReceivable, fixedAssets;
        let accountsPayable, salesTax, unpaidExpenses;
        let retainedEarnings;
        if (legacy) {
            bank = await getBankBalance(asOfDate);
            accountsReceivable = await getAccountsReceivable(asOfDate);
            fixedAssets = await getFixedAssets(asOfDate);
            accountsPayable = await getAccountsPayable(asOfDate);
            salesTax = await getSalesTaxLiability(asOfDate);
            unpaidExpenses = await getUnpaidExpenses(asOfDate);
            retainedEarnings = await getRetainedEarnings(asOfDate);
        }
        else {
            bank = await getBankBalanceFallback(asOfDate);
            accountsReceivable = await getAccountsReceivableFallback(asOfDate);
            fixedAssets = await getFixedAssets(asOfDate);
            accountsPayable = await getAccountsPayable(asOfDate);
            salesTax = 0;
            unpaidExpenses = await getUnpaidExpenses(asOfDate);
            retainedEarnings = await getRetainedEarningsFallback(asOfDate);
        }
        const currentAssets = bank + accountsReceivable;
        const totalAssets = currentAssets + fixedAssets;
        const currentLiabilities = accountsPayable + salesTax + Math.abs(unpaidExpenses);
        const totalLiabilities = currentLiabilities;
        const netAssets = totalAssets - totalLiabilities;
        const r = (n) => Math.round(n * 100) / 100;
        res.json({
            as_of_date: asOfDate,
            assets: {
                current_assets: {
                    bank: r(bank),
                    accounts_receivable: r(accountsReceivable),
                    total: r(currentAssets),
                },
                fixed_assets: {
                    computer_equipment: r(fixedAssets * 0.6),
                    office_equipment: r(fixedAssets * 0.4),
                    total: r(fixedAssets),
                },
                total_assets: r(totalAssets),
            },
            liabilities: {
                current_liabilities: {
                    accounts_payable: r(accountsPayable),
                    sales_tax: r(salesTax),
                    unpaid_expense_claims: r(Math.abs(unpaidExpenses)),
                    total: r(currentLiabilities),
                },
                total_liabilities: r(totalLiabilities),
            },
            equity: {
                net_assets: r(netAssets),
                retained_earnings: r(retainedEarnings),
                total_equity: r(netAssets),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /financial-reports/profit-loss
 * Returns the exact shape the frontend ProfitAndLoss.tsx expects
 */
financialReportsRouter.get('/profit-loss', requireAuth, async (req, res, next) => {
    try {
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        if (!startDate || !endDate) {
            throw badRequest('start_date and end_date are required');
        }
        const legacy = await checkLegacyTables();
        let sales, purchases;
        let expenses;
        if (legacy) {
            sales = await getSales(startDate, endDate);
            purchases = await getPurchases(startDate, endDate);
            expenses = await getExpensesByCategory(startDate, endDate);
        }
        else {
            sales = await getSalesFallback(startDate, endDate);
            purchases = await getPurchasesFallback(startDate, endDate);
            expenses = await getExpensesByCategoryFallback(startDate, endDate);
        }
        const totalTradingIncome = sales;
        const totalCostOfSales = purchases;
        const grossProfit = totalTradingIncome - totalCostOfSales;
        const totalOperatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = grossProfit - totalOperatingExpenses;
        const r = (n) => Math.round(n * 100) / 100;
        res.json({
            period: {
                start: startDate,
                end: endDate,
            },
            trading_income: {
                sales: r(sales),
                total: r(totalTradingIncome),
            },
            cost_of_sales: {
                purchases: r(purchases),
                total: r(totalCostOfSales),
            },
            gross_profit: r(grossProfit),
            operating_expenses: expenses.map(e => ({
                category: e.category,
                amount: r(e.amount),
            })),
            total_operating_expenses: r(totalOperatingExpenses),
            net_profit: r(netProfit),
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /financial-reports/transaction-listing
 * Returns the exact shape the frontend TransactionListing.tsx expects
 */
financialReportsRouter.get('/transaction-listing', requireAuth, async (req, res, next) => {
    try {
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;
        const type = req.query.type;
        if (!startDate || !endDate) {
            throw badRequest('start_date and end_date are required');
        }
        const legacy = await checkLegacyTables();
        if (legacy) {
            let sql = `
        SELECT 
          transaction_id, transaction_date, transaction_type,
          party_name, invoice_number, vat_type,
          exclusive_amount, vat_amount, total_amount,
          transaction_payment_id
        FROM tb_transactions
        WHERE transaction_date BETWEEN ? AND ?
      `;
            const params = [startDate, endDate];
            if (type) {
                sql += ' AND transaction_type = ?';
                params.push(type);
            }
            sql += ' ORDER BY transaction_date ASC, transaction_id ASC';
            const rows = await db.query(sql, params);
            const totals = { net: 0, vat: 0, gross: 0 };
            const transactions = rows.map((t) => {
                totals.net += Number(t.exclusive_amount || 0);
                totals.vat += Number(t.vat_amount || 0);
                totals.gross += Number(t.total_amount || 0);
                return {
                    id: t.transaction_id,
                    date: t.transaction_date,
                    type: t.transaction_type,
                    supplier: t.party_name,
                    reference: t.invoice_number,
                    vat_type: t.vat_type,
                    net: Math.round(Number(t.exclusive_amount || 0) * 100) / 100,
                    vat: Math.round(Number(t.vat_amount || 0) * 100) / 100,
                    gross: Math.round(Number(t.total_amount || 0) * 100) / 100,
                    payment_id: t.transaction_payment_id,
                };
            });
            res.json({
                period: { start: startDate, end: endDate },
                transactions,
                totals: {
                    gross: Math.round(totals.gross * 100) / 100,
                    vat: Math.round(totals.vat * 100) / 100,
                    net: Math.round(totals.net * 100) / 100,
                },
                count: transactions.length,
            });
        }
        else {
            // Fallback: use accounts/transactions schema
            let sql = `
        SELECT t.id as transaction_id, t.transaction_date, 
          a.account_type as transaction_type,
          t.description as party_name, t.reference_number as invoice_number,
          'Standard' as vat_type,
          t.debit_amount as exclusive_amount,
          0 as vat_amount,
          GREATEST(t.debit_amount, t.credit_amount) as total_amount,
          NULL as transaction_payment_id
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.transaction_date BETWEEN ? AND ?
      `;
            const params = [startDate, endDate];
            if (type) {
                sql += ' AND a.account_type = ?';
                params.push(type);
            }
            sql += ' ORDER BY t.transaction_date ASC, t.id ASC';
            const rows = await db.query(sql, params);
            const totals = { net: 0, vat: 0, gross: 0 };
            const transactions = rows.map((t) => {
                const net = Number(t.exclusive_amount || 0);
                const vat = Number(t.vat_amount || 0);
                const gross = Number(t.total_amount || 0);
                totals.net += net;
                totals.vat += vat;
                totals.gross += gross;
                return {
                    id: t.transaction_id,
                    date: t.transaction_date,
                    type: t.transaction_type,
                    supplier: t.party_name,
                    reference: t.invoice_number,
                    vat_type: t.vat_type,
                    net: Math.round(net * 100) / 100,
                    vat: Math.round(vat * 100) / 100,
                    gross: Math.round(gross * 100) / 100,
                    payment_id: t.transaction_payment_id,
                };
            });
            res.json({
                period: { start: startDate, end: endDate },
                transactions,
                totals: {
                    gross: Math.round(totals.gross * 100) / 100,
                    vat: Math.round(totals.vat * 100) / 100,
                    net: Math.round(totals.net * 100) / 100,
                },
                count: transactions.length,
            });
        }
    }
    catch (err) {
        next(err);
    }
});
