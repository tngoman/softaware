import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BugAntIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ComputerDesktopIcon,
  ClockIcon,
  CodeBracketIcon,
  ServerIcon,
  GlobeAltIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import api from '../../services/api';
import type { ClientErrorSummary } from '../../types/updates';

/* ═══════════════════════════════════════════════════════════════
   Error Reports — Browse errors reported by clients
   Two views: Error Log (individual errors) + Client Summaries
   ═══════════════════════════════════════════════════════════════ */

interface ErrorRow {
  id: number;
  software_key: string;
  software_name: string | null;
  client_identifier: string;
  hostname: string | null;
  source: string;
  error_type: string;
  error_level: 'error' | 'warning' | 'notice';
  error_label: string;
  error_message: string;
  error_file: string | null;
  error_line: number | null;
  error_trace: string | null;
  error_url: string | null;
  request_method: string | null;
  request_uri: string | null;
  app_version: string | null;
  os_info: string | null;
  error_occurred_at: string;
  received_at: string;
}

const LEVEL_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  error:   { icon: ExclamationCircleIcon,    color: 'text-red-700',    bg: 'bg-red-100',    label: 'Error' },
  warning: { icon: ExclamationTriangleIcon,  color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Warning' },
  notice:  { icon: InformationCircleIcon,    color: 'text-blue-700',   bg: 'bg-blue-100',   label: 'Notice' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  // Ensure UTC parsing for MySQL datetime strings (no timezone suffix)
  const utcStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  const secs = Math.max(0, Math.floor(diff / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Error Detail Modal ───────────────────────────────────── */
const ErrorDetailModal: React.FC<{
  error: ErrorRow | null;
  onClose: () => void;
}> = ({ error, onClose }) => {
  if (!error) return null;
  const lev = LEVEL_CONFIG[error.error_level] || LEVEL_CONFIG.error;
  const LevelIcon = lev.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between z-10 rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`p-1.5 rounded-lg ${lev.bg}`}>
              <LevelIcon className={`h-5 w-5 ${lev.color}`} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{error.error_label}</h3>
              <p className="text-xs text-gray-500">{error.software_name} • {error.hostname || 'Unknown'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailItem label="Level" value={lev.label} />
            <DetailItem label="Type" value={error.error_type} />
            <DetailItem label="Source" value={error.source} />
            <DetailItem label="Version" value={error.app_version} />
            <DetailItem label="OS" value={error.os_info} />
            <DetailItem label="Occurred" value={error.error_occurred_at ? new Date(error.error_occurred_at).toLocaleString() : '—'} />
            <DetailItem label="Received" value={new Date(error.received_at).toLocaleString()} />
            <DetailItem label="Client ID" value={error.client_identifier?.substring(0, 16) + '...'} />
          </div>

          {/* File + line */}
          {error.error_file && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <CodeBracketIcon className="h-3.5 w-3.5" /> File Location
              </p>
              <p className="text-sm font-mono text-gray-800">
                {error.error_file}{error.error_line ? `:${error.error_line}` : ''}
              </p>
            </div>
          )}

          {/* URL / Request */}
          {(error.error_url || error.request_uri) && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                <GlobeAltIcon className="h-3.5 w-3.5" /> Request
              </p>
              {error.request_method && error.request_uri && (
                <p className="text-sm font-mono text-blue-800">
                  {error.request_method} {error.request_uri}
                </p>
              )}
              {error.error_url && (
                <p className="text-sm text-blue-700 mt-1">{error.error_url}</p>
              )}
            </div>
          )}

          {/* Message */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Error Message</p>
            <div className="bg-red-50 rounded-lg p-3">
              <pre className="text-sm text-red-800 whitespace-pre-wrap break-words font-mono leading-relaxed">
                {error.error_message}
              </pre>
            </div>
          </div>

          {/* Stack trace */}
          {error.error_trace && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Stack Trace</p>
              <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {error.error_trace}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

const ErrorReports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'log' | 'summaries'>('log');
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [summaries, setSummaries] = useState<ClientErrorSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorRow | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterHostname, setFilterHostname] = useState(searchParams.get('hostname') || '');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  /* ── Load Errors ───────────────────────────────────────── */
  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (filterLevel) params.level = filterLevel;
      if (filterSource) params.source = filterSource;
      if (filterHostname) params.hostname = filterHostname;

      const res = await api.get('/updates/error-report', { params });
      setErrors(res.data.errors || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      notify.error('Failed to load error reports');
    } finally {
      setLoading(false);
    }
  }, [page, filterLevel, filterSource, filterHostname]);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/updates/error-report/summaries');
      setSummaries(res.data.summaries || []);
    } catch (err: any) {
      notify.error('Failed to load error summaries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'log') loadErrors();
    else loadSummaries();

    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (tab === 'log') loadErrors();
      else loadSummaries();
    }, 30000); // every 30s
    return () => clearInterval(interval);
  }, [tab, loadErrors, loadSummaries, autoRefresh]);

  /* ── Summary KPIs ──────────────────────────────────────── */
  const kpis = {
    totalErrors: summaries.reduce((sum, s) => sum + (s.total_errors || 0), 0),
    totalWarnings: summaries.reduce((sum, s) => sum + (s.total_warnings || 0), 0),
    totalNotices: summaries.reduce((sum, s) => sum + (s.total_notices || 0), 0),
    affectedClients: summaries.length,
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BugAntIcon className="h-7 w-7 text-red-600" />
            Error Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Errors reported by connected clients and applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => tab === 'log' ? loadErrors() : loadSummaries()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('log')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${
            tab === 'log' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Error Log
        </button>
        <button
          onClick={() => setTab('summaries')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${
            tab === 'summaries' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Client Summaries
        </button>
      </div>

      {/* ── Error Log Tab ──────────────────────────────────── */}
      {tab === 'log' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by hostname..."
                value={filterHostname}
                onChange={(e) => { setFilterHostname(e.target.value); setPage(0); }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <select
              value={filterLevel}
              onChange={(e) => { setFilterLevel(e.target.value); setPage(0); }}
              className="px-3 py-2 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Levels</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="notice">Notices</option>
            </select>
            <select
              value={filterSource}
              onChange={(e) => { setFilterSource(e.target.value); setPage(0); }}
              className="px-3 py-2 border rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Sources</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </div>

          {/* Error Table */}
          {loading && errors.length === 0 ? (
            <LoadingSpinner />
          ) : errors.length === 0 ? (
            <EmptyState icon={BugAntIcon} message="No error reports found" />
          ) : (
            <>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Software</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {errors.map((err) => {
                        const lev = LEVEL_CONFIG[err.error_level] || LEVEL_CONFIG.error;
                        const LevIcon = lev.icon;
                        return (
                          <tr
                            key={err.id}
                            className="hover:bg-gray-50 cursor-pointer transition"
                            onClick={() => setSelectedError(err)}
                          >
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${lev.bg} ${lev.color}`}>
                                <LevIcon className="h-3.5 w-3.5" />
                                {lev.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[180px] truncate">
                              {err.error_label}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[280px] truncate font-mono">
                              {err.error_message}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{err.software_name || err.software_key}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {err.hostname ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/client-monitor?search=${encodeURIComponent(err.hostname!)}`); }}
                                  className="text-indigo-600 hover:text-indigo-800 hover:underline transition"
                                  title="View in Client Monitor"
                                >
                                  {err.hostname}
                                </button>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                err.source === 'frontend' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {err.source}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {timeAgo(err.received_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                    {autoRefresh && <span className="ml-2">• Auto-refreshing every 30s</span>}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="p-1.5 rounded border text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1.5 text-xs text-gray-600">
                      Page {page + 1} of {totalPages || 1}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1.5 rounded border text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Summaries Tab ──────────────────────────────────── */}
      {tab === 'summaries' && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total Errors" count={kpis.totalErrors} color="red" icon={ExclamationCircleIcon} />
            <KpiCard label="Total Warnings" count={kpis.totalWarnings} color="yellow" icon={ExclamationTriangleIcon} />
            <KpiCard label="Total Notices" count={kpis.totalNotices} color="blue" icon={InformationCircleIcon} />
            <KpiCard label="Affected Clients" count={kpis.affectedClients} color="gray" icon={ComputerDesktopIcon} />
          </div>

          {loading && summaries.length === 0 ? (
            <LoadingSpinner />
          ) : summaries.length === 0 ? (
            <EmptyState icon={BugAntIcon} message="No error summaries yet" />
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Software</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Errors</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Warnings</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Notices</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Error</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summaries.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{s.hostname || '—'}</p>
                          <p className="text-xs text-gray-400 font-mono">{s.client_identifier?.substring(0, 16)}...</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {(s as any).software_name || s.software_key}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CountBadge count={s.total_errors} color="red" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CountBadge count={s.total_warnings} color="yellow" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CountBadge count={s.total_notices} color="blue" />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {timeAgo(s.last_error_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[250px] truncate font-mono">
                          {(s as any).last_error_message || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t">
                {summaries.length} client{summaries.length !== 1 ? 's' : ''} with errors
              </div>
            </div>
          )}
        </>
      )}

      {/* Error Detail Modal */}
      {selectedError && (
        <ErrorDetailModal error={selectedError} onClose={() => setSelectedError(null)} />
      )}
    </div>
  );
};

/* ── Small helpers ────────────────────────────────────────── */
const LoadingSpinner: React.FC = () => (
  <div className="text-center py-16 text-gray-400">
    <ArrowPathIcon className="h-8 w-8 mx-auto animate-spin mb-3" />
    Loading...
  </div>
);

const EmptyState: React.FC<{ icon: React.ComponentType<{ className?: string }>; message: string }> = ({ icon: Icon, message }) => (
  <div className="text-center py-16 text-gray-400">
    <Icon className="h-10 w-10 mx-auto mb-3" />
    <p className="text-sm">{message}</p>
  </div>
);

const KpiCard: React.FC<{
  label: string;
  count: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = ({ label, count, color, icon: Icon }) => {
  const colors: Record<string, { text: string; bg: string }> = {
    red:    { text: 'text-red-700',    bg: 'bg-red-50' },
    yellow: { text: 'text-yellow-700', bg: 'bg-yellow-50' },
    blue:   { text: 'text-blue-700',   bg: 'bg-blue-50' },
    gray:   { text: 'text-gray-700',   bg: 'bg-gray-50' },
  };
  const c = colors[color] || colors.gray;
  return (
    <div className={`p-4 rounded-xl border ${c.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${c.text}`} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{count.toLocaleString()}</p>
    </div>
  );
};

const CountBadge: React.FC<{ count: number; color: string }> = ({ count, color }) => {
  if (!count) return <span className="text-xs text-gray-300">0</span>;
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colors[color] || ''}`}>
      {count.toLocaleString()}
    </span>
  );
};

export default ErrorReports;
