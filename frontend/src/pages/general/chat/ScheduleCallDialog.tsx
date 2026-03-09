/**
 * ScheduleCallDialog — Modal for creating / editing a scheduled call.
 *
 * Fields: title, description, date/time, call type, screen-share toggle,
 * duration, recurrence. Follows the same modal pattern as NewGroupDialog.
 */
import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  PhoneIcon,
  VideoCameraIcon,
  ComputerDesktopIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { StaffChatModel, type ScheduledCall } from '../../../models/StaffChatModel';
import { notify } from '../../../utils/notify';

interface ScheduleCallDialogProps {
  open: boolean;
  onClose: () => void;
  conversationId: number | null;
  conversationName: string;
  /** If provided, we are editing an existing call */
  existing?: ScheduledCall | null;
  onCreated: (sc: ScheduledCall) => void;
}

export default function ScheduleCallDialog({
  open,
  onClose,
  conversationId,
  conversationName,
  existing,
  onCreated,
}: ScheduleCallDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [callType, setCallType] = useState<'voice' | 'video'>('video');
  const [screenShare, setScreenShare] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (existing) {
        setTitle(existing.title);
        setDescription(existing.description || '');
        setCallType(existing.call_type);
        setScreenShare(existing.screen_share);
        const dt = new Date(existing.scheduled_at);
        setScheduledDate(dt.toISOString().split('T')[0]);
        setScheduledTime(dt.toTimeString().slice(0, 5));
        setDurationMinutes(existing.duration_minutes);
        setRecurrence(existing.recurrence);
        setRecurrenceEnd(existing.recurrence_end ? existing.recurrence_end.split('T')[0] : '');
      } else {
        setTitle('');
        setDescription('');
        setCallType('video');
        setScreenShare(false);
        // Default to tomorrow, next half-hour
        const now = new Date();
        now.setDate(now.getDate() + 1);
        setScheduledDate(now.toISOString().split('T')[0]);
        const mins = now.getMinutes();
        const roundedMins = mins < 30 ? 30 : 0;
        if (roundedMins === 0) now.setHours(now.getHours() + 1);
        setScheduledTime(`${String(now.getHours()).padStart(2, '0')}:${String(roundedMins).padStart(2, '0')}`);
        setDurationMinutes(30);
        setRecurrence('none');
        setRecurrenceEnd('');
      }
    }
  }, [open, existing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!title.trim()) {
      notify.error('Please enter a title');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      notify.error('Please select date and time');
      return;
    }
    if (!conversationId) {
      notify.error('No conversation selected');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

    // Must be in the future
    if (new Date(scheduledAt) <= new Date()) {
      notify.error('Scheduled time must be in the future');
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        const updated = await StaffChatModel.updateScheduledCall(existing.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          call_type: callType,
          screen_share: screenShare,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          recurrence,
          recurrence_end: recurrence !== 'none' && recurrenceEnd ? `${recurrenceEnd}T23:59:59.000Z` : undefined,
        });
        notify.success('Call updated');
        onCreated(updated);
      } else {
        const created = await StaffChatModel.createScheduledCall({
          conversation_id: conversationId,
          title: title.trim(),
          description: description.trim() || undefined,
          call_type: callType,
          screen_share: screenShare,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          recurrence,
          recurrence_end: recurrence !== 'none' && recurrenceEnd ? `${recurrenceEnd}T23:59:59.000Z` : undefined,
        });
        notify.success('Call scheduled!');
        onCreated(created);
      }
      onClose();
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Failed to schedule call');
    } finally {
      setSaving(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {existing ? 'Edit Scheduled Call' : 'Schedule a Call'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Conversation label */}
          <div className="text-xs text-gray-500">
            Scheduling for <span className="font-medium text-gray-700">{conversationName}</span>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Planning Call"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or agenda..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarDaysIcon className="w-4 h-4 inline mr-1" />
                Date *
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={minDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <ClockIcon className="w-4 h-4 inline mr-1" />
                Time *
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          {/* Call Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Call Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCallType('voice')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all text-sm font-medium ${
                  callType === 'voice'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <PhoneIcon className="w-4 h-4" />
                Voice
              </button>
              <button
                type="button"
                onClick={() => setCallType('video')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 transition-all text-sm font-medium ${
                  callType === 'video'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <VideoCameraIcon className="w-4 h-4" />
                Video
              </button>
            </div>
          </div>

          {/* Screen Share toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <ComputerDesktopIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Enable screen sharing</span>
            </div>
            <button
              type="button"
              onClick={() => setScreenShare(!screenShare)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                screenShare ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  screenShare ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ArrowPathIcon className="w-4 h-4 inline mr-1" />
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Recurrence end date (only if recurring) */}
          {recurrence !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repeat until</label>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                min={scheduledDate || minDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !scheduledDate || !scheduledTime}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CalendarDaysIcon className="w-4 h-4" />
            )}
            {existing ? 'Update Call' : 'Schedule Call'}
          </button>
        </div>
      </div>
    </div>
  );
}
