import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireStaff } from '../middleware/requireStaff.js';
import { badRequest } from '../utils/httpErrors.js';
import {
  getBalances,
  listLeaveRequests,
  createLeaveRequest,
  type CreateLeaveRequestInput,
} from '../services/leaveService.js';

export const staffLeaveRouter = Router();

staffLeaveRouter.use(requireAuth, requireStaff);

const submitRequestSchema = z.object({
  leave_type: z.enum(['annual', 'sick', 'family_responsibility', 'maternity', 'parental']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

function forwardError(err: unknown, next: Function) {
  if (err instanceof z.ZodError) {
    next(badRequest(err.errors[0]?.message || 'Invalid payload'));
  } else {
    next(err);
  }
}

// ─── GET /staff/leave/balances ────────────────────────────────
staffLeaveRouter.get('/balances', async (req: AuthRequest, res: Response, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const data = await getBalances(req.userId!, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /staff/leave/requests ────────────────────────────────
staffLeaveRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const status = req.query.status as string | undefined;
    const data = await listLeaveRequests({ user_id: req.userId!, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /staff/leave/requests ────────────────────────────────
staffLeaveRouter.post('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = submitRequestSchema.parse(req.body);
    const input: CreateLeaveRequestInput = {
      user_id: req.userId!,
      leave_type: payload.leave_type,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason,
    };
    const request = await createLeaveRequest(input, req.userId!);
    res.status(201).json({ success: true, message: 'Leave request submitted', data: request });
  } catch (err) {
    forwardError(err, next);
  }
});
