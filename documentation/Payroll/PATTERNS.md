# Payroll Module — Architecture Patterns

---

## 1. Service Layer Pattern

All business logic lives in `payrollService.ts`. Route handlers are thin — they validate input (Zod), call a service function, and return the result. This keeps routes testable and logic centralized.

```
Route handler (adminPayroll.ts)
  ├─ Zod validation
  ├─ payrollService.functionName()
  └─ res.json({ data }) or res.status(code).json({ error })
```

**Example:**

```typescript
// Route handler — thin
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await listPayrollProfiles();
    res.json({ data: profiles });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Service function — contains all logic
export async function listPayrollProfiles() {
  const [rows] = await db.query(`SELECT ... FROM users u LEFT JOIN ...`);
  return (rows as any[]).map(row => ({
    user_id: row.uid,
    // ... field mapping
  }));
}
```

---

## 2. Cents Pattern (Monetary Values)

All monetary values use **integer cents** to avoid floating-point arithmetic errors.

| ❌ Avoid | ✅ Use |
|----------|--------|
| `25000.00` (float) | `2500000` (cents) |
| `DECIMAL(10,2)` | `BIGINT` |
| `parseFloat()` | Integer arithmetic |

**Computation:**

```typescript
function computeSalaryTotals(grossCents: number, lines: SalaryLineRow[]) {
  const deductions = lines
    .filter(l => l.type === 'deduction')
    .reduce((sum, l) => sum + l.amount_cents, 0);
  const allowances = lines
    .filter(l => l.type === 'allowance')
    .reduce((sum, l) => sum + l.amount_cents, 0);
  return {
    total_deductions_cents: deductions,
    total_allowances_cents: allowances,
    net_salary_cents: grossCents - deductions + allowances,
  };
}
```

**Frontend display:**

```typescript
const currency = (cents: number) =>
  'R ' + (cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 });

currency(2500000); // → "R 25,000.00"
```

---

## 3. AES-256-GCM Encryption Pattern

Bank account numbers are encrypted at rest using the shared `cryptoUtils` module.

**Storage format:** `iv:authTag:ciphertext` (colon-separated)

**Encryption flow:**

```typescript
// On write (upsert profile)
const encryptedAccountNumber = maybeEncrypt(input.account_number);
// → stores "a1b2c3...:d4e5f6...:g7h8i9..."

// On admin read (decrypt)
const plainAccountNumber = maybeDecrypt(row.account_number);
// → returns "123456789"

// On staff read (mask)
const maskedAccountNumber = maskAccountNumber(plainAccountNumber);
// → returns "****6789"
```

**Wrapper functions:**

```typescript
function maybeEncrypt(value: string | null | undefined): string | null {
  return value ? encryptPassword(value) : null;
}

function maybeDecrypt(value: string | null | undefined): string | null {
  return value ? decryptPassword(value) : null;
}

function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  return '****' + value.slice(-4);
}
```

---

## 4. All-or-Nothing Validation Pattern

Banking fields must be provided as a complete set or not at all. Partial submissions are rejected.

```typescript
function validateBankingFields(data: PayrollProfileInput): void {
  const bankingFields = [
    data.bank_name, data.branch_code, data.account_number,
    data.account_type, data.account_holder_name,
  ];
  const filled = bankingFields.filter(f => f != null && f !== '');
  if (filled.length > 0 && filled.length < 5) {
    const err: any = new Error('All banking fields must be provided together or left empty');
    err.status = 400;
    throw err;
  }
}
```

---

## 5. Explicit Column Selection Pattern (LEFT JOIN Safety)

When using LEFT JOIN, avoid `SELECT p.*` if the joined table has a column name that matches an alias from the primary table. MySQL silently overwrites earlier columns with later ones of the same name.

**❌ Anti-pattern (caused null user_ids):**

```sql
SELECT u.id AS user_id, u.first_name, u.last_name, p.*
FROM users u
LEFT JOIN staff_payroll_profiles p ON p.user_id = u.id
-- p.* includes p.user_id which is NULL for non-joined rows
-- This overwrites the u.id AS user_id alias!
```

**✅ Correct pattern (explicit columns with distinct aliases):**

```sql
SELECT
  u.id AS uid,
  u.first_name,
  u.last_name,
  u.email,
  u.is_admin,
  u.is_staff,
  p.id AS profile_id,
  p.user_id AS p_user_id,
  p.employment_date AS p_employment_date,
  p.bank_name AS p_bank_name,
  p.account_number AS p_account_number,
  p.branch_code AS p_branch_code,
  p.account_type AS p_account_type,
  p.account_holder_name AS p_account_holder_name
FROM users u
LEFT JOIN staff_payroll_profiles p ON p.user_id = u.id
WHERE (u.is_staff = 1 OR u.is_admin = 1)
```

Then map in JavaScript:

```typescript
return rows.map(r => ({
  user_id: r.uid,       // from u.id, never null
  profile_id: r.profile_id,  // from p.id, null if no profile
  // ...
}));
```

---

## 6. JSON Snapshot Pattern (Payslips)

Payslips store a snapshot of salary line items as JSON, preserving the exact state at generation time. This means salary configuration changes after payslip generation don't affect historical payslips.

```typescript
// On generate
const deductionsJson = JSON.stringify(
  deductions.map(d => ({ label: d.label, amount_cents: d.amount_cents }))
);
const allowancesJson = JSON.stringify(
  allowances.map(a => ({ label: a.label, amount_cents: a.amount_cents }))
);

// INSERT INTO payslips (..., deductions_json, allowances_json)
// VALUES (..., ?, ?)
```

**Advantages:**
- Historical accuracy — payslip always reflects the salary at time of generation
- No complex versioning needed for salary configurations
- Self-contained records — payslip can render without querying salary tables
- Audit compliance — immutable record of what was paid

---

## 7. Payslip Reference Generation

Payslip references use a deterministic prefix with random suffix for uniqueness:

```typescript
const reference = `PS-${payYear}-${String(payMonth).padStart(2, '0')}-${
  crypto.randomBytes(3).toString('hex').toUpperCase()
}`;
// → "PS-2025-03-A1B2C3"
```

Combined with the unique constraint on `(user_id, pay_month, pay_year)`, this prevents duplicate payslips while providing human-readable references.

---

## 8. Business Rule Validation Chain

Payslip generation enforces a chain of validation rules, each with a specific error message:

```typescript
async function generatePayslip(input: GeneratePayslipInput) {
  // 1. User must be staff/admin
  const user = await getStaffUser(input.user_id);
  // → 404: "Staff member not found"

  // 2. Profile must exist
  const profile = await getProfileRow(input.user_id);
  // → 404: "Payroll profile not found"

  // 3. Employment date must be set
  if (!profile.employment_date) throw { status: 400, message: "..." };
  // → 400: "Employment date required"

  // 4. Current year only
  ensureCurrentYearAndNotFuture(input.pay_month, input.pay_year);
  // → 400: "Can only generate payslips for the current year"
  // → 400: "Cannot generate payslip for a future month"

  // 5. After employment date
  ensurePeriodAfterDate(input.pay_month, input.pay_year, profile.employment_date, 'employment');
  // → 400: "Cannot generate payslip before employment date"

  // 6. After salary effective date
  ensurePeriodAfterDate(input.pay_month, input.pay_year, salary.effective_from, 'salary effective');
  // → 400: "Cannot generate payslip before salary effective date"

  // 7. Unique constraint (handled by DB)
  // → 409: Duplicate entry (caught and re-thrown)
}
```

---

## 9. Error Object Pattern

Service functions throw error objects with `status` and `message` properties. Route handlers catch and forward:

```typescript
// Service
const err: any = new Error('Staff member not found');
err.status = 404;
throw err;

// Route handler
try {
  const result = await serviceFunction();
  res.json({ data: result });
} catch (err: any) {
  res.status(err.status || 500).json({ error: err.message });
}
```

---

## 10. PDF Generation Pattern (Puppeteer)

Payslip PDFs are generated on-the-fly using Puppeteer:

```typescript
export async function generatePayslipPdfBuffer(data: PayslipPdfData): Promise<Buffer> {
  // 1. Build HTML string with escaped content
  const html = buildPayslipHtml(data);

  // 2. Launch headless Chrome
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // 3. Render to PDF
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });

  // 4. Cleanup and return
  await browser.close();
  return Buffer.from(pdf);
}
```

**XSS prevention:** All user content goes through `escapeHtml()`:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

---

## 11. Middleware Chain Pattern

Admin and staff routes use different middleware chains:

```typescript
// Admin routes — full admin access
const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
// Mounted in app.ts: app.use('/api/admin/payroll', auditLogger, adminRouter);

// Staff routes — self-service only
const staffRouter = Router();
staffRouter.use(requireAuth, requireStaff);
// Mounted in app.ts: app.use('/api/staff/payroll', staffRouter);
```

**`requireAuth`** → Verifies JWT, sets `req.userId`  
**`requireAdmin`** → Checks `users.is_admin = 1`  
**`requireStaff`** → Checks `users.is_staff = 1`  
**`auditLogger`** → Logs admin actions for audit trail

---

## 12. Transaction Pattern (Salary Save)

Salary save uses a MySQL transaction to atomically update the salary row and its line items:

```typescript
const conn = await db.getConnection();
try {
  await conn.beginTransaction();

  // 1. Upsert salary row
  await conn.execute(`INSERT INTO staff_salaries ... ON DUPLICATE KEY UPDATE ...`, [...]);

  // 2. Delete old line items
  await conn.execute(`DELETE FROM salary_deductions WHERE salary_id = ?`, [salaryId]);

  // 3. Insert new line items
  for (const line of [...deductions, ...allowances]) {
    await conn.execute(`INSERT INTO salary_deductions ...`, [...]);
  }

  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

---

## 14. Leave Balance Auto-Creation Pattern

Leave balances are automatically created with South African statutory defaults when first accessed. This eliminates admin setup for new employees.

```typescript
const SA_ENTITLEMENTS = {
  annual: 15, sick: 30, family_responsibility: 3,
  maternity: 80, parental: 10,
};

export async function ensureBalances(userId: number, year = new Date().getFullYear()) {
  const [existing] = await db.query(
    'SELECT leave_type FROM leave_balances WHERE user_id = ? AND cycle_year = ?',
    [userId, year]
  );
  const existingTypes = new Set((existing as any[]).map(r => r.leave_type));

  for (const [type, days] of Object.entries(SA_ENTITLEMENTS)) {
    if (!existingTypes.has(type)) {
      await db.execute(
        `INSERT INTO leave_balances (id, user_id, leave_type, cycle_year, entitled_days)
         VALUES (?, ?, ?, ?, ?)`,
        [generateId(), userId, type, year, days]
      );
    }
  }
}
```

**Usage:** Called at the start of `getBalances()` and `createLeaveRequest()` to guarantee rows exist.

---

## 15. Working Days Calculation Pattern

Leave days are counted as Mon-Fri working days only (no public holiday calendar).

```typescript
export function countWorkingDays(start: string, end: string): number {
  let count = 0;
  const d = new Date(start);
  const last = new Date(end);
  while (d <= last) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;  // Skip Sat (6) and Sun (0)
    d.setDate(d.getDate() + 1);
  }
  return count;
}
```

**Note:** This is a simplified implementation. A future enhancement could integrate a SA public holiday calendar.

---

## 16. Leave Request State Machine Pattern

Leave requests follow a strict state machine with balance side-effects:

```
                ┌─────────┐
  submit ──────▶│ pending │──────▶ approve ──▶ approved
                │         │──────▶ reject  ──▶ rejected
                │         │──────▶ cancel  ──▶ cancelled
                └─────────┘
  
  approved ──────────────────────▶ cancel  ──▶ cancelled
```

**Balance side-effects:**

| Action | `pending_days` | `used_days` |
|--------|---------------|-------------|
| Submit | +days | — |
| Approve | −days | +days |
| Reject | −days | — |
| Cancel (from pending) | −days | — |
| Cancel (from approved) | — | −days |

Each transition is performed in a single service function with validation:
- Only `pending` requests can be approved/rejected
- Only `pending` or `approved` requests can be cancelled
- Cancellation allowed by the request owner or any admin

---

## 17. Silent Error Handling Pattern (Frontend)

Data-loading functions in Profile tabs use silent error handling to avoid disruptive popups when the user navigates to a tab before data is available.

```typescript
// ❌ Anti-pattern — disruptive popup on initial load
const loadData = async () => {
  try {
    const data = await Model.getData();
    setState(data);
  } catch {
    Swal.fire({ icon: 'error', title: 'Failed to load data' }); // Annoying on first visit
  }
};

// ✅ Correct pattern — silent console error, graceful empty state
const loadData = async () => {
  try {
    const data = await Model.getData();
    setState(data);
  } catch (err) {
    console.error('Failed to load data:', err);
    // UI shows empty state naturally (empty array/null renders "No data")
  }
};
```

**Used in:** `PayrollTab.tsx`, `LeaveTab.tsx` — load functions only log to console; submit/action functions still show SweetAlert2 errors.

---

## 18. Download Feedback Pattern (SweetAlert2 Toast)

When users download files (payslip PDFs), a brief non-blocking notification indicates the download is starting, then auto-hides.

```typescript
const handleDownload = async (payslipId: number) => {
  Swal.fire({
    icon: 'info',
    title: 'Downloading...',
    text: 'Your payslip download will begin shortly',
    timer: 2000,
    showConfirmButton: false,
    timerProgressBar: true,
  });

  const blob = await PayrollModel.downloadPayslipPdf(payslipId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payslip-${reference}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Key choices:**
- `timer: 2000` — auto-dismiss after 2 seconds
- `showConfirmButton: false` — no user interaction needed
- `timerProgressBar: true` — visual feedback that it's temporary

**Used in:** `PayrollTab.tsx` (staff), `Payroll.tsx` (admin)

---

## 19. Payslip Leave Integration Pattern

Payslip PDF generation queries leave balances live at download time (not snapshotted) so the displayed leave days remaining is always current.

```typescript
// In adminPayroll.ts / staffPayroll.ts - GET /payslips/:id/pdf
const currentYear = new Date().getFullYear();
const [leaveRows]: any = await db.query(
  `SELECT remaining_days FROM leave_balances
   WHERE user_id = ? AND leave_type = 'annual' AND cycle_year = ?`,
  [payslip.user_id, currentYear]
);

const pdfData: PayslipPdfData = {
  // ... salary snapshot fields ...
  leave_days_remaining: leaveRows[0]?.remaining_days ?? null,
};
```

**Design decision:** Leave days are queried live (not snapshotted in payslips table) because:
- Leave balances change frequently throughout the month
- The payslip shows the balance *at download time*, not generation time
- This matches the common practice of showing "current balance" on payslips

---

## 13. Anti-Patterns to Avoid

### ❌ Using `SELECT p.*` with LEFT JOIN
See pattern #5 above. Always use explicit column aliases when the joined table shares column names.

### ❌ Storing monetary values as floats
Use integer cents (BIGINT). `25000.50` becomes `2500050`.

### ❌ Storing plain-text bank account numbers
Always encrypt sensitive financial data at rest.

### ❌ Letting staff edit their own banking details directly
Use the banking change request workflow — staff submit, admin approves.

### ❌ Generating payslips without salary snapshots
Always snapshot line items as JSON in the payslip row.

### ❌ Building PDFs from database queries on download
The payslip row contains all the data needed. No need to re-query salary tables.

### ❌ Using `reviewed_by` / `reviewed_at` for leave columns
The database columns are `approved_by` and `approved_at`. Mismatched column names cause 500 errors. Always verify column names against the actual schema.

### ❌ Showing error popups on initial data load
Use the silent error pattern (#17). Reserve SweetAlert2 for user-initiated action failures.
