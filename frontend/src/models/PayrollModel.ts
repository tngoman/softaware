import api from '../services/api';

export interface PayrollProfile {
  id?: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  employment_date: string;
  id_number?: string | null;
  tax_number?: string | null;
  bank_name?: string | null;
  branch_code?: string | null;
  account_number?: string | null;
  account_number_masked?: string | null;
  account_type?: 'cheque' | 'savings' | 'transmission' | null;
  account_holder_name?: string | null;
  has_banking?: boolean;
  profile_complete?: boolean;
  has_pending_banking_request?: boolean;
}

export interface PayrollProfileListItem {
  user_id: string;
  name: string;
  email: string;
  is_admin?: boolean;
  is_staff?: boolean;
  profile: PayrollProfile | null;
}

export interface PayrollLineItem {
  id?: string;
  category?: 'deduction' | 'allowance';
  type: string;
  label: string;
  amount_cents: number;
  sort_order?: number;
}

export interface SalaryConfig {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  employment_date?: string | null;
  gross_salary_cents: number;
  effective_from: string;
  notes?: string | null;
  deductions: PayrollLineItem[];
  allowances: PayrollLineItem[];
  total_deductions_cents: number;
  total_allowances_cents: number;
  net_salary_cents: number;
}

export interface Payslip {
  id: string;
  reference_number: string;
  user_id?: string;
  employee_name?: string;
  employee_email?: string;
  pay_month: number;
  pay_year: number;
  gross_salary_cents: number;
  total_deductions_cents: number;
  total_allowances_cents: number;
  net_salary_cents: number;
  status: 'generated' | 'voided';
  generated_at: string;
}

export interface BankingRequestStatus {
  id: string;
  bank_name: string;
  branch_code: string;
  account_number_masked: string;
  account_type: string;
  account_holder_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export class PayrollModel {
  static async listProfiles(params?: { status?: string; search?: string }) {
    const response = await api.get<{ success: boolean; data: PayrollProfileListItem[] }>('/admin/payroll/profiles', { params });
    return response.data.data;
  }

  static async getProfile(userId: string) {
    const response = await api.get<{ success: boolean; data: PayrollProfile }>(`/admin/payroll/profiles/${userId}`);
    return response.data.data;
  }

  static async saveProfile(userId: string, payload: Partial<PayrollProfile>) {
    const response = await api.put<{ success: boolean; data: PayrollProfile }>(`/admin/payroll/profiles/${userId}`, payload);
    return response.data.data;
  }

  static async deleteProfile(userId: string) {
    const response = await api.delete<{ success: boolean }>(`/admin/payroll/profiles/${userId}`);
    return response.data;
  }

  static async listSalaries(params?: { has_salary?: string; search?: string }) {
    const response = await api.get<{ success: boolean; data: Array<{ user_id: string; name: string; email: string; employment_date?: string | null; has_profile: boolean; salary: SalaryConfig | null }> }>('/admin/payroll/salaries', { params });
    return response.data.data;
  }

  static async getSalary(userId: string) {
    const response = await api.get<{ success: boolean; data: SalaryConfig }>(`/admin/payroll/salaries/${userId}`);
    return response.data.data;
  }

  static async saveSalary(userId: string, payload: {
    gross_salary_cents: number;
    effective_from?: string;
    notes?: string;
    deductions?: PayrollLineItem[];
    allowances?: PayrollLineItem[];
  }) {
    const response = await api.put<{ success: boolean; data: any }>(`/admin/payroll/salaries/${userId}`, payload);
    return response.data.data;
  }

  static async deleteSalary(userId: string) {
    const response = await api.delete<{ success: boolean }>(`/admin/payroll/salaries/${userId}`);
    return response.data;
  }

  static async listPayslips(params?: { month?: number; year?: number; user_id?: string; status?: string; page?: number; limit?: number }) {
    const response = await api.get<{ success: boolean; data: Payslip[]; pagination: any }>('/admin/payroll/payslips', { params });
    return response.data;
  }

  static async generatePayslip(payload: { user_id: string; month: number; year: number; overwrite?: boolean }) {
    const response = await api.post<{ success: boolean; data: Payslip }>('/admin/payroll/payslips/generate', payload);
    return response.data.data;
  }

  static async generateBulkPayslips(payload: { month: number; year: number; overwrite?: boolean }) {
    const response = await api.post<{ success: boolean; data: any }>('/admin/payroll/payslips/generate-bulk', payload);
    return response.data.data;
  }

  static async voidPayslip(id: string) {
    const response = await api.delete<{ success: boolean }>(`/admin/payroll/payslips/${id}`);
    return response.data;
  }

  static async getSummary(params?: { month?: number; year?: number }) {
    const response = await api.get<{ success: boolean; data: any }>('/admin/payroll/summary', { params });
    return response.data.data;
  }

  static async listBankingRequests(params?: { status?: string; user_id?: string }) {
    const response = await api.get<{ success: boolean; data: any[] }>('/admin/payroll/banking-requests', { params });
    return response.data.data;
  }

  static async approveBankingRequest(id: string) {
    const response = await api.post<{ success: boolean; data: any }>(`/admin/payroll/banking-requests/${id}/approve`);
    return response.data.data;
  }

  static async rejectBankingRequest(id: string, reason: string) {
    const response = await api.post<{ success: boolean; data: any }>(`/admin/payroll/banking-requests/${id}/reject`, { reason });
    return response.data.data;
  }

  static async downloadAdminPayslipPdf(id: string) {
    const response = await api.get(`/admin/payroll/payslips/${id}/pdf`, { responseType: 'blob' });
    return response.data as Blob;
  }

  static async getMyProfile() {
    const response = await api.get<{ success: boolean; data: PayrollProfile }>('/staff/payroll/profile');
    return response.data.data;
  }

  static async getMyPayslips(year?: number) {
    const response = await api.get<{ success: boolean; data: Payslip[] }>('/staff/payroll/payslips', { params: year ? { year } : undefined });
    return response.data.data;
  }

  static async getMyBankingRequest() {
    const response = await api.get<{ success: boolean; data: BankingRequestStatus | null }>('/staff/payroll/banking-request');
    return response.data.data;
  }

  static async submitMyBankingRequest(payload: {
    bank_name: string;
    branch_code: string;
    account_number: string;
    account_type: 'cheque' | 'savings' | 'transmission';
    account_holder_name: string;
  }) {
    const response = await api.post<{ success: boolean; data: BankingRequestStatus }>('/staff/payroll/banking-request', payload);
    return response.data.data;
  }

  static async downloadMyPayslipPdf(id: string) {
    const response = await api.get(`/staff/payroll/payslips/${id}/pdf`, { responseType: 'blob' });
    return response.data as Blob;
  }
}
