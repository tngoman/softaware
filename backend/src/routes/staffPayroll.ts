import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireStaff } from '../middleware/requireStaff.js';
import { badRequest } from '../utils/httpErrors.js';
import { db } from '../db/mysql.js';
import {
  type BankingRequestInput,
  getLatestBankingRequest,
  getPayslipById,
  getStaffPayrollProfile,
  listStaffPayslips,
  submitBankingRequest,
} from '../services/payrollService.js';
import { generatePayslipPdfBuffer } from '../utils/payslipPdf.js';

export const staffPayrollRouter = Router();

staffPayrollRouter.use(requireAuth, requireStaff);

const bankingRequestSchema = z.object({
  bank_name: z.string().min(1),
  branch_code: z.string().min(1),
  account_number: z.string().min(1),
  account_type: z.enum(['cheque', 'savings', 'transmission']),
  account_holder_name: z.string().min(1),
});

function forwardError(err: unknown, next: (err?: any) => void) {
  if (err instanceof z.ZodError) {
    next(badRequest(err.errors[0]?.message || 'Invalid request payload'));
    return;
  }
  next(err);
}

staffPayrollRouter.get('/profile', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getStaffPayrollProfile(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

staffPayrollRouter.get('/payslips', async (req: AuthRequest, res: Response, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const data = await listStaffPayslips(req.userId!, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

staffPayrollRouter.get('/payslips/:id/pdf', async (req: AuthRequest, res: Response, next) => {
  try {
    const payslip = await getPayslipById(req.params.id, req.userId!);
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

staffPayrollRouter.post('/banking-request', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = bankingRequestSchema.parse(req.body) as BankingRequestInput;
    const data = await submitBankingRequest(req.userId!, payload);
    res.status(201).json({ success: true, message: 'Banking change request submitted for admin approval', data });
  } catch (err) {
    forwardError(err, next);
  }
});

staffPayrollRouter.get('/banking-request', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await getLatestBankingRequest(req.userId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
