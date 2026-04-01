import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

export default function TerminalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { adminLogin, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await adminLogin(email, password);
    setSubmitting(false);
    if (ok) navigate('/terminal');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
            ENGLICODE
          </h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            Terminal Access · Admin Only
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-8 flex flex-col gap-5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {error && (
            <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(224,16,58,0.1)', border: '1px solid rgba(224,16,58,0.3)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@englicode.local"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary mt-1"
            style={{ fontSize: '14px', letterSpacing: '0.08em' }}
          >
            {submitting ? 'Connecting…' : 'Access Terminal'}
          </button>

          <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Unauthorized access is logged and traced.
          </div>
        </form>
      </div>
    </div>
  );
}
