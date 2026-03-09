import api from '../services/api';
import { PricingItem, User, Role, Category, Settings, Account, LedgerEntry, Payment, ExpenseCategory, VatPeriod, Vat201Report, Itr14Report, Irp6Report, PaginationParams, PaginationResponse } from '../types';

/**
 * Pricing Model
 */
export class PricingModel {
  static async getAll(category?: string, params?: PaginationParams) {
    const queryParams: any = { ...params };
    if (category) queryParams.category = category;
    const response = await api.get<PricingItem[] | PaginationResponse<PricingItem>>('/pricing', { params: queryParams });
    return response.data;
  }

  static async getById(id: number) {
    const response = await api.get<PricingItem>(`/pricing/${id}`);
    return response.data;
  }

  static async create(item: Partial<PricingItem>) {
    const response = await api.post<{ success: boolean; id: number }>('/pricing', item);
    return response.data;
  }

  static async update(id: number, item: Partial<PricingItem>) {
    const response = await api.put<{ success: boolean }>(`/pricing/${id}`, item);
    return response.data;
  }

  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/pricing/${id}`);
    return response.data;
  }

  static async import(formData: FormData) {
    const response = await api.post<{ success: boolean; created: number; updated: number; categories_created: number }>('/pricing/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
}

/**
 * User Model
 */
export class UserModel {
  static async getAll() {
    const response = await api.get<User[]>('/users');
    return response.data;
  }

  static async getById(id: number) {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  }
}

/**
 * Role Model
 */
export class RoleModel {
  static async getAll() {
    const response = await api.get<Role[]>('/roles');
    return response.data;
  }
}

/**
 * Category Model
 */
export class CategoryModel {
  static async getAll(params?: PaginationParams) {
    const response = await api.get<any>('/categories', { params });
    const body = response.data;
    // Backend returns { success, data, pagination } — unwrap properly
    if (body?.success && body?.data) {
      if (body.pagination) {
        return { data: body.data, pagination: body.pagination };
      }
      return body.data;
    }
    return body;
  }

  static async getById(id: number) {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  }

  static async create(data: { category_name: string }) {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  }

  static async update(id: number, data: { category_name: string }) {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  }

  static async delete(id: number) {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
}

/**
 * Settings Model
 */
export class SettingsModel {
  static async get() {
    const response = await api.get<Settings>('/settings');
    return response.data;
  }

  static async update(data: Partial<Settings>) {
    const response = await api.put<{ success: boolean; message: string }>('/settings', data);
    return response.data;
  }
}

/**
 * Account Model
 */
export class AccountModel {
  static async getAll() {
    const response = await api.get<Account[]>('/accounts');
    return response.data;
  }

  static async create(account: Partial<Account>) {
    const response = await api.post<{ success: boolean; id: number }>('/accounts', account);
    return response.data;
  }
}

/**
 * Ledger Model
 */
export class LedgerModel {
  static async getAll(params?: { page?: number; limit?: number; account_id?: number; from?: string; to?: string; }) {
    const response = await api.get<PaginationResponse<LedgerEntry>>('/ledger', { params });
    return response.data;
  }
}

/**
 * Payment Model
 */
export class PaymentModel {
  static async getAll(params?: PaginationParams & { search?: string; invoice_id?: number }) {
    const response = await api.get<any>('/payments', { params });
    const body = response.data;
    if (body?.success && body?.data) {
      // If it has pagination, return the whole object minus success
      if (body.pagination) return { data: body.data, pagination: body.pagination };
      return body.data;
    }
    return body;
  }

  static async getById(id: number) {
    const response = await api.get<any>(`/payments/${id}`);
    return response.data?.data ?? response.data;
  }

  static async getByInvoice(invoiceId: number) {
    const response = await api.get<any>(`/payments/invoice/${invoiceId}`);
    const body = response.data;
    return Array.isArray(body) ? body : (body?.data ?? []);
  }

  static async getUnprocessed(params?: { invoice_id?: number; limit?: number }) {
    const response = await api.get<{ data: Payment[] }>('/payments/unprocessed', { params });
    return response.data;
  }

  static async create(payload: { 
    payment_invoice: number; 
    payment_amount: number; 
    payment_date?: string; 
    process_payment?: boolean; 
  }) {
    const response = await api.post<Payment>('/payments', payload);
    return response.data;
  }

  static async update(id: number, payload: { 
    payment_invoice?: number; 
    payment_amount?: number; 
    payment_date?: string; 
    payment_processed?: number; 
  }) {
    const response = await api.put<Payment>(`/payments/${id}`, payload);
    return response.data;
  }

  static async delete(id: number) {
    const response = await api.delete<{ success: boolean; message: string }>(`/payments/${id}`);
    return response.data;
  }

  static async process(payload: { payment_ids?: number[]; invoice_id?: number }) {
    const response = await api.post<{ processed: Array<{ payment_id: number; transaction_id?: number }>; errors: Array<{ payment_id: number; message: string }> }>('/payments/process', payload);
    return response.data;
  }
}

/**
 * Report Model
 */
export class ReportModel {
  static async trialBalance(params?: { from?: string; to?: string }) {
    const response = await api.get('/reports', { params: { type: 'trial-balance', ...(params || {}) } });
    return response.data;
  }

  static async vat(params?: { from?: string; to?: string }) {
    const response = await api.get('/reports', { params: { type: 'vat', ...(params || {}) } });
    return response.data;
  }

  static async incomeStatement(params?: { from?: string; to?: string }) {
    const response = await api.get('/reports', { params: { type: 'income-statement', ...(params || {}) } });
    return response.data;
  }
}

/**
 * Dashboard Model
 */
export class DashboardModel {
  static async getStats(period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' = 'month') {
    const response = await api.get('/dashboard/stats', { params: { period } });
    return response.data;
  }
}

/**
 * Expense Category Model
 */
export class ExpenseCategoryModel {
  static async getAll(params?: PaginationParams) {
    const response = await api.get<ExpenseCategory[] | PaginationResponse<ExpenseCategory>>('/expense-categories', { params });
    return response.data;
  }

  static async getById(id: number) {
    const response = await api.get<ExpenseCategory>(`/expense-categories/${id}`);
    return response.data;
  }

  static async create(data: Partial<ExpenseCategory>) {
    const response = await api.post<{ success: boolean; id: number }>('/expense-categories', data);
    return response.data;
  }

  static async update(id: number, data: Partial<ExpenseCategory>) {
    const response = await api.put<{ success: boolean }>(`/expense-categories/${id}`, data);
    return response.data;
  }

  static async delete(id: number) {
    const response = await api.delete<{ success: boolean }>(`/expense-categories/${id}`);
    return response.data;
  }
}

/**
 * VAT Period Model
 */
export class VatPeriodModel {
  static async getAll() {
    const response = await api.get<VatPeriod[]>('/vat-periods');
    return response.data;
  }

  static async create(data: { period_start: string; period_end: string }) {
    const response = await api.post<{ success: boolean; id: number }>('/vat-periods', data);
    return response.data;
  }

  static async update(id: number, data: { is_closed: number }) {
    const response = await api.put<{ success: boolean }>(`/vat-periods/${id}`, data);
    return response.data;
  }
}

/**
 * VAT Report Model
 */
export class VatReportModel {
  static async vat201(period_start: string, period_end: string) {
    const response = await api.get<{success: boolean; data: any}>('/vat-reports', { params: { type: 'vat201', period_start, period_end } });
    return response.data.data || response.data;
  }

  static async itr14(year: number) {
    const response = await api.get<{success: boolean; data: any}>('/vat-reports', { params: { type: 'itr14', year } });
    return response.data.data || response.data;
  }

  static async irp6(to_date?: string) {
    const response = await api.get<{success: boolean; data: any}>('/vat-reports', { params: { type: 'irp6', to_date } });
    return response.data.data || response.data;
  }
}

/**
 * Financial Report Model
 */
export class FinancialReportModel {
  static async balanceSheet(as_of_date: string) {
    const response = await api.get('/financial-reports/balance-sheet', { params: { as_of_date } });
    return response.data;
  }

  static async profitAndLoss(start_date: string, end_date: string) {
    const response = await api.get('/financial-reports/profit-loss', { params: { start_date, end_date } });
    return response.data;
  }

  static async transactionListing(start_date: string, end_date: string, type?: string) {
    const response = await api.get('/financial-reports/transaction-listing', { params: { start_date, end_date, type } });
    return response.data;
  }
}
