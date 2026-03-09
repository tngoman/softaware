import React, { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  UsersIcon,
  ArchiveBoxIcon,
  MoonIcon,
  BellSlashIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type { Conversation } from '../../../models/StaffChatModel';
import { StaffChatModel } from '../../../models/StaffChatModel';
import { getInitials, formatTime, getMessagePreview, getFileUrl } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface ChatSidebarProps {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (conv: Conversation) => void;
  onNewDM: () => void;
  onNewGroup: () => void;
  onShowStarred: () => void;
  onGlobalSearch: () => void;
  onCallHistory: () => void;
  typingMap: Map<number, string[]>; // conversationId → [userName, ...]
}

type TabFilter = 'all' | 'direct' | 'group';

export default function ChatSidebar({
  conversations,
  selectedId,
  onSelect,
  onNewDM,
  onNewGroup,
  onShowStarred,
  onGlobalSearch,
  onCallHistory,
  typingMap,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showDnd, setShowDnd] = useState(false);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('07:00');
  // Load DND settings on mount
  useEffect(() => {
    StaffChatModel.getDndSettings().then((s) => {
      setDndEnabled(s.enabled);
      if (s.start) setDndStart(s.start.slice(0, 5)); // HH:MM
      if (s.end) setDndEnd(s.end.slice(0, 5));
    }).catch(() => {});
  }, []);

  const handleSaveDnd = useCallback(async () => {
    try {
      await StaffChatModel.updateDndSettings({ enabled: dndEnabled, start: dndStart, end: dndEnd });
      setShowDnd(false);
      notify.success(dndEnabled ? `DND: ${dndStart} – ${dndEnd}` : 'DND disabled');
    } catch {
      notify.error('Failed to save DND settings');
    }
  }, [dndEnabled, dndStart, dndEnd]);

  const filtered = conversations.filter((c) => {
    // Tab filter
    if (tab === 'direct' && c.type !== 'direct') return false;
    if (tab === 'group' && c.type !== 'group') return false;
    // Archive filter
    if (!showArchived && c.archived) return false;
    if (showArchived && !c.archived) return false;
    // Search
    if (search) {
      const name = c.type === 'direct' ? c.dm_other_name : c.name;
      return (name || '').toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setShowDnd(true)}
              className={`p-2 rounded-lg hover:bg-gray-100 ${dndEnabled ? 'text-purple-500' : 'text-gray-400'} hover:text-purple-600`}
              title="Do Not Disturb"
            >
              {dndEnabled ? <BellSlashIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={onCallHistory}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600"
              title="Call history"
            >
              <PhoneIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onShowStarred}
              className="p-2 rounded-lg hover:bg-gray-100 text-yellow-500 hover:text-yellow-600"
              title="Starred messages"
            >
              <StarIconSolid className="w-5 h-5" />
            </button>
            <button
              onClick={onNewDM}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="New direct message"
            >
              <UserIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onNewGroup}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title="New group"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={onGlobalSearch}
          className="w-full mt-1 text-xs text-blue-500 hover:text-blue-700 text-left pl-1"
        >
          🔍 Search all messages...
        </button>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(['all', 'direct', 'group'] as TabFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t === 'all' ? 'All' : t === 'direct' ? 'DMs' : 'Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ChatBubbleLeftRightIcon className="w-10 h-10 mb-2" />
            <p className="text-sm">{search ? 'No matches' : 'No conversations yet'}</p>
          </div>
        )}

        {filtered.map((conv) => {
          const isSelected = conv.id === selectedId;
          const name = conv.type === 'direct' ? conv.dm_other_name : conv.name;
          const avatar = conv.type === 'direct' ? conv.dm_other_avatar : conv.icon_url;
          const typing = typingMap.get(conv.id);
          const hasTyping = typing && typing.length > 0;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 ${
                isSelected
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {avatar ? (
                  <img
                    src={getFileUrl(avatar)}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    conv.type === 'direct' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {conv.type === 'group' ? (
                      <UsersIcon className="w-5 h-5" />
                    ) : (
                      getInitials(name)
                    )}
                  </div>
                )}
                {!!conv.pinned && (
                  <span className="absolute -top-1 -right-1 text-xs">📌</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {name || 'Unnamed'}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {formatTime(conv.last_message_at || conv.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500 truncate">
                    {hasTyping
                      ? <span className="text-green-600 italic">{typing!.join(', ')} typing...</span>
                      : getMessagePreview(conv.last_message_content, conv.last_message_type)
                    }
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 text-xs font-bold text-white bg-blue-500 rounded-full min-w-[20px] text-center">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </span>
                  )}
                  {conv.muted_until && (
                    <span className="flex-shrink-0 ml-1 text-gray-400 text-xs">🔇</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="w-full flex items-center gap-2 px-4 py-3 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50"
        >
          <ArchiveBoxIcon className="w-4 h-4" />
          {showArchived ? 'Back to conversations' : 'Archived conversations'}
        </button>
      </div>

      {/* DND Settings Modal */}
      {showDnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDnd(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-80 max-w-[90vw] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <MoonIcon className="w-5 h-5 text-purple-500" />
              <h3 className="text-base font-semibold text-gray-900">Do Not Disturb</h3>
            </div>

            {/* Enable toggle */}
            <label className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-700">Enable schedule</span>
              <button
                onClick={() => setDndEnabled(!dndEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dndEnabled ? 'bg-purple-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    dndEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Time range */}
            {dndEnabled && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">Start (silent from)</label>
                    <input
                      type="time"
                      value={dndStart}
                      onChange={(e) => setDndStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">→</span>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">End (resume at)</label>
                    <input
                      type="time"
                      value={dndEnd}
                      onChange={(e) => setDndEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  You won't receive push notifications during this time (except @mentions).
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowDnd(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDnd}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
