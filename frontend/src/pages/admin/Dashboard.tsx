import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
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
  XMarkIcon,
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
  const [phasePopoverOpen, setPhasePopoverOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

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
    // Filter out billed/invoiced tasks from all stats
    const unbilledTasks = tasks.filter(t => {
      const billed = (t.task_bill_date && t.task_bill_date !== '0' && String(t.task_bill_date).length > 5)
                  || Number(t.task_billed) === 1;
      return !billed;
    });
    
    const activeTasks = unbilledTasks.filter(t => t.status !== 'completed');

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
    unbilledTasks.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

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
    const totalHours = unbilledTasks.reduce((sum, t) => {
      return sum + timeToDecimal(t.hours || 0);
    }, 0);

    // Completed unbilled
    const completedUnbilled = unbilledTasks.filter(t => t.status === 'completed').length;

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
    const recent = [...unbilledTasks]
      .sort((a, b) =>
        new Date(b.created_at || b.start || b.date || 0).getTime() -
        new Date(a.created_at || a.start || a.date || 0).getTime()
      )
      .slice(0, 8);

    return {
      total: unbilledTasks.length,
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

  // Handle task click
  const handleTaskClick = useCallback((task: Task) => {
    if (task?.id) {
      localStorage.setItem('openTaskId', String(task.id));
    }
    navigate('/tasks');
  }, [navigate]);

  // Handle phase click
  const handlePhaseClick = useCallback((phase: string) => {
    if ((stats.byPhase[phase] || 0) > 0) {
      setSelectedPhase(phase);
      setPhasePopoverOpen(true);
    }
  }, [stats.byPhase]);

  // Get tasks for selected phase
  const phaseTasksForPopover = useMemo(() => {
    if (!selectedPhase) return [];
    return tasks
      .filter(t => {
        const taskPhase = t.workflow_phase?.toLowerCase() || 'intake';
        return taskPhase === selectedPhase && t.status !== 'completed';
      })
      .sort((a, b) => 
        new Date(b.created_at || b.start || b.date || 0).getTime() - 
        new Date(a.created_at || a.start || a.date || 0).getTime()
      );
  }, [tasks, selectedPhase]);

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── Header Bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl ${roleMeta.color} text-white shadow-lg flex items-center justify-center`}>
            {roleMeta.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {firstName ? `Welcome, ${firstName}` : 'Admin Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {roleMeta.label}
              </span>
              <span>·</span>
              <span>{roleMeta.greeting}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Software selector */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <CubeIcon className="h-4 w-4 text-gray-400" />
            <select
              value={selectedSoftware?.id?.toString() || ''}
              onChange={handleSoftwareChange}
              disabled={softwareLoading}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-300 pr-8"
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
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 transition-colors"
            title="Refresh tasks"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Body states ────────────────────────────────────── */}
      {!selectedSoftware ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <CubeIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Software Selected</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Select a software product from the dropdown above to view tasks</p>
        </div>
      ) : error && (error.toLowerCase().includes('401') || error.toLowerCase().includes('not authenticated')) ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="w-16 h-16 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
            <LockClosedIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Authentication Required</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            You need to authenticate with <strong>{selectedSoftware.name}</strong> to view tasks.
          </p>
          <p className="text-xs text-gray-400">
            Use the software's external credentials to authenticate. Token will be stored for future requests.
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <ArrowPathIcon className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── KPI Cards Row (spec §8.9) ────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Oldest Bug */}
            <div
              className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow ${stats.oldestBug ? 'cursor-pointer' : 'opacity-70'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                  <BugAntIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Oldest Bug</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.oldestBug ? (
                      <>{stats.oldestBugAge}<span className="text-sm font-normal text-gray-400 ml-1">days</span></>
                    ) : (
                      <span className="text-emerald-500">0</span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {stats.oldestBug ? stats.oldestBug.title : 'No active bugs 🎉'}
              </p>
            </div>

            {/* Card 2: Phase Queue */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <ArrowRightIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {roleMeta.focusPhase === 'all' ? 'All Tasks' : `${roleMeta.focusPhase.replace('_', ' ')}`}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.phaseCount}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">of {stats.activeCount} active</p>
            </div>

            {/* Card 3: Unbilled Hours */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <ClockIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unbilled Hours</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalHours.toFixed(1)}<span className="text-sm font-normal text-gray-400 ml-1">h</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">across {stats.activeCount} active</p>
            </div>

            {/* Card 4: Completed Unbilled */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                  <CheckCircleIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Completed Unbilled</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedUnbilled}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">of {stats.byStatus['completed'] || 0} completed</p>
            </div>
          </div>

          {/* ── Middle Row: Status · Bugs · Workflow (spec §8.10) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* By Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ChartBarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">By Status</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.byStatus)
                  .filter(([k, v]) => v > 0 && k !== 'progress')
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-gray-300 capitalize font-medium">{status.replace('-', ' ')}</span>
                          <span className="text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                {stats.total === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No tasks</p>}
              </div>
            </div>

            {/* Active Bugs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BugAntIcon className="h-5 w-5 text-red-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Bugs</h3>
                {stats.bugTasks.length > 0 && (
                  <span className="ml-auto text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">{stats.bugTasks.length}</span>
                )}
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {stats.bugTasks.length > 0 ? stats.bugTasks.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => handleTaskClick(t)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <div className={`h-6 w-6 rounded-lg ${STATUS_COLORS[t.status]} text-white flex items-center justify-center shrink-0`}>
                      <BugAntIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1">{t.title}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{relativeDate(t.created_at || t.start || t.date)}</span>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <CheckCircleIcon className="h-10 w-10 text-emerald-300 dark:text-emerald-700 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">No active bugs</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Pipeline */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Workflow Pipeline</h3>
              </div>
              <div className="space-y-2">
                {PHASE_ORDER.map(phase => {
                  const count = stats.byPhase[phase] || 0;
                  const isMyPhase = roleMeta.focusPhase === phase;
                  return (
                    <div
                      key={phase}
                      onClick={() => handlePhaseClick(phase)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                        count > 0 ? 'cursor-pointer hover:shadow-sm' : 'opacity-50'
                      } ${
                        isMyPhase ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isMyPhase && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />}
                        <span className="text-xs text-gray-700 dark:text-gray-300 capitalize font-medium">{phase.replace('_', ' ')}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isMyPhase ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>{count}</span>
                    </div>
                  );
                })}
                {/* Any extra phases not in the fixed order */}
                {Object.entries(stats.byPhase)
                  .filter(([p]) => !PHASE_ORDER.includes(p))
                  .map(([phase, count]) => (
                    <div 
                      key={phase} 
                      onClick={() => handlePhaseClick(phase)}
                      className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-sm transition-all"
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300 capitalize font-medium">{phase.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ── Bottom Row: Role Tasks · Modules + Activity (spec §8.11) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Role Tasks */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{roleMeta.label} Tasks</h3>
                {stats.roleCount > 0 && (
                  <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{stats.roleCount}</span>
                )}
                <button
                  onClick={() => navigate('/tasks')}
                  className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {stats.roleTasks.length > 0 ? stats.roleTasks.slice(0, 12).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className={`h-6 w-6 rounded-lg ${STATUS_COLORS[t.status]} text-white flex items-center justify-center shrink-0`}>
                      {TYPE_ICONS[t.type] || <CodeBracketIcon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 dark:text-gray-200 truncate font-medium">{t.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {t.module_name && (
                          <span className="flex items-center gap-0.5">
                            <CubeIcon className="h-3 w-3" />{t.module_name}
                          </span>
                        )}
                        {t.hours && timeToDecimal(t.hours) > 0 && (
                          <span className="flex items-center gap-0.5">
                            <ClockIcon className="h-3 w-3" />{timeToDecimal(t.hours).toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 capitalize shrink-0">
                      {t.workflow_phase?.replace('_', ' ') || 'intake'}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No tasks assigned to your role</p>
                )}
              </div>
            </div>

            {/* Right side: Modules + Recent */}
            <div className="space-y-4">
              {/* Modules */}
              {Object.keys(stats.byModule).length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CubeIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Modules</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.byModule)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([name, { count }]) => (
                        <span key={name} className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-3 py-1.5 rounded-lg font-medium">
                          {name}
                          <span className="bg-white dark:bg-gray-600 px-1.5 rounded text-xs font-bold">{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {stats.recent.length > 0 ? stats.recent.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[t.status]}`} />
                      <span className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1">{t.title}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {t.creator || t.created_by_name || t.assigned_to_name || 'System'} · {relativeDate(t.created_at || t.start || t.date)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 capitalize shrink-0">{t.status.replace('-', ' ')}</span>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No recent tasks</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Phase Tasks Popover */}
      <Transition appear show={phasePopoverOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPhasePopoverOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {selectedPhase?.replace('_', ' ')} Tasks
                    </Dialog.Title>
                    <button
                      onClick={() => setPhasePopoverOpen(false)}
                      className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {phaseTasksForPopover.length > 0 ? phaseTasksForPopover.map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setPhasePopoverOpen(false);
                          handleTaskClick(t);
                        }}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      >
                        <div className={`h-8 w-8 rounded-lg ${STATUS_COLORS[t.status]} text-white flex items-center justify-center shrink-0`}>
                          {TYPE_ICONS[t.type] || <CodeBracketIcon className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="capitalize">{t.type?.replace('-', ' ')}</span>
                            {t.module_name && (
                              <>
                                <span>·</span>
                                <span>{t.module_name}</span>
                              </>
                            )}
                            {t.hours && timeToDecimal(t.hours) > 0 && (
                              <>
                                <span>·</span>
                                <span>{timeToDecimal(t.hours).toFixed(1)}h</span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {relativeDate(t.created_at || t.start || t.date)}
                            {t.assigned_to_name && ` · ${t.assigned_to_name}`}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize shrink-0 ${
                          t.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                          t.status === 'in-progress' || t.status === 'progress' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          t.status === 'new' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {t.status.replace('-', ' ')}
                        </span>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No tasks in this phase</p>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setPhasePopoverOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Close
                    </button>
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

export default AdminDashboard;
