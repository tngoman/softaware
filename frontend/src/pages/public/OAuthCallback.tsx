import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';

/**
 * OAuthCallback — handles the redirect back from Google OAuth.
 * The backend redirects here with ?token=<jwt> after successful Google login.
 * This page stores the token, fetches the user profile, and redirects to /dashboard.
 */
const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAppStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No authentication token received. Please try signing in again.');
      return;
    }

    // Store the token and fetch the user profile
    (async () => {
      try {
        // Store token temporarily so /auth/me request includes it
        localStorage.setItem('jwt_token', token);

        // Fetch full user profile from backend
        const { user } = await AuthModel.me();

        // Persist auth
        AuthModel.storeAuth(token, user);

        // Fetch permissions
        try {
          const permissions = await AuthModel.getUserPermissions();
          user.permissions = permissions;
          AuthModel.storeAuth(token, user);
        } catch {
          user.permissions = [];
        }

        if (user.email) {
          AuthModel.setLastEmail(user.email);
        }

        setUser(user);
        setIsAuthenticated(true);

        // Small delay to let state propagate, then navigate
        await new Promise((r) => setTimeout(r, 100));
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        console.error('[OAuthCallback] Failed to complete login:', err);
        localStorage.removeItem('jwt_token');
        setError('Failed to complete sign-in. Please try again.');
      }
    })();
  }, [searchParams, navigate, setUser, setIsAuthenticated]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Sign-in Failed</h1>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-6 py-2.5 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while we process the token
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-picton-blue/10 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-picton-blue" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Completing Sign-In</h1>
          <p className="text-gray-500 text-sm">Please wait while we set up your session…</p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
