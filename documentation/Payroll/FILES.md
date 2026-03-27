# Payroll Module — File Inventory

**Total:** 15 files · ~4,500 LOC  
**Backend:** 10 files · ~2,900 LOC  
**Frontend:** 5 files · ~1,600 LOC

---

## 1. Backend Files

### 1.1 `src/services/payrollService.ts` — 1,108 LOC

**Purpose:** Core business-logic layer for all payroll operations. Contains interfaces, helpers, encryption wrappers, salary computation, CRUD operations for profiles/salaries/payslips, and banking change requests.

**Exports (20 public functions):**

| Function | Line | Description |
|----------|------|-------------|
| `listPayrollProfiles()` | ~345 | List all staff/admin users with LEFT JOIN on profiles |
| `getPayrollProfile(userId)` | ~415 | Single profile with decrypted banking fields |
| `upsertPayrollProfile(userId, data)` | ~470 | Create or update profile (encrypts account number) |
| `listBankingRequests()` | ~535 | All banking change requests with user info |
| `approveBankingRequest(requestId, adminId)` | ~575 | Approve request — updates profile banking fields |
| `rejectBankingRequest(requestId, adminId, reason)` | ~640 | Reject request with reason |
| `listSalaries()` | ~670 | All salary configs for a user |
| `getSalary(userId)` | ~695 | Latest salary with line items |
| `saveSalary(userId, data)` | ~740 | Upsert salary and line items (transaction) |
| `deleteSalary(userId)` | ~820 | Delete salary and line items |
| `generatePayslip(input)` | ~845 | Generate single payslip with validation |
| `generateBulkPayslips(input)` | ~915 | Generate payslips for all eligible staff |
| `listPayslips(filters)` | ~950 | List payslips with optional filters |
| `getPayslipById(id, userId?)` | ~975 | Get single payslip (optional ownership check) |
| `voidPayslip(id, adminId)` | ~1000 | Mark payslip as voided |
| `getPayrollSummary(month, year)` | ~1020 | Aggregate stats for a month |
| `getStaffPayrollProfile(userId)` | ~1050 | Staff self-service profile (masked) |
| `listStaffPayslips(userId)` | ~1070 | Staff's own payslips |
| `submitBankingRequest(userId, data)` | ~1080 | Submit banking change request (409 if pending exists) |
| `getLatestBankingRequest(userId)` | ~1100 | Staff's latest banking request status |

**Internal helpers (not exported):**

| Helper | Line | Description |
|--------|------|-------------|
| `getStaffUser(userId)` | ~100 | Verify user is staff/admin, return StaffRow |
| `normalizeProfile(row)` | ~110 | Map DB row to API response shape |
| `computeSalaryTotals(gross, lines)` | ~145 | Calculate deductions, allowances, net |
| `hydrateSalary(row, lines)` | ~165 | Merge salary row + line items into response |
| `maybeEncrypt(value)` | ~185 | Encrypt if non-empty, else null |
| `maybeDecrypt(value)` | ~190 | Decrypt if non-null, else null |
| `maskAccountNumber(value)` | ~195 | Mask all but last 4 digits |
| `validateBankingFields(data)` | ~200 | All-or-nothing banking field validation |
| `ensureCurrentYearAndNotFuture(m, y)` | ~215 | Business rule: current year + not future month |
| `ensurePeriodAfterDate(m, y, date, label)` | ~230 | Business rule: period ≥ date |

**Key interfaces:**

```typescript
interface PayrollProfileInput {
  employment_date?: string | null;
  id_number?: string | null;
  tax_number?: string | null;
  bank_name?: string | null;
  branch_code?: string | null;
  account_number?: string | null;
  account_type?: string | null;
  account_holder_name?: string | null;
}

interface SalaryInput {
  gross_salary_cents: number;
  effective_from: string;
  notes?: string | null;
  deductions: Array<{ type: string; label: string; amount_cents: number }>;
  allowances: Array<{ type: string; label: string; amount_cents: number }>;
}

interface GeneratePayslipInput {
  user_id: number;
  pay_month: number;
  pay_year: number;
}

interface GenerateBulkPayslipInput {
  pay_month: number;
  pay_year: number;
}

interface BankingRequestInput {
  bank_name: string;
  branch_code: string;
  account_number: string;
  account_type: string;
  account_holder_name: string;
}
```

---

### 1.2 `src/routes/adminPayroll.ts` — 307 LOC

**Purpose:** Express router with 18 admin-only endpoints for full payroll management. Mounted at `/api/admin/payroll` in app.ts with `auditLogger` middleware.

**Middleware chain:** `requireAuth → requireAdmin` (applied router-level)

**Zod schemas defined inline:**

| Schema | Description |
|--------|-------------|
| `profileSchema` | employment_date, id_number, tax_number, banking fields (all optional strings) |
| `salarySchema` | gross_salary_cents (number), effective_from (string), notes, deductions[], allowances[] |
| `lineItemSchema` | type, label (strings), amount_cents (number) |
| `generatePayslipSchema` | user_id (number), pay_month (1-12), pay_year (number) |
| `generateBulkSchema` | pay_month (1-12), pay_year (number) |
| `rejectSchema` | reason (string, min 1) |

**Route handlers:** See [ROUTES.md](ROUTES.md) for complete endpoint documentation.

---

### 1.3 `src/routes/staffPayroll.ts` — 108 LOC

**Purpose:** Express router with 5 staff self-service endpoints. Mounted at `/api/staff/payroll` in app.ts.

**Middleware chain:** `requireAuth → requireStaff`

**Route handlers:** See [ROUTES.md](ROUTES.md) for complete endpoint documentation.

---

### 1.4 `src/services/leaveService.ts` — 343 LOC

**Purpose:** Business-logic layer for all leave management operations. Handles leave balances, requests, approvals/rejections, and SA leave entitlement defaults.

**Exports (12 public functions + types):**

| Function | Description |
|----------|-------------|
| `ensureBalances(userId, year?)` | Auto-create balance rows with SA default entitlements if missing |
| `getBalances(userId, year?)` | Get user's leave balances for a cycle year |
| `listAllBalances(year?)` | Admin: get all staff balances with employee names |
| `updateEntitlement(balanceId, days)` | Admin: update entitled days for a balance row |
| `createLeaveRequest(input, actorId)` | Create new leave request with validation |
| `listLeaveRequests(filters)` | List requests with optional user_id/status/year filters |
| `approveLeaveRequest(requestId, actorId)` | Approve request, move pending→used days |
| `rejectLeaveRequest(requestId, actorId, reason?)` | Reject request, release pending days |
| `cancelLeaveRequest(requestId, actorId)` | Cancel request, release pending or used days |
| `countWorkingDays(start, end)` | Count Mon-Fri days between two dates |
| `getAnnualLeaveRemaining(userId, year?)` | Get remaining annual leave (used in payslip PDF) |

**Key types:**

```typescript
type LeaveType = 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental';

interface LeaveBalance {
  id: string; user_id: string; leave_type: LeaveType;
  cycle_year: number; entitled_days: number; used_days: number;
  pending_days: number; remaining_days: number;
}

interface LeaveRequest {
  id: string; user_id: string; leave_type: LeaveType;
  start_date: string; end_date: string; days: number;
  reason?: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string; approved_at?: string; rejection_reason?: string;
  employee_name?: string; reviewer_name?: string;
}

const SA_ENTITLEMENTS = {
  annual: 15, sick: 30, family_responsibility: 3,
  maternity: 80, parental: 10
};
```

---

### 1.5 `src/routes/adminLeave.ts` — 145 LOC

**Purpose:** Express router with 8 admin leave management endpoints. Mounted at `/api/admin/leave` in app.ts.

**Middleware chain:** `requireAuth → requireAdmin`

**Zod schemas:** `submitRequestSchema`, `updateEntitlementSchema`, `approveSchema`

**Route handlers:** See [ROUTES.md](ROUTES.md) for complete endpoint documentation.

---

### 1.6 `src/routes/staffLeave.ts` — 76 LOC

**Purpose:** Express router with 3 staff self-service leave endpoints. Mounted at `/api/staff/leave` in app.ts.

**Middleware chain:** `requireAuth → requireStaff`

**Zod schemas:** `submitRequestSchema` (leave_type enum, date format YYYY-MM-DD)

**Route handlers:** See [ROUTES.md](ROUTES.md) for complete endpoint documentation.

---

### 1.7 `src/middleware/requireStaff.ts` — 48 LOC

**Purpose:** Express middleware that verifies the authenticated user has `is_staff = 1`.

**Exports:**

| Export | Description |
|--------|-------------|
| `requireStaff` | Middleware — queries `SELECT is_staff FROM users WHERE id = ?`, returns 403 if not staff |

**Usage:**

```typescript
import { requireStaff } from '../middleware/requireStaff';
router.use(requireAuth, requireStaff);
```

---

### 1.5 `src/utils/payslipPdf.ts` — 182 LOC

**Purpose:** Generates PDF buffers for payslips using Puppeteer. Renders an HTML template with company branding, employee info, salary breakdown, and deduction/allowance tables.

**Exports:**

| Export | Description |
|--------|-------------|
| `generatePayslipPdfBuffer(data)` | Returns `Promise<Buffer>` — A4 PDF buffer |
| `PayslipPdfData` | Interface defining the input shape |

**Key interface:**

```typescript
interface PayslipPdfData {
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyVat?: string;
  employeeName: string;
  employeeId?: string;
  taxNumber?: string;
  payMonth: number;
  payYear: number;
  reference: string;
  grossSalaryCents: number;
  netSalaryCents: number;
  deductions: Array<{ label: string; amount_cents: number }>;
  allowances: Array<{ label: string; amount_cents: number }>;
}
```

**Implementation details:**
- Uses `loadCompanySettings()` from `pdfGenerator` utility for company branding
- Launches Puppeteer with `--no-sandbox` and `--disable-setuid-sandbox`
- Renders A4 portrait page with CSS-styled HTML template
- Escapes all user content via `escapeHtml()` to prevent XSS
- Month names: `['January', ..., 'December']`
- Currency formatting: `(cents / 100).toFixed(2)` with thousands separator

---

### 1.6 `src/db/migrations/032_payroll_system.ts` — 161 LOC

**Purpose:** Database migration creating 5 payroll tables. See [FIELDS.md](FIELDS.md) for full schema details.

**Tables created:**
1. `staff_payroll_profiles` — Employment and banking details per staff member
2. `banking_change_requests` — Banking change request workflow
3. `staff_salaries` — Monthly salary configurations
4. `salary_deductions` — Line items (deductions and allowances) per salary
5. `payslips` — Generated payslip records with JSON snapshots

**Exports:**

| Export | Description |
|--------|-------------|
| `up(db)` | Creates all 5 tables |
| `down(db)` | Drops all 5 tables in reverse order |

---

### 1.7 `src/scripts/run_migration_032.ts` — 16 LOC

**Purpose:** Standalone script to execute migration 032. Run with `npx tsx src/scripts/run_migration_032.ts`.

---

## 2. Frontend Files

### 2.1 `src/models/PayrollModel.ts` — 202 LOC

**Purpose:** Static model class providing typed API methods for all payroll operations. Imported in admin and staff components.

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `PayrollModel` | class | Static methods wrapping Axios calls |
| `PayrollProfile` | interface | Full profile shape |
| `PayrollProfileListItem` | interface | Sidebar list item (includes `is_admin?`, `is_staff?`) |
| `PayrollLineItem` | interface | Deduction/allowance line item |
| `SalaryConfig` | interface | Salary with line items |
| `Payslip` | interface | Payslip record |
| `BankingRequestStatus` | type | `'pending' \| 'approved' \| 'rejected'` |

**PayrollModel static methods:**

| Method | HTTP | Endpoint |
|--------|------|----------|
| `listProfiles()` | GET | `/admin/payroll/profiles` |
| `getProfile(userId)` | GET | `/admin/payroll/profiles/:userId` |
| `saveProfile(userId, data)` | PUT | `/admin/payroll/profiles/:userId` |
| `getSalary(userId)` | GET | `/admin/payroll/salaries/:userId` |
| `saveSalary(userId, data)` | PUT | `/admin/payroll/salaries/:userId` |
| `deleteSalary(userId)` | DELETE | `/admin/payroll/salaries/:userId` |
| `getSalaryHistory(userId)` | GET | `/admin/payroll/salaries/:userId/history` |
| `generatePayslip(data)` | POST | `/admin/payroll/payslips/generate` |
| `generateBulkPayslips(data)` | POST | `/admin/payroll/payslips/generate-bulk` |
| `listPayslips(params)` | GET | `/admin/payroll/payslips` |
| `getPayslipPdf(id)` | GET | `/admin/payroll/payslips/:id/pdf` |
| `voidPayslip(id)` | DELETE | `/admin/payroll/payslips/:id` |
| `getSummary(month, year)` | GET | `/admin/payroll/summary` |
| `listBankingRequests()` | GET | `/admin/payroll/banking-requests` |
| `approveBankingRequest(id)` | POST | `/admin/payroll/banking-requests/:id/approve` |
| `rejectBankingRequest(id, reason)` | POST | `/admin/payroll/banking-requests/:id/reject` |
| `getMyProfile()` | GET | `/staff/payroll/profile` |
| `getMyPayslips()` | GET | `/staff/payroll/payslips` |
| `getMyPayslipPdf(id)` | GET | `/staff/payroll/payslips/:id/pdf` |
| `submitMyBankingRequest(data)` | POST | `/staff/payroll/banking-request` |
| `getMyLatestBankingRequest()` | GET | `/staff/payroll/banking-request` |

---

### 2.2 `src/pages/admin/Payroll.tsx` — 705 LOC

**Purpose:** Full admin payroll management page with sidebar + tabbed content area.

**Component structure:**

```
Payroll (main page)
├── Sidebar
│   ├── Search input with clear button
│   └── Staff list
│       ├── Initials avatar (first letter of first + last name)
│       ├── Role badge (Admin / Staff)
│       └── Status indicator (Ready / Incomplete / Banking Pending)
├── Tab navigation: Profiles | Salaries | Payslips | Banking Requests
├── Profiles tab
│   ├── Employment date picker
│   ├── ID number, tax number inputs
│   └── Banking details form (5 fields)
├── Salaries tab
│   ├── Gross salary input (displays as Rands, stores as cents)
│   ├── Effective from date
│   ├── Deductions table (add/remove rows)
│   ├── Allowances table (add/remove rows)
│   └── Net salary auto-calculation
├── Payslips tab
│   ├── Summary cards (staff paid, gross, deductions, net)
│   ├── Month selector
│   ├── Generate / Bulk Generate buttons
│   └── Payslips table (reference, period, amounts, PDF download, void)
└── Banking Requests tab
    ├── Pending requests list
    ├── Current vs requested comparison
    └── Approve / Reject buttons (reject prompts for reason)
```

**State management:** React `useState` hooks (no Zustand store for this module)

**Key patterns:**
- `useEffect` loads profile list on mount, selected profile data on selection change
- Currency formatting: `(cents / 100).toLocaleString()` for display
- SweetAlert2 for confirmations (payslip generation, void, banking approve/reject)
- Heroicons v2 for action icons
- Tailwind CSS for all styling

---

### 2.3 `src/components/Profile/PayrollTab.tsx` — 190 LOC

**Purpose:** Staff self-service payroll tab shown in the Profile page. View-only access with banking change request submission.

**Sections:**
1. **Profile summary** — Employment date, masked ID number, masked banking details
2. **Payslips list** — Table of payslips with PDF download
3. **Banking change request** — Form to submit new banking details OR view status of pending/approved/rejected request

**Props:** None (uses `PayrollModel.getMyProfile()` etc. directly)

**Integration:** Added as a tab in `Profile.tsx` — visible only when user has `is_staff = 1`.

---

### 2.4 `src/models/LeaveModel.ts` — 162 LOC

**Purpose:** Static model class providing typed API methods for all leave operations (admin + staff). Imported in admin leave page and staff LeaveTab.

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `LeaveModel` | class | Static methods wrapping Axios calls |
| `LeaveBalance` | interface | Balance shape (id, leave_type, entitled/used/pending/remaining days) |
| `LeaveRequest` | interface | Request shape (dates, days, status, reviewer info) |

**Staff methods (used by LeaveTab):**

| Method | HTTP | Endpoint |
|--------|------|----------|
| `getMyBalances(year?)` | GET | `/staff/leave/balances` |
| `getMyRequests(status?)` | GET | `/staff/leave/requests` |
| `submitMyRequest(type, start, end, reason?)` | POST | `/staff/leave/requests` |

**Admin methods:**

| Method | HTTP | Endpoint |
|--------|------|----------|
| `getBalances(userId, year?)` | GET | `/admin/leave/balances/:userId` |
| `listAllBalances(year?)` | GET | `/admin/leave/balances` |
| `updateEntitlement(balanceId, days)` | PUT | `/admin/leave/balances/:balanceId` |
| `getUserRequests(userId, status?)` | GET | `/admin/leave/requests/:userId` |
| `getPendingRequests()` | GET | `/admin/leave/requests` |
| `submitRequest(userId, ...)` | POST | `/admin/leave/requests` |
| `approveRequest(requestId)` | PUT | `/admin/leave/requests/:requestId` |
| `rejectRequest(requestId, reason)` | PUT | `/admin/leave/requests/:requestId` |

---

### 2.5 `src/components/Profile/LeaveTab.tsx` — 299 LOC

**Purpose:** Staff self-service leave management tab shown in the Profile page.

**Sections:**
1. **Leave Balances** — Grid showing all 5 leave types with colour-coded progress (red=used, yellow=pending, green=remaining)
2. **Request Form** — Collapsible form: leave type dropdown, CustomDatePicker for dates, reason textarea
3. **Request History** — List of all requests with status badges (pending/approved/rejected), rejection reasons, reviewer details

**State:** `balances`, `requests`, `showRequestForm`, `form` (leave_type, start_date, end_date, reason)

**Error handling:** Silent on load (console.error only), SweetAlert2 only on submit failure.

**Integration:** Added as a tab in `Profile.tsx` — visible only when user has `is_staff = 1`.

---

## 3. Integration Points

Files modified to integrate the payroll and leave modules:

| File | Change |
|------|--------|
| `backend/src/app.ts` | Import and mount `adminPayrollRouter` at `/api/admin/payroll` with `auditLogger`; mount `staffPayrollRouter` at `/api/staff/payroll`; mount `adminLeaveRouter` at `/api/admin/leave`; mount `staffLeaveRouter` at `/api/staff/leave` |
| `frontend/src/App.tsx` | Add route `<Route path="/admin/payroll" element={<Payroll />} />` |
| `frontend/src/components/Layout.tsx` | Add "Payroll" sidebar item under "Billing & Finance" |
| `frontend/src/pages/Profile.tsx` | Add PayrollTab and LeaveTab components as tab options; add Leave tab button with CalendarDaysIcon |
| `frontend/src/models/index.ts` | Barrel export `PayrollModel` |
| `backend/src/routes/adminPayroll.ts` | Import `db` for leave balance query in payslip PDF endpoint |
| `backend/src/routes/staffPayroll.ts` | Import `db` for leave balance query in payslip PDF endpoint |

---

## 4. File Dependency Graph

```
adminPayroll.ts ──────────┐
                           ├──▶ payrollService.ts ──▶ mysql.ts (db)
staffPayroll.ts ──────────┘         │                  cryptoUtils.ts
                                    │
                                    └──▶ payslipPdf.ts ──▶ pdfGenerator.ts
                                           │                  (loadCompanySettings)
                                           │
adminPayroll.ts / staffPayroll.ts ────────┘ (leave_balances query for PDF)

adminLeave.ts ────────────┐
                              ├──▶ leaveService.ts ──▶ mysql.ts (db)
staffLeave.ts ────────────┘

Payroll.tsx ──────────────┐
                          ├──▶ PayrollModel.ts ──▶ Axios ──▶ Backend API
PayrollTab.tsx ───────────┘

LeaveTab.tsx ────────────────▶ LeaveModel.ts ──▶ Axios ──▶ Backend API

requireStaff.ts ◀── staffPayroll.ts, staffLeave.ts (middleware import)
```
