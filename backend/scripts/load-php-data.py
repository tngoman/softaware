#!/usr/bin/env python3

"""
PHP Business Data Loader for Node Backend

This script parses the desilope_softaware.sql dump and loads business data
into the Node.js backend's business tables with proper data transformation.

Usage:
    python3 scripts/load-php-data.py
"""

import re
import mysql.connector
import os
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger()

# Load environment variables
load_dotenv()

def parse_db_url(url):
    """Parse DATABASE_URL format: mysql://user:password@host:port/database"""
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

def extract_insert_data(sql_content, table_name):
    """Extract INSERT statement data for a table"""
    # Find the CREATE TABLE statement
    pattern = rf"INSERT INTO `{table_name}` \(([^)]+)\) VALUES\s*(.+?)(?=;|INSERT INTO|\Z)"
    match = re.search(pattern, sql_content, re.IGNORECASE | re.DOTALL)
    
    if not match:
        logger.info(f"  ℹ️  No data found for {table_name}")
        return None, None
    
    # Parse columns
    columns_str = match.group(1)
    columns = [col.strip().strip('`') for col in columns_str.split(',')]
    
    # Parse rows
    rows_str = match.group(2)
    rows = []
    
    # Find all value tuples
    row_pattern = r'\(([^)]*(?:\'[^\']*\'[^)]*)*)\)'
    for row_match in re.finditer(row_pattern, rows_str):
        row_str = row_match.group(1)
        values = parse_row_values(row_str)
        if len(values) == len(columns):
            row = dict(zip(columns, values))
            rows.append(row)
    
    return columns, rows

def parse_row_values(value_str):
    """Parse individual row values from SQL"""
    values = []
    current = ''
    in_quote = False
    
    i = 0
    while i < len(value_str):
        char = value_str[i]
        prev_char = value_str[i-1] if i > 0 else ''
        
        if char == "'" and prev_char != '\\':
            in_quote = not in_quote
            current += char
        elif char == ',' and not in_quote:
            values.append(parse_value(current.strip()))
            current = ''
        else:
            current += char
        
        i += 1
    
    if current.strip():
        values.append(parse_value(current.strip()))
    
    return values

def parse_value(val):
    """Parse a single SQL value"""
    if val == 'NULL' or val == '':
        return None
    if val.startswith("'") and val.endswith("'"):
        # Remove quotes and unescape
        return val[1:-1].replace("\\'", "'").replace("\\\\", "\\")
    if val.replace('.', '', 1).isdigit():
        return float(val) if '.' in val else int(val)
    return val

def load_contacts(cursor, rows):
    """Load contacts data"""
    if not rows:
        return 0
    
    inserted = 0
    for row in rows:
        # Skip test contacts
        if row.get('contact_name', '').startswith('Test'):
            continue
        
        try:
            # Check for duplicates
            cursor.execute(
                "SELECT id FROM contacts WHERE email = %s",
                [row.get('contact_email')]
            )
            if cursor.fetchone():
                continue
            
            cursor.execute(
                """INSERT INTO contacts 
                (company_name, contact_person, email, phone, location, remarks, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, 1, NOW(), NOW())""",
                [
                    row.get('contact_name'),
                    row.get('contact_person'),
                    row.get('contact_email'),
                    row.get('contact_phone'),
                    row.get('contact_address'),
                    row.get('contact_notes'),
                ]
            )
            inserted += 1
        except Exception as e:
            logger.warning(f"    ⚠️  Skipping contact: {row.get('contact_name')} - {e}")
    
    return inserted

def load_quotations(cursor, rows):
    """Load quotations data"""
    if not rows:
        return 0
    
    inserted = 0
    for row in rows:
        try:
            # Check for duplicates
            cursor.execute(
                "SELECT id FROM quotations WHERE quotation_number = %s",
                [row.get('quotation_number')]
            )
            if cursor.fetchone():
                continue
            
            # Get contact by PHP ID
            contact_id = row.get('quotation_contact_id')
            if not contact_id:
                continue
            
            cursor.execute(
                """INSERT INTO quotations 
                (quotation_number, contact_id, quotation_amount, quotation_date, remarks, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 1, NOW(), NOW())""",
                [
                    row.get('quotation_number'),
                    contact_id,
                    float(row.get('quotation_amount') or 0),
                    row.get('quotation_date'),
                    row.get('quotation_remarks'),
                ]
            )
            inserted += 1
        except Exception as e:
            logger.warning(f"    ⚠️  Skipping quotation: {row.get('quotation_number')} - {e}")
    
    return inserted

def load_quote_items(cursor, rows):
    """Load quote items data"""
    if not rows:
        return 0
    
    inserted = 0
    for row in rows:
        try:
            # Check quotation exists
            quotation_id = row.get('quotation_id')
            cursor.execute("SELECT id FROM quotations WHERE id = %s", [quotation_id])
            if not cursor.fetchone():
                continue
            
            cursor.execute(
                """INSERT INTO quote_items 
                (quotation_id, item_description, item_price, item_quantity, item_discount, active, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 1, NOW(), NOW())""",
                [
                    quotation_id,
                    row.get('item_description'),
                    float(row.get('item_price') or 0),
                    int(row.get('item_quantity') or 1),
                    float(row.get('item_discount') or 0),
                ]
            )
            inserted += 1
        except Exception as e:
            logger.debug(f"    Skipping quote item: {e}")
    
    return inserted

def main():
    logger.info('🚀 PHP Business Data Loader')
    logger.info('=' * 50)
    
    # Load SQL dump
    logger.info('\n📖 Step 1: Reading SQL dump...')
    with open('./desilope_softaware.sql', 'r', encoding='utf-8') as f:
        sql_content = f.read()
    logger.info(f'  ✓ Dump loaded ({len(sql_content) / 1024 / 1024:.2f} MB)')
    
    # Parse DATABASE_URL
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError('DATABASE_URL not set in .env')
    
    db_config = parse_db_url(db_url)
    
    # Connect to database
    logger.info('\n📡 Connecting to database...')
    conn = mysql.connector.connect(
        host=db_config['host'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_config['database'],
        port=db_config['port'],
    )
    cursor = conn.cursor()
    
    try:
        # Load each table
        logger.info('\n💾 Step 2: Loading Contacts...')
        _, rows = extract_insert_data(sql_content, 'tb_contacts')
        count = load_contacts(cursor, rows)
        logger.info(f'  ✓ Inserted: {count} contacts')
        
        logger.info('\n💾 Step 3: Loading Quotations...')
        _, rows = extract_insert_data(sql_content, 'tb_quotations')
        count = load_quotations(cursor, rows)
        logger.info(f'  ✓ Inserted: {count} quotations')
        
        logger.info('\n💾 Step 4: Loading Quote Items...')
        _, rows = extract_insert_data(sql_content, 'tb_quote_items')
        count = load_quote_items(cursor, rows)
        logger.info(f'  ✓ Inserted: {count} quote items')
        
        # Commit all changes
        conn.commit()
        logger.info('\n✅ All changes committed')
        
        # Validation
        logger.info('\n📊 Final Data Counts:')
        for table in ['contacts', 'quotations', 'quote_items']:
            cursor.execute(f'SELECT COUNT(*) FROM {table} WHERE active = 1')
            count = cursor.fetchone()[0]
            logger.info(f'  {table}: {count} rows')
        
        logger.info('\n✨ Data loading completed successfully!')
        
    except Exception as e:
        logger.error(f'\n❌ Error: {e}')
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
