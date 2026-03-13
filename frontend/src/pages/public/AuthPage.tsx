import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';
import { useAppSettings } from '../../hooks/useAppSettings';
import { notify } from '../../utils/notify';
import {
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ChatBubbleLeftIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';

type AuthTab = 'login' | 'register';

/**
 * Unified Auth Page — modern tabbed login / registration.
 * Switches between sign-in and sign-up within one card.
 */
const AuthPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated, isAuthenticated, user } = useAppStore();
  const { logoUrl, siteName } = useAppSettings();

  // Determine initial tab from URL
  const initialTab: AuthTab = location.pathname === '/register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);

  // Sync tab with URL when navigating via browser back/forward
  useEffect(() => {
    const tab = location.pathname === '/register' ? 'register' : 'login';
    setActiveTab(tab);
  }, [location.pathname]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  // --- Login State ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- 2FA State ---
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState<'totp' | 'email' | 'sms'>('totp');
  const [twoFaTempToken, setTwoFaTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaVerifying, setTwoFaVerifying] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');
  const [twoFaResending, setTwoFaResending] = useState(false);
  const [sendingAltOtp, setSendingAltOtp] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [pushStatus, setPushStatus] = useState<'' | 'waiting' | 'denied' | 'expired'>('');
  const [showManualCode, setShowManualCode] = useState(false);

  // --- Register State ---
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', confirmPassword: '', company_name: '', phone: '', address: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regStep, setRegStep] = useState<'form' | 'confirmation'>('form');
  const [confirmationLink, setConfirmationLink] = useState('');

  // --- PIN Quick Login State ---
  const [pinMode, setPinMode] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [lastEmail, setLastEmail] = useState('');
  const [lastUserName, setLastUserName] = useState('');
  const [hasPinLogin, setHasPinLogin] = useState(false);
  const pinInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Check for returning user with PIN on mount
  useEffect(() => {
    const savedEmail = AuthModel.getLastEmail();
    const savedUser = localStorage.getItem('user');
    if (savedEmail) {
      setLastEmail(savedEmail);
      setLoginEmail(savedEmail);
      // Try to extract user name
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          setLastUserName(u.first_name || u.name || '');
        } catch { /* ignore */ }
      }
      // Check if this email has PIN login
      AuthModel.checkPinByEmail(savedEmail).then((result) => {
        if (result.has_pin) {
          setHasPinLogin(true);
          setPinMode(true);
        }
      }).catch(() => { /* ignore */ });
    }
  }, []);
  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setLoginError('');
    setRegError('');
    setPinError('');
    navigate(tab === 'login' ? '/login' : '/register', { replace: true });
  };

  // --- Shared login completion helper ---
  const completeLogin = useCallback(async (token: string, userData: any, email?: string) => {
    AuthModel.storeAuth(token, userData);
    try {
      const permissions = await AuthModel.getUserPermissions();
      userData.permissions = permissions;
    } catch {
      userData.permissions = [];
    }
    AuthModel.storeAuth(token, userData);
    if (email) AuthModel.setLastEmail(email);
    setUser(userData);
    setIsAuthenticated(true);
    await new Promise((r) => setTimeout(r, 100));
    navigate('/dashboard');
  }, [navigate, setUser, setIsAuthenticated]);

  // --- Shared 2FA required handler ---
  const handle2FARequired = useCallback((data: any) => {
    setTwoFaRequired(true);
    setTwoFaMethod((data.two_factor_method as 'totp' | 'email' | 'sms') || 'totp');
    setTwoFaTempToken(data.temp_token || '');
    setChallengeId(data.challenge_id || '');
    setPushStatus(data.challenge_id ? 'waiting' : '');
    setShowManualCode(false);
    setTwoFaError('');
    setTwoFaCode('');
  }, []);

  // --- PIN Login Handler ---
  const handlePinLogin = useCallback(async (digits: string[]) => {
    const pin = digits.join('');
    if (pin.length !== 4) return;

    setPinLoading(true);
    setPinError('');
    try {
      const response = await AuthModel.loginWithPin(lastEmail, pin);
      if (response.success) {
        if (response.data.requires_2fa) {
          handle2FARequired(response.data);
          return;
        }
        const { token, user: userData } = response.data;
        await completeLogin(token, userData, lastEmail);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid PIN';
      setPinError(msg);
      setPinDigits(['', '', '', '']);
      setTimeout(() => pinInputRefs[0]?.current?.focus(), 100);
    } finally {
      setPinLoading(false);
    }
  }, [lastEmail, completeLogin, handle2FARequired]);

  // --- PIN digit input handler ---
  const handlePinDigitInput = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    setPinDigits(newDigits);
    setPinError('');

    if (digit && index < 3) {
      pinInputRefs[index + 1]?.current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3 && newDigits.every(d => d !== '')) {
      handlePinLogin(newDigits);
    }
  }, [pinDigits, handlePinLogin]);

  const handlePinKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs[index - 1]?.current?.focus();
    }
  }, [pinDigits]);

  // --- Login Handler ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter both email and password');
      return;
    }

    // Auto-append @softaware.co.za if input is not an email address
    let finalEmail = loginEmail.trim();
    if (!finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@softaware.co.za`;
    }

    setLoginLoading(true);
    try {
      const response = await AuthModel.login(finalEmail, loginPassword);
      if (response.success) {
        // Check if 2FA is required
        if (response.data.requires_2fa) {
          AuthModel.setLastEmail(finalEmail);
          handle2FARequired(response.data);
          return;
        }

        const { token, user: userData } = response.data;
        await completeLogin(token, userData, finalEmail);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid email or password';
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // --- 2FA Verify Handler ---
  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFaCode || twoFaCode.length < 6) {
      setTwoFaError('Please enter the 6-digit verification code');
      return;
    }
    setTwoFaError('');
    setTwoFaVerifying(true);
    try {
      const result = await AuthModel.verify2FA(twoFaTempToken, twoFaCode);
      if (result.success) {
        const { token, user: userData } = result.data;
        await completeLogin(token, userData);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid verification code';
      setTwoFaError(msg);
    } finally {
      setTwoFaVerifying(false);
    }
  };

  // --- Resend OTP Handler ---
  const handleResendOtp = async () => {
    setTwoFaResending(true);
    try {
      await AuthModel.resend2FAOtp(twoFaTempToken);
      notify.success('A new verification code has been sent.');
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setTwoFaResending(false);
    }
  };

  // Switch to an alternative OTP method (email or sms)
  const handleSendAltOtp = async (method: 'email' | 'sms') => {
    setSendingAltOtp(true);
    setTwoFaError('');
    try {
      await AuthModel.sendAltOtp(twoFaTempToken, method);
      setTwoFaMethod(method);
      setTwoFaCode('');
      notify.success(method === 'email'
        ? 'A verification code has been sent to your email.'
        : 'A verification code has been sent to your phone.');
    } catch (err: any) {
      setTwoFaError(err.response?.data?.message || `Failed to send ${method} verification code.`);
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
            await completeLogin(result.token, result.user);
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
  }, [twoFaRequired, challengeId, twoFaTempToken, showManualCode, pushStatus, completeLogin]);

  const resetToLogin = () => {
    setTwoFaRequired(false);
    setTwoFaCode('');
    setTwoFaError('');
    setChallengeId('');
    setPushStatus('');
    setShowManualCode(false);
  };

  // --- Register Handler ---
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regForm.name || !regForm.email || !regForm.password) {
      setRegError('Please fill in all fields');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      setRegError('Passwords do not match');
      return;
    }
    if (regForm.password.length < 8) {
      setRegError('Password must be at least 8 characters');
      return;
    }

    setRegLoading(true);
    try {
      const response = await AuthModel.register({
        name: regForm.name,
        email: regForm.email,
        password: regForm.password,
        company_name: regForm.company_name || undefined,
        phone: regForm.phone || undefined,
        address: regForm.address || undefined,
      });

      if (response.success) {
        const token = (response.data as any)?.token || 'demo-token-' + Date.now();
        const link = `${window.location.origin}/activate?token=${token}`;
        console.log('=== EMAIL CONFIRMATION LINK ===');
        console.log('Link:', link);
        console.log('Token:', token);
        console.log('============================');
        setConfirmationLink(link);
        setRegStep('confirmation');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setRegError(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const handleRegInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegForm((prev) => ({ ...prev, [name]: value }));
  };

  // ============================
  // Confirmation Screen
  // ============================
  if (regStep === 'confirmation') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-picton-blue/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-picton-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
              <p className="text-gray-500 text-sm">
                We've sent a confirmation link to{' '}
                <span className="text-picton-blue font-semibold">{regForm.email}</span>
              </p>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-gray-500 text-sm">
                Click the activation link in the email to complete your registration.
              </p>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-gray-400 text-xs mb-2">Didn't receive the email?</p>
                <button
                  type="button"
                  className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium transition-colors"
                  onClick={() => {
                    notify.info('A new confirmation email has been sent.');
                  }}
                >
                  Resend confirmation email
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && confirmationLink && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-gray-400 text-xs mb-2">For testing (dev only):</p>
                  <a
                    href={confirmationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-picton-blue hover:text-picton-blue/80 text-xs font-mono break-all transition-colors block"
                  >
                    {confirmationLink}
                  </a>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => {
                    setRegStep('form');
                    switchTab('login');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================
  // Main Auth Page
  // ============================
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={siteName}
                className="h-10 w-auto mx-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all relative ${
                activeTab === 'login'
                  ? 'text-picton-blue'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign In
              {activeTab === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-picton-blue" />
              )}
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all relative ${
                activeTab === 'register'
                  ? 'text-picton-blue'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Create Account
              {activeTab === 'register' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-picton-blue" />
              )}
            </button>
          </div>

          {/* Form Area */}
          <div className="p-8">
            {/* ===== 2FA VERIFICATION ===== */}
            {activeTab === 'login' && twoFaRequired && (
              <div className="space-y-5">
                {/* ── Push-to-approve waiting screen ── */}
                {challengeId && twoFaMethod === 'totp' && !showManualCode ? (
                  <>
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-picton-blue/10 flex items-center justify-center">
                        <DevicePhoneMobileIcon className="h-7 w-7 text-picton-blue" />
                      </div>
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

                    {/* Alternative methods on push screen */}
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
                      <button onClick={resetToLogin} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        ← Back to Sign In
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Manual code entry (email / sms / totp fallback) ── */
                  <>
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-picton-blue/10 flex items-center justify-center">
                    {twoFaMethod === 'totp' && <DevicePhoneMobileIcon className="h-7 w-7 text-picton-blue" />}
                    {twoFaMethod === 'email' && <EnvelopeIcon className="h-7 w-7 text-picton-blue" />}
                    {twoFaMethod === 'sms' && <ChatBubbleLeftIcon className="h-7 w-7 text-picton-blue" />}
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-500">
                    {twoFaMethod === 'totp' && 'Enter the code from your authenticator app or a backup code.'}
                    {twoFaMethod === 'email' && 'A verification code has been sent to your email.'}
                    {twoFaMethod === 'sms' && 'A verification code has been sent to your phone.'}
                  </p>
                </div>

                {twoFaError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{twoFaError}</p>
                  </div>
                )}

                <form onSubmit={handle2FAVerify} className="space-y-4">
                  <div>
                    <label htmlFor="twofa-code" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      id="twofa-code"
                      maxLength={8}
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value.replace(/\s/g, ''))}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-center text-lg font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                      placeholder="000000"
                      autoFocus
                      autoComplete="one-time-code"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                      You can also enter a backup code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={twoFaVerifying || twoFaCode.length < 6}
                    className="w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {twoFaVerifying ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      'Verify'
                    )}
                  </button>
                </form>

                {/* Resend button for email/sms */}
                {(twoFaMethod === 'email' || twoFaMethod === 'sms') && (
                  <div className="text-center">
                    <button
                      onClick={handleResendOtp}
                      disabled={twoFaResending}
                      className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium transition-colors disabled:opacity-50"
                    >
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
                  <button
                    onClick={resetToLogin}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </div>
                  </>
                )}
              </div>
            )}

            {/* ===== PIN LOGIN ===== */}
            {activeTab === 'login' && !twoFaRequired && pinMode && hasPinLogin && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">
                    <KeyIcon className="h-7 w-7 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Welcome back{lastUserName ? `, ${lastUserName.split(' ')[0]}` : ''}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Enter your 4-digit PIN to sign in
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{lastEmail}</p>
                </div>

                {pinError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm text-center">{pinError}</p>
                  </div>
                )}

                {/* PIN Input */}
                <div className="flex justify-center gap-3">
                  {pinDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={pinInputRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinDigitInput(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      disabled={pinLoading}
                      className="w-14 h-16 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-xl focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 outline-none transition-all bg-white disabled:opacity-50"
                      autoFocus={i === 0}
                      autoComplete="off"
                    />
                  ))}
                </div>

                {pinLoading && (
                  <div className="flex justify-center">
                    <svg className="animate-spin h-5 w-5 text-picton-blue" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}

                <div className="space-y-2 text-center pt-2">
                  <button
                    onClick={() => { setPinMode(false); setPinError(''); setPinDigits(['', '', '', '']); }}
                    className="text-sm font-medium text-picton-blue hover:text-picton-blue/80 transition-colors block w-full"
                  >
                    Use password instead
                  </button>
                  <button
                    onClick={() => {
                      setPinMode(false);
                      setPinError('');
                      setPinDigits(['', '', '', '']);
                      setLoginEmail('');
                      setLastEmail('');
                      setHasPinLogin(false);
                      localStorage.removeItem('last_login_email');
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Not {lastUserName?.split(' ')[0] || lastEmail}? Sign in with a different account
                  </button>
                </div>
              </div>
            )}

            {/* ===== LOGIN FORM ===== */}
            {activeTab === 'login' && !twoFaRequired && !pinMode && (
              <form onSubmit={handleLogin} className="space-y-5">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{loginError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="text"
                    id="login-email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="you@youremail.com"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    id="login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                </div>

                <div className="flex items-center justify-between">
                  {hasPinLogin && (
                    <button
                      type="button"
                      onClick={() => { setPinMode(true); setLoginError(''); }}
                      className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1"
                    >
                      <KeyIcon className="w-4 h-4" />
                      Use PIN
                    </button>
                  )}
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-picton-blue hover:text-picton-blue/80 transition-colors ml-auto"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loginLoading ? (
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
              </form>
            )}

            {/* ===== REGISTER FORM ===== */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-600 text-sm">{regError}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="reg-name"
                    name="name"
                    value={regForm.name}
                    onChange={handleRegInput}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="reg-email"
                    name="email"
                    value={regForm.email}
                    onChange={handleRegInput}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="reg-company" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Company Name <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="reg-company"
                    name="company_name"
                    value={regForm.company_name}
                    onChange={handleRegInput}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="Your company or organisation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phone <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      id="reg-phone"
                      name="phone"
                      value={regForm.phone}
                      onChange={handleRegInput}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                      placeholder="+27 12 345 6789"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-address" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Address <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="reg-address"
                      name="address"
                      value={regForm.address}
                      onChange={handleRegInput}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                      placeholder="City, Country"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    id="reg-password"
                    name="password"
                    value={regForm.password}
                    onChange={handleRegInput}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="reg-confirm"
                    name="confirmPassword"
                    value={regForm.confirmPassword}
                    onChange={handleRegInput}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                    placeholder="Repeat your password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 px-4 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {regLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center pt-2">
                  By creating an account, you agree to our{' '}
                  <a href="/terms" className="text-picton-blue hover:text-picton-blue/80 transition-colors">Terms</a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-picton-blue hover:text-picton-blue/80 transition-colors">Privacy Policy</a>
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
