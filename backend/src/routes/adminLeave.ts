import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { badRequest } from '../utils/httpErrors.js';
import {
  getBalances,
  listAllBalances,
  updateEntitlement,
  listLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  countWorkingDays,
  LEAVE_TYPE_LABELS,
  type LeaveType,
} from '../services/leaveService.js';

export const adminLeaveRouter = Router();

adminLeaveRouter.use(requireAuth, requireAdmin);

const submitRequestSchema = z.object({
  leave_type: z.enum(['annual', 'sick', 'family_responsibility', 'maternity', 'parental']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

const updateEntitlementSchema = z.object({
  entitled_days: z.number().positive(),
});

const approveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional(),
});

// ─── GET /admin/leave/balances ─────────────────────────────
adminLeaveRouter.get('/balances', async (req: AuthRequest, res: Response, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const data = await listAllBalances(year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/leave/balances/:userId ─────────────────────
adminLeaveRouter.get('/balances/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const data = await getBalances(req.params.userId, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/leave/balances/:balanceId ──────────────────
adminLeaveRouter.put('/balances/:balanceId', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = updateEntitlementSchema.parse(req.body);
    await updateEntitlement(req.params.balanceId, payload.entitled_days);
    res.json({ success: true, message: 'Entitlement updated' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(badRequest(err.errors[0]?.message || 'Invalid payload'));
      return;
    }
    next(err);
  }
});

// ─── GET /admin/leave/requests ─────────────────────────────
adminLeaveRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const data = await listLeaveRequests({ status: 'pending' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/leave/requests/:userId ────────────────────
adminLeaveRouter.get('/requests/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const status = req.query.status as string | undefined;
    const data = await listLeaveRequests({ user_id: req.params.userId, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/leave/requests (admin submits for staff) ────
adminLeaveRouter.post('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = submitRequestSchema.parse(req.body);
    if (!req.body.user_id) throw badRequest('user_id is required');

    const request = await createLeaveRequest(
      {
        user_id: req.body.user_id,
        leave_type: payload.leave_type,
        start_date: payload.start_date,
        end_date: payload.end_date,
        reason: payload.reason,
      },
      req.userId!
    );

    res.status(201).json({ success: true, message: 'Leave request submitted', data: request });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(badRequest(err.errors[0]?.message || 'Invalid payload'));
      return;
    }
    next(err);
  }
});

// ─── PUT /admin/leave/requests/:requestId ──────────────────
adminLeaveRouter.put('/requests/:requestId', async (req: AuthRequest, res: Response, next) => {
  try {
    const payload = approveSchema.parse(req.body);

    if (payload.action === 'approve') {
      const request = await approveLeaveRequest(req.params.requestId, req.userId!);
      res.json({ success: true, message: 'Leave request approved', data: request });
    } else if (payload.action === 'reject') {
      if (!payload.rejection_reason) throw badRequest('rejection_reason is required');
      const request = await rejectLeaveRequest(req.params.requestId, req.userId!, payload.rejection_reason);
      res.json({ success: true, message: 'Leave request rejected', data: request });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(badRequest(err.errors[0]?.message || 'Invalid payload'));
      return;
    }
    next(err);
  }
});
