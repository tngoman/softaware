# Admin Payroll Module — Overview

**Version:** 1.1.0  
**Last Updated:** 2026-03-16

---

## 1. Module Overview

### Purpose

The Payroll module provides comprehensive payroll management across two audiences: **administrators** who configure staff profiles, set salaries, manage banking details, and generate payslips; and **staff members** who can view their own payslips and request banking detail updates via a self-service Payroll tab on their profile.

### Business Value

- **Staff Payroll Profiles**: Capture employment date, ID number, tax number, and banking details per staff member
- **Employment Date Gating**: Payroll activities are blocked until an employment date is recorded — ensures proper onboarding
- **Banking Details Management**: Admin captures initial banking details; staff can request updates that require admin approval
- **Banking Approval Workflow**: Staff-submitted banking changes enter a `pending` state until explicitly approved or rejected by admin
- **Salary Management**: Set and update monthly salary amounts for all staff members
- **Payslip Generation**: Generate payslips for any month from the staff member's employment start month through the current month (current year)
- **Staff Self-Service**: Staff members access a Payroll tab on their profile to view and download their own payslips
- **Deduction Tracking**: Configure standard deductions (UIF, PAYE, medical aid, pension, custom)
- **Allowance Tracking**: Configure allowances (travel, housing, phone, custom)
- **PDF Export**: Download individual payslips as PDF documents
- **Audit Trail**: Full history of salary changes, banking updates, and payslip generation events
- **Bulk Operations**: Generate payslips for all staff in a single action

### Key Statistics

| Metric | Value |
|--------|-------|
| Frontend page files | 2 (admin Payroll.tsx, staff profile PayrollTab.tsx) |
| Backend route files | 2 (adminPayroll.ts, staffPayroll.ts) |
| API endpoints | 22 |
| MySQL tables | 5 (staff_payroll_profiles, staff_salaries, salary_deductions, payslips, banking_change_requests) |
| Protected routes — Admin | 17 (requireAuth + requireAdmin) |
| Protected routes — Staff | 5 (requireAuth + requireStaff) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                      │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Admin Pages (/admin/payroll)                                         │    │
│  │                                                                       │    │
│  │  Payroll.tsx                                                           │    │
│  │  ├── StaffPayrollProfiles   — View/edit staff profiles & banking      │    │
│  │  ├── BankingApprovals       — Review pending banking change requests  │    │
│  │  ├── StaffSalaryList        — View/edit staff salary configs          │    │
│  │  ├── SalaryEditor           — Set salary, deductions, allowances      │    │
│  │  ├── PayslipGenerator       — Select month → generate payslips        │    │
│  │  └── PayslipViewer          — View/download individual payslips       │    │
│  └──────────────────────────┬────────────────────────────────────────────┘    │
│                             │                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Staff Profile (/profile — Payroll Tab)                               │    │
│  │                                                                       │    │
│  │  PayrollTab.tsx                                                        │    │
│  │  ├── MyPayslips             — List & download own payslips            │    │
│  │  ├── MyBankingDetails       — View current banking (masked)           │    │
│  │  └── UpdateBankingRequest   — Submit new banking details (→ pending)  │    │
│  └──────────────────────────┬────────────────────────────────────────────┘    │
│                             │                                                 │
│                             ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  PayrollModel.ts — API client layer                                   │    │
│  │                                                                       │    │
│  │  ADMIN methods:                                                       │    │
│  │  • listStaffProfiles()          — GET all staff payroll profiles      │    │
│  │  • getStaffProfile(userId)      — GET single staff profile            │    │
│  │  • setStaffProfile(userId,data) — PUT create/update profile           │    │
│  │  • listBankingRequests()        — GET pending banking changes         │    │
│  │  • approveBanking(requestId)    — POST approve banking change         │    │
│  │  • rejectBanking(requestId)     — POST reject banking change          │    │
│  │  • listStaffSalaries()          — GET all staff with salary info      │    │
│  │  • setSalary(userId, data)      — PUT salary configuration            │    │
│  │  • generatePayslip(data)        — POST generate payslip for month     │    │
│  │  • generateBulkPayslips(data)   — POST generate for all staff         │    │
│  │  • listPayslips(filters)        — GET payslips with filters           │    │
│  │  • getPayslip(id)               — GET single payslip detail           │    │
│  │  • downloadPayslip(id)          — GET payslip PDF download            │    │
│  │                                                                       │    │
│  │  STAFF methods:                                                       │    │
│  │  • getMyProfile()               — GET own payroll profile             │    │
│  │  • getMyPayslips()              — GET own payslips                    │    │
│  │  • downloadMyPayslip(id)        — GET own payslip PDF                 │    │
│  │  • requestBankingUpdate(data)   — POST submit banking change request  │    │
│  │  • getMyBankingRequestStatus()  — GET pending request status          │    │
│  └──────────────────────────┬────────────────────────────────────────────┘    │
│                             │                                                 │
└─────────────────────────────┼─────────────────────────────────────────────────┘
                              │ HTTPS (Authorization: Bearer <token>)
                              ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express.js)                                  │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  adminPayroll.ts — Admin Route Handler                                │    │
│  │  Middleware: requireAuth → requireAdmin                               │    │
│  │                                                                       │    │
│  │  STAFF PROFILES                                                       │    │
│  │  GET    /api/admin/payroll/profiles            — List staff profiles  │    │
│  │  GET    /api/admin/payroll/profiles/:userId     — Get staff profile   │    │
│  │  PUT    /api/admin/payroll/profiles/:userId     — Set/update profile  │    │
│  │                                                                       │    │
│  │  BANKING APPROVALS                                                    │    │
│  │  GET    /api/admin/payroll/banking-requests     — List pending        │    │
│  │  POST   /api/admin/payroll/banking-requests/:id/approve — Approve     │    │
│  │  POST   /api/admin/payroll/banking-requests/:id/reject  — Reject      │    │
│  │                                                                       │    │
│  │  SALARIES                                                             │    │
│  │  GET    /api/admin/payroll/salaries             — List staff salaries │    │
│  │  GET    /api/admin/payroll/salaries/:userId      — Get staff salary   │    │
│  │  PUT    /api/admin/payroll/salaries/:userId      — Set/update salary  │    │
│  │  DELETE /api/admin/payroll/salaries/:userId      — Remove salary      │    │
│  │  GET    /api/admin/payroll/salaries/:userId/history — Salary history  │    │
│  │                                                                       │    │
│  │  PAYSLIPS                                                             │    │
│  │  POST   /api/admin/payroll/payslips/generate     — Generate payslip  │    │
│  │  POST   /api/admin/payroll/payslips/generate-bulk — Bulk generate    │    │
│  │  GET    /api/admin/payroll/payslips              — List payslips      │    │
│  │  GET    /api/admin/payroll/payslips/:id           — Get payslip       │    │
│  │  GET    /api/admin/payroll/payslips/:id/pdf       — Download PDF      │    │
│  │  DELETE /api/admin/payroll/payslips/:id           — Void payslip      │    │
│  │  GET    /api/admin/payroll/summary               — Monthly summary   │    │
│  └──────────────────────────┬────────────────────────────────────────────┘    │
│                             │                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  staffPayroll.ts — Staff Route Handler                                │    │
│  │  Middleware: requireAuth → requireStaff                               │    │
│  │                                                                       │    │
│  │  GET    /api/staff/payroll/profile              — My payroll profile  │    │
│  │  GET    /api/staff/payroll/payslips             — My payslips         │    │
│  │  GET    /api/staff/payroll/payslips/:id/pdf      — Download my payslip│    │
│  │  POST   /api/staff/payroll/banking-request      — Request banking chg │    │
│  │  GET    /api/staff/payroll/banking-request       — My pending request │    │
│  └──────────────────────────┬────────────────────────────────────────────┘    │
│                             │                                                 │
│                             ▼                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  MySQL Database                                                       │    │
│  │                                                                       │    │
│  │  staff_payroll_profiles  — Employment date, banking, ID/tax numbers   │    │
│  │  banking_change_requests — Pending banking updates from staff         │    │
│  │  staff_salaries          — Salary configuration per staff member      │    │
│  │  salary_deductions       — Deduction/allowance line items             │    │
│  │  payslips                — Generated monthly payslips                 │    │
│  │  users                   — Staff member reference (is_staff = 1)      │    │
│  └───────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Features

### 3.1 Staff Payroll Profile Management (Admin)

Before any payroll activity can take place for a staff member, an admin must create their **payroll profile**. This captures the employment date, personal identifiers, and banking details.

**Capabilities:**
- View all staff members with their payroll profile status (complete, incomplete, missing)
- Set employment date — **required** before salary or payslip operations
- Capture personal details: ID number, tax number
- Capture banking details: bank name, branch code, account number, account type, account holder name
- View and update any staff member's profile at any time
- Banking details are **only visible to admin users** — never exposed to other staff

**Employment Date Gating:**
```
┌──────────────────────────────────────────────────────────┐
│  Payroll Action Prerequisite Chain                        │
│                                                          │
│  1. Staff Payroll Profile    ← must exist                │
│     └─ employment_date       ← must be set              │
│                                                          │
│  2. Staff Salary              ← requires step 1          │
│     └─ effective_from ≥ employment_date                  │
│                                                          │
│  3. Payslip Generation        ← requires step 2          │
│     └─ pay_month/year ≥ employment month/year            │
│                                                          │
│  ✗ No profile → cannot set salary                        │
│  ✗ No employment_date → cannot set salary                │
│  ✗ No salary → cannot generate payslip                   │
│  ✗ Month before employment → cannot generate payslip     │
└──────────────────────────────────────────────────────────┘
```

**Business Rules:**
- Only users with `is_staff = 1` can have payroll profiles
- `employment_date` is mandatory before any salary can be set
- Payslips can only be generated for months on or after the employment date
- Banking details are encrypted at rest (AES-256-GCM via the credential vault pattern)
- Banking details visible only to admin — staff see a masked version of their own

### 3.2 Banking Details & Approval Workflow

Banking details follow a dual-authority model:

- **Admin** can set or update banking details directly at any time (immediate effect)
- **Staff** can submit a banking change request that enters a `pending` state
- **Admin** reviews the request and approves or rejects it
- On approval, the new banking details replace the current ones
- On rejection, admin provides a reason visible to the staff member

**Banking Change Request Flow:**
```
Staff UI                     Backend                        Database
   │                            │                              │
   │  POST /banking-request     │                              │
   │  {bank_name, branch_code,  │                              │
   │   account_number, ...}     │                              │
   │ ──────────────────────────►│                              │
   │                            │  Check no existing pending   │
   │                            │ ────────────────────────────►│
   │                            │  ◄── null ──────────────────│
   │                            │                              │
   │                            │  INSERT banking_change_req   │
   │                            │  status = 'pending'          │
   │                            │ ────────────────────────────►│
   │                            │                              │
   │  ◄── {success, pending} ───│                              │
   │                            │                              │

          ... time passes ...

Admin UI                     Backend                        Database
   │                            │                              │
   │  GET /banking-requests     │                              │
   │ ──────────────────────────►│                              │
   │  ◄── [pending requests] ───│                              │
   │                            │                              │
   │  POST /banking-requests    │                              │
   │    /:id/approve            │                              │
   │ ──────────────────────────►│                              │
   │                            │  BEGIN TRANSACTION           │
   │                            │  UPDATE profile banking      │
   │                            │  UPDATE request → approved   │
   │                            │  COMMIT                      │
   │                            │ ────────────────────────────►│
   │                            │                              │
   │  ◄── {success, approved} ──│                              │
   │                            │                              │
```

**Banking Change Request States:**

| State | Description |
|-------|-------------|
| `pending` | Submitted by staff, awaiting admin review |
| `approved` | Admin approved — banking details updated on profile |
| `rejected` | Admin rejected — reason provided to staff |

**Business Rules:**
- Only one pending request per staff member at a time
- Staff can view the status of their current/last request
- Staff cannot cancel a pending request (must ask admin)
- Approved requests auto-update the payroll profile banking fields
- Rejection requires a `reason` field from admin

### 3.3 Staff Salary Management

Administrators can set and manage monthly salary configurations for each staff member.

**Capabilities:**
- View all staff members with their current salary status
- Set gross monthly salary amount (stored in cents)
- Configure standard deductions: PAYE (tax), UIF, medical aid, pension fund
- Configure custom deductions with label and amount
- Configure allowances: travel, housing, phone, custom
- View salary change history with effective dates
- Remove a salary configuration (staff member will not appear in payslip generation)

**Salary Calculation:**
```
Net Salary = Gross Salary − Total Deductions + Total Allowances

Where:
  Total Deductions = PAYE + UIF + Medical Aid + Pension + Custom Deductions
  Total Allowances = Travel + Housing + Phone + Custom Allowances
```

**Business Rules:**
- Staff member must have a payroll profile with `employment_date` set before salary can be configured
- `effective_from` date must be on or after the staff member's `employment_date`
- Salary amounts are stored in cents (ZAR) to avoid floating point issues
- Salary changes are tracked with `effective_from` date
- Previous salary records are soft-archived (not deleted) for history

### 3.4 Payslip Generation

Generate payslips by selecting a staff member and a month from the current year.

**Capabilities:**
- Select any month from the staff member's employment start month through the current month
- Generate a payslip for a single staff member for a selected month
- Bulk-generate payslips for all active staff members for a selected month
- Prevents duplicate payslips for the same staff member and month
- Each payslip captures a snapshot of the salary at time of generation

**Month Selection Rules:**
- Available months: staff member's employment start month → current month (based on server date)
- Year: Current year only (e.g., 2026)
- Cannot generate payslips for future months
- Cannot generate payslips for months before the staff member's employment date
- Re-generation of existing payslips requires explicit confirmation (overwrites)

**Payslip Contents:**
- Staff member name and employee details
- Pay period (month/year)
- Gross salary amount
- Itemized deductions with amounts
- Itemized allowances with amounts
- Net pay (calculated)
- Company details (from sys_settings)
- Generation date and reference number

### 3.5 Staff Payroll Tab (Self-Service)

Staff members access a **Payroll** tab on their profile page to view their own payslip history and manage banking details.

**Staff Can:**
- View a list of their own generated payslips (month, year, net pay, status)
- Download their own payslips as PDF
- View their own banking details in a **masked** format (e.g., `****5678`)
- Submit a request to update their banking details (enters `pending` state)
- View the status of their most recent banking change request

**Staff Cannot:**
- See other staff members' payslips or salaries
- See unmasked banking details (only admin sees full details)
- Modify salary, deductions, or allowances
- Generate or void payslips
- Approve their own banking change request

### 3.6 Payslip PDF Export

Download individual payslips as professionally formatted PDF documents.

**PDF Contents:**
- Company letterhead (name, address from sys_settings)
- Employee details (name, email, employee ID)
- Pay period
- Earnings breakdown table
- Deductions breakdown table
- Allowances breakdown table
- Net pay summary
- Banking details for payment reference (masked on staff copy)
- Reference number and generation timestamp

### 3.7 Payroll Summary

View aggregated payroll data for a selected month.

**Summary Includes:**
- Total gross payroll for the month
- Total deductions breakdown
- Total allowances breakdown
- Total net payroll
- Staff count
- Per-staff breakdown

---

## 4. Security & Authorization

### Access Control

| Route Pattern | Required Role | Additional Check |
|--------------|--------------|------------------|
| `/api/admin/payroll/*` | Admin | `requireAuth` + `requireAdmin` |
| `/api/staff/payroll/*` | Staff | `requireAuth` + `requireStaff` |

### Two-Audience Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN (full access)                            │
│                                                                  │
│  ✓ View/edit all staff payroll profiles                          │
│  ✓ View full (unmasked) banking details for any staff            │
│  ✓ Set banking details directly (no approval needed)             │
│  ✓ Approve/reject staff banking change requests                  │
│  ✓ Set/update/remove salaries for any staff                      │
│  ✓ Generate/void payslips for any staff                          │
│  ✓ Download any payslip PDF                                      │
│  ✓ View payroll summary                                          │
├──────────────────────────────────────────────────────────────────┤
│                    STAFF (self-service only)                      │
│                                                                  │
│  ✓ View own payroll profile (banking masked)                     │
│  ✓ View own payslip list                                         │
│  ✓ Download own payslip PDF                                      │
│  ✓ Submit banking change request (→ pending)                     │
│  ✓ View own banking change request status                        │
│  ✗ Cannot view other staff data                                  │
│  ✗ Cannot modify salary/deductions/allowances                    │
│  ✗ Cannot generate or void payslips                              │
│  ✗ Cannot approve own banking changes                            │
└──────────────────────────────────────────────────────────────────┘
```

### Data Protection

- Salary and banking information is sensitive — full details accessible only to admin users
- Staff see their own banking details in masked format only
- Banking details encrypted at rest (AES-256-GCM)
- All salary and banking changes are logged with timestamp and admin user ID
- Payslip PDFs are generated on-demand (not stored as files)
- Financial amounts stored as integers (cents) to prevent rounding errors
- Staff payslip downloads are scoped to `WHERE user_id = req.user.id` — no IDOR possible

---

## 5. Data Flow Examples

### 5.1 Admin Creates Staff Payroll Profile

```
Admin UI                    Backend                         Database
   │                           │                               │
   │  PUT /profiles/:userId    │                               │
   │  {employment_date,        │                               │
   │   id_number, tax_number,  │                               │
   │   bank_name, branch_code, │                               │
   │   account_number, ...}    │                               │
   │ ─────────────────────────►│                               │
   │                           │  Validate user is_staff = 1   │
   │                           │ ─────────────────────────────►│
   │                           │  ◄────── user record ─────────│
   │                           │                               │
   │                           │  Encrypt banking details      │
   │                           │  UPSERT staff_payroll_profile │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │  ◄── {success: true} ─────│                               │
   │                           │                               │
```

### 5.2 Staff Submits Banking Change Request

```
Staff UI                    Backend                         Database
   │                           │                               │
   │  POST /banking-request    │                               │
   │  {bank_name, branch_code, │                               │
   │   account_number, ...}    │                               │
   │ ─────────────────────────►│                               │
   │                           │  Check no pending request     │
   │                           │ ─────────────────────────────►│
   │                           │  ◄── null ────────────────────│
   │                           │                               │
   │                           │  Encrypt new banking details  │
   │                           │  INSERT banking_change_req    │
   │                           │  status = 'pending'           │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │  ◄── {success, pending} ──│                               │
   │                           │                               │
```

### 5.3 Admin Approves Banking Change

```
Admin UI                    Backend                         Database
   │                           │                               │
   │  POST /banking-requests   │                               │
   │    /:id/approve           │                               │
   │ ─────────────────────────►│                               │
   │                           │  BEGIN TRANSACTION            │
   │                           │                               │
   │                           │  Fetch pending request        │
   │                           │ ─────────────────────────────►│
   │                           │  ◄── request data ────────────│
   │                           │                               │
   │                           │  UPDATE profile banking cols  │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │                           │  UPDATE request status →      │
   │                           │    'approved'                 │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │                           │  COMMIT                       │
   │  ◄── {success, approved} ─│                               │
   │                           │                               │
```

### 5.4 Setting a Staff Salary (with employment date check)

```
Admin UI                    Backend                         Database
   │                           │                               │
   │  PUT /salaries/:userId    │                               │
   │  {gross_salary: 3500000,  │                               │
   │   deductions: [...],      │                               │
   │   allowances: [...]}      │                               │
   │ ─────────────────────────►│                               │
   │                           │  Validate user is_staff = 1   │
   │                           │ ─────────────────────────────►│
   │                           │  ◄────── user record ─────────│
   │                           │                               │
   │                           │  Check payroll profile exists │
   │                           │  Check employment_date set    │
   │                           │ ─────────────────────────────►│
   │                           │  ◄── profile with emp. date ──│
   │                           │                               │
   │                           │  UPSERT staff_salaries        │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │                           │  DELETE old deductions         │
   │                           │  INSERT new deductions         │
   │                           │ ─────────────────────────────►│
   │                           │                               │
   │  ◄── {success: true} ─────│                               │
   │                           │                               │
```

### 5.5 Staff Views Own Payslips

```
Staff UI                    Backend                         Database
   │                           │                               │
   │  GET /staff/payroll/      │                               │
   │       payslips            │                               │
   │ ─────────────────────────►│                               │
   │                           │  Scope: WHERE user_id =       │
   │                           │    req.user.id                │
   │                           │ ─────────────────────────────►│
   │                           │  ◄── payslip list ────────────│
   │                           │                               │
   │  ◄── {success, payslips} ─│                               │
   │                           │                               │
```

---

## 6. Configuration

### System Settings (sys_settings)

The payroll module reads the following system settings for payslip generation:

| Key | Purpose | Default |
|-----|---------|---------|
| `company_name` | Company name on payslip header | — |
| `company_address` | Company address on payslip | — |
| `company_reg_number` | Registration number on payslip | — |
| `company_tax_number` | Tax number on payslip | — |

---

## 7. Testing & Development

### Manual Testing Checklist

**Staff Payroll Profile:**
- [ ] Create payroll profile for a staff member with employment date and banking
- [ ] Update payroll profile
- [ ] Attempt to set salary without payroll profile (should fail)
- [ ] Attempt to set salary without employment date (should fail)

**Banking Approval Workflow:**
- [ ] Staff submits banking change request
- [ ] Staff attempts second request while one is pending (should fail)
- [ ] Staff views pending request status
- [ ] Admin views list of pending banking requests
- [ ] Admin approves banking request → profile updated
- [ ] Admin rejects banking request with reason → staff sees reason
- [ ] Verify old banking details preserved after rejection

**Salary Management:**
- [ ] Set salary for a staff member (with valid profile)
- [ ] Update existing salary
- [ ] Attempt salary with effective_from before employment_date (should fail)
- [ ] View salary history
- [ ] Remove salary configuration

**Payslip Generation:**
- [ ] Generate payslip for current month
- [ ] Generate payslip for past month (employment month → current)
- [ ] Attempt to generate payslip for month before employment (should fail)
- [ ] Attempt to generate payslip for future month (should fail)
- [ ] Attempt to generate duplicate payslip (should warn)
- [ ] Bulk generate payslips for all staff

**Staff Self-Service:**
- [ ] Staff views own payslip list
- [ ] Staff downloads own payslip PDF
- [ ] Staff views own banking details (masked)
- [ ] Staff attempts to access another staff member's payslip (should fail)
- [ ] Staff views own payroll profile

**Admin Payslip Management:**
- [ ] View generated payslip
- [ ] Download payslip PDF
- [ ] Void a payslip
- [ ] View monthly payroll summary

### Sample cURL Commands

```bash
# ── ADMIN: Staff Profile Management ──

# Create/update staff payroll profile
curl -X PUT https://api.softaware.net.za/api/admin/payroll/profiles/user-uuid \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employment_date": "2025-06-15",
    "id_number": "9001015800085",
    "tax_number": "0123456789",
    "bank_name": "FNB",
    "branch_code": "250655",
    "account_number": "62012345678",
    "account_type": "cheque",
    "account_holder_name": "John Smith"
  }'

# ── ADMIN: Banking Approvals ──

# List pending banking change requests
curl https://api.softaware.net.za/api/admin/payroll/banking-requests \
  -H "Authorization: Bearer <admin-token>"

# Approve a banking change request
curl -X POST https://api.softaware.net.za/api/admin/payroll/banking-requests/request-uuid/approve \
  -H "Authorization: Bearer <admin-token>"

# Reject a banking change request
curl -X POST https://api.softaware.net.za/api/admin/payroll/banking-requests/request-uuid/reject \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Branch code does not match bank name"}'

# ── STAFF: Self-Service ──

# View own payslips
curl https://api.softaware.net.za/api/staff/payroll/payslips \
  -H "Authorization: Bearer <staff-token>"

# Download own payslip
curl https://api.softaware.net.za/api/staff/payroll/payslips/payslip-uuid/pdf \
  -H "Authorization: Bearer <staff-token>" \
  -o my_payslip.pdf

# Submit banking change request
curl -X POST https://api.softaware.net.za/api/staff/payroll/banking-request \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bank_name": "Capitec",
    "branch_code": "470010",
    "account_number": "1234567890",
    "account_type": "savings",
    "account_holder_name": "John Smith"
  }'

# Check banking request status
curl https://api.softaware.net.za/api/staff/payroll/banking-request \
  -H "Authorization: Bearer <staff-token>"
```

---

## 8. Related Documentation

- [Admin Module — Overview](../README.md) — Parent admin module
- [Admin Module — Fields](../FIELDS.md) — Database schemas
- [Admin Module — Routes](../ROUTES.md) — API endpoints
- [Users Module](../../Users/README.md) — Staff user management
- [Accounting Module](../../Accounting/README.md) — Financial system

---

**Document Status**: ✅ Complete  
**Review Cycle**: Quarterly  
**Next Review**: 2026-06-16
