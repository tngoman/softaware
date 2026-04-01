import { useEffect, useState } from 'react';
import api from '../../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [dictRes, prRes, leaderRes] = await Promise.all([
          api.get('/index/categories'),
          api.get('/pull-requests?status=pending&limit=1'),
          api.get('/leaderboard?limit=5'),
        ]);

        const categories = dictRes.data.data;
        const totalTerms = categories.reduce((sum, c) => sum + parseInt(c.count), 0);

        setStats({
          categories,
          totalTerms,
          pendingPRs: prRes.data.data.total,
          topUsers: leaderRes.data.data,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm animate-pulse" style={{ color: 'var(--text-secondary)' }}>
          Loading dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Dashboard
        </h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Real-time platform overview
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Canon Terms" value={stats?.totalTerms ?? 0} color="var(--accent)" />
        <StatCard label="Pending PRs" value={stats?.pendingPRs ?? 0} color={stats?.pendingPRs > 0 ? 'var(--warning)' : 'var(--text-primary)'} />
        <StatCard label="Categories" value={stats?.categories?.length ?? 0} color="var(--text-primary)" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            Dictionary Breakdown
          </h2>
          <div className="flex flex-col gap-2.5">
            {stats?.categories?.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {cat.category.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            Top Processors
          </h2>
          <div className="flex flex-col gap-3">
            {stats?.topUsers?.map((u) => (
              <div key={u.position} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono w-5" style={{ color: 'var(--text-muted)' }}>#{u.position}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{u.rank_title}</span>
                  <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>
                    {(u.points || 0).toLocaleString()} pts
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.topUsers || stats.topUsers.length === 0) && (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No users yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div className="text-4xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
