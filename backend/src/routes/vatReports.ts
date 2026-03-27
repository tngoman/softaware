import { Router, Response } from 'express';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest } from '../utils/httpErrors.js';

export const vatReportsRouter = Router();

// All VAT report routes require admin
vatReportsRouter.use(requireAuth, requireAdmin);

/**
 * GET /vat-reports - Generate VAT reports from transactions_vat table
 * Query params: type (vat201 | itr14 | irp6), period_start, period_end, year, to_date
 */
vatReportsRouter.get('/', async (req: AuthRequest, res: Response, next) => {
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

        // Calculate VAT summary from transactions_vat table
        const result = await db.queryOne<any>(
          `SELECT 
            SUM(CASE WHEN transaction_type = 'income' AND vat_type = 'standard' THEN exclusive_amount ELSE 0 END) as income_standard_exclusive,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type = 'standard' THEN vat_amount ELSE 0 END) as income_standard_vat,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type = 'zero' THEN exclusive_amount ELSE 0 END) as income_zero,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type IN ('exempt', 'non-vat') THEN exclusive_amount ELSE 0 END) as income_exempt,
            SUM(CASE WHEN transaction_type = 'expense' AND vat_type = 'standard' THEN exclusive_amount ELSE 0 END) as expense_standard_exclusive,
            SUM(CASE WHEN transaction_type = 'expense' AND vat_type = 'standard' THEN vat_amount ELSE 0 END) as expense_standard_vat,
            SUM(CASE WHEN transaction_type = 'expense' AND vat_type = 'zero' THEN exclusive_amount ELSE 0 END) as expense_zero
           FROM transactions_vat
           WHERE transaction_date BETWEEN ? AND ?`,
          [period_start, period_end]
        );

        const totalSales = Math.round((Number(result?.income_standard_exclusive || 0)) * 100) / 100;
        const outputVat = Math.round((Number(result?.income_standard_vat || 0)) * 100) / 100;
        const incomeZero = Math.round((Number(result?.income_zero || 0)) * 100) / 100;
        const incomeExempt = Math.round((Number(result?.income_exempt || 0)) * 100) / 100;
        const totalPurchases = Math.round((Number(result?.expense_standard_exclusive || 0)) * 100) / 100;
        const inputVat = Math.round((Number(result?.expense_standard_vat || 0)) * 100) / 100;
        const expenseZero = Math.round((Number(result?.expense_zero || 0)) * 100) / 100;
        const netVat = Math.round((outputVat - inputVat) * 100) / 100;

        res.json({
          success: true,
          data: {
            period: {
              start: period_start,
              end: period_end
            },
            vat201: {
              field_1: totalSales,
              field_4: outputVat,
              field_5: incomeZero,
              field_6: incomeExempt,
              field_11: totalPurchases,
              field_14: inputVat,
              field_15: expenseZero,
              field_19: netVat
            }
          },
        });
        break;
      }

      case 'itr14': {
        const year = parseInt(req.query.year as string);
        if (!year) {
          throw badRequest('year parameter is required');
        }

        // Use calendar year (Jan-Dec)
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        // Get income/expense totals
        const totals = await db.queryOne<any>(
          `SELECT 
            SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) as income_total,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type = 'zero' THEN total_amount ELSE 0 END) as income_zero,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type IN ('exempt','non-vat') THEN total_amount ELSE 0 END) as income_exempt,
            SUM(CASE WHEN transaction_type = 'income' AND vat_type = 'standard' THEN total_amount ELSE 0 END) as income_standard,
            SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as expense_total,
            SUM(CASE WHEN transaction_type = 'expense' AND vat_type = 'standard' THEN total_amount ELSE 0 END) as expense_standard,
            SUM(CASE WHEN transaction_type = 'expense' AND vat_type = 'zero' THEN total_amount ELSE 0 END) as expense_zero
           FROM transactions_vat
           WHERE transaction_date BETWEEN ? AND ?`,
          [yearStart, yearEnd]
        );

        // Get expenses by category
        const expensesByCategory = await db.query<any>(
          `SELECT 
            COALESCE(ec.category_name, 'Uncategorised') as category_name,
            ec.category_code,
            ec.itr14_mapping,
            SUM(t.total_amount) as total
           FROM transactions_vat t
           LEFT JOIN tb_expense_categories ec ON ec.category_id = t.expense_category_id
           WHERE t.transaction_type = 'expense'
             AND t.transaction_date BETWEEN ? AND ?
           GROUP BY ec.category_id, ec.category_name, ec.category_code, ec.itr14_mapping
           ORDER BY category_name ASC`,
          [yearStart, yearEnd]
        );

        const totalRevenue = Math.round((Number(totals?.income_total || 0)) * 100) / 100;
        const zeroRatedIncome = Math.round((Number(totals?.income_zero || 0)) * 100) / 100;
        const exemptIncome = Math.round((Number(totals?.income_exempt || 0)) * 100) / 100;
        const taxableIncomeComponent = Math.round((totalRevenue - zeroRatedIncome - exemptIncome) * 100) / 100;
        const totalExpenses = Math.round((Number(totals?.expense_total || 0)) * 100) / 100;
        const taxableIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100;
        const corporateTax = Math.round(Math.max(taxableIncome, 0) * 0.27 * 100) / 100;

        res.json({
          success: true,
          data: {
            year,
            income: {
              total_revenue: totalRevenue,
              taxable_income: taxableIncomeComponent,
              zero_rated_income: zeroRatedIncome,
              exempt_income: exemptIncome
            },
            expenses_by_category: (expensesByCategory || []).map((row: any) => ({
              category_name: row.category_name || 'Uncategorised',
              category_code: row.category_code || null,
              itr14_mapping: row.itr14_mapping || row.category_name || 'Uncategorised',
              total: Math.round((Number(row.total || 0)) * 100) / 100
            })),
            summary: {
              total_revenue: totalRevenue,
              total_expenses: totalExpenses,
              taxable_income: taxableIncome,
              corporate_tax_27_percent: corporateTax
            }
          },
        });
        break;
      }

      case 'irp6': {
        const to_date = (req.query.to_date as string) || new Date().toISOString().split('T')[0];
        
        // Use calendar year start (Jan 1)
        const year = parseInt(to_date.substring(0, 4));
        const yearStart = `${year}-01-01`;

        const startDate = new Date(yearStart);
        const endDate = new Date(to_date);

        if (endDate < startDate) {
          throw badRequest('to_date cannot be before the start of the financial year');
        }

        // Calculate days elapsed
        const daysElapsed = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const yearEndDate = new Date(`${year}-12-31`);
        const daysInYear = Math.floor((yearEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Get actual income/expenses to date
        const totals = await db.queryOne<any>(
          `SELECT 
            SUM(CASE WHEN transaction_type = 'income' THEN total_amount ELSE 0 END) as income_total,
            SUM(CASE WHEN transaction_type = 'expense' THEN total_amount ELSE 0 END) as expense_total
           FROM transactions_vat
           WHERE transaction_date BETWEEN ? AND ?`,
          [yearStart, to_date]
        );

        const actualIncome = Math.round((Number(totals?.income_total || 0)) * 100) / 100;
        const actualExpenses = Math.round((Number(totals?.expense_total || 0)) * 100) / 100;
        const actualProfit = Math.round((actualIncome - actualExpenses) * 100) / 100;

        // Project to full year
        const factor = daysElapsed > 0 ? daysInYear / daysElapsed : 0;
        const estimatedIncome = Math.round(actualIncome * factor * 100) / 100;
        const estimatedExpenses = Math.round(actualExpenses * factor * 100) / 100;
        const estimatedTaxable = Math.round((estimatedIncome - estimatedExpenses) * 100) / 100;
        const estimatedTax = Math.round(Math.max(estimatedTaxable, 0) * 0.27 * 100) / 100;

        res.json({
          success: true,
          data: {
            period: {
              start: yearStart,
              to_date: to_date,
              days_elapsed: daysElapsed,
              days_in_year: daysInYear
            },
            actual_to_date: {
              income: actualIncome,
              expenses: actualExpenses,
              profit: actualProfit
            },
            estimated_annual: {
              income: estimatedIncome,
              expenses: estimatedExpenses,
              taxable_income: estimatedTaxable,
              tax_due_27_percent: estimatedTax
            }
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
