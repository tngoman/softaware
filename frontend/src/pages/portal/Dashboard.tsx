import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ClockIcon,
  RocketLaunchIcon,
  CommandLineIcon,
  SignalIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  XCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import api, { API_BASE_URL } from '../../services/api';
import KnowledgeHealthBadge from '../../components/KnowledgeHealthBadge';
import { useTierLimits } from '../../hooks/useTierLimits';
import { useProducts, type GatewayInfo } from '../../hooks/useProducts';
import AssistantChatModal from '../../components/AI/AssistantChatModal';

interface DashboardMetrics {
  messages: { used: number; limit: number };
  pagesIndexed: { used: number; limit: number };
  assistants: { count: number; limit: number };
  tier: string;
  trial?: {
    hasUsedTrial: boolean;
    isOnTrial: boolean;
    expiresAt: string | null;
    daysRemaining: number;
    canStartTrial: boolean;
    packageName?: string;
  };
}

interface AssistantSummary {
  id: string;
  name: string;
  description: string;
  status?: string;
  tier?: string;
  pagesIndexed?: number;
}

const PortalDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [assistants, setAssistants] = useState<AssistantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { canCreate, limits } = useTierLimits();
  const { products, packageInfo, gatewaySummary } = useProducts();

  // Chat modal state
  const [chatModal, setChatModal] = useState<AssistantSummary | null>(null);
  const [activatingTrial, setActivatingTrial] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, assistantsRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/assistants'),
      ]);
      setMetrics(metricsRes.data);
      setAssistants(assistantsRes.data.assistants || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const startTrial = async () => {
    setActivatingTrial(true);
    try {
      const res = await api.post('/billing/start-trial');
      if (res.data.success) {
        await Swal.fire({
          icon: 'success',
          title: '🎉 Trial Activated!',
          html: `<p class="text-sm text-gray-600">You now have full <strong>Starter</strong> plan access for 14 days.<br/>3 sites, 3 AI widgets, 2,000 messages/month.</p>`,
          confirmButtonColor: '#38bdf8',
          timer: 4000,
          timerProgressBar: true,
        });
        loadData(); // Refresh metrics
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not activate trial.';
      Swal.fire({ icon: 'error', title: 'Trial Activation Failed', text: msg });
    } finally {
      setActivatingTrial(false);
    }
  };

  const usagePercent = (used: number, limit: number) =>
    limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-picton-blue';

  const handleDeleteAssistant = async (assistant: AssistantSummary) => {
    const { value: clearKnowledge } = await Swal.fire({
      title: `Delete "${assistant.name}"?`,
      html: `
        <p class="text-sm text-gray-500 mb-4">This assistant will be permanently removed.</p>
        <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none justify-center">
          <input type="checkbox" id="swal-clear-kb" checked class="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-400" />
          Also delete knowledge base data (sqlite-vec)
        </label>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete Assistant',
      cancelButtonText: 'Cancel',
      focusCancel: true,
      preConfirm: () => {
        const checkbox = document.getElementById('swal-clear-kb') as HTMLInputElement;
        return checkbox?.checked ?? true;
      },
    });

    // User cancelled
    if (clearKnowledge === undefined) return;

    try {
      await api.delete(`/assistants/${assistant.id}?clearKnowledge=${clearKnowledge}`);
      Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: clearKnowledge
          ? `${assistant.name} and its knowledge base have been removed.`
          : `${assistant.name} has been removed. Knowledge base data was kept.`,
        timer: 2500,
        showConfirmButton: false,
      });
      // Reload dashboard data
      loadData();
    } catch (err: any) {
      console.error('Delete assistant error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err?.response?.data?.error || 'Something went wrong. Please try again.',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-48 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  const tier = packageInfo?.tier || metrics?.tier || 'free';
  const tierLabel = packageInfo?.name || (tier.charAt(0).toUpperCase() + tier.slice(1));
  const planStatus = packageInfo?.status || '';

  // Derive stats from loaded assistants — ensures top cards correlate with cards below
  const totalPages = assistants.reduce((sum, a) => sum + (a.pagesIndexed || 0), 0);
  const pageLimit = metrics?.pagesIndexed.limit ?? 50;

  const GatewayStatusIcon: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'active') return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
    if (status === 'paused') return <PauseCircleIcon className="h-4 w-4 text-amber-500" />;
    return <XCircleIcon className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-8">
      {/* Tier + Welcome Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to your portal</h1>
          <p className="text-gray-500 text-sm mt-1">
            You're on the <span className="font-semibold text-picton-blue">{tierLabel}</span> plan
            {planStatus === 'TRIAL' && <span className="ml-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Trial</span>}
          </p>
        </div>
        {products.ai_assistant && (
          canCreate('assistants') ? (
            <Link
              to="/portal/assistants/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              New Assistant
            </Link>
          ) : (
            <span
              title={`${limits.tier} plan limit reached (${limits.assistants.used}/${limits.assistants.limit})`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed"
            >
              <PlusIcon className="h-4 w-4" />
              Limit Reached
            </span>
          )
        )}
      </div>

      {/* Trial Banner — show for free users who haven't used trial */}
      {metrics?.trial?.canStartTrial && (
        <div className="bg-gradient-to-r from-picton-blue/10 via-blue-50 to-indigo-50 rounded-xl border border-picton-blue/20 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-picton-blue/20 flex items-center justify-center flex-shrink-0">
                <RocketLaunchIcon className="h-5 w-5 text-picton-blue" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Unlock More with a Free Trial</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Try the <strong>Starter plan</strong> free for 14 days — 3 sites, 3 AI widgets, 2,000 messages/month.
                  No credit card required. Downgrades automatically.
                </p>
              </div>
            </div>
            <button
              onClick={startTrial}
              disabled={activatingTrial}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              {activatingTrial ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Activating...
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="h-4 w-4" />
                  Start 14-Day Free Trial
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Trial Countdown — show for users currently on trial */}
      {metrics?.trial?.isOnTrial && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClockIcon className="h-5 w-5 text-amber-600" />
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {metrics.trial.packageName || tierLabel} Trial
                  {metrics.trial.daysRemaining > 0 && ` — ${metrics.trial.daysRemaining} day${metrics.trial.daysRemaining !== 1 ? 's' : ''} remaining`}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {metrics.trial.expiresAt
                    ? `Expires ${new Date(metrics.trial.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                    : 'Trial in progress.'}
                  {' '}Upgrade for full access.
                </p>
              </div>
            </div>
            <Link
              to="/portal/settings"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      )}

      {/* ════════ AI Gateway Section ════════ */}
      {products.api_gateway && gatewaySummary && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900">API Gateway</h2>
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {gatewaySummary.total_gateways} gateway{gatewaySummary.total_gateways !== 1 ? 's' : ''}
            </span>
          </div>

          {gatewaySummary.gateways.map((gw: GatewayInfo) => (
            <div key={gw.client_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Gateway Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <SignalIcon className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{gw.client_name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{gw.client_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <GatewayStatusIcon status={gw.status} />
                  <span className={`text-xs font-semibold capitalize ${
                    gw.status === 'active' ? 'text-emerald-600' : gw.status === 'paused' ? 'text-amber-600' : 'text-red-600'
                  }`}>{gw.status}</span>
                </div>
              </div>

              {/* Gateway Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
                <div className="bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{gw.tools_count}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tools</p>
                </div>
                <div className="bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{gw.total_requests.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Total Requests</p>
                </div>
                <div className="bg-white p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{gw.rate_limit_rpm}</p>
                  <p className="text-xs text-gray-500 mt-0.5">RPM Limit</p>
                </div>
                <div className="bg-white p-4 text-center">
                  <p className="text-sm font-medium text-gray-900">
                    {gw.last_request_at ? new Date(gw.last_request_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Last Request</p>
                </div>
              </div>

              {/* Tools List */}
              {gw.tools.length > 0 && (
                <div className="p-5 border-t border-slate-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Registered Tools</p>
                  <div className="flex flex-wrap gap-2">
                    {gw.tools.map((tool) => (
                      <span key={tool} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-mono">
                        <CommandLineIcon className="h-3 w-3" />
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Info */}
              <div className="p-5 bg-slate-50 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-500">Target API:</span>
                    <span className="ml-2 font-mono text-gray-700">{gw.target_base_url}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500">Auth:</span>
                    <span className="ml-2 font-medium text-gray-700 capitalize">{gw.auth_type.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Gateway Assistant — show assistant(s) for gateway-only users */}
          {!products.ai_assistant && assistants.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mt-6 mb-3">
                <SparklesIcon className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-gray-700">Gateway AI Assistant</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assistants.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                        <SparklesIcon className="h-5 w-5 text-indigo-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{a.name}</h4>
                        <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Gateway AI
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {a.description || 'AI-powered gateway assistant'}
                    </p>
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        onClick={() => setChatModal(a)}
                        className="flex-1 text-center text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Test Chat
                      </button>
                      <Link
                        to={`/portal/assistants/${a.id}/edit`}
                        className="flex-1 text-center text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ AI Assistant / Website Section ════════ */}
      {products.ai_assistant && (<>
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Assistants */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">AI Assistants</span>
            <SparklesIcon className="h-5 w-5 text-picton-blue" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {assistants.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            of {metrics?.assistants.limit ?? 5} allowed
          </p>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Messages</span>
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics?.messages.used ?? 0}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{metrics?.messages.used ?? 0} / {metrics?.messages.limit ?? 500}</span>
              <span>{usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500))}`}
                style={{ width: `${usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pages Indexed — derived from loaded assistants */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pages Indexed</span>
            <DocumentTextIcon className="h-5 w-5 text-violet-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalPages}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{totalPages} / {pageLimit}</span>
              <span>{usagePercent(totalPages, pageLimit)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(usagePercent(totalPages, pageLimit))}`}
                style={{ width: `${usagePercent(totalPages, pageLimit)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Current Plan</span>
            <BoltIcon className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{tierLabel}</p>
          <Link
            to="/portal/settings"
            className="text-xs text-picton-blue hover:text-picton-blue/80 font-medium mt-1 inline-block transition-colors"
          >
            Manage plan →
          </Link>
        </div>
      </div>

      {/* Active Assistants */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Assistants</h2>
          {assistants.length > 0 && (
            <Link
              to="/portal/assistants"
              className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium transition-colors"
            >
              View all →
            </Link>
          )}
        </div>

        {assistants.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No assistants yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first AI assistant to start engaging visitors on your website.
            </p>
            {canCreate('assistants') ? (
              <Link
                to="/portal/assistants/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all"
              >
                <PlusIcon className="h-4 w-4" />
                Create Assistant
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed">
                <PlusIcon className="h-4 w-4" />
                Limit Reached
              </span>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assistants.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
                      <SparklesIcon className="h-5 w-5 text-picton-blue" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{a.name}</h4>
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAssistant(a)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete assistant"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                  {a.description || 'No description'}
                </p>

                {/* Per-assistant Knowledge Health badge */}
                <div className="mb-3 px-1">
                  <KnowledgeHealthBadge assistantId={a.id} />
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => setChatModal(a)}
                    className="flex-1 text-center text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Test Chat
                  </button>
                  <Link
                    to={`/portal/assistants/${a.id}/edit`}
                    className="flex-1 text-center text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {/* Chat Modal */}
      {chatModal && (
        <AssistantChatModal
          assistant={{ id: chatModal.id, name: chatModal.name }}
          onClose={() => setChatModal(null)}
        />
      )}
    </div>
  );
};

export default PortalDashboard;
