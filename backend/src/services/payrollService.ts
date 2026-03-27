import type { PoolConnection } from 'mysql2/promise';
import { db, generateId, toMySQLDate } from '../db/mysql.js';
import { decryptPassword, encryptPassword } from '../utils/cryptoUtils.js';
import { badRequest, notFound, HttpError } from '../utils/httpErrors.js';

export interface PayrollLineItemInput {
  type: string;
  label: string;
  amount_cents: number;
  sort_order?: number;
}

export interface PayrollProfileInput {
  employment_date: string;
  id_number?: string;
  tax_number?: string;
  bank_name?: string;
  branch_code?: string;
  account_number?: string;
  account_type?: 'cheque' | 'savings' | 'transmission';
  account_holder_name?: string;
}

export interface SalaryInput {
  gross_salary_cents: number;
  effective_from?: string;
  notes?: string;
  deductions?: PayrollLineItemInput[];
  allowances?: PayrollLineItemInput[];
}

export interface BankingRequestInput {
  bank_name: string;
  branch_code: string;
  account_number: string;
  account_type: 'cheque' | 'savings' | 'transmission';
  account_holder_name: string;
}

export interface GeneratePayslipInput {
  user_id: string;
  month: number;
  year: number;
  overwrite?: boolean;
}

export interface GenerateBulkPayslipInput {
  month: number;
  year: number;
  overwrite?: boolean;
}

interface StaffRow {
  id: string;
  name: string | null;
  email: string;
  is_staff: number;
  is_admin: number;
}

interface PayrollProfileRow {
  id: string;
  user_id: string;
  employment_date: string;
  id_number: string | null;
  tax_number: string | null;
  bank_name: string | null;
  branch_code: string | null;
  account_number: string | null;
  account_type: string | null;
  account_holder_name: string | null;
  banking_updated_at: string | null;
  banking_updated_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SalaryRow {
  id: string;
  user_id: string;
  gross_salary_cents: number;
  effective_from: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SalaryLineRow {
  id: string;
  salary_id: string;
  category: 'deduction' | 'allowance';
  type: string;
  label: string;
  amount_cents: number;
  sort_order: number;
}

interface PayslipRow {
  id: string;
  user_id: string;
  salary_id: string;
  reference_number: string;
  pay_month: number;
  pay_year: number;
  gross_salary_cents: number;
  total_deductions_cents: number;
  total_allowances_cents: number;
  net_salary_cents: number;
  deductions_snapshot: string | any[];
  allowances_snapshot: string | any[];
  status: 'generated' | 'voided';
  voided_reason: string | null;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

interface BankingRequestRow {
  id: string;
  user_id: string;
  bank_name: string;
  branch_code: string;
  account_number: string;
  account_type: string;
  account_holder_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const BANKING_FIELDS = ['bank_name', 'branch_code', 'account_number', 'account_type', 'account_holder_name'] as const;

function now(): string {
  return toMySQLDate(new Date());
}

function currentPeriod() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  // If already an ISO string like "2025-12-01T00:00:00.000Z", slice works fine
  const str = String(value);
  // Check if it looks like a JS Date.toString() output (e.g. "Mon Dec 01 2025 ...")
  if (/^[A-Z][a-z]{2}\s/.test(str)) {
    return new Date(str).toISOString().slice(0, 10);
  }
  return str.slice(0, 10);
}

function monthKey(value: string): number {
  const d = new Date(value);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function targetMonthKey(month: number, year: number): number {
  return year * 12 + (month - 1);
}

function ensureCurrentYearAndNotFuture(month: number, year: number) {
  const current = currentPeriod();
  if (month < 1 || month > 12) {
    throw badRequest('month must be between 1 and 12');
  }
  if (year > current.year || (year === current.year && month > current.month)) {
    throw badRequest('Cannot generate payslip for a future month');
  }
}

function ensurePeriodAfterDate(label: string, sourceDate: string | null | undefined, month: number, year: number) {
  if (!sourceDate) return;
  if (targetMonthKey(month, year) < monthKey(sourceDate)) {
    throw badRequest(`Cannot generate payslip for a month before the staff member's ${label} (${dateOnly(sourceDate)})`);
  }
}

function validateEmploymentDate(employmentDate: string) {
  const parsed = new Date(employmentDate);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('employment_date must be a valid ISO date');
  }
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed.getTime() > today.getTime()) {
    throw badRequest('employment_date cannot be in the future');
  }
}

function maybeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.includes(':')) return value;
  try {
    return decryptPassword(value) ?? value;
  } catch {
    return value;
  }
}

function maybeEncrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  const encrypted = encryptPassword(value);
  return encrypted || value;
}

export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const visible = value.slice(-4);
  return `****${visible}`;
}

function parseJsonArray<T = any>(value: string | T[]): T[] {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function normalizeProfile(row: PayrollProfileRow, includeSensitive: boolean) {
  const accountNumber = maybeDecrypt(row.account_number);
  return {
    ...row,
    employment_date: dateOnly(row.employment_date),
    id_number: row.id_number,
    tax_number: row.tax_number,
    bank_name: row.bank_name,
    branch_code: row.branch_code,
    account_type: row.account_type,
    account_holder_name: row.account_holder_name,
    account_number: includeSensitive ? accountNumber : undefined,
    account_number_masked: includeSensitive ? undefined : maskAccountNumber(accountNumber),
    has_banking: !!(row.bank_name && row.branch_code && accountNumber && row.account_type && row.account_holder_name),
    profile_complete: !!(row.employment_date && row.bank_name && row.branch_code && accountNumber && row.account_type && row.account_holder_name),
  };
}

function computeSalaryTotals(lines: SalaryLineRow[]) {
  const deductions = lines
    .filter((line) => line.category === 'deduction')
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  const allowances = lines
    .filter((line) => line.category === 'allowance')
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  const total_deductions_cents = deductions.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const total_allowances_cents = allowances.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  return {
    deductions,
    allowances,
    total_deductions_cents,
    total_allowances_cents,
  };
}

async function getStaffUser(userId: string): Promise<StaffRow> {
  const user = await db.queryOne<StaffRow>(
    'SELECT id, name, email, is_staff, is_admin FROM users WHERE id = ? AND (is_staff = 1 OR is_admin = 1)',
    [userId]
  );
  if (!user) throw notFound('Staff member not found');
  return user;
}

async function getPayrollProfileRow(userId: string): Promise<PayrollProfileRow | null> {
  return db.queryOne<PayrollProfileRow>('SELECT * FROM staff_payroll_profiles WHERE user_id = ?', [userId]);
}

async function getSalaryRow(userId: string): Promise<SalaryRow | null> {
  return db.queryOne<SalaryRow>('SELECT * FROM staff_salaries WHERE user_id = ?', [userId]);
}

async function getSalaryLines(salaryId: string): Promise<SalaryLineRow[]> {
  return db.query<SalaryLineRow>(
    'SELECT * FROM salary_deductions WHERE salary_id = ? ORDER BY category, sort_order, label',
    [salaryId]
  );
}

async function hydrateSalary(user: StaffRow, profile: PayrollProfileRow | null, salary: SalaryRow | null) {
  if (!salary) return null;
  const lines = await getSalaryLines(salary.id);
  const totals = computeSalaryTotals(lines);
  return {
    ...salary,
    user_id: user.id,
    user_name: user.name || user.email,
    user_email: user.email,
    employment_date: profile?.employment_date ? dateOnly(profile.employment_date) : null,
    deductions: totals.deductions,
    allowances: totals.allowances,
    total_deductions_cents: totals.total_deductions_cents,
    total_allowances_cents: totals.total_allowances_cents,
    net_salary_cents: Number(salary.gross_salary_cents) - totals.total_deductions_cents + totals.total_allowances_cents,
  };
}

function validateBankingFields(data: Partial<PayrollProfileInput>) {
  const values = BANKING_FIELDS.map((field) => data[field]);
  const hasAny = values.some((value) => value !== undefined && value !== null && value !== '');
  const hasAll = values.every((value) => value !== undefined && value !== null && value !== '');
  if (hasAny && !hasAll) {
    throw badRequest('All banking fields must be provided together: bank_name, branch_code, account_number, account_type, account_holder_name');
  }
}

async function insertSalaryLines(
  conn: PoolConnection,
  salaryId: string,
  category: 'deduction' | 'allowance',
  items: PayrollLineItemInput[] | undefined,
) {
  const safeItems = items || [];
  for (let index = 0; index < safeItems.length; index += 1) {
    const item = safeItems[index];
    await conn.execute(
      `INSERT INTO salary_deductions
        (id, salary_id, category, type, label, amount_cents, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        salaryId,
        category,
        item.type,
        item.label,
        item.amount_cents,
        item.sort_order ?? index + 1,
        now(),
        now(),
      ]
    );
  }
}

export async function listPayrollProfiles(filters: { status?: string; search?: string }) {
  let query = `
    SELECT
      u.id AS uid,
      u.name,
      u.email,
      u.is_admin,
      u.is_staff,
      p.id AS profile_id,
      p.user_id AS p_user_id,
      p.employment_date,
      p.id_number,
      p.tax_number,
      p.bank_name,
      p.branch_code,
      p.account_number,
      p.account_type,
      p.account_holder_name,
      p.banking_updated_at,
      p.banking_updated_by,
      p.created_by,
      p.created_at,
      p.updated_at
    FROM users u
    LEFT JOIN staff_payroll_profiles p ON p.user_id = u.id
    WHERE (u.is_staff = 1 OR u.is_admin = 1)
  `;
  const params: any[] = [];

  if (filters.search) {
    query += ' AND (u.name LIKE ? OR u.email LIKE ?)';
    const searchValue = `%${filters.search}%`;
    params.push(searchValue, searchValue);
  }

  query += ' ORDER BY COALESCE(u.name, u.email) ASC';

  const rows = await db.query<any>(query, params);
  const requestCounts = await db.query<{ user_id: string; count: number }>(
    "SELECT user_id, COUNT(*) AS count FROM banking_change_requests WHERE status = 'pending' GROUP BY user_id"
  );
  const pendingMap = new Map(requestCounts.map((row) => [row.user_id, Number(row.count || 0)]));

  const result = rows.map((row) => {
    const profileRow: PayrollProfileRow | null = row.profile_id ? {
      id: row.profile_id,
      user_id: row.p_user_id,
      employment_date: row.employment_date,
      id_number: row.id_number,
      tax_number: row.tax_number,
      bank_name: row.bank_name,
      branch_code: row.branch_code,
      account_number: row.account_number,
      account_type: row.account_type,
      account_holder_name: row.account_holder_name,
      banking_updated_at: row.banking_updated_at,
      banking_updated_by: row.banking_updated_by,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } : null;
    const profile = profileRow ? normalizeProfile(profileRow, true) : null;
    return {
      user_id: row.uid,
      name: row.name || row.email,
      email: row.email,
      is_admin: !!row.is_admin,
      is_staff: !!row.is_staff,
      profile: profile ? {
        ...profile,
        has_pending_banking_request: !!pendingMap.get(row.uid),
      } : null,
    };
  });

  if (!filters.status) return result;

  return result.filter((row) => {
    if (filters.status === 'missing') return !row.profile;
    if (filters.status === 'complete') return !!row.profile?.profile_complete;
    if (filters.status === 'incomplete') return !!row.profile && !row.profile.profile_complete;
    return true;
  });
}

export async function getPayrollProfile(userId: string, includeSensitive = true) {
  const user = await getStaffUser(userId);
  const profile = await getPayrollProfileRow(userId);
  if (!profile) throw notFound('Payroll profile not found for this staff member');
  const pending = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM banking_change_requests WHERE user_id = ? AND status = 'pending'",
    [userId]
  );

  return {
    ...normalizeProfile(profile, includeSensitive),
    user_id: user.id,
    user_name: user.name || user.email,
    user_email: user.email,
    has_pending_banking_request: !!Number(pending?.count || 0),
  };
}

export async function upsertPayrollProfile(userId: string, input: PayrollProfileInput, actorId: string) {
  await getStaffUser(userId);
  validateEmploymentDate(input.employment_date);
  validateBankingFields(input);

  const existing = await getPayrollProfileRow(userId);
  const timestamp = now();
  const bankingProvided = !!input.bank_name;

  if (!existing) {
    const id = generateId();
    await db.execute(
      `INSERT INTO staff_payroll_profiles
        (id, user_id, employment_date, id_number, tax_number, bank_name, branch_code, account_number, account_type, account_holder_name,
         banking_updated_at, banking_updated_by, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        input.employment_date,
        input.id_number || null,
        input.tax_number || null,
        input.bank_name || null,
        input.branch_code || null,
        maybeEncrypt(input.account_number) || null,
        input.account_type || null,
        input.account_holder_name || null,
        bankingProvided ? timestamp : null,
        bankingProvided ? actorId : null,
        actorId,
        timestamp,
        timestamp,
      ]
    );
  } else {
    await db.execute(
      `UPDATE staff_payroll_profiles
       SET employment_date = ?,
           id_number = ?,
           tax_number = ?,
           bank_name = ?,
           branch_code = ?,
           account_number = ?,
           account_type = ?,
           account_holder_name = ?,
           banking_updated_at = ?,
           banking_updated_by = ?,
           updated_at = ?
       WHERE user_id = ?`,
      [
        input.employment_date,
        input.id_number || null,
        input.tax_number || null,
        input.bank_name || null,
        input.branch_code || null,
        maybeEncrypt(input.account_number) || null,
        input.account_type || null,
        input.account_holder_name || null,
        bankingProvided ? timestamp : existing.banking_updated_at,
        bankingProvided ? actorId : existing.banking_updated_by,
        timestamp,
        userId,
      ]
    );
  }

  return getPayrollProfile(userId, true);
}

export async function listBankingRequests(filters: { status?: string; user_id?: string }) {
  let query = `
    SELECT r.*, u.name AS staff_name, u.email AS staff_email,
           p.bank_name AS current_bank_name,
           p.branch_code AS current_branch_code,
           p.account_number AS current_account_number,
           p.account_type AS current_account_type,
           p.account_holder_name AS current_account_holder_name
    FROM banking_change_requests r
    INNER JOIN users u ON u.id = r.user_id
    LEFT JOIN staff_payroll_profiles p ON p.user_id = r.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.status) {
    query += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters.user_id) {
    query += ' AND r.user_id = ?';
    params.push(filters.user_id);
  }

  query += ' ORDER BY r.created_at DESC';
  const rows = await db.query<any>(query, params);

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    staff_name: row.staff_name || row.staff_email,
    staff_email: row.staff_email,
    current_banking: row.current_bank_name ? {
      bank_name: row.current_bank_name,
      branch_code: row.current_branch_code,
      account_number: maybeDecrypt(row.current_account_number),
      account_type: row.current_account_type,
      account_holder_name: row.current_account_holder_name,
    } : null,
    requested_banking: {
      bank_name: row.bank_name,
      branch_code: row.branch_code,
      account_number: maybeDecrypt(row.account_number),
      account_type: row.account_type,
      account_holder_name: row.account_holder_name,
    },
    status: row.status,
    rejection_reason: row.rejection_reason,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
  }));
}

export async function approveBankingRequest(id: string, actorId: string) {
  return db.transaction(async (conn) => {
    const [rows]: any = await conn.query('SELECT * FROM banking_change_requests WHERE id = ? LIMIT 1', [id]);
    const request = (rows?.[0] || null) as BankingRequestRow | null;
    if (!request) throw notFound('Banking change request not found');
    if (request.status !== 'pending') throw badRequest('This request has already been reviewed');

    const [profiles]: any = await conn.query('SELECT * FROM staff_payroll_profiles WHERE user_id = ? LIMIT 1', [request.user_id]);
    const profile = profiles?.[0] as PayrollProfileRow | undefined;
    if (!profile) throw badRequest('Payroll profile not yet created. Please create the payroll profile first.');

    await conn.execute(
      `UPDATE staff_payroll_profiles
       SET bank_name = ?, branch_code = ?, account_number = ?, account_type = ?, account_holder_name = ?,
           banking_updated_at = ?, banking_updated_by = ?, updated_at = ?
       WHERE user_id = ?`,
      [
        request.bank_name,
        request.branch_code,
        request.account_number,
        request.account_type,
        request.account_holder_name,
        now(),
        actorId,
        now(),
        request.user_id,
      ]
    );

    await conn.execute(
      `UPDATE banking_change_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`,
      [actorId, now(), now(), id]
    );

    const [users]: any = await conn.query('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [request.user_id]);
    const user = users?.[0];

    return {
      request_id: request.id,
      user_id: request.user_id,
      staff_name: user?.name || user?.email || request.user_id,
      new_bank_name: request.bank_name,
      approved_at: now(),
    };
  });
}

export async function rejectBankingRequest(id: string, actorId: string, reason: string) {
  const request = await db.queryOne<BankingRequestRow>('SELECT * FROM banking_change_requests WHERE id = ?', [id]);
  if (!request) throw notFound('Banking change request not found');
  if (request.status !== 'pending') throw badRequest('This request has already been reviewed');
  if (!reason?.trim()) throw badRequest('Rejection reason is required');

  await db.execute(
    `UPDATE banking_change_requests
     SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
     WHERE id = ?`,
    [reason.trim(), actorId, now(), now(), id]
  );

  return {
    request_id: request.id,
    user_id: request.user_id,
    rejected_at: now(),
  };
}

export async function listSalaries(filters: { has_salary?: string; search?: string }) {
  const staff = await listPayrollProfiles({ search: filters.search });
  const results = await Promise.all(staff.map(async (row) => {
    const user = await getStaffUser(row.user_id);
    const profile = await getPayrollProfileRow(row.user_id);
    const salary = await getSalaryRow(row.user_id);
    return {
      user_id: row.user_id,
      name: user.name || user.email,
      email: user.email,
      employment_date: profile?.employment_date ? dateOnly(profile.employment_date) : null,
      has_profile: !!profile,
      salary: await hydrateSalary(user, profile, salary),
    };
  }));

  if (filters.has_salary === 'true') return results.filter((row) => !!row.salary);
  if (filters.has_salary === 'false') return results.filter((row) => !row.salary);
  return results;
}

export async function getSalary(userId: string) {
  const user = await getStaffUser(userId);
  const profile = await getPayrollProfileRow(userId);
  const salary = await getSalaryRow(userId);
  if (!salary) throw notFound('No salary configured for this staff member');
  return hydrateSalary(user, profile, salary);
}

export async function saveSalary(userId: string, input: SalaryInput, actorId: string) {
  const user = await getStaffUser(userId);
  const profile = await getPayrollProfileRow(userId);
  if (!profile) throw badRequest('Staff member must have a payroll profile before salary can be set');
  if (!profile.employment_date) throw badRequest('Staff member must have an employment date set before salary can be configured');
  if (!Number.isInteger(input.gross_salary_cents) || input.gross_salary_cents <= 0) {
    throw badRequest('gross_salary_cents must be a positive integer');
  }

  const effectiveFrom = input.effective_from || profile.employment_date;
  if (new Date(effectiveFrom).getTime() < new Date(profile.employment_date).getTime()) {
    throw badRequest(`effective_from cannot be before the staff member's employment date (${dateOnly(profile.employment_date)})`);
  }

  const totalDeductions = (input.deductions || []).reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const totalAllowances = (input.allowances || []).reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  if (totalDeductions > input.gross_salary_cents + totalAllowances) {
    throw badRequest('Total deductions exceed gross salary plus allowances');
  }

  await db.transaction(async (conn) => {
    const [rows]: any = await conn.query('SELECT id FROM staff_salaries WHERE user_id = ? LIMIT 1', [userId]);
    const existing = rows?.[0] as { id: string } | undefined;
    const salaryId = existing?.id || generateId();

    if (existing) {
      await conn.execute(
        `UPDATE staff_salaries
         SET gross_salary_cents = ?, effective_from = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [input.gross_salary_cents, effectiveFrom, input.notes || null, now(), salaryId]
      );
      await conn.execute('DELETE FROM salary_deductions WHERE salary_id = ?', [salaryId]);
    } else {
      await conn.execute(
        `INSERT INTO staff_salaries
          (id, user_id, gross_salary_cents, effective_from, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [salaryId, userId, input.gross_salary_cents, effectiveFrom, input.notes || null, actorId, now(), now()]
      );
    }

    await insertSalaryLines(conn, salaryId, 'deduction', input.deductions);
    await insertSalaryLines(conn, salaryId, 'allowance', input.allowances);
  });

  const saved = await getSalary(userId);
  return {
    ...saved,
    user_name: user.name || user.email,
  };
}

export async function deleteSalary(userId: string) {
  const salary = await getSalaryRow(userId);
  if (!salary) throw notFound('No salary configured for this staff member');
  await db.execute('DELETE FROM staff_salaries WHERE user_id = ?', [userId]);
  return { success: true };
}

/**
 * Delete a payroll profile and ALL associated data:
 * salary_deductions → staff_salaries → payslips → banking_change_requests → staff_payroll_profiles
 */
export async function deletePayrollProfile(userId: string) {
  await getStaffUser(userId);

  // 1. Delete salary deductions (linked via salary_id)
  const salary = await getSalaryRow(userId);
  if (salary) {
    await db.execute('DELETE FROM salary_deductions WHERE salary_id = ?', [salary.id]);
  }

  // 2. Delete salary
  await db.execute('DELETE FROM staff_salaries WHERE user_id = ?', [userId]);

  // 3. Delete all payslips
  await db.execute('DELETE FROM payslips WHERE user_id = ?', [userId]);

  // 4. Delete banking change requests
  await db.execute('DELETE FROM banking_change_requests WHERE user_id = ?', [userId]);

  // 5. Delete the profile itself
  await db.execute('DELETE FROM staff_payroll_profiles WHERE user_id = ?', [userId]);

  return { success: true };
}

export async function getSalaryHistory(userId: string) {
  await getStaffUser(userId);
  return db.query<any>(
    `SELECT pay_month, pay_year, gross_salary_cents, total_deductions_cents, total_allowances_cents, net_salary_cents, generated_at
     FROM payslips
     WHERE user_id = ?
     ORDER BY pay_year DESC, pay_month DESC`,
    [userId]
  );
}

async function buildPayslipPayload(userId: string, month: number, year: number, actorId: string) {
  const user = await getStaffUser(userId);
  const profile = await getPayrollProfileRow(userId);
  if (!profile) throw badRequest('Staff member must have a payroll profile before payslips can be generated');
  const salary = await getSalaryRow(userId);
  if (!salary) throw notFound('No salary configured for this staff member');

  ensurePeriodAfterDate('employment date', profile.employment_date, month, year);
  ensurePeriodAfterDate('salary effective date', salary.effective_from, month, year);

  const lines = await getSalaryLines(salary.id);
  const totals = computeSalaryTotals(lines);
  const gross = Number(salary.gross_salary_cents);
  const net = gross - totals.total_deductions_cents + totals.total_allowances_cents;
  const suffix = userId.replace(/-/g, '').slice(0, 6).toUpperCase();

  return {
    id: generateId(),
    user_id: userId,
    salary_id: salary.id,
    reference_number: `PS-${year}-${String(month).padStart(2, '0')}-${suffix}`,
    pay_month: month,
    pay_year: year,
    gross_salary_cents: gross,
    total_deductions_cents: totals.total_deductions_cents,
    total_allowances_cents: totals.total_allowances_cents,
    net_salary_cents: net,
    deductions_snapshot: JSON.stringify(totals.deductions.map(({ type, label, amount_cents }) => ({ type, label, amount_cents }))),
    allowances_snapshot: JSON.stringify(totals.allowances.map(({ type, label, amount_cents }) => ({ type, label, amount_cents }))),
    status: 'generated',
    generated_by: actorId,
    generated_at: now(),
    created_at: now(),
    updated_at: now(),
  };
}

export async function generatePayslip(input: GeneratePayslipInput, actorId: string) {
  ensureCurrentYearAndNotFuture(input.month, input.year);
  await getStaffUser(input.user_id);

  const existing = await db.queryOne<PayslipRow>(
    'SELECT * FROM payslips WHERE user_id = ? AND pay_month = ? AND pay_year = ?',
    [input.user_id, input.month, input.year]
  );

  if (existing && !input.overwrite) {
    throw new HttpError(409, 'CONFLICT', 'Payslip already exists for this period');
  }

  const payload = await buildPayslipPayload(input.user_id, input.month, input.year, actorId);

  await db.transaction(async (conn) => {
    if (existing) {
      await conn.execute('DELETE FROM payslips WHERE id = ?', [existing.id]);
    }

    await conn.execute(
      `INSERT INTO payslips
        (id, user_id, salary_id, reference_number, pay_month, pay_year, gross_salary_cents,
         total_deductions_cents, total_allowances_cents, net_salary_cents, deductions_snapshot,
         allowances_snapshot, status, generated_by, generated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.user_id,
        payload.salary_id,
        payload.reference_number,
        payload.pay_month,
        payload.pay_year,
        payload.gross_salary_cents,
        payload.total_deductions_cents,
        payload.total_allowances_cents,
        payload.net_salary_cents,
        payload.deductions_snapshot,
        payload.allowances_snapshot,
        payload.status,
        payload.generated_by,
        payload.generated_at,
        payload.created_at,
        payload.updated_at,
      ]
    );
  });

  return getPayslipById(payload.id);
}

export async function generateBulkPayslips(input: GenerateBulkPayslipInput, actorId: string) {
  ensureCurrentYearAndNotFuture(input.month, input.year);
  const users = await db.query<StaffRow>('SELECT id, name, email, is_staff, is_admin FROM users WHERE (is_staff = 1 OR is_admin = 1) ORDER BY COALESCE(name, email) ASC');
  const details: any[] = [];
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const existing = await db.queryOne<PayslipRow>(
        'SELECT * FROM payslips WHERE user_id = ? AND pay_month = ? AND pay_year = ?',
        [user.id, input.month, input.year]
      );
      if (existing && !input.overwrite) {
        skipped += 1;
        details.push({ user_id: user.id, name: user.name || user.email, status: 'skipped', reason: 'Payslip already exists' });
        continue;
      }
      const payload = await buildPayslipPayload(user.id, input.month, input.year, actorId);
      if (existing) {
        await db.execute('DELETE FROM payslips WHERE id = ?', [existing.id]);
      }
      await db.execute(
        `INSERT INTO payslips
          (id, user_id, salary_id, reference_number, pay_month, pay_year, gross_salary_cents,
           total_deductions_cents, total_allowances_cents, net_salary_cents, deductions_snapshot,
           allowances_snapshot, status, generated_by, generated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.id,
          payload.user_id,
          payload.salary_id,
          payload.reference_number,
          payload.pay_month,
          payload.pay_year,
          payload.gross_salary_cents,
          payload.total_deductions_cents,
          payload.total_allowances_cents,
          payload.net_salary_cents,
          payload.deductions_snapshot,
          payload.allowances_snapshot,
          payload.status,
          payload.generated_by,
          payload.generated_at,
          payload.created_at,
          payload.updated_at,
        ]
      );
      generated += 1;
      details.push({ user_id: user.id, name: user.name || user.email, status: 'generated', reference: payload.reference_number });
    } catch (error: any) {
      if (error instanceof HttpError && error.status === 400 && /employment date|salary effective date/.test(error.message)) {
        skipped += 1;
        details.push({ user_id: user.id, name: user.name || user.email, status: 'skipped', reason: error.message });
      } else if (error instanceof HttpError && error.status === 404) {
        skipped += 1;
        details.push({ user_id: user.id, name: user.name || user.email, status: 'skipped', reason: error.message });
      } else {
        errors += 1;
        details.push({ user_id: user.id, name: user.name || user.email, status: 'error', reason: error?.message || 'Unknown error' });
      }
    }
  }

  return { generated, skipped, errors, details };
}

export async function listPayslips(filters: { month?: string; year?: string; user_id?: string; status?: string; page?: string; limit?: string }) {
  const page = Math.max(parseInt(filters.page || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit || '50', 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.*, u.name AS employee_name, u.email AS employee_email
    FROM payslips p
    INNER JOIN users u ON u.id = p.user_id
    WHERE 1=1
  `;
  let countQuery = 'SELECT COUNT(*) AS count FROM payslips p WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (filters.month) {
    query += ' AND p.pay_month = ?';
    countQuery += ' AND p.pay_month = ?';
    params.push(Number(filters.month));
    countParams.push(Number(filters.month));
  }
  if (filters.year) {
    query += ' AND p.pay_year = ?';
    countQuery += ' AND p.pay_year = ?';
    params.push(Number(filters.year));
    countParams.push(Number(filters.year));
  }
  if (filters.user_id) {
    query += ' AND p.user_id = ?';
    countQuery += ' AND p.user_id = ?';
    params.push(filters.user_id);
    countParams.push(filters.user_id);
  }
  if (filters.status) {
    query += ' AND p.status = ?';
    countQuery += ' AND p.status = ?';
    params.push(filters.status);
    countParams.push(filters.status);
  }

  query += ' ORDER BY p.pay_year DESC, p.pay_month DESC, p.generated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.query<any>(query, params);
  const count = await db.queryOne<{ count: number }>(countQuery, countParams);

  return {
    data: rows.map((row) => ({
      ...row,
      deductions_snapshot: parseJsonArray(row.deductions_snapshot),
      allowances_snapshot: parseJsonArray(row.allowances_snapshot),
    })),
    pagination: {
      page,
      limit,
      total: Number(count?.count || 0),
      totalPages: Math.max(Math.ceil(Number(count?.count || 0) / limit), 1),
    },
  };
}

export async function getPayslipById(id: string, userId?: string) {
  let query = `
    SELECT p.*, u.name AS employee_name, u.email AS employee_email,
           pr.employment_date, pr.id_number, pr.tax_number, pr.bank_name, pr.account_number, pr.account_type
    FROM payslips p
    INNER JOIN users u ON u.id = p.user_id
    LEFT JOIN staff_payroll_profiles pr ON pr.user_id = p.user_id
    WHERE p.id = ?
  `;
  const params: any[] = [id];
  if (userId) {
    query += ' AND p.user_id = ?';
    params.push(userId);
  }

  const payslip = await db.queryOne<any>(query, params);
  if (!payslip) throw notFound('Payslip not found');

  return {
    ...payslip,
    deductions_snapshot: parseJsonArray(payslip.deductions_snapshot),
    allowances_snapshot: parseJsonArray(payslip.allowances_snapshot),
    account_number_masked: maskAccountNumber(maybeDecrypt(payslip.account_number)),
  };
}

export async function voidPayslip(id: string, _actorId: string) {
  const payslip = await db.queryOne<PayslipRow>('SELECT * FROM payslips WHERE id = ?', [id]);
  if (!payslip) throw notFound('Payslip not found');
  await db.execute('DELETE FROM payslips WHERE id = ?', [id]);
  return { success: true };
}

export async function getPayrollSummary(month?: number, year?: number) {
  const current = currentPeriod();
  const payMonth = month || current.month;
  const payYear = year || current.year;

  const rows = await db.query<any>(
    `SELECT p.*, u.name AS employee_name
     FROM payslips p
     INNER JOIN users u ON u.id = p.user_id
     WHERE p.pay_month = ? AND p.pay_year = ? AND p.status = 'generated'
     ORDER BY COALESCE(u.name, u.email) ASC`,
    [payMonth, payYear]
  );

  return {
    period: `${payYear}-${String(payMonth).padStart(2, '0')}`,
    month: payMonth,
    year: payYear,
    staff_count: rows.length,
    payslips_generated: rows.length,
    total_gross_cents: rows.reduce((sum, row) => sum + Number(row.gross_salary_cents || 0), 0),
    total_deductions_cents: rows.reduce((sum, row) => sum + Number(row.total_deductions_cents || 0), 0),
    total_allowances_cents: rows.reduce((sum, row) => sum + Number(row.total_allowances_cents || 0), 0),
    total_net_cents: rows.reduce((sum, row) => sum + Number(row.net_salary_cents || 0), 0),
    breakdown: rows.map((row) => ({
      user_id: row.user_id,
      employee_name: row.employee_name,
      gross_salary_cents: Number(row.gross_salary_cents || 0),
      total_deductions_cents: Number(row.total_deductions_cents || 0),
      total_allowances_cents: Number(row.total_allowances_cents || 0),
      net_salary_cents: Number(row.net_salary_cents || 0),
      reference_number: row.reference_number,
    })),
  };
}

export async function getStaffPayrollProfile(userId: string) {
  const profile = await getPayrollProfile(userId, false);
  return {
    employment_date: profile.employment_date,
    id_number: profile.id_number ? `${profile.id_number.slice(0, 6)}****${profile.id_number.slice(-3)}` : null,
    tax_number: profile.tax_number,
    bank_name: profile.bank_name,
    branch_code: profile.branch_code,
    account_number_masked: profile.account_number_masked,
    account_type: profile.account_type,
    account_holder_name: profile.account_holder_name,
    has_pending_banking_request: profile.has_pending_banking_request,
  };
}

export async function listStaffPayslips(userId: string, year?: number) {
  const current = currentPeriod();
  return db.query<any>(
    `SELECT id, reference_number, pay_month, pay_year, gross_salary_cents, total_deductions_cents,
            total_allowances_cents, net_salary_cents, status, generated_at
     FROM payslips
     WHERE user_id = ? AND pay_year = ?
     ORDER BY pay_year DESC, pay_month DESC`,
    [userId, year || current.year]
  );
}

export async function submitBankingRequest(userId: string, input: BankingRequestInput) {
  await getStaffUser(userId);
  const profile = await getPayrollProfileRow(userId);
  if (!profile) throw badRequest('Payroll profile not yet created. Please contact admin.');

  const pending = await db.queryOne<{ id: string }>(
    "SELECT id FROM banking_change_requests WHERE user_id = ? AND status = 'pending' LIMIT 1",
    [userId]
  );
  if (pending) {
    throw new HttpError(409, 'CONFLICT', 'You already have a pending banking change request. Please wait for admin review.');
  }

  const id = generateId();
  await db.execute(
    `INSERT INTO banking_change_requests
      (id, user_id, bank_name, branch_code, account_number, account_type, account_holder_name, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      id,
      userId,
      input.bank_name,
      input.branch_code,
      maybeEncrypt(input.account_number),
      input.account_type,
      input.account_holder_name,
      now(),
      now(),
    ]
  );

  return {
    id,
    status: 'pending',
    created_at: now(),
  };
}

export async function getLatestBankingRequest(userId: string) {
  const request = await db.queryOne<BankingRequestRow>(
    'SELECT * FROM banking_change_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (!request) return null;

  return {
    id: request.id,
    bank_name: request.bank_name,
    branch_code: request.branch_code,
    account_number_masked: maskAccountNumber(maybeDecrypt(request.account_number)),
    account_type: request.account_type,
    account_holder_name: request.account_holder_name,
    status: request.status,
    rejection_reason: request.rejection_reason,
    created_at: request.created_at,
    reviewed_at: request.reviewed_at,
  };
}
