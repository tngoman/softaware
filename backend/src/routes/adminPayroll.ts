import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest } from '../utils/httpErrors.js';
import { db } from '../db/mysql.js';
import {
  approveBankingRequest,
  type GenerateBulkPayslipInput,
  type GeneratePayslipInput,
  type PayrollProfileInput,
  type SalaryInput,
  deletePayrollProfile,
  deleteSalary,
  generateBulkPayslips,
  generatePayslip,
  getPayrollProfile,
  getPayrollSummary,
  getPayslipById,
  getSalary,
  getSalaryHistory,
  listBankingRequests,
  listPayrollProfiles,
  listPayslips,
  listSalaries,
  rejectBankingRequest,
  saveSalary,
  upsertPayrollProfile,
  voidPayslip,
} from '../services/payrollService.js';
import { generatePayslipPdfBuffer } from '../utils/payslipPdf.js';

export const adminPayrollRouter = Router();

adminPayrollRouter.use(requireAuth, requireAdmin);

/** Normalize any date string to YYYY-MM-DD */
function normalizeDate(value: string): string {
  if (!value) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

const profileSchema = z.object({
  employment_date: z.string(),
  id_number: z.string().optional(),
  tax_number: z.string().optional(),
  bank_name: z.string().optional(),
  branch_code: z.string().optional(),
  account_number: z.string().optional(),
  account_type: z.enum(['cheque', 'savings', 'transmission']).optional(),
  account_holder_name: z.string().optional(),
}).transform(data => ({
  ...data,
  employment_date: normalizeDate(data.employment_date),
}));

const lineItemSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  amount_cents: z.number().int().min(0),
  sort_order: z.number().int().optional(),
});

const salarySchema = z.object({
  gross_salary_cents: z.number().int().positive(),
  effective_from: z.string().optional(),
  notes: z.string().optional(),
  deductions: z.array(lineItemSchema).optional(),
  allowances: z.array(lineItemSchema).optional(),
});

const generatePayslipSchema = z.object({
  user_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  overwrite: z.boolean().optional(),
});

const generateBulkSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  overwrite: z.boolean().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

function forwardError(err: unknown, next: (err?: any) => void) {
  if (err instanceof z.ZodError) {
    next(badRequest(err.errors[0]?.message || 'Invalid request payload'));
    return;
  }
  next(err);
}

adminPayrollRouter.get('/profiles', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await listPayrollProfiles({
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/profiles/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getPayrollProfile(req.params.userId, true);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.put('/profiles/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = profileSchema.parse(req.body) as PayrollProfileInput;
    const data = await upsertPayrollProfile(req.params.userId, payload, req.userId!);
    res.json({ success: true, message: 'Payroll profile saved successfully', data });
  } catch (err) {
    forwardError(err, next);
  }
});

adminPayrollRouter.delete('/profiles/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    await deletePayrollProfile(req.params.userId);
    res.json({ success: true, message: 'Payroll profile and all associated data deleted' });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/banking-requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await listBankingRequests({
      status: (req.query.status as string | undefined) || 'pending',
      user_id: req.query.user_id as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.post('/banking-requests/:id/approve', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await approveBankingRequest(req.params.id, req.userId!);
    res.json({ success: true, message: 'Banking change approved and profile updated', data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.post('/banking-requests/:id/reject', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = rejectSchema.parse(req.body);
    const data = await rejectBankingRequest(req.params.id, req.userId!, payload.reason);
    res.json({ success: true, message: 'Banking change request rejected', data });
  } catch (err) {
    forwardError(err, next);
  }
});

adminPayrollRouter.get('/salaries', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await listSalaries({
      has_salary: req.query.has_salary as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/salaries/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getSalary(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.put('/salaries/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = salarySchema.parse(req.body) as SalaryInput;
    const data = await saveSalary(req.params.userId, payload, req.userId!);
    res.json({
      success: true,
      message: 'Salary updated successfully',
      data: {
        id: data.id,
        user_id: data.user_id,
        gross_salary_cents: data.gross_salary_cents,
        net_salary_cents: data.net_salary_cents,
        effective_from: data.effective_from,
        deduction_count: data.deductions.length,
        allowance_count: data.allowances.length,
      },
    });
  } catch (err) {
    forwardError(err, next);
  }
});

adminPayrollRouter.delete('/salaries/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    await deleteSalary(req.params.userId);
    res.json({ success: true, message: 'Salary configuration removed' });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/salaries/:userId/history', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getSalaryHistory(req.params.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.post('/payslips/generate', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = generatePayslipSchema.parse(req.body) as GeneratePayslipInput;
    const data = await generatePayslip(payload, req.userId!);
    res.status(201).json({ success: true, message: 'Payslip generated successfully', data });
  } catch (err) {
    forwardError(err, next);
  }
});

adminPayrollRouter.post('/payslips/generate-bulk', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = generateBulkSchema.parse(req.body) as GenerateBulkPayslipInput;
    const data = await generateBulkPayslips(payload, req.userId!);
    res.status(201).json({ success: true, message: 'Bulk payslip generation complete', data });
  } catch (err) {
    forwardError(err, next);
  }
});

adminPayrollRouter.get('/payslips', async (req: AuthRequest, res: Response, next) => {
  try {
    const result = await listPayslips({
      month: req.query.month as string | undefined,
      year: req.query.year as string | undefined,
      user_id: req.query.user_id as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/payslips/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getPayslipById(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/payslips/:id/pdf', async (req: AuthRequest, res: Response, next) => {
  try {
    const payslip = await getPayslipById(req.params.id);
    if (payslip.status === 'voided') {
      throw badRequest('Cannot download a voided payslip');
    }

    // Fetch actual annual leave balance for the payslip year
    const leaveBalance = await db.queryOne<{ remaining_days: number }>(
      `SELECT remaining_days FROM leave_balances 
       WHERE user_id = ? AND leave_type = 'annual' AND cycle_year = ?`,
      [payslip.user_id, payslip.pay_year]
    );

    const pdf = await generatePayslipPdfBuffer({
      reference_number: payslip.reference_number,
      employee_name: payslip.employee_name || payslip.employee_email,
      employee_email: payslip.employee_email,
      employment_date: payslip.employment_date,
      id_number: payslip.id_number,
      tax_number: payslip.tax_number,
      bank_name: payslip.bank_name,
      account_number_masked: payslip.account_number_masked,
      account_type: payslip.account_type,
      pay_month: payslip.pay_month,
      pay_year: payslip.pay_year,
      gross_salary_cents: payslip.gross_salary_cents,
      total_deductions_cents: payslip.total_deductions_cents,
      total_allowances_cents: payslip.total_allowances_cents,
      net_salary_cents: payslip.net_salary_cents,
      deductions_snapshot: payslip.deductions_snapshot,
      allowances_snapshot: payslip.allowances_snapshot,
      generated_at: payslip.generated_at,
      leave_days_remaining: leaveBalance?.remaining_days ?? null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payslip.reference_number}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.delete('/payslips/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    await voidPayslip(req.params.id, req.userId!);
    res.json({ success: true, message: 'Payslip deleted successfully' });
  } catch (err) {
    next(err);
  }
});

adminPayrollRouter.get('/summary', async (req: AuthRequest, res: Response, next) => {
  try {
    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const data = await getPayrollSummary(month, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
