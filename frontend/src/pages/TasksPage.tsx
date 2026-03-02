import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CubeIcon,
  Squares2X2Icon,
  Bars3Icon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlayIcon,
  XMarkIcon,
  BugAntIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UserIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';
import { useSoftware } from '../hooks/useSoftware';
import { useTasks } from '../hooks/useTasks';
import { useModules } from '../hooks/useModules';
import { useAppStore } from '../store';
import { Software, Task } from '../types';

/* ═══════════════════════════════════════════════════════════════
   Tasks Page — mirrors desktop TasksPage
   ═══════════════════════════════════════════════════════════════ */

function timeToDecimal(t: string | number): number {
  if (!t) return 0;
  const s = String(t).trim();
  if (!s.includes(':')) return parseFloat(s) || 0;
  const p = s.split(':');
  return (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60 + (p[2] ? (parseInt(p[2]) || 0) / 3600 : 0);
}

function relativeDate(d?: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
  progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500', 'in-progress': 'bg-amber-500', progress: 'bg-amber-500',
  completed: 'bg-emerald-500', pending: 'bg-gray-400',
};

const PHASE_LABELS: Record<string, string> = {
  intake: 'Intake', quality_review: 'QA Review', triage: 'Triage',
  development: 'Development', verification: 'Verification', resolution: 'Resolution',
};

/* ── Task Create/Edit Dialog ─────────────────────────────────── */
const TaskDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: Task | null;
  apiUrl: string;
  softwareId?: number;
  onSaved: () => void;
}> = ({ open, onClose, task, apiUrl, softwareId, onSaved }) => {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    task_name: '', task_description: '', task_notes: '',
    task_status: 'new', task_type: 'development',
    task_hours: '0.00', task_estimated_hours: '0.00',
    task_color: '#667eea',
    software_id: '', module_id: '', assigned_to: '',
    task_created_by_name: '',
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        task_name: task.title || '',
        task_description: task.description || '',
        task_notes: '',
        task_status: task.status === 'in-progress' ? 'progress' : task.status,
        task_type: task.type || 'development',
        task_hours: task.hours || '0.00',
        task_estimated_hours: task.estimatedHours || '0.00',
        task_color: '#667eea',
        software_id: String(task.software_id || softwareId || ''),
        module_id: String(task.module_id || ''),
        assigned_to: String(task.assigned_to || ''),
        task_created_by_name: task.created_by_name || '',
      });
    } else {
      setForm({
        task_name: '', task_description: '', task_notes: '',
        task_status: 'new', task_type: 'development',
        task_hours: '0.00', task_estimated_hours: '0.00',
        task_color: '#667eea',
        software_id: String(softwareId || ''),
        module_id: '', assigned_to: '',
        task_created_by_name: '',
      });
    }
  }, [open, task, softwareId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.task_name.trim()) { toast.error('Task name is required'); return; }
    setLoading(true);
    try {
      const method = task ? 'PUT' : 'POST';
      const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.user_name || user?.email || 'Unknown';
      const est = parseFloat(form.task_estimated_hours) || 0;

      const taskData: Record<string, any> = {
        task_name: form.task_name,
        task_description: form.task_description,
        task_notes: form.task_notes,
        task_status: form.task_status,
        task_type: form.task_type,
        task_hours: form.task_hours,
        task_estimated_hours: form.task_estimated_hours,
        task_color: form.task_color,
        software_id: form.software_id,
        task_created_by_name: form.task_created_by_name || userName,
        user_name: userName,
        task_approval_required: est > 8 ? 1 : 0,
      };
      if (form.module_id) taskData.module_id = parseInt(form.module_id);
      if (form.assigned_to) taskData.assigned_to = parseInt(form.assigned_to);
      if (task) {
        taskData.task_id = task.id;
        if (task.workflow_phase) taskData.workflow_phase = task.workflow_phase;
      }

      const softwareToken = localStorage.getItem('software_token') || '';
      await api({ method, url: '/softaware/tasks', data: { apiUrl, task: taskData },
        headers: softwareToken ? { 'X-Software-Token': softwareToken } : {},
      });

      toast.success(task ? 'Task updated' : 'Task created');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{task ? 'Edit Task' : 'Create Task'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
            <input value={form.task_name} onChange={e => setForm({ ...form, task_name: e.target.value })}
              required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Enter task name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })}
              rows={4} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Describe the task in detail…" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.task_status} onChange={e => setForm({ ...form, task_status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="new">New</option>
                <option value="progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.task_type} onChange={e => setForm({ ...form, task_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="development">Development</option>
                <option value="bug-fix">Bug Fix</option>
                <option value="feature">Feature</option>
                <option value="maintenance">Maintenance</option>
                <option value="support">Support</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
              <input value={form.task_created_by_name} onChange={e => setForm({ ...form, task_created_by_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Creator name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
              <input type="number" step="0.25" min="0" value={form.task_estimated_hours}
                onChange={e => setForm({ ...form, task_estimated_hours: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Hours</label>
              <input type="number" step="0.25" min="0" value={form.task_hours}
                onChange={e => setForm({ ...form, task_hours: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.task_notes} onChange={e => setForm({ ...form, task_notes: e.target.value })}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Additional notes…" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
              {loading ? 'Saving…' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Task Details Dialog ─────────────────────────────────────── */
const TaskDetailsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: Task | null;
  apiUrl: string;
  onEdit: (t: Task) => void;
}> = ({ open, onClose, task, apiUrl, onEdit }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !task || !apiUrl) return;
    setLoadingComments(true);
    const token = localStorage.getItem('software_token') || '';
    api.get(`/softaware/tasks/${task.id}/comments`, {
      params: { apiUrl },
      headers: token ? { 'X-Software-Token': token } : {},
    })
      .then(res => {
        const list = res.data?.data || res.data?.comments || [];
        setComments(Array.isArray(list) ? list : []);
      })
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false));
  }, [open, task, apiUrl]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !task) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('software_token') || '';
      await api.post(`/softaware/tasks/${task.id}/comments`, { apiUrl, content: newComment }, {
        headers: token ? { 'X-Software-Token': token } : {},
      });
      toast.success('Comment posted');
      setNewComment('');
      // Re-fetch comments
      const res = await api.get(`/softaware/tasks/${task.id}/comments`, {
        params: { apiUrl }, headers: token ? { 'X-Software-Token': token } : {},
      });
      setComments(res.data?.data || res.data?.comments || []);
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !task) return null;

  const assignedDate = task.start || task.created_at || task.date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-xl font-semibold text-gray-900 truncate">{task.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[task.status]}`}>
                {task.status}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-gray-600">{task.type}</span>
              {task.workflow_phase && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs">
                  {PHASE_LABELS[task.workflow_phase] || task.workflow_phase}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { onClose(); onEdit(task); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
              <PencilIcon className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Created</span>
              <p className="font-medium">{assignedDate ? new Date(assignedDate).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Created By</span>
              <p className="font-medium">{task.created_by_name || task.creator || '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> Hours</span>
              <p className="font-medium">{timeToDecimal(task.hours).toFixed(2)}h</p></div>
            {task.assigned_to_name && (
              <div><span className="text-gray-500 flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Assigned To</span>
                <p className="font-medium">{task.assigned_to_name}</p></div>
            )}
            {task.module_name && (
              <div><span className="text-gray-500 flex items-center gap-1"><CubeIcon className="h-3.5 w-3.5" /> Module</span>
                <p className="font-medium">{task.module_name}</p></div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                <DocumentTextIcon className="h-4 w-4" /> Description
              </h4>
              <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border text-sm"
                dangerouslySetInnerHTML={{ __html: task.description }} />
            </div>
          )}

          {/* Approval */}
          {task.approval_required === 1 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
              task.approved_by ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {task.approved_by ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldExclamationIcon className="h-4 w-4" />}
              {task.approved_by ? `Approved by ${task.approved_by}` : 'Awaiting approval — estimated hours exceed threshold'}
            </div>
          )}

          {/* Comments */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
              <ChatBubbleLeftIcon className="h-4 w-4" /> Comments ({comments.length})
            </h4>
            {loadingComments ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No comments yet</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {comments.map((c: any, i: number) => (
                  <div key={c.comment_id || i} className="p-3 bg-gray-50 rounded-lg border text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{c.user_name || c.username || c.created_by || 'Unknown'}</span>
                      {c.created_at && <span className="text-xs text-gray-400">{relativeDate(c.created_at)}</span>}
                      {c.time_spent && <span className="text-xs text-gray-400">· {c.time_spent}h</span>}
                      {c.is_internal === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Internal</span>}
                    </div>
                    <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: c.content || c.comment || '' }} />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }} />
              <button onClick={handlePostComment} disabled={submitting || !newComment.trim()}
                className="px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Tasks Page
   ═══════════════════════════════════════════════════════════ */

const TasksPage: React.FC = () => {
  const { user } = useAppStore();
  const { software: softwareList, isLoading: softwareLoading } = useSoftware();

  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    (localStorage.getItem('tasksViewMode') as 'list' | 'grid') || 'list'
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [typeFilter, setTypeFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState<string>(() => {
    const role = (user?.role?.slug || user?.role_name || '').toLowerCase();
    switch (role) {
      case 'client_manager': return 'intake';
      case 'qa_specialist': return 'quality_review';
      case 'developer': return 'development';
      default: return 'all';
    }
  });
  const [moduleFilter, setModuleFilter] = useState('all');

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const apiUrl = useMemo(() => {
    if (!selectedSoftware) return null;
    return selectedSoftware.external_mode === 'live'
      ? selectedSoftware.external_live_url
      : selectedSoftware.external_test_url;
  }, [selectedSoftware]);

  const { tasks, loading, error, loadTasks } = useTasks({ apiUrl });
  const { modules } = useModules(selectedSoftware?.id);

  // Restore selected software
  useEffect(() => {
    const saved = localStorage.getItem('selectedTasksSoftware');
    if (saved) try { setSelectedSoftware(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  // Load tasks when apiUrl changes
  useEffect(() => {
    if (apiUrl) loadTasks();
  }, [apiUrl, loadTasks]);

  const handleSoftwareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sw = softwareList.find(s => String(s.id) === e.target.value);
    if (sw) {
      setSelectedSoftware(sw);
      localStorage.setItem('selectedTasksSoftware', JSON.stringify(sw));
    }
  };

  const uniqueModules = useMemo(() =>
    modules.map((m: any) => ({ id: m.id, name: m.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [modules]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (phaseFilter !== 'all') {
        const p = t.workflow_phase?.toLowerCase() || 'intake';
        if (p !== phaseFilter) return false;
      }
      if (moduleFilter !== 'all' && String(t.module_id) !== moduleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.creator?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, statusFilter, typeFilter, phaseFilter, moduleFilter, search]);

  const totalHours = filteredTasks.reduce((sum, t) => {
    const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
    return billed ? sum : sum + timeToDecimal(t.hours || 0);
  }, 0);

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (!apiUrl) return;
    try {
      const token = localStorage.getItem('software_token') || '';
      await api.put('/softaware/tasks', {
        apiUrl,
        task: { id: task.id, status: newStatus, user_name: user?.user_name },
      }, { headers: token ? { 'X-Software-Token': token } : {} });
      toast.success(`Task ${newStatus === 'in-progress' ? 'started' : 'completed'}`);
      loadTasks();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (task: Task) => {
    if (!apiUrl) return;
    const result = await Swal.fire({
      title: 'Delete Task',
      text: `Delete "${task.title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('software_token') || '';
      await api.delete(`/softaware/tasks/${task.id}`, {
        params: { apiUrl },
        headers: token ? { 'X-Software-Token': token } : {},
      });
      toast.success('Task deleted');
      loadTasks();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleReorder = async (task: Task, direction: 'up' | 'down') => {
    const idx = filteredTasks.indexOf(task);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= filteredTasks.length) return;
    const other = filteredTasks[targetIdx];
    try {
      const token = localStorage.getItem('software_token') || '';
      await api.post('/softaware/tasks/reorder', {
        apiUrl,
        orders: { [String(task.id)]: targetIdx + 1, [String(other.id)]: idx + 1 },
      }, { headers: token ? { 'X-Software-Token': token } : {} });
      loadTasks();
    } catch { /* silently fail */ }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Tasks</h2>
              <p className="text-sm text-gray-500">Manage your development tasks</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Software selector */}
              <div className="flex items-center gap-1.5 border rounded-lg px-3 py-1.5 bg-white">
                <CubeIcon className="h-4 w-4 text-gray-400" />
                <select value={selectedSoftware?.id?.toString() || ''} onChange={handleSoftwareChange}
                  disabled={softwareLoading}
                  className="text-sm border-0 p-0 bg-transparent focus:ring-0 min-w-[160px]">
                  {softwareLoading && <option>Loading…</option>}
                  {!softwareLoading && softwareList.length === 0 && <option>No software</option>}
                  {!softwareLoading && softwareList.length > 0 && !selectedSoftware && <option value="">Select Software…</option>}
                  {softwareList.map(sw => <option key={sw.id} value={sw.id.toString()}>{sw.name}</option>)}
                </select>
              </div>

              {/* View toggle */}
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => { setViewMode('list'); localStorage.setItem('tasksViewMode', 'list'); }}
                  className={`p-2 ${viewMode === 'list' ? 'bg-picton-blue text-white' : 'hover:bg-gray-50'}`}>
                  <Bars3Icon className="h-4 w-4" />
                </button>
                <button onClick={() => { setViewMode('grid'); localStorage.setItem('tasksViewMode', 'grid'); }}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-picton-blue text-white' : 'hover:bg-gray-50'}`}>
                  <Squares2X2Icon className="h-4 w-4" />
                </button>
              </div>

              <button onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}
                disabled={!selectedSoftware}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
                <PlusIcon className="h-4 w-4" /> New Task
              </button>
              <button onClick={() => loadTasks()} disabled={loading || !selectedSoftware}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[130px]">
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[130px]">
              <option value="all">All Types</option>
              <option value="development">Development</option>
              <option value="bug-fix">Bug Fix</option>
              <option value="feature">Feature</option>
              <option value="maintenance">Maintenance</option>
              <option value="support">Support</option>
            </select>
            <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[140px]">
              <option value="all">All Phases</option>
              <option value="intake">Intake</option>
              <option value="quality_review">QA Review</option>
              <option value="development">Development</option>
            </select>
            <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[140px]">
              <option value="all">All Modules</option>
              {uniqueModules.map((m: any) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
            </select>
          </div>

          {/* Stats bar */}
          {filteredTasks.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {totalHours.toFixed(1)}h unbilled</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading tasks…</p>
          </div>
        </div>
      ) : !selectedSoftware ? (
        <div className="bg-white rounded-lg shadow-sm border p-16 text-center">
          <CubeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Select a software product to view tasks</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-16 text-center">
          <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No tasks found</p>
          <button onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
            <PlusIcon className="h-4 w-4" /> Create First Task
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid'
          ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'
          : 'space-y-3'
        }>
          {filteredTasks.map((task, idx) => (
            <div key={task.id}
              className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-tight">{task.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mt-1">
                    <span>{relativeDate(task.start || task.created_at || task.date)}</span>
                    {task.created_by_name && <><span>·</span><span>{task.created_by_name}</span></>}
                    {timeToDecimal(task.hours) > 0 && (
                      <><span>·</span><span className="flex items-center gap-0.5 font-medium text-picton-blue">
                        <ClockIcon className="h-3 w-3" />{timeToDecimal(task.hours).toFixed(2)}h
                      </span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {task.approval_required === 1 && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${
                      task.approved_by ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {task.approved_by ? <><ShieldCheckIcon className="h-3 w-3" /> Approved</> : <><ShieldExclamationIcon className="h-3 w-3" /> Pending</>}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[task.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                    {task.status}
                  </span>
                </div>
              </div>

              {/* Workflow phase */}
              {task.workflow_phase && (
                <div className="mt-2 p-2 rounded border bg-gray-50 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] border border-purple-200">
                      {PHASE_LABELS[task.workflow_phase] || task.workflow_phase}
                    </span>
                    {task.assigned_to_name && (
                      <span className="ml-2 text-gray-500 flex items-center gap-1 inline-flex">
                        <UserIcon className="h-3 w-3" />{task.assigned_to_name}
                      </span>
                    )}
                    {task.module_name && (
                      <span className="ml-2 text-gray-500 flex items-center gap-1 inline-flex">
                        <CubeIcon className="h-3 w-3" />{task.module_name}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <button onClick={() => handleReorder(task, 'up')} disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUpIcon className="h-4 w-4" /></button>
                <button onClick={() => handleReorder(task, 'down')} disabled={idx === filteredTasks.length - 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
                <div className="h-5 w-px bg-gray-200 mx-0.5" />
                <button onClick={() => { setViewingTask(task); setDetailsOpen(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
                  <EyeIcon className="h-3 w-3" /> View
                </button>
                <button onClick={() => { setEditingTask(task); setTaskDialogOpen(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
                  <PencilIcon className="h-3 w-3" /> Edit
                </button>
                {(task.status === 'new' || task.status === 'pending') && (
                  <button onClick={() => handleStatusChange(task, 'in-progress')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg text-emerald-600 hover:bg-emerald-50">
                    <PlayIcon className="h-3 w-3" /> Start
                  </button>
                )}
                {(task.status === 'in-progress' || task.status === 'progress') && (
                  <button onClick={() => handleStatusChange(task, 'completed')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg text-emerald-600 hover:bg-emerald-50">
                    <CheckCircleIcon className="h-3 w-3" /> Complete
                  </button>
                )}
                <button onClick={() => handleDelete(task)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg text-red-500 hover:bg-red-50">
                  <TrashIcon className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TaskDialog
        open={taskDialogOpen}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
        task={editingTask}
        apiUrl={apiUrl || ''}
        softwareId={selectedSoftware?.id}
        onSaved={() => loadTasks()}
      />
      <TaskDetailsDialog
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setViewingTask(null); }}
        task={viewingTask}
        apiUrl={apiUrl || ''}
        onEdit={(t) => { setEditingTask(t); setTaskDialogOpen(true); }}
      />
    </div>
  );
};

export default TasksPage;
