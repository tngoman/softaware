/**
 * AdminCaseManagement — Full admin case management dashboard
 *
 * Features:
 * - Analytics overview (KPIs, charts)
 * - Case list with advanced filtering
 * - Bulk operations (assign, update status)
 * - Health monitoring panel
 */

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  FlagIcon, ChartBarIcon, HeartIcon,
  MagnifyingGlassIcon, FunnelIcon, ArrowPathIcon,
  CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon,
  BugAntIcon, ClockIcon, SparklesIcon, CpuChipIcon,
  ShieldExclamationIcon, LightBulbIcon, BoltIcon,
  ArrowTrendingUpIcon, UserCircleIcon,
  CircleStackIcon, ServerStackIcon, CloudIcon,
  Cog6ToothIcon, SignalIcon, ExclamationCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { HealthCheck } from '../../types/cases';
import { Card } from '../../components/UI';
import { CaseModel } from '../../models/CaseModel';
import { Case, CaseAnalytics, HealthStatus } from '../../types/cases';
import Swal from 'sweetalert2';

/* ════════════════════════════════════════════════════════════
   Helpers & Constants
   ════════════════════════════════════════════════════════════ */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'text-green-700', dot: 'bg-green-500' },
  medium: { label: 'Medium', color: 'text-yellow-700', dot: 'bg-yellow-500' },
  high: { label: 'High', color: 'text-orange-700', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700', dot: 'bg-red-500' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const CHECK_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  database:       { icon: CircleStackIcon,       color: 'text-blue-600',   bg: 'bg-blue-100',   label: 'Database' },
  api_errors:     { icon: BugAntIcon,             color: 'text-red-600',    bg: 'bg-red-100',    label: 'API Errors' },
  process:        { icon: CpuChipIcon,            color: 'text-purple-600', bg: 'bg-purple-100', label: 'Process' },
  memory:         { icon: ChartBarIcon,           color: 'text-orange-600', bg: 'bg-orange-100', label: 'Memory' },
  disk:           { icon: ServerStackIcon,        color: 'text-gray-600',   bg: 'bg-gray-100',   label: 'Disk' },
  authentication: { icon: ShieldExclamationIcon,  color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Auth' },
  worker:         { icon: Cog6ToothIcon,          color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Worker' },
  service:        { icon: CloudIcon,              color: 'text-cyan-600',   bg: 'bg-cyan-100',   label: 'Service' },
  ingestion:      { icon: ArrowPathIcon,          color: 'text-teal-600',   bg: 'bg-teal-100',   label: 'Ingestion' },
  enterprise:     { icon: SignalIcon,             color: 'text-emerald-600',bg: 'bg-emerald-100',label: 'Enterprise' },
};

const HEALTH_BADGE: Record<string, { color: string; bg: string }> = {
  healthy: { color: 'text-green-700', bg: 'bg-green-100' },
  warning: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  error:   { color: 'text-red-700',   bg: 'bg-red-100' },
  unknown: { color: 'text-gray-700',  bg: 'bg-gray-100' },
};

function formatDetailKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetailValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (Array.isArray(val)) return `${val.length} items`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/* ════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════ */

const AdminCaseManagement: React.FC = () => {
  const navigate = useNavigate();

  // ─── State ────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'overview' | 'cases' | 'health'>('overview');
  const [cases, setCases] = useState<Case[]>([]);
  const [analytics, setAnalytics] = useState<CaseAnalytics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [pagination, setPagination] = useState<any>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Bulk
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'assign' | 'status'>('status');
  const [bulkStatus, setBulkStatus] = useState('resolved');
  const [bulkResolution, setBulkResolution] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');

  // ─── Data Loading ─────────────────────────────────────────
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await CaseModel.getAnalytics();
      // Ensure analytics has required arrays
      setAnalytics({
        ...data,
        bySeverity: data.bySeverity || [],
        byCategory: data.byCategory || [],
        byStatus: data.byStatus || [],
      });
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await CaseModel.adminGetAll({
        page,
        limit: 25,
        search: search || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        category: categoryFilter || undefined,
        source: sourceFilter || undefined,
      });
      setCases(result.cases);
      setPagination(result.pagination);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load cases.' });
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, severityFilter, categoryFilter, sourceFilter]);

  const loadHealth = useCallback(async () => {
    try {
      const data = await CaseModel.getHealthStatus();
      setHealth(data);
    } catch (err) {
      console.error('Failed to load health:', err);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
    loadCases();
    loadHealth();
  }, []);

  useEffect(() => {
    if (activeView === 'cases') loadCases();
  }, [page, search, statusFilter, severityFilter, categoryFilter, sourceFilter]);

  // Auto-refresh health data every 30s when on health tab
  useEffect(() => {
    if (activeView !== 'health') return;
    loadHealth();
    const interval = setInterval(() => loadHealth(), 30000);
    return () => clearInterval(interval);
  }, [activeView, loadHealth]);

  // Debounced search
  const [searchDebounce, setSearchDebounce] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 400);
    return () => clearTimeout(t);
  }, [searchDebounce]);

  // ─── Bulk Actions ─────────────────────────────────────────
  const handleBulkAction = async () => {
    const ids = Array.from(selectedCases);
    if (ids.length === 0) return;

    try {
      if (bulkAction === 'status') {
        await CaseModel.bulkUpdateStatus(ids, bulkStatus, bulkResolution || undefined);
      } else {
        await CaseModel.bulkAssign(ids, Number(bulkAssignee));
      }

      Swal.fire({ icon: 'success', title: 'Updated', text: `${ids.length} cases updated successfully.` });
      setSelectedCases(new Set());
      setBulkDialogOpen(false);
      loadCases();
      loadAnalytics();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Bulk operation failed.' });
    }
  };

  const handleRunHealthChecks = async () => {
    setHealthRefreshing(true);
    try {
      await CaseModel.runHealthChecks();
      await new Promise((r) => setTimeout(r, 3000));
      await loadHealth();
      Swal.fire({ icon: 'success', title: 'Health Checks Complete', text: 'All system checks have been refreshed.' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to run health checks.' });
    } finally {
      setHealthRefreshing(false);
    }
  };

  const toggleCase = (id: string) => {
    setSelectedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCases.size === cases.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(cases.map((c) => c.id)));
    }
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlagIcon className="h-7 w-7 text-red-500" />
            Case Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Monitor, manage, and resolve issues across the platform</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunHealthChecks}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <HeartIcon className="h-4 w-4 text-red-500" />
            Run Health Checks
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1">
          {[
            { id: 'overview' as const, label: 'Overview', icon: ChartBarIcon },
            { id: 'cases' as const, label: 'All Cases', icon: FlagIcon },
            { id: 'health' as const, label: 'System Health', icon: HeartIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeView === tab.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Overview Tab ────────────────────────────────── */}
      {activeView === 'overview' && analytics && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl">
                  <FlagIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{analytics.totalCases}</div>
                  <div className="text-xs text-gray-500">Total Cases</div>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-yellow-100 rounded-xl">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{analytics.openCases}</div>
                  <div className="text-xs text-gray-500">Open Cases</div>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-xl">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{analytics.resolvedCases}</div>
                  <div className="text-xs text-gray-500">Resolved</div>
                </div>
              </div>
            </Card>
            <Card padding="sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl">
                  <ClockIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{analytics.avgResolutionTime}</div>
                  <div className="text-xs text-gray-500">Avg Resolution</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Severity */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">By Severity</h3>
              <div className="space-y-3">
                {(analytics.bySeverity || []).map((item) => {
                  const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.medium;
                  const pct = analytics.totalCases > 0 ? (item.count / analytics.totalCases) * 100 : 0;
                  return (
                    <div key={item.severity}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium capitalize ${config.color}`}>{item.severity}</span>
                        <span className="text-gray-500">{item.count}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${config.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* By Category */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">By Category</h3>
              <div className="space-y-3">
                {(analytics.byCategory || []).map((item) => {
                  const pct = analytics.totalCases > 0 ? (item.count / analytics.totalCases) * 100 : 0;
                  return (
                    <div key={item.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 capitalize">{item.category.replace('_', ' ')}</span>
                        <span className="text-gray-500">{item.count}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* By Status */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">By Status</h3>
              <div className="space-y-3">
                {(analytics.byStatus || []).map((item) => {
                  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                  const pct = analytics.totalCases > 0 ? (item.count / analytics.totalCases) * 100 : 0;
                  return (
                    <div key={item.status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${config.color}`}>{config.label}</span>
                        <span className="text-gray-500">{item.count}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${config.bg.replace('bg-', 'bg-')}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Health Summary */}
          {health && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <HeartIcon className="h-5 w-5 text-red-500" />
                  System Health
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{health.total_checks} checks</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    health.overall_status === 'healthy' ? 'bg-green-100 text-green-700' :
                    health.overall_status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {health.overall_status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {health.checks.map((check) => {
                  const typeConf = CHECK_TYPE_CONFIG[check.check_type];
                  const TypeIcon = typeConf?.icon || HeartIcon;
                  const borderColor = check.status === 'healthy' ? 'border-green-200 bg-green-50'
                    : check.status === 'warning' ? 'border-yellow-200 bg-yellow-50'
                    : check.status === 'error' ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50';
                  const iconColor = check.status === 'healthy' ? 'text-green-600'
                    : check.status === 'warning' ? 'text-yellow-600'
                    : check.status === 'error' ? 'text-red-600'
                    : 'text-gray-400';
                  return (
                    <div key={check.id} className={`p-3 rounded-xl border ${borderColor}`}>
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-4 w-4 ${iconColor}`} />
                        <span className="text-xs font-medium text-gray-700 truncate">{check.check_name}</span>
                      </div>
                      {check.response_time_ms != null && (
                        <div className="text-xs text-gray-500 mt-1">{check.response_time_ms}ms</div>
                      )}
                      {check.consecutive_failures > 0 && (
                        <div className="text-xs text-red-500 mt-1">{check.consecutive_failures}× failed</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Cases Tab ───────────────────────────────────── */}
      {activeView === 'cases' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <Card padding="sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchDebounce}
                  onChange={(e) => setSearchDebounce(e.target.value)}
                  placeholder="Search cases..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium ${
                  showFilters ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
              </button>
              {selectedCases.size > 0 && (
                <button
                  onClick={() => setBulkDialogOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
                >
                  <BoltIcon className="h-4 w-4" />
                  Bulk ({selectedCases.size})
                </button>
              )}
            </div>

            {showFilters && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                    <option value="">All</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Severity</label>
                  <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                    <option value="">All</option>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                    <option value="">All</option>
                    <option value="bug">Bug</option>
                    <option value="performance">Performance</option>
                    <option value="ui_issue">UI Issue</option>
                    <option value="data_issue">Data Issue</option>
                    <option value="security">Security</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                    <option value="">All</option>
                    <option value="user_report">User Report</option>
                    <option value="auto_detected">Auto-Detected</option>
                    <option value="health_monitor">Health Monitor</option>
                    <option value="ai_analysis">AI Analysis</option>
                  </select>
                </div>
              </div>
            )}
          </Card>

          {/* Cases Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCases.size === cases.length && cases.length > 0}
                        onChange={toggleAll}
                        className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="animate-spin h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full mx-auto" />
                      </td>
                    </tr>
                  ) : cases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                        No cases found
                      </td>
                    </tr>
                  ) : (
                    cases.map((c) => {
                      const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
                      const sev = SEVERITY_CONFIG[c.severity] || SEVERITY_CONFIG.medium;
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/cases/${c.id}`)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedCases.has(c.id)}
                              onChange={() => toggleCase(c.id)}
                              className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-mono text-gray-400">{c.case_number}</div>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">{c.title}</div>
                            {c.component_name && (
                              <div className="flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                                <SparklesIcon className="h-3 w-3" />
                                {c.component_name}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs">
                              <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
                              <span className={sev.color}>{sev.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                            {c.source === 'health_monitor' ? (
                              <span className="inline-flex items-center gap-1">
                                <CpuChipIcon className="h-3.5 w-3.5 text-blue-500" />
                                Auto
                              </span>
                            ) : c.source === 'user_report' ? (
                              <span className="inline-flex items-center gap-1">
                                <UserCircleIcon className="h-3.5 w-3.5 text-gray-500" />
                                User
                              </span>
                            ) : (
                              c.source.replace('_', ' ')
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {c.assignee_name || <span className="text-gray-400 italic">Unassigned</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {timeAgo(c.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">
                  Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50 hover:bg-white"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                    className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50 hover:bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── Health Tab ──────────────────────────────────── */}
      {activeView === 'health' && (
        <div className="space-y-6">
          {health ? (
            <>
              {/* Status Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${
                    health.overall_status === 'healthy' ? 'bg-green-100' :
                    health.overall_status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <HeartIcon className={`h-8 w-8 ${
                      health.overall_status === 'healthy' ? 'text-green-600' :
                      health.overall_status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 capitalize">System {health.overall_status}</h2>
                    <p className="text-sm text-gray-500">
                      {health.healthy}/{health.total_checks} checks healthy
                      {health.warning > 0 && <span className="text-yellow-600"> · {health.warning} warning</span>}
                      {health.error > 0 && <span className="text-red-600"> · {health.error} error</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRunHealthChecks}
                  disabled={healthRefreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${healthRefreshing ? 'animate-spin' : ''}`} />
                  {healthRefreshing ? 'Running...' : 'Re-run Checks'}
                </button>
              </div>

              {/* Status Summary Badges */}
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> {health.healthy} Healthy
                </div>
                {health.warning > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                    <ExclamationCircleIcon className="h-3.5 w-3.5" /> {health.warning} Warning
                  </div>
                )}
                {health.error > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" /> {health.error} Error
                  </div>
                )}
                {health.unknown > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">
                    ? {health.unknown} Unknown
                  </div>
                )}
              </div>

              {/* Health Check Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {health.checks.map((check: HealthCheck) => {
                  const typeConf = CHECK_TYPE_CONFIG[check.check_type] || { icon: HeartIcon, color: 'text-gray-600', bg: 'bg-gray-100', label: check.check_type };
                  const TypeIcon = typeConf.icon;
                  const badge = HEALTH_BADGE[check.status] || HEALTH_BADGE.unknown;
                  const details = check.details || {};
                  const detailEntries = Object.entries(details).filter(
                    ([, v]) => v !== null && v !== undefined && typeof v !== 'object' && !Array.isArray(v)
                  );

                  return (
                    <Card key={check.id} padding="sm">
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg ${typeConf.bg} flex-shrink-0`}>
                            <TypeIcon className={`h-4 w-4 ${typeConf.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">{check.check_name}</div>
                            <div className="text-xs text-gray-400">{typeConf.label}</div>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase flex-shrink-0 ${badge.bg} ${badge.color}`}>
                          {check.status}
                        </span>
                      </div>

                      {/* Error Message */}
                      {check.error_message && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-100 p-2 rounded-lg mb-2 leading-relaxed">
                          {check.error_message}
                        </div>
                      )}

                      {/* Details Grid */}
                      {detailEntries.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-2 mb-2">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {detailEntries.slice(0, 6).map(([key, val]) => (
                              <div key={key} className="flex justify-between text-xs">
                                <span className="text-gray-500 truncate mr-1">{formatDetailKey(key)}</span>
                                <span className="font-mono text-gray-700 flex-shrink-0">{formatDetailValue(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                        <span>{check.last_check ? timeAgo(check.last_check) : 'Never checked'}</span>
                        <div className="flex items-center gap-3">
                          {check.response_time_ms != null && (
                            <span className="text-gray-500">{check.response_time_ms}ms</span>
                          )}
                          {check.consecutive_failures > 0 && (
                            <span className="text-red-500 font-medium">{check.consecutive_failures}× failed</span>
                          )}
                          {check.case_id && (
                            <button
                              onClick={() => navigate(`/cases/${check.case_id}`)}
                              className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-700"
                              title="View linked case"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Case
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <HeartIcon className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No Health Data</h3>
              <p className="text-sm text-gray-500 mt-1">Run health checks to see system status.</p>
              <button
                onClick={handleRunHealthChecks}
                disabled={healthRefreshing}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {healthRefreshing ? 'Running...' : 'Run Checks Now'}
              </button>
            </Card>
          )}
        </div>
      )}

      {/* ─── Bulk Action Dialog ──────────────────────────── */}
      <Transition show={bulkDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setBulkDialogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
                leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      Bulk Action ({selectedCases.size} cases)
                    </Dialog.Title>
                    <button onClick={() => setBulkDialogOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                      <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBulkAction('status')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                          bulkAction === 'status' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-gray-700'
                        }`}
                      >
                        Update Status
                      </button>
                      <button
                        onClick={() => setBulkAction('assign')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                          bulkAction === 'assign' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-gray-700'
                        }`}
                      >
                        Assign
                      </button>
                    </div>

                    {bulkAction === 'status' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                          <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                        {bulkStatus === 'resolved' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
                            <textarea
                              value={bulkResolution}
                              onChange={(e) => setBulkResolution(e.target.value)}
                              rows={3}
                              placeholder="Describe the resolution..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {bulkAction === 'assign' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assign to (User ID)</label>
                        <input
                          type="number"
                          value={bulkAssignee}
                          onChange={(e) => setBulkAssignee(e.target.value)}
                          placeholder="Enter user ID..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setBulkDialogOpen(false)}
                        className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBulkAction}
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default AdminCaseManagement;
