import React, { useState, useEffect, useRef } from 'react';
import { KeyIcon, ShieldCheckIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { AuthModel } from '../models';
import Swal from 'sweetalert2';

/**
 * PinSetup — Allows users to set, update, or remove a 4-digit PIN
 * for quick re-authentication instead of full password entry.
 *
 * Used in both AccountSettings (staff) and PortalSettings (client) security tabs.
 */
const PinSetup: React.FC = () => {
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const confirmRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const result = await AuthModel.getPinStatus();
      setHasPin(result.has_pin);
    } catch {
      // Ignore — may not be authenticated
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (index: number, value: string, isConfirm: boolean) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const digit = value.slice(-1); // Take last char if paste

    if (isConfirm) {
      const newPin = [...confirmPin];
      newPin[index] = digit;
      setConfirmPin(newPin);
      if (digit && index < 3) confirmRefs[index + 1]?.current?.focus();
    } else {
      const newPin = [...pin];
      newPin[index] = digit;
      setPin(newPin);
      if (digit && index < 3) pinRefs[index + 1]?.current?.focus();
    }
    setError('');
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean) => {
    if (e.key === 'Backspace') {
      const currentPin = isConfirm ? confirmPin : pin;
      if (!currentPin[index] && index > 0) {
        const refs = isConfirm ? confirmRefs : pinRefs;
        refs[index - 1]?.current?.focus();
      }
    }
  };

  const handlePinSubmit = async () => {
    const pinValue = pin.join('');
    if (pinValue.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    if (step === 'enter') {
      setStep('confirm');
      setConfirmPin(['', '', '', '']);
      setTimeout(() => confirmRefs[0]?.current?.focus(), 100);
      return;
    }

    // Confirm step
    const confirmValue = confirmPin.join('');
    if (pinValue !== confirmValue) {
      setError('PINs do not match. Try again.');
      setConfirmPin(['', '', '', '']);
      setTimeout(() => confirmRefs[0]?.current?.focus(), 100);
      return;
    }

    if (!password) {
      setError('Please enter your current password');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await AuthModel.setPin(pinValue, password);
      setHasPin(true);
      setShowSetup(false);
      resetForm();
      Swal.fire({
        icon: 'success',
        title: 'PIN Set',
        text: 'You can now use your PIN for quick login.',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    const result = await Swal.fire({
      title: 'Remove PIN?',
      text: 'You will need to enter your full password to sign in.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove PIN',
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      try {
        await AuthModel.removePin();
        setHasPin(false);
        Swal.fire({
          icon: 'success',
          title: 'PIN Removed',
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (err: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'Failed to remove PIN',
        });
      }
    }
  };

  const resetForm = () => {
    setPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
    setStep('enter');
    setPassword('');
    setError('');
  };

  const cancelSetup = () => {
    setShowSetup(false);
    resetForm();
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <KeyIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Quick PIN Login</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasPin
                ? 'PIN is active — sign in faster with just 4 digits'
                : 'Set a 4-digit PIN for faster sign-in'}
            </p>
          </div>
        </div>
        {hasPin && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-full">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              Active
            </span>
          </div>
        )}
      </div>

      {!showSetup ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowSetup(true); resetForm(); setTimeout(() => pinRefs[0]?.current?.focus(), 100); }}
            className="px-4 py-2 text-sm font-medium text-white bg-picton-blue rounded-lg hover:bg-picton-blue/90 transition-all"
          >
            {hasPin ? 'Change PIN' : 'Set Up PIN'}
          </button>
          {hasPin && (
            <button
              type="button"
              onClick={handleRemovePin}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all flex items-center gap-1.5"
            >
              <TrashIcon className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'enter' ? 'bg-picton-blue text-white' : 'bg-green-500 text-white'}`}>
              {step === 'confirm' ? '✓' : '1'}
            </span>
            <span className={step === 'enter' ? 'font-medium text-gray-900' : 'text-gray-500'}>Enter PIN</span>
            <span className="text-gray-300">→</span>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'confirm' ? 'bg-picton-blue text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
            <span className={step === 'confirm' ? 'font-medium text-gray-900' : 'text-gray-500'}>Confirm PIN</span>
          </div>

          {/* PIN inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {step === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
            </label>
            <div className="flex gap-3 justify-start">
              {(step === 'enter' ? pin : confirmPin).map((digit, i) => (
                <input
                  key={`${step}-${i}`}
                  ref={step === 'enter' ? pinRefs[i] : confirmRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinInput(i, e.target.value, step === 'confirm')}
                  onKeyDown={(e) => handleKeyDown(i, e, step === 'confirm')}
                  className="w-14 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-xl focus:border-picton-blue focus:ring-2 focus:ring-picton-blue/20 outline-none transition-all bg-white"
                  autoComplete="off"
                />
              ))}
            </div>
          </div>

          {/* Password (only shown at confirm step) */}
          {step === 'confirm' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Current password <span className="text-gray-400 font-normal">(to confirm it's you)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your current password"
                className="w-full max-w-sm px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handlePinSubmit}
              disabled={saving || (step === 'enter' ? pin.join('').length !== 4 : confirmPin.join('').length !== 4 || !password)}
              className="px-5 py-2 text-sm font-semibold text-white bg-picton-blue rounded-lg hover:bg-picton-blue/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving…' : step === 'enter' ? 'Next' : 'Set PIN'}
            </button>
            {step === 'confirm' && (
              <button
                type="button"
                onClick={() => { setStep('enter'); setConfirmPin(['', '', '', '']); setPassword(''); setError(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-all"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={cancelSetup}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-all"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <ShieldCheckIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Your PIN is encrypted and can only be used on this app. After 5 failed attempts, PIN login is locked for 15 minutes.
              {hasPin ? '' : ' Two-factor authentication (if enabled) is still required after PIN entry.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinSetup;
