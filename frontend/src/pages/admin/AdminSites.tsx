import React, { useState, useEffect, useCallback } from 'react';
import {
  GlobeAltIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CogIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import Swal from 'sweetalert2';

interface AdminSite {
  id: string;
  business_name: string;
  tagline: string | null;
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  max_pages: number;
  ftp_server: string | null;
  last_deployed_at: string | null;
  generation_error: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_email: string;
  owner_name: string | null;
  page_count: number;
  subscription_status: string | null;
  package_name: string | null;
  trial_ends_at: string | null;
}

interface SiteStats {
  total_sites: number;
  draft_count: number;
  generating_count: number;
  generated_count: number;
  deployed_count: number;
  failed_count: number;
  total_pages: number;
  trial_sites: number;
  recent_deployments: number;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  draft:      { label: 'Draft',      dot: 'bg-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-600' },
  generating: { label: 'Generating', dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700' },
  generated:  { label: 'Ready',      dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  deployed:   { label: 'Live',       dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  failed:     { label: 'Failed',     dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700' },
};

function timeAgo(dateStr: string): string {
  let normalized = dateStr;
  if (normalized && !normalized.endsWith('Z') && !normalized.includes('+')) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  const diff = Math.max(0, Date.now() - new Date(normalized).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(normalized).toLocaleDateString();
}

const AdminSites: React.FC = () => {
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/sites/stats');
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/sites', {
        params: { search, status: statusFilter, page, limit: 25 },
      });
      setSites(res.data.sites || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadSites(); }, [loadSites]);

  const handleDelete = async (site: AdminSite) => {
    const result = await Swal.fire({
      title: `Delete "${site.business_name}"?`,
      text: `This will permanently delete the site and all its pages. Owner: ${site.owner_email}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete Site',
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/admin/sites/${site.id}`);
      loadSites();
      loadStats();
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to delete' });
    }
  };

  const handleUpdateMaxPages = async (site: AdminSite) => {
    const { value: maxPages } = await Swal.fire({
      title: `Set Page Limit`,
      text: `Current limit: ${site.max_pages} pages for "${site.business_name}"`,
      input: 'number',
      inputValue: site.max_pages,
      inputAttributes: { min: '1', max: '50', step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Update',
      confirmButtonColor: '#3b82f6',
    });
    if (!maxPages) return;

    try {
      await api.patch(`/admin/sites/${site.id}`, { maxPages: parseInt(maxPages) });
      loadSites();
      Swal.fire({ icon: 'success', title: 'Updated', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to update' });
    }
  };

  const handleStatusChange = async (site: AdminSite, newStatus: string) => {
    try {
      await api.patch(`/admin/sites/${site.id}`, { status: newStatus });
      loadSites();
      loadStats();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to update status' });
    }
  };

  const statCards = stats ? [
    { label: 'Total Sites',   value: stats.total_sites,        icon: GlobeAltIcon,              color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Deployed',      value: stats.deployed_count,     icon: CheckCircleIcon,           color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Generating',    value: stats.generating_count,   icon: CogIcon,                   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Failed',        value: stats.failed_count,       icon: ExclamationTriangleIcon,   color: 'text-red-600 bg-red-50 dark:bg-red-900/30' },
    { label: 'Total Pages',   value: stats.total_pages,        icon: DocumentTextIcon,           color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
    { label: 'Trial Sites',   value: stats.trial_sites,        icon: ClockIcon,                  color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
    { label: 'Recent Deploys', value: stats.recent_deployments, icon: RocketLaunchIcon,          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage all generated websites across all clients
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by business name, owner email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-picton-blue/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-picton-blue/50"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="generating">Generating</option>
            <option value="generated">Ready</option>
            <option value="deployed">Deployed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Sites Table */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-picton-blue" />
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <GlobeAltIcon className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium">No sites found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-750">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Site</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Owner</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Pages</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Package</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {sites.map(site => {
                  const stCfg = STATUS_CONFIG[site.status] || STATUS_CONFIG.draft;
                  return (
                    <tr key={site.id} className="hover:bg-gray-50 dark:hover:bg-dark-750 transition">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{site.business_name}</p>
                          {site.tagline && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{site.tagline}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 dark:text-gray-300">{site.owner_name || '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{site.owner_email}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${stCfg.bg} ${stCfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stCfg.dot}`} />
                          {stCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleUpdateMaxPages(site)}
                          className="text-sm text-gray-700 dark:text-gray-300 hover:text-picton-blue transition"
                          title="Click to update page limit"
                        >
                          {site.page_count}/{site.max_pages}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {site.package_name ? (
                          <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{site.package_name}</p>
                            {site.subscription_status === 'TRIAL' && site.trial_ends_at && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Trial · {Math.max(0, Math.ceil(
                                  (new Date(site.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                                ))}d left
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                        {timeAgo(site.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {site.status === 'failed' && (
                            <button
                              onClick={() => handleStatusChange(site, 'draft')}
                              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                              title="Reset to Draft"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateMaxPages(site)}
                            className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                            title="Edit page limit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(site)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            title="Delete site"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-dark-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600 disabled:opacity-30 transition"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600 disabled:opacity-30 transition"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSites;
