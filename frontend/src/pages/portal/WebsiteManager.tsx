import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  SparklesIcon,
  EyeIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  LockClosedIcon,
  ArrowsUpDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  RocketLaunchIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import api, { API_BASE_URL } from '../../services/api';
import Swal from 'sweetalert2';

interface SitePage {
  id: string;
  site_id: string;
  page_type: string;
  page_slug: string;
  page_title: string;
  content_data: Record<string, any>;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Site {
  id: string;
  business_name: string;
  tagline: string | null;
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  max_pages: number;
  ftp_server: string | null;
  last_deployed_at: string | null;
  created_at: string;
}

interface TierInfo {
  tier: 'free' | 'paid';
  maxPages: number;
  packageSlug: string | null;
  status: string | null;
  daysLeft: number | null;
}

const PAGE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  home:     { label: 'Home',     icon: GlobeAltIcon,      color: 'text-blue-600 bg-blue-50' },
  about:    { label: 'About',    icon: DocumentTextIcon,  color: 'text-purple-600 bg-purple-50' },
  services: { label: 'Services', icon: SparklesIcon,      color: 'text-emerald-600 bg-emerald-50' },
  contact:  { label: 'Contact',  icon: DocumentTextIcon,  color: 'text-amber-600 bg-amber-50' },
  gallery:  { label: 'Gallery',  icon: EyeIcon,           color: 'text-pink-600 bg-pink-50' },
  faq:      { label: 'FAQ',      icon: DocumentTextIcon,  color: 'text-cyan-600 bg-cyan-50' },
  pricing:  { label: 'Pricing',  icon: DocumentTextIcon,  color: 'text-orange-600 bg-orange-50' },
  custom:   { label: 'Custom',   icon: PencilIcon,        color: 'text-gray-600 bg-gray-50' },
};

const WebsiteManager: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();

  const [site, setSite] = useState<Site | null>(null);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [maxPages, setMaxPages] = useState(1);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPage, setGeneratingPage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!siteId) return;
    try {
      const [siteRes, pagesRes, tierRes] = await Promise.all([
        api.get(`/v1/sites/${siteId}`),
        api.get(`/v1/sites/${siteId}/pages`),
        api.get('/v1/sites/tier'),
      ]);
      setSite(siteRes.data.site || siteRes.data);
      setPages(pagesRes.data.pages || []);
      setMaxPages(pagesRes.data.maxPages || 1);
      setTierInfo(tierRes.data);
    } catch (err) {
      console.error('Failed to load site data:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const isFree = tierInfo?.tier === 'free';
  const canAddPage = !isFree && pages.length < maxPages;
  const pagesUsed = pages.length;

  const handleAddPage = async () => {
    if (!canAddPage) return;

    const { value: formValues } = await Swal.fire({
      title: 'Add New Page',
      html: `
        <div class="text-left space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
            <input id="swal-title" class="swal2-input" placeholder="e.g. About Us" style="margin:0;width:100%">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Page Type</label>
            <select id="swal-type" class="swal2-select" style="margin:0;width:100%">
              <option value="about">About</option>
              <option value="services">Services</option>
              <option value="contact">Contact</option>
              <option value="gallery">Gallery</option>
              <option value="faq">FAQ</option>
              <option value="pricing">Pricing</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
            <input id="swal-slug" class="swal2-input" placeholder="e.g. about-us" style="margin:0;width:100%">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create Page',
      confirmButtonColor: '#3b82f6',
      preConfirm: () => {
        const title = (document.getElementById('swal-title') as HTMLInputElement).value.trim();
        const type = (document.getElementById('swal-type') as HTMLSelectElement).value;
        const slug = (document.getElementById('swal-slug') as HTMLInputElement).value.trim();
        if (!title) { Swal.showValidationMessage('Page title is required'); return; }
        return { title, type, slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
      },
    });

    if (!formValues) return;

    try {
      await api.post(`/v1/sites/${siteId}/pages`, {
        pageTitle: formValues.title,
        pageType: formValues.type,
        pageSlug: formValues.slug,
        sortOrder: pages.length,
      });
      await loadData();
      Swal.fire({ icon: 'success', title: 'Page Created', timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to create page';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }
  };

  const handleDeletePage = async (page: SitePage) => {
    if (page.page_type === 'home') {
      Swal.fire({ icon: 'warning', title: 'Cannot Delete', text: 'The home page cannot be deleted.' });
      return;
    }
    const result = await Swal.fire({
      title: `Delete "${page.page_title}"?`,
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/v1/sites/${siteId}/pages/${page.id}`);
      await loadData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || 'Failed to delete page' });
    }
  };

  const handleGeneratePage = async (page: SitePage) => {
    setGeneratingPage(page.id);
    try {
      await api.post(`/v1/sites/${siteId}/pages/${page.id}/generate`);
      await loadData();
      Swal.fire({ icon: 'success', title: 'Page Generated!', timer: 2000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Generation Failed', text: err?.response?.data?.error || 'Unknown error' });
    } finally {
      setGeneratingPage(null);
    }
  };

  const handlePreview = () => {
    const token = localStorage.getItem('jwt_token') || '';
    window.open(`${API_BASE_URL}/v1/sites/${siteId}/preview?token=${encodeURIComponent(token)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-picton-blue" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-3 text-red-400" />
        <p className="text-lg font-medium">Site not found</p>
        <Link to="/portal/sites" className="text-picton-blue hover:underline mt-2 inline-block">
          ← Back to Sites
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/portal/sites"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{site.business_name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {site.tagline || 'Website Manager'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-600 transition"
          >
            <EyeIcon className="h-4 w-4" />
            Preview
          </button>
          <Link
            to={`/portal/sites/${siteId}/submissions`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-600 transition"
          >
            <EnvelopeIcon className="h-4 w-4" />
            Submissions
          </Link>
          <Link
            to={`/portal/sites/${siteId}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-picton-blue text-white hover:bg-picton-blue/90 transition shadow-sm"
          >
            <PencilIcon className="h-4 w-4" />
            Edit Site
          </Link>
        </div>
      </div>

      {/* Trial Warning Banner */}
      {tierInfo?.status === 'TRIAL' && tierInfo.daysLeft !== null && (
        <div className={`rounded-xl p-4 flex items-start gap-3 ${
          tierInfo.daysLeft <= 3
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <ExclamationTriangleIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
            tierInfo.daysLeft <= 3 ? 'text-red-500' : 'text-amber-500'
          }`} />
          <div>
            <p className={`text-sm font-semibold ${
              tierInfo.daysLeft <= 3 ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200'
            }`}>
              Trial expires in {tierInfo.daysLeft} day{tierInfo.daysLeft !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              After your trial, multi-page features will be disabled. Upgrade to keep all your pages.
            </p>
          </div>
        </div>
      )}

      {/* Page Quota Bar */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pages</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pagesUsed} of {maxPages} page{maxPages !== 1 ? 's' : ''} used
              {isFree && <span className="ml-1 text-amber-500">(Free tier — single page only)</span>}
            </p>
          </div>
          {canAddPage ? (
            <button
              onClick={handleAddPage}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Add Page
            </button>
          ) : isFree ? (
            <Link
              to="/portal/settings"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition shadow-sm"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              Upgrade
            </Link>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Page limit reached</span>
          )}
        </div>
        <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              pagesUsed >= maxPages ? 'bg-red-500' : pagesUsed / maxPages > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (pagesUsed / maxPages) * 100)}%` }}
          />
        </div>
      </div>

      {/* Free Tier Upsell */}
      {isFree && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl">
              <RocketLaunchIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Unlock Multi-Page Websites
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Upgrade to a paid plan to create websites with multiple pages — About, Services, Gallery,
                FAQ, Pricing, and custom pages. AI generates each page with matching design.
              </p>
              <div className="flex flex-wrap gap-2">
                {['About', 'Services', 'Gallery', 'FAQ', 'Pricing', 'Custom'].map(t => (
                  <span key={t} className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-white/60 dark:bg-dark-700 text-gray-600 dark:text-gray-300">
                    <LockClosedIcon className="h-3 w-3 text-purple-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pages List */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-dark-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowsUpDownIcon className="h-5 w-5 text-gray-400" />
            Site Pages
          </h3>
        </div>

        {pages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <DocumentTextIcon className="h-10 w-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium">No pages yet</p>
            <p className="text-xs mt-1">
              {isFree
                ? 'Your site runs as a single-page landing. Upgrade for multi-page.'
                : 'Add your first page to get started.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {pages
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((page) => {
                const cfg = PAGE_TYPE_CONFIG[page.page_type] || PAGE_TYPE_CONFIG.custom;
                const PageIcon = cfg.icon;
                const isGenerating = generatingPage === page.id;

                return (
                  <div
                    key={page.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition group"
                  >
                    {/* Type icon */}
                    <div className={`p-2.5 rounded-lg ${cfg.color}`}>
                      <PageIcon className="h-5 w-5" />
                    </div>

                    {/* Page info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {page.page_title}
                        </h4>
                        {page.is_published ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircleIcon className="h-3 w-3" />
                            Published
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-dark-600 dark:text-gray-400">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        /{page.page_slug} · {cfg.label}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleGeneratePage(page)}
                        disabled={isGenerating}
                        className="p-2 rounded-lg text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition disabled:opacity-50"
                        title="Generate with AI"
                      >
                        {isGenerating ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <SparklesIcon className="h-4 w-4" />
                        )}
                      </button>
                      <Link
                        to={`/portal/sites/${siteId}/pages/${page.id}`}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600 transition"
                        title="Edit page"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Link>
                      {page.page_type !== 'home' && (
                        <button
                          onClick={() => handleDeletePage(page)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          title="Delete page"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                      <ChevronRightIcon className="h-4 w-4 text-gray-300 dark:text-gray-600 ml-1" />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteManager;
