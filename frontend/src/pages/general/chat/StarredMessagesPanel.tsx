import React, { useEffect, useState } from 'react';
import {
  XMarkIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { StaffChatModel, type StarredMessage } from '../../../models/StaffChatModel';
import { renderMarkdown, getInitials, formatMessageTime, getFileUrl } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface StarredMessagesPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (conversationId: number, messageId: number) => void;
}

export default function StarredMessagesPanel({
  open,
  onClose,
  onNavigate,
}: StarredMessagesPanelProps) {
  const [starred, setStarred] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    StaffChatModel.getStarredMessages()
      .then((data) => setStarred(data))
      .catch(() => notify.error('Failed to load starred messages'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleUnstar = async (messageId: number) => {
    try {
      await StaffChatModel.toggleStar(messageId);
      setStarred((prev) => prev.filter((s) => s.id !== messageId));
      notify.success('Unstarred');
    } catch {
      notify.error('Failed to unstar');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-96 max-w-full bg-white shadow-xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <StarIconSolid className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900">Starred Messages</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : starred.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <StarIcon className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">No starred messages</p>
              <p className="text-xs mt-1">Star important messages to find them later</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {starred.map((msg) => (
                <div
                  key={msg.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                  onClick={() => onNavigate(msg.conversation_id, msg.id)}
                >
                  {/* Conversation name badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      {msg.conversation_name || 'Direct message'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnstar(msg.id);
                      }}
                      className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Unstar"
                    >
                      <StarIconSolid className="w-3.5 h-3.5 text-yellow-500" />
                    </button>
                  </div>

                  {/* Sender info */}
                  <div className="flex items-start gap-2">
                    {msg.sender_avatar ? (
                      <img
                        src={getFileUrl(msg.sender_avatar)}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0 mt-0.5">
                        {getInitials(msg.sender_name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-700">{msg.sender_name}</p>
                        <p className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</p>
                      </div>

                      {/* Message content */}
                      {msg.content ? (
                        <p
                          className="text-sm text-gray-600 mt-0.5 line-clamp-3"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      ) : msg.file_name ? (
                        <p className="text-sm text-gray-500 mt-0.5">📎 {msg.file_name}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mt-0.5">No content</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
