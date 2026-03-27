# Payroll Module

**Version:** 1.1.0  
**Last Updated:** 2026-03-18  
**Status:** ✅ Active — Internal staff payroll management with leave integration

---

## 1. Purpose

The Payroll module provides internal payroll management for staff and admin users. It serves two distinct audiences:

- **Admins** use the Payroll admin page to manage payroll profiles, salary configurations, banking approvals, and payslip generation (single + bulk)
- **Staff** use the Payroll tab on their Profile page to view their masked payroll info, download payslips, and submit banking change requests

All monetary values are stored and transmitted as **cents** (integer) to avoid floating-point rounding issues. Bank account numbers are **AES-256-GCM encrypted** at rest.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                             │
│                                                                     │
│  ┌─────────────────────┐       ┌──────────────────────────────────┐ │
│  │  admin/Payroll.tsx   │       │  Profile/PayrollTab.tsx          │ │
│  │  (Admin payroll      │       │  (Staff self-service:            │ │
│  │   profiles, salaries,│       │   view profile, payslips,        │ │
│  │   payslips, banking) │       │   banking change requests)       │ │
│  └──────────┬───────────┘       └────────────┬────────────────────┘ │
│             │                                 │                     │
│             │                  ┌──────────────────────────────────┐ │
│             │                  │  Profile/LeaveTab.tsx            │ │
│             │                  │  (Staff leave management:        │ │
│             │                  │   balances, requests, submit)    │ │
│             │                  └────────────┬────────────────────┘ │
│             │                                │                     │
│  ┌──────────┴────────────────────────────────┴────────────────────┐│
│  │          PayrollModel.ts  ·  LeaveModel.ts                     ││
│  │  Admin: listProfiles, saveProfile, saveSalary, generatePayslip ││
│  │  Staff: getMyProfile, getMyPayslips, submitMyBankingRequest    ││
│  │  Leave: getMyBalances, getMyRequests, submitMyRequest          ││
│  └──────────────────────────┬──────────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────────┘
                              │ Axios (Bearer JWT)
┌─────────────────────────────┼───────────────────────────────────────┐
│                    Backend (Express)                                 │
│                              │                                      │
│  ┌───────────────────────────┴───────────────────────────────────┐  │
│  │                requireAuth middleware                          │  │
│  └──────┬──────────────────┬─────────────────────┬───────────────┘  │
│         │                  │                     │                  │
│  ┌──────┴────────────┐ ┌───┴──────────────┐ ┌────┴──────────────┐  │
│  │ adminPayroll.ts   │ │ staffPayroll.ts  │ │ staffLeave.ts     │  │
│  │ requireAdmin      │ │ requireStaff     │ │ requireStaff      │  │
│  │ 18 endpoints      │ │ 5 endpoints      │ │ 3 endpoints       │  │
│  └──────┬────────────┘ └───┬──────────────┘ └────┬──────────────┘  │
│         │                  │                     │                  │
│  ┌──────┴──────────────────┴─────────────────────┴──────────────┐  │
│  │         payrollService.ts  ·  leaveService.ts                 │  │
│  │  Payroll: profiles, salaries, payslips, banking               │  │
│  │  Leave: balances, requests, approve/reject, entitlements      │  │
│  └──────┬────────────────────────────────────────────────────────┘  │
│         │                                                           │
│  ┌──────┴──────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │ cryptoUtils.ts  │   │ payslipPdf.ts    │   │ mysql.ts (db)  │  │
│  │ AES-256-GCM     │   │ Puppeteer HTML   │   │ query/execute  │  │
│  │ encrypt/decrypt │   │ → PDF buffer     │   │ transactions   │  │
│  └─────────────────┘   │ + leave balance  │   └────────────────┘  │
│                         └──────────────────┘                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │   MySQL: staff_payroll_profiles, banking_change_requests,       ││
│  │          staff_salaries, salary_deductions, payslips,           ││
│  │          leave_balances, leave_requests                         ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Concepts

### 3.1 Admin vs Staff Access

| Aspect | Admin (adminPayroll.ts) | Staff (staffPayroll.ts + staffLeave.ts) |
|--------|------------------------|----------------------------------------|
| Route prefix | `/admin/payroll`, `/admin/leave` | `/staff/payroll`, `/staff/leave` |
| Middleware | `requireAuth, requireAdmin` | `requireAuth, requireStaff` |
| View all staff | ✅ Yes | ❌ Only self |
| Edit profiles | ✅ Yes | ❌ No (submit banking request) |
| Configure salaries | ✅ Yes | ❌ No |
| Generate payslips | ✅ Yes (single + bulk) | ❌ No |
| Download payslips | ✅ Any user's | ✅ Own only (with download notification) |
| Approve banking | ✅ Yes | ❌ No |
| View account numbers | ✅ Unmasked | ❌ Masked only |
| Manage leave balances | ✅ Yes (view all, update entitlements) | ❌ View own only |
| Approve/reject leave | ✅ Yes | ❌ No |
| Submit leave requests | ✅ Yes (on behalf of staff) | ✅ Yes (own requests) |
| View leave requests | ✅ All staff | ✅ Own only |

### 3.2 User Eligibility

The payroll module includes any user with `is_staff = 1` OR `is_admin = 1`. This is checked in:
- `listPayrollProfiles()` — `WHERE (u.is_staff = 1 OR u.is_admin = 1)`
- `getStaffUser()` — same condition for single-user lookups
- `generateBulkPayslips()` — same condition when iterating all eligible users

### 3.3 Monetary Values (Cents Pattern)

All monetary fields use **integer cents** (BIGINT in MySQL, `number` in TypeScript):
- `gross_salary_cents` — Monthly gross salary in cents (e.g., 2500000 = R 25,000.00)
- `amount_cents` on deductions/allowances
- `net_salary_cents` = gross − total_deductions + total_allowances

Frontend helper: `currency(cents) → "R 25,000.00"`

### 3.4 Bank Account Encryption

Bank account numbers are encrypted using AES-256-GCM via `cryptoUtils.ts`:
- **On write**: `encryptPassword(plaintext)` → stored as `iv:authTag:ciphertext`
- **On read (admin)**: `decryptPassword(encrypted)` → returns plaintext
- **On read (staff)**: `maskAccountNumber(decrypted)` → `****1234`
- Stored in `TEXT` columns (encrypted value is longer than original)

### 3.5 Payslip Generation Flow

```
Admin clicks "Generate" for a user + month
       │
       ▼
validateEmploymentDate() — must have employment_date set
ensureCurrentYearAndNotFuture() — current year only, not future month
ensurePeriodAfterDate() — month must be ≥ employment_date AND ≥ salary effective_from
       │
       ▼
buildPayslipPayload() — reads salary + deductions + allowances
       │
       ▼
Snapshot deductions/allowances as JSON arrays in payslip row
       │
       ▼
Generate reference: PS-YYYY-MM-XXXXXX (6-char random hex)
       │
       ▼
INSERT INTO payslips (unique constraint on user_id + pay_month + pay_year)
```

### 3.6 Banking Change Request Workflow

```
Staff submits banking change request
       │
       ▼
Validate: profile exists, no pending request already (409 if duplicate)
       │
       ▼
INSERT banking_change_requests (status = 'pending')
       │
       ▼
Admin reviews in Banking Requests tab
       │
    ┌──┴──┐
    │     │
 Approve  Reject
    │     │
    ▼     ▼
Update   Set status = 'rejected'
profile  with reason
banking
fields
```

### 3.7 Profile Completeness

A profile is marked `profile_complete: true` when ALL of these are set:
- `employment_date`
- `bank_name`
- `branch_code`
- `account_number` (encrypted, decrypted for check)
- `account_type`
- `account_holder_name`

### 3.8 Payslip Leave Days Integration

Payslip PDFs now display the employee's remaining annual leave days. When a payslip PDF is generated (both admin and staff download), the route handler queries:

```sql
SELECT remaining_days FROM leave_balances
WHERE user_id = ? AND leave_type = 'annual' AND cycle_year = ?
```

The `leave_days_remaining` value is passed to the PDF generator and displayed in the employee info section.

### 3.9 Download Notification UX

When staff or admin clicks to download a payslip PDF, a SweetAlert2 notification immediately appears:
- Title: "Downloading..."
- Text: "Your payslip download will begin shortly"
- Auto-hides after 2 seconds with a progress bar
- No confirm button (non-blocking)

This prevents users from repeatedly clicking while the PDF is being fetched from the server.

### 3.10 Silent Error Handling Pattern

The PayrollTab and LeaveTab use silent error handling on initial data load. Instead of showing disruptive SweetAlert popups when endpoints return errors (e.g., 404 for users without profiles), the components:
- Log the error to `console.error`
- Let the user see the built-in empty state messages in the UI
- Only show SweetAlert errors for explicit user actions (submit, download)

---

## 4. User Guide

### 4.1 Admin — Payroll Page

1. Navigate to **Billing & Finance → Payroll** in the admin sidebar
2. **Staff Sidebar** — Lists all staff/admin users with initials, role badges (Admin/Staff), and status (Ready/Incomplete/Banking)
3. Click a staff member to select them — the main content area loads their data

**Profiles Tab:**
- Set employment date (required), ID number, tax number
- Set banking details: bank name, branch code, account number, account type, account holder name
- Save profile

**Salaries Tab:**
- Set gross salary (in cents), effective from date, notes
- Add/remove deduction and allowance line items (type, label, amount)
- Net salary calculated automatically
- Save or remove salary configuration

**Payslips Tab:**
- Summary cards: staff paid, gross, deductions, net for the selected month
- Select month (current year only)
- Generate single payslip for the selected user
- Generate bulk payslips for all eligible staff
- View payslip list with PDF download
- Void payslips

**Banking Requests Tab:**
- View pending banking change requests from staff
- Compare current vs requested banking details
- Approve (updates profile automatically) or reject (with reason)

### 4.2 Staff — Profile Payroll Tab

1. Navigate to **Profile** → click **Payroll** tab (visible only for staff users)
2. **View** masked profile info (employment date, ID number masked, bank details masked)
3. **Payslips** — List of payslips with PDF download (download notification auto-hides after 2s)
4. **Banking Change Request** — Submit new banking details for admin approval, view status of latest request
5. **Banking Status** — Shows contextual status: pending request status, "No pending requests" (if banking configured), or "Not configured"

### 4.3 Staff — Profile Leave Tab

1. Navigate to **Profile** → click **Leave** tab (visible only for staff users)
2. **Leave Balances** — Grid showing all 5 leave types with entitled, used, pending, and remaining days (colour-coded)
3. **Submit Request** — Form to request leave: select type, start/end dates, optional reason
4. **Request History** — List of all leave requests with status badges (pending/approved/rejected), rejection reasons, and reviewer details

---

## 5. Features

| Feature | Status | Description |
|---------|--------|-------------|
| Payroll profiles | ✅ Active | Employment and banking details per staff member |
| Salary configuration | ✅ Active | Gross salary with deduction/allowance line items |
| Single payslip generation | ✅ Active | Generate payslip for one user + month |
| Bulk payslip generation | ✅ Active | Generate payslips for all eligible staff |
| PDF payslip download | ✅ Active | Puppeteer-rendered A4 payslip with company branding |
| Payslip leave days | ✅ Active | PDF shows remaining annual leave balance from `leave_balances` table |
| Payslip download notification | ✅ Active | SweetAlert2 "Downloading..." toast, auto-hides after 2s with progress bar |
| Payslip voiding | ✅ Active | Mark payslip as voided (preserves record) |
| Banking change requests | ✅ Active | Staff submit, admin approve/reject workflow |
| Banking status display | ✅ Active | Contextual status: pending/approved/rejected, "No pending requests", or "Not configured" |
| Account encryption | ✅ Active | AES-256-GCM encryption for bank account numbers |
| Account masking | ✅ Active | Staff see `****1234` for account numbers |
| Staff sidebar | ✅ Active | Initials, role badges, search, status indicators |
| Payroll summary | ✅ Active | Monthly aggregates (gross, deductions, net) |
| Salary history | ✅ Active | View salary change history (via payslip snapshots) |
| Leave balances (staff) | ✅ Active | Staff view own leave balances by year (5 SA leave types) |
| Leave requests (staff) | ✅ Active | Staff submit/view own leave requests with status tracking |
| Leave admin | ✅ Active | Admin view all balances, approve/reject requests, update entitlements |
| Silent error handling | ✅ Active | No disruptive popups on page load; empty states shown instead |
| Multi-year payslips | ❌ Missing | Limited to current year only |
| Payslip email delivery | ❌ Missing | No email sending of payslips |
| Tax certificate (IRP5) | ❌ Missing | No annual tax certificate generation |
| Payroll permissions | ❌ Missing | No granular permissions (e.g., `payroll.view`, `payroll.manage`) |
| Audit trail | 🟡 Partial | Admin routes have auditLogger middleware, but no payroll-specific audit |

---

## 6. Security Considerations

- **Authentication:** All endpoints require JWT via `requireAuth`
- **Admin authorization:** Admin endpoints use `requireAdmin` middleware
- **Staff authorization:** Staff endpoints use `requireStaff` middleware (checks `is_staff` column)
- **Data isolation:** Staff can only view their own profile/payslips (enforced by `req.userId`)
- **Encryption:** Bank account numbers encrypted with AES-256-GCM at rest
- **Masking:** Staff see masked account numbers (`****1234`); ID numbers partially masked
- **Payslip ownership:** `getPayslipById` accepts optional `userId` param for staff — enforces ownership
- **Banking conflict:** Only one pending banking request per user (409 on duplicate)
- **Zod validation:** All mutation endpoints validated with Zod schemas
- **SQL injection:** Parameterized queries throughout
- **PDF XSS:** HTML content escaped via `escapeHtml()` before Puppeteer rendering
- **Audit logging:** Admin payroll routes pass through `auditLogger` middleware

---

## 7. Configuration

No module-specific configuration. Uses global settings:

| Variable | Used For |
|----------|----------|
| `JWT_SECRET` | Token verification via requireAuth |
| `DATABASE_URL` | MySQL connection |
| `ENCRYPTION_KEY` | AES-256-GCM key for account numbers (via cryptoUtils) |

Company branding on payslip PDFs comes from `app_settings` table via `loadCompanySettings()`:
- `site_name`, `site_address`, `site_email`, `site_contact_no`, `site_vat_no`

---

## 8. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "Staff member not found" | User doesn't have `is_staff = 1` or `is_admin = 1` | Set the appropriate flag in the users table |
| "Payroll profile not found" | No profile row exists for this user | Admin must create a profile first via the Profiles tab |
| "Can only generate payslips for the current year" | Year ≠ current year | Change the year selector to the current year |
| "Cannot generate payslip for a future month" | Selected month > current month | Select current or past month |
| "Cannot generate payslip before employment date" | Payslip month < employment_date | Check employment date is correct |
| "Cannot generate payslip before salary effective date" | Payslip month < salary.effective_from | Adjust salary effective date |
| "All banking fields must be provided together" | Partial banking info submitted | Fill all 5 banking fields or leave all empty |
| "You already have a pending banking change request" (409) | Duplicate pending request | Wait for admin to approve/reject the existing request |
| Sidebar shows all users with null IDs | SQL column shadowing from `p.*` overwriting `u.id AS user_id` | Fixed: explicit column selection with aliases |
| Payslip PDF blank or error | Puppeteer not installed or sandbox issue | Check `puppeteer` is installed, `--no-sandbox` flag is set |
| Account number shows encrypted text | Decryption key mismatch or corrupt data | Verify `ENCRYPTION_KEY` env var matches the key used to encrypt |

---

## 9. Related Modules

- [Users](../Users/README.md) — User accounts, `is_staff`/`is_admin` flags
- [Authentication](../Authentication/README.md) — JWT token issuance, requireAuth middleware
- [Roles](../Roles/README.md) — Role-based access control (requireAdmin check)
- [Settings](../Settings/README.md) — Company settings used in payslip PDF branding
- [AuditLog](../AuditLog/README.md) — Admin action logging via auditLogger middleware
- **Leave Management** — Leave balances and requests (`leave_balances`, `leave_requests` tables). Payslip PDFs query remaining annual leave from `leave_balances`. Staff manage leave via Profile → Leave tab.
