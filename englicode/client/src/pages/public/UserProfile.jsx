import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';

const rankMeta = {
  Analog:       { color: 'var(--text-secondary)', icon: '○', tier: 0 },
  'Read-Only':  { color: 'var(--info)',            icon: '◇', tier: 1 },
  'Dual-Core':  { color: 'var(--accent)',          icon: '◆', tier: 2 },
  Overclocked:  { color: 'var(--warning)',         icon: '⚡', tier: 3 },
  Admin:        { color: 'var(--danger)',           icon: '★', tier: 4 },
};

export default function UserProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/users/${username}`)
      .then((r) => setProfile(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'User not found'))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading)
    return (
      <div className="text-center py-32 text-sm animate-pulse" style={{ color: 'var(--text-secondary)' }}>
        Loading profile…
      </div>
    );

  if (error)
    return (
      <div className="text-center py-32">
        <div className="text-4xl mb-4">?</div>
        <div className="text-base mb-4" style={{ color: 'var(--danger)' }}>{error}</div>
        <Link to="/leaderboard" className="text-sm no-underline" style={{ color: 'var(--accent)' }}>
          ← Leaderboard
        </Link>
      </div>
    );

  const meta = rankMeta[profile.rank_title] || rankMeta.Analog;

  const thresholds = [0, 500, 2000, 5000, 10000];
  const currentThreshold = thresholds[meta.tier] || 0;
  const nextThreshold = thresholds[meta.tier + 1] || null;
  const pct = nextThreshold
    ? Math.min(100, ((profile.points - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
    : 100;

  return (
    <div className="max-w-xl mx-auto px-5 py-12">
      {/* Card */}
      <div className="rounded-xl p-8 text-center shadow-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Avatar */}
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-24 h-24 rounded-full mx-auto mb-5 border-4"
            style={{ borderColor: meta.color }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center text-4xl border-4"
            style={{ borderColor: meta.color, background: 'var(--bg-tertiary)', color: meta.color }}
          >
            {meta.icon}
          </div>
        )}

        {/* Username */}
        <h1 className="text-2xl font-bold tracking-wide mb-2" style={{ color: 'var(--text-primary)' }}>{profile.username}</h1>

        {/* Rank badge */}
        <div
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold mb-6"
          style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)` }}
        >
          <span>{meta.icon}</span>
          <span>{profile.rank_title}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-bold font-mono mb-0.5" style={{ color: 'var(--accent)' }}>
              {(profile.points || 0).toLocaleString()}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Points</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            <div className="text-2xl font-bold font-mono mb-0.5" style={{ color: 'var(--text-primary)' }}>
              {meta.tier}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tier</div>
          </div>
        </div>

        {/* Rank progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            <span>{profile.rank_title}</span>
            <span>{nextThreshold ? `Next rank: ${nextThreshold.toLocaleString()} pts` : 'Max rank'}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: meta.color }}
            />
          </div>
        </div>

        {/* Member since */}
        {profile.member_since && (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Member since {new Date(profile.member_since).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link to="/leaderboard" className="text-sm no-underline" style={{ color: 'var(--accent)' }}>
          ← View Leaderboard
        </Link>
      </div>
    </div>
  );
}
