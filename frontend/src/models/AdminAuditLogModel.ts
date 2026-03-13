import api from '../services/api';

/**
 * Admin Audit Log Model
 * API client for the admin audit log endpoints (SQLite-backed).
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource: string;
  resource_type: string;
  description: string;
  request_body: string;
  response_status: number;
  ip_address: string;
  user_agent: string;
  duration_ms: number;
  created_at: string;
}

export interface AuditLogQueryResult {
  success: boolean;
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditLogStats {
  total_entries: number;
  oldest_entry: string | null;
  newest_entry: string | null;
  entries_today: number;
  entries_this_week: number;
  entries_this_month: number;
  top_users: Array<{ user_email: string; count: number }>;
  top_resources: Array<{ resource_type: string; count: number }>;
  error_count: number;
  db_size_mb: number;
}

export interface AuditLogFilters {
  resource_types: string[];
  users: Array<{ user_id: string; user_email: string; user_name: string }>;
  actions: string[];
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  status_min?: number;
  status_max?: number;
}

// ── Model ────────────────────────────────────────────────────────────────

export class AdminAuditLogModel {
  /**
   * Get paginated audit log entries with filters
   */
  static async getAll(params: AuditLogQueryParams = {}): Promise<AuditLogQueryResult> {
    const response = await api.get<AuditLogQueryResult>('/admin/audit-log', { params });
    return response.data;
  }

  /**
   * Get audit log statistics
   */
  static async getStats(): Promise<AuditLogStats> {
    const response = await api.get<{ success: boolean; data: AuditLogStats }>('/admin/audit-log/stats');
    return response.data.data;
  }

  /**
   * Get available filter values
   */
  static async getFilters(): Promise<AuditLogFilters> {
    const response = await api.get<{ success: boolean; data: AuditLogFilters }>('/admin/audit-log/filters');
    return response.data.data;
  }

  /**
   * Trim log entries older than N days
   */
  static async trim(days: number): Promise<{ deleted: number; message: string }> {
    const response = await api.post<{ success: boolean; deleted: number; message: string }>(
      '/admin/audit-log/trim',
      { days }
    );
    return response.data;
  }

  /**
   * Delete specific log entries by IDs
   */
  static async bulkDelete(ids: number[]): Promise<{ deleted: number; message: string }> {
    const response = await api.delete<{ success: boolean; deleted: number; message: string }>(
      '/admin/audit-log/bulk',
      { data: { ids } }
    );
    return response.data;
  }

  /**
   * Purge ALL log entries
   */
  static async purge(): Promise<{ deleted: number; message: string }> {
    const response = await api.delete<{ success: boolean; deleted: number; message: string }>(
      '/admin/audit-log/purge?confirm=yes'
    );
    return response.data;
  }
}
