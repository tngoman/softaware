# Payroll Module — Change Log

---

## Version History

### v1.0.0 — 2025-03-17 (Initial Release)

**Migration:** `032_payroll_system.ts`

**New features:**
- Payroll profiles with employment dates and banking details
- AES-256-GCM encryption for bank account numbers
- Salary configuration with deduction and allowance line items
- Net salary auto-computation (gross − deductions + allowances)
- Single payslip generation with business rule validation
- Bulk payslip generation for all eligible staff
- Puppeteer PDF payslip generation with company branding
- Payslip voiding (soft delete)
- Banking change request workflow (staff submit → admin approve/reject)
- Staff self-service: view masked profile, download payslips, submit banking requests
- Admin sidebar with initials, role badges, status indicators, search
- Monthly payroll summary (total staff, gross, deductions, net)
- Salary history via payslip snapshots

**Files created (10 files · 3,027 LOC):**

| File | LOC | Purpose |
|------|-----|---------|
| `payrollService.ts` | 1,108 | Business logic layer |
| `adminPayroll.ts` | 307 | Admin API routes (18 endpoints) |
| `staffPayroll.ts` | 108 | Staff API routes (5 endpoints) |
| `requireStaff.ts` | 48 | Staff middleware |
| `payslipPdf.ts` | 182 | PDF generation |
| `032_payroll_system.ts` | 161 | Database migration (5 tables) |
| `run_migration_032.ts` | 16 | Migration runner script |
| `PayrollModel.ts` | 202 | Frontend API model |
| `Payroll.tsx` | 705 | Admin payroll page |
| `PayrollTab.tsx` | 190 | Staff profile payroll tab |

**Database tables created:**
1. `staff_payroll_profiles`
2. `banking_change_requests`
3. `staff_salaries`
4. `salary_deductions`
5. `payslips`

**Integration points modified:**
- `app.ts` — route mounting
- `App.tsx` — React route
- `Layout.tsx` — sidebar navigation
- `Profile.tsx` — payroll tab
- `models/index.ts` — barrel export

---

### v1.0.1 — 2025-03-17 (Bug Fixes)

**Fix: Admin/staff user inclusion**
- **Problem:** `listPayrollProfiles` query filtered `WHERE u.is_staff = 1`, excluding admin-only users
- **Solution:** Changed to `WHERE (u.is_staff = 1 OR u.is_admin = 1)` in three functions: `listPayrollProfiles()`, `getStaffUser()`, `generateBulkPayslips()`
- **Files changed:** `payrollService.ts`

**Fix: SQL column collision causing null user_ids**
- **Problem:** `SELECT u.id AS user_id, ... p.*` caused `p.user_id` (NULL for LEFT JOIN misses) to overwrite `u.id AS user_id`. Every sidebar item had `user_id: null`, making nothing clickable
- **Root cause:** MySQL column name collision when using `p.*` with LEFT JOIN
- **Solution:** Replaced `p.*` with explicit column selections using distinct aliases (`u.id AS uid`, `p.id AS profile_id`, etc.) and JavaScript field mapping
- **Files changed:** `payrollService.ts`

**Fix: Frontend sidebar redesign**
- **Problem:** Original sidebar was minimal, showed "No profile" for everyone, no visual hierarchy, no role indicators
- **Solution:** Complete redesign with initials avatars, Admin/Staff role badges, status indicators (Ready/Incomplete/Banking Pending), search with clear button, left-border selection indicator, empty states
- **Files changed:** `Payroll.tsx`

---

### v1.1.0 — 2025-07-17 (Leave Integration & UX Improvements)

**Leave management system — full integration:**
- Staff self-service leave requests (submit, view history, see balances)
- Admin leave management (view all balances, update entitlements, approve/reject/cancel requests)
- South African BCEA default entitlements auto-created per user per year (annual=15, sick=30, family_responsibility=3, maternity=80, parental=10)
- Leave request state machine: pending → approved/rejected/cancelled with balance side-effects
- Working days calculation (Mon-Fri, excludes weekends)
- UUID primary keys on leave tables (CHAR(36))

**Payslip PDF leave days remaining:**
- Payslip PDF now displays current annual leave days remaining
- Queried live from `leave_balances` at download time (not snapshotted)
- Shown in both admin and staff PDF downloads

**Download notification UX:**
- Staff and admin payslip downloads now show a brief "Downloading..." SweetAlert2 notification
- Auto-hides after 2 seconds with progress bar
- No user interaction required

**Silent error handling:**
- Removed disruptive error popups from PayrollTab and LeaveTab data loading
- Errors logged to console only; UI shows graceful empty state
- SweetAlert2 errors retained for user-initiated actions (submit, approve, etc.)

**Banking status display fix:**
- Changed banking status from showing "none" to contextual message
- Shows "No pending requests" when banking is configured but no requests pending
- Shows "Not configured" when no banking details exist

**Database column name fix:**
- Fixed `reviewed_by`/`reviewed_at` → `approved_by`/`approved_at` in leaveService.ts
- Affected: `listLeaveRequests()` SQL JOIN, `approveLeaveRequest()`, `rejectLeaveRequest()`, TypeScript interface

**New files created (5 files · ~1,025 LOC):**

| File | LOC | Purpose |
|------|-----|---------|
| `leaveService.ts` | 343 | Leave business logic (balances, requests, approve/reject, SA defaults) |
| `adminLeave.ts` | 145 | Admin leave API routes (8 endpoints) |
| `staffLeave.ts` | 76 | Staff leave API routes (3 endpoints) |
| `LeaveModel.ts` | 162 | Frontend leave API model (admin + staff methods) |
| `LeaveTab.tsx` | 299 | Staff profile leave management tab |

**Files modified:**

| File | Changes |
|------|---------|
| `adminPayroll.ts` | Added leave balance query in payslip PDF endpoint |
| `staffPayroll.ts` | Added leave balance query in payslip PDF endpoint |
| `payslipPdf.ts` | Added `leave_days_remaining` to interface and HTML template |
| `app.ts` | Mount `adminLeaveRouter` and `staffLeaveRouter` |
| `Profile.tsx` | Added Leave tab with CalendarDaysIcon |
| `PayrollTab.tsx` | Added download notification, silent error handling, banking status fix |
| `Payroll.tsx` | Added download notification to admin payslip download |

**Database tables created:**
1. `leave_balances` — per-user, per-type, per-year entitlement tracking (UUID PK)
2. `leave_requests` — individual leave request records with approval workflow (UUID PK)

---

## Known Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Current year only | Low | Payslip generation limited to current year (`ensureCurrentYearAndNotFuture`). No way to generate historical payslips. |
| No payroll permissions | Medium | Module uses `requireAdmin` for all admin endpoints. No granular permissions like `payroll.view` or `payroll.manage`. |
| No email delivery | Low | Payslips can only be downloaded. No email/notification when payslip is generated. |
| Salary versioning | Low | Only one salary config per user (UNIQUE constraint). History preserved only through payslip snapshots, not salary versioning. |
| No tax calculator | Medium | Tax amounts (PAYE, UIF) entered manually. No automatic SA tax bracket calculation. |
| Banking request plain text | Low | Banking change requests store account numbers as plain text in `banking_change_requests` table. Only encrypted when copied to profile on approval. |
| Single currency | Low | Hard-coded to South African Rand (R). No multi-currency support. |
| No payrun concept | Medium | Individual or bulk generation per month. No formal "payrun" with approval workflow, draft/finalize states. |
| No public holiday calendar | Low | Working day calculation is Mon-Fri only. No SA public holiday integration for leave day counting. |
| No unpaid leave deduction | Low | Leave and payroll are informational only. No automatic salary deduction for unpaid leave. |

---

## Planned Improvements

| Feature | Priority | Description |
|---------|----------|-------------|
| Multi-year payslips | Medium | Remove current-year restriction for historical payslip generation |
| Payroll permissions | High | Add `payroll.view`, `payroll.manage`, `payroll.generate` permissions |
| Email payslips | Medium | Send payslip PDF via email when generated |
| SARS tax brackets | Medium | Auto-calculate PAYE based on SA tax tables |
| Payrun workflow | Low | Draft → review → approve → finalize payrun process |
| Salary versioning | Low | Keep history of salary changes with effective dates |
| Unpaid leave deductions | Medium | Auto-deduct salary for unpaid leave days |
| Encrypt banking requests | Low | Encrypt account numbers in banking_change_requests table |
| IRP5 certificates | Low | Annual tax certificate generation |
| Bulk PDF download | Low | Download all payslips for a month as ZIP |
| SA public holidays | Low | Integrate public holiday calendar into working days calculation |
| Leave carry-over | Low | Automatic carry-over of unused annual leave into next cycle year |
