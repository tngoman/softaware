import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import Logo from '../../assets/logo.png';
import useAuthStore from '../../stores/authStore';

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/protocols', label: 'Protocols' },
  { to: '/training', label: 'Training' },
  { to: '/quiz', label: 'Quiz' },
  { to: '/consensus', label: 'Consensus' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

function ThemeToggle() {
  const [light, setLight] = useState(() =>
    document.documentElement.classList.contains('light')
  );

  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) {
      document.documentElement.classList.add('light');
      localStorage.setItem('englicode_theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('englicode_theme', 'dark');
    }
  };

  return (
    <button
      onClick={toggle}
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
      className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors cursor-pointer bg-transparent text-base"
    >
      {light ? '🌙' : '☀️'}
    </button>
  );
}

export default function PublicLayout() {
  const { user, logout, impersonating, stopImpersonating } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ─── Impersonation Banner ─── */}
      {impersonating && user && (
        <div style={{ background: 'var(--warning)', color: 'var(--bg-primary)' }} className="text-center py-2 text-xs font-bold tracking-widest z-50">
          <span className="mr-2">⚡ VIEWING AS: {user.username} ({user.rank_title})</span>
          <button
            onClick={stopImpersonating}
            className="ml-2 px-3 py-0.5 rounded text-xs font-bold cursor-pointer border-none transition-colors"
            style={{ background: 'var(--bg-primary)', color: 'var(--warning)' }}
          >
            EXIT
          </button>
        </div>
      )}

      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-5 h-15 flex items-center justify-between gap-4" style={{ height: '60px' }}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
            <img src={Logo} alt="Englicode" className="h-11" style={{ objectFit: 'contain' }} />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-md text-sm font-medium transition-colors no-underline ${
                    isActive
                      ? 'font-semibold'
                      : ''
                  }`
                }
                style={({ isActive }) => isActive
                  ? { color: 'var(--accent)', background: 'var(--accent-dim)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            {user ? (
              <>
                <Link
                  to={`/u/${user.username}`}
                  className="flex items-center gap-2 no-underline px-2 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    : <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{user.username?.[0]?.toUpperCase()}</span>
                  }
                  <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>{user.username}</span>
                  <span className="text-xs font-semibold hidden sm:block" style={{ color: 'var(--accent)' }}>{user.rank_title}</span>
                </Link>
                <Link
                  to="/settings"
                  className="text-xs font-medium no-underline px-2.5 py-1.5 rounded-md border transition-colors hidden sm:block"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  Settings
                </Link>
                <button
                  onClick={logout}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer bg-transparent hidden sm:block"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/api/auth/google"
                  className="px-3.5 py-1.5 rounded-md border text-sm font-medium no-underline transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                >
                  Sign in with Google
                </a>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-md border cursor-pointer bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <nav className="md:hidden border-t px-4 py-3 flex flex-col gap-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors ${isActive ? 'font-semibold' : ''}`
                }
                style={({ isActive }) => isActive
                  ? { color: 'var(--accent)', background: 'var(--accent-dim)' }
                  : { color: 'var(--text-secondary)' }
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <>
                <Link to="/settings" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md text-sm font-medium no-underline" style={{ color: 'var(--text-secondary)' }}>Settings</Link>
                <button onClick={() => { logout(); setMobileOpen(false); }} className="text-left px-3 py-2 rounded-md text-sm font-medium cursor-pointer bg-transparent border-none" style={{ color: 'var(--danger)' }}>Logout</button>
              </>
            )}
          </nav>
        )}
      </header>

      {/* ─── Content ─── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t mt-12" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <img src={Logo} alt="Englicode" className="h-12 mb-1" style={{ objectFit: 'contain' }} />
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>The Cognitive Gym — Train your brain to decode faster.</div>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Link to="/legal" className="hover:underline no-underline" style={{ color: 'var(--text-secondary)' }}>Legal</Link>
            <Link to="/about" className="hover:underline no-underline" style={{ color: 'var(--text-secondary)' }}>About</Link>
            <Link to="/protocols" className="hover:underline no-underline" style={{ color: 'var(--text-secondary)' }}>Protocols</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
