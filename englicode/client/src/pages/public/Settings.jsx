import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import api from '../../lib/api';

export default function Settings() {
  const { user, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-5 py-16 text-center">
        <div className="text-base" style={{ color: 'var(--text-secondary)' }}>Please log in to access settings.</div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const updates = {};
    if (username.trim()) updates.username = username.trim();
    if (email.trim()) updates.email = email.trim();
    if (password.trim()) updates.password = password.trim();

    if (Object.keys(updates).length === 0) {
      setError('Please fill in at least one field to update.');
      setLoading(false);
      return;
    }

    try {
      await api.put('/users/me', updates);
      setSuccess('Profile updated successfully!');
      setUsername('');
      setEmail('');
      setPassword('');
      await fetchUser();
      if (updates.username) {
        setTimeout(() => navigate(`/u/${updates.username}`), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-5 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Profile Settings</h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Update your username, email, or password.
        </p>
      </div>

      {/* Current info */}
      <div className="rounded-lg p-4 mb-6 flex items-center gap-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
          {user.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</div>
          <div className="text-sm" style={{ color: 'var(--accent)' }}>{user.rank_title}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-6 flex flex-col gap-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Username */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            New Username <span className="font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={user.username}
            minLength={3}
            maxLength={20}
          />
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>3–20 characters</div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            New Email <span className="font-normal">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Leave blank to keep current"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            New Password <span className="font-normal">(optional)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            minLength={6}
          />
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Minimum 6 characters</div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(224,16,58,0.1)', border: '1px solid rgba(224,16,58,0.3)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(34,204,136,0.1)', border: '1px solid rgba(34,204,136,0.3)', color: 'var(--success)' }}>
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary mt-1"
          style={{ fontSize: '14px' }}
        >
          {loading ? 'Updating…' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
}
