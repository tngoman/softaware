#!/usr/bin/env node

/**
 * Replace Billing Data Script
 * 
 * Completely replaces data in billing-related tables with correct data
 * from desilope_softaware.sql, including IDs.
 * 
 * Tables to replace:
 * - tb_contacts
 * - tb_expense_categories
 * - tb_invoices
 * - tb_invoice_items
 * - tb_payments
 * - tb_pricing
 * - tb_quotations
 * - tb_quote_items
 * - tb_transactions
 * 
 * Usage:
 *   node scripts/replace-billing-data.mjs
 */

import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/var/opt/backend/.env' });

// Map old table names (from PHP SQL dump) to new table names (SoftAware backend)
const TABLE_MAPPING = {
  'tb_contacts': 'contacts',
  'tb_expense_categories': 'expense_categories',
  'tb_invoices': 'invoices',
  'tb_invoice_items': 'invoice_items',
  'tb_payments': 'payments',
  'tb_pricing': 'pricing',
  'tb_quotations': 'quotations',
  'tb_quote_items': 'quote_items',
  'tb_transactions': 'transactions'
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
 * Extract CREATE TABLE statement for a specific table
 */
function extractCreateStatement(sqlContent, tableName) {
  // Find the CREATE TABLE statement
  const createRegex = new RegExp(
    `CREATE TABLE \`${tableName}\`[^;]+;`,
    'si'
  );
  const match = sqlContent.match(createRegex);
  return match ? match[0] : null;
}

/**
 * Extract INSERT statements for a specific table
 */
function extractInsertStatements(sqlContent, tableName) {
  const statements = [];
  
  // Find all INSERT INTO statements for this table
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
 * Disable foreign key checks and truncate table
 */
async function clearTable(conn, tableName) {
  console.log(`  🗑️  Clearing ${tableName}...`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query(`TRUNCATE TABLE \`${tableName}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

/**
 * Load data from INSERT statements, replacing old table name with new table name
 */
async function loadTableData(conn, oldTableName, newTableName, insertStatements) {
  if (insertStatements.length === 0) {
    console.log(`  ⚠️  No data found for ${oldTableName}`);
    return 0;
  }
  
  console.log(`  📥 Loading ${insertStatements.length} INSERT statement(s) into ${newTableName}...`);
  
  let totalRows = 0;
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  
  for (const statement of insertStatements) {
    try {
      // Replace old table name with new table name
      const modifiedStatement = statement.replace(
        new RegExp(`INSERT INTO \`${oldTableName}\``, 'gi'),
        `INSERT INTO \`${newTableName}\``
      );
      
      const [result] = await conn.query(modifiedStatement);
      const affectedRows = result.affectedRows || 0;
      totalRows += affectedRows;
    } catch (err) {
      console.error(`  ❌ Error executing INSERT for ${newTableName}:`, err.message);
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
  console.log('🔄 Billing Data Replacement Script');
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
    
    for (const [oldTableName, newTableName] of Object.entries(TABLE_MAPPING)) {
      console.log(`📋 Processing ${oldTableName} → ${newTableName}...`);
      
      // Extract INSERT statements from old table name
      const insertStatements = extractInsertStatements(sqlContent, oldTableName);
      
      // Clear existing data in new table
      await clearTable(connection, newTableName);
      
      // Load new data into new table
      const rowsInserted = await loadTableData(connection, oldTableName, newTableName, insertStatements);
      
      // Verify
      const actualCount = await verifyCount(connection, newTableName);
      
      results[newTableName] = {
        oldName: oldTableName,
        statements: insertStatements.length,
        rowsInserted,
        actualCount
      };
      
      console.log(`  ✓ ${actualCount} rows now in ${newTableName}`);
      console.log();
    }
    
    // Summary
    console.log('=' .repeat(60));
    console.log('📊 REPLACEMENT SUMMARY');
    console.log('=' .repeat(60));
    console.log();
    
    let totalRows = 0;
    for (const [table, stats] of Object.entries(results)) {
      console.log(`${table.padEnd(30)} ${stats.actualCount.toString().padStart(10)} rows`);
      totalRows += stats.actualCount;
    }
    
    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(30)} ${totalRows.toString().padStart(10)} rows`);
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
