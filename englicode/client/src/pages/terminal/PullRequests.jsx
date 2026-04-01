import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';

const STATUS_TABS = ['pending', 'approved', 'rejected'];

export default function PullRequests() {
  const [prs, setPrs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/pull-requests?status=${status}&page=${page}&limit=20`);
      setPrs(data.data.pullRequests);
      setTotal(data.data.total);
    } catch (err) {
      console.error('Failed to fetch PRs:', err);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { fetchPRs(); }, [fetchPRs]);

  const handleAction = async (prId, action) => {
    try {
      await api.post(`/pull-requests/${prId}/${action}`);
      fetchPRs();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action}`);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Consensus Board</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Community Pull Requests — review, approve, reject
        </p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-5">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-semibold capitalize transition-colors cursor-pointer border-none ${
              status === s
                ? 'bg-[var(--accent)] text-[var(--bg-primary)] font-bold'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* PR List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-sm animate-pulse" style={{ color: 'var(--text-secondary)' }}>
            Loading…
          </div>
        ) : prs.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>
            No {status} pull requests.
          </div>
        ) : (
          prs.map((pr) => (
            <div
              key={pr.id}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold text-[var(--accent)]">
                      {pr.proposed_term}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {pr.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                    → {pr.proposed_meaning}
                  </div>
                  <div className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                    Leap: {pr.proposed_leap}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <span>by @{pr.author_username || 'unknown'}</span>
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>▲ {pr.upvotes}</span>
                    <span className="font-semibold" style={{ color: 'var(--danger)' }}>▼ {pr.downvotes}</span>
                    <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions for pending PRs */}
                {status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleAction(pr.id, 'approve')} className="btn btn-ghost" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                      Merge
                    </button>
                    <button onClick={() => handleAction(pr.id, 'reject')} className="btn btn-ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Reject
                    </button>
                  </div>
                )}

                {status !== 'pending' && (
                  <div className="text-xs font-bold uppercase px-3 py-1.5 rounded-full"
                    style={status === 'approved'
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                      : { background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }
                    }>
                    {status}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-ghost disabled:opacity-30">← Prev</button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-ghost disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}
