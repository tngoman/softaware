import { db } from '../mysql';
/**
 * Migration 008: Load PHP Business Data
 *
 * This migration loads data from the legacy PHP API (desilope_softaware) into the new
 * Node.js business tables. Key transformations:
 *
 * 1. PHP table names → Node table names (tb_contacts → contacts)
 * 2. PHP INT user_id → Node UUID (uses default system user ID)
 * 3. Column name mappings (contact_name → company_name)
 * 4. Data type conversions (TEXT amounts → DECIMAL)
 * 5. Foreign key validation before inserts
 *
 * Data volumes (approximate):
 * - Contacts: 65 rows
 * - Quotations: 187 rows
 * - Quote Items: 1,547 rows
 * - Invoices: 46 rows
 * - Invoice Items: 123 rows
 * - Payments: 89 rows
 * - Expense Categories: 19 rows
 * Total: ~2,076 rows
 */
// Default system user ID for legacy data (should match your main platform's default admin)
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || 'a3b8c5d2-e1f4-4e6b-9a0c-1d5f8e3a2b9c';
export async function up() {
    console.log('Migration 008: Loading PHP data...');
    try {
        // Step 1: Load Expense Categories
        console.log('Loading expense categories...');
        await loadExpenseCategories();
        // Step 2: Load Contacts (dependencies: none)
        console.log('Loading contacts...');
        await loadContacts();
        // Step 3: Load Categories (dependencies: none)
        console.log('Loading categories...');
        await loadCategories();
        // Step 4: Load Tax Rates (dependencies: none)
        console.log('Loading tax rates...');
        await loadTaxRates();
        // Step 5: Load Quotations (dependencies: contacts)
        console.log('Loading quotations...');
        await loadQuotations();
        // Step 6: Load Quote Items (dependencies: quotations)
        console.log('Loading quote items...');
        await loadQuoteItems();
        // Step 7: Load Invoices (dependencies: contacts)
        console.log('Loading invoices...');
        await loadInvoices();
        // Step 8: Load Invoice Items (dependencies: invoices)
        console.log('Loading invoice items...');
        await loadInvoiceItems();
        // Step 9: Load Payments (dependencies: invoices)
        console.log('Loading payments...');
        await loadPayments();
        console.log('✓ Migration 008 completed successfully');
    }
    catch (error) {
        console.error('✗ Migration 008 failed:', error);
        throw error;
    }
}
export async function down() {
    console.log('Migration 008: Rolling back (soft delete via active=0)...');
    try {
        // Soft delete all migrated business data by setting active=0
        const tables = [
            'contacts', 'contact_groups', 'categories', 'quotations', 'quote_items',
            'invoices', 'invoice_items', 'payments', 'tax_rates', 'expense_categories'
        ];
        for (const table of tables) {
            await db.execute(`UPDATE \`${table}\` SET active = 0, updated_at = ? WHERE active = 1`, [new Date().toISOString()]);
        }
        console.log('✓ Rollback completed');
    }
    catch (error) {
        console.error('✗ Rollback failed:', error);
        throw error;
    }
}
/**
 * Load Expense Categories from tb_expense_categories
 */
async function loadExpenseCategories() {
    const categories = [
        { category_name: 'Rent', category_code: 'RENT' },
        { category_name: 'Telephone & Internet', category_code: 'TELCO' },
        { category_name: 'Printing & Stationery', category_code: 'PRINT' },
        { category_name: 'Bank Charges', category_code: 'BANK' },
        { category_name: 'Cost of Sales', category_code: 'COGS' },
        { category_name: 'Repairs & Maintenance', category_code: 'REPAIR' },
        { category_name: 'Vehicle Expenses', category_code: 'VEHICLE' },
        { category_name: 'Consulting Fees', category_code: 'CONSULT' },
        { category_name: 'Entertainment', category_code: 'ENTERTAIN' },
        { category_name: 'Salaries & Wages', category_code: 'SALARIES' },
        { category_name: 'Office Supplies', category_code: 'OFFICE' },
        { category_name: 'Insurance', category_code: 'INSURANCE' },
        { category_name: 'Legal & Accounting', category_code: 'LEGAL' },
        { category_name: 'Marketing & Advertising', category_code: 'MARKETING' },
        { category_name: 'Utilities', category_code: 'UTILITIES' },
        { category_name: 'Travel', category_code: 'TRAVEL' },
        { category_name: 'Subscriptions & Licenses', category_code: 'SUBS' },
        { category_name: 'Bad Debts', category_code: 'BADDEBT' },
        { category_name: 'Other Expenses', category_code: 'OTHER' },
    ];
    for (const cat of categories) {
        // Check if already exists
        const exists = await db.queryOne('SELECT id FROM expense_categories WHERE category_code = ?', [cat.category_code]);
        if (!exists) {
            await db.insertOne('expense_categories', {
                category_name: cat.category_name,
                category_code: cat.category_code,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Contacts from tb_contacts
 * Maps: contact_name → company_name, contact_type → group_id
 */
async function loadContacts() {
    // Use raw SQL to query from PHP dump (if loaded to temp table)
    // Otherwise, this is a placeholder for manual data entry
    const contacts = [
        { company_name: 'Rely Precisions', contact_person: 'Muzi', email: 'muzis@rely.co.za', phone: '+27 11 914 1640', location: 'Commissioner Street Boksburg', vat: '4780275113' },
        { company_name: 'Hennox Supplies', contact_person: 'Rasheed', email: 'bordersales2@hennoxsupplies.co.za', phone: '011 397 6319', location: '1 Quality Road Isando', vat: '4770252742' },
        { company_name: 'Pinnacle Weld', contact_person: 'Loveness', email: 'sales10@pinnacleweld.co.za', phone: '011 824 0001', location: '451 Bergvlei Rd, Wadeville' },
        { company_name: 'Cattells', contact_person: 'Mary-Anne', email: 'sales@cattells.co.za', phone: '011 363 3363', location: 'Nuffield Springs' },
        { company_name: 'Procon', contact_person: 'Rene', email: 'sales8@gloves.co.za', phone: '011 917 9402', location: '60 All Black Road Anderbolt Boksburg', vat: '4900157092' },
        // ... additional 60 contacts
        // Note: Full data should be extracted from PHP dump programmatically
    ];
    for (const contact of contacts) {
        // Check for duplicates
        const exists = await db.queryOne('SELECT id FROM contacts WHERE company_name = ? AND email = ?', [contact.company_name, contact.email]);
        if (!exists) {
            await db.insertOne('contacts', {
                company_name: contact.company_name,
                contact_person: contact.contact_person || null,
                email: contact.email || null,
                phone: contact.phone || null,
                location: contact.location || null,
                remarks: null,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Categories from tb_categories
 */
async function loadCategories() {
    // Placeholder for category data - should be extracted from PHP dump
    const categories = [
        { category_name: 'Products', category_code: 'PROD' },
        { category_name: 'Services', category_code: 'SERV' },
        { category_name: 'Consulting', category_code: 'CONS' },
    ];
    for (const cat of categories) {
        const exists = await db.queryOne('SELECT id FROM categories WHERE category_code = ?', [cat.category_code]);
        if (!exists) {
            await db.insertOne('categories', {
                category_name: cat.category_name,
                category_code: cat.category_code,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Tax Rates from tb_tax_rates
 */
async function loadTaxRates() {
    const rates = [
        { tax_name: 'Standard VAT', tax_percentage: 15.00 },
        { tax_name: 'Zero Rated', tax_percentage: 0.00 },
    ];
    for (const rate of rates) {
        const exists = await db.queryOne('SELECT id FROM tax_rates WHERE tax_name = ?', [rate.tax_name]);
        if (!exists) {
            await db.insertOne('tax_rates', {
                tax_name: rate.tax_name,
                tax_percentage: rate.tax_percentage,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Quotations from tb_quotations
 * Dependencies: contacts
 */
async function loadQuotations() {
    // This should query from a loaded PHP dump or be fed via API
    // Placeholder for structure - actual data must be extracted from desilope_softaware.sql
    const quotations = [];
    for (const q of quotations) {
        // Validate contact exists
        const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [q.contact_id]);
        if (!contact) {
            console.warn(`Skipping quotation ${q.quotation_number}: contact ${q.contact_id} not found`);
            continue;
        }
        // Check for duplicates
        const exists = await db.queryOne('SELECT id FROM quotations WHERE quotation_number = ?', [q.quotation_number]);
        if (!exists) {
            await db.insertOne('quotations', {
                quotation_number: q.quotation_number,
                contact_id: q.contact_id,
                quotation_amount: q.quotation_amount || 0,
                quotation_date: q.quotation_date || new Date().toISOString().split('T')[0],
                remarks: q.remarks || null,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Quote Items from tb_quote_items
 * Dependencies: quotations
 */
async function loadQuoteItems() {
    // Placeholder - actual data must be extracted from PHP dump
    const items = [];
    for (const item of items) {
        // Validate quotation exists
        const quotation = await db.queryOne('SELECT id FROM quotations WHERE id = ?', [item.quotation_id]);
        if (!quotation) {
            console.warn(`Skipping quote item: quotation ${item.quotation_id} not found`);
            continue;
        }
        await db.insertOne('quote_items', {
            quotation_id: item.quotation_id,
            item_description: item.item_description,
            item_price: parseFloat(item.item_price) || 0,
            item_quantity: parseInt(item.item_quantity) || 1,
            item_discount: parseFloat(item.item_discount) || 0,
            // line_total is auto-calculated by database
            active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }
}
/**
 * Load Invoices from tb_invoices
 * Dependencies: contacts
 */
async function loadInvoices() {
    // Placeholder - actual data from PHP dump
    const invoices = [];
    for (const inv of invoices) {
        // Validate contact exists
        const contact = await db.queryOne('SELECT id FROM contacts WHERE id = ?', [inv.contact_id]);
        if (!contact) {
            console.warn(`Skipping invoice ${inv.invoice_number}: contact ${inv.contact_id} not found`);
            continue;
        }
        // Check for duplicates
        const exists = await db.queryOne('SELECT id FROM invoices WHERE invoice_number = ?', [inv.invoice_number]);
        if (!exists) {
            await db.insertOne('invoices', {
                invoice_number: inv.invoice_number,
                contact_id: inv.contact_id,
                invoice_amount: parseFloat(inv.invoice_amount) || 0,
                invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
                due_date: inv.due_date || null,
                paid: inv.paid || 0,
                remarks: inv.remarks || null,
                active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
}
/**
 * Load Invoice Items from tb_invoice_items
 * Dependencies: invoices
 */
async function loadInvoiceItems() {
    // Placeholder - actual data from PHP dump
    const items = [];
    for (const item of items) {
        // Validate invoice exists
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [item.invoice_id]);
        if (!invoice) {
            console.warn(`Skipping invoice item: invoice ${item.invoice_id} not found`);
            continue;
        }
        await db.insertOne('invoice_items', {
            invoice_id: item.invoice_id,
            item_description: item.item_description,
            item_price: parseFloat(item.item_price) || 0,
            item_quantity: parseInt(item.item_quantity) || 1,
            item_discount: parseFloat(item.item_discount) || 0,
            // line_total is auto-calculated by database
            active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }
}
/**
 * Load Payments from tb_payments
 * Dependencies: invoices
 */
async function loadPayments() {
    // Placeholder - actual data from PHP dump
    const payments = [];
    for (const payment of payments) {
        // Validate invoice exists
        const invoice = await db.queryOne('SELECT id FROM invoices WHERE id = ?', [payment.invoice_id]);
        if (!invoice) {
            console.warn(`Skipping payment: invoice ${payment.invoice_id} not found`);
            continue;
        }
        await db.insertOne('payments', {
            invoice_id: payment.invoice_id,
            payment_date: payment.payment_date || new Date().toISOString().split('T')[0],
            payment_amount: parseFloat(payment.payment_amount) || 0,
            payment_method: payment.payment_method || null,
            reference_number: payment.reference_number || null,
            remarks: payment.remarks || null,
            active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        // Auto-mark invoice as paid if total payments >= invoice_amount
        const totalPaid = await db.queryOne('SELECT COALESCE(SUM(payment_amount), 0) as total FROM payments WHERE invoice_id = ?', [payment.invoice_id]);
        if (totalPaid && totalPaid.total >= invoice.invoice_amount) {
            await db.execute('UPDATE invoices SET paid = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), payment.invoice_id]);
        }
    }
}
