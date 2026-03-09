#!/usr/bin/env node

/**
 * Replace Billing Data Script (Advanced)
 * 
 * Completely replaces data in billing-related tables with correct data
 * from desilope_softaware.sql, mapping both table names AND column names.
 * 
 * Usage:
 *   node scripts/replace-billing-data-advanced.mjs
 */

import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/var/opt/backend/.env' });

// Column mapping configurations for each table
const TABLE_CONFIGS = {
  'tb_contacts': {
    newTable: 'contacts',
    columnMap: {
      'contact_id': 'id',
      'contact_name': 'company_name',
      'contact_person': 'contact_person',
      'contact_email': 'email',
      'contact_phone': 'phone',
      'contact_alt_phone': 'fax',  // Map alt phone to fax
      'contact_address': 'location',
      'contact_notes': 'remarks',
      'contact_vat': null,  // Not mapped (skip this column)
      'contact_type': null  // Not mapped (skip this column)
    }
  },
  'tb_expense_categories': {
    newTable: 'expense_categories',
    // Will check schema and create appropriate mapping
    columnMap: null
  },
  'tb_invoices': {
    newTable: 'invoices',
    columnMap: null
  },
  'tb_invoice_items': {
    newTable: 'invoice_items',
    columnMap: null
  },
  'tb_payments': {
    newTable: 'payments',
    columnMap: null
  },
  'tb_pricing': {
    newTable: 'pricing',
    columnMap: null
  },
  'tb_quotations': {
    newTable: 'quotations',
    columnMap: null
  },
  'tb_quote_items': {
    newTable: 'quote_items',
    columnMap: null
  },
  'tb_transactions': {
    newTable: 'transactions',
    columnMap: null
  }
};

// Parse DATABASE_URL
function parseDbUrl(url) {
  const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

/**
 * Extract INSERT statements for a specific table
 */
function extractInsertStatements(sqlContent, tableName) {
  const statements = [];
  const regex = new RegExp(
    `INSERT INTO \`${tableName}\`[^;]+;`,
    'gi'
  );
  
  let match;
  while ((match = regex.exec(sqlContent)) !== null) {
    statements.push(match[0]);
  }
  
  return statements;
}

/**
 * Parse INSERT statement to extract columns and values
 */
function parseInsertStatement(statement) {
  // Extract table, columns, and values
  const match = statement.match(/INSERT INTO `([^`]+)` \(([^)]+)\) VALUES\s*(.+);/is);
  if (!match) {
    throw new Error('Could not parse INSERT statement');
  }
  
  const tableName = match[1];
  const columnsStr = match[2];
  const valuesStr = match[3];
  
  // Parse columns
  const columns = columnsStr.split(',').map(c => c.trim().replace(/`/g, ''));
  
  // Parse value rows
  const rows = [];
  const valuePattern = /\(([^)]+(?:\([^)]*\)[^)]*)?)\)/g;
  let valueMatch;
  
  while ((valueMatch = valuePattern.exec(valuesStr)) !== null) {
    const rowStr = valueMatch[1];
    const values = parseValueRow(rowStr);
    rows.push(values);
  }
  
  return { tableName, columns, rows };
}

/**
 * Parse a single row of values from INSERT statement
 */
function parseValueRow(rowStr) {
  const values = [];
  let current = '';
  let inString = false;
  let stringChar = null;
  let escaped = false;
  let depth = 0;
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }
    
    if (inString) {
      current += char;
      if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    } else {
      if (char === "'" || char === '"') {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  
  if (current.trim()) {
    values.push(current.trim());
  }
  
  return values;
}

/**
 * Transform INSERT statement with column mappings
 */
function transformInsertStatement(oldTable, newTable, columnMap, statement) {
  const parsed = parseInsertStatement(statement);
  
  // Build new column list and value mappings
  const newColumns = [];
  const valueIndexes = [];
  
  for (let i = 0; i < parsed.columns.length; i++) {
    const oldCol = parsed.columns[i];
    const newCol = columnMap[oldCol];
    
    if (newCol !== null && newCol !== undefined) {
      newColumns.push(newCol);
      valueIndexes.push(i);
    }
  }
  
  // Build transformed rows
  const transformedRows = parsed.rows.map(row => {
    const newValues = valueIndexes.map(idx => row[idx]);
    return `(${newValues.join(', ')})`;
  });
  
  // Build new INSERT statement
  const newStatement = `INSERT INTO \`${newTable}\` (${newColumns.map(c => `\`${c}\``).join(', ')}) VALUES\n${transformedRows.join(',\n')};`;
  
  return newStatement;
}

/**
 * Get table schema
 */
async function getTableSchema(conn, tableName) {
  const [columns] = await conn.query(`DESCRIBE \`${tableName}\``);
  return columns.map(c => ({
    field: c.Field,
    type: c.Type,
    null: c.Null,
    key: c.Key,
    default: c.Default
  }));
}

/**
 * Auto-generate column mapping by comparing schemas
 */
async function autoGenerateColumnMap(conn, oldTableName, newTableName, sqlContent) {
  // Get new table schema from database
  const newSchema = await getTableSchema(conn, newTableName);
  
  // Extract old table schema from SQL dump
  const createRegex = new RegExp(`CREATE TABLE \`${oldTableName}\`\\s*\\(([^;]+)\\)`, 'is');
  const match = sqlContent.match(createRegex);
  
  if (!match) {
    console.log(`    ⚠️  Could not find CREATE TABLE for ${oldTableName}, using direct mapping`);
    return null;
  }
  
  const createContent = match[1];
  const lines = createContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('KEY') && !l.startsWith('PRIMARY'));
  
  const oldColumns = lines.map(line => {
    const colMatch = line.match(/^`([^`]+)`/);
    return colMatch ? colMatch[1] : null;
  }).filter(Boolean);
  
  console.log(`    📋 Old columns: ${oldColumns.join(', ')}`);
  console.log(`    📋 New columns: ${newSchema.map(c => c.field).join(', ')}`);
  
  // Try to intelligently map columns
  const columnMap = {};
  const newFields = newSchema.map(c => c.field.toLowerCase());
  
  for (const oldCol of oldColumns) {
    const oldColLower = oldCol.toLowerCase();
    
    // Try exact match
    if (newFields.includes(oldColLower)) {
      columnMap[oldCol] = oldCol;
      continue;
    }
    
    // Try without prefix (e.g., contact_id -> id)
    const withoutPrefix = oldCol.replace(/^[a-z]+_/, '');
    if (newFields.includes(withoutPrefix.toLowerCase())) {
      columnMap[oldCol] = withoutPrefix;
      continue;
    }
    
    // Try partial matches
    let found = false;
    for (const newField of newSchema) {
      if (newField.field.toLowerCase().includes(oldColLower.split('_').pop())) {
        columnMap[oldCol] = newField.field;
        found = true;
        break;
      }
    }
    
    if (!found) {
      columnMap[oldCol] = null; // Skip this column
    }
  }
  
  console.log(`    🗺️  Column mapping:`, columnMap);
  return columnMap;
}

/**
 * Clear table
 */
async function clearTable(conn, tableName) {
  console.log(`  🗑️  Clearing ${tableName}...`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(`TRUNCATE TABLE \`${tableName}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * Load transformed data
 */
async function loadTableData(conn, transformedStatements) {
  if (transformedStatements.length === 0) {
    console.log(`  ⚠️  No data to load`);
    return 0;
  }
  
  console.log(`  📥 Loading ${transformedStatements.length} statement(s)...`);
  
  let totalRows = 0;
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  
  for (const statement of transformedStatements) {
    try {
      const [result] = await conn.query(statement);
      const affectedRows = result.affectedRows || 0;
      totalRows += affectedRows;
    } catch (err) {
      console.error(`  ❌ Error:`, err.message);
      console.error(`  Statement:`, statement.substring(0, 200) + '...');
      throw err;
    }
  }
  
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  
  return totalRows;
}

/**
 * Verify row count
 */
async function verifyCount(conn, tableName) {
  const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
  return rows[0].count;
}

async function main() {
  console.log('🔄 Billing Data Replacement Script (Advanced)');
  console.log('=' .repeat(60));
  console.log();
  
  // Read SQL dump
  console.log('📖 Step 1: Reading SQL dump...');
  const sqlPath = '/var/opt/backend/desilope_softaware.sql';
  
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }
  
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`  ✓ Loaded ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);
  console.log();
  
  // Parse database configuration
  console.log('🔌 Step 2: Connecting to database...');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not set in environment');
  }
  
  const dbConfig = parseDbUrl(dbUrl);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  Host: ${dbConfig.host}:${dbConfig.port}`);
  
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    multipleStatements: true,
  });
  
  console.log('  ✓ Connected');
  console.log();
  
  try {
    console.log('🔄 Step 3: Replacing table data...');
    console.log();
    
    const results = {};
    
    for (const [oldTableName, config] of Object.entries(TABLE_CONFIGS)) {
      console.log(`📋 Processing ${oldTableName} → ${config.newTable}...`);
      
      // Auto-generate column map if not provided
      if (!config.columnMap) {
        config.columnMap = await autoGenerateColumnMap(connection, oldTableName, config.newTable, sqlContent);
      }
      
      if (!config.columnMap) {
        console.log(`  ⚠️  Skipping ${oldTableName} - no column mapping`);
        continue;
      }
      
      // Extract INSERT statements
      const insertStatements = extractInsertStatements(sqlContent, oldTableName);
      console.log(`  📄 Found ${insertStatements.length} INSERT statement(s)`);
      
      if (insertStatements.length === 0) {
        console.log(`  ⚠️  No data found for ${oldTableName}`);
        console.log();
        continue;
      }
      
      // Transform statements
      console.log(`  🔄 Transforming statements...`);
      const transformedStatements = insertStatements.map(stmt => 
        transformInsertStatement(oldTableName, config.newTable, config.columnMap, stmt)
      );
      
      // Clear and load
      await clearTable(connection, config.newTable);
      const rowsInserted = await loadTableData(connection, transformedStatements);
      
      // Verify
      const actualCount = await verifyCount(connection, config.newTable);
      
      results[config.newTable] = {
        oldName: oldTableName,
        statements: insertStatements.length,
        rowsInserted,
        actualCount
      };
      
      console.log(`  ✓ ${actualCount} rows now in ${config.newTable}`);
      console.log();
    }
    
    // Summary
    console.log('=' .repeat(60));
    console.log('📊 REPLACEMENT SUMMARY');
    console.log('=' .repeat(60));
    console.log();
    
    let totalRows = 0;
    for (const [table, stats] of Object.entries(results)) {
      console.log(`${stats.oldName.padEnd(25)} → ${table.padEnd(20)} ${stats.actualCount.toString().padStart(6)} rows`);
      totalRows += stats.actualCount;
    }
    
    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(47)} ${totalRows.toString().padStart(6)} rows`);
    console.log();
    console.log('✅ Data replacement completed successfully!');
    
  } catch (error) {
    console.error();
    console.error('❌ Error during replacement:');
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
