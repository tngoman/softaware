import { db, generateId } from '../db/mysql.js';
import { notFound, badRequest } from '../utils/httpErrors.js';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

export type LeaveType = 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  family_responsibility: 'Family Responsibility',
  maternity: 'Maternity Leave',
  parental: 'Parental Leave',
};

/** South African default entitlements (working days) */
export const SA_ENTITLEMENTS: Record<LeaveType, number> = {
  annual: 15,
  sick: 30,                 // 30 days per 36-month cycle
  family_responsibility: 3, // per year
  maternity: 80,            // 4 consecutive months ≈ 80 working days
  parental: 10,             // 10 consecutive days
};

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  cycle_year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  notes?: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  // joined fields
  employee_name?: string;
  employee_email?: string;
  reviewer_name?: string;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Count working days (Mon-Fri) between two dates inclusive.
 */
export function countWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/* ═══════════════════════════════════════════════════════════
   Balance operations
   ═══════════════════════════════════════════════════════════ */

/**
 * Ensure a user has leave balance rows for the given cycle year.
 * Creates rows with SA default entitlements if they don't exist.
 */
export async function ensureBalances(userId: string, year?: number): Promise<void> {
  const yr = year ?? currentYear();
  const existing = await db.query<{ leave_type: LeaveType }>(
    'SELECT leave_type FROM leave_balances WHERE user_id = ? AND cycle_year = ?',
    [userId, yr]
  );
  const existingTypes = new Set(existing.map(r => r.leave_type));

  for (const [type, days] of Object.entries(SA_ENTITLEMENTS)) {
    if (!existingTypes.has(type as LeaveType)) {
      await db.execute(
        `INSERT INTO leave_balances (id, user_id, leave_type, cycle_year, entitled_days, used_days, pending_days)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        [generateId(), userId, type, yr, days]
      );
    }
  }
}

/**
 * Get all leave balances for a user for a given cycle year.
 */
export async function getBalances(userId: string, year?: number): Promise<LeaveBalance[]> {
  const yr = year ?? currentYear();
  await ensureBalances(userId, yr);
  return db.query<LeaveBalance>(
    `SELECT id, user_id, leave_type, cycle_year, entitled_days, used_days, pending_days, remaining_days, notes
     FROM leave_balances
     WHERE user_id = ? AND cycle_year = ?
     ORDER BY FIELD(leave_type, 'annual', 'sick', 'family_responsibility', 'maternity', 'parental')`,
    [userId, yr]
  );
}

/**
 * Get all staff leave balances (for admin overview).
 */
export async function listAllBalances(year?: number): Promise<any[]> {
  const yr = year ?? currentYear();
  return db.query<any>(
    `SELECT lb.*, u.name AS employee_name, u.email AS employee_email
     FROM leave_balances lb
     JOIN users u ON u.id = lb.user_id
     WHERE lb.cycle_year = ?
     ORDER BY u.name, FIELD(lb.leave_type, 'annual', 'sick', 'family_responsibility', 'maternity', 'parental')`,
    [yr]
  );
}

/**
 * Admin: update entitlement for a specific balance row.
 */
export async function updateEntitlement(balanceId: string, entitledDays: number): Promise<void> {
  const row = await db.queryOne<LeaveBalance>('SELECT * FROM leave_balances WHERE id = ?', [balanceId]);
  if (!row) throw notFound('Leave balance not found');
  if (entitledDays < row.used_days) throw badRequest('Entitlement cannot be less than already-used days');
  await db.execute('UPDATE leave_balances SET entitled_days = ? WHERE id = ?', [entitledDays, balanceId]);
}

/* ═══════════════════════════════════════════════════════════
   Leave request operations
   ═══════════════════════════════════════════════════════════ */

export interface CreateLeaveRequestInput {
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason?: string;
}

/**
 * Create a new leave request.
 */
export async function createLeaveRequest(input: CreateLeaveRequestInput, actorId: string): Promise<LeaveRequest> {
  const { user_id, leave_type, start_date, end_date, reason } = input;

  // Validate dates
  if (new Date(end_date) < new Date(start_date)) {
    throw badRequest('End date cannot be before start date');
  }

  const days = countWorkingDays(start_date, end_date);
  if (days <= 0) throw badRequest('No working days in selected range');

  // Check balance
  const year = new Date(start_date).getFullYear();
  await ensureBalances(user_id, year);
  const balance = await db.queryOne<LeaveBalance>(
    'SELECT * FROM leave_balances WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
    [user_id, leave_type, year]
  );
  if (!balance) throw badRequest('No leave balance found for this type and year');
  if (days > Number(balance.remaining_days)) {
    throw badRequest(`Insufficient ${LEAVE_TYPE_LABELS[leave_type]} balance. Available: ${balance.remaining_days} days, Requested: ${days} days`);
  }

  // Check for overlapping pending/approved requests
  const overlap = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM leave_requests
     WHERE user_id = ? AND status IN ('pending','approved')
       AND start_date <= ? AND end_date >= ?`,
    [user_id, end_date, start_date]
  );
  if (overlap && overlap.cnt > 0) {
    throw badRequest('There is already an overlapping leave request for these dates');
  }

  const id = generateId();
  await db.execute(
    `INSERT INTO leave_requests (id, user_id, leave_type, start_date, end_date, days, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [id, user_id, leave_type, start_date, end_date, days, reason || null]
  );

  // Update pending_days on the balance
  await db.execute(
    'UPDATE leave_balances SET pending_days = pending_days + ? WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
    [days, user_id, leave_type, year]
  );

  return db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [id]) as Promise<LeaveRequest>;
}

/**
 * List leave requests with optional filters.
 */
export async function listLeaveRequests(filters: {
  user_id?: string;
  status?: string;
  year?: number;
}): Promise<LeaveRequest[]> {
  let sql = `
    SELECT lr.*, u.name AS employee_name, u.email AS employee_email,
           rv.name AS reviewer_name
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    LEFT JOIN users rv ON rv.id = lr.approved_by
    WHERE 1=1`;
  const params: any[] = [];

  if (filters.user_id) {
    sql += ' AND lr.user_id = ?';
    params.push(filters.user_id);
  }
  if (filters.status) {
    sql += ' AND lr.status = ?';
    params.push(filters.status);
  }
  if (filters.year) {
    sql += ' AND YEAR(lr.start_date) = ?';
    params.push(filters.year);
  }

  sql += ' ORDER BY lr.created_at DESC';
  return db.query<LeaveRequest>(sql, params);
}

/**
 * Approve a leave request.
 */
export async function approveLeaveRequest(requestId: string, actorId: string): Promise<LeaveRequest> {
  const req = await db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  if (!req) throw notFound('Leave request not found');
  if (req.status !== 'pending') throw badRequest(`Cannot approve a ${req.status} request`);

  const year = new Date(req.start_date).getFullYear();

  // Move from pending to used
  await db.execute(
    `UPDATE leave_balances
     SET used_days = used_days + ?, pending_days = GREATEST(pending_days - ?, 0)
     WHERE user_id = ? AND leave_type = ? AND cycle_year = ?`,
    [req.days, req.days, req.user_id, req.leave_type, year]
  );

  await db.execute(
    `UPDATE leave_requests SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?`,
    [actorId, requestId]
  );

  return db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]) as Promise<LeaveRequest>;
}

/**
 * Reject a leave request.
 */
export async function rejectLeaveRequest(requestId: string, actorId: string, rejectionReason?: string): Promise<LeaveRequest> {
  const req = await db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  if (!req) throw notFound('Leave request not found');
  if (req.status !== 'pending') throw badRequest(`Cannot reject a ${req.status} request`);

  const year = new Date(req.start_date).getFullYear();

  // Release pending days
  await db.execute(
    'UPDATE leave_balances SET pending_days = GREATEST(pending_days - ?, 0) WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
    [req.days, req.user_id, req.leave_type, year]
  );

  await db.execute(
    `UPDATE leave_requests SET status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ? WHERE id = ?`,
    [actorId, rejectionReason || null, requestId]
  );

  return db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]) as Promise<LeaveRequest>;
}

/**
 * Cancel a leave request (by the employee or admin).
 */
export async function cancelLeaveRequest(requestId: string, actorId: string): Promise<LeaveRequest> {
  const req = await db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]);
  if (!req) throw notFound('Leave request not found');

  const year = new Date(req.start_date).getFullYear();

  if (req.status === 'pending') {
    // Release pending days
    await db.execute(
      'UPDATE leave_balances SET pending_days = GREATEST(pending_days - ?, 0) WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
      [req.days, req.user_id, req.leave_type, year]
    );
  } else if (req.status === 'approved') {
    // Release used days
    await db.execute(
      'UPDATE leave_balances SET used_days = GREATEST(used_days - ?, 0) WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
      [req.days, req.user_id, req.leave_type, year]
    );
  } else {
    throw badRequest(`Cannot cancel a ${req.status} request`);
  }

  await db.execute(
    `UPDATE leave_requests SET status = 'cancelled', approved_by = ?, approved_at = NOW() WHERE id = ?`,
    [actorId, requestId]
  );

  return db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [requestId]) as Promise<LeaveRequest>;
}

/**
 * Get the total remaining annual leave days for a user (used in payslip PDF).
 */
export async function getAnnualLeaveRemaining(userId: string, year?: number): Promise<number> {
  const yr = year ?? currentYear();
  const row = await db.queryOne<{ remaining_days: number }>(
    'SELECT remaining_days FROM leave_balances WHERE user_id = ? AND leave_type = ? AND cycle_year = ?',
    [userId, 'annual', yr]
  );
  return row ? Number(row.remaining_days) : 0;
}
