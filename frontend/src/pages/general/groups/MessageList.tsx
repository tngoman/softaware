/**
 * MessageList — renders chat messages with media, replies, search highlights,
 * and typing indicator.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  DocumentIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UnifiedGroup, UnifiedMessage } from './chatTypes';
import {
  getInitials,
  formatMessageTime,
  sanitizeMessage,
  getFileUrl,
  isImageMessage,
  isVideoMessage,
  isAudioMessage,
  isOutgoingMessage,
} from './chatTypes';

// ── Sub-components ──────────────────────────────────────────

const HighlightText: React.FC<{ text: string; query: string; isCurrentMatch: boolean }> = React.memo(
  ({ text, query, isCurrentMatch }) => {
    if (!query.trim() || !text) return <>{text}</>;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.substring(0, idx)}
        <span className={`px-0.5 rounded-sm text-black ${isCurrentMatch ? 'bg-amber-400' : 'bg-yellow-200'}`}>
          {text.substring(idx, idx + query.length)}
        </span>
        {text.substring(idx + query.length)}
      </>
    );
  },
);

const ImageLightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({
  src,
  alt,
  onClose,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
    onClick={onClose}
  >
    <div className="relative max-w-[90vw] max-h-[90vh]">
      <img
        src={src}
        alt={alt || 'Image'}
        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
      />
      <button
        className="absolute -top-3 -right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  </div>
);

// ── Props ───────────────────────────────────────────────────

interface MessageListProps {
  messages: UnifiedMessage[];
  selectedGroup: UnifiedGroup;
  loadingMessages: boolean;
  currentUserNameLower: string;
  searchQuery: string;
  searchResults: { messageId: string; index: number }[];
  currentSearchIdx: number;
  onReply: (msg: UnifiedMessage) => void;
  onLightbox: (src: string) => void;
  lightboxSrc: string | null;
  onCloseLightbox: () => void;
  /** Ref so parent can control scroll */
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedGroup,
  loadingMessages,
  currentUserNameLower,
  searchQuery,
  searchResults,
  currentSearchIdx,
  onReply,
  onLightbox,
  lightboxSrc,
  onCloseLightbox,
  messagesEndRef,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive (unless user scrolled up)
  const isNearBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

  // ── Render ──────────────────────────────────────────────

  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30"
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="h-8 w-8 border-2 border-picton-blue border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mb-3 opacity-50" />
            <h3 className="text-base font-medium">No messages yet</h3>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOutgoing = isOutgoingMessage(msg, currentUserNameLower);

              // Reply content
              let repliedMsg: UnifiedMessage | undefined;
              if (msg.reply_to_content) {
                repliedMsg = {
                  id: '',
                  text: msg.reply_to_content,
                  user_name: msg.reply_to_user_name || 'Unknown',
                  timestamp: 0,
                };
              } else if (msg.reply_to_message_id) {
                repliedMsg = messages.find((m) => m.id === msg.reply_to_message_id);
              }

              const currentSearchResult = searchResults[currentSearchIdx];
              const isCurrentSearchMatch = currentSearchResult?.messageId === msg.id;

              return (
                <div
                  key={msg.id}
                  id={`group-message-${msg.id}`}
                  className={`flex gap-2 max-w-[75%] ${
                    isOutgoing ? 'flex-row-reverse ml-auto' : 'mr-auto'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 min-w-[32px] items-center justify-center rounded-full text-xs font-semibold shrink-0 ${
                      isOutgoing ? 'bg-picton-blue text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {getInitials(msg.user_name)}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`flex-1 rounded-2xl px-4 py-2.5 shadow-sm group ${
                      isOutgoing
                        ? 'bg-picton-blue text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md border'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          isOutgoing ? 'text-white/80' : 'text-picton-blue'
                        }`}
                      >
                        {msg.user_name}
                      </span>
                      <button
                        className={`shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isOutgoing ? 'hover:bg-white/20' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => onReply(msg)}
                        title="Reply"
                      >
                        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Reply preview */}
                    {repliedMsg && (
                      <div
                        className={`mb-1.5 rounded border-l-2 border-l-purple-500 px-2.5 py-1.5 text-xs ${
                          isOutgoing ? 'bg-white/15' : 'bg-gray-100'
                        }`}
                      >
                        <div className="font-semibold mb-0.5">{repliedMsg.user_name}</div>
                        <div className="opacity-80">
                          {repliedMsg.file_url ? (
                            <span>📎 {repliedMsg.file_name || 'File'}</span>
                          ) : (
                            (repliedMsg.text || '').substring(0, 100) +
                            ((repliedMsg.text?.length ?? 0) > 100 ? '…' : '')
                          )}
                        </div>
                      </div>
                    )}

                    {/* Message content */}
                    <div className="text-sm leading-relaxed break-words">
                      {/* Image */}
                      {(msg.message_type === 'image' ||
                        (msg.file_type && msg.file_type.startsWith('image/'))) &&
                        msg.file_url && (
                          <img
                            src={getFileUrl(msg.file_url)}
                            alt={msg.file_name || 'Image'}
                            className="max-w-full max-h-[300px] rounded cursor-pointer mb-1"
                            onClick={() => onLightbox(getFileUrl(msg.file_url))}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}

                      {/* Video */}
                      {(msg.message_type === 'video' ||
                        (msg.file_type && msg.file_type.startsWith('video/'))) &&
                        msg.file_url && (
                          <video
                            controls
                            className="max-h-[300px] max-w-full rounded mb-1"
                            preload="metadata"
                          >
                            <source src={getFileUrl(msg.file_url)} />
                          </video>
                        )}

                      {/* Audio */}
                      {(msg.message_type === 'audio' ||
                        (msg.file_type && msg.file_type.startsWith('audio/'))) &&
                        msg.file_url && (
                          <audio controls preload="metadata" className="w-full mt-1 mb-1">
                            <source src={getFileUrl(msg.file_url)} />
                          </audio>
                        )}

                      {/* Generic file */}
                      {msg.file_url &&
                        msg.message_type !== 'image' &&
                        msg.message_type !== 'video' &&
                        msg.message_type !== 'audio' &&
                        !(
                          msg.file_type &&
                          (msg.file_type.startsWith('image/') ||
                            msg.file_type.startsWith('video/') ||
                            msg.file_type.startsWith('audio/'))
                        ) && (
                          <a
                            href={getFileUrl(msg.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center gap-2 rounded p-2 mb-1 text-sm ${
                              isOutgoing
                                ? 'bg-white/10 hover:bg-white/20 text-white/90'
                                : 'bg-gray-100 hover:bg-gray-200 text-picton-blue'
                            }`}
                          >
                            <DocumentIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{msg.file_name || 'Download file'}</span>
                            {msg.file_size && (
                              <span className="text-xs opacity-60 shrink-0">
                                ({(msg.file_size / 1024).toFixed(0)} KB)
                              </span>
                            )}
                          </a>
                        )}

                      {/* Plain text / inline media detection */}
                      {!msg.file_url &&
                        (isVideoMessage(msg.text) ? (
                          <video controls className="max-h-[300px] max-w-full rounded" preload="metadata">
                            <source src={msg.text} />
                          </video>
                        ) : isAudioMessage(msg.text) ? (
                          <audio controls preload="metadata" className="w-full mt-1">
                            <source src={msg.text} />
                          </audio>
                        ) : isImageMessage(msg.text) ? (
                          <img
                            src={msg.text}
                            alt="Shared media"
                            className="max-w-full max-h-[300px] rounded cursor-pointer"
                            onClick={() => onLightbox(msg.text)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).alt = 'Failed to load image';
                            }}
                          />
                        ) : searchQuery.trim() ? (
                          <HighlightText
                            text={msg.text || ''}
                            query={searchQuery}
                            isCurrentMatch={isCurrentSearchMatch}
                          />
                        ) : (
                          <div
                            dangerouslySetInnerHTML={{
                              __html: sanitizeMessage(msg.text),
                            }}
                          />
                        ))}

                      {/* Caption under file */}
                      {msg.file_url &&
                        (msg.caption || (msg.text && msg.text !== msg.file_name)) && (
                          <div
                            className="mt-1"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeMessage(msg.caption || msg.text),
                            }}
                          />
                        )}
                    </div>

                    {/* Timestamp */}
                    <div
                      className={`mt-1 flex items-center gap-1 text-[10px] ${
                        isOutgoing ? 'text-white/60' : 'text-gray-400'
                      }`}
                    >
                      <ClockIcon className="h-3 w-3" />
                      {formatMessageTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={onCloseLightbox} />}
    </>
  );
};

export default React.memo(MessageList);
