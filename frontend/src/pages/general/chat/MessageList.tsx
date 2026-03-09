import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ArrowDownIcon,
  ArrowUturnLeftIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
  FaceSmileIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type { ChatMessage, ReactionGroup } from '../../../models/StaffChatModel';
import EmojiPicker from './EmojiPicker';
import ImageLightbox from './ImageLightbox';
import AudioPlayer from './AudioPlayer';
import {
  sanitize,
  renderMarkdown,
  getInitials,
  formatMessageTime,
  formatDateSeparator,
  getFileUrl,
  formatFileSize,
  downloadWithProgress,
  isImageType,
  isVideoType,
  isAudioType,
  QUICK_REACTIONS,
} from './chatHelpers';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onReaction: (messageId: number, emoji: string) => void;
  onStar: (messageId: number) => void;
  onForward: (msg: ChatMessage) => void;
  onReport: (msg: ChatMessage) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  starredIds: Set<number>;
  lastReadMessageId?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Date separator                                                      */
/* ------------------------------------------------------------------ */
function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="px-3 py-1 bg-gray-100 rounded-full">
        <span className="text-xs font-medium text-gray-500">{formatDateSeparator(date)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status ticks                                                        */
/* ------------------------------------------------------------------ */
function StatusTicks({ status }: { status: string }) {
  switch (status) {
    case 'sent':
      return <span className="text-gray-400 text-[10px]">✓</span>;
    case 'delivered':
      return <span className="text-gray-400 text-[10px]">✓✓</span>;
    case 'read':
      return <span className="text-blue-500 text-[10px]">✓✓</span>;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Reactions bar                                                       */
/* ------------------------------------------------------------------ */
function ReactionsBar({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: ReactionGroup[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => {
        const myReaction = r.reacted_by_me;
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full border transition-colors ${
              myReaction
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
            title={r.users.map((u) => u.display_name).join(', ')}
          >
            <span>{r.emoji}</span>
            <span className="font-medium">{r.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  File attachment rendering                                           */
/* ------------------------------------------------------------------ */
function FileAttachment({ msg, onImageClick }: { msg: ChatMessage; onImageClick?: () => void }) {
  // Location messages — render a map card
  if (msg.message_type === 'location' && msg.content) {
    try {
      const loc = JSON.parse(msg.content);
      const { lat, lng, address } = loc;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=300x150&markers=color:red%7C${lat},${lng}&key=`;
      return (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 rounded-lg overflow-hidden border border-gray-200 max-w-[280px] hover:opacity-90 transition-opacity"
        >
          <div className="bg-blue-50 h-28 flex items-center justify-center">
            <div className="text-center">
              <span className="text-3xl">📍</span>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
            </div>
          </div>
          {address && (
            <div className="px-3 py-2 bg-white">
              <p className="text-xs text-gray-600 line-clamp-2">{address}</p>
            </div>
          )}
          <div className="px-3 py-1.5 bg-gray-50 text-center">
            <span className="text-xs text-blue-500 font-medium">Open in Google Maps →</span>
          </div>
        </a>
      );
    } catch {
      // Fall through to text rendering if parse fails
    }
  }

  // Contact/staff card messages — render a contact card
  if (msg.message_type === 'contact' && msg.content) {
    try {
      const contact = JSON.parse(msg.content);
      const { name, email, phone } = contact;
      return (
        <div className="mt-1 rounded-lg border border-gray-200 overflow-hidden max-w-[260px]">
          <div className="flex items-center gap-3 px-3 py-3 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
              {name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{name || 'Unknown'}</p>
              <p className="text-xs text-gray-500">Staff member</p>
            </div>
          </div>
          <div className="px-3 py-2 space-y-1 bg-white">
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                <span>✉️</span> {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                <span>📱</span> {phone}
              </a>
            )}
          </div>
        </div>
      );
    } catch {
      // Fall through to text rendering if parse fails
    }
  }

  // GIF messages — render the GIF directly
  if (msg.message_type === 'gif' && msg.file_url) {
    const url = msg.file_url.startsWith('http') ? msg.file_url : getFileUrl(msg.file_url);
    return (
      <div className="mt-1">
        <img
          src={url}
          alt={msg.content || 'GIF'}
          className="max-w-[250px] max-h-[200px] rounded-lg object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (!msg.file_url) return null;
  const url = getFileUrl(msg.file_url);

  if (isImageType(msg.file_type)) {
    return (
      <button onClick={onImageClick} className="block mt-1 text-left cursor-pointer">
        <img
          src={url}
          alt={msg.file_name || 'Image'}
          className="max-w-xs max-h-64 rounded-lg object-cover hover:opacity-90 transition-opacity"
          loading="lazy"
        />
      </button>
    );
  }

  if (isVideoType(msg.file_type)) {
    return (
      <video
        src={url}
        controls
        className="max-w-xs max-h-48 rounded-lg mt-1"
        preload="metadata"
      />
    );
  }

  if (isAudioType(msg.file_type)) {
    return (
      <div className="mt-1">
        <AudioPlayer src={url} duration={msg.duration} compact />
      </div>
    );
  }

  // Generic file with download progress
  return <FileDownloadButton url={url} fileName={msg.file_name} fileSize={msg.file_size} />;
}

/* ------------------------------------------------------------------ */
/*  File download button with progress indicator                        */
/* ------------------------------------------------------------------ */
function FileDownloadButton({ url, fileName, fileSize }: { url: string; fileName?: string | null; fileSize?: number | null }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    setProgress(0);
    const success = await downloadWithProgress(url, fileName || 'download', setProgress);
    if (!success) {
      // Fallback to direct link
      window.open(url, '_blank');
    }
    setTimeout(() => {
      setDownloading(false);
      setProgress(0);
    }, 1000);
  };

  const ext = (fileName || 'FILE').split('.').pop()?.toUpperCase()?.slice(0, 4) || 'FILE';

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-white/60 rounded-lg border border-gray-200 hover:bg-gray-50 max-w-xs text-left transition-colors relative overflow-hidden"
    >
      {/* Progress bar background */}
      {downloading && (
        <div
          className="absolute inset-0 bg-blue-100/50 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      )}
      <div className="relative flex items-center gap-2 w-full">
        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
          {downloading ? (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : progress === 100 ? (
            <span className="text-green-500 text-sm">✓</span>
          ) : (
            ext
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-blue-600 truncate">{fileName || 'Download file'}</p>
          <p className="text-xs text-gray-400">
            {downloading
              ? `${progress}%`
              : fileSize
              ? formatFileSize(fileSize)
              : ''}
          </p>
        </div>
        {!downloading && (
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Reply preview                                                       */
/* ------------------------------------------------------------------ */
function ReplyPreview({ msg }: { msg: ChatMessage }) {
  if (!msg.reply_to_id || !msg.reply_to) return null;

  return (
    <div className="flex items-start gap-1 mb-1 pl-2 border-l-2 border-blue-300 text-xs">
      <div className="min-w-0">
        <p className="font-medium text-blue-600 truncate">{msg.reply_to.sender_name || 'Message'}</p>
        <p className="text-gray-500 truncate">{msg.reply_to.content}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main MessageList                                                    */
/* ------------------------------------------------------------------ */
export default function MessageList({
  messages,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onStar,
  onForward,
  onReport,
  onLoadMore,
  hasMore,
  loadingMore,
  starredIds,
  lastReadMessageId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<number | null>(null);
  const [fullEmojiPickerFor, setFullEmojiPickerFor] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Collect all image messages for lightbox navigation
  const imageMessages = useMemo(() =>
    messages.filter((m) => m.file_url && isImageType(m.file_type)),
    [messages]
  );

  // Scroll to bottom when new messages arrive (if near bottom)
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, autoScroll]);

  // Scroll handler — show FAB + detect if at bottom
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
    setAutoScroll(distFromBottom < 80);

    // Load more when scrolled to top
    if (el.scrollTop < 60 && hasMore && !loadingMore) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  // Group messages by date
  const renderMessages = () => {
    const items: React.ReactNode[] = [];
    let lastDate = '';
    let newMsgDividerShown = false;

    for (const msg of messages) {
      const msgDate = msg.created_at.slice(0, 10); // YYYY-MM-DD
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        items.push(<DateSeparator key={`date-${msgDate}`} date={msg.created_at} />);
      }

      // New messages divider: show after the last read message
      if (
        !newMsgDividerShown &&
        lastReadMessageId &&
        msg.id > lastReadMessageId &&
        msg.sender_id !== currentUserId
      ) {
        newMsgDividerShown = true;
        items.push(
          <div key="new-messages-divider" className="flex items-center gap-3 my-3 px-4">
            <div className="flex-1 h-px bg-red-300" />
            <span className="text-xs font-medium text-red-500 whitespace-nowrap">New Messages</span>
            <div className="flex-1 h-px bg-red-300" />
          </div>
        );
      }

      const isMine = msg.sender_id === currentUserId;
      const isSystem = msg.message_type === 'system';

      if (isSystem) {
        items.push(
          <div key={msg.id} className="flex justify-center my-2">
            <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
              {msg.content}
            </span>
          </div>
        );
        continue;
      }

      items.push(
        <div
          key={msg.id}
          className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-4 py-0.5 group`}
          onMouseEnter={() => setHoveredId(msg.id)}
          onMouseLeave={() => { setHoveredId(null); setEmojiPickerFor(null); setFullEmojiPickerFor(null); }}
        >
          {/* Avatar for others */}
          {!isMine && (
            <div className="flex-shrink-0 mr-2 mt-auto">
              {msg.sender_avatar ? (
                <img
                  src={getFileUrl(msg.sender_avatar)}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600">
                  {getInitials(msg.sender_name)}
                </div>
              )}
            </div>
          )}

          <div className={`relative max-w-[75%] ${isMine ? 'order-1' : ''}`}>
            {/* Sender name (group only, not mine) */}
            {!isMine && (
              <p className="text-[11px] font-medium text-gray-500 mb-0.5 ml-1">{msg.sender_name}</p>
            )}

            {/* Bubble */}
            <div
              className={`relative px-3 py-2 rounded-2xl ${
                isMine
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
              }`}
            >
              {/* Reply preview */}
              {msg.reply_to_id && msg.reply_to && (
                <div className={`mb-1 pl-2 border-l-2 ${
                  isMine ? 'border-blue-300' : 'border-gray-300'
                }`}>
                  <p className={`text-[10px] font-medium ${isMine ? 'text-blue-200' : 'text-gray-500'}`}>
                    {msg.reply_to.sender_name || 'Message'}
                  </p>
                  <p className={`text-[11px] truncate ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                    {msg.reply_to.content || '...'}
                  </p>
                </div>
              )}

              {/* File attachment */}
              <FileAttachment
                msg={msg}
                onImageClick={() => {
                  const idx = imageMessages.findIndex((im) => im.id === msg.id);
                  if (idx >= 0) setLightboxIndex(idx);
                }}
              />

              {/* Text content (hide for media-only messages like GIF, location, contact) */}
              {msg.content && msg.message_type !== 'gif' && msg.message_type !== 'location' && msg.message_type !== 'contact' && (
                <p
                  className="text-sm whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
              )}

              {/* Link preview card */}
              {msg.link_preview && (
                <a
                  href={msg.link_preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block mt-1.5 rounded-lg overflow-hidden border ${
                    isMine ? 'border-blue-400/30 bg-blue-600/20' : 'border-gray-200 bg-white'
                  } hover:opacity-90 transition-opacity max-w-xs`}
                >
                  {msg.link_preview.image && (
                    <img
                      src={msg.link_preview.image}
                      alt=""
                      className="w-full h-32 object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className="px-2.5 py-2">
                    {msg.link_preview.title && (
                      <p className={`text-xs font-semibold leading-tight line-clamp-2 ${
                        isMine ? 'text-white' : 'text-gray-900'
                      }`}>
                        {msg.link_preview.title}
                      </p>
                    )}
                    {msg.link_preview.description && (
                      <p className={`text-[11px] mt-0.5 line-clamp-2 ${
                        isMine ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {msg.link_preview.description}
                      </p>
                    )}
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.link_preview.domain}
                    </p>
                  </div>
                </a>
              )}

              {/* Edited indicator */}
              {msg.edited_at && (
                <span className={`text-[10px] italic ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                  {' '}edited
                </span>
              )}

              {/* Time + status */}
              <div className={`flex items-center justify-end gap-1 mt-0.5 ${
                isMine ? 'text-blue-200' : 'text-gray-400'
              }`}>
                <span className="text-[10px]">{formatMessageTime(msg.created_at)}</span>
                {isMine && <StatusTicks status={msg.status || 'sent'} />}
                {starredIds.has(msg.id) && (
                  <StarIconSolid className="w-3 h-3 text-yellow-400" />
                )}
              </div>
            </div>

            {/* Reactions */}
            <ReactionsBar
              reactions={msg.reactions || []}
              currentUserId={currentUserId}
              onToggle={(emoji) => onReaction(msg.id, emoji)}
            />

            {/* Hover actions toolbar */}
            {hoveredId === msg.id && (
              <div className={`absolute top-0 ${
                isMine ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'
              } flex items-center gap-0.5 bg-white shadow-lg rounded-lg border border-gray-200 px-1 py-0.5 z-10`}>
                <button
                  onClick={() => setEmojiPickerFor(emojiPickerFor === msg.id ? null : msg.id)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="React"
                >
                  <FaceSmileIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onReply(msg)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Reply"
                >
                  <ArrowUturnLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStar(msg.id)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Star"
                >
                  {starredIds.has(msg.id)
                    ? <StarIconSolid className="w-4 h-4 text-yellow-500" />
                    : <StarIcon className="w-4 h-4" />
                  }
                </button>
                <button
                  onClick={() => onForward(msg)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Forward"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </button>
                {isMine && (
                  <>
                    <button
                      onClick={() => onEdit(msg)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(msg)}
                      className="p-1 rounded hover:bg-gray-100 text-red-400"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </>
                )}
                {!isMine && (
                  <button
                    onClick={() => onReport(msg)}
                    className="p-1 rounded hover:bg-gray-100 text-orange-400"
                    title="Report"
                  >
                    <FlagIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Quick emoji picker + full picker */}
            {emojiPickerFor === msg.id && (
              <div className={`absolute ${
                isMine ? 'right-0' : 'left-0'
              } -bottom-8 flex gap-1 bg-white shadow-lg rounded-full border border-gray-200 px-2 py-1 z-20`}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReaction(msg.id, emoji);
                      setEmojiPickerFor(null);
                    }}
                    className="hover:scale-125 transition-transform text-base"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setFullEmojiPickerFor(fullEmojiPickerFor === msg.id ? null : msg.id)}
                  className="hover:scale-110 transition-transform text-base text-gray-400 hover:text-gray-600 px-0.5"
                  title="More emojis"
                >
                  +
                </button>
              </div>
            )}
            {fullEmojiPickerFor === msg.id && (
              <div className={`absolute ${
                isMine ? 'right-0' : 'left-0'
              } -bottom-[340px] z-30`}>
                <EmojiPicker
                  onSelect={(emoji) => {
                    onReaction(msg.id, emoji);
                    setFullEmojiPickerFor(null);
                    setEmojiPickerFor(null);
                  }}
                  onClose={() => setFullEmojiPickerFor(null)}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    return items;
  };

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
      >
        {/* Load more */}
        {loadingMore && (
          <div className="flex justify-center py-3">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {hasMore && !loadingMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              className="text-xs text-blue-500 hover:text-blue-700"
            >
              Load older messages
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        )}

        {renderMessages()}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 w-10 h-10 bg-white shadow-lg border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 z-10 transition-all"
        >
          <ArrowDownIcon className="w-5 h-5 text-gray-600" />
        </button>
      )}

      {/* Image Lightbox */}
      {lightboxIndex !== null && imageMessages.length > 0 && (
        <ImageLightbox
          images={imageMessages.map((m) => ({
            url: m.file_url!,
            name: m.file_name || undefined,
            senderName: m.sender_name,
            date: m.created_at,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
