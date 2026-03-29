import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioModel, type StudioSite, type StudioStats } from '../../models/StudioModels';
import {
  PlusIcon, MagnifyingGlassIcon, GlobeAltIcon,
  PaintBrushIcon, RocketLaunchIcon, ExclamationTriangleIcon,
  DocumentDuplicateIcon, ClockIcon,
} from '@heroicons/react/24/outline';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  generating: 'bg-yellow-100 text-yellow-700',
  generated: 'bg-blue-100 text-blue-700',
  deployed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export default function StudioDashboard() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<StudioSite[]>([]);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesRes, statsRes] = await Promise.all([
        StudioModel.listSites({ search, status: statusFilter || undefined, limit, offset: page * limit }),
        StudioModel.getStats(),
      ]);
      setSites(sitesRes.sites);
      setTotal(sitesRes.total);
      setStats(statsRes);
    } catch (err) {
      console.error('[Studio] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    navigate('/studio/new');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PaintBrushIcon className="w-8 h-8 text-indigo-400" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Softaware Studio
                </h1>
                <p className="text-sm text-gray-400">Creative workspace for building client websites</p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              New Site
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total Sites', value: stats.total_sites, icon: GlobeAltIcon, color: 'text-blue-400' },
              { label: 'Deployed', value: stats.deployed, icon: RocketLaunchIcon, color: 'text-green-400' },
              { label: 'Generating', value: stats.generating, icon: ClockIcon, color: 'text-yellow-400' },
              { label: 'Failed', value: stats.failed, icon: ExclamationTriangleIcon, color: 'text-red-400' },
              { label: 'Drafts', value: stats.draft, icon: DocumentDuplicateIcon, color: 'text-gray-400' },
              { label: 'Total Pages', value: stats.total_pages, icon: DocumentDuplicateIcon, color: 'text-purple-400' },
              { label: 'Deployments', value: stats.total_deployments, icon: RocketLaunchIcon, color: 'text-cyan-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
                <span className="text-xl font-bold">{s.value ?? 0}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search sites..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="generating">Generating</option>
            <option value="generated">Generated</option>
            <option value="deployed">Deployed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Sites Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <GlobeAltIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No sites found</p>
            <p className="text-sm mt-1">Create a new site to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map(site => (
              <div
                key={site.id}
                onClick={() => navigate(`/studio/${site.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-indigo-500/50 cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/5 group"
              >
                {/* Logo / Color bar */}
                <div
                  className="h-2 rounded-full mb-3"
                  style={{ backgroundColor: site.primary_color || '#6366f1' }}
                />

                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold group-hover:text-indigo-400 transition-colors truncate">
                    {site.business_name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[site.status] || STATUS_COLORS.draft}`}>
                    {site.status}
                  </span>
                </div>

                {site.tagline && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{site.tagline}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{site.page_count ?? 0} pages</span>
                  <span>{site.owner_name || site.owner_email || 'Unknown'}</span>
                </div>

                {site.custom_domain && (
                  <div className="mt-2 text-xs text-indigo-400 truncate">{site.custom_domain}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
