import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  GlobeAltIcon,
  TrashIcon,
  PencilIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  EyeIcon,
  BoltIcon,
  SparklesIcon,
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import api, { API_BASE_URL } from '../../services/api';
import Swal from 'sweetalert2';

interface Site {
  id: string;
  business_name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  generation_error: string | null;
  deployment_error: string | null;
  ftp_server: string | null;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Status badge config ─────────────────────────────────────── */
const STATUS_CONFIG: Record<
  Site['status'],
  { label: string; icon: React.ElementType; bg: string; text: string; ring: string; dot?: string; animate?: boolean }
> = {
  draft: {
    label: 'Draft',
    icon: PencilIcon,
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    ring: 'ring-slate-200',
  },
  generating: {
    label: 'Generating…',
    icon: CogIcon,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    animate: true,
  },
  generated: {
    label: 'Ready to Deploy',
    icon: CheckCircleIcon,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
  },
  deployed: {
    label: 'Live',
    icon: GlobeAltIcon,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    icon: ExclamationTriangleIcon,
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    dot: 'bg-red-500',
  },
};

function StatusBadge({ site }: { site: Site }) {
  const cfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}
      title={site.status === 'failed' ? site.generation_error || 'Generation failed' : undefined}
    >
      {cfg.dot && (
        <span className="relative flex h-2 w-2">
          {cfg.animate && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
        </span>
      )}
      {!cfg.dot && <Icon className="h-3.5 w-3.5" />}
      {cfg.label}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  // MySQL DATETIME stored as UTC — ensure it's parsed as UTC
  let normalized = dateStr;
  if (normalized && !normalized.endsWith('Z') && !normalized.includes('+')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  const now = Date.now();
  const then = new Date(normalized).getTime();
  if (isNaN(then)) return '';
  const diff = Math.max(0, now - then);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(normalized).toLocaleDateString();
}

const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevSitesRef = useRef<Site[]>([]);

  const loadSites = useCallback(async () => {
    try {
      const res = await api.get('/v1/sites');
      const incoming: Site[] = res.data.sites || [];

      // Detect sites that just finished generating
      const prev = prevSitesRef.current;
      if (prev.length > 0) {
        for (const site of incoming) {
          const old = prev.find((s) => s.id === site.id);
          if (old?.status === 'generating' && site.status === 'generated') {
            // If this site is open in Polish panel, update it live
            setPolishSite((ps) => ps?.id === site.id ? { ...site } : ps);
            Swal.fire({
              icon: 'success',
              title: 'Website Ready! 🎉',
              text: `"${site.business_name}" has been generated and is ready for preview.`,
              timer: 5000,
              timerProgressBar: true,
              showConfirmButton: true,
              confirmButtonText: 'Preview',
              confirmButtonColor: '#7c3aed',
            }).then((result) => {
              if (result.isConfirmed || result.dismiss === Swal.DismissReason.timer) {
                const token = localStorage.getItem('jwt_token') || '';
                window.open(`${API_BASE_URL}/v1/sites/${site.id}/preview?token=${encodeURIComponent(token)}`, '_blank');
              }
            });
          } else if (old?.status === 'generating' && site.status === 'failed') {
            setPolishSite((ps) => ps?.id === site.id ? { ...site } : ps);
            Swal.fire({
              icon: 'error',
              title: 'Generation Failed',
              text: site.generation_error || 'Something went wrong. Please try again.',
            });
          }
        }
      }

      prevSitesRef.current = incoming;
      setSites(incoming);
      // Keep polish panel site in sync
      setPolishSite((ps) => {
        if (!ps) return ps;
        const updated = incoming.find((s) => s.id === ps.id);
        return updated && updated.status !== ps.status ? { ...updated } : ps;
      });
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // ── Auto-poll while any site is "generating" ──
  useEffect(() => {
    const hasGenerating = sites.some((s) => s.status === 'generating');
    if (hasGenerating && !pollRef.current) {
      pollRef.current = setInterval(loadSites, 4000);
    } else if (!hasGenerating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sites, loadSites]);

  const handleDelete = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Delete Site?',
      text: `"${name}" will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/v1/sites/${id}`);
      setSites((prev) => prev.filter((s) => s.id !== id));
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete site.' });
    }
  };

  /* ── Polish Panel state ────────────────────────────────────────── */
  const [polishSite, setPolishSite] = useState<Site | null>(null);
  const [polishPrompt, setPolishPrompt] = useState('');
  const [polishSending, setPolishSending] = useState(false);
  const [polishHistory, setPolishHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const polishChatRef = useRef<HTMLDivElement>(null);
  const polishInputRef = useRef<HTMLTextAreaElement>(null);

  const openPolish = (site: Site) => {
    setPolishSite(site);
    setPolishPrompt('');
    setPolishHistory([]);
    setTimeout(() => polishInputRef.current?.focus(), 200);
  };

  const closePolish = () => {
    setPolishSite(null);
    setPolishPrompt('');
    setPolishHistory([]);
  };

  const handlePolish = async () => {
    if (!polishSite || !polishPrompt.trim() || polishSending) return;
    const prompt = polishPrompt.trim();
    setPolishHistory((h) => [...h, { role: 'user', text: prompt }]);
    setPolishPrompt('');
    setPolishSending(true);

    try {
      await api.post(`/v1/sites/${polishSite.id}/polish`, { prompt });
      setPolishHistory((h) => [...h, { role: 'ai', text: '✨ Polish request queued — your site is being updated. You\'ll see it once it\'s ready.' }]);
      // Trigger a reload so the card shows "generating"
      loadSites();
    } catch (err: any) {
      setPolishHistory((h) => [...h, { role: 'ai', text: `❌ ${err?.response?.data?.error || 'Failed to start polish. Please try again.'}` }]);
    } finally {
      setPolishSending(false);
      setTimeout(() => polishChatRef.current?.scrollTo({ top: polishChatRef.current.scrollHeight, behavior: 'smooth' }), 100);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-36 bg-white rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Build and manage your web presence</p>
        </div>
        <Link
          to="/portal/sites/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          Create Landing Page
        </Link>
      </div>

      {/* Empty state */}
      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <GlobeAltIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No landing pages yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Build and deploy professional single-page websites in minutes.
          </p>
          <Link
            to="/portal/sites/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            Create Your First Landing Page
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sites.map((site) => {
            const cfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft;
            return (
              <div
                key={site.id}
                className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all ${
                  site.status === 'generating'
                    ? 'border-blue-200 ring-1 ring-blue-100'
                    : site.status === 'failed'
                    ? 'border-red-200'
                    : 'border-slate-200'
                }`}
              >
                {/* ── Card header ── */}
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Logo or fallback icon */}
                    {site.logo_url ? (
                      <img
                        src={site.logo_url}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-gray-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <GlobeAltIcon className={`h-6 w-6 ${cfg.text}`} />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {site.business_name}
                      </h3>
                      {site.tagline && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{site.tagline}</p>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge site={site} />
                    {site.status === 'deployed' && site.ftp_server && (
                      <span className="text-xs text-gray-400 truncate">{site.ftp_server}</span>
                    )}
                  </div>

                  {/* Contextual status messages */}
                  {site.status === 'generating' && (
                    <div className="flex items-center gap-2 mt-2 p-2.5 bg-blue-50 rounded-lg">
                      <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                      <p className="text-xs text-blue-600">
                        AI is building your website — this usually takes 2–5 minutes…
                      </p>
                    </div>
                  )}

                  {site.status === 'failed' && (site.generation_error || site.deployment_error) && (
                    <div className="flex items-start gap-2 mt-2 p-2.5 bg-red-50 rounded-lg">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 line-clamp-2">
                        {site.generation_error || `Deploy failed: ${site.deployment_error}`}
                      </p>
                    </div>
                  )}

                  {site.deployment_error && site.status !== 'failed' && (
                    <div className="flex items-start gap-2 mt-2 p-2.5 bg-orange-50 rounded-lg">
                      <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-orange-600 line-clamp-2">
                          <span className="font-semibold">Deploy failed:</span> {site.deployment_error}
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              Swal.fire({ title: 'Deploying…', text: 'Connecting to your server', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                              await api.post(`/v1/sites/${site.id}/deploy`);
                              Swal.fire({ icon: 'success', title: 'Deployed!', timer: 2500, showConfirmButton: false });
                              loadSites();
                            } catch (err: any) {
                              Swal.fire({ icon: 'error', title: 'Deploy Failed', text: err?.response?.data?.error || 'Could not deploy. Check your FTP settings.' });
                            }
                          }}
                          className="mt-1.5 text-[11px] font-semibold text-orange-700 hover:text-orange-900 underline"
                        >
                          Retry deploy →
                        </button>
                      </div>
                    </div>
                  )}

                  {site.status === 'deployed' && site.last_deployed_at && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" />
                      Deployed {timeAgo(site.last_deployed_at)}
                    </p>
                  )}

                  {/* Timestamps */}
                  <p className="text-[11px] text-gray-300 mt-2 flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    Updated {timeAgo(site.updated_at)}
                  </p>
                </div>

                {/* ── Card actions ── */}
                <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/portal/sites/${site.id}/edit`}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit
                  </Link>

                  {(site.status === 'generated' || site.status === 'deployed') && (
                    <button
                      onClick={() => openPolish(site)}
                      className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <SparklesIcon className="h-3.5 w-3.5" />
                      Polish
                    </button>
                  )}

                  {(site.status === 'generated' || site.status === 'deployed') && (
                    <button
                      onClick={() => {
                        const token = localStorage.getItem('jwt_token') || '';
                        window.open(`${API_BASE_URL}/v1/sites/${site.id}/preview?token=${encodeURIComponent(token)}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  )}

                  {site.status === 'generating' && (
                    <button
                      onClick={async () => {
                        const result = await Swal.fire({
                          title: '⚡ Skip the Queue',
                          html: '<p class="text-sm text-gray-600 mb-2">Re-generate this site now using premium AI for faster, higher-quality results.</p><p class="text-xs text-gray-400">Uses GLM / GPT-4o instead of local AI.</p>',
                          icon: 'question',
                          showCancelButton: true,
                          confirmButtonText: 'Generate Now',
                          confirmButtonColor: '#f59e0b',
                          cancelButtonText: 'Stay in Queue',
                        });
                        if (!result.isConfirmed) return;
                        try {
                          await api.post(`/v1/sites/${site.id}/skip-queue`);
                          Swal.fire({ icon: 'success', title: 'Priority Build Started', text: 'Your site is being rebuilt with enhanced AI.', timer: 3000, showConfirmButton: false });
                        } catch (err: any) {
                          Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to start priority generation.' });
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    >
                      <BoltIcon className="h-3.5 w-3.5" />
                      Upgrade to skip the queue
                    </button>
                  )}

                  {site.status === 'failed' && (
                    <Link
                      to={`/portal/sites/${site.id}/edit`}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ArrowPathIcon className="h-3.5 w-3.5" />
                      Retry
                    </Link>
                  )}

                  {site.status === 'deployed' && site.ftp_server && (
                    <a
                      href={`https://${site.ftp_server}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                      Visit
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(site.id, site.business_name)}
                    disabled={site.status === 'generating'}
                    className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={site.status === 'generating' ? 'Cannot delete while generating' : 'Delete site'}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* ═══ Polish Slide-over Panel ═══ */}
    {polishSite && (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={closePolish} />

        {/* Panel */}
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] md:w-[680px] lg:w-[800px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-fuchsia-50 to-violet-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Polish with AI</h2>
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{polishSite.business_name}</p>
              </div>
            </div>
            <button onClick={closePolish} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Preview iframe */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 relative bg-gray-100">
              {polishSite.status === 'generating' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
                  <p className="text-sm text-gray-500">AI is applying your changes…</p>
                </div>
              ) : (
                <iframe
                  key={polishSite.updated_at}
                  src={`${API_BASE_URL}/v1/sites/${polishSite.id}/preview?token=${encodeURIComponent(localStorage.getItem('jwt_token') || '')}`}
                  className="w-full h-full border-0"
                  title="Site Preview"
                />
              )}
            </div>

            {/* Chat history */}
            {polishHistory.length > 0 && (
              <div ref={polishChatRef} className="max-h-40 overflow-y-auto px-5 py-3 border-t border-slate-100 space-y-2 bg-gray-50/80">
                {polishHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] text-xs px-3 py-2 rounded-xl ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-700 border border-slate-200 rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt input */}
            <div className="border-t border-slate-200 px-5 py-4 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  ref={polishInputRef}
                  value={polishPrompt}
                  onChange={(e) => setPolishPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePolish(); }
                  }}
                  placeholder="Tell AI what to change… e.g. &quot;Make the hero section taller&quot; or &quot;Change the colour scheme to dark blue&quot;"
                  rows={2}
                  disabled={polishSending || polishSite.status === 'generating'}
                  className="flex-1 resize-none rounded-xl border border-slate-300 bg-gray-50 px-4 py-2.5 text-sm placeholder-gray-400 focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handlePolish}
                  disabled={!polishPrompt.trim() || polishSending || polishSite.status === 'generating'}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 text-white rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {polishSending ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <PaperAirplaneIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Press Enter to send · Shift+Enter for new line · Changes follow the generation queue</p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slide-in-right {
            animation: slideInRight 0.25s ease-out;
          }
        `}</style>
      </>
    )}
  </>
  );
};

export default SitesPage;
