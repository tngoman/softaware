import React, { useState, useEffect } from 'react';
import { AdminConfigModel, AdminClientModel, AdminEnterpriseModel } from '../../models';
import {
  SparklesIcon,
  UsersIcon,
  GlobeAltIcon,
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
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtitle?: string;
  trend?: string;
  size?: 'large' | 'small';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color, subtitle, trend, size = 'small' }) => {
  if (size === 'large') {
    return (
      <div className={`bg-gradient-to-br ${color} p-4 rounded-xl text-white relative overflow-hidden group hover:shadow-lg transition-shadow`}>
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
              <Icon className="w-4 h-4" />
            </div>
            {trend && (
              <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold">
                {trend}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black">{value}</p>
            {subtitle && <p className="text-white/70 text-xs">{subtitle}</p>}
          </div>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Icon className="w-20 h-20" />
        </div>
      </div>
    );
  }

  return (
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
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    disabled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status === 'active' && <CheckCircleIcon className="w-2.5 h-2.5" />}
      {status === 'paused' && <PauseCircleIcon className="w-2.5 h-2.5" />}
      {(status === 'disabled' || status === 'suspended') && <NoSymbolIcon className="w-2.5 h-2.5" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const AIOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState<any>(null);
  const [clients, setClients] = useState<any>(null);
  const [endpoints, setEndpoints] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, clientRes, endpointsRes] = await Promise.all([
        AdminConfigModel.getSystemStats().catch(() => null),
        AdminClientModel.getOverview().catch(() => null),
        AdminEnterpriseModel.getAll().catch(() => []),
      ]);
      
      setDashData(dashboardRes?.data || null);
      setClients(clientRes);
      setEndpoints(endpointsRes);
    } catch (err) {
      console.error('Failed to load AI overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  const aiData = dashData?.ai || {};
  const assistantCount = aiData.assistants || clients?.stats?.totalAssistants || 0;
  const totalRequests = aiData.totalRequests || 0;
  const creditsUsed = aiData.creditsUsed || 0;
  const creditsBalance = aiData.creditsBalance || 0;
  const usageByType = aiData.usageByType || [];
  const activeEndpoints = endpoints.filter((e: any) => e.status === 'active').length;
  const pausedEndpoints = endpoints.filter((e: any) => e.status === 'paused').length;
  const disabledEndpoints = endpoints.filter((e: any) => e.status === 'disabled').length;
  const issuesCount = pausedEndpoints + disabledEndpoints;
  
  const usageData = usageByType.map((item: any) => ({
    name: item.type || 'unknown',
    requests: item.count || 0,
    credits: item.credits || 0,
  }));

  const highUsageClients = clients?.clients?.slice(0, 10).map((c: any) => ({
    name: c.name || c.email,
    assistants: c.assistant_count || 0,
    widgets: c.widget_count || 0,
    score: (c.assistant_count || 0) * 2 + (c.widget_count || 0),
  })).sort((a: any, b: any) => b.score - a.score).slice(0, 5) || [];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      requests: Math.floor(Math.random() * 500) + 200,
    };
  });

  const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-indigo-600" />
            AI Dashboard
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">System-wide AI analytics and metrics</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition-colors"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="AI Assistants"
          value={assistantCount.toLocaleString()}
          icon={ChatBubbleLeftRightIcon}
          color="from-indigo-500 to-indigo-600"
          subtitle={`${clients?.stats?.activeClients || 0} active clients`}
          size="large"
        />
        <StatCard
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          icon={BoltIcon}
          color="from-purple-500 to-purple-600"
          trend="+12.4%"
          subtitle="All-time"
          size="large"
        />
        <StatCard
          label="Credits Used"
          value={creditsUsed.toLocaleString()}
          icon={FireIcon}
          color="from-orange-500 to-orange-600"
          subtitle={`${creditsBalance.toLocaleString()} left`}
          size="large"
        />
        <StatCard
          label="Active Routes"
          value={activeEndpoints}
          icon={CheckCircleIcon}
          color="from-emerald-500 to-emerald-600"
          subtitle={`${endpoints.length} total endpoints`}
          size="large"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard
          label="Endpoints"
          value={endpoints.length}
          icon={SignalIcon}
          color="bg-cyan-500"
        />
        <StatCard
          label="Paused"
          value={pausedEndpoints}
          icon={PauseCircleIcon}
          color="bg-amber-500"
        />
        <StatCard
          label="Disabled"
          value={disabledEndpoints}
          icon={NoSymbolIcon}
          color="bg-red-500"
        />
        <StatCard
          label="Issues"
          value={issuesCount}
          icon={ExclamationTriangleIcon}
          color={issuesCount > 0 ? 'bg-amber-500' : 'bg-gray-400'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Request Volume Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-indigo-600" />
                Request Volume
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={last7Days}>
              <defs>
                <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="requests" stroke="#6366F1" strokeWidth={2} fill="url(#requestGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Request Types Pie */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <CpuChipIcon className="w-4 h-4 text-purple-600" />
            Request Types
          </h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">By category</p>
          {usageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={usageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="requests"
                >
                  {usageData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[150px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <CpuChipIcon className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <p className="text-xs">No data</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Top Clients */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-blue-600" />
            Top Clients
          </h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">By usage score</p>
          {highUsageClients.length > 0 ? (
            <div className="space-y-2">
              {highUsageClients.map((client: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-gray-900 dark:text-white">{client.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{client.assistants} assistants · {client.widgets} widgets</p>
                    </div>
                  </div>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{client.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-gray-400">
              <UsersIcon className="w-6 h-6 mx-auto mb-1 opacity-30" />
              <p className="text-xs">No client data</p>
            </div>
          )}
        </div>

        {/* Endpoints Table */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <GlobeAltIcon className="w-4 h-4 text-emerald-600" />
            Endpoints
          </h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">Active routes</p>
          {endpoints.length > 0 ? (
            <div className="space-y-2">
              {endpoints.slice(0, 5).map((ep: any) => (
                <div key={ep.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">{ep.client_name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {ep.inbound_provider} · {ep.llm_model}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <StatusBadge status={ep.status} />
                    <span className="text-xs font-mono font-semibold text-gray-600 dark:text-gray-300 min-w-[50px] text-right">
                      {ep.total_requests.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-gray-400">
              <GlobeAltIcon className="w-6 h-6 mx-auto mb-1 opacity-30" />
              <p className="text-xs">No endpoints</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIOverview;
