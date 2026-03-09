import React, { useState, useRef, useEffect } from 'react';
import {
  PhoneIcon,
  VideoCameraIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  UsersIcon,
  ArrowLeftIcon,
  InformationCircleIcon,
  ArchiveBoxIcon,
  ArchiveBoxXMarkIcon,
  BellSlashIcon,
  BellIcon,
  TrashIcon,
  SpeakerWaveIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import type { Conversation } from '../../../models/StaffChatModel';
import { StaffChatModel } from '../../../models/StaffChatModel';
import { getInitials, getFileUrl } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface ChatHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  onSearchInChat: () => void;
  onShowInfo: () => void;
  onPin: (pinned: boolean) => void;
  onArchive: (archived: boolean) => void;
  onMute: (until: string | null) => void;
  onClearChat: () => void;
  onlineUsers: Set<string>;
  typingUsers: string[];
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onScheduleCall?: () => void;
  onShowScheduledCalls?: () => void;
}

export default function ChatHeader({
  conversation,
  onBack,
  onSearchInChat,
  onShowInfo,
  onPin,
  onArchive,
  onMute,
  onClearChat,
  onlineUsers,
  typingUsers,
  onVoiceCall,
  onVideoCall,
  onScheduleCall,
  onShowScheduledCalls,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [muteSubOpen, setMuteSubOpen] = useState(false);
  const [soundSubOpen, setSoundSubOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDM = conversation.type === 'direct';
  const name = isDM ? conversation.dm_other_name : conversation.name;
  const avatar = isDM ? conversation.dm_other_avatar : conversation.icon_url;
  const dmOnline = isDM && conversation.dm_other_user_id ? onlineUsers.has(conversation.dm_other_user_id) : false;
  const isMuted = !!conversation.muted_until;

  // Close menu on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMuteSubOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  // Build subtitle
  let subtitle = '';
  if (typingUsers.length > 0) {
    subtitle = typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.join(', ')} are typing...`;
  } else if (isDM) {
    subtitle = dmOnline ? 'Online' : 'Offline';
  } else {
    const count = conversation.member_count || 0;
    const onlineCount = Array.from(onlineUsers).length; // approximate
    subtitle = `${count} members`;
    if (onlineCount > 0) subtitle += ` · ${onlineCount} online`;
  }

  const handleMuteDuration = (label: string) => {
    let until: string | null = null;
    const now = new Date();
    switch (label) {
      case '1h': now.setHours(now.getHours() + 1); until = now.toISOString(); break;
      case '8h': now.setHours(now.getHours() + 8); until = now.toISOString(); break;
      case '1d': now.setDate(now.getDate() + 1); until = now.toISOString(); break;
      case '1w': now.setDate(now.getDate() + 7); until = now.toISOString(); break;
      case 'forever': until = '2099-12-31T23:59:59.000Z'; break;
      default: until = null;
    }
    onMute(until);
    setMenuOpen(false);
    setMuteSubOpen(false);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
      {/* Back button (mobile) */}
      <button
        onClick={onBack}
        className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </button>

      {/* Avatar */}
      <button onClick={onShowInfo} className="flex-shrink-0 relative">
        {avatar ? (
          <img
            src={getFileUrl(avatar)}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
            isDM ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            {isDM ? getInitials(name) : <UsersIcon className="w-5 h-5" />}
          </div>
        )}
        {isDM && dmOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        )}
      </button>

      {/* Name + status */}
      <button onClick={onShowInfo} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{name || 'Unnamed'}</h3>
          {conversation.pinned && <span className="text-xs flex-shrink-0" title="Pinned">📌</span>}
          {isMuted && <span className="text-xs flex-shrink-0" title="Muted">🔇</span>}
        </div>
        <p className={`text-xs truncate ${typingUsers.length > 0 ? 'text-green-600 italic' : 'text-gray-500'}`}>
          {subtitle}
        </p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Voice call */}
        <button
          onClick={onVoiceCall}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600 transition-colors"
          title="Voice call"
        >
          <PhoneIcon className="w-5 h-5" />
        </button>

        {/* Video call */}
        <button
          onClick={onVideoCall}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
          title="Video call"
        >
          <VideoCameraIcon className="w-5 h-5" />
        </button>

        {/* Schedule call */}
        {onScheduleCall && (
          <button
            onClick={onScheduleCall}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-purple-600 transition-colors"
            title="Schedule a call"
          >
            <CalendarDaysIcon className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onSearchInChat}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          title="Search in conversation"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
        </button>

        {/* Dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setMuteSubOpen(false); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="More options"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Info */}
              <button
                onClick={() => { onShowInfo(); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                Conversation info
              </button>

              {/* Scheduled calls */}
              {onShowScheduledCalls && (
                <button
                  onClick={() => { onShowScheduledCalls(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
                  Scheduled calls
                </button>
              )}

              <div className="border-t border-gray-100 my-1" />

              {/* Pin / Unpin */}
              <button
                onClick={() => { onPin(!conversation.pinned); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center text-sm">
                  {conversation.pinned ? '📍' : '📌'}
                </span>
                {conversation.pinned ? 'Unpin conversation' : 'Pin conversation'}
              </button>

              {/* Mute / Unmute */}
              <div className="relative">
                {isMuted ? (
                  <button
                    onClick={() => handleMuteDuration('unmute')}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <BellIcon className="w-4 h-4 text-gray-400" />
                    Unmute notifications
                  </button>
                ) : (
                  <button
                    onClick={() => setMuteSubOpen(!muteSubOpen)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <BellSlashIcon className="w-4 h-4 text-gray-400" />
                      Mute notifications
                    </span>
                    <svg className={`w-3 h-3 text-gray-400 transition-transform ${muteSubOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Mute duration submenu */}
                {muteSubOpen && !isMuted && (
                  <div className="pl-4 bg-gray-50/50">
                    {[
                      { label: '1h', text: '1 hour' },
                      { label: '8h', text: '8 hours' },
                      { label: '1d', text: '1 day' },
                      { label: '1w', text: '1 week' },
                      { label: 'forever', text: 'Always' },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleMuteDuration(opt.label)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification sound */}
              <div className="relative">
                <button
                  onClick={() => { setSoundSubOpen(!soundSubOpen); setMuteSubOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <SpeakerWaveIcon className="w-4 h-4 text-gray-400" />
                    Notification sound
                  </span>
                  <svg className={`w-3 h-3 text-gray-400 transition-transform ${soundSubOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {soundSubOpen && (
                  <div className="pl-4 bg-gray-50/50">
                    {[
                      { value: null, label: 'Default' },
                      { value: 'chime', label: '🔔 Chime' },
                      { value: 'ding', label: '🔊 Ding' },
                      { value: 'pop', label: '💬 Pop' },
                      { value: 'bell', label: '🛎️ Bell' },
                      { value: 'none', label: '🔇 None' },
                    ].map((opt) => (
                      <button
                        key={opt.value || 'default'}
                        onClick={async () => {
                          try {
                            await StaffChatModel.setNotificationSound(conversation.id, opt.value);
                            notify.success(`Sound: ${opt.label}`);
                          } catch {
                            notify.error('Failed to set sound');
                          }
                          setMenuOpen(false);
                          setSoundSubOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { onClearChat(); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <TrashIcon className="w-4 h-4 text-red-400" />
                Clear chat
              </button>

              {/* Archive / Unarchive */}
              <button
                onClick={() => { onArchive(!conversation.archived); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {conversation.archived ? (
                  <>
                    <ArchiveBoxXMarkIcon className="w-4 h-4 text-gray-400" />
                    Unarchive conversation
                  </>
                ) : (
                  <>
                    <ArchiveBoxIcon className="w-4 h-4 text-gray-400" />
                    Archive conversation
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
