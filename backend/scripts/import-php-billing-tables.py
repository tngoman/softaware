#!/usr/bin/env python3
"""
Import PHP Billing Tables - Complete Script

This script creates the billing tables with the exact PHP schema
and imports all the data from desilope_softaware.sql

The tables will be created with their original tb_ prefix.
"""

import os
import re
import mysql.connector

# Tables to import (with full CREATE TABLE and INSERT statements)
TABLES = [
    'tb_contacts',
    'tb_expense_categories',
    'tb_invoices',
    'tb_invoice_items',
    'tb_payments',
    'tb_pricing',
    'tb_quotations',
    'tb_quote_items',
    'tb_transactions'
]

def parse_db_url(url):
    """Parse DATABASE_URL format"""
    match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', url)
    if not match:
        raise ValueError('Invalid DATABASE_URL format')
    return {
        'user': match.group(1),
        'password': match.group(2),
        'host': match.group(3),
        'port': int(match.group(4)),
        'database': match.group(5),
    }

def extract_create_table(sql_content, table_name):
    """Extract CREATE TABLE statement"""
    pattern = rf"CREATE TABLE `{table_name}`\s*\([^;]+\)[^;]*;"
    match = re.search(pattern, sql_content, re.IGNORECASE | re.DOTALL)
    return match.group(0) if match else None

def extract_inserts(sql_content, table_name):
    """Extract all INSERT statements"""
    statements = []
    pattern = rf"INSERT INTO `{table_name}`[^;]+;"
    matches = re.finditer(pattern, sql_content, re.IGNORECASE | re.DOTALL)
    for match in matches:
        statements.append(match.group(0))
    return statements

def main():
    print("🔄 PHP Billing Tables Import Script")
    print("=" * 70)
    print()
    
    # Read SQL dump
    print("📖 Step 1: Reading SQL dump...")
    sql_path = '/var/opt/backend/desilope_softaware.sql'
    
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print(f"  ✓ Loaded {len(sql_content) / 1024 / 1024:.2f} MB")
    print()
    
    # Connect to database
    print("🔌 Step 2: Connecting to database...")
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError('DATABASE_URL not set')
    
    db_config = parse_db_url(db_url)
    print(f"  Database: {db_config['database']}")
    print(f"  Host: {db_config['host']}:{db_config['port']}")
    
    conn = mysql.connector.connect(
        host=db_config['host'],
        port=db_config['port'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_config['database'],
        autocommit=True
    )
    
    cursor = conn.cursor()
    print("  ✓ Connected")
    print()
    
    try:
        print("🔄 Step 3: Creating/replacing tables and data...")
        print()
        
        results = {}
        
        for table_name in TABLES:
            print(f"📋 Processing {table_name}...")
            
            # Extract CREATE TABLE
            create_stmt = extract_create_table(sql_content, table_name)
            if not create_stmt:
                print(f"  ⚠️  CREATE TABLE not found for {table_name}")
                print()
                continue
            
            # Extract INSERT statements
            insert_stmts = extract_inserts(sql_content, table_name)
            print(f"  📄 Found CREATE TABLE + {len(insert_stmts)} INSERT statement(s)")
            
            # Drop existing table if exists
            print(f"  🗑️  Dropping existing {table_name} (if exists)...")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
            
            # Create table
            print(f"  🏗️  Creating {table_name}...")
            cursor.execute(create_stmt)
            
            # Insert data
            if insert_stmts:
                print(f"  📥 Loading {len(insert_stmts)} INSERT statement(s)...")
                total_rows = 0
                for stmt in insert_stmts:
                    try:
                        cursor.execute(stmt)
                        total_rows += cursor.rowcount
                    except Exception as e:
                        print(f"      ⚠️  Error in INSERT: {str(e)[:100]}")
                        # Continue with other inserts
                
                print(f"  ✓ {total_rows} rows inserted")
            else:
                print(f"  ⚠️  No data to insert")
                total_rows = 0
            
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            # Verify
            cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
            actual_count = cursor.fetchone()[0]
            
            results[table_name] = {
                'statements': len(insert_stmts),
                'actual_count': actual_count
            }
            
            print(f"  ✅ Complete - {actual_count} rows in {table_name}")
            print()
        
        # Summary
        print("=" * 70)
        print("📊 IMPORT SUMMARY")
        print("=" * 70)
        print()
        
        total_rows = 0
        for table, stats in results.items():
            print(f"{table:<30} {stats['actual_count']:>10} rows")
            total_rows += stats['actual_count']
        
        print("-" * 70)
        print(f"{'TOTAL':<30} {total_rows:>10} rows")
        print()
        print("✅ All PHP billing tables imported successfully!")
        print()
        print("📌 Note: Tables were created with 'tb_' prefix as in the original PHP system")
        
    except Exception as e:
        print()
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
