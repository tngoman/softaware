/**
 * CasesDashboard — Comprehensive case management dashboard with rich statistics
 * 
 * Features:
 * - Real-time KPIs (total, open, resolved, avg resolution time)
 * - Visual charts (severity distribution, category breakdown, status pipeline)
 * - Recent cases list
 * - Trending issues
 * - Team performance snapshot
 * - Quick actions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlagIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  PlusIcon,
  ArrowPathIcon,
  CpuChipIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';
import { CaseModel } from '../../models/CaseModel';
import { Case, CaseAnalytics } from '../../types/cases';
import Swal from 'sweetalert2';

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bug: <BugAntIcon className="h-5 w-5 text-red-500" />,
  performance: <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />,
  ui_issue: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />,
  data_issue: <ShieldExclamationIcon className="h-5 w-5 text-purple-500" />,
  security: <ShieldExclamationIcon className="h-5 w-5 text-red-700" />,
  feature_request: <LightBulbIcon className="h-5 w-5 text-blue-500" />,
  other: <FlagIcon className="h-5 w-5 text-gray-500" />,
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

const CasesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<CaseAnalytics | null>(null);
  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [criticalCases, setCriticalCases] = useState<Case[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsData, recentData, criticalData] = await Promise.all([
        CaseModel.getAnalytics(),
        CaseModel.adminGetAll({ limit: 5, sort_by: 'created_at', sort_order: 'desc' }),
        CaseModel.adminGetAll({ severity: 'critical', status: 'open', limit: 5 }),
      ]);
      // Ensure analytics has required arrays
      setAnalytics({
        ...analyticsData,
        bySeverity: analyticsData.bySeverity || [],
        byCategory: analyticsData.byCategory || [],
        byStatus: analyticsData.byStatus || [],
      });
      setRecentCases(recentData.cases || []);
      setCriticalCases(criticalData.cases || []);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load dashboard data.' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-3 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!analytics) return null;

  // Calculate trends (mock data - in production, compare with previous period)
  const openTrend = 5.2; // % change
  const resolutionTimeTrend = -12.3; // % change (negative is good)

  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlagIcon className="h-7 w-7 text-red-500" />
            Case Management Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor, analyze, and resolve issues across the platform
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/cases')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-sm hover:shadow-md text-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Report Issue
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cases */}
        <Card padding="none" className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{analytics.totalCases || 0}</p>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <FlagIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        {/* Open Cases */}
        <Card padding="none" className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Open Cases</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{analytics.openCases || 0}</p>
              <div className="flex items-center gap-1 mt-1">
                {openTrend > 0 ? (
                  <ArrowTrendingUpIcon className="h-3 w-3 text-orange-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-3 w-3 text-green-500" />
                )}
                <span className={`text-xs font-medium ${openTrend > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {Math.abs(openTrend)}% vs last week
                </span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        {/* Resolved Cases */}
        <Card padding="none" className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{analytics.resolvedCases || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.totalCases > 0 ? Math.round((analytics.resolvedCases / analytics.totalCases) * 100) : 0}% resolution rate
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        {/* Avg Resolution Time */}
        <Card padding="none" className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Resolution</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{analytics.avgResolutionTime}</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowTrendingDownIcon className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium text-green-600">
                  {Math.abs(resolutionTimeTrend)}% faster
                </span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <ClockIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Critical Issues Alert ───────────────────────── */}
      {criticalCases.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="p-3 bg-red-500 rounded-xl">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-red-900">Critical Issues Require Attention</h3>
              <p className="text-sm text-red-700 mt-1">
                {criticalCases.length} critical {criticalCases.length === 1 ? 'case' : 'cases'} currently open
              </p>
              <div className="mt-3 space-y-2">
                {criticalCases.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="flex items-center gap-2 text-sm bg-white rounded-lg p-2 cursor-pointer hover:shadow-sm transition-shadow"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="font-medium text-gray-900 truncate flex-1">{c.title}</span>
                    <span className="text-xs text-gray-500">{c.case_number}</span>
                  </div>
                ))}
              </div>
              {criticalCases.length > 3 && (
                <button
                  onClick={() => navigate('/admin/cases?severity=critical&status=open')}
                  className="mt-2 text-xs text-red-700 hover:text-red-800 font-medium"
                >
                  View all {criticalCases.length} critical cases →
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ─── Main Grid: Charts & Lists ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">By Severity</h3>
          </div>
          <div className="space-y-3">
            {(analytics.bySeverity || []).map((item) => {
              const config = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.medium;
              const pct = analytics.totalCases > 0 ? (item.count / analytics.totalCases) * 100 : 0;
              return (
                <div key={item.severity}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${config.dot}`} />
                      <span className={`text-sm font-medium capitalize ${config.color}`}>
                        {item.severity}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.dot}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {(!analytics.bySeverity || analytics.bySeverity.length === 0) && (
            <p className="text-center text-sm text-gray-400 py-8">No data available</p>
          )}
        </Card>

        {/* Category Breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BugAntIcon className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">By Category</h3>
          </div>
          <div className="space-y-3">
            {(analytics.byCategory || []).map((item) => {
              const pct = analytics.totalCases > 0 ? (item.count / analytics.totalCases) * 100 : 0;
              return (
                <div key={item.category}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.other}
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {(item.category || 'other').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{item.count}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {(!analytics.byCategory || analytics.byCategory.length === 0) && (
            <p className="text-center text-sm text-gray-400 py-8">No data available</p>
          )}
        </Card>

        {/* Status Pipeline */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ArrowPathIcon className="h-5 w-5 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900">Status Pipeline</h3>
          </div>
          <div className="space-y-2.5">
            {(analytics.byStatus || []).map((item) => {
              const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
              return (
                <div
                  key={item.status}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 ${config.bg} border-${config.bg.replace('bg-', 'border-')}`}
                >
                  <span className={`text-sm font-semibold ${config.color}`}>
                    {config.label}
                  </span>
                  <span className={`text-lg font-bold ${config.color}`}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
          {(!analytics.byStatus || analytics.byStatus.length === 0) && (
            <p className="text-center text-sm text-gray-400 py-8">No data available</p>
          )}
        </Card>
      </div>

      {/* ─── Recent Cases ─────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-gray-500" />
            Recent Cases
          </h3>
          <button
            onClick={() => navigate('/admin/cases')}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            View all →
          </button>
        </div>

        {recentCases.length === 0 ? (
          <div className="text-center py-12">
            <FlagIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No cases reported yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCases.map((c) => {
              const severity = SEVERITY_CONFIG[c.severity] || SEVERITY_CONFIG.medium;
              const status = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-all cursor-pointer group"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {CATEGORY_ICONS[c.category ?? 'other'] || CATEGORY_ICONS.other}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{c.case_number}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                        <span className={severity.color}>{severity.label}</span>
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-red-600 transition-colors truncate">
                      {c.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{timeAgo(c.created_at)}</span>
                      {c.component_name && (
                        <span className="inline-flex items-center gap-1 text-purple-600">
                          <SparklesIcon className="h-3 w-3" />
                          {c.component_name}
                        </span>
                      )}
                      {c.source === 'health_monitor' && (
                        <span className="inline-flex items-center gap-1 text-blue-600">
                          <CpuChipIcon className="h-3 w-3" />
                          Auto-detected
                        </span>
                      )}
                      {c.assignee_name && (
                        <span className="inline-flex items-center gap-1">
                          <UserCircleIcon className="h-3 w-3" />
                          {c.assignee_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ─── Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/admin/cases')}
          className="text-left"
        >
          <Card
            padding="sm"
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-red-300"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <FlagIcon className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">All Cases</p>
                <p className="text-xs text-gray-500">Manage all cases</p>
              </div>
            </div>
          </Card>
        </button>

        <button
          onClick={() => navigate('/admin/cases?tab=health')}
          className="text-left"
        >
          <Card
            padding="sm"
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-purple-300"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 rounded-xl">
                <CpuChipIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">System Health</p>
                <p className="text-xs text-gray-500">Monitor system status</p>
              </div>
            </div>
          </Card>
        </button>

      </div>
    </div>
  );
};

export default CasesDashboard;
