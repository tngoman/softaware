import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';

const RANK_TITLES = ['Analog', 'Read-Only', 'Dual-Core', 'Overclocked', 'Admin'];

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(null);
  const navigate = useNavigate();
  const impersonate = useAuthStore((s) => s.impersonate);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const { data } = await api.get('/leaderboard?limit=100');
        setUsers(data.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const handleImpersonate = async (user) => {
    setImpersonating(user.id);
    const ok = await impersonate(user.id);
    setImpersonating(null);
    if (ok) {
      navigate('/');
    }
  };

  const rankColor = (title) => {
    switch (title) {
      case 'Admin': return 'var(--danger)';
      case 'Overclocked': return 'var(--warning)';
      case 'Dual-Core': return 'var(--accent)';
      case 'Read-Only': return 'var(--info)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Users</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          All registered processors — ranked by bandwidth
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium w-12">#</th>
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">Username</th>
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">Rank</th>
              <th className="text-right px-4 py-3 uppercase tracking-widest font-medium">Points</th>
              <th className="text-right px-4 py-3 uppercase tracking-widest font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)] tracking-widest">
                  LOADING...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No users registered.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.position} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{u.position}</td>
                  <td className="px-4 py-3 font-semibold">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold" style={{ color: rankColor(u.rank_title) }}>
                      {u.rank_title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--accent)]">
                    {u.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleImpersonate(u)}
                      disabled={impersonating === u.id}
                      className="btn btn-ghost disabled:opacity-50"
                      style={{ color: 'var(--warning)', borderColor: 'var(--warning)', fontSize: '12px' }}>
                      {impersonating === u.id ? 'Loading…' : 'Login as'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
