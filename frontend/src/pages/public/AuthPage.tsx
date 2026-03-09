import React, { useState, useEffect } from 'react';
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

  // --- Register State ---
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regStep, setRegStep] = useState<'form' | 'confirmation'>('form');
  const [confirmationLink, setConfirmationLink] = useState('');

  // Tab switcher (also updates URL without full reload)
  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setLoginError('');
    setRegError('');
    navigate(tab === 'login' ? '/login' : '/register', { replace: true });
  };

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
          setTwoFaRequired(true);
          setTwoFaMethod((response.data.two_factor_method as 'totp' | 'email' | 'sms') || 'totp');
          setTwoFaTempToken(response.data.temp_token || '');
          setTwoFaError('');
          setTwoFaCode('');
          return;
        }

        const { token, user: userData } = response.data;
        AuthModel.storeAuth(token, userData);

        try {
          const permissions = await AuthModel.getUserPermissions();
          userData.permissions = permissions;
        } catch {
          userData.permissions = [];
        }

        AuthModel.storeAuth(token, userData);
        setUser(userData);
        setIsAuthenticated(true);
        await new Promise((r) => setTimeout(r, 100));
        navigate('/dashboard');
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
        AuthModel.storeAuth(token, userData);

        try {
          const permissions = await AuthModel.getUserPermissions();
          userData.permissions = permissions;
        } catch {
          userData.permissions = [];
        }

        AuthModel.storeAuth(token, userData);
        setUser(userData);
        setIsAuthenticated(true);
        await new Promise((r) => setTimeout(r, 100));
        navigate('/dashboard');
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
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-picton-blue/10 flex items-center justify-center">
                    {twoFaMethod === 'totp' && <DevicePhoneMobileIcon className="h-7 w-7 text-picton-blue" />}
                    {twoFaMethod === 'email' && <EnvelopeIcon className="h-7 w-7 text-picton-blue" />}
                    {twoFaMethod === 'sms' && <ChatBubbleLeftIcon className="h-7 w-7 text-picton-blue" />}
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Two-Factor Authentication</h2>
                  <p className="text-sm text-gray-500">
                    {twoFaMethod === 'totp' && 'Enter the code from your authenticator app.'}
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
                      {twoFaMethod === 'totp' ? 'You can also enter a backup code.' : 'Enter the 6-digit code or a backup code.'}
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

                <div className="text-center pt-3 border-t border-slate-200">
                  <button
                    onClick={() => { setTwoFaRequired(false); setTwoFaCode(''); setTwoFaError(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {/* ===== LOGIN FORM ===== */}
            {activeTab === 'login' && !twoFaRequired && (
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
