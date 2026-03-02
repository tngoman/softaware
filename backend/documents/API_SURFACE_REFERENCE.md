# SoftAwareCode — Complete Backend API Surface Reference

> **Generated:** March 2026  
> **Backend:** `/var/opt/backend` — Express.js + TypeScript + MySQL  
> **Base URLs:** All routes are mounted on **both** `/api/*` and `/*` (see `app.ts` dual-mount pattern)  
> **Auth tokens:** `Authorization: Bearer <JWT>`

---

## Table of Contents

1. [Route Mount Map (app.ts)](#1-route-mount-map)
2. [Business / Billing Domain](#2-business--billing-domain)
   - 2.1 Contacts
   - 2.2 Quotations
   - 2.3 Invoices
   - 2.4 Payments
   - 2.5 Accounting (Accounts, Transactions, Ledger, Tax Rates)
   - 2.6 Pricing
   - 2.7 Categories
   - 2.8 Expense Categories
3. [Dashboards](#3-dashboards)
   - 3.1 User Dashboard
   - 3.2 Admin Dashboard
4. [Financial Reports](#4-financial-reports)
   - 4.1 Financial Reports (Balance Sheet, P&L, Transaction Listing)
   - 4.2 Reports (Trial Balance, VAT, Income Statement)
   - 4.3 VAT Reports (VAT201, ITR14, IRP6)
5. [Settings & Configuration](#5-settings--configuration)
   - 5.1 App Settings
   - 5.2 Settings
6. [Notifications](#6-notifications)
7. [System Administration](#7-system-administration)
   - 7.1 System Credentials
   - 7.2 Groups (Chat)
   - 7.3 Database Manager
8. [Updates System](#8-updates-system)
   - 8.1 Software CRUD
   - 8.2 Update Releases CRUD
   - 8.3 Modules & Developer Assignments
   - 8.4 Clients (Connected Desktops)
   - 8.5 File Upload & Download
   - 8.6 Heartbeat
   - 8.7 Misc (Info, Dashboard, Status, Password Reset)
9. [Softaware Tasks (Proxy)](#9-softaware-tasks-proxy)

---

## 1. Route Mount Map

From `app.ts`, the `apiRouter` is mounted at both `/api` and `/`:

| Mount Path | Router | File |
|---|---|---|
| `/contacts` | contactsRouter | contacts.ts |
| `/quotations` | quotationsRouter | quotations.ts |
| `/invoices` | invoicesRouter | invoices.ts |
| `/payments` | paymentsRouter | payments.ts |
| `/accounting` | accountingRouter | accounting.ts |
| `/` | accountingRouter | accounting.ts *(alias — `/accounts`, `/transactions`, `/ledger` at root)* |
| `/pricing` | pricingRouter | pricing.ts |
| `/categories` | categoriesRouter | categories.ts |
| `/expense-categories` | expenseCategoriesRouter | expenseCategories.ts |
| `/financial-reports` | financialReportsRouter | financialReports.ts |
| `/reports` | reportsRouter | reports.ts |
| `/vat-reports` | vatReportsRouter | vatReports.ts |
| `/app-settings` | appSettingsRouter | appSettings.ts |
| `/settings` | settingsRouter | settings.ts |
| `/notifications` | notificationsRouter | notifications.ts |
| `/credentials` | credentialsRouter | systemCredentials.ts |
| `/groups` | groupsRouter | groups.ts |
| `/database` | databaseManagerRouter | databaseManager.ts |
| `/dashboard` | dashboardRouter | dashboard.ts |
| `/admin/dashboard` | adminDashboardRouter | adminDashboard.ts |
| `/softaware/tasks` | softawareTasksRouter | softawareTasks.ts |
| `/softaware/software` | updSoftwareRouter | updSoftware.ts |
| `/softaware/modules` | updModulesRouter | updModules.ts |
| `/updates/software` | updSoftwareRouter | updSoftware.ts |
| `/updates/updates` | updUpdatesRouter | updUpdates.ts |
| `/updates` | updFilesRouter | updFiles.ts *(handles `/updates/upload` & `/updates/download`)* |
| `/updates/heartbeat` | updHeartbeatRouter | updHeartbeat.ts |
| `/updates/clients` | updClientsRouter | updClients.ts |
| `/updates/modules` | updModulesRouter | updModules.ts |
| `/updates` | updMiscRouter | updMisc.ts *(handles `/updates/info`, `/updates/dashboard`, etc.)* |

---

## 2. Business / Billing Domain

### 2.1 Contacts

#### `GET /api/contacts`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50&search=term`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "contact_id": 1,
      "contact_name": "Acme Corp",
      "contact_person": "John",
      "contact_address": "...",
      "contact_email": "...",
      "contact_phone": "...",
      "contact_alt_phone": "...",
      "contact_notes": "...",
      "website": "...",
      "contact_code": "...",
      "active": 1,
      "contact_type": 1
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 120 }
}
```

#### `GET /api/contacts/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { contact_id, contact_name, ... } }`

#### `POST /api/contacts`
- **Auth:** requireAuth
- **Body:** `{ company_name: string (required), contact_person?, email?, phone?, fax?, website?, location?, contact_code?, remarks?, active?: number }`
- **Response:** `201 { success, data: { ...contact } }`

#### `PUT /api/contacts/:id`
- **Auth:** requireAuth
- **Body:** Partial of create schema
- **Response:** `{ success, data: { ...updated contact } }`

#### `DELETE /api/contacts/:id`
- **Auth:** requireAuth
- **Behavior:** Soft delete (`active = 0`)
- **Response:** `{ success, message: "Contact deleted" }`

#### `GET /api/contacts/:id/quotations`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ { quotation_id, quotation_number, quotation_total, quotation_date, quotation_valid_until, contact_name, ... } ] }`

#### `GET /api/contacts/:id/invoices`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ { invoice_id, invoice_number, invoice_total, invoice_date, invoice_due_date, invoice_payment_status, contact_name, ... } ] }`

---

### 2.2 Quotations

#### `GET /api/quotations`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "quotation_id": 1,
      "quotation_contact_id": 5,
      "quotation_number": "Q-001",
      "quotation_total": 5000,
      "quotation_subtotal": 5000,
      "quotation_date": "2026-01-15",
      "quotation_valid_until": "2026-02-14",
      "quotation_user_id": "uuid",
      "quotation_notes": "",
      "quotation_status": 1,
      "quotation_vat": 0,
      "quotation_discount": 0,
      "quotation_time": 1234567890,
      "quotation_updated": 1234567890,
      "contact_name": "Acme Corp",
      "contact_email": "...",
      "contact_phone": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 30 }
}
```

#### `GET /api/quotations/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...quotation, items: [ { item_id, item_quote_id, item_product, item_qty, item_price, item_subtotal, item_discount, item_vat, item_profit, item_cost } ] } }`

#### `POST /api/quotations`
- **Auth:** requireAuth
- **Body:** `{ quotation_number: string, contact_id: number, quotation_amount: number, quotation_date: "YYYY-MM-DD", quotation_user_id?: uuid, remarks?, active?: number }`
- **Validates:** Contact exists, quotation_number unique
- **Response:** `201 { success, data: { ...quotation } }`

#### `PUT /api/quotations/:id`
- **Auth:** requireAuth
- **Body:** Partial (excluding quotation_number)
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/quotations/:id`
- **Auth:** requireAuth
- **Behavior:** Soft delete (`active = 0`)
- **Response:** `{ success, message: "Quotation deleted" }`

#### `POST /api/quotations/:id/items`
- **Auth:** requireAuth
- **Body:** `{ item_description: string, item_price: number, item_quantity?: number (default 1), item_discount?: number (default 0) }`
- **Response:** `201 { success, data: { ...quote_item } }`

#### `DELETE /api/quotations/:id/items/:itemId`
- **Auth:** requireAuth
- **Behavior:** Hard delete
- **Response:** `{ success, message: "Item deleted" }`

#### `POST /api/quotations/:id/generate-pdf`
- **Auth:** requireAuth
- **Body:** *(none)*
- **Behavior:** Generates PDF using `pdfGenerator.ts`, saves to `/public/`
- **Response:** `{ success, filename: "...", path: "/public/..." }`

#### `POST /api/quotations/:id/send-email`
- **Auth:** requireAuth
- **Body:** `{ to: string (required), subject?: string, body?: string }`
- **Behavior:** Sends via SMTP (nodemailer); gracefully falls back if SMTP unconfigured
- **Response:** `{ success, message: "Email sent successfully" | "Email queued (SMTP not fully configured)" }`

#### `POST /api/quotations/:id/convert-to-invoice`
- **Auth:** requireAuth
- **Body:** `{ invoice_number: string (required), invoice_date: string (required), due_date?: string }`
- **Behavior:** Transactional — creates invoice + copies quote_items → invoice_items
- **Response:** `201 { success, message: "Quotation converted to invoice", data: { ...invoice } }`

---

### 2.3 Invoices

#### `GET /api/invoices`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50&paid=0|1`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "invoice_id": 1,
      "invoice_contact_id": 5,
      "invoice_number": "INV-001",
      "invoice_total": 5000,
      "invoice_subtotal": 5000,
      "invoice_vat": 0,
      "invoice_discount": 0,
      "invoice_date": "2026-01-20",
      "invoice_due_date": "2026-02-20",
      "invoice_valid_until": "2026-02-20",
      "invoice_payment_status": 0,
      "invoice_notes": "",
      "invoice_user_id": "uuid",
      "invoice_quote_id": null,
      "invoice_status": 1,
      "contact_name": "Acme Corp",
      "contact_email": "...",
      "contact_phone": "..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 45 }
}
```

#### `GET /api/invoices/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...invoice, items: [...], payments: [...] } }`
  - `items`: `{ item_id, item_invoice_id, item_product, item_qty, item_price, item_subtotal, item_discount, item_vat, item_profit, item_cost }`
  - `payments`: `{ payment_id, payment_date, payment_amount, payment_invoice }`

#### `POST /api/invoices`
- **Auth:** requireAuth
- **Body:** `{ invoice_number: string, contact_id: number, quotation_id?: number, invoice_amount: number, invoice_date: "YYYY-MM-DD", due_date?: "YYYY-MM-DD", remarks?, active?: number }`
- **Validates:** Contact exists, invoice_number unique
- **Response:** `201 { success, data: { ...invoice } }`

#### `PUT /api/invoices/:id`
- **Auth:** requireAuth
- **Body:** Partial (excluding invoice_number)
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/invoices/:id`
- **Auth:** requireAuth
- **Behavior:** Soft delete
- **Response:** `{ success, message: "Invoice deleted" }`

#### `POST /api/invoices/:id/items`
- **Auth:** requireAuth
- **Body:** `{ item_description: string, item_price: number, item_quantity?: number, item_discount?: number }`
- **Response:** `201 { success, data: { ...invoice_item } }`

#### `DELETE /api/invoices/:id/items/:itemId`
- **Auth:** requireAuth
- **Response:** `{ success, message: "Item deleted" }`

#### `POST /api/invoices/:id/payments`
- **Auth:** requireAuth
- **Body:** `{ payment_date: "YYYY-MM-DD", payment_amount: number, payment_method?, reference_number?, remarks? }`
- **Behavior:** Records payment; auto-marks invoice `paid=1` if total payments ≥ invoice amount
- **Response:** `201 { success, data: { ...payment } }`

#### `GET /api/invoices/:id/payments`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ { ...payment } ] }`

#### `POST /api/invoices/:id/generate-pdf`
- **Auth:** requireAuth
- **Response:** `{ success, filename, path }`

#### `POST /api/invoices/:id/send-email`
- **Auth:** requireAuth
- **Body:** `{ to: string, subject?, body? }`
- **Response:** `{ success, message }`

#### `POST /api/invoices/:id/mark-paid`
- **Auth:** requireAuth
- **Body:** *(none)*
- **Behavior:** Sets `paid = 1`
- **Response:** `{ success, message: "Invoice marked as paid" }`

---

### 2.4 Payments

#### `GET /api/payments`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50&search=term&invoice_id=N`
- **Response:**
```json
{
  "success": true,
  "data": [
    {
      "payment_id": 1,
      "payment_invoice": 5,
      "payment_date": "2026-01-25",
      "payment_amount": 2500,
      "payment_method": "EFT",
      "reference_number": "REF-001",
      "payment_notes": "",
      "payment_processed": 0,
      "payment_time": 1234567890,
      "payment_updated": 1234567890,
      "invoice_number": "INV-001"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 80 }
}
```

#### `GET /api/payments/unprocessed`
- **Auth:** requireAuth
- **Query:** `?limit=50&invoice_id=N`
- **Response:** `{ success, data: [ { ...payment, invoice_number, invoice_amount } ] }`

#### `GET /api/payments/invoice/:invoiceId`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ { ...payment } ] }`

#### `GET /api/payments/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...payment } }`

#### `POST /api/payments`
- **Auth:** requireAuth
- **Body:** `{ payment_invoice: number, payment_amount: number, payment_date?, process_payment?: boolean }`
- **Behavior:** Creates payment; auto-marks invoice paid if fully covered
- **Response:** `201 { success, data: { ...payment } }`

#### `PUT /api/payments/:id`
- **Auth:** requireAuth
- **Body:** `{ payment_invoice?, payment_amount?, payment_date?, payment_processed? }`
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/payments/:id`
- **Auth:** requireAuth
- **Behavior:** Hard delete
- **Response:** `{ success, message: "Payment deleted" }`

#### `POST /api/payments/process`
- **Auth:** requireAuth
- **Body:** `{ payment_ids?: number[], invoice_id?: number }` *(at least one required)*
- **Behavior:** Creates `transactions` records (credit entries) for each payment
- **Response:** `{ success, processed: [ { payment_id, transaction_id } ], errors: [ { payment_id, message } ] }`

---

### 2.5 Accounting

Mounted at `/api/accounting/*` **and** aliased at `/api/*` (root), so `/api/accounts` also works.

#### `GET /api/accounting/accounts`
- **Auth:** requireAuth
- **Query:** `?type=asset|liability|equity|income|expense`
- **Response:** `{ success, data: [ { id, account_code, account_name, account_type, account_category, description, active } ] }`

#### `GET /api/accounting/accounts/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...account } }`

#### `POST /api/accounting/accounts`
- **Auth:** requireAuth
- **Body:** `{ account_code: string, account_name: string, account_type: "asset"|"liability"|"equity"|"income"|"expense", account_category?, description?, active?: number }`
- **Validates:** account_code unique
- **Response:** `201 { success, data: { ...account } }`

#### `PUT /api/accounting/accounts/:id`
- **Auth:** requireAuth
- **Body:** Partial of create schema
- **Response:** `{ success, data: { ...updated } }`

#### `GET /api/accounting/accounts/:id/balance`
- **Auth:** requireAuth
- **Response:** `{ success, data: { account_id, account_code, account_name, balance: number } }`

#### `GET /api/accounting/transactions`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50&account_id=N`
- **Response:** `{ success, data: [...transactions], pagination: {...} }`

#### `POST /api/accounting/transactions`
- **Auth:** requireAuth
- **Body:** `{ transaction_date: "YYYY-MM-DD", account_id: number, debit_amount?: number, credit_amount?: number, description?, reference_number? }`
- **Validates:** Account exists
- **Response:** `201 { success, data: { ...transaction } }`

#### `GET /api/accounting/ledger`
- **Auth:** requireAuth
- **Query:** `?account_id=N&page=1&limit=50`
- **Response:** `{ success, data: [...ledger_entries], pagination: {...} }`

#### `GET /api/accounting/tax-rates`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ { id, tax_name, tax_percentage, description, active } ] }`

#### `POST /api/accounting/tax-rates`
- **Auth:** requireAuth
- **Body:** `{ tax_name: string, tax_percentage: number, description?, active?: number }`
- **Response:** `201 { success, data: { ...tax_rate } }`

#### `PUT /api/accounting/tax-rates/:id`
- **Auth:** requireAuth
- **Body:** Partial
- **Response:** `{ success, data: { ...updated } }`

---

### 2.6 Pricing

#### `GET /api/pricing`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=50&category=N&search=term`
- **Response:** `{ success, data: [ { id, category_id, item_name, description, unit_price, category_name } ], pagination: {...} }`

#### `GET /api/pricing/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...pricing_item, category_name } }`

#### `POST /api/pricing`
- **Auth:** requireAuth
- **Body:** `{ item_name: string, unit_price: number, category_id?: number|null, description?: string|null }`
- **Response:** `201 { success, id: number, data: { ...item } }`

#### `PUT /api/pricing/:id`
- **Auth:** requireAuth
- **Body:** Partial
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/pricing/:id`
- **Auth:** requireAuth
- **Behavior:** Hard delete
- **Response:** `{ success, message: "Pricing item deleted" }`

---

### 2.7 Categories

#### `GET /api/categories`
- **Auth:** requireAuth
- **Query:** `?page=0&limit=100&search=term&sortBy=category_name&sortOrder=asc|desc`
- **Note:** Page is **0-indexed** (unlike most other routes which are 1-indexed)
- **Response:** `{ success, data: [ { category_id, category_name, description, created_at, updated_at } ], pagination: { page, limit, total, pages } }`

#### `GET /api/categories/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { category_id, category_name, description, ... } }`

#### `POST /api/categories`
- **Auth:** requireAuth
- **Body:** `{ category_name: string, description?: string|null }`
- **Validates:** category_name unique
- **Response:** `201 { success, data: { ...category } }`

#### `PUT /api/categories/:id`
- **Auth:** requireAuth
- **Body:** Partial
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/categories/:id`
- **Auth:** requireAuth
- **Validates:** Not in use by pricing items
- **Behavior:** Hard delete
- **Response:** `{ success, message: "Category deleted" }`

---

### 2.8 Expense Categories

#### `GET /api/expense-categories`
- **Auth:** requireAuth
- **Query:** `?page=1&limit=100`
- **Response:** `{ success, data: [ { id, category_name, account_id, description, active, account_name, account_code } ], pagination: {...} }`

#### `GET /api/expense-categories/:id`
- **Auth:** requireAuth
- **Response:** `{ success, data: { ...expense_category, account_name, account_code } }`

#### `POST /api/expense-categories`
- **Auth:** requireAuth
- **Body:** `{ category_name: string, account_id?: number|null, description?: string|null, active?: number }`
- **Validates:** category_name unique
- **Response:** `201 { success, id: number, data: { ...category } }`

#### `PUT /api/expense-categories/:id`
- **Auth:** requireAuth
- **Body:** Partial
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/expense-categories/:id`
- **Auth:** requireAuth
- **Behavior:** Soft delete (`active = 0`)
- **Response:** `{ success, message: "Expense category deleted" }`

---

## 3. Dashboards

### 3.1 User Dashboard

#### `GET /api/dashboard/metrics`
- **Auth:** requireAuth
- **Response:**
```json
{
  "messages": { "used": 0, "limit": 500 },
  "pagesIndexed": { "used": 12, "limit": 50 },
  "assistants": { "count": 3, "limit": 5 },
  "tier": "free"
}
```
- **Behavior:** Resolves user's team → subscription → tier limits. Free defaults: 500 msg, 50 pages, 5 assistants.

#### `GET /api/dashboard/stats`
- **Auth:** requireAuth
- **Query:** `?period=today|week|month|quarter|year|all`
- **Response:**
```json
{
  "revenue": { "collected": 50000, "total_invoiced": 75000, "outstanding": 25000, "collection_rate": 67 },
  "profit": { "profit": 30000, "expenses": 20000, "profit_margin": 60 },
  "invoices": { "total_count": 45, "total_amount": 75000, "paid_count": 30, "unpaid_count": 15, "partial_count": 0 },
  "quotations": { "total_count": 20, "accepted_count": 0 },
  "customers": { "customer_count": 50, "supplier_count": 0 },
  "payments": { "total_count": 30, "average_amount": 1666.67 },
  "outstanding": { "current": 10000, "30_days": 8000, "60_days": 5000, "90_plus_days": 2000, "total": 25000 },
  "recent_invoices": [ { "invoice_id", "invoice_number", "invoice_total", "invoice_payment_status", "contact_name", "amount_paid", "outstanding" } ],
  "recent_quotations": [ { "quotation_id", "quotation_number", "quotation_total", "quotation_date", "contact_name" } ]
}
```

---

### 3.2 Admin Dashboard

#### `GET /api/admin/dashboard`
- **Auth:** requireAuth
- **Response:**
```json
{
  "success": true,
  "data": {
    "workspaces": { "total", "active", "inactive", "newThisMonth" },
    "users": { "total" },
    "subscriptions": { "total", "active", "trial", "expired", "pastDue" },
    "software": { "total", "withIntegration", "modules", "releases" },
    "clients": { "total", "online", "offline", "blocked" },
    "ai": { "assistants", "apiKeys", "configurations", "creditsUsed", "creditsBalance", "totalRequests", "usageByType": [{ "type", "count", "credits" }] },
    "websites": { "total", "deployed", "draft", "widgets", "activeWidgets" },
    "leads": { "total", "new", "thisMonth" },
    "activationKeys": { "total", "active", "revoked" },
    "system": { "status": "healthy", "uptime": "5d 12h 30m", "version": "0.2.0" },
    "recentActivity": [ { "id", "type", "description", "actor", "time" } ]
  }
}
```
- **Notable:** Aggregates from `teams`, `users`, `subscriptions`, `update_software`, `update_clients`, `assistants`, `credit_transactions`, `generated_sites`, `widget_clients`, `lead_captures`, `activation_keys`

---

## 4. Financial Reports

### 4.1 Financial Reports (financialReports.ts)

**Notable:** Has dual-mode queries — checks for legacy `tb_transactions`/`tb_invoices`/`tb_payments` tables first, falls back to `accounts`/`transactions` schema.

#### `GET /api/financial-reports/balance-sheet`
- **Auth:** requireAuth
- **Query:** `?as_of_date=YYYY-MM-DD` (defaults to today)
- **Response:**
```json
{
  "as_of_date": "2026-03-01",
  "assets": {
    "current_assets": { "bank": 50000, "accounts_receivable": 25000, "total": 75000 },
    "fixed_assets": { "computer_equipment": 3000, "office_equipment": 2000, "total": 5000 },
    "total_assets": 80000
  },
  "liabilities": {
    "current_liabilities": { "accounts_payable": 0, "sales_tax": 5000, "unpaid_expense_claims": 0, "total": 5000 },
    "total_liabilities": 5000
  },
  "equity": { "net_assets": 75000, "retained_earnings": 60000, "total_equity": 75000 }
}
```

#### `GET /api/financial-reports/profit-loss`
- **Auth:** requireAuth
- **Query:** `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` (both required)
- **Response:**
```json
{
  "period": { "start": "2026-01-01", "end": "2026-03-01" },
  "trading_income": { "sales": 100000, "total": 100000 },
  "cost_of_sales": { "purchases": 30000, "total": 30000 },
  "gross_profit": 70000,
  "operating_expenses": [ { "category": "Rent", "amount": 5000 }, { "category": "Utilities", "amount": 2000 } ],
  "total_operating_expenses": 7000,
  "net_profit": 63000
}
```

#### `GET /api/financial-reports/transaction-listing`
- **Auth:** requireAuth
- **Query:** `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&type=income|expense`
- **Response:**
```json
{
  "period": { "start": "...", "end": "..." },
  "transactions": [
    { "id": 1, "date": "...", "type": "income", "supplier": "...", "reference": "INV-001", "vat_type": "Standard", "net": 1000, "vat": 150, "gross": 1150, "payment_id": null }
  ],
  "totals": { "gross": 50000, "vat": 7500, "net": 42500 },
  "count": 100
}
```

---

### 4.2 Reports (reports.ts)

#### `GET /api/reports`
- **Auth:** requireAuth
- **Query:** `?type=trial-balance|vat|income-statement&from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Response (type=trial-balance):**
```json
{
  "success": true,
  "data": {
    "from": "...", "to": "...",
    "accounts": [ { "id", "account_code", "account_name", "account_type", "total_debit", "total_credit" } ],
    "totals": { "total_debit": 100000, "total_credit": 100000 }
  }
}
```
- **Response (type=vat):**
```json
{
  "success": true,
  "data": {
    "from", "to", "tax_rates": [...],
    "output_vat": 15000, "input_vat": 5000, "net_vat": 10000
  }
}
```
- **Response (type=income-statement):**
```json
{
  "success": true,
  "data": {
    "from", "to",
    "income": [ { "account_code", "account_name", "amount" } ],
    "expenses": [ { "account_code", "account_name", "amount" } ],
    "totals": { "total_income", "total_expenses", "net_profit" }
  }
}
```

---

### 4.3 VAT Reports (vatReports.ts)

#### `GET /api/vat-reports`
- **Auth:** requireAuth
- **Query:** `?type=vat201|itr14|irp6` + type-specific params

**type=vat201:**
- **Query:** `?type=vat201&period_start=YYYY-MM-DD&period_end=YYYY-MM-DD`
- **Response:** `{ success, data: { period_start, period_end, total_sales, total_purchases, output_vat, input_vat, net_vat, vat_payable, vat_refundable } }`

**type=itr14:**
- **Query:** `?type=itr14&year=2026`
- **Response:** `{ success, data: { year, period: "YYYY-03-01 to YYYY-02-28", gross_income, total_expenses, taxable_income } }`

**type=irp6:**
- **Query:** `?type=irp6&to_date=YYYY-MM-DD`
- **Response:** `{ success, data: { from_date, to_date, estimated_income, estimated_expenses, estimated_taxable } }`

---

## 5. Settings & Configuration

### 5.1 App Settings (appSettings.ts)

#### `GET /api/app-settings/branding`
- **Auth:** **PUBLIC (no auth)**
- **Response:** Flat key-value object of branding-safe keys only:
```json
{
  "site_name": "SoftAware",
  "site_title": "...",
  "site_description": "...",
  "site_logo": "/assets/images/logo.png",
  "site_icon": "/assets/images/icon.png"
}
```

#### `GET /api/app-settings`
- **Auth:** requireAuth
- **Query:** `?category=smtp_` (optional prefix filter)
- **Response:** Flat key-value object: `{ "smtp_host": "mail.example.com", "company_name": "SoftAware", ... }`

#### `GET /api/app-settings/:key`
- **Auth:** requireAuth
- **Response:** `{ key: "smtp_host", value: "mail.example.com", type: "string", description: "..." }`

#### `PUT /api/app-settings`
- **Auth:** requireAdmin
- **Body:** Object of key-value pairs: `{ "smtp_host": "new.host.com", "site_name": "New Name" }`
- **Behavior:** Upserts each key
- **Response:** `{ success, message: "Settings updated" }`

#### `PUT /api/app-settings/:key`
- **Auth:** requireAdmin
- **Body:** `{ value: string, type?: string }`
- **Behavior:** Upserts single key
- **Response:** `{ success, message: 'Setting "smtp_host" updated' }`

---

### 5.2 Settings (settings.ts)

An alternative/simpler settings interface that also reads/writes `app_settings`.

#### `GET /api/settings`
- **Auth:** requireAuth
- **Response:** `{ success, data: { key1: value1, key2: value2, ... } }` — values are JSON-parsed if possible

#### `PUT /api/settings`
- **Auth:** requireAuth
- **Body:** `{ key1: value1, key2: value2, ... }` — each value is stringified and upserted
- **Response:** `{ success, message: "Settings updated" }`

---

## 6. Notifications

#### `GET /api/notifications`
- **Auth:** requireAuth
- **Query:** `?limit=50&unread=true`
- **Response:** `{ success, data: [ { id, user_id, title, message, read_at, created_at, ... } ], unread_count: 5 }`

#### `GET /api/notifications/unread/count`
- **Auth:** requireAuth
- **Response:** `{ success, data: { count: 5 } }`

#### `PUT /api/notifications/:id/read`
- **Auth:** requireAuth
- **Response:** `{ success, message: "Notification marked as read" }`

#### `PUT /api/notifications/read-all`
- **Auth:** requireAuth
- **Response:** `{ success, message: "All notifications marked as read" }`

#### `DELETE /api/notifications/:id`
- **Auth:** requireAuth
- **Response:** `{ success, message: "Notification deleted" }`

---

## 7. System Administration

### 7.1 System Credentials

#### `GET /api/credentials`
- **Auth:** requireAuth
- **Query:** `?decrypt=true&type=api_key|oauth|password&environment=production|staging`
- **Response:** `{ success, data: [ { id, service_name, credential_type, identifier, credential_value: "••••••••", additional_data: "(encrypted)", environment, expires_at, is_active, notes, ... } ] }`
- **Note:** Values masked unless `?decrypt=true`

#### `GET /api/credentials/expired`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ ...expired credentials ] }`

#### `GET /api/credentials/expiring`
- **Auth:** requireAuth
- **Response:** `{ success, data: [ ...credentials expiring within 30 days ] }`

#### `GET /api/credentials/:id`
- **Auth:** requireAuth
- **Query:** `?decrypt=true`
- **Behavior:** Also updates `last_used_at`
- **Response:** `{ success, data: { ...credential } }`

#### `POST /api/credentials`
- **Auth:** requireAuth
- **Body:** `{ service_name: string (required), credential_value: string (required), credential_type?, identifier?, additional_data?: object, environment?, expires_at?, notes? }`
- **Response:** `201 { success, data: { ...credential } }`

#### `PUT /api/credentials/:id`
- **Auth:** requireAuth
- **Body:** Partial of all fields
- **Response:** `{ success, data: { ...updated } }`

#### `DELETE /api/credentials/:id`
- **Auth:** requireAuth
- **Behavior:** Hard delete
- **Response:** `{ success, message: "Credential deleted" }`

#### `POST /api/credentials/:id/deactivate`
- **Auth:** requireAuth
- **Response:** `{ success, message: "Credential deactivated" }`

#### `POST /api/credentials/:id/rotate`
- **Auth:** requireAuth
- **Body:** `{ new_value?: string }`
- **Behavior:** If `new_value` provided, updates value. Otherwise returns prompt.
- **Response:** `{ success, message: "Credential rotated" }` or `{ success, message: "Provide new_value to complete rotation", data: { id, service_name } }`

#### `POST /api/credentials/:id/test`
- **Auth:** requireAuth
- **Response:** `{ success, data: { valid: boolean, is_active: boolean, is_expired: boolean, has_value: boolean } }`

---

### 7.2 Groups (Chat)

**Note:** No explicit auth middleware on these routes (uses `(req as any).user?.id` if available).

#### `GET /api/groups`
- **Auth:** *(none enforced in router)*
- **Response:** `{ success, data: [ { id, name, description, created_by, member_count, last_message, last_message_at } ] }`

#### `POST /api/groups`
- **Auth:** *(none enforced in router)*
- **Body:** `{ name: string (required), description? }`
- **Behavior:** Creates group + adds creator as first member
- **Response:** `{ success, id: number }`

#### `DELETE /api/groups/:id`
- **Auth:** *(none enforced in router)*
- **Behavior:** Hard deletes group + all messages + all members
- **Response:** `{ success: true }`

#### `GET /api/groups/:id/messages`
- **Auth:** *(none enforced in router)*
- **Query:** `?limit=100&before=ISO_DATETIME`
- **Response:** `{ success, data: [ { id, group_id, user_id, content, message_type, reply_to_id, created_at, user_name, reply_to_content, reply_to_user } ] }`

#### `POST /api/groups/:id/messages`
- **Auth:** *(none enforced in router)*
- **Body:** `{ content: string, message_type?: "text", reply_to_id?: number }`
- **Response:** `{ success, id: number }`

---

### 7.3 Database Manager

**Note:** No explicit auth middleware on these routes. All endpoints create ephemeral MySQL connections from supplied credentials.

#### `POST /api/database/connect`
- **Auth:** *(none enforced in router)*
- **Body:** `{ host?: string, port?: number, user?: string, password?: string, database?: string, type?: string }`
- **Response:** `{ success, message: "Connected successfully" }`

#### `POST /api/database/tables`
- **Auth:** *(none enforced in router)*
- **Body:** Same connection params + `database` (required)
- **Response:** `{ success, tables: [ { name, type, rows, engine } ] }`

#### `POST /api/database/describe`
- **Auth:** *(none enforced in router)*
- **Body:** Same connection params + `table: string`
- **Response:** `{ success, columns: [ { Field, Type, Null, Key, Default, Extra } ] }`

#### `POST /api/database/query`
- **Auth:** *(none enforced in router)*
- **Body:** Same connection params + `sql: string`
- **Response (SELECT):** `{ success, columns: [...], rows: [...], rowCount: N }`
- **Response (INSERT/UPDATE/DELETE):** `{ success, columns: [], rows: [], affectedRows: N, insertId: N, message: "N row(s) affected" }`

---

## 8. Updates System

### 8.1 Software CRUD (updSoftware.ts)

Mounted at **both** `/api/updates/software` and `/api/softaware/software`.

#### `GET /api/updates/software`
- **Auth:** **PUBLIC (no auth)**
- **Query:** `?id=N` (optional — single item)
- **Response (list):** `{ success, software: [ { id, name, software_key, description, has_external_integration, external_*, created_by_name, latest_version, latest_update_date, total_updates } ] }`
- **Response (single):** `{ success, software: { ...single } }`

#### `POST /api/updates/software`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ name: string, software_key: string, description?, has_external_integration?, external_username?, external_password?, external_live_url?, external_test_url?, external_mode?: "test"|"live", external_integration_notes? }`
- **Validates:** software_key unique
- **Response:** `{ success, message: "Software created successfully", id: number }`

#### `PUT /api/updates/software`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ id: number, name?, description?, software_key?, has_external_integration?, external_* }`
- **Validates:** software_key unique (excluding self)
- **Response:** `{ success, message: "Software updated successfully" }`

#### `DELETE /api/updates/software?id=N`
- **Auth:** requireAuth + requireAdmin
- **Query:** `?id=N`
- **Behavior:** Hard delete (cascades via FK)
- **Response:** `{ success, message: "Software deleted successfully" }`

---

### 8.2 Update Releases CRUD (updUpdates.ts)

#### `GET /api/updates/updates`
- **Auth:** **PUBLIC (no auth)**
- **Query:** `?id=N` (single) or `?limit=N`
- **Response:** `{ success, updates: [ { id, software_id, version, description, file_path, uploaded_by, has_migrations, migration_notes, schema_file, released_at, software_name, uploaded_by_name } ] }`

#### `POST /api/updates/updates`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ software_id?: number, version: string, description?, file_path?, has_migrations?, migration_notes?, schema_file? }`
- **Response:** `{ success, message: "Update created successfully", id: number }`

#### `PUT /api/updates/updates`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ id: number, software_id?, version?, description?, file_path?, has_migrations?, migration_notes?, schema_file? }`
- **Response:** `{ success, message: "Update modified successfully" }`

#### `DELETE /api/updates/updates?id=N`
- **Auth:** requireAuth + requireAdmin
- **Behavior:** Hard delete + removes associated file from disk
- **Response:** `{ success, message: "Update deleted successfully" }`

---

### 8.3 Modules & Developer Assignments (updModules.ts)

Mounted at **both** `/api/updates/modules` and `/api/softaware/modules`.

#### `GET /api/updates/modules`
- **Auth:** requireAuth
- **Query:** `?id=N` (single) or `?software_id=N` (filter)
- **Response:** `{ success, modules: [ { id, software_id, name, description, software_name, developer_count } ] }`

#### `POST /api/updates/modules`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ software_id: number, name: string, description? }`
- **Validates:** Unique name per software
- **Response:** `{ success, message: "Module created successfully", module: {...} }`

#### `PUT /api/updates/modules?id=N`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ name?, description? }`
- **Response:** `{ success, message: "Module updated successfully" }`

#### `DELETE /api/updates/modules?id=N`
- **Auth:** requireAuth + requireAdmin
- **Response:** `{ success, message: "Module deleted successfully" }`

#### `GET /api/updates/modules/:moduleId/developers`
- **Auth:** requireAuth
- **Response:** `{ success, developers: [ { assignment_id, user_id, module_id, assigned_at, username, email } ] }`

#### `POST /api/updates/modules/:moduleId/developers`
- **Auth:** requireAuth + requireAdmin
- **Body:** `{ user_id: string }`
- **Validates:** Module + user exist, no duplicate assignment
- **Response:** `201 { success, assignment: { assignment_id, user_id, module_id, assigned_at, username, email } }`

#### `DELETE /api/updates/modules/:moduleId/developers?user_id=UUID`
- **Auth:** requireAuth + requireAdmin
- **Response:** `{ success, message: "Developer removed from module" }`

---

### 8.4 Clients / Connected Desktops (updClients.ts)

**All routes:** requireAuth + requireAdmin (applied at router level)

#### `GET /api/updates/clients`
- **Query:** `?id=N` (single) or `?software_id=N` (filter)
- **Response:**
```json
{
  "success": true,
  "clients": [
    {
      "id": 1,
      "software_id": 2,
      "software_name": "SoftAwareCode",
      "client_identifier": "sha256hash",
      "ip_address": "...",
      "hostname": "DESKTOP-ABC",
      "machine_name": "...",
      "os_info": "Windows 10",
      "app_version": "1.5.0",
      "last_heartbeat": "2026-03-01T10:00:00Z",
      "is_blocked": 0,
      "metadata": { "last_check_time": "..." },
      "status": "online",
      "last_update_version": "1.4.0",
      "seconds_since_heartbeat": 120
    }
  ]
}
```
- **Notable:** `status` is computed: online (<5min), idle (5-30min), offline (>30min)

#### `PUT /api/updates/clients`
- **Body:** `{ id: number, action: "block"|"unblock"|"force_logout"|"send_message", reason?, message? }`
- **Response:** `{ success, action: "blocked" }` or `{ success, message: "Force logout queued" }` etc.

#### `DELETE /api/updates/clients?id=N`
- **Behavior:** Hard delete
- **Response:** `{ success: true }`

---

### 8.5 File Upload & Download (updFiles.ts)

#### `POST /api/updates/upload`
- **Auth:** API Key via `X-API-Key` header (value: `softaware_test_update_key_2026`)
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `updatePackage` (file, max 500MB)
  - `software_id: number`
  - `version: string`
  - `description?`
  - `has_migrations?`
  - `migration_notes?`
  - `checksum?`
  - `update_id?` (to replace existing)
- **Behavior:** Saves file to `uploads/updates/`, computes SHA-256 checksum, creates/updates `update_releases` record
- **Response:** `{ success, message: "Update uploaded successfully", update_id: number, file_path: "uploads/updates/...", checksum: "sha256hex" }`

#### `GET /api/updates/download`
- **Auth:** Requires `X-Software-Key` header or `?software_key=` param
- **Query:** `?update_id=N`
- **Behavior:** Validates software key, streams file as download
- **Response:** Binary file stream with `Content-Disposition: attachment`

---

### 8.6 Heartbeat (updHeartbeat.ts)

#### `POST /api/updates/heartbeat`
- **Auth:** **PUBLIC** — but requires `software_key` (body or `X-Software-Key` header)
- **Body:**
```json
{
  "software_key": "my_sw_key",
  "client_identifier?": "sha256hash",
  "hostname?": "DESKTOP-ABC",
  "machine_name?": "...",
  "os_info?": "Windows 10",
  "app_version?": "1.5.0",
  "user_name?": "john",
  "user_id?": 42,
  "active_page?": "Dashboard",
  "ai_sessions_active?": 2,
  "ai_model?": "gpt-4",
  "update_installed?": true,
  "update_id?": 15,
  "metadata?": { "any": "json" }
}
```
- **Behavior:**
  1. Resolves software by key
  2. Generates `client_identifier` (SHA-256 of hostname+machine+os+ip) if not provided
  3. If blocked, returns `403 { success: false, blocked: true, reason }`
  4. Creates or updates `update_clients` record
  5. Records installation if `update_installed + update_id`
  6. Checks for latest update available
  7. Delivers one-shot commands (`force_logout`, `server_message`) and clears them
- **Response:**
```json
{
  "success": true,
  "client_id": 1,
  "action": "updated",
  "software": "SoftAwareCode",
  "update_available": true,
  "latest_update": { "id": 15, "version": "1.5.1", "description": "...", "has_migrations": 0, "released_at": "..." },
  "message": "Update available",
  "is_blocked": false,
  "blocked_reason": null,
  "force_logout": false,
  "server_message": null
}
```

---

### 8.7 Misc — Info, Dashboard, Status, Installed, Schema, Password Reset (updMisc.ts)

#### `GET /api/updates/info`
- **Auth:** **PUBLIC**
- **Response:** Static JSON with API name, version, endpoint directory, status

#### `GET /api/updates/dashboard`
- **Auth:** requireAuth
- **Response:**
```json
{
  "success": true,
  "summary": { "software_count", "update_count", "user_count", "active_clients_24h" },
  "latest_clients": [ { "id", "software_name", "hostname", "app_version", "last_heartbeat" } ],
  "recent_updates": [ { "id", "software_name", "version", "created_at" } ]
}
```

#### `GET /api/updates/api_status`
- **Auth:** **PUBLIC**
- **Response:**
```json
{
  "timestamp": "2026-03-01T10:00:00Z",
  "api_version": "2.0.0",
  "status": "operational",
  "database": {
    "connected": true,
    "total_users": 25,
    "tables": { "clients": 10, "software": 5, "releases": 30, "modules": 8, "user_modules": 12 }
  }
}
```

#### `GET /api/updates/installed`
- **Auth:** **PUBLIC**
- **Response:** `{ success, installed: [ { update_id, status, installed_at, version, description, file_path } ] }`

#### `GET /api/updates/schema?id=N`
- **Auth:** **PUBLIC**
- **Response:** `{ success, schema: "SQL content string" }`

#### `POST /api/updates/password_reset`
- **Auth:** **PUBLIC**
- **Body:** `{ identifier: string }` (email or username)
- **Behavior:** Generates 6-digit OTP, stores with 15min expiry, sends email (fire-and-forget). Always returns success (doesn't reveal if user exists). In `development` mode, includes `dev_otp` in response.
- **Response:** `{ success, message: "If the account exists, a reset code has been sent.", dev_otp?: "123456" }`

#### `POST /api/updates/verify_otp`
- **Auth:** **PUBLIC**
- **Body:** `{ identifier: string, otp: string (6 chars) }`
- **Response (success):** `{ success, message: "OTP verified successfully", user_id: "uuid", username: "john" }`
- **Response (failure):** `400 { success: false, error: "Invalid or expired reset code" }`

#### `POST /api/updates/reset_password`
- **Auth:** **PUBLIC**
- **Body:** `{ identifier: string, otp: string, new_password: string (min 6) }`
- **Behavior:** Verifies OTP, hashes password (bcrypt), updates user, marks token used, cleans up other tokens
- **Response:** `{ success, message: "Password has been reset successfully" }`

---

## 9. Softaware Tasks (Proxy)

All routes proxy to an **external software API** specified by `apiUrl`. Auth to the external API uses the `X-Software-Token` header.

#### `GET /api/softaware/tasks`
- **Auth:** requireAuth
- **Query:** `?apiUrl=https://external.api.com&page=1&limit=1000`
- **Behavior:** Proxies `GET {apiUrl}/api/tasks?page=N&limit=N`
- **Response:** Passthrough from external API

#### `POST /api/softaware/tasks`
- **Auth:** requireAuth
- **Body:** `{ apiUrl: string, task: { ...task data } }`
- **Behavior:** Proxies `POST {apiUrl}/api/tasks` with `task` body
- **Response:** Passthrough

#### `PUT /api/softaware/tasks`
- **Auth:** requireAuth
- **Body:** `{ apiUrl: string, task: { ...task data } }`
- **Behavior:** Proxies `PUT {apiUrl}/api/tasks`
- **Response:** Passthrough

#### `DELETE /api/softaware/tasks/:id`
- **Auth:** requireAuth
- **Query:** `?apiUrl=https://external.api.com`
- **Behavior:** Proxies `DELETE {apiUrl}/api/tasks/:id`
- **Response:** Passthrough

#### `POST /api/softaware/tasks/reorder`
- **Auth:** requireAuth
- **Body:** `{ apiUrl: string, orders: [...] }`
- **Behavior:** Proxies `POST {apiUrl}/api/tasks/reorder`
- **Response:** Passthrough

#### `GET /api/softaware/tasks/:id/comments`
- **Auth:** requireAuth
- **Query:** `?apiUrl=https://external.api.com`
- **Behavior:** Proxies `GET {apiUrl}/api/tasks/:id/comments`
- **Response:** Passthrough

#### `POST /api/softaware/tasks/:id/comments`
- **Auth:** requireAuth
- **Body:** `{ apiUrl: string, comment: { ...comment data } }`
- **Behavior:** Proxies `POST {apiUrl}/api/tasks/:id/comments`
- **Response:** Passthrough

#### `POST /api/softaware/tasks/authenticate`
- **Auth:** requireAuth
- **Body:** `{ apiUrl: string, username: string, password: string, otp?, otpToken? }`
- **Behavior:** Proxies `POST {apiUrl}/api/auth_login` with `{ email, password, remember_me: false, otp?, otpToken? }`
- **Response:** Passthrough (typically returns software-specific JWT)

---

## Summary: Auth Requirements Quick Reference

| Auth Level | Endpoints |
|---|---|
| **PUBLIC (none)** | `GET /app-settings/branding`, `GET /updates/software`, `GET /updates/updates`, `POST /updates/heartbeat`, `GET /updates/info`, `GET /updates/api_status`, `GET /updates/installed`, `GET /updates/schema`, `POST /updates/password_reset`, `POST /updates/verify_otp`, `POST /updates/reset_password`, `GET /updates/download` (requires software key), `GET /healthz` |
| **API Key** | `POST /updates/upload` (`X-API-Key` header) |
| **requireAuth** | All `/contacts/*`, `/quotations/*`, `/invoices/*`, `/payments/*`, `/accounting/*`, `/pricing/*`, `/categories/*`, `/expense-categories/*`, `/notifications/*`, `/financial-reports/*`, `/reports/*`, `/vat-reports/*`, `/settings/*`, `/app-settings` (GET), `/credentials/*`, `/dashboard/*`, `/admin/dashboard`, `/updates/dashboard`, `/updates/modules`, `/softaware/tasks/*` |
| **requireAdmin** | `PUT /app-settings` (bulk), `PUT /app-settings/:key`, `POST/PUT/DELETE /updates/software`, `POST/PUT/DELETE /updates/updates`, All `/updates/clients/*`, `POST/PUT/DELETE /updates/modules` (write ops), Module developer assignment (write ops) |
| **No explicit middleware** | `/groups/*`, `/database/*` (⚠️ security note) |

---

*Document version: 1.0 — March 2026*
*Source: Reverse-engineered from `/var/opt/backend/src/routes/` TypeScript source*
