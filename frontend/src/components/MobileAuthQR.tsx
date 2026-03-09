import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DevicePhoneMobileIcon, QrCodeIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { AuthModel } from '../models';

/**
 * MobileAuthQR — Displays a QR code on the web profile when a mobile app
 * login is waiting for TOTP-based 2FA verification.
 *
 * Flow:
 *   1. Polls GET /auth/2fa/mobile-qr every 5s to check for pending challenges
 *   2. When a pending challenge exists → shows QR code for the mobile app to scan
 *   3. Polls GET /auth/2fa/mobile-qr/status/:id every 3s to detect completion
 *   4. When completed → shows success message, then auto-hides
 */
const MobileAuthQR: React.FC = () => {
  const [hasPending, setHasPending] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const pollQrRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStatusRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllIntervals = useCallback(() => {
    if (pollQrRef.current) { clearInterval(pollQrRef.current); pollQrRef.current = null; }
    if (pollStatusRef.current) { clearInterval(pollStatusRef.current); pollStatusRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  // Poll for pending mobile challenges
  const checkForChallenge = useCallback(async () => {
    try {
      const data = await AuthModel.getMobileAuthQR();
      if (data.has_pending && data.qr_code && data.challenge_id) {
        setHasPending(true);
        setChallengeId(data.challenge_id);
        setQrCode(data.qr_code);
        setExpiresAt(data.expires_at || null);
        setCompleted(false);
      } else {
        if (!completed) {
          setHasPending(false);
          setChallengeId(null);
          setQrCode(null);
          setExpiresAt(null);
        }
      }
    } catch {
      // Silently ignore — user may not have 2FA enabled
    }
  }, [completed]);

  // Poll for challenge completion
  const checkStatus = useCallback(async () => {
    if (!challengeId) return;
    try {
      const data = await AuthModel.getMobileAuthStatus(challengeId);
      if (data.status === 'completed') {
        setCompleted(true);
        // Auto-hide after 5 seconds
        setTimeout(() => {
          setHasPending(false);
          setCompleted(false);
          setChallengeId(null);
          setQrCode(null);
        }, 5000);
      } else if (data.status === 'expired' || data.status === 'not_found') {
        setHasPending(false);
        setChallengeId(null);
        setQrCode(null);
      }
    } catch {
      // ignore
    }
  }, [challengeId]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || !hasPending || completed) {
      setTimeLeft(0);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        setHasPending(false);
        setChallengeId(null);
        setQrCode(null);
      }
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [expiresAt, hasPending, completed]);

  // Start polling for challenges every 5s
  useEffect(() => {
    checkForChallenge();
    pollQrRef.current = setInterval(checkForChallenge, 5000);
    return () => { if (pollQrRef.current) clearInterval(pollQrRef.current); };
  }, [checkForChallenge]);

  // When we have a pending challenge, poll status every 3s
  useEffect(() => {
    if (hasPending && challengeId && !completed) {
      pollStatusRef.current = setInterval(checkStatus, 3000);
      return () => { if (pollStatusRef.current) clearInterval(pollStatusRef.current); };
    }
  }, [hasPending, challengeId, completed, checkStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return clearAllIntervals;
  }, [clearAllIntervals]);

  // Don't render anything if there's no pending challenge
  if (!hasPending) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 animate-in fade-in duration-500">
      {completed ? (
        /* ── Success state ── */
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircleIcon className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-800">Mobile App Authenticated</h3>
          <p className="text-sm text-green-600">
            Your mobile app has been successfully verified. You can now use the app.
          </p>
        </div>
      ) : (
        /* ── QR code state ── */
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center gap-2 text-indigo-700">
            <DevicePhoneMobileIcon className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Mobile App Login Pending</h3>
          </div>

          <p className="text-sm text-gray-600 max-w-md">
            Your mobile app is waiting for verification. Scan this QR code with the 
            SoftAware mobile app to complete login.
          </p>

          {/* QR Code */}
          {qrCode && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
              <img
                src={qrCode}
                alt="Mobile Authentication QR Code"
                className="w-64 h-64 mx-auto"
              />
            </div>
          )}

          {/* Countdown */}
          <div className="flex items-center gap-2 text-sm">
            <ClockIcon className="w-4 h-4 text-amber-500" />
            <span className={`font-mono ${timeLeft <= 60 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              Expires in {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs">
            <QrCodeIcon className="w-4 h-4 flex-shrink-0" />
            <span>Open the SoftAware app → tap "Scan QR" on the login screen</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAuthQR;
