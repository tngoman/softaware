import api from '../services/api';

/**
 * Local Tasks Model — CRUD + sync operations for locally-stored tasks.
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
