import { Navigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

/**
 * Wraps admin routes — redirects to /terminal/login if not authenticated
 * or if the user isn't an admin (rank_tier < 4).
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="text-[var(--accent)] animate-pulse text-sm tracking-widest">
          INITIALIZING TERMINAL...
        </div>
      </div>
    );
  }

  if (!user || user.rank_tier < 4) {
    return <Navigate to="/terminal/login" replace />;
  }

  return children;
}
