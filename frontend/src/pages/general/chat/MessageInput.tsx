import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon,
  FaceSmileIcon,
  GifIcon,
  MapPinIcon,
  UserCircleIcon,
  DocumentIcon,
  PlusIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/outline';
import type { ChatMessage, GifResult } from '../../../models/StaffChatModel';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import VoiceRecorder from './VoiceRecorder';
import { fileToBase64, formatFileSize, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL, QUICK_REACTIONS, getInitials, getFileUrl, compressImage } from './chatHelpers';
import { notify } from '../../../utils/notify';

interface MentionableMember {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendFile: (file: { name: string; type: string; size: number; base64: string }) => void;
  onSendGif: (gif: GifResult) => void;
  onSendVoice: (file: { name: string; type: string; size: number; base64: string; duration: number }) => void;
  onSendLocation: () => void;
  onSendContact: () => void;
  onTyping: () => void;
  replyTo: ChatMessage | null;
  editMessage: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => void;
  disabled?: boolean;
  members?: MentionableMember[];
}

export default function MessageInput({
  onSend,
  onSendFile,
  onSendGif,
  onSendVoice,
  onSendLocation,
  onSendContact,
  onTyping,
  replyTo,
  editMessage,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
  disabled,
  members = [],
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Auto-populate when editing
  React.useEffect(() => {
    if (editMessage) {
      setText(editMessage.content || '');
      inputRef.current?.focus();
    }
  }, [editMessage]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editMessage) {
      onSaveEdit(trimmed);
    } else {
      onSend(trimmed);
    }
    setText('');
    setShowEmoji(false);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // Filtered mention suggestions
  const mentionSuggestions = mentionQuery !== null && members.length > 0
    ? members.filter((m) =>
        m.display_name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  const insertMention = (member: MentionableMember) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(inputRef.current?.selectionStart || text.length);
    const newText = `${before}@${member.display_name} ${after}`;
    setText(newText);
    setMentionQuery(null);
    setMentionStart(-1);
    setMentionIdx(0);
    setTimeout(() => {
      const pos = before.length + member.display_name.length + 2; // +2 for @ and space
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Mention keyboard navigation
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx((prev) => Math.min(prev + 1, mentionSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (editMessage) onCancelEdit();
      if (replyTo) onCancelReply();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx >= 0) {
      const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : ' ';
      const query = textBefore.slice(atIdx + 1);
      // Only trigger if @ is at start or preceded by whitespace, and no space in query
      if ((atIdx === 0 || /\s/.test(charBefore)) && !/\s/.test(query) && members.length > 0) {
        setMentionQuery(query);
        setMentionStart(atIdx);
        setMentionIdx(0);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }

    // Typing indicator (debounced)
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping();
    typingTimer.current = setTimeout(() => {}, 2000);
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      notify.error(`File too large. Max ${MAX_FILE_SIZE_LABEL}.`);
      return;
    }

    try {
      setUploading(true);
      // Client-side image compression (if applicable)
      const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      const base64 = await fileToBase64(processedFile);
      onSendFile({
        name: processedFile.name,
        type: processedFile.type,
        size: processedFile.size,
        base64,
      });
    } catch {
      notify.error('Failed to read file');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [onSendFile]);

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="w-1 h-8 bg-blue-400 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-600">{replyTo.sender_name}</p>
            <p className="text-xs text-gray-500 truncate">{replyTo.content || '📎 File'}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 hover:bg-blue-100 rounded">
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Edit indicator */}
      {editMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <div className="w-1 h-8 bg-amber-400 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-700">Editing message</p>
            <p className="text-xs text-gray-500 truncate">{editMessage.content}</p>
          </div>
          <button onClick={onCancelEdit} className="p-1 hover:bg-amber-100 rounded">
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2 px-4 py-3">
        {/* @mention dropdown */}
        {mentionSuggestions.length > 0 && (
          <div
            ref={mentionListRef}
            className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-52 overflow-y-auto z-30"
          >
            {mentionSuggestions.map((m, idx) => (
              <button
                key={m.user_id}
                onClick={() => insertMention(m)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
                  idx === mentionIdx ? 'bg-blue-50' : ''
                }`}
              >
                {m.avatar_url ? (
                  <img
                    src={getFileUrl(m.avatar_url)}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0">
                    {getInitials(m.display_name)}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 truncate">{m.display_name}</span>
              </button>
            ))}
          </div>
        )}
        {/* Emoji toggle */}
        <div className="relative">
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Emoji"
          >
            <FaceSmileIcon className="w-5 h-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-12 left-0 z-20">
              <EmojiPicker
                onSelect={(emoji) => {
                  setText((prev) => prev + emoji);
                  inputRef.current?.focus();
                }}
                onClose={() => setShowEmoji(false)}
              />
            </div>
          )}
        </div>

        {/* GIF picker */}
        <div className="relative">
          <button
            onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="GIF"
          >
            <GifIcon className="w-5 h-5" />
          </button>
          {showGif && (
            <div className="absolute bottom-12 left-0 z-20">
              <GifPicker
                onSelect={(gif) => {
                  onSendGif(gif);
                  setShowGif(false);
                }}
                onClose={() => setShowGif(false)}
              />
            </div>
          )}
        </div>

        {/* Attach menu (File, Location, Contact) */}
        <div className="relative">
          <button
            onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmoji(false); setShowGif(false); }}
            disabled={uploading || disabled}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="Attach"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlusIcon className="w-5 h-5" />
            )}
          </button>
          {showAttachMenu && (
            <div className="absolute bottom-12 left-0 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-44">
              <button
                onClick={() => { fileRef.current?.click(); setShowAttachMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <DocumentIcon className="w-4 h-4 text-blue-500" />
                File
              </button>
              <button
                onClick={() => { onSendLocation(); setShowAttachMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <MapPinIcon className="w-4 h-4 text-red-500" />
                Location
              </button>
              <button
                onClick={() => { onSendContact(); setShowAttachMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <UserCircleIcon className="w-4 h-4 text-green-500" />
                Staff contact
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
        />

        {/* Voice recorder (replaces input area when recording) */}
        {recording ? (
          <VoiceRecorder
            onSend={(voice) => {
              onSendVoice(voice);
              setRecording(false);
            }}
            onCancel={() => setRecording(false)}
          />
        ) : (
          <>
            {/* Text input */}
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onInput={(e) => autoResize(e.currentTarget)}
              placeholder={editMessage ? 'Edit your message...' : 'Type a message...'}
              disabled={disabled}
              rows={1}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-[150px]"
            />

            {/* Send or Mic button */}
            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={disabled}
                className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={editMessage ? 'Save edit' : 'Send message'}
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setRecording(true)}
                disabled={disabled}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                title="Record voice note"
              >
                <MicrophoneIcon className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
