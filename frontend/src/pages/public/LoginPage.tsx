import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';
import { useAppSettings } from '../../hooks/useAppSettings';

/**
 * Public Login Page — Light theme matching frontend design patterns
 * Uses AuthModel for authentication and Zustand store for state.
 */
const PublicLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated, isAuthenticated, user } = useAppStore();
  const { logoUrl, siteName } = useAppSettings();

  // 2FA state
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState<'totp' | 'email' | 'sms'>('totp');
  const [twoFaTempToken, setTwoFaTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaVerifying, setTwoFaVerifying] = useState(false);
  const [twoFaResending, setTwoFaResending] = useState(false);

  // Push-to-approve state
  const [challengeId, setChallengeId] = useState('');
  const [pushStatus, setPushStatus] = useState<'' | 'waiting' | 'denied' | 'expired'>('');
  const [showManualCode, setShowManualCode] = useState(false);
  const [sendingAltOtp, setSendingAltOtp] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthModel.login(email, password);

      if (response.success) {
        // Check if 2FA is required
        if (response.data.requires_2fa) {
          setTwoFaRequired(true);
          setTwoFaMethod((response.data.two_factor_method as 'totp' | 'email' | 'sms') || 'totp');
          setTwoFaTempToken(response.data.temp_token || '');
          setChallengeId(response.data.challenge_id || '');
          setPushStatus(response.data.challenge_id ? 'waiting' : '');
          setShowManualCode(false);
          setTwoFaCode('');
          setIsLoading(false);
          return;
        }

        const { token, user: userData } = response.data;

        // Store auth token and user data
        AuthModel.storeAuth(token, userData);

        // Fetch user permissions
        try {
          const permissions = await AuthModel.getUserPermissions();
          userData.permissions = permissions;
        } catch (permError) {
          console.warn('Failed to fetch permissions:', permError);
          userData.permissions = [];
        }

        // Update localStorage with user including permissions
        AuthModel.storeAuth(token, userData);

        // Update Zustand store
        setUser(userData);
        setIsAuthenticated(true);

        // Navigate to dashboard
        await new Promise((resolve) => setTimeout(resolve, 100));
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || 'Invalid email or password';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 2FA handlers ────────────────────────────────────────────
  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaCode || twoFaCode.length < 6) { setError('Please enter the 6-digit verification code.'); return; }
    setTwoFaVerifying(true);
    setError('');
    try {
      const result = await AuthModel.verify2FA(twoFaTempToken, twoFaCode);
      if (result.success) {
        const { token, user: userData } = result.data;
        AuthModel.storeAuth(token, userData);
        try { const perms = await AuthModel.getUserPermissions(); userData.permissions = perms; } catch { userData.permissions = []; }
        AuthModel.storeAuth(token, userData);
        setUser(userData);
        setIsAuthenticated(true);
        await new Promise(r => setTimeout(r, 100));
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code.');
    } finally { setTwoFaVerifying(false); }
  };

  const handleResendOtp = async () => {
    setTwoFaResending(true);
    try {
      await AuthModel.resend2FAOtp(twoFaTempToken);
      setTwoFaCode('');
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally { setTwoFaResending(false); }
  };

  const resetToLogin = () => {
    setTwoFaRequired(false);
    setTwoFaCode('');
    setChallengeId('');
    setPushStatus('');
    setShowManualCode(false);
    setError('');
  };

  // Switch to an alternative OTP method (email or sms)
  const handleSendAltOtp = async (method: 'email' | 'sms') => {
    setSendingAltOtp(true);
    setError('');
    try {
      await AuthModel.sendAltOtp(twoFaTempToken, method);
      setTwoFaMethod(method);
      setShowManualCode(true);
      setTwoFaCode('');
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to send ${method} verification code.`);
    } finally {
      setSendingAltOtp(false);
    }
  };

  // Push-to-approve polling
  useEffect(() => {
    if (!twoFaRequired || !challengeId || !twoFaTempToken || showManualCode) return;
    if (pushStatus === 'denied' || pushStatus === 'expired') return;

    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, 3000));
        if (cancelled) break;
        try {
          const result = await AuthModel.pollPushStatus(twoFaTempToken, challengeId);
          if (cancelled) break;
          if (result.status === 'completed' && result.token && result.user) {
            AuthModel.storeAuth(result.token, result.user);
            try { const perms = await AuthModel.getUserPermissions(); result.user.permissions = perms; } catch { result.user.permissions = []; }
            AuthModel.storeAuth(result.token, result.user);
            setUser(result.user);
            setIsAuthenticated(true);
            await new Promise(r => setTimeout(r, 100));
            navigate('/dashboard');
            break;
          } else if (result.status === 'denied') { setPushStatus('denied'); break; }
          else if (result.status === 'expired' || result.status === 'not_found') { setPushStatus('expired'); break; }
        } catch (err) { console.warn('[Push] Poll error:', err); }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [twoFaRequired, challengeId, twoFaTempToken, showManualCode, pushStatus, navigate, setUser, setIsAuthenticated]);

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
          <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {twoFaRequired ? (
            <div className="space-y-5">
              {/* ── Push-to-approve waiting screen ── */}
              {challengeId && twoFaMethod === 'totp' && !showManualCode ? (
                <>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Approve Sign-In</h2>
                    <p className="text-sm text-gray-500">
                      A notification has been sent to your SoftAware mobile app.
                    </p>
                  </div>

                  {pushStatus === 'denied' ? (
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm text-red-600 font-medium">Sign-in was denied from your mobile app.</p>
                      <button onClick={resetToLogin} className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium">
                        Try Again
                      </button>
                    </div>
                  ) : pushStatus === 'expired' ? (
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                          <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm text-amber-600 font-medium">The approval request has expired.</p>
                      <button onClick={resetToLogin} className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium">
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="animate-pulse">
                          <div className="w-16 h-16 rounded-full bg-picton-blue/10 flex items-center justify-center">
                            <svg className="h-8 w-8 text-picton-blue" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">Open the app and tap <strong>"Approve"</strong> to sign in.</p>
                      <p className="text-xs text-gray-400 animate-pulse">Waiting for approval…</p>
                    </div>
                  )}

                  {pushStatus !== 'denied' && pushStatus !== 'expired' && (
                    <div className="border-t border-slate-200 pt-4 space-y-2 text-center">
                      <p className="text-xs text-gray-400 mb-2">Or use an alternative method:</p>
                      <button
                        onClick={() => handleSendAltOtp('email')}
                        disabled={sendingAltOtp}
                        className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium transition-colors disabled:opacity-50 block w-full"
                      >
                        {sendingAltOtp ? 'Sending...' : '📧 Email me a code'}
                      </button>
                      <button
                        onClick={() => handleSendAltOtp('sms')}
                        disabled={sendingAltOtp}
                        className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium transition-colors disabled:opacity-50 block w-full"
                      >
                        {sendingAltOtp ? 'Sending...' : '📱 Text me a code'}
                      </button>
                      <button
                        onClick={() => setShowManualCode(true)}
                        className="text-sm text-gray-500 hover:text-picton-blue font-medium transition-colors block w-full"
                      >
                        🔑 Enter backup code
                      </button>
                    </div>
                  )}

                  <div className="text-center">
                    <button onClick={resetToLogin} className="text-sm text-gray-500 hover:text-gray-700">
                      ← Back to Sign In
                    </button>
                  </div>
                </>
              ) : (
                /* ── Manual code entry ── */
                <>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Two-Factor Authentication</h2>
                    <p className="text-sm text-gray-500">
                      {twoFaMethod === 'totp' && 'Enter the code from your authenticator app or a backup code.'}
                      {twoFaMethod === 'email' && 'A verification code has been sent to your email.'}
                      {twoFaMethod === 'sms' && 'A verification code has been sent to your phone.'}
                    </p>
                  </div>
                  <form onSubmit={handle2FAVerify} className="space-y-4">
                    <div>
                      <label htmlFor="twofa-code" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Verification Code
                      </label>
                      <input
                        id="twofa-code"
                        type="text"
                        maxLength={8}
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value.replace(/\s/g, ''))}
                        className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                        placeholder="000000"
                        autoFocus
                        autoComplete="one-time-code"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={twoFaVerifying || twoFaCode.length < 6}
                      className="w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {twoFaVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                  </form>
                  {(twoFaMethod === 'email' || twoFaMethod === 'sms') && (
                    <div className="text-center">
                      <button onClick={handleResendOtp} disabled={twoFaResending} className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium disabled:opacity-50">
                        {twoFaResending ? 'Sending...' : 'Resend verification code'}
                      </button>
                    </div>
                  )}
                  {/* Alternative methods — show the other 2 methods */}
                  <div className="border-t border-slate-200 pt-3 space-y-2 text-center">
                    <p className="text-xs text-gray-400 mb-1">Or use an alternative method:</p>
                    {twoFaMethod !== 'email' && (
                      <button
                        onClick={() => handleSendAltOtp('email')}
                        disabled={sendingAltOtp}
                        className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium disabled:opacity-50 block w-full"
                      >
                        {sendingAltOtp ? 'Sending...' : '📧 Email me a code'}
                      </button>
                    )}
                    {twoFaMethod !== 'sms' && (
                      <button
                        onClick={() => handleSendAltOtp('sms')}
                        disabled={sendingAltOtp}
                        className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium disabled:opacity-50 block w-full"
                      >
                        {sendingAltOtp ? 'Sending...' : '📱 Text me a code'}
                      </button>
                    )}
                    {twoFaMethod !== 'totp' && (
                      <button
                        onClick={() => { setTwoFaMethod('totp'); setTwoFaCode(''); }}
                        className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium block w-full"
                      >
                        🔐 Use authenticator app
                      </button>
                    )}
                  </div>
                  {challengeId && twoFaMethod === 'totp' && (
                    <div className="text-center">
                      <button onClick={() => { setShowManualCode(false); setPushStatus('waiting'); }} className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium">
                        ← Back to push approval
                      </button>
                    </div>
                  )}
                  <div className="text-center">
                    <button onClick={resetToLogin} className="text-sm text-gray-500 hover:text-gray-700">
                      ← Back to Sign In
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Enter your email"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-picton-blue hover:text-picton-blue/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-gray-500 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-picton-blue hover:text-picton-blue/80 font-medium transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default PublicLoginPage;
