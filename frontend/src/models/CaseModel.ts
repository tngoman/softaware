/**
 * Case Model
 * API layer for case management system
 */

import api from '../services/api';
import {
  Case,
  CaseComment,
  CaseActivity,
  CaseCreateInput,
  CaseUpdateInput,
  CaseAnalytics,
  HealthStatus,
} from '../types/cases';

export class CaseModel {
  // ── User-facing endpoints ──────────────────────────────────

  /** Create a new case (with AI component analysis) */
  static async create(data: CaseCreateInput): Promise<Case> {
    const res = await api.post<{ case: Case; analysis: any }>('/cases', data);
    return res.data.case;
  }

  /** Get current user's cases */
  static async getMyCases(params?: {
    status?: string;
    severity?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ cases: Case[]; pagination: any }> {
    const res = await api.get('/cases', { params });
    return res.data;
  }

  /** Get a single case by ID */
  static async getById(id: string): Promise<{ case: Case; comments: CaseComment[]; activity: CaseActivity[] }> {
    const res = await api.get(`/cases/${id}`);
    return res.data;
  }

  /** Update a case */
  static async update(id: string, data: CaseUpdateInput): Promise<Case> {
    const res = await api.patch<{ case: Case }>(`/cases/${id}`, data);
    return res.data.case;
  }

  /** Add a comment to a case */
  static async addComment(
    id: string,
    comment: string,
    isInternal = false,
    attachments?: File[]
  ): Promise<CaseComment> {
    const formData = new FormData();
    formData.append('comment', comment);
    formData.append('is_internal', String(isInternal));
    
    // Append file attachments if provided
    if (attachments && attachments.length > 0) {
      attachments.forEach(file => formData.append('attachments', file));
    }
    
    const res = await api.post<{ comment: CaseComment }>(`/cases/${id}/comments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.comment;
  }

  /** Rate a resolved case */
  static async rate(id: string, rating: number, feedback?: string): Promise<void> {
    await api.post(`/cases/${id}/rate`, { rating, feedback });
  }

  /** Delete own case (reporter or admin) */
  static async delete(id: string): Promise<void> {
    await api.delete(`/cases/${id}`);
  }

  // ── Admin endpoints ────────────────────────────────────────

  /** Get all cases (admin) */
  static async adminGetAll(params?: {
    status?: string;
    severity?: string;
    category?: string;
    source?: string;
    assigned_to?: string;
    page?: number;
    limit?: number;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<{ cases: Case[]; pagination: any; filters: any }> {
    const res = await api.get('/admin/cases', { params });
    return res.data;
  }

  /** Get case analytics (admin) */
  static async getAnalytics(): Promise<CaseAnalytics> {
    const res = await api.get('/admin/cases/analytics');
    return res.data;
  }

  /** Bulk assign cases (admin) */
  static async bulkAssign(caseIds: string[], assignedTo: number): Promise<void> {
    await api.post('/admin/cases/bulk-assign', { case_ids: caseIds, assigned_to: assignedTo });
  }

  /** Bulk update case status (admin) */
  static async bulkUpdateStatus(caseIds: string[], status: string, resolution?: string): Promise<void> {
    await api.post('/admin/cases/bulk-update-status', { case_ids: caseIds, status, resolution });
  }

  /** Get system health status (admin) */
  static async getHealthStatus(): Promise<HealthStatus> {
    const res = await api.get('/admin/cases/health');
    return res.data.health;
  }

  /** Run health checks manually (admin) — fire-and-forget, caller should re-fetch */
  static async runHealthChecks(): Promise<void> {
    await api.post('/admin/cases/health/run-checks');
  }

  /** Delete a case (admin) */
  static async adminDelete(id: string): Promise<void> {
    await api.delete(`/admin/cases/${id}`);
  }

  /** Bulk delete cases (admin) */
  static async bulkDelete(caseIds: string[]): Promise<void> {
    await api.post('/admin/cases/bulk-delete', { case_ids: caseIds });
  }
}
