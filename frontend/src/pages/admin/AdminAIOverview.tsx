import React, { useState, useEffect, useMemo } from 'react';
import { AdminAIOverviewModel } from '../../models';
import type { AIOverviewData } from '../../models';
import {
  SparklesIcon,
  CpuChipIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  NoSymbolIcon,
  ArrowPathIcon,
  BoltIcon,
  FireIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ServerStackIcon,
  GlobeAltIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CodeBracketIcon,
  CubeIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#A855F7'];
const fmt = (n: number) => n.toLocaleString('en-ZA');
const fmtR = (n: number) => `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const fmtBytes = (b: number) => {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
};

// ═══════════════════════════════════════════════════════════════════════════
//  REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface HeroCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
}

const HeroCard: React.FC<HeroCardProps> = ({ label, value, icon: Icon, gradient, subtitle, badge, badgeColor }) => (
  <div className={`bg-gradient-to-br ${gradient} p-4 rounded-xl text-white relative overflow-hidden group hover:shadow-lg transition-shadow`}>
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-3">
        <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <span className={`${badgeColor || 'bg-white/20'} backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black mt-0.5">{value}</p>
      {subtitle && <p className="text-white/70 text-xs mt-0.5">{subtitle}</p>}
    </div>
    <div className="absolute -right-4 -bottom-4 opacity-10">
      <Icon className="w-20 h-20" />
    </div>
  </div>
);

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
    <div className="flex items-center gap-2 mb-2">
      <div className={`${color} p-1.5 rounded-md`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
    </div>
    <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    {subtitle && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
);

const StatusDot: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
    <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
  </span>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    TRIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    PAST_DUE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    disabled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

const SectionHeader: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; color: string }> = ({ icon: Icon, title, subtitle, color }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className={`${color} p-1.5 rounded-lg`}>
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, color, subtitle, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <div className="flex items-center gap-2">
          <div className={`${color} p-1.5 rounded-lg`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {open ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50 pt-3">{children}</div>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const AIOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIOverviewData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await AdminAIOverviewModel.getOverview();
      setData(overview);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Failed to load AI overview:', err);
      setError(err.message || 'Failed to load AI overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Daily usage from package credit system for the chart
  const dailyUsage = useMemo(() => {
    if (!data) return [];
    return (data.packageCredits?.dailyUsage || []).map(d => ({
      ...d,
      label: new Date(d.day + 'T00:00').toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
    }));
  }, [data]);

  // Usage by type from package system
  const usageByType = useMemo(() => {
    if (!data) return [];
    return (data.packageCredits?.usageByType || []).sort((a, b) => b.credits - a.credits);
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading AI dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-500 font-medium">{error || 'No data available'}</p>
        <button onClick={loadData} className="text-xs text-indigo-600 hover:underline">Retry</button>
      </div>
    );
  }

  const sp = data.spending;
  const tel = data.telemetry;
  const prov = data.providers;
  const mc = data.modelConfig;
  const ep = data.enterprise;

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* ─────────────── HEADER ─────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-600" />
            AI Overview
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Comprehensive AI usage, spending, balances &amp; provider status
            {lastRefresh && <span className="ml-2">· Refreshed {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ═══════════════ HERO METRICS ═══════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroCard
          label="Total AI Requests"
          value={fmt(sp.totalCreditsUsed)}
          icon={BoltIcon}
          gradient="from-indigo-500 to-indigo-600"
          subtitle={`${fmt(tel.totalLogs)} telemetry logs`}
        />
        <HeroCard
          label="Active Subscriptions"
          value={fmt(data.packageCredits.activeSubscriptions)}
          icon={UserGroupIcon}
          gradient="from-emerald-500 to-emerald-600"
          subtitle={`${fmt(sp.totalCreditsBalance)} credits available`}
        />
        <HeroCard
          label="Credits Consumed"
          value={fmt(sp.totalCreditsUsed)}
          icon={FireIcon}
          gradient="from-orange-500 to-orange-600"
          subtitle={`${fmt(data.packageCredits.totalTransactions)} transactions`}
        />
        <HeroCard
          label="OpenRouter Spend"
          value={sp.openRouterSpendUSD != null ? fmtUSD(sp.openRouterSpendUSD) : 'N/A'}
          icon={CurrencyDollarIcon}
          gradient="from-purple-500 to-purple-600"
          subtitle={sp.openRouterRemainingUSD != null ? `${fmtUSD(sp.openRouterRemainingUSD)} remaining` : 'Key not configured'}
          badge={sp.openRouterRemainingUSD != null && sp.openRouterRemainingUSD < 1 ? '⚠ Low' : undefined}
          badgeColor="bg-red-500/70"
        />
      </div>

      {/* ═══════════════ PROVIDER STATUS ROW ═══════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <SectionHeader icon={ServerStackIcon} title="Cloud Provider Status" subtitle="Live connectivity & balance" color="bg-slate-600" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* GLM / ZhipuAI */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">GLM (ZhipuAI)</span>
              <StatusDot ok={!!prov.glm?.configured} label={prov.glm?.configured ? 'Configured' : 'Not configured'} />
            </div>
            {prov.glm?.configured ? (
              <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p>Model: <span className="font-mono font-medium text-gray-900 dark:text-white">{prov.glm.model}</span></p>
                <p>Vision: <span className="font-mono font-medium text-gray-900 dark:text-white">{prov.glm.visionModel}</span></p>
                <p>Key: <span className="font-mono">{prov.glm.apiKeyPreview}</span></p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Primary provider (free tier)</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">No API key configured</p>
            )}
          </div>

          {/* OpenRouter */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">OpenRouter</span>
              <StatusDot ok={!!prov.openRouter?.connected} label={prov.openRouter?.connected ? 'Connected' : prov.openRouter?.error || 'Offline'} />
            </div>
            {prov.openRouter?.connected ? (
              <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p>Label: <span className="font-medium text-gray-900 dark:text-white">{prov.openRouter.label}</span></p>
                {prov.openRouter.credits != null && (
                  <p>Limit: <span className="font-medium text-gray-900 dark:text-white">{fmtUSD(prov.openRouter.credits)}</span></p>
                )}
                {prov.openRouter.creditsUsed != null && (
                  <p>Used: <span className="font-medium text-orange-600">{fmtUSD(prov.openRouter.creditsUsed)}</span></p>
                )}
                {prov.openRouter.creditsRemaining != null && (
                  <>
                    <p>Remaining: <span className={`font-bold ${prov.openRouter.creditsRemaining < 1 ? 'text-red-600' : 'text-green-600'}`}>{fmtUSD(prov.openRouter.creditsRemaining)}</span></p>
                    {prov.openRouter.credits != null && prov.openRouter.credits > 0 && (
                      <div className="mt-1.5">
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${prov.openRouter.creditsRemaining / prov.openRouter.credits < 0.2 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, (prov.openRouter.creditsRemaining / prov.openRouter.credits) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                {prov.openRouter.isFreeTier && <p className="text-[10px] text-amber-600 mt-1">Free tier key</p>}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">{prov.openRouter?.error || 'Not configured'}</p>
            )}
          </div>

          {/* OpenAI */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">OpenAI</span>
              <StatusDot ok={!!prov.openAI?.connected} label={prov.openAI?.connected ? 'Connected' : prov.openAI?.error || 'No key'} />
            </div>
            {prov.openAI?.connected ? (
              <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p>Key: <span className="font-mono">{prov.openAI.apiKeyPreview}</span></p>
                <p>Models: <span className="font-bold text-gray-900 dark:text-white">{prov.openAI.totalModels}</span> available</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Direct API (desktop &amp; mobile)</p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">{prov.openAI?.error || 'Not configured'}</p>
            )}
          </div>

          {/* Ollama */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Ollama (Local)</span>
              <StatusDot ok={!!prov.ollama?.connected} label={prov.ollama?.connected ? 'Online' : 'Offline'} />
            </div>
            {prov.ollama?.connected ? (
              <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                <p>URL: <span className="font-mono text-gray-900 dark:text-white">{prov.ollama.baseUrl}</span></p>
                <p>Installed: <span className="font-bold text-gray-900 dark:text-white">{prov.ollama.totalModels}</span> models</p>
                <p>Loaded (RAM): <span className="font-bold text-green-600">{prov.ollama.loadedModels}</span></p>
                <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">Free provider (self-hosted)</p>
              </div>
            ) : (
              <p className="text-[11px] text-red-400">{prov.ollama?.error || 'Connection failed'}</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ INFRASTRUCTURE ROW ═══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MetricCard label="Assistants" value={data.assistants.total} icon={ChatBubbleLeftRightIcon} color="bg-indigo-500" subtitle={`${data.assistants.active} active · ${data.assistants.paid} paid`} />
        <MetricCard label="Widgets" value={data.widgets.total} icon={CodeBracketIcon} color="bg-cyan-500" subtitle={`${data.widgets.active} active`} />
        <MetricCard label="API Keys" value={data.apiKeys} icon={ShieldCheckIcon} color="bg-slate-500" subtitle="Consumer keys issued" />
        <MetricCard label="AI Configs" value={data.aiConfigurations} icon={WrenchScrewdriverIcon} color="bg-teal-500" subtitle="Team model configs" />
        <MetricCard label="Endpoints" value={ep.total} icon={GlobeAltIcon} color="bg-emerald-500" subtitle={`${ep.active} active · ${ep.paused} paused`} />
        <MetricCard label="Subscriptions" value={data.packageCredits.activeSubscriptions} icon={UserGroupIcon} color="bg-violet-500" subtitle="Active & trial" />
      </div>

      {/* ═══════════════ USAGE CHARTS ═══════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Daily Usage (30 days) */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <SectionHeader icon={ChartBarIcon} title="Daily AI Usage" subtitle="Last 30 days — requests & credits consumed" color="bg-indigo-500" />
          {dailyUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyUsage}>
                <defs>
                  <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" stroke="#9CA3AF" style={{ fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#6366F1" style={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" style={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="#6366F1" strokeWidth={2} fill="url(#reqGrad)" />
                <Area yAxisId="right" type="monotone" dataKey="creditsUsed" name="Credits" stroke="#F59E0B" strokeWidth={2} fill="url(#credGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ChartBarIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No usage data in the last 30 days</p>
              </div>
            </div>
          )}
        </div>

        {/* Usage by Request Type */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <SectionHeader icon={CpuChipIcon} title="Usage by Request Type" subtitle="Credits consumed per category" color="bg-purple-500" />
          {usageByType.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={usageByType} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="credits" nameKey="type">
                    {usageByType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v)) + ' credits'} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {usageByType.map((u, i) => (
                  <div key={u.type} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-mono text-gray-700 dark:text-gray-300">{u.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900 dark:text-white">{fmt(u.credits)}</span>
                      <span className="text-gray-400 ml-1">({fmt(u.count)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              <p className="text-xs">No usage data</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ TELEMETRY ANALYTICS ═══════════════ */}
      <CollapsibleSection
        title="AI Telemetry Analytics"
        icon={SignalIcon}
        color="bg-teal-500"
        subtitle={`${fmt(tel.totalLogs)} total logs · Avg response ${fmt(tel.avgDurationMs)}ms`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Provider breakdown */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Requests by Provider</h4>
            {tel.byProvider.length > 0 ? (
              <div className="space-y-2">
                {tel.byProvider.map((p, i) => {
                  const pct = tel.totalLogs > 0 ? (p.cnt / tel.totalLogs) * 100 : 0;
                  return (
                    <div key={p.provider}>
                      <div className="flex items-center justify-between text-[11px] mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-gray-800 dark:text-gray-200">{p.provider}</span>
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white">{fmt(p.cnt)}</span>
                          <span className="text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                          <span className="text-gray-400 ml-1.5">avg {fmt(p.avgMs)}ms</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No telemetry data</p>
            )}
          </div>

          {/* Model breakdown */}
          <div>
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Requests by Model</h4>
            {tel.byModel.length > 0 ? (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {tel.byModel.map((m) => (
                  <div key={m.model + m.provider} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-gray-50 dark:bg-gray-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-medium text-gray-900 dark:text-white truncate">{m.model}</p>
                      <p className="text-[10px] text-gray-400">{m.provider}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="font-bold text-gray-900 dark:text-white">{fmt(m.cnt)}</p>
                      <p className="text-[10px] text-gray-400">{fmt(m.avgMs)}ms</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No model data</p>
            )}
          </div>
        </div>

        {/* Source breakdown */}
        {tel.bySource.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Requests by Source</h4>
            <div className="flex flex-wrap gap-3">
              {tel.bySource.map((s, i) => (
                <div key={s.source} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">{s.source}</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{fmt(s.cnt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Telemetry daily volume chart */}
        {tel.dailyVolume.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Daily Telemetry Volume &amp; Latency</h4>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={tel.dailyVolume.map((d: any) => ({
                ...d,
                label: new Date(d.day + 'T00:00').toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
              }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" stroke="#9CA3AF" style={{ fontSize: 10 }} />
                <YAxis yAxisId="left" stroke="#14B8A6" style={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#F59E0B" style={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="#14B8A6" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="avgMs" name="Avg Latency (ms)" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CollapsibleSection>

      {/* ═══════════════ PACKAGE CREDIT DETAILS ═══════════════ */}
      <CollapsibleSection
        title="Package Credits & Subscriptions"
        icon={CubeIcon}
        color="bg-green-600"
        subtitle={`${fmt(data.packageCredits.activeSubscriptions)} active subscriptions · Balance: ${fmt(sp.totalCreditsBalance)} credits`}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase">Total Purchased</p>
            <p className="text-lg font-bold text-green-800 dark:text-green-200">{fmt(sp.totalCreditsPurchased)}</p>
            <p className="text-[10px] text-green-600 dark:text-green-500">{fmtR(sp.totalCreditsPurchasedRands)}</p>
          </div>
          <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <p className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase">Total Consumed</p>
            <p className="text-lg font-bold text-orange-800 dark:text-orange-200">{fmt(sp.totalCreditsUsed)}</p>
            <p className="text-[10px] text-orange-600 dark:text-orange-500">{fmtR(sp.totalCreditsUsedRands)}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Current Balance</p>
            <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{fmt(sp.totalCreditsBalance)}</p>
            <p className="text-[10px] text-blue-600 dark:text-blue-500">{fmtR(sp.totalCreditsBalanceRands)}</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-400 uppercase">OpenRouter Spend</p>
            <p className="text-lg font-bold text-purple-800 dark:text-purple-200">{sp.openRouterSpendUSD != null ? fmtUSD(sp.openRouterSpendUSD) : 'N/A'}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-500">
              {sp.openRouterLimitUSD != null ? `Limit: ${fmtUSD(sp.openRouterLimitUSD)}` : 'No key'}
            </p>
          </div>
        </div>

        {/* Package credit breakdown */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            <CubeIcon className="w-3.5 h-3.5" /> Package Credits (Contact-scoped)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                <tr><td className="py-1 text-gray-500">Active subscriptions</td><td className="py-1 text-right font-bold text-gray-900 dark:text-white">{fmt(data.packageCredits.activeSubscriptions)}</td></tr>
                <tr><td className="py-1 text-gray-500">Total balance</td><td className="py-1 text-right font-bold text-green-600">{fmt(data.packageCredits.totalBalance)}</td></tr>
                <tr><td className="py-1 text-gray-500">Used (lifetime)</td><td className="py-1 text-right font-bold text-orange-600">{fmt(data.packageCredits.totalUsedLifetime)}</td></tr>
                <tr><td className="py-1 text-gray-500">Purchased</td><td className="py-1 text-right font-bold">{fmt(data.packageCredits.totalPurchased)}</td></tr>
                <tr><td className="py-1 text-gray-500">Monthly allocations</td><td className="py-1 text-right">{fmt(data.packageCredits.totalAllocated)}</td></tr>
                <tr><td className="py-1 text-gray-500">Bonus</td><td className="py-1 text-right">{fmt(data.packageCredits.totalBonus)}</td></tr>
                <tr><td className="py-1 text-gray-500">Adjusted</td><td className="py-1 text-right">{fmt(data.packageCredits.totalAdjusted)}</td></tr>
                <tr><td className="py-1 text-gray-500">Refunded</td><td className="py-1 text-right">{fmt(data.packageCredits.totalRefunded)}</td></tr>
                <tr><td className="py-1 text-gray-500">Total txns</td><td className="py-1 text-right">{fmt(data.packageCredits.totalTransactions)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Breakdown */}
        {data.subscriptionBreakdown.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Subscription Status Breakdown</h4>
            <div className="flex flex-wrap gap-2">
              {data.subscriptionBreakdown.map(s => (
                <div key={s.status} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                  <StatusBadge status={s.status} />
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ═══════════════ TOP CONSUMERS & PACKAGES ═══════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Consumers */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <SectionHeader icon={ArrowTrendingUpIcon} title="Top Credit Consumers" subtitle="By lifetime usage" color="bg-orange-500" />
          {data.topConsumers.length > 0 ? (
            <div className="space-y-2">
              {data.topConsumers.map((c, i) => (
                <div key={c.contactId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.packageName || 'No package'} · <StatusBadge status={c.status} /></p>
                    </div>
                  </div>
                  <div className="text-right ml-2 shrink-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{fmt(c.creditsUsed)}</p>
                    <p className="text-[10px] text-gray-400">bal: {fmt(c.creditsBalance)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">No consumer data</p>
          )}
        </div>

        {/* Package Popularity */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <SectionHeader icon={CubeIcon} title="Package Popularity" subtitle="Subscribers & usage per package" color="bg-violet-500" />
          {data.packagePopularity.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.packagePopularity} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" stroke="#9CA3AF" style={{ fontSize: 10 }} width={60} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="subscribers" fill="#8B5CF6" name="Subscribers" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {data.packagePopularity.map(p => (
                  <div key={p.slug} className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white">{p.subscribers}</span>
                      <span className="text-gray-400 ml-1.5">subs</span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="font-bold text-orange-600">{fmt(p.totalCreditsUsed)}</span>
                      <span className="text-gray-400 ml-1">credits</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">No package data</p>
          )}
        </div>
      </div>

      {/* ═══════════════ ENTERPRISE ENDPOINTS ═══════════════ */}
      {ep.total > 0 && (
        <CollapsibleSection
          title="Enterprise Endpoints"
          icon={GlobeAltIcon}
          color="bg-emerald-600"
          subtitle={`${ep.total} total · ${ep.active} active · ${fmt(ep.totalRequests)} requests`}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <MetricCard label="Active" value={ep.active} icon={CheckCircleIcon} color="bg-green-500" />
            <MetricCard label="Paused" value={ep.paused} icon={PauseCircleIcon} color="bg-amber-500" />
            <MetricCard label="Disabled" value={ep.disabled} icon={NoSymbolIcon} color="bg-red-500" />
            <MetricCard label="Total Requests" value={fmt(ep.totalRequests)} icon={BoltIcon} color="bg-blue-500" />
          </div>
          {ep.endpoints && ep.endpoints.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-semibold">Client</th>
                    <th className="pb-2 font-semibold">Provider</th>
                    <th className="pb-2 font-semibold">Model</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {ep.endpoints.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-1.5 font-medium text-gray-900 dark:text-white">{e.client_name}</td>
                      <td className="py-1.5 text-gray-600 dark:text-gray-400">{e.llm_provider}</td>
                      <td className="py-1.5 font-mono text-gray-600 dark:text-gray-400">{e.llm_model}</td>
                      <td className="py-1.5"><StatusBadge status={e.status} /></td>
                      <td className="py-1.5 text-right font-bold text-gray-900 dark:text-white">{fmt(e.total_requests)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ═══════════════ OLLAMA MODELS ═══════════════ */}
      {prov.ollama?.connected && (
        <CollapsibleSection
          title="Ollama Models"
          icon={CommandLineIcon}
          color="bg-gray-700"
          subtitle={`${prov.ollama.totalModels} installed · ${prov.ollama.loadedModels} loaded in RAM`}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Running models */}
            <div>
              <h4 className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">🟢 Loaded in RAM ({prov.ollama.runningModels?.length || 0})</h4>
              {prov.ollama.runningModels && prov.ollama.runningModels.length > 0 ? (
                <div className="space-y-1.5">
                  {prov.ollama.runningModels.map((m: any) => (
                    <div key={m.name} className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-[11px]">
                      <p className="font-mono font-bold text-gray-900 dark:text-white">{m.name}</p>
                      <p className="text-gray-500">
                        RAM: {fmtBytes(m.size)} · VRAM: {fmtBytes(m.sizeVram || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No models currently loaded</p>
              )}
            </div>

            {/* Installed models */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">📦 All Installed ({prov.ollama.installedModels?.length || 0})</h4>
              {prov.ollama.installedModels && prov.ollama.installedModels.length > 0 ? (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {prov.ollama.installedModels.map((m: any) => (
                    <div key={m.name} className="p-2 rounded bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-[11px]">
                      <div className="flex items-center justify-between">
                        <p className="font-mono font-bold text-gray-900 dark:text-white">{m.name}</p>
                        <span className="text-[10px] text-gray-400">{fmtBytes(m.size)}</span>
                      </div>
                      <p className="text-gray-500">
                        {m.family && <span>{m.family} · </span>}
                        {m.parameterSize && <span>{m.parameterSize} · </span>}
                        {m.quantization && <span>{m.quantization}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No models installed</p>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ═══════════════ MODEL ROUTING CONFIG ═══════════════ */}
      <CollapsibleSection
        title="AI Model Routing Configuration"
        icon={WrenchScrewdriverIcon}
        color="bg-slate-600"
        subtitle="Current cascade & model assignments from environment"
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Text Chat Cascade */}
          <div>
            <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-2">💬 Text Chat Cascade</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 rounded bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-[11px]">
                <span className="font-bold text-indigo-600 w-4">1.</span>
                <div>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.primaryModel}</p>
                  <p className="text-gray-500">{mc.primaryProvider} · Free (primary)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-[11px]">
                <span className="font-bold text-purple-600 w-4">2.</span>
                <div>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.openRouterFallback}</p>
                  <p className="text-gray-500">OpenRouter · Paid fallback</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-[11px]">
                <span className="font-bold text-gray-600 w-4">3.</span>
                <div>
                  <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.assistantOllama}</p>
                  <p className="text-gray-500">Ollama · Last resort (free)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vision Models */}
          <div>
            <h4 className="text-xs font-bold text-pink-700 dark:text-pink-400 mb-2">👁️ Vision / Multimodal</h4>
            <div className="space-y-1.5">
              <div className="p-2 rounded bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.visionOpenRouter}</p>
                <p className="text-gray-500">OpenRouter · Paid primary</p>
              </div>
              <div className="p-2 rounded bg-pink-50/50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.visionOpenRouterFallback}</p>
                <p className="text-gray-500">OpenRouter · Paid fallback</p>
              </div>
              <div className="p-2 rounded bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.visionOllama}</p>
                <p className="text-gray-500">Ollama · Free (all tiers last resort)</p>
              </div>
            </div>
          </div>

          {/* Specialized Models */}
          <div>
            <h4 className="text-xs font-bold text-teal-700 dark:text-teal-400 mb-2">⚙️ Specialized Models</h4>
            <div className="space-y-1.5">
              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.toolsOllama}</p>
                <p className="text-gray-500">Tools / Intent · Ollama</p>
              </div>
              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.ingestionOllama}</p>
                <p className="text-gray-500">Ingestion · Ollama (free tier)</p>
              </div>
              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.ingestionOpenRouter}</p>
                <p className="text-gray-500">Ingestion · OpenRouter (paid)</p>
              </div>
              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.siteBuilderOllama}</p>
                <p className="text-gray-500">Site Builder · Ollama</p>
              </div>
              <div className="p-2 rounded bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-[11px]">
                <p className="font-mono font-bold text-gray-900 dark:text-white">{mc.siteBuilderGLM}</p>
                <p className="text-gray-500">Site Builder · GLM (paid)</p>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════ SYSTEM FOOTER ═══════════════ */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> Uptime: <strong className="text-gray-900 dark:text-white">{data.system.uptime}</strong></span>
            <span>Node: <strong className="text-gray-900 dark:text-white">{data.system.nodeVersion}</strong></span>
            <span>Memory: <strong className="text-gray-900 dark:text-white">{data.system.memoryUsageMB} MB</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot ok={!!prov.glm?.configured} label="GLM" />
            <StatusDot ok={!!prov.openRouter?.connected} label="OpenRouter" />
            <StatusDot ok={!!prov.openAI?.connected} label="OpenAI" />
            <StatusDot ok={!!prov.ollama?.connected} label="Ollama" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIOverview;
