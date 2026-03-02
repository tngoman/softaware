/**
 * TypeScript interfaces for business tables (contacts, invoicing, accounting)
 */

export interface Contact {
  id: number;
  company_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  fax?: string;
  website?: string;
  location?: string;
  contact_code?: string;
  remarks?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ContactGroup {
  id: number;
  group_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  category_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Pricing {
  id: number;
  category_id?: number;
  item_name: string;
  description?: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  contact_id: number;
  quotation_user_id?: string;
  quotation_amount: number;
  quotation_date: string;
  remarks?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: number;
  quotation_id: number;
  item_description: string;
  item_price: number;
  item_quantity: number;
  item_discount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  contact_id: number;
  invoice_user_id?: string;
  quotation_id?: number;
  invoice_amount: number;
  invoice_date: string;
  due_date?: string;
  paid: number;
  remarks?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  item_description: string;
  item_price: number;
  item_quantity: number;
  item_discount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  payment_date: string;
  payment_amount: number;
  payment_method?: string;
  reference_number?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: number;
  tax_name: string;
  tax_percentage: number;
  description?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  account_category?: string;
  description?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  transaction_date: string;
  account_id: number;
  debit_amount: number;
  credit_amount: number;
  description?: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Ledger {
  id: number;
  ledger_date: string;
  account_id: number;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  description?: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: number;
  category_name: string;
  account_id?: number;
  description?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: number;
  setting_key: string;
  setting_value?: string;
  data_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
