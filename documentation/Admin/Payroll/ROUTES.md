# Admin Payroll Module — API Routes

**Version:** 1.1.0  
**Last Updated:** 2026-03-16

---

## 1. Overview

| Metric | Value |
|--------|-------|
| **Total endpoints** | 22 |
| **Base URL** | `https://api.softaware.net.za` |
| **Authentication** | Bearer JWT token |
| **Admin routes** | 17 endpoints — requireAuth + requireAdmin |
| **Staff routes** | 5 endpoints — requireAuth + requireStaff |
| **Content-Type** | application/json |
| **Source files** | `src/routes/adminPayroll.ts`, `src/routes/staffPayroll.ts` |

---

## 2. Endpoint Directory

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| **STAFF PROFILES (Admin)** ||||
| 1 | GET | /api/admin/payroll/profiles | Admin | List all staff payroll profiles |
| 2 | GET | /api/admin/payroll/profiles/:userId | Admin | Get staff payroll profile |
| 3 | PUT | /api/admin/payroll/profiles/:userId | Admin | Create/update payroll profile |
| **BANKING APPROVALS (Admin)** ||||
| 4 | GET | /api/admin/payroll/banking-requests | Admin | List banking change requests |
| 5 | POST | /api/admin/payroll/banking-requests/:id/approve | Admin | Approve banking change |
| 6 | POST | /api/admin/payroll/banking-requests/:id/reject | Admin | Reject banking change |
| **SALARY MANAGEMENT (Admin)** ||||
| 7 | GET | /api/admin/payroll/salaries | Admin | List all staff with salary info |
| 8 | GET | /api/admin/payroll/salaries/:userId | Admin | Get salary detail for a staff member |
| 9 | PUT | /api/admin/payroll/salaries/:userId | Admin | Set or update salary configuration |
| 10 | DELETE | /api/admin/payroll/salaries/:userId | Admin | Remove salary configuration |
| 11 | GET | /api/admin/payroll/salaries/:userId/history | Admin | Salary change history |
| **PAYSLIP GENERATION (Admin)** ||||
| 12 | POST | /api/admin/payroll/payslips/generate | Admin | Generate payslip for one staff member |
| 13 | POST | /api/admin/payroll/payslips/generate-bulk | Admin | Generate payslips for all staff |
| **PAYSLIP MANAGEMENT (Admin)** ||||
| 14 | GET | /api/admin/payroll/payslips | Admin | List payslips with filters |
| 15 | GET | /api/admin/payroll/payslips/:id | Admin | Get single payslip detail |
| 16 | GET | /api/admin/payroll/payslips/:id/pdf | Admin | Download payslip as PDF |
| 17 | DELETE | /api/admin/payroll/payslips/:id | Admin | Void/delete a payslip |
| **SUMMARY (Admin)** ||||
| 18 | GET | /api/admin/payroll/summary | Admin | Monthly payroll summary |
| **STAFF SELF-SERVICE** ||||
| 19 | GET | /api/staff/payroll/profile | Staff | View own payroll profile (masked banking) |
| 20 | GET | /api/staff/payroll/payslips | Staff | List own payslips |
| 21 | GET | /api/staff/payroll/payslips/:id/pdf | Staff | Download own payslip PDF |
| 22 | POST | /api/staff/payroll/banking-request | Staff | Submit banking change request |
| 23 | GET | /api/staff/payroll/banking-request | Staff | View own banking request status |

---

## 3. Staff Profile Routes (Admin)

### 3.1 GET /api/admin/payroll/profiles

**Purpose:** List all staff members with their payroll profile status — including employment date, banking completeness, and profile readiness.

**Authentication:** Required (Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter: `complete` (has profile + banking), `incomplete` (has profile, missing banking), `missing` (no profile) |
| `search` | string | No | Search by staff name or email |

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/payroll/profiles \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid-staff-001",
      "name": "John Smith",
      "email": "john@softaware.net.za",
      "profile": {
        "id": "uuid-profile-001",
        "employment_date": "2025-06-15",
        "id_number": "9001015800085",
        "tax_number": "0123456789",
        "bank_name": "FNB",
        "branch_code": "250655",
        "account_number": "62012345678",
        "account_type": "cheque",
        "account_holder_name": "John Smith",
        "has_banking": true,
        "profile_complete": true,
        "has_pending_banking_request": false,
        "created_at": "2025-06-15T10:00:00.000Z",
        "updated_at": "2026-01-15T10:30:00.000Z"
      }
    },
    {
      "user_id": "uuid-staff-002",
      "name": "Jane Doe",
      "email": "jane@softaware.net.za",
      "profile": null
    }
  ]
}
```

**Note:** Admin sees the full (decrypted) `account_number`. Staff routes return `account_number_masked` instead.

---

### 3.2 GET /api/admin/payroll/profiles/:userId

**Purpose:** Get full payroll profile for a specific staff member, including unmasked banking details.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — The staff member's user UUID

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/payroll/profiles/uuid-staff-001 \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-profile-001",
    "user_id": "uuid-staff-001",
    "user_name": "John Smith",
    "user_email": "john@softaware.net.za",
    "employment_date": "2025-06-15",
    "id_number": "9001015800085",
    "tax_number": "0123456789",
    "bank_name": "FNB",
    "branch_code": "250655",
    "account_number": "62012345678",
    "account_type": "cheque",
    "account_holder_name": "John Smith",
    "banking_updated_at": "2026-01-15T10:30:00.000Z",
    "banking_updated_by": "admin-uuid",
    "has_salary": true,
    "has_pending_banking_request": false,
    "created_by": "admin-uuid",
    "created_at": "2025-06-15T10:00:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | User not found or not staff | `{"error": "Staff member not found"}` |
| 404 | No profile exists | `{"error": "Payroll profile not found for this staff member"}` |

---

### 3.3 PUT /api/admin/payroll/profiles/:userId

**Purpose:** Create or update the payroll profile for a staff member. Sets employment date, personal identifiers, and banking details. Admin can update banking details directly without an approval workflow.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — The staff member's user UUID

**Request Body:**
```json
{
  "employment_date": "2025-06-15",
  "id_number": "9001015800085",
  "tax_number": "0123456789",
  "bank_name": "FNB",
  "branch_code": "250655",
  "account_number": "62012345678",
  "account_type": "cheque",
  "account_holder_name": "John Smith"
}
```

**Field Definitions:**

| Field | Type | Required | Valid Values | Description |
|-------|------|----------|-------------|-------------|
| `employment_date` | string (date) | **Yes** | ISO date (past or today) | Date of employment — required |
| `id_number` | string | No | SA ID format | South African ID number |
| `tax_number` | string | No | — | SARS tax reference number |
| `bank_name` | string | No* | — | Bank name |
| `branch_code` | string | No* | — | Branch/universal code |
| `account_number` | string | No* | — | Account number (encrypted on store) |
| `account_type` | string | No* | `cheque`, `savings`, `transmission` | Account type |
| `account_holder_name` | string | No* | — | Name on account |

*Banking fields are all-or-nothing: if any banking field is provided, all five must be provided.

**Validation Rules:**
- `employment_date` is mandatory and cannot be a future date
- User must exist and have `is_staff = 1`
- If any banking field is present, all banking fields must be provided
- When banking details are updated, `banking_updated_at` and `banking_updated_by` are set automatically

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payroll profile saved successfully",
  "data": {
    "id": "uuid-profile-001",
    "user_id": "uuid-staff-001",
    "employment_date": "2025-06-15",
    "has_banking": true,
    "profile_complete": true
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing employment_date | `{"error": "employment_date is required"}` |
| 400 | Future employment_date | `{"error": "employment_date cannot be in the future"}` |
| 400 | Partial banking details | `{"error": "All banking fields must be provided together: bank_name, branch_code, account_number, account_type, account_holder_name"}` |
| 404 | User not found or not staff | `{"error": "Staff member not found"}` |

---

## 4. Banking Approval Routes (Admin)

### 4.1 GET /api/admin/payroll/banking-requests

**Purpose:** List banking change requests submitted by staff, with filtering by status.

**Authentication:** Required (Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter: `pending`, `approved`, `rejected` (default: `pending`) |
| `user_id` | string | No | Filter by specific staff member |

**Request:**
```bash
curl "https://api.softaware.net.za/api/admin/payroll/banking-requests?status=pending" \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-req-001",
      "user_id": "uuid-staff-001",
      "staff_name": "John Smith",
      "staff_email": "john@softaware.net.za",
      "current_banking": {
        "bank_name": "FNB",
        "branch_code": "250655",
        "account_number": "62012345678",
        "account_type": "cheque",
        "account_holder_name": "John Smith"
      },
      "requested_banking": {
        "bank_name": "Capitec",
        "branch_code": "470010",
        "account_number": "1234567890",
        "account_type": "savings",
        "account_holder_name": "John Smith"
      },
      "status": "pending",
      "created_at": "2026-03-10T14:00:00.000Z"
    }
  ]
}
```

**Note:** Admin sees full (decrypted) account numbers for both current and requested banking details to enable proper comparison during review.

---

### 4.2 POST /api/admin/payroll/banking-requests/:id/approve

**Purpose:** Approve a pending banking change request. The new banking details are copied to the staff member's payroll profile within a database transaction.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — The banking change request UUID

**Request:**
```bash
curl -X POST https://api.softaware.net.za/api/admin/payroll/banking-requests/uuid-req-001/approve \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Banking change approved and profile updated",
  "data": {
    "request_id": "uuid-req-001",
    "user_id": "uuid-staff-001",
    "staff_name": "John Smith",
    "new_bank_name": "Capitec",
    "approved_at": "2026-03-16T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Request not found | `{"error": "Banking change request not found"}` |
| 400 | Not in pending state | `{"error": "This request has already been reviewed"}` |

**Transaction Steps:**
1. Validate request exists and status = `pending`
2. Copy banking fields from request to `staff_payroll_profiles`
3. Set `banking_updated_at = NOW()`, `banking_updated_by = req.user.id`
4. Update request: `status = 'approved'`, `reviewed_by = req.user.id`, `reviewed_at = NOW()`

---

### 4.3 POST /api/admin/payroll/banking-requests/:id/reject

**Purpose:** Reject a pending banking change request. A reason must be provided and will be visible to the staff member.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `id` (string, required) — The banking change request UUID

**Request Body:**
```json
{
  "reason": "Branch code does not match the selected bank"
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | **Yes** | Reason for rejection (shown to staff) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Banking change request rejected",
  "data": {
    "request_id": "uuid-req-001",
    "user_id": "uuid-staff-001",
    "rejected_at": "2026-03-16T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing reason | `{"error": "Rejection reason is required"}` |
| 404 | Request not found | `{"error": "Banking change request not found"}` |
| 400 | Not in pending state | `{"error": "This request has already been reviewed"}` |

---

## 5. Salary Management Routes (Admin)

### 5.1 GET /api/admin/payroll/salaries

**Purpose:** List all staff members with their current salary configuration. Includes staff without a salary set (shown with null salary data).

**Authentication:** Required (Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `has_salary` | boolean | No | Filter: `true` = only staff with salary set, `false` = only without |
| `search` | string | No | Search by staff name or email |

**Request:**
```bash
curl https://api.softaware.net.za/api/admin/payroll/salaries \
  -H "Authorization: Bearer <admin-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "uuid-staff-001",
      "name": "John Smith",
      "email": "john@softaware.net.za",
      "employment_date": "2025-06-15",
      "has_profile": true,
      "salary": {
        "id": "uuid-salary-001",
        "gross_salary_cents": 3500000,
        "effective_from": "2026-01-01",
        "deductions": [
          {"id": "uuid-ded-001", "category": "deduction", "type": "paye", "label": "PAYE Tax", "amount_cents": 525000},
          {"id": "uuid-ded-002", "category": "deduction", "type": "uif", "label": "UIF", "amount_cents": 35000}
        ],
        "allowances": [
          {"id": "uuid-all-001", "category": "allowance", "type": "travel", "label": "Travel Allowance", "amount_cents": 150000}
        ],
        "total_deductions_cents": 560000,
        "total_allowances_cents": 150000,
        "net_salary_cents": 3090000,
        "notes": null,
        "updated_at": "2026-01-15T10:30:00.000Z"
      }
    },
    {
      "user_id": "uuid-staff-002",
      "name": "Jane Doe",
      "email": "jane@softaware.net.za",
      "employment_date": null,
      "has_profile": false,
      "salary": null
    }
  ]
}
```

---

### 5.2 GET /api/admin/payroll/salaries/:userId

**Purpose:** Get the full salary configuration for a specific staff member.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — The staff member's user UUID

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-salary-001",
    "user_id": "uuid-staff-001",
    "user_name": "John Smith",
    "user_email": "john@softaware.net.za",
    "employment_date": "2025-06-15",
    "gross_salary_cents": 3500000,
    "effective_from": "2026-01-01",
    "deductions": [
      {"id": "uuid-ded-001", "category": "deduction", "type": "paye", "label": "PAYE Tax", "amount_cents": 525000, "sort_order": 1},
      {"id": "uuid-ded-002", "category": "deduction", "type": "uif", "label": "UIF", "amount_cents": 35000, "sort_order": 2},
      {"id": "uuid-ded-003", "category": "deduction", "type": "medical_aid", "label": "Medical Aid", "amount_cents": 250000, "sort_order": 3}
    ],
    "allowances": [
      {"id": "uuid-all-001", "category": "allowance", "type": "travel", "label": "Travel Allowance", "amount_cents": 150000, "sort_order": 1}
    ],
    "total_deductions_cents": 810000,
    "total_allowances_cents": 150000,
    "net_salary_cents": 2840000,
    "notes": "Senior developer salary effective Jan 2026",
    "created_by": "admin-uuid",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | User not found or not staff | `{"error": "Staff member not found"}` |
| 404 | No salary configured | `{"error": "No salary configured for this staff member"}` |

---

### 5.3 PUT /api/admin/payroll/salaries/:userId

**Purpose:** Set or update the salary configuration for a staff member. Requires a payroll profile with `employment_date`. Replaces all existing deductions and allowances.

**Authentication:** Required (Admin role)

**URL Parameters:**
- `userId` (string, required) — The staff member's user UUID

**Request Body:**
```json
{
  "gross_salary_cents": 3500000,
  "effective_from": "2026-01-01",
  "notes": "Annual salary review",
  "deductions": [
    {"type": "paye", "label": "PAYE Tax", "amount_cents": 525000, "sort_order": 1},
    {"type": "uif", "label": "UIF", "amount_cents": 35000, "sort_order": 2},
    {"type": "medical_aid", "label": "Medical Aid", "amount_cents": 250000, "sort_order": 3},
    {"type": "pension", "label": "Pension Fund", "amount_cents": 175000, "sort_order": 4}
  ],
  "allowances": [
    {"type": "travel", "label": "Travel Allowance", "amount_cents": 150000, "sort_order": 1},
    {"type": "phone", "label": "Phone Allowance", "amount_cents": 50000, "sort_order": 2}
  ]
}
```

**Validation Rules:**
- `gross_salary_cents` must be a positive integer
- User must exist and have `is_staff = 1`
- **User must have a payroll profile with `employment_date` set**
- `effective_from` must be on or after the staff member's `employment_date`
- Total deductions cannot exceed gross salary + allowances

**Success Response (200):**
```json
{
  "success": true,
  "message": "Salary updated successfully",
  "data": {
    "id": "uuid-salary-001",
    "user_id": "uuid-staff-001",
    "gross_salary_cents": 3500000,
    "net_salary_cents": 2840000,
    "effective_from": "2026-01-01",
    "deduction_count": 4,
    "allowance_count": 2
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid salary amount | `{"error": "gross_salary_cents must be a positive integer"}` |
| 400 | No payroll profile | `{"error": "Staff member must have a payroll profile before salary can be set"}` |
| 400 | No employment date | `{"error": "Staff member must have an employment date set before salary can be configured"}` |
| 400 | effective_from before employment | `{"error": "effective_from cannot be before the staff member's employment date (2025-06-15)"}` |
| 400 | Deductions exceed salary | `{"error": "Total deductions exceed gross salary plus allowances"}` |
| 404 | User not found or not staff | `{"error": "Staff member not found"}` |

---

### 5.4 DELETE /api/admin/payroll/salaries/:userId

**Purpose:** Remove the salary configuration for a staff member. Existing payslips are preserved.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Salary configuration removed"
}
```

---

### 5.5 GET /api/admin/payroll/salaries/:userId/history

**Purpose:** View the salary change history for a staff member based on generated payslip snapshots.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "pay_period": "2026-03",
      "gross_salary_cents": 3500000,
      "total_deductions_cents": 810000,
      "total_allowances_cents": 150000,
      "net_salary_cents": 2840000,
      "generated_at": "2026-03-01T08:00:00.000Z"
    }
  ]
}
```

---

## 6. Payslip Generation Routes (Admin)

### 6.1 POST /api/admin/payroll/payslips/generate

**Purpose:** Generate a payslip for a specific staff member for a given month. The month must be on or after the staff member's employment date.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "user_id": "uuid-staff-001",
  "month": 3,
  "year": 2026,
  "overwrite": false
}
```

**Validation Rules:**
- `year` must equal the current year
- `month` must be ≤ current month
- **`month/year` must be on or after the staff member's `employment_date`**
- Staff member must have a salary configured
- If payslip already exists for this period and `overwrite` is not `true`, returns 409

**Success Response (201):**
```json
{
  "success": true,
  "message": "Payslip generated successfully",
  "data": {
    "id": "uuid-payslip-001",
    "reference_number": "PS-2026-03-001",
    "user_id": "uuid-staff-001",
    "employee_name": "John Smith",
    "pay_month": 3,
    "pay_year": 2026,
    "gross_salary_cents": 3500000,
    "total_deductions_cents": 810000,
    "total_allowances_cents": 150000,
    "net_salary_cents": 2840000,
    "status": "generated",
    "generated_at": "2026-03-16T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Future month | `{"error": "Cannot generate payslip for a future month"}` |
| 400 | Wrong year | `{"error": "Can only generate payslips for the current year"}` |
| 400 | Before employment | `{"error": "Cannot generate payslip for a month before the staff member's employment date (2025-06-15)"}` |
| 404 | Staff not found | `{"error": "Staff member not found"}` |
| 404 | No salary | `{"error": "No salary configured for this staff member"}` |
| 409 | Already exists | `{"error": "Payslip already exists for this period", "existing_id": "uuid"}` |

---

### 6.2 POST /api/admin/payroll/payslips/generate-bulk

**Purpose:** Generate payslips for all staff members with salary configurations for a given month. Skips staff whose employment date is after the target month.

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "month": 3,
  "year": 2026,
  "overwrite": false
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Bulk payslip generation complete",
  "data": {
    "generated": 7,
    "skipped": 3,
    "errors": 0,
    "details": [
      {"user_id": "uuid-001", "name": "John Smith", "status": "generated", "reference": "PS-2026-03-001"},
      {"user_id": "uuid-002", "name": "Jane Doe", "status": "generated", "reference": "PS-2026-03-002"},
      {"user_id": "uuid-003", "name": "Bob Wilson", "status": "skipped", "reason": "Payslip already exists"},
      {"user_id": "uuid-004", "name": "New Hire", "status": "skipped", "reason": "Employment date after target month"}
    ]
  }
}
```

---

## 7. Payslip Management Routes (Admin)

### 7.1 GET /api/admin/payroll/payslips

**Purpose:** List payslips with filtering and pagination.

**Authentication:** Required (Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | integer | No | Filter by pay month (1–12) |
| `year` | integer | No | Filter by pay year (defaults to current year) |
| `user_id` | string | No | Filter by staff member |
| `status` | string | No | Filter by status (`generated`, `voided`) |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 50, max: 200) |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-payslip-001",
      "reference_number": "PS-2026-03-001",
      "user_id": "uuid-staff-001",
      "employee_name": "John Smith",
      "employee_email": "john@softaware.net.za",
      "pay_month": 3,
      "pay_year": 2026,
      "gross_salary_cents": 3500000,
      "total_deductions_cents": 810000,
      "total_allowances_cents": 150000,
      "net_salary_cents": 2840000,
      "status": "generated",
      "generated_at": "2026-03-16T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 8,
    "totalPages": 1
  }
}
```

---

### 7.2 GET /api/admin/payroll/payslips/:id

**Purpose:** Get full payslip detail including snapshots.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-payslip-001",
    "reference_number": "PS-2026-03-001",
    "user_id": "uuid-staff-001",
    "employee_name": "John Smith",
    "employee_email": "john@softaware.net.za",
    "pay_month": 3,
    "pay_year": 2026,
    "gross_salary_cents": 3500000,
    "total_deductions_cents": 810000,
    "total_allowances_cents": 150000,
    "net_salary_cents": 2840000,
    "deductions_snapshot": [
      {"type": "paye", "label": "PAYE Tax", "amount_cents": 525000},
      {"type": "uif", "label": "UIF", "amount_cents": 35000},
      {"type": "medical_aid", "label": "Medical Aid", "amount_cents": 250000}
    ],
    "allowances_snapshot": [
      {"type": "travel", "label": "Travel Allowance", "amount_cents": 150000}
    ],
    "company_name": "Soft Aware (Pty) Ltd",
    "company_address": "123 Main Street, Cape Town, 8001",
    "status": "generated",
    "generated_by": "admin-uuid",
    "generated_at": "2026-03-16T12:00:00.000Z"
  }
}
```

---

### 7.3 GET /api/admin/payroll/payslips/:id/pdf

**Purpose:** Download a payslip as a PDF document.

**Authentication:** Required (Admin role)

**Success Response (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="PS-2026-03-001.pdf"`

**PDF Layout:**
```
┌─────────────────────────────────────────────┐
│              COMPANY NAME                    │
│           Company Address                    │
│      Reg No: xxx    Tax No: xxx              │
│─────────────────────────────────────────────│
│                  PAYSLIP                      │
│         Pay Period: March 2026               │
│         Reference: PS-2026-03-001            │
│─────────────────────────────────────────────│
│  Employee: John Smith                        │
│  Email:    john@softaware.net.za             │
│  ID No:    9001015800085                     │
│  Tax No:   0123456789                        │
│─────────────────────────────────────────────│
│  EARNINGS                                    │
│  Basic Salary             R 35,000.00        │
│─────────────────────────────────────────────│
│  DEDUCTIONS                                  │
│  PAYE Tax                 R  5,250.00        │
│  UIF                      R    350.00        │
│  Medical Aid              R  2,500.00        │
│  Total Deductions         R  8,100.00        │
│─────────────────────────────────────────────│
│  ALLOWANCES                                  │
│  Travel Allowance         R  1,500.00        │
│  Total Allowances         R  1,500.00        │
│─────────────────────────────────────────────│
│  NET PAY                  R 28,400.00        │
│─────────────────────────────────────────────│
│  Banking: FNB ****5678 (Cheque)              │
│  Generated: 2026-03-16 12:00                 │
└─────────────────────────────────────────────┘
```

---

### 7.4 DELETE /api/admin/payroll/payslips/:id

**Purpose:** Void a payslip. The record is kept for audit but marked as voided.

**Authentication:** Required (Admin role)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payslip voided successfully"
}
```

---

## 8. Summary Route (Admin)

### 8.1 GET /api/admin/payroll/summary

**Purpose:** Get aggregated payroll summary for a given month/year.

**Authentication:** Required (Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | integer | No | Month (1–12), defaults to current month |
| `year` | integer | No | Year, defaults to current year |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "March 2026",
    "month": 3,
    "year": 2026,
    "staff_count": 8,
    "payslips_generated": 8,
    "total_gross_cents": 28000000,
    "total_deductions_cents": 6480000,
    "total_allowances_cents": 1200000,
    "total_net_cents": 22720000,
    "breakdown": [
      {
        "user_id": "uuid-001",
        "employee_name": "John Smith",
        "gross_salary_cents": 3500000,
        "total_deductions_cents": 810000,
        "total_allowances_cents": 150000,
        "net_salary_cents": 2840000,
        "reference_number": "PS-2026-03-001"
      }
    ]
  }
}
```

---

## 9. Staff Self-Service Routes

**Source file:** `src/routes/staffPayroll.ts`  
**Middleware:** `requireAuth` + `requireStaff` (no admin required)

All staff routes are scoped to the authenticated user only (`WHERE user_id = req.user.id`).

### 9.1 GET /api/staff/payroll/profile

**Purpose:** View own payroll profile with masked banking details. Staff cannot see unmasked account numbers.

**Authentication:** Required (Staff role)

**Request:**
```bash
curl https://api.softaware.net.za/api/staff/payroll/profile \
  -H "Authorization: Bearer <staff-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "employment_date": "2025-06-15",
    "id_number": "900101****085",
    "tax_number": "0123456789",
    "bank_name": "FNB",
    "branch_code": "250655",
    "account_number_masked": "****5678",
    "account_type": "cheque",
    "account_holder_name": "John Smith",
    "has_pending_banking_request": false
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | No profile | `{"error": "Payroll profile not yet created. Please contact admin."}` |

---

### 9.2 GET /api/staff/payroll/payslips

**Purpose:** List own payslips. Staff can only see their own payslips.

**Authentication:** Required (Staff role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | integer | No | Filter by year (defaults to current year) |

**Request:**
```bash
curl https://api.softaware.net.za/api/staff/payroll/payslips \
  -H "Authorization: Bearer <staff-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-payslip-001",
      "reference_number": "PS-2026-03-001",
      "pay_month": 3,
      "pay_year": 2026,
      "gross_salary_cents": 3500000,
      "total_deductions_cents": 810000,
      "total_allowances_cents": 150000,
      "net_salary_cents": 2840000,
      "status": "generated",
      "generated_at": "2026-03-16T12:00:00.000Z"
    },
    {
      "id": "uuid-payslip-002",
      "reference_number": "PS-2026-02-003",
      "pay_month": 2,
      "pay_year": 2026,
      "gross_salary_cents": 3500000,
      "total_deductions_cents": 810000,
      "total_allowances_cents": 150000,
      "net_salary_cents": 2840000,
      "status": "generated",
      "generated_at": "2026-02-01T08:00:00.000Z"
    }
  ]
}
```

---

### 9.3 GET /api/staff/payroll/payslips/:id/pdf

**Purpose:** Download own payslip as PDF. The payslip must belong to the authenticated staff member.

**Authentication:** Required (Staff role)

**Request:**
```bash
curl https://api.softaware.net.za/api/staff/payroll/payslips/uuid-payslip-001/pdf \
  -H "Authorization: Bearer <staff-token>" \
  -o my_payslip.pdf
```

**Success Response (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="PS-2026-03-001.pdf"`

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Payslip not found or not yours | `{"error": "Payslip not found"}` |
| 400 | Payslip voided | `{"error": "Cannot download a voided payslip"}` |

**Security:** Backend enforces `WHERE id = ? AND user_id = req.user.id` — staff cannot access other users' payslips.

---

### 9.4 POST /api/staff/payroll/banking-request

**Purpose:** Submit a request to update banking details. The request enters a `pending` state and must be approved by an admin before it takes effect.

**Authentication:** Required (Staff role)

**Request Body:**
```json
{
  "bank_name": "Capitec",
  "branch_code": "470010",
  "account_number": "1234567890",
  "account_type": "savings",
  "account_holder_name": "John Smith"
}
```

**Field Definitions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bank_name` | string | **Yes** | Bank name |
| `branch_code` | string | **Yes** | Branch/universal code |
| `account_number` | string | **Yes** | Account number (encrypted on store) |
| `account_type` | string | **Yes** | `cheque`, `savings`, or `transmission` |
| `account_holder_name` | string | **Yes** | Name on the account |

**Validation Rules:**
- All five banking fields are required
- Staff member must have an existing payroll profile
- No other `pending` request can exist for this staff member

**Success Response (201):**
```json
{
  "success": true,
  "message": "Banking change request submitted for admin approval",
  "data": {
    "id": "uuid-req-001",
    "status": "pending",
    "created_at": "2026-03-16T14:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing fields | `{"error": "All banking fields are required"}` |
| 400 | No payroll profile | `{"error": "Payroll profile not yet created. Please contact admin."}` |
| 409 | Pending request exists | `{"error": "You already have a pending banking change request. Please wait for admin review."}` |

---

### 9.5 GET /api/staff/payroll/banking-request

**Purpose:** View the status of the staff member's most recent banking change request.

**Authentication:** Required (Staff role)

**Request:**
```bash
curl https://api.softaware.net.za/api/staff/payroll/banking-request \
  -H "Authorization: Bearer <staff-token>"
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req-001",
    "bank_name": "Capitec",
    "branch_code": "470010",
    "account_number_masked": "****7890",
    "account_type": "savings",
    "account_holder_name": "John Smith",
    "status": "pending",
    "rejection_reason": null,
    "created_at": "2026-03-16T14:00:00.000Z",
    "reviewed_at": null
  }
}
```

**Rejected example:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-req-001",
    "bank_name": "Capitec",
    "branch_code": "470010",
    "account_number_masked": "****7890",
    "account_type": "savings",
    "account_holder_name": "John Smith",
    "status": "rejected",
    "rejection_reason": "Branch code does not match the selected bank",
    "created_at": "2026-03-10T14:00:00.000Z",
    "reviewed_at": "2026-03-11T09:00:00.000Z"
  }
}
```

**Note:** Staff sees `account_number_masked` (last 4 digits), never the full number.

---

## 10. Zod Validation Schemas

```typescript
// Staff payroll profile (admin creates)
const setProfileSchema = z.object({
  employment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // ISO date required
  id_number: z.string().optional(),
  tax_number: z.string().optional(),
  bank_name: z.string().optional(),
  branch_code: z.string().optional(),
  account_number: z.string().optional(),
  account_type: z.enum(['cheque', 'savings', 'transmission']).optional(),
  account_holder_name: z.string().optional(),
}).refine(data => {
  // Banking fields are all-or-nothing
  const bankingFields = [data.bank_name, data.branch_code, data.account_number, data.account_type, data.account_holder_name];
  const hasAny = bankingFields.some(f => f !== undefined);
  const hasAll = bankingFields.every(f => f !== undefined);
  return !hasAny || hasAll;
}, { message: 'All banking fields must be provided together' });

// Banking change request (staff submits)
const bankingRequestSchema = z.object({
  bank_name: z.string().min(1),
  branch_code: z.string().min(1),
  account_number: z.string().min(1),
  account_type: z.enum(['cheque', 'savings', 'transmission']),
  account_holder_name: z.string().min(1),
});

// Rejection reason
const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

// Salary deduction/allowance line item
const lineItemSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  amount_cents: z.number().int().min(0),
  sort_order: z.number().int().optional(),
});

// Set/update salary
const setSalarySchema = z.object({
  gross_salary_cents: z.number().int().positive(),
  effective_from: z.string().optional(),
  notes: z.string().optional(),
  deductions: z.array(lineItemSchema).optional().default([]),
  allowances: z.array(lineItemSchema).optional().default([]),
});

// Generate single payslip
const generatePayslipSchema = z.object({
  user_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  overwrite: z.boolean().optional().default(false),
});

// Generate bulk payslips
const generateBulkSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  overwrite: z.boolean().optional().default(false),
});
```

---

## 11. Error Codes Reference

| Status | Code | When |
|--------|------|------|
| 400 | Bad Request | Invalid input, future month, wrong year, missing employment date, partial banking fields |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Non-admin accessing admin routes, non-staff accessing staff routes |
| 404 | Not Found | Staff member, profile, salary, payslip, or banking request not found |
| 409 | Conflict | Payslip already exists, pending banking request exists |
| 500 | Internal Server Error | Unexpected server error |

---

**Document Status**: ✅ Complete  
**Review Cycle**: Quarterly  
**Next Review**: 2026-06-16
