import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
  ClockIcon,
  ServerStackIcon,
  LinkIcon,
  DocumentIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
  type: 'url' | 'file';
  custom?: boolean;
}

interface IngestionJob {
  id: string;
  job_type: 'url' | 'file' | 'text';
  source: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunks_created: number;
  error_message: string | null;
  created_at: string;
}

interface AssistantKBData {
  id: string;
  name: string;
  description: string;
  score: number;
  pagesIndexed: number;
  pageLimit: number;
  tier: 'free' | 'paid';
  storageFull: boolean;
  checklist: ChecklistItem[];
  missing: string[];
  jobs: IngestionJob[];
  pendingCount: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const KEY_EMOJI: Record<string, string> = {
  pricing_info: '💰', pricing_plans: '💰', pricing_fees: '💰', menu_prices: '💰',
  contact_details: '📞', contact_hours: '📞',
  services_offered: '🛒', services_products: '🛒', products_catalog: '🛒', features: '🛒',
  return_policy: '↩️', shipping_info: '🚚', delivery_info: '🚚',
  about_company: '🏢', about_team: '🏢', about_restaurant: '🏢', about_practice: '🏢',
  about_institution: '🏢', about_agency: '🏢',
  faq: '❓', integrations: '🔗', onboarding_docs: '📖',
  courses_programs: '🎓', enrollment_info: '📝', practitioners: '👨‍⚕️',
  insurance_info: '🏥', listings: '🏠', area_info: '📍', location: '📍',
};

function emojiFor(key: string): string {
  return KEY_EMOJI[key] || '📋';
}

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'stroke-emerald-500', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' };
  if (score >= 60) return { text: 'text-yellow-600', bg: 'bg-yellow-50', ring: 'stroke-yellow-500', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' };
  if (score >= 40) return { text: 'text-orange-600', bg: 'bg-orange-50', ring: 'stroke-orange-500', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' };
  return { text: 'text-red-600', bg: 'bg-red-50', ring: 'stroke-red-500', border: 'border-red-200', badge: 'bg-red-100 text-red-700' };
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Partial';
  return 'Low';
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircleIcon className="w-3 h-3" /> Done</span>;
    case 'pending':
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><ClockIcon className="w-3 h-3" /> Pending</span>;
    case 'processing':
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700"><ArrowPathIcon className="w-3 h-3 animate-spin" /> Processing</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700"><ExclamationTriangleIcon className="w-3 h-3" /> Failed</span>;
    default:
      return <span className="text-[11px] text-gray-400">{status}</span>;
  }
}

function jobTypeIcon(type: string) {
  switch (type) {
    case 'url': return <LinkIcon className="w-4 h-4 text-blue-500" />;
    case 'file': return <DocumentIcon className="w-4 h-4 text-violet-500" />;
    default: return <DocumentTextIcon className="w-4 h-4 text-gray-400" />;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ------------------------------------------------------------------ */
/* Mini Progress Ring                                                  */
/* ------------------------------------------------------------------ */

const ProgressRing: React.FC<{ score: number; size?: number }> = ({ score, size = 80 }) => {
  const radius = (size / 2) - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = scoreColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" style={{ width: size, height: size }} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth="5" fill="none" className="stroke-gray-100" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth="5" fill="none" strokeLinecap="round"
          className={colors.ring}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold ${colors.text}`}>{score}%</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

const KnowledgeBase: React.FC = () => {
  const [assistants, setAssistants] = useState<AssistantKBData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'incomplete'>('all');
  const [deletingJob, setDeletingJob] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all assistants
      const { data: assistantsRes } = await api.get('/assistants');
      const list = assistantsRes.assistants || [];

      // Fetch health + ingestion data for each assistant in parallel
      const enriched: AssistantKBData[] = await Promise.all(
        list.map(async (a: any) => {
          const [healthRes, ingestRes] = await Promise.allSettled([
            api.get(`/assistants/${a.id}/knowledge-health`),
            api.get(`/assistants/${a.id}/ingest/status`),
          ]);

          const health = healthRes.status === 'fulfilled' ? healthRes.value.data : {};
          const ingest = ingestRes.status === 'fulfilled' ? ingestRes.value.data : {};

          return {
            id: a.id,
            name: a.name,
            description: a.description || '',
            score: health.score ?? 0,
            pagesIndexed: health.pagesIndexed ?? ingest.pagesIndexed ?? 0,
            pageLimit: health.pageLimit ?? 50,
            tier: health.tier ?? 'free',
            storageFull: health.storageFull ?? false,
            checklist: health.checklist ?? [],
            missing: health.missing ?? [],
            jobs: ingest.jobs ?? [],
            pendingCount: ingest.pendingCount ?? 0,
          };
        }),
      );

      setAssistants(enriched);
      // Auto-expand the first one if only one
      if (enriched.length === 1) setExpandedId(enriched[0].id);
    } catch (err) {
      console.error('Failed to load knowledge base data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteJob = async (assistantId: string, jobId: string) => {
    if (!window.confirm('Remove this source and its indexed content?')) return;
    setDeletingJob(jobId);
    try {
      await api.delete(`/assistants/${assistantId}/ingest/job/${jobId}`);
      await loadData();
    } catch (err) {
      console.error('Delete job failed:', err);
    } finally {
      setDeletingJob(null);
    }
  };

  const handleRecategorize = async (assistantId: string) => {
    setRecategorizing(assistantId);
    try {
      await api.post(`/assistants/${assistantId}/recategorize`);
      await loadData();
    } catch (err) {
      console.error('Recategorize failed:', err);
    } finally {
      setRecategorizing(null);
    }
  };

  // Filter assistants
  const filtered = assistants.filter((a) => {
    if (filter === 'healthy') return a.score >= 80;
    if (filter === 'incomplete') return a.score < 80;
    return true;
  });

  // Aggregate stats
  const totalPages = assistants.reduce((sum, a) => sum + a.pagesIndexed, 0);
  const totalSources = assistants.reduce((sum, a) => sum + a.jobs.filter(j => j.status === 'completed').length, 0);
  const avgScore = assistants.length > 0 ? Math.round(assistants.reduce((sum, a) => sum + a.score, 0) / assistants.length) : 0;
  const totalChecklist = assistants.reduce((sum, a) => sum + a.checklist.length, 0);
  const totalSatisfied = assistants.reduce((sum, a) => sum + a.checklist.filter(c => c.satisfied).length, 0);
  const pendingJobs = assistants.reduce((sum, a) => sum + a.pendingCount, 0);

  /* ---------- Loading skeleton ---------- */
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  /* ---------- Empty state ---------- */
  if (assistants.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-12 text-center">
          <ServerStackIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No assistants yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create an AI assistant first, then come back here to train its knowledge base with URLs, documents, and more.
          </p>
          <Link
            to="/portal/assistants/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Create Assistant
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage what your AI assistants know — add URLs, upload files, and track training progress.
          </p>
        </div>
        <Link
          to="/portal/assistants"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-picton-blue bg-picton-blue/10 rounded-lg hover:bg-picton-blue/20 transition-colors"
        >
          <SparklesIcon className="h-4 w-4" />
          Manage Assistants
        </Link>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Health</span>
            <SparklesIcon className="h-4 w-4 text-picton-blue" />
          </div>
          <p className={`text-2xl font-bold ${scoreColor(avgScore).text}`}>{avgScore}%</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{scoreLabel(avgScore)} across {assistants.length} assistant{assistants.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pages Indexed</span>
            <DocumentTextIcon className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalPages}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{totalSources} source{totalSources !== 1 ? 's' : ''} ingested</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Topics Covered</span>
            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalSatisfied}<span className="text-base text-gray-400 font-normal">/{totalChecklist}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">knowledge requirements met</p>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Queue</span>
            <ClockIcon className={`h-4 w-4 ${pendingJobs > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingJobs}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{pendingJobs > 0 ? 'jobs processing…' : 'all caught up'}</p>
        </div>
      </div>

      {/* Filter Bar */}
      {assistants.length > 1 && (
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          {(['all', 'healthy', 'incomplete'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                filter === f
                  ? 'bg-picton-blue text-white'
                  : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
              }`}
            >
              {f === 'all' ? `All (${assistants.length})` :
               f === 'healthy' ? `Healthy (${assistants.filter(a => a.score >= 80).length})` :
               `Needs Work (${assistants.filter(a => a.score < 80).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Per-Assistant Breakdown */}
      <div className="space-y-4">
        {filtered.map((assistant) => {
          const isExpanded = expandedId === assistant.id;
          const colors = scoreColor(assistant.score);
          const satisfiedCount = assistant.checklist.filter(c => c.satisfied).length;
          const completedJobs = assistant.jobs.filter(j => j.status === 'completed');
          const failedJobs = assistant.jobs.filter(j => j.status === 'failed');
          const storagePercent = Math.min(Math.round((assistant.pagesIndexed / assistant.pageLimit) * 100), 100);

          return (
            <div key={assistant.id} className="bg-white dark:bg-dark-800 rounded-xl border border-slate-200 dark:border-dark-700 shadow-sm overflow-hidden">
              {/* Collapsed Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : assistant.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
              >
                <ProgressRing score={assistant.score} size={56} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{assistant.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {scoreLabel(assistant.score)}
                    </span>
                    {assistant.pendingCount > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">
                        {assistant.pendingCount} processing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {satisfiedCount}/{assistant.checklist.length} topics · {assistant.pagesIndexed} pages · {completedJobs.length} source{completedJobs.length !== 1 ? 's' : ''}
                    {failedJobs.length > 0 && <span className="text-red-500 ml-1">· {failedJobs.length} failed</span>}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-4">
                  {/* Storage mini bar */}
                  <div className="w-24">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                      <span>Storage</span>
                      <span>{storagePercent}%</span>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${assistant.storageFull ? 'bg-red-500' : 'bg-picton-blue'}`}
                        style={{ width: `${storagePercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-gray-400">
                    {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-dark-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x lg:divide-slate-100 dark:lg:divide-dark-700">
                    {/* Left: Knowledge Checklist */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Knowledge Requirements</h4>
                        <button
                          onClick={() => handleRecategorize(assistant.id)}
                          disabled={recategorizing === assistant.id}
                          className="text-[11px] text-gray-400 hover:text-picton-blue flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          <ArrowPathIcon className={`h-3 w-3 ${recategorizing === assistant.id ? 'animate-spin' : ''}`} />
                          Re-scan
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {assistant.checklist.map((item) => (
                          <div
                            key={item.key}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                              item.satisfied
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm flex-shrink-0">{emojiFor(item.key)}</span>
                              <span className={`text-xs truncate ${item.satisfied ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                {item.label}
                                {item.custom && (
                                  <span className="ml-1.5 text-[9px] px-1 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">CUSTOM</span>
                                )}
                              </span>
                            </div>
                            {item.satisfied ? (
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Link
                                to={`/portal/assistants/${assistant.id}/edit`}
                                className="text-[10px] px-2 py-0.5 bg-picton-blue/10 text-picton-blue rounded font-medium hover:bg-picton-blue/20 transition-colors flex-shrink-0"
                              >
                                Add
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>

                      {assistant.checklist.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4">No checklist items configured</p>
                      )}
                    </div>

                    {/* Right: Ingestion Sources */}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Ingested Sources
                          <span className="ml-2 text-xs font-normal text-gray-400">({assistant.jobs.length})</span>
                        </h4>
                        <Link
                          to={`/portal/assistants/${assistant.id}/edit`}
                          className="text-[11px] text-picton-blue hover:text-picton-blue/80 font-medium transition-colors flex items-center gap-1"
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add Source
                        </Link>
                      </div>

                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {assistant.jobs.length === 0 ? (
                          <div className="text-center py-6">
                            <DocumentArrowUpIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">No sources ingested yet</p>
                            <Link
                              to={`/portal/assistants/${assistant.id}/edit`}
                              className="text-xs text-picton-blue hover:text-picton-blue/80 font-medium mt-1 inline-block"
                            >
                              Train this assistant →
                            </Link>
                          </div>
                        ) : (
                          assistant.jobs.map((job) => (
                            <div
                              key={job.id}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 group"
                            >
                              {jobTypeIcon(job.job_type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium" title={job.source}>
                                  {job.source.length > 60 ? '…' + job.source.slice(-55) : job.source}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {statusBadge(job.status)}
                                  {job.chunks_created > 0 && (
                                    <span className="text-[10px] text-gray-400">{job.chunks_created} chunks</span>
                                  )}
                                  <span className="text-[10px] text-gray-400">{timeAgo(job.created_at)}</span>
                                </div>
                                {job.error_message && (
                                  <p className="text-[10px] text-red-500 mt-0.5 truncate" title={job.error_message}>
                                    {job.error_message}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteJob(assistant.id, job.id); }}
                                disabled={deletingJob === job.id}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all disabled:opacity-50"
                                title="Remove source"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Storage bar */}
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-600">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                          <span className="flex items-center gap-1">
                            <ServerStackIcon className="w-3.5 h-3.5" />
                            {assistant.pagesIndexed} / {assistant.pageLimit} pages
                          </span>
                          <span className={assistant.storageFull ? 'text-red-500 font-medium' : ''}>
                            {storagePercent}%{assistant.storageFull ? ' — Full' : ''}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-dark-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${assistant.storageFull ? 'bg-red-500' : 'bg-picton-blue'}`}
                            style={{ width: `${storagePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KnowledgeBase;
