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
  PaperClipIcon,
  ArrowRightIcon,
  XMarkIcon,
  LinkIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  UserIcon,
  Bars3Icon,
  ViewColumnsIcon,
  InboxIcon,
  RocketLaunchIcon,
  FireIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAppStore } from '../../store';
import { useSoftware } from '../../hooks/useSoftware';
import { Bug, BugComment, BugAttachment, Software } from '../../types';
import { BugsModel } from '../../models/BugsModel';

/* ═══════════════════════════════════════════════════════════════
   Bugs Page — Follows the Tasks page design pattern
   ═══════════════════════════════════════════════════════════════ */

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  reopened: 'bg-purple-100 text-purple-700 border-purple-200',
};

const PHASE_META: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  intake: { label: 'Intake', icon: DocumentTextIcon, color: 'text-blue-600' },
  qa: { label: 'QA', icon: ShieldCheckIcon, color: 'text-amber-600' },
  development: { label: 'Development', icon: CodeBracketIcon, color: 'text-purple-600' },
};

const WORKFLOW_PHASES = ['intake', 'qa', 'development'] as const;

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

const LAST_SOFTWARE_KEY = 'bugs_last_software_id';

/* ═══════════════════════════════════════════════════════════════
   BUG STATS BAR (mirrors TaskStatsBar)
   ═══════════════════════════════════════════════════════════════ */
const BugStatsBar: React.FC<{ bugs: Bug[] }> = ({ bugs }) => {
  const openCount = bugs.filter(b => b.status === 'open').length;
  const inProgressCount = bugs.filter(b => b.status === 'in-progress').length;
  const resolvedCount = bugs.filter(b => b.status === 'resolved').length;
  const criticalCount = bugs.filter(b => b.severity === 'critical').length;

  const stats = [
    { label: 'Open', value: openCount, icon: InboxIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active', value: inProgressCount, icon: RocketLaunchIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Resolved', value: resolvedCount, icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ...(criticalCount > 0 ? [{ label: 'Critical', value: criticalCount, icon: FireIcon, color: 'text-red-600', bg: 'bg-red-50' }] : []),
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${stat.bg} border border-transparent min-w-fit`}
        >
          <stat.icon className={`w-4 h-4 ${stat.color}`} />
          <div className="flex items-baseline gap-1">
            <span className={`text-sm font-bold leading-none ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-gray-500">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
const BugsPage: React.FC = () => {
  const { user } = useAppStore();
  const { software } = useSoftware();

  // View
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() =>
    (localStorage.getItem('bugsViewMode') as 'list' | 'kanban') || 'list'
  );

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [softwareFilter, setSoftwareFilter] = useState<string>(() =>
    localStorage.getItem(LAST_SOFTWARE_KEY) || ''
  );

  // Data
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editBug, setEditBug] = useState<Bug | null>(null);
  const [detailBug, setDetailBug] = useState<Bug | null>(null);
  const [workflowBug, setWorkflowBug] = useState<Bug | null>(null);
  const [linkTaskBug, setLinkTaskBug] = useState<Bug | null>(null);

  const userName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.user_name || user?.email || 'Unknown';

  // Save last software choice
  useEffect(() => {
    if (softwareFilter) {
      localStorage.setItem(LAST_SOFTWARE_KEY, softwareFilter);
    }
  }, [softwareFilter]);

  // ─── Load Bugs ──────────────────────────────────────────────
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

  // ─── Client-side filtering ──────────────────────────────────
  const filteredBugs = useMemo(() => {
    return bugs.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (severityFilter !== 'all' && b.severity !== severityFilter) return false;
      if (phaseFilter !== 'all' && b.workflow_phase !== phaseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.title?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.reporter_name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [bugs, statusFilter, severityFilter, phaseFilter, search]);

  // ─── Kanban grouping ────────────────────────────────────────
  const kanbanColumns = useMemo(() => {
    const columns: Record<string, { label: string; color: string; icon: React.FC<any>; bugs: Bug[] }> = {
      open: { label: 'Open', color: 'border-blue-400', icon: InboxIcon, bugs: [] },
      'in-progress': { label: 'In Progress', color: 'border-amber-400', icon: RocketLaunchIcon, bugs: [] },
      resolved: { label: 'Resolved', color: 'border-emerald-400', icon: CheckCircleIcon, bugs: [] },
      closed: { label: 'Closed', color: 'border-gray-300', icon: ClockIcon, bugs: [] },
    };
    filteredBugs.forEach(b => {
      if (columns[b.status]) columns[b.status].bugs.push(b);
      else if (b.status === 'reopened') columns['open'].bugs.push(b);
    });
    return columns;
  }, [filteredBugs]);

  // ─── Delete ──────────────────────────────────────────────────
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

  // ─── Convert to Task ─────────────────────────────────────────
  const handleConvertToTask = async (bug: Bug) => {
    const result = await Swal.fire({
      title: 'Convert to Task',
      text: `Create a task from bug "${bug.title}"?`,
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
    try {
      const res = await BugsModel.getById(bug.id);
      setDetailBug(res?.data?.bug || null);
    } catch {
      notify.error('Failed to load bug details');
    }
  };

  const handleEditBug = async (bug: Bug) => {
    try {
      const res = await BugsModel.getById(bug.id);
      setEditBug(res?.data?.bug || null);
    } catch {
      notify.error('Failed to load bug');
    }
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header Card — mirrors Tasks layout */}
      <div className="bg-white rounded-xl shadow-sm border px-5 py-4">
        <div className="flex flex-col gap-4">
          {/* Row 1: Title | Stats + Counts | Software + View */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                <BugAntIcon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bugs</h2>
            </div>

            {/* Center: Stats + Counts */}
            <div className="flex items-center gap-4 min-w-0">
              <div className="hidden md:block">
                <BugStatsBar bugs={bugs} />
              </div>
              <div className="w-px h-6 bg-gray-200 hidden md:block" />
              <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                <span className="font-semibold text-gray-700">
                  {filteredBugs.length === bugs.length ? bugs.length : `${filteredBugs.length}/${bugs.length}`}
                </span>
                <span className="text-gray-400">bugs</span>
              </div>
            </div>

            {/* Right: Software selector + View toggle */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/50 hover:bg-white transition-colors">
                <BugAntIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={softwareFilter}
                  onChange={(e) => setSoftwareFilter(e.target.value)}
                  className="text-sm border-0 p-0 bg-transparent focus:ring-0 min-w-[140px] text-gray-700"
                >
                  <option value="">All Software</option>
                  {software.map(sw => (
                    <option key={sw.id} value={sw.id}>{sw.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => { setViewMode('list'); localStorage.setItem('bugsViewMode', 'list'); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Bars3Icon className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => { setViewMode('kanban'); localStorage.setItem('bugsViewMode', 'kanban'); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ViewColumnsIcon className="w-4 h-4" />
                  Kanban
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Row 2: Toolbar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Report Bug */}
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Report Bug
              </button>

              {/* Refresh */}
              <div className="inline-flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden divide-x divide-gray-200">
                <button
                  onClick={() => loadBugs()}
                  disabled={loading}
                  title="Refresh bugs"
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-gray-200" />

              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-8 pr-6 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-gray-200" />

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-200"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="reopened">Reopened</option>
              </select>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-200"
              >
                <option value="all">All Severities</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>

              {/* Workflow phase filter */}
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-200"
              >
                <option value="all">All Phases</option>
                {WORKFLOW_PHASES.map(p => (
                  <option key={p} value={p}>{PHASE_META[p].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && bugs.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-red-500" />
            </div>
            <p className="text-sm text-gray-400">Loading bugs…</p>
          </div>
        </div>
      ) : filteredBugs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <BugAntIcon className="h-8 w-8 text-red-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-1">No Bugs Found</h3>
          <p className="text-sm text-gray-400 mb-4">
            {search || statusFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Click "Report Bug" to create one'}
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm"
          >
            <PlusIcon className="h-4 w-4" /> Report Bug
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ── Kanban View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(kanbanColumns).map(([status, col]) => (
            <div key={status} className="flex flex-col">
              <div className={`bg-white rounded-t-xl border-t-4 ${col.color} border border-gray-200 px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <col.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold rounded-full bg-gray-100 text-gray-600">
                    {col.bugs.length}
                  </span>
                </div>
              </div>
              <div className="bg-gray-50/50 rounded-b-xl border-x border-b border-gray-200 p-2 space-y-2 min-h-[200px]">
                {col.bugs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">No bugs</div>
                ) : (
                  col.bugs.map(bug => (
                    <BugKanbanCard
                      key={bug.id}
                      bug={bug}
                      onView={() => handleViewBug(bug)}
                      onEdit={() => handleEditBug(bug)}
                      onDelete={() => handleDelete(bug)}
                      onWorkflow={() => setWorkflowBug(bug)}
                      onConvert={() => handleConvertToTask(bug)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── List View ── */
        <div className="space-y-2">
          {filteredBugs.map(bug => (
            <BugCard
              key={bug.id}
              bug={bug}
              onView={() => handleViewBug(bug)}
              onEdit={() => handleEditBug(bug)}
              onDelete={() => handleDelete(bug)}
              onWorkflow={() => setWorkflowBug(bug)}
              onConvert={() => handleConvertToTask(bug)}
              onLinkTask={() => setLinkTaskBug(bug)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      {createOpen && (
        <BugFormDialog
          open={createOpen}
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
          open={!!editBug}
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
          open={!!detailBug}
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
          open={!!workflowBug}
          onClose={() => setWorkflowBug(null)}
          bug={workflowBug}
          userName={userName}
          onSaved={() => { setWorkflowBug(null); loadBugs(true); }}
        />
      )}
      {linkTaskBug && (
        <LinkTaskDialog
          open={!!linkTaskBug}
          onClose={() => setLinkTaskBug(null)}
          bug={linkTaskBug}
          onSaved={() => { setLinkTaskBug(null); loadBugs(true); }}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   BUG CARD — List View (mirrors TaskCard list variant)
   ═══════════════════════════════════════════════════════════════ */
const BugCard: React.FC<{
  bug: Bug;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWorkflow: () => void;
  onConvert: () => void;
  onLinkTask: () => void;
}> = ({ bug, onView, onEdit, onDelete, onWorkflow, onConvert, onLinkTask }) => {
  const phase = PHASE_META[bug.workflow_phase] || PHASE_META.intake;
  const PhaseIcon = phase.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group"
      style={{ padding: '0.625rem 0.875rem' }}>
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className="flex items-center pt-1">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[bug.severity] || 'bg-gray-400'}`} title={bug.severity} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-mono">#{bug.id}</span>
            <h3 className="font-semibold text-gray-900 truncate text-[0.8125rem] leading-5">{bug.title}</h3>
            {bug.converted_to_task && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">→ Task</span>
            )}
            {bug.converted_from_task === 1 && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">← Task</span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[bug.severity]} font-medium`}>
              {bug.severity}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border ${STATUS_COLORS[bug.status]} font-medium`}>
              {bug.status}
            </span>
            <span className={`inline-flex items-center gap-1 ${phase.color}`}>
              <PhaseIcon className="w-3 h-3" />
              {phase.label}
            </span>
            {bug.software_name && (
              <span className="text-gray-500 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                {bug.software_name}
              </span>
            )}
            {bug.assigned_to_name && (
              <span className="text-gray-500 flex items-center gap-1">
                <UserIcon className="w-3 h-3" />
                {bug.assigned_to_name}
              </span>
            )}
            <span className="text-gray-400">{relativeDate(bug.created_at)}</span>
            {(bug.comment_count || 0) > 0 && (
              <span className="flex items-center gap-0.5 text-gray-400">
                <ChatBubbleLeftIcon className="w-3 h-3" /> {bug.comment_count}
              </span>
            )}
            {(bug.attachment_count || 0) > 0 && (
              <span className="flex items-center gap-0.5 text-gray-400">
                <PaperClipIcon className="w-3 h-3" /> {bug.attachment_count}
              </span>
            )}
            <span className="text-gray-400">by {bug.reporter_name}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onView} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="View Details">
            <EyeIcon className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600" title="Edit">
            <PencilIcon className="w-4 h-4" />
          </button>
          <button onClick={onWorkflow} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600" title="Workflow">
            <ArrowRightIcon className="w-4 h-4" />
          </button>
          <button onClick={onLinkTask} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600" title="Link Task">
            <LinkIcon className="w-4 h-4" />
          </button>
          {!bug.converted_to_task && (
            <button onClick={onConvert} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600" title="Convert to Task">
              <ArrowsRightLeftIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600" title="Delete">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   BUG KANBAN CARD (compact card for kanban columns)
   ═══════════════════════════════════════════════════════════════ */
const BugKanbanCard: React.FC<{
  bug: Bug;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWorkflow: () => void;
  onConvert: () => void;
}> = ({ bug, onView, onEdit, onDelete, onWorkflow, onConvert }) => {
  const phase = PHASE_META[bug.workflow_phase] || PHASE_META.intake;
  const PhaseIcon = phase.icon;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-all cursor-pointer group"
      onClick={onView}
    >
      {/* Top row: severity dot + title */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[bug.severity] || 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{bug.title}</p>
          <span className="text-[10px] text-gray-400 font-mono">#{bug.id}</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[bug.severity]} font-medium`}>
          {bug.severity}
        </span>
        <span className={`text-[10px] inline-flex items-center gap-0.5 ${phase.color}`}>
          <PhaseIcon className="w-3 h-3" />
          {phase.label}
        </span>
      </div>

      {/* Footer: reporter + time + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{bug.reporter_name}</span>
          <span>{relativeDate(bug.created_at)}</span>
          {(bug.comment_count || 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <ChatBubbleLeftIcon className="w-3 h-3" /> {bug.comment_count}
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-600" title="Edit">
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onWorkflow} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-purple-600" title="Workflow">
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600" title="Delete">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   BUG FORM DIALOG (Create / Edit) — mirrors TaskDialog
   ═══════════════════════════════════════════════════════════════ */
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
    title: '',
    description: '',
    current_behaviour: '',
    expected_behaviour: '',
    reporter_name: '',
    software_id: '',
    severity: 'medium',
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (bug) {
      setForm({
        title: bug.title || '',
        description: bug.description || '',
        current_behaviour: bug.current_behaviour || '',
        expected_behaviour: bug.expected_behaviour || '',
        reporter_name: bug.reporter_name || '',
        software_id: String(bug.software_id || ''),
        severity: bug.severity || 'medium',
      });
    } else {
      setForm({
        title: '',
        description: '',
        current_behaviour: '',
        expected_behaviour: '',
        reporter_name: userName,
        software_id: defaultSoftwareId,
        severity: 'medium',
      });
    }
    setPendingFiles([]);
  }, [open, bug, userName, defaultSoftwareId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { notify.error('Title is required'); return; }
    if (!form.reporter_name.trim()) { notify.error('Reporter name is required'); return; }
    setLoading(true);
    try {
      const swName = software.find(s => String(s.id) === form.software_id)?.name || undefined;
      if (bug) {
        await BugsModel.update(bug.id, {
          ...form,
          software_id: form.software_id ? Number(form.software_id) : null,
          software_name: swName,
        });
        notify.success('Bug updated');
      } else {
        const res = await BugsModel.create({
          ...form,
          software_id: form.software_id ? Number(form.software_id) : null,
          software_name: swName,
          created_by_name: userName,
        });
        const bugId = res?.data?.bug?.id;
        if (bugId && pendingFiles.length > 0) {
          try {
            await BugsModel.uploadAttachments(bugId, pendingFiles, userName);
          } catch { /* non-critical */ }
        }
        notify.success('Bug reported');
      }
      onSaved();
    } catch (err: any) {
      notify.error(err.response?.data?.message || err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BugAntIcon className="w-5 h-5 text-red-500" />
            {bug ? 'Edit Bug' : 'Report Bug'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Brief description of the bug"
            />
          </div>

          {/* Software + Severity + Reporter */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Software</label>
              <select
                value={form.software_id}
                onChange={e => setForm({ ...form, software_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">Select software...</option>
                {software.map(sw => (
                  <option key={sw.id} value={sw.id}>{sw.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporter *</label>
              <input
                value={form.reporter_name}
                onChange={e => setForm({ ...form, reporter_name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Detailed description of the bug..."
            />
          </div>

          {/* Current Behaviour */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-red-600">●</span> Current Behaviour
            </label>
            <textarea
              value={form.current_behaviour}
              onChange={e => setForm({ ...form, current_behaviour: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="What currently happens..."
            />
          </div>

          {/* Expected Behaviour */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="text-green-600">●</span> Expected Behaviour
            </label>
            <textarea
              value={form.expected_behaviour}
              onChange={e => setForm({ ...form, expected_behaviour: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="What should happen instead..."
            />
          </div>

          {/* Attachments (create mode only) */}
          {!bug && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-red-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <ArrowUpTrayIcon className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">Click to upload files</p>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }}
                />
              </div>
              {pendingFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : bug ? 'Update Bug' : 'Report Bug'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   BUG DETAIL DIALOG (View + Comments + Attachments)
   — mirrors TaskDetailsDialog
   ═══════════════════════════════════════════════════════════════ */
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

  const comments = bug.comments || [];
  const attachments = bug.attachments || [];
  const phase = PHASE_META[bug.workflow_phase] || PHASE_META.intake;
  const PhaseIcon = phase.icon;

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await BugsModel.addComment(bug.id, {
        content: commentText,
        author_name: userName,
      });
      setCommentText('');
      notify.success('Comment added');
      onRefresh();
    } catch {
      notify.error('Failed to add comment');
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const result = await Swal.fire({
      title: 'Delete Comment',
      text: 'Delete this comment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await BugsModel.deleteComment(bug.id, commentId);
      notify.success('Comment deleted');
      onRefresh();
    } catch {
      notify.error('Failed to delete comment');
    }
  };

  const handleUploadFiles = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    try {
      await BugsModel.uploadAttachments(bug.id, Array.from(files), userName);
      notify.success(`${files.length} file(s) uploaded`);
      onRefresh();
    } catch {
      notify.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId: number) => {
    const result = await Swal.fire({
      title: 'Delete Attachment',
      text: 'Remove this file?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await BugsModel.deleteAttachment(bug.id, attId);
      notify.success('Attachment removed');
      onRefresh();
    } catch {
      notify.error('Failed to remove attachment');
    }
  };

  const tabs = [
    { key: 'details' as const, label: 'Details' },
    { key: 'comments' as const, label: `Comments (${comments.length})` },
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
                <h3 className="text-lg font-semibold truncate">{bug.title}</h3>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[bug.severity]} font-medium`}>{bug.severity}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[bug.status]} font-medium`}>{bug.status}</span>
                <span className={`text-[10px] inline-flex items-center gap-0.5 ${phase.color}`}>
                  <PhaseIcon className="w-3 h-3" /> {phase.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!bug.converted_to_task && (
              <button
                onClick={onConvertToTask}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                title="Convert to Task"
              >
                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                To Task
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4 flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Reporter:</span>
                  <span className="ml-2 font-medium">{bug.reporter_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Software:</span>
                  <span className="ml-2 font-medium">{bug.software_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Assigned To:</span>
                  <span className="ml-2 font-medium">{bug.assigned_to_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2">{bug.created_at ? new Date(bug.created_at).toLocaleString() : '—'}</span>
                </div>
                {bug.resolved_at && (
                  <div>
                    <span className="text-gray-500">Resolved:</span>
                    <span className="ml-2">{new Date(bug.resolved_at).toLocaleString()} by {bug.resolved_by}</span>
                  </div>
                )}
                {bug.linked_task && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Linked Task:</span>
                    <span className="ml-2 text-indigo-600 font-medium">
                      #{bug.linked_task.external_id || bug.linked_task.id} — {bug.linked_task.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {bug.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                  <div
                    className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3"
                    dangerouslySetInnerHTML={{ __html: bug.description }}
                  />
                </div>
              )}

              {/* Current Behaviour */}
              {bug.current_behaviour && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-1">🔴 Current Behaviour</h4>
                  <div className="text-sm text-gray-600 bg-red-50 rounded-lg p-3 border border-red-200">
                    {bug.current_behaviour}
                  </div>
                </div>
              )}

              {/* Expected Behaviour */}
              {bug.expected_behaviour && (
                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-1">🟢 Expected Behaviour</h4>
                  <div className="text-sm text-gray-600 bg-green-50 rounded-lg p-3 border border-green-200">
                    {bug.expected_behaviour}
                  </div>
                </div>
              )}

              {/* Resolution Notes */}
              {bug.resolution_notes && (
                <div>
                  <h4 className="text-sm font-semibold text-emerald-600 mb-1">✅ Resolution Notes</h4>
                  <div className="text-sm text-gray-600 bg-emerald-50 rounded-lg p-3">
                    {bug.resolution_notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-3">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <ChatBubbleLeftIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No comments yet</p>
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className={`rounded-lg p-3 text-sm ${
                    c.comment_type === 'workflow_change' || c.comment_type === 'status_change'
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">{c.author_name}</span>
                        {c.is_internal === 1 && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Internal</span>
                        )}
                        {(c.comment_type === 'workflow_change' || c.comment_type === 'status_change') && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">System</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{relativeDate(c.created_at)}</span>
                        {c.comment_type === 'comment' && (
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-gray-300 hover:text-red-500"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: c.content }} />
                  </div>
                ))
              )}

              {/* Add comment */}
              <div className="pt-3 border-t">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Add a comment..."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddComment}
                    disabled={addingComment || !commentText.trim()}
                    className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {addingComment ? 'Adding…' : 'Add Comment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-3">
              {/* Upload area */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Manage bug attachments.</p>
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" multiple className="hidden"
                    onChange={(e) => { if (e.target.files) handleUploadFiles(e.target.files); e.target.value = ''; }} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>

              {/* Attachment list */}
              {attachments.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                  <PaperClipIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No attachments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PaperClipIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{att.original_name}</p>
                          <p className="text-xs text-gray-400">
                            {formatFileSize(att.file_size)} · {att.uploaded_by || 'Unknown'} · {relativeDate(att.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={BugsModel.getAttachmentUrl(bug.id, att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                          title="Download"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   WORKFLOW DIALOG — mirrors Tasks WorkflowDialog
   ═══════════════════════════════════════════════════════════════ */
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

  const handleSave = async () => {
    if (selectedPhase === bug.workflow_phase) { onClose(); return; }
    setLoading(true);
    try {
      await BugsModel.updateWorkflow(bug.id, selectedPhase, userName);
      notify.success(`Phase changed to ${PHASE_META[selectedPhase]?.label || selectedPhase}`);
      onSaved();
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to update workflow');
    } finally {
      setLoading(false);
    }
  };

  const currentIdx = WORKFLOW_PHASES.indexOf(bug.workflow_phase as any);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Bug Workflow</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Current phase: <strong className={PHASE_META[bug.workflow_phase]?.color}>{PHASE_META[bug.workflow_phase]?.label}</strong>
          </p>

          {/* Phase selector with visual pipeline */}
          <div className="space-y-2">
            {WORKFLOW_PHASES.map((phase, idx) => {
              const meta = PHASE_META[phase];
              const PhIcon = meta.icon;
              const isCurrent = phase === bug.workflow_phase;
              const isSelected = phase === selectedPhase;
              const isPast = idx < currentIdx;

              return (
                <button
                  key={phase}
                  onClick={() => setSelectedPhase(phase)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-red-500 bg-red-50'
                      : isCurrent
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isPast ? 'bg-emerald-100 text-emerald-600'
                    : isCurrent ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-400'
                  }`}>
                    <PhIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-red-700' : ''}`}>{meta.label}</p>
                    {isCurrent && <p className="text-xs text-amber-600">Current</p>}
                  </div>
                  {isSelected && phase !== bug.workflow_phase && (
                    <ArrowRightIcon className="w-4 h-4 ml-auto text-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleSave}
              disabled={loading || selectedPhase === bug.workflow_phase}
              className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Update Phase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   LINK TASK DIALOG
   ═══════════════════════════════════════════════════════════════ */
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
      .then(res => {
        const taskList = res.data?.data?.tasks || [];
        setTasks(Array.isArray(taskList) ? taskList : []);
      })
      .catch(() => setTasks([]));
  }, [open, bug]);

  if (!open) return null;

  const filtered = tasks.filter(t =>
    !searchTerm || t.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      await BugsModel.linkTask(bug.id, selectedTaskId);
      notify.success(selectedTaskId ? 'Task linked' : 'Task unlinked');
      onSaved();
    } catch {
      notify.error('Failed to link task');
    } finally {
      setLoading(false);
    }
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
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <button
            onClick={() => setSelectedTaskId(null)}
            className={`w-full text-left p-2.5 rounded-lg mb-1 text-sm border-2 transition-all ${
              selectedTaskId === null ? 'bg-red-50 border-red-400' : 'border-transparent hover:bg-gray-50'
            }`}
          >
            <span className="text-gray-500 italic">No linked task (unlink)</span>
          </button>
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={`w-full text-left p-2.5 rounded-lg mb-1 text-sm border-2 transition-all ${
                selectedTaskId === t.id ? 'bg-red-50 border-red-400' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-gray-400 ml-2">#{t.external_id || t.id} · {t.status}</span>
            </button>
          ))}
        </div>

        <div className="p-4 border-t flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BugsPage;
