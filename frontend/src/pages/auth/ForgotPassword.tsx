import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import { notify } from '../../utils/notify';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [siteLogo, setSiteLogo] = useState('');
  const [siteName, setSiteName] = useState('SoftAware Billing');
  const [siteDescription, setSiteDescription] = useState('Reset your password');
  const navigate = useNavigate();

  React.useEffect(() => {
    try {
      const cachedBranding = localStorage.getItem('app_branding');
      if (cachedBranding) {
        const { logoUrl, name } = JSON.parse(cachedBranding);
        if (logoUrl) setSiteLogo(logoUrl);
        if (name) setSiteName(name);
      }
    } catch (error) {
      console.warn('Failed to load cached branding:', error);
    }
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      notify.warning('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      await AuthModel.forgotPassword(email);
      notify.success('If the email exists, an OTP has been sent to your inbox');
      setStep('otp');
    } catch (error: any) {
      console.error('Forgot password error:', error);
      notify.info('If the email exists, an OTP has been sent to your inbox');
      setStep('otp');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      notify.warning('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      await AuthModel.verifyOTP(email, otp);
      notify.success('Please enter your new password');
      setStep('reset');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      notify.error(error.response?.data?.message || 'The OTP is invalid or has expired');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword.length < 8) {
      notify.warning('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.warning('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await AuthModel.resetPassword(email, otp, newPassword);
      notify.success('Your password has been reset successfully. Please login with your new password');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      notify.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
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
                  (event.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">{siteDescription}</p>
            </div>
          </div>

          <div className="px-8 py-6">
            {step === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm text-picton-blue hover:text-picton-blue/80"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-5">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    Enter the 6-digit OTP sent to <strong>{email}</strong>
                  </p>
                </div>

                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1.5">
                    OTP Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>

                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Change Email
                  </button>
                  <span className="mx-2 text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-sm text-picton-blue hover:text-picton-blue/80"
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">Enter your new password</p>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                    placeholder="••••••••"
                    disabled={loading}
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-picton-blue focus:border-transparent transition-all"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center px-4 py-2.5 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
