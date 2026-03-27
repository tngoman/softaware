# Payroll Module — API Routes

**Base URL:** `https://api.softaware.net.za/api`  
**Total endpoints:** 34 (18 admin payroll + 8 admin leave + 5 staff payroll + 3 staff leave)

---

## 1. Admin Endpoints

**Prefix:** `/admin/payroll`  
**Middleware:** `requireAuth → requireAdmin`  
**Audit:** All routes pass through `auditLogger` (mounted in app.ts)

### 1.1 Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/payroll/profiles` | List all staff/admin users with payroll profile status |
| GET | `/admin/payroll/profiles/:userId` | Get single user's payroll profile (decrypted banking) |
| PUT | `/admin/payroll/profiles/:userId` | Create or update payroll profile |

#### GET `/admin/payroll/profiles`

**Request:** No parameters

**Response:**
```json
{
  "data": [
    {
      "user_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "is_admin": 1,
      "is_staff": 0,
      "profile_id": 5,
      "employment_date": "2023-01-15",
      "bank_name": "Standard Bank",
      "profile_complete": true,
      "has_pending_banking_request": false
    },
    {
      "user_id": 2,
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane@example.com",
      "is_admin": 0,
      "is_staff": 1,
      "profile_id": null,
      "employment_date": null,
      "bank_name": null,
      "profile_complete": false,
      "has_pending_banking_request": false
    }
  ]
}
```

**Notes:**
- Returns all users with `is_staff = 1 OR is_admin = 1`
- Uses explicit column aliases to avoid LEFT JOIN column shadowing
- `profile_complete` derived from presence of all required banking + employment fields

---

#### GET `/admin/payroll/profiles/:userId`

**Request:**
```
GET /api/admin/payroll/profiles/1
```

**Response:**
```json
{
  "data": {
    "id": 5,
    "user_id": 1,
    "employment_date": "2023-01-15",
    "id_number": "9001015800083",
    "tax_number": "0123456789",
    "bank_name": "Standard Bank",
    "branch_code": "051001",
    "account_number": "123456789",
    "account_type": "cheque",
    "account_holder_name": "John Doe",
    "created_at": "2025-03-17T10:00:00.000Z",
    "updated_at": "2025-03-17T10:00:00.000Z"
  }
}
```

**Notes:**
- Bank account number is **decrypted** for admin view
- Returns 404 if user doesn't exist or is not staff/admin

**Error responses:**
```json
{ "error": "Staff member not found" }          // 404
{ "error": "Payroll profile not found" }         // 404
```

---

#### PUT `/admin/payroll/profiles/:userId`

**Request:**
```json
{
  "employment_date": "2023-01-15",
  "id_number": "9001015800083",
  "tax_number": "0123456789",
  "bank_name": "Standard Bank",
  "branch_code": "051001",
  "account_number": "123456789",
  "account_type": "cheque",
  "account_holder_name": "John Doe"
}
```

**Validation (Zod):** All fields optional strings/null. Banking fields validated as all-or-nothing group.

**Response:**
```json
{
  "data": { /* full profile object */ }
}
```

**Error responses:**
```json
{ "error": "Staff member not found" }                                    // 404
{ "error": "All banking fields must be provided together or left empty" } // 400
{ "error": "Validation error: ..." }                                     // 400
```

---

### 1.2 Salaries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/payroll/salaries/:userId` | Get current salary config with line items |
| PUT | `/admin/payroll/salaries/:userId` | Create or update salary configuration |
| DELETE | `/admin/payroll/salaries/:userId` | Delete salary and all line items |
| GET | `/admin/payroll/salaries/:userId/history` | Get salary history (from payslip snapshots) |

#### GET `/admin/payroll/salaries/:userId`

**Response:**
```json
{
  "data": {
    "id": 10,
    "user_id": 1,
    "gross_salary_cents": 2500000,
    "effective_from": "2025-01-01",
    "notes": "2025 salary adjustment",
    "total_deductions_cents": 250000,
    "total_allowances_cents": 100000,
    "net_salary_cents": 2350000,
    "deductions": [
      { "id": 1, "type": "deduction", "label": "PAYE Tax", "amount_cents": 200000 },
      { "id": 2, "type": "deduction", "label": "UIF", "amount_cents": 50000 }
    ],
    "allowances": [
      { "id": 3, "type": "allowance", "label": "Transport", "amount_cents": 100000 }
    ],
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-03-17T10:00:00.000Z"
  }
}
```

**Notes:**
- `net_salary_cents` = `gross_salary_cents` − `total_deductions_cents` + `total_allowances_cents`
- Returns `{ data: null }` if no salary configured

---

#### PUT `/admin/payroll/salaries/:userId`

**Request:**
```json
{
  "gross_salary_cents": 2500000,
  "effective_from": "2025-01-01",
  "notes": "Annual increase",
  "deductions": [
    { "type": "deduction", "label": "PAYE Tax", "amount_cents": 200000 },
    { "type": "deduction", "label": "UIF", "amount_cents": 50000 }
  ],
  "allowances": [
    { "type": "allowance", "label": "Transport", "amount_cents": 100000 }
  ]
}
```

**Validation (Zod):**
- `gross_salary_cents`: number (required)
- `effective_from`: string date (required)
- `notes`: optional string
- `deductions`: array of `{ type, label, amount_cents }`
- `allowances`: array of `{ type, label, amount_cents }`

**Response:** Same shape as GET

**Implementation:** Uses MySQL transaction — deletes old line items, inserts salary, inserts new line items.

---

#### DELETE `/admin/payroll/salaries/:userId`

**Response:**
```json
{ "message": "Salary deleted" }
```

---

#### GET `/admin/payroll/salaries/:userId/history`

**Response:**
```json
{
  "data": [
    {
      "pay_month": 3,
      "pay_year": 2025,
      "gross_salary_cents": 2500000,
      "net_salary_cents": 2350000,
      "reference": "PS-2025-03-A1B2C3"
    }
  ]
}
```

**Notes:** Derived from existing payslip records (snapshot data).

---

### 1.3 Payslips

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/payroll/payslips/generate` | Generate single payslip |
| POST | `/admin/payroll/payslips/generate-bulk` | Generate payslips for all eligible staff |
| GET | `/admin/payroll/payslips` | List payslips (filterable) |
| GET | `/admin/payroll/payslips/:id` | Get single payslip details |
| GET | `/admin/payroll/payslips/:id/pdf` | Download payslip PDF |
| DELETE | `/admin/payroll/payslips/:id` | Void a payslip |

#### POST `/admin/payroll/payslips/generate`

**Request:**
```json
{
  "user_id": 1,
  "pay_month": 3,
  "pay_year": 2025
}
```

**Validation (Zod):**
- `user_id`: number
- `pay_month`: number (1-12)
- `pay_year`: number

**Response:**
```json
{
  "data": {
    "id": 15,
    "user_id": 1,
    "pay_month": 3,
    "pay_year": 2025,
    "gross_salary_cents": 2500000,
    "total_deductions_cents": 250000,
    "total_allowances_cents": 100000,
    "net_salary_cents": 2350000,
    "deductions_json": "[{\"label\":\"PAYE Tax\",\"amount_cents\":200000}]",
    "allowances_json": "[{\"label\":\"Transport\",\"amount_cents\":100000}]",
    "reference": "PS-2025-03-A1B2C3",
    "status": "active",
    "generated_by": 1,
    "created_at": "2025-03-17T10:00:00.000Z"
  }
}
```

**Business rules enforced:**
1. User must be staff/admin — 404 otherwise
2. User must have a payroll profile — 404 otherwise
3. User must have `employment_date` set — 400 otherwise
4. Year must be current year — 400 otherwise
5. Month must not be in the future — 400 otherwise
6. Month must be ≥ employment date — 400 otherwise
7. Month must be ≥ salary effective_from date — 400 otherwise
8. Unique constraint: one payslip per user per month/year — 409 duplicate key

---

#### POST `/admin/payroll/payslips/generate-bulk`

**Request:**
```json
{
  "pay_month": 3,
  "pay_year": 2025
}
```

**Response:**
```json
{
  "data": {
    "generated": 3,
    "skipped": 2,
    "errors": [
      { "user_id": 4, "error": "No salary configured" }
    ]
  }
}
```

**Notes:** Iterates all staff/admin users. Skips users without profiles or salaries. Continues on individual errors.

---

#### GET `/admin/payroll/payslips`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `user_id` | number | Filter by user |
| `pay_month` | number | Filter by month |
| `pay_year` | number | Filter by year |
| `status` | string | Filter by status (`active` / `voided`) |

**Response:**
```json
{
  "data": [
    {
      "id": 15,
      "user_id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "pay_month": 3,
      "pay_year": 2025,
      "gross_salary_cents": 2500000,
      "net_salary_cents": 2350000,
      "reference": "PS-2025-03-A1B2C3",
      "status": "active",
      "created_at": "2025-03-17T10:00:00.000Z"
    }
  ]
}
```

---

#### GET `/admin/payroll/payslips/:id`

**Response:** Single payslip object (same shape as generate response, with JOIN to users for name)

---

#### GET `/admin/payroll/payslips/:id/pdf`

**Response:** `application/pdf` binary stream

**Headers set:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="payslip-PS-2025-03-A1B2C3.pdf"
```

**Notes:**
- Generates PDF on-the-fly via Puppeteer using `generatePayslipPdfBuffer()`
- Includes company branding from `app_settings` table
- A4 portrait format

---

#### DELETE `/admin/payroll/payslips/:id`

**Response:**
```json
{ "message": "Payslip voided" }
```

**Notes:** Sets `status = 'voided'`. Does not delete the record.

---

### 1.4 Banking Requests

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/payroll/banking-requests` | List all banking change requests |
| POST | `/admin/payroll/banking-requests/:id/approve` | Approve a banking request |
| POST | `/admin/payroll/banking-requests/:id/reject` | Reject a banking request |

#### GET `/admin/payroll/banking-requests`

**Response:**
```json
{
  "data": [
    {
      "id": 3,
      "user_id": 2,
      "first_name": "Jane",
      "last_name": "Smith",
      "bank_name": "FNB",
      "branch_code": "250655",
      "account_number": "62123456789",
      "account_type": "savings",
      "account_holder_name": "Jane Smith",
      "status": "pending",
      "created_at": "2025-03-17T10:00:00.000Z",
      "reviewed_by": null,
      "reviewed_at": null,
      "rejection_reason": null
    }
  ]
}
```

---

#### POST `/admin/payroll/banking-requests/:id/approve`

**Request:** No body

**Response:**
```json
{ "message": "Banking request approved" }
```

**Side effect:** Updates the user's payroll profile with the requested banking details (encrypts account number).

---

#### POST `/admin/payroll/banking-requests/:id/reject`

**Request:**
```json
{
  "reason": "Account details could not be verified"
}
```

**Validation (Zod):** `reason` — non-empty string

**Response:**
```json
{ "message": "Banking request rejected" }
```

---

### 1.5 Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/payroll/summary` | Get monthly payroll summary |

#### GET `/admin/payroll/summary`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `month` | number | Month (1-12) |
| `year` | number | Year |

**Response:**
```json
{
  "data": {
    "total_staff": 5,
    "staff_paid": 3,
    "total_gross_cents": 7500000,
    "total_deductions_cents": 750000,
    "total_allowances_cents": 300000,
    "total_net_cents": 7050000
  }
}
```

---

## 2. Staff Endpoints

**Prefix:** `/staff/payroll`  
**Middleware:** `requireAuth → requireStaff`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/staff/payroll/profile` | Get own payroll profile (masked) |
| GET | `/staff/payroll/payslips` | List own payslips |
| GET | `/staff/payroll/payslips/:id/pdf` | Download own payslip PDF |
| POST | `/staff/payroll/banking-request` | Submit banking change request |
| GET | `/staff/payroll/banking-request` | Get latest banking request status |

#### GET `/staff/payroll/profile`

**Response:**
```json
{
  "data": {
    "id": 5,
    "user_id": 1,
    "employment_date": "2023-01-15",
    "id_number": "****0083",
    "tax_number": "****6789",
    "bank_name": "Standard Bank",
    "branch_code": "051001",
    "account_number": "****6789",
    "account_type": "cheque",
    "account_holder_name": "John Doe"
  }
}
```

**Notes:**
- Account number **masked**: only last 4 digits visible
- ID number and tax number also partially masked
- Returns 404 if no profile exists

---

#### GET `/staff/payroll/payslips`

**Response:**
```json
{
  "data": [
    {
      "id": 15,
      "pay_month": 3,
      "pay_year": 2025,
      "gross_salary_cents": 2500000,
      "net_salary_cents": 2350000,
      "reference": "PS-2025-03-A1B2C3",
      "status": "active",
      "created_at": "2025-03-17T10:00:00.000Z"
    }
  ]
}
```

---

#### GET `/staff/payroll/payslips/:id/pdf`

**Response:** `application/pdf` binary stream

**Notes:** Ownership enforced — only returns PDF if payslip belongs to `req.userId`.

---

#### POST `/staff/payroll/banking-request`

**Request:**
```json
{
  "bank_name": "FNB",
  "branch_code": "250655",
  "account_number": "62123456789",
  "account_type": "savings",
  "account_holder_name": "Jane Smith"
}
```

**Response:**
```json
{
  "data": {
    "id": 3,
    "user_id": 2,
    "bank_name": "FNB",
    "branch_code": "250655",
    "account_number": "62123456789",
    "account_type": "savings",
    "account_holder_name": "Jane Smith",
    "status": "pending",
    "created_at": "2025-03-17T10:00:00.000Z"
  }
}
```

**Error responses:**
```json
{ "error": "Payroll profile not found" }                         // 404
{ "error": "You already have a pending banking change request" }  // 409
```

---

#### GET `/staff/payroll/banking-request`

**Response:**
```json
{
  "data": {
    "id": 3,
    "status": "pending",
    "bank_name": "FNB",
    "branch_code": "250655",
    "account_type": "savings",
    "account_holder_name": "Jane Smith",
    "created_at": "2025-03-17T10:00:00.000Z",
    "reviewed_at": null,
    "rejection_reason": null
  }
}
```

**Notes:** Returns the latest banking request (most recent by `created_at`). Returns `{ data: null }` if no requests.

---

## 3. Admin Leave Endpoints

**Prefix:** `/admin/leave`  
**Middleware:** `requireAuth → requireAdmin`  
**Router file:** `src/routes/adminLeave.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/leave/balances` | List all staff leave balances (all users) |
| GET | `/admin/leave/balances/:userId` | Get leave balances for a specific user |
| PUT | `/admin/leave/balances/:balanceId` | Update entitlement for a specific balance |
| GET | `/admin/leave/requests` | List all pending leave requests |
| GET | `/admin/leave/requests/:userId` | List leave requests for a specific user |
| POST | `/admin/leave/requests` | Submit a leave request on behalf of a staff member |
| PUT | `/admin/leave/requests/:requestId` | Approve or reject a leave request |

### GET `/admin/leave/balances`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `year` | number | Cycle year (defaults to current year) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "user_id": "user-uuid",
      "leave_type": "annual",
      "cycle_year": 2026,
      "entitled_days": 15,
      "used_days": 3,
      "pending_days": 2,
      "remaining_days": 10,
      "employee_name": "John Doe",
      "employee_email": "john@example.com"
    }
  ]
}
```

### PUT `/admin/leave/balances/:balanceId`

**Request:**
```json
{ "entitled_days": 20 }
```

**Validation:** `entitled_days` must be a positive number and cannot be less than `used_days`.

### PUT `/admin/leave/requests/:requestId`

**Request (approve):**
```json
{ "action": "approve" }
```

**Request (reject):**
```json
{ "action": "reject", "rejection_reason": "Insufficient documentation" }
```

**Side effects:**
- Approve: moves days from `pending_days` to `used_days` in `leave_balances`
- Reject: releases `pending_days` back to `remaining_days`

---

## 4. Staff Leave Endpoints

**Prefix:** `/staff/leave`  
**Middleware:** `requireAuth → requireStaff`  
**Router file:** `src/routes/staffLeave.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/staff/leave/balances` | Get own leave balances for a year |
| GET | `/staff/leave/requests` | List own leave requests |
| POST | `/staff/leave/requests` | Submit a new leave request |

### GET `/staff/leave/balances`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `year` | number | Cycle year (defaults to current year) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "user_id": "user-uuid",
      "leave_type": "annual",
      "cycle_year": 2026,
      "entitled_days": 15,
      "used_days": 3,
      "pending_days": 2,
      "remaining_days": 10
    },
    {
      "id": "def456",
      "user_id": "user-uuid",
      "leave_type": "sick",
      "cycle_year": 2026,
      "entitled_days": 30,
      "used_days": 0,
      "pending_days": 0,
      "remaining_days": 30
    }
  ]
}
```

**Notes:**
- Auto-creates balance rows with SA default entitlements if none exist for the year
- Returns all 5 leave types ordered: annual, sick, family_responsibility, maternity, parental
- Scoped to `req.userId` — staff can only see their own balances

### GET `/staff/leave/requests`

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `pending`, `approved`, `rejected`, `cancelled` |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "req-uuid",
      "user_id": "user-uuid",
      "leave_type": "annual",
      "start_date": "2026-04-01",
      "end_date": "2026-04-05",
      "days": 5,
      "reason": "Family holiday",
      "status": "pending",
      "approved_by": null,
      "approved_at": null,
      "rejection_reason": null,
      "created_at": "2026-03-18T10:00:00.000Z",
      "employee_name": "John Doe",
      "employee_email": "john@example.com",
      "reviewer_name": null
    }
  ]
}
```

**Notes:**
- Scoped to `req.userId` — staff can only see their own requests
- Includes joined fields: `employee_name`, `employee_email`, `reviewer_name`
- Joins on `approved_by` to get reviewer name

### POST `/staff/leave/requests`

**Request:**
```json
{
  "leave_type": "annual",
  "start_date": "2026-04-01",
  "end_date": "2026-04-05",
  "reason": "Family holiday"
}
```

**Validation (Zod):**
- `leave_type`: enum `annual | sick | family_responsibility | maternity | parental`
- `start_date`: string matching `YYYY-MM-DD`
- `end_date`: string matching `YYYY-MM-DD`
- `reason`: optional string

**Business rules enforced:**
1. End date must not be before start date — 400
2. Must have at least 1 working day (Mon-Fri) in range — 400
3. Leave balance must exist for the leave type + year — 400
4. Sufficient remaining days (`remaining_days >= requested days`) — 400
5. No overlapping pending/approved requests for the same dates — 400

**Side effects:**
- Creates `leave_requests` row with `status = 'pending'`
- Increments `pending_days` on the matching `leave_balances` row

**Response:**
```json
{
  "success": true,
  "message": "Leave request submitted",
  "data": { /* leave request object */ }
}
```

**Error responses:**
```json
{ "message": "Insufficient Annual Leave balance. Available: 10 days, Requested: 15 days" }  // 400
{ "message": "There is already an overlapping leave request for these dates" }                // 400
{ "message": "End date cannot be before start date" }                                        // 400
```

---

## 3. Error Response Format

All endpoints return errors in a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

**HTTP status codes used:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Validation error (Zod) or business rule violation |
| 401 | Not authenticated (no/invalid JWT) |
| 403 | Not authorized (not admin / not staff) |
| 404 | Resource not found (user, profile, salary, payslip) |
| 409 | Conflict (duplicate payslip for period, pending banking request exists) |
| 500 | Internal server error |

---

## 4. Authentication

All endpoints require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

The JWT is verified by `requireAuth` middleware, which sets `req.userId` and `req.userEmail` on the request object. Admin routes additionally verify `is_admin = 1` via `requireAdmin`. Staff routes verify `is_staff = 1` via `requireStaff`.

---

## 5. cURL Examples

### List profiles (admin)
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.softaware.net.za/api/admin/payroll/profiles | jq
```

### Save profile (admin)
```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employment_date":"2023-01-15","bank_name":"Standard Bank","branch_code":"051001","account_number":"123456789","account_type":"cheque","account_holder_name":"John Doe"}' \
  https://api.softaware.net.za/api/admin/payroll/profiles/1 | jq
```

### Generate payslip (admin)
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"pay_month":3,"pay_year":2025}' \
  https://api.softaware.net.za/api/admin/payroll/payslips/generate | jq
```

### Download payslip PDF (admin)
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  -o payslip.pdf \
  https://api.softaware.net.za/api/admin/payroll/payslips/15/pdf
```

### Staff view own profile
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.softaware.net.za/api/staff/payroll/profile | jq
```

### Staff submit banking request
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bank_name":"FNB","branch_code":"250655","account_number":"62123456789","account_type":"savings","account_holder_name":"Jane Smith"}' \
  https://api.softaware.net.za/api/staff/payroll/banking-request | jq
```
