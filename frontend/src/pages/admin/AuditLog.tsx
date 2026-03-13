import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardDocumentListIcon,
  FunnelIcon,
  TrashIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ScissorsIcon,
  CircleStackIcon,
  ClockIcon,
  UserIcon,
  ShieldCheckIcon,
  EyeIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { AdminAuditLogModel, AuditLogEntry, AuditLogStats, AuditLogFilters } from '../../models';
import { Button, Card, BackButton } from '../../components/UI';
import Swal from 'sweetalert2';

// ── Helpers ──────────────────────────────────────────────────────────────

function relativeDate(d?: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d + 'Z').getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function formatDate(d: string): string {
  return new Date(d + 'Z').toLocaleString();
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400';
  if (status >= 400 && status < 500) return 'text-amber-600 dark:text-amber-400';
  if (status >= 500) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}

// ── Stats Card ───────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
}> = ({ label, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <div className={`${color} p-1.5 rounded-md`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
    </div>
    <div className="space-y-0.5">
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

// ── Detail Modal ─────────────────────────────────────────────────────────

const DetailModal: React.FC<{ entry: AuditLogEntry | null; onClose: () => void }> = ({ entry, onClose }) => {
  if (!entry) return null;

  let parsedBody: any = null;
  try {
    parsedBody = JSON.parse(entry.request_body);
    if (typeof parsedBody === 'object' && Object.keys(parsedBody).length === 0) parsedBody = null;
  } catch { /* ignore */ }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Audit Log Detail</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.user_name || entry.user_email || entry.user_id}</p>
              {entry.user_email && <p className="text-xs text-gray-500">{entry.user_email}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timestamp</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(entry.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Method</p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}`}>
                {entry.action}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <span className={`text-sm font-bold ${statusColor(entry.response_status)}`}>{entry.response_status}</span>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resource</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{entry.resource}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Category</p>
              <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">
                {entry.resource_type}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</p>
              <p className="text-sm text-gray-900 dark:text-white">{entry.duration_ms}ms</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">IP Address</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white">{entry.ip_address || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-900 dark:text-white">{entry.description}</p>
            </div>
          </div>
          {parsedBody && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Request Body</p>
              <pre className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto max-h-48">
                {JSON.stringify(parsedBody, null, 2)}
              </pre>
            </div>
          )}
          {entry.user_agent && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">User Agent</p>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{entry.user_agent}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────

const AuditLog: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(50);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'stats'>('log');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);

  // ── Load Data ──────────────────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminAuditLogModel.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        action: filterAction || undefined,
        resource_type: filterResource || undefined,
        user_id: filterUser || undefined,
        from_date: filterFromDate || undefined,
        to_date: filterToDate || undefined,
        status_min: filterErrorsOnly ? 400 : undefined,
      });
      setEntries(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      console.error('Failed to load audit log:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load audit log' });
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, filterAction, filterResource, filterUser, filterFromDate, filterToDate, filterErrorsOnly]);

  const loadStats = useCallback(async () => {
    try {
      const s = await AdminAuditLogModel.getStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      const f = await AdminAuditLogModel.getFilters();
      setFilters(f);
    } catch (err) {
      console.error('Failed to load filters:', err);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadStats();
    loadFilters();
  }, [loadStats, loadFilters]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleTrim = async () => {
    const result = await Swal.fire({
      title: 'Trim Audit Log',
      html: `
        <p class="text-sm text-gray-600 mb-3">Delete entries older than a specified number of days.</p>
        <input id="trim-days" type="number" min="1" max="3650" value="90" class="swal2-input" placeholder="Days to keep">
      `,
      showCancelButton: true,
      confirmButtonText: 'Trim',
      confirmButtonColor: '#f59e0b',
      preConfirm: () => {
        const input = document.getElementById('trim-days') as HTMLInputElement;
        const days = parseInt(input.value, 10);
        if (!days || days < 1) {
          Swal.showValidationMessage('Please enter a valid number of days');
          return false;
        }
        return days;
      },
    });

    if (result.isConfirmed && result.value) {
      try {
        const res = await AdminAuditLogModel.trim(result.value);
        Swal.fire({ icon: 'success', title: 'Trimmed', text: res.message, timer: 2000 });
        loadEntries();
        loadStats();
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed to trim' });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const result = await Swal.fire({
      title: `Delete ${selectedIds.size} entries?`,
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        const res = await AdminAuditLogModel.bulkDelete(Array.from(selectedIds));
        Swal.fire({ icon: 'success', title: 'Deleted', text: res.message, timer: 2000 });
        setSelectedIds(new Set());
        loadEntries();
        loadStats();
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed to delete' });
      }
    }
  };

  const handlePurge = async () => {
    const result = await Swal.fire({
      title: 'Purge ALL Audit Logs?',
      html: '<p class="text-red-600 font-bold">This will permanently delete ALL audit log entries.</p><p class="text-sm text-gray-500 mt-2">This action cannot be undone.</p>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Purge Everything',
      confirmButtonColor: '#ef4444',
      input: 'text',
      inputPlaceholder: 'Type PURGE to confirm',
      preConfirm: (value: string) => {
        if (value !== 'PURGE') {
          Swal.showValidationMessage('Type PURGE to confirm');
          return false;
        }
        return true;
      },
    });

    if (result.isConfirmed) {
      try {
        const res = await AdminAuditLogModel.purge();
        Swal.fire({ icon: 'success', title: 'Purged', text: res.message, timer: 2000 });
        loadEntries();
        loadStats();
      } catch (err: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed to purge' });
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAction('');
    setFilterResource('');
    setFilterUser('');
    setFilterFromDate('');
    setFilterToDate('');
    setFilterErrorsOnly(false);
    setPage(1);
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)));
    }
  };

  const hasActiveFilters = searchTerm || filterAction || filterResource || filterUser || filterFromDate || filterToDate || filterErrorsOnly;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-6 h-6 text-indigo-500" />
              Admin Audit Log
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Track all administrative actions • SQLite-backed • {stats ? `${stats.total_entries.toLocaleString()} total entries` : '...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadEntries(); loadStats(); }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('log')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'log'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardDocumentListIcon className="w-3.5 h-3.5 inline mr-1" />
          Log Entries
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'stats'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ChartBarIcon className="w-3.5 h-3.5 inline mr-1" />
          Statistics
        </button>
      </div>

      {/* ── Stats Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Total Entries" value={stats.total_entries.toLocaleString()} icon={ClipboardDocumentListIcon} color="bg-indigo-500" />
            <StatCard label="Today" value={stats.entries_today.toLocaleString()} icon={ClockIcon} color="bg-blue-500" />
            <StatCard label="This Week" value={stats.entries_this_week.toLocaleString()} icon={ClockIcon} color="bg-cyan-500" />
            <StatCard label="This Month" value={stats.entries_this_month.toLocaleString()} icon={ClockIcon} color="bg-teal-500" />
            <StatCard label="Errors (4xx/5xx)" value={stats.error_count.toLocaleString()} icon={ExclamationTriangleIcon} color="bg-red-500" />
            <StatCard label="DB Size" value={`${stats.db_size_mb} MB`} icon={CircleStackIcon} color="bg-gray-500" />
          </div>

          {/* Top Users & Resources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-indigo-500" />
                Top Users
              </h3>
              <div className="space-y-2">
                {stats.top_users.map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{u.user_email || 'Unknown'}</span>
                    <span className="font-bold text-gray-900 dark:text-white ml-2">{u.count.toLocaleString()}</span>
                  </div>
                ))}
                {stats.top_users.length === 0 && <p className="text-xs text-gray-400">No data yet</p>}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ShieldCheckIcon className="w-4 h-4 text-purple-500" />
                Top Resource Categories
              </h3>
              <div className="space-y-2">
                {stats.top_resources.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 truncate">{r.resource_type || 'unknown'}</span>
                    <span className="font-bold text-gray-900 dark:text-white ml-2">{r.count.toLocaleString()}</span>
                  </div>
                ))}
                {stats.top_resources.length === 0 && <p className="text-xs text-gray-400">No data yet</p>}
              </div>
            </div>
          </div>

          {/* Date range */}
          {stats.oldest_entry && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Log range: {formatDate(stats.oldest_entry)} → {formatDate(stats.newest_entry!)}
            </p>
          )}

          {/* Maintenance Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Log Maintenance</h3>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleTrim} className="!text-xs !py-1.5 !px-3 bg-amber-500 hover:bg-amber-600 text-white">
                <ScissorsIcon className="w-3.5 h-3.5 mr-1" />
                Trim by Age
              </Button>
              <Button onClick={handlePurge} className="!text-xs !py-1.5 !px-3 bg-red-500 hover:bg-red-600 text-white">
                <TrashIcon className="w-3.5 h-3.5 mr-1" />
                Purge All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'log' && (
        <div className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search resource, description, email..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Toggle Filters */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                  showFilters || hasActiveFilters
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FunnelIcon className="w-3.5 h-3.5" />
                Filters
                {hasActiveFilters && <span className="ml-1 bg-indigo-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">!</span>}
              </button>

              {/* Bulk delete */}
              {selectedIds.size > 0 && (
                <Button onClick={handleBulkDelete} className="!text-xs !py-1.5 !px-3 bg-red-500 hover:bg-red-600 text-white">
                  <TrashIcon className="w-3.5 h-3.5 mr-1" />
                  Delete ({selectedIds.size})
                </Button>
              )}

              {/* Trim */}
              <Button onClick={handleTrim} className="!text-xs !py-1.5 !px-3 bg-amber-500 hover:bg-amber-600 text-white">
                <ScissorsIcon className="w-3.5 h-3.5 mr-1" />
                Trim
              </Button>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Method</label>
                  <select
                    value={filterAction}
                    onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Methods</option>
                    {(filters?.actions || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Category</label>
                  <select
                    value={filterResource}
                    onChange={(e) => { setFilterResource(e.target.value); setPage(1); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Categories</option>
                    {(filters?.resource_types || []).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">User</label>
                  <select
                    value={filterUser}
                    onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Users</option>
                    {(filters?.users || []).map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.user_email || u.user_name || u.user_id}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterErrorsOnly}
                      onChange={(e) => { setFilterErrorsOnly(e.target.checked); setPage(1); }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Errors only (4xx/5xx)
                  </label>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">From</label>
                  <input
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => { setFilterFromDate(e.target.value); setPage(1); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">To</label>
                  <input
                    type="date"
                    value={filterToDate}
                    onChange={(e) => { setFilterToDate(e.target.value); setPage(1); }}
                    className="w-full mt-1 px-2 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex items-end col-span-2 md:col-span-2">
                  <button onClick={clearFilters} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results summary */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              Showing {entries.length} of {total.toLocaleString()} entries
              {hasActiveFilters && ' (filtered)'}
            </span>
            <span>Page {page} of {totalPages}</span>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ClipboardDocumentListIcon className="w-10 h-10 mb-2" />
                <p className="text-sm">No audit log entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === entries.length && entries.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">When</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">User</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Method</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Resource</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Category</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400">Duration</th>
                      <th className="px-3 py-2 font-semibold text-gray-500 dark:text-gray-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                          entry.response_status >= 400 ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap" title={formatDate(entry.created_at)}>
                          {relativeDate(entry.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-gray-900 dark:text-white truncate max-w-[140px]" title={entry.user_email}>
                            {entry.user_name || entry.user_email?.split('@')[0] || entry.user_id}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-gray-700 dark:text-gray-300 font-mono truncate max-w-[280px]" title={entry.resource}>
                            {entry.resource.replace(/^\/api/, '')}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            {entry.resource_type}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-bold ${statusColor(entry.response_status)}`}>
                            {entry.response_status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {entry.duration_ms}ms
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                            title="View details"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (page <= 4) {
                  p = i + 1;
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i;
                } else {
                  p = page - 3 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-all ${
                      p === page
                        ? 'bg-indigo-500 text-white'
                        : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  );
};

export default AuditLog;
