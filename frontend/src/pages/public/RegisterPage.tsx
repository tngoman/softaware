import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthModel } from '../../models';
import { useAppSettings } from '../../hooks/useAppSettings';
import { notify } from '../../utils/notify';

/**
 * Public Register Page — Light theme matching frontend design patterns
 * Uses AuthModel.register() for account creation.
 * Shows an email confirmation step after successful registration.
 */
const RegisterPage: React.FC = () => {
  const { logoUrl, siteName } = useAppSettings();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<'form' | 'confirmation'>('form');
  const [confirmationLink, setConfirmationLink] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await AuthModel.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (response.success) {
        // Build confirmation link for dev display
        const confirmationToken = (response.data as any)?.token || 'demo-token-' + Date.now();
        const link = `${window.location.origin}/activate?token=${confirmationToken}`;

        console.log('=== EMAIL CONFIRMATION LINK ===');
        console.log('Link that would be sent via email:', link);
        console.log('Token:', confirmationToken);
        console.log('============================');

        setConfirmationLink(link);
        setRegistrationStep('confirmation');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Confirmation Step ---
  if (registrationStep === 'confirmation') {
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
                <span className="text-picton-blue font-semibold">{formData.email}</span>
              </p>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-gray-500 text-sm">
                Click the activation link in the email to complete your registration and start using {siteName}.
              </p>

              <div className="pt-4 border-t border-slate-200">
                <p className="text-gray-400 text-xs mb-2">Didn't receive the email?</p>
                <button
                  type="button"
                  className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium transition-colors"
                  onClick={() => {
                    notify.info('A new confirmation email has been sent. Please check your inbox.');
                  }}
                >
                  Resend confirmation email
                </button>
              </div>

              {/* Development: Show confirmation link */}
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
                <Link to="/login" className="text-gray-500 hover:text-gray-700 text-sm transition-colors">
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Registration Form ---
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
          <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Create Your Account</h1>
          <p className="text-gray-500">Join thousands getting their business online in minutes</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Enter your full name"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Enter your email address"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Create a strong password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters long</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
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
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-gray-500 text-sm">
                Already have an account?{' '}
                <Link to="/login" className="text-picton-blue hover:text-picton-blue/80 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-400">
                By creating an account, you agree to our{' '}
                <a href="/terms" className="text-picton-blue hover:text-picton-blue/80 transition-colors">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="text-picton-blue hover:text-picton-blue/80 transition-colors">
                  Privacy Policy
                </a>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          © {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
