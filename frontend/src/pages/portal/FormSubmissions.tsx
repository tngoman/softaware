import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  InboxIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import { getApiBaseUrl } from '../../config/app';

interface Submission {
  id: string;
  form_data: Record<string, string>;
  submitted_at: string;
  ip_address: string;
  is_read: number;
  notification_sent: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FormSubmissions: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const apiBase = getApiBaseUrl();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [siteName, setSiteName] = useState('');

  const getHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('jwt_token');
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  const fetchSubmissions = useCallback(async (page = 1) => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (showUnreadOnly) params.set('unread', '1');

      const res = await fetch(`${apiBase}/v1/sites/${siteId}/submissions?${params}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, siteId, showUnreadOnly]);

  // Load site name
  useEffect(() => {
    if (!siteId) return;
    const loadSiteName = async () => {
      try {
        const res = await fetch(`${apiBase}/v1/sites/${siteId}`, { headers: getHeaders() });
        const data = await res.json();
        if (data.site?.business_name) setSiteName(data.site.business_name);
      } catch {}
    };
    loadSiteName();
  }, [apiBase, siteId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleMarkRead = async (submissionId: string) => {
    try {
      await fetch(`${apiBase}/v1/sites/${siteId}/submissions/${submissionId}/read`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      setSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, is_read: 1 } : s)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleDelete = async (submissionId: string) => {
    const result = await Swal.fire({
      title: 'Delete Submission?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      await fetch(`${apiBase}/v1/sites/${siteId}/submissions/${submissionId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
      if (selectedSubmission?.id === submissionId) setSelectedSubmission(null);
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete submission.' });
    }
  };

  const handleViewSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    if (!submission.is_read) {
      handleMarkRead(submission.id);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/portal/sites/${siteId}/manage`} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Form Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {siteName ? `${siteName} — ` : ''}
            {pagination.total} submission{pagination.total !== 1 ? 's' : ''}
            {unreadCount > 0 && <span className="text-emerald-600 font-medium"> · {unreadCount} unread</span>}
          </p>
        </div>
        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
            showUnreadOnly
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FunnelIcon className="h-4 w-4" />
          {showUnreadOnly ? 'Unread Only' : 'All'}
        </button>
      </div>

      {/* Submissions List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading submissions…
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <InboxIcon className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No submissions yet</p>
            <p className="text-xs text-gray-400 mt-1">
              {showUnreadOnly ? 'No unread submissions. Try showing all.' : 'Submissions from your contact form will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {submissions.map((sub) => {
              const email = sub.form_data.email || '';
              const name = sub.form_data.name || sub.form_data.Name || '';
              const message = sub.form_data.message || sub.form_data.Message || '';
              const preview = message.length > 80 ? message.slice(0, 80) + '…' : message;

              return (
                <div
                  key={sub.id}
                  onClick={() => handleViewSubmission(sub)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !sub.is_read ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  <div className="flex-shrink-0">
                    {sub.is_read ? (
                      <EnvelopeOpenIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EnvelopeIcon className="h-5 w-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!sub.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {name || email || 'Anonymous'}
                      </span>
                      {email && name && (
                        <span className="text-xs text-gray-400">{email}</span>
                      )}
                      {!sub.is_read && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                          New
                        </span>
                      )}
                    </div>
                    {preview && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{preview}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{formatDate(sub.submitted_at)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(sub.id); }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchSubmissions(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => fetchSubmissions(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <EyeIcon className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-bold text-gray-900">Submission Details</h2>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh] space-y-4">
              {Object.entries(selectedSubmission.form_data).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{value || '—'}</p>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Submitted: {formatDate(selectedSubmission.submitted_at)}</span>
                  <span>IP: {selectedSubmission.ip_address}</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  handleDelete(selectedSubmission.id);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Delete
              </button>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormSubmissions;
