# Soft Aware PHP API — Complete Documentation

> **Source**: `/var/opt/api` — Custom PHP MVC API  
> **Database**: `desilope_softaware` (MySQL, `utf8mb4_0900_ai_ci`)  
> **SQL Dump**: `/var/opt/backend/desilope_softaware.sql` (4 092 lines)  
> **Purpose**: Full invoicing, quoting, contacts, payments, accounting & tax-reporting platform for a South African PPE trading company (Soft Aware / Naledi as sales agent).  
> **This document** is the authoritative reference for absorbing the PHP API into the Node.js backend at `/var/opt/backend`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [API Endpoints](#3-api-endpoints)
4. [Business Logic Deep-Dive](#4-business-logic-deep-dive)
5. [Services & Integrations](#5-services--integrations)
6. [Absorption Notes](#6-absorption-notes)

---

## 1. Architecture Overview

### 1.1 Directory Structure

```
/var/opt/api/
├── public/
│   └── index.php          # 527 lines — all route definitions + bootstrap
├── src/
│   ├── App/
│   │   ├── Controllers/   # 20 files (14 business + 6 integration)
│   │   ├── Models/        # 22 files (6 core business + 16 integration)
│   │   └── Services/      # 11 files (Email, PDF, File, Ituran, Mettax, etc.)
│   ├── Core/
│   │   ├── Router.php     # Pattern-based routing, middleware pipeline
│   │   ├── Database.php   # PDO singleton
│   │   ├── DatabaseFactory.php
│   │   ├── BaseRepository.php
│   │   ├── Request.php
│   │   ├── Response.php
│   │   └── Validator.php
│   └── Middleware/
│       ├── AuthMiddleware.php   # JWT verification
│       ├── CorsMiddleware.php
│       └── PermissionMiddleware.php
├── vendor/                # Composer (mPDF, PHPMailer, Firebase JWT, etc.)
├── bootstrap.php          # Composer autoload + helpers
└── composer.json
```

### 1.2 Routing

The `Router.php` strips `/api/public` and `/api` prefixes from the URI, then matches against registered route patterns. Routes are defined in `index.php` as:

```php
$router->addRoute('GET', '/contacts', [ContactController::class, 'index'], ['auth']);
```

Middleware pipeline: global middleware runs first, then route-specific middleware (e.g. `['auth']`, `['auth', 'admin']`).

### 1.3 Authentication

- **JWT**: 1-hour default expiry, 30-day with "remember me"
- **API Key**: `X-API-Key` header (for machine-to-machine calls)
- PHP system users in `sys_users` — **to be DISCARDED** during absorption

---

## 2. Database Schema

### 2.1 Business Tables (tb_ prefix) — MUST PRESERVE

#### `tb_contacts`
| Column | Type | Notes |
|--------|------|-------|
| `contact_id` | INT PK AI=68 | |
| `contact_name` | VARCHAR | Company/person name |
| `contact_type` | INT | 1=customer, 2=supplier |
| `contact_person` | VARCHAR | Contact person name |
| `contact_address` | TEXT | Physical/postal address |
| `contact_email` | VARCHAR | Email address |
| `contact_phone` | VARCHAR | Primary phone |
| `contact_alt_phone` | VARCHAR | Alternative phone |
| `contact_notes` | TEXT | Free-text notes |
| `contact_vat` | VARCHAR | VAT registration number |
**Data**: ~67 real contacts.

#### `tb_categories`
| Column | Type | Notes |
|--------|------|-------|
| `category_id` | INT PK AI=14 | |
| `category_name` | VARCHAR | Category name |
**Data**: 6 categories — Face Protection, Ear Protection, Hand Protection, Work Wear, Heights/Site, Footwear.

#### `tb_pricing`
| Column | Type | Notes |
|--------|------|-------|
| `pricing_id` | INT PK UNIQUE AI | |
| `pricing_price` | DOUBLE | Selling price |
| `pricing_note` | VARCHAR(50) | Supplier code (Pin/Hen/Mic/Pro/Omn) |
| `pricing_item` | TEXT | Product description |
| `pricing_unit` | VARCHAR(50) | Unit of measure |
| `pricing_category` | TEXT | Category name (denormalized) |
| `pricing_category_id` | INT FK→tb_categories | |
**Data**: ~213 PPE product entries.  
**FK**: `fk_pricing_category` → `tb_categories(category_id)` ON DELETE RESTRICT.

#### `tb_quotations`
| Column | Type | Notes |
|--------|------|-------|
| `quotation_id` | INT PK AI=307 | |
| `quotation_contact_id` | INT | FK to tb_contacts |
| `quotation_total` | DOUBLE | Grand total (incl. VAT) |
| `quotation_subtotal` | DOUBLE | Before VAT |
| `quotation_vat` | DOUBLE | VAT amount |
| `quotation_discount` | DOUBLE | Discount amount |
| `quotation_date` | VARCHAR | Quote date |
| `quotation_valid_until` | VARCHAR | Validity date |
| `quotation_notes` | TEXT | Notes/terms |
| `quotation_email` | LONGTEXT | Full HTML email body |
| `quotation_status` | INT | 0=draft, 1=sent, 2=accepted/converted |
| `quotation_user_id` | INT | Creator (PHP sys_users ID) |
| `quotation_time` | INT | Unix timestamp |
| `quotation_updated` | BIGINT | Unix timestamp of last update |
| `quotation_subject` | VARCHAR | Email subject line |
**Data**: ~170+ quotations (IDs 118-306).

#### `tb_quote_items`
| Column | Type | Notes |
|--------|------|-------|
| `item_id` | INT PK AI=16731 | |
| `item_quote_id` | INT | FK to tb_quotations |
| `item_product` | TEXT | Product description |
| `item_price` | DOUBLE | Unit selling price |
| `item_profit` | DOUBLE | Profit amount |
| `item_discount` | VARCHAR | Discount (stored as string!) |
| `item_subtotal` | DOUBLE | Line subtotal |
| `item_cost` | DOUBLE | Cost price |
| `item_supplier_id` | INT | Supplier contact ID |
| `item_qty` | INT | Quantity |
| `item_vat` | DOUBLE | VAT per unit |
**Data**: ~16 730 line items.

#### `tb_invoices`
| Column | Type | Notes |
|--------|------|-------|
| `invoice_id` | INT PK AI=1063 | |
| `invoice_contact_id` | INT | FK to tb_contacts |
| `invoice_total` | DOUBLE | Grand total |
| `invoice_subtotal` | DOUBLE | Before VAT |
| `invoice_vat` | DOUBLE | VAT amount |
| `invoice_discount` | DOUBLE | Discount |
| `invoice_date` | VARCHAR | Invoice date |
| `invoice_valid_until` | VARCHAR | Due date |
| `invoice_notes` | TEXT | Notes/terms |
| `invoice_email` | LONGTEXT | Full HTML email body |
| `invoice_status` | INT | 0=draft, 1=sent, 2=paid |
| `invoice_user_id` | INT | Creator (PHP sys_users ID) |
| `invoice_subject` | VARCHAR | Email subject |
| `invoice_quote_id` | INT | Source quotation ID |
| `invoice_updated` | BIGINT | Last update timestamp |
**Data**: ~59 invoices (IDs 1004-1062).

#### `tb_invoice_items`
| Column | Type | Notes |
|--------|------|-------|
| `item_id` | INT PK AI=1205 | |
| `item_invoice_id` | INT | FK to tb_invoices |
| `item_product` | TEXT | Product description |
| `item_price` | DOUBLE | Unit selling price |
| `item_profit` | DOUBLE | Profit amount |
| `item_discount` | VARCHAR | Discount (string) |
| `item_subtotal` | DOUBLE | Line subtotal |
| `item_cost` | DOUBLE | Cost price |
| `item_supplier_id` | INT | Supplier contact ID |
| `item_qty` | INT | Quantity |
| `item_vat` | DOUBLE | VAT per unit |
**Data**: ~1 204 line items.

#### `tb_payments`
| Column | Type | Notes |
|--------|------|-------|
| `payment_id` | INT PK AI=62 | |
| `payment_date` | VARCHAR | Payment date |
| `payment_amount` | TEXT | ⚠️ Stored as TEXT, not numeric |
| `payment_invoice` | INT | FK to tb_invoices |
| `payment_processed` | INT | 0=unprocessed, 1=processed |
| `processed_at` | VARCHAR | Timestamp of processing |
| `processed_by` | INT | PHP sys_users ID |
**Data**: ~61 payments.

#### `tb_transactions`
| Column | Type | Notes |
|--------|------|-------|
| `transaction_id` | INT PK AI=211 | |
| `transaction_date` | VARCHAR | Transaction date |
| `transaction_type` | VARCHAR | "income" or "expense" |
| `party_name` | VARCHAR | Customer/supplier name |
| `party_vat_number` | VARCHAR | VAT number |
| `invoice_number` | VARCHAR | Invoice reference |
| `document_path` | VARCHAR | Attached document path |
| `total_amount` | DOUBLE | Total amount |
| `vat_type` | VARCHAR | standard/non-vat/zero/exempt |
| `vat_amount` | DOUBLE | VAT portion |
| `exclusive_amount` | DOUBLE | Amount excl. VAT |
| `expense_category_id` | INT FK→tb_expense_categories | For expenses |
| `income_type` | VARCHAR | For income transactions |
| `created_by` | INT | PHP sys_users ID |
| `transaction_payment_id` | INT UNIQUE | FK to tb_payments (for income) |
| `transaction_invoice_id` | INT | FK to tb_invoices |
**Data**: ~210 transactions.  
**FK**: `tb_transactions_ibfk_1` → `tb_expense_categories(category_id)`.

#### `tb_expense_categories`
| Column | Type | Notes |
|--------|------|-------|
| `category_id` | INT PK AI=20 | |
| `category_name` | VARCHAR | e.g. "Advertising", "Bank Charges" |
| `category_code` | VARCHAR | SA SARS code |
| `category_group` | VARCHAR | Grouping |
| `itr14_mapping` | VARCHAR | ITR14 tax form mapping |
| `allows_vat_claim` | TINYINT | 0/1 — can claim VAT back |
**Data**: 19 expense categories.

#### `tb_accounts`
| Column | Type | Notes |
|--------|------|-------|
| `account_id` | INT PK AI=10 | |
| `account_code` | VARCHAR | e.g. 1000, 1100, 2000, 4000 |
| `account_name` | VARCHAR | e.g. "Bank", "Accounts Receivable" |
| `account_type` | VARCHAR | asset/liability/equity/revenue/expense |
| `account_balance` | DOUBLE | Current balance |
**Data**: 4 chart-of-accounts entries (Bank/1000, AR/1100, VAT Output/2000, Sales Revenue/4000).

#### `tb_groups`
| Column | Type | Notes |
|--------|------|-------|
| `group_id` | INT PK AI=32 | |
| `group_name` | VARCHAR | |
| `group_parent_id` | INT FK→tb_categories | |
**Data**: Empty. FK: `fk_groups_category` → `tb_categories(category_id)`.

#### `tb_settings`
App-level settings key/value. AI=33. Empty usable data.

#### `tb_tax_rates`
Tax rate definitions. AI=0. Empty.

#### `tb_ledger`
General ledger entries. Empty.  
FK: `fk_ledger_account` → `tb_accounts(account_id)` ON DELETE RESTRICT ON UPDATE CASCADE.

#### `tb_installed_updates` / `tb_migrations`
Update tracking tables. Empty.

### 2.2 System Tables (sys_ prefix) — DISCARD

| Table | Records | Notes |
|-------|---------|-------|
| `sys_users` | 2 | admin, Naledi — replaced by Node backend users |
| `sys_roles` | 3 | Administrator, Editor, Viewer |
| `sys_permissions` | 80 | Permission entries |
| `sys_role_permissions` | 78 | Role↔permission mappings |
| `sys_user_roles` | 2 | User↔role assignments |
| `sys_audit_logs` | 71 | Audit trail |
| `sys_credentials` | 0 | Encrypted credentials |
| `sys_settings` | 9 | site_name, app_version, software_key, etc. |
| `sys_notifications` | - | Notification system tables |
| `sys_notification_*` | - | Preferences, queue, templates |
| `sys_password_resets` | 2 | OTP resets |
| `sys_installed_updates` | - | Update tracking |
| `sys_migrations` | - | Migration tracking |

### 2.3 Foreign Key Map

```
tb_pricing.pricing_category_id  →  tb_categories.category_id  (RESTRICT)
tb_groups.group_parent_id       →  tb_categories.category_id
tb_ledger.account_id            →  tb_accounts.account_id     (RESTRICT/CASCADE)
tb_transactions.expense_cat_id  →  tb_expense_categories.category_id
tb_transactions.payment_id      →  tb_payments    (UNIQUE)
tb_transactions.invoice_id      →  tb_invoices
tb_quote_items.item_quote_id    →  tb_quotations  (logical, no FK constraint)
tb_invoice_items.item_invoice_id→  tb_invoices    (logical, no FK constraint)
tb_payments.payment_invoice     →  tb_invoices    (logical, no FK constraint)
```

---

## 3. API Endpoints

All endpoints are prefixed with the API base URL. Auth middleware is denoted as `[auth]` or `[auth, admin]`.

### 3.1 Contacts

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/contacts` | `index` | auth | List all contacts (paginated, filterable by `type`, `search`) |
| GET | `/contacts/{id}` | `show` | auth | Get single contact |
| POST | `/contacts` | `store` | auth | Create contact |
| PUT | `/contacts/{id}` | `update` | auth | Update contact |
| DELETE | `/contacts/{id}` | `destroy` | auth | Delete contact |
| GET | `/contacts/{id}/statement-data` | `getStatementData` | auth | Get invoices, payments, aging, running balance |
| GET | `/contacts/{id}/statement` | `downloadStatement` | auth | Download PDF statement |

**Model Query Patterns:**
- `getAll`: Paginated with `LIMIT/OFFSET`, filterable by `contact_type` and `search` (LIKE on name/email/phone)
- `getStatementData`: Complex join — fetches invoices→payments→timeline→running balance→aging (current/30/60/90+ days)
- `downloadStatement`: Generates PDF via mPDF service

### 3.2 Quotations

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/quotations` | `index` | auth | List all (JOIN contacts for name) |
| GET | `/quotations/{id}` | `show` | auth | Get single quotation with items |
| POST | `/quotations` | `store` | auth | Create quotation |
| PUT | `/quotations/{id}` | `update` | auth | Update quotation (partial) |
| DELETE | `/quotations/{id}` | `destroy` | auth | Delete quotation + cascade items |
| GET | `/quotations/{id}/generate-pdf` | `generatePDF` | auth | Generate branded PDF |
| POST | `/quotations/{id}/send-email` | `sendEmail` | auth | Send PDF via email, update status=1 |
| GET | `/quote-items` | `getItems` | auth | Get items by `quote_id` query param |
| POST | `/quote-items` | `saveItems` | auth | Save items (delete-all + re-insert) |
| POST | `/convert-quote` | `convertToInvoice` | auth | Convert quote → invoice |

**Key Business Logic:**
- `saveItems`: Deletes ALL existing items for the quote, then bulk-inserts new ones
- `convertToInvoice`: Creates invoice by copying header fields + all items from quotation; sets `quotation_status=2`, links via `invoice_quote_id`
- `generatePDF`: Uses mPDF with branded template (company logo, colors), calculates totals
- `sendEmail`: Generates PDF, attaches it, sends via SMTP (EmailService), CC support if configured, updates `quotation_status=1`

### 3.3 Invoices

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/invoices` | `index` | auth | List all (JOIN contacts + payment sum for status) |
| GET | `/invoices/{id}` | `show` | auth | Get single invoice |
| POST | `/invoices` | `store` | auth | Create invoice |
| PUT | `/invoices/{id}` | `update` | auth | Update invoice (partial) |
| DELETE | `/invoices/{id}` | `destroy` | auth | Delete invoice + cascade items |
| GET | `/invoices/{id}/generate-pdf` | `generatePDF` | auth | Generate branded PDF with payment badge |
| POST | `/invoices/{id}/send-email` | `sendEmail` | auth | Send PDF via email, update status=1 |
| POST | `/invoices/{id}/mark-paid` | `markAsPaid` | auth | Mark as paid (creates full payment) |
| POST | `/invoices/{id}/mark-sent` | `markAsSent` | auth | Update status to 1 |
| GET | `/invoice-items` | `getItems` | auth | Get items by `invoice_id` query param |
| POST | `/invoice-items` | `saveItems` | auth | Save items (delete-all + re-insert) |

**Key Business Logic:**
- `index` response includes computed `payment_status`: `paid` (sum ≥ total), `partial`, or `unpaid`
- `markAsPaid`: DB transaction — updates `invoice_status=2`, creates payment record for full `invoice_total`
- `saveItems`: Same pattern as quotes — delete-all + re-insert; includes `item_supplier_id`
- `generatePDF`: Includes payment status badge (PAID/PARTIAL/UNPAID)

### 3.4 Payments

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/payments` | `index` | auth | List all (JOIN invoices/contacts/transactions) |
| GET | `/payments/{id}` | `show` | auth | Get single payment |
| POST | `/payments` | `store` | auth | Create payment |
| PUT | `/payments/{id}` | `update` | auth | Update payment |
| DELETE | `/payments/{id}` | `destroy` | auth | Delete payment |
| GET | `/payments/unprocessed` | `pending` | auth | List unprocessed payments |
| GET | `/payments/invoice/{invoiceId}` | `getByInvoice` | auth | Get payments for specific invoice |
| POST | `/payments/process` | `process` | auth | Batch-process payments into transactions |

**Key Business Logic — `process`:**
1. Receives array of `payment_ids`
2. For each payment: fetches invoice, calculates VAT proportionally from invoice's `vat/total` ratio
3. Creates `tb_transactions` entry with `type=income`, `vat_type=standard`, proper `vat_amount` and `exclusive_amount`
4. Marks payment as `processed=1` with `processed_at` timestamp and `processed_by` user ID
5. Returns count of processed payments

### 3.5 Pricing (Product Catalog)

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/pricing` | `index` | auth | List all (JOIN categories) |
| GET | `/pricing/{id}` | `show` | auth | Get single product |
| POST | `/pricing` | `store` | auth | Create product |
| PUT | `/pricing/{id}` | `update` | auth | Update product |
| DELETE | `/pricing/{id}` | `destroy` | auth | Delete product |
| GET | `/pricing/category/{categoryId}` | `getByCategory` | auth | Filter by category |
| GET | `/pricing/code/{code}` | `getByCode` | auth | Filter by supplier code |

### 3.6 Categories

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/categories` | `index` | auth | List all |
| GET | `/categories/{id}` | `show` | auth | Get single |
| POST | `/categories` | `store` | auth | Create |
| PUT | `/categories/{id}` | `update` | auth | Update |
| DELETE | `/categories/{id}` | `destroy` | auth | Delete |

### 3.7 Expense Categories

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/expense-categories` | `index` | auth | List all |
| GET | `/expense-categories/{id}` | `show` | auth | Get single |
| POST | `/expense-categories` | `store` | auth | Create |
| PUT | `/expense-categories/{id}` | `update` | auth | Update |
| DELETE | `/expense-categories/{id}` | `destroy` | auth | Delete |

### 3.8 Accounts (Chart of Accounts)

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/accounts` | `index` | auth | List all |
| GET | `/accounts/{id}` | `show` | auth | Get single |
| POST | `/accounts` | `store` | auth | Create |
| PUT | `/accounts/{id}` | `update` | auth | Update |
| DELETE | `/accounts/{id}` | `destroy` | auth | Delete |

### 3.9 Transactions

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/transactions` | `index` | auth | List all (JOIN expense_categories) |
| GET | `/transactions/{id}` | `show` | auth | Get single |
| POST | `/transactions` | `store` | auth | Create (auto-calculates VAT at 15%) |
| PUT | `/transactions/{id}` | `update` | auth | Update |
| DELETE | `/transactions/{id}` | `destroy` | auth | Delete |
| POST | `/transactions/clear-income` | `clearIncome` | auth | Delete ALL income transactions, unprocess linked payments |

**Key Business Logic:**
- `store`: Auto-calculates VAT from `total_amount` at 15% standard rate: `vat = total / 1.15 * 0.15`, `exclusive = total - vat`
- `clearIncome`: DB transaction — deletes all `type=income` records, fetches their `payment_ids`, marks those payments as `unprocessed`

### 3.10 Dashboard

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/dashboard/stats` | `getStats` | auth | Aggregated business statistics |

**Response Structure:**
```json
{
  "invoices": {
    "total": 59,
    "draft": 5,
    "sent": 20,
    "paid": 34,
    "total_value": 500000
  },
  "payments": {
    "total": 61,
    "processed": 45,
    "unprocessed": 16,
    "total_amount": 450000
  },
  "quotations": {
    "total": 170,
    "draft": 50,
    "sent": 80,
    "converted": 40,
    "total_value": 2000000
  },
  "customers": { "total": 50 },
  "revenue": { "total_income": 400000 },
  "profit": { "gross": 200000 },
  "recent_invoices": [...],
  "recent_quotations": [...],
  "outstanding": {
    "current": 50000,
    "30_days": 30000,
    "60_days": 10000,
    "90_plus": 5000
  }
}
```

### 3.11 VAT Reports

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/vat-reports?type=vat201` | `generate` | auth | SA VAT201 return |
| GET | `/vat-reports?type=itr14` | `generate` | auth | SA ITR14 corporate tax |
| GET | `/vat-reports?type=irp6` | `generate` | auth | SA IRP6 provisional tax |

**Query params**: `start_date`, `end_date`, `type`

**VAT201 Response:**
```json
{
  "period": { "start": "...", "end": "..." },
  "output_vat": 75000,
  "input_vat": 45000,
  "net_vat": 30000,
  "total_sales": 500000,
  "total_purchases": 300000,
  "standard_rated_sales": 450000,
  "zero_rated_sales": 50000
}
```

**ITR14 Response:**
- Gross income, allowable deductions by category (mapped via `itr14_mapping`), taxable income, tax at 27%

**IRP6 Response:**
- Annualized estimate based on year-to-date figures

### 3.12 Financial Reports

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/financial-reports/balance-sheet` | `balanceSheet` | auth | Assets/liabilities/equity |
| GET | `/financial-reports/profit-loss` | `profitAndLoss` | auth | P&L statement |
| GET | `/financial-reports/transaction-listing` | `transactionListing` | auth | Raw transaction list |

**Query params**: `start_date`, `end_date`

**Profit & Loss structure:**
- Trading income (total income transactions)
- Cost of goods sold (COGS)
- Gross profit
- Operating expenses (by expense_category)
- Net profit

### 3.13 App Settings

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| GET | `/app-settings` | `index` | auth | Get all settings |
| GET | `/app-settings/{key}` | `show` | auth | Get by key |
| PUT | `/app-settings` | `bulkUpdate` | auth | Bulk update settings |
| PUT | `/app-settings/{key}` | `update` | auth | Update single setting |
| POST | `/app-settings/upload-logo` | `uploadLogo` | auth | Upload company logo |
| POST | `/app-settings/upload-icon` | `uploadIcon` | auth | Upload app icon |

### 3.14 Files

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| POST | `/files/upload` | `upload` | auth | Multipart file upload |
| POST | `/files/upload-base64` | `uploadBase64` | auth | Base64 file upload |
| GET | `/files/list` | `list` | auth | List files |
| GET | `/files/info/{path}` | `info` | auth | File metadata |
| GET | `/files/download/{path}` | `download` | auth | Download file |
| GET | `/files/view/{path}` | `view` | auth | View file inline |
| DELETE | `/files/{path}` | `delete` | auth | Delete file |

### 3.15 PDF Generation

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| POST | `/pdf/create` | `create` | auth | Generic PDF from HTML |
| POST | `/pdf/invoice` | `invoice` | auth | Invoice PDF |
| POST | `/pdf/report` | `report` | auth | Report PDF |
| POST | `/pdf/custom` | `custom` | auth | Custom PDF |

### 3.16 Email

| Method | Path | Controller Method | Auth | Description |
|--------|------|-------------------|------|-------------|
| POST | `/email/send` | `send` | auth | Send generic email |
| POST | `/email/welcome` | `welcome` | auth | Welcome email |
| POST | `/email/password-reset` | `passwordReset` | auth | Password reset email |
| POST | `/email/notification` | `notification` | auth | Notification email |

### 3.17 Integration APIs (Reference Only)

These are third-party integrations that may or may not be absorbed:

#### Ituran Fleet Management (~25 routes)
`/ituran/vehicles`, `/ituran/vehicle/{id}`, `/ituran/vehicle/{id}/tracking`, `/ituran/places`, `/ituran/events`, `/ituran/commands`, `/ituran/trips`, `/ituran/analytics/*`, `/ituran/sync/*`

#### MettaX Dashcam (~15 routes)
`/mettax/devices`, `/mettax/video/*`, `/mettax/mappings`, `/mettax/sync`

#### Traccar GPS Tracking (~25 routes)
`/traccar/devices`, `/traccar/positions`, `/traccar/events`, `/traccar/geofences`, `/traccar/mappings`, `/traccar/reports/*`, `/traccar/commands`, `/traccar/sync`

#### IMAP Email (~10 routes)
`/imap/info`, `/imap/folders`, `/imap/emails`, `/imap/search`, `/imap/read`, `/imap/unread`, `/imap/delete`

### 3.18 System Routes (DISCARD — already in Node backend)

- Auth: `/auth/register`, `/auth/login`, `/auth/me`, `/auth/logout`, etc.
- Users: CRUD `/users`
- Roles: CRUD `/roles`
- Permissions: CRUD `/permissions`
- Settings: CRUD `/settings`
- Credentials: CRUD `/credentials`
- Notifications: CRUD `/notifications`
- Updates: `/updates/check`, `/updates/install`, `/updates/history`

---

## 4. Business Logic Deep-Dive

### 4.1 Quote-to-Invoice Conversion

```
POST /convert-quote
Body: { "quotation_id": 123 }
```

**Flow:**
1. Fetch quotation by ID (validate exists)
2. `INSERT INTO tb_invoices` — copies: `contact_id`, `total`, `subtotal`, `vat`, `discount`, `date`, `valid_until`, `notes`, `email`, `user_id`, `subject`
3. Sets `invoice_status=0` (draft), `invoice_quote_id=quotation_id`
4. For each quote item: `INSERT INTO tb_invoice_items` — copies all item fields
5. Update `quotation_status=2` (converted)
6. Return new invoice object

### 4.2 Payment Processing Pipeline

```
POST /payments/process
Body: { "payment_ids": [1, 2, 3] }
```

**Flow for each payment:**
1. Fetch payment + linked invoice
2. Calculate VAT ratio: `ratio = invoice_vat / invoice_total`
3. `vat_amount = payment_amount × ratio`
4. `exclusive_amount = payment_amount - vat_amount`
5. Create `tb_transactions` record:
   - `type = 'income'`
   - `party_name` = contact name (from invoice→contact)
   - `invoice_number` = invoice ID
   - `vat_type = 'standard'`
   - `transaction_payment_id` = payment ID (UNIQUE constraint)
   - `transaction_invoice_id` = invoice ID
6. Mark payment: `processed=1`, `processed_at=NOW()`, `processed_by=current_user_id`

### 4.3 Income Clearing

```
POST /transactions/clear-income
```

**Flow:**
1. DB transaction begins
2. Delete ALL records from `tb_transactions` WHERE `transaction_type='income'`
3. Collect all `transaction_payment_id` values from deleted records
4. Mark those payments as `payment_processed=0`, clear `processed_at`, `processed_by`
5. Commit transaction

### 4.4 Statement Generation

```
GET /contacts/{id}/statement-data
```

**Response Structure:**
```json
{
  "contact": { ... },
  "invoices": [
    {
      "invoice_id": 1004,
      "invoice_total": 5000,
      "payments": [
        { "payment_id": 1, "payment_amount": 3000, "payment_date": "2024-01-15" }
      ],
      "balance": 2000
    }
  ],
  "timeline": [
    { "date": "2024-01-01", "type": "invoice", "amount": 5000, "running_balance": 5000 },
    { "date": "2024-01-15", "type": "payment", "amount": -3000, "running_balance": 2000 }
  ],
  "aging": {
    "current": 1000,
    "30_days": 500,
    "60_days": 300,
    "90_plus": 200
  },
  "total_invoiced": 50000,
  "total_paid": 45000,
  "outstanding_balance": 5000
}
```

### 4.5 SA Tax Calculations

**VAT Rate**: 15% (South African standard)

**VAT201 Report:**
- Output VAT: Sum of `vat_amount` from income transactions WHERE `vat_type='standard'`
- Input VAT: Sum of `vat_amount` from expense transactions WHERE `expense_category.allows_vat_claim=1`
- Net VAT: Output - Input (payable to SARS if positive)

**ITR14 Corporate Tax:**
- Corporate tax rate: 27%
- Expenses grouped by `expense_category.itr14_mapping`
- Categories: advertising, bank_charges, depreciation, employee_costs, insurance, interest, legal, motor_vehicle, office, professional_fees, rent, repairs, telephone, travel, utilities, other

**IRP6 Provisional Tax:**
- Annualizes year-to-date profit, estimates annual tax liability

### 4.6 PDF Generation (mPDF)

All PDFs use mPDF with:
- Company branding (logo from app-settings)
- SA formatting (currency: R, date format)
- Quotation PDFs: Header with company info, line items table, totals, terms
- Invoice PDFs: Same + payment status badge (green PAID / orange PARTIAL / red UNPAID)
- Statement PDFs: Customer statement with all invoices, payments, running balance, aging summary

---

## 5. Services & Integrations

### 5.1 EmailService
- PHPMailer-based SMTP
- Used by: quotation send, invoice send, welcome email, password reset
- Supports attachments (PDF), CC addresses, HTML templates
- SMTP credentials from `sys_credentials` or app-settings

### 5.2 PdfService
- mPDF library
- Generates quotation, invoice, statement, and custom PDFs
- Templates include company logo, address, banking details
- **Node equivalent needed**: `pdfkit`, `puppeteer`, or `jspdf`

### 5.3 FileService
- File upload/download to server filesystem
- Supports multipart and base64 uploads
- Image validation for logo/icon uploads

---

## 6. Absorption Notes

### 6.1 What to Absorb

**MUST absorb** (core business functionality):
- Contacts CRUD + statement
- Quotations CRUD + items + PDF + email + convert
- Invoices CRUD + items + PDF + email + mark-paid/sent
- Payments CRUD + process + unprocessed
- Pricing CRUD + category/code filters
- Categories CRUD
- Expense Categories CRUD
- Accounts CRUD
- Transactions CRUD + clear-income
- Dashboard stats
- VAT Reports (vat201, itr14, irp6)
- Financial Reports (balance-sheet, profit-loss, transaction-listing)
- App Settings + logo/icon upload

**SKIP** (already in Node backend or not needed):
- Auth system (already in Node)
- Users/Roles/Permissions (already in Node)
- System settings (already in Node)
- Credentials (already in Node)
- Notifications (already in Node)
- Updates (already absorbed)
- Ituran/MettaX/Traccar integrations (can be added later if needed)
- IMAP email (can be added later if needed)

### 6.2 URL Structure Preservation

**Critical**: Per user instruction, the Node.js backend MUST match the PHP API's client-facing URL structure. The PHP client app expects these exact paths:

```
/contacts, /contacts/{id}, /contacts/{id}/statement-data, /contacts/{id}/statement
/quotations, /quotations/{id}, /quotations/{id}/generate-pdf, /quotations/{id}/send-email
/quote-items, /convert-quote
/invoices, /invoices/{id}, /invoices/{id}/generate-pdf, /invoices/{id}/send-email
/invoices/{id}/mark-paid, /invoices/{id}/mark-sent
/invoice-items
/pricing, /pricing/{id}, /pricing/category/{categoryId}, /pricing/code/{code}
/categories, /categories/{id}
/expense-categories, /expense-categories/{id}
/accounts, /accounts/{id}
/payments, /payments/{id}, /payments/unprocessed, /payments/invoice/{invoiceId}, /payments/process
/transactions, /transactions/{id}, /transactions/clear-income
/dashboard/stats
/vat-reports
/financial-reports/balance-sheet, /financial-reports/profit-loss, /financial-reports/transaction-listing
/app-settings, /app-settings/{key}, /app-settings/upload-logo, /app-settings/upload-icon
```

### 6.3 Data Migration Considerations

1. **User ID mapping**: PHP uses INT (`sys_users.id`: 1, 2) → Node uses UUID. Columns `quotation_user_id`, `invoice_user_id`, `processed_by`, `created_by` need mapping or NULL-ing
2. **Collation**: PHP DB uses `utf8mb4_0900_ai_ci`, Node DB uses `utf8mb4_unicode_ci` — use Node's collation for new tables
3. **Table naming**: Keep `tb_` prefix to distinguish from Node's existing tables (prefixed or unprefixed)
4. **`payment_amount` is TEXT**: Should be stored as DECIMAL in new schema
5. **`item_discount` is VARCHAR**: Should be DECIMAL
6. **Date fields are VARCHAR**: Consider keeping as-is for data compatibility
7. **`quotation_email`/`invoice_email` is LONGTEXT**: Contains full HTML email bodies — large data
8. **AUTO_INCREMENT values**: Must preserve to maintain ID continuity for the live app

### 6.4 Suggested Node.js Route Files

```
src/routes/
├── bizContacts.ts         # Contacts + statement
├── bizQuotations.ts       # Quotations + items + PDF + email + convert
├── bizInvoices.ts         # Invoices + items + PDF + email + mark-*
├── bizPayments.ts         # Payments + process
├── bizPricing.ts          # Pricing catalog
├── bizCategories.ts       # Product categories
├── bizExpenseCategories.ts # Expense categories
├── bizAccounts.ts         # Chart of accounts
├── bizTransactions.ts     # Transactions + clear-income
├── bizDashboard.ts        # Dashboard stats
├── bizReports.ts          # VAT + financial reports
└── bizAppSettings.ts      # App settings + logo/icon
```

### 6.5 Supplier Code Reference

The `pricing_note` field contains supplier abbreviations:
| Code | Supplier |
|------|----------|
| Pin | Pinnacle |
| Hen | Hennox |
| Mic | Mican/Dromex |
| Pro | Procon |
| Omn | Omniglo |

---

*Generated for the PHP API absorption into the Node.js backend. All data verified against the SQL dump and PHP source code.*
