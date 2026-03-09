/**
 * MessageInput — file attach, paste, reply preview, send controls.
 * Enforces GRP-002 file size limit.
 * Emits typing events for GRP-011.
 * Part of GRP-012 decomposition.
 */
import React, { useRef, useCallback, type FormEvent, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import {
  PaperAirplaneIcon,
  PaperClipIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../../utils/notify';
import type { UnifiedMessage } from './chatTypes';
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from './chatTypes';

interface MessageInputProps {
  newMessage: string;
  onMessageChange: (val: string) => void;
  attachedFiles: File[];
  onFilesChange: (files: File[]) => void;
  replyingTo: UnifiedMessage | null;
  onCancelReply: () => void;
  sendingMessage: boolean;
  sendingFile: boolean;
  onSend: (e?: FormEvent) => void;
  /** GRP-011: called when user starts/stops typing */
  onTyping?: () => void;
  onStopTyping?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  newMessage,
  onMessageChange,
  attachedFiles,
  onFilesChange,
  replyingTo,
  onCancelReply,
  sendingMessage,
  sendingFile,
  onSend,
  onTyping,
  onStopTyping,
}) => {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── File size guard (GRP-002) ─────────────────────────────

  const validateFileSize = useCallback(
    (files: File[]): File[] => {
      const valid: File[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          notify.error(`"${file.name}" exceeds the ${MAX_FILE_SIZE_LABEL} limit`);
        } else {
          valid.push(file);
        }
      }
      return valid;
    },
    [],
  );

  // ── Paste handler ─────────────────────────────────────────

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split('/')[1] || 'png';
            const named = new File([file], `screenshot_${Date.now()}.${ext}`, { type: file.type });
            files.push(named);
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        const valid = validateFileSize(files);
        if (valid.length > 0) onFilesChange([...attachedFiles, ...valid]);
      }
    },
    [attachedFiles, onFilesChange, validateFileSize],
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const valid = validateFileSize(files);
      if (valid.length > 0) onFilesChange([...attachedFiles, ...valid]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [attachedFiles, onFilesChange, validateFileSize],
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(attachedFiles.filter((_, i) => i !== index));
    },
    [attachedFiles, onFilesChange],
  );

  // ── Typing events (GRP-011) ───────────────────────────────

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onMessageChange(val);

      // Auto-resize
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';

      // Emit typing
      if (val.trim()) {
        onTyping?.();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          onStopTyping?.();
        }, 2000);
      } else {
        onStopTyping?.();
      }
    },
    [onMessageChange, onTyping, onStopTyping],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onStopTyping?.();
        onSend();
      }
    },
    [onSend, onStopTyping],
  );

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="border-t bg-white p-3">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-l-purple-500 bg-purple-50 px-3 py-2">
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-purple-700">
              Replying to {replyingTo.user_name}
            </div>
            <div className="truncate text-xs text-gray-500">
              {replyingTo.file_url
                ? `📎 ${replyingTo.file_name || 'File'}`
                : replyingTo.text?.substring(0, 80)}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 shrink-0 rounded p-1 hover:bg-gray-200"
          >
            <XMarkIcon className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </div>
      )}

      {/* File previews */}
      {attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border bg-gray-50 p-2">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="relative h-[70px] w-[70px] overflow-hidden rounded-lg border bg-white shadow-sm"
            >
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-gray-400 p-1">
                  <DocumentIcon className="h-6 w-6" />
                  <span className="text-[9px] truncate w-full text-center mt-0.5">
                    {file.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeFile(idx)}
                className="absolute right-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={onSend} className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          multiple
        />
        <button
          type="button"
          className="p-2.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={sendingMessage || sendingFile}
          title="Attach file"
        >
          <PaperClipIcon className="h-5 w-5" />
        </button>

        <textarea
          ref={messageInputRef}
          placeholder={
            attachedFiles.length > 0
              ? 'Add a caption…'
              : 'Type a message… (paste images, Shift+Enter for newline)'
          }
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={sendingMessage || sendingFile}
          className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue resize-none overflow-hidden"
          rows={1}
          style={{ maxHeight: 200 }}
        />

        <button
          type="submit"
          className="p-2.5 rounded-full bg-picton-blue text-white hover:bg-picton-blue/90 disabled:opacity-50 transition-colors shrink-0"
          disabled={
            (!newMessage.trim() && attachedFiles.length === 0) ||
            sendingMessage ||
            sendingFile
          }
        >
          {sendingFile ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default React.memo(MessageInput);
