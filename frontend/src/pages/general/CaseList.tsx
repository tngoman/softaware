/**
 * CaseList — User's cases page
 * Lists all cases reported by the current user with filtering and search.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlagIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BugAntIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import { CaseModel } from '../../models/CaseModel';
import { Case, CaseStatus, CaseSeverity } from '../../types/cases';
import { notify } from '../../utils/notify';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100', icon: <FlagIcon className="h-3.5 w-3.5" /> },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: <ArrowPathIcon className="h-3.5 w-3.5" /> },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100', icon: <ClockIcon className="h-3.5 w-3.5" /> },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100', icon: <CheckCircleIcon className="h-3.5 w-3.5" /> },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'text-green-700', dot: 'bg-green-500' },
  medium: { label: 'Medium', color: 'text-yellow-700', dot: 'bg-yellow-500' },
  high: { label: 'High', color: 'text-orange-700', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700', dot: 'bg-red-500' },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  bug: <BugAntIcon className="h-4 w-4 text-red-500" />,
  performance: <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />,
  ui_issue: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />,
  data_issue: <ShieldExclamationIcon className="h-4 w-4 text-purple-500" />,
  security: <ShieldExclamationIcon className="h-4 w-4 text-red-700" />,
  feature_request: <LightBulbIcon className="h-4 w-4 text-blue-500" />,
  other: <FlagIcon className="h-4 w-4 text-gray-500" />,
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

const CaseList: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await CaseModel.getMyCases({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
      });
      setCases(result.cases);
      setPagination(result.pagination);
    } catch (err: any) {
      notify.error('Failed to load cases.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, severityFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Debounced search
  const [searchDebounce, setSearchDebounce] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDebounce), 400);
    return () => clearTimeout(t);
  }, [searchDebounce]);

  const stats = {
    total: cases.length,
    open: cases.filter((c) => c.status === 'open').length,
    inProgress: cases.filter((c) => c.status === 'in_progress').length,
    resolved: cases.filter((c) => c.status === 'resolved' || c.status === 'closed').length,
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlagIcon className="h-7 w-7 text-red-500" />
            My Cases
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your reported issues
          </p>
        </div>
        <button
          onClick={() => navigate('/cases/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-sm hover:shadow-md text-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Report Issue
        </button>
      </div>

      {/* ─── Stats Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-gray-900">{pagination?.total ?? stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total Cases</div>
        </Card>
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          <div className="text-xs text-gray-500 mt-1">Open</div>
        </Card>
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          <div className="text-xs text-gray-500 mt-1">In Progress</div>
        </Card>
        <Card padding="sm" className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          <div className="text-xs text-gray-500 mt-1">Resolved</div>
        </Card>
      </div>

      {/* ─── Search & Filters ────────────────────────────── */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchDebounce}
              onChange={(e) => setSearchDebounce(e.target.value)}
              placeholder="Search cases..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={() => loadCases()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting">Waiting</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                <option value="">All Severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            {(statusFilter || severityFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setSeverityFilter(''); setPage(1); }}
                className="self-end px-3 py-1.5 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Card>

      {/* ─── Cases List ──────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-3 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : cases.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FlagIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No cases found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            {search || statusFilter || severityFilter
              ? 'No cases match your current filters. Try adjusting them.'
              : "You haven't reported any issues yet. Click the flag handle on the right to report one."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
            const severity = SEVERITY_CONFIG[c.severity] || SEVERITY_CONFIG.medium;

            return (
              <Card
                key={c.id}
                padding="none"
                className="hover:shadow-lg transition-shadow cursor-pointer group"
              >
                <button
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="w-full text-left p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        {CATEGORY_ICON[c.category] || CATEGORY_ICON.other}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-400">{c.case_number}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                            <span className={severity.color}>{severity.label}</span>
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 mt-1 truncate group-hover:text-red-600 transition-colors">
                          {c.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{timeAgo(c.created_at)}</span>
                          {c.component_name && (
                            <span className="inline-flex items-center gap-1 text-purple-600">
                              <SparklesIcon className="h-3 w-3" />
                              {c.component_name}
                            </span>
                          )}
                          {c.assignee_name && (
                            <span>Assigned to {c.assignee_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-300 group-hover:text-red-500 transition-colors flex-shrink-0 mt-2" />
                  </div>
                </button>
              </Card>
            );
          })}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseList;
