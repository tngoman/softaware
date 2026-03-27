# Admin Payroll Module — Database Schema & Fields

**Version:** 1.1.0  
**Last Updated:** 2026-03-16

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **MySQL tables** | 5 payroll-specific tables |
| **Foreign key constraints** | 8 relationships |
| **Indexes** | 16 total |
| **ENUM fields** | 4 (account_type, deduction category, payslip status, banking request status) |

---

## 2. MySQL Tables

### 2.1 `staff_payroll_profiles` — Staff Payroll Profile & Banking Details

**Purpose:** Stores the payroll profile for each staff member, including employment date, personal identifiers (ID number, tax number), and banking details. This profile is the prerequisite for all payroll activity — a salary cannot be set and payslips cannot be generated until the profile exists with an `employment_date`.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | — | Profile UUID |
| user_id | VARCHAR(36) | FK, UNIQUE, NOT NULL | — | Reference to `users.id` (must be staff) |
| employment_date | DATE | NOT NULL | — | Date of employment — gates all payroll activity |
| id_number | VARCHAR(20) | NULLABLE | NULL | South African ID number |
| tax_number | VARCHAR(20) | NULLABLE | NULL | SARS tax reference number |
| bank_name | VARCHAR(100) | NULLABLE | NULL | Bank name (e.g., FNB, Capitec, Standard Bank) |
| branch_code | VARCHAR(20) | NULLABLE | NULL | Bank branch/universal code |
| account_number_encrypted | VARBINARY(512) | NULLABLE | NULL | AES-256-GCM encrypted account number |
| account_type | ENUM | NULLABLE | NULL | `'cheque'`, `'savings'`, `'transmission'` |
| account_holder_name | VARCHAR(255) | NULLABLE | NULL | Name on the bank account |
| banking_updated_at | DATETIME | NULLABLE | NULL | Last time banking details were changed |
| banking_updated_by | VARCHAR(36) | NULLABLE, FK | NULL | Admin who last updated banking (or `'self_approved'`) |
| created_by | VARCHAR(36) | NOT NULL | — | Admin who created the profile |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**account_type Values:**
- `cheque` — Cheque/current account
- `savings` — Savings account
- `transmission` — Transmission account

**Indexes:**
```sql
PRIMARY KEY (id)
UNIQUE KEY idx_payroll_profile_user (user_id)
INDEX idx_payroll_profile_employment (employment_date)
```

**Relationships:**
- `staff_payroll_profiles.user_id → users.id` — Staff member reference
- `staff_payroll_profiles.created_by → users.id` — Admin who created the profile
- `staff_payroll_profiles.banking_updated_by → users.id` — Admin who last changed banking

**Business Rules:**
- Only users with `is_staff = 1` can have a payroll profile
- `employment_date` is **required** — cannot be NULL — must be set at profile creation
- No salary can be created for a user without a payroll profile
- No payslip can be generated for a month before the `employment_date`
- `account_number_encrypted` uses AES-256-GCM encryption via the credential vault pattern
- Banking fields are all-or-nothing: if any banking field is set, all banking fields must be provided
- Banking details are only returned in full (decrypted) to admin users
- Staff users see a masked version: `account_number` → `****5678` (last 4 digits only)
- `banking_updated_at` and `banking_updated_by` track the most recent banking change for audit

**Encryption:**
```typescript
// Account number encryption (same pattern as credentialVault.ts)
import { encrypt, decrypt } from '../services/credentialVault.js';

const encrypted = encrypt(account_number);  // → Buffer
const decrypted = decrypt(encrypted);       // → '62012345678'
```

**Masking (for staff view):**
```typescript
function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return '****';
  return '****' + accountNumber.slice(-4);
}
// '62012345678' → '****5678'
```

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS staff_payroll_profiles (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  employment_date DATE NOT NULL,
  id_number VARCHAR(20),
  tax_number VARCHAR(20),
  bank_name VARCHAR(100),
  branch_code VARCHAR(20),
  account_number_encrypted VARBINARY(512),
  account_type ENUM('cheque', 'savings', 'transmission'),
  account_holder_name VARCHAR(255),
  banking_updated_at DATETIME,
  banking_updated_by VARCHAR(36),
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_payroll_profile_user (user_id),
  INDEX idx_payroll_profile_employment (employment_date),
  CONSTRAINT fk_payroll_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_profile_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.2 `banking_change_requests` — Staff Banking Update Requests

**Purpose:** Stores banking detail change requests submitted by staff members. Each request enters a `pending` state and must be approved or rejected by an admin before the banking details on the payroll profile are updated.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | — | Request UUID |
| user_id | VARCHAR(36) | FK, NOT NULL | — | Staff member who submitted the request |
| bank_name | VARCHAR(100) | NOT NULL | — | Requested bank name |
| branch_code | VARCHAR(20) | NOT NULL | — | Requested branch code |
| account_number_encrypted | VARBINARY(512) | NOT NULL | — | AES-256-GCM encrypted requested account number |
| account_type | ENUM | NOT NULL | — | `'cheque'`, `'savings'`, `'transmission'` |
| account_holder_name | VARCHAR(255) | NOT NULL | — | Requested account holder name |
| status | ENUM | NOT NULL | 'pending' | Request status |
| reviewed_by | VARCHAR(36) | NULLABLE, FK | NULL | Admin who approved/rejected |
| reviewed_at | DATETIME | NULLABLE | NULL | Timestamp of review |
| rejection_reason | TEXT | NULLABLE | NULL | Reason for rejection (required on reject) |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Request submission timestamp |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**status Values:**
- `pending` — Submitted, awaiting admin review
- `approved` — Admin approved; banking details copied to payroll profile
- `rejected` — Admin rejected; `rejection_reason` is set

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_banking_req_user (user_id)
INDEX idx_banking_req_status (status)
INDEX idx_banking_req_created (created_at)
```

**Relationships:**
- `banking_change_requests.user_id → users.id` — Staff member who requested
- `banking_change_requests.reviewed_by → users.id` — Admin who reviewed

**Business Rules:**
- Only one `pending` request per staff member at a time (enforced in application logic)
- Staff can view their own requests (all statuses) but not other staff members'
- Admin can view all requests, filtered by status
- On approval: banking fields are copied to `staff_payroll_profiles` in a transaction
- On rejection: `rejection_reason` is required and visible to the staff member
- Request history is preserved — never deleted — for audit trail
- The `account_number_encrypted` uses the same AES-256-GCM encryption as the profile

**Approval Transaction:**
```sql
BEGIN;
  -- Copy new banking details to the payroll profile
  UPDATE staff_payroll_profiles
  SET bank_name = <from request>,
      branch_code = <from request>,
      account_number_encrypted = <from request>,
      account_type = <from request>,
      account_holder_name = <from request>,
      banking_updated_at = NOW(),
      banking_updated_by = <admin_user_id>
  WHERE user_id = <staff_user_id>;

  -- Mark request as approved
  UPDATE banking_change_requests
  SET status = 'approved',
      reviewed_by = <admin_user_id>,
      reviewed_at = NOW()
  WHERE id = <request_id>;
COMMIT;
```

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS banking_change_requests (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  branch_code VARCHAR(20) NOT NULL,
  account_number_encrypted VARBINARY(512) NOT NULL,
  account_type ENUM('cheque', 'savings', 'transmission') NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(36),
  reviewed_at DATETIME,
  rejection_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_banking_req_user (user_id),
  INDEX idx_banking_req_status (status),
  INDEX idx_banking_req_created (created_at),
  CONSTRAINT fk_banking_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_banking_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.3 `staff_salaries` — Staff Salary Configuration

**Purpose:** Stores the current salary configuration for each staff member, including the gross monthly salary. One record per staff user. Requires a `staff_payroll_profiles` record with a valid `employment_date` before it can be created.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | — | Salary config UUID |
| user_id | VARCHAR(36) | FK, UNIQUE, NOT NULL | — | Reference to `users.id` (must be staff) |
| gross_salary_cents | INT UNSIGNED | NOT NULL | 0 | Monthly gross salary in cents (ZAR) |
| effective_from | DATE | NOT NULL | CURRENT_DATE | Date this salary takes effect |
| notes | TEXT | NULLABLE | NULL | Admin notes about salary |
| created_by | VARCHAR(36) | NOT NULL | — | Admin user who created this record |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**Indexes:**
```sql
PRIMARY KEY (id)
UNIQUE KEY idx_staff_salary_user (user_id)
INDEX idx_staff_salary_effective (effective_from)
```

**Relationships:**
- `staff_salaries.user_id → users.id` — Staff member reference
- `staff_salaries.created_by → users.id` — Admin who set the salary

**Business Rules:**
- Only users with `is_staff = 1` can have a salary record
- **Prerequisite:** User must have a `staff_payroll_profiles` record with `employment_date` set
- `effective_from` must be on or after the staff member's `employment_date`
- `gross_salary_cents` is stored in ZAR cents (divide by 100 for Rand amount)
- One active salary record per staff member at any time
- Salary history is maintained via the `salary_history` JSON snapshot in payslips

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS staff_salaries (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  gross_salary_cents INT UNSIGNED NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT (CURRENT_DATE),
  notes TEXT,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_staff_salary_user (user_id),
  INDEX idx_staff_salary_effective (effective_from),
  CONSTRAINT fk_staff_salary_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_salary_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.4 `salary_deductions` — Deduction & Allowance Line Items

**Purpose:** Stores individual deduction and allowance line items for a staff member's salary configuration. Multiple records per salary.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | — | Line item UUID |
| salary_id | VARCHAR(36) | FK, NOT NULL | — | Reference to `staff_salaries.id` |
| category | ENUM | NOT NULL | — | `'deduction'` or `'allowance'` |
| type | VARCHAR(50) | NOT NULL | — | Type code (see values below) |
| label | VARCHAR(255) | NOT NULL | — | Display label (e.g., "PAYE Tax") |
| amount_cents | INT UNSIGNED | NOT NULL | 0 | Amount in cents (ZAR) |
| sort_order | INT | NOT NULL | 0 | Display order |
| created_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Record creation timestamp |

**category Values:**
- `deduction` — Subtracted from gross salary
- `allowance` — Added on top of gross salary

**type Values (deductions):**
- `paye` — Pay As You Earn income tax
- `uif` — Unemployment Insurance Fund
- `medical_aid` — Medical aid contribution
- `pension` — Pension/provident fund contribution
- `custom` — Custom deduction with user-defined label

**type Values (allowances):**
- `travel` — Travel allowance
- `housing` — Housing allowance
- `phone` — Phone/communication allowance
- `custom` — Custom allowance with user-defined label

**Indexes:**
```sql
PRIMARY KEY (id)
INDEX idx_deduction_salary (salary_id)
INDEX idx_deduction_category (category)
```

**Relationships:**
- `salary_deductions.salary_id → staff_salaries.id` — Parent salary record

**Business Rules:**
- Line items are replaced in bulk when salary is updated (DELETE + INSERT)
- `amount_cents` is always a positive value; category determines add/subtract
- `sort_order` controls display order within each category
- `type = 'custom'` requires a meaningful `label`

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS salary_deductions (
  id VARCHAR(36) NOT NULL,
  salary_id VARCHAR(36) NOT NULL,
  category ENUM('deduction', 'allowance') NOT NULL,
  type VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_deduction_salary (salary_id),
  INDEX idx_deduction_category (category),
  CONSTRAINT fk_deduction_salary FOREIGN KEY (salary_id) REFERENCES staff_salaries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 2.5 `payslips` — Generated Monthly Payslips

**Purpose:** Stores generated payslip records. Each payslip is a snapshot of the salary configuration at the time of generation for a specific month. Payslips are viewable by both admin (all) and staff (own only).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | VARCHAR(36) | PK, NOT NULL | — | Payslip UUID |
| user_id | VARCHAR(36) | FK, NOT NULL | — | Staff member reference |
| reference_number | VARCHAR(50) | UNIQUE, NOT NULL | — | Payslip reference (e.g., `PS-2026-03-001`) |
| pay_month | TINYINT UNSIGNED | NOT NULL | — | Month number (1–12) |
| pay_year | SMALLINT UNSIGNED | NOT NULL | — | Year (e.g., 2026) |
| gross_salary_cents | INT UNSIGNED | NOT NULL | 0 | Gross salary snapshot |
| total_deductions_cents | INT UNSIGNED | NOT NULL | 0 | Sum of all deductions |
| total_allowances_cents | INT UNSIGNED | NOT NULL | 0 | Sum of all allowances |
| net_salary_cents | INT | NOT NULL | 0 | Net pay (gross − deductions + allowances) |
| deductions_snapshot | JSON | NOT NULL | '[]' | Array of deduction items at time of generation |
| allowances_snapshot | JSON | NOT NULL | '[]' | Array of allowance items at time of generation |
| employee_name | VARCHAR(255) | NOT NULL | — | Staff member name snapshot |
| employee_email | VARCHAR(255) | NOT NULL | — | Staff member email snapshot |
| company_name | VARCHAR(255) | NULLABLE | NULL | Company name from sys_settings |
| company_address | TEXT | NULLABLE | NULL | Company address from sys_settings |
| status | ENUM | NOT NULL | 'generated' | Payslip status |
| generated_by | VARCHAR(36) | NOT NULL | — | Admin who generated the payslip |
| generated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP | Generation timestamp |
| updated_at | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

**status Values:**
- `generated` — Payslip created and viewable
- `voided` — Payslip invalidated (kept for audit trail)

**deductions_snapshot JSON Structure:**
```json
[
  {
    "type": "paye",
    "label": "PAYE Tax",
    "amount_cents": 525000
  },
  {
    "type": "uif",
    "label": "UIF",
    "amount_cents": 35000
  }
]
```

**allowances_snapshot JSON Structure:**
```json
[
  {
    "type": "travel",
    "label": "Travel Allowance",
    "amount_cents": 150000
  }
]
```

**reference_number Format:**
```
PS-{YYYY}-{MM}-{SEQ}
Example: PS-2026-03-001
```
- `YYYY` — 4-digit year
- `MM` — 2-digit month (zero-padded)
- `SEQ` — 3-digit sequential number within the month (zero-padded)

**Indexes:**
```sql
PRIMARY KEY (id)
UNIQUE KEY idx_payslip_reference (reference_number)
UNIQUE KEY idx_payslip_unique_month (user_id, pay_month, pay_year)
INDEX idx_payslip_period (pay_year, pay_month)
INDEX idx_payslip_status (status)
```

**Relationships:**
- `payslips.user_id → users.id` — Staff member
- `payslips.generated_by → users.id` — Admin who generated

**Business Rules:**
- One payslip per staff member per month (enforced by unique constraint)
- `pay_month` must be between 1 and 12
- `pay_year` must be the current year
- `pay_month` must not be in the future relative to the server date
- `pay_month/pay_year` must be on or after the staff member's `employment_date`
- Payslip captures a full snapshot of salary data at generation time
- Snapshots ensure historical accuracy even if salary is later changed
- `net_salary_cents = gross_salary_cents − total_deductions_cents + total_allowances_cents`
- Voided payslips cannot be downloaded as PDF but remain in the system
- Reference numbers are auto-generated and sequential per month
- Staff can view/download their own payslips via the staff payroll routes (`WHERE user_id = req.user.id`)

**DDL:**
```sql
CREATE TABLE IF NOT EXISTS payslips (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  reference_number VARCHAR(50) NOT NULL,
  pay_month TINYINT UNSIGNED NOT NULL,
  pay_year SMALLINT UNSIGNED NOT NULL,
  gross_salary_cents INT UNSIGNED NOT NULL DEFAULT 0,
  total_deductions_cents INT UNSIGNED NOT NULL DEFAULT 0,
  total_allowances_cents INT UNSIGNED NOT NULL DEFAULT 0,
  net_salary_cents INT NOT NULL DEFAULT 0,
  deductions_snapshot JSON NOT NULL DEFAULT ('[]'),
  allowances_snapshot JSON NOT NULL DEFAULT ('[]'),
  employee_name VARCHAR(255) NOT NULL,
  employee_email VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  company_address TEXT,
  status ENUM('generated', 'voided') NOT NULL DEFAULT 'generated',
  generated_by VARCHAR(36) NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_payslip_reference (reference_number),
  UNIQUE KEY idx_payslip_unique_month (user_id, pay_month, pay_year),
  INDEX idx_payslip_period (pay_year, pay_month),
  INDEX idx_payslip_status (status),
  CONSTRAINT fk_payslip_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payslip_generator FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Entity Relationship Diagram

```
┌─────────────────┐       ┌───────────────────────────┐
│     users        │       │  staff_payroll_profiles     │
│─────────────────│       │───────────────────────────│
│ id          (PK) │◄──────│ user_id            (FK)   │
│ name             │       │ id                (PK)   │
│ email            │       │ employment_date           │
│ is_staff         │       │ id_number                 │
│ ...              │       │ tax_number                │
│                  │       │ bank_name                 │
│                  │       │ branch_code               │
│                  │       │ account_number_encrypted   │
│                  │       │ account_type              │
│                  │       │ account_holder_name        │
│                  │       │ banking_updated_at         │
│                  │       │ banking_updated_by   (FK)  │
│                  │       │ created_by           (FK)  │
│                  │       └───────────────────────────┘
│                  │
│                  │       ┌───────────────────────────┐
│                  │       │  banking_change_requests    │
│                  │       │───────────────────────────│
│                  │◄──────│ user_id            (FK)   │
│                  │       │ id                (PK)   │
│                  │       │ bank_name                 │
│                  │       │ branch_code               │
│                  │       │ account_number_encrypted   │
│                  │       │ account_type              │
│                  │       │ account_holder_name        │
│                  │       │ status (pending/approved/  │
│                  │       │        rejected)           │
│                  │       │ reviewed_by         (FK)  │
│                  │       │ rejection_reason           │
│                  │       └───────────────────────────┘
│                  │
│                  │       ┌─────────────────────┐       ┌────────────────────┐
│                  │       │   staff_salaries      │       │ salary_deductions  │
│                  │       │─────────────────────│       │────────────────────│
│                  │◄──────│ user_id        (FK)  │◄──────│ salary_id    (FK)  │
│                  │       │ id            (PK)  │       │ id          (PK)  │
│                  │       │ gross_salary_cents   │       │ category          │
│                  │       │ effective_from       │       │ type              │
│                  │       │ notes               │       │ label             │
│                  │       │ created_by     (FK)  │       │ amount_cents      │
│                  │       └─────────────────────┘       │ sort_order        │
│                  │                                      └────────────────────┘
│                  │
│                  │       ┌─────────────────────┐
│                  │       │     payslips          │
│                  │       │─────────────────────│
└──────────────────│◄──────│ user_id        (FK)  │
                   │       │ id            (PK)  │
                   │       │ reference_number     │
                   │       │ pay_month / pay_year │
                   │       │ gross_salary_cents   │
                   │       │ total_deductions     │
                   │       │ total_allowances     │
                   │       │ net_salary_cents     │
                   │       │ deductions_snapshot  │
                   │       │ allowances_snapshot  │
                   │       │ employee_name        │
                   │       │ status              │
                   │       │ generated_by   (FK)  │
                   │       └─────────────────────┘
```

**Prerequisite Chain:**
```
staff_payroll_profiles (employment_date required)
        │
        ▼
  staff_salaries (effective_from ≥ employment_date)
        │
        ▼
     payslips (pay_month/year ≥ employment month/year)
```

---

## 4. Computed / Virtual Fields

These values are not stored in the database but are computed at query time or in the API layer:

| Field | Computation | Used In |
|-------|-------------|---------|
| `account_number` (decrypted) | `decrypt(account_number_encrypted)` | Admin API response only |
| `account_number_masked` | `'****' + account_number.slice(-4)` | Staff API response |
| `has_banking` | `bank_name IS NOT NULL` | Profile completeness indicator |
| `profile_complete` | `employment_date IS NOT NULL AND bank_name IS NOT NULL` | UI status badge |
| `gross_salary_rand` | `gross_salary_cents / 100` | API response |
| `net_salary_rand` | `net_salary_cents / 100` | API response |
| `total_deductions_rand` | `total_deductions_cents / 100` | API response |
| `total_allowances_rand` | `total_allowances_cents / 100` | API response |
| `pay_period` | `CONCAT(pay_year, '-', LPAD(pay_month, 2, '0'))` | Display label |
| `is_current_month` | `pay_month = MONTH(NOW()) AND pay_year = YEAR(NOW())` | UI highlight |
| `has_pending_banking_request` | `EXISTS(SELECT 1 FROM banking_change_requests WHERE user_id = ? AND status = 'pending')` | Staff profile badge |

---

**Document Status**: ✅ Complete  
**Review Cycle**: Quarterly  
**Next Review**: 2026-06-16
