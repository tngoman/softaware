import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAppSettings } from '../../hooks/useAppSettings';

/**
 * Account Activation Page — Light theme matching frontend design patterns
 * Uses the frontend API service to call POST /auth/activate.
 * Redirects to /login after successful activation.
 */
const ActivatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logoUrl, siteName } = useAppSettings();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('Invalid activation link. No token provided.');
      return;
    }

    const activateAccount = async () => {
      try {
        console.log('=== ACCOUNT ACTIVATION ===');
        console.log('Token:', token);
        console.log('Attempting to activate account...');

        // Handle demo tokens in development
        if (process.env.NODE_ENV === 'development' && token?.startsWith('demo-token-')) {
          console.log('Demo token detected — simulating successful activation');
          setStatus('success');
          setMessage('Account activated successfully! You can now sign in.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        const response = await api.post('/auth/activate', { token });

        if (response.data?.success) {
          setStatus('success');
          setMessage('Account activated successfully! You can now sign in.');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('error');
          setMessage(response.data?.message || 'Account activation failed. The link may be expired or invalid.');
        }
      } catch (err: any) {
        console.error('Activation error:', err);

        // In dev mode with demo token, treat as success
        if (process.env.NODE_ENV === 'development' && token?.startsWith('demo-token-')) {
          console.log('API failed but demo token detected — treating as successful activation');
          setStatus('success');
          setMessage('Account activated successfully! (Demo mode — API not available)');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('error');
          setMessage(
            err.response?.data?.message || 'Network error occurred. Please check your connection and try again.'
          );
        }
      }
    };

    activateAccount();
  }, [token, navigate]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return (
          <svg className="animate-spin w-8 h-8 text-picton-blue" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
      case 'invalid':
        return (
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-picton-blue';
      case 'success':
        return 'text-green-600';
      case 'error':
      case 'invalid':
        return 'text-red-600';
      default:
        return 'text-gray-900';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'loading':
        return 'Activating Your Account...';
      case 'success':
        return 'Account Activated!';
      case 'error':
        return 'Activation Failed';
      case 'invalid':
        return 'Invalid Link';
      default:
        return 'Account Activation';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 justify-center">
            {logoUrl && (
              <img src={logoUrl} alt={siteName} className="h-9 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
              {getStatusIcon()}
            </div>

            <h1 className={`text-2xl font-bold mb-4 ${getStatusColor()}`}>{getTitle()}</h1>

            <p className="text-gray-500 mb-8 text-sm leading-relaxed">{message}</p>

            {/* Development info */}
            {process.env.NODE_ENV === 'development' && token && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-gray-400 text-xs mb-2">Development Info:</p>
                <p className="text-gray-600 text-xs font-mono break-all">Token: {token}</p>
              </div>
            )}

            <div className="space-y-4">
              {status === 'success' && (
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-4">Redirecting to login in 3 seconds...</p>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-colors shadow-sm"
                  >
                    Continue to Login
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              )}

              {(status === 'error' || status === 'invalid') && (
                <div className="space-y-3">
                  <Link
                    to="/register"
                    className="block w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-colors text-center shadow-sm"
                  >
                    Create New Account
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-gray-700 font-semibold rounded-lg border border-slate-200 transition-colors text-center"
                  >
                    Back to Login
                  </Link>
                </div>
              )}

              {status === 'loading' && (
                <div className="text-center">
                  <p className="text-gray-500 text-sm">Please wait while we activate your account...</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ActivatePage;
