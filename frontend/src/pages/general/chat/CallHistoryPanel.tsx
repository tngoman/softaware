/**
 * CallHistoryPanel — Slide-over panel showing call history.
 *
 * Lists recent calls with status icons, duration, and participants.
 * Allows re-calling from history entries.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  PhoneIcon,
  VideoCameraIcon,
  PhoneArrowUpRightIcon,
  PhoneArrowDownLeftIcon,
  PhoneXMarkIcon,
} from '@heroicons/react/24/outline';
import { StaffChatModel, type CallHistoryEntry } from '../../../models/StaffChatModel';
import { getFileUrl, getInitials } from './chatHelpers';

interface CallHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onCall: (conversationId: number, callType: 'voice' | 'video') => void;
}

export default function CallHistoryPanel({
  open,
  onClose,
  currentUserId,
  onCall,
}: CallHistoryPanelProps) {
  const [calls, setCalls] = useState<CallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await StaffChatModel.getCallHistory(50, 0);
      setCalls(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const formatDuration = (secs: number | null) => {
    if (!secs || secs === 0) return '--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`;
  };

  const getStatusIcon = (call: CallHistoryEntry) => {
    const isOutgoing = call.initiated_by === currentUserId;
    const isMissed = call.status === 'missed';
    const isDeclined = call.status === 'declined';

    if (isMissed || isDeclined) {
      return <PhoneXMarkIcon className="w-4 h-4 text-red-500" />;
    }
    if (isOutgoing) {
      return <PhoneArrowUpRightIcon className="w-4 h-4 text-green-500" />;
    }
    return <PhoneArrowDownLeftIcon className="w-4 h-4 text-blue-500" />;
  };

  const getStatusLabel = (call: CallHistoryEntry) => {
    const isOutgoing = call.initiated_by === currentUserId;
    if (call.status === 'missed') return isOutgoing ? 'No answer' : 'Missed';
    if (call.status === 'declined') return 'Declined';
    if (call.status === 'ended') return formatDuration(call.duration_seconds);
    if (call.status === 'active') return 'Ongoing';
    if (call.status === 'ringing') return 'Ringing';
    return call.status;
  };

  const getName = (call: CallHistoryEntry) => {
    if (call.conversation_type === 'direct') {
      return call.other_user_name || call.caller_name || 'Unknown';
    }
    return call.conversation_name || 'Group call';
  };

  const getAvatar = (call: CallHistoryEntry) => {
    if (call.conversation_type === 'direct') {
      return call.other_user_avatar || call.caller_avatar;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-96 max-w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Call History</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Call list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <PhoneIcon className="w-12 h-12 mb-3" />
              <p className="text-sm">No call history yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {calls.map((call) => {
                const name = getName(call);
                const avatar = getAvatar(call);
                const isMissedOrDeclined = call.status === 'missed' || call.status === 'declined';

                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative">
                      {avatar ? (
                        <img
                          src={getFileUrl(avatar)}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                          call.conversation_type === 'direct'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {getInitials(name)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${
                          isMissedOrDeclined ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        {getStatusIcon(call)}
                        <span className={isMissedOrDeclined ? 'text-red-500' : ''}>
                          {getStatusLabel(call)}
                        </span>
                        <span>·</span>
                        <span>{formatTime(call.started_at)}</span>
                      </div>
                    </div>

                    {/* Call back button */}
                    <button
                      onClick={() => onCall(call.conversation_id, call.call_type)}
                      className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors"
                      title={`${call.call_type === 'video' ? 'Video' : 'Voice'} call`}
                    >
                      {call.call_type === 'video' ? (
                        <VideoCameraIcon className="w-5 h-5" />
                      ) : (
                        <PhoneIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
