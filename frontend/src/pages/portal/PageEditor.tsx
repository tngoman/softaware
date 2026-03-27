import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  SparklesIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api, { API_BASE_URL } from '../../services/api';
import Swal from 'sweetalert2';

interface PageData {
  id: string;
  site_id: string;
  page_type: string;
  page_slug: string;
  page_title: string;
  content_data: Record<string, any>;
  generated_html: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SiteData {
  id: string;
  business_name: string;
}

const PAGE_TYPE_FIELDS: Record<string, { label: string; fields: { key: string; label: string; type: 'text' | 'textarea' | 'list' }[] }> = {
  about: {
    label: 'About Page',
    fields: [
      { key: 'heading', label: 'Section Heading', type: 'text' },
      { key: 'story', label: 'Our Story', type: 'textarea' },
      { key: 'mission', label: 'Mission Statement', type: 'textarea' },
      { key: 'teamMembers', label: 'Team Members (one per line)', type: 'list' },
    ],
  },
  services: {
    label: 'Services Page',
    fields: [
      { key: 'heading', label: 'Section Heading', type: 'text' },
      { key: 'intro', label: 'Introduction', type: 'textarea' },
      { key: 'services', label: 'Services (one per line)', type: 'list' },
    ],
  },
  contact: {
    label: 'Contact Page',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'hours', label: 'Business Hours', type: 'textarea' },
    ],
  },
  gallery: {
    label: 'Gallery Page',
    fields: [
      { key: 'heading', label: 'Gallery Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  faq: {
    label: 'FAQ Page',
    fields: [
      { key: 'heading', label: 'Page Title', type: 'text' },
      { key: 'questions', label: 'Questions (Q: / A: format, one pair per line)', type: 'list' },
    ],
  },
  pricing: {
    label: 'Pricing Page',
    fields: [
      { key: 'heading', label: 'Page Title', type: 'text' },
      { key: 'description', label: 'Introduction', type: 'textarea' },
      { key: 'plans', label: 'Plans (name - price - features, one per line)', type: 'list' },
    ],
  },
  custom: {
    label: 'Custom Page',
    fields: [
      { key: 'heading', label: 'Page Title', type: 'text' },
      { key: 'content', label: 'Content', type: 'textarea' },
    ],
  },
};

const PageEditor: React.FC = () => {
  const { siteId, pageId } = useParams<{ siteId: string; pageId: string }>();

  const [page, setPage] = useState<PageData | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const loadPage = useCallback(async () => {
    if (!siteId || !pageId) return;
    try {
      const [pageRes, siteRes] = await Promise.all([
        api.get(`/v1/sites/${siteId}/pages/${pageId}`),
        api.get(`/v1/sites/${siteId}`),
      ]);
      const p = pageRes.data.page || pageRes.data;
      const s = siteRes.data.site || siteRes.data;
      setPage(p);
      setSite(s);
      setPageTitle(p.page_title || '');
      setPageSlug(p.page_slug || '');
      setIsPublished(!!p.is_published);

      // Parse content_data into form fields
      const cd = typeof p.content_data === 'string' ? JSON.parse(p.content_data || '{}') : (p.content_data || {});
      const flat: Record<string, string> = {};
      for (const [k, v] of Object.entries(cd)) {
        if (Array.isArray(v)) {
          flat[k] = v.join('\n');
        } else {
          flat[k] = String(v || '');
        }
      }
      setFormData(flat);
    } catch (err) {
      console.error('Failed to load page:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId, pageId]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const buildContentData = (): Record<string, any> => {
    const fields = PAGE_TYPE_FIELDS[page?.page_type || 'custom']?.fields || [];
    const result: Record<string, any> = {};
    for (const field of fields) {
      const val = formData[field.key] || '';
      if (field.type === 'list') {
        result[field.key] = val.split('\n').map(l => l.trim()).filter(Boolean);
      } else {
        result[field.key] = val;
      }
    }
    return result;
  };

  const handleSave = async () => {
    if (!siteId || !pageId) return;
    setSaving(true);
    try {
      await api.put(`/v1/sites/${siteId}/pages/${pageId}`, {
        pageTitle,
        pageSlug,
        isPublished,
        contentData: buildContentData(),
      });
      Swal.fire({ icon: 'success', title: 'Saved', timer: 1500, showConfirmButton: false });
      await loadPage();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err?.response?.data?.error || 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!siteId || !pageId) return;
    // Save first, then generate
    setSaving(true);
    try {
      await api.put(`/v1/sites/${siteId}/pages/${pageId}`, {
        pageTitle,
        pageSlug,
        isPublished,
        contentData: buildContentData(),
      });
    } catch { /* continue even if save fails */ }
    setSaving(false);

    setGenerating(true);
    try {
      await api.post(`/v1/sites/${siteId}/pages/${pageId}/generate`);
      await loadPage();
      Swal.fire({ icon: 'success', title: 'Page Generated! ✨', text: 'Your page has been AI-generated.', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Generation Failed', text: err?.response?.data?.error || 'Unknown error' });
    } finally {
      setGenerating(false);
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

  if (!page || !site) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-3 text-red-400" />
        <p className="text-lg font-medium">Page not found</p>
        <Link to={`/portal/sites/${siteId}/manage`} className="text-picton-blue hover:underline mt-2 inline-block">
          ← Back to Pages
        </Link>
      </div>
    );
  }

  const typeConfig = PAGE_TYPE_FIELDS[page.page_type] || PAGE_TYPE_FIELDS.custom;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/portal/sites/${siteId}/manage`}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-700 transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{typeConfig.label}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {site.business_name} · /{page.page_slug}
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
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition shadow-sm disabled:opacity-60"
          >
            {generating ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-picton-blue text-white hover:bg-picton-blue/90 transition shadow-sm disabled:opacity-60"
          >
            {saving ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircleIcon className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* Page Meta */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          Page Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Page Title
            </label>
            <input
              type="text"
              value={pageTitle}
              onChange={e => setPageTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-picton-blue/50 focus:border-picton-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL Slug
            </label>
            <div className="flex items-center">
              <span className="text-sm text-gray-400 mr-1">/</span>
              <input
                type="text"
                value={pageSlug}
                onChange={e => setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-picton-blue/50 focus:border-picton-blue"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={e => setIsPublished(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-picton-blue/50 rounded-full peer dark:bg-dark-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
          </label>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
      </div>

      {/* Content Fields */}
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-purple-400" />
          Page Content
        </h3>
        <div className="space-y-4">
          {typeConfig.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
              </label>
              {field.type === 'textarea' || field.type === 'list' ? (
                <textarea
                  value={formData[field.key] || ''}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                  rows={field.type === 'list' ? 5 : 4}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-picton-blue/50 focus:border-picton-blue resize-y"
                  placeholder={field.type === 'list' ? 'One item per line' : ''}
                />
              ) : (
                <input
                  type="text"
                  value={formData[field.key] || ''}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-picton-blue/50 focus:border-picton-blue"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generated HTML Preview */}
      {page.generated_html && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Generated Preview</h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-picton-blue hover:underline"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
          </div>
          {showPreview && (
            <div className="p-4">
              <iframe
                srcDoc={page.generated_html}
                className="w-full h-[500px] border border-gray-200 dark:border-dark-600 rounded-lg"
                title="Page Preview"
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PageEditor;
