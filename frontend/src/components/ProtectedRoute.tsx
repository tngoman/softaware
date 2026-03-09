import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { API_BASE_URL } from '../services/api';
import axios from 'axios';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, setUser, setIsAuthenticated } = useAppStore();
  const [recovering, setRecovering] = useState(!isAuthenticated);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // If already authenticated, nothing to do
    if (isAuthenticated) {
      setRecovering(false);
      return;
    }

    // Attempt to restore session from HTTP-only cookie
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/session`, {
          withCredentials: true,
        });
        if (cancelled) return;

        const { token, user } = res.data.data;
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setIsAuthenticated(true);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setRecovering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, setUser, setIsAuthenticated]);

  // Show nothing while trying to recover from cookie
  if (recovering) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-3 border-blue-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && failed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
