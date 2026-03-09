/**
 * ScheduledCallsPanel — Slide-over panel showing upcoming scheduled calls.
 *
 * Lists scheduled calls with RSVP status, start button, and details.
 * Follows the same slide-over pattern as CallHistoryPanel.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  CalendarDaysIcon,
  PhoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { StaffChatModel, type ScheduledCall } from '../../../models/StaffChatModel';
import { getInitials, getFileUrl } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface ScheduledCallsPanelProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  conversationId?: number | null;
  onStartCall: (scheduledCallId: number) => void;
  onEdit: (sc: ScheduledCall) => void;
}

export default function ScheduledCallsPanel({
  open,
  onClose,
  currentUserId,
  conversationId,
  onStartCall,
  onEdit,
}: ScheduledCallsPanelProps) {
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (conversationId) params.conversation_id = conversationId;
      if (filter === 'upcoming') {
        params.upcoming = true;
      } else {
        params.status = 'all';
      }
      const data = await StaffChatModel.getScheduledCalls(params);
      setCalls(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [conversationId, filter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!open) return null;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`;
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const getTimeUntil = (dateStr: string) => {
    const ms = new Date(dateStr).getTime() - Date.now();
    if (ms <= 0) return 'Starting now';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `in ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  };

  const isStartable = (sc: ScheduledCall) => {
    if (sc.status !== 'scheduled') return false;
    if (sc.created_by !== currentUserId) return false;
    // Can start 5 minutes before scheduled time
    const ms = new Date(sc.scheduled_at).getTime() - Date.now();
    return ms < 5 * 60 * 1000;
  };

  const handleRsvp = async (sc: ScheduledCall, rsvp: 'accepted' | 'declined') => {
    try {
      await StaffChatModel.rsvpScheduledCall(sc.id, rsvp);
      notify.success(rsvp === 'accepted' ? 'Accepted!' : 'Declined');
      // Refresh
      setCalls((prev) =>
        prev.map((c) =>
          c.id === sc.id ? { ...c, my_rsvp: rsvp } : c
        )
      );
    } catch {
      notify.error('Failed to update RSVP');
    }
  };

  const handleCancel = async (sc: ScheduledCall) => {
    try {
      await StaffChatModel.cancelScheduledCall(sc.id);
      notify.success('Call cancelled');
      setCalls((prev) => prev.filter((c) => c.id !== sc.id));
    } catch {
      notify.error('Failed to cancel');
    }
  };

  const recurrenceLabel: Record<string, string> = {
    none: '',
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Every 2 weeks',
    monthly: 'Monthly',
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[420px] max-w-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Scheduled Calls</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-200 px-5">
          {(['upcoming', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                filter === f
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'upcoming' ? 'Upcoming' : 'All Calls'}
            </button>
          ))}
        </div>

        {/* Call list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CalendarDaysIcon className="w-12 h-12 mb-3" />
              <p className="text-sm">No scheduled calls</p>
              <p className="text-xs mt-1">Schedule one from the chat header</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {calls.map((sc) => {
                const isCreator = sc.created_by === currentUserId;
                const canStart = isStartable(sc);
                const isPast = new Date(sc.scheduled_at) < new Date();
                const acceptedCount = sc.participants?.filter((p) => p.rsvp === 'accepted').length || 0;
                const totalParticipants = sc.participants?.length || 0;

                return (
                  <div
                    key={sc.id}
                    className={`px-5 py-4 hover:bg-gray-50 transition-colors ${
                      sc.status === 'cancelled' ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Top row: title + type badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{sc.title}</h4>
                        {sc.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sc.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {sc.call_type === 'video' ? (
                          <VideoCameraIcon className="w-4 h-4 text-blue-500" />
                        ) : (
                          <PhoneIcon className="w-4 h-4 text-green-500" />
                        )}
                        {sc.screen_share && (
                          <ComputerDesktopIcon className="w-4 h-4 text-purple-500" title="Screen sharing" />
                        )}
                      </div>
                    </div>

                    {/* Date/Time + Duration */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        {formatDateTime(sc.scheduled_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatDuration(sc.duration_minutes)}
                      </span>
                      {sc.recurrence !== 'none' && (
                        <span className="flex items-center gap-1 text-blue-500">
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          {recurrenceLabel[sc.recurrence]}
                        </span>
                      )}
                    </div>

                    {/* Time until */}
                    {sc.status === 'scheduled' && !isPast && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <ClockIcon className="w-3 h-3" />
                          {getTimeUntil(sc.scheduled_at)}
                        </span>
                      </div>
                    )}

                    {/* Status badge for non-scheduled */}
                    {sc.status !== 'scheduled' && (
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                          sc.status === 'active' ? 'bg-green-50 text-green-700' :
                          sc.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {sc.status === 'active' ? '🔴 In Progress' :
                           sc.status === 'completed' ? 'Completed' : 'Cancelled'}
                        </span>
                      </div>
                    )}

                    {/* Participants */}
                    {totalParticipants > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <UserGroupIcon className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex -space-x-1.5">
                          {sc.participants.slice(0, 5).map((p) => (
                            <div
                              key={p.user_id}
                              title={`${p.name} — ${p.rsvp}`}
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-white ${
                                p.rsvp === 'accepted'
                                  ? 'bg-green-100 text-green-700'
                                  : p.rsvp === 'declined'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {p.avatar_url ? (
                                <img src={getFileUrl(p.avatar_url)} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                getInitials(p.name)
                              )}
                            </div>
                          ))}
                          {totalParticipants > 5 && (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-gray-200 text-gray-600 border-2 border-white">
                              +{totalParticipants - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {acceptedCount}/{totalParticipants} accepted
                        </span>
                      </div>
                    )}

                    {/* RSVP + Action buttons */}
                    {sc.status === 'scheduled' && (
                      <div className="flex items-center gap-2 mt-3">
                        {/* RSVP buttons (if not creator) */}
                        {!isCreator && sc.my_rsvp === 'pending' && (
                          <>
                            <button
                              onClick={() => handleRsvp(sc, 'accepted')}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleRsvp(sc, 'declined')}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <XCircleIcon className="w-3.5 h-3.5" />
                              Decline
                            </button>
                          </>
                        )}

                        {/* RSVP status display */}
                        {sc.my_rsvp === 'accepted' && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            You accepted
                          </span>
                        )}
                        {sc.my_rsvp === 'declined' && !isCreator && (
                          <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                            <XCircleIcon className="w-3.5 h-3.5" />
                            You declined
                          </span>
                        )}

                        <div className="flex-1" />

                        {/* Creator actions */}
                        {isCreator && (
                          <>
                            {canStart && (
                              <button
                                onClick={() => onStartCall(sc.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                              >
                                <PlayIcon className="w-3.5 h-3.5" />
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => onEdit(sc)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancel(sc)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancel call"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
