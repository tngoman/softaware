/**
 * GlobalCallProvider — Keeps a persistent Socket.IO connection for call events.
 *
 * Mounted inside Layout so it lives for the entire authenticated session.
 * When an incoming call arrives, shows the IncomingCallModal overlay.
 * When the user is on /chat, the ChatPage handles calls directly and this
 * provider defers to it by checking the URL.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  getStaffChatSocket,
  getStaffChatSocketInstance,
  emitCallAccept,
  emitCallDecline,
} from '../../services/staffChatSocket';
import { webrtcService } from '../../services/webrtcService';
import { StaffChatModel } from '../../models/StaffChatModel';
import { notify } from '../../utils/notify';
import { startRinging, stopRinging } from '../../utils/ringtone';

// ── Types ────────────────────────────────────────────────────
interface IncomingCallData {
  callId: number;
  conversationId: number;
  callType: 'voice' | 'video';
  callerId: string;
  callerName: string;
}

// ── Component ────────────────────────────────────────────────
export default function GlobalCallProvider() {
  const user = useAppStore((s) => s.user);
  const userId = String(user?.id || '');
  const location = useLocation();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const isOnChatPage = location.pathname === '/chat';
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect socket & listen for call events (persists across pages)
  useEffect(() => {
    if (!userId) return;

    let socket: ReturnType<typeof getStaffChatSocket>;
    try {
      socket = getStaffChatSocket();
    } catch {
      return; // No auth token
    }

    const handleCallRinging = (data: IncomingCallData) => {
      // Don't show if we're the caller or already in a call
      if (data.callerId === userId) return;
      if (webrtcService.isInCall()) return;

      console.log('[GlobalCallProvider] Incoming call:', data);
      setIncomingCall(data);
      startRinging();

      // Auto-dismiss after 45s
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        setIncomingCall((prev) => {
          if (prev?.callId === data.callId) {
            stopRinging();
            return null;
          }
          return prev;
        });
      }, 45000);
    };

    const handleCallEnded = (data: { callId: number }) => {
      setIncomingCall((prev) => {
        if (prev?.callId === data.callId) {
          stopRinging();
          return null;
        }
        return prev;
      });
    };

    const handleCallMissed = (data: { callId: number }) => {
      setIncomingCall((prev) => {
        if (prev?.callId === data.callId) {
          stopRinging();
          return null;
        }
        return prev;
      });
    };

    const handleCallDeclined = (data: { callId: number }) => {
      setIncomingCall((prev) => {
        if (prev?.callId === data.callId) {
          stopRinging();
          return null;
        }
        return prev;
      });
    };

    socket.on('call-ringing', handleCallRinging);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-missed', handleCallMissed);
    socket.on('call-declined', handleCallDeclined);

    return () => {
      socket.off('call-ringing', handleCallRinging);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-missed', handleCallMissed);
      socket.off('call-declined', handleCallDeclined);
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      stopRinging();
    };
  }, [userId]);

  // ── Accept call ─────────────────────────────────────────
  const handleAccept = useCallback(async () => {
    if (!incomingCall) return;
    stopRinging();

    try {
      // Accept via API
      await StaffChatModel.acceptCall(incomingCall.callId);

      // Start WebRTC locally
      await webrtcService.acceptCall(
        incomingCall.callId,
        incomingCall.conversationId,
        incomingCall.callType,
        incomingCall.callerId,
        incomingCall.callerName,
      );

      // Signal acceptance via socket
      emitCallAccept(incomingCall.callId, incomingCall.conversationId);

      // Create peer connection with the caller — acceptor is initiator
      const socket = getStaffChatSocket();
      await webrtcService.createPeerConnection(incomingCall.callerId, true, socket);

      setIncomingCall(null);

      // Navigate to chat page if not already there
      if (!isOnChatPage) {
        navigate('/chat');
      }
    } catch (err: any) {
      notify.error(err?.message || 'Failed to accept call');
    }
  }, [incomingCall, isOnChatPage, navigate]);

  // ── Decline call ────────────────────────────────────────
  const handleDecline = useCallback(() => {
    if (!incomingCall) return;
    stopRinging();
    emitCallDecline(incomingCall.callId, incomingCall.conversationId, 'declined');
    setIncomingCall(null);
  }, [incomingCall]);

  // If on ChatPage, don't render here — ChatPage handles its own UI
  // But we still keep the socket listener active for when user is NOT on chat
  if (!incomingCall || isOnChatPage) return null;

  // ── Incoming call overlay (shown when NOT on ChatPage) ──
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-bounce-slow">
        {/* Call icon */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </div>

        {/* Caller info */}
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          {incomingCall.callerName}
        </h3>
        <p className="text-gray-500 mb-6">
          Incoming {incomingCall.callType} call...
        </p>

        {/* Action buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleDecline}
            className="flex-1 py-3 px-6 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors shadow-lg"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 py-3 px-6 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors shadow-lg"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
