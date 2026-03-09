/**
 * Shared types, constants, and utility helpers for the External Groups Chat UI.
 */
import DOMPurify from 'dompurify';

// ─── Constants ──────────────────────────────────────────────

/** GRP-002: Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Human-readable max file size label */
export const MAX_FILE_SIZE_LABEL = '10 MB';

// ─── Types ──────────────────────────────────────────────────

export interface UnifiedGroup {
  id: string;                   // "ext_<whatsapp_group_id>"
  name: string;
  last_message?: string;
  timestamp?: number;           // unix seconds
  member_count?: number;
  description?: string;
  unread_count?: number;        // GRP-010: unread badge counter
}

export interface UnifiedMessage {
  id: string;
  text: string;
  user_id?: string | number;
  user_name: string;
  timestamp: number;            // unix seconds
  direction?: string;
  message_type?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  caption?: string;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_user_name?: string;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Build a full URL for a file received from an external group.
 * Absolute URLs and data-URIs pass through unchanged.
 */
export function getFileUrl(relativePath?: string): string {
  if (!relativePath) return '';
  if (
    relativePath.startsWith('http://') ||
    relativePath.startsWith('https://') ||
    relativePath.startsWith('data:')
  ) {
    return relativePath;
  }
  const baseUrl = 'https://portal.silulumanzi.com';
  return `${baseUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

export function isImageMessage(content?: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.startsWith('data:image/')) return true;
  return /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(content) || content.includes('wp_media_');
}

export function isVideoMessage(content?: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(content);
}

export function isAudioMessage(content?: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(content);
}

/**
 * GRP-004: Sanitise message HTML using DOMPurify instead of regex.
 * Converts newlines to <br> for display.
 */
export function sanitizeMessage(message?: string): string {
  if (!message || typeof message !== 'string') return 'Empty message';
  const withBreaks = message.replace(/\n/g, '<br>');
  return DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
}

export function formatMessageTime(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function showBrowserNotification(title: string, body: string, tag: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/logo192.png', silent: false });
  } catch {
    /* ignore */
  }
}

/**
 * Determine if a message was sent by the current user.
 *
 * External groups: Softaware connects to the remote socket server as a
 * single agent. The remote server has its own user IDs that do NOT correspond
 * to our local user IDs. So we match by display name only.
 */
export function isOutgoingMessage(
  msg: UnifiedMessage,
  currentUserNameLower?: string,
): boolean {
  if (currentUserNameLower && currentUserNameLower !== '') {
    const senderName = (msg.user_name || '').toLowerCase().trim();
    if (senderName !== '' && senderName === currentUserNameLower) return true;
  }
  return false;
}
