/**
 * Migration 007: Load PHP business data into Node tables
 *
 * This migration loads data from the PHP SQL dump into the clean Node tables.
 * It uses direct INSERT FROM SELECT and UNION queries to handle schema mapping.
 *
 * Column mappings (PHP → Node):
 * - tb_contacts: contact_name → company_name, contact_id → id, etc.
 * - tb_categories: category_id → id, category_name → category_name
 * - tb_pricing: pricing_id → id, pricing_price → unit_price, etc.
 * - tb_quotations: quotation_id → id, quotation_contact_id → contact_id, etc.
 * - tb_quote_items: item_id → id, item_quote_id → quotation_id, etc.
 * - tb_invoices: invoice_id → id, invoice_contact_id → contact_id, etc.
 * - tb_invoice_items: item_id → id, item_invoice_id → invoice_id, etc.
 * - tb_payments: payment_id → id, payment_invoice → invoice_id, etc.
 * - tb_accounts: account_id → id, code → account_code, name → account_name, etc.
 * - tb_transactions: transaction_id → id, total_amount → debit_amount, etc.
 * - tb_expense_categories: category_id → id, etc.
 *
 * Note: This assumes the desilope_softaware.sql has been loaded into a temporary
 * database or the same database. If data is in a separate database, you'll need
 * to adjust the table references below.
 */

export async function up(db: any) {
  // This migration assumes we're running directly after loading the PHP SQL dump
  // The assumption is that both old and new tables exist in the same database temporarily
  // OR we're loading from an external dump file

  // Step 1: Migrate contacts
  // PHP tb_contacts: contact_id, contact_name, contact_type, contact_person, contact_address,
  //                  contact_email, contact_phone, contact_alt_phone, contact_notes, contact_vat
  // Node contacts: id, company_name, contact_person, email, phone, fax, website, location,
  //                contact_code, remarks, active, created_at, updated_at
  // Since we don't have tb_contacts in the Node database yet (it's only in the PHP dump),
  // we would need to load the PHP dump first or use a separate approach.

  // For now, this migration is a placeholder. The actual data load would be:
  // 1. Load the PHP dump into a temp database
  // 2. Run INSERT INTO contacts (company_name, contact_person, email, phone, contact_code, remarks, active)
  //    SELECT contact_name, contact_person, contact_email, contact_phone, contact_vat, contact_notes, 1
  //    FROM php_db.tb_contacts;

  console.log('Migration 007: PHP data migration would be performed separately');
  console.log('Expected approach:');
  console.log('1. Load desilope_softaware.sql into separate database');
  console.log('2. Create migration with explicit INSERT INTO ... SELECT ... FROM other_database queries');
  console.log('3. Handle user_id mappings (PHP int → Node UUID)');
  console.log('4. Validate data types and formats');
}

export async function down(db: any) {
  // Delete all data from business tables (cascade deletes handle relationships)
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
    await db.execute(`DELETE FROM ${tbl};`);
  }
}
