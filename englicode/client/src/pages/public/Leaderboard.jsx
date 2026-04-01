import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

const rankMeta = {
  Analog:       { color: 'var(--text-secondary)', icon: '○' },
  'Read-Only':  { color: 'var(--info)',            icon: '◇' },
  'Dual-Core':  { color: 'var(--accent)',          icon: '◆' },
  Overclocked:  { color: 'var(--warning)',         icon: '⚡' },
  Admin:        { color: 'var(--danger)',           icon: '★' },
};

const medals = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/leaderboard')
      .then((r) => setUsers(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Leaderboard</h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Processing Speed rankings — highest cognitive bandwidth first.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-base animate-pulse" style={{ color: 'var(--text-secondary)' }}>
          Loading leaderboard…
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-base" style={{ color: 'var(--text-secondary)' }}>
          No ranked users yet. Be the first to take a quiz!
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u, i) => {
            const meta = rankMeta[u.rank_title] || rankMeta.Analog;
            return (
              <Link
                key={u.id || i}
                to={`/u/${u.username}`}
                className="flex items-center gap-4 rounded-xl px-5 py-4 no-underline transition-all"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Position */}
                <div className="w-8 text-center shrink-0">
                  {i < 3
                    ? <span className="text-xl">{medals[i]}</span>
                    : <span className="text-base font-bold font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                  }
                </div>

                {/* Avatar */}
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--bg-tertiary)', color: meta.color }}>
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{u.username}</div>
                  <div className="text-sm" style={{ color: meta.color }}>
                    {meta.icon} {u.rank_title}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>
                    {(u.points || 0).toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>pts</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
