import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  CubeIcon,
  Squares2X2Icon,
  Bars3Icon,
  ViewColumnsIcon,
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
import TaskImageLightbox, { LightboxImage } from '../../components/TaskImageLightbox';
import RichTextEditor from '../../components/RichTextEditor';
import { canUserAssignTask, getPermissionErrorMessage } from '../../utils/workflowPermissions';
import { TaskCard, KanbanBoard, TaskToolbar, TaskStatsBar } from '../../components/Tasks';

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
  // Prefer the download_url returned by the external API
  if (att.download_url) return att.download_url;
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
      // Always send actual_start / actual_end so they can be cleared (null clears them)
      taskData.actual_start = form.actual_start ? formatDateToBackend(form.actual_start) : null;
      taskData.actual_end   = form.actual_end   ? formatDateToBackend(form.actual_end)   : null;

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
              {/* Reset hours & actual dates */}
              {(parseFloat(form.task_hours) > 0 || form.actual_start || form.actual_end) && (
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      Swal.fire({
                        title: 'Reset Hours & Timing?',
                        html: `<p class="text-sm text-gray-600">This will set <b>Actual Hours</b> to 0 and clear <b>Actual Start</b> and <b>Actual End</b>.</p>`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Reset',
                        confirmButtonColor: '#dc2626',
                      }).then(r => {
                        if (r.isConfirmed) {
                          setForm(f => ({ ...f, task_hours: '0.00', actual_start: null, actual_end: null }));
                        }
                      });
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Reset Hours &amp; Actual Dates
                  </button>
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
  const [galleryImages, setGalleryImages] = useState<LightboxImage[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [deletingAttachment, setDeletingAttachment] = useState<number | null>(null);

  // Collect all image URLs from attachments + comments for gallery navigation
  const allImages = useMemo(() => {
    const imgs: LightboxImage[] = [];
    // Task-level attachments
    for (const att of attachments) {
      const url = buildAttachmentUrl(apiUrl, att);
      const isImage = IMAGE_EXT_RE.test(att.file_name || '') || att.mime_type?.startsWith('image/');
      if (isImage && url) imgs.push({ url, name: att.file_name });
    }
    // Comment attachments
    for (const c of comments) {
      if (c.attachments) {
        for (const att of c.attachments) {
          const url = buildAttachmentUrl(apiUrl, att);
          const isImage = IMAGE_EXT_RE.test(att.file_name || '') || att.mime_type?.startsWith('image/');
          if (isImage && url) imgs.push({ url, name: att.file_name });
        }
      }
    }
    return imgs;
  }, [attachments, comments, apiUrl]);

  const openGallery = useCallback((clickedUrl: string) => {
    const idx = allImages.findIndex(img => img.url === clickedUrl);
    if (idx >= 0) {
      setGalleryImages(allImages);
      setGalleryIndex(idx);
    } else {
      // Fallback: show as single image (e.g. inline description images)
      setGalleryImages([{ url: clickedUrl }]);
      setGalleryIndex(0);
    }
  }, [allImages]);

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
                  if (target.tagName === 'IMG') openGallery((target as HTMLImageElement).src);
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
                          onClick={() => openGallery(url)} loading="lazy" />
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
                          openGallery((target as HTMLImageElement).src);
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
                              alt={att.file_name} onClick={() => openGallery(url)}
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

      {/* Image gallery lightbox */}
      {galleryImages.length > 0 && (
        <TaskImageLightbox
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryImages([])}
        />
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
   Main Tasks Page — Modern Task Management UI
   ═══════════════════════════════════════════════════════════ */

const TasksPage: React.FC = () => {
  const { user } = useAppStore();
  const { software: softwareList, isLoading: softwareLoading } = useSoftware();

  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() =>
    (localStorage.getItem('tasksViewMode') as 'list' | 'kanban') || 'kanban'
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [bookmarkFilter, setBookmarkFilter] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState<string>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const role = (stored?.role?.slug || stored?.role_name || stored?.roles?.[0]?.slug || '').toLowerCase();
      switch (role) {
        case 'client_manager': return 'intake';
        case 'qa_specialist': return 'quality_review';
        case 'developer': return 'development';
        default: return 'all';
      }
    } catch { return 'all'; }
  });
  const [moduleFilter, setModuleFilter] = useState('all');
  const [showBilled, setShowBilled] = useState(false);
  const phaseInitialized = useRef(false);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [cardGalleryImages, setCardGalleryImages] = useState<LightboxImage[]>([]);
  const [cardGalleryIndex, setCardGalleryIndex] = useState(0);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [workflowTask, setWorkflowTask] = useState<Task | null>(null);
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [associationTask, setAssociationTask] = useState<Task | null>(null);
  const [lastComments, setLastComments] = useState<Record<number, { text: string; author: string; date: string | null }>>({});

  // Set default phase filter based on user role (fallback if user wasn't in localStorage yet)
  useEffect(() => {
    if (phaseInitialized.current || !user) return;
    const role = (user?.role?.slug || user?.role_name || (user as any)?.roles?.[0]?.slug || '').toLowerCase();
    const defaultPhase =
      role === 'client_manager' ? 'intake' :
      role === 'qa_specialist'  ? 'quality_review' :
      role === 'developer'      ? 'development' :
      null;
    if (defaultPhase) {
      setPhaseFilter(defaultPhase);
    }
    phaseInitialized.current = true;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const { tasks, loading, error, loadTasks, setTasks } = useTasks({ softwareId: selectedSoftware?.id });
  const { modules } = useModules(selectedSoftware?.id);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [remoteStats, setRemoteStats] = useState<any>(null);
  const [selectedForBilling, setSelectedForBilling] = useState<Set<string | number>>(new Set());
  const [billingMode, setBillingMode] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Invoice staging state
  const [invoiceReviewMode, setInvoiceReviewMode] = useState(false);
  const [stagedInvoiceCount, setStagedInvoiceCount] = useState(0);
  const [stagedTasks, setStagedTasks] = useState<any[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);
  const [processingInvoices, setProcessingInvoices] = useState(false);

  // Sync enabled state
  const [syncEnabled, setSyncEnabled] = useState(true);

  // Statement download state
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [billingDates, setBillingDates] = useState<string[]>([]);
  const [statementDateFrom, setStatementDateFrom] = useState('');
  const [statementDateTo, setStatementDateTo] = useState('');
  const [loadingBillingDates, setLoadingBillingDates] = useState(false);
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  // Allocated hours tracking
  const [allocatedHours, setAllocatedHours] = useState<number>(0);
  const [editingAllocated, setEditingAllocated] = useState(false);
  const [allocatedInput, setAllocatedInput] = useState('');
  const allocatedInputRef = useRef<HTMLInputElement>(null);

  // Total billed hours (across ALL billed tasks, not just filtered view)
  const totalBilledHours = useMemo(() => {
    return tasks.filter(t => {
      const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
      return billed;
    }).reduce((sum, t) => sum + timeToDecimal(t.hours || 0), 0);
  }, [tasks]);

  const remainingHours = useMemo(() => Math.max(0, allocatedHours - totalBilledHours), [allocatedHours, totalBilledHours]);

  // Font size — persisted per-user via localStorage
  const [taskFontSize, setTaskFontSize] = useState<'sm' | 'md' | 'lg'>(() => {
    const saved = localStorage.getItem('taskFontSize');
    return (saved === 'sm' || saved === 'md' || saved === 'lg') ? saved : 'sm';
  });
  const handleTaskFontSizeChange = (size: 'sm' | 'md' | 'lg') => {
    setTaskFontSize(size);
    localStorage.setItem('taskFontSize', size);
  };

  const loadStagedCount = useCallback(async () => {
    try {
      const resp = await LocalTasksModel.getStagedInvoices();
      if (resp.status === 1) {
        setStagedInvoiceCount(resp.data.count);
        setStagedTasks(resp.data.tasks);
      }
    } catch { /* ignore */ }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const resp = await LocalTasksModel.getSyncEnabled();
      if (resp.status === 1) setSyncEnabled(resp.data.enabled);
    } catch { /* ignore */ }
  }, []);

  // Load staged count and sync status on mount
  useEffect(() => { loadStagedCount(); }, [loadStagedCount]);
  useEffect(() => { loadSyncStatus(); }, [loadSyncStatus]);

  // Load allocated hours from billing settings
  useEffect(() => {
    (async () => {
      try {
        const resp = await api.get('/local-tasks/billing-settings');
        const val = resp.data?.data?.allocated_hours;
        if (val && !isNaN(val)) setAllocatedHours(val);
      } catch { /* not set yet */ }
    })();
  }, []);

  const saveAllocatedHours = useCallback(async (val: number) => {
    setAllocatedHours(val);
    setEditingAllocated(false);
    try {
      await api.put('/local-tasks/billing-settings', { allocated_hours: val });
    } catch {
      notify.error('Failed to save allocated hours');
    }
  }, []);

  // Statement modal helpers
  const openStatementModal = useCallback(async () => {
    setStatementModalOpen(true);
    setLoadingBillingDates(true);
    try {
      const resp = await LocalTasksModel.getBillingDates();
      if (resp.status === 1 && resp.data.dates) {
        setBillingDates(resp.data.dates);
        // Default: select all billing dates
        const dates = resp.data.dates as string[];
        if (dates.length >= 2) {
          setStatementDateFrom(dates[dates.length - 1]); // oldest
          setStatementDateTo(dates[0]); // most recent
        } else if (dates.length === 1) {
          setStatementDateFrom(dates[0]);
          setStatementDateTo(dates[0]);
        }
      }
    } catch {
      notify.error('Failed to load billing dates');
    } finally {
      setLoadingBillingDates(false);
    }
  }, []);

  const handleStatementDownload = useCallback(async () => {
    if (!statementDateFrom || !statementDateTo) {
      notify.error('Please select both From and To billing dates');
      return;
    }
    setDownloadingStatement(true);
    try {
      await LocalTasksModel.downloadStatementExcel(statementDateFrom, statementDateTo, undefined, allocatedHours || undefined);
      notify.success('Statement downloaded');
    } catch {
      notify.error('Failed to download statement');
    } finally {
      setDownloadingStatement(false);
    }
  }, [statementDateFrom, statementDateTo, allocatedHours]);

  // Restore selected software
  useEffect(() => {
    const saved = localStorage.getItem('selectedTasksSoftware');
    if (saved) try { setSelectedSoftware(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  // Ensure selectedSoftware is in the filtered taskSoftware list
  useEffect(() => {
    if (!taskSoftware.length) return;
    if (selectedSoftware && taskSoftware.some(sw => sw.id === selectedSoftware.id)) return;
    const first = taskSoftware[0];
    setSelectedSoftware(first);
    localStorage.setItem('selectedTasksSoftware', JSON.stringify(first));
  }, [taskSoftware, selectedSoftware]);

  // Load local tasks when software is selected
  useEffect(() => {
    if (selectedSoftware) loadTasks();
  }, [selectedSoftware, loadTasks]);

  // Fetch remote stats
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
      const comments: Record<number, { text: string; author: string; date: string | null }> = {};
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
              const text = content.replace(/<[^>]*>/g, '').trim();
              comments[Number(task.id)] = {
                text: text.length > 200 ? text.substring(0, 200) + '…' : text,
                author: lastComment.user_name || lastComment.username || lastComment.created_by || 'Unknown',
                date: lastComment.created_at || null,
              };
            }
          } catch { /* ignore */ }
        })
      );
      setLastComments(comments);
    };
    fetchLastComments();
  }, [tasks, apiUrl, selectedSoftware?.id]);

  // Check for task ID from dashboard
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

  // Unbilled tasks — excludes billed and staged; used for stats bar + task count denominator
  const unbilledTasks = useMemo(() => {
    return tasks.filter(t => {
      const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
      const staged = (t as any).task_billed === 2;
      return !billed && !staged;
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
      const staged = (t as any).task_billed === 2;

      // Staged tasks only appear in the Invoice Review panel, not in any list view
      if (staged) return false;

      if (billingMode) {
        if (billed) return false;
        if (t.status !== 'completed') return false;
        if (timeToDecimal(t.hours || 0) <= 0) return false;
        if (search) {
          const q = search.toLowerCase();
          return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
        }
        return true;
      }

      if (showBilled) {
        if (!billed) return false;
        if (search) {
          const q = search.toLowerCase();
          return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
        }
        return true;
      } else {
        if (billed) return false;
      }

      // Kanban shows all statuses; list can filter by status
      if (viewMode === 'list' && statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (phaseFilter !== 'all') {
        const p = t.workflow_phase?.toLowerCase() || 'intake';
        if (p !== phaseFilter) return false;
      }
      if (moduleFilter !== 'all' && String(t.module_id) !== moduleFilter) return false;
      if (priorityFilter !== 'all' && (t.priority || 'normal') !== priorityFilter) return false;
      if (bookmarkFilter && !t.is_bookmarked) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.creator?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, statusFilter, typeFilter, phaseFilter, moduleFilter, search, showBilled, billingMode, viewMode, priorityFilter, bookmarkFilter]);

  const totalHours = filteredTasks.reduce((sum, t) => {
    const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
    return billed ? sum : sum + timeToDecimal(t.hours || 0);
  }, 0);

  /** Handle kanban same-column reorder */
  const handleReorder = async (updates: { id: number; kanban_order: number }[]) => {
    // Build a quick lookup: _local_id → new kanban_order
    const orderMap = new Map(updates.map(u => [u.id, u.kanban_order]));

    // Optimistic UI update
    setTasks(prev =>
      prev.map(t => {
        const newOrder = orderMap.get(t._local_id as number);
        return newOrder !== undefined ? { ...t, kanban_order: newOrder } : t;
      })
    );

    // Persist to local DB
    try {
      await api.patch('/local-tasks/bulk', { updates });
    } catch {
      // Revert on failure
      loadTasks();
      notify.error('Failed to save task order');
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (!apiUrl) return;

    // Optimistically update the local UI immediately so Kanban / list reflect the change
    setTasks(prev => prev.map(t =>
      (t.id === task.id || t._local_id === task._local_id)
        ? { ...t, status: newStatus as Task['status'] }
        : t
    ));

    // Also persist to local DB so it survives a refresh (fire & forget)
    if (task._local_id) {
      api.patch('/local-tasks/bulk', {
        updates: [{ id: task._local_id, status: newStatus }],
      }).catch(() => {});
    }

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
      // Re-sync local cache in background after external API confirms
      loadTasks();
    } catch {
      // Revert optimistic update on failure
      loadTasks();
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
      await api.delete(`/softaware/tasks/${task.id}`, { params: { apiUrl } });
      notify.success('Task deleted');
      loadTasks();
    } catch {
      notify.error('Failed to delete task');
    }
  };

  const handleBookmark = async (task: Task) => {
    if (!task._local_id) return;
    try {
      await LocalTasksModel.toggleBookmark(task._local_id);
      // Optimistic update
      setTasks(prev => prev.map(t =>
        t._local_id === task._local_id
          ? { ...t, is_bookmarked: t.is_bookmarked ? 0 : 1 }
          : t
      ));
    } catch {
      notify.error('Failed to toggle bookmark');
    }
  };

  const handlePriorityChange = async (task: Task, priority: string) => {
    if (!task._local_id) return;
    try {
      await LocalTasksModel.setPriority(task._local_id, priority);
      setTasks(prev => prev.map(t =>
        t._local_id === task._local_id ? { ...t, priority: priority as any } : t
      ));
      notify.success(`Priority set to ${priority}`);
    } catch {
      notify.error('Failed to update priority');
    }
  };

  const handleColorLabel = async (task: Task, color: string | null) => {
    if (!task._local_id) return;
    try {
      await LocalTasksModel.setColorLabel(task._local_id, color);
      setTasks(prev => prev.map(t =>
        t._local_id === task._local_id ? { ...t, color_label: color } : t
      ));
    } catch {
      notify.error('Failed to update color label');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await LocalTasksModel.syncAll();
      notify.success('Sync triggered — tasks are being pulled');
      setTimeout(() => loadTasks(), 2000);
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const SYNC_DISABLE_REASONS = [
    'External API is down or unreachable',
    'Data integrity concerns — incorrect data syncing',
    'Performance issues — sync is slowing the system',
    'Scheduled maintenance on external system',
    'API key or credentials need rotation',
    'Duplicate or stale data being imported',
    'Testing or debugging locally without sync interference',
    'Other — please describe below',
  ];

  const handleSyncStatusToggle = async () => {
    if (syncEnabled) {
      // Turning OFF — show reason dialog
      const { value: formValues } = await Swal.fire({
        title: '⚠️ Disable Task Sync',
        html: `
          <div style="text-align:left;">
            <p style="margin-bottom:12px;color:#6b7280;font-size:14px;">
              Disabling sync will stop all task sources from updating. A <strong>case will be opened</strong> to track this change.
            </p>
            <label style="display:block;font-weight:600;font-size:13px;margin-bottom:6px;color:#374151;">Select a reason:</label>
            <select id="swal-reason" class="swal2-select" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:12px;">
              <option value="">— Choose a reason —</option>
              ${SYNC_DISABLE_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
            <label style="display:block;font-weight:600;font-size:13px;margin-bottom:6px;color:#374151;">Additional details (optional):</label>
            <textarea id="swal-detail" class="swal2-textarea" placeholder="Provide any additional context…" style="width:100%;min-height:80px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Disable Sync & Open Case',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Cancel',
        width: 520,
        preConfirm: () => {
          const reason = (document.getElementById('swal-reason') as HTMLSelectElement)?.value;
          const detail = (document.getElementById('swal-detail') as HTMLTextAreaElement)?.value;
          if (!reason) {
            Swal.showValidationMessage('Please select a reason');
            return false;
          }
          return { reason, detail };
        },
      });

      if (!formValues) return;

      try {
        const userName = user?.first_name
          ? `${user.first_name} ${user.last_name || ''}`.trim()
          : user?.username || user?.email || 'Unknown';
        const resp = await LocalTasksModel.disableSync(
          formValues.reason,
          formValues.detail || undefined,
          selectedSoftware?.name,
          user?.id != null ? String(user.id) : undefined,
          userName
        );
        setSyncEnabled(false);
        notify.success(resp.message || 'Sync disabled and case opened');
      } catch {
        notify.error('Failed to disable sync');
      }
    } else {
      // Turning ON — simple confirmation
      const result = await Swal.fire({
        title: 'Re-enable Sync',
        text: 'This will re-enable task syncing for all sources. Continue?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enable Sync',
        confirmButtonColor: '#16a34a',
      });
      if (!result.isConfirmed) return;

      try {
        await LocalTasksModel.enableSync();
        setSyncEnabled(true);
        notify.success('Sync re-enabled');
      } catch {
        notify.error('Failed to enable sync');
      }
    }
  };

  const handleViewTask = (task: Task) => {
    setViewingTask(task);
    setDetailsOpen(true);
    // Record view
    if (task._local_id) {
      LocalTasksModel.recordView(task._local_id).catch(() => {});
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border px-5 py-4">
        <div className="flex flex-col gap-4">
          {/* Row 1: 3-column layout — Title | Stats + Counts | Software + View */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
            </div>

            {/* Center: Stats + Counts */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="hidden md:block">
                <TaskStatsBar tasks={unbilledTasks} remoteStats={remoteStats} />
              </div>
              <div className="w-px h-6 bg-gray-200 hidden md:block" />
              <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                <span className="font-semibold text-gray-700">
                  {filteredTasks.length === unbilledTasks.length ? unbilledTasks.length : `${filteredTasks.length}/${unbilledTasks.length}`}
                </span>
                <span className="text-gray-400">tasks</span>
                {totalHours > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className="font-semibold text-indigo-600">{totalHours.toFixed(1)}</span>
                    <span className="text-gray-400">hrs</span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Software selector + View toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 border border-gray-200 dark:border-dark-600 rounded-lg px-3 py-2 bg-gray-50/50 dark:bg-dark-800 hover:bg-white dark:hover:bg-dark-700 transition-colors">
                <CubeIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={selectedSoftware?.id?.toString() || ''}
                  onChange={handleSoftwareChange}
                  disabled={softwareLoading}
                  className="text-sm border-0 p-0 bg-transparent focus:ring-0 min-w-[140px] text-gray-700 dark:text-gray-200"
                >
                  {softwareLoading && <option>Loading…</option>}
                  {!softwareLoading && taskSoftware.length === 0 && <option>No software configured</option>}
                  {!softwareLoading && taskSoftware.length > 0 && !selectedSoftware && <option value="">Select…</option>}
                  {taskSoftware.map(sw => (
                    <option key={sw.id} value={sw.id.toString()}>{sw.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-800 rounded-lg p-1">
                <button
                  onClick={() => { setViewMode('list'); localStorage.setItem('tasksViewMode', 'list'); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white dark:bg-dark-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <Bars3Icon className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => { setViewMode('kanban'); localStorage.setItem('tasksViewMode', 'kanban'); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban' ? 'bg-white dark:bg-dark-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <ViewColumnsIcon className="w-4 h-4" />
                  Kanban
                </button>
              </div>
            </div>
          </div>

          {/* Divider between rows */}
          <div className="border-t border-gray-100" />

          {/* Row 2: Toolbar */}
          <TaskToolbar
            search={search}
            onSearchChange={setSearch}
            viewMode={viewMode}
            onViewModeChange={(v) => { setViewMode(v); localStorage.setItem('tasksViewMode', v); }}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            bookmarkFilter={bookmarkFilter}
            onBookmarkFilterToggle={() => setBookmarkFilter(!bookmarkFilter)}
            onRefresh={() => loadTasks()}
            onNewTask={() => { setEditingTask(null); setTaskDialogOpen(true); }}
            onSync={handleSync}
            syncing={syncing}
            billingMode={billingMode}
            onBillingModeToggle={() => {
              const newState = !billingMode;
              setBillingMode(newState);
              if (!newState) setSelectedForBilling(new Set());
              if (newState) setInvoiceReviewMode(false);
            }}
            loading={loading}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
            advancedFilters={
              <>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="all">All Types</option>
                  <option value="development">Development</option>
                  <option value="bug-fix">Bug Fix</option>
                  <option value="feature">Feature</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="support">Support</option>
                </select>
                <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="all">All Phases</option>
                  <option value="intake">Intake</option>
                  <option value="quality_review">QA Review</option>
                  <option value="development">Development</option>
                </select>
                <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="all">All Modules</option>
                  {uniqueModules.map((m: any) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    const newState = !showBilled;
                    setShowBilled(newState);
                    notify.success(newState ? 'Now showing only billed/invoiced tasks' : 'Now showing only unbilled tasks');
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${showBilled ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {showBilled ? '✓ Billed' : 'Show Billed'}
                </button>
              </>
            }
            syncEnabled={syncEnabled}
            onSyncStatusToggle={handleSyncStatusToggle}
            taskFontSize={taskFontSize}
            onTaskFontSizeChange={handleTaskFontSizeChange}
            stagedInvoiceCount={stagedInvoiceCount}
            invoiceReviewMode={invoiceReviewMode}
            onInvoiceReviewToggle={() => {
              const newState = !invoiceReviewMode;
              setInvoiceReviewMode(newState);
              if (newState) {
                loadStagedCount();
                setBillingMode(false);
                setSelectedForBilling(new Set());
              }
            }}
          />

          {/* Billing action bar — now stages locally instead of syncing */}
          {billingMode && (
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3">
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
                    if (selectedForBilling.size === filteredTasks.length) setSelectedForBilling(new Set());
                    else setSelectedForBilling(new Set(filteredTasks.map(t => t.id)));
                  }}
                  className="text-xs text-amber-700 underline hover:text-amber-900"
                >
                  {selectedForBilling.size === filteredTasks.length ? 'Deselect All' : 'Select All'}
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-amber-300" />

                {/* Allocated Hours */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-200 rounded-lg shadow-sm">
                  <span className="text-xs text-gray-500">Allocated:</span>
                  {editingAllocated ? (
                    <input
                      ref={allocatedInputRef}
                      type="number"
                      value={allocatedInput}
                      onChange={e => setAllocatedInput(e.target.value)}
                      onBlur={() => saveAllocatedHours(parseFloat(allocatedInput) || 0)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveAllocatedHours(parseFloat(allocatedInput) || 0);
                        if (e.key === 'Escape') setEditingAllocated(false);
                      }}
                      className="w-16 text-xs font-semibold text-center border border-amber-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-amber-400 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => { setAllocatedInput(String(allocatedHours)); setEditingAllocated(true); }}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-600 underline decoration-dotted cursor-pointer"
                      title="Click to edit allocated hours"
                    >
                      {allocatedHours}h
                    </button>
                  )}
                  <div className="w-px h-4 bg-amber-200" />
                  <span className="text-xs text-gray-500">Used:</span>
                  <span className="text-xs font-semibold text-red-600">{totalBilledHours.toFixed(1)}h</span>
                  <div className="w-px h-4 bg-amber-200" />
                  <span className="text-xs text-gray-500">Remaining:</span>
                  <span className={`text-xs font-semibold ${remainingHours > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {remainingHours.toFixed(1)}h
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-amber-300" />

                {/* Statement Download */}
                <button
                  onClick={openStatementModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-indigo-300 bg-white text-indigo-700 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                  title="Download billing statement as Excel"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Statement
                </button>
              </div>
              <button
                onClick={async () => {
                  if (selectedForBilling.size === 0) { notify.error('Select at least one task'); return; }
                  const result = await Swal.fire({
                    title: 'Stage for Invoicing',
                    html: `<p>Add <strong>${selectedForBilling.size}</strong> task(s) to the invoice review list?</p><p class="text-sm text-gray-500 mt-2">Tasks will be staged locally. You can review and process them from the Invoice Review panel.</p>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Stage for Invoice',
                    confirmButtonColor: '#d97706',
                  });
                  if (!result.isConfirmed) return;
                  setInvoicing(true);
                  try {
                    const today = new Date().toISOString().slice(0, 10);
                    await LocalTasksModel.stageForInvoice(Array.from(selectedForBilling), today);
                    notify.success(`${selectedForBilling.size} task(s) staged for invoicing`);
                    setSelectedForBilling(new Set());
                    setBillingMode(false);
                    loadTasks();
                    loadStagedCount();
                  } catch {
                    notify.error('Failed to stage tasks');
                  } finally {
                    setInvoicing(false);
                  }
                }}
                disabled={selectedForBilling.size === 0 || invoicing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 shadow-sm"
              >
                {invoicing ? 'Staging…' : `Stage ${selectedForBilling.size} Task${selectedForBilling.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Invoice Review panel */}
          {invoiceReviewMode && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200 bg-orange-100/50">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-orange-800">📋 Invoice Review</span>
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold rounded-full bg-orange-500 text-white">
                    {stagedTasks.length}
                  </span>
                  {stagedTasks.length > 0 && (
                    <span className="text-sm text-orange-600 ml-1">
                      ({stagedTasks.reduce((sum: number, t: any) => sum + timeToDecimal(t.hours || 0), 0).toFixed(1)}h total)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (stagedTasks.length === 0) { notify.error('No staged tasks to process'); return; }
                      if (!apiUrl) { notify.error('No API URL configured'); return; }
                      const result = await Swal.fire({
                        title: 'Process Invoices',
                        html: `<p>Sync <strong>${stagedTasks.length}</strong> staged task(s) to the external portal as invoiced?</p><p class="text-sm text-gray-500 mt-2">This will permanently mark them as billed on the portal.</p>`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Process & Sync',
                        confirmButtonColor: '#16a34a',
                      });
                      if (!result.isConfirmed) return;
                      setProcessingInvoices(true);
                      try {
                        const resp = await LocalTasksModel.processStagedInvoices(apiUrl);
                        notify.success(resp.message || `${resp.data?.processed || 0} task(s) invoiced and synced`);
                        loadTasks();
                        loadStagedCount();
                      } catch {
                        notify.error('Failed to process invoices');
                      } finally {
                        setProcessingInvoices(false);
                      }
                    }}
                    disabled={stagedTasks.length === 0 || processingInvoices}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm"
                  >
                    {processingInvoices ? 'Processing…' : 'Process & Sync'}
                  </button>
                  <button
                    onClick={async () => {
                      if (stagedTasks.length === 0) { notify.error('Nothing to clear'); return; }
                      const result = await Swal.fire({
                        title: 'Clear Invoice List',
                        html: `<p>Remove all <strong>${stagedTasks.length}</strong> task(s) from the invoice staging list?</p><p class="text-sm text-gray-500 mt-2">Tasks will go back to unbilled status.</p>`,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Clear All',
                        confirmButtonColor: '#dc2626',
                      });
                      if (!result.isConfirmed) return;
                      try {
                        await LocalTasksModel.clearStagedInvoices();
                        notify.success('Invoice staging list cleared');
                        loadTasks();
                        loadStagedCount();
                      } catch {
                        notify.error('Failed to clear staged invoices');
                      }
                    }}
                    disabled={stagedTasks.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Staged task list */}
              {stagedTasks.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-orange-500">
                  No tasks staged for invoicing. Use the <strong>Billing</strong> mode to select and stage tasks.
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto divide-y divide-orange-100">
                  {stagedTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-orange-50/60 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{t.task_name || t.title || `Task #${t.external_id}`}</span>
                          <span className="text-xs text-gray-400">#{t.external_id}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500">{timeToDecimal(t.hours || 0).toFixed(1)}h</span>
                          <span className="text-xs text-orange-500">Staged: {t.task_bill_date}</span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await LocalTasksModel.unstageInvoice(t.id);
                            notify.success('Task removed from staging');
                            loadTasks();
                            loadStagedCount();
                          } catch {
                            notify.error('Failed to remove task');
                          }
                        }}
                        className="ml-3 text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
            <p className="text-sm text-gray-400">Loading tasks…</p>
          </div>
        </div>
      ) : !selectedSoftware ? (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CubeIcon className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">No Project Selected</h3>
          <p className="text-sm text-gray-400">
            {taskSoftware.length === 0
              ? 'No software with external integration configured.'
              : 'Select a project to view and manage tasks.'}
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <ClockIcon className="h-8 w-8 text-indigo-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">No Tasks Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            {search || statusFilter !== 'all' || priorityFilter !== 'all' || bookmarkFilter
              ? 'Try adjusting your filters'
              : 'Create your first task to get started'}
          </p>
          <button onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">
            <PlusIcon className="h-4 w-4" /> Create Task
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ── Kanban View ── */
        <KanbanBoard
          tasks={filteredTasks}
          onView={handleViewTask}
          onBookmark={handleBookmark}
          onStatusChange={handleStatusChange}
          onReorder={handleReorder}
          onPriorityChange={handlePriorityChange}
          onEdit={(t) => { setEditingTask(t); setTaskDialogOpen(true); }}
          onDelete={handleDelete}
          onAssign={(t) => { setWorkflowTask(t); setWorkflowDialogOpen(true); }}
          onLink={(t) => { setAssociationTask(t); setAssociationDialogOpen(true); }}
          lastComments={lastComments}
          apiUrl={apiUrl || ''}
          softwareId={selectedSoftware?.id}
          onImageClick={(url) => { setCardGalleryImages([{ url }]); setCardGalleryIndex(0); }}
          onGalleryOpen={(images, idx) => { setCardGalleryImages(images); setCardGalleryIndex(idx); }}
          fontSize={taskFontSize}
        />
      ) : (
        /* ── List View ── */
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div key={task.id} className="relative">
              {billingMode && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
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
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                </div>
              )}
              <div className={billingMode ? 'pl-10' : ''}>
                <TaskCard
                  task={task}
                  variant="list"
                  fontSize={taskFontSize}
                  onView={handleViewTask}
                  onBookmark={handleBookmark}
                  onEdit={(t) => { setEditingTask(t); setTaskDialogOpen(true); }}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onAssign={(t) => { setWorkflowTask(t); setWorkflowDialogOpen(true); }}
                  onLink={(t) => { setAssociationTask(t); setAssociationDialogOpen(true); }}
                  lastComment={lastComments[Number(task.id)]}
                  apiUrl={apiUrl || ''}
                  softwareId={selectedSoftware?.id}
                  onImageClick={(url) => { setCardGalleryImages([{ url }]); setCardGalleryIndex(0); }}
                  onGalleryOpen={(images, idx) => { setCardGalleryImages(images); setCardGalleryIndex(idx); }}
                />
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

      {/* Image gallery lightbox (from task cards) */}
      {cardGalleryImages.length > 0 && (
        <TaskImageLightbox
          images={cardGalleryImages}
          initialIndex={cardGalleryIndex}
          onClose={() => setCardGalleryImages([])}
        />
      )}

      {/* Statement Download Modal */}
      {statementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setStatementModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Billing Statement</h3>
                  <p className="text-xs text-indigo-200">Download task hours as Excel</p>
                </div>
              </div>
              <button
                onClick={() => setStatementModalOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {loadingBillingDates ? (
                <div className="flex items-center justify-center py-8">
                  <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading billing dates…</span>
                </div>
              ) : billingDates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No billing dates found.</p>
                  <p className="text-xs text-gray-400 mt-1">Invoice some tasks first to generate a statement.</p>
                </div>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                    <p className="text-xs text-indigo-600">
                      <strong>{billingDates.length}</strong> billing date{billingDates.length !== 1 ? 's' : ''} found.
                      Select a range below to include in your statement.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">From (billing date)</label>
                      <select
                        value={statementDateFrom}
                        onChange={e => setStatementDateFrom(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                      >
                        <option value="">Select…</option>
                        {billingDates.slice().reverse().map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">To (billing date)</label>
                      <select
                        value={statementDateTo}
                        onChange={e => setStatementDateTo(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                      >
                        <option value="">Select…</option>
                        {billingDates.map(d => (
                          <option key={d} value={d} disabled={!!statementDateFrom && d < statementDateFrom}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick select: last N billings */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Quick select:</p>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 6, 9, 12].filter(n => n <= billingDates.length).map(n => {
                        const isActive = statementDateFrom === billingDates[Math.min(n - 1, billingDates.length - 1)] && statementDateTo === billingDates[0];
                        return (
                          <button
                            key={n}
                            onClick={() => {
                              const last = billingDates.slice(0, n);
                              setStatementDateFrom(last[last.length - 1]);
                              setStatementDateTo(last[0]);
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                              isActive
                                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            Last {n}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => {
                          setStatementDateFrom(billingDates[billingDates.length - 1]);
                          setStatementDateTo(billingDates[0]);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          statementDateFrom === billingDates[billingDates.length - 1] && statementDateTo === billingDates[0]
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All ({billingDates.length})
                      </button>
                    </div>
                  </div>

                  {/* Preview: selected date count */}
                  {statementDateFrom && statementDateTo && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-gray-600">
                        Statement will include <strong>{billingDates.filter(d => d >= statementDateFrom && d <= statementDateTo).length}</strong> billing date{billingDates.filter(d => d >= statementDateFrom && d <= statementDateTo).length !== 1 ? 's' : ''}:
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {billingDates.filter(d => d >= statementDateFrom && d <= statementDateTo).map(d => (
                          <span key={d} className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-white border border-gray-200 rounded text-gray-700">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setStatementModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatementDownload}
                disabled={!statementDateFrom || !statementDateTo || downloadingStatement || billingDates.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {downloadingStatement ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
