/**
 * Migration 006: Create business tables for invoicing/quoting/contacts system
 *
 * Tables (sourced from PHP API desilope_softaware.sql):
 * - contacts: Client/contact management (replaces tb_contacts)
 * - categories: Product/service categories (replaces tb_categories)
 * - pricing: Pricing/costing (replaces tb_pricing)
 * - quotations: Quotation headers (replaces tb_quotations)
 * - quote_items: Quotation line items (replaces tb_quote_items)
 * - invoices: Invoice headers (replaces tb_invoices)
 * - invoice_items: Invoice line items (replaces tb_invoice_items)
 * - payments: Payment records (replaces tb_payments)
 * - transactions: Accounting transactions (replaces tb_transactions)
 * - expense_categories: Expense categories (replaces tb_expense_categories)
 * - accounts: Chart of accounts (replaces tb_accounts)
 * - contact_groups: Contact/customer groups (replaces tb_groups) [renamed from 'groups' to avoid MySQL reserved keyword]
 * - app_settings: Application configuration (replaces tb_app_settings)
 * - tax_rates: Tax rate definitions (replaces tb_tax_rates)
 * - ledger: Ledger entries (replaces tb_ledger)
 *
 * Data type fixes:
 * - payment_amount: TEXT → DECIMAL(15,4)
 * - item_discount: VARCHAR(255) → DECIMAL(10,4)
 * - item_price: VARCHAR(255) → DECIMAL(15,4)
 * - quotation_amount: VARCHAR(255) → DECIMAL(15,4)
 * - invoice_amount: VARCHAR(255) → DECIMAL(15,4)
 *
 * User mapping:
 * - quotation_user_id, invoice_user_id, processed_by, created_by: mapped to Node UUID or NULL
 *   (PHP sys_users are discarded; data will be migrated to NULL or mapped to admin UUID)
 */
export async function up(db) {
    await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(20),
      fax VARCHAR(20),
      website VARCHAR(255),
      location VARCHAR(255),
      contact_code VARCHAR(100) UNIQUE,
      remarks TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_company (company_name),
      INDEX idx_email (email),
      INDEX idx_code (contact_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (group_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (category_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS pricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT,
      item_name VARCHAR(255) NOT NULL,
      description TEXT,
      unit_price DECIMAL(15,4) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      INDEX idx_category (category_id),
      INDEX idx_name (item_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_number VARCHAR(100) UNIQUE NOT NULL,
      contact_id INT NOT NULL,
      quotation_user_id VARCHAR(36),
      quotation_amount DECIMAL(15,4) NOT NULL,
      quotation_date DATE NOT NULL,
      remarks TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT,
      INDEX idx_number (quotation_number),
      INDEX idx_contact (contact_id),
      INDEX idx_user (quotation_user_id),
      INDEX idx_date (quotation_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS quote_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_id INT NOT NULL,
      item_description VARCHAR(255) NOT NULL,
      item_price DECIMAL(15,4) NOT NULL,
      item_quantity INT NOT NULL DEFAULT 1,
      item_discount DECIMAL(10,4) DEFAULT 0,
      line_total DECIMAL(15,4) GENERATED ALWAYS AS (
        (item_price * item_quantity) - item_discount
      ) STORED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      INDEX idx_quotation (quotation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      contact_id INT NOT NULL,
      invoice_user_id VARCHAR(36),
      quotation_id INT,
      invoice_amount DECIMAL(15,4) NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE,
      paid TINYINT(1) DEFAULT 0,
      remarks TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
      INDEX idx_number (invoice_number),
      INDEX idx_contact (contact_id),
      INDEX idx_user (invoice_user_id),
      INDEX idx_quotation (quotation_id),
      INDEX idx_date (invoice_date),
      INDEX idx_paid (paid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      item_description VARCHAR(255) NOT NULL,
      item_price DECIMAL(15,4) NOT NULL,
      item_quantity INT NOT NULL DEFAULT 1,
      item_discount DECIMAL(10,4) DEFAULT 0,
      line_total DECIMAL(15,4) GENERATED ALWAYS AS (
        (item_price * item_quantity) - item_discount
      ) STORED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      INDEX idx_invoice (invoice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      payment_date DATE NOT NULL,
      payment_amount DECIMAL(15,4) NOT NULL,
      payment_method VARCHAR(50),
      reference_number VARCHAR(100),
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
      INDEX idx_invoice (invoice_id),
      INDEX idx_date (payment_date),
      INDEX idx_reference (reference_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tax_name VARCHAR(100) NOT NULL UNIQUE,
      tax_percentage DECIMAL(10,4) NOT NULL,
      description TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (tax_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_code VARCHAR(50) UNIQUE NOT NULL,
      account_name VARCHAR(255) NOT NULL UNIQUE,
      account_type VARCHAR(50) NOT NULL,
      account_category VARCHAR(50),
      description TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_code (account_code),
      INDEX idx_type (account_type),
      INDEX idx_category (account_category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_date DATE NOT NULL,
      account_id INT NOT NULL,
      debit_amount DECIMAL(15,4) DEFAULT 0,
      credit_amount DECIMAL(15,4) DEFAULT 0,
      description VARCHAR(255),
      reference_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
      INDEX idx_account (account_id),
      INDEX idx_date (transaction_date),
      INDEX idx_reference (reference_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ledger_date DATE NOT NULL,
      account_id INT NOT NULL,
      debit_amount DECIMAL(15,4) DEFAULT 0,
      credit_amount DECIMAL(15,4) DEFAULT 0,
      balance DECIMAL(15,4) NOT NULL,
      description VARCHAR(255),
      reference_number VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
      INDEX idx_account (account_id),
      INDEX idx_date (ledger_date),
      INDEX idx_reference (reference_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(255) NOT NULL UNIQUE,
      account_id INT,
      description TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      INDEX idx_name (category_name),
      INDEX idx_account (account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      data_type VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_key (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
  `);
}
export async function down(db) {
    const tables = [
        'invoice_items',
        'payments',
        'invoices',
        'quote_items',
        'quotations',
        'transactions',
        'ledger',
        'expense_categories',
        'tax_rates',
        'accounts',
        'pricing',
        'categories',
        'contact_groups',
        'contacts',
        'app_settings'
    ];
    for (const tbl of tables) {
        await db.execute(`DROP TABLE IF EXISTS ${tbl};`);
    }
}
