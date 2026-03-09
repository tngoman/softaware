import React, { useState, useMemo } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import type { Conversation, ChatMessage } from '../../../models/StaffChatModel';
import { StaffChatModel } from '../../../models/StaffChatModel';
import { getInitials, getFileUrl, getMessagePreview } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface ForwardDialogProps {
  open: boolean;
  message: ChatMessage | null;
  conversations: Conversation[];
  currentConversationId: number | null;
  onClose: () => void;
}

export default function ForwardDialog({
  open,
  message,
  conversations,
  currentConversationId,
  onClose,
}: ForwardDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    return conversations
      .filter((c) => c.id !== currentConversationId)
      .filter((c) => {
        if (!search) return true;
        const name = c.type === 'direct' ? c.dm_other_name : c.name;
        return (name || '').toLowerCase().includes(search.toLowerCase());
      });
  }, [conversations, currentConversationId, search]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleForward = async () => {
    if (!message || selectedIds.size === 0) return;
    setSending(true);
    try {
      await StaffChatModel.forwardMessage(message.id, Array.from(selectedIds));
      notify.success(`Forwarded to ${selectedIds.size} conversation${selectedIds.size > 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setSearch('');
      onClose();
    } catch {
      notify.error('Failed to forward message');
    } finally {
      setSending(false);
    }
  };

  if (!open || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowTopRightOnSquareIcon className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Forward message</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview */}
        <div className="mx-5 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-0.5">{message.sender_name}</p>
          <p className="text-sm text-gray-700 truncate">
            {getMessagePreview(message.content, message.message_type)}
          </p>
        </div>

        {/* Search */}
        <div className="px-5 pt-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pt-2">
            {Array.from(selectedIds).map((id) => {
              const conv = conversations.find((c) => c.id === id);
              if (!conv) return null;
              const name = conv.type === 'direct' ? conv.dm_other_name : conv.name;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  {name || 'Unnamed'}
                  <button onClick={() => toggleSelect(id)}>
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto mt-2 min-h-0 max-h-64">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No conversations found</p>
          ) : (
            filtered.map((conv) => {
              const isDM = conv.type === 'direct';
              const name = isDM ? conv.dm_other_name : conv.name;
              const avatar = isDM ? conv.dm_other_avatar : conv.icon_url;
              const isSelected = selectedIds.has(conv.id);

              return (
                <button
                  key={conv.id}
                  onClick={() => toggleSelect(conv.id)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  {avatar ? (
                    <img src={getFileUrl(avatar)} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      isDM ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {isDM ? getInitials(name) : <UsersIcon className="w-4 h-4" />}
                    </div>
                  )}

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-400">{isDM ? 'Direct message' : `${conv.member_count || 0} members`}</p>
                  </div>

                  {/* Check */}
                  {isSelected ? (
                    <CheckCircleSolid className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <CheckCircleIcon className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleForward}
            disabled={selectedIds.size === 0 || sending}
            className="w-full py-2.5 px-4 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                Forward to {selectedIds.size || ''} conversation{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
