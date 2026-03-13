import api from '../services/api';

/**
 * Bugs Model — CRUD, workflow, comments, attachments, task association.
 *
 * API base: /bugs
 */
export const BugsModel = {
  // ─── Bugs CRUD ────────────────────────────────────────────────

  /** List bugs (paginated, filterable) */
  async getAll(params: Record<string, any> = {}) {
    const res = await api.get('/bugs', { params });
    return res.data;
  },

  /** Get bug statistics */
  async getStats() {
    const res = await api.get('/bugs/stats');
    return res.data;
  },

  /** Get a single bug by ID (includes comments & attachments) */
  async getById(id: number | string) {
    const res = await api.get(`/bugs/${id}`);
    return res.data;
  },

  /** Create a new bug */
  async create(data: {
    title: string;
    description?: string;
    current_behaviour?: string;
    expected_behaviour?: string;
    reporter_name: string;
    software_id?: number | null;
    software_name?: string;
    severity?: string;
    assigned_to?: number | null;
    assigned_to_name?: string;
    linked_task_id?: number | null;
    created_by_name?: string;
  }) {
    const res = await api.post('/bugs', data);
    return res.data;
  },

  /** Update a bug */
  async update(id: number | string, data: Record<string, any>) {
    const res = await api.put(`/bugs/${id}`, data);
    return res.data;
  },

  /** Delete a bug */
  async delete(id: number | string) {
    const res = await api.delete(`/bugs/${id}`);
    return res.data;
  },

  // ─── Comments ─────────────────────────────────────────────────

  /** Add a comment to a bug */
  async addComment(bugId: number | string, data: {
    content: string;
    author_name: string;
    is_internal?: boolean;
    comment_type?: string;
  }) {
    const res = await api.post(`/bugs/${bugId}/comments`, data);
    return res.data;
  },

  /** Delete a comment */
  async deleteComment(bugId: number | string, commentId: number | string) {
    const res = await api.delete(`/bugs/${bugId}/comments/${commentId}`);
    return res.data;
  },

  // ─── Attachments ──────────────────────────────────────────────

  /** Upload attachment(s) */
  async uploadAttachments(bugId: number | string, files: File[], uploadedBy?: string) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (uploadedBy) formData.append('uploaded_by', uploadedBy);
    const res = await api.post(`/bugs/${bugId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** Delete an attachment */
  async deleteAttachment(bugId: number | string, attId: number | string) {
    const res = await api.delete(`/bugs/${bugId}/attachments/${attId}`);
    return res.data;
  },

  /** Get attachment download URL */
  getAttachmentUrl(bugId: number | string, attId: number | string): string {
    return `/api/bugs/${bugId}/attachments/${attId}/download`;
  },

  // ─── Workflow ─────────────────────────────────────────────────

  /** Advance bug workflow phase */
  async updateWorkflow(bugId: number | string, workflow_phase: string, user_name?: string) {
    const res = await api.put(`/bugs/${bugId}/workflow`, { workflow_phase, user_name });
    return res.data;
  },

  /** Assign bug to a user */
  async assign(bugId: number | string, data: {
    assigned_to?: number | null;
    assigned_to_name?: string | null;
    user_name?: string;
  }) {
    const res = await api.put(`/bugs/${bugId}/assign`, data);
    return res.data;
  },

  // ─── Task Association ─────────────────────────────────────────

  /** Link or unlink a task */
  async linkTask(bugId: number | string, linked_task_id: number | null) {
    const res = await api.put(`/bugs/${bugId}/link-task`, { linked_task_id });
    return res.data;
  },

  /** Convert bug to a task */
  async convertToTask(bugId: number | string, user_name?: string) {
    const res = await api.post(`/bugs/${bugId}/convert-to-task`, { user_name });
    return res.data;
  },

  /** Convert a task to a bug */
  async convertFromTask(taskId: number | string, data: {
    reporter_name: string;
    current_behaviour?: string;
    expected_behaviour?: string;
    severity?: string;
    software_name?: string;
    created_by_name?: string;
  }) {
    const res = await api.post(`/bugs/from-task/${taskId}`, data);
    return res.data;
  },
};
