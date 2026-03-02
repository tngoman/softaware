// Batch update remaining page components to use models
// Run with: node update-to-models.js

const fs = require('fs');
const path = require('path');

const replacements = [
  // Import replacements
  { from: "import { quotationsApi, contactsApi } from '../services/api';", to: "import { QuotationModel, ContactModel } from '../models';" },
  { from: "import { invoicesApi, contactsApi } from '../services/api';", to: "import { InvoiceModel, ContactModel } from '../models';" },
  { from: "import { pricingApi, categoriesApi } from '../services/api';", to: "import { PricingModel, CategoryModel } from '../models';" },
  { from: "import { categoriesApi } from '../services/api';", to: "import { CategoryModel } from '../models';" },
  { from: "import { settingsApi } from '../services/api';", to: "import { SettingsModel } from '../models';" },
  { from: "import { vatReportsApi } from '../services/api';", to: "import { VatReportModel } from '../models';" },
  { from: "import { transactionsApi, expenseCategoriesApi, contactsApi } from '../services/api';", to: "import { TransactionModel, ExpenseCategoryModel, ContactModel } from '../models';" },
  { from: "import { transactionsApi, contactsApi } from '../services/api';", to: "import { TransactionModel, ContactModel } from '../models';" },
  
  // API call replacements (general patterns)
  { from: /quotationsApi\.getAll/g, to: "QuotationModel.getAll" },
  { from: /quotationsApi\.getById/g, to: "QuotationModel.getById" },
  { from: /quotationsApi\.create/g, to: "QuotationModel.create" },
  { from: /quotationsApi\.update/g, to: "QuotationModel.update" },
  { from: /quotationsApi\.delete/g, to: "QuotationModel.delete" },
  { from: /quotationsApi\.generatePDF/g, to: "QuotationModel.generatePDF" },
  { from: /quotationsApi\.sendEmail/g, to: "QuotationModel.sendEmail" },
  { from: /quotationsApi\.convertToInvoice/g, to: "QuotationModel.convertToInvoice" },
  
  { from: /invoicesApi\.getAll/g, to: "InvoiceModel.getAll" },
  { from: /invoicesApi\.getById/g, to: "InvoiceModel.getById" },
  { from: /invoicesApi\.create/g, to: "InvoiceModel.create" },
  { from: /invoicesApi\.update/g, to: "InvoiceModel.update" },
  { from: /invoicesApi\.delete/g, to: "InvoiceModel.delete" },
  { from: /invoicesApi\.markAsPaid/g, to: "InvoiceModel.markAsPaid" },
  { from: /invoicesApi\.generatePDF/g, to: "InvoiceModel.generatePDF" },
  { from: /invoicesApi\.sendEmail/g, to: "InvoiceModel.sendEmail" },
  
  { from: /contactsApi\.getAll/g, to: "ContactModel.getAll" },
  { from: /contactsApi\.getById/g, to: "ContactModel.getById" },
  { from: /contactsApi\.getStatementData/g, to: "ContactModel.getStatementData" },
  
  { from: /pricingApi\.getAll/g, to: "PricingModel.getAll" },
  { from: /pricingApi\.getById/g, to: "PricingModel.getById" },
  { from: /pricingApi\.create/g, to: "PricingModel.create" },
  { from: /pricingApi\.update/g, to: "PricingModel.update" },
  { from: /pricingApi\.delete/g, to: "PricingModel.delete" },
  
  { from: /categoriesApi\.getAll/g, to: "CategoryModel.getAll" },
  { from: /categoriesApi\.getById/g, to: "CategoryModel.getById" },
  { from: /categoriesApi\.create/g, to: "CategoryModel.create" },
  { from: /categoriesApi\.update/g, to: "CategoryModel.update" },
  { from: /categoriesApi\.delete/g, to: "CategoryModel.delete" },
  
  { from: /settingsApi\.get/g, to: "SettingsModel.get" },
  { from: /settingsApi\.update/g, to: "SettingsModel.update" },
  
  { from: /vatReportsApi\.vat201/g, to: "VatReportModel.vat201" },
  { from: /vatReportsApi\.itr14/g, to: "VatReportModel.itr14" },
  { from: /vatReportsApi\.irp6/g, to: "VatReportModel.irp6" },
  
  { from: /transactionsApi\.getAll/g, to: "TransactionModel.getAll" },
  { from: /transactionsApi\.getById/g, to: "TransactionModel.getById" },
  { from: /transactionsApi\.create/g, to: "TransactionModel.create" },
  { from: /transactionsApi\.update/g, to: "TransactionModel.update" },
  { from: /transactionsApi\.delete/g, to: "TransactionModel.delete" },
  
  { from: /expenseCategoriesApi\.getAll/g, to: "ExpenseCategoryModel.getAll" },
  
  // Response.data patterns
  { from: /const response = await (QuotationModel|InvoiceModel|ContactModel|PricingModel|CategoryModel|SettingsModel|VatReportModel|TransactionModel|ExpenseCategoryModel)\.([a-zA-Z]+)\((.*?)\);[\s\n]+([a-zA-Z]+) = response\.data/g, to: "const $4 = await $1.$2($3)" },
];

const files = [
  '../react-app/src/pages/Quotations.tsx',
  '../react-app/src/pages/Invoices.tsx',
  '../react-app/src/pages/Pricing.tsx',
  '../react-app/src/pages/Categories.tsx',
  '../react-app/src/pages/Settings.tsx',
  '../react-app/src/pages/VatReports.tsx',
  '../react-app/src/pages/AddExpense.tsx',
  '../react-app/src/pages/AddIncome.tsx',
  '../react-app/src/pages/Statement.tsx',
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  
  replacements.forEach(({ from, to }) => {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  });
  
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
});

console.log('\nDone! Please review the changes and test each component.');
