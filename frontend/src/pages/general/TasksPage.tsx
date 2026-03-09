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
  PhotoIcon,
  ArrowUpTrayIcon,
  LinkIcon,
  ArrowsRightLeftIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../../services/api';
import { useSoftware } from '../../hooks/useSoftware';
import { useTasks } from '../../hooks/useTasks';
import { useModules } from '../../hooks/useModules';
import { useAppStore } from '../../store';
import { Software, Task } from '../../types';
import { LocalTasksModel } from '../../models';
import ExcalidrawDrawer from '../../components/ExcalidrawDrawer';
import TaskAttachmentsInline, { clearAttachmentCache } from '../../components/TaskAttachmentsInline';
import RichTextEditor from '../../components/RichTextEditor';
import { canUserAssignTask, getPermissionErrorMessage } from '../../utils/workflowPermissions';

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

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;

/** Format a Date to the backend's expected "Y-m-d H:i:s" string */
function formatDateToBackend(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Parse a date string into a Date object, or null */
function parseDate(d?: string | null): Date | null {
  if (!d || d === '0' || d === '0000-00-00') return null;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const ASSOCIATION_TYPES = [
  { value: 'duplicate', label: 'Duplicate', description: 'This task is a duplicate of another task' },
  { value: 'subtask', label: 'Subtask', description: 'This task is a subtask of a larger task' },
  { value: 'related', label: 'Related', description: 'This task is related to another task' },
  { value: 'blocks', label: 'Blocks', description: 'This task blocks another task from completion' },
  { value: 'blocked_by', label: 'Blocked By', description: 'This task is blocked by another task' },
];

/** Rewrite relative image URLs in HTML to use the external API origin */
function fixImageUrls(html: string, apiUrl: string): string {
  if (!html || !apiUrl) return html || '';
  let base = '';
  try { base = new URL(apiUrl).origin; } catch { return html; }
  return html
    .replace(/src="\/uploads\//g, `src="${base}/uploads/`)
    .replace(/src='\/uploads\//g, `src='${base}/uploads/`)
    .replace(/src="uploads\//g, `src="${base}/uploads/`)
    .replace(/src='uploads\//g, `src='${base}/uploads/`)
    .replace(/src="\/storage\//g, `src="${base}/storage/`)
    .replace(/src='\/storage\//g, `src='${base}/storage/`);
}

function buildAttachmentUrl(apiUrl: string, att: any): string {
  if (att.file_path?.startsWith('http')) return att.file_path;
  try {
    const baseUrl = new URL(apiUrl).origin;
    const folder = att.is_from_ticket ? 'tickets' : 'development';
    return `${baseUrl}/uploads/${folder}/${att.file_path}`;
  } catch {
    return '';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Task Create/Edit Dialog ─────────────────────────────────── */
const TaskDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: Task | null;
  apiUrl: string;
  softwareId?: number;
  onSaved: (createdTaskId?: number) => void;
}> = ({ open, onClose, task, apiUrl, softwareId, onSaved }) => {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'timing' | 'attachments'>('general');
  const [form, setForm] = useState({
    task_name: '', task_description: '', task_notes: '',
    task_status: 'new', task_type: 'development',
    task_hours: '0.00', task_estimated_hours: '0.00',
    task_color: '#667eea',
    software_id: '', module_id: '', assigned_to: '',
    task_created_by_name: '',
    task_start: null as Date | null,
    task_end: null as Date | null,
    actual_start: null as Date | null,
    actual_end: null as Date | null,
  });

  // Attachments state for the dialog
  const [dialogAttachments, setDialogAttachments] = useState<any[]>([]);
  const [loadingDialogAttachments, setLoadingDialogAttachments] = useState(false);
  const [dialogUploading, setDialogUploading] = useState(false);
  const dialogFileRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        task_name: task.title || '',
        task_description: task.description || '',
        task_notes: task.notes || '',
        task_status: task.status === 'in-progress' ? 'progress' : task.status,
        task_type: task.type || 'development',
        task_hours: task.hours || '0.00',
        task_estimated_hours: task.estimatedHours || '0.00',
        task_color: '#667eea',
        software_id: String(task.software_id || softwareId || ''),
        module_id: String(task.module_id || ''),
        assigned_to: String(task.assigned_to || ''),
        task_created_by_name: task.created_by_name || '',
        task_start: parseDate(task.start),
        task_end: parseDate(task.end || task.due_date),
        actual_start: parseDate(task.actual_start),
        actual_end: parseDate(task.actual_end),
      });
      // Load attachments for existing task
      if (apiUrl && task.id) {
        setLoadingDialogAttachments(true);
        api.get(`/softaware/tasks/${task.id}/attachments`, {
          params: { apiUrl },
        }).then(res => {
          const list = res.data?.data || res.data?.attachments || res.data || [];
          setDialogAttachments(Array.isArray(list) ? list.filter((a: any) => !a.comment_id) : []);
        }).catch(() => setDialogAttachments([]))
          .finally(() => setLoadingDialogAttachments(false));
      }
    } else {
      setForm({
        task_name: '', task_description: '', task_notes: '',
        task_status: 'new', task_type: 'development',
        task_hours: '0.00', task_estimated_hours: '0.00',
        task_color: '#667eea',
        software_id: String(softwareId || ''),
        module_id: '', assigned_to: '',
        task_created_by_name: '',
        task_start: null, task_end: null,
        actual_start: null, actual_end: null,
      });
      setDialogAttachments([]);
    }
    setActiveTab('general');
  }, [open, task, softwareId]);

  const handleDialogFileUpload = async (filesToUpload: FileList | File[]) => {
    if (!task || !apiUrl) return;
    const fileArray = Array.from(filesToUpload);
    if (fileArray.length === 0) return;
    setDialogUploading(true);
    try {
      const fileData = await Promise.all(fileArray.map(async (f) => ({
        base64: await fileToBase64(f),
        fileName: f.name,
        mimeType: f.type,
      })));
      await api.post(`/softaware/tasks/${task.id}/attachments`, {
        apiUrl, files: fileData,
      });
      notify.success(`${fileArray.length} file(s) uploaded`);
      clearAttachmentCache(task.id);
      const res = await api.get(`/softaware/tasks/${task.id}/attachments`, {
        params: { apiUrl },
      });
      const list = res.data?.data || res.data?.attachments || res.data || [];
      setDialogAttachments(Array.isArray(list) ? list.filter((a: any) => !a.comment_id) : []);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setDialogUploading(false);
    }
  };

  const handleDialogDeleteAttachment = async (attachmentId: number) => {
    if (!task || !apiUrl) return;
    const result = await Swal.fire({
      title: 'Delete Attachment',
      text: 'Are you sure you want to remove this attachment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/softaware/tasks/${task.id}/attachments/${attachmentId}`, {
        params: { apiUrl },
      });
      notify.success('Attachment removed');
      clearAttachmentCache(task.id);
      setDialogAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
    } catch {
      notify.error('Failed to remove attachment');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.task_name.trim()) { notify.error('Task name is required'); return; }
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
      // Date fields
      if (form.task_start) taskData.task_start = formatDateToBackend(form.task_start);
      if (form.task_end) taskData.task_end = formatDateToBackend(form.task_end);
      if (form.actual_start) taskData.actual_start = formatDateToBackend(form.actual_start);
      if (form.actual_end) taskData.actual_end = formatDateToBackend(form.actual_end);

      if (form.module_id) taskData.module_id = parseInt(form.module_id);
      if (form.assigned_to) taskData.assigned_to = parseInt(form.assigned_to);
      if (task) {
        taskData.task_id = task.id;
        if (task.workflow_phase) taskData.workflow_phase = task.workflow_phase;
      }

      const response = await api({ method, url: '/softaware/tasks', data: { apiUrl, task: taskData },
      });

      const createdTaskId = !task && response.data?.task?.id ? response.data.task.id : undefined;
      notify.success(task ? 'Task updated' : 'Task created');
      onSaved(createdTaskId);
      onClose();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const tabs = [
    { key: 'general' as const, label: 'General' },
    { key: 'timing' as const, label: 'Timing' },
    ...(task ? [{ key: 'attachments' as const, label: `Attachments (${dialogAttachments.length})` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{task ? 'Edit Task' : 'Create Task'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-picton-blue text-picton-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ─── General Tab ─── */}
          {activeTab === 'general' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                <input value={form.task_name} onChange={e => setForm({ ...form, task_name: e.target.value })}
                  required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Enter task name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <RichTextEditor
                  value={form.task_description}
                  onChange={(val) => setForm({ ...form, task_description: val })}
                  placeholder="Describe the task in detail…"
                />
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
            </>
          )}

          {/* ─── Timing Tab ─── */}
          {activeTab === 'timing' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Set planned and actual dates for this task.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Planned Start
                  </label>
                  <DatePicker
                    selected={form.task_start}
                    onChange={(date: Date | null) => setForm({ ...form, task_start: date })}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    placeholderText="Select start date & time"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Planned End
                  </label>
                  <DatePicker
                    selected={form.task_end}
                    onChange={(date: Date | null) => setForm({ ...form, task_end: date })}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    placeholderText="Select end date & time"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    isClearable
                    minDate={form.task_start || undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Actual Start
                  </label>
                  <DatePicker
                    selected={form.actual_start}
                    onChange={(date: Date | null) => setForm({ ...form, actual_start: date })}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    placeholderText="Select actual start"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />Actual End
                  </label>
                  <DatePicker
                    selected={form.actual_end}
                    onChange={(date: Date | null) => setForm({ ...form, actual_end: date })}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="yyyy-MM-dd HH:mm"
                    placeholderText="Select actual end"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    isClearable
                    minDate={form.actual_start || undefined}
                  />
                </div>
              </div>
              {form.task_start && form.task_end && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                  <strong>Duration:</strong> {Math.ceil((form.task_end.getTime() - form.task_start.getTime()) / (1000 * 60 * 60 * 24))} day(s)
                </div>
              )}
            </div>
          )}

          {/* ─── Attachments Tab (edit mode only) ─── */}
          {activeTab === 'attachments' && task && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Manage task attachments.</p>
                <div className="flex gap-2">
                  <input ref={dialogFileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                    className="hidden" onChange={(e) => { if (e.target.files) handleDialogFileUpload(e.target.files); e.target.value = ''; }} />
                  <button type="button" onClick={() => dialogFileRef.current?.click()} disabled={dialogUploading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {dialogUploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
              {loadingDialogAttachments ? (
                <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
              ) : dialogAttachments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                  <PhotoIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No attachments yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {dialogAttachments.map((att: any) => {
                    const url = buildAttachmentUrl(apiUrl, att);
                    const isImage = IMAGE_EXT_RE.test(att.file_name || '') || att.mime_type?.startsWith('image/');
                    return (
                      <div key={att.attachment_id} className="rounded-lg border overflow-hidden bg-gray-50 group relative">
                        {isImage ? (
                          <img src={url} alt={att.file_name} className="w-full h-28 object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-28 flex items-center justify-center">
                            <PaperClipIcon className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                        <div className="p-2 flex items-center justify-between gap-1">
                          <p className="text-xs text-gray-600 truncate flex-1" title={att.file_name}>{att.file_name}</p>
                          <button type="button" onClick={() => handleDialogDeleteAttachment(att.attachment_id)}
                            className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete attachment">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
  softwareId?: number;
  onEdit: (t: Task) => void;
  onAssign?: (t: Task) => void;
  onLink?: (t: Task) => void;
  user: any;
}> = ({ open, onClose, task, apiUrl, softwareId, onEdit, onAssign, onLink, user }) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [deletingAttachment, setDeletingAttachment] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !task || !apiUrl) return;
    setLoadingComments(true);
    setLoadingAttachments(true);
    // Fetch comments and attachments in parallel
    Promise.all([
      api.get(`/softaware/tasks/${task.id}/comments`, {
        params: { apiUrl },
      }).catch(() => ({ data: [] })),
      api.get(`/softaware/tasks/${task.id}/attachments`, {
        params: { apiUrl },
      }).catch(() => ({ data: [] })),
    ]).then(([commentsRes, attachmentsRes]) => {
      const commentList = commentsRes.data?.data || commentsRes.data?.comments || [];
      setComments(Array.isArray(commentList) ? commentList : []);
      const attList = attachmentsRes.data?.data || attachmentsRes.data?.attachments || attachmentsRes.data || [];
      setAttachments(Array.isArray(attList) ? attList.filter((a: any) => !a.comment_id) : []);
    }).finally(() => {
      setLoadingComments(false);
      setLoadingAttachments(false);
    });
  }, [open, task, apiUrl]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !task) return;
    setSubmitting(true);
    try {
      await api.post(`/softaware/tasks/${task.id}/comments`, { 
        apiUrl, 
        content: newComment,
        is_internal: isInternalComment ? 1 : 0
      }, {
      });
      notify.success('Comment posted');
      setNewComment('');
      setIsInternalComment(false);
      // Re-fetch comments
      const res = await api.get(`/softaware/tasks/${task.id}/comments`, {
        params: { apiUrl },
      });
      setComments(res.data?.data || res.data?.comments || []);
    } catch {
      notify.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const refetchComments = async () => {
    if (!task || !apiUrl) return;
    try {
      const res = await api.get(`/softaware/tasks/${task.id}/comments`, {
        params: { apiUrl },
      });
      setComments(res.data?.data || res.data?.comments || []);
    } catch { /* ignore */ }
  };

  const handleDrawingSave = async (payload: { imageBase64: string; sceneJson: string; fileName: string }) => {
    if (!task || !apiUrl) return;
    try {
      const htmlContent = `<p><strong>📐 Drawing:</strong> ${payload.fileName}</p>`
        + `<img src="${payload.imageBase64}" alt="${payload.fileName}" style="max-width:100%;border-radius:8px;" />`;

      await api.post(`/softaware/tasks/${task.id}/comments/with-attachment`, {
        apiUrl,
        content: htmlContent,
        is_internal: 1,
        imageBase64: payload.imageBase64,
        fileName: payload.fileName,
      });

      notify.success('Drawing saved as internal comment');
      setDrawingOpen(false);
      await refetchComments();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to save drawing');
    }
  };

  const handleFileUpload = async (filesToUpload: FileList | File[]) => {
    if (!task || !apiUrl) return;
    const fileArray = Array.from(filesToUpload);
    if (fileArray.length === 0) return;
    setUploading(true);
    try {
      const fileData = await Promise.all(fileArray.map(async (f) => ({
        base64: await fileToBase64(f),
        fileName: f.name,
        mimeType: f.type,
      })));
      await api.post(`/softaware/tasks/${task.id}/attachments`, {
        apiUrl, files: fileData,
      });
      notify.success(`${fileArray.length} file(s) uploaded`);
      clearAttachmentCache(task.id);
      // Refresh attachments
      const res = await api.get(`/softaware/tasks/${task.id}/attachments`, {
        params: { apiUrl },
      });
      const list = res.data?.data || res.data?.attachments || res.data || [];
      setAttachments(Array.isArray(list) ? list.filter((a: any) => !a.comment_id) : []);
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles = items
      .filter(item => item.type?.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean) as File[];
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFileUpload(imageFiles);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!task || !apiUrl) return;
    const result = await Swal.fire({
      title: 'Delete Attachment',
      text: 'Are you sure you want to remove this attachment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    setDeletingAttachment(attachmentId);
    try {
      await api.delete(`/softaware/tasks/${task.id}/attachments/${attachmentId}`, {
        params: { apiUrl },
      });
      notify.success('Attachment removed');
      clearAttachmentCache(task.id);
      setAttachments(prev => prev.filter(a => a.attachment_id !== attachmentId));
    } catch {
      notify.error('Failed to remove attachment');
    } finally {
      setDeletingAttachment(null);
    }
  };

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} onPaste={handlePaste}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
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
            <button onClick={() => setDrawingOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
              title="Open drawing editor">
              <PaperClipIcon className="h-3.5 w-3.5" /> Draw
            </button>
            {onAssign && canUserAssignTask(user, task) && (
              <button onClick={() => { onClose(); onAssign(task); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg text-purple-600 hover:bg-purple-50"
                title="Assign task">
                <ArrowsRightLeftIcon className="h-3.5 w-3.5" /> Assign
              </button>
            )}
            {onLink && (
              <button onClick={() => { onClose(); onLink(task); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg text-blue-600 hover:bg-blue-50"
                title="Link to another task">
                <LinkIcon className="h-3.5 w-3.5" /> Link
              </button>
            )}
            <button onClick={() => { onClose(); onEdit(task); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
              <PencilIcon className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Planned Start</span>
              <p className="font-medium">{task.start ? new Date(task.start).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Planned End</span>
              <p className="font-medium">{(task.end || task.due_date) ? new Date((task.end || task.due_date)!).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> Est. Hours</span>
              <p className="font-medium">{parseFloat(String(task.estimated_hours || task.estimatedHours || 0)).toFixed(2)}h</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> Actual Hours</span>
              <p className="font-medium">{timeToDecimal(task.hours).toFixed(2)}h</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Actual Start</span>
              <p className="font-medium">{task.actual_start ? new Date(task.actual_start).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Actual End</span>
              <p className="font-medium">{task.actual_end ? new Date(task.actual_end).toLocaleDateString() : '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Created By</span>
              <p className="font-medium">{task.created_by_name || task.creator || '—'}</p></div>
            <div><span className="text-gray-500 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Last Updated</span>
              <p className="font-medium">{(task.time || task.created_at) ? relativeDate(task.time || task.created_at) : '—'}</p></div>
          </div>

          {/* Workflow info */}
          {(task.assigned_to_name || task.module_name) && (
            <div className="p-3 rounded-lg border bg-gray-50 flex items-center gap-4 text-sm">
              {task.assigned_to_name && (
                <span className="flex items-center gap-1.5 text-gray-700">
                  <UserIcon className="h-4 w-4 text-gray-400" /> <strong>Assigned:</strong> {task.assigned_to_name}
                </span>
              )}
              {task.module_name && (
                <span className="flex items-center gap-1.5 text-gray-700">
                  <CubeIcon className="h-4 w-4 text-gray-400" /> <strong>Module:</strong> {task.module_name}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                <DocumentTextIcon className="h-4 w-4" /> Description
              </h4>
              <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border text-sm [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:cursor-pointer"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'IMG') setExpandedImage((target as HTMLImageElement).src);
                }}
                dangerouslySetInnerHTML={{ __html: fixImageUrls(task.description, apiUrl) }} />
            </div>
          )}

          {/* Notes */}
          {task.notes && task.notes.trim() && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                <DocumentTextIcon className="h-4 w-4" /> Notes
              </h4>
              <div className="p-4 bg-gray-50 rounded-lg border text-sm whitespace-pre-wrap text-gray-700">
                {task.notes}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <PhotoIcon className="h-4 w-4" /> Attachments ({attachments.length})
              </h4>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                  className="hidden" onChange={(e) => { if (e.target.files) handleFileUpload(e.target.files); e.target.value = ''; }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  <ArrowUpTrayIcon className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload Files'}
                </button>
              </div>
            </div>
            {loadingAttachments ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading attachments…</p>
            ) : attachments.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed">
                <PhotoIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No attachments yet</p>
                <p className="text-[10px] text-gray-300 mt-1">Upload files or paste screenshots (Ctrl+V)</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {attachments.map((att: any) => {
                  const url = buildAttachmentUrl(apiUrl, att);
                  const isImage = IMAGE_EXT_RE.test(att.file_name || '') || att.mime_type?.startsWith('image/');
                  return (
                    <div key={att.attachment_id} className="rounded-lg border overflow-hidden bg-gray-50 group relative">
                      {isImage ? (
                        <img src={url} alt={att.file_name}
                          className="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setExpandedImage(url)} loading="lazy" />
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer"
                          className="w-full h-32 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 transition-colors">
                          <PaperClipIcon className="h-8 w-8 text-gray-300" />
                          <span className="text-[10px] text-gray-400">Download</span>
                        </a>
                      )}
                      <div className="p-2 flex items-center justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 truncate" title={att.file_name}>{att.file_name}</p>
                          {att.file_size && <p className="text-[10px] text-gray-400">{(att.file_size / 1024).toFixed(1)} KB</p>}
                        </div>
                        <button onClick={() => handleDeleteAttachment(att.attachment_id)}
                          disabled={deletingAttachment === att.attachment_id}
                          className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Delete attachment">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Approval */}
          {task.approval_required === 1 && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
              task.approved_by ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {task.approved_by ? <ShieldCheckIcon className="h-4 w-4" /> : <ShieldExclamationIcon className="h-4 w-4" />}
              {task.approved_by ? `Approved by ${task.approved_by}` : 'Awaiting approval — estimated hours exceed threshold'}
            </div>
          )}

          {/* Comments History */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-3">
              <ChatBubbleLeftIcon className="h-4 w-4" /> Comment History ({comments.length})
            </h4>
            {loadingComments ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No comments yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {comments.map((c: any, i: number) => (
                  <div key={c.comment_id || i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm group">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{c.user_name || c.username || c.created_by || 'Unknown'}</span>
                        {c.created_at && <span className="text-xs text-gray-400">{relativeDate(c.created_at)}</span>}
                        {c.time_spent && <span className="text-xs text-gray-400">· {c.time_spent}h</span>}
                        {c.is_internal === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Internal</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: 'Convert to Task',
                              text: 'Create a new task from this comment?',
                              icon: 'question',
                              showCancelButton: true,
                              confirmButtonText: 'Convert',
                            });
                            if (!result.isConfirmed) return;
                            try {
                              await api.post(`/softaware/tasks/comments/${c.comment_id}/convert-to-task`, { apiUrl });
                              notify.success('Comment converted to task');
                            } catch {
                              notify.error('Failed to convert comment to task');
                            }
                          }}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Convert to task"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: 'Delete Comment',
                              text: 'Are you sure you want to delete this comment?',
                              icon: 'warning',
                              showCancelButton: true,
                              confirmButtonColor: '#ef4444',
                              confirmButtonText: 'Delete',
                            });
                            if (!result.isConfirmed) return;
                            try {
                              await api.delete(`/softaware/tasks/comments/${c.comment_id}`, { params: { apiUrl } });
                              notify.success('Comment deleted');
                              await refetchComments();
                            } catch {
                              notify.error('Failed to delete comment');
                            }
                          }}
                          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete comment"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:mt-2 [&_img]:cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName === 'IMG') {
                          setExpandedImage((target as HTMLImageElement).src);
                        }
                      }}
                      dangerouslySetInnerHTML={{ __html: fixImageUrls(c.content || c.comment || '', apiUrl) }} />
                    {/* Render linked attachments */}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {c.attachments.map((att: any) => {
                          const url = buildAttachmentUrl(apiUrl, att);
                          const isImage = IMAGE_EXT_RE.test(att.file_name || '') || att.mime_type?.startsWith('image/');
                          return isImage ? (
                            <img key={att.attachment_id} src={url}
                              alt={att.file_name} onClick={() => setExpandedImage(url)}
                              className="max-h-32 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" loading="lazy" />
                          ) : (
                            <a key={att.attachment_id} href={url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border rounded text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <PaperClipIcon className="h-3 w-3" /> {att.file_name}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Add Comment - Pinned to bottom */}
        <div className="shrink-0 border-t bg-blue-50 dark:bg-blue-900/20 p-4 rounded-b-xl">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Type your comment here…"
                className="flex-1 px-4 py-2.5 border border-blue-300 dark:border-blue-700 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white dark:bg-gray-800 dark:text-white"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }} />
              <button onClick={() => setDrawingOpen(true)}
                className="p-2.5 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400" title="Attach Drawing">
                <PaperClipIcon className="h-5 w-5" />
              </button>
              <button onClick={handlePostComment} disabled={submitting || !newComment.trim()}
                className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-200 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isInternalComment}
                onChange={e => setIsInternalComment(e.target.checked)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span className="flex items-center gap-1">
                <ShieldCheckIcon className="h-3.5 w-3.5 text-amber-600" />
                Internal comment <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(not visible to clients)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Excalidraw drawing editor overlay */}
      <ExcalidrawDrawer
        open={drawingOpen}
        onClose={() => setDrawingOpen(false)}
        onSave={handleDrawingSave}
        taskTitle={task.title}
      />

      {/* Image lightbox */}
      {expandedImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => setExpandedImage(null)}>
          <img src={expandedImage} alt="Expanded" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};

/* ── Workflow Dialog (Assign Task) ────────────────────────────── */
const ROLE_TO_PHASE: Record<string, string> = {
  client_manager: 'intake',
  qa_specialist: 'quality_review',
  developer: 'development',
};

const WorkflowDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: Task | null;
  apiUrl: string;
  softwareId?: number;
  modules: any[];
  onSuccess: () => void;
}> = ({ open, onClose, task, apiUrl, softwareId, modules, onSuccess }) => {
  const { user: currentUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [comment, setComment] = useState('');
  const [sendBackToIntake, setSendBackToIntake] = useState(false);

  const hasPermission = canUserAssignTask(currentUser, task);
  const permissionError = !hasPermission ? getPermissionErrorMessage(currentUser, task) : null;

  useEffect(() => {
    if (!open) return;
    // Fetch LOCAL Softaware users (not external API users)
    // These are the users who work on tasks — same as desktop's useUsers()
    api.get('/users').then(res => {
      const list = res.data?.data || res.data?.users || res.data || [];
      setUsers(Array.isArray(list) ? list : []);
    }).catch(err => {
      console.error('Failed to fetch users:', err);
      setUsers([]);
    });
    setAssignedTo(task?.assigned_to?.toString() || '');
    setModuleId(task?.module_id?.toString() || '');
    setComment('');
    setSendBackToIntake(false);
  }, [open, task]);

  const phase = task?.workflow_phase?.toLowerCase() || 'intake';

  const allowedAssignees = useMemo(() => {
    // Helper: extract a user's primary role as a flat string
    // Our /api/users returns roles: [{id, name, slug}] array
    // Desktop app uses u.role as a plain string
    const getUserRole = (u: any): string => {
      // roles array from /api/users
      if (u.roles && Array.isArray(u.roles) && u.roles.length > 0) {
        return (u.roles[0].slug || u.roles[0].name || '').toLowerCase();
      }
      // role object from auth
      if (u.role?.slug) return u.role.slug.toLowerCase();
      if (typeof u.role === 'string') return u.role.toLowerCase();
      return '';
    };
    
    const isAdmin = (u: any) => {
      const r = getUserRole(u);
      return r === 'admin' || r === 'super_admin';
    };
    
    const hasRole = (u: any, ...roleNames: string[]) => {
      const r = getUserRole(u);
      return roleNames.includes(r);
    };
    
    let filtered: any[] = [];
    
    // Filter based on the task's current phase and the TARGET assignment
    // Only show users with the correct role — admins are excluded from assignment lists
    if (!phase || phase === 'intake') {
      // From intake → forward to QA review (qa_specialist)
      filtered = users.filter(u => hasRole(u, 'qa_specialist'));
    } else if (phase === 'quality_review' || phase === 'triage') {
      // From QA → send back to intake (client_manager) is the user-picker path;
      // forward to development goes through the module picker instead.
      filtered = users.filter(u => hasRole(u, 'client_manager'));
    } else if (phase === 'development') {
      // From development → reassign to another developer OR send to QA
      filtered = users.filter(u => hasRole(u, 'developer', 'qa_specialist'));
    } else if (phase === 'verification' || phase === 'resolution') {
      // From verification/resolution → back to dev or to QA
      filtered = users.filter(u => hasRole(u, 'developer', 'qa_specialist'));
    } else {
      // Unknown phase — show all non-admin users
      filtered = users.filter(u => !isAdmin(u));
    }
    
    // Fallback: if role-based filtering produced zero results, show ALL users
    if (filtered.length === 0 && users.length > 0) {
      console.warn('[WorkflowDialog] Role-based filter returned 0 results — falling back to full user list');
      filtered = [...users];
    }
    
    // Exclude the current user (the person doing the assigning) from the list
    if (currentUser?.id) {
      filtered = filtered.filter(u => u.id !== currentUser.id);
    }
    
    // Always include the currently assigned user if one exists (unless it's the current user)
    if (task?.assigned_to && task.assigned_to !== currentUser?.id) {
      const currentAssignee = users.find(u => u.id === task.assigned_to);
      if (currentAssignee && !filtered.find(u => u.id === currentAssignee.id)) {
        filtered = [currentAssignee, ...filtered];
      }
    }
    
    return filtered;
  }, [users, task, phase, currentUser]);

  const needsModule = useMemo(() =>
    (phase === 'quality_review' || phase === 'triage') && !sendBackToIntake,
    [phase, sendBackToIntake]
  );

  const selectedUser = useMemo(() => {
    if (sendBackToIntake && allowedAssignees.length > 0) {
      return allowedAssignees[0];
    }
    if (!assignedTo || assignedTo === 'none') return null;
    return users.find(u => u.id?.toString() === assignedTo) || null;
  }, [assignedTo, users, sendBackToIntake, allowedAssignees]);

  const resultingPhase = useMemo(() => {
    if (sendBackToIntake) return 'intake';
    if (!selectedUser) return null;
    
    // Extract flat role string — same logic as getUserRole in allowedAssignees
    let role = '';
    if (selectedUser.roles && Array.isArray(selectedUser.roles) && selectedUser.roles.length > 0) {
      role = (selectedUser.roles[0].slug || selectedUser.roles[0].name || '').toLowerCase();
    } else if (selectedUser.role?.slug) {
      role = selectedUser.role.slug.toLowerCase();
    } else if (typeof selectedUser.role === 'string') {
      role = selectedUser.role.toLowerCase();
    }
    
    return role ? ROLE_TO_PHASE[role] || null : null;
  }, [selectedUser, sendBackToIntake]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!hasPermission) {
      notify.error(permissionError || 'You do not have permission to assign this task');
      return;
    }
    
    if (sendBackToIntake) {
      // Find a client_manager among the allowed assignees for send-back-to-intake
      const findClientManager = (u: any) => {
        if (u.roles && Array.isArray(u.roles)) {
          return u.roles.some((r: any) => (r.slug || '').toLowerCase() === 'client_manager');
        }
        if (typeof u.role === 'string') return u.role.toLowerCase() === 'client_manager';
        if (u.role?.slug) return u.role.slug.toLowerCase() === 'client_manager';
        return false;
      };
      const intakeUser = allowedAssignees.find(findClientManager) || allowedAssignees[0];
      if (!intakeUser) {
        notify.error('No users available to send back to intake. Please contact an administrator.');
        return;
      }
    } else if (needsModule) {
      if (!moduleId || moduleId === 'none') {
        notify.error('Please select a module for development');
        return;
      }
    } else {
      if (!assignedTo || assignedTo === 'none') {
        notify.error('Please select who to assign this task to');
        return;
      }
    }
    
    setLoading(true);
    try {
      const taskData: any = { id: task.id };
      
      if (sendBackToIntake) {
        // Prefer a client_manager, fall back to first available user
        const findClientManager = (u: any) => {
          if (u.roles && Array.isArray(u.roles)) {
            return u.roles.some((r: any) => (r.slug || '').toLowerCase() === 'client_manager');
          }
          if (typeof u.role === 'string') return u.role.toLowerCase() === 'client_manager';
          if (u.role?.slug) return u.role.slug.toLowerCase() === 'client_manager';
          return false;
        };
        const intakeUser = allowedAssignees.find(findClientManager) || allowedAssignees[0];
        taskData.assigned_to = intakeUser?.id;
        taskData.workflow_phase = 'intake';
        taskData.module_id = null;
      } else if (needsModule && moduleId && moduleId !== 'none') {
        taskData.module_id = parseInt(moduleId);
        taskData.workflow_phase = 'development';
        taskData.assigned_to = null;
      } else if (assignedTo && assignedTo !== 'none') {
        taskData.assigned_to = parseInt(assignedTo);
        if (resultingPhase) {
          taskData.workflow_phase = resultingPhase;
        }
      }

      await api.put('/softaware/tasks', { apiUrl, task: taskData }, {
      });

      if (comment.trim()) {
        try {
          await api.post(`/softaware/tasks/${task.id}/comments`, {
            apiUrl, content: comment, is_internal: 1,
          });
        } catch { /* ignore */ }
      }

      notify.success(sendBackToIntake ? 'Sent back to intake' : needsModule ? 'Assigned to module' : `Assigned to ${selectedUser?.username || selectedUser?.user_name}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Assign Task</h3>
            <p className="text-sm text-gray-500">Assign this task to the next person in the workflow.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!hasPermission && permissionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <ExclamationCircleIcon className="h-4 w-4 inline mr-2" />
              {permissionError}
            </div>
          )}

          {task.workflow_phase && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Current phase:</span>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium">
                {PHASE_LABELS[task.workflow_phase.toLowerCase()] || task.workflow_phase}
              </span>
            </div>
          )}

          {task.module_name && (
            <div className="p-3 rounded-lg bg-gray-50 border text-sm">
              <span className="font-medium">Current Module:</span> {task.module_name}
            </div>
          )}

          {needsModule && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Module</label>
              <select value={moduleId} onChange={e => setModuleId(e.target.value)} disabled={loading || !hasPermission}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select a module…</option>
                {modules.map((m: any) => (
                  <option key={m.id} value={m.id.toString()}>
                    {m.name} {m.developer_count ? `(${m.developer_count} dev${m.developer_count !== 1 ? 's' : ''})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(phase === 'quality_review' || phase === 'triage') && (
            <label className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={sendBackToIntake}
                onChange={e => { setSendBackToIntake(e.target.checked); if (e.target.checked) setModuleId(''); }}
                disabled={loading || !hasPermission} className="h-4 w-4 rounded border-gray-300" />
              <div>
                <span className="text-sm font-medium">Send back to Intake</span>
                <p className="text-xs text-gray-400">Task will be returned to the Client Manager team</p>
              </div>
            </label>
          )}

          {!needsModule && !sendBackToIntake && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to User *</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} disabled={loading || !hasPermission}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select a user…</option>
                {allowedAssignees.map((u: any) => {
                  // Extract flat role label
                  let roleLabel = '';
                  if (u.roles && Array.isArray(u.roles) && u.roles.length > 0) {
                    roleLabel = u.roles[0].name || u.roles[0].slug || '';
                  } else if (u.role?.name) {
                    roleLabel = u.role.name;
                  } else if (typeof u.role === 'string') {
                    roleLabel = u.role;
                  }
                  return (
                    <option key={u.id} value={u.id.toString()}>
                      {u.name || u.username || u.user_name || u.email} {roleLabel ? `(${roleLabel})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} disabled={loading || !hasPermission}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Add an internal comment about this workflow change…" />
            <p className="text-xs text-gray-400 mt-1">This will be posted as an internal note (not visible to clients)</p>
          </div>

          {(resultingPhase || (needsModule && moduleId) || sendBackToIntake) && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
              Workflow phase will be set to:{' '}
              <span className="font-semibold">
                {sendBackToIntake ? PHASE_LABELS['intake']
                  : needsModule && moduleId ? PHASE_LABELS['development']
                  : PHASE_LABELS[resultingPhase || ''] || resultingPhase}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading || !hasPermission || (!sendBackToIntake && (needsModule ? !moduleId : !assignedTo))}
              className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
              {loading ? 'Assigning…' : sendBackToIntake ? 'Send to Intake' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Task Association Dialog ─────────────────────────────────── */
const TaskAssociationDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  task: Task | null;
  tasks: Task[];
  apiUrl: string;
  softwareId?: number;
  onSuccess: () => void;
}> = ({ open, onClose, task, tasks, apiUrl, softwareId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [associationType, setAssociationType] = useState('duplicate');
  const [parentTaskId, setParentTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [taskSearch, setTaskSearch] = useState('');

  useEffect(() => {
    if (!open || !task) return;
    if (task.parent_task_id) {
      setParentTaskId(String(task.parent_task_id));
      setAssociationType(task.association_type || 'duplicate');
      setNotes(task.association_notes || '');
    } else {
      setParentTaskId('');
      setAssociationType('duplicate');
      setNotes('');
    }
    setTaskSearch('');
  }, [open, task]);

  const availableTasks = useMemo(() =>
    tasks.filter(t => t.id !== task?.id),
    [tasks, task]
  );

  const filteredAvailable = useMemo(() => {
    if (!taskSearch) return availableTasks.slice(0, 20);
    const q = taskSearch.toLowerCase();
    return availableTasks.filter(t =>
      t.title?.toLowerCase().includes(q) || String(t.id).includes(q)
    ).slice(0, 20);
  }, [availableTasks, taskSearch]);

  const parentTask = useMemo(() =>
    task?.parent_task_id ? tasks.find(t => String(t.id) === String(task.parent_task_id)) : null,
    [task, tasks]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!parentTaskId) { notify.error('Please select a parent task'); return; }
    if (parentTaskId === String(task.id)) { notify.error('Cannot associate a task with itself'); return; }
    setLoading(true);
    try {
      await api.post(`/softaware/tasks/${task.id}/associations`, {
        apiUrl,
        parent_task_id: parentTaskId,
        association_type: associationType,
        notes: notes.trim() || undefined,
      });
      notify.success('Task associated successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Failed to associate task');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssociation = async () => {
    if (!task) return;
    const result = await Swal.fire({
      title: 'Remove Association',
      text: 'Remove the association from this task?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Remove',
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      await api.delete(`/softaware/tasks/${task.id}/associations`, {
        params: { apiUrl },
      });
      notify.success('Association removed');
      onSuccess();
      onClose();
    } catch {
      notify.error('Failed to remove association');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Associate Task</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {task.parent_task_id && parentTask && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-1">
              <p className="font-semibold text-blue-800">Current Association</p>
              <p><span className="font-medium">Type:</span> {task.association_type}</p>
              <p><span className="font-medium">Parent:</span> {parentTask.title} (#{parentTask.id})</p>
              {task.association_notes && <p><span className="font-medium">Notes:</span> {task.association_notes}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Association Type *</label>
            <div className="space-y-2">
              {ASSOCIATION_TYPES.map(type => (
                <label key={type.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    associationType === type.value ? 'border-picton-blue bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="assocType" value={type.value}
                    checked={associationType === type.value}
                    onChange={e => setAssociationType(e.target.value)}
                    disabled={loading} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-gray-500">{type.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Task *</label>
            <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
              placeholder="Search tasks by name or ID…"
              className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {filteredAvailable.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tasks found</p>
              ) : (
                filteredAvailable.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => setParentTaskId(String(t.id))}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50 flex items-center justify-between ${
                      parentTaskId === String(t.id) ? 'bg-blue-50 text-blue-700' : ''
                    }`}>
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-xs text-gray-400 ml-2 shrink-0">#{t.id}</span>
                    {parentTaskId === String(t.id) && <CheckCircleIcon className="h-4 w-4 text-blue-600 ml-2 shrink-0" />}
                  </button>
                ))
              )}
            </div>
            {parentTaskId && (
              <p className="text-xs text-green-600 mt-1">
                Selected: {availableTasks.find(t => String(t.id) === parentTaskId)?.title || `#${parentTaskId}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={loading}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Add context about this relationship…" />
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t">
            <div>
              {task.parent_task_id && (
                <button type="button" onClick={handleRemoveAssociation} disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                  Remove Association
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading || !parentTaskId}
                className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
                {loading ? 'Saving…' : task.parent_task_id ? 'Update Association' : 'Create Association'}
              </button>
            </div>
          </div>
        </form>
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
  const [showBilled, setShowBilled] = useState(false);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [workflowTask, setWorkflowTask] = useState<Task | null>(null);
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [associationTask, setAssociationTask] = useState<Task | null>(null);
  const [lastComments, setLastComments] = useState<Record<number, string>>({});

  const apiUrl = useMemo(() => {
    if (!selectedSoftware) return null;
    return selectedSoftware.external_mode === 'live'
      ? selectedSoftware.external_live_url
      : selectedSoftware.external_test_url;
  }, [selectedSoftware]);

  // Only show software with external integration configured
  const taskSoftware = useMemo(() =>
    softwareList.filter(sw =>
      sw.has_external_integration &&
      (sw.external_live_url || sw.external_test_url)
    ),
    [softwareList]
  );

  const { tasks, loading, error, loadTasks } = useTasks({ softwareId: selectedSoftware?.id });
  const { modules } = useModules(selectedSoftware?.id);

  // Sync info panel state
  const [syncInfoOpen, setSyncInfoOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [remoteStats, setRemoteStats] = useState<any>(null);
  const [selectedForBilling, setSelectedForBilling] = useState<Set<string | number>>(new Set());
  const [billingMode, setBillingMode] = useState(false);
  const [invoicing, setInvoicing] = useState(false);

  // Restore selected software
  useEffect(() => {
    const saved = localStorage.getItem('selectedTasksSoftware');
    if (saved) try { setSelectedSoftware(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  // Ensure selectedSoftware is in the filtered taskSoftware list
  useEffect(() => {
    if (!taskSoftware.length) return;
    if (selectedSoftware && taskSoftware.some(sw => sw.id === selectedSoftware.id)) return;
    // Selected software is not in the filtered list — auto-select first
    const first = taskSoftware[0];
    setSelectedSoftware(first);
    localStorage.setItem('selectedTasksSoftware', JSON.stringify(first));
  }, [taskSoftware, selectedSoftware]);

  // Load local tasks when software is selected (no external auth needed)
  useEffect(() => {
    if (selectedSoftware) loadTasks();
  }, [selectedSoftware, loadTasks]);

  // Fetch remote stats when apiUrl is available
  useEffect(() => {
    if (!apiUrl) { setRemoteStats(null); return; }
    api.get('/softaware/tasks/stats', { params: { apiUrl } })
      .then(res => setRemoteStats(res.data?.data || res.data || null))
      .catch(() => setRemoteStats(null));
  }, [apiUrl, tasks.length]);

  // Fetch last comments for all tasks
  useEffect(() => {
    if (!apiUrl || tasks.length === 0) return;
    const fetchLastComments = async () => {
      const comments: Record<number, string> = {};
      await Promise.all(
        tasks.slice(0, 50).map(async (task) => {
          try {
            const res = await api.get(`/softaware/tasks/${task.id}/comments`, {
              params: { apiUrl },
            });
            const commentList = res.data?.data || res.data?.comments || [];
            if (commentList.length > 0) {
              const lastComment = commentList[commentList.length - 1];
              const content = lastComment.content || lastComment.comment || '';
              // Strip HTML and limit length
              const text = content.replace(/<[^>]*>/g, '').trim();
              comments[Number(task.id)] = text.length > 60 ? text.substring(0, 60) + '...' : text;
            }
          } catch {
            // Ignore errors for individual tasks
          }
        })
      );
      setLastComments(comments);
    };
    fetchLastComments();
  }, [tasks, apiUrl, selectedSoftware?.id]);

  // Check for task ID from dashboard and open it in view mode
  useEffect(() => {
    const openTaskId = localStorage.getItem('openTaskId');
    if (openTaskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => String(t.id) === openTaskId);
      if (taskToOpen) {
        setViewingTask(taskToOpen);
        setDetailsOpen(true);
        localStorage.removeItem('openTaskId');
      }
    }
  }, [tasks]);

  const handleSoftwareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sw = taskSoftware.find(s => String(s.id) === e.target.value);
    if (sw) {
      setSelectedSoftware(sw);
      localStorage.setItem('selectedTasksSoftware', JSON.stringify(sw));
      setBillingMode(false);
      setSelectedForBilling(new Set());
    }
  };

  const uniqueModules = useMemo(() =>
    modules.map((m: any) => ({ id: m.id, name: m.name })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    [modules]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Filter billed/invoiced tasks: show only unbilled by default, only billed when toggled
      const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;

      // Billing mode: show only completed + unbilled + has time logged tasks (ready for invoicing)
      if (billingMode) {
        if (billed) return false;
        if (t.status !== 'completed') return false;
        if (timeToDecimal(t.hours || 0) <= 0) return false;
        if (search) {
          const q = search.toLowerCase();
          return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.creator?.toLowerCase().includes(q);
        }
        return true;
      }

      if (showBilled) {
        // When "Show Billed" is active, show ONLY billed tasks (ignore other filters)
        if (!billed) return false;
        // Apply search filter only
        if (search) {
          const q = search.toLowerCase();
          return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.creator?.toLowerCase().includes(q);
        }
        return true;
      } else {
        // When "Show Billed" is inactive, show ONLY unbilled tasks with normal filters
        if (billed) return false;
      }
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
  }, [tasks, statusFilter, typeFilter, phaseFilter, moduleFilter, search, showBilled, billingMode]);

  const totalHours = filteredTasks.reduce((sum, t) => {
    const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
    return billed ? sum : sum + timeToDecimal(t.hours || 0);
  }, 0);

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (!apiUrl) return;
    try {
      if (newStatus === 'in-progress') {
        await api.post(`/softaware/tasks/${task.id}/start`, { apiUrl });
        notify.success('Task started');
      } else if (newStatus === 'completed') {
        await api.post(`/softaware/tasks/${task.id}/complete`, { apiUrl });
        notify.success('Task completed');
      } else {
        await api.put('/softaware/tasks', {
          apiUrl,
          task: { id: task.id, status: newStatus, user_name: user?.user_name },
        });
        notify.success(`Task status updated to ${newStatus}`);
      }
      loadTasks();
    } catch {
      notify.error('Failed to update status');
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
      await api.delete(`/softaware/tasks/${task.id}`, {
        params: { apiUrl },
      });
      notify.success('Task deleted');
      loadTasks();
    } catch {
      notify.error('Failed to delete task');
    }
  };

  const handleReorder = async (task: Task, direction: 'up' | 'down') => {
    const idx = filteredTasks.indexOf(task);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= filteredTasks.length) return;
    const other = filteredTasks[targetIdx];
    try {
      await api.post('/softaware/tasks/reorder', {
        apiUrl,
        orders: { [String(task.id)]: targetIdx + 1, [String(other.id)]: idx + 1 },
      });
      notify.success('Task reordered');
      loadTasks();
    } catch {
      notify.error('Failed to reorder task');
    }
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
                  {!softwareLoading && taskSoftware.length === 0 && <option>No software with integration</option>}
                  {!softwareLoading && taskSoftware.length > 0 && !selectedSoftware && <option value="">Select Software…</option>}
                  {taskSoftware.map(sw => (
                    <option key={sw.id} value={sw.id.toString()}>
                      {sw.name}
                    </option>
                  ))}
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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50"
                title="Create a new task">
                <PlusIcon className="h-4 w-4" /> New Task
              </button>
              <button onClick={() => loadTasks()} disabled={loading || !selectedSoftware}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => {
                const newState = !showBilled;
                setShowBilled(newState);
                notify.success(newState ? 'Now showing only billed/invoiced tasks' : 'Now showing only unbilled tasks');
              }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${showBilled ? 'bg-green-50 border-green-300 text-green-700' : 'hover:bg-gray-50'}`}
                title={showBilled ? 'Hide billed/invoiced tasks' : 'Show billed/invoiced tasks'}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {showBilled ? 'Showing Billed' : 'Show Billed'}
              </button>

              {/* Bill/Invoice toggle */}
              {!showBilled && (
                <button
                  onClick={() => {
                    const newState = !billingMode;
                    setBillingMode(newState);
                    if (!newState) setSelectedForBilling(new Set());
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${billingMode ? 'bg-amber-50 border-amber-300 text-amber-700' : 'hover:bg-gray-50'}`}
                  title="Select tasks to invoice">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {billingMode ? 'Cancel Billing' : 'Invoice Tasks'}
                </button>
              )}

              {/* Sync info icon */}
              <button
                onClick={async () => {
                  setSyncInfoOpen(!syncInfoOpen);
                  if (!syncInfoOpen) {
                    try {
                      const res = await LocalTasksModel.getSyncStatus();
                      setSyncStatus(res?.data || null);
                    } catch { /* ignore */ }
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg ${syncInfoOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'}`}
                title="Sync information">
                <InformationCircleIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sync info panel (collapsible) */}
          {syncInfoOpen && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                    <ArrowsRightLeftIcon className="h-4 w-4" /> Task Sync
                  </h4>
                  <p className="text-xs text-blue-700 mt-1">
                    All task operations (create, edit, start, complete, etc.) are sent directly to the external portal in real-time.
                    A local copy is also kept and periodically refreshed via sync.
                  </p>
                </div>
                <button onClick={() => setSyncInfoOpen(false)} className="text-blue-400 hover:text-blue-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-blue-800 space-y-1">
                <p><strong>How it works:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>External APIs (portals, project management tools) are registered as <em>task sources</em></li>
                  <li>All writes (create, edit, delete, start, complete, invoice) go directly to the external API</li>
                  <li>The sync service periodically pulls the latest task data and updates the local copy</li>
                  <li>Changes are detected using content hashing — only modified tasks are refreshed locally</li>
                  <li>Authentication is handled server-side using source API keys — no login required</li>
                </ul>
              </div>

              {syncStatus && (
                <div className="flex items-center gap-4 text-xs text-blue-800 bg-blue-100/50 rounded px-3 py-2">
                  {syncStatus.data?.sources?.map((src: any) => (
                    <div key={src.id} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${src.sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="font-medium">{src.name}</span>
                      {src.last_synced_at && (
                        <span className="text-blue-600">
                          Last sync: {new Date(src.last_synced_at).toLocaleString()}
                        </span>
                      )}
                      {src.last_sync_count !== undefined && src.last_sync_count !== null && (
                        <span className="text-blue-600">{src.last_sync_count} tasks</span>
                      )}
                    </div>
                  )) || (
                    <span>No sources configured</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      await LocalTasksModel.syncAll();
                      notify.success('Sync triggered — tasks are being pulled');
                      // Refresh sync status
                      const res = await LocalTasksModel.getSyncStatus();
                      setSyncStatus(res?.data || null);
                      // Reload tasks after a short delay
                      setTimeout(() => loadTasks(), 2000);
                    } catch (err: any) {
                      notify.error(err?.response?.data?.error || 'Sync failed');
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>
          )}

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

          {/* Billing action bar */}
          {billingMode && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-amber-800">
                  {selectedForBilling.size} task{selectedForBilling.size !== 1 ? 's' : ''} selected
                </span>
                {selectedForBilling.size > 0 && (
                  <span className="text-amber-600">
                    ({filteredTasks.filter(t => selectedForBilling.has(t.id)).reduce((sum, t) => sum + timeToDecimal(t.hours || 0), 0).toFixed(1)}h)
                  </span>
                )}
                <button
                  onClick={() => {
                    if (selectedForBilling.size === filteredTasks.length) {
                      setSelectedForBilling(new Set());
                    } else {
                      setSelectedForBilling(new Set(filteredTasks.map(t => t.id)));
                    }
                  }}
                  className="text-xs text-amber-700 underline hover:text-amber-900"
                >
                  {selectedForBilling.size === filteredTasks.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <button
                onClick={async () => {
                  if (selectedForBilling.size === 0) { notify.error('Select at least one task'); return; }
                  if (!apiUrl) return;
                  const result = await Swal.fire({
                    title: 'Invoice Tasks',
                    html: `<p>Mark <strong>${selectedForBilling.size}</strong> task(s) as invoiced with today's date?</p>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Invoice',
                    confirmButtonColor: '#d97706',
                  });
                  if (!result.isConfirmed) return;
                  setInvoicing(true);
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    await api.post('/softaware/tasks/invoice-tasks', {
                      apiUrl,
                      task_ids: Array.from(selectedForBilling),
                      bill_date: today,
                    });
                    notify.success(`${selectedForBilling.size} task(s) invoiced`);
                    setSelectedForBilling(new Set());
                    setBillingMode(false);
                    loadTasks();
                  } catch {
                    notify.error('Failed to invoice tasks');
                  } finally {
                    setInvoicing(false);
                  }
                }}
                disabled={selectedForBilling.size === 0 || invoicing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {invoicing ? 'Invoicing…' : `Invoice ${selectedForBilling.size} Task${selectedForBilling.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Stats bar */}
          {filteredTasks.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
              <span>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> {totalHours.toFixed(1)}h unbilled</span>
              {remoteStats && (
                <>
                  <span className="h-3 w-px bg-gray-300" />
                  <span className="text-blue-600 font-medium">Portal: {remoteStats.total_tasks ?? '—'} total</span>
                  <span className="text-amber-600">{remoteStats.in_progress ?? 0} active</span>
                  <span className="text-emerald-600">{remoteStats.completed ?? 0} done</span>
                  {remoteStats.total_hours > 0 && <span>{remoteStats.total_hours}h total</span>}
                  {remoteStats.overdue_tasks > 0 && <span className="text-red-600">{remoteStats.overdue_tasks} overdue</span>}
                </>
              )}
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
          <p className="text-sm text-gray-500">
            {taskSoftware.length === 0
              ? 'No software with external integration configured. Set up integration in Software Management.'
              : 'Select a software product to view tasks'}
          </p>
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
              className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-all overflow-hidden"
              style={{ borderLeft: `4px solid ${task.backgroundColor || '#667eea'}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 flex items-start gap-2">
                  {billingMode && (
                    <input
                      type="checkbox"
                      checked={selectedForBilling.has(task.id)}
                      onChange={() => {
                        setSelectedForBilling(prev => {
                          const next = new Set(prev);
                          if (next.has(task.id)) next.delete(task.id);
                          else next.add(task.id);
                          return next;
                        });
                      }}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-tight">{task.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mt-1">
                      <span>{relativeDate(task.start || task.created_at || task.time || task.date)}</span>
                      {task.created_by_name && <><span>·</span><span>{task.created_by_name}</span></>}
                      {timeToDecimal(task.hours) > 0 && (
                        <><span>·</span><span className="flex items-center gap-0.5 font-medium text-picton-blue">
                          <ClockIcon className="h-3 w-3" />{timeToDecimal(task.hours).toFixed(2)}h
                        </span></>
                      )}
                    </div>
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs text-gray-600">{task.type}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[task.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                    {task.status}
                  </span>
                </div>
              </div>

              {/* Description preview */}
              {task.description && (
                <div className="mt-2 text-xs text-gray-600 line-clamp-2 [&_img]:hidden [&_table]:hidden"
                  dangerouslySetInnerHTML={{ __html: task.description }} />
              )}

              {/* Inline attachment thumbnails */}
              {apiUrl && (
                <TaskAttachmentsInline
                  taskId={task.id}
                  apiUrl={apiUrl}
                  softwareId={selectedSoftware?.id}
                  onImageClick={(url) => setLightboxImage(url)}
                />
              )}

              {/* Workflow phase */}
              {task.workflow_phase && (
                <div className="mt-2 p-2 rounded border bg-gray-50 text-xs">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] border border-purple-200">
                      {PHASE_LABELS[task.workflow_phase] || task.workflow_phase}
                    </span>
                    {task.assigned_to_name && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />{task.assigned_to_name}
                      </span>
                    )}
                    {task.module_name && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <CubeIcon className="h-3 w-3" />{task.module_name}
                      </span>
                    )}
                    {task.parent_task_id && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <ArrowRightIcon className="h-3 w-3" />{task.association_type || 'related'} of #{task.parent_task_id}
                      </span>
                    )}
                  </div>
                  {lastComments[Number(task.id)] && (
                    <div className="flex items-start gap-1 text-gray-600 italic border-t border-gray-200 pt-1.5 mt-1.5">
                      <ChatBubbleLeftIcon className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{lastComments[Number(task.id)]}</span>
                    </div>
                  )}
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
                {canUserAssignTask(user, task) ? (
                  <button onClick={() => { setWorkflowTask(task); setWorkflowDialogOpen(true); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg text-purple-600 hover:bg-purple-50">
                    <ArrowsRightLeftIcon className="h-3 w-3" /> Assign
                  </button>
                ) : task.workflow_phase ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 border border-purple-200">
                    {PHASE_LABELS[task.workflow_phase.toLowerCase()] || task.workflow_phase}
                  </span>
                ) : null}
                <button onClick={() => { setAssociationTask(task); setAssociationDialogOpen(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg text-blue-600 hover:bg-blue-50">
                  <LinkIcon className="h-3 w-3" /> Link
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
        onSaved={(createdTaskId) => {
          loadTasks();
          // Auto-open newly created task in view mode
          if (createdTaskId && !editingTask) {
            setTimeout(() => {
              const newTask = tasks.find(t => t.id === createdTaskId);
              if (newTask) {
                setViewingTask(newTask);
                setDetailsOpen(true);
              }
            }, 300);
          }
        }}
      />
      <TaskDetailsDialog
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setViewingTask(null); }}
        task={viewingTask}
        apiUrl={apiUrl || ''}
        softwareId={selectedSoftware?.id}
        onEdit={(t) => { setEditingTask(t); setTaskDialogOpen(true); }}
        onAssign={(t) => { setWorkflowTask(t); setWorkflowDialogOpen(true); }}
        onLink={(t) => { setAssociationTask(t); setAssociationDialogOpen(true); }}
        user={user}
      />
      <WorkflowDialog
        open={workflowDialogOpen}
        onClose={() => { setWorkflowDialogOpen(false); setWorkflowTask(null); }}
        task={workflowTask}
        apiUrl={apiUrl || ''}
        softwareId={selectedSoftware?.id}
        modules={modules}
        onSuccess={() => loadTasks()}
      />
      <TaskAssociationDialog
        open={associationDialogOpen}
        onClose={() => { setAssociationDialogOpen(false); setAssociationTask(null); }}
        task={associationTask}
        tasks={tasks}
        apiUrl={apiUrl || ''}
        softwareId={selectedSoftware?.id}
        onSuccess={() => loadTasks()}
      />

      {/* Image lightbox for card thumbnails */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Expanded" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};

export default TasksPage;
