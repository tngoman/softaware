import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import ProtectedRoute from './components/ProtectedRoute';

// Public
import PublicLayout from './pages/public/PublicLayout';
import Home from './pages/public/Home';
import TrainingRoom from './pages/public/TrainingRoom';
import Quiz from './pages/public/Quiz';
import Leaderboard from './pages/public/Leaderboard';
import UserProfile from './pages/public/UserProfile';
import ConsensusBoard from './pages/public/ConsensusBoard';
import Legal from './pages/public/Legal';
import Protocols from './pages/public/Protocols';
import About from './pages/public/About';
import OAuthCallback from './pages/public/OAuthCallback';
import Settings from './pages/public/Settings';

// Terminal (Admin)
import TerminalLogin from './pages/terminal/TerminalLogin';
import TerminalLayout from './pages/terminal/TerminalLayout';
import Dashboard from './pages/terminal/Dashboard';
import DictionaryManager from './pages/terminal/DictionaryManager';
import PullRequests from './pages/terminal/PullRequests';
import UsersManager from './pages/terminal/UsersManager';

export default function App() {
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <Routes>
      {/* OAuth callback — no layout wrapper */}
      <Route path="/auth/callback" element={<OAuthCallback />} />

      {/* Public pages — shared navbar/footer */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/training" element={<TrainingRoom />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/about" element={<About />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/consensus" element={<ConsensusBoard />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/legal/:section" element={<Legal />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/u/:username" element={<UserProfile />} />
      </Route>

      {/* Admin Terminal */}
      <Route path="/terminal/login" element={<TerminalLogin />} />
      <Route
        path="/terminal"
        element={
          <ProtectedRoute>
            <TerminalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="index" element={<DictionaryManager />} />
        <Route path="pull-requests" element={<PullRequests />} />
        <Route path="users" element={<UsersManager />} />
      </Route>
    </Routes>
  );
}
