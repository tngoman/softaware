import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useSoftware } from '../../hooks/useSoftware';
import { useTasks } from '../../hooks/useTasks';
import { useModules } from '../../hooks/useModules';
import { Software, Task } from '../../types';
import {
  BugAntIcon,
  ArrowRightIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  CodeBracketIcon,
  UserGroupIcon,
  BoltIcon,
  SparklesIcon,
  WrenchIcon,
  ChatBubbleBottomCenterTextIcon,
  CalendarDaysIcon,
  CubeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

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
  new:            'bg-blue-500',
  'in-progress':  'bg-amber-500',
  progress:       'bg-amber-500',
  completed:      'bg-emerald-500',
  pending:        'bg-gray-400',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  development:  <CodeBracketIcon className="h-3 w-3" />,
  'bug-fix':    <BugAntIcon className="h-3 w-3" />,
  feature:      <SparklesIcon className="h-3 w-3" />,
  maintenance:  <WrenchIcon className="h-3 w-3" />,
  support:      <ChatBubbleBottomCenterTextIcon className="h-3 w-3" />,
};

const ROLE_META: Record<string, {
  label: string; color: string; greeting: string; focusPhase: string;
  icon: React.ReactNode;
}> = {
  admin:          { label: 'Admin',          color: 'bg-violet-500',  greeting: 'Full system overview',   focusPhase: 'all', icon: <ShieldCheckIcon className="h-5 w-5" /> },
  super_admin:    { label: 'Super Admin',    color: 'bg-violet-500',  greeting: 'Full system overview',   focusPhase: 'all', icon: <ShieldCheckIcon className="h-5 w-5" /> },
  developer:      { label: 'Developer',      color: 'bg-blue-500',    greeting: 'Your development queue', focusPhase: 'development', icon: <CodeBracketIcon className="h-5 w-5" /> },
  client_manager: { label: 'Client Manager', color: 'bg-emerald-500', greeting: 'Client intake pipeline', focusPhase: 'intake', icon: <UserGroupIcon className="h-5 w-5" /> },
  qa_specialist:  { label: 'QA Specialist',  color: 'bg-amber-500',   greeting: 'Quality review queue',   focusPhase: 'quality_review', icon: <BugAntIcon className="h-5 w-5" /> },
  deployer:       { label: 'Deployer',       color: 'bg-cyan-500',    greeting: 'Deployment pipeline',    focusPhase: 'all', icon: <BoltIcon className="h-5 w-5" /> },
  viewer:         { label: 'Viewer',         color: 'bg-gray-400',    greeting: 'Task overview',          focusPhase: 'all', icon: <ChartBarIcon className="h-5 w-5" /> },
};

const PHASE_ORDER = ['intake', 'quality_review', 'development', 'verification', 'resolution'];

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const { software: softwareList, isLoading: softwareLoading } = useSoftware();

  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Derive apiUrl from selected software
  const apiUrl = useMemo(() => {
    if (!selectedSoftware) return null;
    return selectedSoftware.external_mode === 'live'
      ? selectedSoftware.external_live_url
      : selectedSoftware.external_test_url;
  }, [selectedSoftware]);

  const { tasks, loading, error, loadTasks } = useTasks({ apiUrl });
  const { modules } = useModules(selectedSoftware?.id);

  // Restore selected software from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedTasksSoftware');
    if (saved) {
      try { setSelectedSoftware(JSON.parse(saved)); } catch { /* ignore */ }
    } else if (!softwareLoading && softwareList.length > 0) {
      setSelectedSoftware(softwareList[0]);
      localStorage.setItem('selectedTasksSoftware', JSON.stringify(softwareList[0]));
    }
  }, [softwareLoading, softwareList]);

  // Load tasks when apiUrl changes
  useEffect(() => {
    if (apiUrl) loadTasks();
  }, [apiUrl, loadTasks]);

  // Open auth dialog on 401
  useEffect(() => {
    if (error && (error.toLowerCase().includes('not authenticated') || error.toLowerCase().includes('401'))) {
      setAuthDialogOpen(true);
    }
  }, [error]);

  const handleSoftwareChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sw = softwareList.find(s => String(s.id) === e.target.value);
    if (sw) {
      setSelectedSoftware(sw);
      localStorage.setItem('selectedTasksSoftware', JSON.stringify(sw));
    }
  };

  // ─── Derive role ──────────────────────────────────────────
  const role = (user?.role?.slug || user?.role_name || 'viewer').toLowerCase();
  const roleMeta = ROLE_META[role] || ROLE_META.viewer;

  // ─── Derived stats (spec §8.6) ───────────────────────────
  const stats = useMemo(() => {
    const activeTasks = tasks.filter(t => t.status !== 'completed');

    const PHASE_TO_ROLE: Record<string, string[]> = {
      intake:         ['client_manager', 'admin', 'super_admin'],
      quality_review: ['qa_specialist', 'admin', 'super_admin'],
      development:    ['developer', 'admin', 'super_admin'],
    };
    const userRole = role;

    // Role tasks — active tasks in phases owned by current user's role
    const roleTasks = activeTasks.filter(t => {
      const phase = t.workflow_phase?.toLowerCase() || 'intake';
      const rolesForPhase = PHASE_TO_ROLE[phase];
      if (!rolesForPhase) return userRole === 'admin' || userRole === 'super_admin' || userRole === 'deployer';
      return rolesForPhase.includes(userRole);
    }).sort((a, b) =>
      new Date(b.created_at || b.start || b.date || 0).getTime() -
      new Date(a.created_at || a.start || a.date || 0).getTime()
    );

    // Phase tasks
    const phaseTasks = roleMeta.focusPhase === 'all'
      ? activeTasks
      : activeTasks.filter(t => {
          const phase = t.workflow_phase?.toLowerCase();
          return phase === roleMeta.focusPhase || (!phase && roleMeta.focusPhase === 'intake');
        });

    // By status
    const byStatus: Record<string, number> = { new: 0, 'in-progress': 0, completed: 0, pending: 0 };
    tasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

    // By phase (active only)
    const byPhase: Record<string, number> = {};
    activeTasks.forEach(t => {
      const p = t.workflow_phase?.toLowerCase() || 'intake';
      byPhase[p] = (byPhase[p] || 0) + 1;
    });

    // By module (active only)
    const byModule: Record<string, { id: number; count: number }> = {};
    activeTasks.forEach(t => {
      if (t.module_id) {
        const mod = modules.find(m => m.id === Number(t.module_id));
        const name = mod?.name || t.module_name || `Module #${t.module_id}`;
        if (!byModule[name]) byModule[name] = { id: Number(t.module_id), count: 0 };
        byModule[name].count++;
      }
    });

    // Total unbilled hours
    const totalHours = tasks.reduce((sum, t) => {
      const billed = t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5;
      return billed ? sum : sum + timeToDecimal(t.hours || 0);
    }, 0);

    // Completed unbilled
    const completedUnbilled = tasks.filter(t => {
      if (t.status !== 'completed') return false;
      const billed = (t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5)
                  || Number(t.task_billed) === 1;
      return !billed;
    }).length;

    // Bug tasks
    const bugTasks = activeTasks
      .filter(t => t.type === 'bug-fix')
      .sort((a, b) =>
        new Date(b.created_at || b.start || b.date || 0).getTime() -
        new Date(a.created_at || a.start || a.date || 0).getTime()
      );
    const oldestBug = bugTasks.length > 0 ? bugTasks[bugTasks.length - 1] : null;
    const oldestBugAge = oldestBug
      ? Math.floor((Date.now() - new Date(oldestBug.created_at || oldestBug.start || oldestBug.date || 0).getTime()) / 86400000)
      : 0;

    // Recent 8
    const recent = [...tasks]
      .sort((a, b) =>
        new Date(b.created_at || b.start || b.date || 0).getTime() -
        new Date(a.created_at || a.start || a.date || 0).getTime()
      )
      .slice(0, 8);

    return {
      total: tasks.length,
      activeCount: activeTasks.length,
      roleTasks,
      roleCount: roleTasks.length,
      roleNew: roleTasks.filter(t => t.status === 'new').length,
      roleInProgress: roleTasks.filter(t => t.status === 'in-progress' || t.status === 'progress').length,
      completedUnbilled,
      phaseTasks,
      phaseCount: phaseTasks.length,
      byStatus,
      byPhase,
      byModule,
      bugTasks,
      oldestBug,
      oldestBugAge,
      totalHours,
      recent,
    };
  }, [tasks, role, roleMeta.focusPhase, modules]);

  // First name
  const firstName = user?.first_name || user?.user_name?.split(' ')[0] || user?.email?.split('@')[0] || '';

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* ── Header Bar ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${roleMeta.color} text-white shadow flex items-center justify-center`}>
              {roleMeta.icon}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {firstName ? `Welcome, ${firstName}` : 'Dashboard'}
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium text-gray-600">{roleMeta.label}</span>
                <span>·</span>
                <span>{roleMeta.greeting}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Software selector */}
            <div className="flex items-center gap-1.5">
              <CubeIcon className="h-4 w-4 text-gray-400" />
              <select
                value={selectedSoftware?.id?.toString() || ''}
                onChange={handleSoftwareChange}
                disabled={softwareLoading}
                className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:ring-1 focus:ring-picton-blue focus:border-picton-blue"
              >
                {softwareLoading && <option>Loading…</option>}
                {!softwareLoading && softwareList.length === 0 && <option>No software</option>}
                {softwareList.map(sw => (
                  <option key={sw.id} value={sw.id.toString()}>{sw.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadTasks()}
              disabled={loading || !selectedSoftware}
              className="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              title="Refresh tasks"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body states ────────────────────────────────────── */}
      {!selectedSoftware ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <CubeIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Select a software product to view tasks</p>
        </div>
      ) : error && (error.toLowerCase().includes('401') || error.toLowerCase().includes('not authenticated')) ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <LockClosedIcon className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900 mb-1">Authentication Required</h3>
          <p className="text-sm text-gray-500 mb-4">
            You need to authenticate with <strong>{selectedSoftware.name}</strong> to view tasks.
          </p>
          <p className="text-xs text-gray-400">
            Use the software's external credentials to authenticate. Token will be stored for future requests.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-picton-blue mx-auto mb-3" />
            <p className="text-xs text-gray-400">Loading tasks…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Cards Row (spec §8.9) ────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Oldest Bug */}
            <div
              className={`bg-white rounded-lg shadow-sm border p-3.5 relative overflow-hidden ${stats.oldestBug ? 'cursor-pointer hover:bg-gray-50' : 'opacity-70'} transition-colors`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Oldest Bug</p>
                <div className="bg-red-500/10 p-1 rounded">
                  <BugAntIcon className="h-4 w-4 text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.oldestBug ? (
                  <>{stats.oldestBugAge}<span className="text-sm font-normal text-gray-400 ml-0.5">d</span></>
                ) : (
                  <span className="text-emerald-500">0</span>
                )}
              </p>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">
                {stats.oldestBug ? stats.oldestBug.title : 'No active bugs 🎉'}
              </p>
              <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-red-500/5" />
            </div>

            {/* Card 2: Phase Queue */}
            <div className="bg-white rounded-lg shadow-sm border p-3.5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {roleMeta.focusPhase === 'all' ? 'All Tasks' : `${roleMeta.focusPhase.replace('_', ' ')} queue`}
                </p>
                <div className="bg-amber-500/10 p-1 rounded">
                  <ArrowRightIcon className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.phaseCount}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">of {stats.activeCount} active</p>
              <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-amber-500/5" />
            </div>

            {/* Card 3: Unbilled Hours */}
            <div className="bg-white rounded-lg shadow-sm border p-3.5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Unbilled Hours</p>
                <div className="bg-emerald-500/10 p-1 rounded">
                  <ClockIcon className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalHours.toFixed(1)}<span className="text-sm font-normal text-gray-400 ml-0.5">h</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">across {stats.activeCount} active tasks</p>
              <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-emerald-500/5" />
            </div>

            {/* Card 4: Completed Unbilled */}
            <div className="bg-white rounded-lg shadow-sm border p-3.5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Completed Unbilled</p>
                <div className="bg-violet-500/10 p-1 rounded">
                  <CheckCircleIcon className="h-4 w-4 text-violet-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.completedUnbilled}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">of {stats.byStatus['completed'] || 0} completed</p>
              <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-violet-500/5" />
            </div>
          </div>

          {/* ── Middle Row: Status · Bugs · Workflow (spec §8.10) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* By Status */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-3">
                <ChartBarIcon className="h-4 w-4 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">By Status</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(stats.byStatus)
                  .filter(([k, v]) => v > 0 && k !== 'progress')
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-gray-600 capitalize">{status.replace('-', ' ')}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                {stats.total === 0 && <p className="text-[11px] text-gray-400 text-center py-4">No tasks</p>}
              </div>
            </div>

            {/* Active Bugs */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-3">
                <BugAntIcon className="h-4 w-4 text-red-500" />
                <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Active Bugs</h3>
                {stats.bugTasks.length > 0 && (
                  <span className="ml-auto text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{stats.bugTasks.length}</span>
                )}
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {stats.bugTasks.length > 0 ? stats.bugTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded border hover:bg-gray-50 transition-colors">
                    <div className={`h-5 w-5 rounded ${STATUS_COLORS[t.status]} text-white flex items-center justify-center shrink-0`}>
                      <BugAntIcon className="h-3 w-3" />
                    </div>
                    <span className="text-[11px] text-gray-800 truncate flex-1">{t.title}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{relativeDate(t.created_at || t.start || t.date)}</span>
                  </div>
                )) : (
                  <div className="text-center py-6">
                    <CheckCircleIcon className="h-6 w-6 text-emerald-300 mx-auto mb-1" />
                    <p className="text-[11px] text-gray-400">No active bugs</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Pipeline */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRightIcon className="h-4 w-4 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Workflow Pipeline</h3>
              </div>
              <div className="space-y-1.5">
                {PHASE_ORDER.map(phase => {
                  const count = stats.byPhase[phase] || 0;
                  const isMyPhase = roleMeta.focusPhase === phase;
                  return (
                    <div
                      key={phase}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                        isMyPhase ? 'border-picton-blue/40 bg-picton-blue/5' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isMyPhase && <span className="h-2 w-2 rounded-full bg-picton-blue animate-pulse" />}
                        <span className="text-xs text-gray-700 capitalize">{phase.replace('_', ' ')}</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        isMyPhase ? 'bg-picton-blue text-white' : 'bg-gray-100 text-gray-600'
                      }`}>{count}</span>
                    </div>
                  );
                })}
                {/* Any extra phases not in the fixed order */}
                {Object.entries(stats.byPhase)
                  .filter(([p]) => !PHASE_ORDER.includes(p))
                  .map(([phase, count]) => (
                    <div key={phase} className="flex items-center justify-between rounded-lg border px-3 py-2 bg-white">
                      <span className="text-xs text-gray-700 capitalize">{phase.replace('_', ' ')}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ── Bottom Row: Role Tasks · Modules + Activity (spec §8.11) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Role Tasks */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">{roleMeta.label} Tasks</h3>
                {stats.roleCount > 0 && (
                  <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{stats.roleCount}</span>
                )}
                <button
                  onClick={() => navigate('/tasks')}
                  className="ml-auto text-[10px] text-picton-blue hover:underline font-medium"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-1 max-h-[260px] overflow-y-auto">
                {stats.roleTasks.length > 0 ? stats.roleTasks.slice(0, 12).map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded border hover:bg-gray-50 transition-colors">
                    <div className={`h-5 w-5 rounded ${STATUS_COLORS[t.status]} text-white flex items-center justify-center shrink-0`}>
                      {TYPE_ICONS[t.type] || <CodeBracketIcon className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-800 truncate">{t.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {t.module_name && (
                          <span className="flex items-center gap-0.5">
                            <CubeIcon className="h-2.5 w-2.5" />{t.module_name}
                          </span>
                        )}
                        {t.hours && timeToDecimal(t.hours) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <ClockIcon className="h-2.5 w-2.5" />{timeToDecimal(t.hours).toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border text-gray-500 capitalize shrink-0">
                      {t.workflow_phase?.replace('_', ' ') || 'intake'}
                    </span>
                  </div>
                )) : (
                  <p className="text-[11px] text-gray-400 text-center py-6">No tasks assigned to your role</p>
                )}
              </div>
            </div>

            {/* Right side: Modules + Recent */}
            <div className="space-y-3">
              {/* Modules */}
              {Object.keys(stats.byModule).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CubeIcon className="h-4 w-4 text-gray-500" />
                    <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Modules</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(stats.byModule)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([name, { count }]) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] px-2 py-1 rounded font-medium">
                          {name}
                          <span className="bg-white px-1 rounded text-[9px] font-bold">{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-500" />
                  <h3 className="text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Recent Activity</h3>
                </div>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {stats.recent.length > 0 ? stats.recent.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[t.status]}`} />
                      <span className="text-[11px] text-gray-800 truncate flex-1">{t.title}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {t.creator || t.created_by_name || t.assigned_to_name || 'System'} · {relativeDate(t.created_at || t.start || t.date)}
                      </span>
                      <span className="text-[10px] px-1 py-0.5 rounded border text-gray-500 capitalize shrink-0">{t.status.replace('-', ' ')}</span>
                    </div>
                  )) : (
                    <p className="text-[11px] text-gray-400 text-center py-4">No recent tasks</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
