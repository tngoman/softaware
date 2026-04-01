export interface Contact {
  contact_id?: number;
  contact_name: string;
  contact_type: number; // 1 = customer, 2 = supplier
  contact_person?: string;
  contact_address?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_alt_phone?: string;
  contact_notes?: string;
  contact_vat?: string;
}

// Pagination interfaces
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Accounting types
export interface Account {
  account_id?: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | string;
  is_active?: number;
}

export interface LedgerEntry {
  entry_id?: number;
  entry_date: string; // YYYY-MM-DD
  description?: string;
  account_id: number;
  code?: string;
  name?: string;
  type?: string;
  debit?: number;
  credit?: number;
  linked_type?: string;
  linked_id?: number;
}

export interface Payment {
  payment_id?: number;
  payment_date: string; // YYYY-MM-DD
  payment_amount: number;
  payment_invoice: number;
  invoice_total?: number;
  invoice_id?: number;
  contact_name?: string;
  payment_processed?: number;
  processed_at?: string;
  processed_by?: number;
  transaction_id?: number;
}

// VAT-Compliant Transaction Types
export interface Transaction {
  transaction_id?: number;
  id?: number;
  transaction_date: string;
  transaction_type?: 'expense' | 'income';
  party_name?: string;
  party_vat_number?: string;
  invoice_number?: string;
  document_path?: string;
  total_amount?: number;
  vat_type?: 'standard' | 'zero' | 'exempt' | 'non-vat';
  vat_amount?: number;
  exclusive_amount?: number;
  expense_category_id?: number;
  income_type?: string;
  category_name?: string;
  category_code?: string;
  created_at?: string;
  updated_at?: string;
  transaction_payment_id?: number;
  // Accounting fields
  account_id?: number;
  account_name?: string;
  account_code?: string;
  account_type?: string;
  debit_amount?: number;
  credit_amount?: number;
  description?: string;
  reference_number?: string;
}

export interface ExpenseCategory {
  category_id: number;
  category_name: string;
  category_code: string;
  category_group?: string;
  itr14_mapping: string;
  allows_vat_claim: number;
  created_at?: string;
}

export interface VatPeriod {
  period_id: number;
  period_start: string;
  period_end: string;
  is_closed: number;
  closed_at?: string;
  vat201_generated: number;
  notes?: string;
  created_at?: string;
}

export interface Vat201Report {
  period: {
    start: string;
    end: string;
  };
  vat201: {
    field_1: number; // Value of standard-rated supplies
    field_4: number; // Output tax
    field_5: number; // Zero-rated supplies
    field_6: number; // Exempt supplies
    field_11: number; // Value of standard-rated purchases
    field_14: number; // Input tax
    field_15: number; // Zero-rated purchases
    field_19: number; // Net VAT
  };
}

export interface Itr14Report {
  year: number;
  income: {
    total_revenue: number;
    taxable_income: number;
    zero_rated_income: number;
    exempt_income: number;
  };
  expenses_by_category: Array<{
    category_name: string;
    category_code: string;
    itr14_mapping: string;
    total: number;
  }>;
  summary: {
    total_revenue: number;
    total_expenses: number;
    taxable_income: number;
    corporate_tax_27_percent: number;
  };
}

export interface Irp6Report {
  period: {
    start: string;
    to_date: string;
    days_elapsed: number;
    days_in_year: number;
  };
  actual_to_date: {
    income: number;
    expenses: number;
    profit: number;
  };
  estimated_annual: {
    income: number;
    expenses: number;
    taxable_income: number;
    tax_due_27_percent: number;
  };
}

export interface QuoteItem {
  item_id?: number;
  item_quote_id?: number;
  item_product: string;
  item_qty: number;
  item_price: number;
  item_subtotal: number;
  item_profit?: number;
  item_cost?: number;
  item_discount?: number;
  item_vat?: number;
}

export interface Quotation {
  quotation_id?: number;
  quotation_contact_id: number;
  quotation_date?: string;
  quotation_valid_until?: string;
  quotation_subtotal?: number;
  quotation_vat?: number;
  quotation_total?: number;
  quotation_discount?: number;
  quotation_notes?: string;
  terms_type?: 'ppe' | 'web';
  qty_label?: 'qty' | 'hours';
  quotation_status?: number;
  quotation_user_id?: number;
  quotation_time?: number;
  quotation_updated?: number;
  quotation_email?: string;
  quotation_subject?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  items?: QuoteItem[];
}

export interface InvoiceItem {
  item_id?: number;
  item_invoice_id?: number;
  item_product: string;
  item_qty: number;
  item_price: number;
  item_subtotal: number;
  item_profit?: number;
  item_cost?: number;
  item_discount?: number;
  item_vat?: number;
}

export interface Invoice {
  invoice_id?: number;
  invoice_contact_id: number;
  invoice_date?: string;
  invoice_due_date?: string;
  invoice_valid_until?: string; // Backend field (same as invoice_due_date)
  invoice_subtotal?: number;
  invoice_vat?: number;
  invoice_total?: number;
  invoice_discount?: number;
  invoice_notes?: string;
  invoice_status?: number;
  invoice_payment_status?: number; // 0 = pending, 1 = paid, 2 = overdue
  invoice_payment_date?: string;
  invoice_user_id?: number;
  invoice_updated?: number;
  invoice_email?: string;
  invoice_subject?: string;
  invoice_quote_id?: number;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  items?: InvoiceItem[];
}

export interface PurchaseOrderItem {
  item_id?: number;
  item_po_id?: number;
  item_product: string;
  item_qty: number;
  item_cost: number;
  item_price: number;
  item_subtotal: number;
  item_discount?: number;
  item_vat?: number;
}

export interface PurchaseOrder {
  po_id?: number;
  po_number?: string;
  po_contact_id: number;
  po_invoice_id?: number;
  po_amount?: number;
  po_subtotal?: number;
  po_vat?: number;
  po_total?: number;
  po_date?: string;
  po_due_date?: string;
  po_status?: number; // 0=draft, 1=sent, 2=received, 3=cancelled
  po_user_id?: number;
  po_notes?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_vat?: string;
  contact_address?: string;
  items?: PurchaseOrderItem[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  is_admin: boolean;
  is_staff?: boolean;
  is_active: boolean;
  ai_developer_tools_granted?: boolean | number;
  created_at?: string;
  updated_at?: string;
  // Role and permission data
  role?: {
    id: number;
    name: string;
    slug: string;
  };
  roles?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  permissions?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  // Two-factor authentication
  two_factor_enabled?: boolean;
  two_factor_method?: 'totp' | 'email' | 'sms';
  // OAuth
  oauth_provider?: string | null;
  // Legacy fields for compatibility
  user_id?: number;
  user_email?: string;
  user_name?: string;
  role_name?: string;
}

export interface Role {
  role_id: number;
  role_name: string;
  permissions?: string;
}

export interface Category {
  category_id: number;
  category_name: string;
}

export interface PricingItem {
  pricing_id: number;
  pricing_price: number;
  pricing_note?: string;
  pricing_item: string;
  pricing_unit?: string;
  pricing_category: string; // Keep for backward compatibility during migration
  pricing_category_id?: number; // New field for category ID
  category_name?: string; // For joined queries
}

export interface Settings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_vat: string;
  company_logo: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: string;
}

/* ── Software (update_software table) ─────────────────────── */
export interface Software {
  id: number;
  name: string;
  software_key: string;
  description?: string;
  has_external_integration?: boolean | number;
  external_username?: string;
  external_password?: string;
  external_live_url?: string;
  external_test_url?: string;
  external_mode?: 'live' | 'development' | 'test';
  linked_codebase?: string;
  order_number?: number;
  created_by?: string;
  created_by_name?: string;
  latest_version?: string;
  latest_update_date?: string;
  total_updates?: number;
}

/* ── Task (from external software API) ────────────────────── */
export interface Task {
  id: string | number;
  title: string;
  description?: string;
  notes?: string;
  status: 'new' | 'in-progress' | 'completed' | 'progress' | 'pending';
  type: 'development' | 'bug-fix' | 'feature' | 'maintenance' | 'support';
  hours: string;
  estimated_hours?: number | string;
  estimatedHours?: string;
  created_at?: string;
  start?: string;
  end?: string;
  time?: string;
  due_date?: string;
  actual_start?: string | null;
  actual_end?: string | null;
  creator?: string;
  created_by_name?: string;
  workflow_phase?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  module_id?: number | null;
  module_name?: string | null;
  software_id?: number | null;
  task_bill_date?: string | null;
  task_billed?: number;
  approval_required?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  task_order?: number | null;
  order?: number | null;
  parent_task_id?: number | null;
  association_type?: string | null;
  association_notes?: string | null;
  backgroundColor?: string;
  date?: string;
  // Local enhancement fields
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  is_bookmarked?: number;
  color_label?: string | null;
  local_tags?: string[] | null;
  kanban_order?: number;
  view_count?: number;
  last_viewed_at?: string | null;
  // Local tracking (set by useTasks hook)
  _local_id?: number;
  _source_id?: number;
  _source_name?: string;
  _local_dirty?: number;
  _last_synced_at?: string;
}

/* ── Bug (bug tracking system) ────────────────────────────── */
export interface Bug {
  id: number;
  title: string;
  description?: string | null;
  current_behaviour?: string | null;
  expected_behaviour?: string | null;
  reporter_name: string;
  software_id?: number | null;
  software_name?: string | null;
  status: 'open' | 'in-progress' | 'pending-qa' | 'resolved' | 'closed' | 'reopened';
  severity: 'critical' | 'high' | 'medium' | 'low';
  workflow_phase: 'intake' | 'qa' | 'development';
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  linked_task_id?: number | null;
  converted_from_task?: number;
  converted_to_task?: number | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Computed fields from list query
  comment_count?: number;
  attachment_count?: number;
  last_comment?: string | null;
  // Populated on detail query
  comments?: BugComment[];
  attachments?: BugAttachment[];
  linked_task?: { id: number; title: string; status: string; workflow_phase?: string; external_id?: string } | null;
}

export interface BugComment {
  id: number;
  bug_id: number;
  author_name: string;
  author_id?: string | null;
  content: string;
  is_internal: number;
  comment_type: 'comment' | 'workflow_change' | 'status_change' | 'resolution';
  created_at: string;
  updated_at?: string;
}

export interface BugAttachment {
  id: number;
  bug_id: number;
  filename: string;
  original_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  file_path: string;
  uploaded_by?: string | null;
  uploaded_by_id?: string | null;
  created_at: string;
}