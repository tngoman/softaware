-- Load Sample Business Data into Node Backend
-- Representative samples from PHP database for testing and validation

-- CONTACTS
INSERT IGNORE INTO contacts (company_name, contact_person, email, phone, location, remarks, active, created_at, updated_at) VALUES
('Rely Precisions', 'Muzi', 'muzis@rely.co.za', '+27 11 914 1640', 'Commissioner Street Boksburg', NULL, 1, NOW(), NOW()),
('Hennox Supplies', 'Rasheed', 'bordersales2@hennoxsupplies.co.za', '011 397 6319', '1 Quality Road Isando', NULL, 1, NOW(), NOW()),
('Pinnacle Weld', 'Loveness', 'sales10@pinnacleweld.co.za', '011 824 0001', '451 Bergvlei Rd, Wadeville', NULL, 1, NOW(), NOW()),
('Cattells', 'Mary-Anne', 'sales@cattells.co.za', '011 363 3363', 'Nuffield Springs', NULL, 1, NOW(), NOW()),
('Procon', 'Rene', 'sales8@gloves.co.za', '011 917 9402', '60 All Black Road Anderbolt Boksburg', NULL, 1, NOW(), NOW()),
('Stitch Direct', 'Carel', 'info@stichdirect.co.za', '011 892 4657', 'Anderbolt Boksburg', NULL, 1, NOW(), NOW()),
('Bora Mining Services', 'Zoe', 'zodwa@boramining.co.za', '010 130 1730', 'Whitby Manor Office Estate, Noordwyk Midrand', NULL, 1, NOW(), NOW()),
('Aquajet', 'Sinah', 'info@aquajet.co.za', '011 908 5550', '15B Barium Road, Alrode Alberton', NULL, 1, NOW(), NOW()),
('Trencon', 'Zenobia', 'zenobia@trencon.co.za', '011 451 8000', '42 Main Road Eastleigh Edenvale', NULL, 1, NOW(), NOW()),
('AM Hengtong', 'Poko', 'sndobeni@amhengtong.co.za', '+27 10 030 0195', 'Kempton Park', NULL, 1, NOW(), NOW());

-- CATEGORIES
INSERT IGNORE INTO categories (category_name, description, created_at, updated_at) VALUES
('Products', 'Physical products and supplies', NOW(), NOW()),
('Services', 'Service offerings and consulting', NOW(), NOW()),
('Consulting', 'Professional consulting services', NOW(), NOW()),
('Equipment', 'Equipment rental and sales', NOW(), NOW()),
('Support', 'Support and maintenance services', NOW(), NOW());

-- TAX RATES
INSERT IGNORE INTO tax_rates (tax_name, tax_percentage, created_at, updated_at) VALUES
('Standard VAT (15%)', 15.00, NOW(), NOW()),
('Zero Rated', 0.00, NOW(), NOW()),
('Reduced Rate (10%)', 10.00, NOW(), NOW());

-- EXPENSE CATEGORIES
INSERT IGNORE INTO expense_categories (category_name, active, created_at, updated_at) VALUES
('Rent', 1, NOW(), NOW()),
('Telephone & Internet', 1, NOW(), NOW()),
('Printing & Stationery', 1, NOW(), NOW()),
('Bank Charges', 1, NOW(), NOW()),
('Cost of Sales', 1, NOW(), NOW()),
('Repairs & Maintenance', 1, NOW(), NOW()),
('Vehicle Expenses', 1, NOW(), NOW()),
('Consulting Fees', 1, NOW(), NOW()),
('Entertainment', 1, NOW(), NOW()),
('Salaries & Wages', 1, NOW(), NOW()),
('Office Supplies', 1, NOW(), NOW()),
('Insurance', 1, NOW(), NOW()),
('Legal & Accounting', 1, NOW(), NOW()),
('Marketing & Advertising', 1, NOW(), NOW()),
('Utilities', 1, NOW(), NOW()),
('Travel', 1, NOW(), NOW()),
('Subscriptions & Licenses', 1, NOW(), NOW()),
('Bad Debts', 1, NOW(), NOW()),
('Other Expenses', 1, NOW(), NOW());

-- QUOTATIONS
INSERT IGNORE INTO quotations (quotation_number, contact_id, quotation_amount, quotation_date, remarks, active, created_at, updated_at) VALUES
('QT-2026-001', 1, 5000.00, '2026-02-01', 'Initial quotation for Rely Precisions', 1, NOW(), NOW()),
('QT-2026-002', 2, 8500.50, '2026-02-05', 'Supply quotation for Hennox', 1, NOW(), NOW()),
('QT-2026-003', 3, 3200.00, '2026-02-10', 'Welding services quotation', 1, NOW(), NOW()),
('QT-2026-004', 4, 1500.00, '2026-02-12', 'Casual supplies', 1, NOW(), NOW()),
('QT-2026-005', 5, 6750.25, '2026-02-15', 'Equipment supply', 1, NOW(), NOW());

-- QUOTE ITEMS
INSERT IGNORE INTO quote_items (quotation_id, item_description, item_price, item_quantity, item_discount, created_at, updated_at) VALUES
(1, 'Professional Consulting Services', 500.00, 5, 0.00, NOW(), NOW()),
(1, 'Equipment Rental - Weekly', 200.00, 5, 100.00, NOW(), NOW()),
(2, 'Steel Pipes (various)', 1200.00, 7, 0.00, NOW(), NOW()),
(2, 'Installation Labor', 150.00, 1, 0.00, NOW(), NOW()),
(3, 'Welding Rods - Box', 450.00, 4, 0.00, NOW(), NOW()),
(4, 'Safety Gear Package', 300.00, 5, 0.00, NOW(), NOW()),
(5, 'Industrial Sealant - Bulk', 800.00, 8, 200.00, NOW(), NOW());

-- INVOICES
INSERT IGNORE INTO invoices (invoice_number, contact_id, invoice_amount, invoice_date, due_date, paid, remarks, active, created_at, updated_at) VALUES
('INV-2026-001', 1, 5000.00, '2026-02-01', '2026-03-01', 0, NULL, 1, NOW(), NOW()),
('INV-2026-002', 2, 8500.50, '2026-02-05', '2026-03-05', 1, NULL, 1, NOW(), NOW()),
('INV-2026-003', 3, 3200.00, '2026-02-10', '2026-03-10', 0, NULL, 1, NOW(), NOW()),
('INV-2026-004', 4, 1500.00, '2026-02-12', '2026-02-26', 0, NULL, 1, NOW(), NOW()),
('INV-2026-005', 5, 6750.25, '2026-02-15', '2026-03-15', 1, NULL, 1, NOW(), NOW());

-- INVOICE ITEMS
INSERT IGNORE INTO invoice_items (invoice_id, item_description, item_price, item_quantity, item_discount, created_at, updated_at) VALUES
(1, 'Professional Consulting Services', 500.00, 5, 0.00, NOW(), NOW()),
(1, 'Equipment Rental', 200.00, 5, 100.00, NOW(), NOW()),
(2, 'Steel Pipes', 1200.00, 7, 0.00, NOW(), NOW()),
(2, 'Installation Labor', 150.00, 1, 0.00, NOW(), NOW()),
(3, 'Welding Services', 450.00, 4, 0.00, NOW(), NOW()),
(4, 'Safety Equipment', 300.00, 5, 0.00, NOW(), NOW()),
(5, 'Sealant Products', 800.00, 8, 200.00, NOW(), NOW());

-- PAYMENTS
INSERT IGNORE INTO payments (invoice_id, payment_date, payment_amount, payment_method, reference_number, created_at, updated_at) VALUES
(2, '2026-02-15', 8500.50, 'Bank Transfer', 'TXN-2026-001', NOW(), NOW()),
(3, '2026-02-20', 1500.00, 'Bank Transfer', 'TXN-2026-002', NOW(), NOW()),
(5, '2026-02-25', 6750.25, 'Bank Transfer', 'TXN-2026-003', NOW(), NOW()),
(1, '2026-02-28', 2500.00, 'Bank Transfer', 'TXN-2026-004', NOW(), NOW()),
(4, '2026-02-26', 1500.00, 'Bank Transfer', 'TXN-2026-005', NOW(), NOW());

-- Validation Report
SELECT '📊 DATA LOAD REPORT' as report;
SELECT '' as blank;
SELECT CONCAT(table_name, ': ', row_count, ' rows') as summary
FROM (
  SELECT 'Contacts' as table_name, COUNT(*) as row_count FROM contacts WHERE active = 1
  UNION ALL
  SELECT 'Quotations', COUNT(*) FROM quotations WHERE active = 1
  UNION ALL
  SELECT 'Quote Items', COUNT(*) FROM quote_items
  UNION ALL
  SELECT 'Invoices', COUNT(*) FROM invoices WHERE active = 1
  UNION ALL
  SELECT 'Invoice Items', COUNT(*) FROM invoice_items
  UNION ALL
  SELECT 'Payments', COUNT(*) FROM payments
  UNION ALL
  SELECT 'Categories', COUNT(*) FROM categories
  UNION ALL
  SELECT 'Expense Categories', COUNT(*) FROM expense_categories WHERE active = 1
  UNION ALL
  SELECT 'Tax Rates', COUNT(*) FROM tax_rates
) stats
ORDER BY table_name;

SELECT '' as blank;
SELECT '✅ Business data load completed!' as status;
