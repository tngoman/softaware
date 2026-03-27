import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import { useAppStore } from '../../store';
import { getApiBaseUrl, getAssetUrl } from '../../config/app';
import { notify } from '../../utils/notify';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated, isAuthenticated } = useAppStore();
  const [siteLogo, setSiteLogo] = useState('');
  const [siteName, setSiteName] = useState('SoftAware Billing');
  const [siteDescription, setSiteDescription] = useState('Sign in to continue.');

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

  // Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    try {
      const cachedBranding = localStorage.getItem('app_branding');
      if (cachedBranding) {
        const { logoUrl, name, description } = JSON.parse(cachedBranding);
        if (logoUrl) {
          setSiteLogo(logoUrl);
        }
        if (name) {
          setSiteName(name);
        }
        if (description) {
          setSiteDescription(description);
        }
      }
    } catch (error) {
      console.warn('Failed to load cached branding:', error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      return;
    }

    const loadSettings = async () => {
      try {
        const settings = await AppSettingsModel.get();
        const baseUrl = settings.site_base_url || getApiBaseUrl();

        if (settings.site_logo) {
          setSiteLogo(getAssetUrl(`/assets/images/${settings.site_logo}`));
        }

        if (settings.site_name) {
          setSiteName(settings.site_name);
        }

        if (settings.site_description) {
          setSiteDescription(settings.site_description);
        }

        if (settings.site_title || settings.site_name) {
          document.title = settings.site_title || settings.site_name;
        }
      } catch (error) {
        console.error('Failed to load application settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      notify.warning('Please enter both email and password');
      return;
    }

    // Auto-append @softaware.co.za if input is not an email address
    let finalEmail = email.trim();
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@softaware.co.za`;
    }

    setLoading(true);

    try {
      const response = await AuthModel.login(finalEmail, password);
      
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
          setLoading(false);
          return;
        }

        // API returns nested data: response.data contains token and user
        const { token, user } = response.data;
        
        // Store token first so subsequent API calls are authenticated
        AuthModel.storeAuth(token, user);
        
        // Fetch user permissions (now that token is stored)
        try {
          const permissions = await AuthModel.getUserPermissions();
          user.permissions = permissions;
        } catch (permError) {
          console.warn('Failed to fetch permissions:', permError);
          user.permissions = [];
        }
        
        // Update localStorage with user including permissions
        AuthModel.storeAuth(token, user);
        
        // Update store - this triggers UI re-render
        setUser(user);
        setIsAuthenticated(true);
        
        // Small delay to ensure state propagates before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaCode || twoFaCode.length < 6) {
      notify.warning('Please enter the 6-digit verification code.');
      return;
    }
    setTwoFaVerifying(true);
    try {
      const result = await AuthModel.verify2FA(twoFaTempToken, twoFaCode);
      if (result.success) {
        const { token, user } = result.data;
        AuthModel.storeAuth(token, user);
        try {
          const permissions = await AuthModel.getUserPermissions();
          user.permissions = permissions;
        } catch {
          user.permissions = [];
        }
        AuthModel.storeAuth(token, user);
        setUser(user);
        setIsAuthenticated(true);
        await new Promise(r => setTimeout(r, 100));
        navigate('/dashboard');
      }
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Invalid verification code.');
    } finally {
      setTwoFaVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setTwoFaResending(true);
    try {
      await AuthModel.resend2FAOtp(twoFaTempToken);
      setTwoFaCode('');
      notify.success('A new verification code has been sent. Please enter the new code.');
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setTwoFaResending(false);
    }
  };

  // Switch to an alternative OTP method (email or sms)
  const handleSendAltOtp = async (method: 'email' | 'sms') => {
    setSendingAltOtp(true);
    try {
      await AuthModel.sendAltOtp(twoFaTempToken, method);
      setTwoFaMethod(method);
      setShowManualCode(true);
      setTwoFaCode('');
      notify.success(method === 'email'
        ? 'A verification code has been sent to your email.'
        : 'A verification code has been sent to your phone.');
    } catch (err: any) {
      notify.error(err.response?.data?.message || `Failed to send ${method} verification code.`);
    } finally {
      setSendingAltOtp(false);
    }
  };

  // ── Push-to-approve polling ──────────────────────────────────
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
            try {
              const perms = await AuthModel.getUserPermissions();
              result.user.permissions = perms;
            } catch { result.user.permissions = []; }
            AuthModel.storeAuth(result.token, result.user);
            setUser(result.user);
            setIsAuthenticated(true);
            await new Promise(r => setTimeout(r, 100));
            navigate('/dashboard');
            break;
          } else if (result.status === 'denied') {
            setPushStatus('denied');
            break;
          } else if (result.status === 'expired' || result.status === 'not_found') {
            setPushStatus('expired');
            break;
          }
        } catch (err) {
          console.warn('[Push] Poll error:', err);
        }
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [twoFaRequired, challengeId, twoFaTempToken, showManualCode, pushStatus, navigate, setUser, setIsAuthenticated]);

  // Helper to reset back to the login form
  const resetToLogin = () => {
    setTwoFaRequired(false);
    setTwoFaCode('');
    setChallengeId('');
    setPushStatus('');
    setShowManualCode(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
          <div className="bg-white px-8 py-8 flex flex-col items-center gap-3 border-b border-slate-200">
            <div className="h-16 flex items-center justify-center">
              <img
                src={siteLogo || '/images/logo_small.png'}
                alt={siteName}
                className="max-h-16 w-auto object-contain"
                onError={(event) => {
                  console.error('Logo failed to load:', siteLogo);
                  (event.target as HTMLImageElement).style.display = 'none';
                  const fallback = (event.target as HTMLImageElement).nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            </div>
            <div className="hidden items-center justify-center h-12 w-12 rounded-full bg-slate-100 border border-slate-200">
              <span className="text-xl font-semibold text-gray-700">{siteName.charAt(0)}</span>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">
                {siteDescription || 'Sign in to continue.'}
              </p>
            </div>
          </div>

          <div className="px-8 py-6">
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

                    {/* Alternative authentication fallback links */}
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
                  /* ── Manual code entry (email / sms / totp fallback) ── */
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
                          className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                          placeholder="000000"
                          autoFocus
                          autoComplete="one-time-code"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={twoFaVerifying || twoFaCode.length < 6}
                        className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                    {/* Link back to push screen if challenge exists */}
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
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                  placeholder="you@youremail.com"
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-picton-blue focus:ring-picton-blue border-slate-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <a href="/forgot-password" className="text-sm font-medium text-picton-blue hover:text-picton-blue/80">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* Google OAuth Divider + Button */}
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setGoogleLoading(true);
                  try {
                    const url = await AuthModel.getGoogleAuthUrl();
                    window.location.href = url;
                  } catch {
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading}
                className="w-full flex justify-center items-center px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors gap-3"
              >
                {googleLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
              </button>
            </form>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {siteName}.
        </p>
      </div>
    </div>
  );
};

export default Login;
