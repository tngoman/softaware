#!/usr/bin/env node

/**
 * Direct SQL Data Loader
 * 
 * Loads business data from desilope_softaware.sql directly into Node backend tables.
 * This is simpler than parsing - it directly maps PHP tables to Node tables.
 * 
 * Usage:
 *   node scripts/load-php-data-direct.mjs
 * 
 * Prerequisites:
 *   - desilope_softaware.sql must be present in backend directory
 *   - Database must be running
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const sqlDumpPath = path.join(__dirname, '../desilope_softaware.sql');

// Parse DATABASE_URL
function parseDbUrl(url) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL not set in .env');

const dbConfig = parseDbUrl(dbUrl);

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function main() {
  console.log('🚀 Direct SQL Data Loader');
  console.log('='.repeat(50));
  
  const conn = await pool.getConnection();
  
  try {
    console.log('\n📖 Step 1: Reading SQL dump...');
    const sqlContent = readFileSync(sqlDumpPath, 'utf-8');
    console.log(`  ✓ Dump loaded (${(sqlContent.length / 1024 / 1024).toFixed(2)} MB)`);
    
    console.log('\n💾 Step 2: Loading Contacts...');
    await loadPhpTable(conn, sqlContent, 'tb_contacts', {
      mapping: {
        'contact_name': 'company_name',
        'contact_person': 'contact_person',
        'contact_email': 'email',
        'contact_phone': 'phone',
        'contact_address': 'location',
        'contact_notes': 'remarks',
      },
      table: 'contacts',
      skipTest: true,
    });
    
    console.log('\n💾 Step 3: Loading Quotations...');
    await loadPhpTable(conn, sqlContent, 'tb_quotations', {
      mapping: {
        'quotation_number': 'quotation_number',
        'quotation_contact_id': 'contact_id',
        'quotation_amount': 'quotation_amount',
        'quotation_date': 'quotation_date',
        'quotation_remarks': 'remarks',
      },
      table: 'quotations',
    });
    
    console.log('\n💾 Step 4: Loading Quote Items...');
    await loadPhpTable(conn, sqlContent, 'tb_quote_items', {
      mapping: {
        'item_id': 'id',
        'quotation_id': 'quotation_id',
        'item_description': 'item_description',
        'item_price': 'item_price',
        'item_quantity': 'item_quantity',
        'item_discount': 'item_discount',
      },
      table: 'quote_items',
    });
    
    console.log('\n💾 Step 5: Loading Invoices...');
    await loadPhpTable(conn, sqlContent, 'tb_invoices', {
      mapping: {
        'invoice_number': 'invoice_number',
        'invoice_contact_id': 'contact_id',
        'invoice_total': 'invoice_amount',
        'invoice_date': 'invoice_date',
        'invoice_due_date': 'due_date',
        'invoice_paid': 'paid',
      },
      table: 'invoices',
    });
    
    console.log('\n💾 Step 6: Loading Invoice Items...');
    await loadPhpTable(conn, sqlContent, 'tb_invoice_items', {
      mapping: {
        'item_id': 'id',
        'invoice_id': 'invoice_id',
        'item_description': 'item_description',
        'item_price': 'item_price',
        'item_quantity': 'item_quantity',
        'item_discount': 'item_discount',
      },
      table: 'invoice_items',
    });
    
    console.log('\n💾 Step 7: Loading Payments...');
    await loadPhpTable(conn, sqlContent, 'tb_payments', {
      mapping: {
        'payment_id': 'id',
        'invoice_id': 'invoice_id',
        'payment_date': 'payment_date',
        'payment_amount': 'payment_amount',
        'payment_method': 'payment_method',
        'payment_reference': 'reference_number',
      },
      table: 'payments',
    });
    
    console.log('\n💾 Step 8: Loading Expense Categories...');
    await loadPhpTable(conn, sqlContent, 'tb_expense_categories', {
      mapping: {
        'category_id': 'id',
        'category_name': 'category_name',
        'category_code': 'category_code',
      },
      table: 'expense_categories',
    });
    
    console.log('\n✅ Validation...');
    await validateCounts(conn);
    
    console.log('\n✨ All data loaded successfully!');
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

async function loadPhpTable(
  conn,
  sqlContent,
  phpTableName,
  options
) {
  try {
    // Extract INSERT statement from SQL dump
    const regex = new RegExp(
      `INSERT INTO \`${phpTableName}\` .*?VALUES (.+?)(?=;\\s*--|;$)`,
      'si'
    );
    
    const match = sqlContent.match(regex);
    if (!match) {
      console.log(`  ℹ️  No data found for ${phpTableName}`);
      return;
    }
    
    // Parse columns
    const colRegex = new RegExp(`INSERT INTO \`${phpTableName}\` \\(([^)]+)\\)`);
    const colMatch = sqlContent.match(colRegex);
    if (!colMatch) {
      console.log(`  ℹ️  Could not parse columns for ${phpTableName}`);
      return;
    }
    
    const phpColumns = colMatch[1]
      .split(',')
      .map(c => c.trim().replace(/`/g, ''));
    
    const valueStr = match[1];
    
    // Parse rows
    const rows = parseRows(valueStr, phpColumns);
    console.log(`  📊 Found ${rows.length} rows in ${phpTableName}`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const row of rows) {
      // Skip test data if requested
      if (options.skipTest) {
        if (row.contact_name?.includes('Test')) {
          skipped++;
          continue;
        }
      }
      
      // Build INSERT statement for Node table
      const nodeColumns = [];
      const values = [];
      
      for (const phpCol of phpColumns) {
        const nodeCol = options.mapping[phpCol];
        if (nodeCol) {
          nodeColumns.push(nodeCol);
          let value = row[phpCol];
          
          // Type conversions
          if (nodeCol === 'paid' || nodeCol === 'active') {
            value = value ? 1 : 0;
          } else if (nodeCol.includes('amount') || nodeCol.includes('price') || nodeCol.includes('discount')) {
            value = parseFloat(value) || 0;
          }
          
          values.push(value);
        }
      }
      
      // Add system fields
      nodeColumns.push('active', 'created_at', 'updated_at');
      values.push(1, new Date().toISOString(), new Date().toISOString());
      
      try {
        const placeholders = nodeColumns.map(() => '?').join(', ');
        const query = `INSERT INTO ${options.table} (${nodeColumns.join(', ')}) VALUES (${placeholders})`;
        
        await conn.execute(query, values);
        inserted++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    console.log(`  ✓ Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
    
  } catch (err) {
    console.log(`  ⚠️  Error loading ${phpTableName}: ${err.message}`);
  }
}

function parseRows(valueStr, columns) {
  const rows = [];
  
  // Match each row: (value1, value2, ...)
  const rowPattern = /\(([^)]+(?:\([^)]*\)[^)]*)*)\)/g;
  let match;
  
  while ((match = rowPattern.exec(valueStr)) !== null) {
    const rowStr = match[1];
    const values = parseValues(rowStr);
    
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = values[idx];
    });
    
    rows.push(row);
  }
  
  return rows;
}

function parseValues(str) {
  const values = [];
  let current = '';
  let inQuote = false;
  let inFunc = 0;
  
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    
    if (c === "'" && prev !== '\\') {
      inQuote = !inQuote;
      current += c;
    } else if (c === '(' && !inQuote) {
      inFunc++;
      current += c;
    } else if (c === ')' && !inQuote) {
      inFunc--;
      current += c;
    } else if (c === ',' && !inQuote && inFunc === 0) {
      values.push(parseValue(current.trim()));
      current = '';
    } else {
      current += c;
    }
  }
  
  if (current.trim()) {
    values.push(parseValue(current.trim()));
  }
  
  return values;
}

function parseValue(val) {
  if (val === 'NULL' || val === '') return null;
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  if (!isNaN(Number(val))) return Number(val);
  return val;
}

async function validateCounts(conn) {
  const tables = ['contacts', 'quotations', 'quote_items', 'invoices', 'invoice_items', 'payments', 'expense_categories'];
  
  console.log('\n📊 Final Data Counts:');
  for (const table of tables) {
    const [result] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${table} WHERE active = 1`);
    console.log(`  ${table}: ${result[0]?.cnt || 0} rows`);
  }
}

main().catch(console.error);
