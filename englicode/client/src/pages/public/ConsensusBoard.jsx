import { useState, useEffect } from 'react';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';

const statusStyle = {
  pending:  { label: 'Pending',  color: 'var(--warning)' },
  approved: { label: 'Approved', color: 'var(--accent)'  },
  rejected: { label: 'Rejected', color: 'var(--danger)'  },
};

export default function ConsensusBoard() {
  const { user } = useAuthStore();
  const [prs, setPrs] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(null);

  const fetchPrs = async () => {
    setLoading(true);
    try {
      const r = await api.get('/pull-requests', { params: { status } });
      const payload = r.data.data || {};
      setPrs(Array.isArray(payload) ? payload : payload.pullRequests || []);
    } catch {
      setPrs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrs(); }, [status]);

  const castVote = async (prId, vote) => {
    setVoting(prId);
    try {
      await api.post(`/pull-requests/${prId}/vote`, { vote });
      await fetchPrs();
    } catch (e) {
      alert(e.response?.data?.message || 'Vote failed');
    } finally {
      setVoting(null);
    }
  };

  const canVote   = user && user.rank_tier >= 2;
  const canSubmit = user && user.rank_tier >= 3;

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Consensus Board</h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Community Pull Requests — propose new terms, vote on changes.
          </p>
        </div>
        {canSubmit && (
          <button
            onClick={() => document.getElementById('pr-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn btn-primary shrink-0"
          >
            + Submit PR
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg inline-flex" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
        {['pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className="px-4 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors border-none"
            style={status === s
              ? { background: 'var(--bg-secondary)', color: statusStyle[s].color, boxShadow: 'var(--shadow-sm)' }
              : { background: 'transparent', color: 'var(--text-secondary)' }
            }
          >
            {statusStyle[s].label}
          </button>
        ))}
      </div>

      {/* Info for guests */}
      {!user && (
        <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          Sign in and reach <strong style={{ color: 'var(--accent)' }}>Dual-Core</strong> rank to vote, or{' '}
          <strong style={{ color: 'var(--warning)' }}>Overclocked</strong> to submit new terms.
        </div>
      )}

      {/* PR list */}
      {loading ? (
        <div className="text-center py-20 text-base animate-pulse" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      ) : prs.length === 0 ? (
        <div className="text-center py-20 text-base" style={{ color: 'var(--text-secondary)' }}>
          No {status} pull requests.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {prs.map((pr) => (
            <PullRequestCard key={pr.id} pr={pr} canVote={canVote} voting={voting} castVote={castVote} />
          ))}
        </div>
      )}

      {canSubmit && <SubmitPRForm onSubmitted={fetchPrs} />}
    </div>
  );
}

function PullRequestCard({ pr, canVote, voting, castVote }) {
  const st = statusStyle[pr.status] || statusStyle.pending;

  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-bold" style={{ color: 'var(--accent)' }}>{pr.proposed_term}</span>
          <span className="badge text-xs px-2 py-0.5 rounded-full" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>
            {st.label}
          </span>
        </div>
        <span className="text-sm shrink-0" style={{ color: 'var(--text-secondary)' }}>by {pr.author_username || 'anon'}</span>
      </div>

      <div className="flex flex-col gap-1 text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {pr.proposed_meaning && <div><span style={{ color: 'var(--accent)' }}>→</span> {pr.proposed_meaning}</div>}
        {pr.category && <div>Category: <span style={{ color: 'var(--text-primary)' }}>{pr.category}</span></div>}
        {pr.proposed_leap && <div className="leading-relaxed">{pr.proposed_leap}</div>}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span style={{ color: 'var(--accent)' }}>▲ {pr.upvotes ?? 0}</span>
          <span style={{ color: 'var(--danger)' }}>▼ {pr.downvotes ?? 0}</span>
        </div>

        {canVote && pr.status === 'pending' && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => castVote(pr.id, 'up')}
              disabled={voting === pr.id}
              className="px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50 border"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              ▲ Upvote
            </button>
            <button
              onClick={() => castVote(pr.id, 'down')}
              disabled={voting === pr.id}
              className="px-3 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50 border"
              style={{ background: 'rgba(224,16,58,0.08)', color: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              ▼ Downvote
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitPRForm({ onSubmitted }) {
  const [form, setForm] = useState({
    proposed_term: '', standard_english: '', category: '',
    definition: '', usage_example: '', time_index: '', data_deca: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...form };
      if (payload.time_index) payload.time_index = parseInt(payload.time_index);
      if (payload.data_deca) payload.data_deca = parseInt(payload.data_deca);
      await api.post('/pull-requests', payload);
      setForm({ proposed_term: '', standard_english: '', category: '', definition: '', usage_example: '', time_index: '', data_deca: '' });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div id="pr-form" className="mt-10 rounded-xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Submit a Pull Request</h2>

      {error && (
        <div className="mb-4 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(224,16,58,0.1)', border: '1px solid rgba(224,16,58,0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Englicode Term *" value={form.proposed_term} onChange={set('proposed_term')} required />
          <input placeholder="Standard English *" value={form.standard_english} onChange={set('standard_english')} required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input placeholder="Category *" value={form.category} onChange={set('category')} required />
          <input placeholder="Time Index (1-7)" value={form.time_index} onChange={set('time_index')} />
          <input placeholder="Data-Deca (1,2,3,6,9)" value={form.data_deca} onChange={set('data_deca')} />
        </div>
        <textarea className="resize-none" rows={2} placeholder="Definition" value={form.definition} onChange={set('definition')} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '14px', width: '100%' }} />
        <input placeholder="Usage Example" value={form.usage_example} onChange={set('usage_example')} />
        <div className="flex items-center gap-2 mt-1">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Submitting…' : 'Submit PR'}
          </button>
        </div>
      </form>
    </div>
  );
}
