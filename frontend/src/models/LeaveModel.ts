import api from '../services/api';

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type: 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental';
  cycle_year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: 'annual' | 'sick' | 'family_responsibility' | 'maternity' | 'parental';
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  employee_name?: string;
  employee_email?: string;
  reviewer_name?: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  family_responsibility: 'Family Responsibility',
  maternity: 'Maternity Leave',
  parental: 'Parental Leave',
};

export class LeaveModel {
  static async getBalances(userId: string, year?: number) {
    const params = year ? { year } : undefined;
    const response = await api.get<{ success: boolean; data: LeaveBalance[] }>(
      `/admin/leave/balances/${userId}`,
      { params }
    );
    return response.data.data;
  }

  static async listAllBalances(year?: number) {
    const params = year ? { year } : undefined;
    const response = await api.get<{ success: boolean; data: LeaveBalance[] }>(
      '/admin/leave/balances',
      { params }
    );
    return response.data.data;
  }

  static async updateEntitlement(balanceId: string, entitledDays: number) {
    const response = await api.put<{ success: boolean }>(
      `/admin/leave/balances/${balanceId}`,
      { entitled_days: entitledDays }
    );
    return response.data;
  }

  static async getUserRequests(userId: string, status?: string) {
    const params = status ? { status } : undefined;
    const response = await api.get<{ success: boolean; data: LeaveRequest[] }>(
      `/admin/leave/requests/${userId}`,
      { params }
    );
    return response.data.data;
  }

  static async getPendingRequests() {
    const response = await api.get<{ success: boolean; data: LeaveRequest[] }>(
      '/admin/leave/requests'
    );
    return response.data.data;
  }

  static async submitRequest(
    userId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    reason?: string
  ) {
    const response = await api.post<{ success: boolean; data: LeaveRequest }>(
      '/admin/leave/requests',
      {
        user_id: userId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
      }
    );
    return response.data.data;
  }

  static async approveRequest(requestId: string) {
    const response = await api.put<{ success: boolean; data: LeaveRequest }>(
      `/admin/leave/requests/${requestId}`,
      { action: 'approve' }
    );
    return response.data.data;
  }

  static async rejectRequest(requestId: string, rejectionReason: string) {
    const response = await api.put<{ success: boolean; data: LeaveRequest }>(
      `/admin/leave/requests/${requestId}`,
      { action: 'reject', rejection_reason: rejectionReason }
    );
    return response.data.data;
  }

  static getLeaveTypeLabel(type: string): string {
    return LEAVE_TYPE_LABELS[type] || type;
  }

  // Staff endpoints
  static async getMyBalances(year?: number) {
    const params = year ? { year } : undefined;
    const response = await api.get<{ success: boolean; data: LeaveBalance[] }>(
      '/staff/leave/balances',
      { params }
    );
    return response.data.data;
  }

  static async getMyRequests(status?: string) {
    const params = status ? { status } : undefined;
    const response = await api.get<{ success: boolean; data: LeaveRequest[] }>(
      '/staff/leave/requests',
      { params }
    );
    return response.data.data;
  }

  static async submitMyRequest(
    leaveType: string,
    startDate: string,
    endDate: string,
    reason?: string
  ) {
    const response = await api.post<{ success: boolean; data: LeaveRequest }>(
      '/staff/leave/requests',
      {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
      }
    );
    return response.data.data;
  }
}

export default LeaveModel;
