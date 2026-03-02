#!/usr/bin/env node

/**
 * PHP Data Extractor & Loader
 * 
 * Reads the PHP SQL dump (desilope_softaware.sql) and loads business data
 * into the Node.js backend's business tables.
 * 
 * Usage:
 *   node scripts/load-php-data.mjs
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const sqlDumpPath = './desilope_softaware.sql';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: 'softaware',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function main() {
  console.log('🚀 PHP Data Extraction & Loading Tool');
  console.log('=====================================\n');
  
  try {
    // Step 1: Parse SQL dump
    console.log('📖 Reading PHP SQL dump...');
    const sqlContent = fs.readFileSync(sqlDumpPath, 'utf-8');
    
    // Step 2: Extract data
    console.log('🔍 Extracting business data...');
    const data = extractBusinessData(sqlContent);
    
    // Step 3: Connect to database
    console.log('📡 Connecting to database...');
    const pool = mysql.createPool(DB_CONFIG);
    const conn = await pool.getConnection();
    
    try {
      // Step 4: Load data in order
      console.log('💾 Loading contacts...');
      await loadContacts(conn, data.contacts);
      
      console.log('💾 Loading categories...');
      await loadCategories(conn, data.categories);
      
      console.log('💾 Loading quotations...');
      await loadQuotations(conn, data.quotations);
      
      console.log('💾 Loading quote items...');
      await loadQuoteItems(conn, data.quoteItems);
      
      console.log('💾 Loading invoices...');
      await loadInvoices(conn, data.invoices);
      
      console.log('💾 Loading invoice items...');
      await loadInvoiceItems(conn, data.invoiceItems);
      
      console.log('💾 Loading payments...');
      await loadPayments(conn, data.payments);
      
      console.log('💾 Loading expense categories...');
      await loadExpenseCategories(conn, data.expenseCategories);
      
      // Step 5: Validation
      console.log('\n✅ Validating data integrity...');
      await validateData(conn, data);
      
      console.log('\n✨ Data loading completed successfully!');
      console.log('=====================================');
      console.log(`Contacts loaded: ${data.contacts.length}`);
      console.log(`Quotations loaded: ${data.quotations.length}`);
      console.log(`Quote items loaded: ${data.quoteItems.length}`);
      console.log(`Invoices loaded: ${data.invoices.length}`);
      console.log(`Invoice items loaded: ${data.invoiceItems.length}`);
      console.log(`Payments loaded: ${data.payments.length}`);
      
    } finally {
      conn.release();
      await pool.end();
    }
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Extract business data from SQL dump using regex
 */
function extractBusinessData(sqlContent: string): any {
  return {
    contacts: extractTableData(sqlContent, 'tb_contacts'),
    categories: extractTableData(sqlContent, 'tb_categories'),
    quotations: extractTableData(sqlContent, 'tb_quotations'),
    quoteItems: extractTableData(sqlContent, 'tb_quote_items'),
    invoices: extractTableData(sqlContent, 'tb_invoices'),
    invoiceItems: extractTableData(sqlContent, 'tb_invoice_items'),
    payments: extractTableData(sqlContent, 'tb_payments'),
    expenseCategories: extractTableData(sqlContent, 'tb_expense_categories'),
  };
}

/**
 * Extract INSERT data from SQL for a specific table
 */
function extractTableData(sqlContent: string, tableName: string): any[] {
  const pattern = new RegExp(
    `INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s*(.+?)(?=;|INSERT INTO|\Z)`,
    'si'
  );
  
  const match = sqlContent.match(pattern);
  if (!match) return [];
  
  const columns = match[1]
    .split(',')
    .map(col => col.trim().replace(/`/g, ''));
  
  const valueString = match[2];
  const rows: any[] = [];
  
  // Parse each row
  const rowPattern = /\(([^)]*(?:\([^)]*\))?[^)]*)\)/g;
  let rowMatch;
  
  while ((rowMatch = rowPattern.exec(valueString)) !== null) {
    const values = parseRowValues(rowMatch[1]);
    const row: any = {};
    
    columns.forEach((col, idx) => {
      row[col] = values[idx] || null;
    });
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse individual row values from SQL
 */
function parseRowValues(valueString: string): any[] {
  const values: any[] = [];
  let current = '';
  let inQuote = false;
  let inParens = 0;
  
  for (let i = 0; i < valueString.length; i++) {
    const char = valueString[i];
    const prevChar = i > 0 ? valueString[i - 1] : '';
    
    if (char === "'" && prevChar !== '\\') {
      inQuote = !inQuote;
    } else if (char === '(' && !inQuote) {
      inParens++;
    } else if (char === ')' && !inQuote) {
      inParens--;
    } else if (char === ',' && !inQuote && inParens === 0) {
      values.push(parseValue(current.trim()));
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
}

/**
 * Parse a single SQL value
 */
function parseValue(value: string): any {
  if (value === 'NULL') return null;
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/\\'/, "'");
  }
  if (!isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Load contacts data
 */
async function loadContacts(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      // Skip test data
      if (row.contact_name?.includes('Test')) continue;
      
      const [existing] = await conn.execute(
        'SELECT id FROM contacts WHERE email = ?',
        [row.contact_email]
      );
      
      if ((existing as any[]).length === 0) {
        await conn.execute(
          `INSERT INTO contacts (
            company_name, contact_person, email, phone, location, remarks, active,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            row.contact_name,
            row.contact_person || null,
            row.contact_email || null,
            row.contact_phone || null,
            row.contact_address || null,
            row.contact_notes || null,
          ]
        );
      }
    } catch (err) {
      console.warn(`⚠️  Skipping contact: ${row.contact_name}`);
    }
  }
}

/**
 * Load categories data
 */
async function loadCategories(conn: mysql.Connection, data: any[]): Promise<void> {
  // Load standard categories if not present
  const standards = [
    { category_name: 'Products', category_code: 'PROD' },
    { category_name: 'Services', category_code: 'SERV' },
  ];
  
  for (const cat of standards) {
    const [existing] = await conn.execute(
      'SELECT id FROM categories WHERE category_code = ?',
      [cat.category_code]
    );
    
    if ((existing as any[]).length === 0) {
      await conn.execute(
        'INSERT INTO categories (category_name, category_code, active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
        [cat.category_name, cat.category_code]
      );
    }
  }
}

/**
 * Load quotations data
 */
async function loadQuotations(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [existing] = await conn.execute(
        'SELECT id FROM quotations WHERE quotation_number = ?',
        [row.quotation_number]
      );
      
      if ((existing as any[]).length === 0) {
        // Get contact by name
        const [contacts] = await conn.execute(
          'SELECT id FROM contacts WHERE company_name = ? LIMIT 1',
          [row.quotation_contact_name]
        );
        
        const contactId = (contacts as any[])[0]?.id;
        if (!contactId) {
          console.warn(`⚠️  Skipping quotation ${row.quotation_number}: contact not found`);
          continue;
        }
        
        await conn.execute(
          `INSERT INTO quotations (
            quotation_number, contact_id, quotation_amount, quotation_date, remarks,
            active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            row.quotation_number,
            contactId,
            parseFloat(row.quotation_amount) || 0,
            row.quotation_date || new Date().toISOString().split('T')[0],
            row.quotation_remarks || null,
          ]
        );
      }
    } catch (err) {
      console.warn(`⚠️  Skipping quotation: ${row.quotation_number}`);
    }
  }
}

/**
 * Load quote items data
 */
async function loadQuoteItems(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [quotations] = await conn.execute(
        'SELECT id FROM quotations WHERE id = ?',
        [row.quotation_id]
      );
      
      if ((quotations as any[]).length === 0) continue;
      
      await conn.execute(
        `INSERT INTO quote_items (
          quotation_id, item_description, item_price, item_quantity, item_discount,
          active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          row.quotation_id,
          row.item_description,
          parseFloat(row.item_price) || 0,
          parseInt(row.item_quantity) || 1,
          parseFloat(row.item_discount) || 0,
        ]
      );
    } catch (err) {
      // Continue on error for items
    }
  }
}

/**
 * Load invoices data
 */
async function loadInvoices(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [existing] = await conn.execute(
        'SELECT id FROM invoices WHERE invoice_number = ?',
        [row.invoice_number]
      );
      
      if ((existing as any[]).length === 0) {
        // Get contact
        const [contacts] = await conn.execute(
          'SELECT id FROM contacts WHERE id = ?',
          [row.invoice_contact_id]
        );
        
        const contactId = (contacts as any[])[0]?.id;
        if (!contactId) continue;
        
        await conn.execute(
          `INSERT INTO invoices (
            invoice_number, contact_id, invoice_amount, invoice_date, due_date, paid,
            active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            row.invoice_number,
            contactId,
            parseFloat(row.invoice_total) || 0,
            row.invoice_date || new Date().toISOString().split('T')[0],
            row.invoice_due_date || null,
            row.invoice_paid ? 1 : 0,
          ]
        );
      }
    } catch (err) {
      console.warn(`⚠️  Skipping invoice: ${row.invoice_number}`);
    }
  }
}

/**
 * Load invoice items data
 */
async function loadInvoiceItems(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [invoices] = await conn.execute(
        'SELECT id FROM invoices WHERE id = ?',
        [row.invoice_id]
      );
      
      if ((invoices as any[]).length === 0) continue;
      
      await conn.execute(
        `INSERT INTO invoice_items (
          invoice_id, item_description, item_price, item_quantity, item_discount,
          active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          row.invoice_id,
          row.item_description,
          parseFloat(row.item_price) || 0,
          parseInt(row.item_quantity) || 1,
          parseFloat(row.item_discount) || 0,
        ]
      );
    } catch (err) {
      // Continue on error
    }
  }
}

/**
 * Load payments data
 */
async function loadPayments(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [invoices] = await conn.execute(
        'SELECT id, invoice_amount FROM invoices WHERE id = ?',
        [row.invoice_id]
      );
      
      if ((invoices as any[]).length === 0) continue;
      
      const invoice = (invoices as any[])[0];
      
      await conn.execute(
        `INSERT INTO payments (
          invoice_id, payment_date, payment_amount, payment_method, reference_number,
          active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [
          row.invoice_id,
          row.payment_date || new Date().toISOString().split('T')[0],
          parseFloat(row.payment_amount) || 0,
          row.payment_method || null,
          row.payment_reference || null,
        ]
      );
      
      // Auto-mark as paid if total >= amount
      const [payments] = await conn.execute(
        'SELECT COALESCE(SUM(payment_amount), 0) as total FROM payments WHERE invoice_id = ?',
        [row.invoice_id]
      );
      
      const totalPaid = (payments as any[])[0]?.total || 0;
      if (totalPaid >= invoice.invoice_amount) {
        await conn.execute(
          'UPDATE invoices SET paid = 1 WHERE id = ?',
          [row.invoice_id]
        );
      }
    } catch (err) {
      // Continue on error
    }
  }
}

/**
 * Load expense categories
 */
async function loadExpenseCategories(conn: mysql.Connection, data: any[]): Promise<void> {
  for (const row of data) {
    try {
      const [existing] = await conn.execute(
        'SELECT id FROM expense_categories WHERE category_code = ?',
        [row.category_code]
      );
      
      if ((existing as any[]).length === 0) {
        await conn.execute(
          `INSERT INTO expense_categories (
            category_name, category_code, active, created_at, updated_at
          ) VALUES (?, ?, 1, NOW(), NOW())`,
          [row.category_name, row.category_code]
        );
      }
    } catch (err) {
      // Continue
    }
  }
}

/**
 * Validate data integrity
 */
async function validateData(conn: mysql.Connection, data: any): Promise<void> {
  const [contactCount] = await conn.execute('SELECT COUNT(*) as cnt FROM contacts WHERE active = 1');
  const [quotationCount] = await conn.execute('SELECT COUNT(*) as cnt FROM quotations WHERE active = 1');
  const [invoiceCount] = await conn.execute('SELECT COUNT(*) as cnt FROM invoices WHERE active = 1');
  const [paymentCount] = await conn.execute('SELECT COUNT(*) as cnt FROM payments WHERE active = 1');
  
  console.log(`\n📊 Final Counts:`);
  console.log(`  Contacts: ${(contactCount as any)[0]?.cnt || 0}`);
  console.log(`  Quotations: ${(quotationCount as any)[0]?.cnt || 0}`);
  console.log(`  Invoices: ${(invoiceCount as any)[0]?.cnt || 0}`);
  console.log(`  Payments: ${(paymentCount as any)[0]?.cnt || 0}`);
}

main();
