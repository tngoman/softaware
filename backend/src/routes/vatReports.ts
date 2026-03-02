import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { badRequest } from '../utils/httpErrors.js';

export const vatReportsRouter = Router();

/**
 * GET /vat-reports - Generate VAT reports
 * Query params: type (vat201 | itr14 | irp6), period_start, period_end, year, to_date
 */
vatReportsRouter.get('/', requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const type = req.query.type as string;
    if (!type) {
      throw badRequest('Report type is required (vat201, itr14, irp6)');
    }

    switch (type) {
      case 'vat201': {
        const period_start = req.query.period_start as string;
        const period_end = req.query.period_end as string;
        if (!period_start || !period_end) {
          throw badRequest('period_start and period_end are required for VAT201');
        }

        // Output VAT (sales)
        const salesResult = await db.queryOne<any>(
          `SELECT COALESCE(SUM(invoice_amount), 0) as total_sales
           FROM invoices WHERE active = 1 AND invoice_date BETWEEN ? AND ?`,
          [period_start, period_end]
        );

        // Input VAT (purchases/expenses)
        const purchasesResult = await db.queryOne<any>(
          `SELECT COALESCE(SUM(t.debit_amount), 0) as total_purchases
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'expense' AND t.transaction_date BETWEEN ? AND ?`,
          [period_start, period_end]
        );

        const vatRate = 0.15;
        const totalSales = salesResult?.total_sales || 0;
        const totalPurchases = purchasesResult?.total_purchases || 0;
        const outputVat = totalSales * vatRate;
        const inputVat = totalPurchases * vatRate;

        res.json({
          success: true,
          data: {
            period_start,
            period_end,
            total_sales: totalSales,
            total_purchases: totalPurchases,
            output_vat: outputVat,
            input_vat: inputVat,
            net_vat: outputVat - inputVat,
            vat_payable: Math.max(0, outputVat - inputVat),
            vat_refundable: Math.max(0, inputVat - outputVat),
          },
        });
        break;
      }

      case 'itr14': {
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const yearStart = `${year}-03-01`;
        const yearEnd = `${year + 1}-02-28`;

        const income = await db.queryOne<any>(
          `SELECT COALESCE(SUM(t.credit_amount - t.debit_amount), 0) as total
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'income' AND t.transaction_date BETWEEN ? AND ?`,
          [yearStart, yearEnd]
        );

        const expenses = await db.queryOne<any>(
          `SELECT COALESCE(SUM(t.debit_amount - t.credit_amount), 0) as total
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'expense' AND t.transaction_date BETWEEN ? AND ?`,
          [yearStart, yearEnd]
        );

        const grossIncome = income?.total || 0;
        const totalExpenses = expenses?.total || 0;
        const taxableIncome = grossIncome - totalExpenses;

        res.json({
          success: true,
          data: {
            year,
            period: `${yearStart} to ${yearEnd}`,
            gross_income: grossIncome,
            total_expenses: totalExpenses,
            taxable_income: taxableIncome,
          },
        });
        break;
      }

      case 'irp6': {
        const to_date = (req.query.to_date as string) || new Date().toISOString().split('T')[0];
        const fromDate = `${new Date(to_date).getFullYear()}-03-01`;

        const income = await db.queryOne<any>(
          `SELECT COALESCE(SUM(t.credit_amount - t.debit_amount), 0) as total
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'income' AND t.transaction_date BETWEEN ? AND ?`,
          [fromDate, to_date]
        );

        const expenses = await db.queryOne<any>(
          `SELECT COALESCE(SUM(t.debit_amount - t.credit_amount), 0) as total
           FROM transactions t
           JOIN accounts a ON t.account_id = a.id
           WHERE a.account_type = 'expense' AND t.transaction_date BETWEEN ? AND ?`,
          [fromDate, to_date]
        );

        res.json({
          success: true,
          data: {
            from_date: fromDate,
            to_date,
            estimated_income: income?.total || 0,
            estimated_expenses: expenses?.total || 0,
            estimated_taxable: (income?.total || 0) - (expenses?.total || 0),
          },
        });
        break;
      }

      default:
        throw badRequest(`Unknown report type: ${type}`);
    }
  } catch (err) {
    next(err);
  }
});
