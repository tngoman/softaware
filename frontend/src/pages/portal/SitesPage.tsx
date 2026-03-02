import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  GlobeAltIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { getApiBaseUrl } from '../../config/app';
import Swal from 'sweetalert2';

interface Site {
  id: string;
  name: string;
  domain?: string;
  status: string;
  createdAt?: string;
}

const SitesPage: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const base = getApiBaseUrl().replace('/api', '');
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${base}/api/v1/sites`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setSites(data.sites || []);
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

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
      const base = getApiBaseUrl().replace('/api', '');
      const token = localStorage.getItem('jwt_token');
      await fetch(`${base}/api/v1/sites/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSites((prev) => prev.filter((s) => s.id !== id));
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete site.' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Build and manage your web presence</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <GlobeAltIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No landing pages yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            This feature is coming soon. You'll be able to build and deploy single-page websites right from here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
            >
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <GlobeAltIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{site.name}</h3>
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${
                        site.status === 'deployed'
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-amber-700 bg-amber-50'
                      }`}
                    >
                      {site.status === 'deployed' ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>
                {site.domain && (
                  <p className="text-sm text-gray-500 truncate">{site.domain}</p>
                )}
              </div>
              <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
                {site.domain && (
                  <a
                    href={`https://${site.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    Visit
                  </a>
                )}
                <button
                  onClick={() => handleDelete(site.id, site.name)}
                  className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SitesPage;
