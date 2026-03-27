# Payroll Module — Database Schema & Field Mappings

**Migration:** `032_payroll_system.ts`, `033_leave_system.ts`  
**Tables:** 7  
**Engine:** InnoDB (all tables)

---

## 1. Database Tables

### 1.1 `staff_payroll_profiles`

Employment and banking details per staff member. One row per user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `user_id` | INT | NO | — | FK → `users.id` (UNIQUE) |
| `employment_date` | DATE | YES | NULL | Date of employment |
| `id_number` | VARCHAR(20) | YES | NULL | SA ID number |
| `tax_number` | VARCHAR(20) | YES | NULL | SARS tax reference number |
| `bank_name` | VARCHAR(100) | YES | NULL | Bank name |
| `branch_code` | VARCHAR(20) | YES | NULL | Bank branch/universal code |
| `account_number` | TEXT | YES | NULL | **AES-256-GCM encrypted** bank account number |
| `account_type` | VARCHAR(50) | YES | NULL | Account type (cheque, savings, etc.) |
| `account_holder_name` | VARCHAR(200) | YES | NULL | Name on the bank account |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE KEY (user_id)`
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

**Notes:**
- `account_number` is stored as encrypted text in format `iv:authTag:ciphertext`
- Actual account number is typically 8-13 digits but encrypted value is much longer
- All banking fields are validated as all-or-nothing (all provided or all null)

---

### 1.2 `banking_change_requests`

Tracks banking detail change requests submitted by staff, reviewed by admin.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `user_id` | INT | NO | — | FK → `users.id` |
| `bank_name` | VARCHAR(100) | NO | — | Requested bank name |
| `branch_code` | VARCHAR(20) | NO | — | Requested branch code |
| `account_number` | TEXT | NO | — | Requested account number (plain text in request) |
| `account_type` | VARCHAR(50) | NO | — | Requested account type |
| `account_holder_name` | VARCHAR(200) | NO | — | Requested account holder name |
| `status` | ENUM | NO | 'pending' | `'pending'`, `'approved'`, `'rejected'` |
| `reviewed_by` | INT | YES | NULL | FK → `users.id` (admin who reviewed) |
| `reviewed_at` | TIMESTAMP | YES | NULL | When the request was reviewed |
| `rejection_reason` | TEXT | YES | NULL | Reason for rejection (if rejected) |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Request submission time |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
- `FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL`

**Workflow:**
1. Staff submits → status = `pending`
2. Admin approves → status = `approved`, banking fields copied to profile (encrypted)
3. Admin rejects → status = `rejected`, `rejection_reason` set

**Business rules:**
- Only one `pending` request per user (enforced at service level, returns 409)
- Account number in requests stored as plain text (encrypted when copied to profile on approval)

---

### 1.3 `staff_salaries`

Monthly salary configuration per user. Currently supports one active salary per user.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `user_id` | INT | NO | — | FK → `users.id` (UNIQUE) |
| `gross_salary_cents` | BIGINT | NO | — | Monthly gross salary in cents |
| `effective_from` | DATE | NO | — | Date salary takes effect |
| `notes` | TEXT | YES | NULL | Admin notes |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE KEY (user_id)` — one salary config per user
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

**Notes:**
- Amounts in **cents** (BIGINT) to avoid floating-point issues
- Example: R 25,000.00 → stored as `2500000`
- Salary history is preserved through payslip snapshots, not versioned rows

---

### 1.4 `salary_deductions`

Line items (deductions and allowances) attached to a salary configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `salary_id` | INT | NO | — | FK → `staff_salaries.id` |
| `type` | ENUM | NO | — | `'deduction'` or `'allowance'` |
| `label` | VARCHAR(100) | NO | — | Human-readable label (e.g., "PAYE Tax") |
| `amount_cents` | BIGINT | NO | — | Amount in cents |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (salary_id) REFERENCES staff_salaries(id) ON DELETE CASCADE`

**Common deduction types:**
| Label | Typical Value | Description |
|-------|---------------|-------------|
| PAYE Tax | Varies | Pay As You Earn income tax |
| UIF | 1% of gross (max R177.12) | Unemployment Insurance Fund |
| Medical Aid | Varies | Medical scheme contribution |
| Pension/Provident | Varies | Retirement fund contribution |

**Common allowance types:**
| Label | Typical Value | Description |
|-------|---------------|-------------|
| Transport | Varies | Transport allowance |
| Cell Phone | Varies | Mobile phone allowance |
| Housing | Varies | Housing subsidy |

---

### 1.5 `payslips`

Generated payslip records with JSON snapshots of salary data at time of generation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INT | NO | AUTO_INCREMENT | Primary key |
| `user_id` | INT | NO | — | FK → `users.id` |
| `pay_month` | TINYINT | NO | — | Pay period month (1-12) |
| `pay_year` | SMALLINT | NO | — | Pay period year |
| `gross_salary_cents` | BIGINT | NO | — | Gross salary at time of generation |
| `total_deductions_cents` | BIGINT | NO | 0 | Sum of deductions |
| `total_allowances_cents` | BIGINT | NO | 0 | Sum of allowances |
| `net_salary_cents` | BIGINT | NO | — | Net salary (gross − deductions + allowances) |
| `deductions_json` | JSON | YES | NULL | JSON snapshot of deduction line items |
| `allowances_json` | JSON | YES | NULL | JSON snapshot of allowance line items |
| `reference` | VARCHAR(30) | NO | — | Unique reference (format: `PS-YYYY-MM-XXXXXX`) |
| `status` | ENUM | NO | 'active' | `'active'` or `'voided'` |
| `generated_by` | INT | YES | NULL | FK → `users.id` (admin who generated) |
| `voided_by` | INT | YES | NULL | FK → `users.id` (admin who voided) |
| `voided_at` | TIMESTAMP | YES | NULL | When the payslip was voided |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Generation time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE KEY (user_id, pay_month, pay_year)` — one payslip per user per period
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
- `FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL`
- `FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL`

**JSON snapshot format:**
```json
// deductions_json
[
  { "label": "PAYE Tax", "amount_cents": 200000 },
  { "label": "UIF", "amount_cents": 50000 }
]

// allowances_json
[
  { "label": "Transport", "amount_cents": 100000 }
]
```

**Reference format:** `PS-YYYY-MM-XXXXXX`
- `PS` — prefix
- `YYYY` — pay year
- `MM` — pay month (zero-padded)
- `XXXXXX` — 6-character random hex string

**Notes:**
- Payslips snapshot the salary data at generation time via JSON columns
- This means salary changes after generation don't affect existing payslips
- Voiding sets `status = 'voided'`, preserves the record for audit
- The unique constraint prevents duplicate payslips for the same period

---

### 1.6 `leave_balances`

Per-user, per-type, per-year leave entitlement tracking. Auto-created with SA defaults on first access.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | CHAR(36) | NO | — | UUID primary key |
| `user_id` | INT | NO | — | FK → `users.id` |
| `leave_type` | ENUM | NO | — | `'annual'`, `'sick'`, `'family_responsibility'`, `'maternity'`, `'parental'` |
| `cycle_year` | SMALLINT | NO | — | Leave cycle year (e.g., 2025) |
| `entitled_days` | DECIMAL(5,1) | NO | — | Total entitled days for the year |
| `used_days` | DECIMAL(5,1) | NO | 0 | Days already taken |
| `pending_days` | DECIMAL(5,1) | NO | 0 | Days in pending requests |
| `remaining_days` | DECIMAL(5,1) | — | GENERATED | `entitled_days - used_days - pending_days` (virtual/stored) |
| `notes` | TEXT | YES | NULL | Admin notes |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP ON UPDATE | Last modification time |

**Constraints:**
- `PRIMARY KEY (id)`
- `UNIQUE KEY (user_id, leave_type, cycle_year)` — one balance per type per year
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`

**SA Default Entitlements (BCEA):**
| Leave Type | Days | Statutory Basis |
|------------|------|----------------|
| Annual | 15 | 15 consecutive days per year |
| Sick | 30 | 30 days in 3-year cycle |
| Family Responsibility | 3 | 3 days per year |
| Maternity | 80 | 4 consecutive months |
| Parental | 10 | 10 consecutive days |

**Notes:**
- UUID primary keys (CHAR(36)) generated by `generateId()` in leaveService.ts
- `remaining_days` is a generated column: `entitled_days - used_days - pending_days`
- Balances auto-created by `ensureBalances()` on first access per user per year
- Used in payslip PDF: `getAnnualLeaveRemaining()` queries `remaining_days` where `leave_type = 'annual'`

---

### 1.7 `leave_requests`

Individual leave request records with approval workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | CHAR(36) | NO | — | UUID primary key |
| `user_id` | INT | NO | — | FK → `users.id` |
| `leave_type` | ENUM | NO | — | `'annual'`, `'sick'`, `'family_responsibility'`, `'maternity'`, `'parental'` |
| `start_date` | DATE | NO | — | First day of leave |
| `end_date` | DATE | NO | — | Last day of leave |
| `days` | DECIMAL(5,1) | NO | — | Working days count (Mon-Fri only) |
| `reason` | TEXT | YES | NULL | Optional reason text |
| `status` | ENUM | NO | 'pending' | `'pending'`, `'approved'`, `'rejected'`, `'cancelled'` |
| `approved_by` | INT | YES | NULL | FK → `users.id` (admin who reviewed) |
| `approved_at` | TIMESTAMP | YES | NULL | When the request was reviewed |
| `rejection_reason` | TEXT | YES | NULL | Reason for rejection (if rejected) |
| `created_at` | TIMESTAMP | NO | CURRENT_TIMESTAMP | Request submission time |

**Constraints:**
- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
- `FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL`

**Workflow:**
1. Staff/Admin submits → status = `pending`, `pending_days` incremented on balance
2. Admin approves → status = `approved`, move `pending_days` → `used_days`
3. Admin rejects → status = `rejected`, release `pending_days`, set `rejection_reason`
4. User cancels → status = `cancelled`, release `pending_days` (or `used_days` if was approved)

**Business rules:**
- `days` is calculated server-side via `countWorkingDays()` (Mon-Fri only, no public holidays)
- Approval checks: request must be `pending`, balance must have sufficient entitlement
- Cancellation allowed by request owner or admin
- DB column is `approved_by`/`approved_at` (not `reviewed_by`/`reviewed_at`)

---

## 2. Entity Relationship Diagram

```
┌──────────────────┐
│      users       │
│     (id PK)      │
└──┬───┬───┬───┬───┘
   │   │   │   │
   │   │   │   │ 1:N (user_id)
   │   │   │   ▼
   │   │   │  ┌─────────────────────────────┐
   │   │   │  │   banking_change_requests   │
   │   │   │  │   (id PK, user_id FK)       │
   │   │   │  │   reviewed_by FK → users    │
   │   │   │  └─────────────────────────────┘
   │   │   │
   │   │   │ 1:1 (user_id UNIQUE)
   │   │   ▼
   │   │  ┌──────────────────────────┐
   │   │  │ staff_payroll_profiles   │
   │   │  │ (id PK, user_id FK)     │
   │   │  └──────────────────────────┘
   │   │
   │   │ 1:1 (user_id UNIQUE)
   │   ▼
   │  ┌──────────────────────────┐
   │  │    staff_salaries         │
   │  │ (id PK, user_id FK)      │
   │  └──────┬───────────────────┘
   │         │ 1:N (salary_id FK)
   │         ▼
   │  ┌─────────────────────────┐
   │  │   salary_deductions      │
   │  │ (id PK, salary_id FK)   │
   │  └─────────────────────────┘
   │
   │ 1:N (user_id)
   ├──────────────────────────────┐
   │                              │
   ▼                              ▼
┌─────────────────────┐   ┌─────────────────────────────┐
│       payslips       │   │      leave_balances          │
│ (id PK, user_id FK) │   │ (id UUID, user_id FK)       │
│ generated_by → users│   │ UNIQUE(user,type,year)      │
│ voided_by → users   │   └─────────────────────────────┘
│ UNIQUE(user,mon,yr) │
└─────────────────────┘   ┌─────────────────────────────┐
                          │      leave_requests          │
                          │ (id UUID, user_id FK)       │
                          │ approved_by FK → users      │
                          └─────────────────────────────┘
```

---

## 3. Frontend ↔ Backend Field Mappings

### 3.1 Profile Fields

| Frontend (PayrollProfile) | Backend (DB column) | Transform |
|--------------------------|--------------------|-----------| 
| `id` | `staff_payroll_profiles.id` | Direct |
| `user_id` | `staff_payroll_profiles.user_id` | Direct |
| `employment_date` | `staff_payroll_profiles.employment_date` | Date string `YYYY-MM-DD` |
| `id_number` | `staff_payroll_profiles.id_number` | Admin: direct · Staff: masked |
| `tax_number` | `staff_payroll_profiles.tax_number` | Admin: direct · Staff: masked |
| `bank_name` | `staff_payroll_profiles.bank_name` | Direct |
| `branch_code` | `staff_payroll_profiles.branch_code` | Direct |
| `account_number` | `staff_payroll_profiles.account_number` | Admin: decrypted · Staff: masked `****XXXX` |
| `account_type` | `staff_payroll_profiles.account_type` | Direct |
| `account_holder_name` | `staff_payroll_profiles.account_holder_name` | Direct |

### 3.2 Profile List Item Fields

| Frontend (PayrollProfileListItem) | Backend (query alias) | Source |
|----------------------------------|----------------------|--------|
| `user_id` | `u.id AS uid` → mapped to `user_id` | `users.id` |
| `first_name` | `u.first_name` | `users.first_name` |
| `last_name` | `u.last_name` | `users.last_name` |
| `email` | `u.email` | `users.email` |
| `is_admin` | `u.is_admin` | `users.is_admin` |
| `is_staff` | `u.is_staff` | `users.is_staff` |
| `profile_id` | `p.id AS profile_id` | `staff_payroll_profiles.id` |
| `employment_date` | `p.employment_date AS p_employment_date` | `staff_payroll_profiles.employment_date` |
| `bank_name` | `p.bank_name AS p_bank_name` | `staff_payroll_profiles.bank_name` |
| `profile_complete` | Computed in JS | All 5 banking fields + employment_date non-null |
| `has_pending_banking_request` | Computed in JS | Pending request exists for user |

### 3.3 Salary Fields

| Frontend (SalaryConfig) | Backend (DB column) | Transform |
|-------------------------|--------------------|-----------| 
| `id` | `staff_salaries.id` | Direct |
| `user_id` | `staff_salaries.user_id` | Direct |
| `gross_salary_cents` | `staff_salaries.gross_salary_cents` | Integer cents |
| `effective_from` | `staff_salaries.effective_from` | Date string |
| `notes` | `staff_salaries.notes` | Direct |
| `deductions` | `salary_deductions WHERE type='deduction'` | Array of `{ id, type, label, amount_cents }` |
| `allowances` | `salary_deductions WHERE type='allowance'` | Array of `{ id, type, label, amount_cents }` |
| `total_deductions_cents` | Computed | Sum of deduction amounts |
| `total_allowances_cents` | Computed | Sum of allowance amounts |
| `net_salary_cents` | Computed | `gross - deductions + allowances` |

### 3.4 Payslip Fields

| Frontend (Payslip) | Backend (DB column) | Transform |
|--------------------|--------------------|-----------| 
| `id` | `payslips.id` | Direct |
| `user_id` | `payslips.user_id` | Direct |
| `pay_month` | `payslips.pay_month` | Integer 1-12 |
| `pay_year` | `payslips.pay_year` | Integer |
| `gross_salary_cents` | `payslips.gross_salary_cents` | Integer cents |
| `total_deductions_cents` | `payslips.total_deductions_cents` | Integer cents |
| `total_allowances_cents` | `payslips.total_allowances_cents` | Integer cents |
| `net_salary_cents` | `payslips.net_salary_cents` | Integer cents |
| `deductions_json` | `payslips.deductions_json` | JSON string → parsed array |
| `allowances_json` | `payslips.allowances_json` | JSON string → parsed array |
| `reference` | `payslips.reference` | String `PS-YYYY-MM-XXXXXX` |
| `status` | `payslips.status` | `'active'` or `'voided'` |
| `first_name` | JOIN `users.first_name` | Only in list queries |
| `last_name` | JOIN `users.last_name` | Only in list queries |

### 3.5 Leave Balance Fields

| Frontend (LeaveBalance) | Backend (DB column) | Transform |
|------------------------|--------------------|-----------|
| `id` | `leave_balances.id` | UUID string |
| `user_id` | `leave_balances.user_id` | Direct |
| `leave_type` | `leave_balances.leave_type` | Enum string |
| `cycle_year` | `leave_balances.cycle_year` | Integer |
| `entitled_days` | `leave_balances.entitled_days` | Number |
| `used_days` | `leave_balances.used_days` | Number |
| `pending_days` | `leave_balances.pending_days` | Number |
| `remaining_days` | `leave_balances.remaining_days` | Generated column |
| `employee_name` | JOIN `users.first_name + ' ' + users.last_name` | Admin list only |

### 3.6 Leave Request Fields

| Frontend (LeaveRequest) | Backend (DB column) | Transform |
|------------------------|--------------------|-----------|
| `id` | `leave_requests.id` | UUID string |
| `user_id` | `leave_requests.user_id` | Direct |
| `leave_type` | `leave_requests.leave_type` | Enum string |
| `start_date` | `leave_requests.start_date` | Date string `YYYY-MM-DD` |
| `end_date` | `leave_requests.end_date` | Date string `YYYY-MM-DD` |
| `days` | `leave_requests.days` | Number (working days) |
| `reason` | `leave_requests.reason` | Direct |
| `status` | `leave_requests.status` | Enum: pending/approved/rejected/cancelled |
| `approved_by` | `leave_requests.approved_by` | FK to users.id |
| `approved_at` | `leave_requests.approved_at` | ISO timestamp |
| `rejection_reason` | `leave_requests.rejection_reason` | Direct |
| `employee_name` | JOIN `users.first_name + ' ' + users.last_name` (on user_id) | List queries |
| `reviewer_name` | JOIN `users.first_name + ' ' + users.last_name` (on approved_by) | List queries |

### 3.7 Payslip PDF Leave Data

| PDF Field | Backend Source | Description |
|-----------|---------------|-------------|
| `leave_days_remaining` | `SELECT remaining_days FROM leave_balances WHERE user_id = ? AND leave_type = 'annual' AND cycle_year = ?` | Annual leave days remaining for current year, displayed on payslip PDF |

---

## 4. Indexes

| Table | Index | Columns | Type |
|-------|-------|---------|------|
| `staff_payroll_profiles` | PRIMARY | `id` | PK |
| `staff_payroll_profiles` | UNIQUE | `user_id` | Unique |
| `banking_change_requests` | PRIMARY | `id` | PK |
| `banking_change_requests` | — | `user_id` | FK (implicit index) |
| `staff_salaries` | PRIMARY | `id` | PK |
| `staff_salaries` | UNIQUE | `user_id` | Unique |
| `salary_deductions` | PRIMARY | `id` | PK |
| `salary_deductions` | — | `salary_id` | FK (implicit index) |
| `payslips` | PRIMARY | `id` | PK |
| `payslips` | UNIQUE | `user_id, pay_month, pay_year` | Composite unique |
| `leave_balances` | PRIMARY | `id` | PK (UUID) |
| `leave_balances` | UNIQUE | `user_id, leave_type, cycle_year` | Composite unique |
| `leave_requests` | PRIMARY | `id` | PK (UUID) |
| `leave_requests` | — | `user_id` | FK (implicit index) |
| `leave_requests` | — | `approved_by` | FK (implicit index) |
