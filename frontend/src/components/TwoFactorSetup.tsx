import React, { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ChatBubbleLeftIcon,
  KeyIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { AuthModel, TwoFactorStatus, TwoFactorSetupResult } from '../models/AuthModel';
import Swal from 'sweetalert2';

interface TwoFactorSetupProps {
  /** Whether user is staff/admin (affects available methods & disable rules) */
  isStaffOrAdmin?: boolean;
}

type SetupStep = 'status' | 'choose-method' | 'setup' | 'verify' | 'backup-codes';

const METHOD_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  totp: {
    label: 'SoftAware App (Authenticator)',
    description: 'Use an authenticator app like Google Authenticator, Authy, or SoftAware App to generate time-based codes.',
    icon: <DevicePhoneMobileIcon className="h-6 w-6" />,
  },
  email: {
    label: 'Email Verification',
    description: 'Receive a one-time verification code via email each time you log in.',
    icon: <EnvelopeIcon className="h-6 w-6" />,
  },
  sms: {
    label: 'SMS Verification',
    description: 'Receive a one-time verification code via SMS to your phone number.',
    icon: <ChatBubbleLeftIcon className="h-6 w-6" />,
  },
};

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ isStaffOrAdmin = false }) => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [step, setStep] = useState<SetupStep>('status');
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'email' | 'sms'>('totp');
  const [setupResult, setSetupResult] = useState<TwoFactorSetupResult | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await AuthModel.get2FAStatus();
      setStatus(data);
      setStep('status');
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (method: 'totp' | 'email' | 'sms') => {
    try {
      setSelectedMethod(method);
      setLoading(true);
      const result = await AuthModel.setup2FA(method);
      setSetupResult(result);
      setStep(method === 'totp' ? 'setup' : 'verify');
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Setup Failed', text: err.response?.data?.message || 'Failed to initiate 2FA setup.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length < 6) {
      Swal.fire({ icon: 'warning', title: 'Enter Code', text: 'Please enter the 6-digit verification code.' });
      return;
    }
    try {
      setVerifying(true);
      const result = await AuthModel.verifySetup2FA(verifyCode);
      setBackupCodes(result.backup_codes);
      setStep('backup-codes');
      setVerifyCode('');
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Invalid Code', text: err.response?.data?.message || 'The verification code was incorrect.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (isStaffOrAdmin) {
      Swal.fire({ icon: 'warning', title: 'Cannot Disable', text: 'Staff and admin users are required to have 2FA enabled. You can change your verification method instead.' });
      return;
    }
    const { value } = await Swal.fire({
      title: 'Disable Two-Factor Authentication?',
      text: 'Enter your password to confirm. This will make your account less secure.',
      icon: 'warning',
      input: 'password',
      inputPlaceholder: 'Enter your password',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Disable 2FA',
    });
    if (!value) return;

    try {
      await AuthModel.disable2FA(value);
      Swal.fire({ icon: 'success', title: 'Disabled', text: '2FA has been disabled.', timer: 2000, showConfirmButton: false });
      loadStatus();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to disable 2FA.' });
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const { value } = await Swal.fire({
      title: 'Regenerate Backup Codes?',
      text: 'Current backup codes will be invalidated. Enter your password to confirm.',
      icon: 'warning',
      input: 'password',
      inputPlaceholder: 'Enter your password',
      showCancelButton: true,
      confirmButtonText: 'Regenerate',
    });
    if (!value) return;

    try {
      const codes = await AuthModel.regenerateBackupCodes(value);
      setBackupCodes(codes);
      setStep('backup-codes');
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to regenerate backup codes.' });
    }
  };

  const handleChangeMethod = async (newMethod: 'totp' | 'email' | 'sms') => {
    const { value } = await Swal.fire({
      title: `Switch to ${METHOD_LABELS[newMethod].label}?`,
      text: 'Enter your password to confirm. You will need to verify the new method.',
      icon: 'question',
      input: 'password',
      inputPlaceholder: 'Enter your password',
      showCancelButton: true,
      confirmButtonText: 'Switch Method',
    });
    if (!value) return;

    try {
      setSelectedMethod(newMethod);
      setLoading(true);
      const result = await AuthModel.change2FAMethod(newMethod, value);
      if (result.data?.requires_verification) {
        setSetupResult(result.data);
        setStep('setup');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to change 2FA method.' });
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (loading && step === 'status') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // ── Backup Codes Screen ─────────────────────────────────────────
  if (step === 'backup-codes' && backupCodes.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <KeyIcon className="h-6 w-6 text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900">Save Your Backup Codes</h3>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Important — Save these codes now!</p>
              <p className="text-sm text-amber-700 mt-1">
                These backup codes can be used to access your account if you lose your 2FA device. 
                Each code can only be used once. Store them in a safe place.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-3">
            {backupCodes.map((code, i) => (
              <div key={i} className="font-mono text-sm bg-white px-3 py-2 rounded border text-center">
                {code}
              </div>
            ))}
          </div>
          <button
            onClick={copyBackupCodes}
            className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
            {copiedCodes ? 'Copied!' : 'Copy All Codes'}
          </button>
        </div>

        <button
          onClick={() => {
            setBackupCodes([]);
            loadStatus();
          }}
          className="px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all"
        >
          I've Saved My Codes — Done
        </button>
      </div>
    );
  }

  // ── Setup / Verify Screen ──────────────────────────────────────
  if (step === 'setup' || step === 'verify') {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          {METHOD_LABELS[selectedMethod].icon}
          <h3 className="text-lg font-semibold text-gray-900">
            Set Up {METHOD_LABELS[selectedMethod].label}
          </h3>
        </div>

        {selectedMethod === 'totp' && setupResult?.qr_code && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, or SoftAware App):
            </p>
            <div className="flex justify-center">
              <img src={setupResult.qr_code} alt="QR Code" className="w-48 h-48 border rounded-lg" />
            </div>
            {setupResult.secret && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">Manual entry key:</p>
                <code className="text-sm font-mono text-gray-900 select-all">{setupResult.secret}</code>
              </div>
            )}
          </div>
        )}

        {(selectedMethod === 'email' || selectedMethod === 'sms') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              {selectedMethod === 'email'
                ? 'A verification code has been sent to your email address.'
                : 'A verification code has been sent to your phone.'}
            </p>
            <p className="text-sm text-blue-600 mt-1">Enter the 6-digit code below to complete setup.</p>
          </div>
        )}

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification Code</label>
          <input
            type="text"
            maxLength={8}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\s/g, ''))}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleVerify}
            disabled={verifying || verifyCode.length < 6}
            className="px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-50 transition-all"
          >
            {verifying ? 'Verifying...' : 'Verify & Enable'}
          </button>
          <button
            onClick={() => { setStep('choose-method'); setVerifyCode(''); setSetupResult(null); }}
            className="px-5 py-2.5 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Choose Method Screen ───────────────────────────────────────
  if (step === 'choose-method') {
    const methods = status?.available_methods || (isStaffOrAdmin ? ['totp', 'email', 'sms'] : ['totp', 'email']);
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <ShieldCheckIcon className="h-6 w-6 text-picton-blue" />
          <h3 className="text-lg font-semibold text-gray-900">Choose Verification Method</h3>
        </div>

        <div className="space-y-3">
          {methods.map((method: string) => {
            const info = METHOD_LABELS[method];
            const isSending = loading && selectedMethod === method;
            return (
              <button
                key={method}
                onClick={() => handleSetup(method as any)}
                disabled={loading}
                className={`w-full flex items-start gap-4 p-4 bg-white border rounded-lg transition-all text-left ${
                  isSending
                    ? 'border-picton-blue bg-picton-blue/5'
                    : 'border-gray-200 hover:border-picton-blue hover:bg-picton-blue/5'
                } ${loading && !isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  isSending ? 'bg-picton-blue/20 text-picton-blue' : 'bg-picton-blue/10 text-picton-blue'
                }`}>
                  {isSending ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : info.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{info.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {isSending
                      ? (method === 'sms' ? 'Sending verification code to your phone…' : method === 'email' ? 'Sending verification code to your email…' : 'Generating authenticator setup…')
                      : info.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setStep('status')}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Status Screen (default) ────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheckIcon className="h-6 w-6 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
        </div>
        {status?.is_enabled && (
          <span className="inline-flex items-center px-3 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Enabled
          </span>
        )}
      </div>

      {/* Staff/Admin Required Notice */}
      {isStaffOrAdmin && !status?.is_enabled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Two-Factor Authentication Required</p>
              <p className="text-sm text-red-700 mt-1">
                As a staff or admin user, you are required to enable two-factor authentication for account security.
                Please set up 2FA now.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Client Encouragement Notice */}
      {!isStaffOrAdmin && !status?.is_enabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <ShieldCheckIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Secure Your Account</p>
              <p className="text-sm text-blue-700 mt-1">
                We strongly recommend enabling two-factor authentication to protect your account. 
                It adds an extra layer of security beyond your password.
              </p>
            </div>
          </div>
        </div>
      )}

      {status?.is_enabled ? (
        <div className="space-y-4">
          {/* Current Method */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                {METHOD_LABELS[status.preferred_method]?.icon || <ShieldCheckIcon className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Current Method: {METHOD_LABELS[status.preferred_method]?.label || status.preferred_method}
                </p>
                <p className="text-xs text-gray-500">
                  {METHOD_LABELS[status.preferred_method]?.description}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {/* Change Method */}
            <div className="relative group">
              <button
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setStep('choose-method')}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Change Method
              </button>
            </div>

            {/* Regenerate Backup Codes */}
            <button
              onClick={handleRegenerateBackupCodes}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <KeyIcon className="h-4 w-4 mr-2" />
              New Backup Codes
            </button>

            {/* Disable (clients only) */}
            {!isStaffOrAdmin && (
              <button
                onClick={handleDisable}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disable 2FA
              </button>
            )}
          </div>

          {/* Cannot disable notice for staff/admin */}
          {isStaffOrAdmin && (
            <p className="text-xs text-gray-500 italic">
              As a staff/admin user, you cannot disable two-factor authentication. You may change your verification method.
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setStep('choose-method')}
          className="inline-flex items-center px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
        >
          <ShieldCheckIcon className="h-5 w-5 mr-2" />
          Set Up Two-Factor Authentication
        </button>
      )}
    </div>
  );
};

export default TwoFactorSetup;
