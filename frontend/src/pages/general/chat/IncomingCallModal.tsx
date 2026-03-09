/**
 * IncomingCallModal — Shown when receiving an incoming voice/video call.
 *
 * Displays caller info with accept (green) and decline (red) buttons.
 * Plays a ring animation and auto-dismisses after 45 seconds.
 */
import React, { useEffect, useState } from 'react';
import {
  PhoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/solid';

interface IncomingCallModalProps {
  callId: number;
  conversationId: number;
  callType: 'voice' | 'video';
  callerName: string;
  callerAvatar?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({
  callId,
  conversationId,
  callType,
  callerName,
  callerAvatar,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  const [ringCount, setRingCount] = useState(0);

  // NOTE: Ringing sound is handled by GlobalCallProvider (Layout-level).
  // This component only provides the visual UI.

  // Auto-dismiss after 45s
  useEffect(() => {
    const timer = setTimeout(() => {
      onDecline();
    }, 45000);

    // Ring counter for animation
    const ringInterval = setInterval(() => {
      setRingCount((c) => c + 1);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(ringInterval);
    };
  }, [onDecline]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl shadow-2xl p-8 w-80 max-w-[90vw] flex flex-col items-center animate-in fade-in zoom-in duration-300">
        {/* Call type indicator */}
        <div className="flex items-center gap-2 mb-6">
          {callType === 'video' ? (
            <VideoCameraIcon className="w-5 h-5 text-blue-400" />
          ) : (
            <PhoneIcon className="w-5 h-5 text-green-400" />
          )}
          <span className="text-white/60 text-sm uppercase tracking-wider">
            Incoming {callType} call
          </span>
        </div>

        {/* Caller avatar with pulse rings */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 rounded-full bg-green-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute -inset-2 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-xl">
            {callerAvatar ? (
              <img src={callerAvatar} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <span className="text-white text-4xl font-bold">
                {callerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Caller name */}
        <h2 className="text-white text-xl font-semibold mb-1">{callerName}</h2>
        <p className="text-white/50 text-sm mb-8 animate-pulse">Ringing...</p>

        {/* Accept / Decline buttons */}
        <div className="flex items-center gap-8">
          {/* Decline */}
          <button
            onClick={onDecline}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all group-hover:scale-110">
              <PhoneXMarkIcon className="w-7 h-7" />
            </div>
            <span className="text-red-400 text-xs font-medium">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white shadow-lg shadow-green-600/30 transition-all group-hover:scale-110 animate-bounce" style={{ animationDuration: '1.5s' }}>
              {callType === 'video' ? (
                <VideoCameraIcon className="w-7 h-7" />
              ) : (
                <PhoneIcon className="w-7 h-7" />
              )}
            </div>
            <span className="text-green-400 text-xs font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}
