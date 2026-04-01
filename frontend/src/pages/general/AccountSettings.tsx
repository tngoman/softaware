import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { 
  LockClosedIcon, 
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';
import TwoFactorSetup from '../../components/TwoFactorSetup';
import MobileAuthQR from '../../components/MobileAuthQR';
import PinSetup from '../../components/PinSetup';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';

interface PasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const AccountSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const { user, setUser } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if user is staff or admin
  const isStaffOrAdmin = !!(user?.is_admin || user?.is_staff);

  // Handle ?linked=google or ?link_error=... from the OAuth redirect
  useEffect(() => {
    const linked = searchParams.get('linked');
    const linkError = searchParams.get('link_error');

    if (linked) {
      notify.success(`${linked.charAt(0).toUpperCase() + linked.slice(1)} account linked successfully`);
      // Refresh user profile to get updated oauth_provider
      AuthModel.me().then(({ user: updatedUser }) => {
        setUser({ ...user!, ...updatedUser });
      }).catch(() => {});
      // Clean up the URL
      searchParams.delete('linked');
      setSearchParams(searchParams, { replace: true });
    }

    if (linkError) {
      notify.error(linkError);
      searchParams.delete('link_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<PasswordFormData>();

  const newPassword = watch('new_password');

  const onSubmit = async (data: PasswordFormData) => {
    if (data.new_password !== data.confirm_password) {
      notify.error('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    setSaved(false);

    try {
      const response = await AuthModel.changePassword({
        current_password: data.current_password,
        new_password: data.new_password
      });

      if (response.success) {
        setSaved(true);
        reset();
        setTimeout(() => setSaved(false), 3000);

        notify.success('Password changed successfully');
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      notify.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string): { strength: string; color: string; width: string } => {
    if (!password) return { strength: '', color: '', width: '0%' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { strength: 'Weak', color: 'bg-red-500', width: '33%' };
    if (score <= 4) return { strength: 'Medium', color: 'bg-yellow-500', width: '66%' };
    return { strength: 'Strong', color: 'bg-green-500', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(newPassword || '');

  // ── Connected Accounts (OAuth providers) ──────────────────────────
  const providers = [
    {
      id: 'google',
      name: 'Google',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ),
      color: 'border-gray-300 hover:border-gray-400',
      onLink: async () => {
        setLinkingProvider('google');
        try {
          const url = await AuthModel.getGoogleLinkUrl();
          window.location.href = url;
        } catch (err: any) {
          notify.error(err.response?.data?.message || 'Failed to start Google linking');
          setLinkingProvider(null);
        }
      },
    },
    // Future providers go here:
    // { id: 'facebook', name: 'Facebook', icon: ..., color: ..., onLink: async () => { ... } },
  ];

  const handleUnlink = async (providerName: string) => {
    const result = await Swal.fire({
      title: `Unlink ${providerName}?`,
      text: 'You can always re-link later. You\'ll still be able to sign in with your email and password.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: 'Yes, unlink',
    });
    if (!result.isConfirmed) return;

    setUnlinkingProvider(providerName.toLowerCase());
    try {
      const response = await AuthModel.unlinkOAuthAccount();
      if (response.data?.user) {
        setUser({ ...user!, ...response.data.user });
      }
      notify.success(`${providerName} account unlinked`);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to unlink account');
    } finally {
      setUnlinkingProvider(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center space-x-3">
          <ShieldCheckIcon className="h-10 w-10 text-white" />
          <div>
            <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
            <p className="text-white/90">Manage your account security and preferences</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-6">
          <LockClosedIcon className="h-6 w-6 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                {...register('current_password', { required: 'Current password is required' })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter current password"
              />
            </div>
            {errors.current_password && (
              <p className="mt-1 text-sm text-red-600">{errors.current_password.message}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                {...register('new_password', { 
                  required: 'New password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters'
                  }
                })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Enter new password"
              />
            </div>
            {errors.new_password && (
              <p className="mt-1 text-sm text-red-600">{errors.new_password.message}</p>
            )}

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Password Strength:</span>
                  <span className={`font-medium ${
                    passwordStrength.strength === 'Strong' ? 'text-green-600' :
                    passwordStrength.strength === 'Medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {passwordStrength.strength}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  ></div>
                </div>
              </div>
            )}

            {/* Password Requirements */}
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-600 font-medium">Password must contain:</p>
              <ul className="text-xs text-gray-500 space-y-1 ml-4">
                <li className={newPassword && newPassword.length >= 8 ? 'text-green-600' : ''}>
                  • At least 8 characters
                </li>
                <li className={newPassword && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                  • Uppercase and lowercase letters
                </li>
                <li className={newPassword && /\d/.test(newPassword) ? 'text-green-600' : ''}>
                  • At least one number
                </li>
                <li className={newPassword && /[^a-zA-Z0-9]/.test(newPassword) ? 'text-green-600' : ''}>
                  • At least one special character
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                {...register('confirm_password', { 
                  required: 'Please confirm your password',
                  validate: value => value === newPassword || 'Passwords do not match'
                })}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                placeholder="Confirm new password"
              />
            </div>
            {errors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{errors.confirm_password.message}</p>
            )}
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Security Notice</h3>
                <p className="mt-1 text-sm text-blue-700">
                  After changing your password, you will remain logged in on this device. 
                  Other active sessions will be terminated for security.
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            {saved && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircleIcon className="h-5 w-5 mr-1" />
                Password changed successfully
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Connected Accounts */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-2">
          <LinkIcon className="h-6 w-6 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Link external accounts to sign in faster. You can link one provider at a time.
        </p>

        <div className="space-y-3">
          {providers.map((provider) => {
            const isLinked = user?.oauth_provider === provider.id;
            const isBusy = linkingProvider === provider.id || unlinkingProvider === provider.id;

            return (
              <div
                key={provider.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  isLinked ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">{provider.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                    <p className="text-xs text-gray-500">
                      {isLinked ? (
                        <span className="text-green-600 font-medium">✓ Connected</span>
                      ) : (
                        'Not connected'
                      )}
                    </p>
                  </div>
                </div>

                {isLinked ? (
                  <button
                    onClick={() => handleUnlink(provider.name)}
                    disabled={isBusy}
                    className="px-4 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {isBusy ? 'Unlinking…' : 'Unlink'}
                  </button>
                ) : (
                  <button
                    onClick={provider.onLink}
                    disabled={isBusy || !!user?.oauth_provider}
                    className="px-4 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                    title={user?.oauth_provider ? 'Unlink the current provider first' : undefined}
                  >
                    {isBusy ? 'Linking…' : 'Link'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick PIN Login */}
      <div className="bg-white shadow rounded-lg p-6">
        <PinSetup />
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white shadow rounded-lg p-6">
        <TwoFactorSetup isStaffOrAdmin={isStaffOrAdmin} />
      </div>

      {/* Mobile App QR Authentication */}
      <MobileAuthQR />
    </div>
  );
};

export default AccountSettings;
