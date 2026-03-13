import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BugAntIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  PaperClipIcon,
  XMarkIcon,
  LinkIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  UserIcon,
  InboxIcon,
  FireIcon,
  ArrowRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAppStore } from '../../store';
import { useSoftware } from '../../hooks/useSoftware';
import { Bug, Software, BugAttachment } from '../../types';
import { BugsModel } from '../../models/BugsModel';
import { getBaseUrl } from '../../config/app';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────────────────── */

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border border-red-200',
  high:     'bg-orange-100 text-orange-700 border border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low:      'bg-green-100 text-green-700 border border-green-200',
};

const SEVERITY_COLORS = SEVERITY_BADGE; // alias used in dialogs

const STATUS_COLORS: Record<string, string> = {
  open:          'bg-blue-50 text-blue-700 border-blue-200',
  'in-progress': 'bg-amber-50 text-amber-700 border-amber-200',
  'pending-qa':  'bg-indigo-50 text-indigo-700 border-indigo-200',
  resolved:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed:        'bg-gray-100 text-gray-500 border-gray-300',
  reopened:      'bg-purple-50 text-purple-700 border-purple-200',
};

const PHASE_META: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  intake:      { label: 'Intake',      icon: DocumentTextIcon, color: 'text-blue-600'    },
  qa:          { label: 'QA',          icon: ShieldCheckIcon,  color: 'text-amber-600'   },
  development: { label: 'Development', icon: CodeBracketIcon,  color: 'text-purple-600'  },
};

const WORKFLOW_PHASES = ['intake', 'qa', 'development'] as const;

const LAST_SOFTWARE_KEY = 'bugs_last_software_id';

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

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─────────────────────────────────────────────────────────────
   STATS BAR
   ───────────────────────────────────────────────────────────── */
const BugStatsBar: React.FC<{ bugs: Bug[] }> = ({ bugs }) => {
  const counts = {
    open:       bugs.filter(b => b.status === 'open').length,
    active:     bugs.filter(b => b.status === 'in-progress').length,
    pendingQa:  bugs.filter(b => b.status === 'pending-qa').length,
    resolved:   bugs.filter(b => b.status === 'resolved').length,
    critical:   bugs.filter(b => b.severity === 'critical').length,
  };

  const items = [
    { label: 'Open',       value: counts.open,      icon: InboxIcon,        color: 'text-blue-600',    bg: 'bg-blue-50'    },
    { label: 'Active',     value: counts.active,     icon: ClockIcon,        color: 'text-amber-600',   bg: 'bg-amber-50'   },
    { label: 'Pending QA', value: counts.pendingQa,  icon: ShieldCheckIcon,  color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
    { label: 'Resolved',   value: counts.resolved,   icon: CheckCircleIcon,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ...(counts.critical > 0
      ? [{ label: 'Critical', value: counts.critical, icon: FireIcon, color: 'text-red-600', bg: 'bg-red-50' }]
      : []),
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map(item => (
        <div key={item.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${item.bg} min-w-fit`}>
          <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
          <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   STATUS SELECT  — native select, color-coded by status
   ───────────────────────────────────────────────────────────── */
const STATUS_SELECT_CLS: Record<string, string> = {
  'open':        'bg-blue-50    text-blue-800    border-blue-300',
  'in-progress': 'bg-amber-50   text-amber-800   border-amber-300',
  'pending-qa':  'bg-indigo-50  text-indigo-800  border-indigo-300',
  'resolved':    'bg-emerald-50 text-emerald-800 border-emerald-300',
  'closed':      'bg-gray-100   text-gray-600    border-gray-300',
  'reopened':    'bg-purple-50  text-purple-800  border-purple-300',
};

const StatusSelect: React.FC<{ status: string; onChange: (s: string) => void }> = ({ status, onChange }) => (
  <select
    value={status}
    onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
    onClick={e => e.stopPropagation()}
    className={`text-sm font-medium border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200 w-full cursor-pointer ${
      STATUS_SELECT_CLS[status] || 'bg-white text-gray-700 border-gray-300'
    }`}
  >
    <option value="open">Open</option>
    <option value="in-progress">In Progress</option>
    <option value="pending-qa">Pending QA</option>
    <option value="resolved">Resolved</option>
    <option value="closed">Closed</option>
    <option value="reopened">Reopened</option>
  </select>
);

/* ─────────────────────────────────────────────────────────────
   BUG TABLE ROW
   ───────────────────────────────────────────────────────────── */
const BugTableRow: React.FC<{
  bug: Bug;
  isLoading:      boolean;
  onView:         () => void;
  onEdit:         () => void;
  onDelete:       () => void;
  onWorkflow:     () => void;
  onLinkTask:     () => void;
  onConvert:      () => void;
  onStatusChange: (status: string) => void;
}> = ({ bug, isLoading, onView, onEdit, onDelete, onWorkflow, onLinkTask, onConvert, onStatusChange }) => {
  const phase    = PHASE_META[bug.workflow_phase] || PHASE_META.intake;
  const PhaseIcon = phase.icon;
  const isClosed  = bug.status === 'closed';

  const sevBorderCls: Record<string, string> = {
    critical: 'border-l-red-500',
    high:     'border-l-orange-400',
    medium:   'border-l-yellow-400',
    low:      'border-l-green-400',
  };

  return (
    <tr className={`group border-l-4 ${sevBorderCls[bug.severity] || 'border-l-gray-200'} hover:bg-gray-50 transition-colors ${isClosed ? 'opacity-60' : ''}`}>

      {/* Severity */}
      <td className="pl-3 pr-2 py-3">
        <span className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${SEVERITY_BADGE[bug.severity]}`}>
          {bug.severity === 'critical' ? 'Critical' : bug.severity.charAt(0).toUpperCase() + bug.severity.slice(1)}
        </span>
      </td>

      {/* ID */}
      <td className="px-2 py-3">
        <span className="font-mono text-sm text-gray-400">#{bug.id}</span>
      </td>

      {/* Title */}
      <td className="px-2 py-3">
        <button onClick={onView} disabled={isLoading} className="text-left w-full group/title">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold leading-snug hover:text-red-600 transition-colors ${
            isClosed ? 'line-through text-gray-400' : 'text-gray-900'
          }`}>
            {isLoading && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" />}
            {bug.title}
            {bug.converted_to_task && (
              <span className="ml-2 text-[11px] font-medium bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full align-middle">
                → Task
              </span>
            )}
            {!bug.converted_to_task && bug.converted_from_task === 1 && (
              <span className="ml-2 text-[11px] font-medium bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full align-middle">
                ← Task
              </span>
            )}
          </span>
          {(bug.software_name || (bug.attachment_count || 0) > 0) && (
            <span className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {bug.software_name && <span>{bug.software_name}</span>}
              {(bug.attachment_count || 0) > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <PaperClipIcon className="w-3 h-3" />{bug.attachment_count}
                </span>
              )}
            </span>
          )}
        </button>
      </td>

      {/* Reporter */}
      <td className="px-2 py-3">
        <span className="text-sm text-gray-700">{bug.reporter_name}</span>
        {bug.assigned_to_name && (
          <span className="block text-xs text-gray-400 mt-0.5">
            → {bug.assigned_to_name}
          </span>
        )}
      </td>

      {/* Replies */}
      <td className="px-2 py-3">
        {(bug.comment_count || 0) > 0 ? (
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors"
            title={`${bug.comment_count} comment${bug.comment_count !== 1 ? 's' : ''} — click to view`}
          >
            <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
            {bug.comment_count}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-300">
            <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
            —
          </span>
        )}
      </td>

      {/* Phase */}
      <td className="px-2 py-3">
        <button
          onClick={onWorkflow}
          title="Change phase"
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-md border border-transparent hover:border-gray-200 hover:bg-white transition-all ${phase.color}`}
        >
          <PhaseIcon className="w-4 h-4 flex-shrink-0" />
          {phase.label}
        </button>
      </td>

      {/* Status */}
      <td className="px-2 py-3">
        <StatusSelect status={bug.status} onChange={onStatusChange} />
      </td>

      {/* Date */}
      <td className="px-2 py-3">
        <span className="text-sm text-gray-500 whitespace-nowrap">{relativeDate(bug.created_at)}</span>
      </td>

      {/* Actions */}
      <td className="pl-2 pr-3 py-3">
        <div className="flex items-center justify-end gap-0.5">
          <button onClick={onView}    title="View"  disabled={isLoading} className="p-1.5 rounded text-gray-400 hover:text-blue-600   hover:bg-blue-50   transition-colors disabled:opacity-50">{isLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <EyeIcon className="w-4 h-4" />}</button>
          <button onClick={onEdit}    title="Edit"  disabled={isLoading} className="p-1.5 rounded text-gray-400 hover:text-amber-600  hover:bg-amber-50  transition-colors disabled:opacity-50"><PencilIcon          className="w-4 h-4" /></button>
          <button onClick={onLinkTask} title="Link task"     className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><LinkIcon            className="w-4 h-4" /></button>
          {!bug.converted_to_task && (
            <button onClick={onConvert} title="Convert to task" className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"><ArrowsRightLeftIcon className="w-4 h-4" /></button>
          )}
          <button onClick={onDelete}  title="Delete"        className="p-1.5 rounded text-gray-400 hover:text-red-600    hover:bg-red-50   transition-colors"><TrashIcon           className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────── */
const BugsPage: React.FC = () => {
  const { user } = useAppStore();
  const { software } = useSoftware();

  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [phaseFilter,    setPhaseFilter]    = useState<string>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const role = (stored?.role?.slug || stored?.role_name || stored?.roles?.[0]?.slug || '').toLowerCase();
      switch (role) {
        case 'client_manager': return 'intake';
        case 'qa_specialist':  return 'quality_review';
        case 'developer':      return 'development';
        default:               return 'all';
      }
    } catch { return 'all'; }
  });
  const [softwareFilter, setSoftwareFilter] = useState<string>(() =>
    localStorage.getItem(LAST_SOFTWARE_KEY) || ''
  );

  const [bugs,    setBugs]    = useState<Bug[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen,  setCreateOpen]  = useState(false);
  const [editBug,     setEditBug]     = useState<Bug | null>(null);
  const [detailBug,   setDetailBug]   = useState<Bug | null>(null);
  const [workflowBug, setWorkflowBug] = useState<Bug | null>(null);
  const [linkTaskBug, setLinkTaskBug] = useState<Bug | null>(null);
  const [loadingBugId, setLoadingBugId] = useState<number | null>(null);

  const userName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.user_name || user?.email || 'Unknown';

  const phaseInitialized = useRef(false);

  useEffect(() => {
    if (softwareFilter) localStorage.setItem(LAST_SOFTWARE_KEY, softwareFilter);
  }, [softwareFilter]);

  // Set default phase filter based on user role (runs once when user is available)
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

  /* ── Load ─────────────────────────────────────────────────── */
  const loadBugs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, any> = { limit: 200 };
      if (softwareFilter) params.software_id = softwareFilter;
      const res = await BugsModel.getAll(params);
      setBugs(res?.data?.bugs || []);
    } catch (err: any) {
      notify.error(err.message || 'Failed to load bugs');
    } finally {
      setLoading(false);
    }
  }, [softwareFilter]);

  useEffect(() => { loadBugs(); }, [loadBugs]);

  // Auto-open bug from dashboard navigation
  useEffect(() => {
    const openBugId = localStorage.getItem('openBugId');
    if (openBugId && bugs.length > 0) {
      const bugToOpen = bugs.find(b => String(b.id) === openBugId);
      if (bugToOpen) {
        localStorage.removeItem('openBugId');
        (async () => {
          setLoadingBugId(bugToOpen.id);
          try {
            const res = await BugsModel.getById(bugToOpen.id);
            setDetailBug(res?.data?.bug || null);
          } catch { /* ignore */ }
          finally { setLoadingBugId(null); }
        })();
      }
    }
  }, [bugs]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Client filtering ─────────────────────────────────────── */
  const filteredBugs = useMemo(() => bugs.filter(b => {
    if (statusFilter   !== 'all' && b.status         !== statusFilter)   return false;
    if (severityFilter !== 'all' && b.severity        !== severityFilter) return false;
    if (phaseFilter    !== 'all' && b.workflow_phase  !== phaseFilter)    return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.title?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.reporter_name?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [bugs, statusFilter, severityFilter, phaseFilter, search]);

  /* ── Inline status change (optimistic) ───────────────────── */
  const handleStatusChange = async (bug: Bug, newStatus: string) => {
    if (bug.status === newStatus) return;
    setBugs(prev => prev.map(b => b.id === bug.id ? { ...b, status: newStatus as any } : b));
    try {
      await BugsModel.update(bug.id, { status: newStatus });
    } catch (err: any) {
      notify.error(err.message || 'Failed to update status');
      loadBugs(true);
    }
  };

  /* ── Delete ───────────────────────────────────────────────── */
  const handleDelete = async (bug: Bug) => {
    const result = await Swal.fire({
      title: 'Delete Bug',
      text: `Delete "${bug.title}"? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await BugsModel.delete(bug.id);
      notify.success('Bug deleted');
      loadBugs(true);
    } catch (err: any) {
      notify.error(err.message || 'Failed to delete');
    }
  };

  /* ── Convert to Task ──────────────────────────────────────── */
  const handleConvertToTask = async (bug: Bug) => {
    const result = await Swal.fire({
      title: 'Convert to Task',
      text: `Create a task from "${bug.title}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Convert',
    });
    if (!result.isConfirmed) return;
    try {
      await BugsModel.convertToTask(bug.id, userName);
      notify.success('Bug converted to task');
      loadBugs(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Conversion failed');
    }
  };

  const handleViewBug = async (bug: Bug) => {
    setLoadingBugId(bug.id);
    try {
      const res = await BugsModel.getById(bug.id);
      setDetailBug(res?.data?.bug || null);
    } catch { notify.error('Failed to load bug details'); }
    finally { setLoadingBugId(null); }
  };

  const handleEditBug = async (bug: Bug) => {
    setLoadingBugId(bug.id);
    try {
      const res = await BugsModel.getById(bug.id);
      setEditBug(res?.data?.bug || null);
    } catch { notify.error('Failed to load bug'); }
    finally { setLoadingBugId(null); }
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="space-y-4">

      {/* ── Header Card ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border px-5 py-4">
        <div className="flex flex-col gap-4">

          {/* Row 1: Icon+Title | Stats | Software selector */}
          <div className="flex items-center justify-between gap-4 flex-wrap">

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                <BugAntIcon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bugs</h2>
            </div>

            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden md:block">
                <BugStatsBar bugs={bugs} />
              </div>
              <div className="w-px h-6 bg-gray-200 hidden md:block" />
              <span className="text-sm text-gray-400 shrink-0">
                <span className="font-semibold text-gray-700">
                  {filteredBugs.length < bugs.length ? `${filteredBugs.length}/` : ''}{bugs.length}
                </span>{' '}bugs
              </span>
            </div>

            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/50 shrink-0">
              <BugAntIcon className="h-4 w-4 text-gray-400" />
              <select
                value={softwareFilter}
                onChange={e => setSoftwareFilter(e.target.value)}
                className="text-sm border-0 p-0 bg-transparent focus:ring-0 min-w-[140px] text-gray-700"
              >
                <option value="">All Software</option>
                {software.map(sw => <option key={sw.id} value={sw.id}>{sw.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Row 2: Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">

            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm shrink-0"
            >
              <PlusIcon className="w-4 h-4" /> Report Bug
            </button>

            <button
              onClick={() => loadBugs()}
              disabled={loading}
              title="Refresh"
              className="w-8 h-8 inline-flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="w-px h-8 bg-gray-200" />

            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search bugs…"
                className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none">×</button>
              )}
            </div>

            <div className="w-px h-8 bg-gray-200" />

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-red-200"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="pending-qa">Pending QA</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="reopened">Reopened</option>
            </select>

            {/* Severity filter */}
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-red-200"
            >
              <option value="all">All Severities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>

            {/* Phase filter */}
            <select
              value={phaseFilter}
              onChange={e => setPhaseFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-red-200"
            >
              <option value="all">All Phases</option>
              {WORKFLOW_PHASES.map(p => (
                <option key={p} value={p}>{PHASE_META[p].label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── List ────────────────────────────────────────────── */}
      {loading && bugs.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-red-400" />
            </div>
            <p className="text-sm text-gray-400">Loading bugs…</p>
          </div>
        </div>
      ) : filteredBugs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <BugAntIcon className="h-8 w-8 text-red-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">No bugs found</h3>
          <p className="text-sm text-gray-400 mb-5">
            {search || statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'Click "Report Bug" to log the first one.'}
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm"
          >
            <PlusIcon className="h-4 w-4" /> Report Bug
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="pl-3 pr-2 py-3 text-left w-28">Severity</th>
                <th className="px-2 py-3 text-left w-14">#</th>
                <th className="px-2 py-3 text-left">Title</th>
                <th className="px-2 py-3 text-left w-36">Reporter</th>
                <th className="px-2 py-3 text-left w-16">Replies</th>
                <th className="px-2 py-3 text-left w-36">Phase</th>
                <th className="px-2 py-3 text-left w-40">Status</th>
                <th className="px-2 py-3 text-left w-24">Created</th>
                <th className="pl-2 pr-3 py-3 text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBugs.map(bug => (
                <BugTableRow
                  key={bug.id}
                  bug={bug}
                  isLoading={loadingBugId === bug.id}
                  onView={() => handleViewBug(bug)}
                  onEdit={() => handleEditBug(bug)}
                  onDelete={() => handleDelete(bug)}
                  onWorkflow={() => setWorkflowBug(bug)}
                  onLinkTask={() => setLinkTaskBug(bug)}
                  onConvert={() => handleConvertToTask(bug)}
                  onStatusChange={(s) => handleStatusChange(bug, s)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────── */}
      {createOpen && (
        <BugFormDialog
          open
          onClose={() => setCreateOpen(false)}
          bug={null}
          software={software}
          defaultSoftwareId={softwareFilter}
          userName={userName}
          onSaved={() => { setCreateOpen(false); loadBugs(true); }}
        />
      )}
      {editBug && (
        <BugFormDialog
          open
          onClose={() => setEditBug(null)}
          bug={editBug}
          software={software}
          defaultSoftwareId={softwareFilter}
          userName={userName}
          onSaved={() => { setEditBug(null); loadBugs(true); }}
        />
      )}
      {detailBug && (
        <BugDetailDialog
          open
          onClose={() => setDetailBug(null)}
          bug={detailBug}
          userName={userName}
          onRefresh={async () => {
            try {
              const res = await BugsModel.getById(detailBug.id);
              setDetailBug(res?.data?.bug || null);
            } catch { /* ignore */ }
          }}
          onConvertToTask={() => { handleConvertToTask(detailBug); setDetailBug(null); }}
        />
      )}
      {workflowBug && (
        <WorkflowDialog
          open
          onClose={() => setWorkflowBug(null)}
          bug={workflowBug}
          userName={userName}
          onSaved={() => { setWorkflowBug(null); loadBugs(true); }}
        />
      )}
      {linkTaskBug && (
        <LinkTaskDialog
          open
          onClose={() => setLinkTaskBug(null)}
          bug={linkTaskBug}
          onSaved={() => { setLinkTaskBug(null); loadBugs(true); }}
        />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BUG FORM DIALOG
   ───────────────────────────────────────────────────────────── */
const BugFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  bug: Bug | null;
  software: Software[];
  defaultSoftwareId: string;
  userName: string;
  onSaved: () => void;
}> = ({ open, onClose, bug, software, defaultSoftwareId, userName, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', current_behaviour: '',
    expected_behaviour: '', reporter_name: '', software_id: '', severity: 'medium',
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (bug) {
      setForm({
        title: bug.title || '', description: bug.description || '',
        current_behaviour: bug.current_behaviour || '',
        expected_behaviour: bug.expected_behaviour || '',
        reporter_name: bug.reporter_name || '',
        software_id: String(bug.software_id || ''), severity: bug.severity || 'medium',
      });
    } else {
      setForm({ title: '', description: '', current_behaviour: '',
        expected_behaviour: '', reporter_name: userName,
        software_id: defaultSoftwareId, severity: 'medium' });
    }
    setPendingFiles([]);
  }, [open, bug, userName, defaultSoftwareId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { notify.error('Title is required'); return; }
    if (!form.reporter_name.trim()) { notify.error('Reporter name is required'); return; }
    setLoading(true);
    try {
      const swName = software.find(s => String(s.id) === form.software_id)?.name;
      if (bug) {
        await BugsModel.update(bug.id, { ...form, software_id: form.software_id ? Number(form.software_id) : null, software_name: swName });
        notify.success('Bug updated');
      } else {
        const res = await BugsModel.create({ ...form, software_id: form.software_id ? Number(form.software_id) : null, software_name: swName, created_by_name: userName });
        const bugId = res?.data?.bug?.id;
        if (bugId && pendingFiles.length > 0) {
          try { await BugsModel.uploadAttachments(bugId, pendingFiles, userName); } catch { /* non-critical */ }
        }
        notify.success('Bug reported');
      }
      onSaved();
    } catch (err: any) {
      notify.error(err.response?.data?.message || err.message || 'Save failed');
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BugAntIcon className="w-5 h-5 text-red-500" />
            {bug ? 'Edit Bug' : 'Report Bug'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Brief description of the bug" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Software</label>
              <select value={form.software_id} onChange={e => setForm({ ...form, software_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select software...</option>
                {software.map(sw => <option key={sw.id} value={sw.id}>{sw.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporter *</label>
              <input value={form.reporter_name} onChange={e => setForm({ ...form, reporter_name: e.target.value })}
                required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Your name" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Detailed description..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-red-500">●</span> Current Behaviour
            </label>
            <textarea value={form.current_behaviour} onChange={e => setForm({ ...form, current_behaviour: e.target.value })}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="What currently happens..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-green-500">●</span> Expected Behaviour
            </label>
            <textarea value={form.expected_behaviour} onChange={e => setForm({ ...form, expected_behaviour: e.target.value })}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="What should happen instead..." />
          </div>

          {!bug && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-red-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <ArrowUpTrayIcon className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">Click to upload files</p>
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              </div>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 ml-2">
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Saving…' : bug ? 'Update Bug' : 'Report Bug'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BUG DETAIL DIALOG
   ───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   ATTACHMENT IMAGE  — fetches with auth, shows inline + lightbox
   ───────────────────────────────────────────────────────────── */
const AttachmentImage: React.FC<{
  att: BugAttachment;
  bugId: number;
  onDelete: (id: number) => void;
}> = ({ att, bugId, onDelete }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    const fullUrl = getBaseUrl() + BugsModel.getAttachmentUrl(bugId, att.id);
    const token   = localStorage.getItem('jwt_token');
    fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => { objectUrl = URL.createObjectURL(blob); setBlobUrl(objectUrl); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [bugId, att.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="relative group rounded-lg overflow-hidden bg-gray-100 aspect-video">
        {loading && <div className="absolute inset-0 animate-pulse bg-gray-200" />}
        {!loading && !blobUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <PaperClipIcon className="w-8 h-8" />
          </div>
        )}
        {blobUrl && (
          <img
            src={blobUrl}
            alt={att.original_name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setLightbox(true)}
          />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all pointer-events-none" />
        {/* Filename tooltip */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-white text-[11px] truncate">{att.original_name}</p>
          <p className="text-white/60 text-[10px]">{formatFileSize(att.file_size)}</p>
        </div>
        {/* Delete button */}
        <button
          onClick={() => onDelete(att.id)}
          className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Lightbox */}
      {lightbox && blobUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(false)}
        >
          <img
            src={blobUrl}
            alt={att.original_name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <a
              href={blobUrl}
              download={att.original_name}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm"
            >
              <ArrowDownTrayIcon className="w-4 h-4" /> Download
            </a>
            <button
              className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              onClick={() => setLightbox(false)}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
            {att.original_name} · {formatFileSize(att.file_size)} · {relativeDate(att.created_at)}
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   ATTACHMENT FILE  — non-image, opens via blob URL
   ───────────────────────────────────────────────────────────── */
const AttachmentFile: React.FC<{
  att: BugAttachment;
  bugId: number;
  onDelete: (id: number) => void;
}> = ({ att, bugId, onDelete }) => {
  const [opening, setOpening] = useState(false);

  const openFile = async () => {
    setOpening(true);
    try {
      const fullUrl = getBaseUrl() + BugsModel.getAttachmentUrl(bugId, att.id);
      const token   = localStorage.getItem('jwt_token');
      const res     = await fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      notify.error('Could not open file');
    } finally {
      setOpening(false);
    }
  };

  const downloadFile = async () => {
    try {
      const fullUrl = getBaseUrl() + BugsModel.getAttachmentUrl(bugId, att.id);
      const token   = localStorage.getItem('jwt_token');
      const res     = await fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href     = blobUrl;
      a.download = att.original_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch {
      notify.error('Could not download file');
    }
  };

  const isPdf = att.mime_type === 'application/pdf';

  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 hover:bg-white hover:border-gray-200 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isPdf ? 'bg-red-100' : 'bg-blue-50'
      }`}>
        <DocumentTextIcon className={`w-5 h-5 ${isPdf ? 'text-red-500' : 'text-blue-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{att.original_name}</p>
        <p className="text-xs text-gray-400">
          {formatFileSize(att.file_size)}
          {att.uploaded_by ? ` · ${att.uploaded_by}` : ''}
          {' · '}{relativeDate(att.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={openFile}
          disabled={opening}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <EyeIcon className="w-3.5 h-3.5" />
          {opening ? 'Opening…' : 'View'}
        </button>
        <button
          onClick={downloadFile}
          title="Download"
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(att.id)}
          title="Delete"
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const BugDetailDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  bug: Bug;
  userName: string;
  onRefresh: () => void;
  onConvertToTask: () => void;
}> = ({ open, onClose, bug, userName, onRefresh, onConvertToTask }) => {
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'attachments'>('details');

  if (!open || !bug) return null;

  const comments    = bug.comments    || [];
  const attachments = bug.attachments || [];
  const phase       = PHASE_META[bug.workflow_phase] || PHASE_META.intake;
  const PhaseIcon   = phase.icon;

  const addComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await BugsModel.addComment(bug.id, { content: commentText, author_name: userName });
      setCommentText('');
      notify.success('Comment added');
      onRefresh();
    } catch { notify.error('Failed to add comment'); }
    finally { setAddingComment(false); }
  };

  const deleteComment = async (id: number) => {
    const r = await Swal.fire({ title: 'Delete comment?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' });
    if (!r.isConfirmed) return;
    try { await BugsModel.deleteComment(bug.id, id); notify.success('Deleted'); onRefresh(); }
    catch { notify.error('Failed'); }
  };

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try { await BugsModel.uploadAttachments(bug.id, Array.from(files), userName); notify.success(`${files.length} file(s) uploaded`); onRefresh(); }
    catch { notify.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteAttachment = async (id: number) => {
    const r = await Swal.fire({ title: 'Remove attachment?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Delete' });
    if (!r.isConfirmed) return;
    try { await BugsModel.deleteAttachment(bug.id, id); notify.success('Removed'); onRefresh(); }
    catch { notify.error('Failed'); }
  };

  const tabs = [
    { key: 'details'     as const, label: 'Details'                          },
    { key: 'comments'    as const, label: `Comments (${comments.length})`    },
    { key: 'attachments' as const, label: `Attachments (${attachments.length})` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <BugAntIcon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono">#{bug.id}</span>
                <h3 className="text-base font-semibold truncate">{bug.title}</h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SEVERITY_COLORS[bug.severity]}`}>{bug.severity}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[bug.status]}`}>{bug.status}</span>
                <span className={`text-[10px] inline-flex items-center gap-0.5 ${phase.color}`}>
                  <PhaseIcon className="w-3 h-3" /> {phase.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!bug.converted_to_task && (
              <button onClick={onConvertToTask}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100">
                <ArrowsRightLeftIcon className="w-3.5 h-3.5" /> To Task
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 ml-1"><XMarkIcon className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4 flex-shrink-0">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Reporter:</span><span className="ml-2 font-medium">{bug.reporter_name}</span></div>
                <div><span className="text-gray-500">Software:</span><span className="ml-2 font-medium">{bug.software_name || '—'}</span></div>
                <div><span className="text-gray-500">Assigned To:</span><span className="ml-2 font-medium">{bug.assigned_to_name || '—'}</span></div>
                <div><span className="text-gray-500">Created:</span><span className="ml-2">{bug.created_at ? new Date(bug.created_at).toLocaleString() : '—'}</span></div>
                {bug.resolved_at && (
                  <div><span className="text-gray-500">Resolved:</span><span className="ml-2">{new Date(bug.resolved_at).toLocaleString()} by {bug.resolved_by}</span></div>
                )}
                {bug.linked_task && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Linked Task:</span>
                    <span className="ml-2 text-indigo-600 font-medium">#{bug.linked_task.external_id || bug.linked_task.id} — {bug.linked_task.title}</span>
                  </div>
                )}
              </div>
              {bug.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3" dangerouslySetInnerHTML={{ __html: bug.description }} />
                </div>
              )}
              {bug.current_behaviour && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-1">🔴 Current Behaviour</h4>
                  <div className="text-sm text-gray-600 bg-red-50 rounded-lg p-3 border border-red-200">{bug.current_behaviour}</div>
                </div>
              )}
              {bug.expected_behaviour && (
                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1">🟢 Expected Behaviour</h4>
                  <div className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">{bug.expected_behaviour}</div>
                </div>
              )}
              {bug.resolution_notes && (
                <div>
                  <h4 className="text-sm font-semibold text-emerald-600 mb-1">✅ Resolution Notes</h4>
                  <div className="text-sm text-gray-600 bg-emerald-50 rounded-lg p-3">{bug.resolution_notes}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-3">
              {comments.length === 0
                ? <div className="text-center py-8"><ChatBubbleLeftIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No comments yet</p></div>
                : comments.map(c => (
                  <div key={c.id} className={`rounded-lg p-3 text-sm ${c.comment_type === 'workflow_change' || c.comment_type === 'status_change' ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">{c.author_name}</span>
                        {c.is_internal === 1 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Internal</span>}
                        {(c.comment_type === 'workflow_change' || c.comment_type === 'status_change') && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">System</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{relativeDate(c.created_at)}</span>
                        {c.comment_type === 'comment' && (
                          <button onClick={() => deleteComment(c.id)} className="text-gray-300 hover:text-red-500">
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: c.content }} />
                  </div>
                ))
              }
              <div className="pt-3 border-t">
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Add a comment..." />
                <div className="flex justify-end mt-2">
                  <button onClick={addComment} disabled={addingComment || !commentText.trim()}
                    className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                    {addingComment ? 'Adding…' : 'Add Comment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (() => {
            const imageAtts = attachments.filter(a => a.mime_type?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(a.original_name));
            const fileAtts  = attachments.filter(a => !imageAtts.includes(a));
            return (
              <div className="space-y-4">
                {/* Upload bar */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
                  </span>
                  <input ref={fileRef} type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files) uploadFiles(e.target.files); (e.target as any).value = ''; }} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" />{uploading ? 'Uploading…' : 'Add Files'}
                  </button>
                </div>

                {/* Empty state */}
                {attachments.length === 0 && (
                  <div
                    className="text-center py-14 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-red-300 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ArrowUpTrayIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">Click to upload attachments</p>
                    <p className="text-xs text-gray-400 mt-1">Images, PDFs, documents…</p>
                  </div>
                )}

                {/* Image grid */}
                {imageAtts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Images</p>
                    <div className="grid grid-cols-3 gap-2">
                      {imageAtts.map(att => (
                        <AttachmentImage key={att.id} att={att} bugId={bug.id} onDelete={deleteAttachment} />
                      ))}
                    </div>
                  </div>
                )}

                {/* File list */}
                {fileAtts.length > 0 && (
                  <div>
                    {imageAtts.length > 0 && (
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Files</p>
                    )}
                    <div className="space-y-1.5">
                      {fileAtts.map(att => (
                        <AttachmentFile key={att.id} att={att} bugId={bug.id} onDelete={deleteAttachment} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   WORKFLOW DIALOG
   ───────────────────────────────────────────────────────────── */
const WorkflowDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  bug: Bug;
  userName: string;
  onSaved: () => void;
}> = ({ open, onClose, bug, userName, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(bug.workflow_phase);

  useEffect(() => { setSelectedPhase(bug.workflow_phase); }, [bug]);

  if (!open) return null;

  const currentIdx = WORKFLOW_PHASES.indexOf(bug.workflow_phase as any);

  const handleSave = async () => {
    if (selectedPhase === bug.workflow_phase) { onClose(); return; }
    setLoading(true);
    try {
      await BugsModel.updateWorkflow(bug.id, selectedPhase, userName);
      notify.success(`Phase changed to ${PHASE_META[selectedPhase]?.label || selectedPhase}`);
      onSaved();
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to update workflow');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Bug Workflow Phase</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-500">
            Current: <strong className={PHASE_META[bug.workflow_phase]?.color}>{PHASE_META[bug.workflow_phase]?.label}</strong>
          </p>

          {WORKFLOW_PHASES.map((phase, idx) => {
            const meta    = PHASE_META[phase];
            const PhIcon  = meta.icon;
            const isCurrent  = phase === bug.workflow_phase;
            const isSelected = phase === selectedPhase;
            const isPast     = idx < currentIdx;

            return (
              <button key={phase} onClick={() => setSelectedPhase(phase)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${isSelected ? 'border-red-500 bg-red-50' : isCurrent ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPast ? 'bg-emerald-100 text-emerald-600' : isCurrent ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                  <PhIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-red-700' : ''}`}>{meta.label}</p>
                  {isCurrent && <p className="text-xs text-amber-600">Current phase</p>}
                </div>
                {isSelected && phase !== bug.workflow_phase && (
                  <ArrowRightIcon className="w-4 h-4 ml-auto text-red-500" />
                )}
              </button>
            );
          })}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={loading || selectedPhase === bug.workflow_phase}
              className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Saving…' : 'Update Phase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   LINK TASK DIALOG
   ───────────────────────────────────────────────────────────── */
const LinkTaskDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  bug: Bug;
  onSaved: () => void;
}> = ({ open, onClose, bug, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(bug.linked_task_id || null);

  useEffect(() => {
    if (!open) return;
    setSelectedTaskId(bug.linked_task_id || null);
    api.get('/local-tasks', { params: { limit: 100 } })
      .then(res => { const t = res.data?.data?.tasks || []; setTasks(Array.isArray(t) ? t : []); })
      .catch(() => setTasks([]));
  }, [open, bug]);

  if (!open) return null;

  const filtered = tasks.filter(t => !searchTerm || t.title?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleSave = async () => {
    setLoading(true);
    try {
      await BugsModel.linkTask(bug.id, selectedTaskId);
      notify.success(selectedTaskId ? 'Task linked' : 'Task unlinked');
      onSaved();
    } catch { notify.error('Failed to link task'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold">Link Task</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-4 flex-shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search tasks…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <button onClick={() => setSelectedTaskId(null)}
            className={`w-full text-left p-2.5 rounded-lg mb-1 text-sm border-2 transition-all ${selectedTaskId === null ? 'bg-red-50 border-red-400' : 'border-transparent hover:bg-gray-50'}`}>
            <span className="text-gray-500 italic">No linked task (unlink)</span>
          </button>
          {filtered.map(t => (
            <button key={t.id} onClick={() => setSelectedTaskId(t.id)}
              className={`w-full text-left p-2.5 rounded-lg mb-1 text-sm border-2 transition-all ${selectedTaskId === t.id ? 'bg-red-50 border-red-400' : 'border-transparent hover:bg-gray-50'}`}>
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-gray-400 ml-2">#{t.external_id || t.id} · {t.status}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={loading}
            className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BugsPage;
