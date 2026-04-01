import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

const navItems = [
  { to: '/terminal',               label: 'Dashboard',    icon: '◈', end: true },
  { to: '/terminal/index',         label: 'Index',        icon: '◇', end: false },
  { to: '/terminal/pull-requests', label: 'Pull Requests',icon: '◆', end: false },
  { to: '/terminal/users',         label: 'Users',        icon: '○', end: false },
];

export default function TerminalLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/terminal/login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Sidebar ─── */}
      <aside className="w-60 flex flex-col shrink-0" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
        {/* Brand */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-black tracking-widest text-base" style={{ color: 'var(--accent)' }}>ENGLICODE</div>
          <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>TERMINAL v1.0</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors no-underline border-r-2 ${
                  isActive ? 'border-r-[var(--accent)]' : 'border-r-transparent'
                }`
              }
              style={({ isActive }) => isActive
                ? { color: 'var(--accent)', background: 'var(--accent-dim)', borderRightColor: 'var(--accent)' }
                : { color: 'var(--text-secondary)' }
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{user?.username}</div>
          <div className="text-xs mb-3" style={{ color: 'var(--accent)' }}>{user?.rank_title} · Tier {user?.rank_tier}</div>
          <button
            onClick={handleLogout}
            className="text-xs font-medium cursor-pointer bg-transparent border-none p-0"
            style={{ color: 'var(--danger)' }}
          >
            Disconnect →
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
