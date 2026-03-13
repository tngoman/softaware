import api from '../services/api';

/**
 * Local Tasks Model — CRUD + sync operations + local enhancements.
 *
 * These tasks are synced from external sources (PHP portal tasks-api,
 * software product APIs, etc.) and cached in the local database.
 */
export const LocalTasksModel = {
  // ─── Tasks ────────────────────────────────────────────────────

  /** List local tasks (paginated, filterable) */
  async getAll(params: Record<string, any> = {}) {
    const res = await api.get('/local-tasks', { params });
    return res.data;
  },

  /** Get a single local task by ID */
  async getById(id: number | string) {
    const res = await api.get(`/local-tasks/${id}`);
    return res.data;
  },

  /** Update a local task (marks as dirty for push-back on next sync) */
  async update(id: number | string, data: Record<string, any>) {
    const res = await api.put(`/local-tasks/${id}`, data);
    return res.data;
  },

  /** Soft-delete a local task */
  async delete(id: number | string) {
    const res = await api.delete(`/local-tasks/${id}`);
    return res.data;
  },

  // ─── Local Enhancements ───────────────────────────────────────

  /** Toggle bookmark on a task */
  async toggleBookmark(localId: number | string) {
    const res = await api.patch(`/local-tasks/${localId}/bookmark`);
    return res.data;
  },

  /** Set task priority */
  async setPriority(localId: number | string, priority: string) {
    const res = await api.patch(`/local-tasks/${localId}/priority`, { priority });
    return res.data;
  },

  /** Set color label */
  async setColorLabel(localId: number | string, color_label: string | null) {
    const res = await api.patch(`/local-tasks/${localId}/color-label`, { color_label });
    return res.data;
  },

  /** Set tags (full replacement) */
  async setTags(localId: number | string, tags: string[]) {
    const res = await api.patch(`/local-tasks/${localId}/tags`, { tags });
    return res.data;
  },

  /** Batch update tasks (kanban reorder, bulk priority, etc.) */
  async bulkUpdate(updates: Array<{ id: number | string; [key: string]: any }>) {
    const res = await api.patch('/local-tasks/bulk', { updates });
    return res.data;
  },

  /** Get all unique tags */
  async getTags() {
    const res = await api.get('/local-tasks/tags');
    return res.data;
  },

  /** Record a task view */
  async recordView(localId: number | string) {
    const res = await api.patch(`/local-tasks/${localId}/view`);
    return res.data;
  },

  // ─── Invoice Staging ───────────────────────────────────────────

  /** Stage selected tasks for invoicing (local only, no sync) */
  async stageForInvoice(taskIds: (string | number)[], billDate?: string) {
    const res = await api.post('/local-tasks/invoice/stage', {
      task_ids: taskIds,
      bill_date: billDate || new Date().toISOString().slice(0, 10),
    });
    return res.data;
  },

  /** Get all tasks staged for invoicing */
  async getStagedInvoices() {
    const res = await api.get('/local-tasks/invoice/staged');
    return res.data;
  },

  /** Clear all staged invoices (reset to unbilled) */
  async clearStagedInvoices() {
    const res = await api.post('/local-tasks/invoice/clear');
    return res.data;
  },

  /** Remove a single task from invoice staging */
  async unstageInvoice(localId: number | string) {
    const res = await api.post(`/local-tasks/invoice/unstage/${localId}`);
    return res.data;
  },

  /** Process all staged invoices — sync to external portal and mark as billed */
  async processStagedInvoices(apiUrl: string) {
    const res = await api.post('/local-tasks/invoice/process', { apiUrl });
    return res.data;
  },

  // ─── Billing Statement ────────────────────────────────────────

  /** Get distinct billing dates for the statement date-range picker */
  async getBillingDates(sourceId?: number) {
    const params: Record<string, any> = {};
    if (sourceId) params.source_id = sourceId;
    const res = await api.get('/local-tasks/billing-dates', { params });
    return res.data;
  },

  /** Download billing statement as Excel for a date range */
  async downloadStatementExcel(dateFrom: string, dateTo: string, sourceId?: number, allocatedHours?: number) {
    const params: Record<string, any> = { date_from: dateFrom, date_to: dateTo };
    if (sourceId) params.source_id = sourceId;
    if (allocatedHours) params.allocated_hours = allocatedHours;
    const res = await api.get('/local-tasks/statement-excel', {
      params,
      responseType: 'blob',
    });
    // Trigger browser download
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_statement_${dateFrom}_to_${dateTo}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // ─── Sources ──────────────────────────────────────────────────

  /** List all task sources */
  async getSources() {
    const res = await api.get('/local-tasks/sources');
    return res.data;
  },

  /** Register a new external task source */
  async createSource(data: {
    name: string;
    source_type?: string;
    base_url: string;
    api_key?: string;
    auth_method?: string;
    auth_header?: string;
    software_id?: number;
    sync_enabled?: boolean;
    sync_interval_min?: number;
    extra_config?: any;
  }) {
    const res = await api.post('/local-tasks/sources', data);
    return res.data;
  },

  /** Update an existing source */
  async updateSource(id: number | string, data: Record<string, any>) {
    const res = await api.put(`/local-tasks/sources/${id}`, data);
    return res.data;
  },

  /** Delete a source and all its synced tasks */
  async deleteSource(id: number | string) {
    const res = await api.delete(`/local-tasks/sources/${id}`);
    return res.data;
  },

  /** Test connectivity to a source */
  async testSource(id: number | string) {
    const res = await api.post(`/local-tasks/sources/${id}/test`);
    return res.data;
  },

  // ─── Sync ─────────────────────────────────────────────────────

  /** Check if sync is enabled */
  async getSyncEnabled() {
    const res = await api.get('/local-tasks/sync/enabled');
    return res.data;
  },

  /** Disable sync on all sources (opens a case) */
  async disableSync(reason: string, reasonDetail?: string, softwareName?: string, userId?: string, userName?: string) {
    const res = await api.post('/local-tasks/sync/disable', {
      reason,
      reason_detail: reasonDetail,
      software_name: softwareName,
      user_id: userId,
      user_name: userName,
    });
    return res.data;
  },

  /** Re-enable sync on all sources */
  async enableSync() {
    const res = await api.post('/local-tasks/sync/enable');
    return res.data;
  },

  /** Sync all enabled sources */
  async syncAll() {
    const res = await api.post('/local-tasks/sync');
    return res.data;
  },

  /** Sync a specific source */
  async syncSource(sourceId: number | string) {
    const res = await api.post(`/local-tasks/sync/${sourceId}`);
    return res.data;
  },

  /** Get sync status for all sources */
  async getSyncStatus() {
    const res = await api.get('/local-tasks/sync/status');
    return res.data;
  },

  /** Get sync history log */
  async getSyncLog(params?: { source_id?: number; limit?: number }) {
    const res = await api.get('/local-tasks/sync/log', { params });
    return res.data;
  },
};
